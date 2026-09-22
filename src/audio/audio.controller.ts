import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentBusiness, CurrentUser, AuthUser } from '../common/decorators/current-user';
import { AppConfig } from '../config/app-config';
import { SUPPORTED_AUDIO_MIME_TYPES } from '../common/constants';
import { AudioService } from './audio.service';
import { AudioProcessingService } from './audio-processing.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';

const retrySchema = z.object({}).optional();

@ApiTags('audio')
@Controller('audio')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class AudioController {
  constructor(
    private readonly audioService: AudioService,
    private readonly audioProcessing: AudioProcessingService,
    private readonly config: AppConfig,
  ) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Missing file field named "file"');
    }
    if (!SUPPORTED_AUDIO_MIME_TYPES.includes(file.mimetype as never)) {
      throw new BadRequestException(`Unsupported audio type: "${file.mimetype}"`);
    }
    if (file.size > this.config.audio.maxSizeBytes) {
      throw new BadRequestException(
        `Audio too large (${file.size} bytes); max is ${this.config.audio.maxSizeBytes}`,
      );
    }

    const record = await this.audioService.upload(
      business.id,
      user.userId,
      {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
      idempotencyKey?.trim() || undefined,
    );

    if (record.status === 'STORED') {
      await this.audioProcessing.enqueueOrProcess(record.id).catch(() => undefined);
    }

    return {
      id: record.id,
      status: record.status,
      message: 'Audio uploaded. Poll GET /audio/:id for the confirmation draft.',
    };
  }

  @Get(':id')
  get(@CurrentBusiness() business: { id: string }, @Param('id') id: string) {
    return this.audioService.get(business.id, id);
  }

  @Post(':id/retry')
  async retry(
    @CurrentBusiness() business: { id: string },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(retrySchema)) _body: unknown,
  ) {
    const result = await this.audioService.retry(business.id, id);
    if (result.status === 'STORED') {
      await this.audioProcessing.enqueueOrProcess(id).catch(() => undefined);
    }
    return result;
  }
}