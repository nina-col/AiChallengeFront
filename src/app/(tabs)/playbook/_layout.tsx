import { TabStack } from '@/components/tab-stack';
import { useT } from '@/i18n';

export default function PlaybookLayout() {
  return <TabStack title={useT().tabs.playbook} />;
}
