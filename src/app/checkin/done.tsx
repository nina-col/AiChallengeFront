import { router } from 'expo-router';
import { useEffect } from 'react';

import { Button } from '@/components/button';
import { DeskScene, SETTLED_MS } from '@/components/desk/desk-scene';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { ThemedText } from '@/components/themed-text';
import { useCheckinDraft } from '@/lib/checkin-draft';
import { useDesk } from '@/lib/desk';
import { useFeedback } from '@/lib/feedback';
import { useLabels } from '@/lib/queries';

/**
 * Al aceptar un ajuste, la onda del monitor se calma: el entorno que se acomoda. El sonido y la
 * vibración de confirmar llegan en el cuadro en que la onda queda tranquila.
 *
 * El plan "la próxima vez que toque X aquí, haz Y" es una intención de implementación: decir
 * cuándo y dónde se hará algo ayuda a hacerlo (Sheeran et al., 2024). No lleva hora fija.
 */
export default function Done() {
  const t = useT();
  const desk = useDesk();
  const labels = useLabels();
  const feedback = useFeedback();
  const { draft } = useCheckinDraft();
  const checkin = draft.result?.checkin;
  const adjustment = draft.result?.proposal?.adjustment;
  const plan =
    checkin && adjustment && adjustment.kind === 'self' ? t.reminder.plan(labels.task(checkin.task), adjustment.title) : null;

  useEffect(() => {
    const timer = setTimeout(feedback.confirm, SETTLED_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al llegar a la pantalla
  }, []);
  return (
    <StepScreen
      title={t.reminder.doneTitle}
      hint={t.reminder.doneBody}
      footer={<Button title={t.common.backToToday} onPress={() => router.dismissTo('/today')} />}>
      {plan ? <ThemedText>{plan}</ThemedText> : null}
      <DeskScene
        items={desk.items}
        settle
        accessibilityLabel={t.desk.label(desk.items.map((item) => t.desk.items[item]))}
      />
    </StepScreen>
  );
}
