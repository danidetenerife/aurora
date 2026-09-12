import { selectHlsAudio } from './selectHlsAudio';

const MANIFEST_URL = 'https://example.com/music/master.m3u8';
const AUDIO_MANIFEST = `#EXTM3U
#EXT-X-MEDIA:URI="low.m3u8",TYPE=AUDIO,GROUP-ID="233",NAME="Default",DEFAULT=YES
#EXT-X-MEDIA:URI="stereo.m3u8",TYPE=AUDIO,GROUP-ID="234",NAME="Default",DEFAULT=YES
#EXT-X-STREAM-INF:BANDWIDTH=300694,CODECS="avc1.4D4015,mp4a.40.5",AUDIO="233"
low-video.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=385245,CODECS="avc1.4D4015,mp4a.40.2",AUDIO="234"
high-video.m3u8`;

describe('selectHlsAudio', () => {
  it('selects AAC-LC instead of the first HE-AAC rendition from Android manifests', () => {
    expect(selectHlsAudio(AUDIO_MANIFEST, MANIFEST_URL)).toBe(
      'https://example.com/music/stereo.m3u8',
    );
  });

  it('preserves signed absolute URLs and handles CRLF manifests', () => {
    const signedUrl = 'https://audio.example.com/playlist?sig=abc&expires=123';
    const manifest = AUDIO_MANIFEST.replace(
      'stereo.m3u8',
      signedUrl,
    ).replaceAll('\n', '\r\n');
    expect(selectHlsAudio(manifest, MANIFEST_URL)).toBe(signedUrl);
  });

  it('prefers declared stereo over a declared mono AAC-LC rendition', () => {
    const manifest = AUDIO_MANIFEST.replace(
      'GROUP-ID="233"',
      'GROUP-ID="233",CHANNELS="2"',
    ).replace('GROUP-ID="234"', 'GROUP-ID="234",CHANNELS="1"');
    expect(selectHlsAudio(manifest, MANIFEST_URL)).toBe(
      'https://example.com/music/low.m3u8',
    );
  });

  it('keeps a playable fallback when AAC-LC is unavailable', () => {
    const manifest = '#EXT-X-MEDIA:TYPE=AUDIO,URI="only.m3u8",GROUP-ID="audio"';
    expect(selectHlsAudio(manifest, MANIFEST_URL)).toBe(
      'https://example.com/music/only.m3u8',
    );
  });

  it('does not choose subtitles or video-only playlists', () => {
    const manifest = `#EXTM3U
#EXT-X-MEDIA:TYPE=SUBTITLES,URI="subtitles.m3u8",GROUP-ID="vtt"
#EXT-X-STREAM-INF:BANDWIDTH=100000,CODECS="avc1.4D4015"
video.m3u8`;
    expect(selectHlsAudio(manifest, MANIFEST_URL)).toBeUndefined();
  });

  it('prefers DEFAULT=YES track over a preceding non-default language track', () => {
    const multiLangManifest = `#EXTM3U
#EXT-X-MEDIA:URI="japanese.m3u8",TYPE=AUDIO,GROUP-ID="audio",NAME="Japanese",LANGUAGE="ja",DEFAULT=NO,CHANNELS="2"
#EXT-X-MEDIA:URI="spanish_default.m3u8",TYPE=AUDIO,GROUP-ID="audio",NAME="Spanish",LANGUAGE="es",DEFAULT=YES,CHANNELS="2"
#EXT-X-STREAM-INF:BANDWIDTH=385245,CODECS="avc1.4D4015,mp4a.40.2",AUDIO="audio"
video.m3u8`;
    expect(selectHlsAudio(multiLangManifest, MANIFEST_URL)).toBe(
      'https://example.com/music/spanish_default.m3u8',
    );
  });

  it('filters out auto-dubbed renditions and selects the original Spanish track', () => {
    const multiLangManifest = `#EXTM3U
#EXT-X-MEDIA:URI="arabic_dubbed.m3u8?acont=dubbed-auto:lang=ar",TYPE=AUDIO,GROUP-ID="234",NAME="Arabic (auto-dubbed)",AUTOSELECT=YES,DEFAULT=NO,CHANNELS="2"
#EXT-X-MEDIA:URI="english_dubbed.m3u8?acont=dubbed-auto:lang=en",TYPE=AUDIO,GROUP-ID="234",NAME="English (auto-dubbed)",AUTOSELECT=YES,DEFAULT=NO,CHANNELS="2"
#EXT-X-MEDIA:URI="spanish_orig.m3u8?acont=original",TYPE=AUDIO,GROUP-ID="234",NAME="Original (español)",LANGUAGE="es",AUTOSELECT=YES,DEFAULT=YES,CHANNELS="2"
#EXT-X-STREAM-INF:BANDWIDTH=385245,CODECS="avc1.4D4015,mp4a.40.2",AUDIO="234"
video.m3u8`;
    expect(selectHlsAudio(multiLangManifest, MANIFEST_URL)).toBe(
      'https://example.com/music/spanish_orig.m3u8?acont=original',
    );
  });

  it('leaves media playlists without alternate audio unchanged', () => {
    expect(
      selectHlsAudio('#EXTM3U\n#EXTINF:6,\nsegment.ts', MANIFEST_URL),
    ).toBeUndefined();
  });
});
