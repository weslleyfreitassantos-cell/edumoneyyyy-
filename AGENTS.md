## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## TecEscola production database operations

- The TecEscola production VPS is `grupotec.vps-kinghost.net`, reachable through the authorized SSH alias `tecescola-vps`.
- For future TecEscola migration tasks, use the persistent production connection documented in `docs/operations/self-hosted-production-runbook.md` first. Do not request credentials or rediscover the connection while the documented preflight works.
- The authorized Compose credential source is `/srv/grupotec/supabase-projects/edumoney/.env` on the VPS, owned by `root:root` with mode `600`. It remains outside every Git checkout. Never print, copy, commit, or log its values.
- Run `bash scripts/db/production-connection.sh preflight` before production access. It validates the SSH/VPS identity, reads the Compose-rendered PostgreSQL password in memory, opens a loopback-only SSH tunnel, then performs SELECT-only checks for cluster identity, executor roles, permissions, and migration ledger. It writes no schema or data.
- For a migration, use `scripts/db/production-promote.sh`, which delegates to `scripts/db/promote-single-migration.sh`. Supply the exact per-migration target, reviewed commit/hash, predecessor, and authorization. Permanent connectivity is not permanent write authorization. Never use raw SQL, generic `supabase db push`, or `migration repair` to promote application migrations.
- The current VPS connection must report `session_user=supabase_admin` and `current_user=supabase_admin`; the `postgres` role is not the valid V12 executor on this cluster. Stop if the preflight identity/permission contract or ledger changes. Diagnose the actual role/owner contract; do not broaden table grants to make a migration pass.
