import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class JoinGameDto {
  @IsString()
  @IsNotEmpty()
  joinCode!: string;

  @IsInt()
  @Min(1)
  characterId!: number;
}
