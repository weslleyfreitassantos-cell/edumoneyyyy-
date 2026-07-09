import { createClient } from '@supabase/supabase-js';

// Valores fixos (seus dados do Supabase)
const supabaseUrl = 'https://jrdmrhsqqclnrouoednn.supabase.co';
const supabaseAnonKey = 'sb_publishable_8Zdx4hp5J6oyW_6j9dGOXQ_7vsQmbFp';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);