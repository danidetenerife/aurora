import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ArtistRef, Track, TrackRef } from '@aurora/model';
import type { MetadataProvider } from '@aurora/plugin-sdk';

import { useFavoritesStore } from '../stores/favoritesStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useQueueStore } from '../stores/queueStore';
import { useSettingsStore } from '../stores/settingsStore';
import {
  getIntelligentAutoplayTracks,
  resetDiscoverySession,
} from './discoveryService';
import {
  personalizationEngine,
  type ArtistScore,
} from './personalizationEngine';
import { providersHost } from './providersHost';

vi.mock('./eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

const makeTrack = (
  title: string,
  artist: string,
  id = `id-${title}`,
  tags: string[] = [],
): Track => ({
  title,
  artists: [{ name: artist, roles: [] }],
  tags,
  source: {
    provider: 'test',
    id,
  },
});

const makeTrackRef = (
  title: string,
  artist: string,
  id = `ref-${title}`,
): TrackRef => ({
  title,
  artists: [{ name: artist, roles: [] }],
  source: {
    provider: 'test',
    id,
  },
});

describe('discoveryService - Empirical Stress & Adversarial Challenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDiscoverySession();
    providersHost.clear();
    useQueueStore.setState({ items: [], currentIndex: 0 });
    useFavoritesStore.setState({ tracks: [], artists: [], albums: [] });
    usePlaylistStore.setState({ playlists: new Map() });
    useSettingsStore.setState({
      values: {
        'core.playback.discovery': true,
        'core.playback.discoveryVariety': 0.5,
      },
    });
  });

  describe('1. Provider Failure & Corrupted Response Resilience', () => {
    it('handles provider where fetchArtistTopTracks rejects with network error', async () => {
      const mockProvider: MetadataProvider = {
        id: 'failing-provider',
        name: 'Failing Provider',
        version: '1.0.0',
        description: 'Test failing provider',
        kind: 'metadata',
        fetchArtistTopTracks: vi
          .fn()
          .mockRejectedValue(new Error('Network 500: Server Down')),
        fetchArtistRelatedArtists: vi.fn().mockResolvedValue([]),
        search: vi.fn().mockResolvedValue({ tracks: [] }),
      };
      providersHost.register(mockProvider);
      providersHost.setActive('metadata', 'failing-provider');

      const contextTracks = [makeTrack('Track 1', 'Artist Alpha')];
      const result = await getIntelligentAutoplayTracks(
        contextTracks,
        new Set(),
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('handles provider where fetchArtistTopTracks returns undefined or null instead of array', async () => {
      const mockProvider: MetadataProvider = {
        id: 'corrupt-provider',
        name: 'Corrupt Provider',
        version: '1.0.0',
        description: 'Test corrupt provider',
        kind: 'metadata',
        fetchArtistTopTracks: vi
          .fn()
          .mockResolvedValue(undefined as unknown as TrackRef[]),
        fetchArtistRelatedArtists: vi
          .fn()
          .mockResolvedValue(null as unknown as ArtistRef[]),
        search: vi
          .fn()
          .mockResolvedValue({ tracks: null as unknown as Track[] }),
      };
      providersHost.register(mockProvider);
      providersHost.setActive('metadata', 'corrupt-provider');

      const contextTracks = [makeTrack('Track 1', 'Artist Beta')];
      // Should not throw uncaught TypeError
      await expect(
        getIntelligentAutoplayTracks(contextTracks, new Set()),
      ).resolves.toBeDefined();
    });

    it('handles provider search returning malformed object without tracks field', async () => {
      const mockProvider: MetadataProvider = {
        id: 'malformed-search-provider',
        name: 'Malformed Search Provider',
        version: '1.0.0',
        description: 'Test malformed search',
        kind: 'metadata',
        search: vi.fn().mockResolvedValue({} as unknown as { tracks: Track[] }),
      };
      providersHost.register(mockProvider);
      providersHost.setActive('metadata', 'malformed-search-provider');

      const contextTracks = [makeTrack('Track 1', 'Artist Gamma')];
      const result = await getIntelligentAutoplayTracks(
        contextTracks,
        new Set(),
      );
      expect(Array.isArray(result)).toBe(true);
    });

    it('gracefully handles scenario where no metadata provider is registered', async () => {
      providersHost.clear();
      const contextTracks = [makeTrack('Track 1', 'Artist Delta')];
      const result = await getIntelligentAutoplayTracks(
        contextTracks,
        new Set(),
      );
      expect(result).toEqual([]);
    });

    it('handles resolveArtistMetadata rejection in personalization engine', async () => {
      vi.spyOn(
        personalizationEngine,
        'resolveArtistMetadata',
      ).mockRejectedValueOnce(new Error('Metadata resolution crash'));

      const mockProvider: MetadataProvider = {
        id: 'good-provider',
        name: 'Good Provider',
        version: '1.0.0',
        description: 'Test',
        kind: 'metadata',
        search: vi.fn().mockResolvedValue({
          tracks: [makeTrack('Track Resilient', 'Artist Resilient')],
        }),
      };
      providersHost.register(mockProvider);
      providersHost.setActive('metadata', 'good-provider');

      const contextTracks = [makeTrack('Crash Artist', 'Crash Artist')];
      const result = await getIntelligentAutoplayTracks(
        contextTracks,
        new Set(),
      );
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('2. Unusual Artist Names & Malformed Metadata', () => {
    const unusualArtistNames = [
      'AC/DC',
      'P!nk',
      'Ke$ha',
      'Panic! At The Disco',
      'Sunn O)))',
      '!@#$%^&*()_+{}[]:"<>?~',
      '🎵🎶🔥✨❤️',
      'Artist 🎧 2026',
      '👨‍👩‍👧‍👦',
      '初音ミク',
      '아이유 (IU)',
      'Скриптонит',
      'مروان موسى',
      'בנזין',
      'คาราบาว',
      '   Whitespace Padded   ',
      'Line\nBreak\tTab\rReturn',
      'A'.repeat(5000), // Very long artist name
    ];

    it.each(unusualArtistNames)(
      'does not crash or hang on unusual artist name: %s',
      async (artistName) => {
        const mockProvider: MetadataProvider = {
          id: 'test-provider',
          name: 'Test Provider',
          version: '1.0.0',
          description: 'Test',
          kind: 'metadata',
          fetchArtistTopTracks: vi
            .fn()
            .mockResolvedValue([makeTrackRef('Discovered Track', artistName)]),
          search: vi.fn().mockResolvedValue({
            tracks: [makeTrack('Discovered Search Track', artistName)],
          }),
        };
        providersHost.register(mockProvider);
        providersHost.setActive('metadata', 'test-provider');

        const contextTracks = [makeTrack('Input Track', artistName)];
        const startTime = Date.now();
        const result = await getIntelligentAutoplayTracks(
          contextTracks,
          new Set(),
        );
        const elapsed = Date.now() - startTime;

        expect(Array.isArray(result)).toBe(true);
        expect(elapsed).toBeLessThan(3000); // No ReDoS or infinite loop
      },
    );

    it('handles track with missing artist array or empty artist object', async () => {
      const mockProvider: MetadataProvider = {
        id: 'test-provider',
        name: 'Test Provider',
        version: '1.0.0',
        description: 'Test',
        kind: 'metadata',
        search: vi.fn().mockResolvedValue({ tracks: [] }),
      };
      providersHost.register(mockProvider);
      providersHost.setActive('metadata', 'test-provider');

      const brokenTrack1: Track = {
        title: 'No Artists Track',
        artists: [],
        source: { provider: 'test', id: 'no-artists' },
      };
      const brokenTrack2: Track = {
        title: 'Empty Artist Object Track',
        artists: [{ name: '', roles: [] }],
        source: { provider: 'test', id: 'empty-artist' },
      };

      const result = await getIntelligentAutoplayTracks(
        [brokenTrack1, brokenTrack2],
        new Set(),
      );
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('3. Dynamic Fallback Query Isolation (No Generic Chart Fallback When User Signals Exist)', () => {
    let capturedQueries: string[] = [];

    const createQueryCapturingProvider = () => {
      capturedQueries = [];
      const mockProvider: MetadataProvider = {
        id: 'query-capturing-provider',
        name: 'Query Capturing Provider',
        version: '1.0.0',
        description: 'Captures search queries',
        kind: 'metadata',
        search: vi.fn().mockImplementation(({ query }: { query: string }) => {
          capturedQueries.push(query);
          return Promise.resolve({ tracks: [] });
        }),
      };
      providersHost.register(mockProvider);
      providersHost.setActive('metadata', 'query-capturing-provider');
      return mockProvider;
    };

    it('NEVER queries generic chart fallbacks when user has a playlist', async () => {
      createQueryCapturingProvider();

      // Seed playlist
      const playlistMap = new Map();
      playlistMap.set('pl-1', {
        id: 'pl-1',
        name: 'Nordic Ambient & Chill',
        items: [
          {
            id: 'item-1',
            track: makeTrack('Northern Lights', 'Biosphere'),
          },
        ],
      });
      usePlaylistStore.setState({ playlists: playlistMap });

      // No context tracks, no top artists, no top genres
      await getIntelligentAutoplayTracks([], new Set());

      expect(capturedQueries.length).toBeGreaterThan(0);
      expect(capturedQueries).not.toContain('Pop Hits');
      expect(capturedQueries).not.toContain('Trending Music');
      // When playlist has tracks, seed tracks are prioritized
      expect(capturedQueries).toContain('Northern Lights Biosphere');

      // Now test with an empty playlist (no items yet)
      const emptyPlaylistMap = new Map();
      emptyPlaylistMap.set('pl-empty', {
        id: 'pl-empty',
        name: 'Nordic Ambient & Chill',
        items: [],
      });
      usePlaylistStore.setState({ playlists: emptyPlaylistMap });
      capturedQueries = [];
      await getIntelligentAutoplayTracks([], new Set());

      expect(capturedQueries.length).toBeGreaterThan(0);
      expect(capturedQueries).not.toContain('Pop Hits');
      expect(capturedQueries).not.toContain('Trending Music');
      expect(capturedQueries).toContain('Nordic Ambient & Chill');
    });

    it('NEVER queries generic chart fallbacks when user has favorite tracks', async () => {
      createQueryCapturingProvider();

      useFavoritesStore.setState({
        tracks: [
          {
            id: 'fav-1',
            ref: makeTrackRef('Teardrop', 'Massive Attack'),
            type: 'track',
          },
        ],
        artists: [],
        albums: [],
      });

      await getIntelligentAutoplayTracks([], new Set());

      expect(capturedQueries.length).toBeGreaterThan(0);
      expect(capturedQueries).not.toContain('Pop Hits');
      expect(capturedQueries).not.toContain('Trending Music');
      expect(capturedQueries.some((q) => q.includes('Teardrop'))).toBe(true);
    });

    it('NEVER queries generic chart fallbacks when user has favorite artists', async () => {
      createQueryCapturingProvider();

      useFavoritesStore.setState({
        tracks: [],
        artists: [
          {
            id: 'fav-artist-1',
            ref: {
              name: 'Aphex Twin',
              source: { provider: 'test', id: 'aphex-twin' },
            },
            type: 'artist',
          },
        ],
        albums: [],
      });

      await getIntelligentAutoplayTracks([], new Set());

      expect(capturedQueries.length).toBeGreaterThan(0);
      expect(capturedQueries).not.toContain('Pop Hits');
      expect(capturedQueries).not.toContain('Trending Music');
      expect(
        capturedQueries.some((q) => q.toLowerCase().includes('aphex twin')),
      ).toBe(true);
    });

    it('queries generic chart fallbacks ONLY when user profile is completely blank', async () => {
      createQueryCapturingProvider();

      useFavoritesStore.setState({ tracks: [], artists: [], albums: [] });
      usePlaylistStore.setState({ playlists: new Map() });
      vi.spyOn(personalizationEngine, 'getTopArtists').mockResolvedValueOnce(
        [],
      );
      vi.spyOn(personalizationEngine, 'getTopGenres').mockResolvedValueOnce([]);
      vi.spyOn(personalizationEngine, 'getSeedTracks').mockResolvedValueOnce(
        [],
      );

      await getIntelligentAutoplayTracks([], new Set());

      expect(capturedQueries).toContain('Pop Hits');
      expect(capturedQueries).toContain('Trending Music');
    });
  });

  describe('4. Recommendation Ranking, Dislike Blacklisting & Genre Purity', () => {
    it('strictly excludes blacklisted artists and blacklisted tracks from returned recommendations', async () => {
      const mockProvider: MetadataProvider = {
        id: 'test-provider',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        kind: 'metadata',
        search: vi.fn().mockResolvedValue({
          tracks: [
            makeTrack('Hated Song', 'Disliked Artist', 'hated-track-1'),
            makeTrack('Other Song', 'Disliked Artist', 'other-track-2'),
            makeTrack('Loved Song', 'Good Artist', 'loved-track-3'),
          ],
        }),
      };
      providersHost.register(mockProvider);
      providersHost.setActive('metadata', 'test-provider');

      vi.spyOn(personalizationEngine, 'getBlacklist').mockResolvedValue({
        tracks: ['hated-track-1'],
        artists: ['disliked artist'],
      });

      const results = await getIntelligentAutoplayTracks([], new Set());

      const returnedTitles = results.map((t) => t.title);
      expect(returnedTitles).not.toContain('Hated Song');
      expect(returnedTitles).not.toContain('Other Song');
      expect(returnedTitles).toContain('Loved Song');
    });

    it('scoreAndRankTracks ranks user preferred genre strictly above unrelated genre', () => {
      const rockTrack = makeTrack('Rock Anthem', 'Rock Band', 'rock-1', [
        'rock',
      ]);
      const popTrack = makeTrack('Pop Tune', 'Pop Star', 'pop-1', ['pop']);
      const jazzTrack = makeTrack('Jazz Solo', 'Jazz Trio', 'jazz-1', ['jazz']);

      const candidates: Array<{
        track: Track;
        source: 'topTracks' | 'related' | 'radio' | 'search';
      }> = [
        { track: popTrack, source: 'search' },
        { track: jazzTrack, source: 'search' },
        { track: rockTrack, source: 'search' },
      ];

      const topArtists = [
        {
          name: 'Classic Rockers',
          score: 100,
          genres: ['rock', 'classic rock'],
        },
      ];

      const ranked = personalizationEngine.scoreAndRankTracks(
        candidates,
        topArtists as unknown as ArtistScore[],
        [],
        { tracks: [], artists: [] },
        0.1, // low variety to emphasize affinity
      );

      // Rock track should be ranked #1
      expect(ranked[0]?.title).toBe('Rock Anthem');
    });
  });
});
