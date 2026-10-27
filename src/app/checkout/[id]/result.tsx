import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/button';
import { DeskScene, SETTLED_MS } from '@/components/desk/desk-scene';
import { Group, GroupRow } from '@/components/group';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { contentEntering } from '@/lib/animations';
import { outcomeKey, type SavedOutcome } from '@/lib/checkout';
import { useDesk } from '@/lib/desk';
import { useFeedback, useMotionLevel } from '@/lib/feedback';
import { queryClient, useLabels } from '@/lib/queries';
import { useSettings } from '@/lib/settings';

/**
 * El resultado, dicho con honestidad (al estilo de Self-E): cuántas veces se probó y si todavía
 * no es seguro. "Ayudó" significa que mejoró más de lo habitual para esta persona.
 *
 * Se celebra haber terminado la prueba, **no** que haya ayudado: la onda se calma, suena lo mismo
 * y, si es la primera vez con ese tema, su objeto llega al escritorio. Premiar solo "ayudó"
 * empujaría a contestarlo y estropearía lo que aprende la app (notas de retención, regla 1).
 */
export default function CheckoutResult() {
  const t = useT();
  const theme = useTheme();
  const labels = useLabels();
  const level = useMotionLevel();
  const feedback = useFeedback();
  const desk = useDesk();
  const { settings, update } = useSettings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = queryClient.getQueryData<SavedOutcome>(outcomeKey(id));
  // Se ofrece una sola vez, al final de una prueba (el momento en que tiene sentido).
  const [offerRecap] = useState(() => settings.recapDay === 'off' && !settings.recapOffered);

  // Un solo sonido, el mismo para cualquier resultado, cuando la onda queda tranquila.
  useEffect(() => {
    const timer = setTimeout(feedback.result, SETTLED_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al llegar a la pantalla
  }, []);

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

  let title: string;
  const lines: string[] = [];
  if (isComparison) {
    title = t.checkout.comparisonResult;
    lines.push(t.checkout.change(before, after), t.checkout.comparisonBody);
  } else if (checkin.outcome === 'helped') {
    title = t.checkout.helpedResult;
    lines.push(
      t.checkout.change(before, after),
      t.checkout.helpedBody,
      t.checkout.savedTo(labels.task(checkin.task), checkin.space?.name),
    );
  } else if (checkin.outcome === 'not_helped') {
    title = t.checkout.notHelpedResult;
    lines.push(t.checkout.change(before, after), t.checkout.notHelpedBody);
  } else {
    title = t.checkout.unclearResult;
    lines.push(
      t.checkout.change(before, after),
      after < before ? t.checkout.unclearBetterBody : t.checkout.unclearBody,
    );
  }
  const evidence = isComparison ? null : t.checkout.evidence(here.helped, here.trials);
  if (evidence) lines.push(evidence);
  lines.push(t.desk.learned);

  // El objeto nuevo todavía no está en la lista (se está recargando): se suma aquí.
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
      <View style={styles.desk}>
        {newItem ? (
          <Animated.View
            entering={contentEntering(level)}
            style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}
            accessible
            accessibilityLabel={`${t.desk.newItem}: ${t.desk.items[newItem]}`}>
            <SymbolView name="sparkles" size={16} tintColor={theme.primary} accessibilityElementsHidden />
            <ThemedText type="footnote">
              {t.desk.newItem}: <ThemedText type="footnote" style={styles.strong}>{t.desk.items[newItem]}</ThemedText>
            </ThemedText>
          </Animated.View>
        ) : null}
        <DeskScene
          items={items}
          highlight={newItem}
          settle
          accessibilityLabel={t.desk.label([...items, ...(newItem ? [newItem] : [])].map((item) => t.desk.items[item]))}
        />
      </View>
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
