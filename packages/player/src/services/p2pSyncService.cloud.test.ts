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

  it('excludes device-specific settings like volume from export payload', async () => {
    const { useSettingsStore } = await import('../stores/settingsStore');
    useSettingsStore.setState({
      values: {
        'core.playback.volume': 0.45,
        'core.playback.muted': true,
        'core.playback.shuffle': true,
        'core.general.language': 'es_ES',
      },
    });

    const jsonString = await p2pSyncService.exportLibraryBackup();
    const parsed = JSON.parse(jsonString);

    expect(parsed.settings).toBeDefined();
    expect(parsed.settings['core.playback.shuffle']).toBe(true);
    expect(parsed.settings['core.general.language']).toBe('es_ES');
    expect(parsed.settings['core.playback.volume']).toBeUndefined();
    expect(parsed.settings['playback.volume']).toBeUndefined();
    expect(parsed.settings['core.playback.muted']).toBeUndefined();
  });

  it('does not overwrite local volume when applying remote sync payload containing volume', async () => {
    const { useSettingsStore } = await import('../stores/settingsStore');
    useSettingsStore.setState({
      values: {
        'core.playback.volume': 0.75,
        'core.playback.shuffle': false,
      },
    });

    const remoteBackup = {
      version: 1,
      timestamp: Date.now(),
      settings: {
        'core.playback.volume': 0.48,
        'playback.volume': 0.48,
        'core.playback.shuffle': true,
      },
    };

    await p2pSyncService.importLibraryBackup(JSON.stringify(remoteBackup));

    const values = useSettingsStore.getState().values;
    expect(values['core.playback.volume']).toBe(0.75);
    expect(values['core.playback.shuffle']).toBe(true);
  });
});
