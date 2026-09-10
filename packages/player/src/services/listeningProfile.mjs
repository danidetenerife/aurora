const DEFAULT_DURATION_MS = 180_000;
const LEGACY_COMPLETION = 0.7;
const COUNTERS = ['playCount', 'skipCount', 'immediateSkipCount', 'totalListenMs'];
const nonnegative = (value, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback;

const normalizeCounters = (raw) =>
  Object.fromEntries(COUNTERS.map((key) => [key, nonnegative(raw?.[key])]));

export const normalizeListen = (raw) => {
  if (!raw || typeof raw.trackId !== 'string' || !raw.trackId) {
    return null;
  }
  const durationMs = nonnegative(raw.durationMs, DEFAULT_DURATION_MS);
  const playCount = nonnegative(raw.playCount, 1);
  const contributions = Object.fromEntries(
    raw.contributions && typeof raw.contributions === 'object'
      ? Object.entries(raw.contributions).map(([device, counters]) => [
          device,
          normalizeCounters(counters),
        ])
      : [
          [
            'legacy',
            normalizeCounters({
              playCount,
              skipCount: raw.skipCount,
              immediateSkipCount: raw.immediateSkipCount,
              totalListenMs: nonnegative(
                raw.totalListenMs,
                playCount * durationMs * LEGACY_COMPLETION,
              ),
            }),
          ],
        ],
  );
  const totals = Object.fromEntries(
    COUNTERS.map((key) => [
      key,
      Object.values(contributions).reduce(
        (total, counters) => total + (counters[key] ?? 0),
        0,
      ),
    ]),
  );
  const genres = Array.isArray(raw.genres)
    ? raw.genres.filter((g) => typeof g === 'string' && g.trim().length > 0)
    : [];

  return {
    trackId: raw.trackId,
    title: typeof raw.title === 'string' ? raw.title : '',
    artist: typeof raw.artist === 'string' ? raw.artist : 'Unknown',
    durationMs,
    firstPlayedAt: nonnegative(
      raw.firstPlayedAt,
      nonnegative(raw.lastPlayedAt),
    ),
    lastPlayedAt: nonnegative(raw.lastPlayedAt),
    ...(raw.source ? { source: raw.source } : {}),
    ...(raw.artistSource ? { artistSource: raw.artistSource } : {}),
    ...(genres.length > 0 ? { genres } : {}),
    contributions,
    ...totals,
  };
};

export const mergeListenRecords = (local, remote) => {
  const records = new Map();
  for (const raw of [
    ...(Array.isArray(local) ? local : []),
    ...(Array.isArray(remote) ? remote : []),
  ]) {
    const incoming = normalizeListen(raw);
    if (!incoming) {
      continue;
    }
    const existing = records.get(incoming.trackId);
    if (!existing) {
      records.set(incoming.trackId, incoming);
      continue;
    }
    const contributions = { ...existing.contributions };
    for (const [device, counters] of Object.entries(incoming.contributions)) {
      contributions[device] = Object.fromEntries(
        COUNTERS.map((key) => [
          key,
          Math.max(contributions[device]?.[key] ?? 0, counters[key] ?? 0),
        ]),
      );
    }
    const latest =
      incoming.lastPlayedAt > existing.lastPlayedAt ? incoming : existing;
    const mergedGenres = Array.from(
      new Set([...(existing.genres || []), ...(incoming.genres || [])]),
    );
    records.set(
      incoming.trackId,
      normalizeListen({
        ...existing,
        ...latest,
        source: latest.source ?? existing.source ?? incoming.source,
        artistSource:
          latest.artistSource ?? existing.artistSource ?? incoming.artistSource,
        genres: mergedGenres.length > 0 ? mergedGenres : undefined,
        contributions,
        firstPlayedAt: Math.min(existing.firstPlayedAt, incoming.firstPlayedAt),
        lastPlayedAt: Math.max(existing.lastPlayedAt, incoming.lastPlayedAt),
      }),
    );
  }
  return [...records.values()].sort(
    (first, second) =>
      second.lastPlayedAt - first.lastPlayedAt ||
      first.trackId.localeCompare(second.trackId),
  );
};
