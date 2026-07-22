import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from '../dto/update-user-dto';
import { CreateUserDto } from '../dto/create-user-dto';

@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Get(':id')
  async getUser(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.userService.getUserById(id);
    } catch {
      throw new NotFoundException('User not found');
    }
  }

  @Post()
  async createUser(@Body(ValidationPipe) CreateUserDto: CreateUserDto) {
    try {
      return await this.userService.createUser(CreateUserDto);
    } catch {
      throw new BadRequestException('Bad request, check user data');
    }
  }

  @Delete(':id')
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    const user = await this.userService.getUserById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  @Put(':id')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) UpdateUserDto: UpdateUserDto,
  ) {
    try {
      return await this.userService.updateUser(id, UpdateUserDto);
    } catch {
      throw new NotFoundException('User not found');
    }
  }
}
