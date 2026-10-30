/**
 * @jest-environment ./src/components/room/__tests__/canvaskit-env.js
 */
import { buildDrawList } from '../depth';
import { beginDrag, dragUpdate } from '../drag';
import { hitCandidates, hitTest, maskBit } from '../hit';
import { pickScale, roomArtSize, TILE_H, TILE_W, touchToArt } from '../iso';
import { defaultLayout, earnedTypes, ownedModifiers, uidMaker } from '../layout';
import { MANIFEST } from '../manifest';
import { samePlace } from '../occupancy';
import { atlasInputs } from '../room-canvas';
import type { DrawItem } from '../types';

/**
 * Del dedo al pixel de arte, sin teléfono. `RoomCanvas` mide `art · s` pt con `s = k / pixelRatio`
 * y dibuja cada sprite con la RSXform de `atlasInputs` (escala `s`, esquina en `(x·s, y·s)`). Los
 * toques llegan en pt relativos a la esquina del lienzo: los de `Pressable` (`locationX/Y`) y los
 * del arrastre (RNGH 3: `event.x/y` son relativos al detector, que mide lo mismo que su único hijo,
 * el lienzo). `touchToArt` los pasa a px de arte. Aquí, con las escalas de teléfonos reales, tocar
 * el centro de un pixel visible de cada objeto (donde lo dibuja Skia) lo elige, y levantarlo para
 * arrastrar no lo hace saltar.
 */

jest.mock('@shopify/react-native-skia', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@shopify/react-native-skia/lib/commonjs/mock').Mock((globalThis as { CanvasKit?: unknown }).CanvasKit),
);

/** Lo mismo que usa `RoomView` para elegir lo pequeño. */
const NEAREST_PX = 6;

const SPACE = 'office-1';
const OWNED = earnedTypes(MANIFEST, Object.values(MANIFEST.types).flatMap((t) => t.adjustments ?? []));
const LAYOUT = defaultLayout(SPACE, MANIFEST, OWNED, uidMaker(SPACE));
const LIST = buildDrawList(LAYOUT, MANIFEST, { sky: 'day', owned: ownedModifiers(MANIFEST, OWNED) });
const ART = roomArtSize(MANIFEST, LAYOUT.size);

/** Ancho útil en pt (pantalla menos 2 × 16 pt de margen) y pixeles por pt. */
const PHONES = [
  { name: 'iPhone SE', width: 375 - 32, ratio: 2 },
  { name: 'iPhone 15', width: 393 - 32, ratio: 3 },
  { name: 'iPhone 15 Pro Max', width: 430 - 32, ratio: 3 },
  { name: 'Android 2.625', width: 360 - 32, ratio: 2.625 },
];

/** Un pixel opaco del sprite donde ese objeto es el de más adelante (el que se ve), cerca de su centro. */
function visiblePixel(d: DrawItem): [number, number] | null {
  const frame = MANIFEST.frames[d.frame];
  const [, , w, h] = frame.rect;
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (frame.mask && !maskBit(frame.mask, w, px, py)) continue;
      if (hitCandidates(LIST, MANIFEST, d.x + px + 0.5, d.y + py + 0.5)[0] !== d.uid) continue;
      const dist = (px - w / 2) ** 2 + (py - h / 2) ** 2;
      if (dist < bestD) {
        best = [px, py];
        bestD = dist;
      }
    }
  }
  return best;
}

const objects = LIST.filter((d, i) => d.uid && LIST.findIndex((e) => e.uid === d.uid) === i);
const visible = objects.map((d) => ({ d, pixel: visiblePixel(d) })).filter((o) => o.pixel);

describe.each(PHONES)('$name', ({ width, ratio }) => {
  const k = pickScale(width, ART.w, ratio);
  const s = k / ratio;
  const { xforms } = atlasInputs(LIST, MANIFEST, s);
  /** Dónde dibuja Skia el centro del pixel `(px, py)` del sprite `i`, en pt del lienzo. */
  const drawnAt = (i: number, px: number, py: number) => {
    const [scos, , tx, ty] = xforms[i];
    return { x: tx + (px + 0.5) * scos, y: ty + (py + 0.5) * scos };
  };

  it('el lienzo cabe y cada px de arte mide pixeles enteros', () => {
    expect(ART.w * s).toBeLessThanOrEqual(width);
    expect(Number.isInteger(s * ratio)).toBe(true);
  });

  it('tocar un pixel visible de cada objeto lo elige', () => {
    expect(visible.length).toBeGreaterThanOrEqual(objects.length - 2);
    for (const { d, pixel } of visible) {
      const pt = drawnAt(LIST.indexOf(d), pixel![0], pixel![1]);
      const p = touchToArt(pt.x, pt.y, k, ratio);
      expect(p.ax).toBeCloseTo(d.x + pixel![0] + 0.5, 9);
      expect(p.ay).toBeCloseTo(d.y + pixel![1] + 0.5, 9);
      expect({ uid: d.uid, hit: hitTest(LIST, MANIFEST, p.ax, p.ay, { nearestPx: NEAREST_PX }) }).toEqual({ uid: d.uid, hit: d.uid });
    }
  });

  it('levantarlo para arrastrar no lo mueve; correr el dedo una baldosa lo corre una casilla', () => {
    for (const { d, pixel } of visible) {
      const it = LAYOUT.items.find((x) => x.uid === d.uid)!;
      const pt = drawnAt(LIST.indexOf(d), pixel![0], pixel![1]);
      const state = beginDrag(LAYOUT, MANIFEST, d.uid!, touchToArt(pt.x, pt.y, k, ratio));
      expect(state).not.toBeNull();
      const still = dragUpdate(state!, LAYOUT, MANIFEST, touchToArt(pt.x, pt.y, k, ratio));
      expect({ type: it.type, same: !!still.place && samePlace(still.place, it.place) }).toEqual({ type: it.type, same: true });
      if (it.place.on !== 'floor' || it.place.x + 1 >= LAYOUT.size.w) continue;
      // Una casilla en +x son (16, 8) px de arte: (16·s, 8·s) pt en la pantalla.
      const next = dragUpdate(state!, LAYOUT, MANIFEST, touchToArt(pt.x + (TILE_W / 2) * s, pt.y + (TILE_H / 2) * s, k, ratio));
      expect(next.place).toMatchObject({ on: 'floor', x: it.place.x + 1, y: it.place.y });
    }
  });
});
