#!/usr/bin/env node
// Contact sheet PNG cho bộ icon custom. Usage: node tools/preview_sheet.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const iconRoot = join(root, "public", "icons", "custom");
const manifest = JSON.parse(readFileSync(join(here, "icons.manifest.json"), "utf8"));

const cell = 48, gap = 10, pad = 20, cols = 10;
const items = manifest.assets;
const rows = Math.ceil(items.length / cols);
const W = pad * 2 + cols * (cell + gap) - gap;
const H = pad * 2 + rows * (cell + gap + 18) - gap;
let body = `<rect width="${W}" height="${H}" fill="#0a0a0a"/>`;
let missing = 0;
items.forEach((a, i) => {
  const f = join(iconRoot, a.path);
  let svg;
  try { svg = readFileSync(f, "utf8"); } catch { missing++; return; }
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 36 } }).render().asPng();
  const col = i % cols, row = Math.floor(i / cols);
  const x = pad + col * (cell + gap), y = pad + row * (cell + gap + 18);
  body += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="#16161a" stroke="#262624"/>`;
  body += `<g transform="translate(${x + 6} ${y + 6})"><image width="36" height="36" href="data:image/png;base64,${png.toString("base64")}"/></g>`;
  body += `<text x="${x}" y="${y + cell + 14}" font-family="Consolas" font-size="10" fill="#8f8f88">${basename(a.path, ".svg")}</text>`;
});
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
const png = new Resvg(sheet, { fitTo: { mode: "width", value: Math.min(W, 1500) } }).render().asPng();
writeFileSync(join(here, "icon-sheet.png"), png);
console.log(`sheet: tools/icon-sheet.png (${items.length} slots, ${missing} missing)`);
