/**
 * menuResolver — shared menu-setting resolution used by widget rendering and
 * collection-item rendering (finding #10).
 *
 * Run with: node --test server/tests/menuResolver.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveMenuSettings, schemaHasMenuSetting } from "../services/menuResolver.js";

const schemaSettings = [
  { type: "text", id: "title" },
  { type: "menu", id: "nav" },
];

function freshMenuMaps() {
  const menu = {
    uuid: "menu-1",
    name: "Main",
    items: [
      { pageUuid: "uuid-about", label: "About" },
      { link: "https://x.com", label: "X" },
      { link: "javascript:alert(1)", label: "Evil" },
    ],
  };
  return { byUuid: new Map([["menu-1", menu]]), bySlug: new Map([["main", menu]]) };
}
const pagesByUuid = new Map([["uuid-about", { uuid: "uuid-about", slug: "about" }]]);

describe("schemaHasMenuSetting", () => {
  it("is true only when a menu-type setting exists", () => {
    assert.equal(schemaHasMenuSetting({ settings: schemaSettings }), true);
    assert.equal(schemaHasMenuSetting({ settings: [{ type: "text", id: "t" }] }), false);
    assert.equal(schemaHasMenuSetting({}), false);
    assert.equal(schemaHasMenuSetting(null), false);
  });
});

describe("resolveMenuSettings", () => {
  it("resolves a menu uuid to a menu object: depth-prefixed link + un-prefixed canonicalPath", () => {
    const settings = { title: "T", nav: "menu-1" };
    resolveMenuSettings(settings, schemaSettings, { menuMaps: freshMenuMaps(), pagesByUuid, outputPathPrefix: "../" });
    assert.equal(typeof settings.nav, "object");
    assert.equal(settings.nav.items[0].link, "../about.html");
    assert.equal(settings.nav.items[0].canonicalPath, "about.html");
    assert.equal(settings.nav.items[1].link, "https://x.com"); // external untouched
    assert.equal(settings.nav.items[2].link, ""); // dangerous protocol stripped
    assert.equal(settings.title, "T"); // non-menu setting untouched
  });

  it("falls back to slug-based lookup", () => {
    const settings = { nav: "main" };
    resolveMenuSettings(settings, schemaSettings, { menuMaps: freshMenuMaps(), pagesByUuid });
    assert.equal(settings.nav.items[0].link, "about.html");
  });

  it("empty value or unknown menu yields { items: [] }", () => {
    const empty = { nav: "" };
    resolveMenuSettings(empty, schemaSettings, { menuMaps: freshMenuMaps(), pagesByUuid });
    assert.deepEqual(empty.nav, { items: [] });

    const unknown = { nav: "nope" };
    resolveMenuSettings(unknown, schemaSettings, { menuMaps: freshMenuMaps(), pagesByUuid });
    assert.deepEqual(unknown.nav, { items: [] });
  });

  it("no-ops when the schema declares no menu settings", () => {
    const settings = { title: "T", nav: "menu-1" };
    resolveMenuSettings(settings, [{ type: "text", id: "title" }], { menuMaps: freshMenuMaps(), pagesByUuid });
    assert.equal(settings.nav, "menu-1"); // untouched — nav isn't a menu in this schema
  });

  it("no-ops without menuMaps (back-compat)", () => {
    const settings = { nav: "menu-1" };
    resolveMenuSettings(settings, schemaSettings, { pagesByUuid });
    assert.equal(settings.nav, "menu-1");
  });
});
