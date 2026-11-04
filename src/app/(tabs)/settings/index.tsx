import { BeaverMascot } from '@/components/beaver-mascot';
import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { QueryFeedback } from '@/components/query-feedback';
import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { DeskScene } from '@/components/desk/desk-scene';
import { Group, GroupRow } from '@/components/group';
import { Notice } from '@/components/notice';
import { RoomView } from '@/components/room/room-view';
import { SegmentedChoice } from '@/components/segmented-choice';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { api, PRIVACY_URL } from '@/lib/api';
import { useDesk } from '@/lib/desk';
import { useMotionLevel } from '@/lib/feedback';
import { cancelAllReminders, cancelRecap, scheduleRecap } from '@/lib/notifications';
import { canAnalyzePhoto } from '@/lib/scan';
import { keys, queryClient, useHealth, useSpaces } from '@/lib/queries';
import { useCurrentPlace, usePlaceRoom } from '@/lib/room';
import { forgetDeviceKey } from '@/lib/session';
import { RECAP_HOURS, RECAP_WEEKDAY, useSettings, type RecapDay, type RecapHour, type Settings } from '@/lib/settings';
import { playSound, preloadSounds, VOLUME } from '@/lib/sounds';

export default function SettingsScreen() {
  const t = useT();
  const theme = useTheme();
  const { settings, update, reset } = useSettings();
  const spaces = useSpaces();
  const health = useHealth();
  const desk = useDesk();
  const level = useMotionLevel();
  // La vista previa es el cuarto del lugar de ahora (o la escena 2D, si no hay lugar).
  const preview = usePlaceRoom(useCurrentPlace());
  const [newPlace, setNewPlace] = useState('');
  const [recapDenied, setRecapDenied] = useState(false);

  const addPlace = useMutation({
    mutationFn: () => api.createSpace(newPlace.trim(), 'other'),
    onSuccess: () => {
      setNewPlace('');
      queryClient.invalidateQueries({ queryKey: keys.spaces });
    },
  });
  const removePlace = useMutation({
    mutationFn: api.deleteSpace,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.spaces }),
  });
  const deleteAll = useMutation({
    mutationFn: api.deleteMe,
    onSuccess: async () => {
      await cancelAllReminders();
      await forgetDeviceKey();
      await reset();
      queryClient.clear();
      router.replace('/onboarding');
    },
  });

  function confirmDeleteAll() {
    // Acción irreversible: aquí sí corresponde una confirmación nativa.
    Alert.alert(t.settings.deleteConfirmTitle, t.settings.deleteConfirmBody, [
      { text: t.settings.cancel, style: 'cancel' },
      { text: t.settings.deleteConfirm, style: 'destructive', onPress: () => deleteAll.mutate() },
    ]);
  }

  const toggle = (
    key: keyof Pick<Settings, 'details' | 'sounds' | 'haptics' | 'softContrast' | 'showDesk' | 'scanAudio' | 'scanPhoto'>,
    label: string,
    first = false,
    disabled = false,
    hint?: string,
  ) => (
    <GroupRow first={first}>
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <ThemedText>{label}</ThemedText>
          {hint ? (
            <ThemedText type="footnote" themeColor="textSecondary">
              {hint}
            </ThemedText>
          ) : null}
        </View>
        <Switch
          accessibilityLabel={label}
          accessibilityHint={hint}
          value={settings[key] && !disabled}
          disabled={disabled}
          // Si la persona ya eligió aquí, el aviso de Hoy no hace falta.
          onValueChange={(value) =>
            update({ [key]: value, ...(key === 'details' || key === 'sounds' ? { experienceOffered: true } : {}) })
          }
          trackColor={{ true: theme.primary }}
        />
      </View>
    </GroupRow>
  );

  async function chooseRecap(day: RecapDay, hour: RecapHour = settings.recapHour) {
    setRecapDenied(false);
    if (day === 'off') {
      await cancelRecap();
      update({ recapDay: 'off' });
      return;
    }
    const scheduled = await scheduleRecap(
      RECAP_WEEKDAY[day],
      hour,
      t.recap.notificationTitle,
      t.recap.notificationBody,
    ).catch(() => false);
    if (scheduled) update({ recapDay: day, recapHour: hour, recapSeenAt: Date.now(), recapOffered: true });
    else setRecapDenied(true);
  }

  function testSound() {
    preloadSounds();
    playSound('result', VOLUME[settings.soundVolume]);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Group title={t.appearance.title} footer={t.appearance.entryHint}>
        <GroupRow first>
          <Button title={t.appearance.open} variant="secondary" onPress={() => router.push('/appearance')} />
        </GroupRow>
      </Group>
      <View style={styles.block}>
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.label}>
          {t.settings.language}
        </ThemedText>
        <ChoiceList
          options={[
            { id: 'system', label: t.settings.languageSystem },
            { id: 'es', label: 'Español' },
            { id: 'en', label: 'English' },
          ]}
          selected={[settings.language]}
          onSelect={(id) => update({ language: id as Settings['language'] })}
        />
      </View>

      {!settings.focusMode ? <View style={styles.block}>
        <ThemedText type="footnote" themeColor="textSecondary" accessibilityRole="header" style={styles.label}>
          {t.settings.experience}
        </ThemedText>
        <View style={{ alignSelf: 'center' }}><BeaverMascot pose="coffee" size={96} interactive /></View>
        {preview.scene === 'room' && preview.layout ? (
          // Se vuelve a armar al cambiar el nivel de movimiento: así se ve cómo llega en cada uno.
          <RoomView
            key={level}
            layout={preview.layout}
            modifiers={preview.modifiers}
            intro
            accessibilityLabel={preview.label}
          />
        ) : preview.scene === 'desk' ? (
          <DeskScene
            items={desk.items}
            interactive
            accessibilityLabel={t.desk.label(desk.items.map((item) => t.desk.items[item]))}
          />
        ) : null}
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.label} importantForAccessibility="no">
          {t.settings.previewHint}
        </ThemedText>
      </View> : null}

      <View style={styles.block}>
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.label}>
          {t.settings.motion}
        </ThemedText>
        <ChoiceList
          options={[
            { id: 'system', label: t.settings.motionSystem },
            { id: 'reduced', label: t.settings.motionReduced },
          ]}
          selected={[settings.motion]}
          onSelect={(id) => update({ motion: id as Settings['motion'] })}
        />
      </View>

      <Group footer={t.settings.experienceFooter}>
        {toggle('details', t.settings.details, true, false, t.settings.detailsHint)}
        {toggle('sounds', t.settings.sounds, false, false, t.settings.soundsHint)}
        {settings.sounds ? (
          <GroupRow>
            <ThemedText type="footnote" themeColor="textSecondary">
              {t.settings.volume}
            </ThemedText>
            <SegmentedChoice
              label={t.settings.volume}
              options={[
                { id: 'low', label: t.settings.volumeLow },
                { id: 'medium', label: t.settings.volumeMedium },
              ]}
              selected={settings.soundVolume}
              onSelect={(id) => update({ soundVolume: id as Settings['soundVolume'] })}
            />
            <Button variant="plain" title={t.settings.testSound} style={styles.inline} onPress={testSound} />
          </GroupRow>
        ) : null}
        {toggle('haptics', t.settings.haptics)}
      </Group>

      <View style={styles.block}>
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.label}>
          {t.settings.recap}
        </ThemedText>
        <ChoiceList
          options={[
            { id: 'off', label: t.settings.recapOff },
            ...(['mon', 'wed', 'fri', 'sun'] as const).map((day) => ({ id: day, label: t.settings.recapDays[day] })),
          ]}
          selected={[settings.recapDay]}
          onSelect={(id) => chooseRecap(id as RecapDay)}
        />
        {settings.recapDay !== 'off' ? (
          <SegmentedChoice
            label={t.settings.recapTime}
            options={RECAP_HOURS.map((hour) => ({ id: String(hour), label: `${hour}:00` }))}
            selected={String(settings.recapHour)}
            onSelect={(id) => chooseRecap(settings.recapDay, Number(id) as RecapHour)}
          />
        ) : null}
        {recapDenied ? <Notice text={t.settings.recapDenied} /> : null}
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.label}>
          {t.settings.recapFooter}
        </ThemedText>
      </View>

      <Group title={t.settings.scanSection} footer={t.settings.scanSectionFooter}>
        {toggle('scanAudio', t.scan.listenConsent, true)}
        {toggle('scanPhoto', t.scan.photoConsent, false, !canAnalyzePhoto)}
      </Group>

      <QueryFeedback query={spaces} />
      {addPlace.isError || removePlace.isError ? <Notice text={t.common.somethingFailed} /> : null}
      <Group title={t.settings.places}>
        {(spaces.data ?? []).map((space, index) => (
          <GroupRow key={space.id} first={index === 0}>
            <View style={styles.switchRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityHint={t.place.open}
                onPress={() => router.push({ pathname: '/place/[id]', params: { id: space.id } })}
                style={({ pressed }) => [styles.flex, styles.placeName, { opacity: pressed ? 0.6 : 1 }]}>
                <ThemedText>{space.name}</ThemedText>
              </Pressable>
              <Button
                variant="plain"
                title={t.settings.removePlace}
                style={styles.inline}
                loading={removePlace.isPending && removePlace.variables === space.id}
                disabled={removePlace.isPending}
                onPress={() => removePlace.mutate(space.id)}
              />
            </View>
          </GroupRow>
        ))}
        <GroupRow first={!spaces.data?.length}>
          <TextField
            label={t.settings.newPlacePlaceholder}
            placeholder={t.settings.newPlacePlaceholder}
            value={newPlace}
            onChangeText={setNewPlace}
            maxLength={60}
          />
          <Button
            variant="secondary"
            title={t.settings.addPlace}
            disabled={!newPlace.trim()}
            loading={addPlace.isPending}
            onPress={() => addPlace.mutate()}
          />
        </GroupRow>
      </Group>

      <Group title={t.settings.privacy}>
        <GroupRow first>
          <ThemedText type="callout">{t.settings.privacyBody}</ThemedText>
          <Button
            variant="plain"
            title={t.settings.readPrivacy}
            style={styles.inline}
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
          />
        </GroupRow>
        <GroupRow>
          <Button
            variant="plain"
            title={t.settings.deleteAll}
            loading={deleteAll.isPending}
            style={styles.inline}
            onPress={confirmDeleteAll}
          />
        </GroupRow>
      </Group>

      {deleteAll.isError ? <Notice text={t.common.somethingFailed} /> : null}
      <Group title={t.settings.about}>
        <GroupRow first>
          <ThemedText type="callout">
            {t.settings.version(Constants.expoConfig?.version ?? '1.0.0', health.data?.version)}
          </ThemedText>
          <ThemedText type="footnote" themeColor="textSecondary">
            {health.isSuccess ? t.settings.serverOk : health.isError ? t.settings.serverDown : ' '}
          </ThemedText>
        </GroupRow>
      </Group>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  block: {
    gap: Spacing.two,
  },
  label: {
    paddingHorizontal: Spacing.three,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  placeName: {
    minHeight: 44,
    justifyContent: 'center',
  },
  inline: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    minHeight: 44,
  },
});
