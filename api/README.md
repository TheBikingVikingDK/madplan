# API integration plan

`GET /api/import?url=https://sundpaabudget.dk/...` extracts schema.org Recipe JSON-LD from a single recipe URL. Restricts outbound host to sundpaabudget.dk, enforces HTTPS, timeout and response-size limit.

The next phase is a server-side eTilbudsavis adapter. Do not store account credentials in client code. Before writing, fetch existing list entries, normalize matching names and units, show a preview and require confirmation. Never silently delete or overwrite existing items. The third-party Home Assistant implementation is an API reference, not an official supported contract.
