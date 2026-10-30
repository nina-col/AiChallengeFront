import { router } from 'expo-router';

import { Button } from '@/components/button';
import { DeskScene, SETTLED_MS } from '@/components/desk/desk-scene';
import { RoomView } from '@/components/room/room-view';
import { StepScreen } from '@/components/step-screen';
import { useT } from '@/i18n';
import { ThemedText } from '@/components/themed-text';
import { useCheckinDraft } from '@/lib/checkin-draft';
import { useDesk } from '@/lib/desk';
import { useFeedback } from '@/lib/feedback';
import { useLabels } from '@/lib/queries';
import { usePlaceRoom, useSceneCue } from '@/lib/room';

/**
 * Al aceptar un ajuste, la onda del monitor se calma en el cuarto de ese lugar (o en la escena 2D,
 * si no hay lugar): el entorno que se acomoda. El sonido y la vibración de confirmar llegan en el
 * cuadro en que la onda queda tranquila.
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
  const room = usePlaceRoom(checkin?.space ?? null);
  const plan =
    checkin && adjustment && adjustment.kind === 'self' ? t.reminder.plan(labels.task(checkin.task), adjustment.title) : null;

  const settled = useSceneCue(room.scene, SETTLED_MS, feedback.confirm);

  return (
    <StepScreen
      title={t.reminder.doneTitle}
      hint={t.reminder.doneBody}
      footer={<Button title={t.common.backToToday} onPress={() => router.dismissTo('/today')} />}>
      {plan ? <ThemedText>{plan}</ThemedText> : null}
      {room.scene === 'room' && room.layout ? (
        <RoomView layout={room.layout} modifiers={room.modifiers} settle onSettled={settled} accessibilityLabel={room.label} />
      ) : room.scene === 'desk' ? (
        <DeskScene
          items={desk.items}
          settle
          accessibilityLabel={t.desk.label(desk.items.map((item) => t.desk.items[item]))}
        />
      ) : null}
    </StepScreen>
  );
}
