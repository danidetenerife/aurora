# Execution Plan

## Objectives
1. Implement strict official-channel-only music video selection & anti-subtitle/junk filtering in `musicVideoService` and `TvVideoPlayer` (R1).
2. Fix synchronization between `TvSoundProvider` and `TvVideoPlayer` to eliminate premature skipping before music videos end (R2).
3. Validate quality gates (`pnpm type-check`, `pnpm lint`, `pnpm test`), update `packages/player/changelog.json`, compile release artifacts (desktop installer, Android/Google TV APK), and publish via `scripts/build-and-publish.ps1` (R3).

## Phases & Milestones
- **Phase 0: Survey & Codebase Mapping**
  - Dispatch 3 parallel Explorers:
    - Explorer 1: R1 (musicVideoService, TV video selection, channel verification, anti-subtitle regex/heuristics, embed URL & fallback)
    - Explorer 2: R2 (TvSoundProvider, TvVideoPlayer, playbackManager.finishTrack(), audio/video synchronization, iframe events)
    - Explorer 3: R3 (changelog, quality gates, build-and-publish.ps1 pipeline, dependencies, release packaging)
- **Phase 0.5: Synthesis & PROJECT.md**
  - Merge Explorer findings into root `PROJECT.md` with Feature Inventory, Architecture, Milestones, and Interface Contracts.
- **Milestone 1 (R1): Strict Official Video & Anti-Subtitle Filtering**
  - Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Forensic Auditor -> Gate.
- **Milestone 2 (R2): Playback Synchronization & Anti-Premature Skip**
  - Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Forensic Auditor -> Gate.
- **Milestone 3 (R3): Quality Gates, Changelog & Release Delivery**
  - Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Forensic Auditor -> Gate.
- **Phase 4: Synthesis & Final Reporting to Parent**
