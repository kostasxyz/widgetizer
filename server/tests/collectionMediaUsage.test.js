/**
 * Collection media-usage tracking test suite (Phase 6).
 *
 * Tests that collection items contribute to the media_usage table under the
 * `collection:{type}/{slug}` source string, and that refreshAllMediaUsage scans
 * collections/ alongside pages/globals/theme.
 *
 * Run with: node --test server/tests/collectionMediaUsage.test.js
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import path from "path";
import os from "os";

const TEST_ROOT = path.join(os.tmpdir(), `widgetizer-coll-media-test-${Date.now()}`);
process.env.DATA_ROOT = path.join(TEST_ROOT, "data");
process.env.THEMES_ROOT = path.join(TEST_ROOT, "themes");
process.env.NODE_ENV = "test";

const { getProjectDir, getProjectPagesDir, getProjectCollectionItemPath } = await import(
  "../config.js"
);
const projectRepo = await import("../db/repositories/projectRepository.js");
const { readMediaFile } = await import("../services/mediaService.js");
const { writeMediaFile } = await import("../controllers/mediaController.js");
const {
  extractMediaPathsFromCollectionItem,
  updateCollectionItemMediaUsage,
  removeCollectionItemFromMediaUsage,
  syncCollectionItemMediaUsageOnWrite,
  refreshAllMediaUsage,
} = await import("../services/mediaUsageService.js");
const { closeDb } = await import("../db/index.js");

const PROJECT_ID = "coll-media-uuid";
const PROJECT_FOLDER = "coll-media-project";
const IMG = "img-hero";
const FILE = "file-spec";

function mediaFiles() {
  return [
    {
      id: IMG,
      filename: "hero.jpg",
      path: "/uploads/images/hero.jpg",
      type: "image/jpeg",
      sizes: { large: { path: "/uploads/images/hero-large.jpg", width: 1920, height: 1280 } },
      usedIn: [],
    },
    { id: FILE, filename: "spec.pdf", path: "/uploads/files/spec.pdf", type: "application/pdf", usedIn: [] },
  ];
}

const usedIn = (media, id) => media.files.find((f) => f.id === id).usedIn;

before(async () => {
  await projectRepo.writeProjectsData({
    projects: [
      {
        id: PROJECT_ID,
        folderName: PROJECT_FOLDER,
        name: "Coll Media Test",
        theme: "__t__",
        created: new Date().toISOString(),
      },
    ],
    activeProjectId: PROJECT_ID,
  });
  await fs.ensureDir(getProjectPagesDir(PROJECT_FOLDER));
});

after(async () => {
  closeDb();
  await fs.remove(TEST_ROOT);
});

beforeEach(async () => {
  await writeMediaFile(PROJECT_ID, { files: mediaFiles() });
  await fs.remove(path.join(getProjectDir(PROJECT_FOLDER), "collections"));
});

// ============================================================================
// extractMediaPathsFromCollectionItem — gallery (string[] of upload paths) walking
// ============================================================================

describe("extractMediaPathsFromCollectionItem — gallery", () => {
  it("extracts each gallery upload path and skips blank ones", () => {
    const item = {
      settings: {
        gallery: ["/uploads/images/hero.jpg", "/uploads/images/other.jpg", ""],
      },
    };
    const paths = extractMediaPathsFromCollectionItem(item).sort();
    assert.deepEqual(paths, ["/uploads/images/hero.jpg", "/uploads/images/other.jpg"]);
  });
});

describe("extractMediaPathsFromCollectionItem", () => {
  it("finds image, file, and nested link-href upload paths in settings", () => {
    const item = {
      settings: {
        featured_image: "/uploads/images/hero.jpg",
        attachment: "/uploads/files/spec.pdf",
        cta: { href: "/uploads/files/spec.pdf", target: "_blank" },
        title: "no media here",
      },
    };
    const paths = extractMediaPathsFromCollectionItem(item);
    assert.ok(paths.includes("/uploads/images/hero.jpg"));
    assert.ok(paths.includes("/uploads/files/spec.pdf"));
  });

  it("includes the SEO social image (seo.og_image) — Finding #12 media tracking", () => {
    const item = {
      settings: { featured_image: "/uploads/images/hero.jpg" },
      seo: { og_image: "/uploads/images/social.jpg" },
    };
    const paths = extractMediaPathsFromCollectionItem(item);
    assert.ok(paths.includes("/uploads/images/hero.jpg"));
    assert.ok(paths.includes("/uploads/images/social.jpg"), "seo.og_image must be tracked as used media");
  });

  it("extracts upload paths embedded in richtext HTML (e.g. an <img src>)", () => {
    const item = {
      settings: {
        body: '<p>Intro</p><img src="/uploads/images/inline-large.jpg" alt="x"><p>More text</p>',
        featured_image: "/uploads/images/hero.jpg",
      },
    };
    const paths = extractMediaPathsFromCollectionItem(item);
    assert.ok(paths.includes("/uploads/images/hero.jpg"));
    assert.ok(
      paths.includes("/uploads/images/inline-large.jpg"),
      "richtext-embedded <img> upload paths must be tracked as used media"
    );
  });
});

describe("updateCollectionItemMediaUsage", () => {
  it("records the collection:{type}/{slug} source for referenced files", async () => {
    await updateCollectionItemMediaUsage(PROJECT_ID, "portfolio", "alpha", {
      settings: { featured_image: "/uploads/images/hero.jpg" },
    });
    const media = await readMediaFile(PROJECT_ID);
    assert.deepEqual(usedIn(media, IMG), ["collection:portfolio/alpha"]);
    assert.deepEqual(usedIn(media, FILE), []);
  });

  it("matches a richtext-embedded size variant back to its record (export-safe)", async () => {
    // A richtext <img> embeds the `large` variant, not the original. Usage must
    // still resolve to the hero record so export copies the asset.
    await updateCollectionItemMediaUsage(PROJECT_ID, "news", "post", {
      settings: { body: '<p>Intro</p><img src="/uploads/images/hero-large.jpg" alt="x"><p>More</p>' },
    });
    const media = await readMediaFile(PROJECT_ID);
    assert.deepEqual(usedIn(media, IMG), ["collection:news/post"]);
  });
});

describe("syncCollectionItemMediaUsageOnWrite", () => {
  it("on rename, removes the old source and adds the new one", async () => {
    await updateCollectionItemMediaUsage(PROJECT_ID, "portfolio", "alpha", {
      settings: { featured_image: "/uploads/images/hero.jpg" },
    });
    await syncCollectionItemMediaUsageOnWrite(
      PROJECT_ID,
      "portfolio",
      "renamed",
      { settings: { featured_image: "/uploads/images/hero.jpg" } },
      "alpha",
    );
    const media = await readMediaFile(PROJECT_ID);
    assert.deepEqual(usedIn(media, IMG), ["collection:portfolio/renamed"]);
  });
});

describe("removeCollectionItemFromMediaUsage", () => {
  it("clears the source entirely", async () => {
    await updateCollectionItemMediaUsage(PROJECT_ID, "portfolio", "alpha", {
      settings: { featured_image: "/uploads/images/hero.jpg" },
    });
    await removeCollectionItemFromMediaUsage(PROJECT_ID, "portfolio", "alpha");
    const media = await readMediaFile(PROJECT_ID);
    assert.deepEqual(usedIn(media, IMG), []);
  });
});

describe("refreshAllMediaUsage — collections", () => {
  it("rebuilds collection sources from disk (simulated import)", async () => {
    // Two collection item files placed directly on disk (as an import would).
    await fs.outputJSON(getProjectCollectionItemPath(PROJECT_FOLDER, "portfolio", "alpha"), {
      id: "alpha",
      slug: "alpha",
      settings: { featured_image: "/uploads/images/hero.jpg" },
    });
    await fs.outputJSON(getProjectCollectionItemPath(PROJECT_FOLDER, "team", "jane"), {
      id: "jane",
      slug: "jane",
      settings: { resume: "/uploads/files/spec.pdf" },
    });
    // a stray _order.json must be ignored
    await fs.outputJSON(
      path.join(getProjectDir(PROJECT_FOLDER), "collections", "portfolio", "_order.json"),
      { order: ["alpha"] },
    );

    await refreshAllMediaUsage(PROJECT_ID);
    const media = await readMediaFile(PROJECT_ID);
    assert.deepEqual(usedIn(media, IMG), ["collection:portfolio/alpha"]);
    assert.deepEqual(usedIn(media, FILE), ["collection:team/jane"]);
  });
});
