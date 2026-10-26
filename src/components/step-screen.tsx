import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StepScreenProps = {
  /** "Paso 2 de 8"; se omite en pantallas que no son parte de una secuencia. */
  step?: string;
  title: string;
  hint?: string;
  children?: ReactNode;
  /** Botones fijos abajo, siempre en el mismo lugar. */
  footer?: ReactNode;
};

/** Una pregunta por pantalla: título, ayuda opcional, contenido y acciones abajo. */
export function StepScreen({ step, title, hint, children, footer }: StepScreenProps) {
  const theme = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          {step ? (
            <ThemedText type="footnote" themeColor="textSecondary">
              {step}
            </ThemedText>
          ) : null}
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
        <SafeAreaView
          edges={['bottom']}
          style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.separator }]}>
          {footer}
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
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
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three - Spacing.one,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
