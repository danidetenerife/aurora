const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

test('packaged sync server merges devices without overwriting the live desktop store', async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-sync-test-'));
  const appData = path.join(directory, 'profile');
  fs.mkdirSync(appData);
  const root = path.resolve(__dirname, '../..');
  fs.copyFileSync(path.join(root, 'pc-sync-server.cjs'), path.join(directory, 'pc-sync-server.cjs'));
  fs.copyFileSync(path.join(root, 'packages/player/src/services/listeningProfile.mjs'), path.join(directory, 'listeningProfile.mjs'));
  const record = (device, playCount) => ({
    trackId: 'shared-song', title: 'Shared song', artist: 'Shared artist',
    durationMs: 180000, firstPlayedAt: 1000, lastPlayedAt: 2000,
    contributions: { [device]: { playCount, skipCount: 1, totalListenMs: playCount * 180000 } },
  });
  const localPath = path.join(appData, 'user_profile.json');
  fs.writeFileSync(localPath, JSON.stringify({ deviceId: 'desktop', listens: [record('desktop', 3)] }));
  const originalLocal = fs.readFileSync(localPath, 'utf8');
  const child = spawn(process.execPath, [path.join(directory, 'pc-sync-server.cjs')], {
    env: { ...process.env, AURORA_SYNC_PORT: '0', AURORA_SYNC_APP_DATA: appData },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  context.after(async () => {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
    assert.ok(path.resolve(directory).startsWith(path.join(os.tmpdir(), 'aurora-sync-test-')));
    fs.rmSync(directory, { recursive: true });
  });
  const [output] = await once(child.stdout, 'data');
  const port = output.toString().match(/:(\d+)/)[1];
  const url = `http://127.0.0.1:${port}/api/sync`;
  const push = async (listens) => {
    const response = await fetch(url + '/push', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_profile: listens }) });
    assert.equal(response.status, 200);
  };
  await push([record('mobile', 2)]);
  const first = await (await fetch(url)).json();
  assert.equal(first.user_profile[0].playCount, 5);
  assert.equal(first.user_profile[0].skipCount, 2);
  assert.equal(fs.readFileSync(localPath, 'utf8'), originalLocal);
  await push(first.user_profile);
  assert.deepEqual((await (await fetch(url)).json()).user_profile, first.user_profile);

  fs.writeFileSync(localPath, JSON.stringify({ deviceId: 'desktop', listens: [record('desktop', 4)] }));
  await push([record('mobile', 3)]);
  const updated = (await (await fetch(url)).json()).user_profile[0];
  assert.equal(updated.playCount, 7);
  assert.equal(updated.totalListenMs, 1260000);
  assert.equal(JSON.parse(fs.readFileSync(localPath, 'utf8')).deviceId, 'desktop');

  // Blacklist bidirectional merge
  const blacklistPushResponse = await fetch(url + '/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blacklist: { tracks: ['mobile-disliked-track'], artists: ['Mobile Annoying Band'] },
    }),
  });
  assert.equal(blacklistPushResponse.status, 200);

  const payloadWithBlacklist = await (await fetch(url)).json();
  assert.ok(payloadWithBlacklist.blacklist);
  assert.ok(payloadWithBlacklist.blacklist.tracks.includes('mobile-disliked-track'));
  assert.ok(payloadWithBlacklist.blacklist.artists.includes('mobile annoying band'));
});
