/**
 * Pintar por números: tres dibujos propios de 10 × 10. Sin tiempo, sin puntos y sin errores: tocar
 * una casilla con otro número no hace nada. Lo pintado vive solo mientras dura el juego.
 */
export type Picture = { id: string; colors: string[]; rows: string[] };

/** En `rows`, 0 es el fondo (ya está) y 1…n son los colores de `colors`. */
export const PICTURES: Picture[] = [
  {
    id: 'plant',
    colors: ['#6f9f6a', '#3f6f55', '#b86a45', '#e9b58c'],
    rows: [
      '0000110000',
      '0110110110',
      '0111111110',
      '0012112100',
      '0001221000',
      '0000220000',
      '0033333300',
      '0034444300',
      '0033333300',
      '0003333000',
    ],
  },
  {
    id: 'mug',
    colors: ['#20494a', '#a8d2d8', '#bf7f4c', '#8f5440'],
    rows: [
      '0003003000',
      '0000300300',
      '0003003000',
      '0111111000',
      '0122221110',
      '0122221010',
      '0122221110',
      '0122221000',
      '0011110000',
      '4444444440',
    ],
  },
  {
    id: 'window',
    colors: ['#8f5440', '#a8d2d8', '#f2c66d', '#6f9f6a'],
    rows: [
      '1111111111',
      '1222122221',
      '1233122221',
      '1233122221',
      '1111111111',
      '1222122221',
      '1222124421',
      '1244124441',
      '1111111111',
      '0011111100',
    ],
  },
];

export type Cell = { row: number; column: number; color: number };

/** Las casillas que hay que pintar (las de fondo no cuentan). */
export function cellsOf(picture: Picture): Cell[] {
  const cells: Cell[] = [];
  picture.rows.forEach((row, r) => {
    [...row].forEach((value, c) => {
      const color = Number(value);
      if (color > 0) cells.push({ row: r, column: c, color });
    });
  });
  return cells;
}

export const cellKey = (row: number, column: number) => `${row},${column}`;

/** Tocar una casilla: se pinta solo con su color. Devuelve el mismo conjunto si no cambia nada. */
export function paintCell(painted: ReadonlySet<string>, picture: Picture, row: number, column: number, color: number) {
  const key = cellKey(row, column);
  if (Number(picture.rows[row]?.[column]) !== color || color === 0 || painted.has(key)) return painted;
  return new Set(painted).add(key);
}

export const isComplete = (painted: ReadonlySet<string>, picture: Picture) => painted.size === cellsOf(picture).length;
