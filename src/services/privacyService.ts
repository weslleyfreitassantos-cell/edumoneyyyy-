import { supabase } from '../lib/supabaseClient';

export type PrivacyExportPayload = Record<string, unknown>;

export class PrivacyServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrivacyServiceError';
  }
}

export async function exportCurrentUserData(): Promise<PrivacyExportPayload> {
  const { data, error } = await supabase.rpc('export_current_user_data');

  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    throw new PrivacyServiceError('Não foi possível preparar sua exportação de dados.');
  }

  return data as PrivacyExportPayload;
}

export function downloadPrivacyExport(
  payload: PrivacyExportPayload,
  now = new Date(),
): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const date = now.toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = `tecescola-meus-dados-${date}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
