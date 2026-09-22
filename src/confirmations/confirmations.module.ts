import { Module } from '@nestjs/common';
import { ConfirmationsService } from './confirmations.service';
import { ConfirmationsController } from './confirmations.controller';
import { TransactionsModule } from '../transactions/transactions.module';
import { ProductsModule } from '../products/products.module';
import { VoiceAiModule } from '../voice-ai/voice-ai.module';

@Module({
  imports: [TransactionsModule, ProductsModule, VoiceAiModule],
  controllers: [ConfirmationsController],
  providers: [ConfirmationsService],
  exports: [ConfirmationsService],
})
export class ConfirmationsModule {}