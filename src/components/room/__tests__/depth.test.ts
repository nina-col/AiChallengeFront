import { buildDrawList, topoOrder, type DrawOptions } from '../depth';
import { maskBit } from '../hit';
import { roomArtSize, rotateFootprint } from '../iso';
import type { DrawItem, Facing, RoomItem, RoomLayout } from '../types';
import { manifest } from './fixtures/manifest';
import { deepFreeze, floor, item, rng, room, surface, uid, wall } from './fixtures/rooms';

const day: DrawOptions = { sky: 'day', owned: { blinds: false, dim: false } };
const frames = (list: DrawItem[]) => list.map((d) => d.frame);
const order = (list: DrawItem[]) => list.filter((d) => d.uid).map((d) => d.uid!.replace(/0+$/, ''));

describe('buildDrawList: capas', () => {
  const layout = deepFreeze(
    room(
      [
        item('chair', 'chair', floor(1, 1, 2)),
        item('frame', 'frame', wall('left', 1, 1)),
        item('mon', 'monitor', surface(uid('desk'), 0)),
        item('rug', 'rug', floor(1, 1)),
        item('desk', 'desk', floor(1, 0)),
        item('blinds', 'blinds', floor(4, 4)),
        item('ghost', 'aquarium', floor(3, 3)),
        item('lamp', 'lamp', surface(uid('ghost'), 0)),
      ],
      { size: { w: 4, d: 3 }, window: { wall: 'right', u: 2 } },
    ),
  );

  it('sigue el orden de §6.4', () => {
    const list = buildDrawList(layout, manifest, { sky: 'dusk', owned: { blinds: true, dim: false } });
    const names = frames(list);
    // 1. Piso: 12 baldosas de atrás hacia adelante.
    expect(names.slice(0, 12).every((f) => f === 'floor.oak')).toBe(true);
    // 2. Alfombra. 3. Cielo, tramos de pared (izquierda y derecha intercalados por u), persiana.
    expect(names.slice(12)).toEqual([
      'rug.sage.r0',
      'sky.dusk.right',
      'wall.teal.left',
      'wall.teal.right',
      'wall.teal.left',
      'wall.teal.right',
      'wall.teal.left',
      'window.teal.right',
      'wall.teal.right',
      'blinds.right',
      // 4. Objetos de pared (el de la izquierda mira con r1).
      'frame.home.r1',
      // 5. Piso en orden topológico, con lo de encima justo después del anfitrión.
      'desk.oak.r0',
      'monitor.ink.r0',
      'chair.sage.r2',
    ]);
    // Tipos desconocidos, lo que está encima de ellos y los modificadores no se dibujan.
    expect(list.some((d) => d.uid === uid('ghost') || d.uid === uid('lamp') || d.uid === uid('blinds'))).toBe(false);
    // Piso y paredes no llevan uid; los objetos sí.
    expect([...list.slice(0, 12), ...list.slice(13, 22)].every((d) => d.uid === undefined)).toBe(true);
    expect(order(list)).toEqual(['rug', 'frame', 'desk', 'mon', 'chair']);
  });

  it('coloca cada cuadro con su ancla sobre el punto de apoyo', () => {
    const { ox, oy } = roomArtSize(manifest, layout.size);
    const list = buildDrawList(layout, manifest, day);
    const at = (u: string) => {
      const d = list.find((it) => it.uid === uid(u))!;
      const [axr, ayr] = manifest.frames[d.frame].anchor;
      return [d.x + axr - ox, d.y + ayr - oy];
    };
    expect(at('desk')).toEqual([16, 8]); // esquina trasera de (1, 0)
    expect(at('chair')).toEqual([0, 16]); // esquina trasera de (1, 1)
    expect(at('mon')).toEqual([16, 8 - 14]); // slot 0 del escritorio, a z = 14
    expect(at('frame')).toEqual([-16, 8 - 16]); // pared izquierda, u = 1, fila 1
    const first = list[0];
    expect([first.x + 16 - ox, first.y - oy]).toEqual([0, 0]); // baldosa (0, 0)
  });

  it('sin persiana no hay persiana; el cielo cambia con la hora', () => {
    const names = frames(buildDrawList(layout, manifest, { ...day, sky: 'night' }));
    expect(names).toContain('sky.night.right');
    expect(names).not.toContain('blinds.right');
  });

  it('pantalla tenue y cuadros de animación cuando existen', () => {
    const dim = buildDrawList(layout, manifest, {
      sky: 'day',
      owned: { blinds: false, dim: true },
      anim: { [uid('mon')]: { name: 'wave', frame: 2 }, [uid('chair')]: { name: 'spin', frame: 0 } },
    });
    expect(frames(dim)).toContain('monitor.dim.r0:wave2');
    // La silla no tiene esa animación: queda su cuadro de siempre.
    expect(frames(dim)).toContain('chair.sage.r2');
    const plain = buildDrawList(layout, manifest, { ...day, anim: { [uid('mon')]: { name: 'wave', frame: 1 } } });
    expect(frames(plain)).toContain('monitor.ink.r0:wave1');
  });

  it('lo de encima toma el giro del anfitrión', () => {
    const turned = room([item('desk', 'desk', floor(1, 1, 1)), item('mon', 'monitor', surface(uid('desk'), 1))]);
    const list = buildDrawList(turned, manifest, day);
    expect(frames(list).slice(-2)).toEqual(['desk.oak.r1', 'monitor.ink.r1']);
  });
});

describe('buildDrawList: orden topológico', () => {
  it('corrige el caso donde ordenar por x + y falla (objetos de más de una celda)', () => {
    // Silla en (1, 0) detrás del escritorio en (0, 1)-(1, 1): ambos suman 1, y la silla va antes.
    const layout = room([item('desk', 'desk', floor(0, 1)), item('chair', 'chair', floor(1, 0))]);
    expect(order(buildDrawList(layout, manifest, day))).toEqual(['chair', 'desk']);
    const box = (x0: number, y0: number, x1: number, y1: number, l: number, r: number) => ({ x0, y0, x1, y1, l, r, t: 0, b: 10 });
    // Sin solape en pantalla no hay arista: decide x0 + y0.
    expect(topoOrder([box(0, 1, 2, 2, 0, 10), box(1, 0, 2, 1, 20, 30)])).toEqual([0, 1]);
    expect(topoOrder([box(0, 1, 2, 2, 0, 10), box(1, 0, 2, 1, 5, 30)])).toEqual([1, 0]);
  });

  it('no se cuelga si hay un ciclo (layout inválido con solapes)', () => {
    const b = (x0: number, y0: number) => ({ x0, y0, x1: x0 + 2, y1: y0 + 2, l: 0, r: 10, t: 0, b: 10 });
    expect(topoOrder([b(0, 0), b(1, 1), b(0, 0)]).sort()).toEqual([0, 1, 2]);
  });
});

// ── Propiedad: 1,000 salas aleatorias sin solapes ───────────────────────────────────────────

const FLOOR_TYPES = ['desk', 'chair', 'fan', 'bookshelf', 'lamp', 'plant'];

function randomRoom(rand: () => number, n: number): RoomLayout {
  const w = 2 + Math.floor(rand() * 7);
  const d = 2 + Math.floor(rand() * 7);
  const taken = new Set<string>();
  const items: RoomItem[] = [];
  const tries = 4 + Math.floor(rand() * 40);
  for (let t = 0; t < tries; t++) {
    const type = FLOOR_TYPES[Math.floor(rand() * FLOOR_TYPES.length)];
    const spec = manifest.types[type];
    const rot = spec.facings[Math.floor(rand() * spec.facings.length)] as Facing;
    const [fw, fd] = rotateFootprint(spec.footprint, rot);
    if (fw > w || fd > d) continue;
    const x = Math.floor(rand() * (w - fw + 1));
    const y = Math.floor(rand() * (d - fd + 1));
    const cells: string[] = [];
    for (let j = 0; j < fd; j++) for (let i = 0; i < fw; i++) cells.push(`${x + i},${y + j}`);
    if (cells.some((c) => taken.has(c))) continue;
    cells.forEach((c) => taken.add(c));
    const id = `r${n.toString(36)}t${items.length.toString(36)}`;
    items.push(item(id, type, floor(x, y, rot)));
    if (type === 'desk') {
      if (rand() < 0.7) items.push(item(`${id}a`, 'monitor', surface(uid(id), 0)));
      if (rand() < 0.5) items.push(item(`${id}b`, 'lamp', surface(uid(id), 1)));
    }
  }
  return room(items, { size: { w, d }, window: { wall: rand() < 0.5 ? 'left' : 'right', u: 0 } });
}

/** A va detrás de B (Lebron): detrás en un eje sin estar delante en el otro. */
type Foot = { x0: number; y0: number; x1: number; y1: number; h: number };
const behind = (a: Foot, b: Foot) => (a.x1 <= b.x0 && !(b.y1 <= a.y0)) || (a.y1 <= b.y0 && !(b.x1 <= a.x0));

/**
 * Comprobación geométrica independiente: en un pixel donde se ven las dos cajas, ¿cuál está más
 * cerca? El rayo de vista sube `(1, 1, 16 px)` por celda; gana la caja cuyo tramo del rayo es mayor.
 */
function nearerAt(a: Foot, b: Foot, ax: number, ay: number): number {
  const fx = (ax / 16 + ay / 8) / 2;
  const fy = (ay / 8 - ax / 16) / 2;
  const span = (f: Foot) => {
    const lo = Math.max(f.x0 - fx, f.y0 - fy, 0);
    const hi = Math.min(f.x1 - fx, f.y1 - fy, f.h / 16);
    return lo < hi - 1e-9 ? (lo + hi) / 2 : null;
  };
  const sa = span(a);
  const sb = span(b);
  if (sa === null || sb === null || Math.abs(sa - sb) < 1e-9) return 0;
  return sa > sb ? -1 : 1; // −1: A adelante; 1: B adelante
}

describe('propiedad: el de adelante siempre se dibuja después', () => {
  it('1,000 salas aleatorias sin solapes', () => {
    const rand = rng(20261029);
    const problems: string[] = [];
    let pairs = 0;
    let pixels = 0;
    for (let n = 0; n < 1000; n++) {
      const layout = randomRoom(rand, n);
      const list = buildDrawList(layout, manifest, day);
      const { ox, oy } = roomArtSize(manifest, layout.size);
      const pos = new Map(list.map((d, i) => [d.uid, i] as const));
      const fail = (what: string) => problems.length < 5 && problems.push(`sala ${n}: ${what}`);

      // Todo lo colocado se dibuja una vez, y lo de encima va justo después de su anfitrión.
      if (list.filter((d) => d.uid).length !== layout.items.length) fail('faltan objetos');
      for (const it of layout.items) {
        if (it.place.on !== 'surface') continue;
        const host = it.place.host;
        for (let k = pos.get(host)! + 1; k < pos.get(it.uid)!; k++) {
          const between = layout.items.find((o) => o.uid === list[k].uid)!;
          if (between.place.on !== 'surface' || between.place.host !== host) fail(`${it.uid} lejos de ${host}`);
        }
      }

      const solids = layout.items
        .filter((it) => it.place.on === 'floor')
        .map((it) => {
          const p = it.place as { x: number; y: number; rot: Facing };
          const spec = manifest.types[it.type];
          const [fw, fd] = rotateFootprint(spec.footprint, p.rot);
          const draw = list[pos.get(it.uid)!];
          const frame = manifest.frames[draw.frame];
          const foot: Foot = { x0: p.x, y0: p.y, x1: p.x + fw, y1: p.y + fd, h: spec.height };
          const rect = [draw.x, draw.y, draw.x + frame.rect[2], draw.y + frame.rect[3]];
          return { uid: it.uid, foot, draw, frame, index: pos.get(it.uid)!, rect };
        });

      for (let i = 0; i < solids.length; i++) {
        for (let j = 0; j < solids.length; j++) {
          if (i === j) continue;
          const A = solids[i];
          const B = solids[j];
          const l = Math.max(A.rect[0], B.rect[0]);
          const t = Math.max(A.rect[1], B.rect[1]);
          const r = Math.min(A.rect[2], B.rect[2]);
          const b = Math.min(A.rect[3], B.rect[3]);
          if (l >= r || t >= b) continue;
          // Regla de la especificación: si A está detrás de B y sus cajas se pisan, A va antes.
          if (behind(A.foot, B.foot)) {
            pairs++;
            if (A.index > B.index) fail(`${A.uid} detrás de ${B.uid} pero va después`);
          }
          // Verdad geométrica independiente, pixel a pixel donde se ven las dos máscaras
          // (una sala de cada cuatro y un pixel de cada cuatro, para que la prueba tarde poco).
          if (j < i || n % 4) continue;
          for (let py = t; py < b; py += 2) {
            for (let px = l; px < r; px += 2) {
              if (!maskBit(A.frame.mask, A.frame.rect[2], px - A.draw.x, py - A.draw.y)) continue;
              if (!maskBit(B.frame.mask, B.frame.rect[2], px - B.draw.x, py - B.draw.y)) continue;
              const front = nearerAt(A.foot, B.foot, px + 0.5 - ox, py + 0.5 - oy);
              if (!front) continue;
              pixels++;
              if (front === 1 ? A.index > B.index : B.index > A.index) fail(`pixel (${px}, ${py}) de ${A.uid}/${B.uid}`);
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
    // Que la prueba de verdad haya revisado algo.
    expect(pairs).toBeGreaterThan(1000);
    expect(pixels).toBeGreaterThan(10000);
  });
});
