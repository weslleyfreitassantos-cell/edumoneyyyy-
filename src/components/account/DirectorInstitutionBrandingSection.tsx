import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Palette, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle, Globe } from 'lucide-react';
import { updateInstitutionBranding } from '../../services/institutionService';
import { useSaveInstitutionLogo, useRemoveInstitutionLogo } from '../../hooks/useInstitutionBranding';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useAuth } from '../../contexts/AuthContext';

interface DirectorInstitutionBrandingSectionProps {
  institutionId: string;
  institutionName: string;
  currentSubdomain: string | null;
  currentLogoUrl: string | null;
  currentPrimaryColor: string | null;
  currentSecondaryColor: string | null;
}

export function DirectorInstitutionBrandingSection({
  institutionId,
  institutionName,
  currentSubdomain,
  currentLogoUrl,
  currentPrimaryColor,
  currentSecondaryColor,
}: DirectorInstitutionBrandingSectionProps) {
  const { profile } = useAuth();
  const { refresh } = useInstitution();
  const saveLogo = useSaveInstitutionLogo();
  const removeLogo = useRemoveInstitutionLogo();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [savedLogoUrl, setSavedLogoUrl] = useState<string | null>(currentLogoUrl);
  const [primaryColor, setPrimaryColor] = useState<string>(currentPrimaryColor || '#005bbf');
  const [secondaryColor, setSecondaryColor] = useState<string>(currentSecondaryColor || '#ff9900');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSavedLogoUrl(currentLogoUrl);
    setPrimaryColor(currentPrimaryColor || '#005bbf');
    setSecondaryColor(currentSecondaryColor || '#ff9900');
  }, [currentLogoUrl, currentPrimaryColor, currentSecondaryColor]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('A logo deve ter no máximo 2 MB.');
      return;
    }

    if (file.type === 'image/svg+xml') {
      setError('Formato SVG não é permitido.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleSaveBranding = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!profile?.id) {
      setError('Usuário não autenticado.');
      return;
    }

    try {
      setIsSaving(true);
      let updatedLogoUrl = savedLogoUrl;

      if (selectedFile) {
        const savedBranding = await saveLogo.mutateAsync({
          institutionId,
          institutionName,
          currentPublicSlug: null,
          file: selectedFile,
        });
        updatedLogoUrl = savedBranding.logoUrl;
        setSavedLogoUrl(updatedLogoUrl);
        setSelectedFile(null);
        setPreviewUrl(null);
      }

      await updateInstitutionBranding({
        institutionId,
        profileId: profile.id,
        logo_url: updatedLogoUrl,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });

      setSuccess('Identidade visual atualizada com sucesso!');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar a identidade visual.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveLogo = async () => {
    setError(null);
    setSuccess(null);

    if (!profile?.id) return;

    try {
      setIsSaving(true);
      await removeLogo.mutateAsync({
        institutionId,
        institutionName,
        currentPublicSlug: null,
      });

      await updateInstitutionBranding({
        institutionId,
        profileId: profile.id,
        logo_url: null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });

      setSavedLogoUrl(null);
      setSelectedFile(null);
      setPreviewUrl(null);
      setSuccess('Logo removida com sucesso!');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover a logo.');
    } finally {
      setIsSaving(false);
    }
  };

  const displayLogo = previewUrl || savedLogoUrl;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Identidade Visual da Instituição (Diretor)
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Personalize o logotipo e as cores exclusivas da sua escola.
            </p>
          </div>
        </div>
      </div>

      {/* Leitura do Endereço da Instituição */}
      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Globe className="h-4 w-4 text-blue-500" />
          <span>Endereço da instituição:</span>
        </div>
        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
          {currentSubdomain ? (
            <a
              href={`https://${currentSubdomain}.grupotec.dev.br`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
            >
              https://{currentSubdomain}.grupotec.dev.br
            </a>
          ) : (
            <span className="italic text-amber-700 dark:text-amber-400">
              O endereço da instituição ainda não foi configurado pelo administrador.
            </span>
          )}
        </p>
      </div>

      <form onSubmit={handleSaveBranding} className="mt-6 space-y-6">
        {/* Gestão do Logotipo */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Logotipo da Instituição
          </label>

          <div className="mt-2 flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              {displayLogo ? (
                <img
                  src={displayLogo}
                  alt={`Logo de ${institutionName}`}
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-slate-400" />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                disabled={isSaving}
                className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:file:text-slate-300"
              />

              {savedLogoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={isSaving}
                  className="self-start text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  Remover logotipo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Gestão de Cores */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Cor Primária
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                disabled={isSaving}
                className="h-10 w-12 cursor-pointer rounded border border-slate-300 bg-transparent p-1 dark:border-slate-700"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                disabled={isSaving}
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Cor Secundária
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                disabled={isSaving}
                className="h-10 w-12 cursor-pointer rounded border border-slate-300 bg-transparent p-1 dark:border-slate-700"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                disabled={isSaving}
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
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

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 dark:hover:bg-indigo-500"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar identidade visual
          </button>
        </div>
      </form>
    </div>
  );
}
