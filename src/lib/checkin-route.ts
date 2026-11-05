export const DOMAIN_IDS = ['sound', 'light', 'sight', 'body'] as const;
export type DomainId = typeof DOMAIN_IDS[number];
export type EntryChoice = 'sensory' | 'internal' | 'unsure';
/** Lo cognitivo (empezar, ordenar, cambios): mismo ciclo que el entorno, sin escaneo ni molestia del entorno. */
export const INNER_DOMAIN = 'inner';
export const INNER_STIMULI = ['hard_to_start', 'too_many_tasks', 'on_my_mind', 'plan_changed', 'unclear_task'];
export const isInner = (stimulus: string | null | undefined) => !!stimulus && INNER_STIMULI.includes(stimulus);

/** Never infer a diagnosis or write unasked observations as negative answers. */
export function selectedDomainIds(selected: readonly string[] | undefined, available: readonly string[]) {
  return available.filter((id) => !selected || selected.includes(id));
}

export function checkinOrder(askPlace: boolean, domains: readonly string[]) {
  return ['task', ...(askPlace ? ['place'] : []), 'discomfort', 'scan', ...domains];
}

/** Lo cognitivo no pregunta por el entorno: el esfuerzo es la medida, antes y después. */
export function innerOrder(askPlace: boolean) {
  return ['task', 'effort', ...(askPlace ? ['place'] : []), INNER_DOMAIN];
}
