# Handoff Report: Milestone 2 Reviewer (R2: Video/Audio Synchronization & Anti-Premature Skip)

## Review Summary

**Verdict**: APPROVE

## Integrity Assessment

- **Hardcoded test results or facade implementations**: None found. Real state tracking and event routing implemented.
- **Shortcuts or task bypasses**: None found.
- **Fabricated verification outputs**: None found. All test commands independently executed and confirmed.
- **Self-certifying work**: None found. Genuine automated test suites covering all edge cases.

---

## 1. Observation

### Code Review Observations

1. **`packages/player/src/stores/tvStore.ts`**:
   - Lines 14–31: Added `targetVideoId: string | null` and `setTargetVideoId: (targetVideoId: string | null) => void` to `TvState`.
   - Lines 37–42: `setShowVideo` resets `targetVideoId: showVideo ? state.targetVideoId : null` and `isVideoPlaying: showVideo ? state.isVideoPlaying : false`.
   - Lines 50–58: `setActiveSection` resets `targetVideoId: null`, `showVideo: false`, and `isVideoPlaying: false`.
   - Lines 64–71: `openSearch` resets `targetVideoId: null`, `showVideo: false`, and `isVideoPlaying: false`.

2. **`packages/player/src/components/TvShell/TvSoundProvider.tsx`**:
   - Lines 55–57: Computes `isVideoActive = isVideoPlaying || Boolean(targetVideoId)`.
   - Lines 64–68: Mutes `volumePercent` to `0` whenever `isVideoActive` is true.
   - Lines 87–96:
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
     Background audio end event is guarded and logged without advancing queue when video is active or loaded. When in cover art fallback (`targetVideoId === null`, `isVideoPlaying === false`) or when `showVideo === false`, `playbackManager.finishTrack()` is called as expected.

3. **`packages/player/src/components/TvShell/TvVideoPlayer.tsx`**:
   - Lines 48–49: Declares `iframeRef = useRef<HTMLIFrameElement | null>(null)` and `hasEndedRef = useRef<boolean>(false)`.
   - Lines 56–59: `setTargetVideoId` synchronizes local state and `useTvStore.getState().setTargetVideoId(id)`.
   - Lines 167–243: In the track lifecycle effect:
     - Resets `hasEndedRef.current = false` on track change and upon official video resolution.
     - Resets `useTvStore.getState().setTargetVideoId(null)` and `setIsVideoPlaying(false)` on fallback, search error, and unmount cleanup.
   - Lines 347–351: Enforces postMessage origin/source validation:
     ```tsx
     const currentIframeWindow = iframeRef.current?.contentWindow;
     if (!currentIframeWindow || messageEvent.source !== currentIframeWindow) {
       return;
     }
     ```
   - Lines 364–371: Guards `onStateChange` `payload.info === 0` against duplicate triggers:
     ```tsx
     if (hasEndedRef.current) {
       return;
     }
     hasEndedRef.current = true;
     setIsVideoPlaying(false);
     void playNextInInfiniteQueue();
     ```
   - Lines 628–630: Exports `useTvVideoId()` returning `useTvStore((state) => state.targetVideoId)`.

### Test Execution Observations

1. `pnpm --filter @aurora/player test -- src/components/TvShell/TvVideoPlayer.test.tsx src/components/TvShell/TvVideoFallbackStress.test.tsx`
   - Output: 2 test files passed, 27 tests passed.
   - Duration: 48.83s. Exit code 0.
2. `pnpm type-check`
   - Output: 14 tasks successful, 0 errors. Exit code 0.
3. `pnpm lint`
   - Output: 11 packages successful, 0 errors. Exit code 0.
4. `pnpm --filter @aurora/player test -- src/components/TvShell/`
   - Output: 11 test files passed, 104 tests passed. Exit code 0.

---

## 2. Logic Chain

1. **Anti-Premature Skipping**:
   - Premature skipping occurred when background `<Sound>` audio ended while the YouTube iframe was still playing.
   - Guarding `handleEnd` in `TvSoundProvider` with `showVideo && (isVideoPlaying || Boolean(targetVideoId))` ensures background audio EOF will not trigger `finishTrack()` while a video is playing, buffering, or loaded.
   - By tracking `Boolean(targetVideoId)`, buffering periods (where `isVideoPlaying` toggles to false while the iframe loads or buffers) remain protected from premature skips.

2. **Accurate Track Completion via YouTube Iframe**:
   - When the YouTube video completes naturally (`payload.info === 0`), `hasEndedRef` guards against multiple duplicate events.
   - `playNextInInfiniteQueue()` replenishes upcoming tracks if near queue end and calls `playbackManager.finishTrack()`, achieving seamless auto-advance.

3. **Fallback Integrity**:
   - If no official video exists or if an error occurs, `targetVideoId` is set to `null` and `isVideoPlaying` is `false`.
   - `TvCoverArtView` is displayed, audio is unmuted to user preference, and `<Sound>`'s `handleEnd` calls `finishTrack()`, preserving audio playlist progression.

4. **Security & Boundary Isolation**:
   - `messageEvent.source === iframeRef.current?.contentWindow` guarantees that messages from other frames or the top window cannot trigger fraudulent track skips or state mutations.

---

## 3. Adversarial Challenge & Stress-Test Results

| Challenge Scenario | Stress Condition | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| Background audio ends while video is playing | `<Sound>` fires `onEnd` with `isVideoPlaying: true` | Queue does not advance; video continues | `finishTrack` not called; deferred to video player | PASS |
| Background audio ends while video is buffering | `<Sound>` fires `onEnd` with `targetVideoId: 'vid123'`, `isVideoPlaying: false` | Queue does not advance; video continues loading | `finishTrack` not called | PASS |
| Duplicate `info: 0` messages from iframe | 3 back-to-back `info: 0` events dispatched | `finishTrack` called exactly once | `finishTrack` called once (`hasEndedRef` blocks dupes) | PASS |
| Spoofed postMessage from `window` or untrusted source | `MessageEvent` with `source: window` or `null` | Event ignored; playback unaffected | Event ignored; `finishTrack` not called | PASS |
| Rapid 5-track switch in 200ms ending on noise track | Concurrency race across delayed search promises | State settles on cover art; `isVideoPlaying: false` | Correctly displays cover art without stuck video | PASS |
| Full fallback in cover art mode | `<Sound>` fires `onEnd` with `targetVideoId: null` | Queue advances immediately | `finishTrack` called immediately | PASS |

---

## 4. Caveats

- In headless test environments (`jsdom`), `MessageEvent` objects must define `source: iframe.contentWindow` to pass the origin filter; raw synthetic events without source are safely rejected.
- Non-TV modes (desktop/mobile shells) utilize `SoundProvider` rather than `TvSoundProvider`, keeping desktop and TV behavior properly decoupled.

---

## 5. Conclusion

**Verdict: APPROVE**.
All Milestone 2 requirements are completely satisfied:
- `targetVideoId` in `tvStore.ts` correctly tracks active video.
- `TvSoundProvider.tsx` guards `handleEnd` when `showVideo && (isVideoPlaying || Boolean(targetVideoId))`.
- `TvVideoPlayer.tsx` enforces `messageEvent.source === iframeRef.current?.contentWindow` and deduplicates `info === 0` events via `hasEndedRef`.
- Cover art fallback cleanly advances queue on audio end.
- All 104 TV Shell tests, type-checking, and linting pass with zero errors.

---

## 6. Verification Method

To independently verify:
```bash
# Verify TV video player and stress tests (27 tests)
pnpm --filter @aurora/player test -- src/components/TvShell/TvVideoPlayer.test.tsx src/components/TvShell/TvVideoFallbackStress.test.tsx

# Verify full TV Shell test suite (104 tests)
pnpm --filter @aurora/player test -- src/components/TvShell/

# Verify TypeScript type checks
pnpm type-check

# Verify ESLint & Prettier
pnpm lint
```

### Invalidation Conditions
- If background audio reaching EOF calls `playbackManager.finishTrack()` while `showVideo` is true and `targetVideoId` is set, R2 is invalidated.
- If duplicate `info: 0` messages trigger multiple calls to `finishTrack()`, R2 is invalidated.
- If untrusted postMessage events without `source === iframe.contentWindow` can advance the track, R2 is invalidated.
- If audio fails to advance the track when `targetVideoId: null` in cover art fallback, R2 is invalidated.
