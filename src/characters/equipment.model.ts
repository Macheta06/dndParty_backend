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
  if (entry.damage !== undefined) stats.damage = entry.damage;
  if (entry.damageType !== undefined) stats.damageType = entry.damageType;
  if (entry.finesse !== undefined) stats.finesse = entry.finesse;
  if (entry.range !== undefined) stats.range = entry.range;
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

/** Copia del item sin el slot (desequipado). */
function withoutSlot(item: EquipmentItem): EquipmentItem {
  const copy: EquipmentItem = { ...item };
  delete copy.slot;
  return copy;
}

/**
 * Equipa un objeto en el slot indicado, desequipando automáticamente cualquier
 * otro objeto que ocupe ese mismo slot (una sola armadura, un solo escudo, etc).
 * Los conflictos de manos (arma a dos manos vs escudo/secundaria, y escudo vs
 * arma secundaria) se bloquean con un mensaje en vez de un swap silencioso.
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
    return {
      equipment,
      error: `«${target.name}» no puede equiparse en ese slot`,
    };
  }

  // Con el arma principal ocupada, otra arma solo cabe en la secundaria:
  // cambiar de arma principal hay que hacerlo en dos pasos (desequipar y
  // equipar) para no pisar el arma actual en silencio.
  if (slot === 'weapon-main') {
    const currentMain = equipment.find(
      (item) => item !== target && item.slot === 'weapon-main',
    );
    if (currentMain) {
      return {
        equipment,
        error: `«${target.name}» no puede ir a la mano principal: ya llevas «${currentMain.name}». Desequipa el arma actual antes de cambiarla`,
      };
    }
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
        error: `«${target.name}» necesita ambas manos. Desequipa antes: ${blockers.join(', ')}`,
      };
    }
  }

  if (slot === 'shield' && hasEquippedTwoHander(equipment)) {
    const twoHander = equipment.find(
      (item) =>
        item.slot === 'weapon-main' && resolveItem(item).stats?.twoHanded,
    );
    return {
      equipment,
      error: `No puedes equipar un escudo: «${twoHander?.name}» ocupa ambas manos`,
    };
  }

  if (slot === 'weapon-offhand' && hasEquippedTwoHander(equipment)) {
    const twoHander = equipment.find(
      (item) =>
        item.slot === 'weapon-main' && resolveItem(item).stats?.twoHanded,
    );
    return {
      equipment,
      error: `No puedes equipar un arma secundaria: «${twoHander?.name}» ocupa ambas manos`,
    };
  }

  // Un escudo ocupa una mano y el arma secundaria la otra: no pueden
  // convivir, porque ya no quedaría mano para el arma principal.
  if (slot === 'weapon-offhand') {
    const shield = equipment.find(
      (item) => item !== target && item.slot === 'shield',
    );
    if (shield) {
      return {
        equipment,
        error: `No puedes equipar un arma secundaria: «${shield.name}» ocupa esa mano. Desequipa el escudo primero`,
      };
    }
  }

  if (slot === 'shield') {
    const offhand = equipment.find(
      (item) => item !== target && item.slot === 'weapon-offhand',
    );
    if (offhand) {
      return {
        equipment,
        error: `No puedes equipar un escudo: «${offhand.name}» ocupa la otra mano. Desequipa el arma secundaria primero`,
      };
    }
  }

  const updated = equipment.map((item) => {
    if (item === target) return { ...item, slot };
    if (item.slot === slot) return withoutSlot(item);
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
    return withoutSlot(item);
  });
}

/**
 * Valida el ESTADO final del equipamiento (no una transición): dos objetos no
 * pueden compartir slot, un arma a dos manos no puede convivir con escudo ni
 * con arma secundaria, y escudo y arma secundaria no pueden ir juntos.
 *
 * El camino de sockets valida la transición con `equipItem`; este valida el
 * arreglo completo que el cliente envía por REST, donde el server no ve el
 * paso intermedio. Devuelve el mensaje de error o `undefined` si es válido.
 */
export function validateEquipment(
  equipment: EquipmentItem[],
): string | undefined {
  const seen = new Map<EquipmentSlot, string>();

  for (const item of equipment) {
    if (!item.slot) continue;

    const owner = seen.get(item.slot);
    if (owner !== undefined) {
      return `Dos objetos no pueden ocupar el slot «${item.slot}»: ${owner} y ${item.name}`;
    }

    if (!getAllowedSlots(item).includes(item.slot)) {
      return `«${item.name}» no puede equiparse en el slot «${item.slot}»`;
    }

    seen.set(item.slot, item.name);
  }

  const twoHander = equipment.find(
    (item) =>
      item.slot === 'weapon-main' &&
      resolveItem(item).stats?.twoHanded === true,
  );

  if (twoHander) {
    const blockers = equipment
      .filter(
        (item) =>
          item !== twoHander &&
          (item.slot === 'shield' || item.slot === 'weapon-offhand'),
      )
      .map((item) => item.name);

    if (blockers.length > 0) {
      return `«${twoHander.name}» necesita ambas manos. Desequipa antes: ${blockers.join(', ')}`;
    }
  }

  // Un escudo ocupa una mano y el arma secundaria la otra: sin lugar para el
  // arma principal. Se valida como estado, no como transición, para que no se
  // llegue al mismo sitio equipando en el orden inverso.
  const shieldName = seen.get('shield');
  const offhandName = seen.get('weapon-offhand');
  if (shieldName !== undefined && offhandName !== undefined) {
    return `«${shieldName}» y «${offhandName}» no pueden ir juntos: cada uno ocupa una mano y no queda mano para el arma principal. Desequipa uno de los dos`;
  }

  return undefined;
}

/**
 * Compara el inventario anterior con el siguiente y rechaza los cambios que
 * solo se pueden dar por pasos: con el arma principal ocupada, otra arma
 * solo puede ir a la secundaria.
 *
 * Es lo contrario que `validateEquipment`: ese valida un estado y por eso no
 * puede ver esto (un estado con una sola arma principal siempre es válido).
 * Hace falta en REST, que solo recibe el arreglo final pero sí tiene a mano
 * el que había antes.
 */
export function validateEquipmentTransition(
  previous: EquipmentItem[],
  next: EquipmentItem[],
): string | undefined {
  const prevMain = previous.find((item) => item.slot === 'weapon-main');
  if (!prevMain) return undefined; // La mano estaba libre: entra quien sea.

  const nextMain = next.find((item) => item.slot === 'weapon-main');
  if (!nextMain) return undefined; // Desequipar siempre está permitido.

  if (normalizeItemName(nextMain.name) === normalizeItemName(prevMain.name)) {
    return undefined; // Sigue siendo el mismo arma en la misma mano.
  }

  return `«${nextMain.name}» no puede pasar a la mano principal mientras «${prevMain.name}» esté equipada. Desequipa el arma actual antes de cambiarla`;
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
    // Un `class` ausente o vacío no es una razón para reventar el guardado.
    const cls = (character.class ?? '').trim().toLowerCase();
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
