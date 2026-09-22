import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const QUEUE_AUDIO_PROCESSING = 'audio-processing';
export const QUEUE_CLEANUP = 'cleanup';
export const QUEUE_REPORTS = 'reports';
export const QUEUE_NOTIFICATIONS = 'notifications';
export const QUEUE_WHATSAPP = 'whatsapp';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService) {}

  get env(): string {
    return this.config.get<string>('NODE_ENV') ?? 'development';
  }

  get isProduction(): boolean {
    return this.env === 'production';
  }

  get port(): number {
    return this.config.get<number>('PORT') ?? 3000;
  }

  get databaseUrl(): string {
    return this.config.getOrThrow<string>('DATABASE_URL');
  }

  get redis(): RedisConfig {
    return {
      host: this.config.get<string>('REDIS_HOST') ?? 'localhost',
      port: this.config.get<number>('REDIS_PORT') ?? 6379,
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
    };
  }

  get jwt() {
    return {
      accessSecret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      accessTtl: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
      refreshSecret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      refreshTtlDays: this.config.get<number>('JWT_REFRESH_TTL_DAYS') ?? 30,
    };
  }

  get verificationCodeTtlMinutes(): number {
    return this.config.get<number>('VERIFICATION_CODE_TTL_MINUTES') ?? 15;
  }

  get confirmationTtlMinutes(): number {
    return this.config.get<number>('CONFIRMATION_TTL_MINUTES') ?? 30;
  }

  get storage() {
    return {
      provider: (this.config.get<string>('STORAGE_PROVIDER') ?? 'local') as 'local' | 'supabase',
      localDir: this.config.get<string>('STORAGE_LOCAL_DIR') ?? './storage/audio',
      supabaseUrl: this.config.get<string>('SUPABASE_URL'),
      supabaseServiceRoleKey: this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY'),
      supabaseBucket: this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'audio',
    };
  }

  get audio() {
    return {
      maxSizeBytes: this.config.get<number>('AUDIO_MAX_SIZE_BYTES') ?? 25_000_000,
      retentionDays: this.config.get<number>('AUDIO_RETENTION_DAYS') ?? 7,
    };
  }

  get voiceAi() {
    return {
      provider: (this.config.get<string>('VOICE_AI_PROVIDER') ?? 'mock') as 'mock' | 'gemini',
      geminiApiKey: this.config.get<string>('GEMINI_API_KEY'),
      geminiModel: this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash',
    };
  }

  get whatsapp() {
    return {
      verifyToken: this.config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN'),
      phoneNumberId: this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID'),
      accessToken: this.config.get<string>('WHATSAPP_ACCESS_TOKEN'),
    };
  }

  get throttle() {
    return {
      ttlMs: this.config.get<number>('THROTTLE_TTL_MS') ?? 60_000,
      limit: this.config.get<number>('THROTTLE_LIMIT') ?? 200,
    };
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}