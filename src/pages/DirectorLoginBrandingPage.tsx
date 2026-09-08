import { useEffect, useState, type ChangeEvent, type CSSProperties } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Globe,
  Image as ImageIcon,
  Loader2,
  Palette,
  Upload,
  Trash2,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useInstitution } from '../contexts/InstitutionContext';
import { updateInstitutionBranding } from '../services/institutionService';
import {
  useSaveInstitutionFavicon,
  useSaveInstitutionLogo,
  useRemoveInstitutionFavicon,
  useRemoveInstitutionLogo,
} from '../hooks/useInstitutionBranding';

const DEFAULT_PRIMARY = '#005bbf';
const DEFAULT_SECONDARY = '#6ffbbe';

export function DirectorLoginBrandingPage() {
  const { profile } = useAuth();
  const { currentInstitution, refresh } = useInstitution();
  const saveLogo = useSaveInstitutionLogo();
  const removeLogo = useRemoveInstitutionLogo();
  const saveFavicon = useSaveInstitutionFavicon();
  const removeFavicon = useRemoveInstitutionFavicon();

  const institutionId = currentInstitution?.id ?? null;
  const institutionName = currentInstitution?.name ?? '';
  const currentSubdomain = currentInstitution?.subdomain ?? null;

  const [loginDisplayName, setLoginDisplayName] = useState<string>(
    currentInstitution?.login_display_name ?? currentInstitution?.name ?? '',
  );
  const [primaryColor, setPrimaryColor] = useState<string>(
    currentInstitution?.primary_color || DEFAULT_PRIMARY,
  );
  const [secondaryColor, setSecondaryColor] = useState<string>(
    currentInstitution?.secondary_color || DEFAULT_SECONDARY,
  );

  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    currentInstitution?.logo_url ?? null,
  );
  const [savedLogoUrl, setSavedLogoUrl] = useState<string | null>(
    currentInstitution?.logo_url ?? null,
  );

  const [selectedFaviconFile, setSelectedFaviconFile] = useState<File | null>(null);
  const [faviconPreviewUrl, setFaviconPreviewUrl] = useState<string | null>(
    currentInstitution?.favicon_url ?? null,
  );
  const [savedFaviconUrl, setSavedFaviconUrl] = useState<string | null>(
    currentInstitution?.favicon_url ?? null,
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setLoginDisplayName(
      currentInstitution?.login_display_name ?? currentInstitution?.name ?? '',
    );
    setPrimaryColor(currentInstitution?.primary_color || DEFAULT_PRIMARY);
    setSecondaryColor(currentInstitution?.secondary_color || DEFAULT_SECONDARY);
    setSavedLogoUrl(currentInstitution?.logo_url ?? null);
    setLogoPreviewUrl(currentInstitution?.logo_url ?? null);
    setSavedFaviconUrl(currentInstitution?.favicon_url ?? null);
    setFaviconPreviewUrl(currentInstitution?.favicon_url ?? null);
  }, [
    currentInstitution?.id,
    currentInstitution?.login_display_name,
    currentInstitution?.name,
    currentInstitution?.primary_color,
    currentInstitution?.secondary_color,
    currentInstitution?.logo_url,
    currentInstitution?.favicon_url,
  ]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl && logoPreviewUrl !== savedLogoUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl, savedLogoUrl]);

  useEffect(() => {
    return () => {
      if (faviconPreviewUrl && faviconPreviewUrl !== savedFaviconUrl) {
        URL.revokeObjectURL(faviconPreviewUrl);
      }
    };
  }, [faviconPreviewUrl, savedFaviconUrl]);

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedLogoFile(null);
      setLogoPreviewUrl(savedLogoUrl);
      return;
    }

    if (file.type === 'image/svg+xml') {
      setError('Formato SVG não é permitido para a logo.');
      return;
    }

    setSelectedLogoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setLogoPreviewUrl(objectUrl);
  };

  const handleFaviconChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFaviconFile(null);
      setFaviconPreviewUrl(savedFaviconUrl);
      return;
    }

    if (file.type === 'image/svg+xml') {
      setError('Formato SVG não é permitido para o favicon.');
      return;
    }

    setSelectedFaviconFile(file);
    const objectUrl = URL.createObjectURL(file);
    setFaviconPreviewUrl(objectUrl);
  };

  const handleRemoveLogo = async () => {
    if (!institutionId) return;
    setError(null);
    setSuccess(null);

    try {
      setIsSaving(true);
      await removeLogo.mutateAsync({
        institutionId,
        institutionName,
        currentPublicSlug: null,
      });

      setSavedLogoUrl(null);
      setSelectedLogoFile(null);
      setLogoPreviewUrl(null);
      setSuccess('Logo removida com sucesso!');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover a logo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveFavicon = async () => {
    if (!institutionId) return;
    setError(null);
    setSuccess(null);

    try {
      setIsSaving(true);
      await removeFavicon.mutateAsync({
        institutionId,
        institutionName,
        currentPublicSlug: null,
      });

      setSavedFaviconUrl(null);
      setSelectedFaviconFile(null);
      setFaviconPreviewUrl(null);
      setSuccess('Favicon removido com sucesso!');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover o favicon.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!institutionId) {
      setError('Instituição não encontrada.');
      return;
    }

    if (!profile?.id) {
      setError('Usuário não autenticado.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      let updatedLogoUrl = savedLogoUrl;
      let updatedFaviconUrl = savedFaviconUrl;

      if (selectedLogoFile) {
        const savedBranding = await saveLogo.mutateAsync({
          institutionId,
          institutionName,
          currentPublicSlug: null,
          file: selectedLogoFile,
        });
        updatedLogoUrl = savedBranding.logoUrl;
        setSavedLogoUrl(updatedLogoUrl);
        setSelectedLogoFile(null);
      }

      if (selectedFaviconFile) {
        const savedBranding = await saveFavicon.mutateAsync({
          institutionId,
          institutionName,
          currentPublicSlug: null,
          file: selectedFaviconFile,
        });
        updatedFaviconUrl = savedBranding.faviconUrl;
        setSavedFaviconUrl(updatedFaviconUrl);
        setSelectedFaviconFile(null);
      }

      await updateInstitutionBranding({
        institutionId,
        profileId: profile.id,
        login_display_name: loginDisplayName.trim() || null,
        logo_url: updatedLogoUrl,
        favicon_url: updatedFaviconUrl,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });

      setSuccess('Identidade visual do login atualizada com sucesso!');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar a identidade visual.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!institutionId) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <section className="max-w-md text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            Nenhuma instituição vinculada
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Você não possui uma instituição ativa para personalizar o login.
          </p>
        </section>
      </main>
    );
  }

  const previewDisplayName = loginDisplayName.trim() || institutionName;
  const previewPrimary = primaryColor || DEFAULT_PRIMARY;
  const previewSecondary = secondaryColor || DEFAULT_SECONDARY;

  return (
    <main className="min-h-screen bg-slate-50 p-6 dark:bg-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Personalizar login
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Personalize a aparência da tela de login da sua instituição.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Globe className="h-4 w-4 text-blue-500" />
            <span>Endereço da instituição:</span>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
            {currentSubdomain ? (
              <a
                href={`https://${currentSubdomain}.grupotec.dev.br/login`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
              >
                https://{currentSubdomain}.grupotec.dev.br/login
              </a>
            ) : (
              <span className="italic text-amber-700 dark:text-amber-400">
                O endereço ainda não foi configurado pelo administrador.
              </span>
            )}
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div>
              <label
                htmlFor="login-display-name"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Nome exibido
              </label>
              <input
                id="login-display-name"
                type="text"
                value={loginDisplayName}
                onChange={(e) => setLoginDisplayName(e.target.value)}
                disabled={isSaving}
                placeholder="Ex.: Escola Luz"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="primary-color"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Cor principal
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    aria-label="Selecionar cor principal"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    disabled={isSaving}
                    className="h-10 w-12 cursor-pointer rounded border border-slate-300 bg-transparent p-1 dark:border-slate-700"
                  />
                  <input
                    id="primary-color"
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    disabled={isSaving}
                    className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="secondary-color"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Cor secundária
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    aria-label="Selecionar cor secund?ria"
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    disabled={isSaving}
                    className="h-10 w-12 cursor-pointer rounded border border-slate-300 bg-transparent p-1 dark:border-slate-700"
                  />
                  <input
                    id="secondary-color"
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    disabled={isSaving}
                    className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Logo principal
              </label>
              <div className="mt-2 flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  {logoPreviewUrl ? (
                    <img
                      src={logoPreviewUrl}
                      alt="Logo"
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-slate-400" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                    <Upload className="h-4 w-4" />
                    Selecionar logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoChange}
                      disabled={isSaving}
                      className="hidden"
                    />
                  </label>
                  {savedLogoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={isSaving}
                      className="self-start text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      Remover logo
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                PNG, JPEG ou WebP.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Favicon
              </label>
              <div className="mt-2 flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  {faviconPreviewUrl ? (
                    <img
                      src={faviconPreviewUrl}
                      alt="Favicon"
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-slate-400" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                    <Upload className="h-4 w-4" />
                    Selecionar favicon
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFaviconChange}
                      disabled={isSaving}
                      className="hidden"
                    />
                  </label>
                  {savedFaviconUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveFavicon}
                      disabled={isSaving}
                      className="self-start text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      Remover favicon
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                PNG, JPEG ou WebP.
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

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition disabled:opacity-50"
                style={{
                  backgroundImage: `linear-gradient(90deg, ${previewPrimary}, ${previewSecondary})`,
                }}
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pré-visualização
            </h2>
            <div
              className="rounded-xl border border-slate-200 p-6 dark:border-slate-700"
              style={
                {
                  '--brand-primary': previewPrimary,
                  '--brand-secondary': previewSecondary,
                } as CSSProperties
              }
            >
              <div className="mb-4 flex flex-col items-center">
                <div className="flex h-14 min-w-[36px] items-center justify-center">
                  {logoPreviewUrl ? (
                    <img
                      src={logoPreviewUrl}
                      alt="Logo"
                      className="max-h-[80px] max-w-[180px] object-contain"
                    />
                  ) : (
                    <div
                      className="flex h-14 w-36 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
                      aria-hidden="true"
                    >
                      <ImageIcon className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                </div>
                {previewDisplayName && (
                  <p className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                    {previewDisplayName}
                  </p>
                )}
                <div
                  className="mt-2 h-1 w-12 rounded-full"
                  style={{
                    backgroundImage:
                      'linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))',
                  }}
                  aria-hidden="true"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    E-mail
                  </label>
                  <div className="relative mt-1">
                    <div className="h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-800" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Senha
                  </label>
                  <div className="relative mt-1">
                    <div className="h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-800" />
                  </div>
                </div>

                <div
                  className="flex h-[40px] w-full items-center justify-center rounded-lg text-sm font-semibold text-white"
                  style={{
                    backgroundImage:
                      'linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))',
                  }}
                >
                  ENTRAR
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
