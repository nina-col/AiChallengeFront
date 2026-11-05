import { TabStack } from '@/components/tab-stack';
import { useUxCopy } from '@/lib/ux-copy';
export default function SpacesLayout() { return <TabStack title={useUxCopy().spaces} />; }
