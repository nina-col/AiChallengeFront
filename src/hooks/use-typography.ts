import type { TextStyle } from 'react-native';
import { Type } from '@/constants/theme';
import { useSettings } from '@/lib/settings';

export function useTypography(type: keyof typeof Type = 'body', strong?: boolean): TextStyle {
  const { settings } = useSettings();
  const base = Type[type];
  const scale = { standard: 1, large: 1.15, extraLarge: 1.3 }[settings.textSize];
  const bold = strong ?? base.fontWeight === '600';
  const fontFamily = settings.font === 'system' ? undefined
    : settings.font === 'atkinson' ? (bold ? 'Atkinson-Bold' : 'Atkinson-Regular')
    : (bold ? 'Lexend-SemiBold' : 'Lexend-Regular');
  return {
    ...base, fontFamily, fontWeight: fontFamily ? '400' : bold ? '600' : '400',
    fontSize: base.fontSize * scale,
    lineHeight: base.lineHeight * scale * (settings.readingSpacing === 'wide' ? 1.2 : 1),
    letterSpacing: settings.readingSpacing === 'wide' ? 0.4 : 0,
  };
}
