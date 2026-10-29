import {
  addItem,
  buildOccupancy,
  canPlace,
  EMPTY,
  move,
  moveTo,
  rotate,
  slotCells,
  store,
  validCellsFor,
  validPlaces,
  WINDOW,
} from '../occupancy';
import type { RoomLayout } from '../types';
import { manifest } from './fixtures/manifest';
import { deepFreeze, floor, item, room, surface, uid, wall } from './fixtures/rooms';

const reason = (r: { ok: boolean; reason?: string }) => (r.ok ? 'ok' : r.reason);
const placeOf = (layout: RoomLayout, short: string) => layout.items.find((it) => it.uid === uid(short))!.place;

/** Escritorio en (1, 0) con pantalla y planta encima, silla enfrente; ventana en la derecha, u = 2. */
const base = deepFreeze(
  room([
    item('desk', 'desk', floor(1, 0, 0)),
    item('mon', 'monitor', surface(uid('desk'), 0)),
    item('plant', 'plant', surface(uid('desk'), 1)),
    item('chair', 'chair', floor(1, 1, 2)),
  ]),
);

describe('buildOccupancy', () => {
  it('marca piso, slots y la columna de la ventana', () => {
    const occ = buildOccupancy(base, manifest);
    expect(occ.floor[0 * 5 + 1]).toBe(0);
    expect(occ.floor[0 * 5 + 2]).toBe(0);
    expect(occ.floor[1 * 5 + 1]).toBe(3);
    expect(occ.floor[0]).toBe(EMPTY);
    expect(occ.slots[`${uid('desk')}#0`]).toBe(1);
    expect(occ.slots[`${uid('desk')}#1`]).toBe(2);
    for (let row = 0; row < 3; row++) expect(occ.right[row * 5 + 2]).toBe(WINDOW);
    expect(occ.left.every((v) => v === EMPTY)).toBe(true);
  });
});

describe('canPlace', () => {
  const lamp = item('lamp', 'lamp', floor(0, 0));

  it('piso: dentro, fuera, ocupado y orientación', () => {
    expect(reason(canPlace(base, manifest, lamp, floor(0, 0)))).toBe('ok');
    expect(reason(canPlace(base, manifest, lamp, floor(5, 0)))).toBe('outside');
    expect(reason(canPlace(base, manifest, lamp, floor(-1, 2)))).toBe('outside');
    expect(reason(canPlace(base, manifest, lamp, floor(2, 0)))).toBe('occupied');
    expect(reason(canPlace(base, manifest, lamp, floor(0, 0, 2)))).toBe('facing');
    const desk2 = item('desk2', 'desk', floor(0, 0));
    expect(reason(canPlace(base, manifest, desk2, floor(4, 3, 0)))).toBe('outside');
    expect(reason(canPlace(base, manifest, desk2, floor(4, 3, 1)))).toBe('ok');
    expect(reason(canPlace(base, manifest, desk2, floor(4, 4, 1)))).toBe('outside');
  });

  it('no choca consigo mismo al moverse', () => {
    const desk = base.items[0];
    expect(reason(canPlace(base, manifest, desk, floor(0, 0)))).toBe('ok');
    expect(reason(canPlace(base, manifest, desk, floor(1, 1)))).toBe('occupied');
  });

  it('alfombras: su propia capa, bajo los muebles, sin pisarse entre ellas', () => {
    const rug = item('rug', 'rug', floor(0, 0));
    expect(reason(canPlace(base, manifest, rug, floor(1, 0)))).toBe('ok');
    const withRug = room([...base.items, item('rug', 'rug', floor(1, 0))]);
    const rug2 = item('rug2', 'rug', floor(0, 0));
    expect(reason(canPlace(withRug, manifest, rug2, floor(2, 1)))).toBe('occupied');
    expect(reason(canPlace(withRug, manifest, rug2, floor(3, 0)))).toBe('ok');
    // Y un mueble sí cabe encima de la alfombra.
    expect(reason(canPlace(withRug, manifest, lamp, floor(2, 1)))).toBe('ok');
  });

  it('pared: ventana, fuera, ocupado y huellas de varias celdas', () => {
    const frame = item('frame', 'frame', wall('left', 0, 0));
    expect(reason(canPlace(base, manifest, frame, wall('right', 2, 1)))).toBe('window');
    expect(reason(canPlace(base, manifest, frame, wall('right', 1, 1)))).toBe('ok');
    expect(reason(canPlace(base, manifest, frame, wall('left', 2, 1)))).toBe('ok');
    expect(reason(canPlace(base, manifest, frame, wall('left', 0, 3)))).toBe('outside');
    expect(reason(canPlace(base, manifest, frame, wall('left', 5, 0)))).toBe('outside');
    const shelf = item('shelf', 'shelf', wall('left', 0, 0));
    expect(reason(canPlace(base, manifest, shelf, wall('right', 1, 2)))).toBe('window');
    expect(reason(canPlace(base, manifest, shelf, wall('right', 3, 2)))).toBe('ok');
    expect(reason(canPlace(base, manifest, shelf, wall('right', 4, 2)))).toBe('outside');
    const hung = room([...base.items, item('frame', 'frame', wall('left', 1, 1))]);
    expect(reason(canPlace(hung, manifest, shelf, wall('left', 0, 1)))).toBe('occupied');
  });

  it('superficie: slot libre, ocupado, inexistente o anfitrión que no lo es', () => {
    const lampOnly = room([item('desk', 'desk', floor(1, 0)), item('mon', 'monitor', surface(uid('desk'), 0))]);
    expect(reason(canPlace(lampOnly, manifest, lamp, surface(uid('desk'), 1)))).toBe('ok');
    expect(reason(canPlace(lampOnly, manifest, lamp, surface(uid('desk'), 0)))).toBe('occupied');
    expect(reason(canPlace(lampOnly, manifest, lamp, surface(uid('desk'), 2)))).toBe('no-slot');
    expect(reason(canPlace(lampOnly, manifest, lamp, surface(uid('nohost'), 0)))).toBe('no-slot');
    expect(reason(canPlace(base, manifest, lamp, surface(uid('chair'), 0)))).toBe('no-slot');
    // No se apila: la pantalla no es anfitriona.
    expect(reason(canPlace(base, manifest, lamp, surface(uid('mon'), 0)))).toBe('no-slot');
  });

  it('lo que no se coloca así', () => {
    expect(reason(canPlace(base, manifest, item('lamp', 'lamp', floor(0, 0)), wall('left', 0, 1)))).toBe('not-placeable');
    expect(reason(canPlace(base, manifest, item('chair2', 'chair', floor(0, 0)), surface(uid('desk'), 0)))).toBe(
      'not-placeable',
    );
    expect(reason(canPlace(base, manifest, item('blinds', 'blinds', floor(0, 0)), floor(0, 0)))).toBe('not-placeable');
    expect(reason(canPlace(base, manifest, item('ghost', 'aquarium', floor(0, 0)), floor(0, 0)))).toBe('not-placeable');
    expect(reason(canPlace(base, manifest, item('weird', 'constructor', floor(0, 0)), floor(0, 0)))).toBe('not-placeable');
  });
});

describe('move', () => {
  it('mueve en las cuatro direcciones sin tocar el original', () => {
    const r = move(base, manifest, uid('chair'), '+y');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(placeOf(r.layout, 'chair')).toEqual(floor(1, 2, 2));
    expect(placeOf(base, 'chair')).toEqual(floor(1, 1, 2));
    expect(r.layout.items[0]).toBe(base.items[0]);
  });

  it('salta lo ocupado hasta el siguiente lugar libre', () => {
    // La silla en (1, 1) mira hacia +x: (2, 1) está libre; hacia −y está el escritorio y luego la pared.
    expect(reason(move(base, manifest, uid('chair'), '-y'))).toBe('occupied');
    const blocked = room([...base.items, item('fan', 'fan', floor(2, 1))]);
    const r = move(blocked, manifest, uid('chair'), '+x');
    expect(r.ok && placeOf(r.layout, 'chair')).toEqual(floor(3, 1, 2));
  });

  it('no sale del cuarto', () => {
    const corner = room([item('chair', 'chair', floor(0, 0))]);
    expect(reason(move(corner, manifest, uid('chair'), '-x'))).toBe('outside');
    expect(reason(move(corner, manifest, uid('chair'), 'up'))).toBe('outside');
    const edge = room([item('desk', 'desk', floor(3, 0))]);
    expect(reason(move(edge, manifest, uid('desk'), '+x'))).toBe('outside');
  });

  it('el anfitrión lleva lo que tiene encima', () => {
    const r = move(base, manifest, uid('desk'), '+x');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(placeOf(r.layout, 'desk')).toEqual(floor(2, 0, 0));
    expect(placeOf(r.layout, 'mon')).toEqual(surface(uid('desk'), 0));
    const desk = r.layout.items.find((it) => it.uid === uid('desk'))!;
    expect(slotCells(desk, manifest.types.desk)).toEqual([
      [2, 0],
      [3, 0],
    ]);
  });

  it('pared: a lo largo, arriba y abajo, saltando la ventana', () => {
    const hung = room([item('frame', 'frame', wall('right', 1, 1)), item('frame2', 'frame', wall('left', 0, 1))]);
    const r = move(hung, manifest, uid('frame'), '+x');
    expect(r.ok && placeOf(r.layout, 'frame')).toEqual(wall('right', 3, 1));
    const up = move(hung, manifest, uid('frame'), 'up');
    expect(up.ok && placeOf(up.layout, 'frame')).toEqual(wall('right', 1, 2));
    expect(reason(move(hung, manifest, uid('frame'), '+y'))).toBe('outside');
    const left = move(hung, manifest, uid('frame2'), '+y');
    expect(left.ok && placeOf(left.layout, 'frame2')).toEqual(wall('left', 1, 1));
    expect(reason(move(hung, manifest, uid('frame2'), '-y'))).toBe('outside');
    const topRow = room([item('frame', 'frame', wall('right', 0, 2))]);
    expect(reason(move(topRow, manifest, uid('frame'), 'up'))).toBe('outside');
  });

  it('superficie: al slot vecino, aunque sea de otro escritorio', () => {
    const twoDesks = room([
      item('desk', 'desk', floor(0, 0)),
      item('desk2', 'desk', floor(2, 0)),
      item('lamp', 'lamp', surface(uid('desk'), 0)),
    ]);
    const a = move(twoDesks, manifest, uid('lamp'), '+x');
    expect(a.ok && placeOf(a.layout, 'lamp')).toEqual(surface(uid('desk'), 1));
    if (!a.ok) return;
    const b = move(a.layout, manifest, uid('lamp'), '+x');
    expect(b.ok && placeOf(b.layout, 'lamp')).toEqual(surface(uid('desk2'), 0));
    expect(reason(move(twoDesks, manifest, uid('lamp'), '+y'))).toBe('no-slot');
    expect(reason(move(twoDesks, manifest, uid('lamp'), '-x'))).toBe('outside');
  });
});

describe('rotate', () => {
  it('pasa a la siguiente orientación permitida', () => {
    const r = rotate(base, manifest, uid('chair'));
    expect(r.ok && placeOf(r.layout, 'chair')).toEqual(floor(1, 1, 3));
    const lone = room([item('chair', 'chair', floor(2, 2, 3))]);
    const back = rotate(lone, manifest, uid('chair'));
    expect(back.ok && placeOf(back.layout, 'chair')).toEqual(floor(2, 2, 0));
  });

  it('en el borde, lo corre dentro de su propia huella', () => {
    // Escritorio contra el borde delantero: girado (1 × 2) no cabe en y = 4, pero sí corrido a y = 3.
    const edge = room([item('desk', 'desk', floor(3, 4, 0))]);
    const r = rotate(edge, manifest, uid('desk'));
    expect(r.ok && placeOf(r.layout, 'desk')).toEqual(floor(3, 3, 1));
    // Y al volver a girar, en la esquina, se corre hacia atrás en x.
    const corner = room([item('desk', 'desk', floor(4, 3, 1))]);
    const r2 = rotate(corner, manifest, uid('desk'));
    expect(r2.ok && placeOf(r2.layout, 'desk')).toEqual(floor(3, 3, 0));
  });

  it('si no cabe de ninguna forma, no cambia nada', () => {
    const tight = room(
      [item('desk', 'desk', floor(0, 0, 0)), item('c1', 'chair', floor(0, 1)), item('c2', 'chair', floor(1, 1))],
      { size: { w: 2, d: 2 } },
    );
    expect(reason(rotate(tight, manifest, uid('desk')))).toBe('occupied');
  });

  it('lo que tiene una sola orientación o no está en el piso no gira', () => {
    const plant = room([item('plant', 'plant', floor(0, 0))]);
    expect(reason(rotate(plant, manifest, uid('plant')))).toBe('facing');
    expect(reason(rotate(base, manifest, uid('mon')))).toBe('facing');
    expect(reason(rotate(base, manifest, uid('nobody')))).toBe('not-placeable');
  });
});

describe('moveTo, addItem y store', () => {
  it('pone en un lugar válido o dice por qué no', () => {
    const r = moveTo(base, manifest, uid('plant'), floor(4, 4));
    expect(r.ok && placeOf(r.layout, 'plant')).toEqual(floor(4, 4));
    expect(reason(moveTo(base, manifest, uid('plant'), floor(1, 1)))).toBe('occupied');
    expect(reason(moveTo(base, manifest, uid('nobody'), floor(1, 1)))).toBe('not-placeable');
  });

  it('un anfitrión con cosas encima solo va al piso', () => {
    const twoDesks = room([...base.items, item('desk2', 'desk', floor(3, 3))]);
    expect(reason(moveTo(twoDesks, manifest, uid('desk'), surface(uid('desk2'), 0)))).toBe('not-placeable');
  });

  it('agrega del inventario', () => {
    const r = addItem(base, manifest, item('lamp', 'lamp', floor(4, 0)));
    expect(r.ok && r.layout.items).toHaveLength(5);
    expect(reason(addItem(base, manifest, item('chair', 'chair', floor(4, 4))))).toBe('not-placeable');
    expect(reason(addItem(base, manifest, item('lamp', 'lamp', floor(1, 1))))).toBe('occupied');
  });

  it('guardar el escritorio guarda también lo que tiene encima', () => {
    const { layout, stored } = store(base, uid('desk'));
    expect(stored.map((it) => it.type)).toEqual(['desk', 'monitor', 'plant']);
    expect(layout.items.map((it) => it.type)).toEqual(['chair']);
    expect(base.items).toHaveLength(4);
    const none = store(base, uid('nobody'));
    expect(none.layout).toBe(base);
    expect(none.stored).toEqual([]);
  });
});

describe('validCellsFor', () => {
  it('silla: toda celda libre salvo la suya', () => {
    const places = validCellsFor(base, manifest, uid('chair'));
    // 25 celdas − 2 del escritorio − la de la silla.
    expect(places).toHaveLength(22);
    expect(places.every((p) => p.on === 'floor' && p.rot === 2)).toBe(true);
  });

  it('lámpara nueva: slots libres y piso', () => {
    const oneSlot = room([item('desk', 'desk', floor(1, 0)), item('mon', 'monitor', surface(uid('desk'), 0))]);
    const places = validPlaces(oneSlot, manifest, item('lamp', 'lamp', floor(0, 0)));
    expect(places[0]).toEqual(surface(uid('desk'), 1));
    expect(places.filter((p) => p.on === 'floor')).toHaveLength(23);
  });

  it('cuadro: toda la pared menos la columna de la ventana', () => {
    const hung = room([item('frame', 'frame', wall('left', 0, 0))]);
    const places = validCellsFor(hung, manifest, uid('frame'));
    // (5 + 5 celdas) × 3 filas − 3 de la ventana − la suya.
    expect(places).toHaveLength(26);
    expect(places.some((p) => p.on === 'wall' && p.wall === 'right' && p.u === 2)).toBe(false);
  });

  it('un objeto que no está da lista vacía', () => {
    expect(validCellsFor(base, manifest, uid('nobody'))).toEqual([]);
  });
});
