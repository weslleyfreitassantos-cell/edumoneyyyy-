import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useAcademicYears } from '../../hooks/useAcademicStructure';
import {
  useCreateClassBatch,
  useCreateEducationPreset,
  useCurriculumTemplates,
} from '../../hooks/useAcademicAutomation';
import {
  buildClassBatchNames,
  buildEducationPresetClassDefinitions,
  EDUCATION_PRESET_GRADES,
} from '../../services/classAutomationService';

interface ClassAutomationPanelProps {
  institutionId: string;
  onClose: () => void;
  onCompleted: (message: string) => void;
}

interface FormState {
  academicYearId: string;
  baseName: string;
  count: string;
  gradeLevel: string;
  shift: string;
  capacity: string;
  templateId: string;
  assignTeachers: boolean;
}

type AutomationMode = 'preset' | 'single';

const defaultForm: FormState = {
  academicYearId: '',
  baseName: '',
  count: '2',
  gradeLevel: '',
  shift: '',
  capacity: '30',
  templateId: '',
  assignTeachers: true,
};

const defaultPresetCounts = Object.fromEntries(
  EDUCATION_PRESET_GRADES.map((grade) => [grade.key, String(grade.defaultClassCount)]),
);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Não foi possível criar as turmas automaticamente.';
}

export default function ClassAutomationPanel({ institutionId, onClose, onCompleted }: ClassAutomationPanelProps) {
  const yearsQuery = useAcademicYears(institutionId);
  const templatesQuery = useCurriculumTemplates(institutionId);
  const createMutation = useCreateClassBatch();
  const createPresetMutation = useCreateEducationPreset();
  const [mode, setMode] = useState<AutomationMode>('preset');
  const [formData, setFormData] = useState<FormState>(() => ({
    ...defaultForm,
    academicYearId: yearsQuery.data?.[0]?.id ?? '',
  }));
  const [presetCounts, setPresetCounts] = useState<Record<string, string>>(defaultPresetCounts);
  const [error, setError] = useState<string | null>(null);
  const years = yearsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];
  const isPending = createMutation.isPending || createPresetMutation.isPending;

  useEffect(() => {
    if (!formData.academicYearId && years[0]?.id) {
      setFormData((current) => ({
        ...current,
        academicYearId: years[0].id,
      }));
    }
  }, [formData.academicYearId, years]);

  const count = Number(formData.count);
  const previewNames = useMemo(() => {
    try {
      if (mode === 'preset') {
        return buildEducationPresetClassDefinitions(
          Object.fromEntries(
            Object.entries(presetCounts).map(([key, value]) => [key, Number(value)]),
          ),
        ).flatMap((definition) => definition.names);
      }

      return buildClassBatchNames(formData.baseName, count);
    } catch {
      return [];
    }
  }, [count, formData.baseName, mode, presetCounts]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setFormData((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    try {
      const result = mode === 'preset'
        ? await createPresetMutation.mutateAsync({
          institutionId,
          academicYearId: formData.academicYearId,
          classCounts: Object.fromEntries(
            Object.entries(presetCounts).map(([key, value]) => [key, Number(value)]),
          ),
          shift: formData.shift,
          capacity: Number(formData.capacity),
          templateId: formData.templateId || undefined,
          assignTeachers: Boolean(formData.templateId) && formData.assignTeachers,
        })
        : await createMutation.mutateAsync({
          institutionId,
          academicYearId: formData.academicYearId,
          baseName: formData.baseName,
          count,
          gradeLevel: formData.gradeLevel,
          shift: formData.shift,
          capacity: Number(formData.capacity),
          templateId: formData.templateId || undefined,
          assignTeachers: Boolean(formData.templateId) && formData.assignTeachers,
        });

      const coverageMessage = result.uncoveredSubjects.length > 0
        ? ` Sem cobertura docente: ${result.uncoveredSubjects.join(', ')}.`
        : result.assignmentsCreated > 0
          ? ` ${result.assignmentsCreated} atribuição(ões) docente(s) criada(s).`
          : '';

      const curriculumMessage = result.curriculumItemsApplied > 0
        ? ` ${result.curriculumItemsApplied} item(ns) de matriz aplicados.`
        : '';

      onCompleted(`${result.createdClassNames.length} turma(s) criada(s).${curriculumMessage}${coverageMessage}`);
      onClose();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="class-automation-title">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="class-automation-title" className="text-lg font-bold text-[#181c20]">Criar turmas automaticamente</h3>
            <p className="mt-1 text-sm text-gray-500">Prepare a estrutura escolar por série e reaproveite os professores já vinculados às disciplinas.</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-gray-500 hover:text-gray-800">Fechar</button>
        </div>

        {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-4">
          <div className="grid gap-2 rounded-lg border border-blue-100 bg-blue-50 p-2 sm:grid-cols-2" role="tablist" aria-label="Modo de criação">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'preset'}
              onClick={() => setMode('preset')}
              className={`rounded-md px-3 py-2 text-left text-sm font-semibold ${mode === 'preset' ? 'bg-white text-[#005bbf] shadow-sm' : 'text-blue-900 hover:bg-white/70'}`}
            >
              Educação básica completa
              <span className="mt-1 block text-xs font-normal">1º ao 9º ano e Ensino Médio</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'single'}
              onClick={() => setMode('single')}
              className={`rounded-md px-3 py-2 text-left text-sm font-semibold ${mode === 'single' ? 'bg-white text-[#005bbf] shadow-sm' : 'text-blue-900 hover:bg-white/70'}`}
            >
              Uma série
              <span className="mt-1 block text-xs font-normal">Criar um lote específico</span>
            </button>
          </div>

          <div>
            <label htmlFor="class-automation-year" className="block text-sm font-medium text-gray-700">Ano letivo</label>
            <select id="class-automation-year" value={formData.academicYearId} onChange={(event) => update('academicYearId', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" required>
              <option value="">Selecione</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
          </div>

          {mode === 'preset' ? (
            <section className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">Turmas por série</h4>
                  <p className="mt-1 text-xs text-gray-500">O padrão é de duas turmas por série. Ajuste para 0 quando a escola não oferecer uma etapa.</p>
                </div>
                <span className="text-xs font-semibold text-[#005bbf]">{previewNames.length} previstas</span>
              </div>
              <div className="mt-3 space-y-3">
                {['Ensino Fundamental - anos iniciais', 'Ensino Fundamental - anos finais', 'Ensino Médio'].map((stage) => (
                  <div key={stage}>
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stage}</h5>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {EDUCATION_PRESET_GRADES.filter((grade) => grade.stage === stage).map((grade) => (
                        <label key={grade.key} className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2 text-sm">
                          <span>{grade.label}</span>
                          <input
                            aria-label={`Quantidade de turmas para ${grade.label}`}
                            type="number"
                            min="0"
                            max="26"
                            step="1"
                            value={presetCounts[grade.key] ?? ''}
                            onChange={(event) => setPresetCounts((current) => ({ ...current, [grade.key]: event.target.value }))}
                            className="w-20 rounded-md border px-2 py-1 text-right"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <div>
                <label htmlFor="class-automation-base-name" className="block text-sm font-medium text-gray-700">Nome-base</label>
                <input id="class-automation-base-name" value={formData.baseName} onChange={(event) => update('baseName', event.target.value)} placeholder="Ex.: 1º ano" className="mt-1 w-full rounded-lg border px-3 py-2" required />
                <p className="mt-1 text-xs text-gray-500">Com várias turmas, serão gerados sufixos A, B, C... Use {'{letra}'} para controlar o padrão.</p>
              </div>
              <div>
                <label htmlFor="class-automation-count" className="block text-sm font-medium text-gray-700">Quantidade</label>
                <input id="class-automation-count" type="number" min="1" max="26" step="1" value={formData.count} onChange={(event) => update('count', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" required />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="class-automation-grade" className="block text-sm font-medium text-gray-700">Série ou nível</label>
              {mode === 'preset' ? (
                <p className="mt-2 text-sm text-gray-500">Preenchida automaticamente em cada turma.</p>
              ) : (
                <input id="class-automation-grade" value={formData.gradeLevel} onChange={(event) => update('gradeLevel', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
              )}
            </div>
            <div>
              <label htmlFor="class-automation-shift" className="block text-sm font-medium text-gray-700">Turno</label>
              <input id="class-automation-shift" value={formData.shift} onChange={(event) => update('shift', event.target.value)} placeholder="Manhã" className="mt-1 w-full rounded-lg border px-3 py-2" />
            </div>
            <div>
              <label htmlFor="class-automation-capacity" className="block text-sm font-medium text-gray-700">Capacidade</label>
              <input id="class-automation-capacity" type="number" min="1" max="500" step="1" value={formData.capacity} onChange={(event) => update('capacity', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" required />
            </div>
          </div>

          <div>
            <label htmlFor="class-automation-template" className="block text-sm font-medium text-gray-700">{mode === 'preset' ? 'Matriz curricular para as turmas (opcional)' : 'Matriz curricular (opcional)'}</label>
            <select id="class-automation-template" value={formData.templateId} onChange={(event) => update('templateId', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
              <option value="">Criar somente as turmas</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </div>

          {formData.templateId && (
            <label className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-sm text-blue-900">
              <input type="checkbox" checked={formData.assignTeachers} onChange={(event) => update('assignTeachers', event.target.checked)} className="mt-0.5" />
              <span><strong>Atribuir professores automaticamente.</strong> Usa apenas professores ativos que já estejam vinculados às disciplinas selecionadas.</span>
            </label>
          )}

          <section className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4" aria-live="polite">
            <h4 className="text-sm font-semibold text-gray-800">Prévia das turmas</h4>
            {previewNames.length > 0 ? (
              <ul className="mt-2 grid gap-1 text-sm text-gray-700 sm:grid-cols-2">
                {previewNames.map((name) => <li key={name}>• {name}</li>)}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-gray-500">Informe um nome-base e uma quantidade válida.</p>
            )}
          </section>

          <div className="flex justify-end gap-2 border-t pt-4">
            <button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={isPending || years.length === 0 || previewNames.length === 0} className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-50">{isPending ? 'Criando...' : 'Criar turmas automaticamente'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
