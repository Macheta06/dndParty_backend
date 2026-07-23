import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async register(registerDto: RegisterDto) {
    return { message: await this.usersService.createUser(registerDto) };
  }

  login() {
    // Implement login logic here
    return { message: 'Login successful' };
  }
}
