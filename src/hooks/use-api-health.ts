import { useEffect, useState } from 'react';

import { getHealth, type Health } from '@/lib/api';

const TIMEOUT_MS = 10_000;

export type ApiHealthState =
  | { status: 'checking' }
  | { status: 'online' | 'degraded'; health: Health }
  | { status: 'offline' };

export function useApiHealth() {
  const [state, setState] = useState<ApiHealthState>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    getHealth(controller.signal)
      .then((health) => {
        if (active) setState({ status: health.status === 'ok' ? 'online' : 'degraded', health });
      })
      .catch(() => {
        if (active) setState({ status: 'offline' });
      })
      .finally(() => clearTimeout(timer));

    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  function retry() {
    setState({ status: 'checking' });
    setAttempt((n) => n + 1);
  }

  return { state, retry };
}
