import { rotateCell, rotateFootprint, wallRows } from './iso';
import type { Facing, ItemPlace, Manifest, RoomItem, RoomLayout, TypeSpec, Wall } from './types';

/**
 * Colisiones de piso, alfombras, paredes y superficies (tecnica.md §6.2–§6.3) y los movimientos
 * del editor sin arrastre (§9: botones de dirección, girar, tocar el objeto y luego el destino).
 * Todo es inmutable: cada cambio devuelve un layout nuevo. La app nunca reacomoda lo que la persona
 * puso: si algo no cabe, se dice por qué y no se mueve nada más.
 */

/** Lo que hace falta del catálogo: tipos y alto de pared (`RoomCatalog` todavía no trae `wallHeight`; vale 48). */
export type Catalog = Pick<Manifest, 'types'> & { wallHeight?: number };

/** Por qué no cabe algo, para decirlo en texto ("Ese lugar está ocupado"). */
export type Reason = 'outside' | 'occupied' | 'facing' | 'no-slot' | 'window' | 'not-placeable';
export type Check = { ok: true } | { ok: false; reason: Reason };
export type Change = { ok: true; layout: RoomLayout } | { ok: false; reason: Reason };
/** Las cuatro direcciones iso más subir y bajar (solo para objetos de pared). */
export type Dir = '+x' | '-x' | '+y' | '-y' | 'up' | 'down';

export const EMPTY = -1;
export const WINDOW = -2;

/**
 * Rejillas con el índice en `layout.items` de quien ocupa cada celda, o `EMPTY`.
 * Piso y alfombras: celda `y * w + x`. Paredes: `row * largo + u`, con la ventana como `WINDOW`.
 */
export type Occupancy = {
  w: number;
  d: number;
  rows: number;
  floor: number[];
  flat: number[];
  left: number[];
  right: number[];
  /** `${host}#${slot}` → índice del objeto que está encima. */
  slots: Record<string, number>;
  /** uid → índice de los anfitriones colocados en el piso (solo ellos aceptan objetos encima). */
  hosts: Record<string, number>;
};

/** Resultado de colocar todo: la ocupación y, por objeto, su problema (`null` = cabe, `undefined` = se omite). */
export type Settled = { occ: Occupancy; reasons: (Reason | null | undefined)[] };

const DELTA: Record<Dir, [number, number, number]> = {
  '+x': [1, 0, 0],
  '-x': [-1, 0, 0],
  '+y': [0, 1, 0],
  '-y': [0, -1, 0],
  up: [0, 0, 1],
  down: [0, 0, -1],
};

/** Tipo del catálogo sin caer en propiedades de `Object.prototype` (el layout puede venir de fuera). */
export function specOf(catalog: Pick<Manifest, 'types'>, type: string): TypeSpec | undefined {
  'worklet';
  return Object.prototype.hasOwnProperty.call(catalog.types, type) ? catalog.types[type] : undefined;
}

function isInt(n: unknown): n is number {
  'worklet';
  return typeof n === 'number' && Number.isInteger(n);
}

/** Celdas del mundo de cada *slot* de un anfitrión en el piso (los *slots* giran con él). */
export function slotCells(host: RoomItem, spec: TypeSpec): [number, number][] {
  'worklet';
  const p = host.place;
  if (p.on !== 'floor' || !spec.surface) return [];
  return spec.surface.slots.map(([sx, sy]) => {
    const [cx, cy] = rotateCell(sx, sy, spec.footprint, p.rot);
    return [p.x + cx, p.y + cy] as [number, number];
  });
}

function emptyOccupancy(layout: RoomLayout, catalog: Catalog): Occupancy {
  const { w, d } = layout.size;
  const rows = wallRows(catalog);
  const occ: Occupancy = {
    w,
    d,
    rows,
    floor: new Array(w * d).fill(EMPTY),
    flat: new Array(w * d).fill(EMPTY),
    left: new Array(d * rows).fill(EMPTY),
    right: new Array(w * rows).fill(EMPTY),
    slots: Object.create(null),
    hosts: Object.create(null),
  };
  const win = layout.shell.window;
  const len = win.wall === 'left' ? d : w;
  if (isInt(win.u) && win.u >= 0 && win.u < len) {
    for (let r = 0; r < rows; r++) occ[win.wall][r * len + win.u] = WINDOW;
  }
  return occ;
}

/**
 * Problema de poner `item` en `place`, o `null` si cabe. `self` es su índice en `items` (−1 si es
 * nuevo): sus propias celdas cuentan como libres, así moverlo un paso no choca consigo mismo.
 */
export function checkPlace(
  occ: Occupancy,
  items: readonly RoomItem[],
  catalog: Catalog,
  item: RoomItem,
  place: ItemPlace,
  self: number,
): Reason | null {
  'worklet';
  const spec = specOf(catalog, item.type);
  if (!spec || spec.modifies || !spec.place.includes(place.on)) return 'not-placeable';
  if (place.on === 'floor') {
    if (!spec.facings.includes(place.rot)) return 'facing';
    const [fw, fd] = rotateFootprint(spec.footprint, place.rot);
    if (!isInt(place.x) || !isInt(place.y) || place.x < 0 || place.y < 0) return 'outside';
    if (place.x + fw > occ.w || place.y + fd > occ.d) return 'outside';
    const grid = spec.flat ? occ.flat : occ.floor;
    for (let j = 0; j < fd; j++) {
      for (let i = 0; i < fw; i++) {
        const v = grid[(place.y + j) * occ.w + place.x + i];
        if (v !== EMPTY && v !== self) return 'occupied';
      }
    }
    return null;
  }
  if (place.on === 'wall') {
    if (place.wall !== 'left' && place.wall !== 'right') return 'outside';
    const len = place.wall === 'left' ? occ.d : occ.w;
    const [span, tall] = spec.footprint;
    if (!isInt(place.u) || !isInt(place.row) || place.u < 0 || place.row < 0) return 'outside';
    if (place.u + span > len || place.row + tall > occ.rows) return 'outside';
    const grid = occ[place.wall];
    let taken = false;
    for (let r = 0; r < tall; r++) {
      for (let i = 0; i < span; i++) {
        const v = grid[(place.row + r) * len + place.u + i];
        if (v === WINDOW) return 'window';
        if (v !== EMPTY && v !== self) taken = true;
      }
    }
    return taken ? 'occupied' : null;
  }
  // Superficie: un anfitrión colocado, un slot que exista y que nadie más use. No se apila.
  const host = Object.prototype.hasOwnProperty.call(occ.hosts, place.host) ? occ.hosts[place.host] : -1;
  if (host < 0 || host === self) return 'no-slot';
  const hostSpec = specOf(catalog, items[host].type);
  const slots = hostSpec?.surface?.slots ?? [];
  if (!isInt(place.slot) || place.slot < 0 || place.slot >= slots.length) return 'no-slot';
  const key = `${place.host}#${place.slot}`;
  const v = Object.prototype.hasOwnProperty.call(occ.slots, key) ? occ.slots[key] : EMPTY;
  return v !== EMPTY && v !== self ? 'occupied' : null;
}

function occupy(occ: Occupancy, items: readonly RoomItem[], catalog: Catalog, index: number) {
  const item = items[index];
  const spec = specOf(catalog, item.type);
  if (!spec) return;
  const p = item.place;
  if (p.on === 'floor') {
    const [fw, fd] = rotateFootprint(spec.footprint, p.rot);
    const grid = spec.flat ? occ.flat : occ.floor;
    for (let j = 0; j < fd; j++) for (let i = 0; i < fw; i++) grid[(p.y + j) * occ.w + p.x + i] = index;
    if (spec.surface && !Object.prototype.hasOwnProperty.call(occ.hosts, item.uid)) occ.hosts[item.uid] = index;
  } else if (p.on === 'wall') {
    const len = p.wall === 'left' ? occ.d : occ.w;
    const [span, tall] = spec.footprint;
    for (let r = 0; r < tall; r++) for (let i = 0; i < span; i++) occ[p.wall][(p.row + r) * len + p.u + i] = index;
  } else {
    occ.slots[`${p.host}#${p.slot}`] = index;
  }
}

/**
 * Coloca los objetos en orden (primero piso y pared, luego superficies, para que el anfitrión
 * pueda ir después en la lista) y anota el problema de cada uno. Lo que no cabe no ocupa nada.
 * Se omiten (sin problema) los tipos desconocidos y lo que está encima de un anfitrión desconocido:
 * se conservan en el JSON y no se dibujan.
 */
export function settle(layout: RoomLayout, catalog: Catalog): Settled {
  const occ = emptyOccupancy(layout, catalog);
  const items = layout.items;
  const reasons: (Reason | null | undefined)[] = new Array(items.length).fill(undefined);
  const known = (i: number) => specOf(catalog, items[i].type) !== undefined;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < items.length; i++) {
      const p = items[i].place;
      if ((p.on === 'surface') !== (pass === 1) || !known(i)) continue;
      if (p.on === 'surface') {
        const host = items.find((it) => it.uid === p.host);
        if (host && !specOf(catalog, host.type)) continue;
      }
      const reason = checkPlace(occ, items, catalog, items[i], p, i);
      reasons[i] = reason;
      if (!reason) occupy(occ, items, catalog, i);
    }
  }
  return { occ, reasons };
}

/** Ocupación del layout (lo que cabe, en orden). */
export const buildOccupancy = (layout: RoomLayout, catalog: Catalog) => settle(layout, catalog).occ;

const indexOf = (layout: RoomLayout, uid: string) => layout.items.findIndex((it) => it.uid === uid);

const childrenOf = (layout: RoomLayout, uid: string) =>
  layout.items.filter((it) => it.place.on === 'surface' && it.place.host === uid);

function withPlace(layout: RoomLayout, index: number, place: ItemPlace): RoomLayout {
  return { ...layout, items: layout.items.map((it, i) => (i === index ? { ...it, place } : it)) };
}

/** ¿Cabe `item` (nuevo o ya en el cuarto, se reconoce por `uid`) en `place`? */
export function canPlace(layout: RoomLayout, catalog: Catalog, item: RoomItem, place: ItemPlace): Check {
  const reason = placeProblem(layout, catalog, settle(layout, catalog).occ, item, place);
  return reason ? { ok: false, reason } : { ok: true };
}

function placeProblem(layout: RoomLayout, catalog: Catalog, occ: Occupancy, item: RoomItem, place: ItemPlace) {
  const self = indexOf(layout, item.uid);
  // Un anfitrión con cosas encima solo va en el piso: no se apilan superficies.
  if (place.on !== 'floor' && self >= 0 && childrenOf(layout, item.uid).length) return 'not-placeable';
  return checkPlace(occ, layout.items, catalog, item, place, self);
}

/** Pone el objeto en `place` (sus objetos de encima lo acompañan solos: van por `host`). */
export function moveTo(layout: RoomLayout, catalog: Catalog, uid: string, place: ItemPlace): Change {
  const index = indexOf(layout, uid);
  if (index < 0) return { ok: false, reason: 'not-placeable' };
  const reason = placeProblem(layout, catalog, settle(layout, catalog).occ, layout.items[index], place);
  return reason ? { ok: false, reason } : { ok: true, layout: withPlace(layout, index, place) };
}

/** Agrega un objeto del inventario en `place` (el editor: tocar el objeto y luego la casilla). */
export function addItem(layout: RoomLayout, catalog: Catalog, item: RoomItem): Change {
  if (indexOf(layout, item.uid) >= 0) return { ok: false, reason: 'not-placeable' };
  const reason = checkPlace(settle(layout, catalog).occ, layout.items, catalog, item, item.place, -1);
  return reason ? { ok: false, reason } : { ok: true, layout: { ...layout, items: [...layout.items, item] } };
}

/** Anfitrión y slot que caen en la celda `(x, y)`, o `null`. */
function slotAt(layout: RoomLayout, catalog: Catalog, occ: Occupancy, x: number, y: number) {
  const hosts = Object.keys(occ.hosts)
    .map((uid) => occ.hosts[uid])
    .sort((a, b) => a - b);
  for (const h of hosts) {
    const host = layout.items[h];
    const cells = slotCells(host, specOf(catalog, host.type)!);
    const slot = cells.findIndex(([cx, cy]) => cx === x && cy === y);
    if (slot >= 0) return { on: 'surface', host: host.uid, slot } as const;
  }
  return null;
}

/**
 * Un paso en `dir`. Si el lugar de al lado está ocupado, se salta hasta el siguiente libre en esa
 * dirección, para que los botones (y VoiceOver) nunca dejen un objeto atrapado detrás de otro.
 * Piso: `±x`, `±y`. Pared: a lo largo de la pared (`±x` en la derecha, `±y` en la izquierda) y
 * `up`/`down` entre filas. Superficie: al slot de la celda vecina (del mismo u otro anfitrión).
 */
export function move(layout: RoomLayout, catalog: Catalog, uid: string, dir: Dir): Change {
  const index = indexOf(layout, uid);
  if (index < 0) return { ok: false, reason: 'not-placeable' };
  const item = layout.items[index];
  const occ = settle(layout, catalog).occ;
  const [dx, dy, dz] = DELTA[dir];
  const p = item.place;
  let first: Reason | null = null;
  for (let k = 1; k <= Math.max(occ.w, occ.d, occ.rows); k++) {
    let next: ItemPlace | null;
    if (p.on === 'floor') {
      if (dz) return { ok: false, reason: 'outside' };
      next = { ...p, x: p.x + k * dx, y: p.y + k * dy };
    } else if (p.on === 'wall') {
      const along = p.wall === 'right' ? dx : dy;
      const across = p.wall === 'right' ? dy : dx;
      if (across) return { ok: false, reason: 'outside' };
      next = dz ? { ...p, row: p.row + k * dz } : { ...p, u: p.u + k * along };
    } else {
      if (dz) return { ok: false, reason: 'outside' };
      const hostIndex = indexOf(layout, p.host);
      const hostSpec = hostIndex >= 0 ? specOf(catalog, layout.items[hostIndex].type) : undefined;
      const cell = hostSpec ? slotCells(layout.items[hostIndex], hostSpec)[p.slot] : undefined;
      if (!cell) return { ok: false, reason: 'no-slot' };
      const x = cell[0] + k * dx;
      const y = cell[1] + k * dy;
      if (x < 0 || y < 0 || x >= occ.w || y >= occ.d) break;
      next = slotAt(layout, catalog, occ, x, y);
      if (!next) {
        first ??= 'no-slot';
        continue;
      }
    }
    const reason = placeProblem(layout, catalog, occ, item, next);
    if (!reason) return { ok: true, layout: withPlace(layout, index, next) };
    first ??= reason;
    if (reason === 'outside' || reason === 'not-placeable' || reason === 'facing') break;
  }
  return { ok: false, reason: first ?? 'outside' };
}

/** Siguiente orientación permitida, en orden 0→1→2→3→0. */
function nextFacing(facings: readonly Facing[], rot: Facing): Facing {
  const sorted = [...facings].sort((a, b) => a - b);
  return sorted.find((f) => f > rot) ?? sorted[0];
}

/**
 * Gira un objeto de piso a su siguiente orientación. Si girado no cabe, prueba a correrlo dentro de
 * su propia huella (lo más cerca posible); si tampoco, no cambia nada ("No cabe girado aquí").
 */
export function rotate(layout: RoomLayout, catalog: Catalog, uid: string): Change {
  const index = indexOf(layout, uid);
  if (index < 0) return { ok: false, reason: 'not-placeable' };
  const item = layout.items[index];
  const spec = specOf(catalog, item.type);
  const p = item.place;
  if (!spec || p.on !== 'floor') return { ok: false, reason: 'facing' };
  const rot = nextFacing(spec.facings, p.rot);
  if (rot === p.rot) return { ok: false, reason: 'facing' };
  const occ = settle(layout, catalog).occ;
  const base = checkPlace(occ, layout.items, catalog, item, { ...p, rot }, index);
  if (!base) return { ok: true, layout: withPlace(layout, index, { ...p, rot }) };
  const [ow, od] = rotateFootprint(spec.footprint, p.rot);
  const [nw, nd] = rotateFootprint(spec.footprint, rot);
  const shifts: [number, number][] = [];
  for (let dx = 1 - nw; dx < ow; dx++) for (let dy = 1 - nd; dy < od; dy++) if (dx || dy) shifts.push([dx, dy]);
  shifts.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b[0]) - Math.abs(b[1]) || a[0] - b[0] || a[1] - b[1]);
  for (const [dx, dy] of shifts) {
    const place: ItemPlace = { on: 'floor', x: p.x + dx, y: p.y + dy, rot };
    if (!checkPlace(occ, layout.items, catalog, item, place, index)) {
      return { ok: true, layout: withPlace(layout, index, place) };
    }
  }
  return { ok: false, reason: base };
}

/** Guarda el objeto en el inventario junto con lo que tenga encima. Devuelve el layout y lo guardado. */
export function store(layout: RoomLayout, uid: string): { layout: RoomLayout; stored: RoomItem[] } {
  const item = layout.items.find((it) => it.uid === uid);
  if (!item) return { layout, stored: [] };
  const stored = [item, ...childrenOf(layout, uid)];
  return { layout: { ...layout, items: layout.items.filter((it) => !stored.includes(it)) }, stored };
}

/**
 * Todos los lugares donde cabe `item` (nuevo o ya en el cuarto), en sus clases de lugar permitidas.
 * En el piso conserva su giro actual (o el primero permitido si viene de otro lugar).
 */
export function validPlaces(layout: RoomLayout, catalog: Catalog, item: RoomItem): ItemPlace[] {
  const spec = specOf(catalog, item.type);
  if (!spec || spec.modifies) return [];
  const occ = settle(layout, catalog).occ;
  const out: ItemPlace[] = [];
  const consider = (place: ItemPlace) => {
    if (!placeProblem(layout, catalog, occ, item, place)) out.push(place);
  };
  for (const kind of spec.place) {
    if (kind === 'floor') {
      const rot = item.place.on === 'floor' && spec.facings.includes(item.place.rot) ? item.place.rot : spec.facings[0];
      if (rot === undefined) continue;
      for (let y = 0; y < occ.d; y++) for (let x = 0; x < occ.w; x++) consider({ on: 'floor', x, y, rot });
    } else if (kind === 'wall') {
      for (const wall of ['right', 'left'] as Wall[]) {
        const len = wall === 'left' ? occ.d : occ.w;
        for (let row = 0; row < occ.rows; row++) for (let u = 0; u < len; u++) consider({ on: 'wall', wall, u, row });
      }
    } else {
      for (const uid of Object.keys(occ.hosts)) {
        const host = layout.items[occ.hosts[uid]];
        const count = specOf(catalog, host.type)?.surface?.slots.length ?? 0;
        for (let slot = 0; slot < count; slot++) consider({ on: 'surface', host: uid, slot });
      }
    }
  }
  return out;
}

export function samePlace(a: ItemPlace, b: ItemPlace) {
  if (a.on === 'floor' && b.on === 'floor') return a.x === b.x && a.y === b.y && a.rot === b.rot;
  if (a.on === 'wall' && b.on === 'wall') return a.wall === b.wall && a.u === b.u && a.row === b.row;
  if (a.on === 'surface' && b.on === 'surface') return a.host === b.host && a.slot === b.slot;
  return false;
}

/** Destinos para marcar con contorno discontinuo al elegir un objeto (sin su lugar actual). */
export function validCellsFor(layout: RoomLayout, catalog: Catalog, uid: string): ItemPlace[] {
  const item = layout.items.find((it) => it.uid === uid);
  if (!item) return [];
  return validPlaces(layout, catalog, item).filter((p) => !samePlace(p, item.place));
}
