import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { Group, GroupRow } from '@/components/group';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { PRIVACY_URL } from '@/lib/api';

export default function How() {
  const t = useT();
  const theme = useTheme();
  // Consentimiento expreso: empieza sin marcar y nada se guarda sin él.
  const [consented, setConsented] = useState(false);

  return (
    <StepScreen
      title={t.onboarding.howTitle}
      footer={
        <Button
          title={t.onboarding.continue}
          disabled={!consented}
          onPress={() => router.push('/onboarding/place')}
        />
      }>
      <Group>
        {t.onboarding.howSteps.map((step, index) => (
          <GroupRow key={step} first={index === 0}>
            <View style={styles.step}>
              <View style={[styles.number, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="bodyStrong">{index + 1}</ThemedText>
              </View>
              <ThemedText style={styles.stepText}>{step}</ThemedText>
            </View>
          </GroupRow>
        ))}
      </Group>

      <Group title={t.onboarding.privacyTitle}>
        <GroupRow first>
          <ThemedText type="callout">{t.onboarding.privacyBody}</ThemedText>
        </GroupRow>
      </Group>

      <ChoiceList
        multiple
        options={[{ id: 'consent', label: t.onboarding.consent }]}
        selected={consented ? ['consent'] : []}
        onSelect={() => setConsented((value) => !value)}
      />
      <Button
        variant="plain"
        title={t.onboarding.readNotice}
        onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
      />
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  number: {
    width: 32,
    height: 32,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
  },
});
