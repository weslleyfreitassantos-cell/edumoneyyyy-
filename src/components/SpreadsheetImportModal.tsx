import type { ReactNode } from 'react';

import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';

import type { ImportFailure, ImportProgress, ImportResult } from '../services/userImportService';

interface SpreadsheetImportModalProps {
  title: string;
  description: string;
  requiredFields: string;
  supportedFields: ReactNode;
  preUploadContent?: ReactNode;
  fileName: string;
  isParsing: boolean;
  isImporting: boolean;
  parseError: string | null;
  unknownHeaders: string[];
  totalRows: number;
  validRows: number;
  preview: ReactNode;
  progress: ImportProgress | null;
  result: ImportResult | null;
  canImport: boolean;
  onClose: () => void;
  onFileSelected: (file: File | undefined) => void;
  onDownloadTemplate: () => void;
  onImport: () => void;
}

function FailureList({ failures }: { failures: ImportFailure[] }) {
  if (failures.length === 0) return null;
  return (
    <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {failures.map((failure) => (
        <p key={`${failure.rowNumber}-${failure.label}`}>
          Linha {failure.rowNumber} · {failure.label}: {failure.message}
        </p>
      ))}
    </div>
  );
}

export default function SpreadsheetImportModal({
  title,
  description,
  requiredFields,
  supportedFields,
  preUploadContent,
  fileName,
  isParsing,
  isImporting,
  parseError,
  unknownHeaders,
  totalRows,
  validRows,
  preview,
  progress,
  result,
  canImport,
  onClose,
  onFileSelected,
  onDownloadTemplate,
  onImport,
}: SpreadsheetImportModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="spreadsheet-import-title">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#005bbf]">Importação em lote</p>
            <h2 id="spreadsheet-import-title" className="mt-1 text-xl font-bold text-[#181c20]">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isImporting} aria-label="Fechar" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)]">
            <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-800">Arquivo Excel</h3>
                  <p className="mt-1 text-sm text-slate-600">Formatos aceitos: .xlsx e .xls. O limite é de 1.000 linhas por importação.</p>
                </div>
                <button type="button" onClick={onDownloadTemplate} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                  <Download size={16} aria-hidden="true" /> Baixar modelo
                </button>
              </div>
              {preUploadContent}
              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-blue-300 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-blue-50">
                <Upload size={18} className="text-blue-700" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{fileName || 'Escolher arquivo .xlsx ou .xls'}</span>
                <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="sr-only" onChange={(event) => onFileSelected(event.target.files?.[0])} />
              </label>
              <p className="mt-3 text-xs text-slate-600"><strong>Obrigatórios:</strong> {requiredFields}</p>
              <details className="mt-3 rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold text-blue-800">Ver todos os campos aceitos</summary>
                <div className="mt-2 leading-5">{supportedFields}</div>
              </details>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-blue-700" aria-hidden="true" />
                <h3 className="font-semibold text-slate-800">Resumo da validação</h3>
              </div>
              {isParsing ? (
                <p className="mt-4 text-sm text-slate-600">Lendo a planilha...</p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="block text-xs text-slate-500">Linhas</span><strong>{totalRows}</strong></div>
                  <div className="rounded-lg bg-green-50 px-3 py-2 text-green-800"><span className="block text-xs text-green-700">Prontas</span><strong>{validRows}</strong></div>
                </div>
              )}
              {parseError && <div role="alert" className="mt-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{parseError}</div>}
              {unknownHeaders.length > 0 && <p className="mt-3 text-xs text-amber-700">Colunas não reconhecidas serão ignoradas: {unknownHeaders.join(', ')}.</p>}
            </section>
          </div>

          {preview}

          {progress && isImporting && (
            <section className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-sm font-medium text-blue-900">
                <span>Importando {progress.label}...</span>
                <span>{progress.current}/{progress.total}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
                <div className="h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }} />
              </div>
            </section>
          )}

          {result && !isImporting && (
            <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4" role="status">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <CheckCircle2 size={17} className="text-green-600" aria-hidden="true" />
                {result.succeeded.length} importado(s), {result.failed.length} com erro.
              </div>
              <FailureList failures={result.failed} />
            </section>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
          <p className="text-xs text-slate-500">Amostra acima: confira as linhas inválidas antes de importar.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={isImporting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Fechar</button>
            <button type="button" onClick={onImport} disabled={!canImport || isImporting || isParsing} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-50">
              <Upload size={16} aria-hidden="true" /> {isImporting ? 'Importando...' : `Importar ${validRows} registro(s)`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
