import { buildDrawList } from '../depth';
import {
  autoPlace,
  defaultLayout,
  earnedTypes,
  migrate,
  ownedModifiers,
  uidMaker,
  UID_RE,
  utf8Length,
  validateLayout,
} from '../layout';
import type { RoomLayout } from '../types';
import { catalog, manifest } from './fixtures/manifest';
import { deepFreeze, floor, item, room, surface, uid } from './fixtures/rooms';

/**
 * En los casos, `owned` son los ajustes que la persona probó (como `GET /v1/progress` y el
 * `validate` de Rust); aquí se convierten a tipos con `earnedTypes`.
 */
type Case = { description: string; owned: string[]; layout: unknown; problems: string[] };

// Los casos se leen de la carpeta (Node, en Jest) para que uno nuevo no se quede sin probar.
// La app no carga los tipos de Node, así que se declaran aquí los dos que se usan.
declare const __dirname: string;
/* eslint-disable @typescript-eslint/no-require-imports */
const fs: { readdirSync(dir: string): string[]; readFileSync(file: string, encoding: 'utf8'): string } = require('fs');
const path: { join(...parts: string[]): string } = require('path');
/* eslint-enable @typescript-eslint/no-require-imports */

const DIR = path.join(__dirname, 'fixtures', 'layouts');
const CASES = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json') && f !== 'catalog.json')
  .map((f) => [f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as Case] as const);

describe('validateLayout: casos JSON compartidos con la API', () => {
  it('hay casos válidos e inválidos', () => {
    expect(CASES.filter(([, c]) => c.problems.length === 0).length).toBeGreaterThanOrEqual(3);
    expect(CASES.filter(([, c]) => c.problems.length > 0).length).toBeGreaterThanOrEqual(6);
  });

  it.each(CASES)('%s', (_file, c) => {
    const owned = earnedTypes(catalog, c.owned);
    expect(validateLayout(c.layout, catalog, owned)).toEqual(c.problems);
    // El mismo resultado con el manifiesto completo (tiene `wallHeight` y cuadros).
    expect(validateLayout(c.layout, manifest, owned)).toEqual(c.problems);
    // Y los válidos se dibujan sin perder lo conocido.
    if (!c.problems.length) {
      const layout = c.layout as RoomLayout;
      const drawn = buildDrawList(layout, manifest, { sky: 'day', owned: { blinds: false, dim: false } });
      expect(drawn.length).toBeGreaterThan(0);
    }
  });
});

describe('validateLayout: forma y límites', () => {
  const ok = room([item('chair', 'chair', floor(0, 0))]);

  it('rechaza lo que no es un layout v1', () => {
    expect(validateLayout(null, catalog, [])).toEqual(['layout: invalid']);
    expect(validateLayout([], catalog, [])).toEqual(['layout: invalid']);
    expect(validateLayout({ ...ok, v: undefined }, catalog, [])).toEqual(['v: invalid']);
    expect(validateLayout({ ...ok, v: '1' }, catalog, [])).toEqual(['v: invalid']);
    expect(validateLayout({ ...ok, v: 3 }, catalog, [])).toEqual(['v: unsupported']);
    expect(validateLayout({ ...ok, size: { w: 0, d: 5 } }, catalog, [])).toEqual(['size: invalid']);
    expect(validateLayout({ ...ok, size: { w: 2.5, d: 5 } }, catalog, [])).toEqual(['size: invalid']);
    expect(validateLayout({ ...ok, shell: { floor: 'oak', wall: 'teal' } }, catalog, [])).toEqual(['shell: invalid']);
    expect(validateLayout({ ...ok, items: {} }, catalog, [])).toEqual(['items: invalid']);
    expect(validateLayout({ ...ok, pinned: undefined }, catalog, [])).toEqual(['pinned: invalid']);
    expect(validateLayout(ok, catalog, [])).toEqual([]);
  });

  it('objetos y lugares mal formados', () => {
    const bad = {
      ...ok,
      items: [
        42,
        { uid: 'ffff0001', type: 'chair', variant: 'sage', place: { on: 'ceiling' } },
        { uid: 'ffff0002', type: 'chair', variant: 'sage', place: { on: 'floor', x: 1.5, y: 0, rot: 0 } },
        { uid: 'ffff0003', type: 'chair', variant: 'sage', place: { on: 'floor', x: 2, y: 0, rot: 5 } },
        { uid: 'ffff0004', type: 'aquarium', variant: 'x', place: { on: 'shelf' } },
        { uid: 'ffff0005', type: 'chair', variant: 'sage', place: { on: 'floor', x: 4, y: 4, rot: 0 } },
      ],
    };
    expect(validateLayout(bad, catalog, [])).toEqual([
      'items[0]: invalid',
      'items[1].place: invalid',
      'items[2].place: invalid',
      'items[3].place: invalid',
      'items[4].place: invalid',
    ]);
  });

  it('no cae en propiedades de Object.prototype', () => {
    const sneaky = {
      ...ok,
      items: [
        { uid: 'gggg0001', type: 'constructor', variant: 'x', place: { on: 'floor', x: 0, y: 0, rot: 0 } },
        { uid: 'gggg0002', type: '__proto__', variant: 'x', place: { on: 'floor', x: 0, y: 0, rot: 0 } },
        { uid: 'gggg0003', type: 'lamp', variant: 'warm', place: { on: 'surface', host: '__proto__', slot: 0 } },
      ],
    };
    expect(validateLayout(sneaky, catalog, ['lamp'])).toEqual(['items[2].place: no-slot']);
  });

  it('máximo 60 objetos y 16 KB', () => {
    const many = (n: number, variant = 'x') =>
      Array.from({ length: n }, (_, i) => ({
        uid: `h${i.toString().padStart(7, '0')}`,
        type: 'aquarium',
        variant,
        place: { on: 'floor', x: 0, y: 0, rot: 0 },
      }));
    expect(validateLayout({ ...ok, items: many(60) }, catalog, [])).toEqual([]);
    expect(validateLayout({ ...ok, items: many(61) }, catalog, [])).toEqual(['items: too-many']);
    expect(validateLayout({ ...ok, items: many(60, 'v'.repeat(200)) }, catalog, [])).toEqual(['layout: too-large']);
  });

  it('cuenta bytes en UTF-8', () => {
    expect(utf8Length('abc')).toBe(3);
    expect(utf8Length('Lámpara')).toBe(8);
    expect(utf8Length('€')).toBe(3);
    expect(utf8Length('🪴')).toBe(4);
  });
});

describe('migrate', () => {
  it('v1 pasa tal cual', () => {
    const layout = room([]);
    const r = migrate(layout);
    expect(r).toEqual({ ok: true, layout });
    expect(r.ok && r.layout).toBe(layout);
  });

  it('completa el corcho si falta', () => {
    const { pinned: _pinned, ...rest } = room([]);
    const r = migrate(rest);
    expect(r.ok && r.layout.pinned).toEqual([]);
  });

  it('una versión más nueva pide actualizar la app; lo demás es inválido', () => {
    expect(migrate({ ...room([]), v: 2 })).toEqual({ ok: false, reason: 'newer' });
    expect(migrate({ ...room([]), v: 0 })).toEqual({ ok: false, reason: 'invalid' });
    expect(migrate('{}')).toEqual({ ok: false, reason: 'invalid' });
    expect(migrate({ v: 1 })).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('lo que tiene la persona', () => {
  it('base y decoración desde el primer día, más lo de cada ajuste probado', () => {
    expect(earnedTypes(manifest, [])).toEqual(['desk', 'chair', 'monitor', 'plant', 'bookshelf', 'rug', 'shelf']);
    expect(earnedTypes(manifest, ['ask_lighting', 'close_blinds', 'no_change'])).toEqual([
      'desk',
      'chair',
      'monitor',
      'plant',
      'lamp',
      'bookshelf',
      'rug',
      'shelf',
      'blinds',
    ]);
  });

  it('modificadores: persiana y pantalla tenue', () => {
    expect(ownedModifiers(manifest, ['desk', 'blinds'])).toEqual({ blinds: true, dim: false });
    expect(ownedModifiers(manifest, ['screenDim', 'ghost'])).toEqual({ blinds: false, dim: true });
  });

  it('uidMaker: determinista, 8 caracteres [a-z0-9]', () => {
    const a = uidMaker('space-1');
    const b = uidMaker('space-1');
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const u = a();
      expect(u).toMatch(UID_RE);
      expect(b()).toBe(u);
      seen.add(u);
    }
    expect(seen.size).toBe(500);
    expect(uidMaker('space-2')()).not.toBe(uidMaker('space-1')());
  });
});

describe('autoPlace', () => {
  const desk = deepFreeze(room([item('desk', 'desk', floor(1, 0)), item('mon', 'monitor', surface(uid('desk'), 0))]));
  const ids = uidMaker('auto');
  const added = (before: RoomLayout, after: RoomLayout | null) => {
    expect(after).not.toBeNull();
    // Nunca reacomoda: lo que estaba sigue igual y en el mismo orden.
    expect(after!.items.slice(0, before.items.length)).toEqual(before.items);
    expect(after!.items).toHaveLength(before.items.length + 1);
    return after!.items[after!.items.length - 1];
  };

  it('lo de superficie va al slot libre del escritorio', () => {
    expect(added(desk, autoPlace(desk, manifest, 'lamp', 'warm', ids)).place).toEqual(surface(uid('desk'), 1));
  });

  it('si el escritorio está lleno, al piso junto a la pared', () => {
    const full = room([...desk.items, item('plant', 'plant', surface(uid('desk'), 1))]);
    expect(added(full, autoPlace(full, manifest, 'lamp', 'warm', ids)).place).toEqual(floor(0, 0));
    // Sin pegarse a la silla: (0, 1) queda libre para moverla, así que va a (0, 2).
    const corner = room([...full.items, item('chair', 'chair', floor(0, 0))]);
    expect(added(corner, autoPlace(corner, manifest, 'lamp', 'warm', ids)).place).toEqual(floor(0, 2));
    // Pero si no hay otro lugar, igual cabe junto a ella.
    const tight = room([item('chair', 'chair', floor(0, 0))], { size: { w: 2, d: 1 } });
    expect(added(tight, autoPlace(tight, manifest, 'lamp', 'warm', ids)).place).toEqual(floor(1, 0));
  });

  it('cuadros a media altura y al centro, sin tapar la ventana', () => {
    expect(added(desk, autoPlace(desk, manifest, 'frame', 'home', ids)).place).toEqual({ on: 'wall', wall: 'left', u: 2, row: 1 });
    const leftWin = room(desk.items, { window: { wall: 'left', u: 2 } });
    expect(added(leftWin, autoPlace(leftWin, manifest, 'frame', 'home', ids)).place).toEqual({ on: 'wall', wall: 'right', u: 2, row: 1 });
  });

  it('alfombras al centro', () => {
    expect(added(desk, autoPlace(desk, manifest, 'rug', 'sage', ids)).place).toEqual(floor(1, 1));
  });

  it('null si no hay lugar, si es modificador o si no existe', () => {
    const tiny = room([item('c1', 'chair', floor(0, 0)), item('c2', 'chair', floor(1, 0))], { size: { w: 2, d: 1 } });
    expect(autoPlace(tiny, manifest, 'chair', 'sage', ids)).toBeNull();
    expect(autoPlace(desk, manifest, 'blinds', 'linen', ids)).toBeNull();
    expect(autoPlace(desk, manifest, 'aquarium', 'x', ids)).toBeNull();
  });

  it('pide otro uid si el primero ya existe; falla claro si nunca da uno válido', () => {
    const queue = [uid('desk'), 'NOPE', 'zzzz9999'];
    const next = added(desk, autoPlace(desk, manifest, 'fan', 'mint', () => queue.shift()!));
    expect(next.uid).toBe('zzzz9999');
    expect(() => autoPlace(desk, manifest, 'fan', 'mint', () => uid('desk'))).toThrow(/makeUid/);
  });
});

describe('defaultLayout', () => {
  const everything = Object.values(manifest.types).flatMap((t) => t.adjustments ?? []);
  const ownedAll = earnedTypes(manifest, everything);
  const make = (id: string, owned = ownedAll, size?: { w: number; d: number }) =>
    defaultLayout(id, manifest, owned, uidMaker(id), size);

  it('es determinista por espacio', () => {
    expect(make('space-a')).toEqual(make('space-a'));
    const ids = Array.from({ length: 40 }, (_, i) => `space-${i}`);
    expect(new Set(ids.map((id) => JSON.stringify(make(id)))).size).toBeGreaterThan(10);
  });

  it('escritorio contra la pared derecha con pantalla, planta en el piso, silla enfrente mirándolo', () => {
    const l = make('casa', earnedTypes(manifest, []));
    const desk = l.items.find((it) => it.type === 'desk')!;
    expect(desk.place).toMatchObject({ on: 'floor', y: 0, rot: 0 });
    const x = (desk.place as { x: number }).x;
    expect(l.items.find((it) => it.type === 'monitor')!.place).toEqual(surface(desk.uid, 0));
    // La planta prefiere el piso: el segundo lugar del escritorio queda libre para lo primero que se gane.
    expect(l.items.find((it) => it.type === 'plant')!.place.on).toBe('floor');
    expect(l.items.some((it) => it.place.on === 'surface' && it.place.slot === 1)).toBe(false);
    expect(l.items.find((it) => it.type === 'chair')!.place).toEqual(floor(x, 1, 2));
    // Solo la base: la decoración espera en el inventario.
    expect(l.items.map((it) => it.type).sort()).toEqual(['chair', 'desk', 'monitor', 'plant']);
    expect(l.shell).toMatchObject({ floor: 'oak', wall: 'teal' });
    expect(l.pinned).toEqual([]);
  });

  it('agrega lo ganado en lugares libres, sin modificadores', () => {
    const l = make('oficina');
    const types = l.items.map((it) => it.type);
    expect(types).toEqual(expect.arrayContaining(['lamp', 'fan', 'frame']));
    expect(types).not.toContain('blinds');
    expect(types).not.toContain('screenDim');
    expect(types).not.toContain('rug');
    expect(l.items.find((it) => it.type === 'frame')!.place.on).toBe('wall');
  });

  it('siempre es válida, con la ventana en una de las paredes y lejos de las esquinas', () => {
    const walls = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const size = i % 3 === 0 ? { w: 3 + (i % 6), d: 3 + ((i >> 2) % 6) } : undefined;
      const l = make(`space-${i}`, ownedAll, size);
      expect(validateLayout(l, catalog, ownedAll)).toEqual([]);
      walls.add(l.shell.window.wall);
      const len = l.shell.window.wall === 'left' ? l.size.d : l.size.w;
      expect(l.shell.window.u).toBeGreaterThanOrEqual(1);
      expect(l.shell.window.u).toBeLessThanOrEqual(len - 2);
    }
    expect(walls).toEqual(new Set(['left', 'right']));
  });
});
