import { useSettings } from '@/lib/settings';

import en from './en';
import es from './es';

export type Locale = 'es' | 'en';

/** Idioma del teléfono; cualquier variante de inglés usa inglés y todo lo demás, español. */
export function deviceLocale(): Locale {
  const tag = Intl.DateTimeFormat().resolvedOptions().locale ?? 'es';
  return tag.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function useLocale(): Locale {
  const { settings } = useSettings();
  return settings.language === 'system' ? deviceLocale() : settings.language;
}

export function useT() {
  return useLocale() === 'en' ? en : es;
}
