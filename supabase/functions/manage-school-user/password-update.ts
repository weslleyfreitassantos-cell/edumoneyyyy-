export interface AuthAdminUser {
  id: string;
}

export interface AuthAdminResult {
  data: {
    user: AuthAdminUser | null;
  };
  error: unknown;
}

export interface AuthAdminClient {
  auth: {
    admin: {
      getUserById: (userId: string) => Promise<AuthAdminResult>;
      updateUserById: (
        userId: string,
        attributes: { password: string; email_confirm: boolean },
      ) => Promise<AuthAdminResult>;
    };
  };
}

export interface RedactedAuthError {
  status?: number;
  code?: string;
  name?: string;
  message: string;
}

export type PasswordUpdateFailureCode =
  | "AUTH_USER_LOOKUP_FAILED"
  | "AUTH_USER_NOT_FOUND"
  | "AUTH_USER_ID_MISMATCH"
  | "PASSWORD_UPDATE_FAILED"
  | "PASSWORD_UPDATE_RESPONSE_INVALID";

export type PasswordUpdateResult =
  | { ok: true; userId: string }
  | {
    ok: false;
    code: PasswordUpdateFailureCode;
    diagnostic: RedactedAuthError;
  };

function getStringField(
  error: unknown,
  field: "code" | "name" | "message",
): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    field in error &&
    typeof error[field] === "string"
  ) {
    return error[field] as string;
  }
  return undefined;
}

function getStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }
  return undefined;
}

function redactMessage(message: string): string {
  return message
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(
      /(password|access[_-]?token|refresh[_-]?token|api[_-]?key|service[_-]?role)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[REDACTED]",
    )
    .slice(0, 240);
}

export function redactAuthError(error: unknown): RedactedAuthError {
  const message = getStringField(error, "message") ?? "Unknown Auth error.";
  const status = getStatus(error);
  const code = getStringField(error, "code");
  const name = getStringField(error, "name");

  return {
    ...(status !== undefined ? { status } : {}),
    ...(code ? { code } : {}),
    ...(name ? { name } : {}),
    message: redactMessage(message),
  };
}

function failure(
  code: PasswordUpdateFailureCode,
  error?: unknown,
  message?: string,
): PasswordUpdateResult {
  return {
    ok: false,
    code,
    diagnostic: message
      ? { message }
      : redactAuthError(error),
  };
}

export async function updateAuthUserPassword(
  client: AuthAdminClient,
  targetUserId: string,
  password: string,
): Promise<PasswordUpdateResult> {
  let lookup: AuthAdminResult;
  try {
    lookup = await client.auth.admin.getUserById(targetUserId);
  } catch (error) {
    return failure("AUTH_USER_LOOKUP_FAILED", error);
  }

  if (lookup.error) {
    return failure("AUTH_USER_LOOKUP_FAILED", lookup.error);
  }

  const authUser = lookup.data?.user ?? null;
  if (!authUser) {
    return failure(
      "AUTH_USER_NOT_FOUND",
      undefined,
      "Auth user was not found for the target profile.",
    );
  }

  if (authUser.id !== targetUserId) {
    return failure(
      "AUTH_USER_ID_MISMATCH",
      undefined,
      "Auth returned a different user than the target profile.",
    );
  }

  let update: AuthAdminResult;
  try {
    update = await client.auth.admin.updateUserById(
      targetUserId,
      { password, email_confirm: true },
    );
  } catch (error) {
    return failure("PASSWORD_UPDATE_FAILED", error);
  }

  if (update.error) {
    return failure("PASSWORD_UPDATE_FAILED", update.error);
  }

  if (!update.data?.user || update.data.user.id !== targetUserId) {
    return failure(
      "PASSWORD_UPDATE_RESPONSE_INVALID",
      undefined,
      "Auth did not confirm the updated target user.",
    );
  }

  return { ok: true, userId: update.data.user.id };
}
