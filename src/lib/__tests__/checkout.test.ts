import { api } from '@/lib/api';
import { progressBefore } from '@/lib/checkout';
import { keys, queryClient } from '@/lib/queries';

// Sin red: lo que responde la API sale de este doble. Los avisos no se tocan aquí.
jest.mock('@/lib/api', () => ({ ApiError: class extends Error {}, api: { progress: jest.fn() } }));
jest.mock('@/lib/notifications', () => ({ cancelCheckout: jest.fn() }));

const progress = api.progress as jest.Mock;
const TRIED = { trials: 2, tried: ['desk_lamp'] };

afterEach(() => {
  jest.resetAllMocks();
  queryClient.clear();
});

describe('progressBefore', () => {
  it('usa lo que ya está en memoria sin pedirlo otra vez', async () => {
    queryClient.setQueryData(keys.progress, TRIED);
    await expect(progressBefore()).resolves.toEqual(TRIED);
    expect(progress).not.toHaveBeenCalled();
  });

  it('lo pide si la app se abrió desde el aviso y Hoy no lo trajo', async () => {
    progress.mockResolvedValue(TRIED);
    await expect(progressBefore()).resolves.toEqual(TRIED);
    expect(progress).toHaveBeenCalledTimes(1);
  });

  it('no detiene el guardado si la red no contesta', async () => {
    let answer: (value: typeof TRIED) => void = () => {};
    progress.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const started = Date.now();
    await expect(progressBefore()).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(2500);
    answer(TRIED); // La respuesta tardía no deja nada pendiente.
  });

  it('sin conexión sigue sin progreso, sin fallar', async () => {
    progress.mockRejectedValue(new Error('offline'));
    await expect(progressBefore()).resolves.toBeUndefined();
  });
});
