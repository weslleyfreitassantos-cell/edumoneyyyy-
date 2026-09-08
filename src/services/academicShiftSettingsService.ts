import { supabase } from '../lib/supabaseClient';
import {
  getAcademicShiftLabel,
  normalizeAcademicShifts,
  toAcademicShift,
  type AcademicShift,
} from '../lib/academic/academicShifts';

interface ShiftSettingsRow {
  institution_id: string;
  enabled_shifts: string[] | null;
}

interface UsedShiftRow {
  shift: string | null;
}

async function listUsedShifts(
  institutionId: string,
): Promise<AcademicShift[]> {
  const [classesResult, slotsResult] = await Promise.all([
    supabase
      .from('classes')
      .select('shift')
      .eq('institution_id', institutionId)
      .eq('active', true),
    supabase
      .from('school_time_slots')
      .select('shift')
      .eq('institution_id', institutionId)
      .eq('active', true),
  ]);

  if (classesResult.error) throw classesResult.error;
  if (slotsResult.error) throw slotsResult.error;

  return normalizeAcademicShifts([
    ...((classesResult.data ?? []) as UsedShiftRow[]).map(
      (row) => row.shift,
    ),
    ...((slotsResult.data ?? []) as UsedShiftRow[]).map(
      (row) => row.shift,
    ),
  ], []);
}

export const academicShiftSettingsService = {
  async getEnabledShifts(
    institutionId: string,
  ): Promise<AcademicShift[]> {
    const { data, error } = await supabase
      .from('institution_shift_settings')
      .select('institution_id, enabled_shifts')
      .eq('institution_id', institutionId)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      return normalizeAcademicShifts(
        (data as ShiftSettingsRow).enabled_shifts,
      );
    }

    // Existing institutions may not have an explicit row yet. Infer their
    // current usage without rewriting data during the rollout.
    const inferredShifts = await listUsedShifts(institutionId);
    return inferredShifts.length > 0
      ? inferredShifts
      : ['MATUTINO'];
  },

  async saveEnabledShifts(
    institutionId: string,
    enabledShifts: readonly AcademicShift[],
  ): Promise<AcademicShift[]> {
    const normalized = normalizeAcademicShifts(
      enabledShifts,
      [],
    );

    if (normalized.length === 0) {
      throw new Error('Selecione pelo menos um turno para a escola.');
    }

    const usedShifts = await listUsedShifts(institutionId);
    const removedShift = usedShifts.find(
      (shift) => !normalized.includes(shift),
    );
    if (removedShift) {
      throw new Error(
        `O turno ${getAcademicShiftLabel(removedShift)} ainda está em uso por turmas ou horários cadastrados.`,
      );
    }

    const { data, error } = await supabase
      .from('institution_shift_settings')
      .upsert(
        {
          institution_id: institutionId,
          enabled_shifts: normalized,
        },
        { onConflict: 'institution_id' },
      )
      .select('institution_id, enabled_shifts')
      .single();

    if (error || !data) {
      throw error ?? new Error('Não foi possível salvar os turnos da escola.');
    }

    return normalizeAcademicShifts(
      (data as ShiftSettingsRow).enabled_shifts,
    );
  },

  async assertShiftEnabled(
    institutionId: string,
    shift: string | null | undefined,
  ): Promise<AcademicShift | null> {
    const normalized = toAcademicShift(shift);
    if (!shift?.trim()) return null;
    if (!normalized) {
      throw new Error('Selecione um turno válido para a turma.');
    }

    const enabledShifts = await this.getEnabledShifts(institutionId);
    if (!enabledShifts.includes(normalized)) {
      throw new Error(
        `O turno ${getAcademicShiftLabel(normalized)} não está habilitado na política acadêmica da escola.`,
      );
    }

    return normalized;
  },
};
