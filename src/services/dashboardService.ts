import { supabase } from '../lib/supabaseClient';

export interface DirectorDashboardData {
  summary: {
    totalStudents: number;
    activeStudents: number;
    enrolledStudents: number;
    totalTeachers: number;
    activeTeachers: number;
    totalClasses: number;
    activeClasses: number;
    avgStudentsPerClass: number;
  };
  upcomingEvents: any[];
  alerts: any[];
}

export const dashboardService = {
  async getDirectorDashboardData(institutionId: string): Promise<DirectorDashboardData> {
    // Buscar resumo de alunos
    const { data: studentData, error: studentError } = await supabase
      .from('director_student_summary')
      .select('*')
      .eq('institution_id', institutionId)
      .single();

    if (studentError && studentError.code !== 'PGRST116') {
      console.error('Erro ao buscar resumo de alunos:', studentError);
    }

    // Buscar resumo de professores
    const { data: teacherData, error: teacherError } = await supabase
      .from('director_teacher_summary')
      .select('*')
      .eq('institution_id', institutionId)
      .single();

    if (teacherError && teacherError.code !== 'PGRST116') {
      console.error('Erro ao buscar resumo de professores:', teacherError);
    }

    // Buscar resumo de turmas
    const { data: classData, error: classError } = await supabase
      .from('director_class_summary')
      .select('*')
      .eq('institution_id', institutionId)
      .single();

    if (classError && classError.code !== 'PGRST116') {
      console.error('Erro ao buscar resumo de turmas:', classError);
    }

    // Buscar próximos eventos (sempre vazio agora)
    const { data: eventsData, error: eventsError } = await supabase
      .from('director_upcoming_events')
      .select('*');

    if (eventsError) {
      console.error('Erro ao buscar eventos:', eventsError);
    }

    // Buscar alertas (sempre vazio agora)
    const { data: alertsData, error: alertsError } = await supabase
      .from('director_alerts')
      .select('*');

    if (alertsError) {
      console.error('Erro ao buscar alertas:', alertsError);
    }

    return {
      summary: {
        totalStudents: studentData?.total_students || 0,
        activeStudents: studentData?.active_students || 0,
        enrolledStudents: studentData?.enrolled_students || 0,
        totalTeachers: teacherData?.total_teachers || 0,
        activeTeachers: teacherData?.active_teachers || 0,
        totalClasses: classData?.total_classes || 0,
        activeClasses: classData?.active_classes || 0,
        avgStudentsPerClass: Number(classData?.avg_students_per_class) || 0,
      },
      upcomingEvents: eventsData || [],
      alerts: alertsData || [],
    };
  },
};
