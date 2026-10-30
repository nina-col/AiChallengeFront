import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Option } from '@/components/choice-list';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { checkEntering } from '@/lib/animations';
import { useSettings } from '@/lib/settings';
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
  const { settings } = useSettings();
  return (
    <View style={[styles.row, (settings.textSize !== 'standard' || settings.readingSpacing === 'wide') && { flexDirection: 'column' }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const isSelected = option.id === selected;
        return (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            aria-checked={isSelected}
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
                {Platform.OS === 'web' ? <ThemedText accessible={false} aria-hidden>✓</ThemedText> : <SymbolView name="checkmark" size={14} tintColor={theme.primary} accessibilityElementsHidden />}
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
    flexGrow: 1,
    flexShrink: 1,
    paddingVertical: Spacing.two,
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
