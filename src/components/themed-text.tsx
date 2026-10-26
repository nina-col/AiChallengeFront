import { Text, type TextProps } from 'react-native';

import { Type, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: keyof typeof Type;
  themeColor?: ThemeColor;
};

/** Todo el texto de la app pasa por aquí: fuente del sistema, escala de `Type` y Dynamic Type. */
export function ThemedText({ style, type = 'body', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  return <Text style={[{ color: theme[themeColor ?? 'text'] }, Type[type], style]} {...rest} />;
}
