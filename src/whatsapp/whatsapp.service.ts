import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.module';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: AppConfig,
  ) {}

  /** Meta webhook verification handshake (GET /webhook). */
  verify(query: { 'hub.mode'?: string; 'hub.verify_token'?: string; 'hub.challenge'?: string }) {
    if (
      query['hub.mode'] === 'subscribe' &&
      query['hub.verify_token'] === this.config.whatsapp.verifyToken
    ) {
      return query['hub.challenge'];
    }
    return 'verification failed';
  }

  /** Inbound message from Meta. Stores raw event; MVP just logs + acknowledges. */
  async processIncoming(raw: unknown, eventId?: string): Promise<{ received: true }> {
    const id = eventId ?? crypto.randomUUID();
    try {
      await this.prisma.webhookEvent.create({
        data: {
          provider: 'whatsapp',
          eventId: id,
          eventType: 'message',
          raw: (raw ?? {}) as object,
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });
    } catch {
      // duplicate or storage error: still acknowledge to Meta (idempotent ack)
    }
    this.logger.debug('WhatsApp webhook received (MVP: logged, no auto-reply)');
    return { received: true };
  }

  /** Sends a WhatsApp message via a placeholder channel for the MVP. */
  async sendMessage(target: string, body: string): Promise<void> {
    await this.notifications.sendMessage(target, body);
  }
}