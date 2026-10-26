/**
 * Tokens de diseño de SpaceEase (reglas en docs/DESIGN.md).
 * Paleta "Quiet workspace" del ícono: tonos cálidos de bajo estímulo, sin rojos de alarma.
 * Texto principal y secundario con contraste AA (≥ 4.5:1) sobre fondo y superficies.
 * `accent` no se usa para texto chico (3.9:1): solo iconos, bordes y elementos grandes.
 */

import '@/global.css';

import { Platform } from 'react-native';
import { Easing } from 'react-native-reanimated';

const light = {
  text: '#1F2C35',
  textSecondary: '#55646A',
  /** Papel cálido: menos brillo que el blanco puro. */
  background: '#F4EEE2',
  /** Superficie de grupos y filas. */
  backgroundElement: '#FBF8F1',
  /** Opción elegida (siempre junto con un ícono de check, nunca solo el color). */
  backgroundSelected: '#E1EDE6',
  separator: 'rgba(31, 44, 53, 0.12)',
  primary: '#20494A',
  onPrimary: '#F7EEDB',
  accent: '#3F8A7B',
  warm: '#B86A45',
};

const dark: typeof light = {
  text: '#F3EDE0',
  textSecondary: '#B9CBC4',
  background: '#152F32',
  backgroundElement: '#1D3D40',
  backgroundSelected: '#29504F',
  separator: 'rgba(243, 237, 224, 0.14)',
  primary: '#C3E6D6',
  onPrimary: '#152F32',
  accent: '#8DB865',
  warm: '#E9B58C',
};

/** "Contraste suave" (opción de Ajustes): menos diferencia entre texto y fondo, sin bajar de AA. */
const lightSoft: typeof light = {
  ...light,
  text: '#34434B',
  textSecondary: '#5D6B70',
  background: '#EEE8DC',
  backgroundElement: '#F5F1E8',
};

const darkSoft: typeof light = {
  ...dark,
  text: '#DDD8CC',
  textSecondary: '#AFC0BA',
  background: '#1A3437',
  backgroundElement: '#213F41',
};

export const Colors = { light, dark, lightSoft, darkSoft } as const;

export type Palette = typeof light;
export type ThemeColor = keyof Palette;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
  },
  default: {
    sans: 'normal',
    rounded: 'normal',
  },
  web: {
    sans: 'var(--font-display)',
    rounded: 'var(--font-rounded)',
  },
});

/** Escala de texto calmada: pesos ligeros, interlineado ≈ 1.45 (guía de la British Dyslexia Association). */
export const Type = {
  title: { fontSize: 26, lineHeight: 33, fontWeight: '600' },
  headline: { fontSize: 19, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 25, fontWeight: '400' },
  bodyStrong: { fontSize: 17, lineHeight: 25, fontWeight: '600' },
  callout: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  footnote: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
} as const;

/** Tamaño mínimo de lo que se toca (WCAG 2.5.5 pide 44; usamos 48). */
export const MinTarget = 48;

/**
 * Movimiento: breve y con propósito. Nada pasa de 250 ms y no hay rebotes.
 * Con "Reducir movimiento" solo quedan cambios de opacidad.
 */
export const Motion = {
  fast: 120,
  base: 200,
  easeOut: Easing.bezier(0.23, 1, 0.32, 1),
} as const;

export const MaxContentWidth = 640;
