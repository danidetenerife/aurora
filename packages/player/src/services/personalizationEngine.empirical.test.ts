import type { Playlist, Track } from '@aurora/model';

import { useFavoritesStore } from '../stores/favoritesStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useQueueStore } from '../stores/queueStore';
import { useSoundStore } from '../stores/soundStore';
import { resetInMemoryTauriStore } from '../test/utils/inMemoryTauriStore';
import { eventBus } from './eventBus';
import { PersonalizationEngine } from './personalizationEngine';
import { createUniversalStore } from './universalStore';

describe('Empirical Challenge: PersonalizationEngine Milestone 1', () => {
  let engine: PersonalizationEngine;

  beforeEach(() => {
    resetInMemoryTauriStore();
    localStorage.clear();
    useSoundStore.setState({
      src: null,
      status: 'stopped',
      seek: 0,
      duration: 0,
    });
    useFavoritesStore.setState({ tracks: [], artists: [], albums: [] });
    usePlaylistStore.setState({ playlists: new Map() });
    useQueueStore.setState({ items: [], currentIndex: 0 });
    engine = new PersonalizationEngine(
      createUniversalStore('empirical-test.json'),
    );
  });

  afterEach(async () => {
    engine.stop();
    await engine.getListenRecords();
  });

  describe('Challenge 1: getSeedTracks Edge Cases', () => {
    it('1.1: returns empty array without throwing when user library is completely empty', async () => {
      const seeds = await engine.getSeedTracks(10);
      expect(seeds).toEqual([]);
    });

    it('1.2: seeds from playlists only and respects limit and deduplication', async () => {
      const track1: Track = {
        title: 'Track One',
        source: { provider: 'custom', id: 't1' },
        artists: [{ name: 'Artist A', roles: [] }],
      };
      const track2: Track = {
        title: 'Track Two',
        source: { provider: 'custom', id: 't2' },
        artists: [{ name: 'Artist B', roles: [] }],
      };

      usePlaylistStore.setState({
        playlists: new Map([
          [
            'p1',
            {
              id: 'p1',
              name: 'My Playlist',
              items: [
                { id: 'i1', track: track1 },
                { id: 'i2', track: track2 },
                { id: 'i3', track: track1 }, // duplicate in same playlist
              ],
            } as unknown as Playlist,
          ],
          [
            'p2',
            {
              id: 'p2',
              name: 'Second Playlist',
              items: [
                { id: 'i4', track: track2 }, // duplicate across playlists
              ],
            } as unknown as Playlist,
          ],
        ]),
      });

      const seeds = await engine.getSeedTracks(5);
      expect(seeds).toHaveLength(2);
      expect(seeds.map((s) => s.title)).toEqual(['Track One', 'Track Two']);
    });

    it('1.3: handles malformed playlist items (null track, missing artists, empty title)', async () => {
      usePlaylistStore.setState({
        playlists: new Map([
          [
            'p1',
            {
              id: 'p1',
              name: 'Malformed Playlist',
              items: [
                { id: 'i1', track: null as unknown as Track },
                {
                  id: 'i2',
                  track: {
                    title: '',
                    source: { provider: 'test', id: 't-empty' },
                  } as Track,
                },
                {
                  id: 'i3',
                  track: {
                    title: 'Valid Track',
                    source: { provider: 'test', id: 't-valid' },
                    artists: [],
                  } as Track,
                },
              ],
            } as unknown as Playlist,
          ],
        ]),
      });

      const seeds = await engine.getSeedTracks(5);
      expect(seeds.length).toBeGreaterThanOrEqual(1);
      expect(seeds.some((s) => s.title === 'Valid Track')).toBe(true);
    });

    it('1.4: seeds from favorite artists only and excludes blacklisted artists', async () => {
      await engine.blacklistArtist('Blacklisted Band');

      useFavoritesStore.setState({
        tracks: [],
        artists: [
          {
            key: 'fa-1',
            addedAtIso: new Date().toISOString(),
            ref: {
              name: 'Blacklisted Band',
              source: { provider: 'spotify', id: 'bb-1' },
            },
          },
          {
            key: 'fa-2',
            addedAtIso: new Date().toISOString(),
            ref: {
              name: 'Allowed Band',
              source: { provider: 'spotify', id: 'ab-1' },
            },
          },
        ],
        albums: [],
      });

      const seeds = await engine.getSeedTracks(5);
      expect(seeds).toHaveLength(1);
      expect(seeds[0].artists[0].name).toBe('Allowed Band');
    });

    it('1.5: seeds from favorite albums only and excludes blacklisted album artists', async () => {
      await engine.blacklistArtist('Bad Artist');

      useFavoritesStore.setState({
        tracks: [],
        artists: [],
        albums: [
          {
            key: 'alb-1',
            addedAtIso: new Date().toISOString(),
            ref: {
              title: 'Bad Album',
              artists: [{ name: 'Bad Artist', roles: [] }],
              source: { provider: 'spotify', id: 'alb-bad' },
            },
          },
          {
            key: 'alb-2',
            addedAtIso: new Date().toISOString(),
            ref: {
              title: 'Good Album',
              artists: [{ name: 'Good Artist', roles: [] }],
              source: { provider: 'spotify', id: 'alb-good' },
            },
          },
        ],
      });

      const seeds = await engine.getSeedTracks(5);
      expect(seeds).toHaveLength(1);
      expect(seeds[0].title).toBe('Good Album');
      expect(seeds[0].artists[0].name).toBe('Good Artist');
    });

    it('1.6 (CRITICAL STRESS TEST): blacklisted artists in playlists MUST NOT leak in second pass of getSeedTracks', async () => {
      // Artist Evil is blacklisted
      await engine.blacklistArtist('Evil Artist');

      const trackGood: Track = {
        title: 'Good Track',
        source: { provider: 'custom', id: 't-good' },
        artists: [{ name: 'Good Artist', roles: [] }],
      };
      const trackEvil: Track = {
        title: 'Evil Track',
        source: { provider: 'custom', id: 't-evil' },
        artists: [{ name: 'Evil Artist', roles: [] }],
      };

      usePlaylistStore.setState({
        playlists: new Map([
          [
            'p1',
            {
              id: 'p1',
              name: 'Mixed Playlist',
              items: [
                { id: 'i1', track: trackGood },
                { id: 'i2', track: trackEvil },
              ],
            } as unknown as Playlist,
          ],
        ]),
      });

      // Limit is 10. Pass 1 takes trackGood (1 track).
      // Then learnedSeeds.length (1) < limit (10).
      // Second pass loops through playlists again!
      const seeds = await engine.getSeedTracks(10);

      // Verify that Evil Artist was NOT leaked into seeds!
      const evilSeeds = seeds.filter((s) =>
        s.artists.some((a) => a.name.toLowerCase() === 'evil artist'),
      );
      expect(evilSeeds).toHaveLength(0);
    });
  });

  describe('Challenge 2: 30-Second Skip Inversion and Session Momentum', () => {
    it('2.1: skip at exactly 29 seconds (below threshold) increments skipCount and does NOT count play', async () => {
      const track: Track = {
        title: 'Song 29s',
        source: { provider: 'test', id: 'song-29s' },
        artists: [{ name: 'Artist 29', roles: [] }],
        durationMs: 180_000,
      };

      engine.start();
      useSoundStore.getState().play();
      eventBus.emit('trackStarted', track);
      useSoundStore.getState().updatePlayback(29, 180);
      eventBus.emit('playbackSkipped', { positionMs: 29_000 });
      eventBus.emit('trackFinished', track);

      const records = await engine.getListenRecords();
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        playCount: 0,
        skipCount: 1,
        totalListenMs: 29_000,
      });
      expect(engine.isArtistSkippedInSession('Artist 29')).toBe(true);
    });

    it('2.2: skip at 31 seconds (past checkpoint) decrements playCount back to 0 and records skip', async () => {
      const track: Track = {
        title: 'Song 31s',
        source: { provider: 'test', id: 'song-31s' },
        artists: [{ name: 'Artist 31', roles: [] }],
        durationMs: 180_000,
      };

      engine.start();
      useSoundStore.getState().play();
      eventBus.emit('trackStarted', track);
      // At 31s, the 30s checkpoint has fired
      useSoundStore.getState().updatePlayback(31, 180);
      // Explicit skip event
      eventBus.emit('playbackSkipped', { positionMs: 31_000 });
      eventBus.emit('trackFinished', track);

      const records = await engine.getListenRecords();
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        playCount: 0,
        skipCount: 1,
        totalListenMs: 31_000,
      });
      expect(engine.isArtistSkippedInSession('Artist 31')).toBe(true);
    });

    it('2.3: skip at 120 seconds (long playback, 50% of 240s) decrements playCount back to 0 and records skip', async () => {
      const track: Track = {
        title: 'Song 120s',
        source: { provider: 'test', id: 'song-120s' },
        artists: [{ name: 'Artist 120', roles: [] }],
        durationMs: 240_000,
      };

      engine.start();
      useSoundStore.getState().play();
      eventBus.emit('trackStarted', track);
      useSoundStore.getState().updatePlayback(35, 240);
      useSoundStore.getState().updatePlayback(95, 240);
      useSoundStore.getState().updatePlayback(120, 240);
      eventBus.emit('playbackSkipped', { positionMs: 120_000 });
      eventBus.emit('trackFinished', track);

      const records = await engine.getListenRecords();
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        playCount: 0,
        skipCount: 1,
        totalListenMs: 120_000,
      });
      expect(engine.isArtistSkippedInSession('Artist 120')).toBe(true);
    });

    it('2.4: skip at near-completion (e.g. 90% of duration) retains playCount = 1 because effectiveCompleted is true', async () => {
      const track: Track = {
        title: 'Song 90s of 100s',
        source: { provider: 'test', id: 'song-90s' },
        artists: [{ name: 'Artist 90', roles: [] }],
        durationMs: 100_000,
      };

      engine.start();
      useSoundStore.getState().play();
      eventBus.emit('trackStarted', track);
      useSoundStore.getState().updatePlayback(90, 100);
      eventBus.emit('playbackSkipped', { positionMs: 90_000 });
      eventBus.emit('trackFinished', track);

      const records = await engine.getListenRecords();
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        playCount: 1,
        skipCount: 0,
        totalListenMs: 90_000,
      });
    });

    it('2.5: multiple rapid skips increment consecutive skips and penalize recommendations', async () => {
      engine.start();

      const tracks = [1, 2, 3].map((i) => ({
        title: `Rapid Track ${i}`,
        source: { provider: 'test', id: `rapid-${i}` },
        artists: [{ name: `Rapid Artist ${i}`, roles: [] }],
        durationMs: 180_000,
      }));

      for (const t of tracks) {
        useSoundStore.getState().play();
        eventBus.emit('trackStarted', t);
        useSoundStore.getState().updatePlayback(2, 180);
        eventBus.emit('playbackSkipped', { positionMs: 2_000 });
        eventBus.emit('trackFinished', t);
      }

      const records = await engine.getListenRecords();
      expect(records).toHaveLength(3);
      for (const rec of records) {
        expect(rec.playCount).toBe(0);
        expect(rec.skipCount).toBe(1);
        expect(rec.immediateSkipCount).toBe(1);
      }

      // 3 consecutive skips should trigger hasSkipStreak
      const ranked = engine.scoreAndRankTracks(
        [
          { track: tracks[0], source: 'related' },
          {
            track: {
              title: 'Top Track',
              source: { provider: 'test', id: 'top-1' },
              artists: [{ name: 'Top Artist', roles: [] }],
            },
            source: 'topTracks',
          },
        ],
        [],
      );
      // In hasSkipStreak mode, topTracks gets a 1.3 multiplier while related gets 0.7 multiplier
      expect(ranked[0].title).toBe('Top Track');
    });
  });

  describe('Challenge 3: Dislike Queue Pruning and Artist Blacklisting', () => {
    it('3.1: disliking a track blacklists track, blacklists artist, and purges upcoming matching tracks', async () => {
      const dislikedTrack: Track = {
        title: 'Hated Song',
        source: { provider: 'test', id: 'hated-1' },
        artists: [{ name: 'Hated Artist', roles: [] }],
        durationMs: 180_000,
      };

      const upcomingSameArtist: Track = {
        title: 'Another Hated Song',
        source: { provider: 'test', id: 'hated-2' },
        artists: [{ name: 'Hated Artist', roles: [] }],
        durationMs: 180_000,
      };

      const upcomingSameArtistDifferentCase: Track = {
        title: 'Third Hated Song',
        source: { provider: 'test', id: 'hated-3' },
        artists: [{ name: 'hated artist', roles: [] }],
        durationMs: 180_000,
      };

      const upcomingGoodArtist: Track = {
        title: 'Good Song',
        source: { provider: 'test', id: 'good-1' },
        artists: [{ name: 'Loved Artist', roles: [] }],
        durationMs: 180_000,
      };

      useQueueStore.setState({
        currentIndex: 0,
        items: [
          { id: 'q-0', track: dislikedTrack },
          { id: 'q-1', track: upcomingSameArtist },
          { id: 'q-2', track: upcomingGoodArtist },
          { id: 'q-3', track: upcomingSameArtistDifferentCase },
        ],
      });

      // Emulate the exact dislike logic from TvNowPlayingBar.tsx
      const currentTrack = dislikedTrack;
      const trackId =
        currentTrack.source?.id ||
        `${currentTrack.artists?.[0]?.name}-${currentTrack.title}`;
      const artistName = currentTrack.artists?.[0]?.name;

      eventBus.emit('playbackSkipped', { positionMs: 5000 });
      await engine.blacklistTrack(trackId);
      if (artistName) {
        await engine.blacklistArtist(artistName);
      }

      const queueState = useQueueStore.getState();
      const upcomingItems = queueState.items.slice(queueState.currentIndex + 1);
      const normalizedArtist = artistName
        ? artistName.trim().toLowerCase()
        : '';
      const idsToRemove = upcomingItems
        .filter((item) => {
          const itemTrackId =
            item.track.source?.id ||
            `${item.track.artists?.[0]?.name}-${item.track.title}`;
          if (itemTrackId === trackId) {
            return true;
          }
          if (
            normalizedArtist &&
            item.track.artists?.some(
              (artist) => artist.name.trim().toLowerCase() === normalizedArtist,
            )
          ) {
            return true;
          }
          return false;
        })
        .map((item) => item.id);

      if (idsToRemove.length > 0) {
        queueState.removeByIds(idsToRemove);
      }

      // Assertions
      const blacklist = await engine.getBlacklist();
      expect(blacklist.tracks).toContain('hated-1');
      expect(blacklist.artists).toContain('hated artist');

      const remainingQueue = useQueueStore.getState().items;
      // Item 0 is current. Items 1 and 3 should have been removed! Only item 2 remains.
      expect(remainingQueue.map((item) => item.id)).toEqual(['q-0', 'q-2']);
      expect(remainingQueue[1].track.title).toBe('Good Song');
    });
  });
});
