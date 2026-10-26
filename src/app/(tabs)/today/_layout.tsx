import { TabStack } from '@/components/tab-stack';
import { useT } from '@/i18n';

export default function TodayLayout() {
  return <TabStack title={useT().tabs.today} />;
}
