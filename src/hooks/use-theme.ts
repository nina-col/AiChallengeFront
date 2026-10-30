import { ExtraPalettes } from '@/constants/palettes';
import { Colors, type Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isDarkAppearance } from '@/lib/appearance';
import { useSettings } from '@/lib/settings';

export function useIsDark() {
  const { settings } = useSettings();
  return isDarkAppearance(settings, useColorScheme());
}

export function useTheme(): Palette {
  const dark = useIsDark();
  const { settings } = useSettings();
  if (settings.palette === 'forest') {
    if (settings.softContrast) return dark ? Colors.darkSoft : Colors.lightSoft;
    return dark ? Colors.dark : Colors.light;
  }
  const palette = ExtraPalettes[settings.palette][dark ? 'dark' : 'light'];
  // Reduce surface brightness without reducing text contrast.
  return settings.softContrast ? { ...palette, backgroundElement: palette.background } : palette;
}
