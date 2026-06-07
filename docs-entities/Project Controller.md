# Project Controller

## Owns
- Project HTTP handlers.
- Project creation, update, deletion, duplication, import, and export handoff.
- Active project handlers.
- Preset seeding.
- Theme update project endpoints.

## Depends On
- [[Projects System]]
- [[Project Identity]]
- [[Theme Presets]]
- [[Theme Updates]]
- [[Media Usage Service]]
- [[Collection Service]]
- [[Link Resolution]]
- [[Repositories]]

## Review Signal
This controller is a high-coupling node and may hide service responsibilities.

## Source
- `server/controllers/projectController.js`

