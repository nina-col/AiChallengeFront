import type { Facing, ItemPlace, RoomItem, RoomLayout, Wall } from '../../types';

/** Ayudas para armar layouts de prueba. */

export const floor = (x: number, y: number, rot: Facing = 0): ItemPlace => ({ on: 'floor', x, y, rot });
export const wall = (side: Wall, u: number, row: number): ItemPlace => ({ on: 'wall', wall: side, u, row });
export const surface = (host: string, slot: number): ItemPlace => ({ on: 'surface', host, slot });

const VARIANT: Record<string, string> = {
  desk: 'oak',
  chair: 'sage',
  monitor: 'ink',
  plant: 'leaf',
  lamp: 'warm',
  fan: 'mint',
  bookshelf: 'oak',
  rug: 'sage',
  frame: 'home',
  shelf: 'oak',
  blinds: 'linen',
};

/** Objeto con uid de 8 caracteres a partir de un nombre corto (`desk1` → `desk1000`). */
export function item(uid: string, type: string, place: ItemPlace, variant = VARIANT[type] ?? 'x'): RoomItem {
  return { uid: uid.padEnd(8, '0').slice(0, 8), type, variant, place };
}

export const uid = (short: string) => short.padEnd(8, '0').slice(0, 8);

export function room(items: RoomItem[], opts: Partial<Pick<RoomLayout, 'size'>> & { window?: { wall: Wall; u: number } } = {}): RoomLayout {
  return {
    v: 1,
    size: opts.size ?? { w: 5, d: 5 },
    shell: { floor: 'oak', wall: 'teal', window: opts.window ?? { wall: 'right', u: 2 } },
    items,
    pinned: [],
  };
}

/** Congela todo el layout: si alguna función lo muta, la prueba falla. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** Generador determinista para las pruebas de propiedades. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
