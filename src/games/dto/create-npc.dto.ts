import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateNpcDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsInt()
  @Min(1)
  max_hp!: number;

  @IsInt()
  @Min(0)
  current_hp!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  race?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  class?: string;
}
