import { useState } from 'react';
import { Button } from '@/components/button';
import { router, useLocalSearchParams } from 'expo-router';

import { Notice } from '@/components/notice';
import { ScaleQuestion } from '@/components/scale-question';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { useSaveOutcome } from '@/lib/checkout';
import { useCheckin } from '@/lib/queries';

export default function CheckoutEffort() {
  const t = useT();
  const [selected, setSelected] = useState<number>();
  const { id, discomfort } = useLocalSearchParams<{ id: string; discomfort: string }>();
  const checkin = useCheckin(id);
  const save = useSaveOutcome(id);
  const isComparison = checkin.data?.adjustment?.kind === 'baseline';

  function next(effort: number) {
    // En la comparación sin ajuste no hay "¿ayudó?": no hubo ajuste que juzgar.
    if (isComparison) {
      save.mutate({ discomfort: Number(discomfort), effort, attribution: 'unsure' });
      return;
    }
    router.push({ pathname: '/checkout/[id]/helped', params: { id, discomfort, effort: String(effort) } });
  }

  return (
    <StepScreen title={t.checkout.effortTitle}
      footer={<Button title={t.common.next} disabled={selected === undefined || !checkin.data} loading={save.isPending} onPress={() => selected !== undefined && next(selected)} />}>
      <ScaleQuestion value={selected} onChange={setSelected} />
      {checkin.isError ? <Notice text={t.common.offline} action={t.common.retry} onAction={checkin.refetch} /> : null}
      {save.isError ? <Notice text={t.common.somethingFailed} /> : null}
    </StepScreen>
  );
}
