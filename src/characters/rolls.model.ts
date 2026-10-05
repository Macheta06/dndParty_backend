/**
 * Motor de tiradas con sentido: habilidades y salvaciones.
 *
 * El server es la autoridad en la matemática de la tirada, igual que con la
 * CA: el cliente solo pide "tirar Atletismo" y recibe el resultado ya
 * resuelto, con el desglose para poder mostrarlo. Así nadie suma bonos a mano
 * ni hace trampa con la consola.
 *
 * Los nombres en español son parte del contrato: son los que el cliente
 * guarda en `proficiencies`, así que `npm run check:catalog` los compara
 * contra el cliente para que no se desincronicen en silencio.
 */

export type AbilityStat =
  | 'strength'
  | 'dexterity'
  | 'constitution'
  | 'intelligence'
  | 'wisdom'
  | 'charisma';

/** Ventaja y desventaja tiran dos dados y se queda con el mejor o el peor. */
export type AdvantageMode = 'normal' | 'advantage' | 'disadvantage';

export type RollKind = 'skill' | 'save';

export interface RollDefinition {
  /** Identificador estable que el cliente manda. */
  id: string;
  /** Nombre en español, idéntico al guardado en `proficiencies`. */
  name: string;
  stat: AbilityStat;
}

export const ROLLABLE_SKILLS: RollDefinition[] = [
  { id: 'athletics', name: 'Atletismo', stat: 'strength' },
  { id: 'acrobatics', name: 'Acrobacias', stat: 'dexterity' },
  { id: 'sleight_of_hand', name: 'Juego de Manos', stat: 'dexterity' },
  { id: 'stealth', name: 'Sigilo', stat: 'dexterity' },
  { id: 'arcana', name: 'Saber Arcano', stat: 'intelligence' },
  { id: 'history', name: 'Historia', stat: 'intelligence' },
  { id: 'investigation', name: 'Investigación', stat: 'intelligence' },
  { id: 'nature', name: 'Naturaleza', stat: 'intelligence' },
  { id: 'religion', name: 'Religión', stat: 'intelligence' },
  { id: 'animal_handling', name: 'Trato con Animales', stat: 'wisdom' },
  { id: 'insight', name: 'Perspicacia', stat: 'wisdom' },
  { id: 'medicine', name: 'Medicina', stat: 'wisdom' },
  { id: 'perception', name: 'Percepción', stat: 'wisdom' },
  { id: 'survival', name: 'Supervivencia', stat: 'wisdom' },
  { id: 'deception', name: 'Engaño', stat: 'charisma' },
  { id: 'intimidation', name: 'Intimidación', stat: 'charisma' },
  { id: 'performance', name: 'Interpretación', stat: 'charisma' },
  { id: 'persuasion', name: 'Persuasión', stat: 'charisma' },
];

export const ROLLABLE_SAVES: RollDefinition[] = [
  { id: 'save:strength', name: 'Salvación de Fuerza', stat: 'strength' },
  { id: 'save:dexterity', name: 'Salvación de Destreza', stat: 'dexterity' },
  {
    id: 'save:constitution',
    name: 'Salvación de Constitución',
    stat: 'constitution',
  },
  {
    id: 'save:intelligence',
    name: 'Salvación de Inteligencia',
    stat: 'intelligence',
  },
  { id: 'save:wisdom', name: 'Salvación de Sabiduría', stat: 'wisdom' },
  { id: 'save:charisma', name: 'Salvación de Carisma', stat: 'charisma' },
];

/** Rasgos mínimos de un personaje para resolver una tirada. */
export interface RollCharacter {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  /**
   * El bono de competencia sale del nivel, igual que en la hoja
   * (`getProficiencyBonus`). La columna `proficiency` de la DB nunca la
   * escribe el cliente y se queda en 2: usarla haría que la hoja muestre un
   * bono distinto del que se juega.
   */
  level: number;
  /** `proficiencies` de la DB: nombres de habilidades y salvaciones. */
  proficiencies: unknown;
}

export interface RollRequest {
  kind: RollKind;
  /** id de la habilidad ('athletics') o de la salvación ('save:strength'). */
  key: string;
  advantage?: AdvantageMode;
  /** Dificultad opcional para presentar el resultado como éxito o fallo. */
  dc?: number;
}

export interface CharacterRoll {
  kind: RollKind;
  key: string;
  label: string;
  stat: AbilityStat;
  /** Modificador del atributo. */
  statModifier: number;
  proficient: boolean;
  /** Bono aplicado (0 si no hay competencia). */
  proficiencyBonus: number;
  /** Suma total sobre el d20. */
  modifier: number;
  advantage: AdvantageMode;
  /** Todos los dados tirados (dos con ventaja o desventaja). */
  dice: number[];
  /** El dado que cuenta. */
  kept: number;
  /** `kept + modifier`. */
  total: number;
  dc?: number;
  success?: boolean;
}

/** Modificador de un atributo: 10 es +0, 20 es +5. */
export function getModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Bono de competencia por nivel: +2 al 1, +3 al 5, +4 al 9... */
export function getProficiencyBonus(level: number): number {
  return Math.floor((Math.max(1, level) - 1) / 4) + 2;
}

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** ¿Está este nombre en `proficiencies`? Insensible a mayúsculas y tildes. */
export function isProficient(proficiencies: unknown, name: string): boolean {
  if (!Array.isArray(proficiencies)) return false;
  const wanted = normalizeLabel(name);

  return proficiencies.some(
    (entry) => typeof entry === 'string' && normalizeLabel(entry) === wanted,
  );
}

export function findRollDefinition(
  kind: RollKind,
  key: string,
): RollDefinition | undefined {
  const list = kind === 'skill' ? ROLLABLE_SKILLS : ROLLABLE_SAVES;
  return list.find((definition) => definition.id === key);
}

type Rng = () => number;

function die(sides: number, rng: Rng): number {
  return Math.floor(rng() * sides) + 1;
}

/**
 * D20 con la ventaja/desventaja pedida: se tiran dos y se queda con el mejor
 * o con el peor. Devuelve ambos dados para poder mostrarlos en el historial.
 */
export function rollD20(
  advantage: AdvantageMode,
  rng: Rng = Math.random,
): { dice: number[]; kept: number } {
  const dice =
    advantage === 'normal' ? [die(20, rng)] : [die(20, rng), die(20, rng)];

  const kept =
    advantage === 'advantage'
      ? Math.max(...dice)
      : advantage === 'disadvantage'
        ? Math.min(...dice)
        : dice[0];

  return { dice, kept };
}

/**
 * Resuelve una tirada de habilidad o salvación completa.
 *
 * Lanza `Error` si la tirada no existe: el gateway ya sabe convertir eso en
 * un mensaje para el cliente.
 */
export function resolveRoll(
  character: RollCharacter,
  request: RollRequest,
  rng: Rng = Math.random,
): CharacterRoll {
  const definition = findRollDefinition(request.kind, request.key);
  if (!definition) {
    throw new Error(`No existe la tirada «${request.key}»`);
  }

  const advantage = request.advantage ?? 'normal';
  const statModifier = getModifier(character[definition.stat]);
  const proficient = isProficient(character.proficiencies, definition.name);
  const proficiencyBonus = proficient
    ? getProficiencyBonus(character.level)
    : 0;
  const modifier = statModifier + proficiencyBonus;

  const { dice, kept } = rollD20(advantage, rng);
  const total = kept + modifier;

  const roll: CharacterRoll = {
    kind: request.kind,
    key: definition.id,
    label: definition.name,
    stat: definition.stat,
    statModifier,
    proficient,
    proficiencyBonus,
    modifier,
    advantage,
    dice,
    kept,
    total,
  };

  if (request.dc !== undefined) {
    roll.dc = request.dc;
    roll.success = total >= request.dc;
  }

  return roll;
}
