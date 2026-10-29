import { QueryFeedback } from '@/components/query-feedback';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { BeaverMascot } from '@/components/beaver-mascot';
import { Button } from '@/components/button';
import { DeskScene } from '@/components/desk/desk-scene';
import { Group, GroupRow } from '@/components/group';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useDesk } from '@/lib/desk';
import { useMotionLevel } from '@/lib/feedback';
import { cancelRecap } from '@/lib/notifications';
import { keys, queryClient, useLabels, usePlaybook, useSpaces, useTrying } from '@/lib/queries';
import { useSettings } from '@/lib/settings';

/** Tras 5 semanas sin abrir el resumen, se pregunta una vez si lo sigue queriendo (nunca se insiste). */
const RECAP_UNSEEN_MS = 5 * 7 * 24 * 60 * 60 * 1000;

export default function Today() {
  const t = useT();
  const theme = useTheme();
  const labels = useLabels();
  const level = useMotionLevel();
  const { settings, update } = useSettings();
  const trying = useTrying();
  const playbook = usePlaybook();
  const desk = useDesk();
  const spaces = useSpaces();
  const [openedAt] = useState(() => Date.now());
  const lastHelped = playbook.data?.[0];
  // The companion belongs to the desk; hiding the desk hides both.
  const items = settings.showDesk ? desk.items : [];
  const askAboutRecap = settings.recapDay !== 'off' && openedAt - settings.recapSeenAt > RECAP_UNSEEN_MS;

  function refresh() {
    trying.refetch();
    playbook.refetch();
    queryClient.invalidateQueries({ queryKey: keys.progress });
  }

  async function stopRecap() {
    await cancelRecap();
    update({ recapDay: 'off' });
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={trying.isRefetching} onRefresh={refresh} />}>
      <QueryFeedback query={trying} />
      <QueryFeedback query={playbook} />
      {trying.data?.length ? (
        <Group title={t.today.tryingTitle} footer={t.today.tryingFooter}>
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

      {settings.showDesk ? <View style={styles.desk}>
        <DeskScene
          items={items}
          interactive
          accessibilityLabel={t.desk.label(items.map((item) => t.desk.items[item]))}
        />
        <View style={styles.companion}>
          <BeaverMascot pose="coffee" size={72} />
          <ThemedText type="callout" themeColor="textSecondary" style={styles.companionText}>
            {t.today.mascotNote}
          </ThemedText>
        </View>
        <View style={styles.caption}>
          {settings.showDesk ? (
            <ThemedText type="footnote" themeColor="textSecondary" style={styles.shrink}>
              {desk.trials ? `${t.today.deskTitle} · ${t.today.deskCount(desk.trials)}` : t.today.deskEmpty}
            </ThemedText>
          ) : null}
          {level === 'detailed' ? (
            <ThemedText type="footnote" themeColor="textSecondary" importantForAccessibility="no">
              {t.today.deskTap}
            </ThemedText>
          ) : null}
        </View>
      </View> : null}

      <View style={styles.prompt}>
        <ThemedText type="headline" style={styles.center}>
          {t.today.promptTitle}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {t.today.promptBody}
        </ThemedText>
        <Button title={t.today.start} onPress={() => router.push('/checkin/task')} style={styles.cta} />
        <Button variant="plain" title={t.today.seeWeek} onPress={() => router.push('/recap')} style={styles.cta} />
      </View>

      {/* Cada lugar recuerda lo que se probó ahí, ayudara o no. */}
      {spaces.data?.length ? (
        <Group title={t.place.placesTitle}>
          {spaces.data.map((space, index) => (
            <GroupRow key={space.id} first={index === 0}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={space.name}
                accessibilityHint={t.place.open}
                onPress={() => router.push({ pathname: '/place/[id]', params: { id: space.id } })}
                style={({ pressed }) => [styles.placeRow, { opacity: pressed ? 0.6 : 1 }]}>
                <View style={styles.shrink}>
                  <ThemedText>{space.name}</ThemedText>
                  <ThemedText type="footnote" themeColor="textSecondary">
                    {t.place.open}
                  </ThemedText>
                </View>
                <SymbolView name="chevron.right" size={14} tintColor={theme.textSecondary} accessibilityElementsHidden />
              </Pressable>
            </GroupRow>
          ))}
        </Group>
      ) : null}

      {askAboutRecap ? (
        <Group title={t.today.recapStillTitle}>
          <GroupRow first>
            <ThemedText type="callout">{t.today.recapStillBody}</ThemedText>
            <Button
              variant="secondary"
              title={t.today.recapKeep}
              onPress={() => update({ recapSeenAt: Date.now() })}
            />
            <Button variant="plain" title={t.today.recapStop} onPress={stopRecap} />
          </GroupRow>
        </Group>
      ) : null}

      {/* Se ofrece una sola vez y no vuelve a aparecer: la persona elige, sin insistir. */}
      {!settings.experienceOffered ? (
        <Group title={t.today.experienceTitle}>
          <GroupRow first>
            <ThemedText type="callout">{t.today.experienceBody}</ThemedText>
            <Button
              variant="secondary"
              title={t.today.experienceYes}
              onPress={() => update({ details: true, experienceOffered: true })}
            />
            <Button variant="plain" title={t.today.experienceNo} onPress={() => update({ experienceOffered: true })} />
          </GroupRow>
        </Group>
      ) : null}

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
  desk: {
    gap: Spacing.two,
  },
  companion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  companionText: { flex: 1 },
  caption: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  placeRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  shrink: {
    flexShrink: 1,
  },
  prompt: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  center: {
    textAlign: 'center',
  },
  cta: {
    alignSelf: 'stretch',
  },
});
