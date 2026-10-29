import { Button } from '@/components/button';
import { ScaleQuestion } from '@/components/scale-question';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { useCheckinDraft } from '@/lib/checkin-draft';
import { useCheckinSteps } from '@/lib/checkin-steps';

/** Medida secundaria: esfuerzo de la tarea. */
export default function Effort() {
  const t = useT();
  const steps = useCheckinSteps();
  const { draft, update } = useCheckinDraft();

  return (
    <StepScreen step={steps.progress('effort')} title={t.checkin.effortTitle}
      footer={<Button title={t.common.next} disabled={!draft.effort} onPress={() => steps.goAfter('effort')} />}>
      <ScaleQuestion
        value={draft.effort}
        onChange={(effort) => {
          update({ effort });
        }}
      />
    </StepScreen>
  );
}
