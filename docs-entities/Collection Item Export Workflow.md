# Collection Item Export Workflow

## Flow
- [[Export System]] reads enabled [[Collection Schema]] definitions.
- [[Collection Service]] lists items and prepares item render context.
- [[Rendering Pipeline]] renders item templates and layout.
- [[Link Resolution]] prefixes nested paths.
- [[Export System]] writes item HTML under the slug prefix.

## Depends On
- [[Collection Item]]
- [[Collection Filter]]
- [[Static Export Workflow]]

## Source
- `server/controllers/exportController.js`
- `server/services/collectionService.js`
- `docs-llms/core-collections.md`
- `docs-llms/core-export.md`

