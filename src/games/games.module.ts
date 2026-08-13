import { Module } from '@nestjs/common';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GameGateway } from './games.gateway';

@Module({
  providers: [GamesService, GameGateway],
  controllers: [GamesController],
  imports: [PrismaModule],
})
export class GamesModule {}
