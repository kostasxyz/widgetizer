# Storage Boundary Risks

## Boundary
- [[SQLite Metadata]] owns metadata.
- [[Filesystem Content]] owns content and binaries.

## Watch Points
- [[Project Import Export Workflow]] serializes and restores metadata across the boundary.
- [[Media Library]] stores binaries on disk but metadata and usage in SQLite.
- [[Theme Updates]] modifies project-owned theme files and then refreshes usage.
- [[Rendering Pipeline]] reads both metadata and filesystem content.
- [[Project Identity]] translates UUID to folder name.

## Review Questions
- Is every filesystem path derived from a validated project UUID?
- Are relationship updates transactional where they touch SQLite?
- Are filesystem writes atomic where partial writes matter?

