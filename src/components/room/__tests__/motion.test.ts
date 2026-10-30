import {
  CALM_ENTER_MS,
  CALM_INTRO_MS,
  diffLayouts,
  endTime,
  ENTER_LAND_MS,
  HOP_STEP_MS,
  planMove,
  REDUCED_ENTER_MS,
  ROOM,
  sameSample,
  type Level,
} from '../anim';
import { buildDrawList, MONITOR, type DrawOptions } from '../depth';
import { autoPlaceWithHost, defaultLayout, earnedTypes, uidMaker } from '../layout';
import { MANIFEST } from '../manifest';
import {
  addMotion,
  ALIVE_MS,
  changeMotion,
  droppedUid,
  FIRST_TICK,
  firstTwitchTick,
  isMoving,
  LAST_TICK,
  landingTime,
  mountMotion,
  SETTLE_FRAME_MS,
  SETTLE_MS,
  stepMotion,
  STILL_MOTION,
  stopMotion,
  TICK_MS,
  twitchCandidates,
  twitchSchedule,
  wakeMotion,
  waveAt,
  type Motion,
  type Twitch,
} from '../motion';
import { move, moveTo, store } from '../occupancy';
import type { RoomLayout } from '../types';
import { manifest } from './fixtures/manifest';
import { deepFreeze, floor, item, room, surface, uid, wall } from './fixtures/rooms';

const day: DrawOptions = { sky: 'day', owned: { blinds: false, dim: false } };
const draw = (layout: RoomLayout) => buildDrawList(layout, manifest, day);

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
const plain = draw(base);

/** ¿Cambió algo a la vista entre dos `Motion`? (lo que decide si la vista vuelve a dibujar). */
const visiblyDifferent = (a: Motion, b: Motion) => a.wave !== b.wave || a.cue !== b.cue || !sameSample(a.sample, b.sample);

/**
 * El reloj de `RoomView`: avanza a 60 cuadros por segundo mientras algo se mueve. Devuelve cada
 * `Motion` nueva (cada vez que la vista volvería a dibujar), cuántos cuadros pidió y cómo terminó.
 */
function play(start: Motion, frameMs = 1000 / 60, maxMs = 10_000) {
  const renders: Motion[] = [];
  let shown = start;
  let clock = start.now;
  let frames = 0;
  while (isMoving(shown) && clock - start.now < maxMs) {
    clock += frameMs;
    frames++;
    const next = stepMotion(shown, clock);
    if (next !== shown) {
      renders.push(next);
      shown = next;
    }
  }
  return { renders, frames, end: shown };
}

describe('al montar', () => {
  it('con detalles: la entrada, luego lo recién ganado y la onda a la par; el aviso cuando todo quedó quieto', () => {
    const m = mountMotion(plain, 'detailed', { intro: true, entering: uid('plant'), settle: true });
    const intro = m.anims.filter((a) => a.kind === 'intro');
    const after = endTime(intro, 0);
    expect(intro.map((a) => a.uid)).toEqual(plain.filter((d) => d.uid && d.uid !== uid('plant')).map((d) => d.uid));
    expect(m.anims.filter((a) => a.kind === 'enter')).toMatchObject([{ uid: uid('plant'), start: after }]);
    // La onda se ve ruidosa mientras el cuarto se arma y se calma al terminar.
    expect([m.settleAt, m.wave]).toEqual([after, 0]);
    expect(m.cue).toBe(after + ENTER_LAND_MS);

    const { renders, end } = play(m);
    expect(end).toMatchObject({ anims: [], wave: null, settleAt: null, cue: null, sample: { running: false } });
    // El aviso llega en el primer cuadro en que todo está quieto, nunca antes.
    const cued = renders.find((r) => r.cue === null)!;
    expect(cued.now).toBeGreaterThanOrEqual(after + ENTER_LAND_MS);
    expect(cued.now - (after + ENTER_LAND_MS)).toBeLessThan(17);
    expect(cued.wave).toBeNull();
    expect(cued.sample.items[uid('plant')]).toBeUndefined();
    for (const r of renders.filter((x) => x.now < after + ENTER_LAND_MS)) expect(r.cue).not.toBeNull();
  });

  it.each([
    ['calm', CALM_INTRO_MS, CALM_INTRO_MS + SETTLE_MS],
    ['reduced', 0, REDUCED_ENTER_MS],
  ] as [Level, number, number][])('%s: la entrada y la onda según el nivel', (level, after, cue) => {
    const m = mountMotion(plain, level, { intro: true, entering: uid('plant'), settle: true });
    expect(endTime(m.anims.filter((a) => a.kind === 'intro'), 0)).toBe(after);
    if (level === 'calm') {
      expect(m.anims.map((a) => a.uid)).toEqual([ROOM, uid('plant')]);
      expect(landingTime(m.anims, uid('plant'))).toBe(after + CALM_ENTER_MS);
    } else {
      // Reducido: sin entrada ni onda (ya está tranquila); lo nuevo, con un fundido.
      expect(m.anims.map((a) => a.kind)).toEqual(['enter']);
      expect([m.settleAt, m.wave]).toEqual([null, null]);
    }
    expect(m.cue).toBe(cue);
    expect(play(m).end).toMatchObject({ anims: [], wave: null, cue: null });
  });

  it('sin nada que hacer, quieto y sin pedir cuadros; lo que no está en el cuarto no entra', () => {
    expect(isMoving(mountMotion(plain, 'detailed'))).toBe(false);
    // Se pidió avisar: sin nada que esperar, el aviso llega en el primer cuadro.
    const m = mountMotion(plain, 'detailed', { entering: 'missing0' });
    expect([m.anims, m.cue]).toEqual([[], 0]);
    expect(play(m).renders.map((r) => r.cue)).toEqual([null]);
  });

  it('solo la onda: dos cuadros (media y tranquila) y el aviso al quedar tranquila', () => {
    const { renders } = play(mountMotion(plain, 'calm', { settle: true }));
    expect(renders.map((r) => [r.wave, r.cue])).toEqual([
      [1, SETTLE_MS],
      [null, null],
    ]);
    expect(renders[0].now).toBeGreaterThanOrEqual(SETTLE_FRAME_MS);
    expect(renders[1].now).toBeGreaterThanOrEqual(SETTLE_MS);
    // Con movimiento reducido la onda ya está tranquila: el aviso llega en el primer cuadro.
    const reduced = play(mountMotion(plain, 'reduced', { settle: true }));
    expect(reduced.renders.map((r) => [r.wave, r.cue])).toEqual([[null, null]]);
  });
});

describe('el reloj', () => {
  it('solo vuelve a dibujar cuando cambia algo a la vista', () => {
    for (const level of ['calm', 'detailed'] as Level[]) {
      const m = mountMotion(plain, level, { intro: true, entering: uid('plant'), settle: true });
      const { renders, frames } = play(m);
      let prev = m;
      for (const r of renders) {
        expect(visiblyDifferent(prev, r)).toBe(true);
        prev = r;
      }
      expect(renders.length).toBeLessThanOrEqual(frames);
    }
    // Lo recién ganado con detalles cambia cada 80 ms: en ~20 cuadros se dibuja 4 veces (3 pasos y el final).
    const enter = play(mountMotion(plain, 'detailed', { entering: uid('plant') }));
    expect(enter.frames).toBeGreaterThan(18);
    expect(enter.renders.length).toBe(4);
  });

  it('sin cambio a la vista, el mismo objeto', () => {
    const m = mountMotion(plain, 'detailed', { entering: uid('plant') });
    expect(stepMotion(m, 10)).toBe(m);
    expect(stepMotion(m, 79)).toBe(m);
    expect(stepMotion(m, 80)).not.toBe(m);
  });

  it('la onda: ruidosa hasta que empieza, media 150 ms y luego tranquila', () => {
    expect([-50, 0, 149, 150, 299, 300].map((t) => waveAt(0, t))).toEqual([0, 0, 0, 1, 1, null]);
    expect(waveAt(null, 0)).toBeNull();
  });
});

describe('cambios del layout', () => {
  it('sin eventos, la misma Motion; mover se anima desde donde se veía', () => {
    const m = STILL_MOTION;
    expect(changeMotion(m, [], plain, plain, manifest, 'calm')).toBe(m);
    const r = move(base, manifest, uid('chair'), '+x');
    if (!r.ok) throw new Error('no se movió');
    const next = r.layout;
    for (const level of ['calm', 'detailed'] as Level[]) {
      const changed = changeMotion(m, diffLayouts(base, next), plain, draw(next), manifest, level);
      const pose = changed.sample.items[uid('chair')];
      const before = plain.find((d) => d.uid === uid('chair'))!;
      const after = draw(next).find((d) => d.uid === uid('chair'))!;
      expect([after.x + pose.dx, after.y + pose.dy]).toEqual([before.x, before.y]);
      expect(play(changed).end.sample.running).toBe(false);
    }
  });

  it('lo recién ganado que llega en un cambio retrasa el aviso pendiente, y nunca hay dos', () => {
    const lamp = item('lamp', 'lamp', floor(4, 4));
    const next = { ...base, items: [...base.items, lamp] };
    const events = diffLayouts(base, next);
    const waiting = mountMotion(plain, 'detailed', { entering: lamp.uid });
    expect(waiting.cue).toBe(0);
    const m = changeMotion(waiting, events, plain, draw(next), manifest, 'detailed', { entering: lamp.uid });
    expect(m.anims.map((a) => a.kind)).toEqual(['enter']);
    expect(m.cue).toBe(ENTER_LAND_MS);
    // Si el aviso ya llegó, lo que entra después se anima sin otro aviso.
    expect(changeMotion(STILL_MOTION, events, plain, draw(next), manifest, 'detailed', { entering: lamp.uid }).cue).toBeNull();
  });

  it('lo que se soltó arrastrando solo aterriza, si el cambio lo puso justo ahí', () => {
    const place = floor(4, 4, 2);
    const r = moveTo(base, manifest, uid('chair'), place);
    if (!r.ok) throw new Error('no se movió');
    const events = diffLayouts(base, r.layout);
    expect(droppedUid(events, { uid: uid('chair'), place })).toBe(uid('chair'));
    expect(droppedUid(events, { uid: uid('chair'), place: floor(3, 4, 2) })).toBeNull();
    expect(droppedUid(events, { uid: uid('desk'), place })).toBeNull();
    expect(droppedUid(events, null)).toBeNull();
    const m = changeMotion(STILL_MOTION, events, plain, draw(r.layout), manifest, 'detailed', { dropped: uid('chair') });
    expect(m.anims.map((a) => [a.kind, a.dur])).toEqual([['move', HOP_STEP_MS]]);
  });

  it('guardar sigue dibujándose mientras se apaga', () => {
    const { layout } = store(base, uid('chair'));
    const m = changeMotion(STILL_MOTION, diffLayouts(base, layout), plain, draw(layout), manifest, 'calm');
    expect(m.anims.map((a) => a.kind)).toEqual(['store']);
    expect(play(m).end.anims).toEqual([]);
  });
});

describe('otras entradas', () => {
  it('addMotion suma lo planeado en el instante que se ve', () => {
    const m = { ...STILL_MOTION, now: 500 };
    expect(addMotion(m, [])).toBe(m);
    const back = planMove(uid('chair'), { dx: 32, dy: 16 }, 'detailed', 500, { grid: true });
    const added = addMotion(m, back);
    expect(added.anims).toEqual(back);
    expect(added.sample.items[uid('chair')]).toMatchObject({ dx: 32, dy: 16, lift: 2 });
  });

  it('despertar: la onda vuelve a calmarse desde ruidosa, y el reloj vuelve a empezar', () => {
    const m = { ...STILL_MOTION, now: 1000 };
    const woken = wakeMotion(m);
    expect(woken.anims).not.toBe(m.anims);
    expect([woken.wave, woken.settleAt, isMoving(woken)]).toEqual([0, 1000, true]);
    expect(play(woken).renders.map((r) => r.wave)).toEqual([1, null]);
  });

  it('movimiento reducido detiene todo al instante, pero el aviso sigue en pie', () => {
    const m = mountMotion(plain, 'detailed', { intro: true, entering: uid('plant'), settle: true });
    const stopped = stopMotion(m);
    expect(stopped).toMatchObject({ anims: [], wave: null, settleAt: null, cue: m.cue });
    expect(stopMotion(STILL_MOTION)).toBe(STILL_MOTION);
    expect(play(stopped).renders.map((r) => r.cue)).toEqual([null]);
  });
});

describe('reposo con detalles (manifiesto real)', () => {
  const owned = earnedTypes(MANIFEST, Object.values(MANIFEST.types).flatMap((t) => t.adjustments ?? []));
  const makeUid = uidMaker('reposo');
  let layout = defaultLayout('reposo', MANIFEST, owned, makeUid);
  for (const type of ['beaver', 'fern']) layout = autoPlaceWithHost(layout, MANIFEST, type, MANIFEST.types[type].variants[0], makeUid) ?? layout;
  const list = buildDrawList(layout, MANIFEST, { sky: 'day', owned: { blinds: false, dim: false } });
  const typeOf = (u: string) => layout.items.find((it) => it.uid === u)!.type;
  const ORDER = ['spin', 'steam', 'wave', 'sway', 'blink'];

  it('todo lo que tiene un cuadro que se mueve, menos la pantalla, en orden fijo', () => {
    const found = twitchCandidates(list, layout, MANIFEST);
    const types = found.map((c) => `${typeOf(c.uid)}:${c.name}`);
    expect(types).toEqual(expect.arrayContaining(['plant:sway', 'fern:sway', 'beaver:wave', 'beaver:blink']));
    for (const t of ['fan', 'mug']) {
      if (layout.items.some((it) => it.type === t)) expect(types.some((s) => s.startsWith(`${t}:`))).toBe(true);
    }
    expect(types.some((s) => s.startsWith(`${MONITOR}:`))).toBe(false);
    // Cada uno tiene su cuadro 1 junto al de reposo que se dibuja.
    for (const c of found) {
      const rest = list.find((d) => d.uid === c.uid)!.frame;
      expect(MANIFEST.frames[`${rest}:${c.name}1`]).toBeDefined();
    }
    const order = found.map((c) => ORDER.indexOf(c.name));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // Y no falta ninguno: cada objeto con animación de reposo (y su cuadro) está.
    const expected = layout.items.flatMap((it) =>
      it.type === MONITOR
        ? []
        : Object.keys(MANIFEST.types[it.type]?.anim ?? {})
            .filter((name) => MANIFEST.frames[`${list.find((d) => d.uid === it.uid)?.frame}:${name}1`])
            .map((name) => `${it.uid}:${name}`),
    );
    expect(found.map((c) => `${c.uid}:${c.name}`).sort()).toEqual(expected.sort());
  });

  it('uno a la vez, con pausas, desde el tick 2 y todo antes de los 5 s', () => {
    expect((LAST_TICK + 1) * TICK_MS).toBeLessThanOrEqual(ALIVE_MS);
    expect(twitchSchedule([])).toEqual({});
    const many: Twitch[] = ['spin', 'steam', 'wave', 'sway', 'sway', 'blink', 'glow'].map((name, i) => ({ uid: `obj${i}0000`, name }));
    for (let round = 0; round < 10; round++) {
      const schedule = twitchSchedule(many, round);
      const ticks = Object.keys(schedule).map(Number).sort((a, b) => a - b);
      expect(ticks[0]).toBe(2);
      expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(LAST_TICK);
      // Cada uno una sola vez por vuelta, y entre uno y otro al menos dos ticks quietos.
      const runs: { twitch: Twitch; from: number; to: number }[] = [];
      for (const tick of ticks) {
        const last = runs[runs.length - 1];
        if (last && last.twitch === schedule[tick] && last.to === tick - 1) last.to = tick;
        else runs.push({ twitch: schedule[tick], from: tick, to: tick });
      }
      expect(new Set(runs.map((r) => r.twitch)).size).toBe(runs.length);
      for (let i = 1; i < runs.length; i++) expect(runs[i].from - runs[i - 1].to).toBeGreaterThanOrEqual(3);
      // Rota quién empieza.
      expect(schedule[2]).toBe(many[round % many.length]);
    }
  });

  it('al aparecer, el reposo empieza cuando terminó la llegada (nunca a la par)', () => {
    expect(firstTwitchTick(STILL_MOTION)).toBe(FIRST_TICK);
    // Solo la onda (300 ms): como siempre, desde el tick 2.
    expect(firstTwitchTick(mountMotion(plain, 'detailed', { settle: true }))).toBe(FIRST_TICK);
    const full = mountMotion(plain, 'detailed', { intro: true, entering: uid('plant'), settle: true });
    const from = firstTwitchTick(full);
    expect(from * TICK_MS).toBeGreaterThan(full.cue!);
    const twitch: Twitch = { uid: 'fan00000', name: 'spin' };
    expect(twitchSchedule([twitch], 0, from)).toEqual({ [from]: twitch });
    // Si la llegada ocupa casi todo, no queda lugar y no se mueve nada más.
    expect(twitchSchedule([twitch], 0, LAST_TICK + 1)).toEqual({});
  });

  it('como la escena 2D: ventilador, vapor, saludo y parpadeo', () => {
    const [fan, mug, beaverWave, beaverBlink]: Twitch[] = [
      { uid: 'fan00000', name: 'spin' },
      { uid: 'mug00000', name: 'steam' },
      { uid: 'beaver00', name: 'wave' },
      { uid: 'beaver00', name: 'blink' },
    ];
    expect(twitchSchedule([fan, mug, beaverWave, beaverBlink])).toEqual({
      2: fan,
      5: mug,
      6: mug,
      9: beaverWave,
      10: beaverWave,
      13: beaverBlink,
    });
  });
});
