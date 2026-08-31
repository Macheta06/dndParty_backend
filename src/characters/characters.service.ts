import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';

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
        deleted: { not: true },
      },
      include: {
        game: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async getById(id: number, userId: number) {
    const character = await this.prisma.character.findUnique({
      where: { id },
      include: {
        game: {
          select: { id: true, name: true },
        },
      },
    });

    if (!character) {
      throw new NotFoundException(`Character with id ${id} not found`);
    }

    if (character.deleted) {
      throw new NotFoundException(`Character with id ${id} not found`);
    }

    if (character.userId !== userId) {
      throw new ForbiddenException('You do not own this character');
    }

    return character;
  }

  async update(id: number, userId: number, dto: UpdateCharacterDto) {
    const character = await this.prisma.character.findUnique({
      where: { id },
    });

    if (!character) {
      throw new NotFoundException(`Character with id ${id} not found`);
    }

    if (character.deleted) {
      throw new NotFoundException(`Character with id ${id} not found`);
    }

    if (character.userId !== userId) {
      throw new ForbiddenException('You do not own this character');
    }

    if (character.gameId) {
      throw new ConflictException(
        'No se puede editar un personaje que está en una partida activa',
      );
    }

    const { feature_traits, equipment, proficiencies, spells, ...rest } = dto;

    const updateData: Prisma.CharacterUpdateInput = {
      ...rest,
      ...(equipment !== undefined && {
        equipment: equipment as Prisma.InputJsonValue,
      }),
      ...(proficiencies !== undefined && {
        proficiencies: proficiencies as Prisma.InputJsonValue,
      }),
      ...(spells !== undefined && { spells: spells as Prisma.InputJsonValue }),
      ...(feature_traits !== undefined && {
        feature_traits: feature_traits as Prisma.InputJsonValue,
      }),
    };

    return this.prisma.character.update({
      where: { id },
      data: updateData,
    });
  }

  async softDelete(id: number, userId: number) {
    const character = await this.prisma.character.findUnique({
      where: { id },
    });

    if (!character) {
      throw new NotFoundException(`Character with id ${id} not found`);
    }

    if (character.deleted) {
      throw new NotFoundException(`Character with id ${id} not found`);
    }

    if (character.userId !== userId) {
      throw new ForbiddenException('You do not own this character');
    }

    if (character.gameId) {
      throw new ConflictException(
        'No se puede desactivar un personaje que está en una partida activa',
      );
    }

    return this.prisma.character.update({
      where: { id },
      data: { deleted: true },
    });
  }
}
