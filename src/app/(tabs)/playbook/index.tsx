import { QueryFeedback } from '@/components/query-feedback';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Group, GroupRow } from '@/components/group';
import { BeaverMascot } from '@/components/beaver-mascot';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useLabels, usePlaybook } from '@/lib/queries';
import type { PlaybookEntry } from '@/lib/types';

/** Lo que ha ayudado, agrupado por tarea y lugar, con cuántas veces se probó. */
export default function Playbook() {
  const t = useT();
  const theme = useTheme();
  const labels = useLabels();
  const playbook = usePlaybook();

  const groups = new Map<string, PlaybookEntry[]>();
  for (const entry of playbook.data ?? []) {
    const key = `${entry.task}|${entry.space?.id ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={playbook.isRefetching}
          onRefresh={() => {
            playbook.refetch();
          }}
        />
      }>
      <QueryFeedback query={playbook} />

      {playbook.isSuccess && groups.size === 0 ? (
        <View style={styles.empty}>
          <BeaverMascot pose="notebook" size={136} />
          <ThemedText type="headline" style={styles.center}>
            {t.playbook.emptyTitle}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            {t.playbook.emptyBody}
          </ThemedText>
          <Button title={t.today.start} onPress={() => router.push('/checkin/task')} style={styles.cta} />
        </View>
      ) : null}

      {[...groups.values()].map((entries) => {
        const first = entries[0];
        const title = `${labels.task(first.task)} · ${first.space?.name ?? t.playbook.anyPlace}`;
        return (
          <Group key={`${first.task}|${first.space?.id}`} title={title}>
            {entries.map((entry, index) => (
              <GroupRow key={`${entry.stimulus}|${entry.adjustment.id}`} first={index === 0}>
                <ThemedText type="bodyStrong">{entry.adjustment.title}</ThemedText>
                <ThemedText type="footnote" themeColor="textSecondary">
                  {t.playbook.forStimulus(labels.stimulus(entry.stimulus))}
                </ThemedText>
                <ThemedText type="footnote">{t.playbook.evidence(entry.helped, entry.trials)}</ThemedText>
                <Button
                  variant="plain"
                  title={t.playbook.makeItPermanent}
                  style={styles.inlineAction}
                  onPress={() =>
                    router.push({
                      pathname: '/request',
                      params: {
                        task: entry.task,
                        stimulus: entry.stimulus,
                        place: entry.space?.name ?? '',
                        from: entry.adjustment.id,
                        helped: String(entry.helped),
                        trials: String(entry.trials),
                      },
                    })
                  }
                />
              </GroupRow>
            ))}
          </Group>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.four,
  },
  center: {
    textAlign: 'center',
  },
  cta: {
    alignSelf: 'stretch',
  },
  inlineAction: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    minHeight: 44,
  },
});
