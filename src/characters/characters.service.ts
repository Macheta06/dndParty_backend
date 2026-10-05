import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { computeAc, validateEquipment } from './equipment.model';
import { EquipmentItem } from './equipment.types';

/** Campos que alteran la fórmula de Clase de Armadura. */
const AC_DRIVERS = ['class', 'dexterity', 'constitution', 'wisdom'] as const;

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
        gold_coins: createCharacterDto.gold_coins ?? 0,
        equipment: createCharacterDto.equipment ?? [],
        spells: createCharacterDto.spells ?? [],
        proficiencies: createCharacterDto.proficiencies ?? [],
        feature_traits: createCharacterDto.feature_traits ?? [],
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
          select: { id: true, name: true, masterId: true },
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
      if (character.gameId) {
        const isParticipant = await this.prisma.game.findFirst({
          where: {
            id: character.gameId,
            OR: [{ masterId: userId }, { characters: { some: { userId } } }],
          },
        });
        if (isParticipant) {
          return character;
        }
      }
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

    const { feature_traits, equipment, proficiencies, spells, ...rest } = dto;

    // El cliente envía el arreglo completo por REST (aquí no hay transición
    // intermedia como en el socket): validamos el estado final resultante.
    if (equipment !== undefined) {
      const invalid = validateEquipment(
        equipment as unknown as EquipmentItem[],
      );
      if (invalid) {
        throw new BadRequestException(invalid);
      }
    }

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

    // La CA es derivada: se recalcula cuando cambia el equipamiento o
    // cualquier stat que entra en su fórmula. El valor calculado tiene
    // prioridad sobre el `armor` que el cliente reenvía en cada guardado.
    const touchesAc =
      equipment !== undefined ||
      AC_DRIVERS.some((field) => rest[field] !== undefined);

    if (touchesAc) {
      // `plainToInstance` (ValidationPipe transform:true) crea TODAS las
      // propiedades del DTO como propiedades propias, ausentes o no, con
      // valor `undefined`. Un `{ ...character, ...rest }` pisaría los
      // valores reales de la DB con `undefined` y computeAc reventaba con
      // "Cannot read properties of undefined (reading 'trim')".
      // Cada driver de la CA toma el valor enviado, o el de la DB si no vino.
      const acInput = {
        class: rest.class ?? character.class,
        dexterity: rest.dexterity ?? character.dexterity,
        constitution: rest.constitution ?? character.constitution,
        wisdom: rest.wisdom ?? character.wisdom,
      };

      updateData.armor = computeAc(
        acInput,
        (equipment as unknown as EquipmentItem[] | undefined) ??
          (character.equipment as unknown as EquipmentItem[]),
      ).ac;
    }

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

  async hardDelete(id: number, userId: number) {
    const character = await this.prisma.character.findUnique({
      where: { id },
    });

    if (!character) {
      throw new NotFoundException(`Character with id ${id} not found`);
    }

    if (character.userId !== userId) {
      throw new ForbiddenException('You do not own this character');
    }

    return this.prisma.character.delete({
      where: { id },
    });
  }
}
