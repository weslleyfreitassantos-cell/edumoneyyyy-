import { useEffect, useState, type FormEvent } from 'react';
import { Globe, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { suggestSubdomain, validateSubdomain } from '../../lib/subdomain';
import { updateInstitutionSubdomain } from '../../services/institutionService';
import { useInstitution } from '../../contexts/InstitutionContext';

interface InstitutionSubdomainSectionProps {
  institutionId: string;
  institutionName: string;
  currentSubdomain: string | null;
  userRole: string;
}

export function InstitutionSubdomainSection({
  institutionId,
  institutionName,
  currentSubdomain,
  userRole,
}: InstitutionSubdomainSectionProps) {
  const { refresh } = useInstitution();
  const [subdomainInput, setSubdomainInput] = useState(currentSubdomain || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isDirector = userRole === 'DIRECTOR';

  useEffect(() => {
    setSubdomainInput(currentSubdomain || '');
  }, [currentSubdomain]);

  const handleSuggest = () => {
    setError(null);
    setSuccess(null);
    const suggestion = suggestSubdomain(institutionName);
    setSubdomainInput(suggestion);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isDirector) {
      setError('Apenas o diretor da instituição pode alterar o subdomínio.');
      return;
    }

    const validation = validateSubdomain(subdomainInput);
    if (!validation.valid) {
      setError(validation.error || 'Subdomínio inválido.');
      return;
    }

    try {
      setIsSaving(true);
      await updateInstitutionSubdomain({
        institutionId,
        subdomain: subdomainInput,
        userRole,
      });
      setSuccess('Subdomínio atualizado com sucesso!');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar subdomínio.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Endereço Web da Instituição (Subdomínio)
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Escolha o endereço exclusivo para acesso à sua instituição.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Subdomínio
          </label>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-800">
              <span className="pl-3 text-sm text-slate-400">https://</span>
              <input
                type="text"
                value={subdomainInput}
                onChange={(e) => {
                  setError(null);
                  setSuccess(null);
                  setSubdomainInput(e.target.value.toLowerCase().trim());
                }}
                disabled={!isDirector || isSaving}
                placeholder={suggestSubdomain(institutionName)}
                className="w-48 bg-transparent px-2 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span className="pr-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                .grupotec.dev.br
              </span>
            </div>

            {isDirector && (
              <button
                type="button"
                onClick={handleSuggest}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Usar sugestão
              </button>
            )}
          </div>

          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {isDirector
              ? 'Exemplo: se você digitar "diretorcolocou", seu endereço será https://diretorcolocou.grupotec.dev.br.'
              : 'Apenas o Diretor da instituição possui permissão para definir ou alterar o subdomínio.'}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {isDirector && (
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
        )}
      </form>
    </div>
  );
}
