import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { AdvantageMode } from '../../characters/rolls.model';

/**
 * Pide resolver un ataque de un personaje contra otro de la partida.
 *
 * El cliente no manda el arma ni el bono: el server mira qué tiene empuñado,
 * calcula el atributo, compara con la CA del objetivo y tira el daño.
 */
export class AttackDto {
  @IsString()
  @IsNotEmpty()
  gameId!: string;

  @IsInt()
  attackerId!: number;

  @IsInt()
  targetId!: number;

  @IsOptional()
  @IsIn(['normal', 'advantage', 'disadvantage'])
  advantage?: AdvantageMode;
}
