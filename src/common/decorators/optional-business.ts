import { SetMetadata } from '@nestjs/common';

export const OPTIONAL_BUSINESS_KEY = 'optional_business';

/**
 * Marks an endpoint as callable when the authenticated user has no business yet
 * (used by the business profile endpoints).
 */
export const OptionalBusiness = () => SetMetadata(OPTIONAL_BUSINESS_KEY, true);