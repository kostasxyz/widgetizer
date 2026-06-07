# Rendering Service

## Owns
- `renderWidget`.
- `renderPageLayout`.
- `renderLiquidTemplate`.
- `createBaseRenderContext`.
- Cached Liquid engines.
- Shared render globals.

## Depends On
- [[Project Identity]]
- [[Media Metadata]]
- [[Collection Service]]
- [[Theme Settings]]
- [[Liquid Tags and Filters]]
- [[Link Resolution]]

## Used By
- [[Preview System]]
- [[Export System]]
- [[Rendering Pipeline]]

## Review Signal
This is one of the densest dependency hubs in the app.

## Source
- `server/services/renderingService.js`

