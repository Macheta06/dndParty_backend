import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GamesService, InitiativeState } from './games.service';
import { PrismaService } from '../prisma/prisma.service';
import { GameGateway } from './games.gateway';
import { SetInitiativeDto } from './dto/initiative.dto';

import type { Game } from '@prisma/client';

const gameFixture: Game = {
  id: 'game-1',
  name: 'La Cueva del Dragón',
  joinCode: 'ABC123',
  masterId: 1,
  initiative: null,
};

const entriesDto: SetInitiativeDto = {
  entries: [
    { type: 'character', id: 1, name: 'Aria', score: 18 },
    { type: 'npc', id: 2, name: 'Goblin', score: 12 },
    { type: 'character', id: 3, name: 'Thorin', score: 15 },
  ],
};

const sortedState: InitiativeState = {
  entries: [
    { type: 'character', id: 1, name: 'Aria', score: 18 },
    { type: 'character', id: 3, name: 'Thorin', score: 15 },
    { type: 'npc', id: 2, name: 'Goblin', score: 12 },
  ],
  currentTurn: 0,
  round: 1,
};

const mockPrisma = {
  game: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const emitMock = jest.fn();
const mockGateway = {
  server: {
    to: jest.fn().mockReturnValue({ emit: emitMock }),
  },
};

describe('GamesService – Initiative & Dice', () => {
  let service: GamesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        GamesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GameGateway, useValue: mockGateway },
      ],
    }).compile();
    service = moduleRef.get(GamesService);
  });

  describe('setInitiative', () => {
    it('throws ForbiddenException if caller is not master', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        ...gameFixture,
        masterId: 99,
      });

      await expect(
        service.setInitiative('game-1', 1, entriesDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('sorts entries by score descending, sets round 1, emits initiativeUpdated', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture);
      mockPrisma.game.update.mockResolvedValue({});

      const result = await service.setInitiative('game-1', 1, entriesDto);

      expect(result).toEqual(sortedState);
      expect(result.entries[0].score).toBe(18);
      expect(result.entries[2].score).toBe(12);
      expect(result.currentTurn).toBe(0);
      expect(result.round).toBe(1);
      expect(mockPrisma.game.update).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: { initiative: expect.objectContaining({ round: 1 }) },
      });
      expect(mockGateway.server.to).toHaveBeenCalledWith('game-1');
      expect(emitMock).toHaveBeenCalledWith('initiativeUpdated', sortedState);
    });
  });

  describe('advanceTurn', () => {
    it('throws BadRequestException when no initiative is active', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        ...gameFixture,
        initiative: null,
      });

      await expect(service.advanceTurn('game-1', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('advances currentTurn and increments round when wrapping', async () => {
      const stateAtEnd: InitiativeState = {
        entries: sortedState.entries,
        currentTurn: 2,
        round: 3,
      };
      mockPrisma.game.findUnique.mockResolvedValue({
        ...gameFixture,
        initiative: stateAtEnd,
      });
      mockPrisma.game.update.mockResolvedValue({});

      const result = await service.advanceTurn('game-1', 1);

      expect(result.currentTurn).toBe(0);
      expect(result.round).toBe(4);
      expect(emitMock).toHaveBeenCalledWith('turnAdvanced', result);
    });

    it('advances currentTurn without wrapping mid-round', async () => {
      const stateMidRound: InitiativeState = {
        entries: sortedState.entries,
        currentTurn: 0,
        round: 1,
      };
      mockPrisma.game.findUnique.mockResolvedValue({
        ...gameFixture,
        initiative: stateMidRound,
      });
      mockPrisma.game.update.mockResolvedValue({});

      const result = await service.advanceTurn('game-1', 1);

      expect(result.currentTurn).toBe(1);
      expect(result.round).toBe(1);
    });
  });

  describe('clearInitiative', () => {
    it('sets initiative to DbNull and emits initiativeCleared', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture);
      mockPrisma.game.update.mockResolvedValue({});

      await service.clearInitiative('game-1', 1);

      expect(mockPrisma.game.update).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: { initiative: expect.anything() },
      });
      expect(emitMock).toHaveBeenCalledWith('initiativeCleared');
    });

    it('throws ForbiddenException if not master', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        ...gameFixture,
        masterId: 99,
      });

      await expect(service.clearInitiative('game-1', 1)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('rollDice', () => {
    it('parses a simple d20 formula and returns valid results', () => {
      const result = service.rollDice(1, 'dm@test.com', 'd20');

      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(20);
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(20);
      expect(result.formula).toBe('d20');
      expect(result.userId).toBe(1);
    });

    it('parses 2d6+3 and applies modifier', () => {
      const result = service.rollDice(2, 'player@test.com', '2d6+3');

      expect(result.rolls).toHaveLength(2);
      result.rolls.forEach((r) => {
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(6);
      });
      const rawSum = result.rolls.reduce((a, b) => a + b, 0);
      expect(result.total).toBe(rawSum + 3);
    });

    it('parses 1d8-2 with negative modifier', () => {
      const result = service.rollDice(1, 'player@test.com', '1d8-2');

      expect(result.rolls).toHaveLength(1);
      expect(result.total).toBe(result.rolls[0] - 2);
    });

    it('throws BadRequestException on invalid formula', () => {
      expect(() => service.rollDice(1, 'dm@test.com', 'not-a-dice')).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when count exceeds 100', () => {
      expect(() => service.rollDice(1, 'dm@test.com', '101d6')).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when sides exceed 1000', () => {
      expect(() => service.rollDice(1, 'dm@test.com', 'd1001')).toThrow(
        BadRequestException,
      );
    });
  });
});
