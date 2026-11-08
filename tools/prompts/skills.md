You are generating mono-line tactical SVG icons for the web game HOLDOUT (zombie survival management). All rules are in `tools/icons-spec.md` — read it FIRST and obey.

Create EXACTLY these files, nothing else (never touch code, tests, docs, the validator or the manifest):
- public/icons/custom/skills/stealth.svg
- public/icons/custom/skills/scavenging.svg
- public/icons/custom/skills/cooking.svg
- public/icons/custom/skills/construction.svg
- public/icons/custom/skills/crafting.svg
- public/icons/custom/skills/medical.svg
- public/icons/custom/skills/mechanics.svg
- public/icons/custom/skills/melee.svg
- public/icons/custom/skills/fitness.svg
- public/icons/custom/skills/farming.svg

For each: mono-line (stroke-width 2, fill="none" on every stroked element), viewBox "0 0 24 24", only rects/paths/polygons with integer coords and 45°/axis edges, 2-5 elements per file. Accent rules per spec (roles/skills/ui/sites = #eaeae6 network + red/amber accents; structures = their own color).

Validate + fix until clean:
`node tools/validate_icons.mjs public/icons/custom/skills/stealth.svg public/icons/custom/skills/scavenging.svg public/icons/custom/skills/cooking.svg public/icons/custom/skills/construction.svg public/icons/custom/skills/crafting.svg public/icons/custom/skills/medical.svg public/icons/custom/skills/mechanics.svg public/icons/custom/skills/melee.svg public/icons/custom/skills/fitness.svg public/icons/custom/skills/farming.svg`

Never weaken the validator or the manifest. Print the paths + the summary line when done.
