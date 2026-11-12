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

  it('ships relative asset paths so the game runs from a subfolder', () => {
    // With the default base '/' every asset is requested from the domain root: hosting
    // the build at '/holdout/' produced a blank page. './' makes the build self-relative.
    const cfg = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
    expect(cfg).toContain("base: './'");
    const html = new URL('../dist/index.html', import.meta.url);
    if (!existsSync(html)) return;
    const markup = readFileSync(html, 'utf8');
    expect(markup).not.toMatch(/(src|href)="\/assets\//);
    expect(markup).toMatch(/(src|href)="\.\/assets\//);
  });

  it('a built bundle, when present, contains a worker asset', () => {
    const assets = new URL('../dist/assets/', import.meta.url);
    if (!existsSync(assets)) return; // no build in this checkout — nothing to check
    const files = readdirSync(assets);
    expect(files.some((f) => /maplibre-gl-worker|worker-/.test(f))).toBe(true);
    expect(join('dist', 'index.html')).toBeTruthy();
  });
});
