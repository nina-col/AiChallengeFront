import { cellKey, cellsOf, isComplete, paintCell, PICTURES } from '@/lib/paint';

describe('pintar por números', () => {
  it.each(PICTURES.map((p) => [p.id, p] as const))('%s: 10 × 10 y cada número tiene su color', (_, picture) => {
    expect(picture.rows).toHaveLength(10);
    for (const row of picture.rows) expect(row).toHaveLength(10);
    const used = new Set(cellsOf(picture).map((c) => c.color));
    expect([...used].sort()).toEqual(picture.colors.map((_c, i) => i + 1));
  });

  it('otro color no pinta ni cuenta como error', () => {
    const picture = PICTURES[0];
    const cell = cellsOf(picture)[0];
    const empty = new Set<string>();
    expect(paintCell(empty, picture, cell.row, cell.column, cell.color === 1 ? 2 : 1)).toBe(empty);
    expect(paintCell(empty, picture, cell.row, cell.column, cell.color).has(cellKey(cell.row, cell.column))).toBe(true);
  });

  it('el fondo no se pinta y al pintar todo queda completo', () => {
    const picture = PICTURES[0];
    const empty = new Set<string>();
    expect(paintCell(empty, picture, 0, 0, 0)).toBe(empty);
    let painted: ReadonlySet<string> = empty;
    for (const c of cellsOf(picture)) painted = paintCell(painted, picture, c.row, c.column, c.color);
    expect(isComplete(painted, picture)).toBe(true);
    expect(isComplete(empty, picture)).toBe(false);
  });
});
