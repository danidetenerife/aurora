# Milestone 1 (R1) Empirical Challenger Handoff Report

## 1. Observation

### Code Under Review
- `packages/player/src/services/musicVideoService.ts` (Lines 42-209, 296-343, 371-464, 780-793)
- `packages/player/src/components/TvShell/TvVideoPlayer.tsx` (Lines 97-111, 483)

### Empirical Verification Executed
1. **Unit & Integration Suite Baseline**:
   - Command: `pnpm --filter @aurora/player test -- src/services/musicVideoService.test.ts src/services/musicVideoService.empirical.test.ts`
   - Result: 81 tests passed across 2 test files (31ms and 34ms).
2. **Empirical Adversarial Challenge Suite**:
   - File: `packages/player/src/services/musicVideoService.adversarial-challenge.test.ts` (112 test cases)
   - Command: `pnpm --filter @aurora/player test -- src/services/musicVideoService.adversarial-challenge.test.ts`
   - Result: 112 tests passed (96ms).
3. **Player Quality Gates**:
   - Command: `pnpm --filter @aurora/player type-check` -> Exited with code 0 (zero TypeScript errors).
   - Command: `pnpm --filter @aurora/player lint` -> Exited with code 0 (zero ESLint errors).
   - Command: `pnpm --filter @aurora/player test -- src/components/TvShell/TvVideoPlayer` -> Exited with code 0 (4 tests passed).

### Specific Test Cases Verified
- **Subtitle Indicator Permutations**:
  - `sub español`, `sub espanol`, `subtitulado`, `subtitulada`, `subtitulos`, `subtítulos`, `subtitulo`, `subtítulo`, `subtitles`, `subtitle`
  - `con letra`, `con letras`, `(Con Letra)`, `[CON LETRA]`, `(Con-Letra)`
  - `lyrics`, `lyric video`, `lyric`, `[Lyrics]`, `(Official Lyric Video)`, `Lyric Video 4K`, `with Lyrics on screen`
  - `subbed`, `(Subbed)`, `[ENG SUBBED]`, `(English Subbed)`, `[Spanish Subbed]`
  - `traducida`, `traducido`, `traducción`, `traduccion`, `[TRADUCIDA AL ESPAÑOL]`, `[TRADUCCION]`
  - `cc`, `(CC)`, `[cc]`, `(Closed Captions - cc)`, `| CC |`
- **Low-Resolution Tag Permutations**:
  - `240p`, `(240p)`, `[240p]`, `[240P]`, `240p Official Video`, `- 240p -`
  - `360p`, `(360p)`, `[360p]`, `[360P]`, `360p HQ`
  - `480p`, `(480p)`, `[480p]`, `[480P]`, `480p DVD Rip`, `(Video Oficial 480p)`
- **Fan & Junk Tag Permutations**:
  - `reupload`, `(Reupload)`, `[REUPLOAD]`, `re upload`, `(Re-Upload)`, `resubido`, `(Resubido)`, `resubida`
  - `fan made`, `(Fan Made)`, `[FAN MADE]`, `(Fan-Made Video)`, `fanmade`, `(Fanmade)`
  - `no oficial`, `(No Oficial)`, `[NO OFICIAL]`, `Video No Oficial`, `unofficial`, `(Unofficial)`
  - `covers`, `tributes`
- **Legitimate Songs & Exemption Mechanics**:
  - Bruce Springsteen – "Cover Me": Official video is accepted (`hasNoiseTerms` is `false`, search returns video).
  - Bruce Springsteen – "Cover Me" attacked with non-exempt junk: Injected variants (`(Covered by Alice)`, `(Guitar Cover)`, `(Acoustic Cover)`, `(Covers)`, `(Karaoke)`, `(Tribute)`, `(Sub Español)`, `(Con Letra)`, `(Lyrics)`, `[Lyric Video]`, `(CC)`, `[240p]`, `[480p]`, `(Reupload)`, `(Fan Made)`, `(No Oficial)`) are 100% strictly blocked because they are members of `NON_EXEMPT_NOISE_TERMS`.
  - The Strokes – "Under Cover of Darkness": Accepted when authentic; blocked when containing subtitle/lyric tags.
  - Kid B – "Fruit Loops" & The Loops – "In The Loop": Exempted for "loop", but blocked when containing "10 Hours Loop" or subtitle tags.
  - Cake – "Short Skirt Long Jacket": Allowed without tripping on "shorts", but `#shorts` hashtag triggers blocking.
  - BTS – "Butter": Allowed for "BTS", but "Behind The Scenes" triggers blocking.
- **Channel Verification & Spoofing Defense**:
  - Deceptive channel titles (`Dua Lipa Unofficial`, `Dua Lipa Fan Made Channel`, `Dua Lipa No Oficial`, `Dua Lipa Fanpage`, `Dua Lipa Fanclub`, `Dua Lipa Resubido`) are rejected.
  - Generic verified channel uploading unrelated artist is rejected.
  - Official artist badge (`OFFICIAL_ARTIST_BADGE`, `BADGE_STYLE_TYPE_VERIFIED_ARTIST`), VEVO channels, and major/indie record labels (`Warner Records`, `Universal Music Group`, `Sony Music Entertainment`, `HYBE LABELS`, `SMTOWN`, `JYP Entertainment`, `Fueled By Ramen`, `Epitaph Records`, `Sub Pop`, `4AD`, `XL Recordings`, `Rough Trade`) are accepted.

---

## 2. Logic Chain

1. **Step 1 (Normalization & Diacritic Stripping)**:
   - `normalizeText` performs NFD decomposition, strips combining diacritical marks `[\u0300-\u036f]`, converts to lowercase, replaces non-alphanumeric punctuation with spaces, and collapses whitespace.
   - This ensures that punctuation formatting (brackets `[]`, parentheses `()`, slashes `/`, hyphens `-`, dots `.`, pipes `|`) and accentuation (`español`/`espanol`, `traducción`/`traduccion`, `subtítulos`/`subtitulos`) normalize to identical token sequences.
2. **Step 2 (Exact Word-Boundary & Substring Matching in `isNoiseMatch`)**:
   - Multi-word phrases (`sub espanol`, `con letra`, `lyric video`, `fan made`, `no oficial`) use normalized substring matching against normalized strings.
   - Single-word terms (`cc`, `lyrics`, `subbed`, `240p`, `480p`, `reupload`, `covers`, `tributes`) enforce `\b...\b` word boundary regex matching, preventing false substring matches inside longer unrelated words while catching bracketed tags.
3. **Step 3 (Two-Tier Exemption System in `hasNoiseTerms`)**:
   - Legitimate tracks whose title or artist contains terms like `cover`, `loop`, `short`, `mix`, `bts` are exempted from generic noise terms *if and only if* the term is not listed in `NON_EXEMPT_NOISE_TERMS`.
   - Subtitle markers (`sub español`, `con letra`, `lyrics`, `traducida`, `cc`), low-res tags (`240p`, `480p`), and fan tags (`reupload`, `fan made`, `no oficial`, `covers`, `tributes`) are strictly in `NON_EXEMPT_NOISE_TERMS`, ensuring that attacking a legitimate track with subtitle or fan tags always results in strict rejection.
4. **Step 4 (Candidate Gating in `findOfficialVideo`)**:
   - Candidates are rejected upfront if `!isOfficialChannel(...)` before score evaluation, preventing unverified or spoofed channels from being selected even if they claim "Official Video".
5. **Step 5 (Embed CC and HD Enforcement in `TvVideoPlayer.tsx`)**:
   - Embed URL specifies `cc_load_policy=0&vq=hd1080` and postMessage commands explicitly disable captions and request 1080p.

---

## 3. Caveats

- In the broader player test suite, two pre-existing snapshots (`Settings.test.tsx` and `PluginStore.test.tsx`) fail solely due to the package version display string expecting `v1.48.75` vs `v1.48.76` after an earlier version bump. This is resolved via standard `pnpm test -u` during the M3 release step.
- Real YouTube Innertube network responses are mocked in tests with authentic payload structures (`videoRenderer`, `ownerBadges`, `lengthText`). Live network latency or schema changes by YouTube upstream are not simulated in unit test environments.

---

## 4. Conclusion

**Verdict: APPROVE**

The anti-subtitle and junk filtering logic in `packages/player/src/services/musicVideoService.ts` and `TvVideoPlayer.tsx` is robust, mathematically sound, and empirically verified:
- All required permutations of subtitle markers, low-res tags, and fan uploads are strictly caught and blocked.
- Legitimate songs with similar words (e.g. Bruce Springsteen's 'Cover Me') pass cleanly without false positive rejection.
- Injected non-exempt junk terms into legitimate songs are strictly blocked.
- Official channel gating guarantees that only authenticated artist, VEVO, or record label channels are candidates.

---

## 5. Verification Method

To independently verify these results:

```bash
# Run unit tests
pnpm --filter @aurora/player test -- src/services/musicVideoService.test.ts

# Run empirical stress tests
pnpm --filter @aurora/player test -- src/services/musicVideoService.empirical.test.ts

# Run adversarial challenge matrix (112 tests)
pnpm --filter @aurora/player test -- src/services/musicVideoService.adversarial-challenge.test.ts

# Run TV video player tests
pnpm --filter @aurora/player test -- src/components/TvShell/TvVideoPlayer.test.tsx

# Verify type check and lint
pnpm --filter @aurora/player type-check
pnpm --filter @aurora/player lint
```
