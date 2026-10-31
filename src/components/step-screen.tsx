import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PixelIcon } from '@/components/pixel-icon';
import type { IconName } from '@/components/pixel-icons';
import { StepProgress } from '@/components/step-progress';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StepScreenProps = {
  /** Paso actual y total; se omite en pantallas que no son parte de la secuencia. */
  step?: { number: number; total: number; label: string };
  /** Dibujo que acompaña al título: dice de qué trata la pantalla antes de leer. */
  art?: IconName;
  title: string;
  hint?: string;
  children?: ReactNode;
  /** Botones fijos abajo, siempre visibles y en el mismo lugar. */
  footer?: ReactNode;
};

/**
 * Una pregunta por pantalla: título, ayuda opcional, contenido y acciones abajo.
 * Solo el contenido se desplaza; el pie nunca sale de la pantalla, sea cual sea el tamaño del
 * texto. Los flujos se abren a pantalla completa (ver `app/_layout.tsx`) para que el gesto de
 * la hoja no arrastre los botones.
 */
export function StepScreen({ step, art, title, hint, children, footer }: StepScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          {step ? <StepProgress number={step.number} total={step.total} label={step.label} /> : null}
          {art ? <PixelIcon name={art} size={80} /> : null}
          <ThemedText type="title" accessibilityRole="header">
            {title}
          </ThemedText>
          {hint ? (
            <ThemedText type="callout" themeColor="textSecondary">
              {hint}
            </ThemedText>
          ) : null}
        </View>
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, Spacing.three),
              backgroundColor: theme.background,
              borderTopColor: theme.separator,
            },
          ]}>
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  heading: {
    gap: Spacing.two,
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three - Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerInner: {
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
