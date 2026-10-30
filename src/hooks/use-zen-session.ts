import { useCallback, useEffect, useReducer } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { EMPTY_SESSION, sessionReducer } from '@/lib/zen-session';

export function useZenSession() {
  const [session, dispatch] = useReducer(sessionReducer, EMPTY_SESSION);
  useEffect(() => {
    if (session.status !== 'running') return;
    const timer = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 250);
    return () => clearInterval(timer);
  }, [session.status]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') dispatch({ type: 'pause', now: Date.now() });
    });
    return () => listener.remove();
  }, []);
  // Navigating away never leaves a running session behind another screen.
  useFocusEffect(useCallback(() => () => dispatch({ type: 'pause', now: Date.now() }), []));
  return { session, dispatch };
}
