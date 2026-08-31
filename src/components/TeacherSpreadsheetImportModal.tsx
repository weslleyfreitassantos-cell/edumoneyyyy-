import { useState } from 'react';

import SpreadsheetImportModal from './SpreadsheetImportModal';
import type { SubjectRow } from '../services/subjectService';
import {
  buildTeacherImportPreviews,
  importTeachers,
  TEACHER_IMPORT_EXAMPLE,
  TEACHER_IMPORT_HEADERS,
  type ImportProgress,
  type ImportPreview,
  type ImportResult,
  type TeacherImportPreviewData,
} from '../services/userImportService';
import {
  downloadSpreadsheetTemplate,
  readSpreadsheetFile,
} from '../services/spreadsheetImportService';

interface TeacherSpreadsheetImportModalProps {
  institutionId: string;
  subjects: SubjectRow[];
  onClose: () => void;
  onImported?: (result: ImportResult) => void;
}

function PreviewTable({ previews }: { previews: Array<ImportPreview<TeacherImportPreviewData>> }) {
  if (previews.length === 0) return null;
  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold text-slate-800">Pré-visualização</h3>
      <p className="mt-1 text-xs text-slate-500">Mostrando até 10 linhas. Disciplinas são resolvidas por nome, código ou ID.</p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Professor</th><th className="px-3 py-2">E-mail</th><th className="px-3 py-2">Disciplinas</th><th className="px-3 py-2">Janelas</th><th className="px-3 py-2">Validação</th></tr></thead>
          <tbody>{previews.slice(0, 10).map((preview) => <tr key={preview.rowNumber} className="border-t align-top"><td className="px-3 py-2 text-slate-500">{preview.rowNumber}</td><td className="px-3 py-2 font-medium text-slate-800">{preview.label}</td><td className="px-3 py-2 text-slate-600">{preview.data.email || '—'}</td><td className="px-3 py-2 text-slate-600">{preview.data.subject_ids.length}</td><td className="px-3 py-2 text-slate-600">{preview.data.availability.length}</td><td className="px-3 py-2">{preview.errors.length === 0 ? <span className="font-semibold text-green-700">Pronta</span> : <div className="space-y-1 text-xs text-red-700">{preview.errors.map((error) => <p key={error}>{error}</p>)}</div>}{preview.warnings.map((warning) => <p key={warning} className="mt-1 text-xs text-amber-700">{warning}</p>)}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

export default function TeacherSpreadsheetImportModal({ institutionId, subjects, onClose, onImported }: TeacherSpreadsheetImportModalProps) {
  const [fileName, setFileName] = useState('');
  const [previews, setPreviews] = useState<Array<ImportPreview<TeacherImportPreviewData>>>([]);
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFileSelected(file: File | undefined): Promise<void> {
    if (!file) return;
    setFileName(file.name);
    setIsParsing(true);
    setParseError(null);
    setPreviews([]);
    setUnknownHeaders([]);
    setResult(null);
    try {
      const parsed = await readSpreadsheetFile(file);
      const built = buildTeacherImportPreviews(parsed, subjects);
      setPreviews(built.previews);
      setUnknownHeaders(built.unknownHeaders);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Não foi possível ler o arquivo.');
    } finally {
      setIsParsing(false);
    }
  }

  async function handleImport(): Promise<void> {
    const validPreviews = previews.filter((preview) => preview.errors.length === 0);
    if (validPreviews.length === 0) return;
    setIsImporting(true);
    setResult(null);
    try {
      const imported = await importTeachers(institutionId, validPreviews, setProgress);
      setResult(imported);
      onImported?.(imported);
    } finally {
      setIsImporting(false);
    }
  }

  const validRows = previews.filter((preview) => preview.errors.length === 0).length;
  return (
    <SpreadsheetImportModal
      title="Importar professores"
      description="Cadastre professores em lote e já vincule disciplinas e disponibilidade semanal para a geração da grade."
      requiredFields="full_name, email, subjects/disciplinas"
      supportedFields={<><p><strong>Cadastro:</strong> nome completo, e-mail e telefone.</p><p className="mt-1"><strong>Acadêmico:</strong> subjects/disciplinas por nome, código ou ID e primary_subject.</p><p className="mt-1"><strong>Disponibilidade:</strong> availability_1_day, availability_1_start e availability_1_end até a janela 10. Dias aceitos: Segunda a Sábado ou 1 a 6.</p><p className="mt-1">A importação usa o mesmo convite de acesso e as mesmas tabelas de disciplinas/disponibilidade do cadastro manual.</p></>}
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
      onDownloadTemplate={() => void downloadSpreadsheetTemplate('modelo-professores.xlsx', [...TEACHER_IMPORT_HEADERS], TEACHER_IMPORT_EXAMPLE).catch((error) => setParseError(error instanceof Error ? error.message : 'Não foi possível gerar o modelo.'))}
      onImport={() => void handleImport()}
    />
  );
}
