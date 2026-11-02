import { supabase } from '../lib/supabaseClient';

export interface TecQuizTeacherOption {
  activity_id: string;
  activity_title: string;
  subject_name: string;
  class_id: string;
  class_name: string;
  question_count: number;
}

export interface TecQuizQuestionState {
  index: number;
  total: number;
  text: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  options: string[];
  deadline_at: string | null;
  correct_option_index?: number;
  explanation?: string | null;
}

export interface TecQuizLeaderboardEntry {
  rank: number;
  alias: string;
  score: number | null;
  correct_count: number | null;
}

export interface TecQuizParticipant {
  alias: string;
}

export interface TecQuizGameState {
  game_id: string;
  pin: string | null;
  status: 'LOBBY' | 'IN_PROGRESS' | 'INTERMISSION' | 'FINISHED' | 'CANCELLED' | 'EXPIRED';
  viewer_role: 'TEACHER' | 'STUDENT';
  activity_title: string | null;
  question_index: number;
  total_questions: number;
  time_per_question_seconds: number;
  round_deadline_at: string | null;
  round_response_count: number | null;
  participant_count: number;
  can_advance: boolean;
  participants: TecQuizParticipant[];
  question: TecQuizQuestionState | null;
  my_answer: { submitted: true; is_correct: boolean | null; points_awarded: number | null } | null;
  leaderboard: TecQuizLeaderboardEntry[];
  report: TecQuizLeaderboardEntry[] | null;
}

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('O servidor não retornou os dados esperados.');
  return data;
}

export function humanizeTecQuizError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const codes: Array<[string, string]> = [
    ['TEC_QUIZ_PIN_INVALID', 'Informe um PIN de seis números.'],
    ['TEC_QUIZ_GAME_NOT_FOUND', 'Não encontramos uma sala ativa com esse PIN.'],
    ['TEC_QUIZ_STUDENT_CLASS_SCOPE_DENIED', 'Esta sala não está vinculada à sua matrícula.'],
    ['TEC_QUIZ_JOIN_CLOSED', 'A sala já começou ou o PIN expirou.'],
    ['TEC_QUIZ_REQUIRES_TWO_STUDENTS', 'A partida precisa de pelo menos dois estudantes.'],
    ['TEC_QUIZ_ROUND_STILL_OPEN', 'Aguarde todos responderem ou o fim do tempo.'],
    ['TEC_QUIZ_ROUND_CLOSED', 'O tempo desta pergunta acabou.'],
    ['TEC_QUIZ_ACTIVITY_QUESTION_INVALID', 'A atividade contém uma questão incompatível com o jogo ao vivo.'],
    ['TEC_QUIZ_QUESTION_COUNT_INVALID', 'A atividade precisa ter de 3 a 100 questões compatíveis.'],
    ['TEC_QUIZ_CLASS_SCOPE_DENIED', 'A atividade não está atribuída a uma turma autorizada.'],
    ['TEC_QUIZ_ACCESS_DENIED', 'Você não tem acesso a esta partida.'],
    ['TEC_QUIZ_TEACHER_SCOPE_DENIED', 'A partida não pertence às suas turmas autorizadas.'],
  ];
  return codes.find(([code]) => message.includes(code))?.[1]
    ?? 'Não foi possível concluir esta ação do Tec Quiz Live. Tente novamente.';
}

export const tecQuizLiveService = {
  async teacherOptions() {
    const { data, error } = await supabase.rpc('tec_quiz_teacher_options_v1');
    return unwrap((data ?? []) as TecQuizTeacherOption[], error);
  },

  async createGame(input: {
    activityId: string;
    classId: string;
    timePerQuestionSeconds: number;
    basePoints: number;
  }) {
    const { data, error } = await supabase.rpc('tec_quiz_create_game_v1', {
      p_activity_id: input.activityId,
      p_class_id: input.classId,
      p_time_per_question_seconds: input.timePerQuestionSeconds,
      p_base_points: input.basePoints,
    });
    return unwrap(data as { game_id: string; pin: string; status: string } | null, error);
  },

  async join(pin: string) {
    const { data, error } = await supabase.rpc('tec_quiz_join_v1', { p_pin: pin });
    return unwrap(data as { game_id: string; status: string } | null, error);
  },

  async myCurrentGame() {
    const { data, error } = await supabase.rpc('tec_quiz_my_current_game_v1');
    if (error) throw new Error(error.message);
    return (data as string | null) ?? null;
  },

  async state(gameId: string) {
    const { data, error } = await supabase.rpc('tec_quiz_state_v1', { p_game_id: gameId });
    return unwrap(data as unknown as TecQuizGameState | null, error);
  },

  async start(gameId: string) {
    const { data, error } = await supabase.rpc('tec_quiz_start_v1', { p_game_id: gameId });
    return unwrap(data as { game_id: string; status: string } | null, error);
  },

  async answer(gameId: string, selectedOptionIndex: number) {
    const { data, error } = await supabase.rpc('tec_quiz_submit_answer_v1', {
      p_game_id: gameId,
      p_selected_option_index: selectedOptionIndex,
    });
    return unwrap(data as { accepted: boolean; already_submitted: boolean } | null, error);
  },

  async advance(gameId: string) {
    const { data, error } = await supabase.rpc('tec_quiz_advance_v1', { p_game_id: gameId });
    return unwrap(data as { game_id: string; status: string; question_index?: number } | null, error);
  },

  subscribe(gameId: string, onChange: () => void, onStatus?: (status: string) => void) {
    const channel = supabase
      .channel(`tec-quiz:${gameId}`, { config: { private: true } })
      .on('broadcast', { event: 'tec_quiz_state_changed' }, onChange)
      .subscribe((status) => onStatus?.(status));
    return () => { void supabase.removeChannel(channel); };
  },
};
