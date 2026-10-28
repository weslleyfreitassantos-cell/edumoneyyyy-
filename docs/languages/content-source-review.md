# Tec Idiomas: source and reuse review

This register distinguishes code licenses from the licenses attached to educational data. Every imported row must carry its own source URL, data license, stable source ID, and attribution where required. Audio is excluded unless its individual rights are recorded.

| Source | Data terms checked | Decision for this release |
| --- | --- | --- |
| Elispeak common English mistakes | The source repository publishes the examples under MIT and contains a copyright notice for Elispeak (2026). Its complete notice is retained in `tools/languages/licenses/elispeak-MIT.txt`; code and data rights are checked separately. | 40 rows were transformed into a private English candidate pack only. Each item still requires linguistic and answer review; no item was published or approved. |
| Zanichelli English grammar exercises | The repository README states that the project is licensed CC BY 4.0. Dataset items still require their provenance and attribution to be carried with each derived candidate; the repository's statement is the basis for this intake decision. | Eligible for private candidate intake with attribution, subject to human linguistic review. No content is promoted automatically. |
| Tatoeba | The API exposes sentence-level licensing, author, approval and direct-translation metadata. Its FAQ states that text attribution should name Tatoeba, link to it and identify CC BY 2.0 FR; audio has separate contributor-specific terms. | Text only. Import keeps one deterministic direct translation as the candidate key, captures both source records and their authors when CC BY applies, excludes unapproved/orphan/unsupported-license records, and flags any alternate translations for review. Audio is never imported. |
| XQuAD | CC BY-SA 4.0; translated reading-comprehension material adapted from SQuAD. Share-alike obligations and upstream provenance apply to adaptations. | Keep as an evaluation/reading candidate set; do not silently fold it into proprietary course content. |
| Belebele | Benchmark variants use CC BY-SA 4.0; associated training material has separate, mixed terms and the dataset is intended for evaluation. | Do not use benchmark questions as generated course content. Use only for an explicitly licensed evaluation workflow. |

The importer accepts only an explicit data-license field from a commercial-use allowlist and requires attribution for CC BY variants. It rejects non-commercial or unknown terms. It also keeps answer-bearing review records outside the repository and writes a metadata-only manifest without prompts, options, accepted answers, or answer keys.

## Primary source records

- [Elispeak dataset repository](https://github.com/elispeak/elispeak-common-english-mistakes)
- [Zanichelli grammar dataset repository](https://github.com/ZanichelliEditore/english-grammar-multiple-choice-generation)
- [Tatoeba API specification](https://api.tatoeba.org/openapi.json)
- [Tatoeba corpus use and attribution](https://en.wiki.tatoeba.org/articles/show/using-the-tatoeba-corpus)
- [Tatoeba audio and per-contributor licensing FAQ](https://en.wiki.tatoeba.org/articles/show/faq)
- [XQuAD source repository](https://github.com/google-deepmind/xquad)
- [Belebele source repository](https://github.com/facebookresearch/belebele)
