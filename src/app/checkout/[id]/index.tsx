import { useState } from 'react';
import { Button } from '@/components/button';
import { router, useLocalSearchParams } from 'expo-router';

import { Notice } from '@/components/notice';
import { ScaleQuestion } from '@/components/scale-question';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { isInner } from '@/lib/checkin-route';
import { useCheckin } from '@/lib/queries';

/**
 * La misma pregunta del inicio, para comparar: ¿cuánto molestó el entorno? En lo cognitivo no se
 * preguntó por el entorno: la medida es el esfuerzo, y de aquí se va directo a "¿ayudó?".
 */
export default function CheckoutDiscomfort() {
  const t = useT();
  const [selected, setSelected] = useState<number>();
  const { id } = useLocalSearchParams<{ id: string }>();
  const checkin = useCheckin(id);
  const inner = isInner(checkin.data?.focus_stimulus);

  function next() {
    if (inner) router.push({ pathname: '/checkout/[id]/helped', params: { id, discomfort: String(selected), effort: String(selected) } });
    else router.push({ pathname: '/checkout/[id]/effort', params: { id, discomfort: String(selected) } });
  }

  return (
    <StepScreen title={inner ? t.checkout.effortTitle : t.checkout.discomfortTitle} hint={checkin.data?.adjustment?.title}
      footer={<Button title={t.common.next} disabled={selected === undefined || !checkin.data} onPress={next} />}>
      <ScaleQuestion
        value={selected}
        onChange={setSelected}
      />
      {checkin.isError ? <Notice text={t.common.offline} action={t.common.retry} onAction={checkin.refetch} /> : null}
    </StepScreen>
  );
}
