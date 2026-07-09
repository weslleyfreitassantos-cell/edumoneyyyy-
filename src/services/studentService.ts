import { supabase } from '../lib/supabaseClient';
import { StudentFormData } from '../schemas/adminSchemas';

export const studentService = {
  async list(institutionId: string) {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        profiles:profile_id (
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async create(data: StudentFormData) {
    const { error } = await supabase.from('students').insert([data]);
    if (error) throw error;
  },

  async update(id: string, data: Partial<StudentFormData>) {
    const { error } = await supabase
      .from('students')
      .update(data)
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};