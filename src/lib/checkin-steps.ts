import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';

import { checkinOrder, selectedDomainIds } from '@/lib/checkin-route';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { useCheckinDraft } from '@/lib/checkin-draft';
import { useCatalog, useSpaces } from '@/lib/queries';
import type { NewCheckin } from '@/lib/types';

const FALLBACK_DOMAINS = ['sound', 'light', 'sight', 'body'];

/**
 * Orden de los pasos del registro. La pregunta del lugar solo aparece si hay cero o varios
 * lugares: con uno, se usa ese y la persona se ahorra un paso. "Usarlo otra vez" es más corto:
 * el lugar y el ajuste ya se saben.
 */
export function useCheckinSteps() {
  const t = useT();
  const spaces = useSpaces();
  const catalog = useCatalog();
  const { draft, update } = useCheckinDraft();
  const repeat = draft.repeat;
  const askPlace = !repeat && (draft.askPlace ?? (spaces.data?.length ?? 0) !== 1);
  useEffect(() => {
    if (draft.askPlace === undefined && spaces.isSuccess) update({ askPlace });
  }, [draft.askPlace, spaces.isSuccess, askPlace, update]);
  const domains = selectedDomainIds(draft.selectedDomains, catalog.data?.domains.map((d) => d.id) ?? FALLBACK_DOMAINS);
  // 'scan' (foto y sonido) es opcional; sus pantallas internas no cuentan como pasos.
  const order = repeat ? ['task', 'feeling', 'discomfort', 'effort'] : checkinOrder(askPlace, domains);

  return {
    ready: spaces.isSuccess && catalog.isSuccess,
    spaces,
    total: order.length,
    /** Lo que muestra la barra de progreso de `StepScreen`. */
    progress: (step: string) => {
      const number = order.indexOf(step) + 1;
      const label = repeat ? t.checkin.repeatStep(number, order.length) : t.checkin.reviewStep(number, order.length);
      return { number, total: order.length, label };
    },
    onlySpaceId: repeat ? repeat.spaceId : askPlace ? undefined : spaces.data?.[0]?.id,
    /** Avanza al paso que sigue a `step`; `false` si ya no quedan pasos. */
    goAfter: (step: string) => {
      const next = order[order.indexOf(step) + 1];
      if (order.indexOf(step) < 0 || !next) return false;
      if (domains.includes(next)) router.push({ pathname: '/checkin/[domain]', params: { domain: next } });
      else router.push(`/checkin/${next}` as Href);
      return true;
    },
  };
}

/** Envía el registro completo y muestra la sugerencia. */
export function useSubmitCheckin() {
  const { update } = useCheckinDraft();
  return useMutation({
    mutationFn: (checkin: NewCheckin) => api.createCheckin(checkin),
    onSuccess: (result) => {
      update({ result });
      router.push('/checkin/proposal');
    },
  });
}
