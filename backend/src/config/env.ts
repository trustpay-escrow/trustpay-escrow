import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  databaseUrl: string;
  directUrl: string;
  redisUrl: string;
  redisEnabled: boolean;
  stellarNetworkPassphrase: string;
  stellarServerSecret: string;
  stellarHomeDomain: string;
  jwtSecret: string;
  jwtExpiresIn: string;
}

export const env: Config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  supabaseUrl: process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || 'placeholder_service_key',
  databaseUrl: process.env.DATABASE_URL || '',
  directUrl: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  redisEnabled: process.env.REDIS_ENABLED === 'true' || Boolean(process.env.REDIS_URL),
  stellarNetworkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  stellarServerSecret: process.env.STELLAR_SERVER_SECRET || '',
  stellarHomeDomain: process.env.STELLAR_HOME_DOMAIN || 'localhost',
  jwtSecret: process.env.JWT_SECRET || 'trustpay_escrow_jwt_secret_dev_key_stellar_sep10',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};

// Optionally validate required variables here
const requiredKeys: (keyof Config)[] = ['supabaseUrl', 'supabaseServiceKey'];
for (const key of requiredKeys) {
  const value = env[key];
  if (!value || (typeof value === 'string' && value.includes('placeholder'))) {
    console.warn(`[WARN] Environment variable for ${key} is using a placeholder or is missing!`);
  }
}
