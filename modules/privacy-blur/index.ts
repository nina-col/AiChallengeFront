import { requireOptionalNativeModule } from 'expo';

type PrivacyBlurModule = {
  /** Devuelve una copia de la foto con caras y siluetas pixeladas, y cuántas encontró. */
  pixelatePeople(uri: string): Promise<{ uri: string; people: number }>;
};

/**
 * `null` donde el módulo nativo no existe (Expo Go, Android). Ahí la foto no se envía a la IA:
 * sin pixelado en el teléfono, no sale ninguna imagen.
 */
export const privacyBlur = requireOptionalNativeModule<PrivacyBlurModule>('PrivacyBlur');
