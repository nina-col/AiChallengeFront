import { QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useLocale, type Locale } from '@/i18n';
import { api } from '@/lib/api';
import { useReducedMotion } from '@/lib/feedback';
import { queryClient } from '@/lib/queries';
import { SettingsProvider, useSettings } from '@/lib/settings';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SettingsProvider>
      <QueryClientProvider client={queryClient}>
        <RootNavigator />
      </QueryClientProvider>
    </SettingsProvider>
  );
}

function RootNavigator() {
  const { ready, settings } = useSettings();
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const reducedMotion = useReducedMotion();
  const locale = useLocale();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  useOpenCheckoutFromNotification(ready && settings.onboarded);
  useServerLocale(locale, ready && settings.onboarded);

  if (!ready) return null;

  const base = dark ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: theme.primary,
          background: theme.background,
          card: theme.background,
          text: theme.text,
          border: theme.separator,
        },
      }}>
      <StatusBar style="auto" />
      {/* Las pestañas y los flujos llevan su propio Stack con encabezado nativo. */}
      <Stack screenOptions={{ headerShown: false, animation: reducedMotion ? 'fade' : 'default' }}>
        <Stack.Screen name="checkin" options={{ presentation: 'modal' }} />
        <Stack.Screen name="checkout" options={{ presentation: 'modal' }} />
        <Stack.Screen name="request" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

/** Tocar el aviso "¿cómo te fue?" abre directo la pregunta de ese registro. */
function useOpenCheckoutFromNotification(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const open = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.content.data?.checkinId;
      if (typeof id === 'string') router.push({ pathname: '/checkout/[id]', params: { id } });
    };
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          open(response);
          Notifications.clearLastNotificationResponseAsync().catch(() => {});
        }
      })
      .catch(() => {});
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [enabled]);
}

/** Las sugerencias llegan en el idioma de la persona: se lo decimos al servidor cuando cambia. */
function useServerLocale(locale: Locale, enabled: boolean) {
  const synced = useRef<Locale | null>(null);
  useEffect(() => {
    if (!enabled || synced.current === locale) return;
    const first = synced.current === null;
    synced.current = locale;
    api
      .updateLocale(locale)
      .then(() => {
        if (!first) queryClient.invalidateQueries();
      })
      .catch(() => {});
  }, [locale, enabled]);
}
