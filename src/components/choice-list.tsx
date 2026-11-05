import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { checkEntering } from '@/lib/animations';
import { useMotionLevel } from '@/lib/feedback';

export type Option = { id: string; label: string; hint?: string };

type ChoiceListProps = {
  options: Option[];
  selected: string[];
  onSelect: (id: string) => void;
  /** Varias opciones a la vez (casillas) o una sola (radio). */
  multiple?: boolean;
};

/**
 * Lista de opciones en un solo grupo con separadores finos (no una tarjeta por fila).
 * Lo elegido se nota por el fondo y por un ícono: nunca solo por el color. Elegir no suena ni
 * vibra (es lo más frecuente de la app); con detalles, la palomita aparece con un fundido corto.
 */
export function ChoiceList({ options, selected, onSelect, multiple = false }: ChoiceListProps) {
  const theme = useTheme();
  const level = useMotionLevel();

  return (
    <LayoutAnimationConfig skipEntering>
    <View
      style={[styles.group, { backgroundColor: theme.backgroundElement }]}
      accessibilityRole={multiple ? undefined : 'radiogroup'}>
      {options.map((option, index) => {
        const isSelected = selected.includes(option.id);
        const icon = multiple ? (isSelected ? 'checkmark.circle.fill' : 'circle') : 'checkmark';
        return (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={multiple ? { checked: isSelected } : { selected: isSelected }}
            accessibilityHint={option.hint}
            style={({ pressed }) => [
              styles.row,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
              (isSelected || pressed) && { backgroundColor: theme.backgroundSelected },
            ]}>
            <View style={styles.text}>
              <ThemedText>{option.label}</ThemedText>
              {option.hint ? (
                <ThemedText type="footnote" themeColor="textSecondary">
                  {option.hint}
                </ThemedText>
              ) : null}
            </View>
            {multiple || isSelected ? (
              <Animated.View key={isSelected ? 'on' : 'off'} entering={isSelected ? checkEntering(level) : undefined}>
                <SymbolView
                  name={icon}
                  size={22}
                  tintColor={isSelected ? theme.primary : theme.textSecondary}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              </Animated.View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - Spacing.one,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
});
