import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GamesService } from './games.service';
import { PrismaService } from '../prisma/prisma.service';
import { GameGateway } from './games.gateway';
import { CreateGameDto } from './dto/create-game.dto';
import { CreateNpcDto } from './dto/create-npc.dto';
import { JoinGameDto } from './dto/join-game.dto';
import { UpdateHpDto } from './dto/dm-actions.dto';

import type { Character, Game, Note } from '@prisma/client';

type GameWithRelations = Game & {
  characters: Character[];
  notes: Note[];
};

function characterFixture(overrides: Partial<Character> = {}): Character {
  return {
    id: 1,
    is_npc: false,
    name: 'Aria',
    class: 'Rogue',
    level: 3,
    race: 'Half-Elf',
    background: 'Urchin',
    alignment: 'Chaotic Good',
    exp: 0,
    proficiency: 2,
    inspiration: 0,
    strength: 10,
    dexterity: 14,
    constitution: 12,
    intelligence: 10,
    wisdom: 12,
    charisma: 10,
    armor: 13,
    initiative: 2,
    speed: 30,
    max_hp: 30,
    current_hp: 20,
    temporary_hp: 0,
    hitDice: '1d8',
    gold_coins: 0,
    silver_coins: 0,
    copper_coins: 0,
    equipment: [],
    proficiencies: [],
    personality_traits: null,
    ideals: null,
    bonds: null,
    flaws: null,
    feature_traits: null,
    spells: [],
    age: null,
    height: null,
    skin: null,
    weight: null,
    hair: null,
    appearance_img: null,
    story: null,
    allies: null,
    userId: 2,
    gameId: null,
    deleted: false,
    ...overrides,
  };
}

const playerFixture = characterFixture({
  id: 1,
  is_npc: false,
  userId: 2,
  gameId: 'game-1',
});

const npcFixture = characterFixture({
  id: 2,
  is_npc: true,
  name: 'Goblin',
  class: 'Enemigo',
  race: 'Goblinoid',
  level: 1,
  max_hp: 7,
  current_hp: 5,
  userId: 1,
  gameId: 'game-1',
});

const noteFixture: Note = {
  id: 1,
  title: 'Secreto',
  description: 'Tesoro detrás de la puerta',
  is_public: false,
  gameId: 'game-1',
};

const gameFixture: Game = {
  id: 'game-1',
  name: 'La Cueva del Dragón',
  joinCode: 'ABC123',
  initiative: null,
  masterId: 1,
};

const gameWithRelations: GameWithRelations = {
  ...gameFixture,
  characters: [playerFixture, npcFixture],
  notes: [noteFixture],
};

const createdNpcFixture = characterFixture({
  id: 3,
  is_npc: true,
  name: 'Orco',
  class: 'Enemigo',
  race: 'Desconocido',
  level: 1,
  max_hp: 12,
  current_hp: 12,
  userId: 1,
  gameId: 'game-1',
});

const mockPrisma = {
  game: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  character: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  note: {
    create: jest.fn(),
  },
};

const emitMock = jest.fn();
const mockGateway = {
  server: {
    to: jest.fn().mockReturnValue({ emit: emitMock }),
  },
};

describe('GamesService', () => {
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

  describe('getGameById', () => {
    it('splits characters and npcs and includes notes for the master', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameWithRelations);

      const result = await service.getGameById('game-1', 1);

      expect(result.characters).toEqual([playerFixture]);
      expect(result.npcs).toEqual([npcFixture]);
      expect(result.notes).toEqual([noteFixture]);
      expect(mockPrisma.game.findUnique).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        include: { characters: true, notes: true },
      });
    });

    it('filters notes to public only when the caller is not the master', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameWithRelations);

      const result = await service.getGameById('game-1', 2);

      expect(result.notes).toEqual([]);
      expect(result.characters).toEqual([playerFixture]);
    });

    it('throws NotFoundException when the game does not exist', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);

      await expect(service.getGameById('game-1', 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createNpc', () => {
    const npcDtoFixture: CreateNpcDto = {
      name: 'Orco',
      max_hp: 12,
      current_hp: 12,
    };

    it('throws ForbiddenException when the caller is not the master', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        ...gameFixture,
        masterId: 99,
      });

      await expect(
        service.createNpc('game-1', 1, npcDtoFixture),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates an NPC with defaults and emits npcCreated to the room', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture);
      mockPrisma.character.create.mockResolvedValue(createdNpcFixture);

      const result = await service.createNpc('game-1', 1, npcDtoFixture);

      expect(result).toEqual(createdNpcFixture);
      expect(mockPrisma.character.create).toHaveBeenCalledWith({
        data: {
          name: 'Orco',
          class: 'Enemigo',
          race: 'Desconocido',
          background: 'NPC',
          alignment: 'Neutral',
          level: 1,
          exp: 0,
          proficiency: 2,
          inspiration: 0,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
          armor: 10,
          initiative: 0,
          speed: 30,
          max_hp: 12,
          current_hp: 12,
          temporary_hp: 0,
          hitDice: '1d8',
          equipment: [],
          proficiencies: [],
          spells: [],
          is_npc: true,
          userId: 1,
          gameId: 'game-1',
        },
      });
      expect(mockGateway.server.to).toHaveBeenCalledWith('game-1');
      expect(emitMock).toHaveBeenCalledWith('npcCreated', createdNpcFixture);
    });

    it('throws ConflictException on a P2002 duplicate name error', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture);
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`name`)',
        { code: 'P2002', clientVersion: 'test' },
      );
      mockPrisma.character.create.mockRejectedValue(p2002);

      await expect(
        service.createNpc('game-1', 1, npcDtoFixture),
      ).rejects.toThrow('Ya existe un personaje con ese nombre');
    });

    it('re-throws errors that are not P2002', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture);
      mockPrisma.character.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.createNpc('game-1', 1, npcDtoFixture),
      ).rejects.toThrow('db down');
    });
  });

  describe('joinGame', () => {
    const joinDtoFixture: JoinGameDto = { joinCode: 'ABC123', characterId: 1 };

    it('throws NotFoundException when the game code does not exist', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);

      await expect(service.joinGame(2, joinDtoFixture)).rejects.toThrow(
        'No existe ninguna partida con el código',
      );
    });

    it('throws NotFoundException when the character does not exist', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture);
      mockPrisma.character.findUnique.mockResolvedValue(null);

      await expect(service.joinGame(2, joinDtoFixture)).rejects.toThrow(
        'Personaje no encontrado',
      );
    });

    it('throws ConflictException when the character is already in the same game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture);
      mockPrisma.character.findUnique.mockResolvedValue(
        characterFixture({ gameId: 'game-1' }),
      );

      await expect(service.joinGame(2, joinDtoFixture)).rejects.toThrow(
        'Este personaje ya está en una partida',
      );
    });

    it('throws ConflictException when the character is in another game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture);
      mockPrisma.character.findUnique.mockResolvedValue(
        characterFixture({ gameId: 'other-game' }),
      );

      await expect(service.joinGame(2, joinDtoFixture)).rejects.toThrow(
        'Este personaje ya está jugando en otra sala',
      );
    });

    it('joins the character to the game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture);
      mockPrisma.character.findUnique.mockResolvedValue(
        characterFixture({ gameId: null }),
      );
      const updated = {
        id: 1,
        name: 'Aria',
        game: {
          id: 'game-1',
          name: 'La Cueva del Dragón',
          master: { name: 'DM' },
        },
      };
      mockPrisma.character.update.mockResolvedValue(updated);

      const result = await service.joinGame(2, joinDtoFixture);

      expect(result).toEqual(updated);
      expect(mockPrisma.character.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { gameId: 'game-1' },
        select: {
          id: true,
          name: true,
          game: {
            select: {
              id: true,
              name: true,
              master: { select: { name: true } },
            },
          },
        },
      });
    });
  });

  describe('leaveGame', () => {
    it('throws NotFoundException when the user has no character in the game', async () => {
      mockPrisma.character.findFirst.mockResolvedValue(null);

      await expect(service.leaveGame('game-1', 2)).rejects.toThrow(
        'No tienes ningún personaje en esta partida',
      );
    });

    it('sets gameId to null and emits playerLeft', async () => {
      const character = characterFixture({
        id: 1,
        userId: 2,
        gameId: 'game-1',
      });
      const updated = { ...character, gameId: null };
      mockPrisma.character.findFirst.mockResolvedValue(character);
      mockPrisma.character.update.mockResolvedValue(updated);

      const result = await service.leaveGame('game-1', 2);

      expect(result).toEqual(updated);
      expect(mockPrisma.character.findFirst).toHaveBeenCalledWith({
        where: { userId: 2, gameId: 'game-1' },
      });
      expect(mockPrisma.character.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { gameId: null },
      });
      expect(mockGateway.server.to).toHaveBeenCalledWith('game-1');
      expect(emitMock).toHaveBeenCalledWith('playerLeft', 1);
    });
  });

  describe('updateCharacterHp', () => {
    const hpDtoFixture: UpdateHpDto = { current_hp: 15 };

    it('throws ForbiddenException when the caller is not the master', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        ...gameFixture,
        masterId: 99,
      });

      await expect(
        service.updateCharacterHp('game-1', 1, 1, hpDtoFixture),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the character is not in the game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture);
      mockPrisma.character.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCharacterHp('game-1', 1, 1, hpDtoFixture),
      ).rejects.toThrow('El personaje no está en esta partida');
    });

    it('updates current_hp and emits hpUpdated', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture);
      const character = characterFixture({ id: 1, gameId: 'game-1' });
      const updated = { ...character, current_hp: 15 };
      mockPrisma.character.findFirst.mockResolvedValue(character);
      mockPrisma.character.update.mockResolvedValue(updated);

      const result = await service.updateCharacterHp(
        'game-1',
        1,
        1,
        hpDtoFixture,
      );

      expect(result).toEqual(updated);
      expect(mockPrisma.character.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { current_hp: 15 },
      });
      expect(mockGateway.server.to).toHaveBeenCalledWith('game-1');
      expect(emitMock).toHaveBeenCalledWith('hpUpdated', {
        characterId: 1,
        current_hp: 15,
      });
    });
  });

  describe('createGame', () => {
    it('creates a game with the master id and a generated join code', async () => {
      const dto: CreateGameDto = { name: 'Nueva Campaña' };
      mockPrisma.game.create.mockResolvedValue(gameFixture);

      const result = await service.createGame(7, dto);

      expect(result).toEqual(gameFixture);
      expect(result.joinCode).toMatch(/^[A-F0-9]{6}$/);
      const createCall = mockPrisma.game.create.mock.calls[0] as [
        { data: { name: string; masterId: number; joinCode: string } },
      ];
      expect(createCall[0].data.name).toBe('Nueva Campaña');
      expect(createCall[0].data.masterId).toBe(7);
      expect(createCall[0].data.joinCode).toMatch(/^[A-F0-9]{6}$/);
    });
  });

  describe('getGamesByMaster', () => {
    it('returns the games where the user is the master', async () => {
      mockPrisma.game.findMany.mockResolvedValue([gameFixture]);

      const result = await service.getGamesByMaster(7);

      expect(result).toEqual([gameFixture]);
      expect(mockPrisma.game.findMany).toHaveBeenCalledWith({
        where: { masterId: 7 },
      });
    });
  });
});
