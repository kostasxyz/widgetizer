# Test Surface

## Owns
- Backend tests through Node test runner.
- Frontend unit tests through Vitest.
- Coverage around rendering, collections, media, export, themes, project mismatch, link prefixing, and sanitization.

## Depends On
- [[Server Routes]]
- [[Controllers]]
- [[Repositories]]
- [[Rendering Pipeline]]
- [[Media Usage Service]]
- [[Collection Service]]

## Review Signal
Graph hubs with many relationships should have tests close to their boundary behavior.

## Source
- `server/tests/*.test.js`
- `src/**/__tests__/`
- `package.json`

