import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';

export class AddEquipmentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class RemoveEquipmentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;
}
