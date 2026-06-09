# Future: `gallery` setting type (repeating image)

> **Status: ✅ Implemented — value shape since revised.** Shipped as the `gallery`
> setting type: registration, sanitization (`sanitizeImagePath` + `sanitizeGalleryValue`),
> collection defaults/required, theme media-usage, and `GalleryInput`.
>
> **⚠️ Superseded in part:** the original per-entry `caption` was **removed**. Caption now
> lives on the **media record** alongside `alt`/`title`, and the gallery value is a plain
> **`string[]` of upload paths**. The sections below that describe `{ src, caption }` objects
> are kept as the original design record; read them as history, not current behavior. The
> author-facing reference is [`theming-setting-types.md`](theming-setting-types.md).

## 1. Motivation

The `image` setting type holds a **single** upload path. Themes that want a gallery
must declare a **fixed** number of `image` fields — e.g. Aegean's accommodation
schema fakes one with `gallery_1`…`gallery_4`
([`themes/aegean/collection-types/accommodation/schema.json`](themes/aegean/collection-types/accommodation/schema.json)).
That caps the count at author-time and litters the form with empty slots.

`gallery` is a first-class **repeating image** field: the user adds as many images
as they want, reorders them, and writes a **per-image caption**. It is general
purpose — usable in widget, theme, and collection-type schemas — not collection-only.

## 2. Value shape

> **Current shape (revised):** a `gallery` value is an **ordered array of upload-path
> strings** — `["/uploads/images/suite-01.jpg", …]`. All descriptive text (`alt`, `title`,
> `caption`) lives on the media record. The original per-entry-object design below is kept
> as history.

~~A `gallery` value is an **ordered array of entry objects**:~~ *(superseded)*

```json
"gallery": [
  { "src": "/uploads/images/suite-01.jpg", "caption": "Caldera at dusk" },
  { "src": "/uploads/images/suite-02.jpg", "caption": "" }
]
```

- `src` — an upload path, exactly like a single `image` value. Image **alt/title**
  stay on the **media record** (per-file, edited via the existing Edit-metadata
  drawer), not in the setting — consistent with `image`. Resolution at render goes
  through the existing `{% image %}` tag / `imagePath`.
- ~~`caption` — per-**usage** plain text authored on the item/widget.~~ *Removed: caption
  is now a media-record field (per-image), not per-usage.*
- Empty value is `[]`. Order is authored (drag-to-reorder), preserved on save.

## 3. Registration (single source of truth)

Add `"gallery"` to `SUPPORTED_SETTING_TYPES` in
[`src/components/settings/supportedSettingTypes.js`](src/components/settings/supportedSettingTypes.js)
— the one list shared by the frontend renderer and the backend collection-schema
validator. That alone stops the validator rejecting it as an "unsupported setting
type". It is **not** a `multiple`/`repeater` key (those stay in
`DISALLOWED_SETTING_KEYS`); `gallery` is its own type whose value is intrinsically a
list, so the existing rejection of ad-hoc repeaters is unchanged.

## 4. Frontend

**New input** `src/components/settings/inputs/GalleryInput.jsx`:
- Renders one row per entry: a thumbnail + the existing `ImageInput` media-selector
  flow (Choose from library / upload / Edit-metadata / Remove) **plus** a caption
  `TextInput` beneath each image.
- An **"Add image"** button appends an empty entry (opens the media selector).
- **Drag-to-reorder** via `@dnd-kit` (already a dependency; mirror
  `CollectionItems`/the menu editor) with a grip handle per row.
- Remove drops the entry from the array. All mutations call `onChange(nextArray)`.
- Reuse `ImageInput`'s media-selector + metadata-drawer machinery — factor the shared
  bits out of `ImageInput` rather than duplicating, so the per-entry picker behaves
  identically to a single `image`.
- **`type="button"`** on every control (the form-submit trap — see the `Button`
  default fix; safe now but keep explicit in new code).

**`SettingsRenderer.jsx`** — add a `case "gallery"` branch dispatching to
`GalleryInput`, wrapped in `SettingsField` like the others (label/required/description).

**Wiring (easy to miss):**
- **Barrel export + import.** `SettingsRenderer` imports its inputs from the barrel
  ([`src/components/settings/inputs/index.js`](src/components/settings/inputs/index.js)),
  not by direct path. Add `export { default as GalleryInput } from "./GalleryInput";`
  to that file, then add `GalleryInput` to the destructured `from "./inputs"` import
  block at the top of `SettingsRenderer.jsx`. Without the export the `case "gallery"`
  branch references an undefined component.
- **Unique per-row id.** `ImageInput` binds the schema `id` to its hidden
  `<input type="file">` ([`ImageInput.jsx`](src/components/settings/inputs/ImageInput.jsx) line 147).
  If `GalleryInput` reuses that machinery (whether by composing `ImageInput` directly
  or via the factored-out sub-component), N rows sharing one `id` collide — the file
  pickers and label associations break. Give each entry a **stable client-side key** (a
  generated uid held in component state) and use it for the `@dnd-kit` sortable id, the
  React `key`, **and** the per-row file-input id. Don't key on `src` or the array index:
  `src` can be empty or duplicated across rows, and the index changes on reorder.

## 5. Backend

`gallery` touches **three** backend concerns — schema validation/defaults, value
sanitization, and media-usage tracking. Each currently assumes scalar (or single-object)
values; each needs a small, localized array-aware addition. The notes below are
reconciled against the current code (line refs included) because several existing
helpers do **not** behave the way the earlier draft of this doc assumed.

### 5.1 Validation, empty defaults, and required handling

**Schema validation** ([`collectionService.js`](server/services/collectionService.js)
`validateCollectionSchema`, line 42): each field's `type` is only checked for membership
in `SUPPORTED_SETTING_TYPES` via `isSupportedSettingType` (line 75). Once `"gallery"` is
in that list (§3) the validator accepts it with **no further change**. It performs no
`src` inspection — `src` integrity is a *sanitizer* concern (§5.2), not schema
validation. (This split matters for the tests — see §9.)

**Empty / placeholder default** (`emptyDefaultForType`, line 270): add
`case "gallery": return [];`. The current `default` branch returns `""`, so a gallery
with no schema default would be seeded as an empty **string** and break the array
contract. `normalizeCollectionItem` uses this helper to fill a missing `gallery` to `[]`
(§7).

**Required-field validation** (`isMissingValue`, line 285): add a gallery branch. Note
it must check for **at least one entry with a real `src`**, not just array length — a row
with a blank/invalid `src` is not a real image:

```js
if (type === "gallery") {
  return !Array.isArray(value) || !value.some((e) => e && sanitizeImagePath(e.src) !== "");
}
```

Reuse the **same `sanitizeImagePath` helper** from §5.2 (import it into `collectionService.js`,
which already imports from `sanitizationService.js` at line 25) so "valid `src`" means the
identical thing in validation and sanitization. A bare `e.src.trim() !== ""` check is not
enough — it would treat `[{ "src": "javascript:alert(1)" }]` or `[{ "src": "../../etc/passwd" }]`
as *present*, contradicting the "blank **or invalid** `src` rows don't count" rule.

A plain `value.length === 0` check would also be wrong: `isMissingValue` runs on **raw,
un-sanitized item data** inside `normalizeCollectionItem` (line 368) and the write path
`buildCollectionItemData` (line 643), and that pipeline never runs the sanitizer (the
sanitizer only runs at render, in `prepareCollectionItemForRender` — §5.2). So a stored
`[{ "src": "", "caption": "x" }]` would otherwise count as length 1 → *present*, even
though it has no image. The `some((e) => sanitizeImagePath(e.src) !== "")` check is the
authoritative rule.

The frontend's [`CollectionItemForm.jsx`](src/components/collections/CollectionItemForm.jsx)
`isMissingValue` (line 21) is generic and gallery-unaware — its array branch is just
`value.length === 0`, and its comment claims it "Mirrors the backend rule." To keep the two
aligned for legitimately-authored data, `GalleryInput` should **not commit blank-`src`
rows**: a freshly-added row stays editor-local until an image is chosen, and empty rows are
stripped from the value it emits. Then a truly-empty gallery has `length === 0` on the
frontend too, while the backend's `src`-aware check remains the source of truth for
hand-edited/imported JSON.

> **Widgets and theme settings have no `normalizeCollectionItem` equivalent**, so their
> gallery value comes straight from the stored value or the schema `default`. To keep
> them robust, `GalleryInput` must coerce a non-array / `undefined` `value` to `[]`
> (`SettingsRenderer` passes `setting.default`, which may be unset). Asking authors to
> set `"default": []` is good hygiene but not sufficient on its own — the input-side
> normalization is the real guard.

### 5.2 Sanitization (three call sites, one shared rule)

There are **three** sanitizers, not two — the earlier draft named only the first two:

- widget settings → `sanitizeWidgetData` → `sanitizeSettingValue` (line 67)
- collection-item settings → `sanitizeCollectionItemData` → `sanitizeSettingValue` (line 67)
- **theme settings → `sanitizeThemeSettingValue` (line 167)** — a *separate* switch. This
  is the path the "works in theme schemas" claim (§1) depends on; with no case here a
  theme `gallery` value is returned untouched.

> **Theme *defaults* are intentionally not sanitized.** `sanitizeThemeSettings` only runs
> `sanitizeThemeSettingValue` on entries where `item.value !== undefined` (line 243) — it
> never touches `item.default`, and that is true for **every** setting type, not just
> gallery. So an author-shipped gallery `default` in `theme.json` is the author's
> responsibility (theme-upload validation is the gate for author content) and isn't run
> through `sanitizeGalleryValue` until the user sets a value. Keep gallery consistent with
> this — don't special-case it to sanitize defaults.

Add a `gallery` branch to **both** switches (`sanitizeSettingValue` and
`sanitizeThemeSettingValue`), delegating to one shared helper so all three call sites
behave identically. The helper **filters out** entries whose `src` doesn't survive the
upload-path check — rather than keeping them as `{ src: "" }` — so render never emits empty
figures and a gallery of only blank rows collapses to `[]`:

```js
function sanitizeGalleryValue(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      src: sanitizeImagePath(entry?.src),
      caption: stripHtmlTags(typeof entry?.caption === "string" ? entry.caption : ""),
    }))
    .filter((entry) => entry.src !== ""); // drop rows with no valid image
}
```

> **Mind the early `null` guard.** Both `sanitizeSettingValue` (line 68: `if (value == null) return value;`)
> and `sanitizeThemeSettingValue` (line 168) return **before** their `switch`. A literal
> `null` / `undefined` gallery would therefore skip the branch and stay `null`, contradicting
> "non-array → `[]`". Handle `gallery` **before** the null guard — e.g.
> `if (type === "gallery") return sanitizeGalleryValue(value);` at the top of
> `sanitizeSettingValue` — so `sanitizeGalleryValue` (which already maps `null` → `[]`) always
> runs. Do the same in `sanitizeThemeSettingValue`, wrapping the result in its
> `{ value, corrected }` shape.

- **`src` needs a real upload-path check.** The earlier draft said "same check `image`
  uses" — but `image` is **not** sanitized today. In `sanitizeSettingValue` it falls to
  `default: return value` (no check at all); in `sanitizeThemeSettingValue` it only gets a
  `typeof === "string"` guard (line 206). Neither validates the path. Add a reusable
  helper:

  ```js
  /** Keep only safe in-project upload image paths; blank anything else. */
  export function sanitizeImagePath(value) {
    if (typeof value !== "string") return "";
    const v = value.trim();
    return v.startsWith("/uploads/images/") && !v.includes("..") ? v : "";
  }
  ```

  Gallery images are always library uploads — `ImageInput`'s `onChange` only ever emits a
  media-record path under `/uploads/images/` — so this prefix check is exactly right for
  `gallery.src`.

  **Plain `image` sanitization — implemented.** Plain `image` settings are sanitized via a
  broader helper `sanitizeImageSettingValue`, wired into `sanitizeSettingValue`
  (widget/collection-item) and the `image` case of `sanitizeThemeSettingValue` (theme). Both
  guards share a strict **allowlist** `isSafeImagePath`: a single leading `/`, only path-legal
  characters `[A-Za-z0-9._/-]`, no `//`, no `..`. An **allowlist** (not a scheme blocklist) is
  required because the value reaches an **HTML sink** — the `{% image %}` no-media fallback emits
  a **raw, unescaped** `<img src="...">` with the value's basename ([`imageTag.js`](src/core/tags/imageTag.js)),
  so a payload like `/uploads/images/x" onerror="alert(1).jpg` would otherwise break out of the
  `src` attribute (XSS). Upload filenames are `slugify(strict)` → `[a-z0-9-]` + ext, so nothing
  legitimate is blanked; non-upload theme assets like `/default-logo.png` survive.
  `sanitizeImagePath` stays **strict** (adds the `/uploads/images/` prefix requirement) for
  galleries. `image` is handled **before the null guard** in both sanitizers (like `gallery`), so
  the invariant holds everywhere: an `image` value is always a safe string. In the theme sanitizer
  a non-empty invalid value (incl. `null`) reverts to the (sanitized) `schema.default` rather than
  erasing it — `null` must not survive, or theme preprocessing would let it win over the default;
  an explicit `""` clear is preserved. In the widget/collection sanitizer (no per-setting default
  available) a non-string normalizes to `""`.

- **`caption` is plain text.** It renders via Liquid autoescape (`{{ img.caption }}`), so
  it is XSS-safe with no transform — the same way `text`/`textarea` are handled (autoescape,
  no DOMPurify pass; note those are **not** tag-stripped in `sanitizeSettingValue` either).
  The `stripHtmlTags` call above is an optional storage-cleanliness extra, **not** a
  security requirement and not "parity with text/textarea."

- **Non-array / malformed → `[]`.** Sanitize-after-resolve still holds (galleries carry no
  links, so `resolveCollectionItemLinks` passes them through; the render gate
  `prepareCollectionItemForRender` then sanitizes).

### 5.3 Media-usage tracking

The earlier draft said the page/global/theme/collection walkers "currently handle string
paths and recurse into single objects … extend them to walk arrays." That is
**inaccurate** and overstates the work:

- **Page widgets, global widgets, and collection items already recurse arrays.** They
  funnel every settings value through `collectMediaPaths`
  ([`mediaUsageService.js`](server/services/mediaUsageService.js) line 27), which already
  handles strings, plain objects, **and arrays**. A `gallery` array's `src` paths are
  picked up here with **no change**.
- **Theme settings is the one real gap.** `extractMediaPathsFromThemeSettings` (line 131)
  does **not** use `collectMediaPaths`; it inspects only scalar `item.value` / `item.default`
  via `addIfMediaPath`, so a `gallery` theme setting's images would never be tracked. Fix:
  route the setting's value through `collectMediaPaths` (or otherwise walk the array) so
  theme gallery images get "Used in" and correct counts. Apply the same to the **`default`
  fallback**: today it tracks a default only when `typeof item.default === "string"` (line
  145), so an author-shipped gallery `default` *array* would be skipped even though scalar
  image defaults are tracked — route the `item.default` fallback through `collectMediaPaths`
  too, for parity. (Note this is media *tracking* only; defaults are still not *sanitized* —
  see §5.2.)

Usage then stays correct on add/remove/delete through the existing
`refreshMediaUsageAfterStructuralChange` / per-write sync paths collections already use.

## 6. Rendering (Liquid)

No new tag needed — the array is plain iterable data. A theme template loops it:

```liquid
{% for img in item.settings.gallery %}
  {% if img.src != blank %}
    <figure>
      {% image src: img.src, size: 'large' %}
      {% if img.caption != blank %}<figcaption>{{ img.caption }}</figcaption>{% endif %}
    </figure>
  {% endif %}
{% endfor %}
```

The `{% if img.src != blank %}` guard is defensive: the sanitizer already filters blank-`src`
rows (§5.2), but theme templates should never assume that and risk emitting an empty
`<figure>` if a row slips through.

`{% image %}` resolves `img.src` (depth-aware path + media metadata for alt) exactly as
it does for a single `image`. `{{ img.caption }}` is autoescaped. The array passes
through `prepareCollectionItemForRender` and the `| collection` filter unchanged (it is
neither a link nor a menu value).

## 7. Data-model implications

- **Normalization** (`normalizeCollectionItem`): a missing `gallery` fills to `[]`;
  unknown legacy keys still archive to `_archived`. The merge-back-on-write rule
  (BLOCKER-2) already preserves out-of-schema keys, so swapping a schema to `gallery`
  never silently drops the old fixed-field data — it surfaces as "Leftover content".
- **Link/menu resolution**: untouched — `gallery` entries have no `href`/menu UUID.
- This is the first repeater-shaped value; keep the array handling **localized** to a
  small set of extension points so the rest of the flat-settings assumptions stay valid:
  the shared sanitizer (`sanitizeGalleryValue`, wired into both `sanitizeSettingValue` and
  `sanitizeThemeSettingValue`), the theme-settings media-usage walker
  (`extractMediaPathsFromThemeSettings` — the other walkers already recurse arrays), the
  collection `emptyDefaultForType` / `isMissingValue` helpers, and `GalleryInput`.

## 8. Aegean migration (ships with the feature)

1. **Schema**: replace `gallery_1`…`gallery_4` (and the `gallery_header`) with a single
   `{ "type": "gallery", "id": "gallery", "label": "Gallery" }`.
2. **Template**: `accommodation/template.liquid` — replace the four hard-coded
   `gallery_1..4` references with the `{% for img in ... %}` loop above.
3. **Sample/preset data**: rewrite each room item's `gallery_1..4` keys into a single
   `gallery: [{ src, caption }, …]` array (otherwise the old keys land in "Leftover
   content"). These are theme sample items, so it's a content edit, not a runtime
   migration.

> **As shipped:** the `excursion` collection type used the identical `gallery_1..4`
> fake-gallery pattern, so it was migrated alongside `accommodation` (schema, template,
> and its three preset items) to avoid leaving the theme half-converted. The
> `gallery_header` section divider was **kept** — every other field group in these
> schemas has one — so each schema now reads `gallery_header` + a single
> `{ "type": "gallery", "id": "gallery", "label": "Images" }` field, rather than dropping
> the header as step 1 originally suggested. Captions ship empty (a faithful
> restructure of the old caption-less slots; authors can fill them in).

## 9. Tests

- **Schema validation** (`validateCollectionSchema`) accepts a field with
  `type: "gallery"` once it's in `SUPPORTED_SETTING_TYPES`; it does **no** `src` validation.
  (Keep this test about schema acceptance only — bogus `src` is a sanitizer concern, not
  schema validation. Conflating the two was the wording bug in the earlier draft.)
- **Sanitization** — drive these through the **exported** entry points, not the private
  switch helpers: `sanitizeWidgetData` (widgets), `sanitizeCollectionItemData` (collection
  items), and `sanitizeThemeSettings` (theme — pass a `theme.json`-shaped object with a
  gallery item under `settings.global.<group>` carrying a `value`). `sanitizeSettingValue` /
  `sanitizeThemeSettingValue` are not exported and can't be imported. Assert: an array of
  mixed entries → cleaned `{ src, caption }[]` with non-upload / bogus `src`
  (`"javascript:…"`, `"../../etc/passwd"`, an external URL) **rows dropped**; a non-array
  value → `[]`; a `null` / `undefined` value → `[]` (exercises the pre-`switch` guard fix);
  caption HTML stripped.
- **Defaults & required** — exercise through the **exported** `normalizeCollectionItem`
  (read) and `buildCollectionItemData` (write), not the private `emptyDefaultForType` /
  `isMissingValue`: a missing `gallery` fills to `[]`; a `required` gallery flags invalid
  when it is `[]` **and** when it holds only blank- or invalid-`src` rows (e.g.
  `[{ "src": "javascript:alert(1)" }]`, `[{ "src": "../../etc/passwd" }]`), but is valid
  with at least one upload-path `src`.
- **Media usage** — a 3-image gallery marks 3 files "used in" and removing one updates the
  count, exercised both for a gallery in a **collection item / widget** *and* in a **theme
  setting** (the theme-settings extractor is the path that newly has to walk the array).
- **Render** — collection render / `| collection` filter: a gallery round-trips and the
  `{% for %}` loop emits `src` + caption.
- Frontend has no component-test tooling; `GalleryInput` is lint + manual.

## 10. Out of scope (later)

- Non-image repeaters (a generic repeater / blocks-in-collections) — still deferred; the next
  item to plan.

(Per-entry `alt` override and a `max`/`min` count constraint were considered and **dropped**:
alt/title/caption stay centralized on the media record, and a count cap isn't wanted.)

## See Also
- [Setting Types Reference](theming-setting-types.md) — where `gallery` gets documented on ship.
- [Collections](core-collections.md) — §11 Out of Scope (remove the gallery line on ship).
- [Media Library](core-media.md) — usage tracking the gallery extends.
