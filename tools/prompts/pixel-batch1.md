You are generating PIXEL-ART game icons for HOLDOUT, matching the existing innawoods.net pixel style (read `docs/superpowers/specs/2026-11-08-pixel-icon-sheets-design.md` first — it pins the style rules, palette and deliverables).

Write ONE self-contained Node script `tools/pixelgen.mjs` that:

1. Defines for EACH of the 25 icons below a 24×24 char-grid map (string rows), where each char maps to a palette hex (transparent = '.'). Palette in the spec. Draw deliberate silhouettes — a bed is a bed (headboard + mattress), a water tank is a tank, a well has a crank arm, a watchtower has legs+roof, a gate swings, spikes are triangles, a generator is a motor with vents, shelves hold books. Keep outlines 2–3px dark (#202020 / #000000), 1 shadow tone per color, 1–2px top-left highlight row.
   Icons (group → names):
   - modules/: bedroom, kitchen, storage, workshop, infirmary, latrine, water_tank, filter, garden, herb_garden, well, watchtower, rec_room, bookshelf, garage, generator, shelter
   - sites/: site_base, site_outpost, site_field
   - structures/: struct_wall, struct_barricade, struct_spikes, struct_gate, struct_tower
2. Renders each icon to 48×48 PNG pixels (24-grid scaled ×2), zero anti-aliasing, color per char.
3. Encodes PNG with a MINIMAL hand-rolled encoder (zlib.deflateSync + CRC32 table — NO dependencies, no npm install). RGBA, filter 0 rows.
4. Writes:
   - `tools/pixelout/sheet-01.png` (sprite sheet: 5 columns × 5 rows of 48px cells, transparent bg, 8px gutter — 25 cells)
   - crops each icon to `public/icons/pixel/<name>.png`
   - `tools/pixelout/smanifest.json`: [{ "name": ..., "sheet": "sheet-01.png", "row": r, "col": c, "file": "public/icons/pixel/<name>.png" }]
5. Prints the list of files + total bytes.

Hard rules: do NOT install packages; do not touch anything outside tools/ and public/icons/pixel/; the script must run with plain `node tools/pixelgen.mjs`. After writing it, RUN it, verify the PNGs exist and the sheet decodes (re-read the sheet PNG header and check dimensions; at minimum file sizes > 0 and manifest rows/cols within bounds). Then print the sheet path + icon count.

Icon design briefs (24×24 logical):
- bedroom: bed 3/4 view, green blanket band, wooden headboard left, pillow white block.
- kitchen: cast-iron pot on firewood legs, orange flame teeth above, dark pot body.
- storage: brown chest, darker lid line, yellow latch, grey straps.
- workshop: grey workbench side view + hanging wrench silhouette.
- infirmary: white/steel medicine kit box, big red cross, handle.
- latrine: outhouse hut, dark door plank, angled roof.
- water_tank: blue steel barrel-drum with lighter ribs, mounted stand legs.
- filter: blue funnel over black cartridge row, drops below.
- garden: 3 green furrow rows on dark soil rectangle + one sprout.
- herb_garden: pot + tall herb silhouette + tiny red cross marking (green #4fa77a).
- well: stone ring + wooden A-frame + hanging bucket.
- watchtower: 4 legs, cabin box on top, dark roof, amber window dot.
- rec_room: purple jukebox: box with speaker grille dots + music note.
- bookshelf: brown shelf cabinet, 3 shelves with colored book spines.
- garage: grey open carport: flat roof, two posts, dark car silhouette inside.
- generator: yellow-orange motor block, exhaust pipe up-left, black vent slats, red cap.
- shelter: green A-frame tent, entrance triangle dark, guy rope hint.
- site_base: larger house with chimney, dark roof, lit window amber.
- site_outpost: flag pole on a small bunker; flag red.
- site_field: fence posts row + green field rows behind.
- struct_wall: grey brick wall 3 courses, mortar gaps darker.
- struct_barricade: crossed planks X on two legs, brown.
- struct_spikes: 3 sharpened stakes angled 45°, grey with darker tips.
- struct_gate: wooden gate: frame + vertical planks + latch bar.
- struct_tower: red-brown tower, taller than watchtower, small roof, dark sniper slit.
