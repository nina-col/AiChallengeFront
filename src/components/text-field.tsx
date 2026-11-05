import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Campo de texto con etiqueta accesible; nunca se borra lo escrito si algo falla. */
export function TextField({ label, style, ...rest }: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor={theme.textSecondary}
      style={[
        styles.input,
        { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.separator },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    ...Type.body,
    minHeight: 52,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
