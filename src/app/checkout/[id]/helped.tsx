import { useLocalSearchParams } from 'expo-router';

import { ChoiceList } from '@/components/choice-list';
import { Notice } from '@/components/notice';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { useSaveOutcome } from '@/lib/checkout';
import type { Response } from '@/lib/types';

/** La opinión de la persona manda: si dice que no ayudó, no cuenta como éxito. */
export default function CheckoutHelped() {
  const t = useT();
  const { id, discomfort, effort } = useLocalSearchParams<{ id: string; discomfort: string; effort: string }>();
  const save = useSaveOutcome(id);

  const options = [
    { id: 'yes', label: t.checkout.yes },
    { id: 'no', label: t.checkout.no },
    { id: 'unsure', label: t.checkout.unsure },
  ];

  return (
    <StepScreen title={t.checkout.helpedTitle}>
      <ChoiceList
        options={options}
        selected={save.variables ? [save.variables.attribution] : []}
        onSelect={(attribution) =>
          !save.isPending &&
          save.mutate({ discomfort: Number(discomfort), effort: Number(effort), attribution: attribution as Response })
        }
      />
      {save.isError ? <Notice text={t.common.somethingFailed} /> : null}
    </StepScreen>
  );
}
