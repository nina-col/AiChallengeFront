import {
  artToCell,
  cellToArt,
  footprintCells,
  pickScale,
  roomArtSize,
  rotateCell,
  rotateFootprint,
  touchToArt,
  wallRows,
  wallToArt,
} from '../iso';
import { manifest } from './fixtures/manifest';

describe('cellToArt / artToCell', () => {
  it('cumple la comprobación de tecnica.md §6.1', () => {
    expect(cellToArt(1, 0)).toEqual({ ax: 16, ay: 8 });
    expect(cellToArt(1.5, 0.5)).toEqual({ ax: 16, ay: 16 });
    expect(artToCell(16, 16, 5, 5)).toEqual({ x: 1, y: 0 });
    expect(cellToArt(0, 0, 14)).toEqual({ ax: 0, ay: -14 });
  });

  it('ida y vuelta en todos los centros de una sala de 8 × 8', () => {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const { ax, ay } = cellToArt(x + 0.5, y + 0.5);
        expect(artToCell(ax, ay, 8, 8)).toEqual({ x, y });
      }
    }
  });

  it('asigna siempre los bordes y esquinas a la misma celda (la de índice mayor)', () => {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        // Esquina trasera: pertenece a la celda que empieza ahí.
        const corner = cellToArt(x, y);
        expect(artToCell(corner.ax, corner.ay, 8, 8)).toEqual({ x, y });
        // Punto medio del borde entre (x − 1, y) y (x, y): siempre (x, y).
        const edge = cellToArt(x, y + 0.5);
        expect(artToCell(edge.ax, edge.ay, 8, 8)).toEqual({ x, y });
      }
    }
  });

  it('da null fuera del piso', () => {
    expect(artToCell(0, -0.5, 5, 5)).toBeNull();
    const front = cellToArt(5, 5);
    expect(artToCell(front.ax, front.ay, 5, 5)).toBeNull();
    const right = cellToArt(5.5, 0.5);
    expect(artToCell(right.ax, right.ay, 5, 5)).toBeNull();
    const left = cellToArt(0.5, 5.5);
    expect(artToCell(left.ax, left.ay, 5, 5)).toBeNull();
  });

  it('convierte toques a px de arte del lienzo', () => {
    // 2 pt por px de arte en @3x (k = 6): 100 pt → 50 px de arte.
    expect(touchToArt(100, 40, 6, 3)).toEqual({ ax: 50, ay: 20 });
  });
});

describe('pickScale', () => {
  // Tabla de tecnica.md §5.3: sala de 5 × 5 (164 px de arte) con 16 pt de margen por lado.
  it.each([
    ['iPhone SE 2/3', 375, 2, 4],
    ['iPhone 11 / XR', 414, 2, 4],
    ['iPhone 12/13 mini', 375, 3, 6],
    ['iPhone 15/16', 393, 3, 6],
    ['iPhone 16 Pro Max', 440, 3, 7],
    ['Android 411 dp @2.625', 411, 2.625, 6],
  ])('%s', (_name, pt, pr, k) => {
    expect(pickScale(pt - 32, 164, pr)).toBe(k);
  });

  it('nunca baja de 1', () => {
    expect(pickScale(10, 164, 1)).toBe(1);
  });
});

describe('roomArtSize', () => {
  it('mide como en §5.4 (paredes de 48 px)', () => {
    expect(roomArtSize(manifest, { w: 5, d: 5 })).toEqual({ w: 164, h: 132, ox: 82, oy: 50 });
    expect(roomArtSize(manifest, { w: 6, d: 6 })).toMatchObject({ w: 196, h: 148 });
    expect(roomArtSize(manifest, { w: 8, d: 8 })).toMatchObject({ w: 260, h: 180 });
  });

  it('deja el piso y las paredes dentro del lienzo', () => {
    const { w, h, ox, oy } = roomArtSize(manifest, { w: 6, d: 3 });
    const corners = [
      cellToArt(0, 0, 48),
      cellToArt(6, 0, 48),
      cellToArt(0, 3, 48),
      cellToArt(6, 3),
      cellToArt(6, 0),
      cellToArt(0, 3),
    ];
    for (const { ax, ay } of corners) {
      expect(ox + ax).toBeGreaterThanOrEqual(0);
      expect(ox + ax).toBeLessThanOrEqual(w);
      expect(oy + ay).toBeGreaterThanOrEqual(0);
      expect(oy + ay).toBeLessThanOrEqual(h);
    }
  });

  it('cuenta 3 filas de pared y apoya los tramos en su esquina trasera', () => {
    expect(wallRows(manifest)).toBe(3);
    expect(wallRows({})).toBe(3);
    expect(wallToArt('right', 2, 16)).toEqual(cellToArt(2, 0, 16));
    expect(wallToArt('left', 2)).toEqual(cellToArt(0, 2));
  });
});

describe('huellas y giro', () => {
  it('cambia ancho por fondo en giros impares', () => {
    expect(rotateFootprint([2, 1], 0)).toEqual([2, 1]);
    expect(rotateFootprint([2, 1], 1)).toEqual([1, 2]);
    expect(rotateFootprint([2, 1], 2)).toEqual([2, 1]);
    expect(rotateFootprint([2, 1], 3)).toEqual([1, 2]);
  });

  it('gira celdas relativas como el generador: (x, y) → (d − 1 − y, x)', () => {
    expect(rotateCell(1, 0, [2, 1], 0)).toEqual([1, 0]);
    expect(rotateCell(1, 0, [2, 1], 1)).toEqual([0, 1]);
    expect(rotateCell(0, 0, [2, 1], 1)).toEqual([0, 0]);
    expect(rotateCell(1, 0, [2, 1], 2)).toEqual([0, 0]);
    expect(rotateCell(0, 0, [2, 1], 2)).toEqual([1, 0]);
    expect(rotateCell(1, 0, [2, 1], 3)).toEqual([0, 0]);
    // Siempre cae dentro de la huella girada, y cuatro cuartos de vuelta la dejan igual.
    for (let r = 0; r < 4; r++) {
      for (const [cx, cy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [2, 1],
      ]) {
        const [x, y] = rotateCell(cx, cy, [3, 2], r);
        const [w, d] = rotateFootprint([3, 2], r);
        expect(x >= 0 && x < w && y >= 0 && y < d).toBe(true);
      }
    }
    expect(rotateCell(2, 1, [3, 2], 4)).toEqual([2, 1]);
  });

  it('lista las celdas que cubre un objeto de piso', () => {
    expect(footprintCells({ footprint: [2, 1] }, 1, 3, 2)).toEqual([
      [3, 2],
      [3, 3],
    ]);
  });
});
