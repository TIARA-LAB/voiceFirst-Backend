import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessNotSetupError } from '../errors/domain-errors';
import { OPTIONAL_BUSINESS_KEY } from '../decorators/optional-business';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BusinessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { userId: string } | undefined;
    if (!user) {
      throw new UnauthorizedException();
    }

    const business = await this.prisma.business.findFirst({
      where: { ownerId: user.userId },
      orderBy: { createdAt: 'asc' },
    });

    const optional = this.reflector.get<boolean>(OPTIONAL_BUSINESS_KEY, context.getHandler()) ?? false;
    if (!business) {
      if (optional) {
        request.business = null;
        request.businessId = null;
        return true;
      }
      throw new BusinessNotSetupError();
    }

    request.business = business;
    request.businessId = business.id;
    return true;
  }
}