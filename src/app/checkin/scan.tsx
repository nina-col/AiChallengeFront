import { router } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { Group, GroupRow } from '@/components/group';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useCheckinSteps } from '@/lib/checkin-steps';
import { canAnalyzePhoto } from '@/lib/scan';
import { useSettings } from '@/lib/settings';

/**
 * Foto y sonido son opcionales y con permisos separados (uno no implica el otro). Las preguntas
 * siguen siendo la señal principal: el escaneo solo propone posibilidades para confirmar.
 */
export default function Scan() {
  const t = useT();
  const theme = useTheme();
  const steps = useCheckinSteps();
  const { settings, update } = useSettings();
  const photoEnabled = settings.scanPhoto && canAnalyzePhoto;

  function start() {
    if (settings.scanAudio) router.push('/checkin/listen');
    else router.push('/checkin/photo');
  }

  const consent = (
    value: boolean,
    onChange: (value: boolean) => void,
    title: string,
    detail: string,
    disabled = false,
    first = false,
  ) => (
    <GroupRow first={first}>
      <View style={styles.row}>
        <View style={styles.text}>
          <ThemedText type="bodyStrong">{title}</ThemedText>
          <ThemedText type="footnote" themeColor="textSecondary">
            {detail}
          </ThemedText>
        </View>
        <Switch
          accessibilityLabel={title}
          accessibilityHint={detail}
          value={value}
          disabled={disabled}
          onValueChange={onChange}
          trackColor={{ true: theme.primary }}
        />
      </View>
    </GroupRow>
  );

  return (
    <StepScreen
      step={t.checkin.step(steps.number('scan'), steps.total)}
      title={t.scan.title}
      hint={t.scan.hint}
      footer={
        <>
          <Button title={t.scan.start} disabled={!settings.scanAudio && !photoEnabled} onPress={start} />
          <Button variant="secondary" title={t.scan.skip} onPress={() => steps.goAfter('scan')} />
        </>
      }>
      <Group>
        {consent(
          settings.scanAudio,
          (scanAudio) => update({ scanAudio }),
          t.scan.listenConsent,
          t.scan.listenDetail,
          false,
          true,
        )}
        {consent(
          photoEnabled,
          (scanPhoto) => update({ scanPhoto }),
          t.scan.photoConsent,
          canAnalyzePhoto ? t.scan.photoDetail : `${t.scan.photoDetail} ${t.scan.photoUnavailable}`,
          !canAnalyzePhoto,
        )}
      </Group>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  text: {
    flex: 1,
    gap: Spacing.one,
  },
});
