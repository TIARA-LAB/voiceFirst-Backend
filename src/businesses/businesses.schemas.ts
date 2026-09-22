import { z } from 'zod';
import { BusinessCategory, BusinessOnboardingStatus } from '@prisma/client';

const categoryValues = [
  'provision_store',
  'foodstuff',
  'beverages',
  'supermarket',
  'cosmetics',
  'household_goods',
  'clothing',
  'electronics',
  'spare_parts',
  'other',
] as const;

const onboardingValues = ['not_started', 'in_progress', 'completed'] as const;

export const patchBusinessSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  category: z.enum(categoryValues).optional(),
  country: z.string().min(2).max(3).optional(),
  currency: z.string().min(3).max(3).optional(),
  timezone: z.string().min(1).optional(),
  preferredLanguage: z.string().min(2).max(8).optional(),
  dailySummaryTime: z.string().regex(/^\d{2}:\d{2}$/, 'Daily summary time must be HH:MM').optional(),
  onboardingStatus: z.enum(onboardingValues).optional(),
});
export type PatchBusinessInput = z.infer<typeof patchBusinessSchema>;

const CATEGORY_MAP: Record<string, BusinessCategory> = {
  provision_store: BusinessCategory.PROVISION_STORE,
  foodstuff: BusinessCategory.FOODSTUFF,
  beverages: BusinessCategory.BEVERAGES,
  supermarket: BusinessCategory.SUPERMARKET,
  cosmetics: BusinessCategory.COSMETICS,
  household_goods: BusinessCategory.HOUSEHOLD_GOODS,
  clothing: BusinessCategory.CLOTHING,
  electronics: BusinessCategory.ELECTRONICS,
  spare_parts: BusinessCategory.SPARE_PARTS,
  other: BusinessCategory.OTHER,
};

const ONBOARDING_MAP: Record<string, BusinessOnboardingStatus> = {
  not_started: BusinessOnboardingStatus.NOT_STARTED,
  in_progress: BusinessOnboardingStatus.IN_PROGRESS,
  completed: BusinessOnboardingStatus.COMPLETED,
};

export const businessMapper = {
  categoryToDb: (value: string): BusinessCategory => CATEGORY_MAP[value] ?? BusinessCategory.OTHER,
  categoryFromDb: (value: BusinessCategory): string =>
    Object.keys(CATEGORY_MAP).find((k) => CATEGORY_MAP[k] === value) ?? 'other',
  onboardingToDb: (value: string): BusinessOnboardingStatus =>
    ONBOARDING_MAP[value] ?? BusinessOnboardingStatus.NOT_STARTED,
  onboardingFromDb: (value: BusinessOnboardingStatus): string =>
    Object.keys(ONBOARDING_MAP).find((k) => ONBOARDING_MAP[k] === value) ?? 'not_started',
};