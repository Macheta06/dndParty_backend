import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCharacterDto } from './dto/create-character.dto';

@Injectable()
export class CharactersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, createCharacterDto: CreateCharacterDto) {
    return this.prisma.character.create({
      data: {
        ...createCharacterDto,
        userId,
        level: 1,
        exp: 0,
        proficiency: 2,
        inspiration: 0,
        temporary_hp: 0,
        is_npc: false,
        equipment: createCharacterDto.equipment ?? [],
        spells: createCharacterDto.spells ?? [],
        proficiencies: createCharacterDto.proficiencies ?? [],
      },
    });
  }

  async getMyCharacters(userId: number) {
    return this.prisma.character.findMany({
      where: {
        userId: userId,
        is_npc: false,
      },
      include: {
        game: {
          select: { id: true, name: true },
        },
      },
    });
  }
}
