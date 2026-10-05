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
  garrote: {
    category: 'weapon',
    twoHanded: false,
    damage: '1d4',
    damageType: 'contundente',
  },
  daga: {
    category: 'weapon',
    damage: '1d4',
    damageType: 'perforante',
    finesse: true,
  },
  'gran maza': {
    category: 'weapon',
    twoHanded: true,
    damage: '1d8',
    damageType: 'contundente',
  },
  maza: { category: 'weapon', damage: '1d6', damageType: 'contundente' },
  bastón: { category: 'weapon', damage: '1d6', damageType: 'perforante' },
  hoz: { category: 'weapon', damage: '1d4', damageType: 'cortante' },
  lanza: { category: 'weapon', damage: '1d6', damageType: 'perforante' },
  'lanza corta': {
    category: 'weapon',
    damage: '1d6',
    damageType: 'perforante',
  },
  'hacha de mano': {
    category: 'weapon',
    damage: '1d6',
    damageType: 'cortante',
  },
  // El cliente lo trata como objeto común; aquí sigue equipable por legado.
  martillo: { category: 'weapon', damage: '1d4', damageType: 'contundente' },
  'martillo ligero': {
    category: 'weapon',
    damage: '1d4',
    damageType: 'contundente',
  },
  jabalina: { category: 'weapon', damage: '1d6', damageType: 'perforante' },

  // ── Armas sencillas a distancia ──────────────────────────────
  'ballesta ligera': {
    category: 'weapon',
    twoHanded: true,
    damage: '1d8',
    damageType: 'perforante',
    range: '80/320',
  },
  dardo: {
    category: 'weapon',
    damage: '1d4',
    damageType: 'perforante',
    finesse: true,
    range: '20/60',
  },
  honda: {
    category: 'weapon',
    damage: '1d4',
    damageType: 'contundente',
    range: '30/120',
  },
  'ballesta de mano': {
    category: 'weapon',
    damage: '1d6',
    damageType: 'perforante',
    finesse: true,
    range: '30/120',
  },
  'arco corto': {
    category: 'weapon',
    twoHanded: true,
    damage: '1d6',
    damageType: 'perforante',
    range: '80/320',
  },

  // ── Armas marciales cuerpo a cuerpo ──────────────────────────
  'hacha de batalla': {
    category: 'weapon',
    damage: '1d8',
    damageType: 'cortante',
  },
  mangual: { category: 'weapon', damage: '1d8', damageType: 'contundente' },
  látigo: {
    category: 'weapon',
    damage: '1d4',
    damageType: 'cortante',
    finesse: true,
  },
  alabarda: {
    category: 'weapon',
    twoHanded: true,
    damage: '1d10',
    damageType: 'cortante',
  },
  'gran hacha': {
    category: 'weapon',
    twoHanded: true,
    damage: '1d12',
    damageType: 'cortante',
  },
  'gran espada': {
    category: 'weapon',
    twoHanded: true,
    damage: '2d6',
    damageType: 'cortante',
  },
  'guadaña de guerra': {
    category: 'weapon',
    twoHanded: true,
    damage: '1d10',
    damageType: 'cortante',
  },
  'lanza de jinete': {
    category: 'weapon',
    damage: '1d12',
    damageType: 'perforante',
  },
  'espada larga': { category: 'weapon', damage: '1d8', damageType: 'cortante' },
  'mazo de guerra': {
    category: 'weapon',
    twoHanded: true,
    damage: '2d6',
    damageType: 'contundente',
  },
  'estrella de la mañana': {
    category: 'weapon',
    damage: '1d8',
    damageType: 'perforante',
  },
  pica: {
    category: 'weapon',
    twoHanded: true,
    damage: '1d10',
    damageType: 'perforante',
  },
  estoque: {
    category: 'weapon',
    damage: '1d8',
    damageType: 'perforante',
    finesse: true,
  },
  cimitarra: {
    category: 'weapon',
    damage: '1d6',
    damageType: 'cortante',
    finesse: true,
  },
  'espada corta': {
    category: 'weapon',
    damage: '1d6',
    damageType: 'perforante',
    finesse: true,
  },
  tridente: { category: 'weapon', damage: '1d6', damageType: 'perforante' },
  'pico de guerra': {
    category: 'weapon',
    damage: '1d8',
    damageType: 'perforante',
  },
  'martillo de guerra': {
    category: 'weapon',
    damage: '1d8',
    damageType: 'contundente',
  },

  // ── Armas marciales a distancia ──────────────────────────────
  'ballesta pesada': {
    category: 'weapon',
    twoHanded: true,
    damage: '1d10',
    damageType: 'perforante',
    range: '100/400',
  },
  'arco largo': {
    category: 'weapon',
    twoHanded: true,
    damage: '1d8',
    damageType: 'perforante',
    range: '150/600',
  },
};
