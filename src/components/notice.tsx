import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Aviso en línea, sin rojos ni alarmas: dice qué pasó y qué hacer. */
export function Notice({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.separator }]}>
      <View style={styles.message}>
        <SymbolView name="info.circle" size={20} tintColor={theme.warm} accessibilityElementsHidden />
        <ThemedText type="callout" style={styles.text}>
          {text}
        </ThemedText>
      </View>
      {action && onAction ? <Button title={action} variant="secondary" onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  message: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  text: {
    flex: 1,
  },
});
