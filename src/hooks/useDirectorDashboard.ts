import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { dashboardService } from '../services/dashboardService';
import { useAuth } from '../contexts/AuthContext';

export function useDirectorDashboard() {
  const { profile } = useAuth();

  const getInstitutionId = async (): Promise<string | null> => {
    if (!profile) return null;
    const { data, error } = await supabase
      .from('memberships')
      .select('institution_id')
      .eq('profile_id', profile.id)
      .single();

    if (error) {
      console.error('Erro ao buscar institution_id:', error);
      return null;
    }
    return data?.institution_id || null;
  };

  return useQuery({
    queryKey: ['directorDashboard', profile?.id],
    queryFn: async () => {
      const institutionId = await getInstitutionId();
      if (!institutionId) {
        throw new Error('Usuário não vinculado a nenhuma instituição');
      }
      return dashboardService.getDirectorDashboardData(institutionId);
    },
    enabled: !!profile,
    staleTime: 1000 * 60 * 5,
  });
}
