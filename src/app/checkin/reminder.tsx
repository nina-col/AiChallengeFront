import { useState } from 'react';
import { Button } from '@/components/button';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';

import { ChoiceList } from '@/components/choice-list';
import { Notice } from '@/components/notice';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { useCheckinDraft } from '@/lib/checkin-draft';
import { scheduleCheckout } from '@/lib/notifications';
import { keys, queryClient } from '@/lib/queries';

/** La persona decide cuándo le preguntamos: un aviso a 25 o 50 minutos, o ninguno. */
export default function Reminder() {
  const t = useT();
  const [selected, setSelected] = useState<string>();
  const { draft } = useCheckinDraft();
  const checkin = draft.result?.checkin;

  const accept = useMutation({
    mutationFn: async (minutes: number | null) => {
      const accepted = await api.accept(checkin!.id, minutes);
      if (minutes) {
        await scheduleCheckout(
          checkin!.id,
          minutes,
          t.reminder.notificationTitle,
          t.reminder.notificationBody,
        ).catch(() => false);
      }
      return accepted;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trying });
      router.push('/checkin/done');
    },
  });

  const options = [
    { id: '25', label: t.reminder.in25 },
    { id: '50', label: t.reminder.in50 },
    { id: 'none', label: t.reminder.myself },
  ];

  return (
    <StepScreen step={{ number: 2, total: 2, label: t.checkin.choosePhase }} title={t.reminder.title} hint={t.reminder.hint}
      footer={<Button title={t.proposal.accept} disabled={!selected} loading={accept.isPending} onPress={() => selected && accept.mutate(selected === 'none' ? null : Number(selected))} />}>
      <ChoiceList
        options={options}
        selected={selected ? [selected] : []}
        disabled={accept.isPending}
        onSelect={setSelected}
      />
      {accept.isError ? <Notice text={t.common.somethingFailed} /> : null}
    </StepScreen>
  );
}
