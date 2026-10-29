import { buildDrawList } from '@/components/room/depth';
import { autoPlaceWithHost, defaultLayout, earnedTypes, ownedModifiers, uidMaker, validateLayout } from '@/components/room/layout';
import { MANIFEST } from '@/components/room/manifest';
import type { Sky } from '@/components/room/types';
import { ITEM_FOR_ADJUSTMENT } from '@/lib/desk';

/** El manifiesto generado por docs/brand/draw_room.py, probado contra la lógica del cuarto. */
const ALL_TRIED = Object.keys(ITEM_FOR_ADJUSTMENT);
const SPACES = ['5f0c2b8e-1a3d-4e6f-9b7a-0c1d2e3f4a5b', 'b7e1d9a4-2c3f-4b5a-8e6d-7f8a9b0c1d2e', 'office-1', 'casa'];
const SKIES: Sky[] = ['dawn', 'day', 'dusk', 'night'];

describe('manifiesto real', () => {
  it('trae los mismos ajustes que "Tu escritorio" (desk.ts)', () => {
    const fromManifest = new Set(Object.values(MANIFEST.types).flatMap((t) => t.adjustments ?? []));
    expect([...fromManifest].sort()).toEqual([...ALL_TRIED].sort());
  });

  it.each(SPACES)('el cuarto por defecto de %s es válido con todo lo ganado', (space) => {
    const owned = earnedTypes(MANIFEST, ALL_TRIED);
    const layout = defaultLayout(space, MANIFEST, owned, uidMaker(space));
    expect(validateLayout(layout, MANIFEST, owned)).toEqual([]);
  });

  it.each(SPACES)('con lo primero que se gana, el objeto aparece en el cuarto de %s', (space) => {
    for (const adjustment of ALL_TRIED) {
      const owned = earnedTypes(MANIFEST, [adjustment]);
      const layout = defaultLayout(space, MANIFEST, owned, uidMaker(space));
      const earned = owned.filter((t) => !MANIFEST.types[t].base && !MANIFEST.types[t].decor && !MANIFEST.types[t].modifies);
      for (const type of earned) expect({ adjustment, type, inRoom: layout.items.some((i) => i.type === type) }).toEqual({ adjustment, type, inRoom: true });
    }
  });

  it.each(SPACES)('cada cuadro que pide la lista de dibujo existe (%s)', (space) => {
    const owned = earnedTypes(MANIFEST, ALL_TRIED);
    const layout = defaultLayout(space, MANIFEST, owned, uidMaker(space));
    for (const sky of SKIES) {
      const list = buildDrawList(layout, MANIFEST, { sky, owned: ownedModifiers(MANIFEST, owned) });
      expect(list.length).toBeGreaterThan(0);
      const missing = list.filter((d) => !MANIFEST.frames[d.frame]).map((d) => d.frame);
      expect(missing).toEqual([]);
    }
  });

  it('cada objeto colocable se puede poner en un cuarto vacío de base', () => {
    const owned = earnedTypes(MANIFEST, []);
    const base = defaultLayout('vacío', MANIFEST, owned, uidMaker('vacío'));
    const makeUid = uidMaker('poner');
    for (const [type, spec] of Object.entries(MANIFEST.types)) {
      if (spec.modifies || !spec.place.length || base.items.some((i) => i.type === type)) continue;
      const next = autoPlaceWithHost(base, MANIFEST, type, spec.variants[0], makeUid);
      expect({ type, placed: !!next }).toEqual({ type, placed: true });
      if (next) expect(validateLayout(next, MANIFEST, earnedTypes(MANIFEST, ALL_TRIED))).toEqual([]);
    }
  });
});
