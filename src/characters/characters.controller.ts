import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth/auth.guard';
import { CharactersService } from './characters.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('characters')
@UseGuards(AuthGuard)
export class CharactersController {
  constructor(private readonly characterService: CharactersService) {}

  @Post()
  create(
    @Body() createCharacterDto: CreateCharacterDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.characterService.create(userId, createCharacterDto);
  }

  @Get('mine')
  getMyCharacters(@CurrentUser('sub') userId: number) {
    return this.characterService.getMyCharacters(userId);
  }
}
