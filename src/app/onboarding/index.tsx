import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { DeskScene } from '@/components/desk/desk-scene';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

export default function Welcome() {
  const t = useT();
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={styles.hero}>
        {/* La metáfora de la app desde el primer momento: la onda del monitor se calma. */}
        <DeskScene items={[]} settle accessibilityLabel={t.desk.label([])} style={styles.scene} />
        <ThemedText type="title" accessibilityRole="header">
          {t.onboarding.welcomeTitle}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.body}>
          {t.onboarding.welcomeBody}
        </ThemedText>
      </View>
      <View style={styles.footer}>
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
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  body: {
    textAlign: 'center',
    maxWidth: 340,
  },
  scene: {
    maxWidth: 420,
    marginBottom: Spacing.three,
  },
  footer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
