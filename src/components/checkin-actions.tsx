import { router } from 'expo-router';
import { View } from 'react-native';
import { Button } from '@/components/button';
import { useUxCopy } from '@/lib/ux-copy';
export function CheckinActions() {
 const t = useUxCopy();
 return <View style={{ gap: 12, alignSelf: 'stretch' }}>
  <Button title={t.environment} onPress={() => router.push('/checkin/areas')} />
  <Button title={t.internal} variant="secondary" onPress={() => router.push('/checkin/internal')} />
  <Button title={t.unsure} variant="secondary" onPress={() => router.push('/checkin/orient')} />
 </View>;
}
