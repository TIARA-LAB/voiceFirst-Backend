import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodType, ZodTypeDef } from 'zod';

@Injectable()
export class ZodValidationPipe<I, O> implements PipeTransform<unknown, O> {
  constructor(private readonly schema: ZodType<O, ZodTypeDef, I>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): O {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: this.toErrors(result.error),
      });
    }
    return result.data;
  }

  private toErrors(error: ZodError): Array<{ path: string; message: string }> {
    return error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  }
}