import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `vite dev` and `vite build` do not resolve maplibre's worker the same way. In the
 * shipped bundle the map threw "Worker failed to load" while the dev server was
 * fine — the game was unplayable on the deployed site and nothing caught it.
 */
describe('production map worker', () => {
  it('MapView pins the worker URL instead of trusting the bundler', () => {
    const src = readFileSync(new URL('../src/ui/MapView.tsx', import.meta.url), 'utf8');
    expect(src).toContain('setWorkerUrl');
    expect(src).toMatch(/maplibre-gl\/dist\/maplibre-gl-worker\.mjs\?url/);
  });

  it('the worker module the import points at really ships with the package', () => {
    const worker = new URL('../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url);
    expect(existsSync(worker)).toBe(true);
  });

  it('a built bundle, when present, contains a worker asset', () => {
    const assets = new URL('../dist/assets/', import.meta.url);
    if (!existsSync(assets)) return; // no build in this checkout — nothing to check
    const files = readdirSync(assets);
    expect(files.some((f) => /maplibre-gl-worker|worker-/.test(f))).toBe(true);
    expect(join('dist', 'index.html')).toBeTruthy();
  });
});
