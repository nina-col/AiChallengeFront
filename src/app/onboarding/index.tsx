import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { BeaverMascot } from '@/components/beaver-mascot';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

export default function Welcome() {
  const t = useT();
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.hero} style={styles.scroll}>
        <BeaverMascot pose="welcome" size={176} />
        <ThemedText type="title" accessibilityRole="header">
          {t.onboarding.welcomeTitle}
        </ThemedText>
        <ThemedText type="headline" style={styles.body}>
          {t.onboarding.mascotIntro}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.body}>
          {t.onboarding.welcomeBody}
        </ThemedText>
      </ScrollView>
      <View style={styles.footer}>
        <Button variant="plain" title={t.appearance.open} onPress={() => router.push('/appearance')} />
        <Button title={t.onboarding.start} onPress={() => router.push('/onboarding/how')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: Spacing.three,
  },
  scroll: { flex: 1 },
  hero: {
    flexGrow: 1,
    paddingVertical: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  body: {
    textAlign: 'center',
    maxWidth: 340,
  },
  footer: {
    paddingTop: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
