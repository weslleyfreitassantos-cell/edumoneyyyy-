import type {
  AcademicDocumentEnrollment,
  AcademicDocumentStudent,
} from '../../services/academicDocumentService';
import type { ReportCardSubjectResult } from '../../services/reportCardService';
import type { AttendanceDeclarationRow } from '../../services/academicDocumentPolicy';
import type { ReactNode } from 'react';

export type AcademicDocumentType =
  | 'ENROLLMENT_DECLARATION'
  | 'REGISTRATION_SHEET'
  | 'ATTENDANCE_DECLARATION'
  | 'REENROLLMENT_RECEIPT'
  | 'TRANSCRIPT_PREVIEW';

export function formatLocalIssueDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

interface DocumentFrameProps {
  children: ReactNode;
  institutionName: string;
  logoUrl?: string | null;
  title: string;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Não informado';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function valueOrFallback(value: string | null | undefined): string {
  return value?.trim() || 'Não informado';
}

function DocumentFrame({
  children,
  institutionName,
  logoUrl,
  title,
}: DocumentFrameProps) {
  return (
    <article
      className="academic-document-printable mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-8"
      data-testid="academic-document-preview"
    >
      <header className="flex items-start gap-4 border-b border-slate-200 pb-5 dark:border-slate-700">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="h-14 w-14 object-contain"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">
            {institutionName}
          </p>
          <h2 className="mt-2 text-2xl font-bold">{title}</h2>
        </div>
      </header>
      {children}
      <footer className="mt-10 border-t border-slate-200 pt-5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
        {title.startsWith('Prévia') ? 'Prévia gerada em' : 'Documento emitido em'} {formatLocalIssueDate(new Date())}.
      </footer>
    </article>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

export function EnrollmentDeclarationDocument({
  student,
  institutionName,
  logoUrl,
}: {
  student: AcademicDocumentStudent;
  institutionName: string;
  logoUrl?: string | null;
}) {
  const enrollment = student.currentEnrollment;

  return (
    <DocumentFrame
      institutionName={institutionName}
      logoUrl={logoUrl}
      title="Declaração de matrícula"
    >
      <div className="space-y-6 pt-8 text-base leading-7">
        <p>
          Declaramos, para os devidos fins, que{' '}
          <strong>{student.name}</strong>, RA{' '}
          <strong>{student.registrationNumber}</strong>, está regularmente
          matriculado(a) nesta instituição de ensino.
        </p>
        <dl className="grid gap-5 rounded-lg border border-slate-200 p-5 sm:grid-cols-3 dark:border-slate-700">
          <Field label="Aluno" value={student.name} />
          <Field label="RA" value={student.registrationNumber} />
          <Field label="Ano letivo" value={valueOrFallback(enrollment?.academicYearName)} />
          <Field label="Turma" value={valueOrFallback(enrollment?.className)} />
          {enrollment?.gradeLevel ? <Field label="Série/nível" value={enrollment.gradeLevel} /> : null}
          {enrollment?.shift ? <Field label="Turno" value={enrollment.shift} /> : null}
          {enrollment?.enrolledAt ? <Field label="Data da matrícula" value={formatDate(enrollment.enrolledAt)} /> : null}
          <Field label="Status" value="Matrícula ativa" />
          <Field label="Data de nascimento" value={formatDate(student.birthDate)} />
        </dl>
        <p>
          Por ser verdade, firmamos a presente declaração.
        </p>
      </div>
    </DocumentFrame>
  );
}

export function StudentRegistrationSheetDocument({
  student,
  institutionName,
  logoUrl,
}: {
  student: AcademicDocumentStudent;
  institutionName: string;
  logoUrl?: string | null;
}) {
  const address = student.address;
  const details = student.details;

  return (
    <DocumentFrame
      institutionName={institutionName}
      logoUrl={logoUrl}
      title="Ficha de matrícula"
    >
      <div className="space-y-7 pt-7">
        {!student.active ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Aluno inativo
          </p>
        ) : null}
        {!student.currentEnrollment ? (
          <p className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Sem matrícula ativa
          </p>
        ) : null}

        <section>
          <h3 className="text-lg font-bold">Identificação do aluno</h3>
          <dl className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nome completo" value={student.name} />
            <Field label="Nome social" value={valueOrFallback(details.social_name)} />
            <Field label="RA" value={student.registrationNumber} />
            <Field label="CPF" value={valueOrFallback(student.cpf)} />
            <Field label="Data de nascimento" value={formatDate(student.birthDate)} />
            <Field label="Sexo" value={valueOrFallback(details.sex)} />
            <Field label="Nacionalidade" value={valueOrFallback(details.nationality)} />
            <Field label="Naturalidade" value={valueOrFallback(details.birthplace)} />
            <Field label="Estado de nascimento" value={valueOrFallback(details.birth_state)} />
            <Field label="E-mail" value={valueOrFallback(student.email)} />
            <Field label="Telefone" value={valueOrFallback(student.phone)} />
          </dl>
        </section>

        <section>
          <h3 className="text-lg font-bold">Matrícula atual</h3>
          {student.currentEnrollment ? (
            <dl className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Ano letivo" value={student.currentEnrollment.academicYearName} />
              <Field label="Turma" value={student.currentEnrollment.className} />
              {student.currentEnrollment.gradeLevel ? <Field label="Série/nível" value={student.currentEnrollment.gradeLevel} /> : null}
              {student.currentEnrollment.shift ? <Field label="Turno" value={student.currentEnrollment.shift} /> : null}
              {student.currentEnrollment.enrolledAt ? <Field label="Data da matrícula" value={formatDate(student.currentEnrollment.enrolledAt)} /> : null}
              <Field label="Status" value="Matrícula ativa" />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Sem matrícula ativa.</p>
          )}
        </section>

        <section>
          <h3 className="text-lg font-bold">Endereço</h3>
          <dl className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Logradouro" value={valueOrFallback(address?.street)} />
            <Field label="Número" value={valueOrFallback(address?.number)} />
            <Field label="Complemento" value={valueOrFallback(address?.complement)} />
            <Field label="Bairro" value={valueOrFallback(address?.neighborhood)} />
            <Field label="Cidade" value={valueOrFallback(address?.city)} />
            <Field label="Estado" value={valueOrFallback(address?.state)} />
            <Field label="CEP" value={valueOrFallback(address?.postalCode)} />
          </dl>
        </section>

        <section>
          <h3 className="text-lg font-bold">Responsáveis ativos</h3>
          {student.guardians.length > 0 ? (
            <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
              {student.guardians.map((guardian) => (
                <div key={`${guardian.profileId}-${guardian.relationship}`} className="grid gap-1 px-4 py-3 sm:grid-cols-3">
                  <span className="font-semibold">{guardian.name}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{guardian.relationship}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{guardian.phone || guardian.email || 'Contato não informado'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Nenhum responsável ativo informado.</p>
          )}
        </section>

        <section>
          <h3 className="text-lg font-bold">Histórico de matrículas</h3>
          {student.enrollments.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Ano letivo</th>
                    <th className="px-4 py-3">Turma</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {student.enrollments.map((enrollment) => (
                    <tr key={enrollment.id}>
                      <td className="px-4 py-3">{enrollment.academicYearName}</td>
                      <td className="px-4 py-3">{enrollment.className}</td>
                      <td className="px-4 py-3">{enrollment.active && statusIsActive(enrollment.status) ? 'Ativa' : enrollment.status || 'Não informado'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Nenhuma matrícula registrada.</p>
          )}
        </section>
      </div>
    </DocumentFrame>
  );
}

export function AttendanceDeclarationDocument({
  student,
  institutionName,
  logoUrl,
  academicYearName,
  rows,
}: {
  student: AcademicDocumentStudent;
  institutionName: string;
  logoUrl?: string | null;
  academicYearName: string;
  rows: readonly AttendanceDeclarationRow[];
}) {
  return (
    <DocumentFrame institutionName={institutionName} logoUrl={logoUrl} title="Declaração de frequência">
      <div className="space-y-6 pt-8 text-base leading-7">
        <p>
          Declaramos que <strong>{student.name}</strong>, RA <strong>{student.registrationNumber}</strong>,
          possui registros oficiais de frequência encerrados no ano letivo de <strong>{academicYearName}</strong>,
          conforme detalhamento abaixo.
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr><th className="px-4 py-3">Período</th><th className="px-4 py-3">Componente curricular</th><th className="px-4 py-3">Frequência registrada</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {rows.map((row) => (
                <tr key={`${row.subjectName}-${row.termName}`}>
                  <td className="px-4 py-3">{row.termName}</td>
                  <td className="px-4 py-3">{row.subjectName}</td>
                  <td className="px-4 py-3">{row.attendancePercentage.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Os percentuais acima correspondem aos registros acadêmicos encerrados para cada componente e período.</p>
      </div>
    </DocumentFrame>
  );
}

export function ReenrollmentReceiptDocument({
  student,
  institutionName,
  logoUrl,
  currentEnrollment,
  previousEnrollment,
}: {
  student: AcademicDocumentStudent;
  institutionName: string;
  logoUrl?: string | null;
  currentEnrollment: AcademicDocumentEnrollment;
  previousEnrollment: AcademicDocumentEnrollment;
}) {
  return (
    <DocumentFrame institutionName={institutionName} logoUrl={logoUrl} title="Comprovante de rematrícula">
      <div className="space-y-6 pt-8 text-base leading-7">
        <p>
          Registramos a matrícula de continuidade de <strong>{student.name}</strong>, RA <strong>{student.registrationNumber}</strong>,
          após vínculo escolar persistido no ano letivo anterior.
        </p>
        <dl className="grid gap-5 rounded-lg border border-slate-200 p-5 sm:grid-cols-2 dark:border-slate-700">
          <Field label="Ano anterior" value={previousEnrollment.academicYearName} />
          <Field label="Turma anterior" value={previousEnrollment.className} />
          <Field label="Ano da rematrícula" value={currentEnrollment.academicYearName} />
          <Field label="Turma atual" value={currentEnrollment.className} />
          <Field label="Data da matrícula atual" value={formatDate(currentEnrollment.enrolledAt)} />
          <Field label="Status" value="Matrícula ativa" />
        </dl>
      </div>
    </DocumentFrame>
  );
}

export function AcademicTranscriptPreviewDocument({
  student,
  institutionName,
  logoUrl,
  academicYearName,
  results,
  missingCount,
}: {
  student: AcademicDocumentStudent;
  institutionName: string;
  logoUrl?: string | null;
  academicYearName: string;
  results: readonly ReportCardSubjectResult[];
  missingCount: number;
}) {
  const sortedResults = [...results].sort((left, right) =>
    `${left.termName}-${left.subjectName}`.localeCompare(`${right.termName}-${right.subjectName}`, 'pt-BR'),
  );

  return (
    <DocumentFrame institutionName={institutionName} logoUrl={logoUrl} title="Prévia de histórico escolar">
      <div className="space-y-5 pt-6">
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold uppercase tracking-wide text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Prévia não oficial — não substitui histórico escolar definitivo
        </p>
        <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
          Estudante: <strong>{student.name}</strong> · RA <strong>{student.registrationNumber}</strong> · Ano selecionado: <strong>{academicYearName}</strong>
        </p>
        {missingCount > 0 || sortedResults.length === 0 ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Há informações pendentes ou ausentes. A emissão de documento definitivo está bloqueada até que os períodos sejam encerrados e os dados oficiais estejam completos.
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr><th className="px-4 py-3">Período</th><th className="px-4 py-3">Componente curricular</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Frequência</th><th className="px-4 py-3">Situação</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {sortedResults.map((result) => (
                <tr key={result.key}>
                  <td className="px-4 py-3">{result.termName}</td>
                  <td className="px-4 py-3">{result.subjectName}</td>
                  <td className="px-4 py-3">{result.isClosed && result.finalGradePercentage !== null ? `${result.finalGradePercentage.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : 'Em aberto'}</td>
                  <td className="px-4 py-3">{result.isClosed && result.attendancePercentage !== null ? `${result.attendancePercentage.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : 'Em aberto'}</td>
                  <td className="px-4 py-3">{result.isClosed ? result.resultStatus : 'Período não encerrado'}</td>
                </tr>
              ))}
              {sortedResults.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-600 dark:text-slate-400">Não há resultados acadêmicos registrados para este ano letivo.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </DocumentFrame>
  );
}

function statusIsActive(status: string): boolean {
  return status.trim().toUpperCase() === 'ACTIVE';
}
