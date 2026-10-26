import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/** Preferencias de este teléfono. Los valores por defecto son los de menor estímulo. */
export type Settings = {
  language: 'system' | 'es' | 'en';
  motion: 'system' | 'reduced';
  haptics: boolean;
  softContrast: boolean;
  /** Consentimientos separados para el escaneo; apagados hasta que la persona los active. */
  scanAudio: boolean;
  scanPhoto: boolean;
  onboarded: boolean;
};

const DEFAULTS: Settings = {
  language: 'system',
  motion: 'system',
  haptics: false,
  softContrast: false,
  scanAudio: false,
  scanPhoto: false,
  onboarded: false,
};

const STORAGE_KEY = 'spaceease.settings.v1';

type SettingsContextValue = {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
  reset: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  function update(patch: Partial<Settings>) {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  async function reset() {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setSettings(DEFAULTS);
  }

  return <SettingsContext value={{ settings, ready, update, reset }}>{children}</SettingsContext>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings necesita <SettingsProvider>');
  return value;
}
