import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { DeskScene } from '@/components/desk/desk-scene';
import { Group, GroupRow } from '@/components/group';
import { Notice } from '@/components/notice';
import { RoomView } from '@/components/room/room-view';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { stepEntering } from '@/lib/animations';
import { useDesk } from '@/lib/desk';
import { useMotionLevel } from '@/lib/feedback';
import { useDone, usePlaybook } from '@/lib/queries';
import { useCurrentPlace, usePlaceRoom } from '@/lib/room';
import { useSettings } from '@/lib/settings';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * El resumen de la semana: tres partes, siempre en el mismo orden y sin sorpresas. Lo que se
 * repite cada semana es el hábito; nada se desbloquea ni se pierde. Si no hubo pruebas, se dice
 * sin culpa. Arriba, el cuarto del lugar de ahora (o la escena 2D, si no hay lugar).
 */
export default function Recap() {
  const t = useT();
  const theme = useTheme();
  const level = useMotionLevel();
  const done = useDone();
  const playbook = usePlaybook();
  const desk = useDesk();
  const room = usePlaceRoom(useCurrentPlace());
  const [since] = useState(() => Date.now() - WEEK_MS);
  const { update } = useSettings();

  // Abrirlo cuenta como "sigue sirviendo": así no se pregunta si lo quiere mientras lo use.
  useEffect(() => {
    update({ recapSeenAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, []);

  const week = (done.data ?? []).filter(
    (checkin) => new Date(checkin.created_at).getTime() >= since && checkin.adjustment?.kind !== 'baseline',
  );
  const helped = [
    ...new Set(week.filter((c) => c.outcome === 'helped').map((c) => c.adjustment?.title ?? '')),
  ].filter(Boolean);
  const best = playbook.data?.[0];
  const items = desk.items;

  const parts = [
    { label: t.recap.triedLabel, text: week.length ? t.recap.tried(week.length) : t.recap.triedNone },
    {
      label: t.recap.helpedLabel,
      text: helped.length ? t.recap.helped(helped) : week.length ? t.recap.helpedNone : t.recap.helpedNoTrials,
    },
    {
      label: t.recap.bestLabel,
      text: best ? t.recap.best(best.adjustment.title, best.helped, best.trials) : t.recap.bestNone,
    },
  ];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}>
      {room.scene === 'room' && room.layout ? (
        <RoomView layout={room.layout} modifiers={room.modifiers} settle accessibilityLabel={room.label} />
      ) : room.scene === 'desk' ? (
        <DeskScene items={items} accessibilityLabel={t.desk.label(items.map((item) => t.desk.items[item]))} />
      ) : null}
      <ThemedText type="callout" themeColor="textSecondary">
        {t.recap.hint}
      </ThemedText>

      {done.isError || playbook.isError ? (
        <Notice
          text={t.common.offline}
          action={t.common.retry}
          onAction={() => {
            done.refetch();
            playbook.refetch();
          }}
        />
      ) : done.isSuccess && playbook.isSuccess ? (
        parts.map((part, index) => (
          <Animated.View key={part.label} entering={stepEntering(level, index)}>
            <Group title={part.label}>
              <GroupRow first>
                <ThemedText>{part.text}</ThemedText>
              </GroupRow>
            </Group>
          </Animated.View>
        ))
      ) : null}

      {done.isSuccess ? (
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.center}>
          {t.recap.footer}
        </ThemedText>
      ) : null}
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
  center: {
    textAlign: 'center',
  },
});
