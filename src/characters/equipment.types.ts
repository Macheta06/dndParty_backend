export type EquipmentCategory =
  | 'weapon'
  | 'armor'
  | 'shield'
  | 'ammo'
  | 'gear'
  | 'consumable'
  | 'tool'
  | 'magic';

export type EquipmentSlot =
  'armor' | 'shield' | 'weapon-main' | 'weapon-offhand';

export type AcFormula = 'flat' | 'dex' | 'dex-capped';

export interface EquipmentStats {
  acBase?: number;
  acFormula?: AcFormula;
  damage?: string;
  damageType?: string;
  properties?: string[];
  range?: string;
  twoHanded?: boolean;
  finesse?: boolean;
  strengthReq?: number;
  stealthDisadvantage?: boolean;
}

export interface EquipmentItem {
  name: string;
  quantity: number;
  description?: string;
  category?: EquipmentCategory;
  /** Slot ocupado; si existe, el objeto está equipado. */
  slot?: EquipmentSlot;
  stats?: EquipmentStats;
}

export interface EquipCatalogEntry {
  category: Extract<EquipmentCategory, 'weapon' | 'armor' | 'shield'>;
  twoHanded?: boolean;
  acBase?: number;
  acFormula?: AcFormula;
  strengthReq?: number;
  stealthDisadvantage?: boolean;
}
