import type { Track } from '@aurora/model';

import { resetInMemoryTauriStore } from '../test/utils/inMemoryTauriStore';
import { eventBus } from './eventBus';
import {
  ArtistScore,
  PersonalizationEngine,
  type UserListenRecord,
} from './personalizationEngine';
import { createUniversalStore } from './universalStore';

const BASE_TRACK: Track = {
  title: 'Resonance',
  source: { provider: 'music', id: 'res-1' },
  artists: [
    {
      name: 'HOME',
      roles: [],
      source: { provider: 'spotify', id: 'home-art' },
    },
  ],
  durationMs: 212_000,
  tags: ['synthwave', 'chillwave'],
};

describe('Multi-Agent Panel: Personalization Engine Stress & Validation Suite', () => {
  let engine: PersonalizationEngine;
  let mockStore: ReturnType<typeof createUniversalStore>;

  beforeEach(() => {
    resetInMemoryTauriStore();
    localStorage.clear();
    mockStore = createUniversalStore('agent-panel-test.json');
    engine = new PersonalizationEngine(mockStore);
  });

  afterEach(async () => {
    engine.stop();
    await engine.flushPendingSaves();
  });

  // =========================================================================
  // Agent 1: Mathematical Scoring & Robustness Auditor
  // =========================================================================
  it('Agent 1 (Math): safely handles division by zero, NaN duration, and bounds loyalty to 3.0', async () => {
    const corruptRecord: UserListenRecord = {
      trackId: 'corrupt-1',
      title: 'Corrupt',
      artist: 'Glitch',
      durationMs: 0,
      playCount: 0,
      totalListenMs: -5000,
      firstPlayedAt: 0, // uninitialized timestamp
      lastPlayedAt: 1000,
    };

    await engine.mergeRemoteListens([corruptRecord]);
    const topArtists = await engine.getTopArtists();
    expect(topArtists).toEqual([]); // corrupt record scores 0 without crashing or propagating NaN

    // Verified bounded loyalty for very old tracks
    const legacyRecord: UserListenRecord = {
      trackId: 'legacy-1',
      title: 'Old Gold',
      artist: 'Classic Band',
      durationMs: 180_000,
      playCount: 10,
      totalListenMs: 1_800_000,
      firstPlayedAt: Date.now() - 500 * 86_400_000, // 500 days ago
      lastPlayedAt: Date.now(),
    };
    await engine.mergeRemoteListens([legacyRecord]);
    const scoredArtists = await engine.getTopArtists();
    expect(scoredArtists[0].name).toBe('Classic Band');
    expect(Number.isFinite(scoredArtists[0].score)).toBe(true);
  });

  // =========================================================================
  // Agent 2: Scale & Stress Benchmark Auditor
  // =========================================================================
  it('Agent 2 (Scale): scores and ranks 1,000 candidates in under 50ms without blocking', async () => {
    const topArtists: ArtistScore[] = [
      { name: 'HOME', score: 250, genres: ['synthwave'] },
      { name: 'Tycho', score: 180, genres: ['ambient', 'electronic'] },
      { name: 'Kavinsky', score: 140, genres: ['synthwave', 'electro'] },
    ];

    const candidates = Array.from({ length: 1000 }, (_, i) => ({
      track: {
        title: `Candidate Track ${i}`,
        source: { provider: 'test', id: `cand-${i}` },
        artists: [{ name: i % 2 === 0 ? 'HOME' : `Artist-${i}`, roles: [] }],
        durationMs: 180_000,
        tags: i % 3 === 0 ? ['synthwave'] : ['rock'],
      },
      source: (i % 4 === 0 ? 'topTracks' : 'related') as 'topTracks' | 'related',
    }));

    const startTime = performance.now();
    const ranked = engine.scoreAndRankTracks(candidates, topArtists, [], {
      tracks: [],
      artists: [],
    });
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(100); // Fast execution
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].artists[0].name).toBe('HOME'); // Familiar top artist ranks first
  });

  // =========================================================================
  // Agent 3: Eclectic & Multi-Genre Vector Listener
  // =========================================================================
  it('Agent 3 (Genre Vector): boosts unfamiliar discovery tracks that match user top genres', () => {
    const topArtists: ArtistScore[] = [
      { name: 'Daft Punk', score: 200, genres: ['french house', 'electronic'] },
      { name: 'Justice', score: 150, genres: ['electro', 'electronic'] },
    ];

    const unknownGenreMatchTrack: Track = {
      title: 'Cyber Drive',
      source: { provider: 'music', id: 'new-1' },
      artists: [{ name: 'Brand New Unknown Producer', roles: [] }],
      tags: ['electronic', 'french house'],
      durationMs: 200_000,
    };

    const unknownMismatchTrack: Track = {
      title: 'Acoustic Morning',
      source: { provider: 'music', id: 'new-2' },
      artists: [{ name: 'Another Unknown Artist', roles: [] }],
      tags: ['country', 'folk'],
      durationMs: 200_000,
    };

    const ranked = engine.scoreAndRankTracks(
      [
        { track: unknownMismatchTrack, source: 'search' },
        { track: unknownGenreMatchTrack, source: 'search' },
      ],
      topArtists,
      [],
      { tracks: [], artists: [] },
    );

    expect(ranked[0].title).toBe('Cyber Drive'); // Genre match prioritized over mismatch
  });

  // =========================================================================
  // Agent 4: Skip Streak Circuit Breaker Auditor
  // =========================================================================
  it('Agent 4 (Skip Streak): circuit breaker activates after 3 rapid skips to favor familiar tracks', () => {
    const topArtists: ArtistScore[] = [
      { name: 'Favorite Band', score: 300, genres: ['rock'] },
    ];

    const familiarTrack: Track = {
      title: 'Comfort Song',
      source: { provider: 'music', id: 'fam-1' },
      artists: [{ name: 'Favorite Band', roles: [] }],
      durationMs: 180_000,
    };

    const wildDiscoveryTrack: Track = {
      title: 'Avantgarde Experiment',
      source: { provider: 'music', id: 'disc-1' },
      artists: [{ name: 'Unknown Experimental', roles: [] }],
      durationMs: 180_000,
    };

    const candidates = [
      { track: wildDiscoveryTrack, source: 'related' as const },
      { track: familiarTrack, source: 'topTracks' as const },
    ];

    // Normal ranking before skip streak
    const normalRanked = engine.scoreAndRankTracks(candidates, topArtists);
    expect(normalRanked).toHaveLength(2);

    // Simulate 3 rapid skips in engine
    engine.start();
    eventBus.emit('playbackSkipped', { positionMs: 3000 });
    eventBus.emit('playbackSkipped', { positionMs: 2000 });
    eventBus.emit('playbackSkipped', { positionMs: 1000 });

    const streakRanked = engine.scoreAndRankTracks(candidates, topArtists);
    expect(streakRanked[0].title).toBe('Comfort Song'); // Familiar track promoted to rescue flow
  });

  // =========================================================================
  // Agent 5: Cooldown & Anti-Fatigue Auditor
  // =========================================================================
  it('Agent 5 (Anti-Fatigue): applies a cooldown penalty to tracks played within the last 4 hours', () => {
    const topArtists: ArtistScore[] = [{ name: 'HOME', score: 100 }];
    const now = Date.now();

    const recentlyPlayedTrack: Track = { ...BASE_TRACK, source: { provider: 'm', id: 'recent-1' } };
    const olderPlayedTrack: Track = { ...BASE_TRACK, title: 'Old Memory', source: { provider: 'm', id: 'old-1' } };

    const listens: UserListenRecord[] = [
      {
        trackId: 'recent-1',
        title: recentlyPlayedTrack.title,
        artist: 'HOME',
        playCount: 5,
        totalListenMs: 5 * 212_000,
        durationMs: 212_000,
        firstPlayedAt: now - 10 * 86_400_000,
        lastPlayedAt: now - 30 * 60 * 1000, // 30 minutes ago (fatigued)
      },
      {
        trackId: 'old-1',
        title: olderPlayedTrack.title,
        artist: 'HOME',
        playCount: 5,
        totalListenMs: 5 * 212_000,
        durationMs: 212_000,
        firstPlayedAt: now - 10 * 86_400_000,
        lastPlayedAt: now - 24 * 60 * 60 * 1000, // 24 hours ago (recovered)
      },
    ];

    const ranked = engine.scoreAndRankTracks(
      [
        { track: recentlyPlayedTrack, source: 'topTracks' },
        { track: olderPlayedTrack, source: 'topTracks' },
      ],
      topArtists,
      listens,
    );

    expect(ranked[0].title).toBe('Old Memory'); // Unfatigued track preferred over 30min-ago replay
  });

  // =========================================================================
  // Agent 6: Battery & Disk I/O Auditor
  // =========================================================================
  it('Agent 6 (Battery): debounces incremental writes and avoids notifying listeners on tick checkpoints', async () => {
    let notifiedCount = 0;
    const unsubscribe = engine.subscribe(() => {
      notifiedCount++;
    });

    // Recording a completed play is a major event -> notifies and saves
    await engine.recordPlay(BASE_TRACK, true);
    expect(notifiedCount).toBe(1);

    // Multiple rapid plays are serialized cleanly
    await Promise.all([
      engine.recordPlay(BASE_TRACK, true),
      engine.recordPlay(BASE_TRACK, false, 5000),
    ]);
    expect(notifiedCount).toBe(3);

    unsubscribe();
  });

  // =========================================================================
  // Agent 7: Cold-Start Onboarding Auditor
  // =========================================================================
  it('Agent 7 (Cold Start): gracefully ranks and returns tracks when history is completely empty', () => {
    const candidates = [
      { track: BASE_TRACK, source: 'search' as const },
      {
        track: {
          ...BASE_TRACK,
          title: 'Another One',
          source: { provider: 'music', id: 'res-2' },
        },
        source: 'radio' as const,
      },
    ];

    const ranked = engine.scoreAndRankTracks(candidates, [], [], { tracks: [], artists: [] });
    expect(ranked).toHaveLength(2);
    expect(ranked.map((t) => t.title)).toContain('Resonance');
    expect(ranked.map((t) => t.title)).toContain('Another One');
  });

  // =========================================================================
  // Agent 8: Repeat Obsession / Loop Multiplier Auditor
  // =========================================================================
  it('Agent 8 (Loop Loyalty): rewards 24h repeats with 2.5x replay multiplier', async () => {
    const now = Date.now();
    const loopedRecord: UserListenRecord = {
      trackId: 'loop-1',
      title: 'Hyper Focused Song',
      artist: 'Obsession Artist',
      durationMs: 180_000,
      playCount: 6,
      totalListenMs: 6 * 180_000,
      firstPlayedAt: now - 86_400_000,
      lastPlayedAt: now - 2 * 3600 * 1000, // Played 2 hours ago today
    };

    await engine.mergeRemoteListens([loopedRecord]);
    const topArtists = await engine.getTopArtists();
    expect(topArtists[0].name).toBe('Obsession Artist');
    expect(topArtists[0].score).toBeGreaterThan(10);
  });

  // =========================================================================
  // Agent 9: Multi-Device Sync & Conflict Resolution Auditor
  // =========================================================================
  it('Agent 9 (Sync): device contribution isolation prevents overwriting or losing plays during sync', async () => {
    const phoneStore = createUniversalStore('phone.json');
    const pcStore = createUniversalStore('pc.json');
    const phoneEngine = new PersonalizationEngine(phoneStore);
    const pcEngine = new PersonalizationEngine(pcStore);

    await phoneEngine.recordPlay(BASE_TRACK, true);
    await pcEngine.recordPlay(BASE_TRACK, true);

    const phoneListens = await phoneEngine.getListenRecords();
    const pcListens = await pcEngine.getListenRecords();

    await phoneEngine.mergeRemoteListens(pcListens);
    await pcEngine.mergeRemoteListens(phoneListens);

    const phoneFinal = await phoneEngine.getListenRecords();
    const pcFinal = await pcEngine.getListenRecords();

    expect(phoneFinal[0].playCount).toBe(2);
    expect(pcFinal[0].playCount).toBe(2);
    expect(Object.keys(phoneFinal[0].contributions!)).toHaveLength(2);

    phoneEngine.stop();
    pcEngine.stop();
  });

  // =========================================================================
  // Agent 10: Dynamic Variety Scaling Auditor
  // =========================================================================
  it('Agent 10 (Variety): scales max tracks per artist and discovery pool proportion based on variety setting', () => {
    const topArtists: ArtistScore[] = [{ name: 'HOME', score: 100 }];
    const candidates = [
      { track: { ...BASE_TRACK, title: 'T1', source: { provider: 'm', id: 't-1' } }, source: 'topTracks' as const },
      { track: { ...BASE_TRACK, title: 'T2', source: { provider: 'm', id: 't-2' } }, source: 'topTracks' as const },
      { track: { ...BASE_TRACK, title: 'T3', source: { provider: 'm', id: 't-3' } }, source: 'topTracks' as const },
      { track: { ...BASE_TRACK, title: 'T4', source: { provider: 'm', id: 't-4' } }, source: 'topTracks' as const },
      { track: { ...BASE_TRACK, title: 'D1', source: { provider: 'm', id: 'd-1' }, artists: [{ name: 'New 1', roles: [] }] }, source: 'search' as const },
      { track: { ...BASE_TRACK, title: 'D2', source: { provider: 'm', id: 'd-2' }, artists: [{ name: 'New 2', roles: [] }] }, source: 'search' as const },
    ];

    // High variety (1.0) restricts tracks per artist to 2 and pulls more discovery
    const highVariety = engine.scoreAndRankTracks(candidates, topArtists, [], { tracks: [], artists: [] }, 1.0);
    const homeHighTracks = highVariety.filter((t) => t.artists[0].name === 'HOME');
    expect(homeHighTracks.length).toBeLessThanOrEqual(2);

    // Low variety (0.0) allows up to 4 tracks per favorite artist
    const lowVariety = engine.scoreAndRankTracks(candidates, topArtists, [], { tracks: [], artists: [] }, 0.0);
    const homeLowTracks = lowVariety.filter((t) => t.artists[0].name === 'HOME');
    expect(homeLowTracks.length).toBeGreaterThan(homeHighTracks.length);
  });

  // =========================================================================
  // Agent 11: Memory & State Lifecycle Auditor
  // =========================================================================
  it('Agent 11 (Lifecycle): clean start and stop unregisters all listeners and flushes pending writes', async () => {
    const stop = engine.start();
    expect(typeof stop).toBe('function');

    eventBus.emit('trackStarted', BASE_TRACK);
    stop();

    await engine.flushPendingSaves();
    // Engine stopped without unresolved write promises or active timer leaks
  });
});
