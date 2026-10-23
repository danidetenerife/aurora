# Original User Request

## 2026-10-23T10:01:24Z

Eliminate all unofficial, low-quality, or fan-subtitled videos on Aurora Google TV by strictly requiring verified official channels, fix premature track skipping before music videos finish playing, and compile and publish a new release to GitHub Releases.

Working directory: c:\Users\Danid\Desktop\proyectos\aurora
Integrity mode: development

## Requirements

### R1. Strict Official-Channel-Only Music Video Selection & Anti-Subtitle/Junk Filtering
Ensure `musicVideoService` and `TvVideoPlayer` only select and play music videos from authentic official channels (YouTube Verified Artist / Official Artist Badge `OFFICIAL_ARTIST_BADGE` / `BADGE_STYLE_TYPE_VERIFIED_ARTIST` / `BADGE_STYLE_TYPE_VERIFIED`, VEVO channels, or recognized official record label channels). Strictly reject any upload from unverified third-party or fan channels even if the video title contains "Official Video" or "Video Oficial". Reject all lyric videos, videos with burned-in or translated subtitles (`sub español`, `subtitulado`, `con letra`, `lyrics`, `lyric video`, `traducida`, `traducción`, `cc`, `subbed`), low-resolution reuploads (`240p`, `360p`, `480p`, `reupload`, `resubido`, `fan made`), karaoke, covers, and tributes. Enforce `cc_load_policy=0` and HD quality hints in the YouTube embed player, falling back cleanly to audio + cover art when no verified official music video exists.

### R2. Prevent Premature Skipping Before Music Videos Finish Playing
Fix the playback synchronization bug between `TvSoundProvider` (`<Sound>`) and `TvVideoPlayer` (`<iframe />`) where the background audio stream finishes earlier than the YouTube music video (due to video search/iframe load delay or longer music video intros/outros) and triggers `playbackManager.finishTrack()`, cutting off the music video before it ends. When a music video is active in `TvVideoPlayer` (`isVideoPlaying` / `targetVideoId` active), prevent the muted background `<Sound>` element from advancing the queue on audio end; ensure track completion is driven solely by the YouTube player's true end-of-video state (`onStateChange` `info === 0` from the active iframe) with deduplication so each video plays completely from start to finish.

### R3. Release Compilation & GitHub Auto-Update Publishing
Update `packages/player/changelog.json`, pass all quality gates (`pnpm type-check`, `pnpm lint`, `pnpm test`), compile the production frontend, Android/Google TV APK, and signed Windows desktop installer, and publish the new release to GitHub Releases (`scripts/build-and-publish.ps1`) so devices update automatically.

## Verification Resources

- TypeScript validation: `pnpm type-check`
- Linting validation: `pnpm lint`
- Automated test suite: `pnpm test` (specifically `packages/player/src/services/musicVideoService.test.ts`, `packages/player/src/services/musicVideoService.empirical.test.ts`, and TV playback/video player tests)
- Release & GitHub publishing pipeline: `scripts/build-and-publish.ps1`

## Acceptance Criteria

### Official Video & Anti-Subtitle Filtering
- [ ] Unverified third-party channels are rejected even when their video title includes the artist name, song title, and phrases like `(Official Video)` or `(Video Oficial)`.
- [ ] Videos containing subtitle/lyric markers (`sub español`, `subtitulado`, `con letra`, `lyrics`, `lyric video`, `traducida`, `traducción`, `subtitulos`, `cc`) or low-quality/fan markers (`240p`, `360p`, `480p`, `fan made`, `no oficial`, `unofficial`, `reupload`, `resubido`) are strictly rejected by `musicVideoService`.
- [ ] Only videos from verified channels (`ownerBadges` verified/artist badge), VEVO channels, or recognized official record labels (or verified artist channels) can pass candidate selection.
- [ ] `TvVideoPlayer` embed URL includes `cc_load_policy=0` and disables captions via postMessage while requesting HD playback quality.

### Full Video Playback Without Premature Skipping
- [ ] While `TvVideoPlayer` has an active video playing (`isVideoPlaying` / `targetVideoId`), the background `<Sound>` element's `onEnd` event in `TvSoundProvider` does not trigger `playbackManager.finishTrack()` or skip to the next track.
- [ ] `TvVideoPlayer` only advances to the next track when the active YouTube iframe emits `onStateChange` with `info === 0` (ended), validated against the current iframe source and guarded against duplicate end triggers.
- [ ] Automated tests verify both official-channel-only filtering (including subtitle/lyric rejection) and that background audio ending early does not cut off an active TV music video.

### Quality Gates & Release Delivery
- [ ] `pnpm type-check`, `pnpm lint`, and `pnpm test` pass with zero errors.
- [ ] A new release is compiled and published to GitHub Releases with updated APK and desktop installer assets.
