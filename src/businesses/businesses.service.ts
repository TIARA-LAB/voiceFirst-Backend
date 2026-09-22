import { Injectable } from '@nestjs/common';
import { Business, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { businessMapper, PatchBusinessInput } from './businesses.schemas';

export interface BusinessDto {
  id: string;
  name: string;
  category: string;
  country: string;
  currency: string;
  timezone: string;
  preferredLanguage: string;
  dailySummaryTime: string;
  onboardingStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  toDto(business: Business): BusinessDto {
    return {
      id: business.id,
      name: business.name,
      category: businessMapper.categoryFromDb(business.category),
      country: business.country,
      currency: business.currency,
      timezone: business.timezone,
      preferredLanguage: business.preferredLanguage,
      dailySummaryTime: business.dailySummaryTime,
      onboardingStatus: businessMapper.onboardingFromDb(business.onboardingStatus),
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  }

  async getForUser(userId: string): Promise<BusinessDto | null> {
    const business = await this.prisma.business.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    });
    return business ? this.toDto(business) : null;
  }

  /** Creates the profile when missing, otherwise updates it (upsert). */
  async patch(userId: string, input: PatchBusinessInput): Promise<BusinessDto> {
    const existing = await this.prisma.business.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    });

    const data: Prisma.BusinessUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.category !== undefined) data.category = businessMapper.categoryToDb(input.category);
    if (input.country !== undefined) data.country = input.country;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.preferredLanguage !== undefined) data.preferredLanguage = input.preferredLanguage;
    if (input.dailySummaryTime !== undefined) data.dailySummaryTime = input.dailySummaryTime;
    if (input.onboardingStatus !== undefined) {
      data.onboardingStatus = businessMapper.onboardingToDb(input.onboardingStatus);
    }

    const business = existing
      ? await this.prisma.business.update({ where: { id: existing.id }, data })
      : await this.prisma.business.create({
          data: {
            ownerId: userId,
            name: input.name ?? 'My Business',
            category: input.category ? businessMapper.categoryToDb(input.category) : undefined,
            country: input.country,
            currency: input.currency,
            timezone: input.timezone,
            preferredLanguage: input.preferredLanguage,
            dailySummaryTime: input.dailySummaryTime,
            onboardingStatus: input.onboardingStatus
              ? businessMapper.onboardingToDb(input.onboardingStatus)
              : undefined,
          },
        });

    return this.toDto(business);
  }
}