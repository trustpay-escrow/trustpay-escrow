import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
}

export const env: Config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  supabaseUrl: process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || 'placeholder_service_key',
};

// Optionally validate required variables here
const requiredKeys: (keyof Config)[] = ['supabaseUrl', 'supabaseServiceKey'];
for (const key of requiredKeys) {
  const value = env[key];
  if (!value || (typeof value === 'string' && value.includes('placeholder'))) {
    console.warn(`[WARN] Environment variable for ${key} is using a placeholder or is missing!`);
  }
}
