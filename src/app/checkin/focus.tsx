import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { Notice } from '@/components/notice';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { affecting, toNewCheckin, useCheckinDraft } from '@/lib/checkin-draft';
import { useSubmitCheckin } from '@/lib/checkin-steps';
import { useLabels } from '@/lib/queries';

/** Si marcó varias cosas, se empieza por una sola: la que más afecta ahora. */
export default function Focus() {
  const t = useT();
  const labels = useLabels();
  const submit = useSubmitCheckin();
  const { draft, update } = useCheckinDraft();
  const options = affecting(draft).map((id) => ({ id, label: labels.stimulus(id) }));

  function choose(focus: string) {
    update({ focus });

  }

  return (
    <StepScreen step={{ number: 2, total: 2, label: t.checkin.choosePhase }} title={t.checkin.focusTitle} hint={t.checkin.focusHint}
      footer={<Button title={t.checkin.seeSuggestion} disabled={!draft.focus} loading={submit.isPending} onPress={() => draft.focus && submit.mutate(toNewCheckin(draft, draft.focus))} />}>
      <ChoiceList options={options} selected={draft.focus ? [draft.focus] : []} disabled={submit.isPending} onSelect={choose} />
      {submit.isError ? (
        <Notice
          text={t.common.somethingFailed}
          action={t.common.retry}
          onAction={() => draft.focus && submit.mutate(toNewCheckin(draft, draft.focus))}
        />
      ) : null}
    </StepScreen>
  );
}
