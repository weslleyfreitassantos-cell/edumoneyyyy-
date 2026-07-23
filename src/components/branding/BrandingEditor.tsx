import {
  Image as ImageIcon,
  Loader2,
  Palette,
  Save,
  Trash2,
  Upload,
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
import {
  DEFAULT_BRAND_PRIMARY_COLOR,
  DEFAULT_BRAND_SECONDARY_COLOR,
  type BrandingImageKind,
  validateBrandingImageFile,
} from '../../services/brandingValidation';

interface BrandingEditorProps {
  title: string;
  description: string;
  branding: BrandingRecord | null | undefined;
  isLoading: boolean;
  isSaving: boolean;
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
              className="h-full w-full object-contain"
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(branding?.displayName ?? '');
    setPrimaryColor(
      branding?.primaryColor ?? DEFAULT_BRAND_PRIMARY_COLOR,
    );
    setSecondaryColor(
      branding?.secondaryColor ??
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
  }, [
    branding?.displayName,
    branding?.primaryColor,
    branding?.secondaryColor,
    branding?.logoUrl,
    branding?.faviconUrl,
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
    };
  }, [faviconDraft.previewUrl, logoDraft.previewUrl]);

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
        removeLogo: logoDraft.remove,
        removeFavicon: faviconDraft.remove,
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
  const previewFaviconUrl = getAssetUrl(
    faviconDraft,
    branding?.faviconUrl,
  );

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
          className="mt-5 space-y-5"
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

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-4">
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
              </div>
            </div>

            <div className="rounded-lg border border-[#d8deea] bg-[#f8faff] p-4">
              <p className="text-sm font-bold text-[#181c20]">
                Pre-visualizacao
              </p>
              <div
                className="mt-4 overflow-hidden rounded-lg border border-[#d8deea] bg-white"
                style={{
                  '--brand-primary': primaryColor,
                  '--brand-secondary': secondaryColor,
                } as CSSProperties}
              >
                <div
                  className="h-2"
                  style={{
                    background:
                      'linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))',
                  }}
                />
                <div className="flex items-center gap-3 p-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-[#d8deea] bg-[#f8faff]">
                    {previewLogoUrl ? (
                      <img
                        src={previewLogoUrl}
                        alt="Pre-visualizacao da logo"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ImageIcon
                        className="h-6 w-6 text-[#667085]"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#181c20]">
                      {displayName.trim() ||
                        'EduManager Pro'}
                    </p>
                    <p className="mt-1 text-xs text-[#667085]">
                      {previewFaviconUrl
                        ? 'Favicon selecionado'
                        : 'Sem favicon proprio'}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#005bbf] px-4 text-sm font-semibold text-white transition hover:bg-[#004a9f] focus:outline-none focus:ring-2 focus:ring-[#005bbf]/30 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Save
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                )}
                Salvar
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
