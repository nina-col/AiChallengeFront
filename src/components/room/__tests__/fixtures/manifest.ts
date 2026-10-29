import { encodeMask } from '../../hit';
import { rotateFootprint } from '../../iso';
import type { Facing, Frame, Manifest, RoomCatalog, Sky, TypeSpec, Wall } from '../../types';
import catalogJson from './layouts/catalog.json';

/**
 * Manifiesto de prueba: los tipos de `layouts/catalog.json` (el mismo catálogo que usarán los casos
 * de Rust) con cuadros calculados a partir de la geometría, como los haría el generador: cajas
 * con contorno de 1 px para piso y superficie, paneles planos para la pared, y máscaras de 1 bit.
 */

export const catalog = catalogJson as unknown as RoomCatalog & { wallHeight: number };

/** Sprite antes de empacar: tamaño, ancla y qué puntos (relativos al ancla) son opacos. */
type Sprite = { w: number; h: number; anchor: [number, number]; inside: (sx: number, sy: number) => boolean };

/** Caja de `fw × fd` celdas y `h` px de alto, con contorno de 1 px. */
export function boxSprite(fw: number, fd: number, h: number): Sprite {
  return {
    w: (fw + fd) * 16 + 2,
    h: (fw + fd) * 8 + h + 2,
    anchor: [fd * 16 + 1, h + 1],
    inside: (sx, sy) => {
      // Sube el punto de 0 a h px y mira si cae en la huella: (fx, fy) crecen igual con la altura.
      const fx = (sx / 16 + sy / 8) / 2;
      const fy = (sy / 8 - sx / 16) / 2;
      return Math.max(0, -fx, -fy) <= Math.min(h / 16, fw - fx, fd - fy);
    },
  };
}

/** Panel plano sobre una pared: `span` celdas de largo y `tall` filas de 16 px, con contorno. */
export function wallSprite(wall: Wall, span: number, tall: number): Sprite {
  const right = wall === 'right';
  return {
    w: span * 16 + 2,
    h: span * 8 + tall * 16 + 2,
    anchor: [right ? 1 : span * 16 + 1, tall * 16 + 1],
    inside: (sx, sy) => {
      const t = (right ? sx : -sx) / 16;
      const z = 8 * t - sy;
      return t >= 0 && t <= span && z >= 0 && z <= tall * 16;
    },
  };
}

function maskOf(s: Sprite) {
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < s.w && y < s.h && s.inside(x + 0.5 - s.anchor[0], y + 0.5 - s.anchor[1]);
  const bits: number[] = [];
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const on = solid(x, y) || solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1);
      bits.push(on ? 1 : 0);
    }
  }
  return encodeMask(bits);
}

const SKIES: Sky[] = ['dawn', 'day', 'dusk', 'night'];
const WALLS: Wall[] = ['left', 'right'];
const WALL_ROWS = catalog.wallHeight / 16;

function spritesFor(type: string, spec: TypeSpec): [string, Sprite][] {
  if (spec.modifies) return [];
  const out: [string, Sprite][] = [];
  const variants = type === 'monitor' ? [...spec.variants, 'dim'] : spec.variants;
  for (const variant of variants) {
    for (const facing of spec.facings) {
      const sprite = spec.place.includes('wall')
        ? wallSprite(facing === 0 ? 'right' : 'left', spec.footprint[0], spec.footprint[1])
        : boxSprite(...rotateFootprint(spec.footprint, facing), spec.height);
      const name = `${type}.${variant}.r${facing as Facing}`;
      out.push([name, sprite]);
      for (const [anim, count] of Object.entries(spec.anim ?? {})) {
        for (let n = 0; n < count; n++) out.push([`${name}:${anim}${n}`, sprite]);
      }
    }
  }
  return out;
}

const tile: Sprite = {
  w: 32,
  h: 16,
  anchor: [16, 0],
  inside: (sx, sy) => Math.abs(sx) / 16 + Math.abs(sy - 8) / 8 <= 1,
};

const sprites: [string, Sprite][] = [
  ...catalog.shell.floors.map((v): [string, Sprite] => [`floor.${v}`, tile]),
  ...catalog.shell.walls.flatMap((v) =>
    WALLS.flatMap((wall): [string, Sprite][] => [
      [`wall.${v}.${wall}`, wallSprite(wall, 1, WALL_ROWS)],
      [`window.${v}.${wall}`, wallSprite(wall, 1, WALL_ROWS)],
    ]),
  ),
  ...SKIES.flatMap((sky) => WALLS.map((wall): [string, Sprite] => [`sky.${sky}.${wall}`, wallSprite(wall, 1, 2)])),
  ...WALLS.map((wall): [string, Sprite] => [`blinds.${wall}`, wallSprite(wall, 1, 2)]),
  ...Object.entries(catalog.types).flatMap(([type, spec]) => spritesFor(type, spec)),
];

/** Empaque por estantes de 512 px con 1 px de separación (como el generador). */
function pack(list: [string, Sprite][]) {
  const frames: Record<string, Frame> = {};
  let x = 0;
  let y = 0;
  let row = 0;
  for (const [name, s] of list) {
    if (x + s.w > 512) {
      x = 0;
      y += row + 1;
      row = 0;
    }
    frames[name] = { rect: [x, y, s.w, s.h], anchor: s.anchor, mask: maskOf(s) };
    x += s.w + 1;
    row = Math.max(row, s.h);
  }
  return { frames, size: [512, y + row] as [number, number] };
}

const packed = pack(sprites);

export const manifest: Manifest = {
  tile: [32, 16],
  voxelsPerTile: 8,
  wallHeight: catalog.wallHeight,
  atlasSize: packed.size,
  shell: catalog.shell,
  types: catalog.types,
  frames: packed.frames,
};
