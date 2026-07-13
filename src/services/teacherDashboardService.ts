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

interface TermRelation {
  id: string;
  start_date: string;
  end_date: string;
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

  terms:
    | TermRelation
    | TermRelation[]
    | null;
}

interface RosterQueryRow {
  offering_id: string;
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

function calculateEffectiveDate(startDate: string, endDate: string): string {
  const today = new Date();
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  
  if (today.getTime() < start.getTime()) {
    return startDate;
  }
  
  if (today.getTime() > end.getTime()) {
    return endDate;
  }
  
  return today.toISOString().split('T')[0];
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
        ),
        terms:term_id (
          id,
          start_date,
          end_date,
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
        termRecord: normalizeRelation(
          row.terms,
        ),
      }),
    );

    const inaccessibleRelation =
      normalizedRows.some(
        ({ classRecord, subjectRecord, termRecord }) =>
          !classRecord ||
          !subjectRecord ||
          !termRecord,
      );

    if (inaccessibleRelation) {
      throw new Error(
        'Não foi possível carregar as turmas, disciplinas ou períodos atribuídos. Verifique as políticas de acesso acadêmico.',
      );
    }

    const institutionRows =
      normalizedRows.filter(
        ({
          classRecord,
          subjectRecord,
          termRecord,
        }) =>
          classRecord?.institution_id ===
            institutionId &&
          subjectRecord?.institution_id ===
            institutionId &&
          classRecord.active !== false &&
          subjectRecord.active !== false &&
          termRecord?.active !== false,
      );

    const studentsByOffering =
      new Map<string, Set<string>>();

    let enrollmentAccessAvailable = true;

    if (institutionRows.length > 0) {
      const offeringsByDate = new Map<string, string[]>();
      
      for (const { row, termRecord } of institutionRows) {
        if (!termRecord) continue;
        
        const effectiveDate = calculateEffectiveDate(
          termRecord.start_date,
          termRecord.end_date
        );
        
        const dateGroup = offeringsByDate.get(effectiveDate) ?? [];
        dateGroup.push(row.id);
        offeringsByDate.set(effectiveDate, dateGroup);
      }

      const fetchPromises = Array.from(offeringsByDate.entries()).map(
        async ([date, ids]) => {
          const { data, error } = await supabase.rpc(
            'get_teacher_offering_rosters',
            {
              target_offering_ids: ids,
              effective_date: date,
            },
          );
          
          if (error) {
            throw error;
          }
          
          return data as RosterQueryRow[];
        }
      );

      try {
        const results = await Promise.all(fetchPromises);
        const rosters = results.flat();
        
        for (const roster of rosters) {
          const currentStudents =
            studentsByOffering.get(
              roster.offering_id,
            ) ?? new Set<string>();

          currentStudents.add(
            roster.student_id,
          );

          studentsByOffering.set(
            roster.offering_id,
            currentStudents,
          );
        }
      } catch (error) {
        enrollmentAccessAvailable = false;

        console.warn(
          'Não foi possível carregar as matrículas do professor:',
          error,
        );
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
                  ? studentsByOffering.get(
                      row.id,
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

    for (const students of studentsByOffering.values()) {
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