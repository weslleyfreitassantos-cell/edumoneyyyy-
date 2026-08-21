import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import type { Database } from "../_shared/database.types.ts";

const PLATFORM_ORIGIN = "https://tecescola.grupotec.dev.br";

class SsoHandoffError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "SsoHandoffError";
    this.status = status;
    this.code = code;
  }
}

const requestSchema = z.object({
  institutionId: z.guid(),
}).strict();

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "cache-control": "no-store",
};

function jsonError(error: SsoHandoffError): Response {
  return Response.json(
    {
      success: false,
      code: error.code,
      message: error.message,
    },
    { status: error.status, headers: corsHeaders },
  );
}

function jsonSuccess(actionLink: string): Response {
  return Response.json(
    { success: true, actionLink },
    { headers: corsHeaders },
  );
}

function getRedirectTo(institutionId: string): string {
  const callback = new URL(
    `${PLATFORM_ORIGIN}/auth/confirm`,
  );
  callback.searchParams.set("handoff", "sso");
  callback.searchParams.set("returnTo", "/admin");
  callback.searchParams.set("institutionId", institutionId);
  return callback.toString();
}

function getActionLinkRedirect(
  actionLink: string,
): string | null {
  try {
    const actionUrl = new URL(actionLink);
    return (
      actionUrl.searchParams.get("redirect_to") ??
      actionUrl.searchParams.get("redirectTo")
    );
  } catch {
    return null;
  }
}

function hasExpectedSsoRedirect(
  actionLink: string,
  expectedRedirectTo: string,
): boolean {
  const actualRedirect = getActionLinkRedirect(actionLink);
  if (!actualRedirect) return false;

  try {
    const actualUrl = new URL(actualRedirect);
    const expectedUrl = new URL(expectedRedirectTo);

    return (
      actualUrl.origin === expectedUrl.origin &&
      actualUrl.pathname === expectedUrl.pathname &&
      actualUrl.searchParams.get("handoff") === "sso" &&
      actualUrl.searchParams.get("returnTo") === "/admin" &&
      actualUrl.searchParams.get("institutionId") ===
        expectedUrl.searchParams.get("institutionId")
    );
  } catch {
    return false;
  }
}

const authenticatedFetch = withSupabase<Database>(
  { auth: "user" },
  async (request, ctx) => {
    if (request.method !== "POST") {
      return jsonError(
        new SsoHandoffError(
          405,
          "METHOD_NOT_ALLOWED",
          "Método não permitido.",
        ),
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(
        new SsoHandoffError(
          400,
          "INVALID_JSON",
          "Corpo da requisição inválido.",
        ),
      );
    }

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return jsonError(
        new SsoHandoffError(
          400,
          "INVALID_PAYLOAD",
          "Instituição inválida.",
        ),
      );
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await ctx.supabase.auth.getUser();

      if (userError || !user?.email) {
        throw new SsoHandoffError(
          401,
          "UNAUTHENTICATED",
          "Sessão inválida ou expirada.",
        );
      }

      const { data: profile, error: profileError } =
        await ctx.supabaseAdmin
          .from("profiles")
          .select("id, role, platform_role, active")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) throw profileError;
      if (!profile || profile.active !== true || profile.role !== "ADMIN") {
        throw new SsoHandoffError(
          403,
          "ADMIN_REQUIRED",
          "Somente o ADMIN da conta pode alternar entre instituições.",
        );
      }

      const { data: institution, error: institutionError } =
        await ctx.supabaseAdmin
          .from("institutions")
          .select("id, account_id, active")
          .eq("id", validation.data.institutionId)
          .maybeSingle();

      if (institutionError) throw institutionError;
      if (!institution || institution.active !== true || !institution.account_id) {
        throw new SsoHandoffError(
          404,
          "INSTITUTION_NOT_FOUND",
          "Instituição não encontrada ou inativa.",
        );
      }

      const { data: account, error: accountError } =
        await ctx.supabaseAdmin
          .from("accounts")
          .select("id, owner_profile_id, status")
          .eq("id", institution.account_id)
          .maybeSingle();

      if (accountError) throw accountError;
      if (
        !account ||
        account.status !== "ACTIVE" ||
        account.owner_profile_id !== user.id
      ) {
        throw new SsoHandoffError(
          403,
          "ACCOUNT_OWNER_REQUIRED",
          "Somente o ADMIN proprietário da conta pode alternar entre instituições.",
        );
      }

      const redirectTo = getRedirectTo(institution.id);
      const { data: generatedLink, error: linkError } =
        await ctx.supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: user.email,
          options: { redirectTo },
        });

      if (linkError || !generatedLink.properties?.action_link) {
        console.error("Erro ao gerar handoff SSO:", {
          code: "SSO_LINK_GENERATION_FAILED",
          redirectTo,
          message: linkError?.message ?? "action_link ausente",
        });
        throw new SsoHandoffError(
          502,
          "SSO_LINK_GENERATION_FAILED",
          "Não foi possível preparar a troca segura de instituição.",
        );
      }

      if (
        !hasExpectedSsoRedirect(
          generatedLink.properties.action_link,
          redirectTo,
        )
      ) {
        console.error("O Supabase não aceitou o callback SSO configurado.", {
          code: "SSO_REDIRECT_NOT_ALLOWED",
          expectedOrigin: PLATFORM_ORIGIN,
          expectedPath: "/auth/confirm",
        });
        throw new SsoHandoffError(
          502,
          "SSO_REDIRECT_NOT_ALLOWED",
          "A troca de instituição ainda não está configurada para este ambiente.",
        );
      }

      return jsonSuccess(generatedLink.properties.action_link);
    } catch (error) {
      if (error instanceof SsoHandoffError) {
        return jsonError(error);
      }

      console.error("Erro interno no handoff SSO:", {
        code: "INTERNAL_ERROR",
      });
      return jsonError(
        new SsoHandoffError(
          500,
          "INTERNAL_ERROR",
          "Não foi possível preparar a troca segura de instituição.",
        ),
      );
    }
  },
);

export default {
  fetch: (
    request: Request,
    ...args: Parameters<typeof authenticatedFetch> extends [
      Request,
      ...infer Rest,
    ]
      ? Rest
      : never
  ) => {
    if (request.method === "OPTIONS") {
      return new Response("ok", {
        status: 200,
        headers: corsHeaders,
      });
    }

    return authenticatedFetch(request, ...args);
  },
};
