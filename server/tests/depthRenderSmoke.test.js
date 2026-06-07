/**
 * Phase 17 — depth-1 render smoke test + page (depth-0) regression guard.
 *
 * Renders a layout that exercises the whole publish-mode path chain at
 * outputPathPrefix "../" (as a collection item page one directory deep) and
 * confirms EVERY emitted path is prefixed: asset URLs, image src, placeholder,
 * preload href + imagesrcset, favicon/apple/manifest refs, the /uploads rewrite,
 * the markdown alternate link, and menu hrefs (with active-state surviving via
 * canonicalPath). The same layout at depth 0 must contain no "../" — the page
 * regression guard that the depth machinery never leaks into root pages.
 *
 * Run with: node --test server/tests/depthRenderSmoke.test.js
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { Liquid } from "liquidjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_ROOT = path.join(os.tmpdir(), `widgetizer-depth-smoke-${Date.now()}`);
process.env.DATA_ROOT = path.join(TEST_ROOT, "data");
process.env.THEMES_ROOT = path.join(TEST_ROOT, "themes");
process.env.NODE_ENV = "test";

const _origWarn = console.warn;
const _origError = console.error;
console.warn = () => {};
console.error = () => {};

const { getProjectDir, getProjectPagesDir } = await import("../config.js");
const projectRepo = await import("../db/repositories/projectRepository.js");
const { writeMediaFile } = await import("../controllers/mediaController.js");
const { renderPageLayout } = await import("../services/renderingService.js");
const { resolveMenuItemLinks } = await import("../services/menuResolver.js");
const { rewriteStoragePaths, markdownAlternateHref } = await import("../utils/exportPostProcess.js");
const { closeDb } = await import("../db/index.js");

const PROJECT_ID = "depth-smoke-uuid";
const PROJECT_FOLDER = "depth-smoke-project";

const RAW_THEME_SETTINGS = {
  settings: { global: { general: [{ id: "favicon", value: "/uploads/images/site-icon.svg", default: "" }] } },
};

// site_icons as produced for the export root (bare filenames).
const ROOT_SITE_ICONS = {
  primaryIconHref: "favicon.svg",
  primaryIconType: "image/svg+xml",
  primaryIconSizes: "any",
  legacyIconHref: "",
  appleTouchIconHref: "apple-touch-icon.png",
  manifestHref: "site.webmanifest",
};

const LAYOUT = `<!DOCTYPE html>
<html>
<head>
{% asset src: "base.css" %}
{% header_assets %}
<link rel="icon" href="{{ site_icons.primaryIconHref }}">
<link rel="apple-touch-icon" href="{{ site_icons.appleTouchIconHref }}">
<link rel="manifest" href="{{ site_icons.manifestHref }}">
</head>
<body class="{{ body_class }}">
{% image src: "hero.jpg" %}
{% placeholder_image %}
{{ main_content | raw }}
</body>
</html>`;

function makeGlobals(outputPathPrefix) {
  return {
    projectId: PROJECT_ID,
    apiUrl: "",
    renderMode: "publish",
    themeSettingsRaw: RAW_THEME_SETTINGS,
    siteIcons: ROOT_SITE_ICONS,
    outputPathPrefix,
    currentCanonicalPath: outputPathPrefix ? "portfolio/alpha.html" : "index.html",
    enqueuedStyles: new Map(),
    enqueuedScripts: new Map(),
    enqueuedPreloads: new Map([["hero.jpg", { as: "image", imagesrcset: "a.jpg 320w, b.jpg 640w" }]]),
  };
}

const CONTENT = '<a href="/uploads/files/doc.pdf">Doc</a>';

before(async () => {
  await projectRepo.writeProjectsData({
    projects: [
      {
        id: PROJECT_ID,
        folderName: PROJECT_FOLDER,
        name: "Depth Smoke",
        theme: "__depth_smoke_theme__",
        siteUrl: "",
        created: new Date().toISOString(),
      },
    ],
    activeProjectId: PROJECT_ID,
  });

  const projectDir = getProjectDir(PROJECT_FOLDER);
  await fs.ensureDir(getProjectPagesDir(PROJECT_FOLDER));
  await fs.ensureDir(path.join(projectDir, "snippets"));
  await fs.writeFile(path.join(projectDir, "layout.liquid"), LAYOUT);

  await writeMediaFile(PROJECT_ID, {
    files: [
      {
        id: "img-1",
        filename: "hero.jpg",
        path: "/uploads/images/hero.jpg",
        type: "image/jpeg",
        width: 800,
        height: 600,
        usedIn: [],
      },
    ],
  });
});

after(async () => {
  closeDb();
  await fs.remove(TEST_ROOT);
  console.warn = _origWarn;
  console.error = _origError;
});

describe("depth-1 item render — full path chain is prefixed", () => {
  let html;
  before(async () => {
    html = await renderPageLayout(
      PROJECT_ID,
      { mainContent: CONTENT },
      { slug: "alpha", name: "Alpha", seo: {} },
      RAW_THEME_SETTINGS,
      "publish",
      makeGlobals("../"),
    );
    // Apply the export post-processing an item page would receive.
    html = rewriteStoragePaths(html, "../");
  });

  it("asset tag URL is prefixed", () => {
    assert.match(html, /href="\.\.\/assets\/base\.css"/);
  });

  it("image src is prefixed", () => {
    assert.match(html, /src="\.\.\/assets\/images\/hero\.jpg"/);
  });

  it("placeholder image is prefixed", () => {
    assert.match(html, /src="\.\.\/assets\/placeholder\.svg"/);
  });

  it("preload href and imagesrcset are prefixed", () => {
    assert.match(html, /<link rel="preload" href="\.\.\/hero\.jpg"/);
    assert.match(html, /imagesrcset="\.\.\/a\.jpg 320w, \.\.\/b\.jpg 640w"/);
  });

  it("favicon / apple-touch / manifest refs are prefixed", () => {
    assert.match(html, /rel="icon" href="\.\.\/favicon\.svg"/);
    assert.match(html, /rel="apple-touch-icon" href="\.\.\/apple-touch-icon\.png"/);
    assert.match(html, /rel="manifest" href="\.\.\/site\.webmanifest"/);
  });

  it("/uploads storage path is rewritten with the depth prefix", () => {
    assert.match(html, /href="\.\.\/assets\/files\/doc\.pdf"/);
    assert.doesNotMatch(html, /\/uploads\//);
  });

  it("markdown alternate href falls back to the prefixed relative form", () => {
    assert.equal(markdownAlternateHref("alpha.md", "", false, "../"), "../alpha.md");
  });
});

describe("depth-0 page render — regression guard (no leakage)", () => {
  it("contains no ../ prefixes and emits canonical asset/favicon forms", async () => {
    let html = await renderPageLayout(
      PROJECT_ID,
      { mainContent: CONTENT },
      { slug: "index", name: "Home", seo: {} },
      RAW_THEME_SETTINGS,
      "publish",
      makeGlobals(""),
    );
    html = rewriteStoragePaths(html, "");
    assert.doesNotMatch(html, /\.\.\//, "no depth prefix should appear on root pages");
    assert.match(html, /href="assets\/base\.css"/);
    assert.match(html, /src="assets\/images\/hero\.jpg"/);
    assert.match(html, /rel="icon" href="favicon\.svg"/);
    assert.match(html, /href="assets\/files\/doc\.pdf"/);
  });
});

describe("menu active-state survives prefixing at depth", () => {
  const coreSnippetsDir = path.join(__dirname, "../../src/core/snippets");
  const pagesByUuid = new Map([["uuid-about", { uuid: "uuid-about", slug: "about" }]]);

  const renderMenu = (items, currentCanonicalPath) => {
    const engine = new Liquid({ extname: ".liquid", root: [coreSnippetsDir], partials: [coreSnippetsDir] });
    return engine.renderFile("menu", {
      menu: { items },
      currentCanonicalPath,
      skip_nav: true,
      class_list: "",
      class_item: "",
      class_link: "",
      class_submenu: "",
      class_has_submenu: "",
    });
  };

  it("depth-1: hrefs prefixed, active item matched via un-prefixed canonicalPath", async () => {
    const items = resolveMenuItemLinks(
      [
        { label: "About", pageUuid: "uuid-about" },
        { label: "Contact", link: "contact.html" },
      ],
      pagesByUuid,
      "../",
    );
    const out = await renderMenu(items, "about.html");
    assert.match(out, /href="\.\.\/about\.html"/);
    assert.match(out, /href="\.\.\/contact\.html"/);
    // The About item is the current page → is-active + aria-current.
    assert.match(out, /is-active[\s\S]*href="\.\.\/about\.html"[^>]*aria-current="page"/);
  });

  it("depth-0: hrefs un-prefixed, active-state unchanged", async () => {
    const items = resolveMenuItemLinks([{ label: "About", pageUuid: "uuid-about" }], pagesByUuid, "");
    const out = await renderMenu(items, "about.html");
    assert.match(out, /href="about\.html"/);
    assert.doesNotMatch(out, /\.\.\//);
    assert.match(out, /aria-current="page"/);
  });
});
