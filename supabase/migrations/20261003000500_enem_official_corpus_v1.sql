begin;

-- Official ENEM corpus provenance is kept separate from the global question bank
-- so imports can be replayed, audited and rolled back without touching school data.
create table if not exists public.learning_enem_import_batches (
  id uuid primary key default extensions.uuid_generate_v4(),
  manifest_version text not null,
  manifest_fingerprint text not null,
  source_catalog_reference text not null,
  years integer[] not null check (cardinality(years) > 0),
  status text not null default 'PLANNED' check (status in ('PLANNED', 'DRY_RUN', 'IMPORTED', 'ROLLED_BACK')),
  artifact_count integer not null default 0 check (artifact_count >= 0),
  canonical_question_count integer not null default 0 check (canonical_question_count >= 0),
  occurrence_count integer not null default 0 check (occurrence_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_enem_import_batches_fingerprint_unique unique (manifest_version, manifest_fingerprint)
);

create table if not exists public.learning_enem_official_occurrences (
  id uuid primary key default extensions.uuid_generate_v4(),
  batch_id uuid not null references public.learning_enem_import_batches(id) on delete restrict,
  question_bank_id uuid not null references public.learning_question_bank(id) on delete restrict,
  canonical_fingerprint text not null,
  year integer not null check (year between 1998 and 2100),
  exam text not null default 'ENEM',
  application text not null default 'REGULAR',
  day text not null,
  booklet text not null,
  question_number integer not null check (question_number > 0),
  language text check (language is null or language in ('ENGLISH', 'SPANISH')),
  official_answer text not null check (official_answer in ('A', 'B', 'C', 'D', 'E', 'ANNULLED', 'UNKNOWN')),
  quality_state text not null check (quality_state in ('DISCOVERED', 'DOWNLOADED', 'PARSED', 'VALIDATED', 'IMPORT_READY', 'REVIEW_REQUIRED', 'REJECTED', 'IMPORTED')),
  source_reference text not null,
  exam_url text not null,
  answer_key_url text not null,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  answer_key_sha256 text not null check (answer_key_sha256 ~ '^[0-9a-f]{64}$'),
  source_page integer check (source_page is null or source_page > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists learning_enem_occurrence_identity_unique
  on public.learning_enem_official_occurrences(
    year, exam, application, day, booklet, question_number, coalesce(language, '')
  );
create index if not exists learning_enem_occurrences_batch_idx
  on public.learning_enem_official_occurrences(batch_id, quality_state);
create index if not exists learning_enem_occurrences_question_idx
  on public.learning_enem_official_occurrences(question_bank_id);

create table if not exists public.learning_enem_media_assets (
  id uuid primary key default extensions.uuid_generate_v4(),
  occurrence_id uuid not null references public.learning_enem_official_occurrences(id) on delete cascade,
  media_fingerprint text not null,
  media_type text not null,
  source_page integer check (source_page is null or source_page > 0),
  storage_path text,
  quality_state text not null check (quality_state in ('DISCOVERED', 'EXTRACTED', 'VALIDATED', 'REVIEW_REQUIRED', 'REJECTED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint learning_enem_media_occurrence_fingerprint_unique unique (occurrence_id, media_fingerprint)
);

alter table public.learning_enem_import_batches enable row level security;
alter table public.learning_enem_official_occurrences enable row level security;
alter table public.learning_enem_media_assets enable row level security;

revoke all on table public.learning_enem_import_batches, public.learning_enem_official_occurrences, public.learning_enem_media_assets from public, anon, authenticated;
grant all on table public.learning_enem_import_batches, public.learning_enem_official_occurrences, public.learning_enem_media_assets to service_role;

commit;
