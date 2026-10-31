import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { SegmentedChoice } from '@/components/segmented-choice';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { cellKey, isComplete, paintCell, PICTURES } from '@/lib/paint';

/** Texto legible sobre cada color del dibujo. */
const INK = '#173a3d';
const PAPER = '#fbf8f1';

/**
 * Pintar por números (minijuego de la pausa Zen). Se elige un color por su número y se tocan las
 * casillas con ese número; el número se ve en cada casilla, así que no depende solo del color.
 */
export function PaintByNumbers() {
  const t = useT();
  const theme = useTheme();
  const [pictureId, setPictureId] = useState(PICTURES[0].id);
  const [color, setColor] = useState(1);
  const [painted, setPainted] = useState<ReadonlySet<string>>(new Set());
  const picture = PICTURES.find((p) => p.id === pictureId) ?? PICTURES[0];

  function choose(id: string) {
    setPictureId(id);
    setColor(1);
    setPainted(new Set());
  }

  return (
    <View style={styles.game}>
      <SegmentedChoice
        label={t.games.paintName}
        options={PICTURES.map((p) => ({ id: p.id, label: t.games.pictures[p.id] ?? p.id }))}
        selected={picture.id}
        onSelect={choose}
      />
      <View style={[styles.board, { borderColor: theme.separator }]}>
        {picture.rows.map((row, r) => (
          <View key={r} style={styles.row}>
            {[...row].map((value, c) => {
              const n = Number(value);
              if (n === 0) return <View key={c} style={[styles.cell, { backgroundColor: PAPER }]} />;
              const done = painted.has(cellKey(r, c));
              const active = n === color;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={t.games.cell(r + 1, c + 1, n, done)}
                  accessibilityState={{ disabled: done }}
                  onPress={() => setPainted((current) => paintCell(current, picture, r, c, color))}
                  style={[
                    styles.cell,
                    { backgroundColor: done ? picture.colors[n - 1] : active ? '#e1ede6' : PAPER },
                  ]}>
                  {done ? null : <ThemedText style={[styles.number, active && styles.active]}>{n}</ThemedText>}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.palette} accessibilityRole="radiogroup" accessibilityLabel={t.games.chooseColor}>
        {picture.colors.map((hex, i) => {
          const selected = color === i + 1;
          return (
            <Pressable
              key={hex}
              accessibilityRole="radio"
              accessibilityLabel={t.games.colorN(i + 1)}
              accessibilityState={{ checked: selected }}
              onPress={() => setColor(i + 1)}
              style={[styles.swatch, { backgroundColor: hex, borderColor: selected ? theme.text : 'transparent' }]}>
              <View style={styles.chip}>
                <ThemedText style={styles.chipText}>{i + 1}</ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>
      {isComplete(painted, picture) ? (
        <>
          <Notice text={t.games.paintDone} />
          <Button
            variant="secondary"
            title={t.games.paintAnother}
            onPress={() => choose(PICTURES[(PICTURES.indexOf(picture) + 1) % PICTURES.length].id)}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  game: {
    gap: Spacing.three,
  },
  board: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(23, 58, 61, 0.14)',
  },
  number: {
    color: INK,
    fontSize: 13,
    lineHeight: 16,
  },
  active: {
    fontWeight: '700',
  },
  palette: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  swatch: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PAPER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    color: INK,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 18,
  },
});
