import { supabase } from '../lib/supabaseClient';

interface ClassRelation {
  id: string;
  institution_id: string;
  name: string;
  grade_level: string | null;
  shift: string | null;
  capacity: number | null;
  active: boolean | null;
}

interface SubjectRelation {
  id: string;
  institution_id: string;
  name: string;
  code: string | null;
  workload: number | null;
  active: boolean | null;
}

interface OfferingQueryRow {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_profile_id: string;
  term_id: string;
  active: boolean | null;
  created_at: string | null;

  classes:
    | ClassRelation
    | ClassRelation[]
    | null;

  subjects:
    | SubjectRelation
    | SubjectRelation[]
    | null;
}

interface EnrollmentQueryRow {
  class_id: string;
  student_id: string;
}

export interface TeacherOffering {
  id: string;
  classId: string;
  subjectId: string;
  termId: string;

  className: string;
  gradeLevel: string | null;
  shift: string | null;
  capacity: number | null;

  subjectName: string;
  subjectCode: string | null;
  workload: number | null;

  studentCount: number | null;
}

export interface TeacherDashboardData {
  offerings: TeacherOffering[];

  totals: {
    offerings: number;
    classes: number;
    subjects: number;
    students: number | null;
  };

  enrollmentAccessAvailable: boolean;
}

function normalizeRelation<T>(
  relation: T | T[] | null,
): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

export const teacherDashboardService = {
  async getDashboard(
    profileId: string,
    institutionId: string,
  ): Promise<TeacherDashboardData> {
    const {
      data: offeringData,
      error: offeringError,
    } = await supabase
      .from('subject_offerings')
      .select(`
        id,
        class_id,
        subject_id,
        teacher_profile_id,
        term_id,
        active,
        created_at,
        classes:class_id (
          id,
          institution_id,
          name,
          grade_level,
          shift,
          capacity,
          active
        ),
        subjects:subject_id (
          id,
          institution_id,
          name,
          code,
          workload,
          active
        )
      `)
      .eq(
        'teacher_profile_id',
        profileId,
      )
      .eq('active', true)
      .order('created_at', {
        ascending: true,
      });

    if (offeringError) {
      throw offeringError;
    }

    const rows =
      (offeringData ??
        []) as unknown as OfferingQueryRow[];

    const normalizedRows = rows.map(
      (row) => ({
        row,
        classRecord: normalizeRelation(
          row.classes,
        ),
        subjectRecord: normalizeRelation(
          row.subjects,
        ),
      }),
    );

    const inaccessibleRelation =
      normalizedRows.some(
        ({ classRecord, subjectRecord }) =>
          !classRecord ||
          !subjectRecord,
      );

    if (inaccessibleRelation) {
      throw new Error(
        'Não foi possível carregar as turmas ou disciplinas atribuídas. Verifique as políticas de acesso acadêmico.',
      );
    }

    const institutionRows =
      normalizedRows.filter(
        ({
          classRecord,
          subjectRecord,
        }) =>
          classRecord?.institution_id ===
            institutionId &&
          subjectRecord?.institution_id ===
            institutionId &&
          classRecord.active !== false &&
          subjectRecord.active !== false,
      );

    const classIds = Array.from(
      new Set(
        institutionRows.map(
          ({ row }) => row.class_id,
        ),
      ),
    );

    const studentsByClass =
      new Map<string, Set<string>>();

    let enrollmentAccessAvailable = true;

    if (classIds.length > 0) {
      const {
        data: enrollmentData,
        error: enrollmentError,
      } = await supabase
        .from('enrollments')
        .select('class_id, student_id')
        .in('class_id', classIds)
        .eq('active', true);

      if (enrollmentError) {
        enrollmentAccessAvailable = false;

        console.warn(
          'Não foi possível carregar as matrículas do professor:',
          enrollmentError,
        );
      } else {
        const enrollments =
          (enrollmentData ??
            []) as EnrollmentQueryRow[];

        for (const enrollment of enrollments) {
          const currentStudents =
            studentsByClass.get(
              enrollment.class_id,
            ) ?? new Set<string>();

          currentStudents.add(
            enrollment.student_id,
          );

          studentsByClass.set(
            enrollment.class_id,
            currentStudents,
          );
        }
      }
    }

    const offerings: TeacherOffering[] =
      institutionRows
        .map(
          ({
            row,
            classRecord,
            subjectRecord,
          }) => {
            if (
              !classRecord ||
              !subjectRecord
            ) {
              throw new Error(
                'Oferta acadêmica incompleta.',
              );
            }

            return {
              id: row.id,
              classId: row.class_id,
              subjectId: row.subject_id,
              termId: row.term_id,

              className:
                classRecord.name,

              gradeLevel:
                classRecord.grade_level,

              shift:
                classRecord.shift,

              capacity:
                classRecord.capacity,

              subjectName:
                subjectRecord.name,

              subjectCode:
                subjectRecord.code,

              workload:
                subjectRecord.workload,

              studentCount:
                enrollmentAccessAvailable
                  ? studentsByClass.get(
                      row.class_id,
                    )?.size ?? 0
                  : null,
            };
          },
        )
        .sort((first, second) => {
          const subjectComparison =
            first.subjectName.localeCompare(
              second.subjectName,
              'pt-BR',
            );

          if (subjectComparison !== 0) {
            return subjectComparison;
          }

          return first.className.localeCompare(
            second.className,
            'pt-BR',
          );
        });

    const uniqueStudents = new Set<string>();

    for (const students of studentsByClass.values()) {
      for (const studentId of students) {
        uniqueStudents.add(studentId);
      }
    }

    return {
      offerings,

      totals: {
        offerings: offerings.length,

        classes: new Set(
          offerings.map(
            (offering) =>
              offering.classId,
          ),
        ).size,

        subjects: new Set(
          offerings.map(
            (offering) =>
              offering.subjectId,
          ),
        ).size,

        students:
          enrollmentAccessAvailable
            ? uniqueStudents.size
            : null,
      },

      enrollmentAccessAvailable,
    };
  },
};