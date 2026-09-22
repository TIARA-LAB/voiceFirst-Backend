import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { AuthUser, CurrentBusiness, CurrentUser } from '../common/decorators/current-user';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { adjustmentSchema, movementsQuerySchema, AdjustmentInput } from './inventory.schemas';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@Controller('stock')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  snapshot(@CurrentBusiness() business: { id: string }) {
    return this.inventoryService.snapshot(business.id);
  }

  @Get(':productId/movements')
  movements(
    @CurrentBusiness() business: { id: string },
    @Param('productId') productId: string,
    @Query(new ZodValidationPipe(movementsQuerySchema)) query: { page: number; pageSize: number },
  ) {
    return this.inventoryService.movements(business.id, productId, query.page, query.pageSize);
  }

  @Post('adjustments')
  adjust(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(adjustmentSchema)) body: AdjustmentInput,
  ) {
    return this.inventoryService.adjust(business.id, user.userId, body.productId, body.delta, body.note ?? null);
  }
}