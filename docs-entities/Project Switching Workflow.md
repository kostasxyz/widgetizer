# Project Switching Workflow

## Flow
- [[Project Store]] changes active project.
- [[Active Project Context]] updates API scoping.
- [[Frontend App]] invokes project switch coordination.
- [[Page Store]], [[Widget Store]], [[Theme Store]], and [[Save Store]] reset project-scoped state.
- [[Workspace Shell]] remounts the route subtree.

## Depends On
- [[Project Identity]]
- [[Require Active Project]]

## Review Signal
This protects against stale singleton state and cross-project saves.

## Source
- `src/App.jsx`
- `src/lib/projectSwitchCoordinator.js`
- `docs-llms/core-projects.md`

