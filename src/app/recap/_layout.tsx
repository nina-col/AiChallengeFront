import { Stack } from 'expo-router';

import { CloseButton } from '@/components/close-button';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

export default function RecapLayout() {
  const t = useT();
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        title: t.recap.title,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text },
        headerRight: () => <CloseButton />,
      }}
    />
  );
}
