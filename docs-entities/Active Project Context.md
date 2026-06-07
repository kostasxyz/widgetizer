# Active Project Context

## Owns
- The current project identity on the frontend.
- API request scoping through `X-Project-Id`.
- Store reset coordination during project changes.

## Depends On
- [[Project Store]]
- [[Project Identity]]

## Used By
- [[apiFetch]]
- [[API Query Layer]]
- [[Require Active Project]]
- [[Project Switching Workflow]]
- [[Save Store]]

## Source
- `src/lib/activeProjectId.js`
- `src/lib/projectSwitchCoordinator.js`
- `src/App.jsx`

