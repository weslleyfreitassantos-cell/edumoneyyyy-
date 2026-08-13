const PUBLIC_ROOT_DOMAIN = "grupotec.dev.br";
const PUBLIC_SUBDOMAIN_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function buildInviteRedirectUrl(
  appUrl: string,
  subdomain?: string | null,
): string {
  const normalizedSubdomain = subdomain?.trim().toLowerCase() ?? "";

  if (normalizedSubdomain) {
    if (!PUBLIC_SUBDOMAIN_PATTERN.test(normalizedSubdomain)) {
      throw new Error("Institution subdomain is invalid.");
    }

    return `https://${normalizedSubdomain}.${PUBLIC_ROOT_DOMAIN}/auth/confirm`;
  }

  return `${new URL(appUrl).origin}/auth/confirm`;
}
