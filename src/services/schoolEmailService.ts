import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import { supabase } from '../lib/supabaseClient';

export const SCHOOL_EMAIL_AUDIENCES = [
  'STUDENTS',
  'GUARDIANS',
  'STUDENTS_AND_GUARDIANS',
  'TEACHERS',
  'STUDENTS_GUARDIANS_AND_TEACHERS',
  'SELECTED',
] as const;

const recipientCache = new Map<string, SchoolEmailRecipient[]>();

export type SchoolEmailAudience =
  (typeof SCHOOL_EMAIL_AUDIENCES)[number];

export interface SchoolEmailRecipient {
  id: string;
  kind: 'STUDENT' | 'GUARDIAN' | 'TEACHER';
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
    'success' in data &&
    data.success === false &&
    'code' in data &&
    typeof data.code === 'string' &&
    'message' in data &&
    typeof data.message === 'string'
  ) {
    return new SchoolEmailServiceError(
      data.message,
      data.code,
    );
  }

  return null;
}

async function getFunctionError(
  error: unknown,
): Promise<SchoolEmailServiceError> {
  if (error instanceof FunctionsHttpError) {
    try {
      const responseError = getResponseError(await error.context.json());
      if (responseError) return responseError;
    } catch {
      // A relay or proxy can return a non-JSON body.
    }

    return new SchoolEmailServiceError(
      'Não foi possível processar o e-mail institucional.',
      'FUNCTION_HTTP_ERROR',
    );
  }

  if (error instanceof FunctionsRelayError) {
    return new SchoolEmailServiceError(
      'O serviço de e-mail está temporariamente indisponível.',
      'FUNCTION_RELAY_ERROR',
    );
  }

  if (error instanceof FunctionsFetchError) {
    return new SchoolEmailServiceError(
      'Não foi possível conectar ao serviço de e-mail.',
      'FUNCTION_FETCH_ERROR',
    );
  }

  if (error instanceof Error) {
    return new SchoolEmailServiceError(error.message, 'UNKNOWN_ERROR');
  }

  return new SchoolEmailServiceError(
    'Não foi possível concluir o envio.',
    'UNKNOWN_ERROR',
  );
}

async function invoke(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke(
    'send-school-email',
    { body },
  );

  if (error) {
    throw await getFunctionError(error);
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
  getCachedRecipients(
    institutionId: string,
  ): SchoolEmailRecipient[] | null {
    return recipientCache.get(institutionId) ?? null;
  },

  async listRecipients(
    institutionId: string,
  ): Promise<SchoolEmailRecipient[]> {
    const data = await invoke({
      action: 'list_recipients',
      institutionId,
    });

    const recipients = Array.isArray(data.recipients)
      ? data.recipients as SchoolEmailRecipient[]
      : [];
    recipientCache.set(institutionId, recipients);
    return recipients;
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
