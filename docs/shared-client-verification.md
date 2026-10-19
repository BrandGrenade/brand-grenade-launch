# Shared client verification

The Hub calls the existing access point using its existing `hub_tools` key:

```json
{"request":"list_clients","params":{}}
```

The standard response envelope has `content_status: "structured"` and `content.clients`, an array of `{bg_client_id, hub_client_id, name, created_at}`. An unmapped BG-created client has `hub_client_id: null`.

```json
{"request":"ensure_client","params":{"hub_client_id":"hub-client-reference","name":"Marlowe Motor Company"}}
```

The standard response envelope has `content_status: "structured"` and `content.client` with the same four fields. Existing mappings retain their original client and name; identical names never merge clients. Both requests are restricted to `hub_tools` and cannot read or start runs.

After ensuring, the Hub opens an existing Room with `?client=<hub-client-reference>`. No name or job is required in the URL. Arrival performs lookup only. Unknown arrivals block the Room with the prescribed syncing message and Retry. Existing source inheritance takes precedence over arrival context.

## Automated checks

Final results: 184/184 application tests in 37 files; 35/35 isolated SQL checks; access-handler-to-SQL concurrent integration passed. Preview build reports OK. Security scan has five pre-existing warnings, no critical findings.

- Full application suite, including source-handler creation checks for Strategy, Intelligence, Briefing, saved briefs and Synthesiser.
- Automated UI interactions: unknown arrival blocks starts, Retry releases after sync, exact-project admin attachment, partner control absence.
- Isolated PostgreSQL checks: client-only links on all six run tables, Creative Engine inheritance, existing source inheritance, no name matching, once-only admin attachment, unchanged brief/document content and browser link-field protections.
- Access-handler-to-SQL integration: ten concurrent ensures produce one client, repeated ensure never renames, list returns it, no run reads, twelve requests logged.

To reproduce database checks, use an **empty disposable database only**. The fixture contains reduced run tables, not the entire production schema:

```text
psql <isolated-database> -v ON_ERROR_STOP=1 \
  -f scripts/shared-clients-fixture.sql \
  -f drizzle/migrations/0019_shared_hub_clients.sql \
  -f drizzle/migrations/0020_preserve_hub_trigger_execution.sql \
  -f scripts/test-shared-clients.sql
bun scripts/test-shared-client-access.ts postgresql://user@localhost:port/database
bunx vitest run
```

Production database suites remain deferred. No live walkthrough, production run creation, key modification or real Hub sync was performed during this change.