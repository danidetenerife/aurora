import { p2pSyncService } from './p2pSyncService';
import { personalizationEngine } from './personalizationEngine';

describe('listening profile synchronization', () => {
  let remote: Record<string, unknown>[];
  let remoteBlacklist: { tracks: string[]; artists: string[] };
  let uploads: Array<{
    user_profile: unknown[];
    blacklist?: { tracks: string[]; artists: string[] };
  }>;
  let online: boolean;

  beforeEach(() => {
    localStorage.clear();
    uploads = [];
    online = true;
    remote = [
      {
        trackId: 'desktop-track',
        title: 'From the PC',
        artist: 'An artist',
        playCount: 2,
        skipCount: 1,
        totalListenMs: 200_000,
        durationMs: 180_000,
        firstPlayedAt: 1000,
        lastPlayedAt: 2000,
      },
    ];
    remoteBlacklist = {
      tracks: ['pc-disliked-track'],
      artists: ['pc-bad-band'],
    };
    vi.stubGlobal('fetch', async (input: string, options?: RequestInit) => {
      if (!online) {
        throw new Error('Offline');
      }
      if (input.endsWith('/api/health')) {
        return Response.json({ status: 'ok' });
      }
      if (input.endsWith('/api/sync/push')) {
        const payload = JSON.parse(options!.body as string);
        uploads.push(payload);
        if (payload.user_profile) {
          remote = payload.user_profile;
        }
        if (payload.blacklist) {
          remoteBlacklist = {
            tracks: Array.from(
              new Set([
                ...remoteBlacklist.tracks,
                ...(payload.blacklist.tracks || []),
              ]),
            ),
            artists: Array.from(
              new Set([
                ...remoteBlacklist.artists,
                ...(payload.blacklist.artists || []),
              ]),
            ),
          };
        }
        return Response.json({ success: true });
      }
      if (input.endsWith('/api/sync')) {
        return Response.json({
          user_profile: remote,
          blacklist: remoteBlacklist,
        });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal(
      'EventSource',
      class {
        static CLOSED = 2;
        readyState = 1;
        addEventListener() {}
        close() {
          this.readyState = 2;
        }
      },
    );
  });

  afterEach(() => {
    p2pSyncService.stopBackgroundSyncWatcher();
    vi.unstubAllGlobals();
  });

  it('merges and uploads listening even when the server has no favorites payload', async () => {
    await personalizationEngine.recordPlay(
      {
        title: 'From mobile',
        source: { provider: 'music', id: 'mobile-track' },
        artists: [],
      },
      true,
    );
    expect((await p2pSyncService.syncNow()).success).toBe(true);
    expect(await personalizationEngine.getListenRecords()).toHaveLength(2);
    expect(uploads).toHaveLength(1);
    expect(uploads[0].user_profile).toHaveLength(2);
    await p2pSyncService.syncNow();
    expect(uploads).toHaveLength(1);
  });

  it('retains offline learning and sends it on the next successful synchronization', async () => {
    online = false;
    await personalizationEngine.recordPlay(
      {
        title: 'Offline song',
        source: { provider: 'music', id: 'offline-track' },
        artists: [],
      },
      true,
    );
    expect((await p2pSyncService.syncNow()).success).toBe(false);
    online = true;
    expect((await p2pSyncService.syncNow()).success).toBe(true);
    expect(uploads[0].user_profile).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ trackId: 'offline-track', playCount: 1 }),
      ]),
    );
  });

  it('synchronizes blacklisted tracks and artists bidirectionally', async () => {
    await personalizationEngine.blacklistTrack('mobile-blocked-song');
    await personalizationEngine.blacklistArtist('Mobile Annoying Band');

    const result = await p2pSyncService.syncNow();
    expect(result.success).toBe(true);

    // Verify local personalization engine merged the remote blacklist
    const localBlacklist = await personalizationEngine.getBlacklist();
    expect(localBlacklist.tracks).toContain('pc-disliked-track');
    expect(localBlacklist.tracks).toContain('mobile-blocked-song');
    expect(localBlacklist.artists).toContain('pc-bad-band');
    expect(localBlacklist.artists).toContain('mobile annoying band');

    // Verify remote received the local blacklist additions
    expect(remoteBlacklist.tracks).toContain('mobile-blocked-song');
    expect(remoteBlacklist.artists).toContain('mobile annoying band');
  });
});
