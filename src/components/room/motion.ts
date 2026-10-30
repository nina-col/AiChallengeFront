import {
  animateChanges,
  endTime,
  mergeAnims,
  planEnter,
  planIntro,
  sameSample,
  sampleAnimations,
  STILL,
  type Anim,
  type ChangeOptions,
  type LayoutEvent,
  type Level,
  type Sample,
} from './anim';
import { MONITOR } from './depth';
import { samePlace, specOf } from './occupancy';
import type { DrawItem, ItemPlace, Manifest, RoomLayout } from './types';

/**
 * El movimiento de `RoomView` sin React (DESIGN.md §5, §11 y §12; tecnica.md §9–§10).
 *
 * Reloj propio: avanza solo mientras algo se mueve y el cuarto está a la vista (atlas cargado,
 * pantalla enfocada, app en primer plano). Lo que se planea (al montar, al cambiar el layout, al
 * soltar) empieza en `Motion.now`, el último instante que se vio: entre ese instante y el reloj
 * de la vista nada cambió en pantalla, así que nada salta. La vista vuelve a dibujar solo cuando
 * `stepMotion` devuelve otro objeto: cambió un pixel, un paso o un cuadro.
 *
 * El momento firma (§11): la onda del monitor pasa de ruidosa a tranquila en 3 cuadros (300 ms),
 * después de la entrada del cuarto si la hay, a la par de lo recién ganado. `Motion.cue` es cuándo
 * termina todo eso: ahí va el tono del resultado, nunca antes.
 */

/** Cada cuadro de la onda del monitor al calmarse. */
export const SETTLE_FRAME_MS = 150;
/** Ruidosa → media → tranquila. */
export const SETTLE_MS = 2 * SETTLE_FRAME_MS;

export type Motion = {
  /** Animaciones activas (`anim.ts`). Cambia de identidad cada vez que se planea algo. */
  anims: Anim[];
  /** Lo que se ve de ellas en `now`. */
  sample: Sample;
  /** Cuadro de la onda del monitor: 0 ruidosa, 1 media; `null`, tranquila. */
  wave: number | null;
  /** Desde cuándo se calma la onda (antes de eso se ve ruidosa); `null` si no se calma. */
  settleAt: number | null;
  /** Cuándo queda todo quieto tras llegar (onda tranquila, lo recién ganado en el piso); `null` si ya pasó o no aplica. */
  cue: number | null;
  /** El último instante que se vio, en el reloj de la vista. */
  now: number;
};

export const STILL_MOTION: Motion = { anims: [], sample: STILL, wave: null, settleAt: null, cue: null, now: 0 };

/** Cuadro de la onda en `clock`: ruidosa hasta `settleAt`, media 150 ms y luego tranquila (`null`). */
export function waveAt(settleAt: number | null, clock: number): number | null {
  if (settleAt === null) return null;
  const t = clock - settleAt;
  return t < SETTLE_FRAME_MS ? 0 : t < SETTLE_MS ? 1 : null;
}

/** Cuándo toca el piso `uid` si está entrando (`planEnter`); si no, `null`. */
export function landingTime(anims: readonly Anim[], uid: string | null | undefined): number | null {
  const enter = uid ? anims.find((a) => a.kind === 'enter' && a.uid === uid) : undefined;
  return enter ? enter.start + enter.dur : null;
}

/** ¿Queda algo por mover o por avisar? Si no, la vista no pide cuadros. */
export function isMoving(m: Motion) {
  return m.sample.running || m.wave !== null || m.cue !== null;
}

/**
 * Al montar, en el instante 0 del reloj. Con `intro`, la entrada del cuarto; al terminar ella, lo
 * recién ganado (`entering`, si está en el cuarto) entra y la onda se calma (`settle`, salvo con
 * movimiento reducido: ahí ya está tranquila). Con `settle` o `entering` hay un aviso (`cue`), uno
 * solo por montaje. `plain`: `buildDrawList` sin animar.
 */
export function mountMotion(
  plain: readonly DrawItem[],
  level: Level,
  opts: { intro?: boolean; entering?: string | null; settle?: boolean } = {},
): Motion {
  const entering = opts.entering && plain.some((d) => d.uid === opts.entering) ? opts.entering : null;
  const intro = opts.intro ? planIntro(plain, level, 0, entering ? [entering] : []) : [];
  const after = endTime(intro, 0);
  const anims = [...intro, ...(entering ? planEnter(entering, level, after) : [])];
  const settleAt = opts.settle && level !== 'reduced' ? after : null;
  const cue =
    opts.settle || opts.entering
      ? Math.max(after, settleAt === null ? 0 : settleAt + SETTLE_MS, landingTime(anims, entering) ?? 0)
      : null;
  return { anims, sample: sampleAnimations(anims, 0), wave: waveAt(settleAt, 0), settleAt, cue, now: 0 };
}

/**
 * El layout cambió (`diffLayouts`): cada evento se anima desde lo que se ve (`animateChanges`).
 * Si lo recién ganado llega así antes del aviso, el aviso espera a que toque el piso (nunca hay
 * dos). Sin eventos, la misma `Motion`.
 */
export function changeMotion(
  m: Motion,
  events: readonly LayoutEvent[],
  prevPlain: readonly DrawItem[],
  nextPlain: readonly DrawItem[],
  manifest: Pick<Manifest, 'frames'>,
  level: Level,
  opts: ChangeOptions = {},
): Motion {
  if (!events.length) return m;
  const anims = animateChanges(m.anims, events, prevPlain, nextPlain, manifest, level, m.now, opts);
  const arrived = events.some((e) => e.kind === 'added' && e.uid === opts.entering);
  const land = arrived ? landingTime(anims, opts.entering) : null;
  const cue = land === null || m.cue === null ? m.cue : Math.max(m.cue, land);
  return { ...m, anims, sample: sampleAnimations(anims, m.now), cue };
}

/** Suma lo planeado en `m.now` (el regreso de un arrastre que no se pudo soltar ahí). */
export function addMotion(m: Motion, planned: readonly Anim[]): Motion {
  if (!planned.length) return m;
  const anims = mergeAnims(m.anims, planned, m.now);
  return { ...m, anims, sample: sampleAnimations(anims, m.now) };
}

/** Tocar el cuarto lo "despierta": la onda vuelve a calmarse desde ruidosa. */
export function wakeMotion(m: Motion): Motion {
  return { ...m, anims: [...m.anims], wave: 0, settleAt: m.now };
}

/** Todo queda en reposo al instante (movimiento reducido gana siempre); el aviso, si falta, sigue en pie. */
export function stopMotion(m: Motion): Motion {
  if (!m.anims.length && m.wave === null) return m;
  return { ...m, anims: [], sample: STILL, wave: null, settleAt: null };
}

/**
 * El reloj llegó a `clock`. Devuelve la misma `Motion` si nada cambió a la vista (ni pose, ni
 * cuadro de la onda, ni el aviso), así la vista no vuelve a dibujar. Lo terminado se suelta.
 */
export function stepMotion(m: Motion, clock: number): Motion {
  const sample = sampleAnimations(m.anims, clock);
  const wave = waveAt(m.settleAt, clock);
  const cue = m.cue !== null && clock >= m.cue ? null : m.cue;
  if (wave === m.wave && cue === m.cue && sameSample(sample, m.sample)) return m;
  return {
    anims: sample.running || !m.anims.length ? m.anims : [],
    sample,
    wave,
    settleAt: wave === null ? null : m.settleAt,
    cue,
    now: clock,
  };
}

/** Lo que se soltó arrastrando, si este cambio lo puso justo ahí; si no, el cambio vino de otro lado. */
export function droppedUid(events: readonly LayoutEvent[], dropped: { uid: string; place: ItemPlace } | null): string | null {
  if (!dropped) return null;
  const e = events.find((ev) => ev.uid === dropped.uid);
  return e && (e.kind === 'moved' || e.kind === 'rotated') && samePlace(e.to, dropped.place) ? dropped.uid : null;
}

// ── Reposo con detalles ──────────────────────────────────────────────────────────────────────

/** Un cuadro de reposo cada 300 ms (tecnica.md §10) y la escena se mueve 5 s como mucho (WCAG 2.2.2). */
export const TICK_MS = 300;
export const ALIVE_MS = 5000;
/** Lo primero es la onda del monitor: nada más se mueve en los primeros 600 ms. */
export const FIRST_TICK = 2;
/** Pausa entre un movimiento y el siguiente. */
const PAUSE_TICKS = 2;
/** El último tick que se puede ocupar: todo vuelve al reposo antes de los 5 s. */
export const LAST_TICK = Math.floor(ALIVE_MS / TICK_MS) - 1;
/** Orden fijo (ventilador, vapor, saludo, plantas, parpadeo); otras animaciones van después. */
const ORDER = ['spin', 'steam', 'wave', 'sway', 'blink'];
/** El vapor y el saludo se ven mejor un poco más largos. */
const TICKS: Record<string, number> = { steam: 2, wave: 2 };

/** Un objeto que se mueve en reposo: muestra el cuadro 1 de su animación `name`. */
export type Twitch = { uid: string; name: string };

/**
 * Lo que puede moverse en reposo: cada objeto cuyo cuadro tiene `:${name}1` en el manifiesto, en
 * orden fijo por animación y de atrás hacia adelante. La onda del monitor no: es el momento firma.
 * `plain`: `buildDrawList` sin animar (con el cuadro de reposo de cada objeto).
 */
export function twitchCandidates(
  plain: readonly DrawItem[],
  layout: RoomLayout,
  manifest: Pick<Manifest, 'types' | 'frames'>,
): Twitch[] {
  const typeOf = new Map(layout.items.map((it) => [it.uid, it.type] as const));
  const seen = new Set<string>();
  const found: { uid: string; name: string; order: number; depth: number }[] = [];
  plain.forEach((d, depth) => {
    if (!d.uid || seen.has(d.uid)) return;
    seen.add(d.uid);
    const type = typeOf.get(d.uid);
    if (!type || type === MONITOR) return;
    for (const name of Object.keys(specOf(manifest, type)?.anim ?? {})) {
      if (!Object.prototype.hasOwnProperty.call(manifest.frames, `${d.frame}:${name}1`)) continue;
      const order = ORDER.indexOf(name);
      found.push({ uid: d.uid, name, order: order < 0 ? ORDER.length : order, depth });
    }
  });
  found.sort((a, b) => a.order - b.order || a.depth - b.depth || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return found.map(({ uid, name }) => ({ uid, name }));
}

/**
 * El primer tick libre tras la llegada que planeó `mountMotion` (entrada, onda, lo recién ganado),
 * con un tick de margen: el reposo nunca va a la par de ella.
 */
export function firstTwitchTick(m: Motion) {
  const end = Math.max(endTime(m.anims, 0), m.cue ?? 0, m.settleAt === null ? 0 : m.settleAt + SETTLE_MS);
  return end > 0 ? Math.max(FIRST_TICK, Math.ceil(end / TICK_MS) + 1) : FIRST_TICK;
}

/**
 * Tick (de 300 ms desde que la escena despierta) → quién se mueve: uno a la vez, cada uno una vez,
 * con pausas, desde `from` y todo antes de los 5 s. `round` (cuántas veces despertó) rota quién
 * empieza, para que con muchos objetos a cada uno le toque.
 */
export function twitchSchedule(candidates: readonly Twitch[], round = 0, from = FIRST_TICK): Record<number, Twitch> {
  const out: Record<number, Twitch> = {};
  const n = candidates.length;
  let tick = from;
  for (let i = 0; i < n; i++) {
    const c = candidates[(i + (round % n)) % n];
    const len = TICKS[c.name] ?? 1;
    if (tick + len - 1 > LAST_TICK) break;
    for (let j = 0; j < len; j++) out[tick + j] = c;
    tick += len + PAUSE_TICKS;
  }
  return out;
}
