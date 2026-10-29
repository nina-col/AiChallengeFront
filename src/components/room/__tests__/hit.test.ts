import { buildDrawList } from '../depth';
import { cycleHit, encodeMask, hitCandidates, hitTest, maskBit } from '../hit';
import { cellToArt, roomArtSize } from '../iso';
import type { Manifest } from '../types';
import { manifest } from './fixtures/manifest';
import { floor, item, rng, room, surface, uid, wall } from './fixtures/rooms';

describe('máscaras', () => {
  it('codifica por filas, sin relleno, el primer pixel en el bit alto', () => {
    expect(encodeMask([1, 0, 0, 0, 0, 0, 0, 0])).toBe('gA==');
    expect(encodeMask([0, 0, 0, 0, 0, 0, 0, 1, 1])).toBe('AYA=');
    expect(encodeMask([])).toBe('');
  });

  it('ida y vuelta en máscaras aleatorias de muchos anchos', () => {
    const rand = rng(7);
    for (let w = 1; w <= 21; w++) {
      for (let h = 1; h <= 9; h += 2) {
        const bits = Array.from({ length: w * h }, () => (rand() < 0.4 ? 1 : 0));
        const mask = encodeMask(bits);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) expect(maskBit(mask, w, x, y)).toBe(bits[y * w + x] === 1);
      }
    }
  });

  it('fuera de la máscara no hay nada', () => {
    expect(maskBit('gA==', 8, 0, 5)).toBe(false);
  });
});

describe('hitTest', () => {
  const layout = room([
    item('desk', 'desk', floor(1, 0)),
    item('plant', 'plant', surface(uid('desk'), 1)),
    item('chair', 'chair', floor(1, 1, 2)),
    item('frame', 'frame', wall('left', 2, 1)),
  ]);
  const list = buildDrawList(layout, manifest, { sky: 'day', owned: { blinds: false, dim: false } });
  const { ox, oy } = roomArtSize(manifest, layout.size);
  /** Punto del lienzo a partir de px de arte del piso. */
  const at = (ax: number, ay: number): [number, number] => [ox + ax, oy + ay];
  const hit = (p: [number, number], nearestPx?: number) => hitTest(list, manifest, p[0], p[1], { nearestPx });

  it('toca el objeto de adelante con su máscara', () => {
    expect(hit(at(0, 31))).toBe(uid('chair')); // justo arriba de la esquina delantera de la silla
    expect(hit(at(46, 22))).toBe(uid('desk')); // punta derecha del escritorio
    expect(hit(at(32, -8))).toBe(uid('plant')); // la planta sobre el slot 1, a z = 24
    const f = cellToArt(0, 2.5, 24);
    expect(hit(at(f.ax, f.ay))).toBe(uid('frame'));
  });

  it('el piso, las paredes y el cielo no se tocan', () => {
    const c = cellToArt(4.5, 4.5);
    expect(hit(at(c.ax, c.ay))).toBeNull();
    const bare = cellToArt(0, 4.5, 30);
    expect(hit(at(bare.ax, bare.ay))).toBeNull();
    expect(hit([-50, -50])).toBeNull();
  });

  it('una caja transparente deja pasar el toque al de atrás', () => {
    // Dentro del rectángulo de la planta pero fuera de su silueta: cae en el escritorio.
    const plant = list.find((d) => d.uid === uid('plant'))!;
    const [, , w, h] = manifest.frames[plant.frame].rect;
    const p: [number, number] = [plant.x + w - 1.5, plant.y + h - 1.5];
    expect(p[0] < plant.x + w && p[1] < plant.y + h).toBe(true);
    expect(hitCandidates(list, manifest, p[0], p[1])).not.toContain(uid('plant'));
    expect(hit(p)).toBe(uid('desk'));
  });

  it('si no toca nada, elige el más cercano a nearestPx o menos', () => {
    const p = at(-21, 24); // 4 px a la izquierda de la silla, sobre el piso vacío
    expect(hit(p)).toBeNull();
    expect(hit(p, 2)).toBeNull();
    expect(hit(p, 6)).toBe(uid('chair'));
  });

  it('sin máscara cuenta toda la caja', () => {
    const chair = list.find((d) => d.uid === uid('chair'))!;
    const bare: Manifest = { ...manifest, frames: { ...manifest.frames, [chair.frame]: { ...manifest.frames[chair.frame], mask: '' } } };
    expect(hitTest(list, bare, chair.x + 0.5, chair.y + 0.5)).toBe(uid('chair'));
    expect(hitTest(list, manifest, chair.x + 0.5, chair.y + 0.5)).not.toBe(uid('chair'));
  });

  it('tocar otra vez en el mismo punto recorre los que se pisan', () => {
    const p = at(2, 6); // respaldo de la silla sobre el frente del escritorio
    expect(hitCandidates(list, manifest, p[0], p[1])).toEqual([uid('chair'), uid('desk')]);
    expect(cycleHit(list, manifest, p[0], p[1], null)).toBe(uid('chair'));
    expect(cycleHit(list, manifest, p[0], p[1], uid('chair'))).toBe(uid('desk'));
    expect(cycleHit(list, manifest, p[0], p[1], uid('desk'))).toBe(uid('chair'));
    expect(cycleHit(list, manifest, p[0], p[1], uid('frame'))).toBe(uid('chair'));
    const near = at(-21, 24);
    expect(cycleHit(list, manifest, near[0], near[1], null, { nearestPx: 6 })).toBe(uid('chair'));
  });
});
