import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { AdvantageMode, RollKind } from '../../characters/rolls.model';

/**
 * Pide una tirada de habilidad o salvación de un personaje de la partida.
 *
 * El cliente manda solo el `key` (por ejemplo `athletics` o `save:wisdom`):
 * el server resuelve el atributo, la competencia y el bono. El cliente nunca
 * calcula ni envía modificadores.
 */
export class RollCharacterDto {
  @IsString()
  @IsNotEmpty()
  gameId!: string;

  @IsInt()
  characterId!: number;

  @IsIn(['skill', 'save'])
  kind!: RollKind;

  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsOptional()
  @IsIn(['normal', 'advantage', 'disadvantage'])
  advantage?: AdvantageMode;

  /** Dificultad opcional, solo para presentar éxito o fallo. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(40)
  dc?: number;
}
