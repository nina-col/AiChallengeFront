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
  checkins: ['checkins'] as const,
  trying: ['checkins', 'trying'] as const,
  done: ['checkins', 'done'] as const,
  checkin: (id: string) => ['checkin', id] as const,
  playbook: ['playbook'] as const,
  progress: ['progress'] as const,
  memory: (spaceId: string) => ['memory', spaceId] as const,
  memories: ['memory'] as const,
  room: (spaceId: string) => ['room', spaceId] as const,
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

/** Los últimos registros terminados (hasta 30), para el resumen de la semana. */
export function useDone() {
  return useQuery({ queryKey: keys.done, queryFn: () => api.checkins('done') });
}

export function useCheckin(id: string) {
  return useQuery({ queryKey: keys.checkin(id), queryFn: () => api.checkin(id) });
}

export function usePlaybook() {
  return useQuery({ queryKey: keys.playbook, queryFn: api.playbook });
}

export function useMemory(spaceId: string) {
  return useQuery({ queryKey: keys.memory(spaceId), queryFn: () => api.memory(spaceId), enabled: !!spaceId });
}

export function useProgress() {
  return useQuery({ queryKey: keys.progress, queryFn: api.progress });
}

export function useHealth() {
  return useQuery({ queryKey: keys.health, queryFn: api.health, staleTime: 60_000 });
}
