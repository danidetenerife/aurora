import type { Playlist, Track } from '@aurora/model';

import { useFavoritesStore } from '../stores/favoritesStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useSoundStore } from '../stores/soundStore';
import { resetInMemoryTauriStore } from '../test/utils/inMemoryTauriStore';
import { eventBus } from './eventBus';
import { mergeListenRecords } from './listeningProfile.mjs';
import { PersonalizationEngine } from './personalizationEngine';
import { createUniversalStore } from './universalStore';

const TRACK: Track = {
  title: 'A favorite song',
  source: { provider: 'music', id: 'song-1' },
  artists: [
    {
      name: 'Favorite artist',
      roles: [],
      source: { provider: 'spotify', id: 'artist-1' },
    },
  ],
  durationMs: 180_000,
};

describe('personalization learning across devices', () => {
  let mobile: PersonalizationEngine;
  let desktop: PersonalizationEngine;

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
    usePlaylistStore.setState({ playlists: [] });
    mobile = new PersonalizationEngine(
      createUniversalStore('mobile-test.json'),
    );
    desktop = new PersonalizationEngine(
      createUniversalStore('desktop-test.json'),
    );
  });

  afterEach(async () => {
    mobile.stop();
    desktop.stop();
    await Promise.all([mobile.getListenRecords(), desktop.getListenRecords()]);
  });

  it('sums independent offline plays and skips without double counting repeated syncs', async () => {
    await mobile.recordPlay(TRACK, true);
    await desktop.recordPlay(TRACK, true);
    await desktop.recordPlay(TRACK, false, 5000);
    await mobile.mergeRemoteListens(await desktop.getListenRecords());
    await desktop.mergeRemoteListens(await mobile.getListenRecords());
    await mobile.mergeRemoteListens(await desktop.getListenRecords());
    expect(await mobile.getListenRecords()).toEqual(
      await desktop.getListenRecords(),
    );
    expect((await mobile.getListenRecords())[0]).toMatchObject({
      playCount: 2,
      skipCount: 1,
      totalListenMs: 365_000,
    });

    await Promise.all([
      mobile.recordPlay(TRACK, true),
      desktop.recordPlay(TRACK, true),
    ]);
    await mobile.mergeRemoteListens(await desktop.getListenRecords());
    await desktop.mergeRemoteListens(await mobile.getListenRecords());
    expect((await desktop.getListenRecords())[0]).toMatchObject({
      playCount: 4,
      skipCount: 1,
      totalListenMs: 725_000,
    });
  });

  it('preserves the shared legacy history while adding new device contributions', async () => {
    const legacy = {
      trackId: TRACK.source.id,
      title: TRACK.title,
      artist: TRACK.artists[0].name,
      playCount: 10,
      skipCount: 2,
      totalListenMs: 1_500_000,
      durationMs: 180_000,
      firstPlayedAt: 1000,
      lastPlayedAt: 2000,
    };
    await mobile.mergeRemoteListens([legacy]);
    await desktop.mergeRemoteListens([legacy]);
    await Promise.all([
      mobile.recordPlay(TRACK, true),
      desktop.recordPlay(TRACK, true),
    ]);
    await mobile.mergeRemoteListens(await desktop.getListenRecords());
    await mobile.mergeRemoteListens([legacy]);
    expect((await mobile.getListenRecords())[0]).toMatchObject({
      playCount: 12,
      skipCount: 2,
      totalListenMs: 1_860_000,
      firstPlayedAt: 1000,
    });
  });

  it('serializes concurrent saves and remote merges', async () => {
    await desktop.recordPlay(TRACK, true);
    const remote = await desktop.getListenRecords();
    await Promise.all([
      mobile.recordPlay(TRACK, true),
      mobile.recordPlay(TRACK, true),
      mobile.mergeRemoteListens(remote),
      mobile.recordPlay(TRACK, false, 1000),
    ]);
    expect((await mobile.getListenRecords())[0]).toMatchObject({
      playCount: 3,
      skipCount: 1,
      totalListenMs: 541_000,
    });
  });

  it('keeps the same device counters after an app restart', async () => {
    await mobile.recordPlay(TRACK, true);
    const restarted = new PersonalizationEngine(
      createUniversalStore('mobile-test.json'),
    );
    await restarted.recordPlay(TRACK, true);
    const records = await restarted.getListenRecords();
    expect(Object.keys(records[0].contributions!)).toHaveLength(1);
    expect(records[0].playCount).toBe(2);
  });

  it('learns partial listens and skips, excluding seeking and time spent paused', async () => {
    mobile.start();
    useSoundStore.getState().play();
    eventBus.emit('trackStarted', TRACK);
    useSoundStore.getState().updatePlayback(15, 180);
    useSoundStore.getState().pause();
    useSoundStore.getState().seekTo(90);
    useSoundStore.getState().play();
    useSoundStore.getState().updatePlayback(95, 180);
    eventBus.emit('playbackSkipped', { positionMs: 95_000 });
    eventBus.emit('trackFinished', TRACK);
    const records = await mobile.getListenRecords();
    expect(records[0]).toMatchObject({
      playCount: 0,
      skipCount: 1,
      totalListenMs: 20_000,
    });
    expect(await mobile.getTopArtists()).toEqual([]);
  });

  it('persists meaningful listening before the song ends and counts completion only once', async () => {
    mobile.start();
    useSoundStore.getState().play();
    eventBus.emit('trackStarted', TRACK);
    useSoundStore.getState().updatePlayback(45, 180);
    expect((await mobile.getListenRecords())[0]).toMatchObject({
      playCount: 1,
      totalListenMs: 45_000,
    });
    useSoundStore.getState().updatePlayback(180, 180);
    eventBus.emit('trackFinished', TRACK);
    eventBus.emit('playbackSkipped', { positionMs: 180_000 });
    expect((await mobile.getListenRecords())[0]).toMatchObject({
      playCount: 1,
      skipCount: 0,
      totalListenMs: 180_000,
    });
    expect((await mobile.getSeedTracks())[0].source).toEqual(TRACK.source);
    expect((await mobile.getTopArtists())[0]).toMatchObject({
      name: TRACK.artists[0].name,
      spotifyUri: 'artist-1',
    });
  });

  it('retains learned tracks beyond the old server and client truncation limits', () => {
    const records = Array.from({ length: 1200 }, (_, index) => ({
      trackId: 'track-' + index,
      title: 'Song ' + index,
      playCount: 1,
      lastPlayedAt: index,
    }));
    const merged = mergeListenRecords(
      records.slice(0, 600),
      records.slice(600),
    );
    expect(merged).toHaveLength(1200);
    expect(mergeListenRecords(merged, records)).toEqual(merged);
  });

  it('penalizes immediate skips (< 8s) much more heavily than normal skips', async () => {
    const immediateTrack: Track = {
      ...TRACK,
      source: { provider: 'music', id: 'immediate-skip-song' },
      artists: [{ name: 'Hated Artist', roles: [] }],
    };
    await mobile.recordPlay(immediateTrack, false, 3_000);
    const records = await mobile.getListenRecords();
    expect(records[0]).toMatchObject({
      playCount: 0,
      skipCount: 1,
      immediateSkipCount: 1,
      totalListenMs: 3_000,
    });
  });

  it('counts listening >= 80% as completed even if skipped near the end', async () => {
    const outroTrack: Track = {
      ...TRACK,
      source: { provider: 'music', id: 'outro-skip-song' },
      artists: [{ name: 'Great Artist', roles: [] }],
      durationMs: 100_000,
    };
    mobile.start();
    useSoundStore.getState().play();
    eventBus.emit('trackStarted', outroTrack);
    useSoundStore.getState().updatePlayback(85, 100);
    eventBus.emit('playbackSkipped', { positionMs: 85_000 });
    const records = await mobile.getListenRecords();
    expect(records[0]).toMatchObject({
      playCount: 1,
      skipCount: 0,
      totalListenMs: 85_000,
    });
  });

  it('supports blacklisting tracks and artists to completely exclude them from recommendations', async () => {
    await mobile.blacklistTrack('bad-track-id');
    await mobile.blacklistArtist('Terrible Band');

    const blacklist = await mobile.getBlacklist();
    expect(blacklist.tracks).toContain('bad-track-id');
    expect(blacklist.artists).toContain('terrible band');

    const badTrack: Track = {
      title: 'Bad Song',
      source: { provider: 'music', id: 'bad-track-id' },
      artists: [{ name: 'Good Band', roles: [] }],
    };
    expect(await mobile.isBlacklisted(badTrack)).toBe(true);

    const badArtistTrack: Track = {
      title: 'Any Song',
      source: { provider: 'music', id: 'some-id' },
      artists: [{ name: 'Terrible Band', roles: [] }],
    };
    expect(await mobile.isBlacklisted(badArtistTrack)).toBe(true);

    const ranked = mobile.scoreAndRankTracks(
      [
        { track: badTrack, source: 'topTracks' },
        { track: badArtistTrack, source: 'related' },
        { track: TRACK, source: 'topTracks' },
      ],
      [{ name: 'Favorite artist', score: 100 }],
      [],
      blacklist,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].title).toBe(TRACK.title);
  });

  it('learns featured collaborators and boosts multi-artist collaboration synergy', async () => {
    const collabTrack: Track = {
      title: 'Midnight Collab (feat. Featured Star)',
      source: { provider: 'music', id: 'collab-1' },
      artists: [
        { name: 'Primary Star', roles: [] },
        { name: 'Featured Star', roles: [] },
      ],
      tags: ['synthpop'],
      durationMs: 200_000,
    };

    await mobile.recordPlay(collabTrack, true, 240_000);
    const topArtists = await mobile.getTopArtists();
    expect(topArtists.map((artist) => artist.name)).toEqual([
      'Primary Star',
      'Featured Star',
    ]);
    expect(topArtists[0].score).toBeGreaterThan(topArtists[1].score);

    const soloCandidate: Track = {
      title: 'Solo Track',
      source: { provider: 'music', id: 'cand-solo' },
      artists: [{ name: 'Primary Star', roles: [] }],
    };
    const synergyCandidate: Track = {
      title: 'Synergy Track',
      source: { provider: 'music', id: 'cand-synergy' },
      artists: [
        { name: 'Primary Star', roles: [] },
        { name: 'Featured Star', roles: [] },
      ],
    };

    const ranked = mobile.scoreAndRankTracks(
      [
        { track: soloCandidate, source: 'topTracks' },
        { track: synergyCandidate, source: 'topTracks' },
      ],
      topArtists,
      await mobile.getListenRecords(),
      { tracks: [], artists: [] },
      0.2,
      42,
    );
    expect(ranked[0].title).toBe('Synergy Track');
  });

  it('deduplicates canonical track variants such as Official Video and Official Audio', () => {
    const audioVersion: Track = {
      title: 'Starlight (Official Audio)',
      source: { provider: 'youtube', id: 'yt-audio-1' },
      artists: [{ name: 'Muse', roles: [] }],
    };
    const videoVersion: Track = {
      title: 'Starlight (Official Music Video) [HD]',
      source: { provider: 'youtube', id: 'yt-video-2' },
      artists: [{ name: 'Muse', roles: [] }],
    };
    const remasterVersion: Track = {
      title: 'Starlight - Remastered 2021',
      source: { provider: 'spotify', id: 'sp-remaster-3' },
      artists: [{ name: 'Muse', roles: [] }],
    };

    const ranked = mobile.scoreAndRankTracks(
      [
        { track: audioVersion, source: 'topTracks' },
        { track: videoVersion, source: 'search' },
        { track: remasterVersion, source: 'related' },
      ],
      [{ name: 'Muse', score: 120 }],
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].source.id).toBe('yt-audio-1');
  });

  it('pivots away from artists skipped in the active session and supplements seeds from favorites', async () => {
    const artistA: Track = {
      title: 'Song A',
      source: { provider: 'music', id: 'song-a' },
      artists: [{ name: 'Skipped Session Artist', roles: [] }],
    };
    const artistB: Track = {
      title: 'Song B',
      source: { provider: 'music', id: 'song-b' },
      artists: [{ name: 'Active Session Artist', roles: [] }],
    };

    await mobile.recordPlay(artistA, false, 4_000);
    await mobile.recordPlay(artistA, false, 5_000);
    await mobile.recordPlay(artistB, true, 180_000);

    const ranked = mobile.scoreAndRankTracks(
      [
        {
          track: {
            title: 'Another by Skipped',
            source: { provider: 'music', id: 'cand-a' },
            artists: [{ name: 'Skipped Session Artist', roles: [] }],
          },
          source: 'topTracks',
        },
        {
          track: {
            title: 'Another by Active',
            source: { provider: 'music', id: 'cand-b' },
            artists: [{ name: 'Active Session Artist', roles: [] }],
          },
          source: 'topTracks',
        },
      ],
      [
        { name: 'Skipped Session Artist', score: 100 },
        { name: 'Active Session Artist', score: 100 },
      ],
    );

    expect(ranked[0].title).toBe('Another by Active');

    useFavoritesStore.setState({
      tracks: [
        {
          key: 'fav-1',
          addedAtIso: new Date().toISOString(),
          ref: {
            title: 'Cloud Synced Favorite',
            artists: [{ name: 'Cloud Artist' }],
            source: { provider: 'spotify', id: 'cloud-fav-1' },
          },
        },
      ],
      artists: [],
      albums: [],
    });

    const seeds = await mobile.getSeedTracks(5);
    expect(seeds.map((seed) => seed.title)).toContain('Cloud Synced Favorite');
  });

  it('records an implicit skip when switching to another track before 30 seconds', async () => {
    const abandonedTrack: Track = {
      title: 'Abandoned Early',
      source: { provider: 'music', id: 'abandoned-1' },
      artists: [{ name: 'Abandoned Artist', roles: [] }],
      durationMs: 200_000,
    };
    const nextTrack: Track = {
      title: 'Replacement Song',
      source: { provider: 'music', id: 'next-1' },
      artists: [{ name: 'Preferred Artist', roles: [] }],
      durationMs: 180_000,
    };

    mobile.start();
    useSoundStore.getState().play();
    eventBus.emit('trackStarted', abandonedTrack);
    useSoundStore.getState().updatePlayback(5, 200);
    eventBus.emit('trackStarted', nextTrack);

    const records = await mobile.getListenRecords();
    const abandonedRecord = records.find(
      (record) => record.trackId === 'abandoned-1',
    );
    expect(abandonedRecord).toMatchObject({
      playCount: 0,
      skipCount: 1,
      immediateSkipCount: 1,
      totalListenMs: 5_000,
    });
    expect(mobile.isArtistSkippedInSession('Abandoned Artist')).toBe(true);
  });

  it('unifies accented and unaccented artist names and incorporates favorite albums', async () => {
    const ytTrack: Track = {
      title: 'Primera Cita',
      source: { provider: 'youtube-music', id: 'yt-1' },
      artists: [
        {
          name: 'Carin Leon',
          roles: [],
          source: { provider: 'youtube-music', id: 'yt-artist' },
        },
      ],
      durationMs: 180_000,
    };
    await mobile.recordPlay(ytTrack, true, 180_000);

    useFavoritesStore.setState({
      tracks: [],
      artists: [],
      albums: [
        {
          key: 'alb-1',
          addedAtIso: new Date().toISOString(),
          ref: {
            title: 'Colmillo de Leche',
            artists: [
              {
                name: 'Carín León',
                source: { provider: 'spotify', id: 'spotify:artist:carin' },
              },
            ],
            source: { provider: 'spotify', id: 'spotify:album:1' },
          },
        },
      ],
    });

    const topArtists = await mobile.getTopArtists();
    expect(topArtists).toHaveLength(1);
    expect(topArtists[0]).toMatchObject({
      name: 'Carín León',
      spotifyUri: 'spotify:artist:carin',
    });
    expect(topArtists[0].score).toBeGreaterThan(18);
  });

  it('prioritizes fresh tracks by favorite artists over overplayed or low-completion tracks', async () => {
    const now = Date.now();
    const listens = [
      {
        trackId: 'overplayed-1',
        title: 'Played Ten Times',
        artist: 'Favorite Band',
        playCount: 10,
        skipCount: 0,
        totalListenMs: 10 * 180_000,
        durationMs: 180_000,
        firstPlayedAt: now - 20 * 86_400_000,
        lastPlayedAt: now - 10 * 3600 * 1000,
      },
      {
        trackId: 'abandoned-mid-1',
        title: 'Abandoned At 40s',
        artist: 'Favorite Band',
        playCount: 1,
        skipCount: 0,
        totalListenMs: 40_000,
        durationMs: 240_000,
        firstPlayedAt: now - 2 * 86_400_000,
        lastPlayedAt: now - 10 * 3600 * 1000,
      },
    ];

    const ranked = mobile.scoreAndRankTracks(
      [
        {
          track: {
            title: 'Played Ten Times',
            source: { provider: 'spotify', id: 'overplayed-1' },
            artists: [{ name: 'Favorite Band', roles: [] }],
          },
          source: 'topTracks',
        },
        {
          track: {
            title: 'Abandoned At 40s',
            source: { provider: 'spotify', id: 'abandoned-mid-1' },
            artists: [{ name: 'Favorite Band', roles: [] }],
          },
          source: 'topTracks',
        },
        {
          track: {
            title: 'Fresh Unheard Gem',
            source: { provider: 'spotify', id: 'fresh-1' },
            artists: [{ name: 'Favorite Band', roles: [] }],
          },
          source: 'topTracks',
        },
      ],
      [{ name: 'Favorite Band', score: 150 }],
      listens,
      { tracks: [], artists: [] },
      0.2,
      7,
    );

    expect(ranked[0].title).toBe('Fresh Unheard Gem');
    expect(ranked[ranked.length - 1].title).toBe('Abandoned At 40s');
  });

  it('seeds tracks from saved playlists and favorite artists/albums when listens and favorite tracks are empty', async () => {
    const playlistTrack: Track = {
      title: 'Echoes',
      source: { provider: 'youtube-music', id: 'echoes-yt' },
      artists: [
        {
          name: 'Pink Floyd',
          roles: [],
          source: { provider: 'youtube-music', id: 'pink-floyd-yt' },
        },
      ],
      durationMs: 300_000,
    };

    useFavoritesStore.setState({
      tracks: [],
      artists: [
        {
          key: 'art-1',
          addedAtIso: new Date().toISOString(),
          ref: {
            name: 'Led Zeppelin',
            source: { provider: 'spotify', id: 'lz-spotify' },
          },
        },
      ],
      albums: [],
    });

    usePlaylistStore.setState({
      playlists: new Map([
        [
          'pl-1',
          {
            id: 'pl-1',
            name: 'Prog Classics',
            items: [{ id: 'item-1', track: playlistTrack }],
          } as unknown as Playlist,
        ],
      ]),
    });

    const seeds = await mobile.getSeedTracks(5);
    expect(seeds.length).toBeGreaterThanOrEqual(2);
    expect(seeds.some((seed) => seed.title === 'Echoes')).toBe(true);
    expect(
      seeds.some((seed) => seed.artists?.[0]?.name === 'Led Zeppelin'),
    ).toBe(true);
  });

  it('records an intentional skip after 35 seconds as a skip rather than a play and marks artist skipped in session', async () => {
    const longTrack: Track = {
      title: 'Extended Jam',
      source: { provider: 'spotify', id: 'long-jam-1' },
      artists: [
        {
          name: 'Jam Band',
          roles: [],
          source: { provider: 'spotify', id: 'jam-band-1' },
        },
      ],
      durationMs: 300_000,
    };

    mobile.start();
    useSoundStore.getState().play();
    eventBus.emit('trackStarted', longTrack);
    useSoundStore.getState().updatePlayback(35, 300);
    eventBus.emit('playbackSkipped', { positionMs: 35_000 });
    eventBus.emit('trackFinished', longTrack);

    const records = await mobile.getListenRecords();
    expect(records[0]).toMatchObject({
      playCount: 0,
      skipCount: 1,
      totalListenMs: 35_000,
    });
    expect(mobile.isArtistSkippedInSession('Jam Band')).toBe(true);
  });

  it('rejects amateur covers and SEO-spam chart artists from learning and recommendations', async () => {
    const spamTrack: Track = {
      title: 'Smells Like Teen Spirit',
      source: { provider: 'youtube-music', id: 'spam-1' },
      artists: [{ name: 'Billboard Top 100 Hits', roles: [] }],
      durationMs: 240_000,
    };
    const coverTrack: Track = {
      title: 'Blinding Lights (Acoustic Cover)',
      source: { provider: 'youtube-music', id: 'cover-1' },
      artists: [{ name: 'Pedrito de Cuenca', roles: [] }],
      durationMs: 200_000,
    };
    const authenticTrack: Track = {
      title: 'Blinding Lights',
      source: { provider: 'youtube-music', id: 'auth-1' },
      artists: [{ name: 'The Weeknd', roles: [] }],
      durationMs: 200_000,
    };

    await mobile.recordPlay(spamTrack, true, 240_000);
    await mobile.recordPlay(coverTrack, true, 200_000);
    await mobile.recordPlay(authenticTrack, true, 200_000);

    const topArtists = await mobile.getTopArtists();
    expect(topArtists.map((artist) => artist.name)).toEqual(['The Weeknd']);

    const ranked = mobile.scoreAndRankTracks(
      [
        { track: spamTrack, source: 'search' },
        { track: coverTrack, source: 'search' },
        { track: authenticTrack, source: 'topTracks' },
      ],
      topArtists,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].artists[0].name).toBe('The Weeknd');
  });
});
