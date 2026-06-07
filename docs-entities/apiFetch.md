# apiFetch

## Owns
- Shared fetch behavior.
- Error shaping.
- `X-Project-Id` injection through [[Active Project Context]].

## Depends On
- [[Active Project Context]]
- [[Frontend App]]

## Used By
- [[API Query Layer]]
- [[Media Library]]
- [[Theme Locales]]
- [[Settings Renderer]]

## Review Signal
This file exists partly to avoid a circular import between project state and query helpers.

## Source
- `src/lib/apiFetch.js`
- `src/lib/activeProjectId.js`

