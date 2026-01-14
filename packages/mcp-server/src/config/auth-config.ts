import { config } from 'dotenv';

config();

export type SupportedDb = 'mysql';

export interface DbConfig {
  type: SupportedDb;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface AuthConfig {
  enabled: boolean;
  allowRegistration: boolean;
  jwtSecret: string;
  jwtExpiresIn: string;
  captchaTtlSeconds: number;
  captchaCooldownSeconds: number;
  captchaCooldownMaxRequests: number;
  passwordMinLength: number;
  requireLetterAndNumber: boolean;
  rateLimitMaxFailures: number;
  rateLimitLockMinutes: number;
  db: DbConfig;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[auth-config] Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadAuthConfig(): AuthConfig {
  const enabled = parseBoolean(process.env.AUTH_ENABLED, false);
  const dbType = (process.env.DB_TYPE || 'mysql').toLowerCase();

  if (enabled && dbType !== 'mysql') {
    throw new Error('[auth-config] 当前仅支持 MySQL， 请设置 DB_TYPE=mysql');
  }

  const db: DbConfig = enabled
    ? {
        type: 'mysql',
        host: requiredEnv('DB_HOST'),
        port: parseInt(process.env.DB_PORT || '3306'),
        user: requiredEnv('DB_USER'),
        password: requiredEnv('DB_PASS'),
        database: process.env.DB_NAME || 'prompt'
      }
    : {
        type: 'mysql',
        host: process.env.DB_HOST || '',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || '',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'prompt'
      };

  return {
    enabled,
    allowRegistration: parseBoolean(process.env.AUTH_ALLOW_REGISTRATION, true),
    jwtSecret: process.env.AUTH_JWT_SECRET || 'change-me',
    jwtExpiresIn: process.env.AUTH_JWT_EXPIRES_IN || '7d',
    captchaTtlSeconds: parseInt(process.env.AUTH_CAPTCHA_TTL_SECONDS || '300'),
    captchaCooldownSeconds: parseInt(process.env.AUTH_CAPTCHA_COOLDOWN_SECONDS || '5'),
    captchaCooldownMaxRequests: parseInt(process.env.AUTH_CAPTCHA_COOLDOWN_MAX_REQUESTS || '3'),
    passwordMinLength: parseInt(process.env.AUTH_PASSWORD_MIN_LENGTH || '8'),
    requireLetterAndNumber: parseBoolean(process.env.AUTH_PASSWORD_REQUIRE_ALNUM, true),
    rateLimitMaxFailures: parseInt(process.env.AUTH_RATE_LIMIT_MAX_FAILURES || '5'),
    rateLimitLockMinutes: parseInt(process.env.AUTH_RATE_LIMIT_LOCK_MINUTES || '10'),
    db
  };
}
