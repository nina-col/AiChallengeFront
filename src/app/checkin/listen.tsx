import {
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useCheckinDraft } from '@/lib/checkin-draft';
import { analyzeRecording, canAnalyzePhoto } from '@/lib/scan';
import { useSettings } from '@/lib/settings';

const SECONDS = 10;

/** PCM lineal a 16 kHz mono: lo que lee el análisis en el teléfono. */
const RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

type Phase = 'idle' | 'recording' | 'processing' | 'denied';

/** Escucha 10 s con un indicador visible todo el tiempo; el audio se analiza aquí y se borra. */
export default function Listen() {
  const t = useT();
  const theme = useTheme();
  const { settings } = useSettings();
  const { update } = useCheckinDraft();
  const recorder = useAudioRecorder(RECORDING);
  const state = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<Phase>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function next(audioHints: string[]) {
    update({ audioHints });
    if (settings.scanPhoto && canAnalyzePhoto) router.replace('/checkin/photo');
    else router.replace('/checkin/findings');
  }

  async function start() {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setPhase('denied');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setPhase('recording');
    timer.current = setTimeout(finish, SECONDS * 1000);
  }

  async function finish() {
    if (timer.current) clearTimeout(timer.current);
    setPhase('processing');
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    const hints = recorder.uri ? await analyzeRecording(recorder.uri).catch(() => []) : [];
    next(hints);
  }

  // Si la persona sale a mitad de la grabación, se detiene y no queda audio.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (recorder.isRecording) recorder.stop().catch(() => {});
    },
    [recorder],
  );

  const remaining = Math.max(0, SECONDS - Math.floor(state.durationMillis / 1000));

  return (
    <StepScreen
      title={t.scan.listenTitle}
      hint={t.scan.listenHint}
      footer={
        phase === 'recording' ? (
          <Button variant="secondary" title={t.scan.listenStop} onPress={finish} />
        ) : phase === 'denied' ? (
          <Button title={t.scan.continueWithout} onPress={() => next([])} />
        ) : (
          <Button title={t.scan.listenStart} loading={phase === 'processing'} onPress={start} />
        )
      }>
      {phase === 'recording' ? (
        <View
          accessible
          accessibilityLiveRegion="polite"
          style={[styles.indicator, { backgroundColor: theme.backgroundSelected }]}>
          <View style={[styles.dot, { backgroundColor: theme.warm }]} />
          <ThemedText type="headline">{t.scan.listening(remaining)}</ThemedText>
        </View>
      ) : null}
      {phase === 'denied' ? <Notice text={t.scan.listenDenied} /> : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
