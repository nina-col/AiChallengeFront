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
import { preloadSounds } from '@/lib/sounds';

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
  useEffect(() => {
    if (ready && settings.sounds) preloadSounds();
  }, [ready, settings.sounds]);
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
      {/*
        Las pestañas y los flujos llevan su propio Stack con encabezado nativo. Los flujos van a
        pantalla completa: en hoja, deslizar hacia abajo arrastraba los botones fuera de la vista
        y podía cerrar el registro a medias. Se cierran con "Cerrar", arriba a la derecha.
      */}
      <Stack screenOptions={{ headerShown: false, animation: reducedMotion ? 'fade' : 'default' }}>
        <Stack.Screen name="checkin" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="checkout" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="request" options={{ presentation: 'fullScreenModal' }} />
        {/* Solo se lee (no tiene botones abajo): basta una hoja que se cierra deslizando. */}
        <Stack.Screen name="recap" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

/** Tocar un aviso abre lo suyo: "¿cómo te fue?" va a la pregunta de ese registro; el resumen, a la semana. */
function useOpenCheckoutFromNotification(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const open = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      if (data?.kind === 'recap') router.push('/recap');
      else if (typeof data?.checkinId === 'string') {
        router.push({ pathname: '/checkout/[id]', params: { id: data.checkinId } });
      }
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
