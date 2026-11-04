export const MASCOT_FRAME_MS = 180;
export const MASCOT_SEQUENCE = [0, 1, 2, 1, 3, 0] as const;
export const MASCOT_DURATION_MS = MASCOT_SEQUENCE.length * MASCOT_FRAME_MS;
export type MascotMotion = { startedAt: number | null; frame: number };
export const MASCOT_REST: MascotMotion = { startedAt: null, frame: 0 };
export type MascotAction = { type: 'start' | 'tick'; now: number } | { type: 'cancel' };

/** A bounded, one-shot action. Tapping repeatedly never restarts or extends it. */
export function mascotMotionReducer(state: MascotMotion, action: MascotAction): MascotMotion {
  if (action.type === 'cancel') return state.startedAt === null && state.frame === 0 ? state : MASCOT_REST;
  if (action.type === 'start') return state.startedAt !== null ? state : { startedAt: action.now, frame: 0 };
  if (state.startedAt === null) return state;
  const elapsed = Math.max(0, action.now - state.startedAt);
  if (elapsed >= MASCOT_DURATION_MS) return MASCOT_REST;
  const frame = MASCOT_SEQUENCE[Math.floor(elapsed / MASCOT_FRAME_MS)];
  return frame === state.frame ? state : { ...state, frame };
}

export function mascotCell(frame: number) {
  return { column: frame % 2, row: Math.floor(frame / 2) };
}
