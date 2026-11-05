import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useReducedMotion } from '@/lib/feedback';
import { useUxCopy } from '@/lib/ux-copy';

/** Visible text and live announcement work even when motion is disabled. */
export function SaveFeedback({ pending = false }: { pending?: boolean }) {
  const t = useUxCopy(); const theme = useTheme(); const reduced = useReducedMotion();
  return <Animated.View key={pending ? 'saving' : 'saved'} entering={reduced ? undefined : FadeIn.duration(180)} accessibilityLiveRegion="polite" accessibilityRole="text" style={{ padding: 16, borderRadius: 12, backgroundColor: theme.backgroundSelected }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {pending ? <ActivityIndicator color={theme.primary} animating={!reduced} /> : <ThemedText accessible={false}>✓</ThemedText>}
      <ThemedText type="bodyStrong">{pending ? t.saving : t.saved}</ThemedText>
    </View>
    {!pending ? <ThemedText type="footnote">{t.savedHint}</ThemedText> : null}
  </Animated.View>;
}
