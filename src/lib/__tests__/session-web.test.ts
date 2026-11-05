import { createDeviceKey, forgetDeviceKey, getDeviceKey } from '@/lib/session.web';
import { clearRatings } from '@/lib/helpfulness';

jest.mock('expo-crypto', () => ({ getRandomBytes: (size: number) => new Uint8Array(size).fill(7) }));
jest.mock('@/lib/helpfulness', () => ({ clearRatings: jest.fn().mockResolvedValue(undefined) }));

const storage = new Map<string, string>();
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
beforeAll(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    } },
  });
});
afterEach(async () => { await forgetDeviceKey(); jest.clearAllMocks(); });
afterAll(() => { if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); });

test('la vista web no crea una cuenta solo por abrir la página', async () => {
  expect(await getDeviceKey()).toBeNull();
  expect(storage.size).toBe(0);
});
test('una sesión web nueva no hereda intensidades de la cuenta anterior', async () => {
  const key = await createDeviceKey();
  expect(key).toMatch(/^[a-f0-9]{64}$/);
  expect(await getDeviceKey()).toBe(key);
  expect(clearRatings).toHaveBeenCalledTimes(1);
});
test('borrar la sesión elimina la llave y las intensidades locales', async () => {
  await createDeviceKey();
  await forgetDeviceKey();
  expect(await getDeviceKey()).toBeNull();
  expect(storage.size).toBe(0);
  expect(clearRatings).toHaveBeenCalled();
});
