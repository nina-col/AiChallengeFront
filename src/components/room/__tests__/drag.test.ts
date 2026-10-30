import { sampleAnimations, type Level } from '../anim';
import { beginDrag, dragEnd, dragUpdate, placeAnchor, SLOT_SNAP_PX, type ArtPoint } from '../drag';
import { cellToArt, roomArtSize, wallToArt } from '../iso';
import { canPlace } from '../occupancy';
import type { RoomLayout, Wall } from '../types';
import { manifest } from './fixtures/manifest';
import { deepFreeze, floor, item, rng, room, surface, uid, wall } from './fixtures/rooms';

/** Escritorio con pantalla, silla, cuadro en la pared izquierda, planta en el piso; ventana en la derecha, u = 3. */
const base = deepFreeze(
  room(
    [
      item('desk', 'desk', floor(1, 0)),
      item('mon', 'monitor', surface(uid('desk'), 0)),
      item('chair', 'chair', floor(1, 1, 2)),
      item('frame', 'frame', wall('left', 1, 1)),
      item('plant', 'plant', floor(4, 4)),
    ],
    { window: { wall: 'right', u: 3 } },
  ),
);
const { ox, oy } = roomArtSize(manifest, base.size);
/** Punto del lienzo sobre el punto `(x, y)` del piso a altura `z`. */
const pt = (x: number, y: number, z = 0): ArtPoint => {
  const p = cellToArt(x, y, z);
  return { ax: p.ax + ox, ay: p.ay + oy };
};
/** Punto del lienzo sobre una pared, a `u` celdas de la esquina y altura `z`. */
const onWall = (side: Wall, u: number, z: number): ArtPoint => {
  const p = wallToArt(side, u, z);
  return { ax: p.ax + ox, ay: p.ay + oy };
};
const start = (layout: RoomLayout, short: string, touch: ArtPoint) => {
  const state = beginDrag(layout, manifest, uid(short), touch);
  if (!state) throw new Error(`no se puede arrastrar ${short}`);
  return state;
};

describe('piso', () => {
  it('el desfase del agarre: el objeto no salta al dedo', () => {
    const s = start(base, 'chair', pt(1.5, 1.5));
    expect(s.grab).toEqual({ x: 0, y: 0 });
    expect(s.origin).toEqual(floor(1, 1, 2));
    expect(dragUpdate(s, base, manifest, pt(1.5, 1.5))).toEqual({ place: floor(1, 1, 2), valid: true, ghost: pt(1, 1), cells: [[1, 1]] });
    expect(dragUpdate(s, base, manifest, pt(2.5, 1.5))).toEqual({ place: floor(2, 1, 2), valid: true, ghost: pt(2, 1), cells: [[2, 1]] });
    // Tomado por arriba (12 px sobre el piso): el dedo cae una casilla atrás, y eso se descuenta.
    const high = start(base, 'chair', pt(1.5, 1.5, 12));
    expect(high.grab).toEqual({ x: -1, y: -1 });
    expect(dragUpdate(high, base, manifest, pt(1.5, 1.5, 12)).place).toEqual(floor(1, 1, 2));
    expect(dragUpdate(high, base, manifest, pt(2.5, 1.5, 12)).place).toEqual(floor(2, 1, 2));
    expect(dragUpdate(high, base, manifest, pt(1.5, 2.5, 12)).place).toEqual(floor(1, 2, 2));
  });

  it('ocupado y fuera: no se puede, con el motivo, y las casillas dentro del cuarto', () => {
    const s = start(base, 'chair', pt(1.5, 1.5));
    expect(dragUpdate(s, base, manifest, pt(2.5, 0.5))).toEqual({
      place: floor(2, 0, 2),
      valid: false,
      reason: 'occupied',
      ghost: pt(2, 0),
      cells: [[2, 0]],
    });
    expect(dragUpdate(s, base, manifest, pt(5.5, 1.5))).toMatchObject({ place: floor(5, 1, 2), valid: false, reason: 'outside', cells: [] });
    expect(dragUpdate(s, base, manifest, pt(1.5, -0.5))).toMatchObject({ valid: false, reason: 'outside' });
    // El escritorio (2 × 1) contra el borde: la mitad queda fuera.
    const desk = start(base, 'desk', pt(1.5, 0.5));
    expect(desk.riders).toEqual([uid('mon')]);
    expect(dragUpdate(desk, base, manifest, pt(4.5, 2.5))).toMatchObject({ place: floor(4, 2, 0), reason: 'outside', cells: [[4, 2]] });
    expect(dragUpdate(desk, base, manifest, pt(3.5, 2.5))).toMatchObject({ place: floor(3, 2, 0), valid: true, cells: [[3, 2], [4, 2]] });
  });

  it('si no cambia el lugar devuelve lo mismo (no se vuelve a dibujar)', () => {
    const s = start(base, 'chair', pt(1.5, 1.5));
    const a = dragUpdate(s, base, manifest, pt(2.5, 1.5));
    expect(dragUpdate(s, base, manifest, pt(2.7, 1.3), a)).toBe(a);
    expect(dragUpdate(s, base, manifest, pt(3.5, 1.5), a)).not.toBe(a);
  });
});

describe('pared', () => {
  it('a lo largo, entre filas, a la otra pared y nunca fuera de ella', () => {
    const s = start(base, 'frame', onWall('left', 1.5, 24));
    expect(s.grabWall).toEqual({ u: 0, row: 0 });
    const at = (side: Wall, u: number, z: number) => dragUpdate(s, base, manifest, onWall(side, u, z));
    expect(at('left', 3.5, 24)).toEqual({ place: wall('left', 3, 1), valid: true, ghost: onWall('left', 3, 16), cells: [] });
    expect(at('left', 1.5, 40).place).toEqual(wall('left', 1, 2));
    // Más arriba o más allá de la pared: la fila y la celda más cercanas.
    expect(at('left', 1.5, 90).place).toEqual(wall('left', 1, 2));
    expect(at('left', 7.5, 24).place).toEqual(wall('left', 4, 1));
    expect(at('left', 1.5, -20).place).toEqual(wall('left', 1, 0));
    // La pared derecha, con la ventana en u = 3.
    expect(at('right', 1.5, 24)).toMatchObject({ place: wall('right', 1, 1), valid: true });
    expect(at('right', 3.5, 24)).toMatchObject({ place: wall('right', 3, 1), valid: false, reason: 'window' });
  });

  it('una celda ocupada', () => {
    const hung = room([...base.items, item('frame2', 'frame', wall('left', 3, 1))], { window: base.shell.window });
    const s = start(hung, 'frame', onWall('left', 1.5, 24));
    expect(dragUpdate(s, hung, manifest, onWall('left', 3.5, 24))).toMatchObject({ place: wall('left', 3, 1), valid: false, reason: 'occupied' });
  });
});

describe('superficie', () => {
  // La pantalla está en el slot 0, en (1, 0) a z = 14; se toma 6 px más arriba de su punto de apoyo.
  const grabbed = () => start(base, 'mon', pt(1, 0, 20));

  it('al slot más cercano de cualquier anfitrión', () => {
    const s = grabbed();
    expect(s.grabArt).toEqual({ ax: 0, ay: -6 });
    expect(dragUpdate(s, base, manifest, pt(2, 0, 20))).toEqual({
      place: surface(uid('desk'), 1),
      valid: true,
      ghost: pt(2, 0, 14),
      cells: [],
    });
    const twoDesks = room([...base.items, item('desk2', 'desk', floor(3, 3))], { window: base.shell.window });
    const s2 = start(twoDesks, 'mon', pt(1, 0, 20));
    expect(dragUpdate(s2, twoDesks, manifest, pt(4, 3, 21)).place).toEqual(surface(uid('desk2'), 1));
  });

  it('lejos de todo slot no cae en ninguno, y el fantasma sigue al dedo en la rejilla', () => {
    const s = grabbed();
    const far = dragUpdate(s, base, manifest, pt(4.5, 4.5));
    expect(far).toMatchObject({ place: null, valid: false, reason: 'no-slot', cells: [] });
    expect(Number.isInteger(far.ghost.ax) && Number.isInteger(far.ghost.ay)).toBe(true);
    // Su punto de apoyo iría en (0, 78) px del piso: la esquina de la rejilla más cercana es (5, 5).
    expect(far.ghost).toEqual(pt(5, 5));
  });

  it('lo que va en piso o encima: el slot lo atrapa de cerca; si no, el piso', () => {
    const s = start(base, 'plant', pt(4, 4, 8));
    expect(s.grabArt).toEqual({ ax: 0, ay: -8 });
    const slot1 = pt(2, 0, 14 + 8);
    expect(dragUpdate(s, base, manifest, slot1)).toMatchObject({ place: surface(uid('desk'), 1), valid: true });
    expect(dragUpdate(s, base, manifest, { ax: slot1.ax, ay: slot1.ay + SLOT_SNAP_PX - 1 }).place).toEqual(surface(uid('desk'), 1));
    // El dedo, 8 px sobre el punto de apoyo como al tomarla: la planta va a (0, 3).
    expect(dragUpdate(s, base, manifest, pt(0, 3, 8)).place).toEqual(floor(0, 3));
    // Encima de la pantalla no: ese slot está ocupado.
    expect(dragUpdate(s, base, manifest, pt(1, 0, 22))).toMatchObject({ place: surface(uid('desk'), 0), valid: false, reason: 'occupied' });
  });
});

describe('sin mover el dedo', () => {
  /** Mantener presionado y soltar sin moverse: no salta, no dice que no se puede y nada cambia. */
  const staysPut = (layout: RoomLayout, short: string, touch: ArtPoint) => {
    const it = layout.items.find((i) => i.uid === uid(short))!;
    const s = start(layout, short, touch);
    const still = dragUpdate(s, layout, manifest, touch);
    expect(still).toMatchObject({ place: it.place, valid: true, ghost: placeAnchor(layout, manifest, it.place)! });
    expect(dragEnd(s, still, layout, manifest, 'detailed', 0)).toMatchObject({ ok: false, reason: null });
    return s;
  };

  it('justo detrás de un escritorio, el slot no atrapa lo del piso hasta que el dedo sale de su casilla', () => {
    // El slot 0 del escritorio en (1, 1), a 14 px de altura, cae a 2 px de la casilla (0, 0).
    const near = room([item('desk', 'desk', floor(1, 1)), item('plant', 'plant', floor(0, 0))]);
    const s = staysPut(near, 'plant', pt(0.5, 0.5));
    expect(dragUpdate(s, near, manifest, pt(0.6, 0.4)).place).toEqual(floor(0, 0));
    // Ya fuera de su casilla, el slot lo atrapa como siempre.
    const slot1 = pt(2, 1, 14);
    expect(dragUpdate(s, near, manifest, { ax: slot1.ax, ay: slot1.ay + 8 })).toMatchObject({ place: surface(uid('desk'), 1), valid: true });
    // Con ese slot ocupado tampoco dice "ocupado" sin haberse movido.
    staysPut(room([...near.items, item('mon', 'monitor', surface(uid('desk'), 0))]), 'plant', pt(0.5, 0.5));
  });

  it('junto a la esquina, lo de la pared no salta a la otra hasta cruzarla', () => {
    for (const [side, other, across] of [['right', 'left', -1], ['left', 'right', 1]] as const) {
      const hung = room([item('frame', 'frame', wall(side, 0, 1))], { window: { wall: other, u: 3 } });
      // El dedo, 3 px del otro lado de la esquina: lo pequeño se elige aunque caiga a unos px.
      const touch = { ax: ox + 3 * across, ay: onWall(side, 0, 24).ay };
      const s = staysPut(hung, 'frame', touch);
      expect(dragUpdate(s, hung, manifest, { ax: ox + 24 * across, ay: touch.ay }).place).toMatchObject({ on: 'wall', wall: other });
    }
  });

  it('lo tome de donde lo tome', () => {
    const decorated = room(
      [
        item('desk', 'desk', floor(1, 1)),
        item('mon', 'monitor', surface(uid('desk'), 1)),
        item('chair', 'chair', floor(2, 2)),
        item('plant', 'plant', floor(0, 0)),
        item('frame1', 'frame', wall('left', 0, 0)),
        item('frame2', 'frame', wall('right', 0, 2)),
      ],
      { window: { wall: 'right', u: 3 } },
    );
    for (const short of ['desk', 'mon', 'chair', 'plant', 'frame1', 'frame2']) {
      const it = decorated.items.find((i) => i.uid === uid(short))!;
      const anchor = placeAnchor(decorated, manifest, it.place)!;
      for (let dx = -12; dx <= 12; dx += 3) {
        for (let dy = -30; dy <= 6; dy += 3) staysPut(decorated, short, { ax: anchor.ax + dx, ay: anchor.ay + dy });
      }
    }
  });
});

describe('validez', () => {
  it('es la de canPlace en cualquier punto (sin reglas repetidas)', () => {
    const rand = rng(31);
    const { w, h } = roomArtSize(manifest, base.size);
    for (const short of ['chair', 'desk', 'mon', 'plant', 'frame']) {
      const it = base.items.find((i) => i.uid === uid(short))!;
      const s = start(base, short, placeAnchor(base, manifest, it.place)!);
      for (let k = 0; k < 300; k++) {
        const u = dragUpdate(s, base, manifest, { ax: rand() * w, ay: rand() * h });
        expect(Number.isInteger(u.ghost.ax) && Number.isInteger(u.ghost.ay)).toBe(true);
        if (!u.place) continue;
        const check = canPlace(base, manifest, it, u.place);
        expect({ valid: u.valid, reason: u.reason }).toEqual({ valid: check.ok, reason: check.ok ? undefined : check.reason });
      }
    }
  });
});

describe('dragEnd', () => {
  const level: Level = 'detailed';

  it('en un lugar válido y distinto: se suelta ahí', () => {
    const s = start(base, 'chair', pt(1.5, 1.5));
    const u = dragUpdate(s, base, manifest, pt(3.5, 2.5));
    expect(dragEnd(s, u, base, manifest, level, 0)).toEqual({ ok: true, uid: uid('chair'), place: floor(3, 2, 2) });
  });

  it('donde no se puede: vuelve desde el fantasma por la rejilla y dice por qué', () => {
    const s = start(base, 'chair', pt(1.5, 1.5));
    const u = dragUpdate(s, base, manifest, pt(2.5, 0.5));
    const end = dragEnd(s, u, base, manifest, level, 0);
    if (end.ok) throw new Error('no debía soltarse');
    expect(end.reason).toBe('occupied');
    expect(end.back).toHaveLength(1);
    const [back] = end.back;
    const first = sampleAnimations(end.back, 0).items[uid('chair')];
    // Empieza donde estaba el fantasma (una casilla en x y una hacia atrás en y) y llega a su lugar.
    expect([first.dx, first.dy]).toEqual([cellToArt(1, -1).ax, cellToArt(1, -1).ay]);
    expect(sampleAnimations(end.back, back.dur).running).toBe(false);
    for (const calm of ['calm', 'reduced'] as Level[]) expect(dragEnd(s, u, base, manifest, calm, 0)).toMatchObject({ ok: false, back: [] });
  });

  it('en su mismo lugar (o sin moverse): solo aterriza, sin motivo', () => {
    const s = start(base, 'desk', pt(1.5, 0.5));
    const same = dragUpdate(s, base, manifest, pt(1.5, 0.5));
    const end = dragEnd(s, same, base, manifest, level, 0);
    expect(end).toMatchObject({ ok: false, reason: null });
    if (end.ok) return;
    // El escritorio y su pantalla bajan 2 px juntos.
    expect(end.back.map((a) => [a.uid, a.dur])).toEqual([
      [uid('desk'), 60],
      [uid('mon'), 60],
    ]);
    expect(dragEnd(s, null, base, manifest, level, 0)).toMatchObject({ ok: false, reason: null });
  });

  it('lo que no está o no se coloca no se arrastra', () => {
    expect(beginDrag(base, manifest, uid('nobody'), pt(0, 0))).toBeNull();
    const withBlinds = room([...base.items, item('blinds', 'blinds', floor(4, 0))]);
    expect(beginDrag(withBlinds, manifest, uid('blinds'), pt(4.5, 0.5))).toBeNull();
  });
});
