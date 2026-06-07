# Theme Update Apply Workflow

## Flow
- [[Projects System]] or [[Themes System]] checks update status.
- [[Theme Update Service]] compares versions.
- Project-owned [[Theme Package]] files are updated according to eligibility rules.
- [[Theme Settings]] are merged.
- [[Media Usage Service]] refreshes usage after structural changes.
- [[Project Metadata]] records applied version.

## Depends On
- [[Theme Updates]]
- [[Project Identity]]
- [[Filesystem Content]]

## Source
- `server/services/themeUpdateService.js`
- `docs-llms/theme-updates.md`

