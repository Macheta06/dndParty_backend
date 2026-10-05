import {
  findRollDefinition,
  getModifier,
  getProficiencyBonus,
  isProficient,
  resolveRoll,
  rollD20,
} from './rolls.model';
import { RollCharacter } from './rolls.model';

/** Secuencia de valores en [0,1) para que `die()` sea predecible. */
function fixedRng(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const character: RollCharacter = {
  strength: 16, // +3
  dexterity: 8, // -1
  constitution: 14, // +2
  intelligence: 12, // +1
  wisdom: 10, // +0
  charisma: 10, // +0
  level: 9, // bono de competencia +4
  proficiencies: ['Atletismo', 'Salvación de Destreza'],
};

describe('rolls.model', () => {
  describe('getModifier', () => {
    it.each([
      [10, 0],
      [11, 0],
      [8, -1],
      [16, 3],
      [20, 5],
      [1, -5],
    ])('score %i gives %+i', (score, expected) => {
      expect(getModifier(score)).toBe(expected);
    });
  });

  describe('getProficiencyBonus', () => {
    it.each([
      [1, 2],
      [4, 2],
      [5, 3],
      [8, 3],
      [9, 4],
      [17, 6],
    ])('level %i gives +%i', (level, expected) => {
      expect(getProficiencyBonus(level)).toBe(expected);
    });
  });

  describe('isProficient', () => {
    it('finds a skill by name', () => {
      expect(isProficient(['Atletismo'], 'Atletismo')).toBe(true);
    });

    it('ignores case and accents', () => {
      expect(
        isProficient(['Salvación de Destreza'], 'salvacion de destreza'),
      ).toBe(true);
    });

    it('rejects a skill that is not listed', () => {
      expect(isProficient(['Atletismo'], 'Sigilo')).toBe(false);
    });

    it('rejects non-array and non-string entries', () => {
      expect(isProficient('Atletismo', 'Atletismo')).toBe(false);
      expect(isProficient([{ name: 'Sigilo' }], 'Sigilo')).toBe(false);
      expect(isProficient(null, 'Sigilo')).toBe(false);
    });
  });

  describe('findRollDefinition', () => {
    it('resolves skills and saves by id', () => {
      expect(findRollDefinition('skill', 'athletics')?.name).toBe('Atletismo');
      expect(findRollDefinition('save', 'save:wisdom')?.name).toBe(
        'Salvación de Sabiduría',
      );
    });

    it('returns undefined for an unknown id', () => {
      expect(findRollDefinition('skill', 'flying')).toBeUndefined();
      expect(findRollDefinition('save', 'athletics')).toBeUndefined();
    });
  });

  describe('rollD20', () => {
    it('rolls a single die on normal mode', () => {
      // 0.95 -> d20 = 20
      const { dice, kept } = rollD20('normal', fixedRng(0.95));
      expect(dice).toHaveLength(1);
      expect(kept).toBe(20);
    });

    it('keeps the higher die with advantage', () => {
      // 0.0 -> 1, 0.95 -> 20
      const { dice, kept } = rollD20('advantage', fixedRng(0.0, 0.95));
      expect(dice).toEqual([1, 20]);
      expect(kept).toBe(20);
    });

    it('keeps the lower die with disadvantage', () => {
      const { dice, kept } = rollD20('disadvantage', fixedRng(0.0, 0.95));
      expect(dice).toEqual([1, 20]);
      expect(kept).toBe(1);
    });
  });

  describe('resolveRoll', () => {
    // 0.95 -> d20 = 20
    const perfectRoll = fixedRng(0.95);

    it('adds proficiency to a proficient skill', () => {
      const roll = resolveRoll(
        character,
        { kind: 'skill', key: 'athletics' },
        perfectRoll,
      );

      expect(roll.label).toBe('Atletismo');
      expect(roll.statModifier).toBe(3);
      expect(roll.proficient).toBe(true);
      expect(roll.proficiencyBonus).toBe(4);
      expect(roll.modifier).toBe(7);
      expect(roll.total).toBe(27);
    });

    it('skips proficiency for a skill the character lacks', () => {
      const roll = resolveRoll(
        character,
        { kind: 'skill', key: 'stealth' },
        perfectRoll,
      );

      expect(roll.proficient).toBe(false);
      expect(roll.proficiencyBonus).toBe(0);
      expect(roll.modifier).toBe(-1);
      expect(roll.total).toBe(19);
    });

    it('resolves a saving throw from the same proficiencies list', () => {
      const roll = resolveRoll(
        character,
        { kind: 'save', key: 'save:dexterity' },
        perfectRoll,
      );

      expect(roll.label).toBe('Salvación de Destreza');
      expect(roll.proficient).toBe(true);
      expect(roll.modifier).toBe(-1 + 4);
    });

    it('does not grant proficiency on a saving throw that was not taken', () => {
      const roll = resolveRoll(
        character,
        { kind: 'save', key: 'save:strength' },
        perfectRoll,
      );

      expect(roll.proficient).toBe(false);
      expect(roll.modifier).toBe(3);
    });

    it('reports success against a DC and failure below it', () => {
      // total = 20 + 7 = 27
      const ok = resolveRoll(
        character,
        { kind: 'skill', key: 'athletics', dc: 26 },
        fixedRng(0.95),
      );
      const ko = resolveRoll(
        character,
        { kind: 'skill', key: 'athletics', dc: 28 },
        fixedRng(0.95),
      );

      expect(ok.dc).toBe(26);
      expect(ok.success).toBe(true);
      expect(ko.success).toBe(false);
    });

    it('leaves success undefined when no DC is given', () => {
      const roll = resolveRoll(
        character,
        { kind: 'skill', key: 'athletics' },
        perfectRoll,
      );

      expect(roll.dc).toBeUndefined();
      expect(roll.success).toBeUndefined();
    });

    it('passes the advantage mode through to the dice', () => {
      const roll = resolveRoll(
        character,
        { kind: 'skill', key: 'athletics', advantage: 'disadvantage' },
        fixedRng(0.95, 0.0),
      );

      expect(roll.advantage).toBe('disadvantage');
      expect(roll.dice).toEqual([20, 1]);
      expect(roll.kept).toBe(1);
      expect(roll.total).toBe(1 + 7);
    });

    it('throws for a roll that does not exist', () => {
      expect(() =>
        resolveRoll(character, { kind: 'skill', key: 'fly' }, perfectRoll),
      ).toThrow('No existe la tirada');
    });
  });
});
