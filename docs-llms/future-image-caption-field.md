# Future: `caption` as a media-record field (peer of `alt`/`title`)

> **Status: ✅ Implemented.** Per-image **caption** added to media records (migration v2 →
> repository chokepoints → route/controller with image-type gate → `MediaDrawer` →
> i18n → preset-seed → tests), and the `gallery` setting type's per-entry caption removed —
> gallery values are now a plain **`string[]`** of upload paths. Backend + frontend suites
> green (1297 / 427). **Scope was the storage + metadata-edit layer only** — consumers
> (widgets, Liquid tags/filters, render, gallery caption *display*) remain a separate later
> sprint (§6). This doc is retained as the design/implementation record.

## 1. Decision & motivation

A caption describes the **image itself**, the same way `alt` and `title` do — so it
belongs on the **media record**, edited once via the Edit-metadata drawer and reused
everywhere the image is used. This was decided after shipping the `gallery` setting type,
which had modeled caption as a **per-usage** field on each `{ src, caption }` entry
([`future-gallery-setting-type.md`](future-gallery-setting-type.md) §2).

**This supersedes that per-entry caption.** The gallery's caption is removed (§5); caption
becomes a single first-class media-metadata field available to *any* future consumer
(`image`, `gallery`, widgets, item templates) the moment that consumer asks for it.

- ✅ One home for all descriptive image text (`alt` = accessibility, `title` = advisory
  tooltip, `caption` = visible editorial text).
- ✅ Set once on the image, follows it across every usage — no re-typing on reuse.
- ✅ Usable by `image` and `gallery` alike; not gallery-specific.
- ⚠️ Trade-off accepted: a given image now has **one** caption, not a per-placement one.
  This was the explicit decision. Per-placement override is out of scope and can be added
  later if a real need appears.

## 2. Key architectural fact

Media metadata is stored as **discrete SQL columns** on `media_files`
([`migrations.js:29`](server/db/migrations.js)), **not** a JSON blob:

```sql
CREATE TABLE media_files (
  ... alt TEXT DEFAULT '', title TEXT DEFAULT '', width INTEGER, height INTEGER, ...
);
```

So adding `caption` requires a **DB migration**. Two consequences shape the work:

1. **Caption mirrors `title`** (optional, persisted) — **not the way `description` was.**
   `description` *used to be* a latent half-wired field: the metadata route sanitized a
   `body("description")` that had no column, no controller read, and no repo write, so it was
   silently dropped. **That phantom has since been removed** (§8) — so it is no longer in the
   current code. The lesson it leaves stands: **caption must be wired through route +
   controller + repo (+ migration + UI)**, end-to-end, or it would have suffered the same
   fate.
2. Reads and writes funnel through **single chokepoints** (`rowToMediaFile`,
   `insertMediaFile`), so most of the round-trip (export/import/duplicate) comes for free.

## 3. Storage-layer change map — the `caption` field

### 3.1 Database — new migration (`version: 2`)

[`server/db/migrations.js`](server/db/migrations.js): append a new entry to the
`migrations` array (do **not** edit the v1 `up()` — it's already applied on live DBs):

```js
{
  version: 2,
  description: "Add caption column to media_files",
  up(db) {
    db.exec(`ALTER TABLE media_files ADD COLUMN caption TEXT DEFAULT ''`);
  },
},
```

`runMigrations` auto-applies pending versions in a transaction and records them in
`_migrations`. Existing rows backfill to `''`. No data migration needed.

### 3.2 Repository — three single-point edits ([`mediaRepository.js`](server/db/repositories/mediaRepository.js))

| Site | Line | Change |
| --- | --- | --- |
| `updateFileMetadata` | 136, 140 | Add `caption = @caption` to the `UPDATE … SET`; add param `caption: metadata.caption ?? ""`. Update the JSDoc `{alt, title}` → `{alt, title, caption}`. |
| `insertMediaFile` | 217-218, 228 | Add `caption` to the INSERT column list + `VALUES`; add param `caption: fileData.metadata?.caption || ""`. **This single node covers upload, import, duplicate, and preset-seed writes** (`addMediaFile` *and* `writeMediaData` both route here). |
| `rowToMediaFile` | 276 | `metadata: { alt: row.alt || "", title: row.title || "", caption: row.caption || "" }`. **This single node makes caption appear everywhere metadata is read** (media library, `ImageInput`, export, duplicate). |

### 3.3 Route + controller

- [`media.js:53-55`](server/routes/media.js): add
  `body("caption").optional().trim().customSanitizer(stripHtmlTags)` alongside `alt`/`title`.
- [`mediaController.js`](server/controllers/mediaController.js) `updateMediaMetadata`
  (476-509): read `const caption = stripHtmlTags(req.body.caption)`; then **gate on file type**
  so caption is image-only at the data layer, not just the UI — the handler already fetches
  `file` (486), so: `const captionForType = file.type?.startsWith("image/") ? (caption || "") : ""`.
  Pass `caption: captionForType` into the `updateFileMetadata(...)` call (497) and into the
  response `metadata` object (500). Also the upload default at **line 296**
  (`metadata: { alt: "", title: "" }` → add `caption: ""`).

### 3.4 Frontend drawer ([`MediaDrawer.jsx`](src/components/media/MediaDrawer.jsx)) — the only UI change

This is the single shared metadata form, used by both callers (§3.5).

- `defaultValues` (18) → add `caption: ""`.
- `reset({...})` on file-change (35) and on close (42) → add `caption`.
- `register("caption")` + a Caption field block after the Title field (~161-165). Caption is
  **optional** (no `required`/`validate`), modeled on Title.
- `onSave` payload (62): `{ alt: data.alt, title: data.title, caption: data.caption }`.
- **Image-scoped.** This drawer is shared by images *and* file assets (PDFs); it already
  computes `isImage` ([`MediaDrawer.jsx:89`](src/components/media/MediaDrawer.jsx)) and gates
  image-only UI on it (line 124). Render the Caption field under `isImage` only — a caption is
  an image concept. The UI gate is backed by the controller gate (§3.3), so "images only" is
  enforced at the data layer too: a stray caption sent for a non-image is stored as `""`, never
  the submitted text.

### 3.5 Callers — no changes required ✅

Both save handlers `JSON.stringify(metadata)` wholesale and rehydrate local state from the
API response, so they forward any new key automatically:

- [`ImageInput.handleSaveMetadata`](src/components/settings/inputs/ImageInput.jsx) (109).
- [`useMediaMetadata.handleSaveMetadata`](src/hooks/useMediaMetadata.js) (48), used by the
  [`Media.jsx`](src/pages/Media.jsx) library page.

### 3.6 i18n ([`en.json:211`](src/locales/en.json))

Only one frontend locale exists. Add to `forms.media`:

```json
"captionLabel": "Caption",
"captionHelp": "Optional caption for this image. Shown where a theme displays it."
```

(No `*Required`/`*NotEmpty` keys — optional field.)

### 3.7 Round-trip — almost entirely free

| Path | Site | Status |
| --- | --- | --- |
| Export | [`projectController.js:928`](server/controllers/projectController.js) | **Free** — serializes the whole `getMediaFiles()` object (incl. `metadata.caption`) to `uploads/media.json`. |
| Import | `projectController.js:1159` | **Free** — passes full file objects to `writeMediaData` → `insertMediaFile` (§3.2). |
| Duplicate project | `projectController.js:662` | **Free** — same `writeMediaData` → `insertMediaFile` path. |
| Preset seed | `projectController.js:141` | **One explicit edit** — cherry-picks `{ alt, title }` from a flat manifest entry; add `caption: entry.caption || ""`. Update the manifest-shape doc comment at **line 106**. |

The preset **manifest *generator*** (theme tooling that emits captions into a preset's
`manifest.json`) is future-sprint, not blocking — see §6.

### 3.8 Tests ([`media.test.js`](server/tests/media.test.js))

Add caption round-trip assertions: `updateFileMetadata` persists + reads back caption;
`rowToMediaFile` maps `row.caption`; the `updateMediaMetadata` controller path strips HTML
and returns caption; upload defaults caption to `""`. (Mirror the existing alt/title tests.)

**Net storage-layer footprint: 1 migration, 3 repo edits, route + controller, one UI field,
one i18n entry, one preset-seed line, tests. No caption render/display consumer touched.**
(The coupled gallery cleanup in §5 *does* touch `GalleryInput`, the gallery sanitizer,
collection required-validation, docs, and Aegean — that's the caption *removal* from the
gallery, not caption *display* wiring.)

## 4. Why so little — the chokepoint design

`insertMediaFile` is the only write node and `rowToMediaFile` is the only read node. Adding
`caption` to those two plus `updateFileMetadata` means caption is **persisted on every write
path and present on every read path** automatically. Export/import/duplicate inherit it with
zero edits; only the preset-seed cherry-pick (which bypasses the read node by reading a flat
manifest) needs an explicit line. Consumers will see `caption` on `media.metadata` the instant
they read it — no further plumbing.

## 5. Coupled change — remove the gallery's per-entry caption

The `gallery` setting type stores `[{ src, caption }]`. Caption now lives on the media record,
so the per-entry caption is **removed** and the value becomes a **plain array of upload-path
strings**: `["/uploads/images/a.jpg", …]`. The type was introduced yesterday, is unreleased,
and is used by nothing but disposable test content — so this is a straight rewrite:
**no gallery-data migration, no legacy handling, no dual-format support.** (The *caption
field* still ships its own DB migration — §3.1; "no migration" here means no migration of
existing gallery *values*.)

### 5.1 Value shape

`gallery` = `string[]` of `/uploads/images/...` paths, order preserved, `[]` when empty.
Objects are gone. Caption *display* (the later sprint) resolves from the media record by `src`
(§6), so no per-entry field is needed.

### 5.2 Touchpoints

- [`GalleryInput.jsx`](src/components/settings/inputs/GalleryInput.jsx): drop `caption` from
  `toRows` (44), `toValue` (56), and `signature` (63); remove the caption `TextInput` and its
  `onCaptionChange`/`setCaption` handlers (97, 145). Row model stays `{ uid, src }` (uids still
  needed for dnd-kit + per-row file-input id); committed value is `rows.map(r => r.src)`.
- [`ImageInput.jsx`](src/components/settings/inputs/ImageInput.jsx): **keep** the
  `layout="row"` variant (the compact 100×100 thumbnail), but **remove the now-unused
  `children` slot** that held the caption — no dead pass-through left behind.
- [`sanitizationService.js`](server/services/sanitizationService.js) `sanitizeGalleryValue`:
  map each entry through `sanitizeImagePath`, filter `""`, return `string[]`. (A non-string
  entry yields `""` and drops — plain robustness, not legacy support.)
- [`collectionService.js`](server/services/collectionService.js) `isMissingValue` gallery
  branch: `!Array.isArray(value) || !value.some((s) => sanitizeImagePath(s) !== "")`.
- **Media-usage**: no change — `collectMediaPaths` already walks string arrays.
- **Docs**: update [`future-gallery-setting-type.md`](future-gallery-setting-type.md) §2/§6
  and the Gallery section of [`theming-setting-types.md`](theming-setting-types.md) to the
  string-array shape + a forward-pointer that caption is now image-level (this doc); remove any
  `{ src, caption }` example in [`core-collections.md`](core-collections.md).
- **Test/demo data**: rewrite gallery arrays to strings wherever they appear. Disposable data,
  not a migration.

### 5.3 No legacy handling

Strings only. No dual-format support, no object→string coercion, no "tolerant read." Nothing
in the system depends on the old `[{ src, caption }]` shape and the only data using it is
disposable. Rewrite that data and the tests in the same pass; delete the object assumption.

### 5.4 Tests for the gallery-shape change (coupled, do not skip)

§3.8 covers media-metadata tests; the gallery strip additionally **breaks/updates existing
gallery tests** that assume `{ src, caption }`. Update:

- [`sanitization.test.js`](server/tests/sanitization.test.js) — `sanitizeGalleryValue`:
  array of valid path strings kept in order; non-upload / `javascript:` / `../` / external
  strings **dropped**; non-array → `[]`; `null`/`undefined` → `[]`; output is `string[]` with
  **no `caption`** key. **Crucially: an `{ src, caption }` object entry is dropped, NOT
  converted to its `src` string** — this locks the "no coercion / no legacy handling" decision
  (§5.3) into the suite. (Replaces the current `{ src, caption }` assertions.)
- [`collectionItems.test.js`](server/tests/collectionItems.test.js) — defaults/required via
  `normalizeCollectionItem` + `buildCollectionItemData`: missing gallery → `[]`; a `required`
  gallery is invalid when `[]` or when it holds only blank/invalid `src`, valid with ≥1 real
  upload path — exercised against the **string** shape.
- [`collectionMediaUsage.test.js`](server/tests/collectionMediaUsage.test.js) +
  [`mediaUsage.test.js`](server/tests/mediaUsage.test.js) — gallery media-usage (collection
  item *and* theme setting) still tracks each `src` with the string shape; add/remove updates
  counts.

## 6. Out of scope — the later consumption sprint

Deliberately deferred; this plan does **not** touch them:

- **Caption display in galleries / widgets** — resolving a media record's caption by `src`
  at render and exposing it to Liquid. Two routes: (a) pre-resolve onto gallery entries in
  `prepareCollectionItemForRender`, mirroring how `alt` is resolved by the `{% image %}` tag;
  (b) the existing [`media_meta` filter](src/core/filters/mediaMetaFilter.js) already returns
  any metadata property, so once `rowToMediaFile` carries caption, a template can do
  `{{ img | media_meta: 'caption' }}` on a bare-string gallery path with **no new plumbing**.
  Pre-resolution is ergonomically nicer for authors; the filter is the zero-cost option. Pick
  during the sprint.
- **`{% image %}` / Liquid filters** surfacing caption to templates.
- **Block-based image+caption widgets** (e.g. Aegean's gallery *widget*, distinct from the
  gallery setting type) re-plumbed to read media-record captions. Aegean won't ship, so no
  action now.
- **Preset manifest generator** emitting captions into `manifest.json`.
- **Per-placement caption override** (re-introducing a per-usage caption on top of the
  media-record default).

## 7. Decisions (resolved)

All locked — nothing open:

1. **Caption is optional** (mirror `title`; no `required`/`validate`).
2. **Help-text copy**: *"Optional caption for this image. Shown where a theme displays it."* (§3.6).
3. **Images only** — the Caption field renders under `isImage` (§3.4); the column stays
   type-agnostic (files just leave it `""`).
4. **Gallery value shape**: `string[]` (§5.1).

## 8. Notes / latent issues surfaced

- **Phantom `description` — removed.** The metadata route accepted+sanitized a `description`
  field that had no column, no controller read, no UI, and no reader — it was silently
  dropped (§2). It has been deleted: the `body("description")` validator in
  [`media.js`](server/routes/media.js) plus stale JSDoc mentions in
  [`mediaController.js`](server/controllers/mediaController.js) `updateMediaMetadata` and
  [`mediaRepository.js`](server/db/repositories/mediaRepository.js) `updateFileMetadata`. No
  tests referenced it; the media suite stays green. This is the failure mode caption must
  avoid — wire it end-to-end, not half-scaffolded.

## 9. Docs to update on ship

- [`core-media.md`](core-media.md): metadata examples (lines ~90-92, 113-114), "Saves alt
  text and title" (228, 238), "persisted metadata columns (`alt`, `title`)" (375) → add
  `caption`.
- [`core-database.md`](core-database.md): `media_files` column list (41-42).
- [`theming-setting-types.md`](theming-setting-types.md) + [`future-gallery-setting-type.md`](future-gallery-setting-type.md):
  gallery value shape (§5.2).
- [`core-collections.md`](core-collections.md): remove any `{ src, caption }` gallery example →
  `string[]` (§5.2).

## 10. Review feedback — round 1 (dispositions)

- **Gallery `string[]` compatibility** → *Declined* (§5.3). No dual-format layer and no
  coercion; pre-ship branch, all `{ src, caption }` data is disposable and rewritten here. The
  sanitizer just doesn't throw on bad input (non-string → dropped) — that's robustness, not
  legacy support.
- **Test plan missed the gallery-shape change** → *Accepted* — added §5.4 (sanitization /
  collectionItems / collectionMediaUsage / mediaUsage updates for the string shape).
- **`media_meta` filter may make display trivial** → *Accepted as a sprint pointer* (§6).
- **Drawer shared by images + files; caption copy** → *Accepted* — caption gated on `isImage`
  (§3.4), open decision #4 (§7).

### Round 2 (dispositions)

- **"Owned and rewritten" must be acted on, or old rows vanish** → *Resolved by rewriting the
  data, not by coercion* (§5.3). An earlier draft added a read-time `{src}`→string coercion to
  rescue old rows; that is legacy handling and was **removed**. We're pre-release, the gallery
  type is a day old, and the only `[{ src, caption }]` data is disposable — so: strings only,
  rewrite the test/demo data + tests in the same pass, done. No coercion, no dual-format path.
- **§2 still present-tense about `description`** → *Accepted* — §2 rewritten to historical
  ("used to be… since removed"), stale line refs dropped, "reconciled against current code"
  claim restored.
- **§3.8 "No consumer touched" overclaims** → *Accepted* — reworded to "No caption
  render/display consumer touched," with an explicit note that §5 does touch the gallery
  input/sanitizer/validation (caption *removal*, not display).

### Round 3 (dispositions) — no architectural blockers

- **"no migration" misreads (feature has a DB migration)** → *Accepted* — §5.3 now says "no
  gallery-data migration" and points to §3.1 for the caption-column migration.
- **Backend not actually image-gated for caption** → *Accepted, hardened* — §3.3 adds a
  controller gate (`file.type.startsWith("image/") ? caption : ""`) so images-only is enforced
  at the data layer, not just the UI; §3.4 updated to match.
- **§9 missing `core-collections.md`** → *Accepted* — added to the ship checklist.
- **Lock "no coercion" in tests** → *Accepted* — §5.4 now requires asserting an `{ src, caption }`
  object entry is **dropped, not converted**.

## See Also

- [Media Library](core-media.md) — where caption gets documented on ship.
- [Database & Storage](core-database.md) — `media_files` schema + migrations.
- [Gallery setting type](future-gallery-setting-type.md) — the per-entry caption this supersedes.
- [Setting Types Reference](theming-setting-types.md) — `gallery` author-facing reference.
