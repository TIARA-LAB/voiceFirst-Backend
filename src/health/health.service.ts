import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AppConfig } from '../config/app-config';

@Injectable()
export class HealthService {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    config: AppConfig,
  ) {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      lazyConnect: true,
      connectionName: 'health-check',
    });
  }

  async check() {
    let db = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }

    let redis = 'up';
    try {
      await this.redis.ping();
    } catch {
      redis = 'down';
    } finally {
      this.redis.disconnect();
    }

    return {
      status: db === 'up' && redis === 'up' ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: {
        database: db,
        redis,
        storageProvider: this.storage.getProviderName(),
      },
    };
  }
}