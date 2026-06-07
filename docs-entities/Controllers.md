# Controllers

## Owns
- HTTP request handling.
- Validation result handling.
- Calls into services, repositories, and filesystem helpers.

## Depends On
- [[Server Routes]]
- [[Repositories]]
- [[Filesystem Content]]
- [[Project Identity]]

## Uses Services
- [[Rendering Service]]
- [[Media Usage Service]]
- [[Collection Service]]
- [[Theme Update Service]]
- [[Sanitization Service]]

## Review Signal
Some controllers, especially project/theme/export, are high-coupling nodes.

## Source
- `server/controllers/`

