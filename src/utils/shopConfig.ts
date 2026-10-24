import { BankPackageConfig, CharacterSkinTemplate, GameItem, ItemQualityKey, ItemSlot } from '../types/game';

export type { CharacterSkinTemplate, BankPackageConfig };

export const PERSONAL_SKIN_DEFAULT_SPRITE_DATA_URL =
  `data:image/svg+xml;utf8,` +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 120" fill="none">
      <defs>
        <radialGradient id="aura" cx="50%" cy="48%" r="48%">
          <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.45"/>
          <stop offset="65%" stop-color="#9333ea" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="50%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#b45309"/>
        </linearGradient>
        <linearGradient id="lapis" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#1e3a8a"/>
        </linearGradient>
        <linearGradient id="darkArmor" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#312e81"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <!-- Royal Aura & Shadow Pedestal -->
      <ellipse cx="40" cy="58" rx="34" ry="48" fill="url(#aura)"/>
      <ellipse cx="40" cy="112" rx="24" ry="5" fill="#f59e0b" fill-opacity="0.35"/>
      <!-- Royal Cloak -->
      <path d="M22 36 L12 98 L28 94 L40 98 L52 94 L68 98 L58 36 Z" fill="#3b0764" stroke="url(#gold)" stroke-width="1.4"/>
      <!-- Nemes Royal Headdress -->
      <path d="M21 26 L26 9 L54 9 L59 26 L55 43 L46 39 L34 39 L25 43 Z" fill="url(#lapis)" stroke="url(#gold)" stroke-width="2"/>
      <path d="M25 14 H55 M23 20 H57 M24 26 H56" stroke="url(#gold)" stroke-width="1.5"/>
      <!-- Cobra Uraeus Crown -->
      <circle cx="40" cy="10" r="3.5" fill="url(#gold)" stroke="#fff" stroke-width="0.8"/>
      <circle cx="40" cy="10" r="1.5" fill="#ef4444"/>
      <!-- Pharaoh Face & Glowing Eyes -->
      <path d="M30 18 H50 V31 C50 36 45 39 40 39 C35 39 30 36 30 31 Z" fill="#d97706" stroke="url(#gold)" stroke-width="1.5"/>
      <ellipse cx="36" cy="25" rx="2.3" ry="1.3" fill="#67e8f9"/>
      <ellipse cx="44" cy="25" rx="2.3" ry="1.3" fill="#67e8f9"/>
      <!-- Royal Beard -->
      <path d="M38 38 L42 38 L41 46 L39 46 Z" fill="url(#gold)"/>
      <!-- Broad Golden Pauldrons & Torso Armor -->
      <path d="M16 42 C25 36 55 36 64 42 L68 54 L56 56 L53 46 L52 68 L28 68 L27 46 L24 56 L12 54 Z" fill="url(#darkArmor)" stroke="url(#gold)" stroke-width="1.8"/>
      <path d="M24 42 C32 49 48 49 56 42" stroke="url(#gold)" stroke-width="2.5" fill="none"/>
      <polygon points="40,46 44,52 40,58 36,52" fill="#38bdf8" stroke="#fff" stroke-width="1"/>
      <!-- Arms & Golden Vambraces -->
      <path d="M15 54 L22 55 L20 74 L13 73 Z M65 54 L58 55 L60 74 L67 73 Z" fill="#b45309" stroke="url(#gold)" stroke-width="1.4"/>
      <!-- Glowing Khopesh Sword in Right Hand -->
      <path d="M16 72 L16 48 C16 36 6 34 8 24 C10 17 18 18 20 24" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M16 74 L16 66" stroke="url(#gold)" stroke-width="3.5" stroke-linecap="round"/>
      <!-- Royal Scepter Ankh in Left Hand -->
      <path d="M64 46 L64 86 M59 52 H69" stroke="url(#gold)" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="64" cy="41" r="4.5" stroke="#38bdf8" stroke-width="2.2" fill="none"/>
      <!-- Royal Belt & Shendyt Kilt -->
      <rect x="27" y="66" width="26" height="5" rx="1.5" fill="url(#gold)" stroke="#fff" stroke-width="0.8"/>
      <path d="M26 71 L54 71 L58 90 L44 90 L40 78 L36 90 L22 90 Z" fill="url(#lapis)" stroke="url(#gold)" stroke-width="1.6"/>
      <path d="M37 71 L43 71 L45 92 L40 95 L35 92 Z" fill="url(#gold)"/>
      <!-- Armored Greaves & Boots -->
      <path d="M26 90 L35 90 L34 111 L24 111 Z M45 90 L54 90 L56 111 L46 111 Z" fill="url(#darkArmor)" stroke="url(#gold)" stroke-width="1.6"/>
      <path d="M22 109 H35 V114 H20 Z M45 109 H58 V114 H45 Z" fill="url(#gold)"/>
    </svg>`
  );

export const DEFAULT_BANK_PACKAGES: BankPackageConfig[] = [
  { id: 'bank_pack_100', crystals: 100, priceUsd: 1, label: 'Стартовый мешочек', enabled: true },
  { id: 'bank_pack_300', crystals: 300, priceUsd: 2, label: 'Набор Искателя', enabled: true },
  { id: 'bank_pack_500', crystals: 500, priceUsd: 3, label: 'Сундук Жреца', enabled: true },
  { id: 'bank_pack_1000', crystals: 1000, priceUsd: 8, label: 'Сокровище Анубиса', enabled: true },
  { id: 'bank_pack_2000', crystals: 2000, priceUsd: 15, label: 'Ковчег Фараона', enabled: true },
  { id: 'bank_pack_5000', crystals: 5000, priceUsd: 25, label: 'Казна Бога Ра', enabled: true }
];

const SUPABASE_REST_URL = 'https://lgbxbwzqckdnviygsghu.supabase.co/rest/v1/players';
const SUPABASE_KEY = 'sb_publishable_lGMAAuZELw2gPDZeuEx0VQ_DgPK7szm';

export interface ShopCatalogItem {
  id: string;
  name: string;
  slot: ItemSlot;
  icon: string;
  quality: ItemQualityKey;
  lvl: number;
  price: number;
  maxDurability: number;
  hp: number;
  dmg: number;
  dodgeBonus: number;
  energyBonus: number;
  goldBonusPct: number;
  expBonusPct: number;
  isCustom?: boolean;
  enabled: boolean;
}

export const SHOP_CATEGORY_LABELS: Record<string, string> = {
  weapon: 'Оружие',
  armor: 'Броня',
  pants: 'Штаны',
  boots: 'Сапоги',
  gloves: 'Перчатки',
  ring: 'Кольцо',
  helmet: 'Шлем',
  elixirs: 'Эликсиры',
  licenses: 'Лицензии',
  skins: 'Скины'
};

export interface GlobalFeatureFlags {
  rouletteEnabled: boolean;
  exchangeEnabled: boolean;
  premiumEnabled: boolean;
  durabilityEnabled: boolean;
  shopEnabled?: boolean;
  bankPurchaseEnabled?: boolean;
  bankPaymentUrl?: string;
  bankPaymentInstructions?: string;
  bankPackages?: BankPackageConfig[];
  crystalToGoldRate?: number;
  goldToCrystalRate?: number;
  dailyCrystalToGoldLimit?: number;
  dailyGoldToCrystalLimit?: number;
  crystalToGoldEnabled?: boolean;
  goldToCrystalEnabled?: boolean;
  crystalSpawnIntervalSec?: number;
  crystalSpawnAmount?: number;
  bossSpawnFrequency?: number;
  bossRespawnIntervalSec?: number;
  customCreationEnabled?: boolean;
  customCreationCurrency?: 'crystals' | 'gold' | 'both';
  customBaseCostCrystals?: number;
  customBaseCostGold?: number;
  customCostPerStatCrystals?: number;
  customCostPerStatGold?: number;
  customMaxDmg?: number;
  customMaxHp?: number;
  customMaxDodge?: number;
  customMaxEnergy?: number;
  customMaxGoldPct?: number;
  customMaxExpPct?: number;
  customDefaultDurability?: number;
  // Premium (VIP) Configurable Settings & All Game Bonuses
  premiumPriceCrystals?: number;
  premiumPriceGold?: number;
  premiumCurrency?: 'crystals' | 'gold' | 'both';
  premiumDurationHours?: number;
  premiumHpBonus?: number;
  premiumDmgBonus?: number;
  premiumStrBonus?: number;
  premiumAgiBonus?: number;
  premiumVitBonus?: number;
  premiumDodgeBonus?: number;
  premiumEnergyBonus?: number;
  premiumGoldBonusPct?: number;
  premiumExpBonusPct?: number;
  premiumBagBonus?: number;
  premiumRegenMultiplier?: number;
  premiumWheelMultiplier?: number;
  premiumLootBonusPct?: number;
  premiumGoldWheelEnabled?: boolean;
  premiumCrownEnabled?: boolean;
}

export const DEFAULT_FEATURE_FLAGS: GlobalFeatureFlags = {
  rouletteEnabled: false, // Временно закрыть рулетку
  exchangeEnabled: false, // Временно закрыть обмен
  premiumEnabled: true,   // Управление Премиумом (VIP)
  durabilityEnabled: true, // Механика прочности активна
  shopEnabled: true,
  bankPurchaseEnabled: true,
  bankPaymentUrl: '',
  bankPaymentInstructions: 'Для покупки кристаллов выберите нужный пакет и свяжитесь с Администратором в чате или по указанным реквизитам.',
  bankPackages: DEFAULT_BANK_PACKAGES.map((p) => ({ ...p })),
  crystalToGoldRate: 1000,
  goldToCrystalRate: 2000,
  dailyCrystalToGoldLimit: 3,
  dailyGoldToCrystalLimit: 3,
  crystalToGoldEnabled: true,
  goldToCrystalEnabled: true,
  crystalSpawnIntervalSec: 60,
  crystalSpawnAmount: 1,
  bossSpawnFrequency: 15,
  bossRespawnIntervalSec: 60,
  customCreationEnabled: true,
  customCreationCurrency: 'both',
  customBaseCostCrystals: 0,
  customBaseCostGold: 0,
  customCostPerStatCrystals: 1,
  customCostPerStatGold: 50,
  customMaxDmg: 250,
  customMaxHp: 500,
  customMaxDodge: 25,
  customMaxEnergy: 150,
  customMaxGoldPct: 25,
  customMaxExpPct: 25,
  customDefaultDurability: 100,
  // Premium (VIP) Default Values
  premiumPriceCrystals: 300,
  premiumPriceGold: 30000,
  premiumCurrency: 'crystals',
  premiumDurationHours: 24,
  premiumHpBonus: 0,
  premiumDmgBonus: 0,
  premiumStrBonus: 0,
  premiumAgiBonus: 0,
  premiumVitBonus: 0,
  premiumDodgeBonus: 0,
  premiumEnergyBonus: 0,
  premiumGoldBonusPct: 10,
  premiumExpBonusPct: 20,
  premiumBagBonus: 0,
  premiumRegenMultiplier: 2,
  premiumWheelMultiplier: 2,
  premiumLootBonusPct: 50,
  premiumGoldWheelEnabled: true,
  premiumCrownEnabled: true
};

export function getBankPackages(flags?: Partial<GlobalFeatureFlags> | null): BankPackageConfig[] {
  const f = flags || getFeatureFlags();
  if (Array.isArray(f.bankPackages) && f.bankPackages.length > 0) {
    return f.bankPackages.map((p, idx) => ({
      id: String(p.id || `bank_pack_${idx}`),
      crystals: Math.max(1, Number(p.crystals || 100)),
      priceUsd: Math.max(0.1, Number(p.priceUsd || 1)),
      bonusCrystals: Math.max(0, Number(p.bonusCrystals || 0)),
      label: p.label ? String(p.label) : `${p.crystals} Кристаллов`,
      enabled: p.enabled !== false
    }));
  }
  return DEFAULT_BANK_PACKAGES.map((p) => ({ ...p }));
}

function getQualityForLvl(lvl: number): ItemQualityKey {
  if (lvl >= 20) return 'legendary';
  if (lvl >= 15) return 'epic';
  if (lvl >= 8) return 'rare';
  return 'common';
}

export const DEFAULT_SHOP_CATALOG: ShopCatalogItem[] = [
  // ==================== 1. ОРУЖИЕ (weapon) ====================
  // Легендарный меч Абиссального Пламени (20 ур.)
  {
    id: 'shop_weapon_abyssal_blade',
    name: 'Меч Абиссального Пламени',
    slot: 'weapon',
    icon: '⚔️',
    quality: 'legendary',
    lvl: 20,
    price: 300,
    maxDurability: 30,
    hp: 350,
    dmg: 150,
    dodgeBonus: 5,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 10,
    enabled: true
  },
  // Новый меч 2-го уровня с пользовательской иконкой
  {
    id: 'shop_weapon_custom_2',
    name: 'Клинок Рассвета',
    slot: 'weapon',
    icon: '/assets/swords/new_sword_lvl2.png',
    quality: getQualityForLvl(2),
    lvl: 2,
    price: 35,
    maxDurability: 12,
    hp: 25,
    dmg: 12,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  // 2 ур. (+20 здоровья, +10 урона), 30 золота, прочность 10/10
  {
    id: 'shop_weapon_2',
    name: 'Бронзовый Хопеш Новичка',
    slot: 'weapon',
    icon: '🗡️',
    quality: getQualityForLvl(2),
    lvl: 2,
    price: 30,
    maxDurability: 10,
    hp: 20,
    dmg: 10,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  // 4 ур. (+50 здоровья, +30 урона), 40 золота, прочность 10/10
  {
    id: 'shop_weapon_4',
    name: 'Клинок Песчаной Бури',
    slot: 'weapon',
    icon: '⚔️',
    quality: getQualityForLvl(4),
    lvl: 4,
    price: 40,
    maxDurability: 10,
    hp: 50,
    dmg: 30,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  // 5 ур. (+75 здоровья, +35 урона), 50 золота, прочность 15/15
  {
    id: 'shop_weapon_5',
    name: 'Секира Стража Гробницы',
    slot: 'weapon',
    icon: '🪓',
    quality: getQualityForLvl(5),
    lvl: 5,
    price: 50,
    maxDurability: 15,
    hp: 75,
    dmg: 35,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  // 8 ур. (+85 здоровья, +40 урона), 80 золота, прочность 15/15
  {
    id: 'shop_weapon_8',
    name: 'Золотой Клинок Анубиса',
    slot: 'weapon',
    icon: '⚔️',
    quality: getQualityForLvl(8),
    lvl: 8,
    price: 80,
    maxDurability: 15,
    hp: 85,
    dmg: 40,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  // 10 ур. (+100 здоровья, +50 урона), 100 золота, прочность 17/17
  {
    id: 'shop_weapon_10',
    name: 'Скипетр Владыки Пустыни',
    slot: 'weapon',
    icon: '🔱',
    quality: getQualityForLvl(10),
    lvl: 10,
    price: 100,
    maxDurability: 17,
    hp: 100,
    dmg: 50,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  // 15 ур. (+150 здоровья, +75 урона), 150 золота, прочность 20/20
  {
    id: 'shop_weapon_15',
    name: 'Огненный Меч Бога Хора',
    slot: 'weapon',
    icon: '🔥',
    quality: getQualityForLvl(15),
    lvl: 15,
    price: 150,
    maxDurability: 20,
    hp: 150,
    dmg: 75,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  // 20 ур. (+250 здоровья, +100 урона), 200 золота, прочность 25/25
  {
    id: 'shop_weapon_20',
    name: 'Божественный Клинок Фараона Ра',
    slot: 'weapon',
    icon: '⚡',
    quality: getQualityForLvl(20),
    lvl: 20,
    price: 200,
    maxDurability: 25,
    hp: 250,
    dmg: 100,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },

  // ==================== 2. БРОНЯ (armor) ====================
  // 2 ур. (+25 здоровья, +1% уклонения), 30 золота, 10/10
  {
    id: 'shop_armor_2',
    name: 'Льняной Доспех Кочевника',
    slot: 'armor',
    icon: '🛡️',
    quality: getQualityForLvl(2),
    lvl: 2,
    price: 30,
    maxDurability: 10,
    hp: 25,
    dmg: 0,
    dodgeBonus: 1,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  // 4 ур. (+30 здоровья, +1% уклонения), 40 золота, 10/10
  {
    id: 'shop_armor_4',
    name: 'Кожаный Панцирь Оазиса',
    slot: 'armor',
    icon: '🛡️',
    quality: getQualityForLvl(4),
    lvl: 4,
    price: 40,
    maxDurability: 10,
    hp: 30,
    dmg: 0,
    dodgeBonus: 1,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  // 5 ур. (+50 здоровья, +2% уклонения), 50 золота, 15/15
  {
    id: 'shop_armor_5',
    name: 'Бронзовая Кираса Стража',
    slot: 'armor',
    icon: '🛡️',
    quality: getQualityForLvl(5),
    lvl: 5,
    price: 50,
    maxDurability: 15,
    hp: 50,
    dmg: 0,
    dodgeBonus: 2,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  // 8 ур. (+70 здоровья, +2% уклонения), 80 золота, 15/15
  {
    id: 'shop_armor_8',
    name: 'Чешуйчатый Доспех Собека',
    slot: 'armor',
    icon: '🛡️',
    quality: getQualityForLvl(8),
    lvl: 8,
    price: 80,
    maxDurability: 15,
    hp: 70,
    dmg: 0,
    dodgeBonus: 2,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  // 10 ур. (+100 здоровья, +3% уклонения), 100 золота, 17/17
  {
    id: 'shop_armor_10',
    name: 'Золотые Латы Жреца',
    slot: 'armor',
    icon: '🛡️',
    quality: getQualityForLvl(10),
    lvl: 10,
    price: 100,
    maxDurability: 17,
    hp: 100,
    dmg: 0,
    dodgeBonus: 3,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  // 15 ур. (+150 здоровья, +5% уклонения), 150 золота, 20/20
  {
    id: 'shop_armor_15',
    name: 'Мифриловый Панцирь Сфинкса',
    slot: 'armor',
    icon: '🛡️',
    quality: getQualityForLvl(15),
    lvl: 15,
    price: 150,
    maxDurability: 20,
    hp: 150,
    dmg: 0,
    dodgeBonus: 5,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  // 20 ур. (+200 здоровья, +10% уклонения), 200 золота, 25/25
  {
    id: 'shop_armor_20',
    name: 'Божественные Доспехи Вечности Ра',
    slot: 'armor',
    icon: '🛡️',
    quality: getQualityForLvl(20),
    lvl: 20,
    price: 200,
    maxDurability: 25,
    hp: 200,
    dmg: 0,
    dodgeBonus: 10,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },

  // ==================== 3. ШТАНЫ (pants) ====================
  // 2 ур. (+5 энергии), 4 ур. (+8 энергии), 5 ур. (+15 энергии), 8 ур. (+25 энергии), 10 ур. (+40 энергии), 15 ур. (+50 энергии), 20 ур. (+100 энергии)
  {
    id: 'shop_pants_2',
    name: 'Походные Штаны Искателя',
    slot: 'pants',
    icon: '👖',
    quality: getQualityForLvl(2),
    lvl: 2,
    price: 30,
    maxDurability: 10,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 5,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_pants_4',
    name: 'Плотные Поножи Барханов',
    slot: 'pants',
    icon: '👖',
    quality: getQualityForLvl(4),
    lvl: 4,
    price: 40,
    maxDurability: 10,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 8,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_pants_5',
    name: 'Укрепленные Поножи Стража',
    slot: 'pants',
    icon: '👖',
    quality: getQualityForLvl(5),
    lvl: 5,
    price: 50,
    maxDurability: 15,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 15,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_pants_8',
    name: 'Золоченые Поножи Анубиса',
    slot: 'pants',
    icon: '👖',
    quality: getQualityForLvl(8),
    lvl: 8,
    price: 80,
    maxDurability: 15,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 25,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_pants_10',
    name: 'Боевые Набедренники Фараона',
    slot: 'pants',
    icon: '👖',
    quality: getQualityForLvl(10),
    lvl: 10,
    price: 100,
    maxDurability: 17,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 40,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_pants_15',
    name: 'Энергетические Поножи Хора',
    slot: 'pants',
    icon: '👖',
    quality: getQualityForLvl(15),
    lvl: 15,
    price: 150,
    maxDurability: 20,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 50,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_pants_20',
    name: 'Божественные Поножи Солнца Ра',
    slot: 'pants',
    icon: '👖',
    quality: getQualityForLvl(20),
    lvl: 20,
    price: 200,
    maxDurability: 25,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 100,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },

  // ==================== 4. САПОГИ (boots) ====================
  // 2 ур. (+1 уклонения), 4 ур. (+2 уклонения), 5 ур. (+3 уклонения), 8 ур. (+4 уклонения), 10 ур. (+5 уклонения), 15 ур. (+7 уклонения), 20 ур. (+15 уклонения)
  {
    id: 'shop_boots_2',
    name: 'Кожаные Сандалии Странника',
    slot: 'boots',
    icon: '👢',
    quality: getQualityForLvl(2),
    lvl: 2,
    price: 30,
    maxDurability: 10,
    hp: 0,
    dmg: 0,
    dodgeBonus: 1,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_boots_4',
    name: 'Сапоги Песчаного Ветра',
    slot: 'boots',
    icon: '👢',
    quality: getQualityForLvl(4),
    lvl: 4,
    price: 40,
    maxDurability: 10,
    hp: 0,
    dmg: 0,
    dodgeBonus: 2,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_boots_5',
    name: 'Бронзовые Ботфорты Гробницы',
    slot: 'boots',
    icon: '👢',
    quality: getQualityForLvl(5),
    lvl: 5,
    price: 50,
    maxDurability: 15,
    hp: 0,
    dmg: 0,
    dodgeBonus: 3,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_boots_8',
    name: 'Сапоги Тени Шакала',
    slot: 'boots',
    icon: '👢',
    quality: getQualityForLvl(8),
    lvl: 8,
    price: 80,
    maxDurability: 15,
    hp: 0,
    dmg: 0,
    dodgeBonus: 4,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_boots_10',
    name: 'Крылатые Сапоги Миража',
    slot: 'boots',
    icon: '👢',
    quality: getQualityForLvl(10),
    lvl: 10,
    price: 100,
    maxDurability: 17,
    hp: 0,
    dmg: 0,
    dodgeBonus: 5,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_boots_15',
    name: 'Золотые Ботфорты Сокола Хора',
    slot: 'boots',
    icon: '👢',
    quality: getQualityForLvl(15),
    lvl: 15,
    price: 150,
    maxDurability: 20,
    hp: 0,
    dmg: 0,
    dodgeBonus: 7,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_boots_20',
    name: 'Божественные Сапоги Света Ра',
    slot: 'boots',
    icon: '👢',
    quality: getQualityForLvl(20),
    lvl: 20,
    price: 200,
    maxDurability: 25,
    hp: 0,
    dmg: 0,
    dodgeBonus: 15,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    enabled: true
  },

  // ==================== 5. ПЕРЧАТКИ (gloves) ====================
  // 2 ур. (+2% к золоту), 4 ур. (+3% к золоту), 5 ур. (+4% к золоту), 8 ур. (+6% к золоту), 10 ур. (+8% к золоту), 15 ур. (+9% к золоту), 20 ур. (+12% к золоту)
  {
    id: 'shop_gloves_2',
    name: 'Перчатки Искателя Сокровищ',
    slot: 'gloves',
    icon: '🧤',
    quality: getQualityForLvl(2),
    lvl: 2,
    price: 30,
    maxDurability: 10,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 2,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_gloves_4',
    name: 'Кожаные Наручи Каравана',
    slot: 'gloves',
    icon: '🧤',
    quality: getQualityForLvl(4),
    lvl: 4,
    price: 40,
    maxDurability: 10,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 3,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_gloves_5',
    name: 'Бронзовые Наручи Казначея',
    slot: 'gloves',
    icon: '🧤',
    quality: getQualityForLvl(5),
    lvl: 5,
    price: 50,
    maxDurability: 15,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 4,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_gloves_8',
    name: 'Позолоченные Рукавицы Жреца',
    slot: 'gloves',
    icon: '🧤',
    quality: getQualityForLvl(8),
    lvl: 8,
    price: 80,
    maxDurability: 15,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 6,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_gloves_10',
    name: 'Золотые Перчатки Скарабея',
    slot: 'gloves',
    icon: '🧤',
    quality: getQualityForLvl(10),
    lvl: 10,
    price: 100,
    maxDurability: 17,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 8,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_gloves_15',
    name: 'Перчатки Золотого Сфинкса',
    slot: 'gloves',
    icon: '🧤',
    quality: getQualityForLvl(15),
    lvl: 15,
    price: 150,
    maxDurability: 20,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 9,
    expBonusPct: 0,
    enabled: true
  },
  {
    id: 'shop_gloves_20',
    name: 'Божественные Наручи Богатства Ра',
    slot: 'gloves',
    icon: '🧤',
    quality: getQualityForLvl(20),
    lvl: 20,
    price: 200,
    maxDurability: 25,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 12,
    expBonusPct: 0,
    enabled: true
  },

  // ==================== 6. КОЛЬЦО (ring) ====================
  // 2 ур. (+1% к опыту), 4 ур. (+2% к опыту), 5 ур. (+3% к опыту), 8 ур. (+4% к опыту), 10 ур. (+6% к опыту), 15 ур. (+10% к опыту), 20 ур. (+15% к опыту)
  {
    id: 'shop_ring_2',
    name: 'Медное Кольцо Ученика',
    slot: 'ring',
    icon: '💍',
    quality: getQualityForLvl(2),
    lvl: 2,
    price: 30,
    maxDurability: 10,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 1,
    enabled: true
  },
  {
    id: 'shop_ring_4',
    name: 'Кольцо Древнего Папируса',
    slot: 'ring',
    icon: '💍',
    quality: getQualityForLvl(4),
    lvl: 4,
    price: 40,
    maxDurability: 10,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 2,
    enabled: true
  },
  {
    id: 'shop_ring_5',
    name: 'Перстень Храма Имхотепа',
    slot: 'ring',
    icon: '💍',
    quality: getQualityForLvl(5),
    lvl: 5,
    price: 50,
    maxDurability: 15,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 3,
    enabled: true
  },
  {
    id: 'shop_ring_8',
    name: 'Кольцо Мудрости Тота',
    slot: 'ring',
    icon: '💍',
    quality: getQualityForLvl(8),
    lvl: 8,
    price: 80,
    maxDurability: 15,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 4,
    enabled: true
  },
  {
    id: 'shop_ring_10',
    name: 'Золотой Перстень Ока Гора',
    slot: 'ring',
    icon: '💍',
    quality: getQualityForLvl(10),
    lvl: 10,
    price: 100,
    maxDurability: 17,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 6,
    enabled: true
  },
  {
    id: 'shop_ring_15',
    name: 'Перстень Тайных Знаний Дуата',
    slot: 'ring',
    icon: '💍',
    quality: getQualityForLvl(15),
    lvl: 15,
    price: 150,
    maxDurability: 20,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 10,
    enabled: true
  },
  {
    id: 'shop_ring_20',
    name: 'Божественное Кольцо Всеведения Ра',
    slot: 'ring',
    icon: '💍',
    quality: getQualityForLvl(20),
    lvl: 20,
    price: 200,
    maxDurability: 25,
    hp: 0,
    dmg: 0,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 15,
    enabled: true
  }
];

export const DEFAULT_CHARACTER_SKINS: CharacterSkinTemplate[] = [
  {
    id: 'skin_nomad_scout',
    name: 'Искатель Барханов',
    icon: '🥷',
    quality: 'common',
    lvl: 1,
    priceGold: 150,
    priceCrystals: 5,
    currency: 'gold',
    hpBonus: 25,
    dmgBonus: 5,
    strBonus: 0,
    agiBonus: 1,
    vitBonus: 1,
    dodgeBonus: 2,
    energyBonus: 10,
    goldBonusPct: 3,
    expBonusPct: 3,
    bagBonus: 5,
    enabled: true
  },
  {
    id: 'skin_anubis_guard',
    name: 'Страж Анубиса',
    icon: '🐺',
    quality: 'rare',
    lvl: 5,
    priceGold: 500,
    priceCrystals: 15,
    currency: 'gold',
    hpBonus: 80,
    dmgBonus: 20,
    strBonus: 2,
    agiBonus: 2,
    vitBonus: 2,
    dodgeBonus: 4,
    energyBonus: 25,
    goldBonusPct: 5,
    expBonusPct: 5,
    bagBonus: 10,
    enabled: true
  },
  {
    id: 'skin_sphinx_mage',
    name: 'Верховный Жрец Сфинкса',
    icon: '🧝‍♂️',
    quality: 'epic',
    lvl: 10,
    priceGold: 1500,
    priceCrystals: 40,
    currency: 'crystals',
    hpBonus: 180,
    dmgBonus: 45,
    strBonus: 4,
    agiBonus: 4,
    vitBonus: 5,
    dodgeBonus: 7,
    energyBonus: 50,
    goldBonusPct: 10,
    expBonusPct: 12,
    bagBonus: 20,
    enabled: true
  },
  {
    id: 'skin_golden_pharaoh_ra',
    name: 'Божественный Фараон Ра',
    icon: '🤴',
    quality: 'legendary',
    lvl: 15,
    priceGold: 5000,
    priceCrystals: 100,
    currency: 'crystals',
    hpBonus: 350,
    dmgBonus: 90,
    strBonus: 8,
    agiBonus: 8,
    vitBonus: 10,
    dodgeBonus: 12,
    energyBonus: 100,
    goldBonusPct: 20,
    expBonusPct: 25,
    bagBonus: 40,
    enabled: true
  }
];

const SHOP_STORAGE_KEY = 'pyramid_shop_catalog_v2';
const FLAGS_STORAGE_KEY = 'pyramid_feature_flags_v2';
const SKINS_STORAGE_KEY = 'pyramid_shop_skins_v1';

let memoryShopCatalog: ShopCatalogItem[] = [];
let memoryFeatureFlags: GlobalFeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
let memoryShopSkins: CharacterSkinTemplate[] | null = null;
const explicitlyDeletedSkinIds = new Set<string>();

function normalizeSkinTemplate(s: any): CharacterSkinTemplate {
  const id = String(s?.id || `skin_${Date.now()}`);
  const isPersonal = Boolean(s?.isPersonal || s?.isExclusive || id.startsWith('skin_17'));
  let rawIcon = String(s?.avatarUrl || s?.icon || '').trim();
  const isImageIcon =
    rawIcon.startsWith('data:image') ||
    rawIcon.startsWith('http://') ||
    rawIcon.startsWith('https://') ||
    rawIcon.startsWith('/') ||
    rawIcon.startsWith('./');

  // If this is a personal skin (or skin_1792752975060_3k49) without an uploaded image URL,
  // ensure it has a real visual character sprite image so it never shows an empty/broken or generic emoji icon in the Collection!
  if (!rawIcon || (isPersonal && !isImageIcon && (rawIcon === '🤴' || rawIcon === '🧙‍♂️'))) {
    rawIcon = PERSONAL_SKIN_DEFAULT_SPRITE_DATA_URL;
  }

  return {
    id,
    name: String(s?.name || 'Скин Персонажа'),
    icon: rawIcon,
    avatarUrl: isImageIcon ? rawIcon : s?.avatarUrl ? String(s.avatarUrl) : rawIcon,
    quality: (s?.quality || 'rare') as ItemQualityKey,
    lvl: Math.max(1, Number(s?.lvl || 1)),
    priceGold: Math.max(0, Number(s?.priceGold ?? s?.price ?? 100)),
    priceCrystals: Math.max(0, Number(s?.priceCrystals ?? 10)),
    currency: s?.currency === 'crystals' ? 'crystals' : 'gold',
    hpBonus: Math.max(0, Number(s?.hpBonus || 0)),
    dmgBonus: Math.max(0, Number(s?.dmgBonus || 0)),
    strBonus: Math.max(0, Number(s?.strBonus || 0)),
    agiBonus: Math.max(0, Number(s?.agiBonus || 0)),
    vitBonus: Math.max(0, Number(s?.vitBonus || 0)),
    dodgeBonus: Math.max(0, Number(s?.dodgeBonus || 0)),
    energyBonus: Math.max(0, Number(s?.energyBonus || 0)),
    goldBonusPct: Math.max(0, Number(s?.goldBonusPct || 0)),
    expBonusPct: Math.max(0, Number(s?.expBonusPct || 0)),
    bagBonus: Math.max(0, Number(s?.bagBonus || 0)),
    isExclusive: Boolean(s?.isExclusive),
    isPersonal: Boolean(s?.isPersonal),
    isTemporary: Boolean(s?.isTemporary),
    durationDays: Math.max(0, Number(s?.durationDays || 0)),
    enabled: s?.enabled !== false
  };
}

/**
 * Merges default skins, currently cached custom/personal skins, and incoming loaded skins
 * so personal skins created for self or individual players are never wiped out by background syncs.
 */
function mergeSkinsWithDefaults(
  loaded: CharacterSkinTemplate[],
  existingInMemory?: CharacterSkinTemplate[] | null
): CharacterSkinTemplate[] {
  const map = new Map<string, CharacterSkinTemplate>();
  DEFAULT_CHARACTER_SKINS.forEach((d) => {
    if (!explicitlyDeletedSkinIds.has(d.id)) {
      map.set(d.id, normalizeSkinTemplate(d));
    }
  });
  if (Array.isArray(existingInMemory)) {
    existingInMemory.forEach((s) => {
      if (s && s.id && !explicitlyDeletedSkinIds.has(s.id)) {
        map.set(s.id, normalizeSkinTemplate({ ...map.get(s.id), ...s }));
      }
    });
  }
  if (Array.isArray(loaded)) {
    loaded.forEach((s) => {
      if (s && s.id && !explicitlyDeletedSkinIds.has(s.id)) {
        map.set(s.id, normalizeSkinTemplate({ ...map.get(s.id), ...s }));
      }
    });
  }
  return Array.from(map.values());
}

export function deleteSkinFromCatalog(skinId: string): CharacterSkinTemplate[] {
  explicitlyDeletedSkinIds.add(skinId);
  const current = getShopSkins().filter((s) => s.id !== skinId);
  memoryShopSkins = current;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SKINS_STORAGE_KEY, JSON.stringify(memoryShopSkins));
    } catch (e) {
      // ignore
    }
  }
  return current;
}

export function registerPlayerOwnedSkinsInMemory(skins?: CharacterSkinTemplate[] | null): void {
  if (!Array.isArray(skins) || skins.length === 0) return;
  const current = getShopSkins();
  let changed = false;
  const map = new Map<string, CharacterSkinTemplate>();
  current.forEach((s) => map.set(s.id, s));
  for (const raw of skins) {
    if (raw && raw.id && !explicitlyDeletedSkinIds.has(raw.id)) {
      const norm = normalizeSkinTemplate(raw);
      if (!map.has(norm.id)) {
        map.set(norm.id, norm);
        changed = true;
      }
    }
  }
  if (changed) {
    memoryShopSkins = Array.from(map.values());
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SKINS_STORAGE_KEY, JSON.stringify(memoryShopSkins));
      } catch (e) {
        // ignore
      }
    }
  }
}

function mergeCatalogWithDefaults(loaded: ShopCatalogItem[]): ShopCatalogItem[] {
  const map = new Map<string, ShopCatalogItem>();
  DEFAULT_SHOP_CATALOG.forEach((d) => map.set(d.id, { ...d }));
  loaded.forEach((item) => {
    if (item && item.id) {
      const merged: ShopCatalogItem = { ...map.get(item.id), ...item };
      if (merged.id === 'shop_weapon_20' || (typeof merged.icon === 'string' && merged.icon.includes('flame_sword'))) {
        merged.icon = '⚔️';
      }
      if (merged.id === 'shop_weapon_2_new' && (!merged.icon || merged.icon === '⚔️')) {
        merged.icon = '/assets/swords/new_sword_lvl2.png';
      }
      map.set(item.id, merged);
    }
  });
  return Array.from(map.values());
}

export function getShopCatalog(): ShopCatalogItem[] {
  if (memoryShopCatalog.length === 0) {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(SHOP_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            memoryShopCatalog = mergeCatalogWithDefaults(parsed);
            return memoryShopCatalog;
          }
        }
      } catch (e) {
        console.warn('Error reading shop catalog from localStorage:', e);
      }
    }
    memoryShopCatalog = DEFAULT_SHOP_CATALOG.map((item) => ({ ...item }));
  }
  return memoryShopCatalog;
}

export function getShopSkins(): CharacterSkinTemplate[] {
  if (memoryShopSkins === null) {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(SKINS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            memoryShopSkins = mergeSkinsWithDefaults(parsed.map(normalizeSkinTemplate), null);
            return memoryShopSkins;
          }
        }
      } catch (e) {
        console.warn('Error reading shop skins from localStorage:', e);
      }
    }
    memoryShopSkins = DEFAULT_CHARACTER_SKINS.map((s) => ({ ...s }));
  }
  return memoryShopSkins;
}

/**
 * Returns skins for public Shop catalog, strictly excluding private/personal/exclusive skins created for self or individual players.
 */
export function getPublicShopSkins(): CharacterSkinTemplate[] {
  return getShopSkins().filter((s) => s.enabled !== false && !s.isExclusive && !s.isPersonal);
}

/**
 * Checks for temporary skins that have passed their expiration timestamp.
 */
export function filterExpiredSkins(
  ownedSkinIds: string[] = [],
  ownedSkinExpirations: Record<string, number> = {}
): { activeIds: string[]; expiredIds: string[] } {
  const now = Date.now();
  const activeIds: string[] = [];
  const expiredIds: string[] = [];
  for (const id of ownedSkinIds) {
    if (!id) continue;
    const exp = ownedSkinExpirations[id];
    if (exp && Number(exp) > 0 && Number(exp) <= now) {
      expiredIds.push(id);
    } else if (!activeIds.includes(id)) {
      activeIds.push(id);
    }
  }
  return { activeIds, expiredIds };
}

/**
 * Resolves ALL non-expired skins owned by a player into full CharacterSkinTemplate objects.
 * Guarantees that every ID in ownedSkinIds is displayed in the Collection and Admin Panel,
 * even if the skin was created as a personal/self skin ("для себя") and is not in the public shop catalog.
 */
export function resolvePlayerOwnedSkins(
  ownedSkinIds?: string[] | null,
  ownedSkinExpirations?: Record<string, number> | null,
  catalogSkins?: CharacterSkinTemplate[] | null,
  playerOwnedSkins?: CharacterSkinTemplate[] | null,
  activeSkinId?: string | null,
  heroAvatar?: string | null
): CharacterSkinTemplate[] {
  const rawIds = Array.isArray(ownedSkinIds) ? ownedSkinIds.filter(Boolean) : [];
  const { activeIds } = filterExpiredSkins(rawIds, ownedSkinExpirations || {});

  // Also include any skin objects stored in playerOwnedSkins whose IDs aren't expired
  const extraSkins = Array.isArray(playerOwnedSkins) ? playerOwnedSkins : [];
  for (const s of extraSkins) {
    if (s && s.id && !activeIds.includes(s.id)) {
      const exp = ownedSkinExpirations?.[s.id];
      if (!exp || Number(exp) <= 0 || Number(exp) > Date.now()) {
        activeIds.push(s.id);
      }
    }
  }

  const lookupMap = new Map<string, CharacterSkinTemplate>();
  DEFAULT_CHARACTER_SKINS.forEach((s) => lookupMap.set(s.id, normalizeSkinTemplate(s)));
  getShopSkins().forEach((s) => lookupMap.set(s.id, normalizeSkinTemplate(s)));
  if (Array.isArray(catalogSkins)) {
    catalogSkins.forEach((s) => {
      if (s && s.id) lookupMap.set(s.id, normalizeSkinTemplate(s));
    });
  }
  extraSkins.forEach((s) => {
    if (s && s.id) lookupMap.set(s.id, normalizeSkinTemplate({ ...lookupMap.get(s.id), ...s }));
  });

  return activeIds.map((id, idx) => {
    const found = lookupMap.get(id);
    if (found) return found;

    // Fallback for personal/custom skin IDs that were created for self before ownedSkins snapshot was stored
    const isCurrentlyActive = activeSkinId === id;
    const hasCustomHeroImage =
      isCurrentlyActive &&
      heroAvatar &&
      (heroAvatar.startsWith('data:image') ||
        heroAvatar.startsWith('http://') ||
        heroAvatar.startsWith('https://'));
    const customAvatar = hasCustomHeroImage
      ? heroAvatar!
      : PERSONAL_SKIN_DEFAULT_SPRITE_DATA_URL;
    const fallbackSkin: CharacterSkinTemplate = {
      id,
      name: idx === 0 ? 'Личный образ Повелителя' : `Личный скин #${idx + 1}`,
      icon: customAvatar,
      avatarUrl: customAvatar,
      quality: 'legendary',
      lvl: 1,
      priceGold: 0,
      priceCrystals: 0,
      currency: 'crystals',
      hpBonus: 150,
      dmgBonus: 35,
      strBonus: 3,
      agiBonus: 3,
      vitBonus: 3,
      dodgeBonus: 5,
      energyBonus: 30,
      goldBonusPct: 10,
      expBonusPct: 10,
      bagBonus: 20,
      isExclusive: true,
      isPersonal: true,
      isTemporary: Boolean(ownedSkinExpirations?.[id] && Number(ownedSkinExpirations[id]) > 0),
      durationDays: 0,
      enabled: true
    };
    return fallbackSkin;
  });
}

export function getFeatureFlags(): GlobalFeatureFlags {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(FLAGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.customDefaultDurability === 25) {
            parsed.customDefaultDurability = 100;
          }
          memoryFeatureFlags = { ...DEFAULT_FEATURE_FLAGS, ...parsed };
        }
      }
    } catch (e) {
      console.warn('Error reading feature flags:', e);
    }
  }
  return memoryFeatureFlags;
}

export async function syncShopAndFlagsFromSupabase(): Promise<{
  catalog: ShopCatalogItem[];
  flags: GlobalFeatureFlags;
  skins: CharacterSkinTemplate[];
}> {
  try {
    const res = await fetch(
      `${SUPABASE_REST_URL}?name=eq.__GLOBAL_SHOP_CONFIG__&select=email`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.email) {
        const parsed = JSON.parse(rows[0].email);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.catalog) && parsed.catalog.length > 0) {
            memoryShopCatalog = mergeCatalogWithDefaults(parsed.catalog);
            if (typeof window !== 'undefined') {
              localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(memoryShopCatalog));
            }
          }
          if (parsed.flags && typeof parsed.flags === 'object') {
            if (parsed.flags.customDefaultDurability === 25) {
              parsed.flags.customDefaultDurability = 100;
            }
            memoryFeatureFlags = { ...DEFAULT_FEATURE_FLAGS, ...parsed.flags };
            if (typeof window !== 'undefined') {
              localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(memoryFeatureFlags));
            }
          }
          if (Array.isArray(parsed.skins)) {
            memoryShopSkins = mergeSkinsWithDefaults(parsed.skins, memoryShopSkins);
            if (typeof window !== 'undefined') {
              localStorage.setItem(SKINS_STORAGE_KEY, JSON.stringify(memoryShopSkins));
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error syncing shop and flags from Supabase:', e);
  }
  return {
    catalog: getShopCatalog(),
    flags: getFeatureFlags(),
    skins: getShopSkins()
  };
}

export async function saveShopAndFlagsToSupabase(
  catalog: ShopCatalogItem[],
  flags: GlobalFeatureFlags,
  skins?: CharacterSkinTemplate[]
): Promise<boolean> {
  memoryShopCatalog = [...catalog];
  memoryFeatureFlags = { ...flags };
  if (Array.isArray(skins)) {
    memoryShopSkins = mergeSkinsWithDefaults(skins, memoryShopSkins);
  } else if (memoryShopSkins === null) {
    memoryShopSkins = getShopSkins();
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(memoryShopCatalog));
      localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(memoryFeatureFlags));
      localStorage.setItem(SKINS_STORAGE_KEY, JSON.stringify(memoryShopSkins));
    } catch (e) {
      console.warn('Error saving shop config locally:', e);
    }
  }

  try {
    const payloadStr = JSON.stringify({
      catalog: memoryShopCatalog,
      flags: memoryFeatureFlags,
      skins: memoryShopSkins,
      updatedAt: Date.now()
    });
    const checkRes = await fetch(
      `${SUPABASE_REST_URL}?name=eq.__GLOBAL_SHOP_CONFIG__&select=id`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const existing = checkRes.ok ? await checkRes.json() : [];
    if (Array.isArray(existing) && existing.length > 0) {
      await fetch(`${SUPABASE_REST_URL}?name=eq.__GLOBAL_SHOP_CONFIG__`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: payloadStr })
      });
    } else {
      await fetch(SUPABASE_REST_URL, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([
          {
            name: '__GLOBAL_SHOP_CONFIG__',
            email: payloadStr,
            password: 'system_shop_config',
            gold: 0,
            crystals: 0,
            is_admin: 0
          }
        ])
      });
    }
    return true;
  } catch (e) {
    console.error('Error saving shop config to Supabase:', e);
    return false;
  }
}

export function formatSkinBonusesText(skin: Partial<CharacterSkinTemplate>): string {
  const parts: string[] = [];
  if (Number(skin.hpBonus) > 0) parts.push(`+${skin.hpBonus} ❤️ HP`);
  if (Number(skin.dmgBonus) > 0) parts.push(`+${skin.dmgBonus} ⚔️ урон`);
  if (Number(skin.strBonus) > 0) parts.push(`+${skin.strBonus} 💪 сила`);
  if (Number(skin.agiBonus) > 0) parts.push(`+${skin.agiBonus} 🤸 ловк.`);
  if (Number(skin.vitBonus) > 0) parts.push(`+${skin.vitBonus} 🩸 живуч.`);
  if (Number(skin.dodgeBonus) > 0) parts.push(`+${skin.dodgeBonus}% 🛡️ уклон.`);
  if (Number(skin.energyBonus) > 0) parts.push(`+${skin.energyBonus} ⚡ энерг.`);
  if (Number(skin.goldBonusPct) > 0) parts.push(`+${skin.goldBonusPct}% 🪙 золота`);
  if (Number(skin.expBonusPct) > 0) parts.push(`+${skin.expBonusPct}% ✨ опыта`);
  if (Number(skin.bagBonus) > 0) parts.push(`+${skin.bagBonus} 🎒 слотов`);
  return parts.join(', ') || 'Без боевых бонусов (декоративный)';
}

export function getActiveSkinBonuses(
  activeSkinId?: string | null,
  skinsList?: CharacterSkinTemplate[],
  playerOwnedSkins?: CharacterSkinTemplate[]
): {
  skin: CharacterSkinTemplate | null;
  hp: number;
  hpBonus: number;
  dmg: number;
  dmgBonus: number;
  str: number;
  strBonus: number;
  agi: number;
  agiBonus: number;
  vit: number;
  vitBonus: number;
  dodgeBonus: number;
  energyBonus: number;
  goldBonusPct: number;
  expBonusPct: number;
  bagBonus: number;
  bagCapacityBonus: number;
} {
  const empty = {
    skin: null,
    hp: 0,
    hpBonus: 0,
    dmg: 0,
    dmgBonus: 0,
    str: 0,
    strBonus: 0,
    agi: 0,
    agiBonus: 0,
    vit: 0,
    vitBonus: 0,
    dodgeBonus: 0,
    energyBonus: 0,
    goldBonusPct: 0,
    expBonusPct: 0,
    bagBonus: 0,
    bagCapacityBonus: 0
  };
  if (!activeSkinId) return empty;
  const list = skinsList || getShopSkins();
  const found =
    list.find((s) => s.id === activeSkinId) ||
    (Array.isArray(playerOwnedSkins) ? playerOwnedSkins.find((s) => s && s.id === activeSkinId) : undefined) ||
    getShopSkins().find((s) => s.id === activeSkinId) ||
    resolvePlayerOwnedSkins([activeSkinId], undefined, list, playerOwnedSkins, activeSkinId)[0];
  if (!found) return empty;
  const hpVal = Math.max(0, Number(found.hpBonus || 0));
  const dmgVal = Math.max(0, Number(found.dmgBonus || 0));
  const strVal = Math.max(0, Number(found.strBonus || 0));
  const agiVal = Math.max(0, Number(found.agiBonus || 0));
  const vitVal = Math.max(0, Number(found.vitBonus || 0));
  const bagVal = Math.max(0, Number(found.bagBonus || 0));

  return {
    skin: found,
    hp: hpVal,
    hpBonus: hpVal,
    dmg: dmgVal,
    dmgBonus: dmgVal,
    str: strVal,
    strBonus: strVal,
    agi: agiVal,
    agiBonus: agiVal,
    vit: vitVal,
    vitBonus: vitVal,
    dodgeBonus: Math.max(0, Number(found.dodgeBonus || 0)),
    energyBonus: Math.max(0, Number(found.energyBonus || 0)),
    goldBonusPct: Math.max(0, Number(found.goldBonusPct || 0)),
    expBonusPct: Math.max(0, Number(found.expBonusPct || 0)),
    bagBonus: bagVal,
    bagCapacityBonus: bagVal
  };
}

export function getPremiumConfig(flags?: Partial<GlobalFeatureFlags> | null) {
  const f = flags || getFeatureFlags();
  const bagB = Math.max(0, Number(f.premiumBagBonus ?? 0));
  return {
    enabled: Boolean(f.premiumEnabled ?? true),
    priceCrystals: Math.max(1, Number(f.premiumPriceCrystals ?? 300)),
    priceGold: Math.max(100, Number(f.premiumPriceGold ?? 30000)),
    currency: (f.premiumCurrency || 'crystals') as 'crystals' | 'gold' | 'both',
    durationHours: Math.max(1, Number(f.premiumDurationHours ?? 24)),
    hpBonus: Math.max(0, Number(f.premiumHpBonus ?? 0)),
    dmgBonus: Math.max(0, Number(f.premiumDmgBonus ?? 0)),
    strBonus: Math.max(0, Number(f.premiumStrBonus ?? 0)),
    agiBonus: Math.max(0, Number(f.premiumAgiBonus ?? 0)),
    vitBonus: Math.max(0, Number(f.premiumVitBonus ?? 0)),
    dodgeBonus: Math.max(0, Number(f.premiumDodgeBonus ?? 0)),
    energyBonus: Math.max(0, Number(f.premiumEnergyBonus ?? 0)),
    goldBonusPct: Math.max(0, Number(f.premiumGoldBonusPct ?? 10)),
    expBonusPct: Math.max(0, Number(f.premiumExpBonusPct ?? 20)),
    bagBonus: bagB,
    bagCapacityBonus: bagB,
    regenMultiplier: Math.max(1, Number(f.premiumRegenMultiplier ?? 2)),
    wheelMultiplier: Math.max(1, Number(f.premiumWheelMultiplier ?? 2)),
    lootBonusPct: Math.max(0, Number(f.premiumLootBonusPct ?? 50)),
    goldWheelEnabled: f.premiumGoldWheelEnabled !== false,
    crownEnabled: f.premiumCrownEnabled !== false
  };
}

export function createGameItemFromShopItem(shopItem: ShopCatalogItem): GameItem {
  const maxDur = Math.max(1, Number(shopItem.maxDurability || 10));
  const rawSlot = String(shopItem.slot || (shopItem as any).type || 'weapon');
  const normalizedSlot: ItemSlot = (rawSlot === 'helmet' ? 'gloves' : rawSlot) as ItemSlot;
  return {
    id: `item_${normalizedSlot}_${shopItem.lvl}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    shopTemplateId: shopItem.id,
    name: shopItem.name,
    slot: normalizedSlot,
    icon: shopItem.icon,
    quality: shopItem.quality,
    lvl: Number(shopItem.lvl || 1),
    dmg: Number(shopItem.dmg || 0),
    hp: Number(shopItem.hp || 0),
    dodgeBonus: Number(shopItem.dodgeBonus || 0),
    energyBonus: Number(shopItem.energyBonus || 0),
    goldBonusPct: Number(shopItem.goldBonusPct || 0),
    expBonusPct: Number(shopItem.expBonusPct || 0),
    price: Number(shopItem.price || 30),
    durability: maxDur,
    maxDurability: maxDur,
    initialMaxDurability: maxDur,
    dmgBonus: Number(shopItem.dmg || 0),
    hpBonus: Number(shopItem.hp || 0),
    rent: null,
    origin: 'Магазин'
  };
}

export function formatItemBonusesText(item: GameItem | ShopCatalogItem): string {
  const parts: string[] = [];
  if (Number(item.hp) > 0) parts.push(`+${item.hp} HP`);
  if (Number(item.dmg) > 0) parts.push(`+${item.dmg} урон`);
  if (Number(item.dodgeBonus) > 0) parts.push(`+${item.dodgeBonus}% уклон.`);
  if (Number(item.energyBonus) > 0) parts.push(`+${item.energyBonus} энерг.`);
  if (Number(item.goldBonusPct) > 0) parts.push(`+${item.goldBonusPct}% золота`);
  if (Number(item.expBonusPct) > 0) parts.push(`+${item.expBonusPct}% опыта`);
  return parts.join(', ') || 'Без бонусов';
}

export function isCustomCreatedItem(item?: Partial<GameItem> | null): boolean {
  if (!item) return false;
  return Boolean(
    item.isCustomCreated ||
      item.quality === 'custom' ||
      String(item.id || '').startsWith('custom_') ||
      String(item.id || '').startsWith('admin_custom_')
  );
}

export function canTransferCustomItem(item?: Partial<GameItem> | null): boolean {
  if (!item) return false;
  if (isCustomCreatedItem(item)) {
    return Boolean(item.transferable);
  }
  return true;
}

export function canAuctionItem(item?: Partial<GameItem> | null): boolean {
  if (!item) return false;
  // Предметы в аренде или на клановом складе нельзя выставлять на аукцион
  if (item.rent || (item as any).isClanRented || (item as any).clanStorageId) {
    return false;
  }
  // Созданное оружие/амуницию нельзя выставлять на аукцион
  if (isCustomCreatedItem(item)) {
    return false;
  }
  return true;
}

export function getItemSellRefund(item: GameItem): {
  gold: number;
  crystals: number;
  currency: 'gold' | 'crystals';
  amount: number;
  percent: number;
  isCustom: boolean;
  label: string;
} {
  if (isCustomCreatedItem(item)) {
    // При продаже своей созданной вещи игрок получает 70% от затрат
    const paidInCrystals =
      item.forgeCurrency === 'crystals' ||
      (!item.forgeCurrency &&
        Number(item.forgeCrystalCost || 0) > 0 &&
        Number(item.forgeGoldCost || 0) === 0);

    if (paidInCrystals && Number(item.forgeCrystalCost || 0) > 0) {
      const crystals = Math.max(1, Math.floor(Number(item.forgeCrystalCost) * 0.7));
      return {
        gold: 0,
        crystals,
        currency: 'crystals',
        amount: crystals,
        percent: 70,
        isCustom: true,
        label: `+${crystals} 💎`
      };
    }

    const spentGold = Number(item.forgeGoldCost || item.price || 100);
    const gold = Math.max(1, Math.floor(spentGold * 0.7));
    return {
      gold,
      crystals: 0,
      currency: 'gold',
      amount: gold,
      percent: 70,
      isCustom: true,
      label: `+${gold} 🪙`
    };
  }

  const basePrice = Number(
    item.price ||
      (item.lvl >= 20
        ? 200
        : item.lvl >= 15
        ? 150
        : item.lvl >= 10
        ? 100
        : item.lvl >= 8
        ? 80
        : item.lvl >= 5
        ? 50
        : item.lvl >= 4
        ? 40
        : 30)
  );
  const gold = Math.max(1, Math.floor(basePrice * 0.3));
  return {
    gold,
    crystals: 0,
    currency: 'gold',
    amount: gold,
    percent: 30,
    isCustom: false,
    label: `+${gold} 🪙`
  };
}

export function getItemSellPrice(item: GameItem): number {
  const refund = getItemSellRefund(item);
  if (refund.gold > 0) return refund.gold;
  const basePrice = Number(item.forgeGoldCost || item.price || 100);
  return Math.max(1, Math.floor(basePrice * (refund.isCustom ? 0.7 : 0.3)));
}

export const REPAIR_COST_GOLD = 10;

export function getItemDefaultMaxDurability(item?: { lvl?: number; maxDurability?: number; isCustomCreated?: boolean; quality?: string; id?: string } | number | null): number {
  if (typeof item === 'number') {
    const lvl = Number(item || 1);
    if (lvl >= 20) return 25;
    if (lvl >= 15) return 20;
    if (lvl >= 10) return 17;
    if (lvl >= 8) return 15;
    if (lvl >= 5) return 15;
    return 10;
  }
  if (item && item.maxDurability && item.maxDurability > 0) {
    return item.maxDurability;
  }
  if (item && isCustomCreatedItem(item as any)) {
    return 100;
  }
  const lvl = Number(item?.lvl || 1);
  if (lvl >= 20) return 25;
  if (lvl >= 15) return 20;
  if (lvl >= 10) return 17;
  if (lvl >= 8) return 15;
  if (lvl >= 5) return 15;
  return 10;
}

export function isItemPermanentlyBroken(item?: { durability?: number; maxDurability?: number; lvl?: number } | null): boolean {
  if (!item) return false;
  const maxDur = Number(item.maxDurability ?? getItemDefaultMaxDurability(item));
  const curDur = Number(item.durability ?? maxDur);
  // Если предмет полностью сломался до прочности 0/1, его больше нельзя надеть или отремонтировать — доступна только продажа.
  return maxDur <= 1 && curDur <= 0;
}

export function canRepairItem(item?: { durability?: number; maxDurability?: number; lvl?: number } | null): boolean {
  if (!item) return false;
  if (isItemPermanentlyBroken(item)) return false;
  const maxDur = Number(item.maxDurability ?? getItemDefaultMaxDurability(item));
  if (maxDur <= 1) return false;
  const curDur = Number(item.durability ?? maxDur);
  return curDur < maxDur;
}

export const getGameFeatureFlags = getFeatureFlags;
export const saveShopAndFeaturesToSupabase = saveShopAndFlagsToSupabase;
export const syncShopAndFeaturesFromSupabase = syncShopAndFlagsFromSupabase;
