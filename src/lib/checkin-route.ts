export const DOMAIN_IDS = ['sound', 'light', 'sight', 'body'] as const;
export type DomainId = typeof DOMAIN_IDS[number];
export type EntryChoice = 'sensory' | 'internal' | 'unsure';

/** Never infer a diagnosis or write unasked observations as negative answers. */
export function selectedDomainIds(selected: readonly string[] | undefined, available: readonly string[]) {
  return available.filter((id) => !selected || selected.includes(id));
}

export function checkinOrder(askPlace: boolean, domains: readonly string[]) {
  return ['task', 'feeling', ...(askPlace ? ['place'] : []), 'discomfort', 'effort', 'scan', ...domains];
}

export const FEELING_EMOJI: Record<string, string> = {
  focus: '🤔', drained: '😴', discomfort: '😣', overload: '😵', other: '😶',
};
