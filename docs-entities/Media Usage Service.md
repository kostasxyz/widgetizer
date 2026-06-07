# Media Usage Service

## Owns
- Extracting media paths from pages, globals, collections, and theme settings.
- Updating media usage rows.
- Refreshing all usage after structural changes.
- Removing usage for deleted content.

## Depends On
- [[Media Metadata]]
- [[Media Usage]]
- [[Page JSON]]
- [[Global Widget JSON]]
- [[Collection Item]]
- [[Theme Settings]]

## Used By
- [[Pages System]]
- [[Collections System]]
- [[Media Library]]
- [[Theme Updates]]
- [[Project Import Export Workflow]]

## Source
- `server/services/mediaUsageService.js`

