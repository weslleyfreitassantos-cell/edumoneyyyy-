create extension if not exists "uuid-ossp"
with schema extensions;

create type public.user_role as enum (
  'ADMIN',
  'DIRECTOR',
  'TEACHER',
  'STUDENT',
  'GUARDIAN'
);

create table public.institutions (
  id uuid primary key
    default extensions.uuid_generate_v4(),

  name text not null,
  cnpj text unique,
  address text,
  phone text,
  email text,
  logo_url text,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key
    references auth.users(id),

  full_name text not null,
  email text not null unique,
  avatar_url text,
  phone text,
  role public.user_role not null,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key
    default extensions.uuid_generate_v4(),

  profile_id uuid not null
    references public.profiles(id),

  institution_id uuid not null
    references public.institutions(id),

  role public.user_role not null,
  active boolean not null default true,
  joined_at timestamptz not null default now()
);

create table public.academic_years (
  id uuid primary key
    default extensions.uuid_generate_v4(),

  institution_id uuid not null
    references public.institutions(id),

  name text not null,
  start_date date not null,
  end_date date not null,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.terms (
  id uuid primary key
    default extensions.uuid_generate_v4(),

  academic_year_id uuid not null
    references public.academic_years(id),

  name text not null,
  start_date date not null,
  end_date date not null,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key
    default extensions.uuid_generate_v4(),

  profile_id uuid not null
    references public.profiles(id),

  institution_id uuid not null
    references public.institutions(id),

  registration_number text not null,
  birth_date date,
  cpf text unique,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint students_institution_registration_number_key
    unique (
      institution_id,
      registration_number
    )
);

create table public.guardianships (
  id uuid primary key
    default extensions.uuid_generate_v4(),

  student_id uuid not null
    references public.students(id),

  guardian_profile_id uuid not null
    references public.profiles(id),

  relationship text not null,
  is_primary boolean not null default false,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key
    default extensions.uuid_generate_v4(),

  institution_id uuid not null
    references public.institutions(id),

  academic_year_id uuid not null
    references public.academic_years(id),

  name text not null,
  grade_level text,
  shift text,
  capacity integer not null default 30,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key
    default extensions.uuid_generate_v4(),

  institution_id uuid not null
    references public.institutions(id),

  name text not null,
  code text unique,
  workload integer,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subject_offerings (
  id uuid primary key
    default extensions.uuid_generate_v4(),

  subject_id uuid not null
    references public.subjects(id),

  class_id uuid not null
    references public.classes(id),

  teacher_profile_id uuid not null
    references public.profiles(id),

  term_id uuid not null
    references public.terms(id),

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key
    default extensions.uuid_generate_v4(),

  student_id uuid not null
    references public.students(id),

  class_id uuid not null
    references public.classes(id),

  academic_year_id uuid not null
    references public.academic_years(id),

  status text not null default 'active',
  enrolled_at timestamptz not null default now(),
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_registration_counters (
  institution_id uuid not null
    references public.institutions(id)
    on delete cascade,

  registration_year integer not null,
  last_value integer not null default 0,

  primary key (
    institution_id,
    registration_year
  )
);

create index memberships_profile_id_idx
  on public.memberships(profile_id);

create index memberships_institution_id_idx
  on public.memberships(institution_id);

create index students_profile_id_idx
  on public.students(profile_id);

create index students_institution_id_idx
  on public.students(institution_id);

create index academic_years_institution_id_idx
  on public.academic_years(institution_id);

create index classes_institution_id_idx
  on public.classes(institution_id);

create index enrollments_student_id_idx
  on public.enrollments(student_id);

create index enrollments_class_id_idx
  on public.enrollments(class_id);