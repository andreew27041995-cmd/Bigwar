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
  PortFactoryWorkerSession
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
  return {
    ...c,
    level: Math.max(1, Math.min(MAX_CLAN_LEVEL, Math.floor(Number(c.level) || 1))),
    exp: Math.max(0, Math.floor(Number(c.exp) || 0)),
    influencePoints: Math.max(0, Math.floor(Number(c.influencePoints) || 0)),
    treasuryGold: Math.max(0, Math.floor(Number(c.treasuryGold) || 0)),
    treasuryCrystals: Math.max(0, Math.floor(Number(c.treasuryCrystals) || 0)),
    pyramidTaxGoldPct: Math.max(0, Math.min(100, Number(c.pyramidTaxGoldPct ?? 15))),
    pyramidTaxCrystalPct: Math.max(0, Math.min(100, Number(c.pyramidTaxCrystalPct ?? 15))),
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
      ? c.members.map((m) => ({
          ...m,
          hasClanBadge: Boolean(
            m.hasClanBadge ||
              m.role === 'leader' ||
              (c.leaderNick && m.nick && m.nick.trim().toLowerCase() === c.leaderNick.trim().toLowerCase())
          )
        }))
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

export function initClanStorage(): void {
  if (!isInitialized) {
    loadFromLocal(true);
    isInitialized = true;
  }
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
): { ok: boolean; clan?: Clan; newLeaderNick?: string; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const cleanActor = currentLeaderNick.trim().toLowerCase();
  const cleanTarget = targetMemberNick.trim().toLowerCase();
  const isLeader = clan.leaderNick.trim().toLowerCase() === cleanActor;

  if (!isAdmin && !isLeader) {
    return { ok: false, error: 'Передать управление кланом может только действующий глава клана!' };
  }

  if (cleanTarget === clan.leaderNick.trim().toLowerCase()) {
    return { ok: false, error: 'Этот игрок уже является главой клана.' };
  }

  const targetMember = clan.members.find((m) => m.nick.trim().toLowerCase() === cleanTarget);
  if (!targetMember) {
    return { ok: false, error: 'Передать клан можно только игроку, который состоит в вашем клане!' };
  }

  const oldLeaderNick = clan.leaderNick;
  clan.leaderNick = targetMember.nick;
  clan.members.forEach((m) => {
    if (m.nick.trim().toLowerCase() === cleanTarget) {
      m.role = 'leader';
    } else if (m.role === 'leader') {
      m.role = 'officer';
    }
  });

  addClanLogEntry(
    clan,
    currentLeaderNick,
    'transfer_leader',
    `Передал управление кланом и титул Главы игроку ${targetMember.nick} (прежний глава: ${oldLeaderNick})`,
    '👑'
  );

  saveClansToSupabase();
  return { ok: true, clan, newLeaderNick: targetMember.nick };
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
export const TERRITORY_GATHERING_DURATION_MS = 10 * 60 * 1000; // 10 минут фаза сбора 7х7
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
export const PORT_WORKER_GOLD_PER_HOUR = 250; // +250 золота за каждый час работы
export const PORT_MAX_SHIFT_HOURS = 2; // Максимум 2 часа за подход
export const CLAN_BADGE_COST_GOLD = 1000; // Стоимость выдачи Знака клана: 1 000 золота

const PORT_FISH_MARKET_KEY = 'egypt_game_port_fish_market_v1';

export interface PortFishMarketState {
  fishStock: number;
  fishPriceGold: number;
  totalFishTraded: number;
  totalRelicsSold: number;
}

let inMemoryPortFishMarket: PortFishMarketState = {
  fishStock: 120,
  fishPriceGold: PORT_DEFAULT_FISH_MARKET_PRICE,
  totalFishTraded: 0,
  totalRelicsSold: 0
};

function loadPortFishMarket(): PortFishMarketState {
  if (typeof window === 'undefined') return inMemoryPortFishMarket;
  try {
    const raw = localStorage.getItem(PORT_FISH_MARKET_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        inMemoryPortFishMarket = {
          fishStock: Math.max(0, Math.floor(Number(parsed.fishStock ?? 120))),
          fishPriceGold: Math.max(10, Math.floor(Number(parsed.fishPriceGold ?? PORT_DEFAULT_FISH_MARKET_PRICE))),
          totalFishTraded: Math.max(0, Math.floor(Number(parsed.totalFishTraded ?? 0))),
          totalRelicsSold: Math.max(0, Math.floor(Number(parsed.totalRelicsSold ?? 0)))
        };
      }
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
  const m = getPortFishMarketState();
  return Math.max(40, m.fishPriceGold * PORT_RELIC_PRICE_FISH_MULT);
}

function createDefaultPortProduction(
  factoryType: string,
  factoryCategoryLabel: string,
  initialFish = 35,
  initialRelics = 8
): PortProductionState {
  return {
    factoryType,
    factoryCategoryLabel,
    isMerged: false,
    mergedWithSectorId: null,
    fishStock: initialFish,
    maxFishStock: PORT_BASE_MAX_FISH_STOCK,
    relicStock: initialRelics,
    maxRelicStock: PORT_BASE_MAX_RELIC_STOCK,
    lastCraftTickAt: Date.now(),
    workers: [],
    passiveGoldEarned: 0,
    totalRelicsCrafted: initialRelics
  };
}

export const DEFAULT_CLAN_TERRITORIES: ClanTerritorySector[] = [
  {
    id: 'sector_ra_temple',
    name: 'Портовая Мастерская Ра (Южный Причал)',
    icon: '☀️',
    description: 'Цех огранки солнечных реликвий в Порту. Перерабатывает рыбу Нила в реликвии и даёт клану +10% к удаче в Слотах.',
    zone: 'port',
    ownerClanId: null,
    ownerClanName: null,
    ownerClanTag: null,
    ownerClanEmblem: null,
    bonusType: 'slots_luck',
    bonusValue: 10,
    bonusLabel: '+10% к удаче в слотах',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction('solar_relic_foundry', 'Огранка Реликвий Ра', 40, 10)
  },
  {
    id: 'sector_nile_oasis',
    name: 'Рыбная Фактория Дельты (Северный Причал)',
    icon: '🐊',
    description: 'Крупный портовый комплекс переработки улова в реликвии. Повышает доход соклановцев от рыбалки (+8%).',
    zone: 'port',
    ownerClanId: null,
    ownerClanName: null,
    ownerClanTag: null,
    ownerClanEmblem: null,
    bonusType: 'fishing_gold',
    bonusValue: 8,
    bonusLabel: '+8% к золоту на рыбалке',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction('solar_relic_foundry', 'Огранка Реликвий Ра', 50, 12)
  },
  {
    id: 'sector_gold_mines',
    name: 'Золотая Литейная Гавани (Восточный Док)',
    icon: '⛏️',
    description: 'Плавильня портового квартала. Создаёт древние реликвии и увеличивает добычу золота в Пирамидах (+10%).',
    zone: 'port',
    ownerClanId: null,
    ownerClanName: null,
    ownerClanTag: null,
    ownerClanEmblem: null,
    bonusType: 'pyramid_gold',
    bonusValue: 10,
    bonusLabel: '+10% к золоту в Пирамидах',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction('gold_smelter_dock', 'Литейная Реликвий', 35, 8)
  },
  {
    id: 'sector_anubis_citadel',
    name: 'Оружейный Арсенал Анубиса (Западный Док)',
    icon: '🐺',
    description: 'Военная мануфактура Порта. Выпускает боевые реликвии и усиливает урон всех бойцов клана (+7%).',
    zone: 'port',
    ownerClanId: null,
    ownerClanName: null,
    ownerClanTag: null,
    ownerClanEmblem: null,
    bonusType: 'combat_dmg',
    bonusValue: 7,
    bonusLabel: '+7% к боевому урону',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction('gold_smelter_dock', 'Литейная Реликвий', 30, 7)
  },
  {
    id: 'sector_luxor_obelisk',
    name: 'Алхимический Док Тота (Маяк Александрии)',
    icon: '🔮',
    description: 'Лаборатория мудрецов у морского маяка. Перегоняет рыбий жир в реликвии и ускоряет опыт клана (+10%).',
    zone: 'port',
    ownerClanId: null,
    ownerClanName: null,
    ownerClanTag: null,
    ownerClanEmblem: null,
    bonusType: 'pyramid_exp',
    bonusValue: 10,
    bonusLabel: '+10% к опыту в боях',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction('alchemy_beacon', 'Алхимия Реликвий', 45, 9)
  },
  {
    id: 'sector_alexandria_port',
    name: 'Цитадель Морского Бастиона (Главный Порт)',
    icon: '⚓',
    description: 'Центральная верфь-мануфактура Порта. Производит реликвии стойкости и даёт +8% к здоровью клана.',
    zone: 'port',
    ownerClanId: null,
    ownerClanName: null,
    ownerClanTag: null,
    ownerClanEmblem: null,
    bonusType: 'max_hp',
    bonusValue: 8,
    bonusLabel: '+8% к макс. здоровью',
    warStatus: 'peace',
    warScores: {},
    production: createDefaultPortProduction('alchemy_beacon', 'Алхимия Реликвий', 40, 11)
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

  if (target.hp <= 0) {
    target.alive = false;
    return `${isAutoTimeout ? '⏱ [Авто-ход 20с] ' : ''}💀 [${skillLabel}] Клетка #${actorCellNum} (${actor.nick}) ${
      isCrit ? '🔥 КРИТОМ ' : ''
    }наносит ${rawDmg} урона по Клетке #${targetCellNum} (${target.nick}) и ВЫБИВАЕТ противника с поля!`;
  }

  return `${isAutoTimeout ? '⏱ [Авто-ход 20с] ' : ''}${actor.side === 'attacker' ? '⚔️' : '🛡️'} [${skillLabel}] Клетка #${actorCellNum} (${
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
    b.summaryText = `🏆 Штурм успешен! Клан [${sector.ownerClanTag}] ${sector.ownerClanName} одержал победу на клетках 7х7 (Выжило: ${atkAlive.length} против ${defAlive.length}) и захватил сектор «${sector.name}» на 2 часа!`;

    if (winClan) {
      addClanLogEntry(
        winClan,
        winClan.leaderNick,
        'capture_territory',
        `Победа в живом бою 7х7 на клетках (Выжило ${atkAlive.length}/7)! Сектор «${sector.name}» (${sector.bonusLabel}) захвачен на 2 часа!`,
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
    b.summaryText = `🛡️ Оборона выстояла! Защитники «${sector.name}» победили в живом бою 7х7 (Выжило защитников: ${defAlive.length}, атакующих: ${atkAlive.length}) и сохранили сектор за собой!`;
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
}

function normalizeSectorProduction(
  sector: ClanTerritorySector,
  defaultSector?: ClanTerritorySector
): PortProductionState {
  const defProd =
    defaultSector?.production ||
    createDefaultPortProduction('solar_relic_foundry', 'Огранка Реликвий', 35, 8);
  const raw = sector.production || defProd;
  const isMerged = Boolean(raw.isMerged);
  const maxFish = isMerged ? PORT_MERGED_MAX_FISH_STOCK : PORT_BASE_MAX_FISH_STOCK;
  const maxRelic = isMerged ? PORT_MERGED_MAX_RELIC_STOCK : PORT_BASE_MAX_RELIC_STOCK;
  return {
    factoryType: raw.factoryType || defProd.factoryType,
    factoryCategoryLabel: raw.factoryCategoryLabel || defProd.factoryCategoryLabel,
    isMerged,
    mergedWithSectorId: raw.mergedWithSectorId || null,
    fishStock: Math.max(0, Math.min(maxFish, Math.floor(Number(raw.fishStock ?? defProd.fishStock)))),
    maxFishStock: maxFish,
    relicStock: Math.max(0, Math.min(maxRelic, Math.floor(Number(raw.relicStock ?? defProd.relicStock)))),
    maxRelicStock: maxRelic,
    lastCraftTickAt: Number(raw.lastCraftTickAt || Date.now()),
    workers: Array.isArray(raw.workers) ? raw.workers : [],
    passiveGoldEarned: Math.max(0, Math.floor(Number(raw.passiveGoldEarned || 0))),
    totalRelicsCrafted: Math.max(0, Math.floor(Number(raw.totalRelicsCrafted ?? defProd.totalRelicsCrafted ?? 0)))
  };
}

function tickPortProductionForSector(sector: ClanTerritorySector, now: number): boolean {
  const prod = normalizeSectorProduction(sector);
  sector.production = prod;
  let mutated = false;

  // За каждый полный час (3600 сек) работы производство потребляет 5 рыбин и создаёт 1 реликвию (или x2 при объединении)
  const HOUR_MS = 60 * 60 * 1000;
  const elapsedMs = now - (prod.lastCraftTickAt || now);
  if (elapsedMs >= HOUR_MS) {
    const hoursPassed = Math.min(24, Math.floor(elapsedMs / HOUR_MS));
    if (hoursPassed > 0) {
      const craftsPerHour = prod.isMerged ? 2 : 1;
      const totalCycles = hoursPassed * craftsPerHour;
      let craftedCount = 0;

      for (let i = 0; i < totalCycles; i++) {
        if (prod.fishStock >= PORT_FISH_PER_RELIC && prod.relicStock < prod.maxRelicStock) {
          prod.fishStock -= PORT_FISH_PER_RELIC;
          prod.relicStock += 1;
          prod.totalRelicsCrafted = (prod.totalRelicsCrafted || 0) + 1;
          craftedCount += 1;
        } else {
          break;
        }
      }

      prod.lastCraftTickAt = now;
      mutated = true;

      if (craftedCount > 0 && sector.ownerClanId) {
        const ownerClan = inMemoryClans.find((c) => c.id === sector.ownerClanId);
        if (ownerClan) {
          const passiveGold = craftedCount * 150;
          ownerClan.treasuryGold = (ownerClan.treasuryGold || 0) + passiveGold;
          prod.passiveGoldEarned = (prod.passiveGoldEarned || 0) + passiveGold;
          addClanLogEntry(
            ownerClan,
            ownerClan.leaderNick,
            'port_production',
            `Производство в Порту «${sector.name}» переработало ${craftedCount * PORT_FISH_PER_RELIC} рыбин в ${craftedCount} реликвий и принесло +${passiveGold} 🪙 пассивной прибыли в казну!`,
            '🏭'
          );
        }
      }
    }
  }

  return mutated;
}

function ensureTerritoriesLoaded(): ClanTerritorySector[] {
  initClanStorage();
  if (!Array.isArray(inMemoryTerritories) || inMemoryTerritories.length === 0) {
    inMemoryTerritories = DEFAULT_CLAN_TERRITORIES.map((t) => ({
      ...t,
      zone: 'port',
      warScores: {},
      production: normalizeSectorProduction(t, t)
    }));
  } else {
    const byId = new Map<string, ClanTerritorySector>();
    inMemoryTerritories.forEach((t) => byId.set(t.id, t));
    inMemoryTerritories = DEFAULT_CLAN_TERRITORIES.map((def) => {
      const existing = byId.get(def.id);
      if (!existing) {
        return {
          ...def,
          zone: 'port',
          warScores: {},
          production: normalizeSectorProduction(def, def)
        };
      }
      const merged: ClanTerritorySector = {
        ...def,
        ...existing,
        name: def.name,
        description: def.description,
        zone: 'port',
        warScores: existing.warScores || {}
      };
      merged.production = normalizeSectorProduction(merged, def);
      return merged;
    });
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
      if (b.phase === 'gathering') {
        const isFull7x7 = b.attackers.length >= 7 && b.defenders.length >= 7;
        const isTimeUp = now >= b.gatheringEndsAt;
        if (isFull7x7 || isTimeUp) {
          transitionSectorToCombatPhase(sector, now);
          changed = true;
        }
      }

      if (sector.battle7x7 && sector.battle7x7.phase === 'combat') {
        // Автоматический расчёт ходов по истечении 20 секунд на ход
        let safety = 0;
        while (
          sector.battle7x7 &&
          sector.battle7x7.phase === 'combat' &&
          now >= sector.battle7x7.roundEndsAt &&
          safety < 12
        ) {
          safety++;
          simulateSingle7x7Round(sector, sector.battle7x7.roundEndsAt);
          changed = true;
        }
      }
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

export function getActiveClanWarAlerts(clanId?: string | null): ClanTerritorySector[] {
  const sectors = ensureTerritoriesLoaded();
  return sectors.filter((s) => {
    if (s.warStatus !== 'war' || !s.battle7x7) return false;
    if (!clanId) return true;
    return s.attackerClanId === clanId || s.ownerClanId === clanId;
  });
}

export function getClanTerritoryBuffs(clanId?: string | null): {
  slotsLuckPct: number;
  fishingGoldPct: number;
  pyramidGoldPct: number;
  combatDmgPct: number;
  pyramidExpPct: number;
  maxHpPct: number;
  ownedSectors: ClanTerritorySector[];
} {
  if (!clanId) {
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
  const sectors = ensureTerritoriesLoaded();
  const ownedSectors = sectors.filter((s) => s.ownerClanId === clanId);
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

  // Очищаем уже забравших награду работников
  prod.workers = prod.workers.filter((w) => !w.claimed);

  const maxWorkers = prod.isMerged ? PORT_MERGED_MAX_WORKERS : PORT_BASE_MAX_WORKERS;
  if (prod.workers.length >= maxWorkers) {
    return {
      ok: false,
      error: `На объекте «${sector.name}» заняты все рабочие места (${prod.workers.length}/${maxWorkers} чел.)! Выберите другое производство или объедините парные объекты.`
    };
  }

  const hours: 1 | 2 = durationHours === 1 ? 1 : 2;
  const now = Date.now();
  const session: PortFactoryWorkerSession = {
    nick: playerNick,
    avatar,
    startedAt: now,
    endsAt: now + hours * 60 * 60 * 1000,
    durationHours: hours,
    goldPerHour: PORT_WORKER_GOLD_PER_HOUR,
    claimed: false
  };

  prod.workers.push(session);
  saveClansToSupabase();

  return {
    ok: true,
    sector,
    message: `🔨 Вы устроились на работу в «${sector.name}» на ${hours} ч.! Награда по окончании смены: +${
      hours * PORT_WORKER_GOLD_PER_HOUR
    } 🪙 и +${hours} к навыку «Производство».`
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
  const goldEarned = hoursWorked * (worker.goldPerHour || PORT_WORKER_GOLD_PER_HOUR);

  // Удаляем работника из активного слота после завершения смены
  prod.workers.splice(workerIdx, 1);

  // За каждый час смены производство также перерабатывает 5 рыбин в 1 реликвию (если на складе есть рыба)
  let relicsCraftedNow = 0;
  for (let i = 0; i < hoursWorked; i++) {
    if (prod.fishStock >= PORT_FISH_PER_RELIC && prod.relicStock < prod.maxRelicStock) {
      prod.fishStock -= PORT_FISH_PER_RELIC;
      prod.relicStock += 1;
      prod.totalRelicsCrafted = (prod.totalRelicsCrafted || 0) + 1;
      relicsCraftedNow += 1;
    }
  }
  prod.lastCraftTickAt = now;

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
          relicsCraftedNow > 0 ? `, произведено +${relicsCraftedNow} реликвий` : ''
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
    message: `✅ Смена (${hoursWorked} ч.) на «${sector.name}» завершена! Вы получили +${goldEarned.toLocaleString()} 🪙 и +${hoursWorked} ч. к навыку «Производство»${
      relicsCraftedNow > 0 ? ` (цех выпустил +${relicsCraftedNow} 🏺 реликвий)` : ''
    }!`
  };
}

export function sellFishToPortMarket(
  playerNick: string,
  fishCount: number
): { ok: boolean; goldEarned: number; market: PortFishMarketState; message: string } {
  const qty = Math.max(1, Math.floor(Number(fishCount) || 0));
  const market = loadPortFishMarket();
  const goldEarned = qty * market.fishPriceGold;
  market.fishStock += qty;
  market.totalFishTraded += qty;
  savePortFishMarket();
  return {
    ok: true,
    goldEarned,
    market,
    message: `🐟 Вы сдали ${qty} шт. рыбы на Рыбный рынок Порта и получили +${goldEarned.toLocaleString()} 🪙 (по ${market.fishPriceGold} 🪙/шт.)!`
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

  const market = loadPortFishMarket();
  const qty = Math.max(1, Math.min(freeSpace, Math.floor(Number(requestedQty) || 1)));

  if (source === 'keepnet') {
    if (availableKeepnetFish < qty) {
      return { ok: false, error: `В вашем садке недостаточно рыбы (доступно: ${availableKeepnetFish} шт.).` };
    }
    prod.fishStock += qty;
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

  // Закупка с общего Рыбного рынка Порта
  if (market.fishStock < qty) {
    return {
      ok: false,
      error: `На Рыбном рынке Порта сейчас только ${market.fishStock} шт. рыбы! Рыбаки могут сдать улов на рынок или загрузить рыбу из садка.`
    };
  }

  const totalCost = qty * market.fishPriceGold;
  if (availableGold < totalCost) {
    return {
      ok: false,
      error: `Недостаточно золота для закупки ${qty} рыбин с рынка! Требуется ${totalCost.toLocaleString()} 🪙 (${market.fishPriceGold} 🪙/шт.).`
    };
  }

  market.fishStock -= qty;
  prod.fishStock += qty;
  savePortFishMarket();
  saveClansToSupabase();

  return {
    ok: true,
    loadedQty: qty,
    goldSpent: totalCost,
    sector,
    market,
    message: `📦 Закуплено и завезено ${qty} рыбин с рынка Порта на склад «${sector.name}» за ${totalCost.toLocaleString()} 🪙 (склад: ${prod.fishStock}/${prod.maxFishStock} шт.)!`
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

  if (prod.fishStock < PORT_FISH_PER_RELIC) {
    return {
      ok: false,
      error: `На складе недостаточно рыбы для крафта реликвии! Требуется минимум ${PORT_FISH_PER_RELIC} рыбин (сейчас: ${prod.fishStock}/${prod.maxFishStock}).`
    };
  }

  if (prod.relicStock >= prod.maxRelicStock) {
    return {
      ok: false,
      error: `Склад готовых реликвий заполнен до предела (${prod.relicStock}/${prod.maxRelicStock} шт.)! Купите или реализуйте готовые реликвии.`
    };
  }

  const batchLimit = prod.isMerged ? 2 : 1;
  let craftedCount = 0;
  for (let i = 0; i < batchLimit; i++) {
    if (prod.fishStock >= PORT_FISH_PER_RELIC && prod.relicStock < prod.maxRelicStock) {
      prod.fishStock -= PORT_FISH_PER_RELIC;
      prod.relicStock += 1;
      prod.totalRelicsCrafted = (prod.totalRelicsCrafted || 0) + 1;
      craftedCount += 1;
    }
  }

  prod.lastCraftTickAt = Date.now();

  if (sector.ownerClanId) {
    const ownerClan = inMemoryClans.find((c) => c.id === sector.ownerClanId);
    if (ownerClan) {
      const passiveBonus = craftedCount * 100;
      ownerClan.treasuryGold = (ownerClan.treasuryGold || 0) + passiveBonus;
      prod.passiveGoldEarned = (prod.passiveGoldEarned || 0) + passiveBonus;
    }
  }

  saveClansToSupabase();

  return {
    ok: true,
    craftedCount,
    fishUsed: craftedCount * PORT_FISH_PER_RELIC,
    sector,
    message: `🏺 Партия готова! Переработано ${craftedCount * PORT_FISH_PER_RELIC} рыбин -> создано +${craftedCount} шт. Реликвий (на складе: ${prod.relicStock}/${prod.maxRelicStock})!`
  };
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
  if (prod.relicStock < qty) {
    return {
      ok: false,
      error: `На складе производства «${sector.name}» сейчас только ${prod.relicStock} шт. готовых реликвий!`
    };
  }

  // Стоимость 1 реликвии автоматически приравнивается к стоимости 4 рыбин на рынке
  const unitPriceGold = getPortRelicMarketPrice();
  const totalCostGold = qty * unitPriceGold;

  if (buyerGold < totalCostGold) {
    return {
      ok: false,
      error: `Недостаточно золота! Стоимость ${qty} реликвий составляет ${totalCostGold.toLocaleString()} 🪙 (${unitPriceGold} 🪙/шт. = 4 рыбы на рынке).`
    };
  }

  prod.relicStock -= qty;
  const market = loadPortFishMarket();
  market.totalRelicsSold = (market.totalRelicsSold || 0) + qty;
  savePortFishMarket();

  if (sector.ownerClanId) {
    const ownerClan = inMemoryClans.find((c) => c.id === sector.ownerClanId);
    if (ownerClan) {
      ownerClan.treasuryGold = (ownerClan.treasuryGold || 0) + totalCostGold;
      prod.passiveGoldEarned = (prod.passiveGoldEarned || 0) + totalCostGold;
      addClanLogEntry(
        ownerClan,
        buyerNick,
        'port_production',
        `Игрок ${buyerNick} приобрёл ${qty} шт. реликвий с производства «${sector.name}». В казну клана поступило +${totalCostGold.toLocaleString()} 🪙!`,
        '🏺'
      );
    }
  }

  saveClansToSupabase();

  return {
    ok: true,
    boughtQty: qty,
    totalCostGold,
    unitPriceGold,
    sector,
    message: `🏺 Вы приобрели ${qty} шт. Реликвий с производства «${sector.name}» за ${totalCostGold.toLocaleString()} 🪙 (по цене 4 рыбин = ${unitPriceGold} 🪙/шт.)!`
  };
}

export function mergeClanPortFactories(
  clanId: string,
  actorNick: string,
  sectorId: string
): { ok: boolean; sector?: ClanTerritorySector; partnerSector?: ClanTerritorySector; message?: string; error?: string } {
  const sectors = ensureTerritoriesLoaded();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const sector = sectors.find((s) => s.id === sectorId);
  if (!sector) return { ok: false, error: 'Объект производства не найден.' };
  if (sector.ownerClanId !== clan.id) {
    return { ok: false, error: 'Для объединения производств ваш клан должен владеть этим объектом!' };
  }

  const prod = normalizeSectorProduction(sector);
  sector.production = prod;
  if (prod.isMerged) {
    return { ok: false, error: 'Это производство уже объединено и расширено до 6 рабочих мест и двойного склада!' };
  }

  // Ищем второй объект того же типа (или любой второй объект в Порту под контролем этого же клана)
  const partner = sectors.find(
    (s) =>
      s.id !== sector.id &&
      s.ownerClanId === clan.id &&
      (normalizeSectorProduction(s).factoryType === prod.factoryType || true)
  );

  if (!partner) {
    return {
      ok: false,
      error: 'Для объединения объектов ваш клан должен одновременно удерживать минимум два производства в Порту!'
    };
  }

  const partnerProd = normalizeSectorProduction(partner);
  partner.production = partnerProd;

  prod.isMerged = true;
  prod.mergedWithSectorId = partner.id;
  prod.maxFishStock = PORT_MERGED_MAX_FISH_STOCK;
  prod.maxRelicStock = PORT_MERGED_MAX_RELIC_STOCK;

  partnerProd.isMerged = true;
  partnerProd.mergedWithSectorId = sector.id;
  partnerProd.maxFishStock = PORT_MERGED_MAX_FISH_STOCK;
  partnerProd.maxRelicStock = PORT_MERGED_MAX_RELIC_STOCK;

  addClanLogEntry(
    clan,
    actorNick,
    'port_production',
    `Объединены производства Порта «${sector.name}» и «${partner.name}»! Лимит рабочих мест увеличен до ${PORT_MERGED_MAX_WORKERS} чел., склад рыбы — до ${PORT_MERGED_MAX_FISH_STOCK} шт., реликвий — до ${PORT_MERGED_MAX_RELIC_STOCK} шт.!`,
    '🏗️'
  );

  saveClansToSupabase();

  return {
    ok: true,
    sector,
    partnerSector: partner,
    message: `🏗️ Производства «${sector.name}» и «${partner.name}» успешно объединены! Лимит работников увеличен до ${PORT_MERGED_MAX_WORKERS} чел., склад сырья — до ${PORT_MERGED_MAX_FISH_STOCK} рыбин, склад реликвий — до ${PORT_MERGED_MAX_RELIC_STOCK} шт.!`
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
  const hasBadge = doesPlayerHaveClanBadge(actorNick, clan.id, actorHero?.hasClanBadge);
  if (!hasBadge) {
    return {
      ok: false,
      error: `🛡️ Правило Порта: нападать на производства и участвовать в боях 7х7 могут только участники клана с выданным «Знаком клана»! Глава клана может выдать вам Знак клана во вкладке «Состав» за ${CLAN_BADGE_COST_GOLD.toLocaleString()} 🪙.`
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

  if (!doesPlayerHaveClanBadge(playerNick, clan.id, hero?.hasClanBadge)) {
    return {
      ok: false,
      error: `🛡️ Для участия в тактическом бою 7х7 за производство в Порту необходим официальный «Знак клана»! Попросите Главу клана выдать вам Знак во вкладке «Состав» (1 000 🪙).`
    };
  }

  normalize7x7RealPlayersRoster(sector);
  const b = sector.battle7x7;
  const side: 'attacker' | 'defender' | null =
    sector.attackerClanId === clan.id
      ? 'attacker'
      : sector.ownerClanId === clan.id || !sector.ownerClanId
      ? 'defender'
      : null;

  if (!side) {
    return {
      ok: false,
      error: 'В этом бою 7х7 участвуют только атакующий клан и защищающийся клан!'
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


