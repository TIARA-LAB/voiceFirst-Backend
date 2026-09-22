import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { AuthUser, CurrentBusiness, CurrentUser } from '../common/decorators/current-user';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createTransactionSchema,
  listTransactionsSchema,
  CreateTransactionInput,
  ListTransactionsInput,
} from './transactions.schemas';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(createTransactionSchema)) body: CreateTransactionInput,
  ) {
    return this.transactionsService.create({
      businessId: business.id,
      userId: user.userId,
      body,
      idempotencyKey: idempotencyKey?.trim() || null,
    });
  }

  @Get()
  list(
    @CurrentBusiness() business: { id: string },
    @Query(new ZodValidationPipe(listTransactionsSchema)) query: ListTransactionsInput,
  ) {
    return this.transactionsService.list(business.id, query);
  }

  @Get(':id')
  get(@CurrentBusiness() business: { id: string }, @Param('id') id: string) {
    return this.transactionsService.getById(business.id, id);
  }

  @Post(':id/reverse')
  reverse(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.transactionsService.reverse(business.id, user.userId, id);
  }
}