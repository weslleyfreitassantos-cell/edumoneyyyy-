# Graphify Baseline

- Base SHA: `e550ad575f9d06e67f7b91d54501c3ed4216dbc7`
- Captured: 2026-09-25
- Tool: Graphify `0.9.67` (`graphifyy`), isolated Python virtualenv
- Mode: deterministic code-only extraction; no LLM/API calls
- SQL parsing: `graphifyy[sql]` with `tree-sitter-sql 0.3.11`
- Graph: 5,851 nodes, 12,831 edges, 372 communities
- Corpus scan: 697 code files; docs and image assets were skipped by code-only mode

Graphify is an index derived from source, not an authority for business rules. `EXTRACTED` describes parser-observed structure; `INFERRED` edges remain inferences. Authorization decisions below must be checked against executable code, migrations, and runtime tests.

## Main Subsystems

- Auth and role routing: `AuthContext`, `ProtectedRoute`, `permissions.ts`, `AdminPage`, and `Sidebar`.
- Tenant and institution context: `InstitutionContext`, current-institution hooks, subdomain resolution, and institution services.
- School-user lifecycle: `SchoolUsersTab`, school-user hooks/services, `invite-school-user`, and shared school-access helpers.
- Academic workflows: timetable generation/publication, attendance and class diary, academic calendar, assessments/grades, term closing, report cards, recovery, pedagogical monitoring, and class councils.
- Platform/account operations: account and institution lifecycle Edge Functions, account management UI, and shared authorization helpers.
- Finance: finance schema/services and administrative UI; maturity and tenant isolation still require explicit qualification.
- Camera/access: camera gateway, camera management UI, remote relay configuration, and local camera simulators; physical-device integration requires separate smoke evidence.
- Persistence and authorization: Supabase client services, migrations, RLS policies, SQL functions/triggers, local runtime tests, and Edge Functions.

## Hubs and Bridges

Highest-degree nodes included `vitest` (252 edges), `useAuth()` (127), `react` (102), `supabase` (86), `lucide-react` (85), and `useCurrentInstitution()` (81). These include framework/test hubs and are not all domain risks.

Cross-cutting bridges to review carefully are `useAuth`/`AuthContext`, institution context/current-institution resolution, `permissions.ts`, `supabaseClient`, shared Edge Function authorization helpers, and shared academic services such as attendance and academic-calendar services. Changes in these areas can affect multiple roles or tenants.

Graph traversals showed the invitation path connecting the school-user UI/hooks/services to `invite-school-user`, shared school-access helpers, and invitation tests. The attendance graph connects the service/hook/teacher and institutional panels with calendar, term-closing, report-card, and pedagogical consumers. The tenant graph links `InstitutionContext`, subdomain resolution, RLS migrations, Edge identity-protection helpers, and multi-tenant runtime fixtures. These are navigation clues; the graph does not prove that a policy is correct.

## Observed Risks and Limits

- Role and tenant enforcement spans client routing, service queries, RLS, RPCs, and Edge Functions; any single frontend path is insufficient evidence.
- The largest graph hubs include generic framework and test nodes. Review them with focused paths/queries rather than interpreting degree as a defect.
- One TypeScript file, `src/components/auth/AuthLayout.HEAD.tsx`, produced a Graphify parser syntax warning. It is tracked and TypeScript typecheck passed at baseline; inspect before relying on its graph coverage.
- The extraction was code-only. Documentation semantics and external production configuration were not parsed into this graph.

## Derived Artifact Fingerprints

Generated outputs are ignored by Git at `graphify-out/`; hashes make this exact baseline reproducible without versioning large derived files.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `graphify-out/GRAPH_REPORT.md` | 72,064 | `B8E820377621F483BD8961CB1460A2195FDAA6ABF78FBFAB270182C3E07E3B4C` |
| `graphify-out/graph.html` | 382,873 | `104C126DD782DEB69BAF50B6C01E90D15DD32D40D890076F7E1C1BBCA9E4717E` |
| `graphify-out/graph.json` | 7,709,222 | `ABD386D0CCBAC3F1734BF5D593AA301E3D144D904D67FF301035FAE5794FBD5F` |
