# ENEM ingestion V1

The manifest is intentionally discovery-based. The official INEP catalog is the
source of truth for years and exam artifacts; the repository does not hard-code a
partial year list and does not manufacture questions when an artifact is absent.

An ingestion run must:

1. discover artifacts from the official catalog;
2. record year, exam, application, day, source URL and a SHA-256 artifact hash;
3. parse official statement/options/gabarito fields without mixing derived labels;
4. validate every reference with `assertOfficialEnemReference`;
5. write only global `ENEM` question-bank rows and explicit skill links;
6. keep subject, topic, difficulty and skill mapping in TecEscola-derived metadata.

`manifest.v1.json` is the reproducible handoff point. It contains only reviewed
official artifacts. A committed `artifactHash` is acceptable when the source
PDF is intentionally kept outside Git; the hash still identifies the exact
official artifact used to review the imported rows.

## Normalizing a verified batch

After downloading an official artifact and preparing a reviewed JSON array of
question rows, add an entry with `artifactPath` and `questionsPath` (both
relative to the manifest file), or use a verified `artifactHash` when the
artifact is kept outside Git. Then run:

```bash
npm run enem:ingest -- --manifest tools/enem/manifest.local.json --out .runtime/enem-normalized.json
```

The command verifies HTTPS official-domain references, computes or verifies the
artifact SHA-256, rejects duplicate manifest keys, preserves official
provenance, and emits normalized question rows with TecEscola-derived
classification kept separate. An empty manifest produces an empty batch; the
command never fabricates questions or downloads from third-party sources.

## Discovering the official catalog

Discovery reads the INEP catalog and its year pages, pairs printed exam PDFs
with their official answer keys, and writes only URLs and provenance metadata.
It does not download PDFs or create question rows:

```bash
npm run enem:discover -- --year 2025 --out .runtime/enem-discovery-2025.json
```

Without `--year`, all year pages exposed by the catalog are discovered. An
unpaired official PDF is reported in `issues` instead of being silently used.
The output is an input for a later reviewed download/parse step, not an import
batch by itself.

## Downloading and parsing a canary year

The downloader follows only URLs emitted by discovery, retries transient
transport failures, verifies the PDF magic header, and writes PDFs under
`.runtime` (which is not committed). Missing or broken official artifacts are
quarantined while valid pairs continue:

```bash
npm run enem:download -- \
  --discovery .runtime/enem-discovery-2025.json \
  --dir .runtime/enem/2025 \
  --out .runtime/enem-download-2025.json
```

The parser uses the official answer-key PDF only for `A`-`E`/`ANNULLED` states;
it never asks a model to decide an answer. Question text, options, page and
language are extracted conservatively. Items with uncertain layout, media or
missing options are `REVIEW_REQUIRED` and are not import-ready:

```bash
npm run enem:parse -- \
  --downloads .runtime/enem-download-2025.json \
  --out .runtime/enem-parsed-2025.json
npm run enem:canonicalize -- \
  --parsed .runtime/enem-parsed-2025.json \
  --out .runtime/enem-canonical-2025.json
```

Canonicalization collapses repeated booklet occurrences while preserving each
official occurrence and quarantining genuine cross-booklet conflicts. The
`20261003000500_enem_official_corpus_v1.sql` migration adds service-role-only
batch, occurrence and media provenance tables; it does not import content by
itself.

## Reviewing and importing a verified subset

The parser records explicit structural reasons instead of collapsing every
failure into a pedagogical review state:

```bash
npm run enem:review -- \
  --discovery .runtime/enem-discovery-2025.json \
  --downloads .runtime/enem-download-2025.json \
  --parsed .runtime/enem-parsed-2025.json \
  --canonical .runtime/enem-canonical-2025.json \
  --out .runtime/enem-review-report-2025.json
```

`SOURCE_INTEGRITY=VERIFIED` is independent from TecEscola-derived subject,
skill, difficulty, explanation and misconception enrichment. The importer
keeps the latter pending and disables adaptive evidence until a mapping is
available. It can first emit a deterministic four-area canary, then the full
verified subset:

```bash
npm run enem:import-sql -- --canary --out .runtime/enem-import-2025-canary.sql
npm run enem:import-sql -- --out .runtime/enem-import-2025.sql
```

The SQL is idempotent, provenance-preserving and intended for the existing
service-role VPS runbook. It imports annulled official items as inactive
provenance rows, excludes them from playable simulations, and never imports
items that remain `REVIEW_REQUIRED`.

The answer key is never granted to `authenticated`; server-side simulation
scoring reads it only inside the submit RPC. A historical exam is not published
as complete while an official booklet/key pair remains unavailable.
