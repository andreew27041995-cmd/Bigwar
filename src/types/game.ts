export type ItemSlot = 'weapon' | 'armor' | 'pants' | 'boots' | 'gloves' | 'ring' | 'transport';

export type ItemQualityKey = 'common' | 'rare' | 'epic' | 'legendary' | 'custom';

export interface ItemQuality {
  key: ItemQualityKey;
  name: string;
  color: string;
  mult: number;
  chance: number;
}

export interface ItemRentInfo {
  to: string;
  hours: number;
  price: number;
  startTime: number;
  until: number;
  expiredNotified?: boolean;
}

export interface ShopItemTemplate {
  id: string;
  name: string;
  slot: ItemSlot;
  type?: string;
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

export interface CharacterSkinTemplate {
  id: string;
  name: string;
  icon: string;
  avatarUrl?: string;
  quality: ItemQualityKey;
  lvl: number;
  priceGold: number;
  priceCrystals: number;
  currency: 'gold' | 'crystals';
  hpBonus: number;
  dmgBonus: number;
  strBonus: number;
  agiBonus: number;
  vitBonus: number;
  dodgeBonus: number;
  energyBonus: number;
  goldBonusPct: number;
  expBonusPct: number;
  bagBonus: number;
  isExclusive?: boolean;
  isPersonal?: boolean;
  isTemporary?: boolean;
  durationDays?: number;
  enabled: boolean;
}

export interface PlayerBanInfo {
  isBanned: boolean;
  isPermanent: boolean;
  bannedUntil?: number;
  until?: number;
  reason?: string;
  bannedBy?: string;
  bannedAt?: number;
  blockFullAccess?: boolean;
  blockPyramid?: boolean;
  blockClanPyramid?: boolean;
  blockChat?: boolean;
  blockTradeAndAuction?: boolean;
  blockClans?: boolean;
  blockRoulette?: boolean;
  expPenaltyPct?: number;
  goldPenaltyPct?: number;
}

export interface BankPackageConfig {
  id: string;
  crystals: number;
  priceUsd: number;
  bonusCrystals?: number;
  label?: string;
  enabled: boolean;
}

export interface TransportTemplate {
  id: string;
  name: string;
  icon: string;
  lvl: number;
  travelTimeSec: number; // e.g., 600 (10m), 360 (6m), 240 (4m), 180 (3m)
  priceGold: number;
  priceCrystals?: number;
  price?: number;
  currency?: 'gold' | 'crystals' | 'both';
  maxDurability: number;
  quality: ItemQualityKey;
  description?: string;
  isNamed?: boolean;
  timeReductionPct?: number;
  enabled: boolean;
}

export interface PortTravelState {
  status: 'idle' | 'to_port' | 'in_port' | 'from_port';
  departureTime?: number;
  startTime?: number;
  arrivalTime?: number;
  travelDurationSec?: number;
  transportId?: string | null;
  transportName?: string;
  transportIcon?: string;
}

export interface GameFeatureFlags {
  rouletteEnabled: boolean;
  rouletteSpinCostCrystals?: number;
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
  npcMinLevel?: number;
  npcCompanionsEnabled?: boolean;
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
  // Roulette (Колесо Фортуны) Settings
  rouletteTitle?: string;
  rouletteSpinCurrency?: 'crystals' | 'gold' | 'both';
  rouletteSpinCostGold?: number;
  rouletteVipSpinCostGold?: number;
  rouletteVipSpinCostCrystals?: number;
  rouletteGoldVipOnly?: boolean;
  rouletteFreeSpinsPerDay?: number;
  rouletteDailyGoldSpinsLimit?: number;
  rouletteDailyCrystalSpinsLimit?: number;
  rouletteVipUnlimitedSpins?: boolean;
  // Relics, Modification Altar (50 slots), Port & Transport System Settings
  relicDropChancePct?: number; // Base 3% drop chance in Pyramids
  altarMaxSacrificeItems?: number; // Default 50 items/relics
  altarBonusPerClassPct?: number; // Default +5% per class (10 classes = +50%)
  altarClassChancePerRelic?: number[]; // 10 values for Class 1..10 chance per 1 relic
  transportsCatalog?: TransportTemplate[];
  transportsPriceMigratedV2?: boolean;
  namedTransportEnabled?: boolean;
  namedTransportDefaultDurability?: number; // Default 500/500
  namedTransportTimeReductionPct?: number; // Default 35% time reduction
  namedTransportBaseTimeSec?: number; // Base fastest travel time before reduction (e.g. 150s)
  namedTransportCostCrystals?: number; // Default 35 crystals
  namedTransportCostGold?: number; // Default 15000 gold
}

export interface GameItem {
  id: string;
  shopTemplateId?: string;
  name: string;
  slot: ItemSlot;
  icon: string;
  quality: ItemQualityKey;
  lvl: number;
  dmg: number;
  hp: number;
  dodgeBonus?: number;
  energyBonus?: number;
  goldBonusPct?: number;
  expBonusPct?: number;
  price?: number;
  durability?: number;
  maxDurability?: number;
  initialMaxDurability?: number;
  str?: number;
  agi?: number;
  vit?: number;
  dmgBonus?: number;
  hpBonus?: number;
  strBonus?: number;
  agiBonus?: number;
  vitBonus?: number;
  forgeGoldCost?: number;
  forgeCrystalCost?: number;
  forgeCurrency?: 'crystals' | 'gold';
  transferable?: boolean;
  rent?: ItemRentInfo | null;
  origin?: string;
  isCustomCreated?: boolean;
  creatorNick?: string;
  // Clan Storage & Rental Fields
  clanStorageId?: string;
  isClanRented?: boolean;
  rentedByNick?: string;
  originalOwnerNick?: string;
  clanRentDepositedAt?: number;
  // Auction Elixir Lot Fields
  isElixirLot?: boolean;
  elixirType?: 'hp' | 'en' | 'exp';
  elixirQty?: number;
  // Modification Altar Fields (Classes 1..10, +5% per class up to +50%)
  modificationClass?: number;
  baseStatsBeforeMod?: {
    dmg: number;
    hp: number;
    dodgeBonus?: number;
    energyBonus?: number;
    goldBonusPct?: number;
    expBonusPct?: number;
    str?: number;
    agi?: number;
    vit?: number;
  };
  // Relic Fields (dropped in Pyramids, used as sacrifice materials in Altar)
  isRelic?: boolean;
  relicTier?: number;
  relicPower?: number;
  // Transport Fields (used to travel to Port and back)
  isTransport?: boolean;
  transportTemplateId?: string;
  travelTimeSec?: number;
  isNamedTransport?: boolean;
  timeReductionPct?: number;
}

export type ClanRole = 'leader' | 'officer' | 'warrior' | 'recruit' | 'member';

export interface ClanMember {
  nick: string;
  role: ClanRole;
  lvl: number;
  avatar?: string;
  joinedAt: number;
  contributionExp?: number;
  contributionInfluence?: number;
  isOnline?: boolean;
  lastSeen?: number;
}

export interface ClanStorageItem {
  id: string;
  itemType?: 'equipment' | 'elixir';
  elixirType?: 'hp' | 'en' | 'exp';
  elixirQty?: number;
  item: GameItem;
  originalOwnerNick: string;
  depositedAt: number;
  isRented: boolean;
  rentedByNick?: string;
  rentedAt?: number;
}

export type ClanLogType =
  | 'create'
  | 'join'
  | 'leave'
  | 'kick'
  | 'deposit_gold'
  | 'deposit_item'
  | 'deposit_elixir'
  | 'rent_item'
  | 'return_item'
  | 'recall_item'
  | 'take_elixir'
  | 'pyramid_income';

export interface ClanLogEntry {
  id: string;
  timestamp: number;
  timeStr: string;
  actorNick: string;
  type: ClanLogType;
  text: string;
  icon?: string;
}

export interface Clan {
  id: string;
  name: string;
  tag: string;
  emblem: string;
  description: string;
  leaderNick: string;
  level: number;
  exp?: number;
  maxStorageOverride?: number;
  elixirs?: {
    hp: number;
    en: number;
    exp: number;
  };
  influencePoints: number;
  treasuryGold: number;
  treasuryCrystals: number;
  pyramidTaxGoldPct?: number;
  pyramidTaxCrystalPct?: number;
  createdAt: number;
  members: ClanMember[];
  storage: ClanStorageItem[];
  logs?: ClanLogEntry[];
  isOpen: boolean;
  joinMinLvl: number;
}

export interface ClanPyramidMonsterTemplate {
  id: string;
  name: string;
  icon: string;
  lvl: number;
  hp: number;
  maxHp?: number;
  dmg: number;
  isBoss?: boolean;
  goldReward: number;
  crystalReward: number;
  expReward: number;
  clanExpReward: number;
  influenceReward: number;
  spawnCount: number;
}

export interface ClanPyramidConfig {
  title: string;
  subtitle: string;
  minClanLevel: number;
  energyPerMove: number;
  respawnIntervalSec: number;
  buffGoldPct: number;
  buffExpPct: number;
  buffDmgPct: number;
  buffHpPct: number;
  goldBonusPct: number;
  expBonusPct: number;
  dmgBonusPct: number;
  hpBonusPct: number;
  monsters: ClanPyramidMonsterTemplate[];
}

export interface ClanPyramidState {
  controlledByClanId?: string | null;
  controlledByClanName?: string | null;
  controlledByClanTag?: string | null;
  controlledByClanEmblem?: string | null;
  seasonEndTimestamp?: number;
  treasuryGold: number;
  treasuryCrystals: number;
  floorScores: Record<string, number>;
  currentCycle: number;
  lastBattleAt?: number;
  lastRespawnAt?: number;
  lastGridRespawnAt?: number;
  gridSeed?: number;
  config?: ClanPyramidConfig;
  gridCells?: PyramidCell[][];
  topClansLeaderboard: {
    clanId: string;
    clanName: string;
    clanTag: string;
    clanEmblem: string;
    influence: number;
  }[];
}

export interface HeroState {
  nick?: string;
  clanId?: string;
  clanTag?: string;
  clanName?: string;
  clanEmblem?: string;
  clanRole?: ClanRole;
  level: number;
  lvl?: number;
  exp: number;
  gold: number;
  crystals: number;
  hp: number;
  maxHp: number;
  baseMaxHp: number;
  energy: number;
  maxEnergy: number;
  bonusDmg: number;
  bonusHp: number;
  gearDmg: number;
  gearHp: number;
  gearDodge?: number;
  gearEnergy?: number;
  gearGoldPct?: number;
  gearExpPct?: number;
  gearStr?: number;
  gearAgi?: number;
  gearVit?: number;
  gearV2Migrated?: boolean;
  statPoints: number;
  str: number;
  agi: number;
  vit: number;
  hpPotions: number;
  enPotions: number;
  expPotions?: number;
  expElixirUntil?: number;
  goldInCurrentRun: number;
  bagCapacity: number;
  sellExperience: number;
  mobsKilled: number;
  mobKills?: number;
  pvpKills: number;
  pvpWins?: number;
  pvpLosses?: number;
  deaths: number;
  itemsSold: number;
  role: 'admin' | 'mod' | 'winner' | 'regular';
  statusTitle: string;
  isPremium: boolean;
  premiumUntil?: number;
  vipUntil?: number;
  pyramidTier: number;
  homePyramidTier?: number;
  pyramidCard1?: number;
  pyramidCard2?: number;
  pyramidCard3?: number;
  avatar: string;
  dailyQuests: DailyQuest[];
  lastQuestUpdate: number;
  dailyQuestsDate?: string;
  dailyCrystalChestClaimedDate?: string;
  referralCode: string;
  referredBy?: string;
  referralPlayerNick?: string;
  referralPlayerLvl?: number;
  referralClaimed?: boolean;
  lastWheelSpinTime?: number;
  lastGoldWheelSpinTime?: number;
  dailyFreeWheelSpins?: number;
  dailyGoldWheelSpins?: number;
  dailyCrystalWheelSpins?: number;
  dailyWheelSpinsDate?: string;
  dailyCrystalToGoldCount?: number;
  dailyCrystalToGoldDate?: string;
  dailyGoldToCrystalCount?: number;
  dailyGoldToCrystalDate?: number | string;
  totalGoldCollected?: number;
  claimedMailGiftIds?: string[];
  dailyLoginDay?: number;
  dailyLoginLastDate?: string;
  lastSeen?: number;
  last_seen?: number;
  lastLoginDate?: string;
  ownedSkinIds?: string[];
  ownedSkinExpirations?: Record<string, number>;
  ownedSkins?: CharacterSkinTemplate[];
  activeSkinId?: string | null;
  banInfo?: PlayerBanInfo | null;
  killerLicenseUntil?: number;
  killerLicenses?: number;
  stunUntil?: number;
  npcCompanion?: NpcCompanionState;
  gamblingSpentGold?: number;
  gamblingWonGold?: number;
  gamblingSpentCrystals?: number;
  gamblingWonCrystals?: number;
  gamblingGamesPlayed?: number;
  bossesKilled?: number;
  claimedAchievementIds?: string[];
  portTravel?: PortTravelState;
  activeTransportId?: string | null;
}

export interface NpcLogEntry {
  id: string;
  time: string;
  text: string;
  type: 'kill' | 'step' | 'death' | 'energy' | 'loot';
}

export interface NpcNotificationEntry {
  id: string;
  timestamp: number;
  time: string;
  reason: 'low_energy' | 'expired' | 'bag_full' | 'recharged' | 'system';
  title: string;
  message: string;
  read?: boolean;
}

export interface NpcTemplate {
  id: string;
  name: string;
  icon: string;
  minLevel?: number;
  priceCrystals: number;
  baseEnergy: number;
  baseHp: number;
  baseDmg: number;
  rewardMultiplier: number;
  bagCapacity: number;
  energyPerAttack: number;
  regenIntervalSec: number;
  description: string;
  enabled: boolean;
}

export interface NpcCompanionState {
  unlocked: boolean;
  isActive: boolean;
  name?: string;
  icon?: string;
  templateId?: string;
  energy: number;
  maxEnergy: number;
  hp: number;
  maxHp: number;
  damage: number;
  tier: number;
  row: number;
  col: number;
  lastActionTime: number;
  lastRegenTime: number;
  bagGold: number;
  bagExp: number;
  mobsKilled: number;
  mobsInBag?: number;
  bagCapacity?: number;
  ownerNick?: string;
  lastBagWarningTime?: number;
  lastToggledAt?: number;
  expiresAt?: number;
  forcedDisableReason?: 'low_energy' | 'expired' | 'global_disabled' | null;
  forcedDisabledAt?: number;
  pushNotificationsEnabled?: boolean;
  notifications?: NpcNotificationEntry[];
  logs?: NpcLogEntry[];
}

export interface WheelWinnerEntry {
  id: string;
  nick: string;
  isPremium?: boolean;
  prizeName: string;
  prizeIcon: string;
  quality: ItemQualityKey;
  prizeQuality?: ItemQualityKey;
  timestamp: number;
  timeStr: string;
}

export interface MailGiftAttachment {
  gold?: number;
  crystals?: number;
  exp?: number;
  statPoints?: number;
  hpPotions?: number;
  enPotions?: number;
  expPotions?: number;
  energy?: number;
  premiumDays?: number;
  wheelSpins?: number;
  vipHours?: number;
  item?: GameItem;
  claimed?: boolean;
}

export interface PrivateMessage {
  id?: string;
  from: string;
  to: string;
  text: string;
  time: number | string;
  timestamp?: number;
  timeStr?: string;
  read?: boolean;
  gift?: MailGiftAttachment;
  giftClaimed?: boolean;
  giftClaimedAt?: number;
}

export interface CrystalOrder {
  id: string;
  playerNick: string;
  playerLevel: number;
  playerClan?: string;
  playerAvatar?: string;
  telegramContact: string;
  crystals: number;
  bonusCrystals?: number;
  priceUsd: number;
  status: 'pending' | 'completed' | 'rejected';
  createdAt: number;
  completedAt?: number;
  adminNote?: string;
  completedBy?: string;
}

export interface CombatLogEntry {
  id: string;
  time: string;
  text: string;
  type: 'hit' | 'kill' | 'potion' | 'loot' | 'pvp' | 'damage_taken' | 'crit' | 'miss';
  damageType?: 'normal' | 'crit' | 'miss';
}

export interface LootHistoryEntry {
  id: string;
  timestamp: number;
  timeStr: string;
  category: 'monster' | 'chest';
  title: string;
  icon: string;
  lvl?: number;
  isBoss?: boolean;
  location?: string;
  gold?: number;
  crystals?: number;
  exp?: number;
  potionDrop?: 'hp' | 'en' | 'exp' | null;
  itemName?: string;
}

export type DailyQuestType =
  | 'kill_mobs'
  | 'collect_gold'
  | 'pyramid_steps'
  | 'boss_or_scarab';

export interface DailyQuest {
  id: string;
  type: DailyQuestType;
  title?: string;
  description?: string;
  icon?: string;
  target: number;
  progress: number;
  reward: number; // crystals in chest
  rewardGold?: number; // bonus gold in chest
  rewardExpPotions?: number;
  chestName?: string;
  isCompleted: boolean;
  isClaimed: boolean;
}

export type EquippedGear = Record<ItemSlot, GameItem | null>;

export interface MarketLot {
  id: string;
  item: GameItem;
  seller: string;
  start: number;
  buyout: number;
  currentBid: number;
  highestBidder?: string;
  createdAt: number;
}

export interface TradeProtocolEntry {
  id: string;
  timestamp: number;
  dateStr: string;
  type: 'transfer_out' | 'transfer_in' | 'rent_out' | 'rent_return' | 'auction_list' | 'auction_sell' | 'auction_buy' | 'gold_transfer' | 'purchase' | 'referral_bonus' | 'forge' | 'altar_modify' | 'clan_deposit' | 'clan_rent' | 'clan_return' | 'clan_recall';
  description: string;
  itemId?: string;
  reclaimed?: boolean;
  itemSnapshot?: {
    name: string;
    icon: string;
    quality: ItemQualityKey;
  };
  targetNick?: string;
  amount?: number;
}

export interface ChatMessage {
  id: string;
  time: string;
  timestamp?: number;
  author: string;
  authorRole?: 'admin' | 'mod' | 'winner' | 'regular';
  text: string;
  isSystem?: boolean;
  isRareLoot?: boolean;
  channel: 'world' | 'general';
}

export interface FriendEntry {
  nick: string;
  lvl: number;
  isOnline: boolean;
  avatar: string;
  lastSeen?: number;
}

export interface RareBossTimerState {
  id: 'crystal';
  name: string;
  intervalMs: number;
  remainingMs: number;
  targetSpawnAt?: number;
  isFrozenWaitingForCell: boolean;
  isAliveOnMap: boolean;
  lastTickAt: number;
}

export interface PyramidCell {
  type: 'empty' | 'mob' | 'exit' | 'portal' | 'nextTier' | 'sack' | 'player';
  mobName?: string;
  mobLvl?: number;
  mobHp?: number;
  mobMaxHp?: number;
  mobDmg?: number;
  isBoss?: boolean;
  rareBossId?: 'crystal';
  icon?: string;
  sackGold?: number;
  sackCrystals?: number;
  playerNick?: string;
  playerLvl?: number;
  playerHp?: number;
  playerMaxHp?: number;
  playerAvatar?: string;
  playerIsOnline?: boolean;
  goldReward?: number;
  crystalReward?: number;
  expReward?: number;
  clanExpReward?: number;
  influenceReward?: number;
  mobGoldReward?: number;
  mobCrystalReward?: number;
  mobExpReward?: number;
  mobClanExpReward?: number;
  mobInfluenceReward?: number;
}

export interface LeaderboardEntry {
  id?: string;
  nick: string;
  lvl: number;
  avatar: string;
  isPremium?: boolean;
  role?: 'admin' | 'mod' | 'winner' | 'regular';
  is_admin?: number;
  mobsKilled: number;
  totalGoldCollected: number;
  pvpKills?: number;
  location?: string;
  isOnline?: boolean;
}

export interface PlayerPosition {
  row: number;
  col: number;
}

export interface DamagePopup {
  id: string;
  row: number;
  col: number;
  amount: number;
  type: 'player' | 'mob';
  timestamp: number;
}

export interface GameSaveData {
  version: number;
  hero: HeroState;
  equipped: EquippedGear;
  inventory: GameItem[];
  market: MarketLot[];
  tradeProtocol: TradeProtocolEntry[];
  friends: FriendEntry[];
  pyramidMap: PyramidCell[][];
  playerPos: PlayerPosition;
  savedMapTier: number | null;
  // Ranking/Social persistence
  weeklyStats: {
    mobsKilled: number;
    pvpKills: number;
    itemsSold: number;
  };
  privateMessages: PrivateMessage[];
}
