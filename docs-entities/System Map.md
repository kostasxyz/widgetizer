# System Map

## Core Shape
- [[Frontend App]] talks through [[API Query Layer]] to [[Server Routes]].
- [[Server Routes]] delegate to [[Controllers]].
- [[Controllers]] use [[Repositories]], [[Filesystem Content]], and domain services.
- [[Rendering Pipeline]] joins [[Theme Package]], [[Page JSON]], [[Global Widget JSON]], [[Media Metadata]], [[Menu JSON]], and [[Collection Item]] data.

## Major Product Systems
- [[Projects System]] owns the active site boundary.
- [[Page Editor]] edits [[Page JSON]], [[Global Widget JSON]], and [[Theme Settings]].
- [[Preview System]] renders live HTML through [[Rendering Pipeline]].
- [[Export System]] renders publish-mode HTML and copies assets.
- [[Themes System]] supplies [[Theme Package]], [[Theme Widgets]], [[Theme Presets]], and [[Theme Updates]].

## Review Focus
- [[Coupling Hotspots]]
- [[Duplication Candidates]]
- [[Storage Boundary Risks]]
- [[Test Surface]]
- [[Development Scripts]]
