import { SaveFeedback } from '@/components/save-feedback';
import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useUxCopy } from '@/lib/ux-copy';
import { Button } from '@/components/button';
import { ScaleQuestion } from '@/components/scale-question';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { Notice } from '@/components/notice';
import { toNewCheckin, useCheckinDraft } from '@/lib/checkin-draft';
import { useCheckinSteps, useSubmitCheckin } from '@/lib/checkin-steps';

/** Medida principal: cuánto molesta el entorno (se repite al terminar para comparar). */
export default function Discomfort() {
  const t = useT();
  const copy = useUxCopy();
  const steps = useCheckinSteps();
  const submit = useSubmitCheckin();
  function next() { if (!steps.goAfter('discomfort')) submit.mutate(toNewCheckin(draft, draft.repeat?.stimulus ?? null)); }
  const { draft, update } = useCheckinDraft();

  return (
    <StepScreen
      step={steps.progress('discomfort')}
      title={copy.measures}
      hint={t.checkin.scaleHint}
      footer={<Button title={t.common.next} disabled={draft.discomfort === undefined || draft.effort === undefined} loading={submit.isPending} onPress={next} />}>
      <ThemedText type="headline">{copy.discomfort}</ThemedText>
      <ScaleQuestion
        value={draft.discomfort}
        onChange={(discomfort) => {
          update({ discomfort });
        }}
      />
      <View style={{ gap: 12, marginTop: 16 }}><ThemedText type="headline">{copy.effort}</ThemedText><ScaleQuestion value={draft.effort} onChange={(effort) => update({ effort })} /></View>
      {submit.isError ? <Notice text={t.common.somethingFailed} /> : null}
      {submit.isPending ? <SaveFeedback pending /> : null}
    </StepScreen>
  );
}
