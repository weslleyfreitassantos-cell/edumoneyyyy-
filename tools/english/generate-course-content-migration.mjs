import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = new URL('../../content/english/tec-english-foundations-v1.json', import.meta.url);
const outputPath = new URL('../../supabase/migrations/20261025000300_tec_english_interactive_content_v1.sql', import.meta.url);

function fail(message) {
  throw new Error(`Tec Inglês content: ${message}`);
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  return `${sqlText(JSON.stringify(value))}::jsonb`;
}

function tokenize(sentence) {
  return sentence.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*[.,!?]?/gu) ?? [];
}

function buildExercises(lesson) {
  const [first, second, third, fourth] = lesson.sentences;
  const [firstWord] = lesson.vocabulary;
  const matchingKey = Object.fromEntries(lesson.vocabulary.map(({ en, pt }) => [en, pt]));
  const matchingRight = lesson.vocabulary.map((_, index) => lesson.vocabulary[(index + 1) % lesson.vocabulary.length].pt);
  const tokenBank = tokenize(second.en);
  const alternatives = lesson.translationAlternatives ?? [third.en];

  return [
    {
      type: 'MULTIPLE_CHOICE',
      instruction: 'Escolha a frase em inglês com o mesmo significado.',
      prompt: `Como dizer “${first.pt}” em inglês?`,
      options: [first.en, ...lesson.distractors],
      accepted: [first.en],
      key: { accepted: [first.en] },
      explanation: `“${first.en}” significa “${first.pt}”.`,
    },
    {
      type: 'WORD_ORDER',
      instruction: 'Toque nas palavras na ordem certa para montar a frase.',
      prompt: `Monte: “${second.pt}”`,
      wordBank: [...tokenBank].reverse(),
      accepted: [second.en],
      key: { accepted: [second.en] },
      explanation: 'Em inglês, a ordem das palavras ajuda a mostrar quem faz a ação e o que acontece.',
    },
    {
      type: 'TRANSLATION',
      instruction: 'Escreva a tradução em inglês.',
      prompt: third.pt,
      accepted: alternatives,
      key: { accepted: alternatives },
      explanation: `Uma forma correta de dizer isso é “${third.en}”.`,
    },
    {
      type: 'LISTENING',
      instruction: 'Ouça e escreva em inglês a palavra ou expressão que escutou.',
      prompt: 'O que você ouviu?',
      audioText: firstWord.en,
      accepted: [firstWord.en],
      key: { accepted: [firstWord.en] },
      explanation: `Você ouviu “${firstWord.en}”, que significa “${firstWord.pt}”.`,
    },
    {
      type: 'MATCHING',
      instruction: 'Ligue cada expressão em inglês ao seu significado.',
      prompt: 'Encontre os pares correspondentes.',
      leftItems: lesson.vocabulary.map(({ en }) => en),
      rightItems: matchingRight,
      key: { pairs: matchingKey },
      explanation: 'Leia cada palavra em inglês e associe ao significado em português.',
    },
    {
      type: 'FILL_BLANK',
      instruction: 'Escolha a palavra que completa a frase.',
      prompt: lesson.fill.prompt,
      options: lesson.fill.choices,
      accepted: [lesson.fill.answer],
      key: { accepted: [lesson.fill.answer] },
      explanation: `“${lesson.fill.answer}” completa a frase e mantém seu sentido.`,
    },
    {
      type: 'SPEAKING',
      instruction: 'Leia e repita a frase em voz alta. Se o microfone não estiver disponível, digite a frase.',
      prompt: `Repita: “${fourth.en}”`,
      audioText: fourth.en,
      accepted: [fourth.en],
      key: { accepted: [fourth.en] },
      explanation: 'Repita sem pressa e preste atenção no ritmo das palavras.',
    },
  ];
}

function validate(course) {
  if (course.course?.code !== 'TEC_ENGLISH_FOUNDATIONS' || course.course.version !== 1) fail('invalid course identity/version');
  if (course.course.publicationStatus !== 'STAGING' || course.course.reviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') fail('the original course must remain staged and pending review');
  if (course.units?.length !== 3) fail(`expected 3 units, received ${course.units?.length}`);
  const lessons = course.units.flatMap((unit) => unit.lessons ?? []);
  if (lessons.length !== 12 || course.units.some((unit) => unit.lessons?.length !== 4)) fail('expected exactly 4 lessons in each of 3 units');
  if (lessons.some((lesson) => lesson.sentences?.length !== 4 || lesson.vocabulary?.length !== 3 || lesson.distractors?.length !== 2)) fail('every lesson needs 4 sentences, 3 vocabulary pairs, and 2 distractors');
  if (lessons.some((lesson) => !lesson.fill?.prompt || lesson.fill.choices?.length !== 3 || !lesson.fill.choices.includes(lesson.fill.answer))) fail('invalid fill-in exercise');
  const ids = [course.course.code, ...course.units.map((unit) => unit.id), ...lessons.map((lesson) => lesson.id)];
  if (new Set(ids).size !== ids.length) fail('duplicate course, unit, or lesson IDs');
  for (const lesson of lessons) {
    if (buildExercises(lesson).length !== 7) fail(`${lesson.id} does not have 7 exercises`);
  }
}

const course = JSON.parse(await readFile(sourcePath, 'utf8'));
validate(course);
const { author, version } = course.course;
const sql = [
  '-- Generated by tools/english/generate-course-content-migration.mjs from the versioned course catalog.',
  '-- Do not edit this seed by hand. All course, unit, lesson, and exercise rows remain STAGING and pending review.',
  `insert into public.tec_english_courses(course_code, content_version, title, description, author, publication_status, review_status, xp_per_lesson) values (${[
    sqlText(course.course.code), version, sqlText(course.course.title), sqlText(course.course.description), sqlText(author),
    sqlText(course.course.publicationStatus), sqlText(course.course.reviewStatus), course.course.xpReward,
  ].join(', ')}) on conflict (course_code) do nothing;`,
];

for (const unit of course.units) {
  sql.push(`insert into public.tec_english_units(id, course_code, position, title, description, content_version, author, publication_status, review_status) values (${[
    sqlText(unit.id), sqlText(course.course.code), unit.order, sqlText(unit.title), sqlText(unit.description), version,
    sqlText(author), sqlText(course.course.publicationStatus), sqlText(course.course.reviewStatus),
  ].join(', ')}) on conflict (id) do nothing;`);
  for (const lesson of unit.lessons) {
    sql.push(`insert into public.tec_english_lessons(id, unit_id, position, title, introduction, xp_reward, content_version, author, publication_status, review_status) values (${[
      sqlText(lesson.id), sqlText(unit.id), lesson.order, sqlText(lesson.title), sqlText(lesson.description), course.course.xpReward,
      version, sqlText(author), sqlText(course.course.publicationStatus), sqlText(course.course.reviewStatus),
    ].join(', ')}) on conflict (id) do nothing;`);
    buildExercises(lesson).forEach((exercise, index) => {
      const exerciseId = `${lesson.id}-e${index + 1}`;
      const values = [
        sqlText(exerciseId), sqlText(lesson.id), index + 1, sqlText(exercise.type), sqlText(exercise.instruction), sqlText(exercise.prompt),
        sqlJson(exercise.options ?? []), sqlJson(exercise.wordBank ?? []), sqlJson(exercise.leftItems ?? []), sqlJson(exercise.rightItems ?? []),
        exercise.audioText ? sqlText(exercise.audioText) : 'null', sqlJson(exercise.accepted ?? []), sqlJson(exercise.key), sqlText(exercise.explanation),
        version, sqlText(author), sqlText(course.course.publicationStatus), sqlText(course.course.reviewStatus),
      ];
      sql.push(`insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status) values (${values.join(', ')}) on conflict (id) do nothing;`);
    });
  }
}

await writeFile(outputPath, `${sql.join('\n\n')}\n`, 'utf8');
console.log(`Generated ${outputPath.pathname} from ${course.units.length} units, ${course.units.reduce((sum, unit) => sum + unit.lessons.length, 0)} lessons, and ${course.units.flatMap((unit) => unit.lessons).reduce((sum, lesson) => sum + buildExercises(lesson).length, 0)} exercises.`);
