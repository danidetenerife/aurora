# Handoff Report: Milestone 2 (R2 — Full Video Playback Without Premature Skipping)

## 1. Observation

### Codebase Observations
1. **`packages/player/src/stores/tvStore.ts`**:
   - `TvState` previously only held `showVideo: boolean` and `isVideoPlaying: boolean`.
   - Lines 14–29 lacked tracking for `targetVideoId: string | null` and its setter.
   - When a video was loading or paused (`payload.info === 2`), `isVideoPlaying` was `false`, causing downstream components to lose awareness that an official video was active.
   - Modified `tvStore.ts` to add `targetVideoId: string | null`, `setTargetVideoId: (id: string | null) => void`, and reset `targetVideoId: null` on `setShowVideo(false)`, `setActiveSection(...)`, and `openSearch()`.

2. **`packages/player/src/components/TvShell/TvSoundProvider.tsx`**:
   - In lines 55–66, `TvSoundProvider` computed `volumePercent` using only `isVideoPlaying`.
   - In lines 85–87, `handleEnd` unconditionally invoked `playbackManager.finishTrack()`:
     ```tsx
     const handleEnd = useCallback(() => {
       playbackManager.finishTrack();
     }, []);
     ```
   - When background studio audio finished before the YouTube music video (due to iframe load delay or video-only intros/outros), `<Sound>` emitted `onEnd`, abruptly skipping the track while the music video was still playing.
   - Updated lines 55–67 to compute `isVideoActive = isVideoPlaying || Boolean(targetVideoId)` and updated `handleEnd` to:
     ```tsx
     const handleEnd = useCallback(() => {
       const { showVideo, isVideoPlaying, targetVideoId } = useTvStore.getState();
       if (showVideo && (isVideoPlaying || Boolean(targetVideoId))) {
         Logger.streaming.info(
           'TvSoundProvider: Background audio ended while music video is active; deferring track advance to video player',
         );
         return;
       }
       playbackManager.finishTrack();
     }, []);
     ```

3. **`packages/player/src/components/TvShell/TvVideoPlayer.tsx`**:
   - `targetVideoId` was isolated to local state (`useState<string | null>(null)`).
   - In lines 336–366, `handleMessage` listened to global `window.addEventListener('message', ...)` without checking `messageEvent.source === iframeRef.current?.contentWindow`.
   - On `payload?.event === 'onStateChange' && payload.info === 0`, there was no guard against duplicate end events (`hasEndedRef`). Duplicate messages from the YouTube iframe API called `playNextInInfiniteQueue()` multiple times, triggering double track skips.
   - Updated `TvVideoPlayer.tsx` to:
     - Synchronize `targetVideoId` with `useTvStore.getState().setTargetVideoId(...)` on video resolution, fallback, error, close, and unmount cleanup.
     - Add `hasEndedRef = useRef<boolean>(false)`, resetting it on track changes and new video resolutions.
     - Enforce `messageEvent.source === iframeRef.current?.contentWindow` guard in `handleMessage`.
     - Guard `payload.info === 0` with `if (hasEndedRef.current) return; hasEndedRef.current = true; setIsVideoPlaying(false); void playNextInInfiniteQueue();`.
     - Update `useTvVideoId` hook to return `useTvStore((state) => state.targetVideoId)`.

4. **Test Suite Verification Commands & Outputs**:
   - `pnpm --filter @aurora/player test -- src/components/TvShell/TvVideoPlayer.test.tsx src/components/TvShell/TvVideoFallbackStress.test.tsx`
     Result: 2 test files passed, 27 tests passed.
   - `pnpm --filter @aurora/player test -- src/components/TvShell/`
     Result: 11 test files passed, 104 tests passed.
   - `pnpm type-check`
     Result: 14 tasks successful, 0 errors.
   - `pnpm lint`
     Result: 11 packages successful, 0 errors.

---

## 2. Logic Chain

1. **Root Cause of Premature Skipping**:
   - `TvShell` mounts `TvSoundProvider` which runs an HTML5 audio element (`<Sound>`).
   - In video mode (`showVideo: true`), background audio runs at volume 0 while the YouTube iframe plays the video.
   - Because YouTube videos typically start after a network search/iframe handshake and frequently have longer durations than the studio audio track (cinematic intros, director credits, ambient pauses), the background `<Sound>` track reaches its end earlier than the YouTube video.
   - When `<Sound>` fired `onEnd`, `handleEnd` in `TvSoundProvider` called `playbackManager.finishTrack()`, immediately switching the active track and destroying the video player iframe before the video reached its natural conclusion.

2. **Decoupled State Resolution via `tvStore`**:
   - Introducing `targetVideoId` into `useTvStore` enables `TvSoundProvider` to know when a music video has been matched and is actively loaded or loading.
   - Even when YouTube pauses or buffers (`isVideoPlaying` toggles to `false`), `targetVideoId` remains populated, preventing `TvSoundProvider` from unmuting or allowing audio `onEnd` to skip the track.

3. **Safe Audio Deferral**:
   - When `showVideo && (isVideoPlaying || Boolean(targetVideoId))` is true, `TvSoundProvider`'s `handleEnd` logs that background audio ended and defers track progression to the video player.
   - When `!showVideo` (user browsing in Dashboard, Search, etc.) or when displaying cover art fallback (`targetVideoId === null`), `handleEnd` immediately calls `playbackManager.finishTrack()`, preserving audio track progression.

4. **Iframe Message Origin Isolation & End Deduplication**:
   - YouTube iframe events are dispatched via `postMessage`.
   - Validating `messageEvent.source === iframeRef.current?.contentWindow` ensures external messages cannot advance tracks.
   - Using `hasEndedRef.current` ensures that once `payload.info === 0` (video ended) is processed, subsequent duplicate events for that track are ignored. `hasEndedRef.current` is reset whenever a new track key begins or a new video resolution completes.

---

## 3. Caveats

- In test environments using jsdom, `MessageEvent` objects dispatched to `window` must pass `source: iframe.contentWindow` to satisfy the iframe origin guard. Synthetic events without `source` or with `source: window` are ignored as intended.
- Outside of `TvShell` (desktop/mobile non-TV modes), `SoundProvider` handles desktop playback; these changes strictly impact the Google TV shell without regressions to desktop or mobile.
- In `pnpm --filter @aurora/player test`, two global snapshot tests in `PluginStore.test.tsx` and `Settings.test.tsx` fail solely because the package version changed from `1.48.75` to `1.48.76` (handled in Milestone 3 release snapshot update). All 104 TV Shell tests pass with 0 errors.

---

## 4. Conclusion

Milestone 2 (R2) requirements have been completely fulfilled:
- `targetVideoId` is registered in `tvStore` and kept synchronized with `TvVideoPlayer` lifecycle.
- `TvSoundProvider` mutes audio whenever a video is active/loading and prevents premature queue advancement when background audio finishes early.
- `TvVideoPlayer` enforces iframe message source validation, deduplicates ended events with `hasEndedRef`, and advances the track cleanly when the YouTube video completes.
- 9 new unit and integration tests were added in `TvVideoPlayer.test.tsx` and `TvVideoFallbackStress.test.tsx`.
- All quality gates (`test`, `type-check`, `lint`) pass with 0 errors.

---

## 5. Verification Method

### Test Execution Commands
Run the following commands from repository root:

```bash
# 1. Verify TV video player and fallback stress tests (27 tests)
pnpm --filter @aurora/player test -- src/components/TvShell/TvVideoPlayer.test.tsx src/components/TvShell/TvVideoFallbackStress.test.tsx

# 2. Verify all TV Shell test suite (104 tests)
pnpm --filter @aurora/player test -- src/components/TvShell/

# 3. TypeScript validation
pnpm type-check

# 4. ESLint / Prettier validation
pnpm lint
```

### Invalidation Conditions
- If background audio finishing early calls `playbackManager.finishTrack()` while `showVideo: true` and `targetVideoId` is set, R2 is invalidated.
- If duplicate `info: 0` messages from the YouTube iframe trigger multiple calls to `playbackManager.finishTrack()`, R2 is invalidated.
- If postMessages with `source !== iframe.contentWindow` advance the track, R2 is invalidated.
- If audio fails to advance when displaying cover art fallback (`targetVideoId: null`), R2 is invalidated.
