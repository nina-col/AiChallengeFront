import { router, useLocalSearchParams } from 'expo-router';

import { Notice } from '@/components/notice';
import { ScaleQuestion } from '@/components/scale-question';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { useCheckin } from '@/lib/queries';

/** La misma pregunta del inicio, para comparar: ¿cuánto molestó el entorno? */
export default function CheckoutDiscomfort() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const checkin = useCheckin(id);

  return (
    <StepScreen title={t.checkout.discomfortTitle} hint={checkin.data?.adjustment?.title}>
      <ScaleQuestion
        onChange={(discomfort) =>
          router.push({ pathname: '/checkout/[id]/effort', params: { id, discomfort: String(discomfort) } })
        }
      />
      {checkin.isError ? <Notice text={t.common.offline} action={t.common.retry} onAction={checkin.refetch} /> : null}
    </StepScreen>
  );
}
