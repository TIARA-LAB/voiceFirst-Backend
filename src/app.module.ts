import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { validateEnv } from './config/env.validation';
import { AppConfigModule } from './config/app-config';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/services/audit.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BusinessesModule } from './businesses/businesses.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ConfirmationsModule } from './confirmations/confirmations.module';
import { DebtorsModule } from './debtors/debtors.module';
import { ReportsModule } from './reports/reports.module';
import { AudioModule } from './audio/audio.module';
import { StorageModule } from './storage/storage.module';
import { VoiceAiModule } from './voice-ai/voice-ai.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL_MS') ?? 60_000,
            limit: config.get<number>('THROTTLE_LIMIT') ?? 200,
          },
        ],
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') ?? 'localhost',
          port: config.get<number>('REDIS_PORT') ?? 6379,
          ...(config.get<string>('REDIS_PASSWORD')
            ? { password: config.get<string>('REDIS_PASSWORD') }
            : {}),
        },
      }),
    }),

    PrismaModule,
    AppConfigModule,
    CommonModule,
    AuthModule,
    UsersModule,
    BusinessesModule,
    ProductsModule,
    InventoryModule,
    TransactionsModule,
    ConfirmationsModule,
    DebtorsModule,
    ReportsModule,
    StorageModule,
    VoiceAiModule,
    AudioModule,
    JobsModule,
    NotificationsModule,
    WhatsAppModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}