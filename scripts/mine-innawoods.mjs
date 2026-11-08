// Build a game-ready item catalog from the cloned innawoods.net content.
//
//   node scripts/mine-innawoods.mjs            # uses tools/cache, fetches if missing
//   node scripts/mine-innawoods.mjs --refetch  # ignore cache
//
// innawoods has no crafting system and no weights (checked: item properties are
// only {year, singleHanded}), so this script supplies both: a deterministic kg
// estimate per mechanic and a draft recipe stub that a human edits in
// src/data/recipes.ts. Output is reviewable JSON, not final game data.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://innawoods.net';
const ROOT = path.resolve('.');
const CACHE = path.join(ROOT, 'tools', 'cache', 'innawoods');
const MANIFEST = path.join(ROOT, 'public', 'icons', 'innawoods', 'manifest.json');
const OUT = path.join(ROOT, 'tools', 'innawoods-catalog.json');
const refetch = process.argv.includes('--refetch');

const getJson = async (url, tries = 3) => {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1200 * i));
    }
  }
};

/** Type JSONs ship every icon as a base64 data-URI; strip them before caching. */
const strip = (items) =>
  items.map((it) => ({
    id: it.id,
    name: it.name,
    packId: it.packId ?? '',
    subtypeId: it.subtypeId ?? '',
    properties: it.properties ?? {},
  }));

const slug = (s) =>
  s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

// --- whitelist: what a base-building survival sim actually needs --------------
// type name -> { subtypes?: string[], cap?: number }  (cap = keep the first N after sort)
const KEEP = {
  Melee: { cap: 55 },
  Shotguns: { cap: 8 },
  Rifles: { cap: 6 },
  Pistol: { cap: 6 },
  Ammo: { cap: 14 },
  Armor: {},
  Headgear: { cap: 60 },
  Masks: { cap: 25 },
  Clothes: { cap: 55 },
  Backpacks: {},
  Bags: {},
  'Arm gear': {},
  'Leg gear': {},
  Vest: { cap: 15 },
  Nutrition: {},
  Medicine: { cap: 70 },
  Other: { cap: 90 },
  Electronics: { cap: 60 },
};

// Subtypes that add flavour we never use in a base-building sim.
const SKIP_SUBTYPE = [/^paper/i, /^smoking/i, /^paper & cards/i];

// Some innawoods types carry odd one-offs (a seat, a pair of parade wings). Keep the
// type honest by requiring the name to match what the mechanic actually is.
const MECHANIC_NAME = {
  backpack: /backpack|rucksack|bag|pack|duffel|sack|pouch|haversack/i,
  container: /bag|sack|pouch|case|box|container|canister|jerrycan|bottle|jar|bucket|flask|barrel/i,
  electronic: /solar|panel|battery|accumulator|charger|inverter|generator|flashlight|headlamp|torch|lantern|radio|walkie|antenna|wire|cable|power ?bank|fuse|bulb|lamp|led|dynamo|crank|multimeter|soldering|volt/i,
};

// Items that exist in a loadout planner but mean nothing in a base sim.
const SKIP_NAME = /^(key|keys|big key|small key|pencil|ball pen|pen|marker|permanent marker|notebook|newspaper|book|magazine|map|photo|letter)$/i;

// Item names borrowed from other games' IP: their art and names are not ours to ship.
const FOREIGN_IP = /^(EFT|The Long Dark|STALKER|Metro|Fallout|Valheim|DayZ|Rust|Tarkov|Dying Light|Project Zomboid)\b/i;

// --- mechanic + weight heuristics -------------------------------------------
// Weight is a first-pass estimate by mechanic; a human tunes the outliers.
const MECHANIC = {
  Melee: (sub) => (sub === 'Blunt' ? 'weapon_blunt' : 'weapon_blade'),
  Shotguns: () => 'firearm',
  Rifles: () => 'firearm',
  Pistol: () => 'firearm',
  Ammo: () => 'ammo',
  Armor: (sub) => (sub.includes('MOLLE') ? 'armor_plate' : 'armor_soft'),
  Headgear: () => 'helmet',
  Masks: () => 'mask',
  Clothes: () => 'clothes',
  Backpacks: () => 'backpack',
  Bags: () => 'container',
  'Arm gear': () => 'gloves',
  'Leg gear': () => 'boots',
  Vest: () => 'vest',
  Nutrition: (sub) => (/drink|alcohol/i.test(sub) ? 'drink' : /smoking/i.test(sub) ? 'comfort' : 'food'),
  Medicine: (sub) => (/bandage|tourniquet/i.test(sub) ? 'bandage' : /injection/i.test(sub) ? 'injection' : /hygiene/i.test(sub) ? 'hygiene' : /medkit/i.test(sub) ? 'medkit' : 'medicine'),
  Other: (sub) => {
    if (/tools/i.test(sub)) return 'tool';
    if (/fire/i.test(sub)) return 'fire';
    if (/cooking/i.test(sub)) return 'cookware';
    if (/bags|container/i.test(sub)) return 'container';
    if (/camping/i.test(sub)) return 'camping';
    return 'misc';
  },
  Electronics: () => 'electronic',
};

const KG = {
  weapon_blade: 1.1, weapon_blunt: 1.6, firearm: 3.4, ammo: 0.012,
  armor_soft: 2.4, armor_plate: 7.5, helmet: 1.3, mask: 0.25, clothes: 0.6,
  backpack: 1.4, container: 0.4, gloves: 0.15, boots: 0.9, vest: 2.2,
  food: 0.45, drink: 0.6, comfort: 0.03, medicine: 0.05, bandage: 0.06,
  injection: 0.05, hygiene: 0.2, medkit: 1.6, tool: 0.7, fire: 0.08,
  cookware: 0.8, camping: 1.8, electronic: 0.35, misc: 0.4,
};

// Name keywords that move weight, up or down.
const KG_TWEAK = [
  [/sledge|maul|war hammer|great ?sword|battle ?axe/i, 2.6],
  [/knife|dagger|pen|pin|needle/i, -0.7],
  [/axe|hatchet|machete|cleaver|shovel|crowbar|pry/i, 0.6],
  [/spear|glaive|halberd|pike|polearm|scythe/i, 1.4],
  [/solar|panel|generator|battery|car battery/i, 4.5],
  [/tent|sleeping bag|mattress/i, 2.2],
  [/water filter|filter/i, 1.2],
  [/ballistic|plate carrier|kevlar|ceramic/i, 4.0],
  [/light|flashlight|headlamp|lantern/i, -0.1],
];

// Weapons are classified by real-world form, not by name luck. First match wins.
// mitigation = share of incoming damage the weapon removes (the sim caps the sum at 45%).
// biteMult < 1 means reach: teeth mostly can't get to you.
const WEAPON_CLASS = [
  [/sledge|maul|war ?hammer|great ?sword|flamberge|zweihander|battle ?axe|poleaxe|halberd|bardiche|wood ?splitter/i, { mitigation: 0.29, durability: 150, kg: 4.2, cls: 'heavy' }],
  [/spear|pike|lance|glaive|naginata|trident|pitchfork|harpoon/i, { mitigation: 0.18, durability: 55, kg: 2.2, cls: 'reach', bite: 0.55 }],
  [/katana|wakizashi|nodachi|tachi|machete|kukri|parang|golok|bolo|barong|nata|falchion|sabre|saber|cutlass|scimitar|shashka|talwar/i, { mitigation: 0.22, durability: 85, kg: 1.3, cls: 'long_blade' }],
  [/sword|rapier|estoc|jian|dao|khopesh|gladius|spatha|seax|backsword|broadsword/i, { mitigation: 0.20, durability: 75, kg: 1.5, cls: 'sword' }],
  [/axe|hatchet|tomahawk|adze|billhook|sickle|scythe|kama|pickaxe|mattock|entrenching/i, { mitigation: 0.21, durability: 110, kg: 1.7, cls: 'axe' }],
  [/knife|dagger|dirk|stiletto|tanto|kunai|karambit|shiv|pusher|cleaver|razor|scalpel/i, { mitigation: 0.14, durability: 55, kg: 0.35, cls: 'short_blade' }],
  [/crowbar|pry ?bar|wrecking|nail ?pull/i, { mitigation: 0.21, durability: 200, kg: 1.9, cls: 'crowbar' }],
  [/bat|club|cudgel|stick|baton|tonfa|nunchaku|mallet|hammer|mace|flail|morning ?star|pipe|rebar|wrench|spanner|shovel|spade/i, { mitigation: 0.12, durability: 70, kg: 1.6, cls: 'blunt' }],
  [/knuckle|cestus|gauntlet/i, { mitigation: 0.09, durability: 40, kg: 0.5, cls: 'fist' }],
];

const tierOf = (name, props) => {
  const y = Number(props.year) || 0;
  if (/titanium|kevlar|ceramic|ballistic|composite/i.test(name)) return 4;
  if (/steel|alloy|tactical|military/i.test(name)) return 3;
  if (/iron|aluminium|aluminum|modern/i.test(name)) return 2;
  if (y >= 1990) return 2;
  return 1;
};

const num = (v) => (Math.round(v * 100) / 100).toFixed(2);

// Deterministic 0..1 from a name, so estimates vary per item but never per run.
const hash01 = (s) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = ((h ^ s.charCodeAt(i)) * 16777619) >>> 0;
  return (h % 10000) / 10000;
};
const jitter = (name, spread) => 1 + (hash01(name) * 2 - 1) * spread;

const main = async () => {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const byId = new Map(manifest.map((e) => [`${e.type}:${e.id}`, e]));

  await mkdir(CACHE, { recursive: true });
  const categories = JSON.parse(await readFile(path.join(CACHE, 'categories.json'), 'utf8').catch(async () => {
    const j = await getJson(`${BASE}/contents/categories.json`);
    await writeFile(path.join(CACHE, 'categories.json'), JSON.stringify(j));
    return JSON.stringify(j);
  }));

  const types = [];
  for (const cat of categories) {
    for (const t of cat.types ?? []) {
      if (t.local || t.modelType === 'face') continue;
      if (!(t.name?.en in KEEP)) continue;
      const subtypeNames = Object.fromEntries((t.subtypes ?? []).map((s) => [s.id, s.name?.en ?? '']));
      types.push({ typeId: t.id, name: t.name.en, subtypeNames, rule: KEEP[t.name.en] });
    }
  }

  const stats = {};
  const items = [];

  for (const t of types) {
    const file = path.join(CACHE, `${t.typeId}.json`);
    let raw;
    if (!refetch && existsSync(file)) {
      raw = JSON.parse(await readFile(file, 'utf8'));
    } else {
      raw = strip(await getJson(`${BASE}/contents/${t.typeId}.json`));
      await writeFile(file, JSON.stringify(raw));
    }

    let kept = raw.filter((it) => {
      const name = it.name?.en ?? '';
      if (!name || FOREIGN_IP.test(name)) return false;
      if (t.rule.subtypes && !t.rule.subtypes.includes(t.subtypeNames[it.subtypeId])) return false;
      if (SKIP_SUBTYPE.some((re) => re.test(t.subtypeNames[it.subtypeId] ?? ''))) return false;
      if (SKIP_NAME.test(name)) return false;
      return true;
    });

    // Same object often ships several times (skins, packs). Keep one, remember the rest.
    const seen = new Set();
    kept = kept.filter((it) => {
      const key = slug(it.name.en ?? '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Stable, readable order: shorter names first (generic before variants), then id.
    kept.sort((a, b) => (a.name.en ?? '').length - (b.name.en ?? '').length || String(a.id).localeCompare(String(b.id)));
    if (t.rule.cap) kept = kept.slice(0, t.rule.cap);

    stats[t.name] = { total: raw.length, kept: kept.length };

    for (const it of kept) {
      const name = it.name.en;
      const subtype = t.subtypeNames[it.subtypeId] ?? '';
      const mechanic = MECHANIC[t.name](subtype);
      const tier = tierOf(name, it.properties);
      // Unclassified melee (fictional or regional names) falls back to a short blade.
      const wclass = WEAPON_CLASS.find(([re]) => re.test(name))?.[1]
        ?? (mechanic.startsWith('weapon_') ? { mitigation: 0.12, durability: 60, kg: 1.0, cls: 'short_blade' } : null);

      // Base weight per mechanic, then real form, then a small deterministic spread.
      let kg = wclass?.kg ?? KG[mechanic] ?? 0.5;
      for (const [re, delta] of KG_TWEAK) if (re.test(name)) kg += delta;
      kg = Math.max(0.02, kg * jitter(name, 0.22));

      if (MECHANIC_NAME[mechanic] && !MECHANIC_NAME[mechanic].test(name)) continue;

      const entry = {
        id: `${slug(t.name)}:${it.id}`,
        name,
        nameRu: it.name?.ru ?? '',
        category: t.name,
        subtype,
        mechanic,
        kg: Math.round(kg * 100) / 100,
        tier,
        icon: byId.get(`${t.name}:${it.id}`)?.path ?? null,
        packId: it.packId,
        recipe: null, // a human fills src/data/recipes.ts; this file never invents recipes
      };

      if (wclass) {
        entry.class = wclass.cls;
        entry.mitigation = Math.round(wclass.mitigation * 100) / 100;
        entry.durability = Math.round(wclass.durability * jitter(name, 0.18));
        if (wclass.bite) entry.biteMult = wclass.bite;
      }
      if (mechanic === 'firearm') {
        entry.noise = t.name === 'Shotguns' ? 15 : 12;
        entry.rare = true;
        entry.mitigation = Math.round(0.34 * jitter(name, 0.15) * 100) / 100;
        entry.durability = 900;
      }
      if (mechanic === 'ammo') entry.caliber = slug(name).replace(/^\d+-/, '').slice(0, 14);
      if (mechanic === 'food') {
        // Rough kcal: a full meal tin/MRE outranks a snack bar.
        const base = /mre|ration|tin|can|stew|porridge|soup/i.test(name) ? 900
          : /bar|chocolate|biscuit|cookie|cracker/i.test(name) ? 450
          : /rice|pasta|noodle|flour|grain|cereal/i.test(name) ? 1400
          : /meat|fish|jerky|sausage|cheese/i.test(name) ? 700
          : 300;
        entry.kcal = Math.round(base * jitter(name, 0.25));
        entry.rotPerDay = /canned|tin|mre|ration|dry|jerky/i.test(name) ? 0.005 : 0.06;
      }
      if (mechanic === 'drink') entry.kcal = Math.round(120 * jitter(name, 0.6));
      if (mechanic === 'backpack' || mechanic === 'container') {
        entry.capacity = Math.round((mechanic === 'backpack' ? 35 : 6) * jitter(name, 0.45));
      }
      if (mechanic === 'medicine' || mechanic === 'bandage' || mechanic === 'injection') {
        entry.heal = mechanic === 'bandage' ? Math.round(12 * jitter(name, 0.4)) : 0;
        entry.cures = /antibio|antibac|penicillin|tetra|doxy|amoxi/i.test(name);
      }
      if (mechanic === 'electronic') {
        entry.power = /solar|panel/i.test(name) ? 'source' : /battery|accumulator/i.test(name) ? 'store' : 'load';
      }

      items.push(entry);
    }
  }

  const byMechanic = {};
  for (const it of items) byMechanic[it.mechanic] = (byMechanic[it.mechanic] ?? 0) + 1;

  await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), byMechanic, sources: stats, items }, null, 1));

  console.log(`kept ${items.length} items -> ${path.relative(ROOT, OUT)}`);
  for (const [t, s] of Object.entries(stats)) console.log(`  ${t.padEnd(14)} ${String(s.kept).padStart(4)} / ${s.total}`);
  console.log('\nby mechanic:');
  for (const [m, n] of Object.entries(byMechanic).sort((a, b) => b[1] - a[1])) console.log(`  ${m.padEnd(14)} ${n}`);
};

await main();
