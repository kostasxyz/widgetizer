/**
 * Atomic JSON writes (Collections spec Section 15).
 *
 * Write to a UUID-suffixed tmp file in the same directory, then rename onto the
 * target. Rename is atomic on Linux/macOS and (same-volume) Windows, so a reader
 * sees either the old file or the new one — never a half-written file. The
 * unique tmp suffix means concurrent writes to the same target each get their
 * own private staging file instead of colliding on a shared `${filepath}.tmp`.
 */

import fs from "fs-extra";
import { randomUUID } from "node:crypto";

// Matches a tmp file produced by writeJsonAtomic: "<name>.<uuid-v4>.tmp".
// Readers (e.g. listCollectionItems) use this to hide orphan tmps left by a
// process that died after creating the tmp but before the rename.
const ATOMIC_TMP_RE =
  /\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.tmp$/i;

/**
 * @param {string} filename - a bare filename or path
 * @returns {boolean} true if it is an atomic-write tmp file
 */
export function isAtomicTmpFile(filename) {
  return ATOMIC_TMP_RE.test(filename);
}

/**
 * Atomically write `data` as pretty-printed JSON to `filepath`.
 * The target directory must already exist.
 *
 * @param {string} filepath - destination file path
 * @param {*} data - JSON-serializable value
 * @returns {Promise<void>}
 */
export async function writeJsonAtomic(filepath, data) {
  const serialized = JSON.stringify(data, null, 2);
  const tmpPath = `${filepath}.${randomUUID()}.tmp`;

  try {
    // "wx" fails if tmpPath somehow already exists (guards an unlucky UUID clash).
    await fs.writeFile(tmpPath, serialized, { flag: "wx" });
    await fs.rename(tmpPath, filepath);
  } finally {
    // After a successful rename the tmp is gone (no-op); on any error this
    // removes the orphan staging file so tmps never leak.
    await fs.remove(tmpPath).catch(() => {});
  }
}
