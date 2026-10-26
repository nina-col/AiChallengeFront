/** Tipos de la API (apps/api/src/routes). Mantenerlos en sincronía con los structs de Rust. */

export type Labeled = { id: string; label: string };

/** `baseline` = "esta vez no cambies nada", la comparación que separa un ajuste del paso del tiempo. */
export type AdjustmentKind = 'self' | 'ask' | 'baseline';

export type Adjustment = {
  id: string;
  kind: AdjustmentKind;
  /** Estímulos que atiende (vacío en la comparación sin ajuste). */
  stimuli: string[];
  title: string;
  steps: string;
  why: string;
};

export type Catalog = {
  version: number;
  tasks: Labeled[];
  feelings: Labeled[];
  domains: { id: string; question: string; stimuli: Labeled[] }[];
  adjustments: Adjustment[];
};

export type SpaceKind = 'office' | 'home' | 'other';

export type Space = { id: string; name: string; kind: SpaceKind; created_at: string };

export type Response = 'yes' | 'no' | 'unsure';

export type CheckinStatus = 'proposed' | 'trying' | 'done' | 'abandoned';

export type Checkin = {
  id: string;
  space: { id: string; name: string } | null;
  task: string;
  feeling: string;
  effort_before: number;
  discomfort_before: number | null;
  focus_stimulus: string | null;
  status: CheckinStatus;
  remind_at: string | null;
  effort_after: number | null;
  discomfort_after: number | null;
  improvement: number | null;
  typical_improvement: number | null;
  attribution: Response | null;
  outcome: 'helped' | 'not_helped' | 'unclear' | null;
  created_at: string;
  adjustment: Adjustment | null;
};

export type Reason =
  | { kind: 'first_try' }
  | { kind: 'exploring' }
  | { kind: 'comparison' }
  | { kind: 'tried_here'; helped: number; trials: number }
  | { kind: 'tried_elsewhere'; helped: number; trials: number };

export type Proposal = { adjustment: Adjustment; reason: Reason; alternatives: number };

export type CheckinWithProposal = { checkin: Checkin; proposal: Proposal | null };

export type NewCheckin = {
  space_id: string | null;
  task: string;
  feeling: string;
  effort_before: number;
  discomfort_before: number;
  observations: { stimulus: string; response: Response }[];
  focus_stimulus: string | null;
};

export type OutcomeResult = { checkin: Checkin; here: { helped: number; trials: number } };

export type PlaybookEntry = {
  task: string;
  space: { id: string; name: string } | null;
  stimulus: string;
  adjustment: Adjustment;
  helped: number;
  trials: number;
  last_tried: string | null;
};

export type Health = {
  status: 'ok' | 'degraded';
  database: 'ok' | 'unreachable';
  version: string;
  commit: string | null;
};
