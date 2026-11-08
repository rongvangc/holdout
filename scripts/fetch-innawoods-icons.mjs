// Download every item icon from the innawoods.net content bundle into
// public/icons/innawoods/, plus a manifest.json describing them.
//
//   node scripts/fetch-innawoods-icons.mjs
//
// Icons arrive as base64 data-URIs inside ~40 type JSON files at
// https://innawoods.net/contents/{typeId}.json (categories.json lists the types).

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://innawoods.net';
const OUT = path.resolve('public/icons/innawoods');

const slug = (s) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48) || 'x';

const getJson = async (url, tries = 3) => {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
};

const saveIcon = async (dataUri, file) => {
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUri);
  if (!m) return false;
  await writeFile(file, Buffer.from(m[1], 'base64'));
  return true;
};

const categories = await getJson(`${BASE}/contents/categories.json`);
const types = [];
for (const cat of categories) {
  for (const t of cat.types ?? []) {
    if (t.local) continue;
    types.push({ category: cat.name?.en ?? 'other', typeId: t.id, type: t.name?.en ?? t.id, subtypeNames: Object.fromEntries((t.subtypes ?? []).map((s) => [s.id, s.name?.en ?? ''])) });
  }
}
console.log(`${types.length} item types to fetch`);

const manifest = [];
let icons = 0;
let skins = 0;
let failed = 0;

for (const t of types) {
  let items;
  try {
    items = await getJson(`${BASE}/contents/${t.typeId}.json`);
  } catch (e) {
    console.error(`FAIL ${t.type}: ${e.message}`);
    failed++;
    continue;
  }
  const dir = path.join(OUT, slug(t.category), slug(t.type));
  await mkdir(dir, { recursive: true });
  for (const item of items) {
    const name = item.name?.en ?? item.name?.ru ?? String(item.id);
    const base = `${slug(name)}__${slug(String(item.id))}`;
    const file = `${base}.png`;
    if (item.icon?.image && (await saveIcon(item.icon.image, path.join(dir, file)))) icons++;
    const entry = {
      id: item.id,
      name,
      names: item.name,
      category: t.category,
      type: t.type,
      subtype: t.subtypeNames[item.subtypeId] ?? '',
      packId: item.packId ?? '',
      width: item.icon?.width ?? 0,
      height: item.icon?.height ?? 0,
      path: `icons/innawoods/${slug(t.category)}/${slug(t.type)}/${file}`,
      skins: [],
    };
    for (const skin of item.skins ?? []) {
      const sfile = `${base}__${slug(String(skin.id))}.png`;
      if (skin.icon?.image && (await saveIcon(skin.icon.image, path.join(dir, sfile)))) {
        skins++;
        entry.skins.push(`icons/innawoods/${slug(t.category)}/${slug(t.type)}/${sfile}`);
      }
    }
    manifest.push(entry);
  }
  console.log(`ok ${t.category} / ${t.type}: ${items.length} items`);
}

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`DONE: ${icons} icons + ${skins} skin variants across ${manifest.length} items (${failed} types failed)`);
