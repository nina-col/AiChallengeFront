import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/button';
import { DeskScene, SETTLED_MS } from '@/components/desk/desk-scene';
import { Group, GroupRow } from '@/components/group';
import { RoomView } from '@/components/room/room-view';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLocale, useT } from '@/i18n';
import { contentEntering } from '@/lib/animations';
import { isInner } from '@/lib/checkin-route';
import { outcomeKey, type SavedOutcome } from '@/lib/checkout';
import { useDesk } from '@/lib/desk';
import { useFeedback, useMotionLevel } from '@/lib/feedback';
import { queryClient, useLabels } from '@/lib/queries';
import { typeLabel, usePlaceRoom, useSceneCue, visibleArrival } from '@/lib/room';
import { useSettings } from '@/lib/settings';

/**
 * El resultado, dicho con honestidad (al estilo de Self-E): cuántas veces se probó y si todavía
 * no es seguro. "Ayudó" significa que mejoró más de lo habitual para esta persona.
 *
 * Se celebra haber terminado la prueba, **no** que haya ayudado: en el cuarto del lugar la onda se
 * calma, el objeto que da la prueba entra (si no estaba) y suena lo mismo, sea cual sea la
 * respuesta. Premiar solo "ayudó" empujaría a contestarlo y estropearía lo que aprende la app
 * (notas de retención, regla 1). Sin lugar o sin cuarto, es la escena 2D de "Tu escritorio".
 */
export default function CheckoutResult() {
  const t = useT();
  const locale = useLocale();
  const labels = useLabels();
  const level = useMotionLevel();
  const feedback = useFeedback();
  const desk = useDesk();
  const { settings, update } = useSettings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = queryClient.getQueryData<SavedOutcome>(outcomeKey(id));
  const place = data?.checkin.space ?? null;
  const room = usePlaceRoom(place);
  const arrived = room.scene === 'room' ? visibleArrival(data?.room, room) : null;
  const entering = arrived?.uid ?? null;
  // Se ofrece una sola vez, al final de una prueba (el momento en que tiene sentido).
  const [offerRecap] = useState(() => settings.recapDay === 'off' && !settings.recapOffered);

  // Un solo sonido, el mismo para cualquier resultado: cuando la onda queda tranquila y, si entró
  // un objeto, cuando toca el piso.
  const settled = useSceneCue(data ? room.scene : 'wait', SETTLED_MS, feedback.result);

  function answerRecap(choose: boolean) {
    update({ recapOffered: true });
    if (choose) {
      router.dismissTo('/today');
      router.navigate('/settings');
    }
  }

  if (!data) return null;

  const { checkin, here, newItem } = data;
  const before = checkin.discomfort_before ?? checkin.effort_before;
  const after = checkin.discomfort_after ?? checkin.effort_after ?? before;
  const isComparison = checkin.adjustment?.kind === 'baseline';

  const change = isInner(checkin.focus_stimulus) ? t.checkout.changeEffort(before, after) : t.checkout.change(before, after);

  let title: string;
  const lines: string[] = [];
  if (isComparison) {
    title = t.checkout.comparisonResult;
    lines.push(change, t.checkout.comparisonBody);
  } else if (checkin.outcome === 'helped') {
    title = t.checkout.helpedResult;
    lines.push(
      change,
      t.checkout.helpedBody,
      t.checkout.savedTo(labels.task(checkin.task), checkin.space?.name),
    );
  } else if (checkin.outcome === 'not_helped') {
    title = t.checkout.notHelpedResult;
    lines.push(change, t.checkout.notHelpedBody);
  } else {
    title = t.checkout.unclearResult;
    lines.push(
      change,
      after < before ? t.checkout.unclearBetterBody : t.checkout.unclearBody,
    );
  }
  const evidence = isComparison ? null : t.checkout.evidence(here.helped, here.trials);
  if (evidence) lines.push(evidence);
  lines.push(t.desk.learned);

  // En la escena 2D, el objeto nuevo va aparte (`highlight`) para que llegue con su animación.
  const items = desk.items.filter((item) => item !== newItem);

  return (
    <StepScreen
      title={title}
      footer={<Button title={t.common.backToToday} onPress={() => router.dismissTo('/today')} />}>
      <Animated.View entering={contentEntering(level)} style={styles.body}>
        {lines.map((line) => (
          <ThemedText key={line}>{line}</ThemedText>
        ))}
      </Animated.View>
      {room.scene === 'room' && room.layout && place ? (
        <View style={styles.desk}>
          {arrived ? <NewChip text={t.checkout.nowIn(place.name)} item={typeLabel(arrived.type, locale)} /> : null}
          <RoomView
            layout={room.layout}
            modifiers={room.modifiers}
            entering={entering}
            settle
            onSettled={settled}
            accessibilityLabel={room.label}
          />
        </View>
      ) : room.scene === 'desk' ? (
        <View style={styles.desk}>
          {newItem ? <NewChip text={t.desk.newItem} item={t.desk.items[newItem]} /> : null}
          <DeskScene
            items={items}
            highlight={newItem}
            settle
            accessibilityLabel={t.desk.label([...items, ...(newItem ? [newItem] : [])].map((item) => t.desk.items[item]))}
          />
        </View>
      ) : null}
      {offerRecap ? (
        <Group title={t.checkout.recapOfferTitle}>
          <GroupRow first>
            <ThemedText type="callout">{t.checkout.recapOfferBody}</ThemedText>
            <Button variant="secondary" title={t.checkout.recapOfferYes} onPress={() => answerRecap(true)} />
            <Button variant="plain" title={t.checkout.recapOfferNo} onPress={() => answerRecap(false)} />
          </GroupRow>
        </Group>
      ) : null}
    </StepScreen>
  );
}

/** Lo que llegó, en una línea: con ícono y negritas, no solo con color. */
function NewChip({ text, item }: { text: string; item: string }) {
  const theme = useTheme();
  const level = useMotionLevel();
  return (
    <Animated.View
      entering={contentEntering(level)}
      style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}
      accessible
      accessibilityLabel={`${text}: ${item}`}>
      <SymbolView name="sparkles" size={16} tintColor={theme.primary} accessibilityElementsHidden />
      <ThemedText type="footnote">
        {text}: <ThemedText type="footnote" style={styles.strong}>{item}</ThemedText>
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
  desk: {
    gap: Spacing.three,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: Radius.lg,
  },
  strong: {
    fontWeight: '600',
  },
});
