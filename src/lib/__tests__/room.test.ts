import { defaultLayout, earnedTypes, uidMaker, validateLayout } from '@/components/room/layout';
import { MANIFEST } from '@/components/room/manifest';
import type { RoomLayout } from '@/components/room/types';
import { api, ApiError } from '@/lib/api';
import { keys, queryClient } from '@/lib/queries';
import { arriveInRoom, currentPlace, placeEarnedInRoom, visibleArrival } from '@/lib/room';
import type { Checkin, Space } from '@/lib/types';

// Sin red: el cuarto guardado y lo que se guarda salen de estos dobles.
jest.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number) {
      super(`HTTP ${status}`);
      this.status = status;
    }
  }
  return { ApiError, api: { room: jest.fn(), saveRoom: jest.fn(), memory: jest.fn() } };
});

const room = api.room as jest.Mock;
const saveRoom = api.saveRoom as jest.Mock;
const memory = api.memory as jest.Mock;

const SPACE = 'space-1';
const fresh = (tried: string[] = []) => defaultLayout(SPACE, MANIFEST, earnedTypes(MANIFEST, tried), uidMaker(SPACE));
const typeOf = (layout: RoomLayout, uid: string | null) => layout.items.find((item) => item.uid === uid)?.type;

afterEach(() => {
  jest.resetAllMocks();
  queryClient.clear();
});

describe('placeEarnedInRoom', () => {
  it('pone lo ganado en un cuarto guardado, sin mover nada, y devuelve su uid', async () => {
    const before = fresh();
    room.mockResolvedValue({ revision: 3, layout: before });
    saveRoom.mockResolvedValue({ revision: 4 });

    const uid = await placeEarnedInRoom(SPACE, 'headphones', []);

    expect(saveRoom).toHaveBeenCalledTimes(1);
    const [space, revision, next] = saveRoom.mock.calls[0] as [string, number, RoomLayout];
    expect([space, revision]).toEqual([SPACE, 3]);
    expect(typeOf(next, uid)).toBe('headphones');
    expect(next.items.slice(0, before.items.length)).toEqual(before.items);
    expect(next.items).toHaveLength(before.items.length + 1);
    expect(validateLayout(next, MANIFEST, earnedTypes(MANIFEST, ['noise_cancelling']))).toEqual([]);
    expect(queryClient.getQueryData(keys.room(SPACE))).toEqual({ revision: 4, layout: next });
  });

  const triedHere = (id: string, trials: number) => ({ tried: [{ adjustment: { id }, trials, helped: 0, stimulus: null }] });

  it('lo que la persona guardó no vuelve solo al probarlo otra vez aquí', async () => {
    room.mockResolvedValue({ revision: 3, layout: fresh() });
    memory.mockResolvedValue(triedHere('noise_cancelling', 2));

    expect(await placeEarnedInRoom(SPACE, 'headphones', ['noise_cancelling'])).toBeNull();
    expect(saveRoom).not.toHaveBeenCalled();
  });

  it('lo que ya tenía de otro lugar sí llega la primera vez que se prueba aquí', async () => {
    room.mockResolvedValue({ revision: 3, layout: fresh() });
    memory.mockResolvedValue(triedHere('noise_cancelling', 1));
    saveRoom.mockResolvedValue({ revision: 4 });

    const uid = await placeEarnedInRoom(SPACE, 'headphones', ['noise_cancelling']);

    expect(typeOf(saveRoom.mock.calls[0][2] as RoomLayout, uid)).toBe('headphones');
  });

  it('si no se puede saber si ya se probó aquí, tampoco vuelve', async () => {
    room.mockResolvedValue({ revision: 3, layout: fresh() });
    memory.mockRejectedValue(new ApiError(500));

    await expect(placeEarnedInRoom(SPACE, 'headphones', ['noise_cancelling'])).rejects.toBeInstanceOf(ApiError);
    expect(saveRoom).not.toHaveBeenCalled();
  });

  it('sin cuarto guardado, guarda el que la persona veía más lo nuevo (revisión 0)', async () => {
    room.mockRejectedValue(new ApiError(404));
    saveRoom.mockResolvedValue({ revision: 1 });
    const tried = ['desk_lamp'];

    const uid = await placeEarnedInRoom(SPACE, 'headphones', tried);

    const [, revision, next] = saveRoom.mock.calls[0] as [string, number, RoomLayout];
    expect(revision).toBe(0);
    // Lo de antes queda igual (mismos uid y lugares); el cuarto por defecto ya no se rearma.
    expect(next.items.slice(0, fresh(tried).items.length)).toEqual(fresh(tried).items);
    expect(typeOf(next, uid)).toBe('headphones');
    expect(queryClient.getQueryData(keys.room(SPACE))).toEqual({ revision: 1, layout: next });
  });

  it('sin cuarto guardado ni lo que tenía antes, no guarda nada', async () => {
    room.mockRejectedValue(new ApiError(404));
    await expect(placeEarnedInRoom(SPACE, 'headphones')).resolves.toBeNull();
    expect(saveRoom).not.toHaveBeenCalled();
  });

  it('si ya está en el cuarto, no guarda y deja lo leído para el resultado', async () => {
    const before = fresh(['noise_cancelling']);
    room.mockResolvedValue({ revision: 2, layout: before });

    await expect(placeEarnedInRoom(SPACE, 'headphones', ['noise_cancelling'])).resolves.toBeNull();
    expect(saveRoom).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(keys.room(SPACE))).toEqual({ revision: 2, layout: before });
  });

  it('con los escritorios llenos devuelve el uid del objeto, no el de la mesita que lo sostiene', async () => {
    // La pantalla y la taza ocupan los dos lugares del escritorio.
    const before = fresh(['short_reset']);
    room.mockResolvedValue({ revision: 5, layout: before });
    saveRoom.mockResolvedValue({ revision: 6 });

    const uid = await placeEarnedInRoom(SPACE, 'headphones', ['short_reset']);

    const [, , next] = saveRoom.mock.calls[0] as [string, number, RoomLayout];
    const added = next.items.slice(before.items.length).map((item) => item.type);
    expect(added).toEqual(['sideTable', 'headphones']);
    expect(typeOf(next, uid)).toBe('headphones');
  });

  it('las piezas que cambian el cuarto (persiana, pantalla suave) no se colocan', async () => {
    await expect(placeEarnedInRoom(SPACE, 'blinds', [])).resolves.toBeNull();
    expect(room).not.toHaveBeenCalled();
  });

  it('un error de red llega a quien llama (decide cuánto esperar)', async () => {
    room.mockRejectedValue(new ApiError(503));
    await expect(placeEarnedInRoom(SPACE, 'headphones', [])).rejects.toThrow('HTTP 503');
  });
});

describe('arriveInRoom', () => {
  it('el objeto colocado llega con su uid', async () => {
    room.mockResolvedValue({ revision: 1, layout: fresh() });
    saveRoom.mockResolvedValue({ revision: 2 });
    const arrival = await arriveInRoom(SPACE, 'headphones', []);
    expect(arrival).toEqual({ type: 'headphones', uid: expect.stringMatching(/^[a-z0-9]{8}$/) });
  });

  it('la persiana llega solo si la persona no la tenía', async () => {
    await expect(arriveInRoom(SPACE, 'blinds', ['desk_lamp'])).resolves.toEqual({ type: 'blinds' });
    await expect(arriveInRoom(SPACE, 'blinds', ['turn_from_light'])).resolves.toBeNull();
    await expect(arriveInRoom(SPACE, 'blinds')).resolves.toBeNull();
    expect(room).not.toHaveBeenCalled();
  });
});

describe('visibleArrival', () => {
  const layout = fresh();
  const none = { blinds: false, dim: false };

  it('el objeto cuenta solo si ya está en el cuarto', () => {
    const uid = layout.items[0].uid;
    expect(visibleArrival({ type: 'desk', uid }, { layout, modifiers: none })).toEqual({ type: 'desk', uid });
    expect(visibleArrival({ type: 'headphones', uid: 'zzzzzzzz' }, { layout, modifiers: none })).toBeNull();
    expect(visibleArrival({ type: 'desk', uid }, { modifiers: none })).toBeNull();
    expect(visibleArrival(undefined, { layout, modifiers: none })).toBeNull();
  });

  it('la persiana y la pantalla suave cuentan cuando ya se dibujan', () => {
    expect(visibleArrival({ type: 'blinds' }, { layout, modifiers: none })).toBeNull();
    expect(visibleArrival({ type: 'blinds' }, { layout, modifiers: { blinds: true, dim: false } })).toEqual({ type: 'blinds' });
    expect(visibleArrival({ type: 'screenDim' }, { layout, modifiers: { blinds: true, dim: false } })).toBeNull();
    expect(visibleArrival({ type: 'screenDim' }, { layout, modifiers: { blinds: false, dim: true } })).toEqual({ type: 'screenDim' });
  });
});

describe('currentPlace', () => {
  const space = (id: string): Space => ({ id, name: id, kind: 'office', created_at: '2026-10-01T00:00:00Z' });
  const checkin = (spaceId: string | null) => ({ space: spaceId ? { id: spaceId, name: spaceId } : null }) as Checkin;
  const spaces = [space('a'), space('b'), space('c')];

  it('primero el lugar de lo que está en prueba, aunque haya algo terminado después', () => {
    expect(currentPlace(spaces, [checkin('c'), checkin('b')], [checkin('b')])?.id).toBe('c');
  });

  it('si no hay nada en prueba, el de lo último terminado', () => {
    expect(currentPlace(spaces, [], [checkin('b'), checkin('c')])?.id).toBe('b');
  });

  it('salta registros sin lugar o de un lugar que ya no existe', () => {
    expect(currentPlace(spaces, [checkin(null), checkin('borrado')], [checkin('borrado'), checkin('c')])?.id).toBe('c');
  });

  it('sin registros, el primer lugar guardado; sin lugares, ninguno', () => {
    expect(currentPlace(spaces, undefined, undefined)?.id).toBe('a');
    expect(currentPlace([], [checkin('a')], [])).toBeNull();
    expect(currentPlace(undefined, undefined, undefined)).toBeNull();
  });
});
