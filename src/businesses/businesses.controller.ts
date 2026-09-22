import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { OptionalBusiness } from '../common/decorators/optional-business';
import { AuthUser, CurrentUser } from '../common/decorators/current-user';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { patchBusinessSchema, PatchBusinessInput } from './businesses.schemas';
import { BusinessDto, BusinessesService } from './businesses.service';

@ApiTags('business')
@Controller('business')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  @OptionalBusiness()
  get(@CurrentUser() user: AuthUser): Promise<BusinessDto | null> {
    return this.businessesService.getForUser(user.userId);
  }

  @Patch()
  @OptionalBusiness()
  patch(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(patchBusinessSchema)) body: PatchBusinessInput,
  ): Promise<BusinessDto> {
    return this.businessesService.patch(user.userId, body);
  }
}