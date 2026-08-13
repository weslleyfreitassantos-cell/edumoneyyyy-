import { describe, expect, it, vi } from "vitest";

import {
  updateAuthUserPassword,
  type AuthAdminClient,
} from "./password-update";

function createClient({
  lookup,
  update,
}: {
  lookup?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
} = {}): AuthAdminClient {
  return {
    auth: {
      admin: {
        getUserById: lookup ?? vi.fn(),
        updateUserById: update ?? vi.fn(),
      },
    },
  };
}

const targetUserId = "auth-student-1";
const password = "NovaSenha123";

describe("manage-school-user password update", () => {
  it("confirma o Auth user e atualiza uma unica vez com o alvo correto", async () => {
    const lookup = vi.fn().mockResolvedValue({
      data: { user: { id: targetUserId } },
      error: null,
    });
    const update = vi.fn().mockResolvedValue({
      data: { user: { id: targetUserId } },
      error: null,
    });

    const result = await updateAuthUserPassword(
      createClient({ lookup, update }),
      targetUserId,
      password,
    );

    expect(result).toEqual({ ok: true, userId: targetUserId });
    expect(lookup).toHaveBeenCalledOnce();
    expect(lookup).toHaveBeenCalledWith(targetUserId);
    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(targetUserId, {
      password,
      email_confirm: true,
    });
  });

  it("nao atualiza quando o Auth user nao existe", async () => {
    const lookup = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const update = vi.fn();

    const result = await updateAuthUserPassword(
      createClient({ lookup, update }),
      targetUserId,
      password,
    );

    expect(result).toMatchObject({ ok: false, code: "AUTH_USER_NOT_FOUND" });
    expect(update).not.toHaveBeenCalled();
  });

  it("nao atualiza quando a consulta de Auth falha", async () => {
    const lookup = vi.fn().mockResolvedValue({
      data: { user: null },
      error: {
        status: 500,
        code: "lookup_failed",
        message: "lookup failed",
      },
    });
    const update = vi.fn();

    const result = await updateAuthUserPassword(
      createClient({ lookup, update }),
      targetUserId,
      password,
    );

    expect(result).toMatchObject({ ok: false, code: "AUTH_USER_LOOKUP_FAILED" });
    expect(update).not.toHaveBeenCalled();
  });

  it("bloqueia uma resposta de Auth com ID divergente", async () => {
    const lookup = vi.fn().mockResolvedValue({
      data: { user: { id: "auth-other-user" } },
      error: null,
    });
    const update = vi.fn();

    const result = await updateAuthUserPassword(
      createClient({ lookup, update }),
      targetUserId,
      password,
    );

    expect(result).toMatchObject({ ok: false, code: "AUTH_USER_ID_MISMATCH" });
    expect(update).not.toHaveBeenCalled();
  });

  it("retorna o erro redigido quando o Auth rejeita a senha", async () => {
    const lookup = vi.fn().mockResolvedValue({
      data: { user: { id: targetUserId } },
      error: null,
    });
    const update = vi.fn().mockResolvedValue({
      data: { user: null },
      error: {
        status: 422,
        code: "invalid_password",
        name: "AuthApiError",
        message: "password=secret-value is invalid",
      },
    });

    const result = await updateAuthUserPassword(
      createClient({ lookup, update }),
      targetUserId,
      password,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "PASSWORD_UPDATE_FAILED",
      diagnostic: {
        status: 422,
        code: "invalid_password",
        name: "AuthApiError",
        message: "password=[REDACTED] is invalid",
      },
    });
    expect(update).toHaveBeenCalledOnce();
  });

  it("exige data.user com o mesmo ID depois da atualizacao", async () => {
    const lookup = vi.fn().mockResolvedValue({
      data: { user: { id: targetUserId } },
      error: null,
    });
    const update = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await updateAuthUserPassword(
      createClient({ lookup, update }),
      targetUserId,
      password,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "PASSWORD_UPDATE_RESPONSE_INVALID",
    });
  });
});
