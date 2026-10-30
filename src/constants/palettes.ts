import type { Palette } from '@/constants/theme';

export const ExtraPalettes: Record<'ocean' | 'lavender', { light: Palette; dark: Palette }> = {
  ocean: {
    light: {
      text: '#24313D', textSecondary: '#4C5D6C', background: '#F1EEE6', backgroundElement: '#F9F7F1',
      backgroundSelected: '#DAE7ED', separator: 'rgba(36,49,61,0.18)', primary: '#264C68', onPrimary: '#F7F5EE', accent: '#476E88', warm: '#935D3F',
    },
    dark: {
      text: '#EFF1F4', textSecondary: '#C0CEDB', background: '#1B2935', backgroundElement: '#243744',
      backgroundSelected: '#314C5D', separator: 'rgba(239,241,244,0.18)', primary: '#BEDDEF', onPrimary: '#1B2935', accent: '#96C3DB', warm: '#E5B692',
    },
  },
  lavender: {
    light: {
      text: '#302B3A', textSecondary: '#62576C', background: '#F0EDF2', backgroundElement: '#F9F6FA',
      backgroundSelected: '#E5DDEC', separator: 'rgba(48,43,58,0.18)', primary: '#594369', onPrimary: '#FAF6FB', accent: '#7A628A', warm: '#925E46',
    },
    dark: {
      text: '#F3EDF6', textSecondary: '#D0C0D8', background: '#2A2430', backgroundElement: '#382F40',
      backgroundSelected: '#4A3D54', separator: 'rgba(243,237,246,0.18)', primary: '#DECAE8', onPrimary: '#2A2430', accent: '#C4A9D6', warm: '#E8BA99',
    },
  },
};
