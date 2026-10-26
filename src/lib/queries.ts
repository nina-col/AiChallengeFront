import { QueryClient, useQuery } from '@tanstack/react-query';

import { useLocale } from '@/i18n';
import { api } from '@/lib/api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export const keys = {
  catalog: (locale: string) => ['catalog', locale] as const,
  spaces: ['spaces'] as const,
  trying: ['checkins', 'trying'] as const,
  checkin: (id: string) => ['checkin', id] as const,
  playbook: ['playbook'] as const,
  health: ['health'] as const,
};

export function useCatalog() {
  const locale = useLocale();
  return useQuery({
    queryKey: keys.catalog(locale),
    queryFn: () => api.catalog(locale),
    staleTime: 60 * 60 * 1000,
  });
}

/** Nombres legibles de tareas, sensaciones y estímulos a partir del catálogo. */
export function useLabels() {
  const { data } = useCatalog();
  const find = (list: { id: string; label: string }[] | undefined, id: string) =>
    list?.find((item) => item.id === id)?.label ?? id;
  const stimuli = data?.domains.flatMap((d) => d.stimuli);
  return {
    task: (id: string) => find(data?.tasks, id),
    feeling: (id: string) => find(data?.feelings, id),
    stimulus: (id: string) => find(stimuli, id),
  };
}

export function useSpaces() {
  return useQuery({ queryKey: keys.spaces, queryFn: api.spaces });
}

export function useTrying() {
  return useQuery({ queryKey: keys.trying, queryFn: () => api.checkins('trying') });
}

export function useCheckin(id: string) {
  return useQuery({ queryKey: keys.checkin(id), queryFn: () => api.checkin(id) });
}

export function usePlaybook() {
  return useQuery({ queryKey: keys.playbook, queryFn: api.playbook });
}

export function useHealth() {
  return useQuery({ queryKey: keys.health, queryFn: api.health, staleTime: 60_000 });
}
