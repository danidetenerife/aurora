# Context

- Project: Aurora (Music player desktop app + Android / Google TV)
- Tech Stack: Tauri (Rust + React), TypeScript, pnpm monorepo, Turborepo, Vite, Vitest, Tailwind CSS v4, Zustand.
- Mission: Enforce official-only music video selection, fix video sync / premature skipping on Google TV, and execute release build/publish pipeline.
- System prompt rules: Strictly DISPATCH-ONLY. No direct code edits to source files, no running test commands directly, no direct code investigation. Delegate to specialized subagents.
