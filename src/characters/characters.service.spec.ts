import { Test } from '@nestjs/testing';
import { CharactersService } from './characters.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCharacterDto } from './dto/create-character.dto';

const mockPrisma = {
  character: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

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
      const created = {
        id: 1,
        name: 'Aria',
        userId: 7,
        level: 1,
        exp: 0,
        proficiency: 2,
        inspiration: 0,
        temporary_hp: 0,
        is_npc: false,
        equipment: [],
        spells: [],
        proficiencies: [],
      };
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
          equipment: [],
          spells: [],
          proficiencies: [],
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
          equipment: [{ name: 'Espada larga', qty: 1 }],
          spells: ['Fire Bolt'],
          proficiencies: ['Stealth'],
        },
      });
    });
  });

  describe('getMyCharacters', () => {
    it('returns only the non-npc characters of the user', async () => {
      const characters = [
        { id: 1, name: 'Aria', is_npc: false },
        { id: 2, name: 'Luna', is_npc: false },
      ];
      mockPrisma.character.findMany.mockResolvedValue(characters);

      const result = await service.getMyCharacters(7);

      expect(result).toEqual(characters);
      expect(mockPrisma.character.findMany).toHaveBeenCalledWith({
        where: { userId: 7, is_npc: false },
        include: {
          game: { select: { id: true, name: true } },
        },
      });
    });
  });
});
