import { supabase } from '../lib/supabaseClient';

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
  subjects?: { name: string } | { name: string }[] | null;
  learning_questions?: LearningQuestion[];
}

export interface LearningQuestion {
  id: string;
  question_text: string;
  question_type:
    | 'MULTIPLE_CHOICE'
    | 'TRUE_FALSE'
    | 'SHORT_ANSWER';
  options_json: string[];
  correct_answer_json?: unknown;
  explanation: string | null;
  points: number;
  sort_order: number;
}

export interface LearningProgress {
  skill_id: string;
  mastery_percent: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'MASTERED';
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

const activitySelect =
  'id,subject_id,unit_id,skill_id,teacher_id,title,description,activity_type,status,subjects(name),learning_questions(id,question_text,question_type,options_json,explanation,points,sort_order)';

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

  teacherClasses: async (teacherId: string) => {
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
      supabase
        .from('learning_activities')
        .select(activitySelect)
        .eq('institution_id', institutionId)
        .eq('status', 'PUBLISHED')
        .order('created_at', { ascending: false }),
    ),

  teacherActivities: (institutionId: string, teacherId: string) =>
    read<LearningActivity[]>(
      supabase
        .from('learning_activities')
        .select(activitySelect)
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
};
