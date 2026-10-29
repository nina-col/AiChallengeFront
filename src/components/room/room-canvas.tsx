import { Atlas, Canvas, DashPathEffect, FilterMode, MipmapMode, Rect, Skia, useImage } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { PixelRatio, Pressable, type GestureResponderEvent } from 'react-native';

import type { DrawItem, Manifest } from '@/components/room/types';

/** Pixeles nítidos: sin suavizado al escalar (Skia suaviza por defecto). */
const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;

type RoomCanvasProps = {
  /** Lo que se dibuja, ya ordenado (`buildDrawList`). */
  drawList: DrawItem[];
  manifest: Manifest;
  /** `require('@/assets/room/atlas.png')`. */
  atlas: number;
  /** Tamaño del lienzo en px de arte. */
  artSize: { w: number; h: number };
  /** px de dispositivo por px de arte (entero, `pickScale`): así cada pixel de arte cae en pixeles enteros. */
  k: number;
  /** Toque en px de arte (para elegir objeto o casilla). */
  onPressArt?: (ax: number, ay: number) => void;
  /** Contorno punteado del objeto elegido, en px de arte: forma y no solo color. */
  outline?: { x: number; y: number; w: number; h: number; color: string };
  accessibilityLabel: string;
};

/**
 * El cuarto en Skia: un solo `Atlas` (una llamada de dibujo) a escala entera y con muestreo de
 * vecino más cercano. No anima por su cuenta: cuando cambia la lista (un cuadro de reposo, un
 * objeto movido), se vuelve a dibujar.
 */
export function RoomCanvas({
  drawList,
  manifest,
  atlas,
  artSize,
  k,
  onPressArt,
  outline,
  accessibilityLabel,
}: RoomCanvasProps) {
  const image = useImage(atlas);
  const ratio = PixelRatio.get();
  /** pt por px de arte. */
  const s = k / ratio;

  const { sprites, transforms } = useMemo(() => {
    const sprites = [];
    const transforms = [];
    for (const item of drawList) {
      const frame = manifest.frames[item.frame];
      if (!frame) continue;
      const [fx, fy, fw, fh] = frame.rect;
      sprites.push(Skia.XYWHRect(fx, fy, fw, fh));
      transforms.push(Skia.RSXform(s, 0, item.x * s, item.y * s));
    }
    return { sprites, transforms };
  }, [drawList, manifest, s]);

  const width = artSize.w * s;
  const height = artSize.h * s;

  function press(event: GestureResponderEvent) {
    onPressArt?.(event.nativeEvent.locationX / s, event.nativeEvent.locationY / s);
  }

  return (
    <Pressable
      onPress={onPressArt ? press : undefined}
      disabled={!onPressArt}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width, height, alignSelf: 'center' }}>
      <Canvas style={{ width, height }}>
        {image ? <Atlas image={image} sprites={sprites} transforms={transforms} sampling={NEAREST} /> : null}
        {outline ? (
          <Rect
            x={(outline.x - 1) * s}
            y={(outline.y - 1) * s}
            width={(outline.w + 2) * s}
            height={(outline.h + 2) * s}
            style="stroke"
            strokeWidth={Math.max(1, s)}
            color={outline.color}>
            <DashPathEffect intervals={[3 * s, 2 * s]} />
          </Rect>
        ) : null}
      </Canvas>
    </Pressable>
  );
}
