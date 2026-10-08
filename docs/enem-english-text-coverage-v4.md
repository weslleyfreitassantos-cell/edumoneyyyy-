# ENEM English Text Coverage

This note is separate from the `structured-text-only-v4` publication gate.
English remains unavailable until a complete provider-text pool is available.
No visual or PDF fallback is allowed to fill this gap.

## Current audit

- Raw provider records: 2,740.
- Unique provider records after deterministic de-duplication: 2,689.
- Unique records with `language = ENGLISH`: 0.
- Unique records with `language = SPANISH`: 61.
- Unique records without a foreign-language marker: 2,628.
- Current English practice availability: zero, intentionally.

The current provider JSON endpoint is the only source currently wired into the
text-only corpus:

`https://api.enem.dev/v1/exams/{year}/questions/{index}`

Its cached payloads are kept under `.runtime/enem-structured-text-v1/raw/` and
are not themselves a publication decision. Each future English record must
still provide the full context or self-contained prompt, alternatives A-E, a
provider answer, and no required media.

## Possible future sources

### JSON

- Extend or replace the provider JSON feed with records that explicitly mark
  English and include the complete question payload.
- Prefer a first-party JSON export when it carries provenance, answer status,
  and all five alternatives. Validate it with the same v4 integrity rules.

### HTML

- An official or provider HTML corpus could be considered if it preserves the
  complete question text, alternatives, answer provenance, and language
  metadata in a stable, parseable structure.
- No HTML source is currently verified or admitted by v4.

### Markdown

- A first-party or provider-maintained Markdown export could be considered if
  it preserves the same fields and provenance without replacing content with
  image links.
- No Markdown source is currently verified or admitted by v4.

The source investigation, acquisition, parsing, and approval of English
content belong to a future campaign. They must not weaken the v4 integrity
criteria or block valid Portuguese, Spanish, Mathematics, Humanities, and
Natureza practices.
