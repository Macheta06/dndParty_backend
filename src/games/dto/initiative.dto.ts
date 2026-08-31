import {
  IsArray,
  IsIn,
  IsInt,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InitiativeEntryDto {
  @IsIn(['character', 'npc'])
  type!: 'character' | 'npc';

  @IsInt()
  id!: number;

  @IsString()
  name!: string;

  @IsInt()
  score!: number;
}

export class SetInitiativeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitiativeEntryDto)
  entries!: InitiativeEntryDto[];
}

export class RollDiceDto {
  @IsString()
  formula!: string;
}
