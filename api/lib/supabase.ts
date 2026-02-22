import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://akvnrjuecudsitvkktnr.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_Aj1rAATULz0dVuysz4RToQ_YWWbAsIU';

export const supabase = createClient(supabaseUrl, supabaseKey);
