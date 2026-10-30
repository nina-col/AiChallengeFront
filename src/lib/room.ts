import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { autoPlaceWithHost, defaultLayout, earnedTypes, migrate, ownedModifiers, uidMaker } from '@/components/room/layout';
import { MANIFEST } from '@/components/room/manifest';
import type { RoomLayout } from '@/components/room/types';
import { useLocale, useT, type Locale } from '@/i18n';
import { api, ApiError } from '@/lib/api';
import { keys, queryClient, useDone, useProgress, useSpaces, useTrying } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import type { Checkin, Space } from '@/lib/types';

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

/** Cuarto por defecto de un lugar, igual en cualquier teléfono (semilla = id del lugar). */
function defaultRoom(spaceId: string, owned: readonly string[]) {
  return defaultLayout(spaceId, MANIFEST, owned, uidMaker(spaceId));
}

/**
 * El cuarto de un lugar. Si todavía no existe, se arma uno por defecto, igual en cualquier
 * teléfono (semilla = id del lugar), con lo que la persona ya probó; se guarda al primer cambio:
 * suyo o el primer objeto que gana ahí (`placeEarnedInRoom`). `owned` son los tipos que tiene: los
 * de base, la decoración libre y lo que ganó probando. Lo calculado se memoriza para que el cuarto
 * no se vuelva a armar (ni a dibujar) en cada render.
 */
export function useRoom(spaceId: string) {
  const progress = useProgress();
  const query = useQuery({ queryKey: keys.room(spaceId), queryFn: () => fetchRoom(spaceId), enabled: !!spaceId });
  const tried = progress.data?.tried;
  const owned = useMemo(() => earnedTypes(MANIFEST, tried ?? []), [tried]);
  const modifiers = useMemo(() => ownedModifiers(MANIFEST, owned), [owned]);
  const stored = query.data;
  const migrated = useMemo(() => (stored ? migrate(stored.layout) : null), [stored]);
  const needsDefault = query.isSuccess && stored === null && progress.isSuccess;
  const fallback = useMemo(() => (needsDefault ? defaultRoom(spaceId, owned) : undefined), [needsDefault, spaceId, owned]);
  const layout: RoomLayout | undefined = migrated?.ok ? migrated.layout : fallback;
  return {
    layout,
    revision: stored?.revision ?? 0,
    owned,
    modifiers,
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

/** Nombre legible de un tipo de objeto del cuarto. */
export function typeLabel(type: string, locale: Locale) {
  return MANIFEST.types[type]?.label[locale] ?? type;
}

/** ¿Ya se había probado aquí algo que da este objeto? La memoria del lugar ya cuenta la prueba que acaba de terminar. */
async function triedHereBefore(spaceId: string, type: string) {
  const adjustments = MANIFEST.types[type]?.adjustments ?? [];
  const entries = (await api.memory(spaceId)).tried.filter((entry) => adjustments.includes(entry.adjustment.id));
  return entries.length > 1 || entries.some((entry) => entry.trials > 1);
}

/**
 * Al terminar una prueba en un lugar, su objeto aparece en el cuarto de ese lugar si todavía no
 * está ahí, en un sitio libre razonable (`autoPlaceWithHost`: con una mesita si los escritorios
 * están llenos; si no cabe, queda en "Tus cosas"). Nunca mueve lo que ya está.
 *
 * Si el lugar aún no tiene cuarto guardado, se guarda el que la persona ya veía (el de por defecto
 * con lo que tenía antes de esta prueba, `triedBefore`) más el objeto nuevo. Así lo de antes no se
 * reacomoda: el cuarto por defecto se vuelve a armar desde cero cada vez que se gana algo. Sin
 * `triedBefore` no se sabe qué veía, y no se guarda nada.
 *
 * Si la persona ya lo tenía, no está en este cuarto y ya se había probado aquí, ella lo guardó (o no
 * cabía): no vuelve solo, sigue en "Tus cosas". Eso se pregunta a la API solo en ese caso; si falla,
 * tampoco vuelve.
 *
 * Devuelve el uid de lo que puso (para su animación de llegada) o `null` si no puso nada. Los
 * errores de red se propagan: quien llama decide cuánto esperar.
 */
export async function placeEarnedInRoom(
  spaceId: string,
  type: string,
  triedBefore?: readonly string[],
): Promise<string | null> {
  const spec = MANIFEST.types[type];
  if (!spec || spec.modifies) return null;
  const stored = await fetchRoom(spaceId);
  let base: RoomLayout;
  if (stored) {
    const migrated = migrate(stored.layout);
    if (!migrated.ok) return null;
    base = migrated.layout;
  } else {
    if (!triedBefore) return null;
    base = defaultRoom(spaceId, earnedTypes(MANIFEST, triedBefore));
  }
  const inRoom = base.items.some((item) => item.type === type);
  const hadIt = !triedBefore || earnedTypes(MANIFEST, triedBefore).includes(type);
  const stays = inRoom || (!!stored && hadIt && (await triedHereBefore(spaceId, type)));
  const next = stays ? null : autoPlaceWithHost(base, MANIFEST, type, spec.variants[0], freshUid);
  if (!next) {
    // Lo que se acaba de leer le sirve a la pantalla del resultado, si todavía no tenía nada.
    if (queryClient.getQueryData(keys.room(spaceId)) === undefined) queryClient.setQueryData(keys.room(spaceId), stored);
    return null;
  }
  const saved = await api.saveRoom(spaceId, stored?.revision ?? 0, next);
  // Una lectura que salió antes de guardar no debe pisar lo nuevo.
  await queryClient.cancelQueries({ queryKey: keys.room(spaceId) });
  const room: StoredRoom = { revision: saved.revision, layout: next };
  queryClient.setQueryData(keys.room(spaceId), room);
  const before = new Set(base.items.map((item) => item.uid));
  return next.items.find((item) => item.type === type && !before.has(item.uid))?.uid ?? null;
}

/** Lo nuevo en el cuarto de un lugar al terminar una prueba: su tipo y, si se colocó, su uid. */
export type RoomArrival = { type: string; uid?: string };

/**
 * Lo que una prueba terminada deja en el cuarto de su lugar, haya ayudado o no: el objeto que
 * entró (`placeEarnedInRoom`, con su uid para la animación de llegada) o, si es una pieza que cambia
 * el cuarto (persiana, pantalla suave) y la persona no la tenía, solo su tipo. `null` si no llega
 * nada nuevo.
 */
export async function arriveInRoom(
  spaceId: string,
  type: string,
  triedBefore?: readonly string[],
): Promise<RoomArrival | null> {
  if (MANIFEST.types[type]?.modifies) {
    return triedBefore && !earnedTypes(MANIFEST, triedBefore).includes(type) ? { type } : null;
  }
  const uid = await placeEarnedInRoom(spaceId, type, triedBefore);
  return uid ? { type, uid } : null;
}

/**
 * Lo que llegó y ya se ve en el cuarto: el objeto, si está en el layout, o la persiana o la
 * pantalla suave, si ya se dibujan. `null` si no (por ejemplo, si el cuarto cargó antes de que se
 * guardara): así nada dice "ahora está aquí" sin estarlo.
 */
export function visibleArrival(
  arrival: RoomArrival | null | undefined,
  room: { layout?: RoomLayout; modifiers: { blinds: boolean; dim: boolean } },
): RoomArrival | null {
  if (!arrival || !room.layout) return null;
  if (arrival.uid) return room.layout.items.some((item) => item.uid === arrival.uid) ? arrival : null;
  const modifies = MANIFEST.types[arrival.type]?.modifies;
  const shown = modifies === 'window' ? room.modifiers.blinds : modifies === 'monitor' ? room.modifiers.dim : false;
  return shown ? arrival : null;
}

/**
 * El lugar "de ahora" entre los guardados: el de la prueba más reciente (primero lo que está en
 * prueba y luego lo último terminado; la API los da del más nuevo al más viejo) o, si no hay, el
 * primero que se guardó. `null` si no hay lugares.
 */
export function currentPlace(
  spaces: readonly Space[] | undefined,
  trying: readonly Checkin[] | undefined,
  done: readonly Checkin[] | undefined,
): Space | null {
  if (!spaces?.length) return null;
  for (const list of [trying, done]) {
    for (const checkin of list ?? []) {
      const space = spaces.find((s) => s.id === checkin.space?.id);
      if (space) return space;
    }
  }
  return spaces[0];
}

/**
 * `currentPlace` con los datos de la app; `undefined` mientras carga, para no cambiar de cuarto al
 * llegar. Con un solo lugar (o ninguno) no hace falta esperar a los registros.
 */
export function useCurrentPlace(): Space | null | undefined {
  const spaces = useSpaces();
  const trying = useTrying();
  const done = useDone();
  if (spaces.isPending) return undefined;
  if ((spaces.data?.length ?? 0) <= 1) return spaces.data?.[0] ?? null;
  if (trying.isPending || done.isPending) return undefined;
  return currentPlace(spaces.data, trying.data, done.data);
}

/**
 * Qué se ve donde antes iba "Tu escritorio" 2D: `room`, el cuarto del lugar; `desk`, la escena 2D
 * (sin lugar, sin conexión o con un cuarto de una versión más nueva de la app; en modo concentración
 * no dibuja nada); `wait` mientras se sabe, para no saltar de una escena a la otra.
 */
export type RoomScene = 'room' | 'desk' | 'wait';

/**
 * El cuarto de un lugar listo para Hoy, el resultado, Listo, la semana y Ajustes. `place`:
 * `undefined` mientras se decide cuál, `null` si no hay. `label` es lo que lee VoiceOver.
 */
export function usePlaceRoom(place: Pick<Space, 'id' | 'name'> | null | undefined) {
  const t = useT();
  const locale = useLocale();
  const { settings } = useSettings();
  const room = useRoom(place?.id ?? '');
  let scene: RoomScene;
  if (place === undefined) scene = 'wait';
  else if (!place || room.needsUpdate || settings.focusMode) scene = 'desk';
  else if (room.layout) scene = 'room';
  else scene = room.isPending ? 'wait' : 'desk';
  const label =
    place && room.layout ? t.room.label(place.name, room.layout.items.map((item) => typeLabel(item.type, locale))) : '';
  return { ...room, scene, label };
}

/**
 * Llama a `cue` una sola vez, cuando termina la llegada de la escena: la onda queda tranquila y lo
 * nuevo tocó el piso, nunca antes (DESIGN.md §5). En el cuarto lo avisa `RoomView`: lo que devuelve
 * este hook va en su `onSettled` (su reloj espera al atlas y a medir el lienzo, así que un
 * temporizador se adelantaría). En la escena 2D, `ms` después de que aparece. Si la persona se va
 * antes, no suena.
 */
export function useSceneCue(scene: RoomScene, ms: number, cue: () => void) {
  const played = useRef(false);
  const once = useCallback(() => {
    if (played.current) return;
    played.current = true;
    cue();
  }, [cue]);
  useEffect(() => {
    if (scene !== 'desk' || played.current) return;
    const timer = setTimeout(once, ms);
    return () => clearTimeout(timer);
  }, [scene, ms, once]);
  return once;
}
