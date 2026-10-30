import { useTypography } from '@/hooks/use-typography';
import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { useReducedMotion } from '@/lib/feedback';

export default function OnboardingLayout() {
  const theme = useTheme();
  const headline = useTypography('headline');
  const reducedMotion = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        title: '',
        headerShadowVisible: false,
        animation: reducedMotion ? 'fade' : 'default',
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text, fontFamily: headline.fontFamily, fontSize: headline.fontSize },
        headerBackButtonDisplayMode: 'minimal',
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
