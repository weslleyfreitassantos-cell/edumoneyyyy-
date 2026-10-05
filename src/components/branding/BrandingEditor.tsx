import {
  Image as ImageIcon,
  Loader2,
  Monitor,
  Palette,
  Save,
  Smartphone,
  Trash2,
  Upload,
  Globe,
} from 'lucide-react';
import {
  useEffect,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from 'react';

import type {
  BrandingRecord,
  SaveBrandingInput,
} from '../../services/brandingService';
import { LoginBrandingDemoScreen } from './LoginBrandingDemoScreen';
import {
  DEFAULT_BRAND_PRIMARY_COLOR,
  DEFAULT_BRAND_SECONDARY_COLOR,
  type BrandingImageKind,
  validateBrandingImageFile,
} from '../../services/brandingValidation';
import { useLoginBrandingPreview } from '../../hooks/useLoginBrandingPreview';

interface BrandingEditorProps {
  title: string;
  description: string;
  branding: BrandingRecord | null | undefined;
  isLoading: boolean;
  isSaving: boolean;
  showBackground?: boolean;
  loginUrl?: string;
  onSave: (input: SaveBrandingInput) => Promise<void>;
}

interface AssetDraft {
  file: File | null;
  previewUrl: string | null;
  remove: boolean;
}

const initialAssetDraft: AssetDraft = {
  file: null,
  previewUrl: null,
  remove: false,
};

function getAssetUrl(
  draft: AssetDraft,
  persistedUrl: string | null | undefined,
): string | null {
  if (draft.remove) {
    return null;
  }

  return draft.previewUrl ?? persistedUrl ?? null;
}

function revokePreview(url: string | null): void {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

function AssetControl({
  id,
  label,
  helper,
  kind,
  draft,
  persistedUrl,
  onChange,
}: {
  id: string;
  label: string;
  helper: string;
  kind: BrandingImageKind;
  draft: AssetDraft;
  persistedUrl: string | null | undefined;
  onChange: (draft: AssetDraft) => void;
}) {
  const currentUrl = getAssetUrl(draft, persistedUrl);

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      onChange({
        ...draft,
        file: null,
      });
      return;
    }

    const validationError =
      await validateBrandingImageFile(file, kind);

    if (validationError) {
      throw new Error(validationError);
    }

    revokePreview(draft.previewUrl);
    onChange({
      file,
      previewUrl: URL.createObjectURL(file),
      remove: false,
    });
  }

  return (
    <div className="rounded-lg border border-[#d8deea] bg-white p-4">
      <div className="flex items-start gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#d8deea] bg-[#f8faff]">
          {currentUrl ? (
            <img
              src={currentUrl}
              alt={label}
              className={`h-full w-full ${kind === 'background' ? 'object-cover' : 'object-contain'}`}
            />
          ) : (
            <ImageIcon
              className="h-7 w-7 text-[#667085]"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <label
            htmlFor={id}
            className="block text-sm font-bold text-[#181c20]"
          >
            {label}
          </label>
          <p className="mt-1 text-xs leading-5 text-[#667085]">
            {helper}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#c5c5d3] bg-white px-3 text-sm font-semibold text-[#414754] transition hover:bg-[#f8faff]">
              <Upload
                className="h-4 w-4"
                aria-hidden="true"
              />
              Selecionar
              <input
                id={id}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={(event) => {
                  void handleFileChange(event).catch((error) => {
                    onChange({
                      ...draft,
                      file: null,
                      previewUrl: null,
                    });
                    event.target.value = '';
                    window.dispatchEvent(
                      new CustomEvent(
                        'branding-editor-error',
                        {
                          detail:
                            error instanceof Error
                              ? error.message
                              : 'Arquivo invalido.',
                        },
                      ),
                    );
                  });
                }}
              />
            </label>

            {(persistedUrl || draft.file) && (
              <button
                type="button"
                onClick={() => {
                  revokePreview(draft.previewUrl);
                  onChange({
                    file: null,
                    previewUrl: null,
                    remove: true,
                  });
                }}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-semibold text-[#ba1a1a] transition hover:bg-red-100"
              >
                <Trash2
                  className="h-4 w-4"
                  aria-hidden="true"
                />
                Remover
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BrandingEditor({
  title,
  description,
  branding,
  isLoading,
  isSaving,
  showBackground = false,
  loginUrl,
  onSave,
}: BrandingEditorProps) {
  const [displayName, setDisplayName] = useState('');
  const [primaryColor, setPrimaryColor] = useState(
    DEFAULT_BRAND_PRIMARY_COLOR,
  );
  const [secondaryColor, setSecondaryColor] = useState(
    DEFAULT_BRAND_SECONDARY_COLOR,
  );
  const [logoDraft, setLogoDraft] =
    useState<AssetDraft>(initialAssetDraft);
  const [faviconDraft, setFaviconDraft] =
    useState<AssetDraft>(initialAssetDraft);
  const [backgroundDraft, setBackgroundDraft] =
    useState<AssetDraft>(initialAssetDraft);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { previewMode, openPreview, closePreview } =
    useLoginBrandingPreview();

  useEffect(() => {
    if (!branding) {
      return;
    }

    setDisplayName(branding.displayName ?? '');
    setPrimaryColor(
      branding.primaryColor ?? DEFAULT_BRAND_PRIMARY_COLOR,
    );
    setSecondaryColor(
      branding.secondaryColor ??
        DEFAULT_BRAND_SECONDARY_COLOR,
    );
    setLogoDraft((current) => {
      revokePreview(current.previewUrl);
      return initialAssetDraft;
    });
    setFaviconDraft((current) => {
      revokePreview(current.previewUrl);
      return initialAssetDraft;
    });
    setBackgroundDraft((current) => {
      revokePreview(current.previewUrl);
      return initialAssetDraft;
    });
  }, [
    branding?.displayName,
    branding?.primaryColor,
    branding?.secondaryColor,
    branding?.logoUrl,
    branding?.faviconUrl,
    branding?.loginBackgroundUrl,
  ]);

  useEffect(() => {
    function handleEditorError(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      setError(detail || 'Arquivo invalido.');
      setSuccess(null);
    }

    window.addEventListener(
      'branding-editor-error',
      handleEditorError,
    );

    return () => {
      window.removeEventListener(
        'branding-editor-error',
        handleEditorError,
      );
      revokePreview(logoDraft.previewUrl);
      revokePreview(faviconDraft.previewUrl);
      revokePreview(backgroundDraft.previewUrl);
    };
  }, [
    backgroundDraft.previewUrl,
    faviconDraft.previewUrl,
    logoDraft.previewUrl,
  ]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await onSave({
        displayName,
        primaryColor,
        secondaryColor,
        logoFile: logoDraft.file,
        faviconFile: faviconDraft.file,
        backgroundFile: showBackground
          ? backgroundDraft.file
          : null,
        removeLogo: logoDraft.remove,
        removeFavicon: faviconDraft.remove,
        removeBackground: showBackground
          ? backgroundDraft.remove
          : false,
      });
      setSuccess('Identidade visual salva.');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Nao foi possivel salvar.',
      );
    }
  }

  const previewLogoUrl = getAssetUrl(
    logoDraft,
    branding?.logoUrl,
  );
  const previewBackgroundUrl = showBackground
    ? getAssetUrl(
        backgroundDraft,
        branding?.loginBackgroundUrl,
      )
    : null;
  const previewDisplayName = displayName.trim() || 'EduManager Pro';

  if (previewMode) {
    return (
      <LoginBrandingDemoScreen
        mode={previewMode}
        displayName={previewDisplayName}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        logoUrl={previewLogoUrl}
        backgroundUrl={previewBackgroundUrl}
        onClose={closePreview}
      />
    );
  }

  return (
    <section className="rounded-lg border border-[#d8deea] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Palette
            className="h-5 w-5 text-[#005bbf]"
            aria-hidden="true"
          />
          <h2 className="text-lg font-bold text-[#181c20]">
            {title}
          </h2>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-[#667085]">
          {description}
        </p>
      </div>

      {loginUrl && (
        <div className="mt-5 rounded-lg border border-[#d8deea] bg-[#f8faff] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#667085]">
            <Globe className="h-4 w-4 text-[#005bbf]" aria-hidden="true" />
            <span>Endereço de acesso da plataforma:</span>
          </div>
          <a
            href={loginUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-sm font-semibold text-[#005bbf] underline hover:text-[#004a9f]"
          >
            {loginUrl}
          </a>
        </div>
      )}

      {isLoading ? (
        <div
          role="status"
          className="mt-5 flex items-center gap-2 text-sm text-[#667085]"
        >
          <Loader2
            className="h-4 w-4 animate-spin"
            aria-hidden="true"
          />
          Carregando identidade visual...
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="mt-6 space-y-6"
        >
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
            >
              {success}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-[#d8deea] bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-3">
                  <label
                    htmlFor={`${title}-display-name`}
                    className="block text-sm font-semibold text-[#414754]"
                  >
                    Nome exibido
                  </label>
                  <input
                    id={`${title}-display-name`}
                    value={displayName}
                    onChange={(event) =>
                      setDisplayName(event.target.value)
                    }
                    placeholder="EduManager Pro"
                    className="mt-1 h-10 w-full rounded-lg border border-[#c5c5d3] px-3 text-sm outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`${title}-primary-color`}
                    className="block text-sm font-semibold text-[#414754]"
                  >
                    Cor principal
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id={`${title}-primary-color`}
                      type="color"
                      value={primaryColor}
                      onChange={(event) =>
                        setPrimaryColor(event.target.value)
                      }
                      className="h-10 w-12 rounded-lg border border-[#c5c5d3] bg-white p-1"
                    />
                    <input
                      aria-label="Valor da cor principal"
                      value={primaryColor}
                      onChange={(event) =>
                        setPrimaryColor(event.target.value)
                      }
                      className="h-10 min-w-0 flex-1 rounded-lg border border-[#c5c5d3] px-3 text-sm outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor={`${title}-secondary-color`}
                    className="block text-sm font-semibold text-[#414754]"
                  >
                    Cor secundaria
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id={`${title}-secondary-color`}
                      type="color"
                      value={secondaryColor}
                      onChange={(event) =>
                        setSecondaryColor(event.target.value)
                      }
                      className="h-10 w-12 rounded-lg border border-[#c5c5d3] bg-white p-1"
                    />
                    <input
                      aria-label="Valor da cor secundaria"
                      value={secondaryColor}
                      onChange={(event) =>
                        setSecondaryColor(event.target.value)
                      }
                      className="h-10 min-w-0 flex-1 rounded-lg border border-[#c5c5d3] px-3 text-sm outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <AssetControl
                  id={`${title}-logo`}
                  label="Logo principal"
                  helper="PNG, JPEG ou WebP. Limite: 2 MB."
                  kind="logo"
                  draft={logoDraft}
                  persistedUrl={branding?.logoUrl}
                  onChange={setLogoDraft}
                />
                <AssetControl
                  id={`${title}-favicon`}
                  label="Favicon"
                  helper="PNG, JPEG ou WebP. Limite: 512 KB."
                  kind="favicon"
                  draft={faviconDraft}
                  persistedUrl={branding?.faviconUrl}
                  onChange={setFaviconDraft}
                />
                {showBackground && (
                  <AssetControl
                    id={`${title}-background`}
                    label="Imagem de fundo do login"
                    helper="PNG, JPEG ou WebP. Limite: 5 MB."
                    kind="background"
                    draft={backgroundDraft}
                    persistedUrl={branding?.loginBackgroundUrl}
                    onChange={setBackgroundDraft}
                  />
                )}
              </div>

              <div className="flex justify-end border-t border-[#d8deea] pt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#004a9f] focus:outline-none focus:ring-2 focus:ring-[#005bbf]/30 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden="true" />
                  )}
                  Salvar
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[#d8deea] bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[#667085]">
                Pré-visualização
              </h2>
              <div
                className="relative flex min-h-[520px] items-center overflow-hidden rounded-xl border border-[#d8deea] p-6"
                style={
                  {
                    '--brand-primary': primaryColor,
                    '--brand-secondary': secondaryColor,
                    backgroundImage: previewBackgroundUrl
                      ? `url(${JSON.stringify(previewBackgroundUrl)})`
                      : 'image-set(url(/media/ff2-optimized.webp) type("image/webp"), url(/media/ff2.png) type("image/png"))',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  } as CSSProperties
                }
              >
                <div className="mx-auto w-full max-w-[320px] rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm">
                  <div className="mb-4 flex flex-col items-center">
                    <div className="flex h-14 min-w-[36px] items-center justify-center">
                      {previewLogoUrl ? (
                        <img
                          src={previewLogoUrl}
                          alt="Logo"
                          className="max-h-[80px] max-w-[180px] object-contain"
                        />
                      ) : (
                        <div
                          className="flex h-14 w-36 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50"
                          aria-hidden="true"
                        >
                          <ImageIcon className="h-6 w-6 text-slate-400" />
                        </div>
                      )}
                    </div>
                    {previewDisplayName && (
                      <p className="mt-2 text-sm font-bold text-slate-800">
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
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        E-mail
                      </label>
                      <div className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Senha
                      </label>
                      <div className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white" />
                    </div>
                    <div
                      className="flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold text-white"
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
              <div className="mt-4 flex flex-col gap-2 border-t border-[#d8deea] pt-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => openPreview('desktop')}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#c5c5d3] bg-white px-3 text-sm font-semibold text-[#414754] transition hover:border-[#005bbf] hover:text-[#005bbf] focus:outline-none focus:ring-2 focus:ring-[#005bbf]/30"
                >
                  <Monitor className="h-4 w-4" aria-hidden="true" />
                  Visualizar no desktop
                </button>
                <button
                  type="button"
                  onClick={() => openPreview('mobile')}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#c5c5d3] bg-white px-3 text-sm font-semibold text-[#414754] transition hover:border-[#005bbf] hover:text-[#005bbf] focus:outline-none focus:ring-2 focus:ring-[#005bbf]/30"
                >
                  <Smartphone className="h-4 w-4" aria-hidden="true" />
                  Visualizar no celular
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
