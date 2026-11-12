/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset URLs. With the default '/' every asset — the bundle, the icons,
  // the maplibre worker — is requested from the domain root, so the game only works
  // when it is deployed at '/'. Hosting it at '/holdout/' (or any subfolder) gave a
  // blank page. './' makes the build self-relative.
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  // maplibre-gl v6 resolves its own worker relative to the module; pre-bundling breaks that.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  // Ship the maplibre worker as .js, not .mjs.
  //
  // Many static hosts serve .mjs as application/octet-stream (nginx before 1.21, a lot
  // of cheap shared hosting, some CDNs). A module worker with that MIME is refused by
  // the browser and the map dies with "Worker failed to load" — the game is unplayable
  // while every other asset looks fine. `.js` is in every host's MIME table.
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (info) => {
          const names = [info.name, ...(info.names ?? [])].filter(Boolean).join(' ');
          if (names.includes('maplibre-gl-worker')) return 'assets/maplibre-worker-[hash].js';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  // A 60-day headless run legitimately takes longer than the 5 s default.
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'], testTimeout: 20000 },
});
