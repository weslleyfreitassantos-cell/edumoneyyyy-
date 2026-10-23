import {
  ClipboardCheck,
  FileText,
  History,
  Loader2,
  Printer,
  UserRound,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import {
  useAcademicDocumentExpectedSubjectTerms,
  useAcademicDocumentIssuances,
  useAcademicDocumentReportCard,
  useAcademicDocumentStudent,
  useAcademicDocumentStudents,
} from '../../../hooks/useAcademicDocuments';
import { normalizeListSearch } from '../../../components/ListControls';
import { getUserFacingErrorMessage } from '../../../lib/userFacingError';
import {
  AcademicTranscriptPreviewDocument,
  AttendanceDeclarationDocument,
  EnrollmentDeclarationDocument,
  ReenrollmentReceiptDocument,
  StudentRegistrationSheetDocument,
  type AcademicDocumentType,
} from '../../../components/documents/AcademicDocumentPreview';
import { academicDocumentIssuanceService, type AcademicDocumentIssuanceType } from '../../../services/academicDocumentIssuanceService';
import { buildCompleteAttendanceDeclaration, findPreviousAcademicEnrollment } from '../../../services/academicDocumentPolicy';

function getErrorMessage(error: unknown): string {
  return getUserFacingErrorMessage(
    error,
    'Não foi possível carregar os documentos acadêmicos.',
  );
}

export default function AcademicDocumentsTab() {
  const { profile } = useAuth();
  const institutionQuery = useCurrentInstitution(profile?.id);
  const institutionId = institutionQuery.data ?? '';
  const [searchParams] = useSearchParams();
  const requestedStudentId = searchParams.get('student');
  const studentsQuery = useAcademicDocumentStudents(institutionId);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<AcademicDocumentType>('ENROLLMENT_DECLARATION');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const studentQuery = useAcademicDocumentStudent(institutionId, selectedStudentId);
  const selectedStudent = studentQuery.data;
  const reportCardQuery = useAcademicDocumentReportCard(institutionId, selectedStudentId);
  const currentEnrollment = selectedStudent?.currentEnrollment ?? null;
  const expectedSubjectTermsQuery = useAcademicDocumentExpectedSubjectTerms(
    institutionId,
    selectedStudentId,
    currentEnrollment,
  );
  const issuanceQuery = useAcademicDocumentIssuances(institutionId, selectedStudentId);

  const filteredStudents = useMemo(() => {
    const query = normalizeListSearch(searchTerm);
    const students = studentsQuery.data ?? [];

    if (!query) return students;

    return students.filter((student) =>
      normalizeListSearch([
        student.name,
        student.registrationNumber,
        student.cpf,
        student.email,
      ].filter(Boolean).join(' ')).includes(query),
    );
  }, [searchTerm, studentsQuery.data]);

  useEffect(() => {
    if (
      requestedStudentId &&
      studentsQuery.data?.some((student) => student.id === requestedStudentId)
    ) {
      setSelectedStudentId(requestedStudentId);
      return;
    }

    if (requestedStudentId && studentsQuery.data && !studentsQuery.isLoading) {
      setSelectedStudentId(null);
    }
  }, [requestedStudentId, studentsQuery.data, studentsQuery.isLoading]);

  useEffect(() => {
    if (
      selectedStudentId &&
      !filteredStudents.some((student) => student.id === selectedStudentId)
    ) {
      setSelectedStudentId(null);
    }
  }, [filteredStudents, selectedStudentId]);

  useEffect(() => {
    setSelectedAcademicYearId(currentEnrollment?.academicYearId ?? null);
    setIssueError(null);
  }, [currentEnrollment?.academicYearId, selectedStudentId]);

  const academicYearOptions = useMemo(() => {
    const enrollments = studentQuery.data?.enrollments ?? [];
    const seen = new Set<string>();
    return enrollments.filter((enrollment) => {
      if (seen.has(enrollment.academicYearId)) return false;
      seen.add(enrollment.academicYearId);
      return true;
    });
  }, [studentQuery.data?.enrollments]);

  const resolvedAcademicYearId = selectedAcademicYearId ?? currentEnrollment?.academicYearId ?? academicYearOptions[0]?.academicYearId ?? null;
  const selectedYearName = academicYearOptions.find((year) => year.academicYearId === resolvedAcademicYearId)?.academicYearName
    ?? currentEnrollment?.academicYearName
    ?? 'Ano letivo não identificado';
  const selectedYearResults = (reportCardQuery.data?.subjects ?? [])
    .filter((result) => result.academicYearId === resolvedAcademicYearId);
  const attendanceDeclaration = buildCompleteAttendanceDeclaration(
    expectedSubjectTermsQuery.data ?? [],
    reportCardQuery.data?.subjects ?? [],
    currentEnrollment?.academicYearId ?? '',
  );
  const previousEnrollment = findPreviousAcademicEnrollment(
    currentEnrollment,
    studentQuery.data?.enrollments ?? [],
  );
  const selectedYearEnrollment = (studentQuery.data?.enrollments ?? []).find(
    (enrollment) => enrollment.academicYearId === resolvedAcademicYearId,
  ) ?? null;
  const transcriptMissingCount = selectedYearResults.filter((result) =>
    !result.isClosed || result.finalGradePercentage === null || result.attendancePercentage === null,
  ).length + (selectedYearResults.length === 0 ? 1 : 0);

  async function handlePrint() {
    if (!selectedStudent || isIssuing) return;
    setIssueError(null);

    const documentTypeForAudit: AcademicDocumentIssuanceType = documentType;
    if (documentType === 'ENROLLMENT_DECLARATION' && !selectedStudent.currentEnrollment) {
      setIssueError('A declaração exige matrícula ativa persistida.');
      return;
    }
    if (documentType === 'ATTENDANCE_DECLARATION' && !attendanceDeclaration.complete) {
      setIssueError('A declaração de frequência só pode ser emitida após o fechamento de todos os componentes e períodos da matrícula.');
      return;
    }
    if (documentType === 'REENROLLMENT_RECEIPT' && !previousEnrollment) {
      setIssueError('Não há matrícula persistida em ano anterior que comprove a rematrícula.');
      return;
    }
    if (documentType === 'TRANSCRIPT_PREVIEW' && reportCardQuery.isError) {
      setIssueError('Não foi possível validar os dados acadêmicos para a prévia.');
      return;
    }

    setIsIssuing(true);
    try {
      await academicDocumentIssuanceService.record({
        institutionId,
        studentId: selectedStudent.id,
        documentType: documentTypeForAudit,
        enrollmentId: documentType === 'TRANSCRIPT_PREVIEW'
          ? selectedYearEnrollment?.id ?? null
          : selectedStudent.currentEnrollment?.id ?? null,
        academicYearId: documentType === 'TRANSCRIPT_PREVIEW'
          ? resolvedAcademicYearId
          : selectedStudent.currentEnrollment?.academicYearId ?? null,
      });
      await issuanceQuery.refetch();
      window.print();
    } catch (error) {
      setIssueError(getUserFacingErrorMessage(error, 'Não foi possível registrar a emissão. O documento não foi impresso.'));
    } finally {
      setIsIssuing(false);
    }
  }

  if (institutionQuery.isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" role="status">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Carregando instituição...
      </div>
    );
  }

  if (!institutionId) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Documentos acadêmicos</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Selecione uma instituição para emitir documentos acadêmicos.
        </p>
      </section>
    );
  }

  const declarationUnavailable = Boolean(selectedStudent && !selectedStudent.currentEnrollment);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Secretaria</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Documentos acadêmicos</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Consulte dados reais, confira pendências e imprima documentos cuja emissão esteja validada.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-labelledby="academic-documents-students-title">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-blue-700 dark:text-blue-300" aria-hidden="true" />
            <h2 id="academic-documents-students-title" className="font-bold text-slate-900 dark:text-white">Alunos</h2>
          </div>
          <label htmlFor="academic-documents-search" className="mt-4 block text-sm font-semibold text-slate-700 dark:text-slate-300">Buscar por nome, RA, CPF ou e-mail</label>
          <input
            id="academic-documents-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Digite para buscar"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
          />

          {studentsQuery.isLoading ? (
            <div className="mt-5 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Carregando alunos...
            </div>
          ) : studentsQuery.isError ? (
            <p className="mt-5 text-sm text-red-700 dark:text-red-300" role="alert">{getErrorMessage(studentsQuery.error)}</p>
          ) : filteredStudents.length === 0 ? (
            <p className="mt-5 text-sm text-slate-600 dark:text-slate-400">Nenhum aluno encontrado.</p>
          ) : (
            <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
              {filteredStudents.map((student) => {
                const isSelected = student.id === selectedStudentId;
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 ${isSelected ? 'border-blue-600 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}
                    aria-pressed={isSelected}
                  >
                    <span className="block font-semibold text-slate-900 dark:text-white">{student.name}</span>
                    <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">RA {student.registrationNumber} · {student.cpf || 'CPF não informado'}</span>
                    {!student.active ? <span className="mt-1 block text-xs font-semibold text-amber-700 dark:text-amber-300">Aluno inativo</span> : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="min-w-0 space-y-4" aria-labelledby="academic-documents-preview-title">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 id="academic-documents-preview-title" className="text-lg font-bold text-slate-900 dark:text-white">Pré-visualização</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Escolha o tipo de documento e confira os dados antes de imprimir.</p>
            </div>
            {selectedStudent ? (
              <button
                type="button"
                onClick={() => void handlePrint()}
                disabled={isIssuing || studentQuery.isLoading || (
                  documentType === 'ENROLLMENT_DECLARATION' && declarationUnavailable
                ) || (
                  documentType === 'ATTENDANCE_DECLARATION' && (
                    expectedSubjectTermsQuery.isLoading || reportCardQuery.isLoading || !attendanceDeclaration.complete
                  )
                ) || (
                  documentType === 'REENROLLMENT_RECEIPT' && !previousEnrollment
                ) || (
                  documentType === 'TRANSCRIPT_PREVIEW' && (reportCardQuery.isLoading || reportCardQuery.isError)
                )}
                className="print-hidden inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isIssuing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Printer className="h-4 w-4" aria-hidden="true" />}
                {isIssuing ? 'Registrando emissão...' : 'Imprimir documento'}
              </button>
            ) : null}
          </div>

          {selectedStudent ? (
            <div className="print-hidden flex flex-wrap gap-2" role="group" aria-label="Tipo de documento">
              <button
                type="button"
                onClick={() => setDocumentType('ENROLLMENT_DECLARATION')}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 ${documentType === 'ENROLLMENT_DECLARATION' ? 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-200' : 'border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300'}`}
                aria-pressed={documentType === 'ENROLLMENT_DECLARATION'}
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                Declaração de matrícula
              </button>
              <button
                type="button"
                onClick={() => setDocumentType('REGISTRATION_SHEET')}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 ${documentType === 'REGISTRATION_SHEET' ? 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-200' : 'border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300'}`}
                aria-pressed={documentType === 'REGISTRATION_SHEET'}
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                Ficha de matrícula
              </button>
              <button
                type="button"
                onClick={() => setDocumentType('ATTENDANCE_DECLARATION')}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 ${documentType === 'ATTENDANCE_DECLARATION' ? 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-200' : 'border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300'}`}
                aria-pressed={documentType === 'ATTENDANCE_DECLARATION'}
              >
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                Declaração de frequência
              </button>
              <button
                type="button"
                onClick={() => setDocumentType('REENROLLMENT_RECEIPT')}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 ${documentType === 'REENROLLMENT_RECEIPT' ? 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-200' : 'border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300'}`}
                aria-pressed={documentType === 'REENROLLMENT_RECEIPT'}
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                Comprovante de rematrícula
              </button>
              <button
                type="button"
                onClick={() => setDocumentType('TRANSCRIPT_PREVIEW')}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 ${documentType === 'TRANSCRIPT_PREVIEW' ? 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-200' : 'border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300'}`}
                aria-pressed={documentType === 'TRANSCRIPT_PREVIEW'}
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                Prévia de histórico
              </button>
            </div>
          ) : null}

          {selectedStudent && documentType === 'TRANSCRIPT_PREVIEW' && academicYearOptions.length > 0 ? (
            <label className="print-hidden block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Ano letivo
              <select
                value={resolvedAcademicYearId ?? ''}
                onChange={(event) => setSelectedAcademicYearId(event.target.value || null)}
                className="mt-2 block w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              >
                {academicYearOptions.map((year) => (
                  <option key={year.academicYearId} value={year.academicYearId}>{year.academicYearName}</option>
                ))}
              </select>
            </label>
          ) : null}

          {issueError ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">{issueError}</p> : null}

          {studentQuery.isLoading ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" role="status">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Carregando dados do aluno...
            </div>
          ) : studentQuery.isError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">{getErrorMessage(studentQuery.error)}</p>
          ) : selectedStudent ? (
            documentType === 'ENROLLMENT_DECLARATION' ? (
              selectedStudent.currentEnrollment ? (
                <EnrollmentDeclarationDocument
                  student={selectedStudent}
                  institutionName={institutionQuery.currentInstitution?.name ?? 'Instituição de ensino'}
                  logoUrl={institutionQuery.currentInstitution?.logo_url}
                />
              ) : (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="status">
                  Este aluno não possui matrícula ativa. A declaração de matrícula está indisponível.
                </div>
              )
            ) : documentType === 'REGISTRATION_SHEET' ? (
              <StudentRegistrationSheetDocument
                student={selectedStudent}
                institutionName={institutionQuery.currentInstitution?.name ?? 'Instituição de ensino'}
                logoUrl={institutionQuery.currentInstitution?.logo_url}
              />
            ) : documentType === 'ATTENDANCE_DECLARATION' ? (
              expectedSubjectTermsQuery.isLoading || reportCardQuery.isLoading ? (
                <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" role="status">Verificando fechamentos oficiais de frequência...</p>
              ) : expectedSubjectTermsQuery.isError || reportCardQuery.isError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">Não foi possível confirmar todos os registros de frequência; a emissão está bloqueada.</p>
              ) : !selectedStudent.currentEnrollment || !attendanceDeclaration.complete ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="status">
                  A declaração de frequência está bloqueada. {expectedSubjectTermsQuery.data?.length === 0 ? 'A turma não possui componentes curriculares ativos confirmados.' : `Faltam ${attendanceDeclaration.missingCount} fechamento(s) oficial(is) com frequência para a matrícula atual.`}
                </div>
              ) : (
                <AttendanceDeclarationDocument
                  student={selectedStudent}
                  institutionName={institutionQuery.currentInstitution?.name ?? 'Instituição de ensino'}
                  logoUrl={institutionQuery.currentInstitution?.logo_url}
                  academicYearName={selectedStudent.currentEnrollment.academicYearName}
                  rows={attendanceDeclaration.rows}
                />
              )
            ) : documentType === 'REENROLLMENT_RECEIPT' ? (
              selectedStudent.currentEnrollment && previousEnrollment ? (
                <ReenrollmentReceiptDocument
                  student={selectedStudent}
                  institutionName={institutionQuery.currentInstitution?.name ?? 'Instituição de ensino'}
                  logoUrl={institutionQuery.currentInstitution?.logo_url}
                  currentEnrollment={selectedStudent.currentEnrollment}
                  previousEnrollment={previousEnrollment}
                />
              ) : (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="status">
                  Comprovante indisponível: é necessário haver matrícula ativa e matrícula persistida em ano letivo anterior.
                </div>
              )
            ) : reportCardQuery.isLoading ? (
              <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" role="status">Carregando resultados acadêmicos reais...</p>
            ) : reportCardQuery.isError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">Não foi possível consultar os resultados acadêmicos; a prévia não pode ser emitida.</p>
            ) : (
              <AcademicTranscriptPreviewDocument
                student={selectedStudent}
                institutionName={institutionQuery.currentInstitution?.name ?? 'Instituição de ensino'}
                logoUrl={institutionQuery.currentInstitution?.logo_url}
                academicYearName={selectedYearName}
                results={selectedYearResults}
                missingCount={transcriptMissingCount}
              />
            )
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              Selecione um aluno para visualizar um documento.
            </div>
          )}

          {selectedStudent ? (
            <section className="print-hidden rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-labelledby="academic-document-issuance-history-title">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                <h3 id="academic-document-issuance-history-title" className="font-semibold text-slate-900 dark:text-white">Registro de emissões</h3>
              </div>
              {issuanceQuery.isLoading ? <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Carregando histórico...</p> : issuanceQuery.isError ? <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">Histórico de emissões indisponível.</p> : (issuanceQuery.data ?? []).length === 0 ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Nenhuma emissão registrada para este aluno.</p> : (
                <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {(issuanceQuery.data ?? []).map((issuance) => (
                    <li key={issuance.id} className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                      <span>{issuance.document_type.replaceAll('_', ' ').toLocaleLowerCase('pt-BR')}</span>
                      <time dateTime={issuance.issued_at}>{new Date(issuance.issued_at).toLocaleString('pt-BR')}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </section>
      </div>
    </div>
  );
}
