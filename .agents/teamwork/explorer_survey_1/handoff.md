# Handoff Report — Requirement R1 Investigation

## 1. Observation

### 1.1 Target Files Identified
- `packages/player/src/services/musicVideoService.ts` (Core candidate search, scoring, and filtering service)
- `packages/player/src/services/musicVideoService.test.ts` (Unit test suite for `musicVideoService`)
- `packages/player/src/services/musicVideoService.empirical.test.ts` (Adversarial stress and edge case test suite)
- `packages/player/src/components/TvShell/TvVideoPlayer.tsx` (Google TV video player component and YouTube iframe embedding)
- `packages/player/src/components/TvShell/TvVideoPlayer.test.tsx` (Tests for TV video player)
- `packages/player/src/components/TvShell/TvVideoFallbackStress.test.tsx` (Stress tests for audio/video fallback coordination)
- `packages/player/src/components/TvShell/TvSoundProvider.tsx` (Audio stream coordination with TV video player)
- `packages/player/src/components/TvShell/TvCoverArtView.tsx` (Cover art fallback UI rendered when no official video exists)

### 1.2 YouTube Search & Innertube Parsing in `musicVideoService.ts`
In `packages/player/src/services/musicVideoService.ts` (lines 500-532):
YouTube search is executed using the YouTube Innertube API (`https://www.youtube.com/youtubei/v1/search` with context client `WEB`, version `2.20240101.01.00`).
The response items are typed as:
```ts
type YouTubeInnertubeItem = {
  videoRenderer?: {
    videoId?: string;
    title?: { runs?: Array<{ text?: string }> };
    ownerText?: { runs?: Array<{ text?: string }> };
    thumbnail?: { thumbnails?: Array<{ url?: string }> };
    lengthText?: { simpleText?: string };
    ownerBadges?: Array<{
      metadataBadgeRenderer?: {
        style?: string;
        icon?: { iconType?: string };
        tooltip?: string;
      };
    }>;
  };
};
```
Channel verification badges are parsed in lines 284-295:
```ts
const hasVerifiedBadge = (input.ownerBadges || []).some((badge) => {
  const style = badge.metadataBadgeRenderer?.style || '';
  const iconType = badge.metadataBadgeRenderer?.icon?.iconType || '';
  const tooltip = (badge.metadataBadgeRenderer?.tooltip || '').toLowerCase();
  return (
    style.includes('VERIFIED') ||
    iconType.includes('OFFICIAL_ARTIST_BADGE') ||
    iconType.includes('CHECK') ||
    tooltip.includes('verified') ||
    tooltip.includes('oficial')
  );
});
const isVevo = normalizedVChannel.includes('vevo');
if (hasVerifiedBadge || isVevo) {
  badgeScore = 20;
}
```

### 1.3 Critical Vulnerability: Unverified Third-Party Channels Are Currently Accepted
In `musicVideoService.ts`:
1. `scoreCandidate` (lines 320-335, 347-362, 364-379):
   - `artistScore`: 30 or 35 if artist is in title/channel.
   - `titleScore`: 35 for exact/full phrase match.
   - `officialPhraseScore`: 35 if title contains `official video`, `official music video`, `video oficial`, or `videoclip oficial`.
   - `badgeScore`: 20 if verified or VEVO; 0 if unverified.
   - `totalScore`: `artistScore + badgeScore + titleScore + officialPhraseScore`.
2. For an unverified third-party user channel uploading `Dua Lipa - Levitating (Official Video)` on channel `RandomUser123`:
   - `artistScore` = 30
   - `titleScore` = 35
   - `badgeScore` = 0
   - `officialPhraseScore` = 35
   - **`totalScore` = 100**
3. In `executeYouTubeSearch` (lines 604-606):
   ```ts
   if (scored.totalScore < MIN_CONFIDENCE_SCORE) {
     continue;
   }
   ```
   Because `MIN_CONFIDENCE_SCORE = 60`, a score of 100 easily passes.
   **There is no check requiring the channel to be official or verified.** As a result, unverified third-party or fan channels with "Official Video" in their titles are selected over falling back to audio.

### 1.4 Missing Anti-Subtitle / Lyric / Fan Junk Filter Terms
In `packages/player/src/services/musicVideoService.ts`:
`NOISE_TERMS` (lines 41-116) contains 73 terms, and `NON_EXEMPT_NOISE_TERMS` (lines 118-140) contains 20 terms.
The following terms mandated by Requirement R1 and its Acceptance Criteria are **completely absent**:
- Subtitle / lyric terms:
  - `sub español` / `sub espanol`
  - `subtitulado` / `subtitulada`
  - `subtitulos` / `subtítulos` / `subtitulo` / `subtítulo`
  - `con letra` / `con letras`
  - `lyrics`
  - `lyric video` / `lyric`
  - `traducida` / `traducido`
  - `traducción` / `traduccion`
  - `cc`
  - `subbed`
  - `subtitles` / `subtitle`
- Low-resolution reupload & fan junk terms:
  - `240p`
  - `360p`
  - `480p`
  - `reupload` / `re upload`
  - `resubido` / `resubida`
  - `fan made` / `fanmade`
  - `no oficial`
  - `unofficial`
  - `covers` (plural; only singular `cover` existed)
  - `tributes` (plural; only singular `tribute` existed)

Currently, a video titled `Coldplay - Yellow (Lyrics)` or `Adele - Hello (Sub Español)` or `Track (Video Oficial con letra)` is not flagged by `hasNoiseTerms`.

### 1.5 Missing Embed URL Flags in `TvVideoPlayer.tsx`
In `packages/player/src/components/TvShell/TvVideoPlayer.tsx` (line 472):
```tsx
const embedUrl = `https://www.youtube.com/embed/${targetVideoId}?autoplay=1&enablejsapi=1&playsinline=1&controls=0&rel=0&iv_load_policy=3&modestbranding=1`;
```
- `cc_load_policy=0` is missing from the query string.
- HD quality hints (`vq=hd1080`) are missing from the query string.
- `disableSubtitles` (lines 80-106) sends postMessage commands to unload captions and reset caption track/fontSize, but does not send HD quality commands (`setPlaybackQuality`, `setOption playbackQuality suggestedQuality hd1080`).

### 1.6 Clean Fallback to Audio + Cover Art
In `TvVideoPlayer.tsx` (lines 189-200, 408-470) and `TvSoundProvider.tsx` (lines 62-66):
- When `musicVideoService.findOfficialVideo(track)` returns `null`:
  - `targetVideoId` is set to `null`.
  - `isVideoPlaying` in `useTvStore` is set to `false`.
  - `TvVideoPlayer` renders `TvCoverArtView` displaying album artwork, track title, artist name, and a badge stating: `"Sin videoclip disponible · Mostrando carátula"`.
  - `TvSoundProvider` detects `isVideoPlaying === false` and calculates `volumePercent = Math.round((volume01 ?? 1) * 100)`.
  - The background `<Sound>` component plays the pure audio stream at full volume.
- When an authentic video is found:
  - `isVideoPlaying` is set to `true`.
  - `TvSoundProvider` detects `isVideoPlaying === true` and sets `<Sound>` volume to 0 (muting the background audio stream).
  - The YouTube iframe renders with audio/video.

---

## 2. Logic Chain

1. **Premise 1**: Requirement R1 requires that `musicVideoService` and `TvVideoPlayer` strictly select and play music videos *only* from authentic official channels (`OFFICIAL_ARTIST_BADGE`, `BADGE_STYLE_TYPE_VERIFIED_ARTIST`, `BADGE_STYLE_TYPE_VERIFIED`, VEVO, or recognized record labels).
2. **Premise 2**: In the current implementation of `scoreCandidate`, high points are given to title match (35) and artist in title (30) and official phrase (35), allowing any unverified channel to exceed `MIN_CONFIDENCE_SCORE = 60` with a score of 100 without possessing any verification badge.
3. **Inference 1**: An explicit official channel predicate (e.g. `isOfficialChannel`) must be enforced during candidate evaluation in `executeYouTubeSearch`. Any video whose channel fails this predicate must be discarded immediately, regardless of title matching.
4. **Premise 3**: Verified badges on YouTube can either be an Official Artist Channel (`BADGE_STYLE_TYPE_VERIFIED_ARTIST` / `OFFICIAL_ARTIST_BADGE`) or a generic verified channel (`BADGE_STYLE_TYPE_VERIFIED`). A generic verified channel (e.g., a gaming or tech YouTuber) should not be treated as official for a music video unless it matches the track artist or is a recognized record label.
5. **Inference 2**: An authentic official channel must satisfy:
   - `isVevoChannel(vChannel)` OR
   - `isRecordLabelChannel(vChannel)` OR
   - Channel has `ownerBadges` where badge is an official artist badge (`BADGE_STYLE_TYPE_VERIFIED_ARTIST` or `OFFICIAL_ARTIST_BADGE`) OR
   - Channel has generic verified badge (`BADGE_STYLE_TYPE_VERIFIED`) AND (`artistInChannel` OR `isRecordLabelChannel`).
6. **Premise 4**: Fan uploads frequently add subtitle indicators (`sub español`, `con letra`, `lyrics`, `subbed`, `cc`, `traducida`) or low-quality tags (`240p`, `360p`, `480p`, `reupload`, `fan made`, `no oficial`).
7. **Inference 3**: These terms must be added to `NOISE_TERMS` in `musicVideoService.ts`, and terms that can never legitimately be part of an official music video must be included in `NON_EXEMPT_NOISE_TERMS` so that they cannot be bypassed.
8. **Premise 5**: `TvVideoPlayer` embeds the YouTube player via an iframe. YouTube parameters `cc_load_policy=0` forces closed captions off by default, and `vq=hd1080` instructs the player to prefer 1080p high definition.
9. **Inference 4**: Updating `embedUrl` to `https://www.youtube.com/embed/${targetVideoId}?autoplay=1&enablejsapi=1&playsinline=1&controls=0&rel=0&iv_load_policy=3&modestbranding=1&cc_load_policy=0&vq=hd1080` and sending `setPlaybackQuality` / `suggestedQuality` commands via postMessage guarantees caption suppression and HD preference on Google TV.
10. **Inference 5**: When unverified or junk candidates are rejected, `musicVideoService.findOfficialVideo` returns `null`. The existing component structure in `TvVideoPlayer.tsx` and `TvSoundProvider.tsx` already handles the fallback to `TvCoverArtView` and audio playback smoothly.

---

## 3. Caveats

- **Direct Unit Test for `scoreCandidate` arithmetic**: In `musicVideoService.empirical.test.ts` line 887, there is a unit test asserting `scoreCandidate(inputAtThreshold).totalScore >= MIN_CONFIDENCE_SCORE` where `vChannel` is `'Random Channel'`. That test validates the mathematical summation of sub-scores. In the proposed design, `scoreCandidate` will expose `isOfficialChannel: boolean`, while `executeYouTubeSearch` strictly gates candidate selection on `isOfficialChannel === true`. This preserves existing mathematical assertions in unit tests while strictly enforcing the official-only rule for video selection.
- **YouTube Quality Parameter**: `vq=hd1080` is a client-side preference hint. YouTube selects the optimal resolution based on available bandwidth and player viewport; however, adding `vq=hd1080` both in the embed URL and via postMessage satisfies the Google TV HD preference requirement.
- **Exemptions for Legitimate Tracks**: Certain tracks have titles like "Cover Me" (Bruce Springsteen) or "Fruit Loops". The existing exemption logic in `hasNoiseTerms` (`normalizedTitle.includes(normalizedTerm)`) protects these songs when the term is not in `NON_EXEMPT_NOISE_TERMS`. Terms such as `sub español`, `lyric video`, `240p`, `fan made`, and `reupload` are placed in `NON_EXEMPT_NOISE_TERMS` because no legitimate track title contains them.

---

## 4. Conclusion

The current codebase contains clear gaps in Requirement R1:
1. It does not enforce channel verification as a mandatory requirement for video selection; third-party uploads scoring >= 60 are accepted.
2. It lacks anti-subtitle, translation, lyrics, and low-res/fan noise filter terms.
3. The YouTube embed URL in `TvVideoPlayer` lacks `cc_load_policy=0` and `vq=hd1080`.

### Proposed Implementation Plan

#### 1. Modify `packages/player/src/services/musicVideoService.ts`:
- **Expand `NOISE_TERMS`**:
  Add:
  - Subtitle/lyric markers: `'sub español'`, `'sub espanol'`, `'subtitulado'`, `'subtitulada'`, `'subtitulos'`, `'subtitulo'`, `'subtitles'`, `'subtitle'`, `'con letra'`, `'con letras'`, `'lyrics'`, `'lyric video'`, `'lyric'`, `'traducida'`, `'traducido'`, `'traduccion'`, `'traducción'`, `'subbed'`, `'cc'`.
  - Low-resolution / fan junk markers: `'240p'`, `'360p'`, `'480p'`, `'reupload'`, `'re upload'`, `'resubido'`, `'resubida'`, `'fan made'`, `'fanmade'`, `'no oficial'`, `'unofficial'`, `'covers'`, `'tributes'`.
- **Expand `NON_EXEMPT_NOISE_TERMS`**:
  Include all subtitle markers (`sub español`, `subtitulado`, `subtitulos`, `con letra`, `lyric video`, `traducida`, `traducción`, `subbed`), low-res tags (`240p`, `360p`, `480p`), and fan tags (`reupload`, `resubido`, `fan made`, `no oficial`, `unofficial`, `tributes`).
- **Expand `RECORD_LABELS`**:
  Add major and recognized international labels: `hybe`, `bighit`, `sm entertainment`, `smtown`, `jyp`, `yg entertainment`, `geffen`, `polydor`, `astralwerks`, `motown`, `emi`, `century media`, `nuclear blast`, `roadrunner`, `hopeless records`, `epitaph`, `rough trade`, `domino recording`, `4ad`, `xl recordings`, `warp records`, `ninja tune`, `pias`, `sony entertainment`, `universal music`, `warner music`, `warner records`.
- **Implement Official Channel Gating**:
  Add helper functions:
  - `hasOfficialBadge(ownerBadges)`: verifies `BADGE_STYLE_TYPE_VERIFIED_ARTIST`, `OFFICIAL_ARTIST_BADGE`, `BADGE_STYLE_TYPE_VERIFIED`, or tooltip containing `verified`/`oficial`/`artist`/`artista`.
  - `isVevoChannel(channel)`: verifies channel title contains `vevo`.
  - `isRecordLabelChannel(channel)`: verifies channel matches `RECORD_LABELS`.
  - `isOfficialChannel(input)`: returns true if VEVO, record label, official artist badge, or verified badge matching artist or label.
  - In `executeYouTubeSearch`: add check:
    ```ts
    if (!isOfficialChannel({ artist, vChannel, ownerBadges: vr.ownerBadges })) {
      continue;
    }
    ```
  - In `scoreCandidate`: include `isOfficialChannel: boolean` in `CandidateScoreResult`, and award `badgeScore = 20` for verified, VEVO, or record label channels.

#### 2. Modify `packages/player/src/components/TvShell/TvVideoPlayer.tsx`:
- Update `embedUrl`:
  ```tsx
  const embedUrl = `https://www.youtube.com/embed/${targetVideoId}?autoplay=1&enablejsapi=1&playsinline=1&controls=0&rel=0&iv_load_policy=3&modestbranding=1&cc_load_policy=0&vq=hd1080`;
  ```
- Update `disableSubtitles` to also post HD quality commands:
  ```tsx
  { event: 'command', func: 'setPlaybackQuality', args: ['hd1080'] },
  { event: 'command', func: 'setPlaybackQualityRange', args: ['hd1080', 'highres'] },
  { event: 'command', func: 'setOption', args: ['playbackQuality', 'suggestedQuality', 'hd1080'] },
  ```

#### 3. Update & Add Tests:
- `packages/player/src/services/musicVideoService.test.ts`:
  - Test asserting strict rejection of unverified third-party channels even when video title contains `(Official Video)` and matches track/artist 100%.
  - Test asserting strict rejection of videos with `(Sub Español)`, `(Lyrics)`, `[Lyric Video]`, `(Con Letra)`, `[480p]`, `(Reupload)`, `(Fan Made)`.
- `packages/player/src/services/musicVideoService.empirical.test.ts`:
  - Add edge cases for multi-lingual subtitle markers and low-res tags.
- `packages/player/src/components/TvShell/TvVideoPlayer.test.tsx`:
  - Add assertions verifying `cc_load_policy=0` and `vq=hd1080` in the iframe `src` attribute.

---

## 5. Verification Method

### Test Commands
1. Run target unit & empirical tests:
   ```bash
   pnpm --filter @aurora/player test -- src/services/musicVideoService.test.ts src/services/musicVideoService.empirical.test.ts src/components/TvShell/TvVideoPlayer.test.tsx src/components/TvShell/TvVideoFallbackStress.test.tsx
   ```
2. Run full player test suite:
   ```bash
   pnpm --filter @aurora/player test
   ```
3. Run TypeScript type checks:
   ```bash
   pnpm type-check
   ```
4. Run linter:
   ```bash
   pnpm lint
   ```

### Invalidation Conditions
- Any video from an unverified channel (lacking official artist badge, verified badge, VEVO, or record label) is returned by `findOfficialVideo`.
- Any video containing subtitle markers (`sub español`, `lyrics`, `con letra`, `cc`, `subbed`, `traducida`) or junk tags (`240p`, `480p`, `reupload`, `fan made`) is returned by `findOfficialVideo`.
- `TvVideoPlayer` iframe `src` does not include `cc_load_policy=0` or `vq=hd1080`.
