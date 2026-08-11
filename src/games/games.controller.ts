import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GamesService } from './games.service';
import { AuthGuard } from '../auth/guard/auth/auth.guard';
import { CreateGameDto } from './dto/create-game.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JoinGameDto } from './dto/join-game.dto';
import { CreateNoteDto, UpdateHpDto } from './dto/dm-actions.dto';
import { CreateCharacterDto } from '../characters/dto/create-character.dto';

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

  @Get('my-games')
  getMyGames(@CurrentUser('sub') masterId: number) {
    return this.gameService.getGamesByMaster(masterId);
  }

  @Post('join')
  joinGame(
    @Body() joinGameDto: JoinGameDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.gameService.joinGame(userId, joinGameDto);
  }

  @Patch(':gameId/characters/:characterId/hp')
  updateHp(
    @Param('gameId') gameId: string,
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body() updateHpDto: UpdateHpDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.gameService.updateCharacterHp(
      gameId,
      characterId,
      userId,
      updateHpDto,
    );
  }

  @Post(':gameId/npcs')
  createNpc(
    @Param('gameId') gameId: string,
    @Body() createNpcDto: CreateCharacterDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.gameService.createNpc(gameId, userId, createNpcDto);
  }

  @Post(':gameId/notes')
  createNote(
    @Param('gameId') gameId: string,
    @Body() createNoteDto: CreateNoteDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.gameService.createNote(gameId, userId, createNoteDto);
  }
}
