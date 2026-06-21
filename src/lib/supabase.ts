import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '@/constants';

export const supabase = createClient(
  CONFIG.supabase.url,
  CONFIG.supabase.anonKey,
);
