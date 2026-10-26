import { Colors, type Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettings } from '@/lib/settings';

/** Paleta activa: claro u oscuro según el teléfono, con "Contraste suave" si la persona lo eligió. */
export function useTheme(): Palette {
  const dark = useColorScheme() === 'dark';
  const { settings } = useSettings();
  if (settings.softContrast) return dark ? Colors.darkSoft : Colors.lightSoft;
  return dark ? Colors.dark : Colors.light;
}
