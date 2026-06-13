# Test Checklist — Richtext Link UI (incl. Link-to-file)

Manual QA checklist for the link controls in the `richtext` setting type
([`RichTextInput.jsx`](../src/components/settings/inputs/RichTextInput.jsx)): the typed
**Link** button (with path-aware URL normalization) and the **Link-to-file** button that
inserts a link to an uploaded file asset (PDF).

## Why one checklist covers everything

Every `richtext` field — in a widget, a widget **block**, a global header/footer, **or** a
collection-type setting — is rendered by the same `RichTextInput` through
[`SettingsRenderer`](../src/components/settings/SettingsRenderer.jsx) (`case "richtext"`).
There is a single code path, so the link behavior is identical across contexts. The
**Link** and **Link-to-file** buttons are always present; only three buttons vary per
field, driven by the schema:

| Schema flag      | Controls               | Link / Link-to-file |
| ---------------- | ---------------------- | ------------------- |
| `allow_headings` | H2/H3/H4 buttons       | always on           |
| `allow_images`   | Insert-image button    | always on           |
| `allow_source`   | HTML source toggle     | always on           |

Export-side rewriting is consistent too: widget richtext runs through
`resolveRichtextMediaInWidgetData` and collection-item richtext through
`resolveRichtextMediaInSettings` ([`collectionService.js`](../server/services/collectionService.js)) —
both call the same `resolveRichtextMediaPaths`.

## Where to test

Run the **full checklist once** in a widget, then re-run the **Export / preview + usage**
section in a collection item to confirm the nested depth-prefix.

1. **`rich-text` widget on a normal page** — covers widget richtext + **root-level export**
   (`assets/files/brochure.pdf`).
2. **A News article's `body`** (Collections → News → add/edit) — covers collection-item
   richtext **and the nested/depth-prefixed export** (`../assets/files/…`), the case most
   likely to expose a path bug.

Optional extra coverage: a block-level richtext (e.g. an `accordion` or `card-grid` block)
for the block-settings path, and the footer (global widget) for the global-widget path.

---

## 1. URL normalization (typed Link button → "Enter URL…")

- [ ] **Bare domain** `example.com` → saved as `https://example.com`
- [ ] **Full https** `https://example.com/x` → unchanged (no double prefix)
- [ ] **http** `http://example.com` → unchanged (not force-upgraded to https)
- [ ] **Internal page** `/about.html` → unchanged
- [ ] **Pasted file path** `/uploads/files/brochure.pdf` → unchanged (the headline fix)
- [ ] **Anchor** `#section` → unchanged
- [ ] **Protocol-relative** `//cdn.example.com/a.js` → unchanged
- [ ] **mailto** `mailto:hi@example.com` → unchanged
- [ ] **tel** `tel:+15551234567` → unchanged
- [ ] **Leading/trailing spaces** `  example.com  ` → trimmed then `https://example.com`
- [ ] **Empty / whitespace-only** input + Apply → removes the link (no `href=""`)
- [ ] **Enter** applies; **Esc** cancels without changing the link

## 2. "Link to file" button

- [ ] Paperclip button is visible in the toolbar with tooltip "Link to file"
- [ ] It appears even in a richtext field where image insertion is **off** (`allow_images: false`)
- [ ] Clicking opens the media drawer showing **Files only** (no images listed)
- [ ] You can **upload a new PDF** from inside the drawer and pick it
- [ ] **With text selected** → that text becomes the link
- [ ] **With no selection** → the file's name is inserted as the linked text
- [ ] Drawer **closes** after selecting
- [ ] In **Source (HTML) mode**, the href reads `/uploads/files/<name>.pdf` (portable path, not an API URL)
- [ ] Works in **Expanded/fullscreen** editor mode (picker sits above the overlay)
- [ ] **Cancel/close** the picker without selecting → editor unchanged

## 3. Link editing & regressions

- [ ] Cursor inside an existing link → Link button pre-fills its current href
- [ ] **Clicking** an existing link opens the edit input prefilled with its href (and does not navigate)
- [ ] **Unlink** button shows only when the cursor is in a link; removes it
- [ ] Re-linking selected text that's already a link **updates** the whole link
- [ ] Bold / italic / lists / headings still work (general sanity)
- [ ] Clicking a link inside the editor does **not** navigate (openOnClick off)
- [ ] In Source mode, links carry `rel="noopener noreferrer"`

## 4. Persistence / round-trip

- [ ] Save, leave, reopen the form → file link persists with correct href
- [ ] Toggle Source mode → back to rich → link intact
- [ ] Hand-type `<a href="/uploads/files/x.pdf">…</a>` in Source mode → persists after blur

## 5. Sanitization (should be blocked on save)

- [ ] `javascript:alert(1)` in the link input → stripped/blocked in saved output
- [ ] `data:text/html,...` → blocked
- [ ] An external image URL typed as a file path won't slip through as `<img>` (img src stays strict)

## 6. Export / preview — the payoff

- [ ] **Preview** a page whose richtext has a PDF link → the link opens the PDF (live media endpoint)
- [ ] **Preview** an internal `/about.html` richtext link → navigates correctly
- [ ] **Export** → exported HTML href points to `assets/files/<name>.pdf` **and** the file exists under `assets/files/`
- [ ] **Collection item page** (nested, e.g. `news/…`) with a richtext PDF link → exported href is depth-prefixed (`../assets/files/…`) and resolves
- [ ] **Usage tracking**: after referencing the PDF in richtext, it shows **"in use"** in the Media Library
- [ ] **Delete protection**: deleting that PDF while it's linked in richtext is blocked

## 7. Edge cases

- [ ] Two different file links in one richtext field both resolve
- [ ] Same PDF linked in richtext **and** in a `resource-list` widget → usage lists both; export copies the file once
- [ ] After an inserted (no-selection) file link, typing a normal character doesn't continue the link
- [ ] Switching picker mode (open image picker, close, open file picker) shows the right filter each time

---

## Regression note — dev-only StrictMode crash

Before this work, mounting/expanding a richtext field in dev could throw
`TypeError: Cannot read properties of null (reading 'cached')` (TipTap `getHTML()` on a
StrictMode-destroyed editor). Fixed by guarding `getHTML()`/`setContent()` calls with
`editor.isDestroyed` and setting `immediatelyRender: false`. Sanity-check while testing:

- [ ] Hard-reload a richtext route and toggle **Expand** repeatedly → no 500 / console crash

## See also

- [core-file-assets.md](core-file-assets.md) — File Assets architecture (PDF upload, export copying, path rewriting)
- [core-media.md](core-media.md) — Media Library, Copy URL, usage tracking
- [theming-setting-types.md](theming-setting-types.md) — the `richtext` setting type and its flags
