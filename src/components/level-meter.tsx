import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReducedMotion } from '@/lib/feedback';

const COLUMNS = 16;
const ROWS = 5;
const SECONDS = 10;

/** dBFS del micrófono → 0–5 bloques: -60 dB o menos es silencio, -10 dB llena la columna. */
function blocks(db: number | undefined) {
  if (db === undefined) return 0;
  return Math.max(0, Math.min(ROWS, Math.round((db + 60) / 10)));
}

/**
 * Lo que escucha el teléfono, en pixeles: las últimas columnas de nivel y, abajo, un bloque por
 * cada segundo. Es solo para que se vea que está funcionando; el nivel no se guarda.
 * Con movimiento reducido quedan solo los segundos, que cambian una vez por segundo.
 */
export function LevelMeter({ level, progress }: { level?: number; progress: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [history, setHistory] = useState<number[]>([]);
  const [seen, setSeen] = useState(progress);

  // Una columna nueva por cada lectura del micrófono (cada lectura avanza `progress`).
  if (!reduced && progress !== seen) {
    setSeen(progress);
    setHistory((current) => [...current, blocks(level)].slice(-COLUMNS));
  }

  const seconds = Math.min(SECONDS, Math.floor(progress * SECONDS + 0.001));

  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {reduced ? null : (
        <View style={styles.columns}>
          {Array.from({ length: COLUMNS }, (_, column) => {
            const filled = history[history.length - COLUMNS + column] ?? 0;
            return (
              <View key={column} style={styles.column}>
                {Array.from({ length: ROWS }, (_, row) => (
                  <View
                    key={row}
                    style={[
                      styles.cell,
                      { backgroundColor: ROWS - row <= filled ? theme.accent : theme.backgroundElement },
                    ]}
                  />
                ))}
              </View>
            );
          })}
        </View>
      )}
      <View style={styles.seconds}>
        {Array.from({ length: SECONDS }, (_, index) => (
          <View
            key={index}
            style={[styles.second, { backgroundColor: index < seconds ? theme.primary : theme.backgroundElement }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
  },
  columns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 3,
  },
  column: {
    flex: 1,
    gap: 3,
  },
  cell: {
    height: 8,
    borderRadius: 1.5,
  },
  seconds: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  second: {
    flex: 1,
    height: 6,
    borderRadius: 1.5,
  },
});
