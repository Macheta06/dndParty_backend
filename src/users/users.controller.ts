import {
  Body,
  Controller,
  Delete,
  Get,
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
    return this.userService.getUserById(Number(id));
  }

  @Post()
  async createUser(@Body() data: client.User) {
    return this.userService.createUser(data);
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.userService.deleteUser(Number(id));
  }

  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() data: client.User) {
    return this.userService.updateUser(Number(id), data);
  }
}
