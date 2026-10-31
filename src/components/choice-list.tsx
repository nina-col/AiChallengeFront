import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { PixelIcon } from '@/components/pixel-icon';
import type { IconName } from '@/components/pixel-icons';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { checkEntering } from '@/lib/animations';
import { useSettings } from '@/lib/settings';
import { useMotionLevel } from '@/lib/feedback';

export type Option = {
  id: string;
  label: string;
  hint?: string;
  emoji?: string;
  /** Dibujo de la opción; siempre junto a su texto. `artCount`: cuántas veces se repite. */
  art?: IconName;
  artCount?: number;
};

type ChoiceListProps = {
  options: Option[];
  selected: string[];
  onSelect: (id: string) => void;
  /** Varias opciones a la vez (casillas) o una sola (radio). */
  multiple?: boolean;
  disabled?: boolean;
};

/**
 * Lista de opciones en un solo grupo con separadores finos (no una tarjeta por fila).
 * Lo elegido se nota por el fondo y por un ícono: nunca solo por el color. Elegir no suena ni
 * vibra (es lo más frecuente de la app); con detalles, la palomita aparece con un fundido corto.
 */
export function ChoiceList({ options, selected, onSelect, multiple = false, disabled = false }: ChoiceListProps) {
  const theme = useTheme();
  const level = useMotionLevel();
  const { settings } = useSettings();

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
            disabled={disabled}
            key={option.id}
            onPress={() => onSelect(option.id)}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: isSelected, disabled }}
            aria-checked={isSelected}
            aria-disabled={disabled}
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            style={({ pressed }) => [
              styles.row,
              settings.readingSpacing === 'wide' && { paddingVertical: Spacing.four, gap: Spacing.four },
              disabled && { opacity: 0.45 },
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
              (isSelected || pressed) && { backgroundColor: theme.backgroundSelected },
            ]}>
            {option.art ? (
              <View style={styles.art}>
                {Array.from({ length: option.artCount ?? 1 }, (_, i) => (
                  <PixelIcon key={i} name={option.art!} size={option.artCount ? 24 : 40} />
                ))}
              </View>
            ) : null}
            {option.emoji ? <ThemedText accessible={false} accessibilityElementsHidden importantForAccessibility="no" aria-hidden>{option.emoji}</ThemedText> : null}
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
                {Platform.OS === 'web' ? (
                  <ThemedText type="bodyStrong" accessible={false} aria-hidden style={{ color: theme.primary }}>{isSelected ? '✓' : '○'}</ThemedText>
                ) : <SymbolView
                  name={icon}
                  size={22}
                  tintColor={isSelected ? theme.primary : theme.textSecondary}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />}
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
  art: {
    flexDirection: 'row',
    gap: Spacing.half,
  },
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
