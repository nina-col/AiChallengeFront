import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EnergyHearts } from '@/components/energy-hearts';
import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { Notice } from '@/components/notice';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLocale, useT } from '@/i18n';
import { dayKey, lastDays, SLOTS, slotFor, useEnergy } from '@/lib/energy';

/** Altura de una barra por punto: la altura dice el nivel, no solo el color. */
const POINT = 7;

/**
 * "¿Cuánta energía tienes ahora?": cinco opciones con corazones, una acción y los últimos días. Se
 * queda en el teléfono. Se corrige tocando otra opción; nunca se pide ni se reclama un registro.
 */
export default function Energy() {
  const t = useT();
  const locale = useLocale();
  const theme = useTheme();
  const { entries, record } = useEnergy();
  const [now] = useState(() => new Date());
  const today = dayKey(now);
  const slot = slotFor(now.getHours());
  const saved = entries.find((e) => e.date === today && e.slot === slot)?.level;
  const days = lastDays(entries, now);
  const weekday = (d: Date) => d.toLocaleDateString(locale, { weekday: 'short' });
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StepScreen
        art="energy"
        title={t.energy.title}
        hint={t.energy.hint}
        footer={
          <>
            {saved !== undefined && saved > 0 && saved <= 3 ? (
              <Button variant="secondary" title={t.energy.takeBreak} onPress={() => router.replace('/zen')} />
            ) : null}
            <Button title={t.energy.done} onPress={close} />
          </>
        }>
        <EnergyHearts labels={t.energy.levels} value={saved} onChange={(level) => record({ date: today, slot, level })} />
        <ChoiceList options={[{ id: '0', label: t.energy.unsure }]} selected={saved === 0 ? ['0'] : []} onSelect={() => record({ date: today, slot, level: 0 })} />
        {saved === 0 ? <Notice text={t.energy.unsureHint} /> : null}
        {saved ? <Notice text={t.energy.actions[saved - 1]} /> : null}

        <View style={styles.week}>
          <ThemedText type="headline" accessibilityRole="header">
            {t.energy.weekTitle}
          </ThemedText>
          {entries.length ? (
            <View style={[styles.chart, { backgroundColor: theme.backgroundElement }]}>
              {days.map((day) => {
                const parts = day.levels.flatMap((level, i) =>
                  level !== null ? [t.energy.slotValue(t.energy.slots[SLOTS[i]], level === 0 ? t.energy.unsure : t.energy.levels[level - 1])] : [],
                );
                return (
                  <View
                    key={day.key}
                    style={styles.day}
                    accessible
                    accessibilityLabel={t.energy.daySummary(weekday(day.date), parts)}>
                    <View style={styles.bars}>
                      {day.levels.map((level, i) => (
                        <View
                          key={i}
                          style={[
                            styles.bar,
                            {
                              height: (level ?? 0) * POINT,
                              backgroundColor: i === 0 ? theme.accent : i === 1 ? theme.primary : theme.warm,
                            },
                          ]}
                        />
                      ))}
                    </View>
                    <ThemedText type="footnote" themeColor="textSecondary">
                      {weekday(day.date)}{day.levels.includes(0) ? ' ?' : ''}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          ) : (
            <ThemedText type="callout" themeColor="textSecondary">
              {t.energy.weekEmpty}
            </ThemedText>
          )}
        </View>
      </StepScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  week: {
    gap: Spacing.two,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Radius.lg,
  },
  day: {
    alignItems: 'center',
    gap: Spacing.one,
    flex: 1,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 5 * POINT,
  },
  bar: {
    width: 6,
    borderRadius: 2,
  },
});
