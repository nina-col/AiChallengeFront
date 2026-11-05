import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion as useReducedMotionAtLaunch } from 'react-native-reanimated';

import { useSettings } from '@/lib/settings';
import { playSound, SOUND_MS, VOLUME, type Sound } from '@/lib/sounds';

/**
 * Respuesta a lo que hace la persona: sonido y vibración, cada uno con su interruptor y
 * apagados por defecto. Cuando ambos están encendidos van juntos (guía de Apple), y la
 * vibración nunca es la única señal: siempre hay un cambio visible en pantalla.
 *
 * Elegir una opción o pasar de pregunta no suena ni vibra: lo frecuente con sonido cansa.
 *
 * - `confirm`: aceptar un ajuste (suena cuando la onda del monitor queda tranquila).
 * - `result`: terminaste una prueba. Es el mismo haya ayudado o no: se premia probar, no la
 *   respuesta, para no empujar a contestar "ayudó".
 * - `cue(sound)`: avisos de una pantalla concreta (empieza la escucha, hallazgos, escena).
 */
export function useFeedback() {
  const { settings } = useSettings();
  const volume = VOLUME[settings.soundVolume];

  const sound = (name: Sound) => {
    if (settings.sounds) playSound(name, volume);
  };
  const haptic = (kind: 'light' | 'success') => {
    if (!settings.haptics) return;
    const run =
      kind === 'light'
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    run.catch(() => {});
  };

  return {
    confirm: () => {
      sound('confirm');
      haptic('success');
    },
    result: () => {
      sound('result');
      haptic('success');
    },
    /** Se cumple cuando el sonido terminó (o enseguida si no suena): así no se cuela en una grabación. */
    cue: (name: Sound) => {
      if (name === 'pixel') haptic('light');
      if (!settings.sounds) return Promise.resolve();
      sound(name);
      return new Promise<void>((resolve) => setTimeout(resolve, SOUND_MS[name]));
    },
  };
}

/**
 * Movimiento reducido si lo pide iOS o la persona en Ajustes. Empieza con el valor que iOS tenía
 * al abrir la app (lectura síncrona de Reanimated, para no animar ni un cuadro de más) y se
 * actualiza en vivo si cambia.
 */
export function useReducedMotion() {
  const { settings } = useSettings();
  const atLaunch = useReducedMotionAtLaunch();
  const [system, setSystem] = useState(atLaunch);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setSystem).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystem);
    return () => subscription.remove();
  }, []);

  return system || settings.motion === 'reduced';
}

/**
 * Cuánto se mueve la app:
 * - `reduced`: solo fundidos y nada que se repita (Reducir movimiento de iOS o de Ajustes).
 * - `calm` (por defecto): movimiento breve y con propósito, de 250 ms o menos.
 * - `detailed` ("Con detalles"): además, la escena cobra vida y los logros se celebran.
 */
export type MotionLevel = 'reduced' | 'calm' | 'detailed';

export function useMotionLevel(): MotionLevel {
  const { settings } = useSettings();
  const reduced = useReducedMotion();
  if (reduced) return 'reduced';
  return settings.details ? 'detailed' : 'calm';
}
