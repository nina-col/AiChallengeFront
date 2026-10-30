import { useTypography } from '@/hooks/use-typography';
import { Stack } from 'expo-router';

import { CloseButton } from '@/components/close-button';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useReducedMotion } from '@/lib/feedback';

export default function CheckoutLayout() {
  const t = useT();
  const theme = useTheme();
  const headline = useTypography('headline');
  const reducedMotion = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        title: t.checkout.title,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text, fontFamily: headline.fontFamily, fontSize: headline.fontSize },
        headerBackButtonDisplayMode: 'minimal',
        animation: reducedMotion ? 'fade' : 'default',
        headerRight: () => <CloseButton />,
      }}>
      <Stack.Screen name="[id]/result" options={{ headerBackVisible: false, gestureEnabled: false }} />
    </Stack>
  );
}
