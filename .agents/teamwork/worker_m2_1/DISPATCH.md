## 2026-10-23T10:43:21Z
You are a Worker subagent implementing Milestone 2 (R2: Full Video Playback Without Premature Skipping — Synchronization between TvSoundProvider and TvVideoPlayer).
Your working directory is: c:\Users\Danid\Desktop\proyectos\aurora\.agents\teamwork\worker_m2_1
Your parent is orchestrator conversation ID: 9a5a3b52-ab00-41a9-850d-f46df052976a.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

First, read these documents carefully:
1. c:\Users\Danid\Desktop\proyectos\aurora\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\Danid\Desktop\proyectos\aurora\PROJECT.md
3. c:\Users\Danid\Desktop\proyectos\aurora\.agents\teamwork\explorer_survey_2\handoff.md

Your exclusive write ownership is strictly limited to:
- `packages/player/src/stores/tvStore.ts`
- `packages/player/src/components/TvShell/TvSoundProvider.tsx`
- `packages/player/src/components/TvShell/TvVideoPlayer.tsx`
- `packages/player/src/components/TvShell/TvVideoPlayer.test.tsx`
- `packages/player/src/components/TvShell/TvVideoFallbackStress.test.tsx`
Do NOT edit other source files in this milestone.

Your tasks:
1. In `packages/player/src/stores/tvStore.ts`:
   - Add `targetVideoId: string | null` and `setTargetVideoId: (targetVideoId: string | null) => void` to `TvState`.
   - Initialize `targetVideoId: null`.
   - Reset `targetVideoId: null` in `setShowVideo(false)` and `setActiveSection(...)` if changing away from player.
2. In `packages/player/src/components/TvShell/TvSoundProvider.tsx`:
   - Read `targetVideoId` from `useTvStore`.
   - Compute `isVideoActive = isVideoPlaying || Boolean(targetVideoId)`.
   - In `volumePercent`, use `isVideoActive` so background audio is muted whenever video is active/loading.
   - In `handleEnd`:
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
3. In `packages/player/src/components/TvShell/TvVideoPlayer.tsx`:
   - Sync `targetVideoId` with `useTvStore.getState().setTargetVideoId(...)` on resolution, fallback to cover art, and unmount/cleanup.
   - Add `const hasEndedRef = useRef<boolean>(false);`.
   - Reset `hasEndedRef.current = false;` whenever track changes or new video resolution begins.
   - In `handleMessage`:
     - Validate `messageEvent.source === iframeRef.current?.contentWindow`. If not matching or if `!iframeRef.current?.contentWindow`, return early.
     - On `payload?.event === 'onStateChange' && payload.info === 0`:
       Check `if (hasEndedRef.current) return;`
       `hasEndedRef.current = true;`
       `setIsVideoPlaying(false);`
       `void playNextInInfiniteQueue();`
4. In `TvVideoPlayer.test.tsx` and `TvVideoFallbackStress.test.tsx`:
   - Add unit/integration tests verifying:
     - `TvSoundProvider`'s `handleEnd` does NOT trigger `playbackManager.finishTrack()` while `showVideo` and `(isVideoPlaying || targetVideoId)` are active.
     - `TvSoundProvider`'s `handleEnd` DOES trigger `playbackManager.finishTrack()` when in cover art fallback or `showVideo: false`.
     - `TvVideoPlayer` advances track when `onStateChange` `info === 0` is received from the active iframe.
     - Duplicate `info === 0` messages from the iframe only call `playNextInInfiniteQueue` / `finishTrack` once.
     - Messages with invalid `source` are ignored.
5. Verification:
   - Run `pnpm --filter @aurora/player test -- src/components/TvShell/TvVideoPlayer.test.tsx src/components/TvShell/TvVideoFallbackStress.test.tsx`
   - Run `pnpm --filter @aurora/player test -- src/components/TvShell/`
   - Run `pnpm type-check`
   - Run `pnpm lint`

Write your complete report to `c:\Users\Danid\Desktop\proyectos\aurora\.agents\teamwork\worker_m2_1\handoff.md`.
When finished, send a message to your parent.
