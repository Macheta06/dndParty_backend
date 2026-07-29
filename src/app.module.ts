import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { GamesModule } from './games/games.module';
import { CharactersModule } from './characters/characters.module';
import { CharacterssService } from './characterss/characterss.service';

@Module({
  imports: [
    UsersModule,
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    GamesModule,
    CharactersModule,
  ],
  providers: [PrismaService, CharacterssService],
})
export class AppModule {}
