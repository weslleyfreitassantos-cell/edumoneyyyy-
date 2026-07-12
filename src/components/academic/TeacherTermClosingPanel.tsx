import { useState } from 'react';
import { useTeacherTermClosureOfferings, useTermClosurePreview, useSubmitTermClosure } from '../../hooks/useAcademicTermClosing';
import TermClosurePreviewTable from './TermClosurePreviewTable';
import { getErrorMessage, getClosureBadgeClass, getClosureStatusLabel } from './academicDisplay';

interface TeacherTermClosingPanelProps {
  profileId: string | undefined;
  institutionId: string | undefined;
}

export default function TeacherTermClosingPanel({
  profileId,
  institutionId,
}: TeacherTermClosingPanelProps) {
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const offeringsQuery = useTeacherTermClosureOfferings(profileId, institutionId);
  const offerings = offeringsQuery.data ?? [];

  const previewQuery = useTermClosurePreview(
    institutionId,
    selectedOfferingId || undefined,
  );
  
  const submitMutation = useSubmitTermClosure();

  const preview = previewQuery.data;

  async function handleSubmit() {
    setSuccessMessage('');
    if (!preview || !institutionId || !selectedOfferingId) return;

    try {
      await submitMutation.mutateAsync({
        institutionId,
        academicYearId: preview.offering.academicYearId,
        termId: preview.offering.termId,
        subjectOfferingId: selectedOfferingId,
      });
      setSuccessMessage('Fechamento submetido para revisão da direção com sucesso.');
    } catch (error) {
      // O erro é tratado no isError do submitMutation ou pode ser ignorado no catch se quisermos usar só o estado da mutation
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#181c20]">Fechamento de Período</h2>
        <p className="mt-1 text-sm text-[#727785]">
          Acompanhe as médias e frequências da sua turma e envie o fechamento para revisão.
        </p>

        <div className="mt-6">
          <label className="text-xs font-semibold text-[#3d4652]">Selecione a Oferta e Período</label>
          <select
            value={selectedOfferingId}
            onChange={(e) => {
              setSelectedOfferingId(e.target.value);
              setSuccessMessage('');
            }}
            className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm"
          >
            <option value="">Selecione...</option>
            {offerings.map((offering) => (
              <option key={`${offering.id}-${offering.termId}`} value={offering.id}>
                {offering.subjectName} - {offering.className} ({offering.termName})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedOfferingId && previewQuery.isLoading && (
        <div className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-sm text-[#727785]">
          Carregando prévia do fechamento...
        </div>
      )}

      {selectedOfferingId && preview && (
        <div className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-md font-bold text-[#181c20]">Prévia de Resultados</h3>
            {preview.closure && (
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getClosureBadgeClass(preview.closure.status)}`}>
                {getClosureStatusLabel(preview.closure.status)}
              </span>
            )}
          </div>

          <TermClosurePreviewTable preview={preview} />

          <div className="mt-6 border-t border-[#edf0f3] pt-6">
            {submitMutation.isError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {getErrorMessage(submitMutation.error)}
              </div>
            )}
            
            {successMessage && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {successMessage}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!preview.canSubmit || submitMutation.isPending}
              className="inline-flex w-full justify-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004a9c] disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
            >
              {submitMutation.isPending ? 'Enviando...' : 'Enviar para Revisão'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
