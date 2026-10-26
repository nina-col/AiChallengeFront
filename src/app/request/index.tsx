import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Share, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { StepScreen } from '@/components/step-screen';
import { TextField } from '@/components/text-field';
import { useLocale, useT } from '@/i18n';
import { useCatalog, useLabels } from '@/lib/queries';

type Params = {
  task: string;
  stimulus: string;
  place?: string;
  feeling?: string;
  /** Ajuste para pedir elegido en la sugerencia, si viene de ahí. */
  adjustment?: string;
  /** Ajuste propio que ya ayudó, si viene de "Lo que me sirve". */
  from?: string;
  helped?: string;
  trials?: string;
};

const REVIEW_DAYS = 14;

/**
 * Solicitud en cinco partes (tarea, barrera, efecto, ajuste con alternativas y fecha de revisión).
 * Sin diagnóstico. Los datos propios solo van si la persona lo elige. Nada se envía desde la app:
 * la persona copia o comparte el texto con quien decida.
 */
export default function Request() {
  const t = useT();
  const locale = useLocale();
  const labels = useLabels();
  const catalog = useCatalog();
  const params = useLocalSearchParams<Params>();
  const [includeData, setIncludeData] = useState(false);
  // La fecha de revisión se fija al abrir la pantalla, no en cada render.
  const [reviewAt] = useState(() => Date.now() + REVIEW_DAYS * 24 * 60 * 60 * 1000);

  const askOptions = (catalog.data?.adjustments ?? []).filter(
    (a) => a.kind === 'ask' && a.stimuli.includes(params.stimulus),
  );
  const main = askOptions.find((a) => a.id === params.adjustment) ?? askOptions[0];
  const alternatives = askOptions.filter((a) => a.id !== main?.id).slice(0, 2);
  const helpedBefore = catalog.data?.adjustments.find((a) => a.id === params.from);
  const helped = Number(params.helped ?? 0);
  const trials = Number(params.trials ?? 0);

  const reviewDate = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-MX', {
    day: 'numeric',
    month: 'long',
  }).format(new Date(reviewAt));

  const generated = useMemo(
    () =>
      main
        ? t.request.letter({
            task: labels.task(params.task),
            place: params.place || undefined,
            stimulus: labels.stimulus(params.stimulus),
            effect: t.request.effects[params.feeling ?? 'focus'] ?? t.request.effects.focus,
            adjustment: main.title,
            alternatives: alternatives.map((a) => a.title),
            reviewDate,
            data:
              includeData && helpedBefore && trials > 0
                ? t.request.dataLine(helpedBefore.title, helped, trials)
                : undefined,
          })
        : '',
    // Se regenera al cambiar la opción de incluir datos o el idioma; lo editado se conserva si no.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [includeData, locale, main?.id, catalog.data],
  );
  const [edited, setEdited] = useState<string | null>(null);
  const text = edited ?? generated;

  return (
    <StepScreen
      title={t.request.title}
      hint={t.request.hint}
      footer={<Button title={t.request.share} disabled={!text} onPress={() => Share.share({ message: text })} />}>
      {helpedBefore && trials > 0 ? (
        <ChoiceList
          multiple
          options={[{ id: 'data', label: t.request.includeData }]}
          selected={includeData ? ['data'] : []}
          onSelect={() => {
            setEdited(null);
            setIncludeData((value) => !value);
          }}
        />
      ) : null}
      <TextField
        label={t.request.title}
        multiline
        value={text}
        onChangeText={setEdited}
        style={styles.letter}
        textAlignVertical="top"
      />
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  letter: {
    minHeight: 320,
  },
});
