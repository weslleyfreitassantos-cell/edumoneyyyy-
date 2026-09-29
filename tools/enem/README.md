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

`manifest.v1.json` is the reproducible handoff point. It is empty until a
verified artifact has been downloaded and reviewed; no fake or placeholder
question is allowed into the product.
