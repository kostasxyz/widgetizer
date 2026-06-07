# Coupling Hotspots

## High Fan-In Hubs
- [[Rendering Service]] depends on pages, menus, collections, media, theme settings, Liquid tags, and project identity.
- [[Save Store]] coordinates page content, global widgets, theme settings, media cache invalidation, and project mismatch protection.
- [[Project Controller]] touches project creation, theme copying, presets, media seeding, collections, import/export, and theme updates.
- [[Theme Controller]] handles source themes, runtime snapshots, presets, uploads, project theme settings, and deletion rules.

## Watch Areas
- [[Link Resolution]] appears in widget settings, menu items, collection items, export depth prefixing, and page deletion cleanup.
- [[Media Usage]] is updated by page saves, global widgets, collections, theme settings, imports, duplication, and theme updates.
- [[Project Identity]] bridges UUID API contracts with folder-name filesystem paths.

## Useful Next Graph Questions
- Which nodes depend on both [[Filesystem Content]] and [[SQLite Metadata]]?
- Which workflows write to [[Media Usage]] indirectly?
- Which controllers are doing service-like work?

