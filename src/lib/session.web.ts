import * as Crypto from 'expo-crypto';
import { clearRatings } from '@/lib/helpfulness';

/** Browser-only session. Mobile continues to use the encrypted SecureStore adapter. */
const KEY_NAME = 'spaceease.device-key';
let cached: string | null = null;

export async function getDeviceKey(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  cached ??= window.sessionStorage.getItem(KEY_NAME);
  return cached;
}

export async function createDeviceKey(): Promise<string> {
  const bytes = Crypto.getRandomBytes(32);
  const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  // A new browser account must not inherit another session's local ratings.
  await clearRatings();
  window.sessionStorage.setItem(KEY_NAME, key);
  cached = key;
  return key;
}

export async function forgetDeviceKey(): Promise<void> {
  cached = null;
  window.sessionStorage.removeItem(KEY_NAME);
  await clearRatings();
}
