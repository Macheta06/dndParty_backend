import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsNumber,
} from 'class-validator';

export class UpdateCharacterDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  class?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  race?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  alignment?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  proficiency?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  background?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  exp?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  inspiration?: number;

  // --- Stats ---
  @IsOptional() @IsInt() @Min(1) @Max(30) strength?: number;
  @IsOptional() @IsInt() @Min(1) @Max(30) dexterity?: number;
  @IsOptional() @IsInt() @Min(1) @Max(30) constitution?: number;
  @IsOptional() @IsInt() @Min(1) @Max(30) intelligence?: number;
  @IsOptional() @IsInt() @Min(1) @Max(30) wisdom?: number;
  @IsOptional() @IsInt() @Min(1) @Max(30) charisma?: number;

  // --- Combate ---
  @IsOptional() @IsInt() @Min(0) armor?: number;
  @IsOptional() @IsInt() initiative?: number;
  @IsOptional() @IsInt() @Min(0) speed?: number;
  @IsOptional() @IsInt() @Min(1) max_hp?: number;
  @IsOptional() @IsInt() current_hp?: number;
  @IsOptional() @IsInt() @Min(0) temporary_hp?: number;

  @IsOptional()
  @IsString()
  hitDice?: string;

  // --- Economía ---
  @IsOptional() @IsInt() @Min(0) gold_coins?: number;
  @IsOptional() @IsInt() @Min(0) silver_coins?: number;
  @IsOptional() @IsInt() @Min(0) copper_coins?: number;

  // --- JSON fields ---
  @IsOptional() @IsArray() equipment?: unknown[];
  @IsOptional() @IsArray() proficiencies?: unknown[];
  @IsOptional() @IsArray() spells?: unknown[];
  @IsOptional() feature_traits?: unknown;

  // --- Personalidad ---
  @IsOptional() @IsString() personality_traits?: string;
  @IsOptional() @IsString() ideals?: string;
  @IsOptional() @IsString() bonds?: string;
  @IsOptional() @IsString() flaws?: string;

  // --- Apariencia ---
  @IsOptional() @IsInt() age?: number;
  @IsOptional() @IsNumber() height?: number;
  @IsOptional() @IsString() skin?: string;
  @IsOptional() @IsNumber() weight?: number;
  @IsOptional() @IsString() hair?: string;
  @IsOptional() @IsString() appearance_img?: string;
  @IsOptional() @IsString() story?: string;
  @IsOptional() @IsString() allies?: string;
}
