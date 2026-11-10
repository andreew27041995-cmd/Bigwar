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
  dmg?: number;
  hp?: number;
  str?: number;
  agi?: number;
  vit?: number;
  dodgeBonus?: number;
  energyBonus?: number;
  goldBonusPct?: number;
  expBonusPct?: number;
  isTemporary?: boolean;
  durationDays?: number;
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
  // Fishing & Pyramid Halls (200-500+ players scaling)
  fishingConfig?: any;
  battlePassConfig?: any;
  maxPlayersPerPyramidHall?: number; // Default 25 players per Pyramid Hall
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
  ownerNick?: string;
  // Clan Storage, Rental & Clan Forge Fields
  clanStorageId?: string;
  isClanRented?: boolean;
  isClanCreated?: boolean;
  clanOwnerId?: string;
  clanOwnerName?: string;
  clanOwnerTag?: string;
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
  // Temporary / Permanent Duration Fields
  isTemporary?: boolean;
  durationDays?: number;
  expiresAt?: number;
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
  hasClanBadge?: boolean;
  badgeIssuedAt?: number;
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
  | 'transfer_leader'
  | 'achievement_unlocked'
  | 'deposit_gold'
  | 'deposit_crystals'
  | 'deposit_item'
  | 'deposit_elixir'
  | 'forge_clan_item'
  | 'rent_item'
  | 'return_item'
  | 'recall_item'
  | 'take_elixir'
  | 'pyramid_income'
  | 'declare_war'
  | 'capture_territory'
  | 'raid_boss_kill'
  | 'clan_quest_claim'
  | 'arena_victory'
  | 'rename_nick'
  | 'issue_clan_badge'
  | 'port_production';

export interface ClanLogEntry {
  id: string;
  timestamp: number;
  timeStr: string;
  actorNick: string;
  type: ClanLogType;
  text: string;
  icon?: string;
}

export interface ClanAchievementsProgress {
  monstersKilled: number;
  goldContributed: number;
  crystalsContributed: number;
  itemsForgedOrDeposited: number;
  influenceEarned: number;
  totalExpEarned: number;
  unlockedAchievementIds?: string[];
}

export type ClanTerritoryBonusType =
  | 'slots_luck'
  | 'fishing_gold'
  | 'pyramid_gold'
  | 'combat_dmg'
  | 'pyramid_exp'
  | 'max_hp';

export type TerritoryFighterRole = 'tank' | 'dps' | 'support';

export type TerritoryTacticalAction = 'defense' | 'frontal' | 'focus';

export interface ClanTerritory7x7Fighter {
  nick: string;
  avatar: string;
  lvl: number;
  clanId: string;
  clanName: string;
  clanTag: string;
  clanEmblem: string;
  side: 'attacker' | 'defender';
  slotIndex?: number;
  role: TerritoryFighterRole;
  tactic: TerritoryTacticalAction;
  hp: number;
  maxHp: number;
  dmg: number;
  dodgePct: number;
  powerScore: number;
  hasClanGear: boolean;
  hasClanTransport: boolean;
  alive: boolean;
  actedInRound?: number;
  shieldActiveInRound?: number;
  isBot?: boolean;
  joinedAt: number;
}

export interface ClanTerritory7x7RoundLog {
  roundNumber: number;
  timestamp: number;
  events: string[];
  attackersAlive: number;
  defendersAlive: number;
}

export interface ClanTerritory7x7BattleState {
  phase: 'gathering' | 'combat' | 'finished';
  gatheringStartedAt: number;
  gatheringEndsAt: number;
  currentRound: number;
  maxRounds: number;
  roundStartedAt: number;
  roundEndsAt: number;
  attackers: ClanTerritory7x7Fighter[];
  defenders: ClanTerritory7x7Fighter[];
  waitingQueueAttackers?: string[];
  waitingQueueDefenders?: string[];
  roundLogs: ClanTerritory7x7RoundLog[];
  winnerSide?: 'attacker' | 'defender';
  winnerClanId?: string | null;
  winnerClanName?: string | null;
  winnerClanTag?: string | null;
  winnerClanEmblem?: string | null;
  summaryText?: string;
}

export interface ClanTerritoryWarScoreEntry {
  clanId: string;
  clanName: string;
  clanTag: string;
  clanEmblem: string;
  points: number;
}

export interface PortFactoryWorkerSession {
  nick: string;
  avatar?: string;
  startedAt: number;
  endsAt: number;
  durationHours: 1 | 2;
  goldPerHour: number;
  claimed?: boolean;
}

export interface PortProductionState {
  factoryType: string;
  factoryCategoryLabel: string;
  isMerged?: boolean;
  mergedWithSectorId?: string | null;
  fishStock: number;
  maxFishStock: number;
  relicStock: number;
  maxRelicStock: number;
  lastCraftTickAt: number;
  workers: PortFactoryWorkerSession[];
  passiveGoldEarned?: number;
  totalRelicsCrafted?: number;
}

export interface ClanTerritorySector {
  id: string;
  name: string;
  icon: string;
  description: string;
  zone?: 'port';
  ownerClanId: string | null;
  ownerClanName: string | null;
  ownerClanTag: string | null;
  ownerClanEmblem: string | null;
  ownerClanColor?: string | null;
  capturedAt?: number;
  protectionUntil?: number;
  bonusType: ClanTerritoryBonusType;
  bonusValue: number;
  bonusLabel: string;
  warStatus: 'peace' | 'war';
  warStartedAt?: number;
  warEndsAt?: number;
  attackerClanId?: string | null;
  attackerClanName?: string | null;
  attackerClanTag?: string | null;
  attackerClanEmblem?: string | null;
  warScores?: Record<string, ClanTerritoryWarScoreEntry>;
  battle7x7?: ClanTerritory7x7BattleState | null;
  lastBattleReport?: ClanTerritory7x7BattleState | null;
  production?: PortProductionState;
}

export interface ClanRaidBossParticipant {
  nick: string;
  avatar?: string;
  damageDealt: number;
  attacksCount: number;
  rewardClaimed: boolean;
}

export interface ClanRaidBossState {
  clanId: string;
  bossId: string;
  bossName: string;
  bossIcon: string;
  bossDescription: string;
  bossLevel: number;
  currentHp: number;
  maxHp: number;
  resetDate: string;
  isDefeated: boolean;
  defeatedAt?: number;
  rewardGold: number;
  rewardCrystals: number;
  rewardChestName: string;
  participants: Record<string, ClanRaidBossParticipant>;
}

export type ClanQuestActionType = 'fish' | 'spin' | 'donate_gold' | 'kill_mob';

export interface ClanDailyQuestEntry {
  questId: string;
  title: string;
  description: string;
  icon: string;
  actionType: ClanQuestActionType;
  currentProgress: number;
  targetValue: number;
  unitLabel: string;
  status: 'in_progress' | 'completed' | 'claimed';
  rewardTreasuryGold: number;
  rewardTreasuryCrystals: number;
  rewardPlayerGold: number;
  rewardPlayerCrystals: number;
  chestName: string;
  treasuryRewardClaimed?: boolean;
  claimedByNicks?: string[];
  contributions?: Record<string, number>;
}

export interface ClanQuestsState {
  resetDate: string;
  quests: ClanDailyQuestEntry[];
}

export interface ClanArenaFighter {
  nick: string;
  avatar: string;
  lvl: number;
  clanId: string;
  clanName: string;
  clanTag: string;
  clanEmblem: string;
  powerScore: number;
  dmg: number;
  maxHp: number;
  dodgePct: number;
  hasClanGear: boolean;
  hasClanTransport: boolean;
  arenaPoints: number;
  wins: number;
  losses: number;
  championTitle?: string | null;
  registeredAt: number;
}

export interface ClanArenaMatchLog {
  id: string;
  timestamp: number;
  timeStr: string;
  roundLabel: string;
  fighter1Nick: string;
  fighter1ClanTag: string;
  fighter2Nick: string;
  fighter2ClanTag: string;
  winnerNick: string;
  winnerClanId: string;
  winnerClanTag: string;
  winProbabilityPct: number;
  pointsAwarded: number;
  prestigeAwarded: number;
  titleAwarded?: string;
  combatRounds: string[];
}

export interface ClanArenaPlayoffMatch {
  id: string;
  stage: 'quarter' | 'semi' | 'final';
  stageLabel: string;
  matchIndex: number;
  fighter1: ClanArenaFighter | null;
  fighter2: ClanArenaFighter | null;
  winnerNick?: string | null;
  winnerClanTag?: string | null;
  status: 'pending' | 'ready' | 'completed';
  matchLog?: ClanArenaMatchLog | null;
}

export interface ClanArenaTournamentState {
  seasonId: string;
  nextTournamentAt: number;
  fighters: ClanArenaFighter[];
  matchHistory: ClanArenaMatchLog[];
  clanPrestigeScores: Record<string, number>;
  playoffBracket?: ClanArenaPlayoffMatch[];
  tournamentChampionNick?: string | null;
  tournamentChampionClanTag?: string | null;
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
  prestigePoints?: number;
  treasuryGold: number;
  treasuryCrystals: number;
  pyramidTaxGoldPct?: number;
  pyramidTaxCrystalPct?: number;
  achievementsProgress?: ClanAchievementsProgress;
  raidBoss?: ClanRaidBossState;
  clanQuests?: ClanQuestsState;
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
  is_admin?: number;
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
  fishingState?: any;
  fishingExpBuffUntil?: number;
  fishingExpBuffPct?: number;
  pyramidHall?: number;
  battlePass?: any;
  seasonTitleId?: 'sand_explorer' | 'season_pharaoh' | null;
  seasonTitleName?: string | null;
  seasonTitleUntil?: number;
  seasonTitleBonusPct?: number;
  lastNameChangeDate?: number;
  arenaChampionTitle?: string | null;
  arenaPoints?: number;
  productionHours?: number;
  productionLevel?: number;
  hasClanBadge?: boolean;
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
  isPurchased?: boolean;
  isActiveInPyramid?: boolean;
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
  items?: GameItem[];
  relicsCount?: number;
  relicClass?: number;
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
  noReply?: boolean;
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
  | 'boss_or_scarab'
  | 'catch_fish';

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
  targetFishId?: string;
  targetFishName?: string;
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
  fishCaught?: number;
  weeklyFishCaught?: number;
  weeklyFishWeightKg?: number;
  weeklyMaxFishWeightKg?: number;
  totalFishWeightKg?: number;
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
