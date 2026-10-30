export type ZenActivity = 'breathing' | 'grounding' | 'garden';
export type Session = {
  status: 'idle' | 'running' | 'paused' | 'done';
  remainingMs: number;
  totalMs: number;
  deadline: number | null;
};
export const EMPTY_SESSION: Session = { status: 'idle', remainingMs: 0, totalMs: 0, deadline: null };
export type SessionAction = { type: 'start'; duration: number; now: number } | { type: 'tick' | 'pause' | 'resume' | 'finish'; now: number };

/** One bounded session: pausing never replenishes the remaining time. */
export function sessionRemaining(session: Session, now: number) {
  return session.status === 'running' && session.deadline !== null ? Math.max(0, session.deadline - now) : session.remainingMs;
}
export function sessionReducer(session: Session, action: SessionAction): Session {
  if (action.type === 'start') {
    if (session.status !== 'idle') return session;
    const totalMs = Math.max(1, Math.min(300, action.duration)) * 1000;
    return { status: 'running', totalMs, remainingMs: totalMs, deadline: action.now + totalMs };
  }
  if (action.type === 'finish') return { ...session, status: 'done', remainingMs: 0, deadline: null };
  if (action.type === 'resume') {
    if (session.status !== 'paused' || session.remainingMs <= 0) return session;
    return { ...session, status: 'running', deadline: action.now + session.remainingMs };
  }
  if (session.status !== 'running') return session;
  const remainingMs = sessionRemaining(session, action.now);
  if (!remainingMs) return { ...session, status: 'done', remainingMs: 0, deadline: null };
  return { ...session, remainingMs, ...(action.type === 'pause' ? { status: 'paused' as const, deadline: null } : {}) };
}
export function zenDuration(activity: ZenActivity, chosen: number) {
  return activity === 'garden' ? 120 : [60, 120, 300].includes(chosen) ? chosen : 120;
}
export function guideIndex(session: Session) {
  return Math.min(3, Math.floor((1 - session.remainingMs / Math.max(1, session.totalMs)) * 4));
}
