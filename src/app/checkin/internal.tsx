import { router } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { Notice } from '@/components/notice';
import { StepScreen } from '@/components/step-screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useT } from '@/i18n';
import { useCheckinDraft } from '@/lib/checkin-draft';
import type { IconName } from '@/components/pixel-icons';

type Need = 'body' | 'focus' | 'start' | 'organize' | 'relax';
const faces: IconName[] = ['face_calm', 'face_worried', 'face_tired', 'face_overloaded', 'face_thinking', 'face_neutral'];
/** Estas tres se prueban y se aprende de ellas; lo que ya se sabe de la tarea va marcado. */
const LEARNS: Partial<Record<Need, string[]>> = { start: ['hard_to_start'], organize: ['too_many_tasks'], focus: [] };

export default function Internal() {
  const t = useT();
  const { update } = useCheckinDraft();
  const [need, setNeed] = useState<Need>();
  const [feeling, setFeeling] = useState<string>();
  const [body, setBody] = useState<string[]>([]);
  const [plan, setPlan] = useState(false);
  const [action, setAction] = useState('');
  const learns = need ? LEARNS[need] : undefined;
  function startLearning(known: string[]) {
    update({
      route: 'inner',
      selectedDomains: undefined,
      feeling: 'focus',
      discomfort: undefined,
      answers: Object.fromEntries(known.map((id) => [id, 'yes' as const])),
      sources: {},
      focus: undefined,
    });
    router.push('/checkin/task');
  }
  const plans = { body: t.pathway.bodyPlan, focus: t.pathway.focusPlan, start: t.pathway.startPlan, organize: t.pathway.organizePlan, relax: t.pathway.relaxPlan };
  function toggleBody(id: string) {
    setBody((old) => id === 'unsure' ? (old.includes('unsure') ? [] : ['unsure']) : old.includes(id) ? old.filter((v) => v !== id) : [...old.filter((v) => v !== 'unsure'), id]);
  }
  return (
    <StepScreen art={plan ? undefined : 'mind'} title={plan ? t.pathway.planTitle : t.pathway.internalTitle} hint={need && !learns ? t.pathway.internalIntro : undefined} footer={plan ? <>
      <Button title={t.pathway.zenLink} onPress={() => router.push('/zen')} />
      <Button title={t.pathway.finish} variant="secondary" onPress={() => router.dismissTo('/today')} />
      <Button title={t.pathway.change} variant="plain" onPress={() => setPlan(false)} />
    </> : <Button title={learns ? t.common.next : t.pathway.plan} disabled={!need} onPress={() => (learns ? startLearning(learns) : setPlan(true))} />}>
      {!plan ? <>
        <ChoiceList options={[
          { id: 'body', label: t.pathway.bodyNeed, art: 'charged' }, { id: 'focus', label: t.pathway.focusNeed, art: 'focus' },
          { id: 'start', label: t.pathway.startNeed, art: 'start' }, { id: 'organize', label: t.pathway.organizeNeed, art: 'organize' }, { id: 'relax', label: t.pathway.relaxNeed, art: 'zen' },
        ]} selected={need ? [need] : []} onSelect={(id) => setNeed(id as Need)} />
        {!need ? null : learns ? <ThemedText type="footnote" themeColor="textSecondary">{t.pathway.innerPrivacy}</ThemedText> : <>
          <ThemedText type="headline">{t.pathway.feelingTitle}</ThemedText>
          <ChoiceList options={t.pathway.feelings.map((label, i) => ({ id: String(i), label, art: faces[i] }))} selected={feeling ? [feeling] : []} onSelect={setFeeling} />
          <ThemedText type="footnote" themeColor="textSecondary">{t.pathway.feelingLocal}</ThemedText>
        </>}
        {need === 'body' ? <>
          <ThemedText type="headline">{t.pathway.bodyTitle}</ThemedText>
          <ThemedText themeColor="textSecondary">{t.pathway.bodyHint}</ThemedText>
          <ChoiceList multiple options={[{ id: 'energy', label: t.pathway.energy }, { id: 'basics', label: t.pathway.basics }, { id: 'tension', label: t.pathway.tension }, { id: 'unsure', label: t.pathway.bodyUnsure }]} selected={body} onSelect={toggleBody} />
        </> : null}
      </> : <>
        <Notice text={plans[need!]} />
        {need === 'body' && body.length ? <ThemedText themeColor="textSecondary">{body.filter((id) => id !== 'unsure').map((id) => ({ energy: t.pathway.energy, basics: t.pathway.basics, tension: t.pathway.tension })[id]).filter(Boolean).join(' · ')}</ThemedText> : null}
        <TextField label={t.pathway.actionLabel} placeholder={t.pathway.actionPlaceholder} value={action} onChangeText={setAction} maxLength={240} multiline />
      </>}
    </StepScreen>
  );
}
