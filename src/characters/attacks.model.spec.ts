import { AttackCharacter, resolveAttack } from './attacks.model';

/** Secuencia de valores en [0,1) para que los dados sean predecibles. */
function fixedRng(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const goblin = { name: 'Goblin', ac: 15 };

/** Fuerza 16 (+3), Destreza 14 (+2), nivel 1 (+2 de competencia). */
const aria: AttackCharacter = {
  name: 'Aria',
  strength: 16,
  dexterity: 14,
  level: 1,
  equipment: [{ name: 'Espada larga', quantity: 1, slot: 'weapon-main' }],
};

describe('attacks.model', () => {
  describe('resolveAttack', () => {
    it('fights with the weapon held in the main hand', () => {
      const roll = resolveAttack(aria, goblin, {}, fixedRng(0.75, 0.5));

      expect(roll.weapon).toBe('Espada larga');
      expect(roll.damage).toBe('1d8');
      expect(roll.damageType).toBe('cortante');
      expect(roll.ability).toBe('strength');
      expect(roll.abilityModifier).toBe(3);
      expect(roll.modifier).toBe(5); // 3 de atributo + 2 de competencia
    });

    it('falls back to the offhand when the main hand is free', () => {
      const roll = resolveAttack(
        {
          ...aria,
          equipment: [{ name: 'Daga', quantity: 1, slot: 'weapon-offhand' }],
        },
        goblin,
        {},
        fixedRng(0.75, 0.5),
      );

      expect(roll.weapon).toBe('Daga');
      expect(roll.damage).toBe('1d4');
    });

    it('throws when nothing is equipped', () => {
      expect(() =>
        resolveAttack({ ...aria, equipment: [] }, goblin, {}, fixedRng(0.5)),
      ).toThrow('no tiene arma equipada');
    });

    it('ignores gear that is not a weapon', () => {
      expect(() =>
        resolveAttack(
          {
            ...aria,
            equipment: [
              { name: 'Cota de mallas', quantity: 1, slot: 'armor' },
              { name: 'Raciones', quantity: 1 },
            ],
          },
          goblin,
          {},
          fixedRng(0.5),
        ),
      ).toThrow('no tiene arma equipada');
    });

    it('throws when the weapon has no damage defined', () => {
      expect(() =>
        resolveAttack(
          {
            ...aria,
            equipment: [
              {
                name: 'Arma inventada',
                quantity: 1,
                category: 'weapon',
                slot: 'weapon-main',
              },
            ],
          },
          goblin,
          {},
          fixedRng(0.5),
        ),
      ).toThrow('no tiene daño definido');
    });

    describe('ability', () => {
      const withWeapon = (
        weapon: string,
        strength: number,
        dexterity: number,
      ) =>
        resolveAttack(
          {
            ...aria,
            strength,
            dexterity,
            equipment: [{ name: weapon, quantity: 1, slot: 'weapon-main' }],
          },
          goblin,
          {},
          fixedRng(0.75, 0.5),
        );

      it('uses strength for a plain melee weapon', () => {
        const roll = withWeapon('Espada larga', 16, 10);
        expect(roll.ability).toBe('strength');
        expect(roll.abilityModifier).toBe(3);
      });

      it('uses dexterity for a ranged weapon', () => {
        const roll = withWeapon('Arco largo', 10, 16);
        expect(roll.ability).toBe('dexterity');
        expect(roll.abilityModifier).toBe(3);
      });

      it('uses the better ability for a finesse weapon', () => {
        const dexterous = withWeapon('Estoque', 10, 16);
        expect(dexterous.ability).toBe('dexterity');
        expect(dexterous.abilityModifier).toBe(3);

        const strong = withWeapon('Estoque', 16, 10);
        expect(strong.ability).toBe('strength');
        expect(strong.abilityModifier).toBe(3);
      });
    });

    describe('outcome', () => {
      it('hits when the total meets the target AC', () => {
        // 16 + 5 = 21 contra CA 15.
        const roll = resolveAttack(aria, goblin, {}, fixedRng(0.75, 0.5));

        expect(roll.dice).toEqual([16]);
        expect(roll.total).toBe(21);
        expect(roll.targetAc).toBe(15);
        expect(roll.hit).toBe(true);
        expect(roll.critical).toBe(false);
      });

      it('misses when the total is below the target AC', () => {
        // 6 + 5 = 11 contra CA 20.
        const roll = resolveAttack(
          aria,
          { ...goblin, ac: 20 },
          {},
          fixedRng(0.25),
        );

        expect(roll.total).toBe(11);
        expect(roll.hit).toBe(false);
        expect(roll.damageDice).toBeUndefined();
        expect(roll.damageTotal).toBeUndefined();
      });

      it('a natural 1 always misses', () => {
        const roll = resolveAttack(
          aria,
          { ...goblin, ac: 10 },
          {},
          fixedRng(0.0),
        );

        expect(roll.kept).toBe(1);
        expect(roll.hit).toBe(false);
        expect(roll.damageTotal).toBeUndefined();
      });

      it('a natural 20 always hits and doubles the damage dice', () => {
        const roll = resolveAttack(
          aria,
          { ...goblin, ac: 30 },
          {},
          fixedRng(0.99, 0.5, 0.5),
        );

        expect(roll.critical).toBe(true);
        expect(roll.hit).toBe(true);
        expect(roll.damageDice).toHaveLength(2); // 1d8 → 2d8
        expect(roll.damageTotal).toBe(5 + 5 + 3); // dados + atributo
      });

      it('adds the ability modifier to the damage', () => {
        const roll = resolveAttack(aria, goblin, {}, fixedRng(0.75, 0.5));

        expect(roll.damageDice).toEqual([5]);
        expect(roll.damageTotal).toBe(5 + 3);
      });

      it('keeps the worse die with disadvantage', () => {
        const roll = resolveAttack(
          aria,
          goblin,
          { advantage: 'disadvantage' },
          fixedRng(0.95, 0.0),
        );

        expect(roll.advantage).toBe('disadvantage');
        expect(roll.dice).toEqual([20, 1]);
        expect(roll.kept).toBe(1);
        expect(roll.hit).toBe(false); // el 1 falla siempre
      });

      it('keeps the better die with advantage', () => {
        const roll = resolveAttack(
          aria,
          goblin,
          { advantage: 'advantage' },
          fixedRng(0.0, 0.95, 0.5, 0.5),
        );

        expect(roll.dice).toEqual([1, 20]);
        expect(roll.kept).toBe(20);
        expect(roll.critical).toBe(true);
      });
    });
  });
});
