import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/** Preferencias de este teléfono. Los valores por defecto son los de menor estímulo. */
export type RecapDay = 'off' | 'mon' | 'wed' | 'fri' | 'sun';

/** Día de la semana como lo cuenta iOS (1 = domingo). */
export type RecapHour = 9 | 13 | 17;
export const RECAP_HOURS: RecapHour[] = [9, 13, 17];

export const RECAP_WEEKDAY: Record<Exclude<RecapDay, 'off'>, number> = { sun: 1, mon: 2, wed: 4, fri: 6 };

export type Settings = {
  language: 'system' | 'es' | 'en';
  motion: 'system' | 'reduced';
  /** Modo "Con detalles": la escena en pixel art cobra vida y los logros se celebran. */
  details: boolean;
  /** Sonidos suaves de la interfaz. Siempre callan con el interruptor de silencio de iOS. */
  sounds: boolean;
  soundVolume: 'low' | 'medium';
  haptics: boolean;
  /** "Tu escritorio" en Hoy. Se puede ocultar; ocultarlo no borra nada. */
  showDesk: boolean;
  /** Cómo se ve cada lugar: su cuarto isométrico o solo la lista (la misma información). */
  placeView: 'room' | 'list';
  /** Resumen semanal opcional: el día y la hora que elija la persona. */
  recapDay: RecapDay;
  recapHour: RecapHour;
  /** Última vez que abrió el resumen (ms). Tras 5 semanas sin abrirlo, se pregunta si lo sigue queriendo. */
  recapSeenAt: number;
  /** Ya se ofreció el resumen al terminar una prueba (se ofrece una sola vez). */
  recapOffered: boolean;
  softContrast: boolean;
  /** Consentimientos separados para el escaneo; apagados hasta que la persona los active. */
  scanAudio: boolean;
  scanPhoto: boolean;
  onboarded: boolean;
  /** Ya se ofreció elegir cómo se ve y suena la app (en la bienvenida o con el aviso de Hoy). */
  experienceOffered: boolean;
};

const DEFAULTS: Settings = {
  language: 'system',
  motion: 'system',
  details: false,
  sounds: false,
  soundVolume: 'low',
  haptics: false,
  showDesk: true,
  placeView: 'room',
  recapDay: 'off',
  recapHour: 9,
  recapSeenAt: 0,
  recapOffered: false,
  softContrast: false,
  scanAudio: false,
  scanPhoto: false,
  onboarded: false,
  experienceOffered: false,
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
