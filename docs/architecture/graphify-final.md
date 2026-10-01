# Graphify Final

- Base SHA: `e550ad575f9d06e67f7b91d54501c3ed4216dbc7`
- Captured: 2026-09-25
- Tool: Graphify `0.9.67` (`graphifyy`), isolated Python virtualenv
- Mode: deterministic code-only extraction; no LLM/API calls
- Final graph: 6,518 nodes, 13,501 edges, 439 communities
- Extraction: 98% extracted, 2% inferred (267 inferred edges; mean confidence 0.87)
- Code corpus: 708 files

## Comparison

| Measure | Baseline | Final | Delta |
| --- | ---: | ---: | ---: |
| Code files | 697 | 708 | +11 |
| Nodes | 5,851 | 6,518 | +667 |
| Edges | 12,831 | 13,501 | +670 |
| Communities | 372 | 439 | +67 |

The final Graphify pass re-extracted 547 previously uncached code files as well
as the 10 changed/new code files. The size increase therefore includes a broad
structural refresh and must not be attributed only to this campaign's changes.
The new campaign files cover spreadsheet-import hardening, production health
probes, gated browser smoke, read-only database inventory, and backup/restore
operations. The graph is a structural index and does not establish runtime
correctness, authorization, or deployment state.

## Hubs and Review Areas

Highest-degree nodes remain mostly framework and test abstractions: `vitest`
(253), `useAuth()` (129), `react` (102), `supabase` (86), `lucide-react` (85),
and `useCurrentInstitution()` (81). The dominant auth and tenant-context
bridges did not materially change from baseline. Those paths remain high-impact
review areas because UI, services, RLS, RPC, and Edge authorization intersect
there.

The final extraction still reports one parser warning in
`src/components/auth/AuthLayout.HEAD.tsx`; TypeScript typecheck passes. The
source is tracked and was not modified by this campaign. Inferred edges are
navigation hints only, not proof of policy behavior.

## Derived Artifact Fingerprints

Generated files remain ignored at `graphify-out/`.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `graphify-out/GRAPH_REPORT.md` | 97,634 | `41281FA520ED083F97E7BD777C6F1B48BC1004705065E5DA60B92DEFDA9FE336` |
| `graphify-out/graph.html` | 455,807 | `14812C392FFE817D73474EB96871755FBB27834E6ACED7D4A858901702D02D32` |
| `graphify-out/graph.json` | 8,344,398 | `5993F6798DA278D32D41C3E06AC5533D50EA8C36CD26712630FBDF59D658A89C` |
