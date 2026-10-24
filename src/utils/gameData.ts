import { GameItem, ItemQuality, ItemQualityKey, ItemSlot, MarketLot, FriendEntry, HeroState, EquippedGear, PyramidCell } from '../types/game';
import { pickConfiguredPyramidMob, findMonsterConfigByName } from './monsterConfig';
import { getFeatureFlags } from './shopConfig';
import { EGYPTIAN_SLOT_SVGS, getKillerAchievementInfo } from './egyptianEquipment';

export const QUALITIES: ItemQuality[] = [
  { key: 'common', name: 'Обычное', color: '#94a3b8', mult: 1.0, chance: 0.75 },
  { key: 'rare', name: 'Редкое', color: '#38bdf8', mult: 1.6, chance: 0.20 },
  { key: 'epic', name: 'Эпическое', color: '#c084fc', mult: 2.4, chance: 0.045 },
  { key: 'legendary', name: 'Легендарное', color: '#facc15', mult: 3.8, chance: 0.005 }
];

export interface EgyptianSlotInfo {
  name: string;
  icon: string;
  pools: {
    low: string[];   // Lvl 1-5 (Пирамида 1)
    mid: string[];   // Lvl 6-10 (Пирамида 2)
    high: string[];  // Lvl 11-20 (Пирамида 3)
  };
}

export const EGYPTIAN_SLOTS: Record<ItemSlot, EgyptianSlotInfo> = {
  weapon: {
    name: 'Оружие',
    icon: EGYPTIAN_SLOT_SVGS.weapon,
    pools: {
      low: [
        'Бронзовый Кинжал Себека',
        'Медный Кхопеш Воина',
        'Серп Жреца Осириса',
        'Копьё Стражника Нила'
      ],
      mid: [
        'Клинок Анубиса',
        'Огненный Кхопеш Сета',
        'Посох Хранителя Луксора',
        'Копьё Царицы Хатшепсут'
      ],
      high: [
        'Солнечный Лучезар Ра',
        'Жезл Властителя Дуата',
        'Серп Вечного Суда',
        'Клинок Ока Гора',
        'Астральный Кхопеш Осириса'
      ]
    }
  },
  armor: {
    name: 'Броня',
    icon: EGYPTIAN_SLOT_SVGS.armor,
    pools: {
      low: [
        'Льняное Одеяние Писца',
        'Кожаный Нагрудник Пустынника',
        'Панцирь Песчаного Скарабея',
        'Жилет Охранника Оазиса'
      ],
      mid: [
        'Доспех Воеводы Фив',
        'Освящённый Панцирь Анубиса',
        'Накидка Золотого Фараона',
        'Кираса Пустынной Бури'
      ],
      high: [
        'Солнечная Кираса Ра',
        'Мантия Вечности Осириса',
        'Доспех Небесного Гора',
        'Алтарь Бессмертия Сета'
      ]
    }
  },
  pants: {
    name: 'Штаны',
    icon: EGYPTIAN_SLOT_SVGS.pants,
    pools: {
      low: [
        'Шенти Новичка Луксора',
        'Полотно Песчаного Путника',
        'Шенти Стражника Нила'
      ],
      mid: [
        'Шёлковые Поножи Вельможи',
        'Шенти Верховного Жреца',
        'Поножи Бури Сета'
      ],
      high: [
        'Царские Одеяния Рамзеса',
        'Поножи Повелителя Песков',
        'Золотые Шенти Нефертити',
        'Поножи Солнечного Триумфа'
      ]
    }
  },
  boots: {
    name: 'Сапоги',
    icon: EGYPTIAN_SLOT_SVGS.boots,
    pools: {
      low: [
        'Сандалии Пустынника',
        'Кожаные Походные Башмаки',
        'Сандалии Ремесленника Мемфиса'
      ],
      mid: [
        'Сандалии Быстроногого Шакала',
        'Сапоги Храмового Стража',
        'Озолоченные Сандалии Вельможи'
      ],
      high: [
        'Сандалии Небесного Полёта Гора',
        'Поступь Владыки Ра',
        'Башмаки Загробного Странника'
      ]
    }
  },
  gloves: {
    name: 'Перчатки',
    icon: EGYPTIAN_SLOT_SVGS.gloves,
    pools: {
      low: [
        'Обмотки Бальзамировщика',
        'Кожаные Наручи Лучника',
        'Перчатки Пустынного Следопыта'
      ],
      mid: [
        'Золотые Браслеты Нефертити',
        'Наручи Защитника Гробниц',
        'Перчатки Судьи Осириса'
      ],
      high: [
        'Длани Солнечного Света Ра',
        'Перчатки Повелителя Душ',
        'Рукавицы Титана Амона'
      ]
    }
  },
  ring: {
    name: 'Кольцо',
    icon: EGYPTIAN_SLOT_SVGS.ring,
    pools: {
      low: [
        'Медное Кольцо Нила',
        'Печатка Скарабея Удачи',
        'Амулет Пустынного Ветра'
      ],
      mid: [
        'Перстень Анубиса',
        'Око Гора Защитное',
        'Печатка Золотого Фараона'
      ],
      high: [
        'Око Ра Испепеляющее',
        'Перстень Бессмертия Дуата',
        'Кольцо Владыки Солнца'
      ]
    }
  }
};

// Backwards compatibility alias
export const SLOT_INFO: Record<ItemSlot, { name: string; icon: string; pool: string[] }> = {
  weapon: { name: EGYPTIAN_SLOTS.weapon.name, icon: EGYPTIAN_SLOTS.weapon.icon, pool: [...EGYPTIAN_SLOTS.weapon.pools.low, ...EGYPTIAN_SLOTS.weapon.pools.mid] },
  armor: { name: EGYPTIAN_SLOTS.armor.name, icon: EGYPTIAN_SLOTS.armor.icon, pool: [...EGYPTIAN_SLOTS.armor.pools.low, ...EGYPTIAN_SLOTS.armor.pools.mid] },
  pants: { name: EGYPTIAN_SLOTS.pants.name, icon: EGYPTIAN_SLOTS.pants.icon, pool: [...EGYPTIAN_SLOTS.pants.pools.low, ...EGYPTIAN_SLOTS.pants.pools.mid] },
  boots: { name: EGYPTIAN_SLOTS.boots.name, icon: EGYPTIAN_SLOTS.boots.icon, pool: [...EGYPTIAN_SLOTS.boots.pools.low, ...EGYPTIAN_SLOTS.boots.pools.mid] },
  gloves: { name: EGYPTIAN_SLOTS.gloves.name, icon: EGYPTIAN_SLOTS.gloves.icon, pool: [...EGYPTIAN_SLOTS.gloves.pools.low, ...EGYPTIAN_SLOTS.gloves.pools.mid] },
  ring: { name: EGYPTIAN_SLOTS.ring.name, icon: EGYPTIAN_SLOTS.ring.icon, pool: [...EGYPTIAN_SLOTS.ring.pools.low, ...EGYPTIAN_SLOTS.ring.pools.mid] }
};

import {
  getShopCatalog,
  createGameItemFromShopItem,
  DEFAULT_SHOP_CATALOG,
  getActiveSkinBonuses,
  getPremiumConfig
} from './shopConfig';

export const MAX_LEVEL = 20;

// 2. Уровни персонажа и опыт для перехода
export const EXP_TABLE: Record<number, number> = {
  1: 1000,      // С 1 уровня до 2 — 1,000 опыта
  2: 2500,      // 3 уровень — 2,500 опыта
  3: 5000,      // 4 уровень — 5,000 опыта
  4: 7500,      // 5 уровень — 7,500 опыта
  5: 13500,     // 6 уровень — 13,500 опыта
  6: 22000,     // 7 уровень — 22,000 опыта
  7: 35000,     // 8 уровень — 35,000 опыта
  8: 50000,     // 9 уровень — 50,000 опыта
  9: 75000,     // 10 уровень — 75,000 опыта
  10: 105000,   // 11 уровень — 105,000 опыта
  11: 145000,   // 12 уровень — 145,000 опыта
  12: 190000,   // 13 уровень — 190,000 опыта
  13: 253000,   // 14 уровень — 253,000 опыта
  14: 350000,   // 15 уровень — 350,000 опыта
  15: 500000,   // 16 уровень — 500,000 опыта
  16: 750000,   // 17 уровень — 750,000 опыта
  17: 1000000,  // 18 уровень — 1,000,000 опыта
  18: 1500000,  // 19 уровень — 1,500,000 опыта
  19: 2000000   // 20 уровень — 2,000,000 опыта
};

// 3. Награды за уровень
export const LEVEL_UP_REWARDS: Record<number, { gold: number; crystals: number; statPoints: number }> = {
  2: { gold: 30, crystals: 10, statPoints: 1 },
  3: { gold: 50, crystals: 10, statPoints: 1 },
  4: { gold: 100, crystals: 25, statPoints: 1 },
  5: { gold: 200, crystals: 15, statPoints: 1 },
  6: { gold: 250, crystals: 15, statPoints: 1 },
  7: { gold: 300, crystals: 15, statPoints: 1 },
  8: { gold: 350, crystals: 15, statPoints: 1 },
  9: { gold: 400, crystals: 40, statPoints: 1 },
  10: { gold: 500, crystals: 20, statPoints: 1 },
  11: { gold: 700, crystals: 20, statPoints: 1 },
  12: { gold: 800, crystals: 20, statPoints: 1 },
  13: { gold: 900, crystals: 20, statPoints: 1 },
  14: { gold: 800, crystals: 20, statPoints: 1 },
  15: { gold: 1500, crystals: 60, statPoints: 1 },
  16: { gold: 1000, crystals: 50, statPoints: 1 },
  17: { gold: 2000, crystals: 50, statPoints: 1 },
  18: { gold: 3000, crystals: 50, statPoints: 1 },
  19: { gold: 5000, crystals: 50, statPoints: 1 },
  20: { gold: 9000, crystals: 500, statPoints: 1 }
};

export function recalculateLevelAndExpFromTotal(totalExp: number): { level: number; exp: number } {
  let remExp = Math.max(0, Math.floor(Number(totalExp) || 0));
  let level = 1;
  while (level < MAX_LEVEL && remExp >= (EXP_TABLE[level] || 9999999)) {
    remExp -= EXP_TABLE[level] || 9999999;
    level += 1;
  }
  return {
    level: Math.min(MAX_LEVEL, level),
    exp: Math.max(0, remExp)
  };
}

export function getLevelForExp(totalExp: number): number {
  return recalculateLevelAndExpFromTotal(totalExp).level;
}

export function getTotalAccumulatedExp(level: number, currentExp: number): number {
  const lvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
  const exp = Math.max(0, Math.floor(Number(currentExp) || 0));
  let sum = exp;
  for (let l = 1; l < lvl; l++) {
    sum += EXP_TABLE[l] || 0;
  }
  return sum;
}

/**
 * Ensures character stats (str, agi, vit, statPoints) strictly match the character's level:
 * At level 1: str=1, agi=1, vit=1, statPoints=0 (0 bonus points).
 * At level L: (str - 1) + (agi - 1) + (vit - 1) + statPoints === L - 1.
 * Automatically subtracts excess points when level decreases, or adds statPoints when level increases.
 */
export function normalizeStatsForLevel(
  level: number,
  rawStr: number,
  rawAgi: number,
  rawVit: number,
  rawStatPoints: number
): { str: number; agi: number; vit: number; statPoints: number } {
  const lvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
  let str = Math.max(1, Math.floor(Number(rawStr) || 1));
  let agi = Math.max(1, Math.floor(Number(rawAgi) || 1));
  let vit = Math.max(1, Math.floor(Number(rawVit) || 1));
  let statPoints = Math.max(0, Math.floor(Number(rawStatPoints) || 0));

  const allowedTotalPoints = Math.max(0, lvl - 1);
  const currentTotalPoints = (str - 1) + (agi - 1) + (vit - 1) + statPoints;

  if (currentTotalPoints > allowedTotalPoints) {
    let excess = currentTotalPoints - allowedTotalPoints;
    const takeSp = Math.min(statPoints, excess);
    statPoints -= takeSp;
    excess -= takeSp;

    while (excess > 0 && (str > 1 || agi > 1 || vit > 1)) {
      if (str >= agi && str >= vit && str > 1) {
        str -= 1;
        excess -= 1;
      } else if (agi >= str && agi >= vit && agi > 1) {
        agi -= 1;
        excess -= 1;
      } else if (vit > 1) {
        vit -= 1;
        excess -= 1;
      } else {
        break;
      }
    }
  } else if (currentTotalPoints < allowedTotalPoints) {
    statPoints += allowedTotalPoints - currentTotalPoints;
  }

  return { str, agi, vit, statPoints };
}

// 4. Формулы статов и энергии:
// Сила (1): бонус к урону +15 урон (+10 за очко)
export function getHeroDamageFromStr(str?: number): number {
  const s = Math.max(1, Number(str) || 1);
  return 15 + (s - 1) * 10;
}

// Ловкость (1): шанс уклонения 10% (+1% за очко)
export function getHeroDodgeFromAgi(agi?: number): number {
  const a = Math.max(1, Number(agi) || 1);
  return 10 + (a - 1) * 1;
}

// Мудрость (1): 250 HP (+50 за очко)
export function getHeroMaxHpFromVit(vit?: number): number {
  const v = Math.max(1, Number(vit) || 1);
  return 250 + (v - 1) * 50;
}

export function getHeroTotalDamage(hero: HeroState): number {
  const effStr = Math.max(1, Number(hero.str || 1) + Number(hero.gearStr || 0));
  return getHeroDamageFromStr(effStr) + Number(hero.gearDmg || 0) + Number(hero.bonusDmg || 0);
}

export function getHeroTotalDodge(hero: HeroState): number {
  const effAgi = Math.max(1, Number(hero.agi || 1) + Number(hero.gearAgi || 0));
  return Math.min(75, getHeroDodgeFromAgi(effAgi) + Number(hero.gearDodge || 0));
}

export function getHeroTotalMaxHp(hero: HeroState, gearHpOverride?: number): number {
  const gHp = gearHpOverride !== undefined ? gearHpOverride : Number(hero.gearHp || 0);
  const effVit =
    gearHpOverride !== undefined
      ? Math.max(1, Number(hero.vit || 1))
      : Math.max(1, Number(hero.vit || 1) + Number(hero.gearVit || 0));
  const killerHpBonus = getKillerAchievementInfo(hero.pvpKills ?? (hero as any).pvp_kills ?? 0).totalHpBonus;
  return getHeroMaxHpFromVit(effVit) + gHp + Number(hero.bonusHp || 0) + killerHpBonus;
}

export function getHeroTotalMaxEnergy(hero: HeroState, gearEnergyOverride?: number): number {
  const gEn = gearEnergyOverride !== undefined ? gearEnergyOverride : Number(hero.gearEnergy || 0);
  return 100 + gEn;
}

export function calculateHeroStatsBreakdown(hero: any, equippedOverride?: any) {
  const eq = equippedOverride || hero?.equipped || hero?.equipment || null;
  let gearHp = 0;
  let gearDmg = 0;
  let gearDodge = 0;
  let gearEnergy = 0;
  let gearGoldPct = 0;
  let gearExpPct = 0;
  let gearStr = 0;
  let gearAgi = 0;
  let gearVit = 0;

  if (eq && typeof eq === 'object') {
    Object.values(eq).forEach((rawItem: any) => {
      if (!rawItem) return;
      const curDur = rawItem.durability !== undefined ? Number(rawItem.durability) : 1;
      if (curDur <= 0) return;
      const s = getItemStats(rawItem);
      gearHp += s.hp;
      gearDmg += s.dmg;
      gearDodge += s.dodgeBonus;
      gearEnergy += s.energyBonus;
      gearGoldPct += s.goldBonusPct;
      gearExpPct += s.expBonusPct;
      gearStr += s.str;
      gearAgi += s.agi;
      gearVit += s.vit;
    });

    // Also include active skin bonuses and active VIP bonuses when computing from raw equipped object
    const skinBonuses = getActiveSkinBonuses(hero?.activeSkinId, undefined, hero?.ownedSkins ?? hero?.owned_skins);
    gearHp += Number(skinBonuses.hpBonus || skinBonuses.hp || 0);
    gearDmg += Number(skinBonuses.dmgBonus || skinBonuses.dmg || 0);
    gearDodge += Number(skinBonuses.dodgeBonus || 0);
    gearEnergy += Number(skinBonuses.energyBonus || 0);
    gearGoldPct += Number(skinBonuses.goldBonusPct || 0);
    gearExpPct += Number(skinBonuses.expBonusPct || 0);
    gearStr += Number(skinBonuses.strBonus || skinBonuses.str || 0);
    gearAgi += Number(skinBonuses.agiBonus || skinBonuses.agi || 0);
    gearVit += Number(skinBonuses.vitBonus || skinBonuses.vit || 0);

    const premCfg = getPremiumConfig();
    const isVip = Boolean(
      premCfg.enabled &&
        hero?.isPremium &&
        hero?.premiumUntil &&
        Number(hero.premiumUntil) > Date.now()
    );
    if (isVip) {
      gearHp += Number(premCfg.hpBonus || 0);
      gearDmg += Number(premCfg.dmgBonus || 0);
      gearDodge += Number(premCfg.dodgeBonus || 0);
      gearEnergy += Number(premCfg.energyBonus || 0);
      gearGoldPct += Number(premCfg.goldBonusPct || 0);
      gearExpPct += Number(premCfg.expBonusPct || 0);
      gearStr += Number(premCfg.strBonus || 0);
      gearAgi += Number(premCfg.agiBonus || 0);
      gearVit += Number(premCfg.vitBonus || 0);
    }
  } else {
    gearHp = Number(hero?.gearHp || 0);
    gearDmg = Number(hero?.gearDmg || 0);
    gearDodge = Number(hero?.gearDodge || 0);
    gearEnergy = Number(hero?.gearEnergy || 0);
    gearGoldPct = Number(hero?.gearGoldPct || 0);
    gearExpPct = Number(hero?.gearExpPct || 0);
    gearStr = Number(hero?.gearStr || 0);
    gearAgi = Number(hero?.gearAgi || 0);
    gearVit = Number(hero?.gearVit || 0);
  }

  const strPoints = Math.max(1, Number(hero?.str) || 1) + gearStr;
  const agiPoints = Math.max(1, Number(hero?.agi) || 1) + gearAgi;
  const vitPoints = Math.max(1, Number(hero?.vit) || 1) + gearVit;

  const strDamage = getHeroDamageFromStr(strPoints);
  const baseDodgePct = getHeroDodgeFromAgi(agiPoints);
  const baseHp = getHeroMaxHpFromVit(vitPoints);
  const killerInfo = getKillerAchievementInfo(hero?.pvpKills ?? hero?.pvp_kills ?? 0);
  const killerHpBonus = killerInfo.totalHpBonus;

  const totalDmg = Math.max(1, Math.round(Number(strDamage || 0) + Number(gearDmg || 0) + Number(hero?.bonusDmg || 0)));
  const totalMaxHp = Math.max(10, Math.round(Number(baseHp || 100) + Number(gearHp || 0) + Number(hero?.bonusHp || 0) + killerHpBonus));
  const totalDodgePct = Math.min(75, Math.max(0, Math.round(Number(baseDodgePct || 0) + Number(gearDodge || 0))));
  const totalMaxEnergy = Math.max(50, Math.round(100 + Number(gearEnergy || 0)));

  return {
    strPoints,
    agiPoints,
    vitPoints,
    strDamage,
    baseDodgePct,
    baseHp,
    gearHp,
    gearDmg,
    gearDodge,
    gearEnergy,
    gearGoldPct,
    gearExpPct,
    killerAchievementLevel: killerInfo.level,
    killerAchievementLvl: killerInfo.level,
    killerHpBonus,
    totalDmg,
    totalMaxHp,
    totalDodgePct,
    totalMaxEnergy
  };
}

export function getQualityConfig(key: ItemQualityKey): ItemQuality {
  if (key === 'custom') {
    return { key: 'custom', name: 'Кастомный', color: '#ef4444', mult: 4.5, chance: 0 };
  }
  return QUALITIES.find((q) => q.key === key) || QUALITIES[0];
}

export function getItemStats(item: GameItem) {
  return {
    dmg: Math.round(item.dmg || 0),
    hp: Math.round(item.hp || 0),
    dodgeBonus: Math.round(item.dodgeBonus || 0),
    energyBonus: Math.round(item.energyBonus || 0),
    goldBonusPct: Math.round(item.goldBonusPct || 0),
    expBonusPct: Math.round(item.expBonusPct || 0),
    str: Math.round(item.str || 0),
    agi: Math.round(item.agi || 0),
    vit: Math.round(item.vit || 0)
  };
}

export function rollQuality(isBoss = false): ItemQuality {
  const r = Math.random();
  if (isBoss) {
    if (r < 0.15) return QUALITIES[3];
    if (r < 0.50) return QUALITIES[2];
    return QUALITIES[1];
  }

  let acc = 0;
  for (const q of QUALITIES) {
    acc += q.chance;
    if (r <= acc) return q;
  }
  return QUALITIES[0];
}

export function generateItem(
  level: number,
  isBoss = false,
  customSlot?: ItemSlot,
  forcedQualityKey?: ItemQualityKey
): GameItem {
  const slots: ItemSlot[] = ['weapon', 'armor', 'pants', 'boots', 'gloves', 'ring'];
  const slot = customSlot || slots[Math.floor(Math.random() * slots.length)];

  // Snap to canonical item tiers: 2, 4, 5, 8, 10, 15, 20
  const canonicalLevels = [2, 4, 5, 8, 10, 15, 20];
  const targetLvl = canonicalLevels.reduce((prev, curr) =>
    Math.abs(curr - level) < Math.abs(prev - level) ? curr : prev
  );

  const catalog = getShopCatalog();
  const matchingTemplate =
    catalog.find((c) => c.slot === slot && c.lvl === targetLvl && c.enabled) ||
    DEFAULT_SHOP_CATALOG.find((c) => c.slot === slot && c.lvl === targetLvl) ||
    DEFAULT_SHOP_CATALOG[0];

  const item = createGameItemFromShopItem(matchingTemplate);
  if (forcedQualityKey) {
    item.quality = forcedQualityKey;
  }
  item.origin = isBoss ? `Босс ${targetLvl} ур.` : `Монстр ${targetLvl} ур.`;
  return item;
}

export function getPyramidTierForLevel(level: number): 1 | 2 | 3 {
  const lvl = Math.max(1, Number(level) || 1);
  if (lvl <= 5) return 1;
  if (lvl <= 10) return 2;
  return 3;
}

export function getRouletteResetInfo(nowMs: number = Date.now()) {
  const now = new Date(nowMs);
  const today0001 = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    1,
    0,
    0
  ).getTime();
  let lastReset0001 = today0001;
  if (nowMs < today0001) {
    lastReset0001 -= 24 * 60 * 60 * 1000;
  }
  const nextReset0001 = lastReset0001 + 24 * 60 * 60 * 1000;
  const resetDateObj = new Date(lastReset0001);
  const todayKey = `${resetDateObj.getFullYear()}-${String(
    resetDateObj.getMonth() + 1
  ).padStart(2, '0')}-${String(resetDateObj.getDate()).padStart(2, '0')}`;

  return {
    lastReset0001,
    nextReset0001,
    todayKey
  };
}

export function getPyramidName(tier: number): string {
  const safeTier = Math.max(1, Math.min(3, Number(tier) || 1));
  if (safeTier === 1) return 'Пирамида 1: Усыпальница Хеопса (1–5 ур.)';
  if (safeTier === 2) return 'Пирамида 2: Храм Анубиса (5–10 ур.)';
  return 'Пирамида 3: Запретный Чертог Ра (10–20 ур.)';
}

export interface MobTemplate {
  name: string;
  lvl: number;
  hp: number;
  dmg: number;
  icon: string;
  isBoss: boolean;
}

/**
 * 1. Баланс пирамид, монстров и боссов:
 * Пирамида 1 (1–5 ур.):
 *   - Монстр 2 ур. — ХП 100, урон 20, опыт 5, 6 золота
 *   - Монстр 4 ур. — ХП 150, урон 30, опыт 10, 7 золота
 *   - Босс — ХП 500, урон 80, опыт 15, 20 золота
 * Пирамида 2 (5–10 ур.):
 *   - Монстр 5 ур. — ХП 400, урон 40, опыт 35, 15 золота
 *   - Монстр 8 ур. — ХП 650, урон 50, опыт 45, 20 золота
 *   - Босс — ХП 1000, урон 150, опыт 250, 200 золота
 * Пирамида 3 (10–20 ур.):
 *   - Монстр 10 ур. — ХП 800, урон 70, опыт 60, 25 золота
 *   - Монстр 15 ур. — ХП 1000, урон 100, опыт 100, 30 золота
 *   - Босс — ХП 2000, урон 250, опыт 200, 200 золота
 */
export function getPyramidMob(
  tier: number,
  row: number,
  isBoss: boolean,
  deterministicRand?: number,
  deterministicRand2?: number
): MobTemplate {
  const r1 = deterministicRand !== undefined ? Math.abs(deterministicRand) % 1 : 0.35;
  const r2 = deterministicRand2 !== undefined ? Math.abs(deterministicRand2) % 1 : (r1 * 7.13) % 1;

  const configured = pickConfiguredPyramidMob(tier, row, isBoss, r1, r2);
  if (configured) {
    return {
      name: configured.name,
      lvl: configured.lvl,
      hp: Math.max(1, Number(configured.hp || 100)),
      dmg: Math.max(1, Number(configured.dmg || 20)),
      icon: configured.icon || '👹',
      isBoss: Boolean(configured.isBoss)
    };
  }

  if (tier === 1) {
    if (isBoss) {
      return {
        name: '👑 Жрец Имхотеп (Босс)',
        lvl: 5,
        hp: 500,
        dmg: 80,
        icon: '👑',
        isBoss: true
      };
    }
    if (row <= 4) {
      return {
        name: r1 < 0.5 ? '🐍 Пустынная Гадюка' : '🧟 Древняя Мумия',
        lvl: 4,
        hp: 150,
        dmg: 30,
        icon: r1 < 0.5 ? '🐍' : '🧟',
        isBoss: false
      };
    }
    return {
      name: r1 < 0.5 ? '🦂 Песчаный Скорпион' : '🪲 Золотой Скарабей',
      lvl: 2,
      hp: 100,
      dmg: 20,
      icon: r1 < 0.5 ? '🦂' : '🪲',
      isBoss: false
    };
  }

  if (tier === 2) {
    if (isBoss) {
      return {
        name: '🐺 Великий Анубис (Босс)',
        lvl: 10,
        hp: 1000,
        dmg: 150,
        icon: '🐺',
        isBoss: true
      };
    }
    if (row <= 4) {
      return {
        name: r1 < 0.5 ? '🗿 Гранитный Страж Гробницы' : '🐊 Свирепый Воин Собека',
        lvl: 8,
        hp: 650,
        dmg: 50,
        icon: r1 < 0.5 ? '🗿' : '🐊',
        isBoss: false
      };
    }
    return {
      name: r1 < 0.5 ? '🐺 Шакал Анубиса' : '🧟 Ожившая Мумия Воина',
      lvl: 5,
      hp: 400,
      dmg: 40,
      icon: r1 < 0.5 ? '🐺' : '🧟',
      isBoss: false
    };
  }

  // Tier 3
  if (isBoss) {
    return {
      name: '🐉 Божественный Фараон Рамзес (Босс)',
      lvl: 20,
      hp: 2000,
      dmg: 250,
      icon: '🐉',
      isBoss: true
    };
  }

  if (row <= 4) {
    return {
      name: r1 < 0.5 ? '🦁 Крылатый Сфинкс Вечности' : '🔥 Огненный Колосс Ра',
      lvl: 15,
      hp: 1000,
      dmg: 100,
      icon: r1 < 0.5 ? '🦁' : '🔥',
      isBoss: false
    };
  }

  return {
    name: r1 < 0.5 ? '💀 Песчаный Демон Дуата' : '🔮 Хранитель Книги Мертвых',
    lvl: 10,
    hp: 800,
    dmg: 70,
    icon: r1 < 0.5 ? '💀' : '🔮',
    isBoss: false
  };
}

export function getCanonicalMobMaxHp(
  mobLvl?: number,
  isBoss?: boolean,
  _rareBossId?: string,
  mobName?: string
): number | null {
  const cfg = findMonsterConfigByName(mobName, mobLvl, isBoss);
  if (cfg && Number(cfg.hp) > 0) {
    return Math.max(1, Number(cfg.hp));
  }
  const lvl = Number(mobLvl || 2);
  if (isBoss) {
    if (lvl <= 5) return 500;
    if (lvl <= 10) return 1000;
    return 2000;
  }
  if (lvl <= 2) return 100;
  if (lvl <= 4) return 150;
  if (lvl <= 5) return 400;
  if (lvl <= 8) return 650;
  if (lvl <= 10) return 800;
  return 1000;
}

export function getCanonicalMobDamage(
  mobLvl?: number,
  isBoss?: boolean,
  mobName?: string
): number {
  const cfg = findMonsterConfigByName(mobName, mobLvl, isBoss);
  if (cfg && Number(cfg.dmg) > 0) {
    return Math.max(1, Number(cfg.dmg));
  }
  const lvl = Number(mobLvl || 2);
  if (isBoss) {
    if (lvl <= 5) return 80;
    if (lvl <= 10) return 150;
    return 250;
  }
  if (lvl <= 2) return 20;
  if (lvl <= 4) return 30;
  if (lvl <= 5) return 40;
  if (lvl <= 8) return 50;
  if (lvl <= 10) return 70;
  return 100;
}

export function getCanonicalMobRewards(
  mobLvl?: number,
  isBoss?: boolean,
  mobName?: string
): { exp: number; gold: number; crystals: number; dropChance: number } {
  const cfg = findMonsterConfigByName(mobName, mobLvl, isBoss);
  if (cfg) {
    const gMin = Math.max(0, Number(cfg.goldMin || 0));
    const gMax = Math.max(gMin, Number(cfg.goldMax || gMin));
    const gold = gMax > gMin ? Math.floor(gMin + Math.random() * (gMax - gMin + 1)) : gMin;
    return {
      exp: Math.max(1, Number(cfg.expReward || 5)),
      gold,
      crystals: Math.max(0, Number(cfg.crystalsReward || 0)),
      dropChance: Math.max(0, Math.min(100, Number(cfg.dropChance ?? 12)))
    };
  }
  const lvl = Number(mobLvl || 2);
  if (isBoss) {
    if (lvl <= 5) return { exp: 15, gold: 20, crystals: 0, dropChance: 25 };
    if (lvl <= 10) return { exp: 250, gold: 200, crystals: 0, dropChance: 30 };
    return { exp: 200, gold: 200, crystals: 0, dropChance: 35 };
  }
  if (lvl <= 2) return { exp: 5, gold: 6, crystals: 0, dropChance: 10 };
  if (lvl <= 4) return { exp: 10, gold: 7, crystals: 0, dropChance: 12 };
  if (lvl <= 5) return { exp: 35, gold: 15, crystals: 0, dropChance: 12 };
  if (lvl <= 8) return { exp: 45, gold: 20, crystals: 0, dropChance: 15 };
  if (lvl <= 10) return { exp: 60, gold: 25, crystals: 0, dropChance: 15 };
  return { exp: 100, gold: 30, crystals: 0, dropChance: 18 };
}

export const PYRAMID_EXIT_POS = { row: 9, col: 0 };
export const PYRAMID_SPAWN_POS = { row: 9, col: 1 };
export const PYRAMID_EXIT_SPAWN_POS = PYRAMID_SPAWN_POS;

export function sanitizePyramidCellsForStorage(map: PyramidCell[][]): PyramidCell[][] {
  if (!Array.isArray(map)) return [];
  const rowsCount = map.length || 10;
  const topCell = map[0]?.[0];
  const apexBossCurrentlyAlive = Boolean(topCell && topCell.type === 'mob' && topCell.isBoss && !topCell.rareBossId);
  let portalSeen = false;

  return map.map((row, rI) =>
    Array.isArray(row)
      ? row.map((cell, cI) => {
          if (rI === rowsCount - 1 && cI === 0) {
            return { type: 'exit' };
          }
          if (rI === rowsCount - 1 && cI === 1) {
            return { type: 'empty' };
          }
          if (!cell || typeof cell !== 'object') return { type: 'empty' };
          if (cell.rareBossId && cell.rareBossId !== 'crystal') {
            return { type: 'empty' };
          }
          let cleanType = cell.type === 'player' || cell.type === 'exit' ? 'empty' : cell.type;
          if (cleanType === 'nextTier' || cleanType === 'portal') {
            if (apexBossCurrentlyAlive || portalSeen) {
              cleanType = 'empty';
            } else {
              portalSeen = true;
            }
          }
          const cleaned: PyramidCell = { type: cleanType };
          if (cleanType === 'mob') {
            const isApexCell = rI === 0 && cI === 0;
            // Строго 1 босс в пирамиде (на вершине [0,0], который открывает портал):
            // если на обычной клетке остался босс со старой генерации, заменяем его на обычного монстра этого яруса
            if (!isApexCell && cell.isBoss && !cell.rareBossId) {
              const rawLvl = Number(cell.mobLvl || 5);
              const inferredTier = rawLvl <= 5 ? 1 : rawLvl <= 10 ? 2 : 3;
              const regMob = getPyramidMob(
                inferredTier,
                rI,
                false,
                ((rI * 37 + cI * 13) % 100) / 100,
                ((rI * 19 + cI * 43) % 100) / 100
              );
              cleaned.mobLvl = regMob.lvl;
              cleaned.mobHp = regMob.hp;
              cleaned.mobMaxHp = regMob.hp;
              cleaned.mobDmg = regMob.dmg;
              cleaned.isBoss = false;
              cleaned.mobName = regMob.name;
              cleaned.icon = regMob.icon;
              return cleaned;
            }

            // Normalize legacy monster levels (3 -> 2 or 4, 13 -> 10, 17 -> 15)
            let normLvl = Number(cell.mobLvl || 2);
            if (!cell.isBoss && !cell.rareBossId) {
              if (normLvl === 3) normLvl = rI <= 4 ? 4 : 2;
              else if (normLvl === 13) normLvl = 10;
              else if (normLvl === 17) normLvl = 15;
            }
            cleaned.mobLvl = normLvl;
            const effectiveIsBoss = Boolean(isApexCell && cell.isBoss);
            const canonicalMax = getCanonicalMobMaxHp(
              normLvl,
              effectiveIsBoss,
              cell.rareBossId,
              cell.mobName
            );
            const canonicalDmg = getCanonicalMobDamage(
              normLvl,
              effectiveIsBoss,
              cell.mobName
            );
            const oldMax = Number(cell.mobMaxHp || canonicalMax || 100);
            const oldHp = Number(cell.mobHp ?? oldMax);
            if (canonicalMax !== null && oldMax > 0 && oldMax !== canonicalMax) {
              const ratio = Math.min(1, Math.max(0, oldHp / oldMax));
              cleaned.mobMaxHp = canonicalMax;
              cleaned.mobHp = oldHp >= oldMax ? canonicalMax : Math.max(1, Math.round(canonicalMax * ratio));
            } else {
              cleaned.mobHp = cell.mobHp ?? canonicalMax ?? 100;
              cleaned.mobMaxHp = cell.mobMaxHp ?? canonicalMax ?? 100;
            }
            cleaned.mobDmg = cell.mobDmg || canonicalDmg;
            cleaned.isBoss = effectiveIsBoss;
            if (cell.rareBossId) cleaned.rareBossId = cell.rareBossId;
            cleaned.mobName = cell.mobName;
            cleaned.icon = cell.icon;
          } else if (cleanType === 'sack') {
            cleaned.sackGold = cell.sackGold ?? 5;
            if (cell.sackCrystals) cleaned.sackCrystals = cell.sackCrystals;
            if (cell.rareBossId) cleaned.rareBossId = cell.rareBossId;
            if (cell.mobName) cleaned.mobName = cell.mobName;
            if (cell.icon) cleaned.icon = cell.icon;
          }
          return cleaned;
        })
      : []
  );
}

/**
 * Returns all free empty cells on the pyramid map where a monster or rare boss is allowed to spawn:
 * - cell.type === 'empty'
 * - no player (online or offline) is standing on the cell
 * - not the exit cell (rowsCount - 1, 0)
 * - not the spawn cell next to exit (rowsCount - 1, 1)
 * - not the top apex boss cell (0, 0)
 * - not a portal cell
 */
export function getFreeEmptyPyramidCells(
  map: PyramidCell[][],
  occupiedCoords: { row: number; col: number }[] = [],
  rowsCount: number = 10
): { r: number; c: number }[] {
  const occupiedSet = new Set(occupiedCoords.map((p) => `${p.row},${p.col}`));
  const freeCells: { r: number; c: number }[] = [];

  map.forEach((row, rI) => {
    if (!Array.isArray(row)) return;
    row.forEach((cell, cI) => {
      const isOccupiedByPlayer = occupiedSet.has(`${rI},${cI}`);
      const isExitTile = rI === rowsCount - 1 && cI === 0;
      const isSpawnNextToExit = rI === rowsCount - 1 && cI === 1;
      const isTopApex = rI === 0 && cI === 0;
      const isPortal = cell?.type === 'nextTier' || cell?.type === 'portal';
      const hasPlayerProp = Boolean(cell?.playerNick) || cell?.type === 'player';

      if (
        cell?.type === 'empty' &&
        !isOccupiedByPlayer &&
        !hasPlayerProp &&
        !isExitTile &&
        !isSpawnNextToExit &&
        !isTopApex &&
        !isPortal
      ) {
        freeCells.push({ r: rI, c: cI });
      }
    });
  });

  return freeCells;
}

/**
 * Builds a Rare / Boss mob cell object for the given tier and rareBossId.
 */
export function createRareBossMobCell(
  tier: number,
  rareBossId: 'crystal'
): PyramidCell {
  return {
    type: 'sack',
    sackCrystals: 1,
    rareBossId: 'crystal',
    mobName: '💎 Тайник Кристаллов',
    icon: '💎'
  };
}

/**
 * Deterministically builds the entire pyramid grid for a given tier and seed.
 * Strictly 1 Boss spawns at the top apex [0, 0] which opens the portal when defeated.
 * All other monster cells spawn regular monsters (isBoss: false).
 */
export function generateDeterministicPyramidCells(
  tier: number,
  seed: number,
  rowsCount: number = 10,
  occupiedCoords: { row: number; col: number }[] = []
): PyramidCell[][] {
  const safeTier = Math.max(1, Number(tier) || 1);
  const baseSeed = Math.max(1, Math.floor(Number(seed) || safeTier * 100003 + 1337));
  const occupiedSet = new Set(occupiedCoords.map((p) => `${p.row},${p.col}`));
  // Always protect the bottom-left Exit cell [9, 0] and the Spawn cell right next to it [9, 1]
  occupiedSet.add(`${rowsCount - 1},0`);
  occupiedSet.add(`${rowsCount - 1},1`);
  const map: PyramidCell[][] = [];

  for (let r = 0; r < rowsCount; r++) {
    const row: PyramidCell[] = [];
    const count = r + 1;
    for (let c = 0; c < count; c++) {
      let cellData: PyramidCell = { type: 'empty' };
      const isOccupiedByPlayer = occupiedSet.has(`${r},${c}`);

      let tileSeed = (baseSeed + safeTier * 7919 + r * 104729 + c * 15485863) % 2147483647;
      if (tileSeed <= 0) tileSeed += 2147483646;
      const nextRand = () => {
        tileSeed = (tileSeed * 16807) % 2147483647;
        return (tileSeed - 1) / 2147483646;
      };

      if (r === rowsCount - 1 && c === 0) {
        // Bottom-left corner cell [9, 0] is strictly the Exit button
        cellData = { type: 'exit' };
      } else if (r === rowsCount - 1 && c === 1) {
        // Cell [9, 1] right next to the Exit is strictly empty for player spawning
        cellData = { type: 'empty' };
      } else if (r === 0 && c === 0) {
        // Строго 1 Босс в пирамиде (на вершине [0, 0]), который открывает портал
        const bossTemplate = getPyramidMob(safeTier, r, true, nextRand(), nextRand());
        if (!isOccupiedByPlayer) {
          cellData = {
            type: 'mob',
            mobLvl: bossTemplate.lvl,
            mobHp: bossTemplate.hp,
            mobMaxHp: bossTemplate.hp,
            mobDmg: bossTemplate.dmg,
            isBoss: true,
            mobName: bossTemplate.name,
            icon: bossTemplate.icon
          };
        }
      } else {
        const roll = nextRand();
        const mobRand1 = nextRand();
        const mobRand2 = nextRand();
        const sackRand = nextRand();
        if (roll < 0.92) {
          // Обычные клетки пирамиды всегда содержат обычных монстров (isBoss: false)
          if (!isOccupiedByPlayer) {
            const mobTemplate = getPyramidMob(safeTier, r, false, mobRand1, mobRand2);
            cellData = {
              type: 'mob',
              mobLvl: mobTemplate.lvl,
              mobHp: mobTemplate.hp,
              mobMaxHp: mobTemplate.hp,
              mobDmg: mobTemplate.dmg,
              isBoss: false,
              mobName: mobTemplate.name,
              icon: mobTemplate.icon
            };
          }
        } else if (roll < 0.97 && !isOccupiedByPlayer) {
          cellData = {
            type: 'sack',
            sackGold: Math.floor(sackRand * 10) + 1
          };
        }
      }
      row.push(cellData);
    }
    map.push(row);
  }

  return map;
}

/**
 * Deterministically respawns monsters and sacks on empty cells of a tier using a shared seed.
 * Ensures strictly 1 Boss exists at [0, 0] (which opens the portal when defeated).
 */
export function respawnDeterministicPyramidCells(
  currentMap: PyramidCell[][],
  tier: number,
  seed: number,
  occupiedCoords: { row: number; col: number }[] = [],
  rowsCount: number = 10
): PyramidCell[][] {
  const cleanMap = sanitizePyramidCellsForStorage(currentMap);
  if (cleanMap.length === 0) {
    return generateDeterministicPyramidCells(tier, seed, rowsCount, occupiedCoords);
  }

  let s = Math.max(1, Math.floor(Number(seed) || Date.now())) % 2147483647;
  const nextRand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const occupiedSet = new Set(occupiedCoords.map((p) => `${p.row},${p.col}`));
  // Strictly protect Exit cell [9, 0] and Spawn cell next to Exit [9, 1]
  occupiedSet.add(`${rowsCount - 1},0`);
  occupiedSet.add(`${rowsCount - 1},1`);

  let mobCount = 0;
  let sackCount = 0;
  let apexBossAlive = false;

  // Clear any monster that might be on a cell occupied by a player, on Exit [9,0], or on Spawn [9,1]
  const newMap = cleanMap.map((row, rI) =>
    row.map((cell, cI) => {
      if (rI === rowsCount - 1 && cI === 0) {
        return { type: 'exit' as const };
      }
      if (rI === rowsCount - 1 && cI === 1) {
        return { type: 'empty' as const };
      }
      if (cell.type === 'mob' && occupiedSet.has(`${rI},${cI}`)) {
        return { type: 'empty' as const };
      }
      return { ...cell };
    })
  );

  newMap.forEach((row, rI) => {
    row.forEach((cell, cI) => {
      if (cell.type === 'mob') {
        if (!cell.rareBossId) {
          mobCount++;
        }
        if (rI === 0 && cI === 0 && cell.isBoss) {
          apexBossAlive = true;
        }
      } else if (cell.type === 'sack') {
        sackCount++;
      }
    });
  });

  const emptyCells = getFreeEmptyPyramidCells(newMap, occupiedCoords, rowsCount);

  // Deterministic Fisher-Yates shuffle
  for (let i = emptyCells.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = emptyCells[i];
    emptyCells[i] = emptyCells[j];
    emptyCells[j] = tmp;
  }

  // Строго 1 Босс на вершине [0, 0], который открывает портал
  const bossFreq = Math.max(0, Math.min(100, Number(getFeatureFlags()?.bossSpawnFrequency ?? 100)));
  if (!apexBossAlive && bossFreq > 0 && newMap[0]?.[0]?.type === 'empty' && !occupiedSet.has('0,0')) {
    for (let r = 0; r < newMap.length; r++) {
      for (let c = 0; c < newMap[r].length; c++) {
        if (newMap[r][c].type === 'nextTier' || newMap[r][c].type === 'portal') {
          newMap[r][c] = { type: 'empty' };
        }
      }
    }
    const bossTemplate = getPyramidMob(tier, 0, true, nextRand(), nextRand());
    newMap[0][0] = {
      type: 'mob',
      mobLvl: bossTemplate.lvl,
      mobHp: bossTemplate.hp,
      mobMaxHp: bossTemplate.hp,
      mobDmg: bossTemplate.dmg,
      isBoss: true,
      mobName: bossTemplate.name,
      icon: bossTemplate.icon
    };
  }

  const neededMobs = Math.max(0, 80 - mobCount);
  let mobsPlaced = 0;
  while (emptyCells.length > 0 && mobsPlaced < neededMobs) {
    const pos = emptyCells.pop()!;
    const mobTemplate = getPyramidMob(tier, pos.r, false, nextRand(), nextRand());
    newMap[pos.r][pos.c] = {
      type: 'mob',
      mobLvl: mobTemplate.lvl,
      mobHp: mobTemplate.hp,
      mobMaxHp: mobTemplate.hp,
      mobDmg: mobTemplate.dmg,
      isBoss: false,
      mobName: mobTemplate.name,
      icon: mobTemplate.icon
    };
    mobsPlaced++;
  }

  const neededSacks = Math.max(0, 4 - sackCount);
  let sacksPlaced = 0;
  while (emptyCells.length > 0 && sacksPlaced < neededSacks) {
    const pos = emptyCells.pop()!;
    newMap[pos.r][pos.c] = {
      type: 'sack',
      sackGold: Math.floor(nextRand() * 10) + 1
    };
    sacksPlaced++;
  }

  return newMap;
}


export const INITIAL_HERO: HeroState = {
  level: 1,
  exp: 0,
  gold: 0,
  crystals: 0,
  hp: 250,
  maxHp: 250,
  baseMaxHp: 250,
  energy: 100,
  maxEnergy: 100,
  bonusDmg: 0,
  bonusHp: 0,
  gearDmg: 0,
  gearHp: 0,
  gearDodge: 0,
  gearEnergy: 0,
  gearGoldPct: 0,
  gearExpPct: 0,
  gearStr: 0,
  gearAgi: 0,
  gearVit: 0,
  gearV2Migrated: true,
  statPoints: 0,
  str: 1,
  agi: 1,
  vit: 1,
  hpPotions: 0,
  enPotions: 0,
  expPotions: 0,
  expElixirUntil: 0,
  goldInCurrentRun: 0,
  bagCapacity: 100,
  sellExperience: 0,
  mobsKilled: 0,
  pvpKills: 0,
  deaths: 0,
  itemsSold: 0,
  role: 'regular',
  statusTitle: 'Новичок',
  isPremium: false,
  pyramidTier: 1,
  avatar: '🧙‍♂️',
  dailyQuests: [],
  lastQuestUpdate: 0,
  referralCode: 'ref_pyramid_start',
  referralPlayerNick: '',
  referralPlayerLvl: 0,
  referralClaimed: false,
  lastWheelSpinTime: 0,
  dailyLoginDay: 0,
  dailyLoginLastDate: ''
};

export const INITIAL_EQUIPPED: EquippedGear = {
  weapon: null,
  armor: null,
  pants: null,
  boots: null,
  gloves: null,
  ring: null
};

export const INITIAL_INVENTORY: GameItem[] = [];

export const INITIAL_FRIENDS: FriendEntry[] = [];

export const INITIAL_MARKET: MarketLot[] = [];

/**
 * Formats a player's last active timestamp into a user-friendly Russian string:
 * e.g. "🟢 В сети", "Сегодня в 14:35", "Вчера в 18:20", or "22.10.2026 в 14:35"
 */
export function formatLastSeen(timestamp?: number | null, isOnline?: boolean): string {
  if (isOnline) return '🟢 В сети';
  if (!timestamp || Number(timestamp) <= 0) return '⚪ Давно не заходил';

  const ts = Number(timestamp);
  const date = new Date(ts);
  const now = new Date();

  // If time is in the future or within the last 45 seconds, considered just now
  const diffSec = Math.floor((now.getTime() - ts) / 1000);
  if (diffSec < 45) {
    return 'Был только что';
  }

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Сегодня в ${timeStr}`;
  }
  if (isYesterday) {
    return `Вчера в ${timeStr}`;
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}.${month}.${year} в ${timeStr}`;
}

/**
 * Formats timestamp into full date and time string:
 * e.g. "22.10.2026, 14:35"
 */
export function formatFullDateTime(timestamp?: number | null): string {
  if (!timestamp || Number(timestamp) <= 0) return '—';
  const date = new Date(Number(timestamp));
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day}.${month}.${year}, ${time}`;
}

