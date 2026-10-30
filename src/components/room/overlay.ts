import { DRAG_LIFT, DRAG_ORIGIN_ALPHA, STILL, withLeaving, type Anim, type Level, type Sample } from './anim';
import { buildDrawList, type DrawOptions } from './depth';
import { placeAnchor, type DragState, type DragUpdate } from './drag';
import { cellToArt, roomArtSize, rotateFootprint } from './iso';
import { specOf, validCellsFor } from './occupancy';
import type { DrawItem, Manifest, RoomLayout } from './types';

/**
 * Lo que se dibuja además del cuarto (tecnica.md §6.4–§6.5): casillas de la edición, sombras de
 * lo levantado y el fantasma de lo que se arrastra; y las animaciones de `anim.ts` aplicadas a la
 * lista de dibujo. Casillas y sombras van sobre las baldosas y alfombras y debajo de paredes y
 * objetos (`DrawOptions.under`); lo bloqueado y el fantasma, encima de todo. Nada de esto lleva
 * `uid`: no se toca. Las casillas usan muescas (`cell.valid`) y trama (`cell.blocked`), no solo color.
 */

export const CELL_VALID = 'cell.valid';
export const CELL_BLOCKED = 'cell.blocked';
export const CELL_TARGET = 'cell.target';
/** Sombra de un objeto levantado según su huella ya girada (`shadow.2x1`). */
export const shadowFrame = (w: number, d: number) => `shadow.${w}x${d}`;

type Origin = { ox: number; oy: number };

const has = (manifest: Pick<Manifest, 'frames'>, frame: string) => Object.prototype.hasOwnProperty.call(manifest.frames, frame);

/** `frame` con su ancla en la esquina trasera de la casilla `(x, y)` del piso, o `null` si no existe. */
function onFloor(manifest: Pick<Manifest, 'frames'>, o: Origin, frame: string, x: number, y: number): DrawItem | null {
  if (!has(manifest, frame)) return null;
  const p = cellToArt(x, y);
  const [axr, ayr] = manifest.frames[frame].anchor;
  return { frame, x: o.ox + p.ax - axr, y: o.oy + p.ay - ayr };
}

/** Casillas del piso donde podría ir `uid` (su esquina trasera, como al tocar la casilla), de atrás hacia adelante. */
function validCells(layout: RoomLayout, manifest: Manifest, uid: string): [number, number][] {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const p of validCellsFor(layout, manifest, uid)) {
    if (p.on !== 'floor' || seen.has(`${p.x},${p.y}`)) continue;
    seen.add(`${p.x},${p.y}`);
    out.push([p.x, p.y]);
  }
  return out.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0]);
}

/** `cell.valid` en cada destino del piso del objeto elegido (`validCellsFor`, sin su lugar actual). */
export function validCellsOverlay(layout: RoomLayout, manifest: Manifest, uid: string): DrawItem[] {
  const o = roomArtSize(manifest, layout.size);
  const out: DrawItem[] = [];
  for (const [x, y] of validCells(layout, manifest, uid)) {
    const cell = onFloor(manifest, o, CELL_VALID, x, y);
    if (cell) out.push(cell);
  }
  return out;
}

/** Sombras en el piso de los objetos de piso levantados en `sample`, donde cae su punto de apoyo. */
export function shadowOverlay(layout: RoomLayout, manifest: Manifest, sample: Sample): DrawItem[] {
  const o = roomArtSize(manifest, layout.size);
  const out: DrawItem[] = [];
  for (const it of layout.items) {
    const pose = Object.prototype.hasOwnProperty.call(sample.items, it.uid) ? sample.items[it.uid] : undefined;
    const p = it.place;
    if (!pose || pose.shadow <= 0 || p.on !== 'floor') continue;
    const spec = specOf(manifest, it.type);
    if (!spec || spec.modifies) continue;
    const [w, d] = rotateFootprint(spec.footprint, p.rot);
    const shadow = onFloor(manifest, o, shadowFrame(w, d), p.x, p.y);
    if (!shadow) continue;
    shadow.x += pose.dx;
    shadow.y += pose.dy;
    if (pose.shadow < 1) shadow.alpha = pose.shadow;
    out.push(shadow);
  }
  return out;
}

/** El objeto (con lo que lleva encima) dibujado en el lugar del fantasma, levantado `lift` px y sin `uid`. */
function ghostItems(layout: RoomLayout, manifest: Manifest, state: DragState, update: DragUpdate, lift: number, options: DrawOptions) {
  const keep = new Set([state.uid, ...state.riders]);
  const place = update.place ?? state.origin;
  const host = place.on === 'surface' ? place.host : null;
  const items = layout.items
    .filter((it) => keep.has(it.uid) || it.uid === host)
    .map((it) => (it.uid === state.uid ? { ...it, place } : it));
  if (!items.some((it) => it.uid === state.uid)) items.push({ ...state.item, place });
  // Sin lugar: se dibuja en su lugar de origen y se corre hasta el fantasma.
  const home = update.place ? null : placeAnchor(layout, manifest, state.origin);
  const dx = home ? update.ghost.ax - home.ax : 0;
  const dy = home ? update.ghost.ay - home.ay : 0;
  return buildDrawList({ ...layout, items }, manifest, { sky: options.sky, owned: options.owned, anim: options.anim })
    .filter((d) => d.uid !== undefined && keep.has(d.uid))
    .map((d): DrawItem => ({ frame: d.frame, x: d.x + dx, y: d.y + dy - lift }));
}

/**
 * Lo que dibuja un arrastre. `under`: los destinos válidos (`cell.valid`), la sombra en el destino
 * y `cell.target` en sus casillas si se puede. `over`, al final de la lista y encima de todo: si no
 * se puede, `cell.blocked` (lo que estorba suele tapar esa casilla; el motivo va además en texto), y
 * el fantasma, levantado según el nivel.
 */
export function dragOverlay(
  layout: RoomLayout,
  manifest: Manifest,
  state: DragState,
  update: DragUpdate,
  level: Level,
  options: DrawOptions,
): { under: DrawItem[]; over: DrawItem[] } {
  const o = roomArtSize(manifest, layout.size);
  const target = new Set(update.cells.map(([x, y]) => `${x},${y}`));
  const under: DrawItem[] = [];
  for (const [x, y] of validCells(layout, manifest, state.uid)) {
    if (target.has(`${x},${y}`)) continue;
    const cell = onFloor(manifest, o, CELL_VALID, x, y);
    if (cell) under.push(cell);
  }
  const item = layout.items.find((it) => it.uid === state.uid) ?? state.item;
  const spec = specOf(manifest, item.type);
  const p = update.place;
  if (p?.on === 'floor' && spec && update.reason !== 'outside') {
    const [w, d] = rotateFootprint(spec.footprint, p.rot);
    const shadow = onFloor(manifest, o, shadowFrame(w, d), p.x, p.y);
    if (shadow) under.push(shadow);
  }
  const marks: DrawItem[] = [];
  for (const [x, y] of update.cells) {
    const cell = onFloor(manifest, o, update.valid ? CELL_TARGET : CELL_BLOCKED, x, y);
    if (cell) marks.push(cell);
  }
  if (update.valid) under.push(...marks);
  const ghost = ghostItems(layout, manifest, state, update, DRAG_LIFT[level], options);
  return { under, over: update.valid ? ghost : [...marks, ...ghost] };
}

/**
 * Aplica una muestra de `sampleAnimations` a la lista de dibujo: corre cada objeto `(dx, dy − lift)`,
 * cambia su cuadro si la pose lo pide y multiplica su opacidad. `dragging`: lo que se arrastra (y lo
 * que lleva encima) queda medio transparente en su lugar. Lo totalmente transparente se quita (ni se
 * dibuja ni se toca). Piso, paredes y casillas no cambian. La opacidad del cuarto (`sample.room`) se
 * aplica al lienzo entero, no aquí: por sprite se verían las cosas a través de otras.
 */
export function applyAnimation(list: readonly DrawItem[], sample: Sample, dragging?: readonly string[]): DrawItem[] {
  const out: DrawItem[] = [];
  for (const d of list) {
    const pose = d.uid && Object.prototype.hasOwnProperty.call(sample.items, d.uid) ? sample.items[d.uid] : undefined;
    const faded = !!d.uid && !!dragging?.includes(d.uid);
    if (!pose && !faded) {
      out.push(d);
      continue;
    }
    const alpha = (d.alpha ?? 1) * (pose ? pose.alpha : 1) * (faded ? DRAG_ORIGIN_ALPHA : 1);
    if (alpha <= 0) continue;
    const next: DrawItem = {
      frame: pose?.frame ?? d.frame,
      x: d.x + (pose ? pose.dx : 0),
      y: d.y + (pose ? pose.dy - pose.lift : 0),
    };
    if (d.uid) next.uid = d.uid;
    if (alpha < 1) next.alpha = alpha;
    out.push(next);
  }
  return out;
}

/** Lo que pasa en el cuarto en un instante, además del layout. */
export type Scene = {
  level: Level;
  /** Animaciones activas, su muestra y el instante (para seguir dibujando lo que se guarda). */
  anims?: readonly Anim[];
  sample?: Sample;
  now?: number;
  /** En edición, el objeto elegido: sus destinos en el piso (`cell.valid`). Fuera de la edición, nada. */
  selected?: string | null;
  /** Un arrastre en curso (en lugar de `selected`). */
  drag?: { state: DragState; update: DragUpdate } | null;
};

/**
 * La lista de dibujo completa de un instante: lo que se guarda (mientras se desvanece), sombras y
 * casillas bajo los objetos, las animaciones aplicadas y el fantasma al final.
 */
export function sceneDrawList(layout: RoomLayout, manifest: Manifest, options: DrawOptions, scene: Scene): DrawItem[] {
  const drawn = scene.anims && scene.now !== undefined ? withLeaving(layout, scene.anims, scene.now) : layout;
  const sample = scene.sample ?? STILL;
  const under = [...(options.under ?? []), ...shadowOverlay(drawn, manifest, sample)];
  let over: DrawItem[] = [];
  let dragging: string[] | undefined;
  if (scene.drag) {
    const drag = dragOverlay(layout, manifest, scene.drag.state, scene.drag.update, scene.level, options);
    under.push(...drag.under);
    over = drag.over;
    dragging = [scene.drag.state.uid, ...scene.drag.state.riders];
  } else if (scene.selected) {
    under.push(...validCellsOverlay(layout, manifest, scene.selected));
  }
  const list = buildDrawList(drawn, manifest, { ...options, under });
  return [...applyAnimation(list, sample, dragging), ...over];
}
