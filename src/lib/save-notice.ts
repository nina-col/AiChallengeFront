import { useSyncExternalStore } from 'react';

let savedAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => savedAt;
const serverSnapshot = () => 0;

/** Short confirmation across a back navigation, emitted only after persistence succeeds. */
export function confirmSaved() {
  savedAt = Date.now();
  if (timer) clearTimeout(timer);
  listeners.forEach(listener => listener());
  timer = setTimeout(() => {
    savedAt = 0;
    listeners.forEach(listener => listener());
  }, 4000);
}

export function useSaveNotice() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot) !== 0;
}
