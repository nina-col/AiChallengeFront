import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
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
      <View style={styles.steps}>
        {t.onboarding.howSteps.map((step, index) => (
          <View key={step} style={styles.step}>
            <View style={[styles.number, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="bodyStrong">{index + 1}</ThemedText>
            </View>
            <ThemedText style={styles.stepText}>{step}</ThemedText>
          </View>
        ))}
        <ThemedText type="callout" themeColor="textSecondary">
          {t.onboarding.scanChoice}
        </ThemedText>
      </View>

      <Group title={t.onboarding.privacyTitle}>
        <GroupRow first>
          <ThemedText type="callout">{t.onboarding.privacyBody}</ThemedText>
        </GroupRow>
        <Button
          variant="plain"
          title={t.onboarding.readNotice}
          style={styles.noticeLink}
          onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
        />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={t.onboarding.consent}
          accessibilityState={{ checked: consented }}
          onPress={() => setConsented((value) => !value)}
          style={({ pressed }) => [styles.consent, {
            backgroundColor: consented ? theme.backgroundSelected : theme.backgroundElement,
            opacity: pressed ? 0.75 : 1,
            borderTopColor: theme.separator,
          }]}>
          <View accessible={false} style={[styles.checkbox, {
            borderColor: theme.primary,
            backgroundColor: consented ? theme.primary : theme.backgroundElement,
          }]}>
            {consented ? <View style={[styles.checkmark, { borderColor: theme.onPrimary }]} /> : null}
          </View>
          <ThemedText style={styles.stepText}>{t.onboarding.consent}</ThemedText>
        </Pressable>
      </Group>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  steps: {
    gap: Spacing.three,
  },
  noticeLink: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
  },
  consent: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkmark: {
    width: 7,
    height: 12,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    transform: [{ translateY: -2 }, { rotate: '45deg' }],
  },
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
