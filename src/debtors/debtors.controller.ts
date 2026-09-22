import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentBusiness } from '../common/decorators/current-user';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { DebtorsService } from './debtors.service';
import {
  createDebtorSchema,
  listDebtorsQuerySchema,
  updateDebtorSchema,
  CreateDebtorBody,
  UpdateDebtorBody,
  ListDebtorsQuery,
} from './debtors.schemas';

@ApiTags('debtors')
@Controller('debtors')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class DebtorsController {
  constructor(private readonly debtorsService: DebtorsService) {}

  @Get()
  list(
    @CurrentBusiness() business: { id: string },
    @Query(new ZodValidationPipe(listDebtorsQuerySchema)) query: ListDebtorsQuery,
  ) {
    return this.debtorsService.list(business.id, query);
  }

  @Get('stats')
  stats(@CurrentBusiness() business: { id: string }) {
    return this.debtorsService.stats(business.id);
  }

  @Post()
  create(
    @CurrentBusiness() business: { id: string },
    @Body(new ZodValidationPipe(createDebtorSchema)) body: CreateDebtorBody,
  ) {
    return this.debtorsService.create(business.id, body);
  }

  @Get(':id')
  get(@CurrentBusiness() business: { id: string }, @Param('id') id: string) {
    return this.debtorsService.get(business.id, id);
  }

  @Patch(':id')
  update(
    @CurrentBusiness() business: { id: string },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDebtorSchema)) body: UpdateDebtorBody,
  ) {
    return this.debtorsService.update(business.id, id, body);
  }

  @Post(':id/remind')
  remind(@CurrentBusiness() business: { id: string }, @Param('id') id: string) {
    return this.debtorsService.remind(business.id, id);
  }
}