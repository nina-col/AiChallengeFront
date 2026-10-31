import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { QueryFeedback } from '@/components/query-feedback';
import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { Notice } from '@/components/notice';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { affecting, toNewCheckin, useCheckinDraft } from '@/lib/checkin-draft';
import { useCheckinSteps, useSubmitCheckin } from '@/lib/checkin-steps';
import { DOMAIN_ART, STIMULUS_ART } from '@/lib/art';
import { INNER_DOMAIN } from '@/lib/checkin-route';
import { useCatalog } from '@/lib/queries';
import type { Response } from '@/lib/types';

const NONE = '__none';
const UNSURE = '__unsure';

/** Una pantalla por dominio (sonido, luz, lo que ves, el cuerpo), con "Nada de esto" y "No sé". */
export default function DomainStep() {
  const t = useT();
  const { domain: domainId } = useLocalSearchParams<{ domain: string }>();
  const catalog = useCatalog();
  const steps = useCheckinSteps();
  const submit = useSubmitCheckin();
  const { draft, update } = useCheckinDraft();
  const domain = catalog.data?.domains.find((d) => d.id === domainId);
  const stimuli = domain?.stimuli ?? [];

  const [choice, setChoice] = useState<string[]>(() => {
    const previous = stimuli.map((s) => draft.answers[s.id]);
    if (previous.length && previous.every((r) => r === 'unsure')) return [UNSURE];
    if (previous.length && previous.every((r) => r === 'no')) return [NONE];
    return stimuli.filter((s) => draft.answers[s.id] === 'yes').map((s) => s.id);
  });

  function toggle(id: string) {
    if (id === NONE || id === UNSURE) {
      setChoice((current) => (current.includes(id) ? [] : [id]));
      return;
    }
    setChoice((current) => {
      const withoutSpecial = current.filter((c) => c !== NONE && c !== UNSURE);
      return withoutSpecial.includes(id) ? withoutSpecial.filter((c) => c !== id) : [...withoutSpecial, id];
    });
  }

  function next() {
    const answers: Record<string, Response> = { ...draft.answers };
    for (const s of stimuli) {
      answers[s.id] = choice.includes(UNSURE) ? 'unsure' : choice.includes(s.id) ? 'yes' : 'no';
    }
    // Lo cognitivo no pasa por la pregunta de cómo te sientes, que es donde se fija el único lugar.
    const spaceId = draft.spaceId ?? steps.onlySpaceId ?? null;
    update({ answers, spaceId });
    if (steps.goAfter(domainId)) return;

    // Último dominio: si hay varias cosas, la persona elige una; si no, se registra ya.
    const merged = { ...draft, answers, spaceId };
    const marked = affecting(merged);
    if (marked.length > 1) router.push('/checkin/focus');
    else submit.mutate(toNewCheckin(merged, marked[0] ?? null));
  }

  const options = [
    ...stimuli.map((s) => ({ ...s, art: STIMULUS_ART[s.id] })),
    ...(domainId === INNER_DOMAIN ? [] : [{ id: NONE, label: t.checkin.noneOfThese }]),
    { id: UNSURE, label: t.checkin.notSure, art: domainId === INNER_DOMAIN ? ('unsure' as const) : undefined },
  ];

  return (
    <StepScreen
      step={steps.progress(domainId)}
      art={DOMAIN_ART[domainId]}
      title={domain?.question ?? ''}
      hint={t.checkin.domainHint}
      footer={
        <Button
          title={t.common.next}
          disabled={choice.length === 0 || !domain}
          loading={submit.isPending}
          onPress={next}
        />
      }>
      <QueryFeedback query={catalog} />
      <ChoiceList disabled={submit.isPending} multiple options={options} selected={choice} onSelect={toggle} />
      {submit.isError ? <Notice text={t.common.somethingFailed} action={t.common.retry} onAction={next} /> : null}
    </StepScreen>
  );
}
