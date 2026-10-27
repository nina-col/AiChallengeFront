import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Option } from '@/components/choice-list';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { checkEntering } from '@/lib/animations';
import { useMotionLevel } from '@/lib/feedback';

/** Tres o menos opciones cortas en una fila (Sí / No / No sé). Lo elegido lleva ícono y fondo. */
export function SegmentedChoice({
  options,
  selected,
  onSelect,
  label,
}: {
  options: Option[];
  selected?: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  const theme = useTheme();
  const level = useMotionLevel();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const isSelected = option.id === selected;
        return (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: isSelected || pressed ? theme.backgroundSelected : theme.background,
                borderColor: isSelected ? theme.primary : theme.separator,
              },
            ]}>
            {isSelected ? (
              <Animated.View entering={checkEntering(level)}>
                <SymbolView name="checkmark" size={14} tintColor={theme.primary} accessibilityElementsHidden />
              </Animated.View>
            ) : null}
            <ThemedText type="callout" style={isSelected ? { fontWeight: '600' } : undefined}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  option: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.sm,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
  },
});
