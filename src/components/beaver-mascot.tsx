import { useSettings } from '@/lib/settings';
import { Image } from 'expo-image';

const poses = {
  welcome: require('@/assets/mascot/beaver-welcome.png'),
  coffee: require('@/assets/mascot/beaver-coffee.png'),
  notebook: require('@/assets/mascot/beaver-notebook.png'),
} as const;

/** Quiet companion: decorative, static, and never a control or a reward. */
export function BeaverMascot({ pose, size = 112 }: { pose: keyof typeof poses; size?: number }) {
  const { settings } = useSettings();
  if (!settings.showMascot || settings.focusMode) return null;
  return (
    <Image
      source={poses[pose]}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
      transition={0}
    />
  );
}
