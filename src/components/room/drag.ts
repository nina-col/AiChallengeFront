import { planMove, type Anim, type Level } from './anim';
import { cellToArt, footprintCells, roomArtSize, TILE_H, TILE_W, WALL_ROW, wallLength, wallRows, wallToArt } from './iso';
import { canPlace, samePlace, slotCells, specOf, type Reason } from './occupancy';
import type { ItemPlace, Manifest, RoomItem, RoomLayout, TypeSpec, Wall } from './types';

/**
 * Arrastrar para mover (tecnica.md §4, §6.2 y §9). Es un atajo más: todo se puede hacer con las
 * flechas o tocando la casilla destino (WCAG 2.5.7), y con el lector de pantalla se apaga.
 *
 * Todo va en px de arte del lienzo (la vista convierte el dedo con `touchToArt`). El fantasma salta
 * de lugar en lugar, en enteros y sin inercia: en el piso, la casilla bajo el dedo menos el desfase
 * del agarre; en la pared, la celda y la fila más cercanas en la pared bajo el dedo; encima de algo,
 * el slot más cercano de cualquier anfitrión. La validez es la de `canPlace`, las mismas reglas que
 * las flechas y la API. Corre en el hilo de JS (el gesto con `runOnJS`); el layout no cambia
 * mientras se arrastra.
 */

/** Un punto en px de arte del lienzo. */
export type ArtPoint = { ax: number; ay: number };

/** A un objeto que también va en el piso, un slot lo atrapa si su punto de apoyo queda a esto o menos. */
export const SLOT_SNAP_PX = 10;
/** Lo que solo va encima de algo busca el slot más cercano hasta esta distancia; más lejos, no cae en ninguno. */
export const SLOT_REACH_PX = 40;

export type DragState = {
  uid: string;
  /** El objeto como estaba al empezar. */
  item: RoomItem;
  /** Su lugar: si se suelta donde no se puede, vuelve aquí. */
  origin: ItemPlace;
  /** Lo que lleva encima (si es un anfitrión): va con él en el fantasma. */
  riders: string[];
  /** Casilla bajo el dedo menos la casilla del objeto, al empezar (tecnica.md §6.2). */
  grab: { x: number; y: number };
  /** Lo mismo en su pared: `(u, fila)` bajo el dedo menos los del objeto. */
  grabWall: { u: number; row: number };
  /** Dedo menos punto de apoyo del objeto, en px de arte (para el slot más cercano). */
  grabArt: ArtPoint;
};

export type DragUpdate = {
  /** Dónde caería, o `null` si no hay ningún lugar posible (lo que solo va encima, lejos de todo slot). */
  place: ItemPlace | null;
  valid: boolean;
  /** Por qué no se puede, para decirlo en texto (`t.room.reasons`). */
  reason?: Reason;
  /** Punto de apoyo del fantasma en px de arte del lienzo, entero: salta de lugar en lugar. */
  ghost: ArtPoint;
  /** Casillas del piso que ocuparía, dentro del cuarto (`cell.target` o `cell.blocked`); vacío fuera del piso. */
  cells: [number, number][];
};

export type DragEnd =
  /** Soltado en un lugar válido y distinto: `onDrop(uid, place)`; al cambiar el layout, `dropped: uid`. */
  | { ok: true; uid: string; place: ItemPlace }
  /** Vuelve a su lugar (`back`: con detalles, el salto desde el fantasma) y se dice el motivo, si hay. */
  | { ok: false; uid: string; reason: Reason | null; back: Anim[] };

/** Casilla del piso (sin límites) bajo un punto en px de arte del piso. */
function floorCell(fx: number, fy: number) {
  'worklet';
  return {
    x: Math.floor((fx / (TILE_W / 2) + fy / (TILE_H / 2)) / 2),
    y: Math.floor((fy / (TILE_H / 2) - fx / (TILE_W / 2)) / 2),
  };
}

/**
 * Celda `(u, fila)` de una pared bajo un punto en px de arte del piso, sin límites. Sobre la pared
 * derecha (`y = 0`) un punto es `(16u, 8u − z)`; sobre la izquierda (`x = 0`), `(−16u, 8u − z)`.
 */
function wallCell(wall: Wall, fx: number, fy: number) {
  'worklet';
  const along = wall === 'left' ? -fx : fx;
  return { u: Math.floor(along / (TILE_W / 2)), row: Math.floor((along / 2 - fy) / WALL_ROW) };
}

/** El punto de la rejilla del piso más cercano (para el fantasma sin lugar). */
function nearestCorner(p: ArtPoint) {
  const x = Math.round((p.ax / (TILE_W / 2) + p.ay / (TILE_H / 2)) / 2);
  const y = Math.round((p.ay / (TILE_H / 2) - p.ax / (TILE_W / 2)) / 2);
  return cellToArt(x, y);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Punto de apoyo de un lugar en px de arte del piso (el mismo que usa `buildDrawList`), o `null`. */
function floorAnchor(layout: RoomLayout, manifest: Manifest, place: ItemPlace): ArtPoint | null {
  if (place.on === 'floor') return cellToArt(place.x, place.y);
  if (place.on === 'wall') return wallToArt(place.wall, place.u, place.row * WALL_ROW);
  const host = layout.items.find((it) => it.uid === place.host);
  const spec = host ? specOf(manifest, host.type) : undefined;
  const cell = host && spec?.surface ? slotCells(host, spec)[place.slot] : undefined;
  return cell && spec?.surface ? cellToArt(cell[0], cell[1], spec.surface.z) : null;
}

/** Punto de apoyo de un lugar en px de arte del lienzo, o `null` si su anfitrión no está. */
export function placeAnchor(layout: RoomLayout, manifest: Manifest, place: ItemPlace): ArtPoint | null {
  const p = floorAnchor(layout, manifest, place);
  if (!p) return null;
  const { ox, oy } = roomArtSize(manifest, layout.size);
  return { ax: p.ax + ox, ay: p.ay + oy };
}

/** Casilla del piso bajo un objeto: la suya, la de su slot o la que toca su pared. */
function cellOf(layout: RoomLayout, manifest: Manifest, place: ItemPlace) {
  if (place.on === 'floor') return { x: place.x, y: place.y };
  if (place.on === 'wall') return place.wall === 'left' ? { x: 0, y: place.u } : { x: place.u, y: 0 };
  const host = layout.items.find((it) => it.uid === place.host);
  const spec = host ? specOf(manifest, host.type) : undefined;
  const cell = host && spec ? slotCells(host, spec)[place.slot] : undefined;
  return cell ? { x: cell[0], y: cell[1] } : null;
}

/**
 * Empieza a arrastrar `uid` desde el punto `touch` (px de arte del lienzo). Guarda el desfase del
 * agarre para que el objeto no salte al dedo. `null` si no está o no se coloca a mano.
 */
export function beginDrag(layout: RoomLayout, manifest: Manifest, uid: string, touch: ArtPoint): DragState | null {
  const item = layout.items.find((it) => it.uid === uid);
  const spec = item ? specOf(manifest, item.type) : undefined;
  if (!item || !spec || spec.modifies || !spec.place.length) return null;
  const anchor = floorAnchor(layout, manifest, item.place);
  const cell = cellOf(layout, manifest, item.place);
  if (!anchor || !cell) return null;
  const { ox, oy } = roomArtSize(manifest, layout.size);
  const fx = touch.ax - ox;
  const fy = touch.ay - oy;
  const under = floorCell(fx, fy);
  const p = item.place;
  const onWall = p.on === 'wall' ? wallCell(p.wall, fx, fy) : null;
  return {
    uid,
    item,
    origin: p,
    riders: layout.items.filter((it) => it.place.on === 'surface' && it.place.host === uid).map((it) => it.uid),
    grab: { x: under.x - cell.x, y: under.y - cell.y },
    grabWall: onWall && p.on === 'wall' ? { u: onWall.u - p.u, row: onWall.row - p.row } : { u: 0, row: 0 },
    grabArt: { ax: fx - anchor.ax, ay: fy - anchor.ay },
  };
}

type Target = { place: ItemPlace | null; at: ArtPoint; reason?: Reason };

/** El slot más cercano a `want` (punto de apoyo deseado, px de arte del piso) a `reach` o menos. */
function nearestSlot(layout: RoomLayout, manifest: Manifest, uid: string, want: ArtPoint, reach: number): Target | null {
  let best: Target | null = null;
  let bestD = reach * reach;
  for (const host of layout.items) {
    if (host.uid === uid || host.place.on !== 'floor') continue;
    const spec = specOf(manifest, host.type);
    if (!spec?.surface || spec.modifies) continue;
    const cells = slotCells(host, spec);
    for (let slot = 0; slot < cells.length; slot++) {
      const at = cellToArt(cells[slot][0], cells[slot][1], spec.surface.z);
      const dist = (at.ax - want.ax) ** 2 + (at.ay - want.ay) ** 2;
      if (dist < bestD || (dist === bestD && !best)) {
        best = { place: { on: 'surface', host: host.uid, slot }, at };
        bestD = dist;
      }
    }
  }
  return best;
}

/** Dónde caería con el dedo en `(fx, fy)` (px de arte del piso). */
function candidate(state: DragState, layout: RoomLayout, manifest: Manifest, item: RoomItem, spec: TypeSpec, fx: number, fy: number): Target {
  const kinds = spec.place;
  const want = { ax: fx - state.grabArt.ax, ay: fy - state.grabArt.ay };
  const under = floorCell(fx, fy);
  // Mientras el dedo siga en su casilla, lo que está en el piso se queda: un slot cercano (justo
  // detrás de un escritorio cae a 2 px) no lo atrapa ni dice "ocupado" sin que se haya movido.
  const o = state.origin;
  const home = o.on === 'floor' && under.x - state.grab.x === o.x && under.y - state.grab.y === o.y;
  if (kinds.includes('surface') && !home) {
    const slot = nearestSlot(layout, manifest, state.uid, want, kinds.length > 1 ? SLOT_SNAP_PX : SLOT_REACH_PX);
    if (slot) return slot;
  }
  const overFloor = under.x >= 0 && under.y >= 0 && under.x < layout.size.w && under.y < layout.size.d;
  if (kinds.includes('floor') && (overFloor || !kinds.includes('wall'))) {
    const x = under.x - state.grab.x;
    const y = under.y - state.grab.y;
    const p = item.place;
    const rot = p.on === 'floor' && spec.facings.includes(p.rot) ? p.rot : (spec.facings[0] ?? 0);
    return { place: { on: 'floor', x, y, rot }, at: cellToArt(x, y) };
  }
  if (kinds.includes('wall')) {
    // Sigue en su pared hasta que el dedo lo lleve más allá de la esquina (tomado junto a ella, no
    // salta a la otra); si no, la pared bajo el dedo (la izquierda a la izquierda de la esquina). En
    // ella, lo más cercano.
    const stays = o.on === 'wall' && wallCell(o.wall, fx, fy).u >= state.grabWall.u;
    const wall: Wall = stays ? o.wall : fx < 0 ? 'left' : 'right';
    const len = wallLength(layout.size, wall);
    const rows = wallRows(manifest);
    const [span, tall] = spec.footprint;
    if (span > len || tall > rows) return { place: null, at: nearestCorner(want), reason: 'outside' };
    const at = wallCell(wall, fx, fy);
    const u = clamp(at.u - state.grabWall.u, 0, len - span);
    const row = clamp(at.row - state.grabWall.row, 0, rows - tall);
    return { place: { on: 'wall', wall, u, row }, at: wallToArt(wall, u, row * WALL_ROW) };
  }
  // Solo va encima de algo y no hay un slot cerca: el fantasma sigue al dedo de casilla en casilla.
  return { place: null, at: nearestCorner(want), reason: 'no-slot' };
}

/**
 * El dedo se movió a `touch`. Si el lugar y el fantasma no cambian, devuelve `prev` tal cual (la
 * vista solo vuelve a dibujar cuando cambia de lugar). La validez sale de `canPlace`.
 */
export function dragUpdate(
  state: DragState,
  layout: RoomLayout,
  manifest: Manifest,
  touch: ArtPoint,
  prev?: DragUpdate | null,
): DragUpdate {
  const item = layout.items.find((it) => it.uid === state.uid) ?? state.item;
  const spec = specOf(manifest, item.type);
  const { ox, oy } = roomArtSize(manifest, layout.size);
  const fx = touch.ax - ox;
  const fy = touch.ay - oy;
  const target: Target = spec
    ? candidate(state, layout, manifest, item, spec, fx, fy)
    : { place: null, at: nearestCorner({ ax: fx, ay: fy }), reason: 'not-placeable' };
  const ghost = { ax: target.at.ax + ox, ay: target.at.ay + oy };
  if (prev && prev.ghost.ax === ghost.ax && prev.ghost.ay === ghost.ay) {
    if (prev.place === target.place || (prev.place && target.place && samePlace(prev.place, target.place))) return prev;
  }
  if (!target.place || !spec) return { place: null, valid: false, reason: target.reason ?? 'not-placeable', ghost, cells: [] };
  const check = canPlace(layout, manifest, item, target.place);
  const p = target.place;
  const cells =
    p.on === 'floor'
      ? footprintCells(spec, p.rot, p.x, p.y).filter(([x, y]) => x >= 0 && y >= 0 && x < layout.size.w && y < layout.size.d)
      : [];
  return check.ok ? { place: p, valid: true, ghost, cells } : { place: p, valid: false, reason: check.reason, ghost, cells };
}

/**
 * Se soltó. En un lugar válido y distinto del suyo: `ok`. Si no, vuelve a su lugar: con detalles,
 * el mismo salto que al moverlo, desde donde se veía el fantasma (si es su mismo lugar, solo baja);
 * en los otros niveles, al instante. El motivo (si lo hay) se dice en texto.
 */
export function dragEnd(
  state: DragState,
  update: DragUpdate | null,
  layout: RoomLayout,
  manifest: Manifest,
  level: Level,
  now: number,
): DragEnd {
  if (update?.valid && update.place && !samePlace(update.place, state.origin)) {
    return { ok: true, uid: state.uid, place: update.place };
  }
  const home = placeAnchor(layout, manifest, state.origin);
  const same = !update || (!!update.place && samePlace(update.place, state.origin));
  const from = update && home ? { dx: update.ghost.ax - home.ax, dy: update.ghost.ay - home.ay } : { dx: 0, dy: 0 };
  const grid = state.origin.on === 'floor' && (!update?.place || update.place.on === 'floor');
  const back =
    level === 'detailed'
      ? [state.uid, ...state.riders].flatMap((uid) => planMove(uid, from, level, now, { grid, dropped: same }))
      : [];
  return { ok: false, uid: state.uid, reason: same ? null : (update?.reason ?? null), back };
}
