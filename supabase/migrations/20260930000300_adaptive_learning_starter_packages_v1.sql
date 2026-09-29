begin;

-- Promote the core lessons into stable, demo-ready global packages.  The
-- package rows and lesson content already exist in the core seed; this keeps
-- their public names deterministic without fabricating official exam content.
do $$
declare
  item record;
  v_skill_id uuid;
  v_lesson_id uuid;
  v_package_id uuid;
  v_code text;
  v_title text;
  v_description text;
begin
  for item in
    select * from (values
      ('FRACTIONS', 'Fundamentos de Frações', 'Percurso curto para representar, comparar e operar frações.'),
      ('RATIO_PROPORTION', 'Razão e Proporção', 'Percurso curto para relacionar grandezas por razões e proporções.'),
      ('PERCENTAGE', 'Porcentagem', 'Percurso curto para resolver situações percentuais.'),
      ('EQUATIONS', 'Equações', 'Percurso curto para modelar e resolver equações de primeiro grau.'),
      ('FUNCTIONS_INTRO', 'Introdução a Funções', 'Percurso curto para interpretar relações entre variáveis.'),
      ('LINEAR_FUNCTION', 'Função Afim', 'Percurso curto para interpretar lei, gráfico e variação de uma função afim.')
    ) as starter(code, title, description)
  loop
    v_code := starter.code;
    v_title := starter.title;
    v_description := starter.description;

    select canonical.id, lesson.id
      into v_skill_id, v_lesson_id
      from public.learning_curriculum_skills canonical
      join public.learning_curriculum_catalogs catalog
        on catalog.id = canonical.catalog_id
       and catalog.code = 'TECESCOLA_CORE'
       and catalog.version = '1.0'
      join public.learning_skill_lessons lesson
        on lesson.canonical_skill_id = canonical.id
       and lesson.version = 1
       and lesson.active
     where canonical.code = v_code
       and canonical.active
     limit 1;

    if v_skill_id is null or v_lesson_id is null then
      raise exception 'TECESCOLA_STARTER_LESSON_MISSING:%', v_code;
    end if;

    select package.id
      into v_package_id
      from public.learning_packages package
     where package.title = v_title
       and package.package_type = 'TECESCOLA'
       and package.visibility = 'GLOBAL'
     limit 1;

    if v_package_id is null then
      select package.id
        into v_package_id
        from public.learning_packages package
        join public.learning_package_steps step on step.package_id = package.id
       where step.lesson_id = v_lesson_id
         and package.package_type = 'TECESCOLA'
         and package.visibility = 'GLOBAL'
       order by package.id
       limit 1;
    end if;

    if v_package_id is null then
      insert into public.learning_packages(
        package_type, visibility, title, description, subject_area, metadata
      )
      select
        'TECESCOLA', 'GLOBAL', v_title, v_description,
        canonical.subject_area,
        jsonb_build_object('starter_package', true, 'catalog', 'TECESCOLA_CORE_V1')
        from public.learning_curriculum_skills canonical
       where canonical.id = v_skill_id
      returning id into v_package_id;
    else
      update public.learning_packages
         set title = v_title,
             description = v_description,
             active = true,
             subject_area = (select canonical.subject_area from public.learning_curriculum_skills canonical where canonical.id = v_skill_id),
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('starter_package', true, 'catalog', 'TECESCOLA_CORE_V1'),
             updated_at = now()
       where id = v_package_id;
    end if;

    insert into public.learning_package_steps(
      package_id, position, step_type, lesson_id, title, metadata
    )
    values (
      v_package_id, 0, 'LESSON', v_lesson_id, v_title,
      jsonb_build_object('canonical_skill_id', v_skill_id)
    )
    on conflict (package_id, position) do update
      set step_type = excluded.step_type,
          lesson_id = excluded.lesson_id,
          title = excluded.title,
          metadata = excluded.metadata;
  end loop;

  select package.id
    into v_package_id
    from public.learning_packages package
   where package.title = 'Preparação Matemática ENEM — Fundamentos'
     and package.package_type = 'TECESCOLA'
     and package.visibility = 'GLOBAL'
   limit 1;

  if v_package_id is null then
    insert into public.learning_packages(
      package_type, visibility, title, description, subject_area, metadata
    )
    values (
      'TECESCOLA', 'GLOBAL', 'Preparação Matemática ENEM — Fundamentos',
      'Percurso de fundamentos para interpretar problemas matemáticos.',
      'MATEMATICA',
      jsonb_build_object('starter_package', true, 'catalog', 'TECESCOLA_CORE_V1', 'official_content_imported', false)
    )
    returning id into v_package_id;
  else
    update public.learning_packages
       set active = true,
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('starter_package', true, 'catalog', 'TECESCOLA_CORE_V1', 'official_content_imported', false),
           updated_at = now()
     where id = v_package_id;
  end if;

  insert into public.learning_package_steps(
    package_id, position, step_type, lesson_id, title, metadata
  )
  select
    v_package_id,
    row_number() over (order by canonical.grade_level, canonical.title) - 1,
    'LESSON',
    lesson.id,
    lesson.title,
    jsonb_build_object('canonical_skill_id', canonical.id)
    from public.learning_skill_lessons lesson
    join public.learning_curriculum_skills canonical on canonical.id = lesson.canonical_skill_id
    join public.learning_curriculum_catalogs catalog
      on catalog.id = canonical.catalog_id
     and catalog.code = 'TECESCOLA_CORE'
     and catalog.version = '1.0'
   where lesson.version = 1
     and lesson.active
     and canonical.active
  on conflict (package_id, position) do update
    set step_type = excluded.step_type,
        lesson_id = excluded.lesson_id,
        title = excluded.title,
        metadata = excluded.metadata;
end;
$$;

notify pgrst, 'reload schema';
commit;
