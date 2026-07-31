import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class UpdateHpDto {
  @IsInt()
  current_hp!: number;
}

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;
}
