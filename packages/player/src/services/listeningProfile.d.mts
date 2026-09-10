import type { ProviderRef } from '@nuclearplayer/model';

export type ListenCounters = {
  playCount: number;
  skipCount: number;
  immediateSkipCount?: number;
  totalListenMs: number;
};

export type UserListenRecord = ListenCounters & {
  trackId: string;
  title: string;
  artist: string;
  durationMs: number;
  lastPlayedAt: number;
  firstPlayedAt: number;
  source?: ProviderRef;
  artistSource?: ProviderRef;
  genres?: string[];
  contributions?: Record<string, ListenCounters>;
};

export function normalizeListen(raw: unknown): UserListenRecord | null;
export function mergeListenRecords(local: unknown, remote: unknown): UserListenRecord[];
