/**
 * menuResolver — shared menu-setting resolution used by BOTH widget rendering
 * (`renderingService.renderWidget`) and collection-item rendering
 * (`collectionService.prepareCollectionItemForRender`, finding #10).
 *
 * Kept in its own module because the render gate lives in `collectionService`,
 * which `renderingService` imports — so the resolution primitives can't live in
 * `renderingService` without a circular import. This module imports only
 * config/linkPrefixer/urlSafety, so both services can depend on it freely.
 */

import fs from "fs/promises";
import path from "path";
import { getProjectDir } from "../config.js";
import { prefixInternalHref, normalize } from "../utils/linkPrefixer.js";
import { sanitizeHref } from "../../src/core/utils/urlSafety.js";

/**
 * Recursively resolve links in menu items. Each item resolves to an emitted
 * (depth-aware, prefixed) `link` plus an un-prefixed `canonicalPath` for
 * active-state matching. Stable refs (collectionItemUuid/pageUuid) resolve to
 * the current slug; missing targets clear the link; custom links are sanitized.
 * @param {Array} menuItems - Array of menu items
 * @param {Map} pagesByUuid - Map of uuid -> page data
 * @returns {Array} Menu items with resolved links
 */
export function resolveMenuItemLinks(menuItems, pagesByUuid, outputPathPrefix = "", collectionItemsByUuid = new Map()) {
  if (!menuItems || !Array.isArray(menuItems)) {
    return menuItems;
  }

  return menuItems.map((item) => {
    const resolved = { ...item };

    // Resolve the href for this item, computing both the emitted (depth-aware,
    // prefixed) `link` and the un-prefixed `canonicalPath` used for active-state
    // matching. Every item is processed — including custom URLs — so links work
    // from any output depth, not just resolved ones.
    if (item.collectionItemUuid) {
      // Stable reference to a collection item page (#11): resolve its current
      // slug, mirroring pageUuid so renames follow and deletes clear the link.
      const entry = collectionItemsByUuid && collectionItemsByUuid.get(item.collectionItemUuid);
      if (entry) {
        const href = `${entry.slugPrefix}/${entry.slug}.html`;
        resolved.link = prefixInternalHref(href, outputPathPrefix);
        resolved.canonicalPath = normalize(href);
      } else {
        // Collection item was deleted - clear the link
        resolved.link = "";
        resolved.canonicalPath = "";
        delete resolved.collectionItemUuid;
        delete resolved.collectionType;
      }
    } else if (item.pageUuid) {
      const page = pagesByUuid && pagesByUuid.get(item.pageUuid);
      if (page) {
        const href = `${page.slug}.html`;
        resolved.link = prefixInternalHref(href, outputPathPrefix);
        resolved.canonicalPath = normalize(href);
      } else {
        // Page was deleted - clear the link
        resolved.link = "";
        resolved.canonicalPath = "";
        delete resolved.pageUuid;
      }
    } else if (typeof item.link === "string" && item.link) {
      resolved.link = prefixInternalHref(item.link, outputPathPrefix);
      resolved.canonicalPath = normalize(item.link);
    } else {
      resolved.canonicalPath = "";
    }

    // Block dangerous protocols in author-entered custom links (parity with
    // setting-type "link" fields). Resolved internal slugs are unaffected;
    // this catches javascript:/data:/vbscript: in custom URLs.
    if (typeof resolved.link === "string") {
      resolved.link = sanitizeHref(resolved.link);
    }

    // Recursively resolve children
    if (item.items && Array.isArray(item.items) && item.items.length > 0) {
      resolved.items = resolveMenuItemLinks(item.items, pagesByUuid, outputPathPrefix, collectionItemsByUuid);
    }

    return resolved;
  });
}

/**
 * Resolve links in a menu object (wraps resolveMenuItemLinks over `.items`).
 * @param {object} menuData - Menu data with items array
 * @param {Map} pagesByUuid - Map of uuid -> page data
 * @returns {object} Menu data with resolved links
 */
export function resolveMenuPageLinks(menuData, pagesByUuid, outputPathPrefix = "", collectionItemsByUuid = new Map()) {
  if (!menuData || !menuData.items) {
    return menuData;
  }

  return {
    ...menuData,
    items: resolveMenuItemLinks(menuData.items, pagesByUuid, outputPathPrefix, collectionItemsByUuid),
  };
}

/**
 * Load all menus for a project and return maps for UUID and slug-based lookup.
 * @param {string} projectFolderName - The project folder name
 * @returns {Promise<{byUuid: Map, bySlug: Map}>} Maps for UUID and slug-based lookup
 */
export async function loadMenuMaps(projectFolderName) {
  const byUuid = new Map();
  const bySlug = new Map();

  try {
    const menusDir = path.join(getProjectDir(projectFolderName), "menus");

    let files;
    try {
      files = await fs.readdir(menusDir);
    } catch {
      return { byUuid, bySlug };
    }

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const content = await fs.readFile(path.join(menusDir, file), "utf8");
        const menu = JSON.parse(content);
        if (menu.uuid) {
          byUuid.set(menu.uuid, menu);
        }
        const slugId = file.replace(".json", "");
        bySlug.set(slugId, menu);
      } catch {
        // Skip unreadable menu files
      }
    }
  } catch (error) {
    console.warn(`Could not load menus for UUID resolution: ${error.message}`);
  }

  return { byUuid, bySlug };
}

/** True when a schema declares at least one `menu`-type setting. */
export function schemaHasMenuSetting(schema) {
  return Array.isArray(schema?.settings) && schema.settings.some((s) => s.type === "menu");
}

/**
 * Resolve every `menu`-type setting in a settings object into a full menu object
 * (`{ ...menu, items: [resolved] }`) the menu snippet can render — replacing the
 * stored menu UUID/slug in place. The single source of truth for both widget and
 * collection-item menu resolution. A missing/empty value, an unknown menu, or a
 * thrown error all yield `{ items: [] }` (logged), matching the prior widget
 * behavior. No-op when the schema declares no menu settings or `menuMaps` is absent.
 *
 * @param {object} settings - settings object (mutated in place)
 * @param {Array} schemaSettings - schema setting definitions for `settings`
 * @param {object} deps - { menuMaps, pagesByUuid, collectionItemsByUuid, outputPathPrefix }
 * @returns {object} the same `settings` object
 */
export function resolveMenuSettings(
  settings,
  schemaSettings,
  { menuMaps, pagesByUuid, collectionItemsByUuid = new Map(), outputPathPrefix = "" } = {},
) {
  if (!settings || !Array.isArray(schemaSettings) || !menuMaps) return settings;

  for (const setting of schemaSettings) {
    if (setting.type !== "menu") continue;
    const key = setting.id;
    try {
      const value = settings[key];
      if (value) {
        const menuData = menuMaps.byUuid.get(value) || menuMaps.bySlug.get(value);
        settings[key] = resolveMenuPageLinks(menuData, pagesByUuid, outputPathPrefix, collectionItemsByUuid) || {
          items: [],
        };
      } else {
        settings[key] = { items: [] };
      }
    } catch (err) {
      console.error(`Error loading menu data for setting ${key}:`, err);
      settings[key] = { items: [] };
    }
  }

  return settings;
}
