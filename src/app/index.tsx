import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { type ApiHealthState, useApiHealth } from '@/hooks/use-api-health';
import { useTheme } from '@/hooks/use-theme';

const STATUS_LABELS: Record<ApiHealthState['status'], string> = {
  checking: 'Conectando con el servidor…',
  online: 'Servidor conectado',
  degraded: 'Servidor activo, base de datos sin respuesta',
  offline: 'Sin conexión con el servidor',
};

export default function HomeScreen() {
  const theme = useTheme();
  const { state, retry } = useApiHealth();

  const dotColor = {
    checking: theme.textSecondary,
    online: theme.accent,
    degraded: theme.warm,
    offline: theme.warm,
  }[state.status];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.hero}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.icon}
            accessible={false}
          />
          <ThemedText type="subtitle">SpaceEase</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.tagline}>
            Descubre qué te dificulta trabajar y prueba un ajuste a la vez.
          </ThemedText>
        </ThemedView>

        <ThemedView
          type="backgroundElement"
          style={styles.status}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={STATUS_LABELS[state.status]}>
          <ThemedView style={[styles.dot, { backgroundColor: dotColor }]} />
          <ThemedView type="backgroundElement" style={styles.statusText}>
            <ThemedText type="small">{STATUS_LABELS[state.status]}</ThemedText>
            {'health' in state && (
              <ThemedText type="small" themeColor="textSecondary">
                API v{state.health.version}
                {state.health.commit ? ` · ${state.health.commit}` : ''}
              </ThemedText>
            )}
          </ThemedView>
          {state.status === 'offline' && (
            <Pressable onPress={retry} accessibilityRole="button" hitSlop={Spacing.three}>
              <ThemedText type="smallBold">Reintentar</ThemedText>
            </Pressable>
          )}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  icon: {
    width: 128,
    height: 128,
    borderRadius: 28,
  },
  tagline: {
    textAlign: 'center',
    maxWidth: 320,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    flex: 1,
  },
});
