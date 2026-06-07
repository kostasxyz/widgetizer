# Auto Save Workflow

## Flow
- [[Widget Store]] or [[Theme Store]] marks changes.
- [[Save Store]] resets a 60-second timer.
- Save runs guarded page/global writes first.
- Theme settings save runs through [[Theme Store]].
- Media cache invalidates because saved content can alter [[Media Usage]].

## Writes
- [[Page JSON]]
- [[Global Widget JSON]]
- [[Theme Settings]]
- [[Media Usage]]

## Risk
Project changes during editing trigger mismatch protection instead of writing to the wrong project.

## Source
- `src/stores/saveStore.js`

