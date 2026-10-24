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
  HeroState
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

// In-memory cache
let inMemoryClans: Clan[] = [];
let inMemoryPyramid: ClanPyramidState = { ...DEFAULT_CLAN_PYRAMID_STATE };
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
    members: Array.isArray(c.members) ? c.members : [],
    storage: Array.isArray(c.storage) ? c.storage : [],
    logs: Array.isArray(c.logs) ? c.logs.slice(0, MAX_CLAN_LOGS) : []
  };
}

function loadFromLocal(): void {
  if (typeof window === 'undefined') return;
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
  } catch (e) {
    console.warn('[ClanStorage] Error loading from localStorage:', e);
  }
}

function saveToLocal(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLANS_STORAGE_KEY, JSON.stringify(inMemoryClans));
    localStorage.setItem(CLAN_PYRAMID_KEY, JSON.stringify(inMemoryPyramid));
  } catch (e) {
    console.warn('[ClanStorage] Error saving to localStorage:', e);
  }
}

export function initClanStorage(): void {
  loadFromLocal();
  isInitialized = true;
}

// -------------------------------------------------------------
// SUPABASE SYNCHRONIZATION VIA SYSTEM ROWS (__CLANS_DATA__, __CLAN_PYRAMID__)
// -------------------------------------------------------------

export async function syncClansFromSupabase(): Promise<Clan[]> {
  loadFromLocal();
  const client = getSupabaseClient();
  if (!client) return inMemoryClans;

  try {
    const { data, error } = await client
      .from('players')
      .select('email, id')
      .eq('name', '__CLANS_DATA__')
      .maybeSingle();

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
            }
            clanMap.set(remoteClan.id, remoteClan);
          });
          inMemoryClans.forEach((c) => {
            if (!clanMap.has(c.id)) {
              clanMap.set(c.id, c);
            }
          });
          inMemoryClans = Array.from(clanMap.values());
          saveToLocal();
          return inMemoryClans;
        }
      } catch (e) {
        console.warn('[ClanStorage] Failed to parse clans email JSON:', e);
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
      updatedAt: Date.now()
    });

    const { data: existing } = await client
      .from('players')
      .select('id')
      .eq('name', sysName)
      .maybeSingle();

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
    const { data, error } = await client
      .from('players')
      .select('email, id')
      .eq('name', '__CLAN_PYRAMID__')
      .maybeSingle();

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

    const { data: existing } = await client
      .from('players')
      .select('id')
      .eq('name', sysName)
      .maybeSingle();

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
  loadFromLocal();
  return inMemoryClans;
}

export function getClanById(clanId?: string | null): Clan | undefined {
  if (!clanId) return undefined;
  loadFromLocal();
  return inMemoryClans.find((c) => c.id === clanId);
}

export function getPlayerClan(nick?: string | null, clanId?: string | null): Clan | undefined {
  loadFromLocal();

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
  loadFromLocal();
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

export function addClanExp(
  clanId: string,
  expAmount: number,
  contributorNick?: string
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

  if (updates.emblem !== undefined) {
    clan.emblem = updates.emblem;
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

  // All storage items are returned to their original owners
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

export function depositItemToClanStorage(
  clanId: string,
  depositorNick: string,
  item: GameItem
): { ok: boolean; storageItem?: ClanStorageItem; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const isMember = clan.members.some((m) => m.nick.toLowerCase() === depositorNick.toLowerCase());
  if (!isMember) return { ok: false, error: 'Вы не состоите в этом клане.' };

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
  addClanLogEntry(
    clan,
    depositorNick,
    'deposit_item',
    `Положил вещь на базу: «${item.name}» (${item.lvl} ур.)`,
    item.icon || '📦'
  );
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
): { ok: boolean; newTreasuryGold?: number; error?: string } {
  initClanStorage();
  const clan = inMemoryClans.find((c) => c.id === clanId);
  if (!clan) return { ok: false, error: 'Клан не найден.' };

  const isMember = clan.members.some((m) => m.nick.toLowerCase() === depositorNick.toLowerCase());
  if (!isMember) return { ok: false, error: 'Вы не состоите в этом клане.' };

  const amount = Math.floor(Number(goldAmount) || 0);
  if (amount <= 0) return { ok: false, error: 'Введите корректную сумму золота.' };

  clan.treasuryGold = Math.max(0, Math.floor(Number(clan.treasuryGold) || 0)) + amount;
  addClanLogEntry(
    clan,
    depositorNick,
    'deposit_gold',
    `Пополнил казну базы клана на +${amount} 🪙 золота`,
    '🪙'
  );
  saveClansToSupabase();

  return { ok: true, newTreasuryGold: clan.treasuryGold };
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
      ? { name: 'Эликсир Здоровья (+50 HP)', icon: '🧪', quality: 'rare' as const }
      : elixirType === 'en'
      ? { name: 'Эликсир Энергии (+20 EN)', icon: '⚡', quality: 'rare' as const }
      : { name: 'Эликсир Опыта (+25% EXP)', icon: '✨', quality: 'epic' as const };

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
  addClanLogEntry(
    clan,
    depositorNick,
    'deposit_elixir',
    `Положил эликсиры на базу: ${elixirInfo.name} x${qty}`,
    elixirInfo.icon
  );

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
    rentedByNick: borrowerNick,
    originalOwnerNick: st.originalOwnerNick,
    clanRentDepositedAt: st.depositedAt
  };

  addClanLogEntry(
    clan,
    borrowerNick,
    'rent_item',
    `Взял предмет в аренду с базы: «${st.item.name}» (влад. ${st.originalOwnerNick})`,
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

/**
 * Returns passive buffs applied to members of the controlling clan.
 */
export function getClanPyramidBuffs(playerClanId?: string | null): {
  hasControl: boolean;
  goldBonusPct: number;
  expBonusPct: number;
  dmgBonusPct: number;
  hpBonusPct: number;
} {
  const pyr = getClanPyramidState();
  const cfg = pyr.config || DEFAULT_CLAN_PYRAMID_CONFIG;
  const hasControl = Boolean(playerClanId && pyr.controlledByClanId && pyr.controlledByClanId === playerClanId);
  if (!hasControl) {
    return {
      hasControl: false,
      goldBonusPct: 0,
      expBonusPct: 0,
      dmgBonusPct: 0,
      hpBonusPct: 0
    };
  }

  return {
    hasControl: true,
    goldBonusPct: Number(cfg.buffGoldPct ?? 15),
    expBonusPct: Number(cfg.buffExpPct ?? 15),
    dmgBonusPct: Number(cfg.buffDmgPct ?? 5),
    hpBonusPct: Number(cfg.buffHpPct ?? 10)
  };
}
