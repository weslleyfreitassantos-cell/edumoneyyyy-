import { supabase } from '../lib/supabaseClient';

export const ANNOUNCEMENT_AUDIENCES = [
  'ALL',
  'STUDENTS',
  'GUARDIANS',
] as const;

export type AnnouncementAudience =
  (typeof ANNOUNCEMENT_AUDIENCES)[number];

export interface InstitutionAnnouncement {
  id: string;
  institution_id: string;
  title: string;
  message: string;
  audience: AnnouncementAudience;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementInput {
  institution_id: string;
  title: string;
  message: string;
  audience: AnnouncementAudience;
  starts_at?: string;
  ends_at?: string | null;
  created_by: string;
}

function normalizeRow(row: unknown): InstitutionAnnouncement {
  return row as InstitutionAnnouncement;
}

function isCurrentlyVisible(announcement: InstitutionAnnouncement): boolean {
  const now = Date.now();
  const startsAt = Date.parse(announcement.starts_at);
  const endsAt = announcement.ends_at
    ? Date.parse(announcement.ends_at)
    : Number.POSITIVE_INFINITY;

  return (
    announcement.active &&
    (!Number.isFinite(startsAt) || startsAt <= now) &&
    (!Number.isFinite(endsAt) || endsAt >= now)
  );
}

function toIsoOrNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Informe uma data válida para o aviso.');
  }

  return parsed.toISOString();
}

function validateInput(input: AnnouncementInput): void {
  if (!input.institution_id || !input.created_by) {
    throw new Error('Instituição e autor são obrigatórios.');
  }

  if (input.title.trim().length < 3) {
    throw new Error('O título deve possuir pelo menos 3 caracteres.');
  }

  if (input.message.trim().length < 3) {
    throw new Error('A mensagem deve possuir pelo menos 3 caracteres.');
  }

  if (!ANNOUNCEMENT_AUDIENCES.includes(input.audience)) {
    throw new Error('Selecione um público válido para o aviso.');
  }
}

export const announcementService = {
  async listForAudience(
    institutionId: string,
    audience: Exclude<AnnouncementAudience, 'ALL'>,
  ): Promise<InstitutionAnnouncement[]> {
    const { data, error } = await supabase
      .from('institution_announcements')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('active', true)
      .in('audience', ['ALL', audience])
      .lte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: false });

    if (error) throw error;

    return (data ?? [])
      .map(normalizeRow)
      .filter(isCurrentlyVisible);
  },

  async listForStaff(
    institutionId: string,
  ): Promise<InstitutionAnnouncement[]> {
    const { data, error } = await supabase
      .from('institution_announcements')
      .select('*')
      .eq('institution_id', institutionId)
      .order('starts_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(normalizeRow);
  },

  async create(input: AnnouncementInput): Promise<InstitutionAnnouncement> {
    validateInput(input);

    const startsAt = toIsoOrNull(input.starts_at) ?? new Date().toISOString();
    const endsAt = toIsoOrNull(input.ends_at);

    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      throw new Error('A data final deve ser posterior ao início.');
    }

    const { data, error } = await supabase
      .from('institution_announcements')
      .insert({
        institution_id: input.institution_id,
        title: input.title.trim(),
        message: input.message.trim(),
        audience: input.audience,
        starts_at: startsAt,
        ends_at: endsAt ?? null,
        created_by: input.created_by,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('Não foi possível publicar o aviso.');
    }

    return normalizeRow(data);
  },

  async setActive(
    id: string,
    institutionId: string,
    active: boolean,
  ): Promise<void> {
    const { error } = await supabase
      .from('institution_announcements')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('institution_id', institutionId);

    if (error) throw error;
  },

  async remove(id: string, institutionId: string): Promise<void> {
    const { error } = await supabase
      .from('institution_announcements')
      .delete()
      .eq('id', id)
      .eq('institution_id', institutionId);

    if (error) throw error;
  },
};
