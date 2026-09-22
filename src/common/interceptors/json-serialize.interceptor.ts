import { Injectable, CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Normalizes response serialization:
 *  - BigInt -> string (kobo amounts larger than JS safe-int)
 *  - Prisma.Decimal -> number (stock quantities)
 *  - strips undefined values and normalizes Date to ISO
 */
function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'object' && value !== null && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
    const asNumber = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(asNumber) ? asNumber : value;
  }
  return value;
}

@Injectable()
export class JsonSerializeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => (data === undefined ? data : JSON.parse(JSON.stringify(data, replacer)))),
    );
  }
}