# Project Import Export Workflow

## Owns
- Project ZIP import/export.
- Serialized metadata transfer.
- Restoring media metadata into [[SQLite Metadata]].
- Remapping project and page references during duplication/import.

## Depends On
- [[Projects System]]
- [[Project Identity]]
- [[Filesystem Content]]
- [[Media Metadata]]
- [[Media Usage]]
- [[Link Resolution]]

## Related
- [[Static Export Workflow]]
- [[Storage Boundary Risks]]

## Source
- `server/controllers/projectController.js`
- `server/utils/linkEnrichment.js`
- `docs-llms/core-projects.md`
- `docs-llms/core-database.md`

