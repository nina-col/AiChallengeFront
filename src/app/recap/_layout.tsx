import { useTypography } from '@/hooks/use-typography';
import { Stack } from 'expo-router';

import { CloseButton } from '@/components/close-button';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

export default function RecapLayout() {
  const t = useT();
  const theme = useTheme();
  const headline = useTypography('headline');
  return (
    <Stack
      screenOptions={{
        title: t.recap.title,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text, fontFamily: headline.fontFamily, fontSize: headline.fontSize },
        headerRight: () => <CloseButton />,
      }}
    />
  );
}
