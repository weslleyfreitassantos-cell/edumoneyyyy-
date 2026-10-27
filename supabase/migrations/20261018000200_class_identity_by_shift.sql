-- The previous automatic flow stored a single class without its section
-- letter. Convert only the known automatic grade labels so the next class
-- can continue with B without touching custom names.
update public.classes as c
set name = c.name || ' A'
from (
  values
    ('1', '1º ano'),
    ('2', '2º ano'),
    ('3', '3º ano'),
    ('4', '4º ano'),
    ('5', '5º ano'),
    ('6', '6º ano'),
    ('7', '7º ano'),
    ('8', '8º ano'),
    ('9', '9º ano'),
    ('1 EM', '1ª série EM'),
    ('2 EM', '2ª série EM'),
    ('3 EM', '3ª série EM')
) as labels(grade_level, base_name)
where c.grade_level = labels.grade_level
  and lower(trim(c.name)) = lower(labels.base_name)
  and not exists (
    select 1
    from public.classes as existing
    where existing.id <> c.id
      and existing.institution_id = c.institution_id
      and existing.academic_year_id = c.academic_year_id
      and coalesce(existing.shift, '') = coalesce(c.shift, '')
      and lower(trim(existing.name)) = lower(trim(c.name || ' A'))
  );

-- Make the shift visible in automatic class names. This is intentionally
-- limited to the known automatic A names so custom class names are preserved.
-- The suffixes are M (morning), V (afternoon), I (integral) and N (night).
update public.classes as c
set name = trim(c.name) || ' ' || case
  when upper(trim(c.shift)) in ('MATUTINO', 'MANHA', 'MANHÃ') then 'M'
  when upper(trim(c.shift)) in ('VESPERTINO', 'TARDE') then 'V'
  when upper(trim(c.shift)) = 'INTEGRAL' then 'I'
  when upper(trim(c.shift)) in ('NOTURNO', 'NOITE') then 'N'
end
from (
  values
    ('1', '1º ano'),
    ('2', '2º ano'),
    ('3', '3º ano'),
    ('4', '4º ano'),
    ('5', '5º ano'),
    ('6', '6º ano'),
    ('7', '7º ano'),
    ('8', '8º ano'),
    ('9', '9º ano'),
    ('1 EM', '1ª série EM'),
    ('2 EM', '2ª série EM'),
    ('3 EM', '3ª série EM')
) as labels(grade_level, base_name)
where c.grade_level = labels.grade_level
  and c.shift is not null
  and upper(trim(c.shift)) in (
    'MATUTINO', 'MANHA', 'MANHÃ',
    'VESPERTINO', 'TARDE',
    'INTEGRAL',
    'NOTURNO', 'NOITE'
  )
  and (
    lower(trim(c.name)) = lower(trim(labels.base_name))
    or lower(trim(c.name)) = lower(trim(labels.base_name || ' A'))
  )
  and right(lower(trim(c.name)), 2) not in (' m', ' v', ' i', ' n')
  and not exists (
    select 1
    from public.classes as existing
    where existing.id <> c.id
      and existing.institution_id = c.institution_id
      and existing.academic_year_id = c.academic_year_id
      and coalesce(existing.shift, '') = coalesce(c.shift, '')
      and lower(trim(existing.name)) = lower(trim(c.name || ' ' || case
        when upper(trim(c.shift)) in ('MATUTINO', 'MANHA', 'MANHÃ') then 'M'
        when upper(trim(c.shift)) in ('VESPERTINO', 'TARDE') then 'V'
        when upper(trim(c.shift)) = 'INTEGRAL' then 'I'
        when upper(trim(c.shift)) in ('NOTURNO', 'NOITE') then 'N'
      end))
  );

-- A class name is reusable across shifts, but not within the same school,
-- academic year and shift. The expression also keeps legacy NULL shifts
-- deterministic without changing existing class records.
create unique index if not exists classes_institution_year_shift_name_unique_idx
  on public.classes (
    institution_id,
    academic_year_id,
    coalesce(shift, ''),
    lower(trim(name))
  );
