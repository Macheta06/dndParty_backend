import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

import type { User } from '@prisma/client';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockUsersService = {
  createUser: jest.fn(),
  getUserByEmailWithPassword: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn(),
};

const userWithPassword: User = {
  id: 1,
  email: 'dm@test.com',
  password: '$2b$10$hashed-value',
  name: 'DM',
  deleted: null,
};

const safeUser = {
  id: 1,
  email: 'dm@test.com',
  name: 'DM',
  deleted: null,
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('creates the user and returns a success message', async () => {
      const dto: CreateUserDto = {
        name: 'DM',
        email: 'dm@test.com',
        password: 'secret123',
      };
      mockUsersService.createUser.mockResolvedValue(safeUser);

      const result = await service.register(dto);

      expect(result).toEqual({
        message: 'User created successfully',
        user: safeUser,
      });
      expect(mockUsersService.createUser).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    const dto: LoginDto = { email: 'dm@test.com', password: 'secret123' };

    it('throws UnauthorizedException when the user does not exist', async () => {
      mockUsersService.getUserByEmailWithPassword.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the password is invalid', async () => {
      mockUsersService.getUserByEmailWithPassword.mockResolvedValue(
        userWithPassword,
      );
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'secret123',
        userWithPassword.password,
      );
    });

    it('returns the user without password and a signed token', async () => {
      mockUsersService.getUserByEmailWithPassword.mockResolvedValue(
        userWithPassword,
      );
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('jwt-token');

      const result = await service.login(dto);

      expect(result.token).toBe('jwt-token');
      expect(result.message).toBe('Login successful');
      expect(result.user).not.toHaveProperty('password');
      expect(result.user.email).toBe('dm@test.com');
      expect(mockUsersService.getUserByEmailWithPassword).toHaveBeenCalledWith(
        dto.email,
      );
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: 1,
        email: 'dm@test.com',
      });
    });
  });
});
