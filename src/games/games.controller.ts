import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { GamesService } from './games.service';
import { AuthGuard } from '../auth/guard/auth/auth.guard';
import { CreateGameDto } from './dto/create-game.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('games')
@UseGuards(AuthGuard)
export class GamesController {
  constructor(private readonly gameService: GamesService) {}

  @Post()
  create(
    @Body() createGameDto: CreateGameDto,
    @CurrentUser('sub') masterId: number,
  ) {
    return this.gameService.createGame(masterId, createGameDto);
  }

  @Get()
  getMyGames(@CurrentUser('sub') masterId: number) {
    return this.gameService.getGamesByMaster(masterId);
  }
}
