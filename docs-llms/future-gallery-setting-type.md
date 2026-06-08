# Future: `gallery` setting type (repeating image + caption)

> **Status: 📋 Planned (not implemented).** Design/approach doc for a repeating-image
> setting type. Supersedes the "repeater / gallery setting type" line in
> `core-collections.md` → §11 Out of Scope and the `theming-setting-types.md` note
> that a multi-image type does not exist yet.

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

A `gallery` value is an **ordered array of entry objects**:

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
- `caption` — per-**usage** plain text authored on the item/widget. Empty string when
  unset. This is the new per-entry field captions need (a media record can't hold a
  context-specific caption).
- Empty value is `[]`. Order is authored (drag-to-reorder), preserved on save.

This is the first **array-of-objects** value in collection item settings (v1 settings
were flat scalars / single objects). See §7 for the data-model implications.

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

## 5. Backend

**Validation** ([`collectionService.js`](server/services/collectionService.js)
`validateCollectionSchema`): `gallery` is accepted once it's in
`SUPPORTED_SETTING_TYPES`. No schema-level field config is required; optionally
support `max` (cap entries) later. The empty-value/placeholder helper returns `[]`.

**Sanitization** ([`sanitizationService.js`](server/services/sanitizationService.js)
`sanitizeCollectionItemData` / `sanitizeWidgetData`): add a `gallery` rule that maps
the array, coercing each entry to `{ src, caption }`:
- `src` — keep only valid upload paths (same check `image` uses); drop/blank anything
  else (defense against injected non-upload strings).
- `caption` — treat as plain text. It renders through Liquid autoescape (`{{ img.caption }}`),
  so HTML can't execute; additionally `stripHtmlTags` it for cleanliness, matching `text`/`textarea`.
- Non-array / malformed values normalize to `[]`. Sanitize-after-resolve still holds
  (galleries carry no links, so `resolveCollectionItemLinks` passes them through; the
  render gate `prepareCollectionItemForRender` then sanitizes).

**Media usage** ([`mediaUsageService.js`](server/services/mediaUsageService.js)): the
`extractFromSettings` walkers (page widgets, global widgets, theme settings, and the
collection-item extractor) currently handle string paths and recurse into single
objects (link settings). Extend them to **walk arrays**: for a `gallery` value, pull
the `/uploads/images/...` path from each entry's `src`. This makes every gallery image
show "Used in" and keeps usage counts correct on add/remove/delete — covered by the
same `refreshMediaUsageAfterStructuralChange` / per-write sync paths collections
already use.

## 6. Rendering (Liquid)

No new tag needed — the array is plain iterable data. A theme template loops it:

```liquid
{% for img in item.settings.gallery %}
  <figure>
    {% image src: img.src, size: 'large' %}
    {% if img.caption != blank %}<figcaption>{{ img.caption }}</figcaption>{% endif %}
  </figure>
{% endfor %}
```

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
- This is the first repeater-shaped value; keep the array handling **localized** to the
  three extension points (sanitizer, media-usage walker, the input) so the rest of the
  flat-settings assumptions stay valid.

## 8. Aegean migration (ships with the feature)

1. **Schema**: replace `gallery_1`…`gallery_4` (and the `gallery_header`) with a single
   `{ "type": "gallery", "id": "gallery", "label": "Gallery" }`.
2. **Template**: `accommodation/template.liquid` — replace the four hard-coded
   `gallery_1..4` references with the `{% for img in ... %}` loop above.
3. **Sample/preset data**: rewrite each room item's `gallery_1..4` keys into a single
   `gallery: [{ src, caption }, …]` array (otherwise the old keys land in "Leftover
   content"). These are theme sample items, so it's a content edit, not a runtime
   migration.

## 9. Tests

- Validator accepts a `gallery` field; rejects a bogus `src`.
- `sanitizeCollectionItemData`/`sanitizeWidgetData`: array of mixed-valid entries →
  cleaned `{ src, caption }[]`; non-array → `[]`; caption HTML stripped.
- Media usage: a 3-image gallery marks 3 files "used in"; removing one updates the count.
- Collection render / `| collection` filter: a gallery round-trips and the loop emits
  `src` + caption.
- Frontend has no component-test tooling; `GalleryInput` is lint + manual.

## 10. Out of scope (later)

- Per-entry **alt override** (alt stays on the media record for now).
- Non-image repeaters (a generic repeater/blocks-in-collections) — still deferred.
- A `max`/`min` count constraint (add as an optional schema field if needed).

## See Also
- [Setting Types Reference](theming-setting-types.md) — where `gallery` gets documented on ship.
- [Collections](core-collections.md) — §11 Out of Scope (remove the gallery line on ship).
- [Media Library](core-media.md) — usage tracking the gallery extends.
