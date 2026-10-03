begin;

-- Expose the already versioned TecEscola V4 lessons as global defaults.  This
-- creates no student/class assignment rows; eligibility remains contextual in
-- list_student_learning_packages().
do $$
declare
  item record;
  v_package_id uuid;
begin
  for item in
    select canonical.subject_area
      from public.learning_curriculum_skills canonical
      join public.learning_curriculum_catalogs catalog
        on catalog.id = canonical.catalog_id
       and catalog.code = 'TECESCOLA_CORE'
       and catalog.version = '1.0'
      join public.learning_skill_lessons lesson
        on lesson.canonical_skill_id = canonical.id
       and lesson.version = 1
       and lesson.active
     where canonical.active
     group by canonical.subject_area
  loop
    select package.id
      into v_package_id
      from public.learning_packages package
     where package.package_type = 'TECESCOLA'
       and package.visibility = 'GLOBAL'
       and package.subject_area = item.subject_area
       and package.metadata ->> 'content_pack' = 'tec-escola-core-v4'
     order by package.created_at
     limit 1;

    if v_package_id is null then
      insert into public.learning_packages(
        package_type, visibility, title, description, subject_area, metadata
      )
      values (
        'TECESCOLA',
        'GLOBAL',
        'Conteúdo padrão — ' || initcap(lower(item.subject_area)),
        'Percurso inicial do conteúdo autorado da TecEscola para esta área.',
        item.subject_area,
        jsonb_build_object(
          'automatic_default', true,
          'content_pack', 'tec-escola-core-v4',
          'content_source', 'TECESCOLA_DERIVED',
          'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'
        )
      )
      returning id into v_package_id;
    else
      update public.learning_packages
         set active = true,
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
               'automatic_default', true,
               'content_pack', 'tec-escola-core-v4',
               'content_source', 'TECESCOLA_DERIVED'
             ),
             updated_at = now()
       where id = v_package_id;
    end if;

    insert into public.learning_package_steps(
      package_id, position, step_type, lesson_id, title, metadata
    )
    select
      v_package_id,
      row_number() over (order by canonical.grade_level nulls last, lesson.title) - 1,
      'LESSON',
      lesson.id,
      lesson.title,
      jsonb_build_object('canonical_skill_id', canonical.id, 'content_pack', 'tec-escola-core-v4')
      from public.learning_skill_lessons lesson
      join public.learning_curriculum_skills canonical
        on canonical.id = lesson.canonical_skill_id
      join public.learning_curriculum_catalogs catalog
        on catalog.id = canonical.catalog_id
       and catalog.code = 'TECESCOLA_CORE'
       and catalog.version = '1.0'
     where lesson.version = 1
       and lesson.active
       and canonical.active
       and canonical.subject_area = item.subject_area
    on conflict (package_id, position) do update
      set step_type = excluded.step_type,
          lesson_id = excluded.lesson_id,
          title = excluded.title,
          metadata = excluded.metadata;

    if not exists (
      select 1
        from public.learning_package_default_rules rule
      where rule.package_id = v_package_id
         and rule.stage is not distinct from null
         and rule.grade_level is not distinct from null
         and rule.subject_area is not distinct from null
    ) then
      insert into public.learning_package_default_rules(
        package_id, stage, grade_level, subject_area, rule_source, active
      )
      values (v_package_id, null, null, null, 'TECESCOLA_DEFAULT', true);
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
