import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsIn,
} from 'class-validator';
import { ALLOWED_CLASSES, ALLOWED_RACES, ALLOWED_BACKGROUNDS } from '../constants/dnd-options';

export class CreateCharacterDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_CLASSES, { message: 'Clase no válida' })
  class!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_RACES, { message: 'Raza no válida' })
  race!: string;

  @IsString()
  @IsNotEmpty()
  alignment!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  proficiency?: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_BACKGROUNDS, { message: 'Trasfondo no válido' })
  background!: string;

  // --- Atributos base ---
  @IsInt() @Min(1) @Max(30) strength!: number;
  @IsInt() @Min(1) @Max(30) dexterity!: number;
  @IsInt() @Min(1) @Max(30) constitution!: number;
  @IsInt() @Min(1) @Max(30) intelligence!: number;
  @IsInt() @Min(1) @Max(30) wisdom!: number;
  @IsInt() @Min(1) @Max(30) charisma!: number;

  // --- Combate ---
  @IsInt() @Min(0) armor!: number;
  @IsInt() initiative!: number;
  @IsInt() @Min(0) speed!: number;
  @IsInt() @Min(1) max_hp!: number;
  @IsInt() current_hp!: number;

  @IsString()
  @IsNotEmpty()
  hitDice!: string;

  @IsArray()
  @IsOptional()
  equipment?: any[]; // Ej: [{ name: "Espada larga", qty: 1 }]

  @IsArray()
  @IsOptional()
  spells?: any[];

  @IsArray()
  @IsOptional()
  proficiencies?: string[]; // Ej: ["Acrobatics", "Stealth"]
}
