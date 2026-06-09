# UX Audit & Current Implementation

This document provides a user experience (UX) audit of the application's core workflows, documenting what has been implemented and identifying areas for future improvement.

---

## Guiding Principles

1.  **Never Leave the User Guessing:** After any action (save, delete, etc.), the user should receive immediate and clear feedback (e.g., a "toast" notification).
2.  **Go with the Flow:** Redirect users to the logical next step in their workflow. For example, after creating an item, take them to where they can use it or see it.
3.  **Consistency is Key:** The pattern for creating, editing, and deleting different types of content (pages, menus, etc.) should be as similar as possible.
4.  **Prevent Destructive Actions:** Use confirmation modals for deletions, and block or warn on actions that would break things (e.g., deleting a theme that is in use returns 409 and shows an error toast).
5.  **Efficiency Through Shortcuts:** Provide standard keyboard shortcuts (Undo, Redo, Save) to speed up common workflows.
6.  **Intelligent Auto-Save:** Auto-save should be "invisible" and respectful of user activity, triggering only after a period of inactivity (debounce) rather than at fixed intervals.

---

## 1. Project Management (`/projects`)

Project administration now lives in the admin shell. Opening a project is the handoff into the separate site workspace.

### **1.1. Create a New Project**

- **Current State:**
  - After creating a project, the frontend sets it as active immediately.
  - The user is redirected into the site workspace (`/pages` by default, or a preserved `next` destination when they were bounced out of a workspace route).
  - Success toast is shown confirming project creation and activation.
  - Navigation guard prevents accidental navigation with unsaved changes.
- **Status:** ✅ Implemented

### **1.2. Edit a Project**

- **Current State:**
  - After saving changes, the user remains on the edit page with a "Back to List" button shown.
  - Success toast is shown: `Project "[Project Name]" was updated successfully!` (or `...was updated successfully and folder was renamed.` if folderName changed).
  - If the edited project is the active project, the active project state is refreshed.
  - Navigation guard prevents accidental navigation with unsaved changes.
- **Status:** ✅ Implemented correctly

### **1.3. Delete a Project**

- **Current State:**
  - Row actions live in a three-dot (⋮) menu. The active project **cannot be deleted** - its Delete entry is disabled and its label changes to "Cannot delete active project".
  - Attempting to delete the active project shows an error toast: `Cannot delete the active project. Please set another project as active first.`
  - For non-active projects, a confirmation modal appears before deletion.
  - Upon confirmation, the project is deleted, the list is refreshed, and a success toast is shown: `Project "[Project Name]" was deleted successfully`.
- **Status:** ✅ Fully implemented with proper safeguards

### **1.4. Open / Set Active Project**

- **Current State:**
  - Users open a project by clicking its name in the list (or "Open project" / "Set as active" in the row's three-dot menu).
  - If the project is not already active, the app sets it active first, then navigates into the workspace.
  - The active project is visually indicated with an "Active" badge (shown only when more than one project exists).
  - A success toast is shown only when the active project actually changes.
- **Status:** ✅ Implemented

### **1.5. Duplicate Project**

- **Current State:**
  - Users can duplicate a project via the row's three-dot actions menu.
  - Success toast: `Project duplicated successfully`
  - The list refreshes to show the new project.
- **Status:** ✅ Implemented

### **1.6. Export / Import Project (Backup)**

- **Current State:**
  - The row's three-dot menu offers "Export" (downloads a backup ZIP). A persistent info toast (`Preparing backup...`) is shown while the export runs, replaced by `Backup downloaded successfully` (or an error toast) when it finishes.
  - An "Import" button on the Projects page opens a modal (`ProjectImportModal`) for restoring a project from a backup; on success a toast confirms the import and the imported project is opened (activated + navigated into the workspace).
- **Status:** ✅ Implemented

---

## 2. Page Management (`/pages`)

_(Excluding the Page Editor itself)_

### **2.1. Create a New Page**

- **Current State:**
  - After creating a page, the user is redirected to `/pages` (pages list).
  - Success toast: `Page "[Page Name]" was created successfully!`
  - Navigation guard prevents accidental navigation with unsaved changes.
- **Future Improvement:** Redirect directly to the Page Editor (`/page-editor?pageId=[new_page_id]`) since the immediate next step is adding content.

### **2.2. Edit Page Settings**

- **Current State:**
  - After saving, the user remains on the edit page with a "Back to List" button shown.
  - Success toast: `Page "[Page Name]" was updated successfully!` (or `...was updated successfully and URL was changed.` if slug changed).
  - If the slug changes, the URL is updated automatically and navigation guard is bypassed.
  - Navigation guard prevents accidental navigation with unsaved changes.
- **Status:** ✅ Implemented correctly

### **2.3. Delete a Page**

- **Current State:**
  - A confirmation modal appears before deletion.
  - Supports both single and bulk deletion (with selection checkboxes).
  - Upon confirmation, the page(s) are deleted, the list is refreshed, and a success toast is shown: `Page deleted successfully` (or `Successfully deleted [count] pages` for bulk).
  - Error toast shown if deletion fails.
- **Status:** ✅ Fully implemented with bulk delete support

### **2.4. Duplicate Page**

- **Current State:**
  - Users can duplicate a page via the row's three-dot actions menu.
  - Success toast: `Page duplicated successfully`
  - The list refreshes to show the new page.
- **Status:** ✅ Implemented

---

## 3. Menu Management (`/menus`)

### **3.1. Create a New Menu**

- **Current State:**
  - After creating a menu, the user is redirected to `/menus/[new_menu_id]/structure` (menu structure editor).
  - Success toast: `Menu "[Menu Name]" was created successfully!`
  - Navigation guard prevents accidental navigation with unsaved changes.
- **Status:** ✅ Implemented correctly - follows the "go with the flow" principle

### **3.2. Delete a Menu**

- **Current State:**
  - A confirmation modal appears before deletion.
  - Upon confirmation, the menu is deleted, the list is updated, and a success toast is shown: `Menu "[Menu Name]" was deleted successfully`
  - Error toast shown if deletion fails.
- **Status:** ✅ Fully implemented

### **3.3. Duplicate Menu**

- **Current State:**
  - Users can duplicate a menu via the row's three-dot actions menu.
  - Success toast: `Menu duplicated successfully`
  - The new menu appears in the list.
- **Status:** ✅ Implemented

---

## 4. Media Management (`/media`)

### **4.1. Upload Media**

- **Current State:**
  - Files are uploaded via drag-and-drop or file picker.
  - Supports batch uploads (processed in chunks of 5 files).
  - Upload progress is shown for each file.
  - Success toast: `Successfully uploaded [count] file(s).` (or `Uploaded [count] file(s). [count] file(s) rejected.` for partial success).
  - Individual error toasts shown for rejected files (limited to first 5 to avoid spam).
  - Newly uploaded files appear in the media grid.
  - No redirection needed.
- **Status:** ✅ Fully implemented with comprehensive feedback

### **4.2. Delete Media**

- **Current State:**
  1.  A confirmation modal appears before deletion (single or bulk, with selection checkboxes).
  2.  Usage protection is enforced server-side (via `usedIn` tracking): if a file is in use, deletion is rejected and an error toast is shown: `Cannot delete file - currently in use by pages`.
  3.  Bulk deletes support partial success: files not in use are deleted, and a warning toast reports which files could not be deleted because they are in use (or an error toast if none could be deleted).
  4.  Upon successful deletion, a toast is shown: `File "[file-name]" deleted successfully` (or `Successfully deleted [count] files` for bulk).
- **Status:** ✅ Fully implemented with usage tracking and bulk delete support

---

## 5. Theme Management (`/themes`)

### **5.1. Upload Theme**

- **Current State:**
  - Themes are uploaded via drag-and-drop or file picker (ZIP files only).
  - Real upload progress is displayed (XHR progress events).
  - Success toast: `Theme uploaded successfully!`
  - Error toast shown if upload fails or if multiple files are selected.
  - New theme appears in the theme list.
- **Status:** ✅ Implemented

### **5.2. Activate a Theme**

- **Current State:**
  - Themes are managed in the admin shell (`/themes`).
  - Themes are selected during project creation (theme changes are not supported in project edit).
  - Themes used by one or more projects show an "In use" indicator with a tooltip listing those projects.
  - No direct activation UI exists on the themes page itself.
- **Future Improvement:** Add an "Activate" button on theme cards to allow switching themes without editing the project. Show success toast: `Theme "[Theme Name]" has been activated.`

### **5.3. Delete a Theme**

- **Current State:**
  1. User opens the three-dot menu (⋮) on a theme row on the Themes page.
  2. User clicks "Delete". If the theme is in use, the entry is disabled and its label explains why ("Cannot delete theme in use by N project(s)").
  3. In-app confirmation modal: "Are you sure you want to delete \"[Theme Name]\"? This action cannot be undone."
  4. On confirm, `DELETE /api/themes/:id` is called. Backend removes the theme directory.
  5. As a server-side fallback, if the theme is used by one or more projects, the server returns 409; UI shows error toast: "Cannot delete \"[Theme Name]\" - it is currently used by one or more projects".
  6. On success: success toast, theme list refreshes.
- **Status:** ✅ Fully implemented

### **5.4. Update a Theme**

- **Current State:**
  1. The Admin menu (and its Themes entry) displays a badge with count of themes having pending updates.
  2. User visits Themes page and sees an up-arrow indicator with the new version (e.g., "vX.Y.Z") next to an "Update" button on theme rows.
  3. User clicks the "Update" button.
  4. System builds the `latest/` snapshot by composing base + version folders.
  5. Success toast (server message): `Theme '[theme-id]' updated to version X.Y.Z`
  6. Admin menu badge decrements automatically.
  7. If validation fails (missing `theme.json`, version mismatch), error toast with details is shown.
- **Status:** ✅ Fully implemented

### **5.5. Apply Theme Update to Project**

- **Current State:**
  1. After a theme is updated (5.4), projects using that theme show an update indicator (arrow icon) on the Projects page.
  2. User edits the project; a "Theme Update Available" banner is shown above the form.
  3. User clicks the "Apply Update" button in the banner.
  4. System copies updated project-owned theme files to project (including `widgets/`, `layout.liquid`, `assets/`, `snippets/`, `locales/`, and `collection-types/`; user data like `pages/`, `menus/`, `uploads/`, and `collections/` is protected), merges settings, and adds new menus/templates.
  5. Success toast confirms update applied.
  6. Project's `themeVersion` is updated to match the theme's current version.
- **Status:** ✅ Fully implemented
- **Note:** Project update indicators only appear _after_ the theme author has updated the theme (built `latest/`), not merely when new version folders exist.

---

## 6. Export Management (`/export-site`)

### **6.1. Create an Export**

- **Current State:**
  1.  User clicks the export button on the Export Site page.
  2.  The button enters a loading state while the export request is running.
  3.  Toasts provide feedback on success or failure.
  4.  Export history reloads after a successful export.
  5.  Export history persists and shows view/download/delete actions when complete.
- **Status:** ✅ Implemented with comprehensive feedback

---

## 7. Collection Items (`/collections/:type`)

_(Theme-defined collections; see [core-collections.md](core-collections.md) for the underlying system.)_

### **7.1. Create / Edit an Item**

- **Current State:**
  - After creating an item (`/collections/:type/add`), the user is redirected back to the items list with a success toast.
  - After editing, the user remains on the edit page (toast: `[Item Title] updated`, or `...updated. The URL changed to match the new slug.` if the slug changed, navigating to the new edit URL).
  - Navigation guard prevents accidental navigation with unsaved changes.
- **Status:** ✅ Implemented

### **7.2. Delete / Duplicate Items**

- **Current State:**
  - Row actions live in a three-dot menu (Preview for collections with item pages, Edit, Duplicate, Delete).
  - Confirmation modal before deletion; single and bulk deletion (selection checkboxes) are supported, with success/error toasts (`Item deleted successfully` / `Successfully deleted [count] items`).
  - Duplicate shows `Item duplicated successfully` and refreshes the list.
- **Status:** ✅ Implemented

### **7.3. List Features**

- **Current State:**
  - Search by title/slug, an "invalid items" filter (items failing schema validation show a warning badge), and drag-to-reorder for sortable collections (optimistic update, reverted with an error toast on failure).
  - A Preview action opens a full-screen, page-editor-style preview (`CollectionItemPreview`) with an item dropdown, desktop/mobile toggle, and back button, using the same `PreviewStage`/`PreviewModeToggle` chrome as the page preview.
- **Status:** ✅ Implemented

---

## Summary of Implementation Status

### ✅ Fully Implemented

- Project deletion (with active project protection)
- Project editing (with state refresh)
- Project duplication
- Project export/import (backup ZIPs)
- Page deletion (single and bulk)
- Page editing (with URL update handling)
- Page duplication
- Menu creation (redirects to structure editor)
- Menu deletion
- Menu duplication
- Media upload (with progress and error handling)
- Media deletion (with usage tracking, single and bulk)
- Export creation (with processing state)
- Theme upload (with validation and feedback)
- Theme updates (admin menu badge, per-theme update buttons, validation)
- Project theme updates (apply theme updates to projects)
- Theme deletion (three-dot menu, confirmation, disabled when theme in use, 409 fallback)
- Collection item management (create/edit/delete/duplicate, bulk delete, reorder, preview)

### ⚠️ Partially Implemented / Needs Improvement

- **Page creation:** Redirects to list instead of page editor
- **Theme activation:** Only available via project edit, not directly from themes page

### 📝 Notes

- All implemented workflows include proper toast notifications for user feedback.
- Navigation guards prevent accidental data loss on forms.
- Confirmation modals protect against destructive actions.
- Bulk operations are supported for pages, media, and collection items.
- Active project protection prevents breaking the application state.
- Theme update system includes an admin menu badge for pending updates and detailed error feedback.
