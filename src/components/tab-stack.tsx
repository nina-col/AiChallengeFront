import { Stack } from 'expo-router';

import { useTypography } from '@/hooks/use-typography';
import { useTheme } from '@/hooks/use-theme';

/** Stack de una pestaña: encabezado nativo con título grande que se colapsa al hacer scroll. */
export function TabStack({ title }: { title: string }) {
  const theme = useTheme();
  const headline = useTypography('headline');
  const titleStyle = useTypography('title');
  return (
    <Stack
      screenOptions={{
        headerLargeTitleEnabled: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text, fontFamily: headline.fontFamily, fontSize: headline.fontSize },
        headerLargeTitleStyle: { color: theme.text, fontFamily: titleStyle.fontFamily, fontSize: titleStyle.fontSize },
      }}>
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}
