/**
 * Phase 17 — export post-processing path rewrites, depth-aware.
 *
 * The /uploads/ → assets/ storage-path rewrite and the markdown alternate-link
 * fallback both honour outputPathPrefix so item pages one directory deep resolve
 * correctly. At depth 0 (prefix "") behaviour is byte-identical to today.
 *
 * Run with: node --test server/tests/exportPostProcess.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { rewriteStoragePaths, markdownAlternateHref } from "../utils/exportPostProcess.js";

describe("rewriteStoragePaths", () => {
  const html = '<a href="/uploads/files/b.pdf"><img src="/uploads/images/a.jpg"></a>';

  it("rewrites to assets/ unprefixed at the root", () => {
    assert.equal(
      rewriteStoragePaths(html, ""),
      '<a href="assets/files/b.pdf"><img src="assets/images/a.jpg"></a>',
    );
  });

  it("rewrites with depth prefix one level deep", () => {
    assert.equal(
      rewriteStoragePaths(html, "../"),
      '<a href="../assets/files/b.pdf"><img src="../assets/images/a.jpg"></a>',
    );
  });

  it("defaults to the root prefix and leaves non-string input alone", () => {
    assert.equal(rewriteStoragePaths('<img src="/uploads/images/x.png">'), '<img src="assets/images/x.png">');
    assert.equal(rewriteStoragePaths(null), null);
  });
});

describe("markdownAlternateHref", () => {
  it("returns an absolute URL when siteUrl is valid (depth-independent)", () => {
    assert.equal(
      markdownAlternateHref("about.md", "https://x.com", true, "../"),
      "https://x.com/about.md",
    );
  });

  it("falls back to a depth-prefixed relative href when siteUrl is unset", () => {
    assert.equal(markdownAlternateHref("about.md", "", false, ""), "about.md");
    assert.equal(markdownAlternateHref("about.md", "", false, "../"), "../about.md");
  });

  it("falls back to the prefixed relative href if the absolute URL cannot be built", () => {
    assert.equal(markdownAlternateHref("about.md", "not a url", true, "../"), "../about.md");
  });
});
