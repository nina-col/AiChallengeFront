/**
 * @jest-environment ./src/components/room/__tests__/canvaskit-env.js
 */
import { AlphaType, ColorType, FilterMode, MipmapMode, Skia, type SamplingOptions, type SkImage } from '@shopify/react-native-skia';
import { drawOffscreen, makeOffscreenSurface } from '@shopify/react-native-skia/lib/commonjs/headless';
import { act, type ReactElement } from 'react';

import { buildDrawList } from '../depth';
import { roomArtSize } from '../iso';
import { defaultLayout, earnedTypes, ownedModifiers, uidMaker } from '../layout';
import { MANIFEST } from '../manifest';
import { atlasInputs, RoomAtlas } from '../room-canvas';
import type { DrawItem, Manifest } from '../types';

/**
 * El cuarto dibujado con Skia de verdad y sin teléfono: CanvasKit (Skia en WASM, el mismo de web)
 * lo carga `canvaskit-env.js`, y `<RoomAtlas>` se dibuja con el reconciliador de Skia, como dentro
 * de `<Canvas>`. Se compara pixel por pixel con una imagen compuesta aparte (el PNG leído con zlib y
 * cada sprite copiado a mano), así que prueba las RSXform, el muestreo de vecino más cercano, los
 * rectángulos del atlas y la opacidad por sprite.
 */

// Skia web, sobre el CanvasKit del entorno, en lugar del módulo nativo (como el `jestSetup` de Skia).
jest.mock('@shopify/react-native-skia', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@shopify/react-native-skia/lib/commonjs/mock').Mock((globalThis as { CanvasKit?: unknown }).CanvasKit),
);

// Node (en Jest): la app no carga sus tipos, así que se declaran los que se usan.
declare const __dirname: string;
/* eslint-disable @typescript-eslint/no-require-imports */
const fs: { readFileSync(file: string): Uint8Array } = require('fs');
const path: { join(...parts: string[]): string } = require('path');
const zlib: { inflateSync(data: Uint8Array): Uint8Array } = require('zlib');
/* eslint-enable @typescript-eslint/no-require-imports */

type Raster = { width: number; height: number; data: Uint8Array };

const ATLAS_PNG = path.join(__dirname, '..', '..', '..', '..', 'assets', 'room', 'atlas.png');
/** Fondo opaco del lienzo: así todo pixel del resultado es opaco. */
const BG = [0x20, 0x30, 0x40];
const NEAREST: SamplingOptions = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };
const LINEAR: SamplingOptions = { filter: FilterMode.Linear, mipmap: MipmapMode.None };

// Sala de ejemplo: la de un lugar fijo con todo lo que se puede ganar (piso, pared y superficies).
const SPACE = 'office-1';
const OWNED = earnedTypes(MANIFEST, Object.values(MANIFEST.types).flatMap((t) => t.adjustments ?? []));
const LAYOUT = defaultLayout(SPACE, MANIFEST, OWNED, uidMaker(SPACE));
const LIST = buildDrawList(LAYOUT, MANIFEST, { sky: 'dusk', owned: ownedModifiers(MANIFEST, OWNED) });
const ART = roomArtSize(MANIFEST, LAYOUT.size);

/** La lista de ejemplo con opacidad en los objetos de esos tipos. */
const fade = (alphas: Record<string, number>) =>
  LIST.map((d) => {
    const type = LAYOUT.items.find((i) => i.uid === d.uid)?.type;
    return type !== undefined && type in alphas ? { ...d, alpha: alphas[type] } : d;
  });

/**
 * PNG RGBA de 8 bits sin entrelazar (lo que escribe draw_room.py) → RGBA sin premultiplicar, con el
 * zlib de Node: la imagen esperada no pasa por Skia.
 */
function decodePng(file: Uint8Array): Raster {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  for (let at = 8; at < file.length; ) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...file.subarray(at + 4, at + 8));
    if (type === 'IHDR') {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      const [depth, colorType, , , interlace] = file.subarray(at + 16, at + 21);
      if (depth !== 8 || colorType !== 6 || interlace !== 0) throw new Error('atlas.png: se esperaba RGBA de 8 bits sin entrelazar');
    } else if (type === 'IDAT') {
      idat.push(file.subarray(at + 8, at + 8 + length));
    }
    at += 12 + length;
  }
  const zipped = new Uint8Array(idat.reduce((n, chunk) => n + chunk.length, 0));
  let offset = 0;
  for (const chunk of idat) {
    zipped.set(chunk, offset);
    offset += chunk.length;
  }
  const raw = zlib.inflateSync(zipped);
  const stride = width * 4;
  const data = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? data[y * stride + x - 4] : 0; // izquierda
      const b = y > 0 ? data[(y - 1) * stride + x] : 0; // arriba
      const c = x >= 4 && y > 0 ? data[(y - 1) * stride + x - 4] : 0; // arriba a la izquierda
      const p = a + b - c;
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      const predictor = [0, a, b, (a + b) >> 1, paeth][filter];
      if (predictor === undefined) throw new Error(`atlas.png: filtro ${filter} desconocido`);
      data[y * stride + x] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  return { width, height, data };
}

/**
 * La imagen esperada, compuesta a mano desde la lista de dibujo (no desde `atlasInputs`): cada px de
 * arte del cuadro es un bloque de k × k px, uno sobre otro en orden ("source over"). `loose` marca
 * los pixeles que salen de una mezcla parcial, donde se acepta ±1 por el redondeo de Skia.
 */
function compose(list: readonly DrawItem[], png: Raster, k: number) {
  const width = ART.w * k;
  const height = ART.h * k;
  const data = new Uint8Array(width * height * 4);
  const loose = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p++) data.set([...BG, 255], p * 4);
  for (const item of list) {
    const [fx, fy, fw, fh] = MANIFEST.frames[item.frame].rect;
    // Skia guarda la opacidad en 8 bits (en web, redondeada).
    const alpha = Math.round((item.alpha ?? 1) * 255) / 255;
    for (let v = 0; v < fh; v++) {
      for (let u = 0; u < fw; u++) {
        const src = ((fy + v) * png.width + fx + u) * 4;
        const a = (png.data[src + 3] / 255) * alpha;
        if (a === 0) continue;
        for (let j = 0; j < k; j++) {
          for (let i = 0; i < k; i++) {
            const x = (item.x + u) * k + i;
            const y = (item.y + v) * k + j;
            if (x < 0 || y < 0 || x >= width || y >= height) continue;
            const dst = (y * width + x) * 4;
            for (let c = 0; c < 3; c++) data[dst + c] = Math.round(png.data[src + c] * a + data[dst + c] * (1 - a));
            loose[y * width + x] = a < 1 ? 1 : 0;
          }
        }
      }
    }
  }
  return { width, data, loose };
}

/** Pixeles que no coinciden: exactos, salvo ±1 por canal donde hubo mezcla parcial. */
function mismatches(actual: Uint8Array, expected: ReturnType<typeof compose>) {
  const first: string[] = [];
  let count = 0;
  for (let p = 0; p < expected.loose.length; p++) {
    for (let c = 0; c < 4; c++) {
      if (Math.abs(actual[p * 4 + c] - expected.data[p * 4 + c]) <= expected.loose[p]) continue;
      count++;
      const at = `(${p % expected.width}, ${Math.floor(p / expected.width)})`;
      if (first.length < 5) first.push(`${at}: ${actual.subarray(p * 4, p * 4 + 4)} ≠ ${expected.data.subarray(p * 4, p * 4 + 4)}`);
      break;
    }
  }
  return { count, first };
}

/** Bytes distintos entre dos imágenes del mismo tamaño. */
const differentBytes = (a: Uint8Array, b: Uint8Array) => (a.length === b.length ? a.filter((v, i) => v !== b[i]).length : Infinity);

/** RGBA de 8 bits premultiplicado (con el fondo opaco, igual que sin premultiplicar). */
function pixels(image: SkImage) {
  const info = { width: image.width(), height: image.height(), colorType: ColorType.RGBA_8888, alphaType: AlphaType.Premul };
  const data = image.readPixels(0, 0, info);
  if (!(data instanceof Uint8Array)) throw new Error('readPixels no devolvió RGBA de 8 bits');
  return data;
}

/** `BG` como color de Skia. */
const background = () => Skia.Color(BG.map((c) => c / 255).concat(1));

/** Dibuja `element` como dentro de `<Canvas>` (con el reconciliador de Skia) y lee sus pixeles. */
async function render(element: ReactElement, k: number) {
  const surface = makeOffscreenSurface(ART.w * k, ART.h * k);
  surface.getCanvas().clear(background());
  let drawn: Promise<SkImage> | undefined;
  // `act` vacía la cola de React; la promesa se espera afuera porque se resuelve justo al vaciarla.
  await act(async () => {
    drawn = drawOffscreen(surface, element);
  });
  return pixels(await drawn!);
}

/** `drawAtlas` directo, sin reconciliador, con lo que da `atlasInputs` y el muestreo indicado. */
function drawDirect(image: SkImage, list: readonly DrawItem[], k: number, sampling: SamplingOptions) {
  const { rects, xforms } = atlasInputs(list, MANIFEST, k);
  const surface = Skia.Surface.Make(ART.w * k, ART.h * k)!;
  const canvas = surface.getCanvas();
  canvas.clear(background());
  const sprites = rects.map(([x, y, w, h]) => Skia.XYWHRect(x, y, w, h));
  const transforms = xforms.map(([scos, ssin, tx, ty]) => Skia.RSXform(scos, ssin, tx, ty));
  canvas.drawAtlas(image, sprites, transforms, Skia.Paint(), undefined, undefined, sampling);
  surface.flush();
  return pixels(surface.makeImageSnapshot());
}

describe('atlasInputs', () => {
  const manifest: Pick<Manifest, 'frames'> = {
    frames: {
      a: { rect: [10, 20, 3, 4], anchor: [0, 0], mask: '' },
      b: { rect: [0, 0, 5, 6], anchor: [0, 0], mask: '' },
    },
  };

  it('rectángulos del atlas y RSXform a escala s; sin colores si todo es opaco', () => {
    const list: DrawItem[] = [
      { frame: 'a', x: 7, y: -2 },
      { frame: 'falta', x: 0, y: 0 },
      { frame: 'b', x: 1, y: 2, alpha: 1 },
    ];
    const inputs = atlasInputs(list, manifest, 1.5);
    expect(inputs).toStrictEqual({
      rects: [
        [10, 20, 3, 4],
        [0, 0, 5, 6],
      ],
      xforms: [
        [1.5, 0, 10.5, -3],
        [1.5, 0, 1.5, 3],
      ],
    });
    expect(inputs.rects[0]).not.toBe(manifest.frames.a.rect);
  });

  it('con algún sprite translúcido, cada uno lleva blanco con su opacidad, acotada a [0, 1]', () => {
    const alphas = [0.5, undefined, -1, 2, NaN, 0];
    const list: DrawItem[] = alphas.map((alpha) => ({ frame: 'a', x: 0, y: 0, alpha }));
    expect(atlasInputs(list, manifest, 1).colors).toEqual([
      [1, 1, 1, 0.5],
      [1, 1, 1, 1],
      [1, 1, 1, 0],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 0],
    ]);
  });
});

describe('el cuarto dibujado con Skia (CanvasKit, sin teléfono)', () => {
  let atlas: SkImage; // decodificado por Skia, como `useImage`
  let png: Raster; // decodificado aparte, para la imagen esperada

  beforeAll(() => {
    const file = new Uint8Array(fs.readFileSync(ATLAS_PNG));
    atlas = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(file))!;
    png = decodePng(file);
  });

  it('Skia lee el atlas igual que zlib (sin cambios de color)', () => {
    const info = { width: png.width, height: png.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul };
    expect([atlas.width(), atlas.height()]).toEqual([png.width, png.height]);
    expect(differentBytes(atlas.readPixels(0, 0, info) as Uint8Array, png.data)).toBe(0);
  });

  it('la sala de ejemplo tiene piso, paredes, ventana, cielo y objetos de piso, pared y superficie', () => {
    const kinds = new Set(LIST.map((d) => d.frame.split('.')[0]));
    expect([...kinds]).toEqual(expect.arrayContaining(['floor', 'wall', 'window', 'sky', 'blinds']));
    expect(new Set(LAYOUT.items.map((i) => i.place.on))).toEqual(new Set(['floor', 'surface', 'wall']));
    expect(LIST.every((d) => Number.isInteger(d.x) && Number.isInteger(d.y))).toBe(true);
  });

  it.each([1, 3])('a escala %i coincide pixel por pixel con la imagen compuesta a mano', async (k) => {
    const actual = await render(<RoomAtlas image={atlas} drawList={LIST} manifest={MANIFEST} s={k} />, k);
    expect(mismatches(actual, compose(LIST, png, k))).toEqual({ count: 0, first: [] });
  });

  it('el muestreo importa: con drawAtlas directo, vecino más cercano coincide y lineal no', () => {
    const expected = compose(LIST, png, 3);
    expect(mismatches(drawDirect(atlas, LIST, 3, NEAREST), expected).count).toBe(0);
    expect(mismatches(drawDirect(atlas, LIST, 3, LINEAR), expected).count).toBeGreaterThan(1000);
  });

  it.each([1, 3])('a escala %i, la opacidad por sprite mezcla el objeto (±1/255) y deja exacto lo demás', async (k) => {
    const list = fade({ desk: 0.5, chair: 0.25 });
    const actual = await render(<RoomAtlas image={atlas} drawList={list} manifest={MANIFEST} s={k} />, k);
    const expected = compose(list, png, k);
    expect(expected.loose.filter(Boolean).length).toBeGreaterThan(200 * k * k);
    expect(mismatches(actual, expected)).toEqual({ count: 0, first: [] });
    // Y el fundido se ve: esos pixeles ya no son los del cuarto opaco.
    expect(mismatches(actual, compose(LIST, png, k)).count).toBeGreaterThan(200 * k * k);
  });

  it('opacidad 0 es como no dibujarlo', async () => {
    const desk = LAYOUT.items.find((i) => i.type === 'desk')!.uid;
    const hidden = await render(<RoomAtlas image={atlas} drawList={fade({ desk: 0 })} manifest={MANIFEST} s={2} />, 2);
    const without = await render(<RoomAtlas image={atlas} drawList={LIST.filter((d) => d.uid !== desk)} manifest={MANIFEST} s={2} />, 2);
    expect(differentBytes(hidden, without)).toBe(0);
  });
});
