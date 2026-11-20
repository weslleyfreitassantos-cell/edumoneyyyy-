# Tec Escola — release reconciliation (2026-11-20)

**Approved production baseline:** Cloudflare Worker edumoneyyyy version **1397**, version UUID **823c4b88-ec65-42c5-86a7-ec71c698c8b6**.

**Academic frontend:** https://admin.grupotec.dev.br and institutional subdomains.
The tecescola.grupotec.dev.br marketing domain is separate. The VPS hosts self-hosted Supabase and PostgreSQL, not the academic frontend.

## Important current drift
- The last GitHub main commit before reconciliation was 71c050a51730b323750310e438bc03c217d734df.
- The Cloudflare production bundle is index-CjGelLXm.js (1,001,585 bytes) and index-Ceeoq55P.css (177,623 bytes).
- A clean GitHub build produced index-BqOJtWNV.js (981,814 bytes) and index-AIfAwvoJ.css (178,660 bytes).
- Those packages are NOT byte-identical. This alone does not prove UI regressions.
- Public login smoke tests passed on both, but authenticated modules and institutional branding are not yet fully validated.
- PR #484 removes only the orphan submodule entry blocking automatic Cloudflare Builds. Its CI passed.
- Merging PR #484 into main could trigger auto-publication of a different frontend. Keep it in draft until the approved production behavior is reconciled.

## How to verify, without changing production
1. In an isolated, current branch, build with reviewed public Cloudflare VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY values.
2. Run: node scripts/release/compare-production-assets.mjs
3. Read the SHA-256 comparison of the local dist HTML entrypoints against the live JS and CSS. Use --strict to return a non-zero exit code if different.
4. Investigate a difference; do not overwrite the live bundle to force matching. Confirm institutional branding, login and role-restricted interfaces using authorized pilot accounts.
5. Only after approval, merge a reviewed commit, observe Cloudflare auto-deploy, and record the exact Git SHA associated with the release.
6. Review database migrations and Edge Functions on the VPS in a separate production change.

**Operational rule:** no direct Wrangler deploy, no reset/force-push of teammates' local work, no blind backend migration, no assumption that the historical colleague frozen version supersedes Cloudflare 1397.

Local historical evidence was saved on the connected computer under Documents/Projetos/TecEscola-Cloudflare-Baseline-20261120. This is a partial public asset snapshot, not the original React source.
