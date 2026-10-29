import { rotateFootprint, wallLength } from './iso';
import { checkPlace, settle, slotCells, specOf, type Catalog, type Occupancy } from './occupancy';
import {
  LIMITS,
  type Facing,
  type ItemPlace,
  type Manifest,
  type PlaceKind,
  type RoomItem,
  type RoomLayout,
  type TypeSpec,
  type Wall,
} from './types';

/**
 * Layout v1 (tecnica.md §7): validar con las mismas reglas que la API, migrar, armar la sala por
 * defecto de un espacio y colocar solo un objeto recién ganado. Nada es aleatorio: lo que varía
 * entre salas sale del id del espacio. La app nunca reacomoda lo que la persona puso; un objeto
 * nuevo va al primer lugar razonable libre, y si no hay, queda en el inventario.
 *
 * Problemas de `validateLayout` (los mismos textos en Rust, `apps/api/catalog/room-fixtures`):
 * `<ruta>: <código>`, primero los generales y luego por objeto en orden de la lista.
 * - `layout: invalid` · `v: invalid` · `v: unsupported` · `size: invalid` · `shell: invalid` (se detiene ahí)
 * - `shell.floor: unknown-variant` · `shell.wall: unknown-variant` · `shell.window: outside`
 * - `items: invalid` (se detiene) · `items: too-many` · `pinned: invalid` · `layout: too-large`
 * - `items[i]: invalid` · `items[i].uid: invalid|duplicate` · `items[i].variant: unknown-variant`
 *   · `items[i].type: not-owned` · `items[i].place: invalid|outside|occupied|facing|no-slot|window|not-placeable`
 * Los tipos desconocidos se conservan y no se validan (salvo uid y forma del lugar), ni lo que
 * tienen encima. La ocupación solo depende de los lugares: un objeto ajeno o de variante rara
 * igual ocupa su celda.
 */

export const LAYOUT_VERSION = 1;
/** Tamaño de una sala nueva: con baldosas de 64 × 32 pt no hace falta zoom (§5.3). */
export const DEFAULT_SIZE = { w: 5, d: 5 } as const;
/** El asiento va frente a la pantalla, mirando hacia la pared derecha (`r2`, como en el prototipo). */
export const SEAT = 'chair';
const SEAT_FACING: Facing = 2;
export const UID_RE = /^[a-z0-9]{8}$/;
/** Ids de ajustes en el corcho: `[a-z0-9_]`, de 1 a 64. */
export const PINNED_RE = /^[a-z0-9_]{1,64}$/;

/** Catálogo con variantes de piso y pared: `Manifest` o `RoomCatalog`. */
export type ShellCatalog = Catalog & Pick<Manifest, 'shell'>;
export type Migrated = { ok: true; layout: RoomLayout } | { ok: false; reason: 'newer' | 'invalid' };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isWall = (v: unknown): v is Wall => v === 'left' || v === 'right';

function isPlace(p: unknown): p is ItemPlace {
  if (!isObj(p)) return false;
  if (p.on === 'floor') return isInt(p.x) && isInt(p.y) && (p.rot === 0 || p.rot === 1 || p.rot === 2 || p.rot === 3);
  if (p.on === 'wall') return isWall(p.wall) && isInt(p.u) && isInt(p.row);
  if (p.on === 'surface') return typeof p.host === 'string' && isInt(p.slot);
  return false;
}

/** Bytes del texto en UTF-8 (sin `TextEncoder`, que no siempre está en Hermes). */
export function utf8Length(s: string) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

/**
 * Problemas del layout (vacío si es válido). `owned`: tipos que tiene la persona (`earnedTypes`);
 * los de base y decoración no hacen falta. Acepta JSON sin tipar, como lo recibe la API.
 */
export function validateLayout(raw: unknown, catalog: ShellCatalog, owned: readonly string[]): string[] {
  if (!isObj(raw)) return ['layout: invalid'];
  if (raw.v !== LAYOUT_VERSION) {
    return [typeof raw.v === 'number' && raw.v > LAYOUT_VERSION ? 'v: unsupported' : 'v: invalid'];
  }
  const size = raw.size;
  const sizeOk = (n: unknown) => isInt(n) && n >= 1 && n <= LIMITS.maxSize;
  if (!isObj(size) || !sizeOk(size.w) || !sizeOk(size.d)) return ['size: invalid'];
  const dims = { w: size.w as number, d: size.d as number };
  const shell = raw.shell;
  if (
    !isObj(shell) ||
    typeof shell.floor !== 'string' ||
    typeof shell.wall !== 'string' ||
    !isObj(shell.window) ||
    !isWall(shell.window.wall) ||
    !isInt(shell.window.u)
  ) {
    return ['shell: invalid'];
  }
  const problems: string[] = [];
  if (!catalog.shell.floors.includes(shell.floor)) problems.push('shell.floor: unknown-variant');
  if (!catalog.shell.walls.includes(shell.wall)) problems.push('shell.wall: unknown-variant');
  const win = { wall: shell.window.wall, u: shell.window.u };
  const winOk = win.u >= 0 && win.u < wallLength(dims, win.wall);
  if (!winOk) problems.push('shell.window: outside');
  if (!Array.isArray(raw.items)) return [...problems, 'items: invalid'];
  if (raw.items.length > LIMITS.maxItems) problems.push('items: too-many');
  const pinned = raw.pinned;
  if (
    !Array.isArray(pinned) ||
    pinned.length > LIMITS.maxItems ||
    pinned.some((p) => typeof p !== 'string' || !PINNED_RE.test(p)) ||
    new Set(pinned).size !== pinned.length
  ) {
    problems.push('pinned: invalid');
  }
  if (utf8Length(JSON.stringify(raw)) > LIMITS.maxBytes) problems.push('layout: too-large');

  const perItem: string[][] = raw.items.map(() => []);
  const clean: RoomItem[] = [];
  const cleanIndex: number[] = [];
  const seen = new Set<string>();
  raw.items.forEach((it: unknown, i: number) => {
    const at = `items[${i}]`;
    const out = perItem[i];
    if (!isObj(it) || typeof it.uid !== 'string' || typeof it.type !== 'string' || typeof it.variant !== 'string') {
      out.push(`${at}: invalid`);
      return;
    }
    if (!UID_RE.test(it.uid)) out.push(`${at}.uid: invalid`);
    else if (seen.has(it.uid)) out.push(`${at}.uid: duplicate`);
    seen.add(it.uid);
    const spec = specOf(catalog, it.type);
    if (spec) {
      if (!spec.variants.includes(it.variant)) out.push(`${at}.variant: unknown-variant`);
      if (!spec.base && !spec.decor && !owned.includes(it.type)) out.push(`${at}.type: not-owned`);
    }
    if (!isPlace(it.place)) {
      out.push(`${at}.place: invalid`);
      return;
    }
    clean.push({ uid: it.uid, type: it.type, variant: it.variant, place: it.place });
    cleanIndex.push(i);
  });

  const layout: RoomLayout = {
    v: 1,
    size: dims,
    shell: { floor: shell.floor, wall: shell.wall, window: winOk ? win : { wall: win.wall, u: -1 } },
    items: clean,
    pinned: [],
  };
  settle(layout, catalog).reasons.forEach((reason, k) => {
    if (reason) perItem[cleanIndex[k]].push(`items[${cleanIndex[k]}].place: ${reason}`);
  });
  return [...problems, ...perItem.flat()];
}

/** JSON guardado → layout actual. v1 pasa tal cual; una versión más nueva pide actualizar la app. */
export function migrate(raw: unknown): Migrated {
  if (!isObj(raw) || typeof raw.v !== 'number') return { ok: false, reason: 'invalid' };
  if (raw.v > LAYOUT_VERSION) return { ok: false, reason: 'newer' };
  if (raw.v !== 1 || !isObj(raw.size) || !isObj(raw.shell) || !Array.isArray(raw.items)) {
    return { ok: false, reason: 'invalid' };
  }
  const layout = raw as unknown as RoomLayout;
  return { ok: true, layout: Array.isArray(raw.pinned) ? layout : { ...layout, pinned: [] } };
}

// ── Semillas ─────────────────────────────────────────────────────────────────────────────────

/** FNV-1a de 32 bits: la semilla de una sala sale del id de su espacio. */
export function hashSeed(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Generador determinista (mulberry32) en [0, 1). */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UID_ABC = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** `makeUid` determinista a partir de una semilla (pruebas y sala por defecto sin red). */
export function uidMaker(seed: string) {
  const rand = seededRandom(hashSeed(`uid:${seed}`));
  return () => {
    let s = '';
    for (let i = 0; i < 8; i++) s += UID_ABC[Math.floor(rand() * UID_ABC.length)];
    return s;
  };
}

function freshUid(layout: RoomLayout, makeUid: () => string) {
  for (let i = 0; i < 16; i++) {
    const uid = makeUid();
    if (UID_RE.test(uid) && !layout.items.some((it) => it.uid === uid)) return uid;
  }
  throw new Error('makeUid no da uids válidos y únicos (8 caracteres [a-z0-9])');
}

// ── Lo que tiene la persona ─────────────────────────────────────────────────────────────────

/** Tipos que tiene la persona: los de base, la decoración y los de los ajustes que probó hasta el final. */
export function earnedTypes(manifest: Pick<Manifest, 'types'>, triedAdjustmentIds: readonly string[]): string[] {
  const tried = new Set(triedAdjustmentIds);
  return Object.keys(manifest.types).filter((type) => {
    const spec = manifest.types[type];
    return spec.base || spec.decor || (spec.adjustments ?? []).some((id) => tried.has(id));
  });
}

/** Modificadores que tiene: persiana sobre la ventana y pantalla tenue (para `buildDrawList`). */
export function ownedModifiers(manifest: Pick<Manifest, 'types'>, ownedTypes: readonly string[]) {
  const mods = ownedTypes.map((t) => specOf(manifest, t)?.modifies);
  return { blinds: mods.includes('window'), dim: mods.includes('monitor') };
}

// ── Colocar solo ────────────────────────────────────────────────────────────────────────────


type Ranked = { place: ItemPlace; key: number[] };

function byKey(all: Ranked[]): ItemPlace[] {
  return all
    .sort((a, b) => {
      for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return a.key[i] - b.key[i];
      return 0;
    })
    .map((c) => c.place);
}

/** Lugares candidatos para colocar solo un tipo, del más al menos razonable. */
function candidates(kind: PlaceKind, spec: TypeSpec, layout: RoomLayout, catalog: Catalog, occ: Occupancy): ItemPlace[] {
  const { w, d } = layout.size;
  if (kind === 'surface') {
    // Slots de los anfitriones en el orden de la lista (el escritorio de la sala por defecto va primero).
    const out: ItemPlace[] = [];
    const hosts = Object.keys(occ.hosts).sort((a, b) => occ.hosts[a] - occ.hosts[b]);
    for (const host of hosts) {
      const count = specOf(catalog, layout.items[occ.hosts[host]].type)?.surface?.slots.length ?? 0;
      for (let slot = 0; slot < count; slot++) out.push({ on: 'surface', host, slot });
    }
    return out;
  }
  const all: Ranked[] = [];
  if (kind === 'wall') {
    // A media altura y hacia el centro de cada pared; primero la derecha.
    const [span, tall] = spec.footprint;
    (['right', 'left'] as Wall[]).forEach((wall, wi) => {
      const len = wallLength(layout.size, wall);
      for (let row = 0; row + tall <= occ.rows; row++) {
        for (let u = 0; u + span <= len; u++) {
          const key = [Math.abs(row + tall / 2 - occ.rows / 2), -row, Math.abs(u + span / 2 - len / 2), wi, u];
          all.push({ place: { on: 'wall', wall, u, row }, key });
        }
      }
    });
    return byKey(all);
  }
  // Piso: alfombras hacia el centro; muebles junto a las paredes, empezando por el fondo, y
  // si se puede sin pegarse a una silla (para no encerrarla).
  const crowded = new Set<number>();
  for (const it of layout.items) {
    if (it.type !== SEAT || it.place.on !== 'floor') continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) crowded.add((it.place.y + dy) * w + it.place.x + dx);
  }
  const touches = (x: number, y: number, fw: number, fd: number) => {
    for (let j = 0; j < fd; j++) for (let i = 0; i < fw; i++) if (crowded.has((y + j) * w + x + i)) return 1;
    return 0;
  };
  spec.facings.forEach((rot, fi) => {
    const [fw, fd] = rotateFootprint(spec.footprint, rot);
    for (let y = 0; y + fd <= d; y++) {
      for (let x = 0; x + fw <= w; x++) {
        const key = spec.flat
          ? [fi, (2 * x + fw - w) ** 2 + (2 * y + fd - d) ** 2, x + y, x]
          : [fi, touches(x, y, fw, fd), Math.min(x, y), x + y, x];
        all.push({ place: { on: 'floor', x, y, rot }, key });
      }
    }
  });
  return byKey(all);
}

/** Agrega `item` si cabe tal cual, o `null`. */
function tryAdd(layout: RoomLayout, catalog: Catalog, item: RoomItem): RoomLayout | null {
  const occ = settle(layout, catalog).occ;
  return checkPlace(occ, layout.items, catalog, item, item.place, -1) ? null : { ...layout, items: [...layout.items, item] };
}

/**
 * Pone un objeto nuevo en el primer lugar razonable libre, siguiendo el orden de `place` del tipo:
 * superficie → slots libres de los escritorios; pared → a media altura y al centro; piso → junto a
 * las paredes (las alfombras, al centro). `null` si no hay lugar: queda en el inventario.
 */
export function autoPlace(
  layout: RoomLayout,
  catalog: Catalog,
  type: string,
  variant: string,
  makeUid: () => string,
): RoomLayout | null {
  const spec = specOf(catalog, type);
  if (!spec || spec.modifies) return null;
  const occ = settle(layout, catalog).occ;
  let uid: string | null = null;
  for (const kind of spec.place) {
    for (const place of candidates(kind, spec, layout, catalog, occ)) {
      const probe: RoomItem = { uid: '', type, variant, place };
      if (checkPlace(occ, layout.items, catalog, probe, place, -1)) continue;
      uid ??= freshUid(layout, makeUid);
      return { ...layout, items: [...layout.items, { ...probe, uid }] };
    }
  }
  return null;
}

/**
 * Sala nueva de un espacio, determinista por su id: escritorio contra la pared derecha con la
 * pantalla y la planta encima, la silla enfrente mirando hacia él, la ventana en una de las
 * paredes, y luego lo ganado (en el orden del catálogo) en lugares libres. Pasa `uidMaker(spaceId)`
 * como `makeUid` para que también los uid salgan iguales en cualquier teléfono.
 */
export function defaultLayout(
  spaceId: string,
  manifest: ShellCatalog,
  ownedTypes: readonly string[],
  makeUid: () => string,
  size: { w: number; d: number } = DEFAULT_SIZE,
): RoomLayout {
  const rand = seededRandom(hashSeed(spaceId));
  const winWall: Wall = rand() < 0.5 ? 'right' : 'left';
  const len = wallLength(size, winWall);
  const winU = len > 2 ? 1 + Math.floor(rand() * (len - 2)) : 0;
  let layout: RoomLayout = {
    v: 1,
    size: { w: size.w, d: size.d },
    shell: { floor: manifest.shell.floors[0], wall: manifest.shell.walls[0], window: { wall: winWall, u: winU } },
    items: [],
    pinned: [],
  };
  const types = Object.keys(manifest.types);
  const spec = (t: string) => manifest.types[t];
  const placeable = (t: string) => spec(t).place.length > 0 && !spec(t).modifies;
  const add = (t: string) => {
    layout = autoPlaceWithHost(layout, manifest, t, spec(t).variants[0], makeUid) ?? layout;
  };
  const base = types.filter((t) => spec(t).base && placeable(t));

  // Escritorio contra la pared derecha (y = 0), con el lado largo pegado a ella.
  const deskType = base.find((t) => spec(t).surface && spec(t).place.includes('floor'));
  let desk: RoomItem | undefined;
  if (deskType) {
    const s = spec(deskType);
    const rot = s.facings.find((f) => rotateFootprint(s.footprint, f)[0] >= rotateFootprint(s.footprint, f)[1]) ?? s.facings[0];
    const [fw] = rotateFootprint(s.footprint, rot);
    const x = Math.floor(rand() * Math.max(1, size.w - fw + 1));
    const item: RoomItem = { uid: freshUid(layout, makeUid), type: deskType, variant: s.variants[0], place: { on: 'floor', x, y: 0, rot } };
    const placed = tryAdd(layout, manifest, item);
    if (placed) layout = placed;
    else add(deskType);
    desk = layout.items.find((it) => it.type === deskType);
  }

  // Lo de base que prefiere ir encima (la pantalla) va al escritorio; lo que prefiere el piso (la
  // planta) va al piso, para dejar un lugar libre en el escritorio a lo primero que se gane.
  const rest = base.filter((t) => t !== deskType);
  const onTop = rest.filter((t) => spec(t).place[0] === 'surface');
  for (const t of onTop) {
    const slots = desk ? (spec(desk.type).surface?.slots.length ?? 0) : 0;
    let placed: RoomLayout | null = null;
    for (let slot = 0; slot < slots && !placed; slot++) {
      const place: ItemPlace = { on: 'surface', host: desk!.uid, slot };
      placed = tryAdd(layout, manifest, { uid: freshUid(layout, makeUid), type: t, variant: spec(t).variants[0], place });
    }
    if (placed) layout = placed;
    else add(t);
  }

  if (rest.includes(SEAT)) {
    const s = spec(SEAT);
    const rot = s.facings.includes(SEAT_FACING) ? SEAT_FACING : s.facings[0];
    const front: [number, number][] = [];
    if (desk && desk.place.on === 'floor') {
      const hostSpec = spec(desk.type);
      const [fw, fd] = rotateFootprint(hostSpec.footprint, desk.place.rot);
      const y = desk.place.y + fd;
      const used = layout.items
        .filter((it) => it.place.on === 'surface' && it.place.host === desk!.uid)
        .map((it) => (it.place as { slot: number }).slot);
      const cells = slotCells(desk, hostSpec);
      for (const slot of used) front.push([cells[slot][0], y]);
      for (let i = 0; i < fw; i++) front.push([desk.place.x + i, y]);
    }
    let seated = false;
    for (const [x, y] of front) {
      const placed = tryAdd(layout, manifest, { uid: freshUid(layout, makeUid), type: SEAT, variant: s.variants[0], place: { on: 'floor', x, y, rot } });
      if (placed) {
        layout = placed;
        seated = true;
        break;
      }
    }
    if (!seated) add(SEAT);
  }
  rest.filter((t) => t !== SEAT && !onTop.includes(t)).forEach(add);

  // Lo ganado, una vez cada tipo; la decoración espera en el inventario.
  types.filter((t) => ownedTypes.includes(t) && placeable(t) && !spec(t).base && !spec(t).decor).forEach(add);
  return layout;
}

/** Mesa que aparece con un objeto de superficie cuando ya no hay dónde ponerlo. */
export const SPARE_HOST = 'sideTable';
/** Como mucho estas mesitas aparecen solas: más llenarían el cuarto (la saturación visual molesta). */
export const MAX_SPARE_HOSTS = 2;

/**
 * Como `autoPlace`, pero si un objeto que solo va sobre una superficie ya no cabe (los escritorios
 * están llenos), pone primero una mesita (`SPARE_HOST`) en un lugar libre del piso y el objeto
 * encima, como mucho `MAX_SPARE_HOSTS` mesitas por cuarto. Agregar no reacomoda nada de lo que ya
 * está. `null` si no cabe: el objeto espera en el inventario.
 */
export function autoPlaceWithHost(
  layout: RoomLayout,
  catalog: Catalog,
  type: string,
  variant: string,
  makeUid: () => string,
): RoomLayout | null {
  const direct = autoPlace(layout, catalog, type, variant, makeUid);
  if (direct) return direct;
  const spec = specOf(catalog, type);
  const host = specOf(catalog, SPARE_HOST);
  if (!spec || !host?.surface || spec.place.some((p) => p !== 'surface')) return null;
  if (layout.items.filter((item) => item.type === SPARE_HOST).length >= MAX_SPARE_HOSTS) return null;
  const withHost = autoPlace(layout, catalog, SPARE_HOST, host.variants[0], makeUid);
  return withHost ? autoPlace(withHost, catalog, type, variant, makeUid) : null;
}
