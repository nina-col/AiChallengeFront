import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { Group, GroupRow } from '@/components/group';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { api, PRIVACY_URL } from '@/lib/api';
import { cancelAllReminders } from '@/lib/notifications';
import { keys, queryClient, useHealth, useSpaces } from '@/lib/queries';
import { forgetDeviceKey } from '@/lib/session';
import { useSettings, type Settings } from '@/lib/settings';

export default function SettingsScreen() {
  const t = useT();
  const theme = useTheme();
  const { settings, update, reset } = useSettings();
  const spaces = useSpaces();
  const health = useHealth();
  const [newPlace, setNewPlace] = useState('');

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

  const toggle = (key: keyof Pick<Settings, 'haptics' | 'softContrast'>, label: string, first = false) => (
    <GroupRow first={first}>
      <View style={styles.switchRow}>
        <ThemedText style={styles.flex}>{label}</ThemedText>
        <Switch
          accessibilityLabel={label}
          value={settings[key]}
          onValueChange={(value) => update({ [key]: value })}
          trackColor={{ true: theme.primary }}
        />
      </View>
    </GroupRow>
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
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

      <Group>
        {toggle('haptics', t.settings.haptics, true)}
        {toggle('softContrast', t.settings.softContrast)}
      </Group>

      <Group title={t.settings.places}>
        {(spaces.data ?? []).map((space, index) => (
          <GroupRow key={space.id} first={index === 0}>
            <View style={styles.switchRow}>
              <ThemedText style={styles.flex}>{space.name}</ThemedText>
              <Button
                variant="plain"
                title={t.settings.removePlace}
                style={styles.inline}
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
  },
  inline: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    minHeight: 44,
  },
});
