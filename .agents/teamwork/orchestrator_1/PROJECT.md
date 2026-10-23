# Project: Aurora TV Music Video Filtering, Playback Sync & Release v1.48.77

## Architecture
- **Service Layer (`musicVideoService.ts`)**: Evaluates YouTube Innertube search results for official channel status, badges (`ownerBadges`, `OFFICIAL_ARTIST_BADGE`, `BADGE_STYLE_TYPE_VERIFIED_ARTIST`, `BADGE_STYLE_TYPE_VERIFIED`), VEVO, recognized record labels, and rejects noise/subtitles/lyrics/fan uploads. Clean fallback returns `null`.
- **UI & Player Layer (`TvVideoPlayer.tsx`)**: Embeds YouTube iframe with `cc_load_policy=0&vq=hd1080`, enforces postMessage origin validation, suppresses subtitles and requests HD, syncs active video state to `tvStore`, renders `TvCoverArtView` on fallback, and deduplicates `onStateChange` ended events.
- **State Layer (`tvStore.ts`)**: Manages `showVideo`, `isVideoPlaying`, and `targetVideoId` so `TvSoundProvider` and other TV components have shared truth about active video playback.
- **Playback Coordination (`TvSoundProvider.tsx`)**: Mutes background audio when video is active, and suppresses `playbackManager.finishTrack()` on audio `onEnd` when video is active, allowing the YouTube video to finish completely.
- **Release Pipeline (`build-and-publish.ps1`)**: Prepends `changelog.json`, runs turbo quality gates (`type-check`, `lint`, `test`), bumps version to `1.48.77`, compiles frontend, builds Android/Google TV APK (`aurora-music-player.apk`), builds signed Windows desktop installer (`Aurora_1.48.77_x64-setup.exe`), signs with minisign, creates `latest.json`, commits and tags git, and publishes to GitHub Releases via `gh`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Official Channel Gating | Require `isOfficialChannel` (official artist badge, VEVO, record labels, or verified artist) before candidate selection in `musicVideoService.ts` | M1 | Survey (R1) |
| F2 | Anti-Subtitle & Lyric Filtering | Reject `sub español`, `subtitulado`, `con letra`, `lyrics`, `lyric video`, `traducida`, `traducción`, `cc`, `subbed` in `musicVideoService.ts` | M1 | Survey (R1) |
| F3 | Low-Res & Fan Junk Filtering | Reject `240p`, `360p`, `480p`, `reupload`, `resubido`, `fan made`, `no oficial`, `unofficial`, `covers`, `tributes` in `musicVideoService.ts` | M1 | Survey (R1) |
| F4 | Expanded Record Label Registry | Add global major/indie labels (`hybe`, `sm entertainment`, `yg`, `jyp`, `geffen`, `polydor`, `nuclear blast`, etc.) in `musicVideoService.ts` | M1 | Survey (R1) |
| F5 | Clean Audio+Cover Fallback | Ensure fallback to `TvCoverArtView` with unmuted audio stream when no verified video is found | M1 | Survey (R1) |
| F6 | YouTube Embed CC & HD Settings | Include `cc_load_policy=0&vq=hd1080` in embed URL and postMessage quality commands in `TvVideoPlayer.tsx` | M1 | Survey (R1) |
| F7 | `targetVideoId` in TV Store | Add `targetVideoId: string \| null` and setter to `tvStore.ts` synced by `TvVideoPlayer` | M2 | Survey (R2) |
| F8 | Background Audio End Guard | Prevent `TvSoundProvider` `handleEnd` from calling `finishTrack()` while `showVideo && (isVideoPlaying \|\| targetVideoId)` | M2 | Survey (R2) |
| F9 | Iframe Source Validation | Validate `messageEvent.source === iframeRef.current?.contentWindow` in `TvVideoPlayer.tsx` | M2 | Survey (R2) |
| F10 | Video Ended Deduplication | Add `hasEndedRef` guard in `TvVideoPlayer.tsx` to prevent duplicate `info === 0` track advances | M2 | Survey (R2) |
| F11 | Changelog Update | Prepend index 0 in `packages/player/changelog.json` documenting R1 and R2 fixes | M3 | Survey (R3) |
| F12 | Quality Gates Validation | Execute and pass `pnpm type-check`, `pnpm lint`, and `pnpm test` with 0 errors | M3 | Survey (R3) |
| F13 | Release Build & GitHub Publish | Execute `scripts/build-and-publish.ps1`, compile APK & desktop installer, publish to GitHub Releases | M3 | Survey (R3) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Strict Official Video & Anti-Subtitle Filtering | `musicVideoService.ts`, tests, `TvVideoPlayer.tsx` embed params | none | DONE |
| M2 | Playback Synchronization & Anti-Premature Skip | `tvStore.ts`, `TvSoundProvider.tsx`, `TvVideoPlayer.tsx`, tests | M1 | DONE |
| M3 | Quality Gates, Changelog & Release Delivery | `changelog.json`, quality gates, `build-and-publish.ps1` | M1, M2 | IN_PROGRESS |

## Interface Contracts
### `musicVideoService.ts` ↔ `TvVideoPlayer.tsx`
- `findOfficialVideo(track: Track)` returns `Promise<OfficialVideoResult | null>`.
- `OfficialVideoResult`: `{ videoId: string, title: string }`.
- When `null`, `TvVideoPlayer` sets `targetVideoId = null`, `isVideoPlaying = false`, and renders `TvCoverArtView`.

### `TvVideoPlayer.tsx` ↔ `tvStore.ts` ↔ `TvSoundProvider.tsx`
- `tvStore`:
  - `targetVideoId: string | null`
  - `setTargetVideoId: (id: string | null) => void`
  - `isVideoPlaying: boolean`
  - `setIsVideoPlaying: (playing: boolean) => void`
- `TvSoundProvider`:
  - `isVideoActive = isVideoPlaying || Boolean(targetVideoId)`
  - If `showVideo && isVideoActive`, `volumePercent = 0` and `handleEnd` logs and returns without calling `playbackManager.finishTrack()`.
  - When `!showVideo` or in cover art fallback (`!targetVideoId && !isVideoPlaying`), `handleEnd` calls `playbackManager.finishTrack()`.

## Code Layout
- `packages/player/src/services/musicVideoService.ts`: YouTube search, candidate scoring, official channel filtering, anti-subtitle/junk noise terms.
- `packages/player/src/services/musicVideoService.test.ts`: Unit tests for official video filtering.
- `packages/player/src/services/musicVideoService.empirical.test.ts`: Adversarial test cases and stress tests.
- `packages/player/src/stores/tvStore.ts`: TV state store.
- `packages/player/src/components/TvShell/TvVideoPlayer.tsx`: TV video component, embed parameters, postMessage listener, deduplication.
- `packages/player/src/components/TvShell/TvSoundProvider.tsx`: Background audio provider and completion handling.
- `packages/player/src/components/TvShell/TvVideoPlayer.test.tsx`: Tests for video player and ended event handling.
- `packages/player/src/components/TvShell/TvVideoFallbackStress.test.tsx`: Tests for fallback and audio coordination.
- `packages/player/changelog.json`: Changelog array.
- `scripts/build-and-publish.ps1`: Release compilation and publishing script.
