import {
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { randomBytes } from 'crypto';
import { JoinGameDto } from './dto/join-game.dto';
import { CreateNoteDto, UpdateHpDto } from './dto/dm-actions.dto';
import { CreateCharacterDto } from '../characters/dto/create-character.dto';
import { GameGateway } from './games.gateway';

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private gameGateway: GameGateway,
  ) {}

  async createGame(masterId: number, createGameDto: CreateGameDto) {
    const joinCode = randomBytes(3).toString('hex').toUpperCase();

    return this.prisma.game.create({
      data: {
        name: createGameDto.name,
        joinCode,
        masterId,
      },
    });
  }

  async getGamesByMaster(masterId: number) {
    return this.prisma.game.findMany({
      where: {
        masterId,
      },
    });
  }

  async getGameById(id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: {
        characters: true,
        notes: true,
      },
    });

    if (!game) {
      throw new NotFoundException('Partida no encontrada');
    }

    return game;
  }

  async joinGame(userId: number, joinGameDto: JoinGameDto) {
    const { joinCode, characterId } = joinGameDto;
    const game = await this.prisma.game.findUnique({
      where: {
        joinCode,
      },
    });

    if (!game) {
      throw new NotFoundException('No existe ninguna partida con el código');
    }

    const character = await this.prisma.character.findUnique({
      where: {
        id: characterId,
      },
    });

    if (!character) {
      throw new NotFoundException('Personaje no encontrado');
    }

    if (character.gameId) {
      if (character.gameId === game.id) {
        throw new ConflictException('Este personaje ya está en una partida');
      }
      throw new ConflictException(
        'Este personaje ya está jugando en otra sala',
      );
    }

    return this.prisma.character.update({
      where: { id: characterId },
      data: { gameId: game.id },
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
  }

  async leaveGame(gameId: string, userId: number) {
    const character = await this.prisma.character.findFirst({
      where: {
        userId: userId,
        gameId: gameId,
      },
    });

    if (!character) {
      throw new NotFoundException('No tienes ningún personaje en esta partida');
    }

    const updatedCharacter = await this.prisma.character.update({
      where: { id: character.id },
      data: { gameId: null },
    });

    this.gameGateway.server.to(gameId).emit('playerLeft', character.id);

    return updatedCharacter;
  }

  private async verifyGameMaster(gameId: string, userId: number) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Partida no encontrada');
    }
    if (game.masterId !== userId) {
      throw new ForbiddenException(
        'Solo el Dungeon Master puede realizar esta acción',
      );
    }
    return game;
  }

  async updateCharacterHp(
    gameId: string,
    characterId: number,
    userId: number,
    hpDto: UpdateHpDto,
  ) {
    await this.verifyGameMaster(gameId, userId);
    const character = await this.prisma.character.findFirst({
      where: {
        id: characterId,
        gameId,
      },
    });
    if (!character)
      throw new NotFoundException('El personaje no está en esta partida');

    const updatedCharacter = await this.prisma.character.update({
      where: {
        id: characterId,
      },
      data: { current_hp: hpDto.current_hp },
    });

    this.gameGateway.server.to(gameId).emit('hpUpdated', {
      characterId: characterId,
      current_hp: hpDto.current_hp,
    });

    return updatedCharacter;
  }

  async createNpc(gameId: string, userId: number, npcDto: CreateCharacterDto) {
    await this.verifyGameMaster(gameId, userId);

    return this.prisma.character.create({
      data: {
        ...npcDto,
        userId,
        gameId,
        is_npc: true,
        level: npcDto.level ?? 1,
        exp: 0,
        proficiency: npcDto.proficiency ?? 2,
        inspiration: 0,
        temporary_hp: 0,
        equipment: npcDto.equipment ?? [],
        spells: npcDto.spells ?? [],
        proficiencies: npcDto.proficiencies ?? [],
      },
    });
  }

  async createNote(gameId: string, userId: number, noteDto: CreateNoteDto) {
    await this.verifyGameMaster(gameId, userId);

    return this.prisma.note.create({
      data: {
        ...noteDto,
        gameId,
      },
    });
  }
}
