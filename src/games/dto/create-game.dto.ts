import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateGameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;
}
