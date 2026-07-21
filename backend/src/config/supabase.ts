import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import WebSocket from 'ws';

// Initialize the Supabase client using the centralized env config
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey, {
  // Pass ws for Node 20 lack of native WebSocket support in Supabase
  realtime: {
    transport: WebSocket as any,
  },
});
