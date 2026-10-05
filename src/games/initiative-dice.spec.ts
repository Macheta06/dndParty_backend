import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GamesService, InitiativeState } from './games.service';
import { PrismaService } from '../prisma/prisma.service';
import { GameGateway } from './games.gateway';
import { SetInitiativeDto } from './dto/initiative.dto';
import { RollCharacterDto } from './dto/roll.dto';
import { AttackDto } from './dto/attack.dto';

import type { Character, Game } from '@prisma/client';

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
  character: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
  },
};

const emitMock = jest.fn();
const mockGateway = {
  server: {
    to: jest.fn().mockReturnValue({ emit: emitMock }),
  },
};

// Fuerza 16 (+3) con competencia en Atletismo; nivel 1 => bono +2.
const aria = {
  id: 7,
  name: 'Aria',
  userId: 1,
  gameId: 'game-1',
  is_npc: false,
  strength: 16,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  level: 1,
  armor: 14,
  proficiencies: ['Atletismo'],
  equipment: [{ name: 'Espada larga', quantity: 1, slot: 'weapon-main' }],
} as unknown as Character;

const goblin = {
  id: 9,
  name: 'Goblin',
  userId: 1,
  gameId: 'game-1',
  is_npc: true,
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  level: 1,
  armor: 13,
  proficiencies: [],
  equipment: [],
} as unknown as Character;

/**
 * `findFirst` se llama una vez por personaje: el atacante y el objetivo
 * se distinguen por el id, así ningún test depende del orden de las llamadas.
 */
function dispatchCharacters(attacker: unknown, target: unknown): void {
  mockPrisma.character.findFirst.mockImplementation(
    (query: { where: { id: number } }) =>
      Promise.resolve(query.where.id === goblin.id ? target : attacker),
  );
}

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

  describe('rollCharacter', () => {
    const skillDto: RollCharacterDto = {
      gameId: 'game-1',
      characterId: 7,
      kind: 'skill',
      key: 'athletics',
    };

    beforeEach(() => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture);
      mockPrisma.character.findFirst.mockResolvedValue(aria);
    });

    it('resolves the modifier from the character itself', async () => {
      const event = await service.rollCharacter(
        'game-1',
        1,
        'dm@test.com',
        skillDto,
      );

      expect(event.label).toBe('Atletismo');
      expect(event.statModifier).toBe(3);
      expect(event.proficient).toBe(true);
      expect(event.proficiencyBonus).toBe(2);
      expect(event.modifier).toBe(5);
      expect(event.total).toBeGreaterThanOrEqual(6);
      expect(event.total).toBeLessThanOrEqual(25);
      expect(event.characterName).toBe('Aria');
    });

    it('does not grant proficiency on an untrained skill', async () => {
      const event = await service.rollCharacter('game-1', 1, 'dm@test.com', {
        ...skillDto,
        key: 'stealth',
      });

      expect(event.proficient).toBe(false);
      expect(event.modifier).toBe(0);
    });

    it('broadcasts the roll to the room', async () => {
      await service.rollCharacter('game-1', 1, 'dm@test.com', skillDto);

      expect(emitMock).toHaveBeenCalledWith(
        'characterRolled',
        expect.objectContaining({
          characterId: 7,
          characterName: 'Aria',
          userName: 'dm@test.com',
        }),
      );
    });

    it('rejects rolling another player character', async () => {
      // El dueño es el usuario 1; tira el 2 (y no es el DM).
      await expect(
        service.rollCharacter('game-1', 2, 'intruder@test.com', skillDto),
      ).rejects.toThrow(ForbiddenException);

      expect(emitMock).not.toHaveBeenCalled();
    });

    it('lets the dungeon master roll any character in the game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        ...gameFixture,
        masterId: 9,
      });
      mockPrisma.character.findFirst.mockResolvedValue({
        ...aria,
        userId: 1,
      });

      const event = await service.rollCharacter('game-1', 9, 'dm@test.com', {
        ...skillDto,
        kind: 'save',
        key: 'save:wisdom',
      });

      expect(event.label).toBe('Salvación de Sabiduría');
    });

    it('rejects a character that is not in the game', async () => {
      mockPrisma.character.findFirst.mockResolvedValue(null);

      await expect(
        service.rollCharacter('game-1', 1, 'dm@test.com', skillDto),
      ).rejects.toThrow('Personaje no encontrado en esta partida');
    });

    it('rejects a roll that does not exist', async () => {
      await expect(
        service.rollCharacter('game-1', 1, 'dm@test.com', {
          ...skillDto,
          key: 'fly',
        }),
      ).rejects.toThrow('No existe la tirada');
    });
  });

  describe('attack', () => {
    const attackDto: AttackDto = {
      gameId: 'game-1',
      attackerId: 7,
      targetId: 9,
    };

    beforeEach(() => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture);
      dispatchCharacters(aria, goblin);
    });

    it('resolves the attack against the target AC', async () => {
      const event = await service.attack('game-1', 1, 'dm@test.com', attackDto);

      expect(event.weapon).toBe('Espada larga');
      expect(event.modifier).toBe(5); // FUE +3 y competencia +2
      expect(event.targetAc).toBe(13);
      expect(event.attackerName).toBe('Aria');
      expect(event.targetName).toBe('Goblin');
      // Solo hay daño cuando hubo impacto.
      expect(event.damageTotal === undefined).toBe(!event.hit);
    });

    it('broadcasts the attack to the room', async () => {
      await service.attack('game-1', 1, 'dm@test.com', attackDto);

      expect(emitMock).toHaveBeenCalledWith(
        'attackResolved',
        expect.objectContaining({
          attackerId: 7,
          targetId: 9,
          targetName: 'Goblin',
        }),
      );
    });

    it('rejects attacking with someone else character', async () => {
      await expect(
        service.attack('game-1', 2, 'intruder@test.com', attackDto),
      ).rejects.toThrow(ForbiddenException);

      expect(emitMock).not.toHaveBeenCalled();
    });

    it('rejects a target that is not in the game', async () => {
      dispatchCharacters(aria, null);

      await expect(
        service.attack('game-1', 1, 'dm@test.com', attackDto),
      ).rejects.toThrow('Personaje no encontrado en esta partida');

      expect(emitMock).not.toHaveBeenCalled();
    });

    it('rejects when the attacker has no weapon equipped', async () => {
      dispatchCharacters({ ...aria, equipment: [] }, goblin);

      await expect(
        service.attack('game-1', 1, 'dm@test.com', attackDto),
      ).rejects.toThrow('no tiene arma equipada');

      expect(emitMock).not.toHaveBeenCalled();
    });
  });
});
