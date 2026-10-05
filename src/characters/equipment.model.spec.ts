import {
  computeAc,
  equipItem,
  getAllowedSlots,
  isEquippable,
  normalizeItemName,
  resolveItem,
  unequipItem,
  validateEquipment,
  validateEquipmentTransition,
} from './equipment.model';
import { EquipmentItem } from './equipment.types';
import { EQUIP_CATALOG } from './equipment.catalog';

const item = (
  name: string,
  extra: Partial<EquipmentItem> = {},
): EquipmentItem => ({ name, quantity: 1, ...extra });

describe('equipment.model', () => {
  describe('normalizeItemName', () => {
    it('lowercases and strips accents', () => {
      expect(normalizeItemName('  Cota de Mallas ')).toBe('cota de mallas');
      expect(normalizeItemName('Bástón')).toBe('baston');
    });
  });

  describe('resolveItem', () => {
    it('fills category and stats from the catalog for legacy items', () => {
      const resolved = resolveItem(item('Cota de mallas'));
      expect(resolved.category).toBe('armor');
      expect(resolved.stats?.acBase).toBe(16);
      expect(resolved.stats?.acFormula).toBe('flat');
    });

    it('keeps explicit stats over catalog values', () => {
      const resolved = resolveItem(
        item('Cota de mallas', { stats: { acBase: 17 } }),
      );
      expect(resolved.stats?.acBase).toBe(17);
    });

    it('leaves unknown items untouched', () => {
      const source = item('Raciones de viaje');
      expect(resolveItem(source)).toEqual(source);
    });

    it('fills weapon damage from the catalog', () => {
      const resolved = resolveItem(item('Espada larga'));

      expect(resolved.category).toBe('weapon');
      expect(resolved.stats?.damage).toBe('1d8');
      expect(resolved.stats?.damageType).toBe('cortante');
      expect(resolved.stats?.finesse).toBeUndefined();
    });

    it('marks finesse and ranged weapons', () => {
      expect(resolveItem(item('Estoque')).stats?.finesse).toBe(true);
      expect(resolveItem(item('Arco largo')).stats?.range).toBe('150/600');
    });

    it('gives every weapon in the catalog a damage roll', () => {
      const weapons = Object.entries(EQUIP_CATALOG).filter(
        ([, entry]) => entry.category === 'weapon',
      );

      // Un arma sin daño no podría atacar y el fallo sería silencioso.
      expect(weapons.length).toBeGreaterThan(30);
      for (const [key, entry] of weapons) {
        expect([key, entry.damage]).toEqual([
          key,
          expect.stringMatching(/^\d+d\d+$/),
        ]);
        expect([key, entry.damageType]).toEqual([
          key,
          expect.stringMatching(/^(cortante|perforante|contundente)$/),
        ]);
      }
    });
  });

  describe('getAllowedSlots', () => {
    it('armor goes to the armor slot', () => {
      expect(getAllowedSlots(item('Cota de mallas'))).toEqual(['armor']);
    });

    it('shields go to the shield slot', () => {
      expect(getAllowedSlots(item('Escudo'))).toEqual(['shield']);
    });

    it('one-handed weapons can use main or offhand', () => {
      expect(getAllowedSlots(item('Daga'))).toEqual([
        'weapon-main',
        'weapon-offhand',
      ]);
    });

    it('two-handed weapons are locked to the main hand', () => {
      expect(getAllowedSlots(item('Gran hacha'))).toEqual(['weapon-main']);
    });

    it('gear is not equippable', () => {
      expect(isEquippable(item('Mochila'))).toBe(false);
      expect(getAllowedSlots(item('Mochila'))).toEqual([]);
    });
  });

  describe('equipItem', () => {
    it('equips an item into the requested slot', () => {
      const { equipment, error } = equipItem(
        [item('Cota de mallas'), item('Escudo')],
        'Cota de mallas',
        'armor',
      );

      expect(error).toBeUndefined();
      expect(equipment[0].slot).toBe('armor');
    });

    it('replaces the previously equipped armor', () => {
      const { equipment } = equipItem(
        [item('Cota de mallas', { slot: 'armor' }), item('Armadura de cuero')],
        'Armadura de cuero',
        'armor',
      );

      expect(equipment[0].slot).toBeUndefined();
      expect(equipment[1].slot).toBe('armor');
    });

    it('rejects an item that does not belong in the slot', () => {
      const { equipment, error } = equipItem(
        [item('Mochila')],
        'Mochila',
        'armor',
      );

      expect(error).toContain('no puede equiparse');
      expect(equipment[0].slot).toBeUndefined();
    });

    it('rejects a two-handed weapon while a shield is equipped', () => {
      const { error } = equipItem(
        [item('Escudo', { slot: 'shield' }), item('Gran hacha')],
        'Gran hacha',
        'weapon-main',
      );

      expect(error).toContain('ambas manos');
      expect(error).toContain('Escudo');
    });

    it('rejects a shield while a two-handed weapon is equipped', () => {
      const { error } = equipItem(
        [item('Gran hacha', { slot: 'weapon-main' }), item('Escudo')],
        'Escudo',
        'shield',
      );

      expect(error).toContain('ocupa ambas manos');
    });

    it('rejects an offhand weapon while a two-handed weapon is equipped', () => {
      const { error } = equipItem(
        [item('Gran hacha', { slot: 'weapon-main' }), item('Daga')],
        'Daga',
        'weapon-offhand',
      );

      expect(error).toContain('arma secundaria');
    });

    it('allows a shield next to a one-handed weapon', () => {
      const { equipment, error } = equipItem(
        [item('Espada larga', { slot: 'weapon-main' }), item('Escudo')],
        'Escudo',
        'shield',
      );

      expect(error).toBeUndefined();
      expect(equipment[1].slot).toBe('shield');
    });

    it('rejects an offhand weapon while a shield is equipped', () => {
      const { equipment, error } = equipItem(
        [item('Escudo', { slot: 'shield' }), item('Daga')],
        'Daga',
        'weapon-offhand',
      );

      expect(error).toContain('arma secundaria');
      expect(error).toContain('Escudo');
      expect(equipment[1].slot).toBeUndefined();
    });

    it('rejects a shield while an offhand weapon is equipped', () => {
      const { error } = equipItem(
        [
          item('Espada larga', { slot: 'weapon-main' }),
          item('Espada corta', { slot: 'weapon-offhand' }),
          item('Escudo'),
        ],
        'Escudo',
        'shield',
      );

      expect(error).toContain('escudo');
      expect(error).toContain('Espada corta');
    });

    it('still allows dual wielding when no shield is equipped', () => {
      const { equipment, error } = equipItem(
        [item('Daga', { slot: 'weapon-main' }), item('Espada corta')],
        'Espada corta',
        'weapon-offhand',
      );

      expect(error).toBeUndefined();
      expect(equipment[1].slot).toBe('weapon-offhand');
    });

    it('errors when the item is not in the inventory', () => {
      const { error } = equipItem([item('Daga')], 'Hacha de mano', 'armor');
      expect(error).toBe('El objeto no está en el inventario');
    });

    it('rejects a new weapon while the main hand is occupied', () => {
      const { equipment, error } = equipItem(
        [item('Espada larga', { slot: 'weapon-main' }), item('Daga')],
        'Daga',
        'weapon-main',
      );

      expect(error).toContain('mano principal');
      expect(error).toContain('Espada larga');
      expect(equipment[1].slot).toBeUndefined();
    });

    it('sends a second weapon to the offhand while the main hand is occupied', () => {
      const { equipment, error } = equipItem(
        [item('Espada larga', { slot: 'weapon-main' }), item('Espada corta')],
        'Espada corta',
        'weapon-offhand',
      );

      expect(error).toBeUndefined();
      expect(equipment[1].slot).toBe('weapon-offhand');
    });

    it('rejects a two-handed weapon while the main hand is occupied', () => {
      const { error } = equipItem(
        [item('Daga', { slot: 'weapon-main' }), item('Gran hacha')],
        'Gran hacha',
        'weapon-main',
      );

      expect(error).toContain('Daga');
    });
  });

  describe('unequipItem', () => {
    it('clears the slot without touching other items', () => {
      const result = unequipItem(
        [
          item('Cota de mallas', { slot: 'armor' }),
          item('Escudo', { slot: 'shield' }),
        ],
        'Cota de mallas',
      );

      expect(result[0].slot).toBeUndefined();
      expect(result[1].slot).toBe('shield');
    });

    it('is a no-op for unknown names', () => {
      const source = [item('Daga')];
      expect(unequipItem(source, 'Hacha')).toEqual(source);
    });
  });

  describe('validateEquipment', () => {
    it('accepts an empty inventory', () => {
      expect(validateEquipment([])).toBeUndefined();
    });

    it('accepts armor, shield and a one-handed weapon together', () => {
      // Arma principal + escudo = las dos manos. Sin lugar para la secundaria.
      expect(
        validateEquipment([
          item('Cota de mallas', { slot: 'armor' }),
          item('Escudo', { slot: 'shield' }),
          item('Espada larga', { slot: 'weapon-main' }),
        ]),
      ).toBeUndefined();
    });

    it('rejects two items sharing the same slot', () => {
      const error = validateEquipment([
        item('Cota de mallas', { slot: 'armor' }),
        item('Cota de escamas', { slot: 'armor' }),
      ]);

      expect(error).toContain('armor');
      expect(error).toContain('Cota de mallas');
      expect(error).toContain('Cota de escamas');
    });

    it('rejects a two-handed weapon sharing the slot with a shield', () => {
      const error = validateEquipment([
        item('Gran hacha', { slot: 'weapon-main' }),
        item('Escudo', { slot: 'shield' }),
      ]);

      expect(error).toContain('ambas manos');
      expect(error).toContain('Gran hacha');
      expect(error).toContain('Escudo');
    });

    it('rejects a two-handed weapon sharing the slot with an offhand weapon', () => {
      const error = validateEquipment([
        item('Gran espada', { slot: 'weapon-main' }),
        item('Daga', { slot: 'weapon-offhand' }),
      ]);

      expect(error).toContain('ambas manos');
      expect(error).toContain('Daga');
    });

    it('rejects an item equipped in a slot it cannot use', () => {
      const error = validateEquipment([
        item('Escudo', { slot: 'weapon-offhand' }),
      ]);

      expect(error).toContain('no puede equiparse');
    });

    it('rejects a shield equipped together with an offhand weapon', () => {
      const error = validateEquipment([
        item('Espada larga', { slot: 'weapon-main' }),
        item('Escudo', { slot: 'shield' }),
        item('Espada corta', { slot: 'weapon-offhand' }),
      ]);

      expect(error).toContain('Escudo');
      expect(error).toContain('Espada corta');
      expect(error).toContain('una mano');
    });

    it('rejects the shield and offhand conflict regardless of array order', () => {
      const offhandFirst = validateEquipment([
        item('Espada corta', { slot: 'weapon-offhand' }),
        item('Escudo', { slot: 'shield' }),
      ]);
      const shieldFirst = validateEquipment([
        item('Escudo', { slot: 'shield' }),
        item('Espada corta', { slot: 'weapon-offhand' }),
      ]);

      expect(offhandFirst).toContain('una mano');
      expect(shieldFirst).toContain('una mano');
    });

    it('accepts dual wielding without a shield', () => {
      expect(
        validateEquipment([
          item('Daga', { slot: 'weapon-main' }),
          item('Espada corta', { slot: 'weapon-offhand' }),
        ]),
      ).toBeUndefined();
    });

    it('ignores items that are not equipped', () => {
      expect(
        validateEquipment([
          item('Gran hacha'),
          item('Escudo'),
          item('Cota de mallas', { slot: 'armor' }),
        ]),
      ).toBeUndefined();
    });
  });

  describe('validateEquipmentTransition', () => {
    const withMain = [item('Espada larga', { slot: 'weapon-main' })];

    it('rejects swapping the main weapon in a single step', () => {
      const error = validateEquipmentTransition(withMain, [
        item('Espada larga'),
        item('Daga', { slot: 'weapon-main' }),
      ]);

      expect(error).toContain('mano principal');
      expect(error).toContain('Espada larga');
    });

    it('rejects replacing the main weapon while demoting it to the offhand', () => {
      const error = validateEquipmentTransition(withMain, [
        item('Espada larga', { slot: 'weapon-offhand' }),
        item('Daga', { slot: 'weapon-main' }),
      ]);

      expect(error).toContain('Espada larga');
    });

    it('accepts keeping the same weapon in the main hand', () => {
      expect(
        validateEquipmentTransition(withMain, [
          item('Espada larga', { slot: 'weapon-main' }),
          item('Escudo', { slot: 'shield' }),
        ]),
      ).toBeUndefined();
    });

    it('accepts unequipping the main weapon', () => {
      expect(
        validateEquipmentTransition(withMain, [item('Espada larga')]),
      ).toBeUndefined();
    });

    it('accepts filling a main hand that was free', () => {
      expect(
        validateEquipmentTransition(
          [],
          [item('Daga', { slot: 'weapon-main' })],
        ),
      ).toBeUndefined();
    });

    it('is a no-op when the previous inventory is empty', () => {
      expect(validateEquipmentTransition([], withMain)).toBeUndefined();
    });
  });

  describe('computeAc', () => {
    const human = {
      class: 'Fighter',
      dexterity: 14,
      constitution: 10,
      wisdom: 10,
    };

    it('uses 10 + DEX with no armor equipped', () => {
      const result = computeAc(human, []);
      expect(result.ac).toBe(12);
      expect(result.base).toBe(10);
      expect(result.dexBonus).toBe(2);
    });

    it('applies CON bonus for unarmored barbarians', () => {
      const result = computeAc(
        { class: 'Barbarian', dexterity: 14, constitution: 16, wisdom: 10 },
        [],
      );
      expect(result.ac).toBe(15);
      expect(result.classBonus).toBe(3);
    });

    it('applies WIS bonus for unarmored monks', () => {
      const result = computeAc(
        { class: 'Monk', dexterity: 14, constitution: 10, wisdom: 15 },
        [],
      );
      expect(result.ac).toBe(14);
      expect(result.classBonus).toBe(2);
    });

    it('matches the creation formula for other classes', () => {
      const result = computeAc(
        { class: 'Wizard', dexterity: 14, constitution: 16, wisdom: 10 },
        [],
      );
      expect(result.ac).toBe(12);
      expect(result.classBonus).toBe(0);
    });

    it('uses the armor base without DEX for heavy armor', () => {
      const result = computeAc(human, [
        item('Cota de mallas', { slot: 'armor' }),
      ]);
      expect(result.ac).toBe(16);
      expect(result.dexBonus).toBe(0);
      expect(result.armorName).toBe('Cota de mallas');
    });

    it('caps DEX at +2 for medium armor', () => {
      const result = computeAc({ ...human, dexterity: 20 }, [
        item('Cota de escamas', { slot: 'armor' }),
      ]);
      expect(result.ac).toBe(16);
      expect(result.dexBonus).toBe(2);
    });

    it('adds full DEX for light armor', () => {
      const result = computeAc({ ...human, dexterity: 20 }, [
        item('Armadura de cuero', { slot: 'armor' }),
      ]);
      expect(result.ac).toBe(16);
      expect(result.dexBonus).toBe(5);
    });

    it('adds the shield bonus on top of the armor', () => {
      const result = computeAc(human, [
        item('Cota de mallas', { slot: 'armor' }),
        item('Escudo', { slot: 'shield' }),
      ]);

      expect(result.ac).toBe(18);
      expect(result.shieldBonus).toBe(2);
      expect(result.shieldName).toBe('Escudo');
    });

    it('keeps the unarmored formula when a shield is equipped without armor', () => {
      const result = computeAc(human, [item('Escudo', { slot: 'shield' })]);
      expect(result.ac).toBe(14);
      expect(result.shieldBonus).toBe(2);
    });

    it('ignores items that are in the inventory but not equipped', () => {
      const result = computeAc(human, [item('Cota de mallas'), item('Escudo')]);
      expect(result.ac).toBe(12);
      expect(result.armorName).toBeUndefined();
    });

    it('resolves legacy items that only carry a name', () => {
      const result = computeAc(human, [
        { name: 'armadura de placas', quantity: 1, slot: 'armor' },
      ]);
      expect(result.ac).toBe(18);
    });
  });
});
