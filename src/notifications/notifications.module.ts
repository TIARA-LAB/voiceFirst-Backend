import { Injectable, Logger, Module } from '@nestjs/common';

/**
 * Delivery-agnostic notification channel. The MVP logs codes/messages; real
 * SMS/email/WhatsApp adapters plug in behind this interface later.
 */
export abstract class NotificationsChannel {
  abstract sendVerificationCode(target: string, code: string): Promise<void>;
  abstract sendMessage(target: string, body: string): Promise<void>;
}

@Injectable()
export class ConsoleNotificationsChannel implements NotificationsChannel {
  private readonly logger = new Logger('Notifications');

  async sendVerificationCode(target: string, code: string): Promise<void> {
    this.logger.log(`Verification code for ${target}: ${code}`);
  }

  async sendMessage(target: string, body: string): Promise<void> {
    this.logger.log(`Message to ${target}: ${body}`);
  }
}

@Injectable()
export class NotificationsService {
  constructor(private readonly channel: NotificationsChannel) {}

  sendVerificationCode(target: string, code: string): Promise<void> {
    return this.channel.sendVerificationCode(target, code);
  }

  sendMessage(target: string, body: string): Promise<void> {
    return this.channel.sendMessage(target, body);
  }
}

@Module({
  providers: [NotificationsService, { provide: NotificationsChannel, useClass: ConsoleNotificationsChannel }],
  exports: [NotificationsService],
})
export class NotificationsModule {}