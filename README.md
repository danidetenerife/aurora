<div align="center">

# Aurora Music Player

Aurora is a free, modern, and open-source music streaming player without ads, tracking, or subscription paywalls. Search for any song or artist, build playlists, sync your listening preferences across devices, and enjoy high-fidelity audio on Windows, Android mobile, and Google TV / Android TV.

</div>

## Downloads

Grab the latest official release for your platform from the [Releases page](https://github.com/danidetenerife/aurora/releases).

| Platform | Format | Details |
|----------|--------|---------|
| **Windows** | `.exe` installer (x64) | Standalone setup with signed automatic background updates |
| **Android (Mobile)** | `.apk` (`aurora-music-player.apk`) | Background playback, lock screen MediaSession & audio focus handling |
| **Google TV / Android TV** | `.apk` (`aurora-google-tv.apk`) | 10-foot TV UI with D-pad remote navigation & optional music videos |

## What Aurora Offers

### Google TV & Android TV Experience
- **10-Foot Spatial Navigation**: Dedicated TV shell (`TvShell`) optimized for television screens and remote controls (D-pad).
- **Deterministic D-pad Focus**: Reliable directional navigation through rails, search overlays, cards, and playback controls.
- **Background Playback**: Music continues playing seamlessly while browsing categories or other apps.
- **Optional Music Videos**: Toggle between pure high-fidelity audio streams and official music videos on TV.

### Android Mobile
- **Uninterrupted Background Play**: Native `AudioForegroundService` keeps music playing smoothly even with the screen turned off.
- **MediaSession Integration**: Full lock-screen and notification bar controls (album art, play/pause, seek, next/previous).
- **Smart Audio Focus**: Automatically pauses playback during incoming or outgoing calls and resumes when finished.

### High-Fidelity Streaming & Intelligent Search
- **High-Quality Audio Renditions**: Automatically selects high-bitrate AAC-LC and stereo HLS streams, avoiding low-quality audio tracks.
- **Desktop yt-dlp Engine**: Bundled and prioritized `yt-dlp` stream resolver in Tauri desktop for ultra-reliable streaming.
- **Filtered YouTube Music Search**: Automatically excludes live streams, podcasts, and long non-song videos from search results.

### Cross-Device Sync & Personalized Recommendations
- **Listening Preferences Learning**: Tracks partial plays, skips, and full listens to learn your musical taste across desktop, mobile, and TV.
- **Smart History Merge**: Merges offline listening data without duplicating entries.
- **Interactive Dashboard & Rankings**: Browse your most played tracks, albums, and artists with one-click direct playback and artist credit exploration.
- **Fixed Recommendation Panel**: Clean, stable recommendations that update on your next visit without reshuffling while listening.

### Library & Queue Management
- **Favorites**: Save and quickly access favorite songs, albums, and artists.
- **Playlists**: Create custom playlists, import playlists from external services, and export your library.
- **Advanced Queue**: Drag-and-drop queue reordering, shuffle mode, and loop/repeat controls.

### Customization & Privacy
- **Built-in Themes**: Multiple custom color schemes (Green, Aqua, Mint, Orange, Red, Violet, Dark/Light modes).
- **Zero Ads & Zero Tracking**: Completely free and open-source under AGPL-3.0. No data telemetry or telemetry servers.
- **Automated Signed Updates**: Built-in updater with cryptographic signatures so your desktop app is always up to date.

## Development

Aurora is a pnpm monorepo managed with Turborepo. The main app is built with Tauri (Rust + React).

### Prerequisites

- Node.js >= 22
- pnpm >= 9
- Rust (stable)
- Platform-specific Tauri dependencies ([see Tauri docs](https://v2.tauri.app/start/prerequisites/))

### Getting started

```bash
git clone https://github.com/danidetenerife/aurora.git
cd aurora
pnpm install
pnpm dev
```

### Useful commands

```bash
pnpm dev            # Run the player in dev mode
pnpm dev:remote     # Same, but binds Vite to 0.0.0.0 to test the web interface from other devices on your LAN
pnpm build          # Build all packages
pnpm test           # Run all tests
pnpm lint           # Lint all packages
pnpm type-check     # TypeScript checks
pnpm storybook      # Run Storybook
```

## Community

- [Discussions](https://github.com/danidetenerife/aurora/discussions)

## License

AGPL-3.0. See [LICENSE](LICENSE).
