import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { UsersService } from './users.service';
import * as client from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Get(':id')
  async getUser(@Param('id') id: string) {
    try {
      return await this.userService.getUserById(Number(id));
    } catch {
      throw new NotFoundException('User not found');
    }
  }

  @Post()
  async createUser(@Body() data: client.User) {
    try {
      return await this.userService.createUser(data);
    } catch {
      throw new BadRequestException('Bad request, check user data');
    }
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    try {
      return await this.userService.deleteUser(Number(id));
    } catch {
      throw new NotFoundException('User not found');
    }
  }

  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() data: client.User) {
    try {
      return await this.userService.updateUser(Number(id), data);
    } catch {
      throw new NotFoundException('User not found');
    }
  }
}
