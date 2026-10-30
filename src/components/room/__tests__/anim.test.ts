import {
  animateChanges,
  CALM_ENTER_MS,
  CALM_MAX_SHIFT,
  diffLayouts,
  easeOut,
  endTime,
  ENTER_LAND_MS,
  HOP_STEP_MS,
  HOP_TRAVEL_MAX_MS,
  INTRO_ITEM_MS,
  INTRO_MAX_MS,
  INTRO_STAGGER_MS,
  introStagger,
  MAX_MS,
  mergeAnims,
  offsetCells,
  planAdd,
  planEnter,
  planIntro,
  planMove,
  planRotate,
  planStore,
  REDUCED_ENTER_MS,
  ROOM,
  sameSample,
  sampleAnimations,
  STILL,
  withLeaving,
  type Anim,
  type Level,
  type Pose,
} from '../anim';
import { buildDrawList, type DrawOptions } from '../depth';
import { cellToArt } from '../iso';
import { move, moveTo, rotate, store } from '../occupancy';
import type { DrawItem, RoomLayout } from '../types';
import { manifest } from './fixtures/manifest';
import { deepFreeze, floor, item, rng, room, surface, uid, wall } from './fixtures/rooms';

const LEVELS: Level[] = ['reduced', 'calm', 'detailed'];
const day: DrawOptions = { sky: 'day', owned: { blinds: false, dim: false } };
const T0 = 1000;

/** Escritorio con pantalla y planta encima, silla, cuadro en la pared y alfombra. */
const base = deepFreeze(
  room([
    item('desk', 'desk', floor(1, 0)),
    item('mon', 'monitor', surface(uid('desk'), 0)),
    item('plant', 'plant', surface(uid('desk'), 1)),
    item('chair', 'chair', floor(1, 1, 2)),
    item('frame', 'frame', wall('left', 1, 1)),
    item('rug', 'rug', floor(2, 2)),
  ]),
);
const draw = (layout: RoomLayout) => buildDrawList(layout, manifest, day);

/** Pose de un objeto en una animación sola, a `t` ms de su inicio; `null` = en reposo (o ya no está). */
function poseAt(a: Anim, t: number): Pose | null {
  const s = sampleAnimations([a], a.start + t);
  if (a.uid === ROOM) return s.running ? { dx: 0, dy: 0, lift: 0, alpha: s.room, shadow: 0 } : null;
  return s.items[a.uid] ?? null;
}

/** Cada valor solo se acerca a su destino: nunca cambia de dirección. */
function monotone(values: number[]) {
  let dir = 0;
  for (let i = 1; i < values.length; i++) {
    const d = Math.sign(values[i] - values[i - 1]);
    if (!d) continue;
    if (dir && d !== dir) return false;
    dir = d;
  }
  return true;
}

/** Muchas animaciones de cada tipo, con desfases al azar. */
function plans(level: Level, seed: number): Anim[] {
  const rand = rng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const out: Anim[] = [
    ...planIntro(draw(base), level, T0),
    ...planEnter('enter000', level, T0),
    ...planAdd('add00000', level, T0),
    ...planStore(item('stored', 'chair', floor(0, 0)), level, T0),
    ...planRotate('rot00000', { dx: 3, dy: -5, frame: 'chair.sage.r1' }, level, T0),
    ...planMove('drop0000', { dx: 0, dy: 0 }, level, T0, { dropped: true }),
  ];
  for (let i = 0; i < 150; i++) {
    const c = cellToArt(int(-7, 7), int(-7, 7));
    out.push(...planMove(`grid${i}`, { dx: c.ax, dy: c.ay }, level, T0, { grid: true }));
    out.push(...planMove(`slide${i}`, { dx: int(-120, 120), dy: int(-120, 120) }, level, T0));
    out.push(...planMove(`odd${i}`, { dx: int(-40, 40), dy: int(-40, 40) }, level, T0, { grid: true }));
  }
  return out;
}

describe('propiedad: toda animación', () => {
  it.each(LEVELS)('%s: termina en reposo exacto, sin pasarse, en enteros y dentro de los topes', (level) => {
    const anims = plans(level, 20261030 + LEVELS.indexOf(level));
    if (level === 'reduced') expect(anims.map((a) => a.kind).sort()).toEqual(['enter']);
    const problems: string[] = [];
    const fail = (a: Anim, what: string) => problems.length < 8 && problems.push(`${a.kind} ${a.uid}: ${what}`);
    for (const a of anims) {
      if (a.dur > MAX_MS[level]) fail(a, `dura ${a.dur} ms`);
      if (level === 'detailed' && a.ease !== 'steps') fail(a, 'con detalles va a saltos');
      if (level !== 'detailed' && a.ease !== 'out') fail(a, 'sin detalles es suave');
      // Al terminar: reposo exacto (lo guardado ya no se dibuja).
      const end = sampleAnimations([a], a.start + a.dur);
      if (end.running || Object.keys(end.items).length || end.room !== 1) fail(a, 'no termina en reposo');
      const trace: Pose[] = [];
      for (let t = 0; t < a.dur; t++) trace.push(poseAt(a, t)!);
      if (trace.some((p) => !p)) fail(a, 'falta una pose antes de terminar');
      for (const p of trace) {
        if (![p.dx, p.dy, p.lift].every(Number.isInteger)) fail(a, `pixeles no enteros ${JSON.stringify(p)}`);
        if (p.alpha < 0 || p.alpha > 1 || p.shadow < 0 || p.shadow > 1) fail(a, 'opacidad fuera de 0–1');
        if (p.shadow > 0 && p.lift <= 0) fail(a, 'sombra sin estar levantado');
        if (level === 'reduced' && (p.dx || p.dy || p.lift || p.frame)) fail(a, 'reducido desplaza');
        if (level === 'calm' && a.kind !== 'move') {
          if (Math.abs(p.dx) > CALM_MAX_SHIFT || Math.abs(p.dy) > CALM_MAX_SHIFT || p.lift > CALM_MAX_SHIFT) fail(a, 'tranquilo se mueve de más');
        }
      }
      // Nunca se pasa: cada canal va en una sola dirección hasta su destino.
      const leaving = a.kind === 'store';
      const lifts = trace.map((p) => p.lift);
      const alphas = trace.map((p) => p.alpha);
      if (!monotone(leaving ? lifts : [...lifts, 0])) fail(a, `la altura rebota ${lifts}`);
      if (!monotone([...alphas, leaving ? 0 : 1])) fail(a, 'la opacidad rebota');
      // La posición se acerca a su lugar por la rejilla (casillas) o en línea recta (px de arte).
      const cells = trace.map((p) => offsetCells(p));
      if (cells.every((c) => c)) {
        if (!monotone([...cells.map((c) => c!.cx), 0]) || !monotone([...cells.map((c) => c!.cy), 0])) fail(a, 'la rejilla rebota');
      } else if (!monotone([...trace.map((p) => p.dx), 0]) || !monotone([...trace.map((p) => p.dy), 0])) {
        fail(a, 'el desliz rebota');
      }
      // Con detalles, lo que hace la persona se ve en el primer cuadro.
      if (level === 'detailed' && ['move', 'rotate', 'store', 'add'].includes(a.kind) && trace[0].lift === 0) fail(a, 'no responde enseguida');
    }
    expect(problems).toEqual([]);
    // Toda la entrada cabe en el tope del nivel.
    const intro = anims.filter((a) => a.kind === 'intro');
    if (intro.length) expect(endTime(intro) - T0).toBeLessThanOrEqual(level === 'detailed' ? INTRO_MAX_MS : MAX_MS[level]);
  });

  it('la curva de salida crece de 0 a 1 sin pasarse', () => {
    const values = Array.from({ length: 1001 }, (_, i) => easeOut(i / 1000));
    expect(values[0]).toBe(0);
    expect(values[1000]).toBe(1);
    expect(monotone(values)).toBe(true);
    expect(values.every((v) => v >= 0 && v <= 1)).toBe(true);
    // bezier(0.23, 1, 0.32, 1): a la mitad del tiempo ya va en ~97 %.
    expect(easeOut(0.5)).toBeGreaterThan(0.95);
    expect(easeOut(0.5)).toBeLessThan(0.98);
  });
});

describe('entrada del cuarto', () => {
  const list = draw(base);
  const order = list.filter((d) => d.uid).map((d) => d.uid!);

  it('con detalles: de atrás hacia adelante, cada uno cae 4 px y se enciende en 3 saltos', () => {
    const anims = planIntro(list, 'detailed', T0);
    expect(anims.map((a) => a.uid)).toEqual(order);
    expect(anims.map((a) => a.start - T0)).toEqual(order.map((_, i) => i * INTRO_STAGGER_MS));
    const a = anims[2];
    expect([0, 59, 60, 120, 179].map((t) => poseAt(a, t)).map((p) => [p!.lift, p!.alpha])).toEqual([
      [4, 1 / 3],
      [4, 1 / 3],
      [2, 2 / 3],
      [1, 1],
      [1, 1],
    ]);
    expect(poseAt(a, INTRO_ITEM_MS)).toBeNull();
    // Mientras espera su turno no se ve.
    expect(sampleAnimations(anims, T0).items[order[3]].alpha).toBe(0);
  });

  it('con muchos objetos la espera se acorta y todo termina en 600 ms', () => {
    expect(introStagger(1)).toBe(0);
    expect(introStagger(13)).toBe(INTRO_STAGGER_MS);
    expect(introStagger(14)).toBe(32);
    expect(introStagger(60)).toBe(7);
    for (let n = 1; n <= 60; n++) {
      const fake: DrawItem[] = Array.from({ length: n }, (_, i) => ({ frame: 'chair.sage.r0', x: 0, y: 0, uid: String(i).padStart(8, '0') }));
      const anims = planIntro(fake, 'detailed', T0);
      expect(anims).toHaveLength(n);
      expect(endTime(anims) - T0).toBeLessThanOrEqual(INTRO_MAX_MS);
    }
  });

  it('lo recién ganado no entra con los demás', () => {
    const anims = planIntro(list, 'detailed', T0, [uid('plant')]);
    expect(anims.map((a) => a.uid)).toEqual(order.filter((u) => u !== uid('plant')));
  });

  it('tranquilo: todo el cuarto con un fundido de 200 ms; reducido: nada', () => {
    const [a, ...rest] = planIntro(list, 'calm', T0);
    expect(rest).toEqual([]);
    expect(a.uid).toBe(ROOM);
    const rooms = Array.from({ length: 200 }, (_, t) => sampleAnimations([a], T0 + t).room);
    expect(rooms[0]).toBe(0);
    expect(monotone(rooms)).toBe(true);
    expect(sampleAnimations([a], T0 + 200)).toEqual(STILL);
    expect(planIntro(list, 'reduced', T0)).toEqual([]);
  });
});

describe('lo recién ganado', () => {
  it('con detalles: la sombra en 2 saltos, cae 5 → 0 en 4 y toca el piso a los ENTER_LAND_MS', () => {
    const [a] = planEnter('newitem0', 'detailed', T0);
    const poses = [0, 80, 160, 240].map((t) => poseAt(a, t)!);
    expect(poses.map((p) => p.lift)).toEqual([5, 3, 2, 1]);
    expect(poses.map((p) => p.alpha)).toEqual([0.25, 0.5, 0.75, 1]);
    expect(poses.map((p) => p.shadow)).toEqual([0.5, 0.5, 1, 1]);
    let landed = 0;
    while (poseAt(a, landed)) landed++;
    expect(landed).toBe(ENTER_LAND_MS);
  });

  it('toca el piso a su hora en cada nivel (ahí va el tono del resultado)', () => {
    const land: Record<Level, number> = { detailed: ENTER_LAND_MS, calm: CALM_ENTER_MS, reduced: REDUCED_ENTER_MS };
    for (const level of LEVELS) expect(endTime(planEnter('newitem0', level, T0)) - T0).toBe(land[level]);
    const [calm] = planEnter('newitem0', 'calm', T0);
    expect(poseAt(calm, 0)).toMatchObject({ lift: 2, alpha: 0 });
    const [reduced] = planEnter('newitem0', 'reduced', T0);
    expect(poseAt(reduced, 0)).toMatchObject({ lift: 0, alpha: 0 });
  });

  it('puede esperar a que termine la entrada del cuarto, sin verse', () => {
    const intro = planIntro(draw(base), 'detailed', T0, [uid('plant')]);
    const [a] = planEnter(uid('plant'), 'detailed', endTime(intro, T0));
    expect(sampleAnimations([...intro, a], T0 + 10).items[uid('plant')].alpha).toBe(0);
  });
});

describe('mover', () => {
  it('con detalles: sube 2 px, avanza una casilla cada 60 ms por la rejilla (x y luego y) y baja', () => {
    const c = cellToArt(2, -1); // estaba 2 casillas atrás en x y una adelante en y
    const [a] = planMove('chair000', { dx: c.ax, dy: c.ay }, 'detailed', T0, { grid: true });
    const cells = [0, 60, 120, 180].map((t) => poseAt(a, t)!).map((p) => offsetCells(p));
    expect(cells).toEqual([
      { cx: 2, cy: -1 },
      { cx: 1, cy: -1 },
      { cx: 0, cy: -1 },
      { cx: 0, cy: 0 },
    ]);
    expect([0, 60, 180].map((t) => poseAt(a, t)!.lift)).toEqual([2, 2, 2]);
    expect(poseAt(a, 0)!.shadow).toBe(1);
    expect(a.dur).toBe(HOP_STEP_MS * 4);
    expect(poseAt(a, a.dur)).toBeNull();
  });

  it('un recorrido largo cabe en 240 ms', () => {
    const c = cellToArt(7, 7);
    const [a] = planMove('chair000', { dx: c.ax, dy: c.ay }, 'detailed', T0, { grid: true });
    expect(a.dur - HOP_STEP_MS).toBeLessThanOrEqual(HOP_TRAVEL_MAX_MS);
    expect(a.keys).toHaveLength(1 + 14);
  });

  it('pared y superficie se deslizan en línea recta', () => {
    const [a] = planMove('frame000', { dx: -48, dy: 24 }, 'detailed', T0);
    expect(a.keys.map((k) => [k.dx, k.dy])).toEqual([
      [-48, 24],
      [-32, 16],
      [-16, 8],
      [0, 0],
    ]);
  });

  it('tranquilo: se desliza 120 ms; reducido: al instante; nada que mover, nada', () => {
    const [a] = planMove('chair000', { dx: 16, dy: 8 }, 'calm', T0);
    expect(a.dur).toBe(120);
    expect(poseAt(a, 0)).toMatchObject({ dx: 16, dy: 8, lift: 0 });
    expect(planMove('chair000', { dx: 16, dy: 8 }, 'reduced', T0)).toEqual([]);
    expect(planMove('chair000', { dx: 0, dy: 0 }, 'detailed', T0)).toEqual([]);
  });

  it('al soltar arrastrando ya está bajo el dedo: con detalles solo baja 2 px', () => {
    const [a] = planMove('chair000', { dx: 16, dy: 8 }, 'detailed', T0, { dropped: true });
    expect(a.dur).toBe(HOP_STEP_MS);
    expect(poseAt(a, 0)).toMatchObject({ dx: 0, dy: 0, lift: 2 });
    expect(planMove('chair000', { dx: 16, dy: 8 }, 'calm', T0, { dropped: true })).toEqual([]);
  });
});

describe('girar y guardar', () => {
  it('girar con detalles: sube 1 px con el cuadro de antes, cambia y baja (100 ms)', () => {
    const [a] = planRotate('chair000', { dx: 2, dy: -3, frame: 'chair.sage.r2' }, 'detailed', T0);
    expect(poseAt(a, 0)).toEqual({ dx: 2, dy: -3, lift: 1, alpha: 1, shadow: 0, frame: 'chair.sage.r2' });
    expect(poseAt(a, 50)).toEqual({ dx: 0, dy: 0, lift: 1, alpha: 1, shadow: 0 });
    expect(poseAt(a, 100)).toBeNull();
    expect(planRotate('chair000', { dx: 2, dy: -3, frame: 'x' }, 'calm', T0)).toEqual([]);
  });

  it('guardar con detalles: sube 2 px y se apaga en 3 saltos; se sigue dibujando mientras tanto', () => {
    const chair = base.items[3];
    const { layout } = store(base, chair.uid);
    const [a] = planStore(chair, 'detailed', T0);
    expect([0, 60, 120].map((t) => poseAt(a, t)!).map((p) => [p.lift, p.alpha])).toEqual([
      [2, 1],
      [2, 2 / 3],
      [2, 1 / 3],
    ]);
    expect(withLeaving(layout, [a], T0 + 179).items.map((it) => it.uid)).toContain(chair.uid);
    expect(withLeaving(layout, [a], T0 + 180)).toBe(layout);
    const [calm] = planStore(chair, 'calm', T0);
    expect(calm.dur).toBe(150);
    expect(planStore(chair, 'reduced', T0)).toEqual([]);
  });

  it('sacar de "Tus cosas" es guardar al revés', () => {
    const [a] = planAdd('lamp0000', 'detailed', T0);
    expect([0, 60, 120].map((t) => poseAt(a, t)!).map((p) => [p.lift, p.alpha])).toEqual([
      [2, 1 / 3],
      [2, 2 / 3],
      [2, 1],
    ]);
    expect(planAdd('lamp0000', 'reduced', T0)).toEqual([]);
  });
});

describe('muestras y lista activa', () => {
  it('sameSample solo cambia cuando cambia un pixel o un paso', () => {
    const [a] = planEnter('newitem0', 'detailed', T0);
    expect(sameSample(sampleAnimations([a], T0 + 1), sampleAnimations([a], T0 + 79))).toBe(true);
    expect(sameSample(sampleAnimations([a], T0 + 79), sampleAnimations([a], T0 + 80))).toBe(false);
    expect(sameSample(sampleAnimations([a], T0 + 400), STILL)).toBe(true);
  });

  it('mergeAnims reemplaza las del mismo objeto y quita las terminadas', () => {
    const old = planMove('chair000', { dx: 16, dy: 8 }, 'detailed', T0);
    const done = planEnter('newitem0', 'detailed', T0 - 1000);
    const next = planStore(item('chair', 'chair', floor(0, 0)), 'detailed', T0 + 10);
    const merged = mergeAnims([...old, ...done], next, T0 + 10);
    expect(merged).toEqual(next);
  });
});

describe('diffLayouts', () => {
  const events = (next: RoomLayout) => diffLayouts(base, next);
  const ok = (r: { ok: boolean; layout?: RoomLayout }) => {
    if (!r.ok || !r.layout) throw new Error('cambio no válido');
    return r.layout;
  };

  it('el mismo layout (o uno igual) no tiene eventos', () => {
    expect(diffLayouts(base, base)).toEqual([]);
    expect(diffLayouts(base, JSON.parse(JSON.stringify(base)))).toEqual([]);
    // Cambiar de variante deja el objeto en su lugar.
    const recolored = { ...base, items: base.items.map((it) => (it.type === 'chair' ? { ...it, variant: 'other' } : it)) };
    expect(diffLayouts(base, recolored)).toEqual([]);
  });

  it('mover, con lo de encima del anfitrión', () => {
    expect(events(ok(move(base, manifest, uid('chair'), '+x')))).toEqual([
      { kind: 'moved', uid: uid('chair'), from: floor(1, 1, 2), to: floor(2, 1, 2), riders: [] },
    ]);
    expect(events(ok(move(base, manifest, uid('desk'), '+x')))).toEqual([
      { kind: 'moved', uid: uid('desk'), from: floor(1, 0), to: floor(2, 0), riders: [uid('mon'), uid('plant')] },
    ]);
    expect(events(ok(moveTo(base, manifest, uid('plant'), floor(4, 4))))).toEqual([
      { kind: 'moved', uid: uid('plant'), from: surface(uid('desk'), 1), to: floor(4, 4), riders: [] },
    ]);
  });

  it('girar (aunque se corra dentro de su huella)', () => {
    const next = ok(rotate(base, manifest, uid('desk')));
    const to = next.items.find((it) => it.uid === uid('desk'))!.place;
    expect(to).toEqual(floor(2, 0, 1)); // la silla tapa (1, 1): se corre a x = 2
    expect(events(next)).toEqual([
      { kind: 'rotated', uid: uid('desk'), from: floor(1, 0, 0), to, riders: [uid('mon'), uid('plant')] },
    ]);
  });

  it('guardar (con lo de encima) y volver a poner', () => {
    const { layout, stored } = store(base, uid('desk'));
    expect(events(layout)).toEqual(stored.map((it) => ({ kind: 'stored', uid: it.uid, item: it })));
    expect(diffLayouts(layout, base).map((e) => [e.kind, e.uid])).toEqual([
      ['added', uid('desk')],
      ['added', uid('mon')],
      ['added', uid('plant')],
    ]);
  });
});

describe('animateChanges', () => {
  const plan = (next: RoomLayout, level: Level, now = T0, active: Anim[] = [], opts = {}) =>
    animateChanges(active, diffLayouts(base, next), draw(base), draw(next), manifest, level, now, opts);
  const moved = (() => {
    const r = move(base, manifest, uid('desk'), '+x');
    return r.ok ? r.layout : base;
  })();

  it('el anfitrión y lo de encima saltan juntos por la misma rejilla', () => {
    const anims = plan(moved, 'detailed');
    expect(anims.map((a) => a.uid)).toEqual([uid('desk'), uid('mon'), uid('plant')]);
    const path = (a: Anim) => a.keys.map((k) => [k.at, k.dx, k.dy, k.lift]);
    expect(path(anims[1])).toEqual(path(anims[0]));
    expect(path(anims[0])).toEqual([
      [0, -16, -8, 2],
      [60, 0, 0, 2],
    ]);
  });

  it('se ve donde estaba y llega a su lugar nuevo', () => {
    const before = draw(base).find((d) => d.uid === uid('chair'))!;
    const r = move(base, manifest, uid('chair'), '+y');
    const next = r.ok ? r.layout : base;
    const after = draw(next).find((d) => d.uid === uid('chair'))!;
    for (const level of ['calm', 'detailed'] as Level[]) {
      const s = sampleAnimations(plan(next, level), T0);
      const p = s.items[uid('chair')];
      expect([after.x + p.dx, after.y + p.dy]).toEqual([before.x, before.y]);
    }
  });

  it('un cambio a media animación sigue desde donde se ve', () => {
    const first = move(base, manifest, uid('chair'), '+x');
    if (!first.ok) throw new Error('no se movió');
    const one = first.layout;
    const second = move(one, manifest, uid('chair'), '+y');
    if (!second.ok) throw new Error('no se movió');
    for (const level of ['calm', 'detailed'] as Level[]) {
      const active = plan(one, level);
      const t = T0 + 40;
      const seen = sampleAnimations(active, t).items[uid('chair')];
      const was = draw(one).find((d) => d.uid === uid('chair'))!;
      const next = animateChanges(active, diffLayouts(one, second.layout), draw(one), draw(second.layout), manifest, level, t);
      const now = sampleAnimations(next, t).items[uid('chair')];
      const is = draw(second.layout).find((d) => d.uid === uid('chair'))!;
      expect(next.filter((a) => a.uid === uid('chair'))).toHaveLength(1);
      expect([is.x + now.dx, is.y + now.dy]).toEqual([was.x + seen.dx, was.y + seen.dy]);
    }
  });

  it('girar al instante cancela lo que quedaba de otra animación de ese objeto', () => {
    const active = planMove(uid('chair'), { dx: 16, dy: 8 }, 'calm', T0);
    const r = rotate(base, manifest, uid('chair'));
    const next = r.ok ? r.layout : base;
    expect(plan(next, 'calm', T0 + 10, active)).toEqual([]);
    const detailed = plan(next, 'detailed', T0 + 10, active);
    expect(detailed.map((a) => [a.uid, a.kind])).toEqual([[uid('chair'), 'rotate']]);
    expect(detailed[0].keys[0].frame).toBe('chair.sage.r2');
  });

  it('lo recién ganado entra; lo que vuelve de "Tus cosas", como guardar al revés', () => {
    const lamp = item('lamp', 'lamp', floor(4, 4));
    const next = { ...base, items: [...base.items, lamp] };
    expect(plan(next, 'detailed', T0, [], { entering: lamp.uid }).map((a) => a.kind)).toEqual(['enter']);
    expect(plan(next, 'detailed').map((a) => a.kind)).toEqual(['add']);
  });

  it('al soltar arrastrando solo aterriza', () => {
    const r = moveTo(base, manifest, uid('chair'), floor(4, 4, 2));
    const next = r.ok ? r.layout : base;
    const [a] = plan(next, 'detailed', T0, [], { dropped: uid('chair') });
    expect(a.dur).toBe(HOP_STEP_MS);
    expect(plan(next, 'calm', T0, [], { dropped: uid('chair') })).toEqual([]);
  });

  it('guardar planea el desvanecido con el objeto que se va', () => {
    const { layout, stored } = store(base, uid('desk'));
    const anims = plan(layout, 'detailed');
    expect(anims.map((a) => a.leaving)).toEqual(stored);
    const drawn = withLeaving(layout, anims, T0 + 10);
    // Se dibuja como antes, en su lugar y a su profundidad.
    expect(draw(drawn).map((d) => d.uid)).toEqual(draw(base).map((d) => d.uid));
  });
});
