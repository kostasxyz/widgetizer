# Project Identity

## Owns
- UUID as API identity.
- `folderName` as filesystem identity.
- Rename behavior that preserves UUID.

## Depends On
- [[Project Metadata]]
- [[Filesystem Content]]

## Used By
- [[Projects System]]
- [[Media Library]]
- [[Rendering Pipeline]]
- [[Export System]]
- [[Project Import Export Workflow]]

## Review Signal
This is a key boundary: API routes should not silently fall back to folder paths when a UUID is required.

## Source
- `docs-llms/core-project-id-architecture.md`
- `server/utils/projectHelpers.js`
- `server/db/repositories/projectRepository.js`

