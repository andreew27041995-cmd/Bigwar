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
  LootHistoryEntry,
  RareBossTimerState,
  WheelWinnerEntry,
  ItemQualityKey,
  DailyQuest
} from './types/game';
import {
  loadGameFromStorage,
  saveGameToStorage,
  resetGameStorage,
  getCurrentUserNick,
  setCurrentUserNick
} from './utils/storage';
import { AuthScreen, SocialAuthPayload } from './components/AuthScreen';
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
  isCustomCreatedItem,
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
  KILLER_LICENSE_CONFIG,
  getKillerAchievementInfo,
  formatLicenseRemainingTime,
  calculateKillerStunChance
} from './utils/egyptianEquipment';
import {
  playStepSound,
  playAttackSound,
  playLootSound,
  playCoinSound,
  playLevelUpSound,
  toggleSound,
  isSoundEnabled
} from './utils/audio';
import {
  NPC_CONFIG,
  createDefaultNpcCompanion,
  getNpcEffectiveStats,
  simulateNpcProgress,
  getNpcTemplates,
  getNpcRequiredLevel,
  canPurchaseNpcCompanion,
  NpcTemplate
} from './utils/npcCompanion';

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
import { ForumModal } from './components/modals/ForumModal';
import { TutorialModal } from './components/modals/TutorialModal';
import { AchievementsModal } from './components/modals/AchievementsModal';
import { ModificationAltarModal } from './components/modals/ModificationAltarModal';
import {
  BotSimulationConfig,
  BotCharacter,
  getBotSimulationConfig,
  getRuntimeBots,
  tickBotSimulation,
  convertBotsToRealtimePlayers,
  getRandomBotChatMessage
} from './utils/botSimulation';
import {
  evaluatePlayerAchievements,
  EvaluatedAchievement
} from './utils/achievements';
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
  ensureDailyQuestsForToday,
  advanceDailyQuestProgress,
  getDailyQuestsSummary,
  GRAND_DAILY_CRYSTAL_CHEST
} from './utils/dailyQuests';
import {
  RealtimePlayer,
  RealtimeConnectionStatus,
  PyramidTierState,
  subscribeToPlayersRealtime,
  subscribeToPyramidTierRealtime,
  fetchInitialPlayers,
  syncPlayerToSupabase,
  authenticatePlayerInSupabase,
  authenticateOrRegisterSocialPlayerInSupabase,
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
  clearRecentWorldChatMessagesInSupabase,
  transferGoldBetweenPlayersInSupabase,
  transferItemBetweenPlayersInSupabase,
  applyCompensationBonusToAllPlayers
} from './utils/supabase';
import { findMonsterConfigByName, syncMonsterConfigsFromSupabase } from './utils/monsterConfig';
import {
  AiPlayerAdviceEntry,
  AI_CATEGORY_META,
  generateSmartPlayerAdviceWithServer,
  updatePlayerAdviceStatus,
  loadAiMonitoringState
} from './utils/aiMonitoring';

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
  const [screenFadeOverlay, setScreenFadeOverlay] = useState<{ active: boolean; label: string }>({
    active: false,
    label: ''
  });
  const screenFadeTimerRef = useRef<number | null>(null);
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
  const [lastRespawnTime, setLastRespawnTime] = useState<number>(Date.now());
  const [activeAiAdviceCard, setActiveAiAdviceCard] = useState<AiPlayerAdviceEntry | null>(null);
  const [isAiAdvisorBusy, setIsAiAdvisorBusy] = useState<boolean>(false);

  // Pyramid Crawler State — strictly bound to player level (1-5 -> P1, 6-10 -> P2, 11-20 -> P3)
  const [pyramidTier, setPyramidTier] = useState<number>(
    getPyramidTierForLevel(initialData.hero.level || 1)
  );
  const [pyramidMap, setPyramidMap] = useState<PyramidCell[][]>(initialData.pyramidMap);
  const [playerPos, setPlayerPos] = useState<PlayerPosition>(initialData.playerPos);
  const [lastMoveTime, setLastMoveTime] = useState<number>(0);

  // Chat, Private Messages & Combat Log Tabs State
  const [activeChatChannel, setActiveChatChannel] = useState<'world' | 'general' | 'private' | 'combatLog'>('world');
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
    | 'forum'
    | 'tutorial'
    | 'achievements'
    | 'altar'
  >(null);
  const [altarInitialItemId, setAltarInitialItemId] = useState<string | null>(null);
  const [characterModalInitialTab, setCharacterModalInitialTab] = useState<'profile' | 'mail' | 'collection' | 'npcBag' | 'lootHistory' | 'achievements'>('profile');
  const [dailyModalInitialTab, setDailyModalInitialTab] = useState<'quests' | 'login'>('quests');
  const [adminModalInitialTab, setAdminModalInitialTab] = useState<
    'ai' | 'players' | 'bosses' | 'monsters' | 'shop' | 'creation' | 'server' | 'clans' | 'clanPyramid' | 'roulette' | 'bank' | 'orders' | 'npc' | 'vip' | 'scarabTournament' | 'bots'
  >('ai');
  const activeModalRef = useRef(activeModal);
  activeModalRef.current = activeModal;
  const lastNpcSyncRef = useRef<number>(0);

  // Shop Catalog, Character Skins & Feature Flags state
  const [shopCatalog, setShopCatalog] = useState<ShopItemTemplate[]>(() => getShopCatalog());
  const [shopSkins, setShopSkins] = useState<CharacterSkinTemplate[]>(() => getShopSkins());
  const [featureFlags, setFeatureFlags] = useState<GlobalFeatureFlags>(() => getFeatureFlags());

  // Personal Combat Log for Pyramid screen (replaces intrusive monster hit popups)
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);
  // Session Loot History (last 20 monsters killed and chests/sacks opened during current session)
  const [sessionLootHistory, setSessionLootHistory] = useState<LootHistoryEntry[]>([]);

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

  // Fake Online & Bot Chat Simulation State
  const [botSimulationConfig, setBotSimulationConfig] = useState<BotSimulationConfig>(() =>
    getBotSimulationConfig()
  );
  const [simulatedBots, setSimulatedBots] = useState<BotCharacter[]>(() =>
    getRuntimeBots(botSimulationConfig.targetOnlineCount)
  );

  // Periodic Bot Movement & Online Simulation Loop (runs every 7.5s)
  useEffect(() => {
    if (!botSimulationConfig.enabled) return;
    const interval = setInterval(() => {
      const updated = tickBotSimulation(botSimulationConfig);
      setSimulatedBots([...updated]);
    }, 7500);
    return () => clearInterval(interval);
  }, [botSimulationConfig]);

  // Periodic Bot Auto-Chat Loop (natural conversational delays)
  useEffect(() => {
    if (!botSimulationConfig.enabled || !botSimulationConfig.chatEnabled) return;
    let timerId: number;
    const scheduleNext = () => {
      const minMs = Math.max(5, botSimulationConfig.chatMinDelaySec) * 1000;
      const maxMs = Math.max(minMs + 2000, botSimulationConfig.chatMaxDelaySec * 1000);
      const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
      timerId = window.setTimeout(() => {
        const botMsg = getRandomBotChatMessage(botSimulationConfig);
        if (botMsg) {
          const now = new Date();
          const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const newChatMsg: ChatMessage = {
            id: `bot_chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            time: timeStr,
            author: botMsg.author,
            text: botMsg.text,
            channel: botMsg.channel,
            timestamp: Date.now()
          };
          setChatMessages((prev) => [...prev, newChatMsg]);
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => window.clearTimeout(timerId);
  }, [botSimulationConfig]);

  // Effective Realtime Players blending real connected users with simulated online bots
  const effectiveRealtimePlayers = useMemo(() => {
    if (!botSimulationConfig.enabled) {
      return realtimePlayers;
    }
    const botRealtime = convertBotsToRealtimePlayers(simulatedBots);
    const realNicks = new Set(realtimePlayers.map((p) => p.nick.toLowerCase()));
    const filteredBots = botRealtime.filter((b) => !realNicks.has(b.nick.toLowerCase()));
    return [...realtimePlayers, ...filteredBots];
  }, [realtimePlayers, simulatedBots, botSimulationConfig.enabled]);

  // Server clock
  const [serverTimeStr, setServerTimeStr] = useState<string>(() =>
    new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  );
  const [pyramidPlayersInPyramid, setPyramidPlayersInPyramid] = useState<string[]>([]);
  const [rareBossTimers, setRareBossTimers] = useState<RareBossTimerState[]>(() =>
    createDefaultRareBossTimers(Date.now())
  );
  const rareBossTimersRef = useRef<RareBossTimerState[]>(rareBossTimers);
  useEffect(() => {
    rareBossTimersRef.current = rareBossTimers;
  }, [rareBossTimers]);

  // Refs for stable 1-second timer loop without tearing down interval on player/map updates
  const realtimePlayersRef = useRef<RealtimePlayer[]>(effectiveRealtimePlayers);
  useEffect(() => {
    realtimePlayersRef.current = effectiveRealtimePlayers;
  }, [effectiveRealtimePlayers]);

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
            bosses_killed: curHero.bossesKilled || 0,
            bossesKilled: curHero.bossesKilled || 0,
            items_sold: curHero.itemsSold || 0,
            itemsSold: curHero.itemsSold || 0,
            total_gold_collected: curHero.totalGoldCollected || curHero.gold || 0,
            claimed_achievement_ids: curHero.claimedAchievementIds || [],
            claimedAchievementIds: curHero.claimedAchievementIds || [],
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
            npc_companion: curHero.npcCompanion ?? null,
            ban_info: curHero.banInfo || null,
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

  const addLootHistoryEntry = useCallback(
    (entry: Omit<LootHistoryEntry, 'id' | 'timestamp' | 'timeStr'>) => {
      const now = Date.now();
      const timeStr = new Date(now).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      setSessionLootHistory((prev) =>
        [
          {
            ...entry,
            id: `loot_${now}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: now,
            timeStr
          },
          ...prev
        ].slice(0, 20)
      );
    },
    []
  );

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
        if (it && Number(it.durability ?? 1) > 0) {
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

      // Add active character skin bonuses & synchronize active skin avatar sprite
      const skinBonuses = getActiveSkinBonuses(currentHero.activeSkinId, undefined, currentHero.ownedSkins);
      let resolvedSkinAvatar = currentHero.avatar;
      if (currentHero.activeSkinId) {
        const ownedResolved = resolvePlayerOwnedSkins(
          currentHero.ownedSkinIds,
          currentHero.ownedSkinExpirations,
          undefined,
          currentHero.ownedSkins,
          currentHero.activeSkinId,
          currentHero.avatar
        );
        const activeSkinObj = ownedResolved.find((s) => s.id === currentHero.activeSkinId);
        if (activeSkinObj && (activeSkinObj.avatarUrl || activeSkinObj.icon)) {
          resolvedSkinAvatar = activeSkinObj.avatarUrl || activeSkinObj.icon;
        }
      }
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
        avatar: resolvedSkinAvatar,
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
      setHero((prev) => {
        const wasFullHp = prev.maxHp > 0 && prev.hp >= prev.maxHp;
        const wasFullEn = prev.maxEnergy > 0 && prev.energy >= prev.maxEnergy;
        const next = recalcGear(equippedRef.current, prev);
        if (wasFullHp && next.maxHp > next.hp) next.hp = next.maxHp;
        if (wasFullEn && next.maxEnergy > next.energy) next.energy = next.maxEnergy;
        heroRef.current = next;
        return next;
      });
    });
    syncClansFromSupabase().then(() => {
      syncClanPyramidFromSupabase().then(() => {
        setHero((prev) => {
          const wasFullHp = prev.maxHp > 0 && prev.hp >= prev.maxHp;
          const wasFullEn = prev.maxEnergy > 0 && prev.energy >= prev.maxEnergy;
          const next = recalcGear(equippedRef.current, prev);
          if (wasFullHp && next.maxHp > next.hp) next.hp = next.maxHp;
          if (wasFullEn && next.maxEnergy > next.energy) next.energy = next.maxEnergy;
          heroRef.current = next;
          return next;
        });
      });
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

  // Live Server clock interval (1s interval, formatted HH:MM:SS)
  useEffect(() => {
    const updateClock = () => {
      setServerTimeStr(
        new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    };
    updateClock();
    const clockTimer = setInterval(updateClock, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Rent check timer & Natural HP/Energy Regen (timestamp-based so it works identically across tab switches and re-renders)
  const lastRegenTickAtRef = useRef<number>(Date.now());
  useEffect(() => {
    lastRegenTickAtRef.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();

      // 1. Check expired rents in inventory and send system chat notification
      setInventory((prevInv) => {
        let changed = false;
        const expiredNotifications: { item: GameItem; renter: string }[] = [];
        const updated = prevInv.map((item) => {
          if (item.rent && item.rent.until && now >= item.rent.until && !item.rent.expiredNotified) {
            changed = true;
            const renter = item.rent.to || 'Арендатор';
            expiredNotifications.push({ item, renter });
            return {
              ...item,
              rent: {
                ...item.rent,
                expiredNotified: true
              }
            };
          }
          return item;
        });
        if (changed) {
          inventoryRef.current = updated;
          const dateStr = new Date(now).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          });
          expiredNotifications.forEach(({ item, renter }) => {
            const iconTxt = formatItemIconForText(item.icon);
            const expireChatText = `⏳ [Аренда] Срок аренды вашего предмета ${iconTxt} «${item.name}» (арендатор: ${renter}) истёк! Заберите предмет в сумку через «📜 Протокол Сделок».`;
            setChatMessages((prevChat) => [
              ...prevChat,
              {
                id: `rent_exp_w_${item.id}_${now}`,
                time: dateStr,
                author: 'Система',
                text: expireChatText,
                isSystem: true,
                channel: 'world'
              },
              {
                id: `rent_exp_g_${item.id}_${now}`,
                time: dateStr,
                author: 'Система',
                text: expireChatText,
                isSystem: true,
                channel: 'general'
              }
            ]);
            showToast(
              `⏳ Срок аренды предмета «${item.name}» истёк! Заберите его в сумку в Протоколе Сделок.`
            );
          });
        }
        return changed ? updated : prevInv;
      });

      // 2. Check VIP expiration (12 hours exact), Killer License expiration (24 hours), and Natural HP/Energy Regen
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

        if (
          prevHero.killerLicenseUntil &&
          now >= prevHero.killerLicenseUntil
        ) {
          showToast('📜 Срок действия «Лицензии киллера» (1 день) истёк! Продлите её в Магазине ➔ Лицензии.');
          const expiredLicenseHero = { ...prevHero, killerLicenseUntil: undefined };
          heroRef.current = expiredLicenseHero;
          return expiredLicenseHero;
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

      // Keep the Spawn cell [9, 1] free of monsters, and convert any legacy 'exit' tile to 'empty'
      const exitR = newMap.length - 1;
      if (newMap[exitR]?.[0] && newMap[exitR][0].type === 'exit') {
        newMap[exitR][0] = { type: 'empty' };
      }
      if (newMap[exitR]?.[1] && newMap[exitR][1].type === 'mob') {
        newMap[exitR][1] = { type: 'empty' };
      }

      // Clear any monster on the local player's cell when in pyramid
      if (livePosRef.current.screen === 'pyramid' && Number(livePosRef.current.tier) === Number(targetTier)) {
        const myR = Math.max(0, Math.min(newMap.length - 1, livePosRef.current.row));
        const myC = Math.max(0, Math.min(newMap[myR].length - 1, livePosRef.current.col));
        if (newMap[myR]?.[myC]?.type === 'mob') {
          newMap[myR][myC] = { type: 'empty' };
        }
      }

      if (playersList && playersList.length > 0) {
        playersList.forEach((p) => {
          if (activeUser && p.nick.toLowerCase() === activeUser.toLowerCase()) {
            return;
          }
          if (p.location === 'pyramid' && Number(p.pyramidTier) === Number(targetTier) && (p.hp ?? 100) > 0) {
            const targetR = Math.max(0, Math.min(newMap.length - 1, p.row));
            const targetC = Math.max(0, Math.min(newMap[targetR].length - 1, p.col));
            const targetCell = newMap[targetR][targetC];
            // Monster cells must NEVER be overwritten or hijacked by other player coordinates
            if (targetCell.type === 'mob' || (Number(targetCell.mobHp) > 0 && Boolean(targetCell.mobName))) {
              return;
            }
            newMap[targetR][targetC] = {
              ...targetCell,
              type: targetCell.type === 'empty' ? 'player' : targetCell.type,
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
      const startPos: PlayerPosition = customPos || {
        row: PYRAMID_SPAWN_POS.row,
        col: PYRAMID_SPAWN_POS.col
      };

      const occupiedCoords: { row: number; col: number }[] = [
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
              // Monster cells must NEVER be overwritten or hijacked by other player coordinates
              if (targetCell.type === 'mob' || (Number(targetCell.mobHp) > 0 && Boolean(targetCell.mobName))) {
                return;
              }
              newMap[targetR][targetC] = {
                ...targetCell,
                type: targetCell.type === 'empty' ? 'player' : targetCell.type,
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
            const nextTier = Math.max(1, Math.min(3, Number(player.pyramidTier || prevTierOrHome(hero))));
            setPyramidTier(nextTier);
            setHero((prev) => {
              const next: HeroState = {
                ...prev,
                gold: dbGold !== undefined ? dbGold : prev.gold,
                crystals: dbCrystals !== undefined ? dbCrystals : prev.crystals,
                level: dbLvl !== undefined ? dbLvl : prev.level,
                lvl: dbLvl !== undefined ? dbLvl : prev.lvl,
                exp: dbExp !== undefined ? dbExp : prev.exp,
                pyramidTier: nextTier,
                homePyramidTier: player.homePyramidTier !== undefined ? player.homePyramidTier : (prev.homePyramidTier || nextTier),
                pyramidCard1: player.pyramidCard1 !== undefined ? player.pyramidCard1 : prev.pyramidCard1,
                pyramidCard2: player.pyramidCard2 !== undefined ? player.pyramidCard2 : prev.pyramidCard2,
                pyramidCard3: player.pyramidCard3 !== undefined ? player.pyramidCard3 : prev.pyramidCard3,
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
                role:
                  player.role === 'mod' || Number(player.is_admin) === 2
                    ? 'mod'
                    : player.role === 'admin' || Number(player.is_admin) === 1
                    ? 'admin'
                    : player.is_admin === 0 || player.role === 'regular'
                    ? 'regular'
                    : prev.role,
                statusTitle:
                  player.role === 'mod' || Number(player.is_admin) === 2
                    ? 'Модератор Чата'
                    : player.role === 'admin' || Number(player.is_admin) === 1
                    ? 'Главный Администратор'
                    : (player.is_admin === 0 || player.role === 'regular' || prev.statusTitle === 'Главный Администратор' || prev.statusTitle === 'Модератор Чата')
                    ? 'Новичок'
                    : prev.statusTitle,
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
                avatar: player.avatar !== undefined ? player.avatar : prev.avatar,
                npcCompanion:
                  (player as any).npc_companion ??
                  (player as any).npcCompanion ??
                  prev.npcCompanion
              };
              const nextAdminLevel =
                next.role === 'admin' ? 1 : next.role === 'mod' ? 2 : 0;
              (next as any).is_admin = nextAdminLevel;
              (next as any).isAdmin = nextAdminLevel;
              (next as any).admin_level = nextAdminLevel;
              heroRef.current = next;
              return next;
            });

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
                delete pendingPlayerUpdatesRef.current.payload.is_admin;
                delete (pendingPlayerUpdatesRef.current.payload as any).admin_level;
                delete (pendingPlayerUpdatesRef.current.payload as any).role;
              }
              const nextTier = Math.max(1, Math.min(3, Number(meInDb.pyramidTier || heroRef.current.pyramidTier || heroRef.current.homePyramidTier || 1)));
              setPyramidTier(nextTier);
              setHero((prev) => {
                const resolvedPollRole: HeroState['role'] =
                  meInDb.role === 'mod' || Number(meInDb.is_admin) === 2
                    ? 'mod'
                    : meInDb.role === 'admin' || Number(meInDb.is_admin) === 1
                    ? 'admin'
                    : meInDb.is_admin === 0 || meInDb.role === 'regular'
                    ? 'regular'
                    : prev.role;
                const resolvedPollAdminLevel =
                  resolvedPollRole === 'admin' ? 1 : resolvedPollRole === 'mod' ? 2 : 0;
                const resolvedPollTitle =
                  resolvedPollRole === 'mod'
                    ? 'Модератор Чата'
                    : resolvedPollRole === 'admin'
                    ? 'Главный Администратор'
                    : prev.statusTitle === 'Главный Администратор' || prev.statusTitle === 'Модератор Чата'
                    ? 'Новичок'
                    : prev.statusTitle;

                const next: HeroState = {
                  ...prev,
                  role: resolvedPollRole,
                  statusTitle: resolvedPollTitle,
                  gold: meInDb.gold !== undefined ? meInDb.gold : prev.gold,
                  crystals:
                    meInDb.crystals !== undefined ? meInDb.crystals : prev.crystals,
                  level: meInDb.lvl !== undefined ? meInDb.lvl : prev.level,
                  lvl: meInDb.lvl !== undefined ? meInDb.lvl : prev.lvl,
                  exp: meInDb.exp !== undefined ? meInDb.exp : prev.exp,
                  pyramidTier: nextTier,
                  homePyramidTier: meInDb.homePyramidTier !== undefined ? meInDb.homePyramidTier : (prev.homePyramidTier || nextTier),
                  pyramidCard1: meInDb.pyramidCard1 !== undefined ? meInDb.pyramidCard1 : prev.pyramidCard1,
                  pyramidCard2: meInDb.pyramidCard2 !== undefined ? meInDb.pyramidCard2 : prev.pyramidCard2,
                  pyramidCard3: meInDb.pyramidCard3 !== undefined ? meInDb.pyramidCard3 : prev.pyramidCard3,
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
                  avatar: meInDb.avatar !== undefined ? meInDb.avatar : prev.avatar,
                  npcCompanion:
                    (meInDb as any).npc_companion ??
                    (meInDb as any).npcCompanion ??
                    prev.npcCompanion
                };
                (next as any).is_admin = resolvedPollAdminLevel;
                (next as any).isAdmin = resolvedPollAdminLevel;
                (next as any).admin_level = resolvedPollAdminLevel;
                heroRef.current = next;
                return next;
              });

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
    }, 4000);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
      unsubscribe();
    };
  }, [reconnectTrigger, refreshAllPlayersOnPyramidMap, removePlayerFromPyramidMap, addRealtimeLog, showToast, pyramidTier, mergePlayersOntoCells, applyRemoteRareBossTimers, currentUser]);

  useEffect(() => {
    applyCompensationBonusToAllPlayers();
  }, []);

  // Synchronize simulated online bots with Pyramid map cells
  useEffect(() => {
    if (screen === 'pyramid' && effectiveRealtimePlayers.length > 0) {
      refreshAllPlayersOnPyramidMap(effectiveRealtimePlayers);
    }
  }, [screen, effectiveRealtimePlayers, refreshAllPlayersOnPyramidMap]);

  // Respawn monsters and sacks every 1 minute deterministically and sync with Supabase (including offline tiers)
  const respawnPyramidMonstersAndSacks = useCallback(() => {
    const now = Date.now();
    const activeTier = pyramidTierRef.current || 1;
    const nextSeed = Math.floor(now / 60000) * 100 + activeTier;
    pyramidSeedRef.current = nextSeed;

    const occupiedCoords: { row: number; col: number }[] = [
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

        let freeEmptyCells: { r: number; c: number }[] | null = null;
        const ensureFreeEmptyCells = () => {
          if (freeEmptyCells !== null) return freeEmptyCells;
          const occupiedCoords: { row: number; col: number }[] = [
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
          freeEmptyCells = getFreeEmptyPyramidCells(currentMap, occupiedCoords, ROWS_COUNT);
          return freeEmptyCells;
        };

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
            const cells = ensureFreeEmptyCells();
            // Timer reached 0: spawn rare boss if a free empty cell is available, otherwise freeze waiting for cell
            if (cells.length > 0) {
              const chosenCell = cells.pop()!;
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
        if (livePosRef.current.screen === 'pyramid' || mapChanged) {
          setRareBossTimers(nextTimers);
        }

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

      // 3. NPC Companion progression, fighting & energy recharge
      const curHero = heroRef.current;
      if (curHero && curHero.npcCompanion?.unlocked) {
        const { updatedNpc, summaryText, bagWarningToast, forcedDisableAlert } = simulateNpcProgress(curHero.npcCompanion, curHero, now);
        if (
          updatedNpc.energy !== curHero.npcCompanion.energy ||
          updatedNpc.isActive !== curHero.npcCompanion.isActive ||
          updatedNpc.bagGold !== curHero.npcCompanion.bagGold ||
          updatedNpc.bagExp !== curHero.npcCompanion.bagExp ||
          updatedNpc.forcedDisableReason !== curHero.npcCompanion.forcedDisableReason ||
          (updatedNpc.notifications?.length || 0) !== (curHero.npcCompanion.notifications?.length || 0)
        ) {
          const nextHero: HeroState = { ...curHero, npcCompanion: updatedNpc };
          heroRef.current = nextHero;
          setHero(nextHero);
          if (now - (lastNpcSyncRef.current || 0) >= 6000 || !updatedNpc.isActive || Boolean(forcedDisableAlert)) {
            lastNpcSyncRef.current = now;
            saveGameToStorage({ hero: nextHero });
            if (currentUserRef.current) {
              flushPlayerUpdates(currentUserRef.current, {
                npc_companion: updatedNpc,
                npcCompanion: updatedNpc
              });
            }
          }
        }
        if (forcedDisableAlert) {
          showToast(forcedDisableAlert);
          addCombatLog(forcedDisableAlert, 'system' as any);
        } else if (summaryText) {
          showToast(summaryText);
        }
        if (bagWarningToast) {
          showToast(bagWarningToast);
        }
      }
    };

    const interval = setInterval(tickTimersAndRespawns, 1000);

    // When tab returns from background / offline mode, immediately catch up spawns & NPC progress
    const onVisChange = () => {
      if (document.visibilityState === 'visible') {
        const curHero = heroRef.current;
        if (curHero && curHero.npcCompanion?.unlocked) {
          const { updatedNpc, summaryText, bagWarningToast, forcedDisableAlert } = simulateNpcProgress(curHero.npcCompanion, curHero, Date.now());
          const nextHero: HeroState = { ...curHero, npcCompanion: updatedNpc };
          heroRef.current = nextHero;
          setHero(nextHero);
          saveGameToStorage({ hero: nextHero });
          if (currentUserRef.current) {
            flushPlayerUpdates(currentUserRef.current, {
              npc_companion: updatedNpc,
              npcCompanion: updatedNpc
            });
          }
          if (forcedDisableAlert) {
            showToast(forcedDisableAlert);
            addCombatLog(forcedDisableAlert, 'system' as any);
          } else if (summaryText) {
            showToast(summaryText);
          }
          if (bagWarningToast) {
            showToast(bagWarningToast);
          }
        }

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

  const prevTierOrHome = (h: HeroState) =>
    Math.max(1, Math.min(3, Number(h.pyramidTier || h.homePyramidTier || 1)));

  // Enter pyramid — blocked after death until the player has at least 30 energy!
  // Player enters their own unlocked home pyramid (homePyramidTier)
  const handleEnterPyramid = () => {
    if (checkBanRestriction('blockPyramid', 'Вход в Пирамиду и бои')) {
      return;
    }
    const curNpc = heroRef.current?.npcCompanion || hero.npcCompanion;
    if (curNpc?.unlocked && curNpc?.isActive) {
      showToast(
        '⛔ Вход в Пирамиду закрыт, пока там работает ваш Страж NPC! Сначала отзовите его в Город («Персонаж» ➔ «Рюкзак NPC»).'
      );
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

    const targetTier = Math.max(1, Math.min(3, Number(hero.homePyramidTier || hero.pyramidTier || 1)));
    setActiveModal(null);

    if (screenFadeTimerRef.current) {
      window.clearTimeout(screenFadeTimerRef.current);
    }
    setScreenFadeOverlay({ active: true, label: `🏛️ Вход в Пирамиду ${targetTier}...` });

    const entryPos = {
      row: PYRAMID_SPAWN_POS.row,
      col: PYRAMID_SPAWN_POS.col
    };
    setPyramidTier(targetTier);
    pyramidTierRef.current = targetTier;
    setHero((prev) => ({
      ...prev,
      goldInCurrentRun: 0,
      pyramidTier: targetTier,
      homePyramidTier: prev.homePyramidTier || targetTier
    }));
    generateNewPyramid(targetTier, entryPos, false);
    livePosRef.current = {
      screen: 'pyramid',
      tier: targetTier,
      row: entryPos.row,
      col: entryPos.col
    };

    window.setTimeout(() => {
      setScreen('pyramid');
    }, 140);
    screenFadeTimerRef.current = window.setTimeout(() => {
      setScreenFadeOverlay({ active: false, label: '' });
    }, 340);

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        was_killed_in_pvp: false,
        killed_by: null,
        location: 'pyramid',
        pyramid_tier: targetTier,
        home_pyramid_tier: targetTier,
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
    showToast(`🏛️ Вы вошли в свою Пирамиду ${targetTier}!`);
  };

  const handleExitToCity = (_isDeath: boolean = false) => {
    const firstLineRow = (pyramidMap.length || ROWS_COUNT) - 1;
    const isStandingOnFirstLine =
      playerPos.row === firstLineRow ||
      (livePosRef.current.screen === 'pyramid' && livePosRef.current.row === firstLineRow);

    if (!_isDeath && !isStandingOnFirstLine) {
      showToast('⛔ Выход из Пирамиды работает только когда персонаж стоит на 1-й линии (нижний ряд у входа)!');
      return;
    }

    const citySpawnPos = {
      row: PYRAMID_SPAWN_POS.row,
      col: PYRAMID_SPAWN_POS.col
    };
    const curHero = heroRef.current;
    const homeTier = Math.max(1, Math.min(3, Number(curHero.homePyramidTier || curHero.pyramidTier || 1)));

    if (screenFadeTimerRef.current) {
      window.clearTimeout(screenFadeTimerRef.current);
    }
    setScreenFadeOverlay({ active: true, label: '🏙️ Выход в Город Луксор...' });
    window.setTimeout(() => {
      setScreen('city');
    }, 140);
    screenFadeTimerRef.current = window.setTimeout(() => {
      setScreenFadeOverlay({ active: false, label: '' });
    }, 340);

    setPyramidTier(homeTier);
    pyramidTierRef.current = homeTier;
    setHero((prev) => ({
      ...prev,
      pyramidTier: homeTier,
      homePyramidTier: homeTier
    }));
    setPlayerPos(citySpawnPos);
    livePosRef.current = {
      ...livePosRef.current,
      screen: 'city',
      tier: homeTier,
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
        pyramid_tier: homeTier,
        home_pyramid_tier: homeTier,
        pyramid_card_1: curHero.pyramidCard1 || 0,
        pyramid_card_2: curHero.pyramidCard2 || 0,
        pyramid_card_3: curHero.pyramidCard3 || 0,
        пирамидальный_уровень: homeTier,
        row: citySpawnPos.row,
        ряд: citySpawnPos.row,
        col: citySpawnPos.col,
        ц: citySpawnPos.col,
        npc_companion: curHero.npcCompanion ?? null,
        npcCompanion: curHero.npcCompanion ?? null,
        is_online: true,
        last_seen: Date.now()
      });
      queueRealtimePlayerSync({
        nick: currentUser,
        location: 'city',
        pyramidTier: homeTier,
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

  // Check level up: awards gold, crystals, statPoints according to balance (does NOT auto-open next pyramid; transition is strictly via portal)
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
      leveled = true;
    }

    if (leveled) {
      playLevelUpSound();
      const curTier = h.pyramidTier || h.homePyramidTier || 1;
      showToast(
        `🆙 НОВЫЙ УРОВЕНЬ ${h.level}! Награда: +${totalAwardedGold} 🪙, +${totalAwardedCrystals} 💎, +${totalAwardedStats} стат! HP и ⚡ восстановлены!`
      );
      addCombatLog(
        `🆙 УРОВЕНЬ ${h.level} (Пирамида ${curTier})! Награда за уровень: +${totalAwardedGold} 🪙, +${totalAwardedCrystals} 💎, +${totalAwardedStats} стат. Здоровье и энергия полностью восстановлены!`,
        'kill'
      );
      const msgTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages((prev) => [
        ...prev,
        {
          id: 'lvl_' + Date.now(),
          time: msgTime,
          author: 'Система',
          text: `🎉 Игрок ${currentUser || 'Игрок'} достиг ${h.level} уровня!`,
          isSystem: true,
          channel: 'world'
        }
      ]);
    }

    return h;
  };

  // Unified PvP Attack on another player (online or offline) in the Pyramid with Killer License and 50% + 5%/lvl Stun
  const executePvPAttackOnPlayer = (
    targetNick: string,
    targetCellCoords?: { r: number; c: number }
  ) => {
    const cleanNick = (targetNick || '').trim();
    if (!cleanNick) return;
    const activeNickLower = (currentUser || '').trim().toLowerCase();
    if (activeNickLower && cleanNick.toLowerCase() === activeNickLower) {
      showToast('🛡️ Нельзя нападать на самого себя!');
      return;
    }

    // 1. Attacker must be in the Pyramid
    if (screen !== 'pyramid') {
      showToast(
        '🛡️ Вы находитесь на главной (в Городе)! Чтобы напасть на игрока, сначала войдите в Пирамиду.'
      );
      return;
    }

    // 2. Attacker must not be stunned
    const stunRemainingMs = Math.max(0, (hero.stunUntil || 0) - Date.now());
    if (stunRemainingMs > 0) {
      const sec = Math.ceil(stunRemainingMs / 1000);
      showToast(`💫 Вы оглушены (${sec}с)! Движение и атака заблокированы.`);
      return;
    }

    // 3. Attacker must have an active Killer License
    const isKillerLicenseActive = Boolean(
      hero.killerLicenseUntil && hero.killerLicenseUntil > Date.now()
    );
    if (!isKillerLicenseActive) {
      const storedCount = Number(hero.killerLicenses || 0);
      const hintMsg =
        storedCount > 0
          ? `У вас есть ${storedCount} шт. в запасе — нажмите «Использовать» в Персонаже или Магазине!`
          : `Купите её в разделе «Магазин ➔ Лицензии» за ${KILLER_LICENSE_CONFIG.costCrystals} 💎 (срок 1 день).`;
      showToast(
        `📜 Для нападения на игрока ${cleanNick} в Пирамиде нужна активная «Лицензия киллера»! ${hintMsg}`
      );
      addCombatLog(
        `📜 Нападение заблокировано: требуется активная «Лицензия киллера» (${hintMsg})`,
        'pvp'
      );
      return;
    }

    // 4. Energy cost check
    const energyCost = 3;
    if (hero.energy < energyCost) {
      addCombatLog(
        `⚡ Недостаточно энергии для атаки игрока ${cleanNick}! Требуется ${energyCost}⚡.`,
        'pvp'
      );
      showToast(`⚡ Недостаточно энергии для атаки игрока ${cleanNick}! Требуется ${energyCost}⚡.`);
      return;
    }

    // 5. Target lookup & location rule
    const targetInRealtime = realtimePlayers.find(
      (p) => p.nick.trim().toLowerCase() === cleanNick.toLowerCase()
    );
    const targetLoc = (targetInRealtime?.location || '').toLowerCase();
    const isTargetOnMain = targetLoc === 'city' || targetLoc === 'город';

    // If target is in City ("на главной"), attacking them is STRICTLY forbidden!
    if (isTargetOnMain) {
      showToast(
        `🛡️ Игрок ${cleanNick} находится на главной (в Городе) — нападение запрещено! Нападать можно только на игроков в Пирамиде.`
      );
      return;
    }

    // If target is in Pyramid (online OR offline): CAN be attacked and killed!
    const enemyIsOnline = Boolean(targetInRealtime?.isOnline);
    const enemyCurrentHp = Number(targetInRealtime?.hp ?? 100);
    const enemyMaxHp = Number(targetInRealtime?.maxHp ?? 100);
    const enemyLvl = Math.max(1, Number(targetInRealtime?.lvl ?? 1));
    const enemyRow = targetInRealtime ? Number(targetInRealtime.row ?? 9) : (targetCellCoords?.r ?? 9);
    const enemyCol = targetInRealtime ? Number(targetInRealtime.col ?? 0) : (targetCellCoords?.c ?? 0);

    if (enemyCurrentHp <= 0) {
      showToast(`💀 Игрок ${cleanNick} уже повержен и ожидает возрождения в Городе.`);
      return;
    }

    playAttackSound();
    const totalStr = hero.str + (hero.gearStr || 0);
    const playerDmg = 16 + hero.bonusDmg + (hero.gearDmg || 0) + totalStr * 2;
    const updatedEnemyHp = Math.max(0, enemyCurrentHp - playerDmg);
    const nextEnergy = Math.max(0, hero.energy - energyCost);

    const hitRow = targetCellCoords?.r ?? enemyRow;
    const hitCol = targetCellCoords?.c ?? enemyCol;

    const popupId = 'dmg_' + Date.now();
    setDamagePopups((prev) => [
      ...prev,
      { id: popupId, row: hitRow, col: hitCol, amount: playerDmg, type: 'player', timestamp: Date.now() }
    ]);
    setTimeout(() => setDamagePopups((prev) => prev.filter((p) => p.id !== popupId)), 1000);

    // Stun Roll: 50% base from Killer License + 5% per Killer Achievement level (Only against players!)
    const currentKillerInfo = getKillerAchievementInfo(hero.pvpKills || 0);
    const stunCalculation = calculateKillerStunChance(currentKillerInfo.level, true);
    const stunRoll = Math.random() * 100;
    const didStun = stunCalculation.canStun && stunRoll < stunCalculation.stunChance;
    const stunDurationMs = didStun ? stunCalculation.stunDurationMs : 0;
    const targetStunUntil = didStun ? Date.now() + stunDurationMs : (targetInRealtime?.stunUntil ?? 0);

    if (didStun) {
      const stunPopupId = 'stun_' + Date.now();
      setDamagePopups((prev) => [
        ...prev,
        { id: stunPopupId, row: hitRow, col: hitCol, amount: 0, text: '💫 ОГЛУШЁН (3с)', type: 'player', timestamp: Date.now() }
      ]);
      setTimeout(() => setDamagePopups((prev) => prev.filter((p) => p.id !== stunPopupId)), 1500);
    }

    if (updatedEnemyHp <= 0) {
      playLevelUpSound();
      const stolenGold = Math.floor(180 + Math.random() * 220);
      const now = Date.now();
      const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const citySpawnRow = ROWS_COUNT - 1;
      const citySpawnCol = Math.floor((ROWS_COUNT - 1) / 2);

      const prevKills = Number(heroRef.current.pvpKills || 0);
      const nextKills = prevKills + 1;
      const prevKillerAch = getKillerAchievementInfo(prevKills);
      const nextKillerAch = getKillerAchievementInfo(nextKills);
      const leveledUpKiller = nextKillerAch.level > prevKillerAch.level;

      setHero((prev) => {
        const nextRaw: HeroState = {
          ...prev,
          energy: nextEnergy,
          gold: prev.gold + stolenGold,
          goldInCurrentRun: prev.goldInCurrentRun + stolenGold,
          pvpKills: (prev.pvpKills || 0) + 1
        };
        const recalced = recalcGear(equippedRef.current, nextRaw);
        if (leveledUpKiller) {
          recalced.hp = Math.min(recalced.maxHp, recalced.hp + 100);
        }
        heroRef.current = recalced;
        return recalced;
      });

      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          pvp_kills: nextKills,
          gold: heroRef.current.gold,
          max_hp: heroRef.current.maxHp,
          hp: heroRef.current.hp,
          energy: nextEnergy
        });
      }

      // Update killed player in Supabase: send them to the City with 0 HP and 0 energy (both online & offline)
      updatePlayerInDatabase(cleanNick, {
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
          p.nick.toLowerCase() === cleanNick.toLowerCase()
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
        prev.filter((n) => n.toLowerCase() !== cleanNick.toLowerCase())
      );

      setTradeProtocol((prev) => [
        {
          id: 'pvp_' + now,
          timestamp: now,
          dateStr,
          type: 'gold_transfer',
          description: `⚔️ Победа в PvP над ${cleanNick}${
            !enemyIsOnline ? ' (оффлайн)' : ''
          }: конфисковано 50% ресурсов (+${stolenGold} 🪙) | Киллер: ${nextKills} уб. (Ур. ${nextKillerAch.level}/5, +${nextKillerAch.totalStunBonus}% оглуш.)`,
          amount: stolenGold,
          targetNick: cleanNick
        },
        ...prev
      ]);

      const msgTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const pvpChatMsg: ChatMessage = {
        id: 'pvp_chat_' + Date.now(),
        time: msgTime,
        author: 'PvP Арена',
        text: `⚔️ [PvP] ${currentUser || 'Игрок'} убил игрока ${cleanNick}${
          !enemyIsOnline ? ' (оффлайн)' : ''
        } в Пирамиде по Лицензии киллера! ${cleanNick} отправлен на возрождение в Город (+${stolenGold} 🪙)!`,
        isSystem: true,
        channel: 'world'
      };
      setChatMessages((prev) => [...prev, pvpChatMsg]);
      broadcastWorldChatMessageInSupabase(pvpChatMsg);

      addCombatLog(
        `⚔️ УБИЙСТВО ИГРОКА: Вы убили ${cleanNick}${
          !enemyIsOnline ? ' (оффлайн)' : ''
        } (урон: ${playerDmg}, -${energyCost}⚡)! Добыча: +${stolenGold} 🪙 | Достижение «Киллер»: ${nextKills} уб. (Ур. ${nextKillerAch.level}/5)`,
        'pvp'
      );

      showToast(
        leveledUpKiller
          ? `🏆 ДОСТИЖЕНИЕ «КИЛЛЕР» УР. ${nextKillerAch.level}/5! Здоровье +100 ❤️ HP и шанс оглушения +5% 💫 навсегда (всего +${nextKillerAch.totalHpBonus} HP, +${nextKillerAch.totalStunBonus}% оглуш.)!`
          : `⚔️ Вы убили ${cleanNick}${!enemyIsOnline ? ' (оффлайн)' : ''} в Пирамиде! +${stolenGold} 🪙 (Киллер: ${nextKills} уб.)`
      );

      if (leveledUpKiller) {
        addCombatLog(
          `🏆 ДОСТИЖЕНИЕ «КИЛЛЕР» УР. ${nextKillerAch.level}/5 ПОЛУЧЕНО (${nextKills} убийств)! Ваше макс. здоровье увеличено на +100 ❤️ HP, а шанс оглушения на +5% 💫 навсегда (всего +${nextKillerAch.totalHpBonus} HP, шанс ${nextKillerAch.stunChanceWithLicense}%)!`,
          'pvp'
        );
        const achChatMsg: ChatMessage = {
          id: 'ach_killer_' + Date.now(),
          time: msgTime,
          author: 'Достижения',
          text: `🏆 ${currentUser || 'Игрок'} достиг ${nextKillerAch.level} уровня достижения «Киллер» (${nextKills} убийств в Пирамиде) и получил +100 ❤️ HP и +5% к оглушению навсегда (всего +${nextKillerAch.totalHpBonus} HP, шанс оглушения ${nextKillerAch.stunChanceWithLicense}%)!`,
          isSystem: true,
          channel: 'world'
        };
        setChatMessages((prev) => [...prev, achChatMsg]);
        broadcastWorldChatMessageInSupabase(achChatMsg);
      }

      // Defeated player leaves a gold sack on the cell
      const newMap = pyramidMap.map((rowArr, rI) =>
        rowArr.map((cCell, cI) => {
          if (rI === hitRow && cI === hitCol) {
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
      // Victim survived this hit
      updatePlayerInDatabase(cleanNick, {
        hp: updatedEnemyHp,
        ...(didStun ? { stun_until: targetStunUntil, stunUntil: targetStunUntil } : {})
      });

      setRealtimePlayers((prev) =>
        prev.map((p) =>
          p.nick.toLowerCase() === cleanNick.toLowerCase()
            ? {
                ...p,
                hp: updatedEnemyHp,
                ...(didStun ? { stunUntil: targetStunUntil } : {})
              }
            : p
        )
      );

      if (didStun) {
        // Victim is stunned! Victim CANNOT counter-attack!
        addCombatLog(
          `💫 ОГЛУШЕНИЕ (${stunCalculation.stunChance}% шанс)! Игрок ${cleanNick} оглушён на 3 сек! Жертва не может двигаться и не смогла ответить на удар (урон: -${playerDmg} HP, осталось ${updatedEnemyHp}/${enemyMaxHp} HP) [-${energyCost}⚡].`,
          'pvp'
        );
        showToast(`💫 Игрок ${cleanNick} оглушён на 3 сек! (-${playerDmg} HP)`);
        const nextHeroState = { ...heroRef.current, energy: nextEnergy };
        heroRef.current = nextHeroState;
        setHero(nextHeroState);
      } else {
        const totalAgi = hero.agi + (hero.gearAgi || 0);
        const dodgeChance = Math.min(40, totalAgi * 1);
        const dodgeRoll = Math.random() * 100;
        const enemyDmg = enemyLvl * 3 + Math.floor(Math.random() * 8);

        if (dodgeRoll < dodgeChance) {
          addCombatLog(
            `⚔️ Удар по игроку ${cleanNick}: -${playerDmg} HP (осталось ${updatedEnemyHp}/${enemyMaxHp} HP) [-${energyCost}⚡]. 💨 Вы уклонились от ответа!`,
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
              text: `☠️ Игрок ${currentUser || 'Игрок'} пал в бою против ${cleanNick} в Пирамиде и потерял 50% добычи (-${lostGold} 🪙)!`,
              isSystem: true,
              channel: 'world'
            };
            setChatMessages((prev) => [...prev, deathPvpMsg]);
            broadcastWorldChatMessageInSupabase(deathPvpMsg);
            addCombatLog(
              `💀 Вы пали в PvP от руки ${cleanNick} и потеряли ${lostGold} 🪙! Возрождение в Городе (HP и ⚡ восстанавливаются).`,
              'pvp'
            );
            handleExitToCity(true);
            return;
          }
          addCombatLog(
            `⚔️ Удар по игроку ${cleanNick}: -${playerDmg} HP (осталось ${updatedEnemyHp}/${enemyMaxHp} HP) [-${energyCost}⚡]. Ответ: -${enemyDmg} HP`,
            'pvp'
          );
        }
      }

      const newMap = pyramidMap.map((rowArr, rI) =>
        rowArr.map((cCell, cI) => {
          if (rI === hitRow && cI === hitCol) {
            return { ...cCell, playerHp: updatedEnemyHp };
          }
          return cCell;
        })
      );
      setPyramidMap(newMap);
    }
  };

  // Unified PvP Attack on an opponent's roaming NPC Companion in the Pyramid with Killer License
  const executePvPAttackOnNpc = (
    targetPlayer: RealtimePlayer,
    targetCellCoords: { r: number; c: number }
  ) => {
    const ownerNick = (targetPlayer.nick || '').trim();
    if (!ownerNick) return;
    const targetNpc = targetPlayer.npc_companion || targetPlayer.npcCompanion;
    if (!targetNpc || !targetNpc.unlocked || !targetNpc.isActive) {
      showToast('ℹ️ Этот Страж NPC уже вернулся в Город.');
      return;
    }

    if (screen !== 'pyramid') {
      showToast('🛡️ Нападать на Стражей NPC можно только внутри Пирамиды!');
      return;
    }

    const stunRemainingMs = Math.max(0, (hero.stunUntil || 0) - Date.now());
    if (stunRemainingMs > 0) {
      const sec = Math.ceil(stunRemainingMs / 1000);
      showToast(`💫 Вы оглушены (${sec}с)! Движение и атака заблокированы.`);
      return;
    }

    // MANDATORY REQUIREMENT: Active Killer License to attack NPC Companion in the Pyramid!
    const isKillerLicenseActive = Boolean(
      hero.killerLicenseUntil && hero.killerLicenseUntil > Date.now()
    );
    if (!isKillerLicenseActive) {
      const storedCount = Number(hero.killerLicenses || 0);
      const hintMsg =
        storedCount > 0
          ? `У вас есть ${storedCount} шт. в запасе — нажмите «Использовать» в меню Персонажа!`
          : `Купите её в разделе «Магазин ➔ Лицензии» за 10 💎 (срок 1 день).`;
      showToast(
        `🔒 Для нападения на Стражей NPC в Пирамиде требуется активная «Лицензия киллера»! ${hintMsg}`
      );
      addCombatLog(
        `🔒 Нападение на Стража NPC заблокировано: требуется активная «Лицензия киллера» (${hintMsg})`,
        'pvp'
      );
      return;
    }

    const energyCost = 3;
    if (hero.energy < energyCost) {
      addCombatLog(`⚡ Недостаточно энергии для атаки Стража NPC! Требуется ${energyCost}⚡.`, 'pvp');
      showToast(`⚡ Недостаточно энергии для атаки Стража NPC! Требуется ${energyCost}⚡.`);
      return;
    }

    playAttackSound();
    const totalStr = hero.str + (hero.gearStr || 0);
    const playerDmg = 16 + hero.bonusDmg + (hero.gearDmg || 0) + totalStr * 2;
    const currentNpcHp = Number(targetNpc.hp ?? 3000);
    const maxNpcHp = Number(targetNpc.maxHp ?? 3000);
    const updatedNpcHp = Math.max(0, currentNpcHp - playerDmg);
    const nextEnergy = Math.max(0, hero.energy - energyCost);

    const hitRow = targetCellCoords.r;
    const hitCol = targetCellCoords.c;

    const popupId = 'dmg_npc_' + Date.now();
    setDamagePopups((prev) => [
      ...prev,
      { id: popupId, row: hitRow, col: hitCol, amount: playerDmg, type: 'player', timestamp: Date.now() }
    ]);
    setTimeout(() => setDamagePopups((prev) => prev.filter((p) => p.id !== popupId)), 1000);

    if (updatedNpcHp <= 0) {
      // NPC DESTROYED!
      playLevelUpSound();
      const rawBagGold = Math.max(0, Number(targetNpc.bagGold || 0));
      const stolenGold = Math.max(250, Math.floor(rawBagGold * 0.5) + Math.floor(150 + Math.random() * 200));
      const remainingBagGold = Math.max(0, rawBagGold - Math.floor(rawBagGold * 0.5));
      const now = Date.now();
      const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const prevKills = Number(heroRef.current.pvpKills || 0);
      const nextKills = prevKills + 1;
      const prevKillerAch = getKillerAchievementInfo(prevKills);
      const nextKillerAch = getKillerAchievementInfo(nextKills);
      const leveledUpKiller = nextKillerAch.level > prevKillerAch.level;

      setHero((prev) => {
        const nextRaw: HeroState = {
          ...prev,
          energy: nextEnergy,
          gold: prev.gold + stolenGold,
          goldInCurrentRun: prev.goldInCurrentRun + stolenGold,
          pvpKills: (prev.pvpKills || 0) + 1
        };
        const recalced = recalcGear(equippedRef.current, nextRaw);
        if (leveledUpKiller) {
          recalced.hp = Math.min(recalced.maxHp, recalced.hp + 100);
        }
        heroRef.current = recalced;
        return recalced;
      });

      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          pvp_kills: nextKills,
          gold: heroRef.current.gold,
          max_hp: heroRef.current.maxHp,
          hp: heroRef.current.hp,
          energy: nextEnergy
        });
      }

      // Update defeated NPC in Supabase: deactivated, 0 HP, 0 energy, recalled to city!
      const defeatedNpc = {
        ...targetNpc,
        isActive: false,
        hp: 0,
        energy: 0,
        bagGold: remainingBagGold,
        logs: [
          {
            id: `npc_killed_${now}`,
            time: dateStr,
            text: `💀 Страж NPC был уничтожен в Пирамиде киллером ${currentUser || 'Игрок'}! Конфисковано 50% золота (${stolenGold.toLocaleString()} 🪙). Страж отозван в Город. Повторный запуск доступен только при 500/500⚡!`,
            type: 'energy' as const
          },
          ...(Array.isArray(targetNpc.logs) ? targetNpc.logs : [])
        ].slice(0, 35)
      };

      updatePlayerInDatabase(ownerNick, {
        npc_companion: defeatedNpc,
        npcCompanion: defeatedNpc
      });

      setRealtimePlayers((prev) =>
        prev.map((p) =>
          p.nick.toLowerCase() === ownerNick.toLowerCase()
            ? { ...p, npc_companion: defeatedNpc, npcCompanion: defeatedNpc }
            : p
        )
      );

      setTradeProtocol((prev) => [
        {
          id: 'pvp_npc_' + now,
          timestamp: now,
          dateStr,
          type: 'gold_transfer',
          description: `⚔️ Уничтожение Стража NPC игрока ${ownerNick} по Лицензии киллера (+${stolenGold.toLocaleString()} 🪙) | Киллер: ${nextKills} уб.`,
          amount: stolenGold,
          targetNick: ownerNick
        },
        ...prev
      ]);

      const msgTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const pvpChatMsg: ChatMessage = {
        id: 'npc_kill_chat_' + Date.now(),
        time: msgTime,
        author: 'PvP Арена',
        text: `⚔️ [PvP] ${currentUser || 'Игрок'} по Лицензии киллера уничтожил Стража NPC игрока ${ownerNick} в Пирамиде и забрал +${stolenGold.toLocaleString()} 🪙 добычи!`,
        isSystem: true,
        channel: 'world'
      };
      setChatMessages((prev) => [...prev, pvpChatMsg]);
      broadcastWorldChatMessageInSupabase(pvpChatMsg);

      addCombatLog(
        `⚔️ УНИЧТОЖЕНИЕ СТРАЖА: Вы уничтожили Стража NPC игрока ${ownerNick} по Лицензии киллера (-${energyCost}⚡)! Добыча: +${stolenGold.toLocaleString()} 🪙 | Киллер: ${nextKills} уб.`,
        'pvp'
      );

      showToast(
        `⚔️ Вы уничтожили Стража NPC игрока ${ownerNick}! Конфисковано +${stolenGold.toLocaleString()} 🪙! (+1 PvP kill)`
      );
    } else {
      // NPC survived the hit
      const nextNpc = {
        ...targetNpc,
        hp: updatedNpcHp
      };

      updatePlayerInDatabase(ownerNick, {
        npc_companion: nextNpc,
        npcCompanion: nextNpc
      });

      setRealtimePlayers((prev) =>
        prev.map((p) =>
          p.nick.toLowerCase() === ownerNick.toLowerCase()
            ? { ...p, npc_companion: nextNpc, npcCompanion: nextNpc }
            : p
        )
      );

      const nextHeroState = { ...heroRef.current, energy: nextEnergy };
      heroRef.current = nextHeroState;
      setHero(nextHeroState);

      addCombatLog(
        `⚔️ Удар по Стражу NPC игрока ${ownerNick}: -${playerDmg} HP (осталось ${updatedNpcHp}/${maxNpcHp} HP) [-${energyCost}⚡]!`,
        'pvp'
      );
      showToast(
        `⚔️ Удар по Стражу NPC игрока ${ownerNick}: -${playerDmg} HP (${updatedNpcHp}/${maxNpcHp})!`
      );
    }
  };

  // Click pyramid block
  const handlePyramidBlockClick = (r: number, c: number) => {
    // 0. Stun movement lock
    const stunRemainingMs = Math.max(0, (hero.stunUntil || 0) - Date.now());
    if (stunRemainingMs > 0) {
      const sec = Math.ceil(stunRemainingMs / 1000);
      showToast(`💫 Вы оглушены! Нельзя двигаться ещё ${sec} сек.`);
      return;
    }

    const rowDiff = Math.abs(r - playerPos.row);
    const colDiff = Math.abs(c - playerPos.col);

    if (rowDiff > 1 || colDiff > 1) {
      return; // Can only move to adjacent cells
    }

    const cell = pyramidMap[r][c];

    const now = Date.now();
    if (now - lastMoveTime < MOVE_DELAY) {
      return; // Cooldown not ready
    }
    setLastMoveTime(now);

    // 2. Portal cell: first click steps ONTO the portal cell (so transition cards on the left activate);
    // clicking again while standing on the portal transitions to the next pyramid (if level >= 5 for P2, >= 10 for P3)
    if (cell.type === 'nextTier' || cell.type === 'portal') {
      const isAlreadyStandingOnThisPortal = playerPos.row === r && playerPos.col === c;
      if (!isAlreadyStandingOnThisPortal) {
        if (hero.energy < 1) {
          showToast('⚡ Недостаточно энергии для шага на портал! Нужно 1⚡.');
          return;
        }
        const nextEn = Math.max(0, hero.energy - 1);
        setHero((prev) => ({ ...prev, energy: nextEn }));
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
            avatar: hero.avatar || '🧙‍♂️',
            isOnline: true
          });
        }
        showToast(
          '🌀 Вы встали на Портал! Слева выберите карточку перехода (П1/П2/П3) или нажмите на портал ещё раз для перехода далее.'
        );
        return;
      }

      handleEnterNextTierPortal();
      return;
    }

    // 3. Combat Mob / Boss — 3 energy per hit, NO killer license needed (PvE), logged in personal Combat Log!
    // CRITICAL: If the cell contains a monster (cell.type === 'mob' or alive mobHp/mobName), we ALWAYS attack the monster directly!
    // A Killer License is strictly for PvP (players and opponent NPC companions), never for monsters or bosses!
    if (cell.type === 'mob' || (Number(cell.mobHp) > 0 && Boolean(cell.mobName))) {
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
        const updatedBossesKilled = (hero.bossesKilled || 0) + (isBoss ? 1 : 0);
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
          bossesKilled: updatedBossesKilled,
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

        addLootHistoryEntry({
          category: 'monster',
          title: mobTitle,
          icon: cell.icon || (isBoss ? '👑' : '🦂'),
          lvl: mobLevel,
          isBoss,
          location: `Пирамида ${pyramidTier}`,
          gold: goldReward,
          crystals: crystalReward,
          exp: expReward,
          potionDrop: droppedPotionType
        });

        // Экипировка больше не выпадает с монстров и боссов — получение исключительно в Магазине

        // Update map: mob is dead, tile becomes empty or spawns portal if apex boss
        const newMap = pyramidMap.map((rowArr, rI) =>
          rowArr.map((cCell, cI) => {
            if (rI === r && cI === c) {
              return { type: 'empty' as const };
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
            bosses_killed: updatedBossesKilled,
            bossesKilled: updatedBossesKilled,
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

    // 4. PvP Attack on another player (online OR offline) standing on this cell in the Pyramid!
    // A Killer License is strictly required for PvP, never for monsters or bosses
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

    if (cell.type !== 'mob' && hasEnemyPlayer) {
      const enemyNick = enemyOnCell?.nick || cell.playerNick || 'Соперник';
      executePvPAttackOnPlayer(enemyNick, { r, c });
      return;
    }

    // 4.1. Roaming NPC Companion on this cell (Own or Opponent)
    const myNpc = heroRef.current.npcCompanion;
    if (
      myNpc?.unlocked &&
      myNpc?.isActive &&
      Number(myNpc.tier || 1) === Number(pyramidTier) &&
      Number(myNpc.row ?? 9) === r &&
      Number(myNpc.col ?? 0) === c
    ) {
      showToast(
        `🤖 Это ваш Страж NPC: ${myNpc.name || 'Страж'} (${myNpc.hp}/${myNpc.maxHp} ❤️, ${myNpc.energy}/${myNpc.maxEnergy} ⚡, В рюкзаке: ${(myNpc.bagGold || 0).toLocaleString()} 🪙)`
      );
      return;
    }

    const opponentPlayerWithNpc = realtimePlayers.find((p) => {
      const npc = p.npc_companion || p.npcCompanion;
      if (!npc || !npc.unlocked || !npc.isActive || (npc.hp ?? 100) <= 0) return false;
      const npcTier = Math.max(1, Math.min(3, Number(npc.tier ?? 1)));
      if (npcTier !== Number(pyramidTier)) return false;
      const npR = Number(npc.row ?? 9);
      const npC = Number(npc.col ?? 0);
      const isOwnerMe = activeNickLower && p.nick.trim().toLowerCase() === activeNickLower;
      return !isOwnerMe && npR === r && npC === c;
    });

    if (cell.type !== 'mob' && opponentPlayerWithNpc) {
      executePvPAttackOnNpc(opponentPlayerWithNpc, { r, c });
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

      addLootHistoryEntry({
        category: 'chest',
        title: 'Тайник Кристаллов',
        icon: '💎',
        location: `Пирамида ${pyramidTier}`,
        crystals: crystalsFound
      });
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

    addLootHistoryEntry({
      category: 'chest',
      title: 'Сундук / Мешок сокровищ',
      icon: '🧰',
      location: `Пирамида ${pyramidTier}`,
      gold: goldFound
    });
    showToast(`💰 Вы подобрали мешочек с золотом (+${goldFound} 🪙)!`);
  };

  // Confirmation modal before using rare items (Killer Licenses, EXP Elixirs, Pyramid Cards) or selling valuable elixirs
  const [rareActionConfirmModal, setRareActionConfirmModal] = useState<{
    title: string;
    itemTitle: string;
    icon: string;
    badgeText?: string;
    warningText: string;
    effectText?: string;
    confirmLabel: string;
    accentColor?: 'amber' | 'purple' | 'red' | 'cyan';
    onConfirm: () => void;
  } | null>(null);

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
      const nowCheck = Date.now();
      const isAlreadyActive = Boolean(curHero.expElixirUntil && curHero.expElixirUntil > nowCheck);
      setRareActionConfirmModal({
        title: '⚠️ Использование редкого предмета',
        itemTitle: '✨ Эликсир Опыта (+25% к опыту)',
        icon: '✨',
        badgeText: `В наличии: ${curExpPotions} шт. • Ценность: 3 💎`,
        warningText:
          'Вы собираетесь использовать редкий Эликсир Опыта. После подтверждения 1 флакон будет безвозвратно потрачен.',
        effectText: isAlreadyActive
          ? '⏱️ У вас уже действует Эликсир Опыта — время действия будет продлено ещё на +30 минут!'
          : `⏱️ Даёт +25% к получаемому опыту на 30 минут (в запасе останется: ${curExpPotions - 1} шт.).`,
        confirmLabel: '✨ Выпить эликсир',
        accentColor: 'purple',
        onConfirm: () => {
          const latestHero = heroRef.current || hero;
          const latestExpPotions = Number(latestHero.expPotions || 0);
          if (latestExpPotions <= 0) return;
          playLevelUpSound();
          const now = Date.now();
          const nextCount = Math.max(0, latestExpPotions - 1);
          const baseUntil =
            latestHero.expElixirUntil && latestHero.expElixirUntil > now ? latestHero.expElixirUntil : now;
          const nextUntil = baseUntil + 30 * 60 * 1000; // 30 minutes
          const updatedHero = {
            ...latestHero,
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
      });
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

    const maxDur = Math.max(1, Number(item.maxDurability ?? getItemDefaultMaxDurability(item)));
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
      saveGameToStorage({
        hero: nextHero,
        equipped: nextEquipped,
        inventory: nextInv
      });
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
      showToast(`⚠️ «${item.name}» сломался! Отремонтируйте его в сумке, чтобы снова надеть.`);
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
      saveGameToStorage({ equipped: nextEq });
    }
  };

  // Repair item in bag or equipped slot (Cost 10 gold, max durability drops by 1)
  const handleRepairItem = (item: GameItem) => {
    const curHero = heroRef.current || hero;
    if (curHero.gold < REPAIR_COST_GOLD) {
      showToast(`❌ Недостаточно золота для ремонта! Требуется ${REPAIR_COST_GOLD} 🪙`);
      return;
    }
    const maxDur = Math.max(1, Number(item.maxDurability ?? getItemDefaultMaxDurability(item)));
    const curDur = Math.max(0, Math.min(maxDur, Number(item.durability ?? maxDur)));
    if (curDur >= maxDur) {
      showToast('ℹ️ Предмет в идеальном состоянии и не нуждается в ремонте!');
      return;
    }
    if (maxDur <= 1) {
      showToast('❌ Предмет сломан окончательно (0/1). Ремонт невозможен, только продажа!');
      return;
    }
    const newMaxDur = maxDur - 1;
    const newCurDur = newMaxDur;
    const nextGold = Math.max(0, curHero.gold - REPAIR_COST_GOLD);

    const curInv = inventoryRef.current || inventory;
    const nextInv = curInv.map((it) =>
      it.id === item.id
        ? {
            ...it,
            maxDurability: newMaxDur,
            durability: newCurDur
          }
        : it
    );

    const curEq = equippedRef.current || equipped;
    let eqChanged = false;
    const nextEq = { ...curEq };
    (Object.keys(nextEq) as ItemSlot[]).forEach((slotKey) => {
      const slotItem = nextEq[slotKey];
      if (slotItem && slotItem.id === item.id) {
        eqChanged = true;
        nextEq[slotKey] = {
          ...slotItem,
          maxDurability: newMaxDur,
          durability: newCurDur
        };
      }
    });

    const baseHero = {
      ...curHero,
      gold: nextGold
    };
    const nextHero = eqChanged ? recalcGear(nextEq, baseHero) : baseHero;

    heroRef.current = nextHero;
    inventoryRef.current = nextInv;
    equippedRef.current = nextEq;
    lastSyncedFinancialsRef.current = {
      ...lastSyncedFinancialsRef.current,
      gold: nextGold,
      updatedAt: Date.now()
    };

    setHero(nextHero);
    setInventory(nextInv);
    if (eqChanged) {
      setEquipped(nextEq);
    }

    saveGameToStorage({
      hero: nextHero,
      inventory: nextInv,
      equipped: nextEq
    });

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        gold: nextGold,
        inventory: nextInv,
        equipped: nextEq,
        hp: nextHero.hp,
        max_hp: nextHero.maxHp,
        energy: nextHero.energy,
        max_energy: nextHero.maxEnergy
      });
    }

    playLevelUpSound();
    showToast(
      `🔨 Предмет «${item.name}» отремонтирован (-${REPAIR_COST_GOLD} 🪙)! Прочность: ${newCurDur}/${newMaxDur}. Теперь его можно надеть!`
    );
  };

  const handleRepairAllInventoryItems = () => {
    const curHero = heroRef.current || hero;
    const curInv = inventoryRef.current || inventory;
    const repairableItems = curInv.filter(
      (it) => it && canRepairItem(it) && !it.rent && !it.isClanRented
    );

    if (repairableItems.length === 0) {
      showToast('ℹ️ В сумке нет предметов, требующих ремонта!');
      return;
    }

    const totalCost = repairableItems.length * REPAIR_COST_GOLD;
    if (curHero.gold < totalCost) {
      showToast(
        `❌ Недостаточно золота для починки всех предметов! Нужно ${totalCost} 🪙 (у вас ${curHero.gold} 🪙)`
      );
      return;
    }

    const repairIds = new Set(repairableItems.map((it) => it.id));
    const nextInv = curInv.map((it) => {
      if (!it || !repairIds.has(it.id)) return it;
      const maxDur = Math.max(1, Number(it.maxDurability ?? getItemDefaultMaxDurability(it)));
      const newMaxDur = Math.max(1, maxDur - 1);
      return {
        ...it,
        maxDurability: newMaxDur,
        durability: newMaxDur
      };
    });

    const curEq = equippedRef.current || equipped;
    let eqChanged = false;
    const nextEq = { ...curEq };
    (Object.keys(nextEq) as ItemSlot[]).forEach((slotKey) => {
      const slotItem = nextEq[slotKey];
      if (slotItem && repairIds.has(slotItem.id)) {
        eqChanged = true;
        const maxDur = Math.max(1, Number(slotItem.maxDurability ?? getItemDefaultMaxDurability(slotItem)));
        const newMaxDur = Math.max(1, maxDur - 1);
        nextEq[slotKey] = {
          ...slotItem,
          maxDurability: newMaxDur,
          durability: newMaxDur
        };
      }
    });

    const nextGold = Math.max(0, curHero.gold - totalCost);
    const baseHero = {
      ...curHero,
      gold: nextGold
    };
    const nextHero = eqChanged ? recalcGear(nextEq, baseHero) : baseHero;

    heroRef.current = nextHero;
    inventoryRef.current = nextInv;
    equippedRef.current = nextEq;
    lastSyncedFinancialsRef.current = {
      ...lastSyncedFinancialsRef.current,
      gold: nextGold,
      updatedAt: Date.now()
    };

    setHero(nextHero);
    setInventory(nextInv);
    if (eqChanged) {
      setEquipped(nextEq);
    }

    saveGameToStorage({
      hero: nextHero,
      inventory: nextInv,
      equipped: nextEq
    });

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        gold: nextGold,
        inventory: nextInv,
        equipped: nextEq,
        hp: nextHero.hp,
        max_hp: nextHero.maxHp,
        energy: nextHero.energy,
        max_energy: nextHero.maxEnergy
      });
    }

    playLevelUpSound();
    showToast(
      `🔨 Отремонтировано предметов: ${repairableItems.length} шт. за ${totalCost} 🪙!`
    );
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

  // Buy or Upgrade NPC Companion (with support for custom templates from Shop)
  const handleBuyNpcCompanion = (template?: any) => {
    const curHero = heroRef.current || hero;
    const isAlreadyUnlocked = Boolean(curHero.npcCompanion?.unlocked);
    const allTemplates = getNpcTemplates();
    const selectedTemplate = template || allTemplates.find((t) => t.enabled) || allTemplates[0];

    if (isAlreadyUnlocked && curHero.npcCompanion?.templateId === selectedTemplate.id) {
      showToast(`ℹ️ Страж «${selectedTemplate.name}» уже активен на вашем аккаунте!`);
      return;
    }

    const reqLvl = getNpcRequiredLevel(selectedTemplate);
    const playerLvl = Number(curHero.level || (curHero as any).lvl || 1);
    if (playerLvl < reqLvl) {
      showToast(
        `⛔ Купить Стража «${selectedTemplate.name}» можно только с ${reqLvl}-го уровня! (Ваш уровень: ${playerLvl})`
      );
      return;
    }

    const cost = selectedTemplate.priceCrystals || NPC_CONFIG.priceCrystals;
    if ((curHero.crystals || 0) < cost) {
      showToast(`❌ Недостаточно кристаллов! Требуется ${cost} 💎 (у вас: ${curHero.crystals || 0} 💎)`);
      return;
    }

    const nextCrystals = Math.max(0, (curHero.crystals || 0) - cost);
    const prevLootGold = curHero.npcCompanion?.bagGold || 0;
    const prevLootExp = curHero.npcCompanion?.bagExp || 0;
    const newNpc = createDefaultNpcCompanion(curHero, selectedTemplate);
    if (prevLootGold > 0) newNpc.bagGold = prevLootGold;
    if (prevLootExp > 0) newNpc.bagExp = prevLootExp;

    const nextHero: HeroState = {
      ...curHero,
      crystals: nextCrystals,
      npcCompanion: newNpc
    };

    heroRef.current = nextHero;
    lastSyncedFinancialsRef.current = {
      ...lastSyncedFinancialsRef.current,
      crystals: nextCrystals,
      updatedAt: Date.now()
    };
    setHero(nextHero);
    saveGameToStorage({ hero: nextHero });

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        crystals: nextCrystals,
        npc_companion: newNpc,
        npcCompanion: newNpc
      });
    }

    playLevelUpSound();
    showToast(`🤖 Страж «${selectedTemplate.name}» ${selectedTemplate.icon} успешно получен!`);
    addCombatLog(`🤖 Вы наняли Стража «${selectedTemplate.name}» за ${cost} 💎!`, 'loot');
  };

  // Claim loot accumulated in NPC Companion's backpack
  const handleClaimNpcLoot = () => {
    const curHero = heroRef.current || hero;
    const npc = curHero.npcCompanion;
    if (!npc || !npc.unlocked) {
      showToast('ℹ️ Страж NPC ещё не нанят!');
      return;
    }
    const lootGold = Math.max(0, Number(npc.bagGold || 0));
    const lootExp = Math.max(0, Number(npc.bagExp || 0));

    if (lootGold === 0 && lootExp === 0) {
      showToast('🎒 В рюкзаке Стража пока нет добычи для сбора.');
      return;
    }

    let nextGold = (curHero.gold || 0) + lootGold;
    let nextExp = (curHero.exp || 0) + lootExp;
    let nextLvl = curHero.level;
    let nextStatPoints = curHero.statPoints || 0;
    let leveledUp = false;

    while (nextLvl < MAX_LEVEL && nextExp >= EXP_TABLE[nextLvl]) {
      nextExp -= EXP_TABLE[nextLvl];
      nextLvl++;
      nextStatPoints += 3;
      leveledUp = true;
    }

    const updatedNpc = {
      ...npc,
      bagGold: 0,
      bagExp: 0,
      logs: [
        {
          id: `npc_claim_${Date.now()}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `🎒 Вы забрали добычу: +${lootGold.toLocaleString()} 🪙 золота, +${lootExp.toLocaleString()} EXP опыта.`,
          type: 'loot' as const
        },
        ...(Array.isArray(npc.logs) ? npc.logs : [])
      ].slice(0, 35)
    };

    const nextHero: HeroState = {
      ...curHero,
      gold: nextGold,
      exp: nextExp,
      level: nextLvl,
      statPoints: nextStatPoints,
      npcCompanion: updatedNpc
    };

    heroRef.current = nextHero;
    lastSyncedFinancialsRef.current = {
      ...lastSyncedFinancialsRef.current,
      gold: nextGold,
      updatedAt: Date.now()
    };
    setHero(nextHero);
    saveGameToStorage({ hero: nextHero });

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        gold: nextGold,
        exp: nextExp,
        level: nextLvl,
        lvl: nextLvl,
        stat_points: nextStatPoints,
        npc_companion: updatedNpc,
        npcCompanion: updatedNpc
      });
    }

    playLootSound();
    if (leveledUp) {
      playLevelUpSound();
      showToast(`🎉 Уровень повышен до ${nextLvl}! +3 очка характеристик!`);
    } else {
      showToast(`🎒 Забрали из рюкзака NPC: +${lootGold.toLocaleString()} 🪙 и +${lootExp.toLocaleString()} EXP!`);
    }
    addCombatLog(`🎒 Забрали из рюкзака Стража NPC: +${lootGold.toLocaleString()} 🪙 и +${lootExp.toLocaleString()} EXP!`, 'loot');
  };

  // Toggle NPC active/inactive (strict ON/OFF switch: works when ON, completely stopped when OFF)
  const handleToggleNpcActive = () => {
    const curHero = heroRef.current || hero;
    const npc = curHero.npcCompanion;
    if (!npc || !npc.unlocked) {
      showToast('ℹ️ Страж NPC ещё не нанят!');
      return;
    }

    const effective = getNpcEffectiveStats(curHero, npc);
    const now = Date.now();

    if (npc.isActive) {
      // Turn OFF: immediately stop and recall to city
      const updatedNpc = {
        ...npc,
        isActive: false,
        lastRegenTime: now,
        lastActionTime: now,
        logs: [
          {
            id: `npc_recall_${now}`,
            time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: '🔴 Страж NPC выключен и остановлен в Городе Луксор.',
            type: 'step' as const
          },
          ...(Array.isArray(npc.logs) ? npc.logs : [])
        ].slice(0, 35)
      };

      const nextHero: HeroState = { ...curHero, npcCompanion: updatedNpc };
      heroRef.current = nextHero;
      lastAppliedExternalSyncTsRef.current = now;
      setHero(nextHero);
      saveGameToStorage({ hero: nextHero });
      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          npc_companion: updatedNpc,
          npcCompanion: updatedNpc,
          external_sync_ts: now
        });
      }
      showToast('🔴 Страж NPC выключен и остановлен.');
      return;
    }

    if (featureFlags.npcCompanionsEnabled === false) {
      showToast('⛔ Система Стражей NPC сейчас отключена в настройках Администратора!');
      return;
    }

    if (screen === 'pyramid' || livePosRef.current.screen === 'pyramid') {
      showToast('⛔ Вы сейчас находитесь в Пирамиде! Сначала выйдите в Город Луксор, чтобы включить Стража NPC.');
      return;
    }

    const minEnergyCost = Math.max(1, Number(NPC_CONFIG.energyPerAttack || 3));
    const currentNpcEnergy = Number(npc.energy ?? effective.maxEnergy);
    if (currentNpcEnergy < minEnergyCost) {
      showToast(
        `⚡ Недостаточно энергии для включения Стража (нужно минимум ${minEnergyCost}⚡, сейчас ${currentNpcEnergy}/${effective.maxEnergy}⚡)! Подождите пару секунд.`
      );
      return;
    }

    // Turn ON: activate NPC
    const updatedNpc = {
      ...npc,
      isActive: true,
      lastActionTime: now,
      lastRegenTime: now,
      tier: effective.tier,
      logs: [
        {
          id: `npc_start_${now}`,
          time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `🟢 Страж NPC включен и отправился фармить монстров в Пирамиду (Ярус ${effective.tier})!`,
          type: 'step' as const
        },
        ...(Array.isArray(npc.logs) ? npc.logs : [])
      ].slice(0, 35)
    };

    const nextHero: HeroState = { ...curHero, npcCompanion: updatedNpc };
    heroRef.current = nextHero;
    lastAppliedExternalSyncTsRef.current = now;
    setHero(nextHero);
    saveGameToStorage({ hero: nextHero });
    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        npc_companion: updatedNpc,
        npcCompanion: updatedNpc,
        external_sync_ts: now
      });
    }
    showToast(`🟢 Страж NPC включен и работает в Пирамиде (Ярус ${effective.tier})!`);
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

    const maxDur = Math.max(1, Number(item.maxDurability ?? getItemDefaultMaxDurability(item)));
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
    const curInv = inventoryRef.current || inventory;
    const itemIndex = curInv.findIndex((it) => it.id === itemId);
    if (itemIndex < 0) return;
    const item = curInv[itemIndex];

    const now = Date.now();
    const until = now + hours * 3600000;
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const iconTxt = formatItemIconForText(item.icon);

    const updatedItem: GameItem = {
      ...item,
      rent: {
        to: targetNick,
        hours,
        price,
        startTime: now,
        until,
        expiredNotified: false
      }
    };

    const newInventory = [...curInv];
    newInventory[itemIndex] = updatedItem;
    inventoryRef.current = newInventory;
    setInventory(newInventory);

    // Instant rental fee
    const curHero = heroRef.current || hero;
    const nextGold = curHero.gold + price;
    const nextHero = {
      ...curHero,
      gold: nextGold
    };
    heroRef.current = nextHero;
    setHero(nextHero);

    // Trade protocol
    const protEntry: TradeProtocolEntry = {
      id: 'prot_rent_' + now.toString(36) + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: now,
      dateStr,
      type: 'rent_out',
      itemId: item.id,
      reclaimed: false,
      description: `🤝 Аренда: ${iconTxt} ${item.name} сдан в аренду игроку ${targetNick} на ${hours} ч. Получено +${price} 🪙`,
      itemSnapshot: { name: item.name, icon: item.icon, quality: item.quality },
      targetNick,
      amount: price
    };
    const nextProtocol = [protEntry, ...(tradeProtocolRef.current || tradeProtocol)];
    tradeProtocolRef.current = nextProtocol;
    setTradeProtocol(nextProtocol);

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        gold: nextGold,
        inventory: newInventory,
        trade_protocol: nextProtocol
      });
    }

    // World chat
    setChatMessages((prev) => [
      ...prev,
      {
        id: 'msg_rent_' + now,
        time: dateStr,
        author: 'Лог',
        text: `🤝 ${currentUser || 'Игрок'} сдал в аренду ${iconTxt} ${item.name} игроку ${targetNick} на ${hours}ч (+${price}🪙)`,
        channel: 'world'
      }
    ]);

    playCoinSound();
    showToast(`🤝 Аренда оформлена: +${price} 🪙 на баланс!`);
  };

  // Reclaim rented item into bag (after rent expiration or early return)
  const handleReturnRentEarly = (item: GameItem) => {
    const curInv = inventoryRef.current || inventory;
    const itemIndex = curInv.findIndex((it) => it.id === item.id);
    if (itemIndex < 0) return;

    const currentItem = curInv[itemIndex];
    const now = Date.now();
    const renter = currentItem.rent?.to || item.rent?.to || 'Арендатор';
    const isExpired = Boolean(currentItem.rent?.until && now >= currentItem.rent.until);
    const iconTxt = formatItemIconForText(currentItem.icon);

    const updatedItem: GameItem = {
      ...currentItem,
      rent: null
    };

    const newInventory = [...curInv];
    newInventory[itemIndex] = updatedItem;
    inventoryRef.current = newInventory;
    setInventory(newInventory);

    const dateStr = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const protEntry: TradeProtocolEntry = {
      id: 'prot_re_' + now.toString(36) + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: now,
      dateStr,
      type: 'rent_return',
      itemId: currentItem.id,
      reclaimed: true,
      description: isExpired
        ? `✅ Возврат из аренды: Предмет ${iconTxt} ${currentItem.name} (арендатор: ${renter}) забран обратно в сумку по истечении срока аренды.`
        : `↩️ Досрочный возврат: Предмет ${iconTxt} ${currentItem.name} возвращён из аренды от ${renter} в сумку.`,
      itemSnapshot: {
        name: currentItem.name,
        icon: currentItem.icon,
        quality: currentItem.quality
      },
      targetNick: renter
    };

    const prevProt = tradeProtocolRef.current || tradeProtocol;
    const nextProtocol = [
      protEntry,
      ...prevProt.map((entry) =>
        entry.type === 'rent_out' &&
        (entry.itemId === currentItem.id ||
          (!entry.itemId && entry.itemSnapshot?.name === currentItem.name && !entry.reclaimed))
          ? { ...entry, reclaimed: true }
          : entry
      )
    ];
    tradeProtocolRef.current = nextProtocol;
    setTradeProtocol(nextProtocol);

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        inventory: newInventory,
        trade_protocol: nextProtocol
      });
    }

    const reclaimChatText = `🎒 Предмет ${iconTxt} «${currentItem.name}» успешно забран из аренды (от ${renter}) обратно в сумку!`;
    setChatMessages((prev) => [
      ...prev,
      {
        id: `rent_reclaim_${currentItem.id}_${now}`,
        time: dateStr,
        author: 'Система',
        text: reclaimChatText,
        isSystem: true,
        channel: 'world'
      }
    ]);

    playLootSound();
    showToast(`🎒 Предмет «${currentItem.name}» забран из аренды в сумку!`);
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
        items_sold: nextHero.itemsSold,
        itemsSold: nextHero.itemsSold,
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

  const handleQuickSellCommonItems = () => {
    const curInv = inventoryRef.current || inventory;
    const curHero = heroRef.current || hero;

    const toSell: GameItem[] = [];
    const remainingInv: GameItem[] = [];

    for (const it of curInv) {
      if (
        it &&
        (it.quality || 'common') === 'common' &&
        !it.rent &&
        !it.isClanRented &&
        !(it as any).clanStorageId &&
        !isCustomCreatedItem(it)
      ) {
        toSell.push(it);
      } else {
        remainingInv.push(it);
      }
    }

    if (toSell.length === 0) {
      showToast('ℹ️ В сумке нет обычных предметов для быстрой продажи!');
      return;
    }

    let totalGoldGain = 0;
    let totalCrystalGain = 0;
    for (const it of toSell) {
      const refund = getItemSellRefund(it);
      if (refund.currency === 'crystals') {
        totalCrystalGain += refund.amount;
      } else {
        totalGoldGain += refund.amount;
      }
    }

    const soldCount = toSell.length;
    const expGain = soldCount * 2;
    const newExp = (curHero.sellExperience || 0) + expGain;
    let newCapacity = curHero.bagCapacity || 100;
    if (newExp >= 1300) newCapacity = Math.max(newCapacity, 250);
    else if (newExp >= 1000) newCapacity = Math.max(newCapacity, 210);
    else if (newExp >= 600) newCapacity = Math.max(newCapacity, 180);
    else if (newExp >= 250) newCapacity = Math.max(newCapacity, 150);
    else if (newExp >= 100) newCapacity = Math.max(newCapacity, 120);

    const nextGold = curHero.gold + totalGoldGain;
    const nextCrystals = curHero.crystals + totalCrystalGain;
    const nextTotalGold = Math.max(
      nextGold,
      Number(curHero.totalGoldCollected || curHero.gold || 0) + totalGoldGain
    );

    const nextHero: HeroState = {
      ...curHero,
      gold: nextGold,
      crystals: nextCrystals,
      totalGoldCollected: nextTotalGold,
      itemsSold: (curHero.itemsSold || 0) + soldCount,
      sellExperience: newExp,
      bagCapacity: newCapacity
    };

    inventoryRef.current = remainingInv;
    heroRef.current = nextHero;
    lastSyncedFinancialsRef.current = {
      ...lastSyncedFinancialsRef.current,
      gold: nextGold,
      crystals: nextCrystals,
      totalGoldCollected: nextTotalGold,
      updatedAt: Date.now()
    };

    setInventory(remainingInv);
    setHero(nextHero);

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        gold: nextGold,
        crystals: nextCrystals,
        total_gold_collected: nextTotalGold,
        items_sold: nextHero.itemsSold,
        itemsSold: nextHero.itemsSold,
        inventory: remainingInv,
        sell_experience: newExp,
        bag_capacity: newCapacity
      });
    }

    playCoinSound();
    showToast(
      `⚡ Быстрая продажа: продано ${soldCount} обычных предм. за +${totalGoldGain} 🪙${
        totalCrystalGain > 0 ? ` и +${totalCrystalGain} 💎` : ''
      }!`
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
        setRareActionConfirmModal({
          title: '⚖️ Продажа редкого эликсира',
          itemTitle: `✨ Эликсир Опыта (${qty} шт.)`,
          icon: '✨',
          badgeText: `Выручка: +${crystalGain} 💎`,
          warningText: `Вы собираетесь продать редкий предмет «Эликсир Опыта» (${qty} шт.). После продажи вернуть эликсиры будет нельзя!`,
          effectText: `💎 Вы получите +${crystalGain} кристаллов (в запасе останется: ${curCount - qty} шт.).`,
          confirmLabel: `💰 Продать за +${crystalGain} 💎`,
          accentColor: 'amber',
          onConfirm: () => {
            const latestHero = heroRef.current || hero;
            const latestCount = Number(latestHero.expPotions || 0);
            if (latestCount < qty) return;
            const nextCrystals = Number(latestHero.crystals || 0) + crystalGain;
            const nextExpPotions = latestCount - qty;
            const nextHero: HeroState = {
              ...latestHero,
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
          }
        });
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
          ? `Эликсир Жизни (${qty} шт.)`
          : type === 'en'
          ? `Эликсир Энергии (${qty} шт.)`
          : `Эликсир Опыта (${qty} шт.)`;
      const elixirIcon =
        type === 'hp'
          ? '/assets/elixirs/elixir_hp.png'
          : type === 'en'
          ? '/assets/elixirs/elixir_en.png'
          : '/assets/elixirs/elixir_exp.png';

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

  const executeBuyKillerLicense = useCallback(
    (activateNow = true) => {
      const curHero = heroRef.current || hero;
      const cost = KILLER_LICENSE_CONFIG.costCrystals;
      const curCrystals = Number(curHero.crystals || 0);
      if (curCrystals < cost) {
        showToast(`❌ Недостаточно кристаллов! Для покупки «Лицензии киллера» нужно ${cost} 💎 (у вас ${curCrystals} 💎).`);
        return;
      }

      const now = Date.now();
      const nextCrystals = Math.max(0, curCrystals - cost);
      let nextUntil = Number(curHero.killerLicenseUntil || 0);
      let nextStored = Number(curHero.killerLicenses || 0);

      if (activateNow) {
        const baseTime = nextUntil > now ? nextUntil : now;
        nextUntil = baseTime + KILLER_LICENSE_CONFIG.durationMs;
      } else {
        nextStored += 1;
      }

      const nextHero: HeroState = {
        ...curHero,
        crystals: nextCrystals,
        killerLicenseUntil: nextUntil > now ? nextUntil : undefined,
        killerLicenses: nextStored
      };

      heroRef.current = nextHero;
      lastSyncedFinancialsRef.current = {
        ...lastSyncedFinancialsRef.current,
        crystals: nextCrystals,
        updatedAt: now
      };
      setHero(nextHero);

      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          crystals: nextCrystals,
          killer_license_until: nextUntil > now ? nextUntil : 0,
          killer_licenses: nextStored
        });
      }

      const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setTradeProtocol((prev) => [
        {
          id: 'lic_killer_' + now,
          timestamp: now,
          dateStr,
          type: 'purchase',
          description: activateNow
            ? `📜 Куплена и активирована «1. Лицензия киллера» на 1 день (24ч) за ${cost} 💎 (осталось: ${formatLicenseRemainingTime(nextUntil, now)})`
            : `📜 Куплена в запас «1. Лицензия киллера» (1 дн.) за ${cost} 💎 (в запасе: ${nextStored} шт.)`,
          amount: cost
        },
        ...prev
      ]);

      playLevelUpSound();
      if (activateNow) {
        showToast(
          `🗡️ «Лицензия киллера» активирована на 1 день (24 часа)! Теперь вы можете атаковать и убивать игроков внутри Пирамиды.`
        );
      } else {
        showToast(
          `📜 «Лицензия киллера» куплена в запас (в наличии: ${nextStored} шт.)! Нажмите «Использовать», чтобы запустить таймер на 1 день.`
        );
      }
    },
    [hero, currentUser, flushPlayerUpdates, showToast]
  );

  // Buy Killer License ("1. Лицензия киллера", 10 crystals, 1 day duration)
  const handleBuyKillerLicense = useCallback(
    (activateNow = true) => {
      const curHero = heroRef.current || hero;
      const cost = KILLER_LICENSE_CONFIG.costCrystals;
      const curCrystals = Number(curHero.crystals || 0);
      if (curCrystals < cost) {
        showToast(`❌ Недостаточно кристаллов! Для покупки «Лицензии киллера» нужно ${cost} 💎 (у вас ${curCrystals} 💎).`);
        return;
      }

      if (activateNow) {
        setRareActionConfirmModal({
          title: '⚠️ Покупка и активация лицензии',
          itemTitle: '🗡️ 1. Лицензия киллера (24 часа)',
          icon: '🗡️',
          badgeText: `Стоимость: ${cost} 💎`,
          warningText:
            'Вы покупаете и сразу активируете редкую «Лицензию киллера». Таймер 24-часовой PvP-охоты запустится немедленно!',
          effectText:
            '💡 Совет: если вы не планируете идти в Пирамиду прямо сейчас, вы можете купить лицензию «В запас».',
          confirmLabel: `🗡️ Купить и активировать (${cost} 💎)`,
          accentColor: 'red',
          onConfirm: () => executeBuyKillerLicense(true)
        });
        return;
      }

      executeBuyKillerLicense(false);
    },
    [hero, executeBuyKillerLicense, showToast]
  );

  // Activate a stored Killer License from reserve (adds 24 hours to active timer)
  const handleUseKillerLicense = useCallback(() => {
    const curHero = heroRef.current || hero;
    const stored = Number(curHero.killerLicenses || 0);
    if (stored <= 0) {
      showToast('❌ У вас нет неактивированных «Лицензий киллера» в запасе! Купите лицензию в разделе «Магазин ➔ Лицензии».');
      return;
    }

    const nowCheck = Date.now();
    const curUntilCheck = Number(curHero.killerLicenseUntil || 0);
    const isAlreadyActive = curUntilCheck > nowCheck;

    setRareActionConfirmModal({
      title: '⚠️ Активация Лицензии киллера',
      itemTitle: '🗡️ 1. Лицензия киллера (24 часа)',
      icon: '🗡️',
      badgeText: `В запасе: ${stored} шт. • Ценность: 10 💎`,
      warningText:
        'Вы собираетесь использовать редкую «Лицензию киллера» из своего запаса. После подтверждения 1 лицензия будет безвозвратно потрачена.',
      effectText: isAlreadyActive
        ? '⏱️ Активная лицензия будет продлена ещё на +24 часа.'
        : `⏱️ Открывает PvP-охоту в Пирамиде на 24 часа (в запасе останется: ${stored - 1} шт.).`,
      confirmLabel: '🗡️ Использовать лицензию',
      accentColor: 'red',
      onConfirm: () => {
        const latestHero = heroRef.current || hero;
        const latestStored = Number(latestHero.killerLicenses || 0);
        if (latestStored <= 0) return;

        const now = Date.now();
        const curUntil = Number(latestHero.killerLicenseUntil || 0);
        const baseTime = curUntil > now ? curUntil : now;
        const nextUntil = baseTime + KILLER_LICENSE_CONFIG.durationMs;
        const nextStored = Math.max(0, latestStored - 1);

        const nextHero: HeroState = {
          ...latestHero,
          killerLicenseUntil: nextUntil,
          killerLicenses: nextStored
        };

        heroRef.current = nextHero;
        setHero(nextHero);

        if (currentUser) {
          flushPlayerUpdates(currentUser, {
            killer_license_until: nextUntil,
            killer_licenses: nextStored
          });
        }

        playLevelUpSound();
        showToast(
          `🗡️ «Лицензия киллера» использована! Срок действия: ${formatLicenseRemainingTime(nextUntil, now)}. Охота в Пирамиде открыта!`
        );
      }
    });
  }, [hero, currentUser, flushPlayerUpdates, showToast]);

  // Enter next pyramid tier through the portal (unlocks and sets homePyramidTier = nextT)
  const handleEnterNextTierPortal = useCallback(() => {
    const curCell = pyramidMap[playerPos.row]?.[playerPos.col];
    if (!curCell || (curCell.type !== 'nextTier' && curCell.type !== 'portal')) {
      showToast('🌀 Сначала встаньте на клетку Портала!');
      return;
    }
    if (pyramidTier >= 3) {
      showToast('👑 Вы уже находитесь в Пирамиде 3! Используйте карточки слева для перехода в П1 или П2.');
      return;
    }
    const requiredLvl = pyramidTier === 1 ? 5 : 10;
    if (hero.level < requiredLvl) {
      showToast(
        `⛔ Врата запечатаны! Требуется ${requiredLvl}-й уровень для перехода в Пирамиду ${pyramidTier + 1} (или используйте карточку перехода слева).`
      );
      return;
    }
    playLevelUpSound();
    const nextT = Math.min(3, pyramidTier + 1);
    const startPos = {
      row: PYRAMID_SPAWN_POS.row,
      col: PYRAMID_SPAWN_POS.col
    };
    setPyramidTier(nextT);
    pyramidTierRef.current = nextT;
    setHero((prev) => {
      const updated: HeroState = {
        ...prev,
        pyramidTier: nextT,
        homePyramidTier: nextT
      };
      heroRef.current = updated;
      return updated;
    });
    generateNewPyramid(nextT, startPos);
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
        home_pyramid_tier: nextT,
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
    showToast(`🌀 Вы прошли через Портал и открыли Пирамиду ${nextT}! Теперь это ваша основная пирамида.`);
  }, [pyramidMap, playerPos, pyramidTier, hero, currentUser, generateNewPyramid, flushPlayerUpdates, queueRealtimePlayerSync, showToast]);

  // Buy Pyramid Transition Card (1, 2, or 3) for 3 Crystals in Shop -> Licenses
  const handleBuyPyramidCard = useCallback(
    (targetTier: 1 | 2 | 3) => {
      const curHero = heroRef.current || hero;
      const cost = 3;
      const curCrystals = Number(curHero.crystals || 0);
      if (curCrystals < cost) {
        showToast(
          `❌ Недостаточно кристаллов! Для покупки «Карточки перехода в ${targetTier} пирамиду» нужно ${cost} 💎 (у вас ${curCrystals} 💎).`
        );
        return;
      }

      const now = Date.now();
      const nextCrystals = Math.max(0, curCrystals - cost);
      const nextCard1 = targetTier === 1 ? Number(curHero.pyramidCard1 || 0) + 1 : Number(curHero.pyramidCard1 || 0);
      const nextCard2 = targetTier === 2 ? Number(curHero.pyramidCard2 || 0) + 1 : Number(curHero.pyramidCard2 || 0);
      const nextCard3 = targetTier === 3 ? Number(curHero.pyramidCard3 || 0) + 1 : Number(curHero.pyramidCard3 || 0);

      const nextHero: HeroState = {
        ...curHero,
        crystals: nextCrystals,
        pyramidCard1: nextCard1,
        pyramidCard2: nextCard2,
        pyramidCard3: nextCard3
      };

      heroRef.current = nextHero;
      lastSyncedFinancialsRef.current = {
        ...lastSyncedFinancialsRef.current,
        crystals: nextCrystals,
        updatedAt: now
      };
      setHero(nextHero);

      if (currentUser) {
        flushPlayerUpdates(currentUser, {
          crystals: nextCrystals,
          pyramid_card_1: nextCard1,
          pyramid_card_2: nextCard2,
          pyramid_card_3: nextCard3
        });
      }

      const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setTradeProtocol((prev) => [
        {
          id: `pyr_card_${targetTier}_${now}`,
          timestamp: now,
          dateStr,
          type: 'purchase',
          description: `🎫 Куплена «Карточка перехода в ${targetTier} пирамиду» за ${cost} 💎`,
          amount: cost
        },
        ...prev
      ]);

      playCoinSound();
      showToast(
        `🎫 Куплена «Карточка перехода в ${targetTier} пирамиду» за ${cost} 💎! Используйте её слева в Пирамиде, когда встанете на Портал.`
      );
    },
    [hero, currentUser, flushPlayerUpdates, showToast]
  );

  // Use Pyramid Transition Card (1, 2, or 3) while standing on a portal cell
  const handleUsePyramidCard = useCallback(
    (targetTier: 1 | 2 | 3) => {
      if (screen !== 'pyramid') {
        showToast('🌀 Карточки перехода работают только внутри Пирамиды на клетке Портала!');
        return;
      }
      const curCell = pyramidMap[playerPos.row]?.[playerPos.col];
      const onPortal = curCell?.type === 'nextTier' || curCell?.type === 'portal';
      if (!onPortal) {
        showToast('🌀 Встаньте на клетку Портала (🌀), чтобы использовать карточку перехода!');
        return;
      }

      const curHero = heroRef.current || hero;
      const available =
        targetTier === 1
          ? Number(curHero.pyramidCard1 || 0)
          : targetTier === 2
          ? Number(curHero.pyramidCard2 || 0)
          : Number(curHero.pyramidCard3 || 0);

      if (available <= 0) {
        showToast(
          `❌ У вас нет «Карточки перехода в ${targetTier} пирамиду»! Купите её в разделе «Магазин ➔ Лицензии» за 3 💎.`
        );
        return;
      }

      if (pyramidTier === targetTier) {
        showToast(`📍 Вы уже находитесь в Пирамиде ${targetTier}!`);
        return;
      }

      setRareActionConfirmModal({
        title: '⚠️ Использование карточки перехода',
        itemTitle: `🎫 Карточка перехода в ${targetTier} пирамиду`,
        icon: '🎫',
        badgeText: `В запасе: ${available} шт. • Ценность: 3 💎`,
        warningText: `Вы собираетесь потратить 1 карточку для мгновенного перехода в Пирамиду ${targetTier}. После перехода карточка расходуется.`,
        effectText: `🌀 В запасе останется: ${available - 1} шт. При выходе в Город вы вернётесь в свою основную Пирамиду.`,
        confirmLabel: `🌀 Перейти в Пирамиду ${targetTier}`,
        accentColor: 'cyan',
        onConfirm: () => {
          const latestHero = heroRef.current || hero;
          const latestAvailable =
            targetTier === 1
              ? Number(latestHero.pyramidCard1 || 0)
              : targetTier === 2
              ? Number(latestHero.pyramidCard2 || 0)
              : Number(latestHero.pyramidCard3 || 0);
          if (latestAvailable <= 0) return;

          const nextCard1 = targetTier === 1 ? Math.max(0, latestAvailable - 1) : Number(latestHero.pyramidCard1 || 0);
          const nextCard2 = targetTier === 2 ? Math.max(0, latestAvailable - 1) : Number(latestHero.pyramidCard2 || 0);
          const nextCard3 = targetTier === 3 ? Math.max(0, latestAvailable - 1) : Number(latestHero.pyramidCard3 || 0);
          const preservedHomeTier = Math.max(1, Math.min(3, Number(latestHero.homePyramidTier || 1)));

          const startPos = {
            row: PYRAMID_SPAWN_POS.row,
            col: PYRAMID_SPAWN_POS.col
          };

          const nextHero: HeroState = {
            ...latestHero,
            pyramidTier: targetTier,
            homePyramidTier: preservedHomeTier,
            pyramidCard1: nextCard1,
            pyramidCard2: nextCard2,
            pyramidCard3: nextCard3
          };

          heroRef.current = nextHero;
          setHero(nextHero);
          setPyramidTier(targetTier);
          pyramidTierRef.current = targetTier;
          generateNewPyramid(targetTier, startPos);

          livePosRef.current = {
            screen: 'pyramid',
            tier: targetTier,
            row: startPos.row,
            col: startPos.col
          };

          if (currentUser) {
            flushPlayerUpdates(currentUser, {
              location: 'pyramid',
              pyramid_tier: targetTier,
              home_pyramid_tier: preservedHomeTier,
              pyramid_card_1: nextCard1,
              pyramid_card_2: nextCard2,
              pyramid_card_3: nextCard3,
              пирамидальный_уровень: targetTier,
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
              pyramidTier: targetTier,
              row: startPos.row,
              col: startPos.col,
              hp: nextHero.hp,
              maxHp: nextHero.maxHp,
              lvl: nextHero.level,
              avatar: nextHero.avatar || '🧙‍♂️',
              isOnline: true
            });
          }

          playLevelUpSound();
          showToast(
            `🎫 Вы использовали карточку и перешли в Пирамиду ${targetTier}! Чтобы вернуться в свою Пирамиду (${preservedHomeTier}), просто выйдите на главную.`
          );
        }
      });
    },
    [screen, pyramidMap, playerPos, hero, pyramidTier, currentUser, generateNewPyramid, flushPlayerUpdates, queueRealtimePlayerSync, showToast]
  );

  const handleAttackPlayer = (targetNick: string) => {
    executePvPAttackOnPlayer(targetNick);
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

  // ================= DAILY QUESTS & CRYSTAL CHESTS SYSTEM =================
  const saveDailyQuestsToLocal = useCallback(
    (
      userNick: string,
      data: {
        dailyQuests: DailyQuest[];
        dailyQuestsDate: string;
        dailyCrystalChestClaimedDate?: string;
      }
    ) => {
      if (typeof window === 'undefined' || !userNick) return;
      try {
        localStorage.setItem(
          `pyramid_daily_quests_${userNick.toLowerCase()}`,
          JSON.stringify(data)
        );
      } catch {
        // ignore storage errors
      }
    },
    []
  );

  // Sync or initialize today's daily quests for the active player
  useEffect(() => {
    if (!currentUser) return;
    const todayKey = getDailyRewardDayKey();
    let storedQuests: DailyQuest[] | undefined = hero.dailyQuests;
    let storedDate: string | undefined = hero.dailyQuestsDate;
    let storedGrandClaimed: string | undefined = hero.dailyCrystalChestClaimedDate;

    try {
      const raw = localStorage.getItem(`pyramid_daily_quests_${currentUser.toLowerCase()}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.dailyQuestsDate === todayKey && Array.isArray(parsed.dailyQuests)) {
          storedQuests = parsed.dailyQuests;
          storedDate = parsed.dailyQuestsDate;
          storedGrandClaimed = parsed.dailyCrystalChestClaimedDate || storedGrandClaimed;
        }
      }
    } catch {
      // ignore
    }

    const ensured = ensureDailyQuestsForToday(storedQuests, storedDate);
    if (
      hero.dailyQuestsDate !== ensured.dailyQuestsDate ||
      !Array.isArray(hero.dailyQuests) ||
      hero.dailyQuests.length === 0 ||
      (storedGrandClaimed && hero.dailyCrystalChestClaimedDate !== storedGrandClaimed)
    ) {
      const nextGrandClaimed =
        storedDate === todayKey ? storedGrandClaimed || hero.dailyCrystalChestClaimedDate : undefined;
      setHero((prev) => {
        const updated = {
          ...prev,
          dailyQuests: ensured.dailyQuests,
          dailyQuestsDate: ensured.dailyQuestsDate,
          dailyCrystalChestClaimedDate: nextGrandClaimed
        };
        heroRef.current = updated;
        return updated;
      });
      saveDailyQuestsToLocal(currentUser, {
        dailyQuests: ensured.dailyQuests,
        dailyQuestsDate: ensured.dailyQuestsDate,
        dailyCrystalChestClaimedDate: nextGrandClaimed
      });
    }
  }, [currentUser, hero.dailyQuestsDate]);

  const dailyQuestBaselineRef = useRef<{
    user: string | null;
    mobsKilled: number;
    totalGoldCollected: number;
    bossesOrScarab: number;
    row: number;
    col: number;
    screen: 'city' | 'pyramid';
  }>({
    user: currentUser,
    mobsKilled: Number(hero.mobsKilled || 0),
    totalGoldCollected: Number(hero.totalGoldCollected || hero.gold || 0),
    bossesOrScarab: Number(hero.bossesKilled || 0) + Number(hero.gamblingGamesPlayed || 0),
    row: playerPos.row,
    col: playerPos.col,
    screen
  });

  useEffect(() => {
    if (!currentUser) return;
    const prev = dailyQuestBaselineRef.current;
    const curMobs = Number(hero.mobsKilled || 0);
    const curGold = Number(hero.totalGoldCollected || hero.gold || 0);
    const curBossOrScarab = Number(hero.bossesKilled || 0) + Number(hero.gamblingGamesPlayed || 0);

    if (prev.user !== currentUser) {
      dailyQuestBaselineRef.current = {
        user: currentUser,
        mobsKilled: curMobs,
        totalGoldCollected: curGold,
        bossesOrScarab: curBossOrScarab,
        row: playerPos.row,
        col: playerPos.col,
        screen
      };
      return;
    }

    const dMobs = Math.max(0, curMobs - prev.mobsKilled);
    const dGold = Math.max(0, curGold - prev.totalGoldCollected);
    const dBossOrScarab = Math.max(0, curBossOrScarab - prev.bossesOrScarab);
    const dSteps =
      screen === 'pyramid' &&
      prev.screen === 'pyramid' &&
      (playerPos.row !== prev.row || playerPos.col !== prev.col)
        ? 1
        : 0;

    dailyQuestBaselineRef.current = {
      user: currentUser,
      mobsKilled: curMobs,
      totalGoldCollected: curGold,
      bossesOrScarab: curBossOrScarab,
      row: playerPos.row,
      col: playerPos.col,
      screen
    };

    if (dMobs === 0 && dGold === 0 && dBossOrScarab === 0 && dSteps === 0) return;

    const curHero = heroRef.current || hero;
    const ensured = ensureDailyQuestsForToday(curHero.dailyQuests, curHero.dailyQuestsDate);
    let quests = ensured.dailyQuests;
    const newlyCompleted: DailyQuest[] = [];

    if (dMobs > 0) {
      const res = advanceDailyQuestProgress(quests, 'kill_mobs', dMobs);
      quests = res.dailyQuests;
      if (Array.isArray(res.newlyCompleted)) newlyCompleted.push(...res.newlyCompleted);
    }
    if (dGold > 0) {
      const res = advanceDailyQuestProgress(quests, 'collect_gold', dGold);
      quests = res.dailyQuests;
      if (Array.isArray(res.newlyCompleted)) newlyCompleted.push(...res.newlyCompleted);
    }
    if (dSteps > 0) {
      const res = advanceDailyQuestProgress(quests, 'pyramid_steps', dSteps);
      quests = res.dailyQuests;
      if (Array.isArray(res.newlyCompleted)) newlyCompleted.push(...res.newlyCompleted);
    }
    if (dBossOrScarab > 0) {
      const res = advanceDailyQuestProgress(quests, 'boss_or_scarab', dBossOrScarab);
      quests = res.dailyQuests;
      if (Array.isArray(res.newlyCompleted)) newlyCompleted.push(...res.newlyCompleted);
    }

    const updatedHero: HeroState = {
      ...curHero,
      dailyQuests: quests,
      dailyQuestsDate: ensured.dailyQuestsDate
    };
    heroRef.current = updatedHero;
    setHero(updatedHero);
    saveDailyQuestsToLocal(currentUser, {
      dailyQuests: quests,
      dailyQuestsDate: ensured.dailyQuestsDate,
      dailyCrystalChestClaimedDate: updatedHero.dailyCrystalChestClaimedDate
    });

    if (newlyCompleted.length > 0) {
      const firstDone = newlyCompleted[0];
      showToast(`🧰 Задание выполнено: «${firstDone.title}»! Заберите Сундук с кристаллами!`);
    }
  }, [
    currentUser,
    hero.mobsKilled,
    hero.totalGoldCollected,
    hero.bossesKilled,
    hero.gamblingGamesPlayed,
    playerPos.row,
    playerPos.col,
    screen,
    saveDailyQuestsToLocal
  ]);

  const handleClaimQuestChest = (quest: DailyQuest) => {
    if (!currentUser) return;
    const curHero = heroRef.current || hero;
    const ensured = ensureDailyQuestsForToday(curHero.dailyQuests, curHero.dailyQuestsDate);
    const target = ensured.dailyQuests.find((q) => q.id === quest.id);
    const isTargetCompleted = Boolean(target && (target.isCompleted || target.progress >= target.target));
    if (!target || !isTargetCompleted || target.isClaimed) {
      showToast('⚠️ Сундук за это задание уже открыт или задание ещё не выполнено!');
      return;
    }

    const rewardCrystals = Number(target.reward || 0);
    const rewardGold = Number(target.rewardGold || 0);
    const nextCrystals = Number(curHero.crystals || 0) + rewardCrystals;
    const nextGold = Number(curHero.gold || 0) + rewardGold;
    const nextTotalGold = Number(curHero.totalGoldCollected || curHero.gold || 0) + rewardGold;

    const updatedQuests = ensured.dailyQuests.map((q) =>
      q.id === target.id ? { ...q, isCompleted: true, isClaimed: true } : q
    );

    const updatedHero: HeroState = {
      ...curHero,
      gold: nextGold,
      crystals: nextCrystals,
      totalGoldCollected: nextTotalGold,
      dailyQuests: updatedQuests,
      dailyQuestsDate: ensured.dailyQuestsDate
    };

    heroRef.current = updatedHero;
    setHero(updatedHero);
    saveDailyQuestsToLocal(currentUser, {
      dailyQuests: updatedQuests,
      dailyQuestsDate: ensured.dailyQuestsDate,
      dailyCrystalChestClaimedDate: updatedHero.dailyCrystalChestClaimedDate
    });

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
      total_gold_collected: nextTotalGold
    });

    const msg = `🧰 Открыт «${target.chestName || 'Сундук с кристаллами'}»: +${rewardCrystals} 💎${rewardGold > 0 ? `, +${rewardGold} 🪙` : ''}!`;
    showToast(msg);
    playCoinSound();
    addCombatLog(msg, 'potion');
  };

  const handleClaimGrandCrystalChest = () => {
    if (!currentUser) return;
    const curHero = heroRef.current || hero;
    const summary = getDailyQuestsSummary(curHero);
    if (!summary.canClaimGrandChest) {
      showToast('⚠️ Выполните минимум 3 ежедневных задания, чтобы открыть Королевский сундук!');
      return;
    }

    const todayKey = getDailyRewardDayKey();
    const nextCrystals = Number(curHero.crystals || 0) + GRAND_DAILY_CRYSTAL_CHEST.crystals;
    const nextGold = Number(curHero.gold || 0) + GRAND_DAILY_CRYSTAL_CHEST.gold;
    const nextTotalGold = Number(curHero.totalGoldCollected || curHero.gold || 0) + GRAND_DAILY_CRYSTAL_CHEST.gold;
    const nextExpPotions = Number(curHero.expPotions || 0) + GRAND_DAILY_CRYSTAL_CHEST.expPotions;

    const updatedHero: HeroState = {
      ...curHero,
      gold: nextGold,
      crystals: nextCrystals,
      totalGoldCollected: nextTotalGold,
      expPotions: nextExpPotions,
      dailyQuests: summary.quests,
      dailyQuestsDate: todayKey,
      dailyCrystalChestClaimedDate: todayKey
    };

    heroRef.current = updatedHero;
    setHero(updatedHero);
    saveDailyQuestsToLocal(currentUser, {
      dailyQuests: summary.quests,
      dailyQuestsDate: todayKey,
      dailyCrystalChestClaimedDate: todayKey
    });

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
      exp_potions: nextExpPotions
    });

    const msg = `👑 Открыт «${GRAND_DAILY_CRYSTAL_CHEST.title}»: +${GRAND_DAILY_CRYSTAL_CHEST.crystals} 💎, +${GRAND_DAILY_CRYSTAL_CHEST.gold} 🪙 и +${GRAND_DAILY_CRYSTAL_CHEST.expPotions} ✨ Эликсир Опыта!`;
    showToast(msg);
    playLevelUpSound();
    addCombatLog(msg, 'potion');
  };

  // ================= ACHIEVEMENT SYSTEM =================
  const achievementsSummary = React.useMemo(
    () => evaluatePlayerAchievements(hero),
    [
      hero.totalGoldCollected,
      hero.gold,
      hero.mobsKilled,
      hero.bossesKilled,
      hero.level,
      hero.maxUnlockedTier,
      hero.playerKills,
      hero.itemsSold,
      hero.gamblingGamesPlayed,
      hero.claimedAchievementIds
    ]
  );

  const handleClaimAchievement = (ach: EvaluatedAchievement) => {
    const curHero = heroRef.current || hero;
    const claimedSet = new Set(
      Array.isArray(curHero.claimedAchievementIds) ? curHero.claimedAchievementIds : []
    );
    if (claimedSet.has(ach.id)) {
      showToast('⚠️ Награда за это достижение уже получена!');
      return;
    }
    if (!ach.isCompleted) {
      showToast('⚠️ Условия достижения еще не выполнены!');
      return;
    }

    claimedSet.add(ach.id);
    const nextClaimedIds = Array.from(claimedSet);
    const nextCrystals = Number(curHero.crystals || 0) + ach.rewardCrystals;

    const updatedHero: HeroState = {
      ...curHero,
      crystals: nextCrystals,
      claimedAchievementIds: nextClaimedIds
    };

    const nextTradeProtocol = [
      {
        id: Date.now() + Math.floor(Math.random() * 1000),
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        type: 'Достижение',
        details: `🏅 Достижение «${ach.title}»: получена награда +${ach.rewardCrystals} 💎`
      },
      ...tradeProtocolRef.current
    ].slice(0, 150);

    tradeProtocolRef.current = nextTradeProtocol;
    setTradeProtocol(nextTradeProtocol);
    heroRef.current = updatedHero;
    setHero(updatedHero);
    saveGameToStorage({ hero: updatedHero, tradeProtocol: nextTradeProtocol });

    lastSyncedFinancialsRef.current = {
      ...lastSyncedFinancialsRef.current,
      crystals: nextCrystals,
      updatedAt: Date.now()
    };

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        crystals: nextCrystals,
        claimed_achievement_ids: nextClaimedIds,
        claimedAchievementIds: nextClaimedIds,
        trade_protocol: nextTradeProtocol
      });
    }

    playLevelUpSound();
    const msg = `🏅 Достижение «${ach.title}» выполнено! Награда: +${ach.rewardCrystals} 💎`;
    showToast(msg);
    addCombatLog(msg, 'potion');
  };

  const handleClaimAllAchievements = (claimableList: EvaluatedAchievement[]) => {
    if (!claimableList || claimableList.length === 0) return;
    const curHero = heroRef.current || hero;
    const claimedSet = new Set(
      Array.isArray(curHero.claimedAchievementIds) ? curHero.claimedAchievementIds : []
    );

    const validToClaim = claimableList.filter(
      (a) => a.isCompleted && !claimedSet.has(a.id)
    );
    if (validToClaim.length === 0) {
      showToast('⚠️ Нет доступных для получения наград!');
      return;
    }

    let totalRewardCrystals = 0;
    for (const ach of validToClaim) {
      claimedSet.add(ach.id);
      totalRewardCrystals += ach.rewardCrystals;
    }

    const nextClaimedIds = Array.from(claimedSet);
    const nextCrystals = Number(curHero.crystals || 0) + totalRewardCrystals;

    const updatedHero: HeroState = {
      ...curHero,
      crystals: nextCrystals,
      claimedAchievementIds: nextClaimedIds
    };

    const nextTradeProtocol = [
      {
        id: Date.now() + Math.floor(Math.random() * 1000),
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        type: 'Достижение',
        details: `🏅 Забраны награды за ${validToClaim.length} достижений: +${totalRewardCrystals} 💎`
      },
      ...tradeProtocolRef.current
    ].slice(0, 150);

    tradeProtocolRef.current = nextTradeProtocol;
    setTradeProtocol(nextTradeProtocol);
    heroRef.current = updatedHero;
    setHero(updatedHero);
    saveGameToStorage({ hero: updatedHero, tradeProtocol: nextTradeProtocol });

    lastSyncedFinancialsRef.current = {
      ...lastSyncedFinancialsRef.current,
      crystals: nextCrystals,
      updatedAt: Date.now()
    };

    if (currentUser) {
      flushPlayerUpdates(currentUser, {
        crystals: nextCrystals,
        claimed_achievement_ids: nextClaimedIds,
        claimedAchievementIds: nextClaimedIds,
        trade_protocol: nextTradeProtocol
      });
    }

    playLevelUpSound();
    const msg = `🎁 Забраны награды за ${validToClaim.length} достижений: +${totalRewardCrystals} 💎!`;
    showToast(msg);
    addCombatLog(msg, 'potion');
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

  // Roulette reward callback — immediately saves prize to Supabase (skins and NPCs won in roulette are ALWAYS permanent!)
  const handleRouletteReward = (reward: {
    text: string;
    item?: GameItem;
    gold?: number;
    crystals?: number;
    skinId?: string;
    skinDurationDays?: number;
    skinTemplate?: CharacterSkinTemplate;
    npcTemplate?: NpcTemplate;
    winnerEntry?: WheelWinnerEntry;
  }) => {
    showToast(reward.text);
    const curHero = heroRef.current || hero;
    const nextGold = curHero.gold + (reward.gold || 0);
    const nextCrystals = curHero.crystals + (reward.crystals || 0);
    let nextInventory = inventory;

    if (reward.item) {
      const isVip = Boolean(curHero.isPremium && curHero.premiumUntil && curHero.premiumUntil > Date.now());
      const effectiveBagCap = curHero.bagCapacity + (isVip ? 50 : 0);
      if (inventory.length < effectiveBagCap) {
        nextInventory = [reward.item, ...inventory];
        setInventory(nextInventory);
      } else {
        showToast('🎒 Сумка полна! Выигрышный предмет утерян.');
      }
    }

    let nextOwnedSkins = Array.isArray(curHero.ownedSkinIds) ? [...curHero.ownedSkinIds] : [];
    let nextSkinExpirations = { ...(curHero.ownedSkinExpirations || {}) };
    let nextOwnedSkinTemplates = Array.isArray(curHero.ownedSkins) ? [...curHero.ownedSkins] : [];

    if (reward.skinId) {
      if (!nextOwnedSkins.includes(reward.skinId)) {
        nextOwnedSkins.push(reward.skinId);
      }
      // Skins won in roulette stay in the character's collection FOREVER
      delete nextSkinExpirations[reward.skinId];

      const baseTpl = shopSkins.find((s) => s.id === reward.skinId) || reward.skinTemplate;
      if (baseTpl) {
        const permanentTpl: CharacterSkinTemplate = {
          ...baseTpl,
          isTemporary: false,
          durationDays: 0
        };
        nextOwnedSkinTemplates = [
          permanentTpl,
          ...nextOwnedSkinTemplates.filter((s) => s && s.id !== permanentTpl.id)
        ];
        if (!shopSkins.some((s) => s.id === permanentTpl.id)) {
          setShopSkins((prev) => [permanentTpl, ...prev]);
        }
      }
    }

    let nextNpcCompanion = curHero.npcCompanion;
    if (reward.npcTemplate) {
      const prevLootGold = curHero.npcCompanion?.bagGold || 0;
      const prevLootExp = curHero.npcCompanion?.bagExp || 0;
      const prevMobsInBag = curHero.npcCompanion?.mobsInBag || 0;
      const prevMobsKilled = curHero.npcCompanion?.mobsKilled || 0;
      const freshNpc = createDefaultNpcCompanion(curHero, reward.npcTemplate);
      if (prevLootGold > 0) freshNpc.bagGold = prevLootGold;
      if (prevLootExp > 0) freshNpc.bagExp = prevLootExp;
      if (prevMobsInBag > 0) freshNpc.mobsInBag = prevMobsInBag;
      if (prevMobsKilled > 0) freshNpc.mobsKilled = prevMobsKilled;
      nextNpcCompanion = freshNpc;
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
        ownedSkins: nextOwnedSkinTemplates,
        npcCompanion: reward.npcTemplate ? nextNpcCompanion : prev.npcCompanion
      };
      heroRef.current = updatedHero;
      saveGameToStorage({ hero: updatedHero });
      return updatedHero;
    });

    if (currentUser) {
      const supaPayload: Record<string, any> = {
        gold: nextGold,
        crystals: nextCrystals,
        inventory: nextInventory,
        owned_skin_ids: nextOwnedSkins,
        owned_skin_expirations: nextSkinExpirations,
        owned_skins: nextOwnedSkinTemplates
      };
      if (reward.npcTemplate && nextNpcCompanion) {
        supaPayload.npc_companion = nextNpcCompanion;
        supaPayload.npcCompanion = nextNpcCompanion;
      }
      flushPlayerUpdates(currentUser, supaPayload);
    }
  };

  // Roulette winner log callback
  const handleWheelWinnerLogged = async (entry: WheelWinnerEntry) => {
    const cleanPrizeName = String(entry.prizeName || 'Ценный приз')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/data:image\/\S+/gi, '')
      .replace(/\/assets\/\S+/gi, '')
      .replace(/Скин\s+«\s*Скин:\s*/gi, 'Скин «')
      .trim();
    const normalizedEntry: WheelWinnerEntry = {
      ...entry,
      prizeName: cleanPrizeName || entry.prizeName
    };

    setWheelWinners((prev) => [normalizedEntry, ...prev.filter((w) => w.id !== normalizedEntry.id)].slice(0, 40));
    const updated = await recordWheelWinnerInSupabase(normalizedEntry);
    setWheelWinners(updated);

    const prizeQual = normalizedEntry.quality || normalizedEntry.prizeQuality;
    const safeChatIcon = formatItemIconForText(
      normalizedEntry.prizeIcon,
      cleanPrizeName.includes('Скин') ? '🎭' : '🎁'
    );
    const chatPrizeLabel = cleanPrizeName.startsWith(safeChatIcon)
      ? cleanPrizeName
      : `${safeChatIcon} ${cleanPrizeName}`;

    // Announce valuable roulette prizes (including Skins) in World Chat for all players
    if (
      prizeQual === 'legendary' ||
      prizeQual === 'epic' ||
      prizeQual === 'rare' ||
      cleanPrizeName.includes('Скин') ||
      cleanPrizeName.includes('Страж NPC') ||
      cleanPrizeName.includes('Кристалл') ||
      cleanPrizeName.includes('ДЖЕКПОТ')
    ) {
      const winMsg: ChatMessage = {
        id: `wheel_win_${normalizedEntry.id}`,
        time: normalizedEntry.timeStr,
        author: 'Рулетка',
        text: `🎰 Игрок ${normalizedEntry.nick} выбил в Рулетке приз: ${chatPrizeLabel}!`,
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
    const nowTs = Date.now();
    const time = new Date(nowTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const targetChannel: 'world' | 'general' =
      activeChatChannel === 'combatLog' || activeChatChannel === 'private'
        ? 'world'
        : activeChatChannel;
    const myAuthorRole: 'admin' | 'mod' | 'regular' =
      hero.role === 'admin' ||
      Number((hero as any).is_admin) === 1 ||
      ['redblack', 'redbyl', 'admin'].includes((currentUser || hero.nick || '').trim().toLowerCase())
        ? 'admin'
        : hero.role === 'mod' || Number((hero as any).is_admin) === 2
        ? 'mod'
        : 'regular';
    const newMsg: ChatMessage = {
      id: `chat_${nowTs}_${Math.random().toString(36).slice(2, 6)}`,
      time,
      timestamp: nowTs,
      author: currentUser || 'Игрок',
      authorRole: myAuthorRole,
      text,
      channel: targetChannel
    };
    setChatMessages((prev) => [...prev, newMsg]);
    broadcastWorldChatMessageInSupabase(newMsg);
  };

  // Delete single chat message (Admin or Moderator or message author)
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

  // Clear recent World Chat messages written in the last 2–3 minutes (Moderator & Admin)
  const handleClearRecentWorldChat = async (minutes: number = 3) => {
    const safeMin = Math.max(1, Math.min(10, Number(minutes) || 3));
    const cutoffMs = Date.now() - safeMin * 60 * 1000;
    setChatMessages((prev) =>
      prev.filter((m) => {
        if (m.channel !== 'world') return true;
        if (m.isSystem && String(m.id || '').startsWith('init_chat_')) return true;
        const idMatch = String(m.id || '').match(/(\d{13})/);
        const msgTs =
          typeof m.timestamp === 'number' && m.timestamp > 0
            ? m.timestamp
            : idMatch
            ? Number(idMatch[1])
            : 0;
        if (msgTs > 0 && msgTs >= cutoffMs) {
          return false;
        }
        return true;
      })
    );
    const res = await clearRecentWorldChatMessagesInSupabase(safeMin);
    showToast(
      `🧹 Чат очищен за последние ${safeMin} мин. (удалено сообщений: ${(res as any).removedCount ?? (res as any).deletedCount ?? 0})!`
    );
  };

  // Temporarily ban (mute) a player in chat (Moderator & Admin)
  const handleMutePlayerInChat = async (
    targetNick: string,
    durationMinutes: number,
    reason?: string
  ) => {
    const cleanTarget = targetNick.trim();
    if (!cleanTarget) return;
    if (['redblack', 'redbyl', 'admin'].includes(cleanTarget.toLowerCase())) {
      showToast('🚫 Нельзя заблокировать чат главному администратору!');
      return;
    }
    const safeMins = Math.max(1, Number(durationMinutes) || 15);
    const untilTs = Date.now() + safeMins * 60 * 1000;
    const existingRecord = await findPlayerInSupabase(cleanTarget);
    const prevBan =
      existingRecord?.ban_info && typeof existingRecord.ban_info === 'object'
        ? existingRecord.ban_info
        : {};
    const muteBanInfo: PlayerBanInfo = {
      isBanned: true,
      isPermanent: false,
      until: untilTs,
      reason: (reason || 'Нарушение правил общения в чате').trim(),
      bannedAt: Date.now(),
      bannedBy: currentUser || hero.nick || 'Модератор',
      blockPyramid: Boolean(prevBan.blockPyramid),
      blockClanPyramid: Boolean(prevBan.blockClanPyramid),
      blockChat: true,
      blockTradeAndAuction: Boolean(prevBan.blockTradeAndAuction),
      blockClans: Boolean(prevBan.blockClans),
      blockRoulette: Boolean(prevBan.blockRoulette)
    };
    const res = await updatePlayerInDatabase(cleanTarget, {
      ban_info: muteBanInfo,
      external_sync_ts: Date.now()
    });
    if (!res) {
      showToast(`❌ Ошибка выдачи мута: Игрок не найден или ошибка сети`);
      return;
    }
    if (cleanTarget.toLowerCase() === (currentUser || '').toLowerCase()) {
      setHero((prev) => ({ ...prev, banInfo: muteBanInfo }));
    }
    const durationLabel =
      safeMins >= 60 ? `${Math.round((safeMins / 60) * 10) / 10} ч.` : `${safeMins} мин.`;
    const sysMsg: ChatMessage = {
      id: `sys_mute_${Date.now()}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      author: '🛡️ МОДЕРАЦИЯ',
      text: `🔇 Игроку ${cleanTarget} временно ограничен чат на ${durationLabel} (${muteBanInfo.reason}).`,
      channel: 'world',
      isSystem: true
    };
    setChatMessages((prev) => [...prev, sysMsg]);
    broadcastWorldChatMessageInSupabase(sysMsg);
    showToast(`🔇 Игрок ${cleanTarget} забанен в чате на ${durationLabel}!`);
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
    const isAdmin = Number(supaPlayer?.is_admin) === 1 || supaPlayer?.role === 'admin';
    const isMod = !isAdmin && (Number(supaPlayer?.is_admin) === 2 || supaPlayer?.role === 'mod');
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
      role: isAdmin ? 'admin' : isMod ? 'mod' : 'regular',
      statusTitle: isAdmin ? 'Главный Администратор' : isMod ? 'Модератор Чата' : 'Новичок',
      avatar: supaPlayer?.avatar || (isAdmin ? '👑' : '🧙‍♂️'),
      str: normLoadedStats.str,
      agi: normLoadedStats.agi,
      vit: normLoadedStats.vit,
      statPoints: normLoadedStats.statPoints,
      pvpWins: supaPlayer?.pvp_wins !== undefined ? Number(supaPlayer.pvp_wins) : 0,
      pvpLosses: supaPlayer?.pvp_losses !== undefined ? Number(supaPlayer.pvp_losses) : 0,
      pvpKills: supaPlayer?.pvp_kills !== undefined ? Number(supaPlayer.pvp_kills) : 0,
      killerLicenseUntil:
        Number(supaPlayer?.killer_license_until ?? supaPlayer?.killerLicenseUntil ?? 0) > Date.now()
          ? Number(supaPlayer?.killer_license_until ?? supaPlayer?.killerLicenseUntil ?? 0)
          : undefined,
      killerLicenses: Math.max(0, Number(supaPlayer?.killer_licenses ?? supaPlayer?.killerLicenses ?? 0)),
      pyramidCard1: Math.max(0, Number(supaPlayer?.pyramid_card_1 ?? supaPlayer?.pyramidCard1 ?? 0)),
      pyramidCard2: Math.max(0, Number(supaPlayer?.pyramid_card_2 ?? supaPlayer?.pyramidCard2 ?? 0)),
      pyramidCard3: Math.max(0, Number(supaPlayer?.pyramid_card_3 ?? supaPlayer?.pyramidCard3 ?? 0)),
      mobsKilled: Math.max(0, Number(supaPlayer?.mobs_killed ?? supaPlayer?.mobsKilled ?? supaPlayer?.mob_kills ?? 0)),
      bossesKilled: Math.max(0, Number(supaPlayer?.bosses_killed ?? supaPlayer?.bossesKilled ?? 0)),
      itemsSold: Math.max(0, Number(supaPlayer?.items_sold ?? supaPlayer?.itemsSold ?? defaultData.hero.itemsSold ?? 0)),
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
      claimedAchievementIds: Array.isArray(supaPlayer?.claimed_achievement_ids)
        ? supaPlayer.claimed_achievement_ids
        : Array.isArray(supaPlayer?.claimedAchievementIds)
          ? supaPlayer.claimedAchievementIds
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
      npcCompanion:
        (supaPlayer?.npc_companion && typeof supaPlayer.npc_companion === 'object'
          ? supaPlayer.npc_companion
          : supaPlayer?.npcCompanion && typeof supaPlayer.npcCompanion === 'object'
          ? supaPlayer.npcCompanion
          : undefined),
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
    let loadedLoc: 'city' | 'pyramid' = wasKilledOffline
      ? 'city'
      : supaPlayer?.location === 'pyramid'
      ? 'pyramid'
      : 'city';
    const rawSavedRow = supaPlayer?.row !== undefined ? Number(supaPlayer.row) : exitSpawnPos.row;
    const rawSavedCol = supaPlayer?.col !== undefined ? Number(supaPlayer.col) : exitSpawnPos.col;
    // If player was previously saved at [9,0] (the exit button cell), place them on [9,1] next to exit
    let loadedPos =
      wasKilledOffline || loadedLoc === 'city'
        ? exitSpawnPos
        : rawSavedRow === PYRAMID_EXIT_POS.row && rawSavedCol === PYRAMID_EXIT_POS.col
        ? exitSpawnPos
        : { row: rawSavedRow, col: rawSavedCol };
    const savedHomeTier = Math.max(
      1,
      Math.min(
        3,
        Number(
          supaPlayer?.home_pyramid_tier ??
            supaPlayer?.homePyramidTier ??
            supaPlayer?.pyramid_tier ??
            supaPlayer?.пирамидальный_уровень ??
            1
        )
      )
    );
    const savedActiveTier = Math.max(
      1,
      Math.min(
        3,
        Number(
          supaPlayer?.pyramid_tier ??
            supaPlayer?.пирамидальный_уровень ??
            savedHomeTier
        )
      )
    );
    let loadedTier = loadedLoc === 'city' ? savedHomeTier : savedActiveTier;
    loadedHero.homePyramidTier = savedHomeTier;
    loadedHero.pyramidTier = loadedTier;

    const activeNick = String(supaPlayer?.name || cleanNick).trim();

    const recalcedHero = recalcGear(loadedEquipped, loadedHero);
    if (!wasKilledOffline) {
      const rawSavedHp = Number(
        (supaPlayer as any)?._rawSavedHp ?? supaPlayer?.hp ?? recalcedHero.maxHp
      );
      const rawSavedMaxHp = Number(
        (supaPlayer as any)?._rawSavedMaxHp ?? supaPlayer?.max_hp ?? 0
      );
      const rawSavedEnergy = Number(
        (supaPlayer as any)?._rawSavedEnergy ?? supaPlayer?.energy ?? recalcedHero.maxEnergy
      );
      const rawSavedMaxEnergy = Number(
        (supaPlayer as any)?._rawSavedMaxEnergy ?? supaPlayer?.max_energy ?? 0
      );
      const lastSeenTs = Number(supaPlayer?.last_seen || 0);
      const elapsedSec =
        lastSeenTs > 0 ? Math.max(0, Math.floor((Date.now() - lastSeenTs) / 1000)) : 0;
      const regenRateSec =
        loadedLoc === 'pyramid' ? (loadedIsPremium ? 4 : 8) : (loadedIsPremium ? 1 : 3);
      const regenPerTick = loadedIsPremium ? 2 : 1;
      const offlineGain = Math.max(
        Number((supaPlayer as any)?._offlineRegenTotalPoolGain || 0),
        Math.floor(elapsedSec / regenRateSec) * regenPerTick
      );

      const wasAtFullHp = rawSavedMaxHp > 0 && rawSavedHp >= rawSavedMaxHp;
      const wasAtFullEnergy = rawSavedMaxEnergy > 0 && rawSavedEnergy >= rawSavedMaxEnergy;

      recalcedHero.hp = wasAtFullHp
        ? recalcedHero.maxHp
        : Math.min(
            recalcedHero.maxHp,
            Math.max(recalcedHero.hp, Math.max(0, rawSavedHp) + offlineGain)
          );
      recalcedHero.energy = wasAtFullEnergy
        ? recalcedHero.maxEnergy
        : Math.min(
            recalcedHero.maxEnergy,
            Math.max(recalcedHero.energy, Math.max(0, rawSavedEnergy) + offlineGain)
          );
    }
    let offlineNpcSummary: string | null = null;
    if (recalcedHero.npcCompanion?.unlocked) {
      const simRes = simulateNpcProgress(recalcedHero.npcCompanion, recalcedHero, Date.now());
      recalcedHero.npcCompanion = simRes.updatedNpc;
      offlineNpcSummary = simRes.summaryText || null;
      if (recalcedHero.npcCompanion.isActive && loadedLoc === 'pyramid') {
        loadedLoc = 'city';
        loadedPos = exitSpawnPos;
        loadedTier = savedHomeTier;
        recalcedHero.pyramidTier = savedHomeTier;
      }
    }

    livePosRef.current = {
      screen: loadedLoc,
      tier: loadedTier,
      row: loadedPos.row,
      col: loadedPos.col
    };
    lastAppliedExternalSyncTsRef.current = Number(supaPlayer?.external_sync_ts || 0);

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
        npc_companion: recalcedHero.npcCompanion ?? null,
        npcCompanion: recalcedHero.npcCompanion ?? null,
        is_online: true,
        last_seen: Date.now()
      });
    } else {
      updatePlayerInDatabase(activeNick, {
        location: loadedLoc,
        hp: recalcedHero.hp,
        max_hp: recalcedHero.maxHp,
        energy: recalcedHero.energy,
        max_energy: recalcedHero.maxEnergy,
        ...(recalcedHero.npcCompanion?.unlocked
          ? {
              npc_companion: recalcedHero.npcCompanion,
              npcCompanion: recalcedHero.npcCompanion
            }
          : {}),
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
      npcCompanion: recalcedHero.npcCompanion,
      isOnline: true
    });

    if (offlineNpcSummary) {
      setTimeout(() => showToast(offlineNpcSummary!), 600);
    }

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
    const isSavedMod =
      savedRecord?.role === 'mod' ||
      savedRecord?.role === 'moderator' ||
      Number(savedRecord?.is_admin) === 2 ||
      Number((savedRecord as any)?.admin_level) === 2;
    const isAdmin = !isSavedMod && (Number(savedRecord?.is_admin) === 1 || savedRecord?.role === 'admin');

    const defaultData = resetGameStorage();
    defaultData.hero = {
      ...defaultData.hero,
      level: savedRecord?.lvl !== undefined ? Number(savedRecord.lvl) : 1,
      exp: savedRecord?.exp !== undefined ? Number(savedRecord.exp) : 0,
      gold: savedRecord?.gold !== undefined ? Number(savedRecord.gold) : 0,
      crystals: savedRecord?.crystals !== undefined ? Number(savedRecord.crystals) : 0,
      role: isAdmin ? 'admin' : isSavedMod ? 'mod' : 'regular',
      statusTitle: isAdmin ? 'Главный Администратор' : isSavedMod ? 'Модератор Чата' : 'Новичок',
      avatar: savedRecord?.avatar || (isAdmin ? '👑' : isSavedMod ? '🛡️' : '🧙‍♂️'),
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
    if ((defaultData.hero.level || 1) < 5) {
      setTimeout(() => setActiveModal('tutorial'), 350);
    }
    return { success: true };
  };

  const handleSocialAuth = async (
    payload: SocialAuthPayload
  ): Promise<{ success: boolean; needsNickname?: boolean; error?: string }> => {
    const socialRes = await authenticateOrRegisterSocialPlayerInSupabase(payload);
    if (!socialRes.success) {
      return {
        success: false,
        needsNickname: socialRes.needsNickname,
        error: socialRes.error || 'Ошибка авторизации через соцсеть'
      };
    }

    const supaPlayer = socialRes.player;
    const resolvedNick = String(supaPlayer?.name || supaPlayer?.nick || payload.nick || '').trim();
    const resolvedPass = String(supaPlayer?.password || payload.password || `${payload.provider}_${payload.providerId}`).trim();

    if (!socialRes.isNewRegistration && resolvedNick) {
      const loginRes = await handleLogin(resolvedNick, resolvedPass);
      if (loginRes.success) {
        return { success: true };
      }
    }

    // New character or direct load from social registration
    const isSupaMod =
      supaPlayer?.role === 'mod' ||
      supaPlayer?.role === 'moderator' ||
      Number(supaPlayer?.is_admin) === 2 ||
      Number((supaPlayer as any)?.admin_level) === 2;
    const isAdmin = !isSupaMod && (Number(supaPlayer?.is_admin) === 1 || supaPlayer?.role === 'admin');
    const defaultData = resetGameStorage();
    const loadedLvl = supaPlayer?.lvl !== undefined ? Math.max(1, Number(supaPlayer.lvl)) : 1;
    defaultData.hero = {
      ...defaultData.hero,
      nick: resolvedNick,
      level: loadedLvl,
      lvl: loadedLvl,
      exp: supaPlayer?.exp !== undefined ? Number(supaPlayer.exp) : 0,
      gold: supaPlayer?.gold !== undefined ? Number(supaPlayer.gold) : 0,
      crystals: supaPlayer?.crystals !== undefined ? Number(supaPlayer.crystals) : 0,
      hp: supaPlayer?.hp !== undefined ? Number(supaPlayer.hp) : defaultData.hero.hp,
      maxHp: supaPlayer?.max_hp !== undefined ? Number(supaPlayer.max_hp) : defaultData.hero.maxHp,
      energy: supaPlayer?.energy !== undefined ? Number(supaPlayer.energy) : defaultData.hero.energy,
      maxEnergy: supaPlayer?.max_energy !== undefined ? Number(supaPlayer.max_energy) : defaultData.hero.maxEnergy,
      role: isAdmin ? 'admin' : isSupaMod ? 'mod' : 'regular',
      statusTitle: isAdmin ? 'Главный Администратор' : isSupaMod ? 'Модератор Чата' : 'Новичок',
      avatar: supaPlayer?.avatar || (isAdmin ? '👑' : isSupaMod ? '🛡️' : '🧙‍♂️'),
      referralCode: `ref_${resolvedNick.substr(0, 3)}_${Math.random().toString(36).substr(2, 6)}`
    };

    livePosRef.current = {
      screen: 'city',
      tier: 1,
      row: defaultData.playerPos.row,
      col: defaultData.playerPos.col
    };
    isProfileLoadedRef.current = true;

    setCurrentUser(resolvedNick);
    setCurrentUserNick(resolvedNick);
    setHero(defaultData.hero);
    setEquipped(supaPlayer?.equipped && typeof supaPlayer.equipped === 'object' ? supaPlayer.equipped : defaultData.equipped);
    setInventory(Array.isArray(supaPlayer?.inventory) ? supaPlayer.inventory : defaultData.inventory);
    setMarket(defaultData.market);
    setTradeProtocol(defaultData.tradeProtocol);
    setFriends(defaultData.friends);
    setPyramidMap(defaultData.pyramidMap);
    setPlayerPos(defaultData.playerPos);
    setPyramidTier(1);

    syncPlayerToSupabase({
      nick: resolvedNick,
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

    const providerLabel =
      payload.provider === 'google'
        ? 'Google'
        : payload.provider === 'facebook'
        ? 'Facebook'
        : 'Telegram';
    showToast(`🛡️ Персонаж ${resolvedNick} (${providerLabel}) сохранен в базе Supabase!`);
    if (socialRes.isNewRegistration && loadedLvl < 5) {
      setTimeout(() => setActiveModal('tutorial'), 350);
    }
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
        pvp_kills: curHero.pvpKills || 0,
        killer_license_until: curHero.killerLicenseUntil || 0,
        killer_licenses: curHero.killerLicenses || 0,
        home_pyramid_tier: curHero.homePyramidTier || livePosRef.current.tier || 1,
        pyramid_card_1: curHero.pyramidCard1 || 0,
        pyramid_card_2: curHero.pyramidCard2 || 0,
        pyramid_card_3: curHero.pyramidCard3 || 0,
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
        npc_companion: curHero.npcCompanion ?? null,
        npcCompanion: curHero.npcCompanion ?? null,
        is_admin:
          curHero.role === 'admin' || Number((curHero as any).is_admin) === 1
            ? 1
            : curHero.role === 'mod' || Number((curHero as any).is_admin) === 2
            ? 2
            : 0,
        role:
          curHero.role === 'admin'
            ? 'admin'
            : curHero.role === 'mod'
            ? 'mod'
            : 'regular',
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
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const loadProfileFromSupabase = () => {
      if (cancelled || isProfileLoadedRef.current) return;
      findPlayerInSupabase(currentUser)
        .then((supaPlayer) => {
          if (cancelled || isProfileLoadedRef.current) return;
          if (supaPlayer) {
            const isAdmin = Number(supaPlayer.is_admin) === 1 || supaPlayer.role === 'admin';
            const isMod = !isAdmin && (Number(supaPlayer.is_admin) === 2 || supaPlayer.role === 'mod');
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
              role: isAdmin ? 'admin' : isMod ? 'mod' : 'regular',
              statusTitle: isAdmin ? 'Главный Администратор' : isMod ? 'Модератор Чата' : 'Новичок',
              avatar: supaPlayer.avatar || (isAdmin ? '👑' : '🧙‍♂️'),
              str: normLoadedStats.str,
              agi: normLoadedStats.agi,
              vit: normLoadedStats.vit,
              statPoints: normLoadedStats.statPoints,
              pvpWins: supaPlayer.pvp_wins !== undefined ? Number(supaPlayer.pvp_wins) : 0,
              pvpLosses: supaPlayer.pvp_losses !== undefined ? Number(supaPlayer.pvp_losses) : 0,
              pvpKills: supaPlayer.pvp_kills !== undefined ? Number(supaPlayer.pvp_kills) : 0,
              killerLicenseUntil:
                Number(supaPlayer.killer_license_until ?? supaPlayer.killerLicenseUntil ?? 0) > Date.now()
                  ? Number(supaPlayer.killer_license_until ?? supaPlayer.killerLicenseUntil ?? 0)
                  : undefined,
              killerLicenses: Math.max(0, Number(supaPlayer.killer_licenses ?? supaPlayer.killerLicenses ?? 0)),
              pyramidCard1: Math.max(0, Number(supaPlayer.pyramid_card_1 ?? supaPlayer.pyramidCard1 ?? 0)),
              pyramidCard2: Math.max(0, Number(supaPlayer.pyramid_card_2 ?? supaPlayer.pyramidCard2 ?? 0)),
              pyramidCard3: Math.max(0, Number(supaPlayer.pyramid_card_3 ?? supaPlayer.pyramidCard3 ?? 0)),
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
              npcCompanion:
                (supaPlayer.npc_companion && typeof supaPlayer.npc_companion === 'object'
                  ? supaPlayer.npc_companion
                  : supaPlayer.npcCompanion && typeof supaPlayer.npcCompanion === 'object'
                  ? supaPlayer.npcCompanion
                  : undefined),
              gamblingSpentGold: Math.max(0, Number(supaPlayer.gambling_spent_gold ?? supaPlayer.gamblingSpentGold ?? 0)),
              gamblingWonGold: Math.max(0, Number(supaPlayer.gambling_won_gold ?? supaPlayer.gamblingWonGold ?? 0)),
              gamblingSpentCrystals: Math.max(0, Number(supaPlayer.gambling_spent_crystals ?? supaPlayer.gamblingSpentCrystals ?? 0)),
              gamblingWonCrystals: Math.max(0, Number(supaPlayer.gambling_won_crystals ?? supaPlayer.gamblingWonCrystals ?? 0)),
              gamblingGamesPlayed: Math.max(0, Number(supaPlayer.gambling_games_played ?? supaPlayer.gamblingGamesPlayed ?? 0)),
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
            let loadedLoc: 'city' | 'pyramid' = wasKilledOffline
              ? 'city'
              : supaPlayer.location === 'pyramid'
              ? 'pyramid'
              : 'city';
            const rawSavedRow = supaPlayer.row !== undefined ? Number(supaPlayer.row) : exitSpawnPos.row;
            const rawSavedCol = supaPlayer.col !== undefined ? Number(supaPlayer.col) : exitSpawnPos.col;
            let loadedPos =
              wasKilledOffline || loadedLoc === 'city'
                ? exitSpawnPos
                : rawSavedRow === PYRAMID_EXIT_POS.row && rawSavedCol === PYRAMID_EXIT_POS.col
                ? exitSpawnPos
                : { row: rawSavedRow, col: rawSavedCol };
            const savedHomeTier = Math.max(
              1,
              Math.min(
                3,
                Number(
                  supaPlayer.home_pyramid_tier ??
                    supaPlayer.homePyramidTier ??
                    supaPlayer.pyramid_tier ??
                    supaPlayer.пирамидальный_уровень ??
                    1
                )
              )
            );
            const savedActiveTier = Math.max(
              1,
              Math.min(
                3,
                Number(
                  supaPlayer.pyramid_tier ??
                    supaPlayer.пирамидальный_уровень ??
                    savedHomeTier
                )
              )
            );
            let loadedTier = loadedLoc === 'city' ? savedHomeTier : savedActiveTier;
            loadedHero.homePyramidTier = savedHomeTier;
            loadedHero.pyramidTier = loadedTier;

            const recalcedHero = recalcGear(loadedEquipped, loadedHero);
            if (!wasKilledOffline) {
              const rawSavedHp = Number(
                (supaPlayer as any)._rawSavedHp ?? supaPlayer.hp ?? recalcedHero.maxHp
              );
              const rawSavedMaxHp = Number(
                (supaPlayer as any)._rawSavedMaxHp ?? supaPlayer.max_hp ?? 0
              );
              const rawSavedEnergy = Number(
                (supaPlayer as any)._rawSavedEnergy ?? supaPlayer.energy ?? recalcedHero.maxEnergy
              );
              const rawSavedMaxEnergy = Number(
                (supaPlayer as any)._rawSavedMaxEnergy ?? supaPlayer.max_energy ?? 0
              );
              const lastSeenTs = Number(supaPlayer.last_seen || 0);
              const elapsedSec =
                lastSeenTs > 0 ? Math.max(0, Math.floor((Date.now() - lastSeenTs) / 1000)) : 0;
              const regenRateSec =
                loadedLoc === 'pyramid' ? (loadedIsPremium ? 4 : 8) : (loadedIsPremium ? 1 : 3);
              const regenPerTick = loadedIsPremium ? 2 : 1;
              const offlineGain = Math.max(
                Number((supaPlayer as any)._offlineRegenTotalPoolGain || 0),
                Math.floor(elapsedSec / regenRateSec) * regenPerTick
              );

              const wasAtFullHp = rawSavedMaxHp > 0 && rawSavedHp >= rawSavedMaxHp;
              const wasAtFullEnergy = rawSavedMaxEnergy > 0 && rawSavedEnergy >= rawSavedMaxEnergy;

              recalcedHero.hp = wasAtFullHp
                ? recalcedHero.maxHp
                : Math.min(
                    recalcedHero.maxHp,
                    Math.max(recalcedHero.hp, Math.max(0, rawSavedHp) + offlineGain)
                  );
              recalcedHero.energy = wasAtFullEnergy
                ? recalcedHero.maxEnergy
                : Math.min(
                    recalcedHero.maxEnergy,
                    Math.max(recalcedHero.energy, Math.max(0, rawSavedEnergy) + offlineGain)
                  );
            }
            let offlineNpcSummary: string | null = null;
            if (recalcedHero.npcCompanion?.unlocked) {
              const simRes = simulateNpcProgress(recalcedHero.npcCompanion, recalcedHero, Date.now());
              recalcedHero.npcCompanion = simRes.updatedNpc;
              offlineNpcSummary = simRes.summaryText || null;
              if (recalcedHero.npcCompanion.isActive && loadedLoc === 'pyramid') {
                loadedLoc = 'city';
                loadedPos = exitSpawnPos;
                loadedTier = savedHomeTier;
                recalcedHero.pyramidTier = savedHomeTier;
              }
            }

            livePosRef.current = {
              screen: loadedLoc,
              tier: loadedTier,
              row: loadedPos.row,
              col: loadedPos.col
            };
            lastAppliedExternalSyncTsRef.current = Number(supaPlayer.external_sync_ts || 0);

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
                npc_companion: recalcedHero.npcCompanion ?? null,
                npcCompanion: recalcedHero.npcCompanion ?? null,
                is_online: true,
                last_seen: Date.now()
              });
              showToast(
                `☠️ Пока вы были оффлайн, вас убил игрок ${killedByNick}! Вы возродились в городе (для входа в Пирамиду накопите 30⚡).`
              );
            } else {
              updatePlayerInDatabase(currentUser, {
                location: loadedLoc,
                hp: recalcedHero.hp,
                max_hp: recalcedHero.maxHp,
                energy: recalcedHero.energy,
                max_energy: recalcedHero.maxEnergy,
                ...(recalcedHero.npcCompanion?.unlocked
                  ? {
                      npc_companion: recalcedHero.npcCompanion,
                      npcCompanion: recalcedHero.npcCompanion
                    }
                  : {}),
                is_online: true,
                last_seen: Date.now()
              });
            }

            if (offlineNpcSummary) {
              setTimeout(() => showToast(offlineNpcSummary!), 600);
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
              npcCompanion: recalcedHero.npcCompanion,
              isOnline: true
            });
          } else {
            // If Supabase profile could not be loaded yet (network delay or cold start), DO NOT set isProfileLoadedRef to true!
            // Automatically retry until the database record is loaded so initial defaults can NEVER overwrite player progress!
            console.warn(`[ProfileLoader] Player ${currentUser} profile not loaded from Supabase yet. Retrying in 1.2s...`);
            retryTimer = setTimeout(loadProfileFromSupabase, 1200);
          }
        })
        .catch(() => {
          if (!cancelled && !isProfileLoadedRef.current) {
            retryTimer = setTimeout(loadProfileFromSupabase, 1200);
          }
        });
    };

    loadProfileFromSupabase();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [currentUser, generateNewPyramid, showToast]);

  // Буферизация изменений прогресса и координат персонажа:
  // Финансовые/уровневые изменения (золото, опыт, кристаллы, рулетка, уровень) сохраняются ускоренно (250мс),
  // а обычная регенерация HP/энергии и шаги сбрасываются пачкой каждые 5 секунд вместе с Heartbeat.
  useEffect(() => {
    if (!currentUser || !isProfileLoadedRef.current) return;
    const activeTier = Math.max(1, Math.min(3, Number(pyramidTier || hero.pyramidTier || hero.homePyramidTier || 1)));
    const homeTier = Math.max(1, Math.min(3, Number(hero.homePyramidTier || activeTier || 1)));
    livePosRef.current = {
      screen,
      tier: activeTier,
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
      killer_license_until: hero.killerLicenseUntil || 0,
      killer_licenses: hero.killerLicenses || 0,
      home_pyramid_tier: homeTier,
      pyramid_card_1: hero.pyramidCard1 || 0,
      pyramid_card_2: hero.pyramidCard2 || 0,
      pyramid_card_3: hero.pyramidCard3 || 0,
      mobs_killed: hero.mobsKilled || 0,
      mob_kills: hero.mobsKilled || 0,
      bosses_killed: hero.bossesKilled || 0,
      bossesKilled: hero.bossesKilled || 0,
      items_sold: hero.itemsSold || 0,
      itemsSold: hero.itemsSold || 0,
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
      claimed_achievement_ids: hero.claimedAchievementIds || [],
      claimedAchievementIds: hero.claimedAchievementIds || [],
      location: screen,
      pyramid_tier: activeTier,
      пирамидальный_уровень: activeTier,
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
      npc_companion: hero.npcCompanion ?? null,
      npcCompanion: hero.npcCompanion ?? null
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
    return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} onSocialAuth={handleSocialAuth} />;
  }

  const isRootSuperAdmin = ['redblack', 'redbyl', 'admin'].includes(
    (currentUser || hero.nick || '').trim().toLowerCase()
  );
  const isModerator =
    hero.role === 'mod' ||
    (hero.role !== 'regular' &&
      hero.role !== 'admin' &&
      (Number((hero as any).is_admin) === 2 || Number((hero as any).admin_level) === 2));
  const isAdmin =
    !isModerator &&
    (isRootSuperAdmin ||
      hero.role === 'admin' ||
      (hero.role !== 'regular' &&
        (Number((hero as any).is_admin) === 1 || Number((hero as any).admin_level) === 1)));

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#0b0d10] font-sans text-white select-none">
      {/* Mobile-oriented Game Frame container — fits 100% of mobile viewport without scrolling */}
      <div className="relative flex h-[100dvh] max-h-[820px] w-full max-w-[430px] flex-col overflow-hidden border-x border-slate-700 bg-[#151921] shadow-2xl">
        {/* Top User & System Bar — compact, responsive layout so left controls and right clock are always 100% visible */}
        <div className="z-30 flex shrink-0 flex-wrap items-center justify-between gap-1 border-b border-slate-800 bg-slate-950 px-1.5 py-1">
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            <button
              onClick={() => {
                setCharacterModalInitialTab(unreadMailCount > 0 ? 'mail' : 'profile');
                setActiveModal('character');
              }}
              className={`relative flex items-center gap-1 rounded border bg-slate-900 px-1.5 py-0.5 text-[8px] font-bold active:scale-95 shrink-0 ${
                isAdmin
                  ? 'border-red-500/70 text-red-400 hover:border-red-400 shadow-[0_0_6px_rgba(239,68,68,0.25)]'
                  : isModerator
                  ? 'border-emerald-500/70 text-emerald-400 hover:border-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.25)]'
                  : 'border-slate-700 text-amber-300 hover:border-amber-400'
              }`}
              title="Открыть Персонажа и Почту"
            >
              <span className="truncate max-w-[78px]">
                {Boolean(hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now())
                  ? '👑 '
                  : isAdmin
                  ? '🛡️ '
                  : isModerator
                  ? '👮 '
                  : '👤 '}
                {currentUser || 'Игрок'}
              </span>
              {(unreadMailCount > 0 || Number(hero.statPoints || 0) > 0) && (
                <span className="ml-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-600 px-1 text-[7px] font-black text-white animate-bounce shadow-[0_0_8px_#ef4444]">
                  {unreadMailCount > 0 ? `📩${unreadMailCount}` : `+${hero.statPoints}`}
                </span>
              )}
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveModal('admin')}
                className="flex items-center gap-0.5 rounded border border-red-500/80 bg-gradient-to-r from-red-950 via-red-900/80 to-red-950 px-1.5 py-0.5 text-[8px] font-extrabold text-red-200 shadow-[0_0_8px_rgba(239,68,68,0.4)] hover:border-red-400 active:scale-95 shrink-0"
                title="Открыть панель администратора"
              >
                <span>🛠️ Админ</span>
              </button>
            )}

            {isModerator && (
              <button
                onClick={() => setActiveModal('admin')}
                className="flex items-center gap-0.5 rounded border border-emerald-500/80 bg-gradient-to-r from-emerald-950 via-emerald-900/80 to-emerald-950 px-1.5 py-0.5 text-[8px] font-extrabold text-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.4)] hover:border-emerald-400 active:scale-95 shrink-0"
                title="Открыть панель модератора чата"
              >
                <span>🛡️ Модер</span>
              </button>
            )}
          </div>

          {/* Realtime Status Dot + Live Server Clock on the right of the top strip (never clipped) */}
          <div
            title={`Серверное время • Supabase Realtime: ${realtimeStatus}`}
            className="ml-auto flex shrink-0 items-center gap-1 rounded border border-amber-500/40 bg-slate-900 px-1.5 py-0.5 text-[8px] font-extrabold text-amber-300 tabular-nums shadow-inner"
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${
                realtimeStatus === 'SUBSCRIBED'
                  ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]'
                  : realtimeStatus === 'CONNECTING'
                  ? 'bg-yellow-400 animate-pulse'
                  : realtimeStatus === 'CHANNEL_ERROR'
                  ? 'bg-red-400'
                  : 'bg-emerald-400'
              }`}
            />
            <span>🕒 {serverTimeStr}</span>
          </div>
        </div>

        {/* Interactive Player AI Tactical Advice Card */}
        {activeAiAdviceCard && (
          <div className="mx-2 mt-1 rounded-xl border-2 border-indigo-500/80 bg-gradient-to-r from-indigo-950/95 via-slate-900/95 to-purple-950/95 p-2.5 text-xs shadow-2xl z-30">
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-indigo-500/30 pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🧠</span>
                <span className="font-black text-indigo-200 text-[11px]">
                  ИИ-Советник ({AI_CATEGORY_META[activeAiAdviceCard.category]?.label || 'Тактика'})
                </span>
                <span className="rounded border border-emerald-500/50 bg-emerald-950/80 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                  Точность {activeAiAdviceCard.confidenceScore}%
                </span>
              </div>
              <button
                onClick={() => {
                  updatePlayerAdviceStatus(activeAiAdviceCard.id, 'dismissed', 3);
                  setActiveAiAdviceCard(null);
                }}
                className="text-[10px] font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                ✕ Закрыть
              </button>
            </div>
            <div className="mt-1.5 font-bold text-amber-300 text-[11px]">
              {activeAiAdviceCard.title}
            </div>
            <p className="mt-0.5 text-[10.5px] text-slate-200 leading-relaxed">
              {activeAiAdviceCard.adviceText}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[9.5px] font-bold text-emerald-300">
                📈 Эффект: {activeAiAdviceCard.expectedImpact}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    updatePlayerAdviceStatus(activeAiAdviceCard.id, 'accepted', 5);
                    showToast('👍 Спасибо за оценку! Совет сохранён в статистике ИИ.');
                    setActiveAiAdviceCard(null);
                  }}
                  className="rounded-lg border border-cyan-500/60 bg-cyan-950/80 hover:bg-cyan-800 px-2.5 py-1 text-[10px] font-black text-cyan-200 cursor-pointer"
                >
                  👍 Полезно
                </button>
                <button
                  onClick={() => {
                    updatePlayerAdviceStatus(activeAiAdviceCard.id, 'applied', 5);
                    const act = activeAiAdviceCard.recommendedAction;
                    setActiveAiAdviceCard(null);
                    if (act === 'repair_gear') {
                      setActiveModal('inventory');
                      showToast('🔨 Открыта Сумка — нажмите «Починить всё» для ремонта снаряжения!');
                    } else if (act === 'distribute_stats') {
                      setActiveModal('character');
                      showToast('📈 Открыто окно Персонажа для распределения свободных очков статов!');
                    } else if (act === 'buy_equipment') {
                      setActiveModal('shop');
                      showToast('🛒 Открыт Магазин для усиления экипировки!');
                    } else if (act === 'upgrade_vip') {
                      setActiveModal('vip');
                      showToast('👑 Открыто окно VIP-бонусов!');
                    } else {
                      showToast('⚡ Тактическая рекомендация ИИ принята к исполнению!');
                    }
                  }}
                  className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 px-2.5 py-1 text-[10px] font-black text-slate-950 shadow cursor-pointer"
                >
                  ⚡ Применить совет
                </button>
              </div>
            </div>
          </div>
        )}

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

        {/* Smooth CSS Darkening Transition Overlay when entering Pyramid / exiting to City */}
        <div
          className={`pointer-events-none fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-[2px] transition-opacity duration-200 ease-in-out ${
            screenFadeOverlay.active ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {screenFadeOverlay.label && (
            <div className="rounded-xl border border-amber-500/40 bg-slate-950/90 px-4 py-2 text-xs font-black uppercase tracking-wider text-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.35)]">
              {screenFadeOverlay.label}
            </div>
          )}
        </div>

        {/* 1. TOP 60% SCREEN (CITY OR PYRAMID) */}
        {(() => {
          const resolvedHeroAvatar = (() => {
            if (hero.activeSkinId) {
              const ownedResolved = resolvePlayerOwnedSkins(
                hero.ownedSkinIds,
                hero.ownedSkinExpirations,
                shopSkins,
                hero.ownedSkins,
                hero.activeSkinId,
                hero.avatar
              );
              const activeSkin = ownedResolved.find((s) => s.id === hero.activeSkinId);
              if (activeSkin && (activeSkin.avatarUrl || activeSkin.icon)) {
                return activeSkin.avatarUrl || activeSkin.icon;
              }
            }
            return hero.avatar;
          })();
          const heroWithResolvedSkin = { ...hero, avatar: resolvedHeroAvatar };

          return screen === 'city' ? (
            <CityScreen
              currentUser={currentUser}
              hero={heroWithResolvedSkin}
              soundMuted={soundMuted}
              unreadMailCount={unreadMailCount}
              lastRegenTickAt={lastRegenTickAtRef.current}
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
              onOpenAltar={() => {
                setAltarInitialItemId(null);
                setActiveModal('altar');
              }}
              onOpenDailyReward={() => {
                setDailyModalInitialTab('login');
                setActiveModal('dailyReward');
              }}
              onOpenDailyQuests={() => {
                setDailyModalInitialTab('quests');
                setActiveModal('dailyReward');
              }}
              canClaimDailyReward={dailyRewardStatus.canClaimToday}
              onOpenAchievements={() => setActiveModal('achievements')}
              claimableAchievementsCount={achievementsSummary.claimableCount}
              onOpenAuction={() => {
                if (checkBanRestriction('blockTradeAndAuction', 'Аукцион и торговля')) return;
                setActiveModal('auction');
              }}
              onOpenInventory={() => setActiveModal('inventory')}
              onOpenWheel={() => {
                if (checkBanRestriction('blockRoulette', 'Колесо Рулетки')) return;
                if (featureFlags.rouletteEnabled === false) {
                  showToast('⛔ Рулетка временно отключена администратором!');
                  return;
                }
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
              onOpenForum={() => setActiveModal('forum')}
              onToggleNpcActive={handleToggleNpcActive}
              onOpenNpcBag={() => {
                setCharacterModalInitialTab('npcBag');
                setActiveModal('character');
              }}
              onUsePotion={handleUsePotion}
              isAdmin={isAdmin}
              isModerator={isModerator}
              featureFlags={featureFlags}
            />
          ) : (
            <PyramidScreen
              hero={heroWithResolvedSkin}
              pyramidTier={pyramidTier}
              pyramidMap={pyramidMap}
              playerPos={playerPos}
              lastMoveTime={lastMoveTime}
              moveDelay={MOVE_DELAY}
              respawnTimeLeft={Math.max(0, (featureFlags.bossRespawnIntervalSec || 60) - Math.floor((Date.now() - lastRespawnTime) / 1000))}
              activeSack={activeSackAdjacent}
              damagePopups={damagePopups}
              rareBossTimers={rareBossTimers}
              realtimePlayers={effectiveRealtimePlayers}
              currentUser={currentUser}
              unreadMailCount={unreadMailCount}
              onPickUpSack={handlePickUpSack}
              onBlockClick={handlePyramidBlockClick}
              onExitToCity={handleExitToCity}
              onUsePotion={handleUsePotion}
              onUsePyramidCard={handleUsePyramidCard}
              onEnterNextTierPortal={handleEnterNextTierPortal}
              onOpenCharModal={() => {
                setCharacterModalInitialTab(unreadMailCount > 0 ? 'mail' : 'profile');
                setActiveModal('character');
              }}
            />
          );
        })()}

        {/* 2. BOTTOM 40% SCREEN (CHAT, PRIVATE MESSAGES, COMBAT LOG & ONLINE) */}
        <ChatAndOnline
          messages={chatMessages}
          friends={friends}
          activeChannel={activeChatChannel}
          combatLog={combatLog}
          mailMessages={mailMessages}
          unreadMailCount={unreadMailCount}
          playersInPyramid={pyramidPlayersInPyramid}
          heroLocation={screen}
          heroPyramidTier={pyramidTier}
          currentUser={currentUser}
          heroLevel={hero.level}
          heroAvatar={(() => {
            if (hero.activeSkinId) {
              const ownedResolved = resolvePlayerOwnedSkins(
                hero.ownedSkinIds,
                hero.ownedSkinExpirations,
                shopSkins,
                hero.ownedSkins,
                hero.activeSkinId,
                hero.avatar
              );
              const activeSkin = ownedResolved.find((s) => s.id === hero.activeSkinId);
              if (activeSkin && (activeSkin.avatarUrl || activeSkin.icon)) {
                return activeSkin.avatarUrl || activeSkin.icon;
              }
            }
            return hero.avatar;
          })()}
          heroIsPremium={Boolean(
            hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now()
          )}
          equipped={equipped}
          onOpenCharModal={() => {
            setCharacterModalInitialTab(unreadMailCount > 0 ? 'mail' : 'profile');
            setActiveModal('character');
          }}
          onOpenMailModal={() => {
            setCharacterModalInitialTab('mail');
            setActiveModal('character');
          }}
          onOpenTradeProtocol={() => setActiveModal('protocol')}
          realtimePlayers={effectiveRealtimePlayers}
          realtimeStatus={realtimeStatus}
          isAdmin={isAdmin}
          isModerator={isModerator}
          heroRole={isAdmin ? 'admin' : isModerator ? 'mod' : 'regular'}
          onSwitchChannel={setActiveChatChannel}
          onClearCombatLog={() => setCombatLog([])}
          onSendMessage={handleSendMessage}
          onSendMail={handleSendSMS}
          onMarkMailRead={handleMarkMailRead}
          onDeleteMessage={handleDeleteChatMessage}
          onClearRecentChat={handleClearRecentWorldChat}
          onMutePlayerInChat={handleMutePlayerInChat}
          onOpenModPanel={() => setActiveModal('admin')}
          onInspectPlayer={(nick) => setInspectedNick(nick)}
        />

        {/* Game Version & Last Updated Footer Bar */}
        <div className="flex items-center justify-center bg-black/95 border-t border-slate-900 py-0.5 px-2 text-[8.5px] text-slate-400 gap-2 shrink-0">
          <span>Версия: <strong className="text-amber-400">v1.1.17</strong></span>
          <span>|</span>
          <span>Обновлено: <strong className="text-slate-300">30.10.2026</strong></span>
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
            lootHistory={sessionLootHistory}
            onClearLootHistory={() => setSessionLootHistory([])}
            mailMessages={mailMessages}
            unreadMailCount={unreadMailCount}
            shopSkins={shopSkins}
            showToast={showToast}
            onEquipSkin={handleEquipSkin}
            onUseKillerLicense={handleUseKillerLicense}
            onClaimNpcLoot={handleClaimNpcLoot}
            onToggleNpcActive={handleToggleNpcActive}
            onUpdateNpcCompanion={(updatedNpc) => {
              const nextHero: HeroState = { ...heroRef.current, npcCompanion: updatedNpc };
              heroRef.current = nextHero;
              setHero(nextHero);
              saveGameToStorage({ hero: nextHero });
              if (currentUserRef.current) {
                flushPlayerUpdates(currentUserRef.current, {
                  npc_companion: updatedNpc,
                  npcCompanion: updatedNpc
                });
              }
            }}
            knownPlayers={Array.from(
              new Set([
                ...effectiveRealtimePlayers.map((p: RealtimePlayer) => p.nick),
                ...friends.map((f: FriendEntry) => f.nick)
              ])
            )}
            onClose={() => setActiveModal(null)}
            onUnequip={handleUnequipItem}
            onRepairItem={handleRepairItem}
            onOpenStats={() => setActiveModal('stats')}
            onOpenTradeProtocol={() => setActiveModal('protocol')}
            onOpenFriends={() => setActiveModal('friends')}
            onOpenDirectTransfer={() => setActiveModal('directTransfer')}
            onOpenInventory={() => setActiveModal('inventory')}
            onOpenShop={() => setActiveModal('shop')}
            onOpenAltar={(item) => {
              setAltarInitialItemId(item?.id || null);
              setActiveModal('altar');
            }}
            onOpenCreateItem={() => setActiveModal('createItem')}
            onOpenPremium={() => setActiveModal('premium')}
            onOpenLeaderboard={() => setActiveModal('leaderboard')}
            onOpenAchievements={() => setActiveModal('achievements')}
            claimableAchievementsCount={achievementsSummary.claimableCount}
            onClaimAchievement={handleClaimAchievement}
            onClaimAllAchievements={handleClaimAllAchievements}
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
            onRepairItem={handleRepairItem}
            onRepair={handleRepairItem}
            onRepairAll={handleRepairAllInventoryItems}
            onOpenAltar={(item) => {
              setAltarInitialItemId(item?.id || null);
              setActiveModal('altar');
            }}
            onOpenCreateItem={() => setActiveModal('createItem')}
            onOpenNpcBag={() => {
              setCharacterModalInitialTab('npcBag');
              setActiveModal('character');
            }}
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
            onQuickSellCommon={handleQuickSellCommonItems}
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
            onBuyKillerLicense={handleBuyKillerLicense}
            onUseKillerLicense={handleUseKillerLicense}
            onBuyPyramidCard={handleBuyPyramidCard}
            onBuyNpcCompanion={handleBuyNpcCompanion}
            onToggleNpcActive={handleToggleNpcActive}
            onOpenNpcBackpack={() => {
              setCharacterModalInitialTab('npcBag');
              setActiveModal('character');
            }}
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
            wheelDisabled={featureFlags.rouletteEnabled === false}
            crystalSpinCost={featureFlags.rouletteSpinCostCrystals ?? 50}
            featureFlags={featureFlags}
            onClose={() => setActiveModal(null)}
            onRewardReceived={handleRouletteReward}
            onWinnerLogged={handleWheelWinnerLogged}
            onInspectPlayer={(nick) => {
              setActiveModal(null);
              setInspectedNick(nick);
            }}
            onSpinStarted={(mode, ts, todayKey) => {
              setHero((prev) => {
                const { lastReset0001 } = getRouletteResetInfo(ts);
                const prevFreeSpins =
                  prev.dailyWheelSpinsDate === todayKey
                    ? Math.max(
                        prev.dailyFreeWheelSpins || 0,
                        (prev.lastWheelSpinTime || 0) >= lastReset0001 ? 1 : 0
                      )
                    : (prev.lastWheelSpinTime || 0) >= lastReset0001
                    ? 1
                    : 0;
                const prevGoldSpins =
                  prev.dailyWheelSpinsDate === todayKey
                    ? prev.dailyGoldWheelSpins || 0
                    : 0;
                const prevCrystalSpins =
                  prev.dailyWheelSpinsDate === todayKey
                    ? prev.dailyCrystalWheelSpins || 0
                    : 0;
                const nextLastSpin = mode === 'free' ? ts : prev.lastWheelSpinTime;
                const nextFreeSpins = mode === 'free' ? prevFreeSpins + 1 : prevFreeSpins;
                const nextGoldSpins = mode === 'gold' ? prevGoldSpins + 1 : prevGoldSpins;
                const nextCrystalSpins = mode === 'crystals' ? prevCrystalSpins + 1 : prevCrystalSpins;

                if (currentUser) {
                  flushPlayerUpdates(currentUser, {
                    last_wheel_spin_time: nextLastSpin,
                    daily_free_wheel_spins: nextFreeSpins,
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
                  dailyFreeWheelSpins: nextFreeSpins,
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
            onGamblingTransaction={(tx) => {
              const spentG = Math.max(0, Math.floor(Number(tx.spentGold || 0)));
              const wonG = Math.max(0, Math.floor(Number(tx.wonGold || 0)));
              const spentC = Math.max(0, Math.floor(Number(tx.spentCrystals || 0)));
              const wonC = Math.max(0, Math.floor(Number(tx.wonCrystals || 0)));
              const isWheel = tx.gameName === 'Колесо удачи';

              setHero((prev) => {
                // For Wheel of Fortune, gold/crystals balance is already adjusted by onDeductGold/onDeductCrystals/onRewardReceived
                const nextGold = isWheel
                  ? prev.gold
                  : Math.max(0, prev.gold - spentG + wonG);
                const nextCrystals = isWheel
                  ? prev.crystals
                  : Math.max(0, prev.crystals - spentC + wonC);

                const nextSpentGold = (prev.gamblingSpentGold || 0) + spentG;
                const nextWonGold = (prev.gamblingWonGold || 0) + wonG;
                const nextSpentCrystals = (prev.gamblingSpentCrystals || 0) + spentC;
                const nextWonCrystals = (prev.gamblingWonCrystals || 0) + wonC;
                const nextGamesPlayed =
                  (prev.gamblingGamesPlayed || 0) + (tx.countGame === false ? 0 : 1);

                lastSyncedFinancialsRef.current = {
                  ...lastSyncedFinancialsRef.current,
                  gold: nextGold,
                  crystals: nextCrystals,
                  updatedAt: Date.now()
                };

                const updatedHero: HeroState = {
                  ...prev,
                  gold: nextGold,
                  crystals: nextCrystals,
                  gamblingSpentGold: nextSpentGold,
                  gamblingWonGold: nextWonGold,
                  gamblingSpentCrystals: nextSpentCrystals,
                  gamblingWonCrystals: nextWonCrystals,
                  gamblingGamesPlayed: nextGamesPlayed
                };
                heroRef.current = updatedHero;
                saveGameToStorage({ hero: updatedHero });

                if (currentUser) {
                  flushPlayerUpdates(currentUser, {
                    gold: nextGold,
                    crystals: nextCrystals,
                    gambling_spent_gold: nextSpentGold,
                    gamblingSpentGold: nextSpentGold,
                    gambling_won_gold: nextWonGold,
                    gamblingWonGold: nextWonGold,
                    gambling_spent_crystals: nextSpentCrystals,
                    gamblingSpentCrystals: nextSpentCrystals,
                    gambling_won_crystals: nextWonCrystals,
                    gamblingWonCrystals: nextWonCrystals,
                    gambling_games_played: nextGamesPlayed,
                    gamblingGamesPlayed: nextGamesPlayed
                  });
                  setRealtimePlayers((rPrev) =>
                    rPrev.map((p) =>
                      p.nick.toLowerCase() === currentUser.toLowerCase()
                        ? {
                            ...p,
                            gold: nextGold,
                            crystals: nextCrystals,
                            gamblingSpentGold: nextSpentGold,
                            gamblingWonGold: nextWonGold,
                            gamblingSpentCrystals: nextSpentCrystals,
                            gamblingWonCrystals: nextWonCrystals,
                            gamblingGamesPlayed: nextGamesPlayed
                          }
                        : p
                    )
                  );
                }

                return updatedHero;
              });

              if (tx.logText) {
                addCombatLog(tx.logText, 'loot' as any);
              }
            }}
          />
        )}

        {/* Premium Modal */}
        {activeModal === 'premium' && (
          <PremiumModal
            hero={hero}
            featureFlags={featureFlags}
            isAdmin={isAdmin}
            onOpenAdminVip={() => {
              setAdminModalInitialTab('vip');
              setActiveModal('admin');
            }}
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
            inventory={inventory}
            onReclaimRentItem={handleReturnRentEarly}
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
            isModeratorOnly={isModerator && !isAdmin}
            hero={{ ...hero, nick: currentUser || hero.nick || 'Игрок' }}
            setHero={setHero}
            equipped={equipped}
            setEquipped={setEquipped}
            inventory={inventory}
            setInventory={setInventory}
            onlinePlayers={effectiveRealtimePlayers}
            setChatMessages={setChatMessages}
            setPrivateMessages={setMailMessages}
            showToast={showToast}
            onClearWorldChat={handleClearWorldChat}
            onClearRecentWorldChat={handleClearRecentWorldChat}
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
              const nextTier = Math.max(1, Math.min(3, Number(h.pyramidTier || h.homePyramidTier || 1)));
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
                home_pyramid_tier: h.homePyramidTier || nextTier,
                пирамидальный_уровень: nextTier,
                is_premium: Boolean(h.isPremium && h.premiumUntil && h.premiumUntil > Date.now()),
                premium_until: h.premiumUntil || 0,
                owned_skin_ids: h.ownedSkinIds || [],
                owned_skin_expirations: h.ownedSkinExpirations || {},
                owned_skins: h.ownedSkins || [],
                active_skin_id: h.activeSkinId || null,
                avatar: h.avatar,
                npc_companion: h.npcCompanion ?? null,
                npcCompanion: h.npcCompanion ?? null,
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
            onOpenMail={() => {
              setActiveModal('character');
              setCharacterModalInitialTab('mail');
            }}
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

        {/* Daily Login Reward & Daily Quests Modal */}
        {activeModal === 'dailyReward' && (
          <DailyRewardModal
            hero={hero}
            currentUser={currentUser}
            initialTab={dailyModalInitialTab}
            onClose={() => setActiveModal(null)}
            onClaimReward={handleClaimDailyReward}
            onClaimQuestChest={handleClaimQuestChest}
            onClaimGrandCrystalChest={handleClaimGrandCrystalChest}
          />
        )}

        {/* Achievements, Daily Quests & Daily Login Gift Modal */}
        {activeModal === 'achievements' && (
          <AchievementsModal
            hero={hero}
            onClose={() => setActiveModal(null)}
            onClaimAchievement={handleClaimAchievement}
            onClaimAllAchievements={handleClaimAllAchievements}
            onClaimDailyReward={handleClaimDailyReward}
            onClaimQuestChest={handleClaimQuestChest}
            onClaimGrandCrystalChest={handleClaimGrandCrystalChest}
          />
        )}

        {/* Modification Altar Modal (10 Classes, +5% per class up to +50%, Shop Item Sacrifice) */}
        {activeModal === 'altar' && (
          <ModificationAltarModal
            hero={hero}
            equipped={equipped}
            inventory={inventory}
            shopCatalog={shopCatalog}
            initialTargetItemId={altarInitialItemId}
            onClose={() => {
              setAltarInitialItemId(null);
              setActiveModal(null);
            }}
            showToast={showToast}
            onQuickBuyShopSacrifice={(template) => {
              const curHero = heroRef.current || hero;
              const curInv = inventoryRef.current || inventory;
              const itemPrice = Math.max(0, Number(template.price || 0));
              const curGold = Number(curHero.gold || 0);
              if (curGold < itemPrice) {
                showToast(`❌ Недостаточно золота! Требуется ${itemPrice} 🪙 (у вас ${curGold} 🪙).`);
                return null;
              }
              const isVip = Boolean(
                curHero.isPremium && curHero.premiumUntil && curHero.premiumUntil > Date.now()
              );
              const effectiveBagCap =
                Math.max(20, Number(curHero.bagCapacity || 100)) + (isVip ? 50 : 0);
              if (curInv.length >= effectiveBagCap) {
                showToast('🎒 Сумка заполнена! Освободите место для материала.');
                return null;
              }
              const newItem = createGameItemFromShopItem(template);
              const newGold = Math.max(0, curGold - itemPrice);
              const nextInv = [newItem, ...curInv];
              const nextHero: HeroState = {
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
              saveGameToStorage({ hero: nextHero, inventory: nextInv });
              if (currentUser) {
                flushPlayerUpdates(currentUser, {
                  gold: newGold,
                  inventory: nextInv
                });
              }
              playCoinSound();
              return newItem;
            }}
            onExecuteModification={({
              targetItemId,
              isEquippedSlot,
              sacrificeItemIds,
              succeeded,
              updatedItem,
              chancePct,
              rolledPct
            }) => {
              const curHero = heroRef.current || hero;
              const curInv = inventoryRef.current || inventory;
              const curEq = equippedRef.current || equipped;

              const sacrificeSet = new Set(sacrificeItemIds);
              // Burn sacrifice items unconditionally (both on success and failure)
              let nextInv = curInv.filter((it) => !sacrificeSet.has(it.id));
              let nextEq = { ...curEq };

              if (succeeded && updatedItem) {
                if (isEquippedSlot && nextEq[isEquippedSlot]?.id === targetItemId) {
                  nextEq = {
                    ...nextEq,
                    [isEquippedSlot]: updatedItem
                  };
                } else {
                  nextInv = nextInv.map((it) => (it.id === targetItemId ? updatedItem : it));
                }
                playLevelUpSound();
              } else {
                playAttackSound();
              }

              const nextHero = recalcGear(nextEq, curHero);
              heroRef.current = nextHero;
              inventoryRef.current = nextInv;
              equippedRef.current = nextEq;

              setHero(nextHero);
              setInventory(nextInv);
              setEquipped(nextEq);

              const now = Date.now();
              const dateStr = new Date(now).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              });
              const targetRefItem =
                updatedItem ||
                (isEquippedSlot ? curEq[isEquippedSlot] : curInv.find((i) => i.id === targetItemId));
              const modEntry: TradeProtocolEntry = {
                id: `altar_${now}_${Math.random().toString(36).slice(2, 6)}`,
                timestamp: now,
                dateStr,
                type: 'altar_modify',
                description: succeeded && updatedItem
                  ? `🔮 Алтарь Модификации (УСПЕХ — шанс ${chancePct}%, выпало ${rolledPct}%): «${updatedItem.name}» улучшен до Класса М${updatedItem.modificationClass} (+${(updatedItem.modificationClass || 0) * 5}% статов)! Сожжено материалов: ${sacrificeItemIds.length} шт.`
                  : `🔥 Алтарь Модификации (НЕУДАЧА — шанс ${chancePct}%, выпало ${rolledPct}%): модификация «${targetRefItem?.name || 'Предмет'}» сорвалась. Жертвенные материалы (${sacrificeItemIds.length} шт.) сгорели.`,
                itemSnapshot: targetRefItem
                  ? {
                      name: targetRefItem.name,
                      icon: targetRefItem.icon,
                      quality: targetRefItem.quality
                    }
                  : undefined
              };
              const nextProtocol = [modEntry, ...(tradeProtocolRef.current || tradeProtocol)].slice(
                0,
                100
              );
              tradeProtocolRef.current = nextProtocol;
              setTradeProtocol(nextProtocol);

              saveGameToStorage({
                hero: nextHero,
                inventory: nextInv,
                equipped: nextEq,
                tradeProtocol: nextProtocol
              });

              if (currentUser) {
                flushPlayerUpdates(currentUser, {
                  inventory: nextInv,
                  equipped: nextEq,
                  hp: nextHero.hp,
                  max_hp: nextHero.maxHp,
                  energy: nextHero.energy,
                  max_energy: nextHero.maxEnergy,
                  trade_protocol: nextProtocol
                });
              }

              addCombatLog(
                succeeded && updatedItem
                  ? `🔮 Алтарь Модификации: «${updatedItem.name}» успешно улучшен до Класса М${updatedItem.modificationClass} (+${(updatedItem.modificationClass || 0) * 5}% статов)!`
                  : `🔥 Алтарь Модификации: неудача (${rolledPct}% при шансе ${chancePct}%) — жертвенные материалы (${sacrificeItemIds.length} шт.) сгорели.`,
                succeeded ? 'loot' : 'pvp'
              );
            }}
          />
        )}

        {/* Forum Modal (Updates, Game Encyclopedia, Lesson & AI Advice) */}
        {activeModal === 'forum' && (
          <ForumModal
            onClose={() => setActiveModal(null)}
            hero={{
              ...hero,
              maxHp: getHeroTotalMaxHp(hero, equipped),
              maxEnergy: getHeroTotalMaxEnergy(hero, equipped)
            }}
            currentUser={currentUser}
            equipped={equipped}
            inventory={inventory}
            pyramidTier={pyramidTier}
            onStartInteractiveTutorial={() => setActiveModal('tutorial')}
            showToast={showToast}
            onApplyAiAction={(act) => {
              if (act === 'repair_gear') {
                setActiveModal('inventory');
                showToast('🔨 Открыта Сумка — нажмите «Починить всё» для ремонта снаряжения!');
              } else if (act === 'distribute_stats') {
                setActiveModal('character');
                showToast('📈 Открыто окно Персонажа для распределения свободных очков статов!');
              } else if (act === 'buy_equipment') {
                setActiveModal('shop');
                showToast('🛒 Открыт Магазин для усиления экипировки!');
              } else if (act === 'upgrade_vip') {
                setActiveModal('premium');
                showToast('👑 Открыто окно VIP-бонусов!');
              } else if (act === 'exchange_currency') {
                setActiveModal('bank');
                showToast('🏦 Открыт Банк для обмена валюты!');
              } else {
                setActiveModal(null);
                showToast('⚡ Тактическая рекомендация ИИ принята к исполнению!');
              }
            }}
          />
        )}

        {/* Interactive Tutorial Modal (Available up to Level 5) */}
        {activeModal === 'tutorial' && (
          <TutorialModal
            heroNick={currentUser || hero.nick || 'Герой'}
            heroLevel={hero.level || 1}
            currentScreen={screen}
            onClose={() => setActiveModal(null)}
            onOpenSection={(section) => {
              if (section === 'character') {
                setCharacterModalInitialTab('profile');
                setActiveModal('character');
              } else if (section === 'lootHistory') {
                setCharacterModalInitialTab('lootHistory');
                setActiveModal('character');
              } else if (section === 'npcBag') {
                setCharacterModalInitialTab('npcBag');
                setActiveModal('character');
              } else if (section === 'shop') {
                setActiveModal('shop');
              } else if (section === 'bank') {
                setActiveModal('bank');
              } else if (section === 'wheel') {
                setActiveModal('wheel');
              } else if (section === 'dailyReward') {
                setActiveModal('dailyReward');
              } else if (section === 'forum') {
                setActiveModal('forum');
              }
            }}
            onComplete={() => {
              if (currentUser) {
                flushPlayerUpdates(currentUser, { tutorial_completed: true });
              }
              showToast('🎓 Вы ознакомились с обучением! Кнопка останется до 5-го уровня.');
            }}
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
            onAddLootHistory={addLootHistoryEntry}
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

        {/* Global Rare Item / Valuable Sale Confirmation Modal */}
        {rareActionConfirmModal && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs">
            <div
              className={`w-full max-w-sm rounded-2xl border-2 bg-slate-900 p-4 text-left shadow-2xl space-y-3 ${
                rareActionConfirmModal.accentColor === 'purple'
                  ? 'border-purple-500/80 shadow-purple-950/50'
                  : rareActionConfirmModal.accentColor === 'red'
                  ? 'border-red-500/80 shadow-red-950/50'
                  : rareActionConfirmModal.accentColor === 'cyan'
                  ? 'border-cyan-500/80 shadow-cyan-950/50'
                  : 'border-amber-500/80 shadow-amber-950/50'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <span>{rareActionConfirmModal.title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRareActionConfirmModal(null)}
                  className="text-sm font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-950/90 p-2.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-slate-900 text-2xl shadow">
                  {rareActionConfirmModal.icon}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-xs font-black text-white leading-tight">
                    {rareActionConfirmModal.itemTitle}
                  </div>
                  {rareActionConfirmModal.badgeText && (
                    <div className="text-[10px] font-bold text-amber-300">
                      {rareActionConfirmModal.badgeText}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-red-500/50 bg-red-950/40 p-2.5 text-[10.5px] text-red-100 leading-snug">
                {rareActionConfirmModal.warningText}
              </div>

              {rareActionConfirmModal.effectText && (
                <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-2 text-[10px] font-bold text-emerald-300 leading-snug">
                  {rareActionConfirmModal.effectText}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRareActionConfirmModal(null)}
                  className="flex-1 rounded-xl border border-slate-600 bg-slate-800 py-2 text-xs font-extrabold text-slate-200 hover:bg-slate-700 active:scale-95 cursor-pointer"
                >
                  ✕ Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const action = rareActionConfirmModal.onConfirm;
                    setRareActionConfirmModal(null);
                    action();
                  }}
                  className={`flex-1 rounded-xl border py-2 text-xs font-black text-white shadow-lg active:scale-95 cursor-pointer ${
                    rareActionConfirmModal.accentColor === 'purple'
                      ? 'border-purple-400/60 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500'
                      : rareActionConfirmModal.accentColor === 'red'
                      ? 'border-red-400/60 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500'
                      : rareActionConfirmModal.accentColor === 'cyan'
                      ? 'border-cyan-400/60 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500'
                      : 'border-amber-400/60 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 hover:brightness-110'
                  }`}
                >
                  {rareActionConfirmModal.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
