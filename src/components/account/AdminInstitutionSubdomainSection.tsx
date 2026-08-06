import { useEffect, useState, type FormEvent } from 'react';
import { Globe, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { suggestSubdomain, validateSubdomain } from '../../lib/subdomain';
import { updateInstitutionSubdomain, type InstitutionSummary } from '../../services/institutionService';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useAuth } from '../../contexts/AuthContext';

interface AdminInstitutionSubdomainSectionProps {
  institution?: InstitutionSummary | null;
}

export function AdminInstitutionSubdomainSection({
  institution,
}: AdminInstitutionSubdomainSectionProps = {}) {
  const { profile } = useAuth();
  const { currentInstitution: contextInstitution, refresh } = useInstitution();

  const activeInstitution = institution !== undefined ? institution : contextInstitution;

  const [subdomainInput, setSubdomainInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeInstitution) {
      setSubdomainInput(activeInstitution.subdomain || '');
    } else {
      setSubdomainInput('');
    }
    setError(null);
    setSuccessMessage(null);
  }, [activeInstitution?.id, activeInstitution?.subdomain]);

  const handleSuggest = () => {
    if (!activeInstitution) return;
    setError(null);
    setSuccessMessage(null);
    const suggestion = suggestSubdomain(activeInstitution.name);
    setSubdomainInput(suggestion);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!activeInstitution?.id) {
      setError('Nenhuma instituição selecionada.');
      return;
    }

    const targetInstitutionId = activeInstitution.id;

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
        institutionId: targetInstitutionId,
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

  if (!activeInstitution) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Gerenciamento de Subdomínio (Administrador)
            </h3>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <p className="font-medium text-slate-900 dark:text-white">
            Nenhuma instituição selecionada.
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Selecione uma instituição na seção Instituições para gerenciar seu subdomínio.
          </p>
        </div>
      </div>
    );
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
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Para gerenciar outra instituição, selecione-a na seção Instituições.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Instituição atual
          </span>
          <p className="mt-0.5 text-base font-semibold text-slate-900 dark:text-white">
            {activeInstitution.name}
          </p>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Status
          </span>
          <p className="mt-0.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {activeInstitution.active === false ? 'Inativa' : 'Ativa'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Endereço da instituição
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
                placeholder={suggestSubdomain(activeInstitution.name)}
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
          {!activeInstitution.subdomain && !subdomainInput && (
            <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              Esta instituição ainda não possui subdomínio.
            </p>
          )}
        </div>

        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Prévia
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
