import { Module } from '@nestjs/common';
import { CharactersService } from './characters.service';
import { CharactersController } from './characters.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  providers: [CharactersService],
  controllers: [CharactersController],
  imports: [PrismaModule],
})
export class CharactersModule {}
