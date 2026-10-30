import { cellToArt, TILE_H, TILE_W } from './iso';
import { samePlace } from './occupancy';
import type { DrawItem, ItemPlace, Manifest, RoomItem, RoomLayout } from './types';

/**
 * Animaciones del cuarto (DESIGN.md §5 y §12, tecnica.md §9): planes puros y deterministas que la
 * vista muestrea con su propio reloj. Aquí no se lee la hora: todo recibe `now` en ms.
 *
 * - Nada rebota ni se pasa: cada valor solo se acerca a su destino. Nada se repite.
 * - Los desfases son enteros en px de arte (pixeles nítidos).
 * - `reduced`: solo fundidos o nada, sin desplazar. `calm`: salida suave, 250 ms o menos y 2 px
 *   como mucho, salvo el movimiento que pidió la persona. `detailed`: a saltos, una vez por acción.
 *
 * Una animación es una lista de poses de un objeto. Con `steps` cada pose se queda hasta la
 * siguiente (como `Easing.steps`); con `out` va de la primera al reposo (o a `to`) con la curva de
 * salida de DESIGN.md §5. Al cumplirse `dur` el objeto queda como lo dibuja el layout, y lo que se
 * guardó deja de dibujarse. La vista pide cuadros solo mientras `sampleAnimations(...).running`.
 */

/** El mismo nivel que `useMotionLevel` (`src/lib/feedback.ts`). */
export type Level = 'reduced' | 'calm' | 'detailed';

/** Cómo se ve un objeto en un instante, relativo a donde lo dibuja el layout. */
export type Pose = {
  /** Desfase de su punto de apoyo en el piso, en px de arte enteros. La sombra va aquí. */
  dx: number;
  dy: number;
  /** Cuánto está levantado, en px de arte enteros: sube el sprite, no la sombra. */
  lift: number;
  /** Opacidad del sprite (0–1). */
  alpha: number;
  /** Opacidad de su sombra en el piso (0 = sin sombra; solo la tienen los objetos de piso). */
  shadow: number;
  /** Cuadro que se dibuja en lugar del del layout (el de antes de girar); su lugar ya va en dx/dy. */
  frame?: string;
};

/** Una pose y desde cuándo se ve (ms desde el inicio de la animación). */
export type Key = Pose & { at: number };

export type AnimKind = 'intro' | 'enter' | 'add' | 'move' | 'rotate' | 'store';

export type Anim = {
  /** Objeto que se anima, o `ROOM` para el fundido de todo el cuarto. */
  uid: string;
  kind: AnimKind;
  /** ms del reloj de quien la planeó. */
  start: number;
  /** Duración (ms): desde ahí, reposo (o, si se guardó, ya no se dibuja). */
  dur: number;
  ease: 'steps' | 'out';
  /** Poses en orden, la primera en 0. Con `out` solo cuenta la primera. */
  keys: Key[];
  /** Destino de `out` si no es el reposo (al guardar: transparente). */
  to?: Pose;
  /** Pose mientras espera su turno (antes de `start`); si falta, la primera. */
  wait?: Pose;
  /** Lo que se guardó: `withLeaving` lo sigue dibujando mientras se desvanece. */
  leaving?: RoomItem;
};

export type Sample = {
  /** uid → pose de lo que se está animando; lo que no aparece, en reposo. */
  items: Record<string, Pose>;
  /** Opacidad de todo el cuarto (la entrada en modo tranquilo): se aplica al lienzo entero. */
  room: number;
  /** ¿Queda algo por animar? Si no, la vista deja de pedir cuadros. */
  running: boolean;
};

/** Desfase en px de arte. */
export type Offset = { dx: number; dy: number };

/** uid reservado para el fundido de todo el cuarto (los uid reales son `[a-z0-9]{8}`). */
export const ROOM = '*';
export const REST: Pose = { dx: 0, dy: 0, lift: 0, alpha: 1, shadow: 0 };
/** La muestra sin nada que animar. */
export const STILL: Sample = { items: {}, room: 1, running: false };
const HIDDEN: Pose = { ...REST, alpha: 0 };
/** Los fundidos suaves avanzan en pasos de 1/32: la opacidad solo cambia cuando cambia de verdad. */
const ALPHA_LEVELS = 32;

// ── Tiempos y distancias (ms y px de arte) ──────────────────────────────────────────────────

/** Entrada con detalles: cada objeto cae 4 px y se enciende en 3 saltos (180 ms), uno tras otro cada 35 ms. */
export const INTRO_DROP = 4;
export const INTRO_STEPS = 3;
export const INTRO_ITEM_MS = 180;
export const INTRO_STAGGER_MS = 35;
/** Toda la entrada termina en 600 ms o menos: con muchos objetos, la espera entre ellos se acorta. */
export const INTRO_MAX_MS = 600;
/** Entrada en modo tranquilo: el cuarto entero aparece con un fundido. */
export const CALM_INTRO_MS = 200;

/** Lo recién ganado, con detalles: su sombra se enciende en 2 saltos y él cae de 5 px a 0 en 4 (≈ 10 pt, DESIGN.md §5). */
export const ENTER_DROP = 5;
export const ENTER_STEPS = 4;
export const ENTER_SHADOW_STEPS = 2;
export const ENTER_MS = 320;
/** Cuando lo recién ganado toca el piso (con detalles): ahí va el tono del resultado (DESIGN.md §5). */
export const ENTER_LAND_MS = ENTER_MS;
/** Tranquilo: fundido con 2 px de caída. Reducido: solo el fundido. */
export const CALM_ENTER_MS = 200;
export const CALM_ENTER_DROP = 2;
export const REDUCED_ENTER_MS = 150;

/** Mover con detalles es un salto de pixel: sube 2 px (un paso), avanza una casilla por paso y baja. */
export const HOP_LIFT = 2;
export const HOP_STEP_MS = 60;
/** Todo el recorrido cabe en 240 ms: con muchas casillas, cada paso dura menos. */
export const HOP_TRAVEL_MAX_MS = 240;
/** Pared y superficie no van por la rejilla del piso: se deslizan en como mucho 4 pasos. */
export const SLIDE_MAX_STEPS = 4;
/** Mover en modo tranquilo: se desliza en línea recta con salida suave. */
export const CALM_SLIDE_MS = 120;

/** Girar con detalles: sube 1 px, cambia de cuadro y baja (2 pasos). */
export const ROTATE_LIFT = 1;
export const ROTATE_STEPS = 2;
export const ROTATE_MS = 100;

/** Guardar en "Tus cosas" con detalles: sube 2 px y se apaga en 3 saltos. Sacarlo es lo mismo al revés. */
export const STORE_LIFT = 2;
export const STORE_STEPS = 3;
export const STORE_MS = 180;
/** Guardar o sacar en modo tranquilo: un fundido. */
export const CALM_FADE_MS = 150;

/** Lo que se arrastra va levantado según el nivel; su lugar de origen queda medio transparente. */
export const DRAG_LIFT: Record<Level, number> = { reduced: 0, calm: 2, detailed: 4 };
export const DRAG_ORIGIN_ALPHA = 0.35;

/** Topes que cumple toda animación (la entrada con detalles, contada entera). */
export const MAX_MS: Record<Level, number> = { reduced: 250, calm: 250, detailed: 600 };
/** En modo tranquilo nada se desplaza más que esto, salvo lo que movió la persona. */
export const CALM_MAX_SHIFT = 2;

// ── Muestreo ─────────────────────────────────────────────────────────────────────────────────

/**
 * Curva de salida de DESIGN.md §5, `bezier(0.23, 1, 0.32, 1)`. Crece siempre y nunca pasa de 1.
 * Como `y1 = y2 = 1`, `y(s) = 1 − (1 − s)³`; `s` sale de `x(s) = t` por bisección.
 */
export function easeOut(t: number) {
  'worklet';
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const s = (lo + hi) / 2;
    const r = 1 - s;
    const x = 3 * r * r * s * 0.23 + 3 * r * s * s * 0.32 + s * s * s;
    if (x < t) lo = s;
    else hi = s;
  }
  const r = 1 - (lo + hi) / 2;
  return 1 - r * r * r;
}

/** Entero entre `to` y `from` a una fracción `e` del camino: trunca hacia `to`, así nunca se pasa. */
function toward(from: number, to: number, e: number) {
  'worklet';
  return to + (Math.trunc((from - to) * (1 - e)) || 0);
}

function fade(from: number, to: number, e: number) {
  'worklet';
  return Math.round((from + (to - from) * e) * ALPHA_LEVELS) / ALPHA_LEVELS;
}

function copyPose(k: Pose): Pose {
  'worklet';
  const p: Pose = { dx: k.dx, dy: k.dy, lift: k.lift, alpha: k.alpha, shadow: k.shadow };
  if (k.frame !== undefined) p.frame = k.frame;
  return p;
}

/** Pose de una animación a `t` ms de su inicio (antes de terminar). */
function poseAt(a: Anim, t: number): Pose {
  'worklet';
  if (t < 0) return copyPose(a.wait ?? a.keys[0]);
  if (a.ease === 'steps') {
    let k = a.keys[0];
    for (let i = 1; i < a.keys.length && a.keys[i].at <= t; i++) k = a.keys[i];
    return copyPose(k);
  }
  const from = a.keys[0];
  const to = a.to ?? REST;
  const e = easeOut(t / a.dur);
  return {
    dx: toward(from.dx, to.dx, e),
    dy: toward(from.dy, to.dy, e),
    lift: toward(from.lift, to.lift, e),
    alpha: fade(from.alpha, to.alpha, e),
    shadow: fade(from.shadow, to.shadow, e),
  };
}

/**
 * Lo que se ve en `now`: la pose de cada objeto que se anima, la opacidad del cuarto y si queda
 * algo por animar. Si hay dos animaciones del mismo objeto, gana la última de la lista.
 */
export function sampleAnimations(anims: readonly Anim[], now: number): Sample {
  'worklet';
  const items: Record<string, Pose> = {};
  let room = 1;
  let running = false;
  for (let i = 0; i < anims.length; i++) {
    const a = anims[i];
    const t = now - a.start;
    if (t >= a.dur) continue;
    running = true;
    const pose = poseAt(a, t);
    if (a.uid === ROOM) room = pose.alpha;
    else items[a.uid] = pose;
  }
  return { items, room, running };
}

/** ¿Se ven igual? La vista solo vuelve a dibujar cuando cambia un pixel entero o un paso. */
export function sameSample(a: Sample, b: Sample) {
  'worklet';
  if (a.room !== b.room || a.running !== b.running) return false;
  const uids = Object.keys(a.items);
  if (uids.length !== Object.keys(b.items).length) return false;
  for (const uid of uids) {
    if (!Object.prototype.hasOwnProperty.call(b.items, uid)) return false;
    const p = a.items[uid];
    const q = b.items[uid];
    if (p.dx !== q.dx || p.dy !== q.dy || p.lift !== q.lift || p.alpha !== q.alpha || p.shadow !== q.shadow) return false;
    if (p.frame !== q.frame) return false;
  }
  return true;
}

/** Cuándo termina la última (ms del reloj de la vista), o `after` si termina antes o no hay ninguna. */
export function endTime(anims: readonly Anim[], after = -Infinity) {
  let end = after;
  for (const a of anims) end = Math.max(end, a.start + a.dur);
  return end;
}

/** Las que siguen en curso (o esperando su turno) en `now`. */
export function pruneAnims(anims: readonly Anim[], now: number): Anim[] {
  return anims.filter((a) => now - a.start < a.dur);
}

/** Agrega `planned` a las activas: las de un mismo objeto se reemplazan y las terminadas se quitan. */
export function mergeAnims(active: readonly Anim[], planned: readonly Anim[], now: number): Anim[] {
  const replaced = new Set(planned.map((a) => a.uid));
  return [...pruneAnims(active, now).filter((a) => !replaced.has(a.uid)), ...planned];
}

/**
 * El layout más lo que se está guardando (para dibujarlo mientras se desvanece en su lugar y a su
 * profundidad). Si no se va nada, devuelve el mismo layout.
 */
export function withLeaving(layout: RoomLayout, anims: readonly Anim[], now: number): RoomLayout {
  const extra: RoomItem[] = [];
  for (const a of anims) {
    if (!a.leaving || now - a.start >= a.dur) continue;
    const uid = a.leaving.uid;
    if (layout.items.some((it) => it.uid === uid) || extra.some((it) => it.uid === uid)) continue;
    extra.push(a.leaving);
  }
  return extra.length ? { ...layout, items: [...layout.items, ...extra] } : layout;
}

// ── Planes ───────────────────────────────────────────────────────────────────────────────────

const key = (at: number, p: Partial<Pose> = {}): Key => ({ ...REST, ...p, at });

/** Altura en el paso `j` de `n` de una caída de `h` px (4 → 2 → 1): frena al llegar, sin rebote. */
const dropAt = (h: number, j: number, n: number) => Math.trunc((h * (n - j)) / n);

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const round = (o: Offset): Offset => ({ dx: Math.round(o.dx) || 0, dy: Math.round(o.dy) || 0 });

/** Espera entre un objeto y el siguiente en la entrada con detalles: 35 ms, o menos si son muchos. */
export function introStagger(count: number) {
  if (count < 2) return 0;
  return Math.min(INTRO_STAGGER_MS, Math.floor((INTRO_MAX_MS - INTRO_ITEM_MS) / (count - 1)));
}

/**
 * El cuarto aparece al montar. Con detalles, los objetos de atrás hacia adelante (el orden de
 * `drawList`, de `buildDrawList`): cada uno cae 4 px y se enciende a saltos; piso y paredes ya están.
 * Tranquilo: todo el cuarto con un fundido (`Sample.room`). Reducido: nada. `except`: lo que entra
 * por su cuenta (lo recién ganado, con `planEnter` al terminar: `endTime(intro, now)`).
 */
export function planIntro(drawList: readonly DrawItem[], level: Level, now: number, except: readonly string[] = []): Anim[] {
  if (level === 'reduced') return [];
  if (level === 'calm') {
    return [{ uid: ROOM, kind: 'intro', start: now, dur: CALM_INTRO_MS, ease: 'out', keys: [key(0, { alpha: 0 })] }];
  }
  const skip = new Set(except);
  const uids: string[] = [];
  for (const d of drawList) {
    if (d.uid && !skip.has(d.uid)) {
      skip.add(d.uid);
      uids.push(d.uid);
    }
  }
  const gap = introStagger(uids.length);
  const step = INTRO_ITEM_MS / INTRO_STEPS;
  const keys = range(INTRO_STEPS).map((j) =>
    key(j * step, { lift: dropAt(INTRO_DROP, j, INTRO_STEPS), alpha: (j + 1) / INTRO_STEPS }),
  );
  return uids.map((uid, i) => ({
    uid,
    kind: 'intro',
    start: now + i * gap,
    dur: INTRO_ITEM_MS,
    ease: 'steps',
    keys,
    wait: HIDDEN,
  }));
}

/**
 * Lo recién ganado aparece (igual haya ayudado o no). Con detalles, su sombra se enciende en 2
 * saltos mientras él cae de 5 px a 0 en 4 y toca el piso a los `ENTER_LAND_MS`. Tranquilo: fundido
 * con 2 px de caída. Reducido: fundido.
 */
export function planEnter(uid: string, level: Level, now: number): Anim[] {
  if (level !== 'detailed') {
    const calm = level === 'calm';
    return [
      {
        uid,
        kind: 'enter',
        start: now,
        dur: calm ? CALM_ENTER_MS : REDUCED_ENTER_MS,
        ease: 'out',
        keys: [key(0, { alpha: 0, lift: calm ? CALM_ENTER_DROP : 0 })],
        wait: HIDDEN,
      },
    ];
  }
  const step = ENTER_MS / ENTER_STEPS;
  const keys = range(ENTER_STEPS).map((j) =>
    key(j * step, {
      lift: dropAt(ENTER_DROP, j, ENTER_STEPS),
      alpha: (j + 1) / ENTER_STEPS,
      shadow: Math.ceil(((j + 1) * ENTER_SHADOW_STEPS) / ENTER_STEPS) / ENTER_SHADOW_STEPS,
    }),
  );
  return [{ uid, kind: 'enter', start: now, dur: ENTER_MS, ease: 'steps', keys, wait: HIDDEN }];
}

/**
 * Algo vuelve al cuarto desde "Tus cosas" (o al deshacer un guardado): lo mismo que guardar, al
 * revés. Con detalles aparece levantado 2 px en 3 saltos y baja; tranquilo, fundido; reducido, ya está.
 */
export function planAdd(uid: string, level: Level, now: number): Anim[] {
  if (level === 'reduced') return [];
  if (level === 'calm') {
    return [{ uid, kind: 'add', start: now, dur: CALM_FADE_MS, ease: 'out', keys: [key(0, { alpha: 0 })], wait: HIDDEN }];
  }
  const step = STORE_MS / STORE_STEPS;
  const keys = range(STORE_STEPS).map((j) =>
    key(j * step, { lift: STORE_LIFT, alpha: (j + 1) / STORE_STEPS, shadow: (j + 1) / STORE_STEPS }),
  );
  return [{ uid, kind: 'add', start: now, dur: STORE_MS, ease: 'steps', keys, wait: HIDDEN }];
}

/** Casillas `(cx, cy)` de un desfase en px de arte del piso, o `null` si no son casillas enteras. */
export function offsetCells(o: Offset) {
  const cx = (o.dx / (TILE_W / 2) + o.dy / (TILE_H / 2)) / 2;
  const cy = (o.dy / (TILE_H / 2) - o.dx / (TILE_W / 2)) / 2;
  return Number.isInteger(cx) && Number.isInteger(cy) ? { cx, cy } : null;
}

/** Desfases tras cada paso por la rejilla: una casilla por paso, primero a lo largo de x y luego de y. */
function gridPath(o: Offset): Offset[] | null {
  const cells = offsetCells(o);
  if (!cells) return null;
  let { cx, cy } = cells;
  const out: Offset[] = [];
  while (cx || cy) {
    if (cx) cx -= Math.sign(cx);
    else cy -= Math.sign(cy);
    const p = cellToArt(cx, cy);
    out.push({ dx: p.ax || 0, dy: p.ay || 0 });
  }
  return out;
}

/** Desfases tras cada paso de un deslizamiento recto (pared y superficie): uno cada 16 px, hasta 4. */
function slidePath(o: Offset): Offset[] {
  const n = Math.min(SLIDE_MAX_STEPS, Math.max(1, Math.ceil(Math.max(Math.abs(o.dx), Math.abs(o.dy)) / (TILE_W / 2))));
  return range(n).map((i) => ({
    dx: Math.trunc((o.dx * (n - i - 1)) / n) || 0,
    dy: Math.trunc((o.dy * (n - i - 1)) / n) || 0,
  }));
}

/**
 * La persona movió un objeto (flechas, tocar la casilla o soltarlo). `from`: dónde se veía su punto
 * de apoyo respecto del nuevo, en px de arte. Con detalles es un salto de pixel: sube 2 px, avanza
 * por la rejilla del piso una casilla por paso (`grid`, si `from` son casillas enteras; si no, en
 * línea recta) con su sombra abajo, y baja. Tranquilo: se desliza 120 ms. Reducido: al instante.
 * `dropped`: ya está bajo el dedo (se soltó arrastrando); con detalles solo baja 2 px.
 */
export function planMove(
  uid: string,
  from: Offset,
  level: Level,
  now: number,
  opts: { grid?: boolean; dropped?: boolean } = {},
): Anim[] {
  if (level === 'reduced') return [];
  const lifted = { lift: HOP_LIFT, shadow: 1 };
  if (opts.dropped) {
    if (level === 'calm') return [];
    return [{ uid, kind: 'move', start: now, dur: HOP_STEP_MS, ease: 'steps', keys: [key(0, lifted)] }];
  }
  const o = round(from);
  if (!o.dx && !o.dy) return [];
  if (level === 'calm') {
    return [{ uid, kind: 'move', start: now, dur: CALM_SLIDE_MS, ease: 'out', keys: [key(0, o)] }];
  }
  const path = (opts.grid && gridPath(o)) || slidePath(o);
  const step = Math.min(HOP_STEP_MS, Math.floor(HOP_TRAVEL_MAX_MS / path.length));
  const keys = [key(0, { ...o, ...lifted }), ...path.map((p, i) => key(HOP_STEP_MS + i * step, { ...p, ...lifted }))];
  return [{ uid, kind: 'move', start: now, dur: HOP_STEP_MS + path.length * step, ease: 'steps', keys }];
}

/**
 * Giró. Con detalles sube 1 px con el cuadro de antes (`from.frame`, en su lugar de antes: `from`
 * es la esquina de ese cuadro respecto de la del nuevo), cambia de cuadro y baja. Si no, al instante.
 */
export function planRotate(uid: string, from: Offset & { frame: string }, level: Level, now: number): Anim[] {
  if (level !== 'detailed') return [];
  const o = round(from);
  const step = ROTATE_MS / ROTATE_STEPS;
  const keys = [key(0, { ...o, lift: ROTATE_LIFT, frame: from.frame }), key(step, { lift: ROTATE_LIFT })];
  return [{ uid, kind: 'rotate', start: now, dur: ROTATE_MS, ease: 'steps', keys }];
}

/**
 * Se guarda en "Tus cosas" (`item`: como estaba). Con detalles sube 2 px y se apaga en 3 saltos;
 * tranquilo, fundido; reducido, al instante. Mientras dura, `withLeaving` lo sigue dibujando.
 */
export function planStore(item: RoomItem, level: Level, now: number): Anim[] {
  if (level === 'reduced') return [];
  const uid = item.uid;
  if (level === 'calm') {
    return [{ uid, kind: 'store', start: now, dur: CALM_FADE_MS, ease: 'out', keys: [key(0)], to: HIDDEN, leaving: item }];
  }
  const step = STORE_MS / STORE_STEPS;
  const keys = range(STORE_STEPS).map((j) => key(j * step, { lift: STORE_LIFT, alpha: (STORE_STEPS - j) / STORE_STEPS }));
  return [{ uid, kind: 'store', start: now, dur: STORE_MS, ease: 'steps', keys, leaving: item }];
}

// ── Cambios del layout ───────────────────────────────────────────────────────────────────────

/**
 * Lo que cambió entre dos layouts, para animarlo sin que el editor sepa de animaciones.
 * `riders`: lo que va encima de un anfitrión que se movió o giró y no cambió de lugar (lo acompaña).
 */
export type LayoutEvent =
  | { kind: 'moved'; uid: string; from: ItemPlace; to: ItemPlace; riders: string[] }
  | { kind: 'rotated'; uid: string; from: ItemPlace; to: ItemPlace; riders: string[] }
  | { kind: 'stored'; uid: string; item: RoomItem }
  | { kind: 'added'; uid: string; item: RoomItem };

/** Eventos de `prev` → `next` por uid: movido, girado (piso con otro `rot`), guardado (con cómo estaba) y agregado. */
export function diffLayouts(prev: RoomLayout, next: RoomLayout): LayoutEvent[] {
  if (prev === next) return [];
  const before = new Map(prev.items.map((it) => [it.uid, it] as const));
  const after = new Map(next.items.map((it) => [it.uid, it] as const));
  const riders = (host: string) =>
    next.items
      .filter((it) => {
        const was = before.get(it.uid);
        return it.place.on === 'surface' && it.place.host === host && !!was && samePlace(was.place, it.place);
      })
      .map((it) => it.uid);
  const out: LayoutEvent[] = [];
  for (const it of prev.items) {
    const now = after.get(it.uid);
    if (!now) {
      out.push({ kind: 'stored', uid: it.uid, item: it });
      continue;
    }
    if (samePlace(it.place, now.place)) continue;
    const turned = it.place.on === 'floor' && now.place.on === 'floor' && it.place.rot !== now.place.rot;
    out.push({ kind: turned ? 'rotated' : 'moved', uid: it.uid, from: it.place, to: now.place, riders: riders(it.uid) });
  }
  for (const it of next.items) if (!before.has(it.uid)) out.push({ kind: 'added', uid: it.uid, item: it });
  return out;
}

export type ChangeOptions = {
  /** Lo recién ganado (`entering` de la vista): entra con `planEnter` en vez de `planAdd`. */
  entering?: string | null;
  /** Lo que se acaba de soltar arrastrando (y lo que lleva encima): solo aterriza. */
  dropped?: string | null;
};

/**
 * Anima un cambio de layout: devuelve las animaciones activas más las de cada evento. Lo que
 * ya se estaba animando sigue desde donde se ve (sin saltos) y su animación anterior se reemplaza.
 * `prevList` y `nextList`: `buildDrawList` de cada layout, sin animar.
 */
export function animateChanges(
  active: readonly Anim[],
  events: readonly LayoutEvent[],
  prevList: readonly DrawItem[],
  nextList: readonly DrawItem[],
  manifest: Pick<Manifest, 'frames'>,
  level: Level,
  now: number,
  opts: ChangeOptions = {},
): Anim[] {
  const seen = sampleAnimations(active, now).items;
  const byUid = (list: readonly DrawItem[]) => {
    const map = new Map<string, DrawItem>();
    for (const d of list) if (d.uid && !map.has(d.uid)) map.set(d.uid, d);
    return map;
  };
  const before = byUid(prevList);
  const after = byUid(nextList);
  const anchor = (d: DrawItem) => {
    const f = Object.prototype.hasOwnProperty.call(manifest.frames, d.frame) ? manifest.frames[d.frame] : undefined;
    return { x: d.x + (f ? f.anchor[0] : 0), y: d.y + (f ? f.anchor[1] : 0) };
  };
  const touched = new Set<string>();
  const planned: Anim[] = [];
  for (const e of events) {
    touched.add(e.uid);
    if (e.kind === 'stored') {
      planned.push(...planStore(e.item, level, now));
      continue;
    }
    if (e.kind === 'added') {
      planned.push(...(e.uid === opts.entering ? planEnter(e.uid, level, now) : planAdd(e.uid, level, now)));
      continue;
    }
    const grid = e.from.on === 'floor' && e.to.on === 'floor';
    for (const uid of [e.uid, ...e.riders]) {
      touched.add(uid);
      const a = before.get(uid);
      const b = after.get(uid);
      if (!a || !b) continue;
      const cur = Object.prototype.hasOwnProperty.call(seen, uid) ? seen[uid] : REST;
      if (e.kind === 'rotated') {
        planned.push(...planRotate(uid, { dx: a.x - b.x + cur.dx, dy: a.y - b.y + cur.dy, frame: a.frame }, level, now));
      } else {
        const pa = anchor(a);
        const pb = anchor(b);
        const from = { dx: pa.x - pb.x + cur.dx, dy: pa.y - pb.y + cur.dy };
        planned.push(...planMove(uid, from, level, now, { grid, dropped: opts.dropped === e.uid }));
      }
    }
  }
  return [...pruneAnims(active, now).filter((a) => !touched.has(a.uid)), ...planned];
}
