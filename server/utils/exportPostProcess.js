/**
 * Depth-aware export post-processing helpers (Collections spec Section 6).
 *
 * Shared by the page export loop (outputPathPrefix "") and the collection
 * item-page export loop (outputPathPrefix "../"), so both rewrite raw storage
 * paths and emit markdown alternate links correctly for their output depth.
 */

/**
 * Rewrite any remaining raw `/uploads/` storage paths to their published asset
 * locations, depth-aware. Dedicated tags already resolve paths via context, so
 * this is the safety net for raw paths pasted into generic link/text fields.
 * @param {string} html
 * @param {string} outputPathPrefix - "" at the export root, "../" one level deep
 * @returns {string}
 */
export function rewriteStoragePaths(html, outputPathPrefix = "") {
  if (typeof html !== "string") return html;
  return html
    .replaceAll("/uploads/images/", `${outputPathPrefix}assets/images/`)
    .replaceAll("/uploads/files/", `${outputPathPrefix}assets/files/`);
}

/**
 * Build the href for a page/item's markdown alternate link. Uses an absolute
 * URL when the project's siteUrl is valid; otherwise falls back to a
 * depth-prefixed relative href.
 * @param {string} mdFilename - e.g. "about.md" or "project-alpha.md"
 * @param {string} siteUrl
 * @param {boolean} validSiteUrl
 * @param {string} outputPathPrefix - "" at the export root, "../" one level deep
 * @returns {string}
 */
export function markdownAlternateHref(mdFilename, siteUrl, validSiteUrl, outputPathPrefix = "") {
  if (validSiteUrl) {
    try {
      return new URL(mdFilename, siteUrl).href;
    } catch {
      // fall through to the relative form
    }
  }
  return `${outputPathPrefix}${mdFilename}`;
}
