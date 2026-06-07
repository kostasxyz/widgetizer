# Page Load Workflow

## Flow
- [[Page Editor]] asks [[Page Store]] to load page data.
- [[Page Store]] reads [[Page JSON]] through [[Page Queries]].
- [[Page Store]] loads [[Global Widget JSON]] through [[Preview Queries]].
- [[Theme Store]] loads canonical [[Theme Settings]].
- [[Widget Store]] loads available widget schemas.
- [[Preview System]] requests initial HTML.

## Depends On
- [[Active Project Context]]
- [[Rendering Pipeline]]

## Source
- `src/stores/pageStore.js`
- `src/pages/PageEditor.jsx`
- `docs-llms/core-page-editor.md`

