import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Sección agrupada al estilo de iOS: título discreto arriba y filas en una sola superficie. */
export function Group({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      {title ? (
        <ThemedText type="footnote" themeColor="textSecondary" accessibilityRole="header" style={styles.title}>
          {title}
        </ThemedText>
      ) : null}
      <View style={[styles.surface, { backgroundColor: theme.backgroundElement }]}>{children}</View>
      {footer ? (
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.title}>
          {footer}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Fila de un grupo; la primera no lleva separador arriba. */
export function GroupRow({ first, children }: { first?: boolean; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  title: {
    paddingHorizontal: Spacing.three,
  },
  surface: {
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  row: {
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - Spacing.one,
    gap: Spacing.two,
    justifyContent: 'center',
  },
});
