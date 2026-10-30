import { useTypography } from '@/hooks/use-typography';
import { Stack } from 'expo-router';

import { CloseButton } from '@/components/close-button';
import { useTheme } from '@/hooks/use-theme';
import { useReducedMotion } from '@/lib/feedback';
import { useT } from '@/i18n';

export default function RequestLayout() {
  const t = useT();
  const theme = useTheme();
  const headline = useTypography('headline');
  const reducedMotion = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        title: t.request.title,
        headerShadowVisible: false,
        animation: reducedMotion ? 'fade' : 'default',
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text, fontFamily: headline.fontFamily, fontSize: headline.fontSize },
        headerRight: () => <CloseButton />,
      }}
    />
  );
}
