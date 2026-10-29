import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useCheckinDraft } from '@/lib/checkin-draft';

/**
 * Entrada de "Usarlo otra vez" (desde "Lo que sé de este lugar"): deja el ajuste, el estímulo y el
 * lugar en el borrador y sigue con el registro corto.
 */
export default function Repeat() {
  const { adjustment, stimulus, space } = useLocalSearchParams<{ adjustment: string; stimulus?: string; space: string }>();
  const { update } = useCheckinDraft();

  useEffect(() => {
    update({ repeat: { adjustmentId: adjustment, stimulus: stimulus || null, spaceId: space }, spaceId: space, askPlace: false });
    router.replace('/checkin/task');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al entrar
  }, []);

  return null;
}
