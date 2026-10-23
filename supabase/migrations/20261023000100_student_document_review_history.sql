begin;

alter table public.student_documents
  alter column status set default 'NOT_REQUESTED';

alter table public.student_documents
  drop constraint if exists student_documents_status_check;

alter table public.student_documents
  add constraint student_documents_status_check
  check (status in (
    'NOT_REQUESTED',
    'PENDING',
    'REQUESTED',
    'DELIVERED',
    'UNDER_REVIEW',
    'VALIDATED',
    'REJECTED',
    'DISPENSED'
  ));

alter table public.student_documents
  drop constraint if exists student_documents_disposition_justification_check;

alter table public.student_documents
  add constraint student_documents_disposition_justification_check
  check (
    status not in ('REJECTED', 'DISPENSED')
    or nullif(btrim(notes), '') is not null
  );

create table if not exists public.student_document_status_history (
  id uuid primary key default extensions.uuid_generate_v4(),
  student_document_id uuid not null,
  student_id uuid not null,
  institution_id uuid not null,
  document_type text not null,
  from_status text,
  to_status text not null,
  actor_profile_id uuid,
  changed_at timestamptz not null default now(),
  constraint student_document_status_history_to_status_check
    check (to_status in (
      'NOT_REQUESTED', 'PENDING', 'REQUESTED', 'DELIVERED',
      'UNDER_REVIEW', 'VALIDATED', 'REJECTED', 'DISPENSED'
    )),
  constraint student_document_status_history_from_status_check
    check (from_status is null or from_status in (
      'NOT_REQUESTED', 'PENDING', 'REQUESTED', 'DELIVERED',
      'UNDER_REVIEW', 'VALIDATED', 'REJECTED', 'DISPENSED'
    ))
);

create index if not exists student_document_status_history_student_idx
  on public.student_document_status_history(institution_id, student_id, changed_at desc);

alter table public.student_document_status_history enable row level security;

drop policy if exists student_document_status_history_staff_select
  on public.student_document_status_history;
create policy student_document_status_history_staff_select
  on public.student_document_status_history
  for select
  to authenticated
  using (public.can_manage_institution_operations(institution_id));

revoke all on table public.student_document_status_history
  from public, anon, authenticated;
grant select on table public.student_document_status_history to authenticated;

create or replace function public.record_student_document_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.student_document_status_history (
      student_document_id,
      student_id,
      institution_id,
      document_type,
      from_status,
      to_status,
      actor_profile_id
    ) values (
      new.id,
      new.student_id,
      new.institution_id,
      new.document_type,
      null,
      new.status,
      auth.uid()
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.student_document_status_history (
      student_document_id,
      student_id,
      institution_id,
      document_type,
      from_status,
      to_status,
      actor_profile_id
    ) values (
      new.id,
      new.student_id,
      new.institution_id,
      new.document_type,
      old.status,
      new.status,
      auth.uid()
    );
  end if;

  return new;
end;
$$;

alter function public.record_student_document_status_history() owner to postgres;
revoke all on function public.record_student_document_status_history()
  from public, anon, authenticated;

drop trigger if exists student_documents_status_history_trigger
  on public.student_documents;
create trigger student_documents_status_history_trigger
  after insert or update on public.student_documents
  for each row execute function public.record_student_document_status_history();

comment on table public.student_document_status_history is
  'Immutable, institution-scoped audit of student document status transitions; excludes file contents and free-text notes.';

notify pgrst, 'reload schema';
commit;
