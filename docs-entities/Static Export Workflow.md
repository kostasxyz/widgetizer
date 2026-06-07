# Static Export Workflow

## Flow
- [[Export System]] starts an export.
- [[Rendering Pipeline]] renders headers, pages, widgets, layouts, and collection item pages in publish mode.
- [[Uploaded Assets]] and theme assets are copied.
- [[Link Resolution]] rewrites depth-sensitive paths.
- [[Export History]] records the version.
- Developer mode may write an HTML issues report.

## Depends On
- [[App Settings]]
- [[Media Metadata]]
- [[Theme Package]]
- [[Collection Item Export Workflow]]

## Source
- `server/controllers/exportController.js`
- `docs-llms/core-export.md`

