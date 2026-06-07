# Link Resolution

## Owns
- Resolving page UUIDs to current slugs.
- Clearing dead page references.
- Prefixing internal links by export depth.
- Menu active-state canonical paths.
- Project duplication/import reference remapping.

## Depends On
- [[Page JSON]]
- [[Menu JSON]]
- [[Collection Item]]
- [[Rendering Pipeline]]

## Used By
- [[Menus System]]
- [[Collections System]]
- [[Rendering Service]]
- [[Export System]]
- [[Project Import Export Workflow]]

## Review Signal
This logic appears in runtime rendering and storage cleanup, so it is a strong refactor candidate if behavior drifts.

## Source
- `server/services/renderingService.js`
- `server/utils/linkPrefixer.js`
- `server/utils/linkEnrichment.js`
- `docs-llms/core-collections.md`

