import {
  Clan,
  ClanMember,
  ClanRole,
  ClanStorageItem,
  ClanLogEntry,
  ClanLogType,
  ClanPyramidState,
  ClanPyramidConfig,
  ClanPyramidMonsterTemplate,
  PyramidCell,
  GameItem,
  HeroState,
  EquippedGear,
  ClanAchievementsProgress,
  ClanTerritorySector,
  ClanTerritoryBonusType,
  TerritoryFighterRole,
  TerritoryTacticalAction,
  ClanTerritory7x7Fighter,
  ClanTerritory7x7RoundLog,
  ClanTerritory7x7BattleState,
  ClanRaidBossState,
  ClanDailyQuestEntry,
  ClanQuestsState,
  ClanQuestActionType,
  ClanArenaFighter,
  ClanArenaMatchLog,
  ClanArenaPlayoffMatch,
  ClanArenaTournamentState,
  PortProductionState,
  PortFactoryWorkerSession,
  PortTerminalResourceKey,
  PortWorkProtocolEntry,
  PortDealProtocolEntry,
  ClanMemberPermissions,
  ClanSyndicateRankConfig,
  ClanBaseBuildingsState,
  ClanDiplomacyEntry,
  ClanSupplyOrderEntry
} from '../types/game';
import { EXP_TABLE } from './gameData';
import { getSupabaseClient } from './supabase';

export const CLAN_CREATION_COST_CRYSTALS = 1000;
export const MAX_CLAN_LEVEL = 20;
export const BASE_CLAN_STORAGE_CAPACITY = 50;
export const CLAN_STORAGE_PER_LEVEL = 10;

// Опыт до получения уровня клана такой же, как у персонажа, только в 2 раза больше
export const CLAN_EXP_TABLE: Record<number, number> = Object.fromEntries(
  Object.entries(EXP_TABLE).map(([lvl, exp]) => [Number(lvl), Number(exp) * 2])
);

export function getClanExpForNextLevel(level: number): number {
  const lvl = Math.max(1, Math.min(MAX_CLAN_LEVEL, Math.floor(Number(level) || 1)));
  if (lvl >= MAX_CLAN_LEVEL) return 0;
  return CLAN_EXP_TABLE[lvl] || (EXP_TABLE[lvl] ? EXP_TABLE[lvl] * 2 : 4000000);
}

export const getClanNextLevelExp = getClanExpForNextLevel;

export function getClanMaxStorageCapacity(clan?: Clan | null): number {
  if (!clan) return BASE_CLAN_STORAGE_CAPACITY;
  if (clan.maxStorageOverride && Number(clan.maxStorageOverride) > 0) {
    return Math.floor(Number(clan.maxStorageOverride));
  }
  const lvl = Math.max(1, Math.min(MAX_CLAN_LEVEL, Math.floor(Number(clan.level) || 1)));
  return BASE_CLAN_STORAGE_CAPACITY + (lvl - 1) * CLAN_STORAGE_PER_LEVEL;
}

export const DEFAULT_CLAN_PYRAMID_MONSTERS: ClanPyramidMonsterTemplate[] = [
  {
    id: 'cp_mob_1',
    name: 'Часовой Анубиса',
    icon: '🐺',
    lvl: 3,
    hp: 300,
    dmg: 28,
    isBoss: false,
    goldReward: 150,
    crystalReward: 2,
    expReward: 60,
    clanExpReward: 120,
    influenceReward: 15,
    spawnCount: 10
  },
  {
    id: 'cp_mob_2',
    name: 'Золотой Скорпион Клана',
    icon: '🦂',
    lvl: 6,
    hp: 550,
    dmg: 45,
    isBoss: false,
    goldReward: 280,
    crystalReward: 4,
    expReward: 120,
    clanExpReward: 240,
    influenceReward: 30,
    spawnCount: 8
  },
  {
    id: 'cp_mob_3',
    name: 'Жрец Осириса',
    icon: '🧙‍♂️',
    lvl: 10,
    hp: 950,
    dmg: 65,
    isBoss: false,
    goldReward: 450,
    crystalReward: 6,
    expReward: 220,
    clanExpReward: 450,
    influenceReward: 50,
    spawnCount: 6
  },
  {
    id: 'cp_mob_4',
    name: 'Огненный Сфинкс',
    icon: '🦁',
    lvl: 14,
    hp: 1500,
    dmg: 90,
    isBoss: false,
    goldReward: 700,
    crystalReward: 10,
    expReward: 400,
    clanExpReward: 800,
    influenceReward: 85,
    spawnCount: 5
  },
  {
    id: 'cp_boss_1',
    name: 'Босс: Крылатый Гор',
    icon: '🦅',
    lvl: 17,
    hp: 2600,
    dmg: 120,
    isBoss: true,
    goldReward: 1500,
    crystalReward: 25,
    expReward: 900,
    clanExpReward: 1800,
    influenceReward: 180,
    spawnCount: 2
  },
  {
    id: 'cp_boss_ra',
    name: 'Главный Босс: Аватар Солнца Ра',
    icon: '☀️',
    lvl: 20,
    hp: 4500,
    dmg: 165,
    isBoss: true,
    goldReward: 3000,
    crystalReward: 50,
    expReward: 2000,
    clanExpReward: 4000,
    influenceReward: 350,
    spawnCount: 1
  }
];

export const DEFAULT_CLAN_PYRAMID_CONFIG: ClanPyramidConfig = {
  title: 'Клановая Пирамида Ра',
  subtitle: 'Сражайтесь на 10x10 карте за контроль Трона, опыт клана и баффы!',
  minClanLevel: 1,
  energyPerMove: 3,
  respawnIntervalSec: 60,
  buffGoldPct: 15,
  buffExpPct: 15,
  buffDmgPct: 5,
  buffHpPct: 10,
  goldBonusPct: 15,
  expBonusPct: 15,
  dmgBonusPct: 5,
  hpBonusPct: 10,
  monsters: DEFAULT_CLAN_PYRAMID_MONSTERS
};

export function generateClanPyramidGrid(
  config: ClanPyramidConfig = DEFAULT_CLAN_PYRAMID_CONFIG,
  _seed?: number
): PyramidCell[][] {
  const rows = 10;
  const cols = 10;
  const grid: PyramidCell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ type: 'empty' as const }))
  );

  // Entrance / Exit at bottom-left (9, 0)
  grid[9][0] = {
    type: 'exit',
    icon: '🚪',
    mobName: 'Выход в Город'
  };

  // Throne Altar at top-right (0, 9)
  grid[0][9] = {
    type: 'portal',
    icon: '👑',
    mobName: 'Трон Ра (+Влияние)'
  };

  // Collect available coordinates excluding (9,0), (9,1), (8,0) and (0,9)
  const availableCoords: { r: number; c: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r === 9 && c === 0) || (r === 0 && c === 9)) continue;
      if (r === 9 && c === 1) continue;
      if (r === 8 && c === 0) continue;
      availableCoords.push({ r, c });
    }
  }

  // Shuffle coordinates
  for (let i = availableCoords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = availableCoords[i];
    availableCoords[i] = availableCoords[j];
    availableCoords[j] = tmp;
  }

  let cursor = 0;
  const monstersList = Array.isArray(config.monsters) && config.monsters.length > 0
    ? config.monsters
    : DEFAULT_CLAN_PYRAMID_MONSTERS;

  for (const m of monstersList) {
    const count = Math.max(0, Math.min(30, Number(m.spawnCount) || 0));
    for (let k = 0; k < count && cursor < availableCoords.length; k++) {
      const { r, c } = availableCoords[cursor++];
      const maxHpVal = Number(m.maxHp ?? m.hp ?? 300);
      grid[r][c] = {
        type: 'mob',
        mobName: m.name,
        mobLvl: m.lvl,
        mobHp: maxHpVal,
        mobMaxHp: maxHpVal,
        mobDmg: m.dmg,
        isBoss: Boolean(m.isBoss),
        icon: m.icon || (m.isBoss ? '👑' : '👹'),
        goldReward: m.goldReward,
        crystalReward: m.crystalReward,
        expReward: m.expReward,
        clanExpReward: m.clanExpReward,
        influenceReward: m.influenceReward,
        mobGoldReward: m.goldReward,
        mobCrystalReward: m.crystalReward,
        mobExpReward: m.expReward,
        mobClanExpReward: m.clanExpReward,
        mobInfluenceReward: m.influenceReward
      };
    }
  }

  // Spawn 6 treasure chests / sacks on remaining cells
  for (let s = 0; s < 6 && cursor < availableCoords.length; s++) {
    const { r, c } = availableCoords[cursor++];
    grid[r][c] = {
      type: 'sack',
      icon: '💰',
      sackGold: 120 + Math.floor(Math.random() * 280),
      sackCrystals: Math.random() < 0.35 ? 1 + Math.floor(Math.random() * 4) : 0
    };
  }

  return grid;
}

export const DEFAULT_CLAN_PYRAMID_STATE: ClanPyramidState = {
  controlledByClanId: null,
  controlledByClanName: null,
  controlledByClanTag: null,
  controlledByClanEmblem: null,
  seasonEndTimestamp: Date.now() + 7 * 24 * 3600 * 1000,
  treasuryGold: 50000,
  treasuryCrystals: 2500,
  floorScores: {},
  currentCycle: 1,
  lastBattleAt: Date.now(),
  lastRespawnAt: Date.now(),
  config: DEFAULT_CLAN_PYRAMID_CONFIG,
  gridCells: generateClanPyramidGrid(DEFAULT_CLAN_PYRAMID_CONFIG),
  topClansLeaderboard: []
};

const CLANS_STORAGE_KEY = 'egypt_game_clans_v1';
const CLAN_PYRAMID_KEY = 'egypt_game_clan_pyramid_v1';
const CLAN_TERRITORIES_KEY = 'egypt_game_clan_territories_v1';
const CLAN_ARENA_KEY = 'egypt_game_clan_arena_v1';

// In-memory cache
let inMemoryClans: Clan[] = [];
let inMemoryPyramid: ClanPyramidState = { ...DEFAULT_CLAN_PYRAMID_STATE };
let inMemoryTerritories: ClanTerritorySector[] = [];
let inMemoryArena: ClanArenaTournamentState | null = null;
let isInitialized = false;

export const MAX_CLAN_LOGS = 150;

export function formatClanLogTime(ts = Date.now()): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addClanLogEntry(
  clan: Clan,
  actorNick: string,
  type: ClanLogType,
  text: string,
  icon?: string
): ClanLogEntry {
  const now = Date.now();
  const entry: ClanLogEntry = {
    id: `clog_${now}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now,
    timeStr: formatClanLogTime(now),
    actorNick: actorNick.trim() || 'Игрок',
    type,
    text,
    icon
  };
  const existing = Array.isArray(clan.logs) ? clan.logs : [];
  clan.logs = [entry, ...existing].slice(0, MAX_CLAN_LOGS);
  return entry;
}

function normalizeClanRecord(c: Clan): Clan {
  const defaultBase: ClanBaseBuildingsState = {
    infirmaryLevel: Math.max(1, Math.min(4, Math.floor(Number(c.baseBuildings?.infirmaryLevel) || 1))) as 1 | 2 | 3 | 4,
    commandPostLevel: Math.max(1, Math.min(4, Math.floor(Number(c.baseBuildings?.commandPostLevel) || 1))) as 1 | 2 | 3 | 4,
    outpostLevel: Math.max(1, Math.min(4, Math.floor(Number(c.baseBuildings?.outpostLevel) || 1))) as 1 | 2 | 3 | 4,
    powerStationLevel: Math.max(1, Math.min(4, Math.floor(Number(c.baseBuildings?.powerStationLevel) || 1))) as 1 | 2 | 3 | 4,
    powerChargeUnits: Math.max(0, Math.floor(Number(c.baseBuildings?.powerChargeUnits ?? 100))),
    maxPowerChargeUnits: Math.max(100, Math.floor(Number(c.baseBuildings?.maxPowerChargeUnits ?? 200))),
    lastPowerTickAt: Number(c.baseBuildings?.lastPowerTickAt || Date.now())
  };

  return {
    ...c,
    clanNumber: c.clanNumber && Number(c.clanNumber) > 0 ? Math.floor(Number(c.clanNumber)) : undefined,
    agendaText:
      typeof c.agendaText === 'string' && c.agendaText.trim().length > 0
        ? c.agendaText
        : 'Бойцы синдиката! Держим оборону объектов недвижимости в Порту, снабжаем заводы сырьем и копим PTS на новые погоны в Военторге!',
    agendaUpdatedAt: Number(c.agendaUpdatedAt || c.createdAt || Date.now()),
    level: Math.max(1, Math.min(MAX_CLAN_LEVEL, Math.floor(Number(c.level) || 1))),
    exp: Math.max(0, Math.floor(Number(c.exp) || 0)),
    influencePoints: Math.max(0, Math.floor(Number(c.influencePoints) || 0)),
    treasuryGold: Math.max(0, Math.floor(Number(c.treasuryGold) || 0)),
    treasuryCrystals: Math.max(0, Math.floor(Number(c.treasuryCrystals) || 0)),
    pyramidTaxGoldPct: Math.max(0, Math.min(100, Number(c.pyramidTaxGoldPct ?? 15))),
    pyramidTaxCrystalPct: Math.max(0, Math.min(100, Number(c.pyramidTaxCrystalPct ?? 15))),
    unassignedPtsPool: Math.max(0, Math.floor(Number(c.unassignedPtsPool ?? 450))),
    lastEstatePtsTickAt: Number(c.lastEstatePtsTickAt || Date.now()),
    baseBuildings: defaultBase,
    diplomacy: Array.isArray(c.diplomacy) ? c.diplomacy : [],
    supplyOrders: Array.isArray(c.supplyOrders) ? c.supplyOrders : [],
    elixirs: {
      hp: Math.max(0, Math.floor(Number(c.elixirs?.hp) || 0)),
      en: Math.max(0, Math.floor(Number(c.elixirs?.en) || 0)),
      exp: Math.max(0, Math.floor(Number(c.elixirs?.exp) || 0))
    },
    achievementsProgress: {
      monstersKilled: Math.max(0, Math.floor(Number(c.achievementsProgress?.monstersKilled) || 0)),
      goldContributed: Math.max(0, Math.floor(Number(c.achievementsProgress?.goldContributed) || 0)),
      crystalsContributed: Math.max(0, Math.floor(Number(c.achievementsProgress?.crystalsContributed) || 0)),
      itemsForgedOrDeposited: Math.max(0, Math.floor(Number(c.achievementsProgress?.itemsForgedOrDeposited) || 0)),
      influenceEarned: Math.max(0, Math.floor(Number(c.achievementsProgress?.influenceEarned) || 0)),
      totalExpEarned: Math.max(0, Math.floor(Number(c.achievementsProgress?.totalExpEarned) || 0)),
      unlockedAchievementIds: Array.isArray(c.achievementsProgress?.unlockedAchievementIds)
        ? c.achievementsProgress!.unlockedAchievementIds
        : []
    },
    members: Array.isArray(c.members)
      ? c.members.map((m) => {
          const isLeader =
            m.role === 'leader' ||
            Boolean(c.leaderNick && m.nick && m.nick.trim().toLowerCase() === c.leaderNick.trim().toLowerCase());
          const isOfficer = m.role === 'officer';
          return {
            ...m,
            hasClanBadge: Boolean(m.hasClanBadge || isLeader),
            clanPts: Math.max(
              0,
              Math.floor(
                Number(
                  m.clanPts ??
                    (isLeader ? Math.max(2500, m.contributionExp || 0) : m.contributionExp || 0)
                )
              )
            ),
            rankLevel: Math.max(1, Math.min(15, Math.floor(Number(m.rankLevel ?? (isLeader ? 3 : 1))))),
            permissions: {
              canRecruitKick: Boolean(isLeader || m.permissions?.canRecruitKick || isOfficer),
              canDeclareWar: Boolean(isLeader || m.permissions?.canDeclareWar || isOfficer),
              canDistributePtsAndTreasury: Boolean(isLeader || m.permissions?.canDistributePtsAndTreasury),
              canManageBaseAndDiplomacy: Boolean(isLeader || m.permissions?.canManageBaseAndDiplomacy)
            }
          };
        })
      : [],
    storage: Array.isArray(c.storage)
      ? c.storage.map((st) => {
          if (st?.item?.isElixirLot) {
            const elxType = st.item.elixirType;
            const iconPath =
              elxType === 'hp'
                ? '/assets/elixirs/elixir_hp.png'
                : elxType === 'en'
                ? '/assets/elixirs/elixir_en.png'
                : '/assets/elixirs/elixir_exp.png';
            return {
              ...st,
              item: {
                ...st.item,
                icon: iconPath
              }
            };
          }
          return st;
        })
      : [],
    logs: Array.isArray(c.logs) ? c.logs.slice(0, MAX_CLAN_LOGS) : []
  };
}

let lastLocalClanMutationTs = 0;

function loadFromLocal(forceReload = false): void {
  if (typeof window === 'undefined') return;
  if (isInitialized && !forceReload && inMemoryClans.length > 0) {
    return;
  }
  try {
    const rawClans = localStorage.getItem(CLANS_STORAGE_KEY);
    if (rawClans) {
      const parsed = JSON.parse(rawClans);
      if (Array.isArray(parsed)) {
        inMemoryClans = parsed.map(normalizeClanRecord);
      }
    }
    const rawPyr = localStorage.getItem(CLAN_PYRAMID_KEY);
    if (rawPyr) {
      const parsedPyr = JSON.parse(rawPyr);
      if (parsedPyr && typeof parsedPyr === 'object') {
        const mergedConfig: ClanPyramidConfig = {
          ...DEFAULT_CLAN_PYRAMID_CONFIG,
          ...(parsedPyr.config || {}),
          monsters:
            Array.isArray(parsedPyr.config?.monsters) && parsedPyr.config.monsters.length > 0
              ? parsedPyr.config.monsters
              : DEFAULT_CLAN_PYRAMID_MONSTERS
        };
        const validGrid =
          Array.isArray(parsedPyr.gridCells) && parsedPyr.gridCells.length === 10
            ? parsedPyr.gridCells
            : generateClanPyramidGrid(mergedConfig);
        inMemoryPyramid = {
          ...DEFAULT_CLAN_PYRAMID_STATE,
          ...parsedPyr,
          config: mergedConfig,
          gridCells: validGrid
        };
      }
    }
    const rawTerr = localStorage.getItem(CLAN_TERRITORIES_KEY);
    if (rawTerr && (inMemoryTerritories.length === 0 || forceReload)) {
      const parsedTerr = JSON.parse(rawTerr);
      if (Array.isArray(parsedTerr) && parsedTerr.length > 0) {
        inMemoryTerritories = parsedTerr;
      }
    }
    const rawArena = localStorage.getItem(CLAN_ARENA_KEY);
    if (rawArena && (!inMemoryArena || forceReload)) {
      const parsedArena = JSON.parse(rawArena);
      if (parsedArena && typeof parsedArena === 'object') {
        inMemoryArena = parsedArena;
      }
    }
    isInitialized = true;
  } catch (e) {
    console.warn('[ClanStorage] Error loading from localStorage:', e);
  }
}

function saveToLocal(): void {
  if (typeof window === 'undefined') return;
  lastLocalClanMutationTs = Date.now();
  isInitialized = true;
  try {
    localStorage.setItem(CLANS_STORAGE_KEY, JSON.stringify(inMemoryClans));
    localStorage.setItem(CLAN_PYRAMID_KEY, JSON.stringify(inMemoryPyramid));
    if (inMemoryTerritories.length > 0) {
      localStorage.setItem(CLAN_TERRITORIES_KEY, JSON.stringify(inMemoryTerritories));
    }
    if (inMemoryArena) {
      localStorage.setItem(CLAN_ARENA_KEY, JSON.stringify(inMemoryArena));
    }
  } catch (e) {
    console.warn('[ClanStorage] Error saving to localStorage:', e);
  }
}

const DEFAULT_NPC_SYNDICATES_SEED: Array<{
  id: string;
  clanNumber: number;
  name: string;
  tag: string;
  emblem: string;
  description: string;
  agendaText: string;
  leaderNick: string;
  level: number;
  exp: number;
  influencePoints: number;
  treasuryGold: number;
  treasuryCrystals: number;
  unassignedPtsPool: number;
  infirmaryLevel: 1 | 2 | 3 | 4;
  commandPostLevel: 1 | 2 | 3 | 4;
  outpostLevel: 1 | 2 | 3 | 4;
  powerStationLevel: 1 | 2 | 3 | 4;
  members: Array<{ nick: string; role: ClanRole; lvl: number; rankLevel: number; clanPts: number }>;
}> = [
  {
    id: 'npc_clan_105_anub',
    clanNumber: 105,
    name: 'Стражи Анубиса',
    tag: 'ANUB',
    emblem: '🐺',
    description: 'Военный синдикат пустыни и охраны портовых верфей',
    agendaText: 'Патрулируем северные сектора острова. Всем сержантам и офицерам держать полный заряд Знака клана!',
    leaderNick: 'Anubis_Lord',
    level: 6,
    exp: 42000,
    influencePoints: 1850,
    treasuryGold: 185000,
    treasuryCrystals: 420,
    unassignedPtsPool: 12400,
    infirmaryLevel: 3,
    commandPostLevel: 3,
    outpostLevel: 3,
    powerStationLevel: 3,
    members: [
      { nick: 'Anubis_Lord', role: 'leader', lvl: 16, rankLevel: 13, clanPts: 210000 },
      { nick: 'Jackal_Blade', role: 'officer', lvl: 14, rankLevel: 10, clanPts: 78000 },
      { nick: 'ShadowNile', role: 'warrior', lvl: 12, rankLevel: 7, clanPts: 26000 },
      { nick: 'Khepri_Guard', role: 'warrior', lvl: 11, rankLevel: 5, clanPts: 11000 }
    ]
  },
  {
    id: 'npc_clan_204_ra',
    clanNumber: 204,
    name: 'Легион Бога Ра',
    tag: 'RA',
    emblem: '☀️',
    description: 'Элитный гвардейский синдикат Солнечной Пирамиды',
    agendaText: 'Удерживаем энергетические узлы и тяжелые мануфактуры Порта. Выдача PTS каждую субботу!',
    leaderNick: 'SolarPharaoh',
    level: 8,
    exp: 89000,
    influencePoints: 3400,
    treasuryGold: 380000,
    treasuryCrystals: 950,
    unassignedPtsPool: 24500,
    infirmaryLevel: 4,
    commandPostLevel: 4,
    outpostLevel: 4,
    powerStationLevel: 4,
    members: [
      { nick: 'SolarPharaoh', role: 'leader', lvl: 19, rankLevel: 15, clanPts: 390000 },
      { nick: 'Helios_Prime', role: 'officer', lvl: 17, rankLevel: 12, clanPts: 155000 },
      { nick: 'GoldFalcon', role: 'officer', lvl: 15, rankLevel: 11, clanPts: 112000 },
      { nick: 'Ra_Centurion', role: 'warrior', lvl: 13, rankLevel: 8, clanPts: 39000 },
      { nick: 'SunSpear', role: 'warrior', lvl: 12, rankLevel: 6, clanPts: 17500 }
    ]
  },
  {
    id: 'npc_clan_312_seth',
    clanNumber: 312,
    name: 'Братство Сета',
    tag: 'SETH',
    emblem: '🦂',
    description: 'Штурмовой синдикат рейдов и захватов недвижимости 7х7',
    agendaText: 'Готовим вечерний штурм сталелитейных заводов! За каждый бой +25% PTS против врагов.',
    leaderNick: 'DesertStorm',
    level: 5,
    exp: 29000,
    influencePoints: 1420,
    treasuryGold: 110000,
    treasuryCrystals: 260,
    unassignedPtsPool: 8900,
    infirmaryLevel: 2,
    commandPostLevel: 3,
    outpostLevel: 3,
    powerStationLevel: 2,
    members: [
      { nick: 'DesertStorm', role: 'leader', lvl: 15, rankLevel: 12, clanPts: 148000 },
      { nick: 'RedScorpion', role: 'officer', lvl: 13, rankLevel: 9, clanPts: 54000 },
      { nick: 'VenomStrike', role: 'warrior', lvl: 11, rankLevel: 6, clanPts: 16200 }
    ]
  },
  {
    id: 'npc_clan_501_nile',
    clanNumber: 501,
    name: 'Торговый Дом Нила',
    tag: 'NILE',
    emblem: '⛵',
    description: 'Купеческий и логистический синдикат Портового острова',
    agendaText: 'Открыты к военным союзам и беспошлинному обмену PTS и ресурсов с дружественными кланами!',
    leaderNick: 'NileMerchant',
    level: 4,
    exp: 19500,
    influencePoints: 980,
    treasuryGold: 240000,
    treasuryCrystals: 510,
    unassignedPtsPool: 6200,
    infirmaryLevel: 3,
    commandPostLevel: 2,
    outpostLevel: 2,
    powerStationLevel: 3,
    members: [
      { nick: 'NileMerchant', role: 'leader', lvl: 14, rankLevel: 11, clanPts: 105000 },
      { nick: 'CargoMaster', role: 'officer', lvl: 12, rankLevel: 8, clanPts: 38000 },
      { nick: 'RiverCaptain', role: 'warrior', lvl: 10, rankLevel: 5, clanPts: 10400 }
    ]
  },
  {
    id: 'npc_clan_777_phar',
    clanNumber: 777,
    name: 'Гвардия Фараона',
    tag: 'PHAR',
    emblem: '👑',
    description: 'Имперский орден хранителей древних реликвий и кузниц',
    agendaText: 'Дисциплина и честь! Офицерам следить за прочностью заводов и зарядом Зарядной станции.',
    leaderNick: 'GoldenHorus',
    level: 7,
    exp: 64000,
    influencePoints: 2650,
    treasuryGold: 290000,
    treasuryCrystals: 680,
    unassignedPtsPool: 18300,
    infirmaryLevel: 4,
    commandPostLevel: 3,
    outpostLevel: 4,
    powerStationLevel: 3,
    members: [
      { nick: 'GoldenHorus', role: 'leader', lvl: 18, rankLevel: 14, clanPts: 275000 },
      { nick: 'RoyalSphinx', role: 'officer', lvl: 15, rankLevel: 11, clanPts: 108000 },
      { nick: 'ObeliskKnight', role: 'warrior', lvl: 13, rankLevel: 8, clanPts: 36500 },
      { nick: 'LuxorDefender', role: 'warrior', lvl: 11, rankLevel: 6, clanPts: 15800 }
    ]
  },
  {
    id: 'npc_clan_8348_scar',
    clanNumber: 8348,
    name: 'Синдикат Скарабея',
    tag: 'SCAR',
    emblem: '🪲',
    description: 'Промышленный синдикат добычи руды, нефти и кварца',
    agendaText: 'Закупаем руду и нефть, копим PTS на сержантские и лейтенантские погоны.',
    leaderNick: 'ScarabKing',
    level: 3,
    exp: 11200,
    influencePoints: 640,
    treasuryGold: 65000,
    treasuryCrystals: 140,
    unassignedPtsPool: 3400,
    infirmaryLevel: 2,
    commandPostLevel: 2,
    outpostLevel: 2,
    powerStationLevel: 2,
    members: [
      { nick: 'ScarabKing', role: 'leader', lvl: 12, rankLevel: 9, clanPts: 53000 },
      { nick: 'SandMiner', role: 'officer', lvl: 10, rankLevel: 6, clanPts: 16000 },
      { nick: 'DuneScout', role: 'warrior', lvl: 9, rankLevel: 4, clanPts: 5800 }
    ]
  }
];

function ensureClanNumbersAndNpcSyndicates(): void {
  let mutated = false;

  // 1. Seed NPC syndicates if missing
  for (const seed of DEFAULT_NPC_SYNDICATES_SEED) {
    const exists = inMemoryClans.some(
      (c) =>
        c.id === seed.id ||
        c.clanNumber === seed.clanNumber ||
        c.tag.trim().toUpperCase() === seed.tag
    );
    if (!exists) {
      const npcClan: Clan = normalizeClanRecord({
        id: seed.id,
        clanNumber: seed.clanNumber,
        name: seed.name,
        tag: seed.tag,
        emblem: seed.emblem,
        description: seed.description,
        agendaText: seed.agendaText,
        leaderNick: seed.leaderNick,
        level: seed.level,
        exp: seed.exp,
        influencePoints: seed.influencePoints,
        treasuryGold: seed.treasuryGold,
        treasuryCrystals: seed.treasuryCrystals,
        unassignedPtsPool: seed.unassignedPtsPool,
        createdAt: Date.now() - 86400000 * 14,
        isOpen: true,
        joinMinLvl: 5,
        isNpcSyndicate: true,
        baseBuildings: {
          infirmaryLevel: seed.infirmaryLevel,
          commandPostLevel: seed.commandPostLevel,
          outpostLevel: seed.outpostLevel,
          powerStationLevel: seed.powerStationLevel,
          powerChargeUnits: seed.powerStationLevel * 130,
          maxPowerChargeUnits: seed.powerStationLevel * 150,
          lastPowerTickAt: Date.now()
        },
        members: seed.members.map((m) => ({
          nick: m.nick,
          role: m.role,
          lvl: m.lvl,
          avatar: seed.emblem,
          joinedAt: Date.now() - 86400000 * 10,
          contributionExp: m.clanPts,
          contributionInfluence: 250,
          clanPts: m.clanPts,
          rankLevel: m.rankLevel,
          hasClanBadge: true,
          isOnline: true,
          lastSeen: Date.now()
        })),
        storage: [],
        logs: [
          {
            id: `log_init_${seed.id}`,
            timestamp: Date.now() - 3600000 * 6,
            timeStr: new Date(Date.now() - 3600000 * 6).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            actorNick: seed.leaderNick,
            type: 'create',
            text: `Синдикат #${seed.clanNumber} [${seed.tag}] «${seed.name}» развернул базу в Порту.`,
            icon: seed.emblem
          }
        ]
      });
      inMemoryClans.push(npcClan);
      mutated = true;
    }
  }

  // 2. Ensure every clan has a unique clanNumber (#ID), prioritizing #1 [ТЕСТ] Тест for Redblack
  let primaryPlayerClan =
    inMemoryClans.find(
      (c) =>
        !c.isNpcSyndicate &&
        (c.leaderNick?.trim().toLowerCase() === 'redblack' ||
          c.members?.some((m) => m.nick.trim().toLowerCase() === 'redblack'))
    ) || inMemoryClans.find((c) => !c.isNpcSyndicate);

  if (!primaryPlayerClan) {
    const defaultRedblackClan: Clan = normalizeClanRecord({
      id: 'clan_1_test',
      clanNumber: 1,
      name: 'Тест',
      tag: 'ТЕСТ',
      emblem: '👑',
      description: 'Главный синдикат острова Порта под командованием Redblack',
      agendaText:
        'Бойцы синдиката! Держим оборону всех 20 объектов недвижимости в Порту, снабжаем заводы сырьем и копим PTS на новые погоны в Военторге!',
      leaderNick: 'Redblack',
      level: 5,
      exp: 45000,
      influencePoints: 2500,
      treasuryGold: 250000,
      treasuryCrystals: 500,
      unassignedPtsPool: 5000,
      createdAt: Date.now() - 86400000 * 30,
      isOpen: true,
      joinMinLvl: 1,
      isNpcSyndicate: false,
      baseBuildings: {
        infirmaryLevel: 2,
        commandPostLevel: 2,
        outpostLevel: 2,
        powerStationLevel: 2,
        powerChargeUnits: 250,
        maxPowerChargeUnits: 300,
        lastPowerTickAt: Date.now()
      },
      members: [
        {
          nick: 'Redblack',
          role: 'leader',
          lvl: 20,
          avatar: '👑',
          joinedAt: Date.now() - 86400000 * 30,
          contributionExp: 25000,
          contributionInfluence: 1000,
          clanPts: 25000,
          rankLevel: 10,
          hasClanBadge: true,
          isOnline: true,
          lastSeen: Date.now()
        }
      ],
      storage: [],
      logs: []
    });
    inMemoryClans.unshift(defaultRedblackClan);
    primaryPlayerClan = defaultRedblackClan;
    mutated = true;
  }

  const usedNumbers = new Set<number>();
  if (primaryPlayerClan && (!primaryPlayerClan.clanNumber || primaryPlayerClan.clanNumber <= 0)) {
    primaryPlayerClan.clanNumber = 1;
    mutated = true;
  }

  for (const clan of inMemoryClans) {
    if (clan.clanNumber && clan.clanNumber > 0 && !usedNumbers.has(clan.clanNumber)) {
      usedNumbers.add(clan.clanNumber);
    } else {
      let candidate = clan === primaryPlayerClan ? 1 : 2;
      while (usedNumbers.has(candidate)) {
        candidate++;
      }
      clan.clanNumber = candidate;
      usedNumbers.add(candidate);
      mutated = true;
    }
    if (!clan.agendaText) {
      clan.agendaText =
        'Бойцы синдиката! Держим оборону объектов недвижимости в Порту, снабжаем заводы сырьем и копим PTS на новые погоны в Военторге!';
      mutated = true;
    }
  }

  // Seed default supply orders for primaryPlayerClan if empty
  if (primaryPlayerClan && (!primaryPlayerClan.supplyOrders || primaryPlayerClan.supplyOrders.length === 0)) {
    primaryPlayerClan.supplyOrders = [
      {
        id: 'sup_init_assault',
        resourceKey: 'assault_charge',
        resourceName: 'Штурмовой Заряд',
        resourceIcon: '💣',
        requestedQty: 10,
        deliveredQty: 0,
        pricePerUnitGold: 6600,
        ptsPerUnit: 5,
        createdByNick: primaryPlayerClan.leaderNick || 'Redblack',
        createdAt: Date.now()
      },
      {
        id: 'sup_init_titanium',
        resourceKey: 'titanium_plate',
        resourceName: 'Титановая Бронепластина',
        resourceIcon: '🛡️',
        requestedQty: 15,
        deliveredQty: 0,
        pricePerUnitGold: 4700,
        ptsPerUnit: 5,
        createdByNick: primaryPlayerClan.leaderNick || 'Redblack',
        createdAt: Date.now()
      },
      {
        id: 'sup_init_power',
        resourceKey: 'power_kw',
        resourceName: 'Мощность (кВт)',
        resourceIcon: '⚡',
        requestedQty: 100,
        deliveredQty: 0,
        pricePerUnitGold: 75,
        ptsPerUnit: 1,
        createdByNick: primaryPlayerClan.leaderNick || 'Redblack',
        createdAt: Date.now()
      }
    ];
    mutated = true;
  }

  // 3. Seed an initial incoming alliance request from #501 [NILE] to player's clan if player's clan has no diplomacy entries yet
  if (primaryPlayerClan && (!primaryPlayerClan.diplomacy || primaryPlayerClan.diplomacy.length === 0)) {
    const nileClan = inMemoryClans.find((c) => c.clanNumber === 501 || c.tag === 'NILE');
    if (nileClan && nileClan.id !== primaryPlayerClan.id) {
      const now = Date.now();
      primaryPlayerClan.diplomacy = [
        {
          targetClanId: nileClan.id,
          targetClanNumber: nileClan.clanNumber || 501,
          targetClanName: nileClan.name,
          targetClanTag: nileClan.tag,
          targetClanEmblem: nileClan.emblem,
          status: 'pending_incoming',
          updatedAt: now,
          initiatedByNick: nileClan.leaderNick
        }
      ];
      nileClan.diplomacy = (nileClan.diplomacy || []).filter((d) => d.targetClanId !== primaryPlayerClan.id);
      nileClan.diplomacy.push({
        targetClanId: primaryPlayerClan.id,
        targetClanNumber: primaryPlayerClan.clanNumber || 1,
        targetClanName: primaryPlayerClan.name,
        targetClanTag: primaryPlayerClan.tag,
        targetClanEmblem: primaryPlayerClan.emblem,
        status: 'pending_outgoing',
        updatedAt: now,
        initiatedByNick: nileClan.leaderNick
      });
      mutated = true;
    }
  }

  // Sort so player's clan (#1) and lower #IDs appear cleanly
  inMemoryClans.sort((a, b) => (a.clanNumber || 9999) - (b.clanNumber || 9999));

  if (mutated) {
    saveToLocal();
  }
}

export function initClanStorage(): void {
  if (!isInitialized) {
    loadFromLocal(true);
    isInitialized = true;
  }
  ensureClanNumbersAndNpcSyndicates();
}

// -------------------------------------------------------------
// SUPABASE SYNCHRONIZATION VIA SYSTEM ROWS (__CLANS_DATA__, __CLAN_PYRAMID__) & territories TABLE
// -------------------------------------------------------------

export async function syncClansFromSupabase(): Promise<Clan[]> {
  initClanStorage();
  const client = getSupabaseClient();
  if (!client) return inMemoryClans;

  // If a local mutation (such as treasury deposit or war action) happened in the last 10 seconds,
  // skip overwriting in-memory state from an older remote snapshot.
  const isRecentLocalWrite = Date.now() - lastLocalClanMutationTs < 10000;

  try {
    const { data: rows, error } = await client
      .from('players')
      .select('email, id')
      .eq('name', '__CLANS_DATA__')
      .order('id', { ascending: false })
      .limit(1);

    const data = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!error && data && data.email) {
      try {
        const parsed = JSON.parse(data.email);
        if (parsed && Array.isArray(parsed.clans)) {
          const remoteClans: Clan[] = parsed.clans.map(normalizeClanRecord);
          const localMap = new Map<string, Clan>();
          inMemoryClans.forEach((c) => localMap.set(c.id, c));

          const clanMap = new Map<string, Clan>();
          remoteClans.forEach((remoteClan) => {
            const localClan = localMap.get(remoteClan.id);
            if (localClan) {
              // Merge logs by id so no recent logs are lost between syncs
              const logById = new Map<string, ClanLogEntry>();
              (remoteClan.logs || []).forEach((l) => logById.set(l.id, l));
              (localClan.logs || []).forEach((l) => {
                if (!logById.has(l.id)) logById.set(l.id, l);
              });
              const mergedLogs = Array.from(logById.values())
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, MAX_CLAN_LOGS);
              remoteClan.logs = mergedLogs;

              // Preserve higher member contribution counters
              const localMembersByNick = new Map<string, ClanMember>();
              (localClan.members || []).forEach((m) =>
                localMembersByNick.set(m.nick.trim().toLowerCase(), m)
              );
              remoteClan.members = (remoteClan.members || []).map((rm) => {
                const lm = localMembersByNick.get(rm.nick.trim().toLowerCase());
                const isLeader =
                  rm.role === 'leader' ||
                  (remoteClan.leaderNick &&
                    rm.nick &&
                    rm.nick.trim().toLowerCase() === remoteClan.leaderNick.trim().toLowerCase());
                if (!lm) {
                  return {
                    ...rm,
                    hasClanBadge: Boolean(rm.hasClanBadge || isLeader)
                  };
                }
                return {
                  ...rm,
                  contributionExp: Math.max(rm.contributionExp || 0, lm.contributionExp || 0),
                  contributionInfluence: Math.max(
                    rm.contributionInfluence || 0,
                    lm.contributionInfluence || 0
                  ),
                  hasClanBadge: Boolean(rm.hasClanBadge || lm.hasClanBadge || isLeader),
                  badgeIssuedAt: rm.badgeIssuedAt || lm.badgeIssuedAt
                };
              });

              if (isRecentLocalWrite) {
                remoteClan.treasuryGold = Math.max(
                  remoteClan.treasuryGold || 0,
                  localClan.treasuryGold || 0
                );
                remoteClan.treasuryCrystals = Math.max(
                  remoteClan.treasuryCrystals || 0,
                  localClan.treasuryCrystals || 0
                );
                remoteClan.influencePoints = Math.max(
                  remoteClan.influencePoints || 0,
                  localClan.influencePoints || 0
                );
                remoteClan.level = Math.max(remoteClan.level || 1, localClan.level || 1);
                if (remoteClan.level === localClan.level) {
                  remoteClan.exp = Math.max(remoteClan.exp || 0, localClan.exp || 0);
                }
                if ((localClan.storage || []).length >= (remoteClan.storage || []).length) {
                  remoteClan.storage = localClan.storage;
                }
                if (localClan.achievementsProgress) {
                  remoteClan.achievementsProgress = {
                    monstersKilled: Math.max(
                      remoteClan.achievementsProgress?.monstersKilled || 0,
                      localClan.achievementsProgress.monstersKilled || 0
                    ),
                    goldContributed: Math.max(
                      remoteClan.achievementsProgress?.goldContributed || 0,
                      localClan.achievementsProgress.goldContributed || 0
                    ),
                    crystalsContributed: Math.max(
                      remoteClan.achievementsProgress?.crystalsContributed || 0,
                      localClan.achievementsProgress.crystalsContributed || 0
                    ),
                    itemsForgedOrDeposited: Math.max(
                      remoteClan.achievementsProgress?.itemsForgedOrDeposited || 0,
                      localClan.achievementsProgress.itemsForgedOrDeposited || 0
                    ),
                    influenceEarned: Math.max(
                      remoteClan.achievementsProgress?.influenceEarned || 0,
                      localClan.achievementsProgress.influenceEarned || 0
                    ),
                    totalExpEarned: Math.max(
                      remoteClan.achievementsProgress?.totalExpEarned || 0,
                      localClan.achievementsProgress.totalExpEarned || 0
                    )
                  };
                }
              }
            }
            clanMap.set(remoteClan.id, remoteClan);
          });
          inMemoryClans.forEach((c) => {
            if (!clanMap.has(c.id)) {
              clanMap.set(c.id, c);
            }
          });
          inMemoryClans = Array.from(clanMap.values());
          if (!isRecentLocalWrite && Array.isArray(parsed.territories) && parsed.territories.length > 0) {
            inMemoryTerritories = parsed.territories;
          }
          if (!isRecentLocalWrite && parsed.arena && typeof parsed.arena === 'object') {
            inMemoryArena = parsed.arena;
          }
          try {
            localStorage.setItem(CLANS_STORAGE_KEY, JSON.stringify(inMemoryClans));
            if (inMemoryTerritories.length > 0) {
              localStorage.setItem(CLAN_TERRITORIES_KEY, JSON.stringify(inMemoryTerritories));
            }
          } catch {}
        }
      } catch (e) {
        console.warn('[ClanStorage] Failed to parse clans email JSON:', e);
      }
    }

    // Also attempt to sync from dedicated `territories` table (id, name, owner_clan_id, bonus_type, bonus_value, war_status)
    if (!isRecentLocalWrite) {
      const { data: terrRows, error: terrErr } = await client
        .from('territories')
        .select('*');
      if (!terrErr && Array.isArray(terrRows) && terrRows.length > 0) {
        const currentSectors = ensureTerritoriesLoaded();
        const rowById = new Map<string, any>();
        terrRows.forEach((r) => {
          if (r && r.id) rowById.set(String(r.id), r);
        });
        inMemoryTerritories = currentSectors.map((sec) => {
          const dbRow = rowById.get(sec.id);
          if (!dbRow) return sec;
          const ownerId = dbRow.owner_clan_id || sec.ownerClanId || null;
          const ownerClan = ownerId ? inMemoryClans.find((c) => c.id === ownerId) : undefined;
          return {
            ...sec,
            name: String(dbRow.name || sec.name),
            ownerClanId: ownerId,
            ownerClanName: dbRow.owner_clan_name || ownerClan?.name || sec.ownerClanName || null,
            ownerClanTag: dbRow.owner_clan_tag || ownerClan?.tag || sec.ownerClanTag || null,
            ownerClanEmblem: dbRow.owner_clan_emblem || ownerClan?.emblem || sec.ownerClanEmblem || null,
            capturedAt: dbRow.captured_at ? Number(dbRow.captured_at) : sec.capturedAt,
            protectionUntil: dbRow.protection_until ? Number(dbRow.protection_until) : sec.protectionUntil,
            bonusType: (dbRow.bonus_type as ClanTerritoryBonusType) || sec.bonusType,
            bonusValue: Number(dbRow.bonus_value ?? sec.bonusValue),
            warStatus: dbRow.war_status === 'war' ? 'war' : 'peace',
            warStartedAt: dbRow.war_started_at ? Number(dbRow.war_started_at) : sec.warStartedAt,
            warEndsAt: dbRow.war_ends_at ? Number(dbRow.war_ends_at) : sec.warEndsAt,
            attackerClanId: dbRow.attacker_clan_id ?? sec.attackerClanId ?? null,
            attackerClanName: dbRow.attacker_clan_name ?? sec.attackerClanName ?? null,
            attackerClanTag: dbRow.attacker_clan_tag ?? sec.attackerClanTag ?? null,
            attackerClanEmblem: dbRow.attacker_clan_emblem ?? sec.attackerClanEmblem ?? null,
            warScores:
              dbRow.war_scores && typeof dbRow.war_scores === 'object'
                ? dbRow.war_scores
                : sec.warScores || {},
            battle7x7:
              dbRow.battle_7x7 && typeof dbRow.battle_7x7 === 'object'
                ? dbRow.battle_7x7
                : sec.battle7x7 || null,
            lastBattleReport:
              dbRow.last_battle_report && typeof dbRow.last_battle_report === 'object'
                ? dbRow.last_battle_report
                : sec.lastBattleReport || null
          };
        });
        try {
          localStorage.setItem(CLAN_TERRITORIES_KEY, JSON.stringify(inMemoryTerritories));
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[ClanStorage] Exception fetching clans from Supabase:', err);
  }

  return inMemoryClans;
}

export async function saveClansToSupabase(clans?: Clan[]): Promise<boolean> {
  if (clans) {
    inMemoryClans = clans.map(normalizeClanRecord);
  }
  saveToLocal();

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    const sysName = '__CLANS_DATA__';
    const payload = JSON.stringify({
      is_clans_data: true,
      clans: inMemoryClans,
      territories: inMemoryTerritories,
      arena: inMemoryArena,
      updatedAt: Date.now()
    });

    const { data: existingRows } = await client
      .from('players')
      .select('id')
      .eq('name', sysName)
      .order('id', { ascending: false })
      .limit(1);

    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;

    if (existing && existing.id) {
      await client
        .from('players')
        .update({
          email: payload
        })
        .eq('id', existing.id);
    } else {
      await client.from('players').insert({
        name: sysName,
        email: payload,
        password: 'system_clans_lock',
        gold: 0,
        crystals: 0,
        is_admin: 0
      });
    }

    // Sync to `territories` table (supports full extended schema and graceful fallback to core 6 columns)
    if (Array.isArray(inMemoryTerritories) && inMemoryTerritories.length > 0) {
      const extendedRows = inMemoryTerritories.map((s) => ({
        id: s.id,
        name: s.name,
        owner_clan_id: s.ownerClanId || null,
        bonus_type: s.bonusType,
        bonus_value: s.bonusValue,
        war_status: s.warStatus,
        owner_clan_name: s.ownerClanName || null,
        owner_clan_tag: s.ownerClanTag || null,
        owner_clan_emblem: s.ownerClanEmblem || null,
        captured_at: s.capturedAt || null,
        protection_until: s.protectionUntil || null,
        war_started_at: s.warStartedAt || null,
        war_ends_at: s.warEndsAt || null,
        attacker_clan_id: s.attackerClanId || null,
        attacker_clan_name: s.attackerClanName || null,
        attacker_clan_tag: s.attackerClanTag || null,
        attacker_clan_emblem: s.attackerClanEmblem || null,
        war_scores: s.warScores || {},
        battle_7x7: s.battle7x7 || null,
        last_battle_report: s.lastBattleReport || null
      }));
      const baseRows = inMemoryTerritories.map((s) => ({
        id: s.id,
        name: s.name,
        owner_clan_id: s.ownerClanId || null,
        bonus_type: s.bonusType,
        bonus_value: s.bonusValue,
        war_status: s.warStatus
      }));
      Promise.resolve(
        client
          .from('territories')
          .upsert(extendedRows, { onConflict: 'id' })
      )
        .then((res: any) => {
          if (res?.error) {
            return Promise.resolve(
              client.from('territories').upsert(baseRows, { onConflict: 'id' })
            );
          }
        })
        .catch(() => {});
    }

    return true;
  } catch (err) {
    console.warn('[ClanStorage] Exception saving clans to Supabase:', err);
    return false;
  }
}

export async function syncClanPyramidFromSupabase(): Promise<ClanPyramidState> {
  loadFromLocal();
  const client = getSupabaseClient();
  if (!client) return inMemoryPyramid;

  try {
    const { data: rows, error } = await client
      .from('players')
      .select('email, id')
      .eq('name', '__CLAN_PYRAMID__')
      .order('id', { ascending: false })
      .limit(1);

    const data = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!error && data && data.email) {
      try {
        const parsed = JSON.parse(data.email);
        if (parsed && parsed.pyramid) {
          const pyr = parsed.pyramid;
          const mergedConfig: ClanPyramidConfig = {
            ...DEFAULT_CLAN_PYRAMID_CONFIG,
            ...(pyr.config || {}),
            monsters:
              Array.isArray(pyr.config?.monsters) && pyr.config.monsters.length > 0
                ? pyr.config.monsters
                : DEFAULT_CLAN_PYRAMID_MONSTERS
          };
          inMemoryPyramid = {
            ...DEFAULT_CLAN_PYRAMID_STATE,
            ...pyr,
            config: mergedConfig,
            gridCells:
              Array.isArray(pyr.gridCells) && pyr.gridCells.length === 10
                ? pyr.gridCells
                : inMemoryPyramid.gridCells || generateClanPyramidGrid(mergedConfig)
          };
          saveToLocal();
          return inMemoryPyramid;
        }
      } catch (e) {
        console.warn('[ClanStorage] Failed to parse pyramid email JSON:', e);
      }
    }
  } catch (err) {
    console.warn('[ClanStorage] Exception fetching clan pyramid from Supabase:', err);
  }

  return inMemoryPyramid;
}

export async function saveClanPyramidToSupabase(pyramid?: ClanPyramidState): Promise<boolean> {
  if (pyramid) {
    inMemoryPyramid = pyramid;
  }
  saveToLocal();

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    const sysName = '__CLAN_PYRAMID__';
    const payload = JSON.stringify({
      is_clan_pyramid: true,
      pyramid: inMemoryPyramid,
      updatedAt: Date.now()
    });

    const { data: existingRows } = await client
      .from('players')
      .select('id')
      .eq('name', sysName)
      .order('id', { ascending: false })
      .limit(1);

    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;

    if (existing && existing.id) {
      await client
        .from('players')
        .update({
          email: payload
        })
        .eq('id', existing.id);
    } else {
      await client.from('players').insert({
        name: sysName,
        email: payload,
        password: 'system_pyramid_lock',
        gold: 0,
        crystals: 0,
        is_admin: 0
      });
    }
    return true;
  } catch (err) {
    console.warn('[ClanStorage] Exception saving clan pyramid to Supabase:', err);
    return false;
  }
}

// -------------------------------------------------------------
// CLAN RETRIEVAL & CRUD
// -------------------------------------------------------------

export function getAllClans(): Clan[] {
  initClanStorage();
  return inMemoryClans;
}

export function getClanById(clanId?: string | null): Clan | undefined {
  if (!clanId) return undefined;
  initClanStorage();
  return inMemoryClans.find((c) => c.id === clanId);
}

export function getPlayerClan(nick?: string | null, clanId?: string | null): Clan | undefined {
  initClanStorage();

  // 1. If clanId is provided, look up by clanId first
  if (clanId) {
    const byId = inMemoryClans.find((c) => c.id === clanId);
    if (byId) {
      // Ensure nick is registered in members if provided
      if (nick) {
        const lower = nick.trim().toLowerCase();
        if (!byId.members.some((m) => m.nick.trim().toLowerCase() === lower)) {
          byId.members.push({
            nick: nick.trim(),
            role: byId.leaderNick.trim().toLowerCase() === lower ? 'leader' : 'warrior',
            lvl: 1,
            avatar: '🧙‍♂️',
            joinedAt: Date.now(),
            contributionExp: 0,
            contributionInfluence: 0,
            isOnline: true,
            lastSeen: Date.now()
          });
          saveToLocal();
        }
      }
      return byId;
    }
  }

  // 2. If nick is provided, look up by member nick or leader nick
  if (nick) {
    const lower = nick.trim().toLowerCase();
    const byMember = inMemoryClans.find(
      (c) =>
        c.members.some((m) => m.nick.trim().toLowerCase() === lower) ||
        c.leaderNick.trim().toLowerCase() === lower
    );
    if (byMember) return byMember;
  }

  return undefined;
}

/**
 * Ensures that if a player has clan fields on their HeroState (e.g. from database profile),
 * the clan is guaranteed to exist in storage and members list.
 */
export function ensureClanExistsFromHero(hero: HeroState, nick?: string | null): Clan | undefined {
  initClanStorage();
  const effectiveNick = (nick || hero.nick || 'Игрок').trim();

  if (!hero.clanId) {
    return getPlayerClan(effectiveNick);
  }

  let clan = inMemoryClans.find((c) => c.id === hero.clanId);

  if (!clan && hero.clanTag) {
    clan = normalizeClanRecord({
      id: hero.clanId,
      name: hero.clanName || `Клан [${hero.clanTag}]`,
      tag: hero.clanTag,
      emblem: hero.clanEmblem || '🛡️',
      description: 'Отважные воины песков',
      leaderNick: hero.clanRole === 'leader' ? effectiveNick : 'Глава',
      level: 1,
      exp: 0,
      elixirs: { hp: 0, en: 0, exp: 0 },
      influencePoints: 0,
      treasuryGold: 0,
      treasuryCrystals: 0,
      createdAt: Date.now(),
      members: [
        {
          nick: effectiveNick,
          role: hero.clanRole || 'leader',
          lvl: Math.max(1, hero.level || 1),
          avatar: hero.avatar || '🧙‍♂️',
          joinedAt: Date.now(),
          contributionExp: 0,
          contributionInfluence: 0,
          isOnline: true,
          lastSeen: Date.now()
        }
      ],
      storage: [],
      isOpen: true,
      joinMinLvl: 1
    });
    inMemoryClans.push(clan);
    saveToLocal();
    saveClansToSupabase();
  } else if (clan) {
    const lower = effectiveNick.toLowerCase();
    const existingMember = clan.members.find((m) => m.nick.trim().toLowerCase() === lower);
    if (!existingMember) {
      clan.members.push({
        nick: effectiveNick,
        role: hero.clanRole || 'warrior',
        lvl: Math.max(1, hero.level || 1),
        avatar: hero.avatar || '🧙‍♂️',
        joinedAt: Date.now(),
        contributionExp: 0,
        contributionInfluence: 0,
        isOnline: true,
        lastSeen: Date.now()
      });
      saveToLocal();
      saveClansToSupabase();
    } else {
      existingMember.lvl = Math.max(existingMember.lvl || 1, hero.level || 1);
      existingMember.lastSeen = Date.now();
      existingMember.isOnline = true;
    }
  }

  return clan;
}

export function createClan(
  leaderNick: string,
  leaderLvl: number,
  leaderAvatar: string,
  name: string,
  tag: string,
  emblem: string,
  description: string
): { ok: boolean; clan?: Clan; error?: string } {
  initClanStorage();

  const trimmedName = name.trim();
  const trimmedTag = tag.trim().toUpperCase();

  if (trimmedName.length < 3 || trimmedName.length > 24) {
    return { ok: false, error: 'Название клана должно содержать от 3 до 24 символов.' };
  }
  if (trimmedTag.length < 2 || trimmedTag.length > 6) {
    return { ok: false, error: 'Тег клана должен содержать от 2 до 6 символов (например, WAR).' };
  }
  if (!emblem) {
    return { ok: false, error: 'Выберите или загрузите эмблему клана.' };
  }

  // Check if player is already in a clan
  const existingClan = getPlayerClan(leaderNick);
  if (existingClan) {
    return { ok: false, error: `Вы уже состоите в клане «${existingClan.name}». Сначала покиньте его.` };
  }

  // Check name and tag uniqueness
  const lowerName = trimmedName.toLowerCase();
  const lowerTag = trimmedTag.toLowerCase();
  if (inMemoryClans.some((c) => c.name.toLowerCase() === lowerName)) {
    return { ok: false, error: 'Клан с таким названием уже существует.' };
  }
  if (inMemoryClans.some((c) => c.tag.toLowerCase() === lowerTag)) {
    return { ok: false, error: 'Клан с таким тегом уже существует.' };
  }

  const newClan: Clan = normalizeClanRecord({
    id: `clan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: trimmedName,
    tag: trimmedTag,
    emblem,
    description: description.trim() || 'Отважные воины песков',
    leaderNick,
    level: 1,
    exp: 0,
    elixirs: { hp: 0, en: 0, exp: 0 },
    influencePoints: 0,
    treasuryGold: 0,
    treasuryCrystals: 0,
    createdAt: Date.now(),
    members: [
      {
        nick: leaderNick,
        role: 'leader',
        lvl: Math.max(1, leaderLvl),
        avatar: leaderAvatar,
        joinedAt: Date.now(),
        contributionExp: 0,
        contributionInfluence: 0,
        isOnline: true,
        lastSeen: Date.now()
      }
    ],
    storage: [],
    logs: [],
    isOpen: true,
    joinMinLvl: 1
  });

  addClanLogEntry(
    newClan,
    leaderNick,
    'create',
    `Основал клан «${trimmedName}» [${trimmedTag}]`,
    '🏰'
  );

  inMemoryClans.push(newClan);
  saveClansToSupabase();

  return { ok: true, clan: newClan };
}

export function joinClan(
  clanId: string,
  nick: string,
  lvl: number,
  avatar?: string
): { ok: boolean; clan?: Clan; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) {
    return { ok: false, error: 'Клан не найден.' };
  }

  const currentClan = getPlayerClan(nick);
  if (currentClan && currentClan.id !== clanId) {
    return { ok: false, error: `Вы уже состоите в клане «${currentClan.name}». Сначала выйдите из него.` };
  }
  if (currentClan && currentClan.id === clanId) {
    return { ok: true, clan };
  }

  if (!clan.isOpen) {
    return { ok: false, error: 'Прием в этот клан сейчас закрыт главой.' };
  }

  if (clan.joinMinLvl && lvl < clan.joinMinLvl) {
    return { ok: false, error: `Для вступления требуется минимум ${clan.joinMinLvl} уровень.` };
  }

  const newMember: ClanMember = {
    nick: nick.trim(),
    role: 'warrior',
    lvl: Math.max(1, lvl),
    avatar: avatar || '🧙‍♂️',
    joinedAt: Date.now(),
    contributionExp: 0,
    contributionInfluence: 0,
    isOnline: true,
    lastSeen: Date.now()
  };

  clan.members.push(newMember);
  addClanLogEntry(
    clan,
    nick.trim(),
    'join',
    `Вступил в клан (${Math.max(1, lvl)} ур.)`,
    '🛡️'
  );
  saveClansToSupabase();

  return { ok: true, clan };
}

/**
 * Позволяет любому игроку свободно выйти из клана в любой момент.
 * - Арендованные вещи автоматически возвращаются на базу клана.
 * - Если выходит лидер и в клане есть другие участники — лидерство передается следующему участнику.
 * - Если лидер был единственным участником — клан распускается.
 */
export function leaveClan(
  clanId: string,
  nick: string
): { ok: boolean; disbanded?: boolean; newLeaderNick?: string; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId) || getPlayerClan(nick, clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const cleanNick = nick.trim().toLowerCase();
  const memberIndex = clan.members.findIndex((m) => m.nick.trim().toLowerCase() === cleanNick);

  // Return any items rented by this member back to the clan storage
  clan.storage.forEach((st) => {
    if (st.isRented && st.rentedByNick && st.rentedByNick.trim().toLowerCase() === cleanNick) {
      st.isRented = false;
      st.rentedByNick = undefined;
      st.rentedAt = undefined;
    }
  });

  const isLeader = clan.leaderNick.trim().toLowerCase() === cleanNick;

  if (memberIndex !== -1) {
    clan.members.splice(memberIndex, 1);
  }

  if (clan.members.length === 0) {
    // Disband clan if no members remain
    disbandClan(clan.id, nick, true);
    return { ok: true, disbanded: true };
  }

  let newLeaderNick: string | undefined;
  if (isLeader && clan.members.length > 0) {
    // Sort remaining members: officers first, then highest level
    const sorted = [...clan.members].sort((a, b) => {
      if (a.role === 'officer' && b.role !== 'officer') return -1;
      if (b.role === 'officer' && a.role !== 'officer') return 1;
      return (b.lvl || 1) - (a.lvl || 1);
    });
    const nextLeader = sorted[0];
    clan.leaderNick = nextLeader.nick;
    nextLeader.role = 'leader';
    newLeaderNick = nextLeader.nick;
  }

  addClanLogEntry(
    clan,
    nick.trim(),
    'leave',
    newLeaderNick
      ? `Вышел из клана (лидерство перешло к ${newLeaderNick})`
      : 'Вышел из клана',
    '🚪'
  );

  saveClansToSupabase();
  return { ok: true, newLeaderNick };
}

export function kickClanMember(
  clanId: string,
  actorNick: string,
  targetNick: string,
  isAdmin = false
): { ok: boolean; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const isLeader = clan.leaderNick.toLowerCase() === actorNick.toLowerCase();
  if (!isAdmin && !isLeader) return { ok: false, error: 'Только лидер клана или администратор может исключать участников.' };

  if (!isAdmin && targetNick.toLowerCase() === actorNick.toLowerCase()) {
    return { ok: false, error: 'Используйте кнопку «Выйти из клана».' };
  }

  const memberIdx = clan.members.findIndex((m) => m.nick.toLowerCase() === targetNick.toLowerCase());
  if (memberIdx === -1) return { ok: false, error: 'Игрок не найден в клане.' };

  // Return any items rented by kicked member
  clan.storage.forEach((st) => {
    if (st.isRented && st.rentedByNick && st.rentedByNick.toLowerCase() === targetNick.toLowerCase()) {
      st.isRented = false;
      st.rentedByNick = undefined;
      st.rentedAt = undefined;
    }
  });

  clan.members.splice(memberIdx, 1);
  addClanLogEntry(
    clan,
    actorNick,
    'kick',
    `Исключил участника ${targetNick} из клана`,
    '👢'
  );
  saveClansToSupabase();
  return { ok: true };
}

export function transferClanLeadership(
  clanId: string,
  currentLeaderNick: string,
  targetMemberNick: string,
  isAdmin = false
): { ok: boolean; clan?: Clan; newLeaderNick?: string; message?: string; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const cleanActor = currentLeaderNick.trim().toLowerCase();
  const rawTarget = targetMemberNick.trim();
  const cleanTarget = rawTarget.toLowerCase();
  if (!rawTarget) {
    return { ok: false, error: 'Введите никнейм нового Главы клана!' };
  }
  const isLeader = clan.leaderNick.trim().toLowerCase() === cleanActor;

  if (!isAdmin && !isLeader) {
    return { ok: false, error: 'Передать управление кланом может только действующий глава клана или Администратор!' };
  }

  if (cleanTarget === clan.leaderNick.trim().toLowerCase()) {
    return { ok: false, error: 'Этот игрок уже является главой клана.' };
  }

  let targetMember = clan.members.find((m) => m.nick.trim().toLowerCase() === cleanTarget);
  if (!targetMember) {
    targetMember = {
      nick: rawTarget,
      role: 'leader',
      lvl: 10,
      avatar: '👑',
      joinedAt: Date.now(),
      contributionExp: 0,
      contributionInfluence: 0,
      clanPts: 0,
      rankLevel: 1,
      hasClanBadge: true,
      isOnline: true,
      lastSeen: Date.now()
    };
    clan.members.push(targetMember);
  }

  const oldLeaderNick = clan.leaderNick;
  clan.leaderNick = targetMember.nick;
  clan.members.forEach((m) => {
    if (m.nick.trim().toLowerCase() === cleanTarget) {
      m.role = 'leader';
      m.hasClanBadge = true;
    } else if (m.role === 'leader') {
      m.role = 'officer';
    }
  });

  const msg = `Передал управление синдикатом #${clan.clanNumber || 1} [${clan.tag}] и корону Главы игроку ${targetMember.nick} (прежний глава: ${oldLeaderNick})`;
  addClanLogEntry(
    clan,
    currentLeaderNick || 'Администратор',
    'transfer_leader',
    msg,
    '👑'
  );

  saveClansToSupabase();
  return { ok: true, clan, newLeaderNick: targetMember.nick, message: `👑 ${msg}` };
}

export function addClanExp(
  clanId: string,
  expAmount: number,
  contributorNick?: string,
  monstersKilledIncrement = 1
): { clan?: Clan; leveledUp: boolean; newLevel: number } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan || expAmount <= 0) {
    return { clan, leveledUp: false, newLevel: clan?.level || 1 };
  }

  const add = Math.max(0, Math.floor(expAmount));
  clan.level = Math.max(1, Math.min(MAX_CLAN_LEVEL, Number(clan.level) || 1));
  clan.exp = Math.max(0, Math.floor(Number(clan.exp) || 0)) + add;

  let leveledUp = false;
  while (clan.level < MAX_CLAN_LEVEL) {
    const needed = getClanExpForNextLevel(clan.level);
    if (needed > 0 && clan.exp >= needed) {
      clan.exp -= needed;
      clan.level += 1;
      leveledUp = true;
    } else {
      break;
    }
  }

  if (clan.level >= MAX_CLAN_LEVEL) {
    clan.level = MAX_CLAN_LEVEL;
  }

  if (contributorNick) {
    const m = clan.members.find((mem) => mem.nick.trim().toLowerCase() === contributorNick.trim().toLowerCase());
    if (m) {
      m.contributionExp = (m.contributionExp || 0) + add;
    }
  }

  recordClanAchievementProgress(clan, 'totalExpEarned', add, contributorNick, false);
  if (monstersKilledIncrement > 0) {
    recordClanAchievementProgress(clan, 'monstersKilled', monstersKilledIncrement, contributorNick, false);
  }

  saveClansToSupabase();
  return { clan, leveledUp, newLevel: clan.level };
}

export function updateClanInfo(
  clanId: string,
  actorNick: string,
  updates: {
    name?: string;
    tag?: string;
    emblem?: string;
    description?: string;
    isOpen?: boolean;
    joinMinLvl?: number;
    leaderNick?: string;
    level?: number;
    exp?: number;
    maxStorageOverride?: number;
    influencePoints?: number;
    treasuryGold?: number;
    treasuryCrystals?: number;
    pyramidTaxGoldPct?: number;
    pyramidTaxCrystalPct?: number;
    elixirs?: { hp: number; en: number; exp: number };
  },
  isAdmin = false
): { ok: boolean; clan?: Clan; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  if (!isAdmin && clan.leaderNick.toLowerCase() !== actorNick.toLowerCase()) {
    return { ok: false, error: 'Только лидер клана или администратор может менять данные клана.' };
  }

  if (updates.name !== undefined) {
    const trimmed = updates.name.trim();
    if (trimmed.length < 3 || trimmed.length > 24) {
      return { ok: false, error: 'Название клана должно содержать от 3 до 24 символов.' };
    }
    const lower = trimmed.toLowerCase();
    if (inMemoryClans.some((c) => c.id !== clanId && c.name.toLowerCase() === lower)) {
      return { ok: false, error: 'Клан с таким названием уже существует.' };
    }
    clan.name = trimmed;
  }

  if (updates.tag !== undefined) {
    const trimmedTag = updates.tag.trim().toUpperCase();
    if (trimmedTag.length < 2 || trimmedTag.length > 6) {
      return { ok: false, error: 'Тег клана должен содержать от 2 до 6 символов.' };
    }
    const lowerTag = trimmedTag.toLowerCase();
    if (inMemoryClans.some((c) => c.id !== clanId && c.tag.toLowerCase() === lowerTag)) {
      return { ok: false, error: 'Клан с таким тегом уже существует.' };
    }
    clan.tag = trimmedTag;
  }

  if (updates.emblem !== undefined && updates.emblem !== clan.emblem) {
    clan.emblem = updates.emblem;
    if (inMemoryPyramid.controlledByClanId === clan.id) {
      inMemoryPyramid.controlledByClanEmblem = updates.emblem;
      saveClanPyramidToSupabase();
    }
    addClanLogEntry(
      clan,
      actorNick,
      'create',
      `Обновил герб клана [${clan.tag}]`,
      '🎨'
    );
  }
  if (updates.description !== undefined) {
    clan.description = updates.description.trim();
  }
  if (updates.isOpen !== undefined) {
    clan.isOpen = updates.isOpen;
  }
  if (updates.joinMinLvl !== undefined) {
    clan.joinMinLvl = Math.max(1, Math.min(20, Number(updates.joinMinLvl) || 1));
  }
  if (updates.level !== undefined) {
    clan.level = Math.max(1, Math.min(MAX_CLAN_LEVEL, Math.floor(Number(updates.level) || 1)));
  }
  if (updates.exp !== undefined) {
    clan.exp = Math.max(0, Math.floor(Number(updates.exp) || 0));
  }
  if (updates.maxStorageOverride !== undefined) {
    const val = Math.floor(Number(updates.maxStorageOverride) || 0);
    clan.maxStorageOverride = val > 0 ? val : undefined;
  }
  if (updates.influencePoints !== undefined) {
    clan.influencePoints = Math.max(0, Math.floor(Number(updates.influencePoints) || 0));
  }
  if (updates.treasuryGold !== undefined) {
    clan.treasuryGold = Math.max(0, Math.floor(Number(updates.treasuryGold) || 0));
  }
  if (updates.treasuryCrystals !== undefined) {
    clan.treasuryCrystals = Math.max(0, Math.floor(Number(updates.treasuryCrystals) || 0));
  }
  if (updates.pyramidTaxGoldPct !== undefined) {
    clan.pyramidTaxGoldPct = Math.max(0, Math.min(100, Math.floor(Number(updates.pyramidTaxGoldPct) || 0)));
  }
  if (updates.pyramidTaxCrystalPct !== undefined) {
    clan.pyramidTaxCrystalPct = Math.max(0, Math.min(100, Math.floor(Number(updates.pyramidTaxCrystalPct) || 0)));
  }
  if (updates.elixirs !== undefined) {
    clan.elixirs = {
      hp: Math.max(0, Math.floor(Number(updates.elixirs.hp) || 0)),
      en: Math.max(0, Math.floor(Number(updates.elixirs.en) || 0)),
      exp: Math.max(0, Math.floor(Number(updates.elixirs.exp) || 0))
    };
  }
  if (updates.leaderNick !== undefined) {
    const newLead = updates.leaderNick.trim();
    const isMember = clan.members.some((m) => m.nick.toLowerCase() === newLead.toLowerCase());
    if (isMember) {
      clan.leaderNick = newLead;
      clan.members.forEach((m) => {
        if (m.nick.toLowerCase() === newLead.toLowerCase()) {
          m.role = 'leader';
        } else if (m.role === 'leader') {
          m.role = 'officer';
        }
      });
    }
  }

  saveClansToSupabase();
  return { ok: true, clan };
}

/**
 * Начисляет золото и кристаллы в счёт казны клана ТОЛЬКО с игры в Клановой Пирамиде.
 * Процент настраивается лидером клана (например 15-20%).
 * ВНИМАНИЕ: Вызывается ИСКЛЮЧИТЕЛЬНО из Клановой Пирамиды, с обычной пирамиды поступлений нет.
 */
export function creditClanTreasuryFromClanPyramid(
  clanId: string,
  actorNick: string,
  earnedGold: number,
  earnedCrystals: number,
  actionDesc = 'добыча в Клановой Пирамиде'
): { ok: boolean; addedGold: number; addedCrystals: number; newTreasuryGold: number; newTreasuryCrystals: number } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) {
    return { ok: false, addedGold: 0, addedCrystals: 0, newTreasuryGold: 0, newTreasuryCrystals: 0 };
  }

  const taxGoldPct = Math.max(0, Math.min(100, Number(clan.pyramidTaxGoldPct ?? 15)));
  const taxCrystalPct = Math.max(0, Math.min(100, Number(clan.pyramidTaxCrystalPct ?? 15)));

  const addedGold = Math.max(0, Math.round(Number(earnedGold || 0) * (taxGoldPct / 100)));
  let addedCrystals = 0;
  if (earnedCrystals > 0 && taxCrystalPct > 0) {
    addedCrystals = Math.max(1, Math.round(Number(earnedCrystals) * (taxCrystalPct / 100)));
  }

  if (addedGold <= 0 && addedCrystals <= 0) {
    return {
      ok: true,
      addedGold: 0,
      addedCrystals: 0,
      newTreasuryGold: clan.treasuryGold || 0,
      newTreasuryCrystals: clan.treasuryCrystals || 0
    };
  }

  clan.treasuryGold = Math.max(0, Math.floor(Number(clan.treasuryGold) || 0) + addedGold);
  clan.treasuryCrystals = Math.max(0, Math.floor(Number(clan.treasuryCrystals) || 0) + addedCrystals);

  const parts: string[] = [];
  if (addedGold > 0) parts.push(`+${addedGold} 🪙`);
  if (addedCrystals > 0) parts.push(`+${addedCrystals} 💎`);

  addClanLogEntry(
    clan,
    actorNick,
    'pyramid_income',
    `Поступление в счёт клана (${actionDesc}): ${parts.join(', ')} (налог: ${taxGoldPct}%🪙 / ${taxCrystalPct}%💎)`,
    '🏦'
  );

  if (addedGold > 0) {
    recordClanAchievementProgress(clan, 'goldContributed', addedGold, actorNick, false);
  }
  if (addedCrystals > 0) {
    recordClanAchievementProgress(clan, 'crystalsContributed', addedCrystals, actorNick, false);
  }

  saveClansToSupabase();

  return {
    ok: true,
    addedGold,
    addedCrystals,
    newTreasuryGold: clan.treasuryGold,
    newTreasuryCrystals: clan.treasuryCrystals
  };
}

export function adminAddOrUpdateClanMember(
  clanId: string,
  nick: string,
  role: ClanRole = 'warrior',
  lvl = 1
): { ok: boolean; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const cleanNick = nick.trim();
  if (!cleanNick) return { ok: false, error: 'Введите ник игрока.' };

  const existing = clan.members.find((m) => m.nick.toLowerCase() === cleanNick.toLowerCase());
  if (existing) {
    existing.role = role;
    existing.lvl = Math.max(1, lvl);
  } else {
    clan.members.push({
      nick: cleanNick,
      role,
      lvl: Math.max(1, lvl),
      avatar: '🧙‍♂️',
      joinedAt: Date.now(),
      contributionExp: 0,
      contributionInfluence: 0,
      isOnline: false,
      lastSeen: Date.now()
    });
  }

  if (role === 'leader') {
    clan.leaderNick = cleanNick;
    clan.members.forEach((m) => {
      if (m.nick.toLowerCase() !== cleanNick.toLowerCase() && m.role === 'leader') {
        m.role = 'officer';
      }
    });
  }

  saveClansToSupabase();
  return { ok: true };
}

export function disbandClan(
  clanId: string,
  actorNick: string,
  isAdmin = false
): { ok: boolean; returnedItems: { ownerNick: string; item: GameItem }[]; error?: string } {
  initClanStorage();
  const clanIndex = inMemoryClans.findIndex((c) => c.id === clanId);
  if (clanIndex === -1) return { ok: false, returnedItems: [], error: 'Клан не найден.' };

  const clan = inMemoryClans[clanIndex];
  if (!isAdmin && clan.leaderNick.toLowerCase() !== actorNick.toLowerCase()) {
    return { ok: false, returnedItems: [], error: 'Только лидер клана или администратор может распустить клан.' };
  }

  // All personal storage items are returned to their original owners (clan-created items belong to the clan treasury)
  const returnedItems: { ownerNick: string; item: GameItem }[] = [];
  clan.storage.forEach((st) => {
    if (st.itemType !== 'elixir' && !st.item.isClanCreated) {
      const cleanItem: GameItem = {
        ...st.item,
        isClanRented: false,
        clanStorageId: undefined,
        rentedByNick: undefined
      };
      returnedItems.push({
        ownerNick: st.originalOwnerNick,
        item: cleanItem
      });
    }
  });

  // If clan was controlling the Pyramid, reset control
  if (inMemoryPyramid.controlledByClanId === clanId) {
    inMemoryPyramid.controlledByClanId = null;
    inMemoryPyramid.controlledByClanName = null;
    inMemoryPyramid.controlledByClanTag = null;
    inMemoryPyramid.controlledByClanEmblem = null;
    saveClanPyramidToSupabase();
  }

  inMemoryClans.splice(clanIndex, 1);
  saveClansToSupabase();

  return { ok: true, returnedItems };
}

// -------------------------------------------------------------
// CLAN STORAGE & RENTAL ("БАЗА ВЕЩЕЙ И ЭЛИКСИРОВ")
// -------------------------------------------------------------

function ensureMemberInClanAndAwardContribution(
  clan: Clan,
  actorNick: string,
  expGain: number,
  influenceGain: number
): void {
  const cleanNick = String(actorNick || '').trim();
  if (!cleanNick) return;
  const lower = cleanNick.toLowerCase();
  if (!Array.isArray(clan.members)) clan.members = [];

  let member = clan.members.find((m) => m.nick.trim().toLowerCase() === lower);
  if (!member) {
    member = {
      nick: cleanNick,
      role: clan.leaderNick.trim().toLowerCase() === lower ? 'leader' : 'warrior',
      lvl: 1,
      avatar: '🧙‍♂️',
      joinedAt: Date.now(),
      contributionExp: 0,
      contributionInfluence: 0,
      isOnline: true,
      lastSeen: Date.now()
    };
    clan.members.push(member);
  }

  if (expGain > 0) {
    member.contributionExp = Math.max(0, Number(member.contributionExp || 0)) + expGain;
    clan.exp = Math.max(0, Number(clan.exp || 0)) + expGain;
    clan.level = Math.max(1, Math.min(MAX_CLAN_LEVEL, Number(clan.level) || 1));
    while (clan.level < MAX_CLAN_LEVEL) {
      const needed = getClanExpForNextLevel(clan.level);
      if (needed > 0 && clan.exp >= needed) {
        clan.exp -= needed;
        clan.level += 1;
      } else {
        break;
      }
    }
    recordClanAchievementProgress(clan, 'totalExpEarned', expGain, cleanNick, false);
  }

  if (influenceGain > 0) {
    member.contributionInfluence =
      Math.max(0, Number(member.contributionInfluence || 0)) + influenceGain;
    clan.influencePoints = Math.max(0, Number(clan.influencePoints || 0)) + influenceGain;
  }
}

export function depositItemToClanStorage(
  clanId: string,
  depositorNick: string,
  item: GameItem
): { ok: boolean; storageItem?: ClanStorageItem; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId) || getPlayerClan(depositorNick, clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  if (item.rent || item.isClanRented) {
    return { ok: false, error: 'Предмет, уже находящийся в аренде, нельзя положить на базу.' };
  }

  const maxCap = getClanMaxStorageCapacity(clan);
  if (clan.storage.length >= maxCap) {
    return {
      ok: false,
      error: `База клана заполнена (${clan.storage.length}/${maxCap} мест). Повышайте уровень клана (+10 мест за каждый уровень)!`
    };
  }

  const storageId = `cst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanItem: GameItem = {
    ...item,
    clanStorageId: storageId,
    originalOwnerNick: depositorNick,
    clanOwnerId: clan.id,
    clanOwnerName: clan.name,
    clanOwnerTag: clan.tag,
    isClanRented: false,
    rentedByNick: undefined
  };

  const newStorageItem: ClanStorageItem = {
    id: storageId,
    itemType: 'equipment',
    item: cleanItem,
    originalOwnerNick: depositorNick,
    depositedAt: Date.now(),
    isRented: false
  };

  clan.storage.push(newStorageItem);
  ensureMemberInClanAndAwardContribution(clan, depositorNick, 50, 25);
  addClanLogEntry(
    clan,
    depositorNick,
    'deposit_item',
    `Положил вещь на базу: «${item.name}» (${item.lvl} ур.) [+50 ✨ EXP / +25 ⭐]`,
    item.icon || '📦'
  );
  recordClanAchievementProgress(clan, 'itemsForgedOrDeposited', 1, depositorNick, false);
  saveToLocal();
  saveClansToSupabase();

  return { ok: true, storageItem: newStorageItem };
}

/**
 * Пополнить казну базы клана золотом.
 */
export function depositGoldToClanTreasury(
  clanId: string,
  depositorNick: string,
  goldAmount: number
): { ok: boolean; newTreasuryGold?: number; expGained?: number; influenceGained?: number; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId) || getPlayerClan(depositorNick, clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const amount = Math.floor(Number(goldAmount) || 0);
  if (amount <= 0) return { ok: false, error: 'Введите корректную сумму золота.' };

  const expGained = Math.max(2, Math.floor(amount / 50));
  const influenceGained = Math.max(1, Math.floor(amount / 100));

  clan.treasuryGold = Math.max(0, Math.floor(Number(clan.treasuryGold) || 0)) + amount;
  ensureMemberInClanAndAwardContribution(clan, depositorNick, expGained, influenceGained);
  addClanLogEntry(
    clan,
    depositorNick,
    'deposit_gold',
    `Пополнил казну клана на +${amount.toLocaleString('ru-RU')} 🪙 золота (+${expGained} ✨ EXP / +${influenceGained} ⭐ Влияния)`,
    '🪙'
  );
  recordClanAchievementProgress(clan, 'goldContributed', amount, depositorNick, false);
  saveToLocal();
  recordClanPlayerActivity(depositorNick, clan.id, 'donate_gold', amount, 0, undefined, false);
  saveClansToSupabase();

  return { ok: true, newTreasuryGold: clan.treasuryGold, expGained, influenceGained };
}

/**
 * Пополнить казну базы клана кристаллами.
 */
export function depositCrystalsToClanTreasury(
  clanId: string,
  depositorNick: string,
  crystalAmount: number
): { ok: boolean; newTreasuryCrystals?: number; expGained?: number; influenceGained?: number; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId) || getPlayerClan(depositorNick, clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const amount = Math.floor(Number(crystalAmount) || 0);
  if (amount <= 0) return { ok: false, error: 'Введите корректную сумму кристаллов.' };

  const expGained = Math.max(10, amount * 5);
  const influenceGained = Math.max(5, amount * 2);

  clan.treasuryCrystals = Math.max(0, Math.floor(Number(clan.treasuryCrystals) || 0)) + amount;
  ensureMemberInClanAndAwardContribution(clan, depositorNick, expGained, influenceGained);
  addClanLogEntry(
    clan,
    depositorNick,
    'deposit_crystals',
    `Пополнил казну клана на +${amount.toLocaleString('ru-RU')} 💎 кристаллов (+${expGained} ✨ EXP / +${influenceGained} ⭐ Влияния)`,
    '💎'
  );
  recordClanAchievementProgress(clan, 'crystalsContributed', amount, depositorNick, false);
  saveToLocal();
  recordClanPlayerActivity(depositorNick, clan.id, 'donate_gold', amount * 100, 0, undefined, false);
  saveClansToSupabase();

  return { ok: true, newTreasuryCrystals: clan.treasuryCrystals, expGained, influenceGained };
}

/**
 * Клановое создание вещей и транспорта исключительно главой клана за счёт клановой казны.
 * Созданная вещь сразу попадает на склад клана и принадлежит клану.
 */
export function forgeClanItemToStorage(
  clanId: string,
  leaderNick: string,
  item: GameItem,
  crystalCost: number,
  goldCost: number
): {
  ok: boolean;
  storageItem?: ClanStorageItem;
  newTreasuryCrystals?: number;
  newTreasuryGold?: number;
  error?: string;
} {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const isLeader = clan.leaderNick.trim().toLowerCase() === leaderNick.trim().toLowerCase();
  if (!isLeader) {
    return { ok: false, error: 'Создавать клановые вещи и транспорт может исключительно глава клана!' };
  }

  const maxCap = getClanMaxStorageCapacity(clan);
  if (clan.storage.length >= maxCap) {
    return {
      ok: false,
      error: `Склад клана заполнен (${clan.storage.length}/${maxCap} мест). Освободите место на складе или повысьте уровень клана!`
    };
  }

  const reqCrystals = Math.max(2000, Math.floor(Number(crystalCost) || 2000));
  const reqGold = Math.max(50000, Math.floor(Number(goldCost) || 50000));
  const curCrystals = Math.max(0, Math.floor(Number(clan.treasuryCrystals) || 0));
  const curGold = Math.max(0, Math.floor(Number(clan.treasuryGold) || 0));

  if (curCrystals < reqCrystals) {
    return {
      ok: false,
      error: `Недостаточно кристаллов в казне клана! Требуется: ${reqCrystals.toLocaleString('ru-RU')} 💎 (в казне: ${curCrystals.toLocaleString('ru-RU')} 💎).`
    };
  }
  if (curGold < reqGold) {
    return {
      ok: false,
      error: `Недостаточно золота в казне клана! Требуется: ${reqGold.toLocaleString('ru-RU')} 🪙 (в казне: ${curGold.toLocaleString('ru-RU')} 🪙).`
    };
  }

  clan.treasuryCrystals = curCrystals - reqCrystals;
  clan.treasuryGold = curGold - reqGold;

  const storageId = `cst_clanforge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const forgedItem: GameItem = {
    ...item,
    id: `clan_custom_${item.slot}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    clanStorageId: storageId,
    isClanCreated: true,
    isCustomCreated: true,
    isClanRented: false,
    clanOwnerId: clan.id,
    clanOwnerName: clan.name,
    clanOwnerTag: clan.tag,
    originalOwnerNick: clan.name,
    creatorNick: leaderNick,
    transferable: false,
    durability: 1000,
    maxDurability: 1000,
    initialMaxDurability: 1000,
    forgeCrystalCost: reqCrystals,
    forgeGoldCost: reqGold,
    origin: `Создано кланом ${clan.name} и принадлежит клану`
  };

  const newStorageItem: ClanStorageItem = {
    id: storageId,
    itemType: 'equipment',
    item: forgedItem,
    originalOwnerNick: clan.name,
    depositedAt: Date.now(),
    isRented: false
  };

  clan.storage.push(newStorageItem);
  addClanLogEntry(
    clan,
    leaderNick,
    'forge_clan_item',
    `Создал клановый предмет «${forgedItem.name}» за счёт казны (${reqCrystals.toLocaleString('ru-RU')} 💎 + ${reqGold.toLocaleString('ru-RU')} 🪙) → на склад клана`,
    forgedItem.icon || '⚒️'
  );
  recordClanAchievementProgress(clan, 'itemsForgedOrDeposited', 1, leaderNick, false);
  saveClansToSupabase();

  return {
    ok: true,
    storageItem: newStorageItem,
    newTreasuryCrystals: clan.treasuryCrystals,
    newTreasuryGold: clan.treasuryGold
  };
}

/**
 * Положить эликсиры (HP, EN, EXP) на базу клана.
 * Занимает место на базе клана (или пополняет запас эликсиров на базе).
 */
export function depositElixirToClanStorage(
  clanId: string,
  depositorNick: string,
  elixirType: 'hp' | 'en' | 'exp',
  quantity: number
): { ok: boolean; storageItem?: ClanStorageItem; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const maxCap = getClanMaxStorageCapacity(clan);
  if (clan.storage.length >= maxCap) {
    return {
      ok: false,
      error: `База клана заполнена (${clan.storage.length}/${maxCap} мест). Повышайте уровень клана (+10 мест за уровень)!`
    };
  }

  const elixirInfo =
    elixirType === 'hp'
      ? { name: 'Эликсир Жизни (+50 HP)', icon: '/assets/elixirs/elixir_hp.png', quality: 'rare' as const }
      : elixirType === 'en'
      ? { name: 'Эликсир Энергии (+20 EN)', icon: '/assets/elixirs/elixir_en.png', quality: 'rare' as const }
      : { name: 'Эликсир Опыта (+25% EXP)', icon: '/assets/elixirs/elixir_exp.png', quality: 'epic' as const };

  const storageId = `cst_elx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const dummyItem: GameItem = {
    id: storageId,
    name: `${elixirInfo.name} x${qty}`,
    slot: 'ring',
    icon: elixirInfo.icon,
    quality: elixirInfo.quality,
    lvl: 1,
    dmg: 0,
    hp: 0,
    isElixirLot: true,
    elixirType,
    elixirQty: qty,
    originalOwnerNick: depositorNick
  };

  const newStorageItem: ClanStorageItem = {
    id: storageId,
    itemType: 'elixir',
    elixirType,
    elixirQty: qty,
    item: dummyItem,
    originalOwnerNick: depositorNick,
    depositedAt: Date.now(),
    isRented: false
  };

  clan.elixirs = clan.elixirs || { hp: 0, en: 0, exp: 0 };
  clan.elixirs[elixirType] = (clan.elixirs[elixirType] || 0) + qty;
  clan.storage.push(newStorageItem);
  ensureMemberInClanAndAwardContribution(clan, depositorNick, 10 * qty, 5 * qty);
  addClanLogEntry(
    clan,
    depositorNick,
    'deposit_elixir',
    `Положил эликсиры на базу: ${elixirInfo.name} x${qty} (+${10 * qty} ✨ EXP / +${5 * qty} ⭐)`,
    elixirInfo.icon
  );

  saveToLocal();
  saveClansToSupabase();
  return { ok: true, storageItem: newStorageItem };
}

/**
 * Взять эликсир с базы клана соклановцем (или владельцем).
 */
export function takeElixirFromClanStorage(
  clanId: string,
  takerNick: string,
  storageItemId: string
): { ok: boolean; elixirType?: 'hp' | 'en' | 'exp'; qty?: number; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const isMember = clan.members.some((m) => m.nick.toLowerCase() === takerNick.toLowerCase());
  if (!isMember) return { ok: false, error: 'Только участники клана могут брать эликсиры с базы.' };

  const idx = clan.storage.findIndex((s) => s.id === storageItemId);
  if (idx === -1) return { ok: false, error: 'Эликсир не найден на базе клана.' };

  const st = clan.storage[idx];
  const eType = st.elixirType || st.item.elixirType;
  const eQty = Math.max(1, Number(st.elixirQty || st.item.elixirQty || 1));
  if (!eType) return { ok: false, error: 'Это не эликсир.' };

  clan.storage.splice(idx, 1);
  if (clan.elixirs) {
    clan.elixirs[eType] = Math.max(0, (clan.elixirs[eType] || 0) - eQty);
  }
  addClanLogEntry(
    clan,
    takerNick,
    'take_elixir',
    `Взял с базы эликсиры: ${st.item.name}`,
    st.item.icon || '🧪'
  );

  saveClansToSupabase();
  return { ok: true, elixirType: eType, qty: eQty };
}

export function rentItemFromClanStorage(
  clanId: string,
  borrowerNick: string,
  storageItemId: string
): { ok: boolean; rentedItem?: GameItem; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const isMember = clan.members.some((m) => m.nick.toLowerCase() === borrowerNick.toLowerCase());
  if (!isMember) return { ok: false, error: 'Только соклановцы могут брать вещи с базы.' };

  const st = clan.storage.find((s) => s.id === storageItemId);
  if (!st) return { ok: false, error: 'Предмет не найден на базе.' };

  if (st.itemType === 'elixir' || st.elixirType) {
    return { ok: false, error: 'Эликсиры забираются кнопкой «Взять эликсир».' };
  }

  if (st.isRented) {
    return { ok: false, error: `Этот предмет уже находится в аренде у игрока ${st.rentedByNick || 'соклановца'}.` };
  }

  st.isRented = true;
  st.rentedByNick = borrowerNick;
  st.rentedAt = Date.now();

  const rentedItem: GameItem = {
    ...st.item,
    id: `rented_${st.id}_${Date.now()}`,
    clanStorageId: st.id,
    isClanRented: true,
    isClanCreated: Boolean(st.item.isClanCreated),
    clanOwnerId: st.item.clanOwnerId || clan.id,
    clanOwnerName: st.item.clanOwnerName || clan.name,
    clanOwnerTag: st.item.clanOwnerTag || clan.tag,
    rentedByNick: borrowerNick,
    originalOwnerNick: st.originalOwnerNick,
    clanRentDepositedAt: st.depositedAt
  };

  addClanLogEntry(
    clan,
    borrowerNick,
    'rent_item',
    st.item.isClanCreated
      ? `Взял со склада клановую вещь: «${st.item.name}» (Создано кланом ${clan.name})`
      : `Взял предмет в аренду с базы: «${st.item.name}» (влад. ${st.originalOwnerNick})`,
    st.item.icon || '📥'
  );
  saveClansToSupabase();
  return { ok: true, rentedItem };
}

export function returnItemToClanStorage(
  clanId: string,
  borrowerNick: string,
  storageItemId: string
): { ok: boolean; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const st = clan.storage.find((s) => s.id === storageItemId);
  if (!st) return { ok: false, error: 'Предмет не найден на базе.' };

  if (!st.isRented) {
    return { ok: true };
  }

  if (st.rentedByNick && st.rentedByNick.toLowerCase() !== borrowerNick.toLowerCase()) {
    const isOwner = st.originalOwnerNick.toLowerCase() === borrowerNick.toLowerCase();
    const isLeader = clan.leaderNick.toLowerCase() === borrowerNick.toLowerCase();
    if (!isOwner && !isLeader) {
      return { ok: false, error: 'Вы не арендуете этот предмет.' };
    }
  }

  st.isRented = false;
  st.rentedByNick = undefined;
  st.rentedAt = undefined;

  addClanLogEntry(
    clan,
    borrowerNick,
    'return_item',
    `Вернул предмет на базу: «${st.item.name}»`,
    st.item.icon || '📤'
  );
  saveClansToSupabase();
  return { ok: true };
}

export function recallItemByOriginalOwner(
  clanId: string,
  ownerNick: string,
  storageItemId: string,
  isAdmin = false
): {
  ok: boolean;
  recalledItem?: GameItem;
  elixirType?: 'hp' | 'en' | 'exp';
  elixirQty?: number;
  previousBorrowerNick?: string;
  error?: string;
} {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const index = clan.storage.findIndex((s) => s.id === storageItemId);
  if (index === -1) return { ok: false, error: 'Предмет не найден на базе.' };

  const st = clan.storage[index];
  if (st.item.isClanCreated) {
    return {
      ok: false,
      error: `Эта вещь создана кланом «${st.item.clanOwnerName || clan.name}» за счёт казны и принадлежит клану! Её нельзя забрать в личную собственность.`
    };
  }

  const isLeader = clan.leaderNick.toLowerCase() === ownerNick.toLowerCase();
  if (!isAdmin && !isLeader && st.originalOwnerNick.toLowerCase() !== ownerNick.toLowerCase()) {
    return { ok: false, error: 'Только владелец, сдавший предмет, или глава клана может забрать его.' };
  }

  if (st.itemType === 'elixir' || st.elixirType) {
    const eType = st.elixirType || st.item.elixirType;
    const eQty = Math.max(1, Number(st.elixirQty || st.item.elixirQty || 1));
    clan.storage.splice(index, 1);
    if (clan.elixirs && eType) {
      clan.elixirs[eType] = Math.max(0, (clan.elixirs[eType] || 0) - eQty);
    }
    addClanLogEntry(
      clan,
      ownerNick,
      'recall_item',
      `Забрал с базы эликсиры: ${st.item.name}`,
      st.item.icon || '🔄'
    );
    saveClansToSupabase();
    return { ok: true, elixirType: eType, elixirQty: eQty };
  }

  const prevBorrower = st.rentedByNick;
  const recalledItem: GameItem = {
    ...st.item,
    isClanRented: false,
    clanStorageId: undefined,
    rentedByNick: undefined,
    originalOwnerNick: undefined
  };

  clan.storage.splice(index, 1);
  addClanLogEntry(
    clan,
    ownerNick,
    'recall_item',
    prevBorrower
      ? `Забрал свой предмет «${st.item.name}» с базы (был в аренде у ${prevBorrower})`
      : `Забрал свой предмет «${st.item.name}» с базы`,
    st.item.icon || '🔄'
  );
  saveClansToSupabase();

  return { ok: true, recalledItem, previousBorrowerNick: prevBorrower };
}

export function forceReturnAllStorageItemsToOwners(
  clanId: string
): { ok: boolean; returnedCount: number; returnedItems: { ownerNick: string; item: GameItem }[] } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, returnedCount: 0, returnedItems: [] };

  const returnedItems: { ownerNick: string; item: GameItem }[] = [];
  clan.storage.forEach((st) => {
    if (st.itemType !== 'elixir') {
      const cleanItem: GameItem = {
        ...st.item,
        isClanRented: false,
        clanStorageId: undefined,
        rentedByNick: undefined
      };
      returnedItems.push({
        ownerNick: st.originalOwnerNick,
        item: cleanItem
      });
    }
  });

  const count = clan.storage.length;
  clan.storage = [];
  clan.elixirs = { hp: 0, en: 0, exp: 0 };
  saveClansToSupabase();

  return { ok: true, returnedCount: count, returnedItems };
}

// -------------------------------------------------------------
// CLAN PYRAMID STATE, 10x10 MAP & ADMIN CONFIGURATION
// -------------------------------------------------------------

export function getClanPyramidState(): ClanPyramidState {
  initClanStorage();
  const cfg = inMemoryPyramid.config || DEFAULT_CLAN_PYRAMID_CONFIG;
  inMemoryPyramid.config = cfg;
  if (!Array.isArray(inMemoryPyramid.gridCells) || inMemoryPyramid.gridCells.length !== 10) {
    inMemoryPyramid.gridCells = generateClanPyramidGrid(cfg);
    inMemoryPyramid.lastRespawnAt = Date.now();
  }

  // Build top leaderboard
  const sortedClans = [...inMemoryClans].sort((a, b) => b.influencePoints - a.influencePoints);
  const topClans = sortedClans.slice(0, 10).map((c) => ({
    clanId: c.id,
    clanName: c.name,
    clanTag: c.tag,
    clanEmblem: c.emblem,
    influence: c.influencePoints
  }));

  // Экономика Пирамиды Ра: клан, удерживающий Пирамиду, получает +50 PTS в час в Общий пул клана
  if (inMemoryPyramid.controlledByClanId) {
    const ownerClan = inMemoryClans.find((c) => c.id === inMemoryPyramid.controlledByClanId);
    if (ownerClan) {
      const now = Date.now();
      const lastPtsTick = Number((inMemoryPyramid as any).lastPtsHourlyTickAt || (inMemoryPyramid as any).capturedAt || now);
      const elapsedHours = Math.floor((now - lastPtsTick) / 3600000);
      if (elapsedHours >= 1) {
        const ptsGained = Math.min(24, elapsedHours) * 50;
        ownerClan.unassignedPtsPool = Math.max(0, Math.floor(Number(ownerClan.unassignedPtsPool || 0))) + ptsGained;
        (inMemoryPyramid as any).lastPtsHourlyTickAt = lastPtsTick + elapsedHours * 3600000;
        saveClansToSupabase();
      } else if (!(inMemoryPyramid as any).lastPtsHourlyTickAt) {
        (inMemoryPyramid as any).lastPtsHourlyTickAt = now;
      }
    }
  }

  inMemoryPyramid.topClansLeaderboard = topClans;
  return inMemoryPyramid;
}

export function saveClanPyramidState(nextState: ClanPyramidState): ClanPyramidState {
  initClanStorage();
  inMemoryPyramid = {
    ...inMemoryPyramid,
    ...nextState,
    lastRespawnAt: nextState.lastGridRespawnAt ?? nextState.lastRespawnAt ?? inMemoryPyramid.lastRespawnAt
  };
  saveClanPyramidToSupabase(inMemoryPyramid);
  return getClanPyramidState();
}

export function updateClanPyramidGrid(nextGrid: PyramidCell[][]): ClanPyramidState {
  initClanStorage();
  inMemoryPyramid.gridCells = nextGrid;
  saveClanPyramidToSupabase();
  return getClanPyramidState();
}

export function respawnClanPyramidGrid(): ClanPyramidState {
  initClanStorage();
  const cfg = inMemoryPyramid.config || DEFAULT_CLAN_PYRAMID_CONFIG;
  inMemoryPyramid.gridCells = generateClanPyramidGrid(cfg);
  inMemoryPyramid.lastRespawnAt = Date.now();
  inMemoryPyramid.lastGridRespawnAt = Date.now();
  saveClanPyramidToSupabase();
  return getClanPyramidState();
}

export function adminUpdateClanPyramidConfig(
  updates: Partial<ClanPyramidConfig>,
  regenerateMap = false
): ClanPyramidState {
  initClanStorage();
  const currentConfig = inMemoryPyramid.config || DEFAULT_CLAN_PYRAMID_CONFIG;
  const goldVal = updates.goldBonusPct ?? updates.buffGoldPct ?? currentConfig.goldBonusPct ?? currentConfig.buffGoldPct ?? 15;
  const expVal = updates.expBonusPct ?? updates.buffExpPct ?? currentConfig.expBonusPct ?? currentConfig.buffExpPct ?? 15;
  const dmgVal = updates.dmgBonusPct ?? updates.buffDmgPct ?? currentConfig.dmgBonusPct ?? currentConfig.buffDmgPct ?? 5;
  const hpVal = updates.hpBonusPct ?? updates.buffHpPct ?? currentConfig.hpBonusPct ?? currentConfig.buffHpPct ?? 10;
  const nextConfig: ClanPyramidConfig = {
    ...currentConfig,
    ...updates,
    buffGoldPct: goldVal,
    goldBonusPct: goldVal,
    buffExpPct: expVal,
    expBonusPct: expVal,
    buffDmgPct: dmgVal,
    dmgBonusPct: dmgVal,
    buffHpPct: hpVal,
    hpBonusPct: hpVal,
    monsters: updates.monsters !== undefined ? updates.monsters : currentConfig.monsters
  };
  inMemoryPyramid.config = nextConfig;
  if (regenerateMap) {
    inMemoryPyramid.gridCells = generateClanPyramidGrid(nextConfig);
    inMemoryPyramid.lastRespawnAt = Date.now();
    inMemoryPyramid.lastGridRespawnAt = Date.now();
  }
  saveClanPyramidToSupabase();
  return getClanPyramidState();
}

export function adminSaveClanPyramidMonster(
  monster: ClanPyramidMonsterTemplate,
  regenerateMap = true
): ClanPyramidState {
  initClanStorage();
  const currentConfig = inMemoryPyramid.config || DEFAULT_CLAN_PYRAMID_CONFIG;
  const list = [...(currentConfig.monsters || DEFAULT_CLAN_PYRAMID_MONSTERS)];
  const idx = list.findIndex((m) => m.id === monster.id);
  if (idx >= 0) {
    list[idx] = monster;
  } else {
    list.push(monster);
  }
  return adminUpdateClanPyramidConfig({ monsters: list }, regenerateMap);
}

export function adminDeleteClanPyramidMonster(
  monsterId: string,
  regenerateMap = true
): ClanPyramidState {
  initClanStorage();
  const currentConfig = inMemoryPyramid.config || DEFAULT_CLAN_PYRAMID_CONFIG;
  const list = (currentConfig.monsters || []).filter((m) => m.id !== monsterId);
  return adminUpdateClanPyramidConfig({ monsters: list }, regenerateMap);
}

export function adminResetClanPyramidScores(): ClanPyramidState {
  initClanStorage();
  inMemoryClans.forEach((c) => {
    c.influencePoints = 0;
    c.members.forEach((m) => {
      m.contributionInfluence = 0;
    });
  });
  inMemoryPyramid.controlledByClanId = null;
  inMemoryPyramid.controlledByClanName = null;
  inMemoryPyramid.controlledByClanTag = null;
  inMemoryPyramid.controlledByClanEmblem = null;
  inMemoryPyramid.currentCycle = (inMemoryPyramid.currentCycle || 1) + 1;
  inMemoryPyramid.seasonEndTimestamp = Date.now() + 7 * 24 * 3600 * 1000;
  saveClansToSupabase();
  saveClanPyramidToSupabase();
  return getClanPyramidState();
}

export function addClanInfluence(
  clanId: string,
  points: number,
  contributorNick?: string,
  clanExpGain = 0
): ClanPyramidState {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (clan) {
    clan.influencePoints = Math.max(0, clan.influencePoints + points);
    if (contributorNick) {
      const member = clan.members.find((m) => m.nick.toLowerCase() === contributorNick.toLowerCase());
      if (member) {
        member.contributionInfluence = (member.contributionInfluence || 0) + points;
      }
    }
    recordClanAchievementProgress(clan, 'influenceEarned', points, contributorNick, false);
    if (clanExpGain > 0) {
      addClanExp(clanId, clanExpGain, contributorNick);
    } else {
      saveClansToSupabase();
    }
  }

  // Check if this clan now has highest points to take throne
  const sortedClans = [...inMemoryClans].sort((a, b) => b.influencePoints - a.influencePoints);
  if (sortedClans.length > 0 && sortedClans[0].influencePoints > 0) {
    const top = sortedClans[0];
    inMemoryPyramid.controlledByClanId = top.id;
    inMemoryPyramid.controlledByClanName = top.name;
    inMemoryPyramid.controlledByClanTag = top.tag;
    inMemoryPyramid.controlledByClanEmblem = top.emblem;
  }

  inMemoryPyramid.lastBattleAt = Date.now();
  saveClanPyramidToSupabase();

  return getClanPyramidState();
}

export function adminSetClanPyramidOwner(clanId: string | null): ClanPyramidState {
  initClanStorage();
  if (!clanId) {
    inMemoryPyramid.controlledByClanId = null;
    inMemoryPyramid.controlledByClanName = null;
    inMemoryPyramid.controlledByClanTag = null;
    inMemoryPyramid.controlledByClanEmblem = null;
  } else {
    const clan = inMemoryClans.find((c) => c.id === clanId);
    if (clan) {
      inMemoryPyramid.controlledByClanId = clan.id;
      inMemoryPyramid.controlledByClanName = clan.name;
      inMemoryPyramid.controlledByClanTag = clan.tag;
      inMemoryPyramid.controlledByClanEmblem = clan.emblem;
    }
  }

  saveClanPyramidToSupabase();
  return getClanPyramidState();
}

// -------------------------------------------------------------
// СОВМЕСТНЫЕ КЛАНОВЫЕ ДОСТИЖЕНИЯ (ГРУППОВЫЕ БОНУСЫ К ОПЫТУ И ЗОЛОТУ)
// -------------------------------------------------------------

export type ClanAchievementMetric =
  | 'monstersKilled'
  | 'goldContributed'
  | 'crystalsContributed'
  | 'itemsForgedOrDeposited'
  | 'influenceEarned'
  | 'totalExpEarned';

export interface ClanAchievementConfig {
  id: string;
  title: string;
  description: string;
  icon: string;
  metric: ClanAchievementMetric;
  target: number;
  unitLabel: string;
  expBonusPct: number;
  goldBonusPct: number;
}

export const CLAN_ACHIEVEMENTS_CATALOG: ClanAchievementConfig[] = [
  {
    id: 'clan_ach_mobs_1',
    title: 'Охотники пустыни',
    description: 'Совместно соклановцами победить 50 монстров в Пирамидах.',
    icon: '⚔️',
    metric: 'monstersKilled',
    target: 50,
    unitLabel: 'монстров',
    expBonusPct: 3,
    goldBonusPct: 3
  },
  {
    id: 'clan_ach_mobs_2',
    title: 'Гроза Древних Гробниц',
    description: 'Совместно соклановцами сокрушить 250 монстров и стражей.',
    icon: '💀',
    metric: 'monstersKilled',
    target: 250,
    unitLabel: 'монстров',
    expBonusPct: 5,
    goldBonusPct: 5
  },
  {
    id: 'clan_ach_gold_1',
    title: 'Золотой фонд Фараона',
    description: 'Собрать или внести в казну клана 50 000 🪙 золота.',
    icon: '🪙',
    metric: 'goldContributed',
    target: 50000,
    unitLabel: '🪙',
    expBonusPct: 2,
    goldBonusPct: 5
  },
  {
    id: 'clan_ach_gold_2',
    title: 'Сокровищница Империи',
    description: 'Собрать или внести в казну клана 250 000 🪙 золота.',
    icon: '👑',
    metric: 'goldContributed',
    target: 250000,
    unitLabel: '🪙',
    expBonusPct: 5,
    goldBonusPct: 10
  },
  {
    id: 'clan_ach_crystals_1',
    title: 'Кристальный Источник',
    description: 'Внести в казну клана 2 000 💎 кристаллов.',
    icon: '💎',
    metric: 'crystalsContributed',
    target: 2000,
    unitLabel: '💎',
    expBonusPct: 5,
    goldBonusPct: 3
  },
  {
    id: 'clan_ach_forge_1',
    title: 'Арсенал Братства',
    description: 'Выковать в клановой кузнице или разместить на складе клана 5 предметов или транспорта.',
    icon: '⚒️',
    metric: 'itemsForgedOrDeposited',
    target: 5,
    unitLabel: 'предметов',
    expBonusPct: 4,
    goldBonusPct: 4
  },
  {
    id: 'clan_ach_influence_1',
    title: 'Владыки Клановой Пирамиды',
    description: 'Заработать совместно 500 очков влияния 🔱 в Клановой Пирамиде.',
    icon: '🔱',
    metric: 'influenceEarned',
    target: 500,
    unitLabel: '🔱 влияния',
    expBonusPct: 6,
    goldBonusPct: 6
  },
  {
    id: 'clan_ach_exp_1',
    title: 'Легендарный Орден Нила',
    description: 'Набрать совместно 25 000 кланового опыта ⭐.',
    icon: '🏆',
    metric: 'totalExpEarned',
    target: 25000,
    unitLabel: '⭐ опыта',
    expBonusPct: 7,
    goldBonusPct: 7
  }
];

function computeEffectiveProgress(clan: Clan): ClanAchievementsProgress {
  const raw = clan.achievementsProgress || {
    monstersKilled: 0,
    goldContributed: 0,
    crystalsContributed: 0,
    itemsForgedOrDeposited: 0,
    influenceEarned: 0,
    totalExpEarned: 0,
    unlockedAchievementIds: []
  };

  const sumMemberExp = (clan.members || []).reduce((acc, m) => acc + Math.max(0, Number(m.contributionExp) || 0), 0);
  const sumMemberInf = (clan.members || []).reduce((acc, m) => acc + Math.max(0, Number(m.contributionInfluence) || 0), 0);
  const equipCount = (clan.storage || []).filter((s) => s.itemType !== 'elixir').length;
  const forgedSpentCrystals = (clan.storage || []).reduce(
    (acc, s) => acc + Math.max(0, Number(s.item?.forgeCrystalCost) || 0),
    0
  );
  const forgedSpentGold = (clan.storage || []).reduce(
    (acc, s) => acc + Math.max(0, Number(s.item?.forgeGoldCost) || 0),
    0
  );

  return {
    monstersKilled: Math.max(
      Number(raw.monstersKilled) || 0,
      Math.floor(sumMemberExp / 25)
    ),
    goldContributed: Math.max(
      Number(raw.goldContributed) || 0,
      (Number(clan.treasuryGold) || 0) + forgedSpentGold
    ),
    crystalsContributed: Math.max(
      Number(raw.crystalsContributed) || 0,
      (Number(clan.treasuryCrystals) || 0) + forgedSpentCrystals
    ),
    itemsForgedOrDeposited: Math.max(
      Number(raw.itemsForgedOrDeposited) || 0,
      equipCount
    ),
    influenceEarned: Math.max(
      Number(raw.influenceEarned) || 0,
      Number(clan.influencePoints) || 0,
      sumMemberInf
    ),
    totalExpEarned: Math.max(
      Number(raw.totalExpEarned) || 0,
      sumMemberExp,
      (Number(clan.exp) || 0) + Math.max(0, (Number(clan.level) || 1) - 1) * 2000
    ),
    unlockedAchievementIds: Array.isArray(raw.unlockedAchievementIds) ? raw.unlockedAchievementIds : []
  };
}

export function recordClanAchievementProgress(
  clanOrId: Clan | string,
  metric: ClanAchievementMetric,
  amount: number,
  actorNick?: string,
  shouldSave = true
): void {
  initClanStorage();
  const clan = typeof clanOrId === 'string' ? inMemoryClans.find((c) => c.id === clanOrId) : clanOrId;
  if (!clan || amount <= 0) return;

  const eff = computeEffectiveProgress(clan);
  eff[metric] = Math.max(0, Number(eff[metric] || 0) + Math.floor(amount));

  const unlockedSet = new Set<string>(eff.unlockedAchievementIds || []);
  CLAN_ACHIEVEMENTS_CATALOG.forEach((ach) => {
    const val = Number(eff[ach.metric] || 0);
    if (val >= ach.target && !unlockedSet.has(ach.id)) {
      unlockedSet.add(ach.id);
      addClanLogEntry(
        clan,
        actorNick || clan.leaderNick || 'Клан',
        'achievement_unlocked',
        `Выполнено клановое достижение «${ach.title}»! Бонус всей группе: +${ach.expBonusPct}% к опыту и +${ach.goldBonusPct}% к золоту!`,
        ach.icon || '🏆'
      );
    }
  });

  eff.unlockedAchievementIds = Array.from(unlockedSet);
  clan.achievementsProgress = eff;

  if (shouldSave) {
    saveClansToSupabase();
  }
}

export interface ClanAchievementStatusItem extends ClanAchievementConfig {
  currentValue: number;
  progressPct: number;
  isCompleted: boolean;
}

export function getClanAchievementsStatus(clanOrId?: Clan | string | null): {
  achievements: ClanAchievementStatusItem[];
  completedCount: number;
  totalCount: number;
  totalExpBonusPct: number;
  totalGoldBonusPct: number;
} {
  initClanStorage();
  const clan =
    typeof clanOrId === 'string'
      ? inMemoryClans.find((c) => c.id === clanOrId) || null
      : clanOrId || null;

  if (!clan) {
    return {
      achievements: CLAN_ACHIEVEMENTS_CATALOG.map((a) => ({
        ...a,
        currentValue: 0,
        progressPct: 0,
        isCompleted: false
      })),
      completedCount: 0,
      totalCount: CLAN_ACHIEVEMENTS_CATALOG.length,
      totalExpBonusPct: 0,
      totalGoldBonusPct: 0
    };
  }

  const eff = computeEffectiveProgress(clan);
  const unlockedSet = new Set<string>(eff.unlockedAchievementIds || []);
  let totalExpBonusPct = 0;
  let totalGoldBonusPct = 0;
  let completedCount = 0;

  const achievements: ClanAchievementStatusItem[] = CLAN_ACHIEVEMENTS_CATALOG.map((ach) => {
    const rawVal = Math.max(0, Math.floor(Number(eff[ach.metric] || 0)));
    const isCompleted = rawVal >= ach.target || unlockedSet.has(ach.id);
    const currentValue = isCompleted ? Math.max(rawVal, ach.target) : rawVal;
    const progressPct = Math.min(100, Math.round((currentValue / Math.max(1, ach.target)) * 100));
    if (isCompleted) {
      completedCount += 1;
      totalExpBonusPct += ach.expBonusPct;
      totalGoldBonusPct += ach.goldBonusPct;
    }
    return {
      ...ach,
      currentValue,
      progressPct,
      isCompleted
    };
  });

  return {
    achievements,
    completedCount,
    totalCount: CLAN_ACHIEVEMENTS_CATALOG.length,
    totalExpBonusPct,
    totalGoldBonusPct
  };
}

/**
 * Returns passive buffs applied to members of the clan (Pyramid throne control + Clan Achievements group bonuses).
 */
export function getClanPyramidBuffs(playerClanId?: string | null): {
  hasControl: boolean;
  goldBonusPct: number;
  expBonusPct: number;
  dmgBonusPct: number;
  hpBonusPct: number;
  ptsPerHour: number;
  achievementGoldBonusPct?: number;
  achievementExpBonusPct?: number;
} {
  const pyr = getClanPyramidState();
  const cfg = pyr.config || DEFAULT_CLAN_PYRAMID_CONFIG;
  const hasControl = Boolean(playerClanId && pyr.controlledByClanId && pyr.controlledByClanId === playerClanId);

  const achStatus = playerClanId ? getClanAchievementsStatus(playerClanId) : null;
  const achGold = achStatus ? achStatus.totalGoldBonusPct : 0;
  const achExp = achStatus ? achStatus.totalExpBonusPct : 0;

  const terrBuffs = getClanTerritoryBuffs(playerClanId);

  if (!hasControl) {
    return {
      hasControl: false,
      goldBonusPct: achGold + terrBuffs.pyramidGoldPct,
      expBonusPct: achExp + terrBuffs.pyramidExpPct,
      dmgBonusPct: terrBuffs.combatDmgPct,
      hpBonusPct: terrBuffs.maxHpPct,
      ptsPerHour: 0,
      achievementGoldBonusPct: achGold,
      achievementExpBonusPct: achExp
    };
  }

  return {
    hasControl: true,
    goldBonusPct: Number(cfg.buffGoldPct ?? 15) + achGold + terrBuffs.pyramidGoldPct,
    expBonusPct: Number(cfg.buffExpPct ?? 15) + achExp + terrBuffs.pyramidExpPct,
    dmgBonusPct: Number(cfg.buffDmgPct ?? 5) + terrBuffs.combatDmgPct,
    hpBonusPct: Number(cfg.buffHpPct ?? 10) + terrBuffs.maxHpPct,
    ptsPerHour: 50,
    achievementGoldBonusPct: achGold,
    achievementExpBonusPct: achExp
  };
}

// ============================================================================
// 1. ПЕРЕИМЕНОВАНИЕ ИГРОКА В КЛАНАХ, СКЛАДЕ, РЕЙДЕ И АРЕНЕ
// ============================================================================

export function renamePlayerInClans(oldNick: string, newNick: string): void {
  initClanStorage();
  const cleanOld = String(oldNick || '').trim();
  const cleanNew = String(newNick || '').trim();
  if (!cleanOld || !cleanNew) return;
  const oldLower = cleanOld.toLowerCase();

  let changed = false;
  inMemoryClans.forEach((clan) => {
    let clanTouched = false;
    if (clan.leaderNick.trim().toLowerCase() === oldLower) {
      clan.leaderNick = cleanNew;
      clanTouched = true;
    }
    clan.members.forEach((m) => {
      if (m.nick.trim().toLowerCase() === oldLower) {
        m.nick = cleanNew;
        clanTouched = true;
      }
    });
    clan.storage.forEach((st) => {
      if (st.originalOwnerNick && st.originalOwnerNick.trim().toLowerCase() === oldLower) {
        st.originalOwnerNick = cleanNew;
        clanTouched = true;
      }
      if (st.rentedByNick && st.rentedByNick.trim().toLowerCase() === oldLower) {
        st.rentedByNick = cleanNew;
        clanTouched = true;
      }
      if (st.item?.rentedByNick && st.item.rentedByNick.trim().toLowerCase() === oldLower) {
        st.item.rentedByNick = cleanNew;
        clanTouched = true;
      }
      if (st.item?.ownerNick && st.item.ownerNick.trim().toLowerCase() === oldLower) {
        st.item.ownerNick = cleanNew;
        clanTouched = true;
      }
    });
    if (clan.raidBoss && clan.raidBoss.participants) {
      Object.keys(clan.raidBoss.participants).forEach((k) => {
        const p = clan.raidBoss!.participants[k];
        if (k.toLowerCase() === oldLower || p.nick.toLowerCase() === oldLower) {
          delete clan.raidBoss!.participants[k];
          clan.raidBoss!.participants[cleanNew] = {
            ...p,
            nick: cleanNew
          };
          clanTouched = true;
        }
      });
    }
    if (clanTouched) {
      addClanLogEntry(
        clan,
        cleanNew,
        'rename_nick',
        `Игрок «${cleanOld}» изменил игровой никнейм на «${cleanNew}»`,
        '🏷️'
      );
      changed = true;
    }
  });

  if (inMemoryArena && Array.isArray(inMemoryArena.fighters)) {
    inMemoryArena.fighters.forEach((f) => {
      if (f.nick.trim().toLowerCase() === oldLower) {
        f.nick = cleanNew;
        changed = true;
      }
    });
  }

  if (changed) {
    saveClansToSupabase();
  }
}

// ============================================================================
// 2. КЛАНОВЫЕ ВОЙНЫ 7x7 И ЗАХВАТ ТЕРРИТОРИЙ (ТАБЛИЦА territories)
// ============================================================================

export const TERRITORY_PROTECTION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 часа удержания территории (щит)
export const TERRITORY_GATHERING_DURATION_MS = 7 * 60 * 1000; // 7 минут фаза сбора 7х7
export const TERRITORY_COMBAT_ROUND_DURATION_MS = 20 * 1000; // Ровно 20 секунд на ход каждого раунда (по ТЗ)
export const TERRITORY_WAR_DURATION_MS = TERRITORY_GATHERING_DURATION_MS;

export const PORT_BASE_MAX_WORKERS = 3;
export const PORT_MERGED_MAX_WORKERS = 6;
export const PORT_BASE_MAX_FISH_STOCK = 100;
export const PORT_MERGED_MAX_FISH_STOCK = 200;
export const PORT_BASE_MAX_RELIC_STOCK = 70;
export const PORT_MERGED_MAX_RELIC_STOCK = 140;
export const PORT_FISH_PER_RELIC = 5; // За 1 час потребляет 5 рыбин -> 1 реликвия
export const PORT_RELIC_PRICE_FISH_MULT = 4; // Стоимость 1 реликвии = стоимость 4 рыбин на рынке
export const PORT_DEFAULT_FISH_MARKET_PRICE = 50; // 50 золота за 1 рыбу -> 200 золота за 1 реликвию
export const PORT_WORKER_GOLD_PER_HOUR = 300; // +250 золота за каждый час работы
export const PORT_MAX_SHIFT_HOURS = 2; // Максимум 2 часа за подход
export const CLAN_BADGE_COST_GOLD = 1000; // Стоимость выдачи Знака клана: 1 000 золота

export const ESTATE_CREATION_COST_CRYSTALS = 3000;
export const PORT_TERMINAL_INITIAL_STOCK = 20000;

const PORT_FISH_MARKET_KEY = 'egypt_game_port_fish_market_v1';
const PORT_TRADING_TERMINAL_KEY = 'egypt_game_port_trading_terminal_v1';

export interface PortFishMarketState {
  fishStock: number;
  fishPriceGold: number;
  totalFishTraded: number;
  totalRelicsSold: number;
}

export interface PortTerminalResourceMeta {
  key: PortTerminalResourceKey;
  name: string;
  icon: string;
  category: string;
  buyPriceGold: number;
  sellPriceGold: number;
  weight: number;
  isTerminalTradable?: boolean;
  description: string;
}

export const PORT_BASE_FOOT_CAPACITY = 30;
const PORT_RESOURCES_CFG_KEY = 'egypt_game_port_resources_cfg_v1';

export const DEFAULT_PORT_ALL_RESOURCES_CATALOG: PortTerminalResourceMeta[] = [
  {
    key: 'raw_fish',
    name: 'Сырая рыба',
    icon: '🐟',
    category: 'Этап 1: Сырье',
    buyPriceGold: 90,
    sellPriceGold: 50,
    weight: 1,
    isTerminalTradable: true,
    description: 'Сдается с Рыбалки на Рыбный комбинат Порта по 50 🪙/шт. Продажа заводам 2-го этапа по 90 🪙/ед. (5 ед. → Рыбный паштет).'
  },
  {
    key: 'quartz_sand',
    name: 'Кварцевый песок',
    icon: '⏳',
    category: 'Этап 1: Сырье',
    buyPriceGold: 95,
    sellPriceGold: 55,
    weight: 1,
    isTerminalTradable: true,
    description: 'Добывается в Песчаном карьере (с/с 60 🪙, продажа 90 🪙). Скупается Алхимической лабораторией по 95 🪙/ед.'
  },
  {
    key: 'iron_ore',
    name: 'Железная руда',
    icon: '⛏️',
    category: 'Этап 1: Сырье',
    buyPriceGold: 110,
    sellPriceGold: 65,
    weight: 1,
    isTerminalTradable: true,
    description: 'Добывается в Железном руднике (с/с 75 🪙, продажа 100 🪙). Скупается Сталелитейным цехом по 110 🪙/ед.'
  },
  {
    key: 'gold_nugget',
    name: 'Золотой самородок',
    icon: '🪨',
    category: 'Этап 1: Сырье',
    buyPriceGold: 130,
    sellPriceGold: 80,
    weight: 1,
    isTerminalTradable: true,
    description: 'Добывается в Золотой шахте (с/с 80 🪙, продажа 120 🪙). Скупается Плавильным заводом по 130 🪙/ед.'
  },
  {
    key: 'crude_oil',
    name: 'Сырая нефть',
    icon: '🛢️',
    category: 'Этап 1: Сырье',
    buyPriceGold: 120,
    sellPriceGold: 75,
    weight: 1,
    isTerminalTradable: true,
    description: 'Добывается на Нефтяной вышке (с/с 75 🪙, продажа 115 🪙). Скупается Алхимической лабораторией, Пороховым Заводом и Электростанцией по 120 🪙/ед.'
  },
  {
    key: 'flax_fiber',
    name: 'Волокно Льна',
    icon: '🌿',
    category: 'Этап 1: Сырье',
    buyPriceGold: 95,
    sellPriceGold: 60,
    weight: 1,
    isTerminalTradable: true,
    description: 'Добывается на Плантации Льна и Папируса (с/с 60 🪙, продажа 90 🪙). Скупается Ткацкой Мануфактурой по 95 🪙/ед.'
  },
  {
    key: 'natural_saltpeter',
    name: 'Природная Селитра',
    icon: '🧂',
    category: 'Этап 1: Сырье',
    buyPriceGold: 115,
    sellPriceGold: 70,
    weight: 1,
    isTerminalTradable: true,
    description: 'Добывается в Селитровом Карьере (с/с 75 🪙, продажа 105 🪙). Скупается Пороховым Заводом по 115 🪙/ед.'
  },
  {
    key: 'raw_cotton_fiber',
    name: 'Сырое Волокно',
    icon: '🧵',
    category: 'Этап 1: Сырье',
    buyPriceGold: 90,
    sellPriceGold: 55,
    weight: 1,
    isTerminalTradable: true,
    description: 'Добывается на Плантации Хлопка и Красителей [2/8] и в Аутленде (с/с 60 🪙, продажа завода 90 🪙).'
  },
  {
    key: 'oasis_herb',
    name: 'Трава Оазиса',
    icon: '🌿',
    category: 'Этап 1: Редкое сырье (Outland)',
    buyPriceGold: 150,
    sellPriceGold: 120,
    weight: 1,
    isTerminalTradable: true,
    description: 'Редкое растение из Прибрежной зоны (Outland). Сдается в Алхимическую Лабораторию и Терминал Порта по 120 🪙!'
  },
  {
    key: 'fish_semifinished',
    name: 'Рыбный паштет',
    icon: '🥫',
    category: 'Этап 2: Полуфабрикат',
    buyPriceGold: 900,
    sellPriceGold: 750,
    weight: 2,
    isTerminalTradable: true,
    description: 'Выпускается Рыбным комбинатом (себестоимость ~750 🪙, цена продажи 900 🪙, чистая прибыль владельца Redblack: +150 🪙/ед.).'
  },
  {
    key: 'gold_ingots',
    name: 'Золотые слитки',
    icon: '🪙',
    category: 'Этап 2: Полуфабрикат',
    buyPriceGold: 900,
    sellPriceGold: 750,
    weight: 2,
    isTerminalTradable: true,
    description: 'Выпускаются Плавильным заводом (себестоимость ~750 🪙, цена продажи 900 🪙, чистая прибыль владельца Redblack: +150 🪙/ед.).'
  },
  {
    key: 'alchemy_reagents',
    name: 'Алхимический реагент',
    icon: '🧪',
    category: 'Этап 2: Полуфабрикат',
    buyPriceGold: 900,
    sellPriceGold: 750,
    weight: 2,
    isTerminalTradable: true,
    description: 'Выпускается Алхимической лабораторией (себестоимость ~750 🪙, цена продажи 900 🪙, чистая прибыль владельца Redblack: +150 🪙/ед.).'
  },
  {
    key: 'armor_fabric',
    name: 'Броневая Ткань',
    icon: '🧶',
    category: 'Этап 2: Полуфабрикат',
    buyPriceGold: 900,
    sellPriceGold: 750,
    weight: 2,
    isTerminalTradable: true,
    description: 'Выпускается Ткацкой Мануфактурой (себестоимость ~750 🪙, цена продажи 900 🪙, чистая прибыль владельца Redblack: +150 🪙/ед.).'
  },
  {
    key: 'gunpowder',
    name: 'Оружейный Порох',
    icon: '🧨',
    category: 'Этап 2: Полуфабрикат',
    buyPriceGold: 900,
    sellPriceGold: 750,
    weight: 2,
    isTerminalTradable: true,
    description: 'Выпускается Пороховым Заводом (себестоимость ~750 🪙, цена продажи 900 🪙, чистая прибыль владельца Redblack: +150 🪙/ед.).'
  },
  {
    key: 'hardened_steel',
    name: 'Закаленная сталь',
    icon: '🔩',
    category: 'Этап 3: Продукция',
    buyPriceGold: 2500,
    sellPriceGold: 2000,
    weight: 5,
    isTerminalTradable: false,
    description: 'Выпускается Сталелитейным цехом (себестоимость 2 000 🪙 → продажа 2 500 🪙, чистая прибыль владельца: +500 🪙/ед.).'
  },
  {
    key: 'combat_ration',
    name: 'Боевой стимулятор',
    icon: '💉',
    category: 'Этап 3: Продукция',
    buyPriceGold: 2800,
    sellPriceGold: 2200,
    weight: 5,
    isTerminalTradable: false,
    description: 'Выпускается Полевым Продкомбинатом (себестоимость 2 200 🪙 → продажа 2 800 🪙, чистая прибыль владельца: +600 🪙/ед.).'
  },
  {
    key: 'combat_modules',
    name: 'Боевые модули',
    icon: '⚙️',
    category: 'Этап 3: Продукция',
    buyPriceGold: 3500,
    sellPriceGold: 2800,
    weight: 5,
    isTerminalTradable: false,
    description: 'Выпускаются Оружейной Мануфактурой (себестоимость 2 800 🪙 → продажа 3 500 🪙, чистая прибыль владельца: +700 🪙/ед.).'
  },
  {
    key: 'port_relics',
    name: 'Древняя Реликвия',
    icon: '🏺',
    category: 'Этап 3: Продукция',
    buyPriceGold: 5000,
    sellPriceGold: 4200,
    weight: 5,
    isTerminalTradable: false,
    description: 'Выпускается Мастерской Реликвий (себестоимость 4 200 🪙 → продажа 5 000 🪙, чистая прибыль владельца: +800 🪙/ед.).'
  },
  {
    key: 'titanium_plate',
    name: 'Титановая Бронепластина',
    icon: '🛡️',
    category: 'Этап 3: Продукция',
    buyPriceGold: 4500,
    sellPriceGold: 3800,
    weight: 5,
    isTerminalTradable: false,
    description: 'Выпускается Фабрикой Спецзащиты (себестоимость 3 800 🪙 → продажа 4 500 🪙, чистая прибыль владельца: +700 🪙/ед.).'
  },
  {
    key: 'assault_charge',
    name: 'Штурмовой Заряд',
    icon: '💣',
    category: 'Этап 3: Продукция',
    buyPriceGold: 4900,
    sellPriceGold: 4100,
    weight: 5,
    isTerminalTradable: false,
    description: 'Выпускается Цехом Осадных Боеприпасов (себестоимость 4 100 🪙 → продажа 4 900 🪙, чистая прибыль владельца: +800 🪙/ед.).'
  },
  {
    key: 'ceremonial_amulet',
    name: 'Церемониальный Амулет',
    icon: '📿',
    category: 'Этап 3: Продукция',
    buyPriceGold: 2500,
    sellPriceGold: 2000,
    weight: 5,
    isTerminalTradable: false,
    description: 'Выпускается Ювелирной Мастерской Фараона [9/3] (себестоимость 2 000 🪙 → продажа 2 500 🪙, чистая прибыль владельца: +500 🪙/ед.).'
  },
  {
    key: 'power_kw',
    name: 'Мощность (кВт)',
    icon: '⚡',
    category: 'Энергосеть (Объект №13)',
    buyPriceGold: 75,
    sellPriceGold: 70,
    weight: 0,
    isTerminalTradable: false,
    description: 'Вырабатывается Электростанцией (10 ед./ч по 70 🪙, себестоимость 54 🪙). Вес = 0. Скупается заводами 2–3 этапов по 70–75 🪙/ед.'
  },
  {
    key: 'tavern_meal',
    name: 'Обед Таверны (+25% Бодрости)',
    icon: '🍺',
    category: 'Таверна (Объект №14)',
    buyPriceGold: 300,
    sellPriceGold: 300,
    weight: 0,
    isTerminalTradable: false,
    description: 'Готовится в Портовой Таверне из Рыбного паштета. 1 порция (300 🪙) мгновенно восстанавливает +25% бодрости.'
  }
];

function loadCustomResourcesConfig(): Record<
  string,
  { weight?: number; buyPriceGold?: number; sellPriceGold?: number }
> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PORT_RESOURCES_CFG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {};
}

export function getPortAllResourcesCatalog(): PortTerminalResourceMeta[] {
  const overrides = loadCustomResourcesConfig();
  return DEFAULT_PORT_ALL_RESOURCES_CATALOG.map((item) => {
    const ov = overrides[item.key];
    if (!ov) return { ...item };
    return {
      ...item,
      weight: typeof ov.weight === 'number' && ov.weight >= 0 ? ov.weight : item.weight,
      buyPriceGold:
        typeof ov.buyPriceGold === 'number' && ov.buyPriceGold >= 1 ? ov.buyPriceGold : item.buyPriceGold,
      sellPriceGold:
        typeof ov.sellPriceGold === 'number' && ov.sellPriceGold >= 1 ? ov.sellPriceGold : item.sellPriceGold
    };
  });
}

export const PORT_TERMINAL_CATALOG: PortTerminalResourceMeta[] =
  DEFAULT_PORT_ALL_RESOURCES_CATALOG.filter((r) => r.isTerminalTradable);

export function getPortResourceWeight(key?: PortTerminalResourceKey): number {
  if (!key) return 1;
  if (key === 'power_kw' || key === 'tavern_meal') return 0;
  const catalog = getPortAllResourcesCatalog();
  const found = catalog.find((c) => c.key === key);
  if (found) return found.weight;
  switch (key) {
    case 'raw_fish':
    case 'quartz_sand':
    case 'iron_ore':
    case 'gold_nugget':
    case 'crude_oil':
    case 'flax_fiber':
    case 'natural_saltpeter':
    case 'raw_cotton_fiber':
      return 1;
    case 'fish_semifinished':
    case 'gold_ingots':
    case 'alchemy_reagents':
    case 'armor_fabric':
    case 'gunpowder':
      return 2;
    case 'hardened_steel':
    case 'combat_ration':
    case 'combat_modules':
    case 'port_relics':
    case 'titanium_plate':
    case 'assault_charge':
    case 'ceremonial_amulet':
      return 5;
    default:
      return 1;
  }
}

export function adminUpdatePortResourceConfig(
  key: PortTerminalResourceKey,
  patch: { weight?: number; buyPriceGold?: number; sellPriceGold?: number }
): PortTerminalResourceMeta[] {
  if (typeof window !== 'undefined') {
    try {
      const cur = loadCustomResourcesConfig();
      cur[key] = {
        ...(cur[key] || {}),
        ...(typeof patch.weight === 'number' ? { weight: Math.max(0, Number(patch.weight)) } : {}),
        ...(typeof patch.buyPriceGold === 'number'
          ? { buyPriceGold: Math.max(1, Math.floor(Number(patch.buyPriceGold))) }
          : {}),
        ...(typeof patch.sellPriceGold === 'number'
          ? { sellPriceGold: Math.max(1, Math.floor(Number(patch.sellPriceGold))) }
          : {})
      };
      localStorage.setItem(PORT_RESOURCES_CFG_KEY, JSON.stringify(cur));
      // Sync live PORT_TERMINAL_CATALOG entries
      const updated = getPortAllResourcesCatalog();
      PORT_TERMINAL_CATALOG.forEach((tItem) => {
        const match = updated.find((u) => u.key === tItem.key);
        if (match) {
          tItem.weight = match.weight;
          tItem.buyPriceGold = match.buyPriceGold;
          tItem.sellPriceGold = match.sellPriceGold;
        }
      });
    } catch {}
  }
  return getPortAllResourcesCatalog();
}

export function adminRefillTerminalStock(
  key?: PortTerminalResourceKey | 'all',
  targetStock = PORT_TERMINAL_INITIAL_STOCK
): PortTradingTerminalState {
  const term = loadPortTradingTerminal();
  const qty = Math.max(0, Math.floor(Number(targetStock) || PORT_TERMINAL_INITIAL_STOCK));
  if (!key || key === 'all') {
    PORT_TERMINAL_CATALOG.forEach((m) => {
      term.stocks[m.key] = qty;
    });
  } else {
    term.stocks[key] = qty;
  }
  savePortTradingTerminal();
  return term;
}

export function resolveTransportSpeedAndCargo(transport?: GameItem | null): {
  stepSeconds: number;
  cargoCapacity: number;
  usingTransport: boolean;
} {
  if (!transport || Number(transport.durability ?? 1) <= 0) {
    return {
      stepSeconds: PORT_FOOT_STEP_SECONDS,
      cargoCapacity: 0,
      usingTransport: false
    };
  }
  if (typeof transport.stepSeconds === 'number' && transport.stepSeconds > 0 && typeof transport.cargoCapacity === 'number' && transport.cargoCapacity > 0) {
    return {
      stepSeconds: Math.max(3, Math.min(30, Math.round(transport.stepSeconds))),
      cargoCapacity: Math.max(10, Math.round(transport.cargoCapacity)),
      usingTransport: true
    };
  }
  const tplId = String(transport.transportTemplateId || transport.shopTemplateId || '').toLowerCase();
  const nameLower = String(transport.name || '').toLowerCase();
  if (
    tplId.includes('pharaoh_barge') ||
    tplId.includes('bp_apache_season') ||
    nameLower.includes('боевая ладья') ||
    nameLower.includes('ладья фараона') ||
    nameLower.includes('апач сезона')
  ) {
    return { stepSeconds: 6, cargoCapacity: 3000, usingTransport: true };
  }
  if (tplId.includes('m8') || nameLower.includes('сухогруз') || nameLower.includes('м-8')) {
    return { stepSeconds: 8, cargoCapacity: 2000, usingTransport: true };
  }
  if (tplId.includes('apache') || nameLower.includes('паровой') || nameLower.includes('фургон') || nameLower.includes('апач')) {
    return { stepSeconds: 12, cargoCapacity: 750, usingTransport: true };
  }
  if (tplId.includes('speedboat') || nameLower.includes('баркас') || nameLower.includes('караван')) {
    return { stepSeconds: 16, cargoCapacity: 300, usingTransport: true };
  }
  if (tplId.includes('boat') || nameLower.includes('лодка') || nameLower.includes('повозка')) {
    return { stepSeconds: 22, cargoCapacity: 100, usingTransport: true };
  }
  const baseTravel = Math.max(60, Math.min(600, Number(transport.travelTimeSec || 360)));
  const stepSec = Math.max(8, Math.min(24, Math.round((baseTravel / 600) * 24)));
  const cargoCap = stepSec <= 6 ? 3000 : stepSec <= 8 ? 2000 : stepSec <= 12 ? 750 : stepSec <= 16 ? 300 : 100;
  return { stepSeconds: stepSec, cargoCapacity: cargoCap, usingTransport: true };
}

// ============================================================================
// СИСТЕМА ПОГОН (15 ЗВАНИЙ ОТ РЯДОВОГО ДО МАРШАЛА), PTS, БАЗА КЛАНА И ДИПЛОМАТИЯ
// ============================================================================

const CLAN_SYNDICATE_RANKS_CFG_KEY = 'egypt_game_clan_syndicate_ranks_v1';

export const DEFAULT_CLAN_SYNDICATE_RANKS: ClanSyndicateRankConfig[] = [
  {
    level: 1,
    title: 'Рядовой (Солдат)',
    shortTitle: 'Рядовой',
    category: 'soldier',
    requiredPts: 0,
    priceGold: 0,
    vitBonus: 0,
    hpBonusPct: 0,
    strBonus: 0,
    dmgBonusPct: 0,
    armorBonusPct: 0,
    accuracyBonusPct: 0,
    cargoWeightBonus: 0,
    durabilitySavePct: 0,
    factorySpeedBonusPct: 0,
    ptsBonusPct: 0,
    perkName: 'Базовый доступ',
    perkDescription: 'Доступ к клановым боям 7х7 и базовой оружейной.'
  },
  {
    level: 2,
    title: 'Старший солдат',
    shortTitle: 'Ст. солдат',
    category: 'soldier',
    requiredPts: 1000,
    priceGold: 1500,
    vitBonus: 1,
    hpBonusPct: 5,
    strBonus: 0,
    dmgBonusPct: 0,
    armorBonusPct: 2,
    accuracyBonusPct: 0,
    cargoWeightBonus: 0,
    durabilitySavePct: 0,
    factorySpeedBonusPct: 0,
    ptsBonusPct: 0,
    perkDescription: '+1 к Выносливости (+5% HP), +2% к защите (броне).'
  },
  {
    level: 3,
    title: 'Младший сержант',
    shortTitle: 'Мл. сержант',
    category: 'sergeant',
    requiredPts: 2500,
    priceGold: 3500,
    vitBonus: 2,
    hpBonusPct: 10,
    strBonus: 1,
    dmgBonusPct: 3,
    armorBonusPct: 2,
    accuracyBonusPct: 0,
    cargoWeightBonus: 15,
    durabilitySavePct: 0,
    factorySpeedBonusPct: 0,
    ptsBonusPct: 0,
    perkDescription: '+2 к Выносливости (+10% HP), +1 к Силе (+3% к урону), +15 к грузоподъемности (весу).'
  },
  {
    level: 4,
    title: 'Сержант',
    shortTitle: 'Сержант',
    category: 'sergeant',
    requiredPts: 5000,
    priceGold: 7000,
    vitBonus: 3,
    hpBonusPct: 15,
    strBonus: 2,
    dmgBonusPct: 5,
    armorBonusPct: 3,
    accuracyBonusPct: 0,
    cargoWeightBonus: 25,
    durabilitySavePct: 0,
    factorySpeedBonusPct: 0,
    ptsBonusPct: 0,
    perkName: 'Перевязка',
    perkDescription: 'Перк «Перевязка» (раз за бой восстанавливает +15% HP).'
  },
  {
    level: 5,
    title: 'Старший сержант',
    shortTitle: 'Ст. сержант',
    category: 'sergeant',
    requiredPts: 9000,
    priceGold: 12000,
    vitBonus: 4,
    hpBonusPct: 18,
    strBonus: 3,
    dmgBonusPct: 7,
    armorBonusPct: 4,
    accuracyBonusPct: 3,
    cargoWeightBonus: 35,
    durabilitySavePct: 0,
    factorySpeedBonusPct: 0,
    ptsBonusPct: 0,
    perkName: 'Стимулятор сержанта',
    perkDescription: 'Перк «Стимулятор сержанта» (раз за бой +20% HP).'
  },
  {
    level: 6,
    title: 'Старшина',
    shortTitle: 'Старшина',
    category: 'sergeant',
    requiredPts: 15000,
    priceGold: 20000,
    vitBonus: 5,
    hpBonusPct: 22,
    strBonus: 4,
    dmgBonusPct: 9,
    armorBonusPct: 5,
    accuracyBonusPct: 5,
    cargoWeightBonus: 50,
    durabilitySavePct: 5,
    factorySpeedBonusPct: 0,
    ptsBonusPct: 0,
    perkName: 'Оружейный уход',
    perkDescription: '-5% износа оружия в боях, +50 к грузоподъемности.'
  },
  {
    level: 7,
    title: 'Прапорщик',
    shortTitle: 'Прапорщик',
    category: 'warrant',
    requiredPts: 23000,
    priceGold: 32000,
    vitBonus: 6,
    hpBonusPct: 25,
    strBonus: 5,
    dmgBonusPct: 11,
    armorBonusPct: 6,
    accuracyBonusPct: 6,
    cargoWeightBonus: 70,
    durabilitySavePct: 5,
    factorySpeedBonusPct: 5,
    ptsBonusPct: 0,
    perkName: 'Интендант заводов',
    perkDescription: '+6% к Броне, +70 к весу, +5% к скорости работы на заводах клана.'
  },
  {
    level: 8,
    title: 'Младший лейтенант',
    shortTitle: 'Мл. лейтенант',
    category: 'junior_officer',
    requiredPts: 35000,
    priceGold: 50000,
    vitBonus: 7,
    hpBonusPct: 28,
    strBonus: 6,
    dmgBonusPct: 13,
    armorBonusPct: 8,
    accuracyBonusPct: 7,
    cargoWeightBonus: 90,
    durabilitySavePct: 5,
    factorySpeedBonusPct: 5,
    ptsBonusPct: 0,
    perkName: 'Тактический щит',
    perkDescription: 'Офицерский перк «Тактический щит» (-15% входящего урона в 1-м раунде боя 7х7).'
  },
  {
    level: 9,
    title: 'Лейтенант',
    shortTitle: 'Лейтенант',
    category: 'junior_officer',
    requiredPts: 50000,
    priceGold: 75000,
    vitBonus: 8,
    hpBonusPct: 32,
    strBonus: 7,
    dmgBonusPct: 15,
    armorBonusPct: 10,
    accuracyBonusPct: 9,
    cargoWeightBonus: 110,
    durabilitySavePct: 5,
    factorySpeedBonusPct: 5,
    ptsBonusPct: 0,
    perkName: 'Осколочная граната клана',
    perkDescription: 'Офицерский перк «Осколочная граната клана» (доп. урон по площади раз за бой 7х7).'
  },
  {
    level: 10,
    title: 'Старший лейтенант',
    shortTitle: 'Ст. лейтенант',
    category: 'junior_officer',
    requiredPts: 70000,
    priceGold: 110000,
    vitBonus: 10,
    hpBonusPct: 36,
    strBonus: 8,
    dmgBonusPct: 17,
    armorBonusPct: 12,
    accuracyBonusPct: 11,
    cargoWeightBonus: 130,
    durabilitySavePct: 5,
    factorySpeedBonusPct: 5,
    ptsBonusPct: 0,
    perkName: 'Прицельный огонь',
    perkDescription: 'Офицерский перк «Прицельный огонь» (+15% к шансу крит. удара в штурмах 7х7).'
  },
  {
    level: 11,
    title: 'Капитан',
    shortTitle: 'Капитан',
    category: 'junior_officer',
    requiredPts: 100000,
    priceGold: 160000,
    vitBonus: 12,
    hpBonusPct: 40,
    strBonus: 10,
    dmgBonusPct: 20,
    armorBonusPct: 14,
    accuracyBonusPct: 13,
    cargoWeightBonus: 150,
    durabilitySavePct: 5,
    factorySpeedBonusPct: 5,
    ptsBonusPct: 0,
    perkName: 'Аптечка командира',
    perkDescription: 'Перк «Аптечка командира» (+30% HP себе или союзнику в бою 7х7).'
  },
  {
    level: 12,
    title: 'Майор',
    shortTitle: 'Майор',
    category: 'senior_officer',
    requiredPts: 140000,
    priceGold: 230000,
    vitBonus: 14,
    hpBonusPct: 45,
    strBonus: 12,
    dmgBonusPct: 23,
    armorBonusPct: 16,
    accuracyBonusPct: 15,
    cargoWeightBonus: 180,
    durabilitySavePct: 5,
    factorySpeedBonusPct: 5,
    ptsBonusPct: 0,
    perkName: 'Воодушевление отряда',
    perkDescription: 'Перк «Воодушевление отряда» (+5% к урону всем союзникам в бою 7х7).'
  },
  {
    level: 13,
    title: 'Подполковник',
    shortTitle: 'Подполковник',
    category: 'senior_officer',
    requiredPts: 190000,
    priceGold: 320000,
    vitBonus: 16,
    hpBonusPct: 50,
    strBonus: 14,
    dmgBonusPct: 26,
    armorBonusPct: 18,
    accuracyBonusPct: 18,
    cargoWeightBonus: 210,
    durabilitySavePct: 5,
    factorySpeedBonusPct: 5,
    ptsBonusPct: 0,
    perkName: 'Дымовая завеса',
    perkDescription: 'Перк «Дымовая завеса» (+15% уворота всей команде на 2 хода).'
  },
  {
    level: 14,
    title: 'Полковник',
    shortTitle: 'Полковник',
    category: 'senior_officer',
    requiredPts: 260000,
    priceGold: 450000,
    vitBonus: 18,
    hpBonusPct: 55,
    strBonus: 16,
    dmgBonusPct: 30,
    armorBonusPct: 21,
    accuracyBonusPct: 21,
    cargoWeightBonus: 250,
    durabilitySavePct: 5,
    factorySpeedBonusPct: 5,
    ptsBonusPct: 0,
    perkName: 'Артиллерийский залп',
    perkDescription: 'Перк «Артиллерийский залп» (мощный урон по 3 врагам в начале штурма 7х7).'
  },
  {
    level: 15,
    title: 'Генерал / Маршал',
    shortTitle: 'Маршал',
    category: 'general',
    requiredPts: 350000,
    priceGold: 650000,
    vitBonus: 22,
    hpBonusPct: 65,
    strBonus: 20,
    dmgBonusPct: 35,
    armorBonusPct: 25,
    accuracyBonusPct: 25,
    cargoWeightBonus: 300,
    durabilitySavePct: 10,
    factorySpeedBonusPct: 10,
    ptsBonusPct: 20,
    perkName: 'Знамя Маршала',
    perkDescription: 'Перк «Знамя Маршала» (+10% к урону и +10% к защите всей команде в 7х7, +20% к получаемому опыту PTS за бой).'
  }
];

function loadCustomSyndicateRanks(): Record<number, Partial<ClanSyndicateRankConfig>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CLAN_SYNDICATE_RANKS_CFG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {};
}

export function getClanSyndicateRanksCatalog(): ClanSyndicateRankConfig[] {
  const overrides = loadCustomSyndicateRanks();
  return DEFAULT_CLAN_SYNDICATE_RANKS.map((r) => {
    const ov = overrides[r.level];
    const merged = ov ? { ...r, ...ov, level: r.level } : { ...r };
    const titleStr = merged.title || merged.name || `Звание #${merged.level}`;
    const reqPtsVal = typeof merged.requiredPts === 'number' ? merged.requiredPts : (merged.reqPts ?? 0);
    const priceGoldVal = typeof merged.costGold === 'number' ? merged.costGold : merged.priceGold;
    return {
      ...merged,
      title: titleStr,
      name: titleStr,
      requiredPts: reqPtsVal,
      reqPts: reqPtsVal,
      priceGold: priceGoldVal,
      costGold: priceGoldVal,
      perkText: merged.perkText || merged.perkDescription,
      bonusSummary:
        merged.bonusSummary ||
        merged.perkDescription ||
        `+${merged.vitBonus} Выносл. (+${merged.hpBonusPct}% HP), +${merged.strBonus} Силы (+${merged.dmgBonusPct}% Урона), +${merged.armorBonusPct}% Брони, +${merged.cargoWeightBonus} вес`
    };
  });
}

export function getClanSyndicateRankByLevel(level = 1): ClanSyndicateRankConfig {
  const safeLvl = Math.max(1, Math.min(15, Math.floor(Number(level) || 1)));
  const catalog = getClanSyndicateRanksCatalog();
  return catalog.find((r) => r.level === safeLvl) || catalog[0];
}

export function adminUpdateClanSyndicateRank(
  level: number,
  patch: Partial<ClanSyndicateRankConfig>
): ClanSyndicateRankConfig[] {
  const safeLvl = Math.max(1, Math.min(15, Math.floor(Number(level) || 1)));
  if (typeof window !== 'undefined') {
    try {
      const cur = loadCustomSyndicateRanks();
      cur[safeLvl] = {
        ...(cur[safeLvl] || {}),
        ...patch,
        level: safeLvl
      };
      localStorage.setItem(CLAN_SYNDICATE_RANKS_CFG_KEY, JSON.stringify(cur));
    } catch {}
  }
  return getClanSyndicateRanksCatalog();
}

export function adminResetClanSyndicateRanks(): ClanSyndicateRankConfig[] {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(CLAN_SYNDICATE_RANKS_CFG_KEY);
    } catch {}
  }
  return getClanSyndicateRanksCatalog();
}

export function isPlayerClanBadgeEquipped(hero?: HeroState | null, playerNick?: string | null): boolean {
  if (hero && typeof hero.clanBadgeEquipped === 'boolean') {
    return hero.clanBadgeEquipped;
  }
  const nick = (playerNick || hero?.nick || '').trim();
  const clan = getPlayerClan(nick, hero?.clanId);
  if (!clan) return false;
  return doesPlayerHaveClanBadge(nick, clan.id, hero?.hasClanBadge);
}

export function getPlayerClanRankAndPts(
  playerNick?: string | null,
  clanIdOrHero?: string | HeroState | null,
  maybeHero?: HeroState | null
): {
  clan: Clan | null;
  member: ClanMember | null;
  rankLevel: number;
  rank: ClanSyndicateRankConfig;
  rankConfig: ClanSyndicateRankConfig;
  nextRank: ClanSyndicateRankConfig | null;
  nextRankConfig: ClanSyndicateRankConfig | null;
  pts: number;
  ptsToNextRank: number;
  badgeOwned: boolean;
  badgeEquipped: boolean;
  activeBonuses: {
    vitBonus: number;
    hpBonusPct: number;
    strBonus: number;
    dmgBonusPct: number;
    armorBonusPct: number;
    accuracyBonusPct: number;
    cargoWeightBonus: number;
    clanBadgeBaseBonusPct: number;
  };
} {
  initClanStorage();
  const hero: HeroState | null =
    typeof clanIdOrHero === 'object' && clanIdOrHero !== null
      ? clanIdOrHero
      : maybeHero || null;
  const explicitClanId: string | undefined =
    typeof clanIdOrHero === 'string' ? clanIdOrHero : hero?.clanId;

  const cleanNick = (playerNick || hero?.nick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim();
  const clan = getPlayerClan(cleanNick, explicitClanId) || null;
  const lower = cleanNick.toLowerCase();
  const member = clan?.members.find((m) => m.nick.trim().toLowerCase() === lower) || null;

  const isLeader = Boolean(
    clan &&
      (clan.leaderNick.trim().toLowerCase() === lower || member?.role === 'leader')
  );

  const pts = Math.max(
    0,
    Math.floor(
      Number(
        hero?.clanPts ??
          member?.clanPts ??
          (isLeader ? Math.max(2500, member?.contributionExp || 0) : member?.contributionExp || 0)
      )
    )
  );

  const rankLevel = Math.max(
    1,
    Math.min(
      15,
      Math.floor(
        Number(
          hero?.clanRankLevel ??
            member?.rankLevel ??
            (isLeader ? 3 : 1)
        )
      )
    )
  );

  if (member) {
    member.clanPts = Math.max(member.clanPts || 0, pts);
    if (!member.rankLevel || member.rankLevel < 1) {
      member.rankLevel = rankLevel;
    }
  }

  const rank = getClanSyndicateRankByLevel(rankLevel);
  const nextRank = rankLevel < 15 ? getClanSyndicateRankByLevel(rankLevel + 1) : null;
  const ptsToNextRank = nextRank ? Math.max(0, nextRank.requiredPts - pts) : 0;

  const badgeOwned = Boolean(clan && doesPlayerHaveClanBadge(cleanNick, clan.id, hero?.hasClanBadge));
  const badgeEquipped = Boolean(
    clan &&
      badgeOwned &&
      (hero?.clanBadgeEquipped !== undefined ? hero.clanBadgeEquipped : true)
  );

  const clanLevel = Math.max(1, Math.min(10, Math.floor(Number(clan?.level || 1))));
  const clanBadgeBaseBonusPct = badgeEquipped ? clanLevel * 2 : 0;

  return {
    clan,
    member,
    rankLevel,
    rank,
    rankConfig: rank,
    nextRank,
    nextRankConfig: nextRank,
    pts,
    ptsToNextRank,
    badgeOwned,
    badgeEquipped,
    activeBonuses: badgeEquipped
      ? {
          vitBonus: rank.vitBonus,
          hpBonusPct: rank.hpBonusPct + clanBadgeBaseBonusPct,
          strBonus: rank.strBonus,
          dmgBonusPct: rank.dmgBonusPct + clanBadgeBaseBonusPct,
          armorBonusPct: rank.armorBonusPct,
          accuracyBonusPct: rank.accuracyBonusPct,
          cargoWeightBonus: rank.cargoWeightBonus,
          clanBadgeBaseBonusPct
        }
      : {
          vitBonus: 0,
          hpBonusPct: 0,
          strBonus: 0,
          dmgBonusPct: 0,
          armorBonusPct: 0,
          accuracyBonusPct: 0,
          cargoWeightBonus: 0,
          clanBadgeBaseBonusPct: 0
        }
  };
}

export function purchaseClanMilitaryRank(
  playerNick: string,
  targetRankLevel: number,
  availableGold: number,
  currentPts?: number,
  currentRankLevel?: number
): {
  ok: boolean;
  newRankLevel?: number;
  rank?: ClanSyndicateRankConfig;
  goldSpent?: number;
  message?: string;
  error?: string;
} {
  initClanStorage();
  const cleanNick = (playerNick || '').trim();
  const clan = getPlayerClan(cleanNick);
  if (!clan) {
    return { ok: false, error: 'Для получения воинского звания (Погона) необходимо состоять в клане!' };
  }

  const targetLvl = Math.max(1, Math.min(15, Math.floor(Number(targetRankLevel) || 1)));
  const rankCfg = getClanSyndicateRankByLevel(targetLvl);
  const lower = cleanNick.toLowerCase();
  const member = clan.members.find((m) => m.nick.trim().toLowerCase() === lower);

  const curRankLvl = Math.max(1, Number(currentRankLevel ?? member?.rankLevel ?? 1));
  if (targetLvl <= curRankLvl) {
    return { ok: false, error: `У вас уже присвоено звание «${getClanSyndicateRankByLevel(curRankLvl).title}» или выше!` };
  }
  if (targetLvl > curRankLvl + 1) {
    const prevNeeded = getClanSyndicateRankByLevel(curRankLvl + 1);
    return {
      ok: false,
      error: `Погоны присваиваются последовательно! Сначала получите звание #${curRankLvl + 1} «${prevNeeded.title}».`
    };
  }

  const effectivePts = Math.max(0, Math.floor(Number(currentPts ?? member?.clanPts ?? 0)));
  if (effectivePts < rankCfg.requiredPts) {
    return {
      ok: false,
      error: `Недостаточно личного кланового опыта (PTS)! Требуется: ${rankCfg.requiredPts.toLocaleString('ru-RU')} PTS (у вас: ${effectivePts.toLocaleString('ru-RU')} PTS).`
    };
  }

  if (availableGold < rankCfg.priceGold) {
    return {
      ok: false,
      error: `Недостаточно золота для покупки Погона «${rankCfg.title}»! Требуется: ${rankCfg.priceGold.toLocaleString('ru-RU')} 🪙.`
    };
  }

  if (member) {
    member.rankLevel = targetLvl;
    member.clanPts = Math.max(member.clanPts || 0, effectivePts);
  }

  addClanLogEntry(
    clan,
    cleanNick,
    'promote',
    `Получил воинское звание (Погон #${targetLvl}) «${rankCfg.title}» в Военторге клана за ${rankCfg.priceGold.toLocaleString('ru-RU')} 🪙!`,
    '🎖️'
  );
  saveClansToSupabase();

  return {
    ok: true,
    newRankLevel: targetLvl,
    rank: rankCfg,
    goldSpent: rankCfg.priceGold,
    message: `🎖️ Поздравляем! Вам присвоено воинское звание «${rankCfg.title}» (#${targetLvl})! Бонусы погона активны при надетом Знаке клана.`
  };
}

export function distributeClanPtsFromPool(
  clanId: string,
  actorNick: string,
  targetMemberNick: string,
  amountPts: number
): { ok: boolean; clan?: Clan; newMemberPts?: number; remainingPool?: number; message?: string; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const actorLower = actorNick.trim().toLowerCase();
  const actorMember = clan.members.find((m) => m.nick.trim().toLowerCase() === actorLower);
  const isLeader = clan.leaderNick.trim().toLowerCase() === actorLower || actorMember?.role === 'leader';
  const canDistribute = Boolean(isLeader || actorMember?.permissions?.canDistributePtsAndTreasury);

  if (!canDistribute) {
    return { ok: false, error: 'У вас нет права «Выдача опыта PTS и премий из казны»!' };
  }

  const pts = Math.max(1, Math.floor(Number(amountPts) || 0));
  const pool = Math.max(0, Math.floor(Number(clan.unassignedPtsPool || 0)));
  if (pool < pts) {
    return {
      ok: false,
      error: `В пуле клана недостаточно очков PTS (доступно: ${pool.toLocaleString('ru-RU')} PTS)!`
    };
  }

  const targetLower = targetMemberNick.trim().toLowerCase();
  const targetMember = clan.members.find((m) => m.nick.trim().toLowerCase() === targetLower);
  if (!targetMember) {
    return { ok: false, error: 'Боец не найден в составе клана.' };
  }

  clan.unassignedPtsPool = pool - pts;
  targetMember.clanPts = Math.max(0, Math.floor(Number(targetMember.clanPts || 0))) + pts;
  targetMember.contributionExp = Math.max(0, Math.floor(Number(targetMember.contributionExp || 0))) + pts;

  addClanLogEntry(
    clan,
    actorNick,
    'promote',
    `Выдал +${pts.toLocaleString('ru-RU')} PTS кланового опыта из пула недвижимости бойцу ${targetMember.nick} (теперь: ${targetMember.clanPts.toLocaleString('ru-RU')} PTS)`,
    '⭐'
  );
  saveClansToSupabase();

  return {
    ok: true,
    clan,
    newMemberPts: targetMember.clanPts,
    remainingPool: clan.unassignedPtsPool,
    message: `⭐ Бойцу ${targetMember.nick} выдано +${pts.toLocaleString('ru-RU')} PTS из пула недвижимости клана!`
  };
}

export function updateClanMemberPermissions(
  clanId: string,
  actorNick: string,
  targetMemberNick: string,
  patchPermissions: Partial<ClanMemberPermissions>,
  customTitle?: string
): { ok: boolean; clan?: Clan; message?: string; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const actorLower = actorNick.trim().toLowerCase();
  const isLeader =
    clan.leaderNick.trim().toLowerCase() === actorLower ||
    clan.members.some((m) => m.nick.trim().toLowerCase() === actorLower && m.role === 'leader');

  if (!isLeader) {
    return { ok: false, error: 'Настраивать права управления в клане может только Глава клана!' };
  }

  const targetMember = clan.members.find(
    (m) => m.nick.trim().toLowerCase() === targetMemberNick.trim().toLowerCase()
  );
  if (!targetMember) return { ok: false, error: 'Участник не найден.' };

  const currentPerms: ClanMemberPermissions = targetMember.permissions || {
    canRecruitKick: false,
    canDeclareWar: false,
    canDistributePtsAndTreasury: false,
    canManageBaseAndDiplomacy: false
  };

  targetMember.permissions = {
    ...currentPerms,
    ...patchPermissions
  };

  if (typeof customTitle === 'string') {
    targetMember.customTitle = customTitle.trim().slice(0, 24);
  }

  saveClansToSupabase();
  return {
    ok: true,
    clan,
    message: `✅ Права доступа и должность для бойца ${targetMember.nick} обновлены!`
  };
}

export type ClanBaseBuildingKey = 'infirmary' | 'commandPost' | 'outpost' | 'powerStation';

export interface ClanBaseBuildingMeta {
  key: ClanBaseBuildingKey;
  name: string;
  currentLevel: 1 | 2 | 3 | 4;
  maxLevel: 4;
  effectText: string;
  nextLevelEffectText: string;
  upgradeCostGold: number;
  upgradeCostSteel: number;
  upgradeCostModules: number;
  upgradeCostRelics: number;
}

export function getClanBaseBuildingsCatalog(clan?: Clan | null): {
  buildings: ClanBaseBuildingMeta[];
  isPowered: boolean;
  powerChargeUnits: number;
  maxPowerChargeUnits: number;
  maxMembersLimit: number;
  infirmaryHealSpeedPct: number;
  outpostDefenseBonusPct: number;
  outpostDurabilitySaveAfterWar: number;
  alliedSharedInfirmaryClan?: string | null;
  alliedSharedOutpostClan?: string | null;
} {
  const base: ClanBaseBuildingsState = clan?.baseBuildings || {
    infirmaryLevel: 1,
    commandPostLevel: 1,
    outpostLevel: 1,
    powerStationLevel: 1,
    powerChargeUnits: 100,
    maxPowerChargeUnits: 200,
    lastPowerTickAt: Date.now()
  };

  const maxPower = base.powerStationLevel * 150;
  const curPower = Math.max(0, Math.min(maxPower, Math.floor(Number(base.powerChargeUnits ?? 100))));
  const isPowered = curPower > 0;

  const infLvl = base.infirmaryLevel;
  const cmdLvl = base.commandPostLevel;
  const outLvl = base.outpostLevel;
  const pwrLvl = base.powerStationLevel;

  const maxMembersByLvl: Record<number, number> = { 1: 15, 2: 25, 3: 35, 4: 50 };
  const infSpeedByLvl: Record<number, number> = { 1: 15, 2: 30, 3: 45, 4: 60 };
  const outDefByLvl: Record<number, number> = { 1: 5, 2: 10, 3: 15, 4: 20 };

  const costForNext = (lvl: number) => ({
    gold: lvl === 1 ? 25000 : lvl === 2 ? 60000 : 120000,
    steel: lvl === 1 ? 2 : lvl === 2 ? 4 : 8,
    modules: lvl === 1 ? 1 : lvl === 2 ? 3 : 6,
    relics: lvl === 1 ? 0 : lvl === 2 ? 1 : 2
  });

  const cInf = costForNext(infLvl);
  const cCmd = costForNext(cmdLvl);
  const cOut = costForNext(outLvl);
  const cPwr = costForNext(pwrLvl);

  const buildings: ClanBaseBuildingMeta[] = [
    {
      key: 'infirmary',
      name: 'Лазарет',
      currentLevel: infLvl,
      maxLevel: 4,
      effectText: `+${infSpeedByLvl[infLvl]}% к скорости лечения соклановцев${infLvl >= 4 ? ' + Бесплатное 100% HP перед 7х7 (раз в час)' : ''}`,
      nextLevelEffectText:
        infLvl < 4
          ? `Ур. ${infLvl + 1}: +${infSpeedByLvl[infLvl + 1]}% к лечению${infLvl + 1 === 4 ? ' + бесплатное лечение 100% HP раз в час' : ''}`
          : 'Максимальный уровень (4/4)',
      upgradeCostGold: cInf.gold,
      upgradeCostSteel: cInf.steel,
      upgradeCostModules: cInf.modules,
      upgradeCostRelics: cInf.relics
    },
    {
      key: 'commandPost',
      name: 'Командный пункт',
      currentLevel: cmdLvl,
      maxLevel: 4,
      effectText: `Макс. состав клана: ${maxMembersByLvl[cmdLvl]} чел. + Радар врагов на секторах клана (10x10)`,
      nextLevelEffectText:
        cmdLvl < 4
          ? `Ур. ${cmdLvl + 1}: лимит состава до ${maxMembersByLvl[cmdLvl + 1]} чел. + расширенный радар секторов`
          : 'Максимальный уровень (4/4)',
      upgradeCostGold: cCmd.gold,
      upgradeCostSteel: cCmd.steel,
      upgradeCostModules: cCmd.modules,
      upgradeCostRelics: cCmd.relics
    },
    {
      key: 'outpost',
      name: 'Форпост',
      currentLevel: outLvl,
      maxLevel: 4,
      effectText: `+${outDefByLvl[outLvl]}% к броне защитников клана в боях 7х7, -${outLvl * 4} ед. поломки заводов после штурма`,
      nextLevelEffectText:
        outLvl < 4
          ? `Ур. ${outLvl + 1}: +${outDefByLvl[outLvl + 1]}% к броне защитников в 7х7, -${(outLvl + 1) * 4} ед. износа зданий`
          : 'Максимальный уровень (4/4)',
      upgradeCostGold: cOut.gold,
      upgradeCostSteel: cOut.steel,
      upgradeCostModules: cOut.modules,
      upgradeCostRelics: cOut.relics
    },
    {
      key: 'powerStation',
      name: 'Зарядная станция',
      currentLevel: pwrLvl,
      maxLevel: 4,
      effectText: `Питает Базу клана энергией (Заряд: ${curPower}/${maxPower} кВт, расход снижен на ${(pwrLvl - 1) * 15}%)`,
      nextLevelEffectText:
        pwrLvl < 4
          ? `Ур. ${pwrLvl + 1}: ёмкость энергоблока до ${(pwrLvl + 1) * 150} кВт`
          : 'Максимальный уровень (4/4)',
      upgradeCostGold: cPwr.gold,
      upgradeCostSteel: cPwr.steel,
      upgradeCostModules: cPwr.modules,
      upgradeCostRelics: cPwr.relics
    }
  ];

  // Проверяем союзные кланы: союзники могут пользоваться Лазаретом и Форпостом друг друга в Порту 10x10!
  let effectiveInfLvl = isPowered ? infLvl : 0;
  let effectiveOutLvl = isPowered ? outLvl : 0;
  let alliedSharedInfirmaryClan: string | null = null;
  let alliedSharedOutpostClan: string | null = null;

  if (clan && Array.isArray(clan.diplomacy)) {
    const allyIds = clan.diplomacy.filter((d) => d.status === 'alliance').map((d) => d.targetClanId);
    for (const allyId of allyIds) {
      const ally = inMemoryClans.find((c) => c.id === allyId);
      if (ally && ally.baseBuildings) {
        const allyPwr = Math.max(0, Number(ally.baseBuildings.powerChargeUnits ?? 100));
        if (allyPwr > 0) {
          if (ally.baseBuildings.infirmaryLevel > effectiveInfLvl) {
            effectiveInfLvl = ally.baseBuildings.infirmaryLevel;
            alliedSharedInfirmaryClan = `#${ally.clanNumber || '?'} [${ally.tag}] ${ally.name}`;
          }
          if (ally.baseBuildings.outpostLevel > effectiveOutLvl) {
            effectiveOutLvl = ally.baseBuildings.outpostLevel;
            alliedSharedOutpostClan = `#${ally.clanNumber || '?'} [${ally.tag}] ${ally.name}`;
          }
        }
      }
    }
  }

  return {
    buildings,
    isPowered,
    powerChargeUnits: curPower,
    maxPowerChargeUnits: maxPower,
    maxMembersLimit: maxMembersByLvl[cmdLvl] || 15,
    infirmaryHealSpeedPct: effectiveInfLvl > 0 ? infSpeedByLvl[effectiveInfLvl] || 15 : 0,
    outpostDefenseBonusPct: effectiveOutLvl > 0 ? outDefByLvl[effectiveOutLvl] || 5 : 0,
    outpostDurabilitySaveAfterWar: effectiveOutLvl > 0 ? effectiveOutLvl * 4 : 0,
    alliedSharedInfirmaryClan,
    alliedSharedOutpostClan
  };
}

export function upgradeClanBaseBuilding(
  clanId: string,
  actorNick: string,
  buildingKey: ClanBaseBuildingKey,
  playerPortResources: Partial<Record<PortTerminalResourceKey, number>>
): {
  ok: boolean;
  clan?: Clan;
  spentResources?: Partial<Record<PortTerminalResourceKey, number>>;
  message?: string;
  error?: string;
} {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const actorLower = actorNick.trim().toLowerCase();
  const actorMember = clan.members.find((m) => m.nick.trim().toLowerCase() === actorLower);
  const isLeader = clan.leaderNick.trim().toLowerCase() === actorLower || actorMember?.role === 'leader';
  if (!isLeader && !actorMember?.permissions?.canManageBaseAndDiplomacy) {
    return { ok: false, error: 'У вас нет права «Управление Базой и Дипломатией»!' };
  }

  const catalog = getClanBaseBuildingsCatalog(clan);
  const bMeta = catalog.buildings.find((b) => b.key === buildingKey);
  if (!bMeta) return { ok: false, error: 'Строение базы не найдено.' };
  if (bMeta.currentLevel >= 4) {
    return { ok: false, error: `Строение «${bMeta.name}» уже улучшено до максимального 4-го уровня!` };
  }

  const treasuryGold = Math.max(0, Math.floor(Number(clan.treasuryGold || 0)));
  if (treasuryGold < bMeta.upgradeCostGold) {
    return {
      ok: false,
      error: `Недостаточно золота в казне клана! Требуется: ${bMeta.upgradeCostGold.toLocaleString('ru-RU')} 🪙 (в казне: ${treasuryGold.toLocaleString('ru-RU')} 🪙).`
    };
  }

  const haveSteel = Math.max(0, Math.floor(Number(playerPortResources.hardened_steel || 0)));
  const haveModules = Math.max(0, Math.floor(Number(playerPortResources.combat_modules || 0)));
  const haveRelics = Math.max(0, Math.floor(Number(playerPortResources.port_relics || 0)));

  if (haveSteel < bMeta.upgradeCostSteel) {
    return {
      ok: false,
      error: `Недостаточно «Закаленной стали» в инвентаре! Требуется: ${bMeta.upgradeCostSteel} шт. (у вас: ${haveSteel} шт.).`
    };
  }
  if (haveModules < bMeta.upgradeCostModules) {
    return {
      ok: false,
      error: `Недостаточно «Боевых модулей» в инвентаре! Требуется: ${bMeta.upgradeCostModules} шт. (у вас: ${haveModules} шт.).`
    };
  }
  if (haveRelics < bMeta.upgradeCostRelics) {
    return {
      ok: false,
      error: `Недостаточно «Древних Реликвий» в инвентаре! Требуется: ${bMeta.upgradeCostRelics} шт. (у вас: ${haveRelics} шт.).`
    };
  }

  clan.treasuryGold = treasuryGold - bMeta.upgradeCostGold;
  if (!clan.baseBuildings) {
    clan.baseBuildings = {
      infirmaryLevel: 1,
      commandPostLevel: 1,
      outpostLevel: 1,
      powerStationLevel: 1,
      powerChargeUnits: 100,
      maxPowerChargeUnits: 150,
      lastPowerTickAt: Date.now()
    };
  }

  const nextLvl = Math.min(4, bMeta.currentLevel + 1) as 1 | 2 | 3 | 4;
  if (buildingKey === 'infirmary') clan.baseBuildings.infirmaryLevel = nextLvl;
  if (buildingKey === 'commandPost') clan.baseBuildings.commandPostLevel = nextLvl;
  if (buildingKey === 'outpost') clan.baseBuildings.outpostLevel = nextLvl;
  if (buildingKey === 'powerStation') {
    clan.baseBuildings.powerStationLevel = nextLvl;
    clan.baseBuildings.maxPowerChargeUnits = nextLvl * 150;
    clan.baseBuildings.powerChargeUnits = Math.min(
      nextLvl * 150,
      (clan.baseBuildings.powerChargeUnits || 0) + 100
    );
  }

  addClanLogEntry(
    clan,
    actorNick,
    'upgrade',
    `Улучшил строение Клановой Базы «${bMeta.name}» до Уровня ${nextLvl} за ${bMeta.upgradeCostGold.toLocaleString('ru-RU')} 🪙 из казны и ресурсы Порта!`,
    '🏰'
  );
  saveClansToSupabase();

  return {
    ok: true,
    clan,
    spentResources: {
      hardened_steel: bMeta.upgradeCostSteel,
      combat_modules: bMeta.upgradeCostModules,
      port_relics: bMeta.upgradeCostRelics
    },
    message: `🏰 Строение Клановой Базы «${bMeta.name}» успешно улучшено до Уровня ${nextLvl}!`
  };
}

export function chargeClanBasePowerStation(
  clanId: string,
  actorNick: string,
  resourceKey: 'power_kw' | 'alchemy_reagents',
  requestedQty: number,
  availableQty: number
): {
  ok: boolean;
  clan?: Clan;
  usedQty?: number;
  addedCharge?: number;
  message?: string;
  error?: string;
} {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const qty = Math.max(1, Math.floor(Number(requestedQty) || 1));
  if (availableQty < qty) {
    return {
      ok: false,
      error: `У вас недостаточно ресурса (${availableQty} ед.) для зарядки Зарядной станции!`
    };
  }

  if (!clan.baseBuildings) {
    clan.baseBuildings = {
      infirmaryLevel: 1,
      commandPostLevel: 1,
      outpostLevel: 1,
      powerStationLevel: 1,
      powerChargeUnits: 100,
      maxPowerChargeUnits: 150,
      lastPowerTickAt: Date.now()
    };
  }

  const maxCap = clan.baseBuildings.powerStationLevel * 150;
  const cur = Math.max(0, Math.min(maxCap, Math.floor(Number(clan.baseBuildings.powerChargeUnits || 0))));
  if (cur >= maxCap) {
    return { ok: false, error: `Зарядная станция Базы клана уже заряжена на максимум (${cur}/${maxCap} кВт)!` };
  }

  const chargePerUnit = resourceKey === 'alchemy_reagents' ? 25 : 10;
  const neededUnits = Math.max(1, Math.ceil((maxCap - cur) / chargePerUnit));
  const usedQty = Math.min(qty, neededUnits);
  const addedCharge = Math.min(maxCap - cur, usedQty * chargePerUnit);

  clan.baseBuildings.powerChargeUnits = cur + addedCharge;
  clan.baseBuildings.maxPowerChargeUnits = maxCap;
  clan.baseBuildings.lastPowerTickAt = Date.now();

  // Выдаем бойцу +15 PTS за снабжение базы энергией
  const member = clan.members.find((m) => m.nick.trim().toLowerCase() === actorNick.trim().toLowerCase());
  if (member) {
    member.clanPts = Math.max(0, Number(member.clanPts || 0)) + usedQty * 15;
  }

  addClanLogEntry(
    clan,
    actorNick,
    'port_production',
    `Зарядил Зарядную станцию Базы клана на +${addedCharge} кВт (${usedQty} ед. ${
      resourceKey === 'power_kw' ? 'Мощности кВт' : 'Алхимических реагентов'
    }) [Заряд: ${clan.baseBuildings.powerChargeUnits}/${maxCap} кВт]`,
    '⚡'
  );
  saveClansToSupabase();

  return {
    ok: true,
    clan,
    usedQty,
    addedCharge,
    message: `⚡ Зарядная станция Базы клана пополнена на +${addedCharge} кВт (${clan.baseBuildings.powerChargeUnits}/${maxCap} кВт)! Вы получили +${usedQty * 15} PTS.`
  };
}

export function formatClanFullLabel(clan?: Clan | null): string {
  if (!clan) return 'Без клана';
  const num = clan.clanNumber && clan.clanNumber > 0 ? `#${clan.clanNumber} ` : '';
  return `${num}[${clan.tag}] ${clan.name}`;
}

export function findClanByNumberOrId(query?: string | number | null): Clan | undefined {
  if (query === undefined || query === null) return undefined;
  initClanStorage();
  if (typeof query === 'number') {
    return inMemoryClans.find((c) => c.clanNumber === Math.floor(query));
  }
  const raw = String(query).trim();
  if (!raw) return undefined;
  const cleanedNum = raw.startsWith('#') ? raw.slice(1).trim() : raw;
  if (/^\d+$/.test(cleanedNum)) {
    const numVal = parseInt(cleanedNum, 10);
    const byNum = inMemoryClans.find((c) => c.clanNumber === numVal);
    if (byNum) return byNum;
  }
  const lower = raw.toLowerCase();
  return (
    inMemoryClans.find((c) => c.id === raw) ||
    inMemoryClans.find((c) => c.tag.trim().toLowerCase() === lower) ||
    inMemoryClans.find((c) => c.name.trim().toLowerCase() === lower)
  );
}

export function updateClanAgenda(
  clanId: string,
  actorNick: string,
  agendaText: string
): { ok: boolean; clan?: Clan; message?: string; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const actorLower = actorNick.trim().toLowerCase();
  const member = clan.members.find((m) => m.nick.trim().toLowerCase() === actorLower);
  const isLeader = clan.leaderNick.trim().toLowerCase() === actorLower || member?.role === 'leader';
  if (!isLeader && !member?.permissions?.canManageBaseAndDiplomacy) {
    return { ok: false, error: 'Редактировать Повестку дня (Приказ Главы) может только Глава клана или уполномоченный офицер!' };
  }

  const trimmed = agendaText.trim().slice(0, 500);
  clan.agendaText = trimmed || 'Приказ Главы отсутствует.';
  clan.agendaUpdatedAt = Date.now();

  addClanLogEntry(
    clan,
    actorNick,
    'agenda_update',
    `Обновил Повестку дня (Приказ Главы клана): «${clan.agendaText}»`,
    '📌'
  );
  saveClansToSupabase();

  return {
    ok: true,
    clan,
    message: '📌 Повестка дня (Приказ Главы) успешно сохранена и опубликована для всех бойцов клана!'
  };
}

export function transferInterclanResourceByNumber(
  sourceClanId: string,
  actorNick: string,
  targetNumberInput: string | number,
  resourceType: 'pts' | 'gold',
  amount: number
): { ok: boolean; sourceClan?: Clan; targetClan?: Clan; message?: string; error?: string } {
  initClanStorage();
  const sourceClan = inMemoryClans.find((c) => c.id === sourceClanId);
  if (!sourceClan) return { ok: false, error: 'Ваш клан не найден.' };

  const targetClan = findClanByNumberOrId(targetNumberInput);
  if (!targetClan) {
    return { ok: false, error: `Клан с номером #ID «${targetNumberInput}» не найден в реестре синдикатов!` };
  }
  if (targetClan.id === sourceClan.id) {
    return { ok: false, error: 'Нельзя выполнить межклановый перевод своему собственному клану!' };
  }

  const actorLower = actorNick.trim().toLowerCase();
  const actorMember = sourceClan.members.find((m) => m.nick.trim().toLowerCase() === actorLower);
  const isLeader = sourceClan.leaderNick.trim().toLowerCase() === actorLower || actorMember?.role === 'leader';
  const canTransfer = Boolean(
    isLeader ||
      actorMember?.permissions?.canDistributePtsAndTreasury ||
      actorMember?.permissions?.canManageBaseAndDiplomacy
  );

  if (!canTransfer) {
    return { ok: false, error: 'У вас нет прав на выполнение межклановых переводов PTS и казны!' };
  }

  const qty = Math.max(1, Math.floor(Number(amount) || 0));
  if (qty <= 0) {
    return { ok: false, error: 'Укажите корректное количество для перевода (минимум 1).' };
  }

  const isAllied = areClansAllied(sourceClan.id, targetClan.id);
  const srcLabel = formatClanFullLabel(sourceClan);
  const dstLabel = formatClanFullLabel(targetClan);

  if (resourceType === 'pts') {
    const curPool = Math.max(0, Math.floor(Number(sourceClan.unassignedPtsPool || 0)));
    if (curPool < qty) {
      return {
        ok: false,
        error: `Недостаточно PTS в общем пуле клана! Доступно: ${curPool.toLocaleString('ru-RU')} PTS.`
      };
    }
    sourceClan.unassignedPtsPool = curPool - qty;
    targetClan.unassignedPtsPool = Math.max(0, Math.floor(Number(targetClan.unassignedPtsPool || 0))) + qty;

    const logText = `Клан ${srcLabel} передал ${qty.toLocaleString('ru-RU')} PTS клану ${dstLabel}${
      isAllied ? ' (Союзный перевод — 0% комиссии)' : ''
    }`;
    addClanLogEntry(sourceClan, actorNick, 'interclan_transfer', logText, '📤');
    addClanLogEntry(targetClan, actorNick, 'interclan_transfer', logText, '📥');
    saveClansToSupabase();

    return {
      ok: true,
      sourceClan,
      targetClan,
      message: `✅ ${logText}`
    };
  } else {
    const curGold = Math.max(0, Math.floor(Number(sourceClan.treasuryGold || 0)));
    if (curGold < qty) {
      return {
        ok: false,
        error: `Недостаточно золота в казне клана! Доступно: ${curGold.toLocaleString('ru-RU')} 🪙.`
      };
    }
    sourceClan.treasuryGold = curGold - qty;
    targetClan.treasuryGold = Math.max(0, Math.floor(Number(targetClan.treasuryGold || 0))) + qty;

    const logText = `Клан ${srcLabel} передал ${qty.toLocaleString('ru-RU')} 🪙 золота из казны клану ${dstLabel}`;
    addClanLogEntry(sourceClan, actorNick, 'interclan_transfer', logText, '🪙');
    addClanLogEntry(targetClan, actorNick, 'interclan_transfer', logText, '🪙');
    saveClansToSupabase();

    return {
      ok: true,
      sourceClan,
      targetClan,
      message: `✅ ${logText}`
    };
  }
}

export function proposeClanAllianceByNumber(
  clanId: string,
  actorNick: string,
  targetClanNumberOrId: string | number
): { ok: boolean; clan?: Clan; targetClan?: Clan; message?: string; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  const targetClan = findClanByNumberOrId(targetClanNumberOrId);
  if (!clan) return { ok: false, error: 'Ваш клан не найден.' };
  if (!targetClan) return { ok: false, error: `Клан с номером #ID «${targetClanNumberOrId}» не найден!` };
  if (clan.id === targetClan.id) return { ok: false, error: 'Нельзя отправить заявку на Союз своему клану.' };

  const actorLower = actorNick.trim().toLowerCase();
  const actorMember = clan.members.find((m) => m.nick.trim().toLowerCase() === actorLower);
  const isLeader = clan.leaderNick.trim().toLowerCase() === actorLower || actorMember?.role === 'leader';
  if (!isLeader && !actorMember?.permissions?.canManageBaseAndDiplomacy) {
    return { ok: false, error: 'У вас нет права «Управление Базой и Дипломатией»!' };
  }

  if (!Array.isArray(clan.diplomacy)) clan.diplomacy = [];
  if (!Array.isArray(targetClan.diplomacy)) targetClan.diplomacy = [];

  const activeAllies = clan.diplomacy.filter((d) => d.status === 'alliance' && d.targetClanId !== targetClan.id);
  if (activeAllies.length >= 2) {
    return { ok: false, error: 'По правилам Синдикатов клан может иметь максимум 2 активных Союза одновременно!' };
  }

  // Если от целевого клана уже висит входящая заявка — сразу заключаем Союз!
  const existingRel = clan.diplomacy.find((d) => d.targetClanId === targetClan.id);
  if (existingRel?.status === 'pending_incoming') {
    return acceptClanAllianceProposal(clan.id, actorNick, targetClan.id);
  }
  if (existingRel?.status === 'alliance') {
    return { ok: false, error: `У вас уже заключен активный Союз с кланом ${formatClanFullLabel(targetClan)}!` };
  }

  const now = Date.now();
  clan.diplomacy = clan.diplomacy.filter((d) => d.targetClanId !== targetClan.id);
  targetClan.diplomacy = targetClan.diplomacy.filter((d) => d.targetClanId !== clan.id);

  clan.diplomacy.push({
    targetClanId: targetClan.id,
    targetClanNumber: targetClan.clanNumber,
    targetClanName: targetClan.name,
    targetClanTag: targetClan.tag,
    targetClanEmblem: targetClan.emblem,
    status: 'pending_outgoing',
    updatedAt: now,
    initiatedByNick: actorNick
  });

  targetClan.diplomacy.push({
    targetClanId: clan.id,
    targetClanNumber: clan.clanNumber,
    targetClanName: clan.name,
    targetClanTag: clan.tag,
    targetClanEmblem: clan.emblem,
    status: 'pending_incoming',
    updatedAt: now,
    initiatedByNick: actorNick
  });

  addClanLogEntry(
    clan,
    actorNick,
    'diplomacy',
    `Отправил официальное предложение Союза клану ${formatClanFullLabel(targetClan)}. Ожидается подтверждение Главы.`,
    '📨'
  );
  addClanLogEntry(
    targetClan,
    actorNick,
    'diplomacy',
    `Получено входящее предложение Союза от клана ${formatClanFullLabel(clan)}.`,
    '📨'
  );
  saveClansToSupabase();

  return {
    ok: true,
    clan,
    targetClan,
    message: `📨 Заявка на Союз отправлена клану ${formatClanFullLabel(targetClan)}! Глава целевого клана видит входящее предложение и может нажать [Принять Союз].`
  };
}

export function acceptClanAllianceProposal(
  clanId: string,
  actorNick: string,
  targetClanIdOrNumber: string | number
): { ok: boolean; clan?: Clan; targetClan?: Clan; message?: string; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  const targetClan = findClanByNumberOrId(targetClanIdOrNumber);
  if (!clan || !targetClan) return { ok: false, error: 'Клан не найден.' };

  if (!Array.isArray(clan.diplomacy)) clan.diplomacy = [];
  if (!Array.isArray(targetClan.diplomacy)) targetClan.diplomacy = [];

  const activeAllies = clan.diplomacy.filter((d) => d.status === 'alliance' && d.targetClanId !== targetClan.id);
  if (activeAllies.length >= 2) {
    return { ok: false, error: 'У вашего клана уже заключено максимальное число Союзов (2 клана)!' };
  }

  const now = Date.now();
  clan.diplomacy = clan.diplomacy.filter((d) => d.targetClanId !== targetClan.id);
  targetClan.diplomacy = targetClan.diplomacy.filter((d) => d.targetClanId !== clan.id);

  clan.diplomacy.push({
    targetClanId: targetClan.id,
    targetClanNumber: targetClan.clanNumber,
    targetClanName: targetClan.name,
    targetClanTag: targetClan.tag,
    targetClanEmblem: targetClan.emblem,
    status: 'alliance',
    updatedAt: now,
    initiatedByNick: actorNick
  });

  targetClan.diplomacy.push({
    targetClanId: clan.id,
    targetClanNumber: clan.clanNumber,
    targetClanName: clan.name,
    targetClanTag: clan.tag,
    targetClanEmblem: clan.emblem,
    status: 'alliance',
    updatedAt: now,
    initiatedByNick: actorNick
  });

  const text = `Заключен официальный Союз между ${formatClanFullLabel(clan)} и ${formatClanFullLabel(
    targetClan
  )}! Доступны совместная защита 7х7, общий Лазарет/Форпост и переводы PTS без комиссии.`;
  addClanLogEntry(clan, actorNick, 'diplomacy', text, '🤝');
  addClanLogEntry(targetClan, actorNick, 'diplomacy', text, '🤝');
  saveClansToSupabase();

  return {
    ok: true,
    clan,
    targetClan,
    message: `🤝 ${text}`
  };
}

export function setClanDiplomacyStatus(
  clanId: string,
  actorNick: string,
  targetClanIdOrNumber: string | number,
  status: 'alliance' | 'war' | 'neutral'
): { ok: boolean; clan?: Clan; message?: string; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  const targetClan = findClanByNumberOrId(targetClanIdOrNumber);
  if (!clan || !targetClan) return { ok: false, error: `Клан «${targetClanIdOrNumber}» не найден.` };
  if (clan.id === targetClan.id) return { ok: false, error: 'Нельзя установить дипломатию со своим собственным кланом.' };

  const actorLower = actorNick.trim().toLowerCase();
  const actorMember = clan.members.find((m) => m.nick.trim().toLowerCase() === actorLower);
  const isLeader = clan.leaderNick.trim().toLowerCase() === actorLower || actorMember?.role === 'leader';
  if (!isLeader && !actorMember?.permissions?.canManageBaseAndDiplomacy) {
    return { ok: false, error: 'У вас нет права «Управление Базой и Дипломатией»!' };
  }

  if (!Array.isArray(clan.diplomacy)) clan.diplomacy = [];
  if (!Array.isArray(targetClan.diplomacy)) targetClan.diplomacy = [];

  if (status === 'alliance') {
    const activeAllies = clan.diplomacy.filter((d) => d.status === 'alliance' && d.targetClanId !== targetClan.id);
    if (activeAllies.length >= 2) {
      return { ok: false, error: 'По правилам Синдикатов клан может иметь максимум 2 союзных клана одновременно!' };
    }
  }

  const now = Date.now();
  clan.diplomacy = clan.diplomacy.filter((d) => d.targetClanId !== targetClan.id);
  targetClan.diplomacy = targetClan.diplomacy.filter((d) => d.targetClanId !== clan.id);

  if (status !== 'neutral') {
    const entry1: ClanDiplomacyEntry = {
      targetClanId: targetClan.id,
      targetClanNumber: targetClan.clanNumber,
      targetClanName: targetClan.name,
      targetClanTag: targetClan.tag,
      targetClanEmblem: targetClan.emblem,
      status,
      updatedAt: now,
      initiatedByNick: actorNick
    };
    const entry2: ClanDiplomacyEntry = {
      targetClanId: clan.id,
      targetClanNumber: clan.clanNumber,
      targetClanName: clan.name,
      targetClanTag: clan.tag,
      targetClanEmblem: clan.emblem,
      status,
      updatedAt: now,
      initiatedByNick: actorNick
    };
    clan.diplomacy.push(entry1);
    targetClan.diplomacy.push(entry2);
  }

  const targetFull = formatClanFullLabel(targetClan);
  const selfFull = formatClanFullLabel(clan);

  addClanLogEntry(
    clan,
    actorNick,
    status === 'war' ? 'declare_war' : 'diplomacy',
    status === 'alliance'
      ? `Заключен военный Союз (Альянс) с синдикатом ${targetFull}! Союзники могут помогать в защите заводов 7х7 и пользоваться Лазаретом/Форпостом.`
      : status === 'war'
      ? `Объявлена официальная Война синдикату ${targetFull}! В боях 7х7 против этого врага бойцы получают +25% PTS!`
      : `Дипломатические отношения с ${targetFull} разорваны (статус: Нейтралитет).`,
    status === 'alliance' ? '🤝' : status === 'war' ? '⚔️' : '🏳️'
  );
  addClanLogEntry(
    targetClan,
    actorNick,
    status === 'war' ? 'declare_war' : 'diplomacy',
    status === 'alliance'
      ? `Заключен военный Союз (Альянс) с синдикатом ${selfFull}!`
      : status === 'war'
      ? `Синдикат ${selfFull} объявил вам официальную Войну!`
      : `Дипломатические отношения с ${selfFull} переведены в статус: Нейтралитет.`,
    status === 'alliance' ? '🤝' : status === 'war' ? '⚔️' : '🏳️'
  );

  saveClansToSupabase();
  return {
    ok: true,
    clan,
    message:
      status === 'alliance'
        ? `🤝 Заключен военный Союз с ${targetFull}! Бойцы союзного клана теперь могут заходить за защиту ваших объектов в боях 7х7 и пользоваться общим Лазаретом и Форпостом.`
        : status === 'war'
        ? `⚔️ Объявлена официальная Война синдикату ${targetFull}! В боях 7х7 против официального врага ваши бойцы получают +25% кланового опыта (PTS)!`
        : `🏳️ Отношения с ${targetFull} разорваны (установлен Нейтралитет).`
  };
}

export function areClansAllied(clanId1?: string | null, clanId2?: string | null): boolean {
  if (!clanId1 || !clanId2) return false;
  if (clanId1 === clanId2) return true;
  initClanStorage();
  const c1 = inMemoryClans.find((c) => c.id === clanId1);
  if (!c1 || !Array.isArray(c1.diplomacy)) return false;
  return c1.diplomacy.some((d) => d.targetClanId === clanId2 && d.status === 'alliance');
}

export function areClansAtWar(clanId1?: string | null, clanId2?: string | null): boolean {
  if (!clanId1 || !clanId2 || clanId1 === clanId2) return false;
  initClanStorage();
  const c1 = inMemoryClans.find((c) => c.id === clanId1);
  if (c1 && Array.isArray(c1.diplomacy) && c1.diplomacy.some((d) => d.targetClanId === clanId2 && d.status === 'war')) {
    return true;
  }
  const c2 = inMemoryClans.find((c) => c.id === clanId2);
  if (c2 && Array.isArray(c2.diplomacy) && c2.diplomacy.some((d) => d.targetClanId === clanId1 && d.status === 'war')) {
    return true;
  }
  return false;
}

export function getSyndicateRatingList(sortBy: 'level' | 'estates' | 'pts' = 'pts'): {
  clan: Clan;
  controlledEstatesCount: number;
  totalClanPts: number;
  alliesCount: number;
  warsCount: number;
}[] {
  initClanStorage();
  const sectors = ensureTerritoriesLoaded();

  const npcFallbackEstatesByNumber: Record<number, number> = {
    204: 4,
    777: 3,
    105: 3,
    312: 2,
    501: 2,
    8348: 1
  };

  const rows = inMemoryClans.map((clan) => {
    const actualControlled = sectors.filter(
      (s) =>
        s.ownerClanId === clan.id ||
        (s.ownerClanTag && clan.tag && s.ownerClanTag.toLowerCase() === clan.tag.toLowerCase())
    ).length;

    const controlledEstatesCount =
      actualControlled > 0
        ? actualControlled
        : clan.isNpcSyndicate && clan.clanNumber
        ? npcFallbackEstatesByNumber[clan.clanNumber] || 1
        : 0;

    const membersPts = (clan.members || []).reduce((acc, m) => acc + Math.max(0, Number(m.clanPts || m.contributionExp || 0)), 0);
    const totalClanPts = membersPts + Math.max(0, Number(clan.exp || 0)) + Math.max(0, Number(clan.unassignedPtsPool || 0));
    const alliesCount = (clan.diplomacy || []).filter((d) => d.status === 'alliance').length;
    const warsCount = (clan.diplomacy || []).filter((d) => d.status === 'war').length;

    return {
      clan,
      controlledEstatesCount,
      totalClanPts,
      alliesCount,
      warsCount
    };
  });

  rows.sort((a, b) => {
    if (sortBy === 'estates') {
      return b.controlledEstatesCount - a.controlledEstatesCount || b.totalClanPts - a.totalClanPts;
    }
    if (sortBy === 'level') {
      return (b.clan.level || 1) - (a.clan.level || 1) || b.totalClanPts - a.totalClanPts;
    }
    return b.totalClanPts - a.totalClanPts || b.controlledEstatesCount - a.controlledEstatesCount;
  });

  return rows;
}

export function adminSetPlayerClanRankAndPts(
  targetNick: string,
  newRankLevel?: number,
  newPts?: number
): { ok: boolean; rankLevel: number; pts: number; message: string; error?: string } {
  initClanStorage();
  const cleanNick = (targetNick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim();
  const clan = getPlayerClan(cleanNick);
  const safeRank = Math.max(1, Math.min(15, Math.floor(Number(newRankLevel ?? 1))));
  const safePts = Math.max(0, Math.floor(Number(newPts ?? 0)));

  if (clan) {
    const lower = cleanNick.toLowerCase();
    const member = clan.members.find((m) => m.nick.trim().toLowerCase() === lower);
    if (member) {
      if (typeof newRankLevel === 'number') member.rankLevel = safeRank;
      if (typeof newPts === 'number') member.clanPts = safePts;
    }
    saveClansToSupabase();
  }

  const rankCfg = getClanSyndicateRankByLevel(safeRank);
  return {
    ok: true,
    rankLevel: safeRank,
    pts: safePts,
    message: `🎖️ [Админ] Игроку ${cleanNick} установлено звание #${safeRank} «${rankCfg.title}» и ${safePts.toLocaleString('ru-RU')} PTS!`
  };
}

export function adminSetClanBaseBuildingLevels(
  clanId: string,
  patch: Partial<{
    infirmaryLevel: 1 | 2 | 3 | 4;
    commandPostLevel: 1 | 2 | 3 | 4;
    outpostLevel: 1 | 2 | 3 | 4;
    powerStationLevel: 1 | 2 | 3 | 4;
    powerChargeUnits: number;
    powerChargeKw: number;
    unassignedPtsPool: number;
    clanLevel: number;
  }>
): { ok: boolean; clan?: Clan; message: string; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId) || inMemoryClans[0];
  if (!clan) return { ok: false, message: 'Клан не найден.', error: 'Клан не найден.' };

  if (!clan.baseBuildings) {
    clan.baseBuildings = {
      infirmaryLevel: 1,
      commandPostLevel: 1,
      outpostLevel: 1,
      powerStationLevel: 1,
      powerChargeUnits: 150,
      maxPowerChargeUnits: 150,
      lastPowerTickAt: Date.now()
    };
  }

  if (patch.infirmaryLevel) clan.baseBuildings.infirmaryLevel = patch.infirmaryLevel;
  if (patch.commandPostLevel) clan.baseBuildings.commandPostLevel = patch.commandPostLevel;
  if (patch.outpostLevel) clan.baseBuildings.outpostLevel = patch.outpostLevel;
  if (patch.powerStationLevel) {
    clan.baseBuildings.powerStationLevel = patch.powerStationLevel;
    clan.baseBuildings.maxPowerChargeUnits = patch.powerStationLevel * 150;
  }
  const nextCharge = patch.powerChargeUnits ?? patch.powerChargeKw;
  if (typeof nextCharge === 'number') {
    clan.baseBuildings.powerChargeUnits = Math.max(0, Math.floor(nextCharge));
    clan.baseBuildings.powerChargeKw = clan.baseBuildings.powerChargeUnits;
  }
  if (typeof patch.unassignedPtsPool === 'number') {
    clan.unassignedPtsPool = Math.max(0, Math.floor(patch.unassignedPtsPool));
  }
  if (typeof patch.clanLevel === 'number') {
    clan.level = Math.max(1, Math.min(10, Math.floor(patch.clanLevel)));
  }

  saveClansToSupabase();
  return {
    ok: true,
    clan,
    message: `🏰 [Админ] Параметры Клановой Базы для ${formatClanFullLabel(clan)} обновлены!`
  };
}

export function adminUpdateClanFullParams(
  clanId: string,
  patch: {
    clanNumber?: number;
    name?: string;
    tag?: string;
    emblem?: string;
    level?: number;
    treasuryGold?: number;
    treasuryCrystals?: number;
    unassignedPtsPool?: number;
    agendaText?: string;
  }
): { ok: boolean; clan?: Clan; message: string; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, message: 'Клан не найден.', error: 'Клан не найден.' };

  if (typeof patch.clanNumber === 'number' && patch.clanNumber > 0) {
    const newNum = Math.floor(patch.clanNumber);
    const conflict = inMemoryClans.find((c) => c.id !== clan.id && c.clanNumber === newNum);
    if (conflict) {
      return {
        ok: false,
        message: `Номер #${newNum} уже занят кланом [${conflict.tag}] ${conflict.name}!`,
        error: `Номер #${newNum} уже занят кланом [${conflict.tag}] ${conflict.name}!`
      };
    }
    clan.clanNumber = newNum;
  }

  if (typeof patch.name === 'string' && patch.name.trim().length >= 2) {
    clan.name = patch.name.trim();
  }
  if (typeof patch.tag === 'string' && patch.tag.trim().length >= 1) {
    clan.tag = patch.tag.trim().toUpperCase().slice(0, 8);
  }
  if (typeof patch.emblem === 'string' && patch.emblem.trim().length >= 1) {
    clan.emblem = patch.emblem.trim();
  }
  if (typeof patch.level === 'number') {
    clan.level = Math.max(1, Math.min(10, Math.floor(patch.level)));
  }
  if (typeof patch.treasuryGold === 'number') {
    clan.treasuryGold = Math.max(0, Math.floor(patch.treasuryGold));
  }
  if (typeof patch.treasuryCrystals === 'number') {
    clan.treasuryCrystals = Math.max(0, Math.floor(patch.treasuryCrystals));
  }
  if (typeof patch.unassignedPtsPool === 'number') {
    clan.unassignedPtsPool = Math.max(0, Math.floor(patch.unassignedPtsPool));
  }
  if (typeof patch.agendaText === 'string') {
    clan.agendaText = patch.agendaText.trim();
  }

  // Также обновим кешированные названия/номера в дипломатии других кланов и секторов
  for (const other of inMemoryClans) {
    if (Array.isArray(other.diplomacy)) {
      other.diplomacy.forEach((d) => {
        if (d.targetClanId === clan.id) {
          d.targetClanNumber = clan.clanNumber;
          d.targetClanName = clan.name;
          d.targetClanTag = clan.tag;
          d.targetClanEmblem = clan.emblem;
        }
      });
    }
  }
  const sectors = ensureTerritoriesLoaded();
  sectors.forEach((s) => {
    if (s.ownerClanId === clan.id) {
      s.ownerClanName = clan.name;
      s.ownerClanTag = clan.tag;
      s.ownerClanEmblem = clan.emblem;
    }
  });

  saveClansToSupabase();
  return {
    ok: true,
    clan,
    message: `✅ [Админ] Параметры клана ${formatClanFullLabel(clan)} успешно сохранены!`
  };
}

export function adminAdjustClanPtsPool(
  clanId: string,
  deltaPts: number
): { ok: boolean; clan?: Clan; newPool: number; message: string; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, newPool: 0, message: 'Клан не найден.', error: 'Клан не найден.' };

  const curPool = Math.max(0, Math.floor(Number(clan.unassignedPtsPool || 0)));
  const nextPool = Math.max(0, curPool + Math.floor(Number(deltaPts) || 0));
  clan.unassignedPtsPool = nextPool;

  addClanLogEntry(
    clan,
    'Администратор',
    'promote',
    `${deltaPts >= 0 ? `Начислил +${Math.abs(deltaPts).toLocaleString('ru-RU')} PTS` : `Списал -${Math.abs(deltaPts).toLocaleString('ru-RU')} PTS`} в Общий пул клана (теперь: ${nextPool.toLocaleString('ru-RU')} PTS).`,
    '⭐'
  );
  saveClansToSupabase();

  return {
    ok: true,
    clan,
    newPool: nextPool,
    message: `⭐ [Админ] Общий пул PTS клана ${formatClanFullLabel(clan)}: ${nextPool.toLocaleString('ru-RU')} PTS (${deltaPts >= 0 ? '+' : ''}${deltaPts.toLocaleString('ru-RU')} PTS)`
  };
}

export function adminCreateCustomClan(params: {
  clanNumber?: number;
  name: string;
  tag: string;
  emblem?: string;
  leaderNick?: string;
  level?: number;
  treasuryGold?: number;
  treasuryCrystals?: number;
  unassignedPtsPool?: number;
}): { ok: boolean; clan?: Clan; message?: string; error?: string } {
  initClanStorage();
  const trimmedName = (params.name || '').trim();
  const trimmedTag = (params.tag || '').trim().toUpperCase().slice(0, 6);
  if (trimmedName.length < 2) {
    return { ok: false, error: 'Введите название нового клана (минимум 2 символа).' };
  }
  if (trimmedTag.length < 2) {
    return { ok: false, error: 'Введите тег нового клана (от 2 до 6 символов).' };
  }

  let num = Math.max(1, Math.floor(Number(params.clanNumber) || 0));
  if (!num || inMemoryClans.some((c) => c.clanNumber === num)) {
    num = 100;
    while (inMemoryClans.some((c) => c.clanNumber === num)) {
      num++;
    }
  }

  const leader = (params.leaderNick || `Commander_${trimmedTag}`).trim();
  const lvl = Math.max(1, Math.min(10, Math.floor(Number(params.level) || 1)));
  const gold = Math.max(0, Math.floor(Number(params.treasuryGold) || 50000));
  const crystals = Math.max(0, Math.floor(Number(params.treasuryCrystals) || 100));
  const poolPts = Math.max(0, Math.floor(Number(params.unassignedPtsPool) || 5000));
  const emblem = (params.emblem || '🦅').trim();

  const created = normalizeClanRecord({
    id: `clan_custom_${num}_${Date.now()}`,
    clanNumber: num,
    name: trimmedName,
    tag: trimmedTag,
    emblem,
    description: `Синдикат #${num} [${trimmedTag}] ${trimmedName}`,
    agendaText: `Приказ командования синдиката #${num} [${trimmedTag}]: боевая готовность №1!`,
    leaderNick: leader,
    level: lvl,
    exp: lvl * 5000,
    influencePoints: lvl * 250,
    treasuryGold: gold,
    treasuryCrystals: crystals,
    unassignedPtsPool: poolPts,
    createdAt: Date.now(),
    isOpen: true,
    joinMinLvl: 1,
    isNpcSyndicate: true,
    members: [
      {
        nick: leader,
        role: 'leader',
        lvl: Math.max(5, lvl * 2),
        avatar: emblem,
        joinedAt: Date.now(),
        contributionExp: poolPts,
        contributionInfluence: 200,
        clanPts: poolPts,
        rankLevel: Math.min(15, Math.max(3, lvl + 2)),
        hasClanBadge: true,
        isOnline: true,
        lastSeen: Date.now()
      }
    ],
    storage: [],
    logs: []
  });

  addClanLogEntry(
    created,
    'Администратор',
    'create',
    `Создан синдикат ${formatClanFullLabel(created)} (Ур. ${lvl}, Пул: ${poolPts.toLocaleString('ru-RU')} PTS, Казна: ${gold.toLocaleString('ru-RU')} 🪙).`,
    emblem
  );

  inMemoryClans.push(created);
  inMemoryClans.sort((a, b) => (a.clanNumber || 9999) - (b.clanNumber || 9999));
  saveClansToSupabase();

  return {
    ok: true,
    clan: created,
    message: `✨ Создан новый клан ${formatClanFullLabel(created)}!`
  };
}

export function calculatePlayerPortCargo(
  hero?: HeroState | null,
  inventoryOrActiveTransport?: GameItem[] | GameItem | null,
  equipped?: any
): {
  baseCapacity: number;
  transportCapacity: number;
  transportBonusWeight: number;
  rankCargoBonus: number;
  maxWeight: number;
  usedWeight: number;
  currentWeight: number;
  freeWeight: number;
  isOverloaded: boolean;
  activeTransport: GameItem | null;
  transportName: string;
  stepSeconds: number;
} {
  let resolvedTransport: GameItem | null = null;
  const checkIsTransport = (it?: GameItem | null) =>
    Boolean(it && (it.isTransport || it.slot === 'transport' || (it.id || '').startsWith('transport_')));
  if (Array.isArray(inventoryOrActiveTransport)) {
    const owned: GameItem[] = [];
    const seen = new Set<string>();
    if (equipped?.transport && checkIsTransport(equipped.transport)) {
      owned.push(equipped.transport);
      seen.add(equipped.transport.id);
    }
    inventoryOrActiveTransport.forEach((it) => {
      if (it && checkIsTransport(it) && !seen.has(it.id)) {
        owned.push(it);
        seen.add(it.id);
      }
    });
    if (hero?.activeTransportId) {
      resolvedTransport = owned.find((t) => t.id === hero.activeTransportId) || null;
    }
    if (!resolvedTransport && equipped?.transport) {
      resolvedTransport = equipped.transport;
    }
    if (!resolvedTransport && owned.length > 0) {
      resolvedTransport = owned[0];
    }
  } else if (inventoryOrActiveTransport && typeof inventoryOrActiveTransport === 'object') {
    resolvedTransport = inventoryOrActiveTransport as GameItem;
  }

  const trInfo = resolveTransportSpeedAndCargo(resolvedTransport);
  const rankInfo = getPlayerClanRankAndPts(hero?.nick, hero);
  const rankCargoBonus = rankInfo.activeBonuses.cargoWeightBonus || 0;
  const baseCapacity = PORT_BASE_FOOT_CAPACITY + rankCargoBonus;
  const transportCapacity = trInfo.usingTransport ? trInfo.cargoCapacity : 0;
  const isVipActive = Boolean(hero?.isPremium && (!hero.premiumUntil || hero.premiumUntil > Date.now()));
  const rawMaxWeight = baseCapacity + transportCapacity;
  const maxWeight = isVipActive ? Math.round(rawMaxWeight * 1.25) : rawMaxWeight;
  const effectiveStepSeconds = isVipActive
    ? Math.max(3, Math.round(trInfo.stepSeconds * 0.8))
    : trInfo.stepSeconds;

  let usedWeight = 0;
  const portRes = hero?.portResources || {};
  (Object.keys(portRes) as PortTerminalResourceKey[]).forEach((k) => {
    const count = Math.max(0, Math.floor(Number(portRes[k] || 0)));
    if (count > 0) {
      usedWeight += count * getPortResourceWeight(k);
    }
  });

  const freeWeight = Math.max(0, maxWeight - usedWeight);
  const isOverloaded = usedWeight > maxWeight;

  return {
    baseCapacity,
    transportCapacity,
    transportBonusWeight: transportCapacity,
    rankCargoBonus,
    maxWeight,
    usedWeight,
    currentWeight: usedWeight,
    freeWeight,
    isOverloaded,
    activeTransport: resolvedTransport,
    transportName: resolvedTransport?.name || 'Пешком',
    stepSeconds: effectiveStepSeconds
  };
}

export interface PortTradingTerminalState {
  stocks: Record<PortTerminalResourceKey, number>;
  totalBought: number;
  totalSold: number;
  updatedAt: number;
}

let inMemoryPortTerminal: PortTradingTerminalState = {
  stocks: {
    raw_fish: PORT_TERMINAL_INITIAL_STOCK,
    iron_ore: PORT_TERMINAL_INITIAL_STOCK,
    gold_nugget: PORT_TERMINAL_INITIAL_STOCK,
    quartz_sand: PORT_TERMINAL_INITIAL_STOCK,
    crude_oil: PORT_TERMINAL_INITIAL_STOCK,
    flax_fiber: PORT_TERMINAL_INITIAL_STOCK,
    natural_saltpeter: PORT_TERMINAL_INITIAL_STOCK,
    raw_cotton_fiber: PORT_TERMINAL_INITIAL_STOCK,
    oasis_herb: PORT_TERMINAL_INITIAL_STOCK,
    fish_semifinished: PORT_TERMINAL_INITIAL_STOCK,
    alchemy_reagents: PORT_TERMINAL_INITIAL_STOCK,
    gold_ingots: PORT_TERMINAL_INITIAL_STOCK,
    armor_fabric: PORT_TERMINAL_INITIAL_STOCK,
    gunpowder: PORT_TERMINAL_INITIAL_STOCK,
    hardened_steel: 0,
    combat_ration: 0,
    combat_modules: 0,
    port_relics: 0,
    titanium_plate: 0,
    assault_charge: 0,
    ceremonial_amulet: 0,
    power_kw: 0,
    tavern_meal: 0
  },
  totalBought: 0,
  totalSold: 0,
  updatedAt: Date.now()
};

function loadPortTradingTerminal(): PortTradingTerminalState {
  if (typeof window === 'undefined') return inMemoryPortTerminal;
  try {
    const raw = localStorage.getItem(PORT_TRADING_TERMINAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.stocks) {
        inMemoryPortTerminal = {
          stocks: {
            raw_fish: Math.max(0, Math.floor(Number(parsed.stocks.raw_fish ?? PORT_TERMINAL_INITIAL_STOCK))),
            iron_ore: Math.max(0, Math.floor(Number(parsed.stocks.iron_ore ?? PORT_TERMINAL_INITIAL_STOCK))),
            gold_nugget: Math.max(0, Math.floor(Number(parsed.stocks.gold_nugget ?? PORT_TERMINAL_INITIAL_STOCK))),
            quartz_sand: Math.max(0, Math.floor(Number(parsed.stocks.quartz_sand ?? PORT_TERMINAL_INITIAL_STOCK))),
            crude_oil: Math.max(0, Math.floor(Number(parsed.stocks.crude_oil ?? PORT_TERMINAL_INITIAL_STOCK))),
            flax_fiber: Math.max(0, Math.floor(Number(parsed.stocks.flax_fiber ?? PORT_TERMINAL_INITIAL_STOCK))),
            natural_saltpeter: Math.max(
              0,
              Math.floor(Number(parsed.stocks.natural_saltpeter ?? PORT_TERMINAL_INITIAL_STOCK))
            ),
            raw_cotton_fiber: Math.max(
              0,
              Math.floor(Number(parsed.stocks.raw_cotton_fiber ?? PORT_TERMINAL_INITIAL_STOCK))
            ),
            oasis_herb: Math.max(
              0,
              Math.floor(Number(parsed.stocks.oasis_herb ?? PORT_TERMINAL_INITIAL_STOCK))
            ),
            fish_semifinished: Math.max(
              0,
              Math.floor(Number(parsed.stocks.fish_semifinished ?? PORT_TERMINAL_INITIAL_STOCK))
            ),
            alchemy_reagents: Math.max(
              0,
              Math.floor(Number(parsed.stocks.alchemy_reagents ?? PORT_TERMINAL_INITIAL_STOCK))
            ),
            gold_ingots: Math.max(
              0,
              Math.floor(Number(parsed.stocks.gold_ingots ?? PORT_TERMINAL_INITIAL_STOCK))
            ),
            armor_fabric: Math.max(
              0,
              Math.floor(Number(parsed.stocks.armor_fabric ?? PORT_TERMINAL_INITIAL_STOCK))
            ),
            gunpowder: Math.max(
              0,
              Math.floor(Number(parsed.stocks.gunpowder ?? PORT_TERMINAL_INITIAL_STOCK))
            ),
            hardened_steel: 0,
            combat_ration: 0,
            combat_modules: 0,
            port_relics: 0,
            titanium_plate: 0,
            assault_charge: 0,
            ceremonial_amulet: 0,
            power_kw: 0,
            tavern_meal: 0
          },
          totalBought: Math.max(0, Math.floor(Number(parsed.totalBought ?? 0))),
          totalSold: Math.max(0, Math.floor(Number(parsed.totalSold ?? 0))),
          updatedAt: Number(parsed.updatedAt || Date.now())
        };
      }
    } else {
      localStorage.setItem(PORT_TRADING_TERMINAL_KEY, JSON.stringify(inMemoryPortTerminal));
    }
  } catch {}
  return inMemoryPortTerminal;
}

function savePortTradingTerminal(): void {
  if (typeof window === 'undefined') return;
  try {
    inMemoryPortTerminal.updatedAt = Date.now();
    localStorage.setItem(PORT_TRADING_TERMINAL_KEY, JSON.stringify(inMemoryPortTerminal));
  } catch {}
}

export function getPortTradingTerminalState(): PortTradingTerminalState {
  return loadPortTradingTerminal();
}

let inMemoryPortFishMarket: PortFishMarketState = {
  fishStock: PORT_TERMINAL_INITIAL_STOCK,
  fishPriceGold: 80,
  totalFishTraded: 0,
  totalRelicsSold: 0
};

function loadPortFishMarket(): PortFishMarketState {
  const term = loadPortTradingTerminal();
  if (typeof window === 'undefined') return inMemoryPortFishMarket;
  try {
    const raw = localStorage.getItem(PORT_FISH_MARKET_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        inMemoryPortFishMarket = {
          fishStock: Math.max(0, Math.floor(Number(term.stocks.raw_fish ?? parsed.fishStock ?? PORT_TERMINAL_INITIAL_STOCK))),
          fishPriceGold: 80,
          totalFishTraded: Math.max(0, Math.floor(Number(parsed.totalFishTraded ?? 0))),
          totalRelicsSold: Math.max(0, Math.floor(Number(parsed.totalRelicsSold ?? 0)))
        };
      }
    } else {
      inMemoryPortFishMarket.fishStock = term.stocks.raw_fish;
    }
  } catch {}
  return inMemoryPortFishMarket;
}

function savePortFishMarket(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PORT_FISH_MARKET_KEY, JSON.stringify(inMemoryPortFishMarket));
  } catch {}
}

export function getPortFishMarketState(): PortFishMarketState {
  return loadPortFishMarket();
}

export function getPortRelicMarketPrice(): number {
  return 5000;
}

export const DEFAULT_PORT_ESTATE_OWNER_NICK = 'Redblack';

function createDefaultPortProduction(
  factoryType: string,
  factoryCategoryLabel: string,
  initialFish = 35,
  initialRelics = 12,
  productionStage: 'extraction' | 'raw_processing' | 'relic_foundry' | 'dual_advanced' = 'relic_foundry',
  linkedSectorId: string | null = null,
  intermediateResourceName = 'Рыбный паштет',
  initialProcessed = 16,
  config?: {
    productionTier?: 1 | 2 | 3;
    input1ResourceKey?: PortTerminalResourceKey;
    input1ResourceName?: string;
    input1ResourceIcon?: string;
    input1Stock?: number;
    input1RequiredPerCycle?: number;
    rawBuyPriceGold?: number;
    input2ResourceKey?: PortTerminalResourceKey;
    input2ResourceName?: string;
    input2ResourceIcon?: string;
    input2Stock?: number;
    input2RequiredPerCycle?: number;
    input2BuyPriceGold?: number;
    input3ResourceKey?: PortTerminalResourceKey;
    input3ResourceName?: string;
    input3ResourceIcon?: string;
    input3Stock?: number;
    input3RequiredPerCycle?: number;
    input3BuyPriceGold?: number;
    outputResourceKey?: PortTerminalResourceKey;
    outputProductName?: string;
    outputProductIcon?: string;
    outputRatePerHour?: number;
    productSellPriceGold?: number;
    powerStock?: number;
    powerRequiredPerCycle?: number;
    powerBuyPriceGold?: number;
  }
): PortProductionState {
  const tier: 1 | 2 | 3 =
    config?.productionTier ||
    (productionStage === 'extraction' ? 1 : productionStage === 'raw_processing' ? 2 : 3);
  const hasInput2 = Boolean(config?.input2ResourceKey);
  const hasInput3 = Boolean(config?.input3ResourceKey);
  const isDual = Boolean(tier === 3 || productionStage === 'dual_advanced' || hasInput2);
  const hasInput1 = tier >= 2 || Boolean(config?.input1ResourceKey);
  const outKey = config?.outputResourceKey || (tier === 3 ? 'port_relics' : 'raw_fish');
  const isPowerOrTavern = outKey === 'power_kw' || outKey === 'tavern_meal';
  const defaultPowerReq =
    typeof config?.powerRequiredPerCycle === 'number'
      ? config.powerRequiredPerCycle
      : isPowerOrTavern || tier === 1
      ? 0
      : tier === 2
      ? 1
      : 2;

  return {
    factoryType,
    factoryCategoryLabel,
    productionTier: tier,
    productionStage: tier === 1 ? 'extraction' : tier === 2 ? 'raw_processing' : 'dual_advanced',
    requiresDualInput: isDual,
    input1ResourceKey: hasInput1 ? (config?.input1ResourceKey || 'raw_fish') : undefined,
    input1ResourceName: hasInput1 ? (config?.input1ResourceName || 'Сырая рыба') : undefined,
    input1ResourceIcon: hasInput1 ? (config?.input1ResourceIcon || '🐟') : undefined,
    input1Stock: hasInput1 ? (config?.input1Stock ?? 30) : undefined,
    maxInput1Stock: hasInput1 ? PORT_BASE_MAX_FISH_STOCK : undefined,
    input1RequiredPerCycle: hasInput1 ? (config?.input1RequiredPerCycle ?? 5) : undefined,
    input2ResourceKey: hasInput2 ? config?.input2ResourceKey : undefined,
    input2ResourceName: hasInput2 ? config?.input2ResourceName : undefined,
    input2ResourceIcon: hasInput2 ? config?.input2ResourceIcon : undefined,
    input2Stock: hasInput2 ? (config?.input2Stock ?? 24) : undefined,
    maxInput2Stock: hasInput2 ? PORT_BASE_MAX_FISH_STOCK : undefined,
    input2RequiredPerCycle: hasInput2 ? (config?.input2RequiredPerCycle ?? 2) : undefined,
    input2BuyPriceGold: hasInput2 ? (config?.input2BuyPriceGold ?? 130) : undefined,
    input3ResourceKey: hasInput3 ? config?.input3ResourceKey : undefined,
    input3ResourceName: hasInput3 ? config?.input3ResourceName : undefined,
    input3ResourceIcon: hasInput3 ? config?.input3ResourceIcon : undefined,
    input3Stock: hasInput3 ? (config?.input3Stock ?? 20) : undefined,
    maxInput3Stock: hasInput3 ? PORT_BASE_MAX_FISH_STOCK : undefined,
    input3RequiredPerCycle: hasInput3 ? (config?.input3RequiredPerCycle ?? 1) : undefined,
    input3BuyPriceGold: hasInput3 ? (config?.input3BuyPriceGold ?? 920) : undefined,
    outputResourceKey: outKey,
    outputProductName: config?.outputProductName || (tier === 3 ? 'Древняя Реликвия' : 'Сырая рыба'),
    outputProductIcon: config?.outputProductIcon || (tier === 3 ? '🏺' : '🐟'),
    outputRatePerHour: config?.outputRatePerHour ?? (tier === 1 ? 5 : 1),
    linkedSectorId,
    intermediateResourceName,
    facilityLevel: 1,
    facilityBalanceGold: 25000,
    workerWageGold: (config as any)?.workerWageGold ?? PORT_WORKER_GOLD_PER_HOUR,
    rawBuyPriceGold: config?.rawBuyPriceGold ?? (isDual ? 830 : 80),
    productSellPriceGold: config?.productSellPriceGold ?? (tier === 1 ? 65 : tier === 2 ? 750 : 5000),
    isMerged: false,
    mergedWithSectorId: null,
    fishStock: initialFish,
    maxFishStock: PORT_BASE_MAX_FISH_STOCK,
    processedStock: initialProcessed,
    maxProcessedStock: PORT_BASE_MAX_FISH_STOCK,
    relicStock: initialRelics,
    maxRelicStock: outKey === 'power_kw' ? 250 : PORT_BASE_MAX_RELIC_STOCK,
    lastCraftTickAt: Date.now(),
    workers: [],
    passiveGoldEarned: 2500,
    totalRelicsCrafted: initialRelics,
    powerStock: config?.powerStock ?? (defaultPowerReq > 0 ? 50 : 0),
    maxPowerStock: 200,
    powerRequiredPerCycle: defaultPowerReq,
    powerBuyPriceGold: config?.powerBuyPriceGold ?? 70,
    buildingDurability: 100,
    maxBuildingDurability: 100,
    lastDurabilityDecayAt: Date.now(),
    repairIronStock: 0,
    repairSteelStock: 0,
    repairOrderActive: false,
    workLogs: [],
    dealLogs: []
  };
}

export interface PortEstateTemplate {
  id: string;
  name: string;
  categoryLabel: string;
  factoryType: string;
  productionTier: 1 | 2 | 3;
  productionStage: 'extraction' | 'raw_processing' | 'relic_foundry' | 'dual_advanced';
  requiresDualInput?: boolean;
  input1ResourceKey?: PortTerminalResourceKey;
  input1ResourceName?: string;
  input1ResourceIcon?: string;
  input1RequiredPerCycle?: number;
  rawBuyPriceGold?: number;
  input2ResourceKey?: PortTerminalResourceKey;
  input2ResourceName?: string;
  input2ResourceIcon?: string;
  input2RequiredPerCycle?: number;
  input2BuyPriceGold?: number;
  input3ResourceKey?: PortTerminalResourceKey;
  input3ResourceName?: string;
  input3ResourceIcon?: string;
  input3RequiredPerCycle?: number;
  input3BuyPriceGold?: number;
  outputResourceKey: PortTerminalResourceKey;
  outputProductName: string;
  outputProductIcon: string;
  outputRatePerHour: number;
  productSellPriceGold: number;
  intermediateResourceName: string;
  bonusType: ClanTerritoryBonusType;
  bonusValue: number;
  bonusLabel: string;
  description: string;
}

export const PORT_ESTATE_TEMPLATES: PortEstateTemplate[] = [
  // ЭТАП 1: ДОБЫВАЮЩИЕ ПРЕДПРИЯТИЯ (Вход: 1 рабочий час = 300 🪙, продажа заводам 2-го этапа по 90–130 🪙)
  {
    id: 'tpl_fish_pier',
    name: 'Рыбный причал',
    categoryLabel: 'Этап 1 (Добыча): Сырая рыба (5 ед./ч, продажа: 90 🪙)',
    factoryType: 'fish_pier_extraction',
    productionTier: 1,
    productionStage: 'extraction',
    outputResourceKey: 'raw_fish',
    outputProductName: 'Сырая рыба',
    outputProductIcon: '🐟',
    outputRatePerHour: 5,
    productSellPriceGold: 90,
    intermediateResourceName: 'Сырая рыба',
    bonusType: 'fishing_gold',
    bonusValue: 6,
    bonusLabel: '+6% к золоту на рыбалке',
    description: 'Этап 1 (Добыча): выход — Сырая рыба (5 ед./ч). Закупка у рыбаков: 50 🪙, продажа заводам 2-го этапа: 90 🪙/ед.'
  },
  {
    id: 'tpl_sand_quarry',
    name: 'Песчаный карьер',
    categoryLabel: 'Этап 1 (Добыча): Кварцевый песок (5 ед./ч, продажа: 90 🪙)',
    factoryType: 'sand_quarry_extraction',
    productionTier: 1,
    productionStage: 'extraction',
    outputResourceKey: 'quartz_sand',
    outputProductName: 'Кварцевый песок',
    outputProductIcon: '⏳',
    outputRatePerHour: 5,
    productSellPriceGold: 90,
    intermediateResourceName: 'Кварцевый песок',
    bonusType: 'pyramid_exp',
    bonusValue: 6,
    bonusLabel: '+6% к опыту в боях',
    description: 'Этап 1 (Добыча): выход — Кварцевый песок (5 ед./ч). Себестоимость: 60 🪙, продажа заводам 2-го этапа: 90 🪙/ед.'
  },
  {
    id: 'tpl_nile_mine',
    name: 'Железный рудник',
    categoryLabel: 'Этап 1 (Добыча): Железная руда (4 ед./ч, продажа: 105 🪙)',
    factoryType: 'nile_mine_extraction',
    productionTier: 1,
    productionStage: 'extraction',
    outputResourceKey: 'iron_ore',
    outputProductName: 'Железная руда',
    outputProductIcon: '⛏️',
    outputRatePerHour: 4,
    productSellPriceGold: 105,
    intermediateResourceName: 'Железная руда',
    bonusType: 'pyramid_gold',
    bonusValue: 6,
    bonusLabel: '+6% к золоту в Пирамидах',
    description: 'Этап 1 (Добыча): выход — Железная руда (4 ед./ч). Себестоимость: 75 🪙, продажа заводам 2-го этапа: 105 🪙/ед.'
  },
  {
    id: 'tpl_gold_mine_raw',
    name: 'Золотая шахта',
    categoryLabel: 'Этап 1 (Добыча): Золотой самородок (3 ед./ч, продажа: 130 🪙)',
    factoryType: 'gold_mine_extraction',
    productionTier: 1,
    productionStage: 'extraction',
    outputResourceKey: 'gold_nugget',
    outputProductName: 'Золотой самородок',
    outputProductIcon: '🪨',
    outputRatePerHour: 3,
    productSellPriceGold: 130,
    intermediateResourceName: 'Золотой самородок',
    bonusType: 'pyramid_gold',
    bonusValue: 7,
    bonusLabel: '+7% к золоту в Пирамидах',
    description: 'Этап 1 (Добыча): выход — Золотой самородок (3 ед./ч). Себестоимость: 100 🪙, продажа заводам 2-го этапа: 130 🪙/ед.'
  },
  {
    id: 'tpl_oil_rig_oasis',
    name: 'Нефтяная вышка',
    categoryLabel: 'Этап 1 (Добыча): Сырая нефть (3 ед./ч, продажа: 120 🪙)',
    factoryType: 'oil_rig_extraction',
    productionTier: 1,
    productionStage: 'extraction',
    outputResourceKey: 'crude_oil',
    outputProductName: 'Сырая нефть',
    outputProductIcon: '🛢️',
    outputRatePerHour: 3,
    productSellPriceGold: 120,
    intermediateResourceName: 'Сырая нефть',
    bonusType: 'pyramid_exp',
    bonusValue: 7,
    bonusLabel: '+7% к опыту в боях',
    description: 'Этап 1 (Добыча): выход — Сырая нефть (3 ед./ч). Себестоимость: 100 🪙, продажа заводам 2-го этапа: 120 🪙/ед.'
  },
  {
    id: 'tpl_flax_plantation',
    name: 'Плантация Льна и Папируса',
    categoryLabel: 'Этап 1 (Добыча, Объект №15): Волокно Льна (5 ед./ч, продажа: 90 🪙)',
    factoryType: 'flax_plantation_extraction',
    productionTier: 1,
    productionStage: 'extraction',
    outputResourceKey: 'flax_fiber',
    outputProductName: 'Волокно Льна',
    outputProductIcon: '🌿',
    outputRatePerHour: 5,
    productSellPriceGold: 90,
    intermediateResourceName: 'Волокно Льна',
    bonusType: 'fishing_gold',
    bonusValue: 7,
    bonusLabel: '+7% к золоту на рыбалке',
    description: 'Объект №15 (Добыча): выход — Волокно Льна (5 ед./ч). Себестоимость: 60 🪙, продажа заводам 2-го этапа: 90 🪙/ед.'
  },
  {
    id: 'tpl_saltpeter_quarry',
    name: 'Селитровый Карьер',
    categoryLabel: 'Этап 1 (Добыча, Объект №16): Природная Селитра (4 ед./ч, продажа: 105 🪙)',
    factoryType: 'saltpeter_quarry_extraction',
    productionTier: 1,
    productionStage: 'extraction',
    outputResourceKey: 'natural_saltpeter',
    outputProductName: 'Природная Селитра',
    outputProductIcon: '🧂',
    outputRatePerHour: 4,
    productSellPriceGold: 105,
    intermediateResourceName: 'Природная Селитра',
    bonusType: 'combat_dmg',
    bonusValue: 6,
    bonusLabel: '+6% к боевому урону',
    description: 'Объект №16 (Добыча): выход — Природная Селитра (4 ед./ч). Себестоимость: 75 🪙, продажа заводам 2-го этапа: 105 🪙/ед.'
  },
  {
    id: 'tpl_cotton_plantation',
    name: 'Плантация Хлопка и Красителей',
    categoryLabel: 'Этап 1 (Добыча, Сектор [2/8]): Сырое Волокно (5 ед./ч, с/с: 60 🪙, продажа: 90 🪙)',
    factoryType: 'cotton_plantation_extraction',
    productionTier: 1,
    productionStage: 'extraction',
    outputResourceKey: 'raw_cotton_fiber',
    outputProductName: 'Сырое Волокно',
    outputProductIcon: '🧵',
    outputRatePerHour: 5,
    productSellPriceGold: 90,
    intermediateResourceName: 'Сырое Волокно',
    bonusType: 'fishing_gold',
    bonusValue: 8,
    bonusLabel: '+8% к золоту на рыбалке',
    description: 'Плантация Хлопка и Красителей (Сектор [2/8]): производит ресурс «Сырое Волокно» (вес 1 ед., 5 ед./ч). Себестоимость: 60 🪙, продажа завода: 90 🪙/ед.'
  },

  // ЭТАП 2: ПЕРВИЧНЫЕ ЗАВОДЫ (Себестоимость ~750 🪙 → цена продажи 900 🪙, чистая прибыль владельца Redblack: +150 🪙/ед.)
  {
    id: 'tpl_fish_plant',
    name: 'Рыбный комбинат',
    categoryLabel: 'Этап 2 (Заводы): Сырая рыба (5 ед. по 75 🪙) → Рыбный паштет (1 ед./ч по 900 🪙)',
    factoryType: 'solar_relic_foundry',
    productionTier: 2,
    productionStage: 'raw_processing',
    input1ResourceKey: 'raw_fish',
    input1ResourceName: 'Сырая рыба',
    input1ResourceIcon: '🐟',
    input1RequiredPerCycle: 5,
    rawBuyPriceGold: 75,
    outputResourceKey: 'fish_semifinished',
    outputProductName: 'Рыбный паштет',
    outputProductIcon: '🥫',
    outputRatePerHour: 1,
    productSellPriceGold: 900,
    intermediateResourceName: 'Рыбный паштет',
    bonusType: 'fishing_gold',
    bonusValue: 8,
    bonusLabel: '+8% к золоту на рыбалке',
    description: 'Этап 2 (Первичный завод): скупает Сырую рыбу (у рыбаков по 50 🪙, с причалов по 75 🪙). Себестоимость: ~750 🪙, продажа: 900 🪙/ед. (Чистая прибыль: +150 🪙/ч).'
  },
  {
    id: 'tpl_gold_smelter',
    name: 'Плавильный завод',
    categoryLabel: 'Этап 2 (Заводы): Золотой самородок (3 ед. по 125 🪙) → Золотые слитки (1 ед./ч по 900 🪙)',
    factoryType: 'gold_smelter_dock',
    productionTier: 2,
    productionStage: 'raw_processing',
    input1ResourceKey: 'gold_nugget',
    input1ResourceName: 'Золотой самородок',
    input1ResourceIcon: '🪨',
    input1RequiredPerCycle: 3,
    rawBuyPriceGold: 125,
    outputResourceKey: 'gold_ingots',
    outputProductName: 'Золотые слитки',
    outputProductIcon: '🪙',
    outputRatePerHour: 1,
    productSellPriceGold: 900,
    intermediateResourceName: 'Золотые слитки',
    bonusType: 'pyramid_gold',
    bonusValue: 10,
    bonusLabel: '+10% к золоту в Пирамидах',
    description: 'Этап 2 (Первичный завод): скупает Золотой самородок (3 ед./ч по 125 🪙). Себестоимость: ~750 🪙, продажа: 900 🪙/ед. (Чистая прибыль: +150 🪙/ч).'
  },
  {
    id: 'tpl_alchemy_lab',
    name: 'Алхимическая лаборатория',
    categoryLabel: 'Этап 2 (Заводы): Кварцевый песок (2 по 90 🪙) + Сырая нефть (2 по 100 🪙) → Алхимический реагент (900 🪙)',
    factoryType: 'alchemy_beacon',
    productionTier: 2,
    productionStage: 'raw_processing',
    requiresDualInput: true,
    input1ResourceKey: 'quartz_sand',
    input1ResourceName: 'Кварцевый песок',
    input1ResourceIcon: '⏳',
    input1RequiredPerCycle: 2,
    rawBuyPriceGold: 90,
    input2ResourceKey: 'crude_oil',
    input2ResourceName: 'Сырая нефть',
    input2ResourceIcon: '🛢️',
    input2RequiredPerCycle: 2,
    input2BuyPriceGold: 100,
    outputResourceKey: 'alchemy_reagents',
    outputProductName: 'Алхимический реагент',
    outputProductIcon: '🧪',
    outputRatePerHour: 1,
    productSellPriceGold: 900,
    intermediateResourceName: 'Алхимический реагент',
    bonusType: 'pyramid_exp',
    bonusValue: 10,
    bonusLabel: '+10% к опыту в боях',
    description: 'Этап 2 (Первичный завод): также скупает «Траву Оазиса» из Аутленда по 120 🪙! Себестоимость реагента: ~750 🪙, продажа: 900 🪙/ед. (Чистая прибыль: +150 🪙/ч).'
  },
  {
    id: 'tpl_weaving_mill',
    name: 'Ткацкая Мануфактура',
    categoryLabel: 'Этап 2 (Объект №17): Волокно Льна (4 по 95 🪙) → Броневая Ткань (1 ед./ч по 900 🪙)',
    factoryType: 'weaving_mill_factory',
    productionTier: 2,
    productionStage: 'raw_processing',
    input1ResourceKey: 'flax_fiber',
    input1ResourceName: 'Волокно Льна',
    input1ResourceIcon: '🌿',
    input1RequiredPerCycle: 4,
    rawBuyPriceGold: 95,
    outputResourceKey: 'armor_fabric',
    outputProductName: 'Броневая Ткань',
    outputProductIcon: '🧶',
    outputRatePerHour: 1,
    productSellPriceGold: 900,
    intermediateResourceName: 'Броневая Ткань',
    bonusType: 'max_hp',
    bonusValue: 8,
    bonusLabel: '+8% к макс. здоровью',
    description: 'Объект №17 (Первичный завод): вход — Волокно Льна (4 по 95 🪙) + 1 кВт (70 🪙) + Рабочий (300 🪙). Себестоимость: 750 🪙, продажа: 900 🪙/ед. (Прибыль: +150 🪙).'
  },
  {
    id: 'tpl_gunpowder_plant',
    name: 'Пороховой Завод',
    categoryLabel: 'Этап 2 (Объект №18): Селитра (3 по 90 🪙) + Нефть (1 по 110 🪙) → Оружейный Порох (900 🪙)',
    factoryType: 'gunpowder_plant_factory',
    productionTier: 2,
    productionStage: 'raw_processing',
    requiresDualInput: true,
    input1ResourceKey: 'natural_saltpeter',
    input1ResourceName: 'Природная Селитра',
    input1ResourceIcon: '🧂',
    input1RequiredPerCycle: 3,
    rawBuyPriceGold: 90,
    input2ResourceKey: 'crude_oil',
    input2ResourceName: 'Сырая нефть',
    input2ResourceIcon: '🛢️',
    input2RequiredPerCycle: 1,
    input2BuyPriceGold: 110,
    outputResourceKey: 'gunpowder',
    outputProductName: 'Оружейный Порох',
    outputProductIcon: '🧨',
    outputRatePerHour: 1,
    productSellPriceGold: 900,
    intermediateResourceName: 'Оружейный Порох',
    bonusType: 'combat_dmg',
    bonusValue: 8,
    bonusLabel: '+8% к боевому урону',
    description: 'Объект №18 (Первичный завод): вход — Селитра (3 по 90 🪙) + Нефть (1 по 110 🪙) + 1 кВт (70 🪙) + Рабочий (300 🪙). Себестоимость: 750 🪙, продажа: 900 🪙/ед. (Прибыль: +150 🪙).'
  },

  // ЭТАП 3: ВОЕНПРОМ И ВЫСОКОТЕХНОЛОГИЧНЫЕ МАНУФАКТУРЫ (Себестоимость 2 000–4 200 🪙 → продажа 2 500–5 000 🪙, прибыль +500..+800 🪙)
  {
    id: 'tpl_steel_combat_modules',
    name: 'Сталелитейный цех',
    categoryLabel: 'Этап 3 (Мануфактура): Железная руда (6 по 110 🪙) + Реагент (1 по 900 🪙) → Закаленная сталь (2 500 🪙)',
    factoryType: 'steel_foundry',
    productionTier: 3,
    productionStage: 'dual_advanced',
    requiresDualInput: true,
    input1ResourceKey: 'iron_ore',
    input1ResourceName: 'Железная руда',
    input1ResourceIcon: '⛏️',
    input1RequiredPerCycle: 6,
    rawBuyPriceGold: 110,
    input2ResourceKey: 'alchemy_reagents',
    input2ResourceName: 'Алхимический реагент',
    input2ResourceIcon: '🧪',
    input2RequiredPerCycle: 1,
    input2BuyPriceGold: 900,
    outputResourceKey: 'hardened_steel',
    outputProductName: 'Закаленная сталь',
    outputProductIcon: '🔩',
    outputRatePerHour: 1,
    productSellPriceGold: 2500,
    intermediateResourceName: 'Железная руда + Алхимический реагент',
    bonusType: 'max_hp',
    bonusValue: 10,
    bonusLabel: '+10% к макс. здоровью',
    description: 'Этап 3 (Мануфактура): себестоимость 2 000 🪙, продажа: 2 500 🪙/ед. (Чистая прибыль владельца: +500 🪙/ед.).'
  },
  {
    id: 'tpl_field_food_plant',
    name: 'Полевой Продкомбинат',
    categoryLabel: 'Этап 3 (Мануфактура): Паштет (2 по 900 🪙) + Реагент (1 по 900 🪙) → Боевой стимулятор (3 700 🪙)',
    factoryType: 'field_food_plant',
    productionTier: 3,
    productionStage: 'dual_advanced',
    requiresDualInput: true,
    input1ResourceKey: 'fish_semifinished',
    input1ResourceName: 'Рыбный паштет',
    input1ResourceIcon: '🥫',
    input1RequiredPerCycle: 2,
    rawBuyPriceGold: 900,
    input2ResourceKey: 'alchemy_reagents',
    input2ResourceName: 'Алхимический реагент',
    input2ResourceIcon: '🧪',
    input2RequiredPerCycle: 1,
    input2BuyPriceGold: 900,
    outputResourceKey: 'combat_ration',
    outputProductName: 'Боевой стимулятор',
    outputProductIcon: '💉',
    outputRatePerHour: 1,
    productSellPriceGold: 3700,
    intermediateResourceName: 'Рыбный паштет + Алхимический реагент',
    bonusType: 'max_hp',
    bonusValue: 8,
    bonusLabel: '+8% к макс. здоровью',
    description: 'Этап 3 (Мануфактура): себестоимость 3 140 🪙, продажа: 3 700 🪙/ед. (Чистая прибыль владельца: +560 🪙/ед.).'
  },
  {
    id: 'tpl_elite_weapon_manufactory',
    name: 'Оружейная Мануфактура',
    categoryLabel: 'Этап 3 (Мануфактура): Сталь (1 по 2 500 🪙) + Слитки (1 по 900 🪙) → Боевые модули (4 500 🪙)',
    factoryType: 'elite_weapon_manufactory',
    productionTier: 3,
    productionStage: 'dual_advanced',
    requiresDualInput: true,
    input1ResourceKey: 'hardened_steel',
    input1ResourceName: 'Закаленная сталь',
    input1ResourceIcon: '🔩',
    input1RequiredPerCycle: 1,
    rawBuyPriceGold: 2500,
    input2ResourceKey: 'gold_ingots',
    input2ResourceName: 'Золотые слитки',
    input2ResourceIcon: '🪙',
    input2RequiredPerCycle: 1,
    input2BuyPriceGold: 900,
    outputResourceKey: 'combat_modules',
    outputProductName: 'Боевые модули',
    outputProductIcon: '⚙️',
    outputRatePerHour: 1,
    productSellPriceGold: 4500,
    intermediateResourceName: 'Закаленная сталь + Золотые слитки',
    bonusType: 'combat_dmg',
    bonusValue: 10,
    bonusLabel: '+10% к боевому урону',
    description: 'Этап 3 (Мануфактура): себестоимость 3 840 🪙, продажа: 4 500 🪙/ед. (Чистая прибыль владельца: +660 🪙/ед.).'
  },
  {
    id: 'tpl_relic_workshop',
    name: 'Мастерская Реликвий',
    categoryLabel: 'Этап 3 (Мануфактура): Слитки (2) + Паштет (1) + Реагент (1) → Древняя Реликвия (5 000 🪙)',
    factoryType: 'solar_relic_foundry',
    productionTier: 3,
    productionStage: 'dual_advanced',
    requiresDualInput: true,
    input1ResourceKey: 'gold_ingots',
    input1ResourceName: 'Золотые слитки',
    input1ResourceIcon: '🪙',
    input1RequiredPerCycle: 2,
    rawBuyPriceGold: 900,
    input2ResourceKey: 'fish_semifinished',
    input2ResourceName: 'Рыбный паштет',
    input2ResourceIcon: '🥫',
    input2RequiredPerCycle: 1,
    input2BuyPriceGold: 900,
    input3ResourceKey: 'alchemy_reagents',
    input3ResourceName: 'Алхимический реагент',
    input3ResourceIcon: '🧪',
    input3RequiredPerCycle: 1,
    input3BuyPriceGold: 900,
    outputResourceKey: 'port_relics',
    outputProductName: 'Древняя Реликвия',
    outputProductIcon: '🏺',
    outputRatePerHour: 1,
    productSellPriceGold: 5000,
    intermediateResourceName: 'Золотые слитки + Рыбный паштет + Алхимический реагент',
    bonusType: 'slots_luck',
    bonusValue: 10,
    bonusLabel: '+10% к удаче в слотах',
    description: 'Этап 3 (Мануфактура): себестоимость ~4 200 🪙, продажа: 5 000 🪙/ед. (Чистая прибыль владельца: +800 🪙/ед.).'
  },
  {
    id: 'tpl_special_armor_factory',
    name: 'Фабрика Спецзащиты',
    categoryLabel: 'Этап 3 (Объект №19): Броневая Ткань (2 по 900 🪙) + Закаленная сталь (1 по 2 000 🪙) → Титановая Бронепластина (4 800 🪙)',
    factoryType: 'special_armor_factory',
    productionTier: 3,
    productionStage: 'dual_advanced',
    requiresDualInput: true,
    input1ResourceKey: 'armor_fabric',
    input1ResourceName: 'Броневая Ткань',
    input1ResourceIcon: '🧶',
    input1RequiredPerCycle: 2,
    rawBuyPriceGold: 900,
    input2ResourceKey: 'hardened_steel',
    input2ResourceName: 'Закаленная сталь',
    input2ResourceIcon: '🔩',
    input2RequiredPerCycle: 1,
    input2BuyPriceGold: 2000,
    outputResourceKey: 'titanium_plate',
    outputProductName: 'Титановая Бронепластина',
    outputProductIcon: '🛡️',
    outputRatePerHour: 1,
    productSellPriceGold: 4800,
    intermediateResourceName: 'Броневая Ткань + Закаленная сталь',
    bonusType: 'max_hp',
    bonusValue: 12,
    bonusLabel: '+12% к макс. здоровью',
    description: 'Объект №19 (Военпром): себестоимость ~4 200 🪙, продажа: 4 800 🪙/ед. (Чистая прибыль владельца: +600 🪙/ед.).'
  },
  {
    id: 'tpl_siege_ammo_plant',
    name: 'Цех Осадных Боеприпасов',
    categoryLabel: 'Этап 3 (Объект №20): Оружейный Порох (2 по 900 🪙) + Боевые модули (1 по 2 000 🪙) → Штурмовой Заряд (5 000 🪙)',
    factoryType: 'siege_ammo_plant',
    productionTier: 3,
    productionStage: 'dual_advanced',
    requiresDualInput: true,
    input1ResourceKey: 'gunpowder',
    input1ResourceName: 'Оружейный Порох',
    input1ResourceIcon: '🧨',
    input1RequiredPerCycle: 2,
    rawBuyPriceGold: 900,
    input2ResourceKey: 'combat_modules',
    input2ResourceName: 'Боевые модули',
    input2ResourceIcon: '⚙️',
    input2RequiredPerCycle: 1,
    input2BuyPriceGold: 2000,
    outputResourceKey: 'assault_charge',
    outputProductName: 'Штурмовой Заряд',
    outputProductIcon: '💣',
    outputRatePerHour: 1,
    productSellPriceGold: 5000,
    intermediateResourceName: 'Оружейный Порох + Боевые модули',
    bonusType: 'combat_dmg',
    bonusValue: 12,
    bonusLabel: '+12% к боевому урону',
    description: 'Объект №20 (Военпром): себестоимость ~4 200 🪙, продажа: 5 000 🪙/ед. (Чистая прибыль владельца: +800 🪙/ед.).'
  },
  {
    id: 'tpl_pharaoh_jewelry',
    name: 'Ювелирная Мастерская Фараона',
    categoryLabel: 'Этап 3 (Сектор [9/3]): Золотой слиток (1) + Кварцевый песок (2) + 1 кВт → Церемониальный Амулет (2 500 🪙)',
    factoryType: 'pharaoh_jewelry_workshop',
    productionTier: 3,
    productionStage: 'dual_advanced',
    requiresDualInput: true,
    input1ResourceKey: 'gold_ingots',
    input1ResourceName: 'Золотые слитки',
    input1ResourceIcon: '🪙',
    input1RequiredPerCycle: 1,
    rawBuyPriceGold: 900,
    input2ResourceKey: 'quartz_sand',
    input2ResourceName: 'Кварцевый песок',
    input2ResourceIcon: '⏳',
    input2RequiredPerCycle: 2,
    input2BuyPriceGold: 95,
    outputResourceKey: 'ceremonial_amulet',
    outputProductName: 'Церемониальный Амулет',
    outputProductIcon: '📿',
    outputRatePerHour: 1,
    productSellPriceGold: 2500,
    intermediateResourceName: 'Золотые слитки + Кварцевый песок',
    bonusType: 'pyramid_gold',
    bonusValue: 12,
    bonusLabel: '+12% к золоту в Пирамидах',
    description: 'Ювелирная Мастерская Фараона (Сектор [9/3]): себестоимость ~2 000 🪙, продажа завода: 2 500 🪙 (Чистая прибыль владельца: +500 🪙/ед.).'
  },

  // ОБЪЕКТ №13: ЭЛЕКТРОСТАНЦИЯ (Энергосеть сектора)
  {
    id: 'tpl_power_plant',
    name: 'Электростанция',
    categoryLabel: 'Энергосеть (Объект №13): Сырая нефть (2 ед. по 130 🪙) → Мощность (10 кВт/ч по 70 🪙)',
    factoryType: 'power_plant_grid',
    productionTier: 2,
    productionStage: 'raw_processing',
    input1ResourceKey: 'crude_oil',
    input1ResourceName: 'Сырая нефть',
    input1ResourceIcon: '🛢️',
    input1RequiredPerCycle: 2,
    rawBuyPriceGold: 130,
    outputResourceKey: 'power_kw',
    outputProductName: 'Мощность (кВт)',
    outputProductIcon: '⚡',
    outputRatePerHour: 10,
    productSellPriceGold: 70,
    intermediateResourceName: 'Мощность (кВт)',
    bonusType: 'pyramid_exp',
    bonusValue: 8,
    bonusLabel: '+8% к опыту в боях',
    description: 'Энергосеть (Объект №13): потребляет Сырую нефть (2 ед./ч по 130 🪙) + 1 рабочий час (250 🪙) → вырабатывает 10 ед. Мощности/ч. Себестоимость: 51 🪙, продажа: 70 🪙/ед.'
  },

  // ОБЪЕКТ №14: ПОРТОВАЯ ТАВЕРНА / БАР (Восстановление бодрости)
  {
    id: 'tpl_port_tavern',
    name: 'Портовая Таверна',
    categoryLabel: 'Бар / Таверна (Объект №14): Рыбный паштет (1 по 820 🪙) → Обеды (+25% бодрости за 300 🪙)',
    factoryType: 'port_tavern_bar',
    productionTier: 2,
    productionStage: 'raw_processing',
    input1ResourceKey: 'fish_semifinished',
    input1ResourceName: 'Рыбный паштет',
    input1ResourceIcon: '🥫',
    input1RequiredPerCycle: 1,
    rawBuyPriceGold: 820,
    outputResourceKey: 'tavern_meal',
    outputProductName: 'Обед Таверны (+25% Бодрости)',
    outputProductIcon: '🍺',
    outputRatePerHour: 4,
    productSellPriceGold: 300,
    intermediateResourceName: 'Обед Таверны (+25% Бодрости)',
    bonusType: 'max_hp',
    bonusValue: 6,
    bonusLabel: '+6% к макс. здоровью',
    description: 'Портовая Таверна (Объект №14): закупает Рыбный паштет (по 820 🪙) и продает готовые блюда/напитки посетителям (1 порция = 300 🪙, мгновенно восстанавливает +25% бодрости).'
  }
];

export const PORT_ISLAND_GRID_SIZE = 10;
export const DEFAULT_PORT_ISLAND_POS = { x: 7, y: 6 };
export const PORT_FOOT_STEP_SECONDS = 30;

export function normalizePortIslandCoord(
  rawX?: number | null,
  rawY?: number | null
): { x: number; y: number } {
  let x = Math.floor(Number(rawX) || DEFAULT_PORT_ISLAND_POS.x);
  let y = Math.floor(Number(rawY) || DEFAULT_PORT_ISLAND_POS.y);
  if (y === 12) y = 6;
  else if (y === 11) y = 5;
  else if (y === 13) y = 7;
  else if (y > PORT_ISLAND_GRID_SIZE) y = DEFAULT_PORT_ISLAND_POS.y;

  if (x > PORT_ISLAND_GRID_SIZE) x = DEFAULT_PORT_ISLAND_POS.x;

  x = Math.max(1, Math.min(PORT_ISLAND_GRID_SIZE, x));
  y = Math.max(1, Math.min(PORT_ISLAND_GRID_SIZE, y));
  return { x, y };
}

export interface PortIslandCellMeta {
  x: number;
  y: number;
  coordLabel: string;
  biomeType:
    | 'sea_water'
    | 'coastal_reef'
    | 'harbor_dock'
    | 'oasis_palm'
    | 'golden_dunes'
    | 'industrial_hub'
    | 'temple_citadel';
  sectorTitle: string;
  terrainIcon: string;
  isWalkable: boolean;
}

const SPECIAL_PORT_SECTOR_NAMES: Record<string, { title: string; icon: string; biome: PortIslandCellMeta['biomeType'] }> = {
  '7_6': { title: 'Центральная Гавань Фароса (Торговый Узел)', icon: '⚓', biome: 'harbor_dock' },
  '6_6': { title: 'Золотые Прииски Дельты', icon: '🪨', biome: 'industrial_hub' },
  '8_6': { title: 'Плавильный Док и Железные Рудники', icon: '⛏️', biome: 'industrial_hub' },
  '7_5': { title: 'Военный Бастион и Полевой Продкомбинат', icon: '💉', biome: 'temple_citadel' },
  '7_7': { title: 'Южный Маяк и Песчаный Карьер', icon: '🧪', biome: 'harbor_dock' },
  '8_5': { title: 'Оружейный Бастион Александрии', icon: '⚙️', biome: 'industrial_hub' },
  '6_5': { title: 'Сталелитейный Квартал', icon: '🔩', biome: 'industrial_hub' },
  '5_5': { title: 'Центральный Оазис и Стадион Фароса', icon: '🏟️', biome: 'oasis_palm' },
  '5_6': { title: 'Храмовая Площадь Солнца', icon: '🏛️', biome: 'temple_citadel' },
  '6_7': { title: 'Караванный Перекрёсток Нила', icon: '🐪', biome: 'oasis_palm' },
  '2_8': { title: 'Плантация Хлопка и Красителей Дельты', icon: '🧵', biome: 'oasis_palm' },
  '9_3': { title: 'Ювелирный Квартал Фараона', icon: '📿', biome: 'temple_citadel' },
  '1_5': { title: 'Причал контрабандистов (Западный рейд Outland)', icon: '🏝️', biome: 'coastal_reef' },
  '10_5': { title: 'Причал контрабандистов (Восточный рейд Outland)', icon: '🏝️', biome: 'coastal_reef' },
  '5_1': { title: 'Причал контрабандистов (Северный рейд Outland)', icon: '🏝️', biome: 'coastal_reef' },
  '5_10': { title: 'Причал контрабандистов (Южный рейд Outland)', icon: '🏝️', biome: 'coastal_reef' }
};

export function getPortIslandCellMeta(x: number, y: number): PortIslandCellMeta {
  const { x: cx, y: cy } = normalizePortIslandCoord(x, y);
  const key = `${cx}_${cy}`;
  const displayCoord = `[${cx}/${cy}]`;
  const special = SPECIAL_PORT_SECTOR_NAMES[key];
  if (special) {
    return {
      x: cx,
      y: cy,
      coordLabel: displayCoord,
      biomeType: special.biome,
      sectorTitle: special.title,
      terrainIcon: special.icon,
      isWalkable: true
    };
  }

  const dx = cx - 5.5;
  const dy = cy - 5.5;
  const dist = Math.sqrt(dx * dx * 0.92 + dy * dy * 0.88);

  if (cx === 1 || cx === 10 || cy === 1 || cy === 10 || dist > 4.35) {
    return {
      x: cx,
      y: cy,
      coordLabel: displayCoord,
      biomeType: 'sea_water',
      sectorTitle: `Прибрежные воды Средиземноморья ${displayCoord}`,
      terrainIcon: '🌊',
      isWalkable: true
    };
  }

  if (cy >= 6 && cy <= 8 && cx >= 5 && cx <= 8) {
    return {
      x: cx,
      y: cy,
      coordLabel: displayCoord,
      biomeType: 'harbor_dock',
      sectorTitle: `Портовая Набережная Нила ${displayCoord}`,
      terrainIcon: '⛵',
      isWalkable: true
    };
  }

  if (dist <= 1.85) {
    return {
      x: cx,
      y: cy,
      coordLabel: displayCoord,
      biomeType: 'oasis_palm',
      sectorTitle: `Изумрудный Оазис Дельты ${displayCoord}`,
      terrainIcon: '🌴',
      isWalkable: true
    };
  }

  if ((cx + cy) % 4 === 0) {
    return {
      x: cx,
      y: cy,
      coordLabel: displayCoord,
      biomeType: 'temple_citadel',
      sectorTitle: `Древний Квартал Обелисков ${displayCoord}`,
      terrainIcon: '🏛️',
      isWalkable: true
    };
  }

  if ((cx * cy) % 3 === 0) {
    return {
      x: cx,
      y: cy,
      coordLabel: displayCoord,
      biomeType: 'industrial_hub',
      sectorTitle: `Ремесленный Сектор Порта ${displayCoord}`,
      terrainIcon: '🏭',
      isWalkable: true
    };
  }

  return {
    x: cx,
    y: cy,
    coordLabel: displayCoord,
    biomeType: 'golden_dunes',
    sectorTitle: `Песчаное Плато Острова ${displayCoord}`,
    terrainIcon: '🏜️',
    isWalkable: true
  };
}

export function calculatePortSectorTravelSeconds(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  activeTransport?: GameItem | null
): {
  stepsCount: number;
  totalSeconds: number;
  secondsPerStep: number;
  speedupPct: number;
  usingTransport: boolean;
  cargoCapacity: number;
} {
  const dx = Math.abs(Math.floor(toX) - Math.floor(fromX));
  const dy = Math.abs(Math.floor(toY) - Math.floor(fromY));
  const stepsCount = Math.max(1, Math.max(dx, dy));

  const trInfo = resolveTransportSpeedAndCargo(activeTransport);

  if (!trInfo.usingTransport) {
    return {
      stepsCount,
      totalSeconds: stepsCount * PORT_FOOT_STEP_SECONDS,
      secondsPerStep: PORT_FOOT_STEP_SECONDS,
      speedupPct: 0,
      usingTransport: false,
      cargoCapacity: 0
    };
  }

  const secondsPerStep = trInfo.stepSeconds;
  const totalSeconds = Math.max(4, stepsCount * secondsPerStep);
  const speedupPct = Math.max(10, Math.round((1 - secondsPerStep / PORT_FOOT_STEP_SECONDS) * 100));

  return {
    stepsCount,
    totalSeconds,
    secondsPerStep,
    speedupPct,
    usingTransport: true,
    cargoCapacity: trInfo.cargoCapacity
  };
}

export const DEFAULT_CLAN_TERRITORIES: ClanTerritorySector[] = [
  // ================= ЭТАП 1: ДОБЫВАЮЩИЕ ПРЕДПРИЯТИЯ (7 объектов) =================
  {
    id: 'sector_fish_pier',
    name: 'Рыбный причал',
    icon: '👑',
    description: 'Этап 1 (Добыча): выход — Сырая рыба (5 ед./ч). Себестоимость: 50 🪙, продажа: 65 🪙/ед. (Прибыль: +75 🪙/ч).',
    zone: 'port',
    mapX: 7,
    mapY: 6,
    sectorBiomeName: 'Центральная Гавань Фароса (Торговый Узел)',
    buildingCategory: 'extraction',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'fishing_gold',
    bonusValue: 6,
    bonusLabel: '+6% к золоту на рыбалке',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'fish_pier_extraction',
      'Этап 1 (Добыча): Сырая рыба (5 ед./ч)',
      50,
      30,
      'extraction',
      'sector_nile_oasis',
      'Сырая рыба',
      30,
      {
        productionTier: 1,
        outputResourceKey: 'raw_fish',
        outputProductName: 'Сырая рыба',
        outputProductIcon: '🐟',
        outputRatePerHour: 5,
        productSellPriceGold: 65
      }
    )
  },
  {
    id: 'sector_sand_quarry',
    name: 'Песчаный карьер',
    icon: '👑',
    description: 'Этап 1 (Добыча): выход — Кварцевый песок (5 ед./ч). Себестоимость: 50 🪙, продажа: 65 🪙/ед. (Прибыль: +75 🪙/ч).',
    zone: 'port',
    mapX: 7,
    mapY: 7,
    sectorBiomeName: 'Южный Маяк и Песчаный Карьер',
    buildingCategory: 'extraction',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'pyramid_exp',
    bonusValue: 6,
    bonusLabel: '+6% к опыту в боях',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'sand_quarry_extraction',
      'Этап 1 (Добыча): Кварцевый песок (5 ед./ч)',
      40,
      28,
      'extraction',
      'sector_luxor_obelisk',
      'Кварцевый песок',
      28,
      {
        productionTier: 1,
        outputResourceKey: 'quartz_sand',
        outputProductName: 'Кварцевый песок',
        outputProductIcon: '⏳',
        outputRatePerHour: 5,
        productSellPriceGold: 65
      }
    )
  },
  {
    id: 'sector_nile_mine',
    name: 'Железный рудник',
    icon: '👑',
    description: 'Этап 1 (Добыча): выход — Железная руда (4 ед./ч). Себестоимость: 62.5 🪙, продажа: 80 🪙/ед. (Прибыль: +70 🪙/ч).',
    zone: 'port',
    mapX: 8,
    mapY: 6,
    sectorBiomeName: 'Плавильный Док и Железные Рудники',
    buildingCategory: 'extraction',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'pyramid_gold',
    bonusValue: 6,
    bonusLabel: '+6% к золоту в Пирамидах',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'nile_mine_extraction',
      'Этап 1 (Добыча): Железная руда (4 ед./ч)',
      40,
      25,
      'extraction',
      'sector_steel_modules',
      'Железная руда',
      25,
      {
        productionTier: 1,
        outputResourceKey: 'iron_ore',
        outputProductName: 'Железная руда',
        outputProductIcon: '⛏️',
        outputRatePerHour: 4,
        productSellPriceGold: 80
      }
    )
  },
  {
    id: 'sector_gold_mine_raw',
    name: 'Золотая шахта',
    icon: '👑',
    description: 'Этап 1 (Добыча): выход — Золотой самородок (3 ед./ч). Себестоимость: 83.3 🪙, продажа: 105 🪙/ед. (Прибыль: +65 🪙/ч).',
    zone: 'port',
    mapX: 6,
    mapY: 6,
    sectorBiomeName: 'Золотые Прииски Дельты',
    buildingCategory: 'extraction',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'pyramid_gold',
    bonusValue: 7,
    bonusLabel: '+7% к золоту в Пирамидах',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'gold_mine_extraction',
      'Этап 1 (Добыча): Золотой самородок (3 ед./ч)',
      35,
      24,
      'extraction',
      'sector_gold_mines',
      'Золотой самородок',
      24,
      {
        productionTier: 1,
        outputResourceKey: 'gold_nugget',
        outputProductName: 'Золотой самородок',
        outputProductIcon: '🪨',
        outputRatePerHour: 3,
        productSellPriceGold: 105
      }
    )
  },
  {
    id: 'sector_oil_rig_oasis',
    name: 'Нефтяная вышка',
    icon: '👑',
    description: 'Этап 1 (Добыча): выход — Сырая нефть (3 ед./ч). Себестоимость: 83.3 🪙, продажа: 105 🪙/ед. (Прибыль: +65 🪙/ч).',
    zone: 'port',
    mapX: 5,
    mapY: 5,
    sectorBiomeName: 'Нефтяной Оазис Фараонов',
    buildingCategory: 'extraction',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'pyramid_exp',
    bonusValue: 7,
    bonusLabel: '+7% к опыту в боях',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'oil_rig_extraction',
      'Этап 1 (Добыча): Сырая нефть (3 ед./ч)',
      35,
      22,
      'extraction',
      'sector_luxor_obelisk',
      'Сырая нефть',
      22,
      {
        productionTier: 1,
        outputResourceKey: 'crude_oil',
        outputProductName: 'Сырая нефть',
        outputProductIcon: '🛢️',
        outputRatePerHour: 3,
        productSellPriceGold: 105
      }
    )
  },
  {
    id: 'sector_flax_plantation',
    name: 'Плантация Льна и Папируса',
    icon: '👑',
    description: 'Объект №15 (Этап 1 — Добыча): выход — Волокно Льна (5 ед./ч). Себестоимость: 50 🪙, продажа: 65 🪙/ед. (Прибыль: +75 🪙/ч).',
    zone: 'port',
    mapX: 6,
    mapY: 7,
    sectorBiomeName: 'Караванный Перекрёсток Нила',
    buildingCategory: 'extraction',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'fishing_gold',
    bonusValue: 7,
    bonusLabel: '+7% к золоту на рыбалке',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'flax_plantation_extraction',
      'Этап 1 (Добыча, Объект №15): Волокно Льна (5 ед./ч)',
      45,
      30,
      'extraction',
      'sector_weaving_mill',
      'Волокно Льна',
      30,
      {
        productionTier: 1,
        outputResourceKey: 'flax_fiber',
        outputProductName: 'Волокно Льна',
        outputProductIcon: '🌿',
        outputRatePerHour: 5,
        productSellPriceGold: 65
      }
    )
  },
  {
    id: 'sector_saltpeter_quarry',
    name: 'Селитровый Карьер',
    icon: '👑',
    description: 'Объект №16 (Этап 1 — Добыча): выход — Природная Селитра (4 ед./ч). Себестоимость: 62.5 🪙, продажа: 80 🪙/ед. (Прибыль: +70 🪙/ч).',
    zone: 'port',
    mapX: 6,
    mapY: 6,
    sectorBiomeName: 'Золотые Прииски Дельты',
    buildingCategory: 'extraction',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'combat_dmg',
    bonusValue: 6,
    bonusLabel: '+6% к боевому урону',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'saltpeter_quarry_extraction',
      'Этап 1 (Добыча, Объект №16): Природная Селитра (4 ед./ч)',
      40,
      26,
      'extraction',
      'sector_gunpowder_plant',
      'Природная Селитра',
      26,
      {
        productionTier: 1,
        outputResourceKey: 'natural_saltpeter',
        outputProductName: 'Природная Селитра',
        outputProductIcon: '🧂',
        outputRatePerHour: 4,
        productSellPriceGold: 80
      }
    )
  },

  // ================= ЭТАП 2: ПЕРВИЧНЫЕ ЗАВОДЫ (5 объектов) =================
  {
    id: 'sector_nile_oasis',
    name: 'Рыбный комбинат',
    icon: '👑',
    description: 'Этап 2 (Первичный завод): скупает Сырую рыбу (5 ед./ч по 80 🪙). Выход — «Рыбный паштет» (1 ед./ч по 750 🪙).',
    zone: 'port',
    mapX: 7,
    mapY: 6,
    sectorBiomeName: 'Центральная Гавань Фароса (Торговый Узел)',
    buildingCategory: 'raw_processing',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'fishing_gold',
    bonusValue: 8,
    bonusLabel: '+8% к золоту на рыбалке',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'solar_relic_foundry',
      'Этап 2 (Заводы): Рыбный паштет (1 ед./ч)',
      45,
      16,
      'raw_processing',
      'sector_ra_temple',
      'Рыбный паштет',
      24,
      {
        productionTier: 2,
        input1ResourceKey: 'raw_fish',
        input1ResourceName: 'Сырая рыба',
        input1ResourceIcon: '🐟',
        input1Stock: 45,
        input1RequiredPerCycle: 5,
        rawBuyPriceGold: 80,
        outputResourceKey: 'fish_semifinished',
        outputProductName: 'Рыбный паштет',
        outputProductIcon: '🥫',
        outputRatePerHour: 1,
        productSellPriceGold: 750
      }
    )
  },
  {
    id: 'sector_gold_mines',
    name: 'Плавильный завод',
    icon: '👑',
    description: 'Этап 2 (Первичный завод): скупает Золотой самородок (3 ед./ч по 130 🪙). Выход — «Золотые слитки» (1 ед./ч по 750 🪙).',
    zone: 'port',
    mapX: 8,
    mapY: 6,
    sectorBiomeName: 'Плавильный Док и Железные Рудники',
    buildingCategory: 'raw_processing',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'pyramid_gold',
    bonusValue: 10,
    bonusLabel: '+10% к золоту в Пирамидах',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'gold_smelter_dock',
      'Этап 2 (Заводы): Золотые слитки (1 ед./ч)',
      35,
      14,
      'raw_processing',
      'sector_elite_armory',
      'Золотые слитки',
      20,
      {
        productionTier: 2,
        input1ResourceKey: 'gold_nugget',
        input1ResourceName: 'Золотой самородок',
        input1ResourceIcon: '🪨',
        input1Stock: 36,
        input1RequiredPerCycle: 3,
        rawBuyPriceGold: 130,
        outputResourceKey: 'gold_ingots',
        outputProductName: 'Золотые слитки',
        outputProductIcon: '🪙',
        outputRatePerHour: 1,
        productSellPriceGold: 750
      }
    )
  },
  {
    id: 'sector_luxor_obelisk',
    name: 'Алхимическая лаборатория',
    icon: '👑',
    description: 'Этап 2 (Первичный завод): вход — Кварцевый песок (3 по 80 🪙) + Сырая нефть (2 по 130 🪙). Выход — «Алхимический реагент» (860 🪙).',
    zone: 'port',
    mapX: 7,
    mapY: 7,
    sectorBiomeName: 'Южный Маяк и Песчаный Карьер',
    buildingCategory: 'raw_processing',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'pyramid_exp',
    bonusValue: 10,
    bonusLabel: '+10% к опыту в боях',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'alchemy_beacon',
      'Этап 2 (Заводы): Алхимический реагент (1 ед./ч)',
      40,
      15,
      'raw_processing',
      'sector_field_food_plant',
      'Алхимический реагент',
      22,
      {
        productionTier: 2,
        input1ResourceKey: 'quartz_sand',
        input1ResourceName: 'Кварцевый песок',
        input1ResourceIcon: '⏳',
        input1Stock: 36,
        input1RequiredPerCycle: 3,
        rawBuyPriceGold: 80,
        input2ResourceKey: 'crude_oil',
        input2ResourceName: 'Сырая нефть',
        input2ResourceIcon: '🛢️',
        input2Stock: 24,
        input2RequiredPerCycle: 2,
        input2BuyPriceGold: 130,
        outputResourceKey: 'alchemy_reagents',
        outputProductName: 'Алхимический реагент',
        outputProductIcon: '🧪',
        outputRatePerHour: 1,
        productSellPriceGold: 860
      }
    )
  },
  {
    id: 'sector_weaving_mill',
    name: 'Ткацкая Мануфактура',
    icon: '👑',
    description: 'Объект №17 (Этап 2 — Первичная переработка): вход — Волокно Льна (5 по 80 🪙) + Мощность (1 кВт по 70 🪙) + Рабочий (250 🪙). Выход — «Броневая Ткань» (830 🪙).',
    zone: 'port',
    mapX: 6,
    mapY: 7,
    sectorBiomeName: 'Караванный Перекрёсток Нила',
    buildingCategory: 'raw_processing',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'max_hp',
    bonusValue: 8,
    bonusLabel: '+8% к макс. здоровью',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'weaving_mill_factory',
      'Этап 2 (Объект №17): Броневая Ткань (1 ед./ч)',
      40,
      16,
      'raw_processing',
      'sector_special_armor_factory',
      'Броневая Ткань',
      20,
      {
        productionTier: 2,
        input1ResourceKey: 'flax_fiber',
        input1ResourceName: 'Волокно Льна',
        input1ResourceIcon: '🌿',
        input1Stock: 40,
        input1RequiredPerCycle: 5,
        rawBuyPriceGold: 80,
        outputResourceKey: 'armor_fabric',
        outputProductName: 'Броневая Ткань',
        outputProductIcon: '🧶',
        outputRatePerHour: 1,
        productSellPriceGold: 830
      }
    )
  },
  {
    id: 'sector_gunpowder_plant',
    name: 'Пороховой Завод',
    icon: '👑',
    description: 'Объект №18 (Этап 2 — Первичная переработка): вход — Природная Селитра (4 по 95 🪙) + Сырая нефть (1 по 130 🪙) + Мощность (1 кВт по 70 🪙) + Рабочий (250 🪙). Выход — «Оружейный Порох» (950 🪙).',
    zone: 'port',
    mapX: 5,
    mapY: 6,
    sectorBiomeName: 'Храмовая Площадь Солнца',
    buildingCategory: 'raw_processing',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'combat_dmg',
    bonusValue: 8,
    bonusLabel: '+8% к боевому урону',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'gunpowder_plant_factory',
      'Этап 2 (Объект №18): Оружейный Порох (1 ед./ч)',
      40,
      15,
      'raw_processing',
      'sector_siege_ammo_plant',
      'Оружейный Порох',
      20,
      {
        productionTier: 2,
        input1ResourceKey: 'natural_saltpeter',
        input1ResourceName: 'Природная Селитра',
        input1ResourceIcon: '🧂',
        input1Stock: 36,
        input1RequiredPerCycle: 4,
        rawBuyPriceGold: 95,
        input2ResourceKey: 'crude_oil',
        input2ResourceName: 'Сырая нефть',
        input2ResourceIcon: '🛢️',
        input2Stock: 24,
        input2RequiredPerCycle: 1,
        input2BuyPriceGold: 130,
        outputResourceKey: 'gunpowder',
        outputProductName: 'Оружейный Порох',
        outputProductIcon: '🧨',
        outputRatePerHour: 1,
        productSellPriceGold: 950
      }
    )
  },

  // ================= ЭТАП 3: ВЫСОКОТЕХНОЛОГИЧНЫЕ И ВОЕННО-ИНЖЕНЕРНЫЕ ЗАВОДЫ (6 объектов) =================
  {
    id: 'sector_steel_modules',
    name: 'Сталелитейный цех',
    icon: '👑',
    description:
      'Этап 3 (Мануфактура): вход — Железная руда (4 по 95 🪙) + Алхимический реагент (1 по 920 🪙). Выход — «Закаленная сталь» (1 750 🪙).',
    zone: 'port',
    mapX: 6,
    mapY: 5,
    sectorBiomeName: 'Сталелитейный Квартал',
    buildingCategory: 'dual_manufactory',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'max_hp',
    bonusValue: 10,
    bonusLabel: '+10% к макс. здоровью',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'steel_foundry',
      'Этап 3 (Мануфактура): Закаленная сталь (1 ед./ч)',
      38,
      10,
      'dual_advanced',
      'sector_elite_armory',
      'Железная руда + Алхимический реагент',
      18,
      {
        productionTier: 3,
        input1ResourceKey: 'iron_ore',
        input1ResourceName: 'Железная руда',
        input1ResourceIcon: '⛏️',
        input1Stock: 28,
        input1RequiredPerCycle: 4,
        rawBuyPriceGold: 95,
        input2ResourceKey: 'alchemy_reagents',
        input2ResourceName: 'Алхимический реагент',
        input2ResourceIcon: '🧪',
        input2Stock: 16,
        input2RequiredPerCycle: 1,
        input2BuyPriceGold: 920,
        outputResourceKey: 'hardened_steel',
        outputProductName: 'Закаленная сталь',
        outputProductIcon: '🔩',
        outputRatePerHour: 1,
        productSellPriceGold: 1750
      }
    )
  },
  {
    id: 'sector_field_food_plant',
    name: 'Полевой Продкомбинат',
    icon: '👑',
    description:
      'Этап 3 (Мануфактура): вход — Рыбный паштет (2 по 820 🪙) + Алхимический реагент (1 по 920 🪙). Выход — «Боевой стимулятор» (3 100 🪙).',
    zone: 'port',
    mapX: 7,
    mapY: 5,
    sectorBiomeName: 'Военный Бастион и Полевой Продкомбинат',
    buildingCategory: 'dual_manufactory',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'max_hp',
    bonusValue: 8,
    bonusLabel: '+8% к макс. здоровью',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'field_food_plant',
      'Этап 3 (Мануфактура): Боевой стимулятор (1 ед./ч)',
      35,
      11,
      'dual_advanced',
      null,
      'Рыбный паштет + Алхимический реагент',
      18,
      {
        productionTier: 3,
        input1ResourceKey: 'fish_semifinished',
        input1ResourceName: 'Рыбный паштет',
        input1ResourceIcon: '🥫',
        input1Stock: 24,
        input1RequiredPerCycle: 2,
        rawBuyPriceGold: 820,
        input2ResourceKey: 'alchemy_reagents',
        input2ResourceName: 'Алхимический реагент',
        input2ResourceIcon: '🧪',
        input2Stock: 18,
        input2RequiredPerCycle: 1,
        input2BuyPriceGold: 920,
        outputResourceKey: 'combat_ration',
        outputProductName: 'Боевой стимулятор',
        outputProductIcon: '💉',
        outputRatePerHour: 1,
        productSellPriceGold: 3100
      }
    )
  },
  {
    id: 'sector_elite_armory',
    name: 'Оружейная Мануфактура',
    icon: '👑',
    description:
      'Этап 3 (Мануфактура): вход — Закаленная сталь (1 по 1 850 🪙) + Золотые слитки (1 по 830 🪙). Выход — «Боевые модули» (3 250 🪙).',
    zone: 'port',
    mapX: 8,
    mapY: 5,
    sectorBiomeName: 'Оружейный Бастион Александрии',
    buildingCategory: 'dual_manufactory',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'combat_dmg',
    bonusValue: 10,
    bonusLabel: '+10% к боевому урону',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'elite_weapon_manufactory',
      'Этап 3 (Мануфактура): Боевые модули (1 ед./ч)',
      40,
      9,
      'dual_advanced',
      'sector_steel_modules',
      'Закаленная сталь + Золотые слитки',
      20,
      {
        productionTier: 3,
        input1ResourceKey: 'hardened_steel',
        input1ResourceName: 'Закаленная сталь',
        input1ResourceIcon: '🔩',
        input1Stock: 14,
        input1RequiredPerCycle: 1,
        rawBuyPriceGold: 1850,
        input2ResourceKey: 'gold_ingots',
        input2ResourceName: 'Золотые слитки',
        input2ResourceIcon: '🪙',
        input2Stock: 20,
        input2RequiredPerCycle: 1,
        input2BuyPriceGold: 830,
        outputResourceKey: 'combat_modules',
        outputProductName: 'Боевые модули',
        outputProductIcon: '⚙️',
        outputRatePerHour: 1,
        productSellPriceGold: 3250
      }
    )
  },
  {
    id: 'sector_ra_temple',
    name: 'Мастерская Реликвий',
    icon: '👑',
    description:
      'Этап 3 (Мануфактура): вход — Золотые слитки (2 по 830 🪙) + Рыбный паштет (2 по 820 🪙) + Алхимический реагент (1 по 920 🪙). Выход — «Древняя Реликвия» (5 000 🪙).',
    zone: 'port',
    mapX: 7,
    mapY: 6,
    sectorBiomeName: 'Центральная Гавань Фароса (Торговый Узел)',
    buildingCategory: 'dual_manufactory',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'slots_luck',
    bonusValue: 10,
    bonusLabel: '+10% к удаче в слотах',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'solar_relic_foundry',
      'Этап 3 (Мануфактура): Древняя Реликвия (1 ед./ч)',
      40,
      10,
      'dual_advanced',
      'sector_nile_oasis',
      'Золотые слитки + Рыбный паштет + Алхимический реагент',
      18,
      {
        productionTier: 3,
        input1ResourceKey: 'gold_ingots',
        input1ResourceName: 'Золотые слитки',
        input1ResourceIcon: '🪙',
        input1Stock: 20,
        input1RequiredPerCycle: 2,
        rawBuyPriceGold: 830,
        input2ResourceKey: 'fish_semifinished',
        input2ResourceName: 'Рыбный паштет',
        input2ResourceIcon: '🥫',
        input2Stock: 20,
        input2RequiredPerCycle: 2,
        input2BuyPriceGold: 820,
        input3ResourceKey: 'alchemy_reagents',
        input3ResourceName: 'Алхимический реагент',
        input3ResourceIcon: '🧪',
        input3Stock: 16,
        input3RequiredPerCycle: 1,
        input3BuyPriceGold: 920,
        outputResourceKey: 'port_relics',
        outputProductName: 'Древняя Реликвия',
        outputProductIcon: '🏺',
        outputRatePerHour: 1,
        productSellPriceGold: 5000
      }
    )
  },
  {
    id: 'sector_special_armor_factory',
    name: 'Фабрика Спецзащиты',
    icon: '👑',
    description:
      'Объект №19 (Этап 3 — Военно-инженерный завод): вход — Броневая Ткань (2 по 900 🪙) + Закаленная сталь (1 по 1 850 🪙) + Мощность (2 кВт по 70 🪙) + Рабочий (250 🪙). Выход — «Титановая Бронепластина» (4 500 🪙).',
    zone: 'port',
    mapX: 6,
    mapY: 5,
    sectorBiomeName: 'Сталелитейный Квартал',
    buildingCategory: 'dual_manufactory',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'max_hp',
    bonusValue: 12,
    bonusLabel: '+12% к макс. здоровью',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'special_armor_factory',
      'Этап 3 (Объект №19): Титановая Бронепластина (1 ед./ч)',
      35,
      10,
      'dual_advanced',
      'sector_weaving_mill',
      'Броневая Ткань + Закаленная сталь',
      18,
      {
        productionTier: 3,
        input1ResourceKey: 'armor_fabric',
        input1ResourceName: 'Броневая Ткань',
        input1ResourceIcon: '🧶',
        input1Stock: 24,
        input1RequiredPerCycle: 2,
        rawBuyPriceGold: 900,
        input2ResourceKey: 'hardened_steel',
        input2ResourceName: 'Закаленная сталь',
        input2ResourceIcon: '🔩',
        input2Stock: 18,
        input2RequiredPerCycle: 1,
        input2BuyPriceGold: 1850,
        outputResourceKey: 'titanium_plate',
        outputProductName: 'Титановая Бронепластина',
        outputProductIcon: '🛡️',
        outputRatePerHour: 1,
        productSellPriceGold: 4500
      }
    )
  },
  {
    id: 'sector_siege_ammo_plant',
    name: 'Цех Осадных Боеприпасов',
    icon: '👑',
    description:
      'Объект №20 (Этап 3 — Военно-инженерный завод): вход — Оружейный Порох (2 по 1 020 🪙) + Боевые модули (1 по 3 350 🪙) + Мощность (2 кВт по 70 🪙) + Рабочий (250 🪙). Выход — «Штурмовой Заряд» (6 400 🪙).',
    zone: 'port',
    mapX: 8,
    mapY: 5,
    sectorBiomeName: 'Оружейный Бастион Александрии',
    buildingCategory: 'dual_manufactory',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'combat_dmg',
    bonusValue: 12,
    bonusLabel: '+12% к боевому урону',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'siege_ammo_plant',
      'Этап 3 (Объект №20): Штурмовой Заряд (1 ед./ч)',
      35,
      8,
      'dual_advanced',
      'sector_gunpowder_plant',
      'Оружейный Порох + Боевые модули',
      16,
      {
        productionTier: 3,
        input1ResourceKey: 'gunpowder',
        input1ResourceName: 'Оружейный Порох',
        input1ResourceIcon: '🧨',
        input1Stock: 24,
        input1RequiredPerCycle: 2,
        rawBuyPriceGold: 1020,
        input2ResourceKey: 'combat_modules',
        input2ResourceName: 'Боевые модули',
        input2ResourceIcon: '⚙️',
        input2Stock: 16,
        input2RequiredPerCycle: 1,
        input2BuyPriceGold: 3350,
        outputResourceKey: 'assault_charge',
        outputProductName: 'Штурмовой Заряд',
        outputProductIcon: '💣',
        outputRatePerHour: 1,
        productSellPriceGold: 6400
      }
    )
  },

  // ================= ОБЪЕКТ №13: ЭЛЕКТРОСТАНЦИЯ И ОБЪЕКТ №14: ПОРТОВАЯ ТАВЕРНА =================
  {
    id: 'sector_power_plant',
    name: 'Электростанция',
    icon: '👑',
    description:
      'Объект №13 (Энергосеть): потребляет Сырую нефть (2 ед./ч по 130 🪙) + 1 рабочий час (250 🪙) → вырабатывает 10 ед. Мощности (кВт)/ч (себестоимость 51 🪙, продажа 70 🪙/ед.).',
    zone: 'port',
    mapX: 5,
    mapY: 5,
    sectorBiomeName: 'Нефтяной Оазис Фараонов',
    buildingCategory: 'power_plant',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'pyramid_exp',
    bonusValue: 8,
    bonusLabel: '+8% к опыту в боях',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'power_plant_grid',
      'Энергосеть (Объект №13): Мощность (10 кВт/ч)',
      40,
      80,
      'raw_processing',
      'sector_oil_rig_oasis',
      'Мощность (кВт)',
      80,
      {
        productionTier: 2,
        input1ResourceKey: 'crude_oil',
        input1ResourceName: 'Сырая нефть',
        input1ResourceIcon: '🛢️',
        input1Stock: 36,
        input1RequiredPerCycle: 2,
        rawBuyPriceGold: 130,
        outputResourceKey: 'power_kw',
        outputProductName: 'Мощность (кВт)',
        outputProductIcon: '⚡',
        outputRatePerHour: 10,
        productSellPriceGold: 70,
        powerRequiredPerCycle: 0
      }
    )
  },
  {
    id: 'sector_port_tavern',
    name: 'Портовая Таверна «Золотой Якорь»',
    icon: '👑',
    description:
      'Объект №14 (Бар / Таверна): закупает Рыбный паштет (по 820 🪙) и продает готовые блюда/напитки посетителям (1 порция = 300 🪙, мгновенно восстанавливает +25% бодрости).',
    zone: 'port',
    mapX: 7,
    mapY: 6,
    sectorBiomeName: 'Центральная Гавань Фароса (Торговый Узел)',
    buildingCategory: 'tavern',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'max_hp',
    bonusValue: 6,
    bonusLabel: '+6% к макс. здоровью',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'port_tavern_bar',
      'Бар / Таверна (Объект №14): Восстановление бодрости (+25%)',
      30,
      40,
      'raw_processing',
      'sector_nile_oasis',
      'Обед Таверны (+25% Бодрости)',
      40,
      {
        productionTier: 2,
        input1ResourceKey: 'fish_semifinished',
        input1ResourceName: 'Рыбный паштет',
        input1ResourceIcon: '🥫',
        input1Stock: 20,
        input1RequiredPerCycle: 1,
        rawBuyPriceGold: 820,
        outputResourceKey: 'tavern_meal',
        outputProductName: 'Обед Таверны (+25% Бодрости)',
        outputProductIcon: '🍺',
        outputRatePerHour: 4,
        productSellPriceGold: 300,
        powerRequiredPerCycle: 0
      }
    )
  },
  // ================= НОВЫЕ ОБЪЕКТЫ №21 И №22 (СЕКТОРА [2/8] И [9/3], ВЛАДЕЛЕЦ REDBLACK) =================
  {
    id: 'sector_cotton_plantation',
    name: 'Плантация Хлопка и Красителей',
    icon: '👑',
    description:
      'Сектор [2/8] (Этап 1 — Добыча): производит ресурс «Сырое Волокно» (вес 1 ед., 5 ед./ч). Себестоимость: 55 🪙, продажа завода: 70 🪙/ед.',
    zone: 'port',
    mapX: 2,
    mapY: 8,
    sectorBiomeName: 'Плантация Хлопка и Красителей Дельты',
    buildingCategory: 'extraction',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'fishing_gold',
    bonusValue: 8,
    bonusLabel: '+8% к золоту на рыбалке',
    warStatus: 'peace',
    warScores: {},
    production: {
      ...createDefaultPortProduction(
        'cotton_plantation_extraction',
        'Этап 1 (Добыча): Сырое Волокно (5 ед./ч, с/с 55 🪙)',
        50,
        30,
        'extraction',
        'sector_weaving_mill',
        'Сырое Волокно',
        30,
        {
          productionTier: 1,
          outputResourceKey: 'raw_cotton_fiber',
          outputProductName: 'Сырое Волокно',
          outputProductIcon: '🧵',
          outputRatePerHour: 5,
          productSellPriceGold: 70
        }
      ),
      workerWageGold: 275
    }
  },
  {
    id: 'sector_pharaoh_jewelry',
    name: 'Ювелирная Мастерская Фараона',
    icon: '👑',
    description:
      'Сектор [9/3] (Этап 3 — Мануфактура): вход — Золотой слиток (1 ед.) + Кварцевый песок (1 ед.) + 1 кВт энергии + Рабочий. Выход — «Церемониальный Амулет» (вес 5 ед.). Себестоимость: 2 100 🪙, продажа завода: 2 400 🪙.',
    zone: 'port',
    mapX: 9,
    mapY: 3,
    sectorBiomeName: 'Ювелирный Квартал Фараона',
    buildingCategory: 'dual_manufactory',
    ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
    ownerClanId: null,
    ownerClanName: 'Тест',
    ownerClanTag: 'ТЕСТ',
    ownerClanEmblem: '👑',
    bonusType: 'pyramid_gold',
    bonusValue: 12,
    bonusLabel: '+12% к золоту в Пирамидах',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      'pharaoh_jewelry_workshop',
      'Этап 3 (Мануфактура): Церемониальный Амулет (1 ед./ч)',
      35,
      12,
      'dual_advanced',
      'sector_gold_smelter',
      'Золотые слитки + Кварцевый песок',
      18,
      {
        productionTier: 3,
        input1ResourceKey: 'gold_ingots',
        input1ResourceName: 'Золотые слитки',
        input1ResourceIcon: '🪙',
        input1Stock: 20,
        input1RequiredPerCycle: 1,
        rawBuyPriceGold: 1650,
        input2ResourceKey: 'quartz_sand',
        input2ResourceName: 'Кварцевый песок',
        input2ResourceIcon: '⏳',
        input2Stock: 25,
        input2RequiredPerCycle: 1,
        input2BuyPriceGold: 130,
        outputResourceKey: 'ceremonial_amulet',
        outputProductName: 'Церемониальный Амулет',
        outputProductIcon: '📿',
        outputRatePerHour: 1,
        productSellPriceGold: 2400,
        powerRequiredPerCycle: 1,
        powerBuyPriceGold: 70
      }
    )
  }
];

function getRecommendedRoleForSlotIndex(slotIdx: number): TerritoryFighterRole {
  if (slotIdx < 3) return 'tank'; // 3 бойца на передовую / танки
  if (slotIdx < 6) return 'dps'; // 3 стрелка / дамагера
  return 'support'; // 1 поддержка
}

function getDefaultTacticForRole(role: TerritoryFighterRole): TerritoryTacticalAction {
  if (role === 'tank') return 'defense';
  if (role === 'dps') return 'focus';
  return 'frontal';
}

export function build7x7FighterFromHero(
  nick: string,
  side: 'attacker' | 'defender',
  clan: Clan | { id: string; name: string; tag: string; emblem: string },
  role: TerritoryFighterRole = 'tank',
  tactic: TerritoryTacticalAction = 'frontal',
  hero?: HeroState,
  equipped?: EquippedGear,
  fallbackLvl = 10,
  slotIndex = 0
): ClanTerritory7x7Fighter {
  let maxHp = 2400 + fallbackLvl * 180;
  let dmg = 260 + fallbackLvl * 28;
  let dodgePct = 14;
  let powerScore = 3500 + fallbackLvl * 320;
  let hasClanGear = false;
  let hasClanTransport = false;
  let avatar = side === 'attacker' ? '⚔️' : '🛡️';
  let lvl = fallbackLvl;

  if (hero) {
    const calc = calculateFighterPowerFromGear(hero, equipped);
    maxHp = Math.max(1500, calc.maxHp);
    dmg = Math.max(180, calc.dmg);
    dodgePct = calc.dodgePct;
    powerScore = calc.powerScore;
    hasClanGear = calc.hasClanGear;
    hasClanTransport = calc.hasClanTransport;
    avatar = hero.avatar || '🧙‍♂️';
    lvl = hero.level || fallbackLvl;
  }

  // Бонусы Погона (Звания) и Знака клана + Форпоста Базы клана
  const rankInfo = getPlayerClanRankAndPts(nick, hero);
  const fullClan = inMemoryClans.find((c) => c.id === clan.id);
  const baseCatalog = getClanBaseBuildingsCatalog(fullClan);
  const outpostArmorPct = side === 'defender' ? baseCatalog.outpostDefenseBonusPct : 0;

  if (rankInfo.badgeEquipped) {
    maxHp = Math.round(maxHp * (1 + (rankInfo.activeBonuses.hpBonusPct + outpostArmorPct) / 100));
    dmg = Math.round(dmg * (1 + rankInfo.activeBonuses.dmgBonusPct / 100));
    dodgePct = Math.min(72, dodgePct + Math.floor(rankInfo.activeBonuses.armorBonusPct * 0.4));
    powerScore += rankInfo.rankLevel * 320;
  }

  // Бонусы выбранной линии/роли
  if (role === 'tank') {
    maxHp = Math.round(maxHp * 1.25);
    dodgePct = Math.min(65, dodgePct + 5);
  } else if (role === 'dps') {
    dmg = Math.round(dmg * 1.2);
  } else if (role === 'support') {
    maxHp = Math.round(maxHp * 1.1);
    dmg = Math.round(dmg * 1.05);
  }

  return {
    nick,
    avatar,
    lvl,
    clanId: clan.id,
    clanName: clan.name,
    clanTag: clan.tag,
    clanEmblem: clan.emblem,
    rankLevel: rankInfo.rankLevel,
    clanPts: rankInfo.pts,
    side,
    role,
    tactic,
    hp: maxHp,
    maxHp,
    dmg,
    dodgePct,
    powerScore,
    hasClanGear,
    hasClanTransport,
    alive: true,
    isBot: false,
    joinedAt: Date.now(),
    slotIndex,
    actedInRound: 0,
    shieldActiveInRound: 0
  };
}

function normalize7x7RealPlayersRoster(sector: ClanTerritorySector): void {
  const b = sector.battle7x7;
  if (!b) return;
  // Убираем любых ботов из старых сессий — в бою 7х7 участвуют ТОЛЬКО реальные игроки!
  b.attackers = (b.attackers || [])
    .filter((f) => !f.isBot)
    .slice(0, 7)
    .map((f, idx) => ({ ...f, isBot: false, slotIndex: typeof f.slotIndex === 'number' ? f.slotIndex : idx }));
  b.defenders = (b.defenders || [])
    .filter((f) => !f.isBot)
    .slice(0, 7)
    .map((f, idx) => ({ ...f, isBot: false, slotIndex: typeof f.slotIndex === 'number' ? f.slotIndex : idx }));
  if (!Array.isArray(b.waitingQueueAttackers)) b.waitingQueueAttackers = [];
  if (!Array.isArray(b.waitingQueueDefenders)) b.waitingQueueDefenders = [];
}

function transitionSectorToCombatPhase(sector: ClanTerritorySector, now: number): void {
  if (!sector.battle7x7) return;
  normalize7x7RealPlayersRoster(sector);
  const b = sector.battle7x7;

  // Если к моменту старта боя у защиты 0 реальных игроков (никто из защитников не явился за 10 минут),
  // атакующие автоматически забирают сектор без ботов. Если же есть реальные защитники — открывается поле боя 7х7 на клетках!
  if (b.attackers.length > 0 && b.defenders.length === 0) {
    b.roundLogs.push({
      roundNumber: 1,
      timestamp: now,
      events: [
        `🚩 Время сбора (10 мин) истекло! На защиту сектора «${sector.name}» не вышел ни один игрок противника — команда атаки (${b.attackers.length}/7) занимает сектор без сопротивления!`
      ],
      attackersAlive: b.attackers.filter((f) => f.alive && f.hp > 0).length,
      defendersAlive: 0
    });
    finalizeTerritory7x7Battle(sector, now);
    return;
  }

  if (b.attackers.length === 0) {
    finalizeTerritory7x7Battle(sector, now);
    return;
  }

  b.phase = 'combat';
  b.currentRound = 1;
  b.maxRounds = Math.max(b.maxRounds || 12, 12);
  b.roundStartedAt = now;
  b.roundEndsAt = now + TERRITORY_COMBAT_ROUND_DURATION_MS;
  sector.warEndsAt = now + b.maxRounds * TERRITORY_COMBAT_ROUND_DURATION_MS;
}

function executeSingleCellAttack(
  sector: ClanTerritorySector,
  actor: ClanTerritory7x7Fighter,
  target: ClanTerritory7x7Fighter,
  actionKind: 'strike' | 'skill_power' | 'skill_shield' | 'skill_heal' = 'strike',
  isAutoTimeout = false
): string {
  const b = sector.battle7x7!;
  const roundNum = Math.max(1, b.currentRound || 1);

  const atkWarPts = (sector.attackerClanId && sector.warScores?.[sector.attackerClanId]?.points) || 100;
  const defWarPts = (sector.ownerClanId && sector.warScores?.[sector.ownerClanId]?.points) || 50;
  const teamInfluenceMult =
    actor.side === 'attacker'
      ? 1 + Math.min(0.2, Math.floor(atkWarPts / 100) * 0.03)
      : 1 + Math.min(0.2, Math.floor(defWarPts / 100) * 0.03);

  const allies = actor.side === 'attacker' ? b.attackers : b.defenders;
  const hasSupportAura = allies.some((f) => f.alive && f.hp > 0 && f.role === 'support');

  const actorCellNum = (actor.slotIndex ?? 0) + 1;
  const targetCellNum = (target.slotIndex ?? 0) + 1;

  if (actionKind === 'skill_heal') {
    const healAmt = Math.round(actor.maxHp * 0.22);
    actor.hp = Math.min(actor.maxHp, actor.hp + healAmt);
  }
  if (actionKind === 'skill_shield') {
    actor.shieldActiveInRound = roundNum;
  }

  // Проверка уворота цели
  const targetHasShield = target.tactic === 'defense' || target.shieldActiveInRound === roundNum;
  const targetDodgeChance = Math.min(
    70,
    target.dodgePct + (targetHasShield ? 18 : 0) - (actor.tactic === 'focus' || actionKind === 'skill_power' ? 12 : 0)
  );

  if (Math.random() * 100 < targetDodgeChance) {
    return `${isAutoTimeout ? '⏱ [Авто-ход 20с] ' : ''}💨 Клетка #${targetCellNum} (${target.nick}) уклоняется от удара клетки #${actorCellNum} (${actor.nick})!`;
  }

  let mult = teamInfluenceMult * (hasSupportAura ? 1.08 : 1.0);
  if (actor.tactic === 'frontal') mult *= 1.2;
  if (actor.tactic === 'focus') mult *= 1.12;
  if (actor.tactic === 'defense') mult *= 0.85;

  if (actionKind === 'skill_power') mult *= 1.38;
  if (actionKind === 'skill_shield') mult *= 0.9;
  if (actionKind === 'skill_heal') mult *= 0.85;

  if (actor.hasClanGear) mult *= 1.12;
  if (actor.hasClanTransport) mult *= 1.08;

  // Эффект «Штурмового Заряда» (Цех Осадных Боеприпасов):
  // Атакующая команда получает +25% к урону в 1-м раунде и пробивает 50% защиты Форпоста врага!
  if (b.assaultChargeActive && actor.side === 'attacker') {
    if (roundNum === 1) {
      mult *= 1.25;
    }
    mult *= 1.1; // Компенсация отключенной половины защиты вражеского Форпоста
  }

  const isCrit = Math.random() < (actor.role === 'dps' || actionKind === 'skill_power' ? 0.35 : 0.18);
  if (isCrit) mult *= 1.5;

  let rawDmg = Math.round(actor.dmg * (0.9 + Math.random() * 0.22) * mult);
  if (targetHasShield) {
    rawDmg = Math.max(40, Math.round(rawDmg * 0.5));
  }

  target.hp = Math.max(0, target.hp - rawDmg);

  const skillLabel =
    actionKind === 'skill_power'
      ? '💥 Мощный пробив'
      : actionKind === 'skill_shield'
      ? '🛡 Удар со щитом'
      : actionKind === 'skill_heal'
      ? '✨ Перевязка + Удар'
      : '⚔️ Удар';

  const chargeBadge = b.assaultChargeActive && actor.side === 'attacker' && roundNum === 1 ? ' [💣 +25% Штурм-заряд]' : '';

  if (target.hp <= 0) {
    target.alive = false;
    return `${isAutoTimeout ? '⏱ [Авто-ход 20с] ' : ''}💀 [${skillLabel}]${chargeBadge} Клетка #${actorCellNum} (${actor.nick}) ${
      isCrit ? '🔥 КРИТОМ ' : ''
    }наносит ${rawDmg} урона по Клетке #${targetCellNum} (${target.nick}) и ВЫБИВАЕТ противника с поля!`;
  }

  return `${isAutoTimeout ? '⏱ [Авто-ход 20с] ' : ''}${actor.side === 'attacker' ? '⚔️' : '🛡️'} [${skillLabel}]${chargeBadge} Клетка #${actorCellNum} (${
    actor.nick
  }) ${isCrit ? '🔥 КРИТ ' : ''}бьёт Клетку #${targetCellNum} (${target.nick}) на ${rawDmg} урона${
    targetHasShield ? ' (-50% 🛡 Защита)' : ''
  } (HP: ${target.hp}/${target.maxHp})`;
}

export function performTerritory7x7CellStrike(
  sectorId: string,
  actorNick: string,
  targetNick?: string,
  actionKind: 'strike' | 'skill_power' | 'skill_shield' | 'skill_heal' = 'strike'
): { ok: boolean; sector?: ClanTerritorySector; message?: string; error?: string } {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector || sector.warStatus !== 'war' || !sector.battle7x7) {
    return { ok: false, error: 'В этом секторе сейчас нет активного боя 7х7.' };
  }

  const b = sector.battle7x7;
  if (b.phase !== 'combat') {
    return { ok: false, error: 'Тактический бой на клетках ещё не начался (идёт сбор команд).' };
  }

  const now = Date.now();
  const roundNum = Math.max(1, b.currentRound || 1);

  const actor =
    b.attackers.find((f) => f.nick.toLowerCase() === actorNick.toLowerCase()) ||
    b.defenders.find((f) => f.nick.toLowerCase() === actorNick.toLowerCase());

  if (!actor) {
    return { ok: false, error: 'Вы не находитесь на клетках поля боя 7х7 в этом сражении!' };
  }
  if (!actor.alive || actor.hp <= 0) {
    return { ok: false, error: 'Ваш персонаж уже выведен из строя в этом бою!' };
  }
  if (actor.actedInRound === roundNum) {
    return { ok: false, error: `Вы уже сделали ход в Раунде ${roundNum}! Дождитесь окончания 20-секундного таймера или хода соперников.` };
  }

  const enemies = actor.side === 'attacker' ? b.defenders : b.attackers;
  const aliveEnemies = enemies.filter((e) => e.alive && e.hp > 0);
  if (aliveEnemies.length === 0) {
    finalizeTerritory7x7Battle(sector, now);
    saveClansToSupabase();
    return {
      ok: true,
      sector,
      message: sector.lastBattleReport?.summaryText || '🏆 Все противники на поле уничтожены! Победа!'
    };
  }

  // Ищем выбранную клетку противника или клетку напротив
  let target = targetNick
    ? aliveEnemies.find((e) => e.nick.toLowerCase() === targetNick.toLowerCase())
    : undefined;
  if (!target) {
    target =
      aliveEnemies.find((e) => e.slotIndex === actor.slotIndex) ||
      aliveEnemies[0];
  }

  const logLine = executeSingleCellAttack(sector, actor, target, actionKind, false);
  actor.actedInRound = roundNum;

  // Записываем событие в лог текущего раунда
  let currentLog = b.roundLogs.find((l) => l.roundNumber === roundNum);
  const atkAliveCount = b.attackers.filter((f) => f.alive && f.hp > 0).length;
  const defAliveCount = b.defenders.filter((f) => f.alive && f.hp > 0).length;

  if (!currentLog) {
    currentLog = {
      roundNumber: roundNum,
      timestamp: now,
      events: [logLine],
      attackersAlive: atkAliveCount,
      defendersAlive: defAliveCount
    };
    b.roundLogs.push(currentLog);
  } else {
    currentLog.events.push(logLine);
    currentLog.attackersAlive = atkAliveCount;
    currentLog.defendersAlive = defAliveCount;
  }

  // Проверяем, уничтожены ли все живые игроки противника
  if (atkAliveCount === 0 || defAliveCount === 0) {
    finalizeTerritory7x7Battle(sector, now);
    saveClansToSupabase();
    return {
      ok: true,
      sector,
      message: `${logLine} — 🏆 Все противники уничтожены! Бой завершён!`
    };
  }

  // Если все живые бойцы обеих команд уже походили в этом 20-секундном окне — сразу переключаем ход!
  const allLiving = [...b.attackers, ...b.defenders].filter((f) => f.alive && f.hp > 0);
  const allActed = allLiving.every((f) => f.actedInRound === roundNum);
  if (allActed) {
    if (roundNum >= (b.maxRounds || 12)) {
      finalizeTerritory7x7Battle(sector, now);
    } else {
      b.currentRound = roundNum + 1;
      b.roundStartedAt = now;
      b.roundEndsAt = now + TERRITORY_COMBAT_ROUND_DURATION_MS;
    }
  }

  saveClansToSupabase();
  return {
    ok: true,
    sector,
    message: logLine
  };
}

function simulateSingle7x7Round(sector: ClanTerritorySector, now: number): void {
  const b = sector.battle7x7;
  if (!b || b.phase !== 'combat') return;

  normalize7x7RealPlayersRoster(sector);
  const roundNum = Math.max(1, b.currentRound || 1);

  let currentLog = b.roundLogs.find((l) => l.roundNumber === roundNum);
  if (!currentLog) {
    currentLog = {
      roundNumber: roundNum,
      timestamp: now,
      events: [],
      attackersAlive: b.attackers.filter((f) => f.alive && f.hp > 0).length,
      defendersAlive: b.defenders.filter((f) => f.alive && f.hp > 0).length
    };
    b.roundLogs.push(currentLog);
  }

  const livingAttackers = () => b.attackers.filter((f) => f.alive && f.hp > 0);
  const livingDefenders = () => b.defenders.filter((f) => f.alive && f.hp > 0);

  // По истечении 20 секунд все живые игроки, которые не успели сделать ручной ход, делают авто-атаку по клетке напротив
  const maxLen = Math.max(b.attackers.length, b.defenders.length);
  for (let i = 0; i < maxLen; i++) {
    const atk = b.attackers[i];
    if (atk && atk.alive && atk.hp > 0 && atk.actedInRound !== roundNum) {
      const aliveDefs = livingDefenders();
      if (aliveDefs.length > 0) {
        const oppositeTarget =
          aliveDefs.find((d) => d.slotIndex === atk.slotIndex) ||
          aliveDefs[0];
        const line = executeSingleCellAttack(sector, atk, oppositeTarget, 'strike', true);
        currentLog.events.push(line);
        atk.actedInRound = roundNum;
      }
    }

    const def = b.defenders[i];
    if (def && def.alive && def.hp > 0 && def.actedInRound !== roundNum) {
      const aliveAtks = livingAttackers();
      if (aliveAtks.length > 0) {
        const oppositeTarget =
          aliveAtks.find((a) => a.slotIndex === def.slotIndex) ||
          aliveAtks[0];
        const line = executeSingleCellAttack(sector, def, oppositeTarget, 'strike', true);
        currentLog.events.push(line);
        def.actedInRound = roundNum;
      }
    }
  }

  const atkAliveCount = livingAttackers().length;
  const defAliveCount = livingDefenders().length;
  currentLog.attackersAlive = atkAliveCount;
  currentLog.defendersAlive = defAliveCount;

  // Побеждает та команда, которая полностью уничтожит живых игроков противника на поле (или по лимиту раундов)
  if (atkAliveCount === 0 || defAliveCount === 0 || roundNum >= (b.maxRounds || 12)) {
    finalizeTerritory7x7Battle(sector, now);
  } else {
    b.currentRound = roundNum + 1;
    b.roundStartedAt = now;
    b.roundEndsAt = now + TERRITORY_COMBAT_ROUND_DURATION_MS;
  }
}

function finalizeTerritory7x7Battle(sector: ClanTerritorySector, now: number): void {
  const b = sector.battle7x7;
  if (!b) return;

  const atkAlive = b.attackers.filter((f) => f.alive && f.hp > 0);
  const defAlive = b.defenders.filter((f) => f.alive && f.hp > 0);

  let winnerSide: 'attacker' | 'defender' = 'defender';
  if (atkAlive.length > defAlive.length) {
    winnerSide = 'attacker';
  } else if (defAlive.length > atkAlive.length) {
    winnerSide = 'defender';
  } else {
    const atkTotalHp = atkAlive.reduce((acc, f) => acc + f.hp, 0);
    const defTotalHp = defAlive.reduce((acc, f) => acc + f.hp, 0);
    const atkWarPts = (sector.attackerClanId && sector.warScores?.[sector.attackerClanId]?.points) || 0;
    const defWarPts = (sector.ownerClanId && sector.warScores?.[sector.ownerClanId]?.points) || 0;
    winnerSide = atkTotalHp + atkWarPts * 5 >= defTotalHp + defWarPts * 5 ? 'attacker' : 'defender';
  }

  b.phase = 'finished';
  b.winnerSide = winnerSide;

  // Начисление Личного Кланового Опыта (PTS) участникам боя 7х7:
  // Победа = +150 PTS (+ до +50 PTS за урон). Поражение = +50 PTS (за участие).
  // Если в команде есть Маршал (15 ур.), вся команда получает +20% к PTS!
  // Если бой идет против официального врага (объявлена Война по #ID), бойцы получают +25% больше PTS!
  const isOfficialEnemyWar = areClansAtWar(sector.attackerClanId, sector.ownerClanId);
  const awardTeamPts = (roster: ClanTerritory7x7Fighter[], isWinTeam: boolean) => {
    const hasMarshal = roster.some((f) => (f.rankLevel || 1) >= 15);
    const marshalMult = hasMarshal ? 1.2 : 1.0;
    const warMult = isOfficialEnemyWar ? 1.25 : 1.0;
    const mult = marshalMult * warMult;
    roster.forEach((f) => {
      const dmgBonus = isWinTeam ? Math.min(50, Math.max(10, Math.round((f.dmg || 250) / 18))) : 0;
      const gainedPts = Math.round((isWinTeam ? 150 + dmgBonus : 50) * mult);
      f.clanPts = (f.clanPts || 0) + gainedPts;
      const fClan = inMemoryClans.find((c) => c.id === f.clanId);
      if (fClan) {
        const mem = fClan.members.find((m) => m.nick.trim().toLowerCase() === f.nick.trim().toLowerCase());
        if (mem) {
          mem.clanPts = Math.max(0, Number(mem.clanPts || 0)) + gainedPts;
        }
        ensureMemberInClanAndAwardContribution(fClan, f.nick, gainedPts, isWinTeam ? 40 : 15);
      }
    });
  };
  awardTeamPts(b.attackers, winnerSide === 'attacker');
  awardTeamPts(b.defenders, winnerSide === 'defender');

  if (winnerSide === 'attacker' && sector.attackerClanId) {
    const winClan = inMemoryClans.find((c) => c.id === sector.attackerClanId);
    sector.ownerClanId = sector.attackerClanId;
    sector.ownerClanName = sector.attackerClanName || winClan?.name || 'Атакующий Клан';
    sector.ownerClanTag = sector.attackerClanTag || winClan?.tag || 'CLAN';
    sector.ownerClanEmblem = sector.attackerClanEmblem || winClan?.emblem || '⚔️';
    sector.capturedAt = now;
    sector.protectionUntil = now + TERRITORY_PROTECTION_DURATION_MS; // 2 часа владения и щита!

    b.winnerClanId = sector.ownerClanId;
    b.winnerClanName = sector.ownerClanName;
    b.winnerClanTag = sector.ownerClanTag;
    b.winnerClanEmblem = sector.ownerClanEmblem;
    b.summaryText = `🏆 Штурм успешен! Клан [${sector.ownerClanTag}] ${sector.ownerClanName} одержал победу на клетках 7х7 (Выжило: ${atkAlive.length} против ${defAlive.length}, +150..200 PTS победителям, +50 PTS защитникам) и захватил сектор «${sector.name}» на 2 часа!`;

    if (winClan) {
      addClanLogEntry(
        winClan,
        winClan.leaderNick,
        'capture_territory',
        `Победа в живом бою 7х7 на клетках (Выжило ${atkAlive.length}/7, бойцам начислено +150..200 PTS)! Сектор «${sector.name}» (${sector.bonusLabel}) захвачен на 2 часа!`,
        sector.icon
      );
    }
  } else {
    if (sector.ownerClanId) {
      sector.protectionUntil = now + TERRITORY_PROTECTION_DURATION_MS;
    }
    b.winnerClanId = sector.ownerClanId;
    b.winnerClanName = sector.ownerClanName || 'Защитники сектора';
    b.winnerClanTag = sector.ownerClanTag || 'DEF';
    b.winnerClanEmblem = sector.ownerClanEmblem || sector.icon;
    b.summaryText = `🛡️ Оборона выстояла! Защитники «${sector.name}» победили в живом бою 7х7 (Выжило защитников: ${defAlive.length}, атакующих: ${atkAlive.length}, +150..200 PTS защитникам, +50 PTS атакующим) и сохранили сектор за собой!`;
  }

  sector.lastBattleReport = JSON.parse(JSON.stringify(b));
  sector.warStatus = 'peace';
  sector.warStartedAt = undefined;
  sector.warEndsAt = undefined;
  sector.attackerClanId = null;
  sector.attackerClanName = null;
  sector.attackerClanTag = null;
  sector.attackerClanEmblem = null;
  sector.battle7x7 = null;

  // Износ здания: каждый проведенный бой/штурм 7х7 за этот объект снимает 25 ед. прочности (снижается Форпостом базы клана)
  if (sector.production) {
    const ownerClan = sector.ownerClanId ? inMemoryClans.find((c) => c.id === sector.ownerClanId) : null;
    const baseEffects = getClanBaseBuildingsCatalog(ownerClan);
    const loss = Math.max(5, 25 - (baseEffects.outpostDurabilitySaveAfterWar || 0));
    const curDur = typeof sector.production.buildingDurability === 'number' ? sector.production.buildingDurability : 100;
    sector.production.buildingDurability = Math.max(0, curDur - loss);
  }

  // Правило безопасности: если владелец делегировал контроль клану во время активного боя,
  // то новый клановый контроль вступает в силу сразу после завершения этого нападения!
  if (sector.pendingClanControl) {
    const pending = sector.pendingClanControl;
    sector.ownerClanId = pending.clanId;
    sector.ownerClanName = pending.clanName;
    sector.ownerClanTag = pending.clanTag;
    sector.ownerClanEmblem = pending.clanEmblem;
    sector.icon = pending.clanEmblem || '👑';
    sector.ownerDelegatedClan = true;
    sector.pendingClanControl = null;
  }
}

export function appendPortWorkProtocol(
  prod: PortProductionState,
  entry: Omit<PortWorkProtocolEntry, 'id'>
): void {
  if (!Array.isArray(prod.workLogs)) prod.workLogs = [];
  prod.workLogs.unshift({
    ...entry,
    id: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  });
  if (prod.workLogs.length > 20) {
    prod.workLogs = prod.workLogs.slice(0, 20);
  }
}

export function appendPortDealProtocol(
  prod: PortProductionState,
  entry: Omit<PortDealProtocolEntry, 'id'>
): void {
  if (!Array.isArray(prod.dealLogs)) prod.dealLogs = [];
  prod.dealLogs.unshift({
    ...entry,
    id: `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  });
  if (prod.dealLogs.length > 30) {
    prod.dealLogs = prod.dealLogs.slice(0, 30);
  }
}

// ============================================================================
// МОДЕРНИЗАЦИЯ ЗАВОДОВ (УРОВНИ 1–5) И ДОМИНИРОВАНИЕ КЛАНА В СЕКТОРЕ 10x10
// ============================================================================

export interface PortFacilityLevelInfo {
  level: number;
  title: string;
  maxWorkers: number;
  maxStorage: number;
  outputMultiplier: number;
  upgradeCostGold: number;
  upgradeResources: Array<{ key: PortTerminalResourceKey; name: string; icon: string; qty: number }>;
}

export const PORT_FACILITY_LEVELS_CONFIG: PortFacilityLevelInfo[] = [
  {
    level: 1,
    title: 'Базовый цех (Ур. 1)',
    maxWorkers: 3,
    maxStorage: 100,
    outputMultiplier: 1,
    upgradeCostGold: 0,
    upgradeResources: []
  },
  {
    level: 2,
    title: 'Расширенный цех (Ур. 2)',
    maxWorkers: 5,
    maxStorage: 200,
    outputMultiplier: 1.5,
    upgradeCostGold: 15000,
    upgradeResources: [{ key: 'hardened_steel', name: 'Закаленная сталь', icon: '🔩', qty: 2 }]
  },
  {
    level: 3,
    title: 'Промышленный корпус (Ур. 3)',
    maxWorkers: 8,
    maxStorage: 350,
    outputMultiplier: 2,
    upgradeCostGold: 35000,
    upgradeResources: [
      { key: 'hardened_steel', name: 'Закаленная сталь', icon: '🔩', qty: 4 },
      { key: 'combat_modules', name: 'Боевые модули', icon: '⚙️', qty: 1 }
    ]
  },
  {
    level: 4,
    title: 'Тяжёлый завод (Ур. 4)',
    maxWorkers: 12,
    maxStorage: 500,
    outputMultiplier: 3,
    upgradeCostGold: 75000,
    upgradeResources: [
      { key: 'titanium_plate', name: 'Титановая Бронепластина', icon: '🛡️', qty: 3 },
      { key: 'combat_modules', name: 'Боевые модули', icon: '⚙️', qty: 2 }
    ]
  },
  {
    level: 5,
    title: 'Мега-комплекс (Ур. 5)',
    maxWorkers: 15,
    maxStorage: 1000,
    outputMultiplier: 4,
    upgradeCostGold: 150000,
    upgradeResources: [
      { key: 'titanium_plate', name: 'Титановая Бронепластина', icon: '🛡️', qty: 5 },
      { key: 'port_relics', name: 'Древняя Реликвия', icon: '🏺', qty: 2 }
    ]
  }
];

export function getPortFacilityLevelConfig(rawLevel?: number | null): PortFacilityLevelInfo {
  const lvl = Math.max(1, Math.min(5, Math.floor(Number(rawLevel) || 1)));
  return PORT_FACILITY_LEVELS_CONFIG.find((c) => c.level === lvl) || PORT_FACILITY_LEVELS_CONFIG[0];
}

export interface PortSectorDominanceInfo {
  mapX: number;
  mapY: number;
  totalBuildings: number;
  dominantClanId: string | null;
  dominantClanNumber: number;
  dominantClanTag: string;
  dominantClanName: string;
  dominantClanEmblem: string;
  controlledBuildings: number;
  controlPct: number;
  isSectorMaster: boolean; // > 50% построек
  summaryLine: string;
}

export function getPortSectorDominanceInfo(
  mapX: number,
  mapY: number,
  sectorsList?: ClanTerritorySector[]
): PortSectorDominanceInfo {
  const list = sectorsList || (Array.isArray(inMemoryTerritories) && inMemoryTerritories.length > 0 ? inMemoryTerritories : DEFAULT_CLAN_TERRITORIES);
  const { x: cx, y: cy } = normalizePortIslandCoord(mapX, mapY);
  const inCell = list.filter((s) => {
    const pos = normalizePortIslandCoord(s.mapX, s.mapY);
    return pos.x === cx && pos.y === cy;
  });

  if (inCell.length === 0) {
    return {
      mapX: cx,
      mapY: cy,
      totalBuildings: 0,
      dominantClanId: null,
      dominantClanNumber: 1,
      dominantClanTag: 'ТЕСТ',
      dominantClanName: 'Тест',
      dominantClanEmblem: '👑',
      controlledBuildings: 0,
      controlPct: 0,
      isSectorMaster: false,
      summaryLine: `Контроль сектора [${cx}/${cy}]: нет построек`
    };
  }

  const counts = new Map<
    string,
    {
      clanId: string | null;
      clanNumber: number;
      tag: string;
      name: string;
      emblem: string;
      count: number;
    }
  >();

  inCell.forEach((b) => {
    const rawTag = (b.ownerClanTag || 'ТЕСТ').trim();
    const key = (b.ownerClanId || rawTag).toLowerCase();
    const matchedClan =
      (b.ownerClanId ? inMemoryClans.find((c) => c.id === b.ownerClanId) : undefined) ||
      inMemoryClans.find((c) => c.tag.trim().toLowerCase() === rawTag.toLowerCase());
    const clanNum = matchedClan?.clanNumber || (rawTag.toUpperCase() === 'ТЕСТ' || rawTag.toUpperCase() === 'RB' ? 1 : 2);
    const displayTag = matchedClan?.tag || (rawTag.toUpperCase() === 'RB' ? 'ТЕСТ' : rawTag);
    const displayName = matchedClan?.name || (rawTag.toUpperCase() === 'RB' ? 'Тест' : b.ownerClanName || 'Тест');
    const displayEmblem = matchedClan?.emblem || b.ownerClanEmblem || '👑';

    const prev = counts.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      counts.set(key, {
        clanId: matchedClan?.id || b.ownerClanId || null,
        clanNumber: clanNum,
        tag: displayTag,
        name: displayName,
        emblem: displayEmblem,
        count: 1
      });
    }
  });

  const sorted = Array.from(counts.values()).sort((a, b) => b.count - a.count);
  const top = sorted[0];
  const pct = Math.round((top.count / inCell.length) * 100);
  // Статус «Хозяин сектора»: клан контролирует БОЛЕЕ 50% недвижимости в секторе
  const isSectorMaster = top.count / inCell.length > 0.5;

  return {
    mapX: cx,
    mapY: cy,
    totalBuildings: inCell.length,
    dominantClanId: top.clanId,
    dominantClanNumber: top.clanNumber,
    dominantClanTag: top.tag,
    dominantClanName: top.name,
    dominantClanEmblem: top.emblem,
    controlledBuildings: top.count,
    controlPct: pct,
    isSectorMaster,
    summaryLine: `Контроль сектора [${cx}/${cy}]: #${top.clanNumber} [${top.tag}] (${pct}% построек)${
      isSectorMaster ? ' — 🏆 Хозяин сектора (+15% скорость, -20% энергия, +25 PTS/ч)' : ''
    }`
  };
}

export function doesSectorBuildingHaveDominanceBonus(
  sector: ClanTerritorySector,
  sectorsList?: ClanTerritorySector[]
): boolean {
  const dom = getPortSectorDominanceInfo(sector.mapX ?? 7, sector.mapY ?? 6, sectorsList);
  if (!dom.isSectorMaster) return false;
  if (sector.ownerClanId && dom.dominantClanId && sector.ownerClanId === dom.dominantClanId) {
    return true;
  }
  const sTag = (sector.ownerClanTag || 'ТЕСТ').trim().toLowerCase();
  const dTag = (dom.dominantClanTag || 'ТЕСТ').trim().toLowerCase();
  return sTag === dTag || (sTag === 'rb' && dTag === 'тест');
}

export function calculatePortFacilityUnitSelfCost(prod: PortProductionState, sector?: ClanTerritorySector): number {
  const tier = prod.productionTier || (prod.productionStage === 'extraction' ? 1 : prod.requiresDualInput ? 3 : 2);
  const baseOutRate = Math.max(1, prod.outputRatePerHour || (tier === 1 ? 4 : 1));
  const wagePerHour = Math.max(50, Number(prod.workerWageGold || PORT_WORKER_GOLD_PER_HOUR));
  const hasIn1 = tier >= 2 && Boolean(prod.input1ResourceKey);
  const hasIn2 = Boolean(prod.input2ResourceKey);
  const hasIn3 = Boolean(prod.input3ResourceKey);
  const in1CostPerCycle = hasIn1 ? (prod.input1RequiredPerCycle || 1) * (prod.rawBuyPriceGold || 80) : 0;
  const in2CostPerCycle = hasIn2 ? (prod.input2RequiredPerCycle || 1) * (prod.input2BuyPriceGold || 130) : 0;
  const in3CostPerCycle = hasIn3 ? (prod.input3RequiredPerCycle || 1) * (prod.input3BuyPriceGold || 820) : 0;
  const pwrReq = prod.powerRequiredPerCycle ?? 0;
  const hasDom = sector ? doesSectorBuildingHaveDominanceBonus(sector) : false;
  const effectivePwrReq = hasDom ? pwrReq * 0.8 : pwrReq;
  const pwrCostPerCycle = effectivePwrReq > 0 ? Math.round(effectivePwrReq * (prod.powerBuyPriceGold || 70)) : 0;
  const totalHourCost = wagePerHour + in1CostPerCycle + in2CostPerCycle + in3CostPerCycle + pwrCostPerCycle;
  return Math.max(1, Math.round(totalHourCost / baseOutRate));
}

export function getBalancedDefaultPricesForSector(sector: ClanTerritorySector): {
  productSellPriceGold: number;
  rawBuyPriceGold: number;
  input2BuyPriceGold: number;
  input3BuyPriceGold: number;
  workerWageGold: number;
} {
  const outKey = sector.production?.outputResourceKey;
  const tplMatch =
    PORT_ESTATE_TEMPLATES.find((t) => outKey && t.outputResourceKey === outKey) ||
    PORT_ESTATE_TEMPLATES.find((t) => sector.production?.factoryType && t.factoryType === sector.production.factoryType);
  const defSector =
    DEFAULT_CLAN_TERRITORIES.find((d) => d.id === sector.id) ||
    DEFAULT_CLAN_TERRITORIES.find((d) => outKey && d.production?.outputResourceKey === outKey);

  const defProd = defSector?.production;
  return {
    productSellPriceGold: tplMatch?.productSellPriceGold ?? defProd?.productSellPriceGold ?? 750,
    rawBuyPriceGold: tplMatch?.rawBuyPriceGold ?? defProd?.rawBuyPriceGold ?? 80,
    input2BuyPriceGold: tplMatch?.input2BuyPriceGold ?? defProd?.input2BuyPriceGold ?? 130,
    input3BuyPriceGold: tplMatch?.input3BuyPriceGold ?? defProd?.input3BuyPriceGold ?? 920,
    workerWageGold: PORT_WORKER_GOLD_PER_HOUR
  };
}

function clampOrMigratePriceWithin20Pct(currentVal: number | undefined, baseDefault: number): number {
  const minAllowed = Math.max(1, Math.round(baseDefault * 0.8));
  const maxAllowed = Math.max(minAllowed, Math.round(baseDefault * 1.2));
  const num = Math.floor(Number(currentVal) || 0);
  if (num < minAllowed || num > maxAllowed) {
    return baseDefault;
  }
  return num;
}

function normalizeSectorProduction(
  sector: ClanTerritorySector,
  defaultSector?: ClanTerritorySector
): PortProductionState {
  const defSector =
    defaultSector ||
    DEFAULT_CLAN_TERRITORIES.find((d) => d.id === sector.id) ||
    DEFAULT_CLAN_TERRITORIES.find(
      (d) => sector.production?.outputResourceKey && d.production?.outputResourceKey === sector.production.outputResourceKey
    ) ||
    DEFAULT_CLAN_TERRITORIES[0];
  const defProd =
    defSector?.production ||
    createDefaultPortProduction('solar_relic_foundry', 'Мануфактуры', 35, 8);
  const raw = sector.production || defProd;
  const balancedDefaults = getBalancedDefaultPricesForSector(sector.production ? sector : defSector);
  const isMerged = Boolean(raw.isMerged);
  const rawFacilityLvl = Math.max(
    isMerged ? 2 : 1,
    Math.min(5, Math.floor(Number(raw.facilityLevel || defProd.facilityLevel || 1)))
  );
  const lvlCfg = getPortFacilityLevelConfig(rawFacilityLvl);
  const maxStorageByLevel = lvlCfg.maxStorage;

  const maxFish = maxStorageByLevel;
  const maxProcessed = maxStorageByLevel;
  const stage = raw.productionStage || defProd.productionStage || 'relic_foundry';
  const tier: 1 | 2 | 3 =
    raw.productionTier ||
    defProd.productionTier ||
    (stage === 'extraction' ? 1 : stage === 'raw_processing' ? 2 : 3);
  const isDual = Boolean(
    tier === 3 ||
      raw.requiresDualInput ||
      defProd.requiresDualInput ||
      Boolean(raw.input2ResourceKey || defProd.input2ResourceKey) ||
      stage === 'dual_advanced' ||
      raw.factoryType === 'elite_weapon_manufactory'
  );
  const hasIn1 = tier === 2 || tier === 3 || isDual || Boolean(raw.input1ResourceKey || defProd.input1ResourceKey);
  const hasIn2 = isDual || Boolean(raw.input2ResourceKey || defProd.input2ResourceKey);
  const hasIn3 = Boolean(raw.input3ResourceKey || defProd.input3ResourceKey);
  const maxIn1 = maxStorageByLevel;
  const maxIn2 = maxStorageByLevel;
  const maxIn3 = maxStorageByLevel;

  const in1Key = hasIn1
    ? raw.input1ResourceKey || defProd.input1ResourceKey || (tier === 2 ? 'raw_fish' : 'gold_ingots')
    : undefined;
  const in1Name = hasIn1
    ? raw.input1ResourceName || defProd.input1ResourceName || (tier === 2 ? 'Сырая рыба' : 'Золотые слитки')
    : undefined;
  const in1Icon = hasIn1
    ? raw.input1ResourceIcon || defProd.input1ResourceIcon || (tier === 2 ? '🐟' : '🪙')
    : undefined;
  const in1Stock = hasIn1
    ? Math.max(
        0,
        Math.min(
          maxIn1,
          Math.floor(Number(raw.input1Stock ?? defProd.input1Stock ?? raw.fishStock ?? 24))
        )
      )
    : undefined;
  const in1Req = hasIn1
    ? Math.max(1, Math.floor(Number(raw.input1RequiredPerCycle ?? defProd.input1RequiredPerCycle ?? (tier === 2 ? 5 : 2))))
    : undefined;

  const outResKey =
    raw.outputResourceKey ||
    defProd.outputResourceKey ||
    (tier === 1 ? 'raw_fish' : tier === 2 ? 'fish_semifinished' : 'port_relics');

  const maxRelic = outResKey === 'power_kw' ? Math.max(250, maxStorageByLevel) : maxStorageByLevel;

  const isPowerPlantOrTavern =
    outResKey === 'power_kw' ||
    outResKey === 'tavern_meal' ||
    sector.buildingCategory === 'power_plant' ||
    sector.buildingCategory === 'tavern';

  const defaultPowerReq =
    tier === 1 || isPowerPlantOrTavern ? 0 : tier === 2 ? 1 : 2;
  const powerReq = Math.max(
    0,
    Math.floor(Number(raw.powerRequiredPerCycle ?? defProd.powerRequiredPerCycle ?? defaultPowerReq))
  );
  const maxPwr = Math.max(200, maxStorageByLevel);
  const curPwr = Math.max(
    0,
    Math.min(maxPwr, Math.floor(Number(raw.powerStock ?? defProd.powerStock ?? (powerReq > 0 ? 45 : 0))))
  );
  const maxDurability = Math.max(10, Math.floor(Number(raw.maxBuildingDurability ?? 100)));
  const curDurability = Math.max(
    0,
    Math.min(maxDurability, Math.floor(Number(raw.buildingDurability ?? defProd.buildingDurability ?? 100)))
  );

  // Миграция стартовой кассы 15 000 -> 25 000 для базовых объектов Redblack
  const rawBal = Math.floor(Number(raw.facilityBalanceGold ?? defProd.facilityBalanceGold ?? 25000));
  const normalizedBalance = rawBal === 15000 ? 25000 : Math.max(0, rawBal);

  return {
    factoryType: raw.factoryType || defProd.factoryType,
    factoryCategoryLabel: defProd.factoryCategoryLabel || raw.factoryCategoryLabel,
    productionTier: tier,
    productionStage: tier === 1 ? 'extraction' : tier === 2 ? 'raw_processing' : 'dual_advanced',
    requiresDualInput: hasIn2,
    input1ResourceKey: in1Key,
    input1ResourceName: in1Name,
    input1ResourceIcon: in1Icon,
    input1Stock: in1Stock,
    maxInput1Stock: hasIn1 ? maxIn1 : undefined,
    input1RequiredPerCycle: in1Req,
    input2ResourceKey: hasIn2
      ? raw.input2ResourceKey || defProd.input2ResourceKey || 'fish_semifinished'
      : undefined,
    input2ResourceName: hasIn2
      ? raw.input2ResourceName || defProd.input2ResourceName || 'Рыбный паштет'
      : undefined,
    input2ResourceIcon: hasIn2 ? raw.input2ResourceIcon || defProd.input2ResourceIcon || '🥫' : undefined,
    input2Stock: hasIn2
      ? Math.max(0, Math.min(maxIn2, Math.floor(Number(raw.input2Stock ?? defProd.input2Stock ?? 20))))
      : undefined,
    maxInput2Stock: hasIn2 ? maxIn2 : undefined,
    input2RequiredPerCycle: hasIn2
      ? Math.max(1, Math.floor(Number(raw.input2RequiredPerCycle ?? defProd.input2RequiredPerCycle ?? 2)))
      : undefined,
    input2BuyPriceGold: hasIn2
      ? clampOrMigratePriceWithin20Pct(raw.input2BuyPriceGold, balancedDefaults.input2BuyPriceGold)
      : undefined,
    input3ResourceKey: hasIn3
      ? raw.input3ResourceKey || defProd.input3ResourceKey || 'alchemy_reagents'
      : undefined,
    input3ResourceName: hasIn3
      ? raw.input3ResourceName || defProd.input3ResourceName || 'Алхимический реагент'
      : undefined,
    input3ResourceIcon: hasIn3 ? raw.input3ResourceIcon || defProd.input3ResourceIcon || '🧪' : undefined,
    input3Stock: hasIn3
      ? Math.max(0, Math.min(maxIn3, Math.floor(Number(raw.input3Stock ?? defProd.input3Stock ?? 18))))
      : undefined,
    maxInput3Stock: hasIn3 ? maxIn3 : undefined,
    input3RequiredPerCycle: hasIn3
      ? Math.max(1, Math.floor(Number(raw.input3RequiredPerCycle ?? defProd.input3RequiredPerCycle ?? 1)))
      : undefined,
    input3BuyPriceGold: hasIn3
      ? clampOrMigratePriceWithin20Pct(raw.input3BuyPriceGold, balancedDefaults.input3BuyPriceGold)
      : undefined,
    outputResourceKey: outResKey,
    outputProductName:
      raw.outputProductName ||
      defProd.outputProductName ||
      (tier === 1 ? 'Сырая рыба' : tier === 2 ? 'Рыбный паштет' : 'Древняя Реликвия'),
    outputProductIcon:
      raw.outputProductIcon || defProd.outputProductIcon || (tier === 1 ? '🐟' : tier === 2 ? '🥫' : '🏺'),
    outputRatePerHour: Math.max(
      1,
      Math.floor(Number(raw.outputRatePerHour ?? defProd.outputRatePerHour ?? (tier === 1 ? 5 : 1)))
    ),
    linkedSectorId: raw.linkedSectorId ?? defProd.linkedSectorId ?? null,
    intermediateResourceName:
      raw.intermediateResourceName || defProd.intermediateResourceName || 'Рыбный паштет',
    facilityLevel: rawFacilityLvl,
    facilityBalanceGold: normalizedBalance,
    workerWageGold:
      Number(raw.workerWageGold) === 250 || Number(raw.workerWageGold) === 275 || !raw.workerWageGold
        ? PORT_WORKER_GOLD_PER_HOUR
        : Math.max(50, Math.floor(Number(raw.workerWageGold))),
    rawBuyPriceGold: clampOrMigratePriceWithin20Pct(raw.rawBuyPriceGold, balancedDefaults.rawBuyPriceGold),
    productSellPriceGold: clampOrMigratePriceWithin20Pct(
      raw.productSellPriceGold,
      balancedDefaults.productSellPriceGold
    ),
    isMerged,
    mergedWithSectorId: raw.mergedWithSectorId || null,
    fishStock: Math.max(0, Math.min(maxFish, Math.floor(Number(in1Stock ?? raw.fishStock ?? defProd.fishStock)))),
    maxFishStock: maxFish,
    processedStock: Math.max(
      0,
      Math.min(maxProcessed, Math.floor(Number(raw.processedStock ?? defProd.processedStock ?? 16)))
    ),
    maxProcessedStock: maxProcessed,
    relicStock: Math.max(0, Math.min(maxRelic, Math.floor(Number(raw.relicStock ?? defProd.relicStock)))),
    maxRelicStock: maxRelic,
    lastCraftTickAt: Number(raw.lastCraftTickAt || Date.now()),
    workers: Array.isArray(raw.workers) ? raw.workers : [],
    passiveGoldEarned: Math.max(0, Math.floor(Number(raw.passiveGoldEarned ?? defProd.passiveGoldEarned ?? 0))),
    totalRelicsCrafted: Math.max(
      0,
      Math.floor(Number(raw.totalRelicsCrafted ?? defProd.totalRelicsCrafted ?? 0))
    ),
    powerStock: curPwr,
    maxPowerStock: maxPwr,
    powerRequiredPerCycle: powerReq,
    powerBuyPriceGold: Math.max(10, Math.floor(Number(raw.powerBuyPriceGold ?? 70))),
    buildingDurability: curDurability,
    maxBuildingDurability: maxDurability,
    lastDurabilityDecayAt: Number(raw.lastDurabilityDecayAt || Date.now()),
    repairIronStock: Math.max(0, Math.min(5, Math.floor(Number(raw.repairIronStock ?? 0)))),
    repairSteelStock: Math.max(0, Math.min(2, Math.floor(Number(raw.repairSteelStock ?? 0)))),
    repairOrderActive: Boolean(raw.repairOrderActive),
    workLogs: Array.isArray(raw.workLogs) ? raw.workLogs.slice(0, 20) : [],
    dealLogs: Array.isArray(raw.dealLogs) ? raw.dealLogs.slice(0, 30) : []
  };
}

function tickPortProductionForSector(
  sector: ClanTerritorySector,
  now: number
): boolean {
  const prod = normalizeSectorProduction(sector);
  sector.production = prod;
  let mutated = false;

  // Если прочность здания упала до 0/100, завод сломан и не производит продукцию
  if ((prod.buildingDurability ?? 100) <= 0) {
    prod.lastCraftTickAt = now;
    return mutated;
  }

  // Зависимость производства от рабочей силы:
  // Если на конкретном объекте никто не работает (активных работников = 0),
  // то производство ОСТАНАВЛИВАЕТСЯ (склад сырья не расходуется, продукция не выпускается).
  const activeWorkers = prod.workers.filter((w) => !w.claimed && w.endsAt > now);

  // Каждые сутки активной работы снимают 5 ед. прочности
  const DAY_MS = 24 * 60 * 60 * 1000;
  const decayElapsed = now - (prod.lastDurabilityDecayAt || now);
  if (decayElapsed >= DAY_MS) {
    const days = Math.min(10, Math.floor(decayElapsed / DAY_MS));
    if (days > 0 && activeWorkers.length > 0) {
      prod.buildingDurability = Math.max(0, (prod.buildingDurability ?? 100) - days * 5);
      mutated = true;
    }
    prod.lastDurabilityDecayAt = now;
  }

  if ((prod.buildingDurability ?? 100) <= 0) {
    prod.lastCraftTickAt = now;
    return mutated;
  }

  const HOUR_MS = 60 * 60 * 1000;
  const elapsedMs = now - (prod.lastCraftTickAt || now);
  if (elapsedMs >= HOUR_MS) {
    if (activeWorkers.length === 0) {
      // Цех стоит без рабочих: сдвигаем таймер без расхода сырья и без выпуска продукции
      prod.lastCraftTickAt = now;
      return true;
    }

    const hoursPassed = Math.min(24, Math.floor(elapsedMs / HOUR_MS));
    if (hoursPassed > 0) {
      const lvlCfg = getPortFacilityLevelConfig(prod.facilityLevel);
      const hasDomBonus = doesSectorBuildingHaveDominanceBonus(sector);
      const domSpeedMult = hasDomBonus ? 1.15 : 1;
      const totalCycles = hoursPassed * Math.max(1, activeWorkers.length);
      let craftedCount = 0;
      const tier = prod.productionTier || (prod.productionStage === 'extraction' ? 1 : prod.requiresDualInput ? 3 : 2);
      const baseOutRate = Math.max(1, prod.outputRatePerHour || (tier === 1 ? 4 : 1));
      const cycleOutQty = Math.max(1, Math.round(baseOutRate * lvlCfg.outputMultiplier * domSpeedMult));
      const hasIn2 = Boolean(prod.input2ResourceKey);
      const hasIn3 = Boolean(prod.input3ResourceKey);
      const baseReqPwr = prod.powerRequiredPerCycle ?? 0;
      const reqPwr = baseReqPwr > 0 && hasDomBonus ? Math.max(1, Math.floor(baseReqPwr * 0.8)) : baseReqPwr;

      for (let i = 0; i < totalCycles; i++) {
        if (tier === 1 || prod.productionStage === 'extraction') {
          // Уровень 1 (Добыча): не требует входящего сырья, только рабочих
          if (prod.relicStock < prod.maxRelicStock) {
            const added = Math.min(cycleOutQty, prod.maxRelicStock - prod.relicStock);
            prod.relicStock += added;
            prod.totalRelicsCrafted = (prod.totalRelicsCrafted || 0) + added;
            craftedCount += added;
          } else {
            break;
          }
        } else {
          // Уровень 2 или 3 (1, 2 или 3 входящих ресурса + проверка Мощности кВт)
          const req1 = prod.input1RequiredPerCycle ?? 2;
          const req2 = hasIn2 ? (prod.input2RequiredPerCycle ?? 2) : 0;
          const req3 = hasIn3 ? (prod.input3RequiredPerCycle ?? 1) : 0;
          const cur1 = prod.input1Stock ?? prod.fishStock ?? 0;
          const cur2 = hasIn2 ? (prod.input2Stock ?? 0) : 0;
          const cur3 = hasIn3 ? (prod.input3Stock ?? 0) : 0;
          const curPwr = prod.powerStock ?? 0;

          if (
            cur1 >= req1 &&
            (!hasIn2 || cur2 >= req2) &&
            (!hasIn3 || cur3 >= req3) &&
            (reqPwr <= 0 || curPwr >= reqPwr) &&
            prod.relicStock < prod.maxRelicStock
          ) {
            const next1 = Math.max(0, cur1 - req1);
            prod.input1Stock = next1;
            prod.fishStock = next1;
            if (hasIn2) {
              prod.input2Stock = Math.max(0, cur2 - req2);
            }
            if (hasIn3) {
              prod.input3Stock = Math.max(0, cur3 - req3);
            }
            if (reqPwr > 0) {
              prod.powerStock = Math.max(0, curPwr - reqPwr);
            }
            const added = Math.min(cycleOutQty, prod.maxRelicStock - prod.relicStock);
            prod.relicStock += added;
            prod.processedStock = prod.relicStock;
            prod.totalRelicsCrafted = (prod.totalRelicsCrafted || 0) + added;
            craftedCount += added;
          } else {
            break;
          }
        }
      }

      prod.lastCraftTickAt = now;
      mutated = true;

      if (craftedCount > 0) {
        const passiveGold = craftedCount * 150;
        prod.passiveGoldEarned = (prod.passiveGoldEarned || 0) + passiveGold;
        prod.facilityBalanceGold = (prod.facilityBalanceGold || 0) + passiveGold;

        if (sector.ownerClanId) {
          const ownerClan = inMemoryClans.find((c) => c.id === sector.ownerClanId);
          if (ownerClan) {
            ownerClan.treasuryGold = (ownerClan.treasuryGold || 0) + passiveGold;
            addClanLogEntry(
              ownerClan,
              ownerClan.leaderNick,
              'port_production',
              `Производство в Порту «${sector.name}» (Ур. ${prod.facilityLevel || 1}, рабочих: ${activeWorkers.length}) выпустило +${craftedCount} ед. «${prod.outputProductName}» и принесло +${passiveGold} 🪙 прибыли!`,
              '🏭'
            );
          }
        }
      }
    }
  }

  return mutated;
}

function applyRedBlackOwnershipToSector(sector: ClanTerritorySector): void {
  if (!sector.ownerNick || sector.ownerNick.trim().toLowerCase() === 'redblack') {
    sector.ownerNick = DEFAULT_PORT_ESTATE_OWNER_NICK;
  }

  const effectiveOwner = (sector.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim().toLowerCase();
  const redblackClan =
    inMemoryClans.find((c) => c.clanNumber === 1) ||
    inMemoryClans.find((c) => c.tag.trim().toLowerCase() === 'тест') ||
    inMemoryClans.find((c) => c.leaderNick.trim().toLowerCase() === 'redblack');

  const ownerClan =
    effectiveOwner === DEFAULT_PORT_ESTATE_OWNER_NICK.toLowerCase()
      ? redblackClan
      : inMemoryClans.find(
          (c) =>
            c.leaderNick.trim().toLowerCase() === effectiveOwner ||
            c.members.some((m) => m.nick.trim().toLowerCase() === effectiveOwner)
        );

  if (
    effectiveOwner === DEFAULT_PORT_ESTATE_OWNER_NICK.toLowerCase() &&
    (!sector.ownerClanTag || sector.ownerClanTag.toUpperCase() === 'RB' || sector.ownerClanName === 'Империя RedBlack')
  ) {
    sector.ownerClanId = redblackClan?.id || 'clan_redblack_1';
    sector.ownerClanName = redblackClan?.name || 'Тест';
    sector.ownerClanTag = redblackClan?.tag || 'ТЕСТ';
    sector.ownerClanEmblem = redblackClan?.emblem || '👑';
  } else if (!sector.ownerDelegatedClan) {
    if (ownerClan && !sector.ownerClanId) {
      sector.ownerClanId = ownerClan.id;
      sector.ownerClanName = ownerClan.name;
      sector.ownerClanTag = ownerClan.tag;
      sector.ownerClanEmblem = ownerClan.emblem;
    } else if (!sector.ownerClanName) {
      sector.ownerClanName =
        effectiveOwner === DEFAULT_PORT_ESTATE_OWNER_NICK.toLowerCase()
          ? 'Тест'
          : `Клан ${sector.ownerNick}`;
      sector.ownerClanTag =
        effectiveOwner === DEFAULT_PORT_ESTATE_OWNER_NICK.toLowerCase()
          ? 'ТЕСТ'
          : (sector.ownerNick || 'CLAN').slice(0, 4).toUpperCase();
      sector.ownerClanEmblem = '👑';
    }
  }
  // Вместо старых картинок зданий всегда отображается Знак контролирующего клана
  sector.icon = sector.ownerClanEmblem || '👑';
}

function ensureTerritoriesLoaded(): ClanTerritorySector[] {
  initClanStorage();
  if (!Array.isArray(inMemoryTerritories) || inMemoryTerritories.length === 0) {
    inMemoryTerritories = DEFAULT_CLAN_TERRITORIES.map((t) => {
      const copy: ClanTerritorySector = {
        ...t,
        zone: 'port',
        ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
        warScores: {},
        production: normalizeSectorProduction(t, t)
      };
      applyRedBlackOwnershipToSector(copy);
      return copy;
    });
  } else {
    const byId = new Map<string, ClanTerritorySector>();
    inMemoryTerritories.forEach((t) => byId.set(t.id, t));
    const defaultIds = new Set(DEFAULT_CLAN_TERRITORIES.map((d) => d.id));
    const baseList = DEFAULT_CLAN_TERRITORIES.map((def) => {
      const existing = byId.get(def.id);
      if (!existing) {
        const fresh: ClanTerritorySector = {
          ...def,
          zone: 'port',
          ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
          warScores: {},
          production: normalizeSectorProduction(def, def)
        };
        applyRedBlackOwnershipToSector(fresh);
        return fresh;
      }
      const normCoord = normalizePortIslandCoord(existing.mapX ?? def.mapX, existing.mapY ?? def.mapY);
      const merged: ClanTerritorySector = {
        ...def,
        ...existing,
        name: existing.name || def.name,
        description: existing.description || def.description,
        zone: 'port',
        mapX: normCoord.x,
        mapY: normCoord.y,
        sectorBiomeName: existing.sectorBiomeName || def.sectorBiomeName,
        buildingCategory: existing.buildingCategory || def.buildingCategory,
        ownerNick: existing.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK,
        warScores: existing.warScores || {}
      };
      applyRedBlackOwnershipToSector(merged);
      merged.production = normalizeSectorProduction(merged, def);
      return merged;
    });

    // Сохраняем все созданные игроками за 3 000 кристаллов объекты недвижимости
    const customList = inMemoryTerritories
      .filter((t) => !defaultIds.has(t.id))
      .map((custom) => {
        const prod = normalizeSectorProduction(custom);
        const { x: mx, y: my } = normalizePortIslandCoord(custom.mapX, custom.mapY);
        const cellMeta = getPortIslandCellMeta(mx, my);
        const cat: ClanTerritorySector['buildingCategory'] =
          prod.outputResourceKey === 'power_kw'
            ? 'power_plant'
            : prod.outputResourceKey === 'tavern_meal'
            ? 'tavern'
            : prod.productionTier === 1 || prod.productionStage === 'extraction'
            ? 'extraction'
            : prod.productionTier === 3 || prod.productionStage === 'dual_advanced'
            ? 'dual_manufactory'
            : 'raw_processing';
        const copy: ClanTerritorySector = {
          ...custom,
          isCustomCreated: true,
          zone: 'port',
          mapX: mx,
          mapY: my,
          sectorBiomeName: custom.sectorBiomeName || cellMeta.sectorTitle,
          buildingCategory: custom.buildingCategory || cat,
          warScores: custom.warScores || {},
          production: prod
        };
        applyRedBlackOwnershipToSector(copy);
        return copy;
      });

    inMemoryTerritories = [...baseList, ...customList];
  }

  const now = Date.now();
  let changed = false;

  inMemoryTerritories.forEach((sector) => {
    if (tickPortProductionForSector(sector, now)) {
      changed = true;
    }

    if (sector.warStatus === 'war') {
      if (!sector.battle7x7) {
        const startTs = sector.warStartedAt || now;
        sector.battle7x7 = {
          phase: 'gathering',
          gatheringStartedAt: startTs,
          gatheringEndsAt: startTs + TERRITORY_GATHERING_DURATION_MS,
          currentRound: 0,
          maxRounds: 12,
          roundStartedAt: 0,
          roundEndsAt: 0,
          attackers: [],
          defenders: [],
          waitingQueueAttackers: [],
          waitingQueueDefenders: [],
          roundLogs: []
        };
        changed = true;
      }

      normalize7x7RealPlayersRoster(sector);

      const b = sector.battle7x7;
      if (!b.gatheringStartedAt || Number.isNaN(b.gatheringStartedAt)) {
        b.gatheringStartedAt = sector.warStartedAt || now;
      }
      if (!b.gatheringEndsAt || Number.isNaN(b.gatheringEndsAt)) {
        b.gatheringEndsAt = b.gatheringStartedAt + TERRITORY_GATHERING_DURATION_MS;
      }

      if (b.phase === 'finished') {
        finalizeTerritory7x7Battle(sector, now);
        changed = true;
      } else if (b.phase === 'gathering') {
        const isFull7x7 = b.attackers.length >= 7 && b.defenders.length >= 7;
        const isTimeUp = now >= b.gatheringEndsAt;
        if (isFull7x7 || isTimeUp) {
          transitionSectorToCombatPhase(sector, now);
          // Жесткое правило очистки таймера (7 минут): если время сбора (00:00) вышло,
          // автоматически доводим расчёт боя 7х7 до финала и очищаем статус штурма, чтобы плашка не зависала!
          if (isTimeUp && sector.battle7x7 && sector.battle7x7.phase === 'combat') {
            let autoRoundSafety = 0;
            while (
              sector.battle7x7 &&
              sector.battle7x7.phase === 'combat' &&
              autoRoundSafety < 20
            ) {
              autoRoundSafety++;
              simulateSingle7x7Round(sector, now);
            }
            if (sector.battle7x7) {
              finalizeTerritory7x7Battle(sector, now);
            }
          }
          changed = true;
        }
      }

      if (sector.battle7x7 && sector.battle7x7.phase === 'combat') {
        if (!sector.battle7x7.roundEndsAt || Number.isNaN(sector.battle7x7.roundEndsAt)) {
          sector.battle7x7.roundEndsAt = now + TERRITORY_COMBAT_ROUND_DURATION_MS;
        }
        // Автоматический расчёт ходов по истечении 20 секунд на ход
        let safety = 0;
        while (
          sector.battle7x7 &&
          sector.battle7x7.phase === 'combat' &&
          now >= sector.battle7x7.roundEndsAt &&
          safety < 20
        ) {
          safety++;
          simulateSingle7x7Round(sector, sector.battle7x7.roundEndsAt);
          changed = true;
        }
        if (sector.battle7x7 && now >= sector.battle7x7.roundEndsAt) {
          finalizeTerritory7x7Battle(sector, now);
          changed = true;
        }
      }
    }
  });

  // Удержание недвижимости: каждый завод или причал под контролем клана приносит +10 PTS в час в общий пул клана,
  // а каждый сектор, где клан является «Хозяином сектора» (>50% построек), приносит дополнительно +25 PTS/час!
  const HOUR_MS = 60 * 60 * 1000;
  const uniqueSectorCoords = new Set<string>();
  inMemoryTerritories.forEach((s) => {
    const pos = normalizePortIslandCoord(s.mapX, s.mapY);
    uniqueSectorCoords.add(`${pos.x}_${pos.y}`);
  });

  inMemoryClans.forEach((clan) => {
    const lastTick = Number(clan.lastEstatePtsTickAt || now);
    const elapsed = now - lastTick;
    if (elapsed >= HOUR_MS) {
      const hours = Math.min(24, Math.floor(elapsed / HOUR_MS));
      const controlledCount = inMemoryTerritories.filter(
        (s) =>
          s.ownerClanId === clan.id ||
          (s.ownerClanTag && clan.tag && s.ownerClanTag.toLowerCase() === clan.tag.toLowerCase())
      ).length;

      let dominatedSectorsCount = 0;
      uniqueSectorCoords.forEach((coordKey) => {
        const [sx, sy] = coordKey.split('_').map(Number);
        const dom = getPortSectorDominanceInfo(sx, sy, inMemoryTerritories);
        if (
          dom.isSectorMaster &&
          ((dom.dominantClanId && dom.dominantClanId === clan.id) ||
            dom.dominantClanTag.toLowerCase() === clan.tag.toLowerCase())
        ) {
          dominatedSectorsCount += 1;
        }
      });

      if (hours > 0 && (controlledCount > 0 || dominatedSectorsCount > 0)) {
        const addedPoolPts = hours * (controlledCount * 10 + dominatedSectorsCount * 25);
        clan.unassignedPtsPool = Math.max(0, Number(clan.unassignedPtsPool || 0)) + addedPoolPts;
        changed = true;
      }
      clan.lastEstatePtsTickAt = now;
    }
  });

  if (changed) {
    saveClansToSupabase();
  }
  return inMemoryTerritories;
}

export function getClanTerritories(): ClanTerritorySector[] {
  return ensureTerritoriesLoaded();
}

export function getPlayerOwnedPortEstates(playerNick?: string | null): ClanTerritorySector[] {
  if (!playerNick) return [];
  const clean = playerNick.trim().toLowerCase();
  const sectors = ensureTerritoriesLoaded();
  return sectors.filter((s) => (s.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim().toLowerCase() === clean);
}

export function getActiveClanWarAlerts(clanId?: string | null): ClanTerritorySector[] {
  const sectors = ensureTerritoriesLoaded();
  const now = Date.now();
  return sectors.filter((s) => {
    if (s.warStatus !== 'war' || !s.battle7x7) return false;
    if (s.battle7x7.phase === 'finished') return false;
    const targetEnd = s.battle7x7.phase === 'gathering' ? s.battle7x7.gatheringEndsAt : s.battle7x7.roundEndsAt;
    if (targetEnd && now >= targetEnd) return false;
    if (!clanId) return true;
    return s.attackerClanId === clanId || s.ownerClanId === clanId;
  });
}

export function getClanTerritoryBuffs(clanId?: string | null, playerNick?: string | null): {
  slotsLuckPct: number;
  fishingGoldPct: number;
  pyramidGoldPct: number;
  combatDmgPct: number;
  pyramidExpPct: number;
  maxHpPct: number;
  ownedSectors: ClanTerritorySector[];
} {
  const sectors = ensureTerritoriesLoaded();
  const cleanNick = (playerNick || '').trim().toLowerCase();
  const ownedSectors = sectors.filter(
    (s) =>
      (clanId && s.ownerClanId === clanId) ||
      (cleanNick && (s.ownerNick || '').trim().toLowerCase() === cleanNick)
  );
  if (ownedSectors.length === 0) {
    return {
      slotsLuckPct: 0,
      fishingGoldPct: 0,
      pyramidGoldPct: 0,
      combatDmgPct: 0,
      pyramidExpPct: 0,
      maxHpPct: 0,
      ownedSectors: []
    };
  }
  let slotsLuckPct = 0;
  let fishingGoldPct = 0;
  let pyramidGoldPct = 0;
  let combatDmgPct = 0;
  let pyramidExpPct = 0;
  let maxHpPct = 0;

  ownedSectors.forEach((s) => {
    if (s.bonusType === 'slots_luck') slotsLuckPct += s.bonusValue;
    if (s.bonusType === 'fishing_gold') fishingGoldPct += s.bonusValue;
    if (s.bonusType === 'pyramid_gold') pyramidGoldPct += s.bonusValue;
    if (s.bonusType === 'combat_dmg') combatDmgPct += s.bonusValue;
    if (s.bonusType === 'pyramid_exp') pyramidExpPct += s.bonusValue;
    if (s.bonusType === 'max_hp') maxHpPct += s.bonusValue;
  });

  return {
    slotsLuckPct,
    fishingGoldPct,
    pyramidGoldPct,
    combatDmgPct,
    pyramidExpPct,
    maxHpPct,
    ownedSectors
  };
}

// ============================================================================
// СИСТЕМА «ЗНАК КЛАНА» (1 000 ЗОЛОТА) И ПРАВИЛА ВОЙН ЗА ПОРТ
// ============================================================================

export function doesPlayerHaveClanBadge(
  playerNick?: string | null,
  clanId?: string | null,
  heroHasBadge?: boolean
): boolean {
  if (!playerNick) return false;
  initClanStorage();
  const cleanNick = playerNick.trim().toLowerCase();
  const clan = clanId
    ? inMemoryClans.find((c) => c.id === clanId)
    : inMemoryClans.find(
        (c) =>
          c.leaderNick.trim().toLowerCase() === cleanNick ||
          c.members.some((m) => m.nick.trim().toLowerCase() === cleanNick)
      );
  if (!clan) return false;
  if (clan.leaderNick.trim().toLowerCase() === cleanNick) return true;
  const member = clan.members.find((m) => m.nick.trim().toLowerCase() === cleanNick);
  if (!member) return false;
  if (member.role === 'leader' || member.hasClanBadge || heroHasBadge) {
    member.hasClanBadge = true;
    return true;
  }
  return false;
}

export function issueClanMemberBadge(
  clanId: string,
  actorNick: string,
  targetNick: string,
  payFrom: 'treasury' | 'personal' = 'treasury',
  personalGoldAvailable = 0
): {
  ok: boolean;
  costGold?: number;
  paidFrom?: 'treasury' | 'personal';
  clan?: Clan;
  message?: string;
  error?: string;
} {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const actorClean = actorNick.trim().toLowerCase();
  const isLeader =
    clan.leaderNick.trim().toLowerCase() === actorClean ||
    clan.members.some((m) => m.nick.trim().toLowerCase() === actorClean && m.role === 'leader');
  if (!isLeader) {
    return { ok: false, error: 'Выдавать официальный Знак клана может только Глава клана!' };
  }

  const targetMember = clan.members.find(
    (m) => m.nick.trim().toLowerCase() === targetNick.trim().toLowerCase()
  );
  if (!targetMember) {
    return { ok: false, error: 'Участник не найден в составе клана.' };
  }

  if (targetMember.hasClanBadge || targetMember.role === 'leader') {
    targetMember.hasClanBadge = true;
    return { ok: false, error: `У бойца ${targetMember.nick} уже есть официальный Знак клана!` };
  }

  if (payFrom === 'treasury') {
    if ((clan.treasuryGold || 0) < CLAN_BADGE_COST_GOLD) {
      return {
        ok: false,
        error: `В казне клана недостаточно золота! Требуется ${CLAN_BADGE_COST_GOLD.toLocaleString()} 🪙 (в казне: ${(clan.treasuryGold || 0).toLocaleString()} 🪙).`
      };
    }
    clan.treasuryGold = Math.max(0, (clan.treasuryGold || 0) - CLAN_BADGE_COST_GOLD);
  } else {
    if (personalGoldAvailable < CLAN_BADGE_COST_GOLD) {
      return {
        ok: false,
        error: `У вас недостаточно личного золота! Требуется ${CLAN_BADGE_COST_GOLD.toLocaleString()} 🪙.`
      };
    }
  }

  targetMember.hasClanBadge = true;
  targetMember.badgeIssuedAt = Date.now();

  addClanLogEntry(
    clan,
    actorNick,
    'issue_clan_badge',
    `Глава клана выдал официальный Знак клана [${clan.tag}] бойцу ${targetMember.nick} за ${CLAN_BADGE_COST_GOLD.toLocaleString()} 🪙 (${payFrom === 'treasury' ? 'из казны клана' : 'личное золото'})! Теперь он имеет право штурмовать и защищать объекты в Порту (7х7).`,
    '🛡️'
  );

  saveClansToSupabase();

  return {
    ok: true,
    costGold: CLAN_BADGE_COST_GOLD,
    paidFrom: payFrom,
    clan,
    message: `🛡️ Официальный Знак клана [${clan.tag}] успешно выдан бойцу ${targetMember.nick} за ${CLAN_BADGE_COST_GOLD.toLocaleString()} 🪙! Теперь он допущен к боям 7х7 за объекты Порта.`
  };
}

// ============================================================================
// ПРОИЗВОДСТВА ПОРТА: РАБОТА (ДЛЯ ВСЕХ), РЫБА -> РЕЛИКВИИ И ОБЪЕДИНЕНИЕ ОБЪЕКТОВ
// ============================================================================

export function getPlayerActivePortWorkShift(playerNick?: string | null): {
  sector: ClanTerritorySector;
  worker: PortFactoryWorkerSession;
} | null {
  if (!playerNick) return null;
  const clean = playerNick.trim().toLowerCase();
  const sectors = ensureTerritoriesLoaded();
  for (const s of sectors) {
    const prod = normalizeSectorProduction(s);
    s.production = prod;
    const found = prod.workers.find((w) => w.nick.trim().toLowerCase() === clean && !w.claimed);
    if (found) {
      return { sector: s, worker: found };
    }
  }
  return null;
}

export function startPortFactoryWorkShift(
  sectorId: string,
  playerNick: string,
  avatar = '🧙‍♂️',
  durationHours: 1 | 2 = 2
): { ok: boolean; sector?: ClanTerritorySector; message?: string; error?: string } {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект производства в Порту не найден.' };

  const activeAnywhere = getPlayerActivePortWorkShift(playerNick);
  if (activeAnywhere) {
    const remMs = Math.max(0, activeAnywhere.worker.endsAt - Date.now());
    if (remMs > 0) {
      const m = Math.ceil(remMs / 60000);
      return {
        ok: false,
        error: `Вы уже работаете на объекте «${activeAnywhere.sector.name}» (осталось ~${m} мин.). Завершите или заберите награду за текущую смену!`
      };
    } else {
      return {
        ok: false,
        error: `Ваша смена на объекте «${activeAnywhere.sector.name}» уже завершена! Сначала нажмите «Забрать оплату смены».`
      };
    }
  }

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  // Проверка поломки здания (0/100)
  if ((prod.buildingDurability ?? 100) <= 0) {
    return {
      ok: false,
      error: `🛠️ Объект «${sector.name}» сломан (Прочность: 0/100)! Сначала отремонтируйте здание (5 ед. Железной руды + 2 ед. Закаленной стали).`
    };
  }

  // Очищаем уже забравших награду работников
  prod.workers = prod.workers.filter((w) => !w.claimed);

  const lvlCfg = getPortFacilityLevelConfig(prod.facilityLevel);
  const maxWorkers = prod.isMerged ? Math.max(PORT_MERGED_MAX_WORKERS, lvlCfg.maxWorkers) : lvlCfg.maxWorkers;
  if (prod.workers.length >= maxWorkers) {
    return {
      ok: false,
      error: `На объекте «${sector.name}» заняты все рабочие места (${prod.workers.length}/${maxWorkers} чел.)! Выберите другое производство или модернизируйте уровень завода.`
    };
  }

  const hours: 1 | 2 = durationHours === 1 ? 1 : 2;
  const now = Date.now();
  const wagePerHour = Math.max(50, Number(prod.workerWageGold || PORT_WORKER_GOLD_PER_HOUR));
  const totalShiftWage = hours * wagePerHour;

  // Если в кассе завода не хватает денег на оплату смены — работа блокируется
  if ((prod.facilityBalanceGold || 0) < totalShiftWage) {
    return {
      ok: false,
      error: `[Нет средств] В кассе завода «${sector.name}» недостаточно золота для оплаты смены (нужно ${totalShiftWage.toLocaleString()} 🪙, в кассе: ${(prod.facilityBalanceGold || 0).toLocaleString()} 🪙)!`
    };
  }

  const session: PortFactoryWorkerSession = {
    nick: playerNick,
    avatar,
    startedAt: now,
    endsAt: now + hours * 60 * 60 * 1000,
    durationHours: hours,
    goldPerHour: wagePerHour,
    claimed: false
  };

  prod.workers.push(session);
  saveClansToSupabase();

  return {
    ok: true,
    sector,
    message: `🔨 Вы устроились на работу в «${sector.name}» на ${hours} ч. (-40% бодрости)! Награда по окончании смены: +${
      hours * wagePerHour
    } 🪙 (${wagePerHour} 🪙/ч) и +${hours} к навыку «Производство».`
  };
}

export function claimPortFactoryWorkShift(
  sectorId: string,
  playerNick: string,
  allowInstantFinish = false
): {
  ok: boolean;
  goldEarned?: number;
  hoursWorked?: number;
  passiveClanGold?: number;
  relicsCraftedNow?: number;
  sector?: ClanTerritorySector;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект производства не найден.' };

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  const clean = playerNick.trim().toLowerCase();
  const workerIdx = prod.workers.findIndex((w) => w.nick.trim().toLowerCase() === clean && !w.claimed);
  if (workerIdx < 0) {
    return { ok: false, error: 'У вас нет активной рабочей смены на этом производстве.' };
  }

  const worker = prod.workers[workerIdx];
  const now = Date.now();
  if (!allowInstantFinish && now < worker.endsAt) {
    const remSec = Math.ceil((worker.endsAt - now) / 1000);
    const h = Math.floor(remSec / 3600);
    const m = Math.floor((remSec % 3600) / 60);
    const s = remSec % 60;
    return {
      ok: false,
      error: `Смена ещё продолжается! Осталось ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.`
    };
  }

  const hoursWorked = worker.durationHours || 2;
  const requestedWage = hoursWorked * (worker.goldPerHour || PORT_WORKER_GOLD_PER_HOUR);
  const availCash = Math.max(0, prod.facilityBalanceGold || 0);
  const goldEarned = availCash >= requestedWage ? requestedWage : availCash;

  // Списываем зарплату строго из Кассы завода
  prod.facilityBalanceGold = Math.max(0, availCash - goldEarned);

  // Удаляем работника из активного слота после завершения смены
  prod.workers.splice(workerIdx, 1);

  // За каждый час смены производство выпускает продукцию по своей схеме (если прочность > 0 и есть энергия)
  let relicsCraftedNow = 0;
  const tier = prod.productionTier || (prod.productionStage === 'extraction' ? 1 : 2);
  const baseOutRate = Math.max(1, prod.outputRatePerHour || (tier === 1 ? 4 : 1));
  const lvlCfg = getPortFacilityLevelConfig(prod.facilityLevel);
  const domBonus = doesSectorBuildingHaveDominanceBonus(sector);
  const outMult = lvlCfg.outputMultiplier * (prod.isMerged ? 1.5 : 1) * (domBonus ? 1.15 : 1);
  const outRate = Math.max(1, Math.round(baseOutRate * outMult));
  const hasIn2 = Boolean(prod.input2ResourceKey);
  const hasIn3 = Boolean(prod.input3ResourceKey);
  const baseReqPwr = prod.powerRequiredPerCycle ?? 0;
  const reqPwr = baseReqPwr > 0 && domBonus ? Math.max(1, Math.floor(baseReqPwr * 0.8)) : baseReqPwr;

  if ((prod.buildingDurability ?? 100) > 0) {
    for (let i = 0; i < hoursWorked; i++) {
      if (tier === 1 || prod.productionStage === 'extraction') {
        if (prod.relicStock < prod.maxRelicStock) {
          const added = Math.min(outRate, prod.maxRelicStock - prod.relicStock);
          prod.relicStock += added;
          prod.totalRelicsCrafted = (prod.totalRelicsCrafted || 0) + added;
          relicsCraftedNow += added;
        }
      } else {
        const req1 = prod.input1RequiredPerCycle ?? 2;
        const req2 = hasIn2 ? (prod.input2RequiredPerCycle ?? 2) : 0;
        const req3 = hasIn3 ? (prod.input3RequiredPerCycle ?? 1) : 0;
        const cur1 = prod.input1Stock ?? prod.fishStock ?? 0;
        const cur2 = hasIn2 ? (prod.input2Stock ?? 0) : 0;
        const cur3 = hasIn3 ? (prod.input3Stock ?? 0) : 0;
        const curPwr = prod.powerStock ?? 0;
        if (
          cur1 >= req1 &&
          (!hasIn2 || cur2 >= req2) &&
          (!hasIn3 || cur3 >= req3) &&
          (reqPwr <= 0 || curPwr >= reqPwr) &&
          prod.relicStock < prod.maxRelicStock
        ) {
          const next1 = Math.max(0, cur1 - req1);
          prod.input1Stock = next1;
          prod.fishStock = next1;
          if (hasIn2) prod.input2Stock = Math.max(0, cur2 - req2);
          if (hasIn3) prod.input3Stock = Math.max(0, cur3 - req3);
          if (reqPwr > 0) prod.powerStock = Math.max(0, curPwr - reqPwr);
          const added = Math.min(outRate, prod.maxRelicStock - prod.relicStock);
          prod.relicStock += added;
          prod.processedStock = prod.relicStock;
          prod.totalRelicsCrafted = (prod.totalRelicsCrafted || 0) + added;
          relicsCraftedNow += added;
        }
      }
    }
  }
  prod.lastCraftTickAt = now;

  // Запись в протокол работы и протокол кассы
  appendPortWorkProtocol(prod, {
    timestamp: now,
    playerNick,
    hoursWorked,
    goldPaid: goldEarned
  });
  appendPortDealProtocol(prod, {
    timestamp: now,
    actorNick: playerNick,
    actionType: 'wage_payout',
    resourceName: `Смена (${hoursWorked} ч.)`,
    quantity: hoursWorked,
    goldAmount: -goldEarned,
    note: `Выплата зарплаты из кассы объекта${relicsCraftedNow > 0 ? `, выпуск +${relicsCraftedNow} шт.` : ''}`
  });

  // Пассивная прибыль клану-владельцу от работы производства
  let passiveClanGold = 0;
  if (sector.ownerClanId) {
    const ownerClan = inMemoryClans.find((c) => c.id === sector.ownerClanId);
    if (ownerClan) {
      passiveClanGold = hoursWorked * 120;
      ownerClan.treasuryGold = (ownerClan.treasuryGold || 0) + passiveClanGold;
      prod.passiveGoldEarned = (prod.passiveGoldEarned || 0) + passiveClanGold;
      addClanLogEntry(
        ownerClan,
        playerNick,
        'port_production',
        `Работник ${playerNick} отработал смену (${hoursWorked} ч.) на «${sector.name}». Казна клана получила +${passiveClanGold} 🪙 пассивной прибыли${
          relicsCraftedNow > 0 ? `, произведено +${relicsCraftedNow} ед. «${prod.outputProductName}»` : ''
        }!`,
        '🏭'
      );
    }
  }

  saveClansToSupabase();

  return {
    ok: true,
    goldEarned,
    hoursWorked,
    passiveClanGold,
    relicsCraftedNow,
    sector,
    message: `✅ Смена (${hoursWorked} ч.) на «${sector.name}» завершена! Вы получили +${goldEarned.toLocaleString()} 🪙 из кассы завода и +${hoursWorked} ч. к навыку «Производство»${
      relicsCraftedNow > 0 ? ` (выпущено +${relicsCraftedNow} ед. «${prod.outputProductName}»)` : ''
    }!`
  };
}

export function sellFishToPortMarket(
  playerNick: string,
  fishCount: number
): { ok: boolean; goldEarned: number; skillHoursAdded: number; market: PortFishMarketState; message: string } {
  const qty = Math.max(1, Math.floor(Number(fishCount) || 0));
  const terminal = loadPortTradingTerminal();
  const market = loadPortFishMarket();
  // По ТЗ v1.1.97:
  // Вся пойманная рыба из Садка поставляется на склады Рыбных комбинатов в Порту,
  // выплачивая игроку по 50 🪙 за 1 рыбу из кассы завода (за 20 рыб = 1 000 🪙) и заполняя склад завода сырьем!
  const unitPrice = 50;
  const goldEarned = qty * unitPrice;
  market.fishStock += qty;
  market.fishPriceGold = unitPrice;
  market.totalFishTraded += qty;
  terminal.stocks.raw_fish = Math.max(0, (terminal.stocks.raw_fish || 0) + qty);
  terminal.totalSold = (terminal.totalSold || 0) + qty;

  // Пополняем склад сырья Рыбных комбинатов в Порту и списываем выплату из кассы завода
  try {
    const sectors = ensureTerritoriesLoaded();
    const canneries = sectors.filter(
      (s) =>
        s.id === 'sector_fish_cannery' ||
        s.id === 'sector_nile_oasis' ||
        s.production?.factoryType === 'fish_cannery' ||
        s.production?.input1ResourceKey === 'raw_fish'
    );
    const targetCanneries = canneries.length > 0 ? canneries : sectors.slice(0, 1);
    targetCanneries.forEach((cannery, idx) => {
      if (cannery && cannery.production) {
        const prod = normalizeSectorProduction(cannery);
        const maxCap = Math.max(100, Number(prod.maxFishStock || 500));
        if (idx === 0) {
          prod.fishStock = Math.min(maxCap, Math.max(0, Number(prod.fishStock || 0)) + qty);
          prod.input1Stock = prod.fishStock;
          const curCash = Number(prod.facilityBalanceGold ?? 25000);
          prod.facilityBalanceGold = Math.max(5000, curCash - goldEarned);
          appendPortDealProtocol(prod, {
            timestamp: Date.now(),
            timeStr: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            actorNick: playerNick || 'Рыбак',
            actionType: 'sell_input',
            resourceName: 'Сырая рыба (Садок)',
            quantity: qty,
            goldAmount: goldEarned,
            text: `Рыбак ${playerNick || 'Игрок'} сдал ${qty} шт. рыбы на склад Рыбного комбината за ${goldEarned.toLocaleString('ru-RU')} 🪙 (по 50 🪙/шт. из кассы завода)`
          });
        }
        cannery.production = prod;
      }
    });
    saveClansToSupabase();
  } catch {}

  const skillHoursAdded = Math.max(1, Math.ceil(qty / 5));
  savePortTradingTerminal();
  savePortFishMarket();
  return {
    ok: true,
    goldEarned,
    skillHoursAdded,
    market,
    message: `🏭 Улов (${qty} шт.) доставлен на склад Рыбного комбината в Порту! Выплачено из кассы завода: +${goldEarned.toLocaleString('ru-RU')} 🪙 (по 50 🪙/шт.) и +${skillHoursAdded} ед. к навыку «Производство»!`
  };
}

export function loadFishIntoPortFactory(
  sectorId: string,
  actorNick: string,
  requestedQty: number,
  source: 'market' | 'keepnet',
  availableGold = 0,
  availableKeepnetFish = 0
): {
  ok: boolean;
  loadedQty?: number;
  goldSpent?: number;
  sector?: ClanTerritorySector;
  market?: PortFishMarketState;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект производства не найден.' };

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  const freeSpace = Math.max(0, prod.maxFishStock - prod.fishStock);
  if (freeSpace <= 0) {
    return {
      ok: false,
      error: `Склад сырья «${sector.name}» полностью заполнен (${prod.fishStock}/${prod.maxFishStock} рыбин)!`
    };
  }

  const terminal = loadPortTradingTerminal();
  const market = loadPortFishMarket();
  const qty = Math.max(1, Math.min(freeSpace, Math.floor(Number(requestedQty) || 1)));

  if (source === 'keepnet') {
    if (availableKeepnetFish < qty) {
      return { ok: false, error: `В вашем садке недостаточно рыбы (доступно: ${availableKeepnetFish} шт.).` };
    }
    prod.fishStock += qty;
    prod.input1Stock = prod.fishStock;
    saveClansToSupabase();
    return {
      ok: true,
      loadedQty: qty,
      goldSpent: 0,
      sector,
      market,
      message: `🐟 Вы загрузили ${qty} рыбин напрямую из своего садка на склад «${sector.name}» (${prod.fishStock}/${prod.maxFishStock} шт.)!`
    };
  }

  // Закупка с Торгового терминала / Рыбного рынка Порта по цене закупки сырья объекта
  const availFish = Math.max(market.fishStock, terminal.stocks.raw_fish || 0);
  if (availFish < qty) {
    return {
      ok: false,
      error: `В Торговом терминале Порта сейчас только ${availFish} шт. рыбы!`
    };
  }

  const unitBuyPrice = Math.max(10, Number(prod.rawBuyPriceGold || market.fishPriceGold || PORT_DEFAULT_FISH_MARKET_PRICE));
  const totalCost = qty * unitBuyPrice;
  if (availableGold < totalCost) {
    return {
      ok: false,
      error: `Недостаточно золота для закупки ${qty} рыбин! Требуется ${totalCost.toLocaleString()} 🪙 (${unitBuyPrice} 🪙/шт.).`
    };
  }

  market.fishStock = Math.max(0, availFish - qty);
  terminal.stocks.raw_fish = market.fishStock;
  terminal.totalBought = (terminal.totalBought || 0) + qty;
  prod.fishStock += qty;
  prod.input1Stock = prod.fishStock;
  savePortTradingTerminal();
  savePortFishMarket();
  saveClansToSupabase();

  return {
    ok: true,
    loadedQty: qty,
    goldSpent: totalCost,
    sector,
    market,
    message: `📦 Закуплено и завезено ${qty} рыбин с Торгового терминала на склад «${sector.name}» за ${totalCost.toLocaleString()} 🪙 (по ${unitBuyPrice} 🪙/шт., склад: ${prod.fishStock}/${prod.maxFishStock} шт.)!`
  };
}

export function craftRelicsAtPortFactoryNow(
  sectorId: string,
  actorNick: string
): {
  ok: boolean;
  craftedCount?: number;
  fishUsed?: number;
  sector?: ClanTerritorySector;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект производства не найден.' };

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  if ((prod.buildingDurability ?? 100) <= 0) {
    return {
      ok: false,
      error: `🛠️ Объект «${sector.name}» сломан (Прочность: 0/100)! Сначала отремонтируйте здание.`
    };
  }

  const now = Date.now();
  const activeWorkers = prod.workers.filter((w) => !w.claimed && w.endsAt > now);
  const lvlCfg = getPortFacilityLevelConfig(prod.facilityLevel);
  const domBonus = doesSectorBuildingHaveDominanceBonus(sector);
  if (activeWorkers.length === 0) {
    return {
      ok: false,
      error: `⏸ Цех «${sector.name}» остановлен! На объекте сейчас никто не работает (активных работников: 0/${
        prod.isMerged ? Math.max(PORT_MERGED_MAX_WORKERS, lvlCfg.maxWorkers) : lvlCfg.maxWorkers
      }). Устройтесь на рабочую смену (2 ч.), чтобы запустить производство!`
    };
  }

  const tier = prod.productionTier || (prod.productionStage === 'extraction' ? 1 : 2);
  const baseOutRate = Math.max(1, prod.outputRatePerHour || (tier === 1 ? 4 : 1));
  const outMult = lvlCfg.outputMultiplier * (prod.isMerged ? 1.5 : 1) * (domBonus ? 1.15 : 1);
  const outRate = Math.max(1, Math.round(baseOutRate * outMult));
  const outName = prod.outputProductName || 'Продукция';
  const hasIn2 = Boolean(prod.input2ResourceKey);
  const hasIn3 = Boolean(prod.input3ResourceKey);
  const baseReqPwr = prod.powerRequiredPerCycle ?? 0;
  const reqPwr = baseReqPwr > 0 && domBonus ? Math.max(1, Math.floor(baseReqPwr * 0.8)) : baseReqPwr;

  if (prod.relicStock >= prod.maxRelicStock) {
    return {
      ok: false,
      error: `Склад готовой продукции «${outName}» заполнен до предела (${prod.relicStock}/${prod.maxRelicStock} шт.)!`
    };
  }

  if (tier === 1 || prod.productionStage === 'extraction') {
    const added = Math.min(outRate, prod.maxRelicStock - prod.relicStock);
    prod.relicStock += added;
    prod.totalRelicsCrafted = (prod.totalRelicsCrafted || 0) + added;
    prod.lastCraftTickAt = now;
    saveClansToSupabase();
    return {
      ok: true,
      craftedCount: added,
      fishUsed: 0,
      sector,
      message: `⛏️ Добыча на «${sector.name}» выполнена: +${added} ед. «${outName}»!`
    };
  }

  const req1 = prod.input1RequiredPerCycle ?? 2;
  const req2 = hasIn2 ? (prod.input2RequiredPerCycle ?? 2) : 0;
  const req3 = hasIn3 ? (prod.input3RequiredPerCycle ?? 1) : 0;
  const cur1 = prod.input1Stock ?? prod.fishStock ?? 0;
  const cur2 = hasIn2 ? (prod.input2Stock ?? 0) : 0;
  const cur3 = hasIn3 ? (prod.input3Stock ?? 0) : 0;
  const curPwr = prod.powerStock ?? 0;

  if (reqPwr > 0 && curPwr < reqPwr) {
    return {
      ok: false,
      error: `⚡ На энергосети объекта «${sector.name}» недостаточно Мощности (нужно ${reqPwr} кВт/ч, в наличии: ${curPwr} кВт)! Закупите Мощность на Электростанции [5/5].`
    };
  }

  if (cur1 < req1 || (hasIn2 && cur2 < req2) || (hasIn3 && cur3 < req3)) {
    return {
      ok: false,
      error: `⚠️ На складе «${sector.name}» недостаточно входящих ресурсов для выпуска «${outName}»!`
    };
  }

  const next1 = Math.max(0, cur1 - req1);
  prod.input1Stock = next1;
  prod.fishStock = next1;
  if (hasIn2) prod.input2Stock = Math.max(0, cur2 - req2);
  if (hasIn3) prod.input3Stock = Math.max(0, cur3 - req3);
  if (reqPwr > 0) prod.powerStock = Math.max(0, curPwr - reqPwr);

  const added = Math.min(outRate, prod.maxRelicStock - prod.relicStock);
  prod.relicStock += added;
  prod.processedStock = prod.relicStock;
  prod.totalRelicsCrafted = (prod.totalRelicsCrafted || 0) + added;
  prod.lastCraftTickAt = now;

  saveClansToSupabase();

  return {
    ok: true,
    craftedCount: added,
    fishUsed: 0,
    sector,
    message: `⚙️ Производственный цикл на «${sector.name}» завершён: выпущено +${added} ед. «${outName}»!`
  };
}

export function loadDualInputIntoPortFactory(
  sectorId: string,
  actorNick: string,
  slot: 1 | 2,
  requestedQty: number,
  source: 'terminal' | 'bag',
  heroGold = 0,
  bagQtyAvailable = 0
): {
  ok: boolean;
  loadedQty?: number;
  goldSpent?: number;
  resourceKey?: PortTerminalResourceKey;
  sector?: ClanTerritorySector;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект недвижимости не найден.' };

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  const resKey: PortTerminalResourceKey =
    slot === 1
      ? prod.input1ResourceKey || 'gold_ingots'
      : prod.input2ResourceKey || 'fish_semifinished';
  const resName =
    slot === 1
      ? prod.input1ResourceName || 'Золотые слитки'
      : prod.input2ResourceName || 'Рыбный паштет';
  const curStock = slot === 1 ? (prod.input1Stock ?? 0) : (prod.input2Stock ?? 0);
  const maxStock =
    slot === 1
      ? (prod.maxInput1Stock ?? PORT_BASE_MAX_FISH_STOCK)
      : (prod.maxInput2Stock ?? PORT_BASE_MAX_FISH_STOCK);

  const freeSpace = Math.max(0, maxStock - curStock);
  if (freeSpace <= 0) {
    return {
      ok: false,
      error: `Склад Входа #${slot} («${resName}») на «${sector.name}» уже заполнен (${curStock}/${maxStock} ед.)!`
    };
  }

  const qty = Math.max(1, Math.min(freeSpace, Math.floor(Number(requestedQty) || 5)));

  if (source === 'bag') {
    if (bagQtyAvailable < qty) {
      return {
        ok: false,
        error: `На вашем личном складе недостаточно компонента «${resName}» (в наличии: ${bagQtyAvailable} ед., купите в Торговом терминале)!`
      };
    }
    if (slot === 1) {
      prod.input1Stock = curStock + qty;
    } else {
      prod.input2Stock = curStock + qty;
    }
    saveClansToSupabase();
    return {
      ok: true,
      loadedQty: qty,
      goldSpent: 0,
      resourceKey: resKey,
      sector,
      message: `📦 Вы загрузили ${qty} ед. «${resName}» со своего склада во Вход #${slot} на «${sector.name}» (${
        slot === 1 ? prod.input1Stock : prod.input2Stock
      }/${maxStock})!`
    };
  }

  // Закупка напрямую с Торгового терминала Порта
  const terminal = loadPortTradingTerminal();
  const meta = PORT_TERMINAL_CATALOG.find((m) => m.key === resKey);
  const unitPrice = meta?.buyPriceGold || 100;
  const availTerm = Math.max(0, Number(terminal.stocks[resKey] ?? PORT_TERMINAL_INITIAL_STOCK));
  if (availTerm < qty) {
    return {
      ok: false,
      error: `На Торговом терминале Порта недостаточно «${resName}» (осталось: ${availTerm} ед.)!`
    };
  }

  const totalCost = qty * unitPrice;
  if (heroGold < totalCost) {
    return {
      ok: false,
      error: `Недостаточно золота для закупки ${qty} ед. «${resName}» с терминала! Требуется ${totalCost.toLocaleString()} 🪙 (${unitPrice} 🪙/ед.).`
    };
  }

  terminal.stocks[resKey] = availTerm - qty;
  terminal.totalBought = (terminal.totalBought || 0) + qty;
  if (slot === 1) {
    prod.input1Stock = curStock + qty;
  } else {
    prod.input2Stock = curStock + qty;
  }
  savePortTradingTerminal();
  saveClansToSupabase();

  return {
    ok: true,
    loadedQty: qty,
    goldSpent: totalCost,
    resourceKey: resKey,
    sector,
    message: `🚛 Закуплено на Торговом терминале и загружено во Вход #${slot} («${sector.name}»): +${qty} ед. «${resName}» за ${totalCost.toLocaleString()} 🪙!`
  };
}

export function supplyIntermediateResourceToLinkedFactory(
  sectorId: string,
  actorNick: string,
  requestedQty = 5
): {
  ok: boolean;
  transferredQty?: number;
  sector?: ClanTerritorySector;
  partnerSector?: ClanTerritorySector;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект производства не найден.' };

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  const partner = prod.linkedSectorId ? sectors.find((s) => s.id === prod.linkedSectorId) : undefined;
  if (!partner) {
    return { ok: false, error: 'У этого объекта нет связанного смежного цеха.' };
  }
  const partnerProd = normalizeSectorProduction(partner);
  partner.production = partnerProd;

  // Определяем поставщика (raw_processing) и получателя (relic_foundry)
  const supplier = prod.productionStage === 'raw_processing' ? sector : partner;
  const consumer = prod.productionStage === 'raw_processing' ? partner : sector;
  const supProd = normalizeSectorProduction(supplier);
  const conProd = normalizeSectorProduction(consumer);
  supplier.production = supProd;
  consumer.production = conProd;

  const avail = supProd.processedStock || 0;
  if (avail <= 0) {
    return {
      ok: false,
      error: `На складе поставщика «${supplier.name}» нет готового промежуточного сырья «${supProd.intermediateResourceName}»!`
    };
  }

  const maxCon = conProd.maxProcessedStock || PORT_BASE_MAX_FISH_STOCK;
  const freeSpace = Math.max(0, maxCon - (conProd.processedStock || 0));
  if (freeSpace <= 0) {
    return {
      ok: false,
      error: `Склад промежуточного сырья в «${consumer.name}» уже заполнен (${conProd.processedStock}/${maxCon} ед.)!`
    };
  }

  const qty = Math.max(1, Math.min(avail, freeSpace, Math.floor(Number(requestedQty) || 5)));
  supProd.processedStock = Math.max(0, avail - qty);
  conProd.processedStock = Math.min(maxCon, (conProd.processedStock || 0) + qty);

  saveClansToSupabase();

  return {
    ok: true,
    transferredQty: qty,
    sector,
    partnerSector: partner,
    message: `🚛 Поставка выполнена! Перевезено ${qty} ед. «${supProd.intermediateResourceName}» из «${supplier.name}» в конечный цех «${consumer.name}»!`
  };
}

export function managePortFacilityBalance(
  sectorId: string,
  actorNick: string,
  mode: 'deposit' | 'withdraw',
  amountGold: number,
  actorCurrentGold: number
): {
  ok: boolean;
  deltaHeroGold?: number;
  newFacilityBalance?: number;
  sector?: ClanTerritorySector;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект недвижимости не найден.' };

  const ownerClean = (sector.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim().toLowerCase();
  if (actorNick.trim().toLowerCase() !== ownerClean && actorNick.trim().toLowerCase() !== 'admin') {
    return {
      ok: false,
      error: `Управлять кассой и балансом объекта может только официальный владелец (${sector.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK})!`
    };
  }

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;
  const qty = Math.max(1, Math.floor(Number(amountGold) || 0));

  if (mode === 'deposit') {
    if (actorCurrentGold < qty) {
      return { ok: false, error: `У вас недостаточно личного золота для пополнения кассы объекта (${qty.toLocaleString()} 🪙).` };
    }
    prod.facilityBalanceGold = (prod.facilityBalanceGold || 0) + qty;
    appendPortDealProtocol(prod, {
      timestamp: Date.now(),
      actorNick,
      actionType: 'owner_deposit',
      resourceName: 'Касса объекта',
      quantity: 1,
      goldAmount: qty,
      note: `Пополнение кассы владельцем (+${qty.toLocaleString()} 🪙)`
    });
    saveClansToSupabase();
    return {
      ok: true,
      deltaHeroGold: -qty,
      newFacilityBalance: prod.facilityBalanceGold,
      sector,
      message: `🏦 Вы пополнили кассу объекта «${sector.name}» на +${qty.toLocaleString()} 🪙 (текущий баланс кассы: ${prod.facilityBalanceGold.toLocaleString()} 🪙).`
    };
  } else {
    const curBal = prod.facilityBalanceGold || 0;
    if (curBal < qty) {
      return { ok: false, error: `В кассе объекта «${sector.name}» доступно только ${curBal.toLocaleString()} 🪙.` };
    }
    prod.facilityBalanceGold = curBal - qty;
    appendPortDealProtocol(prod, {
      timestamp: Date.now(),
      actorNick,
      actionType: 'owner_withdraw',
      resourceName: 'Инкассация выручки',
      quantity: 1,
      goldAmount: -qty,
      note: `Снятие выручки владельцем (-${qty.toLocaleString()} 🪙)`
    });
    saveClansToSupabase();
    return {
      ok: true,
      deltaHeroGold: qty,
      newFacilityBalance: prod.facilityBalanceGold,
      sector,
      message: `💰 Инкассация выполнена: вы сняли +${qty.toLocaleString()} 🪙 выручки из кассы объекта «${sector.name}» (остаток в кассе: ${prod.facilityBalanceGold.toLocaleString()} 🪙).`
    };
  }
}

export function buyRelicsFromPortFactory(
  sectorId: string,
  buyerNick: string,
  requestedQty: number,
  buyerGold: number
): {
  ok: boolean;
  boughtQty?: number;
  totalCostGold?: number;
  unitPriceGold?: number;
  clanTaxGold?: number;
  ownerRevenueGold?: number;
  outputResourceKey?: PortTerminalResourceKey;
  sector?: ClanTerritorySector;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект производства не найден.' };

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  const qty = Math.max(1, Math.floor(Number(requestedQty) || 1));
  const outName = prod.outputProductName || 'Реликвии Порта';
  const outKey: PortTerminalResourceKey = prod.outputResourceKey || 'port_relics';
  if (prod.relicStock < qty) {
    return {
      ok: false,
      error: `На складе производства «${sector.name}» сейчас только ${prod.relicStock} шт. готовой продукции («${outName}»)!`
    };
  }

  // Цена продажи готовой продукции устанавливается владельцем объекта
  const unitPriceGold = Math.max(10, Number(prod.productSellPriceGold || getPortRelicMarketPrice()));
  const totalCostGold = qty * unitPriceGold;

  if (buyerGold < totalCostGold) {
    return {
      ok: false,
      error: `Недостаточно золота! Стоимость ${qty} ед. «${outName}» составляет ${totalCostGold.toLocaleString()} 🪙 (${unitPriceGold} 🪙/шт.).`
    };
  }

  // Расчет себестоимости, чистой прибыли и авто-налога клану (10% от чистой прибыли)
  const unitSelfCost = calculatePortFacilityUnitSelfCost(prod);
  const netProfitPerUnit = Math.max(0, unitPriceGold - unitSelfCost);
  const totalNetProfit = netProfitPerUnit * qty;
  const clanTaxGold = sector.ownerClanId ? Math.max(1, Math.round(totalNetProfit * 0.1)) : 0;
  const ownerRevenueGold = Math.max(0, totalCostGold - clanTaxGold);

  prod.relicStock -= qty;
  prod.processedStock = prod.relicStock;
  prod.passiveGoldEarned = (prod.passiveGoldEarned || 0) + ownerRevenueGold;
  prod.facilityBalanceGold = (prod.facilityBalanceGold || 0) + ownerRevenueGold;
  const market = loadPortFishMarket();
  market.totalRelicsSold = (market.totalRelicsSold || 0) + qty;
  savePortFishMarket();

  const now = Date.now();
  appendPortDealProtocol(prod, {
    timestamp: now,
    actorNick: buyerNick,
    actionType: 'buy_product',
    resourceName: outName,
    quantity: qty,
    goldAmount: ownerRevenueGold,
    clanTaxGold,
    note: `Покупка продукции (${unitPriceGold} 🪙/шт.). В кассу: +${ownerRevenueGold} 🪙, налог клану (10%): +${clanTaxGold} 🪙`
  });

  if (sector.ownerClanId) {
    const ownerClan = inMemoryClans.find((c) => c.id === sector.ownerClanId);
    if (ownerClan) {
      ownerClan.treasuryGold = (ownerClan.treasuryGold || 0) + clanTaxGold;
      addClanLogEntry(
        ownerClan,
        buyerNick,
        'port_production',
        `Игрок ${buyerNick} купил ${qty} шт. «${outName}» на объекте «${sector.name}». Авто-налог клану (10% от прибыли): +${clanTaxGold.toLocaleString()} 🪙 в казну клана (в кассу владельца: +${ownerRevenueGold.toLocaleString()} 🪙)!`,
        prod.outputProductIcon || '🏺'
      );
    }
  }

  saveClansToSupabase();

  return {
    ok: true,
    boughtQty: qty,
    totalCostGold,
    unitPriceGold,
    clanTaxGold,
    ownerRevenueGold,
    outputResourceKey: outKey,
    sector,
    message: `${prod.outputProductIcon || '🏺'} Вы купили ${qty} шт. «${outName}» со склада «${sector.name}» за ${totalCostGold.toLocaleString()} 🪙 (${unitPriceGold} 🪙/шт. | В кассу: +${ownerRevenueGold} 🪙, налог клану 10%: +${clanTaxGold} 🪙)!`
  };
}

export function sellResourceToPortFactory(
  sectorId: string,
  sellerNick: string,
  slot: 1 | 2 | 3 | 'power',
  requestedQty: number,
  bagQtyAvailable: number
): {
  ok: boolean;
  soldQty?: number;
  goldEarned?: number;
  unitBuyPriceGold?: number;
  resourceKey?: PortTerminalResourceKey;
  sector?: ClanTerritorySector;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект недвижимости не найден.' };

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  if (slot === 'power') {
    const reqPwr = prod.powerRequiredPerCycle ?? 0;
    if (reqPwr <= 0) {
      return { ok: false, error: 'Этот объект не потребляет Мощность (кВт).' };
    }
    const curPwr = prod.powerStock ?? 0;
    const maxPwr = prod.maxPowerStock ?? 200;
    const freePwr = Math.max(0, maxPwr - curPwr);
    if (freePwr <= 0) {
      return {
        ok: false,
        error: `Энергосеть объекта «${sector.name}» уже полностью заряжена (${curPwr}/${maxPwr} кВт)!`
      };
    }
    const qtyPwr = Math.max(1, Math.min(freePwr, Math.floor(Number(requestedQty) || 1)));
    if (bagQtyAvailable < qtyPwr) {
      return {
        ok: false,
        error: `У вас недостаточно Мощности (кВт) (в наличии: ${bagQtyAvailable} кВт, требуется: ${qtyPwr} кВт)! Купите Мощность на Электростанции [5/5].`
      };
    }
    const unitPricePwr = Math.max(10, Math.floor(Number(prod.powerBuyPriceGold || 70)));
    const totalPayoutPwr = qtyPwr * unitPricePwr;
    if ((prod.facilityBalanceGold || 0) < totalPayoutPwr) {
      return {
        ok: false,
        error: `[Нет средств] В кассе завода «${sector.name}» недостаточно золота для оплаты ${qtyPwr} кВт Мощности (нужно ${totalPayoutPwr.toLocaleString()} 🪙, в кассе: ${(prod.facilityBalanceGold || 0).toLocaleString()} 🪙)!`
      };
    }
    prod.facilityBalanceGold = Math.max(0, (prod.facilityBalanceGold || 0) - totalPayoutPwr);
    prod.powerStock = curPwr + qtyPwr;
    appendPortDealProtocol(prod, {
      timestamp: Date.now(),
      actorNick: sellerNick,
      actionType: 'sell_resource',
      resourceName: 'Мощность (кВт)',
      quantity: qtyPwr,
      goldAmount: -totalPayoutPwr,
      note: `Поставка энергии по ${unitPricePwr} 🪙/кВт`
    });
    saveClansToSupabase();
    return {
      ok: true,
      soldQty: qtyPwr,
      goldEarned: totalPayoutPwr,
      unitBuyPriceGold: unitPricePwr,
      resourceKey: 'power_kw',
      sector,
      message: `⚡ Вы поставили ${qtyPwr} кВт «Мощности» на энергосеть «${sector.name}» и получили +${totalPayoutPwr.toLocaleString()} 🪙 из кассы объекта (${unitPricePwr} 🪙/кВт)!`
    };
  }

  const tier = prod.productionTier || (prod.productionStage === 'extraction' ? 1 : prod.requiresDualInput ? 3 : 2);
  if (tier === 1 || prod.productionStage === 'extraction') {
    return { ok: false, error: 'Добывающий объект не закупает входящие ресурсы.' };
  }

  const resKey: PortTerminalResourceKey =
    slot === 1
      ? prod.input1ResourceKey || 'raw_fish'
      : slot === 2
      ? prod.input2ResourceKey || 'fish_semifinished'
      : prod.input3ResourceKey || 'alchemy_reagents';
  const resName =
    slot === 1
      ? prod.input1ResourceName || 'Сырая рыба'
      : slot === 2
      ? prod.input2ResourceName || 'Рыбный паштет'
      : prod.input3ResourceName || 'Алхимический реагент';
  const curStock =
    slot === 1
      ? prod.input1Stock ?? prod.fishStock ?? 0
      : slot === 2
      ? prod.input2Stock ?? 0
      : prod.input3Stock ?? 0;
  const maxStock =
    slot === 1
      ? prod.maxInput1Stock ?? prod.maxFishStock ?? PORT_BASE_MAX_FISH_STOCK
      : slot === 2
      ? prod.maxInput2Stock ?? PORT_BASE_MAX_FISH_STOCK
      : prod.maxInput3Stock ?? PORT_BASE_MAX_FISH_STOCK;

  const freeSpace = Math.max(0, maxStock - curStock);
  if (freeSpace <= 0) {
    return {
      ok: false,
      error: `Склад ресурса «${resName}» на объекте «${sector.name}» уже заполнен (${curStock}/${maxStock} ед.)!`
    };
  }

  const qty = Math.max(1, Math.min(freeSpace, Math.floor(Number(requestedQty) || 1)));
  if (bagQtyAvailable < qty) {
    return {
      ok: false,
      error: `У вас в рюкзаке недостаточно «${resName}» (в наличии: ${bagQtyAvailable} ед., требуется: ${qty} ед.)! Купите ресурс на Торговом терминале или на добывающем объекте.`
    };
  }

  const unitPrice = Math.max(
    10,
    Math.floor(
      Number(
        slot === 1
          ? prod.rawBuyPriceGold || PORT_DEFAULT_FISH_MARKET_PRICE
          : slot === 2
          ? prod.input2BuyPriceGold || prod.rawBuyPriceGold || 95
          : prod.input3BuyPriceGold || 150
      )
    )
  );
  const totalPayout = qty * unitPrice;

  if ((prod.facilityBalanceGold || 0) < totalPayout) {
    return {
      ok: false,
      error: `[Нет средств] В кассе завода «${sector.name}» недостаточно золота для скупки ${qty} ед. «${resName}» (нужно ${totalPayout.toLocaleString()} 🪙, в кассе: ${(prod.facilityBalanceGold || 0).toLocaleString()} 🪙)!`
    };
  }

  prod.facilityBalanceGold = Math.max(0, (prod.facilityBalanceGold || 0) - totalPayout);
  if (slot === 1) {
    prod.input1Stock = curStock + qty;
    prod.fishStock = curStock + qty;
  } else if (slot === 2) {
    prod.input2Stock = curStock + qty;
  } else {
    prod.input3Stock = curStock + qty;
  }

  appendPortDealProtocol(prod, {
    timestamp: Date.now(),
    actorNick: sellerNick,
    actionType: 'sell_resource',
    resourceName: resName,
    quantity: qty,
    goldAmount: -totalPayout,
    note: `Скупка сырья у игрока по ${unitPrice} 🪙/шт.`
  });

  saveClansToSupabase();

  return {
    ok: true,
    soldQty: qty,
    goldEarned: totalPayout,
    unitBuyPriceGold: unitPrice,
    resourceKey: resKey,
    sector,
    message: `💰 Вы продали ${qty} ед. «${resName}» заводу «${sector.name}» и получили +${totalPayout.toLocaleString()} 🪙 из кассы объекта (${unitPrice} 🪙/шт.)!`
  };
}

export function orderMealAtPortTavern(
  sectorId: string,
  playerNick: string,
  portions: number,
  heroGold: number,
  currentStamina: number
): {
  ok: boolean;
  portionsBought?: number;
  totalCostGold?: number;
  newStamina?: number;
  staminaRestored?: number;
  clanTaxGold?: number;
  ownerRevenueGold?: number;
  sector?: ClanTerritorySector;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Портовая Таверна не найдена.' };

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  if ((prod.buildingDurability ?? 100) <= 0) {
    return { ok: false, error: `🛠️ Таверна «${sector.name}» сломана (0/100) и временно закрыта на ремонт!` };
  }

  const curStam = Math.max(0, Math.min(100, Math.floor(Number(currentStamina ?? 100))));
  if (curStam >= 100) {
    return { ok: false, error: 'У вас уже максимальная бодрость (100%)!' };
  }

  const reqPortions = Math.max(1, Math.min(4, Math.floor(Number(portions) || 1)));
  if (prod.relicStock < reqPortions) {
    return {
      ok: false,
      error: `На кухне Таверны «${sector.name}» осталось только ${prod.relicStock} порций обеда! Завезите Рыбный паштет для приготовления новых порций.`
    };
  }

  const unitPrice = Math.max(50, Math.floor(Number(prod.productSellPriceGold || 300)));
  const totalCostGold = reqPortions * unitPrice;
  if (heroGold < totalCostGold) {
    return {
      ok: false,
      error: `Недостаточно золота для заказа ${reqPortions} порц. обеда! Нужно ${totalCostGold.toLocaleString()} 🪙 (${unitPrice} 🪙/порция).`
    };
  }

  const unitSelfCost = calculatePortFacilityUnitSelfCost(prod);
  const netProfit = Math.max(0, (unitPrice - unitSelfCost) * reqPortions);
  const clanTaxGold = sector.ownerClanId ? Math.max(1, Math.round(netProfit * 0.1)) : 0;
  const ownerRevenueGold = Math.max(0, totalCostGold - clanTaxGold);

  prod.relicStock = Math.max(0, prod.relicStock - reqPortions);
  prod.processedStock = prod.relicStock;
  prod.facilityBalanceGold = (prod.facilityBalanceGold || 0) + ownerRevenueGold;
  prod.passiveGoldEarned = (prod.passiveGoldEarned || 0) + ownerRevenueGold;

  if (sector.ownerClanId) {
    const ownerClan = inMemoryClans.find((c) => c.id === sector.ownerClanId);
    if (ownerClan) {
      ownerClan.treasuryGold = (ownerClan.treasuryGold || 0) + clanTaxGold;
    }
  }

  const newStamina = Math.min(100, curStam + reqPortions * 25);
  const staminaRestored = newStamina - curStam;

  appendPortDealProtocol(prod, {
    timestamp: Date.now(),
    actorNick: playerNick,
    actionType: 'tavern_meal',
    resourceName: 'Обед Таверны (+25% бодрости)',
    quantity: reqPortions,
    goldAmount: ownerRevenueGold,
    clanTaxGold,
    note: `Заказ обеда в Таверне (+${staminaRestored}% бодрости). В кассу: +${ownerRevenueGold} 🪙, налог клану: +${clanTaxGold} 🪙`
  });

  saveClansToSupabase();

  return {
    ok: true,
    portionsBought: reqPortions,
    totalCostGold,
    newStamina,
    staminaRestored,
    clanTaxGold,
    ownerRevenueGold,
    sector,
    message: `🍺 Вы заказали ${reqPortions} порц. обеда в «${sector.name}» за ${totalCostGold.toLocaleString()} 🪙! Бодрость восстановлена на +${staminaRestored}% (теперь: ${newStamina}%).`
  };
}

export function repairPortRealEstateObject(
  sectorId: string,
  actorNick: string,
  bagIronOre: number,
  bagHardenedSteel: number
): {
  ok: boolean;
  ironUsedFromBag?: number;
  steelUsedFromBag?: number;
  sector?: ClanTerritorySector;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект недвижимости не найден.' };

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  const curDur = prod.buildingDurability ?? 100;
  const maxDur = prod.maxBuildingDurability ?? 100;
  if (curDur >= maxDur) {
    return { ok: false, error: `Здание «${sector.name}» не нуждается в ремонте (Прочность: ${curDur}/${maxDur}).` };
  }

  const ironNeed = Math.max(0, 5 - (prod.repairIronStock || 0));
  const steelNeed = Math.max(0, 2 - (prod.repairSteelStock || 0));

  if (bagIronOre < ironNeed || bagHardenedSteel < steelNeed) {
    return {
      ok: false,
      error: `Для капитального ремонта «${sector.name}» до 100/100 требуется: 5 ед. Железной руды и 2 ед. Закаленной стали (у вас в багажнике: Руда ${bagIronOre}/${ironNeed} шт., Сталь ${bagHardenedSteel}/${steelNeed} шт.)!`
    };
  }

  prod.buildingDurability = maxDur;
  prod.repairIronStock = 0;
  prod.repairSteelStock = 0;
  prod.repairOrderActive = false;
  prod.lastDurabilityDecayAt = Date.now();

  appendPortDealProtocol(prod, {
    timestamp: Date.now(),
    actorNick,
    actionType: 'repair',
    resourceName: 'Ремонт здания (5 Руды + 2 Стали)',
    quantity: 1,
    goldAmount: 0,
    note: `Прочность объекта восстановлена с ${curDur}/100 до ${maxDur}/${maxDur}`
  });

  saveClansToSupabase();

  return {
    ok: true,
    ironUsedFromBag: ironNeed,
    steelUsedFromBag: steelNeed,
    sector,
    message: `🛠️ Объект «${sector.name}» полностью отремонтирован (Прочность: 100/100)! Израсходовано: ${ironNeed} ед. Железной руды и ${steelNeed} ед. Закаленной стали.`
  };
}

export function togglePortEstateRepairOrder(
  sectorId: string,
  actorNick: string
): {
  ok: boolean;
  repairOrderActive?: boolean;
  sector?: ClanTerritorySector;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект недвижимости не найден.' };

  const ownerClean = (sector.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim().toLowerCase();
  if (actorNick.trim().toLowerCase() !== ownerClean && actorNick.trim().toLowerCase() !== 'admin') {
    return { ok: false, error: 'Выставлять заявку на ремонт может только владелец объекта!' };
  }

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;
  prod.repairOrderActive = !prod.repairOrderActive;
  saveClansToSupabase();

  return {
    ok: true,
    repairOrderActive: prod.repairOrderActive,
    sector,
    message: prod.repairOrderActive
      ? `📋 Заявка на ремонт «${sector.name}» (5 Железной руды + 2 Закаленной стали) выставлена для рабочих!`
      : `📋 Заявка на ремонт «${sector.name}» снята.`
  };
}

export function getBuyersForFactoryProduct(
  resourceKey: PortTerminalResourceKey
): Array<{
  sectorId: string;
  sectorName: string;
  mapX: number;
  mapY: number;
  buyPriceGold: number;
  currentStock: number;
  maxStock: number;
  requiredPerHour: number;
  cashBalanceGold: number;
}> {
  const sectors = ensureTerritoriesLoaded();
  const buyers: Array<{
    sectorId: string;
    sectorName: string;
    mapX: number;
    mapY: number;
    buyPriceGold: number;
    currentStock: number;
    maxStock: number;
    requiredPerHour: number;
    cashBalanceGold: number;
  }> = [];

  for (const s of sectors) {
    const prod = normalizeSectorProduction(s);
    if (resourceKey === 'power_kw' && (prod.powerRequiredPerCycle ?? 0) > 0) {
      buyers.push({
        sectorId: s.id,
        sectorName: s.name,
        mapX: s.mapX ?? 5,
        mapY: s.mapY ?? 5,
        buyPriceGold: prod.powerBuyPriceGold || 70,
        currentStock: prod.powerStock ?? 0,
        maxStock: prod.maxPowerStock ?? 200,
        requiredPerHour: prod.powerRequiredPerCycle ?? 1,
        cashBalanceGold: prod.facilityBalanceGold || 0
      });
      continue;
    }
    if ((prod.productionTier || 1) >= 2) {
      if (prod.input1ResourceKey === resourceKey) {
        buyers.push({
          sectorId: s.id,
          sectorName: s.name,
          mapX: s.mapX ?? 5,
          mapY: s.mapY ?? 5,
          buyPriceGold: prod.rawBuyPriceGold || 80,
          currentStock: prod.input1Stock ?? prod.fishStock ?? 0,
          maxStock: prod.maxInput1Stock ?? prod.maxFishStock ?? 120,
          requiredPerHour: prod.input1RequiredPerCycle ?? 1,
          cashBalanceGold: prod.facilityBalanceGold || 0
        });
      } else if (prod.input2ResourceKey === resourceKey) {
        buyers.push({
          sectorId: s.id,
          sectorName: s.name,
          mapX: s.mapX ?? 5,
          mapY: s.mapY ?? 5,
          buyPriceGold: prod.input2BuyPriceGold || 130,
          currentStock: prod.input2Stock ?? 0,
          maxStock: prod.maxInput2Stock ?? 120,
          requiredPerHour: prod.input2RequiredPerCycle ?? 1,
          cashBalanceGold: prod.facilityBalanceGold || 0
        });
      } else if (prod.input3ResourceKey === resourceKey) {
        buyers.push({
          sectorId: s.id,
          sectorName: s.name,
          mapX: s.mapX ?? 5,
          mapY: s.mapY ?? 5,
          buyPriceGold: prod.input3BuyPriceGold || 820,
          currentStock: prod.input3Stock ?? 0,
          maxStock: prod.maxInput3Stock ?? 120,
          requiredPerHour: prod.input3RequiredPerCycle ?? 1,
          cashBalanceGold: prod.facilityBalanceGold || 0
        });
      }
    }
  }

  return buyers;
}

export function adminUpdatePortEstateSector(
  sectorId: string,
  patch: {
    name?: string;
    ownerNick?: string;
    ownerPlayerNick?: string;
    ownerClanId?: string;
    ownerClanName?: string;
    ownerClanTag?: string;
    ownerClanEmblem?: string;
    mapX?: number;
    mapY?: number;
    facilityBalanceGold?: number;
    buildingDurability?: number;
    workerWageGold?: number;
    hourlyWageGold?: number;
    productSellPriceGold?: number;
    sellRelicPriceGold?: number;
    rawBuyPriceGold?: number;
    buyInput1PriceGold?: number;
    input2BuyPriceGold?: number;
    buyInput2PriceGold?: number;
    input3BuyPriceGold?: number;
    powerBuyPriceGold?: number;
    outputRatePerHour?: number;
    relicsPerCycle?: number;
    input1RequiredPerCycle?: number;
    input2RequiredPerCycle?: number;
    input3RequiredPerCycle?: number;
    powerRequiredPerCycle?: number;
    relicStock?: number;
    finishedRelicsCount?: number;
    input1Stock?: number;
    input2Stock?: number;
    input3Stock?: number;
    powerStock?: number;
  }
): { ok: boolean; sector?: ClanTerritorySector; message?: string; error?: string } {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект недвижимости не найден.' };

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  if (typeof patch.name === 'string' && patch.name.trim()) {
    sector.name = patch.name.trim();
  }
  const nextOwnerNick = patch.ownerNick ?? patch.ownerPlayerNick;
  if (typeof nextOwnerNick === 'string' && nextOwnerNick.trim()) {
    sector.ownerNick = nextOwnerNick.trim();
  }
  if (typeof patch.ownerClanId === 'string' && patch.ownerClanId.trim()) {
    sector.ownerClanId = patch.ownerClanId.trim();
    sector.ownerDelegatedClan = true;
  }
  if (typeof patch.ownerClanName === 'string' && patch.ownerClanName.trim()) {
    sector.ownerClanName = patch.ownerClanName.trim();
    sector.ownerDelegatedClan = true;
  }
  if (typeof patch.ownerClanTag === 'string' && patch.ownerClanTag.trim()) {
    sector.ownerClanTag = patch.ownerClanTag.trim();
    sector.ownerDelegatedClan = true;
  }
  if (typeof patch.ownerClanEmblem === 'string' && patch.ownerClanEmblem.trim()) {
    sector.ownerClanEmblem = patch.ownerClanEmblem.trim();
    sector.icon = sector.ownerClanEmblem;
    sector.ownerDelegatedClan = true;
  }
  if (typeof patch.mapX === 'number' || typeof patch.mapY === 'number') {
    const { x, y } = normalizePortIslandCoord(patch.mapX ?? sector.mapX, patch.mapY ?? sector.mapY);
    sector.mapX = x;
    sector.mapY = y;
    sector.sectorBiomeName = getPortIslandCellMeta(x, y).sectorTitle;
  }
  if (typeof patch.facilityBalanceGold === 'number') {
    prod.facilityBalanceGold = Math.max(0, Math.floor(patch.facilityBalanceGold));
  }
  if (typeof patch.buildingDurability === 'number') {
    prod.buildingDurability = Math.max(0, Math.min(100, Math.floor(patch.buildingDurability)));
  }
  const nextWage = patch.workerWageGold ?? patch.hourlyWageGold;
  if (typeof nextWage === 'number') {
    prod.workerWageGold = Math.max(10, Math.floor(nextWage));
  }
  const nextSellPrice = patch.productSellPriceGold ?? patch.sellRelicPriceGold;
  if (typeof nextSellPrice === 'number') {
    prod.productSellPriceGold = Math.max(1, Math.floor(nextSellPrice));
  }
  const nextBuy1 = patch.rawBuyPriceGold ?? patch.buyInput1PriceGold;
  if (typeof nextBuy1 === 'number') {
    prod.rawBuyPriceGold = Math.max(1, Math.floor(nextBuy1));
  }
  const nextBuy2 = patch.input2BuyPriceGold ?? patch.buyInput2PriceGold;
  if (typeof nextBuy2 === 'number') {
    prod.input2BuyPriceGold = Math.max(1, Math.floor(nextBuy2));
  }
  if (typeof patch.input3BuyPriceGold === 'number') {
    prod.input3BuyPriceGold = Math.max(1, Math.floor(patch.input3BuyPriceGold));
  }
  if (typeof patch.powerBuyPriceGold === 'number') {
    prod.powerBuyPriceGold = Math.max(1, Math.floor(patch.powerBuyPriceGold));
  }
  const nextOutRate = patch.outputRatePerHour ?? patch.relicsPerCycle;
  if (typeof nextOutRate === 'number') {
    prod.outputRatePerHour = Math.max(1, Math.floor(nextOutRate));
  }
  const nextRelicStock = patch.relicStock ?? patch.finishedRelicsCount;
  if (typeof nextRelicStock === 'number') {
    prod.relicStock = Math.max(0, Math.floor(nextRelicStock));
  }
  if (typeof patch.input1RequiredPerCycle === 'number') {
    prod.input1RequiredPerCycle = Math.max(1, Math.floor(patch.input1RequiredPerCycle));
  }
  if (typeof patch.input2RequiredPerCycle === 'number') {
    prod.input2RequiredPerCycle = Math.max(1, Math.floor(patch.input2RequiredPerCycle));
  }
  if (typeof patch.input3RequiredPerCycle === 'number') {
    prod.input3RequiredPerCycle = Math.max(1, Math.floor(patch.input3RequiredPerCycle));
  }
  if (typeof patch.powerRequiredPerCycle === 'number') {
    prod.powerRequiredPerCycle = Math.max(0, Math.floor(patch.powerRequiredPerCycle));
  }
  if (typeof patch.relicStock === 'number') {
    prod.relicStock = Math.max(0, Math.floor(patch.relicStock));
  }
  if (typeof patch.input1Stock === 'number') {
    prod.input1Stock = Math.max(0, Math.floor(patch.input1Stock));
    prod.fishStock = prod.input1Stock;
  }
  if (typeof patch.input2Stock === 'number') {
    prod.input2Stock = Math.max(0, Math.floor(patch.input2Stock));
  }
  if (typeof patch.input3Stock === 'number') {
    prod.input3Stock = Math.max(0, Math.floor(patch.input3Stock));
  }
  if (typeof patch.powerStock === 'number') {
    prod.powerStock = Math.max(0, Math.floor(patch.powerStock));
  }

  saveClansToSupabase();
  return {
    ok: true,
    sector,
    message: `✅ Параметры объекта «${sector.name}» [${sector.mapX}/${sector.mapY}] сохранены администратором!`
  };
}

export function mergeClanPortFactories(
  clanId: string,
  actorNick: string,
  sectorId: string
): { ok: boolean; sector?: ClanTerritorySector; partnerSector?: ClanTerritorySector; message?: string; error?: string } {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект производства не найден.' };

  const cleanActor = actorNick.trim().toLowerCase();
  const isOwnerPlayer = (sector.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim().toLowerCase() === cleanActor;
  const clan = clanId ? inMemoryClans.find((c) => c.id === clanId) : undefined;

  if (!isOwnerPlayer && (!clan || sector.ownerClanId !== clan.id)) {
    return { ok: false, error: 'Для объединения производств вы или ваш клан должны владеть этим объектом!' };
  }

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;
  if (prod.isMerged) {
    return { ok: false, error: 'Это производство уже объединено и расширено до 6 рабочих мест и двойного склада!' };
  }

  // Ищем связанный смежный объект или второй объект того же владельца/клана
  const partner =
    (prod.linkedSectorId ? sectors.find((s) => s.id === prod.linkedSectorId && !normalizeSectorProduction(s).isMerged) : undefined) ||
    sectors.find(
      (s) =>
        s.id !== sector.id &&
        !normalizeSectorProduction(s).isMerged &&
        ((s.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim().toLowerCase() === cleanActor ||
          (clan && s.ownerClanId === clan.id))
    );

  if (!partner) {
    return {
      ok: false,
      error: 'Для объединения объектов вы должны удерживать минимум два не объединённых производства в Порту!'
    };
  }

  const partnerProd = normalizeSectorProduction(partner);
  partner.production = partnerProd;

  prod.isMerged = true;
  prod.facilityLevel = 2;
  prod.mergedWithSectorId = partner.id;
  prod.maxFishStock = PORT_MERGED_MAX_FISH_STOCK;
  prod.maxProcessedStock = PORT_MERGED_MAX_FISH_STOCK;
  prod.maxRelicStock = PORT_MERGED_MAX_RELIC_STOCK;
  prod.maxInput1Stock = PORT_MERGED_MAX_FISH_STOCK;
  if (prod.input2ResourceKey) {
    prod.maxInput2Stock = PORT_MERGED_MAX_FISH_STOCK;
  }
  if (prod.input3ResourceKey) {
    prod.maxInput3Stock = PORT_MERGED_MAX_FISH_STOCK;
  }

  partnerProd.isMerged = true;
  partnerProd.facilityLevel = 2;
  partnerProd.mergedWithSectorId = sector.id;
  partnerProd.maxFishStock = PORT_MERGED_MAX_FISH_STOCK;
  partnerProd.maxProcessedStock = PORT_MERGED_MAX_FISH_STOCK;
  partnerProd.maxRelicStock = PORT_MERGED_MAX_RELIC_STOCK;
  partnerProd.maxInput1Stock = PORT_MERGED_MAX_FISH_STOCK;
  if (partnerProd.input2ResourceKey) {
    partnerProd.maxInput2Stock = PORT_MERGED_MAX_FISH_STOCK;
  }
  if (partnerProd.input3ResourceKey) {
    partnerProd.maxInput3Stock = PORT_MERGED_MAX_FISH_STOCK;
  }

  if (clan) {
    addClanLogEntry(
      clan,
      actorNick,
      'port_production',
      `Объединены производства Порта «${sector.name}» и «${partner.name}»! Лимит рабочих мест увеличен до ${PORT_MERGED_MAX_WORKERS} чел., склад сырья — до ${PORT_MERGED_MAX_FISH_STOCK} шт., продукции — до ${PORT_MERGED_MAX_RELIC_STOCK} шт.!`,
      '🏗️'
    );
  }

  saveClansToSupabase();

  return {
    ok: true,
    sector,
    partnerSector: partner,
    message: `🏗️ Производства «${sector.name}» и «${partner.name}» успешно объединены (Ур. 2)! Лимит работников увеличен до ${PORT_MERGED_MAX_WORKERS} чел., склад сырья — до ${PORT_MERGED_MAX_FISH_STOCK} ед., склад продукции — до ${PORT_MERGED_MAX_RELIC_STOCK} шт.!`
  };
}

// ============================================================================
// СОЗДАНИЕ НЕДВИЖИМОСТИ (3 000 💎), ПАНЕЛЬ ВЛАДЕЛЬЦА И ТОРГОВЫЙ ТЕРМИНАЛ ПОРТА
// ============================================================================

export function createPortRealEstateObject(
  ownerNick: string,
  templateId: string,
  customName: string,
  availableCrystals: number,
  coords?: { mapX?: number; mapY?: number }
): {
  ok: boolean;
  sector?: ClanTerritorySector;
  costCrystals?: number;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const cleanOwner = (ownerNick || '').trim();
  if (!cleanOwner) {
    return { ok: false, error: 'Не удалось определить никнейм владельца.' };
  }
  if (availableCrystals < ESTATE_CREATION_COST_CRYSTALS) {
    return {
      ok: false,
      error: `Недостаточно кристаллов для создания недвижимости! Стоимость: ${ESTATE_CREATION_COST_CRYSTALS.toLocaleString()} 💎 (у вас: ${availableCrystals.toLocaleString()} 💎).`
    };
  }

  const tpl = PORT_ESTATE_TEMPLATES.find((t) => t.id === templateId) || PORT_ESTATE_TEMPLATES[0];
  const finalName = (customName || '').trim() || tpl.name;

  const ownerClan = getPlayerClan(cleanOwner);
  const clanId = ownerClan ? ownerClan.id : null;
  const clanName = ownerClan ? ownerClan.name : `Клан ${cleanOwner}`;
  const clanTag = ownerClan ? ownerClan.tag : cleanOwner.slice(0, 4).toUpperCase();
  const clanEmblem = ownerClan ? ownerClan.emblem : '👑';

  // Связываем со смежным цехом в Порту
  const matchingPartner = sectors.find(
    (s) =>
      s.production?.intermediateResourceName === tpl.intermediateResourceName &&
      s.production?.productionStage !== tpl.productionStage
  );

  const mapX = Math.max(
    1,
    Math.min(PORT_ISLAND_GRID_SIZE, Math.floor(Number(coords?.mapX || DEFAULT_PORT_ISLAND_POS.x)))
  );
  const mapY = Math.max(
    1,
    Math.min(PORT_ISLAND_GRID_SIZE, Math.floor(Number(coords?.mapY || DEFAULT_PORT_ISLAND_POS.y)))
  );
  const cellMeta = getPortIslandCellMeta(mapX, mapY);
  const buildingCategory: ClanTerritorySector['buildingCategory'] =
    tpl.productionTier === 1 || tpl.productionStage === 'extraction'
      ? 'extraction'
      : tpl.productionTier === 3 || tpl.productionStage === 'dual_advanced'
      ? 'dual_manufactory'
      : 'raw_processing';

  const newSector: ClanTerritorySector = {
    id: `estate_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: finalName,
    icon: clanEmblem,
    description: tpl.description,
    zone: 'port',
    mapX,
    mapY,
    sectorBiomeName: cellMeta.sectorTitle,
    buildingCategory,
    ownerNick: cleanOwner,
    isCustomCreated: true,
    createdAt: Date.now(),
    ownerDelegatedClan: true,
    pendingClanControl: null,
    ownerClanId: clanId,
    ownerClanName: clanName,
    ownerClanTag: clanTag,
    ownerClanEmblem: clanEmblem,
    bonusType: tpl.bonusType,
    bonusValue: tpl.bonusValue,
    bonusLabel: tpl.bonusLabel,
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction(
      tpl.factoryType,
      tpl.categoryLabel,
      40,
      10,
      tpl.productionStage,
      matchingPartner?.id || null,
      tpl.intermediateResourceName,
      20,
      {
        productionTier: tpl.productionTier,
        input1ResourceKey: tpl.input1ResourceKey,
        input1ResourceName: tpl.input1ResourceName,
        input1ResourceIcon: tpl.input1ResourceIcon,
        input1Stock: tpl.productionTier === 1 ? undefined : 20,
        input1RequiredPerCycle: tpl.input1RequiredPerCycle,
        input2ResourceKey: tpl.input2ResourceKey,
        input2ResourceName: tpl.input2ResourceName,
        input2ResourceIcon: tpl.input2ResourceIcon,
        input2Stock: tpl.input2ResourceKey ? 20 : undefined,
        input2RequiredPerCycle: tpl.input2RequiredPerCycle,
        input2BuyPriceGold: tpl.input2BuyPriceGold,
        input3ResourceKey: tpl.input3ResourceKey,
        input3ResourceName: tpl.input3ResourceName,
        input3ResourceIcon: tpl.input3ResourceIcon,
        input3Stock: tpl.input3ResourceKey ? 20 : undefined,
        input3RequiredPerCycle: tpl.input3RequiredPerCycle,
        input3BuyPriceGold: tpl.input3BuyPriceGold,
        outputResourceKey: tpl.outputResourceKey,
        outputProductName: tpl.outputProductName,
        outputProductIcon: tpl.outputProductIcon,
        outputRatePerHour: tpl.outputRatePerHour,
        rawBuyPriceGold: tpl.rawBuyPriceGold,
        productSellPriceGold: tpl.productSellPriceGold
      }
    )
  };

  inMemoryTerritories.push(newSector);
  saveClansToSupabase();

  return {
    ok: true,
    sector: newSector,
    costCrystals: ESTATE_CREATION_COST_CRYSTALS,
    message: `🏗️ Объект недвижимости «${finalName}» создан в секторе [${mapX}/${mapY}] за ${ESTATE_CREATION_COST_CRYSTALS.toLocaleString()} 💎 и автоматически перенесён во вкладку «Недвижимость» вашего профиля!`
  };
}

export function updatePortEstateOwnerSettings(
  sectorId: string,
  actorNick: string,
  settings: {
    rawBuyPriceGold?: number;
    input2BuyPriceGold?: number;
    input3BuyPriceGold?: number;
    productSellPriceGold?: number;
    workerWageGold?: number;
    customName?: string;
  }
): {
  ok: boolean;
  sector?: ClanTerritorySector;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект недвижимости не найден.' };

  const ownerClean = (sector.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim().toLowerCase();
  const actorClean = (actorNick || '').trim().toLowerCase();
  if (actorClean !== ownerClean && actorClean !== 'admin') {
    return {
      ok: false,
      error: `Настраивать цены и зарплаты объекта может только его официальный владелец (${sector.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK})!`
    };
  }

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;
  const balancedDefaults = getBalancedDefaultPricesForSector(sector);

  const clamp20 = (val: number, base: number) => {
    const minVal = Math.max(1, Math.round(base * 0.8));
    const maxVal = Math.max(minVal, Math.round(base * 1.2));
    return Math.max(minVal, Math.min(maxVal, Math.floor(val)));
  };

  if (typeof settings.rawBuyPriceGold === 'number' && !Number.isNaN(settings.rawBuyPriceGold)) {
    prod.rawBuyPriceGold = clamp20(settings.rawBuyPriceGold, balancedDefaults.rawBuyPriceGold);
  }
  if (typeof settings.input2BuyPriceGold === 'number' && !Number.isNaN(settings.input2BuyPriceGold)) {
    prod.input2BuyPriceGold = clamp20(settings.input2BuyPriceGold, balancedDefaults.input2BuyPriceGold);
  }
  if (typeof settings.input3BuyPriceGold === 'number' && !Number.isNaN(settings.input3BuyPriceGold)) {
    prod.input3BuyPriceGold = clamp20(settings.input3BuyPriceGold, balancedDefaults.input3BuyPriceGold);
  }
  if (typeof settings.productSellPriceGold === 'number' && !Number.isNaN(settings.productSellPriceGold)) {
    prod.productSellPriceGold = clamp20(settings.productSellPriceGold, balancedDefaults.productSellPriceGold);
  }
  if (typeof settings.workerWageGold === 'number' && !Number.isNaN(settings.workerWageGold)) {
    prod.workerWageGold = clamp20(settings.workerWageGold, balancedDefaults.workerWageGold);
    prod.workers.forEach((w) => {
      if (!w.claimed) {
        w.goldPerHour = prod.workerWageGold!;
      }
    });
  }
  if (typeof settings.customName === 'string' && settings.customName.trim().length >= 3) {
    sector.name = settings.customName.trim().slice(0, 42);
  }

  saveClansToSupabase();

  return {
    ok: true,
    sector,
    message: `⚙️ Настройки недвижимости «${sector.name}» сохранены (в пределах ±20% от баланса)! Продажа продукции: ${prod.productSellPriceGold} 🪙, скупка сырья: ${prod.rawBuyPriceGold} 🪙, зарплата: ${prod.workerWageGold} 🪙/ч.`
  };
}

export function delegatePortEstateClanControl(
  sectorId: string,
  actorNick: string,
  targetClanQuery: string
): {
  ok: boolean;
  isQueuedAfterWar?: boolean;
  sector?: ClanTerritorySector;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект недвижимости не найден.' };

  const ownerClean = (sector.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim().toLowerCase();
  const actorClean = (actorNick || '').trim().toLowerCase();
  if (actorClean !== ownerClean && actorClean !== 'admin') {
    return {
      ok: false,
      error: `Делегировать клановый контроль над объектом может только владелец (${sector.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK})!`
    };
  }

  const query = (targetClanQuery || '').trim();
  if (!query) {
    return { ok: false, error: 'Укажите название или тег клана для передачи контроля.' };
  }

  const queryLower = query.toLowerCase();
  const matchedClan = inMemoryClans.find(
    (c) =>
      c.id.toLowerCase() === queryLower ||
      c.name.trim().toLowerCase() === queryLower ||
      c.tag.trim().toLowerCase() === queryLower ||
      `[${c.tag.trim().toLowerCase()}]` === queryLower
  );

  const nextClanId = matchedClan ? matchedClan.id : null;
  const nextClanName = matchedClan ? matchedClan.name : query;
  const nextClanTag = matchedClan
    ? matchedClan.tag
    : query.replace(/[^a-zA-Zа-яА-Я0-9]/g, '').slice(0, 5).toUpperCase() || 'CLAN';
  const nextClanEmblem = matchedClan ? matchedClan.emblem : sector.ownerClanEmblem || '🛡️';

  // Важное правило безопасности по ТЗ:
  // Новый клановый контроль вступает в силу ТОЛЬКО после завершения текущего активного нападения (если таковое шло),
  // чтобы избежать махинаций прямо во время боя!
  if (sector.warStatus === 'war') {
    sector.pendingClanControl = {
      clanId: nextClanId,
      clanName: nextClanName,
      clanTag: nextClanTag,
      clanEmblem: nextClanEmblem,
      requestedAt: Date.now()
    };
    saveClansToSupabase();
    return {
      ok: true,
      isQueuedAfterWar: true,
      sector,
      message: `🛡️ Правило безопасности: сейчас за объект «${sector.name}» идёт активное сражение! Передача контроля клану [${nextClanTag}] «${nextClanName}» поставлена в очередь и вступит в силу автоматически сразу после завершения текущего боя.`
    };
  }

  sector.ownerClanId = nextClanId;
  sector.ownerClanName = nextClanName;
  sector.ownerClanTag = nextClanTag;
  sector.ownerClanEmblem = nextClanEmblem;
  sector.icon = nextClanEmblem;
  sector.ownerDelegatedClan = true;
  sector.pendingClanControl = null;

  saveClansToSupabase();

  return {
    ok: true,
    isQueuedAfterWar: false,
    sector,
    message: `🚩 Контроль над объектом «${sector.name}» официально передан клану [${nextClanTag}] «${nextClanName}»!`
  };
}

export function tradeWithPortTerminal(
  playerNick: string,
  mode: 'buy' | 'sell',
  resourceKey: PortTerminalResourceKey,
  requestedQty: number,
  heroGold: number,
  playerAvailableResourceQty: number
): {
  ok: boolean;
  quantity?: number;
  unitPriceGold?: number;
  totalGold?: number;
  deltaHeroGold?: number;
  newTerminalStock?: number;
  terminal?: PortTradingTerminalState;
  message?: string;
  error?: string;
} {
  const terminal = loadPortTradingTerminal();
  const meta = PORT_TERMINAL_CATALOG.find((r) => r.key === resourceKey);
  if (!meta) {
    return {
      ok: false,
      error:
        'На Торговом терминале Порта торгуются только базовое сырьё и промежуточные компоненты! Готовые реликвии и боевые модули продаются напрямую со складов предприятий.'
    };
  }

  const qty = Math.max(1, Math.floor(Number(requestedQty) || 1));
  const currentTerminalStock = Math.max(0, Number(terminal.stocks[resourceKey] ?? PORT_TERMINAL_INITIAL_STOCK));

  if (mode === 'buy') {
    if (currentTerminalStock < qty) {
      return {
        ok: false,
        error: `На балансе Торгового терминала недостаточно ресурса «${meta.name}» (доступно: ${currentTerminalStock.toLocaleString()} ед.)!`
      };
    }
    const unitPrice = meta.buyPriceGold;
    const totalCost = qty * unitPrice;
    if (heroGold < totalCost) {
      return {
        ok: false,
        error: `Недостаточно золота для покупки ${qty} ед. «${meta.name}»! Требуется ${totalCost.toLocaleString()} 🪙 (${unitPrice} 🪙/ед.).`
      };
    }

    terminal.stocks[resourceKey] = currentTerminalStock - qty;
    terminal.totalBought = (terminal.totalBought || 0) + qty;
    if (resourceKey === 'raw_fish') {
      const m = loadPortFishMarket();
      m.fishStock = terminal.stocks.raw_fish;
      savePortFishMarket();
    }
    savePortTradingTerminal();

    return {
      ok: true,
      quantity: qty,
      unitPriceGold: unitPrice,
      totalGold: totalCost,
      deltaHeroGold: -totalCost,
      newTerminalStock: terminal.stocks[resourceKey],
      terminal,
      message: `🛒 Вы купили ${qty.toLocaleString()} ед. «${meta.name}» в Торговом терминале Порта за ${totalCost.toLocaleString()} 🪙 (остаток в терминале: ${terminal.stocks[resourceKey].toLocaleString()} ед.)!`
    };
  } else {
    if (playerAvailableResourceQty < qty) {
      return {
        ok: false,
        error: `У вас недостаточно ресурса «${meta.name}» для продажи (в наличии: ${playerAvailableResourceQty.toLocaleString()} ед.)!`
      };
    }
    const unitPrice = meta.sellPriceGold;
    const totalRevenue = qty * unitPrice;

    terminal.stocks[resourceKey] = currentTerminalStock + qty;
    terminal.totalSold = (terminal.totalSold || 0) + qty;
    if (resourceKey === 'raw_fish') {
      const m = loadPortFishMarket();
      m.fishStock = terminal.stocks.raw_fish;
      m.totalFishTraded = (m.totalFishTraded || 0) + qty;
      savePortFishMarket();
    }
    savePortTradingTerminal();

    return {
      ok: true,
      quantity: qty,
      unitPriceGold: unitPrice,
      totalGold: totalRevenue,
      deltaHeroGold: totalRevenue,
      newTerminalStock: terminal.stocks[resourceKey],
      terminal,
      message: `💰 Вы продали ${qty.toLocaleString()} ед. «${meta.name}» в Торговый терминал Порта и получили +${totalRevenue.toLocaleString()} 🪙 (теперь на балансе терминала: ${terminal.stocks[resourceKey].toLocaleString()} ед.)!`
    };
  }
}

export function transferPlayerResourceToPortFacility(
  sectorId: string,
  playerNick: string,
  resourceKey: PortTerminalResourceKey,
  requestedQty: number,
  availablePlayerQty: number
): {
  ok: boolean;
  loadedQty?: number;
  sector?: ClanTerritorySector;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект недвижимости не найден.' };

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  const qty = Math.max(1, Math.floor(Number(requestedQty) || 1));
  if (availablePlayerQty < qty) {
    return { ok: false, error: `На вашем личном складе недостаточно выбранного ресурса (${availablePlayerQty} ед.).` };
  }

  if (prod.input1ResourceKey && resourceKey === prod.input1ResourceKey) {
    const max1 = prod.maxInput1Stock || PORT_BASE_MAX_FISH_STOCK;
    const cur1 = prod.input1Stock ?? prod.fishStock ?? 0;
    const free1 = Math.max(0, max1 - cur1);
    if (free1 <= 0) {
      return {
        ok: false,
        error: `Склад Входа #1 («${prod.input1ResourceName}») на «${sector.name}» уже полон (${cur1}/${max1})!`
      };
    }
    const take1 = Math.min(free1, qty);
    prod.input1Stock = cur1 + take1;
    prod.fishStock = prod.input1Stock;
    saveClansToSupabase();
    return {
      ok: true,
      loadedQty: take1,
      sector,
      message: `📦 Вы загрузили ${take1} ед. «${prod.input1ResourceName}» на склад «${sector.name}» (${prod.input1Stock}/${max1})!`
    };
  }

  if (prod.input2ResourceKey && resourceKey === prod.input2ResourceKey) {
    const max2 = prod.maxInput2Stock || PORT_BASE_MAX_FISH_STOCK;
    const cur2 = prod.input2Stock || 0;
    const free2 = Math.max(0, max2 - cur2);
    if (free2 <= 0) {
      return {
        ok: false,
        error: `Склад Входа #2 («${prod.input2ResourceName}») на «${sector.name}» уже полон (${cur2}/${max2})!`
      };
    }
    const take2 = Math.min(free2, qty);
    prod.input2Stock = cur2 + take2;
    saveClansToSupabase();
    return {
      ok: true,
      loadedQty: take2,
      sector,
      message: `📦 Вы загрузили ${take2} ед. «${prod.input2ResourceName}» на склад «${sector.name}» (${prod.input2Stock}/${max2})!`
    };
  }

  if (prod.input3ResourceKey && resourceKey === prod.input3ResourceKey) {
    const max3 = prod.maxInput3Stock || PORT_BASE_MAX_FISH_STOCK;
    const cur3 = prod.input3Stock || 0;
    const free3 = Math.max(0, max3 - cur3);
    if (free3 <= 0) {
      return {
        ok: false,
        error: `Склад Входа #3 («${prod.input3ResourceName}») на «${sector.name}» уже полон (${cur3}/${max3})!`
      };
    }
    const take3 = Math.min(free3, qty);
    prod.input3Stock = cur3 + take3;
    saveClansToSupabase();
    return {
      ok: true,
      loadedQty: take3,
      sector,
      message: `📦 Вы загрузили ${take3} ед. «${prod.input3ResourceName}» на склад «${sector.name}» (${prod.input3Stock}/${max3})!`
    };
  }

  if (resourceKey === 'raw_fish') {
    const free = Math.max(0, prod.maxFishStock - prod.fishStock);
    if (free <= 0) {
      return { ok: false, error: `Склад сырой рыбы на «${sector.name}» уже полон (${prod.fishStock}/${prod.maxFishStock})!` };
    }
    const take = Math.min(free, qty);
    prod.fishStock += take;
    saveClansToSupabase();
    return {
      ok: true,
      loadedQty: take,
      sector,
      message: `🐟 Вы передали ${take} ед. сырой рыбы со своего склада на объект «${sector.name}» (${prod.fishStock}/${prod.maxFishStock})!`
    };
  }

  const maxProc = prod.maxProcessedStock || PORT_BASE_MAX_FISH_STOCK;
  const curProc = prod.processedStock || 0;
  const free = Math.max(0, maxProc - curProc);
  if (free <= 0) {
    return {
      ok: false,
      error: `Склад промежуточного сырья на «${sector.name}» уже полон (${curProc}/${maxProc})!`
    };
  }
  const take = Math.min(free, qty);
  prod.processedStock = curProc + take;
  saveClansToSupabase();

  const meta = PORT_TERMINAL_CATALOG.find((m) => m.key === resourceKey);
  return {
    ok: true,
    loadedQty: take,
    sector,
    message: `📦 Вы загрузили ${take} ед. ресурса «${meta?.name || prod.intermediateResourceName}» на склад объекта «${sector.name}» (${prod.processedStock}/${maxProc})!`
  };
}

export function declareClanTerritoryWar(
  clanId: string,
  actorNick: string,
  sectorId: string,
  actorHero?: HeroState,
  actorEquipped?: EquippedGear
): { ok: boolean; sector?: ClanTerritorySector; message?: string; error?: string } {
  const sectors = ensureTerritoriesLoaded();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Для нападения на объект Порта вы должны состоять в клане!' };

  const member = clan.members.find((m) => m.nick.toLowerCase() === actorNick.toLowerCase());
  const isLeader = clan.leaderNick.trim().toLowerCase() === actorNick.trim().toLowerCase() || member?.role === 'leader';
  if (!isLeader && member && member.permissions && !member.permissions.canDeclareWar) {
    return {
      ok: false,
      error: '⚠️ У вас нет кланового права «Объявление штурмов 7х7»! Попросите Главу клана отметить это право во вкладке «Состав».'
    };
  }
  const hasBadge = doesPlayerHaveClanBadge(actorNick, clan.id, actorHero?.hasClanBadge);
  if (!hasBadge || (actorHero && actorHero.clanBadgeEquipped === false)) {
    return {
      ok: false,
      error: `🛡️ Правило Порта: без надетого «Знака клана» игрок не может заходить в бои 7х7 за недвижимость и не получает бонусы Погон! Наденьте Знак клана в Профиле или попросите Главу выдать его во вкладке «Состав» (${CLAN_BADGE_COST_GOLD.toLocaleString()} 🪙).`
    };
  }

  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект производства в Порту не найден.' };

  const now = Date.now();
  if (sector.warStatus === 'war') {
    return {
      ok: false,
      error: `За объект Порта «${sector.name}» уже объявлена тревога 7х7! Нажмите «Вступить в бой», чтобы занять клетку.`
    };
  }

  if (sector.ownerClanId === clan.id) {
    return { ok: false, error: 'Этот объект производства уже находится под контролем вашего клана!' };
  }

  // Проверка 2-часового цикла удержания территории
  if (sector.ownerClanId && sector.protectionUntil && now < sector.protectionUntil) {
    const remSec = Math.ceil((sector.protectionUntil - now) / 1000);
    const h = Math.floor(remSec / 3600);
    const m = Math.floor((remSec % 3600) / 60);
    const s = remSec % 60;
    return {
      ok: false,
      error: `🛡️ Объект удерживается кланом [${sector.ownerClanTag}] ещё ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} (2-часовой цикл владения). После истечения таймера он станет уязвим!`
    };
  }

  sector.warStatus = 'war';
  sector.warStartedAt = now;
  sector.warEndsAt = now + TERRITORY_GATHERING_DURATION_MS;
  sector.attackerClanId = clan.id;
  sector.attackerClanName = clan.name;
  sector.attackerClanTag = clan.tag;
  sector.attackerClanEmblem = clan.emblem;
  sector.warScores = {};

  if (sector.ownerClanId) {
    const defClan = inMemoryClans.find((c) => c.id === sector.ownerClanId);
    if (defClan) {
      sector.warScores[defClan.id] = {
        clanId: defClan.id,
        clanName: defClan.name,
        clanTag: defClan.tag,
        clanEmblem: defClan.emblem,
        points: 50
      };
    }
  }

  sector.warScores[clan.id] = {
    clanId: clan.id,
    clanName: clan.name,
    clanTag: clan.tag,
    clanEmblem: clan.emblem,
    points: 100
  };

  // ТОЛЬКО РЕАЛЬНЫЕ ИГРОКИ со Знаком клана (Никаких ботов!):
  const attackerPlayer = build7x7FighterFromHero(
    actorNick,
    'attacker',
    clan,
    'tank',
    'frontal',
    actorHero,
    actorEquipped,
    actorHero?.level || member?.lvl || 10,
    0
  );

  sector.battle7x7 = {
    phase: 'gathering',
    gatheringStartedAt: now,
    gatheringEndsAt: now + TERRITORY_GATHERING_DURATION_MS,
    currentRound: 0,
    maxRounds: 12,
    roundStartedAt: 0,
    roundEndsAt: 0,
    attackers: [attackerPlayer],
    defenders: [],
    waitingQueueAttackers: [],
    waitingQueueDefenders: [],
    roundLogs: []
  };

  addClanLogEntry(
    clan,
    actorNick,
    'declare_war',
    `Объявлен штурм 7х7 за производство в Порту «${sector.name}» (${sector.bonusLabel})! Идёт сбор обладателей Знака клана (10 минут, максимум 7 на 7)!`,
    '⚔️'
  );
  saveClansToSupabase();

  return {
    ok: true,
    sector,
    message: `🚨 ТРЕВОГА В ПОРТУ! Вы объявили штурм объекта «${sector.name}» и заняли Клетку Атаки #1! Соклановцы со Знаком клана (до 7 человек с каждой стороны) имеют 10 минут, чтобы нажать «Вступить в бой».`
  };
}

export function joinOrUpdateTerritory7x7Slot(
  sectorId: string,
  playerNick: string,
  hero: HeroState,
  equipped: EquippedGear | undefined,
  clanId: string,
  role: TerritoryFighterRole = 'tank',
  tactic: TerritoryTacticalAction = 'frontal'
): { ok: boolean; isFullQueue?: boolean; sector?: ClanTerritorySector; message?: string; error?: string } {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector || sector.warStatus !== 'war' || !sector.battle7x7) {
    return { ok: false, error: 'На этом объекте Порта сейчас нет активного штурма 7х7.' };
  }

  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  if (!doesPlayerHaveClanBadge(playerNick, clan.id, hero?.hasClanBadge) || (hero && hero.clanBadgeEquipped === false)) {
    return {
      ok: false,
      error: `🛡️ Без надетого «Знака клана» нельзя участвовать в боях 7х7 за недвижимость! Наденьте «Знак клана» в Профиле персонажа (или получите его у Главы во вкладке «Состав»).`
    };
  }

  normalize7x7RealPlayersRoster(sector);
  const b = sector.battle7x7;
  const isAlliedDefender = Boolean(
    sector.ownerClanId && areClansAllied(sector.ownerClanId, clan.id)
  );
  const side: 'attacker' | 'defender' | null =
    sector.attackerClanId === clan.id
      ? 'attacker'
      : sector.ownerClanId === clan.id || !sector.ownerClanId || isAlliedDefender
      ? 'defender'
      : null;

  if (!side) {
    return {
      ok: false,
      error: 'В этом бою 7х7 участвуют только атакующий клан, защищающийся клан и его официальные Союзники (Альянс)!'
    };
  }

  const roster = side === 'attacker' ? b.attackers : b.defenders;
  const queue = side === 'attacker' ? (b.waitingQueueAttackers ||= []) : (b.waitingQueueDefenders ||= []);
  const existingIdx = roster.findIndex((f) => f.nick.toLowerCase() === playerNick.toLowerCase());

  if (existingIdx >= 0) {
    const updated = build7x7FighterFromHero(
      playerNick,
      side,
      clan,
      role,
      tactic,
      hero,
      equipped,
      hero.level || 10,
      existingIdx
    );
    if (b.phase === 'combat') {
      roster[existingIdx].tactic = tactic;
      roster[existingIdx].role = role;
    } else {
      roster[existingIdx] = updated;
    }
    saveClansToSupabase();
    return {
      ok: true,
      sector,
      message: `✅ Ваша Клетка #${existingIdx + 1} (${role === 'tank' ? '🛡 Передовая/Танк' : role === 'dps' ? '🏹 Стрелок/Дамагер' : '✨ Поддержка'}) и тактика (${tactic === 'defense' ? '🛡 Глухая защита' : tactic === 'frontal' ? '⚔️ Атака в лоб' : '🎯 Точечный фокус'}) обновлены!`
    };
  }

  if (b.phase !== 'gathering') {
    return { ok: false, error: 'Фаза сбора завершена — тактический бой 7х7 на клетках уже идёт!' };
  }

  // Лимит: максимум 7 реальных игроков от атаки и 7 от защиты. Если места заняты — в очередь!
  if (roster.length >= 7) {
    if (!queue.some((qNick) => qNick.toLowerCase() === playerNick.toLowerCase())) {
      queue.push(playerNick);
      saveClansToSupabase();
    }
    return {
      ok: false,
      isFullQueue: true,
      sector,
      error: `Мест нет (В очереди): все 7 клеток вашей команды уже заняты реальными игроками! Вы добавлены в очередь ожидания (#${
        queue.findIndex((qNick) => qNick.toLowerCase() === playerNick.toLowerCase()) + 1
      }).`
    };
  }

  const newSlotIdx = roster.length;
  roster.push(
    build7x7FighterFromHero(
      playerNick,
      side,
      clan,
      role,
      tactic,
      hero,
      equipped,
      hero.level || 10,
      newSlotIdx
    )
  );

  // Удаляем из очереди ожидания, если был там
  const qIdx = queue.findIndex((qNick) => qNick.toLowerCase() === playerNick.toLowerCase());
  if (qIdx >= 0) queue.splice(qIdx, 1);

  if (b.attackers.length >= 7 && b.defenders.length >= 7 && b.phase === 'gathering') {
    transitionSectorToCombatPhase(sector, Date.now());
    saveClansToSupabase();
    return {
      ok: true,
      sector,
      message: `🔥 Обе команды (7 на 7) полностью укомплектованы реальными игроками! Открыто тактическое поле боя на клетках (20 секунд на ход)!`
    };
  }

  saveClansToSupabase();
  return {
    ok: true,
    sector,
    message: `⚔️ Вы вступили в бой со Знаком клана [${clan.tag}] и заняли Клетку #${newSlotIdx + 1} (${roster.length}/7) в команде ${
      side === 'attacker' ? 'Атаки' : 'Защиты'
    }!`
  };
}

export function fillTerritory7x7WithClanRoster(
  sectorId: string,
  actorNick: string,
  clanId: string
): { ok: boolean; sector?: ClanTerritorySector; message?: string; error?: string } {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector || sector.warStatus !== 'war' || !sector.battle7x7) {
    return { ok: false, error: 'Активный сбор 7х7 не найден.' };
  }

  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  normalize7x7RealPlayersRoster(sector);
  const b = sector.battle7x7;
  const side: 'attacker' | 'defender' | null =
    sector.attackerClanId === clan.id
      ? 'attacker'
      : sector.ownerClanId === clan.id || !sector.ownerClanId
      ? 'defender'
      : null;

  if (!side) {
    return { ok: false, error: 'Ваш клан не участвует в этом бою 7х7.' };
  }

  const roster = side === 'attacker' ? b.attackers : b.defenders;
  let addedCount = 0;

  // Записываем ТОЛЬКО реальных участников клана со Знаком клана из clan.members (никаких ботов!)
  for (const m of clan.members) {
    if (roster.length >= 7) break;
    const memberHasBadge =
      Boolean(m.hasClanBadge) ||
      m.role === 'leader' ||
      m.nick.trim().toLowerCase() === clan.leaderNick.trim().toLowerCase();
    if (!memberHasBadge) continue;
    if (!roster.some((f) => f.nick.toLowerCase() === m.nick.toLowerCase())) {
      const slotIdx = roster.length;
      const slotRole = getRecommendedRoleForSlotIndex(slotIdx);
      roster.push(
        build7x7FighterFromHero(
          m.nick,
          side,
          clan,
          slotRole,
          getDefaultTacticForRole(slotRole),
          undefined,
          undefined,
          Math.max(5, m.lvl || 10),
          slotIdx
        )
      );
      addedCount++;
    }
  }

  if (addedCount === 0 && roster.length < 7) {
    return {
      ok: false,
      error: `Все соклановцы с выданным «Знаком клана» уже находятся на клетках поля боя (${roster.length}/7). Глава клана может выдать Знак клана (1 000 🪙) во вкладке «Состав»!`
    };
  }

  if (b.attackers.length >= 7 && b.defenders.length >= 7 && b.phase === 'gathering') {
    transitionSectorToCombatPhase(sector, Date.now());
    saveClansToSupabase();
    return {
      ok: true,
      sector,
      message: `⚔️ Команды (7х7) собраны (${actorNick})! Поле боя на клетках открыто — Ход 1 (20 секунд)!`
    };
  }

  saveClansToSupabase();
  return {
    ok: true,
    sector,
    message: `✅ На клетки вашей команды призваны соклановцы (+${addedCount} чел., всего занято клеток: ${roster.length}/7, без ботов)!`
  };
}

export function updateTerritory7x7FighterConfig(
  sectorId: string,
  targetNick: string,
  side: 'attacker' | 'defender',
  role: TerritoryFighterRole,
  tactic: TerritoryTacticalAction
): { ok: boolean; sector?: ClanTerritorySector; message?: string; error?: string } {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector || !sector.battle7x7) {
    return { ok: false, error: 'Бой 7х7 не найден.' };
  }

  const roster = side === 'attacker' ? sector.battle7x7.attackers : sector.battle7x7.defenders;
  const fighter = roster.find((f) => f.nick.toLowerCase() === targetNick.toLowerCase());
  if (!fighter) {
    return { ok: false, error: 'Игрок не найден на клетках 7х7.' };
  }

  fighter.role = role;
  fighter.tactic = tactic;
  saveClansToSupabase();

  return {
    ok: true,
    sector,
    message: `⚡ Для ${fighter.nick} установлена роль «${
      role === 'tank' ? '🛡 Передовая' : role === 'dps' ? '🏹 Стрелок' : '✨ Поддержка'
    }» и тактика «${
      tactic === 'defense' ? '🛡 Глухая защита' : tactic === 'frontal' ? '⚔️ Атака в лоб' : '🎯 Точечный фокус'
    }»!`
  };
}

export function startOrAdvanceTerritory7x7Battle(
  sectorId: string
): { ok: boolean; sector?: ClanTerritorySector; message?: string; error?: string } {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector || sector.warStatus !== 'war' || !sector.battle7x7) {
    return { ok: false, error: 'В этом секторе сейчас нет активного боя 7х7.' };
  }

  const now = Date.now();
  const b = sector.battle7x7;
  normalize7x7RealPlayersRoster(sector);

  if (b.phase === 'gathering') {
    // Если у защищающегося клана есть реальные участники в клане, но они ещё не успели нажать кнопку,
    // при ручном досрочном запуске боя призываем только реальных игроков из защищающегося клана (без ботов!)
    if (b.defenders.length === 0 && sector.ownerClanId) {
      const defClan = inMemoryClans.find((c) => c.id === sector.ownerClanId);
      if (defClan && defClan.members.length > 0) {
        for (const m of defClan.members) {
          if (b.defenders.length >= 7) break;
          const slotIdx = b.defenders.length;
          const slotRole = getRecommendedRoleForSlotIndex(slotIdx);
          b.defenders.push(
            build7x7FighterFromHero(
              m.nick,
              'defender',
              defClan,
              slotRole,
              getDefaultTacticForRole(slotRole),
              undefined,
              undefined,
              Math.max(5, m.lvl || 10),
              slotIdx
            )
          );
        }
      }
    } else if (b.defenders.length === 0 && !sector.ownerClanId) {
      // Если сектор нейтральный, но есть другие реальные кланы в мире, их реальные игроки могут выступить соперниками
      const rivalClan = inMemoryClans.find((c) => c.id !== sector.attackerClanId && c.members.length > 0);
      if (rivalClan) {
        for (const m of rivalClan.members) {
          if (b.defenders.length >= 7) break;
          const slotIdx = b.defenders.length;
          const slotRole = getRecommendedRoleForSlotIndex(slotIdx);
          b.defenders.push(
            build7x7FighterFromHero(
              m.nick,
              'defender',
              rivalClan,
              slotRole,
              getDefaultTacticForRole(slotRole),
              undefined,
              undefined,
              Math.max(5, m.lvl || 10),
              slotIdx
            )
          );
        }
      }
    }

    transitionSectorToCombatPhase(sector, now);
    saveClansToSupabase();

    if (!sector.battle7x7) {
      return {
        ok: true,
        sector,
        message: sector.lastBattleReport?.summaryText || `🏆 Сектор «${sector.name}» захвачен!`
      };
    }

    return {
      ok: true,
      sector,
      message: `⚔️ Сбор завершён! Открыто тактическое поле боя 7х7 на клетках (Ход 1 — 20 секунд на выбор клетки и удар)!`
    };
  }

  if (b.phase === 'combat') {
    const r = b.currentRound;
    simulateSingle7x7Round(sector, now);
    saveClansToSupabase();

    if (!sector.battle7x7) {
      return {
        ok: true,
        sector,
        message: sector.lastBattleReport?.summaryText || `🏆 Тактический бой 7х7 за сектор «${sector.name}» завершён!`
      };
    }

    return {
      ok: true,
      sector,
      message: `⏱ Ход ${r} (20 сек) завершён! На поле боя: Атака ${
        sector.battle7x7.attackers.filter((f) => f.alive).length
      }/${sector.battle7x7.attackers.length} vs Защита ${
        sector.battle7x7.defenders.filter((f) => f.alive).length
      }/${sector.battle7x7.defenders.length}.`
    };
  }

  return { ok: true, sector, message: 'Бой уже завершён.' };
}

// ============================================================================
// 3. ЕЖЕДНЕВНЫЙ КЛАНОВЫЙ БОСС (РЕЙД — clan_boss & clan_boss_participants)
// ============================================================================

export function getTodayClanDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const CLAN_RAID_BOSS_TEMPLATES = [
  {
    bossId: 'raid_sand_crocodile',
    bossName: 'Песчаный Крокодил Себек',
    bossIcon: '🐊',
    bossDescription: 'Колоссальный бронированный хищник древней дельты Нила. Чешуя прочнее гранита.',
    bossLevel: 20,
    maxHp: 1000000,
    rewardGold: 35000,
    rewardCrystals: 150,
    rewardChestName: 'Сундук Песчаного Себека'
  },
  {
    bossId: 'raid_mummy_guardian',
    bossName: 'Древняя Мумия-Страж Имхотеп',
    bossIcon: '🧟‍♂️',
    bossDescription: 'Бессмертный верховный жрец проклятой гробницы, повелевающий песчаными бурями.',
    bossLevel: 25,
    maxHp: 1500000,
    rewardGold: 50000,
    rewardCrystals: 220,
    rewardChestName: 'Саркофаг Сокровищ Имхотепа'
  },
  {
    bossId: 'raid_scorpion_colossus',
    bossName: 'Императорский Скорпион Апофиса',
    bossIcon: '🦂',
    bossDescription: 'Гигантский ядовитый исполин пустыни, охраняющий подземные кристаллы фараонов.',
    bossLevel: 30,
    maxHp: 2000000,
    rewardGold: 75000,
    rewardCrystals: 300,
    rewardChestName: 'Золотой Ковчег Апофиса'
  }
];

export function ensureClanRaidBossForToday(clan: Clan): ClanRaidBossState {
  const todayKey = getTodayClanDateKey();
  if (clan.raidBoss && clan.raidBoss.resetDate === todayKey && clan.raidBoss.maxHp >= 1000000) {
    return clan.raidBoss;
  }

  // Выбираем босса дня на основе даты и уровня клана
  const daySeed = todayKey.split('-').reduce((acc, p) => acc + Number(p || 0), 0) + (clan.level || 1);
  const tpl = CLAN_RAID_BOSS_TEMPLATES[daySeed % CLAN_RAID_BOSS_TEMPLATES.length];

  const freshBoss: ClanRaidBossState = {
    clanId: clan.id,
    bossId: tpl.bossId,
    bossName: tpl.bossName,
    bossIcon: tpl.bossIcon,
    bossDescription: tpl.bossDescription,
    bossLevel: tpl.bossLevel,
    currentHp: tpl.maxHp,
    maxHp: tpl.maxHp,
    resetDate: todayKey,
    isDefeated: false,
    rewardGold: tpl.rewardGold,
    rewardCrystals: tpl.rewardCrystals,
    rewardChestName: tpl.rewardChestName,
    participants: {}
  };

  clan.raidBoss = freshBoss;
  return freshBoss;
}

export function getClanRaidBoss(clanOrId: Clan | string): ClanRaidBossState | null {
  initClanStorage();
  const clan = typeof clanOrId === 'string' ? inMemoryClans.find((c) => c.id === clanOrId) : clanOrId;
  if (!clan) return null;
  return ensureClanRaidBossForToday(clan);
}

export function attackClanRaidBoss(
  clanId: string,
  playerNick: string,
  rawDamage: number,
  playerAvatar = '🧙‍♂️',
  shouldSave = true
): {
  ok: boolean;
  damageDealt?: number;
  justDefeated?: boolean;
  boss?: ClanRaidBossState;
  error?: string;
} {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const boss = ensureClanRaidBossForToday(clan);
  if (boss.isDefeated || boss.currentHp <= 0) {
    return { ok: false, error: 'Ежедневный босс уже повержен сегодня! Дождитесь обновления рейда.', boss };
  }

  const dmg = Math.max(100, Math.floor(Number(rawDamage) || 1000));
  const actualDamage = Math.min(boss.currentHp, dmg);
  boss.currentHp = Math.max(0, boss.currentHp - actualDamage);

  const prevPart = boss.participants[playerNick] || {
    nick: playerNick,
    avatar: playerAvatar,
    damageDealt: 0,
    attacksCount: 0,
    rewardClaimed: false
  };
  boss.participants[playerNick] = {
    ...prevPart,
    nick: playerNick,
    avatar: playerAvatar || prevPart.avatar,
    damageDealt: prevPart.damageDealt + actualDamage,
    attacksCount: prevPart.attacksCount + 1
  };

  let justDefeated = false;
  if (boss.currentHp <= 0 && !boss.isDefeated) {
    boss.isDefeated = true;
    boss.defeatedAt = Date.now();
    justDefeated = true;
    addClanLogEntry(
      clan,
      playerNick,
      'raid_boss_kill',
      `Нанес решающий удар по Рейд-Боссу «${boss.bossName}» (${boss.maxHp.toLocaleString('ru-RU')} HP)! Все участники рейда могут забрать награду!`,
      boss.bossIcon
    );
  }

  if (shouldSave) {
    saveClansToSupabase();
  }

  return {
    ok: true,
    damageDealt: actualDamage,
    justDefeated,
    boss
  };
}

export function claimClanRaidBossReward(
  clanId: string,
  playerNick: string
): {
  ok: boolean;
  rewardGold?: number;
  rewardCrystals?: number;
  chestItem?: GameItem;
  error?: string;
} {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const boss = ensureClanRaidBossForToday(clan);
  if (!boss.isDefeated && boss.currentHp > 0) {
    return { ok: false, error: 'Босс ещё не повержен! Доведите его HP до 0.' };
  }

  const partKey = Object.keys(boss.participants).find(
    (k) => k.toLowerCase() === playerNick.toLowerCase()
  );
  const participant = partKey ? boss.participants[partKey] : null;
  if (!participant || participant.damageDealt <= 0) {
    return { ok: false, error: 'Вы не нанесли урона этому боссу в сегодняшнем рейде!' };
  }
  if (participant.rewardClaimed) {
    return { ok: false, error: 'Вы уже забрали награду за сегодняшнего Рейд-Босса!' };
  }

  participant.rewardClaimed = true;

  // Создаём трофейную реликвию/сундук в инвентарь игрока
  const chestRelicItem: GameItem = {
    id: `raid_relic_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: `${boss.rewardChestName} (Трофей Рейда)`,
    slot: 'ring',
    icon: '🏺',
    quality: 'legendary',
    lvl: 1,
    dmg: 25,
    hp: 120,
    goldBonusPct: 3,
    expBonusPct: 3,
    durability: 500,
    maxDurability: 500,
    isRelic: true,
    relicTier: 3,
    relicPower: 5,
    origin: `Трофей за победу над Рейд-Боссом «${boss.bossName}»`
  };

  saveClansToSupabase();
  return {
    ok: true,
    rewardGold: boss.rewardGold,
    rewardCrystals: boss.rewardCrystals,
    chestItem: chestRelicItem
  };
}

// ============================================================================
// 4. КЛАНОВЫЕ ЗАДАНИЯ (ОБЩИЕ ЦЕЛИ — ТАБЛИЦА clan_quests)
// ============================================================================

export function createDefaultDailyClanQuests(): ClanDailyQuestEntry[] {
  return [
    {
      questId: 'cq_fish_500',
      title: 'Поймать 500 рыб на всех',
      description: 'Совместный улов всех участников синдиката на Рыбалке Нила.',
      icon: '🐟',
      actionType: 'fish',
      currentProgress: 0,
      targetValue: 500,
      unitLabel: 'рыб',
      status: 'in_progress',
      rewardTreasuryGold: 40000,
      rewardTreasuryCrystals: 80,
      rewardPlayerGold: 15000,
      rewardPlayerCrystals: 40,
      chestName: 'Сундук Великого Рыболова Клана',
      treasuryRewardClaimed: false,
      claimedByNicks: [],
      contributions: {}
    },
    {
      questId: 'cq_spins_1000',
      title: 'Сделать 1 000 спинов на всех',
      description: 'Совместно прокрутить Слоты Фараона или Колесо Фортуны 1 000 раз.',
      icon: '🎰',
      actionType: 'spin',
      currentProgress: 0,
      targetValue: 1000,
      unitLabel: 'спинов',
      status: 'in_progress',
      rewardTreasuryGold: 55000,
      rewardTreasuryCrystals: 120,
      rewardPlayerGold: 20000,
      rewardPlayerCrystals: 50,
      chestName: 'Золотой Ковчег Фортуны Ра',
      treasuryRewardClaimed: false,
      claimedByNicks: [],
      contributions: {}
    },
    {
      questId: 'cq_donate_200k',
      title: 'Пополнить казну на 200 000 золота',
      description: 'Внести в общак клана суммарно 200 000 🪙 золота за сутки.',
      icon: '🏦',
      actionType: 'donate_gold',
      currentProgress: 0,
      targetValue: 200000,
      unitLabel: '🪙',
      status: 'in_progress',
      rewardTreasuryGold: 35000,
      rewardTreasuryCrystals: 150,
      rewardPlayerGold: 25000,
      rewardPlayerCrystals: 60,
      chestName: 'Сундук Казначея Династии',
      treasuryRewardClaimed: false,
      claimedByNicks: [],
      contributions: {}
    },
    {
      questId: 'cq_mobs_300',
      title: 'Победить 300 монстров в Пирамидах',
      description: 'Совместная зачистка гробниц и Клановой Пирамиды от монстров.',
      icon: '⚔️',
      actionType: 'kill_mob',
      currentProgress: 0,
      targetValue: 300,
      unitLabel: 'монстров',
      status: 'in_progress',
      rewardTreasuryGold: 45000,
      rewardTreasuryCrystals: 100,
      rewardPlayerGold: 18000,
      rewardPlayerCrystals: 45,
      chestName: 'Боевой Ларец Легиона',
      treasuryRewardClaimed: false,
      claimedByNicks: [],
      contributions: {}
    }
  ];
}

export function ensureClanQuestsForToday(clan: Clan): ClanQuestsState {
  const todayKey = getTodayClanDateKey();
  if (clan.clanQuests && clan.clanQuests.resetDate === todayKey && Array.isArray(clan.clanQuests.quests) && clan.clanQuests.quests.length > 0) {
    return clan.clanQuests;
  }
  const freshState: ClanQuestsState = {
    resetDate: todayKey,
    quests: createDefaultDailyClanQuests()
  };
  clan.clanQuests = freshState;
  return freshState;
}

export function getClanDailyQuests(clanOrId: Clan | string): ClanQuestsState | null {
  initClanStorage();
  const clan = typeof clanOrId === 'string' ? inMemoryClans.find((c) => c.id === clanOrId) : clanOrId;
  if (!clan) return null;
  return ensureClanQuestsForToday(clan);
}

export function claimClanQuestReward(
  clanId: string,
  playerNick: string,
  questId: string
): {
  ok: boolean;
  rewardPlayerGold?: number;
  rewardPlayerCrystals?: number;
  rewardTreasuryGold?: number;
  rewardTreasuryCrystals?: number;
  chestName?: string;
  error?: string;
} {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const qState = ensureClanQuestsForToday(clan);
  const quest = qState.quests.find((q) => q.questId === questId);
  if (!quest) return { ok: false, error: 'Клановое задание не найдено.' };

  if (quest.currentProgress < quest.targetValue) {
    return {
      ok: false,
      error: `Задание ещё в процессе (${quest.currentProgress.toLocaleString('ru-RU')} / ${quest.targetValue.toLocaleString('ru-RU')})!`
    };
  }

  const claimedBy = Array.isArray(quest.claimedByNicks) ? quest.claimedByNicks : [];
  if (claimedBy.some((n) => n.toLowerCase() === playerNick.toLowerCase())) {
    return { ok: false, error: 'Вы уже забрали бонусный сундук за это задание сегодня!' };
  }

  claimedBy.push(playerNick);
  quest.claimedByNicks = claimedBy;

  let addedTreasuryGold = 0;
  let addedTreasuryCrystals = 0;
  if (!quest.treasuryRewardClaimed) {
    quest.treasuryRewardClaimed = true;
    addedTreasuryGold = quest.rewardTreasuryGold;
    addedTreasuryCrystals = quest.rewardTreasuryCrystals;
    clan.treasuryGold = Math.max(0, Number(clan.treasuryGold || 0)) + addedTreasuryGold;
    clan.treasuryCrystals = Math.max(0, Number(clan.treasuryCrystals || 0)) + addedTreasuryCrystals;
    addClanLogEntry(
      clan,
      playerNick,
      'clan_quest_claim',
      `Выполнено общее задание «${quest.title}»! В казну зачислено +${addedTreasuryGold.toLocaleString('ru-RU')} 🪙 и +${addedTreasuryCrystals} 💎!`,
      '🎁'
    );
  }

  quest.status = 'claimed';
  saveClansToSupabase();

  return {
    ok: true,
    rewardPlayerGold: quest.rewardPlayerGold,
    rewardPlayerCrystals: quest.rewardPlayerCrystals,
    rewardTreasuryGold: addedTreasuryGold,
    rewardTreasuryCrystals: addedTreasuryCrystals,
    chestName: quest.chestName
  };
}

// ============================================================================
// ЕДИНЫЙ ХУК АКТИВНОСТИ ИГРОКА ДЛЯ КЛАНОВ (СПИНЫ, РЫБАЛКА, КАЗНА, МОНСТРЫ)
// ============================================================================

export function recordClanPlayerActivity(
  playerNick: string,
  clanId: string | undefined | null,
  actionType: ClanQuestActionType,
  amount = 1,
  heroDamage = 350,
  playerAvatar = '🧙‍♂️',
  shouldSave = true
): {
  questCompletedTitle?: string;
  bossDamageDealt?: number;
  bossDefeatedName?: string;
  territoryWarPointsAdded?: number;
} {
  initClanStorage();
  const cleanNick = String(playerNick || '').trim();
  if (!cleanNick || amount <= 0) return {};

  const clan =
    (clanId ? inMemoryClans.find((c) => c.id === clanId) : undefined) ||
    getPlayerClan(cleanNick, clanId || undefined);

  if (!clan) return {};

  let questCompletedTitle: string | undefined;
  let bossDamageDealt = 0;
  let bossDefeatedName: string | undefined;
  let territoryWarPointsAdded = 0;

  // 1. Инкремент прогресса Клановых заданий (clan_quests)
  const qState = ensureClanQuestsForToday(clan);
  qState.quests.forEach((q) => {
    if (q.actionType === actionType) {
      const wasCompleted = q.currentProgress >= q.targetValue;
      q.currentProgress = Math.min(q.targetValue, q.currentProgress + Math.floor(amount));
      if (!q.contributions) q.contributions = {};
      q.contributions[cleanNick] = (q.contributions[cleanNick] || 0) + Math.floor(amount);
      if (q.currentProgress >= q.targetValue && !wasCompleted) {
        q.status = 'completed';
        questCompletedTitle = q.title;
      }
    }
  });

  // 2. Автоматический урон по Ежедневному Клановому Боссу (clan_boss) при спинах, рыбалке и охоте
  const boss = ensureClanRaidBossForToday(clan);
  if (!boss.isDefeated && boss.currentHp > 0) {
    let autoDmg = 0;
    const baseHeroDmg = Math.max(100, Number(heroDamage || 300));
    if (actionType === 'spin') {
      autoDmg = (12000 + baseHeroDmg * 15) * Math.max(1, amount);
    } else if (actionType === 'fish') {
      autoDmg = (18000 + baseHeroDmg * 20) * Math.max(1, amount);
    } else if (actionType === 'kill_mob') {
      autoDmg = (14000 + baseHeroDmg * 18) * Math.max(1, amount);
    } else if (actionType === 'donate_gold') {
      autoDmg = Math.max(5000, Math.floor(amount * 0.5));
    }

    if (autoDmg > 0) {
      const atkRes = attackClanRaidBoss(clan.id, cleanNick, autoDmg, playerAvatar, false);
      if (atkRes.ok && atkRes.damageDealt) {
        bossDamageDealt = atkRes.damageDealt;
        if (atkRes.justDefeated) {
          bossDefeatedName = boss.bossName;
        }
      }
    }
  }

  // 3. Очки влияния в активных Клановых Войнах за территории (territories)
  const sectors = ensureTerritoriesLoaded();
  const warPoints =
    actionType === 'spin'
      ? 15 * amount
      : actionType === 'fish'
      ? 25 * amount
      : actionType === 'donate_gold'
      ? Math.max(10, Math.floor(amount / 1000))
      : 20 * amount;

  sectors.forEach((sec) => {
    if (sec.warStatus === 'war') {
      if (!sec.warScores) sec.warScores = {};
      if (sec.warScores[clan.id] || sec.attackerClanId === clan.id || sec.ownerClanId === clan.id) {
        const prevPts = sec.warScores[clan.id]?.points || 0;
        sec.warScores[clan.id] = {
          clanId: clan.id,
          clanName: clan.name,
          clanTag: clan.tag,
          clanEmblem: clan.emblem,
          points: prevPts + warPoints
        };
        territoryWarPointsAdded += warPoints;
      }
    }
  });

  if (shouldSave) {
    saveClansToSupabase();
  }

  return {
    questCompletedTitle,
    bossDamageDealt,
    bossDefeatedName,
    territoryWarPointsAdded
  };
}

// ============================================================================
// 5. АРЕНА КЛАНОВЫХ ЧЕМПИОНОВ (PvP ТУРНИРЫ, СЕТКА, БОЕВОЙ ЛОГ И ТИТУЛЫ)
// ============================================================================

export const ARENA_CHAMPION_TITLES = [
  '🏆 Чемпион Клановой Арены',
  '👑 Гранд-Гладиатор Синдиката',
  '⚡ Непобедимый Легионер Ра'
];

const DEFAULT_ARENA_FIGHTERS: ClanArenaFighter[] = [
  {
    nick: 'Анубис_Хантер',
    avatar: '🐺',
    lvl: 19,
    clanId: 'npc_clan_anubis',
    clanName: 'Стражи Анубиса',
    clanTag: 'ANUB',
    clanEmblem: '🐺',
    powerScore: 14800,
    dmg: 1250,
    maxHp: 9400,
    dodgePct: 18,
    hasClanGear: true,
    hasClanTransport: true,
    arenaPoints: 1450,
    wins: 14,
    losses: 3,
    championTitle: '🏆 Чемпион Клановой Арены',
    registeredAt: Date.now() - 86400000
  },
  {
    nick: 'Фараон_Рамзес',
    avatar: '👑',
    lvl: 18,
    clanId: 'npc_clan_ra',
    clanName: 'Легион Солнца Ра',
    clanTag: 'SUN',
    clanEmblem: '☀️',
    powerScore: 13200,
    dmg: 1120,
    maxHp: 8600,
    dodgePct: 15,
    hasClanGear: true,
    hasClanTransport: false,
    arenaPoints: 1320,
    wins: 11,
    losses: 4,
    championTitle: '👑 Гранд-Гладиатор Синдиката',
    registeredAt: Date.now() - 72000000
  },
  {
    nick: 'Скорпион_Нил',
    avatar: '🦂',
    lvl: 16,
    clanId: 'npc_clan_scorp',
    clanName: 'Золотой Скорпион',
    clanTag: 'SCRP',
    clanEmblem: '🦂',
    powerScore: 11500,
    dmg: 960,
    maxHp: 7400,
    dodgePct: 14,
    hasClanGear: true,
    hasClanTransport: false,
    arenaPoints: 1180,
    wins: 8,
    losses: 5,
    championTitle: null,
    registeredAt: Date.now() - 50000000
  }
];

export function calculateFighterPowerFromGear(
  hero: HeroState,
  equipped?: EquippedGear
): {
  powerScore: number;
  dmg: number;
  maxHp: number;
  dodgePct: number;
  hasClanGear: boolean;
  hasClanTransport: boolean;
} {
  let gearDmg = 0;
  let gearHp = 0;
  let gearDodge = 0;
  let hasClanGear = false;
  let hasClanTransport = false;

  if (equipped) {
    Object.values(equipped).forEach((it) => {
      if (!it) return;
      gearDmg += Number(it.dmg || 0);
      gearHp += Number(it.hp || 0);
      gearDodge += Number(it.dodgeBonus || 0);
      if (it.isClanCreated || it.isClanRented) {
        if (it.isTransport || it.slot === 'transport') {
          hasClanTransport = true;
        } else {
          hasClanGear = true;
        }
      }
    });
  }

  const totalDmg = Math.max(50, (hero.str || 1) * 8 + (hero.bonusDmg || 0) + gearDmg);
  const totalHp = Math.max(500, Number(hero.maxHp || 1000) + gearHp);
  const dodgePct = Math.min(60, Math.max(5, Math.floor((hero.agi || 1) * 0.4 + gearDodge)));

  const clanGearBonus = (hasClanGear ? 1800 : 0) + (hasClanTransport ? 1200 : 0);
  const powerScore = Math.round(
    totalDmg * 6 + totalHp * 0.8 + dodgePct * 90 + (hero.level || 1) * 250 + clanGearBonus
  );

  return {
    powerScore,
    dmg: totalDmg,
    maxHp: totalHp,
    dodgePct,
    hasClanGear,
    hasClanTransport
  };
}

const EXTRA_ARENA_PARTICIPANTS: ClanArenaFighter[] = [
  {
    nick: 'Сетх_Разрушитель',
    avatar: '⚡',
    lvl: 17,
    clanId: 'npc_clan_seth',
    clanName: 'Буря Сетха',
    clanTag: 'SETH',
    clanEmblem: '⚡',
    powerScore: 12100,
    dmg: 1020,
    maxHp: 7900,
    dodgePct: 15,
    hasClanGear: true,
    hasClanTransport: false,
    arenaPoints: 1240,
    wins: 9,
    losses: 4,
    championTitle: null,
    registeredAt: Date.now() - 60000000
  },
  {
    nick: 'Клеопатра_VII',
    avatar: '🐍',
    lvl: 16,
    clanId: 'npc_clan_nile',
    clanName: 'Кобра Александрии',
    clanTag: 'COBR',
    clanEmblem: '🐍',
    powerScore: 10900,
    dmg: 910,
    maxHp: 7100,
    dodgePct: 17,
    hasClanGear: true,
    hasClanTransport: false,
    arenaPoints: 1120,
    wins: 7,
    losses: 5,
    championTitle: null,
    registeredAt: Date.now() - 45000000
  },
  {
    nick: 'Гор_Сокол',
    avatar: '🦅',
    lvl: 15,
    clanId: 'npc_clan_horus',
    clanName: 'Крылья Гора',
    clanTag: 'HOR',
    clanEmblem: '🦅',
    powerScore: 10200,
    dmg: 860,
    maxHp: 6800,
    dodgePct: 16,
    hasClanGear: false,
    hasClanTransport: false,
    arenaPoints: 1060,
    wins: 6,
    losses: 5,
    championTitle: null,
    registeredAt: Date.now() - 40000000
  },
  {
    nick: 'Себек_Клык',
    avatar: '🐊',
    lvl: 15,
    clanId: 'npc_clan_sebek',
    clanName: 'Стражи Нила',
    clanTag: 'NILE',
    clanEmblem: '🐊',
    powerScore: 9800,
    dmg: 820,
    maxHp: 6600,
    dodgePct: 12,
    hasClanGear: false,
    hasClanTransport: false,
    arenaPoints: 1010,
    wins: 5,
    losses: 6,
    championTitle: null,
    registeredAt: Date.now() - 35000000
  },
  {
    nick: 'Бастет_Тень',
    avatar: '🐈‍⬛',
    lvl: 14,
    clanId: 'npc_clan_bast',
    clanName: 'Ночной Оазис',
    clanTag: 'BAST',
    clanEmblem: '🌙',
    powerScore: 9200,
    dmg: 790,
    maxHp: 6200,
    dodgePct: 19,
    hasClanGear: false,
    hasClanTransport: false,
    arenaPoints: 980,
    wins: 4,
    losses: 6,
    championTitle: null,
    registeredAt: Date.now() - 30000000
  }
];

function buildFreshPlayoffBracket(fighters: ClanArenaFighter[], focusNick?: string): ClanArenaPlayoffMatch[] {
  const pool: ClanArenaFighter[] = [...fighters];
  for (const extra of [...DEFAULT_ARENA_FIGHTERS, ...EXTRA_ARENA_PARTICIPANTS]) {
    if (pool.length >= 8) break;
    if (!pool.some((p) => p.nick.toLowerCase() === extra.nick.toLowerCase())) {
      pool.push({ ...extra });
    }
  }

  let ordered = pool.slice(0, 8);
  if (focusNick) {
    const myIdx = pool.findIndex((f) => f.nick.toLowerCase() === focusNick.toLowerCase());
    if (myIdx >= 0) {
      const me = pool[myIdx];
      const others = pool.filter((_, idx) => idx !== myIdx).slice(0, 7);
      ordered = [me, ...others];
    }
  }

  const quarters: ClanArenaPlayoffMatch[] = [0, 1, 2, 3].map((idx) => ({
    id: `playoff_q_${idx + 1}`,
    stage: 'quarter',
    stageLabel: '1/4 финала',
    matchIndex: idx,
    fighter1: ordered[idx * 2] ? { ...ordered[idx * 2] } : null,
    fighter2: ordered[idx * 2 + 1] ? { ...ordered[idx * 2 + 1] } : null,
    winnerNick: null,
    winnerClanTag: null,
    status: 'ready'
  }));

  const semis: ClanArenaPlayoffMatch[] = [0, 1].map((idx) => ({
    id: `playoff_s_${idx + 1}`,
    stage: 'semi',
    stageLabel: 'Полуфинал',
    matchIndex: idx,
    fighter1: null,
    fighter2: null,
    winnerNick: null,
    winnerClanTag: null,
    status: 'pending'
  }));

  const finalMatch: ClanArenaPlayoffMatch = {
    id: 'playoff_f_1',
    stage: 'final',
    stageLabel: 'Финал',
    matchIndex: 0,
    fighter1: null,
    fighter2: null,
    winnerNick: null,
    winnerClanTag: null,
    status: 'pending'
  };

  return [...quarters, ...semis, finalMatch];
}

export function ensureArenaPlayoffBracket(
  arena: ClanArenaTournamentState,
  focusNick?: string
): ClanArenaPlayoffMatch[] {
  if (!Array.isArray(arena.playoffBracket) || arena.playoffBracket.length !== 7) {
    arena.playoffBracket = buildFreshPlayoffBracket(arena.fighters, focusNick);
    arena.tournamentChampionNick = null;
    arena.tournamentChampionClanTag = null;
  }
  return arena.playoffBracket;
}

export function resetClanArenaPlayoffBracket(focusNick?: string): ClanArenaTournamentState {
  const arena = getClanArenaState();
  arena.playoffBracket = buildFreshPlayoffBracket(arena.fighters, focusNick);
  arena.tournamentChampionNick = null;
  arena.tournamentChampionClanTag = null;
  arena.nextTournamentAt = Date.now() + 15 * 60 * 1000;
  saveClansToSupabase();
  return arena;
}

export function getClanArenaState(): ClanArenaTournamentState {
  initClanStorage();
  if (!inMemoryArena || !Array.isArray(inMemoryArena.fighters) || inMemoryArena.fighters.length === 0) {
    const nextMatchTime = Date.now() + 15 * 60 * 1000;
    const initialFighters = [...DEFAULT_ARENA_FIGHTERS, ...EXTRA_ARENA_PARTICIPANTS];
    inMemoryArena = {
      seasonId: `season_${getTodayClanDateKey().slice(0, 7)}`,
      nextTournamentAt: nextMatchTime,
      fighters: initialFighters,
      matchHistory: [],
      clanPrestigeScores: {
        npc_clan_anubis: 450,
        npc_clan_ra: 380,
        npc_clan_scorp: 260
      },
      playoffBracket: buildFreshPlayoffBracket(initialFighters),
      tournamentChampionNick: null,
      tournamentChampionClanTag: null
    };
  } else {
    for (const extra of [...DEFAULT_ARENA_FIGHTERS, ...EXTRA_ARENA_PARTICIPANTS]) {
      if (inMemoryArena.fighters.length >= 8) break;
      if (!inMemoryArena.fighters.some((f) => f.nick.toLowerCase() === extra.nick.toLowerCase())) {
        inMemoryArena.fighters.push({ ...extra });
      }
    }
    ensureArenaPlayoffBracket(inMemoryArena);
  }
  return inMemoryArena;
}

export function registerPlayerForClanArena(
  playerNick: string,
  hero: HeroState,
  equipped: EquippedGear | undefined,
  clan: Clan
): { ok: boolean; fighter: ClanArenaFighter; isUpdate: boolean } {
  const arena = getClanArenaState();
  const stats = calculateFighterPowerFromGear(hero, equipped);
  const cleanNick = String(playerNick || hero.nick || 'Игрок').trim();

  const existingIdx = arena.fighters.findIndex(
    (f) => f.nick.toLowerCase() === cleanNick.toLowerCase()
  );

  const fighter: ClanArenaFighter = {
    nick: cleanNick,
    avatar: hero.avatar || '🧙‍♂️',
    lvl: hero.level || 1,
    clanId: clan.id,
    clanName: clan.name,
    clanTag: clan.tag,
    clanEmblem: clan.emblem,
    powerScore: stats.powerScore,
    dmg: stats.dmg,
    maxHp: stats.maxHp,
    dodgePct: stats.dodgePct,
    hasClanGear: stats.hasClanGear,
    hasClanTransport: stats.hasClanTransport,
    arenaPoints: existingIdx >= 0 ? arena.fighters[existingIdx].arenaPoints : 1000,
    wins: existingIdx >= 0 ? arena.fighters[existingIdx].wins : 0,
    losses: existingIdx >= 0 ? arena.fighters[existingIdx].losses : 0,
    championTitle: existingIdx >= 0 ? arena.fighters[existingIdx].championTitle : hero.arenaChampionTitle || null,
    registeredAt: Date.now()
  };

  if (existingIdx >= 0) {
    arena.fighters[existingIdx] = fighter;
  } else {
    arena.fighters.push(fighter);
  }

  const bracket = ensureArenaPlayoffBracket(arena, cleanNick);
  const alreadyInBracket = bracket.some(
    (m) =>
      m.fighter1?.nick.toLowerCase() === cleanNick.toLowerCase() ||
      m.fighter2?.nick.toLowerCase() === cleanNick.toLowerCase()
  );

  if (!alreadyInBracket) {
    const anyCompleted = bracket.some((m) => m.status === 'completed');
    if (!anyCompleted) {
      arena.playoffBracket = buildFreshPlayoffBracket(arena.fighters, cleanNick);
    } else {
      const openQuarter = bracket.find((m) => m.stage === 'quarter' && m.status !== 'completed');
      if (openQuarter) {
        openQuarter.fighter1 = { ...fighter };
      } else {
        arena.playoffBracket = buildFreshPlayoffBracket(arena.fighters, cleanNick);
      }
    }
  } else {
    bracket.forEach((m) => {
      if (m.fighter1?.nick.toLowerCase() === cleanNick.toLowerCase()) {
        m.fighter1 = { ...fighter };
      }
      if (m.fighter2?.nick.toLowerCase() === cleanNick.toLowerCase()) {
        m.fighter2 = { ...fighter };
      }
    });
  }

  arena.fighters.sort((a, b) => b.arenaPoints - a.arenaPoints || b.powerScore - a.powerScore);
  saveClansToSupabase();

  return { ok: true, fighter, isUpdate: existingIdx >= 0 };
}

export function fightInClanArenaTournament(
  playerNick: string,
  hero: HeroState,
  equipped: EquippedGear | undefined,
  clan: Clan,
  targetOpponentNick?: string
): {
  ok: boolean;
  isWin?: boolean;
  matchLog?: ClanArenaMatchLog;
  awardedTitle?: string | null;
  awardedCrystals?: number;
  awardedGold?: number;
  newArenaPoints?: number;
  stageLabel?: string;
  error?: string;
} {
  const regRes = registerPlayerForClanArena(playerNick, hero, equipped, clan);
  const arena = getClanArenaState();
  const myFighter = regRes.fighter;
  ensureArenaPlayoffBracket(arena, playerNick);

  const opponents = arena.fighters.filter(
    (f) => f.nick.toLowerCase() !== myFighter.nick.toLowerCase()
  );
  if (opponents.length === 0) {
    return { ok: false, error: 'На арене пока нет доступных соперников для боя.' };
  }

  // Находим текущий матч игрока в сетке Плей-офф
  const normMe = myFighter.nick.toLowerCase();
  const myPlayoffMatch = (arena.playoffBracket || []).find(
    (m) =>
      m.status !== 'completed' &&
      (m.fighter1?.nick.toLowerCase() === normMe || m.fighter2?.nick.toLowerCase() === normMe)
  );

  let scheduledOpponentNick = targetOpponentNick;
  if (!scheduledOpponentNick && myPlayoffMatch) {
    scheduledOpponentNick =
      myPlayoffMatch.fighter1?.nick.toLowerCase() === normMe
        ? myPlayoffMatch.fighter2?.nick
        : myPlayoffMatch.fighter1?.nick;
  }

  const opponent =
    (scheduledOpponentNick
      ? opponents.find((o) => o.nick.toLowerCase() === scheduledOpponentNick!.toLowerCase())
      : undefined) || opponents[Math.floor(Math.random() * opponents.length)];

  // Расчёт вероятности победы с учётом боевой мощи, клановых вещей и транспорта
  const totalPower = Math.max(1, myFighter.powerScore + opponent.powerScore);
  const rawWinProb = (myFighter.powerScore / totalPower) * 100;
  const winProbabilityPct = Math.min(92, Math.max(25, Math.round(rawWinProb)));

  // Пошаговая симуляция боя
  const rounds: string[] = [];
  let hp1 = myFighter.maxHp;
  let hp2 = opponent.maxHp;

  const stageLabel =
    myPlayoffMatch?.stage === 'final'
      ? 'Финал Турнира'
      : myPlayoffMatch?.stage === 'semi'
      ? 'Полуфинал'
      : '1/4 финала';

  rounds.push(
    `🔔 ${stageLabel}: [${myFighter.clanTag}] ${myFighter.nick} (Мощь: ${myFighter.powerScore.toLocaleString('ru-RU')}${
      myFighter.hasClanGear ? ', ⚒️ Клановая экипировка' : ''
    }${myFighter.hasClanTransport ? ', 🚁 Клановый транспорт' : ''}) против [${opponent.clanTag}] ${opponent.nick} (Мощь: ${opponent.powerScore.toLocaleString('ru-RU')})`
  );

  for (let r = 1; r <= 4; r++) {
    const isCrit1 = Math.random() < 0.28;
    const hit1 = Math.round(myFighter.dmg * (0.85 + Math.random() * 0.35) * (isCrit1 ? 1.65 : 1));
    hp2 = Math.max(0, hp2 - hit1);
    rounds.push(
      `⚔️ Раунд ${r}: ${myFighter.nick} наносит ${isCrit1 ? '🔥 КРИТИЧЕСКИЙ УДАР ' : ''}${hit1.toLocaleString('ru-RU')} урона! (У ${opponent.nick} осталось ${hp2.toLocaleString('ru-RU')} HP)`
    );
    if (hp2 <= 0) break;

    const dodged = Math.random() * 100 < myFighter.dodgePct;
    if (dodged) {
      rounds.push(`💨 Раунд ${r}: ${myFighter.nick} мастерски уклоняется от контратаки ${opponent.nick}!`);
    } else {
      const hit2 = Math.round(opponent.dmg * (0.8 + Math.random() * 0.3));
      hp1 = Math.max(0, hp1 - hit2);
      rounds.push(
        `🛡️ Раунд ${r}: ${opponent.nick} контратакует на ${hit2.toLocaleString('ru-RU')} урона (У ${myFighter.nick} осталось ${hp1.toLocaleString('ru-RU')} HP)`
      );
    }
    if (hp1 <= 0) break;
  }

  const isWin = hp2 <= 0 || (hp1 > 0 && Math.random() * 100 <= winProbabilityPct);
  const winner = isWin ? myFighter : opponent;
  const loser = isWin ? opponent : myFighter;

  const isFinalMatch = myPlayoffMatch?.stage === 'final';
  const isSemiMatch = myPlayoffMatch?.stage === 'semi';

  const pointsDelta = isWin ? (isFinalMatch ? 100 : isSemiMatch ? 65 : 45) : 15;
  const prestigeAwarded = isWin ? (isFinalMatch ? 120 : isSemiMatch ? 75 : 50) : 10;

  myFighter.wins += isWin ? 1 : 0;
  myFighter.losses += isWin ? 0 : 1;
  myFighter.arenaPoints = Math.max(100, myFighter.arenaPoints + (isWin ? pointsDelta : -10));

  opponent.wins += isWin ? 0 : 1;
  opponent.losses += isWin ? 1 : 0;

  // Продвигаем сетку Плей-офф (1/4 -> Полуфинал -> Финал)
  if (myPlayoffMatch && arena.playoffBracket) {
    myPlayoffMatch.winnerNick = winner.nick;
    myPlayoffMatch.winnerClanTag = winner.clanTag;
    myPlayoffMatch.status = 'completed';

    const curStage = myPlayoffMatch.stage;
    // Автоматически симулируем параллельные матчи текущей стадии
    const sameStageMatches = arena.playoffBracket.filter((m) => m.stage === curStage);
    for (const m of sameStageMatches) {
      if (m.status !== 'completed' && m.fighter1 && m.fighter2) {
        const f1Wins = m.fighter1.powerScore >= m.fighter2.powerScore ? Math.random() < 0.65 : Math.random() < 0.35;
        m.winnerNick = f1Wins ? m.fighter1.nick : m.fighter2.nick;
        m.winnerClanTag = f1Wins ? m.fighter1.clanTag : m.fighter2.clanTag;
        m.status = 'completed';
      }
    }

    if (curStage === 'quarter') {
      const qf1 = arena.playoffBracket.find((m) => m.id === 'playoff_q_1');
      const qf2 = arena.playoffBracket.find((m) => m.id === 'playoff_q_2');
      const qf3 = arena.playoffBracket.find((m) => m.id === 'playoff_q_3');
      const qf4 = arena.playoffBracket.find((m) => m.id === 'playoff_q_4');
      const sf1 = arena.playoffBracket.find((m) => m.id === 'playoff_s_1');
      const sf2 = arena.playoffBracket.find((m) => m.id === 'playoff_s_2');

      if (sf1 && qf1?.winnerNick && qf2?.winnerNick) {
        const w1 = arena.fighters.find((f) => f.nick === qf1.winnerNick) || qf1.fighter1 || qf1.fighter2;
        const w2 = arena.fighters.find((f) => f.nick === qf2.winnerNick) || qf2.fighter1 || qf2.fighter2;
        sf1.fighter1 = w1 ? { ...w1 } : null;
        sf1.fighter2 = w2 ? { ...w2 } : null;
        sf1.status = 'ready';
      }
      if (sf2 && qf3?.winnerNick && qf4?.winnerNick) {
        const w3 = arena.fighters.find((f) => f.nick === qf3.winnerNick) || qf3.fighter1 || qf3.fighter2;
        const w4 = arena.fighters.find((f) => f.nick === qf4.winnerNick) || qf4.fighter1 || qf4.fighter2;
        sf2.fighter1 = w3 ? { ...w3 } : null;
        sf2.fighter2 = w4 ? { ...w4 } : null;
        sf2.status = 'ready';
      }
    } else if (curStage === 'semi') {
      const sf1 = arena.playoffBracket.find((m) => m.id === 'playoff_s_1');
      const sf2 = arena.playoffBracket.find((m) => m.id === 'playoff_s_2');
      const fin = arena.playoffBracket.find((m) => m.id === 'playoff_f_1');
      if (fin && sf1?.winnerNick && sf2?.winnerNick) {
        const w1 = arena.fighters.find((f) => f.nick === sf1.winnerNick) || sf1.fighter1 || sf1.fighter2;
        const w2 = arena.fighters.find((f) => f.nick === sf2.winnerNick) || sf2.fighter1 || sf2.fighter2;
        fin.fighter1 = w1 ? { ...w1 } : null;
        fin.fighter2 = w2 ? { ...w2 } : null;
        fin.status = 'ready';
      }
    } else if (curStage === 'final') {
      arena.tournamentChampionNick = winner.nick;
      arena.tournamentChampionClanTag = winner.clanTag;
    }
  }

  let awardedTitle: string | null = null;
  if (isWin) {
    if (isFinalMatch || myFighter.wins >= 3) {
      awardedTitle = ARENA_CHAMPION_TITLES[0];
    } else {
      awardedTitle = ARENA_CHAMPION_TITLES[1];
    }
    myFighter.championTitle = awardedTitle;
  }

  rounds.push(
    isWin
      ? `🏆 ПОБЕДА (${stageLabel})! [${myFighter.clanTag}] ${myFighter.nick} проходит дальше в сетке Плей-офф! (+${pointsDelta} очков арены, +${prestigeAwarded} престижа клана)`
      : `⚔️ Поединок (${stageLabel}) завершён победой [${opponent.clanTag}] ${opponent.nick}. Вы получили боевой опыт и +10 престижа клана.`
  );

  // Начисляем престиж и ресурсы клану
  clan.prestigePoints = Math.max(0, Number(clan.prestigePoints || 0)) + prestigeAwarded;
  clan.influencePoints = Math.max(0, Number(clan.influencePoints || 0)) + prestigeAwarded;
  arena.clanPrestigeScores[clan.id] = (arena.clanPrestigeScores[clan.id] || 0) + prestigeAwarded;

  const matchLog: ClanArenaMatchLog = {
    id: `arena_m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    timeStr: formatClanLogTime(Date.now()),
    roundLabel: stageLabel,
    fighter1Nick: myFighter.nick,
    fighter1ClanTag: myFighter.clanTag,
    fighter2Nick: opponent.nick,
    fighter2ClanTag: opponent.clanTag,
    winnerNick: winner.nick,
    winnerClanId: winner.clanId,
    winnerClanTag: winner.clanTag,
    winProbabilityPct,
    pointsAwarded: pointsDelta,
    prestigeAwarded,
    titleAwarded: awardedTitle || undefined,
    combatRounds: rounds
  };

  arena.matchHistory = [matchLog, ...(arena.matchHistory || [])].slice(0, 25);
  arena.fighters.sort((a, b) => b.arenaPoints - a.arenaPoints || b.powerScore - a.powerScore);

  if (isWin) {
    addClanLogEntry(
      clan,
      playerNick,
      'arena_victory',
      `Победил в стадии «${stageLabel}» Турнира Чемпионов соперника [${loser.clanTag}] ${loser.nick} (+${pointsDelta} очк. арены, +${prestigeAwarded} престижа клана)!`,
      '🏟️'
    );
  }

  saveClansToSupabase();

  return {
    ok: true,
    isWin,
    matchLog,
    awardedTitle,
    awardedCrystals: isWin ? (isFinalMatch ? 150 : isSemiMatch ? 75 : 40) : 10,
    awardedGold: isWin ? (isFinalMatch ? 50000 : isSemiMatch ? 20000 : 10000) : 2000,
    newArenaPoints: myFighter.arenaPoints,
    stageLabel
  };
}

// ============================================================================
// КАБИНЕТ МАГНАТА, АВТО-БАЛАНС ЭКОНОМИКИ, ГОСЗАКАЗ ФАРАОНА И АВТО-СНАБЖЕНИЕ
// ============================================================================

export function getPortFactoryWorkStatus(sector: ClanTerritorySector): {
  isWorking: boolean;
  statusBadge: string;
  shortStatus: string;
  reason: string;
} {
  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  const durability = prod.buildingDurability ?? 100;
  if (durability <= 0) {
    return {
      isWorking: false,
      statusBadge: '🔴 Стоит (Сломан 0/100)',
      shortStatus: '🔴 Стоит',
      reason: 'Здание сломано (0/100)'
    };
  }

  const wage = Math.max(50, Number(prod.workerWageGold || PORT_WORKER_GOLD_PER_HOUR));
  const cash = Math.max(0, Number(prod.facilityBalanceGold ?? 0));
  if (cash < wage * 2) {
    return {
      isWorking: false,
      statusBadge: '🔴 Стоит (Нет средств в кассе)',
      shortStatus: '🔴 Стоит',
      reason: 'Нет средств в кассе'
    };
  }

  if ((prod.relicStock ?? 0) >= (prod.maxRelicStock ?? 70)) {
    return {
      isWorking: false,
      statusBadge: '🔴 Стоит (Склад продукции 100%)',
      shortStatus: '🔴 Стоит',
      reason: 'Затоваривание склада (нужен Госзаказ)'
    };
  }

  const tier =
    prod.productionTier ||
    (prod.productionStage === 'extraction' ? 1 : prod.requiresDualInput ? 3 : 2);

  if (tier >= 2 && prod.input1ResourceKey) {
    const req1 = prod.input1RequiredPerCycle ?? 2;
    const cur1 = prod.input1Stock ?? prod.fishStock ?? 0;
    if (cur1 < req1) {
      return {
        isWorking: false,
        statusBadge: `🔴 Стоит (Нет: ${prod.input1ResourceName || 'Сырье #1'})`,
        shortStatus: '🔴 Стоит',
        reason: `Не хватает «${prod.input1ResourceName || 'Сырье #1'}»`
      };
    }
  }

  if (prod.input2ResourceKey) {
    const req2 = prod.input2RequiredPerCycle ?? 1;
    const cur2 = prod.input2Stock ?? 0;
    if (cur2 < req2) {
      return {
        isWorking: false,
        statusBadge: `🔴 Стоит (Нет: ${prod.input2ResourceName || 'Сырье #2'})`,
        shortStatus: '🔴 Стоит',
        reason: `Не хватает «${prod.input2ResourceName || 'Сырье #2'}»`
      };
    }
  }

  if (prod.input3ResourceKey) {
    const req3 = prod.input3RequiredPerCycle ?? 1;
    const cur3 = prod.input3Stock ?? 0;
    if (cur3 < req3) {
      return {
        isWorking: false,
        statusBadge: `🔴 Стоит (Нет: ${prod.input3ResourceName || 'Сырье #3'})`,
        shortStatus: '🔴 Стоит',
        reason: `Не хватает «${prod.input3ResourceName || 'Сырье #3'}»`
      };
    }
  }

  const pwrReq = prod.powerRequiredPerCycle ?? 0;
  if (pwrReq > 0 && (prod.powerStock ?? 0) < pwrReq) {
    return {
      isWorking: false,
      statusBadge: '🔴 Стоит (Нет Энергии кВт)',
      shortStatus: '🔴 Стоит',
      reason: 'Не хватает Энергии (Мощности)'
    };
  }

  return {
    isWorking: true,
    statusBadge: '🟢 Работает',
    shortStatus: '🟢 Работает',
    reason: 'Цех снабжен и готов к работе'
  };
}

export function calculatePortFactoryDetailedEconomics(sector: ClanTerritorySector): {
  rawCostPerCycle: number;
  energyCostPerCycle: number;
  wagePerCycle: number;
  totalCycleCost: number;
  outputRate: number;
  unitSelfCost: number;
  sellPrice: number;
  cycleRevenue: number;
  grossCycleProfit: number;
  clanTaxPerCycle: number;
  clanTaxPerUnit: number;
  netOwnerProfitPerHour: number;
  netOwnerProfitPerUnit: number;
  recommendedMinPrice: number;
  optimalPrice20Pct: number;
  isUnprofitable: boolean;
} {
  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  const tier =
    prod.productionTier ||
    (prod.productionStage === 'extraction' ? 1 : prod.requiresDualInput ? 3 : 2);
  const outRate = Math.max(1, prod.outputRatePerHour || (tier === 1 ? 4 : 1));
  const wagePerCycle = Math.max(50, Number(prod.workerWageGold || PORT_WORKER_GOLD_PER_HOUR));

  const hasIn1 = tier >= 2 && Boolean(prod.input1ResourceKey);
  const hasIn2 = Boolean(prod.input2ResourceKey);
  const hasIn3 = Boolean(prod.input3ResourceKey);

  const in1Cost = hasIn1 ? (prod.input1RequiredPerCycle ?? 2) * (prod.rawBuyPriceGold || 80) : 0;
  const in2Cost = hasIn2
    ? (prod.input2RequiredPerCycle ?? 1) * (prod.input2BuyPriceGold || prod.rawBuyPriceGold || 130)
    : 0;
  const in3Cost = hasIn3 ? (prod.input3RequiredPerCycle ?? 1) * (prod.input3BuyPriceGold || 920) : 0;
  const rawCostPerCycle = in1Cost + in2Cost + in3Cost;

  const pwrReq = prod.powerRequiredPerCycle ?? 0;
  const energyCostPerCycle = pwrReq > 0 ? pwrReq * (prod.powerBuyPriceGold || 70) : 0;

  const totalCycleCost = rawCostPerCycle + energyCostPerCycle + wagePerCycle;
  const unitSelfCost = Math.max(1, Math.round(totalCycleCost / outRate));
  const sellPrice = Math.max(1, Number(prod.productSellPriceGold || 750));

  const cycleRevenue = sellPrice * outRate;
  const grossCycleProfit = cycleRevenue - totalCycleCost;
  const clanTaxPerCycle = grossCycleProfit > 0 ? Math.round(grossCycleProfit * 0.1) : 0;
  const netOwnerProfitPerHour = grossCycleProfit - clanTaxPerCycle;
  const netOwnerProfitPerUnit = Math.round(netOwnerProfitPerHour / outRate);
  const clanTaxPerUnit = Math.max(0, Math.round(clanTaxPerCycle / outRate));

  const recommendedMinPrice = Math.max(unitSelfCost + 5, Math.ceil(unitSelfCost * 1.12));
  const optimalPrice20Pct = Math.max(recommendedMinPrice, Math.round(unitSelfCost * 1.22));
  const isUnprofitable = sellPrice <= unitSelfCost || netOwnerProfitPerHour <= 0;

  return {
    rawCostPerCycle,
    energyCostPerCycle,
    wagePerCycle,
    totalCycleCost,
    outputRate: outRate,
    unitSelfCost,
    sellPrice,
    cycleRevenue,
    grossCycleProfit,
    clanTaxPerCycle,
    clanTaxPerUnit,
    netOwnerProfitPerHour,
    netOwnerProfitPerUnit,
    recommendedMinPrice,
    optimalPrice20Pct,
    isUnprofitable
  };
}

export function getMyOrRedBlackPortEstates(actorNick?: string | null): ClanTerritorySector[] {
  const sectors = ensureTerritoriesLoaded();
  const clean = (actorNick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim().toLowerCase();
  const owned = sectors.filter(
    (s) => (s.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim().toLowerCase() === clean
  );
  if (owned.length > 0) return owned;
  // Если у текущего профиля нет личных кастомных заводов, но он управляет базовой империей RedBlack
  return sectors.filter(
    (s) =>
      (s.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim().toLowerCase() ===
      DEFAULT_PORT_ESTATE_OWNER_NICK.toLowerCase()
  );
}

export function collectAllPortEstatesRevenue(
  actorNick: string,
  keepMinCash = 5000
): {
  ok: boolean;
  totalCollectedGold: number;
  estatesCount: number;
  message?: string;
  error?: string;
} {
  const myEstates = getMyOrRedBlackPortEstates(actorNick);
  if (myEstates.length === 0) {
    return { ok: false, totalCollectedGold: 0, estatesCount: 0, error: 'У вас нет объектов недвижимости.' };
  }

  let totalCollectedGold = 0;
  let collectedFromCount = 0;
  const now = Date.now();

  myEstates.forEach((s) => {
    const prod = normalizeSectorProduction(s);
    s.production = prod;
    const curCash = Math.floor(Number(prod.facilityBalanceGold || 0));
    if (curCash > keepMinCash) {
      const withdrawAmt = curCash - keepMinCash;
      prod.facilityBalanceGold = keepMinCash;
      totalCollectedGold += withdrawAmt;
      collectedFromCount++;
      appendPortDealProtocol(prod, {
        timestamp: now,
        actorNick,
        actionType: 'owner_withdraw',
        resourceName: 'Массовая инкассация (Кабинет Магната)',
        quantity: 1,
        goldDelta: -withdrawAmt,
        goldAmount: -withdrawAmt,
        note: `Выведено ${withdrawAmt.toLocaleString('ru-RU')} 🪙 (оставлено в кассе ${keepMinCash.toLocaleString('ru-RU')} 🪙)`
      });
    }
  });

  if (totalCollectedGold <= 0) {
    return {
      ok: false,
      totalCollectedGold: 0,
      estatesCount: 0,
      error: `Во всех кассах ваших заводов сейчас не более ${keepMinCash.toLocaleString('ru-RU')} 🪙 (свободной выручки выше резерва нет).`
    };
  }

  saveClansToSupabase();
  return {
    ok: true,
    totalCollectedGold,
    estatesCount: collectedFromCount,
    message: `💰 Выручка собрана с ${collectedFromCount} заводов: +${totalCollectedGold.toLocaleString('ru-RU')} 🪙 на ваш счёт (в кассах оставлено по ${keepMinCash.toLocaleString('ru-RU')} 🪙)!`
  };
}

export function distributeGoldToAllPortEstates(
  actorNick: string,
  totalGoldToDistribute: number,
  availableHeroGold: number
): {
  ok: boolean;
  totalSpentGold: number;
  perEstateGold: number;
  estatesCount: number;
  message?: string;
  error?: string;
} {
  const myEstates = getMyOrRedBlackPortEstates(actorNick);
  if (myEstates.length === 0) {
    return {
      ok: false,
      totalSpentGold: 0,
      perEstateGold: 0,
      estatesCount: 0,
      error: 'У вас нет объектов недвижимости.'
    };
  }

  const totalAmt = Math.max(0, Math.floor(Number(totalGoldToDistribute) || 0));
  if (totalAmt < myEstates.length * 100) {
    return {
      ok: false,
      totalSpentGold: 0,
      perEstateGold: 0,
      estatesCount: myEstates.length,
      error: `Минимальная сумма для распределения на ${myEstates.length} объектов: ${(myEstates.length * 100).toLocaleString('ru-RU')} 🪙.`
    };
  }

  if (availableHeroGold < totalAmt) {
    return {
      ok: false,
      totalSpentGold: 0,
      perEstateGold: 0,
      estatesCount: myEstates.length,
      error: `Недостаточно золота у героя! Требуется ${totalAmt.toLocaleString('ru-RU')} 🪙 (у вас: ${availableHeroGold.toLocaleString('ru-RU')} 🪙).`
    };
  }

  const perEstate = Math.floor(totalAmt / myEstates.length);
  const remainder = totalAmt - perEstate * myEstates.length;
  const now = Date.now();

  myEstates.forEach((s, idx) => {
    const prod = normalizeSectorProduction(s);
    s.production = prod;
    const addGold = perEstate + (idx === 0 ? remainder : 0);
    prod.facilityBalanceGold = Math.floor(Number(prod.facilityBalanceGold || 0)) + addGold;
    appendPortDealProtocol(prod, {
      timestamp: now,
      actorNick,
      actionType: 'owner_deposit',
      resourceName: 'Массовое пополнение кассы',
      quantity: 1,
      goldDelta: addGold,
      goldAmount: addGold,
      note: `Касса пополнена на +${addGold.toLocaleString('ru-RU')} 🪙 из Кабинета Магната`
    });
  });

  saveClansToSupabase();
  return {
    ok: true,
    totalSpentGold: totalAmt,
    perEstateGold: perEstate,
    estatesCount: myEstates.length,
    message: `🏦 Кассы всех ${myEstates.length} заводов пополнены поровну (~по +${perEstate.toLocaleString('ru-RU')} 🪙, всего внесено ${totalAmt.toLocaleString('ru-RU')} 🪙)!`
  };
}

export function autoBalanceAllPortEstatesPrices(actorNick: string): {
  ok: boolean;
  updatedCount: number;
  message?: string;
  error?: string;
} {
  const myEstates = getMyOrRedBlackPortEstates(actorNick);
  if (myEstates.length === 0) {
    return { ok: false, updatedCount: 0, error: 'У вас нет объектов недвижимости.' };
  }

  const now = Date.now();
  myEstates.forEach((s) => {
    const prod = normalizeSectorProduction(s);
    s.production = prod;
    const balDef = getBalancedDefaultPricesForSector(s);
    prod.rawBuyPriceGold = balDef.rawBuyPriceGold;
    if (prod.input2ResourceKey) prod.input2BuyPriceGold = balDef.input2BuyPriceGold;
    if (prod.input3ResourceKey) prod.input3BuyPriceGold = balDef.input3BuyPriceGold;
    prod.workerWageGold = PORT_WORKER_GOLD_PER_HOUR;

    const econ = calculatePortFactoryDetailedEconomics(s);
    // Себестоимость + 20% чистой прибыли владельца (с учетом 10% кланового налога)
    const targetSellPrice = Math.max(econ.unitSelfCost + 10, Math.round(econ.unitSelfCost * 1.22));
    prod.productSellPriceGold = targetSellPrice;

    appendPortDealProtocol(prod, {
      timestamp: now,
      actorNick,
      actionType: 'owner_deposit',
      resourceName: 'Авто-баланс цен (+20% прибыли)',
      quantity: 1,
      goldDelta: 0,
      goldAmount: 0,
      note: `Установлена рентабельная цена продажи: ${targetSellPrice} 🪙 (Себестоимость: ${econ.unitSelfCost} 🪙)`
    });
  });

  saveClansToSupabase();
  return {
    ok: true,
    updatedCount: myEstates.length,
    message: `🔄 Авто-баланс выполнен на всех ${myEstates.length} заводах! Выставлены оптимальные цены закупки и продажи (Себестоимость + 20% чистой прибыли).`
  };
}

export function fulfillPharaohStateOrder(
  sectorId: string,
  actorNick: string
): {
  ok: boolean;
  sector?: ClanTerritorySector;
  soldQty?: number;
  unitPriceGold?: number;
  creditedToCashbox?: number;
  clanTaxGold?: number;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект недвижимости не найден.' };

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  const curStock = Math.floor(Number(prod.relicStock || 0));
  const maxStock = Math.max(10, Math.floor(Number(prod.maxRelicStock || 70)));
  if (curStock <= 0) {
    return { ok: false, error: 'На складе завода нет готовой продукции для сдачи по Госзаказу.' };
  }

  // Выкупается 50% склада по цене «Себестоимость + 15% прибыли»
  const qtyToSell = Math.max(1, Math.floor(curStock >= maxStock ? maxStock * 0.5 : curStock * 0.5));
  const econ = calculatePortFactoryDetailedEconomics(sector);
  const stateUnitPrice = Math.max(econ.unitSelfCost + 5, Math.round(econ.unitSelfCost * 1.15));
  const grossPayout = qtyToSell * stateUnitPrice;
  const clanTaxGold = Math.max(1, Math.round(grossPayout * 0.1));
  const netToCashbox = Math.max(1, grossPayout - clanTaxGold);

  prod.relicStock = Math.max(0, curStock - qtyToSell);
  if (prod.productionTier === 2) {
    prod.processedStock = prod.relicStock;
  }
  prod.facilityBalanceGold = Math.floor(Number(prod.facilityBalanceGold || 0)) + netToCashbox;

  // Начисляем 10% налога в казну контролирующего клана
  const ownerClan =
    (sector.ownerClanId ? inMemoryClans.find((c) => c.id === sector.ownerClanId) : null) ||
    (sector.ownerClanTag
      ? inMemoryClans.find((c) => c.tag.toLowerCase() === (sector.ownerClanTag || '').toLowerCase())
      : null);
  if (ownerClan) {
    ownerClan.treasuryGold = Math.floor(Number(ownerClan.treasuryGold || 0)) + clanTaxGold;
    ownerClan.unassignedPtsPool = Math.floor(Number(ownerClan.unassignedPtsPool || 0)) + Math.max(1, Math.floor(clanTaxGold / 500));
  }

  appendPortDealProtocol(prod, {
    timestamp: Date.now(),
    actorNick,
    actionType: 'buy_output',
    resourceName: `Госзаказ Фараона (${prod.outputProductName || 'Продукция'})`,
    quantity: qtyToSell,
    goldDelta: netToCashbox,
    goldAmount: netToCashbox,
    clanTaxGold,
    note: `Госзаказ (Себестоимость +15%): ${qtyToSell} ед. по ${stateUnitPrice} 🪙 (+${netToCashbox.toLocaleString('ru-RU')} 🪙 в кассу, налог клану: ${clanTaxGold} 🪙)`
  });

  saveClansToSupabase();
  return {
    ok: true,
    sector,
    soldQty: qtyToSell,
    unitPriceGold: stateUnitPrice,
    creditedToCashbox: netToCashbox,
    clanTaxGold,
    message: `📦 Госзаказ Фараона выполнен! Государство выкупило ${qtyToSell} ед. «${prod.outputProductName || 'Продукция'}» по ${stateUnitPrice.toLocaleString('ru-RU')} 🪙 (Себестоимость + 15%). В кассу завода зачислено +${netToCashbox.toLocaleString('ru-RU')} 🪙 (налог клану 10%: ${clanTaxGold.toLocaleString('ru-RU')} 🪙)!`
  };
}

export function autoSupplyFactoryFromTerminal(
  sectorId: string,
  actorNick: string,
  availableHeroGold: number
): {
  ok: boolean;
  sector?: ClanTerritorySector;
  paidFromCashbox: number;
  paidFromHeroGold: number;
  suppliedItemsText: string;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) {
    return {
      ok: false,
      paidFromCashbox: 0,
      paidFromHeroGold: 0,
      suppliedItemsText: '',
      error: 'Объект недвижимости не найден.'
    };
  }

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;

  const tier =
    prod.productionTier ||
    (prod.productionStage === 'extraction' ? 1 : prod.requiresDualInput ? 3 : 2);

  interface MissingNeed {
    slot: 1 | 2 | 3 | 'power';
    name: string;
    missingQty: number;
    unitPriceWithDelivery: number;
  }

  const needs: MissingNeed[] = [];

  if (tier >= 2 && prod.input1ResourceKey) {
    const cur1 = prod.input1Stock ?? prod.fishStock ?? 0;
    const max1 = prod.maxInput1Stock ?? prod.maxFishStock ?? 100;
    if (cur1 < max1) {
      const termMeta = PORT_TERMINAL_CATALOG.find((m) => m.key === prod.input1ResourceKey);
      const baseP = termMeta?.buyPriceGold || prod.rawBuyPriceGold || 80;
      needs.push({
        slot: 1,
        name: prod.input1ResourceName || termMeta?.name || 'Сырье #1',
        missingQty: max1 - cur1,
        unitPriceWithDelivery: Math.ceil(baseP * 1.1)
      });
    }
  }

  if (prod.input2ResourceKey) {
    const cur2 = prod.input2Stock ?? 0;
    const max2 = prod.maxInput2Stock ?? 100;
    if (cur2 < max2) {
      const termMeta = PORT_TERMINAL_CATALOG.find((m) => m.key === prod.input2ResourceKey);
      const baseP = termMeta?.buyPriceGold || prod.input2BuyPriceGold || 130;
      needs.push({
        slot: 2,
        name: prod.input2ResourceName || termMeta?.name || 'Сырье #2',
        missingQty: max2 - cur2,
        unitPriceWithDelivery: Math.ceil(baseP * 1.1)
      });
    }
  }

  if (prod.input3ResourceKey) {
    const cur3 = prod.input3Stock ?? 0;
    const max3 = prod.maxInput3Stock ?? 100;
    if (cur3 < max3) {
      const termMeta = PORT_TERMINAL_CATALOG.find((m) => m.key === prod.input3ResourceKey);
      const baseP = termMeta?.buyPriceGold || prod.input3BuyPriceGold || 920;
      needs.push({
        slot: 3,
        name: prod.input3ResourceName || termMeta?.name || 'Сырье #3',
        missingQty: max3 - cur3,
        unitPriceWithDelivery: Math.ceil(baseP * 1.1)
      });
    }
  }

  if ((prod.powerRequiredPerCycle ?? 0) > 0) {
    const curPwr = prod.powerStock ?? 0;
    const maxPwr = prod.maxPowerStock ?? 200;
    if (curPwr < maxPwr) {
      const baseP = prod.powerBuyPriceGold || 70;
      needs.push({
        slot: 'power',
        name: 'Мощность (Энергия)',
        missingQty: maxPwr - curPwr,
        unitPriceWithDelivery: Math.ceil(baseP * 1.1)
      });
    }
  }

  if (needs.length === 0) {
    return {
      ok: false,
      paidFromCashbox: 0,
      paidFromHeroGold: 0,
      suppliedItemsText: '',
      error: 'Все склады сырья и энергии на этом заводе уже заполнены на 100%!'
    };
  }

  const reserveForWorkers = (prod.workerWageGold || PORT_WORKER_GOLD_PER_HOUR) * 2;
  let availCashbox = Math.max(0, Math.floor(Number(prod.facilityBalanceGold || 0)) - reserveForWorkers);
  let availHero = Math.max(0, Math.floor(Number(availableHeroGold || 0)));

  let paidFromCashbox = 0;
  let paidFromHeroGold = 0;
  const boughtParts: string[] = [];

  for (const item of needs) {
    const maxAffordable = Math.floor((availCashbox + availHero) / item.unitPriceWithDelivery);
    const buyQty = Math.min(item.missingQty, maxAffordable);
    if (buyQty <= 0) continue;

    const cost = buyQty * item.unitPriceWithDelivery;
    const fromCash = Math.min(availCashbox, cost);
    const fromHero = cost - fromCash;

    availCashbox -= fromCash;
    availHero -= fromHero;
    paidFromCashbox += fromCash;
    paidFromHeroGold += fromHero;

    if (item.slot === 1) {
      const next1 = (prod.input1Stock ?? prod.fishStock ?? 0) + buyQty;
      prod.input1Stock = next1;
      prod.fishStock = next1;
    } else if (item.slot === 2) {
      prod.input2Stock = (prod.input2Stock ?? 0) + buyQty;
    } else if (item.slot === 3) {
      prod.input3Stock = (prod.input3Stock ?? 0) + buyQty;
    } else if (item.slot === 'power') {
      prod.powerStock = (prod.powerStock ?? 0) + buyQty;
    }

    boughtParts.push(`${item.name}: +${buyQty} ед.`);
  }

  if (boughtParts.length === 0) {
    return {
      ok: false,
      paidFromCashbox: 0,
      paidFromHeroGold: 0,
      suppliedItemsText: '',
      error: 'Недостаточно золота в кассе завода и на личном счету для закупки сырья с Терминала!'
    };
  }

  prod.facilityBalanceGold = Math.max(0, Math.floor(Number(prod.facilityBalanceGold || 0)) - paidFromCashbox);
  const totalCost = paidFromCashbox + paidFromHeroGold;
  const suppliedSummary = boughtParts.join(', ');

  appendPortDealProtocol(prod, {
    timestamp: Date.now(),
    actorNick,
    actionType: 'sell_input',
    resourceName: 'Авто-снабжение с Терминала (+10% доставка)',
    quantity: 1,
    goldDelta: -paidFromCashbox,
    goldAmount: -totalCost,
    note: `Закуплено: ${suppliedSummary} (из кассы: ${paidFromCashbox.toLocaleString('ru-RU')} 🪙, личное золото: ${paidFromHeroGold.toLocaleString('ru-RU')} 🪙)`
  });

  saveClansToSupabase();
  return {
    ok: true,
    sector,
    paidFromCashbox,
    paidFromHeroGold,
    suppliedItemsText: suppliedSummary,
    message: `🚚 Авто-снабжение выполнено (${suppliedSummary}) за ${totalCost.toLocaleString('ru-RU')} 🪙 (+10% за доставку)! Завод полностью снабжен для работы.`
  };
}

// ============================================================================
// МОДЕРНИЗАЦИЯ ЗАВОДОВ (УР. 1–5), ШТУРМОВОЙ ЗАРЯД, REDBLACK, БИРЖА ТРУДА И ЗАКАЗЫ КЛАНА
// ============================================================================

export function upgradePortFactoryLevel(
  sectorId: string,
  actorNick: string,
  availableHeroGold: number,
  playerPortResources: Record<string, number>
): {
  ok: boolean;
  sector?: ClanTerritorySector;
  newLevel?: number;
  paidFromCashbox?: number;
  paidFromHeroGold?: number;
  consumedResources?: Array<{ key: PortTerminalResourceKey; qty: number; name: string }>;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект недвижимости не найден.' };

  const cleanActor = actorNick.trim().toLowerCase();
  const cleanOwner = (sector.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim().toLowerCase();
  if (cleanActor !== cleanOwner && cleanActor !== 'redblack' && cleanActor !== 'admin') {
    return {
      ok: false,
      error: `Модернизировать производственные площади может только владелец объекта (${sector.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK})!`
    };
  }

  const prod = normalizeSectorProduction(sector);
  const curLevel = Math.max(1, Math.min(5, Math.floor(Number(prod.facilityLevel || 1))));
  if (curLevel >= 5) {
    return { ok: false, error: `Объект «${sector.name}» уже модернизирован до максимального Уровня 5!` };
  }

  const nextLevel = (curLevel + 1) as 2 | 3 | 4 | 5;
  const nextCfg = getPortFacilityLevelConfig(nextLevel);

  // Проверяем наличие ресурсов у игрока
  for (const req of nextCfg.upgradeResources) {
    const have = Math.max(0, Math.floor(Number(playerPortResources[req.key] || 0)));
    if (have < req.qty) {
      return {
        ok: false,
        error: `Недостаточно ресурса «${req.name}» для расширения до Ур. ${nextLevel}! Требуется: ${req.qty} ед. (в инвентаре: ${have} ед.).`
      };
    }
  }

  // Проверяем наличие золота (сначала списываем из кассы завода, оставив резерв 1000 🪙, остальное — с героя)
  const goldCost = nextCfg.upgradeCostGold;
  const availCashbox = Math.max(0, Math.floor(Number(prod.facilityBalanceGold || 0)) - 1000);
  const availHero = Math.max(0, Math.floor(Number(availableHeroGold || 0)));
  if (availCashbox + availHero < goldCost) {
    return {
      ok: false,
      error: `Недостаточно золота для модернизации до Ур. ${nextLevel}! Требуется ${goldCost.toLocaleString('ru-RU')} 🪙 (доступно в кассе и кошельке: ${(availCashbox + availHero).toLocaleString('ru-RU')} 🪙).`
    };
  }

  const paidFromCashbox = Math.min(availCashbox, goldCost);
  const paidFromHeroGold = goldCost - paidFromCashbox;

  prod.facilityBalanceGold = Math.max(0, Math.floor(Number(prod.facilityBalanceGold || 0)) - paidFromCashbox);
  prod.facilityLevel = nextLevel;
  prod.maxRelicStock = nextCfg.maxStorage;
  prod.maxProcessedStock = nextCfg.maxStorage;
  prod.maxInput1Stock = Math.max(nextCfg.maxStorage * 2, prod.maxInput1Stock || 200);
  prod.maxFishStock = prod.maxInput1Stock;
  if (prod.input2ResourceKey) {
    prod.maxInput2Stock = Math.max(nextCfg.maxStorage * 2, prod.maxInput2Stock || 200);
  }
  if (prod.input3ResourceKey) {
    prod.maxInput3Stock = Math.max(nextCfg.maxStorage * 2, prod.maxInput3Stock || 200);
  }

  sector.production = normalizeSectorProduction(sector);

  appendPortDealProtocol(sector.production, {
    timestamp: Date.now(),
    actorNick,
    actionType: 'owner_withdraw',
    resourceName: `Модернизация завода (Ур. ${curLevel} → Ур. ${nextLevel})`,
    quantity: 1,
    goldDelta: -paidFromCashbox,
    goldAmount: -goldCost,
    note: `Площадь расширена до Ур. ${nextLevel} (${nextCfg.maxWorkers} раб. мест, склад ${nextCfg.maxStorage} ед., выпуск x${nextCfg.outputMultiplier})`
  });

  saveClansToSupabase();

  const resSummary = nextCfg.upgradeResources.map((r) => `${r.name} x${r.qty}`).join(', ');
  return {
    ok: true,
    sector,
    newLevel: nextLevel,
    paidFromCashbox,
    paidFromHeroGold,
    consumedResources: nextCfg.upgradeResources,
    message: `⬆️ Завод «${sector.name}» расширен до Уровня ${nextLevel}! Мест: ${nextCfg.maxWorkers} | Склад: ${nextCfg.maxStorage} ед. | Выпуск: x${nextCfg.outputMultiplier} (потрачено: ${goldCost.toLocaleString('ru-RU')} 🪙${resSummary ? ` + ${resSummary}` : ''}).`
  };
}

export function adminAssignAllEstatesToRedblack(): {
  ok: boolean;
  updatedCount: number;
  message: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const rbClan =
    inMemoryClans.find((c) => c.clanNumber === 1 || c.tag.toUpperCase() === 'ТЕСТ') ||
    inMemoryClans[0];
  let updatedCount = 0;

  for (const s of sectors) {
    s.ownerNick = DEFAULT_PORT_ESTATE_OWNER_NICK;
    s.ownerClanId = rbClan?.id || 'clan_redblack_test';
    s.ownerClanName = rbClan?.name || 'Тест';
    s.ownerClanTag = rbClan?.tag || 'ТЕСТ';
    s.ownerClanEmblem = rbClan?.emblem || '👑';
    s.warStatus = 'peace';
    s.battle7x7 = null;
    s.protectionUntil = 0;

    const prod = normalizeSectorProduction(s);
    prod.buildingDurability = 100;
    prod.maxBuildingDurability = 100;
    if ((prod.facilityBalanceGold || 0) < 25000) {
      prod.facilityBalanceGold = 25000;
    }
    s.production = prod;
    updatedCount++;
  }

  saveClansToSupabase();
  return {
    ok: true,
    updatedCount,
    message: `👑 Все ${updatedCount} объектов недвижимости острова переданы под контроль владельца Redblack (Клан #1 [ТЕСТ] Тест), прочность восстановлена до 100/100, касса каждого завода пополнена до ≥25 000 🪙!`
  };
}

export function activateAssaultChargeFor7x7Battle(
  sectorId: string,
  actorNick: string,
  availableCharges: number
): {
  ok: boolean;
  sector?: ClanTerritorySector;
  message?: string;
  error?: string;
} {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector || !sector.battle7x7) {
    return { ok: false, error: 'На этом объекте сейчас нет активного штурма 7х7.' };
  }
  const b = sector.battle7x7;
  if (b.phase === 'finished') {
    return { ok: false, error: 'Штурм уже завершен.' };
  }
  if (b.assaultChargeActive) {
    return { ok: false, error: `Штурмовой Заряд уже заложен (${b.assaultChargeActivatedBy || 'штурмовиком'})!` };
  }
  if (availableCharges < 1) {
    return {
      ok: false,
      error: 'У вас в инвентаре нет «Штурмового Заряда» (💣)! Произведите или купите его в Цехе Осадных Боеприпасов [8/5].'
    };
  }

  b.assaultChargeActive = true;
  b.assaultChargeActivatedBy = actorNick;
  const chargeMsg = `💣 ОСАДНЫЙ ПОДРЫВ: ${actorNick} активировал «Штурмовой Заряд»! В 1-м раунде урон всех атакующих увеличен на +25%, а бонус защиты вражеского Форпоста снижен на 50%!`;
  if (b.roundLogs.length > 0) {
    b.roundLogs[0].events.unshift(chargeMsg);
  } else {
    b.summaryText = chargeMsg;
  }
  saveClansToSupabase();

  return {
    ok: true,
    sector,
    message: `💣 Вы активировали «Штурмовой Заряд» при штурме «${sector.name}»! (+25% урона атакующим в 1-м раунде и -50% защиты Форпоста врага)`
  };
}

function canMemberManageClanOrders(clan: Clan, actorNick: string): boolean {
  const clean = actorNick.trim().toLowerCase();
  if (clean === 'redblack' || clean === 'admin') return true;
  if (clan.leaderNick.trim().toLowerCase() === clean) return true;
  const m = clan.members.find((x) => x.nick.trim().toLowerCase() === clean);
  return Boolean(m && (m.role === 'leader' || m.role === 'officer' || m.permissions?.canManageBaseAndDiplomacy));
}

export function createClanSupplyOrder(
  clanId: string,
  actorNick: string,
  resourceKey: PortTerminalResourceKey,
  totalQuantity: number,
  unitPriceGold: number
): {
  ok: boolean;
  clan?: Clan;
  order?: ClanSupplyOrderEntry;
  message?: string;
  error?: string;
} {
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  if (!canMemberManageClanOrders(clan, actorNick)) {
    return { ok: false, error: 'Создавать клановые заказы на снабжение могут только Глава и Заместители клана!' };
  }

  const resMeta =
    DEFAULT_PORT_ALL_RESOURCES_CATALOG.find((m) => m.key === resourceKey) ||
    PORT_TERMINAL_CATALOG.find((m) => m.key === resourceKey);
  if (!resMeta) return { ok: false, error: 'Ресурс не найден в каталоге Порта.' };

  const qty = Math.max(1, Math.min(500, Math.floor(Number(totalQuantity) || 5)));
  const price = Math.max(10, Math.min(50000, Math.floor(Number(unitPriceGold) || resMeta.buyPriceGold || 500)));
  const maxTotalCost = qty * price;

  if ((clan.treasuryGold || 0) < maxTotalCost) {
    return {
      ok: false,
      error: `В казне клана недостаточно золота для обеспечения заказа (${maxTotalCost.toLocaleString('ru-RU')} 🪙, в казне: ${(clan.treasuryGold || 0).toLocaleString('ru-RU')} 🪙)!`
    };
  }

  if (!Array.isArray(clan.supplyOrders)) {
    clan.supplyOrders = [];
  }

  const w = getPortResourceWeight(resourceKey);
  const ptsPerUnit = w >= 5 ? 5 : w >= 2 ? 2 : 1;

  const order: ClanSupplyOrderEntry = {
    id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    resourceKey,
    resourceName: resMeta.name,
    resourceIcon: resMeta.icon,
    requestedQty: qty,
    deliveredQty: 0,
    pricePerUnitGold: price,
    ptsPerUnit,
    createdByNick: actorNick,
    createdAt: Date.now()
  };

  clan.supplyOrders.unshift(order);
  addClanLogEntry(
    clan,
    actorNick,
    'port_production',
    `Создан клановый заказ на снабжение: ${resMeta.icon} «${resMeta.name}» x${qty} шт. по цене ${price.toLocaleString('ru-RU')} 🪙/шт. (+${ptsPerUnit} PTS/шт.).`,
    '📦'
  );

  saveClansToSupabase();
  return {
    ok: true,
    clan,
    order,
    message: `📦 Создан клановый заказ: ${resMeta.icon} «${resMeta.name}» (${qty} шт. по ${price.toLocaleString('ru-RU')} 🪙/шт.)!`
  };
}

export function deleteClanSupplyOrder(
  clanId: string,
  actorNick: string,
  orderId: string
): {
  ok: boolean;
  clan?: Clan;
  message?: string;
  error?: string;
} {
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };
  if (!canMemberManageClanOrders(clan, actorNick)) {
    return { ok: false, error: 'Удалять заказы могут только Глава и Заместители клана!' };
  }
  clan.supplyOrders = (clan.supplyOrders || []).filter((o) => o.id !== orderId);
  saveClansToSupabase();
  return { ok: true, clan, message: 'Заказ на снабжение закрыт.' };
}

export function fulfillClanSupplyOrder(
  clanId: string,
  actorNick: string,
  orderId: string,
  deliverQty: number,
  availablePlayerQty: number
): {
  ok: boolean;
  clan?: Clan;
  deliveredQty?: number;
  goldEarned?: number;
  ptsAwarded?: number;
  resourceKey?: PortTerminalResourceKey;
  message?: string;
  error?: string;
} {
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const order = (clan.supplyOrders || []).find((o) => o.id === orderId);
  if (!order) return { ok: false, error: 'Клановый заказ не найден или уже закрыт.' };

  const remaining = Math.max(0, order.requestedQty - order.deliveredQty);
  if (remaining <= 0) {
    return { ok: false, error: 'Этот заказ уже полностью выполнен!' };
  }

  const qty = Math.max(1, Math.min(remaining, Math.floor(Number(deliverQty) || 1)));
  if (availablePlayerQty < qty) {
    return {
      ok: false,
      error: `У вас в инвентаре недостаточно «${order.resourceName}» (в наличии: ${availablePlayerQty} шт., хотите сдать: ${qty} шт.)!`
    };
  }

  const totalGold = qty * order.pricePerUnitGold;
  if ((clan.treasuryGold || 0) < totalGold) {
    return {
      ok: false,
      error: `В казне клана недостаточно золота для оплаты поставки (${totalGold.toLocaleString('ru-RU')} 🪙)!`
    };
  }

  clan.treasuryGold = Math.max(0, (clan.treasuryGold || 0) - totalGold);
  order.deliveredQty += qty;

  // За каждую единицу ресурса 3-го этапа начисляем +5 личных PTS (2-го этапа +2 PTS, 1-го этапа +1 PTS)
  const ptsPerUnit = order.ptsPerUnit || (getPortResourceWeight(order.resourceKey) >= 5 ? 5 : 2);
  const ptsAwarded = qty * ptsPerUnit;
  const cleanActor = actorNick.trim().toLowerCase();
  const memberObj = clan.members.find((m) => m.nick.trim().toLowerCase() === cleanActor);
  if (memberObj) {
    memberObj.clanPts = (memberObj.clanPts || 0) + ptsAwarded;
  }

  if (order.deliveredQty >= order.requestedQty) {
    clan.supplyOrders = (clan.supplyOrders || []).filter((o) => o.id !== order.id);
  }

  addClanLogEntry(
    clan,
    actorNick,
    'port_production',
    `${actorNick} сдал по заказу клана ${order.resourceIcon} «${order.resourceName}» x${qty} шт. Выплачено из казны: ${totalGold.toLocaleString('ru-RU')} 🪙 (+${ptsAwarded} PTS).`,
    order.resourceIcon
  );

  saveClansToSupabase();
  return {
    ok: true,
    clan,
    deliveredQty: qty,
    goldEarned: totalGold,
    ptsAwarded,
    resourceKey: order.resourceKey,
    message: `✅ Вы сдали ${qty} шт. «${order.resourceName}» в клан [${clan.tag}] и получили +${totalGold.toLocaleString('ru-RU')} 🪙 из Казны и +${ptsAwarded} личных PTS!`
  };
}

export interface PortLaborExchangeRow {
  sectorId: string;
  sectorName: string;
  sectorIcon: string;
  mapX: number;
  mapY: number;
  ownerNick: string;
  ownerClanTag: string;
  facilityLevel: number;
  activeWorkersCount: number;
  maxWorkers: number;
  freePlaces: number;
  wagePerHourGold: number;
  facilityBalanceGold: number;
  canWorkNow: boolean;
  statusNote: string;
}

export function getPortLaborExchangeList(): PortLaborExchangeRow[] {
  const sectors = ensureTerritoriesLoaded();
  const now = Date.now();
  const rows: PortLaborExchangeRow[] = [];

  for (const s of sectors) {
    const prod = normalizeSectorProduction(s);
    const coords = normalizePortIslandCoord(s.mapX, s.mapY);
    const lvlCfg = getPortFacilityLevelConfig(prod.facilityLevel);
    const maxWorkers = prod.isMerged ? Math.max(PORT_MERGED_MAX_WORKERS, lvlCfg.maxWorkers) : lvlCfg.maxWorkers;
    const activeCount = (prod.workers || []).filter((w) => !w.claimed && w.endsAt > now).length;
    const freePlaces = Math.max(0, maxWorkers - activeCount);
    const wage = Math.max(50, Math.floor(Number(prod.workerWageGold || PORT_WORKER_GOLD_PER_HOUR)));
    const cash = Math.max(0, Math.floor(Number(prod.facilityBalanceGold || 0)));

    const tier = prod.productionTier || (prod.productionStage === 'extraction' ? 1 : 2);
    const hasIn2 = Boolean(prod.input2ResourceKey);
    const hasIn3 = Boolean(prod.input3ResourceKey);
    const req1 = prod.input1RequiredPerCycle ?? 2;
    const req2 = hasIn2 ? (prod.input2RequiredPerCycle ?? 2) : 0;
    const req3 = hasIn3 ? (prod.input3RequiredPerCycle ?? 1) : 0;
    const reqPwr = prod.powerRequiredPerCycle ?? 0;

    const cur1 = prod.input1Stock ?? prod.fishStock ?? 0;
    const cur2 = hasIn2 ? (prod.input2Stock ?? 0) : 0;
    const cur3 = hasIn3 ? (prod.input3Stock ?? 0) : 0;
    const curPwr = prod.powerStock ?? 0;

    const hasInputs =
      tier === 1 ||
      prod.productionStage === 'extraction' ||
      (cur1 >= req1 && (!hasIn2 || cur2 >= req2) && (!hasIn3 || cur3 >= req3) && (reqPwr <= 0 || curPwr >= reqPwr));
    const hasOutputSpace = prod.relicStock < prod.maxRelicStock;
    const hasCash = cash >= wage * 2;
    const notBroken = (prod.buildingDurability ?? 100) > 0;

    const canWorkNow = freePlaces > 0 && hasCash && hasInputs && hasOutputSpace && notBroken;
    let statusNote = 'Готов к смене';
    if (!notBroken) statusNote = 'Здание сломано';
    else if (freePlaces <= 0) statusNote = 'Мест нет';
    else if (!hasCash) statusNote = 'Мало золота в кассе';
    else if (!hasOutputSpace) statusNote = 'Склад продукции полон';
    else if (!hasInputs) statusNote = 'Ждет подвоза сырья';

    rows.push({
      sectorId: s.id,
      sectorName: s.name,
      sectorIcon: s.icon,
      mapX: coords.x,
      mapY: coords.y,
      ownerNick: s.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK,
      ownerClanTag: s.ownerClanTag || 'ТЕСТ',
      facilityLevel: prod.facilityLevel || 1,
      activeWorkersCount: activeCount,
      maxWorkers,
      freePlaces,
      wagePerHourGold: wage,
      facilityBalanceGold: cash,
      canWorkNow,
      statusNote
    });
  }

  return rows.sort((a, b) => {
    if (a.canWorkNow !== b.canWorkNow) return a.canWorkNow ? -1 : 1;
    return b.wagePerHourGold - a.wagePerHourGold;
  });
}

export interface PortTradeSummaryRow {
  sectorId: string;
  sectorName: string;
  sectorIcon: string;
  mapX: number;
  mapY: number;
  ownerNick: string;
  facilityLevel: number;
  outputName: string;
  outputIcon: string;
  outputStock: number;
  maxOutputStock: number;
  sellPriceGold: number;
  buyingNeeds: Array<{
    resourceName: string;
    currentStock: number;
    maxStock: number;
    buyPriceGold: number;
  }>;
}

export function getPortTradeSummaryList(): PortTradeSummaryRow[] {
  const sectors = ensureTerritoriesLoaded();
  return sectors.map((s) => {
    const prod = normalizeSectorProduction(s);
    const coords = normalizePortIslandCoord(s.mapX, s.mapY);
    const tier = prod.productionTier || (prod.productionStage === 'extraction' ? 1 : 2);
    const buyingNeeds: PortTradeSummaryRow['buyingNeeds'] = [];

    if (tier >= 2 && prod.input1ResourceKey) {
      buyingNeeds.push({
        resourceName: prod.input1ResourceName || 'Сырье #1',
        currentStock: prod.input1Stock ?? prod.fishStock ?? 0,
        maxStock: prod.maxInput1Stock ?? prod.maxFishStock ?? 100,
        buyPriceGold: prod.rawBuyPriceGold || 80
      });
    }
    if (prod.input2ResourceKey) {
      buyingNeeds.push({
        resourceName: prod.input2ResourceName || 'Сырье #2',
        currentStock: prod.input2Stock ?? 0,
        maxStock: prod.maxInput2Stock ?? 100,
        buyPriceGold: prod.input2BuyPriceGold || 120
      });
    }
    if (prod.input3ResourceKey) {
      buyingNeeds.push({
        resourceName: prod.input3ResourceName || 'Сырье #3',
        currentStock: prod.input3Stock ?? 0,
        maxStock: prod.maxInput3Stock ?? 100,
        buyPriceGold: prod.input3BuyPriceGold || 900
      });
    }
    if ((prod.powerRequiredPerCycle ?? 0) > 0) {
      buyingNeeds.push({
        resourceName: '⚡ Мощность (кВт)',
        currentStock: prod.powerStock ?? 0,
        maxStock: prod.maxPowerStock ?? 200,
        buyPriceGold: prod.powerBuyPriceGold || 70
      });
    }

    return {
      sectorId: s.id,
      sectorName: s.name,
      sectorIcon: s.icon,
      mapX: coords.x,
      mapY: coords.y,
      ownerNick: s.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK,
      facilityLevel: prod.facilityLevel || 1,
      outputName: prod.outputProductName || 'Продукция',
      outputIcon: prod.outputProductIcon || '📦',
      outputStock: prod.relicStock || 0,
      maxOutputStock: prod.maxRelicStock || 100,
      sellPriceGold: prod.productSellPriceGold || 100,
      buyingNeeds
    };
  });
}

// ============================================================================
// ПЕРЕДАЧА НЕДВИЖИМОСТИ ИГРОКАМ, ПРИБРЕЖНАЯ ЗОНА (OUTLAND) И СТАДИОН ФАРОСА [5/5]
// ============================================================================

export function transferPortEstateOwnership(
  sectorId: string,
  actorNick: string,
  targetNickOrId: string,
  isAdmin = false
): { ok: boolean; sector?: ClanTerritorySector; message?: string; error?: string } {
  const sectors = ensureTerritoriesLoaded();
  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) {
    return { ok: false, error: 'Объект недвижимости не найден!' };
  }

  const currentOwner = (sector.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim();
  const cleanActor = (actorNick || '').trim();
  const cleanTarget = (targetNickOrId || '').trim().replace(/^@/, '');

  if (!cleanTarget) {
    return { ok: false, error: 'Введите никнейм или ID персонажа-получателя!' };
  }

  if (!isAdmin && currentOwner.toLowerCase() !== cleanActor.toLowerCase()) {
    return { ok: false, error: 'Передать объект недвижимости может только его действующий владелец или Администратор!' };
  }

  if (currentOwner.toLowerCase() === cleanTarget.toLowerCase()) {
    return { ok: false, error: `Игрок ${cleanTarget} уже является владельцем этого объекта!` };
  }

  const oldOwner = currentOwner;
  sector.ownerNick = cleanTarget;

  // Проверяем, состоит ли новый владелец в каком-либо клане, чтобы обновить клановую принадлежность при необходимости
  const targetClan = getPlayerClan(cleanTarget);
  if (targetClan) {
    sector.ownerClanId = targetClan.id;
    sector.ownerClanName = targetClan.name;
    sector.ownerClanTag = targetClan.tag;
    sector.ownerClanEmblem = targetClan.emblem;
  }

  const prod = normalizeSectorProduction(sector);
  const cashSaved = Math.max(0, Math.floor(Number(prod.facilityBalanceGold || 0)));

  appendPortDealProtocol(prod, {
    timestamp: Date.now(),
    timeStr: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    actorNick: cleanActor || oldOwner,
    actionType: 'owner_transfer',
    text: `🤝 Передача прав собственности: ${oldOwner} → ${cleanTarget} (сохранена касса завода: ${cashSaved.toLocaleString('ru-RU')} 🪙)`,
    goldDelta: 0
  });
  sector.production = prod;

  saveClansToSupabase();
  return {
    ok: true,
    sector,
    message: `🤝 Объект «${sector.name}» [${sector.mapX}/${sector.mapY}] официально передан в собственность игрока ${cleanTarget}! Вся накопленная касса (${cashSaved.toLocaleString('ru-RU')} 🪙) осталась на счету завода.`
  };
}

export const OUTLAND_SMUGGLER_PIERS: Array<{ x: number; y: number; title: string }> = [
  { x: 1, y: 5, title: 'Причал контрабандистов [1/5] (Западный берег)' },
  { x: 10, y: 5, title: 'Причал контрабандистов [10/5] (Восточный берег)' },
  { x: 5, y: 1, title: 'Причал контрабандистов [5/1] (Северный берег)' },
  { x: 5, y: 10, title: 'Причал контрабандистов [5/10] (Южный берег)' }
];

export function isOutlandSmugglerPierCell(x?: number | null, y?: number | null): boolean {
  const cx = Math.floor(Number(x) || 0);
  const cy = Math.floor(Number(y) || 0);
  return OUTLAND_SMUGGLER_PIERS.some((p) => p.x === cx && p.y === cy);
}

export interface PharosStadiumMatch {
  id: string;
  matchType: 'gladiator' | 'clan_7x7';
  title: string;
  teamAName: string;
  teamATag: string;
  teamAOdds: number;
  teamBName: string;
  teamBTag: string;
  teamBOdds: number;
  startsAt: number;
  poolTeamAGold: number;
  poolTeamBGold: number;
  poolTeamACrystals: number;
  poolTeamBCrystals: number;
  status: 'betting' | 'finished';
  winnerSide?: 'A' | 'B';
  resultSummary?: string;
}

export interface PharosStadiumBetEntry {
  id: string;
  matchId: string;
  matchTitle: string;
  playerNick: string;
  side: 'A' | 'B';
  teamName: string;
  currency: 'gold' | 'crystals';
  amount: number;
  odds: number;
  placedAt: number;
  status: 'active' | 'won' | 'lost';
  payout?: number;
}

export interface PharosStadiumState {
  ownerNick: string;
  ownerClanTag: string;
  mapX: number;
  mapY: number;
  commissionPct: number;
  commissionBoxGold: number;
  commissionBoxCrystals: number;
  totalCollectedGold: number;
  totalCollectedCrystals: number;
  matches: PharosStadiumMatch[];
  bets: PharosStadiumBetEntry[];
  updatedAt: number;
}

const PHAROS_STADIUM_STORAGE_KEY = 'egypt_game_pharos_stadium_v1';

function createDefaultStadiumMatches(now = Date.now()): PharosStadiumMatch[] {
  return [
    {
      id: `match_glad_${now}_1`,
      matchType: 'gladiator',
      title: 'Гладиаторский бой: Колизей Фароса [5/5]',
      teamAName: 'Центурион Анубиса',
      teamATag: 'ANUB',
      teamAOdds: 1.8,
      teamBName: 'Чемпион Солнечной Гвардии',
      teamBTag: 'RA',
      teamBOdds: 1.8,
      startsAt: now + 4 * 60 * 1000,
      poolTeamAGold: 12500,
      poolTeamBGold: 11800,
      poolTeamACrystals: 40,
      poolTeamBCrystals: 35,
      status: 'betting'
    },
    {
      id: `match_7x7_${now}_2`,
      matchType: 'clan_7x7',
      title: 'Турнирный матч 7х7: Битва Синдикатов',
      teamAName: '#1 [ТЕСТ] Гвардия Тест',
      teamATag: 'ТЕСТ',
      teamAOdds: 1.75,
      teamBName: '#312 [SETH] Братство Сета',
      teamBTag: 'SETH',
      teamBOdds: 1.9,
      startsAt: now + 6 * 60 * 1000,
      poolTeamAGold: 25000,
      poolTeamBGold: 19500,
      poolTeamACrystals: 85,
      poolTeamBCrystals: 60,
      status: 'betting'
    },
    {
      id: `match_7x7_${now}_3`,
      matchType: 'clan_7x7',
      title: 'Вечерний финал 7х7 за Кубок Острова',
      teamAName: '#777 [PHAR] Гвардия Фараона',
      teamATag: 'PHAR',
      teamAOdds: 1.85,
      teamBName: '#501 [NILE] Торговый Дом Нила',
      teamBTag: 'NILE',
      teamBOdds: 1.85,
      startsAt: now + 9 * 60 * 1000,
      poolTeamAGold: 18000,
      poolTeamBGold: 17500,
      poolTeamACrystals: 50,
      poolTeamBCrystals: 50,
      status: 'betting'
    }
  ];
}

let inMemoryPharosStadium: PharosStadiumState = {
  ownerNick: DEFAULT_PORT_ESTATE_OWNER_NICK,
  ownerClanTag: 'ТЕСТ',
  mapX: 5,
  mapY: 5,
  commissionPct: 10,
  commissionBoxGold: 8450,
  commissionBoxCrystals: 24,
  totalCollectedGold: 0,
  totalCollectedCrystals: 0,
  matches: createDefaultStadiumMatches(),
  bets: [],
  updatedAt: Date.now()
};

function savePharosStadiumState(): void {
  if (typeof window === 'undefined') return;
  try {
    inMemoryPharosStadium.updatedAt = Date.now();
    localStorage.setItem(PHAROS_STADIUM_STORAGE_KEY, JSON.stringify(inMemoryPharosStadium));
  } catch {}
}

export function getPharosStadiumState(): PharosStadiumState {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(PHAROS_STADIUM_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          inMemoryPharosStadium = {
            ...inMemoryPharosStadium,
            ...parsed,
            ownerNick: parsed.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK,
            ownerClanTag: parsed.ownerClanTag || 'ТЕСТ',
            mapX: 5,
            mapY: 5,
            commissionPct: 10,
            matches:
              Array.isArray(parsed.matches) && parsed.matches.length > 0
                ? parsed.matches
                : createDefaultStadiumMatches(),
            bets: Array.isArray(parsed.bets) ? parsed.bets : []
          };
        }
      } else {
        savePharosStadiumState();
      }
    } catch {}
  }

  // Ensure there are always active betting matches
  const activeCount = inMemoryPharosStadium.matches.filter((m) => m.status === 'betting').length;
  if (activeCount === 0) {
    const fresh = createDefaultStadiumMatches();
    inMemoryPharosStadium.matches = [...fresh, ...inMemoryPharosStadium.matches.slice(0, 4)];
    savePharosStadiumState();
  }

  return inMemoryPharosStadium;
}

export function placePharosStadiumBet(
  playerNick: string,
  matchId: string,
  side: 'A' | 'B',
  currency: 'gold' | 'crystals',
  amount: number,
  availableGold: number,
  availableCrystals: number
): {
  ok: boolean;
  state?: PharosStadiumState;
  bet?: PharosStadiumBetEntry;
  goldSpent?: number;
  crystalsSpent?: number;
  message?: string;
  error?: string;
} {
  const st = getPharosStadiumState();
  const match = st.matches.find((m) => m.id === matchId && m.status === 'betting');
  if (!match) {
    return { ok: false, error: 'Прием ставок на этот матч уже закрыт!' };
  }

  const cleanAmount = Math.max(1, Math.floor(Number(amount) || 0));
  if (currency === 'gold' && cleanAmount < 100) {
    return { ok: false, error: 'Минимальная ставка в золоте — 100 🪙.' };
  }
  if (currency === 'gold' && availableGold < cleanAmount) {
    return { ok: false, error: `Недостаточно золота для ставки! Требуется: ${cleanAmount.toLocaleString('ru-RU')} 🪙.` };
  }
  if (currency === 'crystals' && availableCrystals < cleanAmount) {
    return { ok: false, error: `Недостаточно кристаллов для ставки! Требуется: ${cleanAmount.toLocaleString('ru-RU')} 💎.` };
  }

  // 10% комиссия тотализатора идет в кассу владельца Стадиона (Redblack)
  const commission = Math.max(1, Math.floor(cleanAmount * 0.1));
  if (currency === 'gold') {
    st.commissionBoxGold = Math.max(0, (st.commissionBoxGold || 0) + commission);
    if (side === 'A') match.poolTeamAGold += cleanAmount;
    else match.poolTeamBGold += cleanAmount;
  } else {
    st.commissionBoxCrystals = Math.max(0, (st.commissionBoxCrystals || 0) + commission);
    if (side === 'A') match.poolTeamACrystals += cleanAmount;
    else match.poolTeamBCrystals += cleanAmount;
  }

  const teamName = side === 'A' ? match.teamAName : match.teamBName;
  const odds = side === 'A' ? match.teamAOdds : match.teamBOdds;

  const newBet: PharosStadiumBetEntry = {
    id: `bet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    matchId: match.id,
    matchTitle: match.title,
    playerNick: playerNick || DEFAULT_PORT_ESTATE_OWNER_NICK,
    side,
    teamName,
    currency,
    amount: cleanAmount,
    odds,
    placedAt: Date.now(),
    status: 'active'
  };

  st.bets.unshift(newBet);
  if (st.bets.length > 40) st.bets = st.bets.slice(0, 40);
  savePharosStadiumState();

  return {
    ok: true,
    state: st,
    bet: newBet,
    goldSpent: currency === 'gold' ? cleanAmount : 0,
    crystalsSpent: currency === 'crystals' ? cleanAmount : 0,
    message: `🎟️ Ставка принята: ${cleanAmount.toLocaleString('ru-RU')} ${
      currency === 'gold' ? '🪙' : '💎'
    } на «${teamName}» (коэф. x${odds}). Комиссия Стадиона 10% (+${commission} ${
      currency === 'gold' ? '🪙' : '💎'
    }) зачислена в кассу владельца ${st.ownerNick}.`
  };
}

export function resolvePharosStadiumMatchNow(
  matchId: string,
  playerNick: string
): {
  ok: boolean;
  state?: PharosStadiumState;
  wonGold: number;
  wonCrystals: number;
  message?: string;
  error?: string;
} {
  const st = getPharosStadiumState();
  const match = st.matches.find((m) => m.id === matchId);
  if (!match || match.status === 'finished') {
    return { ok: false, wonGold: 0, wonCrystals: 0, error: 'Этот матч уже завершен!' };
  }

  const winnerSide: 'A' | 'B' = Math.random() < 0.52 ? 'A' : 'B';
  const winTeamName = winnerSide === 'A' ? match.teamAName : match.teamBName;
  match.status = 'finished';
  match.winnerSide = winnerSide;
  match.resultSummary = `🏆 Победитель: «${winTeamName}»!`;

  let wonGold = 0;
  let wonCrystals = 0;
  const cleanPlayer = (playerNick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim().toLowerCase();

  st.bets.forEach((b) => {
    if (b.matchId === match.id && b.status === 'active') {
      if (b.side === winnerSide) {
        const payout = Math.round(b.amount * b.odds);
        b.status = 'won';
        b.payout = payout;
        if (b.playerNick.trim().toLowerCase() === cleanPlayer) {
          if (b.currency === 'gold') wonGold += payout;
          else wonCrystals += payout;
        }
      } else {
        b.status = 'lost';
        b.payout = 0;
      }
    }
  });

  // Add a new replacement match so schedule stays full
  const freshMatches = createDefaultStadiumMatches(Date.now());
  const replacement = freshMatches[Math.floor(Math.random() * freshMatches.length)];
  replacement.id = `match_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  st.matches.push(replacement);
  if (st.matches.length > 6) {
    st.matches = st.matches.slice(-6);
  }

  savePharosStadiumState();

  return {
    ok: true,
    state: st,
    wonGold,
    wonCrystals,
    message:
      wonGold > 0 || wonCrystals > 0
        ? `🏟️ Матч завершен! Победила команда «${winTeamName}»! Ваш выигрыш по ставкам: ${
            wonGold > 0 ? `+${wonGold.toLocaleString('ru-RU')} 🪙 ` : ''
          }${wonCrystals > 0 ? `+${wonCrystals.toLocaleString('ru-RU')} 💎` : ''}!`
        : `🏟️ Матч завершен! Победила команда «${winTeamName}».`
  };
}

export function collectPharosStadiumCommission(
  actorNick: string,
  isAdmin = false
): {
  ok: boolean;
  collectedGold: number;
  collectedCrystals: number;
  state?: PharosStadiumState;
  message?: string;
  error?: string;
} {
  const st = getPharosStadiumState();
  const cleanActor = (actorNick || '').trim().toLowerCase();
  if (!isAdmin && st.ownerNick.trim().toLowerCase() !== cleanActor) {
    return {
      ok: false,
      collectedGold: 0,
      collectedCrystals: 0,
      error: `Собрать 10% комиссию из кассы Стадиона может только владелец (${st.ownerNick})!`
    };
  }

  const gold = Math.max(0, Math.floor(Number(st.commissionBoxGold || 0)));
  const crystals = Math.max(0, Math.floor(Number(st.commissionBoxCrystals || 0)));
  if (gold <= 0 && crystals <= 0) {
    return {
      ok: false,
      collectedGold: 0,
      collectedCrystals: 0,
      error: 'В кассе комиссии Стадиона сейчас 0 золота и 0 кристаллов.'
    };
  }

  st.commissionBoxGold = 0;
  st.commissionBoxCrystals = 0;
  st.totalCollectedGold = (st.totalCollectedGold || 0) + gold;
  st.totalCollectedCrystals = (st.totalCollectedCrystals || 0) + crystals;
  savePharosStadiumState();

  return {
    ok: true,
    collectedGold: gold,
    collectedCrystals: crystals,
    state: st,
    message: `💰 Вы собрали 10% комиссию Тотализатора из кассы Стадиона Фароса: +${gold.toLocaleString('ru-RU')} 🪙 и +${crystals.toLocaleString('ru-RU')} 💎!`
  };
}

export function transferPharosStadiumOwnership(
  actorNick: string,
  newOwnerNick: string,
  isAdmin = false
): { ok: boolean; state?: PharosStadiumState; message?: string; error?: string } {
  const st = getPharosStadiumState();
  const cleanActor = (actorNick || '').trim().toLowerCase();
  const cleanTarget = (newOwnerNick || '').trim().replace(/^@/, '');
  if (!cleanTarget) {
    return { ok: false, error: 'Введите никнейм нового владельца Стадиона!' };
  }
  if (!isAdmin && st.ownerNick.trim().toLowerCase() !== cleanActor) {
    return { ok: false, error: 'Передать Стадион может только его владелец или Администратор!' };
  }
  const oldOwner = st.ownerNick;
  st.ownerNick = cleanTarget;
  const targetClan = getPlayerClan(cleanTarget);
  if (targetClan) {
    st.ownerClanTag = targetClan.tag;
  }
  savePharosStadiumState();
  return {
    ok: true,
    state: st,
    message: `🤝 Стадион Фароса и Тотализатор [5/5] передан от ${oldOwner} игроку ${cleanTarget}! Накопленная касса комиссии осталась на счету Стадиона.`
  };
}

