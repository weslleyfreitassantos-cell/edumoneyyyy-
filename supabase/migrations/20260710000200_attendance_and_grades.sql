-- Estrutura acadêmica para avaliações, notas e frequência.
--
-- Esta migration deve ser revisada antes de qualquer aplicação remota.
-- NÃO executar `supabase db push` no projeto remoto atual enquanto o
-- histórico de migrations não estiver reconciliado.

begin;

-- ============================================================
-- Avaliações
-- ============================================================

create table public.assessments (
  id uuid primary key default uuid_generate_v4(),

  institution_id uuid not null
    references public.institutions(id)
    on delete cascade,

  subject_offering_id uuid not null
    references public.subject_offerings(id)
    on delete restrict,

  term_id uuid
    references public.terms(id)
    on delete set null,

  title text not null,
  description text,

  assessment_type text not null default 'EXAM',

  assessment_date date not null,

  max_score numeric(7, 2) not null default 10,

  weight numeric(7, 4) not null default 1,

  status text not null default 'DRAFT',

  created_by uuid
    references public.profiles(id)
    on delete set null,

  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint assessments_title_not_blank
    check (length(trim(title)) > 0),

  constraint assessments_max_score_positive
    check (max_score > 0),

  constraint assessments_weight_positive
    check (weight > 0),

  constraint assessments_type_valid
    check (
      assessment_type in (
        'EXAM',
        'ASSIGNMENT',
        'PROJECT',
        'QUIZ',
        'OTHER'
      )
    ),

  constraint assessments_status_valid
    check (
      status in (
        'DRAFT',
        'PUBLISHED',
        'CLOSED',
        'CANCELED'
      )
    )
);

comment on table public.assessments is
  'Avaliações vinculadas a uma oferta de disciplina e período acadêmico.';

comment on column public.assessments.max_score is
  'Pontuação máxima permitida para a avaliação.';

comment on column public.assessments.weight is
  'Peso utilizado futuramente no cálculo da média.';

-- ============================================================
-- Notas
-- ============================================================

create table public.grades (
  id uuid primary key default uuid_generate_v4(),

  institution_id uuid not null
    references public.institutions(id)
    on delete cascade,

  assessment_id uuid not null
    references public.assessments(id)
    on delete cascade,

  student_id uuid not null
    references public.students(id)
    on delete restrict,

  score numeric(7, 2),

  status text not null default 'PENDING',

  feedback text,

  recorded_by uuid
    references public.profiles(id)
    on delete set null,

  recorded_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint grades_assessment_student_unique
    unique (assessment_id, student_id),

  constraint grades_score_non_negative
    check (
      score is null or score >= 0
    ),

  constraint grades_status_valid
    check (
      status in (
        'PENDING',
        'GRADED',
        'EXCUSED'
      )
    ),

  constraint grades_score_matches_status
    check (
      (
        status = 'GRADED'
        and score is not null
      )
      or
      (
        status in ('PENDING', 'EXCUSED')
        and score is null
      )
    )
);

comment on table public.grades is
  'Notas individuais dos alunos em avaliações acadêmicas.';

comment on column public.grades.recorded_by is
  'Perfil responsável pelo lançamento ou alteração da nota.';

-- ============================================================
-- Sessões de frequência
-- ============================================================

create table public.attendance_sessions (
  id uuid primary key default uuid_generate_v4(),

  institution_id uuid not null
    references public.institutions(id)
    on delete cascade,

  subject_offering_id uuid not null
    references public.subject_offerings(id)
    on delete restrict,

  session_date date not null,

  starts_at time,
  ends_at time,

  topic text,
  notes text,

  status text not null default 'DRAFT',

  created_by uuid
    references public.profiles(id)
    on delete set null,

  closed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint attendance_sessions_status_valid
    check (
      status in (
        'DRAFT',
        'OPEN',
        'CLOSED',
        'CANCELED'
      )
    ),

  constraint attendance_sessions_time_order
    check (
      starts_at is null
      or ends_at is null
      or ends_at > starts_at
    ),

  constraint attendance_sessions_slot_unique
    unique (
      subject_offering_id,
      session_date,
      starts_at
    )
);

comment on table public.attendance_sessions is
  'Chamadas realizadas em uma oferta de disciplina em determinada data.';

-- ============================================================
-- Registros de presença
-- ============================================================

create table public.attendance_records (
  id uuid primary key default uuid_generate_v4(),

  institution_id uuid not null
    references public.institutions(id)
    on delete cascade,

  attendance_session_id uuid not null
    references public.attendance_sessions(id)
    on delete cascade,

  student_id uuid not null
    references public.students(id)
    on delete restrict,

  status text not null default 'PRESENT',

  notes text,

  recorded_by uuid
    references public.profiles(id)
    on delete set null,

  recorded_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint attendance_records_session_student_unique
    unique (
      attendance_session_id,
      student_id
    ),

  constraint attendance_records_status_valid
    check (
      status in (
        'PRESENT',
        'ABSENT',
        'LATE',
        'EXCUSED'
      )
    )
);

comment on table public.attendance_records is
  'Registro individual de presença do aluno em uma sessão de chamada.';

-- ============================================================
-- Índices de consulta
-- ============================================================

create index assessments_institution_date_idx
  on public.assessments (
    institution_id,
    assessment_date desc
  );

create index assessments_offering_date_idx
  on public.assessments (
    subject_offering_id,
    assessment_date desc
  );

create index assessments_term_idx
  on public.assessments (term_id);

create index grades_institution_student_idx
  on public.grades (
    institution_id,
    student_id
  );

create index grades_student_created_idx
  on public.grades (
    student_id,
    created_at desc
  );

create index attendance_sessions_institution_date_idx
  on public.attendance_sessions (
    institution_id,
    session_date desc
  );

create index attendance_sessions_offering_date_idx
  on public.attendance_sessions (
    subject_offering_id,
    session_date desc
  );

create index attendance_records_institution_student_idx
  on public.attendance_records (
    institution_id,
    student_id
  );

create index attendance_records_student_created_idx
  on public.attendance_records (
    student_id,
    created_at desc
  );

-- ============================================================
-- Atualização automática de updated_at
-- ============================================================

create or replace function public.touch_academic_record_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger assessments_touch_updated_at
before update on public.assessments
for each row
execute function public.touch_academic_record_updated_at();

create trigger grades_touch_updated_at
before update on public.grades
for each row
execute function public.touch_academic_record_updated_at();

create trigger attendance_sessions_touch_updated_at
before update on public.attendance_sessions
for each row
execute function public.touch_academic_record_updated_at();

create trigger attendance_records_touch_updated_at
before update on public.attendance_records
for each row
execute function public.touch_academic_record_updated_at();

-- ============================================================
-- Segurança inicial
-- ============================================================

alter table public.assessments
  enable row level security;

alter table public.grades
  enable row level security;

alter table public.attendance_sessions
  enable row level security;

alter table public.attendance_records
  enable row level security;

revoke all on table public.assessments
  from anon, authenticated;

revoke all on table public.grades
  from anon, authenticated;

revoke all on table public.attendance_sessions
  from anon, authenticated;

revoke all on table public.attendance_records
  from anon, authenticated;

grant all on table public.assessments
  to service_role;

grant all on table public.grades
  to service_role;

grant all on table public.attendance_sessions
  to service_role;

grant all on table public.attendance_records
  to service_role;

revoke all on function
  public.touch_academic_record_updated_at()
  from public, anon, authenticated;

grant execute on function
  public.touch_academic_record_updated_at()
  to service_role;

commit;