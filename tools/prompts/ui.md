You are generating mono-line tactical SVG icons for the web game HOLDOUT (zombie survival management). All rules are in `tools/icons-spec.md` — read it FIRST and obey.

Create EXACTLY these files, nothing else (never touch code, tests, docs, the validator or the manifest):
- public/icons/custom/ui/tab_base.svg
- public/icons/custom/ui/tab_people.svg
- public/icons/custom/ui/tab_map.svg
- public/icons/custom/ui/tab_laws.svg
- public/icons/custom/ui/tab_log.svg
- public/icons/custom/ui/speed_pause.svg
- public/icons/custom/ui/speed_1.svg
- public/icons/custom/ui/speed_10.svg
- public/icons/custom/ui/speed_60.svg
- public/icons/custom/ui/speed_240.svg

For each: mono-line (stroke-width 2, fill="none" on every stroked element), viewBox "0 0 24 24", only rects/paths/polygons with integer coords and 45°/axis edges, 2-5 elements per file. Accent rules per spec (roles/skills/ui/sites = #eaeae6 network + red/amber accents; structures = their own color).

Validate + fix until clean:
`node tools/validate_icons.mjs public/icons/custom/ui/tab_base.svg public/icons/custom/ui/tab_people.svg public/icons/custom/ui/tab_map.svg public/icons/custom/ui/tab_laws.svg public/icons/custom/ui/tab_log.svg public/icons/custom/ui/speed_pause.svg public/icons/custom/ui/speed_1.svg public/icons/custom/ui/speed_10.svg public/icons/custom/ui/speed_60.svg public/icons/custom/ui/speed_240.svg`

Never weaken the validator or the manifest. Print the paths + the summary line when done.
