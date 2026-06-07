# Data Ownership Map

## SQLite Owned
- [[SQLite Metadata]]
- [[Project Metadata]]
- [[Media Metadata]]
- [[Media Usage]]
- [[App Settings Data]]
- [[Export History]]

## Filesystem Owned
- [[Filesystem Content]]
- [[Page JSON]]
- [[Global Widget JSON]]
- [[Menu JSON]]
- [[Theme Package]]
- [[Theme Settings]]
- [[Collection Schema]]
- [[Collection Item]]
- [[Uploaded Assets]]

## Boundary Rule
[[Repositories]] own SQLite access. Controllers and services own filesystem content through path helpers and atomic writes.

## Risk Nodes
- [[Storage Boundary Risks]]
- [[Project Identity]]
- [[Project Import Export Workflow]]

