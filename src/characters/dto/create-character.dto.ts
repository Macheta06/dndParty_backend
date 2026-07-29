import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
} from 'class-validator';

export class CreateCharacterDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  class!: string;

  @IsString()
  @IsNotEmpty()
  race!: string;

  @IsString()
  @IsNotEmpty()
  alignment!: string;

  @IsString()
  @IsNotEmpty()
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
