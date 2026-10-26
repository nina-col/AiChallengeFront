import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Group, GroupRow } from '@/components/group';
import { Notice } from '@/components/notice';
import { PixelScene } from '@/components/pixel-scene';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useLabels, usePlaybook, useTrying } from '@/lib/queries';

export default function Today() {
  const t = useT();
  const theme = useTheme();
  const labels = useLabels();
  const trying = useTrying();
  const playbook = usePlaybook();
  const lastHelped = playbook.data?.[0];

  function refresh() {
    trying.refetch();
    playbook.refetch();
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={trying.isRefetching} onRefresh={refresh} />}>
      {trying.data?.length ? (
        <Group title={t.today.tryingTitle}>
          {trying.data.map((checkin, index) => (
            <GroupRow key={checkin.id} first={index === 0}>
              <ThemedText type="bodyStrong">{checkin.adjustment?.title}</ThemedText>
              <ThemedText type="footnote" themeColor="textSecondary">
                {[labels.task(checkin.task), checkin.space?.name].filter(Boolean).join(' · ')}
              </ThemedText>
              <Button
                variant="secondary"
                title={t.today.tellMe}
                onPress={() => router.push({ pathname: '/checkout/[id]', params: { id: checkin.id } })}
              />
            </GroupRow>
          ))}
        </Group>
      ) : null}

      <View style={styles.prompt}>
        <PixelScene size={96} />
        <ThemedText type="headline" style={styles.center}>
          {t.today.promptTitle}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {t.today.promptBody}
        </ThemedText>
        <Button title={t.today.start} onPress={() => router.push('/checkin/task')} style={styles.cta} />
      </View>

      {lastHelped ? (
        <Group title={t.today.lastHelped}>
          <GroupRow first>
            <ThemedText type="bodyStrong">{lastHelped.adjustment.title}</ThemedText>
            <ThemedText type="footnote" themeColor="textSecondary">
              {[labels.task(lastHelped.task), lastHelped.space?.name].filter(Boolean).join(' · ')}
            </ThemedText>
          </GroupRow>
        </Group>
      ) : null}

      {trying.isError ? <Notice text={t.common.offline} action={t.common.retry} onAction={refresh} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  prompt: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  center: {
    textAlign: 'center',
  },
  cta: {
    alignSelf: 'stretch',
  },
});
