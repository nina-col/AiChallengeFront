import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { Notice } from '@/components/notice';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useZenSession } from '@/hooks/use-zen-session';
import { useLocale, useT } from '@/i18n';
import { guideIndex, sessionRemaining, zenDuration, type ZenActivity } from '@/lib/zen-session';

type VoiceChoice = { activity: ZenActivity; duration: number; voice: boolean };
export default function Zen() {
  const t = useT();
  const locale = useLocale();
  const theme = useTheme();
  const { session, dispatch } = useZenSession();
  const [choice, setChoice] = useState<VoiceChoice>({ activity: 'grounding', duration: 120, voice: false });
  const [leaves, setLeaves] = useState<boolean[]>(Array(6).fill(false));
  const [voiceFailed, setVoiceFailed] = useState(false);
  const voiceGeneration = useRef(0);
  const step = guideIndex(session);
  const guide = choice.activity === 'breathing' ? t.zen.breathSteps : t.zen.groundSteps;
  const seconds = Math.ceil(session.remainingMs / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const running = session.status === 'running';
  const setup = session.status === 'idle';
  const done = session.status === 'done';

  function stopVoice() {
    voiceGeneration.current += 1;
    Speech.stop().catch(() => {});
  }
  // Only read public guide text. Never read or transmit a person's notes or answers.
  useEffect(() => {
    const generation = ++voiceGeneration.current;
    if (!choice.voice || choice.activity === 'garden' || !running) {
      Speech.stop().catch(() => {});
      return;
    }
    let cancelled = false;
    Speech.stop().then(() => {
      if (cancelled || voiceGeneration.current !== generation || AppState.currentState !== 'active') return;
      Speech.speak(guide[step], {
        language: locale === 'es' ? 'es-MX' : 'en-US', rate: 0.85, volume: 0.6,
        onError: () => { if (!cancelled) setVoiceFailed(true); },
      });
    }).catch(() => { if (!cancelled) setVoiceFailed(true); });
    return () => { cancelled = true; Speech.stop().catch(() => {}); };
  }, [choice.voice, choice.activity, running, guide, step, locale]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => { if (state !== 'active') stopVoice(); });
    return () => { listener.remove(); stopVoice(); };
  }, []);

  const close = () => {
    stopVoice();
    dispatch({ type: 'finish', now: 0 });
    if (router.canGoBack()) router.back(); else router.replace('/');
  };
  const finish = () => { stopVoice(); dispatch({ type: 'finish', now: 0 }); };
  const pause = () => { stopVoice(); dispatch({ type: 'pause', now: Date.now() }); };
  function touchSeed(index: number, now: number) {
    if (!running) return;
    if (sessionRemaining(session, now) <= 0) { finish(); return; }
    setLeaves((previous) => previous.map((leaf, i) => i === index ? !leaf : leaf));
  }
  const voiceToggle = (
    <View style={styles.toggle}>
      <View style={styles.flex}>
        <ThemedText>{t.zen.voice}</ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary">{t.zen.voiceHint}</ThemedText>
      </View>
      <Switch accessibilityLabel={t.zen.voice} value={choice.voice} onValueChange={(voice) => { if (!voice) stopVoice(); setVoiceFailed(false); setChoice((old) => ({ ...old, voice })); }} trackColor={{ true: theme.primary }} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StepScreen title={done ? t.zen.done : t.zen.title} hint={done ? t.zen.doneHint : t.zen.hint} footer={
        setup ? <><Button title={t.zen.start} onPress={() => dispatch({ type: 'start', duration: zenDuration(choice.activity, choice.duration), now: Date.now() })} /><Button title={t.zen.exit} variant="plain" onPress={close} /></>
        : done ? <Button title={t.zen.back} onPress={close} />
        : <><Button title={running ? t.zen.pause : t.zen.resume} onPress={running ? pause : () => dispatch({ type: 'resume', now: Date.now() })} /><Button title={t.zen.stop} variant="plain" onPress={finish} /></>
      }>
        {setup ? <>
          <ThemedText type="headline" accessibilityRole="header">{t.zen.activity}</ThemedText>
          <ChoiceList options={[
            { id: 'grounding', label: t.zen.grounding, hint: t.zen.groundingHint },
            { id: 'breathing', label: t.zen.breathing, hint: t.zen.breathingHint },
            { id: 'garden', label: t.zen.garden, hint: t.zen.gardenHint },
          ]} selected={[choice.activity]} onSelect={(activity) => setChoice((old) => ({ ...old, activity: activity as ZenActivity }))} />
          {choice.activity === 'garden' ? <Notice text={t.zen.fixed} /> : <>
            <ThemedText type="headline" accessibilityRole="header">{t.zen.duration}</ThemedText>
            <ChoiceList options={[60, 120, 300].map((n, i) => ({ id: String(n), label: t.zen.durations[i] }))} selected={[String(choice.duration)]} onSelect={(duration) => setChoice((old) => ({ ...old, duration: Number(duration) }))} />
            {voiceToggle}
          </>}
        </> : !done ? <>
          <View accessible accessibilityLabel={`${t.zen.remaining}: ${time}`} style={styles.clock}>
            <ThemedText type="footnote" themeColor="textSecondary">{t.zen.remaining}</ThemedText>
            <ThemedText type="title">{time}</ThemedText>
          </View>
          {session.status === 'paused' ? <Notice text={`${t.zen.paused}. ${t.zen.pausedHint}`} /> : null}
          {choice.activity === 'garden' ? <>
            <ThemedText>{t.zen.gardenInstruction}</ThemedText>
            <View style={styles.garden}>
              {leaves.map((leaf, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${t.zen.gardenLabel} ${i + 1}: ${leaf ? t.zen.sprout : t.zen.seed}`} disabled={!running} accessibilityState={{ disabled: !running }} onPress={() => touchSeed(i, Date.now())} style={({ pressed }) => [styles.seed, { borderColor: theme.primary, backgroundColor: leaf ? theme.backgroundSelected : theme.backgroundElement, opacity: !running ? 0.45 : pressed ? 0.75 : 1 }]}>
                <View style={styles.plant} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <View style={[styles.stem, { backgroundColor: theme.primary, height: leaf ? 34 : 10 }]} />
                  {leaf ? <><View style={[styles.leaf, styles.leftLeaf, { backgroundColor: theme.accent }]} /><View style={[styles.leaf, styles.rightLeaf, { backgroundColor: theme.primary }]} /></> : null}
                </View>
              </Pressable>)}
            </View>
          </> : <>
            <ThemedText type="headline">{choice.activity === 'breathing' ? t.zen.breathing : t.zen.grounding}</ThemedText>
            <ThemedText accessibilityLiveRegion="polite">{guide[step]}</ThemedText>
            {voiceToggle}
          </>}
          {voiceFailed ? <Notice text={t.zen.spokenError} /> : null}
        </> : null}
      </StepScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, flex: { flex: 1, gap: Spacing.one },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  clock: { alignItems: 'center', gap: Spacing.one },
  garden: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'center' },
  seed: { minWidth: 80, minHeight: 88, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  plant: { width: 50, height: 50, alignItems: 'center', justifyContent: 'flex-end' },
  stem: { width: 4, borderRadius: 2 },
  leaf: { position: 'absolute', width: 22, height: 12, borderRadius: 12, top: 12 },
  leftLeaf: { left: 4, transform: [{ rotate: '30deg' }] },
  rightLeaf: { right: 4, top: 23, transform: [{ rotate: '-30deg' }] },
});
