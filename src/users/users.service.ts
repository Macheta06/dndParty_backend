import * as bcrypt from 'bcrypt';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { CreateUserDto } from '../dto/create-user-dto';
import { UpdateUserDto } from '../dto/update-user-dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getUserById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        id,
      },
    });
  }

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    return this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
      },
    });
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    let hashedPassword: string | undefined;
    if (updateUserDto.password) {
      hashedPassword = await bcrypt.hash(updateUserDto.password, 10);
    }
    return this.prisma.user.update({
      where: {
        id,
      },
      data: {
        ...updateUserDto,
        password: hashedPassword,
      },
    });
  }

  async deleteUser(id: number): Promise<User> {
    return this.prisma.user.update({
      where: {
        id,
      },
      data: {
        ...{ deleted: true },
      },
    });
  }
}
