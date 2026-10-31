import { QueryFeedback } from '@/components/query-feedback';
import { useState } from 'react';

import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { TASK_ART } from '@/lib/art';
import { useCheckinDraft } from '@/lib/checkin-draft';
import { useCheckinSteps } from '@/lib/checkin-steps';
import { useCatalog } from '@/lib/queries';

/** Cinco tareas a la vista (COGA: ≤ 5 opciones principales); el resto, a un toque. */
const VISIBLE = 5;

export default function Task() {
  const t = useT();
  const catalog = useCatalog();
  const steps = useCheckinSteps();
  const { draft, update } = useCheckinDraft();
  const [showAll, setShowAll] = useState(false);

  const tasks = catalog.data?.tasks ?? [];
  const visible = showAll ? tasks : tasks.slice(0, VISIBLE);

  return (
    <StepScreen step={steps.progress('task')} title={t.checkin.taskTitle}
      footer={<Button title={t.common.next} disabled={!draft.task} onPress={() => steps.goAfter('task')} />}>
      <QueryFeedback query={catalog} />
      <ChoiceList
        options={visible.map((task) => ({ ...task, art: TASK_ART[task.id] }))}
        selected={draft.task ? [draft.task] : []}
        onSelect={(task) => {
          update({ task });
        }}
      />
      {!showAll && tasks.length > VISIBLE ? (
        <Button variant="plain" title={t.checkin.moreTasks} onPress={() => setShowAll(true)} />
      ) : null}
    </StepScreen>
  );
}
