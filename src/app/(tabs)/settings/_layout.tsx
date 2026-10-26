import { TabStack } from '@/components/tab-stack';
import { useT } from '@/i18n';

export default function SettingsLayout() {
  return <TabStack title={useT().tabs.settings} />;
}
