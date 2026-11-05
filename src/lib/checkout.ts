import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';

import type { ItemId } from '@/components/desk/layers';
import { api } from '@/lib/api';
import { deskItems, ITEM_FOR_ADJUSTMENT } from '@/lib/desk';
import { cancelCheckout } from '@/lib/notifications';
import { keys, queryClient } from '@/lib/queries';
import type { OutcomeResult, Response } from '@/lib/types';

export const outcomeKey = (id: string) => ['outcome', id] as const;

/** El resultado y, si es la primera vez que se prueba algo de ese tema, el objeto que llega a "Tu escritorio". */
export type SavedOutcome = OutcomeResult & { newItem?: ItemId };

/** Guarda "cómo te fue", quita el aviso pendiente y muestra el resultado. */
export function useSaveOutcome(id: string) {
  return useMutation({
    mutationFn: async (answers: { discomfort: number; effort: number; attribution: Response }): Promise<SavedOutcome> => {
      // Lo que había en el escritorio antes, para saber si el objeto es nuevo. No importa si ayudó.
      const before = await queryClient
        .ensureQueryData({ queryKey: keys.progress, queryFn: api.progress })
        .catch(() => undefined);
      const result = await api.outcome(id, answers);
      const item = result.checkin.adjustment ? ITEM_FOR_ADJUSTMENT[result.checkin.adjustment.id] : undefined;
      const isNew = item && before && !deskItems(before.tried).includes(item);
      return { ...result, newItem: isNew ? item : undefined };
    },
    onSuccess: async (result) => {
      await cancelCheckout(id);
      queryClient.setQueryData(outcomeKey(id), result);
      queryClient.invalidateQueries({ queryKey: keys.checkins });
      queryClient.invalidateQueries({ queryKey: keys.playbook });
      queryClient.invalidateQueries({ queryKey: keys.progress });
      router.push({ pathname: '/checkout/[id]/result', params: { id } });
    },
  });
}
