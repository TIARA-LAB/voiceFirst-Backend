import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { deletionRequestSchema } from './users.schemas';
import { UserDto, UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.usersService.requireById(user.userId).then((u) => this.usersService.toUserDto(u));
  }

  @Post('me/deletion-request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  requestDeletion(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(deletionRequestSchema)) _body: { reason?: string },
  ): Promise<{ requested: boolean }> {
    return this.usersService.requestDeletion(user.userId);
  }
}