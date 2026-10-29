import type { Facing, Manifest, TypeSpec, Wall } from './types';

/**
 * Matemática isométrica del cuarto (tecnica.md §6.1–§6.2). Todo en pixeles de arte (1×).
 * "Arte del piso" = relativo a la esquina trasera del piso; "lienzo" = relativo a la esquina
 * superior izquierda del lienzo (`roomArtSize` da el desfase entre ambos).
 * Las funciones pequeñas son *worklets*: corren igual en Jest, en JS y en el hilo de UI.
 */

/** Baldosa 2:1 en px de arte. El `tile` del manifiesto debe ser `[32, 16]`. */
export const TILE_W = 32;
export const TILE_H = 16;
/** Alto de una fila de pared en px de arte: los objetos de pared ocupan filas enteras. */
export const WALL_ROW = 16;
/** Margen del lienzo por lado (contornos de 1 px y grosor de la pared): 5 × 5 mide 164 × 132. */
export const ROOM_PAD = 2;
/** Alto de pared si el catálogo no lo trae (`RoomCatalog` no tiene `wallHeight`). */
export const DEFAULT_WALL_HEIGHT = 48;

/** Esquina trasera de la celda `(x, y)` a altura `z` (px) → px de arte del piso. */
export function cellToArt(x: number, y: number, z = 0) {
  'worklet';
  return { ax: (x - y) * (TILE_W / 2), ay: (x + y) * (TILE_H / 2) - z };
}

/**
 * Px de arte del piso → celda entera, o `null` si cae fuera. Los bordes van siempre a la celda de
 * índice mayor (se redondea hacia abajo), así un punto nunca cae en dos celdas.
 */
export function artToCell(ax: number, ay: number, w: number, d: number) {
  'worklet';
  const fx = (ax / (TILE_W / 2) + ay / (TILE_H / 2)) / 2;
  const fy = (ay / (TILE_H / 2) - ax / (TILE_W / 2)) / 2;
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  return x >= 0 && y >= 0 && x < w && y < d ? { x, y } : null;
}

/** Toque en pt (relativo al lienzo) → px de arte del lienzo. `k` = px de dispositivo por px de arte. */
export function touchToArt(px: number, py: number, k: number, pixelRatio: number) {
  'worklet';
  return { ax: (px * pixelRatio) / k, ay: (py * pixelRatio) / k };
}

/** Escala entera: px de dispositivo por px de arte que caben en `availablePt` (§5.3). Nunca menos de 1. */
export function pickScale(availablePt: number, artW: number, pixelRatio: number) {
  return Math.max(1, Math.floor((availablePt * pixelRatio) / artW));
}

/** Alto de pared en px de arte (48 por defecto). */
export const wallHeightOf = (catalog: { wallHeight?: number }) => catalog.wallHeight ?? DEFAULT_WALL_HEIGHT;

/** Filas de 16 px que tiene cada pared. */
export const wallRows = (catalog: { wallHeight?: number }) => Math.floor(wallHeightOf(catalog) / WALL_ROW);

/** Largo en celdas de una pared: la izquierda (`x = 0`) corre a lo largo de `y`, la derecha a lo largo de `x`. */
export function wallLength(size: { w: number; d: number }, wall: Wall) {
  'worklet';
  return wall === 'left' ? size.d : size.w;
}

/**
 * Lienzo de la sala: el rombo del piso más las paredes de `wallHeight` sobre los bordes traseros,
 * con `ROOM_PAD` de margen: `w × h` px de arte (lo que recibe `RoomCanvas` como `artSize`).
 * `(ox, oy)` es dónde cae la esquina trasera del piso dentro del lienzo.
 */
export function roomArtSize(manifest: Pick<Manifest, 'wallHeight'>, size: { w: number; d: number }) {
  const wallH = manifest.wallHeight;
  return {
    w: (size.w + size.d) * (TILE_W / 2) + 2 * ROOM_PAD,
    h: (size.w + size.d) * (TILE_H / 2) + wallH + 2 * ROOM_PAD,
    ox: size.d * (TILE_W / 2) + ROOM_PAD,
    oy: wallH + ROOM_PAD,
  };
}

/** Punto de apoyo de un tramo de pared: su esquina inferior trasera (la de `u` menor) a altura `z`. */
export function wallToArt(wall: Wall, u: number, z = 0) {
  'worklet';
  return wall === 'left' ? cellToArt(0, u, z) : cellToArt(u, 0, z);
}

/** Huella `[ancho en x, fondo en y]` con el giro `rot`. */
export function rotateFootprint(fp: readonly [number, number], rot: number): [number, number] {
  'worklet';
  return rot % 2 ? [fp[1], fp[0]] : [fp[0], fp[1]];
}

/**
 * Celda relativa de la huella con `rot` 0 → celda relativa con giro `rot`. Un cuarto de vuelta es
 * `(x, y) → (d − 1 − y, x)`, el mismo giro que usa el generador de sprites (§5.1).
 */
export function rotateCell(cx: number, cy: number, fp: readonly [number, number], rot: number): [number, number] {
  'worklet';
  let x = cx;
  let y = cy;
  let d = fp[1];
  let w = fp[0];
  for (let i = 0; i < rot % 4; i++) {
    const nx = d - 1 - y;
    y = x;
    x = nx;
    const t = w;
    w = d;
    d = t;
  }
  return [x, y];
}

/** Celdas absolutas que cubre un objeto de piso con su esquina trasera en `(x, y)`. */
export function footprintCells(spec: Pick<TypeSpec, 'footprint'>, rot: Facing, x = 0, y = 0): [number, number][] {
  const [w, d] = rotateFootprint(spec.footprint, rot);
  const cells: [number, number][] = [];
  for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) cells.push([x + i, y + j]);
  return cells;
}
