import { router } from 'expo-router';
import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { DOMAIN_IDS } from '@/lib/checkin-route';
import { useCheckinDraft } from '@/lib/checkin-draft';

export default function Areas() {
  const t = useT();
  const { draft, update } = useCheckinDraft();
  const selected = draft.selectedDomains ?? [];
  const labels = { sound: t.pathway.sound, light: t.pathway.light, sight: t.pathway.sight, body: t.pathway.body };
  function select(id: string) {
    // Reset answers from areas that will no longer be asked, including scan suggestions.
    update({ selectedDomains: selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id], answers: {}, sources: {}, focus: undefined });
  }
  return (
    <StepScreen title={t.pathway.areasTitle} hint={t.pathway.areasHint} footer={
      <Button title={t.common.next} disabled={!selected.length} onPress={() => router.push('/checkin/task')} />
    }>
      <ChoiceList multiple options={DOMAIN_IDS.map((id) => ({ id, label: labels[id] }))} selected={selected} onSelect={select} />
      <Button title={t.pathway.all} variant="plain" onPress={() => update({ selectedDomains: [...DOMAIN_IDS], answers: {}, sources: {}, focus: undefined })} />
    </StepScreen>
  );
}
