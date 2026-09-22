import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditInput {
  businessId: string;
  userId?: string;
  transactionId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
}

type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(client: DbClient, input: AuditInput): Promise<void> {
    await client.auditEvent.create({
      data: {
        businessId: input.businessId,
        userId: input.userId ?? null,
        transactionId: input.transactionId ?? null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        meta: input.meta ?? undefined,
      },
    });
  }
}

@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class CommonModule {}

export { Prisma };