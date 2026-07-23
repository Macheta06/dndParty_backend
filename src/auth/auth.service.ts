import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  register() {
    // Implement registration logic here
    return { message: 'User registered successfully' };
  }
  login() {
    // Implement login logic here
    return { message: 'Login successful' };
  }
}
