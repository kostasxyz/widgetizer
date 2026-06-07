# Media Upload Workflow

## Flow
- [[Media Library]] submits files.
- Server validates size and MIME type.
- Images are processed into configured variants.
- [[Uploaded Assets]] are written.
- [[Media Metadata]] is written to [[SQLite Metadata]].

## Depends On
- [[App Settings]]
- [[Theme Package]]
- [[Media Metadata]]
- [[Uploaded Assets]]

## Related
- [[File Assets]]
- [[Media Usage]]

## Source
- `server/controllers/mediaController.js`
- `src/hooks/useMediaUpload.js`
- `docs-llms/core-media.md`

