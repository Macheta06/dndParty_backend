import {
  computeAc,
  equipItem,
  getAllowedSlots,
  isEquippable,
  normalizeItemName,
  resolveItem,
  unequipItem,
} from './equipment.model';
import { EquipmentItem } from './equipment.types';

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

    it('errors when the item is not in the inventory', () => {
      const { error } = equipItem([item('Daga')], 'Hacha de mano', 'armor');
      expect(error).toBe('El objeto no está en el inventario');
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

  describe('computeAc', () => {
    const human = { class: 'Fighter', dexterity: 14, constitution: 10, wisdom: 10 };

    it('uses 10 + DEX with no armor equipped', () => {
      const result = computeAc(human, []);
      expect(result.ac).toBe(12);
      expect(result.base).toBe(10);
      expect(result.dexBonus).toBe(2);
    });

    it('applies CON bonus for unarmored barbarians', () => {
      const result = computeAc(
        { class: 'Bárbaro', dexterity: 14, constitution: 16, wisdom: 10 },
        [],
      );
      expect(result.ac).toBe(15);
      expect(result.classBonus).toBe(3);
    });

    it('applies WIS bonus for unarmored monks', () => {
      const result = computeAc(
        { class: 'Monje', dexterity: 14, constitution: 10, wisdom: 15 },
        [],
      );
      expect(result.ac).toBe(14);
      expect(result.classBonus).toBe(2);
    });

    it('uses the armor base without DEX for heavy armor', () => {
      const result = computeAc(
        human,
        [item('Cota de mallas', { slot: 'armor' })],
      );
      expect(result.ac).toBe(16);
      expect(result.dexBonus).toBe(0);
      expect(result.armorName).toBe('Cota de mallas');
    });

    it('caps DEX at +2 for medium armor', () => {
      const result = computeAc(
        { ...human, dexterity: 20 },
        [item('Cota de escamas', { slot: 'armor' })],
      );
      expect(result.ac).toBe(16);
      expect(result.dexBonus).toBe(2);
    });

    it('adds full DEX for light armor', () => {
      const result = computeAc(
        { ...human, dexterity: 20 },
        [item('Armadura de cuero', { slot: 'armor' })],
      );
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
      const result = computeAc(human, [
        item('Cota de mallas'),
        item('Escudo'),
      ]);
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
