import { useState, type ChangeEvent } from 'react';
import { Building2, Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { useSaveInstitutionLogo, useRemoveInstitutionLogo } from '../../hooks/useInstitutionBranding';

interface InstitutionBrandingSectionProps {
  institutionId: string;
  institutionName: string;
  currentLogoUrl: string | null;
  currentPublicSlug: string | null;
}

export function InstitutionBrandingSection({
  institutionId,
  institutionName,
  currentLogoUrl,
  currentPublicSlug,
}: InstitutionBrandingSectionProps) {
  const saveLogo = useSaveInstitutionLogo();
  const removeLogo = useRemoveInstitutionLogo();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
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

  const handleSave = async () => {
    if (!selectedFile) return;
    setError(null);
    try {
      await saveLogo.mutateAsync({
        institutionId,
        institutionName,
        currentPublicSlug,
        file: selectedFile,
      });
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar logo.');
    }
  };

  const handleRemove = async () => {
    setError(null);
    try {
      await removeLogo.mutateAsync({
        institutionId,
        institutionName,
        currentPublicSlug,
      });
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover logo.');
    }
  };

  const publicLink = currentPublicSlug 
    ? `${window.location.origin}/login?institution=${currentPublicSlug}`
    : null;

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <ImageIcon className="h-4 w-4" />
        Identidade visual
      </h3>
      
      {error && (
        <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}
      
      {(saveLogo.error?.message?.includes('storage') || saveLogo.error?.message?.includes('função')) && (
        <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-700 border border-amber-200">
          A configuração de identidade visual ainda não está disponível neste ambiente.
        </div>
      )}

      <div className="mt-4 flex flex-col sm:flex-row gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-gray-300 bg-white overflow-hidden shadow-sm">
            {previewUrl || currentLogoUrl ? (
              <img 
                src={previewUrl || currentLogoUrl!} 
                alt="Logo" 
                className="h-full w-full object-contain"
              />
            ) : (
              <Building2 className="h-8 w-8 text-gray-400" />
            )}
          </div>
          <span className="text-xs text-gray-500">
            {previewUrl ? 'Preview' : 'Atual'}
          </span>
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Logo da Instituição
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Formatos aceitos: PNG, JPEG, WebP. Limite: 2 MB.
            </p>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
                <Upload className="h-4 w-4" />
                Selecionar logo
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/png, image/jpeg, image/webp" 
                  onChange={handleFileChange}
                />
              </label>

              {selectedFile && (
                <button
                  onClick={() => handleSave()}
                  disabled={saveLogo.isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                >
                  {saveLogo.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar logo
                </button>
              )}

              {currentLogoUrl && !selectedFile && (
                <button
                  onClick={() => handleRemove()}
                  disabled={removeLogo.isPending}
                  className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 shadow-sm"
                >
                  {removeLogo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Remover logo
                </button>
              )}
            </div>
          </div>

          {publicLink && (
            <div>
              <p className="text-xs font-medium text-gray-700">Link público de login:</p>
              <a 
                href={publicLink} 
                target="_blank" 
                rel="noreferrer" 
                className="text-xs text-blue-600 hover:underline break-all"
              >
                {publicLink}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
