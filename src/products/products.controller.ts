import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Product } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { AuthUser, CurrentBusiness, CurrentUser } from '../common/decorators/current-user';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createProductSchema,
  idParamSchema,
  listProductsSchema,
  patchProductSchema,
  CreateProductInput,
  ListProductsInput,
  PatchProductInput,
} from './products.schemas';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(
    @CurrentBusiness() business: { id: string },
    @Query(new ZodValidationPipe(listProductsSchema)) query: ListProductsInput,
  ) {
    return this.productsService.list(business.id, query);
  }

  @Post()
  create(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createProductSchema)) body: CreateProductInput,
  ): Promise<Product> {
    return this.productsService.create(business.id, user.userId, body);
  }

  @Get(':id')
  get(@CurrentBusiness() business: { id: string }, @Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    return this.productsService.getById(business.id, id);
  }

  @Patch(':id')
  patch(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(patchProductSchema)) body: PatchProductInput,
  ): Promise<Product> {
    return this.productsService.update(business.id, user.userId, id, body);
  }

  @Post(':id/archive')
  archive(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
  ): Promise<Product> {
    return this.productsService.archive(business.id, user.userId, id);
  }
}