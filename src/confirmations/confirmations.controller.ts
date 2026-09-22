import { Body, Controller, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { AuthUser, CurrentBusiness, CurrentUser } from '../common/decorators/current-user';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { confirmDraftSchema, patchDraftSchema, PatchDraftInput } from './confirmations.schemas';
import { ConfirmationsService } from './confirmations.service';

@ApiTags('confirmations')
@Controller('confirmations')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class ConfirmationsController {
  constructor(private readonly confirmationsService: ConfirmationsService) {}

  @Get(':id')
  get(@CurrentBusiness() business: { id: string }, @Param('id') id: string) {
    return this.confirmationsService.get(business.id, id);
  }

  @Patch(':id')
  patch(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(patchDraftSchema)) body: PatchDraftInput,
  ) {
    return this.confirmationsService.edit(business.id, user.userId, id, body);
  }

  @Post(':id/confirm')
  confirm(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(confirmDraftSchema)) body: { idempotencyKey?: string },
  ) {
    return this.confirmationsService.confirm(
      business.id,
      user.userId,
      id,
      (body.idempotencyKey ?? idempotencyKey?.trim()) || undefined,
    );
  }

  @Post(':id/cancel')
  cancel(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.confirmationsService.cancel(business.id, user.userId, id);
  }
}