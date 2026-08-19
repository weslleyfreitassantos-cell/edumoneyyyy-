import { supabase } from '../lib/supabaseClient';

export const SCHOOL_EMAIL_AUDIENCES = [
  'STUDENTS',
  'GUARDIANS',
  'STUDENTS_AND_GUARDIANS',
  'SELECTED',
] as const;

export type SchoolEmailAudience =
  (typeof SCHOOL_EMAIL_AUDIENCES)[number];

export interface SchoolEmailRecipient {
  id: string;
  kind: 'STUDENT' | 'GUARDIAN';
  name: string;
  email: string | null;
}

export interface SchoolEmailContent {
  institutionId: string;
  audience: SchoolEmailAudience;
  selectedRecipientIds?: string[];
  subject: string;
  title?: string;
  message: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface SchoolEmailPreview {
  recipientCount: number;
  recipientsWithoutEmail: number;
  previewHtml: string;
}

export interface SchoolEmailSendResult {
  recipientCount: number;
  sentCount: number;
  recipientsWithoutEmail: number;
  failedCount: number;
}

export class SchoolEmailServiceError extends Error {
  code: string;

  constructor(message: string, code = 'SCHOOL_EMAIL_ERROR') {
    super(message);
    this.name = 'SchoolEmailServiceError';
    this.code = code;
  }
}

function getResponseError(data: unknown): SchoolEmailServiceError | null {
  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof data.message === 'string'
  ) {
    return new SchoolEmailServiceError(
      data.message,
      'code' in data && typeof data.code === 'string'
        ? data.code
        : 'SCHOOL_EMAIL_ERROR',
    );
  }

  return null;
}

async function invoke(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke(
    'send-school-email',
    { body },
  );

  if (error) {
    const responseError = getResponseError(error);
    throw responseError ?? new SchoolEmailServiceError(
      'Não foi possível conectar ao serviço de e-mail.',
      'FUNCTION_FETCH_ERROR',
    );
  }

  const bodyError = getResponseError(data);
  if (bodyError) {
    throw bodyError;
  }

  if (!data || typeof data !== 'object') {
    throw new SchoolEmailServiceError(
      'O serviço de e-mail respondeu em um formato inválido.',
      'INVALID_FUNCTION_RESPONSE',
    );
  }

  return data as Record<string, unknown>;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export const schoolEmailService = {
  async listRecipients(
    institutionId: string,
  ): Promise<SchoolEmailRecipient[]> {
    const data = await invoke({
      action: 'list_recipients',
      institutionId,
    });

    return Array.isArray(data.recipients)
      ? data.recipients as SchoolEmailRecipient[]
      : [];
  },

  async preview(
    content: SchoolEmailContent,
  ): Promise<SchoolEmailPreview> {
    const data = await invoke({
      action: 'preview',
      ...content,
    });

    return {
      recipientCount: asNumber(data.recipientCount),
      recipientsWithoutEmail: asNumber(data.recipientsWithoutEmail),
      previewHtml: typeof data.previewHtml === 'string'
        ? data.previewHtml
        : '',
    };
  },

  async send(
    content: SchoolEmailContent,
  ): Promise<SchoolEmailSendResult> {
    const data = await invoke({
      action: 'send',
      ...content,
    });

    return {
      recipientCount: asNumber(data.recipientCount),
      sentCount: asNumber(data.sentCount),
      recipientsWithoutEmail: asNumber(data.recipientsWithoutEmail),
      failedCount: asNumber(data.failedCount),
    };
  },
};
