import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/app-config';
import { NotificationsService } from '../notifications/notifications.module';
import { UsersService, UserDto } from '../users/users.service';
import { RefreshTokenService, TokenReset } from './refresh-token.service';
import { LoginInput, RegisterInput } from './auth.schemas';
import { minutesFromNow } from '../common/utils/date-time';
import { VERIFICATION_CODE_LENGTH } from '../common/constants';

function generateVerificationCode(): string {
  return Array.from({ length: VERIFICATION_CODE_LENGTH }, () =>
    Math.floor(Math.random() * 10),
  ).join('');
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfig,
    private readonly notifications: NotificationsService,
    private readonly usersService: UsersService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  async register(input: RegisterInput): Promise<{ userId: string; message: string }> {
    const identifier = input.phone ?? input.email;
    const passwordHash = await bcrypt.hash(input.password, 10);
    const verificationCode = generateVerificationCode();

    try {
      const user = await this.prisma.user.create({
        data: {
          phone: input.phone ?? null,
          email: input.email ?? null,
          fullName: input.fullName ?? null,
          passwordHash,
          status: 'PENDING_VERIFICATION',
          verificationCode,
          verificationCodeExpiresAt: minutesFromNow(this.config.verificationCodeTtlMinutes),
        },
      });

      await this.notifications.sendVerificationCode(identifier!, verificationCode);

      return { userId: user.id, message: 'Account created. Verify your account to continue.' };
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002') {
        throw new ConflictException('An account with that phone or email already exists');
      }
      throw err;
    }
  }

  async verify(code: string): Promise<AuthResult> {
    const user = await this.prisma.user.findFirst({
      where: {
        verificationCode: code,
        verificationCodeExpiresAt: { gt: new Date() },
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'ACTIVE',
        verifiedAt: new Date(),
        verificationCode: null,
        verificationCodeExpiresAt: null,
      },
    });

    return this.issueTokens(updated);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ phone: input.identifier }, { email: input.identifier }],
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        user.status === 'PENDING_VERIFICATION'
          ? 'Verify your account before logging in'
          : 'Account is disabled',
      );
    }
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    let tokenReset: TokenReset;
    try {
      tokenReset = await this.refreshTokens.validateAndRotate(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.requireById(tokenReset.userId);
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }
    return this.issueTokens(user, tokenReset.refreshToken);
  }

  async logout(refreshToken: string): Promise<{ loggedOut: boolean }> {
    await this.refreshTokens.revoke(refreshToken);
    return { loggedOut: true };
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.usersService.requireById(userId);
    return this.usersService.toUserDto(user);
  }

  private async issueTokens(user: User, existingRefreshToken?: string): Promise<AuthResult> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'access' },
      {
        secret: this.config.jwt.accessSecret,
        expiresIn: this.config.jwt.accessTtl as `${number}m`,
      },
    );
    const refreshToken = existingRefreshToken ?? (await this.refreshTokens.create(user.id));
    return { accessToken, refreshToken, user: this.usersService.toUserDto(user) };
  }
}