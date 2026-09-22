import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  VERIFICATION_CODE_TTL_MINUTES: z.coerce.number().int().positive().default(15),

  CONFIRMATION_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  STORAGE_PROVIDER: z.enum(['local', 'supabase']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage/audio'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('audio'),
  AUDIO_MAX_SIZE_BYTES: z.coerce.number().int().positive().default(25_000_000),
  AUDIO_RETENTION_DAYS: z.coerce.number().int().positive().default(7),

  VOICE_AI_PROVIDER: z.enum(['mock', 'gemini']).default('mock'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),

  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),

  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(200),

  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * ConfigModule validation callback. Parses process.env (after .env has been loaded)
 * and fails fast with a readable error listing all invalid/missing variables.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${issues}`);
  }

  if (result.data.VOICE_AI_PROVIDER === 'gemini' && !result.data.GEMINI_API_KEY) {
    throw new Error('Invalid environment configuration:\n  - GEMINI_API_KEY is required when VOICE_AI_PROVIDER=gemini');
  }
  if (result.data.STORAGE_PROVIDER === 'supabase' && !result.data.SUPABASE_URL) {
    throw new Error('Invalid environment configuration:\n  - SUPABASE_URL is required when STORAGE_PROVIDER=supabase');
  }

  return result.data;
}