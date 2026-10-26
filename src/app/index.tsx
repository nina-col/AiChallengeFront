import { Redirect } from 'expo-router';

import { useSettings } from '@/lib/settings';

export default function Index() {
  const { settings } = useSettings();
  return <Redirect href={settings.onboarded ? '/today' : '/onboarding'} />;
}
