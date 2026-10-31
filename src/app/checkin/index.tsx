import { router } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { useT } from '@/i18n';
import type { EntryChoice } from '@/lib/checkin-route';

export default function CheckinEntry() {
  const t = useT();
  const [choice, setChoice] = useState<EntryChoice>();
  function next() {
    if (choice === 'sensory') router.push('/checkin/areas');
    else if (choice === 'internal') router.push('/checkin/internal');
    else if (choice === 'unsure') router.push('/checkin/orient');
  }
  return (
    <StepScreen title={t.pathway.title} hint={t.pathway.hint} footer={
      <><Button title={t.common.next} disabled={!choice} onPress={next} />
      <Button variant="plain" title={t.pathway.zenLink} onPress={() => router.push('/zen')} /></>
    }>
      <ChoiceList options={[
        { id: 'sensory', label: t.pathway.sensory, hint: t.pathway.sensoryHint, art: 'sensory' },
        { id: 'internal', label: t.pathway.internal, hint: t.pathway.internalHint, art: 'mind' },
        { id: 'unsure', label: t.pathway.unsure, hint: t.pathway.unsureHint, art: 'unsure' },
      ]} selected={choice ? [choice] : []} onSelect={(id) => setChoice(id as EntryChoice)} />
      <ThemedText type="footnote" themeColor="textSecondary">{t.pathway.timeNote}</ThemedText>
    </StepScreen>
  );
}
