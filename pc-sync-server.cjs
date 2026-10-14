const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');
let mergeListenRecords;

const PORT = Number(process.env.AURORA_SYNC_PORT || 4122);
const MAX_BODY_BYTES = 50 * 1024 * 1024;
const DEVICE_SPECIFIC_SETTINGS_KEYS = new Set([
  'core.playback.volume',
  'core.playback.muted',
  'core.carMode.autoBluetooth',
  'core.carMode.keepScreenAwake',
]);

function resolveDefaultAppData() {
  const candidates =
    process.platform === 'win32'
      ? [
          path.join(os.homedir(), 'AppData', 'Roaming', 'com.auroraplayer'),
          path.join(os.homedir(), 'AppData', 'Roaming', 'org.aurora.player'),
        ]
      : process.platform === 'darwin'
        ? [
            path.join(
              os.homedir(),
              'Library',
              'Application Support',
              'com.auroraplayer',
            ),
            path.join(
              os.homedir(),
              'Library',
              'Application Support',
              'org.aurora.player',
            ),
          ]
        : [
            path.join(
              process.env.XDG_DATA_HOME ||
                path.join(os.homedir(), '.local', 'share'),
              'com.auroraplayer',
            ),
            path.join(
              process.env.XDG_DATA_HOME ||
                path.join(os.homedir(), '.local', 'share'),
              'org.aurora.player',
            ),
          ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

const APP_DATA = process.env.AURORA_SYNC_APP_DATA || resolveDefaultAppData();

function sanitizePlaylistId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Connected SSE clients
const sseClients = new Set();

function broadcastUpdate() {
  if (sseClients.size === 0) return;
  const payload = getFullSyncPayload();
  const eventData = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(`event: sync:update\n${eventData}`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Watch directory for changes from PC Desktop app
try {
  if (fs.existsSync(APP_DATA)) {
    let debounceTimer = null;
    fs.watch(APP_DATA, { recursive: true }, (eventType, filename) => {
      if (filename && filename !== 'p2p_sync.json' && (filename.endsWith('.json') || filename.includes('playlists'))) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          broadcastUpdate();
        }, 300);
      }
    });
  }
} catch (err) {
  console.warn('Watch warning:', err.message);
}

function readJsonFile(filename, defaultValue) {
  try {
    const filePath = path.join(APP_DATA, filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
  }
  return defaultValue;
}

function writeJsonFile(filename, data) {
  try {
    if (!fs.existsSync(APP_DATA)) {
      fs.mkdirSync(APP_DATA, { recursive: true });
    }
    const filePath = path.join(APP_DATA, filename);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const temporaryPath = filePath + '.tmp';
    fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temporaryPath, filePath);
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
    throw err;
  }
}

function readPlaylists() {
  const playlistsDir = path.join(APP_DATA, 'playlists');
  const result = [];
  try {
    if (fs.existsSync(playlistsDir)) {
      const files = fs.readdirSync(playlistsDir);
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'index.json') {
          try {
            const content = fs.readFileSync(path.join(playlistsDir, file), 'utf8');
            const parsed = JSON.parse(content);
            const playlist = parsed.playlist || parsed;
            if (playlist && (playlist.name || playlist.id)) {
              result.push(playlist);
            }
          } catch {
            // ignore
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return result;
}

function readPlaylistIndex() {
  const indexFile = path.join(APP_DATA, 'playlists', 'index.json');
  try {
    if (fs.existsSync(indexFile)) {
      const content = fs.readFileSync(indexFile, 'utf8');
      const parsed = JSON.parse(content);
      return parsed.entries || [];
    }
  } catch {
    // ignore
  }
  return [];
}

function getFullSyncPayload() {
  const rawFavs = readJsonFile('favorites.json', {});
  const rawSettings = readJsonFile('settings.json', {});
  const rawQueue = readJsonFile('queue.json', {});
  const rawPlugins = readJsonFile('plugins.json', {});
  const rawActiveProviders = readJsonFile('active-providers.json', {});
  const activeProviders =
    rawActiveProviders && typeof rawActiveProviders.active === 'object' && rawActiveProviders.active !== null
      ? rawActiveProviders.active
      : rawActiveProviders;
  const playlists = readPlaylists();
  const playlistIndex = readPlaylistIndex();
  const userProfile = readJsonFile('user_profile.json', { listens: [] });
  const syncedProfile = readJsonFile('user_profile_sync.json', { listens: [] });

  const mergedBlacklistTracks = Array.from(new Set([
    ...(Array.isArray(userProfile.blacklistedTracks) ? userProfile.blacklistedTracks : []),
    ...(Array.isArray(syncedProfile.blacklistedTracks) ? syncedProfile.blacklistedTracks : []),
  ]));
  const mergedBlacklistArtists = Array.from(new Set([
    ...(Array.isArray(userProfile.blacklistedArtists) ? userProfile.blacklistedArtists : []),
    ...(Array.isArray(syncedProfile.blacklistedArtists) ? syncedProfile.blacklistedArtists : []),
  ]));

  const rawSyncConfig = readJsonFile('p2p_sync.json', {});

  const tracks = rawFavs['favorites.tracks'] || [];
  const artists = rawFavs['favorites.artists'] || [];
  const albums = rawFavs['favorites.albums'] || [];
  const deletedKeys = rawFavs['favorites.deletedKeys'] || {};

  return {
    favorites: {
      tracks,
      artists,
      albums,
      deletedKeys,
    },
    settings: rawSettings,
    plugins: rawPlugins,
    activeProviders,
    p2p_sync: rawSyncConfig,
    queue: rawQueue,
    playlists,
    playlistIndex,
    user_profile: mergeListenRecords(userProfile.listens, syncedProfile.listens),
    blacklist: {
      tracks: mergedBlacklistTracks,
      artists: mergedBlacklistArtists,
    },
    timestamp: Date.now(),
  };
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'aurora-p2p-sync' }));
    return;
  }

  if (url.pathname === '/api/sync/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('event: connected\ndata: {}\n\n');
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  if (url.pathname === '/api/sync' || url.pathname === '/api/favorites') {
    const payload = getFullSyncPayload();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
    return;
  }

  if (url.pathname === '/api/sync/push' && req.method === 'POST') {
    let body = '';
    let bodyBytes = 0;
    let aborted = false;
    req.on('data', (chunk) => {
      if (aborted) return;
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_BODY_BYTES) {
        aborted = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large' }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        const pushData = JSON.parse(body);
        let profileChanged = false;

        // 1. Merge Favorites from mobile into PC favorites.json
        if (pushData.favorites) {
          const currentFavs = readJsonFile('favorites.json', {});
          if (pushData.favorites.tracks) {
            currentFavs['favorites.tracks'] = pushData.favorites.tracks;
          }
          if (pushData.favorites.artists) {
            currentFavs['favorites.artists'] = pushData.favorites.artists;
          }
          if (pushData.favorites.albums) {
            currentFavs['favorites.albums'] = pushData.favorites.albums;
          }
          if (pushData.favorites.deletedKeys) {
            const existingDeleted = currentFavs['favorites.deletedKeys'] || {};
            for (const [key, timestamp] of Object.entries(pushData.favorites.deletedKeys)) {
              if (!existingDeleted[key] || existingDeleted[key] < timestamp) {
                existingDeleted[key] = timestamp;
              }
            }
            currentFavs['favorites.deletedKeys'] = existingDeleted;
          }
          writeJsonFile('favorites.json', currentFavs);
        }

        // 2. Merge Settings from mobile into PC settings.json
        if (pushData.settings && typeof pushData.settings === 'object') {
          const currentSettings = readJsonFile('settings.json', {});
          for (const [settingKey, settingVal] of Object.entries(pushData.settings)) {
            if (!DEVICE_SPECIFIC_SETTINGS_KEYS.has(settingKey)) {
              currentSettings[settingKey] = settingVal;
            }
          }
          writeJsonFile('settings.json', currentSettings);
        }

        // 3. Save Playlists from mobile into PC AppData/playlists/
        if (pushData.playlists && Array.isArray(pushData.playlists)) {
          const playlistsDir = path.join(APP_DATA, 'playlists');
          if (!fs.existsSync(playlistsDir)) {
            fs.mkdirSync(playlistsDir, { recursive: true });
          }
          const existingIndex = readPlaylistIndex();
          const entriesById = new Map();
          for (const existingEntry of existingIndex) {
            if (existingEntry && existingEntry.id) {
              entriesById.set(existingEntry.id, existingEntry);
            }
          }

          for (const rawPl of pushData.playlists) {
            const pl = rawPl.playlist || rawPl;
            if (pl && pl.name && pl.id) {
              const safeId = sanitizePlaylistId(pl.id);
              if (!safeId) continue;
              const normalizedPlaylist = { ...pl, id: safeId };
              fs.writeFileSync(
                path.join(playlistsDir, `${safeId}.json`),
                JSON.stringify({ playlist: normalizedPlaylist }, null, 2),
                'utf8',
              );
              entriesById.set(safeId, {
                id: safeId,
                name: pl.name,
                itemCount: (pl.items || []).length,
                createdAtIso: pl.createdAtIso || new Date().toISOString(),
                lastModifiedIso: pl.lastModifiedIso || new Date().toISOString(),
                isReadOnly: Boolean(pl.isReadOnly),
                thumbnails: pl.artwork?.items?.map((i) => i.url) || [],
                totalDurationMs: (pl.items || []).reduce(
                  (acc, item) => acc + (item.track?.durationMs || 0),
                  0,
                ),
              });
            }
          }
          if (entriesById.size > 0) {
            writeJsonFile(path.join('playlists', 'index.json'), {
              entries: Array.from(entriesById.values()),
            });
          }
        }

        // 3b. Remove Deleted Playlists pushed from mobile
        if (pushData.deletedPlaylists && typeof pushData.deletedPlaylists === 'object') {
          const playlistsDir = path.join(APP_DATA, 'playlists');
          const deletedKeys = Object.keys(pushData.deletedPlaylists).map((k) =>
            k.toLowerCase().trim(),
          );
          if (fs.existsSync(playlistsDir)) {
            try {
              const files = fs.readdirSync(playlistsDir);
              for (const file of files) {
                if (file.endsWith('.json') && file !== 'index.json') {
                  const id = file.replace(/\.json$/, '').toLowerCase().trim();
                  let shouldDelete = deletedKeys.includes(id);
                  if (!shouldDelete) {
                    try {
                      const content = JSON.parse(
                        fs.readFileSync(path.join(playlistsDir, file), 'utf8'),
                      );
                      const plName = (content.playlist?.name || content.name || '')
                        .toLowerCase()
                        .trim();
                      if (
                        plName &&
                        (deletedKeys.includes(plName) ||
                          deletedKeys.includes(`synced-${plName}`))
                      ) {
                        shouldDelete = true;
                      }
                    } catch {
                      // ignore parse error
                    }
                  }
                  if (shouldDelete) {
                    try {
                      fs.unlinkSync(path.join(playlistsDir, file));
                    } catch {
                      // ignore unlink error
                    }
                  }
                }
              }
            } catch {
              // ignore dir read error
            }
          }

          const currentIndex = readJsonFile(path.join('playlists', 'index.json'), {
            entries: [],
          });
          if (Array.isArray(currentIndex.entries)) {
            currentIndex.entries = currentIndex.entries.filter((entry) => {
              const eId = (entry.id || '').toLowerCase().trim();
              const eName = (entry.name || '').toLowerCase().trim();
              return (
                !deletedKeys.includes(eId) &&
                !deletedKeys.includes(eName) &&
                !deletedKeys.includes(`synced-${eName}`)
              );
            });
            writeJsonFile(path.join('playlists', 'index.json'), currentIndex);
          }
          broadcastUpdate();
        }

        if (Array.isArray(pushData.user_profile)) {
          const localProfile = readJsonFile('user_profile.json', { listens: [] });
          const syncedProfile = readJsonFile('user_profile_sync.json', { listens: [] });
          const merged = mergeListenRecords(
            mergeListenRecords(localProfile.listens, syncedProfile.listens),
            pushData.user_profile,
          );
          if (JSON.stringify(merged) !== JSON.stringify(syncedProfile.listens)) {
            writeJsonFile('user_profile_sync.json', { ...syncedProfile, listens: merged });
            profileChanged = true;
          }
        }

        let blacklistChanged = false;
        if (pushData.blacklist && typeof pushData.blacklist === 'object') {
          const syncedProfile = readJsonFile('user_profile_sync.json', { listens: [] });
          const userProfile = readJsonFile('user_profile.json', { listens: [] });

          const currentSyncedTracks = Array.isArray(syncedProfile.blacklistedTracks)
            ? syncedProfile.blacklistedTracks
            : [];
          const currentSyncedArtists = Array.isArray(syncedProfile.blacklistedArtists)
            ? syncedProfile.blacklistedArtists
            : [];
          const currentLocalTracks = Array.isArray(userProfile.blacklistedTracks)
            ? userProfile.blacklistedTracks
            : [];
          const currentLocalArtists = Array.isArray(userProfile.blacklistedArtists)
            ? userProfile.blacklistedArtists
            : [];

          const incomingTracks = Array.isArray(pushData.blacklist.tracks)
            ? pushData.blacklist.tracks.filter((t) => typeof t === 'string' && t.trim().length > 0)
            : [];
          const incomingArtists = Array.isArray(pushData.blacklist.artists)
            ? pushData.blacklist.artists
                .filter((a) => typeof a === 'string' && a.trim().length > 0)
                .map((a) => String(a).trim().toLowerCase())
            : [];

          const mergedTracks = Array.from(
            new Set([
              ...currentSyncedTracks,
              ...currentLocalTracks,
              ...incomingTracks,
            ]),
          );
          const mergedArtists = Array.from(
            new Set([
              ...currentSyncedArtists,
              ...currentLocalArtists,
              ...incomingArtists,
            ]),
          );

          if (
            mergedTracks.length !== currentSyncedTracks.length ||
            mergedArtists.length !== currentSyncedArtists.length
          ) {
            syncedProfile.blacklistedTracks = mergedTracks;
            syncedProfile.blacklistedArtists = mergedArtists;
            writeJsonFile('user_profile_sync.json', syncedProfile);
            blacklistChanged = true;
          }
        }

        // 5. Merge Plugins & Active Providers from mobile into PC
        if (pushData.plugins) {
          const currentPlugins = readJsonFile('plugins.json', {});
          Object.assign(currentPlugins, pushData.plugins);
          writeJsonFile('plugins.json', currentPlugins);
        }
        if (pushData.activeProviders && typeof pushData.activeProviders === 'object') {
          const rawCurrentActive = readJsonFile('active-providers.json', {});
          const currentMap =
            rawCurrentActive &&
            typeof rawCurrentActive.active === 'object' &&
            rawCurrentActive.active !== null
              ? { ...rawCurrentActive.active }
              : { ...rawCurrentActive };
          delete currentMap.active;
          const incomingMap =
            pushData.activeProviders.active &&
            typeof pushData.activeProviders.active === 'object'
              ? pushData.activeProviders.active
              : pushData.activeProviders;
          Object.assign(currentMap, incomingMap);
          writeJsonFile('active-providers.json', { active: currentMap });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));

        // Notify other clients
        if (
          profileChanged ||
          blacklistChanged ||
          Object.keys(pushData).some((key) => key !== 'user_profile' && key !== 'blacklist')
        ) {
          broadcastUpdate();
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === '/api/settings') {
    const rawSettings = readJsonFile('settings.json', {});
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rawSettings));
    return;
  }

  if (url.pathname === '/api/queue') {
    const rawQueue = readJsonFile('queue.json', {});
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rawQueue));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const profileModule = fs.existsSync(path.join(__dirname, 'listeningProfile.mjs'))
  ? path.join(__dirname, 'listeningProfile.mjs')
  : path.join(__dirname, 'packages/player/src/services/listeningProfile.mjs');

import(pathToFileURL(profileModule).href).then((profile) => {
  mergeListenRecords = profile.mergeListenRecords;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Aurora PC Bidirectional Sync Server running on http://0.0.0.0:${server.address().port}`);
  });
});
