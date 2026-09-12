const AAC_LC_CODEC = 'mp4a.40.2';
const STEREO_CHANNELS = '2';

const parseAttributes = (line: string): Record<string, string> =>
  Object.fromEntries(
    Array.from(
      line
        .slice(line.indexOf(':') + 1)
        .matchAll(/([\w-]+)=(?:"([^"]*)"|([^,]*))/g),
      ([, name, quoted, unquoted]) => [name, quoted ?? unquoted],
    ),
  );

const isNotDubbed = (track: Record<string, string>): boolean => {
  const uri = (track.URI ?? '').toLowerCase();
  const name = (track.NAME ?? '').toLowerCase();
  return (
    !uri.includes('dubbed-auto') &&
    !uri.includes('dubbed') &&
    !name.includes('dubbed')
  );
};

const isSpanish = (track: Record<string, string>): boolean => {
  const lang = (track.LANGUAGE ?? '').toLowerCase();
  const name = (track.NAME ?? '').toLowerCase();
  const uri = (track.URI ?? '').toLowerCase();
  return (
    lang.startsWith('es') ||
    lang === 'spa' ||
    name.includes('español') ||
    name.includes('spanish') ||
    uri.includes('lang=es') ||
    uri.includes('lang%3des')
  );
};

const isOriginal = (track: Record<string, string>): boolean => {
  const uri = (track.URI ?? '').toLowerCase();
  const name = (track.NAME ?? '').toLowerCase();
  return uri.includes('acont=original') || name.includes('original');
};

export const selectHlsAudio = (
  manifest: string,
  manifestUrl: string,
): string | undefined => {
  const lines = manifest.split(/\r?\n/).map((line) => line.trim());
  const aacGroups = new Set(
    lines
      .filter((line) => line.startsWith('#EXT-X-STREAM-INF:'))
      .map(parseAttributes)
      .filter((variant) => variant.CODECS?.split(',').includes(AAC_LC_CODEC))
      .map((variant) => variant.AUDIO),
  );
  const tracks = lines
    .filter((line) => line.startsWith('#EXT-X-MEDIA:'))
    .map(parseAttributes)
    .filter((track) => track.TYPE === 'AUDIO' && track.URI);
  const isStereo = (track: Record<string, string>) =>
    track.CHANNELS === STEREO_CHANNELS;
  const isAacLc = (track: Record<string, string>) =>
    aacGroups.has(track['GROUP-ID']);

  if (tracks.length === 0) {
    return undefined;
  }

  const nonDubbed = tracks.filter(isNotDubbed);
  const basePool = nonDubbed.length > 0 ? nonDubbed : tracks;

  const spanishTracks = basePool.filter(isSpanish);
  const originalTracks = basePool.filter(isOriginal);
  const languagePool =
    spanishTracks.length > 0
      ? spanishTracks
      : originalTracks.length > 0
        ? originalTracks
        : basePool;

  const defaultTracks = languagePool.filter((track) => track.DEFAULT === 'YES');
  const pool = defaultTracks.length > 0 ? defaultTracks : languagePool;


  const selected =
    pool.find((track) => isStereo(track) && isAacLc(track)) ??
    pool.find((track) => !track.CHANNELS && isAacLc(track)) ??
    pool.find(isStereo) ??
    pool.find((track) => isAacLc(track)) ??
    pool[0] ??
    tracks.find((track) => track.DEFAULT === 'YES') ??
    tracks[0];

  return selected ? new URL(selected.URI, manifestUrl).href : undefined;
};
