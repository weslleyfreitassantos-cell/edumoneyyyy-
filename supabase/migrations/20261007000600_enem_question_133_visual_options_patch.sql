begin;

-- Q133 is already published with corrupt PDF text extraction. Its official
-- option crops are the source of truth for the learner-facing attempt.
do $$
declare
  v_question_id uuid;
  v_occurrence_id uuid;
begin
  select id into v_question_id
  from public.learning_question_bank
  where source_type = 'ENEM_OFFICIAL'
    and source_year = 2021
    and source_day = 'D2'
    and source_number = 133
  order by updated_at desc
  limit 1;

  if v_question_id is null then
    raise exception 'ENEM_QUESTION_2021_D2_133_NOT_FOUND';
  end if;

  select id into v_occurrence_id
  from public.learning_enem_official_occurrences
  where question_bank_id = v_question_id
    and year = 2021
    and day = 'D2'
    and booklet = 'CD5'
    and question_number = 133
    and language is null
  limit 1;

  if v_occurrence_id is null then
    raise exception 'ENEM_OCCURRENCE_2021_D2_CD5_133_NOT_FOUND';
  end if;

  update public.learning_question_bank
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'source_integrity', 'VERIFIED',
    'statement_integrity', 'VERIFIED',
    'options_integrity', 'VERIFIED',
    'render_mode', 'VISUAL_OPTIONS',
    'render_ready', true,
    'area_verified', true
  ),
  updated_at = now()
  where id = v_question_id;

  insert into public.learning_enem_media_assets(
    occurrence_id,
    media_fingerprint,
    media_type,
    source_page,
    storage_path,
    quality_state,
    metadata
  ) values
    (
      v_occurrence_id,
      'f169025911bce25f7382c4c829226a5839aacbe87af21a9dc3cb381cfd080185',
      'OPTION_CROP',
      16,
      'v2/2021-D2-CD5/question-133-COMMON/option-A-page-16.png',
      'VALIDATED',
      jsonb_build_object('asset_role', 'OPTION_A', 'option_label', 'A', 'official_pdf_crop', true, 'render_ready', true, 'sha256', 'f169025911bce25f7382c4c829226a5839aacbe87af21a9dc3cb381cfd080185', 'source_page', 16)
    ),
    (
      v_occurrence_id,
      'c42d8b8978fa23c30ed00b7c58ca3d0523d55224fdcc6b5de8e67afbf63e49ab',
      'OPTION_CROP',
      16,
      'v2/2021-D2-CD5/question-133-COMMON/option-B-page-16.png',
      'VALIDATED',
      jsonb_build_object('asset_role', 'OPTION_B', 'option_label', 'B', 'official_pdf_crop', true, 'render_ready', true, 'sha256', 'c42d8b8978fa23c30ed00b7c58ca3d0523d55224fdcc6b5de8e67afbf63e49ab', 'source_page', 16)
    ),
    (
      v_occurrence_id,
      '504068b247a673a721fb5aad1b290b0e1e06850583b1738852ea8564d8d13cc8',
      'OPTION_CROP',
      16,
      'v2/2021-D2-CD5/question-133-COMMON/option-C-page-16.png',
      'VALIDATED',
      jsonb_build_object('asset_role', 'OPTION_C', 'option_label', 'C', 'official_pdf_crop', true, 'render_ready', true, 'sha256', '504068b247a673a721fb5aad1b290b0e1e06850583b1738852ea8564d8d13cc8', 'source_page', 16)
    ),
    (
      v_occurrence_id,
      'bbdfd839c6e17341449ebb8f14f04554c08dbc17fba72ae7fb5e88dd9f463ee6',
      'OPTION_CROP',
      16,
      'v2/2021-D2-CD5/question-133-COMMON/option-D-page-16.png',
      'VALIDATED',
      jsonb_build_object('asset_role', 'OPTION_D', 'option_label', 'D', 'official_pdf_crop', true, 'render_ready', true, 'sha256', 'bbdfd839c6e17341449ebb8f14f04554c08dbc17fba72ae7fb5e88dd9f463ee6', 'source_page', 16)
    ),
    (
      v_occurrence_id,
      '18efbe7e7c67bc4125fd250b54de137e39626e63564cf567ea52e76a6f7360d7',
      'OPTION_CROP',
      16,
      'v2/2021-D2-CD5/question-133-COMMON/option-E-page-16.png',
      'VALIDATED',
      jsonb_build_object('asset_role', 'OPTION_E', 'option_label', 'E', 'official_pdf_crop', true, 'render_ready', true, 'sha256', '18efbe7e7c67bc4125fd250b54de137e39626e63564cf567ea52e76a6f7360d7', 'source_page', 16)
    )
  on conflict (occurrence_id, media_fingerprint) do update
    set storage_path = excluded.storage_path,
        quality_state = excluded.quality_state,
        metadata = excluded.metadata;
end $$;

commit;
