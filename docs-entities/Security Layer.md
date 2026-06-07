# Security Layer

## Owns
- Helmet configuration.
- Request validation.
- Error handling.
- Path safety.
- Sanitization boundaries.
- Autoescape assumptions.

## Depends On
- [[Sanitization Service]]
- [[Safe URL Filter]]
- [[Server Routes]]

## Used By
- [[Rendering Pipeline]]
- [[Media Library]]
- [[Export System]]
- [[Theme Upload Workflow]]
- [[Project Import Export Workflow]]

## Source
- `server/createApp.js`
- `server/middleware/`
- `server/utils/pathSecurity.js`
- `docs-llms/core-security.md`

