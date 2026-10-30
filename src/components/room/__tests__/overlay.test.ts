import {
  animateChanges,
  diffLayouts,
  DRAG_LIFT,
  DRAG_ORIGIN_ALPHA,
  planMove,
  planStore,
  sampleAnimations,
  STILL,
  type Level,
  type Sample,
} from '../anim';
import { buildDrawList, type DrawOptions } from '../depth';
import { beginDrag, dragUpdate, placeAnchor, type ArtPoint } from '../drag';
import { cellToArt, roomArtSize, rotateFootprint, wallToArt } from '../iso';
import { defaultLayout, earnedTypes, ownedModifiers, uidMaker } from '../layout';
import { MANIFEST } from '../manifest';
import { rotate, store, validCellsFor } from '../occupancy';
import {
  applyAnimation,
  CELL_BLOCKED,
  CELL_TARGET,
  CELL_VALID,
  sceneDrawList,
  shadowFrame,
  shadowOverlay,
  validCellsOverlay,
  type Scene,
} from '../overlay';
import type { DrawItem, RoomLayout } from '../types';
import { manifest } from './fixtures/manifest';
import { deepFreeze, floor, item, room, surface, uid, wall } from './fixtures/rooms';

const day: DrawOptions = { sky: 'day', owned: { blinds: false, dim: false } };
const base = deepFreeze(
  room([
    item('desk', 'desk', floor(1, 0)),
    item('mon', 'monitor', surface(uid('desk'), 0)),
    item('chair', 'chair', floor(1, 1, 2)),
    item('frame', 'frame', wall('left', 1, 1)),
    item('rug', 'rug', floor(2, 2)),
  ]),
);
const { ox, oy } = roomArtSize(manifest, base.size);
const pt = (x: number, y: number, z = 0): ArtPoint => {
  const p = cellToArt(x, y, z);
  return { ax: p.ax + ox, ay: p.ay + oy };
};
/** Celda `(x, y)` de una casilla o sombra dibujada (su ancla está en la esquina trasera). */
const cellOf = (d: DrawItem) => {
  const [axr, ayr] = manifest.frames[d.frame].anchor;
  const ax = d.x + axr - ox;
  const ay = d.y + ayr - oy;
  return [(ax / 16 + ay / 8) / 2, (ay / 8 - ax / 16) / 2];
};
const isCell = (d: DrawItem) => d.frame.startsWith('cell.');
const isUnder = (d: DrawItem) => d.frame.startsWith('cell.') || d.frame.startsWith('shadow.');
const isRug = (d: DrawItem) => d.uid === uid('rug');

/** Lo de debajo va justo después de baldosas y alfombras y antes de paredes y de cualquier otro objeto. */
function expectUnderLayer(list: DrawItem[]) {
  const first = list.findIndex(isUnder);
  const last = list.length - 1 - [...list].reverse().findIndex(isUnder);
  expect(first).toBeGreaterThan(0);
  expect(list.slice(first, last + 1).every(isUnder)).toBe(true);
  list.forEach((d, i) => {
    if (d.frame.startsWith('floor.') || isRug(d)) expect(i).toBeLessThan(first);
    if (/^(sky|wall|window|blinds)\./.test(d.frame) || (d.uid && !isRug(d))) expect(i).toBeGreaterThan(last);
  });
}

describe('casillas del objeto elegido', () => {
  it('una casilla válida por destino en el piso, de atrás hacia adelante', () => {
    const cells = validCellsOverlay(base, manifest, uid('chair'));
    const places = validCellsFor(base, manifest, uid('chair'));
    expect(cells).toHaveLength(places.length);
    expect(cells.every((d) => d.frame === CELL_VALID && d.uid === undefined)).toBe(true);
    const at = cells.map(cellOf);
    expect(at.map(([x, y]) => `${x},${y}`).sort()).toEqual(places.map((p) => (p.on === 'floor' ? `${p.x},${p.y}` : '')).sort());
    const depth = at.map(([x, y]) => x + y);
    expect(depth).toEqual([...depth].sort((a, b) => a - b));
    // Lo de pared no tiene casillas en el piso.
    expect(validCellsOverlay(base, manifest, uid('frame'))).toEqual([]);
  });

  it('en la escena van sobre el piso y las alfombras, bajo paredes y objetos', () => {
    const list = sceneDrawList(base, manifest, day, { level: 'calm', selected: uid('chair') });
    expect(list.filter(isCell)).toHaveLength(validCellsFor(base, manifest, uid('chair')).length);
    expectUnderLayer(list);
    // Sin elegir nada, la escena es la lista de siempre.
    expect(sceneDrawList(base, manifest, day, { level: 'calm' })).toEqual(buildDrawList(base, manifest, day));
  });

  it('depth: `under` va justo después de las alfombras', () => {
    const marker: DrawItem = { frame: 'cell.valid', x: 0, y: 0 };
    const list = buildDrawList(base, manifest, { ...day, under: [marker] });
    const i = list.indexOf(marker);
    expect(list[i - 1].uid).toBe(uid('rug'));
    expect(list[i + 1].frame).toBe('sky.day.right');
  });
});

describe('sombras y animación', () => {
  const lifted: Sample = {
    items: {
      [uid('chair')]: { dx: 16, dy: 8, lift: 2, alpha: 1, shadow: 1 },
      [uid('mon')]: { dx: 0, dy: 0, lift: 2, alpha: 1, shadow: 1 },
    },
    room: 1,
    running: true,
  };

  it('la sombra va en el piso, donde cae su punto de apoyo; lo de encima de algo no tiene', () => {
    const shadows = shadowOverlay(base, manifest, lifted);
    expect(shadows.map((d) => d.frame)).toEqual(['shadow.1x1']);
    expect(cellOf(shadows[0])).toEqual([2, 1]); // la silla en (1, 1) corrida una casilla en x
    const desk = shadowOverlay(base, manifest, { ...lifted, items: { [uid('desk')]: { dx: 0, dy: 0, lift: 2, alpha: 1, shadow: 0.5 } } });
    expect(desk).toMatchObject([{ frame: 'shadow.2x1', alpha: 0.5 }]);
  });

  it('applyAnimation corre, levanta, cambia el cuadro y la opacidad solo de lo animado', () => {
    const list = buildDrawList(base, manifest, day);
    const sample: Sample = {
      items: {
        [uid('chair')]: { dx: 3, dy: -2, lift: 1, alpha: 0.5, shadow: 0, frame: 'chair.sage.r1' },
        [uid('frame')]: { dx: 0, dy: 0, lift: 0, alpha: 0, shadow: 0 },
      },
      room: 1,
      running: true,
    };
    const out = applyAnimation(list, sample);
    const chair = list.find((d) => d.uid === uid('chair'))!;
    expect(out.find((d) => d.uid === uid('chair'))).toEqual({ frame: 'chair.sage.r1', x: chair.x + 3, y: chair.y - 3, uid: uid('chair'), alpha: 0.5 });
    // Lo transparente ni se dibuja ni se toca; lo demás queda igual (el mismo objeto).
    expect(out.some((d) => d.uid === uid('frame'))).toBe(false);
    expect(out).toHaveLength(list.length - 1);
    for (const d of out) if (d.uid !== uid('chair')) expect(list).toContain(d);
    expect(applyAnimation(list, STILL)).toEqual(list);
  });

  it('en la escena: sombra bajo todo y objeto levantado', () => {
    const anims = planMove(uid('chair'), cellToArtOffset(-1, 0), 'detailed', 0, { grid: true });
    const sample = sampleAnimations(anims, 0);
    const list = sceneDrawList(base, manifest, day, { level: 'detailed', anims, sample, now: 0 });
    expectUnderLayer(list);
    const plain = buildDrawList(base, manifest, day).find((d) => d.uid === uid('chair'))!;
    expect(list.find((d) => d.uid === uid('chair'))).toMatchObject({ x: plain.x - 16, y: plain.y - 8 - 2 });
  });

  it('lo que se guarda se sigue dibujando en su lugar mientras se desvanece', () => {
    const chair = base.items.find((it) => it.uid === uid('chair'))!;
    const { layout } = store(base, chair.uid);
    const anims = planStore(chair, 'detailed', 0);
    const scene = (now: number): Scene => ({ level: 'detailed', anims, sample: sampleAnimations(anims, now), now });
    const during = sceneDrawList(layout, manifest, day, scene(70));
    const plain = buildDrawList(base, manifest, day);
    const at = plain.findIndex((d) => d.uid === chair.uid);
    expect(during.findIndex((d) => d.uid === chair.uid)).toBe(at);
    expect(during[at]).toMatchObject({ x: plain[at].x, y: plain[at].y - 2, alpha: 2 / 3 });
    expect(sceneDrawList(layout, manifest, day, scene(180)).some((d) => d.uid === chair.uid)).toBe(false);
  });
});

/** Desfase en px de arte de `(cx, cy)` casillas. */
function cellToArtOffset(cx: number, cy: number) {
  const p = cellToArt(cx, cy);
  return { dx: p.ax, dy: p.ay };
}

describe('arrastre', () => {
  const dragScene = (layout: RoomLayout, short: string, from: ArtPoint, to: ArtPoint, level: Level = 'detailed') => {
    const state = beginDrag(layout, manifest, uid(short), from)!;
    const update = dragUpdate(state, layout, manifest, to);
    return { state, update, list: sceneDrawList(layout, manifest, day, { level, drag: { state, update } }) };
  };

  it('destino válido: casillas válidas, sombra y cell.target abajo; el fantasma al final, levantado', () => {
    const { update, list } = dragScene(base, 'chair', pt(1.5, 1.5), pt(3.5, 1.5));
    expect(update.valid).toBe(true);
    expectUnderLayer(list);
    const under = list.filter(isUnder);
    expect(under.filter((d) => d.frame === CELL_TARGET).map(cellOf)).toEqual([[3, 1]]);
    expect(under.filter((d) => d.frame === 'shadow.1x1').map(cellOf)).toEqual([[3, 1]]);
    const valid = under.filter((d) => d.frame === CELL_VALID).map(cellOf);
    expect(valid).toHaveLength(validCellsFor(base, manifest, uid('chair')).length - 1);
    expect(valid).not.toContainEqual([3, 1]);
    // El fantasma: el mismo cuadro, en la casilla destino y 4 px arriba, sin uid, encima de todo.
    const ghost = list[list.length - 1];
    const moved = buildDrawList(room([item('chair', 'chair', floor(3, 1, 2))]), manifest, day).find((d) => d.uid)!;
    expect(ghost).toEqual({ frame: moved.frame, x: moved.x, y: moved.y - DRAG_LIFT.detailed });
    // El original queda medio transparente en su lugar.
    expect(list.find((d) => d.uid === uid('chair'))!.alpha).toBe(DRAG_ORIGIN_ALPHA);
  });

  it('destino no válido: cell.blocked (trama), sin cell.target', () => {
    const { update, list } = dragScene(base, 'chair', pt(1.5, 1.5), pt(2.5, 0.5));
    expect(update.reason).toBe('occupied');
    expect(list.filter((d) => d.frame === CELL_BLOCKED).map(cellOf)).toEqual([[2, 0]]);
    expect(list.some((d) => d.frame === CELL_TARGET)).toBe(false);
  });

  it('lo bloqueado se dibuja encima de lo que estorba: si no, ese mueble lo taparía', () => {
    const { list } = dragScene(base, 'chair', pt(1.5, 1.5), pt(2.5, 0.5));
    const blocked = list.findIndex((d) => d.frame === CELL_BLOCKED);
    const lastObject = list.reduce((last, d, i) => (d.uid ? i : last), -1);
    expect(blocked).toBeGreaterThan(lastObject);
  });

  it('el anfitrión lleva lo de encima en el fantasma, y ambos quedan transparentes en su lugar', () => {
    const { list } = dragScene(base, 'desk', pt(1.5, 0.5), pt(3.5, 3.5));
    const ghost = list.slice(-2);
    expect(ghost.map((d) => d.frame)).toEqual(['desk.oak.r0', 'monitor.ink.r0']);
    expect(ghost.every((d) => d.uid === undefined)).toBe(true);
    expect(list.filter((d) => d.uid === uid('desk') || d.uid === uid('mon')).map((d) => d.alpha)).toEqual([
      DRAG_ORIGIN_ALPHA,
      DRAG_ORIGIN_ALPHA,
    ]);
  });

  it('cuánto se levanta el fantasma depende del nivel (reducido: nada)', () => {
    for (const level of ['reduced', 'calm', 'detailed'] as Level[]) {
      const { list } = dragScene(base, 'chair', pt(1.5, 1.5), pt(3.5, 1.5), level);
      const moved = buildDrawList(room([item('chair', 'chair', floor(3, 1, 2))]), manifest, day).find((d) => d.uid)!;
      expect(list[list.length - 1].y).toBe(moved.y - DRAG_LIFT[level]);
    }
  });

  it('en la pared el fantasma toma el cuadro de esa pared; sin lugar, se corre hasta el dedo', () => {
    const from = wallToArt('left', 1.5, 24);
    const to = wallToArt('right', 1.5, 24);
    const { list } = dragScene(base, 'frame', { ax: from.ax + ox, ay: from.ay + oy }, { ax: to.ax + ox, ay: to.ay + oy });
    expect(list[list.length - 1].frame).toBe('frame.home.r0');
    expect(list.some(isCell)).toBe(false);
    // La pantalla lejos de todo slot: se dibuja igual, corrida al punto del fantasma.
    const far = dragScene(base, 'mon', pt(1, 0, 20), pt(4.5, 4.5));
    expect(far.update.place).toBeNull();
    const plain = buildDrawList(base, manifest, day).find((d) => d.uid === uid('mon'))!;
    const [axr, ayr] = manifest.frames[plain.frame].anchor;
    const ghost = far.list[far.list.length - 1];
    expect([ghost.x + axr, ghost.y + ayr + DRAG_LIFT.detailed]).toEqual([far.update.ghost.ax, far.update.ghost.ay]);
  });
});

describe('manifiesto real', () => {
  const owned = earnedTypes(
    MANIFEST,
    Object.values(MANIFEST.types).flatMap((t) => t.adjustments ?? []),
  );
  const layout = defaultLayout('casa', MANIFEST, owned, uidMaker('casa'));
  const options: DrawOptions = { sky: 'day', owned: ownedModifiers(MANIFEST, owned) };
  const missing = (list: DrawItem[]) => list.filter((d) => !Object.prototype.hasOwnProperty.call(MANIFEST.frames, d.frame)).map((d) => d.frame);

  it('trae las casillas y la sombra de cada huella del piso, con cada giro', () => {
    for (const frame of [CELL_VALID, CELL_BLOCKED, CELL_TARGET]) expect(MANIFEST.frames[frame]).toBeDefined();
    for (const [type, spec] of Object.entries(MANIFEST.types)) {
      if (!spec.place.includes('floor') || spec.modifies) continue;
      for (const rot of spec.facings) {
        const [w, d] = rotateFootprint(spec.footprint, rot);
        expect({ type, frame: shadowFrame(w, d), ok: !!MANIFEST.frames[shadowFrame(w, d)] }).toEqual({ type, frame: shadowFrame(w, d), ok: true });
      }
    }
  });

  it('arrastrar cualquier objeto del cuarto a cualquier casilla dibuja solo cuadros que existen', () => {
    const { ox: x0, oy: y0 } = roomArtSize(MANIFEST, layout.size);
    const problems: string[] = [];
    for (const it of layout.items) {
      const state = beginDrag(layout, MANIFEST, it.uid, placeAnchor(layout, MANIFEST, it.place)!);
      expect(state).not.toBeNull();
      for (let y = 0; y < layout.size.d; y++) {
        for (let x = 0; x < layout.size.w; x++) {
          const c = cellToArt(x + 0.5, y + 0.5);
          const update = dragUpdate(state!, layout, MANIFEST, { ax: c.ax + x0, ay: c.ay + y0 });
          const list = sceneDrawList(layout, MANIFEST, options, { level: 'detailed', drag: { state: state!, update } });
          problems.push(...missing(list));
          if (!list[list.length - 1] || list[list.length - 1].uid) problems.push(`${it.type}: sin fantasma`);
        }
      }
    }
    expect([...new Set(problems)]).toEqual([]);
  });

  it('girar con detalles dibuja el cuadro de antes, que existe', () => {
    for (const it of layout.items) {
      const r = rotate(layout, MANIFEST, it.uid);
      if (!r.ok) continue;
      const anims = animateChanges([], diffLayouts(layout, r.layout), buildDrawList(layout, MANIFEST, options), buildDrawList(r.layout, MANIFEST, options), MANIFEST, 'detailed', 0);
      expect(anims.length).toBeGreaterThan(0);
      const list = sceneDrawList(r.layout, MANIFEST, options, { level: 'detailed', anims, sample: sampleAnimations(anims, 0), now: 0 });
      expect(missing(list)).toEqual([]);
    }
  });
});
