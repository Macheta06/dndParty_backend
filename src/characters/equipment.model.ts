import {
  EquipmentItem,
  EquipmentSlot,
  EquipCatalogEntry,
} from './equipment.types';
import { EQUIP_CATALOG } from './equipment.catalog';

export interface AcCharacter {
  class: string;
  dexterity: number;
  constitution: number;
  wisdom: number;
}

export interface AcResult {
  ac: number;
  /** CA base: armadura equipada o 10 sin armadura. */
  base: number;
  /** Bono de DES aplicado (0 si la fórmula no lo permite). */
  dexBonus: number;
  /** Bono del escudo (0 si no hay escudo equipado). */
  shieldBonus: number;
  /** Bono de DEF sin armadura de bárbaro/monje (0 si no aplica). */
  classBonus: number;
  armorName?: string;
  shieldName?: string;
}

/** Normaliza un nombre para compararlo con el catálogo. */
export function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function dexMod(dexterity: number): number {
  return Math.floor((dexterity - 10) / 2);
}

/**
 * Completa `category`/`stats` de un item usando el catálogo cuando el objeto
 * no los trae (items legados creados antes del sistema de equipamiento).
 * No muta la entrada.
 */
export function resolveItem(item: EquipmentItem): EquipmentItem {
  if (item.category && item.stats) return item;

  const entry = EQUIP_CATALOG[normalizeItemName(item.name)];
  if (!entry) return item;

  return {
    ...item,
    category: item.category ?? entry.category,
    stats: {
      ...entryToStats(entry),
      ...item.stats,
    },
  };
}

function entryToStats(entry: EquipCatalogEntry): EquipmentItem['stats'] {
  const stats: EquipmentItem['stats'] = {};
  if (entry.acBase !== undefined) stats.acBase = entry.acBase;
  if (entry.acFormula !== undefined) stats.acFormula = entry.acFormula;
  if (entry.twoHanded !== undefined) stats.twoHanded = entry.twoHanded;
  if (entry.strengthReq !== undefined) stats.strengthReq = entry.strengthReq;
  if (entry.stealthDisadvantage !== undefined) {
    stats.stealthDisadvantage = entry.stealthDisadvantage;
  }
  return stats;
}

/** Slots en los que un objeto puede equiparse. Vacío = no equipable. */
export function getAllowedSlots(item: EquipmentItem): EquipmentSlot[] {
  const resolved = resolveItem(item);
  switch (resolved.category) {
    case 'armor':
      return ['armor'];
    case 'shield':
      return ['shield'];
    case 'weapon':
      return resolved.stats?.twoHanded
        ? ['weapon-main']
        : ['weapon-main', 'weapon-offhand'];
    default:
      return [];
  }
}

export function isEquippable(item: EquipmentItem): boolean {
  return getAllowedSlots(item).length > 0;
}

/** El objeto equipado en un slot concreto (resuelve items legados). */
export function findEquipped(
  equipment: EquipmentItem[],
  slot: EquipmentSlot,
): EquipmentItem | undefined {
  return equipment.find((item) => item.slot === slot);
}

function hasEquippedTwoHander(equipment: EquipmentItem[]): boolean {
  return equipment.some((item) => {
    if (item.slot !== 'weapon-main') return false;
    return resolveItem(item).stats?.twoHanded === true;
  });
}

/**
 * Equipa un objeto en el slot indicado, desequipando automáticamente cualquier
 * otro objeto que ocupe ese mismo slot (una sola armadura, un solo escudo, etc).
 * Los conflictos de manos (arma a dos manos vs escudo/secundaria) se bloquean
 * con un mensaje en lugar de hacer un swap silencioso.
 */
export function equipItem(
  equipment: EquipmentItem[],
  name: string,
  slot: EquipmentSlot,
): { equipment: EquipmentItem[]; error?: string } {
  const target = equipment.find(
    (item) => normalizeItemName(item.name) === normalizeItemName(name),
  );
  if (!target) {
    return { equipment, error: 'El objeto no está en el inventario' };
  }

  const resolved = resolveItem(target);
  if (!getAllowedSlots(resolved).includes(slot)) {
    return { equipment, error: `«${target.name}» no puede equiparse en ese slot` };
  }

  const isTwoHander =
    resolved.category === 'weapon' && resolved.stats?.twoHanded === true;

  if (isTwoHander && slot === 'weapon-main') {
    const blockers = equipment
      .filter(
        (item) =>
          item !== target &&
          item.slot !== undefined &&
          (item.slot === 'shield' || item.slot === 'weapon-offhand'),
      )
      .map((item) => item.name);
    if (blockers.length > 0) {
      return {
        equipment,
        error: `«${target.name}» necesita ambas manos. Desequpa antes: ${blockers.join(', ')}`,
      };
    }
  }

  if (slot === 'shield' && hasEquippedTwoHander(equipment)) {
    const twoHander = equipment.find(
      (item) => item.slot === 'weapon-main' && resolveItem(item).stats?.twoHanded,
    );
    return {
      equipment,
      error: `No puedes equipar un escudo: «${twoHander?.name}» ocupa ambas manos`,
    };
  }

  if (slot === 'weapon-offhand' && hasEquippedTwoHander(equipment)) {
    const twoHander = equipment.find(
      (item) => item.slot === 'weapon-main' && resolveItem(item).stats?.twoHanded,
    );
    return {
      equipment,
      error: `No puedes equipar un arma secundaria: «${twoHander?.name}» ocupa ambas manos`,
    };
  }

  const updated = equipment.map((item) => {
    if (item === target) return { ...item, slot };
    if (item.slot === slot) {
      const { slot: _slot, ...rest } = item;
      return rest;
    }
    return item;
  });

  return { equipment: updated };
}

/** Desequipa el objeto con ese nombre. No es error si ya estaba desequipado. */
export function unequipItem(
  equipment: EquipmentItem[],
  name: string,
): EquipmentItem[] {
  return equipment.map((item) => {
    if (normalizeItemName(item.name) !== normalizeItemName(name)) return item;
    const { slot: _slot, ...rest } = item;
    return rest;
  });
}

/**
 * Calcula la CA en función del equipamiento.
 * Sin armadura equipada usa la fórmula sin armadura de la clase
 * (10 + DES, +CON para bárbaro, +SAB para monje).
 */
export function computeAc(
  character: AcCharacter,
  equipment: EquipmentItem[],
): AcResult {
  const resolved = equipment.map(resolveItem);
  const dex = dexMod(character.dexterity);

  const armor = resolved.find((item) => item.slot === 'armor');
  const shield = resolved.find((item) => item.slot === 'shield');

  let base: number;
  let dexBonus: number;
  let classBonus = 0;

  if (armor) {
    base = armor.stats?.acBase ?? 10;
    switch (armor.stats?.acFormula) {
      case 'dex':
        dexBonus = dex;
        break;
      case 'dex-capped':
        dexBonus = Math.min(dex, 2);
        break;
      default:
        dexBonus = 0;
    }
  } else {
    base = 10;
    dexBonus = dex;
    // Réplica exacta de la fórmula usada en la creación del personaje
    // (characters/new): solo se reconocen las clases en inglés que el
    // formulario emite, para no alterar la CA de personajes ya existentes.
    const cls = character.class.trim().toLowerCase();
    if (cls === 'barbarian') {
      classBonus = Math.floor((character.constitution - 10) / 2);
    } else if (cls === 'monk') {
      classBonus = Math.floor((character.wisdom - 10) / 2);
    }
  }

  const shieldBonus = shield ? (shield.stats?.acBase ?? 2) : 0;

  return {
    ac: base + dexBonus + shieldBonus + classBonus,
    base,
    dexBonus,
    shieldBonus,
    classBonus,
    armorName: armor?.name,
    shieldName: shield?.name,
  };
}
