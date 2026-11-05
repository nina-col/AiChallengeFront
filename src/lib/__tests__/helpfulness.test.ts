import { latestRating, ratingAttribution, readRatings, saveRating, type Rating } from '@/lib/helpfulness';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(),
}));
const record: Rating = { id: 'one', adjustment: 'dim', task: 'read', space: 'library', score: 4, at: 10 };

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
});
test('la incertidumbre no se convierte en un nivel medio ni un resultado negativo', () => {
  expect(ratingAttribution(null)).toBe('unsure');
  expect([1, 2, 3, 4, 5].map(ratingAttribution)).toEqual(['no', 'yes', 'yes', 'yes', 'yes']);
});
test('la intensidad no se mezcla entre tareas o lugares', () => {
  const records = [record, { ...record, id: 'two', score: 1, at: 20 }];
  expect(latestRating(records, 'dim', 'read', 'library')?.score).toBe(1);
  expect(latestRating(records, 'dim', 'write', 'library')).toBeUndefined();
  expect(latestRating(records, 'dim', 'read', 'home')).toBeUndefined();
});
test('rechaza niveles inválidos de los datos persistidos', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([record, { ...record, score: 7 }, { ...record, score: 0 }, { ...record, score: 1.5 }]));
  expect(await readRatings()).toEqual([record]);
});
test('reintentar el guardado local no duplica el resultado', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([record]));
  await saveRating({ ...record, score: 5 });
  const stored = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
  expect(stored).toEqual([{ ...record, score: 5 }]);
});
