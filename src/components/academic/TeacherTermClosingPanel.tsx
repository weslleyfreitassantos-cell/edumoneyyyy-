import { useState } from 'react';
import { Link } from 'react-router-dom';
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
            aria-label="Oferta e período para fechamento"
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

        {offeringsQuery.isLoading && (
          <p role="status" className="mt-4 text-sm text-[#727785]">
            Carregando ofertas disponíveis...
          </p>
        )}

        {offeringsQuery.isError && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {getErrorMessage(offeringsQuery.error)}
          </div>
        )}

        {!offeringsQuery.isLoading && !offeringsQuery.isError && offerings.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-[#c1c6d6] p-4 text-sm text-[#727785]">
            Nenhuma oferta ativa disponível para fechamento.
          </div>
        )}
      </div>

      {selectedOfferingId && previewQuery.isLoading && (
        <div role="status" className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-sm text-[#727785]">
          Carregando prévia do fechamento...
        </div>
      )}

      {selectedOfferingId && previewQuery.isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {getErrorMessage(previewQuery.error)}
        </div>
      )}

      {selectedOfferingId && preview && (
        <div className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-md font-bold text-[#181c20]">Prévia de Resultados</h3>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${preview.closure ? getClosureBadgeClass(preview.closure.status) : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
              {preview.closure ? getClosureStatusLabel(preview.closure.status) : 'Não iniciado'}
            </span>
          </div>

          <TermClosurePreviewTable preview={preview} />

          <div className="mt-6 border-t border-[#edf0f3] pt-6">
            {submitMutation.isError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {getErrorMessage(submitMutation.error)}
              </div>
            )}
            
            {successMessage && (
              <div role="status" aria-live="polite" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {successMessage}
              </div>
            )}

            <p className="mb-4 text-sm text-[#727785]">
              {preview.canSubmit
                ? 'A prévia está pronta. Envie o fechamento para revisão da direção.'
                : preview.issues.length > 0
                  ? 'O envio está bloqueado até que as pendências exibidas na prévia sejam resolvidas.'
                  : 'O envio não está disponível para o estado atual deste período.'}
            </p>

            <button
              onClick={handleSubmit}
              disabled={!preview.canSubmit || submitMutation.isPending}
              className="inline-flex w-full justify-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004a9c] disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
            >
              {submitMutation.isPending ? 'Enviando...' : 'Enviar para Revisão'}
            </button>
            <Link
              to="/dashboard/grades"
              className="mt-3 inline-flex w-full justify-center rounded-lg border border-[#cfd6e2] px-4 py-2 text-sm font-semibold text-[#005bbf] hover:bg-blue-50 sm:ml-2 sm:mt-0 sm:w-auto"
            >
              Voltar para avaliações e notas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
