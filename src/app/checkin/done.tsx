import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { PixelScene } from '@/components/pixel-scene';
import { StepScreen } from '@/components/step-screen';
import { Spacing } from '@/constants/theme';
import { useT } from '@/i18n';

export default function Done() {
  const t = useT();
  return (
    <StepScreen
      title={t.reminder.doneTitle}
      hint={t.reminder.doneBody}
      footer={<Button title={t.common.backToToday} onPress={() => router.dismissTo('/today')} />}>
      <View style={styles.scene}>
        <PixelScene size={120} />
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  scene: {
    alignItems: 'center',
    paddingTop: Spacing.four,
  },
});
