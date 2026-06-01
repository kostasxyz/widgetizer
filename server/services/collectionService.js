/**
 * collectionService — reads, validates, and normalizes collection-type schemas
 * (Collections spec Sections 1 and 4) and serves collection items.
 *
 * Phase 1 scope: schema validation/normalization and listing.
 */

import fs from "fs-extra";
import path from "path";

import { getProjectCollectionTypesDir, getProjectCollectionSchemaPath } from "../config.js";
import { isSupportedSettingType } from "../../src/components/settings/supportedSettingTypes.js";

const SLUG_RE = /^[a-z0-9-]+$/;
const ALLOWED_SORTS = ["manual", "created_desc", "created_asc", "title_asc", "title_desc"];
const RESERVED_SLUG_PREFIXES = new Set(["assets"]);
// v1 constructs that must be rejected, not silently ignored (Section 1).
const DISALLOWED_SETTING_KEYS = ["multiple", "repeater", "blocks"];

/**
 * Validate and normalize a single collection-type schema (Section 1 rules).
 * Pure function — no filesystem.
 *
 * @param {object} schema - parsed schema.json contents
 * @param {string} folderName - the collection-types/<folder> name on disk
 * @returns {{ valid: boolean, errors: string[], normalized: object|null }}
 */
export function validateCollectionSchema(schema, folderName) {
  const errors = [];

  if (!schema || typeof schema !== "object") {
    return { valid: false, errors: ["Schema must be an object."], normalized: null };
  }

  // --- type: pattern + folder-name match ---
  if (typeof schema.type !== "string" || !SLUG_RE.test(schema.type)) {
    errors.push("`type` is required and must match ^[a-z0-9-]+$.");
  } else if (schema.type !== folderName) {
    errors.push(`\`type\` "${schema.type}" must match its folder name "${folderName}".`);
  }

  // --- schema-level `blocks` is not allowed in v1 ---
  if ("blocks" in schema) {
    errors.push("Schema-level `blocks` is not supported in v1.");
  }

  // --- settings array + per-setting checks ---
  let titleSettings = [];
  let ogImageSettings = [];
  if (!Array.isArray(schema.settings)) {
    errors.push("`settings` must be an array.");
  } else {
    schema.settings.forEach((setting, index) => {
      const where = `settings[${index}]`;
      if (!setting || typeof setting !== "object") {
        errors.push(`${where} must be an object.`);
        return;
      }
      if (typeof setting.id !== "string" || !setting.id) {
        errors.push(`${where} is missing a string \`id\`.`);
      }
      if (typeof setting.type !== "string" || !isSupportedSettingType(setting.type)) {
        errors.push(`${where} uses unsupported setting type "${setting.type}".`);
      }
      for (const key of DISALLOWED_SETTING_KEYS) {
        if (key in setting) {
          errors.push(`${where} (id "${setting.id}") uses \`${key}\`, which is invalid in v1.`);
        }
      }
      if (setting.usedAsTitle === true && setting.type !== "header") {
        titleSettings.push(setting);
      }
      if (setting.usedAsOgImage === true) {
        ogImageSettings.push(setting);
      }
    });
  }

  // --- usedAsTitle: exactly one, must be a text setting ---
  if (titleSettings.length !== 1) {
    errors.push(
      `Exactly one non-header setting must declare \`usedAsTitle: true\` (found ${titleSettings.length}).`,
    );
  } else if (titleSettings[0].type !== "text") {
    errors.push("`usedAsTitle` must be on a `text` setting.");
  }

  // --- usedAsOgImage: at most one, must be an image setting ---
  if (ogImageSettings.length > 1) {
    errors.push(
      `At most one setting may declare \`usedAsOgImage: true\` (found ${ogImageSettings.length}).`,
    );
  } else if (ogImageSettings.length === 1 && ogImageSettings[0].type !== "image") {
    errors.push("`usedAsOgImage` must be on an `image` setting.");
  }

  // --- defaultSort ---
  if (schema.defaultSort !== undefined && !ALLOWED_SORTS.includes(schema.defaultSort)) {
    errors.push(`\`defaultSort\` must be one of: ${ALLOWED_SORTS.join(", ")}.`);
  }

  // --- slugPrefix (effective = explicit or type) ---
  const slugPrefix = schema.slugPrefix ?? schema.type;
  if (schema.hasItemPages === true) {
    if (typeof slugPrefix !== "string" || !SLUG_RE.test(slugPrefix)) {
      errors.push("`slugPrefix` must match ^[a-z0-9-]+$ when `hasItemPages` is true.");
    } else if (RESERVED_SLUG_PREFIXES.has(slugPrefix)) {
      errors.push(`\`slugPrefix\` "${slugPrefix}" is reserved and cannot be used.`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, normalized: null };
  }

  const normalized = {
    ...schema,
    slugPrefix,
    defaultSort: schema.defaultSort ?? "manual",
  };
  return { valid: true, errors: [], normalized };
}

/**
 * Read, validate, and normalize all collection-type schemas for a project from
 * its copied `collection-types/` directory.
 *
 * Invalid schemas are **skipped** (logged), not thrown — a single broken schema
 * must not break the whole sidebar/API (Section 1). Collections that share a
 * `slugPrefix` are all skipped, since no winner can be picked deterministically.
 *
 * @param {string} projectFolderName
 * @returns {Promise<object[]>} normalized valid schemas
 */
export async function listCollectionSchemas(projectFolderName) {
  const typesDir = getProjectCollectionTypesDir(projectFolderName);

  let entries;
  try {
    entries = await fs.readdir(typesDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return []; // no collection-types/ dir — fine
    throw err;
  }

  const folderNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  const valid = [];
  for (const folderName of folderNames) {
    const schemaPath = getProjectCollectionSchemaPath(projectFolderName, folderName);
    let raw;
    try {
      raw = await fs.readJSON(schemaPath);
    } catch (err) {
      console.warn(
        `[collections] Skipping "${folderName}": cannot read schema.json (${err.message}).`,
      );
      continue;
    }

    const { valid: ok, errors, normalized } = validateCollectionSchema(raw, folderName);
    if (!ok) {
      console.warn(
        `[collections] Skipping invalid schema "${folderName}": ${errors.join("; ")}`,
      );
      continue;
    }
    valid.push(normalized);
  }

  // Cross-collection slugPrefix uniqueness (Section 1).
  const prefixCounts = new Map();
  for (const schema of valid) {
    prefixCounts.set(schema.slugPrefix, (prefixCounts.get(schema.slugPrefix) ?? 0) + 1);
  }

  const result = [];
  for (const schema of valid) {
    if (prefixCounts.get(schema.slugPrefix) > 1) {
      console.warn(
        `[collections] Skipping "${schema.type}": slugPrefix "${schema.slugPrefix}" is shared by multiple collections.`,
      );
      continue;
    }
    result.push(schema);
  }

  return result;
}

/**
 * Validate every collection-type schema in a theme SOURCE directory, for theme
 * upload (Section 5 "Theme Upload Validation"). Unlike `listCollectionSchemas`,
 * this **rejects** (collects errors) rather than skipping — the upload should
 * fail loudly so the theme author fixes it.
 *
 * Also enforces the `BLOCKER-1` resolution: a preset may not ship a
 * `collection-types/` folder (collection schemas are theme-only).
 *
 * @param {string} themeSourceDir - root of the theme being uploaded
 * @returns {Promise<{ valid: boolean, errors: string[] }>}
 */
export async function validateThemeCollectionSchemas(themeSourceDir) {
  const errors = [];

  const typesDir = path.join(themeSourceDir, "collection-types");
  let entries = [];
  try {
    entries = await fs.readdir(typesDir, { withFileTypes: true });
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  const folderNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  const prefixOwners = new Map(); // effective slugPrefix -> [folderName...]
  for (const folderName of folderNames) {
    const schemaPath = path.join(typesDir, folderName, "schema.json");
    let raw;
    try {
      raw = await fs.readJSON(schemaPath);
    } catch (err) {
      errors.push(`Collection "${folderName}": cannot read schema.json (${err.message}).`);
      continue;
    }

    const { valid, errors: schemaErrors } = validateCollectionSchema(raw, folderName);
    if (!valid) {
      for (const e of schemaErrors) errors.push(`Collection "${folderName}": ${e}`);
    }

    const effectivePrefix = (raw && (raw.slugPrefix ?? raw.type)) || folderName;
    if (!prefixOwners.has(effectivePrefix)) prefixOwners.set(effectivePrefix, []);
    prefixOwners.get(effectivePrefix).push(folderName);
  }

  for (const [prefix, owners] of prefixOwners) {
    if (owners.length > 1) {
      errors.push(`Duplicate slugPrefix "${prefix}" shared by collections: ${owners.join(", ")}.`);
    }
  }

  // BLOCKER-1 resolution: presets are item-data only; reject preset-owned schemas.
  const presetsDir = path.join(themeSourceDir, "presets");
  let presetEntries = [];
  try {
    presetEntries = await fs.readdir(presetsDir, { withFileTypes: true });
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  for (const preset of presetEntries.filter((e) => e.isDirectory())) {
    const presetCollectionTypes = path.join(presetsDir, preset.name, "collection-types");
    if (await fs.pathExists(presetCollectionTypes)) {
      errors.push(
        `Preset "${preset.name}" contains a collection-types/ folder, which is not allowed — collection schemas are theme-only (presets may seed collections/ item data only).`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
