import { getSupabaseClient } from './supabase';

export interface ScarabCupAdminConfig {
  id: 'bronze' | 'silver' | 'gold';
  name: string;
  badge: string;
  icon: string;
  entryFeeGold: number;
  // 1st place (Champion)
  prize1stGold: number;
  prize1stCrystals: number;
  prize1stTrophies: number;
  prize1stXp: number;
  // 2nd place (Finalist)
  prize2ndGold: number;
  prize2ndCrystals: number;
  prize2ndTrophies: number;
  prize2ndXp: number;
  // 3rd-4th place (Semifinalist)
  prize3rdGold: number;
  prize3rdCrystals: number;
  prize3rdTrophies: number;
  prize3rdXp: number;
  // Opponent level range
  minLvl: number;
  maxLvl: number;
  desc: string;
  tierColor: string;
}

export interface ScarabTrainingAdminConfig {
  strBaseGold: number;
  strStepGold: number;
  strGain: number;
  agiBaseGold: number;
  agiStepGold: number;
  agiGain: number;
  armorBaseGold: number;
  armorStepGold: number;
  armorGain: number;
  hpGain: number;
  critCostCrystals: number;
  critGain: number;
  maxCritChance: number;
  xpElixirCostGold: number;
  xpElixirGain: number;
  // Aliases used in Admin UI for seamless compatibility
  baseCostStrength: number;
  stepCostStrength: number;
  baseCostAgility: number;
  stepCostAgility: number;
  baseCostArmor: number;
  stepCostArmor: number;
  costCritCrystals: number;
  costXpElixir: number;
}

export interface ScarabRivalDifficultyConfig {
  globalStatMultiplier: number; // e.g., 1.55 (+55% to all rival stats)
  minPlayerStatRatio: number; // e.g., 1.20 (rivals are at least 120% of player's scarab stats)
  bonusLevelOffset: number; // e.g., +3 levels above player scarab
  semiFinalBuffMult: number; // e.g., 1.28 (+28% buff in semifinals)
  finalBossBuffMult: number; // e.g., 1.45 (+45% buff for Grand Final Boss)
  rivalExtraCritPct: number; // e.g., +12% extra crit chance
  rivalExtraDodgePct: number; // e.g., +10% extra evasion chance
  rivalDamageReductionPct: number; // e.g., 15% damage reduction shield
  enableBossRageSkill: boolean; // <45% HP triggers +30% rage damage
  enableCounterAttackSkill: boolean; // counter-attacks on dodge & thorn reflection
}

export interface ScarabSeasonRewardConfig {
  enabled: boolean;
  seasonTitle: string;
  seasonNumber: number;
  seasonCycleDays: number; // Default 30 days (Раз в месяц)
  rewardIntervalMinutes: number; // Default 43200 mins (30 days)
  nextRewardDistributionAt: number; // timestamp in ms
  maxEntriesPerSeason: number; // Default 1 (1 раз в месяц; 0 = без лимита)
  seasonResetToken: number; // increments when admin resets monthly entry counters
  payoutDelaySeconds: number; // 0 = instant payout after match
  matchStepDelayMs: number; // step animation speed (default 350ms)
  top1Gold: number;
  top1Crystals: number;
  top2Gold: number;
  top2Crystals: number;
  top3Gold: number;
  top3Crystals: number;
  // Aliases used in Admin UI
  seasonTop1Gold: number;
  seasonTop1Crystals: number;
  seasonTop2Gold: number;
  seasonTop2Crystals: number;
  seasonTop3Gold: number;
  seasonTop3Crystals: number;
}

export interface ScarabTournamentGlobalConfig {
  enabled: boolean;
  cups: ScarabCupAdminConfig[];
  training: ScarabTrainingAdminConfig;
  difficulty: ScarabRivalDifficultyConfig;
  schedule: ScarabSeasonRewardConfig;
  updatedAt: number;
}

const STORAGE_KEY = 'pyramid_scarab_tournament_admin_config_v4';
const SUPABASE_CONFIG_ROW = '__SCARAB_TOURNAMENT_CONFIG__';

export const DEFAULT_SCARAB_TOURNAMENT_CUPS: ScarabCupAdminConfig[] = [
  {
    id: 'bronze',
    name: 'Песчаный Кубок (Бронза)',
    badge: '🥉 Лига Песков',
    icon: '🥉',
    entryFeeGold: 25,
    prize1stGold: 65,
    prize1stCrystals: 1,
    prize1stTrophies: 15,
    prize1stXp: 90,
    prize2ndGold: 30,
    prize2ndCrystals: 0,
    prize2ndTrophies: 7,
    prize2ndXp: 40,
    prize3rdGold: 12,
    prize3rdCrystals: 0,
    prize3rdTrophies: 3,
    prize3rdXp: 20,
    minLvl: 4,
    maxLvl: 9,
    desc: 'Ежемесячный турнир закалённых скарабеев. Взнос и призы сбалансированы под снаряжение 2–8 ур.',
    tierColor: 'border-amber-700/60 bg-amber-950/30 text-amber-300'
  },
  {
    id: 'silver',
    name: 'Кубок Нила (Серебро)',
    badge: '🥈 Лига Стражей',
    icon: '🥈',
    entryFeeGold: 60,
    prize1stGold: 150,
    prize1stCrystals: 3,
    prize1stTrophies: 35,
    prize1stXp: 200,
    prize2ndGold: 70,
    prize2ndCrystals: 1,
    prize2ndTrophies: 15,
    prize2ndXp: 90,
    prize3rdGold: 25,
    prize3rdCrystals: 0,
    prize3rdTrophies: 6,
    prize3rdXp: 40,
    minLvl: 9,
    maxLvl: 16,
    desc: 'Престижный ежемесячный чемпионат опытных бойцов. Главный приз равен стоимости редкой брони 15 ур.!',
    tierColor: 'border-slate-400/60 bg-slate-900/60 text-slate-200'
  },
  {
    id: 'gold',
    name: 'Кубок Фараона (Золотой Гранд-Турнир)',
    badge: '👑 Королевская Лига',
    icon: '👑',
    entryFeeGold: 120,
    prize1stGold: 300,
    prize1stCrystals: 6,
    prize1stTrophies: 80,
    prize1stXp: 450,
    prize2ndGold: 135,
    prize2ndCrystals: 2,
    prize2ndTrophies: 35,
    prize2ndXp: 180,
    prize3rdGold: 50,
    prize3rdCrystals: 1,
    prize3rdTrophies: 15,
    prize3rdXp: 80,
    minLvl: 15,
    maxLvl: 30,
    desc: 'Главный ежемесячный турнир Пирамиды! Элитные соперники-боссы и награда за 1-е место как у легендарного оружия 20 ур.',
    tierColor: 'border-yellow-400 bg-gradient-to-br from-amber-500/20 via-yellow-950/40 to-amber-900/40 text-yellow-300'
  }
];

export const DEFAULT_SCARAB_TRAINING_CONFIG: ScarabTrainingAdminConfig = {
  strBaseGold: 10,
  strStepGold: 1,
  strGain: 4,
  agiBaseGold: 10,
  agiStepGold: 1,
  agiGain: 4,
  armorBaseGold: 14,
  armorStepGold: 2,
  armorGain: 4,
  hpGain: 30,
  critCostCrystals: 1,
  critGain: 4,
  maxCritChance: 70,
  xpElixirCostGold: 35,
  xpElixirGain: 250,
  baseCostStrength: 10,
  stepCostStrength: 1,
  baseCostAgility: 10,
  stepCostAgility: 1,
  baseCostArmor: 14,
  stepCostArmor: 2,
  costCritCrystals: 1,
  costXpElixir: 35
};

export const DEFAULT_SCARAB_DIFFICULTY_CONFIG: ScarabRivalDifficultyConfig = {
  globalStatMultiplier: 1.55,
  minPlayerStatRatio: 1.2,
  bonusLevelOffset: 3,
  semiFinalBuffMult: 1.28,
  finalBossBuffMult: 1.45,
  rivalExtraCritPct: 12,
  rivalExtraDodgePct: 10,
  rivalDamageReductionPct: 15,
  enableBossRageSkill: true,
  enableCounterAttackSkill: true
};

export function normalizeTrainingConfig(raw: any): ScarabTrainingAdminConfig {
  const r = raw && typeof raw === 'object' ? raw : {};
  const strBaseGold = Number(r.baseCostStrength ?? r.strBaseGold ?? DEFAULT_SCARAB_TRAINING_CONFIG.strBaseGold);
  const strStepGold = Number(r.stepCostStrength ?? r.strStepGold ?? DEFAULT_SCARAB_TRAINING_CONFIG.strStepGold);
  const agiBaseGold = Number(r.baseCostAgility ?? r.agiBaseGold ?? DEFAULT_SCARAB_TRAINING_CONFIG.agiBaseGold);
  const agiStepGold = Number(r.stepCostAgility ?? r.agiStepGold ?? DEFAULT_SCARAB_TRAINING_CONFIG.agiStepGold);
  const armorBaseGold = Number(r.baseCostArmor ?? r.armorBaseGold ?? DEFAULT_SCARAB_TRAINING_CONFIG.armorBaseGold);
  const armorStepGold = Number(r.stepCostArmor ?? r.armorStepGold ?? DEFAULT_SCARAB_TRAINING_CONFIG.armorStepGold);
  const critCostCrystals = Number(
    r.costCritCrystals ?? r.critCostCrystals ?? DEFAULT_SCARAB_TRAINING_CONFIG.critCostCrystals
  );
  const xpElixirCostGold = Number(
    r.costXpElixir ?? r.xpElixirCostGold ?? DEFAULT_SCARAB_TRAINING_CONFIG.xpElixirCostGold
  );

  return {
    strBaseGold,
    strStepGold,
    strGain: Number(r.strGain ?? DEFAULT_SCARAB_TRAINING_CONFIG.strGain),
    agiBaseGold,
    agiStepGold,
    agiGain: Number(r.agiGain ?? DEFAULT_SCARAB_TRAINING_CONFIG.agiGain),
    armorBaseGold,
    armorStepGold,
    armorGain: Number(r.armorGain ?? DEFAULT_SCARAB_TRAINING_CONFIG.armorGain),
    hpGain: Number(r.hpGain ?? DEFAULT_SCARAB_TRAINING_CONFIG.hpGain),
    critCostCrystals,
    critGain: Number(r.critGain ?? DEFAULT_SCARAB_TRAINING_CONFIG.critGain),
    maxCritChance: Number(r.maxCritChance ?? DEFAULT_SCARAB_TRAINING_CONFIG.maxCritChance),
    xpElixirCostGold,
    xpElixirGain: Number(r.xpElixirGain ?? DEFAULT_SCARAB_TRAINING_CONFIG.xpElixirGain),
    baseCostStrength: strBaseGold,
    stepCostStrength: strStepGold,
    baseCostAgility: agiBaseGold,
    stepCostAgility: agiStepGold,
    baseCostArmor: armorBaseGold,
    stepCostArmor: armorStepGold,
    costCritCrystals: critCostCrystals,
    costXpElixir: xpElixirCostGold
  };
}

export function normalizeScheduleConfig(raw: any, rootEnabled?: boolean): ScarabSeasonRewardConfig {
  const r = raw && typeof raw === 'object' ? raw : {};
  const enabled = r.enabled !== undefined ? Boolean(r.enabled) : rootEnabled !== false;
  const seasonCycleDays = Math.max(1, Number(r.seasonCycleDays ?? 30));
  const rewardIntervalMinutes = Math.max(
    1,
    Number(r.rewardIntervalMinutes ?? seasonCycleDays * 24 * 60)
  );
  const top1Gold = Number(r.seasonTop1Gold ?? r.top1Gold ?? 250);
  const top1Crystals = Number(r.seasonTop1Crystals ?? r.top1Crystals ?? 7);
  const top2Gold = Number(r.seasonTop2Gold ?? r.top2Gold ?? 150);
  const top2Crystals = Number(r.seasonTop2Crystals ?? r.top2Crystals ?? 4);
  const top3Gold = Number(r.seasonTop3Gold ?? r.top3Gold ?? 80);
  const top3Crystals = Number(r.seasonTop3Crystals ?? r.top3Crystals ?? 2);

  let nextRewardDistributionAt = Number(r.nextRewardDistributionAt || 0);
  if (!nextRewardDistributionAt || nextRewardDistributionAt < 1000000) {
    nextRewardDistributionAt = Date.now() + rewardIntervalMinutes * 60 * 1000;
  }

  return {
    enabled,
    seasonTitle: String(r.seasonTitle || 'Ежемесячный Гранд-Турнир Фараона'),
    seasonNumber: Math.max(1, Number(r.seasonNumber || 1)),
    seasonCycleDays,
    rewardIntervalMinutes,
    nextRewardDistributionAt,
    maxEntriesPerSeason: r.maxEntriesPerSeason !== undefined ? Math.max(0, Number(r.maxEntriesPerSeason)) : 1,
    seasonResetToken: Number(r.seasonResetToken || 1),
    payoutDelaySeconds: Math.max(0, Number(r.payoutDelaySeconds || 0)),
    matchStepDelayMs: Math.max(80, Number(r.matchStepDelayMs || 350)),
    top1Gold,
    top1Crystals,
    top2Gold,
    top2Crystals,
    top3Gold,
    top3Crystals,
    seasonTop1Gold: top1Gold,
    seasonTop1Crystals: top1Crystals,
    seasonTop2Gold: top2Gold,
    seasonTop2Crystals: top2Crystals,
    seasonTop3Gold: top3Gold,
    seasonTop3Crystals: top3Crystals
  };
}

export function normalizeDifficultyConfig(raw: any): ScarabRivalDifficultyConfig {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    globalStatMultiplier: Math.max(0.5, Number(r.globalStatMultiplier ?? DEFAULT_SCARAB_DIFFICULTY_CONFIG.globalStatMultiplier)),
    minPlayerStatRatio: Math.max(0.5, Number(r.minPlayerStatRatio ?? DEFAULT_SCARAB_DIFFICULTY_CONFIG.minPlayerStatRatio)),
    bonusLevelOffset: Math.max(0, Number(r.bonusLevelOffset ?? DEFAULT_SCARAB_DIFFICULTY_CONFIG.bonusLevelOffset)),
    semiFinalBuffMult: Math.max(1, Number(r.semiFinalBuffMult ?? DEFAULT_SCARAB_DIFFICULTY_CONFIG.semiFinalBuffMult)),
    finalBossBuffMult: Math.max(1, Number(r.finalBossBuffMult ?? DEFAULT_SCARAB_DIFFICULTY_CONFIG.finalBossBuffMult)),
    rivalExtraCritPct: Math.max(0, Number(r.rivalExtraCritPct ?? DEFAULT_SCARAB_DIFFICULTY_CONFIG.rivalExtraCritPct)),
    rivalExtraDodgePct: Math.max(0, Number(r.rivalExtraDodgePct ?? DEFAULT_SCARAB_DIFFICULTY_CONFIG.rivalExtraDodgePct)),
    rivalDamageReductionPct: Math.max(
      0,
      Math.min(60, Number(r.rivalDamageReductionPct ?? DEFAULT_SCARAB_DIFFICULTY_CONFIG.rivalDamageReductionPct))
    ),
    enableBossRageSkill:
      r.enableBossRageSkill !== undefined ? Boolean(r.enableBossRageSkill) : DEFAULT_SCARAB_DIFFICULTY_CONFIG.enableBossRageSkill,
    enableCounterAttackSkill:
      r.enableCounterAttackSkill !== undefined
        ? Boolean(r.enableCounterAttackSkill)
        : DEFAULT_SCARAB_DIFFICULTY_CONFIG.enableCounterAttackSkill
  };
}

export function createDefaultScarabTournamentConfig(): ScarabTournamentGlobalConfig {
  const monthlyMins = 30 * 24 * 60; // 43 200 minutes = 30 days (Раз в месяц)
  return {
    enabled: true,
    cups: DEFAULT_SCARAB_TOURNAMENT_CUPS.map((c) => ({ ...c })),
    training: normalizeTrainingConfig(DEFAULT_SCARAB_TRAINING_CONFIG),
    difficulty: normalizeDifficultyConfig(DEFAULT_SCARAB_DIFFICULTY_CONFIG),
    schedule: normalizeScheduleConfig(
      {
        enabled: true,
        seasonTitle: 'Ежемесячный Гранд-Турнир Фараона',
        seasonNumber: 1,
        seasonCycleDays: 30,
        rewardIntervalMinutes: monthlyMins,
        nextRewardDistributionAt: Date.now() + monthlyMins * 60 * 1000,
        maxEntriesPerSeason: 1,
        seasonResetToken: 1,
        payoutDelaySeconds: 0,
        matchStepDelayMs: 350,
        top1Gold: 250,
        top1Crystals: 7,
        top2Gold: 150,
        top2Crystals: 4,
        top3Gold: 80,
        top3Crystals: 2
      },
      true
    ),
    updatedAt: Date.now()
  };
}

function isLegacyCosmicConfig(cfg: any): boolean {
  if (!cfg || typeof cfg !== 'object') return false;
  const bronzeCup = Array.isArray(cfg.cups) ? cfg.cups.find((c: any) => c.id === 'bronze') : null;
  if (bronzeCup && Number(bronzeCup.entryFeeGold) >= 200) return true;
  if (cfg.training && Number(cfg.training.strBaseGold) >= 80) return true;
  if (cfg.schedule && Number(cfg.schedule.top1Gold) >= 2000) return true;
  return false;
}

export function getScarabTournamentConfig(): ScarabTournamentGlobalConfig {
  const fallback = createDefaultScarabTournamentConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || isLegacyCosmicConfig(parsed)) {
      return fallback;
    }

    const cups: ScarabCupAdminConfig[] = DEFAULT_SCARAB_TOURNAMENT_CUPS.map((defCup) => {
      const found = Array.isArray(parsed.cups)
        ? parsed.cups.find((c: any) => c.id === defCup.id)
        : null;
      return found ? { ...defCup, ...found } : { ...defCup };
    });

    const training = normalizeTrainingConfig(parsed.training);
    const difficulty = normalizeDifficultyConfig(parsed.difficulty);
    const schedule = normalizeScheduleConfig(parsed.schedule, parsed.enabled);

    return {
      enabled: schedule.enabled,
      cups,
      training,
      difficulty,
      schedule,
      updatedAt: Number(parsed.updatedAt || Date.now())
    };
  } catch {
    return fallback;
  }
}

export function saveScarabTournamentConfigLocal(
  config: ScarabTournamentGlobalConfig
): ScarabTournamentGlobalConfig {
  const training = normalizeTrainingConfig(config.training);
  const difficulty = normalizeDifficultyConfig(config.difficulty);
  const schedule = normalizeScheduleConfig(config.schedule, config.enabled);
  const normalized: ScarabTournamentGlobalConfig = {
    ...config,
    enabled: schedule.enabled,
    training,
    difficulty,
    schedule,
    updatedAt: Date.now()
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('scarab-tournament-config-updated', { detail: normalized }));
    }
  } catch {}
  return normalized;
}

export async function saveScarabTournamentConfigToSupabase(
  config: ScarabTournamentGlobalConfig
): Promise<boolean> {
  const saved = saveScarabTournamentConfigLocal(config);
  try {
    const sb = getSupabaseClient();
    if (!sb) return false;
    const { error } = await sb.from('players').upsert(
      {
        name: SUPABASE_CONFIG_ROW,
        nick: SUPABASE_CONFIG_ROW,
        trade_protocol: [saved],
        last_seen: Date.now()
      },
      { onConflict: 'name' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function syncScarabTournamentConfigFromSupabase(): Promise<ScarabTournamentGlobalConfig> {
  try {
    const sb = getSupabaseClient();
    if (!sb) return getScarabTournamentConfig();
    const { data, error } = await sb
      .from('players')
      .select('trade_protocol')
      .eq('name', SUPABASE_CONFIG_ROW)
      .maybeSingle();

    if (!error && data && Array.isArray(data.trade_protocol) && data.trade_protocol[0]) {
      const remoteCfg = data.trade_protocol[0] as ScarabTournamentGlobalConfig;
      if (isLegacyCosmicConfig(remoteCfg)) {
        const balanced = createDefaultScarabTournamentConfig();
        await saveScarabTournamentConfigToSupabase(balanced);
        return balanced;
      }
      const localCfg = getScarabTournamentConfig();
      if ((remoteCfg.updatedAt || 0) >= (localCfg.updatedAt || 0) && remoteCfg.difficulty) {
        return saveScarabTournamentConfigLocal(remoteCfg);
      }
    }
  } catch {}
  return getScarabTournamentConfig();
}
