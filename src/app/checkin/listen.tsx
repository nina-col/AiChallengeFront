import {
  AudioQuality,
  getRecordingPermissionsAsync,
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
import { AppState, Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LevelMeter } from '@/components/level-meter';
import { Notice } from '@/components/notice';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useCheckinDraft } from '@/lib/checkin-draft';
import { useFeedback } from '@/lib/feedback';
import { analyzeRecording, canAnalyzePhoto } from '@/lib/scan';
import { useSettings } from '@/lib/settings';
import { restoreInterfaceAudio } from '@/lib/sounds';

const SECONDS = 10;

/** PCM lineal a 16 kHz mono: lo que lee el análisis en el teléfono. */
const RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  // Solo para el medidor en pantalla; el nivel no se guarda.
  isMeteringEnabled: true,
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

/** `blocked`: iOS ya no vuelve a preguntar; solo se puede activar en Configuración. */
type Phase = 'idle' | 'recording' | 'processing' | 'denied' | 'blocked';

/** Escucha 10 s con un indicador visible todo el tiempo; el audio se analiza aquí y se borra. */
export default function Listen() {
  const t = useT();
  const theme = useTheme();
  const feedback = useFeedback();
  const { settings } = useSettings();
  const { update } = useCheckinDraft();
  const recorder = useAudioRecorder(RECORDING);
  const state = useAudioRecorderState(recorder, 120);
  const [phase, setPhase] = useState<Phase>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function next(audioHints: string[]) {
    update({ audioHints });
    if (settings.scanPhoto && canAnalyzePhoto) router.replace('/checkin/photo');
    else router.replace('/checkin/findings');
  }

  // Si el permiso ya se negó antes, se dice desde el principio; al volver de Configuración se revisa otra vez.
  useEffect(() => {
    const check = () =>
      getRecordingPermissionsAsync()
        .then((permission) => {
          if (permission.granted) setPhase((current) => (current === 'denied' || current === 'blocked' ? 'idle' : current));
          else if (!permission.canAskAgain) setPhase((current) => (current === 'idle' ? 'blocked' : current));
        })
        .catch(() => {});
    check();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') check();
    });
    return () => subscription.remove();
  }, []);

  async function start() {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setPhase(permission.canAskAgain ? 'denied' : 'blocked');
      return;
    }
    // El aviso suena antes de grabar para que no quede en el análisis.
    await feedback.cue('listenStart');
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
    await restoreInterfaceAudio();
    const hints = recorder.uri ? await analyzeRecording(recorder.uri).catch(() => []) : [];
    next(hints);
  }

  // Si la persona sale a mitad de la grabación, se detiene y no queda audio.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (recorder.isRecording) recorder.stop().then(restoreInterfaceAudio).catch(() => {});
    },
    [recorder],
  );

  const remaining = Math.max(0, SECONDS - Math.floor(state.durationMillis / 1000));
  const unavailable = phase === 'denied' || phase === 'blocked';

  return (
    <StepScreen
      title={t.scan.listenTitle}
      hint={t.scan.listenHint}
      footer={
        phase === 'recording' ? (
          <Button variant="secondary" title={t.scan.listenStop} onPress={finish} />
        ) : unavailable ? (
          <>
            {phase === 'blocked' ? (
              <Button title={t.scan.openSettings} onPress={() => Linking.openSettings()} />
            ) : (
              <Button title={t.scan.listenStart} onPress={start} />
            )}
            <Button variant="secondary" title={t.scan.continueWithout} onPress={() => next([])} />
          </>
        ) : (
          <Button title={t.scan.listenStart} loading={phase === 'processing'} onPress={start} />
        )
      }>
      {phase === 'recording' ? (
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={t.scan.listening(remaining)}
          style={[styles.indicator, { backgroundColor: theme.backgroundSelected }]}>
          <View style={styles.status}>
            <View style={[styles.dot, { backgroundColor: theme.warm }]} />
            <ThemedText type="headline">{t.scan.listening(remaining)}</ThemedText>
          </View>
          <LevelMeter level={state.metering} progress={state.durationMillis / (SECONDS * 1000)} />
        </View>
      ) : null}
      {unavailable ? <Notice text={phase === 'blocked' ? t.scan.listenBlocked : t.scan.listenDenied} /> : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  indicator: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
