import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function OnboardingLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        title: '',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.primary,
        headerBackButtonDisplayMode: 'minimal',
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
