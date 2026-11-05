import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'secondary' | 'plain';

type ButtonProps = {
  title: string;
  description?: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  /** Para VoiceOver cuando el título no se lee bien (por ejemplo, una flecha). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Botón de la app. Al tocar se atenúa al instante (sin "aplastarse") y mide al menos 52 pt. */
export function Button({
  title,
  description,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  accessibilityHint,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const colors = {
    primary: { background: theme.primary, text: theme.onPrimary },
    secondary: { background: theme.backgroundSelected, text: theme.text },
    plain: { background: 'transparent', text: theme.primary },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (description ? `${title}. ${description}` : title)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: colors.background, opacity: inactive ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          <ThemedText type="bodyStrong" style={[styles.label, { color: colors.text }]}>
            {title}
          </ThemedText>
          {description ? <ThemedText type="footnote" style={[styles.label, { color: colors.text, marginTop: Spacing.one }]}>{description}</ThemedText> : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
});
