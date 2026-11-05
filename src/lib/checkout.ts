import { ratingsQuery, saveRating } from '@/lib/helpfulness';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';

import type { ItemId } from '@/components/desk/layers';
import { api } from '@/lib/api';
import { deskItems, ITEM_FOR_ADJUSTMENT } from '@/lib/desk';
import { cancelCheckout } from '@/lib/notifications';
import { keys, queryClient } from '@/lib/queries';
import { arriveInRoom, typeForAdjustment, type RoomArrival } from '@/lib/room';
import type { Adjustment, OutcomeResult, Progress, Response } from '@/lib/types';

export const outcomeKey = (id: string) => ['outcome', id] as const;

/**
 * El resultado y lo que deja la prueba, haya ayudado o no: `room`, lo nuevo en el cuarto de su
 * lugar (sin valor si no llegó nada o tardó demasiado); `newItem`, el objeto de "Tu escritorio" 2D
 * si es la primera vez con ese tema (se muestra cuando no hay cuarto).
 */
export type SavedOutcome = OutcomeResult & { newItem?: ItemId; room?: RoomArrival; ratingSaved?: boolean };

/** Lo más que el resultado espera al cuarto. Si tarda más, el objeto llega igual, sin su animación. */
const ROOM_WAIT_MS = 2500;

/** `promise` o, si falla o tarda más de `ms`, `fallback`. Lo que tarda sigue en segundo plano. */
function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/**
 * Lo que cuenta la API después de terminar una prueba: una más y su ajuste entre los probados (la
 * comparación sin ajuste no cuenta como probado). Así el resultado ya lo muestra sin esperar a la red.
 */
function progressAfter(before: Progress, adjustment: Adjustment | null): Progress {
  const isNew = adjustment && adjustment.kind !== 'baseline' && !before.tried.includes(adjustment.id);
  return { trials: before.trials + 1, tried: isNew ? [...before.tried, adjustment.id] : before.tried };
}

/** Guarda "cómo te fue", quita el aviso pendiente y muestra el resultado. */
export function useSaveOutcome(id: string) {
  return useMutation({
    mutationFn: async (answers: { discomfort: number; effort: number; attribution: Response; score?: number | null }): Promise<SavedOutcome> => {
      // Lo que tenía antes, para saber si el objeto es nuevo. No importa si ayudó.
      // Decoration is optional: never delay the actual save waiting for a progress request.
      const before = queryClient.getQueryData<Progress>(keys.progress);
      const result = await api.outcome(id, answers);
      const adjustment = result.checkin.adjustment;
      let ratingSaved = true;
      if (answers.score !== undefined && adjustment) {
        try { await saveRating({ id, adjustment: adjustment.id, task: result.checkin.task, space: result.checkin.space?.id ?? null, score: answers.score, at: Date.now() }); }
        catch { ratingSaved = false; }
        queryClient.invalidateQueries({ queryKey: ratingsQuery });
      }
      const item = adjustment ? ITEM_FOR_ADJUSTMENT[adjustment.id] : undefined;
      const isNew = item && before && !deskItems(before.tried).includes(item);
      // Su objeto entra al cuarto de ese lugar. El resultado ya está guardado: el cuarto no lo frena
      // más de ROOM_WAIT_MS ni lo hace fallar.
      const spaceId = result.checkin.space?.id;
      const type = adjustment ? typeForAdjustment(adjustment.id) : undefined;
      const room = spaceId && type ? await within(arriveInRoom(spaceId, type, before?.tried), ROOM_WAIT_MS, null) : null;
      // Lo que tiene ahora (la persiana o la pantalla suave se dibujan con esto); `onSuccess` lo
      // confirma con la API. Va después del cuarto: así un cuarto que todavía no se guardaba no se
      // rearma un momento con lo nuevo.
      if (before) queryClient.setQueryData(keys.progress, progressAfter(before, adjustment));
      return { ...result, ratingSaved, newItem: isNew ? item : undefined, room: room ?? undefined };
    },
    onSuccess: async (result) => {
      await cancelCheckout(id).catch(() => {});
      queryClient.setQueryData(outcomeKey(id), result);
      queryClient.invalidateQueries({ queryKey: keys.checkins });
      queryClient.invalidateQueries({ queryKey: keys.playbook });
      queryClient.invalidateQueries({ queryKey: keys.progress });
      queryClient.invalidateQueries({ queryKey: keys.memories });
      router.push({ pathname: '/checkout/[id]/result', params: { id } });
    },
  });
}
