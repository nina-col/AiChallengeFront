import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { remove, type Finding, type PreparedPhoto } from '@/lib/scan';
import type { CheckinWithProposal, NewCheckin, Response } from '@/lib/types';

/** Respuestas del registro en curso, mientras la persona avanza por los pasos. */
export type Draft = {
  askPlace?: boolean;
  task?: string;
  feeling?: string;
  spaceId?: string | null;
  discomfort?: number;
  effort?: number;
  /** Estímulo → respuesta. Lo que no aparece, no se preguntó. */
  answers: Record<string, Response>;
  focus?: string;
  /** De dónde salió cada respuesta "sí" confirmada en el escaneo. */
  sources: Record<string, 'photo' | 'audio'>;
  /** Estímulos que sugirió el audio (el audio ya se borró). */
  audioHints?: string[];
  /** Foto pixelada que se mostró con marcadores; se borra al cerrar el registro. */
  photo?: PreparedPhoto;
  findings?: Finding[];
  scanFailed?: boolean;
  /** Lo que devolvió la API al registrar y al pedir otra idea. */
  result?: CheckinWithProposal;
  /**
   * "Usarlo otra vez" desde "Lo que sé de este lugar": registro corto (tarea, cómo te sientes,
   * molestia y esfuerzo) que va directo a ese ajuste, sin escaneo ni preguntas por dominio.
   */
  repeat?: { adjustmentId: string; stimulus: string | null; spaceId: string };
};

type DraftContextValue = {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
};

const DraftContext = createContext<DraftContextValue | null>(null);

export function CheckinDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>({ answers: {}, sources: {} });
  const update = (patch: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...patch }));

  // La foto pixelada vive solo mientras dura el registro.
  const photoUri = useRef<string | undefined>(undefined);
  useEffect(() => {
    photoUri.current = draft.photo?.uri;
  }, [draft.photo?.uri]);
  useEffect(() => () => remove(photoUri.current), []);
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
    observations: Object.entries(draft.answers).map(([stimulus, response]) => ({
      stimulus,
      response,
      source: draft.sources[stimulus] ?? 'question',
    })),
    focus_stimulus: focus,
    ...(draft.repeat ? { adjustment_id: draft.repeat.adjustmentId } : {}),
  };
}
