import { Pressable, StyleSheet } from 'react-native';

import { PixelIcon } from '@/components/pixel-icon';
import type { IconName } from '@/components/pixel-icons';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Un acceso con dibujo y nombre, como las apps de una pantalla de inicio. Va en una rejilla de dos. */
export function ArtTile({
  art,
  label,
  onPress,
  size = 64,
}: {
  art: IconName;
  label: string;
  onPress: () => void;
  size?: number;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
      ]}>
      <PixelIcon name={art} size={size} />
      <ThemedText type="bodyStrong" style={styles.label}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.lg,
  },
  label: {
    textAlign: 'center',
  },
});
