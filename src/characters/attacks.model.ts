import { EquipmentItem } from './equipment.types';
import { resolveItem } from './equipment.model';
import {
  AbilityStat,
  AdvantageMode,
  getModifier,
  getProficiencyBonus,
  rollD20,
} from './rolls.model';

/**
 * Resolución de un ataque cuerpo a cuerpo o a distancia.
 *
 * Igual que con la CA y las tiradas, el server es el que hace la cuenta:
 * decide el atributo según el arma, suma el bono de competencia, compara con
 * la CA del objetivo y tira el daño si acierta. El cliente solo pide atacar.
 *
 * Supuesto deliberado: se asume competencia con el arma empuñada, porque la
 * hoja no lleva competencias de armas. En la práctica el personaje empuña
 * armas de su clase, y no asumirlo dejaría a los PJs siempre con -2.
 */

export interface AttackCharacter {
  name: string;
  strength: number;
  dexterity: number;
  level: number;
  /** `equipment` de la DB (JSON). */
  equipment: unknown;
}

export interface AttackTarget {
  name: string;
  /** CA ya calculada por el server. */
  ac: number;
}

export interface AttackRequest {
  advantage?: AdvantageMode;
}

export interface AttackRoll {
  weapon: string;
  /** Fórmula del arma, por ejemplo `1d8`. */
  damage: string;
  damageType: string;
  /** Atributo usado: FUE, o DES si el arma es fina o a distancia. */
  ability: AbilityStat;
  abilityModifier: number;
  /** Bono sobre el d20: atributo + competencia. */
  modifier: number;
  advantage: AdvantageMode;
  /** Dados del ataque; dos con ventaja o desventaja. */
  dice: number[];
  /** El dado que cuenta. */
  kept: number;
  /** `kept + modifier`. */
  total: number;
  targetAc: number;
  hit: boolean;
  /** Dado 20: acierta siempre y tira los dados de daño dobles. */
  critical: boolean;
  /** Daño final; ausente si falla. */
  damageDice?: number[];
  damageTotal?: number;
}

type Rng = () => number;

function die(sides: number, rng: Rng): number {
  return Math.floor(rng() * sides) + 1;
}

/** Lo que está empuñando: primero la mano principal, si no la secundaria. */
function equippedWeapon(equipment: unknown): EquipmentItem | null {
  if (!Array.isArray(equipment)) return null;

  const weapons = equipment
    .filter(
      (entry): entry is EquipmentItem =>
        typeof entry === 'object' && entry !== null,
    )
    .map(resolveItem)
    .filter((entry) => entry.category === 'weapon' && entry.slot);

  const main = weapons.find((entry) => entry.slot === 'weapon-main');
  return (
    main ?? weapons.find((entry) => entry.slot === 'weapon-offhand') ?? null
  );
}

/**
 * Atributo del ataque: un arma fina usa el mejor entre FUE y DES, una a
 * distancia usa DES, y el resto usa FUE.
 */
function attackAbility(
  character: AttackCharacter,
  weapon: EquipmentItem,
): { ability: AbilityStat; modifier: number } {
  const strengthMod = getModifier(character.strength);
  const dexterityMod = getModifier(character.dexterity);

  if (weapon.stats?.finesse) {
    return dexterityMod > strengthMod
      ? { ability: 'dexterity', modifier: dexterityMod }
      : { ability: 'strength', modifier: strengthMod };
  }

  if (weapon.stats?.range) {
    return { ability: 'dexterity', modifier: dexterityMod };
  }

  return { ability: 'strength', modifier: strengthMod };
}

function rollDamage(
  formula: string,
  abilityModifier: number,
  critical: boolean,
  rng: Rng,
): { dice: number[]; total: number } {
  const match = /^(\d+)d(\d+)$/.exec(formula);
  if (!match) {
    throw new Error(`Fórmula de daño inválida: ${formula}`);
  }

  const count = Number(match[1]);
  const sides = Number(match[2]);
  // El crítico repite los dados (1d8 → 2d8); el modificador no se duplica.
  const dice = Array.from({ length: critical ? count * 2 : count }, () =>
    die(sides, rng),
  );

  return {
    dice,
    total: dice.reduce((sum, value) => sum + value, 0) + abilityModifier,
  };
}

/**
 * Resuelve un ataque completo contra un objetivo.
 *
 * Lanza `Error` si no hay arma equipada o si el arma no tiene daño definido:
 * el gateway ya sabe convertir eso en un mensaje para el cliente.
 */
export function resolveAttack(
  character: AttackCharacter,
  target: AttackTarget,
  request: AttackRequest,
  rng: Rng = Math.random,
): AttackRoll {
  const weapon = equippedWeapon(character.equipment);
  if (!weapon) {
    throw new Error(`${character.name} no tiene arma equipada`);
  }

  const damageFormula = weapon.stats?.damage;
  const damageType = weapon.stats?.damageType;
  if (!damageFormula || !damageType) {
    throw new Error(`El arma «${weapon.name}» no tiene daño definido`);
  }

  const { ability, modifier: abilityModifier } = attackAbility(
    character,
    weapon,
  );
  const modifier = abilityModifier + getProficiencyBonus(character.level);

  const advantage = request.advantage ?? 'normal';
  const { dice, kept } = rollD20(advantage, rng);

  const critical = kept === 20;
  const fumble = kept === 1;
  const total = kept + modifier;
  const hit = !fumble && (critical || total >= target.ac);

  const roll: AttackRoll = {
    weapon: weapon.name,
    damage: damageFormula,
    damageType,
    ability,
    abilityModifier,
    modifier,
    advantage,
    dice,
    kept,
    total,
    targetAc: target.ac,
    hit,
    critical,
  };

  if (hit) {
    const { dice: damageDice, total: damageTotal } = rollDamage(
      damageFormula,
      abilityModifier,
      critical,
      rng,
    );
    roll.damageDice = damageDice;
    roll.damageTotal = damageTotal;
  }

  return roll;
}
