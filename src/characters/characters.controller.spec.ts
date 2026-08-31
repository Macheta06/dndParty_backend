import { Test } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { CharactersController } from './characters.controller';
import { CharactersService } from './characters.service';
import { AuthGuard } from '../auth/guard/auth/auth.guard';
import { JwtService } from '@nestjs/jwt';

const mockCharacter = {
  id: 1,
  name: 'Aria',
  class: 'Rogue',
  race: 'Half-Elf',
  level: 1,
  userId: 7,
  is_npc: false,
  gameId: null as string | null,
  deleted: false,
  game: null,
};

const mockService = {
  create: jest.fn(),
  getMyCharacters: jest.fn(),
  getById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const mockAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('CharactersController', () => {
  let controller: CharactersController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [CharactersController],
      providers: [
        { provide: CharactersService, useValue: mockService },
        { provide: AuthGuard, useValue: mockAuthGuard },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
      ],
    }).compile();
    controller = moduleRef.get(CharactersController);
  });

  describe('getCharacterById', () => {
    it('returns the character when owned by the user', async () => {
      mockService.getById.mockResolvedValue(mockCharacter);

      const result = await controller.getCharacterById(1, 7);

      expect(result).toEqual(mockCharacter);
      expect(mockService.getById).toHaveBeenCalledWith(1, 7);
    });

    it('propagates NotFoundException', async () => {
      mockService.getById.mockRejectedValue(new NotFoundException());

      await expect(controller.getCharacterById(999, 7)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates ForbiddenException', async () => {
      mockService.getById.mockRejectedValue(new ForbiddenException());

      await expect(controller.getCharacterById(1, 7)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateCharacter', () => {
    it('updates and returns the character', async () => {
      const updated = { ...mockCharacter, name: 'Aria Updated' };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.updateCharacter(
        1,
        { name: 'Aria Updated' },
        7,
      );

      expect(result).toEqual(updated);
    });

    it('propagates ForbiddenException', async () => {
      mockService.update.mockRejectedValue(new ForbiddenException());

      await expect(
        controller.updateCharacter(1, { name: 'Hacked' }, 7),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('softDeleteCharacter', () => {
    it('soft-deletes the character', async () => {
      const deleted = { ...mockCharacter, deleted: true };
      mockService.softDelete.mockResolvedValue(deleted);

      const result = await controller.softDeleteCharacter(1, 7);

      expect(result.deleted).toBe(true);
    });

    it('propagates ConflictException when character is in a game', async () => {
      mockService.softDelete.mockRejectedValue(new ConflictException());

      await expect(controller.softDeleteCharacter(1, 7)).rejects.toThrow(
        ConflictException,
      );
    });

    it('propagates ForbiddenException', async () => {
      mockService.softDelete.mockRejectedValue(new ForbiddenException());

      await expect(controller.softDeleteCharacter(1, 7)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
