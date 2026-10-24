import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import {
  PyramidCell,
  PrivateMessage,
  MailGiftAttachment,
  ChatMessage,
  RareBossTimerState,
  WheelWinnerEntry,
  EquippedGear,
  TradeProtocolEntry,
  GameItem,
  PlayerBanInfo,
  CharacterSkinTemplate
} from '../types/game';
import { registerPlayerOwnedSkinsInMemory } from './shopConfig';
import {
  generateDeterministicPyramidCells,
  respawnDeterministicPyramidCells,
  sanitizePyramidCellsForStorage,
  getFreeEmptyPyramidCells,
  createRareBossMobCell,
  PYRAMID_EXIT_POS,
  PYRAMID_SPAWN_POS,
  EXP_TABLE,
  LEVEL_UP_REWARDS,
  MAX_LEVEL,
  getPyramidTierForLevel,
  recalculateLevelAndExpFromTotal,
  getTotalAccumulatedExp,
  normalizeStatsForLevel,
  getHeroDamageFromStr,
  getHeroMaxHpFromVit
} from './gameData';

export interface PyramidTierState {
  tier: number;
  seed: number;
  cells: PyramidCell[][];
  lastRespawn: number;
  rareBossTimers?: RareBossTimerState[];
  updatedAt: number;
  updatedBy?: string;
}

export interface GlobalMailAndChatState {
  messages: PrivateMessage[];
  chatMessages: ChatMessage[];
  wheelWinners?: WheelWinnerEntry[];
  updatedAt: number;
}

export interface RealtimePlayer {
  id?: string | number;
  nick: string;
  lvl: number;
  hp: number;
  maxHp: number;
  avatar: string;
  location: 'city' | 'pyramid';
  pyramidTier: number;
  row: number;
  col: number;
  status?: string;
  isOnline: boolean;
  isPremium?: boolean;
  premiumUntil?: number;
  vipUntil?: number;
  role?: 'admin' | 'mod' | 'winner' | 'regular';
  lastSeen?: number;
  last_seen?: number;
  wasKilledInPvp?: boolean;
  killedBy?: string;
  gold?: number;
  crystals?: number;
  mobsKilled?: number;
  mobKills?: number;
  pvpKills?: number;
  pvpWins?: number;
  pvpLosses?: number;
  deaths?: number;
  totalGoldCollected?: number;
  dailyGoldToCrystalCount?: number;
  dailyGoldToCrystalDate?: string;
  dailyCrystalToGoldCount?: number;
  dailyCrystalToGoldDate?: string;
  str?: number;
  agi?: number;
  vit?: number;
  exp?: number;
  statPoints?: number;
  energy?: number;
  maxEnergy?: number;
  hpPotions?: number;
  enPotions?: number;
  expPotions?: number;
  expElixirUntil?: number;
  bagCapacity?: number;
  sellExperience?: number;
  is_admin?: number;
  isAdmin?: number | boolean;
  equipped?: EquippedGear;
  tradeProtocol?: TradeProtocolEntry[];
  inventory?: GameItem[];
  externalSyncTs?: number;
  clanId?: string;
  clanTag?: string;
  clanName?: string;
  clanEmblem?: string;
  clanRole?: 'leader' | 'officer' | 'warrior' | 'recruit' | 'member';
  ownedSkinIds?: string[];
  ownedSkinExpirations?: Record<string, number>;
  ownedSkins?: CharacterSkinTemplate[];
  activeSkinId?: string | null;
  banInfo?: PlayerBanInfo | null;
}

export type RealtimeConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'SUBSCRIBED'
  | 'CHANNEL_ERROR'
  | 'TIMED_OUT'
  | 'CLOSED'
  | 'NOT_CONFIGURED';

export const DEFAULT_SUPABASE_URL = 'https://lgbxbwzqckdnviygsghu.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_lGMAAuZELw2gPDZeuEx0VQ_DgPK7szm';

export const SUPABASE_URL: string = DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY: string = DEFAULT_SUPABASE_ANON_KEY;

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  return {
    url: DEFAULT_SUPABASE_URL,
    anonKey: DEFAULT_SUPABASE_ANON_KEY
  };
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    (window as any).SUPABASE_URL = url.trim() || DEFAULT_SUPABASE_URL;
    (window as any).SUPABASE_ANON_KEY = anonKey.trim() || DEFAULT_SUPABASE_ANON_KEY;
  }
  cachedClient = null;
  getSupabaseClient();
}

export function isSupabaseConfigured(): boolean {
  return true;
}

let cachedClient: SupabaseClient | null = null;

const memoryAuthStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {}
};

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey) {
    return null;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: memoryAuthStorage
      },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, {
            ...init,
            cache: 'no-store'
          })
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
    if (typeof window !== 'undefined') {
      (window as any).supabaseClient = cachedClient;
    }
    return cachedClient;
  } catch (err) {
    console.warn('[Supabase] Failed to initialize client:', err);
    return null;
  }
}

export const supabase = getSupabaseClient();

// In-memory state cache per lowercase nickname to prevent concurrent update race conditions
const playerStateCache = new Map<string, any>();
const playerUpdateQueues = new Map<string, Promise<boolean>>();

// Heartbeat timeout: a player is considered online ONLY if is_online === true AND last_seen was updated within 15 seconds
export const ONLINE_HEARTBEAT_TIMEOUT_MS = 15000;

export function isPlayerOnlineByHeartbeat(isOnlineFlag: any, lastSeenTs: any): boolean {
  if (!isOnlineFlag) return false;
  const ts = Number(lastSeenTs ?? 0);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  return Math.max(0, Date.now() - ts) < ONLINE_HEARTBEAT_TIMEOUT_MS;
}

const staleCleanupInFlight = new Set<string>();

/**
 * Unpacks JSON state stored inside the `email` column of `public.players`
 * so all fields (lvl, exp, hp, max_hp, equipped, inventory, location, pyramid_tier, row, col, is_online, last_seen)
 * are available directly on the player row object without triggering PGRST204 on missing columns.
 */
export function unpackPlayerRow(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const hasFullEmailJson = Boolean(row.email && typeof row.email === 'string' && row.email.trim().startsWith('{'));
  let parsedEmailData: any = {};
  if (hasFullEmailJson) {
    try {
      parsedEmailData = JSON.parse(row.email);
    } catch (e) {
      // ignore invalid JSON
    }
  }

  const nick = String(
    row.name ||
    row.nick ||
    row['имя'] ||
    parsedEmailData.nick ||
    ''
  ).trim();

  // If this is a partial/synthetic realtime event without the full email JSON payload,
  // preserve existing cached player data so we never wipe gold, crystals, inventory, equipped, level, or daily rewards.
  if (!hasFullEmailJson && nick) {
    const existingForPartial = playerStateCache.get(nick.toLowerCase());
    if (existingForPartial && existingForPartial._rawEmailJson) {
      parsedEmailData = {
        ...existingForPartial._rawEmailJson,
        ...parsedEmailData
      };
    }
  }

  const isAdmin = Number(row.is_admin) === 1 || Number(row.isAdmin) === 1 || Number(parsedEmailData.is_admin) === 1;

  const rawDbLvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(parsedEmailData.lvl ?? row.lvl ?? row.level ?? 1))));
  const rawDbExp = Math.max(0, Math.floor(Number(parsedEmailData.exp ?? row.exp ?? 0)));
  const isV3ExpMigrated = Boolean(parsedEmailData.exp_table_v3_migrated ?? row.exp_table_v3_migrated ?? false);

  let unpackedLvl = rawDbLvl;
  let unpackedExp = rawDbExp;

  if (!isV3ExpMigrated && rawDbExp >= (EXP_TABLE[rawDbLvl] || 9999999)) {
    const recalc = recalculateLevelAndExpFromTotal(rawDbExp);
    unpackedLvl = recalc.level;
    unpackedExp = recalc.exp;
  } else {
    while (unpackedLvl < MAX_LEVEL && unpackedExp >= (EXP_TABLE[unpackedLvl] || 9999999)) {
      unpackedExp -= EXP_TABLE[unpackedLvl] || 9999999;
      unpackedLvl += 1;
    }
  }

  // Strictly bind Pyramid Tier to the player's real level in the database:
  // 1-5 lvl -> Pyramid 1, 6-10 lvl -> Pyramid 2, 11-20 lvl -> Pyramid 3
  const canonicalTier = getPyramidTierForLevel(unpackedLvl);

  const normalizedStats = normalizeStatsForLevel(
    unpackedLvl,
    Number(parsedEmailData.str ?? row.str ?? 1),
    Number(parsedEmailData.agi ?? row.agi ?? 1),
    Number(parsedEmailData.vit ?? row.vit ?? 1),
    Number(parsedEmailData.stat_points ?? row.stat_points ?? 0)
  );

  const rawEquippedObj =
    parsedEmailData.equipped && typeof parsedEmailData.equipped === 'object'
      ? { ...parsedEmailData.equipped }
      : row.equipped && typeof row.equipped === 'object'
      ? { ...row.equipped }
      : {};
  const rawInventoryArr: any[] = Array.isArray(parsedEmailData.inventory)
    ? [...parsedEmailData.inventory]
    : Array.isArray(row.inventory)
    ? [...row.inventory]
    : [];

  // Normalize item icons & unequip any item exceeding current unpackedLvl
  let gearHpBonus = 0;
  let gearEnBonus = 0;
  let gearDmgBonus = 0;
  Object.keys(rawEquippedObj).forEach((slotKey) => {
    const it = rawEquippedObj[slotKey];
    if (!it) return;
    if (typeof it.icon === 'string' && it.icon.includes('flame_sword')) {
      it.icon = '⚔️';
    }
    if (Number(it.lvl || 1) > unpackedLvl) {
      rawInventoryArr.unshift(it);
      rawEquippedObj[slotKey] = null;
    } else if (Number(it.durability ?? 1) > 0) {
      gearHpBonus += Number(it.hp || 0);
      gearEnBonus += Number(it.energyBonus || 0);
      gearDmgBonus += Number(it.dmg || 0);
    }
  });
  rawInventoryArr.forEach((it) => {
    if (it && typeof it.icon === 'string' && it.icon.includes('flame_sword')) {
      it.icon = '⚔️';
    }
  });

  const bonusHpVal = Math.max(0, Number(parsedEmailData.bonus_hp ?? row.bonus_hp ?? 0));
  const bonusDmgVal = Math.max(0, Number(parsedEmailData.bonus_dmg ?? row.bonus_dmg ?? 0));
  const calculatedMaxHp = getHeroMaxHpFromVit(normalizedStats.vit) + gearHpBonus + bonusHpVal;
  const calculatedMaxEnergy = 100 + gearEnBonus;
  const calculatedDmg = getHeroDamageFromStr(normalizedStats.str) + gearDmgBonus + bonusDmgVal;

  const rawHpVal = Number(parsedEmailData.hp ?? row.hp ?? calculatedMaxHp);
  let clampedHp = Math.min(calculatedMaxHp, Math.max(0, rawHpVal));
  const rawEnergyVal = Number(parsedEmailData.energy ?? row.energy ?? calculatedMaxEnergy);
  let clampedEnergy = Math.min(calculatedMaxEnergy, Math.max(0, rawEnergyVal));

  const hasExplicitGold = row.gold !== undefined || parsedEmailData.gold !== undefined;
  const rawRowGold = Number(row.gold ?? 0);
  const rawEmailGold = Number(parsedEmailData.gold ?? 0);
  const resolvedGold = hasExplicitGold ? Math.max(0, rawRowGold > 0 ? rawRowGold : rawEmailGold) : 0;

  const hasExplicitCrystals = row.crystals !== undefined || parsedEmailData.crystals !== undefined;
  const rawRowCrystals = Number(row.crystals ?? 0);
  const rawEmailCrystals = Number(parsedEmailData.crystals ?? 0);
  const resolvedCrystals = hasExplicitCrystals ? Math.max(0, rawRowCrystals > 0 ? rawRowCrystals : rawEmailCrystals) : 0;

  const rawRow =
    parsedEmailData.row ??
    parsedEmailData['ряд'] ??
    row.row ??
    row['ряд'] ??
    9;
  const rawCol =
    parsedEmailData.col ??
    parsedEmailData['ц'] ??
    parsedEmailData.cell ??
    row.col ??
    row['ц'] ??
    1;

  const rawIsOnlineInDb =
    parsedEmailData.is_online !== undefined
      ? Boolean(parsedEmailData.is_online)
      : row.is_online !== undefined
      ? Boolean(row.is_online)
      : false;
  const rawLastSeen = Number(parsedEmailData.last_seen ?? row.last_seen ?? 0);
  const effectiveOnline = isPlayerOnlineByHeartbeat(rawIsOnlineInDb, rawLastSeen);

  // Offline HP & Energy regeneration based on real elapsed time when player was offline
  const resolvedLocation = (parsedEmailData.location ?? row.location) === 'pyramid' ? 'pyramid' : 'city';
  const resolvedPremiumUntil = Number(parsedEmailData.premium_until ?? row.premium_until ?? 0);
  const resolvedIsPremium = Boolean(parsedEmailData.is_premium ?? row.is_premium ?? false) && (resolvedPremiumUntil <= 0 || resolvedPremiumUntil > Date.now());

  if (!effectiveOnline && rawLastSeen > 0 && (clampedHp < calculatedMaxHp || clampedEnergy < calculatedMaxEnergy)) {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - rawLastSeen) / 1000));
    const regenRateSec = resolvedLocation === 'pyramid' ? (resolvedIsPremium ? 4 : 8) : (resolvedIsPremium ? 1 : 3);
    const regenPerTick = resolvedIsPremium ? 2 : 1;
    const ticks = Math.floor(elapsedSec / regenRateSec);
    if (ticks > 0) {
      const gained = ticks * regenPerTick;
      clampedHp = Math.min(calculatedMaxHp, Math.max(0, clampedHp + gained));
      clampedEnergy = Math.min(calculatedMaxEnergy, Math.max(0, clampedEnergy + gained));
    }
  }

  const rawMobsKilled = Math.max(0, Number(parsedEmailData.mobs_killed ?? row.mobs_killed ?? parsedEmailData.mob_kills ?? row.mob_kills ?? 0));
  const estimatedMinKills = unpackedLvl > 1 ? Math.max(0, Math.floor(getTotalAccumulatedExp(unpackedLvl, unpackedExp) / 45)) : 0;
  const resolvedMobsKilled = Math.max(rawMobsKilled, estimatedMinKills);

  const rawTotalGold = Math.max(0, Number(parsedEmailData.total_gold_collected ?? row.total_gold_collected ?? 0));
  const resolvedTotalGold = Math.max(resolvedGold, rawTotalGold);

  const unpacked = {
    ...parsedEmailData,
    ...row,
    name: nick || row.name,
    nick: nick || row.nick,
    real_email: parsedEmailData.real_email ?? (typeof row.email === 'string' && !row.email.trim().startsWith('{') ? row.email : ''),
    gold: resolvedGold,
    crystals: resolvedCrystals,
    lvl: unpackedLvl,
    level: unpackedLvl,
    exp: unpackedExp,
    max_hp: calculatedMaxHp,
    hp: clampedHp,
    energy: clampedEnergy,
    max_energy: calculatedMaxEnergy,
    dmg: calculatedDmg,
    hp_potions: Math.max(0, Number(parsedEmailData.hp_potions ?? row.hp_potions ?? 3)),
    en_potions: Math.max(0, Number(parsedEmailData.en_potions ?? row.en_potions ?? 3)),
    exp_potions: Math.max(0, Number(parsedEmailData.exp_potions ?? row.exp_potions ?? 0)),
    exp_elixir_until: Math.max(0, Number(parsedEmailData.exp_elixir_until ?? row.exp_elixir_until ?? 0)),
    str: normalizedStats.str,
    agi: normalizedStats.agi,
    vit: normalizedStats.vit,
    gear_v2_migrated: true,
    exp_table_v3_migrated: true,
    stat_points: normalizedStats.statPoints,
    bonus_dmg: bonusDmgVal,
    bonus_hp: bonusHpVal,
    bag_capacity: Math.max(20, Number(parsedEmailData.bag_capacity ?? row.bag_capacity ?? 100)),
    sell_experience: Math.max(0, Number(parsedEmailData.sell_experience ?? row.sell_experience ?? 0)),
    mobs_killed: resolvedMobsKilled,
    mob_kills: resolvedMobsKilled,
    mobsKilled: resolvedMobsKilled,
    total_gold_collected: resolvedTotalGold,
    totalGoldCollected: resolvedTotalGold,
    pvp_kills: Math.max(0, Number(parsedEmailData.pvp_kills ?? row.pvp_kills ?? 0)),
    deaths: Math.max(0, Number(parsedEmailData.deaths ?? row.deaths ?? 0)),
    last_wheel_spin_time: Number(parsedEmailData.last_wheel_spin_time ?? row.last_wheel_spin_time ?? 0),
    last_gold_wheel_spin_time: Number(parsedEmailData.last_gold_wheel_spin_time ?? row.last_gold_wheel_spin_time ?? 0),
    daily_gold_wheel_spins: Math.max(0, Number(parsedEmailData.daily_gold_wheel_spins ?? row.daily_gold_wheel_spins ?? 0)),
    daily_crystal_wheel_spins: Math.max(0, Number(parsedEmailData.daily_crystal_wheel_spins ?? row.daily_crystal_wheel_spins ?? 0)),
    daily_wheel_spins_date: String(parsedEmailData.daily_wheel_spins_date ?? row.daily_wheel_spins_date ?? ''),
    daily_crystal_to_gold_count: Math.max(0, Number(parsedEmailData.daily_crystal_to_gold_count ?? row.daily_crystal_to_gold_count ?? 0)),
    daily_crystal_to_gold_date: String(parsedEmailData.daily_crystal_to_gold_date ?? row.daily_crystal_to_gold_date ?? ''),
    daily_gold_to_crystal_count: Math.max(0, Number(parsedEmailData.daily_gold_to_crystal_count ?? row.daily_gold_to_crystal_count ?? 0)),
    daily_gold_to_crystal_date: String(parsedEmailData.daily_gold_to_crystal_date ?? row.daily_gold_to_crystal_date ?? ''),
    daily_login_day: Math.max(0, Number(parsedEmailData.daily_login_day ?? row.daily_login_day ?? 0)),
    daily_login_last_date: String(parsedEmailData.daily_login_last_date ?? row.daily_login_last_date ?? ''),
    claimed_mail_gift_ids: Array.isArray(parsedEmailData.claimed_mail_gift_ids)
      ? parsedEmailData.claimed_mail_gift_ids
      : Array.isArray(row.claimed_mail_gift_ids)
      ? row.claimed_mail_gift_ids
      : [],
    trade_protocol: Array.isArray(parsedEmailData.trade_protocol)
      ? parsedEmailData.trade_protocol
      : Array.isArray(row.trade_protocol)
      ? row.trade_protocol
      : [],
    friends: Array.isArray(parsedEmailData.friends)
      ? parsedEmailData.friends
      : Array.isArray(row.friends)
      ? row.friends
      : [],
    equipped: rawEquippedObj,
    inventory: rawInventoryArr,
    location: (parsedEmailData.location ?? row.location) === 'pyramid' ? 'pyramid' : 'city',
    pyramid_tier: canonicalTier,
    пирамидальный_уровень: canonicalTier,
    pyramidTier: canonicalTier,
    row: Number.isFinite(Number(rawRow)) ? Number(rawRow) : 9,
    ряд: Number.isFinite(Number(rawRow)) ? Number(rawRow) : 9,
    col: Number.isFinite(Number(rawCol)) ? Number(rawCol) : 1,
    ц: Number.isFinite(Number(rawCol)) ? Number(rawCol) : 1,
    avatar: parsedEmailData.avatar ?? row.avatar ?? (isAdmin ? '👑' : '🧙‍♂️'),
    is_online: effectiveOnline,
    isOnline: effectiveOnline,
    _rawIsOnlineInDb: rawIsOnlineInDb,
    last_seen: rawLastSeen,
    is_premium: Boolean(parsedEmailData.is_premium ?? row.is_premium ?? false),
    premium_until: Number(parsedEmailData.premium_until ?? row.premium_until ?? 0),
    was_killed_in_pvp: Boolean(parsedEmailData.was_killed_in_pvp ?? row.was_killed_in_pvp ?? false),
    killed_by: parsedEmailData.killed_by ?? row.killed_by ?? undefined,
    external_sync_ts: Number(parsedEmailData.external_sync_ts ?? row.external_sync_ts ?? 0),
    clan_id: parsedEmailData.clan_id ?? parsedEmailData.clanId ?? row.clan_id ?? row.clanId ?? undefined,
    clan_tag: parsedEmailData.clan_tag ?? parsedEmailData.clanTag ?? row.clan_tag ?? row.clanTag ?? undefined,
    clan_name: parsedEmailData.clan_name ?? parsedEmailData.clanName ?? row.clan_name ?? row.clanName ?? undefined,
    clan_emblem: parsedEmailData.clan_emblem ?? parsedEmailData.clanEmblem ?? row.clan_emblem ?? row.clanEmblem ?? undefined,
    clan_role: parsedEmailData.clan_role ?? parsedEmailData.clanRole ?? row.clan_role ?? row.clanRole ?? undefined,
    clanId: parsedEmailData.clan_id ?? parsedEmailData.clanId ?? row.clan_id ?? row.clanId ?? undefined,
    clanTag: parsedEmailData.clan_tag ?? parsedEmailData.clanTag ?? row.clan_tag ?? row.clanTag ?? undefined,
    clanName: parsedEmailData.clan_name ?? parsedEmailData.clanName ?? row.clan_name ?? row.clanName ?? undefined,
    clanEmblem: parsedEmailData.clan_emblem ?? parsedEmailData.clanEmblem ?? row.clan_emblem ?? row.clanEmblem ?? undefined,
    clanRole: parsedEmailData.clan_role ?? parsedEmailData.clanRole ?? row.clan_role ?? row.clanRole ?? undefined,
    owned_skin_ids: Array.isArray(parsedEmailData.owned_skin_ids ?? parsedEmailData.ownedSkinIds ?? row.owned_skin_ids ?? row.ownedSkinIds)
      ? (parsedEmailData.owned_skin_ids ?? parsedEmailData.ownedSkinIds ?? row.owned_skin_ids ?? row.ownedSkinIds)
      : [],
    ownedSkinIds: Array.isArray(parsedEmailData.owned_skin_ids ?? parsedEmailData.ownedSkinIds ?? row.owned_skin_ids ?? row.ownedSkinIds)
      ? (parsedEmailData.owned_skin_ids ?? parsedEmailData.ownedSkinIds ?? row.owned_skin_ids ?? row.ownedSkinIds)
      : [],
    owned_skin_expirations: (parsedEmailData.owned_skin_expirations ?? parsedEmailData.ownedSkinExpirations ?? row.owned_skin_expirations ?? row.ownedSkinExpirations) || {},
    ownedSkinExpirations: (parsedEmailData.owned_skin_expirations ?? parsedEmailData.ownedSkinExpirations ?? row.owned_skin_expirations ?? row.ownedSkinExpirations) || {},
    owned_skins: Array.isArray(parsedEmailData.owned_skins ?? parsedEmailData.ownedSkins ?? row.owned_skins ?? row.ownedSkins)
      ? (parsedEmailData.owned_skins ?? parsedEmailData.ownedSkins ?? row.owned_skins ?? row.ownedSkins)
      : [],
    ownedSkins: Array.isArray(parsedEmailData.owned_skins ?? parsedEmailData.ownedSkins ?? row.owned_skins ?? row.ownedSkins)
      ? (parsedEmailData.owned_skins ?? parsedEmailData.ownedSkins ?? row.owned_skins ?? row.ownedSkins)
      : [],
    active_skin_id: parsedEmailData.active_skin_id ?? parsedEmailData.activeSkinId ?? row.active_skin_id ?? row.activeSkinId ?? null,
    activeSkinId: parsedEmailData.active_skin_id ?? parsedEmailData.activeSkinId ?? row.active_skin_id ?? row.activeSkinId ?? null,
    ban_info: (() => {
      const rawBan = parsedEmailData.ban_info ?? parsedEmailData.banInfo ?? row.ban_info ?? row.banInfo ?? null;
      if (!rawBan || typeof rawBan !== 'object') return null;
      if (rawBan.isBanned && !rawBan.isPermanent && Number(rawBan.bannedUntil || 0) > 0 && Number(rawBan.bannedUntil) <= Date.now()) {
        return { ...rawBan, isBanned: false };
      }
      return rawBan;
    })(),
    banInfo: (() => {
      const rawBan = parsedEmailData.ban_info ?? parsedEmailData.banInfo ?? row.ban_info ?? row.banInfo ?? null;
      if (!rawBan || typeof rawBan !== 'object') return null;
      if (rawBan.isBanned && !rawBan.isPermanent && Number(rawBan.bannedUntil || 0) > 0 && Number(rawBan.bannedUntil) <= Date.now()) {
        return { ...rawBan, isBanned: false };
      }
      return rawBan;
    })(),
    _rawEmailJson: parsedEmailData
  };

  if (nick) {
    const lowerKey = nick.toLowerCase();
    const existingCache = playerStateCache.get(lowerKey);
    const hasRecentCoordWrite =
      Boolean(existingCache?._localUpdatedAt && Date.now() - existingCache._localUpdatedAt < 5000);
    const hasRecentBalanceWrite =
      Boolean(existingCache?._localBalanceUpdatedAt && Date.now() - existingCache._localBalanceUpdatedAt < 5000);
    const isFreshAdminSync =
      (Number(unpacked.external_sync_ts || 0) > 0 &&
        Number(unpacked.external_sync_ts || 0) > Number(existingCache?.external_sync_ts || 0)) ||
      Boolean(existingCache?._adminActionTimestamp && Date.now() - existingCache._adminActionTimestamp < 60000);

    // Only allow full database rows (or admin syncs) to overwrite balance/inventory/daily-reward fields in cache
    const shouldKeepCachedBalance = !isFreshAdminSync && (hasRecentBalanceWrite || !hasFullEmailJson);

    if (!hasRecentCoordWrite || isFreshAdminSync) {
      const candidateLvl = Math.max(1, Number(unpacked.lvl ?? 1));
      const cachedLvl = Math.max(1, Number(existingCache?.lvl ?? 1));
      const safeLvl = isFreshAdminSync ? candidateLvl : Math.max(cachedLvl, candidateLvl);
      let safeExp = unpacked.exp;
      if (!isFreshAdminSync) {
        if (candidateLvl === cachedLvl) {
          safeExp = Math.max(Number(existingCache?.exp ?? 0), Number(unpacked.exp ?? 0));
        } else if (cachedLvl > candidateLvl) {
          safeExp = Number(existingCache?.exp ?? 0);
        }
      }

      playerStateCache.set(lowerKey, {
        ...unpacked,
        gold: shouldKeepCachedBalance ? (existingCache?.gold ?? unpacked.gold) : unpacked.gold,
        crystals: shouldKeepCachedBalance ? (existingCache?.crystals ?? unpacked.crystals) : unpacked.crystals,
        lvl: safeLvl,
        level: safeLvl,
        exp: safeExp,
        stat_points: shouldKeepCachedBalance ? (existingCache?.stat_points ?? unpacked.stat_points) : unpacked.stat_points,
        str: shouldKeepCachedBalance ? (existingCache?.str ?? unpacked.str) : (unpacked.str ?? existingCache?.str),
        agi: shouldKeepCachedBalance ? (existingCache?.agi ?? unpacked.agi) : (unpacked.agi ?? existingCache?.agi),
        vit: shouldKeepCachedBalance ? (existingCache?.vit ?? unpacked.vit) : (unpacked.vit ?? existingCache?.vit),
        hp_potions: shouldKeepCachedBalance ? (existingCache?.hp_potions ?? unpacked.hp_potions) : unpacked.hp_potions,
        en_potions: shouldKeepCachedBalance ? (existingCache?.en_potions ?? unpacked.en_potions) : unpacked.en_potions,
        exp_potions: shouldKeepCachedBalance ? (existingCache?.exp_potions ?? unpacked.exp_potions) : unpacked.exp_potions,
        exp_elixir_until: shouldKeepCachedBalance ? (existingCache?.exp_elixir_until ?? unpacked.exp_elixir_until) : unpacked.exp_elixir_until,
        daily_login_day: shouldKeepCachedBalance
          ? Math.max(Number(existingCache?.daily_login_day ?? 0), Number(unpacked.daily_login_day ?? 0))
          : unpacked.daily_login_day,
        daily_login_last_date: shouldKeepCachedBalance
          ? (existingCache?.daily_login_last_date || unpacked.daily_login_last_date)
          : unpacked.daily_login_last_date,
        inventory:
          shouldKeepCachedBalance && Array.isArray(existingCache?.inventory)
            ? existingCache.inventory
            : unpacked.inventory,
        equipped:
          shouldKeepCachedBalance && existingCache?.equipped
            ? existingCache.equipped
            : unpacked.equipped,
        is_premium: shouldKeepCachedBalance ? (existingCache?.is_premium ?? unpacked.is_premium) : (unpacked.is_premium || existingCache?.is_premium),
        premium_until: shouldKeepCachedBalance ? (existingCache?.premium_until ?? unpacked.premium_until) : Math.max(Number(existingCache?.premium_until ?? 0), Number(unpacked.premium_until ?? 0)),
        _rawEmailJson:
          shouldKeepCachedBalance && existingCache?._rawEmailJson
            ? existingCache._rawEmailJson
            : unpacked._rawEmailJson,
        _localUpdatedAt: existingCache?._localUpdatedAt,
        _localBalanceUpdatedAt: existingCache?._localBalanceUpdatedAt,
        _adminActionTimestamp: existingCache?._adminActionTimestamp
      });
    } else if (!shouldKeepCachedBalance && existingCache) {
      const candidateLvl = Math.max(1, Number(unpacked.lvl ?? 1));
      const cachedLvl = Math.max(1, Number(existingCache.lvl ?? 1));
      const safeLvl = isFreshAdminSync ? candidateLvl : Math.max(cachedLvl, candidateLvl);
      let safeExp = unpacked.exp;
      if (!isFreshAdminSync) {
        if (candidateLvl === cachedLvl) {
          safeExp = Math.max(Number(existingCache.exp ?? 0), Number(unpacked.exp ?? 0));
        } else if (cachedLvl > candidateLvl) {
          safeExp = Number(existingCache.exp ?? 0);
        }
      }

      playerStateCache.set(lowerKey, {
        ...existingCache,
        gold: unpacked.gold ?? existingCache.gold,
        crystals: unpacked.crystals ?? existingCache.crystals,
        lvl: safeLvl,
        level: safeLvl,
        exp: safeExp,
        stat_points: unpacked.stat_points ?? existingCache.stat_points,
        str: unpacked.str ?? existingCache.str,
        agi: unpacked.agi ?? existingCache.agi,
        vit: unpacked.vit ?? existingCache.vit,
        max_hp: isFreshAdminSync ? unpacked.max_hp : Math.max(Number(existingCache.max_hp ?? 100), Number(unpacked.max_hp ?? 100)),
        max_energy: isFreshAdminSync ? unpacked.max_energy : Math.max(Number(existingCache.max_energy ?? 60), Number(unpacked.max_energy ?? 60)),
        hp_potions: unpacked.hp_potions ?? existingCache.hp_potions ?? 0,
        en_potions: unpacked.en_potions ?? existingCache.en_potions ?? 0,
        exp_potions: unpacked.exp_potions ?? existingCache.exp_potions ?? 0,
        exp_elixir_until: unpacked.exp_elixir_until ?? existingCache.exp_elixir_until ?? 0,
        daily_login_day: Math.max(Number(existingCache.daily_login_day ?? 0), Number(unpacked.daily_login_day ?? 0)),
        daily_login_last_date: unpacked.daily_login_last_date || existingCache.daily_login_last_date || '',
        is_premium: isFreshAdminSync ? unpacked.is_premium : (unpacked.is_premium || existingCache.is_premium),
        premium_until: isFreshAdminSync ? unpacked.premium_until : Math.max(Number(existingCache.premium_until ?? 0), Number(unpacked.premium_until ?? 0)),
        is_admin: unpacked.is_admin ?? existingCache.is_admin,
        equipped: unpacked.equipped ?? existingCache.equipped,
        trade_protocol:
          Array.isArray(unpacked.trade_protocol) &&
          unpacked.trade_protocol.length >= (existingCache.trade_protocol?.length || 0)
            ? unpacked.trade_protocol
            : existingCache.trade_protocol,
        inventory: Array.isArray(unpacked.inventory)
          ? unpacked.inventory
          : existingCache.inventory
      });
    }
  }

  if (Array.isArray(unpacked.owned_skins) && unpacked.owned_skins.length > 0) {
    registerPlayerOwnedSkinsInMemory(unpacked.owned_skins);
  }

  return unpacked;
}

/**
 * Normalizes raw row data from Supabase postgres_changes into RealtimePlayer model
 */
export function normalizeSupabasePlayer(rawRow: any): RealtimePlayer {
  const row = unpackPlayerRow(rawRow);

  const nick = String(
    row.nick ||
    row['имя'] ||
    row['ник'] ||
    row.username ||
    row.name ||
    row['игрок'] ||
    `Игрок_${row.id || Math.floor(Math.random() * 1000)}`
  ).trim();
  const lvl = Math.max(1, Math.min(MAX_LEVEL, Number(row.lvl ?? 1)));
  const maxHp = Math.max(1, Number(row.max_hp ?? (100 + lvl * 20)));
  const hp = Math.min(maxHp, Math.max(0, Number(row.hp ?? maxHp)));
  const rawLoc = String(row.location || '').toLowerCase();
  const location = (rawLoc === 'pyramid' || rawLoc === 'пирамида') ? 'pyramid' : 'city';
  // Strictly bind Pyramid Tier to real player level: 1-5 -> 1, 6-10 -> 2, 11-20 -> 3
  const pyramidTier = getPyramidTierForLevel(lvl);
  const rowPos = Number.isFinite(Number(row.row ?? row['ряд'])) ? Number(row.row ?? row['ряд']) : 9;
  const colPos = Number.isFinite(Number(row.col ?? row['ц'])) ? Number(row.col ?? row['ц']) : 1;
  const isAdmin = Number(row.is_admin) === 1 || Number(row.isAdmin) === 1;
  const avatar = row.avatar || (isAdmin ? '👑' : '🧙‍♂️');
  const rawLastSeen = Number(row.last_seen ?? 0);
  // Игрок считается онлайн ТОЛЬКО если is_online === true И его сигнал активности (last_seen) обновлялся менее 15 секунд назад
  const isOnline = isPlayerOnlineByHeartbeat(row._rawIsOnlineInDb ?? row.is_online, rawLastSeen);
  const status = location === 'pyramid' ? `В Пирамиде (Т${pyramidTier})` : 'В Городе';
  const role = (row.role || (isAdmin ? 'admin' : 'regular')) as RealtimePlayer['role'];

  const rawPremiumUntil = Number(row.premium_until ?? 0);
  const isPremiumActive = Boolean(row.is_premium) && rawPremiumUntil > Date.now();

  return {
    id: row.id !== undefined ? row.id : nick,
    nick,
    lvl,
    hp,
    maxHp,
    avatar,
    location,
    pyramidTier,
    row: rowPos,
    col: colPos,
    status,
    isOnline,
    isPremium: isPremiumActive,
    premiumUntil: rawPremiumUntil,
    role,
    lastSeen: rawLastSeen,
    wasKilledInPvp: Boolean(row.was_killed_in_pvp),
    killedBy: row.killed_by ? String(row.killed_by) : undefined,
    gold: Math.max(0, Number(row.gold ?? 0)),
    crystals: Math.max(0, Number(row.crystals ?? 0)),
    mobsKilled: Math.max(0, Number(row.mobs_killed ?? 0)),
    pvpKills: Math.max(0, Number(row.pvp_kills ?? 0)),
    deaths: Math.max(0, Number(row.deaths ?? 0)),
    str: Math.max(1, Number(row.str ?? 5)),
    agi: Math.max(1, Number(row.agi ?? 5)),
    vit: Math.max(1, Number(row.vit ?? 5)),
    exp: row.exp ?? 0,
    statPoints: Math.max(0, Number(row.stat_points ?? 0)),
    energy: row.energy ?? 100,
    maxEnergy: row.max_energy ?? 100,
    hpPotions: row.hp_potions ?? 3,
    enPotions: row.en_potions ?? 3,
    expPotions: row.exp_potions ?? 0,
    expElixirUntil: row.exp_elixir_until ?? 0,
    bagCapacity: Math.max(20, Number(row.bag_capacity ?? 100)),
    sellExperience: Math.max(0, Number(row.sell_experience ?? 0)),
    is_admin: isAdmin ? 1 : 0,
    isAdmin: isAdmin ? 1 : 0,
    equipped: row.equipped || {},
    inventory: row.inventory || [],
    tradeProtocol: Array.isArray(row.trade_protocol) ? row.trade_protocol : [],
    externalSyncTs: Number(row.external_sync_ts ?? 0),
    clanId: row.clanId || row.clan_id || undefined,
    clanTag: row.clanTag || row.clan_tag || undefined,
    clanName: row.clanName || row.clan_name || undefined,
    clanEmblem: row.clanEmblem || row.clan_emblem || undefined,
    clanRole: row.clanRole || row.clan_role || undefined,
    ownedSkinIds: Array.isArray(row.ownedSkinIds ?? row.owned_skin_ids) ? (row.ownedSkinIds ?? row.owned_skin_ids) : [],
    ownedSkinExpirations: row.ownedSkinExpirations ?? row.owned_skin_expirations ?? {},
    ownedSkins: Array.isArray(row.ownedSkins ?? row.owned_skins) ? (row.ownedSkins ?? row.owned_skins) : [],
    activeSkinId: row.activeSkinId ?? row.active_skin_id ?? null,
    banInfo: row.banInfo ?? row.ban_info ?? null
  } as any;
}


const tierStateCache = new Map<number, PyramidTierState & { _id?: number; _localWriteAt?: number }>();
const tierListeners = new Set<(state: PyramidTierState) => void>();

let globalMailCache: (GlobalMailAndChatState & { _id?: number; _localWriteAt?: number }) | null = null;
const mailListeners = new Set<(state: GlobalMailAndChatState) => void>();

export function getCanonicalTierSeed(tier: number): number {
  const safeTier = Math.max(1, Number(tier) || 1);
  return safeTier * 100003 + 1337;
}

export function isSystemTierRow(rawRow: any): boolean {
  if (!rawRow || typeof rawRow !== 'object') return false;
  const name = String(rawRow.name || rawRow.nick || '').trim();
  if (name.startsWith('__TIER_')) return true;
  if (typeof rawRow.email === 'string' && rawRow.email.includes('"is_system_tier":true')) {
    return true;
  }
  return false;
}

export function isSystemMailRow(rawRow: any): boolean {
  if (!rawRow || typeof rawRow !== 'object') return false;
  const name = String(rawRow.name || rawRow.nick || '').trim();
  if (name === '__GLOBAL_MAIL__') return true;
  if (typeof rawRow.email === 'string' && rawRow.email.includes('"is_system_mail":true')) {
    return true;
  }
  return false;
}

export function unpackSystemMailRow(rawRow: any): (GlobalMailAndChatState & { _id?: number }) | null {
  if (!isSystemMailRow(rawRow)) return null;
  let parsed: any = {};
  if (typeof rawRow.email === 'string' && rawRow.email.trim().startsWith('{')) {
    try {
      parsed = JSON.parse(rawRow.email);
    } catch (e) {
      return null;
    }
  }
  const messages: PrivateMessage[] = Array.isArray(parsed.messages) ? parsed.messages : [];
  const chatMessages: ChatMessage[] = Array.isArray(parsed.chatMessages) ? parsed.chatMessages : [];
  const wheelWinners: WheelWinnerEntry[] = Array.isArray(parsed.wheelWinners) ? parsed.wheelWinners : [];
  const updatedAt = Number(parsed.updated_at ?? parsed.updatedAt ?? Date.now());

  const hasRecentLocalWrite =
    globalMailCache?._localWriteAt &&
    Date.now() - globalMailCache._localWriteAt < 2500 &&
    globalMailCache.updatedAt > updatedAt;

  const unpacked: GlobalMailAndChatState & { _id?: number; _localWriteAt?: number } = hasRecentLocalWrite
    ? { ...globalMailCache!, _id: rawRow.id !== undefined ? Number(rawRow.id) : globalMailCache?._id }
    : {
        messages,
        chatMessages,
        wheelWinners,
        updatedAt,
        _id: rawRow.id !== undefined ? Number(rawRow.id) : globalMailCache?._id,
        _localWriteAt: globalMailCache?._localWriteAt
      };

  globalMailCache = unpacked;
  return unpacked;
}

function notifyMailListeners(state: GlobalMailAndChatState) {
  mailListeners.forEach((cb) => {
    try {
      cb(state);
    } catch (e) {
      // ignore
    }
  });
}

export function subscribeToGlobalMailAndChat(
  onUpdate: (state: GlobalMailAndChatState) => void
): () => void {
  mailListeners.add(onUpdate);
  if (globalMailCache) {
    try {
      onUpdate(globalMailCache);
    } catch (e) {
      // ignore
    }
  }
  return () => {
    mailListeners.delete(onUpdate);
  };
}

export function createDefaultRareBossTimers(now: number = Date.now()): RareBossTimerState[] {
  return [
    {
      id: 'crystal',
      name: '💎 Тайник Кристаллов',
      intervalMs: 3600000, // 1 hour
      remainingMs: 3600000,
      targetSpawnAt: now + 3600000,
      isFrozenWaitingForCell: false,
      isAliveOnMap: false,
      lastTickAt: now
    }
  ];
}

export function normalizeRareBossTimers(
  rawTimers: RareBossTimerState[] | undefined,
  cells: PyramidCell[][],
  now: number = Date.now()
): RareBossTimerState[] {
  const defaults = createDefaultRareBossTimers(now);
  const rawList = Array.isArray(rawTimers) && rawTimers.length > 0 ? rawTimers : defaults;

  return defaults.map((def) => {
    const found = rawList.find((r) => r && r.id === def.id);
    // Check if boss / crystal cache actually exists on the map right now
    let existsOnMap = false;
    for (let r = 0; r < cells.length; r++) {
      for (let c = 0; c < (cells[r]?.length || 0); c++) {
        const cell = cells[r][c];
        if (
          cell &&
          (cell.type === 'mob' || cell.type === 'sack') &&
          cell.rareBossId === def.id
        ) {
          existsOnMap = true;
          break;
        }
      }
      if (existsOnMap) break;
    }

    if (!found) {
      return existsOnMap
        ? { ...def, remainingMs: 0, isAliveOnMap: true, isFrozenWaitingForCell: false }
        : def;
    }

    const intervalMs = Number(found.intervalMs) > 0 ? Number(found.intervalMs) : def.intervalMs;

    if (existsOnMap) {
      return {
        ...def,
        ...found,
        intervalMs,
        remainingMs: 0,
        targetSpawnAt: now,
        isAliveOnMap: true,
        isFrozenWaitingForCell: false,
        lastTickAt: now
      };
    }

    // If it was previously marked alive on map, but is no longer on the map, restart cycle
    if (found.isAliveOnMap && !existsOnMap) {
      return {
        ...def,
        ...found,
        intervalMs,
        remainingMs: intervalMs,
        targetSpawnAt: now + intervalMs,
        isAliveOnMap: false,
        isFrozenWaitingForCell: false,
        lastTickAt: now
      };
    }

    if (found.isFrozenWaitingForCell) {
      return {
        ...def,
        ...found,
        intervalMs,
        remainingMs: 0,
        targetSpawnAt: now,
        isAliveOnMap: false,
        isFrozenWaitingForCell: true,
        lastTickAt: now
      };
    }

    const savedLastTick = Number(found.lastTickAt) > 0 ? Number(found.lastTickAt) : now;
    const savedRem =
      found.remainingMs !== undefined && Number.isFinite(Number(found.remainingMs))
        ? Math.max(0, Number(found.remainingMs))
        : intervalMs;

    // Anchor to deterministic targetSpawnAt so timer never jumps backward or stalls
    const targetSpawnAt =
      found.targetSpawnAt && Number(found.targetSpawnAt) > 0
        ? Number(found.targetSpawnAt)
        : savedLastTick + savedRem;

    const remainingMs = Math.max(0, targetSpawnAt - now);

    return {
      ...def,
      ...found,
      intervalMs,
      remainingMs,
      targetSpawnAt,
      isAliveOnMap: false,
      isFrozenWaitingForCell: false,
      lastTickAt: now
    };
  });
}

export function unpackSystemTierRow(rawRow: any): (PyramidTierState & { _id?: number }) | null {
  if (!isSystemTierRow(rawRow)) return null;
  let parsed: any = {};
  if (typeof rawRow.email === 'string' && rawRow.email.trim().startsWith('{')) {
    try {
      parsed = JSON.parse(rawRow.email);
    } catch (e) {
      return null;
    }
  }
  const nameStr = String(rawRow.name || '').trim();
  const match = nameStr.match(/^__TIER_(\d+)__$/);
  const tier = Math.max(1, Number(parsed.tier ?? (match ? match[1] : 1)));
  const seed = Math.max(1, Number(parsed.seed || getCanonicalTierSeed(tier)));
  const cells =
    Array.isArray(parsed.cells) && parsed.cells.length > 0
      ? sanitizePyramidCellsForStorage(parsed.cells)
      : generateDeterministicPyramidCells(tier, seed);
  const lastRespawn = Number(parsed.last_respawn ?? parsed.lastRespawn ?? Date.now());
  const rawRareTimers: RareBossTimerState[] | undefined = Array.isArray(
    parsed.rare_boss_timers ?? parsed.rareBossTimers
  )
    ? (parsed.rare_boss_timers ?? parsed.rareBossTimers)
    : undefined;
  const updatedAt = Number(parsed.updated_at ?? parsed.updatedAt ?? Date.now());

  const existing = tierStateCache.get(tier);
  const hasRecentLocalWrite =
    existing?._localWriteAt &&
    Date.now() - existing._localWriteAt < 2500 &&
    existing.updatedAt > updatedAt;

  const normalizedTimers = normalizeRareBossTimers(
    rawRareTimers ?? existing?.rareBossTimers,
    cells,
    Date.now()
  );

  const unpacked: PyramidTierState & { _id?: number; _localWriteAt?: number } = hasRecentLocalWrite
    ? { ...existing!, _id: rawRow.id ?? existing?._id }
    : {
        tier,
        seed,
        cells,
        lastRespawn,
        rareBossTimers: normalizedTimers,
        updatedAt,
        updatedBy: parsed.updated_by ?? parsed.updatedBy,
        _id: rawRow.id !== undefined ? Number(rawRow.id) : existing?._id,
        _localWriteAt: existing?._localWriteAt
      };

  tierStateCache.set(tier, unpacked);
  return unpacked;
}

function notifyTierListeners(state: PyramidTierState) {
  tierListeners.forEach((cb) => {
    try {
      cb(state);
    } catch (e) {
      // ignore
    }
  });
}

export function subscribeToPyramidTierRealtime(
  onTierUpdate: (state: PyramidTierState) => void
): () => void {
  tierListeners.add(onTierUpdate);
  return () => {
    tierListeners.delete(onTierUpdate);
  };
}

export interface RealtimeSubscriptionHandlers {
  onInsert: (player: RealtimePlayer) => void;
  onUpdate: (player: RealtimePlayer, oldData?: any) => void;
  onDelete: (oldRecord: any) => void;
  onStatusChange: (status: RealtimeConnectionStatus, errorMsg?: string) => void;
  onTierUpdate?: (tierState: PyramidTierState) => void;
}

/**
 * Sets up Supabase Realtime channel subscription for the 'players' table
 * listening to INSERT, UPDATE, DELETE postgres_changes.
 */
export function subscribeToPlayersRealtime(
  handlers: RealtimeSubscriptionHandlers
): { channel: RealtimeChannel | null; unsubscribe: () => void } {
  const client = getSupabaseClient();
  if (!client) {
    handlers.onStatusChange('NOT_CONFIGURED', 'Supabase credentials are not configured.');
    return {
      channel: null,
      unsubscribe: () => {}
    };
  }

  handlers.onStatusChange('CONNECTING');

  // Deduplication to prevent double processing if both channel and window event fire
  const seenEvents = new Map<string, number>();
  const isDuplicate = (key: string) => {
    const now = Date.now();
    const last = seenEvents.get(key);
    if (last && now - last < 600) return true;
    seenEvents.set(key, now);
    if (seenEvents.size > 200) {
      const oldestKey = seenEvents.keys().next().value;
      if (oldestKey) seenEvents.delete(oldestKey);
    }
    return false;
  };

  const dispatchInsert = (raw: any) => {
    if (!raw) return;
    if (isSystemMailRow(raw)) {
      const mailState = unpackSystemMailRow(raw);
      if (mailState) notifyMailListeners(mailState);
      return;
    }
    if (isSystemTierRow(raw)) {
      const tierState = unpackSystemTierRow(raw);
      if (tierState) {
        notifyTierListeners(tierState);
        handlers.onTierUpdate?.(tierState);
      }
      return;
    }
    const player = normalizeSupabasePlayer(raw);
    const key = `insert:${player.nick}:${player.id}`;
    if (isDuplicate(key)) return;
    handlers.onInsert(player);
  };

  const dispatchUpdate = (newRaw: any, oldRaw?: any) => {
    if (!newRaw) return;
    if (isSystemMailRow(newRaw)) {
      const mailState = unpackSystemMailRow(newRaw);
      if (mailState) notifyMailListeners(mailState);
      return;
    }
    if (isSystemTierRow(newRaw)) {
      const tierState = unpackSystemTierRow(newRaw);
      if (tierState) {
        notifyTierListeners(tierState);
        handlers.onTierUpdate?.(tierState);
      }
      return;
    }
    const player = normalizeSupabasePlayer(newRaw);
    const key = `update:${player.nick}:${player.row}:${player.col}:${player.hp}:${player.location}:${player.isOnline}`;
    if (isDuplicate(key)) return;
    handlers.onUpdate(player, oldRaw);
  };

  const dispatchDelete = (oldRaw: any) => {
    if (!oldRaw) return;
    if (isSystemMailRow(oldRaw) || isSystemTierRow(oldRaw)) return;
    const nick = oldRaw.nick || oldRaw['имя'] || oldRaw.name || oldRaw.id;
    const key = `delete:${nick}`;
    if (isDuplicate(key)) return;
    handlers.onDelete(oldRaw);
  };

  // Listen to CustomEvents from index.html if present
  const onWinInsert = (e: Event) => dispatchInsert((e as CustomEvent).detail);
  const onWinUpdate = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.new) dispatchUpdate(detail.new, detail.old);
    else dispatchUpdate(detail);
  };
  const onWinDelete = (e: Event) => dispatchDelete((e as CustomEvent).detail);
  const onWinStatus = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.status) handlers.onStatusChange(detail.status, detail.error?.message);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('supabase:player_insert', onWinInsert);
    window.addEventListener('supabase:player_update', onWinUpdate);
    window.addEventListener('supabase:player_delete', onWinDelete);
    window.addEventListener('supabase:status_change', onWinStatus);
    if ((window as any).supabaseRealtimeStatus) {
      handlers.onStatusChange((window as any).supabaseRealtimeStatus);
    }
  }

  // Channel identifier
  const channelName = `realtime:public:players:${Date.now()}`;
  const channel = client
    .channel(channelName)
    // 1. Listen for INSERT event
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'players'
      },
      (payload) => {
        console.log('[Realtime] INSERT event received on players:', payload);
        dispatchInsert(payload.new);
      }
    )
    // 2. Listen for UPDATE event
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'players'
      },
      (payload) => {
        console.log('[Realtime] UPDATE event received on players:', payload);
        dispatchUpdate(payload.new, payload.old);
      }
    )
    // 3. Listen for DELETE event
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'players'
      },
      (payload) => {
        console.log('[Realtime] DELETE event received on players:', payload);
        dispatchDelete(payload.old);
      }
    )
    .subscribe((status, error) => {
      console.log('[Realtime] Channel subscription status changed:', status, error);
      if (status === 'SUBSCRIBED') {
        handlers.onStatusChange('SUBSCRIBED');
      } else if (status === 'CLOSED') {
        handlers.onStatusChange('CLOSED');
      } else if (status === 'CHANNEL_ERROR') {
        handlers.onStatusChange('CHANNEL_ERROR', error?.message || 'Subscription error');
      } else if (status === 'TIMED_OUT') {
        handlers.onStatusChange('TIMED_OUT', 'Connection timed out');
      }
    });

  const unsubscribe = () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('supabase:player_insert', onWinInsert);
      window.removeEventListener('supabase:player_update', onWinUpdate);
      window.removeEventListener('supabase:player_delete', onWinDelete);
      window.removeEventListener('supabase:status_change', onWinStatus);
    }
    try {
      client.removeChannel(channel);
    } catch (e) {
      console.warn('[Realtime] Error removing channel:', e);
    }
  };

  return { channel, unsubscribe };
}

/**
 * Fetch initial players from the Supabase 'players' table
 */
export async function fetchInitialPlayers(): Promise<RealtimePlayer[]> {
  try {
    const rows = await fetchAllPlayersFromDatabase();
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map(normalizeSupabasePlayer);
    }
    return [];
  } catch (err) {
    console.warn('[Supabase] Exception fetching players:', err);
    return [];
  }
}

/**
 * Direct REST fetch from Supabase 'players' table with cache: 'no-store'
 * Ensures Telegram WebView and all mobile browsers always see live database rows.
 */
export async function fetchAllPlayersFromDatabase(): Promise<any[]> {
  let dbRows: any[] = [];

  // 1. Direct uncached REST GET first to guarantee fresh real-time coordinates in Telegram WebView & browsers
  try {
    const res = await fetch(
      `${DEFAULT_SUPABASE_URL}/rest/v1/players?select=*&order=created_at.desc&limit=1000`,
      {
        method: 'GET',
        cache: 'no-store',
        headers: {
          apikey: DEFAULT_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache'
        }
      }
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) dbRows = rows;
    }
  } catch (err) {
    console.warn('[Supabase] Direct REST fetch fallback to client:', err);
  }

  // 2. Fallback to Supabase JS client if needed
  if (dbRows.length === 0) {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('players')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);

        if (!error && Array.isArray(data)) {
          dbRows = data;
        }
      } catch (e) {
        console.warn('[Supabase] Client select error:', e);
      }
    }
  }

  // Unpack JSON state stored in email column and deduplicate by lowercase nickname
  const deduped = new Map<string, any>();
  for (const raw of dbRows) {
    if (isSystemMailRow(raw)) {
      const mailState = unpackSystemMailRow(raw);
      if (mailState) {
        notifyMailListeners(mailState);
      }
      continue;
    }
    if (isSystemTierRow(raw)) {
      const tierState = unpackSystemTierRow(raw);
      if (tierState) {
        notifyTierListeners(tierState);
      }
      continue;
    }
    const unpacked = unpackPlayerRow(raw);
    const key = String(unpacked.name || unpacked.nick || '').trim().toLowerCase();
    if (!key || key.startsWith('__')) continue;

    // Auto-cleanup stale online flag in Supabase DB if player timed out (>15s without heartbeat)
    if (unpacked._rawIsOnlineInDb && !unpacked.is_online && !staleCleanupInFlight.has(key)) {
      staleCleanupInFlight.add(key);
      updatePlayerInDatabase(unpacked.name || unpacked.nick, {
        is_online: false,
        last_seen: unpacked.last_seen || 0
      }).finally(() => {
        setTimeout(() => staleCleanupInFlight.delete(key), 10000);
      });
    }

    const prev = deduped.get(key);
    if (!prev) {
      deduped.set(key, unpacked);
    } else {
      const unpackedSync = Number(unpacked.external_sync_ts || 0);
      const prevSync = Number(prev.external_sync_ts || 0);
      const unpackedSeen = Number(unpacked.last_seen || 0);
      const prevSeen = Number(prev.last_seen || 0);
      if (
        unpackedSync > prevSync ||
        (unpackedSync === prevSync && unpackedSeen > prevSeen) ||
        (unpackedSync === prevSync && unpackedSeen === prevSeen && Number(unpacked.lvl || 1) > Number(prev.lvl || 1))
      ) {
        deduped.set(key, unpacked);
      }
    }
  }

  return Array.from(deduped.values());
}

/**
 * Find a player row in the Supabase 'players' table by nickname (live query, case-insensitive & trimmed)
 */
export async function findPlayerInSupabase(playerName: string): Promise<any | null> {
  if (!playerName) return null;
  const clean = String(playerName).trim().toLowerCase();
  if (!clean) return null;

  const rows = await fetchAllPlayersFromDatabase();
  const match = rows.find((row: any) => {
    const rowName = String(row.name || row.nick || row['имя'] || '').trim().toLowerCase();
    return rowName === clean;
  });
  return match || null;
}

/**
 * Online authentication strictly via Supabase 'players' table.
 * Normalizes nickname and password with .trim().toLowerCase() to prevent case/whitespace login errors.
 */
export async function authenticatePlayerInSupabase(
  playerName: string,
  password: string
): Promise<{ success: boolean; player?: any; error?: string }> {
  const cleanName = String(playerName || '').trim();
  const lowerName = cleanName.toLowerCase();
  const cleanPass = String(password || '').trim();
  const lowerPass = cleanPass.toLowerCase();

  if (!cleanName || !cleanPass) {
    return { success: false, error: 'Введите никнейм и пароль!' };
  }

  try {
    const candidates = await fetchAllPlayersFromDatabase();

    // Находим все записи данного персонажа без учета регистра и случайных пробелов
    const matchingRows = candidates.filter((row: any) => {
      const rowName = String(row.name || row.nick || row['имя'] || '').trim().toLowerCase();
      return rowName === lowerName;
    });

    if (matchingRows.length === 0) {
      return {
        success: false,
        error: `Персонаж «${cleanName}» не найден в базе Supabase! Создайте его во вкладке «Регистрация».`
      };
    }

    // Ищем совпадение пароля без учета регистра и пробелов
    const matchedRow = matchingRows.find((row: any) => {
      const rowPass = String(row.password ?? '').trim().toLowerCase();
      if (!rowPass) return true;
      if (rowPass === lowerPass) return true;
      return false;
    });

    if (!matchedRow) {
      return {
        success: false,
        error: 'Неверный пароль от этого персонажа!'
      };
    }

    return {
      success: true,
      player: unpackPlayerRow(matchedRow)
    };
  } catch (err) {
    console.warn('[Supabase] Exception in authenticatePlayerInSupabase:', err);
    return {
      success: false,
      error: 'Ошибка связи с базой данных Supabase. Проверьте интернет-соединение.'
    };
  }
}

/**
 * Live check in Supabase 'players' table if an email is already registered
 */
export async function findPlayerByEmailInSupabase(email: string): Promise<any | null> {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;

  const data = await fetchAllPlayersFromDatabase();
  const match = data.find((row: any) => {
    const rowEmail = String(row.real_email || row.email || '').trim().toLowerCase();
    return rowEmail !== '' && rowEmail === cleanEmail;
  });
  return match || null;
}

/**
 * Guarantees saving a player directly into the Supabase 'players' table
 * with name, email (JSON state), password, gold, crystals, and is_admin.
 */
export async function savePlayerToDatabase(
  playerName: string,
  email: string = '',
  password: string = '',
  gold?: number,
  crystals?: number,
  isAdmin?: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  const client = getSupabaseClient();
  const cleanName = playerName.trim();
  const lowerName = cleanName.toLowerCase();
  const cleanPass = password.trim();
  const lowerPass = cleanPass.toLowerCase();

  if (!cleanName) {
    return { success: false, error: 'Введите имя персонажа!' };
  }

  // 1. Проверяем в живой базе Supabase, существует ли уже такой персонаж
  const existingRows = await fetchAllPlayersFromDatabase();
  const existingChar = existingRows.find((row: any) => {
    const rowName = String(row.name || row.nick || row['имя'] || '').trim().toLowerCase();
    return rowName === lowerName;
  });

  if (existingChar) {
    const existingPass = String(existingChar.password ?? '').trim().toLowerCase();
    if (!existingPass || existingPass === lowerPass) {
      // Если игрок ввел верный пароль от уже существующего в базе персонажа — сразу входим в него
      return { success: true, data: unpackPlayerRow(existingChar) };
    }
    return {
      success: false,
      error: `Персонаж «${cleanName}» уже есть в базе данных! Переключитесь на вкладку «Вход».`
    };
  }

  const adminFlag = isAdmin !== undefined ? isAdmin : 0;
  const initialGold = gold !== undefined ? gold : 0;
  const initialCrystals = crystals !== undefined ? crystals : 0;
  const finalEmail = email.trim() || `${lowerName}@pyramida.game`;

  const initialStateJson = {
    real_email: finalEmail,
    lvl: 1,
    exp: 0,
    hp: 250,
    max_hp: 250,
    energy: 100,
    max_energy: 100,
    str: 1,
    agi: 1,
    vit: 1,
    gear_v2_migrated: true,
    exp_table_v3_migrated: true,
    hp_potions: 3,
    en_potions: 3,
    equipped: {},
    inventory: [],
    location: 'city',
    pyramid_tier: 1,
    пирамидальный_уровень: 1,
    row: 9,
    ряд: 9,
    col: 4,
    ц: 4,
    клетка: '9,4',
    avatar: '🧙‍♂️',
    is_online: true,
    last_seen: Date.now()
  };

  const payload = {
    name: cleanName,
    email: JSON.stringify(initialStateJson),
    password: cleanPass,
    gold: initialGold,
    crystals: initialCrystals,
    is_admin: adminFlag
  };

  // 2. Записываем нового персонажа в таблицу players через Supabase Client (без .select())
  if (client) {
    try {
      const { error } = await client
        .from('players')
        .insert([payload]);

      if (!error) {
        const unpacked = unpackPlayerRow(payload);
        return { success: true, data: unpacked };
      }
      console.warn('[Supabase] Insert without select notice, trying direct REST insert:', error.message);
    } catch (err) {
      console.warn('[Supabase] Client insert exception, trying direct REST insert:', err);
    }
  }

  // 3. Резервная прямая отправка через REST API Supabase (для мобильных WebView / Telegram)
  try {
    const response = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/players`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        apikey: DEFAULT_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok || response.status === 201) {
      const unpacked = unpackPlayerRow(payload);
      return { success: true, data: unpacked };
    } else {
      const errText = await response.text();
      console.error('[Supabase REST] Ошибка записи:', errText);
      return { success: false, error: errText || `HTTP ${response.status}` };
    }
  } catch (err) {
    console.error('[Supabase REST] Исключение при записи:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Updates player progress and realtime coordinates directly in the Supabase 'players' table.
 * Preserves existing level, exp, gold, crystals, and inventory so progress is NEVER reset.
 */
export async function updatePlayerInDatabase(
  playerName: string,
  updates: {
    gold?: number;
    crystals?: number;
    is_admin?: number;
    password?: string;
    email?: string;
    lvl?: number;
    exp?: number;
    hp?: number;
    max_hp?: number;
    energy?: number;
    max_energy?: number;
    hp_potions?: number;
    en_potions?: number;
    exp_potions?: number;
    exp_elixir_until?: number;
    str?: number;
    agi?: number;
    vit?: number;
    stat_points?: number;
    bonus_dmg?: number;
    bonus_hp?: number;
    bag_capacity?: number;
    sell_experience?: number;
    mobs_killed?: number;
    mob_kills?: number;
    pvp_kills?: number;
    pvp_wins?: number;
    pvp_losses?: number;
    deaths?: number;
    last_wheel_spin_time?: number;
    last_gold_wheel_spin_time?: number;
    daily_gold_wheel_spins?: number;
    daily_crystal_wheel_spins?: number;
    daily_wheel_spins_date?: string;
    daily_crystal_to_gold_count?: number;
    daily_crystal_to_gold_date?: string;
    daily_gold_to_crystal_count?: number;
    daily_gold_to_crystal_date?: string;
    daily_login_day?: number;
    daily_login_last_date?: string;
    total_gold_collected?: number;
    claimed_mail_gift_ids?: string[];
    trade_protocol?: TradeProtocolEntry[];
    friends?: any[];
    equipped?: any;
    inventory?: any;
    location?: string;
    pyramid_tier?: number;
    пирамидальный_уровень?: number;
    row?: number;
    ряд?: number;
    col?: number;
    ц?: number;
    avatar?: string;
    is_online?: boolean;
    last_seen?: number;
    is_premium?: boolean;
    premium_until?: number;
    was_killed_in_pvp?: boolean;
    killed_by?: string | null;
    external_sync_ts?: number;
    is_admin_action?: boolean;
    gear_v2_migrated?: boolean;
    owned_skin_ids?: string[];
    active_skin_id?: string | null;
    ban_info?: any;
    [key: string]: any;
  }
): Promise<boolean> {
  if (!playerName) return false;
  const cleanName = playerName.trim();
  const lowerName = cleanName.toLowerCase();

  // Optimistically update local cache immediately for instant coordinate reads
  const immediateCached = playerStateCache.get(lowerName);
  const isBalanceWrite =
    updates.gold !== undefined ||
    updates.crystals !== undefined ||
    updates.lvl !== undefined ||
    updates.exp !== undefined ||
    updates.stat_points !== undefined ||
    updates.str !== undefined ||
    updates.agi !== undefined ||
    updates.vit !== undefined ||
    updates.is_premium !== undefined ||
    updates.premium_until !== undefined ||
    updates.hp_potions !== undefined ||
    updates.en_potions !== undefined ||
    updates.exp_potions !== undefined ||
    updates.exp_elixir_until !== undefined ||
    updates.daily_login_day !== undefined ||
    updates.daily_login_last_date !== undefined ||
    updates.mobs_killed !== undefined ||
    updates.total_gold_collected !== undefined ||
    updates.inventory !== undefined ||
    updates.equipped !== undefined ||
    updates.bag_capacity !== undefined ||
    updates.sell_experience !== undefined ||
    updates.external_sync_ts !== undefined ||
    updates.is_admin_action === true;

  if (immediateCached) {
    const isAdminOrRecentImmediate = Boolean(
      updates.is_admin_action ||
      (immediateCached._adminActionTimestamp && Date.now() - immediateCached._adminActionTimestamp < 60000)
    );
    const candidateLvlImmediate = updates.lvl !== undefined ? Number(updates.lvl) : Number(immediateCached.lvl ?? 1);
    const nextLvlImmediate = isAdminOrRecentImmediate
      ? Math.max(1, Math.min(MAX_LEVEL, candidateLvlImmediate))
      : Math.max(Number(immediateCached.lvl ?? 1), candidateLvlImmediate);
    let nextExpImmediate = Number(immediateCached.exp ?? 0);
    if (updates.exp !== undefined) {
      if (isAdminOrRecentImmediate) {
        nextExpImmediate = Math.max(0, Number(updates.exp));
      } else if (nextLvlImmediate > Number(immediateCached.lvl ?? 1)) {
        nextExpImmediate = Math.max(0, Number(updates.exp));
      } else {
        nextExpImmediate = Math.max(Number(immediateCached.exp ?? 0), Number(updates.exp));
      }
    }
    const nextTier = getPyramidTierForLevel(nextLvlImmediate);
    const nextRow = updates.row ?? updates['ряд'] ?? immediateCached.row ?? 9;
    const nextCol = updates.col ?? updates['ц'] ?? immediateCached.col ?? 4;
    const nextLoc = updates.location ?? immediateCached.location ?? 'city';
    const nextLastSeen =
      updates.last_seen !== undefined && Number(updates.last_seen) > 0
        ? Number(updates.last_seen)
        : updates.is_online !== undefined
        ? Date.now()
        : Number(immediateCached.last_seen || Date.now());
    const nextOnline =
      updates.is_online !== undefined
        ? Boolean(updates.is_online) && isPlayerOnlineByHeartbeat(updates.is_online, nextLastSeen)
        : isPlayerOnlineByHeartbeat(immediateCached.is_online, nextLastSeen);
    const nextHp = updates.hp !== undefined ? Number(updates.hp) : Number(immediateCached.hp ?? 100);
    const nextMaxHp = updates.max_hp !== undefined ? Number(updates.max_hp) : Number(immediateCached.max_hp ?? 250);
    const nextEnergy = updates.energy !== undefined ? Number(updates.energy) : Number(immediateCached.energy ?? 100);
    const nextMaxEnergy = updates.max_energy !== undefined ? Number(updates.max_energy) : Number(immediateCached.max_energy ?? 100);
    const nextWasKilled =
      updates.was_killed_in_pvp !== undefined
        ? Boolean(updates.was_killed_in_pvp)
        : Boolean(immediateCached.was_killed_in_pvp ?? false);
    const nextKilledBy =
      updates.killed_by !== undefined
        ? (updates.killed_by || undefined)
        : immediateCached.killed_by;

    const nextGoldImmediate = updates.gold !== undefined ? Number(updates.gold) : immediateCached.gold;
    const nextCrystalsImmediate = updates.crystals !== undefined ? Number(updates.crystals) : immediateCached.crystals;
    const nextHpPotionsImmediate = updates.hp_potions !== undefined ? Number(updates.hp_potions) : immediateCached.hp_potions;
    const nextEnPotionsImmediate = updates.en_potions !== undefined ? Number(updates.en_potions) : immediateCached.en_potions;
    const nextExpPotionsImmediate = updates.exp_potions !== undefined ? Number(updates.exp_potions) : immediateCached.exp_potions;
    const nextExpElixirUntilImmediate = updates.exp_elixir_until !== undefined ? Number(updates.exp_elixir_until) : immediateCached.exp_elixir_until;
    const nextInventoryImmediate = updates.inventory !== undefined ? updates.inventory : immediateCached.inventory;
    const nextEquippedImmediate = updates.equipped !== undefined ? updates.equipped : immediateCached.equipped;
    const nextStrImmediate = updates.str !== undefined ? Number(updates.str) : immediateCached.str;
    const nextAgiImmediate = updates.agi !== undefined ? Number(updates.agi) : immediateCached.agi;
    const nextVitImmediate = updates.vit !== undefined ? Number(updates.vit) : immediateCached.vit;
    const nextStatPointsImmediate = updates.stat_points !== undefined ? Number(updates.stat_points) : immediateCached.stat_points;
    const nextDailyLoginDayImmediate = updates.daily_login_day !== undefined ? Number(updates.daily_login_day) : immediateCached.daily_login_day;
    const nextDailyLoginLastDateImmediate = updates.daily_login_last_date !== undefined ? String(updates.daily_login_last_date) : immediateCached.daily_login_last_date;
    const nextMobsKilledImmediate = updates.mobs_killed !== undefined ? Number(updates.mobs_killed) : immediateCached.mobs_killed;
    const nextTotalGoldImmediate = updates.total_gold_collected !== undefined ? Number(updates.total_gold_collected) : immediateCached.total_gold_collected;
    const nextBagCapacityImmediate = updates.bag_capacity !== undefined ? Number(updates.bag_capacity) : immediateCached.bag_capacity;
    const nextSellExpImmediate = updates.sell_experience !== undefined ? Number(updates.sell_experience) : immediateCached.sell_experience;

    const nextOwnedSkinIdsImmediate =
      (updates as any).owned_skin_ids !== undefined
        ? (updates as any).owned_skin_ids
        : (updates as any).ownedSkinIds !== undefined
        ? (updates as any).ownedSkinIds
        : immediateCached.owned_skin_ids ?? immediateCached.ownedSkinIds ?? [];
    const nextOwnedSkinExpirationsImmediate =
      (updates as any).owned_skin_expirations !== undefined
        ? (updates as any).owned_skin_expirations
        : (updates as any).ownedSkinExpirations !== undefined
        ? (updates as any).ownedSkinExpirations
        : immediateCached.owned_skin_expirations ?? immediateCached.ownedSkinExpirations ?? {};
    const nextOwnedSkinsImmediate =
      (updates as any).owned_skins !== undefined
        ? (updates as any).owned_skins
        : (updates as any).ownedSkins !== undefined
        ? (updates as any).ownedSkins
        : immediateCached.owned_skins ?? immediateCached.ownedSkins ?? [];
    const nextActiveSkinIdImmediate =
      (updates as any).active_skin_id !== undefined
        ? (updates as any).active_skin_id
        : (updates as any).activeSkinId !== undefined
        ? (updates as any).activeSkinId
        : immediateCached.active_skin_id ?? immediateCached.activeSkinId ?? null;
    const nextAvatarImmediate =
      updates.avatar !== undefined ? updates.avatar : immediateCached.avatar;

    playerStateCache.set(lowerName, {
      ...immediateCached,
      gold: nextGoldImmediate,
      crystals: nextCrystalsImmediate,
      lvl: nextLvlImmediate,
      level: nextLvlImmediate,
      exp: nextExpImmediate,
      stat_points: nextStatPointsImmediate,
      str: nextStrImmediate,
      agi: nextAgiImmediate,
      vit: nextVitImmediate,
      is_premium: updates.is_premium !== undefined ? Boolean(updates.is_premium) : immediateCached.is_premium,
      premium_until: updates.premium_until !== undefined ? Number(updates.premium_until) : immediateCached.premium_until,
      hp_potions: nextHpPotionsImmediate,
      en_potions: nextEnPotionsImmediate,
      exp_potions: nextExpPotionsImmediate,
      exp_elixir_until: nextExpElixirUntilImmediate,
      daily_login_day: nextDailyLoginDayImmediate,
      daily_login_last_date: nextDailyLoginLastDateImmediate,
      mobs_killed: nextMobsKilledImmediate,
      mob_kills: nextMobsKilledImmediate,
      total_gold_collected: nextTotalGoldImmediate,
      bag_capacity: nextBagCapacityImmediate,
      sell_experience: nextSellExpImmediate,
      external_sync_ts: updates.external_sync_ts !== undefined ? Number(updates.external_sync_ts) : immediateCached.external_sync_ts,
      hp: nextHp,
      max_hp: nextMaxHp,
      energy: nextEnergy,
      max_energy: nextMaxEnergy,
      inventory: nextInventoryImmediate,
      equipped: nextEquippedImmediate,
      location: nextLoc,
      pyramid_tier: nextTier,
      пирамидальный_уровень: nextTier,
      pyramidTier: nextTier,
      row: nextRow,
      ряд: nextRow,
      col: nextCol,
      ц: nextCol,
      avatar: nextAvatarImmediate,
      owned_skin_ids: nextOwnedSkinIdsImmediate,
      ownedSkinIds: nextOwnedSkinIdsImmediate,
      owned_skin_expirations: nextOwnedSkinExpirationsImmediate,
      ownedSkinExpirations: nextOwnedSkinExpirationsImmediate,
      owned_skins: nextOwnedSkinsImmediate,
      ownedSkins: nextOwnedSkinsImmediate,
      active_skin_id: nextActiveSkinIdImmediate,
      activeSkinId: nextActiveSkinIdImmediate,
      is_online: nextOnline,
      isOnline: nextOnline,
      last_seen: nextLastSeen,
      was_killed_in_pvp: nextWasKilled,
      killed_by: nextKilledBy,
      _rawEmailJson: {
        ...(immediateCached._rawEmailJson || {}),
        gold: nextGoldImmediate,
        crystals: nextCrystalsImmediate,
        lvl: nextLvlImmediate,
        level: nextLvlImmediate,
        exp: nextExpImmediate,
        str: nextStrImmediate,
        agi: nextAgiImmediate,
        vit: nextVitImmediate,
        stat_points: nextStatPointsImmediate,
        hp: nextHp,
        max_hp: nextMaxHp,
        energy: nextEnergy,
        max_energy: nextMaxEnergy,
        hp_potions: nextHpPotionsImmediate,
        en_potions: nextEnPotionsImmediate,
        exp_potions: nextExpPotionsImmediate,
        exp_elixir_until: nextExpElixirUntilImmediate,
        daily_login_day: nextDailyLoginDayImmediate,
        daily_login_last_date: nextDailyLoginLastDateImmediate,
        mobs_killed: nextMobsKilledImmediate,
        mob_kills: nextMobsKilledImmediate,
        total_gold_collected: nextTotalGoldImmediate,
        bag_capacity: nextBagCapacityImmediate,
        sell_experience: nextSellExpImmediate,
        inventory: nextInventoryImmediate,
        equipped: nextEquippedImmediate,
        location: nextLoc,
        row: nextRow,
        ряд: nextRow,
        col: nextCol,
        ц: nextCol,
        avatar: nextAvatarImmediate,
        owned_skin_ids: nextOwnedSkinIdsImmediate,
        owned_skin_expirations: nextOwnedSkinExpirationsImmediate,
        owned_skins: nextOwnedSkinsImmediate,
        active_skin_id: nextActiveSkinIdImmediate,
        is_online: nextOnline,
        last_seen: nextLastSeen
      },
      _localUpdatedAt: Date.now(),
      _localBalanceUpdatedAt: isBalanceWrite ? Date.now() : immediateCached._localBalanceUpdatedAt,
      _adminActionTimestamp: updates.is_admin_action ? Date.now() : immediateCached._adminActionTimestamp
    });
  }

  const prevTask = playerUpdateQueues.get(lowerName) || Promise.resolve(true);

  const nextTask = prevTask
    .catch(() => false)
    .then(async () => {
      try {
        let cached = playerStateCache.get(lowerName);
        if (!cached || !cached._rawEmailJson || updates.is_admin_action) {
          const existing = await findPlayerInSupabase(cleanName);
          if (existing) {
            const freshUnpacked = unpackPlayerRow(existing);
            cached = {
              ...freshUnpacked,
              _adminActionTimestamp: updates.is_admin_action
                ? Date.now()
                : cached?._adminActionTimestamp
            };
          }
        }

        // If player doesn't exist in DB yet, do not overwrite with empty defaults
        if (!cached) {
          return false;
        }

        const existingJson = cached._rawEmailJson || {};
        const isAdminOrRecentAdmin = Boolean(
          updates.is_admin_action ||
          (cached._adminActionTimestamp && Date.now() - cached._adminActionTimestamp < 60000)
        );
        const realEmail =
          updates.email && !updates.email.trim().startsWith('{')
            ? updates.email.trim()
            : (cached.real_email || existingJson.real_email || `${lowerName}@pyramida.game`);

        // Preserve a valid timestamp in last_seen even when going offline so offline HP/Energy regeneration works accurately!
        const lastSeenNext =
          updates.last_seen !== undefined && Number(updates.last_seen) > 0
            ? Number(updates.last_seen)
            : updates.is_online !== undefined
            ? Date.now()
            : Number(cached.last_seen ?? existingJson.last_seen ?? Date.now());

        const isOnlineNext =
          updates.is_online !== undefined
            ? Boolean(updates.is_online) && isPlayerOnlineByHeartbeat(updates.is_online, lastSeenNext)
            : isPlayerOnlineByHeartbeat(cached.is_online ?? existingJson.is_online, lastSeenNext);

        // Strict anti-reset guarantee for normal syncs, while allowing explicit Admin level/exp changes (both UP and DOWN)
        const currentDbLvl = Math.max(1, Number(cached.lvl ?? existingJson.lvl ?? 1));
        const currentDbExp = Math.max(0, Number(cached.exp ?? existingJson.exp ?? 0));
        let nextLvl = currentDbLvl;
        if (updates.lvl !== undefined) {
          if (updates.is_admin_action) {
            nextLvl = Math.max(1, Math.min(MAX_LEVEL, Number(updates.lvl)));
          } else {
            nextLvl = Math.max(currentDbLvl, Math.min(MAX_LEVEL, Number(updates.lvl)));
          }
        }

        let nextExp = currentDbExp;
        if (updates.exp !== undefined) {
          if (updates.is_admin_action) {
            nextExp = Math.max(0, Number(updates.exp));
          } else if (nextLvl > currentDbLvl) {
            nextExp = Math.max(0, Number(updates.exp));
          } else {
            nextExp = Math.max(currentDbExp, Number(updates.exp));
          }
        }

        while (nextLvl < MAX_LEVEL && nextExp >= (EXP_TABLE[nextLvl] || 9999999)) {
          nextExp -= EXP_TABLE[nextLvl] || 9999999;
          nextLvl += 1;
        }

        const normMergedStats = normalizeStatsForLevel(
          nextLvl,
          Number(updates.str ?? cached.str ?? existingJson.str ?? 1),
          Number(updates.agi ?? cached.agi ?? existingJson.agi ?? 1),
          Number(updates.vit ?? cached.vit ?? existingJson.vit ?? 1),
          Number(updates.stat_points ?? cached.stat_points ?? existingJson.stat_points ?? 0)
        );

        // Strictly bind Pyramid Tier to the player's actual level (1-5 -> 1, 6-10 -> 2, 11-20 -> 3)
        const nextTier = getPyramidTierForLevel(nextLvl);
        const nextRow = Number(
          updates.row ??
          updates['ряд'] ??
          cached.row ??
          existingJson.row ??
          9
        );
        const nextCol = Number(
          updates.col ??
          updates['ц'] ??
          cached.col ??
          existingJson.col ??
          4
        );
        const nextLocation = updates.location ?? cached.location ?? existingJson.location ?? 'city';

        const nextWasKilled =
          updates.was_killed_in_pvp !== undefined
            ? Boolean(updates.was_killed_in_pvp)
            : Boolean(cached.was_killed_in_pvp ?? existingJson.was_killed_in_pvp ?? false);
        const nextKilledBy =
          updates.killed_by !== undefined
            ? (updates.killed_by || undefined)
            : (cached.killed_by ?? existingJson.killed_by ?? undefined);

        const existingGold = Math.max(0, Number(cached.gold ?? existingJson.gold ?? 0));
        const existingCrystals = Math.max(0, Number(cached.crystals ?? existingJson.crystals ?? 0));
        let currentDbGold = updates.gold !== undefined ? Math.max(0, Number(updates.gold)) : existingGold;
        let currentDbCrystals = updates.crystals !== undefined ? Math.max(0, Number(updates.crystals)) : existingCrystals;
        const currentIsAdmin =
          updates.is_admin !== undefined
            ? Number(updates.is_admin)
            : Number(cached.is_admin ?? existingJson.is_admin ?? 0);

        const mergedState = {
          ...existingJson,
          real_email: realEmail,
          gold: Math.floor(currentDbGold),
          crystals: Math.floor(currentDbCrystals),
          is_admin: currentIsAdmin,
          lvl: nextLvl,
          level: nextLvl,
          exp: Math.floor(nextExp),
          hp: updates.hp ?? cached.hp ?? existingJson.hp ?? 250,
          max_hp: updates.max_hp ?? cached.max_hp ?? existingJson.max_hp ?? 250,
          energy: updates.energy ?? cached.energy ?? existingJson.energy ?? 100,
          max_energy: updates.max_energy ?? cached.max_energy ?? existingJson.max_energy ?? 100,
          hp_potions: updates.hp_potions ?? cached.hp_potions ?? existingJson.hp_potions ?? 3,
          en_potions: updates.en_potions ?? cached.en_potions ?? existingJson.en_potions ?? 3,
          exp_potions: updates.exp_potions ?? cached.exp_potions ?? existingJson.exp_potions ?? 0,
          exp_elixir_until: updates.exp_elixir_until ?? cached.exp_elixir_until ?? existingJson.exp_elixir_until ?? 0,
          str: normMergedStats.str,
          agi: normMergedStats.agi,
          vit: normMergedStats.vit,
          gear_v2_migrated: true,
          exp_table_v3_migrated: true,
          stat_points: normMergedStats.statPoints,
          bonus_dmg: updates.bonus_dmg ?? cached.bonus_dmg ?? existingJson.bonus_dmg ?? 0,
          bonus_hp: updates.bonus_hp ?? cached.bonus_hp ?? existingJson.bonus_hp ?? 0,
          bag_capacity: Math.max(20, Number(updates.bag_capacity ?? cached.bag_capacity ?? existingJson.bag_capacity ?? 100)),
          sell_experience: Math.max(0, Number(updates.sell_experience ?? cached.sell_experience ?? existingJson.sell_experience ?? 0)),
          mobs_killed:
            updates.mobs_killed !== undefined
              ? Math.max(0, Number(updates.mobs_killed))
              : Math.max(0, Number(cached.mobs_killed ?? existingJson.mobs_killed ?? 0)),
          mob_kills:
            updates.mob_kills !== undefined
              ? Math.max(0, Number(updates.mob_kills))
              : Math.max(0, Number(cached.mob_kills ?? existingJson.mob_kills ?? cached.mobs_killed ?? existingJson.mobs_killed ?? 0)),
          pvp_kills: updates.pvp_kills ?? cached.pvp_kills ?? existingJson.pvp_kills ?? 0,
          deaths: updates.deaths ?? cached.deaths ?? existingJson.deaths ?? 0,
          last_wheel_spin_time:
            updates.last_wheel_spin_time ??
            cached.last_wheel_spin_time ??
            existingJson.last_wheel_spin_time ??
            0,
          last_gold_wheel_spin_time:
            updates.last_gold_wheel_spin_time ??
            cached.last_gold_wheel_spin_time ??
            existingJson.last_gold_wheel_spin_time ??
            0,
          daily_gold_wheel_spins:
            updates.daily_gold_wheel_spins ??
            cached.daily_gold_wheel_spins ??
            existingJson.daily_gold_wheel_spins ??
            0,
          daily_crystal_wheel_spins:
            updates.daily_crystal_wheel_spins ??
            cached.daily_crystal_wheel_spins ??
            existingJson.daily_crystal_wheel_spins ??
            0,
          daily_wheel_spins_date:
            updates.daily_wheel_spins_date ??
            cached.daily_wheel_spins_date ??
            existingJson.daily_wheel_spins_date ??
            '',
          daily_crystal_to_gold_count:
            updates.daily_crystal_to_gold_count ??
            cached.daily_crystal_to_gold_count ??
            existingJson.daily_crystal_to_gold_count ??
            0,
          daily_crystal_to_gold_date:
            updates.daily_crystal_to_gold_date ??
            cached.daily_crystal_to_gold_date ??
            existingJson.daily_crystal_to_gold_date ??
            '',
          daily_gold_to_crystal_count:
            updates.daily_gold_to_crystal_count ??
            cached.daily_gold_to_crystal_count ??
            existingJson.daily_gold_to_crystal_count ??
            0,
          daily_gold_to_crystal_date:
            updates.daily_gold_to_crystal_date ??
            cached.daily_gold_to_crystal_date ??
            existingJson.daily_gold_to_crystal_date ??
            '',
          daily_login_day:
            updates.daily_login_day !== undefined
              ? Number(updates.daily_login_day)
              : (cached.daily_login_day ?? existingJson.daily_login_day ?? 0),
          daily_login_last_date:
            updates.daily_login_last_date !== undefined
              ? String(updates.daily_login_last_date)
              : (cached.daily_login_last_date ?? existingJson.daily_login_last_date ?? ''),
          total_gold_collected: Math.max(
            Math.floor(currentDbGold),
            updates.total_gold_collected !== undefined
              ? Math.max(0, Number(updates.total_gold_collected))
              : Math.max(0, Number(cached.total_gold_collected ?? existingJson.total_gold_collected ?? 0))
          ),
          claimed_mail_gift_ids: Array.isArray(updates.claimed_mail_gift_ids)
            ? Array.from(new Set([
                ...(Array.isArray(cached.claimed_mail_gift_ids) ? cached.claimed_mail_gift_ids : []),
                ...(Array.isArray(existingJson.claimed_mail_gift_ids) ? existingJson.claimed_mail_gift_ids : []),
                ...updates.claimed_mail_gift_ids
              ])).slice(-200)
            : (cached.claimed_mail_gift_ids ?? existingJson.claimed_mail_gift_ids ?? []),
          trade_protocol: Array.isArray(updates.trade_protocol)
            ? updates.trade_protocol.slice(0, 40)
            : (cached.trade_protocol ?? existingJson.trade_protocol ?? []),
          friends: Array.isArray(updates.friends)
            ? updates.friends
            : (cached.friends ?? existingJson.friends ?? []),
          equipped:
            updates.equipped !== undefined
              ? updates.equipped
              : (cached.equipped ?? existingJson.equipped ?? {}),
          inventory:
            Array.isArray(updates.inventory)
              ? updates.inventory
              : (Array.isArray(cached.inventory) ? cached.inventory : (Array.isArray(existingJson.inventory) ? existingJson.inventory : [])),
          location: nextLocation,
          pyramid_tier: nextTier,
          пирамидальный_уровень: nextTier,
          row: nextRow,
          ряд: nextRow,
          col: nextCol,
          ц: nextCol,
          клетка: `${nextRow},${nextCol}`,
          avatar: updates.avatar ?? cached.avatar ?? existingJson.avatar ?? (currentIsAdmin === 1 ? '👑' : '🧙‍♂️'),
          is_online: isOnlineNext,
          last_seen: lastSeenNext,
          is_premium:
            updates.is_premium !== undefined
              ? Boolean(updates.is_premium)
              : Boolean(cached.is_premium ?? existingJson.is_premium ?? false),
          premium_until:
            updates.premium_until !== undefined
              ? Number(updates.premium_until)
              : Number(cached.premium_until ?? existingJson.premium_until ?? 0),
          was_killed_in_pvp: nextWasKilled,
          killed_by: nextKilledBy,
          external_sync_ts:
            updates.external_sync_ts !== undefined
              ? Number(updates.external_sync_ts)
              : Number(cached.external_sync_ts ?? existingJson.external_sync_ts ?? 0),
          clan_id: (updates as any).clan_id ?? (updates as any).clanId ?? (cached as any).clan_id ?? (cached as any).clanId ?? (existingJson as any).clan_id ?? (existingJson as any).clanId,
          clan_tag: (updates as any).clan_tag ?? (updates as any).clanTag ?? (cached as any).clan_tag ?? (cached as any).clanTag ?? (existingJson as any).clan_tag ?? (existingJson as any).clanTag,
          clan_name: (updates as any).clan_name ?? (updates as any).clanName ?? (cached as any).clan_name ?? (cached as any).clanName ?? (existingJson as any).clan_name ?? (existingJson as any).clanName,
          clan_emblem: (updates as any).clan_emblem ?? (updates as any).clanEmblem ?? (cached as any).clan_emblem ?? (cached as any).clanEmblem ?? (existingJson as any).clan_emblem ?? (existingJson as any).clanEmblem,
          clan_role: (updates as any).clan_role ?? (updates as any).clanRole ?? (cached as any).clan_role ?? (cached as any).clanRole ?? (existingJson as any).clan_role ?? (existingJson as any).clanRole,
          owned_skin_ids:
            (updates as any).owned_skin_ids !== undefined
              ? (updates as any).owned_skin_ids
              : (updates as any).ownedSkinIds !== undefined
              ? (updates as any).ownedSkinIds
              : (cached as any).owned_skin_ids ?? (cached as any).ownedSkinIds ?? (existingJson as any).owned_skin_ids ?? (existingJson as any).ownedSkinIds ?? [],
          owned_skin_expirations:
            (updates as any).owned_skin_expirations !== undefined
              ? (updates as any).owned_skin_expirations
              : (updates as any).ownedSkinExpirations !== undefined
              ? (updates as any).ownedSkinExpirations
              : (cached as any).owned_skin_expirations ?? (cached as any).ownedSkinExpirations ?? (existingJson as any).owned_skin_expirations ?? (existingJson as any).ownedSkinExpirations ?? {},
          owned_skins:
            (updates as any).owned_skins !== undefined
              ? (updates as any).owned_skins
              : (updates as any).ownedSkins !== undefined
              ? (updates as any).ownedSkins
              : (cached as any).owned_skins ?? (cached as any).ownedSkins ?? (existingJson as any).owned_skins ?? (existingJson as any).ownedSkins ?? [],
          active_skin_id:
            (updates as any).active_skin_id !== undefined
              ? (updates as any).active_skin_id
              : (updates as any).activeSkinId !== undefined
              ? (updates as any).activeSkinId
              : (cached as any).active_skin_id ?? (cached as any).activeSkinId ?? (existingJson as any).active_skin_id ?? (existingJson as any).activeSkinId ?? null,
          ban_info:
            (updates as any).ban_info !== undefined
              ? (updates as any).ban_info
              : (updates as any).banInfo !== undefined
              ? (updates as any).banInfo
              : (cached as any).ban_info ?? (cached as any).banInfo ?? (existingJson as any).ban_info ?? (existingJson as any).banInfo ?? null
        };

        playerStateCache.set(lowerName, {
          ...cached,
          ...mergedState,
          name: cached.name || cleanName,
          nick: cached.nick || cleanName,
          gold: Math.floor(currentDbGold),
          crystals: Math.floor(currentDbCrystals),
          is_admin: currentIsAdmin,
          _rawEmailJson: mergedState,
          _localUpdatedAt: Date.now(),
          _localBalanceUpdatedAt: isBalanceWrite ? Date.now() : cached._localBalanceUpdatedAt,
          _adminActionTimestamp: updates.is_admin_action ? Date.now() : cached._adminActionTimestamp
        });

        // IMPORTANT: Only include columns that actually exist on public.players (email, gold, crystals, is_admin, password)
        // All extended hero state (lvl, exp, bag_capacity, is_premium, premium_until, etc.) is stored inside email JSON!
        const dbPayload: Record<string, any> = {
          email: JSON.stringify(mergedState),
          gold: Math.floor(currentDbGold),
          crystals: Math.floor(currentDbCrystals)
        };
        if (updates.is_admin !== undefined) dbPayload.is_admin = Number(updates.is_admin);
        if (updates.password !== undefined) dbPayload.password = String(updates.password);

        // For regular player profiles, update by case-insensitive nickname so if duplicate rows exist in public.players,
        // all rows for this player stay in sync and an older row can never shadow the player's latest progress.
        const filterQuery =
          !cleanName.startsWith('__')
            ? `name=ilike.${encodeURIComponent(cleanName)}`
            : cached.id !== undefined
            ? `id=eq.${encodeURIComponent(String(cached.id))}`
            : `name=ilike.${encodeURIComponent(cleanName)}`;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const response = await fetch(
              `${DEFAULT_SUPABASE_URL}/rest/v1/players?${filterQuery}`,
              {
                method: 'PATCH',
                keepalive: true,
                cache: 'no-store',
                headers: {
                  apikey: DEFAULT_SUPABASE_ANON_KEY,
                  Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
                  'Content-Type': 'application/json',
                  Prefer: 'return=minimal'
                },
                body: JSON.stringify(dbPayload)
              }
            );

            if (response.ok) {
              return true;
            }
            const errText = await response.text();
            console.warn(`[Supabase] Ошибка обновления игрока (попытка ${attempt}/3):`, errText);
          } catch (netErr) {
            console.warn(`[Supabase] Сетевая ошибка при сохранении (попытка ${attempt}/3):`, netErr);
          }
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 300 * attempt));
          }
        }

        return false;
      } catch (err) {
        console.warn('[Supabase] Исключение в updatePlayerInDatabase:', err);
        return false;
      }
    });

  playerUpdateQueues.set(lowerName, nextTask);
  return nextTask;
}

/**
 * Deletes all records from the Supabase 'players' table
 */
export async function deleteAllPlayersFromDatabase(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    await client.from('players').delete().not('id', 'is', null);
    return true;
  } catch (err) {
    console.warn('[Supabase] Ошибка очистки таблицы players:', err);
    return false;
  }
}

export async function registerPlayerInSupabase(
  playerName: string,
  email: string = '',
  password: string = '',
  gold?: number,
  crystals?: number,
  isAdmin?: number
): Promise<boolean> {
  const res = await savePlayerToDatabase(playerName, email, password, gold, crystals, isAdmin);
  return res.success;
}

/**
 * Syncs player position, pyramid tier, location, and online status to Supabase
 * and dispatches local update event for instant UI feedback without touching existing progress.
 */
export async function syncPlayerToSupabase(player: Partial<RealtimePlayer> & { nick: string }): Promise<boolean> {
  try {
    if (!player.nick) return false;
    const isOnlineNext = player.isOnline !== undefined ? Boolean(player.isOnline) : true;
    const updatePayload: any = {
      location: player.location,
      pyramid_tier: player.pyramidTier,
      пирамидальный_уровень: player.pyramidTier,
      row: player.row,
      ряд: player.row,
      col: player.col,
      ц: player.col,
      hp: player.hp,
      max_hp: player.maxHp,
      lvl: player.lvl,
      avatar: player.avatar,
      is_premium: player.isPremium,
      premium_until: player.premiumUntil,
      is_online: isOnlineNext,
      last_seen: Date.now()
    };
    if (player.gold !== undefined) updatePayload.gold = player.gold;
    if (player.crystals !== undefined) updatePayload.crystals = player.crystals;
    if (player.exp !== undefined) updatePayload.exp = player.exp;
    if (player.clanId !== undefined) updatePayload.clanId = player.clanId;
    if (player.clanTag !== undefined) updatePayload.clanTag = player.clanTag;
    if (player.clanName !== undefined) updatePayload.clanName = player.clanName;
    if (player.clanEmblem !== undefined) updatePayload.clanEmblem = player.clanEmblem;
    if (player.clanRole !== undefined) updatePayload.clanRole = player.clanRole;

    await updatePlayerInDatabase(player.nick, updatePayload);

    if (typeof window !== 'undefined') {
      const cached = playerStateCache.get(player.nick.trim().toLowerCase());
      window.dispatchEvent(
        new CustomEvent('supabase:player_update', {
          detail: {
            new: {
              ...(cached || {}),
              email: cached?._rawEmailJson ? JSON.stringify(cached._rawEmailJson) : undefined,
              name: player.nick,
              nick: player.nick,
              lvl: player.lvl ?? cached?.lvl ?? 1,
              hp: player.hp ?? cached?.hp ?? 100,
              max_hp: player.maxHp ?? cached?.max_hp ?? 100,
              avatar: player.avatar ?? cached?.avatar ?? '🧙‍♂️',
              location: player.location ?? cached?.location ?? 'city',
              pyramid_tier: player.pyramidTier ?? cached?.pyramid_tier ?? 1,
              пирамидальный_уровень: player.pyramidTier ?? cached?.pyramid_tier ?? 1,
              row: player.row ?? cached?.row ?? 9,
              ряд: player.row ?? cached?.row ?? 9,
              col: player.col ?? cached?.col ?? 4,
              ц: player.col ?? cached?.col ?? 4,
              is_premium: player.isPremium ?? cached?.is_premium ?? false,
              premium_until: player.premiumUntil ?? cached?.premium_until ?? 0,
              is_online: isOnlineNext,
              last_seen: Date.now()
            }
          }
        })
      );
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Exception syncing player:', err);
    return false;
  }
}

const tierUpdateQueues = new Map<number, Promise<PyramidTierState>>();

/**
 * Fetches the shared pyramid tier state (seed + cells array of monsters, sacks, portals, empty cells)
 * from Supabase. If the tier does not yet exist in Supabase, initializes it deterministically and saves it.
 */
export async function fetchPyramidTierFromSupabase(tier: number): Promise<PyramidTierState> {
  const safeTier = Math.max(1, Number(tier) || 1);
  const sysName = `__TIER_${safeTier}__`;

  let loadedState: PyramidTierState | null = null;

  try {
    const res = await fetch(
      `${DEFAULT_SUPABASE_URL}/rest/v1/players?name=eq.${encodeURIComponent(sysName)}&select=*&order=id.desc&limit=1`,
      {
        method: 'GET',
        cache: 'no-store',
        headers: {
          apikey: DEFAULT_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache'
        }
      }
    );

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const unpacked = unpackSystemTierRow(rows[0]);
        if (unpacked && Array.isArray(unpacked.cells) && unpacked.cells.length > 0) {
          loadedState = unpacked;
        }
      }
    }
  } catch (err) {
    console.warn('[Supabase] Error fetching pyramid tier state:', err);
  }

  if (!loadedState) {
    const cached = tierStateCache.get(safeTier);
    if (cached && Array.isArray(cached.cells) && cached.cells.length > 0) {
      loadedState = cached;
    }
  }

  if (loadedState) {
    // Perform automatic offline catch-up so monsters and rare bosses spawn even when no players were online!
    const now = Date.now();
    const lastResp = loadedState.lastRespawn > 0 ? loadedState.lastRespawn : now;
    const occupiedCoords: { row: number; col: number }[] = [
      { row: PYRAMID_EXIT_POS.row, col: PYRAMID_EXIT_POS.col },
      { row: PYRAMID_SPAWN_POS.row, col: PYRAMID_SPAWN_POS.col }
    ];
    playerStateCache.forEach((p) => {
      if (
        p &&
        p.location === 'pyramid' &&
        Number(p.pyramid_tier ?? 1) === safeTier &&
        Number(p.hp ?? 100) > 0
      ) {
        occupiedCoords.push({ row: Number(p.row ?? 9), col: Number(p.col ?? 1) });
      }
    });

    let updatedCells = sanitizePyramidCellsForStorage(loadedState.cells);
    let updatedSeed = loadedState.seed;
    let updatedRespawn = lastResp;
    let didCatchUp = false;

    if (now - lastResp >= 60000) {
      updatedSeed = Math.floor(now / 60000) * 100 + safeTier;
      updatedCells = respawnDeterministicPyramidCells(
        updatedCells,
        safeTier,
        updatedSeed,
        occupiedCoords,
        10
      );
      updatedRespawn = now;
      didCatchUp = true;
    }

    const freeCells = getFreeEmptyPyramidCells(updatedCells, occupiedCoords, 10);
    const normalizedTimers = normalizeRareBossTimers(loadedState.rareBossTimers, updatedCells, now);
    const finalTimers = normalizedTimers.map((bTimer) => {
      if (bTimer.isAliveOnMap) return bTimer;
      if (bTimer.remainingMs <= 0) {
        if (freeCells.length > 0) {
          const chosen = freeCells.pop()!;
          const rareCell = createRareBossMobCell(safeTier, bTimer.id);
          updatedCells = updatedCells.map((rowArr, rI) =>
            rowArr.map((c, cI) => (rI === chosen.r && cI === chosen.c ? rareCell : c))
          );
          didCatchUp = true;
          return {
            ...bTimer,
            remainingMs: 0,
            targetSpawnAt: now,
            isFrozenWaitingForCell: false,
            isAliveOnMap: true,
            lastTickAt: now
          };
        }
        return {
          ...bTimer,
          remainingMs: 0,
          targetSpawnAt: now,
          isFrozenWaitingForCell: true,
          isAliveOnMap: false,
          lastTickAt: now
        };
      }
      return bTimer;
    });

    if (didCatchUp) {
      return savePyramidTierToSupabase(
        safeTier,
        updatedCells,
        updatedSeed,
        updatedRespawn,
        'offline_catchup',
        finalTimers
      );
    }

    return {
      ...loadedState,
      cells: updatedCells,
      rareBossTimers: finalTimers
    };
  }

  // Initialize deterministic tier map in Supabase so all connected players share the exact same seed & cells
  const initialSeed = getCanonicalTierSeed(safeTier);
  const initialCells = generateDeterministicPyramidCells(safeTier, initialSeed);
  return savePyramidTierToSupabase(
    safeTier,
    initialCells,
    initialSeed,
    Date.now(),
    'system',
    createDefaultRareBossTimers(Date.now())
  );
}

/**
 * Saves the shared pyramid tier state (seed + sanitized cells array) to Supabase
 * so all connected players see the exact same monsters, HP, sacks, portals, and empty cells in real time.
 */
export async function savePyramidTierToSupabase(
  tier: number,
  cells: PyramidCell[][],
  seed?: number,
  lastRespawn?: number,
  updatedBy?: string,
  rareBossTimers?: RareBossTimerState[]
): Promise<PyramidTierState> {
  const safeTier = Math.max(1, Number(tier) || 1);
  const existing = tierStateCache.get(safeTier);
  const nextSeed = Math.max(1, Number(seed ?? existing?.seed ?? getCanonicalTierSeed(safeTier)));
  const cleanCells = sanitizePyramidCellsForStorage(
    Array.isArray(cells) && cells.length > 0
      ? cells
      : generateDeterministicPyramidCells(safeTier, nextSeed)
  );
  const nextRespawn = Number(lastRespawn ?? existing?.lastRespawn ?? Date.now());
  const now = Date.now();
  const nextRareTimers = normalizeRareBossTimers(
    rareBossTimers ?? existing?.rareBossTimers,
    cleanCells,
    now
  );

  const stateToSave: PyramidTierState & { _id?: number; _localWriteAt?: number } = {
    tier: safeTier,
    seed: nextSeed,
    cells: cleanCells,
    lastRespawn: nextRespawn,
    rareBossTimers: nextRareTimers,
    updatedAt: now,
    updatedBy: updatedBy || existing?.updatedBy || 'player',
    _id: existing?._id,
    _localWriteAt: now
  };

  tierStateCache.set(safeTier, stateToSave);
  notifyTierListeners(stateToSave);

  const prevTask = tierUpdateQueues.get(safeTier) || Promise.resolve(stateToSave);
  const nextTask = prevTask
    .catch(() => stateToSave)
    .then(async () => {
      const sysName = `__TIER_${safeTier}__`;
      const emailPayload = JSON.stringify({
        is_system_tier: true,
        tier: safeTier,
        seed: nextSeed,
        cells: cleanCells,
        last_respawn: nextRespawn,
        rare_boss_timers: nextRareTimers,
        updated_at: now,
        updated_by: stateToSave.updatedBy,
        is_online: false,
        location: 'city'
      });

      try {
        // Check if row exists first if we don't have _id cached
        let rowId = tierStateCache.get(safeTier)?._id;
        if (rowId === undefined) {
          const checkRes = await fetch(
            `${DEFAULT_SUPABASE_URL}/rest/v1/players?name=eq.${encodeURIComponent(sysName)}&select=id&order=id.desc&limit=1`,
            {
              method: 'GET',
              cache: 'no-store',
              headers: {
                apikey: DEFAULT_SUPABASE_ANON_KEY,
                Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`
              }
            }
          );
          if (checkRes.ok) {
            const checkRows = await checkRes.json();
            if (Array.isArray(checkRows) && checkRows.length > 0 && checkRows[0].id !== undefined) {
              rowId = Number(checkRows[0].id);
              const cur = tierStateCache.get(safeTier);
              if (cur) cur._id = rowId;
            }
          }
        }

        if (rowId !== undefined) {
          await fetch(
            `${DEFAULT_SUPABASE_URL}/rest/v1/players?id=eq.${encodeURIComponent(String(rowId))}`,
            {
              method: 'PATCH',
              keepalive: true,
              cache: 'no-store',
              headers: {
                apikey: DEFAULT_SUPABASE_ANON_KEY,
                Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal'
              },
              body: JSON.stringify({
                email: emailPayload,
                gold: 0,
                crystals: 0,
                is_admin: 0
              })
            }
          );
        } else {
          const postRes = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/players`, {
            method: 'POST',
            keepalive: true,
            cache: 'no-store',
            headers: {
              apikey: DEFAULT_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation'
            },
            body: JSON.stringify({
              name: sysName,
              email: emailPayload,
              password: 'system_tier_lock',
              gold: 0,
              crystals: 0,
              is_admin: 0
            })
          });
          if (postRes.ok) {
            const created = await postRes.json();
            if (Array.isArray(created) && created.length > 0 && created[0].id !== undefined) {
              const cur = tierStateCache.get(safeTier);
              if (cur) cur._id = Number(created[0].id);
            }
          }
        }
      } catch (err) {
        console.warn('[Supabase] Error saving pyramid tier state:', err);
      }

      return stateToSave;
    });

  tierUpdateQueues.set(safeTier, nextTask);
  return nextTask;
}

let mailUpdateQueue: Promise<GlobalMailAndChatState> = Promise.resolve({
  messages: [],
  chatMessages: [],
  updatedAt: 0
});

/**
 * Fetches global mail and shared world chat messages from Supabase (`__GLOBAL_MAIL__` row).
 */
export async function fetchGlobalMailAndChatFromSupabase(): Promise<GlobalMailAndChatState> {
  const sysName = '__GLOBAL_MAIL__';
  try {
    const res = await fetch(
      `${DEFAULT_SUPABASE_URL}/rest/v1/players?name=eq.${encodeURIComponent(sysName)}&select=*&order=id.desc&limit=1`,
      {
        method: 'GET',
        cache: 'no-store',
        headers: {
          apikey: DEFAULT_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache'
        }
      }
    );

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const unpacked = unpackSystemMailRow(rows[0]);
        if (unpacked) {
          notifyMailListeners(unpacked);
          return unpacked;
        }
      }
    }
  } catch (err) {
    console.warn('[Supabase] Error fetching global mail/chat:', err);
  }

  if (globalMailCache) return globalMailCache;
  return {
    messages: [],
    chatMessages: [],
    updatedAt: Date.now()
  };
}

async function saveGlobalMailAndChatToSupabase(
  updater: (current: GlobalMailAndChatState) => GlobalMailAndChatState
): Promise<GlobalMailAndChatState> {
  const nextTask = mailUpdateQueue
    .catch(() => ({ messages: [], chatMessages: [], updatedAt: Date.now() }))
    .then(async () => {
      const sysName = '__GLOBAL_MAIL__';
      let current: GlobalMailAndChatState = globalMailCache || {
        messages: [],
        chatMessages: [],
        updatedAt: Date.now()
      };
      let rowId = globalMailCache?._id;

      try {
        const checkRes = await fetch(
          `${DEFAULT_SUPABASE_URL}/rest/v1/players?name=eq.${encodeURIComponent(sysName)}&select=*&order=id.desc&limit=1`,
          {
            method: 'GET',
            cache: 'no-store',
            headers: {
              apikey: DEFAULT_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`
            }
          }
        );
        if (checkRes.ok) {
          const checkRows = await checkRes.json();
          if (Array.isArray(checkRows) && checkRows.length > 0) {
            rowId = checkRows[0].id !== undefined ? Number(checkRows[0].id) : rowId;
            const latest = unpackSystemMailRow(checkRows[0]);
            if (latest) {
              // Merge local cache messages with DB messages by id so nothing is lost
              const msgMap = new Map<string, PrivateMessage>();
              latest.messages.forEach((m) =>
                msgMap.set(m.id || `${m.from}_${m.to}_${m.time}`, m)
              );
              current.messages.forEach((m) => {
                const k = m.id || `${m.from}_${m.to}_${m.time}`;
                const ex = msgMap.get(k);
                if (!ex) {
                  msgMap.set(k, m);
                } else {
                  msgMap.set(k, {
                    ...ex,
                    ...m,
                    gift: m.gift || ex.gift,
                    read: Boolean(ex.read || m.read),
                    giftClaimed: Boolean(ex.giftClaimed || m.giftClaimed),
                    giftClaimedAt: ex.giftClaimedAt || m.giftClaimedAt
                  });
                }
              });

              const chatMap = new Map<string, ChatMessage>();
              latest.chatMessages.forEach((c) => chatMap.set(c.id, c));
              current.chatMessages.forEach((c) => {
                if (!chatMap.has(c.id)) chatMap.set(c.id, c);
              });

              const winMap = new Map<string, WheelWinnerEntry>();
              (latest.wheelWinners || []).forEach((w) => winMap.set(w.id, w));
              (current.wheelWinners || []).forEach((w) => {
                if (!winMap.has(w.id)) winMap.set(w.id, w);
              });

              current = {
                messages: Array.from(msgMap.values()).slice(-200),
                chatMessages: Array.from(chatMap.values()).slice(-80),
                wheelWinners: Array.from(winMap.values())
                  .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                  .slice(0, 35),
                updatedAt: Date.now()
              };
            }
          }
        }
      } catch (e) {
        // ignore
      }

      const updated = updater(current);
      const now = Date.now();
      const finalState: GlobalMailAndChatState & { _id?: number; _localWriteAt?: number } = {
        messages: updated.messages.slice(-200),
        chatMessages: updated.chatMessages.slice(-80),
        wheelWinners: (updated.wheelWinners || []).slice(0, 35),
        updatedAt: now,
        _id: rowId,
        _localWriteAt: now
      };

      globalMailCache = finalState;
      notifyMailListeners(finalState);

      const emailPayload = JSON.stringify({
        is_system_mail: true,
        messages: finalState.messages,
        chatMessages: finalState.chatMessages,
        wheelWinners: finalState.wheelWinners,
        updated_at: now,
        is_online: false,
        location: 'city'
      });

      try {
        if (rowId !== undefined) {
          await fetch(
            `${DEFAULT_SUPABASE_URL}/rest/v1/players?id=eq.${encodeURIComponent(String(rowId))}`,
            {
              method: 'PATCH',
              keepalive: true,
              cache: 'no-store',
              headers: {
                apikey: DEFAULT_SUPABASE_ANON_KEY,
                Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal'
              },
              body: JSON.stringify({
                email: emailPayload,
                gold: 0,
                crystals: 0,
                is_admin: 0
              })
            }
          );
        } else {
          const postRes = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/players`, {
            method: 'POST',
            keepalive: true,
            cache: 'no-store',
            headers: {
              apikey: DEFAULT_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation'
            },
            body: JSON.stringify({
              name: sysName,
              email: emailPayload,
              password: 'system_mail_lock',
              gold: 0,
              crystals: 0,
              is_admin: 0
            })
          });
          if (postRes.ok) {
            const created = await postRes.json();
            if (Array.isArray(created) && created.length > 0 && created[0].id !== undefined) {
              if (globalMailCache) globalMailCache._id = Number(created[0].id);
            }
          }
        }
      } catch (err) {
        console.warn('[Supabase] Error saving global mail/chat:', err);
      }

      return finalState;
    });

  mailUpdateQueue = nextTask;
  return nextTask;
}

/**
 * Sends a private mail message (optionally with a claimable gift attachment) from one player/admin to another via Supabase.
 */
export async function sendMailInSupabase(
  fromNick: string,
  toNick: string,
  text: string,
  gift?: MailGiftAttachment
): Promise<PrivateMessage[]> {
  const cleanFrom = String(fromNick || '').trim();
  const cleanTo = String(toNick || '').trim();
  const cleanText = String(text || '').trim();
  if (!cleanFrom || !cleanTo || !cleanText) {
    return globalMailCache?.messages || [];
  }

  const now = Date.now();
  const timeStr = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hasGift = Boolean(
    gift &&
      ((gift.gold && gift.gold > 0) ||
        (gift.crystals && gift.crystals > 0) ||
        (gift.exp && gift.exp > 0) ||
        (gift.statPoints && gift.statPoints > 0) ||
        (gift.hpPotions && gift.hpPotions > 0) ||
        (gift.enPotions && gift.enPotions > 0) ||
        (gift.vipHours && gift.vipHours > 0))
  );

  const newMsg: PrivateMessage = {
    id: `mail_${now}_${Math.random().toString(36).slice(2, 7)}`,
    from: cleanFrom,
    to: cleanTo,
    text: cleanText,
    time: now,
    timeStr,
    read: false,
    ...(hasGift ? { gift, giftClaimed: false } : {})
  };

  const state = await saveGlobalMailAndChatToSupabase((cur) => ({
    ...cur,
    messages: [...cur.messages, newMsg],
    updatedAt: now
  }));

  return state.messages;
}

const claimedGiftLocksInMemory = new Set<string>();

/**
 * Atomically marks a mail gift as claimed in Supabase (__GLOBAL_MAIL__) so it can NEVER be claimed more than once.
 */
export async function claimMailGiftInSupabase(
  msgId: string,
  recipientNick: string
): Promise<{
  success: boolean;
  alreadyClaimed?: boolean;
  gift?: MailGiftAttachment;
  messages: PrivateMessage[];
}> {
  const cleanId = String(msgId || '').trim();
  const cleanRec = String(recipientNick || '').trim().toLowerCase();
  if (!cleanId || !cleanRec) {
    return { success: false, messages: globalMailCache?.messages || [] };
  }

  if (claimedGiftLocksInMemory.has(cleanId)) {
    return {
      success: false,
      alreadyClaimed: true,
      messages: globalMailCache?.messages || []
    };
  }
  claimedGiftLocksInMemory.add(cleanId);

  let claimedGift: MailGiftAttachment | undefined = undefined;
  let wasAlreadyClaimed = false;

  const state = await saveGlobalMailAndChatToSupabase((cur) => {
    const nextMessages = cur.messages.map((m) => {
      const mId = m.id || `${m.from}_${m.to}_${m.time}`;
      if (mId !== cleanId) return m;
      const isToRecipient = String(m.to || '').trim().toLowerCase() === cleanRec;
      if (!isToRecipient || !m.gift) return m;

      if (m.giftClaimed) {
        wasAlreadyClaimed = true;
        return m;
      }

      claimedGift = m.gift;
      return {
        ...m,
        read: true,
        giftClaimed: true,
        giftClaimedAt: Date.now()
      };
    });

    return {
      ...cur,
      messages: nextMessages,
      updatedAt: Date.now()
    };
  });

  if (wasAlreadyClaimed || !claimedGift) {
    return {
      success: false,
      alreadyClaimed: wasAlreadyClaimed,
      messages: state.messages
    };
  }

  return {
    success: true,
    gift: claimedGift,
    messages: state.messages
  };
}

/**
 * Marks incoming messages for `recipientNick` (optionally from `senderNick`) as read in Supabase.
 */
export async function markMailReadInSupabase(
  recipientNick: string,
  senderNick?: string
): Promise<PrivateMessage[]> {
  const cleanRec = String(recipientNick || '').trim().toLowerCase();
  const cleanSender = senderNick ? String(senderNick).trim().toLowerCase() : null;
  if (!cleanRec) return globalMailCache?.messages || [];

  const state = await saveGlobalMailAndChatToSupabase((cur) => ({
    ...cur,
    messages: cur.messages.map((m) => {
      const isToMe = String(m.to || '').trim().toLowerCase() === cleanRec;
      const isFromSender =
        !cleanSender || String(m.from || '').trim().toLowerCase() === cleanSender;
      if (isToMe && isFromSender && !m.read) {
        return { ...m, read: true };
      }
      return m;
    }),
    updatedAt: Date.now()
  }));

  return state.messages;
}

/**
 * Broadcasts a chat message (e.g. World Chat rare drop or player message) to all players via Supabase.
 */
export async function broadcastWorldChatMessageInSupabase(
  msg: ChatMessage
): Promise<ChatMessage[]> {
  const state = await saveGlobalMailAndChatToSupabase((cur) => {
    const exists = cur.chatMessages.some((c) => c.id === msg.id);
    if (exists) return cur;
    return {
      ...cur,
      chatMessages: [...cur.chatMessages, msg],
      updatedAt: Date.now()
    };
  });

  return state.chatMessages;
}

/**
 * Deletes a specific chat message from the shared Supabase chat state (`__GLOBAL_MAIL__`)
 */
export async function deleteWorldChatMessageInSupabase(
  msgId: string
): Promise<ChatMessage[]> {
  if (!msgId) return globalMailCache?.chatMessages || [];
  if (globalMailCache) {
    globalMailCache.chatMessages = globalMailCache.chatMessages.filter((c) => c.id !== msgId);
  }
  const state = await saveGlobalMailAndChatToSupabase((cur) => ({
    ...cur,
    chatMessages: cur.chatMessages.filter((c) => c.id !== msgId),
    updatedAt: Date.now()
  }));
  return state.chatMessages;
}

/**
 * Clears all world chat messages from Supabase (__GLOBAL_MAIL__)
 */
export async function clearWorldChatMessagesInSupabase(): Promise<ChatMessage[]> {
  if (globalMailCache) {
    globalMailCache.chatMessages = globalMailCache.chatMessages.filter(
      (c) => c.channel !== 'world'
    );
  }
  const state = await saveGlobalMailAndChatToSupabase((cur) => ({
    ...cur,
    chatMessages: cur.chatMessages.filter((c) => c.channel !== 'world'),
    updatedAt: Date.now()
  }));
  return state.chatMessages;
}

/**
 * Records a roulette winner entry in Supabase (`__GLOBAL_MAIL__.wheelWinners`) for real-time display.
 */
export async function recordWheelWinnerInSupabase(
  winner: WheelWinnerEntry
): Promise<WheelWinnerEntry[]> {
  const state = await saveGlobalMailAndChatToSupabase((cur) => {
    const existing = cur.wheelWinners || [];
    if (existing.some((w) => w.id === winner.id)) return cur;
    return {
      ...cur,
      wheelWinners: [winner, ...existing].slice(0, 35),
      updatedAt: Date.now()
    };
  });
  return state.wheelWinners || [];
}

/**
 * Credits a recipient player in Supabase with transferred Gold and records the transaction in their Trade Protocol.
 */
export async function transferGoldToPlayerInSupabase(
  fromNick: string,
  toNick: string,
  amount: number,
  description: string = 'Перевод золота'
): Promise<boolean> {
  const cleanTo = String(toNick || '').trim();
  if (!cleanTo || amount <= 0) return false;
  const target = await findPlayerInSupabase(cleanTo);
  if (!target) return false;

  const now = Date.now();
  const dateStr = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const incomingEntry: TradeProtocolEntry = {
    id: `prot_gold_in_${now}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
    dateStr,
    type: 'gold_transfer',
    description: `🪙 Получен перевод: +${amount} золота от игрока ${fromNick}. Комментарий: «${description}»`,
    targetNick: fromNick,
    amount
  };

  const existingProt: TradeProtocolEntry[] = Array.isArray(target.trade_protocol)
    ? target.trade_protocol
    : [];

  return updatePlayerInDatabase(cleanTo, {
    gold: Math.max(0, Number(target.gold ?? 0) + amount),
    trade_protocol: [incomingEntry, ...existingProt].slice(0, 40),
    external_sync_ts: now
  });
}

export const transferGoldBetweenPlayersInSupabase = transferGoldToPlayerInSupabase;

/**
 * Credits a recipient player in Supabase with a transferred Item and records the transaction in their Trade Protocol.
 */
export async function transferItemToPlayerInSupabase(
  fromNick: string,
  toNick: string,
  item: GameItem
): Promise<boolean> {
  const cleanTo = String(toNick || '').trim();
  if (!cleanTo || !item) return false;
  const target = await findPlayerInSupabase(cleanTo);
  if (!target) return false;

  const now = Date.now();
  const dateStr = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const safeIconText =
    typeof item.icon === 'string' &&
    (item.icon.startsWith('data:') || item.icon.startsWith('/') || item.icon.startsWith('http'))
      ? '🖼️'
      : item.icon || '⚔️';
  const incomingEntry: TradeProtocolEntry = {
    id: `prot_item_in_${now}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
    dateStr,
    type: 'transfer_in',
    description: `📦 Получен предмет: ${safeIconText} ${item.name} от игрока ${fromNick}`,
    itemSnapshot: { name: item.name, icon: item.icon, quality: item.quality },
    targetNick: fromNick
  };

  const existingInv: GameItem[] = Array.isArray(target.inventory) ? target.inventory : [];
  const existingProt: TradeProtocolEntry[] = Array.isArray(target.trade_protocol)
    ? target.trade_protocol
    : [];

  return updatePlayerInDatabase(cleanTo, {
    inventory: [item, ...existingInv],
    trade_protocol: [incomingEntry, ...existingProt].slice(0, 40),
    external_sync_ts: now
  });
}

export const transferItemBetweenPlayersInSupabase = transferItemToPlayerInSupabase;

export interface AdminModifyPlayerBalanceOptions {
  goldDelta?: number;
  crystalsDelta?: number;
  expDelta?: number;
  setGold?: number;
  setCrystals?: number;
  setLevel?: number;
  setExp?: number;
  addExp?: number;
  setStatPoints?: number;
  setStr?: number;
  setAgi?: number;
  setVit?: number;
  setHp?: number;
  setMaxHp?: number;
  setEnergy?: number;
  setMaxEnergy?: number;
  setHpPotions?: number;
  setEnPotions?: number;
  setBagCapacity?: number;
  grantVipHours?: number;
  grantVip12h?: boolean;
  revokeVip?: boolean;
  setIsAdmin?: number;
  removeInventoryItemId?: string;
  unequipSlot?: string;
  addInventoryItem?: any;
  updateInventoryItem?: any;
  updateEquippedItem?: { slot: string; item: any };
  equipItemToSlot?: { slot: string; item: any };
  repairAllItems?: boolean;
  resetDailyExchangeLimits?: boolean;
  daily_login_day?: number;
  daily_login_last_date?: string;
  resetDailyLoginReward?: boolean;
  setMobsKilled?: number;
  addMobsKilled?: number;
  setTotalGoldCollected?: number;
  setBanInfo?: PlayerBanInfo | null;
  setOwnedSkinIds?: string[];
  setOwnedSkinExpirations?: Record<string, number>;
  setOwnedSkins?: CharacterSkinTemplate[];
  setActiveSkinId?: string | null;
  setAvatar?: string;
}

export interface AdminModifyPlayerResult {
  success: boolean;
  error?: string;
  updatedPlayer?: RealtimePlayer;
  rawPlayer?: any;
}

/**
 * Allows the Administrator to safely modify any player's balance, level (both up and down), exp, stats, gear, or VIP status in Supabase.
 */
export async function adminModifyPlayerBalanceInSupabase(
  targetNick: string,
  options: AdminModifyPlayerBalanceOptions
): Promise<AdminModifyPlayerResult> {
  const cleanTarget = String(targetNick || '').trim();
  if (!cleanTarget) return { success: false, error: 'Ник игрока не указан' };

  const rawRow = await findPlayerInSupabase(cleanTarget);
  if (!rawRow) {
    return {
      success: false,
      error: `Игрок «${cleanTarget}» не найден в базе данных Supabase`
    };
  }

  const existing = unpackPlayerRow(rawRow);
  const oldLvl = Math.max(1, Number(existing.lvl ?? 1));

  const updates: Parameters<typeof updatePlayerInDatabase>[1] = {
    is_admin_action: true
  };

  if (options.setGold !== undefined) {
    updates.gold = Math.max(0, Math.floor(options.setGold));
  } else if (options.goldDelta !== undefined) {
    updates.gold = Math.max(0, Math.floor(Number(existing.gold ?? 0) + options.goldDelta));
  }
  if (options.setTotalGoldCollected !== undefined) {
    updates.total_gold_collected = Math.max(0, Math.floor(options.setTotalGoldCollected));
  } else if (updates.gold !== undefined) {
    updates.total_gold_collected = Math.max(Number(existing.total_gold_collected ?? existing.gold ?? 0), updates.gold);
  }

  if (options.setMobsKilled !== undefined) {
    updates.mobs_killed = Math.max(0, Math.floor(options.setMobsKilled));
    updates.mob_kills = updates.mobs_killed;
  } else if (options.addMobsKilled !== undefined) {
    updates.mobs_killed = Math.max(0, Math.floor(Number(existing.mobs_killed ?? 0) + options.addMobsKilled));
    updates.mob_kills = updates.mobs_killed;
  }

  if (options.setCrystals !== undefined) {
    updates.crystals = Math.max(0, Math.floor(options.setCrystals));
  } else if (options.crystalsDelta !== undefined) {
    updates.crystals = Math.max(0, Math.floor(Number(existing.crystals ?? 0) + options.crystalsDelta));
  }

  if (options.setStr !== undefined) {
    updates.str = Math.max(1, Math.floor(options.setStr));
  }
  if (options.setAgi !== undefined) {
    updates.agi = Math.max(1, Math.floor(options.setAgi));
  }
  if (options.setVit !== undefined) {
    updates.vit = Math.max(1, Math.floor(options.setVit));
  }
  if (options.setStatPoints !== undefined) {
    updates.stat_points = Math.max(0, Math.floor(options.setStatPoints));
  }
  if (options.setHpPotions !== undefined) {
    updates.hp_potions = Math.max(0, Math.floor(options.setHpPotions));
  }
  if (options.setEnPotions !== undefined) {
    updates.en_potions = Math.max(0, Math.floor(options.setEnPotions));
  }
  if (options.setBagCapacity !== undefined) {
    updates.bag_capacity = Math.max(20, Math.floor(options.setBagCapacity));
  }
  if (options.setIsAdmin !== undefined) {
    updates.is_admin = options.setIsAdmin ? 1 : 0;
  }
  if (options.setBanInfo !== undefined) {
    (updates as any).ban_info = options.setBanInfo;
    (updates as any).banInfo = options.setBanInfo;
  }
  if (options.setOwnedSkinIds !== undefined) {
    (updates as any).owned_skin_ids = options.setOwnedSkinIds;
    (updates as any).ownedSkinIds = options.setOwnedSkinIds;
  }
  if (options.setOwnedSkinExpirations !== undefined) {
    (updates as any).owned_skin_expirations = options.setOwnedSkinExpirations;
    (updates as any).ownedSkinExpirations = options.setOwnedSkinExpirations;
  }
  if (options.setOwnedSkins !== undefined) {
    (updates as any).owned_skins = options.setOwnedSkins;
    (updates as any).ownedSkins = options.setOwnedSkins;
    registerPlayerOwnedSkinsInMemory(options.setOwnedSkins);
  }
  if (options.setActiveSkinId !== undefined) {
    (updates as any).active_skin_id = options.setActiveSkinId;
    (updates as any).activeSkinId = options.setActiveSkinId;
  }
  if (options.setAvatar !== undefined) {
    updates.avatar = options.setAvatar;
  }

  if (options.removeInventoryItemId) {
    const curInv = Array.isArray(existing.inventory) ? existing.inventory : [];
    updates.inventory = curInv.filter((it: any) => it && it.id !== options.removeInventoryItemId);
  }

  if (options.unequipSlot) {
    const curEq = { ...(existing.equipped || {}) };
    const itemToBag = curEq[options.unequipSlot];
    delete curEq[options.unequipSlot];
    updates.equipped = curEq;
    if (itemToBag) {
      const curInv = Array.isArray(updates.inventory ?? existing.inventory)
        ? (updates.inventory ?? existing.inventory)
        : [];
      updates.inventory = [itemToBag, ...curInv];
    }
  }

  if (options.addInventoryItem) {
    const curInv = Array.isArray(updates.inventory ?? existing.inventory)
      ? (updates.inventory ?? existing.inventory)
      : [];
    updates.inventory = [options.addInventoryItem, ...curInv];
  }

  if (options.updateInventoryItem && options.updateInventoryItem.id) {
    const curInv = Array.isArray(updates.inventory ?? existing.inventory)
      ? (updates.inventory ?? existing.inventory)
      : [];
    updates.inventory = curInv.map((it: any) =>
      it && it.id === options.updateInventoryItem.id ? { ...it, ...options.updateInventoryItem } : it
    );
  }

  if (options.updateEquippedItem && options.updateEquippedItem.slot) {
    const curEq = { ...(updates.equipped ?? existing.equipped ?? {}) };
    const slotKey = options.updateEquippedItem.slot;
    if (curEq[slotKey]) {
      curEq[slotKey] = { ...curEq[slotKey], ...options.updateEquippedItem.item };
    } else {
      curEq[slotKey] = options.updateEquippedItem.item;
    }
    updates.equipped = curEq;
  }

  if (options.equipItemToSlot && options.equipItemToSlot.slot && options.equipItemToSlot.item) {
    const curEq = { ...(updates.equipped ?? existing.equipped ?? {}) };
    const slotKey = options.equipItemToSlot.slot;
    const prevEquipped = curEq[slotKey];
    curEq[slotKey] = options.equipItemToSlot.item;
    updates.equipped = curEq;
    if (prevEquipped) {
      const curInv = Array.isArray(updates.inventory ?? existing.inventory)
        ? (updates.inventory ?? existing.inventory)
        : [];
      updates.inventory = [prevEquipped, ...curInv];
    }
  }

  if (options.repairAllItems) {
    const curEq = { ...(updates.equipped ?? existing.equipped ?? {}) };
    Object.keys(curEq).forEach((k) => {
      if (curEq[k]) {
        const maxD = Math.max(1, Number(curEq[k].maxDurability ?? 10));
        curEq[k] = { ...curEq[k], durability: maxD, maxDurability: maxD };
      }
    });
    updates.equipped = curEq;
    const curInv = Array.isArray(updates.inventory ?? existing.inventory)
      ? (updates.inventory ?? existing.inventory)
      : [];
    updates.inventory = curInv.map((it: any) => {
      if (!it) return it;
      const maxD = Math.max(1, Number(it.maxDurability ?? 10));
      return { ...it, durability: maxD, maxDurability: maxD };
    });
  }

  if (options.resetDailyExchangeLimits) {
    updates.daily_crystal_to_gold_count = 0;
    updates.daily_crystal_to_gold_date = '';
    updates.daily_gold_to_crystal_count = 0;
    updates.daily_gold_to_crystal_date = '';
  }

  if (options.resetDailyLoginReward) {
    updates.daily_login_day = 0;
    updates.daily_login_last_date = '';
  } else {
    if (options.daily_login_day !== undefined) updates.daily_login_day = options.daily_login_day;
    if (options.daily_login_last_date !== undefined) updates.daily_login_last_date = options.daily_login_last_date;
  }

  // 1. Determine base level and exp before rollover
  let curLvl =
    options.setLevel !== undefined && options.setLevel >= 1
      ? Math.max(1, Math.min(MAX_LEVEL, Math.floor(options.setLevel)))
      : oldLvl;

  let curExp =
    options.setExp !== undefined
      ? Math.max(0, Math.floor(options.setExp))
      : Math.max(0, Math.floor(Number(existing.exp ?? 0)));

  if (options.setLevel !== undefined && curLvl < oldLvl && options.setExp === Math.floor(Number(existing.exp ?? 0))) {
    curExp = 0;
  }

  const expToAdd = Number(options.addExp ?? options.expDelta ?? 0);
  if (expToAdd !== 0) {
    curExp = Math.max(0, curExp + Math.floor(expToAdd));
  }

  // 2. Always roll over level automatically if curExp >= EXP_TABLE[curLvl]
  while (curLvl < MAX_LEVEL && curExp >= (EXP_TABLE[curLvl] || 9999999)) {
    const needed = EXP_TABLE[curLvl] || 9999999;
    curExp -= needed;
    curLvl += 1;
  }

  updates.lvl = curLvl;
  updates.exp = Math.max(0, curExp);

  // 3. Award level-up gold/crystals if level increased and gold/crystals weren't explicitly overridden
  if (curLvl > oldLvl) {
    let gainedGold = 0;
    let gainedCrystals = 0;
    for (let l = oldLvl + 1; l <= curLvl; l++) {
      const rw = LEVEL_UP_REWARDS[l];
      if (rw) {
        gainedGold += rw.gold;
        gainedCrystals += rw.crystals;
      }
    }
    if (options.setGold === undefined && options.goldDelta === undefined && gainedGold > 0) {
      updates.gold = Math.max(0, Number(existing.gold ?? 0)) + gainedGold;
    }
    if (options.setCrystals === undefined && options.crystalsDelta === undefined && gainedCrystals > 0) {
      updates.crystals = Math.max(0, Number(existing.crystals ?? 0)) + gainedCrystals;
    }
  }

  // 4. Automatically normalize stats (str, agi, vit, stat_points) in BOTH directions (level up & level down)
  const rawStr = updates.str !== undefined ? updates.str : Number(existing.str ?? 1);
  const rawAgi = updates.agi !== undefined ? updates.agi : Number(existing.agi ?? 1);
  const rawVit = updates.vit !== undefined ? updates.vit : Number(existing.vit ?? 1);
  const rawSp = updates.stat_points !== undefined ? updates.stat_points : Number(existing.stat_points ?? 0);

  const normStats = normalizeStatsForLevel(curLvl, rawStr, rawAgi, rawVit, rawSp);
  updates.str = normStats.str;
  updates.agi = normStats.agi;
  updates.vit = normStats.vit;
  updates.stat_points = normStats.statPoints;

  // 5. Unequip any item exceeding curLvl and compute accurate max_hp & max_energy
  const curEqObj = { ...(updates.equipped ?? existing.equipped ?? {}) };
  const curInvArr: any[] = Array.isArray(updates.inventory ?? existing.inventory)
    ? [...(updates.inventory ?? existing.inventory)]
    : [];
  let gearHpBonus = 0;
  let gearEnBonus = 0;
  let eqChanged = false;
  Object.keys(curEqObj).forEach((slotKey) => {
    const it = curEqObj[slotKey];
    if (!it) return;
    if (Number(it.lvl || 1) > curLvl) {
      curInvArr.unshift(it);
      curEqObj[slotKey] = null;
      eqChanged = true;
    } else if (Number(it.durability ?? 1) > 0) {
      gearHpBonus += Number(it.hp || 0);
      gearEnBonus += Number(it.energyBonus || 0);
    }
  });
  if (eqChanged) {
    updates.equipped = curEqObj;
    updates.inventory = curInvArr;
  }

  const calcMaxHp = getHeroMaxHpFromVit(normStats.vit) + gearHpBonus + Number(existing.bonus_hp ?? 0);
  const calcMaxEn = 100 + gearEnBonus;

  updates.max_hp = options.setMaxHp !== undefined ? Math.max(50, Math.floor(options.setMaxHp)) : calcMaxHp;
  updates.max_energy = options.setMaxEnergy !== undefined ? Math.max(30, Math.floor(options.setMaxEnergy)) : calcMaxEn;
  updates.hp = options.setHp !== undefined ? Math.max(1, Math.min(updates.max_hp, Math.floor(options.setHp))) : updates.max_hp;
  updates.energy = options.setEnergy !== undefined ? Math.max(0, Math.min(updates.max_energy, Math.floor(options.setEnergy))) : updates.max_energy;

  if (options.grantVipHours !== undefined) {
    if (options.grantVipHours > 0) {
      const curUntil = Math.max(Date.now(), Number(existing.premium_until ?? 0));
      updates.is_premium = true;
      updates.premium_until = curUntil + options.grantVipHours * 3600 * 1000;
    } else {
      updates.is_premium = false;
      updates.premium_until = 0;
    }
  } else if (options.grantVip12h) {
    const curUntil = Math.max(Date.now(), Number(existing.premium_until ?? 0));
    updates.is_premium = true;
    updates.premium_until = curUntil + 12 * 3600 * 1000;
  } else if (options.revokeVip) {
    updates.is_premium = false;
    updates.premium_until = 0;
  }

  const syncNow = Date.now();
  updates.external_sync_ts = syncNow;
  if (updates.lvl !== undefined) {
    const targetTier = getPyramidTierForLevel(updates.lvl);
    updates.pyramid_tier = targetTier;
    updates['пирамидальный_уровень'] = targetTier;
  }

  const ok = await updatePlayerInDatabase(cleanTarget, updates);
  if (!ok) {
    return { success: false, error: 'Не удалось обновить запись в Supabase' };
  }

  const refreshedRaw = await findPlayerInSupabase(cleanTarget);
  const refreshed = refreshedRaw ? unpackPlayerRow(refreshedRaw) : { ...existing, ...updates };
  const finalGold = Number(refreshed?.gold ?? updates.gold ?? existing.gold ?? 0);
  const finalCrystals = Number(refreshed?.crystals ?? updates.crystals ?? existing.crystals ?? 0);
  const finalLvl = Number(refreshed?.lvl ?? updates.lvl ?? existing.lvl ?? 1);
  const finalExp = Number(refreshed?.exp ?? updates.exp ?? existing.exp ?? 0);
  const finalStatPoints = Number(refreshed?.stat_points ?? updates.stat_points ?? existing.stat_points ?? 0);
  const finalStr = Number(refreshed?.str ?? updates.str ?? existing.str ?? 5);
  const finalAgi = Number(refreshed?.agi ?? updates.agi ?? existing.agi ?? 5);
  const finalVit = Number(refreshed?.vit ?? updates.vit ?? existing.vit ?? 5);
  const finalHpPotions = Number(refreshed?.hp_potions ?? updates.hp_potions ?? existing.hp_potions ?? 3);
  const finalEnPotions = Number(refreshed?.en_potions ?? updates.en_potions ?? existing.en_potions ?? 3);
  const finalPrem = Boolean(refreshed?.is_premium ?? updates.is_premium ?? existing.is_premium);
  const finalPremUntil = Number(refreshed?.premium_until ?? updates.premium_until ?? existing.premium_until ?? 0);
  const finalLastSeen = Number(refreshed?.last_seen ?? existing.last_seen ?? 0);
  const finalIsOnline = isPlayerOnlineByHeartbeat(refreshed?.is_online ?? existing.is_online, finalLastSeen);

  const updatedPlayer: RealtimePlayer = {
    nick: refreshed?.name || refreshed?.nick || cleanTarget,
    location: refreshed?.location || existing.location || 'city',
    pyramidTier: getPyramidTierForLevel(finalLvl),
    row: refreshed?.row ?? existing.row ?? 9,
    col: refreshed?.col ?? existing.col ?? 1,
    hp: Number(refreshed?.hp ?? updates.hp ?? existing.hp ?? 100),
    maxHp: Number(refreshed?.max_hp ?? updates.max_hp ?? existing.max_hp ?? 100),
    energy: Number(refreshed?.energy ?? updates.energy ?? existing.energy ?? 100),
    maxEnergy: Number(refreshed?.max_energy ?? updates.max_energy ?? existing.max_energy ?? 100),
    lvl: finalLvl,
    exp: finalExp,
    statPoints: finalStatPoints,
    str: finalStr,
    agi: finalAgi,
    vit: finalVit,
    hpPotions: finalHpPotions,
    enPotions: finalEnPotions,
    gold: finalGold,
    crystals: finalCrystals,
    avatar: refreshed?.avatar || existing.avatar || '🧙‍♂️',
    isPremium: finalPrem && finalPremUntil > Date.now(),
    premiumUntil: finalPremUntil,
    isOnline: finalIsOnline,
    lastSeen: finalLastSeen,
    externalSyncTs: syncNow,
    ownedSkinIds: Array.isArray(refreshed?.ownedSkinIds ?? refreshed?.owned_skin_ids) ? (refreshed?.ownedSkinIds ?? refreshed?.owned_skin_ids) : [],
    activeSkinId: refreshed?.activeSkinId ?? refreshed?.active_skin_id ?? null,
    banInfo: refreshed?.banInfo ?? refreshed?.ban_info ?? null
  };

  return { success: true, updatedPlayer, rawPlayer: refreshed };
}

export const adminModifyPlayerInSupabase = adminModifyPlayerBalanceInSupabase;

export async function applyCompensationBonusToAllPlayers(): Promise<void> {
  try {
    const rows = await fetchAllPlayersFromDatabase();
    for (const row of rows) {
      if (isSystemMailRow(row) || isSystemTierRow(row)) continue;
      const rowId = row.id;
      const nick = String(row.name || row.nick || '').trim();
      if (!nick) continue;

      let parsed: any = {};
      if (typeof row.email === 'string' && row.email.trim().startsWith('{')) {
        try {
          parsed = JSON.parse(row.email);
        } catch (e) {}
      }

      if (parsed.compensation_v1_0_31_applied) continue;

      const currentGold = Math.max(0, Number(row.gold ?? parsed.gold ?? 0));
      const currentCrystals = Math.max(0, Number(row.crystals ?? parsed.crystals ?? 0));

      const nextGold = currentGold + 1000;
      const nextCrystals = currentCrystals + 100;
      parsed.compensation_v1_0_31_applied = true;

      if (!Array.isArray(parsed.trade_protocol)) {
        parsed.trade_protocol = [];
      }
      parsed.trade_protocol.unshift({
        id: 'comp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        time: Date.now(),
        type: 'compensation',
        text: '🎁 Компенсация за неудобства: +1000 золота и +100 кристаллов'
      });

      const filterQuery = rowId !== undefined ? `id=eq.${encodeURIComponent(String(rowId))}` : `name=ilike.${encodeURIComponent(nick)}`;
      await fetch(
        `${DEFAULT_SUPABASE_URL}/rest/v1/players?${filterQuery}`,
        {
          method: 'PATCH',
          keepalive: true,
          cache: 'no-store',
          headers: {
            apikey: DEFAULT_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            email: JSON.stringify(parsed),
            gold: nextGold,
            crystals: nextCrystals
          })
        }
      );
    }
  } catch (err) {
    console.warn('[Supabase] Compensation bonus application error:', err);
  }
}

/**
 * Recalculates levels, experience, stats (str, agi, vit, stat_points), HP, Energy, Damage, and Pyramid Tier
 * for all registered players in Supabase according to the current EXP_TABLE.
 */
export async function recalculateAllPlayersByExpTableInSupabase(): Promise<{
  updatedCount: number;
  details: string[];
}> {
  const details: string[] = [];
  let updatedCount = 0;

  try {
    const response = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/players?select=*`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        apikey: DEFAULT_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) return { updatedCount: 0, details };
    const rows = await response.json();
    if (!Array.isArray(rows)) return { updatedCount: 0, details };

    for (const row of rows) {
      if (isSystemMailRow(row) || isSystemTierRow(row)) continue;
      const nick = String(row.name || row.nick || '').trim();
      if (!nick || nick.startsWith('__')) continue;

      let parsed: any = {};
      if (typeof row.email === 'string' && row.email.trim().startsWith('{')) {
        try {
          parsed = JSON.parse(row.email);
        } catch (e) {}
      }

      const oldLvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(parsed.lvl ?? row.lvl ?? 1))));
      const oldExp = Math.max(0, Math.floor(Number(parsed.exp ?? row.exp ?? 0)));
      const wasV3Migrated = Boolean(parsed.exp_table_v3_migrated);

      const totalExp = wasV3Migrated ? getTotalAccumulatedExp(oldLvl, oldExp) : oldExp;
      const { level: newLvl, exp: newExp } = recalculateLevelAndExpFromTotal(totalExp);

      const oldStr = Math.max(1, Math.floor(Number(parsed.str ?? row.str ?? 1)));
      const oldAgi = Math.max(1, Math.floor(Number(parsed.agi ?? row.agi ?? 1)));
      const oldVit = Math.max(1, Math.floor(Number(parsed.vit ?? row.vit ?? 1)));
      const oldSp = Math.max(0, Math.floor(Number(parsed.stat_points ?? row.stat_points ?? 0)));

      const normStats = normalizeStatsForLevel(newLvl, oldStr, oldAgi, oldVit, oldSp);

      const eqObj = parsed.equipped && typeof parsed.equipped === 'object' ? { ...parsed.equipped } : {};
      const invArr: any[] = Array.isArray(parsed.inventory) ? [...parsed.inventory] : [];
      let gearHp = 0;
      let gearEn = 0;
      let gearDmg = 0;

      Object.keys(eqObj).forEach((slotKey) => {
        const it = eqObj[slotKey];
        if (!it) return;
        if (typeof it.icon === 'string' && it.icon.includes('flame_sword')) {
          it.icon = '⚔️';
        }
        if (Number(it.lvl || 1) > newLvl) {
          invArr.unshift(it);
          eqObj[slotKey] = null;
        } else if (Number(it.durability ?? 1) > 0) {
          gearHp += Number(it.hp || 0);
          gearEn += Number(it.energyBonus || 0);
          gearDmg += Number(it.dmg || 0);
        }
      });

      const bonusHp = Math.max(0, Number(parsed.bonus_hp ?? 0));
      const bonusDmg = Math.max(0, Number(parsed.bonus_dmg ?? 0));
      const newMaxHp = getHeroMaxHpFromVit(normStats.vit) + gearHp + bonusHp;
      const newMaxEn = 100 + gearEn;
      const newDmg = getHeroDamageFromStr(normStats.str) + gearDmg + bonusDmg;
      const newTier = getPyramidTierForLevel(newLvl);

      const rowGold = Number(row.gold ?? 0);
      const emailGold = Number(parsed.gold ?? 0);
      const safeGold = Math.max(0, rowGold > 0 ? rowGold : emailGold);

      const rowCrystals = Number(row.crystals ?? 0);
      const emailCrystals = Number(parsed.crystals ?? 0);
      const safeCrystals = Math.max(0, rowCrystals > 0 ? rowCrystals : emailCrystals);

      const curMobs = Math.max(0, Number(parsed.mobs_killed ?? parsed.mob_kills ?? 0));
      const tracedMobsKilled = Math.max(curMobs, Math.floor(totalExp / 35));
      const curTotalGold = Math.max(safeGold, Number(parsed.total_gold_collected ?? 0));
      const tracedTotalGold = Math.max(curTotalGold, Math.floor(totalExp * 0.8));

      const needsUpdate =
        !wasV3Migrated ||
        !parsed.gear_v2_migrated ||
        oldLvl !== newLvl ||
        oldExp !== newExp ||
        oldStr !== normStats.str ||
        oldAgi !== normStats.agi ||
        oldVit !== normStats.vit ||
        oldSp !== normStats.statPoints ||
        Number(parsed.max_hp) !== newMaxHp ||
        Number(parsed.dmg) !== newDmg ||
        rowGold !== safeGold ||
        curMobs !== tracedMobsKilled ||
        curTotalGold !== tracedTotalGold;

      if (!needsUpdate) continue;

      const updatedJson = {
        ...parsed,
        gold: safeGold,
        crystals: safeCrystals,
        lvl: newLvl,
        level: newLvl,
        exp: newExp,
        str: normStats.str,
        agi: normStats.agi,
        vit: normStats.vit,
        stat_points: normStats.statPoints,
        max_hp: newMaxHp,
        hp: Math.min(newMaxHp, Math.max(1, Number(parsed.hp ?? newMaxHp))),
        max_energy: newMaxEn,
        energy: Math.min(newMaxEn, Math.max(0, Number(parsed.energy ?? newMaxEn))),
        dmg: newDmg,
        pyramid_tier: newTier,
        пирамидальный_уровень: newTier,
        mobs_killed: tracedMobsKilled,
        mob_kills: tracedMobsKilled,
        total_gold_collected: tracedTotalGold,
        equipped: eqObj,
        inventory: invArr,
        gear_v2_migrated: true,
        exp_table_v3_migrated: true,
        external_sync_ts: Date.now()
      };

      const filterQuery = row.id !== undefined ? `id=eq.${encodeURIComponent(String(row.id))}` : `name=ilike.${encodeURIComponent(nick)}`;
      const patchRes = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/players?${filterQuery}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          apikey: DEFAULT_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          email: JSON.stringify(updatedJson),
          gold: safeGold,
          crystals: safeCrystals
        })
      });

      if (patchRes.ok) {
        updatedCount += 1;
        details.push(
          `${nick}: Ур.${oldLvl}→${newLvl}, Опыт:${newExp}/${EXP_TABLE[newLvl] || 'MAX'}, Мобы:${tracedMobsKilled}, Золото:${tracedTotalGold}`
        );
      }
    }
  } catch (err) {
    console.warn('[Supabase] recalculateAllPlayersByExpTableInSupabase error:', err);
  }

  return { updatedCount, details };
}





