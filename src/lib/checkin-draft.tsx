import { createContext, useContext, useState, type ReactNode } from 'react';

import type { CheckinWithProposal, NewCheckin, Response } from '@/lib/types';

/** Respuestas del registro en curso, mientras la persona avanza por los pasos. */
export type Draft = {
  task?: string;
  feeling?: string;
  spaceId?: string | null;
  discomfort?: number;
  effort?: number;
  /** Estímulo → respuesta. Lo que no aparece, no se preguntó. */
  answers: Record<string, Response>;
  focus?: string;
  /** Lo que devolvió la API al registrar y al pedir otra idea. */
  result?: CheckinWithProposal;
};

type DraftContextValue = {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
};

const DraftContext = createContext<DraftContextValue | null>(null);

export function CheckinDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>({ answers: {} });
  const update = (patch: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...patch }));
  return <DraftContext value={{ draft, update }}>{children}</DraftContext>;
}

export function useCheckinDraft() {
  const value = useContext(DraftContext);
  if (!value) throw new Error('useCheckinDraft necesita <CheckinDraftProvider>');
  return value;
}

/** Estímulos que la persona marcó como presentes y molestos. */
export function affecting(draft: Draft) {
  return Object.entries(draft.answers)
    .filter(([, response]) => response === 'yes')
    .map(([stimulus]) => stimulus);
}

export function toNewCheckin(draft: Draft, focus: string | null): NewCheckin {
  return {
    space_id: draft.spaceId ?? null,
    task: draft.task ?? 'other',
    feeling: draft.feeling ?? 'other',
    discomfort_before: draft.discomfort ?? 3,
    effort_before: draft.effort ?? 3,
    observations: Object.entries(draft.answers).map(([stimulus, response]) => ({ stimulus, response })),
    focus_stimulus: focus,
  };
}
