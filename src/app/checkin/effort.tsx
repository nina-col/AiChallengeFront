import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { ScaleQuestion } from '@/components/scale-question';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { toNewCheckin, useCheckinDraft } from '@/lib/checkin-draft';
import { useCheckinSteps, useSubmitCheckin } from '@/lib/checkin-steps';

/** Medida secundaria: esfuerzo de la tarea. En "Usarlo otra vez" es el último paso: registra. */
export default function Effort() {
  const t = useT();
  const steps = useCheckinSteps();
  const submit = useSubmitCheckin();
  const { draft, update } = useCheckinDraft();

  function next() {
    if (steps.goAfter('effort')) return;
    submit.mutate(toNewCheckin(draft, draft.repeat?.stimulus ?? null));
  }

  return (
    <StepScreen step={steps.progress('effort')} title={t.checkin.effortTitle}
      footer={
        <Button
          title={draft.repeat ? t.checkin.seeSuggestion : t.common.next}
          disabled={!draft.effort}
          loading={submit.isPending}
          onPress={next}
        />
      }>
      <ScaleQuestion
        value={draft.effort}
        onChange={(effort) => {
          update({ effort });
        }}
      />
      {submit.isError ? <Notice text={t.common.somethingFailed} action={t.common.retry} onAction={next} /> : null}
    </StepScreen>
  );
}
