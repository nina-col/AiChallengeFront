import { Stack } from 'expo-router';

import { CloseButton } from '@/components/close-button';
import { useTheme } from '@/hooks/use-theme';
import { useTypography } from '@/hooks/use-typography';
import { useT } from '@/i18n';
import { useReducedMotion } from '@/lib/feedback';

export default function PlaceLayout() {
  const t = useT();
  const theme = useTheme();
  const headline = useTypography('headline');
  const reducedMotion = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        title: t.place.title,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text, fontFamily: headline.fontFamily, fontSize: headline.fontSize },
        headerRight: () => <CloseButton />,
        animation: reducedMotion ? 'fade' : 'default',
      }}>
      {/* Decorar se deja con "Guardar cambios" o "Cancelar": ni deslizar ni "Cerrar" tiran lo que no se guardó. */}
      <Stack.Screen name="[id]/edit" options={{ gestureEnabled: false, headerBackVisible: false, headerRight: () => null }} />
    </Stack>
  );
}
