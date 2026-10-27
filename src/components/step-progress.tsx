import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Motion, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMotionLevel } from '@/lib/feedback';

const BLOCK = 10;

/**
 * Progreso del registro como una fila de pixeles: los pasos hechos están llenos y el actual se
 * llena al llegar. El texto "Paso 3 de 8" siempre acompaña a los bloques: el color nunca es la
 * única pista.
 */
export function StepProgress({ number, total, label }: { number: number; total: number; label: string }) {
  const theme = useTheme();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 1, max: total, now: number }}>
      <View style={styles.blocks}>
        {Array.from({ length: total }, (_, index) => {
          const done = index + 1 < number;
          const current = index + 1 === number;
          return current ? (
            <CurrentBlock key={index} />
          ) : (
            <View
              key={index}
              style={[styles.block, { backgroundColor: done ? theme.primary : theme.backgroundSelected }]}
            />
          );
        })}
      </View>
      <ThemedText type="footnote" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

/** El bloque del paso actual se llena a saltos, como un pixel que se enciende. */
function CurrentBlock() {
  const theme = useTheme();
  const level = useMotionLevel();
  const fill = useSharedValue(level === 'reduced' ? 1 : 0);

  useEffect(() => {
    if (level === 'reduced') return;
    fill.value = withTiming(1, {
      duration: level === 'detailed' ? 320 : Motion.base,
      easing: level === 'detailed' ? Easing.steps(4) : Motion.easeOut,
    });
  }, [fill, level]);

  const style = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * fill.value, transform: [{ scale: 0.6 + 0.4 * fill.value }] }));

  return (
    <View style={[styles.block, { backgroundColor: theme.backgroundSelected }]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.inner, { backgroundColor: theme.accent }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  blocks: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  block: {
    width: BLOCK,
    height: BLOCK,
    borderRadius: 2,
    overflow: 'hidden',
  },
  inner: {
    borderRadius: 2,
  },
});
