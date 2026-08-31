import { useEffect, useMemo, useState } from 'react';

import SpreadsheetImportModal from './SpreadsheetImportModal';
import type { AcademicYearRow } from '../services/academicStructureService';
import type { ClassRow } from '../services/classService';
import {
  getPreferredAcademicYear,
  sortAcademicYearsForSelection,
} from '../lib/academicSelection';
import {
  buildStudentImportPreviews,
  importStudents,
  STUDENT_IMPORT_EXAMPLE,
  STUDENT_IMPORT_HEADERS,
  type ImportProgress,
  type ImportPreview,
  type ImportResult,
  type StudentImportPreviewData,
} from '../services/userImportService';
import type { ParsedSpreadsheet } from '../services/spreadsheetImportService';
import {
  downloadSpreadsheetTemplate,
  readSpreadsheetFile,
} from '../services/spreadsheetImportService';

interface StudentSpreadsheetImportModalProps {
  institutionId: string;
  years: AcademicYearRow[];
  classes: ClassRow[];
  onClose: () => void;
  onImported?: (result: ImportResult) => void;
}

function PreviewTable({ previews }: { previews: Array<ImportPreview<StudentImportPreviewData>> }) {
  if (previews.length === 0) return null;
  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-800">Pré-visualização</h3>
          <p className="mt-1 text-xs text-slate-500">Mostrando até 10 linhas. Linhas com erro não serão enviadas.</p>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Aluno</th><th className="px-3 py-2">E-mail</th><th className="px-3 py-2">Ano / turma</th><th className="px-3 py-2">Responsáveis</th><th className="px-3 py-2">Validação</th></tr>
          </thead>
          <tbody>
            {previews.slice(0, 10).map((preview) => (
              <tr key={preview.rowNumber} className="border-t align-top">
                <td className="px-3 py-2 text-slate-500">{preview.rowNumber}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{preview.label}</td>
                <td className="px-3 py-2 text-slate-600">{preview.data.identity.email || '—'}</td>
                <td className="px-3 py-2 text-slate-600">{preview.data.academic_year_id ? 'Encontrado' : 'Não encontrado'} / {preview.data.class_id ? 'Encontrada' : 'Não encontrada'}</td>
                <td className="px-3 py-2 text-slate-600">{preview.data.guardians.length}</td>
                <td className="px-3 py-2">
                  {preview.errors.length === 0 ? <span className="font-semibold text-green-700">Pronta</span> : <div className="space-y-1 text-xs text-red-700">{preview.errors.map((error) => <p key={error}>{error}</p>)}</div>}
                  {preview.warnings.map((warning) => <p key={warning} className="mt-1 text-xs text-amber-700">{warning}</p>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function StudentSpreadsheetImportModal({ institutionId, years, classes, onClose, onImported }: StudentSpreadsheetImportModalProps) {
  const yearOptions = useMemo(
    () => sortAcademicYearsForSelection(years),
    [years],
  );
  const [defaultAcademicYearId, setDefaultAcademicYearId] = useState(
    () => getPreferredAcademicYear(years)?.id ?? '',
  );
  const [fileName, setFileName] = useState('');
  const [parsedSpreadsheet, setParsedSpreadsheet] = useState<ParsedSpreadsheet | null>(null);
  const [previews, setPreviews] = useState<Array<ImportPreview<StudentImportPreviewData>>>([]);
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (
      defaultAcademicYearId &&
      years.some((year) => year.id === defaultAcademicYearId && year.active)
    ) {
      return;
    }

    setDefaultAcademicYearId(getPreferredAcademicYear(years)?.id ?? '');
  }, [defaultAcademicYearId, years]);

  async function handleFileSelected(file: File | undefined): Promise<void> {
    if (!file) return;
    setFileName(file.name);
    setIsParsing(true);
    setParseError(null);
    setPreviews([]);
    setUnknownHeaders([]);
    setParsedSpreadsheet(null);
    setResult(null);
    try {
      const parsed = await readSpreadsheetFile(file);
      const built = buildStudentImportPreviews(parsed, {
        years,
        classes,
        defaultAcademicYearId,
      });
      setParsedSpreadsheet(parsed);
      setPreviews(built.previews);
      setUnknownHeaders(built.unknownHeaders);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Não foi possível ler o arquivo.');
    } finally {
      setIsParsing(false);
    }
  }

  function handleDefaultAcademicYearChange(academicYearId: string): void {
    setDefaultAcademicYearId(academicYearId);
    setResult(null);

    if (!parsedSpreadsheet) return;

    const built = buildStudentImportPreviews(parsedSpreadsheet, {
      years,
      classes,
      defaultAcademicYearId: academicYearId,
    });
    setPreviews(built.previews);
    setUnknownHeaders(built.unknownHeaders);
  }

  async function handleImport(): Promise<void> {
    const validPreviews = previews.filter((preview) => preview.errors.length === 0);
    if (validPreviews.length === 0) return;
    setIsImporting(true);
    setResult(null);
    try {
      const imported = await importStudents(institutionId, validPreviews, setProgress);
      setResult(imported);
      onImported?.(imported);
    } finally {
      setIsImporting(false);
    }
  }

  const validRows = previews.filter((preview) => preview.errors.length === 0).length;
  return (
    <SpreadsheetImportModal
      title="Importar alunos"
      description="Use uma planilha para cadastrar o aluno, os dados complementares, os responsáveis e a matrícula acadêmica pelo fluxo normal do sistema."
      requiredFields="Nome completo, e-mail, data de nascimento e pelo menos um responsável. A turma será distribuída automaticamente pela série informada."
      preUploadContent={<div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-3"><label htmlFor="student-import-academic-year" className="block text-sm font-semibold text-slate-800">Ano letivo da importação</label><select id="student-import-academic-year" value={defaultAcademicYearId} onChange={(event) => handleDefaultAcademicYearChange(event.target.value)} className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-800" disabled={yearOptions.filter((year) => year.active).length === 0}><option value="">Selecione o ano letivo</option>{yearOptions.filter((year) => year.active).map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select><p className="mt-2 text-xs text-slate-600">Esse ano será usado quando a planilha deixar o campo “Ano letivo” vazio. Informe “Ano escolar / série” para distribuir entre as turmas correspondentes.</p></div>}
      supportedFields={<><p><strong>Identidade:</strong> nome, e-mail, nascimento, CPF, nome social, RG, certidão, nacionalidade, naturalidade, sexo e telefone.</p><p className="mt-1"><strong>Endereço:</strong> CEP, logradouro, número, complemento, bairro, cidade, UF e zona rural.</p><p className="mt-1"><strong>Acadêmico:</strong> ano letivo (opcional quando definido acima), ano escolar/série, turma opcional, data da matrícula e dados da escola de origem.</p><p className="mt-1"><strong>Responsáveis:</strong> até dois responsáveis novos ou IDs de perfis já existentes.</p><p className="mt-1"><strong>Saúde e documentos:</strong> campos de saúde e status/observações dos documentos. Arquivos físicos devem ser anexados depois.</p></>}
      fileName={fileName}
      isParsing={isParsing}
      isImporting={isImporting}
      parseError={parseError}
      unknownHeaders={unknownHeaders}
      totalRows={previews.length}
      validRows={validRows}
      preview={<PreviewTable previews={previews} />}
      progress={progress}
      result={result}
      canImport={validRows > 0}
      onClose={onClose}
      onFileSelected={(file) => void handleFileSelected(file)}
      onDownloadTemplate={() => void downloadSpreadsheetTemplate('modelo-alunos.xlsx', [...STUDENT_IMPORT_HEADERS], STUDENT_IMPORT_EXAMPLE).catch((error) => setParseError(error instanceof Error ? error.message : 'Não foi possível gerar o modelo.'))}
      onImport={() => void handleImport()}
    />
  );
}
