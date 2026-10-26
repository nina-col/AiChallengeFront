import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useSettings } from '@/lib/settings';

/**
 * Vibración apagada por defecto: muchas personas la encuentran invasiva. Si se activa, solo
 * acompaña momentos de confirmar (nunca es la única señal) y una vez por acción.
 */
export function useHaptics() {
  const { settings } = useSettings();
  return {
    confirm: () => {
      if (settings.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    select: () => {
      if (settings.haptics) Haptics.selectionAsync().catch(() => {});
    },
  };
}

/** Movimiento reducido si lo pide iOS o la persona en Ajustes. Se actualiza en vivo. */
export function useReducedMotion() {
  const { settings } = useSettings();
  const [system, setSystem] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setSystem).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystem);
    return () => subscription.remove();
  }, []);

  return system || settings.motion === 'reduced';
}
