---
description: Aurora - Music streaming app for your desktop and TV
---

# Aurora Documentation

Aurora is a free, open-source music player without ads or tracking. Search for any song or artist, build playlists, and start listening. This documentation is for both users and developers.

## Quick links

| Site     | Website                                                                    |
| -------- | -------------------------------------------------------------------------- |
| Github   | [https://github.com/danidetenerife/aurora](https://github.com/danidetenerife/aurora) |
| Releases | [https://github.com/danidetenerife/aurora/releases](https://github.com/danidetenerife/aurora/releases) |

## For users

New to Aurora? Start here:

- [Getting started](user-manual/getting-started.md) - install Aurora and play your first song
- [How Aurora works](core-concepts/how-aurora-works.md) - understand the plugin model and how playback works
- [Plugins and providers](core-concepts/plugins-and-providers.md) - what plugins do and how to manage your sources
- [Installation](user-manual/installation.md) - platform-specific download and install instructions
- [Themes](themes/themes.md) - customize Aurora's appearance with built-in, custom, or community themes

## What is in this repo?

This is a pnpm/turbo monorepo with these major packages:

- @aurora/player - Main Tauri app (React + Rust)
- @aurora/ui - Shared UI components
- @aurora/themes - Theming system and utilities
- @aurora/plugin-sdk - Plugin framework and helpers
- @aurora/model - Shared data model
- @aurora/hifi - Advanced HTML5 audio engine
- @aurora/i18n - Internationalization
- @aurora/storybook - Component demos
- @aurora/tailwind-config - Shared Tailwind v4 CSS config
- @aurora/eslint-config - Shared linting rules
- @aurora/tools - Build and maintenance utilities
- @aurora/docs - This documentation
- @aurora/website - Project website

## For developers

### Tech highlights

- TypeScript everywhere
- Tauri (desktop shell)
- React 18
- Tailwind v4 configured via CSS (@theme/@layer), no tailwind.config.js
- TanStack Router (routing)
- TanStack Query v5 (HTTP and client‑side server state; no backend server)
- Vitest + React Testing Library (tests)
- Coverage via V8 with CI reporting

### Common workspace tasks

Run these from the repo root:

```bash
pnpm dev            # Run player (and UI) in dev mode
pnpm dev:remote     # Same, but binds Vite to 0.0.0.0 so the remote control UI is reachable from other devices
pnpm build          # Build all packages
pnpm lint           # Lint all packages
pnpm test           # Run all tests
pnpm test:coverage  # Run tests with coverage
pnpm type-check     # TypeScript checks
pnpm tauri          # Tauri CLI for the player
pnpm storybook      # Run Storybook
```