# Collection Service

## Owns
- Collection schema validation.
- Item normalization.
- Item CRUD.
- Atomic item writes.
- Item ordering.
- Render-time item preparation.
- Collection item page data.

## Depends On
- [[Collection Schema]]
- [[Collection Item]]
- [[Link Resolution]]
- [[Sanitization Service]]
- [[Filesystem Content]]

## Used By
- [[Collections System]]
- [[Rendering Pipeline]]
- [[Export System]]
- [[Theme Upload Workflow]]
- [[Project Creation Workflow]]

## Source
- `server/services/collectionService.js`

