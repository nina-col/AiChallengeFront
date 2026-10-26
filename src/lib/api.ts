/** URL base de la API. En builds y updates de EAS se puede sobrescribir con EXPO_PUBLIC_API_URL. */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://api-production-a0b6.up.railway.app';

export type Health = {
  status: 'ok' | 'degraded';
  database: 'ok' | 'unreachable';
  version: string;
  commit: string | null;
};

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const response = await fetch(`${API_URL}/health`, { signal });
  // Un 503 trae el mismo cuerpo, con la base de datos marcada como caída.
  if (!response.ok && response.status !== 503) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}
