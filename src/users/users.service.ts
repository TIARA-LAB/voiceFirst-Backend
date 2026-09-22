import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

export interface UserDto {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  status: User['status'];
  verifiedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  toUserDto(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      status: user.status,
      verifiedAt: user.verifiedAt,
      createdAt: user.createdAt,
    };
  }

  async findById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  async requireById(userId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async requestDeletion(userId: string): Promise<{ requested: boolean }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletionRequestedAt: new Date(), status: 'DISABLED' },
    });
    return { requested: true };
  }
}