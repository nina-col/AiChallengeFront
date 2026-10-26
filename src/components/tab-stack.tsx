import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

/** Stack de una pestaña: encabezado nativo con título grande que se colapsa al hacer scroll. */
export function TabStack({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerLargeTitleEnabled: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text },
        headerLargeTitleStyle: { color: theme.text },
      }}>
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}
