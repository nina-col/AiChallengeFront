import { router } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { Notice } from '@/components/notice';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { useT } from '@/i18n';

export default function Orient() {
  const t = useT();
  const [answer, setAnswer] = useState<string>();
  return (
    <StepScreen title={t.pathway.orientTitle} hint={t.pathway.orientHint} footer={answer ? <>
      <Button title={answer === 'yes' ? t.pathway.internal : t.pathway.sensory} onPress={() => router.push(answer === 'yes' ? '/checkin/internal' : '/checkin/areas')} />
      <Button variant="secondary" title={answer === 'yes' ? t.pathway.sensory : t.pathway.internal} onPress={() => router.push(answer === 'yes' ? '/checkin/areas' : '/checkin/internal')} />
      <Button variant="plain" title={t.pathway.zenLink} onPress={() => router.push('/zen')} />
    </> : undefined}>
      <ChoiceList options={[{ id: 'yes', label: t.pathway.yes }, { id: 'no', label: t.pathway.no }, { id: 'unsure', label: t.pathway.notSure }]} selected={answer ? [answer] : []} onSelect={setAnswer} />
      {answer ? <Notice text={answer === 'yes' ? t.pathway.orientYes : answer === 'no' ? t.pathway.orientNo : t.pathway.orientUnsure} /> : null}
      <ThemedText type="footnote" themeColor="textSecondary">{t.pathway.orientNote}</ThemedText>
    </StepScreen>
  );
}
