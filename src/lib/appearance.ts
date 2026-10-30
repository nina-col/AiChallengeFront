/** Persisted preferences; no diagnosis or user profile is required. */
export type Appearance = {
  themeMode: 'system' | 'light' | 'dark';
  palette: 'forest' | 'ocean' | 'lavender';
  font: 'system' | 'atkinson' | 'lexend';
  textSize: 'standard' | 'large' | 'extraLarge';
  readingSpacing: 'normal' | 'wide';
  showMascot: boolean;
  showDesk: boolean;
  softContrast: boolean;
  focusMode: boolean;
};

export const APPEARANCE_DEFAULTS: Appearance = {
  themeMode: 'system', palette: 'forest', font: 'system', textSize: 'standard',
  readingSpacing: 'normal', showMascot: true, showDesk: true, softContrast: false, focusMode: false,
};

/** Validate persisted data and migrate installations that predate these preferences. */
export function appearanceFrom(value: unknown): Appearance {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result = { ...APPEARANCE_DEFAULTS };
  const choices = {
    themeMode: ['system', 'light', 'dark'], palette: ['forest', 'ocean', 'lavender'],
    font: ['system', 'atkinson', 'lexend'], textSize: ['standard', 'large', 'extraLarge'],
    readingSpacing: ['normal', 'wide'],
  };
  for (const key of Object.keys(result) as (keyof Appearance)[]) {
    const current = source[key];
    if (key in choices) {
      if ((choices[key as keyof typeof choices] as readonly unknown[]).includes(current)) Object.assign(result, { [key]: current });
    } else if (typeof current === 'boolean') Object.assign(result, { [key]: current });
  }
  return result;
}

export function isDarkAppearance(appearance: Appearance, system: string | null | undefined) {
  return appearance.themeMode === 'dark' || (appearance.themeMode === 'system' && system === 'dark');
}
