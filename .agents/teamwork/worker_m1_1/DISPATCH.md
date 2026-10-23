## 2026-10-23T10:15:49Z

You are a Worker subagent implementing Milestone 1 (R1: Strict Official-Channel-Only Music Video Selection & Anti-Subtitle/Junk Filtering).
Your working directory is: c:\Users\Danid\Desktop\proyectos\aurora\.agents\teamwork\worker_m1_1
Your parent is orchestrator conversation ID: 9a5a3b52-ab00-41a9-850d-f46df052976a.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

First, read these documents carefully:
1. c:\Users\Danid\Desktop\proyectos\aurora\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\Danid\Desktop\proyectos\aurora\PROJECT.md
3. c:\Users\Danid\Desktop\proyectos\aurora\.agents\teamwork\explorer_survey_1\handoff.md

Your exclusive write ownership is strictly limited to:
- `packages/player/src/services/musicVideoService.ts`
- `packages/player/src/services/musicVideoService.test.ts`
- `packages/player/src/services/musicVideoService.empirical.test.ts`
- `packages/player/src/components/TvShell/TvVideoPlayer.tsx`
Do NOT edit other source files in this milestone.

Your tasks:
1. In `packages/player/src/services/musicVideoService.ts`:
   - Implement strict official channel verification:
     - Check channel badges: `OFFICIAL_ARTIST_BADGE`, `BADGE_STYLE_TYPE_VERIFIED_ARTIST`, `BADGE_STYLE_TYPE_VERIFIED` (with artist or label match), VEVO channels (`vevo` in channel name), and recognized official record labels.
     - Implement helper `isOfficialChannel`: strictly gate candidate evaluation in `executeYouTubeSearch`. Any upload from an unverified third-party or fan channel MUST be rejected immediately even if title contains "Official Video" or "Video Oficial".
   - Expand `NOISE_TERMS`:
     - Subtitle/lyric terms: `'sub español'`, `'sub espanol'`, `'subtitulado'`, `'subtitulada'`, `'subtitulos'`, `'subtítulos'`, `'subtitulo'`, `'subtítulo'`, `'subtitles'`, `'subtitle'`, `'con letra'`, `'con letras'`, `'lyrics'`, `'lyric video'`, `'lyric'`, `'traducida'`, `'traducido'`, `'traducción'`, `'traduccion'`, `'subbed'`, `'cc'`.
     - Low-res/fan terms: `'240p'`, `'360p'`, `'480p'`, `'reupload'`, `'re upload'`, `'resubido'`, `'resubida'`, `'fan made'`, `'fanmade'`, `'no oficial'`, `'unofficial'`, `'covers'`, `'tributes'`.
   - Expand `NON_EXEMPT_NOISE_TERMS`:
     - Add all subtitle markers (`sub español`, `subtitulado`, `subtitulos`, `con letra`, `lyrics`, `lyric video`, `traducida`, `traducción`, `subbed`, `cc`), low-res tags (`240p`, `360p`, `480p`), and fan tags (`reupload`, `resubido`, `fan made`, `no oficial`, `unofficial`, `tributes`).
   - Expand `RECORD_LABELS` with recognized labels (`hybe`, `sm entertainment`, `smtown`, `yg entertainment`, `jyp`, `geffen`, `polydor`, `astralwerks`, `motown`, `emi`, `century media`, `nuclear blast`, `roadrunner`, `hopeless records`, `epitaph`, `rough trade`, `domino recording`, `4ad`, `xl recordings`, `warp records`, `ninja tune`, `pias`, `sony entertainment`, `universal music`, `warner music`, `warner records`).
   - Ensure `findOfficialVideo` cleanly returns `null` when no candidate meets strict official criteria.
2. In `packages/player/src/components/TvShell/TvVideoPlayer.tsx`:
   - Update `embedUrl` to include `cc_load_policy=0` and `vq=hd1080`:
     `https://www.youtube.com/embed/${targetVideoId}?autoplay=1&enablejsapi=1&playsinline=1&controls=0&rel=0&iv_load_policy=3&modestbranding=1&cc_load_policy=0&vq=hd1080`
   - In `disableSubtitles`, send HD quality commands via postMessage:
     `{ event: 'command', func: 'setPlaybackQuality', args: ['hd1080'] }`,
     `{ event: 'command', func: 'setPlaybackQualityRange', args: ['hd1080', 'highres'] }`,
     `{ event: 'command', func: 'setOption', args: ['playbackQuality', 'suggestedQuality', 'hd1080'] }`.
3. Tests:
   - Add comprehensive tests in `packages/player/src/services/musicVideoService.test.ts` and `packages/player/src/services/musicVideoService.empirical.test.ts` verifying:
     - Rejection of unverified third-party channels with matching song/artist and "Official Video" in title.
     - Rejection of videos with subtitle markers (`(Sub Español)`, `[Lyrics]`, `(Con Letra)`, `(Traducida)`, `[cc]`).
     - Rejection of videos with low-res/fan markers (`[240p]`, `[480p]`, `(Reupload)`, `(Fan Made)`).
     - Acceptance of authentic verified channels (Official Artist Badge, VEVO, verified record labels).
4. Run tests and type-checks:
   - Run `pnpm --filter @aurora/player test -- src/services/musicVideoService.test.ts src/services/musicVideoService.empirical.test.ts src/components/TvShell/TvVideoPlayer.test.tsx`
   - Run `pnpm type-check`
   - Run `pnpm lint`
   Ensure all tests pass and there are no lint/type errors.

Write your report to `c:\Users\Danid\Desktop\proyectos\aurora\.agents\teamwork\worker_m1_1\handoff.md`.
When finished, send a message to your parent.
