import { dayKey, lastDays, parseEntries, recordEnergy, slotFor, type EnergyEntry } from '@/lib/energy';

const entry = (date: string, slot: EnergyEntry['slot'], level: number): EnergyEntry => ({ date, slot, level });

describe('mi energía', () => {
  it('el momento del día sale de la hora', () => {
    expect([8, 12, 15, 16, 23].map(slotFor)).toEqual(['morning', 'midday', 'midday', 'afternoon', 'afternoon']);
  });

  it('corregir reemplaza lo de ese momento, sin duplicar', () => {
    const once = recordEnergy([], entry('2026-10-30', 'morning', 2));
    expect(recordEnergy(once, entry('2026-10-30', 'morning', 4))).toEqual([entry('2026-10-30', 'morning', 4)]);
  });

  it('los últimos días incluyen los días sin registro, vacíos', () => {
    const days = lastDays([entry('2026-10-30', 'midday', 3)], new Date(2026, 9, 31), 3);
    expect(days.map((d) => d.key)).toEqual(['2026-10-29', '2026-10-30', '2026-10-31']);
    expect(days.map((d) => d.levels)).toEqual([[null, null, null], [null, 3, null], [null, null, null]]);
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('ignora lo que no tenga la forma correcta', () => {
    expect(parseEntries('no es json')).toEqual([]);
    expect(parseEntries(JSON.stringify([entry('2026-10-30', 'morning', 9), { nada: 1 }, entry('2026-10-30', 'midday', 3)]))).toEqual([entry('2026-10-30', 'midday', 3)]);
  });
});
