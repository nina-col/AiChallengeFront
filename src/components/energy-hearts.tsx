import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const SHAPE = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];

/** Code-native pixel art: empty hearts retain an outline. */
function Heart({ filled }: { filled: boolean }) {
  const theme = useTheme();
  return <View style={{ width: 21, height: 18 }}>
    {SHAPE.flatMap((row, y) => [...row].map((pixel, x) => {
      if (pixel === '0') return null;
      const edge = SHAPE[y - 1]?.[x] !== '1' || SHAPE[y + 1]?.[x] !== '1' || row[x - 1] !== '1' || row[x + 1] !== '1';
      if (!filled && !edge) return null;
      return <View key={`${x}-${y}`} style={{ position: 'absolute', left: x * 3, top: y * 3, width: 3, height: 3, backgroundColor: theme.primary }} />;
    }))}
  </View>;
}

export function EnergyHearts({ labels, value, onChange }: { labels: readonly string[]; value?: number; onChange: (value: number) => void }) {
  const theme = useTheme();
  return <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
    {[5, 4, 3, 2, 1].map(level => (
      <Pressable key={level} accessibilityRole="radio" accessibilityLabel={`${level}/5 · ${labels[level - 1]}`} accessibilityState={{ checked: value === level }} aria-checked={value === level} onPress={() => onChange(level)}
        style={({ pressed }) => ({ padding: 16, minHeight: 64, borderRadius: 12, borderWidth: value === level ? 2 : 1, borderColor: value === level ? theme.primary : theme.separator, backgroundColor: value === level || pressed ? theme.backgroundSelected : theme.backgroundElement, gap: 12 })}>
        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ flexDirection: 'row', gap: 6 }}>
          {[0, 1, 2, 3, 4].map(index => <Heart key={index} filled={index < level} />)}
        </View>
        <ThemedText type="bodyStrong">{labels[level - 1]}{value === level ? ' ✓' : ''}</ThemedText>
      </Pressable>
    ))}
  </View>;
}
