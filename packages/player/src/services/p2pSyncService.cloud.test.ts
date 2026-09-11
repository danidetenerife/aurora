import { p2pSyncService } from './p2pSyncService';

describe('Cloud synchronization and Backup', () => {
  beforeEach(async () => {
    localStorage.clear();
    await p2pSyncService.setSyncProvider('none');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exports library backup as valid JSON string with expected keys', async () => {
    const jsonString = await p2pSyncService.exportLibraryBackup();
    const parsed = JSON.parse(jsonString);

    expect(parsed).toHaveProperty('version', 1);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('favorites');
    expect(parsed).toHaveProperty('playlists');
    expect(parsed).toHaveProperty('user_profile');
    expect(parsed).toHaveProperty('blacklist');
  });

  it('imports library backup without errors and restores content', async () => {
    const backupData = {
      version: 1,
      timestamp: Date.now(),
      favorites: {
        tracks: [
          {
            ref: {
              title: 'Test Cloud Track',
              source: { provider: 'music', id: '123' },
            },
            addedAtIso: new Date().toISOString(),
          },
        ],
      },
      playlists: [
        {
          id: 'cloud-pl-1',
          name: 'Cloud Playlist',
          items: [],
        },
      ],
      blacklist: {
        tracks: ['disliked-song'],
        artists: ['disliked-artist'],
      },
    };

    const result = await p2pSyncService.importLibraryBackup(
      JSON.stringify(backupData),
    );
    expect(result.success).toBe(true);
    expect(result.syncedCounts?.tracks).toBeGreaterThanOrEqual(1);
    expect(result.syncedCounts?.playlists).toBeGreaterThanOrEqual(1);
  });

  it('generates and decodes aurora-sync:// QR configuration strings', async () => {
    await p2pSyncService.setWebDavConfig({
      url: 'https://dav.example.com',
      username: 'userA',
      password: 'secretPassword',
      remotePath: 'aurora.json',
    });

    const qrString = await p2pSyncService.generateQrConfigString();
    expect(qrString.startsWith('aurora-sync://')).toBe(true);

    localStorage.clear();

    const applied = await p2pSyncService.applyQrConfigString(qrString);
    expect(applied).toBe(true);

    const provider = await p2pSyncService.getSyncProvider();
    expect(provider).toBe('webdav');

    const config = await p2pSyncService.getWebDavConfig();
    expect(config.url).toBe('https://dav.example.com');
    expect(config.username).toBe('userA');
    expect(config.password).toBe('secretPassword');
  });
});
