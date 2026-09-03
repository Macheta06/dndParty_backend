import { IsInt, IsNotEmpty, IsOptional, IsPositive } from 'class-validator';

export class GrantXpDto {
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  xp!: number;

  @IsInt()
  @IsOptional()
  characterId?: number;
}
