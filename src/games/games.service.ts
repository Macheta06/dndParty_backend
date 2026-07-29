import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { randomBytes } from 'crypto';
import { JoinGameDto } from './dto/join-game.dto';

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

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
        master: { select: { name: true } },
      },
    });
  }
}
