import { CheckinActions } from '@/components/checkin-actions';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';

import { BeaverMascot } from '@/components/beaver-mascot';
import { Button } from '@/components/button';
import { Group, GroupRow } from '@/components/group';
import { QueryFeedback } from '@/components/query-feedback';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useLabels, useTrying } from '@/lib/queries';
import { useUxCopy } from '@/lib/ux-copy';

export default function Today() {
  const t = useT();
  const copy = useUxCopy();
  const theme = useTheme();
  const trying = useTrying();
  const labels = useLabels();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ padding: Spacing.three, gap: Spacing.four, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={trying.isRefetching} onRefresh={() => { trying.refetch(); }} />}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <BeaverMascot pose="coffee" size={96} interactive />
        <ThemedText type="body" themeColor="textSecondary" accessibilityRole="header" style={{ textAlign: 'center' }}>{copy.home}</ThemedText>
      </View>
      <CheckinActions />
      <QueryFeedback query={trying} />
      {trying.data?.length ? (
        <Group title={t.today.tryingTitle}>
          {trying.data.map((checkin, index) => (
            <GroupRow key={checkin.id} first={index === 0}>
              <ThemedText type="bodyStrong">{checkin.adjustment?.title}</ThemedText>
              <ThemedText type="footnote">{[labels.task(checkin.task), checkin.space?.name].filter(Boolean).join(' · ')}</ThemedText>
              <Button title={copy.helpful} variant="secondary" onPress={() => router.push({ pathname: '/checkout/[id]', params: { id: checkin.id } })} />
            </GroupRow>
          ))}
        </Group>
      ) : null}
      <Button title={copy.pause} variant="plain" onPress={() => router.push('/zen')} />
      <Button title={copy.summary} variant="plain" onPress={() => router.push('/recap')} />
    </ScrollView>
  );
}
