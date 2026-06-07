# Widget Edit Workflow

## Flow
- [[Settings Renderer]] changes a setting.
- [[Widget Store]] updates widget or block state.
- [[Save Store]] marks unsaved changes.
- [[Preview System]] applies immediate setting messages and debounced morph requests.
- [[Rendering Pipeline]] renders changed widget HTML when needed.

## Depends On
- [[Page Editor]]
- [[Widget Schema]]
- [[Preview Morph Workflow]]

## Source
- `src/components/pageEditor/SettingsPanel.jsx`
- `src/stores/widgetStore.js`
- `src/components/pageEditor/PreviewPanel.jsx`

