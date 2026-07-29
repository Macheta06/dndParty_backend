import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { randomBytes } from 'crypto';

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
}
