import type { Track } from '@aurora/model';

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
});
