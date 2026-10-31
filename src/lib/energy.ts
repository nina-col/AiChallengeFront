import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * "Mi energía": tres veces al día, del 1 al 5, y cada número dice qué hacer. Es una herramienta
 * que la coach de Specialisterne ha visto sostenerse durante meses (notas de las juntas). Se queda
 * solo en el teléfono: es de la persona, no es una calificación y no hay rachas; un día sin
 * registro simplemente no tiene barras.
 */
export type Slot = 'morning' | 'midday' | 'afternoon';
export type EnergyEntry = { date: string; slot: Slot; level: number };

export const SLOTS: Slot[] = ['morning', 'midday', 'afternoon'];
const STORAGE_KEY = 'spaceease.energy.v1';
/** Tres meses alcanzan para ver cómo va; lo más viejo se suelta. */
const KEEP = 3 * 90;

export const slotFor = (hour: number): Slot => (hour < 12 ? 'morning' : hour < 16 ? 'midday' : 'afternoon');

const pad = (n: number) => String(n).padStart(2, '0');
/** Fecha local `AAAA-MM-DD`: la mañana de hoy es de hoy, sin importar la zona horaria. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Registra o corrige lo de ese momento del día: uno por momento, sin duplicados. */
export function recordEnergy(entries: readonly EnergyEntry[], entry: EnergyEntry): EnergyEntry[] {
  const others = entries.filter((e) => e.date !== entry.date || e.slot !== entry.slot);
  return [...others, entry].sort((a, b) => a.date.localeCompare(b.date) || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot)).slice(-KEEP);
}

/** Los últimos `days` días hasta `today`, del más viejo al más nuevo, con lo registrado en cada uno. */
export function lastDays(entries: readonly EnergyEntry[], today: Date, days = 7) {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - i));
    const key = dayKey(date);
    return { date, key, levels: SLOTS.map((slot) => entries.find((e) => e.date === key && e.slot === slot)?.level ?? null) };
  });
}

/** Lee del almacenamiento lo que tenga la forma correcta; lo demás se ignora. */
export function parseEntries(raw: string | null): EnergyEntry[] {
  try {
    const data = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(data)) return [];
    return data.filter(
      (e) => typeof e?.date === 'string' && SLOTS.includes(e?.slot) && Number.isInteger(e?.level) && e.level >= 1 && e.level <= 5,
    );
  } catch {
    return [];
  }
}

export function useEnergy() {
  const [entries, setEntries] = useState<EnergyEntry[]>([]);
  useEffect(() => {
    let current = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (current) setEntries(parseEntries(raw));
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);
  const record = useCallback((entry: EnergyEntry) => {
    setEntries((previous) => {
      const next = recordEnergy(previous, entry);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  return { entries, record };
}
