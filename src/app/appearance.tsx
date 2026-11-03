import { router, usePreventRemove } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BeaverMascot } from '@/components/beaver-mascot';
import { DeskScene } from '@/components/desk/desk-scene';
import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { Notice } from '@/components/notice';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTypography } from '@/hooks/use-typography';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { APPEARANCE_DEFAULTS, appearanceFrom, type Appearance } from '@/lib/appearance';
import { AppearancePreview, useSettings } from '@/lib/settings';

export default function AppearanceScreen() {
  const t = useT();
  const theme = useTheme();
  const { settings, saveAppearance } = useSettings();
  const [draft, setDraft] = useState(() => appearanceFrom(settings));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const savingRef = useRef(false);
  const { height, fontScale } = useWindowDimensions();
  const actionTypography = useTypography('bodyStrong');
  const actionsHeight = Math.min(height * 0.35, 2 * Math.max(52, Number(actionTypography.lineHeight) * fontScale + 16) + 40 + (failed ? 110 : 0));

  // Protect the persistent write, including Android's back button.
  const disablePrevention = usePreventRemove(saving);

  const change = <K extends keyof Appearance>(key: K, value: Appearance[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setFailed(false);
  };
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
  async function save() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFailed(false);
    try {
      await saveAppearance(draft);
      savingRef.current = false;
      setSaving(false);
      disablePrevention();
      close();
    } catch {
      savingRef.current = false;
      setFailed(true);
    } finally { setSaving(false); }
  }
  const choose = <K extends 'themeMode' | 'palette' | 'font' | 'textSize' | 'readingSpacing'>(
    key: K, title: string, options: { id: Appearance[K]; label: string }[], hint?: string,
  ) => (
    <View style={styles.section}>
      <ThemedText type="headline" accessibilityRole="header">{title}</ThemedText>
      {hint ? <ThemedText type="callout" themeColor="textSecondary">{hint}</ThemedText> : null}
      <ChoiceList options={options} selected={[draft[key]]} disabled={saving} onSelect={(id) => change(key, id as Appearance[K])} />
    </View>
  );
  const toggle = (key: 'softContrast' | 'showMascot' | 'showDesk' | 'focusMode', label: string, hint?: string) => (
    <View style={[styles.toggle, { borderColor: theme.separator }]}>
      <View style={styles.flex}>
        <ThemedText>{label}</ThemedText>
        {hint ? <ThemedText type="footnote" themeColor="textSecondary">{hint}</ThemedText> : null}
      </View>
      <Switch value={draft[key]} disabled={saving} onValueChange={(value) => change(key, value)} accessibilityLabel={label} accessibilityHint={hint} trackColor={{ true: theme.primary }} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView style={{ flex: 1 }} stickyHeaderIndices={[0]} contentContainerStyle={styles.content}>
        <View style={{ backgroundColor: theme.background, paddingBottom: Spacing.three }}>
          <ThemedText type="footnote">{t.appearance.preview}</ThemedText>
          <AppearancePreview value={draft}>
            <Sample maxHeight={height * 0.36} />
          </AppearancePreview>
        </View>
        <View style={styles.section}>
          <ThemedText type="title" accessibilityRole="header">{t.appearance.title}</ThemedText>
          <ThemedText themeColor="textSecondary">{t.appearance.hint}</ThemedText>
          <ThemedText type="footnote" themeColor="textSecondary">{t.appearance.previewHint}</ThemedText>
        </View>
        {choose('themeMode', t.appearance.theme, [
          { id: 'system', label: t.appearance.system }, { id: 'light', label: t.appearance.light }, { id: 'dark', label: t.appearance.dark },
        ])}
        {choose('palette', t.appearance.palette, [
          { id: 'forest', label: t.appearance.forest }, { id: 'ocean', label: t.appearance.ocean }, { id: 'lavender', label: t.appearance.lavender },
        ])}
        {toggle('softContrast', t.appearance.softContrast)}
        {choose('font', t.appearance.font, [
          { id: 'system', label: t.appearance.fontSystem }, { id: 'atkinson', label: 'Atkinson Hyperlegible' }, { id: 'lexend', label: 'Lexend' },
        ], t.appearance.fontHint)}
        {choose('textSize', t.appearance.textSize, [
          { id: 'standard', label: t.appearance.standard }, { id: 'large', label: t.appearance.large }, { id: 'extraLarge', label: t.appearance.extraLarge },
        ], t.appearance.textSizeHint)}
        {choose('readingSpacing', t.appearance.spacing, [
          { id: 'normal', label: t.appearance.normal }, { id: 'wide', label: t.appearance.wide },
        ])}
        <View style={styles.section}>
          <ThemedText type="headline" accessibilityRole="header">{t.appearance.visuals}</ThemedText>
          {toggle('showMascot', t.appearance.showMascot)}
          {toggle('showDesk', t.appearance.showDesk)}
          {toggle('focusMode', t.appearance.focus, t.appearance.focusHint)}
          <ThemedText type="footnote" themeColor="textSecondary">{t.appearance.sensoryHint}</ThemedText>
        </View>
        <Button title={t.appearance.restore} variant="secondary" disabled={saving} onPress={() => { setDraft({ ...APPEARANCE_DEFAULTS }); setFailed(false); }} />
        <ThemedText type="footnote" themeColor="textSecondary">{t.appearance.restoreHint}</ThemedText>
      </ScrollView>
      <ScrollView style={{ height: actionsHeight, flexGrow: 0, flexShrink: 0 }} contentContainerStyle={[styles.actions, { borderColor: theme.separator }]}>
        {failed ? <Notice text={t.appearance.saveError} /> : null}
        <Button title={t.appearance.save} loading={saving} onPress={save} />
        <Button title={t.appearance.cancel} variant="plain" disabled={saving} onPress={close} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Sample({ maxHeight }: { maxHeight: number }) {
  const t = useT();
  const theme = useTheme();
  const [selected, setSelected] = useState('one');
  const { settings } = useSettings();
  return (
    <ScrollView nestedScrollEnabled style={[styles.sample, { maxHeight, backgroundColor: theme.background, borderColor: theme.primary }]} contentContainerStyle={styles.sampleContent}>
      <View style={styles.sampleHeading}>
        <View style={styles.flex}><ThemedText type="headline">{t.appearance.sampleQuestion}</ThemedText></View>
        <BeaverMascot pose="coffee" size={64} />
      </View>
      <ChoiceList options={[{ id: 'one', label: t.appearance.sampleOne }, { id: 'two', label: t.appearance.sampleTwo }]} selected={[selected]} onSelect={setSelected} />
      {settings.showDesk ? <DeskScene items={[]} accessibilityLabel={t.desk.label([])} style={{ maxWidth: 160, alignSelf: 'center' }} /> : null}
      <Button title={t.appearance.sampleAction} onPress={() => setSelected(selected === 'one' ? 'two' : 'one')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.three, gap: Spacing.four },
  section: { gap: Spacing.two },
  flex: { flex: 1, gap: Spacing.one },
  toggle: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  sample: { borderWidth: 1, borderRadius: Radius.md, marginTop: Spacing.two },
  sampleContent: { padding: Spacing.three, gap: Spacing.two },
  sampleHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actions: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.three, gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth },
});
