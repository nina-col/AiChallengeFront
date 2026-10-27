import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { useMotionLevel } from '@/lib/feedback';

const BAND = 0.16;
const PASS_MS = 1200;
/** Tres pasadas (3.6 s) y se queda quieta: lo que se repite se detiene antes de 5 s (WCAG 2.2.2). */
const PASSES = 3;

/**
 * Mientras se analiza la foto, una franja la recorre de arriba abajo y de vuelta: se ve que algo
 * está pasando sin girar un spinner encima de la imagen. Con detalles, el borde es una fila de
 * pixeles que avanza a saltos. Con movimiento reducido no se muestra (el texto ya dice
 * "Analizando…" y el botón muestra que está ocupado).
 */
export function ScanSweep({ active }: { active: boolean }) {
  const theme = useTheme();
  const level = useMotionLevel();
  const [height, setHeight] = useState(0);
  const [done, setDone] = useState(false);
  const [wasActive, setWasActive] = useState(active);
  const position = useSharedValue(0);

  // Cada análisis nuevo vuelve a empezar las pasadas.
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setDone(false);
  }

  const running = active && !done && level !== 'reduced' && height > 0;

  useEffect(() => {
    if (!running) {
      cancelAnimation(position);
      return;
    }
    position.value = 0;
    position.value = withRepeat(
      withTiming(1, { duration: PASS_MS, easing: level === 'detailed' ? Easing.steps(8) : Easing.linear }),
      PASSES,
      true,
    );
    const stop = setTimeout(() => setDone(true), PASS_MS * PASSES);
    return () => {
      clearTimeout(stop);
      cancelAnimation(position);
    };
  }, [running, level, position]);

  const band = height * BAND;
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: position.value * (height - band) }] }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
      {running ? (
        <Animated.View style={[styles.band, { height: band }, style]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.primary, opacity: 0.16 }]} />
          {level === 'detailed' ? (
            <View style={styles.pixels}>
              {Array.from({ length: 24 }, (_, index) => (
                <View
                  key={index}
                  style={[styles.pixel, { backgroundColor: theme.onPrimary, opacity: index % 2 ? 0.9 : 0.5 }]}
                />
              ))}
            </View>
          ) : (
            <View style={[styles.line, { backgroundColor: theme.onPrimary }]} />
          )}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
  },
  line: {
    height: 3,
    opacity: 0.85,
  },
  pixels: {
    flexDirection: 'row',
    height: 6,
  },
  pixel: {
    flex: 1,
  },
});
