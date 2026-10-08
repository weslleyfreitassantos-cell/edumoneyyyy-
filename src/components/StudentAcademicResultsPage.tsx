import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useCurrentInstitution } from '../hooks/useCurrentInstitution';
import { useStudentAcademicContext } from '../hooks/useStudentAcademicContext';
import { getUserFacingErrorMessage } from '../lib/userFacingError';
import StudentAttendanceSummaryPanel from './attendance/StudentAttendanceSummaryPanel';
import StudentGradesPanel from './grades/StudentGradesPanel';
import AcademicStudentContext from './academic/AcademicStudentContext';
import StudentReportCard from './academic/StudentReportCard';
import DashboardLoadingShell from './DashboardLoadingShell';

type StudentAcademicSection = 'attendance' | 'grades' | 'report-card';

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/).at(0) || 'Estudante';
}

export default function StudentAcademicResultsPage() {
  const { profile } = useAuth();
  const location = useLocation();
  const institutionQuery = useCurrentInstitution(profile?.id);
  const contextQuery = useStudentAcademicContext(
    profile?.id,
    institutionQuery.data,
  );

  const section = location.pathname.split('/').at(-1) as StudentAcademicSection;

  if (institutionQuery.isLoading || contextQuery.isLoading) {
    const fullName = profile?.full_name?.trim() || 'Estudante';
    return (
      <DashboardLoadingShell
        areaLabel="Área do estudante"
        heading={`Olá, ${getFirstName(fullName)}!`}
        fullName={fullName}
        avatarUrl={profile?.avatar_url}
        fallback={<GraduationCap className="h-8 w-8" aria-hidden="true" />}
        statusLabel="Carregando dados acadêmicos"
      />
    );
  }

  if (!profile || institutionQuery.isError || contextQuery.isError) {
    const error = institutionQuery.error ?? contextQuery.error;

    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <h2 className="font-bold">Não foi possível carregar os dados acadêmicos</h2>
        <p className="mt-2">
          {getUserFacingErrorMessage(error, 'Tente novamente em alguns instantes.')}
        </p>
        <button
          type="button"
          onClick={() => void Promise.all([institutionQuery.refetch(), contextQuery.refetch()])}
          className="mt-4 min-h-11 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const context = contextQuery.data;
  if (!context) {
    return (
      <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        O registro acadêmico ainda não está disponível.
      </div>
    );
  }

  const { student, activeEnrollment } = context;
  const studentName = student.profile?.full_name?.trim() || 'Estudante sem nome informado';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5"
      id={`student-${section}-main`}
    >
      <AcademicStudentContext
        studentName={studentName}
        registrationNumber={student.registration_number}
        className={activeEnrollment?.class_name}
        academicYearName={activeEnrollment?.academic_year_name}
      />

      {!activeEnrollment && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          Nenhuma matrícula ativa encontrada.
        </div>
      )}

      {section === 'attendance' && (
        <StudentAttendanceSummaryPanel
          institutionId={institutionQuery.data!}
          studentId={student.id}
          title="Resumo de frequência"
        />
      )}

      {section === 'grades' && (
        <StudentGradesPanel
          institutionId={institutionQuery.data!}
          studentId={student.id}
          title="Avaliações publicadas"
        />
      )}

      {section === 'report-card' && (
        <StudentReportCard
          institutionId={institutionQuery.data!}
          studentId={student.id}
          studentName={studentName}
          className={activeEnrollment?.class_name}
        />
      )}
    </motion.div>
  );
}
