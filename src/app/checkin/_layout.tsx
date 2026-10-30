import { useTypography } from '@/hooks/use-typography';
import { Stack } from 'expo-router';

import { CloseButton } from '@/components/close-button';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { CheckinDraftProvider, useCheckinDraft } from '@/lib/checkin-draft';
import { useReducedMotion } from '@/lib/feedback';
import { keys, queryClient } from '@/lib/queries';

export default function CheckinLayout() {
  return (
    <CheckinDraftProvider>
      <CheckinStack />
    </CheckinDraftProvider>
  );
}

function CheckinStack() {
  const t = useT();
  const theme = useTheme();
  const headline = useTypography('headline');
  const reducedMotion = useReducedMotion();
  const { draft } = useCheckinDraft();

  // Si se cierra con una sugerencia sin aceptar, el registro queda como dejado, no a medias.
  const closeCheckin = () => {
    const checkin = draft.result?.checkin;
    if (checkin?.status === 'proposed') {
      api.abandon(checkin.id).catch(() => {});
    }
    queryClient.invalidateQueries({ queryKey: keys.trying });
  };

  return (
    <Stack
      screenOptions={{
        title: t.checkin.title,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text, fontFamily: headline.fontFamily, fontSize: headline.fontSize },
        headerBackButtonDisplayMode: 'minimal',
        animation: reducedMotion ? 'fade' : 'default',
        headerRight: () => <CloseButton onClose={closeCheckin} />,
      }}>
      <Stack.Screen name="done" options={{ headerBackVisible: false, gestureEnabled: false }} />
    </Stack>
  );
}
