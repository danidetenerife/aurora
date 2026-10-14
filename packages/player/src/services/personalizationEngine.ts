import type { Track } from '@aurora/model';

import { useFavoritesStore } from '../stores/favoritesStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useQueueStore } from '../stores/queueStore';
import { useSoundStore } from '../stores/soundStore';
import { eventBus } from './eventBus';
import {
  mergeListenRecords,
  type UserListenRecord,
} from './listeningProfile.mjs';
import { Logger } from './logger';
import { metadataHost } from './metadataHost';
import { createUniversalStore, type UniversalStore } from './universalStore';

export type { UserListenRecord } from './listeningProfile.mjs';

const SKIP_THRESHOLD_MS = 30_000;
const IMMEDIATE_SKIP_THRESHOLD_MS = 8_000;
const COMPLETION_RATIO_THRESHOLD = 0.8;
const CHECKPOINT_MS = 60_000;
const DEFAULT_DURATION_MS = 180_000;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY = 86_400_000;
const RECENCY_HALF_LIFE_DAYS = 21;
const SHORT_TERM_HALF_LIFE_DAYS = 2;
const REPLAY_WINDOW_DAYS = 1;
const COOLDOWN_WINDOW_MS = 4 * 60 * 60 * 1000;
const COLLABORATOR_AFFINITY_WEIGHT = 0.65;
const COLLABORATION_SYNERGY_MULTIPLIER = 1.28;
const DAYPART_RESONANCE_MULTIPLIER = 1.12;
const SESSION_MOMENTUM_MULTIPLIER = 1.18;
const SESSION_SKIP_DECAY_BASE = 0.45;
const OVER_COMPLETION_THRESHOLD = 1.05;
const MAX_OVER_COMPLETION_BONUS = 1.35;

export type Daypart = 'morning' | 'afternoon' | 'evening' | 'night';

export type ArtistScore = {
  name: string;
  score: number;
  spotifyUri?: string;
  genres?: string[];
};

export type GenreScore = {
  genre: string;
  score: number;
};

type ListeningSession = {
  track: Track;
  listenedMs: number;
  savedMs: number;
  countedPlay: boolean;
  position: number;
};

export const cleanTrackTitle = (rawTitle: string): string =>
  rawTitle
    .toLowerCase()
    .replace(
      /\s*[([](?:official\s*(?:music\s*)?(?:video|audio|lyric\s*video|visualizer)|lyric\s*video|visualizer|audio|video\s*oficial|hd|hq|4k|remaster(?:ed)?(?:\s*\d{4})?|live(?:\s*at\s*[^)\]]*)?)[)\]]/gi,
      '',
    )
    .replace(/\s*-\s*remaster(?:ed)?(?:\s*\d{4})?\b/gi, '')
    .replace(/\s*[([]?(?:feat\.?|ft\.?)\s+[^)\]]+[)\]]?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeTrackSignature = (track: {
  title?: string;
  artists?: Array<{ name?: string }>;
}): string => {
  const primaryArtist = (track.artists?.[0]?.name ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const normalizedTitle = cleanTrackTitle(track.title ?? '');
  return normalizedTitle ? `${primaryArtist}::${normalizedTitle}` : '';
};

const getDaypart = (timestampMs: number): Daypart => {
  const hour = new Date(timestampMs).getHours();
  if (hour >= 5 && hour < 12) {
    return 'morning';
  }
  if (hour >= 12 && hour < 18) {
    return 'afternoon';
  }
  if (hour >= 18 && hour < 23) {
    return 'evening';
  }
  return 'night';
};

const exponentialDecay = (daysAgo: number): number =>
  Math.exp((-Math.LN2 * daysAgo) / RECENCY_HALF_LIFE_DAYS);

const shortTermDecay = (daysAgo: number): number =>
  Math.exp((-Math.LN2 * daysAgo) / SHORT_TERM_HALF_LIFE_DAYS);

const dualHorizonRecency = (daysAgo: number): number =>
  exponentialDecay(daysAgo) * 0.75 + shortTermDecay(daysAgo) * 0.25;

const completionRate = (record: UserListenRecord): number => {
  const durationMs = record.durationMs;
  const playCount = record.playCount;
  const totalListenMs = record.totalListenMs;

  if (
    !Number.isFinite(durationMs) ||
    !Number.isFinite(playCount) ||
    !Number.isFinite(totalListenMs) ||
    durationMs <= 0 ||
    playCount <= 0
  ) {
    return 0;
  }
  const ratio = totalListenMs / (playCount * durationMs);
  return Math.max(0, Math.min(1, ratio));
};

const overCompletionMultiplier = (record: UserListenRecord): number => {
  if (
    !Number.isFinite(record.durationMs) ||
    !Number.isFinite(record.playCount) ||
    !Number.isFinite(record.totalListenMs) ||
    record.durationMs <= 0 ||
    record.playCount <= 0
  ) {
    return 1.0;
  }
  const rawRatio =
    record.totalListenMs / (record.playCount * record.durationMs);
  if (rawRatio <= OVER_COMPLETION_THRESHOLD) {
    return 1.0;
  }
  return Math.min(MAX_OVER_COMPLETION_BONUS, 1 + (rawRatio - 1) * 0.5);
};

const loyaltyBonus = (record: UserListenRecord): number => {
  if (
    !record.firstPlayedAt ||
    !Number.isFinite(record.firstPlayedAt) ||
    record.firstPlayedAt <= 0
  ) {
    return 0;
  }
  const days = Math.max(
    0,
    (Date.now() - record.firstPlayedAt) / MILLISECONDS_PER_DAY,
  );
  return Math.min(3.0, Math.log2(1 + days));
};

const getDeterministicJitter = (trackId: string, seed: number = 0): number => {
  const rotationSalt =
    seed > 0 ? seed : Math.floor(Date.now() / (1000 * 60 * 60 * 2));
  let hash = 0;
  const identifier = `${trackId}:${rotationSalt}`;
  for (let index = 0; index < identifier.length; index++) {
    hash = (hash << 5) - hash + identifier.charCodeAt(index);
    hash |= 0;
  }
  return 0.75 + ((Math.abs(hash) % 1000) / 1000) * 0.5;
};

export class PersonalizationEngine {
  private static instance: PersonalizationEngine;
  private pendingWrite: Promise<void> = Promise.resolve();
  private session: ListeningSession | null = null;
  private listeners = new Set<(origin: 'local' | 'remote') => void>();
  private unsubscribe: Array<() => void> = [];
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveSkips = 0;
  private sessionSkippedArtists = new Map<string, number>();
  private sessionCompletedArtists = new Set<string>();
  private artistResolutionCache = new Map<
    string,
    { spotifyUri?: string; genres: string[] }
  >();

  constructor(
    private readonly profileStore: UniversalStore = createUniversalStore(
      'user_profile.json',
    ),
  ) {}

  start(): () => void {
    if (this.unsubscribe.length) {
      return () => this.stop();
    }
    this.unsubscribe = [
      eventBus.on('trackStarted', async (track) => {
        if (!track) {
          return;
        }
        if (this.session?.track.source.id === track.source.id) {
          return;
        }
        this.finishSession(false);
        this.beginSession(track, useSoundStore.getState().seek);
      }),
      eventBus.on('trackFinished', async () => this.finishSession(true)),
      eventBus.on('playbackSkipped', async () =>
        this.finishSession(false, true),
      ),
      eventBus.on('playbackSeeked', async ({ toMs }) => {
        if (this.session) {
          this.session.position = toMs / MILLISECONDS_PER_SECOND;
        }
      }),
      useSoundStore.subscribe((state, previous) => {
        if (!this.session && state.status === 'playing' && state.src) {
          const track = useQueueStore.getState().getCurrentItem()?.track;
          if (track) {
            this.beginSession(track, state.seek);
          }
        }
        const session = this.session;
        if (!session) {
          return;
        }
        const deltaMs =
          (state.seek - session.position) * MILLISECONDS_PER_SECOND;
        if (
          previous.status === 'playing' &&
          state.src === previous.src &&
          deltaMs > 0
        ) {
          session.listenedMs += deltaMs;
        }
        session.position = state.seek;
        if (state.duration > 0) {
          session.track = {
            ...session.track,
            durationMs: state.duration * MILLISECONDS_PER_SECOND,
          };
        }
        if (state.status === 'stopped') {
          this.finishSession(false);
        } else if (
          state.status === 'paused' ||
          (!session.countedPlay && session.listenedMs >= SKIP_THRESHOLD_MS) ||
          session.listenedMs - session.savedMs >= CHECKPOINT_MS
        ) {
          this.saveSession(session, false, false);
        }
      }),
      useFavoritesStore.subscribe((state, previous) => {
        if (
          state.tracks !== previous.tracks ||
          state.artists !== previous.artists
        ) {
          this.notify('local');
        }
      }),
      usePlaylistStore.subscribe((state, previous) => {
        if (state.playlists !== previous.playlists) {
          this.notify('local');
        }
      }),
    ];
    return () => this.stop();
  }

  stop(): void {
    this.finishSession(false);
    this.unsubscribe.forEach((unsubscribe) => unsubscribe());
    this.unsubscribe = [];
  }

  subscribe = (
    listener: (origin: 'local' | 'remote') => void,
  ): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify(origin: 'local' | 'remote'): void {
    this.listeners.forEach((listener) => listener(origin));
  }

  private beginSession(track: Track, position: number): void {
    this.session = {
      track,
      listenedMs: 0,
      savedMs: 0,
      countedPlay: false,
      position,
    };
  }

  private finishSession(completed: boolean, skipped = false): void {
    const session = this.session;
    this.session = null;
    if (skipped) {
      this.consecutiveSkips++;
    } else if (completed) {
      this.consecutiveSkips = 0;
    }
    if (session) {
      this.saveSession(session, completed, skipped);
    }
  }

  private saveSession(
    session: ListeningSession,
    completed: boolean,
    skipped: boolean,
  ): void {
    const durationMs = session.track.durationMs ?? DEFAULT_DURATION_MS;
    const isNearlyComplete =
      durationMs > 0 &&
      session.listenedMs >= durationMs * COMPLETION_RATIO_THRESHOLD;
    const effectiveCompleted = completed || isNearlyComplete;

    const playCount =
      !session.countedPlay &&
      session.listenedMs > 0 &&
      (effectiveCompleted || session.listenedMs >= SKIP_THRESHOLD_MS)
        ? 1
        : 0;

    const skipCount =
      skipped && !effectiveCompleted && session.listenedMs < SKIP_THRESHOLD_MS
        ? 1
        : 0;

    const immediateSkipCount =
      skipped &&
      !effectiveCompleted &&
      session.listenedMs < IMMEDIATE_SKIP_THRESHOLD_MS
        ? 1
        : 0;

    const listenMs = Math.max(0, session.listenedMs - session.savedMs);
    session.savedMs = session.listenedMs;
    session.countedPlay ||= playCount > 0;

    const isMajorEvent =
      playCount > 0 || skipCount > 0 || immediateSkipCount > 0 || completed;

    if (listenMs || playCount || skipCount || immediateSkipCount) {
      void this.recordListening(
        session.track,
        listenMs,
        playCount,
        skipCount,
        immediateSkipCount,
        isMajorEvent,
      ).catch((error) => {
        void Logger.history.error(
          'Unable to save listening profile: ' + String(error),
        );
      });
    }
  }

  static getInstance(): PersonalizationEngine {
    if (!this.instance) {
      this.instance = new PersonalizationEngine();
    }
    return this.instance;
  }

  async getListenRecords(): Promise<UserListenRecord[]> {
    await this.pendingWrite;
    return mergeListenRecords(await this.profileStore.get('listens'), []);
  }

  private mutate(
    update: (records: UserListenRecord[]) => Promise<UserListenRecord[]>,
    origin: 'local' | 'remote',
    persistImmediately = true,
    notifyListeners = true,
  ): Promise<void> {
    const write = this.pendingWrite.then(async () => {
      const records = mergeListenRecords(
        await this.profileStore.get('listens'),
        [],
      );
      const updated = await update(records);
      if (JSON.stringify(updated) === JSON.stringify(records)) {
        return;
      }
      await this.profileStore.set('listens', updated);
      if (persistImmediately) {
        if (this.saveDebounceTimer) {
          clearTimeout(this.saveDebounceTimer);
          this.saveDebounceTimer = null;
        }
        await this.profileStore.save();
      } else {
        if (!this.saveDebounceTimer) {
          this.saveDebounceTimer = setTimeout(() => {
            this.saveDebounceTimer = null;
            void this.profileStore.save();
          }, 2000);
        }
      }
      if (notifyListeners) {
        this.notify(origin);
      }
    });
    this.pendingWrite = write.catch(() => undefined);
    return write;
  }

  async flushPendingSaves(): Promise<void> {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    await this.pendingWrite;
    await this.profileStore.save();
  }

  async mergeRemoteListens(remoteListens: UserListenRecord[]): Promise<void> {
    await this.mutate(
      async (local) => mergeListenRecords(local, remoteListens),
      'remote',
    );
  }

  async recordPlay(
    track: Track,
    completed: boolean,
    listenMs = track.durationMs ?? DEFAULT_DURATION_MS,
  ): Promise<void> {
    const isImmediate = !completed && listenMs < IMMEDIATE_SKIP_THRESHOLD_MS;
    await this.recordListening(
      track,
      listenMs,
      completed ? 1 : 0,
      completed ? 0 : 1,
      isImmediate ? 1 : 0,
      true,
    );
  }

  private recordListening(
    track: Track,
    listenMs: number,
    playCount: number,
    skipCount: number,
    immediateSkipCount = 0,
    persistImmediately = true,
  ): Promise<void> {
    const primaryArtistKey = (track.artists[0]?.name || '')
      .toLowerCase()
      .trim();
    if (playCount > 0) {
      for (const artistEntry of track.artists ?? []) {
        const normalizedKey = artistEntry.name.toLowerCase().trim();
        if (normalizedKey) {
          this.sessionSkippedArtists.delete(normalizedKey);
          this.sessionCompletedArtists.add(normalizedKey);
        }
      }
    } else if (skipCount > 0 && primaryArtistKey) {
      this.sessionSkippedArtists.set(
        primaryArtistKey,
        (this.sessionSkippedArtists.get(primaryArtistKey) ?? 0) + 1,
      );
    }

    const notifyListeners = persistImmediately;
    return this.mutate(
      async (records) => {
        let deviceId = await this.profileStore.get<string>('deviceId');
        if (!deviceId) {
          deviceId = crypto.randomUUID();
          await this.profileStore.set('deviceId', deviceId);
        }
        const artistName = track.artists[0]?.name || 'Unknown';
        const collaborators = (track.artists ?? [])
          .slice(1)
          .map((artistEntry) => artistEntry.name.trim())
          .filter((name) => name.length > 0 && name !== artistName);
        const trackGenres = (track.tags ?? [])
          .map((tag) => tag.toLowerCase().trim())
          .filter((tag) => tag.length > 0);
        const trackId = track.source.id || artistName + '-' + track.title;
        const existing = records.find((record) => record.trackId === trackId);
        const counters = existing?.contributions?.[deviceId];
        const now = Date.now();
        const mergedCollaborators = Array.from(
          new Set([...(existing?.collaborators ?? []), ...collaborators]),
        );
        const mergedGenres = Array.from(
          new Set([...(existing?.genres ?? []), ...trackGenres]),
        );
        const updated: UserListenRecord = {
          ...existing,
          trackId,
          title: track.title,
          artist: artistName,
          source: track.source,
          artistSource: track.artists[0]?.source,
          ...(mergedCollaborators.length > 0
            ? { collaborators: mergedCollaborators }
            : {}),
          ...(mergedGenres.length > 0 ? { genres: mergedGenres } : {}),
          durationMs: track.durationMs ?? DEFAULT_DURATION_MS,
          firstPlayedAt: existing?.firstPlayedAt ?? now,
          lastPlayedAt: now,
          playCount: 0,
          skipCount: 0,
          immediateSkipCount: 0,
          totalListenMs: 0,
          contributions: {
            ...existing?.contributions,
            [deviceId]: {
              playCount: (counters?.playCount ?? 0) + playCount,
              skipCount: (counters?.skipCount ?? 0) + skipCount,
              immediateSkipCount:
                (counters?.immediateSkipCount ?? 0) + immediateSkipCount,
              totalListenMs: (counters?.totalListenMs ?? 0) + listenMs,
            },
          },
        };
        return mergeListenRecords(records, [updated]);
      },
      'local',
      persistImmediately,
      notifyListeners,
    );
  }

  async getBlacklist(): Promise<{ tracks: string[]; artists: string[] }> {
    await this.pendingWrite;
    const tracks =
      (await this.profileStore.get<string[]>('blacklistedTracks')) ?? [];
    const artists =
      (await this.profileStore.get<string[]>('blacklistedArtists')) ?? [];
    return { tracks, artists };
  }

  async blacklistTrack(trackId: string): Promise<void> {
    await this.pendingWrite;
    const current =
      (await this.profileStore.get<string[]>('blacklistedTracks')) ?? [];
    if (!current.includes(trackId)) {
      await this.profileStore.set('blacklistedTracks', [...current, trackId]);
      await this.profileStore.save();
      this.notify('local');
    }
  }

  async blacklistArtist(artistName: string): Promise<void> {
    await this.pendingWrite;
    const normalized = artistName.trim().toLowerCase();
    const current =
      (await this.profileStore.get<string[]>('blacklistedArtists')) ?? [];
    if (!current.includes(normalized)) {
      await this.profileStore.set('blacklistedArtists', [
        ...current,
        normalized,
      ]);
      await this.profileStore.save();
      this.notify('local');
    }
  }

  async unblacklistTrack(trackId: string): Promise<void> {
    await this.pendingWrite;
    const current =
      (await this.profileStore.get<string[]>('blacklistedTracks')) ?? [];
    await this.profileStore.set(
      'blacklistedTracks',
      current.filter((id) => id !== trackId),
    );
    await this.profileStore.save();
    this.notify('local');
  }

  async unblacklistArtist(artistName: string): Promise<void> {
    await this.pendingWrite;
    const normalized = artistName.trim().toLowerCase();
    const current =
      (await this.profileStore.get<string[]>('blacklistedArtists')) ?? [];
    await this.profileStore.set(
      'blacklistedArtists',
      current.filter((name) => name !== normalized),
    );
    await this.profileStore.save();
    this.notify('local');
  }

  async mergeRemoteBlacklist(
    tracks: string[] = [],
    artists: string[] = [],
  ): Promise<void> {
    await this.pendingWrite;
    const currentTracks =
      (await this.profileStore.get<string[]>('blacklistedTracks')) ?? [];
    const currentArtists =
      (await this.profileStore.get<string[]>('blacklistedArtists')) ?? [];

    const normalizedArtists = artists
      .filter(
        (artistItem) =>
          typeof artistItem === 'string' && artistItem.trim().length > 0,
      )
      .map((artistItem) => artistItem.trim().toLowerCase());
    const validTracks = tracks.filter(
      (trackItem) =>
        typeof trackItem === 'string' && trackItem.trim().length > 0,
    );

    const mergedTracks = Array.from(
      new Set([...currentTracks, ...validTracks]),
    );
    const mergedArtists = Array.from(
      new Set([...currentArtists, ...normalizedArtists]),
    );

    let changed = false;
    if (mergedTracks.length !== currentTracks.length) {
      await this.profileStore.set('blacklistedTracks', mergedTracks);
      changed = true;
    }
    if (mergedArtists.length !== currentArtists.length) {
      await this.profileStore.set('blacklistedArtists', mergedArtists);
      changed = true;
    }

    if (changed) {
      await this.profileStore.save();
      this.notify('remote');
    }
  }

  async isBlacklisted(track: Track): Promise<boolean> {
    const { tracks, artists } = await this.getBlacklist();
    const trackId =
      track.source?.id || `${track.artists?.[0]?.name}-${track.title}`;
    if (tracks.includes(trackId)) {
      return true;
    }
    return (track.artists ?? []).some((artistEntry) =>
      artists.includes(artistEntry.name.toLowerCase().trim()),
    );
  }

  async resolveArtistMetadata(
    artistName: string,
  ): Promise<{ spotifyUri?: string; genres: string[] }> {
    const key = artistName.toLowerCase().trim();
    if (!key || key === 'unknown') {
      return { genres: [] };
    }
    if (this.artistResolutionCache.has(key)) {
      return this.artistResolutionCache.get(key)!;
    }

    try {
      const searchResults = await metadataHost.search({
        query: artistName,
        types: ['artists'],
        limit: 1,
      });
      const foundArtist = searchResults.artists?.[0];
      if (foundArtist?.source?.id) {
        const uri = foundArtist.source.id;
        let genres: string[] = [];
        try {
          const bio = await metadataHost.fetchArtistBio(uri);
          if (bio?.tags && Array.isArray(bio.tags)) {
            genres = bio.tags
              .map((tagItem) => tagItem.toLowerCase().trim())
              .filter(Boolean);
          }
        } catch {
          genres = [];
        }
        const resolved = { spotifyUri: uri, genres };
        this.artistResolutionCache.set(key, resolved);
        return resolved;
      }
    } catch {
      const emptyFallback = { genres: [] };
      this.artistResolutionCache.set(key, emptyFallback);
      return emptyFallback;
    }

    const fallback = { genres: [] };
    this.artistResolutionCache.set(key, fallback);
    return fallback;
  }

  async getTopArtists(): Promise<ArtistScore[]> {
    const listens = await this.getListenRecords();
    const favState = useFavoritesStore.getState();
    const playlistState = usePlaylistStore.getState();
    const { artists: blacklistedArtists } = await this.getBlacklist();

    const artistScores: Record<string, ArtistScore> = {};

    const ensureArtist = (name: string): ArtistScore => {
      if (!artistScores[name]) {
        const cached = this.artistResolutionCache.get(
          name.toLowerCase().trim(),
        );
        artistScores[name] = {
          name,
          score: 0,
          genres: cached?.genres ? [...cached.genres] : [],
          spotifyUri: cached?.spotifyUri,
        };
      }
      return artistScores[name];
    };

    const now = Date.now();

    for (const record of listens) {
      if (!record.artist || record.artist === 'Unknown') {
        continue;
      }

      const daysAgo = Math.max(
        0,
        (now - record.lastPlayedAt) / MILLISECONDS_PER_DAY,
      );
      const recencyWeight = dualHorizonRecency(daysAgo);
      const completion = completionRate(record);
      const loopBonus = overCompletionMultiplier(record);
      const loyalty = loyaltyBonus(record);

      const isReplayIn24h =
        daysAgo <= REPLAY_WINDOW_DAYS && record.playCount > 1;
      const replayMultiplier = isReplayIn24h ? 2.5 : 1.0;

      const immediateSkips = record.immediateSkipCount ?? 0;
      const immediatePenalty =
        immediateSkips > 0 ? Math.pow(0.25, immediateSkips) : 1.0;

      const skipPenalty =
        record.skipCount > 0
          ? Math.max(
              0.2,
              1 -
                (record.skipCount / (record.playCount + record.skipCount)) *
                  0.6,
            )
          : 1;

      const score =
        record.playCount *
        Math.pow(completion, 2) *
        recencyWeight *
        (1 + loyalty * 0.3) *
        replayMultiplier *
        loopBonus *
        skipPenalty *
        immediatePenalty;

      if (!blacklistedArtists.includes(record.artist.toLowerCase().trim())) {
        const entry = ensureArtist(record.artist);
        entry.score += score;

        if (record.artistSource?.provider === 'spotify') {
          entry.spotifyUri = record.artistSource.id;
        }

        if (record.genres && record.genres.length > 0) {
          entry.genres = Array.from(
            new Set([...(entry.genres ?? []), ...record.genres]),
          );
        }
      }

      for (const collaborator of record.collaborators ?? []) {
        const cleanCollaborator = collaborator.trim();
        if (
          !cleanCollaborator ||
          cleanCollaborator === 'Unknown' ||
          blacklistedArtists.includes(cleanCollaborator.toLowerCase())
        ) {
          continue;
        }
        const collabEntry = ensureArtist(cleanCollaborator);
        collabEntry.score += score * COLLABORATOR_AFFINITY_WEIGHT;
        if (record.genres && record.genres.length > 0) {
          collabEntry.genres = Array.from(
            new Set([...(collabEntry.genres ?? []), ...record.genres]),
          );
        }
      }
    }

    for (const favTrack of favState.tracks) {
      const daysAgo = favTrack.addedAtIso
        ? Math.max(
            0,
            (now - new Date(favTrack.addedAtIso).getTime()) /
              MILLISECONDS_PER_DAY,
          )
        : 30;
      const trackDecay = dualHorizonRecency(daysAgo);
      (favTrack.ref.artists ?? []).forEach((artistEntry, index) => {
        const artistName = artistEntry.name;
        if (
          artistName &&
          !blacklistedArtists.includes(artistName.toLowerCase().trim())
        ) {
          const weight = index === 0 ? 15 : 15 * COLLABORATOR_AFFINITY_WEIGHT;
          const scoredEntry = ensureArtist(artistName);
          scoredEntry.score += weight * trackDecay;
          if (
            artistEntry.source?.provider === 'spotify' &&
            !scoredEntry.spotifyUri
          ) {
            scoredEntry.spotifyUri = artistEntry.source.id;
          }
        }
      });
    }

    for (const favArtist of favState.artists) {
      const artist = favArtist.ref.name;
      if (artist && !blacklistedArtists.includes(artist.toLowerCase().trim())) {
        const entry = ensureArtist(artist);
        entry.score += 25;
        if (favArtist.ref.source?.provider === 'spotify') {
          entry.spotifyUri = favArtist.ref.source.id;
        }
      }
    }

    playlistState.playlists.forEach((playlist) => {
      for (const item of playlist.items || []) {
        (item.track?.artists ?? []).forEach((artistEntry, index) => {
          const artist = artistEntry.name;
          if (
            artist &&
            !blacklistedArtists.includes(artist.toLowerCase().trim())
          ) {
            const entry = ensureArtist(artist);
            entry.score += index === 0 ? 5 : 5 * COLLABORATOR_AFFINITY_WEIGHT;
            const artistSource = artistEntry.source;
            if (artistSource?.provider === 'spotify' && !entry.spotifyUri) {
              entry.spotifyUri = artistSource.id;
            }
          }
        });
      }
    });

    const sorted = Object.values(artistScores)
      .filter((artist) => artist.score > 0)
      .sort((first, second) => second.score - first.score);

    sorted.slice(0, 5).forEach((artist) => {
      if (!artist.spotifyUri || !artist.genres || artist.genres.length === 0) {
        void this.resolveArtistMetadata(artist.name).then((meta) => {
          if (meta.spotifyUri && !artist.spotifyUri) {
            artist.spotifyUri = meta.spotifyUri;
          }
          if (meta.genres && meta.genres.length > 0) {
            artist.genres = Array.from(
              new Set([...(artist.genres ?? []), ...meta.genres]),
            );
          }
        });
      }
    });

    return sorted;
  }

  async getTopArtistNames(): Promise<string[]> {
    const scored = await this.getTopArtists();
    return scored.map((entry) => entry.name);
  }

  async getTopGenres(limit = 10): Promise<GenreScore[]> {
    const topArtists = await this.getTopArtists();
    const genreMap = new Map<string, number>();

    for (const artist of topArtists) {
      for (const genre of artist.genres ?? []) {
        const clean = genre.toLowerCase().trim();
        if (clean.length > 1) {
          genreMap.set(clean, (genreMap.get(clean) ?? 0) + artist.score);
        }
      }
    }

    return Array.from(genreMap.entries())
      .map(([genre, score]) => ({ genre, score }))
      .sort((first, second) => second.score - first.score)
      .slice(0, limit);
  }

  async getSeedTracks(limit = 10): Promise<Track[]> {
    const listens = await this.getListenRecords();
    const { tracks: blacklistedTracks, artists: blacklistedArtists } =
      await this.getBlacklist();
    const now = Date.now();

    const learnedSeeds: Track[] = listens
      .filter((record) => {
        if (record.playCount <= 0 || completionRate(record) <= 0.5) {
          return false;
        }
        if (blacklistedTracks.includes(record.trackId)) {
          return false;
        }
        if (blacklistedArtists.includes(record.artist.toLowerCase().trim())) {
          return false;
        }
        return true;
      })
      .sort((first, second) => {
        const firstScore =
          first.playCount *
          completionRate(first) *
          overCompletionMultiplier(first) *
          dualHorizonRecency(
            Math.max(0, (now - first.lastPlayedAt) / MILLISECONDS_PER_DAY),
          );
        const secondScore =
          second.playCount *
          completionRate(second) *
          overCompletionMultiplier(second) *
          dualHorizonRecency(
            Math.max(0, (now - second.lastPlayedAt) / MILLISECONDS_PER_DAY),
          );
        return secondScore - firstScore;
      })
      .slice(0, limit)
      .map((record) => ({
        title: record.title,
        artists: [
          { name: record.artist, roles: [], source: record.artistSource },
          ...(record.collaborators ?? []).map((collaborator) => ({
            name: collaborator,
            roles: [],
          })),
        ],
        source: record.source ?? { provider: 'unknown', id: record.trackId },
        durationMs: record.durationMs,
        artwork: undefined,
      }));

    if (learnedSeeds.length >= limit) {
      return learnedSeeds;
    }

    const seenSignatures = new Set(
      learnedSeeds.map((seedTrack) => normalizeTrackSignature(seedTrack)),
    );
    const favoriteTracks = useFavoritesStore.getState().tracks;
    for (const favEntry of favoriteTracks) {
      if (learnedSeeds.length >= limit) {
        break;
      }
      const ref = favEntry.ref;
      const trackId =
        ref.source?.id || `${ref.artists?.[0]?.name}-${ref.title}`;
      if (blacklistedTracks.includes(trackId)) {
        continue;
      }
      if (
        (ref.artists ?? []).some((artistItem) =>
          blacklistedArtists.includes(artistItem.name.toLowerCase().trim()),
        )
      ) {
        continue;
      }
      const candidateTrack: Track = {
        title: ref.title,
        artists: (ref.artists ?? []).map((artistItem) => ({
          name: artistItem.name,
          roles: [],
          source: artistItem.source,
        })),
        source: ref.source,
        artwork: ref.artwork,
      };
      const signature = normalizeTrackSignature(candidateTrack);
      if (signature && seenSignatures.has(signature)) {
        continue;
      }
      if (signature) {
        seenSignatures.add(signature);
      }
      learnedSeeds.push(candidateTrack);
    }

    return learnedSeeds;
  }

  scoreAndRankTracks(
    candidates: Array<{
      track: Track;
      source: 'topTracks' | 'related' | 'radio' | 'search';
    }>,
    topArtists: ArtistScore[],
    listens: UserListenRecord[] = [],
    blacklists: { tracks: string[]; artists: string[] } = {
      tracks: [],
      artists: [],
    },
    variety: number = 0.5,
    seed: number = 0,
  ): Track[] {
    const now = Date.now();
    const currentDaypart = getDaypart(now);
    const listeningByTrack = new Map<string, UserListenRecord>();
    const listeningBySignature = new Map<string, UserListenRecord>();
    const daypartArtists = new Set<string>();

    for (const record of listens) {
      listeningByTrack.set(record.trackId, record);
      const signature = normalizeTrackSignature({
        title: record.title,
        artists: [{ name: record.artist }],
      });
      if (signature && !listeningBySignature.has(signature)) {
        listeningBySignature.set(signature, record);
      }
      if (
        record.playCount > 0 &&
        record.lastPlayedAt > 0 &&
        getDaypart(record.lastPlayedAt) === currentDaypart
      ) {
        daypartArtists.add(record.artist.toLowerCase().trim());
        for (const collaborator of record.collaborators ?? []) {
          daypartArtists.add(collaborator.toLowerCase().trim());
        }
      }
    }

    const artistAffinityMap = new Map<string, number>();
    const maxScore = Math.max(1, ...topArtists.map((artist) => artist.score));
    for (const artist of topArtists) {
      const normalizedAffinity =
        Math.log(1 + Math.max(0, artist.score)) / Math.log(1 + maxScore);
      artistAffinityMap.set(
        artist.name.toLowerCase().trim(),
        normalizedAffinity,
      );
    }

    const userGenreWeights = new Map<string, number>();
    for (const artist of topArtists) {
      const artistWeight =
        artistAffinityMap.get(artist.name.toLowerCase().trim()) ?? 0;
      for (const genre of artist.genres ?? []) {
        const clean = genre.toLowerCase().trim();
        if (clean) {
          userGenreWeights.set(
            clean,
            (userGenreWeights.get(clean) ?? 0) + artistWeight,
          );
        }
      }
    }
    const maxGenreWeight = Math.max(
      1,
      ...Array.from(userGenreWeights.values()),
    );

    const sourceWeights: Record<string, number> = {
      related: 1.0,
      radio: 0.85,
      topTracks: 0.75,
      search: 0.45,
    };

    const seenIds = new Set<string>();
    const seenSignatures = new Set<string>();
    const artistTrackCount = new Map<string, number>();

    const familiarCandidates: Array<{ track: Track; score: number }> = [];
    const relatedCandidates: Array<{ track: Track; score: number }> = [];
    const discoveryCandidates: Array<{ track: Track; score: number }> = [];

    const hasSkipStreak = this.consecutiveSkips >= 3;

    const favTracks = useFavoritesStore.getState().tracks;
    const favArtists = useFavoritesStore.getState().artists;
    const currentPlayingTrack = useQueueStore
      .getState()
      .getCurrentItem()?.track;
    const currentTags = new Set(
      (currentPlayingTrack?.tags ?? []).map((tagItem) =>
        tagItem.toLowerCase().trim(),
      ),
    );

    for (const candidate of candidates) {
      const trackId =
        candidate.track.source?.id ||
        `${candidate.track.artists?.[0]?.name}-${candidate.track.title}`;
      const signature = normalizeTrackSignature(candidate.track);
      if (
        seenIds.has(trackId) ||
        (signature.length > 0 && seenSignatures.has(signature))
      ) {
        continue;
      }
      seenIds.add(trackId);
      if (signature.length > 0) {
        seenSignatures.add(signature);
      }

      const candidateArtists = (candidate.track.artists ?? [])
        .map((artistItem) => artistItem.name.toLowerCase().trim())
        .filter(Boolean);

      if (
        blacklists.tracks.includes(trackId) ||
        candidateArtists.some((artistKey) =>
          blacklists.artists.includes(artistKey),
        )
      ) {
        continue;
      }

      let maxAffinity = 0;
      let totalAffinity = 0;
      let matchedAffinityArtists = 0;
      for (const artistKey of candidateArtists) {
        const artistAffinity = artistAffinityMap.get(artistKey) ?? 0;
        if (artistAffinity > 0) {
          matchedAffinityArtists++;
          maxAffinity = Math.max(maxAffinity, artistAffinity);
          totalAffinity += artistAffinity;
        }
      }
      const secondaryAffinity = Math.max(0, totalAffinity - maxAffinity);
      let affinity = Math.min(1.35, maxAffinity + secondaryAffinity * 0.35);
      const collaborationMultiplier =
        matchedAffinityArtists >= 2 ? COLLABORATION_SYNERGY_MULTIPLIER : 1.0;

      if (affinity === 0 && userGenreWeights.size > 0) {
        const candidateTags = (candidate.track.tags ?? []).map((tagItem) =>
          tagItem.toLowerCase().trim(),
        );
        let bestGenreScore = 0;
        for (const tag of candidateTags) {
          if (userGenreWeights.has(tag)) {
            bestGenreScore = Math.max(
              bestGenreScore,
              userGenreWeights.get(tag)! / maxGenreWeight,
            );
          }
        }
        if (bestGenreScore > 0) {
          affinity = bestGenreScore * 0.75;
        }
      }

      const sourceBonus = sourceWeights[candidate.source] ?? 0.5;
      const freshnessNoise = getDeterministicJitter(trackId, seed);
      const listen =
        listeningByTrack.get(trackId) ??
        (signature ? listeningBySignature.get(signature) : undefined);

      const skipRatio =
        listen && listen.skipCount > 0
          ? listen.skipCount / (listen.skipCount + listen.playCount)
          : 0;
      const skipWeight = 1 - skipRatio * 0.85;

      const immediateSkips = listen?.immediateSkipCount ?? 0;
      const immediatePenalty =
        immediateSkips > 0 ? Math.pow(0.2, immediateSkips) : 1.0;

      let sessionSkipPenalty = 1.0;
      for (const artistKey of candidateArtists) {
        const sessionSkips = this.sessionSkippedArtists.get(artistKey) ?? 0;
        if (sessionSkips > 0) {
          sessionSkipPenalty = Math.min(
            sessionSkipPenalty,
            Math.pow(SESSION_SKIP_DECAY_BASE, sessionSkips),
          );
        }
      }

      let cooldownMultiplier = 1.0;
      if (listen?.lastPlayedAt) {
        const timeSincePlay = now - listen.lastPlayedAt;
        if (timeSincePlay >= 0 && timeSincePlay < COOLDOWN_WINDOW_MS) {
          cooldownMultiplier = Math.max(
            0.35,
            timeSincePlay / COOLDOWN_WINDOW_MS,
          );
        }
      }

      let trackQualityMultiplier = 1.0;
      if (listen && listen.playCount > 0) {
        const completion = completionRate(listen);
        const overComp = overCompletionMultiplier(listen);
        if (completion >= 0.75) {
          trackQualityMultiplier =
            (1 +
              Math.min(
                0.3,
                Math.log2(1 + listen.playCount) * 0.08 * completion,
              )) *
            overComp;
        }
      }

      const streakMultiplier = hasSkipStreak
        ? candidate.source === 'topTracks'
          ? 1.3
          : 0.7
        : 1.0;

      const isFavTrack = favTracks.some(
        (entry) =>
          (entry.ref.source?.id && entry.ref.source.id === trackId) ||
          (signature.length > 0 &&
            normalizeTrackSignature(entry.ref) === signature),
      );
      const isFavArtist = favArtists.some((entry) =>
        candidateArtists.includes(entry.ref.name.toLowerCase().trim()),
      );
      const libraryMultiplier = isFavTrack ? 1.6 : isFavArtist ? 1.25 : 1.0;

      const daypartMultiplier = candidateArtists.some((artistKey) =>
        daypartArtists.has(artistKey),
      )
        ? DAYPART_RESONANCE_MULTIPLIER
        : 1.0;

      let sessionTransitionMultiplier = 1.0;
      if (currentTags.size > 0 && candidate.track.tags) {
        const candidateTags = candidate.track.tags.map((tagItem) =>
          tagItem.toLowerCase().trim(),
        );
        if (candidateTags.some((tag) => currentTags.has(tag))) {
          sessionTransitionMultiplier = 1.25;
        }
      }
      if (
        candidateArtists.some((artistKey) =>
          this.sessionCompletedArtists.has(artistKey),
        )
      ) {
        sessionTransitionMultiplier *= SESSION_MOMENTUM_MULTIPLIER;
      }

      const finalScore =
        (affinity * 0.35 + sourceBonus * 0.2 + 0.15 + freshnessNoise * 0.3) *
        collaborationMultiplier *
        skipWeight *
        immediatePenalty *
        sessionSkipPenalty *
        cooldownMultiplier *
        trackQualityMultiplier *
        streakMultiplier *
        libraryMultiplier *
        daypartMultiplier *
        sessionTransitionMultiplier;

      const item = { track: candidate.track, score: finalScore };

      if (candidate.source === 'topTracks') {
        familiarCandidates.push(item);
      } else if (candidate.source === 'related') {
        relatedCandidates.push(item);
      } else {
        discoveryCandidates.push(item);
      }
    }

    familiarCandidates.sort((first, second) => second.score - first.score);
    relatedCandidates.sort((first, second) => second.score - first.score);
    discoveryCandidates.sort((first, second) => second.score - first.score);

    const totalDesired =
      familiarCandidates.length +
      relatedCandidates.length +
      discoveryCandidates.length;
    const familiarWeight = Math.max(0.1, 0.85 - variety * 0.7);
    const relatedWeight = 0.15 + variety * 0.2;
    const targetFamiliar = Math.round(totalDesired * familiarWeight);
    const targetRelated = Math.round(totalDesired * relatedWeight);

    const dynamicMaxTracks = Math.max(1, Math.round(4 - variety * 2));
    const merged: Track[] = [];
    const pushFromPool = (
      pool: Array<{ track: Track; score: number }>,
      count: number,
    ) => {
      let added = 0;
      for (const entry of pool) {
        const artist = (
          entry.track.artists[0]?.name ?? primaryFallbackArtist
        ).toLowerCase();
        const currentCount = artistTrackCount.get(artist) ?? 0;
        if (currentCount >= dynamicMaxTracks) {
          continue;
        }
        artistTrackCount.set(artist, currentCount + 1);
        merged.push(entry.track);
        added++;
        if (count > 0 && added >= count) {
          break;
        }
      }
    };
    const primaryFallbackArtist = '';

    pushFromPool(familiarCandidates, targetFamiliar);
    pushFromPool(relatedCandidates, targetRelated);
    pushFromPool(discoveryCandidates, 0);

    const remaining = [
      ...familiarCandidates,
      ...relatedCandidates,
      ...discoveryCandidates,
    ]
      .filter((entry) => !merged.includes(entry.track))
      .sort((first, second) => second.score - first.score);

    pushFromPool(remaining, 0);

    return this.interleave(merged, seed);
  }

  private interleave(tracks: Track[], seed: number = 0): Track[] {
    if (tracks.length <= 4) {
      return tracks;
    }

    const result: Track[] = [];
    const byArtist = new Map<string, Track[]>();

    for (const track of tracks) {
      const artist = (track.artists?.[0]?.name || 'unknown').toLowerCase();
      if (!byArtist.has(artist)) {
        byArtist.set(artist, []);
      }
      byArtist.get(artist)!.push(track);
    }

    const queues = Array.from(byArtist.values()).sort(
      (first, second) => second.length - first.length,
    );

    let queueIndex = seed > 0 ? seed % Math.max(1, queues.length) : 0;
    while (result.length < tracks.length) {
      let added = false;
      const startIndex = queueIndex;
      do {
        const queue = queues[queueIndex % queues.length];
        if (queue && queue.length > 0) {
          result.push(queue.shift()!);
          added = true;
        }
        queueIndex = (queueIndex + 1) % queues.length;
      } while (!added && queueIndex !== startIndex);

      if (!added) {
        break;
      }
    }

    const top10ArtistCounts = new Map<string, number>();
    const top10: Track[] = [];
    const overflow: Track[] = [];

    for (const track of result) {
      const artist = (track.artists?.[0]?.name || 'unknown').toLowerCase();
      const count = top10ArtistCounts.get(artist) ?? 0;
      if (top10.length < 10 && count < 2) {
        top10ArtistCounts.set(artist, count + 1);
        top10.push(track);
      } else {
        overflow.push(track);
      }
    }

    return [...top10, ...overflow];
  }
}

export const personalizationEngine = PersonalizationEngine.getInstance();
