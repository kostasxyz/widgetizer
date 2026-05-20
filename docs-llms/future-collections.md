# Collections System (Custom Post Types)

> **Status**: Future Feature
> **Priority**: TBD
> **Complexity**: High

A comprehensive plan for implementing a Collections system in Widgetizer that allows users to create structured content types like Portfolios, Team Members, Testimonials, Blog Posts, etc.

## Overview

The Collections system enables:

- **Theme authors** to define collection types with custom fields (using existing setting types)
- **Users** to add/edit/delete collection items through a familiar CMS interface
- **Widgets** to display collection data dynamically via Liquid
- **Export** to generate static HTML pages for individual collection items (optional per type)

---

## Implementation Phases

### Phase 1: Core Collection Definition, Storage, CMS UI, and Liquid Access

- Collection schema definition in themes
- Per-project data storage with manual ordering
- Server-side API implementation
- Frontend navigation and listing/add/edit UI
- **Liquid filter** (`| collection`) so widgets can render lists immediately
- Media usage tracking for collection media assets
- No individual item pages yet

### Phase 2: Individual Item Pages with Templates

- Collection templates in themes (`template.liquid`)
- Export generates individual HTML files for each item (opt-in per collection type via `hasItemPages: true`)
- SEO support for collection items
- Slug collision rules with pages and other collections

### Phase 3: Relationships and Advanced Features

- Cross-collection references (e.g., Portfolio item → Category)
- Taxonomies (categories, tags)
- Advanced Liquid filtering and pagination
- Bulk import/export of collection data

> **Why Liquid in Phase 1**: The most common use cases (testimonials carousel, team grid, logo wall) don't need individual pages — they just need widgets to read collection data. Shipping Phase 1 with Liquid access unlocks immediate value; templates can come later for content types that warrant them.

---

## Architecture

### 1. Collection Definition Schema

Collections are defined in the **theme** (not project), similar to how widgets define their settings. This allows themes to ship with pre-defined collection types.

**Authoring source**: `themes/{theme}/collection-types/{collection-name}/schema.json`

**Project runtime copy**: `data/projects/{projectFolderName}/collection-types/{collection-name}/schema.json`

This mirrors the existing `templates/` → `pages/` split: theme-owned definitions live under `collection-types/` and are copied into the project root with the rest of the theme package. Runtime APIs, rendering, and export should read the project's copied `collection-types/`, not `data/themes/{theme}/`, so each project stays pinned to its applied theme version. User-owned item data lives separately under `data/projects/{projectFolderName}/collections/` and is protected content.

```
themes/arch/
├── collection-types/
│   ├── portfolio/
│   │   ├── schema.json
│   │   └── template.liquid    (Phase 2, optional)
│   ├── team/
│   │   └── schema.json
│   └── testimonials/
│       └── schema.json
├── widgets/
├── templates/
└── theme.json
```

**Example Schema** (`collection-types/portfolio/schema.json`):

```json
{
  "type": "portfolio",
  "schemaVersion": 1,
  "displayName": "tTheme:collections.portfolio.display_name",
  "displayNamePlural": "tTheme:collections.portfolio.display_name_plural",
  "icon": "Briefcase",
  "description": "tTheme:collections.portfolio.description",
  "slugPrefix": "portfolio",
  "hasItemPages": true,
  "sortable": true,
  "defaultSort": "manual",
  "settings": [
    {
      "type": "header",
      "id": "content_header",
      "label": "tTheme:collections.portfolio.settings.content_header.label"
    },
    {
      "type": "text",
      "id": "title",
      "label": "tTheme:collections.portfolio.settings.title.label",
      "required": true,
      "usedAsTitle": true
    },
    {
      "type": "textarea",
      "id": "description",
      "label": "tTheme:collections.portfolio.settings.description.label"
    },
    {
      "type": "image",
      "id": "featured_image",
      "label": "tTheme:collections.portfolio.settings.featured_image.label"
    },
    {
      "type": "text",
      "id": "client",
      "label": "tTheme:collections.portfolio.settings.client.label"
    },
    {
      "type": "text",
      "id": "year",
      "label": "tTheme:collections.portfolio.settings.year.label"
    },
    {
      "type": "link",
      "id": "external_url",
      "label": "tTheme:collections.portfolio.settings.external_url.label",
      "hide_text": true
    },
    {
      "type": "header",
      "id": "seo_header",
      "label": "tTheme:collections.portfolio.settings.seo_header.label"
    },
    {
      "type": "text",
      "id": "seo_title",
      "label": "tTheme:collections.portfolio.settings.seo_title.label"
    },
    {
      "type": "textarea",
      "id": "seo_description",
      "label": "tTheme:collections.portfolio.settings.seo_description.label"
    }
  ]
}
```

> **Note**: A `gallery` field is intentionally omitted from this v1 example. The existing `image` setting type doesn't support multiple values, and no repeater/group field type exists yet. Multi-image fields are deferred — Phase 3 will introduce either a `gallery` setting type or a generic repeater so collections can have gallery-shaped data.

#### Schema Field Reference

| Field               | Type    | Purpose                                                                 |
| ------------------- | ------- | ----------------------------------------------------------------------- |
| `type`              | string  | Unique collection identifier (lowercase, no spaces)                     |
| `schemaVersion`     | number  | Bumped by theme author when schema changes; drives data migrations      |
| `displayName`       | string  | Singular label shown in UI                                              |
| `displayNamePlural` | string  | Plural label shown in sidebar/listing                                   |
| `description`       | string  | Optional help text for the collection type                              |
| `icon`              | string  | Lucide icon name for sidebar nav                                        |
| `slugPrefix`        | string  | URL prefix when `hasItemPages` is true (e.g., `portfolio/foo.html`)     |
| `hasItemPages`      | boolean | If true, export generates individual HTML pages (Phase 2)               |
| `sortable`          | boolean | If true, users can manually reorder items via drag handle               |
| `defaultSort`       | string  | `manual` \| `created_desc` \| `created_asc` \| `title_asc` \| `title_desc` |
| `settings`          | array   | Field definitions reusing existing setting types                        |

#### Setting Field Extensions

Existing setting types are reused, with two new optional flags:

- `usedAsTitle: true` — marks the field whose value should be used as the item's display name in listings and as the source for auto-generated slugs. Exactly one field per collection should have this.
- `required: true` — already supported in some setting types; collections enforce it on save.

#### Schema Validation Rules

When schemas are loaded from the project copy, `collectionService` should validate and normalize them before returning anything to the UI or Liquid:

- `type` and folder name must match and use `^[a-z0-9-]+$`.
- `slugPrefix` must use `^[a-z0-9-]+$` when `hasItemPages: true`; if omitted, default to `type`.
- Exactly one non-`header` setting must declare `usedAsTitle: true`.
- `defaultSort` must be one of `manual`, `created_desc`, `created_asc`, `title_asc`, or `title_desc`; default to `manual`.
- `settings` may only use setting types supported by `SettingsRenderer.jsx` in v1. Prefer a shared/exported setting-type list so backend schema validation and the renderer stay in sync; today's supported types are `header`, `text`, `number`, `textarea`, `richtext`, `code`, `color`, `range`, `select`, `checkbox`, `radio`, `font_picker`, `menu`, `image`, `file`, `link`, `youtube`, and `icon`.
- `multiple`, `blocks`, `repeater`, relationship fields, and taxonomy fields are invalid in v1, not silently ignored.
- Invalid schemas are skipped from the sidebar/API response and logged with their collection folder path so theme authors can fix them.

---

### 2. Collection Data Storage

Collection items are stored **per-project** (like pages and menus).

**Location**: `data/projects/{projectFolderName}/collections/{collection-type}/{item-slug}.json`

This folder contains only user-created collection item data, not theme schema/template files.

```
data/projects/my-site/
├── collection-types/                         (copied theme definitions)
│   ├── portfolio/
│   │   ├── schema.json
│   │   └── template.liquid                   (Phase 2, optional)
│   └── team/
│       └── schema.json
├── pages/
├── menus/
├── collections/
│   ├── portfolio/
│   │   ├── _order.json                  (manual ordering, optional)
│   │   ├── project-alpha.json
│   │   ├── website-redesign.json
│   │   └── mobile-app.json
│   └── team/
│       ├── john-doe.json
│       └── jane-smith.json
└── theme.json
```

**Example Item Data** (`collections/portfolio/project-alpha.json`):

```json
{
  "id": "project-alpha",
  "slug": "project-alpha",
  "schemaVersion": 1,
  "created": "2026-01-22T10:00:00Z",
  "updated": "2026-01-22T14:30:00Z",
  "settings": {
    "title": "Project Alpha",
    "description": "A revolutionary app design...",
    "featured_image": "/uploads/images/alpha-hero.jpg",
    "client": "Acme Corp",
    "year": "2025",
    "external_url": {
      "href": "https://example.com/alpha",
      "target": "_blank"
    },
    "seo_title": "Project Alpha | My Portfolio",
    "seo_description": "Case study of Project Alpha..."
  }
}
```

**Manual Order File** (`_order.json`):

```json
{
  "order": ["project-alpha", "website-redesign", "mobile-app"]
}
```

Items not in `_order.json` fall back to `defaultSort`. The underscore prefix prevents the file from being mistaken for an item slug.

`id` is the current item slug and changes when the item is renamed. Phase 1 does not add a stable item UUID because no v1 feature references collection items independently from their slug. If Phase 3 relationships need stable identity, add `uuid` then and backfill existing item files as part of that feature.

---

### 3. Slug Rules and Collision Handling

To avoid collisions when `hasItemPages: true`:

1. **Slug prefix isolation**: item pages live under `{slugPrefix}/`, so `portfolio/about.html` is fine even when `about.html` exists at the root.
2. **Cross-collection prefix uniqueness**: two collections cannot share the same `slugPrefix`. Enforced at theme load time.
3. **Reserved prefixes**: `slugPrefix` cannot use export-owned directories like `assets`.
4. **Slug generation**: item slugs are auto-generated from the `usedAsTitle` field; user can override. Validated as `^[a-z0-9-]+$`.
5. **Slug edits**: renaming an item slug renames the JSON file, rewrites the `_order.json` entry, and removes the old `collection:{type}/{oldSlug}` media-usage source. Liquid list queries pick up the new slug on the next render; hard-coded slug links in templates or content are not rewritten in v1.

Page slugs and item slugs are **not** in the same namespace — items always export beneath `{slugPrefix}/`, so a page slugged `about` and a portfolio item slugged `about` coexist as `about.html` and `portfolio/about.html`. Collision checks operate on full output paths, not raw item slugs. A page slug can match a collection `slugPrefix` in v1 (`portfolio.html` plus `portfolio/project-alpha.html`) because the static export writes `.html` files; the implementation must still reserve real output directories such as `assets/` and ensure collection prefixes are unique across collection types.

---

### 4. Schema Versioning and Migration

When a theme bumps `schemaVersion`, existing item data may have stale fields or missing required ones.

**Strategy**:

- On read, if `item.schemaVersion < schema.schemaVersion`, `collectionService` returns an in-memory normalized item:
  - Drop fields no longer in schema
  - Fill missing required fields with empty defaults
  - Update `item.schemaVersion` to current
- Migration is non-destructive: dropped field values are preserved in `_archived` on the item for one version cycle, then purged.
- GET routes should not perform hidden filesystem writes. The normalized data is persisted on the next successful save, duplicate, or explicit future migration action.
- Theme authors can ship optional `migrations.json` per collection for custom transforms (Phase 3).

This avoids the "schema and data drifted" trap that bites WordPress installs.

---

### 5. Theme Updates and Collection Lifecycle

Collections follow the same philosophy as the rest of the [theme update system](theme-updates.md): **user content is never touched; theme-controlled things get replaced; settings merge with user-wins.**

#### Theme Update Allowlist

Add `"collection-types"` to the `UPDATABLE_PATHS` array in `server/services/themeUpdateService.js` (currently `["layout.liquid", "assets", "widgets", "snippets", "locales", "screenshot.png"]`). Treat it like `widgets/` — entire folder replaced on update.

`collections/` (under `data/projects/{projectFolderName}/`) is **protected user content**, in the same category as `pages/` and `uploads/`. It must never appear in the allowlist.

New project creation already copies the whole theme source into the project and excludes only `templates`, `updates`, `latest`, and `presets`, so `collection-types/` is copied automatically once it exists in a theme. Project ZIP export/import and project duplication copy the whole project directory, so they carry both `collection-types/` and `collections/`; the required follow-up is media usage refresh support for collection item JSON.

#### Collection Removal

If a theme update drops a collection (or the project later sits on a theme that no longer defines it), the user's item JSON files in `data/projects/{projectFolderName}/collections/{type}/` stay on disk untouched — they're user content, in the same category as `pages/` and `uploads/`. The collection simply disappears from the sidebar because there's no schema to render its UI. If a future theme version restores the collection (same `type`), the data lights back up automatically.

No special UI is needed for orphaned data; it's a consequence of the existing "never destroy user data" rule.

#### `slugPrefix` Changes

`slugPrefix` is theme-controlled — changing it in a theme update is allowed (analogous to a theme author renaming an asset path or changing widget HTML). On next export, item URLs move to the new prefix. No redirect machinery is provided; the change should be noted in the theme's changelog.

#### `hasItemPages` Flip

Flipping `false → true` is harmless (new pages appear on next export). Flipping `true → false` is a breaking change: previously exported `/{slugPrefix}/{slug}.html` files stop being generated, breaking any external links or search-engine results. Theme authors should treat this as a major version change and document it.

A future "Apply Update" preview screen could warn users when a pending update flips this flag, but it's not required for v1.

#### Required-Field Validation (Important)

When a theme update adds a new `required: true` field to an existing collection, items created before the update have no value for it. The system must surface this clearly rather than silently exporting half-broken data.

**On normalization** (schemaVersion bump):

- The new required field is added to existing items with an empty default (`""`, `null`, or `[]` depending on field type).
- The in-memory item's `schemaVersion` is bumped; the file is rewritten only on the next successful save or duplicate.
- The item is flagged as `invalid: true` in memory (not persisted to JSON — recomputed on load).

**In the editor**:

- The collection listing shows a warning badge ("Needs attention") on items with missing required values, with a count in the page header (e.g., "3 items need attention").
- Filter/sort by "Needs attention" available at the top of the table.
- Editing an invalid item shows inline validation errors on the missing fields.
- Save is blocked until required fields have values — the user can't leave an item in an invalid state once they've opened it.

**On export**:

- Export refuses to publish invalid items by default.
- The export result includes a clear error listing each invalid item and which fields are missing.
- No "publish anyway" override — forcing the user to fix the data is the safer default and matches Widgetizer's existing strictness around export.

This validation applies symmetrically: even items created via API or imported from JSON go through the same check.

---

### 6. Media Usage Tracking

Collection items can reference media through `image`, `file`, `link`, richtext, and nested setting values. Without tracking, export's media copying and unused-media cleanup will ignore those assets.

**Phase 1 requirement**: when an item is created/updated/deleted, the server recursively walks its settings for upload paths and updates `media_usage` in SQLite using the existing `mediaUsageService`. This mirrors what already happens for page widgets and global widgets.

Usage follows the existing `usedIn` source-string model: page usage is stored as the bare page slug (`home`, `about`), global widgets use `global:header`/`global:footer`, theme settings use `global:theme-settings`, and collection items should use `collection:{collectionType}/{itemSlug}` (for example, `collection:portfolio/project-alpha`). No new `{ contextType, contextId }` shape — the media repository contract stays as-is.

Concrete `mediaUsageService.js` changes:

- Add `extractMediaPathsFromCollectionItem(itemData)` that recurses through `itemData.settings` using the same upload-path rules as pages/globals (`/uploads/images/` and `/uploads/files/`, including nested link objects).
- Add `updateCollectionItemMediaUsage(projectId, collectionType, itemSlug, itemData)`.
- Add `removeCollectionItemFromMediaUsage(projectId, collectionType, itemSlug)`.
- Add `syncCollectionItemMediaUsageOnWrite(projectId, collectionType, itemSlug, itemData, previousItemSlug = null)` so slug renames remove the old source before writing the new one.
- Extend `refreshAllMediaUsage(projectId)` and `refreshMediaUsageAfterStructuralChange()` to scan `data/projects/{folderName}/collections/*/*.json` in addition to pages, globals, and theme settings. This is required for project import, project duplication, project creation from theme templates, and theme updates.

---

### 7. Server-Side Implementation

#### New Config Paths

**File**: `server/config.js`

These helpers accept the project **folder name** for filesystem paths, not the project UUID — matching the pattern used by `getProjectDir`, `getProjectPagesDir`, etc. Collection API handlers should use `req.activeProject.folderName` from `resolveActiveProject`. If a future utility is called outside an active-project route, resolve the UUID first with `await getProjectFolderName(projectId)`.

```javascript
// Collection paths (NEW)
export const getProjectCollectionsDir = (projectFolderName) =>
  path.join(getProjectDir(projectFolderName), "collections");
export const getProjectCollectionDir = (projectFolderName, collectionType) =>
  path.join(getProjectCollectionsDir(projectFolderName), collectionType);
export const getProjectCollectionItemPath = (projectFolderName, collectionType, itemSlug) =>
  path.join(getProjectCollectionDir(projectFolderName, collectionType), `${itemSlug}.json`);
export const getProjectCollectionOrderPath = (projectFolderName, collectionType) =>
  path.join(getProjectCollectionDir(projectFolderName, collectionType), "_order.json");

// Copied theme collection type/schema paths (runtime source)
export const getProjectCollectionTypesDir = (projectFolderName) =>
  path.join(getProjectDir(projectFolderName), "collection-types");
export const getProjectCollectionSchemaPath = (projectFolderName, collectionType) =>
  path.join(getProjectCollectionTypesDir(projectFolderName), collectionType, "schema.json");
export const getProjectCollectionTemplatePath = (projectFolderName, collectionType) =>
  path.join(getProjectCollectionTypesDir(projectFolderName), collectionType, "template.liquid");
```

Do not name runtime helpers `getThemeCollection...` unless they truly read installed theme sources. Theme upload/update code can inspect `path.join(themeSourceDir, "collection-types")`, but the editor and export path should use the project copy.

---

#### Shared Service and Controller

Keep most filesystem/schema logic in a service so Liquid, export, and HTTP handlers share one implementation.

#### New Service: `collectionService.js`

| Function | Description |
| --- | --- |
| `listCollectionSchemas(projectFolderName)` | Read `data/projects/{folderName}/collection-types/*/schema.json`, validate schemas, enforce unique `type`/`slugPrefix`, and return UI-safe schema objects. |
| `getCollectionSchema(projectFolderName, collectionType)` | Return one validated schema or throw a 404-style error. |
| `listCollectionItems(projectFolderName, collectionType, options)` | Read item JSON files, apply schema defaults/normalization in memory, compute `title`, `invalid`, and `validationErrors`, then sort. |
| `readCollectionItem(projectFolderName, collectionType, itemSlug)` | Read and normalize one item. |
| `buildCollectionItemData(schema, input, existingItem)` | Apply defaults, preserve `created`, generate or sanitize slug, sanitize settings, validate required fields, and return `{ item, previousSlug }`. |
| `writeCollectionItem(projectId, projectFolderName, collectionType, item, previousSlug)` | Atomically write JSON, rename/delete old slug file when needed, update `_order.json`, and sync media usage. |
| `deleteCollectionItem(projectId, projectFolderName, collectionType, itemSlug)` | Delete JSON, remove `_order.json` entry, and remove media usage source. |
| `duplicateCollectionItem(...)` | Copy settings, copy-suffix title, generate a unique slug, reset timestamps, and media usage. |
| `loadCollectionTemplate(projectFolderName, collectionType)` | Phase 2: read `template.liquid` from the project `collection-types/` copy. |

Use `sanitizeSlug()`/`generateUniqueSlug()` from `server/utils/slugHelpers.js`; do not duplicate slug rules in the controller.

#### New Controller: `collectionController.js`

| Function                         | Description                                                |
| -------------------------------- | ---------------------------------------------------------- |
| `getCollectionSchemas(req, res)` | Get all collection schemas from the active project's copied `collection-types/`, including `itemCount` and `invalidCount` for sidebar/list badges |
| `getCollectionSchema(req, res)`  | Get single schema by type                                  |
| `getAllItems(req, res)`          | Get all items for a collection type (sorted)               |
| `getItem(req, res)`              | Get single collection item by slug                         |
| `createItem(req, res)`           | Create new collection item; updates media usage            |
| `updateItem(req, res)`           | Update collection item; diffs media usage                  |
| `deleteItem(req, res)`           | Delete collection item; removes media usage                |
| `bulkDeleteItems(req, res)`      | Bulk delete collection items                               |
| `duplicateItem(req, res)`        | Duplicate a collection item with new slug                  |
| `reorderItems(req, res)`         | Persist manual order to `_order.json`                      |

---

#### New Routes: `server/routes/collections.js`

```javascript
import express from "express";
import { body, param } from "express-validator";
import * as collectionController from "../controllers/collectionController.js";
import { resolveActiveProject } from "../middleware/resolveActiveProject.js";
import { standardJsonParser } from "../middleware/jsonParser.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = express.Router();
router.use(standardJsonParser);
router.use(resolveActiveProject);

const slugParam = (name) =>
  param(name).matches(/^[a-z0-9-]+$/).withMessage(`${name} must contain lowercase letters, numbers, and hyphens only.`);

// Schema endpoints
router.get("/schemas", collectionController.getCollectionSchemas);
router.get("/schema/:collectionType", [slugParam("collectionType")], validateRequest, collectionController.getCollectionSchema);

// Item CRUD endpoints
router.get("/:collectionType", [slugParam("collectionType")], validateRequest, collectionController.getAllItems);
router.get("/:collectionType/:itemSlug", [slugParam("collectionType"), slugParam("itemSlug")], validateRequest, collectionController.getItem);
router.post(
  "/:collectionType",
  [slugParam("collectionType"), body("settings").isObject().withMessage("settings must be an object.")],
  validateRequest,
  collectionController.createItem,
);
router.put(
  "/:collectionType/:itemSlug",
  [slugParam("collectionType"), slugParam("itemSlug"), body("settings").isObject().withMessage("settings must be an object.")],
  validateRequest,
  collectionController.updateItem,
);
router.delete("/:collectionType/:itemSlug", [slugParam("collectionType"), slugParam("itemSlug")], validateRequest, collectionController.deleteItem);
router.post("/:collectionType/bulk-delete", [slugParam("collectionType"), body("itemSlugs").isArray({ min: 1 })], validateRequest, collectionController.bulkDeleteItems);
router.post("/:collectionType/:itemSlug/duplicate", [slugParam("collectionType"), slugParam("itemSlug")], validateRequest, collectionController.duplicateItem);
router.post("/:collectionType/reorder", [slugParam("collectionType"), body("order").isArray()], validateRequest, collectionController.reorderItems);

export default router;
```

Collections are site-workspace content like pages and menus, so the v1 routes intentionally do **not** include `:projectId`. `apiFetch` already injects `X-Project-Id`, `resolveActiveProject` attaches `req.activeProject`, and write requests are protected against project switches. If a future media-style route adds `:projectId`, remember that `resolveActiveProject` only rejects route/header mismatches for writes; GET handlers would also need an explicit route-param check.

Mount in `server/createApp.js` alongside pages/menus:

```javascript
import collectionsRoutes from "./routes/collections.js";

app.use("/api/collections", collectionsRoutes);
```

---

### 8. Frontend Implementation

#### Navigation Updates

The sidebar dynamically shows collection types available in the active project's copied `collection-types/` directory.

**File**: `src/components/layout/Sidebar.jsx`

Keep `src/config/navigation.js` as the static base navigation. In `Sidebar.jsx`, load collection schemas for the active project and insert collection links into the existing "Site" section after Pages (or after Menus if that feels better in the final UI). This matches the current sidebar architecture, where `navigationSections` is static and project-aware behavior lives in the component.

```jsx
const collectionsNav = collections.map((col) => ({
  id: `collection-${col.type}`,
  label: col.displayNamePlural,
  path: `/collections/${col.type}`,
  icon: lucideIcons[col.icon] || Database,
  requiresProject: true,
  badge: col.itemCount ?? 0,
}));
```

**Empty-state UX**: collections with zero items still appear in the sidebar with a `0` badge so users discover them and know where to add content. Hiding empty collections makes them feel hidden/broken.

#### Internationalization

`displayName`/`displayNamePlural` and field `label`/`description` values follow the same convention as widget schemas: prefer `tTheme:` locale keys (resolved against the theme's `locales/` files), with direct English strings still supported for small one-off themes. This keeps collection schemas aligned with [Widget Authoring Guide](theming-widgets.md) and avoids inventing a second i18n convention.

---

#### New Routes

**File**: `src/App.jsx`

```jsx
{
  path: "collections/:collectionType",
  element: <CollectionItems />,
},
{
  path: "collections/:collectionType/add",
  element: <CollectionItemAdd />,
},
{
  path: "collections/:collectionType/:itemSlug/edit",
  element: <CollectionItemEdit />,
},
```

---

#### New Pages

| Page                     | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `CollectionItems.jsx`    | Lists all items (table like Pages.jsx) with drag-to-reorder       |
| `CollectionItemAdd.jsx`  | Form to add new item (renders settings like widget settings)      |
| `CollectionItemEdit.jsx` | Form to edit existing item                                        |

Add `src/components/collections/CollectionItemForm.jsx` as the shared add/edit form. It should use `react-hook-form` like `PageForm.jsx`, call `useFormNavigationGuard` for unsaved changes, render schema fields with `SettingsRenderer`, and pass validation errors into the renderer's `error` prop.

Reused components/hooks: `SettingsRenderer`, `Table`, `ConfirmationModal` via `useConfirmationAction`, `PageLayout`, `SortableList`, `useFormNavigationGuard`, `useFormatDate`, `useToastStore`, and `useThemeLocale`.

---

#### New Hooks & Queries

| File                               | Purpose                           |
| ---------------------------------- | --------------------------------- |
| `src/queries/collectionManager.js` | API calls for collection CRUD     |
| `src/hooks/useCollections.js`      | React hook for collection schemas |
| `src/hooks/useCollectionItems.js`  | React hook for collection items   |

`collectionManager.js` should call the active-project endpoints above (`/api/collections/...`) and rely on `apiFetch` for the `X-Project-Id` header, matching `pageManager.js` and `menuManager.js`.

---

### 9. Liquid Integration (Phase 1)

Widgets access collection data via a Liquid filter. This is in Phase 1 because it unlocks the most common use case — rendering a list inside a widget — without requiring the heavier template system.

#### Collection Filter

```liquid
{% assign portfolio_items = 'portfolio' | collection %}
{% for item in portfolio_items %}
  <div class="portfolio-card">
    <h3>{{ item.settings.title }}</h3>
    {% image src: item.settings.featured_image, size: 'medium' %}
  </div>
{% endfor %}

{% comment %} With options {% endcomment %}
{% assign recent_work = 'portfolio' | collection: limit: 6, sort: 'created_desc' %}
```

**Supported options**:

- `limit: <n>` — cap the number of items returned
- `sort: 'manual' | 'created_desc' | 'created_asc' | 'title_asc' | 'title_desc'`
- `offset: <n>` — for pagination

Implementation target:

- Add `src/core/filters/collectionFilter.js` exporting `registerCollectionFilter(engine)`, following the existing `mediaMetaFilter.js` and `handleizeFilter.js` pattern.
- Import and call `registerCollectionFilter(engine)` inside `configureLiquidEngine()` in `server/services/renderingService.js`.
- The filter should read `projectId` and the shared render globals from `this.context.globals` / the Liquid context. It must not accept a project ID from template input.
- Use `collectionService.listCollectionItems(projectFolderName, collectionType, options)` so Liquid, API, and export sorting/default behavior stays identical.
- LiquidJS named filter arguments arrive as filter args, so normalize both named-style calls (`collection: limit: 6, sort: 'created_desc'`) and positional fallback if LiquidJS supplies argument tuples.

#### Scope and Sandbox

Currently widgets receive only their own settings via Liquid context. The `| collection` filter intentionally bypasses this sandbox — collection data is **global, read-only project data** and any widget can read any collection. This is by design: a "recent posts" widget defined in the theme shouldn't need configuration to know which collection to read.

Phase 1 has no draft or soft-delete state, so the filter returns saved items for the active project. If drafts/soft-delete ship later, the filter must exclude unpublished/deleted items by default and continue to prevent cross-project access.

#### Future: Liquid Tag (Phase 3)

```liquid
{% collection 'portfolio' limit: 6 as items %}
  {% for item in items %}
    ...
  {% endfor %}
{% endcollection %}
```

The tag form lets us add per-block scoping and pagination cleanly. Not needed for Phase 1.

---

### 10. Individual Item Pages (Phase 2)

Opt-in via `hasItemPages: true` in the schema. Collections like `testimonials` that only render inside widgets leave this false and skip the template entirely.

#### Collection Templates

**Authoring source**: `themes/{theme}/collection-types/{type}/template.liquid`

**Project runtime copy**: `data/projects/{projectFolderName}/collection-types/{type}/template.liquid`

```liquid
{%- comment -%}
  Template for individual portfolio item pages
  Available: {{ item.settings.* }}, {{ item.slug }}, {{ item.created }}
{%- endcomment -%}

<article class="portfolio-single">
  <h1>{{ item.settings.title }}</h1>
  {% image src: item.settings.featured_image, size: 'large' %}
  <div class="meta">
    <span>{{ item.settings.client }}</span>
    <span>{{ item.settings.year }}</span>
  </div>
  <div class="content">
    {{ item.settings.description }}
  </div>

  {% if item.settings.external_url.href %}
    <a href="{{ item.settings.external_url.href }}" target="{{ item.settings.external_url.target }}">
      View project
    </a>
  {% endif %}
</article>
```

The template renders **inside** the theme's main layout (header/footer/main slots), same as page templates do today.

#### Export Changes

Update `exportController.js` to:

1. Load validated collection schemas from the project copy via `collectionService.listCollectionSchemas(projectFolderName)`.
2. Loop through each collection type where `hasItemPages: true`.
3. Fail export if any item in those collections is `invalid: true`, listing collection type, slug, and missing fields.
4. For each valid item, render the collection `template.liquid` with a context containing `item`, `collection`, `page`, `project`, `theme`, `imagePath`, `filePath`, and the same shared globals used by page export.
5. Render that item template into the existing layout with `renderPageLayout()`, treating the item as a page-like object with `id: "{slugPrefix}-{slug}"`, `slug: "{slugPrefix}-{slug}"`, `name` from the `usedAsTitle` field, `seo.title` from `seo_title`, `seo.description` from `seo_description`, and `updated`. Do not change `renderPageLayout()` for collection paths; keep the body class safe at the call site. If the project has a valid `siteUrl`, set `seo.canonical_url` explicitly to `{siteUrl}/{slugPrefix}/{itemSlug}.html` so canonical URLs still match the real output path.
6. Format, validate, rewrite `/uploads/images/` and `/uploads/files/`, and prepend the Widgetizer export comment using the same page-export code path.
7. Output to `{slugPrefix}/{item-slug}.html`.
8. Include collection item URLs in `sitemap.xml` unless the schema later adds a noindex field. If collection SEO fields are blank, fall back to the item title and project title composition.
9. Validate full output path collisions before writing. Pages currently produce `index.html` or `{pageSlug}.html`; collection items produce `{slugPrefix}/{itemSlug}.html`.

---

### 11. Export Output Structure

```
output/
├── index.html
├── about.html
├── portfolio/
│   ├── project-alpha.html
│   ├── website-redesign.html
│   └── mobile-app.html
├── team/
│   ├── john-doe.html
│   └── jane-smith.html
└── assets/
```

Collections with `hasItemPages: false` contribute no HTML — their data is only reachable via Liquid inside widgets.

---

## File Changes Summary

### New Files

| Path                                            | Description                   |
| ----------------------------------------------- | ----------------------------- |
| `server/controllers/collectionController.js`    | Collection CRUD operations    |
| `server/routes/collections.js`                  | API routes for collections    |
| `server/services/collectionService.js`          | Schema load + migration logic |
| `src/core/filters/collectionFilter.js`          | Liquid `collection` filter    |
| `src/components/collections/CollectionItemForm.jsx` | Shared add/edit form      |
| `src/pages/CollectionItems.jsx`                 | Collection items listing page |
| `src/pages/CollectionItemAdd.jsx`               | Add new collection item       |
| `src/pages/CollectionItemEdit.jsx`              | Edit collection item          |
| `src/queries/collectionManager.js`              | API client functions          |
| `src/hooks/useCollections.js`                   | Hook for collection schemas   |
| `src/hooks/useCollectionItems.js`               | Hook for collection items     |
| `server/tests/collections.test.js`              | CRUD/schema/slug coverage     |
| `themes/arch/collection-types/portfolio/schema.json` | Example portfolio collection  |
| `themes/arch/collection-types/team/schema.json`      | Example team collection       |

### Modified Files

| Path                                     | Changes                                          |
| ---------------------------------------- | ------------------------------------------------ |
| `server/config.js`                       | Add collection path helpers                      |
| `server/createApp.js`                    | Register collections routes                      |
| `server/services/mediaUsageService.js`   | Support collection usage source strings          |
| `server/services/themeUpdateService.js`  | Add `collection-types` to `UPDATABLE_PATHS`      |
| `server/services/renderingService.js`    | Register `collection` Liquid filter (Phase 1)    |
| `server/controllers/exportController.js` | Export collection item pages (Phase 2)           |
| `src/App.jsx`                            | Add collection routes                            |
| `src/components/layout/Sidebar.jsx`      | Dynamic collection nav items                     |
| `src/locales/en/translation.json`        | Add collection translation keys                  |
| `server/tests/mediaUsage.test.js`        | Add collection media usage refresh/write cases   |
| `server/tests/export.test.js`            | Add collection item page export cases            |
| `server/tests/themeUpdateService.test.js` | Assert `collection-types` is updated/protected   |

---

## Open Questions

1. **Should collections ever be project-defined?**
   - Theme = consistent across projects using same theme (recommended; current plan)
   - Project = each project can define custom collections (more flexible, harder to support theme upgrades)

2. **Drafts and publish states?**
   - Current plan: items are always "published". A `draft: true` flag could come in Phase 3 if needed.

3. **Cross-collection relationships?**
   - Deferred to Phase 3. v1 collections are flat; if relationships are needed sooner, a `reference` setting type would be added.

4. **Pagination in Liquid?**
   - `limit` + `offset` ship in Phase 1; cursor-based pagination and `paginate` tag deferred.

5. **Item-level SEO vs. template-level SEO?**
   - Current plan: schema includes `seo_title`/`seo_description` fields, template reads them. Simple, consistent with pages.

---

## See Also

- [Theming Guide](theming.md) - Theme structure and settings
- [Widget Authoring Guide](theming-widgets.md) - Widget development patterns
- [Setting Types Reference](theming-setting-types.md) - Available setting types for collection schemas
- [Export Documentation](core-export.md) - Export process details
