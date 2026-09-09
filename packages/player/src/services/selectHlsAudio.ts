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
  const selected =
    tracks.find((track) => isStereo(track) && isAacLc(track)) ??
    tracks.find((track) => !track.CHANNELS && isAacLc(track)) ??
    tracks.find(isStereo) ??
    tracks.find((track) => track.DEFAULT === 'YES') ??
    tracks[0];

  return selected ? new URL(selected.URI, manifestUrl).href : undefined;
};
