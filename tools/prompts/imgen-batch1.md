You have a real image generator (`image_gen.imagegen`). Use it EXCLUSIVELY for this task — no code-drawn pixels this time.

GOAL: regenerate the 25 game icons of HOLDOUT as proper pixel-art raster icons, matching the existing innawoods.net style (reference `public/icons/innawoods/items/other/tent__454.png`, `public/icons/innawoods/items/nutrition/water-bottle__293.png` — read/see them for style), replacing the code-drawn batch in `public/icons/pixel/`.

STYLE PROMPT TEMPLATE — call the image tool once per icon, the trailing style block IDENTICAL every call:
"... <subject sentence>. Seamless flat pixel art game asset icon, chunky 2-3px dark outline around the whole silhouette, limited palette with exactly ONE base tone plus ONE darker shadow tone per material color, single light-toned highlight on the top-left edge, crisp visible pixels, generous 3px transparent margin around the object, pure transparent background (alpha 0 outside silhouette), single centered object, no text, no watermark, no background scene."

Per-icon subjects (keep them OBJECT-like, single centered):
- modules/bedroom → "a green sleeping bag with a brown headboard, a colorful game bed icon"
- modules/kitchen → "a black cast-iron cooking pot standing on firewood logs, small flames at the top"
- modules/storage → "a brown wooden storage chest with a metal latch and straps"
- modules/workshop → "a grey metal workbench with a hanging wrench"
- modules/infirmary → "a white first-aid kit box with a red cross and steel handle"
- modules/latrine → "a small brown wooden outhouse hut with an angled roof and dark door plank"
- modules/water_tank → "a blue steel water barrel-drum with lighter ribs on a stand"
- modules/filter → "a blue water purification funnel above a black cartridge, drops falling"
- modules/garden → "a dark soil rectangle with three green furrow rows and one sprout"
- modules/herb_garden → "a small clay pot with a tall green medicinal herb, tiny red cross tag"
- modules/well → "a stone well ring with a wooden A-frame and a hanging bucket"
- modules/watchtower → "a wooden watchtower, four legs, cabin on top with dark roof and amber window"
- modules/rec_room → "a purple jukebox with speaker grille dots and a music note"
- modules/bookshelf → "a brown bookshelf cabinet, three shelves of colorful book spines"
- modules/garage → "a grey carport with flat roof and two posts, dark car silhouette inside"
- modules/generator → "an orange-yellow generator motor box with black vent slats and a fuel cap"
- modules/shelter → "a green A-frame camping tent with dark entrance triangle"
- sites/site_base → "a large house with chimney, dark roof, one amber lit window"
- sites/site_outpost → "a small bunker with a tall flag pole and a red flag"
- sites/site_field → "fence posts in a row with green field furrows behind"
- structures/struct_wall → "a grey brick wall segment, three courses with darker mortar gaps"
- structures/struct_barricade → "a brown crossed-planks barricade X on two legs"
- structures/struct_spikes → "three grey sharpened stakes angled 45 degrees, darker tips"
- structures/struct_gate → "a wooden gate frame with vertical planks and a latch bar"
- structures/struct_tower → "a tall red-brown guard tower with small roof and a dark arrow slit"

DELIVERABLES (overwrite, keep names):
1. `tools/imgout/` — raw generator outputs per icon (name each call output file by icon name).
2. Post-process script `tools/imgfence.mjs` (pure node + zlib, same PNG encoder style as tools/pixelgen.mjs): 
   - read each raw output, threshold alpha (<64 → fully transparent), snap to a hard transparent border, downscale/nearest-neighbor to 48×48 keeping square aspect with transparent padding
   - write `public/icons/pixel/<name>.png` (overwrite the code-drawn ones)
   - compose `tools/pixelout/sheet-02.png` — 5×5 grid of 48px cells with 8px gutter, transparent bg, row-major in the order above
   - update `tools/pixelout/smanifest.json` (same schema; add "sheet": "sheet-02.png")
3. Validate: every 48×48 crop has transparent corners and ≥ 1 non-transparent pixel; print the sheet path + count.
Do not touch anything else. Do not npm install. Print token-light summary at the end.
