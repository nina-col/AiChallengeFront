import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { PixelScene } from '@/components/pixel-scene';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useT } from '@/i18n';
import { outcomeKey } from '@/lib/checkout';
import { queryClient, useLabels } from '@/lib/queries';
import type { OutcomeResult } from '@/lib/types';

/**
 * El resultado, dicho con honestidad (al estilo de Self-E): cuántas veces se probó y si todavía
 * no es seguro. "Ayudó" significa que mejoró más de lo habitual para esta persona.
 */
export default function CheckoutResult() {
  const t = useT();
  const labels = useLabels();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = queryClient.getQueryData<OutcomeResult>(outcomeKey(id));
  if (!data) return null;

  const { checkin, here } = data;
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

  return (
    <StepScreen
      title={title}
      footer={<Button title={t.common.backToToday} onPress={() => router.dismissTo('/today')} />}>
      <View style={styles.body}>
        {lines.map((line) => (
          <ThemedText key={line}>{line}</ThemedText>
        ))}
      </View>
      <View style={styles.scene}>
        <PixelScene size={96} />
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
  scene: {
    alignItems: 'center',
    paddingTop: Spacing.three,
  },
});
