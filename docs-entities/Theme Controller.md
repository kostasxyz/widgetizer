# Theme Controller

## Owns
- Theme HTTP handlers.
- Theme source metadata.
- Theme upload and deletion.
- Theme widget/template/preset reads.
- Project theme settings endpoints.
- Latest snapshot behavior.

## Depends On
- [[Themes System]]
- [[Theme Package]]
- [[Theme Presets]]
- [[Theme Updates]]
- [[Theme Locales]]
- [[Collection Service]]
- [[Sanitization Service]]
- [[Repositories]]

## Review Signal
This controller bridges source themes and project-owned theme state, so ownership boundaries should stay explicit.

## Source
- `server/controllers/themeController.js`

