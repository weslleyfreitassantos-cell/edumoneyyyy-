import { useState } from 'react';
import { useInstitutionTermClosureOfferings, useTermClosurePreview, useCloseTermClosure, useReopenTermClosure } from '../../hooks/useAcademicTermClosing';
import TermClosurePreviewTable from './TermClosurePreviewTable';
import { getErrorMessage, getClosureBadgeClass, getClosureStatusLabel } from './academicDisplay';

interface InstitutionTermClosingPanelProps {
  institutionId: string | undefined;
  readOnly?: boolean;
}

export default function InstitutionTermClosingPanel({
  institutionId,
  readOnly = false,
}: InstitutionTermClosingPanelProps) {
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);

  // Here we would ideally have a filter state, but keeping it simple for now as requested.
  const offeringsQuery = useInstitutionTermClosureOfferings(institutionId, {});
  const offerings = offeringsQuery.data ?? [];

  const previewQuery = useTermClosurePreview(
    institutionId,
    selectedOfferingId || undefined,
  );
  
  const closeMutation = useCloseTermClosure();
  const reopenMutation = useReopenTermClosure();

  const preview = previewQuery.data;

  async function handleClose() {
    setSuccessMessage('');
    if (!preview || !institutionId || !selectedOfferingId) return;

    try {
      await closeMutation.mutateAsync({
        institutionId,
        academicYearId: preview.offering.academicYearId,
        termId: preview.offering.termId,
        subjectOfferingId: selectedOfferingId,
      });
      setSuccessMessage('Período fechado com sucesso.');
    } catch (error) {
      // O erro é tratado no isError
    }
  }

  async function handleReopen() {
    setSuccessMessage('');
    if (!preview || !preview.closure || !institutionId) return;

    try {
      await reopenMutation.mutateAsync({
        institutionId,
        termClosureId: preview.closure.id,
        reason: reopenReason,
      });
      setSuccessMessage('Período reaberto com sucesso.');
      setIsReopenModalOpen(false);
      setReopenReason('');
    } catch (error) {
      // Erro tratado
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#181c20]">Gestão de Fechamento de Período</h2>
        <p className="mt-1 text-sm text-[#727785]">
          Visualize o status dos fechamentos de todas as turmas e realize o fechamento definitivo.
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
                {offering.subjectName} - {offering.className} ({offering.termName}) - Prof. {offering.teacherName} - {getClosureStatusLabel(offering.closure?.status || 'OPEN')}
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
          <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-md font-bold text-[#181c20]">Revisão de Resultados</h3>
              <p className="text-xs text-[#727785]">Prof. {preview.offering.teacherName}</p>
            </div>
            {preview.closure && (
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getClosureBadgeClass(preview.closure.status)}`}>
                {getClosureStatusLabel(preview.closure.status)}
              </span>
            )}
          </div>

          <TermClosurePreviewTable preview={preview} />

          <div className="mt-6 border-t border-[#edf0f3] pt-6 flex gap-3 flex-wrap">
            {closeMutation.isError && (
              <div className="w-full mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {getErrorMessage(closeMutation.error)}
              </div>
            )}
            {reopenMutation.isError && (
              <div className="w-full mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {getErrorMessage(reopenMutation.error)}
              </div>
            )}
            
            {successMessage && (
              <div className="w-full mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {successMessage}
              </div>
            )}

            {!readOnly && (
              <>
                <button
                  onClick={handleClose}
                  disabled={!preview.canClose || closeMutation.isPending}
                  className="inline-flex justify-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004a9c] disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {closeMutation.isPending ? 'Fechando...' : 'Fechar Período Definitivo'}
                </button>

                {preview.closure?.status === 'CLOSED' && (
                  <button
                    onClick={() => setIsReopenModalOpen(true)}
                    className="inline-flex justify-center rounded-lg border border-[#dfe3e8] bg-white px-4 py-2 text-sm font-semibold text-[#181c20] transition-colors hover:bg-gray-50"
                  >
                    Reabrir Período
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {isReopenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#181c20]">Reabrir Período</h3>
            <p className="mt-2 text-sm text-[#727785]">
              A reabertura permitirá novas edições nas notas e frequência. É obrigatório informar o motivo.
            </p>
            <div className="mt-4">
              <label className="text-xs font-semibold text-[#3d4652]">Motivo da reabertura</label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm"
                rows={3}
                placeholder="Ex: Correção de notas pendentes autorizada pela direção."
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsReopenModalOpen(false);
                  setReopenReason('');
                }}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-[#727785] hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleReopen}
                disabled={!reopenReason.trim() || reopenMutation.isPending}
                className="rounded-lg bg-[#d93025] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b0271e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reopenMutation.isPending ? 'Reabrindo...' : 'Confirmar Reabertura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
