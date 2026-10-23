# BRIEFING — 2026-10-23T10:13:00Z

## Mission
Investigate Requirement R2: Prevent Premature Skipping Before Music Videos Finish Playing in TV mode. Trace TvSoundProvider, TvVideoPlayer, playbackManager, and synchronization mechanisms.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, synthesizer
- Working directory: c:\Users\Danid\Desktop\proyectos\aurora\.agents\teamwork\explorer_survey_2
- Original parent: 9a5a3b52-ab00-41a9-850d-f46df052976a
- Milestone: survey_r2

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Write only to working directory .agents/teamwork/explorer_survey_2/
- Deliver self-contained handoff.md following 5-component protocol

## Current Parent
- Conversation ID: 9a5a3b52-ab00-41a9-850d-f46df052976a
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `packages/player/src/components/TvShell/TvSoundProvider.tsx`
  - `packages/player/src/components/TvShell/TvVideoPlayer.tsx`
  - `packages/player/src/components/TvShell/TvShell.tsx`
  - `packages/player/src/components/TvShell/tvInfiniteQueue.ts`
  - `packages/player/src/services/playback/playbackManager.ts`
  - `packages/player/src/stores/tvStore.ts`
  - `packages/player/src/components/TvShell/TvVideoFallbackStress.test.tsx`
  - `packages/player/src/components/TvShell/TvVideoPlayer.test.tsx`
  - `packages/hifi/src/Sound.tsx` and `packages/hifi/src/YouTubePlayer.tsx`
- **Key findings**:
  1. In `TvSoundProvider.tsx`: When `isVideoPlaying` is true, `<Sound>` is muted (`volumePercent = 0`), but `<Sound>` still plays the background audio stream. When audio reaches end of track, `handleEnd` unconditionally calls `playbackManager.finishTrack()`. Because music videos often have video intros/outros or delayed starts, audio reaches the end before the video finishes, triggering premature track skip and aborting the active video!
  2. In `TvVideoPlayer.tsx`: The postMessage listener for YouTube iframe `onStateChange` (`info === 0`) does NOT validate `messageEvent.source === iframeRef.current?.contentWindow`. Any postMessage in the window could trigger end-of-track.
  3. In `TvVideoPlayer.tsx`: There is no deduplication guard on `onStateChange` `info === 0`. If YouTube emits duplicate ended events (or rapid duplicate postMessages), `playNextInInfiniteQueue()` can run multiple times, causing double track skips.
  4. In `tvStore.ts`: `targetVideoId` is currently only local React state inside `TvVideoPlayer`, making it impossible for `TvSoundProvider` to know if a video is active when paused or transitioning. Storing `targetVideoId` in `useTvStore` enables seamless coordination.
- **Unexplored areas**: None. Complete evidence chain established.

## Key Decisions Made
- Confirmed root cause of premature skipping: `TvSoundProvider.tsx` `handleEnd` calling `playbackManager.finishTrack()` without checking whether a music video is active.
- Defined solution:
  1. Add `targetVideoId` and `setTargetVideoId` to `tvStore.ts`.
  2. In `TvSoundProvider.tsx`: Guard `handleEnd` so it ignores audio completion when `showVideo && (isVideoPlaying || targetVideoId)`.
  3. In `TvVideoPlayer.tsx`: Add source validation (`messageEvent.source === iframeRef.current?.contentWindow`) and deduplication (`hasEndedRef = useRef(false)`) before calling `playNextInInfiniteQueue()`.
  4. Author comprehensive automated tests for both `TvSoundProvider` onEnd guard and `TvVideoPlayer` deduplicated source-validated track advancement.

## Artifact Index
- DISPATCH.md — Initial dispatch instructions
- BRIEFING.md — Persistent agent state
- progress.md — Liveness heartbeat
- handoff.md — Final investigation report
