# Rendering Pipeline

## Owns
- Liquid engine configuration.
- Widget rendering.
- Page layout rendering.
- Base render context.
- Asset enqueue globals.
- Link and menu resolution during render.

## Depends On
- [[Rendering Service]]
- [[Theme Package]]
- [[Theme Settings]]
- [[Page JSON]]
- [[Global Widget JSON]]
- [[Menu JSON]]
- [[Media Metadata]]
- [[Collection Service]]
- [[Liquid Tags and Filters]]
- [[Sanitization Service]]

## Used By
- [[Preview System]]
- [[Export System]]
- [[Collection Filter]]

## Source
- `server/services/renderingService.js`
- `docs-llms/core-architecture.md`
- `docs-llms/theming.md`

