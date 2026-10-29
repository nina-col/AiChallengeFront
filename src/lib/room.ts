import { useMutation, useQuery } from '@tanstack/react-query';

import { autoPlaceWithHost, defaultLayout, earnedTypes, migrate, ownedModifiers, uidMaker } from '@/components/room/layout';
import { MANIFEST } from '@/components/room/manifest';
import type { RoomLayout } from '@/components/room/types';
import { api, ApiError } from '@/lib/api';
import { keys, queryClient, useProgress } from '@/lib/queries';

/** Lo guardado de un cuarto: `null` si ese lugar todavía no tiene uno. */
type StoredRoom = { revision: number; layout: unknown } | null;

async function fetchRoom(spaceId: string): Promise<StoredRoom> {
  try {
    return await api.room(spaceId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** uid nuevos para objetos que pone la persona: 8 caracteres `[a-z0-9]`. */
export function freshUid() {
  return Math.random().toString(36).slice(2, 10).padEnd(8, '0');
}

/**
 * El cuarto de un lugar. Si todavía no existe, se arma uno por defecto, igual en cualquier
 * teléfono (semilla = id del lugar), con lo que la persona ya probó; se guarda al primer cambio.
 * `owned` son los tipos que tiene: los de base, la decoración libre y lo que ganó probando.
 */
export function useRoom(spaceId: string) {
  const progress = useProgress();
  const query = useQuery({ queryKey: keys.room(spaceId), queryFn: () => fetchRoom(spaceId), enabled: !!spaceId });
  const owned = earnedTypes(MANIFEST, progress.data?.tried ?? []);
  const stored = query.data;
  const migrated = stored ? migrate(stored.layout) : null;
  let layout: RoomLayout | undefined;
  if (migrated?.ok) layout = migrated.layout;
  else if (query.isSuccess && stored === null && progress.isSuccess) {
    layout = defaultLayout(spaceId, MANIFEST, owned, uidMaker(spaceId));
  }
  return {
    layout,
    revision: stored?.revision ?? 0,
    owned,
    modifiers: ownedModifiers(MANIFEST, owned),
    /** Un cuarto guardado por una versión más nueva de la app: se muestra la lista. */
    needsUpdate: migrated?.ok === false && migrated.reason === 'newer',
    isPending: query.isPending || progress.isPending,
    isError: query.isError || progress.isError,
    refetch: () => {
      query.refetch();
      progress.refetch();
    },
  };
}

export function useSaveRoom(spaceId: string) {
  return useMutation({
    mutationFn: ({ revision, layout }: { revision: number; layout: RoomLayout }) => api.saveRoom(spaceId, revision, layout),
    onSuccess: ({ revision }, { layout }) => {
      const next: StoredRoom = { revision, layout };
      queryClient.setQueryData(keys.room(spaceId), next);
    },
    // Si otra pantalla guardó antes, se trae lo del servidor para no pisarlo.
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) queryClient.invalidateQueries({ queryKey: keys.room(spaceId) });
    },
  });
}

/** El tipo de objeto que da probar un ajuste (el catálogo del cuarto es la fuente). */
export function typeForAdjustment(adjustmentId: string) {
  return Object.keys(MANIFEST.types).find((type) => MANIFEST.types[type].adjustments?.includes(adjustmentId));
}

/**
 * Al terminar una prueba en un lugar, su objeto aparece en el cuarto de ese lugar si todavía no
 * está ahí (en un sitio libre razonable; si no cabe, queda en el inventario). Si el lugar aún no
 * tiene cuarto guardado, no hace falta: el cuarto por defecto ya incluye lo ganado.
 */
export async function placeEarnedInRoom(spaceId: string, type: string) {
  const stored = await fetchRoom(spaceId).catch(() => null);
  if (!stored) return;
  const migrated = migrate(stored.layout);
  if (!migrated.ok || migrated.layout.items.some((item) => item.type === type)) return;
  const spec = MANIFEST.types[type];
  if (!spec) return;
  const next = autoPlaceWithHost(migrated.layout, MANIFEST, type, spec.variants[0], freshUid);
  if (!next) return;
  const saved = await api.saveRoom(spaceId, stored.revision, next).catch(() => null);
  if (saved) {
    const room: StoredRoom = { revision: saved.revision, layout: next };
    queryClient.setQueryData(keys.room(spaceId), room);
  }
}
