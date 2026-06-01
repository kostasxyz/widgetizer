# Collections — Implementation Blockers

> **Status: ✅ CLEAR.** All blockers in this document are **RESOLVED**, with each remediation written
> back into the spec ([future-collections.md](future-collections.md)) and plan
> ([future-collections-plan.md](future-collections-plan.md)). **Gate 0** (spec Section 19) and
> **Phase 0** of the plan are cleared. This document stays the registry: **append any newly
> discovered blocker here** and re-gate implementation until it too is RESOLVED. A blocker is only
> RESOLVED once the chosen remediation is written back into the spec — not merely decided in
> conversation.

This document is a companion to the Collections spec and plan. The spec describes *what to build*;
this document tracks *what must be settled before any of it is built*. It exists because the spec
contains at least one latent design conflict that would cause **silent data loss** if implemented
as currently written.

---

## How to use this document

- Each blocker has a stable ID (`BLOCKER-N`), a severity, a status, and a **What a fix must address**
  section.
- A blocker moves to **RESOLVED** only when the agreed remediation is folded into
  [future-collections.md](future-collections.md) (and the plan, where relevant). A verbal "we'll
  handle it" is not enough — the gate is cleared by written spec changes.
- **Append new blockers here as they are discovered.** Implementation stays gated until the whole
  list is RESOLVED.
- "BLOCKED" does not mean the feature is cancelled. It means the design is not yet safe to build.

## Blocker registry

| ID          | Title                                                                 | Severity                         | Status         |
| ----------- | --------------------------------------------------------------------- | -------------------------------- | -------------- |
| BLOCKER-1   | Preset collection-type overrides are destroyed by theme updates       | High — silent schema revert + data loss | ✅ RESOLVED — approach C (spec §5 "Preset Seeding") |
| BLOCKER-2   | Schema migration silently drops user data in removed optional fields  | High — silent data loss on theme upgrade/switch | ✅ RESOLVED — warn-before-drop (spec §4) |
| BLOCKER-3   | `menu.liquid` active-state rewrite silently breaks highlighting on all existing pages | High — silent UX/a11y regression | ✅ RESOLVED — wire `currentCanonicalPath` into existing render paths (spec §6) |

> The pre-implementation review (2026-06-01) that surfaced BLOCKER-2 and BLOCKER-3 also found three
> lower-severity spec gaps, all folded into the spec in the same pass — see
> "Pre-implementation review findings" below.

---

## BLOCKER-1 — Preset collection-type overrides are destroyed by theme updates

- **Severity:** High — silent schema reversion and user data loss, no warning to the user.
- **Status:** ✅ RESOLVED (2026-06-01) — candidate approach C. Collection-type schemas and templates
  are theme-only; presets may seed only `collections/` item data, never `collection-types/`. Written
  into spec Section 5 ("Preset Seeding"), Section 5 ("Theme Update Allowlist"), Section 4 (migration
  note), the Files-Touched table, and Section 19 Gate 0; and into plan Phase 0 and Phase 9. See
  "Resolution" below.
- **Discovered:** 2026-05-29
- **Affects:** Spec Section 5 (Theme Updates and Collection Lifecycle → Preset Seeding) and
  Section 4 (Schema Versioning and Migration).

### Summary

The spec gives presets the power to override a collection type's schema at project-creation time
(spec Section 5, "Preset Seeding": *"copy it into the project, **overwriting** the theme's
defaults"*). It separately puts `collection-types/` in the theme-update allowlist, to be replaced
**wholesale from the theme source** like `widgets/` (spec Section 5, "Theme Update Allowlist":
*"Treat it like `widgets/` — the entire folder is replaced on update"*).

These two decisions conflict. Theme updates never read from `presets/` — they read only the theme
source dir (`getThemeSourceDir`, [server/services/themeUpdateService.js:193](../server/services/themeUpdateService.js#L193)).
So the **first** theme update applied to a preset-derived project will:

1. **Not** propagate any change made to the *preset's* collection-type definition, and
2. Worse — **overwrite the project's preset-derived schema with the theme's base schema**, discarding
   the preset's overrides entirely.

Combined with the schema-migration rules in Section 4, this then **silently drops user data** that
was entered into preset-specific fields.

### Why it happens (mechanism)

The destructive copy is already in the existing update code and is what the spec says to reuse:

```js
// server/services/themeUpdateService.js:212-214 — runs per entry in UPDATABLE_PATHS
await fs.remove(targetPath);            // wipe the project's copy
await fs.copy(sourcePath, targetPath);  // replace with the THEME source copy
```

- `UPDATABLE_PATHS` today is `["layout.liquid", "assets", "widgets", "snippets", "locales", "screenshot.png"]`
  ([themeUpdateService.js:21](../server/services/themeUpdateService.js#L21)). The spec adds
  `collection-types` to this list (Section 5).
- The source is always the theme (`latest/` or root), never a preset
  ([themeUpdateService.js:193](../server/services/themeUpdateService.js#L193)). Presets are
  consulted **only** at project creation, via `resolvePresetPaths` — confirmed by the implemented
  presets feature: *"Presets are only used at project creation time. Once a project is created, it's
  independent."* ([theme-presets.md:142](theme-presets.md)).

So at creation the project's `collection-types/` is the **preset's** version (with its extra
fields); at first update that folder is removed and replaced by the **theme's base** version.

### Failure scenario (concrete)

Both the theme and a preset define a collection type `posts`. The preset's `posts` schema adds an
extra `subtitle` field on top of the theme's base `posts` schema. A theme update later adds another
field, `reading_time`, to the **preset's** `posts` definition.

1. A user creates a project from this preset. The project's `collection-types/posts/schema.json` is
   the preset version (has `subtitle`). The user authors several posts and fills in `subtitle`.
2. The user applies a theme update.
3. `applyThemeUpdate` removes `collection-types/` and copies the **theme's** `posts` schema (which
   has neither `subtitle` nor `reading_time`).
4. Result: the project now tracks the theme's base `posts` schema. The new `reading_time` field
   **never appears** (it lived only in the preset). The preset's original `subtitle` field is **gone**.
5. On next read, Section 4 normalization sees `subtitle` is no longer in the schema, moves its value
   to the **in-memory-only `_archived` map**, and flags nothing to the user. On the next save of each
   item, the archived data is **dropped permanently** (the spec is explicit that `_archived` is never
   written to disk).

The user loses authored content and gets a silently downgraded schema, with no warning.

### Impact

- **Silent schema reversion**: preset-specific collection types/fields disappear on the first update.
- **Silent data loss**: values entered into preset-only fields are archived in memory and then
  discarded on the next save (spec Section 4).
- **Confusing author experience**: theme authors who add fields to a *preset's* collection type will
  see those fields never reach existing projects, with no error explaining why.
- **No mitigation in the current spec**: Section 5 does not acknowledge this interaction at all.

### What a fix must address

Any accepted remediation must answer all of the following, in writing, in the spec:

1. **Source of truth on update.** When a preset-derived project updates, which `collection-types/`
   wins — the theme's, the preset's, or a merge? Define it precisely.
2. **Where the preset version comes from at update time.** Updates currently never touch `presets/`.
   The project *does* persist its preset id (`projects.preset` column, written at
   [server/controllers/projectController.js:222](../server/controllers/projectController.js#L222)),
   so re-resolving the preset is feasible (preset persisted at
   [server/db/migrations.js:15](../server/db/migrations.js#L15)) — but the fallback rules must be specified (what if the
   preset was renamed or removed in the newer theme version? what if `presets/` is absent from the
   update source?).
3. **Interaction with Section 4 migration.** Whatever survives the update must not trip the
   `_archived` silent-drop path for fields the user legitimately still has. If data could still be
   dropped, the user must be warned (the spec currently drops silently).
4. **Consistency with the rest of the update model.** `theme.json` is *merged* (user-wins); widgets
   are *replaced*. Decide which model collection-type schemas follow and justify it.

### Candidate approaches (none chosen — a decision is required)

These are options to evaluate, not a recommendation:

- **A — Re-resolve the preset on update.** Teach `applyThemeUpdate` to read the project's stored
  `preset` and prefer the preset's `collection-types/` over the theme's during the replace. Pulls
  presets into the update path for the first time; needs explicit fallback rules.
- **B — Merge instead of replace.** Treat collection-type schemas like `theme.json` (additive,
  id-keyed, preset/user-wins) rather than a wholesale folder replace. Needs defined array-merge
  semantics and must dovetail with Section 4.
- **C — Forbid preset overrides of collection-types.** Collection *types* become theme-only; presets
  may seed only `collections/` (item data), never `collection-types/`. Removes the conflict by
  removing the capability. Simplest; document as a hard limitation and update Section 5 accordingly.
- **D — Snapshot preset schemas as protected project content.** Copy preset `collection-types/` into
  a project-owned, update-protected location and treat them like user content. Heaviest; changes the
  protected/updatable boundary.

### Resolution (chosen: approach C)

**Decision:** Collection-type *schemas* and `template.liquid` files are **theme-only**. Presets may
seed only `collections/` (item data), never `collection-types/`. This removes the capability that
created the conflict rather than reconciling it.

Answering the four "What a fix must address" questions:

1. **Source of truth on update.** The **theme** always wins for `collection-types/`. There is no
   merge and no preset input — a project's schema is whatever its theme version ships.
2. **Where the preset version comes from at update time.** N/A — presets never define schema, so
   updates never need to re-resolve a preset. The `presets/` dir stays creation-time-only, exactly as
   [theme-presets.md:142](theme-presets.md) documents.
3. **Interaction with Section 4 migration.** Because a preset can never introduce a field the theme
   lacks, the post-update theme schema always contains every field the user has data for. The
   `_archived` silent-drop path is therefore never reached for preset-only fields. The only schema
   change is the theme bumping its own `schemaVersion` — the normal, already-handled migration path.
   Spec Section 4 now states this explicitly.
4. **Consistency with the update model.** Collection-type schemas follow the **replace** model (like
   `widgets/`), cleanly, because nothing other than the theme ever writes to `collection-types/`.

**Cost (documented limitation):** a theme that wants a richer collection for a given preset must
define that richer schema as the theme's own base schema (or as a distinct collection `type`), not as
a per-preset overlay. Accepted as the simplest safe option.

**Enforcement:** a preset that ships a `collection-types/` folder is rejected at theme upload;
`resolvePresetPaths` returns only `collectionsDir`; preset-seeded items of an unknown `type` are
skipped with a warning (orphaned-data behavior).

### Acceptance / how this blocker was cleared

- ✅ Approach C chosen and written into spec Section 5 ("Preset Seeding" + "Theme Update Allowlist")
  and Section 4 (migration note).
- ✅ Spec Section 19 Gate 0 and plan Phase 0 / Phase 9 updated to reference the resolution.
- ✅ Status flipped to RESOLVED above; spec pointer: Section 5, "Preset Seeding".

---

## BLOCKER-2 — Schema migration silently drops user data in removed optional fields

- **Severity:** High — silent user-data loss on a legitimate (non-preset) flow.
- **Status:** ✅ RESOLVED (2026-06-01) — **warn before dropping**. Spec Section 4 rewritten.
- **Discovered:** 2026-06-01 (pre-implementation review).
- **Affects:** Spec Section 4 (Schema Versioning and Migration).

### Summary

As originally written, Section 4 moved fields no longer in the schema into an **in-memory-only**
`_archived` map that "is not written to disk" and whose data "is gone if [the user doesn't re-add the
field], which matches the rest of Widgetizer's 'no hidden state' rule." On the next save of an item,
the dropped field's value was permanently lost — with no warning unless the field was *required*
(only required-field gaps set `invalid: true`).

This is a silent-data-loss path of the same **outcome** as BLOCKER-1, reached by a different route:
a theme **upgrade** that legitimately removes an optional field, or a theme **switch**. It is not
closed by the BLOCKER-1 (approach C) fix, which only addressed preset divergence.

### Why it happens (mechanism) + the false premise

The spec justified the drop by claiming it "matches the rest of Widgetizer." That premise is
**false**, verified in code:

- `persistPageWithMediaTracking` ([server/controllers/pageController.js:98-100](../server/controllers/pageController.js#L98)) writes page data **verbatim** (`JSON.stringify(pageData)`) — no schema-based pruning.
- Widget rendering merges defaults **under** stored settings (`Object.assign(enhancedSettings, settings)`, [renderingService.js:556](../server/services/renderingService.js#L556)); nothing prunes orphaned keys on save.

So pages/widgets **keep** orphaned values on disk indefinitely. Collections would have been the *only*
content type to silently discard them.

### Resolution (chosen: warn before dropping)

- On read, unknown fields are **separated** into the in-memory `_archived` map (so the form/render only
  see current-schema fields), but the **on-disk `settings` object retains them** — a read never erases.
- The write path (`buildCollectionItemData` / `writeCollectionItem`) **merges back** on-disk settings
  keys that are absent from both the current schema and the incoming payload, so an ordinary save
  cannot lose data in a dropped field.
- Discarding orphaned data is **explicit**: the editor shows an "Archived data" notice listing each
  orphaned field + value preview, behind a confirmed **Discard archived data** action
  (`useConfirmationAction`). Only that removes the keys.
- The false "matches Widgetizer's no-hidden-state rule" claim is removed; the new text notes the
  approach is strictly safer than pages/globals.
- Spec pointer: Section 4 ("Schema Versioning and Migration").

---

## BLOCKER-3 — `menu.liquid` active-state rewrite silently breaks highlighting on all existing pages

- **Severity:** High — silent UX + accessibility regression across every exported/previewed page.
- **Status:** ✅ RESOLVED (2026-06-01) — wire the new global into existing render paths. Spec Section 6 amended.
- **Discovered:** 2026-06-01 (pre-implementation review).
- **Affects:** Spec Section 6 (Path Resolution Strategy → active-state / menu snippet).

### Summary

Section 6 rewrites the shared `src/core/snippets/menu.liquid` to compute active state by comparing a
**new** global `currentCanonicalPath` instead of the old `pageSlug | append: '.html'`. But the spec
only described setting `currentCanonicalPath` in the **Phase-2 collection-item** export loop. The
snippet is rendered by **every** page, and the existing render paths set only `pageSlug`:

- `server/controllers/previewController.js` (~line 67) — preview.
- `server/controllers/exportController.js` (~line 286) — the existing page-export loop.
- `renderSingleWidget` morph path (`previewController.js` ~276-280).

With the snippet changed but these paths unchanged, `currentCanonicalPath` is `undefined` on every
normal page render, the comparison never matches, and `is-active` + `aria-current="page"` silently
vanish from all menus. Same "two correct-looking decisions combine into a silent regression" shape as
BLOCKER-1. The byte-equality page regression test would **not** catch it (it asserts layout output,
not active-state).

### Resolution

- Section 6 now **explicitly requires** setting `currentCanonicalPath` (and attaching `canonicalPath`
  to resolved menu items) in `previewController.js`, the existing page-export loop in
  `exportController.js`, and the `renderSingleWidget` morph path — not just the collection-item loop.
- For pages: `currentCanonicalPath = ${pageData.slug}.html` (or `index.html` for the homepage).
- The Phase-2 regression suite must add a **page-level active-state assertion** (a page whose menu
  links to itself renders `is-active`/`aria-current`), alongside the existing byte-equality test.
- Spec pointer: Section 6 ("Active-state vs href separation for menu items").

---

## Pre-implementation review findings (2026-06-01)

A pre-implementation review (anchor verification + adversarial design-conflict hunt, grounded in the
current `collections` branch) produced five findings. Anchor verification was clean — all ~28 cited
file/line/symbol references matched. The five design findings were all folded into the spec in one
pass:

| Finding | Severity | Outcome |
| ------- | -------- | ------- |
| 1 — menu active-state global not wired into existing page render paths | High | **BLOCKER-3** (above) |
| 2 — SeoTag change dropped `og:image` for pages without `siteUrl` (broke an existing test + the byte-equality promise) | Med-High | Resolved: **preserve** current behavior — constant `assets/images` base, root-absolute URL when no `siteUrl`. Spec Section 6 "SeoTag changes". |
| 3 — `resolveWidgetPageLinks` retained the `pagesByUuid.size === 0` short-circuit, so widget custom-URL links aren't depth-prefixed when the page map is empty | Med | Resolved: drop the short-circuit (mirror the menu fix). Spec Section 6 link-resolution call-site list. |
| 4 — schema migration silently drops removed-optional-field data | High | **BLOCKER-2** (above) |
| 5 — two-pass export validation ordering contradicted "writes no HTML on failure" | Med-Low | Resolved: validate before any disk write. Spec Section 13 step 2. |

The decisions for Findings 2 and 4 were made by the project owner during the review.

---

## Adding a new blocker

Copy the `BLOCKER-1` structure, give it the next ID, add a row to the registry table, and keep its
status ❌ UNRESOLVED until the remediation is written into the spec. The feature stays gated while
**any** row is unresolved.