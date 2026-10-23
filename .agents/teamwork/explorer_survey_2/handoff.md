# Handoff Report: R2 — Prevent Premature Skipping Before Music Videos Finish Playing

## 1. Observation

### Codebase Locations & Architecture
- **`packages/player/src/components/TvShell/TvSoundProvider.tsx`**
  - Lines 55–66:
    ```tsx
    const isVideoPlaying = useTvStore((state) => state.isVideoPlaying);
    const crossfadeMs = 0;
    const mediaSource = src;
    const preload: HTMLAudioElement['preload'] = 'auto';
    const crossOrigin = undefined;
    const [volume01] = useCoreSetting<number>('playback.volume');
    const [muted] = useCoreSetting<boolean>('playback.muted');
    const volumePercent = isVideoPlaying
      ? 0
      : muted
        ? 0
        : Math.round((volume01 ?? 1) * 100);
    ```
  - Lines 85–87:
    ```tsx
    const handleEnd = useCallback(() => {
      playbackManager.finishTrack();
    }, []);
    ```
  - Lines 123–137:
    ```tsx
    <Sound
      src={mediaSource}
      status={status}
      seek={targetSeek ?? undefined}
      showVideo={false}
      volume={volumePercent}
      preload={preload}
      crossOrigin={crossOrigin}
      onTimeUpdate={handleTimeUpdate}
      onEnd={handleEnd}
      onCanPlay={handleCanPlay}
      onError={handleError}
      onSourceInvalid={handleSourceInvalid}
    />
    ```
  - Observation: `TvSoundProvider` is permanently mounted in `TvShell` (line 398 of `TvShell.tsx`). When `isVideoPlaying` is `true`, `volumePercent` is muted to `0`, but the `<Sound>` component continues playing the background audio track in parallel with the YouTube video. When this audio track finishes, `<Sound>` unconditionally fires `onEnd={handleEnd}`, which immediately invokes `playbackManager.finishTrack()`.

- **`packages/player/src/components/TvShell/TvVideoPlayer.tsx`**
  - Lines 40:
    ```tsx
    const [targetVideoId, setTargetVideoId] = useState<string | null>(null);
    ```
  - Lines 201–207:
    ```tsx
    if (!cancelled && activeTrackKeyRef.current === trackKey) {
      setTargetVideoId(videoIdentifier);
      setResolvedVideoTitle(foundTitle);
      setLoading(false);
      setIsVideoPlaying(true);
    }
    ```
  - Lines 324–355:
    ```tsx
    useEffect(() => {
      const handleMessage = (messageEvent: MessageEvent) => {
        try {
          const payload =
            typeof messageEvent.data === 'string'
              ? JSON.parse(messageEvent.data)
              : messageEvent.data;
          if (payload?.event === 'onStateChange') {
            disableSubtitles();
            if (payload.info === 1) {
              setIsVideoPlaying(true);
            } else if (payload.info === 2) {
              setIsVideoPlaying(false);
            } else if (payload.info === 0) {
              setIsVideoPlaying(false);
              void playNextInInfiniteQueue();
            }
          } else if (payload?.event === 'initialDelivery') {
            disableSubtitles();
            setIsVideoPlaying(true);
          } else if (payload?.event === 'onError') {
            setError(true);
            setIsVideoPlaying(false);
          }
        } catch {}
      };

      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }, [setIsVideoPlaying, disableSubtitles]);
    ```
  - Observation:
    1. `handleMessage` accepts messages from ANY window/iframe (`messageEvent.source` is never compared to `iframeRef.current?.contentWindow`).
    2. When `payload?.event === 'onStateChange' && payload.info === 0` (YouTube `ENDED` state), there is NO deduplication check (`hasEndedRef`). Duplicate events from the YouTube iframe API trigger `playNextInInfiniteQueue()` repeatedly.
    3. `targetVideoId` is isolated to a local React state inside `TvVideoPlayer`, meaning `TvSoundProvider` cannot observe whether an official video is active or loaded.

- **`packages/player/src/stores/tvStore.ts`**
  - Lines 14–29:
    ```ts
    type TvState = {
      showVideo: boolean;
      isVideoPlaying: boolean;
      setShowVideo: (showVideo: boolean) => void;
      setIsVideoPlaying: (playing: boolean) => void;
      activeSection: TvSection;
      isSearchOpen: boolean;
      isQueueVisible: boolean;
      selectedPodcast: PodcastRef | null;
      setActiveSection: (section: TvSection) => void;
      setSelectedPodcast: (podcast: PodcastRef | null) => void;
      openSearch: () => void;
      closeSearch: () => void;
      toggleQueue: () => void;
      setQueueVisible: (visible: boolean) => void;
    };
    ```
  - Observation: `targetVideoId` is not stored in `useTvStore`. `isVideoPlaying` is toggled to `false` when paused (`payload.info === 2`), so checking only `isVideoPlaying` when paused would treat the video as inactive.

- **`packages/player/src/components/TvShell/tvInfiniteQueue.ts`**
  - Lines 314–320:
    ```ts
    export const playNextInInfiniteQueue = async (): Promise<void> => {
      const { items, currentIndex } = useQueueStore.getState();
      if (currentIndex >= items.length - 1) {
        await replenishTvQueue(true);
      }
      await playbackManager.finishTrack();
    };
    ```
  - Observation: `playNextInInfiniteQueue()` calls `playbackManager.finishTrack()`, which advances `useQueueStore.getState().goToNext({ isNaturalFinish: true })`.

- **Existing Tests Status**
  - Ran `pnpm --filter @aurora/player test -- src/components/TvShell/`: 11 test files, 95 tests all pass (including `TvVideoFallbackStress.test.tsx` and `TvVideoPlayer.test.tsx`).
  - Currently, no tests check what happens when `<Sound>`'s `onEnd` fires while a TV music video is active, nor do they test postMessage source validation or duplicate ended event deduplication in `TvVideoPlayer`.

---

## 2. Logic Chain

1. **Premature Track Skipping Mechanism**:
   - In Google TV mode (`TvShell.tsx`), `TvSoundProvider` is rendered and plays audio through `<Sound>` at volume 0 while `isVideoPlaying` is true (lines 62–66, 128 of `TvSoundProvider.tsx`).
   - The studio audio stream from YouTube Music/streaming providers has a specific duration (e.g., 3:10).
   - The YouTube music video played inside `TvVideoPlayer.tsx`'s iframe often starts later due to video search and iframe load latency, or contains video-only cinematic intros, credits, and outros (e.g., 3:40 total duration).
   - When the background audio reaches its end at 3:10, `<Sound>` fires `onEnd`.
   - `TvSoundProvider.tsx`'s `handleEnd` (line 86) unconditionally calls `playbackManager.finishTrack()`.
   - `playbackManager.finishTrack()` immediately advances the queue (`useQueueStore.goToNext()`).
   - The track changes, causing `TvVideoPlayer` to dismount/reload the video and abort playback at 3:10—cutting off the remaining 30 seconds of the music video before it finishes.

2. **Source Validation Gap**:
   - In `TvVideoPlayer.tsx`, `handleMessage` listens to global `window.addEventListener('message', ...)`.
   - It parses any message with `payload?.event === 'onStateChange'` without verifying `messageEvent.source === iframeRef.current?.contentWindow`.
   - Any message in the host environment or external script could trigger track advancement.

3. **Missing Deduplication on Ended State**:
   - YouTube's iframe API frequently dispatches multiple `onStateChange` messages or status updates when a video ends (`info: 0`).
   - Because `playNextInInfiniteQueue()` is asynchronous (it awaits `replenishTvQueue(true)`), a second `info === 0` message can execute concurrently or immediately after, causing `playbackManager.finishTrack()` to be called twice. This results in skipping two tracks instead of one.

4. **Coordination via `useTvStore`**:
   - When a video is paused (`payload.info === 2`), `isVideoPlaying` is set to `false`. If only `isVideoPlaying` were checked by `TvSoundProvider`, pausing a video would cause background audio to unmute and any subsequent audio `onEnd` to trigger track completion.
   - By adding `targetVideoId: string | null` to `useTvStore` (synced by `TvVideoPlayer`), `TvSoundProvider` can distinguish between:
     - Active video mode (`showVideo && (isVideoPlaying || Boolean(targetVideoId))`): audio `onEnd` is strictly suppressed; volume is 0.
     - Cover art fallback mode (`showVideo && !targetVideoId && !isVideoPlaying`): audio is unmuted and audio `onEnd` drives track advancement.
     - Standard browsing mode (`!showVideo`): audio is unmuted and audio `onEnd` drives track advancement.

---

## 3. Caveats

- **YouTube Iframe API Event Timing**: YouTube sends `info: 1` on playback and `info: 0` on ended. If an ad or trailer were to precede the video, `info: 0` could theoretically fire at the end of the ad if using standard players; however, embed URLs with `controls=0&iv_load_policy=3&modestbranding=1` on verified videos play the video stream directly.
- **Network / YouTube Error During Video**: If an active video encounters `onError` after the background audio has already ended, `TvVideoPlayer` should switch to fallback or advance to the next track to avoid stalling on a silent ended track.
- **jsdom Event Simulation**: In Vitest tests, synthetic `MessageEvent` objects must specify `source: iframe.contentWindow` to pass the iframe source validation guard.

---

## 4. Conclusion & Proposed Implementation Strategy

### Files to Modify

1. **`packages/player/src/stores/tvStore.ts`**
   - Add `targetVideoId: string | null` to `TvState`.
   - Add `setTargetVideoId: (targetVideoId: string | null) => void`.
   - Initialize `targetVideoId: null`.
   - Reset `targetVideoId: null` in `setShowVideo(false)` and `setActiveSection(...)`.

2. **`packages/player/src/components/TvShell/TvSoundProvider.tsx`**
   - Read `targetVideoId` from `useTvStore`.
   - Compute `isVideoActive = isVideoPlaying || Boolean(targetVideoId)`.
   - Use `isVideoActive` in `volumePercent`.
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

3. **`packages/player/src/components/TvShell/TvVideoPlayer.tsx`**
   - Sync `targetVideoId` with `useTvStore.getState().setTargetVideoId(...)` on resolution, fallback, and cleanup.
   - Add a ref for deduplication: `const hasEndedRef = useRef<boolean>(false);`.
   - Reset `hasEndedRef.current = false;` when a new track or `propVideoId` begins in `useEffect`.
   - In `handleMessage`:
     - Check:
       ```tsx
       const currentIframeWindow = iframeRef.current?.contentWindow;
       if (!currentIframeWindow || messageEvent.source !== currentIframeWindow) {
         return;
       }
       ```
     - On `payload?.event === 'onStateChange' && payload.info === 0`:
       ```tsx
       if (hasEndedRef.current) {
         return;
       }
       hasEndedRef.current = true;
       setIsVideoPlaying(false);
       void playNextInInfiniteQueue();
       ```
     - In embed URL: ensure `cc_load_policy=0` is present.

4. **`packages/player/src/components/TvShell/TvVideoPlayer.test.tsx` & `TvVideoFallbackStress.test.tsx`**
   - Add unit/integration tests verifying:
     - `TvSoundProvider`'s `handleEnd` does NOT call `playbackManager.finishTrack` when `showVideo: true` and video is active.
     - `TvSoundProvider`'s `handleEnd` DOES call `playbackManager.finishTrack` when in cover art fallback or `showVideo: false`.
     - `TvVideoPlayer` advances track when `onStateChange` `info: 0` is received from `iframe.contentWindow`.
     - Duplicate `info: 0` messages from the same iframe only call `playbackManager.finishTrack` ONCE.
     - Messages with invalid `source` are ignored.

---

## 5. Verification Method

### Test Commands
```bash
# Run TvVideoPlayer tests
pnpm --filter @aurora/player test -- src/components/TvShell/TvVideoPlayer.test.tsx

# Run TvVideoFallbackStress tests
pnpm --filter @aurora/player test -- src/components/TvShell/TvVideoFallbackStress.test.tsx

# Run all TvShell tests
pnpm --filter @aurora/player test -- src/components/TvShell/

# Quality check
pnpm type-check
```

### Invalidation Conditions
- If `playbackManager.finishTrack` is called when audio ends while `showVideo` and `targetVideoId` are truthy, R2 fails.
- If YouTube player emits duplicate `info === 0` events and advances the queue by more than one track, R2 fails.
- If postMessages originating from outside the YouTube iframe advance the track, R2 fails.
- If audio fails to advance when displaying cover art fallback (`targetVideoId === null`), R2 fails.
