# Dependency security audit — 2026-09

## Result

- Baseline (`npm ci`, 2026-09-24): 13 npm audit findings (10 high, 3 moderate); production-only audit: 3 high.
- After targeted compatible updates: 1 high finding remains; production-only audit: 1 high. No moderate or critical findings remain.
- `npm audit fix --force` was not used. The lockfile updates remove every baseline finding except the two SheetJS advisories on `xlsx`.

## Findings and classification

| Finding | Class and dependency path | Installed → resolved | Reachability / decision |
| --- | --- | --- | --- |
| `@vitest/mocker` — moderate; `2.1.0–4.1.10` | Transitive dev: `vitest` → `@vitest/mocker` | 4.1.10 → 4.1.11 | Test-runner file access only; fixed with Vitest patch. |
| `baseline-browser-mapping` — moderate; `>=2.0.0 <2.11.0` | Transitive dev: Babel/plugin-react → Browserslist → mapping | 2.10.42 → 2.11.25 | Build-time browser-support data; fixed. |
| `browserslist` — high; `<=4.28.6` | Transitive dev: Babel/plugin-react → Browserslist | 4.28.5 → 4.29.0 | Build-time target resolution; fixed. |
| `miniflare` — high; `4.20250508.3–5.20260801.0-alpha` | Transitive dev: `wrangler` → `miniflare` | 4.20260714.0 → 5.20260921.0-alpha | Local Worker tooling only; fixed through Wrangler's dependency update. This is a transitive major/pre-release transition and is explicitly called out for reviewer validation. |
| `nanoid` — high; `<=3.3.17` | Transitive dev: Vite/PostCSS build chain → `nanoid` | 3.3.15 → 3.3.19 | Build-time identifier generation; fixed. |
| `postcss` — high; `<=8.5.22` | Transitive dev: Vite/Tailwind → PostCSS | 8.5.16 → 8.5.28 | CSS build processing; fixed. |
| `react-router` — high; `7.12.0–7.18.1` | Transitive production: `react-router-dom` → `react-router` | 7.18.1 → 7.18.4 | Client-side router; the advisory concerns RSC actions, which this SPA does not expose; patched anyway. |
| `react-router-dom` — high; `7.12.0-pre.0–7.18.1` | Direct production dependency | 7.18.1 → 7.18.4 | Used by application routes/navigation; patched within major version 7. |
| `sharp` — high; `<=0.35.4-rc.0` | Transitive dev: `wrangler` → `miniflare` → `sharp` | 0.34.5 → 0.35.4 | Local Worker tooling only; patched by the Miniflare dependency update. |
| `undici` — high; `7.0.0–7.28.0` | Transitive dev: `jsdom` and `miniflare` → `undici` | 7.28.0 → 7.29.0 | Node-side test/Worker tooling, not browser runtime; fixed. |
| `vitest` — moderate; `2.1.0-beta.1–4.1.10` | Direct dev dependency | 4.1.10 → 4.1.11 | Test runner only; fixed in patch release. |
| `wrangler` — high; `4.16.0–4.113.0` | Direct dev dependency; advisory path through Miniflare | 4.112.0 → 4.137.0 | Worker build/deployment CLI only; fixed within major version 4. No command deployed or contacted Cloudflare. |
| `xlsx` — high; `<0.19.3` and `<0.20.2` | Direct production dependency | 0.18.5 → no safe registry fix | Reachable in browser spreadsheet import/export; retained and documented below because npm reports no fix and replacing it changes supported `.xls` behavior. |

## Residual: `xlsx@0.18.5`

`xlsx` is a direct production dependency dynamically used by `src/services/spreadsheetImportService.ts` to parse user-selected `.xls`/`.xlsx` files and to create downloadable templates. npm reports `fixAvailable: false` for both high-severity advisories: prototype pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS (GHSA-5pgg-2g8v-p4x9). It is therefore reachable in the browser when a user imports a spreadsheet, not an unused or test-only dependency. No replacement was introduced: the package supports both legacy `.xls` and `.xlsx`, and switching libraries would be a behavior-changing migration requiring import/export equivalence tests. Track a separate migration or maintained distribution review; do not treat the residual as fixed.
