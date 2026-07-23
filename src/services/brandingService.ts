import { supabase } from '../lib/supabaseClient';
import {
  DEFAULT_BRAND_PRIMARY_COLOR,
  DEFAULT_BRAND_SECONDARY_COLOR,
  type AllowedBrandingMimeType,
  type BrandingAssetPathOptions,
  type BrandingImageKind,
  getStorageExtension,
  isValidBrandColor,
  isValidBrandingAssetPath,
  normalizeHostnameValue,
  sanitizeBrandColor,
  validateAccountDomainHostname,
  validateBrandingImageFile,
} from './brandingValidation';

export const BRANDING_BUCKET = 'institution-branding';

export type BrandingScope = 'GLOBAL' | 'ACCOUNT';
export type PublicBrandingScope = BrandingScope | 'FALLBACK';
export type AccountDomainStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';

export interface PublicBranding {
  scope: PublicBrandingScope;
  displayName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}

export interface BrandingRecord extends PublicBranding {
  id: string;
  scope: BrandingScope;
  accountId: string | null;
  logoPath: string | null;
  faviconPath: string | null;
}

export interface SaveBrandingInput {
  displayName: string | null;
  primaryColor: string;
  secondaryColor: string;
  logoFile?: File | null;
  faviconFile?: File | null;
  removeLogo?: boolean;
  removeFavicon?: boolean;
}

export interface AccountDomain {
  id: string;
  accountId: string;
  accountName: string | null;
  hostname: string;
  status: AccountDomainStatus;
  isPrimary: boolean;
  createdAt: string;
}

export interface UploadedBrandingAsset {
  path: string;
}

interface PublicBrandingRow {
  scope?: unknown;
  display_name?: unknown;
  logo_path?: unknown;
  favicon_path?: unknown;
  primary_color?: unknown;
  secondary_color?: unknown;
}

interface BrandingSettingsRow extends PublicBrandingRow {
  id?: unknown;
  scope_type?: unknown;
  account_id?: unknown;
  logo_path?: unknown;
  favicon_path?: unknown;
}

interface AccountDomainRow {
  id?: unknown;
  account_id?: unknown;
  hostname?: unknown;
  status?: unknown;
  is_primary?: unknown;
  created_at?: unknown;
  accounts?: { name?: unknown } | { name?: unknown }[] | null;
}

const brandingSelect = [
  'id',
  'scope_type',
  'account_id',
  'display_name',
  'logo_path',
  'favicon_path',
  'primary_color',
  'secondary_color',
].join(', ');

const domainSelect = [
  'id',
  'account_id',
  'hostname',
  'status',
  'is_primary',
  'created_at',
  'accounts(name)',
].join(', ');

export const FALLBACK_BRANDING: PublicBranding = {
  scope: 'FALLBACK',
  displayName: null,
  logoUrl: null,
  faviconUrl: null,
  primaryColor: DEFAULT_BRAND_PRIMARY_COLOR,
  secondaryColor: DEFAULT_BRAND_SECONDARY_COLOR,
};

export class BrandingServiceError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BrandingServiceError';
    this.code = code;
  }
}

function assertBrandingScope(value: unknown): BrandingScope {
  if (value === 'GLOBAL' || value === 'ACCOUNT') {
    return value;
  }

  throw new BrandingServiceError(
    'INVALID_BRANDING_SCOPE',
    'A identidade visual retornou com escopo invalido.',
  );
}

function normalizeDisplayName(value: string | null): string | null {
  const normalized = value?.trim() ?? '';

  return normalized.length > 0 ? normalized : null;
}

function assertColor(value: string, label: string): string {
  const normalized = value.trim().toLowerCase();

  if (!isValidBrandColor(normalized)) {
    throw new BrandingServiceError(
      'INVALID_BRAND_COLOR',
      `${label} deve estar em hexadecimal, como #005bbf.`,
    );
  }

  return normalized;
}

function buildVersionedPublicUrl(publicUrl: string): string {
  const separator = publicUrl.includes('?') ? '&' : '?';

  return `${publicUrl}${separator}v=${Date.now()}`;
}

function normalizeBrandingAssetPath(
  value: unknown,
  options: BrandingAssetPathOptions = {},
): string | null {
  return typeof value === 'string' &&
    isValidBrandingAssetPath(value, options)
    ? value
    : null;
}

function getPublicBrandingAssetUrl(
  path: string | null,
): string | null {
  if (!path) {
    return null;
  }

  const { data } = supabase.storage
    .from(BRANDING_BUCKET)
    .getPublicUrl(path);
  const publicUrl =
    typeof data?.publicUrl === 'string'
      ? data.publicUrl
      : null;

  return publicUrl
    ? buildVersionedPublicUrl(publicUrl)
    : null;
}

function normalizePublicBrandingRow(
  row: PublicBrandingRow | null | undefined,
): PublicBranding {
  const rawScope = row?.scope;
  const scope: PublicBrandingScope =
    rawScope === 'GLOBAL' ||
    rawScope === 'ACCOUNT' ||
    rawScope === 'FALLBACK'
      ? rawScope
      : 'FALLBACK';
  const logoPath = normalizeBrandingAssetPath(
    row?.logo_path,
    { kind: 'logo' },
  );
  const faviconPath = normalizeBrandingAssetPath(
    row?.favicon_path,
    { kind: 'favicon' },
  );

  return {
    scope,
    displayName:
      typeof row?.display_name === 'string'
        ? row.display_name
        : null,
    logoUrl: getPublicBrandingAssetUrl(logoPath),
    faviconUrl: getPublicBrandingAssetUrl(faviconPath),
    primaryColor: sanitizeBrandColor(
      typeof row?.primary_color === 'string'
        ? row.primary_color
        : null,
      DEFAULT_BRAND_PRIMARY_COLOR,
    ),
    secondaryColor: sanitizeBrandColor(
      typeof row?.secondary_color === 'string'
        ? row.secondary_color
        : null,
      DEFAULT_BRAND_SECONDARY_COLOR,
    ),
  };
}

function normalizeBrandingRecord(
  row: BrandingSettingsRow,
): BrandingRecord {
  if (typeof row.id !== 'string') {
    throw new BrandingServiceError(
      'INVALID_BRANDING_RESPONSE',
      'A identidade visual retornou sem identificador.',
    );
  }

  const scope = assertBrandingScope(row.scope_type);
  const accountId =
    typeof row.account_id === 'string'
      ? row.account_id
      : null;
  const logoPath = normalizeBrandingAssetPath(
    row.logo_path,
    {
      scope,
      accountId,
      kind: 'logo',
    },
  );
  const faviconPath = normalizeBrandingAssetPath(
    row.favicon_path,
    {
      scope,
      accountId,
      kind: 'favicon',
    },
  );

  return {
    ...normalizePublicBrandingRow({
      scope,
      display_name: row.display_name,
      logo_path: logoPath,
      favicon_path: faviconPath,
      primary_color: row.primary_color,
      secondary_color: row.secondary_color,
    }),
    id: row.id,
    scope,
    accountId,
    logoPath,
    faviconPath,
  };
}

function normalizeDomainStatus(value: unknown): AccountDomainStatus {
  if (
    value === 'PENDING' ||
    value === 'ACTIVE' ||
    value === 'DISABLED'
  ) {
    return value;
  }

  return 'PENDING';
}

function normalizeAccountName(
  accounts: AccountDomainRow['accounts'],
): string | null {
  const account = Array.isArray(accounts)
    ? accounts[0]
    : accounts;

  return typeof account?.name === 'string'
    ? account.name
    : null;
}

function normalizeAccountDomain(row: AccountDomainRow): AccountDomain {
  if (
    typeof row.id !== 'string' ||
    typeof row.account_id !== 'string' ||
    typeof row.hostname !== 'string'
  ) {
    throw new BrandingServiceError(
      'INVALID_DOMAIN_RESPONSE',
      'O dominio retornou em formato invalido.',
    );
  }

  return {
    id: row.id,
    accountId: row.account_id,
    accountName: normalizeAccountName(row.accounts),
    hostname: row.hostname,
    status: normalizeDomainStatus(row.status),
    isPrimary: row.is_primary === true,
    createdAt:
      typeof row.created_at === 'string'
        ? row.created_at
        : '',
  };
}

function randomAssetId(): string {
  const cryptoSource = globalThis.crypto;

  if (typeof cryptoSource?.randomUUID === 'function') {
    return cryptoSource.randomUUID();
  }

  if (typeof cryptoSource?.getRandomValues !== 'function') {
    throw new BrandingServiceError(
      'CRYPTO_UNAVAILABLE',
      'Nao foi possivel gerar um identificador seguro para o arquivo.',
    );
  }

  const bytes = cryptoSource.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  );

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

function getAssetPath({
  scope,
  accountId,
  kind,
  extension,
}: {
  scope: BrandingScope;
  accountId: string | null;
  kind: BrandingImageKind;
  extension: string;
}): string {
  const fileName = `${randomAssetId()}.${extension}`;

  if (scope === 'GLOBAL') {
    return `branding/global/${kind}/${fileName}`;
  }

  if (!accountId) {
    throw new BrandingServiceError(
      'ACCOUNT_REQUIRED',
      'Informe a conta para salvar a identidade visual.',
    );
  }

  return `branding/accounts/${accountId}/${kind}/${fileName}`;
}

async function removeStoragePath(path: string | null): Promise<void> {
  if (!path) {
    return;
  }

  try {
    await supabase.storage
      .from(BRANDING_BUCKET)
      .remove([path]);
  } catch {
    // Old file cleanup is best-effort after the database is already safe.
  }
}

async function removeUploadedAssets(
  assets: UploadedBrandingAsset[],
): Promise<void> {
  await Promise.all(
    assets.map((asset) => removeStoragePath(asset.path)),
  );
}

async function getBrandingRecord(
  scope: BrandingScope,
  accountId: string | null,
): Promise<BrandingRecord | null> {
  let query = supabase
    .from('branding_settings')
    .select(brandingSelect)
    .eq('scope_type', scope);

  query =
    scope === 'GLOBAL'
      ? query.is('account_id', null)
      : query.eq('account_id', accountId);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? normalizeBrandingRecord(data as BrandingSettingsRow)
    : null;
}

async function persistBrandingRecord({
  current,
  scope,
  accountId,
  input,
  logo,
  favicon,
}: {
  current: BrandingRecord | null;
  scope: BrandingScope;
  accountId: string | null;
  input: SaveBrandingInput;
  logo: {
    path: string | null;
  };
  favicon: {
    path: string | null;
  };
}): Promise<BrandingRecord> {
  const payload = {
    scope_type: scope,
    account_id: scope === 'GLOBAL' ? null : accountId,
    display_name: normalizeDisplayName(input.displayName),
    logo_path: logo.path,
    favicon_path: favicon.path,
    primary_color: assertColor(input.primaryColor, 'Cor principal'),
    secondary_color: assertColor(input.secondaryColor, 'Cor secundaria'),
  };

  const mutation = current
    ? supabase
        .from('branding_settings')
        .update(payload)
        .eq('id', current.id)
    : supabase.from('branding_settings').insert(payload);

  const { data, error } = await mutation
    .select(brandingSelect)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new BrandingServiceError(
      current
        ? 'BRANDING_UPDATE_EMPTY'
        : 'BRANDING_INSERT_EMPTY',
      current
        ? 'Nenhum registro foi atualizado. Verifique suas permissoes.'
        : 'A identidade visual nao foi criada. Verifique suas permissoes.',
    );
  }

  return normalizeBrandingRecord(data as BrandingSettingsRow);
}

async function saveBranding(
  scope: BrandingScope,
  accountId: string | null,
  input: SaveBrandingInput,
): Promise<BrandingRecord> {
  const current = await getBrandingRecord(scope, accountId);
  const uploadedAssets: UploadedBrandingAsset[] = [];

  let logo = {
    path: input.removeLogo ? null : current?.logoPath ?? null,
  };
  let favicon = {
    path: input.removeFavicon
      ? null
      : current?.faviconPath ?? null,
  };

  try {
    if (input.logoFile) {
      const uploadedLogo = await brandingService.uploadLogo({
        scope,
        accountId,
        file: input.logoFile,
      });

      uploadedAssets.push(uploadedLogo);
      logo = {
        path: uploadedLogo.path,
      };
    }

    if (input.faviconFile) {
      const uploadedFavicon =
        await brandingService.uploadFavicon({
          scope,
          accountId,
          file: input.faviconFile,
        });

      uploadedAssets.push(uploadedFavicon);
      favicon = {
        path: uploadedFavicon.path,
      };
    }

    const saved = await persistBrandingRecord({
      current,
      scope,
      accountId,
      input,
      logo,
      favicon,
    });

    if (
      (input.logoFile || input.removeLogo) &&
      current?.logoPath &&
      current.logoPath !== saved.logoPath
    ) {
      await removeStoragePath(current.logoPath);
    }

    if (
      (input.faviconFile || input.removeFavicon) &&
      current?.faviconPath &&
      current.faviconPath !== saved.faviconPath
    ) {
      await removeStoragePath(current.faviconPath);
    }

    return saved;
  } catch (error) {
    await removeUploadedAssets(uploadedAssets);
    throw error;
  }
}

async function uploadBrandingAsset({
  scope,
  accountId,
  kind,
  file,
}: {
  scope: BrandingScope;
  accountId: string | null;
  kind: BrandingImageKind;
  file: File;
}): Promise<UploadedBrandingAsset> {
  const validationError = await validateBrandingImageFile(file, kind);

  if (validationError) {
    throw new BrandingServiceError(
      'INVALID_BRANDING_FILE',
      validationError,
    );
  }

  const mimeType = file.type as AllowedBrandingMimeType;
  const path = getAssetPath({
    scope,
    accountId,
    kind,
    extension: getStorageExtension(mimeType),
  });
  const storage = supabase.storage.from(BRANDING_BUCKET);

  const { error: uploadError } = await storage.upload(path, file, {
    cacheControl: '3600',
    contentType: mimeType,
    upsert: false,
  });

  if (uploadError) {
    throw uploadError;
  }

  return {
    path,
  };
}

export const brandingService = {
  async resolveForHostname(hostname: string): Promise<PublicBranding> {
    const normalizedHostname = normalizeHostnameValue(hostname);

    try {
      const { data, error } = await supabase.rpc(
        'resolve_public_branding',
        {
          hostname: normalizedHostname,
        },
      );

      if (error) {
        return FALLBACK_BRANDING;
      }

      const row = Array.isArray(data) ? data[0] : data;

      return normalizePublicBrandingRow(row as PublicBrandingRow);
    } catch {
      return FALLBACK_BRANDING;
    }
  },

  getGlobalBranding(): Promise<BrandingRecord | null> {
    return getBrandingRecord('GLOBAL', null);
  },

  getAccountBranding(
    accountId: string,
  ): Promise<BrandingRecord | null> {
    return getBrandingRecord('ACCOUNT', accountId);
  },

  saveGlobalBranding(
    input: SaveBrandingInput,
  ): Promise<BrandingRecord> {
    return saveBranding('GLOBAL', null, input);
  },

  saveAccountBranding(
    accountId: string,
    input: SaveBrandingInput,
  ): Promise<BrandingRecord> {
    return saveBranding('ACCOUNT', accountId, input);
  },

  async requestAccountDomain(
    accountId: string,
    hostnameInput: string,
  ): Promise<AccountDomain> {
    const validation =
      validateAccountDomainHostname(hostnameInput);

    if (validation.error || !validation.hostname) {
      throw new BrandingServiceError(
        'INVALID_HOSTNAME',
        validation.error ?? 'Informe um hostname valido.',
      );
    }

    const { data, error } = await supabase
      .from('account_domains')
      .insert({
        account_id: accountId,
        hostname: validation.hostname,
        status: 'PENDING',
        is_primary: false,
      })
      .select(domainSelect)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new BrandingServiceError(
        'DOMAIN_INSERT_EMPTY',
        'O dominio nao foi solicitado. Verifique suas permissoes.',
      );
    }

    return normalizeAccountDomain(data as AccountDomainRow);
  },

  async listAccountDomains(
    accountId: string,
  ): Promise<AccountDomain[]> {
    const { data, error } = await supabase
      .from('account_domains')
      .select(domainSelect)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ((data ?? []) as AccountDomainRow[]).map(
      normalizeAccountDomain,
    );
  },

  async listPendingDomains(): Promise<AccountDomain[]> {
    const { data, error } = await supabase
      .from('account_domains')
      .select(domainSelect)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ((data ?? []) as AccountDomainRow[]).map(
      normalizeAccountDomain,
    );
  },

  async activateDomain(domainId: string): Promise<AccountDomain> {
    const { data, error } = await supabase
      .from('account_domains')
      .update({
        status: 'ACTIVE',
      })
      .eq('id', domainId)
      .select(domainSelect)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new BrandingServiceError(
        'DOMAIN_UPDATE_EMPTY',
        'Nenhum dominio foi ativado. Verifique suas permissoes.',
      );
    }

    return normalizeAccountDomain(data as AccountDomainRow);
  },

  async disableDomain(domainId: string): Promise<AccountDomain> {
    const { data, error } = await supabase
      .from('account_domains')
      .update({
        status: 'DISABLED',
      })
      .eq('id', domainId)
      .select(domainSelect)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new BrandingServiceError(
        'DOMAIN_UPDATE_EMPTY',
        'Nenhum dominio foi desativado. Verifique suas permissoes.',
      );
    }

    return normalizeAccountDomain(data as AccountDomainRow);
  },

  uploadLogo(input: {
    scope: BrandingScope;
    accountId: string | null;
    file: File;
  }): Promise<UploadedBrandingAsset> {
    return uploadBrandingAsset({
      ...input,
      kind: 'logo',
    });
  },

  uploadFavicon(input: {
    scope: BrandingScope;
    accountId: string | null;
    file: File;
  }): Promise<UploadedBrandingAsset> {
    return uploadBrandingAsset({
      ...input,
      kind: 'favicon',
    });
  },

  removeLogo(path: string | null): Promise<void> {
    return removeStoragePath(path);
  },

  removeFavicon(path: string | null): Promise<void> {
    return removeStoragePath(path);
  },
};
