import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';

const CATEGORIES = [
  'weapon',
  'armor',
  'shield',
  'ammo',
  'gear',
  'consumable',
  'tool',
  'magic',
] as const;

const AC_FORMULAS = ['flat', 'dex', 'dex-capped'] as const;

export class EquipmentStatsDto {
  @IsOptional() @IsInt() @IsPositive() acBase?: number;

  @IsOptional() @IsIn(AC_FORMULAS) acFormula?: (typeof AC_FORMULAS)[number];

  @IsOptional() @IsString() damage?: string;

  @IsOptional() @IsString() damageType?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) properties?: string[];

  @IsOptional() @IsString() range?: string;

  @IsOptional() @IsBoolean() twoHanded?: boolean;

  @IsOptional() @IsBoolean() finesse?: boolean;

  @IsOptional() @IsInt() @IsPositive() strengthReq?: number;

  @IsOptional() @IsBoolean() stealthDisadvantage?: boolean;
}

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

  /** Tipo del objeto. Si se omite se resuelve contra el catálogo del server. */
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  /** Stats de combate/CA. Solo se envían al agregar un objeto nuevo. */
  @IsOptional()
  @ValidateNested()
  @Type(() => EquipmentStatsDto)
  stats?: EquipmentStatsDto;
}

export class RemoveEquipmentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;
}
