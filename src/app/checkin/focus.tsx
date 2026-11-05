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
    submit.mutate(toNewCheckin(draft, focus));
  }

  return (
    <StepScreen title={t.checkin.focusTitle} hint={t.checkin.focusHint}>
      <ChoiceList options={options} selected={draft.focus ? [draft.focus] : []} onSelect={choose} />
      {submit.isError ? (
        <Notice
          text={t.common.somethingFailed}
          action={t.common.retry}
          onAction={() => draft.focus && choose(draft.focus)}
        />
      ) : null}
    </StepScreen>
  );
}
