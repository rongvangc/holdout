Use your real image generator (`image_gen.imagegen`) — one call per icon, same style block every call:
"<subject>. Seamless flat pixel art game asset icon, chunky 2-3px dark outline around the whole silhouette, limited palette with exactly ONE base tone plus ONE darker shadow tone per material color, single light-toned highlight on the top-left edge, crisp visible pixels, generous 3px transparent margin, pure transparent background (alpha 0 outside silhouette), single centered object, no text, no watermark, no background scene."

Generate these 5 UI tab icons for the game HOLDOUT's header:
1. tools/imgout/tab_base.png → "a small fortified base building with a dark roof and an amber lit window"
2. tools/imgout/tab_people.png → "two human survivor silhouettes standing side by side, one in green jacket, one in brown"
3. tools/imgout/tab_map.png → "a folded expedition map with a red route line and small location dots"
4. tools/imgout/tab_laws.png → "a wooden gavel and a small law book"
5. tools/imgout/tab_log.png → "an open journal notebook with a pencil"

Then post-process with a new pure-node script `tools/imgtabs.mjs` (same hand-rolled PNG encoder style as tools/imgfence.mjs — no npm install):
- alpha threshold (<64 → transparent), nearest-neighbor to 48×48 with transparent padding,
- write crops to `public/icons/pixel/tab_base.png`, `tab_people.png`, `tab_map.png`, `tab_laws.png`, `tab_log.png`,
- compose `tools/pixelout/sheet-03.png` (5×1 grid, 48px cells, 8px gutter, transparent bg),
- APPEND the 5 entries to `tools/pixelout/smanifest.json` (same schema, "sheet": "sheet-03.png").
Validate: crops exist, 48×48, transparent corners, ≥1 visible pixel. Don't touch anything else, don't npm install. Print a short summary.
