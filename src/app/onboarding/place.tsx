import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { Notice } from '@/components/notice';
import { StepScreen } from '@/components/step-screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLocale, useT } from '@/i18n';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queries';
import { createDeviceKey, getDeviceKey } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import type { SpaceKind } from '@/lib/types';

export default function Place() {
  const t = useT();
  const locale = useLocale();
  const { update } = useSettings();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<SpaceKind>('office');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function finish() {
    setSaving(true);
    setFailed(false);
    try {
      const key = (await getDeviceKey()) ?? (await createDeviceKey());
      await api.login(key, locale);
      await api.createSpace(name.trim(), kind);
      await queryClient.invalidateQueries();
      update({ onboarded: true });
      router.replace('/today');
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  const kinds = (['office', 'home', 'other'] as const).map((id) => ({ id, label: t.onboarding.kinds[id] }));

  return (
    <StepScreen
      title={t.onboarding.placeTitle}
      hint={t.onboarding.placeHint}
      footer={
        <Button
          title={t.onboarding.finish}
          disabled={!name.trim()}
          loading={saving}
          onPress={finish}
        />
      }>
      <TextField
        label={t.onboarding.placeLabel}
        placeholder={t.onboarding.placePlaceholder}
        value={name}
        onChangeText={setName}
        maxLength={60}
        returnKeyType="done"
        autoCapitalize="sentences"
      />
      <View style={{ gap: Spacing.two }}>
        <ThemedText type="footnote" themeColor="textSecondary">
          {t.onboarding.kindLabel}
        </ThemedText>
        <ChoiceList options={kinds} selected={[kind]} onSelect={(id) => setKind(id as SpaceKind)} />
      </View>
      {failed ? <Notice text={t.common.offline} action={t.common.retry} onAction={finish} /> : null}
    </StepScreen>
  );
}
