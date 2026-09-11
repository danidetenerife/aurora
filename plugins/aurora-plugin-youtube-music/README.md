# YouTube Music Plugin for Aurora Player

Official-quality streaming and rich music metadata provider for [Aurora](https://auroraplayer.com), powered by YouTube Music InnerTube and `yt-dlp`.

---

## Why YouTube Music instead of standard YouTube?

| Feature | Standard YouTube Plugin | YouTube Music Plugin |
| :--- | :--- | :--- |
| **Track Cleanliness** | Returns videos with dialogue, sound effects, intros | **Studio Audio (ATV / Official Topic Tracks)** |
| **Search Accuracy** | Low (mixes reaction videos, 10h loops, covers) | **High (targeted to music releases)** |
| **Metadata Support** | Streaming only | **Full (Artists, Albums, Tracklists, Bios)** |
| **Discography** | None | **Structured album listings with track numbers** |

---

## Features

- **Streaming Provider (`youtube-music`)**:
  - Searches YouTube Music with targeted song filtering.
  - Resolves high-bitrate audio streams directly via Aurora's integrated `yt-dlp`.
- **Metadata Provider (`youtube-music`)**:
  - Search tracks, albums, and artists.
  - Fetch artist biographies, high-resolution artwork, top tracks, and related artists.
  - Fetch complete album details with track numbering and release years.

---

## Plugin Structure

```
aurora-plugin-youtube-music/
├── package.json              # Aurora manifest & plugin metadata
├── README.md                 # Documentation
└── src/
    ├── client.ts             # YouTube Music InnerTube API client
    ├── index.test.ts         # Vitest test suite
    ├── index.ts              # Plugin entry point (exports default AuroraPlugin)
    ├── mappers.ts            # Data converters from YTM to Aurora models
    ├── metadata-provider.ts  # MetadataProvider implementation
    ├── streaming-provider.ts # StreamingProvider implementation
    └── types.ts              # InnerTube & YTM TypeScript types
```

---

## Development & Testing

Run unit and integration tests:

```bash
npx vitest run plugins/aurora-plugin-youtube-music/src/index.test.ts
```

Compile the bundle manually:

```bash
npx esbuild src/index.ts --bundle --format=cjs --platform=browser --external:@aurora/plugin-sdk --outfile=dist/index.js
```

---

## Installation in Aurora

### 1. Development / Local Testing
Place the `aurora-plugin-youtube-music` folder directly into Aurora's user plugins directory:
* **Windows**: `%APPDATA%\aurora\plugins\aurora-plugin-youtube-music`
* **macOS**: `~/Library/Application Support/aurora/plugins/aurora-plugin-youtube-music`
* **Linux**: `~/.config/aurora/plugins/aurora-plugin-youtube-music`

### 2. Publishing to Aurora Plugin Store
1. Push this repository to GitHub (e.g. `AuroraPlayer/aurora-plugin-youtube-music` or your username).
2. Create a GitHub Release with tag `v0.1.0` containing `plugin.zip` (with `src`, `package.json`, and `README.md`).
3. Submit a Pull Request to [AuroraPlayer/plugin-registry](https://github.com/AuroraPlayer/plugin-registry) adding your plugin to `plugins.json`.
