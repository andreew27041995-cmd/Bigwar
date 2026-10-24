import React, { useState, useEffect, useCallback } from 'react';
import {
  HeroState,
  ChatMessage,
  PrivateMessage,
  MailGiftAttachment,
  ItemSlot,
  ItemQualityKey,
  EquippedGear,
  GameItem
} from '../../types/game';
import {
  RealtimePlayer,
  adminModifyPlayerBalanceInSupabase,
  findPlayerInSupabase,
  unpackPlayerRow,
  fetchAllPlayersFromDatabase,
  sendMailInSupabase,
  recalculateAllPlayersByExpTableInSupabase,
  fetchPyramidTierFromSupabase
} from '../../utils/supabase';
import {
  EXP_TABLE,
  MAX_LEVEL,
  generateItem,
  SLOT_INFO,
  getQualityConfig,
  getPyramidTierForLevel,
  normalizeStatsForLevel,
  getHeroMaxHpFromVit,
  sanitizePyramidCellsForStorage
} from '../../utils/gameData';
import {
  MonsterConfig,
  DEFAULT_MONSTERS,
  getMonsterConfigs,
  syncMonsterConfigsFromSupabase,
  saveMonsterConfigs
} from '../../utils/monsterConfig';
import {
  DEFAULT_SHOP_CATALOG,
  DEFAULT_CHARACTER_SKINS,
  getShopCatalog,
  getShopSkins,
  getGameFeatureFlags,
  saveShopAndFeaturesToSupabase,
  syncShopAndFeaturesFromSupabase,
  SHOP_CATEGORY_LABELS,
  resolvePlayerOwnedSkins,
  deleteSkinFromCatalog,
  DEFAULT_BANK_PACKAGES,
  getBankPackages,
  PERSONAL_SKIN_DEFAULT_SPRITE_DATA_URL
} from '../../utils/shopConfig';
import { ShopItemTemplate, GameFeatureFlags, CharacterSkinTemplate, PlayerBanInfo, BankPackageConfig } from '../../types/game';
import CharacterAvatar from '../CharacterAvatar';
import { ItemIcon } from '../ItemIcon';
import {
  GAME_ITEM_IMAGE_SPEC,
  CHARACTER_SKIN_IMAGE_SPEC,
  processUploadedItemImage,
  processUploadedClanEmblem,
  processUploadedCharacterSkin
} from '../../utils/imageUpload';
import {
  getAllClans,
  getClanById,
  createClan,
  updateClanInfo,
  disbandClan,
  kickClanMember,
  recallItemByOriginalOwner,
  adminSetClanPyramidOwner,
  getClanPyramidState,
  MAX_CLAN_LEVEL,
  CLAN_EXP_TABLE,
  getClanMaxStorageCapacity,
  adminUpdateClanPyramidConfig,
  adminSaveClanPyramidMonster,
  adminDeleteClanPyramidMonster,
  adminResetClanPyramidScores,
  adminAddOrUpdateClanMember,
  DEFAULT_CLAN_PYRAMID_CONFIG
} from '../../utils/clanStorage';
import { Clan, ClanStorageItem, ClanPyramidMonsterTemplate } from '../../types/game';
import {
  RoulettePrizeConfig,
  DEFAULT_ROULETTE_PRIZES,
  getRoulettePrizes,
  saveRoulettePrizesToSupabase,
  syncRoulettePrizesFromSupabase
} from '../../utils/rouletteConfig';

interface AdminModalProps {
  onClose: () => void;
  initialTab?: 'players' | 'bosses' | 'monsters' | 'shop' | 'creation' | 'server' | 'clans' | 'clanPyramid' | 'roulette' | 'bank';
  hero: HeroState;
  setHero: React.Dispatch<React.SetStateAction<HeroState>>;
  equipped?: EquippedGear;
  setEquipped?: React.Dispatch<React.SetStateAction<EquippedGear>>;
  inventory?: GameItem[];
  setInventory?: React.Dispatch<React.SetStateAction<GameItem[]>>;
  onlinePlayers: RealtimePlayer[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setPrivateMessages: React.Dispatch<React.SetStateAction<PrivateMessage[]>>;
  showToast: (text: string) => void;
  onForceSavePlayer?: (overrideHero?: HeroState) => void;
  onClearWorldChat?: () => void;
  onRefreshOnlinePlayers?: () => void;
  onBroadcastSystemMessage?: (text: string) => void;
  onSpawnPortal?: () => void;
  onResetMap?: () => void;
  onSpawnBossesInAllPyramids?: () => void;
  onShopAndFeaturesUpdated?: (
    catalog: ShopItemTemplate[],
    flags: GameFeatureFlags,
    skins?: CharacterSkinTemplate[]
  ) => void;
}

const ALL_SLOTS: ItemSlot[] = ['weapon', 'armor', 'pants', 'boots', 'gloves', 'ring'];
const QUICK_MOB_ICONS = ['🦂', '🪲', '🐍', '🧟', '🐺', '🐊', '🦅', '🗿', '⚱️', '💀', '🔥', '👁️', '👑', '🐉', '👹', '🕷️'];

export const AdminModal: React.FC<AdminModalProps> = ({
  onClose,
  initialTab = 'players',
  hero,
  setHero,
  equipped: selfEquipped,
  setEquipped: setSelfEquipped,
  inventory: selfInventory,
  setInventory: setSelfInventory,
  onlinePlayers,
  setChatMessages,
  setPrivateMessages,
  showToast,
  onForceSavePlayer,
  onClearWorldChat,
  onRefreshOnlinePlayers,
  onBroadcastSystemMessage,
  onSpawnPortal,
  onResetMap,
  onSpawnBossesInAllPyramids,
  onShopAndFeaturesUpdated
}) => {
  const [activeTab, setActiveTab] = useState<
    'players' | 'bosses' | 'monsters' | 'shop' | 'creation' | 'server' | 'clans' | 'clanPyramid' | 'roulette' | 'bank'
  >(initialTab);
  const [adminClans, setAdminClans] = useState<Clan[]>(() => getAllClans());
  const [selectedAdminClan, setSelectedAdminClan] = useState<Clan | null>(null);
  const [editClanName, setEditClanName] = useState('');
  const [editClanTag, setEditClanTag] = useState('');
  const [editClanDescription, setEditClanDescription] = useState('');
  const [editClanEmblem, setEditClanEmblem] = useState('');
  const [editClanLevel, setEditClanLevel] = useState(1);
  const [editClanExp, setEditClanExp] = useState(0);
  const [editClanInfluence, setEditClanInfluence] = useState(0);
  const [editClanMaxStorage, setEditClanMaxStorage] = useState<string>('');
  const [editClanElixirHp, setEditClanElixirHp] = useState(0);
  const [editClanElixirEn, setEditClanElixirEn] = useState(0);
  const [editClanElixirExp, setEditClanElixirExp] = useState(0);
  const [editClanLeader, setEditClanLeader] = useState('');
  const [newClanMemberNick, setNewClanMemberNick] = useState('');
  const [newClanMemberRole, setNewClanMemberRole] = useState<'leader' | 'officer' | 'member'>('member');

  // Admin Create New Clan form
  const [adminNewClanName, setAdminNewClanName] = useState('');
  const [adminNewClanTag, setAdminNewClanTag] = useState('');
  const [adminNewClanLeader, setAdminNewClanLeader] = useState(hero.nick || '');

  // Clan Pyramid Config State
  const [adminPyramidState, setAdminPyramidState] = useState(() => getClanPyramidState());
  const [cpTitle, setCpTitle] = useState(() => getClanPyramidState().config?.title || DEFAULT_CLAN_PYRAMID_CONFIG.title);
  const [cpGoldBonus, setCpGoldBonus] = useState(() => getClanPyramidState().config?.goldBonusPct ?? 15);
  const [cpExpBonus, setCpExpBonus] = useState(() => getClanPyramidState().config?.expBonusPct ?? 15);
  const [cpDmgBonus, setCpDmgBonus] = useState(() => getClanPyramidState().config?.dmgBonusPct ?? 5);
  const [cpHpBonus, setCpHpBonus] = useState(() => getClanPyramidState().config?.hpBonusPct ?? 10);
  const [cpEnergyPerMove, setCpEnergyPerMove] = useState(() => getClanPyramidState().config?.energyPerMove ?? 2);
  const [cpRespawnSec, setCpRespawnSec] = useState(() => getClanPyramidState().config?.respawnIntervalSec ?? 60);
  const [cpMinClanLvl, setCpMinClanLvl] = useState(() => getClanPyramidState().config?.minClanLevel ?? 1);

  // New Clan Pyramid Monster form
  const [newCpMobName, setNewCpMobName] = useState('');
  const [newCpMobIcon, setNewCpMobIcon] = useState('🦂');
  const [newCpMobLvl, setNewCpMobLvl] = useState(5);
  const [newCpMobHp, setNewCpMobHp] = useState(350);
  const [newCpMobDmg, setNewCpMobDmg] = useState(30);
  const [newCpMobInf, setNewCpMobInf] = useState(25);
  const [newCpMobClanExp, setNewCpMobClanExp] = useState(40);
  const [newCpMobExp, setNewCpMobExp] = useState(30);
  const [newCpMobGold, setNewCpMobGold] = useState(80);
  const [newCpMobCrystals, setNewCpMobCrystals] = useState(1);
  const [newCpMobSpawnCount, setNewCpMobSpawnCount] = useState(6);
  const [newCpMobIsBoss, setNewCpMobIsBoss] = useState(false);

  const [livePyramidBosses, setLivePyramidBosses] = useState<
    Record<number, { count: number; bosses: { name: string; hp: number; maxHp: number; row: number; col: number; lvl: number }[]; lastRespawn: number }>
  >({});
  const [isLoadingLiveBosses, setIsLoadingLiveBosses] = useState(false);

  const refreshLivePyramidBosses = useCallback(async () => {
    setIsLoadingLiveBosses(true);
    try {
      const [t1, t2, t3] = await Promise.all([
        fetchPyramidTierFromSupabase(1),
        fetchPyramidTierFromSupabase(2),
        fetchPyramidTierFromSupabase(3)
      ]);
      const nextMap: Record<number, { count: number; bosses: { name: string; hp: number; maxHp: number; row: number; col: number; lvl: number }[]; lastRespawn: number }> = {};
      [
        { tier: 1, data: t1 },
        { tier: 2, data: t2 },
        { tier: 3, data: t3 }
      ].forEach(({ tier, data }) => {
        const found: { name: string; hp: number; maxHp: number; row: number; col: number; lvl: number }[] = [];
        if (data && Array.isArray(data.cells)) {
          const cleanCells = sanitizePyramidCellsForStorage(data.cells);
          cleanCells.forEach((rowArr, rIdx) => {
            if (!Array.isArray(rowArr)) return;
            rowArr.forEach((cell, cIdx) => {
              if (cell && cell.type === 'mob' && cell.isBoss && rIdx === 0 && cIdx === 0) {
                found.push({
                  name: cell.mobName || `Босс Пирамиды ${tier}`,
                  hp: Number(cell.mobHp ?? cell.mobMaxHp ?? 100),
                  maxHp: Number(cell.mobMaxHp ?? cell.mobHp ?? 100),
                  row: rIdx,
                  col: cIdx,
                  lvl: Number(cell.mobLvl ?? (tier === 1 ? 5 : tier === 2 ? 10 : 20))
                });
              }
            });
          });
        }
        nextMap[tier] = {
          count: found.length,
          bosses: found,
          lastRespawn: Number(data?.lastRespawn || 0)
        };
      });
      setLivePyramidBosses(nextMap);
    } catch (e) {
      console.warn('Error loading live pyramid bosses:', e);
    } finally {
      setIsLoadingLiveBosses(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'bosses' || activeTab === 'monsters') {
      refreshLivePyramidBosses();
    }
  }, [activeTab, refreshLivePyramidBosses]);

  // ==================== PLAYERS TAB STATE ====================
  const [dbPlayers, setDbPlayers] = useState<any[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [targetPlayerNick, setTargetPlayerNick] = useState(hero.nick || '');
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<any | null>(null);
  const [isUpdatingDb, setIsUpdatingDb] = useState(false);

  // Editable fields for the selected character
  const [editLevelValue, setEditLevelValue] = useState(String(hero.level ?? 1));
  const [editExpValue, setEditExpValue] = useState(String(hero.exp ?? 0));
  const [editGoldAmount, setEditGoldAmount] = useState(String(hero.gold ?? 0));
  const [editCrystalsAmount, setEditCrystalsAmount] = useState(String(hero.crystals ?? 0));
  const [editHpValue, setEditHpValue] = useState(String(hero.hp ?? 100));
  const [editMaxHpValue, setEditMaxHpValue] = useState(String(hero.maxHp ?? 100));
  const [editEnergyValue, setEditEnergyValue] = useState(String(hero.energy ?? 100));
  const [editMaxEnergyValue, setEditMaxEnergyValue] = useState(String(hero.maxEnergy ?? 100));
  const [editStatPointsValue, setEditStatPointsValue] = useState(String(hero.statPoints ?? 0));
  const [editStrValue, setEditStrValue] = useState(String(hero.str ?? 5));
  const [editAgiValue, setEditAgiValue] = useState(String(hero.agi ?? 5));
  const [editVitValue, setEditVitValue] = useState(String(hero.vit ?? 5));
  const [editHpPotionsValue, setEditHpPotionsValue] = useState(String(hero.hpPotions ?? 3));
  const [editEnPotionsValue, setEditEnPotionsValue] = useState(String(hero.enPotions ?? 3));
  const [editBagCapValue, setEditBagCapValue] = useState(String(hero.bagCapacity ?? 100));
  const [editMobsKilledValue, setEditMobsKilledValue] = useState(String(hero.mobsKilled ?? 0));
  const [editTotalGoldValue, setEditTotalGoldValue] = useState(String(hero.totalGoldCollected ?? hero.gold ?? 0));

  // Direct item grant to selected player's bag
  const [directItemSlot, setDirectItemSlot] = useState<ItemSlot>('weapon');
  const [directItemQuality, setDirectItemQuality] = useState<ItemQualityKey>('epic');
  const [directItemLvl, setDirectItemLvl] = useState('5');
  const [selectedShopItemToGrant, setSelectedShopItemToGrant] = useState<string>('shop_weapon_2_new');
  const [selectedSkinToGrant, setSelectedSkinToGrant] = useState<string>('');
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  //Additive bonus fields
  const [addGoldDelta, setAddGoldDelta] = useState('');
  const [addCrystalsDelta, setAddCrystalsDelta] = useState('');
  const [addExpDelta, setAddExpDelta] = useState('');

  // ==================== PLAYER BAN & RESTRICTION STATE ====================
  const [banIsPermanent, setBanIsPermanent] = useState(false);
  const [banDurationHours, setBanDurationHours] = useState('24');
  const [banReason, setBanReason] = useState('Нарушение правил игры');
  const [banBlockFullAccess, setBanBlockFullAccess] = useState(false);
  const [banBlockPyramid, setBanBlockPyramid] = useState(false);
  const [banBlockClanPyramid, setBanBlockClanPyramid] = useState(false);
  const [banBlockChat, setBanBlockChat] = useState(false);
  const [banBlockTradeAndAuction, setBanBlockTradeAndAuction] = useState(false);
  const [banBlockClans, setBanBlockClans] = useState(false);
  const [banBlockRoulette, setBanBlockRoulette] = useState(false);
  const [banExpPenaltyPct, setBanExpPenaltyPct] = useState('0');
  const [banGoldPenaltyPct, setBanGoldPenaltyPct] = useState('0');

  // ==================== MONSTERS TAB STATE ====================
  const [monsters, setMonsters] = useState<MonsterConfig[]>(() => getMonsterConfigs());
  const [monsterTierFilter, setMonsterTierFilter] = useState<'all' | 1 | 2 | 3 | 'rare'>('all');
  const [isSavingMonsters, setIsSavingMonsters] = useState(false);

  // Create new monster state
  const [newMobName, setNewMobName] = useState('');
  const [newMobIcon, setNewMobIcon] = useState('🧟');
  const [newMobTier, setNewMobTier] = useState<1 | 2 | 3>(1);
  const [newMobRowLimit, setNewMobRowLimit] = useState<'any' | 'front' | 'mid' | 'boss'>('any');
  const [newMobLvl, setNewMobLvl] = useState('2');
  const [newMobHp, setNewMobHp] = useState('100');
  const [newMobDmg, setNewMobDmg] = useState('20');
  const [newMobSpawnWeight, setNewMobSpawnWeight] = useState('80');
  const [newMobDropChance, setNewMobDropChance] = useState('20');
  const [newMobGoldMin, setNewMobGoldMin] = useState('6');
  const [newMobGoldMax, setNewMobGoldMax] = useState('6');
  const [newMobExp, setNewMobExp] = useState('5');
  const [newMobCrystals, setNewMobCrystals] = useState('0');

  // ==================== SHOP, SKINS & FEATURES TAB STATE ====================
  const [shopCatalog, setShopCatalog] = useState<ShopItemTemplate[]>(() => getShopCatalog());
  const [shopSkins, setShopSkins] = useState<CharacterSkinTemplate[]>(() => getShopSkins());
  const [featureFlags, setFeatureFlags] = useState<GameFeatureFlags>(() => getGameFeatureFlags());
  const [shopCategoryFilter, setShopCategoryFilter] = useState<'all' | ItemSlot>('all');
  const [isSavingShop, setIsSavingShop] = useState(false);

  // New Character Skin creation form
  const [newSkinName, setNewSkinName] = useState('');
  const [newSkinIcon, setNewSkinIcon] = useState('🤴');
  const [newSkinQuality, setNewSkinQuality] = useState<ItemQualityKey>('epic');
  const [newSkinLvl, setNewSkinLvl] = useState('1');
  const [newSkinCurrency, setNewSkinCurrency] = useState<'gold' | 'crystals'>('crystals');
  const [newSkinPriceGold, setNewSkinPriceGold] = useState('500');
  const [newSkinPriceCrystals, setNewSkinPriceCrystals] = useState('20');
  const [newSkinHp, setNewSkinHp] = useState('50');
  const [newSkinDmg, setNewSkinDmg] = useState('15');
  const [newSkinStr, setNewSkinStr] = useState('2');
  const [newSkinAgi, setNewSkinAgi] = useState('2');
  const [newSkinVit, setNewSkinVit] = useState('2');
  const [newSkinDodge, setNewSkinDodge] = useState('3');
  const [newSkinEnergy, setNewSkinEnergy] = useState('20');
  const [newSkinGoldPct, setNewSkinGoldPct] = useState('5');
  const [newSkinExpPct, setNewSkinExpPct] = useState('5');
  const [newSkinBag, setNewSkinBag] = useState('10');
  const [newSkinImgInfo, setNewSkinImgInfo] = useState('');
  const [newSkinDurationType, setNewSkinDurationType] = useState<'permanent' | 'temporary'>('permanent');
  const [newSkinDurationDays, setNewSkinDurationDays] = useState('7');
  const [newSkinIsExclusive, setNewSkinIsExclusive] = useState(false);

  // Send skin modal / state
  const [sendSkinModalTarget, setSendSkinModalTarget] = useState<CharacterSkinTemplate | null>(null);
  const [sendSkinRecipient, setSendSkinRecipient] = useState('');
  const [sendSkinDurationType, setSendSkinDurationType] = useState<'permanent' | 'temporary'>('permanent');
  const [sendSkinDurationDays, setSendSkinDurationDays] = useState('7');
  const [sendSkinAutoEquip, setSendSkinAutoEquip] = useState(true);

  // Roulette Tab State
  const [adminRoulettePrizes, setAdminRoulettePrizes] = useState<RoulettePrizeConfig[]>(() => getRoulettePrizes());
  const [isSavingRoulette, setIsSavingRoulette] = useState(false);
  const [newRpName, setNewRpName] = useState('');
  const [newRpIcon, setNewRpIcon] = useState('🪙');
  const [newRpType, setNewRpType] = useState<'gold' | 'crystals' | 'item' | 'skin' | 'jackpot'>('skin');
  const [newRpAmount, setNewRpAmount] = useState('100');
  const [newRpQuality, setNewRpQuality] = useState<ItemQualityKey>('legendary');
  const [newRpSkinId, setNewRpSkinId] = useState(shopSkins[0]?.id || '');
  const [newRpSkinDuration, setNewRpSkinDuration] = useState('0'); // 0 = forever, >0 = days
  const [newRpWeight, setNewRpWeight] = useState('5');

  // Bank Editor Tab State
  const [newBankPackCrystals, setNewBankPackCrystals] = useState('100');
  const [newBankPackPriceUsd, setNewBankPackPriceUsd] = useState('1');
  const [newBankPackBonus, setNewBankPackBonus] = useState('0');
  const [newBankPackLabel, setNewBankPackLabel] = useState('');
  const [adminBankTargetNick, setAdminBankTargetNick] = useState(hero.nick || '');
  const [adminBankGrantCrystals, setAdminBankGrantCrystals] = useState('100');

  // New shop item creation form
  const [newShopSlot, setNewShopSlot] = useState<ItemSlot>('weapon');
  const [newShopName, setNewShopName] = useState('');
  const [newShopIcon, setNewShopIcon] = useState('⚔️');
  const [newShopLvl, setNewShopLvl] = useState('2');
  const [newShopPrice, setNewShopPrice] = useState('30');
  const [newShopDurability, setNewShopDurability] = useState('10');
  const [newShopHp, setNewShopHp] = useState('20');
  const [newShopDmg, setNewShopDmg] = useState('10');
  const [newShopDodge, setNewShopDodge] = useState('0');
  const [newShopEnergy, setNewShopEnergy] = useState('0');
  const [newShopGoldPct, setNewShopGoldPct] = useState('0');
  const [newShopExpPct, setNewShopExpPct] = useState('0');
  const [newShopImgInfo, setNewShopImgInfo] = useState<string>('');

  // ==================== ADMIN ITEM EDITOR (EDIT ANY PLAYER ITEM / CUSTOM CREATED ITEM) ====================
  const [editingItemTarget, setEditingItemTarget] = useState<{
    source: 'equipped' | 'inventory';
    slotKey?: string;
    item: GameItem;
  } | null>(null);

  const handleUploadImageForNewShopItem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await processUploadedItemImage(file, 'cover');
    e.target.value = '';
    if ((!res.ok && !res.success) || !res.dataUrl) {
      showToast(res.error || 'Ошибка загрузки картинки');
      return;
    }
    const sizeKb = res.finalSizeKb ?? res.compressedSizeKb ?? 20;
    setNewShopIcon(res.dataUrl);
    setNewShopImgInfo(`${res.width}×${res.height}px → 128×128px (${sizeKb} КБ)`);
    showToast(`✅ Картинка загружена и заполнена в квадрат 128×128px (${sizeKb} КБ)!`);
  };

  const handleUploadImageForExistingShopItem = async (
    shopItemId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await processUploadedItemImage(file, 'cover');
    e.target.value = '';
    if ((!res.ok && !res.success) || !res.dataUrl) {
      showToast(res.error || 'Ошибка загрузки картинки');
      return;
    }
    const sizeKb = res.finalSizeKb ?? res.compressedSizeKb ?? 20;
    handleUpdateShopItemField(shopItemId, 'icon', res.dataUrl);
    showToast(`✅ Новая картинка 128×128px (${sizeKb} КБ) установлена! Не забудьте нажать «Сохранить».`);
  };

  const handleUploadImageForEditingPlayerItem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingItemTarget) return;
    const res = await processUploadedItemImage(file, 'cover');
    e.target.value = '';
    if ((!res.ok && !res.success) || !res.dataUrl) {
      showToast(res.error || 'Ошибка загрузки картинки');
      return;
    }
    const sizeKb = res.finalSizeKb ?? res.compressedSizeKb ?? 20;
    setEditingItemTarget({
      ...editingItemTarget,
      item: {
        ...editingItemTarget.item,
        icon: res.dataUrl
      }
    });
    showToast(`✅ Картинка предмета обновлена (128×128px, ${sizeKb} КБ)!`);
  };

  const handleSaveEditedPlayerItem = async () => {
    if (!editingItemTarget) return;
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) return;
    const updatedItem: GameItem = {
      ...editingItemTarget.item,
      name: editingItemTarget.item.name.trim() || 'Предмет',
      lvl: Math.max(1, Math.min(MAX_LEVEL, Number(editingItemTarget.item.lvl) || 1)),
      dmg: Math.max(0, Number(editingItemTarget.item.dmg) || 0),
      dmgBonus: Math.max(0, Number(editingItemTarget.item.dmg) || 0),
      hp: Math.max(0, Number(editingItemTarget.item.hp) || 0),
      hpBonus: Math.max(0, Number(editingItemTarget.item.hp) || 0),
      dodgeBonus: Math.max(0, Number(editingItemTarget.item.dodgeBonus) || 0),
      energyBonus: Math.max(0, Number(editingItemTarget.item.energyBonus) || 0),
      goldBonusPct: Math.max(0, Number(editingItemTarget.item.goldBonusPct) || 0),
      expBonusPct: Math.max(0, Number(editingItemTarget.item.expBonusPct) || 0),
      maxDurability: Math.max(1, Number(editingItemTarget.item.maxDurability) || 10),
      durability: Math.max(
        0,
        Math.min(
          Math.max(1, Number(editingItemTarget.item.maxDurability) || 10),
          Number(editingItemTarget.item.durability ?? editingItemTarget.item.maxDurability ?? 10)
        )
      )
    };

    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(
        nickToModify,
        editingItemTarget.source === 'equipped' && editingItemTarget.slotKey
          ? { updateEquippedItem: { slot: editingItemTarget.slotKey, item: updatedItem } }
          : { updateInventoryItem: updatedItem }
      );
      if (res.success) {
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        setEditingItemTarget(null);
        showToast(`✅ Предмет «${updatedItem.name}» у игрока ${nickToModify} успешно скорректирован!`);
      } else {
        showToast(`❌ Ошибка сохранения предмета: ${res.error || ''}`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleAdminGrantCustomCreatedItem = async (equipDirectly: boolean) => {
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) {
      showToast('Выберите персонажа!');
      return;
    }
    const cleanName = newShopName.trim() || `Оружие Фараона (${SHOP_CATEGORY_LABELS[newShopSlot]})`;
    const maxDur = Math.max(1, parseInt(newShopDurability, 10) || 100);
    const customItem: GameItem = {
      id: `admin_custom_${newShopSlot}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      slot: newShopSlot,
      icon: newShopIcon || '⚔️',
      quality: 'custom',
      lvl: Math.max(1, Math.min(MAX_LEVEL, parseInt(newShopLvl, 10) || 1)),
      price: Math.max(1, parseInt(newShopPrice, 10) || 100),
      durability: maxDur,
      maxDurability: maxDur,
      initialMaxDurability: maxDur,
      hp: Math.max(0, parseInt(newShopHp, 10) || 0),
      hpBonus: Math.max(0, parseInt(newShopHp, 10) || 0),
      dmg: Math.max(0, parseInt(newShopDmg, 10) || 0),
      dmgBonus: Math.max(0, parseInt(newShopDmg, 10) || 0),
      dodgeBonus: Math.max(0, parseInt(newShopDodge, 10) || 0),
      energyBonus: Math.max(0, parseInt(newShopEnergy, 10) || 0),
      goldBonusPct: Math.max(0, parseInt(newShopGoldPct, 10) || 0),
      expBonusPct: Math.max(0, parseInt(newShopExpPct, 10) || 0),
      isCustomCreated: true,
      transferable: true,
      creatorNick: hero.nick || 'Админ',
      origin: 'Создано Администратором'
    };

    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(
        nickToModify,
        equipDirectly
          ? { equipItemToSlot: { slot: newShopSlot, item: customItem } }
          : { addInventoryItem: customItem }
      );
      if (res.success) {
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        showToast(
          equipDirectly
            ? `⚡ Предмет «${customItem.name}» создан и сразу надет на ${nickToModify}!`
            : `🎒 Предмет «${customItem.name}» создан и выдан в сумку ${nickToModify}!`
        );
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  // ==================== SERVER / MAIL TAB STATE ====================
  const [broadcastText, setBroadcastText] = useState('');
  const [giftNick, setGiftNick] = useState(hero.nick || '');
  const [giftMessageText, setGiftMessageText] = useState(
    '🎁 Подарок от Администрации! Нажмите кнопку «Забрать подарок», чтобы зачислить награду.'
  );
  const [giftGold, setGiftGold] = useState('1000');
  const [giftCrystals, setGiftCrystals] = useState('10');
  const [giftHpPotions, setGiftHpPotions] = useState('0');
  const [giftEnPotions, setGiftEnPotions] = useState('0');
  const [giftEnergy, setGiftEnergy] = useState('0');
  const [giftStatPoints, setGiftStatPoints] = useState('0');
  const [giftExp, setGiftExp] = useState('0');
  const [giftPremiumDays, setGiftPremiumDays] = useState('0');
  const [giftIncludeItem, setGiftIncludeItem] = useState(false);
  const [giftItemSlot, setGiftItemSlot] = useState<ItemSlot>('weapon');
  const [giftItemQuality, setGiftItemQuality] = useState<ItemQualityKey>('epic');
  const [giftItemLvl, setGiftItemLvl] = useState('5');

  const populateFieldsFromUnpacked = useCallback(
    (p: any, fallbackNick: string) => {
      const cleanNick = String(p.name || p.nick || fallbackNick).trim();
      const isSelf = cleanNick.toLowerCase() === (hero.nick || '').trim().toLowerCase();

      // Ensure equipped & inventory are always present and complete when viewing own or other profile
      const resolvedEquipped =
        p.equipped && Object.keys(p.equipped).length > 0
          ? p.equipped
          : isSelf && selfEquipped
          ? selfEquipped
          : p.equipped || {};

      const resolvedInventory =
        Array.isArray(p.inventory) && p.inventory.length > 0
          ? p.inventory
          : isSelf && Array.isArray(selfInventory)
          ? selfInventory
          : Array.isArray(p.inventory)
          ? p.inventory
          : [];

      const enriched = {
        ...p,
        name: cleanNick,
        nick: cleanNick,
        equipped: resolvedEquipped,
        inventory: resolvedInventory
      };

      setSelectedPlayerStats(enriched);
      setTargetPlayerNick(cleanNick);
      setGiftNick(cleanNick);

      setEditLevelValue(String(p.lvl ?? p.level ?? 1));
      setEditExpValue(String(p.exp ?? 0));
      setEditGoldAmount(String(p.gold ?? 0));
      setEditCrystalsAmount(String(p.crystals ?? 0));
      setEditHpValue(String(p.hp ?? 100));
      setEditMaxHpValue(String(p.max_hp ?? p.maxHp ?? 100));
      setEditEnergyValue(String(p.energy ?? 100));
      setEditMaxEnergyValue(String(p.max_energy ?? p.maxEnergy ?? 100));
      setEditStatPointsValue(String(p.stat_points ?? p.statPoints ?? 0));
      setEditStrValue(String(p.str ?? 5));
      setEditAgiValue(String(p.agi ?? 5));
      setEditVitValue(String(p.vit ?? 5));
      setEditHpPotionsValue(String(p.hp_potions ?? p.hpPotions ?? 3));
      setEditEnPotionsValue(String(p.en_potions ?? p.enPotions ?? 3));
      setEditBagCapValue(String(p.bag_capacity ?? p.bagCapacity ?? 100));
      setEditMobsKilledValue(String(p.mobs_killed ?? p.mobsKilled ?? p.mob_kills ?? 0));
      setEditTotalGoldValue(String(p.total_gold_collected ?? p.totalGoldCollected ?? p.gold ?? 0));

      const rawBan: PlayerBanInfo | null = p.banInfo ?? p.ban_info ?? null;
      if (rawBan && typeof rawBan === 'object') {
        setBanIsPermanent(Boolean(rawBan.isPermanent));
        const remHours =
          rawBan.bannedUntil && rawBan.bannedUntil > Date.now()
            ? Math.max(1, Math.ceil((rawBan.bannedUntil - Date.now()) / 3600000))
            : 24;
        setBanDurationHours(String(remHours));
        setBanReason(String(rawBan.reason || 'Нарушение правил игры'));
        setBanBlockFullAccess(Boolean(rawBan.blockFullAccess));
        setBanBlockPyramid(Boolean(rawBan.blockPyramid));
        setBanBlockClanPyramid(Boolean(rawBan.blockClanPyramid));
        setBanBlockChat(Boolean(rawBan.blockChat));
        setBanBlockTradeAndAuction(Boolean(rawBan.blockTradeAndAuction));
        setBanBlockClans(Boolean(rawBan.blockClans));
        setBanBlockRoulette(Boolean(rawBan.blockRoulette));
        setBanExpPenaltyPct(String(Math.max(0, Math.min(100, Number(rawBan.expPenaltyPct ?? 0)))));
        setBanGoldPenaltyPct(String(Math.max(0, Math.min(100, Number(rawBan.goldPenaltyPct ?? 0)))));
      } else {
        setBanIsPermanent(false);
        setBanDurationHours('24');
        setBanReason('Нарушение правил игры');
        setBanBlockFullAccess(false);
        setBanBlockPyramid(false);
        setBanBlockClanPyramid(false);
        setBanBlockChat(false);
        setBanBlockTradeAndAuction(false);
        setBanBlockClans(false);
        setBanBlockRoulette(false);
        setBanExpPenaltyPct('0');
        setBanGoldPenaltyPct('0');
      }
    },
    [hero.nick, selfEquipped, selfInventory]
  );

  const refreshDbPlayersList = useCallback(async () => {
    setIsLoadingPlayers(true);
    try {
      const rows = await fetchAllPlayersFromDatabase();
      if (Array.isArray(rows) && rows.length > 0) {
        const sorted = [...rows].sort((a, b) => {
          const aOnline = Boolean(a.is_online) && Date.now() - Number(a.last_seen ?? 0) < 18000;
          const bOnline = Boolean(b.is_online) && Date.now() - Number(b.last_seen ?? 0) < 18000;
          if (aOnline !== bOnline) return aOnline ? -1 : 1;
          return Number(b.lvl ?? 1) - Number(a.lvl ?? 1);
        });
        setDbPlayers(sorted);
      }
      if (onRefreshOnlinePlayers) {
        onRefreshOnlinePlayers();
      }
    } catch (e) {
      console.warn('Error refreshing DB players list:', e);
    } finally {
      setIsLoadingPlayers(false);
    }
  }, [onRefreshOnlinePlayers]);

  const loadTargetPlayerData = useCallback(
    async (nickToLoad?: string, silent?: boolean) => {
      const nick = (nickToLoad !== undefined ? nickToLoad : targetPlayerNick).trim() || (hero.nick || '');
      if (!nick) return;

      // Instant optimistic fill from dbPlayers
      const cachedRow = dbPlayers.find(
        (r) => String(r.name || r.nick || '').trim().toLowerCase() === nick.toLowerCase()
      );
      if (cachedRow) {
        populateFieldsFromUnpacked(cachedRow, nick);
      }

      setIsUpdatingDb(true);
      try {
        const raw = await findPlayerInSupabase(nick);
        if (raw) {
          const p = unpackPlayerRow(raw);
          populateFieldsFromUnpacked(p, nick);
          setDbPlayers((prev) => {
            const exists = prev.some(
              (r) => String(r.name || r.nick || '').trim().toLowerCase() === nick.toLowerCase()
            );
            return exists
              ? prev.map((r) =>
                  String(r.name || r.nick || '').trim().toLowerCase() === nick.toLowerCase() ? p : r
                )
              : [p, ...prev];
          });
          if (!silent) {
            showToast(
              `✅ Загружен персонаж ${p.name || p.nick}: Ур.${p.lvl} | 🪙${p.gold} | 💎${p.crystals} | Вещей: ${
                Object.keys(p.equipped || {}).length
              } надето, ${Array.isArray(p.inventory) ? p.inventory.length : 0} в сумке`
            );
          }
        } else if (!silent) {
          showToast(`⚠️ Игрок «${nick}» не найден в базе Supabase`);
        }
      } catch (e) {
        console.warn('Error loading target player data:', e);
        if (!silent) {
          showToast('❌ Ошибка при загрузке персонажа из БД');
        }
      } finally {
        setIsUpdatingDb(false);
      }
    },
    [targetPlayerNick, hero.nick, dbPlayers, populateFieldsFromUnpacked, showToast]
  );

  useEffect(() => {
    refreshDbPlayersList();
    if (hero.nick) {
      loadTargetPlayerData(hero.nick, true);
    }
    syncMonsterConfigsFromSupabase().then((loaded) => {
      if (Array.isArray(loaded) && loaded.length > 0) {
        setMonsters(loaded);
      }
    });
    syncShopAndFeaturesFromSupabase().then(({ catalog, flags, skins }) => {
      if (Array.isArray(catalog) && catalog.length > 0) setShopCatalog(catalog);
      if (flags) setFeatureFlags(flags);
      if (Array.isArray(skins)) setShopSkins(skins);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncLocalSelfIfMatched = (
    modifiedNick: string,
    updatedPlayer?: RealtimePlayer,
    rawPlayer?: any
  ) => {
    const cleanTarget = modifiedNick.trim().toLowerCase();
    const myNick = (hero.nick || '').trim().toLowerCase();
    if (!cleanTarget || cleanTarget !== myNick) return;

    if (rawPlayer?.equipped && setSelfEquipped) {
      setSelfEquipped(rawPlayer.equipped);
    }
    if (Array.isArray(rawPlayer?.inventory) && setSelfInventory) {
      setSelfInventory(rawPlayer.inventory);
    }

    setHero((prev) => {
      const nextGold = rawPlayer?.gold !== undefined ? Number(rawPlayer.gold) : (updatedPlayer?.gold ?? prev.gold);
      const nextCrystals =
        rawPlayer?.crystals !== undefined ? Number(rawPlayer.crystals) : (updatedPlayer?.crystals ?? prev.crystals);
      const nextLvl = rawPlayer?.lvl !== undefined ? Number(rawPlayer.lvl) : (updatedPlayer?.lvl ?? prev.level);
      const nextExp = rawPlayer?.exp !== undefined ? Number(rawPlayer.exp) : (updatedPlayer?.exp ?? prev.exp);
      const nextStatPoints =
        rawPlayer?.stat_points !== undefined
          ? Number(rawPlayer.stat_points)
          : (updatedPlayer?.statPoints ?? prev.statPoints);
      const nextStr = rawPlayer?.str !== undefined ? Number(rawPlayer.str) : (updatedPlayer?.str ?? prev.str);
      const nextAgi = rawPlayer?.agi !== undefined ? Number(rawPlayer.agi) : (updatedPlayer?.agi ?? prev.agi);
      const nextVit = rawPlayer?.vit !== undefined ? Number(rawPlayer.vit) : (updatedPlayer?.vit ?? prev.vit);
      const nextHpPotions =
        rawPlayer?.hp_potions !== undefined
          ? Number(rawPlayer.hp_potions)
          : (updatedPlayer?.hpPotions ?? prev.hpPotions);
      const nextEnPotions =
        rawPlayer?.en_potions !== undefined
          ? Number(rawPlayer.en_potions)
          : (updatedPlayer?.enPotions ?? prev.enPotions);
      const nextBagCap =
        rawPlayer?.bag_capacity !== undefined
          ? Number(rawPlayer.bag_capacity)
          : (updatedPlayer?.bagCapacity ?? prev.bagCapacity);
      const nextMaxHp =
        rawPlayer?.max_hp !== undefined ? Number(rawPlayer.max_hp) : (updatedPlayer?.maxHp ?? prev.maxHp);
      const nextHp = rawPlayer?.hp !== undefined ? Number(rawPlayer.hp) : (updatedPlayer?.hp ?? prev.hp);
      const nextMaxEn =
        rawPlayer?.max_energy !== undefined
          ? Number(rawPlayer.max_energy)
          : (updatedPlayer?.maxEnergy ?? prev.maxEnergy);
      const nextEn =
        rawPlayer?.energy !== undefined ? Number(rawPlayer.energy) : (updatedPlayer?.energy ?? prev.energy);
      const nextPremUntil = Number(
        rawPlayer?.premium_until ?? updatedPlayer?.premiumUntil ?? prev.premiumUntil ?? 0
      );
      const nextIsPrem =
        Boolean(rawPlayer?.is_premium ?? updatedPlayer?.isPremium) && nextPremUntil > Date.now();

      const nextHero: HeroState = {
        ...prev,
        gold: nextGold,
        crystals: nextCrystals,
        level: nextLvl,
        lvl: nextLvl,
        pyramidTier: getPyramidTierForLevel(nextLvl),
        exp: nextExp,
        statPoints: nextStatPoints,
        str: nextStr,
        agi: nextAgi,
        vit: nextVit,
        hpPotions: nextHpPotions,
        enPotions: nextEnPotions,
        bagCapacity: nextBagCap,
        baseMaxHp: 100 + (nextLvl - 1) * 10,
        maxHp: nextMaxHp,
        hp: Math.min(nextMaxHp, Math.max(1, nextHp)),
        maxEnergy: nextMaxEn,
        energy: Math.min(nextMaxEn, Math.max(0, nextEn)),
        totalGoldCollected: Math.max(prev.totalGoldCollected || prev.gold, nextGold),
        isPremium: nextIsPrem,
        premiumUntil: nextIsPrem ? nextPremUntil : undefined,
        vipUntil: nextIsPrem ? nextPremUntil : undefined,
        banInfo: rawPlayer?.banInfo !== undefined ? rawPlayer.banInfo : (rawPlayer?.ban_info !== undefined ? rawPlayer.ban_info : prev.banInfo),
        ownedSkinIds: Array.isArray(rawPlayer?.ownedSkinIds ?? rawPlayer?.owned_skin_ids)
          ? (rawPlayer?.ownedSkinIds ?? rawPlayer?.owned_skin_ids)
          : prev.ownedSkinIds,
        ownedSkinExpirations:
          rawPlayer?.ownedSkinExpirations ??
          rawPlayer?.owned_skin_expirations ??
          prev.ownedSkinExpirations,
        ownedSkins: Array.isArray(rawPlayer?.ownedSkins ?? rawPlayer?.owned_skins)
          ? (rawPlayer?.ownedSkins ?? rawPlayer?.owned_skins)
          : prev.ownedSkins,
        activeSkinId:
          rawPlayer?.activeSkinId !== undefined
            ? rawPlayer.activeSkinId
            : rawPlayer?.active_skin_id !== undefined
            ? rawPlayer.active_skin_id
            : prev.activeSkinId,
        avatar: rawPlayer?.avatar || updatedPlayer?.avatar || prev.avatar
      };
      if (onForceSavePlayer) {
        setTimeout(() => onForceSavePlayer(nextHero), 10);
      }
      return nextHero;
    });
  };

  // Save exact edited stats & level (both up and down) for the selected player in Supabase
  const handleSaveExactPlayerToDb = async (overrideLevel?: number) => {
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) {
      showToast('Выберите персонажа из списка!');
      return;
    }

    const currentOldLvl = Number(selectedPlayerStats?.lvl ?? 1);
    const setLevel = Math.max(
      1,
      Math.min(MAX_LEVEL, overrideLevel !== undefined ? overrideLevel : parseInt(editLevelValue, 10) || 1)
    );
    // When lowering level, reset EXP to 0 unless admin explicitly entered a smaller custom EXP
    let parsedExp = Math.max(0, parseInt(editExpValue, 10) || 0);
    if (setLevel < currentOldLvl && (overrideLevel !== undefined || parsedExp >= (EXP_TABLE[setLevel] || 100))) {
      parsedExp = 0;
      setEditExpValue('0');
    }

    const setGold = Math.max(0, parseInt(editGoldAmount, 10) || 0);
    const setCrystals = Math.max(0, parseInt(editCrystalsAmount, 10) || 0);
    const setHp = Math.max(1, parseInt(editHpValue, 10) || 100);
    const setMaxHp = Math.max(50, parseInt(editMaxHpValue, 10) || 100);
    const setEnergy = Math.max(0, parseInt(editEnergyValue, 10) || 60);
    const setMaxEnergy = Math.max(30, parseInt(editMaxEnergyValue, 10) || 60);
    let setStatPoints = Math.max(0, parseInt(editStatPointsValue, 10) || 0);
    let setStr = Math.max(1, parseInt(editStrValue, 10) || 5);
    let setAgi = Math.max(1, parseInt(editAgiValue, 10) || 5);
    let setVit = Math.max(1, parseInt(editVitValue, 10) || 5);
    if (setLevel !== currentOldLvl) {
      const normalized = normalizeStatsForLevel(setLevel, setStr, setAgi, setVit, setStatPoints);
      setStr = normalized.str;
      setAgi = normalized.agi;
      setVit = normalized.vit;
      setStatPoints = normalized.statPoints;
    }
    const setHpPotions = Math.max(0, parseInt(editHpPotionsValue, 10) || 0);
    const setEnPotions = Math.max(0, parseInt(editEnPotionsValue, 10) || 0);
    const setBagCapacity = Math.max(20, parseInt(editBagCapValue, 10) || 100);
    const setMobsKilled = Math.max(0, parseInt(editMobsKilledValue, 10) || 0);
    const setTotalGoldCollected = Math.max(0, parseInt(editTotalGoldValue, 10) || 0);

    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(nickToModify, {
        setLevel,
        setGold,
        setCrystals,
        setExp: parsedExp,
        setHp: setLevel !== currentOldLvl ? undefined : setHp,
        setMaxHp: setLevel !== currentOldLvl ? undefined : setMaxHp,
        setEnergy: setLevel !== currentOldLvl ? undefined : setEnergy,
        setMaxEnergy: setLevel !== currentOldLvl ? undefined : setMaxEnergy,
        setStatPoints,
        setStr,
        setAgi,
        setVit,
        setHpPotions,
        setEnPotions,
        setBagCapacity,
        setMobsKilled,
        setTotalGoldCollected
      });

      if (res.success) {
        if (res.rawPlayer) {
          populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        }
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        const p = res.rawPlayer || res.updatedPlayer;
        showToast(
          `✅ Сохранено (${nickToModify}): Ур.${p?.lvl ?? setLevel} | EXP:${p?.exp ?? parsedExp} | 🪙${
            p?.gold ?? setGold
          } | 💎${p?.crystals ?? setCrystals}`
        );
      } else {
        showToast(`❌ Ошибка: ${res.error || 'Не удалось обновить БД'}`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleQuickAddResource = async (goldDelta: number, crystalsDelta: number, addExp: number) => {
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) return;
    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(nickToModify, {
        goldDelta: goldDelta !== 0 ? goldDelta : undefined,
        crystalsDelta: crystalsDelta !== 0 ? crystalsDelta : undefined,
        addExp: addExp !== 0 ? addExp : undefined
      });
      if (res.success) {
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        showToast(`⚡ Выдано игроку ${nickToModify}!`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleRepairAllPlayerItems = async () => {
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) return;
    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(nickToModify, {
        repairAllItems: true
      });
      if (res.success) {
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        showToast(`🔨 Вся экипировка и вещи в сумке игрока ${nickToModify} починены на 100%!`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleGrantShopTemplateToBag = async () => {
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) return;
    const tpl = shopCatalog.find((s) => s.id === selectedShopItemToGrant) || shopCatalog[0];
    if (!tpl) return;
    const item: GameItem = {
      id: `adm_shop_${tpl.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: tpl.name,
      icon: tpl.icon,
      slot: tpl.slot,
      quality: tpl.quality || 'common',
      lvl: tpl.lvl,
      hp: tpl.hp,
      hpBonus: tpl.hp,
      dmg: tpl.dmg,
      dmgBonus: tpl.dmg,
      strBonus: 0,
      agiBonus: 0,
      vitBonus: 0,
      dodgeBonus: tpl.dodgeBonus || 0,
      energyBonus: tpl.energyBonus || 0,
      goldBonusPct: tpl.goldBonusPct || 0,
      expBonusPct: tpl.expBonusPct || 0,
      durability: tpl.maxDurability || 10,
      maxDurability: tpl.maxDurability || 10,
      price: tpl.price
    };
    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(nickToModify, {
        addInventoryItem: item
      });
      if (res.success) {
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        showToast(`🎁 Выдано из магазина: ${item.name} (Ур.${item.lvl}) в сумку ${nickToModify}!`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleUnequipPlayerSlot = async (slot: string) => {
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) return;
    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(nickToModify, {
        unequipSlot: slot
      });
      if (res.success) {
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        showToast(`🎒 Вещь со слота снята в сумку игрока ${nickToModify}`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleRemovePlayerBagItem = async (itemId: string, itemName: string) => {
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) return;
    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(nickToModify, {
        removeInventoryItemId: itemId
      });
      if (res.success) {
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        showToast(`🗑️ Предмет «${itemName}» удален из сумки ${nickToModify}`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleGrantDirectItemToBag = async () => {
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) return;
    const itemLvl = Math.max(1, Math.min(MAX_LEVEL, parseInt(directItemLvl, 10) || 1));
    const baseItem = generateItem(itemLvl, false, directItemSlot, directItemQuality);
    const createdItem: GameItem = {
      ...baseItem,
      id: `admin_bag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    };

    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(nickToModify, {
        addInventoryItem: createdItem
      });
      if (res.success) {
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        showToast(`🎒 Предмет «${createdItem.name}» добавлен в сумку ${nickToModify}!`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleTogglePlayerVip = async (targetNick: string, grant: boolean, hours: number = 12) => {
    const clean = targetNick.trim() || hero.nick || '';
    if (!clean) return;
    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(
        clean,
        grant ? { grantVipHours: hours } : { revokeVip: true }
      );
      if (res.success) {
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, clean);
        syncLocalSelfIfMatched(clean, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        showToast(grant ? `👑 Выдан VIP (+${hours}ч) игроку ${clean}!` : `❌ Снят VIP у игрока ${clean}.`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleAddBonusToPlayerInDb = async () => {
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) return;
    const goldDelta = parseInt(addGoldDelta, 10) || 0;
    const crystalsDelta = parseInt(addCrystalsDelta, 10) || 0;
    const addExp = parseInt(addExpDelta, 10) || 0;
    if (goldDelta === 0 && crystalsDelta === 0 && addExp === 0) {
      showToast('Введите +Золото, +Кристаллы или +Опыт!');
      return;
    }
    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(nickToModify, {
        goldDelta: goldDelta !== 0 ? goldDelta : undefined,
        crystalsDelta: crystalsDelta !== 0 ? crystalsDelta : undefined,
        addExp: addExp !== 0 ? addExp : undefined
      });
      if (res.success) {
        setAddGoldDelta('');
        setAddCrystalsDelta('');
        setAddExpDelta('');
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        showToast(`➕ Начислено игроку ${nickToModify}!`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleApplyPlayerBan = async () => {
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) {
      showToast('Выберите персонажа для блокировки!');
      return;
    }
    const hrs = Math.max(1, parseInt(banDurationHours, 10) || 24);
    const expPen = Math.max(0, Math.min(100, parseInt(banExpPenaltyPct, 10) || 0));
    const goldPen = Math.max(0, Math.min(100, parseInt(banGoldPenaltyPct, 10) || 0));
    const now = Date.now();
    const newBanInfo: PlayerBanInfo = {
      isBanned: true,
      isPermanent: banIsPermanent,
      bannedUntil: banIsPermanent ? undefined : now + hrs * 3600000,
      reason: banReason.trim() || 'Нарушение правил игры',
      bannedBy: hero.nick || 'Администратор',
      bannedAt: now,
      blockFullAccess: banBlockFullAccess,
      blockPyramid: banBlockPyramid,
      blockClanPyramid: banBlockClanPyramid,
      blockChat: banBlockChat,
      blockTradeAndAuction: banBlockTradeAndAuction,
      blockClans: banBlockClans,
      blockRoulette: banBlockRoulette,
      expPenaltyPct: expPen,
      goldPenaltyPct: goldPen
    };

    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(nickToModify, {
        setBanInfo: newBanInfo
      });
      if (res.success) {
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        showToast(
          banIsPermanent
            ? `🚫 Игрок ${nickToModify} заблокирован НАВСЕГДА!`
            : `🚫 Игрок ${nickToModify} заблокирован на ${hrs} ч. (Штраф EXP: -${expPen}%, Золото: -${goldPen}%)`
        );
      } else {
        showToast(`❌ Ошибка блокировки: ${res.error || ''}`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleUnbanPlayer = async () => {
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) return;
    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(nickToModify, {
        setBanInfo: null
      });
      if (res.success) {
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        showToast(`✅ Все блокировки и штрафы с персонажа ${nickToModify} полностью сняты!`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  // ==================== MONSTERS MANAGEMENT HANDLERS ====================
  const handleUpdateMonsterField = (id: string, field: keyof MonsterConfig, value: any) => {
    setMonsters((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleSaveAllMonsters = async (rebuildMapAfter?: boolean) => {
    setIsSavingMonsters(true);
    try {
      const ok = await saveMonsterConfigs(monsters);
      if (ok) {
        if (rebuildMapAfter && onResetMap) {
          onResetMap();
        }
        showToast(
          rebuildMapAfter
            ? '👹 Монстры сохранены в БД и карта Пирамиды обновлена!'
            : '👹 Настройки всех монстров сохранены в базу Supabase!'
        );
      } else {
        showToast('⚠️ Настройки сохранены локально (ошибка сети Supabase)');
      }
    } finally {
      setIsSavingMonsters(false);
    }
  };

  const handleCreateCustomMonster = async () => {
    const cleanName = newMobName.trim();
    if (!cleanName) {
      showToast('Введите название нового монстра!');
      return;
    }
    const isBossRole = newMobRowLimit === 'boss';
    const created: MonsterConfig = {
      id: `custom_t${newMobTier}_${Date.now()}`,
      name: `${newMobIcon} ${cleanName}`,
      icon: newMobIcon || '👹',
      tier: newMobTier,
      rowLimit: newMobRowLimit,
      lvl: Math.max(1, Math.min(MAX_LEVEL, parseInt(newMobLvl, 10) || 2)),
      hp: Math.max(10, parseInt(newMobHp, 10) || 100),
      dmg: Math.max(1, parseInt(newMobDmg, 10) || 20),
      isBoss: isBossRole,
      spawnWeight: Math.max(1, Math.min(100, parseInt(newMobSpawnWeight, 10) || 80)),
      dropChance: Math.max(0, Math.min(100, parseInt(newMobDropChance, 10) || 15)),
      goldMin: Math.max(0, parseInt(newMobGoldMin, 10) || 6),
      goldMax: Math.max(1, parseInt(newMobGoldMax, 10) || 6),
      expReward: Math.max(1, parseInt(newMobExp, 10) || 5),
      crystalsReward: Math.max(0, parseInt(newMobCrystals, 10) || 0),
      isCustom: true,
      enabled: true
    };

    const nextList = [created, ...monsters];
    setMonsters(nextList);
    setNewMobName('');
    setIsSavingMonsters(true);
    try {
      await saveMonsterConfigs(nextList);
      showToast(`✅ Монстр «${created.name}» добавлен в Пирамиду ${newMobTier}!`);
    } finally {
      setIsSavingMonsters(false);
    }
  };

  const handleDeleteCustomMonster = async (id: string, name: string) => {
    const nextList = monsters.filter((m) => m.id !== id);
    setMonsters(nextList);
    await saveMonsterConfigs(nextList);
    showToast(`🗑️ Монстр «${name}» удален`);
  };

  const handleResetMonstersToDefault = async () => {
    const defaults = DEFAULT_MONSTERS.map((m) => ({ ...m }));
    setMonsters(defaults);
    await saveMonsterConfigs(defaults);
    showToast('↩️ Настройки монстров сброшены к стандартным');
  };

  // ==================== SHOP, SKINS & FEATURES HANDLERS ====================
  const handleToggleFeatureFlag = async (key: keyof GameFeatureFlags) => {
    const nextFlags: GameFeatureFlags = {
      ...featureFlags,
      [key]: !featureFlags[key]
    };
    setFeatureFlags(nextFlags);
    setIsSavingShop(true);
    try {
      await saveShopAndFeaturesToSupabase(shopCatalog, nextFlags, shopSkins);
      if (onShopAndFeaturesUpdated) onShopAndFeaturesUpdated(shopCatalog, nextFlags, shopSkins);
      showToast('✅ Статус функции сохранен!');
    } finally {
      setIsSavingShop(false);
    }
  };

  const handleUpdateFeatureFlag = async (key: keyof GameFeatureFlags, value: any) => {
    const nextFlags: GameFeatureFlags = {
      ...featureFlags,
      [key]: value
    };
    setFeatureFlags(nextFlags);
    try {
      await saveShopAndFeaturesToSupabase(shopCatalog, nextFlags, shopSkins);
      if (onShopAndFeaturesUpdated) onShopAndFeaturesUpdated(shopCatalog, nextFlags, shopSkins);
    } catch (e) {
      console.warn('Error saving feature flag:', e);
    }
  };

  const handleUpdateShopItemField = (id: string, field: keyof ShopItemTemplate, value: any) => {
    setShopCatalog((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSaveShopCatalog = async () => {
    setIsSavingShop(true);
    try {
      const ok = await saveShopAndFeaturesToSupabase(shopCatalog, featureFlags, shopSkins);
      if (onShopAndFeaturesUpdated) onShopAndFeaturesUpdated(shopCatalog, featureFlags, shopSkins);
      showToast(ok ? '🛒 Каталог магазина, скины и функции сохранены в БД!' : '⚠️ Сохранено локально');
    } finally {
      setIsSavingShop(false);
    }
  };

  // ==================== CHARACTER SKINS HANDLERS ====================
  const handleUploadImageForNewSkin = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await processUploadedCharacterSkin(file);
    e.target.value = '';
    if (!res.ok || !res.dataUrl) {
      showToast(res.error || 'Ошибка загрузки картинки/GIF скина');
      return;
    }
    const sizeKb = res.finalSizeKb ?? res.compressedSizeKb ?? 20;
    const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
    setNewSkinIcon(res.dataUrl);
    setNewSkinImgInfo(
      `${isGif ? 'GIF Анимация' : `${res.width}×${res.height}px → 64×64px`} (Пирамида: 20×20px, ${sizeKb} КБ)`
    );
    showToast(
      `✅ Скин загружен и откалиброван под стандартный размер Пирамиды (20×20px в клетке, ${sizeKb} КБ)!`
    );
  };

  const handleUploadImageForExistingSkin = async (
    skinId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await processUploadedCharacterSkin(file);
    e.target.value = '';
    if (!res.ok || !res.dataUrl) {
      showToast(res.error || 'Ошибка загрузки картинки/GIF скина');
      return;
    }
    const sizeKb = res.finalSizeKb ?? res.compressedSizeKb ?? 20;
    handleUpdateSkinField(skinId, 'icon', res.dataUrl);
    showToast(`✅ Картинка/GIF скина обновлена (стандарт Пирамиды 20×20px, ${sizeKb} КБ)! Нажмите «Сохранить скины».`);
  };

  const handleUpdateSkinField = (
    skinId: string,
    field: keyof CharacterSkinTemplate,
    value: any
  ) => {
    setShopSkins((prev) =>
      prev.map((s) => (s.id === skinId ? { ...s, [field]: value } : s))
    );
  };

  const handleCreateNewSkin = async () => {
    const cleanName = newSkinName.trim();
    if (!cleanName) {
      showToast('Введите название нового скина персонажа!');
      return;
    }
    const isTemp = newSkinDurationType === 'temporary';
    const durDays = isTemp ? Math.max(1, parseInt(newSkinDurationDays, 10) || 7) : 0;
    const resolvedSkinIcon = newSkinIcon || '🤴';
    const createdSkin: CharacterSkinTemplate = {
      id: `skin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      icon: resolvedSkinIcon,
      avatarUrl: resolvedSkinIcon,
      quality: newSkinQuality,
      lvl: Math.max(1, Math.min(MAX_LEVEL, parseInt(newSkinLvl, 10) || 1)),
      currency: newSkinCurrency,
      priceGold: Math.max(0, parseInt(newSkinPriceGold, 10) || 0),
      priceCrystals: Math.max(0, parseInt(newSkinPriceCrystals, 10) || 0),
      hpBonus: Math.max(0, parseInt(newSkinHp, 10) || 0),
      dmgBonus: Math.max(0, parseInt(newSkinDmg, 10) || 0),
      strBonus: Math.max(0, parseInt(newSkinStr, 10) || 0),
      agiBonus: Math.max(0, parseInt(newSkinAgi, 10) || 0),
      vitBonus: Math.max(0, parseInt(newSkinVit, 10) || 0),
      dodgeBonus: Math.max(0, parseInt(newSkinDodge, 10) || 0),
      energyBonus: Math.max(0, parseInt(newSkinEnergy, 10) || 0),
      goldBonusPct: Math.max(0, parseInt(newSkinGoldPct, 10) || 0),
      expBonusPct: Math.max(0, parseInt(newSkinExpPct, 10) || 0),
      bagBonus: Math.max(0, parseInt(newSkinBag, 10) || 0),
      isExclusive: newSkinIsExclusive,
      isPersonal: false,
      isTemporary: isTemp,
      durationDays: durDays,
      enabled: true
    };
    const nextSkins = [createdSkin, ...shopSkins];
    setShopSkins(nextSkins);
    setNewSkinName('');
    setNewSkinImgInfo('');
    setIsSavingShop(true);
    try {
      await saveShopAndFeaturesToSupabase(shopCatalog, featureFlags, nextSkins);
      if (onShopAndFeaturesUpdated) onShopAndFeaturesUpdated(shopCatalog, featureFlags, nextSkins);
      showToast(
        newSkinIsExclusive
          ? `🔒 Эксклюзивный скин «${createdSkin.name}» создан (доступен для отправки игрокам, скрыт из общего магазина)!`
          : `🎨 Скин «${createdSkin.name}» добавлен в раздел «Скины» Магазина!`
      );
    } finally {
      setIsSavingShop(false);
    }
  };

  const handleCreateSkinToSelfCollection = async () => {
    const cleanName = newSkinName.trim();
    if (!cleanName) {
      showToast('Введите название для нового скина!');
      return;
    }
    const isTemp = newSkinDurationType === 'temporary';
    const durDays = isTemp ? Math.max(1, parseInt(newSkinDurationDays, 10) || 7) : 0;
    const isCustomUploadedImg = Boolean(
      newSkinIcon &&
        (newSkinIcon.startsWith('data:image/') ||
          newSkinIcon.startsWith('http://') ||
          newSkinIcon.startsWith('https://'))
    );
    const personalSprite = isCustomUploadedImg
      ? newSkinIcon
      : PERSONAL_SKIN_DEFAULT_SPRITE_DATA_URL;
    const createdSkin: CharacterSkinTemplate = {
      id: `skin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      icon: personalSprite,
      avatarUrl: personalSprite,
      quality: newSkinQuality,
      lvl: Math.max(1, Math.min(MAX_LEVEL, parseInt(newSkinLvl, 10) || 1)),
      currency: newSkinCurrency,
      priceGold: Math.max(0, parseInt(newSkinPriceGold, 10) || 0),
      priceCrystals: Math.max(0, parseInt(newSkinPriceCrystals, 10) || 0),
      hpBonus: Math.max(0, parseInt(newSkinHp, 10) || 0),
      dmgBonus: Math.max(0, parseInt(newSkinDmg, 10) || 0),
      strBonus: Math.max(0, parseInt(newSkinStr, 10) || 0),
      agiBonus: Math.max(0, parseInt(newSkinAgi, 10) || 0),
      vitBonus: Math.max(0, parseInt(newSkinVit, 10) || 0),
      dodgeBonus: Math.max(0, parseInt(newSkinDodge, 10) || 0),
      energyBonus: Math.max(0, parseInt(newSkinEnergy, 10) || 0),
      goldBonusPct: Math.max(0, parseInt(newSkinGoldPct, 10) || 0),
      expBonusPct: Math.max(0, parseInt(newSkinExpPct, 10) || 0),
      bagBonus: Math.max(0, parseInt(newSkinBag, 10) || 0),
      isExclusive: true,
      isPersonal: true,
      isTemporary: isTemp,
      durationDays: durDays,
      enabled: true
    };
    const nextSkins = [createdSkin, ...shopSkins];
    setShopSkins(nextSkins);
    setNewSkinName('');
    setNewSkinImgInfo('');

    // Add directly to admin's self collection and equip it!
    const curOwned = Array.isArray(hero.ownedSkinIds) ? hero.ownedSkinIds : [];
    const nextOwned = Array.from(new Set([...curOwned, createdSkin.id]));
    const nextExpirations = { ...(hero.ownedSkinExpirations || {}) };
    if (isTemp && durDays > 0) {
      nextExpirations[createdSkin.id] = Date.now() + durDays * 86400000;
    }
    const existingOwnedSkins = Array.isArray(hero.ownedSkins) ? hero.ownedSkins : [];
    const nextOwnedSkins = [
      createdSkin,
      ...existingOwnedSkins.filter((s) => s && s.id !== createdSkin.id)
    ];

    const nextHero: HeroState = {
      ...hero,
      ownedSkinIds: nextOwned,
      ownedSkinExpirations: nextExpirations,
      ownedSkins: nextOwnedSkins,
      activeSkinId: createdSkin.id,
      avatar: createdSkin.icon
    };
    setHero(nextHero);
    if (onForceSavePlayer) {
      onForceSavePlayer(nextHero);
    }

    setIsSavingShop(true);
    try {
      await saveShopAndFeaturesToSupabase(shopCatalog, featureFlags, nextSkins);
      if (onShopAndFeaturesUpdated) onShopAndFeaturesUpdated(shopCatalog, featureFlags, nextSkins);

      if (hero.nick) {
        const selfRes = await adminModifyPlayerBalanceInSupabase(hero.nick, {
          setOwnedSkinIds: nextOwned,
          setOwnedSkinExpirations: nextExpirations,
          setOwnedSkins: nextOwnedSkins,
          setActiveSkinId: createdSkin.id,
          setAvatar: createdSkin.icon
        });
        if (selfRes.success && selfRes.rawPlayer) {
          if (
            !targetPlayerNick ||
            targetPlayerNick.trim().toLowerCase() === hero.nick.trim().toLowerCase()
          ) {
            populateFieldsFromUnpacked(selfRes.rawPlayer, hero.nick);
          }
          await refreshDbPlayersList();
        }
      }

      showToast(`🎭 Скин «${createdSkin.name}» создан для себя (не продается в магазине) и добавлен в вашу коллекцию!`);
    } finally {
      setIsSavingShop(false);
    }
  };

  const handleAdminSendSkinToPlayer = async () => {
    if (!sendSkinModalTarget) return;
    const recipient = sendSkinRecipient.trim();
    if (!recipient) {
      showToast('Введите или выберите ник игрока!');
      return;
    }
    const skin = sendSkinModalTarget;
    const isTemp = sendSkinDurationType === 'temporary';
    const durDays = isTemp ? Math.max(1, parseInt(sendSkinDurationDays, 10) || 7) : 0;
    const expMs = isTemp ? Date.now() + durDays * 86400000 : 0;

    setIsUpdatingDb(true);
    try {
      const rawTarget = await findPlayerInSupabase(recipient);
      if (!rawTarget) {
        showToast(`❌ Игрок «${recipient}» не найден в базе данных!`);
        return;
      }
      const unpacked = unpackPlayerRow(rawTarget);
      const curOwned: string[] = Array.isArray(unpacked.ownedSkinIds) ? [...unpacked.ownedSkinIds] : [];
      const curExpirations = { ...(unpacked.ownedSkinExpirations || {}) };
      const curOwnedSkins: CharacterSkinTemplate[] = Array.isArray(unpacked.ownedSkins ?? unpacked.owned_skins)
        ? [...(unpacked.ownedSkins ?? unpacked.owned_skins)]
        : [];

      if (!curOwned.includes(skin.id)) {
        curOwned.push(skin.id);
      }
      if (isTemp) {
        curExpirations[skin.id] = expMs;
      } else {
        delete curExpirations[skin.id];
      }
      const nextOwnedSkins = [
        skin,
        ...curOwnedSkins.filter((s) => s && s.id !== skin.id)
      ];

      const options: any = {
        setOwnedSkinIds: curOwned,
        setOwnedSkinExpirations: curExpirations,
        setOwnedSkins: nextOwnedSkins
      };
      if (sendSkinAutoEquip) {
        options.setActiveSkinId = skin.id;
        options.setAvatar = skin.icon;
      }

      const res = await adminModifyPlayerBalanceInSupabase(recipient, options);
      if (res.success) {
        const durationStr = isTemp ? `${durDays} дн.` : 'НАВСЕГДА';
        await sendMailInSupabase(
          'Администрация',
          recipient,
          `🎁 Вам выдан скин персонажа «${skin.name}» (Срок: ${durationStr})! Он добавлен в вашу личную коллекцию 🎭.${sendSkinAutoEquip ? ' Скин сразу надет на вашего героя!' : ''}`
        );

        if (selectedPlayerStats && selectedPlayerStats.nick.toLowerCase() === recipient.toLowerCase()) {
          if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, recipient);
        }
        syncLocalSelfIfMatched(recipient, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();

        showToast(`🎁 Скин «${skin.name}» успешно отправлен игроку ${recipient} (${durationStr})!`);
        setSendSkinModalTarget(null);
        setSendSkinRecipient('');
      } else {
        showToast(`❌ Ошибка отправки скина: ${res.error || ''}`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleCreateRoulettePrize = async () => {
    const cleanName = newRpName.trim();
    if (!cleanName) {
      showToast('Введите название приза для рулетки!');
      return;
    }
    const weightNum = Math.max(1, parseInt(newRpWeight, 10) || 10);
    const skinDur = Math.max(0, parseInt(newRpSkinDuration, 10) || 0);
    const targetSkin = shopSkins.find((s) => s.id === newRpSkinId);
    const newPrize: RoulettePrizeConfig = {
      id: `rp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      icon: newRpType === 'skin' ? (targetSkin?.avatarUrl || targetSkin?.icon || newRpIcon || '🎭') : (newRpIcon || '🎁'),
      type: newRpType,
      amount: newRpType === 'gold' || newRpType === 'crystals' || newRpType === 'jackpot' ? (parseInt(newRpAmount, 10) || 100) : undefined,
      quality: newRpQuality,
      skinId: newRpType === 'skin' ? (newRpSkinId || shopSkins[0]?.id) : undefined,
      skinDurationDays: newRpType === 'skin' ? skinDur : 0,
      weight: weightNum,
      enabled: true
    };
    const nextPrizes = [...adminRoulettePrizes, newPrize];
    setAdminRoulettePrizes(nextPrizes);
    setNewRpName('');
    setIsSavingRoulette(true);
    try {
      await saveRoulettePrizesToSupabase(nextPrizes);
      showToast(`🎡 Приз «${newPrize.name}» добавлен в рулетку!`);
    } finally {
      setIsSavingRoulette(false);
    }
  };

  const handleToggleRoulettePrize = async (id: string) => {
    const nextPrizes = adminRoulettePrizes.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p);
    setAdminRoulettePrizes(nextPrizes);
    await saveRoulettePrizesToSupabase(nextPrizes);
  };

  const handleDeleteRoulettePrize = async (id: string) => {
    const nextPrizes = adminRoulettePrizes.filter((p) => p.id !== id);
    setAdminRoulettePrizes(nextPrizes);
    await saveRoulettePrizesToSupabase(nextPrizes);
    showToast('🗑️ Приз удален из рулетки');
  };

  const handleUpdateRoulettePrizeWeight = async (id: string, weight: number) => {
    const nextPrizes = adminRoulettePrizes.map((p) => p.id === id ? { ...p, weight: Math.max(1, weight) } : p);
    setAdminRoulettePrizes(nextPrizes);
    await saveRoulettePrizesToSupabase(nextPrizes);
  };

  const handleAdminEquipSkinForPlayer = async (skinId: string | null) => {
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) return;
    const playerOwnedSkins = resolvePlayerOwnedSkins(
      selectedPlayerStats?.owned_skin_ids ?? selectedPlayerStats?.ownedSkinIds,
      selectedPlayerStats?.owned_skin_expirations ?? selectedPlayerStats?.ownedSkinExpirations,
      shopSkins,
      selectedPlayerStats?.owned_skins ?? selectedPlayerStats?.ownedSkins,
      selectedPlayerStats?.active_skin_id ?? selectedPlayerStats?.activeSkinId,
      selectedPlayerStats?.avatar
    );
    const targetSkin = skinId
      ? shopSkins.find((s) => s.id === skinId) ||
        playerOwnedSkins.find((s) => s.id === skinId) ||
        null
      : null;
    const avatar = targetSkin ? (targetSkin.avatarUrl || targetSkin.icon) : '🧙‍♂️';
    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(nickToModify, {
        setActiveSkinId: skinId,
        setAvatar: avatar
      });
      if (res.success) {
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        showToast(
          skinId
            ? `🎭 Скин «${targetSkin?.name || 'Скин'}» надет на персонажа ${nickToModify}!`
            : `👤 Скин снят с персонажа ${nickToModify}.`
        );
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleAdminUpdatePlayerSkinImage = async (
    skinId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) return;

    const processed = await processUploadedCharacterSkin(file);
    e.target.value = '';
    if (!processed.ok || !processed.dataUrl) {
      showToast(processed.error || 'Ошибка загрузки скина');
      return;
    }

    const newImgUrl: string = processed.dataUrl;
    const nextShopSkins: CharacterSkinTemplate[] = shopSkins.map((s) =>
      s.id === skinId ? { ...s, icon: newImgUrl, avatarUrl: newImgUrl } : s
    );
    setShopSkins(nextShopSkins);

    const playerOwnedSkins = resolvePlayerOwnedSkins(
      selectedPlayerStats?.owned_skin_ids ?? selectedPlayerStats?.ownedSkinIds,
      selectedPlayerStats?.owned_skin_expirations ?? selectedPlayerStats?.ownedSkinExpirations,
      nextShopSkins,
      selectedPlayerStats?.owned_skins ?? selectedPlayerStats?.ownedSkins,
      selectedPlayerStats?.active_skin_id ?? selectedPlayerStats?.activeSkinId,
      selectedPlayerStats?.avatar
    );
    const updatedOwnedSkins = playerOwnedSkins.map((s) =>
      s.id === skinId ? { ...s, icon: newImgUrl, avatarUrl: newImgUrl } : s
    );
    const activeSkinId =
      selectedPlayerStats?.active_skin_id ?? selectedPlayerStats?.activeSkinId ?? null;
    const isEquipped = activeSkinId === skinId;

    setIsUpdatingDb(true);
    try {
      await saveShopAndFeaturesToSupabase(shopCatalog, featureFlags, nextShopSkins);
      if (onShopAndFeaturesUpdated) {
        onShopAndFeaturesUpdated(shopCatalog, featureFlags, nextShopSkins);
      }

      const modOptions: any = {
        setOwnedSkins: updatedOwnedSkins
      };
      if (isEquipped) {
        modOptions.setAvatar = newImgUrl;
      }

      const res = await adminModifyPlayerBalanceInSupabase(nickToModify, modOptions);
      if (res.success) {
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        showToast(`🖼️ Картинка скина в коллекции ${nickToModify} обновлена и сохранена!`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleAdminRemoveSkinFromPlayer = async (skinId: string) => {
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) return;
    const curOwned: string[] = Array.isArray(
      selectedPlayerStats?.owned_skin_ids ?? selectedPlayerStats?.ownedSkinIds
    )
      ? [...(selectedPlayerStats?.owned_skin_ids ?? selectedPlayerStats?.ownedSkinIds)]
      : [];
    const nextOwned = curOwned.filter((id) => id !== skinId);
    const curOwnedSkins: CharacterSkinTemplate[] = Array.isArray(
      selectedPlayerStats?.owned_skins ?? selectedPlayerStats?.ownedSkins
    )
      ? [...(selectedPlayerStats?.owned_skins ?? selectedPlayerStats?.ownedSkins)]
      : [];
    const nextOwnedSkins = curOwnedSkins.filter((s) => s && s.id !== skinId);
    const curActive =
      selectedPlayerStats?.active_skin_id ?? selectedPlayerStats?.activeSkinId ?? null;
    const isEquipped = curActive === skinId;
    const nextActive = isEquipped ? null : curActive;
    const nextAvatar = isEquipped ? '🧙‍♂️' : undefined;

    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(nickToModify, {
        setOwnedSkinIds: nextOwned,
        setOwnedSkins: nextOwnedSkins,
        setActiveSkinId: nextActive,
        setAvatar: nextAvatar
      });
      if (res.success) {
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        showToast(`🗑️ Скин изъят из коллекции персонажа ${nickToModify}`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleAdminGrantSkinToPlayer = async (skinId: string) => {
    const nickToModify = targetPlayerNick.trim() || hero.nick || '';
    if (!nickToModify) return;
    const skin = shopSkins.find((s) => s.id === skinId) || shopSkins[0];
    if (!skin) return;

    const curOwned: string[] = Array.isArray(
      selectedPlayerStats?.owned_skin_ids ?? selectedPlayerStats?.ownedSkinIds
    )
      ? [...(selectedPlayerStats?.owned_skin_ids ?? selectedPlayerStats?.ownedSkinIds)]
      : [];

    if (curOwned.includes(skin.id)) {
      showToast(`ℹ️ Скин «${skin.name}» уже есть в коллекции игрока ${nickToModify}!`);
      return;
    }

    const nextOwned = [...curOwned, skin.id];
    const curOwnedSkins: CharacterSkinTemplate[] = Array.isArray(
      selectedPlayerStats?.owned_skins ?? selectedPlayerStats?.ownedSkins
    )
      ? [...(selectedPlayerStats?.owned_skins ?? selectedPlayerStats?.ownedSkins)]
      : [];
    const nextOwnedSkins = [skin, ...curOwnedSkins.filter((s) => s && s.id !== skin.id)];

    setIsUpdatingDb(true);
    try {
      const res = await adminModifyPlayerBalanceInSupabase(nickToModify, {
        setOwnedSkinIds: nextOwned,
        setOwnedSkins: nextOwnedSkins
      });
      if (res.success) {
        if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nickToModify);
        syncLocalSelfIfMatched(nickToModify, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
        showToast(`🎁 Скин «${skin.name}» успешно выдан в коллекцию персонажа ${nickToModify}!`);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleDeleteSkin = async (skinId: string, skinName: string) => {
    const nextSkins = deleteSkinFromCatalog(skinId);
    setShopSkins(nextSkins);
    setIsSavingShop(true);
    try {
      await saveShopAndFeaturesToSupabase(shopCatalog, featureFlags, nextSkins);
      if (onShopAndFeaturesUpdated) onShopAndFeaturesUpdated(shopCatalog, featureFlags, nextSkins);
      showToast(`🗑️ Скин «${skinName}» удален из магазина!`);
    } finally {
      setIsSavingShop(false);
    }
  };

  const handleSaveAllSkins = async () => {
    setIsSavingShop(true);
    try {
      const ok = await saveShopAndFeaturesToSupabase(shopCatalog, featureFlags, shopSkins);
      if (onShopAndFeaturesUpdated) onShopAndFeaturesUpdated(shopCatalog, featureFlags, shopSkins);
      showToast(ok ? '🎨 Все скины и их бонусы сохранены в БД!' : '⚠️ Скины сохранены локально');
    } finally {
      setIsSavingShop(false);
    }
  };

  const handleCreateNewShopItem = async () => {
    const cleanName = newShopName.trim();
    if (!cleanName) {
      showToast('Введите название нового предмета для магазина!');
      return;
    }
    const created: ShopItemTemplate = {
      id: `shop_custom_${newShopSlot}_${Date.now()}`,
      slot: newShopSlot,
      type: newShopSlot === 'gloves' ? 'helmet' : newShopSlot,
      name: cleanName,
      icon: newShopIcon || '⚔️',
      quality: ((parseInt(newShopLvl, 10) || 2) >= 20 ? 'legendary' : (parseInt(newShopLvl, 10) || 2) >= 15 ? 'epic' : (parseInt(newShopLvl, 10) || 2) >= 8 ? 'rare' : 'common') as ItemQualityKey,
      lvl: Math.max(1, Math.min(MAX_LEVEL, parseInt(newShopLvl, 10) || 2)),
      price: Math.max(1, parseInt(newShopPrice, 10) || 30),
      maxDurability: Math.max(1, parseInt(newShopDurability, 10) || 10),
      hp: Math.max(0, parseInt(newShopHp, 10) || 0),
      dmg: Math.max(0, parseInt(newShopDmg, 10) || 0),
      dodgeBonus: Math.max(0, parseInt(newShopDodge, 10) || 0),
      energyBonus: Math.max(0, parseInt(newShopEnergy, 10) || 0),
      goldBonusPct: Math.max(0, parseInt(newShopGoldPct, 10) || 0),
      expBonusPct: Math.max(0, parseInt(newShopExpPct, 10) || 0),
      isCustom: true,
      enabled: true
    };
    const nextCatalog = [created, ...shopCatalog];
    setShopCatalog(nextCatalog);
    setNewShopName('');
    setIsSavingShop(true);
    try {
      await saveShopAndFeaturesToSupabase(nextCatalog, featureFlags, shopSkins);
      if (onShopAndFeaturesUpdated) onShopAndFeaturesUpdated(nextCatalog, featureFlags, shopSkins);
      showToast(`🛒 Предмет «${created.name}» добавлен в Магазин!`);
    } finally {
      setIsSavingShop(false);
    }
  };

  const handleDeleteShopItem = async (id: string, name: string) => {
    const nextCatalog = shopCatalog.filter((i) => i.id !== id);
    setShopCatalog(nextCatalog);
    await saveShopAndFeaturesToSupabase(nextCatalog, featureFlags, shopSkins);
    if (onShopAndFeaturesUpdated) onShopAndFeaturesUpdated(nextCatalog, featureFlags, shopSkins);
    showToast(`🗑️ Предмет «${name}» удален из магазина`);
  };

  const handleResetShopToDefault = async () => {
    const defaults = DEFAULT_SHOP_CATALOG.map((i) => ({ ...i }));
    setShopCatalog(defaults);
    await saveShopAndFeaturesToSupabase(defaults, featureFlags, shopSkins);
    if (onShopAndFeaturesUpdated) onShopAndFeaturesUpdated(defaults, featureFlags, shopSkins);
    showToast('↩️ Каталог магазина сброшен к базовым параметрам');
  };

  // ==================== MAIL & SERVER HANDLERS ====================
  const handleBroadcast = () => {
    if (!broadcastText.trim()) return;
    if (onBroadcastSystemMessage) {
      onBroadcastSystemMessage(`📢 [АДМИН]: ${broadcastText.trim()}`);
    } else {
      const msg: ChatMessage = {
        id: 'sys_' + Date.now(),
        author: '👑 АДМИН',
        text: `📢 [ОБЪЯВЛЕНИЕ]: ${broadcastText.trim()}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        channel: 'world',
        isSystem: true
      };
      setChatMessages((prev) => [...prev, msg]);
    }
    setBroadcastText('');
    showToast('📢 Системное объявление отправлено в мировой чат!');
  };

  const handleSendGift = () => {
    const recipient = giftNick.trim() || targetPlayerNick.trim() || hero.nick || 'Игрок';
    const goldAmount = Math.max(0, parseInt(giftGold, 10) || 0);
    const crystalsAmount = Math.max(0, parseInt(giftCrystals, 10) || 0);
    const hpPotAmount = Math.max(0, parseInt(giftHpPotions, 10) || 0);
    const enPotAmount = Math.max(0, parseInt(giftEnPotions, 10) || 0);
    const energyAmount = Math.max(0, parseInt(giftEnergy, 10) || 0);
    const statPtsAmount = Math.max(0, parseInt(giftStatPoints, 10) || 0);
    const expAmount = Math.max(0, parseInt(giftExp, 10) || 0);
    const premDaysAmount = Math.max(0, parseInt(giftPremiumDays, 10) || 0);

    let customGiftItem = undefined;
    if (giftIncludeItem) {
      const itemLvl = Math.max(1, Math.min(MAX_LEVEL, parseInt(giftItemLvl, 10) || 1));
      const baseItem = generateItem(itemLvl, false, giftItemSlot, giftItemQuality);
      customGiftItem = {
        ...baseItem,
        id: `admin_gift_item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      };
    }

    const attachment: MailGiftAttachment = {
      gold: goldAmount > 0 ? goldAmount : undefined,
      crystals: crystalsAmount > 0 ? crystalsAmount : undefined,
      hpPotions: hpPotAmount > 0 ? hpPotAmount : undefined,
      enPotions: enPotAmount > 0 ? enPotAmount : undefined,
      energy: energyAmount > 0 ? energyAmount : undefined,
      statPoints: statPtsAmount > 0 ? statPtsAmount : undefined,
      exp: expAmount > 0 ? expAmount : undefined,
      premiumDays: premDaysAmount > 0 ? premDaysAmount : undefined,
      item: customGiftItem,
      claimed: false
    };

    const summaryParts: string[] = [];
    if (goldAmount > 0) summaryParts.push(`+${goldAmount} 🪙`);
    if (crystalsAmount > 0) summaryParts.push(`+${crystalsAmount} 💎`);
    if (hpPotAmount > 0) summaryParts.push(`+${hpPotAmount} 🧪HP`);
    if (enPotAmount > 0) summaryParts.push(`+${enPotAmount} ⚡EN`);
    if (expAmount > 0) summaryParts.push(`+${expAmount} EXP`);
    if (premDaysAmount > 0) summaryParts.push(`👑 VIP ${premDaysAmount}дн.`);
    if (customGiftItem) summaryParts.push(`⚔️ ${customGiftItem.name}`);

    const summaryStr = summaryParts.length > 0 ? ` [${summaryParts.join(', ')}]` : '';

    const pm: PrivateMessage = {
      id: 'gift_admin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      from: '👑 Администрация',
      to: recipient,
      text: `${giftMessageText.trim() || '🎁 Подарок от Администрации!'}${summaryStr}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
      gift: attachment
    };

    setPrivateMessages((prev) => [pm, ...prev]);
    sendMailInSupabase(pm.from, pm.to, pm.text, pm.gift);
    showToast(`📩 Подарок отправлен на почту игроку ${recipient}!`);
  };

  // Build combined player list
  const combinedPlayersList = React.useMemo(() => {
    const map = new Map<string, any>();
    dbPlayers.forEach((p) => {
      const nick = String(p.name || p.nick || '').trim();
      if (!nick) return;
      const isOnline = Boolean(p.is_online) && Date.now() - Number(p.last_seen ?? 0) < 18000;
      const isPrem = Boolean(p.is_premium) && Number(p.premium_until ?? 0) > Date.now();
      map.set(nick.toLowerCase(), {
        ...p,
        nick,
        lvl: Number(p.lvl ?? 1),
        exp: Number(p.exp ?? 0),
        gold: Number(p.gold ?? 0),
        crystals: Number(p.crystals ?? 0),
        isOnline,
        isPremium: isPrem
      });
    });
    onlinePlayers.forEach((p) => {
      const key = p.nick.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          ...p,
          nick: p.nick,
          lvl: p.lvl ?? 1,
          exp: p.exp ?? 0,
          gold: p.gold ?? 0,
          crystals: p.crystals ?? 0,
          isOnline: Boolean(p.isOnline),
          isPremium: Boolean(p.isPremium)
        });
      }
    });
    return Array.from(map.values());
  }, [dbPlayers, onlinePlayers]);

  const selectedVipActive =
    selectedPlayerStats &&
    Boolean(selectedPlayerStats.is_premium) &&
    Number(selectedPlayerStats.premium_until ?? 0) > Date.now();

  const equippedMap: Record<string, GameItem | undefined> = selectedPlayerStats?.equipped || {};
  const bagItems: GameItem[] = Array.isArray(selectedPlayerStats?.inventory)
    ? selectedPlayerStats.inventory
    : [];

  const filteredMonsters = monsters.filter((m) => {
    if (monsterTierFilter === 'all') return true;
    if (monsterTierFilter === 'rare') return m.rowLimit === 'rare_boss';
    return m.tier === monsterTierFilter && m.rowLimit !== 'rare_boss';
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
        {/* Compact Clean Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛠️</span>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-white">
                Панель Администратора
              </h2>
              <p className="text-[10px] text-slate-400">
                Управление персонажами, экипировкой, монстрами и пирамидами
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-red-900/60 hover:text-white"
          >
            ✕ Закрыть
          </button>
        </div>

        {/* 8-Tab Organized Switcher: Players, Clans, Clan Pyramid, Bosses, Monsters, Shop, Weapon Creation, Server */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 border-b border-slate-800 bg-slate-900/80 p-1.5 text-[10.5px] font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('players')}
            className={`rounded-lg py-1.5 px-2 transition-all ${
              activeTab === 'players'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            👤 1. Персонажи ({combinedPlayersList.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('clans');
              setAdminClans(getAllClans());
              setAdminPyramidState(getClanPyramidState());
            }}
            className={`rounded-lg py-1.5 px-2 transition-all ${
              activeTab === 'clans'
                ? 'bg-amber-600 text-slate-950 font-black shadow'
                : 'bg-slate-900 text-amber-300 border border-amber-500/30 hover:bg-slate-800'
            }`}
          >
            🛡️ 2. Кланы ({adminClans.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('clanPyramid');
              const st = getClanPyramidState();
              setAdminPyramidState(st);
              setAdminClans(getAllClans());
              if (st.config) {
                setCpTitle(st.config.title);
                setCpGoldBonus(st.config.goldBonusPct);
                setCpExpBonus(st.config.expBonusPct);
                setCpDmgBonus(st.config.dmgBonusPct);
                setCpHpBonus(st.config.hpBonusPct);
                setCpEnergyPerMove(st.config.energyPerMove);
                setCpRespawnSec(st.config.respawnIntervalSec);
                setCpMinClanLvl(st.config.minClanLevel);
              }
            }}
            className={`rounded-lg py-1.5 px-2 transition-all ${
              activeTab === 'clanPyramid'
                ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white font-black shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                : 'bg-slate-900 text-red-300 border border-red-500/40 hover:bg-slate-800'
            }`}
          >
            🔺 3. Пирамида Клана
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bosses')}
            className={`rounded-lg py-1.5 px-2 transition-all ${
              activeTab === 'bosses'
                ? 'bg-gradient-to-r from-amber-500 to-red-600 text-white shadow'
                : 'bg-slate-900 text-amber-300 border border-amber-500/30 hover:bg-slate-800'
            }`}
          >
            👑 4. Боссы (П1–П3)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('monsters')}
            className={`rounded-lg py-1.5 px-2 transition-all ${
              activeTab === 'monsters'
                ? 'bg-amber-600 text-white shadow'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            👹 5. Монстры ({monsters.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shop')}
            className={`rounded-lg py-1.5 px-2 transition-all ${
              activeTab === 'shop'
                ? 'bg-cyan-600 text-white shadow'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            🛒 6. Магазин ({shopCatalog.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('creation')}
            className={`rounded-lg py-1.5 px-2 transition-all ${
              activeTab === 'creation'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow'
                : 'bg-slate-900 text-cyan-300 border border-cyan-500/30 hover:bg-slate-800'
            }`}
          >
            ⚒️ 7. Кузница оружия
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('server')}
            className={`rounded-lg py-1.5 px-2 transition-all ${
              activeTab === 'server'
                ? 'bg-purple-600 text-white shadow'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            🎁 8. Сервер & Почта
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roulette')}
            className={`rounded-lg py-1.5 px-2 transition-all ${
              activeTab === 'roulette'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow'
                : 'bg-slate-900 text-yellow-300 border border-yellow-500/30 hover:bg-slate-800'
            }`}
          >
            🎡 9. Рулетка ({adminRoulettePrizes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            className={`rounded-lg py-1.5 px-2 transition-all ${
              activeTab === 'bank'
                ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 font-black shadow'
                : 'bg-slate-900 text-cyan-300 border border-cyan-500/30 hover:bg-slate-800'
            }`}
          >
            🏦 10. Банк ({getBankPackages(featureFlags).length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-3 overflow-y-auto p-3 text-xs">
          {/* ==================== TAB 1: PLAYERS & CHARACTER GEAR ==================== */}
          {activeTab === 'players' && (
            <>
              {/* 1. Список игроков */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-bold text-emerald-400">
                    1. Выберите персонажа ({combinedPlayersList.length})
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      type="text"
                      value={playerSearchQuery}
                      onChange={(e) => setPlayerSearchQuery(e.target.value)}
                      placeholder="🔍 Поиск по нику..."
                      className="w-36 rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] text-white outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      disabled={isUpdatingDb}
                      onClick={async () => {
                        setIsUpdatingDb(true);
                        try {
                          const res = await recalculateAllPlayersByExpTableInSupabase();
                          await refreshDbPlayersList();
                          if (targetPlayerNick) await loadTargetPlayerData(targetPlayerNick);
                          showToast(`⚡ Успешно оттресированы и восстановлены опыт, уровни и рейтинг у ${res.updatedCount} игроков!`);
                        } finally {
                          setIsUpdatingDb(false);
                        }
                      }}
                      className="rounded border border-purple-500/50 bg-purple-950/60 px-2 py-0.5 text-[10px] font-bold text-purple-200 hover:bg-purple-900/80"
                      title="Пересчитать и восстановить всем игрокам опыт, уровни, статы и рейтинг по таблице опыта"
                    >
                      ⚡ Пересчитать и восстановить всех (Опыт / Рейтинг)
                    </button>
                    <button
                      type="button"
                      onClick={refreshDbPlayersList}
                      disabled={isLoadingPlayers}
                      className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-200 hover:bg-slate-700"
                    >
                      {isLoadingPlayers ? '⏳...' : '🔄 Обновить'}
                    </button>
                  </div>
                </div>

                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {combinedPlayersList
                    .filter((p) =>
                      !playerSearchQuery.trim()
                        ? true
                        : p.nick.toLowerCase().includes(playerSearchQuery.trim().toLowerCase())
                    )
                    .map((p) => {
                      const isSelected =
                        targetPlayerNick.trim().toLowerCase() === p.nick.toLowerCase();
                      return (
                        <div
                          key={p.nick}
                          onClick={() => loadTargetPlayerData(p.nick)}
                          className={`flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-950/50'
                              : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                p.isOnline ? 'bg-emerald-400' : 'bg-slate-600'
                              }`}
                            />
                            <span className="font-bold text-white">{p.nick}</span>
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-purple-300">
                              Ур.{p.lvl}
                            </span>
                            <span className="text-[10px] text-emerald-400">EXP:{p.exp ?? 0}</span>
                            <span className="text-[10px] text-amber-400">🪙{p.gold}</span>
                            <span className="text-[10px] text-cyan-400">💎{p.crystals}</span>
                            {p.isPremium && <span className="text-[10px] text-yellow-400">👑VIP</span>}
                          </div>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              isSelected
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {isSelected ? '✓ Выбран' : 'Выбрать'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* 2. Полный профиль выбранного персонажа */}
              <div className="rounded-xl border border-emerald-500/40 bg-slate-900/90 p-3">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-slate-950 p-0.5">
                      <CharacterAvatar
                        avatar={selectedPlayerStats?.avatar || '🧙‍♂️'}
                        nick={selectedPlayerStats?.name || targetPlayerNick}
                        size="sm"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-amber-300">
                          {selectedPlayerStats?.name || targetPlayerNick || 'Не выбран'}
                        </span>
                        <span className="rounded bg-purple-950 px-1.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/30">
                          Ур. {selectedPlayerStats?.lvl ?? editLevelValue} (Пирамида{' '}
                          {getPyramidTierForLevel(Number(selectedPlayerStats?.lvl ?? editLevelValue ?? 1))})
                        </span>
                        {selectedVipActive && (
                          <span className="rounded bg-yellow-950 px-1.5 py-0.5 text-[10px] font-bold text-yellow-300">
                            👑 VIP
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Локация:{' '}
                        {selectedPlayerStats?.location === 'pyramid'
                          ? `Пирамида Т${selectedPlayerStats?.pyramid_tier || 1} [${selectedPlayerStats?.row ?? 9}:${selectedPlayerStats?.col ?? 1}]`
                          : 'В Городе'}{' '}
                        | Убито мобов: {selectedPlayerStats?.mobs_killed ?? 0} | PvP:{' '}
                        {selectedPlayerStats?.pvp_kills ?? 0}
                      </div>
                    </div>
                  </div>

                  {/* Быстрые кнопки Понизить / Повысить уровень на 1 в 1 клик */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isUpdatingDb}
                      onClick={() => {
                        const cur = Math.max(1, parseInt(editLevelValue, 10) || 1);
                        const next = Math.max(1, cur - 1);
                        setEditLevelValue(String(next));
                        setEditExpValue('0');
                        handleSaveExactPlayerToDb(next);
                      }}
                      className="rounded-lg border border-amber-500/50 bg-amber-950/80 px-2.5 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-amber-900 disabled:opacity-50"
                      title="Сразу понизить уровень персонажа на 1 и сохранить в БД"
                    >
                      ⏬ -1 Ур. (Понизить)
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingDb}
                      onClick={() => {
                        const cur = Math.max(1, parseInt(editLevelValue, 10) || 1);
                        const next = Math.min(MAX_LEVEL, cur + 1);
                        setEditLevelValue(String(next));
                        setEditExpValue('0');
                        handleSaveExactPlayerToDb(next);
                      }}
                      className="rounded-lg border border-emerald-500/50 bg-emerald-950/80 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-900 disabled:opacity-50"
                      title="Сразу повысить уровень персонажа на 1 и сохранить в БД"
                    >
                      ⏫ +1 Ур. (Повысить)
                    </button>
                  </div>
                </div>

                {/* Сетка редактирования всех характеристик */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <label className="text-[10px] font-bold text-purple-300">
                      Уровень (1–{MAX_LEVEL}):
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={MAX_LEVEL}
                      value={editLevelValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditLevelValue(val);
                        const num = Math.max(1, Math.min(MAX_LEVEL, parseInt(val, 10) || 1));
                        if (num < Number(selectedPlayerStats?.lvl ?? 1)) {
                          setEditExpValue('0');
                        }
                        const norm = normalizeStatsForLevel(
                          num,
                          parseInt(editStrValue, 10) || 1,
                          parseInt(editAgiValue, 10) || 1,
                          parseInt(editVitValue, 10) || 1,
                          parseInt(editStatPointsValue, 10) || 0
                        );
                        setEditStrValue(String(norm.str));
                        setEditAgiValue(String(norm.agi));
                        setEditVitValue(String(norm.vit));
                        setEditStatPointsValue(String(norm.statPoints));
                      }}
                      className="mt-0.5 w-full rounded-lg border border-purple-500/50 bg-slate-950 px-2 py-1 text-xs font-bold text-purple-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-300">
                      Опыт (EXP / {EXP_TABLE[Math.max(1, Math.min(MAX_LEVEL, parseInt(editLevelValue, 10) || 1))] || 'MAX'}):
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editExpValue}
                      onChange={(e) => setEditExpValue(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-emerald-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-amber-400">Золото 🪙:</label>
                    <input
                      type="number"
                      min={0}
                      value={editGoldAmount}
                      onChange={(e) => setEditGoldAmount(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-amber-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-cyan-400">Кристаллы 💎:</label>
                    <input
                      type="number"
                      min={0}
                      value={editCrystalsAmount}
                      onChange={(e) => setEditCrystalsAmount(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-cyan-300 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-red-400">Сила ⚔️:</label>
                    <input
                      type="number"
                      min={1}
                      value={editStrValue}
                      onChange={(e) => setEditStrValue(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-emerald-400">Ловкость 🏹:</label>
                    <input
                      type="number"
                      min={1}
                      value={editAgiValue}
                      onChange={(e) => setEditAgiValue(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-amber-300">Живучесть 🛡️:</label>
                    <input
                      type="number"
                      min={1}
                      value={editVitValue}
                      onChange={(e) => setEditVitValue(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-indigo-300">Свободные статы ⭐:</label>
                    <input
                      type="number"
                      min={0}
                      value={editStatPointsValue}
                      onChange={(e) => setEditStatPointsValue(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-indigo-300 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-rose-300">Здоровье (HP / Макс):</label>
                    <div className="mt-0.5 flex gap-1">
                      <input
                        type="number"
                        min={1}
                        value={editHpValue}
                        onChange={(e) => setEditHpValue(e.target.value)}
                        className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs font-bold text-rose-300 outline-none"
                      />
                      <input
                        type="number"
                        min={50}
                        value={editMaxHpValue}
                        onChange={(e) => setEditMaxHpValue(e.target.value)}
                        className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs font-bold text-rose-400 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-sky-300">Энергия (EN / Макс):</label>
                    <div className="mt-0.5 flex gap-1">
                      <input
                        type="number"
                        min={0}
                        value={editEnergyValue}
                        onChange={(e) => setEditEnergyValue(e.target.value)}
                        className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs font-bold text-sky-300 outline-none"
                      />
                      <input
                        type="number"
                        min={30}
                        value={editMaxEnergyValue}
                        onChange={(e) => setEditMaxEnergyValue(e.target.value)}
                        className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs font-bold text-sky-400 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-red-300">Зелья HP 🧪 / EN ⚗️:</label>
                    <div className="mt-0.5 flex gap-1">
                      <input
                        type="number"
                        min={0}
                        value={editHpPotionsValue}
                        onChange={(e) => setEditHpPotionsValue(e.target.value)}
                        className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs font-bold text-red-300 outline-none"
                      />
                      <input
                        type="number"
                        min={0}
                        value={editEnPotionsValue}
                        onChange={(e) => setEditEnPotionsValue(e.target.value)}
                        className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs font-bold text-sky-300 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-300">Вместимость сумки 🎒:</label>
                    <input
                      type="number"
                      min={20}
                      value={editBagCapValue}
                      onChange={(e) => setEditBagCapValue(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-slate-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-red-400">💀 Убито монстров (Рейтинг):</label>
                    <input
                      type="number"
                      min={0}
                      value={editMobsKilledValue}
                      onChange={(e) => setEditMobsKilledValue(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-red-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-yellow-400">🪙 Всего собрано золота (Рейтинг):</label>
                    <input
                      type="number"
                      min={0}
                      value={editTotalGoldValue}
                      onChange={(e) => setEditTotalGoldValue(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-yellow-300 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isUpdatingDb}
                  onClick={() => handleSaveExactPlayerToDb()}
                  className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-xs font-black text-white shadow hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isUpdatingDb
                    ? '⏳ Сохранение в базу данных...'
                    : `💾 Сохранить изменения персонажа (${targetPlayerNick || hero.nick})`}
                </button>

                {/* Быстрые кнопки начисления золота, кристаллов и опыта в 1 клик */}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-800 pt-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-bold text-amber-300 mr-0.5">Быстро:</span>
                    <button
                      type="button"
                      disabled={isUpdatingDb}
                      onClick={() => handleQuickAddResource(100, 0, 0)}
                      className="rounded border border-amber-500/40 bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-300 hover:bg-amber-900/70"
                    >
                      +100🪙
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingDb}
                      onClick={() => handleQuickAddResource(1000, 0, 0)}
                      className="rounded border border-amber-500/40 bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-300 hover:bg-amber-900/70"
                    >
                      +1000🪙
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingDb}
                      onClick={() => handleQuickAddResource(10000, 0, 0)}
                      className="rounded border border-amber-500/40 bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-200 hover:bg-amber-900/70"
                    >
                      +10к🪙
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingDb}
                      onClick={() => handleQuickAddResource(0, 10, 0)}
                      className="rounded border border-cyan-500/40 bg-cyan-950/60 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-900/70"
                    >
                      +10💎
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingDb}
                      onClick={() => handleQuickAddResource(0, 50, 0)}
                      className="rounded border border-cyan-500/40 bg-cyan-950/60 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-900/70"
                    >
                      +50💎
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingDb}
                      onClick={() => handleQuickAddResource(0, 0, 500)}
                      className="rounded border border-emerald-500/40 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-900/70"
                    >
                      +500 EXP
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-bold text-yellow-300 mr-0.5">VIP:</span>
                    <button
                      type="button"
                      disabled={isUpdatingDb}
                      onClick={() => handleTogglePlayerVip(targetPlayerNick, true, 12)}
                      className="rounded border border-yellow-600/50 bg-yellow-950/60 px-2 py-0.5 text-[10px] font-bold text-yellow-300 hover:bg-yellow-900/60"
                    >
                      +12ч
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingDb}
                      onClick={() => handleTogglePlayerVip(targetPlayerNick, true, 24)}
                      className="rounded border border-amber-600/50 bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-300 hover:bg-amber-900/60"
                    >
                      +24ч
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingDb}
                      onClick={() => handleTogglePlayerVip(targetPlayerNick, true, 168)}
                      className="rounded border border-purple-600/50 bg-purple-950/60 px-2 py-0.5 text-[10px] font-bold text-purple-300 hover:bg-purple-900/60"
                    >
                      +7д
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingDb}
                      onClick={() => handleTogglePlayerVip(targetPlayerNick, false, 0)}
                      className="rounded border border-red-600/50 bg-red-950/60 px-2 py-0.5 text-[10px] font-bold text-red-300 hover:bg-red-900/60"
                    >
                      ❌ Снять
                    </button>
                  </div>

                  <div className="flex items-center gap-1 w-full sm:w-auto justify-end mt-1 sm:mt-0">
                    <input
                      type="number"
                      value={addGoldDelta}
                      onChange={(e) => setAddGoldDelta(e.target.value)}
                      placeholder="+Золото"
                      className="w-20 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[10px] text-amber-300 outline-none"
                    />
                    <input
                      type="number"
                      value={addCrystalsDelta}
                      onChange={(e) => setAddCrystalsDelta(e.target.value)}
                      placeholder="+Крист"
                      className="w-16 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[10px] text-cyan-300 outline-none"
                    />
                    <input
                      type="number"
                      value={addExpDelta}
                      onChange={(e) => setAddExpDelta(e.target.value)}
                      placeholder="+EXP"
                      className="w-16 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[10px] text-emerald-300 outline-none"
                    />
                    <button
                      type="button"
                      disabled={isUpdatingDb}
                      onClick={handleAddBonusToPlayerInDb}
                      className="rounded bg-cyan-700 px-2 py-1 text-[10px] font-bold text-white hover:bg-cyan-600"
                    >
                      ➕ Начислить
                    </button>
                  </div>
                </div>
              </div>

              {/* 🚫 БЛОКИРОВКА ПЕРСОНАЖА (НА ВРЕМЯ ИЛИ НАВСЕГДА) И ШТРАФЫ НА ОПЫТ/ЗОЛОТО */}
              <div className="rounded-xl border-2 border-red-500/60 bg-gradient-to-b from-red-950/35 via-slate-900 to-slate-900 p-3 space-y-2.5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-500/30 pb-2">
                  <div>
                    <span className="font-black text-red-300 text-xs sm:text-sm flex items-center gap-1.5">
                      🚫 Блокировка персонажа ({targetPlayerNick || hero.nick}) — На время или Навсегда
                    </span>
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      Выберите срок блокировки, запретите отдельные действия в игре или понизьте процент получения опыта и золота
                    </div>
                  </div>
                  {(() => {
                    const curBan: PlayerBanInfo | null =
                      selectedPlayerStats?.banInfo ?? selectedPlayerStats?.ban_info ?? null;
                    const isActivelyBanned =
                      Boolean(curBan?.isBanned) &&
                      (Boolean(curBan?.isPermanent) || Number(curBan?.bannedUntil || 0) > Date.now());
                    return (
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-[10px] font-black border ${
                            isActivelyBanned
                              ? 'bg-red-900/80 border-red-400 text-red-100 animate-pulse'
                              : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                          }`}
                        >
                          {isActivelyBanned
                            ? curBan?.isPermanent
                              ? '⛔ ЗАБЛОКИРОВАН НАВСЕГДА'
                              : `⏳ В БАНЕ (еще ${Math.max(
                                  1,
                                  Math.ceil(((curBan?.bannedUntil || 0) - Date.now()) / 60000)
                                )} мин.)`
                            : '✅ АКТИВЕН (НЕ В БАНЕ)'}
                        </span>
                        {isActivelyBanned && (
                          <button
                            type="button"
                            disabled={isUpdatingDb}
                            onClick={handleUnbanPlayer}
                            className="rounded-lg border border-emerald-400 bg-emerald-600 px-3 py-1 text-[10px] font-black text-white hover:bg-emerald-500 shadow cursor-pointer"
                          >
                            🔓 Разблокировать
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Срок блокировки и Причина */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-red-300">1. Тип блокировки:</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setBanIsPermanent(false)}
                        className={`rounded py-1.5 text-[10px] font-black border transition-all cursor-pointer ${
                          !banIsPermanent
                            ? 'border-amber-400 bg-amber-500 text-slate-950'
                            : 'border-slate-700 bg-slate-900 text-slate-300'
                        }`}
                      >
                        ⏳ На время
                      </button>
                      <button
                        type="button"
                        onClick={() => setBanIsPermanent(true)}
                        className={`rounded py-1.5 text-[10px] font-black border transition-all cursor-pointer ${
                          banIsPermanent
                            ? 'border-red-400 bg-red-600 text-white'
                            : 'border-slate-700 bg-slate-900 text-slate-300'
                        }`}
                      >
                        ♾️ Навсегда
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-2 space-y-1">
                    <label className="text-[10px] font-bold text-amber-300">
                      2. Длительность (если на время, часов):
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        disabled={banIsPermanent}
                        value={banDurationHours}
                        onChange={(e) => setBanDurationHours(e.target.value)}
                        className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-amber-300 disabled:opacity-40 outline-none"
                      />
                      <div className="flex flex-wrap gap-1">
                        {[
                          { label: '1ч', val: '1' },
                          { label: '6ч', val: '6' },
                          { label: '24ч', val: '24' },
                          { label: '3д', val: '72' },
                          { label: '7д', val: '168' }
                        ].map((preset) => (
                          <button
                            key={preset.val}
                            type="button"
                            disabled={banIsPermanent}
                            onClick={() => setBanDurationHours(preset.val)}
                            className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-300">3. Причина блокировки:</label>
                    <input
                      type="text"
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="Напр. Нарушение правил / Спам / Багоюз"
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white outline-none"
                    />
                  </div>
                </div>

                {/* Выбрать что персонаж НЕ может делать пока в бане */}
                <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-2.5 space-y-2">
                  <div className="text-[10px] font-bold text-amber-300">
                    🔒 Что персонаж НЕ МОЖЕТ делать пока находится в бане (выберите нужные запреты):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 text-[10px]">
                    <label className="flex items-center gap-2 rounded border border-red-500/40 bg-red-950/30 px-2 py-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={banBlockFullAccess}
                        onChange={(e) => setBanBlockFullAccess(e.target.checked)}
                        className="h-3.5 w-3.5 accent-red-500"
                      />
                      <span className="font-bold text-red-200">🚫 Полный запрет входа в игру</span>
                    </label>
                    <label className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900 px-2 py-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={banBlockPyramid}
                        onChange={(e) => setBanBlockPyramid(e.target.checked)}
                        className="h-3.5 w-3.5 accent-amber-500"
                      />
                      <span className="text-slate-200">🏛️ Запретить Пирамиду и бои</span>
                    </label>
                    <label className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900 px-2 py-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={banBlockClanPyramid}
                        onChange={(e) => setBanBlockClanPyramid(e.target.checked)}
                        className="h-3.5 w-3.5 accent-amber-500"
                      />
                      <span className="text-slate-200">🔺 Запретить Клановую Пирамиду</span>
                    </label>
                    <label className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900 px-2 py-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={banBlockChat}
                        onChange={(e) => setBanBlockChat(e.target.checked)}
                        className="h-3.5 w-3.5 accent-amber-500"
                      />
                      <span className="text-slate-200">💬 Запретить Чат и Почту (Мут)</span>
                    </label>
                    <label className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900 px-2 py-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={banBlockTradeAndAuction}
                        onChange={(e) => setBanBlockTradeAndAuction(e.target.checked)}
                        className="h-3.5 w-3.5 accent-amber-500"
                      />
                      <span className="text-slate-200">⚖️ Запретить Аукцион и Передачу</span>
                    </label>
                    <label className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900 px-2 py-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={banBlockClans}
                        onChange={(e) => setBanBlockClans(e.target.checked)}
                        className="h-3.5 w-3.5 accent-amber-500"
                      />
                      <span className="text-slate-200">🏰 Запретить Кланы и базу</span>
                    </label>
                    <label className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900 px-2 py-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={banBlockRoulette}
                        onChange={(e) => setBanBlockRoulette(e.target.checked)}
                        className="h-3.5 w-3.5 accent-amber-500"
                      />
                      <span className="text-slate-200">🎰 Запретить Рулетку</span>
                    </label>
                  </div>
                </div>

                {/* Понижение процента получения опыта или золота */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="rounded-lg border border-purple-500/40 bg-slate-950/90 p-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-purple-300">
                        📉 Понизить процент получения ОПЫТА (0% – 100%):
                      </span>
                      <span className="font-black text-purple-200">-{banExpPenaltyPct || 0}% EXP</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={parseInt(banExpPenaltyPct, 10) || 0}
                        onChange={(e) => setBanExpPenaltyPct(e.target.value)}
                        className="w-full accent-purple-500"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={banExpPenaltyPct}
                        onChange={(e) => setBanExpPenaltyPct(e.target.value)}
                        className="w-16 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-center text-xs font-bold text-purple-300"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-yellow-500/40 bg-slate-950/90 p-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-yellow-300">
                        📉 Понизить процент получения ЗОЛОТА (0% – 100%):
                      </span>
                      <span className="font-black text-yellow-200">-{banGoldPenaltyPct || 0}% 🪙</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={parseInt(banGoldPenaltyPct, 10) || 0}
                        onChange={(e) => setBanGoldPenaltyPct(e.target.value)}
                        className="w-full accent-yellow-500"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={banGoldPenaltyPct}
                        onChange={(e) => setBanGoldPenaltyPct(e.target.value)}
                        className="w-16 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-center text-xs font-bold text-yellow-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isUpdatingDb}
                    onClick={handleApplyPlayerBan}
                    className="flex-1 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 py-2 text-xs font-black text-white shadow hover:from-red-500 hover:to-rose-500 disabled:opacity-50 cursor-pointer"
                  >
                    🚫 Применить блокировку / ограничения к персонажу ({targetPlayerNick || hero.nick})
                  </button>
                  <button
                    type="button"
                    disabled={isUpdatingDb}
                    onClick={handleUnbanPlayer}
                    className="rounded-lg border border-emerald-500/60 bg-emerald-950/80 px-4 py-2 text-xs font-black text-emerald-300 hover:bg-emerald-900 cursor-pointer"
                  >
                    ✅ Снять бан и все штрафы
                  </button>
                </div>
              </div>

              {/* 3. ВСЕ ЧТО НАДЕТО НА ПЕРСОНАЖЕ (ЭКИПИРОВКА) И СУМКА */}
              <div className="rounded-xl border border-amber-500/40 bg-slate-900/90 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-amber-300">
                    🛡️ 2. Что надето на персонаже ({targetPlayerNick || hero.nick}) — 6 слотов
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isUpdatingDb}
                      onClick={handleRepairAllPlayerItems}
                      className="rounded border border-emerald-500/50 bg-emerald-950/70 px-2.5 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-900"
                    >
                      🔨 Починить все вещи (100%)
                    </button>
                    <span className="text-[10px] text-slate-400">
                      Надето: {Object.keys(equippedMap).filter((k) => Boolean(equippedMap[k])).length} / 6
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {ALL_SLOTS.map((slotKey) => {
                    const slotMeta = SLOT_INFO[slotKey];
                    const eqItem = equippedMap[slotKey];
                    const qCfg = eqItem ? getQualityConfig(eqItem.quality) : null;
                    return (
                      <div
                        key={slotKey}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0 flex items-center justify-center w-6 h-6">
                            <ItemIcon icon={eqItem ? eqItem.icon : slotMeta.icon} name={eqItem?.name || slotMeta.name} className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-[10px] text-slate-400">{slotMeta.name}:</div>
                            {eqItem ? (
                              <>
                                <div
                                  className="truncate text-[11px] font-bold"
                                  style={{ color: qCfg?.color || '#fff' }}
                                >
                                  {eqItem.name} (Ур.{eqItem.lvl})
                                </div>
                                <div className="text-[9.5px] text-slate-300">
                                  {Number(eqItem.dmgBonus ?? eqItem.dmg ?? 0) > 0 && `⚔️+${eqItem.dmgBonus ?? eqItem.dmg} `}
                                  {Number(eqItem.hpBonus ?? eqItem.hp ?? 0) > 0 && `❤️+${eqItem.hpBonus ?? eqItem.hp} `}
                                  {eqItem.strBonus ? `Сил+${eqItem.strBonus} ` : ''}
                                  {eqItem.agiBonus ? `Лов+${eqItem.agiBonus} ` : ''}
                                  {eqItem.vitBonus ? `Жив+${eqItem.vitBonus}` : ''}
                                </div>
                              </>
                            ) : (
                              <div className="text-[10px] italic text-slate-600">Пусто (не надето)</div>
                            )}
                          </div>
                        </div>
                        {eqItem && (
                          <div className="ml-2 flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItemTarget({
                                  source: 'equipped',
                                  slotKey,
                                  item: { ...eqItem }
                                });
                                setActiveTab('creation');
                              }}
                              className="rounded border border-cyan-500/40 bg-cyan-950/60 px-2 py-1 text-[9.5px] font-bold text-cyan-300 hover:bg-cyan-900/70"
                              title="Корректировать характеристики или заменить картинку предмета"
                            >
                              ✏️ Изменить
                            </button>
                            <button
                              type="button"
                              disabled={isUpdatingDb}
                              onClick={() => handleUnequipPlayerSlot(slotKey)}
                              className="rounded border border-amber-500/40 bg-amber-950/60 px-2 py-1 text-[9.5px] font-bold text-amber-300 hover:bg-amber-900/70"
                            >
                              Снять
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Сумка / Инвентарь персонажа */}
                <div className="mt-3 border-t border-slate-800 pt-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-bold text-indigo-300">
                      🎒 Сумка / Инвентарь персонажа ({bagItems.length} /{' '}
                      {selectedPlayerStats?.bag_capacity ?? 100})
                    </span>
                  </div>

                  {bagItems.length > 0 ? (
                    <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                      {bagItems.map((it) => {
                        const qCfg = getQualityConfig(it.quality);
                        return (
                          <div
                            key={it.id}
                            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-[11px]"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="shrink-0 flex items-center justify-center w-5 h-5">
                                <ItemIcon icon={it.icon} name={it.name} className="h-4 w-4" />
                              </span>
                              <span
                                className="truncate font-bold"
                                style={{ color: qCfg.color }}
                              >
                                {it.name}
                              </span>
                              <span className="text-[10px] text-slate-400">(Ур.{it.lvl})</span>
                              <span className="text-[9.5px] text-slate-300">
                                {Number(it.dmgBonus ?? it.dmg ?? 0) > 0 ? `⚔️+${it.dmgBonus ?? it.dmg} ` : ''}
                                {Number(it.hpBonus ?? it.hp ?? 0) > 0 ? `❤️+${it.hpBonus ?? it.hp}` : ''}
                              </span>
                            </div>
                            <div className="ml-2 flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItemTarget({
                                    source: 'inventory',
                                    item: { ...it }
                                  });
                                  setActiveTab('creation');
                                }}
                                className="rounded border border-cyan-500/40 bg-cyan-950/60 px-2 py-0.5 text-[9.5px] font-bold text-cyan-300 hover:bg-cyan-900"
                              >
                                ✏️ Изменить
                              </button>
                              <button
                                type="button"
                                disabled={isUpdatingDb}
                                onClick={() => handleRemovePlayerBagItem(it.id, it.name)}
                                className="rounded border border-red-500/40 bg-red-950/60 px-2 py-0.5 text-[9.5px] font-bold text-red-300 hover:bg-red-900"
                              >
                                🗑️ Удалить
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-800 bg-slate-950 py-2 text-center text-[11px] text-slate-500">
                      Сумка персонажа пуста
                    </div>
                  )}

                  {/* Выдать предмет прямо в сумку выбранного персонажа */}
                  <div className="mt-2.5 rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <div className="mb-1.5 text-[10px] font-bold text-emerald-300">
                      ➕ Выдать новую вещь сразу в сумку ({targetPlayerNick || hero.nick}):
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                      <select
                        value={directItemSlot}
                        onChange={(e) => setDirectItemSlot(e.target.value as ItemSlot)}
                        className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[10.5px] text-white outline-none"
                      >
                        <option value="weapon">⚔️ Оружие</option>
                        <option value="armor">🛡️ Броня</option>
                        <option value="pants">👖 Штаны</option>
                        <option value="boots">👢 Сапоги</option>
                        <option value="gloves">🧤 Перчатки</option>
                        <option value="ring">💍 Кольцо</option>
                      </select>
                      <select
                        value={directItemQuality}
                        onChange={(e) => setDirectItemQuality(e.target.value as ItemQualityKey)}
                        className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[10.5px] text-white outline-none"
                      >
                        <option value="common">Обычное</option>
                        <option value="uncommon">Необычное</option>
                        <option value="rare">Редкое</option>
                        <option value="epic">Эпическое</option>
                        <option value="legendary">Легендарное</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={MAX_LEVEL}
                        value={directItemLvl}
                        onChange={(e) => setDirectItemLvl(e.target.value)}
                        placeholder="Ур. вещи"
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10.5px] text-white outline-none"
                      />
                      <button
                        type="button"
                        disabled={isUpdatingDb}
                        onClick={handleGrantDirectItemToBag}
                        className="rounded bg-emerald-600 px-2 py-1 text-[10.5px] font-bold text-white hover:bg-emerald-500"
                      >
                        ➕ Случайную
                      </button>
                    </div>

                    {/* Выдача готового предмета из каталога Магазина (включая новый меч 2 ур. и т.д.) */}
                    <div className="mt-2 border-t border-slate-800/80 pt-2">
                      <div className="mb-1 text-[10px] font-bold text-cyan-300">
                        🛒 Или выдать конкретный предмет из каталога Магазина:
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          value={selectedShopItemToGrant}
                          onChange={(e) => setSelectedShopItemToGrant(e.target.value)}
                          className="flex-1 min-w-[200px] rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10.5px] text-white outline-none"
                        >
                          {shopCatalog.map((s) => (
                            <option key={s.id} value={s.id}>
                              [Ур.{s.lvl}] {s.name} ({SHOP_CATEGORY_LABELS[s.slot]}) — ❤️+{s.hp} ⚔️+{s.dmg} (🪙{s.price})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={isUpdatingDb}
                          onClick={handleGrantShopTemplateToBag}
                          className="rounded bg-cyan-600 px-3 py-1 text-[10.5px] font-bold text-white hover:bg-cyan-500"
                        >
                          🎁 Выдать из Магазина
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. КОЛЛЕКЦИЯ СКИНОВ ПЕРСОНАЖА (ПРОСМОТР, НАДЕВАНИЕ, СНЯТИЕ, ВЫДАЧА И УДАЛЕНИЕ) */}
              <div className="rounded-xl border border-fuchsia-500/50 bg-slate-900/90 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div>
                    <span className="font-bold text-fuchsia-300 text-xs sm:text-sm flex items-center gap-1.5">
                      🎭 4. Коллекция скинов персонажа ({targetPlayerNick || hero.nick})
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Просмотр личной коллекции скинов, надевание/снятие, выдача любого скина в коллекцию или удаление
                    </div>
                  </div>
                  {(() => {
                    const resolvedPlayerSkins = resolvePlayerOwnedSkins(
                      selectedPlayerStats?.owned_skin_ids ?? selectedPlayerStats?.ownedSkinIds,
                      selectedPlayerStats?.owned_skin_expirations ?? selectedPlayerStats?.ownedSkinExpirations,
                      shopSkins,
                      selectedPlayerStats?.owned_skins ?? selectedPlayerStats?.ownedSkins,
                      selectedPlayerStats?.active_skin_id ?? selectedPlayerStats?.activeSkinId,
                      selectedPlayerStats?.avatar
                    );
                    const activeSkinId =
                      selectedPlayerStats?.active_skin_id ?? selectedPlayerStats?.activeSkinId ?? null;
                    return (
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-fuchsia-950/70 border border-fuchsia-500/40 px-2 py-0.5 text-[9.5px] font-bold text-fuchsia-300">
                          Скинов в коллекции: {resolvedPlayerSkins.length}
                        </span>
                        {activeSkinId && (
                          <button
                            type="button"
                            disabled={isUpdatingDb}
                            onClick={() => handleAdminEquipSkinForPlayer(null)}
                            className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[9.5px] font-bold text-slate-300 cursor-pointer"
                          >
                            Снять текущий скин
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Список скинов, которые есть у этого персонажа */}
                {(() => {
                  const activeSkinId =
                    selectedPlayerStats?.active_skin_id ?? selectedPlayerStats?.activeSkinId ?? null;
                  const ownedSkinObjects = resolvePlayerOwnedSkins(
                    selectedPlayerStats?.owned_skin_ids ?? selectedPlayerStats?.ownedSkinIds,
                    selectedPlayerStats?.owned_skin_expirations ?? selectedPlayerStats?.ownedSkinExpirations,
                    shopSkins,
                    selectedPlayerStats?.owned_skins ?? selectedPlayerStats?.ownedSkins,
                    activeSkinId,
                    selectedPlayerStats?.avatar
                  );

                  return (
                    <div className="space-y-1.5">
                      {ownedSkinObjects.length === 0 ? (
                        <div className="rounded-lg border border-slate-800 bg-slate-950 py-3 text-center text-[11px] text-slate-500">
                          У персонажа {targetPlayerNick || hero.nick} пока нет скинов в коллекции.
                        </div>
                      ) : (
                        <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                          {ownedSkinObjects.map((skin) => {
                            const isEquipped = activeSkinId === skin.id;
                            return (
                              <div
                                key={skin.id}
                                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-[11px] ${
                                  isEquipped
                                    ? 'border-fuchsia-400/80 bg-fuchsia-950/40 shadow-[0_0_10px_rgba(217,70,239,0.2)]'
                                    : 'border-slate-800 bg-slate-950'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-9 h-9 rounded-lg bg-slate-900 border border-fuchsia-500/40 flex items-center justify-center overflow-hidden shrink-0">
                                    <CharacterAvatar
                                      avatar={skin.avatarUrl || skin.icon}
                                      size="sm"
                                      alt={skin.name}
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-fuchsia-200 truncate">
                                        {skin.name}
                                      </span>
                                      <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-slate-800 text-slate-300">
                                        {skin.lvl} ур.
                                      </span>
                                      {isEquipped && (
                                        <span className="text-[8.5px] px-1.5 py-0.2 rounded font-black bg-fuchsia-600 text-white">
                                          НАДЕТ
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[9px] text-slate-400 mt-0.5 flex flex-wrap gap-1">
                                      {skin.hpBonus > 0 && <span className="text-red-300">❤️+{skin.hpBonus}</span>}
                                      {skin.dmgBonus > 0 && <span className="text-orange-300">⚔️+{skin.dmgBonus}</span>}
                                      {skin.strBonus > 0 && <span className="text-rose-300">💪+{skin.strBonus}</span>}
                                      {skin.agiBonus > 0 && <span className="text-teal-300">🤸+{skin.agiBonus}</span>}
                                      {skin.vitBonus > 0 && <span className="text-pink-300">🩸+{skin.vitBonus}</span>}
                                      {skin.dodgeBonus > 0 && <span className="text-emerald-300">💨+{skin.dodgeBonus}%</span>}
                                      {skin.energyBonus > 0 && <span className="text-cyan-300">⚡+{skin.energyBonus}</span>}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <label
                                    title="Загрузить или заменить картинку этого скина"
                                    className="rounded border border-cyan-500/40 bg-cyan-950/60 hover:bg-cyan-900 px-2 py-1 text-[9.5px] font-bold text-cyan-200 cursor-pointer"
                                  >
                                    🖼️ Фото
                                    <input
                                      type="file"
                                      accept="image/png,image/gif,image/webp,image/jpeg,image/svg+xml"
                                      onChange={(e) => handleAdminUpdatePlayerSkinImage(skin.id, e)}
                                      className="hidden"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    disabled={isUpdatingDb}
                                    onClick={() => handleAdminEquipSkinForPlayer(isEquipped ? null : skin.id)}
                                    className={`rounded px-2.5 py-1 text-[9.5px] font-bold transition-all cursor-pointer ${
                                      isEquipped
                                        ? 'border border-fuchsia-500/50 bg-slate-800 text-fuchsia-200 hover:bg-slate-700'
                                        : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white'
                                    }`}
                                  >
                                    {isEquipped ? 'Снять' : '🎭 Надеть'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isUpdatingDb}
                                    onClick={() => handleAdminRemoveSkinFromPlayer(skin.id)}
                                    className="rounded border border-red-500/40 bg-red-950/60 hover:bg-red-900 px-2 py-1 text-[9.5px] font-bold text-red-300 cursor-pointer"
                                    title="Удалить скин из коллекции игрока"
                                  >
                                    🗑️ Изъять
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Добавить любой скин в коллекцию игрока */}
                      <div className="mt-2.5 rounded-lg border border-slate-800 bg-slate-950 p-2">
                        <div className="mb-1 text-[10px] font-bold text-fuchsia-300">
                          ➕ Выдать скин в коллекцию игрока ({targetPlayerNick || hero.nick}):
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <select
                            value={selectedSkinToGrant || (shopSkins[0]?.id ?? '')}
                            onChange={(e) => setSelectedSkinToGrant(e.target.value)}
                            className="flex-1 min-w-[200px] rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10.5px] text-white outline-none"
                          >
                            {shopSkins.map((s) => (
                              <option key={s.id} value={s.id}>
                                [Ур.{s.lvl}] {s.name} ({s.currency === 'crystals' ? `${s.priceCrystals}💎` : `${s.priceGold}🪙`}) — ❤️+{s.hpBonus} ⚔️+{s.dmgBonus}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={isUpdatingDb || shopSkins.length === 0}
                            onClick={() =>
                              handleAdminGrantSkinToPlayer(
                                selectedSkinToGrant || (shopSkins[0]?.id ?? '')
                              )
                            }
                            className="rounded bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 px-3 py-1 text-[10.5px] font-bold text-white shadow cursor-pointer"
                          >
                            🎭 Выдать в коллекцию
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* ==================== TAB: BOSSES IN ALL PYRAMIDS (SHOW & EDIT) ==================== */}
          {activeTab === 'bosses' && (
            <div className="space-y-3">
              {/* 1. Глобальное управление показами и частотой появления боссов во всех пирамидах */}
              <div className="rounded-xl border border-amber-500/60 bg-gradient-to-b from-amber-950/50 via-slate-900 to-black p-3 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-black text-amber-400">
                      <span>👑</span>
                      <span>Показы и частота боссов во всех Пирамидах (П1, П2, П3)</span>
                    </div>
                    <p className="text-[10px] text-slate-300">
                      Контроль отображения боссов на картах всех 3 пирамид, частота их появления, респавн и характеристики
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={refreshLivePyramidBosses}
                      disabled={isLoadingLiveBosses}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[10.5px] font-bold text-slate-200 hover:bg-slate-700"
                    >
                      {isLoadingLiveBosses ? '⏳...' : '🔄 Обновить статус карт'}
                    </button>
                    {onSpawnBossesInAllPyramids && (
                      <button
                        type="button"
                        onClick={async () => {
                          await onSpawnBossesInAllPyramids();
                          setTimeout(refreshLivePyramidBosses, 600);
                        }}
                        className="rounded-lg border border-red-500/70 bg-gradient-to-r from-red-600 to-amber-600 px-3 py-1.5 text-[10.5px] font-black text-white shadow hover:from-red-500 hover:to-amber-500 active:scale-95"
                      >
                        ⚡ Показать / Призвать боссов во всех пирамидах
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isSavingShop || isSavingMonsters}
                      onClick={async () => {
                        await handleSaveShopCatalog();
                        await handleSaveAllMonsters(true);
                        setTimeout(refreshLivePyramidBosses, 600);
                      }}
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[10.5px] font-black text-slate-950 shadow hover:bg-emerald-400 disabled:opacity-50 active:scale-95"
                    >
                      💾 Сохранить и применить ко всем пирамидам
                    </button>
                  </div>
                </div>

                {/* Live-статус показов боссов по 3 пирамидам прямо сейчас */}
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[1, 2, 3].map((tierNum) => {
                    const liveInfo = livePyramidBosses[tierNum];
                    const tierBossConfigs = monsters.filter(
                      (m) => m.tier === tierNum && (m.isBoss || m.rowLimit === 'boss')
                    );
                    const allEnabled = tierBossConfigs.every((b) => b.enabled);
                    return (
                      <div
                        key={tierNum}
                        className="rounded-lg border border-amber-500/30 bg-slate-950/90 p-2.5"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                          <span className="text-xs font-black text-amber-300">
                            🔺 Пирамида {tierNum} ({tierNum === 1 ? '1–5' : tierNum === 2 ? '6–10' : '11–20'} ур.)
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold ${
                              (liveInfo?.count || 0) > 0
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            На карте: {liveInfo?.count ?? 0} 👑
                          </span>
                        </div>

                        <div className="mt-1.5 space-y-1 text-[10px]">
                          {liveInfo && liveInfo.bosses.length > 0 ? (
                            liveInfo.bosses.map((b, idx) => (
                              <div
                                key={`${tierNum}_live_${idx}`}
                                className="flex items-center justify-between rounded bg-slate-900 px-2 py-1 text-slate-200"
                              >
                                <span className="truncate font-bold text-amber-200">
                                  {b.name} (Ур.{b.lvl})
                                </span>
                                <span className="ml-1 shrink-0 text-[9.5px] text-rose-300 font-mono">
                                  ❤️{b.hp}/{b.maxHp} [{b.row}:{b.col}]
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="rounded bg-slate-900/60 py-1.5 text-center text-[10px] text-slate-400">
                              Босс убит или ожидает респавна
                            </div>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
                          <span className="text-[9.5px] text-slate-400">
                            Показ боссов в П{tierNum}:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextState = !allEnabled;
                              setMonsters((prev) =>
                                prev.map((m) =>
                                  m.tier === tierNum && (m.isBoss || m.rowLimit === 'boss')
                                    ? { ...m, enabled: nextState }
                                    : m
                                )
                              );
                            }}
                            className={`rounded px-2 py-0.5 text-[9.5px] font-black transition-all ${
                              allEnabled
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-900/70 text-rose-200'
                            }`}
                          >
                            {allEnabled ? '✅ ВКЛЮЧЕН' : '⛔ ВЫКЛЮЧЕН'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Быстрые пресеты частоты показа боссов во всех пирамидах */}
                <div className="mb-2.5">
                  <label className="text-[10px] font-bold text-amber-300">
                    ⚡ Быстрый выбор частоты показов боссов во всех пирамидах (в 1 клик):
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                    {[
                      { label: '🐢 Редко', freq: 5, interval: 180, desc: '5% шанс / 180с' },
                      { label: '⚔️ Обычная', freq: 15, interval: 60, desc: '15% шанс / 60с' },
                      { label: '⚡ Часто', freq: 35, interval: 30, desc: '35% шанс / 30с' },
                      { label: '🔥 Босс-раш', freq: 70, interval: 15, desc: '70% шанс / 15с' },
                      { label: '👑 Максимум', freq: 100, interval: 10, desc: '100% шанс / 10с' }
                    ].map((preset) => {
                      const isSelected = (featureFlags.bossSpawnFrequency ?? 15) === preset.freq;
                      return (
                        <button
                          key={preset.freq}
                          type="button"
                          onClick={() => {
                            handleUpdateFeatureFlag('bossSpawnFrequency', preset.freq);
                            handleUpdateFeatureFlag('bossRespawnIntervalSec', preset.interval);
                          }}
                          className={`flex flex-col items-center justify-center rounded-lg border p-1.5 text-center transition-all ${
                            isSelected
                              ? 'border-amber-400 bg-amber-500/20 text-amber-300 font-black shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                              : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="text-[11px] font-bold">{preset.label}</span>
                          <span className="text-[9px] text-slate-400">{preset.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ползунки глобальной частоты и времени респавна */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10.5px] font-bold text-amber-300">
                        🎲 Частота показа боссов среди клеток пирамид (%):
                      </label>
                      <span className="font-mono text-xs font-black text-amber-400">
                        {featureFlags.bossSpawnFrequency ?? 15}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={featureFlags.bossSpawnFrequency ?? 15}
                      onChange={(e) =>
                        handleUpdateFeatureFlag('bossSpawnFrequency', parseInt(e.target.value, 10))
                      }
                      className="mt-2 w-full accent-amber-400"
                    />
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="text-[9px] text-slate-400">Точное значение (%):</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={featureFlags.bossSpawnFrequency ?? 15}
                        onChange={(e) =>
                          handleUpdateFeatureFlag(
                            'bossSpawnFrequency',
                            Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0))
                          )
                        }
                        className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-center text-xs font-bold text-amber-300 outline-none"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10.5px] font-bold text-amber-300">
                        ⏱️ Время появления / респавна боссов во всех пирамидах (сек):
                      </label>
                      <span className="font-mono text-xs font-black text-amber-400">
                        {featureFlags.bossRespawnIntervalSec ?? 60} сек
                      </span>
                    </div>
                    <input
                      type="number"
                      min={5}
                      max={3600}
                      value={featureFlags.bossRespawnIntervalSec ?? 60}
                      onChange={(e) =>
                        handleUpdateFeatureFlag(
                          'bossRespawnIntervalSec',
                          Math.max(5, parseInt(e.target.value, 10) || 60)
                        )
                      }
                      className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-bold text-amber-300 outline-none"
                    />
                    <div className="mt-1 text-[9px] text-slate-400">
                      Каждые {featureFlags.bossRespawnIntervalSec ?? 60} сек проверяется и обновляется показ боссов в Пирамидах 1, 2 и 3.
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Индивидуальная настройка каждого Босса в Пирамидах 1, 2 и 3 */}
              {[1, 2, 3].map((tierNum) => {
                const tierBosses = monsters.filter(
                  (m) => m.tier === tierNum && (m.isBoss || m.rowLimit === 'boss' || m.rowLimit === 'rare_boss')
                );
                return (
                  <div
                    key={`boss_tier_editor_${tierNum}`}
                    className="rounded-xl border border-slate-800 bg-slate-900/90 p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-amber-300">
                          👑 Боссы Пирамиды {tierNum} ({tierNum === 1 ? '1–5 ур.' : tierNum === 2 ? '6–10 ур.' : '11–20 ур.'})
                        </span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                          Всего боссов: {tierBosses.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={isSavingMonsters}
                        onClick={() => handleSaveAllMonsters(true)}
                        className="rounded-lg bg-amber-600 px-2.5 py-1 text-[10.5px] font-black text-white hover:bg-amber-500 disabled:opacity-50"
                      >
                        {isSavingMonsters ? '⏳...' : `💾 Сохранить боссов П${tierNum}`}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {tierBosses.map((boss) => (
                        <div
                          key={boss.id}
                          className={`rounded-lg border p-2.5 transition-all ${
                            boss.enabled
                              ? 'border-amber-500/40 bg-slate-950'
                              : 'border-slate-800 bg-slate-950/40 opacity-60'
                          }`}
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={boss.enabled}
                                onChange={(e) =>
                                  handleUpdateMonsterField(boss.id, 'enabled', e.target.checked)
                                }
                                className="h-4 w-4 accent-amber-500"
                                title="Включить или выключить показ этого босса в пирамиде"
                              />
                              <span className="text-base">{boss.icon}</span>
                              <input
                                type="text"
                                value={boss.name}
                                onChange={(e) =>
                                  handleUpdateMonsterField(boss.id, 'name', e.target.value)
                                }
                                className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-bold text-amber-200 outline-none focus:border-amber-500"
                              />
                              <span className="rounded bg-red-950 px-1.5 py-0.5 text-[9.5px] font-bold text-red-300 border border-red-500/30">
                                {boss.rowLimit === 'rare_boss' ? 'РЕДКИЙ БОСС' : `БОСС П${tierNum}`}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="text-[10px] text-slate-400">Пирамида:</label>
                              <select
                                value={boss.tier}
                                onChange={(e) =>
                                  handleUpdateMonsterField(
                                    boss.id,
                                    'tier',
                                    Number(e.target.value) as 1 | 2 | 3
                                  )
                                }
                                className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-amber-300"
                              >
                                <option value={1}>Пирамида 1</option>
                                <option value={2}>Пирамида 2</option>
                                <option value={3}>Пирамида 3</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                            <div>
                              <label className="text-[9.5px] font-bold text-cyan-300">
                                🎲 Частота показа (1-100):
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={boss.spawnWeight}
                                onChange={(e) =>
                                  handleUpdateMonsterField(
                                    boss.id,
                                    'spawnWeight',
                                    Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1))
                                  )
                                }
                                className="mt-0.5 w-full rounded border border-cyan-500/40 bg-slate-900 px-2 py-1 text-xs font-black text-cyan-300 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9.5px] text-purple-300">Уровень:</label>
                              <input
                                type="number"
                                min={1}
                                max={MAX_LEVEL}
                                value={boss.lvl}
                                onChange={(e) =>
                                  handleUpdateMonsterField(
                                    boss.id,
                                    'lvl',
                                    Math.max(1, Math.min(MAX_LEVEL, parseInt(e.target.value, 10) || 1))
                                  )
                                }
                                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-purple-300 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9.5px] text-rose-400">❤️ Жизни (HP):</label>
                              <input
                                type="number"
                                min={1}
                                value={boss.hp}
                                onChange={(e) =>
                                  handleUpdateMonsterField(
                                    boss.id,
                                    'hp',
                                    Math.max(1, parseInt(e.target.value, 10) || 1)
                                  )
                                }
                                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-rose-300 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9.5px] text-orange-400">⚔️ Урон:</label>
                              <input
                                type="number"
                                min={1}
                                value={boss.dmg ?? 50}
                                onChange={(e) =>
                                  handleUpdateMonsterField(
                                    boss.id,
                                    'dmg',
                                    Math.max(1, parseInt(e.target.value, 10) || 1)
                                  )
                                }
                                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-orange-300 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9.5px] text-amber-400">🪙 Золото:</label>
                              <input
                                type="number"
                                min={0}
                                value={boss.goldMax}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                  handleUpdateMonsterField(boss.id, 'goldMin', val);
                                  handleUpdateMonsterField(boss.id, 'goldMax', val);
                                }}
                                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-amber-300 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9.5px] text-emerald-400">⭐ Опыт (EXP):</label>
                              <input
                                type="number"
                                min={1}
                                value={boss.expReward}
                                onChange={(e) =>
                                  handleUpdateMonsterField(
                                    boss.id,
                                    'expReward',
                                    Math.max(1, parseInt(e.target.value, 10) || 1)
                                  )
                                }
                                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-emerald-300 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ==================== TAB 2: MONSTERS & PYRAMIDS MANAGEMENT ==================== */}
          {activeTab === 'monsters' && (
            <>
              {/* 1. Создание нового монстра для любой Пирамиды */}
              <div className="rounded-xl border border-amber-500/50 bg-slate-900/90 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-bold text-amber-300">
                    ➕ Создать нового монстра для Пирамиды на выбор
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Полный контроль спавна, HP, дропа и наград
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-300">Название монстра:</label>
                    <input
                      type="text"
                      value={newMobName}
                      onChange={(e) => setNewMobName(e.target.value)}
                      placeholder="Напр. Проклятый Фараон"
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-bold text-white outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-amber-300">Пирамида:</label>
                    <select
                      value={newMobTier}
                      onChange={(e) => {
                        const t = Number(e.target.value) as 1 | 2 | 3;
                        setNewMobTier(t);
                        if (t === 1) {
                          setNewMobLvl('3');
                          setNewMobHp('90');
                        } else if (t === 2) {
                          setNewMobLvl('8');
                          setNewMobHp('320');
                        } else {
                          setNewMobLvl('15');
                          setNewMobHp('850');
                        }
                      }}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-amber-300 outline-none"
                    >
                      <option value={1}>Пирамида 1 (1–5 ур.)</option>
                      <option value={2}>Пирамида 2 (6–10 ур.)</option>
                      <option value={3}>Пирамида 3 (11–20 ур.)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-purple-300">Ряд / Роль в Пирамиде:</label>
                    <select
                      value={newMobRowLimit}
                      onChange={(e) => setNewMobRowLimit(e.target.value as any)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-purple-300 outline-none"
                    >
                      <option value="any">Везде (обычный)</option>
                      <option value="front">Верхние ряды (охрана)</option>
                      <option value="mid">Средние ряды</option>
                      <option value="boss">👑 Босс Пирамиды</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-300">Уровень монстра:</label>
                    <input
                      type="number"
                      min={1}
                      max={MAX_LEVEL}
                      value={newMobLvl}
                      onChange={(e) => setNewMobLvl(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-rose-400">Жизни (HP) ❤️:</label>
                    <input
                      type="number"
                      min={1}
                      value={newMobHp}
                      onChange={(e) => setNewMobHp(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-rose-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-orange-400">Урон монстра ⚔️:</label>
                    <input
                      type="number"
                      min={1}
                      value={newMobDmg}
                      onChange={(e) => setNewMobDmg(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-orange-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-cyan-300">Частота спавна (1–100):</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newMobSpawnWeight}
                      onChange={(e) => setNewMobSpawnWeight(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-cyan-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-emerald-300">Шанс дропа вещей (%):</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={newMobDropChance}
                      onChange={(e) => setNewMobDropChance(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-emerald-300 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-amber-400">Золото (Мин 🪙):</label>
                    <input
                      type="number"
                      min={0}
                      value={newMobGoldMin}
                      onChange={(e) => setNewMobGoldMin(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-amber-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-amber-400">Золото (Макс 🪙):</label>
                    <input
                      type="number"
                      min={1}
                      value={newMobGoldMax}
                      onChange={(e) => setNewMobGoldMax(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-amber-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-emerald-400">Награда Опыт (EXP):</label>
                    <input
                      type="number"
                      min={1}
                      value={newMobExp}
                      onChange={(e) => setNewMobExp(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-emerald-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-cyan-400">Награда Кристаллы 💎:</label>
                    <input
                      type="number"
                      min={0}
                      value={newMobCrystals}
                      onChange={(e) => setNewMobCrystals(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-cyan-300 outline-none"
                    />
                  </div>
                </div>

                {/* Выбор иконки для нового монстра */}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-slate-400 mr-1">Иконка:</span>
                  {QUICK_MOB_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewMobIcon(ic)}
                      className={`h-6 w-6 rounded text-xs flex items-center justify-center ${
                        newMobIcon === ic
                          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300'
                          : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={newMobIcon}
                    onChange={(e) => setNewMobIcon(e.target.value)}
                    className="ml-1 w-12 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-center text-xs"
                  />
                </div>

                <button
                  type="button"
                  disabled={isSavingMonsters}
                  onClick={handleCreateCustomMonster}
                  className="mt-2.5 w-full rounded-lg bg-amber-600 py-2 text-xs font-black text-white shadow hover:bg-amber-500 disabled:opacity-50"
                >
                  ➕ Добавить монстра в Пирамиду {newMobTier}
                </button>
              </div>

              {/* 1.4 Быстрая настройка частоты появления боссов во всех пирамидах */}
              <div className="rounded-xl border border-amber-500/50 bg-gradient-to-b from-amber-950/40 via-slate-900 to-black p-3 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
                  <div>
                    <div className="flex items-center gap-1.5 font-black text-amber-400 text-sm">
                      <span>👑</span>
                      <span>Частота появления боссов во всех пирамидах</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Управление частотой появления боссов в Пирамидах 1, 2 и 3, пресеты в 1 клик и мгновенный призыв
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onSpawnBossesInAllPyramids && (
                      <button
                        type="button"
                        onClick={onSpawnBossesInAllPyramids}
                        className="rounded-lg border border-red-500/60 bg-gradient-to-r from-red-600 to-amber-600 px-3 py-1.5 text-[10.5px] font-black text-white shadow hover:from-red-500 hover:to-amber-500 active:scale-95"
                        title="Принудительно воскресить и призвать верховных боссов во всех пирамидах прямо сейчас"
                      >
                        ⚡ Призвать боссов во всех пирамидах
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isSavingShop}
                      onClick={handleSaveShopCatalog}
                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-[10.5px] font-black text-slate-950 shadow hover:bg-amber-400 disabled:opacity-50 active:scale-95"
                    >
                      {isSavingShop ? '⏳...' : '💾 Сохранить частоту'}
                    </button>
                  </div>
                </div>

                {/* Быстрые пресеты частоты боссов в 1 клик */}
                <div className="mb-2.5">
                  <label className="text-[10px] font-bold text-amber-300">
                    ⚡ Быстрый выбор частоты боссов (пресеты в 1 клик):
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {[
                      { label: '🐢 Редко', freq: 5, interval: 180, desc: '5% шанс / 180с' },
                      { label: '⚔️ Обычная', freq: 15, interval: 60, desc: '15% шанс / 60с' },
                      { label: '⚡ Часто', freq: 35, interval: 30, desc: '35% шанс / 30с' },
                      { label: '🔥 Босс-раш', freq: 70, interval: 15, desc: '70% шанс / 15с' }
                    ].map((preset) => {
                      const isSelected = (featureFlags.bossSpawnFrequency ?? 15) === preset.freq;
                      return (
                        <button
                          key={preset.freq}
                          type="button"
                          onClick={() => {
                            handleUpdateFeatureFlag('bossSpawnFrequency', preset.freq);
                            handleUpdateFeatureFlag('bossRespawnIntervalSec', preset.interval);
                          }}
                          className={`flex flex-col items-center justify-center rounded-lg border p-1.5 text-center transition-all ${
                            isSelected
                              ? 'border-amber-400 bg-amber-500/20 text-amber-300 font-black shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                              : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="text-[11px] font-bold">{preset.label}</span>
                          <span className="text-[9px] text-slate-400">{preset.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ручная тонкая настройка */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-amber-300">
                        🎲 Частота появления боссов среди мобов:
                      </label>
                      <span className="font-mono text-xs font-black text-amber-400">
                        {featureFlags.bossSpawnFrequency ?? 15}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={featureFlags.bossSpawnFrequency ?? 15}
                      onChange={(e) =>
                        handleUpdateFeatureFlag('bossSpawnFrequency', parseInt(e.target.value, 10))
                      }
                      className="mt-2 w-full accent-amber-400"
                    />
                    <div className="mt-1 flex justify-between text-[8.5px] text-slate-500">
                      <span>0% (только вершина)</span>
                      <span>50%</span>
                      <span>100% (только боссы)</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-amber-300">
                        ⏱️ Интервал респавна верховного босса (сек):
                      </label>
                      <span className="font-mono text-xs font-black text-amber-400">
                        {featureFlags.bossRespawnIntervalSec ?? 60} с
                      </span>
                    </div>
                    <input
                      type="number"
                      min={10}
                      max={600}
                      value={featureFlags.bossRespawnIntervalSec ?? 60}
                      onChange={(e) =>
                        handleUpdateFeatureFlag(
                          'bossRespawnIntervalSec',
                          Math.max(10, parseInt(e.target.value, 10) || 60)
                        )
                      }
                      className="mt-1.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-amber-300 outline-none"
                    />
                    <div className="mt-1 text-[8.5px] text-slate-400">
                      Интервал до повторного появления босса на клетке [0,0] после убийства
                    </div>
                  </div>
                </div>
              </div>

              {/* 1.5 Быстрая настройка спавна Кристаллов и Редких Боссов в Пирамидах */}
              <div className="rounded-xl border border-cyan-500/40 bg-slate-900/90 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-cyan-300">
                      💎 Настройка спавна Кристаллов и Редких Боссов в Пирамиде
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Интервал автоматического выброса кристаллов на клетки Пирамиды и награда с редких боссов
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSavingShop}
                    onClick={handleSaveShopCatalog}
                    className="rounded-lg bg-cyan-600 px-3 py-1.5 text-[10.5px] font-black text-white shadow hover:bg-cyan-500 disabled:opacity-50"
                  >
                    {isSavingShop ? '⏳...' : '💾 Сохранить спавн кристаллов'}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <label className="text-[10px] font-bold text-cyan-300">
                      ⏱️ Интервал спавна кристалла на карте (сек):
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={3600}
                      value={featureFlags.crystalSpawnIntervalSec || 60}
                      onChange={(e) =>
                        handleUpdateFeatureFlag(
                          'crystalSpawnIntervalSec',
                          Math.max(10, parseInt(e.target.value, 10) || 60)
                        )
                      }
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-cyan-300 outline-none"
                    />
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <label className="text-[10px] font-bold text-cyan-300">
                      💎 Кол-во кристаллов за 1 найденную жилу на карте:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={featureFlags.crystalSpawnAmount || 1}
                      onChange={(e) =>
                        handleUpdateFeatureFlag(
                          'crystalSpawnAmount',
                          Math.max(1, parseInt(e.target.value, 10) || 1)
                        )
                      }
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-cyan-300 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Фильтр и сохранение всех существующих монстров */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap gap-1">
                    {[
                      { key: 'all', label: `Все (${monsters.length})` },
                      { key: 1, label: 'Пирамида 1 (1-5)' },
                      { key: 2, label: 'Пирамида 2 (6-10)' },
                      { key: 3, label: 'Пирамида 3 (11-20)' },
                      { key: 'rare', label: 'Редкие Боссы' }
                    ].map((tab) => (
                      <button
                        key={String(tab.key)}
                        type="button"
                        onClick={() => setMonsterTierFilter(tab.key as any)}
                        className={`rounded-lg px-2.5 py-1 text-[10.5px] font-bold ${
                          monsterTierFilter === tab.key
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleResetMonstersToDefault}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700"
                  >
                    ↩️ Сброс к стандартным
                  </button>
                </div>

                {/* Кнопки сохранения и обновления карты */}
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={isSavingMonsters}
                    onClick={() => handleSaveAllMonsters(false)}
                    className="rounded-lg bg-emerald-600 py-2 text-xs font-black text-white shadow hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {isSavingMonsters ? '⏳ Сохранение...' : '💾 Сохранить настройки всех монстров'}
                  </button>
                  <button
                    type="button"
                    disabled={isSavingMonsters}
                    onClick={() => handleSaveAllMonsters(true)}
                    className="rounded-lg bg-indigo-600 py-2 text-xs font-black text-white shadow hover:bg-indigo-500 disabled:opacity-50"
                  >
                    🔄 Сохранить и обновить карту Пирамиды
                  </button>
                </div>

                {/* Карточки всех монстров */}
                <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                  {filteredMonsters.map((mob) => (
                    <div
                      key={mob.id}
                      className={`rounded-lg border p-2.5 transition-all ${
                        mob.enabled
                          ? 'border-slate-700 bg-slate-950'
                          : 'border-slate-800/60 bg-slate-950/40 opacity-60'
                      }`}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={mob.enabled}
                            onChange={(e) =>
                              handleUpdateMonsterField(mob.id, 'enabled', e.target.checked)
                            }
                            className="h-4 w-4 accent-emerald-500"
                            title="Включить / выключить появление монстра"
                          />
                          <span className="text-base">{mob.icon}</span>
                          <input
                            type="text"
                            value={mob.name}
                            onChange={(e) =>
                              handleUpdateMonsterField(mob.id, 'name', e.target.value)
                            }
                            className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-xs font-bold text-white outline-none focus:border-amber-500"
                          />
                          <span className="rounded bg-purple-950 px-1.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/30">
                            Ур. {mob.lvl}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <select
                            value={mob.tier}
                            onChange={(e) =>
                              handleUpdateMonsterField(
                                mob.id,
                                'tier',
                                Number(e.target.value) as 1 | 2 | 3
                              )
                            }
                            className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-amber-300"
                          >
                            <option value={1}>Пирамида 1</option>
                            <option value={2}>Пирамида 2</option>
                            <option value={3}>Пирамида 3</option>
                          </select>
                          {mob.isBoss && (
                            <span className="rounded bg-red-950 px-1.5 py-0.5 text-[9.5px] font-bold text-red-300 border border-red-500/30">
                              БОСС
                            </span>
                          )}
                          {mob.isCustom && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomMonster(mob.id, mob.name)}
                              className="rounded bg-red-900/70 px-1.5 py-0.5 text-[10px] font-bold text-red-200 hover:bg-red-800"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        <div>
                          <label className="text-[9.5px] text-rose-400">❤️ Жизни (HP):</label>
                          <input
                            type="number"
                            min={1}
                            value={mob.hp}
                            onChange={(e) =>
                              handleUpdateMonsterField(
                                mob.id,
                                'hp',
                                Math.max(1, parseInt(e.target.value, 10) || 1)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-rose-300 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9.5px] text-orange-400">⚔️ Урон монстра:</label>
                          <input
                            type="number"
                            min={1}
                            value={mob.dmg ?? 20}
                            onChange={(e) =>
                              handleUpdateMonsterField(
                                mob.id,
                                'dmg',
                                Math.max(1, parseInt(e.target.value, 10) || 1)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-orange-300 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9.5px] text-cyan-300">
                            🎲 Частота спавна (1-100):
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={mob.spawnWeight}
                            onChange={(e) =>
                              handleUpdateMonsterField(
                                mob.id,
                                'spawnWeight',
                                Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 50))
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-cyan-300 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9.5px] text-emerald-300">
                            🎁 Шанс дропа вещей (%):
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={mob.dropChance}
                            onChange={(e) =>
                              handleUpdateMonsterField(
                                mob.id,
                                'dropChance',
                                Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0))
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-emerald-300 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9.5px] text-purple-300">Уровень монстра:</label>
                          <input
                            type="number"
                            min={1}
                            max={MAX_LEVEL}
                            value={mob.lvl}
                            onChange={(e) =>
                              handleUpdateMonsterField(
                                mob.id,
                                'lvl',
                                Math.max(1, Math.min(MAX_LEVEL, parseInt(e.target.value, 10) || 1))
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-purple-300 outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[9.5px] text-amber-400">🪙 Золото Мин:</label>
                          <input
                            type="number"
                            min={0}
                            value={mob.goldMin}
                            onChange={(e) =>
                              handleUpdateMonsterField(
                                mob.id,
                                'goldMin',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-amber-300 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9.5px] text-amber-400">🪙 Золото Макс:</label>
                          <input
                            type="number"
                            min={0}
                            value={mob.goldMax}
                            onChange={(e) =>
                              handleUpdateMonsterField(
                                mob.id,
                                'goldMax',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-amber-300 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9.5px] text-emerald-400">✨ Награда EXP:</label>
                          <input
                            type="number"
                            min={0}
                            value={mob.expReward}
                            onChange={(e) =>
                              handleUpdateMonsterField(
                                mob.id,
                                'expReward',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-emerald-300 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9.5px] text-cyan-400">💎 Кристаллы:</label>
                          <input
                            type="number"
                            min={0}
                            value={mob.crystalsReward}
                            onChange={(e) =>
                              handleUpdateMonsterField(
                                mob.id,
                                'crystalsReward',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-cyan-300 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ==================== TAB 3: SHOP & GAME FEATURES MANAGEMENT ==================== */}
          {activeTab === 'shop' && (
            <>
              {/* 1. Управление функциями игры (Рулетка, Обмен, Премиум, Магазин) */}
              <div className="rounded-xl border border-cyan-500/40 bg-slate-900/90 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-bold text-cyan-300">
                    ⚙️ Управление функциями игры (Вкл / Выкл в 1 клик)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Рулетка, Обмен и Премиум временно закрыты по умолчанию
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { key: 'rouletteEnabled' as const, label: '🎡 Рулетка', desc: 'Колесо удачи' },
                    { key: 'exchangeEnabled' as const, label: '🏦 Обмен / Биржа', desc: 'Банк и обмен валют' },
                    { key: 'premiumEnabled' as const, label: '👑 Премиум', desc: 'VIP статус и бонусы' },
                    { key: 'shopEnabled' as const, label: '🛒 Магазин', desc: 'Покупка экипировки' }
                  ].map((feat) => {
                    const isOn = Boolean(featureFlags[feat.key]);
                    return (
                      <div
                        key={feat.key}
                        className={`rounded-lg border p-2.5 flex flex-col justify-between gap-2 ${
                          isOn
                            ? 'border-emerald-500/50 bg-emerald-950/25'
                            : 'border-red-500/40 bg-red-950/20'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-white text-xs">{feat.label}</div>
                          <div className="text-[9.5px] text-slate-400">{feat.desc}</div>
                        </div>
                        <button
                          type="button"
                          disabled={isSavingShop}
                          onClick={() => handleToggleFeatureFlag(feat.key)}
                          className={`w-full rounded py-1 text-[10px] font-black transition-all ${
                            isOn
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'bg-red-800 text-red-100 hover:bg-red-700'
                          }`}
                        >
                          {isOn ? '✅ ВКЛЮЧЕНО' : '🔒 ЗАКРЫТО'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 💎 Редактор Банка Кристаллов ($) */}
              <div className="rounded-xl border-2 border-cyan-500/60 bg-gradient-to-b from-cyan-950/40 via-slate-900 to-slate-950 p-3 space-y-3 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/30 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏦</span>
                    <div>
                      <div className="font-black text-cyan-300 text-xs sm:text-sm">
                        Редактор Банка Кристаллов (Пакеты за $)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Управление пакетами кристаллов в вкладке «🏦 Банк», ценами в $, ссылкой и инструкцией оплаты
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isSavingShop}
                      onClick={async () => {
                        const nextFlags: GameFeatureFlags = {
                          ...featureFlags,
                          bankPurchaseEnabled: featureFlags.bankPurchaseEnabled === false ? true : false
                        };
                        setFeatureFlags(nextFlags);
                        setIsSavingShop(true);
                        try {
                          await saveShopAndFeaturesToSupabase(shopCatalog, nextFlags, shopSkins);
                          if (onShopAndFeaturesUpdated) onShopAndFeaturesUpdated(shopCatalog, nextFlags, shopSkins);
                          showToast(
                            nextFlags.bankPurchaseEnabled !== false
                              ? '🏦 Покупка кристаллов в Банке ОТКРЫТА!'
                              : '🔒 Покупка кристаллов в Банке ЗАКРЫТА!'
                          );
                        } finally {
                          setIsSavingShop(false);
                        }
                      }}
                      className={`rounded px-2.5 py-1 text-[10px] font-black transition-all cursor-pointer ${
                        featureFlags.bankPurchaseEnabled !== false
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                          : 'bg-red-800 text-white hover:bg-red-700'
                      }`}
                    >
                      {featureFlags.bankPurchaseEnabled !== false ? '✅ БАНК ОТКРЫТ' : '🔒 БАНК ЗАКРЫТ'}
                    </button>
                    <button
                      type="button"
                      disabled={isSavingShop}
                      onClick={async () => {
                        const nextFlags: GameFeatureFlags = {
                          ...featureFlags,
                          bankPackages: DEFAULT_BANK_PACKAGES.map((p) => ({ ...p }))
                        };
                        setFeatureFlags(nextFlags);
                        setIsSavingShop(true);
                        try {
                          await saveShopAndFeaturesToSupabase(shopCatalog, nextFlags, shopSkins);
                          if (onShopAndFeaturesUpdated) onShopAndFeaturesUpdated(shopCatalog, nextFlags, shopSkins);
                          showToast('🔄 Стандартные тарифы Банка (100💎=1$ ... 5000💎=25$) восстановлены!');
                        } finally {
                          setIsSavingShop(false);
                        }
                      }}
                      className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[10px] font-bold text-slate-200 cursor-pointer"
                    >
                      🔄 Сбросить к стандартным
                    </button>
                  </div>
                </div>

                {/* Список пакетов банка */}
                {(() => {
                  const currentPackages: BankPackageConfig[] = getBankPackages(featureFlags);
                  const updateBankPackagesList = (nextList: BankPackageConfig[]) => {
                    setFeatureFlags((prev) => ({
                      ...prev,
                      bankPackages: nextList
                    }));
                  };

                  return (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {currentPackages.map((pkg, idx) => (
                          <div
                            key={pkg.id || idx}
                            className={`rounded-lg border p-2.5 space-y-2 text-[11px] ${
                              pkg.enabled !== false
                                ? 'border-cyan-500/40 bg-slate-950/90'
                                : 'border-slate-800 bg-slate-950/40 opacity-60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <input
                                type="text"
                                value={pkg.label || ''}
                                onChange={(e) => {
                                  const next = currentPackages.map((item, i) =>
                                    i === idx ? { ...item, label: e.target.value } : item
                                  );
                                  updateBankPackagesList(next);
                                }}
                                placeholder="Название пакета (напр. Популярный)"
                                className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10.5px] font-bold text-cyan-200 outline-none focus:border-cyan-400"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const next = currentPackages.map((item, i) =>
                                    i === idx ? { ...item, enabled: item.enabled === false ? true : false } : item
                                  );
                                  updateBankPackagesList(next);
                                }}
                                className={`rounded px-2 py-0.5 text-[9px] font-bold cursor-pointer ${
                                  pkg.enabled !== false
                                    ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {pkg.enabled !== false ? 'Вкл' : 'Скрыт'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = currentPackages.filter((_, i) => i !== idx);
                                  updateBankPackagesList(next);
                                }}
                                className="rounded border border-red-500/40 bg-red-950/60 hover:bg-red-900 px-2 py-0.5 text-[9px] font-bold text-red-300 cursor-pointer"
                                title="Удалить пакет"
                              >
                                🗑️
                              </button>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5">
                              <div>
                                <label className="block text-[9px] text-slate-400 mb-0.5">💎 Кристаллов:</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={pkg.crystals}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                    const next = currentPackages.map((item, i) =>
                                      i === idx ? { ...item, crystals: val } : item
                                    );
                                    updateBankPackagesList(next);
                                  }}
                                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-black text-cyan-300 outline-none focus:border-cyan-400"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-400 mb-0.5">💵 Цена ($):</label>
                                <input
                                  type="number"
                                  min={0.1}
                                  step="0.5"
                                  value={pkg.priceUsd}
                                  onChange={(e) => {
                                    const val = Math.max(0.1, parseFloat(e.target.value) || 1);
                                    const next = currentPackages.map((item, i) =>
                                      i === idx ? { ...item, priceUsd: val } : item
                                    );
                                    updateBankPackagesList(next);
                                  }}
                                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-black text-emerald-300 outline-none focus:border-emerald-400"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-400 mb-0.5">🎁 Бонус (+💎):</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={pkg.bonusCrystals || 0}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                    const next = currentPackages.map((item, i) =>
                                      i === idx ? { ...item, bonusCrystals: val } : item
                                    );
                                    updateBankPackagesList(next);
                                  }}
                                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold text-amber-300 outline-none focus:border-amber-400"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const newPkg: BankPackageConfig = {
                              id: `bank_pkg_${Date.now()}`,
                              crystals: 1000,
                              priceUsd: 5,
                              bonusCrystals: 0,
                              label: 'Новый пакет',
                              enabled: true
                            };
                            updateBankPackagesList([...currentPackages, newPkg]);
                          }}
                          className="rounded-lg border border-cyan-500/50 bg-cyan-950/70 hover:bg-cyan-900 px-3 py-1.5 text-[10.5px] font-bold text-cyan-200 cursor-pointer"
                        >
                          ➕ Добавить новый пакет кристаллов
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Инструкция и ссылка для оплаты в Банке */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">
                      🔗 Ссылка для оплаты / контакта (Telegram / Донат):
                    </label>
                    <input
                      type="text"
                      value={featureFlags.bankPaymentUrl || ''}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          bankPaymentUrl: e.target.value
                        }))
                      }
                      placeholder="Напр.: https://t.me/your_admin"
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[11px] text-cyan-200 outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">
                      📝 Инструкция для игроков при покупке в Банке:
                    </label>
                    <input
                      type="text"
                      value={featureFlags.bankPaymentInstructions || ''}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          bankPaymentInstructions: e.target.value
                        }))
                      }
                      placeholder="Для покупки кристаллов выберите пакет и напишите Администрации..."
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[11px] text-amber-200 outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSavingShop}
                  onClick={async () => {
                    setIsSavingShop(true);
                    try {
                      await saveShopAndFeaturesToSupabase(shopCatalog, featureFlags, shopSkins);
                      if (onShopAndFeaturesUpdated) {
                        onShopAndFeaturesUpdated(shopCatalog, featureFlags, shopSkins);
                      }
                      showToast('🏦 Настройки Банка и пакеты кристаллов ($) сохранены в БД Supabase!');
                    } finally {
                      setIsSavingShop(false);
                    }
                  }}
                  className="w-full rounded-lg bg-gradient-to-r from-cyan-600 via-sky-500 to-blue-600 py-2 text-xs font-black uppercase tracking-wider text-white shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  {isSavingShop ? '⏳ Сохранение Банка...' : '💾 Сохранить все пакеты и настройки Банка в БД'}
                </button>
              </div>

              {/* 🏦 Управление Обменником (Биржей) Валют */}
              <div className="rounded-xl border border-amber-500/50 bg-slate-900/90 p-3 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏦</span>
                    <div>
                      <div className="font-black text-amber-300 text-xs sm:text-sm">
                        Управление Обменником Валют (Банк и Биржа)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Настройка курсов обмена, суточных лимитов и быстрое открытие / закрытие обменника
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isSavingShop}
                    onClick={() => handleToggleFeatureFlag('exchangeEnabled')}
                    className={`rounded px-3 py-1.5 text-xs font-black transition-all ${
                      featureFlags.exchangeEnabled
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/40'
                        : 'bg-red-800 text-white hover:bg-red-700 shadow-lg shadow-red-900/40'
                    }`}
                  >
                    {featureFlags.exchangeEnabled ? '✅ ОБМЕННИК ОТКРЫТ' : '🔒 ОБМЕННИК ЗАКРЫТ'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Курс 1: Кристаллы -> Золото */}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300 text-xs">💎 Кристаллы ➔ 🪙 Золото</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = {
                            ...featureFlags,
                            crystalToGoldEnabled: featureFlags.crystalToGoldEnabled === false ? true : false
                          };
                          setFeatureFlags(next);
                        }}
                        className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                          featureFlags.crystalToGoldEnabled !== false
                            ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/40'
                            : 'bg-red-900/60 text-red-300 border border-red-500/40'
                        }`}
                      >
                        {featureFlags.crystalToGoldEnabled !== false ? 'Включено' : 'Выключено'}
                      </button>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Сколько 🪙 золота выдавать за 1 💎:</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          min={1}
                          value={featureFlags.crystalToGoldRate ?? 1000}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setFeatureFlags((prev) => ({ ...prev, crystalToGoldRate: val }));
                          }}
                          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-amber-300 outline-none"
                        />
                        <span className="text-amber-400 font-bold shrink-0">🪙</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Суточный лимит (кристаллов в день):</label>
                      <input
                        type="number"
                        min={1}
                        value={featureFlags.dailyCrystalToGoldLimit ?? 3}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setFeatureFlags((prev) => ({ ...prev, dailyCrystalToGoldLimit: val }));
                        }}
                        className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-cyan-300 outline-none"
                      />
                    </div>
                  </div>

                  {/* Курс 2: Золото -> Кристаллы */}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-yellow-300 text-xs">🪙 Золото ➔ 💎 Кристаллы</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = {
                            ...featureFlags,
                            goldToCrystalEnabled: featureFlags.goldToCrystalEnabled === false ? true : false
                          };
                          setFeatureFlags(next);
                        }}
                        className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                          featureFlags.goldToCrystalEnabled !== false
                            ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/40'
                            : 'bg-red-900/60 text-red-300 border border-red-500/40'
                        }`}
                      >
                        {featureFlags.goldToCrystalEnabled !== false ? 'Включено' : 'Выключено'}
                      </button>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Сколько 🪙 золота стоит 1 💎:</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          min={1}
                          value={featureFlags.goldToCrystalRate ?? 2000}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setFeatureFlags((prev) => ({ ...prev, goldToCrystalRate: val }));
                          }}
                          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-amber-300 outline-none"
                        />
                        <span className="text-cyan-400 font-bold shrink-0">💎</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Суточный лимит (кристаллов в день):</label>
                      <input
                        type="number"
                        min={1}
                        value={featureFlags.dailyGoldToCrystalLimit ?? 3}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setFeatureFlags((prev) => ({ ...prev, dailyGoldToCrystalLimit: val }));
                        }}
                        className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-cyan-300 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSavingShop}
                      onClick={async () => {
                        setIsSavingShop(true);
                        try {
                          const ok = await saveShopAndFeaturesToSupabase(shopCatalog, featureFlags);
                          if (onShopAndFeaturesUpdated) onShopAndFeaturesUpdated(shopCatalog, featureFlags);
                          showToast(ok ? '✅ Настройки обменника успешно сохранены в базе!' : '⚠️ Сохранено локально');
                        } finally {
                          setIsSavingShop(false);
                        }
                      }}
                      className="rounded-lg bg-gradient-to-r from-amber-600 to-yellow-600 px-4 py-1.5 text-xs font-black text-slate-950 hover:from-amber-500 hover:to-yellow-500 disabled:opacity-50"
                    >
                      💾 Сохранить курсы и лимиты обменника
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFeatureFlags((prev) => ({
                          ...prev,
                          crystalToGoldRate: 1000,
                          goldToCrystalRate: 2000,
                          dailyCrystalToGoldLimit: 3,
                          dailyGoldToCrystalLimit: 3,
                          crystalToGoldEnabled: true,
                          goldToCrystalEnabled: true
                        }));
                        showToast('Курсы сброшены к стандартным: 1 💎 = 1000 🪙, 2000 🪙 = 1 💎, лимит 3/день');
                      }}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-slate-700"
                    >
                      ↺ Сбросить к стандартным
                    </button>
                  </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedPlayerStats?.id) return;
                        try {
                          await adminModifyPlayerBalanceInSupabase(selectedPlayerStats.id, {
                            resetDailyExchangeLimits: true
                          });
                          showToast(`✅ Суточные лимиты обменника для игрока "${selectedPlayerStats.name}" сброшены!`);
                          refreshDbPlayersList();
                        } catch (e) {
                          showToast('Ошибка при сбросе лимитов');
                        }
                      }}
                      className="rounded border border-cyan-500/40 bg-cyan-950/40 px-2.5 py-1 text-[10px] font-bold text-cyan-300 hover:bg-cyan-900/50"
                    >
                      Сбросить лимиты обменника для {selectedPlayerStats.name}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedPlayerStats?.id) return;
                        try {
                          await adminModifyPlayerBalanceInSupabase(selectedPlayerStats.id, {
                            resetDailyLoginReward: true
                          });
                          showToast(`🎁 Ежедневный вход для игрока "${selectedPlayerStats.name}" сброшен!`);
                          refreshDbPlayersList();
                        } catch (e) {
                          showToast('Ошибка при сбросе');
                        }
                      }}
                      className="rounded border border-amber-500/40 bg-amber-950/40 px-2.5 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-900/50"
                    >
                      Сбросить ежедневный вход для {selectedPlayerStats.name}
                    </button>
                </div>
              </div>

              {/* 👑 Управление Премиумом (VIP) и Бонусами (как Обменник) */}
              <div className="rounded-xl border-2 border-yellow-500/60 bg-slate-900/95 p-3 space-y-3 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">👑</span>
                    <div>
                      <div className="font-black text-yellow-300 text-xs sm:text-sm">
                        Управление Премиумом (VIP) и Всеми Бонусами (редактор как Обменник)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Включайте / выключайте Премиум и настраивайте любые бонусы, которые есть в игре
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isSavingShop}
                    onClick={() => handleToggleFeatureFlag('premiumEnabled')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${
                      featureFlags.premiumEnabled
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/40'
                        : 'bg-red-800 text-white hover:bg-red-700 shadow-lg shadow-red-900/40'
                    }`}
                  >
                    {featureFlags.premiumEnabled ? '✅ ПРЕМИУМ ВКЛЮЧЕН' : '🔒 ПРЕМИУМ ВЫКЛЮЧЕН'}
                  </button>
                </div>

                {/* Цена, Валюта и Длительность Премиума */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <label className="text-[10px] font-bold text-cyan-300">Цена в кристаллах (💎):</label>
                    <input
                      type="number"
                      min={1}
                      value={featureFlags.premiumPriceCrystals ?? 300}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          premiumPriceCrystals: Math.max(1, parseInt(e.target.value, 10) || 1)
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-cyan-300 outline-none"
                    />
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <label className="text-[10px] font-bold text-amber-300">Цена в золоте (🪙):</label>
                    <input
                      type="number"
                      min={1}
                      value={featureFlags.premiumPriceGold ?? 30000}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          premiumPriceGold: Math.max(1, parseInt(e.target.value, 10) || 1)
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-amber-300 outline-none"
                    />
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <label className="text-[10px] font-bold text-slate-300">Валюта покупки:</label>
                    <select
                      value={featureFlags.premiumCurrency || 'crystals'}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          premiumCurrency: e.target.value as 'crystals' | 'gold' | 'both'
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-yellow-300 outline-none"
                    >
                      <option value="crystals">💎 Только за кристаллы</option>
                      <option value="gold">🪙 Только за золото</option>
                      <option value="both">💎 + 🪙 На выбор игрока</option>
                    </select>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <label className="text-[10px] font-bold text-emerald-300">Длительность (часов):</label>
                    <input
                      type="number"
                      min={1}
                      value={featureFlags.premiumDurationHours ?? 24}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          premiumDurationHours: Math.max(1, parseInt(e.target.value, 10) || 24)
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-emerald-300 outline-none"
                    />
                  </div>
                </div>

                {/* Все боевые и экономические бонусы Премиума */}
                <div className="rounded-lg border border-yellow-500/30 bg-slate-950/90 p-2.5 space-y-2">
                  <div className="text-[10px] font-bold text-yellow-300">
                    ✨ Все бонусы Премиума (укажите 0, если бонус не нужен):
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div>
                      <label className="text-[9.5px] text-red-300">❤️ +Здоровье (HP):</label>
                      <input
                        type="number"
                        min={0}
                        value={featureFlags.premiumHpBonus ?? 0}
                        onChange={(e) =>
                          setFeatureFlags((prev) => ({
                            ...prev,
                            premiumHpBonus: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-red-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-orange-300">⚔️ +Урон (DMG):</label>
                      <input
                        type="number"
                        min={0}
                        value={featureFlags.premiumDmgBonus ?? 0}
                        onChange={(e) =>
                          setFeatureFlags((prev) => ({
                            ...prev,
                            premiumDmgBonus: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-orange-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-rose-300">💪 +Сила (STR):</label>
                      <input
                        type="number"
                        min={0}
                        value={featureFlags.premiumStrBonus ?? 0}
                        onChange={(e) =>
                          setFeatureFlags((prev) => ({
                            ...prev,
                            premiumStrBonus: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-rose-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-teal-300">🤸 +Ловкость (AGI):</label>
                      <input
                        type="number"
                        min={0}
                        value={featureFlags.premiumAgiBonus ?? 0}
                        onChange={(e) =>
                          setFeatureFlags((prev) => ({
                            ...prev,
                            premiumAgiBonus: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-teal-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-pink-300">🩸 +Живучесть (VIT):</label>
                      <input
                        type="number"
                        min={0}
                        value={featureFlags.premiumVitBonus ?? 0}
                        onChange={(e) =>
                          setFeatureFlags((prev) => ({
                            ...prev,
                            premiumVitBonus: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-pink-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-emerald-300">💨 +Уклонение (%):</label>
                      <input
                        type="number"
                        min={0}
                        value={featureFlags.premiumDodgeBonus ?? 0}
                        onChange={(e) =>
                          setFeatureFlags((prev) => ({
                            ...prev,
                            premiumDodgeBonus: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-emerald-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-cyan-300">⚡ +Макс. Энергия:</label>
                      <input
                        type="number"
                        min={0}
                        value={featureFlags.premiumEnergyBonus ?? 0}
                        onChange={(e) =>
                          setFeatureFlags((prev) => ({
                            ...prev,
                            premiumEnergyBonus: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-cyan-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-yellow-300">🪙 +Золото с мобов (%):</label>
                      <input
                        type="number"
                        min={0}
                        value={featureFlags.premiumGoldBonusPct ?? 10}
                        onChange={(e) =>
                          setFeatureFlags((prev) => ({
                            ...prev,
                            premiumGoldBonusPct: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-yellow-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-purple-300">✨ +Опыт в боях (%):</label>
                      <input
                        type="number"
                        min={0}
                        value={featureFlags.premiumExpBonusPct ?? 20}
                        onChange={(e) =>
                          setFeatureFlags((prev) => ({
                            ...prev,
                            premiumExpBonusPct: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-purple-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-indigo-300">🎒 +Слоты сумки:</label>
                      <input
                        type="number"
                        min={0}
                        value={featureFlags.premiumBagBonus ?? 0}
                        onChange={(e) =>
                          setFeatureFlags((prev) => ({
                            ...prev,
                            premiumBagBonus: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-sky-300">⚡ Множитель реген. (x):</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={featureFlags.premiumRegenMultiplier ?? 2}
                        onChange={(e) =>
                          setFeatureFlags((prev) => ({
                            ...prev,
                            premiumRegenMultiplier: Math.max(1, parseInt(e.target.value, 10) || 1)
                          }))
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-sky-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-amber-300">🎰 Множитель рулетки (x):</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={featureFlags.premiumWheelMultiplier ?? 2}
                        onChange={(e) =>
                          setFeatureFlags((prev) => ({
                            ...prev,
                            premiumWheelMultiplier: Math.max(1, parseInt(e.target.value, 10) || 1)
                          }))
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-amber-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-emerald-300">🎁 +Шанс лута боссов (%):</label>
                      <input
                        type="number"
                        min={0}
                        value={featureFlags.premiumLootBonusPct ?? 50}
                        onChange={(e) =>
                          setFeatureFlags((prev) => ({
                            ...prev,
                            premiumLootBonusPct: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-emerald-300"
                      />
                    </div>
                    <label className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900 px-2 py-1.5 text-[10px] cursor-pointer mt-3">
                      <input
                        type="checkbox"
                        checked={featureFlags.premiumGoldWheelEnabled !== false}
                        onChange={(e) =>
                          setFeatureFlags((prev) => ({
                            ...prev,
                            premiumGoldWheelEnabled: e.target.checked
                          }))
                        }
                        className="h-3.5 w-3.5 accent-amber-500"
                      />
                      <span className="text-amber-200 font-bold">🎰 Рулетка за 1000 🪙</span>
                    </label>
                    <label className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900 px-2 py-1.5 text-[10px] cursor-pointer mt-3">
                      <input
                        type="checkbox"
                        checked={featureFlags.premiumCrownEnabled !== false}
                        onChange={(e) =>
                          setFeatureFlags((prev) => ({
                            ...prev,
                            premiumCrownEnabled: e.target.checked
                          }))
                        }
                        className="h-3.5 w-3.5 accent-yellow-500"
                      />
                      <span className="text-yellow-200 font-bold">👑 Золотая корона</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    disabled={isSavingShop}
                    onClick={async () => {
                      setIsSavingShop(true);
                      try {
                        const ok = await saveShopAndFeaturesToSupabase(shopCatalog, featureFlags, shopSkins);
                        if (onShopAndFeaturesUpdated)
                          onShopAndFeaturesUpdated(shopCatalog, featureFlags, shopSkins);
                        showToast(
                          ok
                            ? '👑 Настройки и бонусы Премиума сохранены в базе данных!'
                            : '⚠️ Сохранено локально'
                        );
                      } finally {
                        setIsSavingShop(false);
                      }
                    }}
                    className="rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-1.5 text-xs font-black text-slate-950 hover:from-yellow-400 hover:to-amber-400 disabled:opacity-50 cursor-pointer"
                  >
                    💾 Сохранить настройки и бонусы Премиума
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFeatureFlags((prev) => ({
                        ...prev,
                        premiumEnabled: true,
                        premiumPriceCrystals: 300,
                        premiumPriceGold: 30000,
                        premiumCurrency: 'crystals',
                        premiumDurationHours: 24,
                        premiumHpBonus: 0,
                        premiumDmgBonus: 0,
                        premiumStrBonus: 0,
                        premiumAgiBonus: 0,
                        premiumVitBonus: 0,
                        premiumDodgeBonus: 0,
                        premiumEnergyBonus: 0,
                        premiumGoldBonusPct: 10,
                        premiumExpBonusPct: 20,
                        premiumBagBonus: 0,
                        premiumRegenMultiplier: 2,
                        premiumWheelMultiplier: 2,
                        premiumLootBonusPct: 50,
                        premiumGoldWheelEnabled: true,
                        premiumCrownEnabled: true
                      }));
                      showToast('Бонусы Премиума сброшены к стандартным значениям');
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    ↺ Сбросить бонусы Премиума
                  </button>
                </div>
              </div>

              {/* 🎨 РЕДАКТОР РАЗДЕЛА «СКИНЫ ПЕРСОНАЖА» В МАГАЗИНЕ */}
              <div className="rounded-xl border-2 border-fuchsia-500/60 bg-slate-900/95 p-3 space-y-3 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div>
                    <div className="font-black text-fuchsia-300 text-xs sm:text-sm flex items-center gap-1.5">
                      🎨 Редактор Раздела «Скины персонажа» в Магазине ({shopSkins.length} шт.)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Загружайте картинку или GIF (авто-калибровка 64×64px, в клетке Пирамиды строго 20×20px), назначайте любые бонусы, редактируйте и удаляйте скины
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isSavingShop}
                    onClick={handleSaveAllSkins}
                    className="rounded-lg bg-fuchsia-600 px-3 py-1.5 text-xs font-black text-white hover:bg-fuchsia-500 shadow cursor-pointer"
                  >
                    💾 Сохранить все скины ({shopSkins.length})
                  </button>
                </div>

                {/* Форма добавления нового скина */}
                <div className="rounded-lg border border-fuchsia-500/40 bg-slate-950/90 p-2.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-fuchsia-200">
                      ➕ Создать новый скин персонажа (Картинка / GIF + все бонусы игры):
                    </span>
                    {newSkinImgInfo && (
                      <span className="text-[9.5px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-500/40 px-2 py-0.5 rounded">
                        ✅ {newSkinImgInfo}
                      </span>
                    )}
                  </div>

                  {/* Предпросмотр стандартного размера: Профиль (64x64) + Клетка Пирамиды (22x22 внутри 25x25) */}
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/90 p-2">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-xl border border-fuchsia-500/50 bg-slate-950/60 flex items-center justify-center overflow-hidden p-1">
                        <CharacterAvatar avatar={newSkinIcon} size="lg" alt="Профиль" />
                      </div>
                      <div className="text-[9.5px] text-slate-300">
                        <div className="font-bold text-fuchsia-200">В профиле (прозрачный фон)</div>
                        <div className="text-slate-400">Авто-вырезка фона {CHARACTER_SKIN_IMAGE_SPEC.standardSizePx}×{CHARACTER_SKIN_IMAGE_SPEC.standardSizePx}px</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
                      <div
                        className="relative w-[25px] h-[25px] rounded border-2 border-amber-300 bg-gradient-to-br from-[#d9ad78] via-[#ab7d49] to-[#6e4a23] flex items-center justify-center overflow-hidden shadow-[0_0_8px_rgba(250,204,21,0.6)]"
                        title="Точный вид воина при передвижении по плитам Пирамиды (25×25px)"
                      >
                        <span className="pointer-events-none absolute bottom-0.5 h-1.5 w-4 rounded-full bg-black/50 blur-[0.5px]" />
                        <CharacterAvatar avatar={newSkinIcon} size="sm" alt="В пирамиде" className="relative z-10" />
                      </div>
                      <div className="text-[9.5px] text-slate-300">
                        <div className="font-bold text-amber-300">На плите Пирамиды (25×25px)</div>
                        <div className="text-slate-400">Сам воин без фона ({CHARACTER_SKIN_IMAGE_SPEC.pyramidCellDisplayPx}×{CHARACTER_SKIN_IMAGE_SPEC.pyramidCellDisplayPx}px)</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <input
                        type="text"
                        value={newSkinIcon.startsWith('data:') ? '🖼️ Загружен свой скин/GIF' : newSkinIcon}
                        onChange={(e) => setNewSkinIcon(e.target.value)}
                        placeholder="Эмодзи или URL"
                        className="w-36 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white outline-none"
                      />
                      <label className="cursor-pointer rounded-lg border border-fuchsia-400 bg-fuchsia-700 hover:bg-fuchsia-600 px-3 py-1.5 text-[10px] font-black text-white shadow shrink-0">
                        📁 Загрузить PNG / GIF
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                          onChange={handleUploadImageForNewSkin}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Основные параметры и все 10 бонусов */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div className="col-span-2">
                      <label className="text-[9.5px] text-slate-300">Название скина:</label>
                      <input
                        type="text"
                        value={newSkinName}
                        onChange={(e) => setNewSkinName(e.target.value)}
                        placeholder="Напр. Божественный Анубис (GIF)"
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-purple-300">Мин. уровень (1–20):</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={newSkinLvl}
                        onChange={(e) => setNewSkinLvl(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-purple-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-amber-300">Валюта продажи:</label>
                      <select
                        value={newSkinCurrency}
                        onChange={(e) => setNewSkinCurrency(e.target.value as 'gold' | 'crystals')}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-amber-300"
                      >
                        <option value="crystals">💎 За кристаллы</option>
                        <option value="gold">🪙 За золото</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9.5px] text-cyan-300">
                        Цена ({newSkinCurrency === 'crystals' ? '💎 Кристаллы' : '🪙 Золото'}):
                      </label>
                      {newSkinCurrency === 'crystals' ? (
                        <input
                          type="number"
                          min={0}
                          value={newSkinPriceCrystals}
                          onChange={(e) => setNewSkinPriceCrystals(e.target.value)}
                          className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-cyan-300"
                        />
                      ) : (
                        <input
                          type="number"
                          min={0}
                          value={newSkinPriceGold}
                          onChange={(e) => setNewSkinPriceGold(e.target.value)}
                          className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-yellow-300"
                        />
                      )}
                    </div>

                    {/* Все 10 игровых бонусов скина */}
                    <div>
                      <label className="text-[9.5px] text-red-300">❤️ +Здоровье (HP):</label>
                      <input
                        type="number"
                        min={0}
                        value={newSkinHp}
                        onChange={(e) => setNewSkinHp(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-red-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-orange-300">⚔️ +Урон (DMG):</label>
                      <input
                        type="number"
                        min={0}
                        value={newSkinDmg}
                        onChange={(e) => setNewSkinDmg(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-orange-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-rose-300">💪 +Сила (STR):</label>
                      <input
                        type="number"
                        min={0}
                        value={newSkinStr}
                        onChange={(e) => setNewSkinStr(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-rose-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-teal-300">🤸 +Ловкость (AGI):</label>
                      <input
                        type="number"
                        min={0}
                        value={newSkinAgi}
                        onChange={(e) => setNewSkinAgi(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-teal-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-pink-300">🩸 +Живучесть (VIT):</label>
                      <input
                        type="number"
                        min={0}
                        value={newSkinVit}
                        onChange={(e) => setNewSkinVit(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-pink-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-emerald-300">💨 +Уклонение (%):</label>
                      <input
                        type="number"
                        min={0}
                        value={newSkinDodge}
                        onChange={(e) => setNewSkinDodge(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-emerald-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-cyan-300">⚡ +Энергия (EN):</label>
                      <input
                        type="number"
                        min={0}
                        value={newSkinEnergy}
                        onChange={(e) => setNewSkinEnergy(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-cyan-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-yellow-300">🪙 +Золото (%):</label>
                      <input
                        type="number"
                        min={0}
                        value={newSkinGoldPct}
                        onChange={(e) => setNewSkinGoldPct(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-yellow-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-purple-300">✨ +Опыт (%):</label>
                      <input
                        type="number"
                        min={0}
                        value={newSkinExpPct}
                        onChange={(e) => setNewSkinExpPct(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-purple-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-indigo-300">🎒 +Слоты сумки:</label>
                      <input
                        type="number"
                        min={0}
                        value={newSkinBag}
                        onChange={(e) => setNewSkinBag(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-indigo-300"
                      />
                    </div>
                  </div>

                  {/* Срок действия и эксклюзивность */}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <label className="text-[9.5px] text-amber-300 font-bold">⏳ Срок действия скина:</label>
                        <div className="mt-1 flex items-center gap-3 flex-wrap">
                          <label className="flex items-center gap-1 text-[10px] text-slate-200 cursor-pointer">
                            <input
                              type="radio"
                              name="newSkinDur"
                              checked={newSkinDurationType === 'permanent'}
                              onChange={() => setNewSkinDurationType('permanent')}
                              className="accent-amber-500"
                            />
                            ♾️ Навсегда
                          </label>
                          <label className="flex items-center gap-1 text-[10px] text-slate-200 cursor-pointer">
                            <input
                              type="radio"
                              name="newSkinDur"
                              checked={newSkinDurationType === 'temporary'}
                              onChange={() => setNewSkinDurationType('temporary')}
                              className="accent-amber-500"
                            />
                            ⏳ Временно
                          </label>
                          {newSkinDurationType === 'temporary' && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={1}
                                max={365}
                                value={newSkinDurationDays}
                                onChange={(e) => setNewSkinDurationDays(e.target.value)}
                                className="w-16 rounded border border-amber-500 bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-amber-300"
                              />
                              <span className="text-[9px] text-slate-400">дней</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <label className="flex items-center gap-1.5 text-[10px] text-purple-200 cursor-pointer font-bold">
                        <input
                          type="checkbox"
                          checked={newSkinIsExclusive}
                          onChange={(e) => setNewSkinIsExclusive(e.target.checked)}
                          className="h-4 w-4 accent-purple-500"
                        />
                        🔒 Эксклюзивный (скрыть из магазина)
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSavingShop}
                      onClick={handleCreateNewSkin}
                      className="flex-1 min-w-[180px] rounded-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 py-2 text-xs font-black text-white shadow hover:from-fuchsia-500 hover:to-purple-500 disabled:opacity-50 cursor-pointer"
                    >
                      ➕ В Магазин (для всех игроков)
                    </button>
                    <button
                      type="button"
                      disabled={isSavingShop}
                      onClick={handleCreateSkinToSelfCollection}
                      className="flex-1 min-w-[180px] rounded-lg bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-2 text-xs font-black text-slate-950 shadow hover:from-amber-400 hover:to-yellow-300 disabled:opacity-50 cursor-pointer"
                      title="Создает скин для себя (не продается в магазине) и сразу добавляет его в вашу личную коллекцию и надевает"
                    >
                      🎭 Добавить сразу себе в Коллекцию
                    </button>
                  </div>
                </div>

                {/* Список всех существующих скинов (Редактирование и Удаление) */}
                <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                  {shopSkins.map((skin) => (
                    <div
                      key={skin.id}
                      className={`rounded-lg border p-2.5 space-y-2 ${
                        skin.enabled !== false
                          ? 'border-fuchsia-500/40 bg-slate-950'
                          : 'border-slate-800 bg-slate-950/40 opacity-60'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="checkbox"
                            checked={skin.enabled !== false}
                            onChange={(e) =>
                              handleUpdateSkinField(skin.id, 'enabled', e.target.checked)
                            }
                            className="h-4 w-4 accent-fuchsia-500"
                            title="Показывать этот скин в магазине"
                          />
                          {/* Профиль + Клетка Пирамиды (25x25px) */}
                          <div className="w-9 h-9 rounded-lg border border-fuchsia-500/40 bg-slate-900/60 flex items-center justify-center overflow-hidden p-0.5">
                            <CharacterAvatar avatar={skin.icon} size="md" alt={skin.name} />
                          </div>
                          <div
                            className="relative w-[25px] h-[25px] rounded border-2 border-amber-300 bg-gradient-to-br from-[#d9ad78] via-[#ab7d49] to-[#6e4a23] flex items-center justify-center overflow-hidden shadow-[0_0_6px_rgba(250,204,21,0.5)]"
                            title="Вид воина на каменной плите Пирамиды (прозрачный фон)"
                          >
                            <span className="pointer-events-none absolute bottom-0.5 h-1.5 w-4 rounded-full bg-black/50 blur-[0.5px]" />
                            <CharacterAvatar avatar={skin.icon} size="sm" alt={skin.name} className="relative z-10" />
                          </div>
                          <label className="cursor-pointer rounded border border-fuchsia-500/50 bg-fuchsia-950/70 px-2 py-0.5 text-[9.5px] font-bold text-fuchsia-200 hover:bg-fuchsia-900">
                            📁 Сменить PNG/GIF
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                              onChange={(e) => handleUploadImageForExistingSkin(skin.id, e)}
                              className="hidden"
                            />
                          </label>
                          <input
                            type="text"
                            value={skin.name}
                            onChange={(e) =>
                              handleUpdateSkinField(skin.id, 'name', e.target.value)
                            }
                            className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-xs font-bold text-white outline-none"
                          />
                          {(skin.isExclusive || skin.isPersonal) && (
                            <span className="rounded bg-purple-950/90 border border-purple-500/60 px-1.5 py-0.2 text-[8px] font-black text-purple-200">
                              🔒 Эксклюзив (не в магазине)
                            </span>
                          )}
                          {skin.isTemporary && (
                            <span className="rounded bg-amber-950/90 border border-amber-500/60 px-1.5 py-0.2 text-[8px] font-black text-amber-300">
                              ⏳ Временный ({skin.durationDays} дн.)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSendSkinModalTarget(skin);
                              setSendSkinRecipient(targetPlayerNick || onlinePlayers[0]?.nick || '');
                              setSendSkinDurationType(skin.isTemporary ? 'temporary' : 'permanent');
                              setSendSkinDurationDays(String(skin.durationDays || 7));
                            }}
                            className="rounded bg-gradient-to-r from-purple-600 to-indigo-600 border border-purple-400 px-2.5 py-0.5 text-[10px] font-bold text-white hover:brightness-110 cursor-pointer shadow"
                            title="Отправить скин напрямую любому игроку (навсегда или временно)"
                          >
                            🎁 Отправить игроку
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSkin(skin.id, skin.name)}
                            className="rounded bg-red-900/80 border border-red-500/50 px-2 py-0.5 text-[10px] font-bold text-red-200 hover:bg-red-800 cursor-pointer"
                          >
                            🗑️ Удалить скин
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5">
                        <div>
                          <label className="text-[9px] text-purple-300">Уровень:</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={skin.lvl}
                            onChange={(e) =>
                              handleUpdateSkinField(
                                skin.id,
                                'lvl',
                                Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-purple-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-amber-300">Валюта:</label>
                          <select
                            value={skin.currency}
                            onChange={(e) =>
                              handleUpdateSkinField(
                                skin.id,
                                'currency',
                                e.target.value as 'gold' | 'crystals'
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-xs font-bold text-amber-300"
                          >
                            <option value="gold">🪙 Золото</option>
                            <option value="crystals">💎 Крист.</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] text-yellow-400">Цена 🪙:</label>
                          <input
                            type="number"
                            min={0}
                            value={skin.priceGold}
                            onChange={(e) =>
                              handleUpdateSkinField(
                                skin.id,
                                'priceGold',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-yellow-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-cyan-400">Цена 💎:</label>
                          <input
                            type="number"
                            min={0}
                            value={skin.priceCrystals}
                            onChange={(e) =>
                              handleUpdateSkinField(
                                skin.id,
                                'priceCrystals',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-cyan-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-red-400">+HP ❤️:</label>
                          <input
                            type="number"
                            min={0}
                            value={skin.hpBonus}
                            onChange={(e) =>
                              handleUpdateSkinField(
                                skin.id,
                                'hpBonus',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-red-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-orange-400">+Урон ⚔️:</label>
                          <input
                            type="number"
                            min={0}
                            value={skin.dmgBonus}
                            onChange={(e) =>
                              handleUpdateSkinField(
                                skin.id,
                                'dmgBonus',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-orange-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-rose-300">+Сила 💪:</label>
                          <input
                            type="number"
                            min={0}
                            value={skin.strBonus}
                            onChange={(e) =>
                              handleUpdateSkinField(
                                skin.id,
                                'strBonus',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-rose-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-teal-300">+Ловк 🤸:</label>
                          <input
                            type="number"
                            min={0}
                            value={skin.agiBonus}
                            onChange={(e) =>
                              handleUpdateSkinField(
                                skin.id,
                                'agiBonus',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-teal-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-pink-300">+Живуч 🩸:</label>
                          <input
                            type="number"
                            min={0}
                            value={skin.vitBonus}
                            onChange={(e) =>
                              handleUpdateSkinField(
                                skin.id,
                                'vitBonus',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-pink-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-emerald-400">+Укл %:</label>
                          <input
                            type="number"
                            min={0}
                            value={skin.dodgeBonus}
                            onChange={(e) =>
                              handleUpdateSkinField(
                                skin.id,
                                'dodgeBonus',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-emerald-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-cyan-400">+Энерг ⚡:</label>
                          <input
                            type="number"
                            min={0}
                            value={skin.energyBonus}
                            onChange={(e) =>
                              handleUpdateSkinField(
                                skin.id,
                                'energyBonus',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-cyan-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-yellow-300">+Зол %:</label>
                          <input
                            type="number"
                            min={0}
                            value={skin.goldBonusPct}
                            onChange={(e) =>
                              handleUpdateSkinField(
                                skin.id,
                                'goldBonusPct',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-yellow-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-purple-300">+Опыт %:</label>
                          <input
                            type="number"
                            min={0}
                            value={skin.expBonusPct}
                            onChange={(e) =>
                              handleUpdateSkinField(
                                skin.id,
                                'expBonusPct',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-purple-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-indigo-300">+Сумка 🎒:</label>
                          <input
                            type="number"
                            min={0}
                            value={skin.bagBonus}
                            onChange={(e) =>
                              handleUpdateSkinField(
                                skin.id,
                                'bagBonus',
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-indigo-300"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Добавить новый предмет в Магазин */}
              <div className="rounded-xl border border-emerald-500/40 bg-slate-900/90 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-bold text-emerald-300">
                    ➕ Добавить новый предмет в Магазин
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Предмет сразу появится в выбранной категории магазина у всех игроков
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <label className="text-[10px] text-amber-300">Категория:</label>
                    <select
                      value={newShopSlot}
                      onChange={(e) => {
                        const s = e.target.value as ItemSlot;
                        setNewShopSlot(s);
                        const defaultIcons: Record<ItemSlot, string> = {
                          weapon: '⚔️',
                          armor: '🦺',
                          pants: '👖',
                          boots: '🥾',
                          gloves: '🧤',
                          ring: '💍'
                        };
                        setNewShopIcon(defaultIcons[s] || '⚔️');
                      }}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-amber-300"
                    >
                      <option value="weapon">⚔️ Оружие</option>
                      <option value="armor">🦺 Броня</option>
                      <option value="pants">👖 Штаны</option>
                      <option value="boots">🥾 Сапоги</option>
                      <option value="gloves">🧤 Перчатки</option>
                      <option value="ring">💍 Кольцо</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-300">Название предмета:</label>
                    <input
                      type="text"
                      value={newShopName}
                      onChange={(e) => setNewShopName(e.target.value)}
                      placeholder="Напр. Клинок Анубиса (10 ур.)"
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-300">Иконка / Картинка:</label>
                    <div className="mt-0.5 flex items-center gap-1">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-950 p-0.5">
                        <ItemIcon icon={newShopIcon} name={newShopName || 'item'} className="h-5 w-5" />
                      </span>
                      <input
                        type="text"
                        value={newShopIcon}
                        onChange={(e) => setNewShopIcon(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-center text-xs"
                      />
                      <label
                        className="shrink-0 cursor-pointer rounded border border-cyan-500/60 bg-cyan-950/80 px-2 py-1 text-[10px] font-bold text-cyan-200 hover:bg-cyan-900"
                        title="Загрузить свою картинку 128x128px с устройства"
                      >
                        📁
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                          onChange={handleUploadImageForNewShopItem}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-purple-300">Уровень (1–20):</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={newShopLvl}
                      onChange={(e) => setNewShopLvl(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-purple-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-yellow-400">Стоимость (🪙):</label>
                    <input
                      type="number"
                      min={1}
                      value={newShopPrice}
                      onChange={(e) => setNewShopPrice(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-yellow-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-300">Прочность (Х/Х):</label>
                    <input
                      type="number"
                      min={1}
                      value={newShopDurability}
                      onChange={(e) => setNewShopDurability(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-red-400">+Здоровье (HP):</label>
                    <input
                      type="number"
                      min={0}
                      value={newShopHp}
                      onChange={(e) => setNewShopHp(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-red-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-orange-400">+Урон ⚔️:</label>
                    <input
                      type="number"
                      min={0}
                      value={newShopDmg}
                      onChange={(e) => setNewShopDmg(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-orange-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-emerald-400">+Уклонение (%):</label>
                    <input
                      type="number"
                      min={0}
                      value={newShopDodge}
                      onChange={(e) => setNewShopDodge(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-emerald-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-cyan-400">+Энергия ⚡:</label>
                    <input
                      type="number"
                      min={0}
                      value={newShopEnergy}
                      onChange={(e) => setNewShopEnergy(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-cyan-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-yellow-300">+Золото (%) / +Опыт (%):</label>
                    <div className="grid grid-cols-2 gap-1 mt-0.5">
                      <input
                        type="number"
                        min={0}
                        value={newShopGoldPct}
                        onChange={(e) => setNewShopGoldPct(e.target.value)}
                        placeholder="% Зол"
                        title="Бонус к золоту (%)"
                        className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs font-bold text-yellow-300"
                      />
                      <input
                        type="number"
                        min={0}
                        value={newShopExpPct}
                        onChange={(e) => setNewShopExpPct(e.target.value)}
                        placeholder="% Опыт"
                        title="Бонус к опыту (%)"
                        className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs font-bold text-purple-300"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSavingShop}
                  onClick={handleCreateNewShopItem}
                  className="mt-2.5 w-full rounded-lg bg-emerald-600 py-2 text-xs font-black text-white shadow hover:bg-emerald-500 disabled:opacity-50"
                >
                  ➕ Добавить предмет в Магазин ({SHOP_CATEGORY_LABELS[newShopSlot]})
                </button>
              </div>

              {/* 3. Редактирование существующих предметов в Магазине */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        { key: 'all', label: `Все (${shopCatalog.length})` },
                        { key: 'weapon', label: '⚔️ Оружие' },
                        { key: 'armor', label: '🦺 Броня' },
                        { key: 'pants', label: '👖 Штаны' },
                        { key: 'boots', label: '🥾 Сапоги' },
                        { key: 'gloves', label: '🧤 Перчатки' },
                        { key: 'ring', label: '💍 Кольцо' }
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setShopCategoryFilter(tab.key)}
                        className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                          shopCategoryFilter === tab.key
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleResetShopToDefault}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700"
                  >
                    ↩️ Сброс магазина
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isSavingShop}
                  onClick={handleSaveShopCatalog}
                  className="mb-3 w-full rounded-lg bg-cyan-600 py-2 text-xs font-black text-white shadow hover:bg-cyan-500 disabled:opacity-50"
                >
                  {isSavingShop ? '⏳ Сохранение...' : '💾 Сохранить все изменения предметов и цен в Магазине'}
                </button>

                <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                  {shopCatalog
                    .filter((item) =>
                      shopCategoryFilter === 'all' ? true : item.slot === shopCategoryFilter
                    )
                    .map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-lg border p-2.5 ${
                          item.enabled !== false
                            ? 'border-slate-700 bg-slate-950'
                            : 'border-slate-800 bg-slate-950/40 opacity-60'
                        }`}
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.enabled !== false}
                              onChange={(e) =>
                                handleUpdateShopItemField(item.id, 'enabled', e.target.checked)
                              }
                              className="h-4 w-4 accent-cyan-500"
                              title="Показывать в магазине"
                            />
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-800 bg-slate-900 p-0.5">
                              <ItemIcon icon={item.icon} name={item.name} className="h-5 w-5" />
                            </span>
                            <label
                              className="cursor-pointer rounded border border-cyan-500/40 bg-cyan-950/60 px-1.5 py-0.5 text-[9.5px] font-bold text-cyan-200 hover:bg-cyan-900"
                              title="Загрузить новую картинку для этого предмета (128×128px)"
                            >
                              📁 Картинка
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                                onChange={(e) => handleUploadImageForExistingShopItem(item.id, e)}
                                className="hidden"
                              />
                            </label>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) =>
                                handleUpdateShopItemField(item.id, 'name', e.target.value)
                              }
                              className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-xs font-bold text-white outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-amber-300">
                              {SHOP_CATEGORY_LABELS[item.slot]}
                            </span>
                            {item.isCustom && (
                              <button
                                type="button"
                                onClick={() => handleDeleteShopItem(item.id, item.name)}
                                className="rounded bg-red-900/70 px-1.5 py-0.5 text-[10px] font-bold text-red-200 hover:bg-red-800"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                          <div>
                            <label className="text-[9px] text-purple-300">Уровень:</label>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={item.lvl}
                              onChange={(e) =>
                                handleUpdateShopItemField(
                                  item.id,
                                  'lvl',
                                  Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))
                                )
                              }
                              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs font-bold text-purple-300"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-yellow-400">Цена (🪙):</label>
                            <input
                              type="number"
                              min={1}
                              value={item.price}
                              onChange={(e) =>
                                handleUpdateShopItemField(
                                  item.id,
                                  'price',
                                  Math.max(1, parseInt(e.target.value, 10) || 1)
                                )
                              }
                              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs font-bold text-yellow-300"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-300">Прочность:</label>
                            <input
                              type="number"
                              min={1}
                              value={item.maxDurability}
                              onChange={(e) =>
                                handleUpdateShopItemField(
                                  item.id,
                                  'maxDurability',
                                  Math.max(1, parseInt(e.target.value, 10) || 1)
                                )
                              }
                              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs font-bold text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-red-400">+HP ❤️:</label>
                            <input
                              type="number"
                              min={0}
                              value={item.hp}
                              onChange={(e) =>
                                handleUpdateShopItemField(
                                  item.id,
                                  'hp',
                                  Math.max(0, parseInt(e.target.value, 10) || 0)
                                )
                              }
                              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs font-bold text-red-300"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-orange-400">+Урон ⚔️:</label>
                            <input
                              type="number"
                              min={0}
                              value={item.dmg}
                              onChange={(e) =>
                                handleUpdateShopItemField(
                                  item.id,
                                  'dmg',
                                  Math.max(0, parseInt(e.target.value, 10) || 0)
                                )
                              }
                              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs font-bold text-orange-300"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-emerald-400">+Укл (%):</label>
                            <input
                              type="number"
                              min={0}
                              value={item.dodgeBonus}
                              onChange={(e) =>
                                handleUpdateShopItemField(
                                  item.id,
                                  'dodgeBonus',
                                  Math.max(0, parseInt(e.target.value, 10) || 0)
                                )
                              }
                              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs font-bold text-emerald-300"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-cyan-400">+Энергия ⚡:</label>
                            <input
                              type="number"
                              min={0}
                              value={item.energyBonus}
                              onChange={(e) =>
                                handleUpdateShopItemField(
                                  item.id,
                                  'energyBonus',
                                  Math.max(0, parseInt(e.target.value, 10) || 0)
                                )
                              }
                              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs font-bold text-cyan-300"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-yellow-300">+Золото (%):</label>
                            <input
                              type="number"
                              min={0}
                              value={item.goldBonusPct}
                              onChange={(e) =>
                                handleUpdateShopItemField(
                                  item.id,
                                  'goldBonusPct',
                                  Math.max(0, parseInt(e.target.value, 10) || 0)
                                )
                              }
                              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs font-bold text-yellow-300"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-purple-300">+Опыт (%):</label>
                            <input
                              type="number"
                              min={0}
                              value={item.expBonusPct}
                              onChange={(e) =>
                                handleUpdateShopItemField(
                                  item.id,
                                  'expBonusPct',
                                  Math.max(0, parseInt(e.target.value, 10) || 0)
                                )
                              }
                              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs font-bold text-purple-300"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}

          {/* ==================== TAB: WEAPON & EQUIPMENT CREATION MANAGEMENT ==================== */}
          {activeTab === 'creation' && (
            <div className="space-y-3">
              {/* 1. Управление правилами создания оружия и амуниции для игроков */}
              <div className="rounded-xl border border-cyan-500/50 bg-slate-900/95 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div>
                    <div className="text-sm font-black text-cyan-300 flex items-center gap-1.5">
                      <span>⚒️ 1. Управление созданием оружия и амуниции (Кузница игроков)</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Настройте стоимость создания, валюту оплаты и максимальные лимиты характеристик для игроков
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleFeatureFlag('customCreationEnabled')}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-black transition-all ${
                      featureFlags.customCreationEnabled !== false
                        ? 'border-emerald-500 bg-emerald-950/70 text-emerald-300'
                        : 'border-red-500/60 bg-red-950/60 text-red-300'
                    }`}
                  >
                    {featureFlags.customCreationEnabled !== false
                      ? '✅ Создание оружия: ВКЛЮЧЕНО'
                      : '🔒 Создание оружия: ОТКЛЮЧЕНО'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-300">Валюта создания:</label>
                    <select
                      value={featureFlags.customCreationCurrency || 'both'}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          customCreationCurrency: e.target.value as 'crystals' | 'gold' | 'both'
                        }))
                      }
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-cyan-300"
                    >
                      <option value="both">💎 + 🪙 На выбор игрока</option>
                      <option value="crystals">💎 Только кристаллы</option>
                      <option value="gold">🪙 Только золото</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-cyan-300">Базовая цена (💎):</label>
                    <input
                      type="number"
                      min={0}
                      value={featureFlags.customBaseCostCrystals ?? 5}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          customBaseCostCrystals: Math.max(0, parseInt(e.target.value, 10) || 0)
                        }))
                      }
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-cyan-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-amber-300">Базовая цена (🪙):</label>
                    <input
                      type="number"
                      min={0}
                      value={featureFlags.customBaseCostGold ?? 250}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          customBaseCostGold: Math.max(0, parseInt(e.target.value, 10) || 0)
                        }))
                      }
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-amber-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-300">Прочность по умолч. (100/100):</label>
                    <input
                      type="number"
                      min={1}
                      value={featureFlags.customDefaultDurability ?? 100}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          customDefaultDurability: Math.max(1, parseInt(e.target.value, 10) || 100)
                        }))
                      }
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-cyan-300">Цена за 1 ед. статов (💎):</label>
                    <input
                      type="number"
                      min={0}
                      value={featureFlags.customCostPerStatCrystals ?? 1}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          customCostPerStatCrystals: Math.max(0, parseInt(e.target.value, 10) || 0)
                        }))
                      }
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-cyan-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-amber-300">Цена за 1 ед. статов (🪙):</label>
                    <input
                      type="number"
                      min={0}
                      value={featureFlags.customCostPerStatGold ?? 50}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          customCostPerStatGold: Math.max(0, parseInt(e.target.value, 10) || 0)
                        }))
                      }
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-amber-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-red-400">Макс. Урон ⚔️:</label>
                    <input
                      type="number"
                      min={1}
                      value={featureFlags.customMaxDmg ?? 250}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          customMaxDmg: Math.max(1, parseInt(e.target.value, 10) || 250)
                        }))
                      }
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-red-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-rose-400">Макс. Здоровье ❤️:</label>
                    <input
                      type="number"
                      min={1}
                      value={featureFlags.customMaxHp ?? 500}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          customMaxHp: Math.max(1, parseInt(e.target.value, 10) || 500)
                        }))
                      }
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-rose-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-sky-300">Макс. Уклонение %:</label>
                    <input
                      type="number"
                      min={0}
                      value={featureFlags.customMaxDodge ?? 25}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          customMaxDodge: Math.max(0, parseInt(e.target.value, 10) || 25)
                        }))
                      }
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-sky-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-amber-300">Макс. Энергия ⚡:</label>
                    <input
                      type="number"
                      min={0}
                      value={featureFlags.customMaxEnergy ?? 150}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          customMaxEnergy: Math.max(0, parseInt(e.target.value, 10) || 150)
                        }))
                      }
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-amber-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-yellow-300">Макс. Бонус Золота %:</label>
                    <input
                      type="number"
                      min={0}
                      value={featureFlags.customMaxGoldPct ?? 25}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          customMaxGoldPct: Math.max(0, parseInt(e.target.value, 10) || 25)
                        }))
                      }
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-yellow-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-purple-300">Макс. Бонус Опыта %:</label>
                    <input
                      type="number"
                      min={0}
                      value={featureFlags.customMaxExpPct ?? 25}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          customMaxExpPct: Math.max(0, parseInt(e.target.value, 10) || 25)
                        }))
                      }
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-purple-300"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSavingShop}
                  onClick={handleSaveShopCatalog}
                  className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 py-2 text-xs font-black text-white shadow hover:brightness-110 disabled:opacity-50"
                >
                  {isSavingShop
                    ? '⏳ Сохранение...'
                    : '💾 Сохранить настройки создания оружия для всех игроков'}
                </button>
              </div>

              {/* 2. Редактор / Корректировка любого предмета игрока (если выбран предмет) */}
              {editingItemTarget && (
                <div className="rounded-xl border-2 border-amber-400 bg-slate-900 p-3 space-y-2.5 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="text-xs font-black text-amber-300">
                      ✏️ Корректировка предмета у игрока «{targetPlayerNick || hero.nick}» (
                      {editingItemTarget.source === 'equipped'
                        ? `Надето в слоте: ${SLOT_INFO[editingItemTarget.slotKey as ItemSlot]?.name || editingItemTarget.slotKey}`
                        : 'В сумке'}
                      )
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingItemTarget(null)}
                      className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300 hover:text-white"
                    >
                      ✕ Закрыть редактор
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                    <div className="w-16 h-16 rounded-xl bg-black border-2 border-amber-400 flex items-center justify-center p-1.5 shrink-0">
                      <ItemIcon
                        icon={editingItemTarget.item.icon}
                        name={editingItemTarget.item.name}
                        className="text-3xl"
                        imgClassName="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 space-y-1.5 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer rounded-lg bg-gradient-to-r from-amber-500 to-yellow-600 px-3 py-1.5 text-[11px] font-black text-slate-950 shadow hover:brightness-110">
                          📁 Загрузить новую картинку (128×128px)
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                            onChange={handleUploadImageForEditingPlayerItem}
                            className="hidden"
                          />
                        </label>
                        <input
                          type="text"
                          value={editingItemTarget.item.icon}
                          onChange={(e) =>
                            setEditingItemTarget({
                              ...editingItemTarget,
                              item: { ...editingItemTarget.item, icon: e.target.value }
                            })
                          }
                          placeholder="Или эмодзи / URL картинки"
                          className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <input
                        type="text"
                        value={editingItemTarget.item.name}
                        onChange={(e) =>
                          setEditingItemTarget({
                            ...editingItemTarget,
                            item: { ...editingItemTarget.item, name: e.target.value }
                          })
                        }
                        placeholder="Название предмета"
                        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-amber-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-purple-300">Уровень (1–20):</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={editingItemTarget.item.lvl}
                        onChange={(e) =>
                          setEditingItemTarget({
                            ...editingItemTarget,
                            item: {
                              ...editingItemTarget.item,
                              lvl: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))
                            }
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-purple-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-orange-400">Урон ⚔️:</label>
                      <input
                        type="number"
                        min={0}
                        value={editingItemTarget.item.dmg}
                        onChange={(e) =>
                          setEditingItemTarget({
                            ...editingItemTarget,
                            item: {
                              ...editingItemTarget.item,
                              dmg: Math.max(0, parseInt(e.target.value, 10) || 0)
                            }
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-orange-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-red-400">Здоровье ❤️:</label>
                      <input
                        type="number"
                        min={0}
                        value={editingItemTarget.item.hp}
                        onChange={(e) =>
                          setEditingItemTarget({
                            ...editingItemTarget,
                            item: {
                              ...editingItemTarget.item,
                              hp: Math.max(0, parseInt(e.target.value, 10) || 0)
                            }
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-red-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-emerald-400">Уклонение %:</label>
                      <input
                        type="number"
                        min={0}
                        value={editingItemTarget.item.dodgeBonus ?? 0}
                        onChange={(e) =>
                          setEditingItemTarget({
                            ...editingItemTarget,
                            item: {
                              ...editingItemTarget.item,
                              dodgeBonus: Math.max(0, parseInt(e.target.value, 10) || 0)
                            }
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-emerald-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-cyan-400">Энергия ⚡:</label>
                      <input
                        type="number"
                        min={0}
                        value={editingItemTarget.item.energyBonus ?? 0}
                        onChange={(e) =>
                          setEditingItemTarget({
                            ...editingItemTarget,
                            item: {
                              ...editingItemTarget.item,
                              energyBonus: Math.max(0, parseInt(e.target.value, 10) || 0)
                            }
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-cyan-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-yellow-300">Бонус золота %:</label>
                      <input
                        type="number"
                        min={0}
                        value={editingItemTarget.item.goldBonusPct ?? 0}
                        onChange={(e) =>
                          setEditingItemTarget({
                            ...editingItemTarget,
                            item: {
                              ...editingItemTarget.item,
                              goldBonusPct: Math.max(0, parseInt(e.target.value, 10) || 0)
                            }
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-yellow-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-purple-300">Бонус опыта %:</label>
                      <input
                        type="number"
                        min={0}
                        value={editingItemTarget.item.expBonusPct ?? 0}
                        onChange={(e) =>
                          setEditingItemTarget({
                            ...editingItemTarget,
                            item: {
                              ...editingItemTarget.item,
                              expBonusPct: Math.max(0, parseInt(e.target.value, 10) || 0)
                            }
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-purple-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-300">Прочность (Тек/Макс):</label>
                      <div className="mt-0.5 flex gap-1">
                        <input
                          type="number"
                          min={0}
                          value={editingItemTarget.item.durability ?? 10}
                          onChange={(e) =>
                            setEditingItemTarget({
                              ...editingItemTarget,
                              item: {
                                ...editingItemTarget.item,
                                durability: Math.max(0, parseInt(e.target.value, 10) || 0)
                              }
                            })
                          }
                          className="w-1/2 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs font-bold text-white"
                        />
                        <input
                          type="number"
                          min={1}
                          value={editingItemTarget.item.maxDurability ?? 10}
                          onChange={(e) =>
                            setEditingItemTarget({
                              ...editingItemTarget,
                              item: {
                                ...editingItemTarget.item,
                                maxDurability: Math.max(1, parseInt(e.target.value, 10) || 1)
                              }
                            })
                          }
                          className="w-1/2 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs font-bold text-slate-300"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isUpdatingDb}
                    onClick={handleSaveEditedPlayerItem}
                    className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-black text-white shadow hover:bg-emerald-500 disabled:opacity-50"
                  >
                    💾 Сохранить изменения предмета и его картинку в БД
                  </button>
                </div>
              )}

              {/* 3. Создать оружие / амуницию со своей картинкой и выдать игроку или в Магазин */}
              <div className="rounded-xl border border-emerald-500/40 bg-slate-900/95 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div>
                    <span className="font-bold text-emerald-300 text-xs">
                      🛠️ 2. Конструктор оружия и амуниции Администратора (с загрузкой картинки)
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Выбранный получатель:{' '}
                      <b className="text-amber-300">{targetPlayerNick || hero.nick}</b> (можно сменить
                      во вкладке «Персонажи»)
                    </p>
                  </div>
                </div>

                {/* Предпросмотр и загрузка картинки */}
                <div className="flex flex-col sm:flex-row items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-2.5">
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-xl bg-black border-2 border-cyan-400 flex items-center justify-center p-1.5 relative overflow-hidden">
                        <ItemIcon
                          icon={newShopIcon}
                          name={newShopName || 'Оружие'}
                          className="text-3xl"
                          imgClassName="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 mt-0.5">Слот 64×64</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-11 h-11 rounded-lg bg-black border border-amber-400 flex items-center justify-center p-1 relative overflow-hidden">
                        <ItemIcon
                          icon={newShopIcon}
                          name={newShopName || 'Оружие'}
                          className="text-xl"
                          imgClassName="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 mt-0.5">Сумка 44×44</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-1.5 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer rounded-lg bg-gradient-to-r from-amber-500 to-yellow-600 px-3 py-1.5 text-[11px] font-black text-slate-950 shadow hover:brightness-110">
                        📁 Загрузить картинку с устройства (128×128px)
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                          onChange={handleUploadImageForNewShopItem}
                          className="hidden"
                        />
                      </label>
                      {newShopImgInfo && (
                        <span className="text-[10px] font-bold text-emerald-300">
                          ✅ {newShopImgInfo}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={newShopIcon}
                      onChange={(e) => setNewShopIcon(e.target.value)}
                      placeholder="Или вставьте URL картинки (/assets/..., https://...) или эмодзи ⚔️"
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <label className="text-[10px] text-amber-300">Тип амуниции:</label>
                    <select
                      value={newShopSlot}
                      onChange={(e) => setNewShopSlot(e.target.value as ItemSlot)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-amber-300"
                    >
                      <option value="weapon">⚔️ Оружие</option>
                      <option value="armor">🦺 Броня</option>
                      <option value="pants">👖 Штаны</option>
                      <option value="boots">🥾 Сапоги</option>
                      <option value="gloves">🧤 Перчатки</option>
                      <option value="ring">💍 Кольцо</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-300">Название создаваемого оружия:</label>
                    <input
                      type="text"
                      value={newShopName}
                      onChange={(e) => setNewShopName(e.target.value)}
                      placeholder="Напр. Божественный Меч Фараона"
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-purple-300">Уровень (1–20):</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={newShopLvl}
                      onChange={(e) => setNewShopLvl(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-purple-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-orange-400">+Урон ⚔️:</label>
                    <input
                      type="number"
                      min={0}
                      value={newShopDmg}
                      onChange={(e) => setNewShopDmg(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-orange-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-red-400">+Здоровье ❤️:</label>
                    <input
                      type="number"
                      min={0}
                      value={newShopHp}
                      onChange={(e) => setNewShopHp(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-red-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-emerald-400">+Уклонение %:</label>
                    <input
                      type="number"
                      min={0}
                      value={newShopDodge}
                      onChange={(e) => setNewShopDodge(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-emerald-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-cyan-400">+Энергия ⚡:</label>
                    <input
                      type="number"
                      min={0}
                      value={newShopEnergy}
                      onChange={(e) => setNewShopEnergy(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-cyan-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-yellow-300">+Золото %:</label>
                    <input
                      type="number"
                      min={0}
                      value={newShopGoldPct}
                      onChange={(e) => setNewShopGoldPct(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-yellow-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-purple-300">+Опыт %:</label>
                    <input
                      type="number"
                      min={0}
                      value={newShopExpPct}
                      onChange={(e) => setNewShopExpPct(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-purple-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-300">Прочность:</label>
                    <input
                      type="number"
                      min={1}
                      value={newShopDurability}
                      onChange={(e) => setNewShopDurability(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-yellow-400">Цена (🪙):</label>
                    <input
                      type="number"
                      min={1}
                      value={newShopPrice}
                      onChange={(e) => setNewShopPrice(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-yellow-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isUpdatingDb}
                    onClick={() => handleAdminGrantCustomCreatedItem(false)}
                    className="rounded-lg bg-amber-600 hover:bg-amber-500 py-2 text-xs font-black text-slate-950 shadow"
                  >
                    🎒 Создать в сумку ({targetPlayerNick || hero.nick})
                  </button>
                  <button
                    type="button"
                    disabled={isUpdatingDb}
                    onClick={() => handleAdminGrantCustomCreatedItem(true)}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2 text-xs font-black text-white shadow"
                  >
                    ⚡ Создать и надеть ({targetPlayerNick || hero.nick})
                  </button>
                  <button
                    type="button"
                    disabled={isSavingShop}
                    onClick={handleCreateNewShopItem}
                    className="rounded-lg bg-cyan-600 hover:bg-cyan-500 py-2 text-xs font-black text-white shadow"
                  >
                    🛒 Добавить в Магазин всем
                  </button>
                </div>
              </div>

              {/* 4. Быстрый список всех вещей выбранного игрока для корректировки */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2">
                <div className="text-xs font-bold text-amber-300">
                  📋 3. Все вещи игрока «{targetPlayerNick || hero.nick}» — нажмите «✏️ Корректировать», чтобы изменить статы или картинку:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {ALL_SLOTS.map((slotKey) => {
                    const eqItem = equippedMap[slotKey];
                    if (!eqItem) return null;
                    return (
                      <div
                        key={`eq_${slotKey}`}
                        className="flex items-center justify-between rounded-lg border border-amber-500/40 bg-slate-950 px-2.5 py-1.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-7 h-7 rounded bg-slate-900 flex items-center justify-center p-0.5 shrink-0">
                            <ItemIcon icon={eqItem.icon} name={eqItem.name} className="w-full h-full" />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-[11px] font-bold text-amber-300">
                              [Надето] {eqItem.name} (Ур.{eqItem.lvl})
                            </div>
                            <div className="text-[9.5px] text-slate-400">
                              ⚔️+{eqItem.dmg} ❤️+{eqItem.hp}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingItemTarget({
                              source: 'equipped',
                              slotKey,
                              item: { ...eqItem }
                            })
                          }
                          className="ml-2 shrink-0 rounded bg-cyan-700 hover:bg-cyan-600 px-2 py-1 text-[10px] font-bold text-white"
                        >
                          ✏️ Корректировать
                        </button>
                      </div>
                    );
                  })}
                  {bagItems.map((it) => (
                    <div
                      key={`bag_${it.id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 rounded bg-slate-900 flex items-center justify-center p-0.5 shrink-0">
                          <ItemIcon icon={it.icon} name={it.name} className="w-full h-full" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-bold text-white">
                            [Сумка] {it.name} (Ур.{it.lvl})
                          </div>
                          <div className="text-[9.5px] text-slate-400">
                            ⚔️+{it.dmg} ❤️+{it.hp}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingItemTarget({
                            source: 'inventory',
                            item: { ...it }
                          })
                        }
                        className="ml-2 shrink-0 rounded bg-cyan-700 hover:bg-cyan-600 px-2 py-1 text-[10px] font-bold text-white"
                      >
                        ✏️ Корректировать
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Памятка внизу: требования к картинке по размерам и весу */}
              <div className="rounded-xl border border-amber-500/40 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-300">
                <div className="text-amber-400 font-black uppercase text-xs mb-1">
                  📏 Стандартные требования к картинке для создаваемой амуниции (размер и вес):
                </div>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <b>Стандартный размер иконки игры:</b>{' '}
                    <span className="text-white font-bold">
                      {GAME_ITEM_IMAGE_SPEC.standardWidth}×{GAME_ITEM_IMAGE_SPEC.standardHeight} пикселей
                    </span>{' '}
                    (пропорции <b className="text-amber-300">1:1 квадрат</b>, отображение в слотах
                    экипировки <b>64×64 px</b> и инвентаря <b>44×44 px</b>).
                  </li>
                  <li>
                    <b>Допустимое разрешение исходного файла:</b> от <b>32×32 px</b> до{' '}
                    <b>4096×4096 px</b> (автоматически масштабируется и центрируется под квадрат
                    128×128 px).
                  </li>
                  <li>
                    <b>Максимальный вес загружаемого файла:</b> до{' '}
                    <span className="text-cyan-300 font-bold">2 МБ (2048 КБ)</span>, после авто-сжатия
                    вес составляет <b>~15–40 КБ</b>.
                  </li>
                  <li>
                    <b>Форматы:</b> <span className="text-emerald-300 font-bold">PNG</span> (лучше
                    всего с прозрачным фоном),{' '}
                    <span className="text-emerald-300 font-bold">WEBP, JPG / JPEG, GIF, SVG</span>.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ==================== TAB 4: MAIL GIFTS & SERVER TOOLS ==================== */}
          {activeTab === 'server' && (
            <>
              {/* Отправка подарка по почте */}
              <div className="rounded-xl border border-purple-500/40 bg-slate-900/90 p-3">
                <div className="mb-2 font-bold text-purple-300">
                  🎁 Отправить подарок игроку по Почте (с кнопкой «Забрать подарок»)
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-400">Ник получателя:</label>
                    <input
                      type="text"
                      value={giftNick}
                      onChange={(e) => setGiftNick(e.target.value)}
                      placeholder="Ник игрока..."
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-amber-400">Золото 🪙:</label>
                    <input
                      type="number"
                      min={0}
                      value={giftGold}
                      onChange={(e) => setGiftGold(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-amber-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-cyan-400">Кристаллы 💎:</label>
                    <input
                      type="number"
                      min={0}
                      value={giftCrystals}
                      onChange={(e) => setGiftCrystals(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-cyan-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-emerald-400">Опыт (EXP):</label>
                    <input
                      type="number"
                      min={0}
                      value={giftExp}
                      onChange={(e) => setGiftExp(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-emerald-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-yellow-300">Дней VIP 👑:</label>
                    <input
                      type="number"
                      min={0}
                      value={giftPremiumDays}
                      onChange={(e) => setGiftPremiumDays(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-yellow-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-red-400">Зелья HP 🧪:</label>
                    <input
                      type="number"
                      min={0}
                      value={giftHpPotions}
                      onChange={(e) => setGiftHpPotions(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-red-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-sky-400">Зелья EN ⚗️:</label>
                    <input
                      type="number"
                      min={0}
                      value={giftEnPotions}
                      onChange={(e) => setGiftEnPotions(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-sky-300 outline-none"
                    />
                  </div>
                </div>

                <div className="mt-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-amber-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={giftIncludeItem}
                      onChange={(e) => setGiftIncludeItem(e.target.checked)}
                      className="h-4 w-4 accent-amber-500"
                    />
                    ⚔️ Прикрепить предмет экипировки к письму
                  </label>
                  {giftIncludeItem && (
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      <select
                        value={giftItemSlot}
                        onChange={(e) => setGiftItemSlot(e.target.value as ItemSlot)}
                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                      >
                        <option value="weapon">⚔️ Оружие</option>
                        <option value="armor">🛡️ Броня</option>
                        <option value="pants">👖 Штаны</option>
                        <option value="boots">👢 Сапоги</option>
                        <option value="gloves">🧤 Перчатки</option>
                        <option value="ring">💍 Кольцо</option>
                      </select>
                      <select
                        value={giftItemQuality}
                        onChange={(e) => setGiftItemQuality(e.target.value as ItemQualityKey)}
                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                      >
                        <option value="common">Обычное</option>
                        <option value="uncommon">Необычное</option>
                        <option value="rare">Редкое</option>
                        <option value="epic">Эпическое</option>
                        <option value="legendary">Легендарное</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={MAX_LEVEL}
                        value={giftItemLvl}
                        onChange={(e) => setGiftItemLvl(e.target.value)}
                        placeholder="Уровень"
                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                      />
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  value={giftMessageText}
                  onChange={(e) => setGiftMessageText(e.target.value)}
                  placeholder="Текст письма..."
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none"
                />

                <button
                  type="button"
                  onClick={handleSendGift}
                  className="mt-2 w-full rounded-lg bg-purple-600 py-2 text-xs font-black text-white hover:bg-purple-500"
                >
                  📩 Отправить подарок на Почту
                </button>
              </div>

              {/* Управление чатом и картой */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
                <div className="mb-2 font-bold text-cyan-300">📢 Мировой чат и Управление картой</div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={broadcastText}
                    onChange={(e) => setBroadcastText(e.target.value)}
                    placeholder="Текст системного объявления в чат..."
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBroadcast}
                    className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-500"
                  >
                    Отправить
                  </button>
                </div>

                <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {onClearWorldChat && (
                    <button
                      type="button"
                      onClick={onClearWorldChat}
                      className="rounded-lg border border-red-500/40 bg-red-950/60 py-2 text-xs font-bold text-red-300 hover:bg-red-900/60"
                    >
                      🧹 Очистить мировой чат
                    </button>
                  )}
                  {onSpawnBossesInAllPyramids && (
                    <button
                      type="button"
                      onClick={onSpawnBossesInAllPyramids}
                      className="rounded-lg border border-amber-500/60 bg-gradient-to-r from-red-600 via-amber-600 to-yellow-600 py-2 text-xs font-black text-white hover:from-red-500 hover:to-yellow-500 shadow active:scale-95"
                    >
                      👑 Призвать боссов во всех пирамидах (Т1, Т2, Т3)
                    </button>
                  )}
                  {onSpawnPortal && (
                    <button
                      type="button"
                      onClick={onSpawnPortal}
                      className="rounded-lg border border-purple-500/40 bg-purple-950/60 py-2 text-xs font-bold text-purple-300 hover:bg-purple-900/60"
                    >
                      🌀 Открыть портал под собой
                    </button>
                  )}
                  {onResetMap && (
                    <button
                      type="button"
                      onClick={onResetMap}
                      className="rounded-lg border border-amber-500/40 bg-amber-950/60 py-2 text-xs font-bold text-amber-300 hover:bg-amber-900/60"
                    >
                      🔄 Пересоздать карту Пирамиды
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ==================== TAB 2: CLANS MANAGEMENT (FULL CONTROL) ==================== */}
          {activeTab === 'clans' && (
            <div className="space-y-3">
              {/* Quick Create Clan for Admin */}
              <div className="rounded-xl border border-emerald-500/50 bg-slate-900/90 p-3 shadow">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-xs font-black uppercase text-emerald-300">
                      ➕ Создать новый клан (Бесплатно из Админки)
                    </h4>
                    <p className="text-[9px] text-slate-400">
                      Создайте клан и назначьте любого игрока главой без затрат кристаллов
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminClans(getAllClans());
                      setAdminPyramidState(getClanPyramidState());
                      showToast('Список кланов обновлен.');
                    }}
                    className="rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-[9.5px] font-bold text-slate-300 hover:text-white"
                  >
                    🔄 Обновить
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                  <div>
                    <label className="text-[8.5px] font-bold text-slate-400">Название клана</label>
                    <input
                      type="text"
                      placeholder="Напр. Стражи Ра"
                      value={adminNewClanName}
                      onChange={(e) => setAdminNewClanName(e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8.5px] font-bold text-slate-400">Тег (2–6 букв)</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="RA"
                      value={adminNewClanTag}
                      onChange={(e) => setAdminNewClanTag(e.target.value.toUpperCase())}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase text-amber-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8.5px] font-bold text-slate-400">Ник главы клана</label>
                    <input
                      type="text"
                      placeholder="Ник игрока"
                      value={adminNewClanLeader}
                      onChange={(e) => setAdminNewClanLeader(e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-white outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const res = createClan(
                        adminNewClanLeader.trim() || hero.nick || 'Admin',
                        20,
                        '👑',
                        adminNewClanName,
                        adminNewClanTag,
                        'Создан Администратором',
                        '🛡️'
                      );
                      if (res.ok && res.clan) {
                        setAdminNewClanName('');
                        setAdminNewClanTag('');
                        setAdminClans(getAllClans());
                        showToast(`✅ Клан «${res.clan.name}» [${res.clan.tag}] создан!`);
                      } else {
                        showToast(res.error || 'Ошибка создания клана');
                      }
                    }}
                    className="rounded-lg bg-emerald-600 py-1.5 px-3 text-[10px] font-black text-white hover:bg-emerald-500 shadow"
                  >
                    ➕ Создать клан
                  </button>
                </div>
              </div>

              {/* Clans List & Full Editing Block */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 shadow">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <h4 className="text-xs font-black uppercase text-amber-300">
                    🛡️ Полный контроль кланов ({adminClans.length})
                  </h4>
                  <span className="text-[9px] text-slate-400">
                    Уровни 1–20, Опыт, Вместимость базы, Эликсиры, Эмблема (GIF), Участники и Склад
                  </span>
                </div>

                {adminClans.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-[10px]">
                    В игре пока нет созданных кланов.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {adminClans.map((c) => {
                      const isSelected = selectedAdminClan?.id === c.id;
                      const maxCap = getClanMaxStorageCapacity(c);
                      const nextExp = c.level >= MAX_CLAN_LEVEL ? 0 : CLAN_EXP_TABLE[c.level] || 200;

                      return (
                        <div
                          key={c.id}
                          className={`rounded-xl border p-3 transition-colors ${
                            isSelected
                              ? 'border-amber-400 bg-slate-950 shadow-lg'
                              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-amber-500/60 bg-slate-950 text-2xl overflow-hidden">
                                {c.emblem.startsWith('data:') ? (
                                  <img src={c.emblem} alt={c.name} className="h-full w-full object-cover" />
                                ) : (
                                  <span>{c.emblem || '🛡️'}</span>
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="rounded bg-amber-500/20 border border-amber-400/80 px-1 py-0.2 text-[8.5px] font-black text-amber-300">
                                    [{c.tag}]
                                  </span>
                                  <strong className="text-sm font-black text-white">{c.name}</strong>
                                  <span className="rounded bg-purple-950 border border-purple-500/50 px-1.5 py-0.2 text-[9px] font-black text-purple-300">
                                    Ур. {c.level}/{MAX_CLAN_LEVEL} (EXP: {c.exp || 0}/{nextExp || 'MAX'})
                                  </span>
                                </div>
                                <div className="text-[9px] text-slate-400 mt-0.5">
                                  Глава: <strong className="text-amber-300">{c.leaderNick}</strong> • Участников: {c.members.length} • База: {c.storage.length}/{maxCap} слотов • Эликсиры: ❤️{c.elixirs?.hp || 0} ⚡{c.elixirs?.en || 0} ✨{c.elixirs?.exp || 0} • Влияние: ⭐ {c.influencePoints}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedAdminClan(null);
                                  } else {
                                    setSelectedAdminClan(c);
                                    setEditClanName(c.name);
                                    setEditClanTag(c.tag);
                                    setEditClanDescription(c.description || '');
                                    setEditClanEmblem(c.emblem);
                                    setEditClanLevel(c.level || 1);
                                    setEditClanExp(c.exp || 0);
                                    setEditClanInfluence(c.influencePoints || 0);
                                    setEditClanMaxStorage(
                                      c.maxStorageOverride ? String(c.maxStorageOverride) : ''
                                    );
                                    setEditClanElixirHp(c.elixirs?.hp || 0);
                                    setEditClanElixirEn(c.elixirs?.en || 0);
                                    setEditClanElixirExp(c.elixirs?.exp || 0);
                                    setEditClanLeader(c.leaderNick);
                                  }
                                }}
                                className={`rounded px-2.5 py-1 text-[9.5px] font-bold border transition-colors ${
                                  isSelected
                                    ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'
                                }`}
                              >
                                {isSelected ? 'Свернуть' : '⚙️ Полное управление'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Вы действительно хотите распустить клан «${c.name}» [${c.tag}]? Все вещи со склада будут автоматически возвращены владельцам!`
                                    )
                                  ) {
                                    const res = disbandClan(c.id, '', true);
                                    if (res.ok) {
                                      setAdminClans(getAllClans());
                                      setSelectedAdminClan(null);
                                      showToast(
                                        `Клан «${c.name}» распущен. Возвращено предметов: ${res.returnedItems.length}.`
                                      );
                                    } else {
                                      showToast(res.error || 'Ошибка');
                                    }
                                  }
                                }}
                                className="rounded border border-red-500/60 bg-red-950/80 px-2 py-1 text-[9.5px] font-bold text-red-300 hover:bg-red-800 hover:text-white"
                              >
                                ✕ Распустить
                              </button>
                            </div>
                          </div>

                          {/* Expanded Full Clan Editor Panel */}
                          {isSelected && (
                            <div className="mt-3 border-t border-slate-800 pt-3 space-y-3">
                              {/* Row 1: Name, Tag, Level (1-20), EXP, Influence, Storage Override, Leader */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div>
                                  <label className="text-[8.5px] font-bold text-slate-400">Название клана</label>
                                  <input
                                    type="text"
                                    value={editClanName}
                                    onChange={(e) => setEditClanName(e.target.value)}
                                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-white outline-none focus:border-amber-400"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8.5px] font-bold text-slate-400">Тег клана</label>
                                  <input
                                    type="text"
                                    maxLength={6}
                                    value={editClanTag}
                                    onChange={(e) => setEditClanTag(e.target.value.toUpperCase())}
                                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase text-amber-300 outline-none focus:border-amber-400"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8.5px] font-bold text-purple-300">
                                    Уровень клана (1–20)
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={MAX_CLAN_LEVEL}
                                    value={editClanLevel}
                                    onChange={(e) =>
                                      setEditClanLevel(
                                        Math.max(1, Math.min(MAX_CLAN_LEVEL, Number(e.target.value) || 1))
                                      )
                                    }
                                    className="w-full rounded border border-purple-500/60 bg-slate-900 px-2 py-1 text-[10px] font-black text-purple-200 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8.5px] font-bold text-purple-300">
                                    Опыт клана (EXP)
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={editClanExp}
                                    onChange={(e) => setEditClanExp(Math.max(0, Number(e.target.value) || 0))}
                                    className="w-full rounded border border-purple-500/60 bg-slate-900 px-2 py-1 text-[10px] text-purple-200 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8.5px] font-bold text-amber-300">
                                    Очки влияния (⭐)
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={editClanInfluence}
                                    onChange={(e) =>
                                      setEditClanInfluence(Math.max(0, Number(e.target.value) || 0))
                                    }
                                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-amber-300 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8.5px] font-bold text-slate-400">
                                    Лимит мест на базе (авто: {50 + (editClanLevel - 1) * 10})
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder={`По уровню (${50 + (editClanLevel - 1) * 10})`}
                                    value={editClanMaxStorage}
                                    onChange={(e) => setEditClanMaxStorage(e.target.value)}
                                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-white outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8.5px] font-bold text-slate-400">Глава клана</label>
                                  <select
                                    value={editClanLeader}
                                    onChange={(e) => setEditClanLeader(e.target.value)}
                                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-white outline-none"
                                  >
                                    {c.members.map((m) => (
                                      <option key={m.nick} value={m.nick}>
                                        {m.nick} ({m.lvl} ур.)
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[8.5px] font-bold text-slate-400">
                                    Эмблема (Эмодзи или GIF/PNG)
                                  </label>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={editClanEmblem.startsWith('data:') ? '🖼️ Своя/GIF' : editClanEmblem}
                                      onChange={(e) => setEditClanEmblem(e.target.value)}
                                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-white outline-none"
                                    />
                                    <label className="cursor-pointer rounded bg-amber-600 px-2 py-1 text-[9px] font-black text-slate-950 hover:bg-amber-500 shrink-0">
                                      GIF/Фото
                                      <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        className="hidden"
                                        onChange={async (e) => {
                                          const f = e.target.files?.[0];
                                          if (!f) return;
                                          const res = await processUploadedClanEmblem(f);
                                          e.target.value = '';
                                          if (res.ok && res.dataUrl) {
                                            setEditClanEmblem(res.dataUrl);
                                            showToast('✅ Эмблема клана (вкл. GIF анимацию) загружена!');
                                          } else {
                                            showToast(res.error || 'Ошибка загрузки');
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>
                                </div>
                              </div>

                              {/* Row 2: Clan Base Elixirs & Description */}
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 rounded-lg border border-emerald-500/30 bg-slate-900/70 p-2">
                                <div>
                                  <label className="text-[8.5px] font-bold text-red-300">
                                    🧪 Эликсир Здоровья на базе
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={editClanElixirHp}
                                    onChange={(e) =>
                                      setEditClanElixirHp(Math.max(0, Number(e.target.value) || 0))
                                    }
                                    className="w-full rounded border border-red-500/40 bg-slate-950 px-2 py-1 text-[10px] font-bold text-red-200 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8.5px] font-bold text-sky-300">
                                    ⚡ Эликсир Энергии на базе
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={editClanElixirEn}
                                    onChange={(e) =>
                                      setEditClanElixirEn(Math.max(0, Number(e.target.value) || 0))
                                    }
                                    className="w-full rounded border border-sky-500/40 bg-slate-950 px-2 py-1 text-[10px] font-bold text-sky-200 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8.5px] font-bold text-purple-300">
                                    ✨ Эликсир Опыта на базе
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={editClanElixirExp}
                                    onChange={(e) =>
                                      setEditClanElixirExp(Math.max(0, Number(e.target.value) || 0))
                                    }
                                    className="w-full rounded border border-purple-500/40 bg-slate-950 px-2 py-1 text-[10px] font-bold text-purple-200 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8.5px] font-bold text-slate-400">Описание клана</label>
                                  <input
                                    type="text"
                                    value={editClanDescription}
                                    onChange={(e) => setEditClanDescription(e.target.value)}
                                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-white outline-none"
                                  />
                                </div>
                              </div>

                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const res = updateClanInfo(
                                      c.id,
                                      '',
                                      {
                                        name: editClanName,
                                        tag: editClanTag,
                                        description: editClanDescription,
                                        emblem: editClanEmblem,
                                        level: editClanLevel,
                                        exp: editClanExp,
                                        maxStorageOverride: editClanMaxStorage
                                          ? Math.max(10, Number(editClanMaxStorage))
                                          : undefined,
                                        elixirs: {
                                          hp: editClanElixirHp,
                                          en: editClanElixirEn,
                                          exp: editClanElixirExp
                                        },
                                        influencePoints: editClanInfluence,
                                        leaderNick: editClanLeader
                                      },
                                      true
                                    );
                                    if (res.ok) {
                                      setAdminClans(getAllClans());
                                      showToast(`✅ Все параметры клана «${editClanName}» сохранены!`);
                                    } else {
                                      showToast(res.error || 'Ошибка сохранения');
                                    }
                                  }}
                                  className="rounded-lg border border-emerald-400 bg-emerald-600 px-4 py-1.5 text-[10px] font-black uppercase text-white hover:bg-emerald-500 shadow"
                                >
                                  💾 Сохранить все изменения клана
                                </button>
                              </div>

                              {/* Members & Storage Detailed Tables */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                                {/* Members list + Add Member */}
                                <div className="rounded-lg border border-slate-800 bg-slate-950 p-2 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9.5px] font-black uppercase text-amber-300">
                                      👥 Участники клана ({c.members.length})
                                    </span>
                                  </div>

                                  {/* Add or Change Role of Member */}
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      placeholder="Ник игрока..."
                                      value={newClanMemberNick}
                                      onChange={(e) => setNewClanMemberNick(e.target.value)}
                                      className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[9px] text-white outline-none"
                                    />
                                    <select
                                      value={newClanMemberRole}
                                      onChange={(e) =>
                                        setNewClanMemberRole(e.target.value as 'leader' | 'officer' | 'member')
                                      }
                                      className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[9px] text-amber-300 outline-none"
                                    >
                                      <option value="member">Боец</option>
                                      <option value="officer">Офицер</option>
                                      <option value="leader">Глава</option>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!newClanMemberNick.trim()) return;
                                        const res = adminAddOrUpdateClanMember(
                                          c.id,
                                          newClanMemberNick.trim(),
                                          newClanMemberRole,
                                          10
                                        );
                                        if (res.ok) {
                                          setNewClanMemberNick('');
                                          setAdminClans(getAllClans());
                                          showToast('✅ Состав клана обновлен!');
                                        } else {
                                          showToast(res.error || 'Ошибка');
                                        }
                                      }}
                                      className="rounded bg-amber-600 px-2 py-1 text-[9px] font-black text-slate-950 hover:bg-amber-500"
                                    >
                                      + Добавить/Роль
                                    </button>
                                  </div>

                                  <div className="max-h-44 overflow-y-auto space-y-1">
                                    {c.members.map((m) => (
                                      <div
                                        key={m.nick}
                                        className="flex items-center justify-between rounded bg-slate-900 px-2 py-1 text-[9px]"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <CharacterAvatar
                                            avatar={m.avatar || '🧙‍♂️'}
                                            nick={m.nick}
                                            size="xs"
                                          />
                                          <span>
                                            <strong>{m.nick}</strong> ({m.lvl} ур.)
                                          </span>
                                          <span className="text-[7.5px] text-amber-400">[{m.role}]</span>
                                        </div>
                                        {m.nick.toLowerCase() !== c.leaderNick.toLowerCase() && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (confirm(`Исключить игрока ${m.nick} из клана?`)) {
                                                const res = kickClanMember(c.id, c.leaderNick, m.nick);
                                                if (res.ok) {
                                                  setAdminClans(getAllClans());
                                                  showToast(`Игрок ${m.nick} исключен.`);
                                                } else {
                                                  showToast(res.error || 'Ошибка');
                                                }
                                              }
                                            }}
                                            className="rounded bg-red-950 border border-red-500/40 px-1.5 py-0.5 text-[7.5px] text-red-300 hover:bg-red-900"
                                          >
                                            Исключить
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Storage list */}
                                <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                                  <div className="text-[9.5px] font-black uppercase text-amber-300 mb-1">
                                    🏛️ Склад Базы ({c.storage.length} / {maxCap} слотов)
                                  </div>
                                  <div className="max-h-48 overflow-y-auto space-y-1">
                                    {c.storage.length === 0 ? (
                                      <div className="text-center text-slate-500 py-4 text-[9px]">
                                        Склад экипировки пуст
                                      </div>
                                    ) : (
                                      c.storage.map((st) => (
                                        <div
                                          key={st.id}
                                          className="flex items-center justify-between rounded bg-slate-900 px-2 py-1 text-[9px]"
                                        >
                                          <div className="flex items-center gap-1.5 truncate">
                                            <div className="w-5 h-5 shrink-0 flex items-center justify-center overflow-hidden">
                                              <ItemIcon icon={st.item.icon} alt={st.item.name} />
                                            </div>
                                            <span className="truncate">{st.item.name}</span>
                                            <span className="text-[7.5px] text-slate-400">
                                              ({st.originalOwnerNick})
                                            </span>
                                            {st.isRented && (
                                              <span className="text-[7.5px] text-red-400 font-bold">
                                                [У {st.rentedByNick}]
                                              </span>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const res = recallItemByOriginalOwner(
                                                c.id,
                                                st.originalOwnerNick,
                                                st.id,
                                                true
                                              );
                                              if (res.ok) {
                                                setAdminClans(getAllClans());
                                                showToast(
                                                  `Предмет «${st.item.name}» принудительно возвращен владельцу ${st.originalOwnerNick}!`
                                                );
                                              } else {
                                                showToast(res.error || 'Ошибка');
                                              }
                                            }}
                                            className="rounded border border-amber-500/40 bg-amber-950 px-1.5 py-0.5 text-[7.5px] font-bold text-amber-300 hover:bg-amber-900 shrink-0"
                                          >
                                            Вернуть владельцу
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 3: RADICAL CLAN PYRAMID EDITOR ==================== */}
          {activeTab === 'clanPyramid' && (
            <div className="space-y-3">
              {/* 1. Controlling Clan & Map Reset Controls */}
              <div className="rounded-xl border-2 border-red-500/70 bg-gradient-to-r from-red-950/60 via-slate-900 to-amber-950/60 p-3 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🔺</span>
                    <div>
                      <h4 className="text-xs font-black uppercase text-amber-300">
                        Кардинальное Редактирование Клановой Пирамиды (10×10)
                      </h4>
                      <p className="text-[9.5px] text-slate-300">
                        Владелец Трона:{' '}
                        <strong className="text-amber-300">
                          {adminPyramidState.controlledByClanName
                            ? `[${adminPyramidState.controlledByClanTag}] ${adminPyramidState.controlledByClanName}`
                            : 'Никто (Трон свободен)'}
                        </strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = adminUpdateClanPyramidConfig({}, true);
                        setAdminPyramidState(nextState);
                        showToast('🔄 10×10 карта Клановой Пирамиды полностью пересоздана!');
                      }}
                      className="rounded-lg border border-amber-400 bg-amber-600/30 px-2.5 py-1 text-[9.5px] font-black text-amber-200 hover:bg-amber-600/50"
                    >
                      🗺️ Пересоздать карту 10×10
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Обнулить очки влияния всех кланов и освободить Трон Пирамиды?')) {
                          const nextState = adminResetClanPyramidScores();
                          setAdminPyramidState(nextState);
                          setAdminClans(getAllClans());
                          showToast('🧹 Очки влияния всех кланов и владелец Трона сброшены!');
                        }
                      }}
                      className="rounded-lg border border-red-500/60 bg-red-950/80 px-2.5 py-1 text-[9.5px] font-bold text-red-200 hover:bg-red-900"
                    >
                      🧹 Сбросить сезон влияния
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                  <span className="text-[9.5px] font-bold text-slate-300">
                    Назначить клан-владелец Трона вручную:
                  </span>
                  <select
                    value={adminPyramidState.controlledByClanId || ''}
                    onChange={(e) => {
                      const nextClanId = e.target.value || null;
                      const nextState = adminSetClanPyramidOwner(nextClanId);
                      setAdminPyramidState(nextState);
                      setAdminClans(getAllClans());
                      showToast(
                        nextClanId ? '👑 Владелец Клановой Пирамиды изменен!' : 'Трон освобожден.'
                      );
                    }}
                    className="rounded border border-amber-500/60 bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-amber-300 outline-none"
                  >
                    <option value="">-- Трон свободен (Никто) --</option>
                    {adminClans.map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.tag}] {c.name} (Ур.{c.level}, ⭐ {c.influencePoints})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2. Global Parameters of Clan Pyramid (Title, Buffs %, Energy Cost, Respawn, Min Level) */}
              <div className="rounded-xl border border-amber-500/40 bg-slate-900/90 p-3 shadow space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <h4 className="text-xs font-black uppercase text-amber-300">
                    ⚙️ Глобальные параметры и бонусы Клановой Пирамиды
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const nextState = adminUpdateClanPyramidConfig(
                        {
                          title: cpTitle,
                          goldBonusPct: cpGoldBonus,
                          expBonusPct: cpExpBonus,
                          dmgBonusPct: cpDmgBonus,
                          hpBonusPct: cpHpBonus,
                          energyPerMove: cpEnergyPerMove,
                          respawnIntervalSec: cpRespawnSec,
                          minClanLevel: cpMinClanLvl
                        },
                        true
                      );
                      setAdminPyramidState(nextState);
                      showToast('✅ Параметры Клановой Пирамиды сохранены и карта обновлена!');
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-[10px] font-black text-white hover:bg-emerald-500 shadow"
                  >
                    💾 Сохранить настройки
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <label className="text-[8.5px] font-bold text-slate-400">
                      Название Клановой Пирамиды
                    </label>
                    <input
                      type="text"
                      value={cpTitle}
                      onChange={(e) => setCpTitle(e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8.5px] font-bold text-sky-300">
                      Энергия за удар (⚡)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={cpEnergyPerMove}
                      onChange={(e) => setCpEnergyPerMove(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold text-sky-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8.5px] font-bold text-amber-300">
                      Таймер респавна карты (сек)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={3600}
                      value={cpRespawnSec}
                      onChange={(e) => setCpRespawnSec(Math.max(10, Number(e.target.value) || 60))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold text-amber-300 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[8.5px] font-bold text-amber-300">
                      Бонус владельца: +% к Золоту
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={cpGoldBonus}
                      onChange={(e) => setCpGoldBonus(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold text-amber-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8.5px] font-bold text-purple-300">
                      Бонус владельца: +% к Опыту
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={cpExpBonus}
                      onChange={(e) => setCpExpBonus(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold text-purple-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8.5px] font-bold text-red-300">
                      Бонус владельца: +% к Урону
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={cpDmgBonus}
                      onChange={(e) => setCpDmgBonus(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold text-red-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8.5px] font-bold text-emerald-300">
                      Бонус владельца: +% к HP (Мин. ур. клана: {cpMinClanLvl})
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={cpHpBonus}
                        onChange={(e) => setCpHpBonus(Math.max(0, Number(e.target.value) || 0))}
                        className="w-1/2 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold text-emerald-300 outline-none"
                        title="Бонус +% к HP"
                      />
                      <input
                        type="number"
                        min={1}
                        max={MAX_CLAN_LEVEL}
                        value={cpMinClanLvl}
                        onChange={(e) =>
                          setCpMinClanLvl(
                            Math.max(1, Math.min(MAX_CLAN_LEVEL, Number(e.target.value) || 1))
                          )
                        }
                        className="w-1/2 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold text-white outline-none"
                        title="Мин. уровень клана для входа (1-20)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Create New Monster / Boss for Clan Pyramid */}
              <div className="rounded-xl border border-red-500/40 bg-slate-900/90 p-3 shadow space-y-2">
                <h4 className="text-xs font-black uppercase text-red-300">
                  ➕ Добавить нового Монстра или Босса в Клановую Пирамиду
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[8px] font-bold text-slate-400">Название монстра/босса</label>
                    <input
                      type="text"
                      placeholder="Страж Фараона"
                      value={newCpMobName}
                      onChange={(e) => setNewCpMobName(e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400">Иконка или GIF/Фото</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newCpMobIcon.startsWith('data:') ? '🖼️ GIF/Фото' : newCpMobIcon}
                        onChange={(e) => setNewCpMobIcon(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-white outline-none"
                      />
                      <label className="cursor-pointer rounded bg-amber-600 px-2 py-1 text-[8.5px] font-black text-slate-950 hover:bg-amber-500 shrink-0">
                        GIF/Фото
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const res = await processUploadedItemImage(f, 'cover');
                            e.target.value = '';
                            if ((res.ok || res.success) && res.dataUrl) {
                              setNewCpMobIcon(res.dataUrl);
                              showToast('✅ Картинка/GIF для монстра загружена!');
                            } else {
                              showToast(res.error || 'Ошибка загрузки');
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400">Уровень (1–20)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={newCpMobLvl}
                      onChange={(e) => setNewCpMobLvl(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400">Кол-во на карте 10×10</label>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={newCpMobSpawnCount}
                      onChange={(e) => setNewCpMobSpawnCount(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-amber-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-red-300">❤️ Здоровье (HP)</label>
                    <input
                      type="number"
                      min={10}
                      value={newCpMobHp}
                      onChange={(e) => setNewCpMobHp(Math.max(10, Number(e.target.value) || 100))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-red-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-orange-300">⚔️ Урон монстра</label>
                    <input
                      type="number"
                      min={1}
                      value={newCpMobDmg}
                      onChange={(e) => setNewCpMobDmg(Math.max(1, Number(e.target.value) || 10))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-orange-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-amber-300">⭐ Награда Влияния</label>
                    <input
                      type="number"
                      min={1}
                      value={newCpMobInf}
                      onChange={(e) => setNewCpMobInf(Math.max(1, Number(e.target.value) || 10))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-amber-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-purple-300">🛡️ Опыт Клана</label>
                    <input
                      type="number"
                      min={1}
                      value={newCpMobClanExp}
                      onChange={(e) => setNewCpMobClanExp(Math.max(1, Number(e.target.value) || 20))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-purple-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-yellow-300">🪙 Награда Золота</label>
                    <input
                      type="number"
                      min={0}
                      value={newCpMobGold}
                      onChange={(e) => setNewCpMobGold(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-yellow-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-cyan-300">💎 Награда Кристаллов</label>
                    <input
                      type="number"
                      min={0}
                      value={newCpMobCrystals}
                      onChange={(e) => setNewCpMobCrystals(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-cyan-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-300">✨ Опыт Герою</label>
                    <input
                      type="number"
                      min={0}
                      value={newCpMobExp}
                      onChange={(e) => setNewCpMobExp(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-200 outline-none"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-1.5 text-[9.5px] font-bold text-amber-300 cursor-pointer pb-1">
                      <input
                        type="checkbox"
                        checked={newCpMobIsBoss}
                        onChange={(e) => setNewCpMobIsBoss(e.target.checked)}
                      />
                      👑 Это Верховный Босс [0,0]
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!newCpMobName.trim()) {
                      showToast('Введите имя монстра!');
                      return;
                    }
                    const created: ClanPyramidMonsterTemplate = {
                      id: `cpmob_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                      name: newCpMobName.trim(),
                      icon: newCpMobIcon || '🦂',
                      lvl: newCpMobLvl,
                      hp: newCpMobHp,
                      maxHp: newCpMobHp,
                      dmg: newCpMobDmg,
                      influenceReward: newCpMobInf,
                      clanExpReward: newCpMobClanExp,
                      expReward: newCpMobExp,
                      goldReward: newCpMobGold,
                      crystalReward: newCpMobCrystals,
                      spawnCount: newCpMobIsBoss ? 1 : newCpMobSpawnCount,
                      isBoss: newCpMobIsBoss
                    };
                    const nextState = adminSaveClanPyramidMonster(created);
                    setAdminPyramidState(nextState);
                    setNewCpMobName('');
                    showToast(`✅ Монстр «${created.name}» добавлен на карту Клановой Пирамиды!`);
                  }}
                  className="w-full rounded-lg bg-gradient-to-r from-red-600 to-amber-600 py-1.5 text-[10px] font-black uppercase text-white shadow hover:brightness-110"
                >
                  ➕ Добавить в Клановую Пирамиду и пересоздать карту
                </button>
              </div>

              {/* 4. List & Inline Editor of All Clan Pyramid Monsters & Bosses */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 shadow space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <h4 className="text-xs font-black uppercase text-amber-300">
                    👹 Все монстры и боссы Клановой Пирамиды ({adminPyramidState.config?.monsters.length || 0})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Сбросить монстров и настройки Клановой Пирамиды к стандартным?')) {
                        const nextState = adminUpdateClanPyramidConfig(DEFAULT_CLAN_PYRAMID_CONFIG, true);
                        setAdminPyramidState(nextState);
                        showToast('↩️ Настройки и монстры Клановой Пирамиды сброшены к стандартным!');
                      }
                    }}
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-[8.5px] font-bold text-slate-400 hover:text-white"
                  >
                    ↩️ Сброс к стандартным
                  </button>
                </div>

                <div className="space-y-2">
                  {(adminPyramidState.config?.monsters || []).map((mob) => (
                    <div
                      key={mob.id}
                      className={`rounded-xl border p-2.5 space-y-2 ${
                        mob.isBoss
                          ? 'border-amber-500/70 bg-amber-950/20'
                          : 'border-slate-800 bg-slate-950/90'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg border border-amber-500/50 bg-slate-900 flex items-center justify-center overflow-hidden p-0.5">
                            <ItemIcon icon={mob.icon} alt={mob.name} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              {mob.isBoss && (
                                <span className="rounded bg-amber-500/20 border border-amber-400 px-1 text-[8px] font-black text-amber-300">
                                  👑 БОСС [0,0]
                                </span>
                              )}
                              <input
                                type="text"
                                value={mob.name}
                                onChange={(e) => {
                                  const nextState = adminSaveClanPyramidMonster({
                                    ...mob,
                                    name: e.target.value
                                  });
                                  setAdminPyramidState(nextState);
                                }}
                                className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <label className="cursor-pointer rounded border border-amber-500/50 bg-amber-950/60 px-2 py-1 text-[8.5px] font-bold text-amber-300 hover:bg-amber-900">
                            🖼️ Загрузить GIF/Фото
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif"
                              className="hidden"
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                const res = await processUploadedItemImage(f, 'cover');
                                e.target.value = '';
                                if ((res.ok || res.success) && res.dataUrl) {
                                  const nextState = adminSaveClanPyramidMonster({
                                    ...mob,
                                    icon: res.dataUrl
                                  });
                                  setAdminPyramidState(nextState);
                                  showToast(`✅ Картинка/GIF для «${mob.name}» обновлена!`);
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const nextState = adminDeleteClanPyramidMonster(mob.id);
                              setAdminPyramidState(nextState);
                              showToast(`🗑️ Монстр «${mob.name}» удален из Клановой Пирамиды.`);
                            }}
                            className="rounded border border-red-500/50 bg-red-950/70 px-2 py-1 text-[8.5px] font-bold text-red-300 hover:bg-red-900"
                          >
                            🗑️ Удалить
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-8 gap-1.5 text-[8.5px]">
                        <div>
                          <label className="text-slate-400 block">Уровень</label>
                          <input
                            type="number"
                            min={1}
                            value={mob.lvl}
                            onChange={(e) => {
                              const nextState = adminSaveClanPyramidMonster({
                                ...mob,
                                lvl: Math.max(1, Number(e.target.value) || 1)
                              });
                              setAdminPyramidState(nextState);
                            }}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-red-300 block">❤️ HP</label>
                          <input
                            type="number"
                            min={10}
                            value={mob.maxHp ?? mob.hp}
                            onChange={(e) => {
                              const nextHp = Math.max(10, Number(e.target.value) || 10);
                              const nextState = adminSaveClanPyramidMonster({
                                ...mob,
                                hp: nextHp,
                                maxHp: nextHp
                              });
                              setAdminPyramidState(nextState);
                            }}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-red-300 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-orange-300 block">⚔️ Урон</label>
                          <input
                            type="number"
                            min={1}
                            value={mob.dmg}
                            onChange={(e) => {
                              const nextState = adminSaveClanPyramidMonster({
                                ...mob,
                                dmg: Math.max(1, Number(e.target.value) || 1)
                              });
                              setAdminPyramidState(nextState);
                            }}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-orange-300 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-amber-300 block">⭐ Влияние</label>
                          <input
                            type="number"
                            min={1}
                            value={mob.influenceReward}
                            onChange={(e) => {
                              const nextState = adminSaveClanPyramidMonster({
                                ...mob,
                                influenceReward: Math.max(1, Number(e.target.value) || 1)
                              });
                              setAdminPyramidState(nextState);
                            }}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-amber-300 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-purple-300 block">🛡️ Опыт клана</label>
                          <input
                            type="number"
                            min={1}
                            value={mob.clanExpReward}
                            onChange={(e) => {
                              const nextState = adminSaveClanPyramidMonster({
                                ...mob,
                                clanExpReward: Math.max(1, Number(e.target.value) || 1)
                              });
                              setAdminPyramidState(nextState);
                            }}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-purple-300 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-yellow-300 block">🪙 Золото</label>
                          <input
                            type="number"
                            min={0}
                            value={mob.goldReward}
                            onChange={(e) => {
                              const nextState = adminSaveClanPyramidMonster({
                                ...mob,
                                goldReward: Math.max(0, Number(e.target.value) || 0)
                              });
                              setAdminPyramidState(nextState);
                            }}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-yellow-300 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-cyan-300 block">💎 Кристаллы</label>
                          <input
                            type="number"
                            min={0}
                            value={mob.crystalReward}
                            onChange={(e) => {
                              const nextState = adminSaveClanPyramidMonster({
                                ...mob,
                                crystalReward: Math.max(0, Number(e.target.value) || 0)
                              });
                              setAdminPyramidState(nextState);
                            }}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-cyan-300 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-slate-300 block">Кол-во на карте</label>
                          <input
                            type="number"
                            min={1}
                            max={40}
                            value={mob.spawnCount}
                            onChange={(e) => {
                              const nextState = adminSaveClanPyramidMonster({
                                ...mob,
                                spawnCount: Math.max(1, Number(e.target.value) || 1)
                              });
                              setAdminPyramidState(nextState);
                            }}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-white font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'roulette' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-900 p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-xl font-black text-amber-300">
                      <span>🎡</span> Управление призами рулетки (CS:GO / Кейс)
                    </h2>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                      Настройка призов колеса удачи: добавляйте скины персонажей, кристаллы, золото и предметы.
                      Задавайте шанс выпадения (вес вероятности) и срок действия скинов (навсегда или временно).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSavingRoulette}
                      onClick={async () => {
                        setIsSavingRoulette(true);
                        try {
                          const synced = await syncRoulettePrizesFromSupabase();
                          setAdminRoulettePrizes(synced);
                          showToast('🔄 Призы рулетки синхронизированы с БД!');
                        } finally {
                          setIsSavingRoulette(false);
                        }
                      }}
                      className="rounded-lg border border-amber-500/50 bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-all flex items-center gap-1.5"
                    >
                      <span>🔄</span> Обновить из БД
                    </button>
                    <button
                      type="button"
                      disabled={isSavingRoulette}
                      onClick={async () => {
                        setAdminRoulettePrizes(DEFAULT_ROULETTE_PRIZES);
                        await saveRoulettePrizesToSupabase(DEFAULT_ROULETTE_PRIZES);
                        showToast('↩️ Призы рулетки сброшены к стандартным');
                      }}
                      className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 transition-all"
                    >
                      Сброс
                    </button>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800/80 text-xs">
                  <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                    <div className="text-slate-400">Всего призов:</div>
                    <div className="text-base font-black text-white">{adminRoulettePrizes.length}</div>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                    <div className="text-slate-400">Активных в рулетке:</div>
                    <div className="text-base font-black text-emerald-400">
                      {adminRoulettePrizes.filter((p) => p.enabled !== false).length}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                    <div className="text-slate-400">Суммарный вес:</div>
                    <div className="text-base font-black text-amber-300">
                      {adminRoulettePrizes
                        .filter((p) => p.enabled !== false)
                        .reduce((sum, p) => sum + (p.weight || 0), 0)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                    <div className="text-slate-400">Скинов в призах:</div>
                    <div className="text-base font-black text-cyan-400">
                      {adminRoulettePrizes.filter((p) => p.type === 'skin').length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Add New Roulette Prize Form */}
              <div className="rounded-xl border border-slate-700 bg-slate-900/90 p-5 shadow-md">
                <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span>➕</span> Добавить приз в рулетку
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Prize Type */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Тип приза:</label>
                    <select
                      value={newRpType}
                      onChange={(e) => setNewRpType(e.target.value as any)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white font-semibold outline-none focus:border-amber-400"
                    >
                      <option value="skin">🎭 Скин персонажа</option>
                      <option value="crystals">💎 Кристаллы</option>
                      <option value="gold">🪙 Золото</option>
                      <option value="jackpot">👑 Джекпот (Кристаллы)</option>
                      <option value="item">📦 Предмет экипировки</option>
                    </select>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Название приза:</label>
                    <input
                      type="text"
                      placeholder="Например: Темный Паладин или 500 Кристаллов"
                      value={newRpName}
                      onChange={(e) => setNewRpName(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-amber-400 font-medium"
                    />
                  </div>

                  {/* Quality */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Редкость (Качество):</label>
                    <select
                      value={newRpQuality}
                      onChange={(e) => setNewRpQuality(e.target.value as any)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white font-semibold outline-none focus:border-amber-400"
                    >
                      <option value="common">⚪ Обычный (Common)</option>
                      <option value="rare">🔵 Редкий (Rare)</option>
                      <option value="epic">🟣 Эпический (Epic)</option>
                      <option value="legendary">🟡 Легендарный (Legendary)</option>
                      <option value="custom">🔴 Кастомный (Custom)</option>
                    </select>
                  </div>

                  {/* Weight / Chance */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Вес вероятности (чем больше, тем чаще выпадает):
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={newRpWeight}
                      onChange={(e) => setNewRpWeight(String(Math.max(1, parseInt(e.target.value, 10) || 1)))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-amber-300 font-black outline-none focus:border-amber-400"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Обычный: 50-100, Редкий: 20-40, Эпик: 10-20, Легендарный: 1-5
                    </span>
                  </div>

                  {/* Conditional: Skin Selection */}
                  {newRpType === 'skin' ? (
                    <>
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">Выберите персонажа (скин):</label>
                        <select
                          value={newRpSkinId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewRpSkinId(val);
                            const found = shopSkins.find((s) => s.id === val);
                            if (found) {
                              setNewRpName(found.name);
                              setNewRpQuality(found.quality);
                            }
                          }}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white font-medium outline-none focus:border-amber-400"
                        >
                          <option value="">-- Выберите скин из каталога --</option>
                          {shopSkins.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.quality}) {s.isExclusive || s.isPersonal ? '🔒 Личный/Эксклюзив' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Срок действия скина (0 = Навсегда):
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setNewRpSkinDuration('0')}
                            className={`flex-1 py-2 px-2.5 rounded-lg font-bold text-center border transition-all text-xs ${
                              Number(newRpSkinDuration) === 0
                                ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            ♾️ Навсегда
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (Number(newRpSkinDuration) === 0) setNewRpSkinDuration('7');
                            }}
                            className={`flex-1 py-2 px-2.5 rounded-lg font-bold text-center border transition-all text-xs ${
                              Number(newRpSkinDuration) > 0
                                ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            ⏳ Временно
                          </button>
                        </div>
                        {Number(newRpSkinDuration) > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="365"
                              value={newRpSkinDuration}
                              onChange={(e) =>
                                setNewRpSkinDuration(String(Math.max(1, parseInt(e.target.value, 10) || 1)))
                              }
                              className="w-20 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-center font-bold text-white"
                            />
                            <span className="text-slate-400 text-[11px]">дней в коллекции (затем пропадает)</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">Количество награды:</label>
                        <input
                          type="number"
                          min="1"
                          value={newRpAmount}
                          onChange={(e) => setNewRpAmount(String(Math.max(1, parseInt(e.target.value, 10) || 1)))}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white font-bold outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">Иконка приза:</label>
                        <input
                          type="text"
                          value={newRpIcon}
                          onChange={(e) => setNewRpIcon(e.target.value)}
                          placeholder="🪙 / 💎 / ⚔️"
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white font-bold outline-none focus:border-amber-400"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={isSavingRoulette}
                    onClick={handleCreateRoulettePrize}
                    className="rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-2.5 text-xs font-bold text-slate-950 shadow-md hover:from-amber-400 hover:to-yellow-400 transition-all flex items-center gap-2"
                  >
                    <span>➕</span> Добавить приз в список рулетки
                  </button>
                </div>
              </div>

              {/* Existing Roulette Prizes List */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-md">
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span>📋</span> Текущий пул призов рулетки ({adminRoulettePrizes.length})
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2.5 px-3">Вкл</th>
                        <th className="py-2.5 px-3">Превью</th>
                        <th className="py-2.5 px-3">Название</th>
                        <th className="py-2.5 px-3">Тип</th>
                        <th className="py-2.5 px-3">Качество</th>
                        <th className="py-2.5 px-3">Награда / Срок</th>
                        <th className="py-2.5 px-3">Вес (Шанс)</th>
                        <th className="py-2.5 px-3">% Выпадения</th>
                        <th className="py-2.5 px-3 text-right">Действие</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {adminRoulettePrizes.map((prize) => {
                        const totalWeight = adminRoulettePrizes
                          .filter((p) => p.enabled !== false)
                          .reduce((sum, p) => sum + (p.weight || 0), 0);
                        const pct =
                          prize.enabled !== false && totalWeight > 0
                            ? ((prize.weight / totalWeight) * 100).toFixed(1)
                            : '0.0';

                        const matchedSkin = prize.skinId
                          ? shopSkins.find((s) => s.id === prize.skinId)
                          : null;

                        return (
                          <tr
                            key={prize.id}
                            className={`hover:bg-slate-800/40 transition-colors ${
                              prize.enabled === false ? 'opacity-40' : ''
                            }`}
                          >
                            <td className="py-3 px-3">
                              <input
                                type="checkbox"
                                checked={prize.enabled !== false}
                                onChange={() => handleToggleRoulettePrize(prize.id)}
                                className="h-4 w-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-3">
                              {prize.type === 'skin' ? (
                                <div className="h-10 w-10 overflow-hidden rounded-lg border border-amber-500/40 bg-slate-800 flex items-center justify-center">
                                  {matchedSkin ? (
                                    <CharacterAvatar
                                      avatar={matchedSkin.avatarUrl || matchedSkin.icon}
                                      alt={matchedSkin.name}
                                      size="sm"
                                    />
                                  ) : (
                                    <span className="text-xl">🎭</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-2xl">{prize.icon || '🎁'}</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-bold text-white">
                              {prize.name}
                              {prize.type === 'skin' && (matchedSkin?.isExclusive || matchedSkin?.isPersonal) && (
                                <span className="ml-1.5 rounded bg-amber-500/20 px-1 py-0.5 text-[10px] text-amber-300 font-semibold">
                                  🔒 Эксклюзив
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                                {prize.type === 'skin' ? 'Скин персонажа' : prize.type}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                                  prize.quality === 'legendary'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                    : prize.quality === 'epic'
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                                    : prize.quality === 'rare'
                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                                    : 'bg-slate-700 text-slate-300'
                                }`}
                              >
                                {prize.quality}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {prize.type === 'skin' ? (
                                prize.skinDurationDays && prize.skinDurationDays > 0 ? (
                                  <span className="text-amber-300 font-bold">⏳ {prize.skinDurationDays} дн.</span>
                                ) : (
                                  <span className="text-emerald-400 font-bold">♾️ Навсегда</span>
                                )
                              ) : (
                                <span className="font-bold text-cyan-300">x{prize.amount || 1}</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="1"
                                  max="1000"
                                  value={prize.weight}
                                  onChange={(e) =>
                                    handleUpdateRoulettePrizeWeight(prize.id, parseInt(e.target.value, 10) || 1)
                                  }
                                  className="w-16 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-center font-bold text-amber-300 outline-none focus:border-amber-400"
                                />
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-mono font-bold text-emerald-400">{pct}%</span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteRoulettePrize(prize.id)}
                                className="rounded bg-rose-950/40 border border-rose-500/30 px-2 py-1 text-rose-300 hover:bg-rose-900/60 font-semibold"
                                title="Удалить приз"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 10: BANK & CRYSTAL PACKAGES EDITOR ==================== */}
          {activeTab === 'bank' && (
            <div className="space-y-4">
              {/* Header */}
              <div className="rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-black p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-black text-cyan-300">
                    <span>🏦</span> Редактор Банка и Пакетов Кристаллов
                  </h2>
                  <p className="text-[10px] text-slate-300 mt-0.5">
                    Настройка пакетов кристаллов, цен в $, инструкции для игроков и ручное зачисление кристаллов по заказам
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSavingShop}
                    onClick={handleSaveShopCatalog}
                    className="rounded-lg bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-2 text-xs font-black text-slate-950 shadow hover:from-cyan-400 hover:to-sky-400 disabled:opacity-50 active:scale-95 cursor-pointer"
                  >
                    {isSavingShop ? '⏳ Сохранение...' : '💾 Сохранить настройки Банка'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFeatureFlags((prev) => ({
                        ...prev,
                        bankPackages: DEFAULT_BANK_PACKAGES.map((p) => ({ ...p }))
                      }));
                      showToast('↩️ Пакеты банка сброшены к стандартным!');
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    ↩️ Сброс
                  </button>
                </div>
              </div>

              {/* Быстрое ручное начисление кристаллов игроку при подтверждении оплаты заказа */}
              <div className="rounded-xl border-2 border-emerald-500/50 bg-slate-900/90 p-3.5 space-y-2.5 shadow">
                <div className="flex items-center justify-between border-b border-emerald-500/30 pb-1.5">
                  <div className="font-black text-emerald-300 text-xs flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>Ручное зачисление кристаллов игроку (Оплата заказа подтверждена)</span>
                  </div>
                  <span className="text-[9.5px] text-slate-400">
                    Мгновенно пополняет баланс кристаллов персонажа в БД Supabase
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="text-[9px] font-bold text-slate-300">Ник персонажа:</label>
                    <input
                      type="text"
                      value={adminBankTargetNick}
                      onChange={(e) => setAdminBankTargetNick(e.target.value)}
                      placeholder="Ник персонажа..."
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-cyan-300">Количество кристаллов (💎):</label>
                    <input
                      type="number"
                      min={1}
                      value={adminBankGrantCrystals}
                      onChange={(e) => setAdminBankGrantCrystals(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-cyan-300 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isUpdatingDb}
                    onClick={async () => {
                      const nick = adminBankTargetNick.trim();
                      const amount = parseInt(adminBankGrantCrystals, 10) || 0;
                      if (!nick || amount <= 0) {
                        showToast('Укажите ник игрока и количество кристаллов!');
                        return;
                      }
                      setIsUpdatingDb(true);
                      try {
                        const res = await adminModifyPlayerBalanceInSupabase(nick, { crystalsDelta: amount });
                        if (res.success) {
                          if (res.rawPlayer) populateFieldsFromUnpacked(res.rawPlayer, nick);
                          syncLocalSelfIfMatched(nick, res.updatedPlayer, res.rawPlayer);
                          await refreshDbPlayersList();
                          showToast(`⚡ Игроку ${nick} успешно зачислено +${amount} 💎 кристаллов!`);
                          if (onBroadcastSystemMessage) {
                            onBroadcastSystemMessage(`💳 [Банк] Игроку ${nick} успешно зачислено +${amount} 💎 кристаллов по заказу!`);
                          }
                        } else {
                          showToast(`❌ Ошибка: ${res.error || 'не удалось зачислить'}`);
                        }
                      } finally {
                        setIsUpdatingDb(false);
                      }
                    }}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-500 py-1.5 px-3 text-xs font-black text-white shadow disabled:opacity-50 cursor-pointer"
                  >
                    {isUpdatingDb ? '⏳ Зачисление...' : `⚡ Зачислить +${adminBankGrantCrystals} 💎 игроку ${adminBankTargetNick}`}
                  </button>
                </div>
              </div>

              {/* Общие параметры Банка и Инструкция для игроков */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 space-y-3">
                <div className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                  <span>⚙️</span>
                  <span>Настройки работы Банка и контакты Администратора:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs font-bold text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featureFlags.bankPurchaseEnabled !== false}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          bankPurchaseEnabled: e.target.checked
                        }))
                      }
                      className="h-4 w-4 accent-cyan-500"
                    />
                    <span>Покупка кристаллов в Банке открыта для игроков</span>
                  </label>

                  <div>
                    <label className="text-[10px] text-cyan-300 font-bold">
                      Контакты / Ссылка / Реквизиты для связи (Telegram / Карта):
                    </label>
                    <input
                      type="text"
                      value={featureFlags.bankPaymentUrl || ''}
                      onChange={(e) =>
                        setFeatureFlags((prev) => ({
                          ...prev,
                          bankPaymentUrl: e.target.value
                        }))
                      }
                      placeholder="Напр. @admin_telegram или t.me/mygame_admin"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-amber-300 font-bold">
                    Текст инструкции в карточке заказа («Покупка кристаллов через Администратора»):
                  </label>
                  <textarea
                    rows={2}
                    value={
                      featureFlags.bankPaymentInstructions ||
                      'Покупка кристаллов происходит только через Администратора игры. Выберите нужный пакет, нажмите «Заказать», сверьте ник своего персонажа и напишите Администратору для оплаты и зачисления.'
                    }
                    onChange={(e) =>
                      setFeatureFlags((prev) => ({
                        ...prev,
                        bankPaymentInstructions: e.target.value
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200 outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Добавить новый пакет кристаллов */}
              <div className="rounded-xl border border-cyan-500/40 bg-slate-900/90 p-3.5 space-y-2.5">
                <div className="font-bold text-cyan-300 text-xs">
                  ➕ Добавить новый пакет кристаллов в Банк
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[9px] text-cyan-300">Кристаллы (💎):</label>
                    <input
                      type="number"
                      min={1}
                      value={newBankPackCrystals}
                      onChange={(e) => setNewBankPackCrystals(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-cyan-300"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-emerald-300">Цена в USD ($):</label>
                    <input
                      type="number"
                      min={1}
                      step="0.5"
                      value={newBankPackPriceUsd}
                      onChange={(e) => setNewBankPackPriceUsd(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-emerald-300"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-fuchsia-300">Бонус (💎):</label>
                    <input
                      type="number"
                      min={0}
                      value={newBankPackBonus}
                      onChange={(e) => setNewBankPackBonus(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-fuchsia-300"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-300">Название / Лейбл:</label>
                    <input
                      type="text"
                      placeholder="Напр. Сундук Жреца"
                      value={newBankPackLabel}
                      onChange={(e) => setNewBankPackLabel(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const crystals = Math.max(1, parseInt(newBankPackCrystals, 10) || 100);
                    const priceUsd = Math.max(1, parseFloat(newBankPackPriceUsd) || 1);
                    const bonus = Math.max(0, parseInt(newBankPackBonus, 10) || 0);
                    const created: BankPackageConfig = {
                      id: `bank_pack_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                      crystals,
                      priceUsd,
                      bonusCrystals: bonus,
                      label: newBankPackLabel.trim() || `${crystals} кристаллов`,
                      enabled: true
                    };
                    const curPacks = getBankPackages(featureFlags);
                    setFeatureFlags((prev) => ({
                      ...prev,
                      bankPackages: [...curPacks, created]
                    }));
                    setNewBankPackLabel('');
                    showToast(`✅ Пакет на ${crystals} 💎 за ${priceUsd}$ добавлен! Нажмите «Сохранить».`);
                  }}
                  className="w-full rounded-lg bg-cyan-600 hover:bg-cyan-500 py-1.5 text-xs font-black text-slate-950 shadow cursor-pointer"
                >
                  ➕ Добавить пакет в список Банка
                </button>
              </div>

              {/* Текущие пакеты кристаллов в Банке */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="font-bold text-white text-xs">
                    📋 Список пакетов в Банке ({getBankPackages(featureFlags).length} шт.)
                  </div>
                  <span className="text-[9.5px] text-slate-400">
                    Изменяйте количество кристаллов, цену в $ и статус активности пакета
                  </span>
                </div>

                <div className="space-y-2">
                  {getBankPackages(featureFlags).map((pack) => (
                    <div
                      key={pack.id}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5 ${
                        pack.enabled !== false
                          ? 'border-cyan-500/40 bg-slate-950/90'
                          : 'border-slate-800 bg-slate-950/40 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={pack.enabled !== false}
                          onChange={(e) => {
                            const cur = getBankPackages(featureFlags);
                            setFeatureFlags((prev) => ({
                              ...prev,
                              bankPackages: cur.map((p) =>
                                p.id === pack.id ? { ...p, enabled: e.target.checked } : p
                              )
                            }));
                          }}
                          className="h-4 w-4 accent-cyan-500 cursor-pointer"
                          title="Включен / Выключен в банке"
                        />
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-950/60 text-lg">
                          💎
                        </div>
                        <input
                          type="text"
                          value={pack.label || ''}
                          onChange={(e) => {
                            const cur = getBankPackages(featureFlags);
                            setFeatureFlags((prev) => ({
                              ...prev,
                              bankPackages: cur.map((p) =>
                                p.id === pack.id ? { ...p, label: e.target.value } : p
                              )
                            }));
                          }}
                          className="w-36 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-bold text-white outline-none"
                          placeholder="Название пакета"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <label className="text-[9px] text-cyan-300">Кристаллы:</label>
                          <input
                            type="number"
                            min={1}
                            value={pack.crystals}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                              const cur = getBankPackages(featureFlags);
                              setFeatureFlags((prev) => ({
                                ...prev,
                                bankPackages: cur.map((p) =>
                                  p.id === pack.id ? { ...p, crystals: val } : p
                                )
                              }));
                            }}
                            className="w-20 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-center text-xs font-bold text-cyan-300"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <label className="text-[9px] text-emerald-300">Цена ($):</label>
                          <input
                            type="number"
                            min={1}
                            step="0.5"
                            value={pack.priceUsd}
                            onChange={(e) => {
                              const val = Math.max(1, parseFloat(e.target.value) || 1);
                              const cur = getBankPackages(featureFlags);
                              setFeatureFlags((prev) => ({
                                ...prev,
                                bankPackages: cur.map((p) =>
                                  p.id === pack.id ? { ...p, priceUsd: val } : p
                                )
                              }));
                            }}
                            className="w-16 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-center text-xs font-bold text-emerald-300"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <label className="text-[9px] text-fuchsia-300">Бонус:</label>
                          <input
                            type="number"
                            min={0}
                            value={pack.bonusCrystals || 0}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                              const cur = getBankPackages(featureFlags);
                              setFeatureFlags((prev) => ({
                                ...prev,
                                bankPackages: cur.map((p) =>
                                  p.id === pack.id ? { ...p, bonusCrystals: val } : p
                                )
                              }));
                            }}
                            className="w-16 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-center text-xs font-bold text-fuchsia-300"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const cur = getBankPackages(featureFlags);
                            setFeatureFlags((prev) => ({
                              ...prev,
                              bankPackages: cur.filter((p) => p.id !== pack.id)
                            }));
                            showToast('Пакет удален. Не забудьте нажать «Сохранить»!');
                          }}
                          className="rounded bg-rose-950/40 border border-rose-500/30 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/60 cursor-pointer"
                          title="Удалить пакет"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin Send Skin to Player Modal Dialog */}
      {sendSkinModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/50 bg-slate-900 p-5 shadow-2xl shadow-amber-500/20 text-white animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎁</span>
                <div>
                  <h3 className="text-base font-black text-amber-300">Отправить скин игроку</h3>
                  <p className="text-xs text-slate-400">
                    Скин: <span className="text-amber-200 font-bold">{sendSkinModalTarget.name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSendSkinModalTarget(null)}
                className="text-slate-400 hover:text-white text-lg px-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Введите ник или выберите игрока:</label>
                <input
                  type="text"
                  placeholder="Введите ник игрока..."
                  value={sendSkinRecipient}
                  onChange={(e) => setSendSkinRecipient(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white font-bold focus:border-amber-400 outline-none mb-2"
                />
                <select
                  value={sendSkinRecipient}
                  onChange={(e) => setSendSkinRecipient(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-200 font-medium focus:border-amber-400 outline-none"
                >
                  <option value="">-- Или выберите из списка игроков ({dbPlayers.length}) --</option>
                  {dbPlayers.map((p) => {
                    const pNick = p.name || p.nick || '';
                    return (
                      <option key={pNick} value={pNick}>
                        {pNick} (Ур. {p.lvl || 1})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
                <label className="block text-slate-300 mb-2 font-semibold">Срок действия скина у игрока:</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setSendSkinDurationType('permanent')}
                    className={`py-2 px-3 rounded-lg font-bold text-center border transition-all ${
                      sendSkinDurationType === 'permanent'
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    ♾️ Навсегда
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendSkinDurationType('temporary')}
                    className={`py-2 px-3 rounded-lg font-bold text-center border transition-all ${
                      sendSkinDurationType === 'temporary'
                        ? 'bg-amber-600/30 border-amber-500 text-amber-300 shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    ⏳ Временно
                  </button>
                </div>

                {sendSkinDurationType === 'temporary' && (
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Количество дней (после истечения скин пропадет из коллекции):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={sendSkinDurationDays}
                        onChange={(e) =>
                          setSendSkinDurationDays(String(Math.max(1, parseInt(e.target.value, 10) || 1)))
                        }
                        className="w-24 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white font-bold outline-none focus:border-amber-400 text-center"
                      />
                      <span className="text-slate-400">дней</span>
                    </div>
                  </div>
                )}

                <label className="mt-3 flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={sendSkinAutoEquip}
                    onChange={(e) => setSendSkinAutoEquip(e.target.checked)}
                    className="rounded border-slate-700 text-amber-500"
                  />
                  <span>Сразу надеть скин на персонажа получателя</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSendSkinModalTarget(null)}
                  className="rounded-lg px-4 py-2 font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleAdminSendSkinToPlayer}
                  disabled={!sendSkinRecipient.trim() || isUpdatingDb}
                  className="rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-2 font-bold text-slate-950 shadow-md hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 transition-all"
                >
                  🎁 Отправить скин
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
