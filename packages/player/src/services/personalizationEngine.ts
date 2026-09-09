import type { Track } from '@nuclearplayer/model';

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
import { createUniversalStore, type UniversalStore } from './universalStore';

export type { UserListenRecord } from './listeningProfile.mjs';

const SKIP_THRESHOLD_MS = 30_000;
const CHECKPOINT_MS = 15_000;
const DEFAULT_DURATION_MS = 180_000;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY = 86_400_000;
const RECENCY_HALF_LIFE_DAYS = 21;
const MAX_TRACKS_PER_ARTIST = 3;

export type ArtistScore = {
  name: string;
  score: number;
  spotifyUri?: string;
};

type ListeningSession = {
  track: Track;
  listenedMs: number;
  savedMs: number;
  countedPlay: boolean;
  position: number;
};

const exponentialDecay = (daysAgo: number): number =>
  Math.exp((-Math.LN2 * daysAgo) / RECENCY_HALF_LIFE_DAYS);

const completionRate = (record: UserListenRecord): number => {
  if (record.durationMs <= 0 || record.playCount <= 0) {
    return 0;
  }
  return Math.min(
    1,
    record.totalListenMs / (record.playCount * record.durationMs),
  );
};

const loyaltyBonus = (record: UserListenRecord): number =>
  Math.log2(
    1 + Math.max(0, (Date.now() - record.firstPlayedAt) / MILLISECONDS_PER_DAY),
  );

export class PersonalizationEngine {
  private static instance: PersonalizationEngine;
  private pendingWrite: Promise<void> = Promise.resolve();
  private session: ListeningSession | null = null;
  private listeners = new Set<(origin: 'local' | 'remote') => void>();
  private unsubscribe: Array<() => void> = [];

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
    if (session) {
      this.saveSession(session, completed, skipped);
    }
  }

  private saveSession(
    session: ListeningSession,
    completed: boolean,
    skipped: boolean,
  ): void {
    const playCount =
      !session.countedPlay &&
      session.listenedMs > 0 &&
      (completed || session.listenedMs >= SKIP_THRESHOLD_MS)
        ? 1
        : 0;
    const skipCount = skipped && session.listenedMs < SKIP_THRESHOLD_MS ? 1 : 0;
    const listenMs = Math.max(0, session.listenedMs - session.savedMs);
    session.savedMs = session.listenedMs;
    session.countedPlay ||= playCount > 0;
    if (listenMs || playCount || skipCount) {
      void this.recordListening(
        session.track,
        listenMs,
        playCount,
        skipCount,
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
      await this.profileStore.save();
      this.notify(origin);
    });
    this.pendingWrite = write.catch(() => undefined);
    return write;
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
    await this.recordListening(
      track,
      listenMs,
      completed ? 1 : 0,
      completed ? 0 : 1,
    );
  }

  private recordListening(
    track: Track,
    listenMs: number,
    playCount: number,
    skipCount: number,
  ): Promise<void> {
    return this.mutate(async (records) => {
      let deviceId = await this.profileStore.get<string>('deviceId');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        await this.profileStore.set('deviceId', deviceId);
      }
      const artistName = track.artists[0]?.name || 'Unknown';
      const trackId = track.source.id || artistName + '-' + track.title;
      const existing = records.find((record) => record.trackId === trackId);
      const counters = existing?.contributions?.[deviceId];
      const now = Date.now();
      const updated: UserListenRecord = {
        ...existing,
        trackId,
        title: track.title,
        artist: artistName,
        source: track.source,
        artistSource: track.artists[0]?.source,
        durationMs: track.durationMs ?? DEFAULT_DURATION_MS,
        firstPlayedAt: existing?.firstPlayedAt ?? now,
        lastPlayedAt: now,
        playCount: 0,
        skipCount: 0,
        totalListenMs: 0,
        contributions: {
          ...existing?.contributions,
          [deviceId]: {
            playCount: (counters?.playCount ?? 0) + playCount,
            skipCount: (counters?.skipCount ?? 0) + skipCount,
            totalListenMs: (counters?.totalListenMs ?? 0) + listenMs,
          },
        },
      };
      return mergeListenRecords(records, [updated]);
    }, 'local');
  }

  async getTopArtists(): Promise<ArtistScore[]> {
    const listens = await this.getListenRecords();
    const favState = useFavoritesStore.getState();
    const playlistState = usePlaylistStore.getState();

    const artistScores: Record<string, ArtistScore> = {};

    const ensureArtist = (name: string): ArtistScore => {
      if (!artistScores[name]) {
        artistScores[name] = { name, score: 0 };
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
        (now - record.lastPlayedAt) / (1000 * 60 * 60 * 24),
      );
      const recencyWeight = exponentialDecay(daysAgo);
      const completion = completionRate(record);
      const loyalty = loyaltyBonus(record);

      const score =
        record.playCount *
        Math.pow(completion, 2) *
        recencyWeight *
        (1 + loyalty * 0.3);

      const skipPenalty =
        record.skipCount > 0
          ? Math.max(
              0.3,
              1 -
                (record.skipCount / (record.playCount + record.skipCount)) *
                  0.5,
            )
          : 1;

      ensureArtist(record.artist).score += score * skipPenalty;
      if (record.artistSource?.provider === 'spotify') {
        ensureArtist(record.artist).spotifyUri = record.artistSource.id;
      }
    }

    for (const favTrack of favState.tracks) {
      const artist = favTrack.ref.artists?.[0]?.name;
      if (artist) {
        const daysAgo = favTrack.addedAtIso
          ? Math.max(
              0,
              (now - new Date(favTrack.addedAtIso).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 30;
        ensureArtist(artist).score += 15 * exponentialDecay(daysAgo);
      }
    }

    for (const favArtist of favState.artists) {
      const artist = favArtist.ref.name;
      if (artist) {
        const entry = ensureArtist(artist);
        entry.score += 25;
        if (favArtist.ref.source?.provider === 'spotify') {
          entry.spotifyUri = favArtist.ref.source.id;
        }
      }
    }

    playlistState.playlists.forEach((playlist) => {
      for (const item of playlist.items || []) {
        const artist = item.track?.artists?.[0]?.name;
        if (artist) {
          const entry = ensureArtist(artist);
          entry.score += 5;
          const artistSource = item.track?.artists?.[0]?.source;
          if (artistSource?.provider === 'spotify' && !entry.spotifyUri) {
            entry.spotifyUri = artistSource.id;
          }
        }
      }
    });

    return Object.values(artistScores)
      .filter((artist) => artist.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  async getTopArtistNames(): Promise<string[]> {
    const scored = await this.getTopArtists();
    return scored.map((entry) => entry.name);
  }

  async getSeedTracks(limit = 10): Promise<Track[]> {
    const listens = await this.getListenRecords();

    return listens
      .filter((record) => record.playCount > 0 && completionRate(record) > 0.5)
      .sort((a, b) => {
        const aScore =
          a.playCount *
          completionRate(a) *
          exponentialDecay(
            Math.max(0, (Date.now() - a.lastPlayedAt) / (1000 * 60 * 60 * 24)),
          );
        const bScore =
          b.playCount *
          completionRate(b) *
          exponentialDecay(
            Math.max(0, (Date.now() - b.lastPlayedAt) / (1000 * 60 * 60 * 24)),
          );
        return bScore - aScore;
      })
      .slice(0, limit)
      .map((record) => ({
        title: record.title,
        artists: [
          { name: record.artist, roles: [], source: record.artistSource },
        ],
        source: record.source ?? { provider: 'unknown', id: record.trackId },
        durationMs: record.durationMs,
        artwork: undefined,
      }));
  }

  scoreAndRankTracks(
    candidates: Array<{
      track: Track;
      source: 'topTracks' | 'related' | 'radio' | 'search';
    }>,
    topArtists: ArtistScore[],
    listens: UserListenRecord[] = [],
  ): Track[] {
    const listeningByTrack = new Map(
      listens.map((record) => [record.trackId, record]),
    );
    const artistAffinityMap = new Map<string, number>();
    const maxScore = Math.max(1, ...topArtists.map((artist) => artist.score));
    for (const artist of topArtists) {
      artistAffinityMap.set(artist.name.toLowerCase(), artist.score / maxScore);
    }

    const sourceWeights: Record<string, number> = {
      related: 1.0,
      radio: 0.85,
      topTracks: 0.7,
      search: 0.4,
    };

    const seenIds = new Set<string>();
    const artistTrackCount = new Map<string, number>();
    const scored: Array<{ track: Track; score: number }> = [];

    for (const candidate of candidates) {
      const trackId =
        candidate.track.source?.id ||
        `${candidate.track.artists?.[0]?.name}-${candidate.track.title}`;
      if (seenIds.has(trackId)) {
        continue;
      }
      seenIds.add(trackId);

      const artistName = (
        candidate.track.artists?.[0]?.name || ''
      ).toLowerCase();
      const affinity = artistAffinityMap.get(artistName) ?? 0;
      const sourceBonus = sourceWeights[candidate.source] ?? 0.5;
      const freshnessNoise = 0.8 + Math.random() * 0.4;
      const listen = listeningByTrack.get(trackId);
      const skipRatio =
        listen && listen.skipCount > 0
          ? listen.skipCount / (listen.skipCount + listen.playCount)
          : 0;
      const skipWeight = 1 - skipRatio * 0.85;

      const finalScore =
        affinity * 0.4 + sourceBonus * 0.25 + 0.2 + freshnessNoise * 0.15;

      scored.push({ track: candidate.track, score: finalScore * skipWeight });
    }

    scored.sort((a, b) => b.score - a.score);

    const diverseTracks = scored.filter(({ track }) => {
      const artist = (track.artists[0]?.name ?? '').toLowerCase();
      const count = artistTrackCount.get(artist) ?? 0;
      if (count >= MAX_TRACKS_PER_ARTIST) {
        return false;
      }
      artistTrackCount.set(artist, count + 1);
      return true;
    });
    return this.interleave(diverseTracks.map((entry) => entry.track));
  }

  private interleave(tracks: Track[]): Track[] {
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
      (a, b) => b.length - a.length,
    );

    let queueIndex = 0;
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

    return result;
  }
}

export const personalizationEngine = PersonalizationEngine.getInstance();
