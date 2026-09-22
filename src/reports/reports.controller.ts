import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentBusiness } from '../common/decorators/current-user';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ReportsService } from './reports.service';
import {
  dailySummaryQuerySchema,
  trendQuerySchema,
  profitLossQuerySchema,
  DailySummaryQuery,
  TrendQuery,
  ProfitLossQuery,
} from './reports.schemas';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  dashboard(@CurrentBusiness() business: { id: string }) {
    return this.reportsService.dashboard(business.id);
  }

  @Get('daily')
  daily(
    @CurrentBusiness() business: { id: string },
    @Query(new ZodValidationPipe(dailySummaryQuerySchema)) query: DailySummaryQuery,
  ) {
    const date = query.date ?? new Date().toISOString().slice(0, 10);
    return this.reportsService.computeDailySummary({ businessId: business.id, date });
  }

  @Get('trend')
  trend(
    @CurrentBusiness() business: { id: string },
    @Query(new ZodValidationPipe(trendQuerySchema)) query: TrendQuery,
  ) {
    return this.reportsService.trend(business.id, query.days);
  }

  @Get('profit-loss')
  profitLoss(
    @CurrentBusiness() business: { id: string },
    @Query(new ZodValidationPipe(profitLossQuerySchema)) query: ProfitLossQuery,
  ) {
    return this.reportsService.profitLoss(business.id, query.from, query.to);
  }
}