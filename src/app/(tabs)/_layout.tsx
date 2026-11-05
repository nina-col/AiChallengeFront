import { useUxCopy } from '@/lib/ux-copy';
import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/** Barra de pestañas nativa: sin animación entre pestañas (son pares, no jerarquía). */
export default function TabsLayout() {
  const t = useT();
  const copy = useUxCopy();
  const theme = useTheme();
  return (
    <NativeTabs backgroundColor={theme.backgroundElement} indicatorColor={theme.backgroundSelected} tintColor={theme.primary} labelStyle={{ color: theme.text }}>
      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.horizon', selected: 'sun.horizon.fill' }} md="today" />
        <NativeTabs.Trigger.Label>{t.tabs.today}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="spaces"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" /><NativeTabs.Trigger.Label>{copy.spaces}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="playbook">
        <NativeTabs.Trigger.Icon sf={{ default: 'leaf', selected: 'leaf.fill' }} md="eco" />
        <NativeTabs.Trigger.Label>{t.tabs.playbook}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
        <NativeTabs.Trigger.Label>{t.tabs.settings}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
