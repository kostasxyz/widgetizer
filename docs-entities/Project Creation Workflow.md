# Project Creation Workflow

## Flow
- [[Projects System]] collects project info.
- [[Theme Presets]] may provide starter templates, menus, media, and settings overrides.
- [[Theme Package]] is copied into project-owned files.
- [[Project Metadata]] is written to [[SQLite Metadata]].
- [[Filesystem Content]] receives pages, menus, globals, theme files, and uploaded starter assets.

## Depends On
- [[Project Identity]]
- [[Themes System]]
- [[Theme Presets]]
- [[Media Metadata]]
- [[Collection Schema]]

## Source
- `server/controllers/projectController.js`
- `docs-llms/core-projects.md`
- `docs-llms/theme-presets.md`

