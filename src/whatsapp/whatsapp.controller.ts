import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';

@ApiExcludeController()
@Controller('whatsapp/webhook')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Get()
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string,
  ): unknown {
    return this.whatsappService.verify({ 'hub.mode': mode, 'hub.verify_token': verifyToken, 'hub.challenge': challenge });
  }

  @Post()
  inbound(@Body() body: unknown): Promise<{ received: true }> {
    const entry = Array.isArray((body as { entry?: Array<{ id: string | string[] }> })?.entry)
      ? (body as { entry: Array<{ id: string }> }).entry[0]?.id
      : undefined;
    return this.whatsappService.processIncoming(body, entry as string | undefined);
  }
}

@ApiExcludeController()
@Controller('whatsapp')
export class WhatsAppMessageController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Post('send')
  async send(@Body() body: { to: string; body: string }): Promise<{ sent: true }> {
    await this.whatsappService.sendMessage(body.to, body.body);
    return { sent: true };
  }
}