import { Easing, FadeIn } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';
import type { MotionLevel } from '@/lib/feedback';

/**
 * Entradas compartidas, según el nivel de movimiento (`useMotionLevel`). Nada crece desde cero ni
 * se desplaza: son fundidos. Con detalles, se encienden a saltos (`Easing.steps`), como un pixel.
 * Con movimiento reducido no hay animación.
 */

/** La palomita de lo que se elige: elegir es lo más frecuente, así que solo se anima con detalles. */
export function checkEntering(level: MotionLevel) {
  if (level !== 'detailed') return undefined;
  return FadeIn.duration(Motion.fast).easing(Motion.easeOut);
}

/**
 * Algo nuevo que conviene mirar, como los marcadores de la foto: con detalles se encienden uno
 * tras otro en el orden de sus números (40 ms entre cada uno, menos de 300 ms en total).
 */
export function revealEntering(level: MotionLevel, index = 0) {
  if (level === 'reduced') return undefined;
  if (level === 'detailed') return FadeIn.delay(index * 40).duration(200).easing(Easing.steps(4));
  return FadeIn.duration(Motion.base).easing(Motion.easeOut);
}

/** Un bloque de contenido que cambia (la sugerencia, el resultado). */
export function contentEntering(level: MotionLevel) {
  if (level === 'reduced') return undefined;
  return FadeIn.duration(Motion.base).easing(Motion.easeOut);
}

/** Partes que siempre llegan en el mismo orden (el resumen de la semana): con detalles, una por compás. */
export function stepEntering(level: MotionLevel, index: number) {
  if (level === 'reduced') return undefined;
  if (level === 'detailed') return FadeIn.delay(index * 150).duration(200).easing(Easing.steps(4));
  return FadeIn.duration(Motion.base).easing(Motion.easeOut);
}
