import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'placeholder_service_key';

// Note: Ensure your .env contains SUPABASE_URL and SUPABASE_SERVICE_KEY
export const supabase = createClient(supabaseUrl, supabaseServiceKey);
