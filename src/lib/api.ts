import type { RoomLayout } from '@/components/room/types';
import type { Locale } from '@/i18n';
import { getDeviceKey } from '@/lib/session';
import type {
  Catalog,
  Checkin,
  CheckinStatus,
  CheckinWithProposal,
  Health,
  NewCheckin,
  OutcomeResult,
  PhotoScanResult,
  PlaceMemory,
  PlaybookEntry,
  Progress,
  Response,
  Space,
  SpaceKind,
} from '@/lib/types';

/** URL base de la API. En builds y updates de EAS se puede sobrescribir con EXPO_PUBLIC_API_URL. */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://api-production-a0b6.up.railway.app';

const TIMEOUT_MS = 15_000;

/** Versión del aviso de privacidad que se acepta en la bienvenida (GET /privacy en la API). */
export const CONSENT_VERSION = 1;
export const PRIVACY_URL = `${API_URL}/privacy`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
    /** El cuerpo de la respuesta de error (por ejemplo, la revisión actual en un 409). */
    readonly data?: Record<string, unknown> | null,
  ) {
    super(`HTTP ${status}${code ? ` (${code})` : ''}`);
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
};

async function request<T>(
  path: string,
  { method = 'GET', body, auth = true, timeoutMs = TIMEOUT_MS }: RequestOptions = {},
) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const key = await getDeviceKey();
    if (!key) throw new ApiError(401, 'no_device_key');
    headers.Authorization = `Bearer ${key}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new ApiError(response.status, data?.error, data);
    }
    return (response.status === 204 ? undefined : await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => request<Health>('/health', { auth: false }),
  login: (deviceKey: string, locale: Locale) =>
    request<{ user_id: string; created: boolean }>('/v1/auth/device', {
      method: 'POST',
      body: { device_key: deviceKey, locale, consent_version: CONSENT_VERSION },
      auth: false,
    }),
  updateLocale: (locale: Locale) => request<unknown>('/v1/me', { method: 'PATCH', body: { locale } }),
  deleteMe: () => request<void>('/v1/me', { method: 'DELETE' }),

  catalog: (locale: Locale) => request<Catalog>(`/v1/catalog?locale=${locale}`, { auth: false }),

  spaces: () => request<Space[]>('/v1/spaces'),
  createSpace: (name: string, kind: SpaceKind) =>
    request<Space>('/v1/spaces', { method: 'POST', body: { name, kind } }),
  deleteSpace: (id: string) => request<void>(`/v1/spaces/${id}`, { method: 'DELETE' }),

  createCheckin: (body: NewCheckin) =>
    request<CheckinWithProposal>('/v1/checkins', { method: 'POST', body }),
  decline: (id: string, reason: 'other_idea' | 'cannot_here') =>
    request<CheckinWithProposal>(`/v1/checkins/${id}/decline`, { method: 'POST', body: { reason } }),
  accept: (id: string, remindInMinutes: number | null) =>
    request<Checkin>(`/v1/checkins/${id}/accept`, {
      method: 'POST',
      body: { remind_in_minutes: remindInMinutes },
    }),
  outcome: (id: string, answers: { discomfort: number; effort: number; attribution: Response }) =>
    request<OutcomeResult>(`/v1/checkins/${id}/outcome`, {
      method: 'POST',
      body: {
        discomfort_after: answers.discomfort,
        effort_after: answers.effort,
        attribution: answers.attribution,
      },
    }),
  abandon: (id: string) => request<Checkin>(`/v1/checkins/${id}/abandon`, { method: 'POST' }),
  checkins: (status?: CheckinStatus) =>
    request<Checkin[]>(`/v1/checkins${status ? `?status=${status}` : ''}`),
  checkin: (id: string) => request<Checkin>(`/v1/checkins/${id}`),

  playbook: () => request<PlaybookEntry[]>('/v1/playbook'),
  progress: () => request<Progress>('/v1/progress'),
  memory: (spaceId: string) => request<PlaceMemory>(`/v1/spaces/${spaceId}/memory`),
  /** "Este lugar cambió": el motor solo usa las pruebas de aquí desde ahora. No borra nada. */
  resetSpace: (spaceId: string) => request<void>(`/v1/spaces/${spaceId}/reset`, { method: 'POST' }),
  /** 404 si el lugar todavía no tiene cuarto (la app arma uno por defecto). */
  room: (spaceId: string) => request<{ revision: number; layout: unknown }>(`/v1/spaces/${spaceId}/room`),
  /** `revision`: la que se leyó (0 para crear). 409 si alguien guardó antes; 422 si el layout no es válido. */
  saveRoom: (spaceId: string, revision: number, layout: RoomLayout) =>
    request<{ revision: number }>(`/v1/spaces/${spaceId}/room`, { method: 'PUT', body: { revision, layout } }),

  /** La IA tarda ~10 s en mirar la foto: este pedido tiene su propio tiempo límite. */
  scanPhoto: (imageBase64: string, task: string, audio: string[]) =>
    request<PhotoScanResult>('/v1/scan/photo', {
      method: 'POST',
      body: { image_base64: imageBase64, task, audio },
      timeoutMs: 60_000,
    }),
};
