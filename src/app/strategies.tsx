import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Group, GroupRow } from '@/components/group';
import { PixelIcon } from '@/components/pixel-icon';
import { QueryFeedback } from '@/components/query-feedback';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { DOMAIN_ART } from '@/lib/art';
import { useCatalog } from '@/lib/queries';

/**
 * Conocer las estrategias con calma, sin registrar nada ni pasar por la IA (lo pidió la socioformadora).
 * Agrupadas por tema; primero solo el nombre, y al tocarla, cómo se hace y por qué puede ayudar.
 */
export default function Strategies() {
  const t = useT();
  const theme = useTheme();
  const catalog = useCatalog();
  const [open, setOpen] = useState<string | null>(null);
  const domains = catalog.data?.domains ?? [];
  const adjustments = catalog.data?.adjustments ?? [];
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StepScreen art="strategies" title={t.strategies.title} hint={t.strategies.hint} footer={<Button title={t.common.close} onPress={close} />}>
        <QueryFeedback query={catalog} />
        {domains.map((domain) => {
          const ids = new Set(domain.stimuli.map((s) => s.id));
          const items = adjustments.filter((a) => a.stimuli.some((s) => ids.has(s)));
          if (!items.length) return null;
          return (
            <View key={domain.id} style={styles.section}>
              <View style={styles.heading}>
                {DOMAIN_ART[domain.id] ? <PixelIcon name={DOMAIN_ART[domain.id]} size={40} /> : null}
                <ThemedText type="headline" accessibilityRole="header">
                  {t.strategies.groups[domain.id] ?? domain.id}
                </ThemedText>
              </View>
              <Group>
                {items.map((item, index) => {
                  const key = `${domain.id}:${item.id}`;
                  const expanded = open === key;
                  return (
                    <GroupRow key={key} first={index === 0}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                        accessibilityHint={item.kind === 'ask' ? t.strategies.askBadge : undefined}
                        onPress={() => setOpen(expanded ? null : key)}
                        style={styles.row}>
                        <ThemedText type="bodyStrong">{item.title}</ThemedText>
                        {item.kind === 'ask' ? (
                          <ThemedText type="footnote" themeColor="textSecondary">
                            {t.strategies.askBadge}
                          </ThemedText>
                        ) : null}
                      </Pressable>
                      {expanded ? (
                        <View style={styles.detail}>
                          <ThemedText>{item.steps}</ThemedText>
                          <ThemedText type="footnote" themeColor="textSecondary">
                            {t.strategies.why}
                          </ThemedText>
                          <ThemedText type="callout">{item.why}</ThemedText>
                        </View>
                      ) : null}
                    </GroupRow>
                  );
                })}
              </Group>
            </View>
          );
        })}
      </StepScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  section: {
    gap: Spacing.two,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  row: {
    minHeight: 44,
    justifyContent: 'center',
    gap: Spacing.half,
  },
  detail: {
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
});
