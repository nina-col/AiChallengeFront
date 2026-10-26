import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/** "Cerrar" en texto (no solo una X), siempre arriba a la derecha de los flujos. */
export function CloseButton({ onClose }: { onClose?: () => void }) {
  const t = useT();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.common.close}
      hitSlop={Spacing.two}
      onPress={() => {
        onClose?.();
        router.dismissTo('/today');
      }}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}>
      <ThemedText type="bodyStrong" style={{ color: theme.primary }}>
        {t.common.close}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MinTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
});
