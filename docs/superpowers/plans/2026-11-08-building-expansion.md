# Building Expansion (Approach B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (user chose Native).

**Goal:** Implement 4 modules (`herb_garden`, `generator`, `garage`, `bookshelf`) that wire the dead `parts`/`crafting`/`books`/fuel-night economy ends, without new mechanics beyond night electricity.

**Architecture:** Data-driven module defs in `src/data/modules.ts` + `BaseStats` aggregates in `src/sim/state.ts`; behaviour lands in existing event engine (`tasks.ts`, `daily.ts`, `expedition.ts`) following the `garden` plot pattern; a per-site `poweredTonight` flag computed in `daily.ts`; `Survivor.study: SkillId | null` routes reading XP.

**Tech:** TypeScript + React 19 + Vite + vitest; check with `npm run typecheck`, `npm test`, `npx vite-node scripts/sim.ts`.

**Spec:** `docs/superpowers/specs/2026-11-08-building-expansion-design.md`

**Baseline for balance:** bot 120d seeds 1/2/3 → day 84 / 85 / 92 game-over (đói). Compare after; survival-day deltas are not a hard gate, only no-insane-collapse + exercise of new modules.

## Global Constraints

- Deterministic sim: all uses of `s.rng` must stay serialisation-stable; no `Math.random`.
- `Icon` typing: `MODULE_ICONS: Record<ModuleId, string>` must stay exhaustive (add temp innawoods paths).
- Existing style: module `icon` field keeps a unicode glyph; canvas fallback already handles it.
- Save migration: any new Survivor/GameState field must default via `migrate()` without breaking `last30days:save`.
- Numbers fixed by spec table (costs/gears above) — do not "tune" without user.

## Review Focus

- Unknown room state: a save with rooms built before this change must still `baseStats()` (test: fixture world from `tests/`, assert stats).
- Generator fuel burn with 0 fuel must leave night penalty ×0.75 (test).
- `study` on survivor who never read / no bookshelf: reading stays random (test).
- Garlic… none: garage without car at depart site: preview unchanged no-crash (test).
- Herb garden room at area < min: cannot build (helper existing validation) — assert cost function throws/allowed path unchanged.

---

### Task 1: Data layer — ModuleId + MODULES + BaseStats + icon stopgap

**Files:** Modify `src/data/modules.ts`, `src/sim/state.ts` (BaseStats, baseStats counts), `src/ui/icons.tsx` (4 temp mappings).
**Interfaces:** Produces `MODULES['herb_garden'|'generator'|'garage'|'bookshelf']`, `BaseStats.garage/bookshelf/generator/herbGarden: number` (count of herb rooms, bools for the rest).
- [ ] Step 1: extend union + defs per spec table (copy values verbatim).
- [ ] Step 2: `baseStats` counts; `autoAssign` untouched.
- [ ] Step 3: `npm run typecheck` PASS; `npm test` PASS (existing suites unaffected).

### Task 2: Herb garden sim

**Files:** Modify `src/sim/tasks.ts` (gardener tend fallback for herb rooms), `src/sim/daily.ts` (growth→harvest yields medicine/bandage like crops but kcal-free; seeds refund max(1, a/100)).
**Interfaces:** Produces: herb round with `plot.growth >= 1` adds `{medicine: a/12, bandage: a/6}` rounded, replants only if bandage+medicine population deficit.
- [ ] Step 1: failing vitest: build herb room, loop engine days, expect medicine/bandage increment and seed consumption.
- [ ] Step 2: implement minimal (mirror CROPS handling with herb constants days=40, no CROPS entry needed if keeps un-tended +30% growth rule).
- [ ] Step 3: test PASS; `npm run typecheck` PASS; commit `feat(sim): herb garden module`.

### Task 3: Generator night power

**Files:** Modify `src/sim/daily.ts` (per site per day: if `st.generator` and fuel `>= 24` burn 24, set `site.powered = true` else false), `src/sim/tasks.ts` (workMult night ×0.75 skip when `site.powered`; heat +6/night inside daily toggle) + Site state field `powered?: boolean` in `state.ts` migrate default false.
**Interfaces:** Produces `workMult(s, v, sk, site?)` — callers pass site where available.
- [ ] Steps: failing test (0 fuel keeps 0.75; fuelled night → 1.0 determinism + heat), implement, PASS, commit `feat(sim): diesel night power`.

### Task 4: Bookshelf study surface

**Files:** `src/sim/state.ts` (Survivor.study default null + migrate), `src/sim/tasks.ts` ('read' uses `v.study ?? random`), `src/ui/PeopleView.tsx` (select "Tự học" with empty option, disabled without site bookshelf).
- [ ] Steps: failing test XP routed to chosen skill when set, random markedly when null; implement UI minimal dropdown own row; PASS; commit `feat: directed self-study`.

### Task 5: Garage expedition effects

**Files:** `src/sim/expedition.ts` (mode==='car': fuelPerKm 0.08 & cargo +80 when from-site `st.garage` — both in preview and commit paths).
- [ ] Steps: failing test preview fuel = pathKm × 0.08 and carry+80; implement; PASS; commit `feat(expedition): garage fuel/cargo`.

### Task 6: Bot + docs + balance + ship

**Files:** `scripts/headless.ts` (bot: build herb garden when medicine+bandage stock ≲ population; ignore others), `docs/GAMEPLAY.md` §9.2 table + night-power note, run `npx vite-node scripts/sim.ts -- 120 1/2/3` after.
- [ ] Step 1: bot rule change; typecheck+test PASS.
- [ ] Step 2: GAMEPLAY.md rows for 4 modules (same table format).
- [ ] Step 3: run 3 seeds; record in spec doc "Kết quả" section; no regression regime (esp: not worse than baseline by >20% on any seed).
- [ ] Step 4: `npm run build` PASS; final commit.
