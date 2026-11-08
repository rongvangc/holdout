You are generating mono-line tactical SVG icons for the web game HOLDOUT (zombie survival management). All rules are in `tools/icons-spec.md` — read it FIRST and obey.

Create EXACTLY these files, nothing else (never touch code, tests, docs or the validator/manifest):
- public/icons/custom/modules/bedroom.svg
- public/icons/custom/modules/kitchen.svg
- public/icons/custom/modules/storage.svg
- public/icons/custom/modules/workshop.svg
- public/icons/custom/modules/infirmary.svg
- public/icons/custom/modules/latrine.svg
- public/icons/custom/modules/water_tank.svg
- public/icons/custom/modules/filter.svg
- public/icons/custom/modules/garden.svg

For each: mono-line (stroke-width 2, fill="none" on every stroked element), viewBox "0 0 24 24", only rects/paths/polygons with integer coords and 45°/axis edges, the module's OWN accent color from the spec table as the main stroke, optional 1 extra accent in #eaeae6 or #8f8f88. 2–5 elements per file.

Validate + fix until clean:
`node tools/validate_icons.mjs public/icons/custom/modules/bedroom.svg public/icons/custom/modules/kitchen.svg public/icons/custom/modules/storage.svg public/icons/custom/modules/workshop.svg public/icons/custom/modules/infirmary.svg public/icons/custom/modules/latrine.svg public/icons/custom/modules/water_tank.svg public/icons/custom/modules/filter.svg public/icons/custom/modules/garden.svg`

Never weaken the validator or add exceptions to the manifest. Print the paths + summary line when done.
