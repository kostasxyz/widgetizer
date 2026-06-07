# Preview Morph Workflow

## Flow
- [[Widget Edit Workflow]] changes editor state.
- [[Preview System]] sends immediate setting messages to [[Preview Runtime]].
- Debounced render calls ask [[Rendering Pipeline]] for changed widget HTML.
- [[Preview Runtime]] morphs the iframe DOM and loads newly enqueued assets.

## Depends On
- [[Widget Store]]
- [[Preview Queries]]
- [[Rendering Service]]
- [[Liquid Tags and Filters]]

## Source
- `src/components/pageEditor/PreviewPanel.jsx`
- `src/queries/previewManager.js`
- `src/utils/previewRuntime.js`

