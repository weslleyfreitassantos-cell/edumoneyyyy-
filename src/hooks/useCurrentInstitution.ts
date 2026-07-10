import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabaseClient';

export function useCurrentInstitution(
  profileId: string | undefined,
) {
  return useQuery({
    queryKey: [
      'current-institution',
      profileId,
    ],

    queryFn: async (): Promise<string> => {
      if (!profileId) {
        throw new Error(
          'Perfil não informado.',
        );
      }

      const { data, error } = await supabase
        .from('memberships')
        .select('institution_id')
        .eq('profile_id', profileId)
        .eq('active', true)
        .limit(2);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error(
          'Nenhum vínculo institucional ativo foi encontrado.',
        );
      }

      if (data.length > 1) {
        throw new Error(
          'Este usuário possui mais de uma instituição. A seleção de instituição ainda precisa ser configurada.',
        );
      }

      const institutionId =
        data[0]?.institution_id;

      if (
        typeof institutionId !== 'string' ||
        institutionId.length === 0
      ) {
        throw new Error(
          'O vínculo institucional é inválido.',
        );
      }

      return institutionId;
    },

    enabled: Boolean(profileId),
    staleTime: 1000 * 60 * 10,
  });
}