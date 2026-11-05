import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Group, GroupRow } from '@/components/group';
import { Notice } from '@/components/notice';
import { SegmentedChoice } from '@/components/segmented-choice';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { revealEntering } from '@/lib/animations';
import { useCheckinDraft } from '@/lib/checkin-draft';
import { useCheckinSteps } from '@/lib/checkin-steps';
import { useFeedback, useMotionLevel } from '@/lib/feedback';
import { audioFindings, type Finding } from '@/lib/scan';
import type { Response } from '@/lib/types';

const PIN = 30;

/**
 * Las posibilidades de la foto y del sonido, cada una con Sí / No / No sé. Solo lo que la persona
 * confirma pasa al registro; lo demás no cuenta. Los marcadores repiten la lista, que es la que
 * lee VoiceOver. Aparecen uno tras otro, en el orden de sus números.
 */
export default function Findings() {
  const t = useT();
  const theme = useTheme();
  const steps = useCheckinSteps();
  const { draft, update } = useCheckinDraft();
  const findings = dedupe(draft.findings ?? audioFindings(draft.audioHints ?? [], t.scan.audioQuestions));
  const photoFindings = findings.filter((f) => f.source === 'photo');
  const [responses, setResponses] = useState<Record<string, Response>>({});
  const level = useMotionLevel();
  const feedback = useFeedback();
  const found = findings.length > 0;

  useEffect(() => {
    if (found) feedback.cue('reveal');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al llegar a la pantalla
  }, []);

  function next() {
    const answers = { ...draft.answers };
    const sources = { ...draft.sources };
    for (const finding of findings) {
      const response = responses[finding.key];
      if (!response) continue;
      answers[finding.stimulus] = response;
      sources[finding.stimulus] = finding.source;
    }
    update({ answers, sources });
    steps.goAfter('scan');
  }

  const options = [
    { id: 'yes', label: t.checkout.yes },
    { id: 'no', label: t.checkout.no },
    { id: 'unsure', label: t.checkout.unsure },
  ];

  return (
    <StepScreen
      title={t.scan.findingsTitle}
      hint={findings.length ? t.scan.findingsHint : t.scan.noFindings}
      footer={<Button title={t.common.next} onPress={next} />}>
      {draft.scanFailed ? <Notice text={t.scan.scanFailed} /> : null}

      {draft.photo && photoFindings.length ? (
        <View
          style={[styles.photo, { aspectRatio: draft.photo.width / draft.photo.height }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Image source={{ uri: draft.photo.uri }} style={StyleSheet.absoluteFill} />
          {photoFindings.map((finding, index) => (
            <Animated.View
              key={finding.key}
              entering={revealEntering(level, index)}
              style={[
                styles.pin,
                {
                  left: `${(finding.x ?? 0.5) * 100}%`,
                  top: `${(finding.y ?? 0.5) * 100}%`,
                  backgroundColor: theme.primary,
                  borderColor: theme.background,
                },
              ]}>
              <ThemedText type="footnote" style={{ color: theme.onPrimary, fontWeight: '600' }}>
                {index + 1}
              </ThemedText>
            </Animated.View>
          ))}
        </View>
      ) : null}

      {findings.length ? (
        <Group>
          {findings.map((finding, index) => {
            const number = photoFindings.indexOf(finding) + 1;
            const label = number > 0 ? t.scan.markerLabel(number, finding.question) : finding.question;
            return (
              <GroupRow key={finding.key} first={index === 0}>
                <ThemedText type="footnote" themeColor="textSecondary">
                  {number > 0 ? `${number}` : t.scan.fromSound}
                </ThemedText>
                <ThemedText>{finding.question}</ThemedText>
                <SegmentedChoice
                  label={label}
                  options={options}
                  selected={responses[finding.key]}
                  onSelect={(id) => setResponses((current) => ({ ...current, [finding.key]: id as Response }))}
                />
              </GroupRow>
            );
          })}
        </Group>
      ) : null}
    </StepScreen>
  );
}

/** Si la foto y el sonido sugieren lo mismo, se pregunta una sola vez (gana la foto). */
function dedupe(findings: Finding[]) {
  const seen = new Set<string>();
  return findings.filter((f) => {
    if (seen.has(f.stimulus)) return false;
    seen.add(f.stimulus);
    return true;
  });
}

const styles = StyleSheet.create({
  photo: {
    width: '100%',
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  pin: {
    position: 'absolute',
    width: PIN,
    height: PIN,
    marginLeft: -PIN / 2,
    marginTop: -PIN / 2,
    borderRadius: PIN / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
