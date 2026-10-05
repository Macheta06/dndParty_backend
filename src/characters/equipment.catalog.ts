import { EquipCatalogEntry } from './equipment.types';

/**
 * Catálogo de objetos equipables del SRD 5.1 (licencia CC-BY 4.0).
 * Se usa para resolver items legados que solo guardan `name` y para
 * calcular la CA de forma automática en el servidor.
 */
export const EQUIP_CATALOG: Record<string, EquipCatalogEntry> = {
  // ── Armaduras ────────────────────────────────────────────────
  'armadura acolchada': {
    category: 'armor',
    acBase: 11,
    acFormula: 'dex',
    stealthDisadvantage: true,
  },
  'armadura de cuero': { category: 'armor', acBase: 11, acFormula: 'dex' },
  'armadura de cuero tachonado': {
    category: 'armor',
    acBase: 12,
    acFormula: 'dex',
  },
  'armadura de pieles': {
    category: 'armor',
    acBase: 12,
    acFormula: 'dex-capped',
  },
  'camisa de cota': { category: 'armor', acBase: 13, acFormula: 'dex-capped' },
  'cota de escamas': {
    category: 'armor',
    acBase: 14,
    acFormula: 'dex-capped',
    stealthDisadvantage: true,
  },
  coraza: { category: 'armor', acBase: 14, acFormula: 'dex-capped' },
  'media armadura': {
    category: 'armor',
    acBase: 15,
    acFormula: 'dex-capped',
    stealthDisadvantage: true,
  },
  'armadura de anillos': {
    category: 'armor',
    acBase: 14,
    acFormula: 'flat',
    stealthDisadvantage: true,
  },
  'cota de mallas': {
    category: 'armor',
    acBase: 16,
    acFormula: 'flat',
    strengthReq: 13,
    stealthDisadvantage: true,
  },
  'armadura de bandas': {
    category: 'armor',
    acBase: 17,
    acFormula: 'flat',
    strengthReq: 15,
    stealthDisadvantage: true,
  },
  'armadura de placas': {
    category: 'armor',
    acBase: 18,
    acFormula: 'flat',
    strengthReq: 15,
    stealthDisadvantage: true,
  },

  // ── Escudos ──────────────────────────────────────────────────
  escudo: { category: 'shield', acBase: 2 },
  'escudo de madera': { category: 'shield', acBase: 2 },

  // ── Armas sencillas cuerpo a cuerpo ──────────────────────────
  garrote: { category: 'weapon', twoHanded: false },
  daga: { category: 'weapon' },
  'gran maza': { category: 'weapon', twoHanded: true },
  maza: { category: 'weapon' },
  bastón: { category: 'weapon' },
  hoz: { category: 'weapon' },
  lanza: { category: 'weapon' },
  'hacha de mano': { category: 'weapon' },
  martillo: { category: 'weapon' },
  jabalina: { category: 'weapon' },

  // ── Armas sencillas a distancia ──────────────────────────────
  'ballesta ligera': { category: 'weapon', twoHanded: true },
  dardo: { category: 'weapon' },
  honda: { category: 'weapon' },
  'ballesta de mano': { category: 'weapon' },
  'arco corto': { category: 'weapon', twoHanded: true },

  // ── Armas marciales cuerpo a cuerpo ──────────────────────────
  'hacha de batalla': { category: 'weapon' },
  látigo: { category: 'weapon' },
  alabarda: { category: 'weapon', twoHanded: true },
  'gran hacha': { category: 'weapon', twoHanded: true },
  'gran espada': { category: 'weapon', twoHanded: true },
  'guadaña de guerra': { category: 'weapon', twoHanded: true },
  'lanza de jinete': { category: 'weapon' },
  'espada larga': { category: 'weapon' },
  'mazo de guerra': { category: 'weapon', twoHanded: true },
  'estrella de la mañana': { category: 'weapon' },
  pica: { category: 'weapon', twoHanded: true },
  estoque: { category: 'weapon' },
  cimitarra: { category: 'weapon' },
  'espada corta': { category: 'weapon' },
  tridente: { category: 'weapon' },
  'pico de guerra': { category: 'weapon' },
  'martillo de guerra': { category: 'weapon' },

  // ── Armas marciales a distancia ──────────────────────────────
  'ballesta pesada': { category: 'weapon', twoHanded: true },
  'arco largo': { category: 'weapon', twoHanded: true },
};
