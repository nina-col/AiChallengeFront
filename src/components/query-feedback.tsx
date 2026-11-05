import { router } from 'expo-router';
import { ApiError } from '@/lib/api';
import { useUxCopy } from '@/lib/ux-copy';
import { ActivityIndicator, View } from 'react-native';

import { Notice } from '@/components/notice';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

export function QueryFeedback({ query }: { query: { isPending: boolean; isError: boolean; refetch: () => unknown; error?: unknown } }) {
  const t = useT();
  const copy = useUxCopy();
  const theme = useTheme();
  if (query.isError && query.error instanceof ApiError && query.error.status === 401) return <Notice text={copy.sessionRequired} action={copy.finishWelcome} onAction={() => router.push('/onboarding')} />;
  if (query.isError) return <Notice text={t.common.offline} action={t.common.retry} onAction={() => { query.refetch(); }} />;
  if (!query.isPending) return null;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={t.common.loading} style={{ gap: Spacing.two, alignItems: 'center' }}>
      <ActivityIndicator color={theme.primary} />
      <ThemedText type="callout" themeColor="textSecondary">{t.common.loading}</ThemedText>
    </View>
  );
}
