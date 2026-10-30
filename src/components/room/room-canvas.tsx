import { Atlas, Canvas, DashPathEffect, FilterMode, MipmapMode, Rect, Skia, type SkImage } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { PixelRatio, Pressable, type GestureResponderEvent } from 'react-native';

import { touchToArt } from '@/components/room/iso';
import type { DrawItem, Manifest } from '@/components/room/types';

/** Los tonos de las casillas de edición: el arte no cambia con la paleta y uno de los dos siempre contrasta. */
const OUTLINE_LIGHT = '#C3E6D6';
const OUTLINE_DARK = '#20494A';

/** Pixeles nítidos: sin suavizado al escalar (Skia suaviza por defecto). */
const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;

type Quad = [number, number, number, number];

/** Lo que recibe el `Atlas`, en números (sin objetos de Skia). */
export type AtlasInputs = {
  /** Rectángulo de cada sprite en el atlas: `[x, y, ancho, alto]` en px. */
  rects: Quad[];
  /** `RSXform` de cada sprite, `[s·cos, s·sin, tx, ty]`: sin giro, escala `s` y su esquina superior izquierda en `(x·s, y·s)`. */
  xforms: Quad[];
  /**
   * Color de cada sprite, `[r, g, b, a]`: blanco con su opacidad. Con `colorBlendMode="modulate"`
   * Skia lo premultiplica a `(a, a, a, a)` y multiplica por él el sprite (premultiplicado). Solo
   * viene si algún sprite no es opaco; si no, el `Atlas` se dibuja sin colores, como siempre.
   */
  colors?: Quad[];
};

/** Opacidad de un `DrawItem` en `[0, 1]`; sin valor (o `NaN`), 1. */
const opacity = (alpha: number | undefined) =>
  alpha === undefined || Number.isNaN(alpha) ? 1 : Math.min(1, Math.max(0, alpha));

/**
 * Lista de dibujo → lo que recibe el `Atlas`, a `s` unidades del lienzo por px de arte. Pura: la usa
 * `RoomAtlas` y la dibujan con CanvasKit las pruebas de imagen (`__tests__/render.skia.test.tsx`).
 * Los cuadros que no están en el manifiesto no se dibujan.
 */
export function atlasInputs(drawList: readonly DrawItem[], manifest: Pick<Manifest, 'frames'>, s: number): AtlasInputs {
  const rects: Quad[] = [];
  const xforms: Quad[] = [];
  const alphas: number[] = [];
  for (const item of drawList) {
    const frame = manifest.frames[item.frame];
    if (!frame) continue;
    const [fx, fy, fw, fh] = frame.rect;
    rects.push([fx, fy, fw, fh]);
    xforms.push([s, 0, item.x * s, item.y * s]);
    alphas.push(opacity(item.alpha));
  }
  if (alphas.every((a) => a === 1)) return { rects, xforms };
  return { rects, xforms, colors: alphas.map((a): Quad => [1, 1, 1, a]) };
}

type RoomAtlasProps = {
  image: SkImage;
  /** Lo que se dibuja, ya ordenado (`buildDrawList`). */
  drawList: readonly DrawItem[];
  manifest: Pick<Manifest, 'frames'>;
  /** Unidades del lienzo por px de arte. */
  s: number;
};

/**
 * El cuarto como un solo `Atlas` (una llamada de dibujo) con muestreo de vecino más cercano. Va
 * dentro de un `Canvas`; está aparte de `RoomCanvas` para que las pruebas lo dibujen tal cual.
 */
export function RoomAtlas({ image, drawList, manifest, s }: RoomAtlasProps) {
  const { sprites, transforms, colors } = useMemo(() => {
    const inputs = atlasInputs(drawList, manifest, s);
    return {
      sprites: inputs.rects.map(([x, y, w, h]) => Skia.XYWHRect(x, y, w, h)),
      transforms: inputs.xforms.map(([scos, ssin, tx, ty]) => Skia.RSXform(scos, ssin, tx, ty)),
      colors: inputs.colors?.map((c) => Skia.Color(c)),
    };
  }, [drawList, manifest, s]);
  return (
    <Atlas
      image={image}
      sprites={sprites}
      transforms={transforms}
      colors={colors}
      colorBlendMode={colors ? 'modulate' : undefined}
      sampling={NEAREST}
    />
  );
}

type RoomCanvasProps = {
  /** Lo que se dibuja, ya ordenado (`buildDrawList` o `sceneDrawList`). */
  drawList: readonly DrawItem[];
  manifest: Manifest;
  /** El atlas ya cargado (`useImage(ATLAS)`); mientras carga, el lienzo queda vacío. */
  image: SkImage | null;
  /** Tamaño del lienzo en px de arte. */
  artSize: { w: number; h: number };
  /** px de dispositivo por px de arte (entero, `pickScale`): así cada pixel de arte cae en pixeles enteros. */
  k: number;
  /** Opacidad de todo el cuarto (su entrada en modo tranquilo): va al lienzo entero, no por sprite. */
  opacity?: number;
  /** Toque en px de arte (para elegir objeto o casilla). */
  onPressArt?: (ax: number, ay: number) => void;
  /** Contorno punteado del objeto elegido, en px de arte, en dos tonos alternados: forma y no solo color. */
  outline?: { x: number; y: number; w: number; h: number };
  accessibilityLabel: string;
};

/**
 * El cuarto en Skia (`RoomAtlas`) a escala entera. No anima por su cuenta: cuando cambia la lista
 * (un cuadro de reposo, un objeto movido, una opacidad), se vuelve a dibujar. Su vista raíz mide
 * justo el lienzo: un toque (aquí o en el arrastre que la envuelve) llega en pt relativos a su
 * esquina y `touchToArt` lo pasa a px de arte.
 */
export function RoomCanvas({
  drawList,
  manifest,
  image,
  artSize,
  k,
  opacity: roomOpacity = 1,
  onPressArt,
  outline,
  accessibilityLabel,
}: RoomCanvasProps) {
  const ratio = PixelRatio.get();
  /** pt por px de arte. */
  const s = k / ratio;

  const width = artSize.w * s;
  const height = artSize.h * s;

  function press(event: GestureResponderEvent) {
    const p = touchToArt(event.nativeEvent.locationX, event.nativeEvent.locationY, k, ratio);
    onPressArt?.(p.ax, p.ay);
  }

  return (
    <Pressable
      onPress={onPressArt ? press : undefined}
      disabled={!onPressArt}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width, height, alignSelf: 'center' }}>
      <Canvas style={{ width, height, opacity: roomOpacity }}>
        {image ? <RoomAtlas image={image} drawList={drawList} manifest={manifest} s={s} /> : null}
        {outline
          ? [OUTLINE_LIGHT, OUTLINE_DARK].map((color, i) => (
              <Rect
                key={color}
                x={(outline.x - 1) * s}
                y={(outline.y - 1) * s}
                width={(outline.w + 2) * s}
                height={(outline.h + 2) * s}
                style="stroke"
                strokeWidth={Math.max(1, s)}
                color={color}>
                <DashPathEffect intervals={[3 * s, 3 * s]} phase={i * 3 * s} />
              </Rect>
            ))
          : null}
      </Canvas>
    </Pressable>
  );
}
