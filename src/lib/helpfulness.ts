import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import type { Response } from '@/lib/types';

export const RATINGS_KEY = 'spaceease.helpfulness.v1';
export const ratingsQuery = ['local-helpfulness'] as const;
export type Rating = {
  id: string;
  adjustment: string;
  task: string;
  space: string | null;
  score: number | null;
  at: number;
};

/** Keep uncertainty distinct; any positive level means the person reported some benefit. */
export function ratingAttribution(score: number | null): Response {
  return score === null ? 'unsure' : score === 1 ? 'no' : 'yes';
}

export async function readRatings(): Promise<Rating[]> {
  const raw = JSON.parse(await AsyncStorage.getItem(RATINGS_KEY) ?? '[]');
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is Rating =>
    !!r && typeof r.id === 'string' && typeof r.adjustment === 'string' && typeof r.task === 'string'
    && (r.space === null || typeof r.space === 'string')
    && (r.score === null || Number.isInteger(r.score) && r.score >= 1 && r.score <= 5)
    && Number.isFinite(r.at));
}

// Serialize read-modify-write operations so two completed trials cannot overwrite each other.
let writes = Promise.resolve();
export function saveRating(rating: Rating) {
  const next = writes.catch(() => {}).then(async () => {
    const records = await readRatings();
    await AsyncStorage.setItem(RATINGS_KEY, JSON.stringify([rating, ...records.filter(r => r.id !== rating.id)]));
  });
  writes = next;
  return next;
}

export function useRatings() {
  return useQuery({ queryKey: ratingsQuery, queryFn: readRatings });
}

export function latestRating(records: Rating[] | undefined, adjustment: string, task: string, space: string | null) {
  return records?.filter(r => r.adjustment === adjustment && r.task === task && r.space === space)
    .sort((a, b) => b.at - a.at)[0];
}

export async function clearRatings() {
  await writes.catch(() => {});
  await AsyncStorage.removeItem(RATINGS_KEY);
}
