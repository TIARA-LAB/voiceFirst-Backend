import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/app-config';
import { daysFromNow } from '../common/utils/date-time';

export interface TokenReset {
  userId: string;
  refreshToken: string;
}

export class RefreshTokenInvalidError extends Error {
  constructor() {
    super('REFRESH_TOKEN_INVALID');
  }
}

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generate(): string {
    return randomBytes(48).toString('base64url');
  }

  async create(userId: string): Promise<string> {
    const token = this.generate();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        expiresAt: daysFromNow(this.config.jwt.refreshTtlDays),
      },
    });
    return token;
  }

  /** Validates a refresh token, rotates it, and returns the owning user + new token. */
  async validateAndRotate(token: string): Promise<TokenReset> {
    const existing = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: this.hashToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!existing) {
      throw new RefreshTokenInvalidError();
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const refreshToken = await this.create(existing.userId);
    return { userId: existing.userId, refreshToken };
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}