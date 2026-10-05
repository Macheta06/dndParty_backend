import { Test } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { CharactersService } from './characters.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';

const mockCharacter = {
  id: 1,
  name: 'Aria',
  class: 'Rogue',
  race: 'Half-Elf',
  level: 1,
  alignment: 'Chaotic Good',
  background: 'Urchin',
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
  current_hp: 30,
  temporary_hp: 0,
  hitDice: '1d8',
  gold_coins: 0,
  silver_coins: 0,
  copper_coins: 0,
  equipment: [],
  spells: [],
  proficiencies: [],
  userId: 7,
  is_npc: false,
  gameId: null as string | null,
  deleted: false,
  game: null,
};

const mockPrisma = {
  character: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  game: {
    findFirst: jest.fn(),
  },
};

/** Última llamada a `character.update`, tipada para evitar `any` en los tests. */
function lastUpdateCall<TData = Record<string, unknown>>(): {
  where: { id: number };
  data: TData;
} {
  const calls = mockPrisma.character.update.mock.calls as unknown as Array<
    [{ where: { id: number }; data: TData }]
  >;
  return calls[calls.length - 1][0];
}

describe('CharactersService', () => {
  let service: CharactersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CharactersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = moduleRef.get(CharactersService);
  });

  describe('create', () => {
    it('creates a character with default values for the user', async () => {
      const dto: CreateCharacterDto = {
        name: 'Aria',
        class: 'Rogue',
        race: 'Half-Elf',
        alignment: 'Chaotic Good',
        background: 'Urchin',
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
        current_hp: 30,
        hitDice: '1d8',
      };
      const created = { ...mockCharacter, userId: 7 };
      mockPrisma.character.create.mockResolvedValue(created);

      const result = await service.create(7, dto);

      expect(result).toEqual(created);
      expect(mockPrisma.character.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          userId: 7,
          level: 1,
          exp: 0,
          proficiency: 2,
          inspiration: 0,
          temporary_hp: 0,
          is_npc: false,
          gold_coins: 0,
          equipment: [],
          spells: [],
          proficiencies: [],
          feature_traits: [],
        },
      });
    });

    it('defaults equipment, spells and proficiencies to empty arrays', async () => {
      const dto: CreateCharacterDto = {
        name: 'Aria',
        class: 'Rogue',
        race: 'Half-Elf',
        alignment: 'Chaotic Good',
        background: 'Urchin',
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
        current_hp: 30,
        hitDice: '1d8',
        equipment: [{ name: 'Espada larga', qty: 1 }],
        spells: ['Fire Bolt'],
        proficiencies: ['Stealth'],
      };
      mockPrisma.character.create.mockResolvedValue({ id: 1 });

      await service.create(7, dto);

      expect(mockPrisma.character.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          userId: 7,
          level: 1,
          exp: 0,
          proficiency: 2,
          inspiration: 0,
          temporary_hp: 0,
          is_npc: false,
          gold_coins: 0,
          feature_traits: [],
        },
      });
    });
  });

  describe('getMyCharacters', () => {
    it('returns only the non-npc, non-deleted characters of the user', async () => {
      const characters = [
        { id: 1, name: 'Aria', is_npc: false },
        { id: 2, name: 'Luna', is_npc: false },
      ];
      mockPrisma.character.findMany.mockResolvedValue(characters);

      const result = await service.getMyCharacters(7);

      expect(result).toEqual(characters);
      expect(mockPrisma.character.findMany).toHaveBeenCalledWith({
        where: { userId: 7, is_npc: false, deleted: { not: true } },
        include: {
          game: { select: { id: true, name: true } },
        },
      });
    });
  });

  describe('getById', () => {
    it('returns the character when owned by the user', async () => {
      mockPrisma.character.findUnique.mockResolvedValue(mockCharacter);

      const result = await service.getById(1, 7);

      expect(result).toEqual(mockCharacter);
      expect(mockPrisma.character.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { game: { select: { id: true, name: true, masterId: true } } },
      });
    });

    it('returns the character when user is a participant (DM or player) in the game', async () => {
      const gameCharacter = {
        ...mockCharacter,
        userId: 99,
        gameId: 'game-1',
        game: { id: 'game-1', name: 'Partida Test', masterId: 7 },
      };
      mockPrisma.character.findUnique.mockResolvedValue(gameCharacter);
      mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1' });

      const result = await service.getById(1, 7);

      expect(result).toEqual(gameCharacter);
    });

    it('throws NotFoundException when character does not exist', async () => {
      mockPrisma.character.findUnique.mockResolvedValue(null);

      await expect(service.getById(999, 7)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when character is deleted', async () => {
      mockPrisma.character.findUnique.mockResolvedValue({
        ...mockCharacter,
        deleted: true,
      });

      await expect(service.getById(1, 7)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user does not own the character', async () => {
      mockPrisma.character.findUnique.mockResolvedValue({
        ...mockCharacter,
        userId: 99,
      });

      await expect(service.getById(1, 7)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('updates character fields when owned by the user', async () => {
      mockPrisma.character.findUnique.mockResolvedValue(mockCharacter);
      const updated = { ...mockCharacter, name: 'Aria Shadowblade' };
      mockPrisma.character.update.mockResolvedValue(updated);

      const dto: UpdateCharacterDto = { name: 'Aria Shadowblade' };
      const result = await service.update(1, 7, dto);

      expect(result).toEqual(updated);
      expect(mockPrisma.character.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Aria Shadowblade' },
      });
    });

    it('throws ForbiddenException when user does not own the character', async () => {
      mockPrisma.character.findUnique.mockResolvedValue({
        ...mockCharacter,
        userId: 99,
      });

      const dto: UpdateCharacterDto = { name: 'Hacked' };
      await expect(service.update(1, 7, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows updating character even when in an active game', async () => {
      mockPrisma.character.findUnique.mockResolvedValue({
        ...mockCharacter,
        gameId: 'some-game-id',
      });
      mockPrisma.character.update.mockResolvedValue({
        ...mockCharacter,
        gameId: 'some-game-id',
        name: 'Thorin el Fuerte',
      });

      const dto: UpdateCharacterDto = { name: 'Thorin el Fuerte' };
      const result = await service.update(1, 7, dto);
      expect(result.name).toBe('Thorin el Fuerte');
    });

    it('throws NotFoundException when character is deleted', async () => {
      mockPrisma.character.findUnique.mockResolvedValue({
        ...mockCharacter,
        deleted: true,
      });

      const dto: UpdateCharacterDto = { name: 'Ghost' };
      await expect(service.update(1, 7, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when character does not exist', async () => {
      mockPrisma.character.findUnique.mockResolvedValue(null);

      const dto: UpdateCharacterDto = { name: 'Nobody' };
      await expect(service.update(999, 7, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('recomputes AC when equipment changes', async () => {
      mockPrisma.character.findUnique.mockResolvedValue(mockCharacter);
      mockPrisma.character.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...mockCharacter, ...data }),
      );

      const equipment = [
        { name: 'Cota de mallas', quantity: 1, slot: 'armor' },
        { name: 'Escudo', quantity: 1, slot: 'shield' },
      ];
      const result = await service.update(1, 7, { equipment });

      expect(result.armor).toBe(18);
      const call = lastUpdateCall<{ armor: number; equipment: unknown }>();
      expect(call.where.id).toBe(1);
      expect(call.data.armor).toBe(18);
      expect(call.data.equipment).toEqual(equipment);
    });

    it('recomputes AC when a DEX stat changes', async () => {
      mockPrisma.character.findUnique.mockResolvedValue(mockCharacter);
      mockPrisma.character.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...mockCharacter, ...data }),
      );

      // Rogue con DES 14 sin armadura: 10 + 2 = 12
      const result = await service.update(1, 7, { dexterity: 14 });

      expect(result.armor).toBe(12);
    });

    it('leaves AC untouched when neither equipment nor AC stats change', async () => {
      mockPrisma.character.findUnique.mockResolvedValue(mockCharacter);
      mockPrisma.character.update.mockResolvedValue(mockCharacter);

      await service.update(1, 7, {
        name: 'Aria',
        personality_traits: 'Serena',
      });

      const call = lastUpdateCall();
      expect(call.data).not.toHaveProperty('armor');
    });
  });

  describe('softDelete', () => {
    it('sets deleted to true when character is owned and not in a game', async () => {
      mockPrisma.character.findUnique.mockResolvedValue(mockCharacter);
      mockPrisma.character.update.mockResolvedValue({
        ...mockCharacter,
        deleted: true,
      });

      const result = await service.softDelete(1, 7);

      expect(result.deleted).toBe(true);
      expect(mockPrisma.character.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deleted: true },
      });
    });

    it('throws ConflictException when character is in a game', async () => {
      mockPrisma.character.findUnique.mockResolvedValue({
        ...mockCharacter,
        gameId: 'some-game-id',
      });

      await expect(service.softDelete(1, 7)).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when user does not own the character', async () => {
      mockPrisma.character.findUnique.mockResolvedValue({
        ...mockCharacter,
        userId: 99,
      });

      await expect(service.softDelete(1, 7)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when character is already deleted', async () => {
      mockPrisma.character.findUnique.mockResolvedValue({
        ...mockCharacter,
        deleted: true,
      });

      await expect(service.softDelete(1, 7)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when character does not exist', async () => {
      mockPrisma.character.findUnique.mockResolvedValue(null);

      await expect(service.softDelete(999, 7)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
