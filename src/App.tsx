import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameItem,
  HeroState,
  EquippedGear,
  MarketLot,
  TradeProtocolEntry,
  FriendEntry,
  PyramidCell,
  PlayerPosition,
  ChatMessage,
  ItemSlot,
  DamagePopup,
  PrivateMessage,
  CombatLogEntry,
  RareBossTimerState,
  WheelWinnerEntry,
  ItemQualityKey
} from './types/game';
import {
  loadGameFromStorage,
  saveGameToStorage,
  resetGameStorage,
  getCurrentUserNick,
  setCurrentUserNick
} from './utils/storage';
import { AuthScreen } from './components/AuthScreen';
import {
  EXP_TABLE,
  MAX_LEVEL,
  LEVEL_UP_REWARDS,
  getHeroTotalDamage,
  getHeroTotalDodge,
  getHeroTotalMaxHp,
  getHeroTotalMaxEnergy,
  generateItem,
  getQualityConfig,
  getPyramidMob,
  generateDeterministicPyramidCells,
  respawnDeterministicPyramidCells,
  sanitizePyramidCellsForStorage,
  getFreeEmptyPyramidCells,
  createRareBossMobCell,
  PYRAMID_EXIT_POS,
  PYRAMID_SPAWN_POS,
  PYRAMID_EXIT_SPAWN_POS,
  getPyramidTierForLevel,
  getRouletteResetInfo,
  getHeroMaxHpFromVit,
  normalizeStatsForLevel
} from './utils/gameData';
import { ShopItemTemplate, CharacterSkinTemplate, PlayerBanInfo } from './types/game';
import {
  getShopCatalog,
  getShopSkins,
  getFeatureFlags,
  syncShopAndFlagsFromSupabase,
  createGameItemFromShopItem,
  getItemSellPrice,
  getItemSellRefund,
  canTransferCustomItem,
  canAuctionItem,
  getItemDefaultMaxDurability,
  REPAIR_COST_GOLD,
  GlobalFeatureFlags,
  getActiveSkinBonuses,
  getPremiumConfig,
  formatSkinBonusesText,
  resolvePlayerOwnedSkins
} from './utils/shopConfig';
import { ShopModal } from './components/modals/ShopModal';
import {
  playStepSound,
  playAttackSound,
  playLootSound,
  playCoinSound,
  playLevelUpSound,
  toggleSound,
  isSoundEnabled
} from './utils/audio';

// Components
import { CityScreen } from './components/CityScreen';
import { PyramidScreen } from './components/PyramidScreen';
import { ChatAndOnline } from './components/ChatAndOnline';

// Modals
import { CharacterModal } from './components/modals/CharacterModal';
import { InventoryModal } from './components/modals/InventoryModal';
import { AuctionModal } from './components/modals/AuctionModal';
import { CS2WheelModal } from './components/modals/CS2WheelModal';
import { CreateItemModal, ForgeCustomItemOptions } from './components/modals/CreateItemModal';
import { formatItemIconForText } from './components/ItemIcon';
import { PremiumModal } from './components/modals/PremiumModal';
import { StatsModal } from './components/modals/StatsModal';
import { TradeProtocolModal } from './components/modals/TradeProtocolModal';
import { FriendsModal } from './components/modals/FriendsModal';
import { DirectTransferModal } from './components/modals/DirectTransferModal';
import { InspectPlayerModal } from './components/modals/InspectPlayerModal';
import { AdminModal } from './components/modals/AdminModal';
import { ItemActionModal } from './components/modals/ItemActionModal';
import { MenuModal } from './components/modals/MenuModal';
import { BankAndForgeModal } from './components/modals/BankAndForgeModal';
import { LeaderboardModal } from './components/modals/LeaderboardModal';
import { DailyRewardModal } from './components/modals/DailyRewardModal';
import { ClanModal } from './components/modals/ClanModal';
import { ClanPyramidModal } from './components/modals/ClanPyramidModal';
import {
  syncClansFromSupabase,
  syncClanPyramidFromSupabase,
  getPlayerClan,
  ensureClanExistsFromHero,
  getClanPyramidBuffs,
  addClanExp
} from './utils/clanStorage';
import { computeDailyRewardStatus, DailyRewardDay, getDailyRewardDayKey } from './utils/dailyReward';
import {
  RealtimePlayer,
  RealtimeConnectionStatus,
  PyramidTierState,
  subscribeToPlayersRealtime,
  subscribeToPyramidTierRealtime,
  fetchInitialPlayers,
  syncPlayerToSupabase,
  authenticatePlayerInSupabase,
  savePlayerToDatabase,
  updatePlayerInDatabase,
  findPlayerInSupabase,
  fetchPyramidTierFromSupabase,
  savePyramidTierToSupabase,
  getCanonicalTierSeed,
  createDefaultRareBossTimers,
  normalizeRareBossTimers,
  fetchGlobalMailAndChatFromSupabase,
  subscribeToGlobalMailAndChat,
  sendMailInSupabase,
  markMailReadInSupabase,
  claimMailGiftInSupabase,
  broadcastWorldChatMessageInSupabase,
  recordWheelWinnerInSupabase,
  deleteWorldChatMessageInSupabase,
  clearWorldChatMessagesInSupabase,
  transferGoldBetweenPlayersInSupabase,
  transferItemBetweenPlayersInSupabase,
  applyCompensationBonusToAllPlayers
} from './utils/supabase';
import { findMonsterConfigByName, syncMonsterConfigsFromSupabase } from './utils/monsterConfig';

const ROWS_COUNT = 10;
const MOVE_DELAY = 700;

export default function App() {
  const currentUserNick = getCurrentUserNick();
  const [currentUser, setCurrentUser] = useState<string | null>(currentUserNick);
  const isProfileLoadedRef = useRef<boolean>(false);
  const pyramidSeedRef = useRef<number>(getCanonicalTierSeed(1));
  const lastTierSyncAtRef = useRef<number>(0);
  const livePosRef = useRef<{ screen: 'city' | 'pyramid'; tier: number; row: number; col: number }>({
    screen: 'city',
    tier: 1,
    row: PYRAMID_EXIT_SPAWN_POS.row,
    col: PYRAMID_EXIT_SPAWN_POS.col
  });

  const getInitialData = () => {
    return loadGameFromStorage();
  };

  // Load saved state
  const initialData = useRef(getInitialData()).current;

  const [hero, setHero] = useState<HeroState>({
    ...initialData.hero,
    referralCode: initialData.hero.referralCode || `ref_${initialData.hero.statusTitle.substr(0,3)}_${Math.random().toString(36).substr(2, 6)}`
  });
  const [equipped, setEquipped] = useState<EquippedGear>(initialData.equipped);
  const [inventory, setInventory] = useState<GameItem[]>(initialData.inventory);
  const [market, setMarket] = useState<MarketLot[]>(initialData.market);
  const [tradeProtocol, setTradeProtocol] = useState<TradeProtocolEntry[]>(
    initialData.tradeProtocol
  );
  const [friends, setFriends] = useState<FriendEntry[]>(initialData.friends);

  // Screen view: 'city' | 'pyramid'
  const [screen, setScreen] = useState<'city' | 'pyramid'>('city');
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
  const [lastRespawnTime, setLastRespawnTime] = useState<number>(Date.now());

  // Pyramid Crawler State — strictly bound to player level (1-5 -> P1, 6-10 -> P2, 11-20 -> P3)
  const [pyramidTier, setPyramidTier] = useState<number>(
    getPyramidTierForLevel(initialData.hero.level || 1)
  );
  const [pyramidMap, setPyramidMap] = useState<PyramidCell[][]>(initialData.pyramidMap);
  const [playerPos, setPlayerPos] = useState<PlayerPosition>(initialData.playerPos);
  const [lastMoveTime, setLastMoveTime] = useState<number>(0);

  // Chat & Combat Log Tabs State
  const [activeChatChannel, setActiveChatChannel] = useState<'world' | 'general' | 'combatLog'>('world');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init_chat_1',
      time: '12:00',
      author: 'Система',
      text: 'Добро пожаловать в Пирамида: Войны! Все игроки синхронизируются с базой Supabase.',
      isSystem: true,
      channel: 'world'
    },
    {
      id: 'init_chat_3',
      time: '12:02',
      author: 'Система',
      text: 'Сервер работает стабильно. Доступен аукцион и аренда снаряжения.',
      isSystem: true,
      channel: 'general'
    }
  ]);

  // Modal controls
  const [activeModal, setActiveModal] = useState<
    | null
    | 'character'
    | 'inventory'
    | 'auction'
    | 'wheel'
    | 'premium'
    | 'stats'
    | 'protocol'
    | 'friends'
    | 'directTransfer'
    | 'admin'
    | 'menu'
    | 'createItem'
    | 'bank'
    | 'leaderboard'
    | 'shop'
    | 'dailyReward'
    | 'clans'
    | 'clanPyramid'
  >(null);
  const [characterModalInitialTab, setCharacterModalInitialTab] = useState<'profile' | 'mail'>('profile');
  const [adminModalInitialTab, setAdminModalInitialTab] = useState<'players' | 'bosses' | 'monsters' | 'shop' | 'creation' | 'server' | 'clans' | 'clanPyramid'>('players');
  const activeModalRef = useRef(activeModal);
  activeModalRef.current = activeModal;

  // Shop Catalog, Character Skins & Feature Flags state
  const [shopCatalog, setShopCatalog] = useState<ShopItemTemplate[]>(() => getShopCatalog());
  const [shopSkins, setShopSkins] = useState<CharacterSkinTemplate[]>(() => getShopSkins());
  const [featureFlags, setFeatureFlags] = useState<GlobalFeatureFlags>(() => getFeatureFlags());

  // Personal Combat Log for Pyramid screen (replaces intrusive monster hit popups)
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);

  // Global Mail messages & Roulette Winners Log synced via Supabase
  const [mailMessages, setMailMessages] = useState<PrivateMessage[]>(
    initialData.privateMessages || []
  );
  const [wheelWinners, setWheelWinners] = useState<WheelWinnerEntry[]>([]);

  // Track last saved financial/progression values so routine HP/energy regen ticks never overwrite external DB balance edits
  const lastSyncedFinancialsRef = useRef<{
    gold: number;
    crystals: number;
    lvl: number;
    exp: number;
    premiumUntil: number;
    mobsKilled?: number;
    totalGoldCollected?: number;
    updatedAt: number;
  }>({
    gold: initialData.hero.gold,
    crystals: initialData.hero.crystals,
    lvl: initialData.hero.level,
    exp: initialData.hero.exp,
    premiumUntil: initialData.hero.premiumUntil || 0,
    mobsKilled: initialData.hero.mobsKilled || 0,
    totalGoldCollected: initialData.hero.totalGoldCollected || initialData.hero.gold || 0,
    updatedAt: 0
  });
  const lastAppliedExternalSyncTsRef = useRef<number>(0);
  const fastFlushTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Item action sub-modal (transfer / rent / auction)
  const [selectedItemForAction, setSelectedItemForAction] = useState<GameItem | null>(null);
  const [itemActionMode, setItemActionMode] = useState<'transfer' | 'rent' | 'auction' | null>(
    null
  );

  // Inspect profile modal
  const [inspectedNick, setInspectedNick] = useState<string | null>(null);
  const [transferPrefillNick, setTransferPrefillNick] = useState<string>('');

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Audio mute state
  const [soundMuted, setSoundMuted] = useState(!isSoundEnabled());

  // Supabase Realtime State
  const [realtimePlayers, setRealtimePlayers] = useState<RealtimePlayer[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>('CONNECTING');
  const [realtimeStatusError, setRealtimeStatusError] = useState<string | undefined>();
  const [recentRealtimeEvents, setRecentRealtimeEvents] = useState<
    { time: string; type: 'INSERT' | 'UPDATE' | 'DELETE' | 'STATUS'; text: string }[]
  >([]);
  const [reconnectTrigger, setReconnectTrigger] = useState<number>(0);

  // Server clock
  const [serverTimeStr, setServerTimeStr] = useState<string>('00:00:00');
  const [pyramidPlayersInPyramid, setPyramidPlayersInPyramid] = useState<string[]>([]);
  const [rareBossTimers, setRareBossTimers] = useState<RareBossTimerState[]>(() =>
    createDefaultRareBossTimers(Date.now())
  );
  const rareBossTimersRef = useRef<RareBossTimerState[]>(rareBossTimers);
  useEffect(() => {
    rareBossTimersRef.current = rareBossTimers;
  }, [rareBossTimers]);

  // Refs for stable 1-second timer loop without tearing down interval on player/map updates
  const realtimePlayersRef = useRef<RealtimePlayer[]>(realtimePlayers);
  useEffect(() => {
    realtimePlayersRef.current = realtimePlayers;
  }, [realtimePlayers]);

  const pyramidTierRef = useRef<number>(pyramidTier);
  useEffect(() => {
    pyramidTierRef.current = pyramidTier;
  }, [pyramidTier]);

  const lastRespawnTimeRef = useRef<number>(lastRespawnTime);
  useEffect(() => {
    lastRespawnTimeRef.current = lastRespawnTime;
  }, [lastRespawnTime]);

  const currentUserRef = useRef<string | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const heroRef = useRef<HeroState>(hero);
  useEffect(() => {
    heroRef.current = hero;
  }, [hero]);

  const equippedRef = useRef<EquippedGear>(equipped);
  useEffect(() => {
    equippedRef.current = equipped;
  }, [equipped]);

  const inventoryRef = useRef<GameItem[]>(inventory);
  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);

  const tradeProtocolRef = useRef<TradeProtocolEntry[]>(tradeProtocol);
  useEffect(() => {
    tradeProtocolRef.current = tradeProtocol;
  }, [tradeProtocol]);

  // Batching buffer for Supabase player updates (flushed every 5 seconds to reduce network traffic and timeouts)
  const pendingPlayerUpdatesRef = useRef<{
    nick: string;
    payload: Parameters<typeof updatePlayerInDatabase>[1];
  } | null>(null);

  const queuePlayerUpdate = useCallback(
    (nick: string, updates: Parameters<typeof updatePlayerInDatabase>[1]) => {
      if (!nick || !isProfileLoadedRef.current) return;
      const cleanUpdates: Record<string, any> = {};
      Object.entries(updates).forEach(([k, v]) => {
        if (v !== undefined) {
          cleanUpdates[k] = v;
        }
      });
      if (
        pendingPlayerUpdatesRef.current &&
        pendingPlayerUpdatesRef.current.nick.toLowerCase() === nick.toLowerCase()
      ) {
        pendingPlayerUpdatesRef.current.payload = {
          ...pendingPlayerUpdatesRef.current.payload,
          ...cleanUpdates
        };
      } else {
        pendingPlayerUpdatesRef.current = {
          nick,
          payload: { ...cleanUpdates }
        };
      }
    },
    []
  );

  const flushPlayerUpdates = useCallback(
    (
      overrideNick?: string | null,
      extraUpdates?: Parameters<typeof updatePlayerInDatabase>[1]
    ) => {
      if (!isProfileLoadedRef.current) return;
      const pending = pendingPlayerUpdatesRef.current;
      const targetNick = overrideNick || pending?.nick || currentUserRef.current;
      if (!targetNick) return;

      const cleanExtra: Record<string, any> = {};
      if (extraUpdates) {
        Object.entries(extraUpdates).forEach(([k, v]) => {
          if (v !== undefined) cleanExtra[k] = v;
        });
      }

      const isSelf =
        Boolean(currentUserRef.current) &&
        targetNick.trim().toLowerCase() === currentUserRef.current!.trim().toLowerCase();
      const curHero = heroRef.current;
      const canonicalTier = getPyramidTierForLevel(curHero.level || 1);

      const baseSelfPayload: Parameters<typeof updatePlayerInDatabase>[1] = isSelf
        ? {
            gold: curHero.gold,
            crystals: curHero.crystals,
            lvl: curHero.level,
            exp: curHero.exp,
            str: curHero.str,
            agi: curHero.agi,
            vit: curHero.vit,
            stat_points: curHero.statPoints,
            hp: curHero.hp,
            max_hp: curHero.maxHp,
            energy: curHero.energy,
            max_energy: curHero.maxEnergy,
            hp_potions: curHero.hpPotions,
            en_potions: curHero.enPotions,
            exp_potions: curHero.expPotions || 0,
            exp_elixir_until: curHero.expElixirUntil || 0,
            mobs_killed: curHero.mobsKilled || 0,
            mob_kills: curHero.mobsKilled || 0,
            total_gold_collected: curHero.totalGoldCollected || curHero.gold || 0,
            daily_login_day: curHero.dailyLoginDay ?? 0,
            daily_login_last_date: curHero.dailyLoginLastDate ?? '',
            bag_capacity: curHero.bagCapacity,
            sell_experience: curHero.sellExperience,
            is_premium: Boolean(
              curHero.isPremium && curHero.premiumUntil && curHero.premiumUntil > Date.now()
            ),
            premium_until: curHero.premiumUntil || 0,
            equipped: equippedRef.current,
            inventory: inventoryRef.current,
            trade_protocol: tradeProtocolRef.current,
            location: livePosRef.current.screen,
            pyramid_tier: canonicalTier,
            пирамидальный_уровень: canonicalTier,
            row: livePosRef.current.row,
            ряд: livePosRef.current.row,
            col: livePosRef.current.col,
            ц: livePosRef.current.col,
            avatar: curHero.avatar,
            owned_skin_ids: curHero.ownedSkinIds || [],
            owned_skin_expirations: curHero.ownedSkinExpirations || {},
            owned_skins: curHero.ownedSkins || [],
            active_skin_id: curHero.activeSkinId || null,
            ban_info: curHero.banInfo || null,
            is_admin: curHero.role === 'admin' || Number((curHero as any).is_admin) === 1 ? 1 : 0,
            last_seen: Date.now()
          }
        : {};

      const mergedPayload: Parameters<typeof updatePlayerInDatabase>[1] = {
        ...baseSelfPayload,
        ...(pending && pending.nick.toLowerCase() === targetNick.toLowerCase()
          ? pending.payload
          : {}),
        ...cleanExtra
      };
      pendingPlayerUpdatesRef.current = null;

      if (Object.keys(mergedPayload).length > 0) {
        updatePlayerInDatabase(targetNick, mergedPayload);
      }
    },
    []
  );

  const queueRealtimePlayerSync = useCallback(
    (player: Partial<RealtimePlayer> & { nick: string }) => {
      if (!player.nick || !isProfileLoadedRef.current) return;
      const curHero = heroRef.current;
      const isOnlineNext = player.isOnline !== undefined ? Boolean(player.isOnline) : true;
      const nowTs = Date.now();
      const updatePayload: Parameters<typeof updatePlayerInDatabase>[1] = {
        location: player.location,
        pyramid_tier: player.pyramidTier,
        пирамидальный_уровень: player.pyramidTier,
        row: player.row,
        ряд: player.row,
        col: player.col,
        ц: player.col,
        hp: player.hp ?? curHero.hp,
        max_hp: player.maxHp ?? curHero.maxHp,
        energy: curHero.energy,
        max_energy: curHero.maxEnergy,
        lvl: player.lvl ?? curHero.level,
        exp: player.exp ?? curHero.exp,
        gold: player.gold ?? curHero.gold,
        crystals: player.crystals ?? curHero.crystals,
        avatar: player.avatar ?? curHero.avatar,
        is_premium: player.isPremium ?? Boolean(curHero.isPremium && curHero.premiumUntil && curHero.premiumUntil > nowTs),
        premium_until: player.premiumUntil ?? (curHero.premiumUntil || 0),
        is_online: isOnlineNext,
        last_seen: nowTs
      };

      queuePlayerUpdate(player.nick, updatePayload);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('supabase:player_update', {
            detail: {
              new: {
                name: player.nick,
                nick: player.nick,
                lvl: player.lvl ?? curHero.level ?? 1,
                exp: player.exp ?? curHero.exp ?? 0,
                gold: player.gold ?? curHero.gold ?? 0,
                crystals: player.crystals ?? curHero.crystals ?? 0,
                hp: player.hp ?? curHero.hp ?? 250,
                max_hp: player.maxHp ?? curHero.maxHp ?? 250,
                energy: curHero.energy ?? 100,
                max_energy: curHero.maxEnergy ?? 100,
                avatar: player.avatar ?? curHero.avatar ?? '🧙‍♂️',
                location: player.location ?? 'city',
                pyramid_tier: player.pyramidTier ?? 1,
                пирамидальный_уровень: player.pyramidTier ?? 1,
                row: player.row ?? 9,
                ряд: player.row ?? 9,
                col: player.col ?? 4,
                ц: player.col ?? 4,
                is_premium: player.isPremium ?? Boolean(curHero.isPremium && curHero.premiumUntil && curHero.premiumUntil > nowTs),
                premium_until: player.premiumUntil ?? (curHero.premiumUntil || 0),
                is_online: isOnlineNext,
                last_seen: nowTs
              }
            }
          })
        );
      }
    },
    [queuePlayerUpdate]
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  }, []);

  // Active Ban & Restriction check helper
  const activeBanInfo = React.useMemo<PlayerBanInfo | null>(() => {
    const b = hero.banInfo;
    if (!b || !b.isBanned) return null;
    if (!b.isPermanent && b.until && b.until <= Date.now()) {
      return null;
    }
    return b;
  }, [hero.banInfo]);

  const checkBanRestriction = useCallback(
    (
      flagKey:
        | 'blockPyramid'
        | 'blockClanPyramid'
        | 'blockChat'
        | 'blockTradeAndAuction'
        | 'blockClans'
        | 'blockRoulette',
      actionLabel: string
    ): boolean => {
      const b = heroRef.current?.banInfo || hero.banInfo;
      if (!b || !b.isBanned) return false;
      if (!b.isPermanent && b.until && b.until <= Date.now()) return false;
      if (b[flagKey]) {
        const timeStr = b.isPermanent
          ? 'НАВСЕГДА'
          : b.until
          ? `до ${new Date(b.until).toLocaleString('ru-RU')}`
          : 'на время';
        showToast(
          `🚫 Ограничение бана (${timeStr}): Запрещено «${actionLabel}»! Причина: ${
            b.reason || 'Нарушение правил'
          }`
        );
        return true;
      }
      return false;
    },
    [hero.banInfo, showToast]
  );

  const addCombatLog = useCallback((text: string, type: CombatLogEntry['type']) => {
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setCombatLog((prev) => [
      {
        id: `clog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        time,
        text,
        type
      },
      ...prev.slice(0, 99)
    ]);
  }, []);

  // Unread incoming mail count or unclaimed mail gift count for current user
  const unreadMailCount = React.useMemo(() => {
    if (!currentUser) return 0;
    const myClean = currentUser.trim().toLowerCase();
    const claimedSet = new Set(
      Array.isArray(hero.claimedMailGiftIds) ? hero.claimedMailGiftIds : []
    );
    return mailMessages.filter((m) => {
      if (String(m.to || '').trim().toLowerCase() !== myClean) return false;
      const isUnread = !m.read;
      const hasUnclaimedGift =
        Boolean(m.gift) && !m.giftClaimed && (!m.id || !claimedSet.has(String(m.id)));
      return isUnread || hasUnclaimedGift;
    }).length;
  }, [mailMessages, currentUser, hero.claimedMailGiftIds]);

  // Subscribe to global Mail, World Chat & Roulette Winners Log from Supabase
  useEffect(() => {
    let mounted = true;
    fetchGlobalMailAndChatFromSupabase().then((state) => {
      if (!mounted || !state) return;
      if (Array.isArray(state.messages)) {
        setMailMessages(state.messages);
      }
      if (Array.isArray(state.wheelWinners)) {
        setWheelWinners(state.wheelWinners);
      }
      if (Array.isArray(state.chatMessages)) {
        setChatMessages((prev) => {
          const localOnly = prev.filter((c) => c.channel !== 'world' || c.id.startsWith('init_chat_'));
          const map = new Map<string, ChatMessage>();
          localOnly.forEach((c) => map.set(c.id, c));
          state.chatMessages.forEach((c) => map.set(c.id, c));
          return Array.from(map.values()).slice(-80);
        });
      }
    });

    const unsubMail = subscribeToGlobalMailAndChat((state) => {
      if (!mounted || !state) return;
      if (Array.isArray(state.messages)) {
        setMailMessages(state.messages);
      }
      if (Array.isArray(state.wheelWinners)) {
        setWheelWinners(state.wheelWinners);
      }
      if (Array.isArray(state.chatMessages)) {
        setChatMessages((prev) => {
          const localOnly = prev.filter((c) => c.channel !== 'world' || c.id.startsWith('init_chat_'));
          const map = new Map<string, ChatMessage>();
          localOnly.forEach((c) => map.set(c.id, c));
          state.chatMessages.forEach((c) => map.set(c.id, c));
          return Array.from(map.values()).slice(-80);
        });
      }
    });

    return () => {
      mounted = false;
      unsubMail();
    };
  }, []);

  // Recalculate gear + active character skin + active VIP bonuses
  const recalcGear = useCallback(
    (currentEquipped: EquippedGear, currentHero: HeroState) => {
      let dmg = 0;
      let hp = 0;
      let dodgeBonus = 0;
      let energyBonus = 0;
      let goldBonusPct = 0;
      let expBonusPct = 0;
      let str = 0;
      let agi = 0;
      let vit = 0;

      (Object.values(currentEquipped) as (GameItem | null)[]).forEach((it) => {
        if (it) {
          dmg += Number(it.dmg || 0);
          hp += Number(it.hp || 0);
          dodgeBonus += Number(it.dodgeBonus || 0);
          energyBonus += Number(it.energyBonus || 0);
          goldBonusPct += Number(it.goldBonusPct || 0);
          expBonusPct += Number(it.expBonusPct || 0);
          str += Number(it.str || 0);
          agi += Number(it.agi || 0);
          vit += Number(it.vit || 0);
        }
      });

      // Add active character skin bonuses
      const skinBonuses = getActiveSkinBonuses(currentHero.activeSkinId, undefined, currentHero.ownedSkins);
      dmg += Number(skinBonuses.dmgBonus || skinBonuses.dmg || 0);
      hp += Number(skinBonuses.hpBonus || skinBonuses.hp || 0);
      dodgeBonus += Number(skinBonuses.dodgeBonus || 0);
      energyBonus += Number(skinBonuses.energyBonus || 0);
      goldBonusPct += Number(skinBonuses.goldBonusPct || 0);
      expBonusPct += Number(skinBonuses.expBonusPct || 0);
      str += Number(skinBonuses.strBonus || skinBonuses.str || 0);
      agi += Number(skinBonuses.agiBonus || skinBonuses.agi || 0);
      vit += Number(skinBonuses.vitBonus || skinBonuses.vit || 0);

      // Add active VIP / Premium stat bonuses if VIP is active
      const premCfg = getPremiumConfig();
      const isVip = Boolean(
        premCfg.enabled &&
          currentHero.isPremium &&
          currentHero.premiumUntil &&
          currentHero.premiumUntil > Date.now()
      );
      if (isVip) {
        dmg += Number(premCfg.dmgBonus || 0);
        hp += Number(premCfg.hpBonus || 0);
        dodgeBonus += Number(premCfg.dodgeBonus || 0);
        energyBonus += Number(premCfg.energyBonus || 0);
        goldBonusPct += Number(premCfg.goldBonusPct || 0);
        expBonusPct += Number(premCfg.expBonusPct || 0);
        str += Number(premCfg.strBonus || 0);
        agi += Number(premCfg.agiBonus || 0);
        vit += Number(premCfg.vitBonus || 0);
      }

      const totalVit = Math.max(1, (Number(currentHero.vit) || 5) + vit);
      const computedMaxHp = getHeroTotalMaxHp({ ...currentHero, vit: totalVit }, hp);
      const computedMaxEnergy = getHeroTotalMaxEnergy(currentHero, energyBonus);

      const safeMaxHp = Math.max(10, Math.round(Number(computedMaxHp) || (100 + (Number(currentHero.level) || 1) * 20)));
      const rawCurHp = Number(currentHero.hp);
      const safeCurHp = Number.isFinite(rawCurHp) && rawCurHp >= 0 ? Math.min(rawCurHp, safeMaxHp) : safeMaxHp;

      const safeMaxEnergy = Math.max(50, Math.round(Number(computedMaxEnergy) || 100));
      const rawCurEnergy = Number(currentHero.energy);
      const safeCurEnergy = Number.isFinite(rawCurEnergy) && rawCurEnergy >= 0 ? Math.min(rawCurEnergy, safeMaxEnergy) : safeMaxEnergy;

      return {
        ...currentHero,
        gearDmg: dmg,
        gearHp: hp,
        gearDodge: dodgeBonus,
        gearEnergy: energyBonus,
        gearGoldPct: goldBonusPct,
        gearExpPct: expBonusPct,
        gearStr: str,
        gearAgi: agi,
        gearVit: vit,
        maxHp: safeMaxHp,
        maxEnergy: safeMaxEnergy,
        hp: safeCurHp,
        energy: safeCurEnergy
      };
    },
    []
  );

  // Sync shop catalog, character skins, feature flags, clans, and clan pyramid from Supabase on mount
  useEffect(() => {
    syncShopAndFlagsFromSupabase().then(({ catalog, flags, skins }) => {
      setShopCatalog(catalog);
      setFeatureFlags(flags);
      if (skins) setShopSkins(skins);
      setHero((prev) => recalcGear(equippedRef.current, prev));
    });
    syncClansFromSupabase().then(() => {
      syncClanPyramidFromSupabase();
    });
  }, [recalcGear]);

  // Sync player clan state when currentUser is active
  useEffect(() => {
    if (!currentUser) return;
    const clan =
      getPlayerClan(currentUser, hero.clanId) ||
      (hero.clanId ? ensureClanExistsFromHero(hero, currentUser) : undefined);
    if (clan) {
      setHero((prev) => {
        if (
          prev.clanId === clan.id &&
          prev.clanTag === clan.tag &&
          prev.clanName === clan.name &&
          prev.clanEmblem === clan.emblem
        ) {
          return prev;
        }
        return {
          ...prev,
          clanId: clan.id,
          clanTag: clan.tag,
          clanName: clan.name,
          clanEmblem: clan.emblem,
          clanRole:
            clan.members.find((m) => m.nick.toLowerCase() === currentUser.toLowerCase())?.role ||
            prev.clanRole ||
            'warrior'
        };
      });
    }
  }, [currentUser, hero.clanId]);

  // PERSISTENCE EFFECT: Save to in-memory storage ONLY after profile is loaded
  useEffect(() => {
    if (!isProfileLoadedRef.current) return;
    saveGameToStorage({
      hero,
      equipped,
      inventory,
      market,
      tradeProtocol,
      friends,
      pyramidMap,
      playerPos,
      savedMapTier: pyramidTier
    });
  }, [hero, equipped, inventory, market, tradeProtocol, friends, pyramidMap, playerPos, pyramidTier]);

  // Server clock interval
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setServerTimeStr(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Rent check timer & Natural HP/Energy Regen (timestamp-based so it works identically across tab switches and re-renders)
  const lastRegenTickAtRef = useRef<number>(Date.now());
  useEffect(() => {
    lastRegenTickAtRef.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();

      // 1. Check expired rents in inventory
      setInventory((prevInv) => {
        let changed = false;
        const updated = prevInv.map((item) => {
          if (item.rent && item.rent.until && now >= item.rent.until) {
            changed = true;
            const renter = item.rent.to;
            // Add protocol entry
            const protEntry: TradeProtocolEntry = {
              id: 'prot_' + now.toString(36) + '_' + Math.random().toString(36).substr(2, 4),
              timestamp: now,
              dateStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'rent_return',
              description: `⏳ Срок аренды предмета ${item.icon} ${item.name} игроком ${renter} истёк. Предмет снова доступен в сумке!`,
              itemSnapshot: { name: item.name, icon: item.icon, quality: item.quality },
              targetNick: renter
            };
            setTradeProtocol((p) => [protEntry, ...p]);
            showToast(`⏳ Аренда предмета ${item.name} завершена!`);

            return {
              ...item,
              rent: null
            };
          }
          return item;
        });
        if (changed) {
          inventoryRef.current = updated;
        }
        return changed ? updated : prevInv;
      });

      // 2. Check VIP expiration (12 hours exact) and Natural HP/Energy Regen
      setHero((prevHero) => {
        if (
          prevHero.isPremium &&
          (!prevHero.premiumUntil || now >= prevHero.premiumUntil)
        ) {
          showToast('👑 Срок действия VIP Премиума (12 часов) истёк. Бонусы отключены.');
          const expiredHero = { ...prevHero, isPremium: false, premiumUntil: undefined };
          heroRef.current = expiredHero;
          return expiredHero;
        }

        const isVipActive = Boolean(
          prevHero.isPremium && prevHero.premiumUntil && prevHero.premiumUntil > now
        );
        // Pause natural HP/Energy regen while inside the Clan Pyramid so lost HP never artificially regenerates in battle
        if (activeModalRef.current === 'clanPyramid') {
          lastRegenTickAtRef.current = now;
          return prevHero;
        }
        // Natural Regen: accelerated 2x when VIP Premium is active!
        const inPyramid = livePosRef.current.screen === 'pyramid';
        const regenRateSec = inPyramid ? (isVipActive ? 4 : 8) : (isVipActive ? 1 : 3);
        const regenAmount = isVipActive ? 2 : 1;

        const elapsedMs = Math.max(0, now - lastRegenTickAtRef.current);
        const stepMs = regenRateSec * 1000;

        if (elapsedMs >= stepMs) {
          const ticks = Math.floor(elapsedMs / stepMs);
          lastRegenTickAtRef.current += ticks * stepMs;

          let newHp = prevHero.hp;
          let newEnergy = prevHero.energy;
          const totalGain = ticks * regenAmount;
          if (newHp < prevHero.maxHp) {
            newHp = Math.min(prevHero.maxHp, newHp + totalGain);
          }
          if (newEnergy < prevHero.maxEnergy) {
            newEnergy = Math.min(prevHero.maxEnergy, newEnergy + totalGain);
          }

          if (newHp !== prevHero.hp || newEnergy !== prevHero.energy) {
            const nextRegenHero = { ...prevHero, hp: newHp, energy: newEnergy };
            heroRef.current = nextRegenHero;
            return nextRegenHero;
          }
        }
        return prevHero;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showToast]);

  // 1-minute pyramid respawn countdown timer
  const [respawnCountdown, setRespawnCountdown] = useState<number>(60);

  // Smoothly merges remote RareBossTimerState array with local timers so the countdown NEVER jumps backward or stalls
  const applyRemoteRareBossTimers = useCallback(
    (remoteTimers: RareBossTimerState[] | undefined, cells: PyramidCell[][]) => {
      if (!Array.isArray(remoteTimers) || remoteTimers.length === 0) return;
      const now = Date.now();
      const normalizedRemote = normalizeRareBossTimers(remoteTimers, cells, now);
      setRareBossTimers((prevLocal) => {
        const merged = normalizedRemote.map((rem) => {
          const loc = prevLocal.find((l) => l.id === rem.id);
          if (!loc) return rem;
          // If alive or frozen state matches and both are counting down on roughly the same cycle (within 15s),
          // keep the smooth local targetSpawnAt so the timer never jumps by a few seconds on network roundtrips
          if (
            !rem.isAliveOnMap &&
            !rem.isFrozenWaitingForCell &&
            !loc.isAliveOnMap &&
            !loc.isFrozenWaitingForCell &&
            loc.targetSpawnAt &&
            rem.targetSpawnAt &&
            Math.abs(rem.targetSpawnAt - loc.targetSpawnAt) < 15000
          ) {
            const stableTarget = Math.min(loc.targetSpawnAt, rem.targetSpawnAt);
            return {
              ...rem,
              targetSpawnAt: stableTarget,
              remainingMs: Math.max(0, stableTarget - now),
              lastTickAt: now
            };
          }
          return rem;
        });
        rareBossTimersRef.current = merged;
        return merged;
      });
    },
    []
  );

  // Helper to overlay all living players in this pyramid tier (both online and offline) onto shared cells from Supabase
  // while ensuring monsters NEVER occupy the same cell as any standing player, Exit [9,0], or Spawn [9,1]
  const mergePlayersOntoCells = useCallback(
    (baseCells: PyramidCell[][], playersList: RealtimePlayer[], targetTier: number): PyramidCell[][] => {
      if (!baseCells || !Array.isArray(baseCells) || baseCells.length === 0) return baseCells;
      const activeUser = currentUser || getCurrentUserNick();
      const newMap = sanitizePyramidCellsForStorage(baseCells);

      // Strictly keep the bottom-left Exit cell [9, 0] as 'exit' and the adjacent Spawn cell [9, 1] free of monsters
      const exitR = newMap.length - 1;
      if (newMap[exitR]?.[0]) {
        newMap[exitR][0] = { type: 'exit' };
      }
      if (newMap[exitR]?.[1] && newMap[exitR][1].type === 'mob') {
        newMap[exitR][1] = { type: 'empty' };
      }

      // Clear any monster on the local player's cell when in pyramid
      if (livePosRef.current.screen === 'pyramid' && Number(livePosRef.current.tier) === Number(targetTier)) {
        const myR = Math.max(0, Math.min(newMap.length - 1, livePosRef.current.row));
        const myC = Math.max(0, Math.min(newMap[myR].length - 1, livePosRef.current.col));
        if (newMap[myR]?.[myC]?.type === 'mob') {
          newMap[myR][myC] = myR === exitR && myC === 0 ? { type: 'exit' } : { type: 'empty' };
        }
      }

      if (playersList && playersList.length > 0) {
        playersList.forEach((p) => {
          if (activeUser && p.nick.toLowerCase() === activeUser.toLowerCase()) {
            return;
          }
          if (p.location === 'pyramid' && Number(p.pyramidTier) === Number(targetTier) && (p.hp ?? 100) > 0) {
            const targetR = Math.max(0, Math.min(newMap.length - 1, p.row));
            let targetC = Math.max(0, Math.min(newMap[targetR].length - 1, p.col));
            // Do not let any player cover the bottom-left Exit button [9, 0]; shift them to the adjacent spawn cell [9, 1]
            if (targetR === exitR && targetC === 0) {
              targetC = 1;
            }
            const targetCell = newMap[targetR][targetC];
            // Mobs must never occupy a cell where a player stands
            const cleanBaseCell: PyramidCell =
              targetCell.type === 'mob' ? { type: 'player' } : targetCell;
            newMap[targetR][targetC] = {
              ...cleanBaseCell,
              type: cleanBaseCell.type === 'empty' ? 'player' : cleanBaseCell.type,
              playerNick: p.nick,
              playerLvl: p.lvl,
              playerHp: p.hp,
              playerMaxHp: p.maxHp,
              playerAvatar: p.avatar || '🧙‍♂️',
              playerIsOnline: Boolean(p.isOnline)
            };
          }
        });
      }
      return newMap;
    },
    [currentUser]
  );

  // Load or generate shared deterministic pyramid tier from Supabase
  const generateNewPyramid = useCallback(
    (tier: number, customPos?: PlayerPosition, forceNewSeed: boolean = false) => {
      const safeTier = Math.max(1, Math.min(3, Number(tier) || 1));
      // Fixed spawn cell right next to the Exit button [ROWS_COUNT - 1, 1]
      const rawStartPos: PlayerPosition = customPos || {
        row: PYRAMID_SPAWN_POS.row,
        col: PYRAMID_SPAWN_POS.col
      };
      const startPos: PlayerPosition =
        rawStartPos.row === ROWS_COUNT - 1 && rawStartPos.col === 0
          ? { row: PYRAMID_SPAWN_POS.row, col: PYRAMID_SPAWN_POS.col }
          : rawStartPos;

      const occupiedCoords: { row: number; col: number }[] = [
        { row: PYRAMID_EXIT_POS.row, col: PYRAMID_EXIT_POS.col },
        { row: PYRAMID_SPAWN_POS.row, col: PYRAMID_SPAWN_POS.col },
        { row: startPos.row, col: startPos.col }
      ];
      realtimePlayersRef.current.forEach((p) => {
        if (p.location === 'pyramid' && Number(p.pyramidTier) === safeTier && (p.hp ?? 100) > 0) {
          occupiedCoords.push({ row: p.row, col: p.col });
        }
      });

      const fallbackSeed = forceNewSeed
        ? Math.floor(Date.now() / 1000) * 100 + safeTier
        : getCanonicalTierSeed(safeTier);
      pyramidSeedRef.current = fallbackSeed;

      const deterministicFallbackMap = generateDeterministicPyramidCells(
        safeTier,
        fallbackSeed,
        ROWS_COUNT,
        occupiedCoords
      );
      setPyramidMap((prev) => (prev && prev.length > 0 && !forceNewSeed ? prev : deterministicFallbackMap));
      setPlayerPos(startPos);
      setPyramidTier(safeTier);
      pyramidTierRef.current = safeTier;

      if (forceNewSeed) {
        const now = Date.now();
        setLastRespawnTime(now);
        lastRespawnTimeRef.current = now;
        setRespawnCountdown(60);
        savePyramidTierToSupabase(
          safeTier,
          deterministicFallbackMap,
          fallbackSeed,
          now,
          currentUser || 'admin',
          rareBossTimersRef.current
        ).then((savedState) => {
          pyramidSeedRef.current = savedState.seed;
          lastTierSyncAtRef.current = savedState.updatedAt;
          setPyramidMap((_cur) =>
            mergePlayersOntoCells(savedState.cells, realtimePlayersRef.current, safeTier)
          );
        });
      } else {
        fetchPyramidTierFromSupabase(safeTier).then((tierState) => {
          if (tierState && Array.isArray(tierState.cells) && tierState.cells.length > 0) {
            pyramidSeedRef.current = tierState.seed;
            lastTierSyncAtRef.current = tierState.updatedAt;
            const now = Date.now();
            const lastResp = tierState.lastRespawn > 0 ? tierState.lastRespawn : now;
            setLastRespawnTime(lastResp);
            lastRespawnTimeRef.current = lastResp;
            setRespawnCountdown(Math.max(1, 60 - Math.floor((now - lastResp) / 1000)));

            if (Array.isArray(tierState.rareBossTimers) && tierState.rareBossTimers.length > 0) {
              applyRemoteRareBossTimers(tierState.rareBossTimers, tierState.cells);
            }
            setPyramidMap(mergePlayersOntoCells(tierState.cells, realtimePlayersRef.current, safeTier));
          }
        });
      }
    },
    [currentUser, mergePlayersOntoCells, applyRemoteRareBossTimers]
  );

  // Subscribe to shared pyramid tier updates from Supabase so all players see identical monsters & sacks
  useEffect(() => {
    const unsubscribeTier = subscribeToPyramidTierRealtime((tierState: PyramidTierState) => {
      const activeTier = livePosRef.current.tier || pyramidTierRef.current;
      if (tierState.tier !== activeTier) return;
      if (tierState.updatedAt < lastTierSyncAtRef.current) return;

      lastTierSyncAtRef.current = tierState.updatedAt;
      pyramidSeedRef.current = tierState.seed;
      if (tierState.lastRespawn > 0) {
        setLastRespawnTime(tierState.lastRespawn);
        lastRespawnTimeRef.current = tierState.lastRespawn;
      }
      if (Array.isArray(tierState.rareBossTimers) && tierState.rareBossTimers.length > 0) {
        applyRemoteRareBossTimers(tierState.rareBossTimers, tierState.cells);
      }
      setPyramidMap((_prev) =>
        mergePlayersOntoCells(tierState.cells, realtimePlayersRef.current, activeTier)
      );
    });

    return () => {
      unsubscribeTier();
    };
  }, [mergePlayersOntoCells, applyRemoteRareBossTimers]);

  // Realtime helper: Log incoming Realtime events
  const addRealtimeLog = useCallback(
    (type: 'INSERT' | 'UPDATE' | 'DELETE' | 'STATUS', text: string) => {
      const timeStr = new Date().toLocaleTimeString();
      setRecentRealtimeEvents((prev) => [{ time: timeStr, type, text }, ...prev.slice(0, 49)]);
    },
    []
  );

  // Realtime helper: Remove a player from the pyramid map
  const removePlayerFromPyramidMap = useCallback((nick: string) => {
    setPyramidMap((currentMap) => {
      if (!currentMap || currentMap.length === 0) return currentMap;
      const nickLower = nick.toLowerCase();
      let changed = false;
      const newMap = currentMap.map((rowArr) =>
        rowArr.map((cell) => {
          if (cell.playerNick?.toLowerCase() === nickLower) {
            changed = true;
            return {
              ...cell,
              type: cell.type === 'player' ? ('empty' as const) : cell.type,
              playerNick: undefined,
              playerLvl: undefined,
              playerHp: undefined,
              playerMaxHp: undefined,
              playerAvatar: undefined,
              playerIsOnline: undefined
            };
          }
          return cell;
        })
      );
      return changed ? newMap : currentMap;
    });
  }, []);

  // Realtime helper: Refresh and render all living players currently in this pyramid tier (both online and offline) on the map
  const refreshAllPlayersOnPyramidMap = useCallback(
    (players: RealtimePlayer[]) => {
      const activeUser = currentUser || getCurrentUserNick();
      setPyramidMap((currentMap) => {
        if (!currentMap || !Array.isArray(currentMap) || currentMap.length === 0) return currentMap;

        let changed = false;

        // 1. Clear previous player info from all cells
        const newMap = currentMap.map((rowArr, rI) =>
          rowArr.map((cell, cI) => {
            // Ensure no monster is on the local player's cell
            if (
              livePosRef.current.screen === 'pyramid' &&
              rI === livePosRef.current.row &&
              cI === livePosRef.current.col &&
              cell.type === 'mob'
            ) {
              changed = true;
              return { type: 'empty' as const };
            }
            if (cell.playerNick || cell.type === 'player') {
              changed = true;
              return {
                ...cell,
                type: cell.type === 'player' ? 'empty' : cell.type,
                playerNick: undefined,
                playerLvl: undefined,
                playerHp: undefined,
                playerMaxHp: undefined,
                playerAvatar: undefined,
                playerIsOnline: undefined
              };
            }
            return cell;
          })
        );

        // 2. Place all living players (online AND offline) who are in this pyramid tier directly on their exact row/col coordinates
        if (players && players.length > 0) {
          players.forEach((p) => {
            if (activeUser && p.nick.toLowerCase() === activeUser.toLowerCase()) {
              return; // Skip current user
            }
            if (
              p.location === 'pyramid' &&
              Number(p.pyramidTier) === Number(pyramidTier) &&
              (p.hp ?? 100) > 0
            ) {
              const targetR = Math.max(0, Math.min(newMap.length - 1, p.row));
              const targetC = Math.max(0, Math.min(newMap[targetR].length - 1, p.col));

              const targetCell = newMap[targetR][targetC];
              // Mobs must never occupy a cell where a player stands
              const cleanBaseCell: PyramidCell =
                targetCell.type === 'mob' ? { type: 'player' } : targetCell;
              newMap[targetR][targetC] = {
                ...cleanBaseCell,
                type: cleanBaseCell.type === 'empty' ? 'player' : cleanBaseCell.type,
                playerNick: p.nick,
                playerLvl: p.lvl,
                playerHp: p.hp,
                playerMaxHp: p.maxHp,
                playerAvatar: p.avatar || '🧙‍♂️',
                playerIsOnline: Boolean(p.isOnline)
              };
              changed = true;
            }
          });
        }

        return changed ? newMap : currentMap;
      });
    },
    [currentUser, pyramidTier]
  );

  // Supabase Realtime Subscription Lifecycle
  useEffect(() => {
    let isSubscribed = true;

    // Sync custom monster configurations from Supabase first
    syncMonsterConfigsFromSupabase().catch(() => {});

    // Fetch initial shared pyramid tier map & players from Supabase (including offline catch-up across tiers 1, 2, 3)
    fetchPyramidTierFromSupabase(pyramidTier).then((tierState) => {
      if (!isSubscribed || !tierState) return;
      pyramidSeedRef.current = tierState.seed;
      lastTierSyncAtRef.current = tierState.updatedAt;
      if (tierState.lastRespawn > 0) {
        setLastRespawnTime(tierState.lastRespawn);
        lastRespawnTimeRef.current = tierState.lastRespawn;
      }
      if (Array.isArray(tierState.rareBossTimers) && tierState.rareBossTimers.length > 0) {
        applyRemoteRareBossTimers(tierState.rareBossTimers, tierState.cells);
      }
      setPyramidMap((_prev) =>
        mergePlayersOntoCells(tierState.cells, realtimePlayersRef.current, pyramidTier)
      );
    });

    // Also ensure other pyramid tiers (1..3) catch up offline mob spawns automatically
    [1, 2, 3].forEach((t) => {
      if (t !== pyramidTier) {
        fetchPyramidTierFromSupabase(t).catch(() => {});
      }
    });

    fetchInitialPlayers().then((players) => {
      if (!isSubscribed) return;
      if (players && players.length > 0) {
        setRealtimePlayers(players);
        const inPyramidNicks = players
          .filter((p) => p.location === 'pyramid' && (p.hp ?? 100) > 0)
          .map((p) => p.nick);
        if (inPyramidNicks.length > 0) {
          setPyramidPlayersInPyramid((prev) => Array.from(new Set([...prev, ...inPyramidNicks])));
          refreshAllPlayersOnPyramidMap(players);
        }
        addRealtimeLog('STATUS', `Загружено ${players.length} игроков из таблицы players`);
      }
    });

    // Subscribe to Postgres Changes: INSERT, UPDATE, DELETE
    const { unsubscribe } = subscribeToPlayersRealtime({
      onInsert: (player) => {
        if (!isSubscribed) return;
        addRealtimeLog(
          'INSERT',
          `Новый игрок: ${player.nick} (ур. ${player.lvl}, ${
            player.location === 'pyramid' ? `Пирамида [${player.row},${player.col}]` : 'Город'
          })`
        );

        setRealtimePlayers((prev) => {
          const filtered = prev.filter((p) => p.nick.toLowerCase() !== player.nick.toLowerCase());
          const updated = [player, ...filtered];
          if (player.location === 'pyramid' && (player.hp ?? 100) > 0) {
            refreshAllPlayersOnPyramidMap(updated);
          }
          return updated;
        });

        if (player.location === 'pyramid' && (player.hp ?? 100) > 0) {
          setPyramidPlayersInPyramid((prev) =>
            prev.includes(player.nick) ? prev : [...prev, player.nick]
          );
        }

        showToast(`🟢 Игрок ${player.nick} вошел в игру!`);
      },

      onUpdate: (player) => {
        if (!isSubscribed) return;
        addRealtimeLog(
          'UPDATE',
          `Обновление игрока: ${player.nick} [ур. ${player.lvl}, HP: ${player.hp}/${player.maxHp}, ${
            player.location === 'pyramid' ? `Пирамида [${player.row},${player.col}]` : 'Город'
          }]`
        );

        const activeUser = currentUser || getCurrentUserNick();
        // Check if the current player was killed in PvP by another player
        if (
          activeUser &&
          player.nick.toLowerCase() === activeUser.toLowerCase() &&
          player.wasKilledInPvp &&
          livePosRef.current.screen === 'pyramid'
        ) {
          const killer = player.killedBy || 'Соперник';
          const respawnTier = getPyramidTierForLevel(hero.level);
          const startPos = { row: PYRAMID_SPAWN_POS.row, col: PYRAMID_SPAWN_POS.col };
          livePosRef.current = {
            screen: 'city',
            tier: respawnTier,
            row: startPos.row,
            col: startPos.col
          };
          setScreen('city');
          setPyramidTier(respawnTier);
          setPlayerPos(startPos);
          setHero((prev) => {
            const nextDead = {
              ...prev,
              pyramidTier: respawnTier,
              hp: 0,
              energy: 0,
              deaths: prev.deaths + 1,
              goldInCurrentRun: 0
            };
            heroRef.current = nextDead;
            return nextDead;
          });
          updatePlayerInDatabase(activeUser, {
            was_killed_in_pvp: false,
            killed_by: null,
            hp: 0,
            energy: 0,
            location: 'city',
            pyramid_tier: respawnTier,
            пирамидальный_уровень: respawnTier,
            row: startPos.row,
            col: startPos.col,
            last_seen: Date.now()
          });
          showToast(
            `☠️ Вы были убиты игроком ${killer} в Пирамиде! Здоровье и энергия восстанавливаются в Городе (вход с 30⚡).`
          );
        }

        // Real-time external DB sync (ONLY triggered when external_sync_ts increases from Admin Panel or Player-to-Player transfer)
        if (
          activeUser &&
          player.nick.toLowerCase() === activeUser.toLowerCase() &&
          isProfileLoadedRef.current
        ) {
          const incomingExternalTs = Number(player.externalSyncTs || 0);
          if (incomingExternalTs > 0 && incomingExternalTs > lastAppliedExternalSyncTsRef.current) {
            lastAppliedExternalSyncTsRef.current = incomingExternalTs;

            const dbGold = player.gold;
            const dbCrystals = player.crystals;
            const dbLvl = player.lvl;
            const dbExp = player.exp;
            const dbPremUntil = player.premiumUntil ?? 0;

            lastSyncedFinancialsRef.current = {
              gold: dbGold ?? lastSyncedFinancialsRef.current.gold,
              crystals: dbCrystals ?? lastSyncedFinancialsRef.current.crystals,
              lvl: dbLvl ?? lastSyncedFinancialsRef.current.lvl,
              exp: dbExp ?? lastSyncedFinancialsRef.current.exp,
              premiumUntil: dbPremUntil,
              updatedAt: Date.now()
            };
            if (pendingPlayerUpdatesRef.current) {
              delete pendingPlayerUpdatesRef.current.payload.gold;
              delete pendingPlayerUpdatesRef.current.payload.crystals;
              delete pendingPlayerUpdatesRef.current.payload.lvl;
              delete pendingPlayerUpdatesRef.current.payload.exp;
              delete pendingPlayerUpdatesRef.current.payload.is_premium;
              delete pendingPlayerUpdatesRef.current.payload.premium_until;
            }
            const nextLvl = dbLvl !== undefined ? Math.max(1, dbLvl) : hero.level;
            const nextTier = getPyramidTierForLevel(nextLvl);
            setPyramidTier(nextTier);
            setHero((prev) => ({
              ...prev,
              gold: dbGold !== undefined ? dbGold : prev.gold,
              crystals: dbCrystals !== undefined ? dbCrystals : prev.crystals,
              level: dbLvl !== undefined ? dbLvl : prev.level,
              lvl: dbLvl !== undefined ? dbLvl : prev.lvl,
              exp: dbExp !== undefined ? dbExp : prev.exp,
              pyramidTier: nextTier,
              statPoints: player.statPoints !== undefined ? player.statPoints : prev.statPoints,
              str: player.str !== undefined ? player.str : prev.str,
              agi: player.agi !== undefined ? player.agi : prev.agi,
              vit: player.vit !== undefined ? player.vit : prev.vit,
              isPremium: dbPremUntil > Date.now(),
              premiumUntil: dbPremUntil > Date.now() ? dbPremUntil : undefined,
              vipUntil: dbPremUntil > Date.now() ? dbPremUntil : undefined,
              expPotions: player.expPotions !== undefined ? player.expPotions : prev.expPotions,
              expElixirUntil: player.expElixirUntil !== undefined ? player.expElixirUntil : prev.expElixirUntil,
              banInfo: player.banInfo !== undefined ? player.banInfo : prev.banInfo,
              ownedSkinIds: player.ownedSkinIds !== undefined ? player.ownedSkinIds : prev.ownedSkinIds,
              ownedSkinExpirations:
                player.ownedSkinExpirations !== undefined
                  ? player.ownedSkinExpirations
                  : prev.ownedSkinExpirations,
              ownedSkins:
                Array.isArray(player.ownedSkins) && player.ownedSkins.length > 0
                  ? player.ownedSkins
                  : prev.ownedSkins,
              activeSkinId: player.activeSkinId !== undefined ? player.activeSkinId : prev.activeSkinId,
              avatar: player.avatar !== undefined ? player.avatar : prev.avatar
            }));

            if (Array.isArray(player.tradeProtocol) && player.tradeProtocol.length > 0) {
              setTradeProtocol((prev) => {
                if (player.tradeProtocol!.length <= prev.length) return prev;
                const map = new Map<string, TradeProtocolEntry>();
                player.tradeProtocol!.forEach((e) => map.set(e.id, e));
                prev.forEach((e) => map.set(e.id, e));
                return Array.from(map.values())
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .slice(0, 100);
              });
            }

            if (Array.isArray(player.inventory) && player.inventory.length > 0) {
              setInventory((prev) => {
                if (player.inventory!.length <= prev.length) return prev;
                const map = new Map<string, GameItem>();
                player.inventory!.forEach((it) => map.set(it.id, it));
                prev.forEach((it) => map.set(it.id, it));
                return Array.from(map.values());
              });
            }
          }
        }

        // Update player data in memory — keep offline pyramid players on their cells!
        setRealtimePlayers((prev) => {
          const exists = prev.some((p) => p.nick.toLowerCase() === player.nick.toLowerCase());
          const updated = exists
            ? prev.map((p) =>
                p.nick.toLowerCase() === player.nick.toLowerCase() ? { ...p, ...player } : p
              )
            : [player, ...prev];
          refreshAllPlayersOnPyramidMap(updated);
          return updated;
        });

        // Keep player on pyramid map as long as they are in the pyramid and alive (even if offline!)
        if (player.location === 'pyramid' && (player.hp ?? 100) > 0) {
          setPyramidPlayersInPyramid((prev) =>
            prev.includes(player.nick) ? prev : [...prev, player.nick]
          );
        } else {
          setPyramidPlayersInPyramid((prev) =>
            prev.filter((n) => n.toLowerCase() !== player.nick.toLowerCase())
          );
          removePlayerFromPyramidMap(player.nick);
        }
      },

      onDelete: (oldRecord) => {
        if (!isSubscribed) return;
        const deletedNick =
          oldRecord?.nick ||
          oldRecord?.username ||
          (oldRecord?.id ? `ID #${oldRecord.id}` : 'Игрок');
        addRealtimeLog('DELETE', `Игрок удален: ${deletedNick}`);

        setRealtimePlayers((prev) => {
          const updated = prev.filter((p) => p.nick.toLowerCase() !== String(deletedNick).toLowerCase());
          refreshAllPlayersOnPyramidMap(updated);
          return updated;
        });
        setPyramidPlayersInPyramid((prev) =>
          prev.filter((n) => n.toLowerCase() !== String(deletedNick).toLowerCase())
        );
        removePlayerFromPyramidMap(String(deletedNick));

        showToast(`🚪 Игрок ${deletedNick} покинул игру.`);
      },

      onStatusChange: (status, err) => {
        if (!isSubscribed) return;
        setRealtimeStatus(status);
        setRealtimeStatusError(err);
        addRealtimeLog('STATUS', `Статус сокета: ${status}${err ? ` (${err})` : ''}`);
      },

      onTierUpdate: (tierState) => {
        if (!isSubscribed) return;
        const activeTier = livePosRef.current.tier || pyramidTierRef.current;
        if (tierState.tier !== activeTier) return;
        pyramidSeedRef.current = tierState.seed;
        lastTierSyncAtRef.current = tierState.updatedAt;
        if (tierState.lastRespawn > 0) {
          setLastRespawnTime(tierState.lastRespawn);
          lastRespawnTimeRef.current = tierState.lastRespawn;
        }
        if (Array.isArray(tierState.rareBossTimers) && tierState.rareBossTimers.length > 0) {
          applyRemoteRareBossTimers(tierState.rareBossTimers, tierState.cells);
        }
        setPyramidMap((_prev) =>
          mergePlayersOntoCells(tierState.cells, realtimePlayersRef.current, activeTier)
        );
      }
    });

    // Periodic polling backup to guarantee instant multiplayer visibility & shared map cells & external DB balance sync
    const pollInterval = setInterval(async () => {
      if (!isSubscribed) return;
      try {
        const players = await fetchInitialPlayers();
        if (players && players.length > 0) {
          setRealtimePlayers(players);
          refreshAllPlayersOnPyramidMap(players);

          const activeUser = currentUserRef.current || getCurrentUserNick();
          if (activeUser && isProfileLoadedRef.current) {
            const meInDb = players.find(
              (p) => p.nick.toLowerCase() === activeUser.toLowerCase()
            );
            const incomingExternalTs = Number(meInDb?.externalSyncTs || 0);
            if (
              meInDb &&
              incomingExternalTs > 0 &&
              incomingExternalTs > lastAppliedExternalSyncTsRef.current
            ) {
              lastAppliedExternalSyncTsRef.current = incomingExternalTs;
              const dbPremUntil = meInDb.premiumUntil ?? 0;

              lastSyncedFinancialsRef.current = {
                gold: meInDb.gold ?? lastSyncedFinancialsRef.current.gold,
                crystals: meInDb.crystals ?? lastSyncedFinancialsRef.current.crystals,
                lvl: meInDb.lvl ?? lastSyncedFinancialsRef.current.lvl,
                exp: meInDb.exp ?? lastSyncedFinancialsRef.current.exp,
                premiumUntil: dbPremUntil,
                updatedAt: Date.now()
              };
              if (pendingPlayerUpdatesRef.current) {
                delete pendingPlayerUpdatesRef.current.payload.gold;
                delete pendingPlayerUpdatesRef.current.payload.crystals;
                delete pendingPlayerUpdatesRef.current.payload.lvl;
                delete pendingPlayerUpdatesRef.current.payload.exp;
                delete pendingPlayerUpdatesRef.current.payload.is_premium;
                delete pendingPlayerUpdatesRef.current.payload.premium_until;
              }
              const nextLvl = meInDb.lvl !== undefined ? Math.max(1, meInDb.lvl) : 1;
              const nextTier = getPyramidTierForLevel(nextLvl);
              setPyramidTier(nextTier);
              setHero((prev) => ({
                ...prev,
                gold: meInDb.gold !== undefined ? meInDb.gold : prev.gold,
                crystals:
                  meInDb.crystals !== undefined ? meInDb.crystals : prev.crystals,
                level: meInDb.lvl !== undefined ? meInDb.lvl : prev.level,
                lvl: meInDb.lvl !== undefined ? meInDb.lvl : prev.lvl,
                exp: meInDb.exp !== undefined ? meInDb.exp : prev.exp,
                pyramidTier: nextTier,
                statPoints: meInDb.statPoints !== undefined ? meInDb.statPoints : prev.statPoints,
                str: meInDb.str !== undefined ? meInDb.str : prev.str,
                agi: meInDb.agi !== undefined ? meInDb.agi : prev.agi,
                vit: meInDb.vit !== undefined ? meInDb.vit : prev.vit,
                isPremium: dbPremUntil > Date.now(),
                premiumUntil: dbPremUntil > Date.now() ? dbPremUntil : undefined,
                vipUntil: dbPremUntil > Date.now() ? dbPremUntil : undefined,
                expPotions: meInDb.expPotions !== undefined ? meInDb.expPotions : prev.expPotions,
                expElixirUntil: meInDb.expElixirUntil !== undefined ? meInDb.expElixirUntil : prev.expElixirUntil,
                banInfo: meInDb.banInfo !== undefined ? meInDb.banInfo : prev.banInfo,
                ownedSkinIds: meInDb.ownedSkinIds !== undefined ? meInDb.ownedSkinIds : prev.ownedSkinIds,
                ownedSkinExpirations:
                  meInDb.ownedSkinExpirations !== undefined ? meInDb.ownedSkinExpirations : prev.ownedSkinExpirations,
                ownedSkins:
                  Array.isArray(meInDb.ownedSkins) && meInDb.ownedSkins.length > 0
                    ? meInDb.ownedSkins
                    : prev.ownedSkins,
                activeSkinId: meInDb.activeSkinId !== undefined ? meInDb.activeSkinId : prev.activeSkinId,
                avatar: meInDb.avatar !== undefined ? meInDb.avatar : prev.avatar
              }));

              if (Array.isArray(meInDb.tradeProtocol) && meInDb.tradeProtocol.length > 0) {
                setTradeProtocol((prev) => {
                  if (meInDb.tradeProtocol!.length <= prev.length) return prev;
                  const map = new Map<string, TradeProtocolEntry>();
                  meInDb.tradeProtocol!.forEach((e) => map.set(e.id, e));
                  prev.forEach((e) => map.set(e.id, e));
                  return Array.from(map.values())
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, 100);
                });
              }

              if (Array.isArray(meInDb.inventory) && meInDb.inventory.length > 0) {
                setInventory((prev) => {
                  if (meInDb.inventory!.length <= prev.length) return prev;
                  const map = new Map<string, GameItem>();
                  meInDb.inventory!.forEach((it) => map.set(it.id, it));
                  prev.forEach((it) => map.set(it.id, it));
                  return Array.from(map.values());
                });
              }
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
      unsubscribe();
    };
  }, [reconnectTrigger, refreshAllPlayersOnPyramidMap, removePlayerFromPyramidMap, addRealtimeLog, showToast, pyramidTier, mergePlayersOntoCells, applyRemoteRareBossTimers, currentUser]);

  useEffect(() => {
    applyCompensationBonusToAllPlayers();
  }, []);

  // Respawn monsters and sacks every 1 minute deterministically and sync with Supabase (including offline tiers)
  const respawnPyramidMonstersAndSacks = useCallback(() => {
    const now = Date.now();
    const activeTier = pyramidTierRef.current || 1;
    const nextSeed = Math.floor(now / 60000) * 100 + activeTier;
    pyramidSeedRef.current = nextSeed;

    const occupiedCoords: { row: number; col: number }[] = [
      { row: PYRAMID_EXIT_POS.row, col: PYRAMID_EXIT_POS.col },
      { row: PYRAMID_SPAWN_POS.row, col: PYRAMID_SPAWN_POS.col }
    ];
    if (livePosRef.current.screen === 'pyramid' && Number(livePosRef.current.tier) === activeTier) {
      occupiedCoords.push({ row: livePosRef.current.row, col: livePosRef.current.col });
    }
    realtimePlayersRef.current.forEach((p) => {
      if (p.location === 'pyramid' && Number(p.pyramidTier) === activeTier && (p.hp ?? 100) > 0) {
        occupiedCoords.push({ row: p.row, col: p.col });
      }
    });

    setPyramidMap((currentMap) => {
      const baseMap =
        currentMap && currentMap.length > 0
          ? currentMap
          : generateDeterministicPyramidCells(activeTier, nextSeed, ROWS_COUNT, occupiedCoords);
      const respawnedClean = respawnDeterministicPyramidCells(
        baseMap,
        activeTier,
        nextSeed,
        occupiedCoords,
        ROWS_COUNT
      );
      savePyramidTierToSupabase(
        activeTier,
        respawnedClean,
        nextSeed,
        now,
        currentUserRef.current || 'respawn',
        rareBossTimersRef.current
      );
      return mergePlayersOntoCells(respawnedClean, realtimePlayersRef.current, activeTier);
    });

    // Also keep the other pyramid tiers updated in the background so mobs spawn even when nobody is on those tiers
    [1, 2, 3].forEach((t) => {
      if (t !== activeTier) {
        fetchPyramidTierFromSupabase(t).catch(() => {});
      }
    });
  }, [mergePlayersOntoCells]);

  // Stable 1-second timer interval for smooth Boss Timers + 1-minute Mob Respawn (never interrupted by player polling)
  useEffect(() => {
    const tickTimersAndRespawns = () => {
      const now = Date.now();
      const activeTier = pyramidTierRef.current || 1;

      // 1. Update smooth 1-second countdown for regular mob & boss respawn
      const elapsedSinceRespawn = Math.max(0, now - lastRespawnTimeRef.current);
      const respawnSec = Math.max(10, Number(featureFlags.bossRespawnIntervalSec || 60));
      if (elapsedSinceRespawn >= respawnSec * 1000) {
        lastRespawnTimeRef.current = now;
        setLastRespawnTime(now);
        setRespawnCountdown(respawnSec);
        respawnPyramidMonstersAndSacks();
      } else {
        const nextSecLeft = Math.max(1, respawnSec - Math.floor(elapsedSinceRespawn / 1000));
        setRespawnCountdown((prev) => (prev !== nextSecLeft ? nextSecLeft : prev));
      }

      // 2. Smoothly tick Rare / Boss Mob Timers anchored to targetSpawnAt
      setPyramidMap((currentMap) => {
        if (!currentMap || currentMap.length === 0) return currentMap;

        const occupiedCoords: { row: number; col: number }[] = [
          { row: PYRAMID_EXIT_POS.row, col: PYRAMID_EXIT_POS.col },
          { row: PYRAMID_SPAWN_POS.row, col: PYRAMID_SPAWN_POS.col }
        ];
        if (livePosRef.current.screen === 'pyramid' && Number(livePosRef.current.tier) === activeTier) {
          occupiedCoords.push({ row: livePosRef.current.row, col: livePosRef.current.col });
        }
        realtimePlayersRef.current.forEach((p) => {
          if (p.location === 'pyramid' && Number(p.pyramidTier) === activeTier && (p.hp ?? 100) > 0) {
            occupiedCoords.push({ row: p.row, col: p.col });
          }
        });

        const freeEmptyCells = getFreeEmptyPyramidCells(currentMap, occupiedCoords, ROWS_COUNT);
        let mapChanged = false;
        let updatedMap = currentMap;

        const nextTimers = rareBossTimersRef.current.map((bTimer) => {
          // Check if this rare boss is currently alive on the map
          let existsOnMap = false;
          for (let r = 0; r < updatedMap.length; r++) {
            for (let c = 0; c < updatedMap[r].length; c++) {
              const cType = updatedMap[r][c]?.type;
              if ((cType === 'mob' || cType === 'sack') && updatedMap[r][c]?.rareBossId === bTimer.id) {
                existsOnMap = true;
                break;
              }
            }
            if (existsOnMap) break;
          }

          if (existsOnMap) {
            return {
              ...bTimer,
              remainingMs: 0,
              targetSpawnAt: now,
              isAliveOnMap: true,
              isFrozenWaitingForCell: false,
              lastTickAt: now
            };
          }

          // If it was marked alive on map but is no longer on the map (e.g. slain), restart its full cycle
          if (bTimer.isAliveOnMap && !existsOnMap) {
            return {
              ...bTimer,
              remainingMs: bTimer.intervalMs,
              targetSpawnAt: now + bTimer.intervalMs,
              isAliveOnMap: false,
              isFrozenWaitingForCell: false,
              lastTickAt: now
            };
          }

          const targetAt =
            bTimer.targetSpawnAt && bTimer.targetSpawnAt > 0
              ? bTimer.targetSpawnAt
              : now + Math.max(0, bTimer.remainingMs - 1000);

          const nextRemaining = bTimer.isFrozenWaitingForCell
            ? 0
            : Math.max(0, targetAt - now);

          if (nextRemaining <= 0) {
            // Timer reached 0: spawn rare boss if a free empty cell is available, otherwise freeze waiting for cell
            if (freeEmptyCells.length > 0) {
              const chosenCell = freeEmptyCells.pop()!;
              const rareMobCell = createRareBossMobCell(activeTier, bTimer.id);
              updatedMap = updatedMap.map((rowArr, rI) =>
                rowArr.map((cell, cI) =>
                  rI === chosenCell.r && cI === chosenCell.c ? rareMobCell : cell
                )
              );
              mapChanged = true;
              addCombatLog(
                `👑 На свободной клетке [ряд ${chosenCell.r}, кл. ${chosenCell.c}] появился редкий босс: ${bTimer.name}!`,
                'loot'
              );
              return {
                ...bTimer,
                remainingMs: 0,
                targetSpawnAt: now,
                isFrozenWaitingForCell: false,
                isAliveOnMap: true,
                lastTickAt: now
              };
            } else {
              return {
                ...bTimer,
                remainingMs: 0,
                targetSpawnAt: now,
                isFrozenWaitingForCell: true,
                isAliveOnMap: false,
                lastTickAt: now
              };
            }
          }

          return {
            ...bTimer,
            remainingMs: nextRemaining,
            targetSpawnAt: targetAt,
            isFrozenWaitingForCell: false,
            isAliveOnMap: false,
            lastTickAt: now
          };
        });

        rareBossTimersRef.current = nextTimers;
        setRareBossTimers(nextTimers);

        if (mapChanged) {
          savePyramidTierToSupabase(
            activeTier,
            updatedMap,
            pyramidSeedRef.current,
            lastRespawnTimeRef.current,
            currentUserRef.current || 'rare_boss_spawn',
            nextTimers
          );
          return mergePlayersOntoCells(updatedMap, realtimePlayersRef.current, activeTier);
        }

        return currentMap;
      });
    };

    const interval = setInterval(tickTimersAndRespawns, 1000);

    // When tab returns from background / offline mode, immediately catch up spawns
    const onVisChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPyramidTierFromSupabase(pyramidTierRef.current || 1).then((tierState) => {
          if (tierState && Array.isArray(tierState.cells) && tierState.cells.length > 0) {
            pyramidSeedRef.current = tierState.seed;
            lastTierSyncAtRef.current = tierState.updatedAt;
            if (tierState.lastRespawn > 0) {
              setLastRespawnTime(tierState.lastRespawn);
              lastRespawnTimeRef.current = tierState.lastRespawn;
            }
            if (Array.isArray(tierState.rareBossTimers)) {
              applyRemoteRareBossTimers(tierState.rareBossTimers, tierState.cells);
            }
            setPyramidMap(
              mergePlayersOntoCells(
                tierState.cells,
                realtimePlayersRef.current,
                pyramidTierRef.current || 1
              )
            );
          }
        });
      }
    };
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [respawnPyramidMonstersAndSacks, mergePlayersOntoCells, addCombatLog, applyRemoteRareBossTimers]);

  // Automatically keep pyramidTier strictly bound to hero.level (1-5 -> P1, 6-10 -> P2, 11-20 -> P3)
  useEffect(() => {
    const canonicalTier = getPyramidTierForLevel(hero.level);
    if (pyramidTier !== canonicalTier) {
      setPyramidTier(canonicalTier);
      pyramidTierRef.current = canonicalTier;
      livePosRef.current.tier = canonicalTier;
      if (screen === 'pyramid') {
        const entryPos = {
          row: PYRAMID_SPAWN_POS.row,
          col: PYRAMID_SPAWN_POS.col
        };
        generateNewPyramid(canonicalTier, entryPos, false);
        showToast(
          `🏛️ По вашему уровню (${hero.level} ур.) вам открыта Пирамида ${canonicalTier}!`
        );
      }
    }
  }, [hero.level, pyramidTier, screen, generateNewPyramid, showToast]);

  // Enter pyramid — blocked after death until the player has at least 30 energy!
  // Player ALWAYS enters the Pyramid matching their level (1-5 -> P1, 6-10 -> P2, 11-20 -> P3)
  const handleEnterPyramid = () => {
    if (checkBanRestriction('blockPyramid', 'Вход в Пирамиду и бои')) {
      return;
    }
    if (hero.hp <= 0) {
      showToast(
        '⛔ У вас 0❤️ здоровья! Подождите пару секунд или выпейте зелье жизни перед входом в Пирамиду.'
      );
      return;
    }
    if (hero.energy < 30) {
      showToast(
        `⛔ Вход в Пирамиду заблокирован! Накопите минимум 30⚡ энергии (сейчас ${hero.energy}/30⚡).`
      );
      return;
    }

    const targetTier = getPyramidTierForLevel(hero.level);
    setActiveModal(null);
    setScreen('pyramid');
    setPyramidTier(targetTier);
    setHero((prev) => ({ ...prev, goldInCurrentRun: 0, pyramidTier: targetTier }));
    const entryPos = {
      row: PYRAMID_SPAWN_POS.row,
      col: PYRAMID_SPAWN_POS.col
    };
    generateNewPyramid(targetTier, entryPos, false);
    livePosRef.current = {
      screen: 'pyramid',
      tier: targetTier,
      row: entryPos.row,
      col: entryPos.col
    };
    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        was_killed_in_pvp: false,
        killed_by: null,
        location: 'pyramid',
        pyramid_tier: targetTier,
        пирамидальный_уровень: targetTier,
        row: entryPos.row,
        ряд: entryPos.row,
        col: entryPos.col,
        ц: entryPos.col,
        is_online: true,
        last_seen: Date.now()
      });
      queueRealtimePlayerSync({
        nick: currentUser,
        location: 'pyramid',
        pyramidTier: targetTier,
        row: entryPos.row,
        col: entryPos.col,
        hp: hero.hp,
        maxHp: hero.maxHp,
        lvl: hero.level,
        avatar: hero.avatar || '🧙‍♂️',
        isOnline: true
      });
    }
    showToast(`🏛️ Вы вошли в Пирамиду ${targetTier} (для ${targetTier === 1 ? '1–5' : targetTier === 2 ? '6–10' : '11–20'} ур.)!`);
  };

  const handleExitToCity = (_isDeath: boolean = false) => {
    const citySpawnPos = {
      row: PYRAMID_SPAWN_POS.row,
      col: PYRAMID_SPAWN_POS.col
    };
    const curHero = heroRef.current;
    const targetTier = getPyramidTierForLevel(curHero.level);
    setScreen('city');
    setPyramidTier(targetTier);
    setPlayerPos(citySpawnPos);
    livePosRef.current = {
      ...livePosRef.current,
      screen: 'city',
      tier: targetTier,
      row: citySpawnPos.row,
      col: citySpawnPos.col
    };
    if (currentUser && isProfileLoadedRef.current) {
      flushPlayerUpdates(currentUser, {
        gold: curHero.gold,
        crystals: curHero.crystals,
        lvl: curHero.level,
        exp: curHero.exp,
        str: curHero.str,
        agi: curHero.agi,
        vit: curHero.vit,
        stat_points: curHero.statPoints,
        hp: curHero.hp,
        max_hp: curHero.maxHp,
        energy: curHero.energy,
        max_energy: curHero.maxEnergy,
        hp_potions: curHero.hpPotions,
        en_potions: curHero.enPotions,
        exp_potions: curHero.expPotions || 0,
        exp_elixir_until: curHero.expElixirUntil || 0,
        equipped: equippedRef.current,
        inventory: inventoryRef.current,
        trade_protocol: tradeProtocolRef.current,
        location: 'city',
        pyramid_tier: targetTier,
        пирамидальный_уровень: targetTier,
        row: citySpawnPos.row,
        ряд: citySpawnPos.row,
        col: citySpawnPos.col,
        ц: citySpawnPos.col,
        is_online: true,
        last_seen: Date.now()
      });
      queueRealtimePlayerSync({
        nick: currentUser,
        location: 'city',
        pyramidTier: targetTier,
        row: citySpawnPos.row,
        col: citySpawnPos.col,
        hp: curHero.hp,
        maxHp: curHero.maxHp,
        lvl: curHero.level,
        exp: curHero.exp,
        gold: curHero.gold,
        crystals: curHero.crystals,
        avatar: curHero.avatar || '🧙‍♂️',
        isOnline: true
      });
    }
    showToast('🏃‍♂️ Вы вернулись в город Луксор');
  };

  // Check level up: awards gold, crystals, statPoints according to balance, updates stats and Pyramid tier
  const checkLevelUp = (currentHero: HeroState) => {
    let h = { ...currentHero };
    let leveled = false;
    let totalAwardedGold = 0;
    let totalAwardedCrystals = 0;
    let totalAwardedStats = 0;

    while (h.level < MAX_LEVEL && h.exp >= (EXP_TABLE[h.level] || 9999999)) {
      const needed = EXP_TABLE[h.level] || 9999999;
      h.exp -= needed;
      h.level += 1;
      h.lvl = h.level;

      const reward = LEVEL_UP_REWARDS[h.level] || { gold: 30, crystals: 10, statPoints: 1 };
      h.gold += reward.gold;
      h.crystals += reward.crystals;
      h.statPoints += reward.statPoints;
      totalAwardedGold += reward.gold;
      totalAwardedCrystals += reward.crystals;
      totalAwardedStats += reward.statPoints;

      h.baseMaxHp = getHeroTotalMaxHp(h);
      h.maxHp = h.baseMaxHp;
      h.maxEnergy = getHeroTotalMaxEnergy(h);
      h.hp = h.maxHp;
      h.energy = h.maxEnergy;
      h.pyramidTier = getPyramidTierForLevel(h.level);
      leveled = true;
    }

    if (leveled) {
      playLevelUpSound();
      const newTier = getPyramidTierForLevel(h.level);
      showToast(
        `🆙 НОВЫЙ УРОВЕНЬ ${h.level} (🔺П${newTier})! Награда: +${totalAwardedGold} 🪙, +${totalAwardedCrystals} 💎, +${totalAwardedStats} стат! HP и ⚡ восстановлены!`
      );
      addCombatLog(
        `🆙 УРОВЕНЬ ${h.level} (Пирамида ${newTier})! Награда за уровень: +${totalAwardedGold} 🪙, +${totalAwardedCrystals} 💎, +${totalAwardedStats} стат. Здоровье и энергия полностью восстановлены!`,
        'kill'
      );
      const msgTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages((prev) => [
        ...prev,
        {
          id: 'lvl_' + Date.now(),
          time: msgTime,
          author: 'Система',
          text: `🎉 Игрок ${currentUser || 'Игрок'} достиг ${h.level} уровня (🔺Пирамида ${newTier})!`,
          isSystem: true,
          channel: 'world'
        }
      ]);
    }

    return h;
  };

  // Click pyramid block
  const handlePyramidBlockClick = (r: number, c: number) => {
    const rowDiff = Math.abs(r - playerPos.row);
    const colDiff = Math.abs(c - playerPos.col);

    if (rowDiff > 1 || colDiff > 1) {
      return; // Can only move to adjacent cells
    }

    const cell = pyramidMap[r][c];

    // 1. Exit tile in bottom-left corner [9, 0]: immediately exit to City
    if (cell.type === 'exit' || (r === ROWS_COUNT - 1 && c === 0)) {
      playStepSound();
      handleExitToCity();
      return;
    }

    const now = Date.now();
    if (now - lastMoveTime < MOVE_DELAY) {
      return; // Cooldown not ready
    }
    setLastMoveTime(now);

    // 2. Portal to next tier (strictly capped at Pyramid 3 and bound to level: 6+ for P2, 11+ for P3)
    if (cell.type === 'nextTier' || cell.type === 'portal') {
      if (pyramidTier >= 3) {
        showToast('👑 Вы уже находитесь в максимальной Пирамиде 3 (11–20 ур.)!');
        return;
      }
      const requiredLvl = pyramidTier === 1 ? 6 : 11;
      if (hero.level < requiredLvl) {
        showToast(
          `⛔ Врата запечатаны! Требуется ${requiredLvl}-й уровень для перехода в Пирамиду ${pyramidTier + 1} (у вас ${hero.level} ур.)`
        );
        return;
      }
      playLevelUpSound();
      const nextT = getPyramidTierForLevel(hero.level);
      const startPos = {
        row: PYRAMID_SPAWN_POS.row,
        col: PYRAMID_SPAWN_POS.col
      };
      showToast(`🌀 Вы переходите в Пирамиду ${nextT}!`);
      generateNewPyramid(nextT, startPos);
      setHero((prev) => ({ ...prev, pyramidTier: nextT }));
      livePosRef.current = {
        screen: 'pyramid',
        tier: nextT,
        row: startPos.row,
        col: startPos.col
      };
      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          location: 'pyramid',
          pyramid_tier: nextT,
          пирамидальный_уровень: nextT,
          row: startPos.row,
          ряд: startPos.row,
          col: startPos.col,
          ц: startPos.col,
          is_online: true,
          last_seen: Date.now()
        });
        queueRealtimePlayerSync({
          nick: currentUser,
          location: 'pyramid',
          pyramidTier: nextT,
          row: startPos.row,
          col: startPos.col,
          hp: hero.hp,
          maxHp: hero.maxHp,
          lvl: hero.level,
          avatar: hero.avatar || '🧙‍♂️',
          isOnline: true
        });
      }
      return;
    }

    // 3. PvP Attack on another player (online OR offline) standing on this cell in the Pyramid!
    const activeNickLower = (currentUser || '').trim().toLowerCase();
    const enemyOnCell = realtimePlayers.find(
      (p) =>
        p.location === 'pyramid' &&
        Number(p.pyramidTier) === Number(pyramidTier) &&
        Number(p.row) === r &&
        Number(p.col) === c &&
        (p.hp ?? 100) > 0 &&
        (!activeNickLower || p.nick.trim().toLowerCase() !== activeNickLower)
    );
    const hasEnemyPlayer = Boolean(
      enemyOnCell ||
        cell.type === 'player' ||
        (cell.playerNick &&
          (!activeNickLower || cell.playerNick.trim().toLowerCase() !== activeNickLower))
    );

    if (hasEnemyPlayer) {
      const enemyNick = enemyOnCell?.nick || cell.playerNick || 'Соперник';
      const enemyLvl = enemyOnCell?.lvl || cell.playerLvl || 1;
      const enemyCurrentHp = enemyOnCell?.hp ?? cell.playerHp ?? 100;
      const enemyMaxHp = enemyOnCell?.maxHp ?? cell.playerMaxHp ?? 100;
      const enemyIsOnline =
        enemyOnCell !== undefined
          ? Boolean(enemyOnCell.isOnline)
          : Boolean(cell.playerIsOnline ?? true);
      const energyCost = 3;

      if (hero.energy < energyCost) {
        addCombatLog(
          `⚡ Недостаточно энергии для атаки игрока ${enemyNick}! Требуется ${energyCost}⚡.`,
          'pvp'
        );
        return;
      }

      playAttackSound();
      const totalStr = hero.str + (hero.gearStr || 0);
      const playerDmg = 16 + hero.bonusDmg + (hero.gearDmg || 0) + totalStr * 2;
      const updatedEnemyHp = enemyCurrentHp - playerDmg;
      const nextEnergy = Math.max(0, hero.energy - energyCost);

      const popupId = 'dmg_' + Date.now();
      setDamagePopups((prev) => [
        ...prev,
        { id: popupId, row: r, col: c, amount: playerDmg, type: 'player', timestamp: Date.now() }
      ]);
      setTimeout(() => setDamagePopups((prev) => prev.filter((p) => p.id !== popupId)), 1000);

      if (updatedEnemyHp <= 0) {
        playLevelUpSound();
        const stolenGold = Math.floor(180 + Math.random() * 220);
        const now = Date.now();
        const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const citySpawnRow = ROWS_COUNT - 1;
        const citySpawnCol = Math.floor((ROWS_COUNT - 1) / 2);

        setHero((prev) => ({
          ...prev,
          energy: nextEnergy,
          gold: prev.gold + stolenGold,
          goldInCurrentRun: prev.goldInCurrentRun + stolenGold,
          pvpKills: prev.pvpKills + 1
        }));

        // Update killed player in Supabase: send them to the City with 0 HP and 0 energy so they regenerate naturally (both online & offline)
        updatePlayerInDatabase(enemyNick, {
          location: 'city',
          pyramid_tier: 1,
          пирамидальный_уровень: 1,
          row: citySpawnRow,
          ряд: citySpawnRow,
          col: citySpawnCol,
          ц: citySpawnCol,
          hp: 0,
          energy: 0,
          was_killed_in_pvp: true,
          killed_by: currentUser || 'Игрок',
          last_seen: Date.now()
        });

        setRealtimePlayers((prev) =>
          prev.map((p) =>
            p.nick.toLowerCase() === enemyNick.toLowerCase()
              ? {
                  ...p,
                  location: 'city',
                  pyramidTier: 1,
                  row: citySpawnRow,
                  col: citySpawnCol,
                  hp: 0,
                  wasKilledInPvp: true,
                  killedBy: currentUser || 'Игрок'
                }
              : p
          )
        );
        setPyramidPlayersInPyramid((prev) =>
          prev.filter((n) => n.toLowerCase() !== enemyNick.toLowerCase())
        );

        setTradeProtocol((prev) => [
          {
            id: 'pvp_' + now,
            timestamp: now,
            dateStr,
            type: 'gold_transfer',
            description: `⚔️ Победа в PvP над ${enemyNick}${
              !enemyIsOnline ? ' (оффлайн)' : ''
            }: конфисковано 50% ресурсов (+${stolenGold} 🪙)`,
            amount: stolenGold,
            targetNick: enemyNick
          },
          ...prev
        ]);

        const msgTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const pvpChatMsg: ChatMessage = {
          id: 'pvp_chat_' + Date.now(),
          time: msgTime,
          author: 'PvP Арена',
          text: `⚔️ [PvP] ${currentUser || 'Игрок'} убил игрока ${enemyNick}${
            !enemyIsOnline ? ' (оффлайн)' : ''
          } в Пирамиде! ${enemyNick} отправлен на возрождение в Город (+${stolenGold} 🪙)!`,
          isSystem: true,
          channel: 'world'
        };
        setChatMessages((prev) => [...prev, pvpChatMsg]);
        broadcastWorldChatMessageInSupabase(pvpChatMsg);

        addCombatLog(
          `⚔️ УБИЙСТВО ИГРОКА: Вы убили ${enemyNick}${
            !enemyIsOnline ? ' (оффлайн)' : ''
          } (урон: ${playerDmg}, -${energyCost}⚡)! Добыча: +${stolenGold} 🪙`,
          'pvp'
        );

        // Defeated player leaves a gold sack on the cell (unless it's the Exit or Spawn cell)
        const newMap = pyramidMap.map((rowArr, rI) =>
          rowArr.map((cCell, cI) => {
            if (rI === r && cI === c) {
              if (rI === PYRAMID_EXIT_POS.row && cI === PYRAMID_EXIT_POS.col) {
                return { type: 'exit' as const };
              }
              if (rI === PYRAMID_SPAWN_POS.row && cI === PYRAMID_SPAWN_POS.col) {
                return { type: 'empty' as const };
              }
              return { type: 'sack' as const, sackGold: stolenGold };
            }
            return cCell;
          })
        );
        setPyramidMap(newMap);
        savePyramidTierToSupabase(
          pyramidTier,
          newMap,
          pyramidSeedRef.current,
          lastRespawnTime,
          currentUser || 'player'
        );
      } else {
        // Persist enemy's reduced HP in Supabase so all players see it and it does not reset
        updatePlayerInDatabase(enemyNick, {
          hp: updatedEnemyHp
        });

        setRealtimePlayers((prev) =>
          prev.map((p) =>
            p.nick.toLowerCase() === enemyNick.toLowerCase()
              ? { ...p, hp: updatedEnemyHp }
              : p
          )
        );

        const totalAgi = hero.agi + (hero.gearAgi || 0);
        const dodgeChance = Math.min(40, totalAgi * 1);
        const dodgeRoll = Math.random() * 100;
        const enemyDmg = enemyLvl * 3 + Math.floor(Math.random() * 8);

        if (dodgeRoll < dodgeChance) {
          addCombatLog(
            `⚔️ Удар по игроку ${enemyNick}: -${playerDmg} HP (осталось ${updatedEnemyHp}/${enemyMaxHp} HP) [-${energyCost}⚡]. 💨 Вы уклонились от ответа!`,
            'pvp'
          );
          const nextHeroState = { ...heroRef.current, energy: nextEnergy };
          heroRef.current = nextHeroState;
          setHero(nextHeroState);
        } else {
          const newHp = Math.max(0, hero.hp - enemyDmg);
          const damagedHeroState = { ...heroRef.current, hp: newHp, energy: nextEnergy };
          heroRef.current = damagedHeroState;
          setHero(damagedHeroState);

          if (newHp <= 0) {
            const lostGold = Math.floor(heroRef.current.goldInCurrentRun * 0.5);
            const nextDeadHero: HeroState = {
              ...heroRef.current,
              deaths: heroRef.current.deaths + 1,
              gold: Math.max(0, heroRef.current.gold - lostGold),
              goldInCurrentRun: 0,
              hp: 0,
              energy: 0
            };
            heroRef.current = nextDeadHero;
            setHero(nextDeadHero);
            const msgTime = new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });
            const deathPvpMsg: ChatMessage = {
              id: 'death_pvp_' + Date.now(),
              time: msgTime,
              author: 'PvP Арена',
              text: `☠️ Игрок ${currentUser || 'Игрок'} пал в бою против ${enemyNick} в Пирамиде и потерял 50% добычи (-${lostGold} 🪙)!`,
              isSystem: true,
              channel: 'world'
            };
            setChatMessages((prev) => [...prev, deathPvpMsg]);
            broadcastWorldChatMessageInSupabase(deathPvpMsg);
            addCombatLog(
              `💀 Вы пали в PvP от руки ${enemyNick} и потеряли ${lostGold} 🪙! Возрождение в Городе (HP и ⚡ восстанавливаются).`,
              'pvp'
            );
            handleExitToCity(true);
            return;
          }
          addCombatLog(
            `⚔️ Удар по игроку ${enemyNick}: -${playerDmg} HP (осталось ${updatedEnemyHp}/${enemyMaxHp} HP) [-${energyCost}⚡]. Ответ: -${enemyDmg} HP`,
            'pvp'
          );
        }

        const newMap = pyramidMap.map((rowArr, rI) =>
          rowArr.map((cCell, cI) => {
            if (rI === r && cI === c) {
              return { ...cCell, playerHp: updatedEnemyHp };
            }
            return cCell;
          })
        );
        setPyramidMap(newMap);
      }
      return;
    }

    // 4. Combat Mob / Boss — 3 energy per hit, NO intrusive popups, logged in personal Combat Log!
    if (cell.type === 'mob') {
      const isBoss = Boolean(cell.isBoss);
      const energyCost = 3;

      if (hero.energy < energyCost) {
        addCombatLog(
          `⚡ Недостаточно энергии для удара! Нужно ${energyCost}⚡ (у вас ${hero.energy}⚡). Выпейте зелье энергии.`,
          'hit'
        );
        return;
      }

      playAttackSound();
      applyDurabilityLossOnHit();
      const playerDmg = getHeroTotalDamage(hero);
      const updatedMobHp = (cell.mobHp || 10) - playerDmg;
      const nextEnergy = Math.max(0, hero.energy - energyCost);
      const mobLevel = cell.mobLvl || 3;
      const mobTitle = cell.mobName || (isBoss ? 'Босс Пирамиды' : 'Монстр');

      if (updatedMobHp <= 0) {
        // Monster slain!
        playCoinSound();
        const mobCfg = findMonsterConfigByName(cell.mobName);

        // Gold drops according to balance & config:
        // P1: 6, 7, 20 | P2: 15, 20, 200 | P3: 25, 30, 200
        let goldReward = 0;
        if (mobCfg && mobCfg.goldMax >= mobCfg.goldMin && mobCfg.goldMax > 0) {
          goldReward = Math.floor(
            mobCfg.goldMin + Math.random() * (mobCfg.goldMax - mobCfg.goldMin + 1)
          );
        } else if (isBoss) {
          goldReward = pyramidTier === 1 ? 20 : 200;
        } else {
          goldReward = pyramidTier === 1 ? (mobLevel <= 2 ? 6 : 7) : pyramidTier === 2 ? (mobLevel <= 5 ? 15 : 20) : (mobLevel <= 10 ? 25 : 30);
        }
        if (hero.gearGoldPct && hero.gearGoldPct > 0) {
          goldReward = Math.round(goldReward * (1 + hero.gearGoldPct / 100));
        }

        // Exp drops according to balance & config:
        // P1: 5, 10, 15 | P2: 35, 45, 250 | P3: 60, 100, 200
        let baseExpReward =
          mobCfg && mobCfg.expReward > 0
            ? Math.round(mobCfg.expReward)
            : isBoss
            ? (pyramidTier === 1 ? 15 : pyramidTier === 2 ? 250 : 200)
            : (pyramidTier === 1 ? (mobLevel <= 2 ? 5 : 10) : pyramidTier === 2 ? (mobLevel <= 5 ? 35 : 45) : (mobLevel <= 10 ? 60 : 100));
        if (hero.gearExpPct && hero.gearExpPct > 0) {
          baseExpReward = Math.round(baseExpReward * (1 + hero.gearExpPct / 100));
        }

        const isExpElixirActive = Boolean(
          hero.expElixirUntil && hero.expElixirUntil > Date.now()
        );
        if (isExpElixirActive) {
          baseExpReward = Math.max(baseExpReward + 1, Math.round(baseExpReward * 1.25));
        }

        const premCfg = getPremiumConfig(featureFlags);
        const isVipActive = Boolean(
          premCfg.enabled && hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now()
        );
        // Experience gained includes gear + active skin + VIP expBonusPct!
        let expReward = baseExpReward;

        // Apply active ban penalties for Gold and EXP if the player is restricted
        const curBan = hero.banInfo;
        const isBanActive = Boolean(
          curBan && curBan.isBanned && (curBan.isPermanent || !curBan.until || curBan.until > Date.now())
        );
        const goldPenaltyPct = isBanActive ? Math.max(0, Math.min(100, Number(curBan?.goldPenaltyPct || 0))) : 0;
        const expPenaltyPct = isBanActive ? Math.max(0, Math.min(100, Number(curBan?.expPenaltyPct || 0))) : 0;
        if (goldPenaltyPct > 0) {
          goldReward = Math.max(0, Math.floor(goldReward * (1 - goldPenaltyPct / 100)));
        }
        if (expPenaltyPct > 0) {
          expReward = Math.max(0, Math.floor(expReward * (1 - expPenaltyPct / 100)));
        }

        const skinBagBonus = getActiveSkinBonuses(hero.activeSkinId, shopSkins).bagCapacityBonus;
        const effectiveBagCap = hero.bagCapacity + skinBagBonus + (isVipActive ? premCfg.bagCapacityBonus : 0);

        // Check for Crystal Boss / configured crystal reward
        const isCrystalBoss = cell.mobName?.includes('Кристальн') || (isBoss && Math.random() < 0.35);
        const crystalReward =
          mobCfg && mobCfg.crystalsReward > 0
            ? mobCfg.crystalsReward
            : isCrystalBoss
            ? 1
            : 0;

        // 50% chance to drop a potion (HP or Energy) on every monster kill!
        const isPotionDrop = Math.random() < 0.50;
        const droppedPotionType: 'hp' | 'en' | null = isPotionDrop
          ? Math.random() < 0.5
            ? 'hp'
            : 'en'
          : null;

        const updatedTotalGold = Number(hero.totalGoldCollected || hero.gold || 0) + goldReward;
        const updatedMobsKilled = (hero.mobsKilled || 0) + 1;
        let newHero: HeroState = {
          ...hero,
          energy: nextEnergy,
          exp: hero.exp + expReward,
          gold: hero.gold + goldReward,
          crystals: hero.crystals + crystalReward,
          hpPotions: droppedPotionType === 'hp' ? (hero.hpPotions || 0) + 1 : hero.hpPotions,
          enPotions: droppedPotionType === 'en' ? (hero.enPotions || 0) + 1 : hero.enPotions,
          goldInCurrentRun: hero.goldInCurrentRun + goldReward,
          totalGoldCollected: updatedTotalGold,
          mobsKilled: updatedMobsKilled,
          dailyQuests: hero.dailyQuests.map((q) => {
            if (q.type === 'kill_mobs' && !q.isCompleted) {
              const newProgress = Math.min(q.target, q.progress + 1);
              return { ...q, progress: newProgress, isCompleted: newProgress >= q.target };
            }
            return q;
          })
        };
        newHero = checkLevelUp(newHero);
        heroRef.current = newHero;
        lastSyncedFinancialsRef.current = {
          ...lastSyncedFinancialsRef.current,
          gold: newHero.gold,
          crystals: newHero.crystals,
          lvl: newHero.level,
          exp: newHero.exp,
          mobsKilled: updatedMobsKilled,
          totalGoldCollected: updatedTotalGold,
          updatedAt: Date.now()
        };
        setHero(newHero);

        // If player is in a clan, also grant Clan EXP for monster kills in the Pyramid
        const activeClan = getPlayerClan(currentUser || newHero.nick || 'Игрок', newHero.clanId);
        if (activeClan && expReward > 0) {
          addClanExp(activeClan.id, expReward, currentUser || newHero.nick || 'Игрок');
        }

        // Log kill in personal Combat Log (no popup!)
        addCombatLog(
          `💀 Убит ${isBoss ? '👑 ' : ''}${mobTitle} (${mobLevel} ур.)! Урон: -${playerDmg} HP [-${energyCost}⚡] ➔ +${goldReward} 🪙${goldPenaltyPct > 0 ? ` (-${goldPenaltyPct}% штраф бана)` : ''}, +${expReward} EXP${expPenaltyPct > 0 ? ` (-${expPenaltyPct}% штраф бана)` : ''}${isExpElixirActive ? ' (+25% ✨)' : ''}${isVipActive ? ' (👑 VIP)' : ''}${
            crystalReward > 0 ? `, +${crystalReward} 💎` : ''
          }`,
          'kill'
        );

        if (droppedPotionType === 'hp') {
          addCombatLog(
            `🧪 Дроп зелья (50%): Выпало Зелье здоровья (+1 🧪, всего ${newHero.hpPotions})!`,
            'potion'
          );
        } else if (droppedPotionType === 'en') {
          addCombatLog(
            `⚡ Дроп зелья (50%): Выпало Зелье энергии (+1 ⚡, всего ${newHero.enPotions})!`,
            'potion'
          );
        }

        // Экипировка больше не выпадает с монстров и боссов — получение исключительно в Магазине

        // Update map: mob is dead, tile becomes empty or spawns portal if apex boss
        const newMap = pyramidMap.map((rowArr, rI) =>
          rowArr.map((cCell, cI) => {
            if (rI === r && cI === c) {
              return rI === PYRAMID_EXIT_POS.row && cI === PYRAMID_EXIT_POS.col
                ? { type: 'exit' as const }
                : { type: 'empty' as const };
            }
            return cCell;
          })
        );

        // If this was a Rare Boss from the timer queue, restart its timer cycle anew with exact targetSpawnAt!
        let nextRareTimers = rareBossTimersRef.current;
        if (cell.rareBossId) {
          const killedBossId = cell.rareBossId;
          const nowTs = Date.now();
          nextRareTimers = rareBossTimersRef.current.map((b) =>
            b.id === killedBossId
              ? {
                  ...b,
                  remainingMs: b.intervalMs,
                  targetSpawnAt: nowTs + b.intervalMs,
                  isAliveOnMap: false,
                  isFrozenWaitingForCell: false,
                  lastTickAt: nowTs
                }
              : b
          );
          rareBossTimersRef.current = nextRareTimers;
          setRareBossTimers(nextRareTimers);
          addCombatLog(
            `⏳ Таймер редкого босса «${mobTitle}» запущен заново!`,
            'kill'
          );
        }

        if (isBoss && !cell.rareBossId) {
          // Убираем старые порталы и открываем строго 1 портал после победы над единственным боссом пирамиды
          for (let rr = 0; rr < newMap.length; rr++) {
            for (let cc = 0; cc < newMap[rr].length; cc++) {
              if (newMap[rr][cc].type === 'nextTier' || newMap[rr][cc].type === 'portal') {
                newMap[rr][cc] = { type: 'empty' };
              }
            }
          }
          const pr = Math.min(r + 1, ROWS_COUNT - 1);
          const pc = Math.min(c, newMap[pr].length - 1);
          if (
            !(pr === PYRAMID_EXIT_POS.row && pc === PYRAMID_EXIT_POS.col) &&
            !(pr === PYRAMID_SPAWN_POS.row && pc === PYRAMID_SPAWN_POS.col)
          ) {
            newMap[pr][pc] = { type: 'nextTier' };
          }
          addCombatLog('🌀 Босс повержен! Открылся портал на следующий ярус Пирамиды!', 'kill');
        }

        setPyramidMap(newMap);
        savePyramidTierToSupabase(
          pyramidTier,
          newMap,
          pyramidSeedRef.current,
          lastRespawnTime,
          currentUser || 'player',
          nextRareTimers
        );
        setPlayerPos({ row: r, col: c });
        livePosRef.current = {
          screen: 'pyramid',
          tier: pyramidTier,
          row: r,
          col: c
        };
        if (currentUser) {
          queueRealtimePlayerSync({
            nick: currentUser,
            row: r,
            col: c,
            pyramidTier,
            location: 'pyramid',
            hp: newHero.hp,
            maxHp: newHero.maxHp,
            lvl: newHero.level,
            exp: newHero.exp,
            gold: newHero.gold,
            crystals: newHero.crystals,
            mobsKilled: updatedMobsKilled,
            totalGoldCollected: updatedTotalGold,
            avatar: newHero.avatar || '🧙‍♂️',
            isOnline: true
          });
          flushPlayerUpdates(currentUser, {
            mobs_killed: updatedMobsKilled,
            mob_kills: updatedMobsKilled,
            total_gold_collected: updatedTotalGold,
            gold: newHero.gold,
            exp: newHero.exp,
            lvl: newHero.level
          });
        }
      } else {
        // Monster counterattacks!
        const mobCfg = findMonsterConfigByName(cell.mobName);
        const mobDmg = Number(cell.mobDmg || (mobCfg ? mobCfg.dmg : isBoss ? (pyramidTier === 1 ? 80 : pyramidTier === 2 ? 150 : 250) : (pyramidTier === 1 ? 20 : pyramidTier === 2 ? 40 : 70)));
        const dodgeChance = getHeroTotalDodge(hero);
        const dodgeRoll = Math.random() * 100;

        if (dodgeRoll < dodgeChance) {
          addCombatLog(
            `⚔️ Вы нанесли ${playerDmg} урона ${mobTitle} (${mobLevel} ур.) [HP: ${updatedMobHp}/${
              cell.mobMaxHp || 10
            }] (-${energyCost}⚡). 💨 Вы уклонились от удара (${Math.round(dodgeChance)}%)!`,
            'hit'
          );
          const dodgedHero = { ...heroRef.current, energy: nextEnergy };
          heroRef.current = dodgedHero;
          setHero(dodgedHero);
        } else {
          applyDurabilityLossOnHit();
          const newHp = Math.max(0, hero.hp - mobDmg);
          const hitHero = { ...heroRef.current, hp: newHp, energy: nextEnergy };
          heroRef.current = hitHero;
          setHero(hitHero);

          if (newHp <= 0) {
            const msgTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const lossPercent = 0.3 + Math.random() * 0.2; // 30-50%
            const goldLost = Math.floor(heroRef.current.goldInCurrentRun * lossPercent);

            const nextDeadHero: HeroState = {
              ...heroRef.current,
              deaths: heroRef.current.deaths + 1,
              hp: 0,
              energy: 0,
              gold: Math.max(0, heroRef.current.gold - goldLost),
              goldInCurrentRun: 0
            };
            heroRef.current = nextDeadHero;
            setHero(nextDeadHero);

            const deathMsg: ChatMessage = {
              id: 'death_' + Date.now(),
              time: msgTime,
              author: 'Система',
              text: `☠️ Игрок ${currentUser || 'Игрок'} погиб в Пирамиде и потерял ${goldLost} золота!`,
              isSystem: true,
              channel: 'world'
            };
            setChatMessages((prev) => [...prev, deathMsg]);
            broadcastWorldChatMessageInSupabase(deathMsg);
            addCombatLog(
              `☠️ Вы погибли от удара ${mobTitle} (-${mobDmg} HP)! Потеряно ${goldLost} 🪙. Возрождение в Городе (HP и ⚡ восстанавливаются).`,
              'damage_taken'
            );
            handleExitToCity(true);
            return;
          }

          addCombatLog(
            `⚔️ Вы нанесли ${playerDmg} урона ${mobTitle} (${mobLevel} ур.) [HP: ${updatedMobHp}/${
              cell.mobMaxHp || 10
            }] (-${energyCost}⚡). 💥 Ответ монстра: -${mobDmg} HP`,
            'hit'
          );
        }

        // Update mob HP on map
        const newMap = pyramidMap.map((rowArr, rI) =>
          rowArr.map((cCell, cI) => {
            if (rI === r && cI === c) {
              return { ...cCell, mobHp: updatedMobHp };
            }
            return cCell;
          })
        );
        setPyramidMap(newMap);
        savePyramidTierToSupabase(
          pyramidTier,
          newMap,
          pyramidSeedRef.current,
          lastRespawnTime,
          currentUser || 'player'
        );
      }
      return;
    }

    // 5. Sack tile (Мешочек с золотом или Тайник кристаллов) — 1 energy per step
    if (cell.type === 'sack') {
      if (hero.energy < 1) {
        showToast('⚡ Недостаточно энергии для шага! Нужно 1⚡. Выпейте зелье энергии.');
        return;
      }
      setHero((prev) => ({ ...prev, energy: Math.max(0, prev.energy - 1) }));
      playStepSound();
      setPlayerPos({ row: r, col: c });
      livePosRef.current = {
        screen: 'pyramid',
        tier: pyramidTier,
        row: r,
        col: c
      };
      if (currentUser) {
        queueRealtimePlayerSync({
          nick: currentUser,
          row: r,
          col: c,
          pyramidTier,
          location: 'pyramid',
          hp: hero.hp,
          maxHp: hero.maxHp,
          lvl: hero.level,
          exp: hero.exp,
          gold: hero.gold,
          crystals: hero.crystals,
          avatar: hero.avatar || '🧙‍♂️',
          isOnline: true
        });
      }
      handlePickUpSack(r, c);
      return;
    }

    // 6. Normal empty step — 1 energy per step
    if (hero.energy < 1) {
      showToast('⚡ Недостаточно энергии для перемещения! Нужно 1⚡. Выпейте зелье энергии.');
      return;
    }
    setHero((prev) => ({ ...prev, energy: Math.max(0, prev.energy - 1) }));
    playStepSound();
    setPlayerPos({ row: r, col: c });
    livePosRef.current = {
      screen: 'pyramid',
      tier: pyramidTier,
      row: r,
      col: c
    };
    if (currentUser) {
      queueRealtimePlayerSync({
        nick: currentUser,
        row: r,
        col: c,
        pyramidTier,
        location: 'pyramid',
        hp: hero.hp,
        maxHp: hero.maxHp,
        lvl: hero.level,
        exp: hero.exp,
        gold: hero.gold,
        crystals: hero.crystals,
        avatar: hero.avatar || '🧙‍♂️',
        isOnline: true
      });
    }
  };

  // Check if player is on a sack of gold or crystal cache
  const activeSackAdjacent = React.useMemo(() => {
    if (!pyramidMap || pyramidMap.length === 0) return null;

    // Check directly under player
    const under = pyramidMap[playerPos.row]?.[playerPos.col];
    if (under?.type === 'sack') {
      return {
        row: playerPos.row,
        col: playerPos.col,
        gold: under.sackGold || 5,
        crystals: under.sackCrystals || 0,
        rareBossId: under.rareBossId
      };
    }
    return null;
  }, [pyramidMap, playerPos]);

  // Pick up gold sack (1-10 gold) or crystal cache (+1 crystal)
  const handlePickUpSack = (r: number, c: number) => {
    const cell = pyramidMap[r]?.[c];
    if (!cell || cell.type !== 'sack') return;

    if (cell.sackCrystals || cell.rareBossId === 'crystal') {
      const crystalsFound = cell.sackCrystals || 1;
      playCoinSound();
      const nextCrystals = heroRef.current.crystals + crystalsFound;
      heroRef.current = {
        ...heroRef.current,
        crystals: nextCrystals
      };
      setHero((prev) => ({
        ...prev,
        crystals: prev.crystals + crystalsFound
      }));
      if (currentUser && isProfileLoadedRef.current) {
        flushPlayerUpdates(currentUser, {
          crystals: nextCrystals,
          gold: heroRef.current.gold,
          lvl: heroRef.current.level,
          exp: heroRef.current.exp
        });
      }

      // Restart rare boss timer cycle for crystal boss
      let nextRareTimers = rareBossTimersRef.current;
      if (cell.rareBossId) {
        const bossId = cell.rareBossId;
        const nowTs = Date.now();
        nextRareTimers = rareBossTimersRef.current.map((b) =>
          b.id === bossId
            ? {
                ...b,
                remainingMs: b.intervalMs,
                targetSpawnAt: nowTs + b.intervalMs,
                isAliveOnMap: false,
                isFrozenWaitingForCell: false,
                lastTickAt: nowTs
              }
            : b
        );
        rareBossTimersRef.current = nextRareTimers;
        setRareBossTimers(nextRareTimers);
      }

      const newMap = pyramidMap.map((rowArr, rI) =>
        rowArr.map((cCell, cI) => {
          if (rI === r && cI === c) {
            return { type: 'empty' as const };
          }
          return cCell;
        })
      );
      setPyramidMap(newMap);
      savePyramidTierToSupabase(
        pyramidTier,
        newMap,
        pyramidSeedRef.current,
        lastRespawnTime,
        currentUser || 'player',
        nextRareTimers
      );

      showToast(`💎 Вы подобрали Тайник Кристаллов (+${crystalsFound} 💎)! Тайник вернется по таймеру возрождения.`);
      return;
    }

    const goldFound = cell.sackGold || 5;
    playCoinSound();

    const nextGold = heroRef.current.gold + goldFound;
    const nextTotalGold = (heroRef.current.totalGoldCollected || heroRef.current.gold || 0) + goldFound;
    heroRef.current = {
      ...heroRef.current,
      gold: nextGold,
      goldInCurrentRun: heroRef.current.goldInCurrentRun + goldFound,
      totalGoldCollected: nextTotalGold
    };
    setHero((prev) => ({
      ...prev,
      gold: prev.gold + goldFound,
      goldInCurrentRun: prev.goldInCurrentRun + goldFound,
      totalGoldCollected: (prev.totalGoldCollected || prev.gold || 0) + goldFound
    }));
    if (currentUser && isProfileLoadedRef.current) {
      flushPlayerUpdates(currentUser, {
        gold: nextGold,
        total_gold_collected: nextTotalGold,
        crystals: heroRef.current.crystals,
        lvl: heroRef.current.level,
        exp: heroRef.current.exp
      });
    }

    const newMap = pyramidMap.map((rowArr, rI) =>
      rowArr.map((cCell, cI) => {
        if (rI === r && cI === c) {
          return { type: 'empty' as const };
        }
        return cCell;
      })
    );
    setPyramidMap(newMap);
    savePyramidTierToSupabase(
      pyramidTier,
      newMap,
      pyramidSeedRef.current,
      lastRespawnTime,
      currentUser || 'player'
    );

    showToast(`💰 Вы подобрали мешочек с золотом (+${goldFound} 🪙)!`);
  };

  // Potions & Elixirs usage
  const handleUsePotion = (type: 'hp' | 'en' | 'exp') => {
    const curHero = heroRef.current || hero;
    if (type === 'hp') {
      const curHpPotions = Number(curHero.hpPotions || 0);
      if (curHpPotions <= 0) {
        showToast('❌ Зелья жизни закончились!');
        return;
      }
      playLootSound();
      const nextHpPotions = Math.max(0, curHpPotions - 1);
      const nextHp = Math.min(curHero.maxHp, curHero.hp + 50);
      const updatedHero = {
        ...curHero,
        hpPotions: nextHpPotions,
        hp: nextHp
      };
      heroRef.current = updatedHero;
      setHero(updatedHero);
      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          hp_potions: nextHpPotions,
          hp: nextHp
        });
      }
      showToast('❤️ Выпито Зелье Жизни (+50 HP)');
    } else if (type === 'en') {
      const curEnPotions = Number(curHero.enPotions || 0);
      if (curEnPotions <= 0) {
        showToast('❌ Зелья энергии закончились!');
        return;
      }
      playLootSound();
      const nextEnPotions = Math.max(0, curEnPotions - 1);
      const nextEnergy = Math.min(curHero.maxEnergy, curHero.energy + 20);
      const updatedHero = {
        ...curHero,
        enPotions: nextEnPotions,
        energy: nextEnergy
      };
      heroRef.current = updatedHero;
      setHero(updatedHero);
      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          en_potions: nextEnPotions,
          energy: nextEnergy
        });
      }
      showToast('⚡ Выпито Зелье Энергии (+20)');
    } else if (type === 'exp') {
      const curExpPotions = Number(curHero.expPotions || 0);
      if (curExpPotions <= 0) {
        showToast('❌ Эликсиры опыта закончились! Купите в Магазине или Аукционе за 3 💎');
        return;
      }
      playLevelUpSound();
      const now = Date.now();
      const nextCount = Math.max(0, curExpPotions - 1);
      const baseUntil = curHero.expElixirUntil && curHero.expElixirUntil > now ? curHero.expElixirUntil : now;
      const nextUntil = baseUntil + 30 * 60 * 1000; // 30 minutes
      const updatedHero = {
        ...curHero,
        expPotions: nextCount,
        expElixirUntil: nextUntil
      };
      heroRef.current = updatedHero;
      setHero(updatedHero);
      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          exp_potions: nextCount,
          exp_elixir_until: nextUntil
        });
      }
      showToast('✨ Выпит Эликсир Опыта! (+25% к опыту на 30 минут)');
    }
  };

  // ================= DURABILITY & SHOP MECHANICS =================

  // 50% chance to lose 1 durability on hit. If reaches 0, auto-unequip to bag!
  const applyDurabilityLossOnHit = () => {
    if (!featureFlags.durabilityEnabled) return;
    if (Math.random() >= 0.5) return; // 50% chance

    const slots = (Object.keys(equipped) as ItemSlot[]).filter((s) => equipped[s] !== null);
    if (slots.length === 0) return;

    // Pick a random equipped slot so any piece of gear can take damage and break
    const targetSlot = slots[Math.floor(Math.random() * slots.length)];
    const item = equipped[targetSlot];
    if (!item) return;

    const maxDur = Math.max(1, Number(item.maxDurability ?? getItemDefaultMaxDurability(item.lvl)));
    const curDur = Math.max(0, Math.min(maxDur, Number(item.durability ?? maxDur)));
    const newDur = Math.max(0, curDur - 1);

    if (newDur <= 0) {
      // Automatic unequip to bag when durability reaches 0
      const brokenItem: GameItem = {
        ...item,
        durability: 0,
        maxDurability: maxDur
      };
      const nextEquipped = {
        ...equippedRef.current,
        [targetSlot]: null
      };
      const nextInv = [brokenItem, ...inventoryRef.current];
      const nextHero = recalcGear(nextEquipped, heroRef.current);
      equippedRef.current = nextEquipped;
      inventoryRef.current = nextInv;
      heroRef.current = nextHero;
      setEquipped(nextEquipped);
      setInventory(nextInv);
      setHero(nextHero);
      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          equipped: nextEquipped,
          inventory: nextInv,
          hp: nextHero.hp,
          max_hp: nextHero.maxHp,
          energy: nextHero.energy,
          max_energy: nextHero.maxEnergy
        });
      }
      addCombatLog(
        `⚠️ Снаряжение «${item.name}» сломалось (0/${maxDur}) и перемещено в сумку для ремонта!`,
        'loot'
      );
      showToast(`⚠️ «${item.name}» сломался и снят в сумку!`);
    } else {
      const updatedItem: GameItem = {
        ...item,
        durability: newDur,
        maxDurability: maxDur
      };
      const nextEq = {
        ...equippedRef.current,
        [targetSlot]: updatedItem
      };
      equippedRef.current = nextEq;
      setEquipped(nextEq);
    }
  };

  // Repair item in bag (Cost 10 gold, max durability drops by 1)
  const handleRepairItem = (item: GameItem) => {
    const curHero = heroRef.current || hero;
    if (curHero.gold < REPAIR_COST_GOLD) {
      showToast(`❌ Недостаточно золота для ремонта! Требуется ${REPAIR_COST_GOLD} 🪙`);
      return;
    }
    const maxDur = Math.max(1, Number(item.maxDurability ?? getItemDefaultMaxDurability(item.lvl)));
    if (maxDur <= 1) {
      showToast('❌ Предмет сломан окончательно (0/1). Ремонт невозможен, только продажа!');
      return;
    }
    const newMaxDur = maxDur - 1;
    const newCurDur = newMaxDur;
    const nextGold = Math.max(0, curHero.gold - REPAIR_COST_GOLD);
    const nextHero = {
      ...curHero,
      gold: nextGold
    };
    const nextInv = (inventoryRef.current || inventory).map((it) =>
      it.id === item.id
        ? {
            ...it,
            maxDurability: newMaxDur,
            durability: newCurDur
          }
        : it
    );

    heroRef.current = nextHero;
    inventoryRef.current = nextInv;
    setHero(nextHero);
    setInventory(nextInv);

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        gold: nextGold,
        inventory: nextInv
      });
    }

    playLevelUpSound();
    showToast(`🔨 Предмет «${item.name}» отремонтирован (-${REPAIR_COST_GOLD} 🪙)! Прочность: ${newCurDur}/${newMaxDur}`);
  };

  // Buy item from equipment shop
  const handleBuyShopItem = (template: ShopItemTemplate) => {
    const curHero = heroRef.current || hero;
    const curInv = inventoryRef.current || inventory;
    const itemPrice = Math.max(0, Number(template.price || 0));
    const curGold = Number(curHero.gold || 0);

    if (curGold < itemPrice) {
      showToast(`❌ Недостаточно золота! Требуется ${itemPrice} 🪙 (у вас ${curGold} 🪙).`);
      return;
    }
    const isVip = Boolean(curHero.isPremium && curHero.premiumUntil && curHero.premiumUntil > Date.now());
    const effectiveBagCap = Math.max(20, Number(curHero.bagCapacity || 100)) + (isVip ? 50 : 0);
    if (curInv.length >= effectiveBagCap) {
      showToast('🎒 Сумка заполнена! Освободите место для нового предмета.');
      return;
    }

    const newItem = createGameItemFromShopItem(template);
    const newGold = Math.max(0, curGold - itemPrice);
    const nextInv = [newItem, ...curInv];
    const nextHero = {
      ...curHero,
      gold: newGold
    };

    heroRef.current = nextHero;
    inventoryRef.current = nextInv;
    lastSyncedFinancialsRef.current = {
      ...lastSyncedFinancialsRef.current,
      gold: newGold,
      updatedAt: Date.now()
    };

    setHero(nextHero);
    setInventory(nextInv);

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        gold: newGold,
        inventory: nextInv
      });
    }

    playCoinSound();
    showToast(`🛒 Куплено: ${template.icon} «${template.name}» (-${itemPrice} 🪙)!`);
  };

  // Buy character skin from Shop
  const handleBuySkin = (skin: CharacterSkinTemplate) => {
    const curHero = heroRef.current || hero;
    if ((curHero.level || 1) < (skin.lvl || 1)) {
      showToast(`⛔ Требуется ${skin.lvl}-й уровень для покупки скина «${skin.name}»!`);
      return;
    }
    const owned = Array.isArray(curHero.ownedSkinIds) ? curHero.ownedSkinIds : [];
    if (owned.includes(skin.id)) {
      showToast(`ℹ️ Скин «${skin.name}» уже куплен в вашей коллекции!`);
      return;
    }

    const currency = skin.currency || 'crystals';
    const costCrystals = currency === 'crystals' ? Math.max(0, Number(skin.priceCrystals || 0)) : 0;
    const costGold = currency === 'gold' ? Math.max(0, Number(skin.priceGold || 0)) : 0;

    if (currency === 'crystals' && (curHero.crystals || 0) < costCrystals) {
      showToast(`❌ Недостаточно кристаллов! Требуется ${costCrystals} 💎`);
      return;
    }
    if (currency === 'gold' && (curHero.gold || 0) < costGold) {
      showToast(`❌ Недостаточно золота! Требуется ${costGold} 🪙`);
      return;
    }

    const nextGold = Math.max(0, (curHero.gold || 0) - costGold);
    const nextCrystals = Math.max(0, (curHero.crystals || 0) - costCrystals);
    const nextOwned = Array.from(new Set([...owned, skin.id]));
    const curOwnedSkins = Array.isArray(curHero.ownedSkins) ? curHero.ownedSkins : [];
    const nextOwnedSkins = [skin, ...curOwnedSkins.filter((s) => s && s.id !== skin.id)];

    const rawUpdated: HeroState = {
      ...curHero,
      gold: nextGold,
      crystals: nextCrystals,
      ownedSkinIds: nextOwned,
      ownedSkins: nextOwnedSkins,
      activeSkinId: skin.id,
      avatar: skin.icon
    };
    const nextHero = recalcGear(equippedRef.current, rawUpdated);

    heroRef.current = nextHero;
    lastSyncedFinancialsRef.current = {
      ...lastSyncedFinancialsRef.current,
      gold: nextGold,
      crystals: nextCrystals,
      updatedAt: Date.now()
    };
    setHero(nextHero);

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        gold: nextGold,
        crystals: nextCrystals,
        owned_skin_ids: nextOwned,
        owned_skins: nextOwnedSkins,
        active_skin_id: skin.id,
        avatar: skin.icon,
        hp: nextHero.hp,
        max_hp: nextHero.maxHp,
        energy: nextHero.energy,
        max_energy: nextHero.maxEnergy
      });
      queueRealtimePlayerSync({
        nick: currentUser,
        location: screen,
        pyramidTier,
        row: playerPos.row,
        col: playerPos.col,
        hp: nextHero.hp,
        maxHp: nextHero.maxHp,
        lvl: nextHero.level,
        avatar: skin.icon,
        isOnline: true
      });
    }

    playLevelUpSound();
    showToast(
      `🎨 Куплен и надет скин «${skin.name}»! Бонусы: ${formatSkinBonusesText(skin)}`
    );
  };

  // Equip or unequip character skin
  const handleEquipSkin = (skinOrId: CharacterSkinTemplate | string | null) => {
    const curHero = heroRef.current || hero;
    const resolvedPlayerSkins = resolvePlayerOwnedSkins(
      curHero.ownedSkinIds,
      curHero.ownedSkinExpirations,
      shopSkins,
      curHero.ownedSkins,
      curHero.activeSkinId,
      curHero.avatar
    );
    let skin: CharacterSkinTemplate | null = null;
    if (typeof skinOrId === 'string') {
      skin =
        shopSkins.find((s) => s.id === skinOrId) ||
        resolvedPlayerSkins.find((s) => s.id === skinOrId) ||
        null;
    } else {
      skin = skinOrId;
    }
    if (!skin) {
      const defaultAvatar =
        curHero.role === 'admin' || Number((curHero as any).is_admin) === 1 ? '👑' : '🧙‍♂️';
      const rawUpdated: HeroState = {
        ...curHero,
        activeSkinId: null,
        avatar: defaultAvatar
      };
      const nextHero = recalcGear(equippedRef.current, rawUpdated);
      heroRef.current = nextHero;
      setHero(nextHero);

      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          active_skin_id: null,
          avatar: defaultAvatar,
          hp: nextHero.hp,
          max_hp: nextHero.maxHp,
          energy: nextHero.energy,
          max_energy: nextHero.maxEnergy
        });
        queueRealtimePlayerSync({
          nick: currentUser,
          location: screen,
          pyramidTier,
          row: playerPos.row,
          col: playerPos.col,
          hp: nextHero.hp,
          maxHp: nextHero.maxHp,
          lvl: nextHero.level,
          avatar: defaultAvatar,
          isOnline: true
        });
      }
      showToast('👤 Скин снят, установлен стандартный облик.');
      return;
    }

    const owned = Array.isArray(curHero.ownedSkinIds) ? curHero.ownedSkinIds : [];
    const isOwnedInResolved = resolvedPlayerSkins.some((s) => s.id === skin!.id);
    if (!owned.includes(skin.id) && !isOwnedInResolved) {
      showToast('❌ Сначала купите этот скин в магазине!');
      return;
    }

    const skinAvatar = skin.avatarUrl || skin.icon;
    const rawUpdated: HeroState = {
      ...curHero,
      activeSkinId: skin.id,
      avatar: skinAvatar
    };
    const nextHero = recalcGear(equippedRef.current, rawUpdated);
    heroRef.current = nextHero;
    setHero(nextHero);

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        active_skin_id: skin.id,
        avatar: skinAvatar,
        hp: nextHero.hp,
        max_hp: nextHero.maxHp,
        energy: nextHero.energy,
        max_energy: nextHero.maxEnergy
      });
      queueRealtimePlayerSync({
        nick: currentUser,
        location: screen,
        pyramidTier,
        row: playerPos.row,
        col: playerPos.col,
        hp: nextHero.hp,
        maxHp: nextHero.maxHp,
        lvl: nextHero.level,
        avatar: skin.icon,
        isOnline: true
      });
    }

    playLootSound();
    showToast(`🎨 Надет скин «${skin.name}»! Активны бонусы: ${formatSkinBonusesText(skin)}`);
  };

  // ================= ITEM INTERACTIONS =================

  // 1. НАДЕТЬ (EQUIP)
  const handleEquipItem = (itemId: string) => {
    const curInv = inventoryRef.current || inventory;
    const curEquipped = equippedRef.current || equipped;
    const curHero = heroRef.current || hero;

    const itemIndex = curInv.findIndex((it) => it.id === itemId);
    if (itemIndex < 0) return;
    const item = curInv[itemIndex];

    if (item.rent) {
      showToast('⛔ Предмет находится в аренде! Его нельзя надеть.');
      return;
    }

    if (item.lvl > curHero.level) {
      showToast(`⛔ Требуется ${item.lvl} уровень! (У вас ${curHero.level})`);
      return;
    }

    const maxDur = Math.max(1, Number(item.maxDurability ?? getItemDefaultMaxDurability(item.lvl)));
    const curDur = Math.max(0, Math.min(maxDur, Number(item.durability ?? maxDur)));
    if (maxDur <= 1 && curDur <= 0) {
      showToast('⛔ Предмет сломан окончательно (0/1)! Его нельзя надеть, только продать.');
      return;
    }
    if (curDur <= 0) {
      showToast('⛔ Предмет сломан (0 прочности)! Сначала отремонтируйте его в сумке.');
      return;
    }

    const slot = item.slot;
    const oldEquipped = curEquipped[slot];

    // Swap equipped
    const newEquipped = {
      ...curEquipped,
      [slot]: item
    };

    // Update inventory: remove newly equipped, add old back if existed
    const newInventory = [...curInv];
    newInventory.splice(itemIndex, 1);
    if (oldEquipped) {
      newInventory.push(oldEquipped);
    }

    // Recalculate stats
    const updatedHero = recalcGear(newEquipped, curHero);

    equippedRef.current = newEquipped;
    inventoryRef.current = newInventory;
    heroRef.current = updatedHero;

    setEquipped(newEquipped);
    setInventory(newInventory);
    setHero(updatedHero);

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        equipped: newEquipped,
        inventory: newInventory,
        hp: updatedHero.hp,
        max_hp: updatedHero.maxHp,
        energy: updatedHero.energy,
        max_energy: updatedHero.maxEnergy
      });
    }

    playLootSound();
    showToast(`✅ Надето: ${formatItemIconForText(item.icon)} ${item.name}`);
  };

  // 2. СНЯТЬ (UNEQUIP)
  const handleUnequipItem = (slot: ItemSlot) => {
    const curInv = inventoryRef.current || inventory;
    const curEquipped = equippedRef.current || equipped;
    const curHero = heroRef.current || hero;

    const item = curEquipped[slot];
    if (!item) return;

    const isVip = Boolean(curHero.isPremium && curHero.premiumUntil && curHero.premiumUntil > Date.now());
    const effectiveBagCap = curHero.bagCapacity + (isVip ? 50 : 0);

    if (curInv.length >= effectiveBagCap) {
      showToast('🎒 Сумка заполнена! Освободите место, чтобы снять предмет.');
      return;
    }

    const newEquipped = {
      ...curEquipped,
      [slot]: null
    };

    const newInventory = [item, ...curInv];
    const updatedHero = recalcGear(newEquipped, curHero);

    equippedRef.current = newEquipped;
    inventoryRef.current = newInventory;
    heroRef.current = updatedHero;

    setEquipped(newEquipped);
    setInventory(newInventory);
    setHero(updatedHero);

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        equipped: newEquipped,
        inventory: newInventory,
        hp: updatedHero.hp,
        max_hp: updatedHero.maxHp,
        energy: updatedHero.energy,
        max_energy: updatedHero.maxEnergy
      });
    }

    showToast(`Снято в сумку: ${formatItemIconForText(item.icon)} ${item.name}`);
  };

  // 3. ПЕРЕДАТЬ ПО НИКУ (TRANSFER)
  const handleConfirmTransfer = (itemId: string, targetNick: string) => {
    if (checkBanRestriction('blockTradeAndAuction', 'Передача предметов и торговля')) {
      return;
    }
    const itemIndex = inventory.findIndex((it) => it.id === itemId);
    if (itemIndex < 0) return;
    const item = inventory[itemIndex];

    if (!canTransferCustomItem(item)) {
      showToast('🔒 Это созданное оружие привязано к вам и не может быть передано!');
      return;
    }

    const newInventory = [...inventory];
    newInventory.splice(itemIndex, 1);
    setInventory(newInventory);

    const now = Date.now();
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const iconTxt = formatItemIconForText(item.icon);

    // Record in Trade Protocol
    const protEntry: TradeProtocolEntry = {
      id: 'prot_' + now.toString(36) + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: now,
      dateStr,
      type: 'transfer_out',
      description: `📦 Передача: Предмет ${iconTxt} ${item.name} передан игроку ${targetNick}`,
      itemSnapshot: { name: item.name, icon: item.icon, quality: item.quality },
      targetNick
    };
    setTradeProtocol((prev) => [protEntry, ...prev]);

    // Deliver item & protocol entry to recipient in Supabase
    transferItemBetweenPlayersInSupabase(currentUser || 'Игрок', targetNick, item);

    // Send to World Chat
    const transferMsg: ChatMessage = {
      id: 'msg_tr_' + now,
      time: dateStr,
      author: 'Лог',
      text: `📦 ${currentUser || 'Игрок'} передал ${iconTxt} ${item.name} игроку ${targetNick}`,
      channel: 'world',
      isSystem: true
    };
    setChatMessages((prev) => [...prev, transferMsg]);
    broadcastWorldChatMessageInSupabase(transferMsg);

    playLootSound();
    showToast(`📦 Предмет ${item.name} отправлен игроку ${targetNick}!`);
  };

  // 4. СДАТЬ В АРЕНДУ (RENT OUT)
  const handleConfirmRent = (
    itemId: string,
    targetNick: string,
    hours: number,
    price: number
  ) => {
    const itemIndex = inventory.findIndex((it) => it.id === itemId);
    if (itemIndex < 0) return;
    const item = inventory[itemIndex];

    const now = Date.now();
    const until = now + hours * 3600000;
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedItem: GameItem = {
      ...item,
      rent: {
        to: targetNick,
        hours,
        price,
        startTime: now,
        until
      }
    };

    const newInventory = [...inventory];
    newInventory[itemIndex] = updatedItem;
    setInventory(newInventory);

    // Instant rental fee
    setHero((prev) => ({
      ...prev,
      gold: prev.gold + price
    }));

    // Trade protocol
    const protEntry: TradeProtocolEntry = {
      id: 'prot_rent_' + now.toString(36) + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: now,
      dateStr,
      type: 'rent_out',
      description: `🤝 Аренда: ${item.icon} ${item.name} сдан в аренду игроку ${targetNick} на ${hours} ч. Получено +${price} 🪙`,
      itemSnapshot: { name: item.name, icon: item.icon, quality: item.quality },
      targetNick,
      amount: price
    };
    setTradeProtocol((prev) => [protEntry, ...prev]);

    // World chat
    setChatMessages((prev) => [
      ...prev,
      {
        id: 'msg_rent_' + now,
        time: dateStr,
        author: 'Лог',
        text: `🤝 ${currentUser || 'Игрок'} сдал в аренду ${item.icon} ${item.name} игроку ${targetNick} на ${hours}ч (+${price}🪙)`,
        channel: 'world'
      }
    ]);

    playCoinSound();
    showToast(`🤝 Аренда оформлена: +${price} 🪙 на баланс!`);
  };

  // Return rent early
  const handleReturnRentEarly = (item: GameItem) => {
    const itemIndex = inventory.findIndex((it) => it.id === item.id);
    if (itemIndex < 0) return;

    const renter = item.rent?.to || 'Арендатор';
    const updatedItem: GameItem = {
      ...item,
      rent: null
    };

    const newInventory = [...inventory];
    newInventory[itemIndex] = updatedItem;
    setInventory(newInventory);

    const now = Date.now();
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const protEntry: TradeProtocolEntry = {
      id: 'prot_re_' + now.toString(36),
      timestamp: now,
      dateStr,
      type: 'rent_return',
      description: `↩️ Досрочный возврат: Предмет ${item.icon} ${item.name} возвращен из аренды от ${renter}.`,
      itemSnapshot: { name: item.name, icon: item.icon, quality: item.quality },
      targetNick: renter
    };
    setTradeProtocol((prev) => [protEntry, ...prev]);

    showToast(`↩️ Предмет ${item.name} возвращён в сумку!`);
  };

  // 5. ВЫСТАВИТЬ НА АУКЦИОН (AUCTION)
  const handleConfirmAuction = (
    itemId: string,
    startPrice: number,
    buyoutPrice: number
  ) => {
    if (checkBanRestriction('blockTradeAndAuction', 'Выставление лотов на Аукцион')) {
      return;
    }
    const itemIndex = inventory.findIndex((it) => it.id === itemId);
    if (itemIndex < 0) return;
    const item = inventory[itemIndex];

    if (!canAuctionItem(item)) {
      showToast('🚫 Созданное оружие нельзя выставить на аукцион!');
      return;
    }

    const newInventory = [...inventory];
    newInventory.splice(itemIndex, 1);
    setInventory(newInventory);

    const now = Date.now();
    const newLot: MarketLot = {
      id: 'lot_' + now.toString(36) + '_' + Math.random().toString(36).substr(2, 4),
      seller: currentUser || 'Игрок',
      start: startPrice,
      buyout: buyoutPrice,
      currentBid: startPrice,
      createdAt: now,
      item
    };
    setMarket((prev) => [newLot, ...prev]);

    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Trade protocol
    const protEntry: TradeProtocolEntry = {
      id: 'prot_auc_' + now.toString(36),
      timestamp: now,
      dateStr,
      type: 'auction_list',
      description: `🏛️ Аукцион: Выставлен лот ${item.icon} ${item.name} (Старт: ${startPrice} 🪙, Выкуп: ${buyoutPrice} 🪙)`,
      itemSnapshot: { name: item.name, icon: item.icon, quality: item.quality },
      amount: buyoutPrice
    };
    setTradeProtocol((prev) => [protEntry, ...prev]);

    // Chat
    setChatMessages((prev) => [
      ...prev,
      {
        id: 'chat_auc_' + now,
        time: dateStr,
        author: 'Аукцион',
        text: `🏛️ Новый лот от ${currentUser || 'Игрок'}: ${item.icon} ${item.name} (Выкуп: ${buyoutPrice}🪙)`,
        channel: 'world'
      }
    ]);

    playCoinSound();
    showToast(`🏛️ Лот ${item.name} выставлен на рынок!`);
  };

  // Cancel own auction lot
  const handleCancelAuctionLot = (lot: MarketLot) => {
    if (lot.item.isElixirLot && lot.item.elixirType) {
      const qty = Math.max(1, Number(lot.item.elixirQty || 1));
      const eType = lot.item.elixirType;
      setMarket((prev) => prev.filter((l) => l.id !== lot.id));
      setHero((prev) => {
        const nextHero: HeroState = {
          ...prev,
          hpPotions: eType === 'hp' ? (prev.hpPotions || 0) + qty : prev.hpPotions,
          enPotions: eType === 'en' ? (prev.enPotions || 0) + qty : prev.enPotions,
          expPotions: eType === 'exp' ? (prev.expPotions || 0) + qty : prev.expPotions
        };
        heroRef.current = nextHero;
        if (currentUser) {
          flushPlayerUpdates(currentUser, {
            hp_potions: nextHero.hpPotions,
            en_potions: nextHero.enPotions,
            exp_potions: nextHero.expPotions
          });
        }
        return nextHero;
      });
      showToast(`🧪 Лот «${lot.item.name}» снят с продажи, эликсиры возвращены.`);
      return;
    }

    const isVip = Boolean(hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now());
    const effectiveBagCap = hero.bagCapacity + (isVip ? 50 : 0);
    if (inventory.length >= effectiveBagCap) {
      showToast('🎒 Сумка заполнена! Освободите место, чтобы снять лот.');
      return;
    }

    setMarket((prev) => prev.filter((l) => l.id !== lot.id));
    setInventory((prev) => [lot.item, ...prev]);
    showToast(`Лот ${lot.item.name} снят с продажи и возвращен в сумку.`);
  };

  // Buyout lot
  const handleBuyoutLot = (lot: MarketLot) => {
    if (hero.gold < lot.buyout) {
      showToast(`❌ Недостаточно золота! Требуется ${lot.buyout} 🪙`);
      return;
    }

    if (lot.item.isElixirLot && lot.item.elixirType) {
      const qty = Math.max(1, Number(lot.item.elixirQty || 1));
      const eType = lot.item.elixirType;

      setMarket((prev) => prev.filter((l) => l.id !== lot.id));
      setHero((prev) => {
        const nextGold = Math.max(0, prev.gold - lot.buyout);
        const nextHero: HeroState = {
          ...prev,
          gold: nextGold,
          hpPotions: eType === 'hp' ? (prev.hpPotions || 0) + qty : prev.hpPotions,
          enPotions: eType === 'en' ? (prev.enPotions || 0) + qty : prev.enPotions,
          expPotions: eType === 'exp' ? (prev.expPotions || 0) + qty : prev.expPotions
        };
        heroRef.current = nextHero;
        if (currentUser) {
          flushPlayerUpdates(currentUser, {
            gold: nextGold,
            hp_potions: nextHero.hpPotions,
            en_potions: nextHero.enPotions,
            exp_potions: nextHero.expPotions
          });
        }
        return nextHero;
      });

      playLootSound();
      showToast(`🎉 Вы выкупили ${lot.item.name} за ${lot.buyout} 🪙!`);
      return;
    }

    const isVip = Boolean(hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now());
    const effectiveBagCap = hero.bagCapacity + (isVip ? 50 : 0);
    if (inventory.length >= effectiveBagCap) {
      showToast('🎒 Сумка полна! Освободите место для покупки.');
      return;
    }

    // Deduct gold
    setHero((prev) => ({
      ...prev,
      gold: prev.gold - lot.buyout
    }));

    // Remove from market
    setMarket((prev) => prev.filter((l) => l.id !== lot.id));

    // Add item to inventory
    setInventory((prev) => [lot.item, ...prev]);

    const now = Date.now();
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Trade protocol
    const protEntry: TradeProtocolEntry = {
      id: 'prot_buy_' + now.toString(36),
      timestamp: now,
      dateStr,
      type: 'auction_buy',
      description: `🏛️ Аукцион: Выкуплен лот ${lot.item.icon} ${lot.item.name} у продавца ${lot.seller} за ${lot.buyout} 🪙`,
      itemSnapshot: { name: lot.item.name, icon: lot.item.icon, quality: lot.item.quality },
      targetNick: lot.seller,
      amount: lot.buyout
    };
    setTradeProtocol((prev) => [protEntry, ...prev]);

    // World chat
    setChatMessages((prev) => [
      ...prev,
      {
        id: 'chat_buy_' + now,
        time: dateStr,
        author: 'Аукцион',
        text: `🏛️ ${currentUser || 'Игрок'} выкупил ${lot.item.icon} ${lot.item.name} у ${lot.seller} за ${lot.buyout}🪙!`,
        channel: 'world'
      }
    ]);

    playLootSound();
    showToast(`🎉 Вы выкупили ${lot.item.name} за ${lot.buyout} 🪙!`);
  };

  // Bid on lot
  const handleBidLot = (lot: MarketLot) => {
    const nextBid = Math.max(lot.start, lot.currentBid + Math.ceil(lot.currentBid * 0.1) || 10);
    if (hero.gold < nextBid) {
      showToast(`❌ Недостаточно золота для ставки ${nextBid} 🪙`);
      return;
    }

    setHero((prev) => ({
      ...prev,
      gold: prev.gold - nextBid
    }));

    setMarket((prev) =>
      prev.map((l) =>
        l.id === lot.id
          ? { ...l, currentBid: nextBid, highestBidder: currentUser || 'Игрок' }
          : l
      )
    );

    playCoinSound();
    showToast(`📈 Вы сделали ставку ${nextBid} 🪙 на ${lot.item.name}`);
  };

  // Sell item to merchant (70% of creation expenses for custom items, 30% gold for regular items)
  const handleSellItem = (item: GameItem) => {
    if (item.rent || (item as any).isClanRented || (item as any).clanStorageId) {
      showToast('Предмет, находящийся в аренде или на клановом складе, нельзя продать!');
      return;
    }

    const curInv = inventoryRef.current || inventory;
    const curHero = heroRef.current || hero;
    const itemIndex = curInv.findIndex((it) => it.id === item.id);
    if (itemIndex < 0) return;

    const refund = getItemSellRefund(item);
    const goldGain = refund.currency === 'gold' ? refund.amount : 0;
    const crystalGain = refund.currency === 'crystals' ? refund.amount : 0;

    const expGain = item.quality === 'common' ? 2 : item.quality === 'rare' ? 4 : 5;
    const newExp = curHero.sellExperience + expGain;
    let newCapacity = curHero.bagCapacity;
    if (newExp >= 1300) newCapacity = Math.max(newCapacity, 250);
    else if (newExp >= 1000) newCapacity = Math.max(newCapacity, 210);
    else if (newExp >= 600) newCapacity = Math.max(newCapacity, 180);
    else if (newExp >= 250) newCapacity = Math.max(newCapacity, 150);
    else if (newExp >= 100) newCapacity = Math.max(newCapacity, 120);

    const nextInv = curInv.filter((_, i) => i !== itemIndex);
    const nextGold = curHero.gold + goldGain;
    const nextCrystals = curHero.crystals + crystalGain;
    const nextTotalGold = Math.max(nextGold, Number(curHero.totalGoldCollected || curHero.gold || 0) + goldGain);
    const nextHero: HeroState = {
      ...curHero,
      gold: nextGold,
      crystals: nextCrystals,
      totalGoldCollected: nextTotalGold,
      itemsSold: (curHero.itemsSold || 0) + 1,
      sellExperience: newExp,
      bagCapacity: newCapacity
    };

    inventoryRef.current = nextInv;
    heroRef.current = nextHero;
    lastSyncedFinancialsRef.current = {
      ...lastSyncedFinancialsRef.current,
      gold: nextGold,
      crystals: nextCrystals,
      totalGoldCollected: nextTotalGold,
      updatedAt: Date.now()
    };

    setInventory(nextInv);
    setHero(nextHero);

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        gold: nextGold,
        crystals: nextCrystals,
        total_gold_collected: nextTotalGold,
        inventory: nextInv,
        sell_experience: newExp,
        bag_capacity: newCapacity
      });
    }

    playCoinSound();
    const curIcon = refund.currency === 'crystals' ? '💎' : '🪙';
    showToast(
      `💰 Вы продали «${item.name}» за +${refund.amount} ${curIcon} (${refund.percent}% от затрат)!`
    );
  };

  const handleAddFriend = (targetNick: string) => {
    if (friends.some((f) => f.nick.toLowerCase() === targetNick.toLowerCase())) {
      showToast(`ℹ️ Игрок ${targetNick} уже в вашем списке друзей!`);
      return;
    }
    const newFriend: FriendEntry = {
      nick: targetNick,
      lvl: 1,
      isOnline: true,
      avatar: '🧙‍♂️'
    };
    setFriends((prev) => [...prev, newFriend]);
    showToast(`🤝 Игрок ${targetNick} успешно добавлен в список друзей!`);
  };

  const handleSendSMS = async (targetNick: string, text: string) => {
    if (checkBanRestriction('blockChat', 'Отправка писем по Почте (Мут)')) {
      return;
    }
    const sender = currentUser || 'Игрок';
    const cleanTarget = targetNick.trim();
    const cleanText = text.trim();
    if (!cleanTarget || !cleanText) return;

    const updated = await sendMailInSupabase(sender, cleanTarget, cleanText);
    setMailMessages(updated);
    playLootSound();
    showToast(`✉️ Письмо успешно отправлено игроку ${cleanTarget}!`);
  };

  const handleMarkMailRead = useCallback(
    async (senderNick?: string) => {
      if (!currentUser) return;
      const updated = await markMailReadInSupabase(currentUser, senderNick);
      setMailMessages(updated);
    },
    [currentUser]
  );

  const handleClaimMailGift = useCallback(
    async (msg: PrivateMessage): Promise<boolean> => {
      if (!currentUser || !msg.gift) return false;
      const msgId = String(msg.id || `${msg.from}_${msg.to}_${msg.time}`);
      const alreadyClaimedLocal =
        Boolean(msg.giftClaimed) ||
        (Array.isArray(hero.claimedMailGiftIds) && hero.claimedMailGiftIds.includes(msgId));
      if (alreadyClaimedLocal) {
        showToast('ℹ️ Этот подарок уже был забран (получить можно только 1 раз)!');
        return false;
      }

      if (msg.id) {
        const res = await claimMailGiftInSupabase(msg.id, currentUser);
        if (!res.success && res.alreadyClaimed) {
          setMailMessages(res.messages);
          setHero((prev) => ({
            ...prev,
            claimedMailGiftIds: Array.from(new Set([...(prev.claimedMailGiftIds || []), msgId]))
          }));
          showToast('ℹ️ Этот подарок уже был получен ранее!');
          return false;
        }
        if (Array.isArray(res.messages) && res.messages.length > 0) {
          setMailMessages(res.messages);
        }
      } else {
        setMailMessages((prev) =>
          prev.map((m) =>
            m === msg || m.id === msgId
              ? { ...m, read: true, giftClaimed: true, giftClaimedAt: Date.now() }
              : m
          )
        );
      }

      const gift = msg.gift;
      const addGold = Math.max(0, Number(gift.gold || 0));
      const addCrystals = Math.max(0, Number(gift.crystals || 0));
      const addHpPot = Math.max(0, Number(gift.hpPotions || 0));
      const addEnPot = Math.max(0, Number(gift.enPotions || 0));
      const addEnergy = Math.max(0, Number(gift.energy || 0));
      const addStatPoints = Math.max(0, Number(gift.statPoints || 0));
      const addExp = Math.max(0, Number(gift.exp || 0));
      const addPremDays = Math.max(0, Number(gift.premiumDays || 0));
      const addWheelSpins = Math.max(0, Number(gift.wheelSpins || 0));

      let nextInventory = inventory;
      if (gift.item) {
        const giftedItem: GameItem = {
          ...gift.item,
          id: gift.item.id || `gift_item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        };
        nextInventory = [giftedItem, ...inventory];
        setInventory(nextInventory);
      }

      setHero((prev) => {
        const nextGold = Number(prev.gold || 0) + addGold;
        const nextTotalGold = Number(prev.totalGoldCollected || prev.gold || 0) + addGold;
        const nextCrystals = Number(prev.crystals || 0) + addCrystals;
        const nextHpPotions = Number(prev.hpPotions || 0) + addHpPot;
        const nextEnPotions = Number(prev.enPotions || 0) + addEnPot;
        const nextEnergy = Number(prev.energy || 0) + addEnergy;

        let nextLevel = Number(prev.level || 1);
        let nextExp = Number(prev.exp || 0) + addExp;
        let nextStatPoints = Number(prev.statPoints || 0) + addStatPoints;
        let nextBaseMaxHp = Number(prev.baseMaxHp || 100);
        let nextMaxHp = Number(prev.maxHp || 100);
        let nextHp = Number(prev.hp || 100);
        let nextMaxEnergy = Number(prev.maxEnergy || 100);

        while (nextLevel < MAX_LEVEL && nextExp >= (EXP_TABLE[nextLevel] || 999999)) {
          nextExp -= EXP_TABLE[nextLevel];
          nextLevel += 1;
          nextStatPoints += 1;
          nextBaseMaxHp += 10;
          nextMaxHp += 10;
          nextHp = nextMaxHp;
          nextMaxEnergy += 5;
        }

        const nowMs = Date.now();
        const currentPremBase =
          prev.isPremium && prev.premiumUntil && prev.premiumUntil > nowMs
            ? prev.premiumUntil
            : nowMs;
        const nextPremUntil =
          addPremDays > 0
            ? currentPremBase + addPremDays * 24 * 3600 * 1000
            : prev.premiumUntil;
        const nextIsPrem =
          addPremDays > 0
            ? true
            : Boolean(prev.isPremium && prev.premiumUntil && prev.premiumUntil > nowMs);

        const nextClaimedIds = Array.from(
          new Set([...(prev.claimedMailGiftIds || []), msgId])
        );

        const nextLastWheelSpin =
          addWheelSpins > 0 ? 0 : prev.lastWheelSpinTime;

        lastSyncedFinancialsRef.current = {
          gold: nextGold,
          crystals: nextCrystals,
          lvl: nextLevel,
          exp: nextExp,
          premiumUntil: nextPremUntil || 0,
          updatedAt: nowMs
        };

        flushPlayerUpdates(currentUser, {
          gold: nextGold,
          total_gold_collected: nextTotalGold,
          crystals: nextCrystals,
          hp_potions: nextHpPotions,
          en_potions: nextEnPotions,
          energy: nextEnergy,
          max_energy: nextMaxEnergy,
          lvl: nextLevel,
          exp: nextExp,
          stat_points: nextStatPoints,
          hp: nextHp,
          max_hp: nextMaxHp,
          is_premium: nextIsPrem,
          premium_until: nextPremUntil || 0,
          last_wheel_spin_time: nextLastWheelSpin,
          inventory: nextInventory,
          claimed_mail_gift_ids: nextClaimedIds
        });

        return {
          ...prev,
          gold: nextGold,
          totalGoldCollected: nextTotalGold,
          crystals: nextCrystals,
          hpPotions: nextHpPotions,
          enPotions: nextEnPotions,
          energy: nextEnergy,
          maxEnergy: nextMaxEnergy,
          level: nextLevel,
          lvl: nextLevel,
          exp: nextExp,
          statPoints: nextStatPoints,
          baseMaxHp: nextBaseMaxHp,
          maxHp: nextMaxHp,
          hp: nextHp,
          isPremium: nextIsPrem,
          premiumUntil: nextPremUntil,
          vipUntil: nextPremUntil,
          lastWheelSpinTime: nextLastWheelSpin,
          claimedMailGiftIds: nextClaimedIds
        };
      });

      playLevelUpSound();
      const parts: string[] = [];
      if (addGold > 0) parts.push(`+${addGold} 🪙`);
      if (addCrystals > 0) parts.push(`+${addCrystals} 💎`);
      if (addHpPot > 0) parts.push(`+${addHpPot} 🧪 HP`);
      if (addEnPot > 0) parts.push(`+${addEnPot} ⚡ EN`);
      if (addEnergy > 0) parts.push(`+${addEnergy} ✨ Энергии`);
      if (addStatPoints > 0) parts.push(`+${addStatPoints} 📈 статов`);
      if (addExp > 0) parts.push(`+${addExp} ⭐ опыта`);
      if (addPremDays > 0) parts.push(`+${addPremDays} дн. 👑 VIP`);
      if (gift.item) parts.push(`${gift.item.icon} ${gift.item.name}`);

      showToast(`🎁 Подарок получен: ${parts.join(', ')}!`);
      return true;
    },
    [currentUser, hero.claimedMailGiftIds, inventory, flushPlayerUpdates, showToast]
  );

  const handleBuyElixir = useCallback(
    (type: 'hp' | 'en' | 'exp', quantity = 1) => {
      const qty = Math.max(1, Math.floor(quantity));
      const curHero = heroRef.current || hero;

      if (type === 'exp') {
        const costCrystals = qty * 3;
        const curCrystals = Number(curHero.crystals || 0);
        if (curCrystals < costCrystals) {
          showToast(`❌ Недостаточно кристаллов! Нужно ${costCrystals} 💎 (у вас ${curCrystals} 💎).`);
          return;
        }

        const nextCrystals = Math.max(0, curCrystals - costCrystals);
        const nextExpPotions = Number(curHero.expPotions || 0) + qty;
        const nextHero: HeroState = {
          ...curHero,
          crystals: nextCrystals,
          expPotions: nextExpPotions
        };

        heroRef.current = nextHero;
        lastSyncedFinancialsRef.current = {
          ...lastSyncedFinancialsRef.current,
          crystals: nextCrystals,
          updatedAt: Date.now()
        };

        setHero(nextHero);

        if (currentUser) {
          flushPlayerUpdates(currentUser, {
            crystals: nextCrystals,
            exp_potions: nextExpPotions
          });
        }

        playCoinSound();
        showToast(`✨ Куплено: ${qty} шт. «Эликсир Опыта (+25% к опыту на 30 мин)» за ${costCrystals} 💎!`);
        return;
      }

      const costGold = qty * 100;
      const curGold = Number(curHero.gold || 0);
      if (curGold < costGold) {
        showToast(`❌ Недостаточно золота! Нужно ${costGold} 🪙 (у вас ${curGold} 🪙).`);
        return;
      }

      const nextGold = Math.max(0, curGold - costGold);
      const nextHpPotions =
        type === 'hp' ? Number(curHero.hpPotions || 0) + qty : Number(curHero.hpPotions || 0);
      const nextEnPotions =
        type === 'en' ? Number(curHero.enPotions || 0) + qty : Number(curHero.enPotions || 0);
      const nextHero: HeroState = {
        ...curHero,
        gold: nextGold,
        hpPotions: nextHpPotions,
        enPotions: nextEnPotions
      };

      heroRef.current = nextHero;
      lastSyncedFinancialsRef.current = {
        ...lastSyncedFinancialsRef.current,
        gold: nextGold,
        updatedAt: Date.now()
      };

      setHero(nextHero);

      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          gold: nextGold,
          hp_potions: nextHpPotions,
          en_potions: nextEnPotions
        });
      }

      playCoinSound();
      showToast(
        `🧪 Куплено: ${qty} шт. «Эликсир ${
          type === 'hp' ? 'Здоровья ❤️' : 'Энергии ⚡'
        }» за ${costGold} 🪙 золота!`
      );
    },
    [hero, currentUser, flushPlayerUpdates, showToast]
  );

  // Instant sell elixir on Auction shop
  const handleSellElixir = useCallback(
    (type: 'hp' | 'en' | 'exp', quantity = 1) => {
      const qty = Math.max(1, Math.floor(quantity));
      const curHero = heroRef.current || hero;

      if (type === 'exp') {
        const curCount = Number(curHero.expPotions || 0);
        if (curCount < qty) {
          showToast('❌ Недостаточно эликсиров опыта для продажи!');
          return;
        }
        const crystalGain = qty * 2;
        const nextCrystals = Number(curHero.crystals || 0) + crystalGain;
        const nextExpPotions = curCount - qty;
        const nextHero: HeroState = {
          ...curHero,
          crystals: nextCrystals,
          expPotions: nextExpPotions
        };
        heroRef.current = nextHero;
        setHero(nextHero);
        if (currentUser) {
          flushPlayerUpdates(currentUser, {
            crystals: nextCrystals,
            exp_potions: nextExpPotions
          });
        }
        playCoinSound();
        showToast(`✨ Продано ${qty} шт. «Эликсир Опыта» за +${crystalGain} 💎!`);
        return;
      }

      const curCount = type === 'hp' ? Number(curHero.hpPotions || 0) : Number(curHero.enPotions || 0);
      if (curCount < qty) {
        showToast('❌ Недостаточно эликсиров для продажи!');
        return;
      }
      const goldGain = qty * 50;
      const nextGold = Number(curHero.gold || 0) + goldGain;
      const nextHpPotions = type === 'hp' ? curCount - qty : Number(curHero.hpPotions || 0);
      const nextEnPotions = type === 'en' ? curCount - qty : Number(curHero.enPotions || 0);
      const nextHero: HeroState = {
        ...curHero,
        gold: nextGold,
        hpPotions: nextHpPotions,
        enPotions: nextEnPotions
      };
      heroRef.current = nextHero;
      setHero(nextHero);
      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          gold: nextGold,
          hp_potions: nextHpPotions,
          en_potions: nextEnPotions
        });
      }
      playCoinSound();
      showToast(
        `💰 Продано ${qty} шт. «Эликсир ${type === 'hp' ? 'Здоровья' : 'Энергии'}» за +${goldGain} 🪙!`
      );
    },
    [hero, currentUser, flushPlayerUpdates, showToast]
  );

  // List elixir pack as an Auction Lot for other players
  const handleListElixirLot = useCallback(
    (type: 'hp' | 'en' | 'exp', quantity: number, startPrice: number, buyoutPrice: number) => {
      const qty = Math.max(1, Math.floor(quantity));
      const curHero = heroRef.current || hero;
      const available =
        type === 'hp'
          ? Number(curHero.hpPotions || 0)
          : type === 'en'
          ? Number(curHero.enPotions || 0)
          : Number(curHero.expPotions || 0);

      if (available < qty) {
        showToast('❌ У вас недостаточно эликсиров для выставления на аукцион!');
        return;
      }

      const nextHpPotions = type === 'hp' ? available - qty : Number(curHero.hpPotions || 0);
      const nextEnPotions = type === 'en' ? available - qty : Number(curHero.enPotions || 0);
      const nextExpPotions = type === 'exp' ? available - qty : Number(curHero.expPotions || 0);

      const nextHero: HeroState = {
        ...curHero,
        hpPotions: nextHpPotions,
        enPotions: nextEnPotions,
        expPotions: nextExpPotions
      };
      heroRef.current = nextHero;
      setHero(nextHero);
      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          hp_potions: nextHpPotions,
          en_potions: nextEnPotions,
          exp_potions: nextExpPotions
        });
      }

      const now = Date.now();
      const elixirTitle =
        type === 'hp'
          ? `Эликсир Здоровья (${qty} шт.)`
          : type === 'en'
          ? `Эликсир Энергии (${qty} шт.)`
          : `Эликсир Опыта (${qty} шт.)`;
      const elixirIcon = type === 'hp' ? '🧪' : type === 'en' ? '⚡' : '✨';

      const lotItem: GameItem = {
        id: `elixir_lot_${type}_${now}_${Math.random().toString(36).slice(2, 5)}`,
        name: elixirTitle,
        slot: 'ring',
        quality: type === 'exp' ? 'epic' : 'rare',
        lvl: 1,
        dmg: 0,
        hp: 0,
        price: buyoutPrice,
        icon: elixirIcon,
        isElixirLot: true,
        elixirType: type,
        elixirQty: qty
      };

      const newLot: MarketLot = {
        id: `lot_elx_${now}_${Math.random().toString(36).slice(2, 5)}`,
        seller: currentUser || 'Игрок',
        start: Math.max(1, startPrice),
        buyout: Math.max(startPrice, buyoutPrice),
        currentBid: Math.max(1, startPrice),
        createdAt: now,
        item: lotItem
      };

      setMarket((prev) => [newLot, ...prev]);
      playCoinSound();
      showToast(`🏛️ Выставлено на Аукцион: ${elixirIcon} ${elixirTitle} (Выкуп: ${buyoutPrice} 🪙)!`);
    },
    [hero, currentUser, flushPlayerUpdates, showToast]
  );

  const handleAttackPlayer = (targetNick: string) => {
    if (screen !== 'pyramid' || !pyramidPlayersInPyramid.includes(targetNick)) {
      showToast(`🛡️ Напасть на игрока нельзя: он в мирной зоне (городе)! Нападать разрешено только когда он бегает в Пирамиде.`);
      return;
    }
    const won = Math.random() < 0.75;
    const now = Date.now();
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (won) {
      const stolenGold = Math.floor(180 + Math.random() * 220);
      setHero((prev) => ({
        ...prev,
        gold: prev.gold + stolenGold,
        pvpKills: prev.pvpKills + 1
      }));
      playLevelUpSound();
      showToast(`⚔️ Победа над ${targetNick}! Забрано 50% добычи (+${stolenGold} 🪙)`);
      setTradeProtocol((prev) => [
        {
          id: 'pvp_' + now,
          timestamp: now,
          dateStr,
          type: 'gold_transfer',
          description: `⚔️ Победа в PvP над ${targetNick}: конфисковано 50% ресурсов (+${stolenGold} 🪙)`,
          amount: stolenGold,
          targetNick
        },
        ...prev
      ]);
    } else {
      const lostGold = Math.floor(hero.goldInCurrentRun * 0.5);
      setHero((prev) => ({
        ...prev,
        deaths: prev.deaths + 1,
        gold: Math.max(0, prev.gold - lostGold),
        goldInCurrentRun: 0,
        hp: prev.maxHp,
        energy: 0
      }));
      handleExitToCity(true);
      showToast(`💀 Вы пали в PvP от руки ${targetNick} и потеряли 50% добычи (-${lostGold} 🪙)! Вход в Пирамиду с 30⚡.`);
    }
  };

  const handleClaimReferralReward = (refNick = '') => {
    const curLvl = hero.referralPlayerLvl ?? 0;
    if (!refNick || curLvl < 10) {
      showToast(`❌ Награда заблокирована: реферал должен достичь 10 ур. (сейчас ${curLvl}/10)!`);
      return;
    }
    if (hero.referralClaimed) {
      showToast('ℹ️ Награда за данного реферала уже получена!');
      return;
    }
    const rewardCrystals = 50;
    const rewardGold = 3000;
    setHero((prev) => ({
      ...prev,
      crystals: prev.crystals + rewardCrystals,
      gold: prev.gold + rewardGold,
      referralClaimed: true
    }));
    playLevelUpSound();
    const now = Date.now();
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTradeProtocol((prev) => [
      {
        id: 'ref_' + now,
        timestamp: now,
        dateStr,
        type: 'referral_bonus',
        description: `🎁 Реферальный бонус: реферал ${refNick} достиг 10 уровня! Зачислено +${rewardCrystals} 💎 и +${rewardGold} 🪙`,
        amount: rewardGold
      },
      ...prev
    ]);
    showToast(`🎁 Реферал ${refNick} достиг 10 ур.! Зачислено +50 💎 и +3000 🪙!`);
  };

  const handleBankAddCrystals = (amount: number, packageName: string, priceRub: number) => {
    setHero((prev) => ({ ...prev, crystals: prev.crystals + amount }));
    playCoinSound();
    const now = Date.now();
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTradeProtocol((prev) => [
      {
        id: 'buy_' + now,
        timestamp: now,
        dateStr,
        type: 'purchase',
        description: `💳 Покупка кристаллов: «${packageName}» (+${amount} 💎 за ${priceRub} ₽)`,
        amount
      },
      ...prev
    ]);
    showToast(`💎 Пакет «${packageName}» куплен: +${amount} 💎 зачислено!`);
  };

  const handleBankExchange = (_goldAmount: number, crystalGain: number) => {
    if (!featureFlags.exchangeEnabled) {
      showToast('⛔ Обмен валют временно закрыт администратором!');
      return;
    }
    const curHero = heroRef.current || hero;
    const todayKey = new Date().toISOString().slice(0, 10);
    const crystalToGoldReward = Math.max(1, Number(featureFlags.crystalToGoldRate || 1000));
    const goldToCrystalCost = Math.max(1, Number(featureFlags.goldToCrystalRate || 2000));
    const crystalLimitMax = Math.max(1, Number(featureFlags.dailyCrystalToGoldLimit || 3));
    const goldLimitMax = Math.max(1, Number(featureFlags.dailyGoldToCrystalLimit || 3));

    if (crystalGain > 0) {
      if (featureFlags.crystalToGoldEnabled === false) {
        showToast('⛔ Обмен кристаллов на золото временно закрыт администратором!');
        return;
      }
      const usedToday =
        curHero.dailyCrystalToGoldDate === todayKey
          ? Number(curHero.dailyCrystalToGoldCount || 0)
          : 0;
      if (usedToday >= crystalLimitMax) {
        showToast(`⛔ Лимит исчерпан! Обмен кристаллов на золото разрешен не более ${crystalLimitMax} раз в сутки.`);
        return;
      }
      if (Number(curHero.crystals || 0) < 1) {
        showToast('❌ Недостаточно кристаллов!');
        return;
      }
      const nextCount = usedToday + 1;
      const nextCrystals = Math.max(0, Number(curHero.crystals || 0) - 1);
      const nextGold = Number(curHero.gold || 0) + crystalToGoldReward;
      const nextTotalGold = Number(curHero.totalGoldCollected || curHero.gold || 0) + crystalToGoldReward;

      const updatedHero: HeroState = {
        ...curHero,
        crystals: nextCrystals,
        gold: nextGold,
        totalGoldCollected: nextTotalGold,
        dailyCrystalToGoldCount: nextCount,
        dailyCrystalToGoldDate: todayKey
      };
      heroRef.current = updatedHero;
      setHero(updatedHero);

      lastSyncedFinancialsRef.current = {
        ...lastSyncedFinancialsRef.current,
        gold: nextGold,
        crystals: nextCrystals,
        updatedAt: Date.now()
      };

      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          crystals: nextCrystals,
          gold: nextGold,
          total_gold_collected: nextTotalGold,
          daily_crystal_to_gold_count: nextCount,
          daily_crystal_to_gold_date: todayKey
        });
      }

      showToast(
        `🔄 Обмен совершен: 1 💎 ➔ ${crystalToGoldReward.toLocaleString('ru-RU')} 🪙 Золота! (Использовано ${nextCount}/${crystalLimitMax} в сутки)`
      );
    } else {
      if (featureFlags.goldToCrystalEnabled === false) {
        showToast('⛔ Обмен золота на кристаллы временно закрыт администратором!');
        return;
      }
      const usedToday =
        curHero.dailyGoldToCrystalDate === todayKey
          ? Number(curHero.dailyGoldToCrystalCount || 0)
          : 0;
      if (usedToday >= goldLimitMax) {
        showToast(`⛔ Лимит исчерпан! Обмен золота на кристаллы разрешен не более ${goldLimitMax} раз в сутки.`);
        return;
      }
      if (Number(curHero.gold || 0) < goldToCrystalCost) {
        showToast('❌ Недостаточно золота!');
        return;
      }
      const nextCount = usedToday + 1;
      const nextGold = Math.max(0, Number(curHero.gold || 0) - goldToCrystalCost);
      const nextCrystals = Number(curHero.crystals || 0) + 1;

      const updatedHero: HeroState = {
        ...curHero,
        gold: nextGold,
        crystals: nextCrystals,
        dailyGoldToCrystalCount: nextCount,
        dailyGoldToCrystalDate: todayKey
      };
      heroRef.current = updatedHero;
      setHero(updatedHero);

      lastSyncedFinancialsRef.current = {
        ...lastSyncedFinancialsRef.current,
        gold: nextGold,
        crystals: nextCrystals,
        updatedAt: Date.now()
      };

      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          gold: nextGold,
          crystals: nextCrystals,
          daily_gold_to_crystal_count: nextCount,
          daily_gold_to_crystal_date: todayKey
        });
      }

      showToast(
        `🔄 Обмен совершен: ${goldToCrystalCost.toLocaleString('ru-RU')} 🪙 ➔ 1 💎 Кристалл! (Использовано ${nextCount}/${goldLimitMax} в сутки)`
      );
    }
    playCoinSound();
  };

  const handleBankForgeItem = (newItem: GameItem, costGold: number, costCrystals: number) => {
    if (hero.gold < costGold || hero.crystals < costCrystals) {
      showToast('❌ Недостаточно ресурсов для ковки!');
      return;
    }
    setHero((prev) => ({
      ...prev,
      gold: prev.gold - costGold,
      crystals: prev.crystals - costCrystals
    }));
    setInventory((prev) => [newItem, ...prev]);
    playLevelUpSound();
    showToast(`🔥 Кузнец выковал: ${newItem.name}!`);
  };

  const dailyRewardStatus = computeDailyRewardStatus(
    hero.dailyLoginDay ?? 0,
    hero.dailyLoginLastDate ?? ''
  );

  const handleClaimDailyReward = (reward: DailyRewardDay) => {
    if (!currentUser) return;
    const todayKey = getDailyRewardDayKey();
    if (hero.dailyLoginLastDate === todayKey) {
      showToast('⚠️ Награда за сегодня уже забрана!');
      return;
    }

    const curHero = heroRef.current || hero;
    const nextGold = Number(curHero.gold || 0) + reward.gold;
    const nextCrystals = Number(curHero.crystals || 0) + reward.crystals;
    const nextTotalGold = Number(curHero.totalGoldCollected || curHero.gold || 0) + reward.gold;
    const nextExpPotions = Number(curHero.expPotions || 0) + reward.expPotions;
    const nextDay = reward.day;

    const updatedHero: HeroState = {
      ...curHero,
      gold: nextGold,
      crystals: nextCrystals,
      totalGoldCollected: nextTotalGold,
      expPotions: nextExpPotions,
      dailyLoginDay: nextDay,
      dailyLoginLastDate: todayKey
    };

    heroRef.current = updatedHero;
    setHero(updatedHero);

    lastSyncedFinancialsRef.current = {
      ...lastSyncedFinancialsRef.current,
      gold: nextGold,
      crystals: nextCrystals,
      totalGoldCollected: nextTotalGold,
      updatedAt: Date.now()
    };

    flushPlayerUpdates(currentUser, {
      gold: nextGold,
      crystals: nextCrystals,
      total_gold_collected: nextTotalGold,
      exp_potions: nextExpPotions,
      daily_login_day: nextDay,
      daily_login_last_date: todayKey
    });

    let summaryMsg = `🎁 Получена награда за День ${nextDay}: +${reward.gold} 🪙, +${reward.crystals} 💎`;
    if (reward.expPotions > 0) {
      summaryMsg += `, +${reward.expPotions} ✨ Эликсиров Опыта`;
    }
    summaryMsg += '!';
    showToast(summaryMsg);
    playCoinSound();
    addCombatLog(summaryMsg, 'potion');
  };

  // Direct gold transfer with description/comment (and real-time credit to target in Supabase)
  const handleDirectGoldTransfer = (
    targetNick: string,
    amount: number,
    description?: string
  ) => {
    if (checkBanRestriction('blockTradeAndAuction', 'Перевод золота и торговля')) {
      return;
    }
    if (hero.gold < amount) {
      showToast(`❌ Недостаточно золота! У вас ${hero.gold} 🪙`);
      return;
    }

    setHero((prev) => ({ ...prev, gold: prev.gold - amount }));

    const now = Date.now();
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const commentText = description?.trim() ? description.trim() : 'Перевод золота';
    const fullDesc = `🪙 Перевод: ${amount} золота отправлено игроку ${targetNick}. Назначение: «${commentText}»`;

    const protEntry: TradeProtocolEntry = {
      id: 'prot_gold_' + now.toString(36) + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: now,
      dateStr,
      type: 'gold_transfer',
      description: fullDesc,
      targetNick,
      amount
    };
    setTradeProtocol((prev) => [protEntry, ...prev]);

    // Credit target player in Supabase and record in their Trade Protocol
    transferGoldBetweenPlayersInSupabase(
      currentUser || 'Игрок',
      targetNick,
      amount,
      commentText
    );

    const transferMsg: ChatMessage = {
      id: 'chat_gold_' + now,
      time: dateStr,
      author: 'Лог',
      text: `🪙 ${currentUser || 'Игрок'} перевел ${amount}🪙 игроку ${targetNick} («${commentText}»)`,
      channel: 'world',
      isSystem: true
    };
    setChatMessages((prev) => [...prev, transferMsg]);
    broadcastWorldChatMessageInSupabase(transferMsg);

    playCoinSound();
    showToast(`🪙 ${amount} золота успешно отправлено игроку ${targetNick}!`);
  };

  // Buy premium using dynamic Admin-configured price, currency, duration & bonuses
  const handleBuyPremium = (payWith?: 'crystals' | 'gold') => {
    const premCfg = getPremiumConfig(featureFlags);
    if (!premCfg.enabled) {
      showToast('⛔ Покупка Премиум (VIP) временно отключена администратором!');
      return;
    }
    const mode = payWith || (premCfg.currency === 'gold' ? 'gold' : 'crystals');
    const costCrystals = mode === 'crystals' ? premCfg.priceCrystals : 0;
    const costGold = mode === 'gold' ? premCfg.priceGold : 0;

    if (mode === 'crystals' && hero.crystals < costCrystals) {
      showToast(`❌ Недостаточно кристаллов! Требуется ${costCrystals} 💎`);
      return;
    }
    if (mode === 'gold' && hero.gold < costGold) {
      showToast(`❌ Недостаточно золота! Требуется ${costGold} 🪙`);
      return;
    }

    const now = Date.now();
    const duration = Math.max(1, premCfg.durationHours) * 3600000;
    const until = now + duration;
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const nextGold = Math.max(0, hero.gold - costGold);
    const nextCrystals = Math.max(0, hero.crystals - costCrystals);

    const rawUpdated: HeroState = {
      ...hero,
      gold: nextGold,
      crystals: nextCrystals,
      isPremium: true,
      premiumUntil: until,
      vipUntil: until
    };
    const nextHero = recalcGear(equippedRef.current, rawUpdated);
    heroRef.current = nextHero;
    setHero(nextHero);

    if (currentUser) {
      updatePlayerInDatabase(currentUser, {
        gold: nextGold,
        crystals: nextCrystals,
        is_premium: true,
        premium_until: until,
        hp: nextHero.hp,
        max_hp: nextHero.maxHp,
        energy: nextHero.energy,
        max_energy: nextHero.maxEnergy
      });
      syncPlayerToSupabase({
        nick: currentUser,
        location: screen,
        pyramidTier,
        row: playerPos.row,
        col: playerPos.col,
        hp: nextHero.hp,
        maxHp: nextHero.maxHp,
        lvl: nextHero.level,
        avatar: nextHero.avatar,
        isPremium: true,
        premiumUntil: until,
        isOnline: true
      });
    }

    const costLabel = mode === 'gold' ? `-${costGold} 🪙` : `-${costCrystals} 💎`;
    const protEntry: TradeProtocolEntry = {
      id: 'prot_prem_' + now.toString(36),
      timestamp: now,
      dateStr,
      type: 'purchase',
      description: `👑 Покупка Премиум VIP статуса на ${premCfg.durationHours} ч. (${costLabel})`,
      amount: mode === 'gold' ? costGold : costCrystals
    };
    setTradeProtocol((prev) => [protEntry, ...prev]);

    playLevelUpSound();
    showToast(`👑 Премиум VIP статус активирован на ${premCfg.durationHours} часов!`);
  };

  // Stat allocation
  const handleAllocateStat = (stat: 'str' | 'agi' | 'vit') => {
    const curHero = heroRef.current || hero;
    if (curHero.statPoints <= 0) return;

    const updated: HeroState = {
      ...curHero,
      statPoints: curHero.statPoints - 1,
      [stat]: curHero[stat] + 1
    };
    if (stat === 'vit') {
      const totalVit = updated.vit + (updated.gearVit || 0);
      updated.baseMaxHp = getHeroMaxHpFromVit(updated.vit);
      updated.maxHp = getHeroTotalMaxHp({ ...updated, vit: totalVit }, updated.gearHp || 0);
      updated.hp = updated.maxHp;
    }

    heroRef.current = updated;
    setHero(updated);

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        str: updated.str,
        agi: updated.agi,
        vit: updated.vit,
        stat_points: updated.statPoints,
        hp: updated.hp,
        max_hp: updated.maxHp
      });
    }

    playLootSound();
    showToast(
      `⭐ Очко распределено: ${
        stat === 'str' ? 'Сила (+3 урон)' : stat === 'agi' ? 'Ловкость (+1% уклон)' : 'Живучесть (+20 HP)'
      }`
    );
  };

  // Bank & Forge actions
  const handleAddCrystals = (amount: number) => {
    playCoinSound();
    setHero((prev) => ({ ...prev, crystals: prev.crystals + amount }));
    showToast(`💎 Получено +${amount} Кристаллов!`);
  };

  const handleExchangeGoldToCrystals = (goldAmount: number, crystalGain: number) => {
    if (hero.gold < goldAmount) return;
    playCoinSound();
    setHero((prev) => ({
      ...prev,
      gold: prev.gold - goldAmount,
      crystals: prev.crystals + crystalGain
    }));
    showToast(`🔄 Обменено: -${goldAmount}🪙 ➔ +${crystalGain}💎`);
  };

  const handleForgeItem = (
    newItem: GameItem,
    crystalCost: number,
    options?: ForgeCustomItemOptions | boolean
  ) => {
    const curHero = heroRef.current || hero;
    const curInv = inventoryRef.current || inventory;
    const curEquipped = equippedRef.current || equipped;

    const opts: ForgeCustomItemOptions =
      typeof options === 'object' && options !== null ? options : {};
    const payCurrency = opts.currency || (opts.goldCost && opts.goldCost > 0 ? 'gold' : 'crystals');
    const finalCrystalCost = payCurrency === 'crystals' ? Math.max(0, opts.crystalCost ?? crystalCost) : 0;
    const finalGoldCost = payCurrency === 'gold' ? Math.max(0, opts.goldCost ?? 0) : 0;

    if (payCurrency === 'crystals' && curHero.crystals < finalCrystalCost) {
      showToast('❌ Недостаточно кристаллов!');
      return;
    }
    if (payCurrency === 'gold' && curHero.gold < finalGoldCost) {
      showToast('❌ Недостаточно золота!');
      return;
    }

    const isVip = Boolean(curHero.isPremium && curHero.premiumUntil && curHero.premiumUntil > Date.now());
    const effectiveBagCap = curHero.bagCapacity + (isVip ? 50 : 0);

    if (!opts.equipImmediately && curInv.length >= effectiveBagCap) {
      showToast('🎒 Сумка заполнена!');
      return;
    }

    const nextGold = Math.max(0, curHero.gold - finalGoldCost);
    const nextCrystals = Math.max(0, curHero.crystals - finalCrystalCost);

    let nextEquipped = { ...curEquipped };
    let nextInventory = [...curInv];
    let updatedHero: HeroState = {
      ...curHero,
      gold: nextGold,
      crystals: nextCrystals
    };

    const canEquipNow = Boolean(opts.equipImmediately && (updatedHero.level || 1) >= (newItem.lvl || 1));
    if (canEquipNow) {
      const slot = newItem.slot;
      const oldEquipped = curEquipped[slot];
      nextEquipped = {
        ...curEquipped,
        [slot]: newItem
      };
      if (oldEquipped) {
        nextInventory = [oldEquipped, ...curInv];
      }
      updatedHero = recalcGear(nextEquipped, updatedHero);
    } else {
      nextInventory = [newItem, ...curInv];
    }

    heroRef.current = updatedHero;
    equippedRef.current = nextEquipped;
    inventoryRef.current = nextInventory;
    lastSyncedFinancialsRef.current = {
      ...lastSyncedFinancialsRef.current,
      gold: nextGold,
      crystals: nextCrystals,
      updatedAt: Date.now()
    };

    setHero(updatedHero);
    setEquipped(nextEquipped);
    setInventory(nextInventory);

    const now = Date.now();
    const msgTime = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const iconText = formatItemIconForText(newItem.icon);
    const costLabel =
      payCurrency === 'gold' ? `${finalGoldCost} 🪙` : `${finalCrystalCost} 💎`;

    const protEntry: TradeProtocolEntry = {
      id: `prot_forge_${now}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      dateStr: msgTime,
      type: 'forge',
      description: `⚒️ Создано оружие/амуниция: ${iconText} ${newItem.name} (Ур.${newItem.lvl}) за ${costLabel}`,
      itemSnapshot: { name: newItem.name, icon: newItem.icon, quality: newItem.quality },
      amount: payCurrency === 'gold' ? finalGoldCost : finalCrystalCost
    };
    const nextProtocol = [protEntry, ...(tradeProtocolRef.current || tradeProtocol)].slice(0, 40);
    tradeProtocolRef.current = nextProtocol;
    setTradeProtocol(nextProtocol);

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        gold: nextGold,
        crystals: nextCrystals,
        equipped: nextEquipped,
        inventory: nextInventory,
        hp: updatedHero.hp,
        max_hp: updatedHero.maxHp,
        energy: updatedHero.energy,
        max_energy: updatedHero.maxEnergy,
        trade_protocol: nextProtocol
      });
    }

    // Announce creation in world chat
    const sysChatMsg: ChatMessage = {
      id: 'forge_' + now,
      time: msgTime,
      author: 'Кузница',
      text: `⚒️ Игрок ${currentUser || 'Игрок'} создал амуницию: «${newItem.name}» (Ур.${newItem.lvl}, +${newItem.dmg}⚔️ +${newItem.hp}❤️)!`,
      isSystem: true,
      channel: 'world'
    };
    setChatMessages((prev) => [...prev, sysChatMsg]);
    broadcastWorldChatMessageInSupabase(sysChatMsg);

    playLootSound();
    const q = getQualityConfig('custom');
    showToast(
      canEquipNow
        ? `⚡ Создано и надето: ${iconText} ${newItem.name} (${q.name})!`
        : `🔥 Создано в сумку: ${iconText} ${newItem.name} (${q.name})!`
    );
  };

  // Roulette reward callback — immediately saves prize to Supabase
  const handleRouletteReward = (reward: {
    text: string;
    item?: GameItem;
    gold?: number;
    crystals?: number;
    skinId?: string;
    skinDurationDays?: number;
    winnerEntry?: WheelWinnerEntry;
  }) => {
    showToast(reward.text);
    const nextGold = hero.gold + (reward.gold || 0);
    const nextCrystals = hero.crystals + (reward.crystals || 0);
    let nextInventory = inventory;

    if (reward.item) {
      const isVip = Boolean(hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now());
      const effectiveBagCap = hero.bagCapacity + (isVip ? 50 : 0);
      if (inventory.length < effectiveBagCap) {
        nextInventory = [reward.item, ...inventory];
        setInventory(nextInventory);
      } else {
        showToast('🎒 Сумка полна! Выигрышный предмет утерян.');
      }
    }

    let nextOwnedSkins = Array.isArray(hero.ownedSkinIds) ? [...hero.ownedSkinIds] : [];
    let nextSkinExpirations = { ...(hero.ownedSkinExpirations || {}) };
    let nextOwnedSkinTemplates = Array.isArray(hero.ownedSkins) ? [...hero.ownedSkins] : [];

    if (reward.skinId) {
      if (!nextOwnedSkins.includes(reward.skinId)) {
        nextOwnedSkins.push(reward.skinId);
      }
      if (reward.skinDurationDays && reward.skinDurationDays > 0) {
        nextSkinExpirations[reward.skinId] = Date.now() + reward.skinDurationDays * 86400000;
      }
      const tpl = shopSkins.find((s) => s.id === reward.skinId);
      if (tpl) {
        nextOwnedSkinTemplates = [tpl, ...nextOwnedSkinTemplates.filter((s) => s && s.id !== tpl.id)];
      }
    }

    setHero((prev) => {
      const updatedGold = prev.gold + (reward.gold || 0);
      const updatedCrystals = prev.crystals + (reward.crystals || 0);
      lastSyncedFinancialsRef.current = {
        ...lastSyncedFinancialsRef.current,
        gold: updatedGold,
        crystals: updatedCrystals,
        updatedAt: Date.now()
      };
      const updatedHero: HeroState = {
        ...prev,
        gold: updatedGold,
        crystals: updatedCrystals,
        ownedSkinIds: nextOwnedSkins,
        ownedSkinExpirations: nextSkinExpirations,
        ownedSkins: nextOwnedSkinTemplates
      };
      heroRef.current = updatedHero;
      return updatedHero;
    });

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        gold: nextGold,
        crystals: nextCrystals,
        inventory: nextInventory,
        owned_skin_ids: nextOwnedSkins,
        owned_skin_expirations: nextSkinExpirations,
        owned_skins: nextOwnedSkinTemplates
      });
    }
  };

  // Roulette winner log callback
  const handleWheelWinnerLogged = async (entry: WheelWinnerEntry) => {
    setWheelWinners((prev) => [entry, ...prev.filter((w) => w.id !== entry.id)].slice(0, 40));
    const updated = await recordWheelWinnerInSupabase(entry);
    setWheelWinners(updated);

    const prizeQual = entry.quality || entry.prizeQuality;
    // Announce valuable roulette prizes in World Chat for all players
    if (
      prizeQual === 'legendary' ||
      prizeQual === 'epic' ||
      prizeQual === 'rare' ||
      entry.prizeName.includes('Кристалл') ||
      entry.prizeName.includes('ДЖЕКПОТ')
    ) {
      const winMsg: ChatMessage = {
        id: `wheel_win_${entry.id}`,
        time: entry.timeStr,
        author: 'Рулетка',
        text: `🎰 Игрок ${entry.nick} выбил в Рулетке приз: ${entry.prizeIcon} ${entry.prizeName}!`,
        channel: 'world',
        isSystem: true
      };
      setChatMessages((prev) => [...prev, winMsg]);
      broadcastWorldChatMessageInSupabase(winMsg);
    }
  };

  // Send message in chat (and sync with all players via Supabase)
  const handleSendMessage = (text: string) => {
    if (checkBanRestriction('blockChat', 'Отправка сообщений в Чат (Мут)')) {
      return;
    }
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const targetChannel: 'world' | 'general' =
      activeChatChannel === 'combatLog' ? 'world' : activeChatChannel;
    const newMsg: ChatMessage = {
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      time,
      author: currentUser || 'Игрок',
      text,
      channel: targetChannel
    };
    setChatMessages((prev) => [...prev, newMsg]);
    broadcastWorldChatMessageInSupabase(newMsg);
  };

  // Delete single chat message (Admin or message author)
  const handleDeleteChatMessage = async (msgId: string) => {
    setChatMessages((prev) => prev.filter((m) => m.id !== msgId));
    await deleteWorldChatMessageInSupabase(msgId);
    showToast('🗑️ Сообщение удалено из чата.');
  };

  // Clear all World Chat messages (Admin)
  const handleClearWorldChat = async () => {
    setChatMessages((prev) => prev.filter((m) => m.channel !== 'world'));
    await clearWorldChatMessagesInSupabase();
    showToast('🗑️ Мировой чат очищен!');
  };

  // Toggle sound
  const handleToggleSound = () => {
    const enabled = toggleSound();
    setSoundMuted(!enabled);
    showToast(enabled ? '🔊 Звук включен' : '🔇 Звук выключен');
  };

  // Auth handlers — работа и сохранение исключительно через таблицу players в Supabase
  const handleLogin = async (nick: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const cleanNick = nick.trim();
    const cleanPass = pass.trim();

    const authRes = await authenticatePlayerInSupabase(cleanNick, cleanPass);
    if (!authRes.success) {
      return {
        success: false,
        error: authRes.error || 'Ошибка авторизации через базу Supabase'
      };
    }

    const supaPlayer = authRes.player;
    const isAdmin = Number(supaPlayer?.is_admin) === 1;
    const defaultData = resetGameStorage();

    const wasKilledOffline = Boolean(supaPlayer?.was_killed_in_pvp);
    const killedByNick = supaPlayer?.killed_by || 'Соперник';
    const loadedLevel = supaPlayer?.lvl !== undefined ? Math.max(1, Number(supaPlayer.lvl)) : 1;
    const normLoadedStats = normalizeStatsForLevel(
      loadedLevel,
      Number(supaPlayer?.str ?? defaultData.hero.str ?? 1),
      Number(supaPlayer?.agi ?? defaultData.hero.agi ?? 1),
      Number(supaPlayer?.vit ?? defaultData.hero.vit ?? 1),
      Number(supaPlayer?.stat_points ?? defaultData.hero.statPoints ?? 0)
    );
    const minLevelMaxHp = getHeroMaxHpFromVit(normLoadedStats.vit);
    const minLevelMaxEnergy = 100;
    const loadedMaxHp =
      supaPlayer?.max_hp !== undefined
        ? Math.max(minLevelMaxHp, Number(supaPlayer.max_hp))
        : minLevelMaxHp;
    const loadedHp =
      supaPlayer?.hp !== undefined
        ? Math.min(loadedMaxHp, Math.max(0, Number(supaPlayer.hp)))
        : loadedMaxHp;
    const loadedMaxEnergy =
      supaPlayer?.max_energy !== undefined
        ? Math.max(minLevelMaxEnergy, Number(supaPlayer.max_energy))
        : minLevelMaxEnergy;
    const loadedEnergy =
      supaPlayer?.energy !== undefined
        ? Math.min(loadedMaxEnergy, Math.max(0, Number(supaPlayer.energy)))
        : loadedMaxEnergy;

    const loadedPremiumUntil = Number(supaPlayer?.premium_until ?? 0);
    const loadedIsPremium = Boolean(supaPlayer?.is_premium) && loadedPremiumUntil > Date.now();

    const loadedHero: HeroState = {
      ...defaultData.hero,
      nick: String(supaPlayer?.name || cleanNick).trim(),
      level: loadedLevel,
      lvl: loadedLevel,
      exp: supaPlayer?.exp !== undefined ? Number(supaPlayer.exp) : 0,
      baseMaxHp: minLevelMaxHp,
      hp: loadedHp,
      maxHp: loadedMaxHp,
      energy: loadedEnergy,
      maxEnergy: loadedMaxEnergy,
      hpPotions: supaPlayer?.hp_potions !== undefined ? Number(supaPlayer.hp_potions) : 3,
      enPotions: supaPlayer?.en_potions !== undefined ? Number(supaPlayer.en_potions) : 3,
      expPotions: supaPlayer?.exp_potions !== undefined ? Number(supaPlayer.exp_potions) : 0,
      expElixirUntil: supaPlayer?.exp_elixir_until !== undefined ? Number(supaPlayer.exp_elixir_until) : 0,
      gold: supaPlayer?.gold !== undefined ? Number(supaPlayer.gold) : 0,
      crystals: supaPlayer?.crystals !== undefined ? Number(supaPlayer.crystals) : 0,
      isPremium: loadedIsPremium,
      premiumUntil: loadedIsPremium ? loadedPremiumUntil : undefined,
      vipUntil: loadedIsPremium ? loadedPremiumUntil : undefined,
      role: isAdmin ? 'admin' : 'regular',
      statusTitle: isAdmin ? 'Главный Администратор' : 'Новичок',
      avatar: supaPlayer?.avatar || (isAdmin ? '👑' : '🧙‍♂️'),
      str: normLoadedStats.str,
      agi: normLoadedStats.agi,
      vit: normLoadedStats.vit,
      statPoints: normLoadedStats.statPoints,
      pvpWins: supaPlayer?.pvp_wins !== undefined ? Number(supaPlayer.pvp_wins) : 0,
      pvpLosses: supaPlayer?.pvp_losses !== undefined ? Number(supaPlayer.pvp_losses) : 0,
      pvpKills: supaPlayer?.pvp_kills !== undefined ? Number(supaPlayer.pvp_kills) : 0,
      mobsKilled: Math.max(0, Number(supaPlayer?.mobs_killed ?? supaPlayer?.mobsKilled ?? supaPlayer?.mob_kills ?? 0)),
      totalGoldCollected: Math.max(
        Number(supaPlayer?.gold ?? 0),
        Number(supaPlayer?.total_gold_collected ?? supaPlayer?.totalGoldCollected ?? 0)
      ),
      deaths: supaPlayer?.deaths !== undefined ? Number(supaPlayer.deaths) : 0,
      lastWheelSpinTime: supaPlayer?.last_wheel_spin_time,
      dailyGoldWheelSpins: supaPlayer?.daily_gold_wheel_spins ?? 0,
      dailyCrystalWheelSpins: supaPlayer?.daily_crystal_wheel_spins ?? 0,
      dailyWheelSpinsDate: supaPlayer?.daily_wheel_spins_date ?? '',
      dailyCrystalToGoldCount: supaPlayer?.daily_crystal_to_gold_count ?? 0,
      dailyCrystalToGoldDate: supaPlayer?.daily_crystal_to_gold_date ?? '',
      dailyGoldToCrystalCount: supaPlayer?.daily_gold_to_crystal_count ?? 0,
      dailyGoldToCrystalDate: supaPlayer?.daily_gold_to_crystal_date ?? '',
      dailyLoginDay: supaPlayer?.daily_login_day !== undefined ? Number(supaPlayer.daily_login_day) : 0,
      dailyLoginLastDate: supaPlayer?.daily_login_last_date ? String(supaPlayer.daily_login_last_date) : '',
      claimedMailGiftIds: Array.isArray(supaPlayer?.claimed_mail_gift_ids)
        ? supaPlayer.claimed_mail_gift_ids
        : [],
      bagCapacity: Math.max(20, Number(supaPlayer?.bag_capacity ?? supaPlayer?.bagCapacity ?? defaultData.hero.bagCapacity ?? 100)),
      sellExperience: Math.max(0, Number(supaPlayer?.sell_experience ?? supaPlayer?.sellExperience ?? defaultData.hero.sellExperience ?? 0)),
      ownedSkinIds: Array.isArray(supaPlayer?.owned_skin_ids) ? supaPlayer.owned_skin_ids : [],
      ownedSkinExpirations:
        supaPlayer?.owned_skin_expirations && typeof supaPlayer.owned_skin_expirations === 'object'
          ? supaPlayer.owned_skin_expirations
          : {},
      ownedSkins: Array.isArray(supaPlayer?.owned_skins) ? supaPlayer.owned_skins : [],
      activeSkinId: supaPlayer?.active_skin_id ? String(supaPlayer.active_skin_id) : null,
      banInfo: supaPlayer?.ban_info && typeof supaPlayer.ban_info === 'object' ? supaPlayer.ban_info : null,
      referralCode: `ref_${cleanNick.substr(0, 3)}_${Math.random().toString(36).substr(2, 6)}`
    };

    const loadedEquipped = supaPlayer?.equipped && typeof supaPlayer.equipped === 'object' ? supaPlayer.equipped : defaultData.equipped;
    const loadedInventory = Array.isArray(supaPlayer?.inventory) ? supaPlayer.inventory : defaultData.inventory;
    const loadedTradeProtocol = Array.isArray(supaPlayer?.trade_protocol)
      ? supaPlayer.trade_protocol
      : defaultData.tradeProtocol;
    // Fixed start/spawn position on the empty cell [9, 1] right next to the Exit button [9, 0]
    const exitSpawnPos = {
      row: PYRAMID_SPAWN_POS.row,
      col: PYRAMID_SPAWN_POS.col
    };
    const loadedLoc = wasKilledOffline
      ? 'city'
      : supaPlayer?.location === 'pyramid'
      ? 'pyramid'
      : 'city';
    const rawSavedRow = supaPlayer?.row !== undefined ? Number(supaPlayer.row) : exitSpawnPos.row;
    const rawSavedCol = supaPlayer?.col !== undefined ? Number(supaPlayer.col) : exitSpawnPos.col;
    // If player was previously saved at [9,0] (the exit button cell), place them on [9,1] next to exit
    const loadedPos =
      wasKilledOffline || loadedLoc === 'city'
        ? exitSpawnPos
        : rawSavedRow === PYRAMID_EXIT_POS.row && rawSavedCol === PYRAMID_EXIT_POS.col
        ? exitSpawnPos
        : { row: rawSavedRow, col: rawSavedCol };
    const loadedTier = getPyramidTierForLevel(loadedLevel);
    loadedHero.pyramidTier = loadedTier;

    const activeNick = String(supaPlayer?.name || cleanNick).trim();

    livePosRef.current = {
      screen: loadedLoc,
      tier: loadedTier,
      row: loadedPos.row,
      col: loadedPos.col
    };
    lastAppliedExternalSyncTsRef.current = Number(supaPlayer?.external_sync_ts || 0);

    const recalcedHero = recalcGear(loadedEquipped, loadedHero);
    heroRef.current = recalcedHero;
    equippedRef.current = loadedEquipped;
    inventoryRef.current = loadedInventory;
    tradeProtocolRef.current = loadedTradeProtocol;
    pendingPlayerUpdatesRef.current = null;

    setCurrentUser(activeNick);
    setCurrentUserNick(activeNick);

    lastSyncedFinancialsRef.current = {
      gold: recalcedHero.gold,
      crystals: recalcedHero.crystals,
      lvl: recalcedHero.level,
      exp: recalcedHero.exp,
      mobsKilled: recalcedHero.mobsKilled || 0,
      totalGoldCollected: recalcedHero.totalGoldCollected || recalcedHero.gold || 0,
      premiumUntil: recalcedHero.premiumUntil || 0,
      updatedAt: Date.now()
    };

    setHero(recalcedHero);
    setEquipped(loadedEquipped);
    setInventory(loadedInventory);
    setMarket(defaultData.market);
    setTradeProtocol(loadedTradeProtocol);
    setFriends(defaultData.friends);
    setPlayerPos(loadedPos);
    setPyramidTier(loadedTier);
    setScreen(loadedLoc);
    if (loadedLoc === 'pyramid') {
      generateNewPyramid(loadedTier, loadedPos);
    }
    isProfileLoadedRef.current = true;

    if (wasKilledOffline) {
      updatePlayerInDatabase(activeNick, {
        was_killed_in_pvp: false,
        killed_by: null,
        location: 'city',
        pyramid_tier: loadedTier,
        пирамидальный_уровень: loadedTier,
        row: exitSpawnPos.row,
        ряд: exitSpawnPos.row,
        col: exitSpawnPos.col,
        ц: exitSpawnPos.col,
        hp: recalcedHero.hp,
        energy: recalcedHero.energy,
        is_online: true,
        last_seen: Date.now()
      });
    }

    syncPlayerToSupabase({
      nick: activeNick,
      location: loadedLoc,
      pyramidTier: loadedTier,
      row: loadedPos.row,
      col: loadedPos.col,
      hp: recalcedHero.hp,
      maxHp: recalcedHero.maxHp,
      lvl: recalcedHero.level,
      exp: recalcedHero.exp,
      gold: recalcedHero.gold,
      crystals: recalcedHero.crystals,
      avatar: recalcedHero.avatar,
      isOnline: true
    });

    if (wasKilledOffline) {
      showToast(
        `☠️ Пока вы были оффлайн, вас убил игрок ${killedByNick}! Вы возродились в городе (для входа в Пирамиду накопите 30⚡).`
      );
    } else if (loadedLoc === 'pyramid') {
      showToast(
        `🏛️ С возвращением, ${activeNick}! Вы продолжаете на ярусе ${loadedTier} [ряд ${loadedPos.row}, кл. ${loadedPos.col}].`
      );
    } else {
      showToast(`✨ Добро пожаловать в игру, ${activeNick}!`);
    }
    return { success: true };
  };

  const handleRegister = async (nick: string, email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const cleanNick = nick.trim();
    const cleanEmail = email.trim();
    const cleanPass = pass.trim();

    // Прямая запись нового персонажа в таблицу players в Supabase без каких-либо локальных блокировок
    const saveRes = await savePlayerToDatabase(cleanNick, cleanEmail, cleanPass);
    if (!saveRes.success) {
      return {
        success: false,
        error: `Ошибка сохранения в базу Supabase: ${saveRes.error || 'проверьте подключение'}`
      };
    }

    const savedRecord = saveRes.data;
    const isAdmin = Number(savedRecord?.is_admin) === 1;

    const defaultData = resetGameStorage();
    defaultData.hero = {
      ...defaultData.hero,
      level: savedRecord?.lvl !== undefined ? Number(savedRecord.lvl) : 1,
      exp: savedRecord?.exp !== undefined ? Number(savedRecord.exp) : 0,
      gold: savedRecord?.gold !== undefined ? Number(savedRecord.gold) : 0,
      crystals: savedRecord?.crystals !== undefined ? Number(savedRecord.crystals) : 0,
      role: isAdmin ? 'admin' : 'regular',
      statusTitle: isAdmin ? 'Главный Администратор' : 'Новичок',
      avatar: savedRecord?.avatar || (isAdmin ? '👑' : '🧙‍♂️'),
      referralCode: `ref_${cleanNick.substr(0, 3)}_${Math.random().toString(36).substr(2, 6)}`
    };

    livePosRef.current = {
      screen: 'city',
      tier: 1,
      row: defaultData.playerPos.row,
      col: defaultData.playerPos.col
    };
    isProfileLoadedRef.current = true;

    setCurrentUser(cleanNick);
    setCurrentUserNick(cleanNick);

    setHero(defaultData.hero);
    setEquipped(defaultData.equipped);
    setInventory(defaultData.inventory);
    setMarket(defaultData.market);
    setTradeProtocol(defaultData.tradeProtocol);
    setFriends(defaultData.friends);
    setPyramidMap(defaultData.pyramidMap);
    setPlayerPos(defaultData.playerPos);
    setPyramidTier(1);

    setRealtimePlayers((prev) => [
      {
        id: cleanNick,
        nick: cleanNick,
        lvl: defaultData.hero.level,
        hp: defaultData.hero.hp,
        maxHp: defaultData.hero.maxHp,
        avatar: defaultData.hero.avatar,
        location: 'city',
        pyramidTier: 1,
        row: defaultData.playerPos.row,
        col: defaultData.playerPos.col,
        isOnline: true,
        role: isAdmin ? 'admin' : 'regular'
      },
      ...prev.filter(p => p.nick.toLowerCase() !== cleanNick.toLowerCase())
    ]);

    syncPlayerToSupabase({
      nick: cleanNick,
      location: 'city',
      pyramidTier: 1,
      row: defaultData.playerPos.row,
      col: defaultData.playerPos.col,
      hp: defaultData.hero.hp,
      maxHp: defaultData.hero.maxHp,
      lvl: defaultData.hero.level,
      avatar: defaultData.hero.avatar,
      isOnline: true
    });

    showToast(`🛡️ Персонаж ${cleanNick} создан и сохранен в базу Supabase!`);
    return { success: true };
  };

  const handleLogout = () => {
    if (fastFlushTimerRef.current) {
      clearTimeout(fastFlushTimerRef.current);
      fastFlushTimerRef.current = null;
    }
    const activeNick = currentUser || currentUserRef.current;
    if (activeNick && isProfileLoadedRef.current) {
      const curHero = heroRef.current;
      flushPlayerUpdates(activeNick, {
        gold: curHero.gold,
        crystals: curHero.crystals,
        lvl: curHero.level,
        exp: curHero.exp,
        str: curHero.str,
        agi: curHero.agi,
        vit: curHero.vit,
        stat_points: curHero.statPoints,
        hp: curHero.hp,
        max_hp: curHero.maxHp,
        energy: curHero.energy,
        max_energy: curHero.maxEnergy,
        hp_potions: curHero.hpPotions,
        en_potions: curHero.enPotions,
        exp_potions: curHero.expPotions || 0,
        exp_elixir_until: curHero.expElixirUntil || 0,
        mobs_killed: curHero.mobsKilled || 0,
        mob_kills: curHero.mobsKilled || 0,
        total_gold_collected: curHero.totalGoldCollected || curHero.gold || 0,
        daily_login_day: curHero.dailyLoginDay ?? 0,
        daily_login_last_date: curHero.dailyLoginLastDate ?? '',
        bag_capacity: curHero.bagCapacity,
        sell_experience: curHero.sellExperience,
        equipped: equippedRef.current,
        inventory: inventoryRef.current,
        trade_protocol: tradeProtocolRef.current,
        location: livePosRef.current.screen,
        pyramid_tier: livePosRef.current.tier,
        пирамидальный_уровень: livePosRef.current.tier,
        row: livePosRef.current.row,
        ряд: livePosRef.current.row,
        col: livePosRef.current.col,
        ц: livePosRef.current.col,
        is_admin: curHero.role === 'admin' || Number((curHero as any).is_admin) === 1 ? 1 : 0,
        is_online: false,
        last_seen: Date.now()
      });
    }
    pendingPlayerUpdatesRef.current = null;
    isProfileLoadedRef.current = false;
    setCurrentUser(null);
    setCurrentUserNick(null);
    showToast('🚪 Вы вышли из аккаунта. Все золото, экипировка и прогресс сохранены!');
  };

  // При перезагрузке страницы / открытии в Telegram загружаем актуальный прогресс и координаты из Supabase
  // до включения автосохранения, чтобы ни в коем случае не сбросить уровень, опыт, золото или координаты
  useEffect(() => {
    if (!currentUser || isProfileLoadedRef.current) return;
    let cancelled = false;

    findPlayerInSupabase(currentUser).then((supaPlayer) => {
      if (cancelled) return;
      if (supaPlayer) {
        const isAdmin = Number(supaPlayer.is_admin) === 1;
        const defaultData = resetGameStorage();

        const wasKilledOffline = Boolean(supaPlayer.was_killed_in_pvp);
        const killedByNick = supaPlayer.killed_by || 'Соперник';
        const loadedLevel = supaPlayer.lvl !== undefined ? Math.max(1, Number(supaPlayer.lvl)) : 1;
        const normLoadedStats = normalizeStatsForLevel(
          loadedLevel,
          Number(supaPlayer.str ?? defaultData.hero.str ?? 1),
          Number(supaPlayer.agi ?? defaultData.hero.agi ?? 1),
          Number(supaPlayer.vit ?? defaultData.hero.vit ?? 1),
          Number(supaPlayer.stat_points ?? defaultData.hero.statPoints ?? 0)
        );
        const minLevelMaxHp = getHeroMaxHpFromVit(normLoadedStats.vit);
        const minLevelMaxEnergy = 100;
        const loadedMaxHp =
          supaPlayer.max_hp !== undefined
            ? Math.max(minLevelMaxHp, Number(supaPlayer.max_hp))
            : minLevelMaxHp;
        const loadedHp =
          supaPlayer.hp !== undefined
            ? Math.min(loadedMaxHp, Math.max(0, Number(supaPlayer.hp)))
            : loadedMaxHp;
        const loadedMaxEnergy =
          supaPlayer.max_energy !== undefined
            ? Math.max(minLevelMaxEnergy, Number(supaPlayer.max_energy))
            : minLevelMaxEnergy;
        const loadedEnergy =
          supaPlayer.energy !== undefined
            ? Math.min(loadedMaxEnergy, Math.max(0, Number(supaPlayer.energy)))
            : loadedMaxEnergy;

        const loadedPremiumUntil = Number(supaPlayer.premium_until ?? 0);
        const loadedIsPremium = Boolean(supaPlayer.is_premium) && loadedPremiumUntil > Date.now();

        const loadedHero: HeroState = {
          ...defaultData.hero,
          nick: currentUser,
          level: loadedLevel,
          lvl: loadedLevel,
          exp: supaPlayer.exp !== undefined ? Number(supaPlayer.exp) : 0,
          baseMaxHp: minLevelMaxHp,
          hp: loadedHp,
          maxHp: loadedMaxHp,
          energy: loadedEnergy,
          maxEnergy: loadedMaxEnergy,
          hpPotions: supaPlayer.hp_potions !== undefined ? Number(supaPlayer.hp_potions) : 3,
          enPotions: supaPlayer.en_potions !== undefined ? Number(supaPlayer.en_potions) : 3,
          expPotions: supaPlayer.exp_potions !== undefined ? Number(supaPlayer.exp_potions) : 0,
          expElixirUntil: supaPlayer.exp_elixir_until !== undefined ? Number(supaPlayer.exp_elixir_until) : 0,
          gold: supaPlayer.gold !== undefined ? Number(supaPlayer.gold) : 0,
          crystals: supaPlayer.crystals !== undefined ? Number(supaPlayer.crystals) : 0,
          isPremium: loadedIsPremium,
          premiumUntil: loadedIsPremium ? loadedPremiumUntil : undefined,
          vipUntil: loadedIsPremium ? loadedPremiumUntil : undefined,
          role: isAdmin ? 'admin' : 'regular',
          statusTitle: isAdmin ? 'Главный Администратор' : 'Новичок',
          avatar: supaPlayer.avatar || (isAdmin ? '👑' : '🧙‍♂️'),
          str: normLoadedStats.str,
          agi: normLoadedStats.agi,
          vit: normLoadedStats.vit,
          statPoints: normLoadedStats.statPoints,
          pvpWins: supaPlayer.pvp_wins !== undefined ? Number(supaPlayer.pvp_wins) : 0,
          pvpLosses: supaPlayer.pvp_losses !== undefined ? Number(supaPlayer.pvp_losses) : 0,
          pvpKills: supaPlayer.pvp_kills !== undefined ? Number(supaPlayer.pvp_kills) : 0,
          mobsKilled: Math.max(0, Number(supaPlayer.mobs_killed ?? supaPlayer.mobsKilled ?? supaPlayer.mob_kills ?? 0)),
          totalGoldCollected: Math.max(
            Number(supaPlayer.gold ?? 0),
            Number(supaPlayer.total_gold_collected ?? supaPlayer.totalGoldCollected ?? 0)
          ),
          deaths: supaPlayer.deaths !== undefined ? Number(supaPlayer.deaths) : 0,
          lastWheelSpinTime: supaPlayer.last_wheel_spin_time,
          dailyGoldWheelSpins: supaPlayer.daily_gold_wheel_spins ?? 0,
          dailyCrystalWheelSpins: supaPlayer.daily_crystal_wheel_spins ?? 0,
          dailyWheelSpinsDate: supaPlayer.daily_wheel_spins_date ?? '',
          dailyCrystalToGoldCount: supaPlayer.daily_crystal_to_gold_count ?? 0,
          dailyCrystalToGoldDate: supaPlayer.daily_crystal_to_gold_date ?? '',
          dailyGoldToCrystalCount: supaPlayer.daily_gold_to_crystal_count ?? 0,
          dailyGoldToCrystalDate: supaPlayer.daily_gold_to_crystal_date ?? '',
          dailyLoginDay: supaPlayer.daily_login_day !== undefined ? Number(supaPlayer.daily_login_day) : 0,
          dailyLoginLastDate: supaPlayer.daily_login_last_date ? String(supaPlayer.daily_login_last_date) : '',
          claimedMailGiftIds: Array.isArray(supaPlayer.claimed_mail_gift_ids)
            ? supaPlayer.claimed_mail_gift_ids
            : [],
          bagCapacity: Math.max(20, Number(supaPlayer.bag_capacity ?? supaPlayer.bagCapacity ?? defaultData.hero.bagCapacity ?? 100)),
          sellExperience: Math.max(0, Number(supaPlayer.sell_experience ?? supaPlayer.sellExperience ?? defaultData.hero.sellExperience ?? 0)),
          ownedSkinIds: Array.isArray(supaPlayer.owned_skin_ids) ? supaPlayer.owned_skin_ids : [],
          ownedSkinExpirations:
            supaPlayer.owned_skin_expirations && typeof supaPlayer.owned_skin_expirations === 'object'
              ? supaPlayer.owned_skin_expirations
              : {},
          ownedSkins: Array.isArray(supaPlayer.owned_skins) ? supaPlayer.owned_skins : [],
          activeSkinId: supaPlayer.active_skin_id ? String(supaPlayer.active_skin_id) : null,
          banInfo: supaPlayer.ban_info && typeof supaPlayer.ban_info === 'object' ? supaPlayer.ban_info : null,
          referralCode: `ref_${currentUser.substr(0, 3)}_${Math.random().toString(36).substr(2, 6)}`
        };

        const loadedEquipped =
          supaPlayer.equipped && typeof supaPlayer.equipped === 'object'
            ? supaPlayer.equipped
            : defaultData.equipped;
        const loadedInventory = Array.isArray(supaPlayer.inventory)
          ? supaPlayer.inventory
          : defaultData.inventory;
        const loadedTradeProtocol = Array.isArray(supaPlayer.trade_protocol)
          ? supaPlayer.trade_protocol
          : defaultData.tradeProtocol;
        const exitSpawnPos = {
          row: PYRAMID_SPAWN_POS.row,
          col: PYRAMID_SPAWN_POS.col
        };
        const loadedLoc = wasKilledOffline
          ? 'city'
          : supaPlayer.location === 'pyramid'
          ? 'pyramid'
          : 'city';
        const rawSavedRow = supaPlayer.row !== undefined ? Number(supaPlayer.row) : exitSpawnPos.row;
        const rawSavedCol = supaPlayer.col !== undefined ? Number(supaPlayer.col) : exitSpawnPos.col;
        const loadedPos =
          wasKilledOffline || loadedLoc === 'city'
            ? exitSpawnPos
            : rawSavedRow === PYRAMID_EXIT_POS.row && rawSavedCol === PYRAMID_EXIT_POS.col
            ? exitSpawnPos
            : { row: rawSavedRow, col: rawSavedCol };
        const loadedTier = getPyramidTierForLevel(loadedLevel);
        loadedHero.pyramidTier = loadedTier;

        livePosRef.current = {
          screen: loadedLoc,
          tier: loadedTier,
          row: loadedPos.row,
          col: loadedPos.col
        };
        lastAppliedExternalSyncTsRef.current = Number(supaPlayer.external_sync_ts || 0);

        const recalcedHero = recalcGear(loadedEquipped, loadedHero);
        heroRef.current = recalcedHero;
        equippedRef.current = loadedEquipped;
        inventoryRef.current = loadedInventory;
        tradeProtocolRef.current = loadedTradeProtocol;
        pendingPlayerUpdatesRef.current = null;

        lastSyncedFinancialsRef.current = {
          gold: recalcedHero.gold,
          crystals: recalcedHero.crystals,
          lvl: recalcedHero.level,
          exp: recalcedHero.exp,
          mobsKilled: recalcedHero.mobsKilled || 0,
          totalGoldCollected: recalcedHero.totalGoldCollected || recalcedHero.gold || 0,
          premiumUntil: recalcedHero.premiumUntil || 0,
          updatedAt: Date.now()
        };

        setHero(recalcedHero);
        setEquipped(loadedEquipped);
        setInventory(loadedInventory);
        setTradeProtocol(loadedTradeProtocol);
        setPlayerPos(loadedPos);
        setPyramidTier(loadedTier);
        setScreen(loadedLoc);
        if (loadedLoc === 'pyramid') {
          generateNewPyramid(loadedTier, loadedPos);
        }
        isProfileLoadedRef.current = true;

        if (wasKilledOffline) {
          updatePlayerInDatabase(currentUser, {
            was_killed_in_pvp: false,
            killed_by: null,
            location: 'city',
            pyramid_tier: loadedTier,
            пирамидальный_уровень: loadedTier,
            row: exitSpawnPos.row,
            ряд: exitSpawnPos.row,
            col: exitSpawnPos.col,
            ц: exitSpawnPos.col,
            hp: recalcedHero.hp,
            energy: recalcedHero.energy,
            is_online: true,
            last_seen: Date.now()
          });
          showToast(
            `☠️ Пока вы были оффлайн, вас убил игрок ${killedByNick}! Вы возродились в городе (для входа в Пирамиду накопите 30⚡).`
          );
        }

        syncPlayerToSupabase({
          nick: currentUser,
          location: loadedLoc,
          pyramidTier: loadedTier,
          row: loadedPos.row,
          col: loadedPos.col,
          hp: recalcedHero.hp,
          maxHp: recalcedHero.maxHp,
          lvl: recalcedHero.level,
          exp: recalcedHero.exp,
          gold: recalcedHero.gold,
          crystals: recalcedHero.crystals,
          avatar: recalcedHero.avatar,
          isOnline: true
        });
      } else {
        // If Supabase profile could not be loaded yet (network delay or cold start), DO NOT set isProfileLoadedRef to true!
        // This strictly prevents initial empty state (level 1, 0 gold) from overwriting the player profile in the database!
        console.warn(`[ProfileLoader] Player ${currentUser} profile not loaded from Supabase yet. Retrying in 1.5s...`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser, generateNewPyramid, showToast]);

  // Буферизация изменений прогресса и координат персонажа:
  // Финансовые/уровневые изменения (золото, опыт, кристаллы, рулетка, уровень) сохраняются ускоренно (250мс),
  // а обычная регенерация HP/энергии и шаги сбрасываются пачкой каждые 5 секунд вместе с Heartbeat.
  useEffect(() => {
    if (!currentUser || !isProfileLoadedRef.current) return;
    const canonicalTier = getPyramidTierForLevel(hero.level);
    livePosRef.current = {
      screen,
      tier: canonicalTier,
      row: playerPos.row,
      col: playerPos.col
    };

    const financialsChanged =
      hero.gold !== lastSyncedFinancialsRef.current.gold ||
      hero.crystals !== lastSyncedFinancialsRef.current.crystals ||
      hero.level !== lastSyncedFinancialsRef.current.lvl ||
      hero.exp !== lastSyncedFinancialsRef.current.exp ||
      hero.mobsKilled !== lastSyncedFinancialsRef.current.mobsKilled ||
      (hero.totalGoldCollected || hero.gold) !== lastSyncedFinancialsRef.current.totalGoldCollected ||
      (hero.premiumUntil || 0) !== lastSyncedFinancialsRef.current.premiumUntil;

    if (financialsChanged) {
      lastSyncedFinancialsRef.current = {
        gold: hero.gold,
        crystals: hero.crystals,
        lvl: hero.level,
        exp: hero.exp,
        mobsKilled: hero.mobsKilled || 0,
        totalGoldCollected: hero.totalGoldCollected || hero.gold || 0,
        premiumUntil: hero.premiumUntil || 0,
        updatedAt: Date.now()
      };
    }

    queuePlayerUpdate(currentUser, {
      gold: hero.gold,
      crystals: hero.crystals,
      lvl: hero.level,
      exp: hero.exp,
      is_premium: Boolean(
        hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now()
      ),
      premium_until: hero.premiumUntil || 0,
      hp: hero.hp,
      max_hp: hero.maxHp,
      energy: hero.energy,
      max_energy: hero.maxEnergy,
      hp_potions: hero.hpPotions,
      en_potions: hero.enPotions,
      exp_potions: hero.expPotions || 0,
      exp_elixir_until: hero.expElixirUntil || 0,
      bag_capacity: hero.bagCapacity,
      sell_experience: hero.sellExperience,
      equipped,
      inventory,
      trade_protocol: tradeProtocol,
      pvp_wins: hero.pvpWins,
      pvp_losses: hero.pvpLosses,
      pvp_kills: hero.pvpKills,
      mobs_killed: hero.mobsKilled || 0,
      mob_kills: hero.mobsKilled || 0,
      total_gold_collected: hero.totalGoldCollected || hero.gold || 0,
      daily_login_day: hero.dailyLoginDay ?? 0,
      daily_login_last_date: hero.dailyLoginLastDate ?? '',
      deaths: hero.deaths,
      str: hero.str,
      agi: hero.agi,
      vit: hero.vit,
      stat_points: hero.statPoints,
      last_wheel_spin_time: hero.lastWheelSpinTime,
      daily_gold_wheel_spins: hero.dailyGoldWheelSpins,
      daily_crystal_wheel_spins: hero.dailyCrystalWheelSpins,
      daily_wheel_spins_date: hero.dailyWheelSpinsDate,
      daily_crystal_to_gold_count: hero.dailyCrystalToGoldCount,
      daily_crystal_to_gold_date: hero.dailyCrystalToGoldDate,
      daily_gold_to_crystal_count: hero.dailyGoldToCrystalCount,
      daily_gold_to_crystal_date: hero.dailyGoldToCrystalDate !== undefined ? String(hero.dailyGoldToCrystalDate) : undefined,
      claimed_mail_gift_ids: hero.claimedMailGiftIds,
      location: screen,
      pyramid_tier: canonicalTier,
      пирамидальный_уровень: canonicalTier,
      row: playerPos.row,
      ряд: playerPos.row,
      col: playerPos.col,
      ц: playerPos.col,
      avatar: hero.avatar,
      owned_skin_ids: hero.ownedSkinIds || [],
      owned_skin_expirations: hero.ownedSkinExpirations || {},
      owned_skins: hero.ownedSkins || [],
      active_skin_id: hero.activeSkinId || null,
      ban_info: hero.banInfo || null,
      is_admin: hero.role === 'admin' || Number((hero as any).is_admin) === 1 ? 1 : 0
    });

    if (financialsChanged) {
      if (fastFlushTimerRef.current) clearTimeout(fastFlushTimerRef.current);
      fastFlushTimerRef.current = setTimeout(() => {
        if (currentUserRef.current && isProfileLoadedRef.current) {
          flushPlayerUpdates(currentUserRef.current, {
            is_online: true,
            last_seen: Date.now()
          });
        }
      }, 250);
    }
  }, [
    hero,
    equipped,
    inventory,
    tradeProtocol,
    screen,
    pyramidTier,
    playerPos,
    currentUser,
    queuePlayerUpdate
  ]);

  // 5-second batched flush to Supabase & online/offline status tracking
  useEffect(() => {
    if (!currentUser) return;

    const markOnline = () => {
      if (!isProfileLoadedRef.current) return;
      flushPlayerUpdates(currentUser, {
        is_online: true,
        last_seen: Date.now(),
        location: livePosRef.current.screen,
        pyramid_tier: livePosRef.current.tier,
        пирамидальный_уровень: livePosRef.current.tier,
        row: livePosRef.current.row,
        ряд: livePosRef.current.row,
        col: livePosRef.current.col,
        ц: livePosRef.current.col
      });
      queueRealtimePlayerSync({
        nick: currentUser,
        location: livePosRef.current.screen,
        pyramidTier: livePosRef.current.tier,
        row: livePosRef.current.row,
        col: livePosRef.current.col,
        isOnline: true
      });
    };

    const markOffline = () => {
      if (!isProfileLoadedRef.current) return;
      flushPlayerUpdates(currentUser, {
        is_online: false,
        last_seen: Date.now(),
        location: livePosRef.current.screen,
        pyramid_tier: livePosRef.current.tier,
        пирамидальный_уровень: livePosRef.current.tier,
        row: livePosRef.current.row,
        ряд: livePosRef.current.row,
        col: livePosRef.current.col,
        ц: livePosRef.current.col
      });
    };

    const batchFlushTimer = setInterval(() => {
      if (!isProfileLoadedRef.current) return;
      if (document.visibilityState !== 'hidden') {
        flushPlayerUpdates(currentUser, {
          is_online: true,
          last_seen: Date.now(),
          location: livePosRef.current.screen,
          pyramid_tier: livePosRef.current.tier,
          пирамидальный_уровень: livePosRef.current.tier,
          row: livePosRef.current.row,
          ряд: livePosRef.current.row,
          col: livePosRef.current.col,
          ц: livePosRef.current.col
        });
      } else if (pendingPlayerUpdatesRef.current) {
        flushPlayerUpdates(currentUser);
      }
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        markOffline();
      } else if (document.visibilityState === 'visible') {
        markOnline();
      }
    };

    const handleBeforeUnload = () => {
      markOffline();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      clearInterval(batchFlushTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      markOffline();
    };
  }, [currentUser, flushPlayerUpdates, queueRealtimePlayerSync]);

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />;
  }

  const isAdmin =
    hero.role === 'admin' ||
    Number((hero as any).is_admin) === 1 ||
    ['redblack', 'redbyl', 'admin'].includes((currentUser || hero.nick || '').trim().toLowerCase());

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#0b0d10] font-sans text-white select-none">
      {/* Mobile-oriented Game Frame container — fits 100% of mobile viewport without scrolling */}
      <div className="relative flex h-[100dvh] max-h-[820px] w-full max-w-[430px] flex-col overflow-hidden border-x border-slate-700 bg-[#151921] shadow-2xl">
        {/* Top User & System Bar — dedicated shrink-0 header bar so HUD below is never clipped or overlapped */}
        <div className="z-30 flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-2 py-1">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setCharacterModalInitialTab(unreadMailCount > 0 ? 'mail' : 'profile');
                setActiveModal('character');
              }}
              className="relative flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[8px] font-bold text-amber-300 hover:border-amber-400 active:scale-95"
              title="Открыть Персонажа и Почту"
            >
              <span>
                {Boolean(hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now())
                  ? '👑 '
                  : '👤 '}
                {currentUser || 'Игрок'}
              </span>
              {(unreadMailCount > 0 || Number(hero.statPoints || 0) > 0) && (
                <span className="ml-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-600 px-1 text-[7px] font-black text-white animate-bounce shadow-[0_0_8px_#ef4444]">
                  {unreadMailCount > 0 ? `📩 ${unreadMailCount}` : `+${hero.statPoints}`}
                </span>
              )}
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveModal('admin')}
                className="flex items-center gap-1 rounded border border-red-500/80 bg-gradient-to-r from-red-950 via-red-900/80 to-red-950 px-2 py-0.5 text-[8px] font-extrabold text-red-200 shadow-[0_0_8px_rgba(239,68,68,0.4)] hover:border-red-400 active:scale-95"
                title="Открыть панель администратора"
              >
                <span>🛠️ Админ</span>
              </button>
            )}

            <div
              title={`Supabase Realtime: ${realtimeStatus}`}
              className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900/90 px-1.5 py-0.5 text-[7.5px] font-bold text-slate-300"
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  realtimeStatus === 'SUBSCRIBED'
                    ? 'bg-emerald-400 animate-pulse'
                    : realtimeStatus === 'CONNECTING'
                    ? 'bg-yellow-400 animate-pulse'
                    : realtimeStatus === 'CHANNEL_ERROR'
                    ? 'bg-red-400'
                    : 'bg-emerald-400'
                }`}
              />
              <span>⚡ Realtime</span>
            </div>
            {/* Daily Login Reward Gift Button */}
            <button
              onClick={() => setActiveModal('dailyReward')}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[8px] font-extrabold shadow transition-all active:scale-95 ${
                dailyRewardStatus.canClaimToday
                  ? 'border border-amber-400 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-bounce'
                  : 'border border-amber-500/40 bg-slate-900 text-amber-300 hover:border-amber-400'
              }`}
              title="Ежедневный вход: 7-дневный календарь наград"
            >
              <span>🎁</span>
              <span>Подарок</span>
              {dailyRewardStatus.canClaimToday && (
                <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-ping" />
              )}
            </button>
          </div>

          {/* Server Time on the right of the top strip */}
          <div className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-[7.5px] font-bold text-amber-300 tabular-nums">
            🕒 {serverTimeStr}
          </div>
        </div>

        {/* Global Toast Alert */}
        {toastMessage && (
          <div className="absolute top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-amber-400 bg-gradient-to-b from-amber-950 via-slate-900 to-black px-4 py-2 text-center text-xs font-bold text-amber-200 shadow-2xl transition-all animate-bounce">
            {toastMessage}
          </div>
        )}

        {/* Full-screen Ban Overlay if player is banned with blockFullAccess */}
        {activeBanInfo && activeBanInfo.blockFullAccess && (
          <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/95 p-5 text-center backdrop-blur-md">
            <div className="w-full max-w-sm rounded-2xl border-2 border-red-500 bg-gradient-to-b from-red-950/90 via-slate-900 to-slate-950 p-5 shadow-[0_0_40px_rgba(239,68,68,0.5)] space-y-3">
              <div className="text-4xl">🚫</div>
              <div className="text-base font-black uppercase tracking-wider text-red-300">
                Персонаж Заблокирован
              </div>
              <div className="rounded-lg border border-red-500/40 bg-black/50 p-3 text-xs text-slate-200 space-y-1.5">
                <div>
                  Игрок: <strong className="text-amber-300">{currentUser}</strong>
                </div>
                <div>
                  Срок блокировки:{' '}
                  <strong className="text-red-400">
                    {activeBanInfo.isPermanent
                      ? 'НАВСЕГДА (Перманентный бан)'
                      : activeBanInfo.until
                      ? `До ${new Date(activeBanInfo.until).toLocaleString('ru-RU')}`
                      : 'На время'}
                  </strong>
                </div>
                <div>
                  Причина:{' '}
                  <strong className="text-white">
                    {activeBanInfo.reason || 'Нарушение правил игры'}
                  </strong>
                </div>
                {activeBanInfo.bannedBy && (
                  <div className="text-[10px] text-slate-400">
                    Администратор: {activeBanInfo.bannedBy}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 pt-2">
                {isAdmin && (
                  <button
                    onClick={() => setActiveModal('admin')}
                    className="w-full rounded-xl border border-amber-400 bg-amber-600 hover:bg-amber-500 py-2.5 text-xs font-black text-slate-950 shadow cursor-pointer"
                  >
                    🛠️ Открыть Админ-панель (Снять бан)
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-black text-white cursor-pointer"
                >
                  🚪 Выйти из аккаунта
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Partial Ban / Penalty Banner */}
        {activeBanInfo && !activeBanInfo.blockFullAccess && (
          <div className="z-20 flex items-center justify-between gap-2 bg-red-950/95 border-b border-red-500/60 px-2.5 py-1 text-[9px] text-red-200 shrink-0">
            <div className="truncate">
              🚫 <strong>Бан ({activeBanInfo.isPermanent ? 'НАВСЕГДА' : activeBanInfo.until ? `до ${new Date(activeBanInfo.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Активен'}):</strong>{' '}
              {activeBanInfo.reason || 'Ограничения'}{' '}
              {((activeBanInfo.expPenaltyPct ?? 0) > 0 || (activeBanInfo.goldPenaltyPct ?? 0) > 0) && (
                <span className="text-amber-300 font-bold">
                  [Штраф: {(activeBanInfo.expPenaltyPct ?? 0) > 0 ? `-${activeBanInfo.expPenaltyPct}% EXP ` : ''}
                  {(activeBanInfo.goldPenaltyPct ?? 0) > 0 ? `-${activeBanInfo.goldPenaltyPct}% Золота` : ''}]
                </span>
              )}
            </div>
          </div>
        )}

        {/* 1. TOP 60% SCREEN (CITY OR PYRAMID) */}
        {screen === 'city' ? (
          <CityScreen
            currentUser={currentUser}
            hero={hero}
            soundMuted={soundMuted}
            unreadMailCount={unreadMailCount}
            onToggleSound={handleToggleSound}
            onOpenCharModal={() => {
              setCharacterModalInitialTab('profile');
              setActiveModal('character');
            }}
            onOpenMailModal={() => {
              setCharacterModalInitialTab('mail');
              setActiveModal('character');
            }}
            onEnterPyramid={handleEnterPyramid}
            onOpenShop={() => setActiveModal('shop')}
            onOpenDailyReward={() => setActiveModal('dailyReward')}
            canClaimDailyReward={dailyRewardStatus.canClaimToday}
            onOpenAuction={() => {
              if (checkBanRestriction('blockTradeAndAuction', 'Аукцион и торговля')) return;
              setActiveModal('auction');
            }}
            onOpenInventory={() => setActiveModal('inventory')}
            onOpenWheel={() => {
              if (checkBanRestriction('blockRoulette', 'Колесо Рулетки')) return;
              setActiveModal('wheel');
            }}
            onOpenPremium={() => setActiveModal('premium')}
            onOpenCreateItem={() => setActiveModal('createItem')}
            onOpenAdmin={() => setActiveModal('admin')}
            onOpenBank={() => setActiveModal('bank')}
            onOpenLeaderboard={() => setActiveModal('leaderboard')}
            onOpenClans={() => {
              if (checkBanRestriction('blockClans', 'Кланы и клановая база')) return;
              setActiveModal('clans');
            }}
            onOpenClanPyramid={() => {
              if (checkBanRestriction('blockClanPyramid', 'Клановая Пирамида')) return;
              setActiveModal('clanPyramid');
            }}
            onUsePotion={handleUsePotion}
            isAdmin={isAdmin}
            featureFlags={featureFlags}
          />
        ) : (
          <PyramidScreen
            hero={hero}
            pyramidTier={pyramidTier}
            pyramidMap={pyramidMap}
            playerPos={playerPos}
            lastMoveTime={lastMoveTime}
            moveDelay={MOVE_DELAY}
            respawnTimeLeft={Math.max(0, (featureFlags.bossRespawnIntervalSec || 60) - Math.floor((Date.now() - lastRespawnTime) / 1000))}
            activeSack={activeSackAdjacent}
            damagePopups={damagePopups}
            rareBossTimers={rareBossTimers}
            realtimePlayers={realtimePlayers}
            currentUser={currentUser}
            unreadMailCount={unreadMailCount}
            onPickUpSack={handlePickUpSack}
            onBlockClick={handlePyramidBlockClick}
            onExitToCity={handleExitToCity}
            onUsePotion={handleUsePotion}
            onOpenCharModal={() => {
              setCharacterModalInitialTab(unreadMailCount > 0 ? 'mail' : 'profile');
              setActiveModal('character');
            }}
          />
        )}

        {/* 2. BOTTOM 40% SCREEN (CHAT, COMBAT LOG & ONLINE) */}
        <ChatAndOnline
          messages={chatMessages}
          friends={friends}
          activeChannel={activeChatChannel}
          combatLog={combatLog}
          playersInPyramid={pyramidPlayersInPyramid}
          heroLocation={screen}
          heroPyramidTier={pyramidTier}
          currentUser={currentUser}
          heroLevel={hero.level}
          heroAvatar={hero.avatar}
          heroIsPremium={Boolean(
            hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now()
          )}
          equipped={equipped}
          onOpenCharModal={() => {
            setCharacterModalInitialTab(unreadMailCount > 0 ? 'mail' : 'profile');
            setActiveModal('character');
          }}
          realtimePlayers={realtimePlayers}
          realtimeStatus={realtimeStatus}
          isAdmin={isAdmin}
          onSwitchChannel={setActiveChatChannel}
          onClearCombatLog={() => setCombatLog([])}
          onSendMessage={handleSendMessage}
          onDeleteMessage={handleDeleteChatMessage}
          onInspectPlayer={(nick) => setInspectedNick(nick)}
        />

        {/* Game Version & Last Updated Footer Bar */}
        <div className="flex items-center justify-center bg-black/95 border-t border-slate-900 py-0.5 px-2 text-[8.5px] text-slate-400 gap-2 shrink-0">
          <span>Версия: <strong className="text-amber-400">v1.0.60</strong></span>
          <span>|</span>
          <span>Обновлено: <strong className="text-slate-300">24.10.2026</strong></span>
        </div>


        {/* ================= MODALS OVERLAYS ================= */}

        {/* Character Modal */}
        {activeModal === 'character' && (
          <CharacterModal
            currentUser={currentUser}
            hero={hero}
            equipped={equipped}
            tradeCount={tradeProtocol.length}
            initialTab={characterModalInitialTab}
            mailMessages={mailMessages}
            unreadMailCount={unreadMailCount}
            shopSkins={shopSkins}
            onEquipSkin={handleEquipSkin}
            knownPlayers={Array.from(
              new Set([
                ...realtimePlayers.map((p) => p.nick),
                ...friends.map((f) => f.nick)
              ])
            )}
            onClose={() => setActiveModal(null)}
            onUnequip={handleUnequipItem}
            onOpenStats={() => setActiveModal('stats')}
            onOpenTradeProtocol={() => setActiveModal('protocol')}
            onOpenFriends={() => setActiveModal('friends')}
            onOpenDirectTransfer={() => setActiveModal('directTransfer')}
            onOpenInventory={() => setActiveModal('inventory')}
            onOpenShop={() => setActiveModal('shop')}
            onOpenCreateItem={() => setActiveModal('createItem')}
            onOpenPremium={() => setActiveModal('premium')}
            onOpenLeaderboard={() => setActiveModal('leaderboard')}
            onSendMail={handleSendSMS}
            onMarkMailRead={handleMarkMailRead}
            onClaimMailGift={handleClaimMailGift}
            onClaimReferralReward={handleClaimReferralReward}
            onLogout={handleLogout}
          />
        )}

        {/* Inventory Modal */}
        {activeModal === 'inventory' && (
          <InventoryModal
            hero={hero}
            equipped={equipped}
            inventory={inventory}
            onClose={() => setActiveModal(null)}
            onUsePotion={handleUsePotion}
            onEquipItem={handleEquipItem}
            onOpenCreateItem={() => setActiveModal('createItem')}
            onOpenTransfer={(item) => {
              if (!canTransferCustomItem(item)) {
                showToast('🔒 Это созданное оружие нельзя передавать — только вы можете его носить!');
                return;
              }
              setSelectedItemForAction(item);
              setItemActionMode('transfer');
            }}
            onOpenRent={(item) => {
              setSelectedItemForAction(item);
              setItemActionMode('rent');
            }}
            onOpenAuction={(item) => {
              if (!canAuctionItem(item)) {
                showToast('🚫 Созданное оружие нельзя выставить на аукцион!');
                return;
              }
              setSelectedItemForAction(item);
              setItemActionMode('auction');
            }}
            onReturnRentEarly={handleReturnRentEarly}
            onSellItem={handleSellItem}
          />
        )}

        {/* Shop Modal */}
        {activeModal === 'shop' && (
          <ShopModal
            hero={hero}
            inventory={inventory}
            shopItems={shopCatalog}
            shopSkins={shopSkins}
            onBuyItem={handleBuyShopItem}
            onBuySkin={handleBuySkin}
            onEquipSkin={handleEquipSkin}
            onBuyElixir={handleBuyElixir}
            onOpenAuction={() => {
              if (checkBanRestriction('blockTradeAndAuction', 'Аукцион и торговля')) return;
              setActiveModal('auction');
            }}
            onOpenCreateItem={() => setActiveModal('createItem')}
            onClose={() => setActiveModal(null)}
          />
        )}

        {/* Auction Modal */}
        {activeModal === 'auction' && (
          <AuctionModal
            currentUser={currentUser}
            hero={hero}
            market={market}
            inventory={inventory}
            onClose={() => setActiveModal(null)}
            onBuyoutLot={handleBuyoutLot}
            onBidLot={handleBidLot}
            onCancelLot={handleCancelAuctionLot}
            onOpenInventoryToList={() => setActiveModal('inventory')}
            onBuyElixir={handleBuyElixir}
            onSellElixir={handleSellElixir}
            onListElixirLot={handleListElixirLot}
          />
        )}


        {/* CS2 Wheel Modal */}
        {activeModal === 'wheel' && (
          <CS2WheelModal
            hero={hero}
            currentUser={currentUser}
            shopSkins={shopSkins}
            wheelWinners={wheelWinners}
            onClose={() => setActiveModal(null)}
            onRewardReceived={handleRouletteReward}
            onWinnerLogged={handleWheelWinnerLogged}
            onInspectPlayer={(nick) => {
              setActiveModal(null);
              setInspectedNick(nick);
            }}
            onSpinStarted={(mode, ts, todayKey) => {
              setHero((prev) => {
                const prevGoldSpins =
                  prev.dailyWheelSpinsDate === todayKey
                    ? prev.dailyGoldWheelSpins || 0
                    : 0;
                const prevCrystalSpins =
                  prev.dailyWheelSpinsDate === todayKey
                    ? prev.dailyCrystalWheelSpins || 0
                    : 0;
                const nextLastSpin = mode === 'free' ? ts : prev.lastWheelSpinTime;
                const nextGoldSpins = mode === 'gold' ? prevGoldSpins + 1 : prevGoldSpins;
                const nextCrystalSpins = mode === 'crystals' ? prevCrystalSpins + 1 : prevCrystalSpins;

                if (currentUser) {
                  flushPlayerUpdates(currentUser, {
                    last_wheel_spin_time: nextLastSpin,
                    daily_gold_wheel_spins: nextGoldSpins,
                    daily_crystal_wheel_spins: nextCrystalSpins,
                    daily_wheel_spins_date: todayKey
                  });
                }

                return {
                  ...prev,
                  lastWheelSpinTime: nextLastSpin,
                  lastGoldWheelSpinTime:
                    mode === 'gold' ? ts : prev.lastGoldWheelSpinTime,
                  dailyGoldWheelSpins: nextGoldSpins,
                  dailyCrystalWheelSpins: nextCrystalSpins,
                  dailyWheelSpinsDate: todayKey
                };
              });
            }}
            onSpinCompleted={(ts, spinType) => {
              const { todayKey } = getRouletteResetInfo(ts);
              if (currentUser) {
                flushPlayerUpdates(currentUser, {
                  last_wheel_spin_time:
                    spinType === 'free' ? ts : hero.lastWheelSpinTime,
                  daily_wheel_spins_date: todayKey
                });
              }
            }}
            onDeductCrystals={(amount) => {
              setHero((prev) => {
                const nextCrystals = Math.max(0, prev.crystals - amount);
                lastSyncedFinancialsRef.current = {
                  ...lastSyncedFinancialsRef.current,
                  crystals: nextCrystals,
                  updatedAt: Date.now()
                };
                if (currentUser) {
                  flushPlayerUpdates(currentUser, { crystals: nextCrystals });
                }
                return {
                  ...prev,
                  crystals: nextCrystals
                };
              });
            }}
            onDeductGold={(amount) => {
              setHero((prev) => {
                const nextGold = Math.max(0, prev.gold - amount);
                lastSyncedFinancialsRef.current = {
                  ...lastSyncedFinancialsRef.current,
                  gold: nextGold,
                  updatedAt: Date.now()
                };
                if (currentUser) {
                  flushPlayerUpdates(currentUser, { gold: nextGold });
                }
                return {
                  ...prev,
                  gold: nextGold
                };
              });
            }}
          />
        )}

        {/* Premium Modal */}
        {activeModal === 'premium' && (
          <PremiumModal
            hero={hero}
            featureFlags={featureFlags}
            onClose={() => setActiveModal(null)}
            onBuyPremium={handleBuyPremium}
          />
        )}

        {/* Menu Modal */}
        {activeModal === 'menu' && (
          <MenuModal
            hero={hero}
            unreadMailCount={unreadMailCount}
            onClose={() => setActiveModal(null)}
            onOpenStats={() => setActiveModal('stats')}
            onOpenTradeProtocol={() => setActiveModal('protocol')}
            onOpenFriends={() => setActiveModal('friends')}
            onOpenDirectTransfer={() => {
              setTransferPrefillNick('');
              setActiveModal('directTransfer');
            }}
            onOpenMail={() => {
              setCharacterModalInitialTab('mail');
              setActiveModal('character');
            }}
          />
        )}

        {/* Create Item Modal */}
        {activeModal === 'createItem' && (
          <CreateItemModal
            hero={{ ...hero, nick: currentUser || hero.nick || 'Игрок' }}
            featureFlags={featureFlags}
            isAdmin={isAdmin}
            onClose={() => setActiveModal(null)}
            onForgeItem={handleForgeItem}
            onOpenAdminCreation={() => {
              setAdminModalInitialTab('creation');
              setActiveModal('admin');
            }}
            showToast={showToast}
          />
        )}

        {/* Stats Modal */}
        {activeModal === 'stats' && (
          <StatsModal
            hero={hero}
            onClose={() => setActiveModal(null)}
            onAllocateStat={handleAllocateStat}
          />
        )}

        {/* Trade Protocol Modal */}
        {activeModal === 'protocol' && (
          <TradeProtocolModal
            hero={hero}
            tradeProtocol={tradeProtocol}
            onClose={() => setActiveModal(null)}
          />
        )}

        {/* Friends Modal */}
        {activeModal === 'friends' && (
          <FriendsModal
            hero={hero}
            friends={friends}
            realtimePlayers={realtimePlayers}
            onClose={() => setActiveModal(null)}
            onAddFriend={handleAddFriend}
            onOpenTransferModal={(nick) => {
              setTransferPrefillNick(nick);
              setActiveModal('directTransfer');
            }}
            onInspect={(nick) => setInspectedNick(nick)}
          />
        )}

        {/* Direct Gold Transfer Modal */}
        {activeModal === 'directTransfer' && (
          <DirectTransferModal
            hero={hero}
            friends={friends}
            prefillNick={transferPrefillNick}
            onClose={() => {
              setActiveModal(null);
              setTransferPrefillNick('');
            }}
            onExecuteTransfer={handleDirectGoldTransfer}
          />
        )}

        {/* Admin Modal */}
        {activeModal === 'admin' && (
          <AdminModal
            onClose={() => {
              setActiveModal(null);
              setAdminModalInitialTab('players');
            }}
            initialTab={adminModalInitialTab}
            hero={{ ...hero, nick: currentUser || hero.nick || 'Игрок' }}
            setHero={setHero}
            equipped={equipped}
            setEquipped={setEquipped}
            inventory={inventory}
            setInventory={setInventory}
            onlinePlayers={realtimePlayers}
            setChatMessages={setChatMessages}
            setPrivateMessages={setMailMessages}
            showToast={showToast}
            onClearWorldChat={handleClearWorldChat}
            onRefreshOnlinePlayers={async () => {
              const players = await fetchInitialPlayers();
              if (players && players.length > 0) {
                setRealtimePlayers(players);
              }
            }}
            onBroadcastSystemMessage={(text) => {
              const sysMsg: ChatMessage = {
                id: 'sys_admin_' + Date.now(),
                author: '👑 АДМИНИСТРАТОР',
                text,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                channel: 'world',
                isSystem: true
              };
              setChatMessages((prev) => [...prev, sysMsg]);
              broadcastWorldChatMessageInSupabase(sysMsg);
            }}
            onForceSavePlayer={(overrideHero) => {
              const h = overrideHero || heroRef.current || hero;
              heroRef.current = h;
              if (!currentUser) return;
              const nextTier = getPyramidTierForLevel(h.level);
              setPyramidTier(nextTier);
              lastSyncedFinancialsRef.current = {
                gold: h.gold,
                crystals: h.crystals,
                lvl: h.level,
                exp: h.exp,
                premiumUntil: h.premiumUntil || 0,
                updatedAt: Date.now()
              };
              flushPlayerUpdates(currentUser, {
                gold: h.gold,
                crystals: h.crystals,
                lvl: h.level,
                exp: h.exp,
                hp: h.hp,
                max_hp: h.maxHp,
                energy: h.energy,
                max_energy: h.maxEnergy,
                hp_potions: h.hpPotions,
                en_potions: h.enPotions,
                bag_capacity: h.bagCapacity,
                str: h.str,
                agi: h.agi,
                vit: h.vit,
                stat_points: h.statPoints,
                pyramid_tier: nextTier,
                пирамидальный_уровень: nextTier,
                is_premium: Boolean(h.isPremium && h.premiumUntil && h.premiumUntil > Date.now()),
                premium_until: h.premiumUntil || 0,
                owned_skin_ids: h.ownedSkinIds || [],
                owned_skin_expirations: h.ownedSkinExpirations || {},
                owned_skins: h.ownedSkins || [],
                active_skin_id: h.activeSkinId || null,
                avatar: h.avatar,
                external_sync_ts: Date.now(),
                is_admin_action: true
              });
            }}
            onSpawnPortal={() => {
              if (screen === 'pyramid' && pyramidMap.length > 0) {
                const newMap = pyramidMap.map((rowArr, rI) =>
                  rowArr.map((cell, cI) => {
                    if (rI === playerPos.row && cI === playerPos.col) {
                      return { type: 'nextTier' as const };
                    }
                    return cell;
                  })
                );
                setPyramidMap(newMap);
                savePyramidTierToSupabase(
                  pyramidTier,
                  newMap,
                  pyramidSeedRef.current,
                  lastRespawnTime,
                  currentUser || 'admin'
                );
                showToast('🌀 Портал создан прямо под вами!');
                setActiveModal(null);
              } else {
                showToast('Войдите в пирамиду, чтобы открыть портал!');
              }
            }}
            onResetMap={() => {
              generateNewPyramid(pyramidTier, playerPos, true);
              showToast('🔄 Карта пирамиды синхронизирована для всех игроков!');
            }}
            onSpawnBossesInAllPyramids={async () => {
              try {
                showToast('⏳ Призываю боссов во всех пирамидах...');
                const tiers = [1, 2, 3];
                for (const t of tiers) {
                  const tierState = await fetchPyramidTierFromSupabase(t);
                  const curSeed = tierState.seed || (Math.floor(Date.now() / 60000) * 100 + t);
                  const rawMap =
                    tierState.cells && tierState.cells.length > 0
                      ? sanitizePyramidCellsForStorage(tierState.cells)
                      : generateDeterministicPyramidCells(t, curSeed, ROWS_COUNT, []);

                  const nextRand = () => Math.random();
                  const bossTemplate = getPyramidMob(t, 0, true, nextRand(), nextRand());
                  const updated = rawMap.map((rowArr, rI) =>
                    rowArr.map((cell, cI) => {
                      if (rI === 0 && cI === 0) {
                        return {
                          type: 'mob' as const,
                          mobLvl: bossTemplate.lvl,
                          mobHp: bossTemplate.hp,
                          mobMaxHp: bossTemplate.hp,
                          mobDmg: bossTemplate.dmg,
                          isBoss: true,
                          mobName: bossTemplate.name,
                          icon: bossTemplate.icon
                        };
                      }
                      if (cell.type === 'nextTier' || cell.type === 'portal') {
                        return { type: 'empty' as const };
                      }
                      return cell;
                    })
                  );

                  await savePyramidTierToSupabase(
                    t,
                    updated,
                    curSeed,
                    Date.now(),
                    currentUser || 'admin'
                  );

                  if (screen === 'pyramid' && pyramidTierRef.current === t) {
                    setPyramidMap(updated);
                  }
                }

                const alertMsg = '👑 Верховные боссы призваны во всех 3 пирамидах!';
                showToast(alertMsg);
                addCombatLog(alertMsg, 'loot');
              } catch (e) {
                console.warn('Error spawning bosses:', e);
                showToast('⚠️ Ошибка при призыве боссов во всех пирамидах');
              }
            }}
            onShopAndFeaturesUpdated={(catalog, flags, skins) => {
              setShopCatalog(catalog);
              setFeatureFlags(flags);
              if (skins) setShopSkins(skins);
              setHero((prev) => recalcGear(equippedRef.current, prev));
            }}
          />
        )}

        {/* Item Interaction Dialog (Transfer, Rent, Auction) */}
        {selectedItemForAction && itemActionMode && (
          <ItemActionModal
            item={selectedItemForAction}
            mode={itemActionMode}
            friends={friends}
            onClose={() => {
              setSelectedItemForAction(null);
              setItemActionMode(null);
            }}
            onConfirmTransfer={handleConfirmTransfer}
            onConfirmRent={handleConfirmRent}
            onConfirmAuction={handleConfirmAuction}
          />
        )}

        {/* Bank & Currency Exchange Modal */}
        {activeModal === 'bank' && (
          <BankAndForgeModal
            hero={hero}
            equipped={equipped}
            inventory={inventory}
            onClose={() => setActiveModal(null)}
            onAddCrystals={handleBankAddCrystals}
            onExchangeGoldToCrystals={handleBankExchange}
            onForgeItem={handleBankForgeItem}
            onBuyPremium={handleBuyPremium}
            showToast={showToast}
            exchangeDisabled={!featureFlags.exchangeEnabled}
            premiumDisabled={!featureFlags.premiumEnabled}
            featureFlags={featureFlags}
          />
        )}

        {/* Leaderboard / Rating Modal */}
        {activeModal === 'leaderboard' && (
          <LeaderboardModal
            currentUser={currentUser}
            onClose={() => setActiveModal(null)}
            onInspectPlayer={(targetNick) => setInspectedNick(targetNick)}
          />
        )}

        {/* Daily Login Reward Modal */}
        {activeModal === 'dailyReward' && (
          <DailyRewardModal
            hero={hero}
            currentUser={currentUser}
            onClose={() => setActiveModal(null)}
            onClaimReward={handleClaimDailyReward}
          />
        )}

        {/* Clan System Modal */}
        {activeModal === 'clans' && (
          <ClanModal
            currentUser={currentUser}
            hero={hero}
            inventory={inventory}
            isAdmin={isAdmin}
            onClose={() => setActiveModal(null)}
            onUpdateHero={(updated: Partial<HeroState>) => {
              setHero((prev) => {
                const next = { ...prev, ...updated };
                heroRef.current = next;
                if (currentUser) {
                  flushPlayerUpdates(currentUser, updated);
                }
                return next;
              });
            }}
            onUpdateInventory={(updated) => {
              setInventory(updated);
              inventoryRef.current = updated;
              if (currentUser) {
                flushPlayerUpdates(currentUser, { inventory: updated });
              }
            }}
            showToast={showToast}
            onOpenClanPyramid={() => setActiveModal('clanPyramid')}
          />
        )}

        {/* Clan Pyramid Modal */}
        {activeModal === 'clanPyramid' && (
          <ClanPyramidModal
            currentUser={currentUser}
            hero={hero}
            isAdmin={isAdmin}
            realtimePlayers={realtimePlayers}
            onInspectPlayer={(nick) => setInspectedNick(nick)}
            onClose={() => setActiveModal(null)}
            onOpenClansTab={() => setActiveModal('clans')}
            onUsePotion={handleUsePotion}
            onOpenAdminClanPyramid={() => {
              setAdminModalInitialTab('clanPyramid');
              setActiveModal('admin');
            }}
            onUpdateHero={(updated: Partial<HeroState>) => {
              lastRegenTickAtRef.current = Date.now();
              setHero((prev) => {
                const next = { ...prev, ...updated };
                heroRef.current = next;
                if (currentUser) {
                  flushPlayerUpdates(currentUser, {
                    ...updated,
                    is_online: true,
                    last_seen: Date.now()
                  });
                }
                return next;
              });
            }}
            showToast={showToast}
          />
        )}

        {/* Player Profile Inspection */}
        {inspectedNick && (
          <InspectPlayerModal
            nick={inspectedNick}
            targetPlayer={
              realtimePlayers.find(
                (p) => p.nick.toLowerCase() === inspectedNick.toLowerCase()
              ) || null
            }
            isFriend={friends.some((f) => f.nick.toLowerCase() === inspectedNick.toLowerCase())}
            isHeroInPyramid={screen === 'pyramid'}
            isTargetInPyramid={pyramidPlayersInPyramid.includes(inspectedNick)}
            onClose={() => setInspectedNick(null)}
            onOpenTransferModal={(targetNick) => {
              setTransferPrefillNick(targetNick);
              setActiveModal('directTransfer');
            }}
            onAddFriend={handleAddFriend}
            onSendSMS={handleSendSMS}
            onOpenItemTransfer={(targetNick) => {
              setActiveModal('inventory');
              showToast(`📦 Выберите предмет в сумке и нажмите «Передать» для ${targetNick}`);
            }}
            onAttackPvP={handleAttackPlayer}
          />
        )}
      </div>
    </div>
  );
}
