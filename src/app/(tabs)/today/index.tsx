import { CheckinActions } from '@/components/checkin-actions';
import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { BeaverMascot } from '@/components/beaver-mascot';
import { Button } from '@/components/button';
import { Group, GroupRow } from '@/components/group';
import { QueryFeedback } from '@/components/query-feedback';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { cancelRecap } from '@/lib/notifications';
import { useLabels, useTrying } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import { useUxCopy } from '@/lib/ux-copy';

/** Tras 5 semanas sin abrir el resumen, se pregunta una vez si lo sigue queriendo (nunca se insiste). */
const RECAP_UNSEEN_MS = 5 * 7 * 24 * 60 * 60 * 1000;

export default function Today() {
  const t = useT();
  const copy = useUxCopy();
  const theme = useTheme();
  const trying = useTrying();
  const labels = useLabels();
  const { settings, update } = useSettings();
  const [openedAt] = useState(() => Date.now());
  const askAboutRecap = settings.recapDay !== 'off' && openedAt - settings.recapSeenAt > RECAP_UNSEEN_MS;

  async function stopRecap() {
    await cancelRecap();
    update({ recapDay: 'off' });
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
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
      {askAboutRecap && !settings.focusMode ? (
        <Group title={t.today.recapStillTitle}>
          <GroupRow first>
            <ThemedText type="callout">{t.today.recapStillBody}</ThemedText>
            <Button variant="secondary" title={t.today.recapKeep} onPress={() => update({ recapSeenAt: Date.now() })} />
            <Button variant="plain" title={t.today.recapStop} onPress={stopRecap} />
          </GroupRow>
        </Group>
      ) : null}
      {/* Se ofrece una sola vez y no vuelve a aparecer: la persona elige, sin insistir. */}
      {!settings.experienceOffered && !settings.focusMode ? (
        <Group title={t.today.experienceTitle}>
          <GroupRow first>
            <ThemedText type="callout">{t.today.experienceBody}</ThemedText>
            <Button variant="secondary" title={t.today.experienceYes} onPress={() => update({ details: true, experienceOffered: true })} />
            <Button variant="plain" title={t.today.experienceNo} onPress={() => update({ experienceOffered: true })} />
          </GroupRow>
        </Group>
      ) : null}
      <Button title={copy.pause} variant="plain" onPress={() => router.push('/zen')} />
      <Button title={copy.summary} variant="plain" onPress={() => router.push('/recap')} />
    </ScrollView>
  );
}
