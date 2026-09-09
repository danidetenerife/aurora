const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');
let mergeListenRecords;

const PORT = Number(process.env.AURORA_SYNC_PORT || 4122);
const APP_DATA = process.env.AURORA_SYNC_APP_DATA || path.join(os.homedir(), 'AppData', 'Roaming', 'com.nuclearplayer');

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
  const playlists = readPlaylists();
  const playlistIndex = readPlaylistIndex();
  const userProfile = readJsonFile('user_profile.json', { listens: [] });
  const syncedProfile = readJsonFile('user_profile_sync.json', { listens: [] });

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
    activeProviders: rawActiveProviders,
    queue: rawQueue,
    playlists,
    playlistIndex,
    user_profile: mergeListenRecords(userProfile.listens, syncedProfile.listens),
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
    res.end(JSON.stringify({ status: 'ok', server: 'nuclear-p2p-sync' }));
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
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
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
        if (pushData.settings) {
          const currentSettings = readJsonFile('settings.json', {});
          Object.assign(currentSettings, pushData.settings);
          writeJsonFile('settings.json', currentSettings);
        }

        // 3. Save Playlists from mobile into PC AppData/playlists/
        if (pushData.playlists && Array.isArray(pushData.playlists)) {
          const playlistsDir = path.join(APP_DATA, 'playlists');
          if (!fs.existsSync(playlistsDir)) {
            fs.mkdirSync(playlistsDir, { recursive: true });
          }
          const indexEntries = [];
          for (const rawPl of pushData.playlists) {
            const pl = rawPl.playlist || rawPl;
            if (pl && pl.name && pl.id) {
              fs.writeFileSync(
                path.join(playlistsDir, `${pl.id}.json`),
                JSON.stringify({ playlist: pl }, null, 2),
                'utf8',
              );
              indexEntries.push({
                id: pl.id,
                name: pl.name,
                itemCount: (pl.items || []).length,
                createdAtIso: pl.createdAtIso || new Date().toISOString(),
                lastModifiedIso: pl.lastModifiedIso || new Date().toISOString(),
                isReadOnly: false,
                thumbnails: pl.artwork?.items?.map((i) => i.url) || [],
                totalDurationMs: (pl.items || []).reduce(
                  (acc, item) => acc + (item.track?.durationMs || 0),
                  0,
                ),
              });
            }
          }
          if (indexEntries.length > 0) {
            writeJsonFile(path.join('playlists', 'index.json'), {
              entries: indexEntries,
            });
          }
        }

        if (Array.isArray(pushData.user_profile)) {
          const localProfile = readJsonFile('user_profile.json', { listens: [] });
          const syncedProfile = readJsonFile('user_profile_sync.json', { listens: [] });
          const merged = mergeListenRecords(
            mergeListenRecords(localProfile.listens, syncedProfile.listens),
            pushData.user_profile,
          );
          if (JSON.stringify(merged) !== JSON.stringify(syncedProfile.listens)) {
            writeJsonFile('user_profile_sync.json', { listens: merged });
            profileChanged = true;
          }
        }

        // 5. Merge Plugins & Active Providers from mobile into PC
        if (pushData.plugins) {
          const currentPlugins = readJsonFile('plugins.json', {});
          Object.assign(currentPlugins, pushData.plugins);
          writeJsonFile('plugins.json', currentPlugins);
        }
        if (pushData.activeProviders) {
          const currentActive = readJsonFile('active-providers.json', {});
          Object.assign(currentActive, pushData.activeProviders);
          writeJsonFile('active-providers.json', currentActive);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));

        // Notify other clients
        if (profileChanged || Object.keys(pushData).some((key) => key !== 'user_profile')) broadcastUpdate();
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
    console.log(`Nuclear PC Bidirectional Sync Server running on http://0.0.0.0:${server.address().port}`);
  });
});
