import { cellToArt, rotateFootprint, roomArtSize, WALL_ROW, wallToArt } from './iso';
import { slotCells, specOf } from './occupancy';
import type { DrawItem, Facing, Manifest, RoomItem, RoomLayout, Sky, TypeSpec, Wall } from './types';

/**
 * `(layout, manifest)` → `DrawList` ya ordenada (tecnica.md §4 y §6.4): la única fuente de verdad
 * que usan Skia, la capa de accesibilidad, el *hit test* y las pruebas de imagen.
 *
 * Orden: baldosas del piso, alfombras, cielo (detrás del hueco), tramos de pared con el de la
 * ventana, persiana (si la tiene), objetos de pared y, al final, objetos de piso en orden
 * topológico, cada anfitrión seguido de lo que tiene encima.
 *
 * Puntos de apoyo (deben coincidir con las anclas del generador):
 * - piso: esquina trasera de la huella `(x, y)` a `z = 0`;
 * - superficie: esquina trasera de la celda del slot a `z = surface.z` del anfitrión;
 * - pared, ventana, cielo y persiana: esquina inferior trasera del tramo (`u` menor) a `z = 16 · row`.
 */

/** Variante de la pantalla cuando la persona tiene el ajuste de pantalla tenue. */
export const DIM_VARIANT = 'dim';
/** Tipo al que cambia un modificador `modifies: 'monitor'`. */
export const MONITOR = 'monitor';
/** Giro del sprite de un objeto de pared según la pared: `r0` en la derecha, `r1` en la izquierda. */
export const WALL_FACING: Record<Wall, Facing> = { right: 0, left: 1 };

export type DrawOptions = {
  sky: Sky;
  /** Modificadores que tiene la persona: la persiana sobre la ventana y la pantalla tenue. */
  owned: { blinds: boolean; dim: boolean };
  /** Cuadro de animación de reposo por objeto (`{ steam, 1 }` → `taza.x.r0:steam1`). */
  anim?: Record<string, { name: string; frame: number }>;
};

/** Caja de un objeto de piso: huella `[x0, x1) × [y0, y1)` y caja en pantalla `[l, r) × [t, b)`. */
export type FloorBox = { x0: number; y0: number; x1: number; y1: number; l: number; t: number; r: number; b: number };

/** Orientación de un objeto de superficie: la del anfitrión si la tiene, si no una de la misma paridad. */
export function surfaceFacing(spec: TypeSpec, hostRot: Facing): Facing {
  if (spec.facings.includes(hostRot)) return hostRot;
  return spec.facings.find((f) => f % 2 === hostRot % 2) ?? spec.facings[0] ?? 0;
}

/** Nombre del cuadro de un objeto, con la variante tenue y la animación si existen; `null` si no hay. */
function objectFrameName(
  manifest: Pick<Manifest, 'frames'>,
  item: RoomItem,
  facing: Facing,
  options: DrawOptions,
): string | null {
  const has = (name: string) => Object.prototype.hasOwnProperty.call(manifest.frames, name);
  let variant = item.variant;
  if (options.owned.dim && item.type === MONITOR && has(`${item.type}.${DIM_VARIANT}.r${facing}`)) {
    variant = DIM_VARIANT;
  }
  const base = `${item.type}.${variant}.r${facing}`;
  const anim = options.anim && Object.prototype.hasOwnProperty.call(options.anim, item.uid) ? options.anim[item.uid] : null;
  if (anim && has(`${base}:${anim.name}${anim.frame}`)) return `${base}:${anim.name}${anim.frame}`;
  return has(base) ? base : null;
}

/**
 * Orden topológico de objetos de piso (método de Shaun Lebron, *Isometric Blocks*): A va antes que B
 * si sus cajas en pantalla se pisan y A está detrás en un eje sin estar delante en el otro. Kahn en
 * O(n²); entre los listos gana el de menor `x0 + y0` (luego `x0`, luego el índice). Con huellas sin
 * solapes no hay ciclos; si los hubiera (layout inválido), se rompen con el mismo criterio.
 */
export function topoOrder(boxes: readonly FloorBox[]): number[] {
  'worklet';
  const n = boxes.length;
  const indeg: number[] = new Array(n).fill(0);
  const edges: number[][] = [];
  for (let i = 0; i < n; i++) edges.push([]);
  for (let i = 0; i < n; i++) {
    const a = boxes[i];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const b = boxes[j];
      if (!(a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b)) continue;
      const behind = (a.x1 <= b.x0 && !(b.y1 <= a.y0)) || (a.y1 <= b.y0 && !(b.x1 <= a.x0));
      if (behind) {
        edges[i].push(j);
        indeg[j]++;
      }
    }
  }
  const done: boolean[] = new Array(n).fill(false);
  const out: number[] = [];
  while (out.length < n) {
    let best = -1;
    for (let pass = 0; pass < 2 && best < 0; pass++) {
      for (let k = 0; k < n; k++) {
        if (done[k] || (pass === 0 && indeg[k] > 0)) continue;
        if (best < 0) {
          best = k;
          continue;
        }
        const kb = boxes[k];
        const bb = boxes[best];
        const dk = kb.x0 + kb.y0 - (bb.x0 + bb.y0);
        if (dk < 0 || (dk === 0 && kb.x0 < bb.x0)) best = k;
      }
    }
    done[best] = true;
    out.push(best);
    for (const j of edges[best]) indeg[j]--;
  }
  return out;
}

/** Lista de dibujo de la sala, en px de arte del lienzo (`roomArtSize`), ya en orden. */
export function buildDrawList(layout: RoomLayout, manifest: Manifest, options: DrawOptions): DrawItem[] {
  const { w, d } = layout.size;
  const { ox, oy } = roomArtSize(manifest, layout.size);
  const items = layout.items;
  const out: DrawItem[] = [];

  /** Arma un `DrawItem` con el ancla del cuadro en `(ax, ay)` (px de arte del piso). */
  const at = (frame: string | null, ax: number, ay: number, uid?: string): DrawItem | null => {
    if (!frame || !Object.prototype.hasOwnProperty.call(manifest.frames, frame)) return null;
    const [axr, ayr] = manifest.frames[frame].anchor;
    const item: DrawItem = { frame, x: ox + ax - axr, y: oy + ay - ayr };
    if (uid) item.uid = uid;
    return item;
  };
  const put = (item: DrawItem | null) => {
    if (item) out.push(item);
  };

  // 1. Piso: baldosas de atrás hacia adelante.
  for (let s = 0; s <= w + d - 2; s++) {
    for (let x = 0; x < w; x++) {
      const y = s - x;
      if (y < 0 || y >= d) continue;
      const p = cellToArt(x, y);
      put(at(`floor.${layout.shell.floor}`, p.ax, p.ay));
    }
  }

  // Objetos que se pueden dibujar: tipo conocido, que no sea modificador.
  const known = items.map((it) => {
    const spec = specOf(manifest, it.type);
    return spec && !spec.modifies ? spec : undefined;
  });
  const floorIdx = items
    .map((_, i) => i)
    .filter((i) => known[i] && items[i].place.on === 'floor');
  const byBack = (a: number, b: number) => {
    const pa = items[a].place as { x: number; y: number };
    const pb = items[b].place as { x: number; y: number };
    return pa.x + pa.y - (pb.x + pb.y) || pa.x - pb.x || a - b;
  };
  const floorPoint = (it: RoomItem) => {
    const p = it.place as { x: number; y: number };
    return cellToArt(p.x, p.y);
  };
  const floorFacing = (it: RoomItem) => (it.place as { rot: Facing }).rot;

  // 2. Alfombras: su propia capa, debajo de los muebles.
  for (const i of floorIdx.filter((i) => known[i]!.flat).sort(byBack)) {
    const p = floorPoint(items[i]);
    put(at(objectFrameName(manifest, items[i], floorFacing(items[i]), options), p.ax, p.ay, items[i].uid));
  }

  // 3. Cielo detrás del hueco, tramos de pared (el de la ventana con hueco) y persiana encima.
  const win = layout.shell.window;
  const winPoint = wallToArt(win.wall, win.u);
  put(at(`sky.${options.sky}.${win.wall}`, winPoint.ax, winPoint.ay));
  for (let u = 0; u < Math.max(w, d); u++) {
    for (const wall of ['left', 'right'] as Wall[]) {
      if (u >= (wall === 'left' ? d : w)) continue;
      const kind = wall === win.wall && u === win.u ? 'window' : 'wall';
      const p = wallToArt(wall, u);
      put(at(`${kind}.${layout.shell.wall}.${wall}`, p.ax, p.ay));
    }
  }
  if (options.owned.blinds) put(at(`blinds.${win.wall}`, winPoint.ax, winPoint.ay));

  // 4. Objetos de pared: de la esquina hacia afuera.
  const wallIdx = items
    .map((_, i) => i)
    .filter((i) => known[i] && items[i].place.on === 'wall')
    .sort((a, b) => {
      const pa = items[a].place as { u: number; row: number; wall: Wall };
      const pb = items[b].place as { u: number; row: number; wall: Wall };
      return pa.u - pb.u || pa.row - pb.row || (pa.wall === pb.wall ? 0 : pa.wall === 'left' ? -1 : 1) || a - b;
    });
  for (const i of wallIdx) {
    const p = items[i].place as { u: number; row: number; wall: Wall };
    const pt = wallToArt(p.wall, p.u, p.row * WALL_ROW);
    put(at(objectFrameName(manifest, items[i], WALL_FACING[p.wall], options), pt.ax, pt.ay, items[i].uid));
  }

  // 5. Objetos de piso en orden topológico, cada anfitrión con lo que tiene encima.
  const solid = floorIdx.filter((i) => !known[i]!.flat);
  const entries: { host: DrawItem; children: DrawItem[]; box: FloorBox }[] = [];
  for (const i of solid) {
    const it = items[i];
    const spec = known[i]!;
    const p = it.place as { x: number; y: number; rot: Facing };
    const pt = floorPoint(it);
    const host = at(objectFrameName(manifest, it, p.rot, options), pt.ax, pt.ay, it.uid);
    if (!host) continue;
    const children: { item: DrawItem; key: number[] }[] = [];
    if (spec.surface) {
      const cells = slotCells(it, spec);
      items.forEach((child, c) => {
        const cp = child.place;
        if (cp.on !== 'surface' || cp.host !== it.uid || !known[c] || !cells[cp.slot]) return;
        if (items.findIndex((h) => h.uid === it.uid) !== i) return; // uid repetido: vale el primero
        const [cx, cy] = cells[cp.slot];
        const z = cellToArt(cx, cy, spec.surface!.z);
        const drawn = at(objectFrameName(manifest, child, surfaceFacing(known[c]!, p.rot), options), z.ax, z.ay, child.uid);
        if (drawn) children.push({ item: drawn, key: [cx + cy, cx, cp.slot, c] });
      });
      children.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2] || a.key[3] - b.key[3]);
    }
    const [fw, fd] = rotateFootprint(spec.footprint, p.rot);
    const box: FloorBox = { x0: p.x, y0: p.y, x1: p.x + fw, y1: p.y + fd, l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
    for (const di of [host, ...children.map((c) => c.item)]) {
      const [, , fwPx, fhPx] = manifest.frames[di.frame].rect;
      box.l = Math.min(box.l, di.x);
      box.t = Math.min(box.t, di.y);
      box.r = Math.max(box.r, di.x + fwPx);
      box.b = Math.max(box.b, di.y + fhPx);
    }
    entries.push({ host, children: children.map((c) => c.item), box });
  }
  for (const k of topoOrder(entries.map((e) => e.box))) {
    out.push(entries[k].host, ...entries[k].children);
  }
  return out;
}
