/**
 * Atomic filesystem helper test suite (Collections spec Section 15).
 *
 * writeJsonAtomic writes to a UUID-suffixed tmp file then renames, so readers
 * never observe a partial write and concurrent writes never collide on a shared
 * tmp name. isAtomicTmpFile is the reader-side filter that hides orphan tmps.
 *
 * Run with: node --test server/tests/atomicFs.test.js
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import path from "path";
import os from "os";

import { writeJsonAtomic, isAtomicTmpFile } from "../utils/atomicFs.js";

const TMP_ROOT = path.join(os.tmpdir(), `widgetizer-atomicfs-test-${Date.now()}`);

before(async () => {
  await fs.ensureDir(TMP_ROOT);
});
after(async () => {
  await fs.remove(TMP_ROOT);
});

/** List leftover tmp files in a directory. */
async function tmpFilesIn(dir) {
  const names = await fs.readdir(dir);
  return names.filter((n) => n.endsWith(".tmp"));
}

describe("writeJsonAtomic", () => {
  it("writes JSON to the target and leaves no tmp file behind", async () => {
    const target = path.join(TMP_ROOT, "basic.json");
    await writeJsonAtomic(target, { hello: "world", n: 1 });

    assert.deepEqual(await fs.readJSON(target), { hello: "world", n: 1 });
    assert.deepEqual(await tmpFilesIn(TMP_ROOT), []);
  });

  it("overwrites an existing target atomically", async () => {
    const target = path.join(TMP_ROOT, "overwrite.json");
    await writeJsonAtomic(target, { v: 1 });
    await writeJsonAtomic(target, { v: 2 });
    assert.deepEqual(await fs.readJSON(target), { v: 2 });
  });

  it("handles concurrent writes to the same target without collision (last write wins)", async () => {
    const dir = path.join(TMP_ROOT, "concurrent");
    await fs.ensureDir(dir);
    const target = path.join(dir, "item.json");

    const payloads = Array.from({ length: 12 }, (_, i) => ({ writer: i }));
    // All concurrent — a shared `${filepath}.tmp` would throw EEXIST under the
    // wx flag, or clobber another writer's staging file.
    await assert.doesNotReject(Promise.all(payloads.map((p) => writeJsonAtomic(target, p))));

    const final = await fs.readJSON(target);
    assert.ok(
      payloads.some((p) => p.writer === final.writer),
      `final ${JSON.stringify(final)} must equal one of the writers`,
    );
    assert.deepEqual(await tmpFilesIn(dir), [], "no orphan tmp files after concurrent writes");
  });

  it("rejects when the target directory does not exist and leaves nothing behind", async () => {
    const missingDir = path.join(TMP_ROOT, "does-not-exist");
    const target = path.join(missingDir, "x.json");
    await assert.rejects(writeJsonAtomic(target, { a: 1 }));
    assert.equal(await fs.pathExists(missingDir), false);
  });
});

describe("isAtomicTmpFile", () => {
  it("matches a UUID-suffixed tmp filename", () => {
    assert.equal(isAtomicTmpFile("item.json.3f2504e0-4f89-41d3-9a0c-0305e82c3301.tmp"), true);
    assert.equal(isAtomicTmpFile("_order.json.3f2504e0-4f89-41d3-9a0c-0305e82c3301.tmp"), true);
  });

  it("does not match normal data files", () => {
    assert.equal(isAtomicTmpFile("item.json"), false);
    assert.equal(isAtomicTmpFile("_order.json"), false);
    assert.equal(isAtomicTmpFile("schema.json"), false);
  });

  it("does not match a non-UUID .tmp file", () => {
    assert.equal(isAtomicTmpFile("item.json.tmp"), false);
    assert.equal(isAtomicTmpFile("random.tmp"), false);
  });
});
