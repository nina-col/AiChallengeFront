import { ScaleQuestion } from '@/components/scale-question';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { useCheckinDraft } from '@/lib/checkin-draft';
import { useCheckinSteps } from '@/lib/checkin-steps';

/** Medida principal: cuánto molesta el entorno (se repite al terminar para comparar). */
export default function Discomfort() {
  const t = useT();
  const steps = useCheckinSteps();
  const { draft, update } = useCheckinDraft();

  return (
    <StepScreen
      step={steps.progress('discomfort')}
      title={t.checkin.discomfortTitle}
      hint={t.checkin.scaleHint}>
      <ScaleQuestion
        value={draft.discomfort}
        onChange={(discomfort) => {
          update({ discomfort });
          steps.goAfter('discomfort');
        }}
      />
    </StepScreen>
  );
}
