/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  // maplibre-gl v6 resolves its own worker relative to the module; pre-bundling breaks that.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
