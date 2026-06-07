# Theme Upload Workflow

## Flow
- [[Themes System]] accepts a ZIP.
- Server validates MIME/ZIP constraints.
- Theme metadata, widgets, locales, presets, and collection schemas are validated.
- Installed [[Theme Package]] becomes available for new projects.

## Depends On
- [[Theme Package]]
- [[Collection Service]]
- [[Sanitization Service]]
- [[Theme Locales]]

## Related
- [[Theme Presets]]
- [[Theme Updates]]

## Source
- `server/controllers/themeController.js`
- `src/pages/Themes.jsx`
- `docs-llms/core-themes.md`

