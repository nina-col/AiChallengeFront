import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { ScaleQuestion } from '@/components/scale-question';
import { SaveFeedback } from '@/components/save-feedback';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { useT } from '@/i18n';
import { isInner } from '@/lib/checkin-route';
import { useSaveOutcome } from '@/lib/checkout';
import { useCheckin } from '@/lib/queries';

/** Both before/after measures stay intact; one navigation replaces two screens. */
export default function CheckoutMeasures() {
  const t = useT();
  const [discomfort, setDiscomfort] = useState<number>();
  const [effort, setEffort] = useState<number>();
  const { id } = useLocalSearchParams<{ id: string }>();
  const checkin = useCheckin(id);
  const save = useSaveOutcome(id);
  const inner = isInner(checkin.data?.focus_stimulus);
  const ready = !!checkin.data && effort !== undefined && (inner || discomfort !== undefined);

  function next() {
    if (!ready || effort === undefined) return;
    const answers = { discomfort: inner ? effort : discomfort!, effort };
    if (checkin.data?.adjustment?.kind === 'baseline') save.mutate({ ...answers, attribution: 'unsure' });
    else router.push({ pathname: '/checkout/[id]/helped', params: { id, discomfort: String(answers.discomfort), effort: String(effort) } });
  }

  return <StepScreen title={inner ? t.checkout.effortTitle : t.checkout.discomfortTitle} hint={checkin.data?.adjustment?.title}
    footer={<Button title={t.common.next} disabled={!ready} loading={save.isPending} onPress={next} />}>
    {!inner ? <ScaleQuestion disabled={save.isPending} value={discomfort} onChange={setDiscomfort} /> : null}
    <View style={{ gap: 12, marginTop: inner ? 0 : 20 }}>
      {!inner ? <ThemedText type="headline">{t.checkout.effortTitle}</ThemedText> : null}
      <ScaleQuestion disabled={save.isPending} value={effort} onChange={setEffort} />
    </View>
    {save.isPending ? <SaveFeedback pending /> : null}
    {checkin.isError ? <Notice text={t.common.offline} action={t.common.retry} onAction={checkin.refetch} /> : null}
    {save.isError ? <Notice text={t.common.somethingFailed} /> : null}
  </StepScreen>;
}
