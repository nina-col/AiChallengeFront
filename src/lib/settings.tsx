import { confirmSaved } from '@/lib/save-notice';
import { APPEARANCE_DEFAULTS, appearanceFrom, type Appearance } from '@/lib/appearance';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';

/** Preferencias de este teléfono. Los valores por defecto son los de menor estímulo. */
export type RecapDay = 'off' | 'mon' | 'wed' | 'fri' | 'sun';

/** Día de la semana como lo cuenta iOS (1 = domingo). */
export type RecapHour = 9 | 13 | 17;
export const RECAP_HOURS: RecapHour[] = [9, 13, 17];

export const RECAP_WEEKDAY: Record<Exclude<RecapDay, 'off'>, number> = { sun: 1, mon: 2, wed: 4, fri: 6 };

export type Settings = Appearance & {
  language: 'system' | 'es' | 'en';
  motion: 'system' | 'reduced';
  /** Modo "Con detalles": la escena en pixel art cobra vida y los logros se celebran. */
  details: boolean;
  /** Sonidos suaves de la interfaz. Siempre callan con el interruptor de silencio de iOS. */
  sounds: boolean;
  soundVolume: 'low' | 'medium';
  haptics: boolean;
  /** Cómo se ve cada lugar: su cuarto isométrico o solo la lista (la misma información). */
  placeView: 'room' | 'list';
  /** Resumen semanal opcional: el día y la hora que elija la persona. */
  recapDay: RecapDay;
  recapHour: RecapHour;
  /** Última vez que abrió el resumen (ms). Tras 5 semanas sin abrirlo, se pregunta si lo sigue queriendo. */
  recapSeenAt: number;
  /** Ya se ofreció el resumen al terminar una prueba (se ofrece una sola vez). */
  recapOffered: boolean;
  /** Consentimientos separados para el escaneo; apagados hasta que la persona los active. */
  scanAudio: boolean;
  scanPhoto: boolean;
  onboarded: boolean;
  /** Ya se ofreció elegir cómo se ve y suena la app (en la bienvenida o con el aviso de Hoy). */
  experienceOffered: boolean;
};

const DEFAULTS: Settings = {
  ...APPEARANCE_DEFAULTS,
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
  saveAppearance: (appearance: Appearance) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const current = useRef(settings);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          current.current = { ...DEFAULTS, ...parsed, ...appearanceFrom(parsed) };
          setSettings(current.current);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  function update(patch: Partial<Settings>) {
    current.current = { ...current.current, ...patch };
    setSettings(current.current);
    writes.current = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current.current)));
    writes.current.catch(() => {});
  }

  async function saveAppearance(appearance: Appearance) {
    const patch = appearanceFrom(appearance);
    const operation = writes.current.catch(() => {}).then(async () => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current.current, ...patch }));
      current.current = { ...current.current, ...patch };
      setSettings(current.current);
      confirmSaved();
    });
    writes.current = operation;
    await operation;
  }

  async function reset() {
    await writes.current.catch(() => {});
    await AsyncStorage.removeItem(STORAGE_KEY);
    current.current = DEFAULTS;
    setSettings(DEFAULTS);
  }

  return <SettingsContext value={{ settings, ready, update, reset, saveAppearance }}>{children}</SettingsContext>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings necesita <SettingsProvider>');
  return value;
}

/** Draft appearance is isolated from live preferences and never persists on selection. */
export function AppearancePreview({ value, children }: { value: Appearance; children: ReactNode }) {
  const live = useSettings();
  return <SettingsContext value={{ ...live, settings: { ...live.settings, ...value } }}>{children}</SettingsContext>;
}
