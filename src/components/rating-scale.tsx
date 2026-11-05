import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** Large, labeled choices; no dragging precision or default answer required. */
export function RatingScale({ value, labels, onChange, disabled = false }: {
  value?: number; labels: readonly string[]; onChange: (value: number) => void; disabled?: boolean;
}) {
  const theme = useTheme();
  return <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {labels.map((label, index) => {
      const score = index + 1;
      const selected = value === score;
      return <Pressable key={score} accessibilityRole="radio" accessibilityLabel={`${score} · ${label}`} accessibilityState={{ checked: selected, disabled }} aria-checked={selected} aria-disabled={disabled} disabled={disabled} onPress={() => onChange(score)}
        style={({ pressed }) => ({ flexBasis: '28%', flexGrow: 1, minWidth: 88, minHeight: 72, padding: 12, borderRadius: 12, borderWidth: selected ? 2 : 1, borderColor: selected ? theme.primary : theme.separator, backgroundColor: selected || pressed ? theme.backgroundSelected : theme.backgroundElement, alignItems: 'center', justifyContent: 'center', gap: 4, opacity: disabled ? 0.5 : 1 })}>
        <ThemedText type="bodyStrong" accessible={false}>{selected ? `✓ ${score}` : String(score)}</ThemedText>
        <ThemedText type="footnote" style={{ textAlign: 'center' }} accessible={false}>{label}</ThemedText>
      </Pressable>;
    })}
  </View>;
}
