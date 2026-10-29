import { QueryFeedback } from '@/components/query-feedback';
import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { useCheckinDraft } from '@/lib/checkin-draft';
import { useCheckinSteps } from '@/lib/checkin-steps';
import { useCatalog } from '@/lib/queries';

export default function Feeling() {
  const t = useT();
  const catalog = useCatalog();
  const steps = useCheckinSteps();
  const { draft, update } = useCheckinDraft();

  return (
    <StepScreen step={steps.progress('feeling')} title={t.checkin.feelingTitle}
      footer={<Button title={t.common.next} disabled={!draft.feeling || !steps.ready} onPress={() => {
        if (steps.onlySpaceId) update({ spaceId: steps.onlySpaceId });
        steps.goAfter('feeling');
      }} />}>
      <QueryFeedback query={catalog} />
      <QueryFeedback query={steps.spaces} />
      <ChoiceList
        options={catalog.data?.feelings ?? []}
        selected={draft.feeling ? [draft.feeling] : []}
        onSelect={(feeling) => {
          // Con un solo lugar no se pregunta: se usa ese.
          update({ feeling, ...(steps.onlySpaceId ? { spaceId: steps.onlySpaceId } : {}) });
        }}
      />
    </StepScreen>
  );
}
