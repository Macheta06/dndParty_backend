import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth/auth.guard';
import { CharactersService } from './characters.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';
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

  @Get(':id')
  getCharacterById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') userId: number,
  ) {
    return this.characterService.getById(id, userId);
  }

  @Patch(':id')
  updateCharacter(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCharacterDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.characterService.update(id, userId, dto);
  }

  @Delete(':id')
  softDeleteCharacter(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') userId: number,
  ) {
    return this.characterService.softDelete(id, userId);
  }
}
