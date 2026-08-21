import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { z } from "zod";

import type { Database } from "../_shared/database.types.ts";

const PLATFORM_ORIGIN = "https://tecescola.grupotec.dev.br";
const RESERVED_SUBDOMAINS = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "dashboard",
  "grupotec",
  "login",
  "platform",
  "tecescola",
  "www",
]);

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

function isValidInstitutionSubdomain(value: string): boolean {
  return (
    value.length >= 3 &&
    value.length <= 63 &&
    !RESERVED_SUBDOMAINS.has(value) &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

function getRedirectTarget(subdomain: string | null): {
  origin: string;
  returnPath: "/admin" | "/account";
} {
  if (!subdomain) {
    return {
      origin: PLATFORM_ORIGIN,
      returnPath: "/account",
    };
  }

  const normalized = subdomain.trim().toLowerCase();
  if (!isValidInstitutionSubdomain(normalized)) {
    throw new SsoHandoffError(
      409,
      "INSTITUTION_SUBDOMAIN_INVALID",
      "A instituição não possui um subdomínio válido para acesso.",
    );
  }

  return {
    origin: `https://${normalized}.grupotec.dev.br`,
    returnPath: "/admin",
  };
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
          .select("id, account_id, subdomain, active")
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

      const target = getRedirectTarget(institution.subdomain);
      const redirectTo = `${target.origin}/auth/confirm?handoff=sso&returnTo=${encodeURIComponent(target.returnPath)}`;
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
