/**
 * Paleta "Quiet workspace", tomada del ícono (docs/brand). Tonos cálidos y de bajo estímulo:
 * sin rojos de alarma ni colores saturados. Los textos cumplen contraste AA sobre sus fondos.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1F2C35',
    background: '#F7EEDB',
    backgroundElement: '#EFE3CB',
    backgroundSelected: '#E5D5B8',
    textSecondary: '#55646A',
    primary: '#20494A',
    accent: '#3F8A7B',
    warm: '#C0643C',
  },
  dark: {
    text: '#F7EEDB',
    background: '#173A3D',
    backgroundElement: '#20494A',
    backgroundSelected: '#2B5B58',
    textSecondary: '#B9CBC4',
    primary: '#C3E6D6',
    accent: '#8DB865',
    warm: '#E9B58C',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
