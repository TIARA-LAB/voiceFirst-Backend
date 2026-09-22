import { createParamDecorator, ExecutionContext, NotFoundException } from '@nestjs/common';
import { Business } from '@prisma/client';

export interface AuthUser {
  userId: string;
}

export interface BusinessContext {
  business: Business | null;
  businessId: string | null;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
  if (!request.user) {
    throw new NotFoundException('Authenticated user not found');
  }
  return request.user;
});

export const CurrentBusiness = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Business => {
    const request = ctx.switchToHttp().getRequest<BusinessContext>();
    if (!request.business) {
      throw new NotFoundException('Business profile not set up yet');
    }
    return request.business;
  },
);