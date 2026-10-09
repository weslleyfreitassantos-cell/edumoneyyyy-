import { supabase } from '../lib/supabaseClient';

export const CURRENT_ENEM_CONTENT_REVISION = 'xequemat-archive-v1' as const;
export const SUPPORTED_ENEM_CONTENT_REVISIONS = new Set([
  CURRENT_ENEM_CONTENT_REVISION,
  'structured-text-only-v6',
  'structured-text-only-v5',
  'structured-text-only-v4',
  'structured-text-v1',
  'source-faithful-v3',
]);

export interface LearningSubject {
  id: string;
  name: string;
}

export interface LearningUnit {
  id: string;
  subject_id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

export interface LearningSkill {
  id: string;
  unit_id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

export interface LearningStudent {
  id: string;
  profile_id: string;
}

export interface LearningClass {
  id: string;
  name: string;
}

interface TeacherLearningSubjectRow {
  subject_id: string;
  subject_name: string;
}

interface TeacherLearningClassRow {
  class_id: string;
  class_name: string;
}

export interface LearningCollection {
  id: string;
  subject_id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  status: string;
  learning_resources?: LearningResource[];
}

export interface LearningResource {
  id: string;
  collection_id: string;
  title: string;
  description: string | null;
  provider: string | null;
  resource_type: 'VIDEO' | 'LINK' | 'RESOURCE';
  source_url: string;
  thumbnail_url: string | null;
}

export interface LearningActivity {
  id: string;
  subject_id: string;
  unit_id: string | null;
  skill_id: string | null;
  teacher_id: string;
  title: string;
  description: string | null;
  activity_type: string;
  status: string;
  created_at?: string;
  subjects?: { name: string } | { name: string }[] | null;
  learning_questions?: LearningQuestion[];
  learning_assignments?: LearningAssignment[];
}

export interface LearningAssignment {
  id: string;
  class_id: string;
  due_at: string | null;
  classes?: { name: string } | { name: string }[] | null;
}

export interface LearningQuestion {
  id: string;
  question_bank_id?: string | null;
  question_text: string;
  question_type:
    | 'MULTIPLE_CHOICE'
    | 'TRUE_FALSE'
    | 'SHORT_ANSWER';
  options_json: string[];
  correct_answer_json?: unknown;
  explanation?: string | null;
  points: number;
  sort_order: number;
}

export interface GuidedSession {
  id: string;
  target_canonical_skill_id: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'NEEDS_TEACHER_SUPPORT' | 'CANCELLED';
  started_at: string;
  completed_at: string | null;
  learning_guided_steps?: GuidedStep[];
}

export interface GuidedStep {
  id: string;
  canonical_skill_id: string;
  step_type: 'DIAGNOSTIC' | 'PROBE' | 'LESSON' | 'PRACTICE' | 'TRANSFER' | 'LOCK_IN' | 'REVIEW' | 'RETURN_TO_TARGET';
  position: number;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'SKIPPED';
  activity_id: string | null;
  lesson_id: string | null;
  attempts: number;
  learning_curriculum_skills?: { title: string } | { title: string }[] | null;
}

export interface GuidedQuestionV2 {
  id: string;
  statement: string;
  options: string[];
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | null;
  position: number;
}

export interface GuidedLessonV2 {
  id: string;
  title: string;
  summary: string;
  content_markdown: string;
  worked_example: string | null;
  tips: string[];
  estimated_minutes: number;
}

export interface GuidedStepV2 {
  id: string;
  session_id: string;
  canonical_skill_id: string;
  step_type: 'PROBE' | 'LESSON' | 'PRACTICE' | 'TRANSFER' | 'LOCK_IN' | 'REVIEW' | 'RETURN_TO_TARGET';
  purpose: 'PROBE' | 'PRACTICE' | 'TRANSFER' | 'LOCK_IN' | 'REVIEW' | null;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'SKIPPED';
  position: number;
  lesson_id: string | null;
  lesson: GuidedLessonV2 | null;
  questions: GuidedQuestionV2[];
}

export interface GuidedSessionV2 {
  id: string;
  student_id: string;
  target_canonical_skill_id: string;
  original_target_canonical_skill_id: string;
  current_canonical_skill_id: string;
  current_step_id: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'NEEDS_TEACHER_SUPPORT' | 'CANCELLED';
  planner_version: 'V2' | 'V3' | 'V4';
  decision_reason: string | null;
  replan_count: number;
  metadata: Record<string, unknown>;
  current_step: Pick<GuidedStepV2, 'id' | 'canonical_skill_id' | 'step_type' | 'purpose' | 'status' | 'position' | 'lesson_id'> | null;
}

export interface GuidedStepAttemptResultV2 {
  attempt_id: string;
  idempotent: boolean;
  score: number;
  correct_count: number;
  total_questions: number;
  feedback: Array<{
    question_bank_id: string;
    is_correct: boolean;
    correct_answer: unknown;
    explanation: string | null;
  }>;
  current_step_id: string | null;
  session_status: string;
}

export interface DailyPlanItem {
  id: string;
  position: number;
  item_type: 'REVIEW' | 'DIAGNOSTIC' | 'BRIDGE' | 'CURRENT_TARGET' | 'LOCK_IN' | 'PRACTICE' | 'LESSON' | 'SIMULATION';
  title: string;
  description: string | null;
  estimated_minutes: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  session_id: string | null;
  step_id: string | null;
  lesson_id: string | null;
  activity_id: string | null;
}

export interface DailyPlan {
  id: string;
  plan_date: string;
  estimated_minutes: number;
  status: 'OPEN' | 'COMPLETED' | 'REPLACED';
  learning_daily_plan_items?: DailyPlanItem[];
}

export interface LearningGamification {
  xp: number;
  current_streak: number;
  longest_streak: number;
  daily_goal_minutes: number;
  last_qualified_activity_date: string | null;
}

export interface LearningErrorNote {
  id: string;
  question_id: string | null;
  question_bank_id?: string | null;
  canonical_skill_id: string | null;
  error_count: number;
  status: 'OPEN' | 'REVIEWED' | 'RESOLVED';
  last_missed_at: string;
  last_reviewed_at: string | null;
}

export interface LearningLesson {
  id: string;
  canonical_skill_id: string;
  title: string;
  summary: string;
  content_markdown: string;
  worked_example: string | null;
  tips: string[];
  estimated_minutes: number;
}

export interface LearningQuestionBankItem {
  id: string;
  package_type: 'TECESCOLA' | 'ENEM' | 'INSTITUTION' | 'TEACHER';
  source_type: string;
  source_name: string | null;
  source_year: number | null;
  subject_area: string;
  topic: string | null;
  statement: string;
  options: string[];
  correct_answer: unknown;
  explanation: string | null;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | null;
}

export interface LearningSimulation {
  id: string;
  title: string;
  simulation_type: 'HISTORICAL_EXAM' | 'AREA' | 'SUBJECT' | 'TOPIC' | 'MINI' | 'ADAPTIVE';
  area: string | null;
  source_year: number | null;
  question_count: number;
  duration_minutes: number | null;
  metadata: Record<string, unknown>;
  learning_simulation_questions?: Array<{
    position: number;
    learning_question_bank: Pick<LearningQuestionBankItem, 'id' | 'statement' | 'options'> | Pick<LearningQuestionBankItem, 'id' | 'statement' | 'options'>[];
  }>;
}

export interface LearningSimulationAttempt {
  id: string;
  simulation_id: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  content_revision: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  score: number;
  correct_count: number;
  total_questions: number;
  area_breakdown: Record<string, { correct: number; total: number }>;
  skill_breakdown: Record<string, { correct: number; total: number }>;
  answers?: Record<string, { answer: unknown; is_correct?: boolean | null }>;
  navigation_state?: { current_index?: number; flagged?: string[] } | null;
  learning_simulations?: { title: string; simulation_type: LearningSimulation['simulation_type'] } | { title: string; simulation_type: LearningSimulation['simulation_type'] }[] | null;
}

export interface EnemSimulationTemplate {
  id: string;
  title: string;
  simulation_type: 'AREA' | 'SUBJECT';
  area: string | null;
  subject: string | null;
  question_count: number;
  duration_minutes: number | null;
  available_count: number;
  language_options: string[];
  metadata: Record<string, unknown>;
}

export interface EnemSimulationOptionAsset {
  media_type: string;
  storage_path: string | null;
  public_url: string | null;
  metadata: Record<string, unknown>;
}

export interface EnemSimulationOption {
  label: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string | null;
  assets: EnemSimulationOptionAsset[];
}

export interface EnemStructuredContent {
  context: string;
  prompt: string;
  alternatives: Array<{
    letter: 'A' | 'B' | 'C' | 'D' | 'E';
    text: string;
    file?: string | null;
    isCorrect?: boolean;
    assets?: EnemSimulationOptionAsset[];
  }>;
  render_mode: 'STRUCTURED_TEXT' | 'STRUCTURED_TEXT_WITH_MEDIA' | 'STRUCTURED_TEXT_VISUAL_OPTIONS';
  essential_media: Array<EnemSimulationOptionAsset | string>;
  content_blocks?: EnemContentBlock[];
  source_reference?: EnemSourceReference | null;
}

export interface EnemContentBlock {
  kind: 'PARAGRAPH' | 'IMAGE' | 'TABLE' | 'FORMULA' | 'LIST' | 'QUOTE';
  text?: string;
  html?: string;
  ordered?: boolean;
  items?: string[];
  media?: EnemSimulationOptionAsset[];
}

export interface EnemSourceReference {
  source_year: number | null;
  source_exam: string | null;
  source_application: 'REGULAR' | 'PPL' | null;
  source_question_number: number | null;
  source_day?: string | null;
  source_url?: string | null;
  source_provider?: string | null;
}

export interface EnemSimulationQuestion {
  position: number;
  question_bank_id: string;
  occurrence_id?: string | null;
  structured_content_id?: string | null;
  source_kind?: 'OFFICIAL_OCCURRENCE' | 'STRUCTURED_PROVIDER' | string | null;
  statement: string;
  options: Array<EnemSimulationOption | string>;
  source_year: number | null;
  question_number: number | null;
  source_reference?: EnemSourceReference | null;
  metadata: Record<string, unknown>;
  structured_content?: EnemStructuredContent | null;
  statement_assets: Array<{
    media_type: string;
    storage_path: string | null;
    public_url: string | null;
    metadata: Record<string, unknown>;
  }>;
}

function normalizeEnemSimulationAsset(value: unknown): EnemSimulationOptionAsset | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const storagePath = item.storage_path ?? item.storagePath;
  const publicUrl = item.public_url ?? item.publicUrl;
  if (typeof storagePath !== 'string' && typeof publicUrl !== 'string') return null;
  return {
    media_type: typeof item.media_type === 'string'
      ? item.media_type
      : typeof item.mediaType === 'string' ? item.mediaType : 'OPTION_CROP',
    storage_path: typeof storagePath === 'string' ? storagePath : null,
    public_url: typeof publicUrl === 'string' ? publicUrl : null,
    metadata: item.metadata && typeof item.metadata === 'object'
      ? item.metadata as Record<string, unknown>
      : item,
  };
}

function normalizeEnemSourceReference(value: unknown): EnemSourceReference | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const application = item.source_application === 'REGULAR' || item.source_application === 'PPL'
    ? item.source_application
    : null;
  return {
    source_year: typeof item.source_year === 'number' ? item.source_year : null,
    source_exam: typeof item.source_exam === 'string' ? item.source_exam : null,
    source_application: application,
    source_question_number: typeof item.source_question_number === 'number' ? item.source_question_number : null,
    source_day: typeof item.source_day === 'string' ? item.source_day : null,
    source_url: typeof item.source_url === 'string' ? item.source_url : null,
    source_provider: typeof item.source_provider === 'string' ? item.source_provider : null,
  };
}

function metadataAssetsForOption(metadata: Record<string, unknown>, label: EnemSimulationOption['label']) {
  const optionAssets = metadata.option_assets ?? metadata.optionAssets;
  if (!optionAssets || typeof optionAssets !== 'object') return [];
  const rawAssets = (optionAssets as Record<string, unknown>)[label];
  if (!Array.isArray(rawAssets)) return [];
  return rawAssets
    .map(normalizeEnemSimulationAsset)
    .filter((asset): asset is EnemSimulationOptionAsset => Boolean(asset));
}

function hasUnsafeOfficialText(value: string) {
  return /[\u0000-\u001f\u007f-\u009f\ufffd\ue000-\uf8ff]/u.test(value);
}

function normalizeEnemSimulationOption(
  option: EnemSimulationOption | string,
  index: number,
  metadata: Record<string, unknown> = {},
): EnemSimulationOption {
  const fallbackLabel = String.fromCharCode('A'.charCodeAt(0) + index) as EnemSimulationOption['label'];
  if (typeof option === 'string') {
    const assets = metadataAssetsForOption(metadata, fallbackLabel);
    return {
      label: fallbackLabel,
      text: assets.length || hasUnsafeOfficialText(option) ? null : option,
      assets,
    };
  }
  const assets = option.assets?.length
    ? option.assets
    : metadataAssetsForOption(metadata, /^[A-E]$/.test(option.label) ? option.label : fallbackLabel);
  const text = option.text ?? null;
  return {
    label: /^[A-E]$/.test(option.label) ? option.label : fallbackLabel,
    text: assets.length || (text !== null && hasUnsafeOfficialText(text)) ? null : text,
    assets,
  };
}

function normalizeEnemSimulationAttempt(attempt: EnemSimulationAttempt): EnemSimulationAttempt {
  return {
    ...attempt,
    questions: (attempt.questions ?? []).map((question) => {
      const metadata = question.metadata ?? {};
      const sourceReference = question.source_reference
        ?? normalizeEnemSourceReference(metadata.source_reference)
        ?? normalizeEnemSourceReference(metadata.source_provenance)
        ?? normalizeEnemSourceReference({
          source_year: metadata.source_year ?? question.source_year,
          source_exam: metadata.source_exam ?? (question.source_kind === 'OFFICIAL_OCCURRENCE' ? 'ENEM' : null),
          source_application: metadata.source_application,
          source_question_number: metadata.source_question_number ?? question.question_number,
          source_day: metadata.source_day,
          source_url: metadata.source_url,
          source_provider: metadata.source_provider,
        });
      const statementAssets = question.statement_assets?.length
        ? question.statement_assets
        : Array.isArray(metadata.statement_assets)
          ? metadata.statement_assets.map(normalizeEnemSimulationAsset).filter((asset): asset is EnemSimulationOptionAsset => Boolean(asset))
          : [];
      return {
        ...question,
        question_number: question.question_number ?? (typeof metadata.source_question_number === 'number' ? metadata.source_question_number : null),
        structured_content: question.structured_content
          ? {
            ...question.structured_content,
            content_blocks: question.structured_content.content_blocks
              ?? (Array.isArray(metadata.content_blocks) ? metadata.content_blocks as EnemContentBlock[] : undefined),
            source_reference: question.structured_content.source_reference
              ?? sourceReference,
          }
          : question.structured_content,
        source_reference: sourceReference,
        statement_assets: statementAssets,
        options: (question.options ?? []).map((option, index) =>
          normalizeEnemSimulationOption(option, index, metadata)),
      };
    }),
  };
}

export interface EnemSimulationAttempt {
  attempt_id: string;
  simulation_id: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  content_revision: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  total_questions: number;
  score: number;
  correct_count: number;
  answers: Record<string, { answer: unknown; is_correct?: boolean | null }>;
  navigation_state: { current_index?: number; flagged?: string[] } | null;
  simulation: Pick<EnemSimulationTemplate, 'id' | 'title' | 'simulation_type' | 'area' | 'question_count' | 'duration_minutes' | 'metadata'> | null;
  questions: EnemSimulationQuestion[];
}

export interface LearningSimulationAssignment {
  assignment_id: string;
  simulation_id: string;
  title: string;
  simulation_type?: LearningSimulation['simulation_type'] | string;
  area?: string | null;
  source_year?: number | null;
  question_count?: number;
  duration_minutes?: number | null;
  assigned_by_name?: string | null;
  class_id?: string | null;
  class_name?: string | null;
  student_id?: string | null;
  student_name?: string | null;
  available_from?: string;
  due_at: string | null;
  assignment_status?: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ACTIVE' | 'CANCELLED' | string;
  status?: string;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
}

export interface LearningSimulationResults {
  assignment_id: string;
  simulation_id: string;
  summary: {
    assigned: number;
    started: number;
    completed: number;
    not_started: number;
    completion_rate: number;
    average_raw_accuracy: number;
  };
  students: Array<{
    student_id: string;
    student_name: string;
    status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED';
    score: number | null;
    correct_count: number | null;
    total_questions: number | null;
    completed_at: string | null;
  }>;
  area_breakdown: Record<string, { correct: number; total: number }>;
  skill_breakdown: Record<string, { correct: number; total: number }>;
}

export interface LearningPedagogicalReview {
  id: string;
  question_bank_id: string;
  state: 'AUTO_CLASSIFIED' | 'HUMAN_REVIEW_PENDING' | 'HUMAN_REVIEWED' | 'NEEDS_CORRECTION';
  source_year: number | null;
  source_name: string | null;
  source_reference: string | null;
  statement: string;
  source_options: string[];
  official_answer: unknown;
  source_subject_area: string;
  suggested_subject_area: string | null;
  topic: string | null;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | null;
  primary_canonical_skill_id: string | null;
  primary_skill_title: string | null;
  supporting_canonical_skill_ids: string[];
  explanation: string | null;
  misconception: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMAPPED';
  reviewed_at: string | null;
}

export interface LearningCanonicalSkillOption {
  id: string;
  title: string;
  subject_area: string | null;
}

export interface LearningTeacherStudent {
  student_id: string;
  full_name: string;
  class_id: string;
  class_name: string;
  open_error_count: number;
  average_mastery: number;
  active_session_status: GuidedSession['status'] | null;
  target_skill_title: string | null;
}

export interface LearningTeacherStudentDetail {
  student: {
    id: string;
    full_name: string;
    class_id: string;
    class_name: string;
  };
  progress: Array<{
    canonical_skill_id: string;
    skill_title: string;
    state: string;
    mastery_estimate: number;
    evidence_count: number;
    confidence: number;
    updated_at: string;
  }>;
  open_errors: Array<{
    id: string;
    question_id: string | null;
    question_bank_id: string | null;
    canonical_skill_id: string | null;
    error_count: number;
    last_missed_at: string;
    last_reviewed_at: string | null;
  }>;
  guided_sessions: Array<{
    id: string;
    target_canonical_skill_id: string;
    target_skill_title: string;
    status: GuidedSession['status'];
    started_at: string;
    completed_at: string | null;
    steps: Array<{ id: string; step_type: string; position: number; status: string; attempts: number; title: string }>;
  }>;
  recent_attempts: Array<{
    id: string;
    activity_id: string;
    activity_title: string;
    score: number;
    total_points: number;
    completed_at: string;
  }>;
}

export interface LearningErrorReview {
  error_id: string;
  source: 'ACTIVITY' | 'QUESTION_BANK';
  question_id?: string;
  activity_id?: string;
  question_bank_id?: string;
  canonical_skill_id: string | null;
  question_type: LearningQuestion['question_type'];
  statement: string;
  options: string[];
  subject_area?: string;
  topic?: string | null;
  error_count: number;
}

export interface LearningErrorReviewResult {
  error_id: string;
  is_correct: boolean;
  correct_answer: unknown;
  explanation: string | null;
  status: 'OPEN' | 'RESOLVED';
}

export interface LearningPackage {
  id: string;
  package_type: 'TECESCOLA' | 'INSTITUTION' | 'TEACHER';
  visibility: 'GLOBAL' | 'INSTITUTION' | 'PRIVATE';
  title: string;
  description: string | null;
  subject_area: string | null;
  learning_package_steps?: Array<{
    id: string;
    position: number;
    step_type: string;
    title: string;
    lesson_id: string | null;
    activity_id: string | null;
  }>;
}

export interface LearningPackageAssignment {
  id: string;
  package_id: string;
  class_id: string | null;
  student_id: string | null;
  due_at: string | null;
  access_source?: 'EXPLICIT_ASSIGNMENT' | 'AUTOMATIC_DEFAULT';
  learning_packages?: LearningPackage | LearningPackage[] | null;
}

export interface LearningProgress {
  skill_id: string;
  mastery_percent: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'MASTERED';
}

export interface LearningCanonicalProgress {
  canonical_skill_id: string;
  skill_title: string;
  state: 'UNKNOWN' | 'INTRODUCED' | 'LEARNING' | 'PRACTICING' | 'MASTERED' | 'NEEDS_REVIEW';
  mastery_estimate: number;
  evidence_count: number;
  confidence: number;
  updated_at: string;
}

type LearningCanonicalProgressRow = Omit<LearningCanonicalProgress, 'skill_title'> & {
  learning_curriculum_skills?: { title: string } | { title: string }[] | null;
};

export interface LearningSkillReview {
  id: string;
  canonical_skill_id: string;
  skill_title?: string;
  review_due_at: string;
  interval_days: number;
  source: 'PRACTICE' | 'LOCK_IN' | 'REVIEW' | 'SIMULATION';
  completed_at: string | null;
  result_score: number | null;
}

export interface LearningClassGap {
  canonical_skill_id: string;
  skill_title: string;
  needs_review_count: number;
  learning_count: number;
  diagnostic_needed_count: number;
}

export interface LearningAttemptSummary {
  id: string;
  activity_id: string;
  student_id: string;
  score: number;
  total_points: number;
  completed_at: string | null;
  learning_activities?: {
    title: string;
    skill_id: string | null;
    teacher_id: string;
  } | {
    title: string;
    skill_id: string | null;
    teacher_id: string;
  }[] | null;
  students?: {
    profiles?: { full_name: string } | { full_name: string }[] | null;
  } | {
    profiles?: { full_name: string } | { full_name: string }[] | null;
  }[] | null;
}

const teacherActivitySelect =
  'id,subject_id,unit_id,skill_id,teacher_id,title,description,activity_type,status,created_at,subjects(name),learning_questions(id,question_bank_id,question_text,question_type,options_json,correct_answer_json,explanation,points,sort_order),learning_assignments(id,class_id,due_at,classes(name))';

async function read<T>(
  query: PromiseLike<{
    data: T | null;
    error: { message: string } | null;
  }>,
): Promise<T> {
  const result = await query;

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []) as T;
}

async function uniqueIds(
  query: PromiseLike<{
    data: Array<{
      id?: string;
      subject_id?: string;
      class_id?: string;
    }> | null;
    error: { message: string } | null;
  }>,
  key: 'id' | 'subject_id' | 'class_id',
): Promise<string[]> {
  const rows = await read(query);
  return [
    ...new Set(
      rows
        .map((row) => row[key])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

export const learningCenterService = {
  subjects: (institutionId: string) =>
    read<LearningSubject[]>(
      supabase
        .from('subjects')
        .select('id,name')
        .eq('institution_id', institutionId)
        .eq('active', true)
        .order('name'),
    ),

  studentForProfile: (institutionId: string, profileId: string) =>
    read<LearningStudent>(
      supabase
        .from('students')
        .select('id,profile_id')
        .eq('institution_id', institutionId)
        .eq('profile_id', profileId)
        .eq('active', true)
        .single(),
    ),

  studentSubjects: async (institutionId: string, profileId: string) => {
    const student = await learningCenterService.studentForProfile(
      institutionId,
      profileId,
    );
    const classIds = await uniqueIds(
      supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', student.id)
        .eq('active', true),
      'class_id',
    );

    if (!classIds.length) return [];

    const subjectIds = await uniqueIds(
      supabase
        .from('subject_offerings')
        .select('subject_id')
        .in('class_id', classIds)
        .eq('active', true),
      'subject_id',
    );

    if (!subjectIds.length) return [];

    return read<LearningSubject[]>(
      supabase
        .from('subjects')
        .select('id,name')
        .eq('institution_id', institutionId)
        .eq('active', true)
        .in('id', subjectIds)
        .order('name'),
    );
  },

  teacherSubjects: async (institutionId: string, teacherId: string) => {
    const subjectIds = await uniqueIds(
      supabase
        .from('subject_offerings')
        .select('subject_id')
        .eq('teacher_profile_id', teacherId)
        .eq('active', true),
      'subject_id',
    );

    if (!subjectIds.length) return [];

    return read<LearningSubject[]>(
      supabase
        .from('subjects')
        .select('id,name')
        .eq('institution_id', institutionId)
        .eq('active', true)
        .in('id', subjectIds)
        .order('name'),
    );
  },

  teacherClasses: async (institutionId: string, teacherId: string) => {
    const classIds = await uniqueIds(
      supabase
        .from('subject_offerings')
        .select('class_id')
        .eq('teacher_profile_id', teacherId)
        .eq('active', true),
      'class_id',
    );

    if (!classIds.length) return [];

    return read<LearningClass[]>(
      supabase
        .from('classes')
        .select('id,name')
        .in('id', classIds)
        .eq('institution_id', institutionId)
        .eq('active', true)
        .order('name'),
    );
  },

  teacherClassesForSubject: async (
    institutionId: string,
    teacherId: string,
    subjectId: string,
  ) => {
    const classIds = await uniqueIds(
      supabase
        .from('subject_offerings')
        .select('class_id')
        .eq('teacher_profile_id', teacherId)
        .eq('subject_id', subjectId)
        .eq('active', true),
      'class_id',
    );

    if (!classIds.length) return [];

    return read<LearningClass[]>(
      supabase
        .from('classes')
        .select('id,name')
        .eq('institution_id', institutionId)
        .in('id', classIds)
        .eq('active', true)
        .order('name'),
    );
  },

  teacherLearningSubjects: (institutionId: string) =>
    read<TeacherLearningSubjectRow[]>(
      supabase.rpc('list_teacher_learning_subjects', {
        p_institution_id: institutionId,
      }),
    ).then((rows) => rows.map((row) => ({ id: row.subject_id, name: row.subject_name }))),

  teacherLearningClasses: (institutionId: string, subjectId: string) =>
    read<TeacherLearningClassRow[]>(
      supabase.rpc('list_teacher_learning_classes', {
        p_institution_id: institutionId,
        p_subject_id: subjectId,
      }),
    ).then((rows) => rows.map((row) => ({ id: row.class_id, name: row.class_name }))),

  studentCollections: (institutionId: string) =>
    read<LearningCollection[]>(
      supabase
        .from('learning_collections')
        .select('id,subject_id,class_id,teacher_id,title,description,status,learning_resources(id,collection_id,title,description,provider,resource_type,source_url,thumbnail_url)')
        .eq('institution_id', institutionId)
        .eq('status', 'PUBLISHED')
        .order('created_at', { ascending: false }),
    ),

  teacherCollections: (institutionId: string, teacherId: string) =>
    read<LearningCollection[]>(
      supabase
        .from('learning_collections')
        .select('id,subject_id,class_id,teacher_id,title,description,status,learning_resources(id,collection_id,title,description,provider,resource_type,source_url,thumbnail_url)')
        .eq('institution_id', institutionId)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false }),
    ),

  units: (institutionId: string, subjectId?: string) => {
    let query = supabase
      .from('learning_units')
      .select('id,subject_id,title,description,sort_order')
      .eq('institution_id', institutionId)
      .eq('active', true)
      .order('sort_order');

    if (subjectId) query = query.eq('subject_id', subjectId);
    return read<LearningUnit[]>(query);
  },

  skills: (institutionId: string, unitId?: string) => {
    let query = supabase
      .from('learning_skills')
      .select('id,unit_id,title,description,sort_order')
      .eq('institution_id', institutionId)
      .eq('active', true)
      .order('sort_order');

    if (unitId) query = query.eq('unit_id', unitId);
    return read<LearningSkill[]>(query);
  },

  createUnit: (input: {
    institution_id: string;
    subject_id: string;
    title: string;
    description?: string;
  }) =>
    read<{ id: string }>(
      supabase
        .from('learning_units')
        .insert(input)
        .select('id')
        .single(),
    ),

  createSkill: (input: {
    institution_id: string;
    unit_id: string;
    title: string;
    description?: string;
  }) =>
    read<{ id: string }>(
      supabase
        .from('learning_skills')
        .insert(input)
        .select('id')
        .single(),
    ),

  createCollection: (input: {
    institution_id: string;
    subject_id: string;
    class_id: string;
    teacher_id: string;
    title: string;
    description?: string;
  }) =>
    read<{ id: string }>(
      supabase
        .from('learning_collections')
        .insert({ ...input, status: 'PUBLISHED' })
        .select('id')
        .single(),
    ),

  createResource: (input: {
    institution_id: string;
    collection_id: string;
    title: string;
    description?: string;
    provider?: string;
    resource_type: 'VIDEO' | 'LINK' | 'RESOURCE';
    source_url: string;
    thumbnail_url?: string;
  }) =>
    read<{ id: string }>(
      supabase
        .from('learning_resources')
        .insert({ ...input, approved: true })
        .select('id')
        .single(),
    ),

  publishedActivities: (institutionId: string) =>
    read<LearningActivity[]>(
      supabase.rpc('list_student_learning_activities', {
        p_institution_id: institutionId,
      }),
    ),

  teacherActivities: (institutionId: string, teacherId: string) =>
    read<LearningActivity[]>(
      supabase
        .from('learning_activities')
        .select(teacherActivitySelect)
        .eq('institution_id', institutionId)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false }),
    ),

  progress: (institutionId: string, studentId: string) =>
    read<LearningProgress[]>(
      supabase
        .from('learning_skill_progress')
        .select('skill_id,mastery_percent,status')
        .eq('institution_id', institutionId)
      .eq('student_id', studentId),
    ),

  canonicalProgress: (institutionId: string, studentId: string) =>
    read<LearningCanonicalProgressRow[]>(
      supabase
        .from('learning_student_skill_state')
        .select('canonical_skill_id,state,mastery_estimate,evidence_count,confidence,updated_at,learning_curriculum_skills(title)')
        .eq('institution_id', institutionId)
        .eq('student_id', studentId)
        .order('updated_at', { ascending: false }),
    ).then((rows) => rows.map((row): LearningCanonicalProgress => ({
      canonical_skill_id: row.canonical_skill_id,
      skill_title: Array.isArray(row.learning_curriculum_skills) ? row.learning_curriculum_skills[0]?.title ?? 'Habilidade' : row.learning_curriculum_skills?.title ?? 'Habilidade',
      state: row.state,
      mastery_estimate: Number(row.mastery_estimate),
      evidence_count: Number(row.evidence_count),
      confidence: Number(row.confidence),
      updated_at: row.updated_at,
    }))),

  canonicalSkills: () =>
    read<LearningCanonicalSkillOption[]>(
      supabase
        .from('learning_curriculum_skills')
        .select('id,title,subject_area')
        .eq('active', true)
        .order('subject_area')
        .order('title'),
    ),

  reviewsDue: (institutionId: string, studentId: string) =>
    read<Array<LearningSkillReview & { learning_curriculum_skills?: { title: string } | { title: string }[] | null }>>(
      supabase
        .from('learning_skill_reviews')
        .select('id,canonical_skill_id,review_due_at,interval_days,source,completed_at,result_score,learning_curriculum_skills(title)')
        .eq('institution_id', institutionId)
        .eq('student_id', studentId)
        .is('completed_at', null)
        .order('review_due_at', { ascending: true })
        .limit(20),
    ).then((rows) => rows.map((row) => ({
      id: row.id,
      canonical_skill_id: row.canonical_skill_id,
      skill_title: Array.isArray(row.learning_curriculum_skills)
        ? row.learning_curriculum_skills[0]?.title
        : row.learning_curriculum_skills?.title,
      review_due_at: row.review_due_at,
      interval_days: row.interval_days,
      source: row.source,
      completed_at: row.completed_at,
      result_score: row.result_score,
    }))),

  completeDailyPlanItem: (itemId: string, status: 'COMPLETED' | 'SKIPPED' = 'COMPLETED') =>
    read<{ item_id: string; idempotent: boolean; status: string; plan_status?: string }>(
      supabase.rpc('complete_learning_daily_plan_item', { p_item_id: itemId, p_status: status }),
    ),

  completeSkillReview: (reviewId: string, score: number) =>
    read<{ review_id: string; idempotent: boolean; score: number; next_interval_days?: number }>(
      supabase.rpc('complete_learning_skill_review', { p_review_id: reviewId, p_score: score }),
    ),

  guidedSession: (institutionId: string, studentId: string) =>
    read<GuidedSession | null>(
      supabase
        .from('learning_guided_sessions')
        .select('id,target_canonical_skill_id,status,started_at,completed_at,learning_guided_steps(id,canonical_skill_id,step_type,position,status,activity_id,lesson_id,attempts,learning_curriculum_skills(title))')
        .eq('institution_id', institutionId)
        .eq('student_id', studentId)
        .in('status', ['ACTIVE', 'PAUSED', 'NEEDS_TEACHER_SUPPORT'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),

  guidedSessionV2: (institutionId: string, studentId: string) =>
    (async () => {
      const v4 = await supabase.rpc('get_guided_learning_session_v4', { p_institution_id: institutionId, p_student_id: studentId });
      if (!v4.error && v4.data) return v4.data as GuidedSessionV2;
      return read<GuidedSessionV2 | null>(supabase.rpc('get_guided_learning_session_v2', { p_institution_id: institutionId, p_student_id: studentId }));
    })(),

  guidedStepV2: (stepId: string) =>
    (async () => {
      const v4 = await supabase.rpc('get_guided_learning_step_v4', { p_step_id: stepId });
      if (!v4.error && v4.data) return v4.data as GuidedStepV2;
      return read<GuidedStepV2>(supabase.rpc('get_guided_learning_step_v2', { p_step_id: stepId }));
    })(),

  startGuidedSession: (input: {
    institutionId: string;
    studentId: string;
    targetCanonicalSkillId: string;
  }) =>
    read<{ session_id: string; created: boolean; gap_count?: number }>(
      supabase.rpc('start_guided_learning_session', {
        p_institution_id: input.institutionId,
        p_student_id: input.studentId,
        p_target_canonical_skill_id: input.targetCanonicalSkillId,
      }),
    ),

  startGuidedSessionV2: (input: {
    institutionId: string;
    studentId: string;
    targetCanonicalSkillId: string;
  }) =>
    (async () => {
      const v4 = await supabase.rpc('start_guided_learning_session_v4', { p_institution_id: input.institutionId, p_student_id: input.studentId, p_target_canonical_skill_id: input.targetCanonicalSkillId });
      if (!v4.error && v4.data) return v4.data as { session_id: string; created: boolean; current_step_id: string | null; engine_version: 'V4' };
      // V4 deliberately refuses to cancel an active/paused V2 or V3 session.
      // V2's compatibility start is idempotent for V2, but its legacy branch
      // predates V3, so inspect the scoped session first to avoid cancelling it.
      if (v4.error?.message?.includes('LEARNING_V4_EXISTING_SESSION_OTHER_ENGINE')) {
        const existing = await supabase
          .from('learning_guided_sessions')
          .select('id,current_step_id,planner_version')
          .eq('institution_id', input.institutionId)
          .eq('student_id', input.studentId)
          .eq('target_canonical_skill_id', input.targetCanonicalSkillId)
          .in('status', ['ACTIVE', 'PAUSED'])
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const plannerVersion = existing.data?.planner_version as 'V2' | 'V3' | 'V4' | null | undefined;
        if (!existing.error && existing.data && plannerVersion && plannerVersion !== 'V2') {
          return {
            session_id: existing.data.id,
            created: false,
            current_step_id: existing.data.current_step_id,
            engine_version: plannerVersion,
          } as { session_id: string; created: boolean; current_step_id: string | null; engine_version: 'V3' | 'V4' };
        }
      }
      // For V2, the V2 RPC returns the existing session without creating a
      // duplicate. Other V4 errors retain the established compatibility path.
      return read<{ session_id: string; created: boolean; current_step_id: string | null; engine_version: 'V2' }>(supabase.rpc('start_guided_learning_session_v2', { p_institution_id: input.institutionId, p_student_id: input.studentId, p_target_canonical_skill_id: input.targetCanonicalSkillId }));
    })(),

  completeGuidedStep: (stepId: string, status: 'COMPLETED' | 'SKIPPED' = 'COMPLETED', metadata: Record<string, unknown> = {}) =>
    read<{ step_id: string; session_id: string; next_step_id?: string | null; session_status?: string; retry?: boolean; needs_teacher_support?: boolean }>(
      supabase.rpc('complete_guided_learning_step', {
        p_step_id: stepId,
        p_status: status,
        p_metadata: metadata,
      }),
    ),

  advanceGuidedSessionV2: (input: { sessionId: string; stepId: string; action: 'LESSON_COMPLETED' | 'TARGET_RETURNED' | 'REVIEW_REQUESTED'; idempotencyKey: string }) =>
    (async () => {
      const v4 = await supabase.rpc('advance_guided_learning_session_v4', { p_session_id: input.sessionId, p_step_id: input.stepId, p_action: input.action, p_idempotency_key: input.idempotencyKey });
      if (!v4.error && v4.data) return v4.data as { session_id: string; step_id: string; idempotent: boolean; current_step_id: string | null; session_status: string };
      return read<{ session_id: string; step_id: string; idempotent: boolean; current_step_id: string | null; session_status: string }>(supabase.rpc('advance_guided_learning_session_v2', { p_session_id: input.sessionId, p_step_id: input.stepId, p_action: input.action, p_idempotency_key: input.idempotencyKey }));
    })(),

  submitGuidedStepV2: (input: { stepId: string; answers: Array<{ question_bank_id: string; answer: unknown }>; idempotencyKey: string }) =>
    (async () => {
      const v4 = await supabase.rpc('submit_guided_learning_step_v4', { p_step_id: input.stepId, p_answers: input.answers, p_idempotency_key: input.idempotencyKey });
      if (!v4.error && v4.data) return v4.data as GuidedStepAttemptResultV2;
      return read<GuidedStepAttemptResultV2>(supabase.rpc('submit_guided_learning_step_v2', { p_step_id: input.stepId, p_answers: input.answers, p_idempotency_key: input.idempotencyKey }));
    })(),

  dailyPlan: async (institutionId: string, studentId: string, planDate = new Date().toISOString().slice(0, 10)) => {
    const planId = await read<string>(
      supabase.rpc('create_or_get_learning_daily_plan', {
        p_institution_id: institutionId,
        p_student_id: studentId,
        p_plan_date: planDate,
      }),
    );
    return read<DailyPlan>(
      supabase
        .from('learning_daily_plans')
        .select('id,plan_date,estimated_minutes,status,learning_daily_plan_items(id,position,item_type,title,description,estimated_minutes,status,session_id,step_id,lesson_id,activity_id)')
        .eq('id', planId)
        .single(),
    );
  },

  gamification: (institutionId: string, studentId: string) =>
    read<LearningGamification | null>(
      supabase
        .from('learning_student_gamification')
        .select('xp,current_streak,longest_streak,daily_goal_minutes,last_qualified_activity_date')
        .eq('institution_id', institutionId)
        .eq('student_id', studentId)
        .maybeSingle(),
    ),

  errorNotebook: (institutionId: string, studentId: string) =>
    read<LearningErrorNote[]>(
      supabase
        .from('learning_error_notebook')
        .select('id,question_id,question_bank_id,canonical_skill_id,error_count,status,last_missed_at,last_reviewed_at')
        .eq('institution_id', institutionId)
        .eq('student_id', studentId)
        .eq('status', 'OPEN')
        .order('last_missed_at', { ascending: false }),
    ),

  errorReview: (errorId: string) =>
    read<LearningErrorReview>(
      supabase.rpc('get_learning_error_review', { p_error_id: errorId }),
    ),

  submitErrorReview: (errorId: string, answer: unknown) =>
    read<LearningErrorReviewResult>(
      supabase.rpc('submit_learning_error_review', {
        p_error_id: errorId,
        p_answer: answer,
      }),
    ),

  lesson: (lessonId: string) =>
    read<LearningLesson>(
      supabase
        .from('learning_skill_lessons')
        .select('id,canonical_skill_id,title,summary,content_markdown,worked_example,tips,estimated_minutes')
        .eq('id', lessonId)
        .eq('active', true)
        .single(),
    ),

  questionBank: (institutionId: string) =>
    read<LearningQuestionBankItem[]>(
      supabase.rpc('list_teacher_learning_question_bank', {
        p_institution_id: institutionId,
      }),
    ),

  teacherClassGaps: (institutionId: string, classId: string) =>
    read<LearningClassGap[]>(
      supabase.rpc('get_teacher_learning_class_gaps', {
        p_institution_id: institutionId,
        p_class_id: classId,
      }),
    ).then((rows) => rows.map((row) => ({
      canonical_skill_id: row.canonical_skill_id,
      skill_title: row.skill_title,
      needs_review_count: Number(row.needs_review_count),
      learning_count: Number(row.learning_count),
      diagnostic_needed_count: Number(row.diagnostic_needed_count),
    }))),

  simulations: (institutionId: string) =>
    read<LearningSimulation[]>(
      supabase
        .from('learning_simulations')
        .select('id,title,simulation_type,area,source_year,question_count,duration_minutes,metadata,learning_simulation_questions(position,learning_question_bank(id,statement,options))')
        .eq('status', 'PUBLISHED')
        .or(`institution_id.is.null,institution_id.eq.${institutionId}`)
        .order('created_at', { ascending: false }),
    ),

  enemSimulationTemplates: (institutionId: string) =>
    read<EnemSimulationTemplate[]>(supabase.rpc('list_enem_simulation_templates_v2', {
      p_institution_id: institutionId,
    })),

  packages: (institutionId: string) =>
    read<LearningPackage[]>(
      supabase
        .from('learning_packages')
        .select('id,package_type,visibility,title,description,subject_area,learning_package_steps(id,position,step_type,title,lesson_id,activity_id)')
        .eq('active', true)
        .or(`institution_id.is.null,institution_id.eq.${institutionId}`)
        .order('created_at', { ascending: false }),
    ),

  studentPackages: async (institutionId: string, studentId: string) => {
    const legacySelect = 'id,package_id,class_id,student_id,due_at,learning_packages(id,package_type,visibility,title,description,subject_area,learning_package_steps(id,position,step_type,title,lesson_id,activity_id))';
    const automatic = await supabase.rpc('list_student_learning_packages', {
      p_institution_id: institutionId,
      p_student_id: studentId,
    });
    if (!automatic.error) {
      const legacy = await read<LearningPackageAssignment[]>(
        supabase
          .from('learning_package_assignments')
          .select(legacySelect)
          .eq('institution_id', institutionId)
          .or(`student_id.eq.${studentId},student_id.is.null`)
          .order('created_at', { ascending: false }),
      );
      const explicitPackageIds = new Set(legacy.map((assignment) => assignment.package_id));
      const automaticRows = (automatic.data ?? []).filter((row) => !explicitPackageIds.has(row.package_id));
      return [
        ...legacy.map((assignment) => ({ ...assignment, access_source: 'EXPLICIT_ASSIGNMENT' as const })),
        ...automaticRows.map((row) => ({
        id: row.access_id,
        package_id: row.package_id,
        class_id: row.class_id,
        student_id: row.student_id,
        due_at: row.due_at,
        access_source: row.access_source,
        learning_packages: row.learning_packages,
        })),
      ] as LearningPackageAssignment[];
    }

    const rpcError = automatic.error as { code?: string; message?: string };
    const functionIsUnavailable =
      rpcError.code === 'PGRST202' ||
      rpcError.code === '42883' ||
      /function .*list_student_learning_packages.*(does not exist|not found)/i.test(rpcError.message ?? '');

    if (!functionIsUnavailable) throw new Error(rpcError.message ?? 'LEARNING_PACKAGE_AVAILABILITY_FAILED');

    // Keep legacy installations readable until the availability RPC is applied.
    return read<LearningPackageAssignment[]>(
      supabase
        .from('learning_package_assignments')
        .select(legacySelect)
        .eq('institution_id', institutionId)
        .or(`student_id.eq.${studentId},student_id.is.null`)
        .order('created_at', { ascending: false }),
    ).then((rows) => rows.map((assignment) => ({
      ...assignment,
      access_source: 'EXPLICIT_ASSIGNMENT' as const,
    })));
  },

  assignPackage: (input: {
    institutionId: string;
    packageId: string;
    classId?: string;
    studentId?: string;
    dueAt?: string;
  }) =>
    read<string>(
      supabase.rpc('assign_learning_package', {
        p_institution_id: input.institutionId,
        p_package_id: input.packageId,
        p_class_id: input.classId ?? null,
        p_student_id: input.studentId ?? null,
        p_due_at: input.dueAt ?? null,
      }),
    ),

  startSimulation: (input: { institutionId: string; studentId: string; simulationId: string }) =>
    read<string>(supabase.rpc('start_learning_simulation_attempt', {
      p_institution_id: input.institutionId,
      p_student_id: input.studentId,
      p_simulation_id: input.simulationId,
    })),

  startEnemSimulation: (input: { institutionId: string; studentId: string; simulationId: string; languageChoice?: 'ENGLISH' | 'SPANISH' }) =>
    read<{ attempt_id: string; created: boolean; question_count: number; language_choice: string | null; content_revision?: string }>(supabase.rpc('start_enem_simulation_attempt_v2', {
      p_institution_id: input.institutionId,
      p_student_id: input.studentId,
      p_simulation_id: input.simulationId,
      p_language_choice: input.languageChoice ?? null,
    })),

  getEnemSimulationAttempt: (attemptId: string) =>
    read<EnemSimulationAttempt>(supabase.rpc('get_enem_simulation_attempt_v2', {
      p_attempt_id: attemptId,
    })).then(normalizeEnemSimulationAttempt),

  submitSimulation: (attemptId: string, answers: Array<{ question_bank_id: string; answer: unknown }>, durationSeconds: number) =>
    read<{ attempt_id: string; score: number; correct_count: number; total_questions: number; area_breakdown?: Record<string, { correct: number; total: number }>; skill_breakdown?: Record<string, { correct: number; total: number }> }>(supabase.rpc('submit_learning_simulation_attempt', {
      p_attempt_id: attemptId,
      p_answers: answers,
      p_duration_seconds: durationSeconds,
    })),

  submitEnemSimulation: (attemptId: string, answers: Array<{ question_bank_id: string; answer: string }>, durationSeconds: number) =>
    read<{ attempt_id: string; score: number; correct_count: number; total_questions: number; answers: Record<string, { answer: unknown; is_correct?: boolean | null }>; area_breakdown?: Record<string, { correct: number; total: number }>; skill_breakdown?: Record<string, { correct: number; total: number }> }>(supabase.rpc('submit_enem_simulation_attempt_v2', {
      p_attempt_id: attemptId,
      p_answers: answers,
      p_duration_seconds: durationSeconds,
    })),

  saveSimulationAnswers: (attemptId: string, answers: Array<{ question_bank_id: string; answer: unknown }>) =>
    read<{ attempt_id: string; answers: Record<string, { answer: unknown; is_correct?: boolean | null }> }>(supabase.rpc('save_learning_simulation_attempt_answers', {
      p_attempt_id: attemptId,
      p_answers: answers,
    })),

  saveEnemSimulationAnswers: (attemptId: string, answers: Array<{ question_bank_id: string; answer: string }>) =>
    read<{ attempt_id: string; answers: Record<string, { answer: unknown }> }>(supabase.rpc('save_enem_simulation_attempt_answers_v2', {
      p_attempt_id: attemptId,
      p_answers: answers,
    })),

  saveSimulationNavigation: (attemptId: string, navigation: { current_index: number; flagged: string[] }) =>
    read<{ attempt_id: string; navigation_state: { current_index: number; flagged: string[] } }>(supabase.rpc('save_learning_simulation_attempt_navigation', {
      p_attempt_id: attemptId,
      p_navigation: navigation,
    })),

  simulationAttempts: (institutionId: string, studentId: string) =>
    read<LearningSimulationAttempt[]>(
      supabase
        .from('learning_simulation_attempts')
        .select('id,simulation_id,status,content_revision,started_at,completed_at,duration_seconds,score,correct_count,total_questions,area_breakdown,skill_breakdown,answers,navigation_state,learning_simulations(title,simulation_type)')
        .eq('institution_id', institutionId)
        .eq('student_id', studentId)
        .order('started_at', { ascending: false })
        .limit(20),
    ),

  assignSimulation: (input: {
    institutionId: string;
    simulationId: string;
    classId?: string;
    studentId?: string;
    availableFrom?: string;
    dueAt?: string;
  }) =>
    read<string>(supabase.rpc('assign_learning_simulation', {
      p_institution_id: input.institutionId,
      p_simulation_id: input.simulationId,
      p_class_id: input.classId ?? null,
      p_student_id: input.studentId ?? null,
      p_available_from: input.availableFrom ?? null,
      p_due_at: input.dueAt ?? null,
    })),

  studentSimulationAssignments: (institutionId: string, studentId: string) =>
    read<LearningSimulationAssignment[]>(supabase.rpc('list_student_learning_simulation_assignments', {
      p_institution_id: institutionId,
      p_student_id: studentId,
    })),

  teacherSimulationAssignments: (institutionId: string) =>
    read<LearningSimulationAssignment[]>(supabase.rpc('list_teacher_learning_simulation_assignments', {
      p_institution_id: institutionId,
    })),

  teacherSimulationResults: (institutionId: string, assignmentId: string) =>
    read<LearningSimulationResults>(supabase.rpc('get_teacher_learning_simulation_results', {
      p_institution_id: institutionId,
      p_assignment_id: assignmentId,
    })),

  pedagogicalReviews: (institutionId: string, state?: string) =>
    read<LearningPedagogicalReview[]>(supabase.rpc('list_teacher_learning_pedagogical_reviews', {
      p_institution_id: institutionId,
      p_state: state ?? null,
      p_limit: 40,
    })),

  reviewPedagogicalItem: (input: {
    institutionId: string;
    reviewId: string;
    state: LearningPedagogicalReview['state'];
    suggestedSubjectArea: string;
    topic: string;
    difficulty: LearningPedagogicalReview['difficulty'];
    primaryCanonicalSkillId: string | null;
    supportingCanonicalSkillIds?: string[];
    explanation: string;
    misconception: string;
    confidence: LearningPedagogicalReview['confidence'];
  }) =>
    read<string>(supabase.rpc('review_teacher_learning_item', {
      p_institution_id: input.institutionId,
      p_review_id: input.reviewId,
      p_state: input.state,
      p_suggested_subject_area: input.suggestedSubjectArea || null,
      p_topic: input.topic || null,
      p_difficulty: input.difficulty || null,
      p_primary_canonical_skill_id: input.primaryCanonicalSkillId,
      p_supporting_canonical_skill_ids: input.supportingCanonicalSkillIds ?? [],
      p_explanation: input.explanation || null,
      p_misconception: input.misconception || null,
      p_confidence: input.confidence,
    })),

  teacherStudents: (institutionId: string, classId: string, subjectId: string) =>
    read<LearningTeacherStudent[]>(
      supabase.rpc('list_teacher_learning_students', {
        p_institution_id: institutionId,
        p_class_id: classId,
        p_subject_id: subjectId,
      }),
    ),

  teacherStudentDetail: (institutionId: string, studentId: string, classId: string, subjectId: string) =>
    read<LearningTeacherStudentDetail>(
      supabase.rpc('get_teacher_learning_student_detail', {
        p_institution_id: institutionId,
        p_student_id: studentId,
        p_class_id: classId,
        p_subject_id: subjectId,
      }),
    ),

  teacherAttempts: (institutionId: string, teacherId: string) =>
    read<LearningAttemptSummary[]>(
      supabase
        .from('learning_attempts')
        .select('id,activity_id,student_id,score,total_points,completed_at,learning_activities!inner(title,skill_id,teacher_id),students(profiles:profile_id(full_name))')
        .eq('institution_id', institutionId)
        .eq('learning_activities.teacher_id', teacherId)
        .order('completed_at', { ascending: false })
        .limit(20),
    ),

  createActivity: async (input: {
    institution_id: string;
    subject_id: string;
    unit_id?: string;
    skill_id?: string;
    teacher_id: string;
    title: string;
    description?: string;
    activity_type?: string;
    questions: (Omit<LearningQuestion, 'id' | 'correct_answer_json'> & {
      correct_answer_json: unknown;
    })[];
  }) => {
    const { questions, ...activityInput } = input;
    const activity = await read<{ id: string }>(
      supabase
        .from('learning_activities')
        .insert(activityInput)
        .select('id')
        .single(),
    );

    const rows = questions.map((question) => ({
      ...question,
      activity_id: activity.id,
      institution_id: input.institution_id,
    }));

    await read(supabase.from('learning_questions').insert(rows));
    return activity;
  },

  createActivityWithQuestions: async (input: {
    institution_id: string;
    subject_id: string;
    unit_id?: string;
    skill_id?: string;
    teacher_id: string;
    title: string;
    description?: string;
    activity_type?: string;
    questions: Array<{
      question_text: string;
      question_bank_id?: string;
      question_type: LearningQuestion['question_type'];
      options_json: string[];
      correct_answer_json: unknown;
      explanation?: string | null;
      points: number;
      sort_order: number;
    }>;
  }) => {
    const activityId = await read<string>(
      supabase.rpc('create_learning_activity_with_questions', {
        p_institution_id: input.institution_id,
        p_subject_id: input.subject_id,
        p_unit_id: input.unit_id ?? null,
        p_skill_id: input.skill_id ?? null,
        p_teacher_id: input.teacher_id,
        p_title: input.title,
        p_description: input.description ?? null,
        p_activity_type: input.activity_type ?? 'PRACTICE',
        p_questions: input.questions,
      }),
    );
    return { id: activityId };
  },

  updateActivityWithQuestions: async (input: {
    activity_id: string;
    title: string;
    description?: string;
    activity_type?: string;
    questions: Array<{
      question_text?: string;
      question_bank_id?: string;
      question_type: LearningQuestion['question_type'];
      options_json?: string[];
      correct_answer_json?: unknown;
      explanation?: string | null;
      points?: number;
      sort_order: number;
    }>;
  }) => read<{ id: string }>(
    supabase.rpc('update_learning_activity_with_questions', {
      p_activity_id: input.activity_id,
      p_title: input.title,
      p_description: input.description ?? null,
      p_activity_type: input.activity_type ?? 'PRACTICE',
      p_questions: input.questions,
    }),
  ).then((activity) => ({ id: activity.id })),

  publishActivity: (activityId: string) =>
    read<{ id: string }>(
      supabase
        .from('learning_activities')
        .update({
          status: 'PUBLISHED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', activityId)
        .select('id')
        .single(),
    ),

  publishAndAssignActivity: async (input: {
    activity_id: string;
    class_id: string;
    due_at?: string;
  }) => {
    const assignmentId = await read<string>(
      supabase.rpc('publish_learning_activity', {
        p_activity_id: input.activity_id,
        p_class_id: input.class_id,
        p_due_at: input.due_at ?? null,
      }),
    );

    return { id: assignmentId };
  },

  updateActivity: async (input: {
    activity_id: string;
    title: string;
    description?: string;
    activity_type: string;
    question_text: string;
    options_json: string[];
    correct_answer_json: string;
    explanation?: string;
  }) => {
    const activityId = await read<string>(
      supabase.rpc('update_learning_activity', {
        p_activity_id: input.activity_id,
        p_title: input.title,
        p_description: input.description ?? null,
        p_activity_type: input.activity_type,
        p_question_text: input.question_text,
        p_options_json: input.options_json,
        p_correct_answer_json: input.correct_answer_json,
        p_explanation: input.explanation ?? null,
      }),
    );

    return { id: activityId };
  },

  deleteActivity: (activityId: string) =>
    read<boolean>(supabase.rpc('delete_learning_activity', { p_activity_id: activityId })),

  assignActivity: (input: {
    institution_id: string;
    activity_id: string;
    class_id: string;
    assigned_by: string;
    due_at?: string;
  }) =>
    read<{ id: string }>(
      supabase
        .from('learning_assignments')
        .insert(input)
        .select('id')
        .single(),
    ),

  submitAttempt: (
    activityId: string,
    answers: Array<{ question_id: string; answer: unknown }>,
  ) =>
    read<{
      attempt_id: string;
      score: number;
      total_points: number;
      mastery_percent: number;
    }[]>(
      supabase.rpc('submit_learning_attempt', {
        p_activity_id: activityId,
        p_answers: answers,
      }),
    ),

  submitAttemptWithFeedback: (
    activityId: string,
    answers: Array<{ question_id: string; answer: unknown }>,
  ) =>
    read<{
      attempt_id: string;
      score: number;
      total_points: number;
      mastery_percent: number;
      feedback: Array<{
        question_id: string;
        is_correct: boolean;
        correct_answer: unknown;
        explanation: string | null;
      }>;
    }>(
      supabase.rpc('submit_learning_attempt_with_feedback', {
        p_activity_id: activityId,
        p_answers: answers,
      }),
    ),
};
