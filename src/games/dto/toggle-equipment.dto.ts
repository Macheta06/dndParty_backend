import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { EquipmentSlot } from '../../characters/equipment.types';

const SLOTS: EquipmentSlot[] = [
  'armor',
  'shield',
  'weapon-main',
  'weapon-offhand',
];

export class ToggleEquipmentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  /** Slot destino. Si se omite se usa el slot por defecto del objeto. */
  @IsOptional()
  @IsIn(SLOTS)
  slot?: EquipmentSlot;
}
