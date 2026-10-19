import path from "node:path";
import { defineConfig } from "vitest/config";

// Minimal config: Vitest otherwise runs on its defaults (per CLAUDE.md), but
// lib/api-client.ts and friends import via the "@/" alias that tsconfig.json
// defines for the app bundler — Vitest doesn't read tsconfig paths on its
// own, so without this, any test importing something that transitively
// reaches an "@/" import fails with "Cannot find package '@/...'".
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
