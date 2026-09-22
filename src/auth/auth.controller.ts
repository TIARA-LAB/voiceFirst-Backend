import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  verifySchema,
  LoginInput,
  RegisterInput,
} from './auth.schemas';
import { AuthResult, AuthService } from './auth.service';
import { UserDto } from '../users/users.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ): Promise<{ userId: string; message: string }> {
    return this.authService.register(body);
  }

  @Post('verify')
  @HttpCode(200)
  verify(
    @Body(new ZodValidationPipe(verifySchema)) body: { code: string },
  ): Promise<AuthResult> {
    return this.authService.verify(body.code);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<AuthResult> {
    return this.authService.login(body);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: { refreshToken: string },
  ): Promise<AuthResult> {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  logout(
    @Body(new ZodValidationPipe(logoutSchema)) body: { refreshToken: string },
  ): Promise<{ loggedOut: boolean }> {
    return this.authService.logout(body.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.authService.me(user.userId);
  }
}