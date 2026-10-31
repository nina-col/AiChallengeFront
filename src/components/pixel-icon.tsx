import { Image } from 'expo-image';

import { PIXEL_ICONS, type IconName } from '@/components/pixel-icons';

/**
 * Un ícono de pixel art de la app (docs/brand/draw_icons.py). Es decorativo: siempre va junto a su
 * texto, y VoiceOver lee el texto. Se ve bien en cualquier paleta porque trae su propia baldosa.
 */
export function PixelIcon({ name, size = 40 }: { name: IconName; size?: number }) {
  return (
    <Image
      source={PIXEL_ICONS[name]}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={0}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
