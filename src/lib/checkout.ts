import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';

import { api } from '@/lib/api';
import { useHaptics } from '@/lib/feedback';
import { cancelCheckout } from '@/lib/notifications';
import { keys, queryClient } from '@/lib/queries';
import type { Response } from '@/lib/types';

export const outcomeKey = (id: string) => ['outcome', id] as const;

/** Guarda "cómo te fue", quita el aviso pendiente y muestra el resultado. */
export function useSaveOutcome(id: string) {
  const haptics = useHaptics();
  return useMutation({
    mutationFn: (answers: { discomfort: number; effort: number; attribution: Response }) =>
      api.outcome(id, answers),
    onSuccess: async (result) => {
      await cancelCheckout(id);
      haptics.confirm();
      queryClient.setQueryData(outcomeKey(id), result);
      queryClient.invalidateQueries({ queryKey: keys.trying });
      queryClient.invalidateQueries({ queryKey: keys.playbook });
      router.push({ pathname: '/checkout/[id]/result', params: { id } });
    },
  });
}
