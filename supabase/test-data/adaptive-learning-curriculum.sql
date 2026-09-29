-- Small, versioned catalog slice for local development and focused tests.
-- This file is not included in production migrations.
begin;

insert into public.learning_curriculum_catalogs (code, name, version, description)
values (
  'TECESCOLA_MATEMATICA_FOUNDATIONS',
  'TecEscola Matemática — fundamentos adaptativos',
  '1.0',
  'Slice de prova para o ciclo frações até função afim.'
)
on conflict (code, version) do update
set name = excluded.name,
    description = excluded.description,
    active = true,
    updated_at = now();

with catalog as (
  select id from public.learning_curriculum_catalogs
  where code = 'TECESCOLA_MATEMATICA_FOUNDATIONS' and version = '1.0'
), skills(code, stage, grade_level, subject_area, domain, title, description, sort_order) as (
  values
    ('FRACTIONS_FOUNDATIONS', 'ENSINO_FUNDAMENTAL', 6, 'MATEMATICA', 'NUMEROS', 'Fundamentos de frações', 'Representação e equivalência de frações.', 1),
    ('RATIO', 'ENSINO_FUNDAMENTAL', 7, 'MATEMATICA', 'NUMEROS', 'Razão', 'Comparação entre grandezas.', 2),
    ('PROPORTION', 'ENSINO_FUNDAMENTAL', 7, 'MATEMATICA', 'NUMEROS', 'Proporção', 'Relações proporcionais e escala.', 3),
    ('PERCENTAGE', 'ENSINO_FUNDAMENTAL', 7, 'MATEMATICA', 'NUMEROS', 'Porcentagem', 'Representação percentual de grandezas.', 4),
    ('EQUATIONS', 'ENSINO_FUNDAMENTAL', 8, 'MATEMATICA', 'ALGEBRA', 'Equações', 'Equações de primeiro grau.', 5),
    ('LINEAR_FUNCTION', 'ENSINO_MEDIO', 1, 'MATEMATICA', 'ALGEBRA', 'Função afim', 'Relações lineares e seus gráficos.', 6)
)
insert into public.learning_curriculum_skills (
  catalog_id, code, stage, grade_level, subject_area, domain, title, description, metadata
)
select catalog.id, skills.code, skills.stage, skills.grade_level, skills.subject_area,
  skills.domain, skills.title, skills.description,
  jsonb_build_object('fixture_sort_order', skills.sort_order)
from catalog cross join skills
on conflict (catalog_id, code) do update
set title = excluded.title,
    description = excluded.description,
    active = true,
    metadata = excluded.metadata,
    updated_at = now();

with catalog as (
  select id from public.learning_curriculum_catalogs
  where code = 'TECESCOLA_MATEMATICA_FOUNDATIONS' and version = '1.0'
), edges(skill_code, prerequisite_code) as (
  values
    ('RATIO', 'FRACTIONS_FOUNDATIONS'),
    ('PROPORTION', 'RATIO'),
    ('PERCENTAGE', 'PROPORTION'),
    ('EQUATIONS', 'PERCENTAGE'),
    ('LINEAR_FUNCTION', 'EQUATIONS')
)
insert into public.learning_skill_prerequisites (skill_id, prerequisite_skill_id)
select child.id, parent.id
from edges
join public.learning_curriculum_skills child on child.code = edges.skill_code and child.catalog_id = (select id from catalog)
join public.learning_curriculum_skills parent on parent.code = edges.prerequisite_code and parent.catalog_id = (select id from catalog)
on conflict (skill_id, prerequisite_skill_id) do nothing;

with catalog as (
  select id from public.learning_curriculum_catalogs
  where code = 'TECESCOLA_MATEMATICA_FOUNDATIONS' and version = '1.0'
), target_skill as (
  select id from public.learning_curriculum_skills
  where catalog_id = (select id from catalog) and code = 'LINEAR_FUNCTION'
)
insert into public.learning_curriculum_grade_targets (
  catalog_id, stage, grade_level, subject_area, canonical_skill_id, priority, sort_order
)
select (select id from catalog), 'ENSINO_MEDIO', 1, 'MATEMATICA', target_skill.id, 0, 0
from target_skill
on conflict (catalog_id, stage, grade_level, subject_area, canonical_skill_id) do update
set priority = excluded.priority,
    sort_order = excluded.sort_order,
    active = true,
    updated_at = now();

commit;
