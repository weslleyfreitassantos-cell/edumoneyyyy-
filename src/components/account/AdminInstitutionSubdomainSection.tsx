import { useEffect, useState, type FormEvent } from 'react';
import { Globe, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { suggestSubdomain, validateSubdomain } from '../../lib/subdomain';
import { updateInstitutionSubdomain, type InstitutionSummary } from '../../services/institutionService';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useAuth } from '../../contexts/AuthContext';

interface AdminInstitutionSubdomainSectionProps {
  institutions: InstitutionSummary[];
}

export function AdminInstitutionSubdomainSection({
  institutions,
}: AdminInstitutionSubdomainSectionProps) {
  const { profile } = useAuth();
  const { refresh } = useInstitution();

  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string>(
    institutions[0]?.id || ''
  );
  const [subdomainInput, setSubdomainInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedInstitution = institutions.find(
    (inst) => inst.id === selectedInstitutionId
  );

  useEffect(() => {
    if (institutions.length > 0 && !selectedInstitutionId) {
      setSelectedInstitutionId(institutions[0].id);
    }
  }, [institutions, selectedInstitutionId]);

  useEffect(() => {
    if (selectedInstitution) {
      setSubdomainInput(selectedInstitution.subdomain || '');
      setError(null);
      setSuccessMessage(null);
    }
  }, [selectedInstitutionId, selectedInstitution]);

  const handleSuggest = () => {
    if (!selectedInstitution) return;
    setError(null);
    setSuccessMessage(null);
    const suggestion = suggestSubdomain(selectedInstitution.name);
    setSubdomainInput(suggestion);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!selectedInstitutionId || !selectedInstitution) {
      setError('Selecione uma instituição.');
      return;
    }

    if (!profile?.id) {
      setError('Usuário não autenticado.');
      return;
    }

    const validation = validateSubdomain(subdomainInput);
    if (!validation.valid) {
      setError(validation.error || 'Subdomínio inválido.');
      return;
    }

    try {
      setIsSaving(true);
      const updated = await updateInstitutionSubdomain({
        institutionId: selectedInstitutionId,
        subdomain: subdomainInput,
        profileId: profile.id,
        userRole: 'ADMIN',
      });

      setSuccessMessage(
        `Subdomínio atualizado com sucesso. A instituição poderá ser acessada em: https://${updated.subdomain}.grupotec.dev.br`
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar subdomínio.');
    } finally {
      setIsSaving(false);
    }
  };

  if (institutions.length === 0) {
    return null;
  }

  const previewUrl = subdomainInput.trim()
    ? `https://${subdomainInput.trim()}.grupotec.dev.br`
    : 'https://[subdominio].grupotec.dev.br';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Gerenciamento de Subdomínio (Administrador)
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Selecione uma instituição da sua conta e defina seu endereço exclusivo de acesso.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Instituição selecionada
          </label>
          <select
            value={selectedInstitutionId}
            onChange={(e) => setSelectedInstitutionId(e.target.value)}
            className="mt-1.5 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {institutions.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name} {inst.subdomain ? `(${inst.subdomain})` : '(Sem subdomínio)'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Endereço da escola
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-800">
              <span className="pl-3 text-sm text-slate-400">https://</span>
              <input
                type="text"
                value={subdomainInput}
                onChange={(e) => {
                  setError(null);
                  setSuccessMessage(null);
                  setSubdomainInput(e.target.value.toLowerCase().trim());
                }}
                disabled={isSaving}
                placeholder={selectedInstitution ? suggestSubdomain(selectedInstitution.name) : 'escolamodelo'}
                className="w-48 bg-transparent px-2 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span className="pr-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                .grupotec.dev.br
              </span>
            </div>

            <button
              type="button"
              onClick={handleSuggest}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Usar sugestão
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Prévia do Endereço:
          </span>
          <p className="mt-0.5 text-sm font-medium text-blue-600 dark:text-blue-400">
            {previewUrl}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex flex-col gap-1 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:hover:bg-blue-500"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar subdomínio
          </button>
        </div>
      </form>
    </div>
  );
}
