# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Neuro-Endo Checker** — a neuroendovascular (脳血管内治療) device compatibility checker.
Clinicians select catheters and the app tells them whether the inner catheter can physically pass through the outer catheter.

Targets: **Web** (Next.js) and **Mobile** (Expo / React Native) sharing the same core logic.

---

## Monorepo Layout

```
apps/
  web/          Next.js 15 (App Router), port 3000
  mobile/       Expo 52 / React Native 0.76 / Expo Router v4

packages/
  core/         Pure TypeScript — types, unit conversion, compatibility engine
  ui/           Shared React components / design tokens (Phase 2+)
  device-master/ master.json + generation scripts
  config/       Shared tsconfig presets (no eslint — root eslint.config.mjs covers all)
```

---

## Commands

```bash
# Install all dependencies
pnpm install

# Run all apps/packages in dev mode
pnpm dev

# Typecheck all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Run tests (packages/core only for now)
pnpm test

# Run tests for a single package
pnpm --filter @neuro-endo/core test

# Validate raw CSV before normalizing
pnpm --filter @neuro-endo/device-master validate -- --input raw/<file>.csv

# Generate master.json from validated CSV
pnpm --filter @neuro-endo/device-master normalize -- --input raw/<file>.csv
```

---

## Data Pipeline

```
Google Sheets  →  raw CSV (manual export)
    ↓  packages/device-master/scripts/validate.ts
    ↓  (fix all ERRORs first)
    ↓  packages/device-master/scripts/normalize.ts
    ↓
packages/device-master/master.json   ← only file apps ever read
```

**Raw CSV lives in:** `packages/device-master/raw/`
Place the Google Sheets export here before running validate/normalize.

The existing `device_import_template_utf8.csv` at the repo root is the original pre-monorepo file. Copy it to `packages/device-master/raw/` when running the pipeline.

---

## Device Data Facts

- `id_mm` and `od_mm` columns in the upstream CSV are **always empty** — do not use them.
- Only `id_inch` (inner diameter, inches) and `od_fr` (outer diameter, French) are populated.
- Unit conversions (confirmed, in `packages/core/src/units.ts`):
  - `id_inch × 25.4 = ID in mm`
  - `od_fr  × (1/3) = OD in mm`
- Categories and nesting order: `ガイディング` (outermost) → `中間` → `マイクロ` (innermost)

---

## Compatibility Engine Status

`packages/core/src/engine.ts` is **intentionally not implemented** (throws at runtime).

Four open questions must be answered by the clinical team before implementing:
1. Strict `<` vs. non-strict `≤` comparison
2. Whether a dimensional tolerance/margin applies
3. Whether to enforce category hierarchy in the engine
4. Which two-device pair combinations are valid

See `docs/specs/compatibility-engine.md` for full details.

---

## Known Data Issues (block normalize until resolved)

| Row | Device | Problem |
|-----|--------|---------|
| 46  | `6F Guider Softip (90 cm)` | name says 90 cm, `length_cm` = 100 |
| 107 | `Phenom 27 (160 cm)` | name implies id_inch ≈ 0.027, CSV has 0.021 |

---

## Key Design Constraints

- **Do not infer or assume medical rules.** If a clinical decision is needed, add a TODO and document it in `docs/specs/compatibility-engine.md`.
- **Device provenance:** Google Sheets remains the upstream source for legacy fields. The user authorized public-source research and, on 2026-09-18, specified that generic outer diameter maps to proximal outer diameter and generic inner diameter maps to distal inner diameter. Preserve explicit endpoint values and legacy fields. Record convention-based assignments as `assignment: user_convention`, separately from the source of the numerical value, in `packages/device-master/evidence/regional-diameters.json`. Existing generic dataset values may be used with source `legacySheet`; this is not manufacturer re-verification. Keep model mismatches and uncertain wire/lumen dimensions unresolved. See `docs/research/regional-diameters-2026-09-18.md`.
- **Local book supplement:** The user also authorized reading `超入門脳血管内治療2.pdf`. Matching historical models may supplement missing regional diameters when the book explicitly labels endpoints. Record the source as `local_book`, including edition, publication date, printed/PDF page numbers, and file hash. Do not treat book values as current manufacturer confirmation. See `docs/research/local-book-diameters-2026-09-18.md`.
- **master.json is committed.** Regenerate it only via the normalize script after human review of the raw CSV.
- **Compatibility results must be deterministic and explainable** — every result includes numeric values and a human-readable reason string.
- The `packages/ui` boundary: shared hooks and design tokens only. Platform-specific rendering (div/span vs View/Text) stays in the app layer.

---

## Spec Documents

- `docs/specs/master-schema.md` — master.json field definitions, data provenance, known issues
- `docs/specs/compatibility-engine.md` — compatibility algorithm, open questions, result format
