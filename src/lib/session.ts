import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Llave anónima del dispositivo: 32 bytes aleatorios en hex, guardados en el llavero de iOS.
 * El servidor solo conoce su SHA-256. Sin llave no hay cuenta, y borrarla deja todo anónimo.
 */
const KEY_NAME = 'spaceease.device-key';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

let cached: string | null = null;

export async function getDeviceKey(): Promise<string | null> {
  cached ??= await SecureStore.getItemAsync(KEY_NAME, OPTIONS);
  return cached;
}

export async function createDeviceKey(): Promise<string> {
  const bytes = Crypto.getRandomBytes(32);
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEY_NAME, key, OPTIONS);
  cached = key;
  return key;
}

export async function forgetDeviceKey(): Promise<void> {
  cached = null;
  await SecureStore.deleteItemAsync(KEY_NAME, OPTIONS);
}
