import React, { useState, useRef, useEffect } from 'react';
import { Clan, ClanLogEntry, ClanStorageItem, EquippedGear, GameItem, HeroState, ItemSlot } from '../../types/game';
import {
  CLAN_CREATION_COST_CRYSTALS,
  MAX_CLAN_LEVEL,
  getAllClans,
  getPlayerClan,
  ensureClanExistsFromHero,
  getClanExpForNextLevel,
  getClanMaxStorageCapacity,
  createClan,
  joinClan,
  leaveClan,
  kickClanMember,
  updateClanInfo,
  disbandClan,
  depositItemToClanStorage,
  depositElixirToClanStorage,
  depositGoldToClanTreasury,
  depositCrystalsToClanTreasury,
  forgeClanItemToStorage,
  takeElixirFromClanStorage,
  rentItemFromClanStorage,
  returnItemToClanStorage,
  recallItemByOriginalOwner,
  transferClanLeadership,
  getClanAchievementsStatus,
  getClanPyramidState,
  getClanPyramidBuffs,
  syncClansFromSupabase,
  issueClanMemberBadge,
  updateClanAgenda,
  CLAN_BADGE_COST_GOLD
} from '../../utils/clanStorage';
import {
  STANDARD_CLAN_ICONS,
  CLAN_EMBLEM_COLOR_PRESETS,
  ClanEmblemGeneratorConfig,
  generateClanEmblemDataUrl,
  processUploadedClanEmblem,
  processUploadedItemImage
} from '../../utils/imageUpload';
import { getQualityConfig, SLOT_INFO, formatLastSeen } from '../../utils/gameData';
import { ELIXIR_EN_IMG, ELIXIR_HP_IMG, ELIXIR_EXP_IMG } from '../../utils/elixirAssets';
import { ItemIcon } from '../ItemIcon';
import CharacterAvatar from '../CharacterAvatar';
import {
  ClanTerritoryWarsView,
  ClanRaidBossView,
  ClanQuestsView,
  ClanChampionsArenaView
} from './ClanMechanicsSubViews';
import { ClanSyndicateGwarsView } from './ClanSyndicateGwarsView';
import { ClanRankEpaulette } from '../ClanRankEpaulette';

const CLAN_FORGE_SLOT_ICONS: Record<ItemSlot, string[]> = {
  weapon: [
    SLOT_INFO.weapon.icon,
    '/assets/swords/new_sword_lvl2.png',
    '/assets/swords/abyssal_blue_blade.png',
    '⚔️',
    '🗡️',
    '🔱',
    '🪓'
  ],
  armor: [
    SLOT_INFO.armor.icon,
    '/assets/armor/armor_lvl4.png',
    '/assets/armor/armor_lvl10.png',
    '/assets/armor/armor_lvl20.png',
    '🛡️',
    '🦺',
    '🥋'
  ],
  pants: [
    SLOT_INFO.pants.icon,
    '👖',
    '🩳',
    '⛓️',
    '🛡️'
  ],
  boots: [
    SLOT_INFO.boots.icon,
    '/assets/boots/boots_lvl4.png',
    '/assets/boots/boots_lvl10.png',
    '/assets/boots/boots_lvl20.png',
    '🥾',
    '👢',
    '👟'
  ],
  gloves: [
    SLOT_INFO.gloves.icon,
    '/assets/gloves/gloves_lvl4.png',
    '/assets/gloves/gloves_lvl10.png',
    '/assets/gloves/gloves_lvl20.png',
    '🧤',
    '🥊',
    '🦾'
  ],
  ring: [
    SLOT_INFO.ring.icon,
    '💍',
    '📿',
    '🔮',
    '👑',
    '🧿'
  ],
  transport: ['🚁', '🚤', '🛥️', '🛩️', '🚀', '🛸', '🦅', '🐉']
};

const CLAN_RANDOM_ITEM_NAMES: Record<ItemSlot, string[]> = {
  weapon: ['Клинок Вечности Клана', 'Скипетр Владыки Нила', 'Карающий Меч Династии', 'Копьё Гвардии Фараона'],
  armor: ['Доспех Бессмертного Легиона', 'Кираса Золотой Пирамиды', 'Панцирь Стражей Осириса'],
  pants: ['Поножи Несокрушимого Ордена', 'Боевые Набедренники Династии', 'Латные Штаны Владык Песков'],
  boots: ['Сапоги Поступи Богов', 'Ботфорты Золотого Бастиона', 'Сандалии Вечного Похода'],
  gloves: ['Рукавицы Железной Хватки Клана', 'Перчатки Верховного Стража', 'Боевые Наручи Анубиса'],
  ring: ['Печать Верховного Братства', 'Перстень Казны Фараонов', 'Кольцо Вечного Союза'],
  transport: ['Флагманский Крейсер Клана', 'Штурмовой Апач Династии', 'Золотая Ладья Бога Ра', 'Боевой Перехватчик Братства']
};

interface ClanModalProps {
  currentUser: string | null;
  hero: HeroState;
  inventory: GameItem[];
  equipped?: EquippedGear;
  isAdmin?: boolean;
  initialTab?:
    | 'myClan'
    | 'voentorg'
    | 'clanBase'
    | 'diplomacy'
    | 'clanRating'
    | 'treasury'
    | 'storage'
    | 'ammunition'
    | 'territories'
    | 'raid'
    | 'quests'
    | 'arena'
    | 'achievements'
    | 'members'
    | 'logs'
    | 'clansList'
    | 'create';
  initialSectorId?: string | null;
  embedded?: boolean;
  onClose: () => void;
  onUpdateHero: (updated: Partial<HeroState>) => void;
  onUpdateInventory: (updated: GameItem[]) => void;
  onUpdateEquipped?: (updated: EquippedGear) => void;
  showToast: (text: string) => void;
  onOpenClanPyramid: () => void;
  onInspectPlayer?: (nick: string) => void;
}

export const ClanModal: React.FC<ClanModalProps> = ({
  currentUser,
  hero,
  inventory,
  equipped,
  isAdmin = false,
  initialTab,
  initialSectorId,
  embedded = false,
  onClose,
  onUpdateHero,
  onUpdateInventory,
  onUpdateEquipped,
  showToast,
  onOpenClanPyramid,
  onInspectPlayer
}) => {
  const [, setRefreshTick] = useState(0);
  const triggerRefresh = () => setRefreshTick((t) => t + 1);

  const myNick = currentUser || hero.nick || 'Игрок';
  const playerClan =
    getPlayerClan(myNick, hero.clanId) ||
    (hero.clanId ? ensureClanExistsFromHero(hero, myNick) : undefined);

  const [activeTab, setActiveTab] = useState<
    | 'myClan'
    | 'voentorg'
    | 'clanBase'
    | 'diplomacy'
    | 'clanRating'
    | 'treasury'
    | 'storage'
    | 'ammunition'
    | 'territories'
    | 'raid'
    | 'quests'
    | 'arena'
    | 'achievements'
    | 'members'
    | 'logs'
    | 'clansList'
    | 'create'
  >(() => {
    if (initialTab) return initialTab;
    return playerClan ? 'myClan' : 'clansList';
  });

  const [agendaDraft, setAgendaDraft] = useState<string>(
    playerClan?.agendaText ||
      'Приказ Главы: Бойцам держать строй! Защищать секторные заводы 7x7 и сдавать ресурсы в Порту.'
  );
  const [isEditingAgenda, setIsEditingAgenda] = useState<boolean>(false);

  const [treasuryHistoryFilter, setTreasuryHistoryFilter] = useState<'all' | 'deposits' | 'expenses'>('all');

  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const requestConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; danger?: boolean }
  ) => {
    setPendingConfirm({
      title,
      message,
      confirmText: options?.confirmText || '✅ Подтвердить',
      danger: options?.danger ?? false,
      onConfirm
    });
  };

  const [logFilter, setLogFilter] = useState<'all' | 'members' | 'deposits' | 'withdrawals'>('all');
  const [isSyncingLogs, setIsSyncingLogs] = useState(false);

  useEffect(() => {
    if (playerClan && activeTab === 'create') {
      setActiveTab('myClan');
    }
  }, [playerClan, activeTab]);

  // Sync clans & logs from Supabase on modal open and when switching to Logs tab
  useEffect(() => {
    let mounted = true;
    setIsSyncingLogs(true);
    syncClansFromSupabase()
      .then(() => {
        if (mounted) {
          setIsSyncingLogs(false);
          triggerRefresh();
        }
      })
      .catch(() => {
        if (mounted) setIsSyncingLogs(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab]);

  // Creation & Emblem Studio state
  const [createName, setCreateName] = useState('');
  const [createTag, setCreateTag] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [selectedEmblem, setSelectedEmblem] = useState<string>('🛡️');
  const [customEmblemPreview, setCustomEmblemPreview] = useState<string | null>(null);
  const [isProcessingEmblem, setIsProcessingEmblem] = useState(false);
  const [emblemError, setEmblemError] = useState<string | null>(null);
  const [emblemRemoveBg, setEmblemRemoveBg] = useState<boolean>(true);
  const [emblemStudioTab, setEmblemStudioTab] = useState<'generator' | 'upload' | 'presets'>('generator');
  const [emblemGenConfig, setEmblemGenConfig] = useState<ClanEmblemGeneratorConfig>({
    shape: 'shield',
    pattern: 'radial',
    primaryColor: '#78350f',
    secondaryColor: '#d97706',
    borderColor: '#fde047',
    symbol: '🦅',
    customText: '',
    crest: '👑',
    borderStyle: 'double'
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Storage, Gold, Crystals & Elixir Deposit modal state
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositMode, setDepositMode] = useState<'item' | 'elixir' | 'gold' | 'crystals'>('item');
  const [selectedElixirType, setSelectedElixirType] = useState<'hp' | 'en' | 'exp'>('hp');
  const [elixirDepositQty, setElixirDepositQty] = useState<number>(1);
  const [goldDepositAmount, setGoldDepositAmount] = useState<number>(5000);
  const [crystalDepositAmount, setCrystalDepositAmount] = useState<number>(500);
  const [searchFilter, setSearchFilter] = useState('');

  // Clan Item & Transport Forge state (Крафт главой клана за счёт казны)
  const [clanForgeType, setClanForgeType] = useState<'equipment' | 'transport'>('equipment');
  const [clanForgeSlot, setClanForgeSlot] = useState<ItemSlot>('weapon');
  const [clanForgeName, setClanForgeName] = useState<string>('');
  const [clanForgeIcon, setClanForgeIcon] = useState<string>('/assets/swords/new_sword_lvl2.png');
  const [clanForgeCustomUrl, setClanForgeCustomUrl] = useState<string>('');
  const [isUploadingForgeImg, setIsUploadingForgeImg] = useState<boolean>(false);
  const clanForgeFileRef = useRef<HTMLInputElement>(null);
  // Base stats: 10 each (+700 crystals per +1 stat above 10)
  const [cfDmg, setCfDmg] = useState<number>(10);
  const [cfHp, setCfHp] = useState<number>(10);
  const [cfStr, setCfStr] = useState<number>(10);
  const [cfAgi, setCfAgi] = useState<number>(10);
  const [cfVit, setCfVit] = useState<number>(10);
  const [cfEnergy, setCfEnergy] = useState<number>(10);
  // Percentage bonuses: 0% base (+10,000 gold per +1% bonus)
  const [cfDodgePct, setCfDodgePct] = useState<number>(0);
  const [cfGoldPct, setCfGoldPct] = useState<number>(0);
  const [cfExpPct, setCfExpPct] = useState<number>(0);

  // Edit clan settings & leader emblem studio state
  const [isEditingClan, setIsEditingClan] = useState(false);
  const [isEditingEmblem, setIsEditingEmblem] = useState(false);
  const [editDesc, setEditDesc] = useState(playerClan?.description || '');
  const [editIsOpen, setEditIsOpen] = useState(playerClan?.isOpen ?? true);
  const [editMinLvl, setEditMinLvl] = useState(playerClan?.joinMinLvl || 1);
  const [editGoldPct, setEditGoldPct] = useState(playerClan?.pyramidTaxGoldPct ?? 15);
  const [editCrystalPct, setEditCrystalPct] = useState(playerClan?.pyramidTaxCrystalPct ?? 15);

  const allClans = getAllClans();
  const pyramidState = getClanPyramidState();
  const isLeader = playerClan
    ? playerClan.leaderNick.trim().toLowerCase() === myNick.trim().toLowerCase()
    : false;
  const clanBuffs = getClanPyramidBuffs(playerClan?.id);
  const clanAchStatus = getClanAchievementsStatus(playerClan);
  const maxStorageCap = getClanMaxStorageCapacity(playerClan);
  const nextClanExp = playerClan ? getClanExpForNextLevel(playerClan.level) : 2000;
  const currentClanExp = Number(playerClan?.exp || 0);
  const clanExpPct =
    playerClan && playerClan.level >= MAX_CLAN_LEVEL
      ? 100
      : nextClanExp > 0
      ? Math.min(100, Math.round((currentClanExp / nextClanExp) * 100))
      : 0;

  // Dynamic price calculation for Clan Item / Transport Creation:
  // Base cost: 2,000 crystals and 50,000 gold
  // Base stats: 10 each -> +700 crystals per +1 extra stat
  // % bonuses: 0% base -> +10,000 gold per +1% bonus
  const extraDmg = Math.max(0, Math.floor(Number(cfDmg ?? 10)) - 10);
  const extraHp = Math.max(0, Math.floor(Number(cfHp ?? 10)) - 10);
  const extraStr = Math.max(0, Math.floor(Number(cfStr ?? 10)) - 10);
  const extraAgi = Math.max(0, Math.floor(Number(cfAgi ?? 10)) - 10);
  const extraVit = Math.max(0, Math.floor(Number(cfVit ?? 10)) - 10);
  const extraEnergy = Math.max(0, Math.floor(Number(cfEnergy ?? 10)) - 10);
  const totalExtraStats = extraDmg + extraHp + extraStr + extraAgi + extraVit + extraEnergy;

  const safeDodgePct = Math.max(0, Math.floor(Number(cfDodgePct || 0)));
  const safeGoldPct = Math.max(0, Math.floor(Number(cfGoldPct || 0)));
  const safeExpPct = Math.max(0, Math.floor(Number(cfExpPct || 0)));
  const totalExtraBonusPct = safeDodgePct + safeGoldPct + safeExpPct;

  const CLAN_FORGE_BASE_CRYSTALS = 2000;
  const CLAN_FORGE_BASE_GOLD = 50000;
  const CLAN_FORGE_CRYSTALS_PER_STAT = 700;
  const CLAN_FORGE_GOLD_PER_PCT = 10000;

  const extraForgeCrystals = totalExtraStats * CLAN_FORGE_CRYSTALS_PER_STAT;
  const extraForgeGold = totalExtraBonusPct * CLAN_FORGE_GOLD_PER_PCT;
  const totalClanForgeCrystals = CLAN_FORGE_BASE_CRYSTALS + extraForgeCrystals;
  const totalClanForgeGold = CLAN_FORGE_BASE_GOLD + extraForgeGold;

  const applyGeneratorConfig = (nextCfg: ClanEmblemGeneratorConfig) => {
    setEmblemGenConfig(nextCfg);
    const dataUrl = generateClanEmblemDataUrl(nextCfg);
    setSelectedEmblem(dataUrl);
    setCustomEmblemPreview(null);
    setEmblemError(null);
  };

  const handleRandomizeEmblem = () => {
    const shapes: ClanEmblemGeneratorConfig['shape'][] = ['shield', 'circle', 'diamond', 'hexagon', 'banner', 'octagon'];
    const patterns: ClanEmblemGeneratorConfig['pattern'][] = ['radial', 'split_v', 'split_h', 'split_diag', 'quarters', 'rays', 'chevron'];
    const crests = ['none', '👑', '⚜️', '⭐', '🌙', '☀️', '💀'];
    const borderStyles: ClanEmblemGeneratorConfig['borderStyle'][] = ['double', 'rivets', 'glow'];
    const preset = CLAN_EMBLEM_COLOR_PRESETS[Math.floor(Math.random() * CLAN_EMBLEM_COLOR_PRESETS.length)];
    const randIcon = STANDARD_CLAN_ICONS[Math.floor(Math.random() * STANDARD_CLAN_ICONS.length)];
    const nextCfg: ClanEmblemGeneratorConfig = {
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      pattern: patterns[Math.floor(Math.random() * patterns.length)],
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      borderColor: preset.borderColor,
      symbol: randIcon,
      customText: '',
      crest: crests[Math.floor(Math.random() * crests.length)],
      borderStyle: borderStyles[Math.floor(Math.random() * borderStyles.length)]
    };
    applyGeneratorConfig(nextCfg);
  };

  // Handle custom emblem upload (PNG/JPEG/WEBP/GIF)
  const handleEmblemFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEmblemError(null);
    setIsProcessingEmblem(true);
    try {
      const res = await processUploadedClanEmblem(file, { removeBg: emblemRemoveBg });
      if (!res.ok || !res.dataUrl) {
        setEmblemError(res.error || 'Ошибка загрузки эмблемы.');
        setCustomEmblemPreview(null);
      } else {
        setCustomEmblemPreview(res.dataUrl);
        setSelectedEmblem(res.dataUrl);
        showToast(`✅ Эмблема подготовлена (${res.finalSizeKb} КБ)`);
      }
    } catch {
      setEmblemError('Не удалось обработать изображение.');
    } finally {
      setIsProcessingEmblem(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle creating a new clan (costs 1000 crystals)
  const handleCreateClan = () => {
    if (playerClan) {
      showToast('Вы уже состоите в клане!');
      setActiveTab('myClan');
      return;
    }
    if (hero.crystals < CLAN_CREATION_COST_CRYSTALS) {
      showToast(`❌ Недостаточно кристаллов! Требуется ${CLAN_CREATION_COST_CRYSTALS} 💎 (у вас ${hero.crystals} 💎).`);
      return;
    }
    if (!createName.trim() || createName.trim().length < 3) {
      showToast('❌ Введите название клана (от 3 до 24 символов).');
      return;
    }
    if (!createTag.trim() || createTag.trim().length < 2) {
      showToast('❌ Введите тег клана (от 2 до 6 символов).');
      return;
    }

    requestConfirm(
      '🛡️ Создание нового клана',
      `Вы уверены, что хотите основать клан «${createName.trim()}» [${createTag.trim().toUpperCase()}] за ${CLAN_CREATION_COST_CRYSTALS} 💎 кристаллов?`,
      () => {
        const res = createClan(
          myNick,
          hero.level,
          hero.avatar,
          createName,
          createTag,
          selectedEmblem,
          createDesc
        );

        if (!res.ok || !res.clan) {
          showToast(`❌ ${res.error || 'Не удалось создать клан.'}`);
          return;
        }

        onUpdateHero({
          crystals: hero.crystals - CLAN_CREATION_COST_CRYSTALS,
          clanId: res.clan.id,
          clanTag: res.clan.tag,
          clanName: res.clan.name,
          clanEmblem: res.clan.emblem,
          clanRole: 'leader'
        });

        showToast(`🎉 Клан «${res.clan.name}» [${res.clan.tag}] успешно создан!`);
        triggerRefresh();
        setActiveTab('myClan');
      },
      { confirmText: `🛡️ Создать за ${CLAN_CREATION_COST_CRYSTALS} 💎` }
    );
  };

  // Join existing clan
  const handleJoinClan = (clan: Clan) => {
    requestConfirm(
      '🛡️ Вступление в клан',
      `Вы уверены, что хотите вступить в клан «${clan.name}» [${clan.tag}] (Глава: ${clan.leaderNick})?`,
      () => {
        const res = joinClan(clan.id, myNick, hero.level, hero.avatar);
        if (!res.ok || !res.clan) {
          showToast(`❌ ${res.error || 'Не удалось вступить в клан.'}`);
          return;
        }

        onUpdateHero({
          clanId: res.clan.id,
          clanTag: res.clan.tag,
          clanName: res.clan.name,
          clanEmblem: res.clan.emblem,
          clanRole: 'warrior'
        });

        showToast(`🛡️ Вы вступили в клан «${res.clan.name}» [${res.clan.tag}]!`);
        triggerRefresh();
        setActiveTab('myClan');
      },
      { confirmText: '🛡️ Вступить в клан' }
    );
  };

  // Helper to strip clan-rented / clan-created items from equipped gear when leaving a clan
  const stripClanItemsFromEquipped = () => {
    if (!equipped || !onUpdateEquipped) return;
    let changed = false;
    const nextEq: EquippedGear = { ...equipped };
    (Object.keys(nextEq) as (keyof EquippedGear)[]).forEach((slotKey) => {
      const eqItem = nextEq[slotKey];
      if (eqItem && (eqItem.isClanRented || eqItem.isClanCreated)) {
        nextEq[slotKey] = null;
        changed = true;
      }
    });
    if (changed) {
      onUpdateEquipped(nextEq);
    }
  };

  // Leave clan anytime (for any member or leader)
  const handleLeaveClan = () => {
    if (!playerClan) return;

    requestConfirm(
      '🚪 Выход из клана',
      `Вы уверены, что хотите выйти из клана «${playerClan.name}» [${playerClan.tag}]? Все взятые со склада клана вещи автоматически вернутся на базу клана.`,
      () => {
        const cleanedInventory = inventory.filter((i) => !i.isClanRented && !i.isClanCreated);
        const res = leaveClan(playerClan.id, myNick);
        if (!res.ok) {
          showToast(`❌ ${res.error || 'Ошибка выхода из клана.'}`);
          return;
        }

        stripClanItemsFromEquipped();
        if (cleanedInventory.length !== inventory.length) {
          onUpdateInventory(cleanedInventory);
        }

        onUpdateHero({
          clanId: undefined,
          clanTag: undefined,
          clanName: undefined,
          clanEmblem: undefined,
          clanRole: undefined
        });

        if (res.disbanded) {
          showToast('🚪 Вы вышли из клана. Так как в клане больше никого не осталось, он был распущен.');
        } else if (res.newLeaderNick) {
          showToast(`🚪 Вы покинули клан. Клановые вещи остались на складе. Лидерство передано игроку ${res.newLeaderNick}.`);
        } else {
          showToast('🚪 Вы вышли из клана. Все клановые вещи остались на складе клана.');
        }
        triggerRefresh();
        setActiveTab('clansList');
      },
      { confirmText: '🚪 Да, выйти из клана', danger: true }
    );
  };

  // Disband clan (leader or admin)
  const handleDisbandClan = () => {
    if (!playerClan) return;

    requestConfirm(
      '💥 Роспуск клана',
      `ВНИМАНИЕ! Вы действительно хотите полностью распустить клан «${playerClan.name}» [${playerClan.tag}]? Это действие необратимо! Личные вещи со склада вернутся владельцам.`,
      () => {
        const myNonRentedInv = inventory.filter((i) => !i.isClanRented && !i.isClanCreated);
        const res = disbandClan(playerClan.id, myNick, isAdmin);
        if (!res.ok) {
          showToast(`❌ ${res.error}`);
          return;
        }

        stripClanItemsFromEquipped();
        const myReturned = res.returnedItems
          .filter((r) => r.ownerNick.toLowerCase() === myNick.toLowerCase())
          .map((r) => r.item);

        onUpdateInventory([...myNonRentedInv, ...myReturned]);
        onUpdateHero({
          clanId: undefined,
          clanTag: undefined,
          clanName: undefined,
          clanEmblem: undefined,
          clanRole: undefined
        });

        showToast(`💥 Клан «${playerClan.name}» распущен. Все личные вещи с базы возвращены владельцам.`);
        triggerRefresh();
        setActiveTab('clansList');
      },
      { confirmText: '💥 Да, распустить клан', danger: true }
    );
  };

  // Transfer clan leadership to another clan member
  const handleTransferLeadership = (targetNick: string) => {
    if (!playerClan) return;
    requestConfirm(
      '👑 Передача управления кланом',
      `Вы уверены, что хотите передать клан «${playerClan.name}» [${playerClan.tag}] и права Главы соклановцу ${targetNick}? После передачи вы станете офицером клана.`,
      () => {
        const res = transferClanLeadership(playerClan.id, myNick, targetNick, isAdmin);
        if (!res.ok) {
          showToast(`❌ ${res.error || 'Не удалось передать клан.'}`);
          return;
        }
        if (myNick.trim().toLowerCase() !== targetNick.trim().toLowerCase()) {
          onUpdateHero({ clanRole: 'officer' });
        }
        showToast(`👑 Вы передали права Главы клана «${playerClan.name}» игроку ${targetNick}!`);
        triggerRefresh();
      },
      { confirmText: `👑 Передать клан игроку ${targetNick}`, danger: true }
    );
  };

  // Выдать официальный «Знак клана» (1 000 золота) участнику клана для допуска к боям 7х7 в Порту
  const handleIssueClanBadge = (targetNick: string) => {
    if (!playerClan) return;
    const canPayFromTreasury = (playerClan.treasuryGold || 0) >= CLAN_BADGE_COST_GOLD;
    const paySource: 'treasury' | 'personal' = canPayFromTreasury ? 'treasury' : 'personal';

    requestConfirm(
      `🛡️ Выдать Знак клана бойцу ${targetNick}`,
      `Выдать официальный «Знак клана» [${playerClan.tag}] участнику ${targetNick} за ${CLAN_BADGE_COST_GOLD.toLocaleString()} 🪙 (${
        paySource === 'treasury'
          ? `списание из казны клана: ${(playerClan.treasuryGold || 0).toLocaleString()} 🪙`
          : `списание с вашего баланса: ${(hero.gold || 0).toLocaleString()} 🪙`
      })? С этим знаком игрок получает право нападать на объекты Порта и защищать их в тактических боях 7х7!`,
      () => {
        const res = issueClanMemberBadge(
          playerClan.id,
          myNick,
          targetNick,
          paySource,
          hero.gold || 0
        );
        if (!res.ok) {
          showToast(`❌ ${res.error}`);
          return;
        }
        if (res.paidFrom === 'personal' && res.costGold) {
          onUpdateHero({
            gold: Math.max(0, (hero.gold || 0) - res.costGold)
          });
        }
        if (targetNick.trim().toLowerCase() === myNick.trim().toLowerCase()) {
          onUpdateHero({ hasClanBadge: true });
        }
        showToast(res.message || `🛡️ Знак клана выдан бойцу ${targetNick}!`);
        triggerRefresh();
      },
      { confirmText: `🛡️ Выдать Знак клана (${CLAN_BADGE_COST_GOLD.toLocaleString()} 🪙)` }
    );
  };

  // Deposit item from inventory to Clan Storage
  const handleDepositItem = (item: GameItem) => {
    if (!playerClan) return;
    if (item.isClanRented || item.isClanCreated || item.rent) {
      showToast('❌ Этот предмет уже принадлежит складу клана или находится в аренде!');
      return;
    }

    requestConfirm(
      '📦 Положить предмет на склад клана',
      `Положить предмет «${item.name}» (Ур. ${item.lvl}) на базу клана «${playerClan.name}»? Соклановцы смогут брать его во временное пользование.`,
      () => {
        const res = depositItemToClanStorage(playerClan.id, myNick, item);
        if (!res.ok) {
          showToast(`❌ ${res.error}`);
          return;
        }

        const nextInv = inventory.filter((i) => i.id !== item.id);
        onUpdateInventory(nextInv);
        showToast(`📦 Предмет «${item.name}» помещен на базу клана!`);
        triggerRefresh();
        setIsDepositModalOpen(false);
      },
      { confirmText: '📦 Положить на базу' }
    );
  };

  // Deposit Elixir to Clan Storage
  const handleDepositElixir = () => {
    if (!playerClan) return;
    const qty = Math.max(1, Math.floor(Number(elixirDepositQty) || 1));

    const available =
      selectedElixirType === 'hp'
        ? Number(hero.hpPotions || 0)
        : selectedElixirType === 'en'
        ? Number(hero.enPotions || 0)
        : Number(hero.expPotions || 0);

    if (available < qty) {
      showToast(`❌ У вас недостаточно эликсиров (доступно: ${available} шт.).`);
      return;
    }

    const elixirLabel =
      selectedElixirType === 'hp'
        ? 'Эликсир Жизни'
        : selectedElixirType === 'en'
        ? 'Эликсир Энергии'
        : 'Эликсир Опыта';

    requestConfirm(
      '🧪 Пополнение базы эликсирами',
      `Вы уверены, что хотите положить ${elixirLabel} (${qty} шт.) на базу клана «${playerClan.name}»?`,
      () => {
        const res = depositElixirToClanStorage(playerClan.id, myNick, selectedElixirType, qty);
        if (!res.ok) {
          showToast(`❌ ${res.error}`);
          return;
        }

        if (selectedElixirType === 'hp') {
          onUpdateHero({ hpPotions: Math.max(0, available - qty) });
        } else if (selectedElixirType === 'en') {
          onUpdateHero({ enPotions: Math.max(0, available - qty) });
        } else {
          onUpdateHero({ expPotions: Math.max(0, available - qty) });
        }

        showToast(`🧪 На базу клана положено: ${res.storageItem?.item.name}!`);
        triggerRefresh();
        setIsDepositModalOpen(false);
      },
      { confirmText: `🧪 Положить ${qty} шт.` }
    );
  };

  // Deposit Gold to Clan Base Treasury
  const handleDepositGold = (overrideAmount?: number) => {
    if (!playerClan) return;
    const rawVal = typeof overrideAmount === 'number' ? overrideAmount : goldDepositAmount;
    const amount = Math.max(1, Math.floor(Number(rawVal) || 0));
    if (hero.gold < amount) {
      showToast(`❌ Недостаточно золота! У вас: ${hero.gold.toLocaleString('ru-RU')} 🪙.`);
      return;
    }

    requestConfirm(
      '🪙 Вклад золота в казну клана',
      `Вы уверены, что хотите внести ${amount.toLocaleString('ru-RU')} 🪙 золота в казну клана «${playerClan.name}»?`,
      () => {
        const res = depositGoldToClanTreasury(playerClan.id, myNick, amount);
        if (!res.ok) {
          showToast(`❌ ${res.error}`);
          return;
        }

        onUpdateHero({ gold: Math.max(0, hero.gold - amount) });
        showToast(
          `🪙 Вклад принят! +${amount.toLocaleString('ru-RU')} 🪙 в казну клана (+${res.expGained || 0} ✨ EXP / +${res.influenceGained || 0} ⭐ Влияния)!`
        );
        triggerRefresh();
        setIsDepositModalOpen(false);
      },
      { confirmText: `🪙 Внести ${amount.toLocaleString('ru-RU')} 🪙` }
    );
  };

  // Deposit Crystals to Clan Base Treasury
  const handleDepositCrystals = (overrideAmount?: number) => {
    if (!playerClan) return;
    const rawVal = typeof overrideAmount === 'number' ? overrideAmount : crystalDepositAmount;
    const amount = Math.max(1, Math.floor(Number(rawVal) || 0));
    if (hero.crystals < amount) {
      showToast(`❌ Недостаточно кристаллов! У вас: ${hero.crystals.toLocaleString('ru-RU')} 💎.`);
      return;
    }

    requestConfirm(
      '💎 Вклад кристаллов в казну клана',
      `Вы уверены, что хотите внести ${amount.toLocaleString('ru-RU')} 💎 кристаллов в казну клана «${playerClan.name}»?`,
      () => {
        const res = depositCrystalsToClanTreasury(playerClan.id, myNick, amount);
        if (!res.ok) {
          showToast(`❌ ${res.error}`);
          return;
        }

        onUpdateHero({ crystals: Math.max(0, hero.crystals - amount) });
        showToast(
          `💎 Вклад принят! +${amount.toLocaleString('ru-RU')} 💎 в казну клана (+${res.expGained || 0} ✨ EXP / +${res.influenceGained || 0} ⭐ Влияния)!`
        );
        triggerRefresh();
        setIsDepositModalOpen(false);
      },
      { confirmText: `💎 Внести ${amount.toLocaleString('ru-RU')} 💎` }
    );
  };

  // Take Elixir from Clan Storage
  const handleTakeElixir = (st: ClanStorageItem) => {
    if (!playerClan) return;
    requestConfirm(
      '🧪 Взять эликсиры с базы',
      `Взять «${st.item.name}» со склада клана в свой инвентарь?`,
      () => {
        const res = takeElixirFromClanStorage(playerClan.id, myNick, st.id);
        if (!res.ok || !res.elixirType || !res.qty) {
          showToast(`❌ ${res.error || 'Не удалось взять эликсир.'}`);
          return;
        }

        if (res.elixirType === 'hp') {
          onUpdateHero({ hpPotions: Number(hero.hpPotions || 0) + res.qty });
        } else if (res.elixirType === 'en') {
          onUpdateHero({ enPotions: Number(hero.enPotions || 0) + res.qty });
        } else {
          onUpdateHero({ expPotions: Number(hero.expPotions || 0) + res.qty });
        }

        showToast(`🧪 Вы взяли с базы клана: ${st.item.name}!`);
        triggerRefresh();
      },
      { confirmText: '🧪 Взять эликсиры' }
    );
  };

  // Rent item from Clan Storage
  const handleRentItem = (st: ClanStorageItem) => {
    if (!playerClan) return;
    requestConfirm(
      '📥 Взять предмет со склада клана',
      `Вы хотите взять предмет «${st.item.name}» со склада клана «${playerClan.name}» в свою сумку?`,
      () => {
        const res = rentItemFromClanStorage(playerClan.id, myNick, st.id);
        if (!res.ok || !res.rentedItem) {
          showToast(`❌ ${res.error}`);
          return;
        }

        onUpdateInventory([...inventory, res.rentedItem]);
        showToast(
          st.item.isClanCreated
            ? `🏰 Вы взяли клановую вещь «${st.item.name}» со склада клана! Наденьте её в сумке.`
            : `🤝 Вы взяли «${st.item.name}» в аренду с базы клана!`
        );
        triggerRefresh();
      },
      { confirmText: '📥 Взять предмет' }
    );
  };

  // Return rented item back to Clan Storage
  const handleReturnRentedItem = (st: ClanStorageItem) => {
    if (!playerClan) return;
    requestConfirm(
      '📤 Возврат предмета на склад клана',
      `Вернуть предмет «${st.item.name}» обратно на склад клана «${playerClan.name}»?`,
      () => {
        const res = returnItemToClanStorage(playerClan.id, myNick, st.id);
        if (!res.ok) {
          showToast(`❌ ${res.error}`);
          return;
        }

        if (equipped && onUpdateEquipped) {
          let eqChanged = false;
          const nextEq: EquippedGear = { ...equipped };
          (Object.keys(nextEq) as (keyof EquippedGear)[]).forEach((slotKey) => {
            if (nextEq[slotKey]?.clanStorageId === st.id) {
              nextEq[slotKey] = null;
              eqChanged = true;
            }
          });
          if (eqChanged) {
            onUpdateEquipped(nextEq);
          }
        }

        const nextInv = inventory.filter((i) => i.clanStorageId !== st.id);
        onUpdateInventory(nextInv);
        showToast(`📦 Предмет «${st.item.name}» возвращен на склад клана.`);
        triggerRefresh();
      },
      { confirmText: '📤 Вернуть на склад' }
    );
  };

  // Clan Leader Forges a Clan Item or Clan Transport (paid strictly from Clan Treasury -> goes to Clan Storage)
  const handleForgeClanItem = () => {
    if (!playerClan) return;
    if (!isLeader) {
      showToast('⛔ Создать клановую вещь или транспорт может исключительно глава клана!');
      return;
    }

    const effectiveSlot: ItemSlot = clanForgeType === 'transport' ? 'transport' : clanForgeSlot;
    const cleanName = clanForgeName.trim();
    if (!cleanName) {
      showToast('❌ Введите название создаваемой клановой вещи или транспорта!');
      return;
    }

    const treasuryCrystals = Math.max(0, Math.floor(Number(playerClan.treasuryCrystals) || 0));
    const treasuryGold = Math.max(0, Math.floor(Number(playerClan.treasuryGold) || 0));

    if (treasuryCrystals < totalClanForgeCrystals) {
      showToast(
        `❌ Недостаточно кристаллов в казне клана! Нужно: ${totalClanForgeCrystals.toLocaleString('ru-RU')} 💎 (в казне: ${treasuryCrystals.toLocaleString('ru-RU')} 💎). Пополните казну!`
      );
      return;
    }
    if (treasuryGold < totalClanForgeGold) {
      showToast(
        `❌ Недостаточно золота в казне клана! Нужно: ${totalClanForgeGold.toLocaleString('ru-RU')} 🪙 (в казне: ${treasuryGold.toLocaleString('ru-RU')} 🪙). Пополните казну!`
      );
      return;
    }

    requestConfirm(
      '⚒️ Подтверждение кланового крафта',
      `Вы уверены, что хотите создать клановый предмет «${cleanName}» (Прочность 1000/1000) за ${totalClanForgeCrystals.toLocaleString('ru-RU')} 💎 кристаллов и ${totalClanForgeGold.toLocaleString('ru-RU')} 🪙 золота из казны клана «${playerClan.name}»? Предмет сразу поступит на склад клана.`,
      () => {
        const finalDmg = 10 + extraDmg;
        const finalHp = 10 + extraHp;
        const finalStr = 10 + extraStr;
        const finalAgi = 10 + extraAgi;
        const finalVit = 10 + extraVit;
        const finalEnergy = 10 + extraEnergy;

        const itemToForge: GameItem = {
          id: `clan_custom_${effectiveSlot}_${Date.now()}`,
          name: cleanName,
          slot: effectiveSlot,
          icon: clanForgeIcon || (effectiveSlot === 'transport' ? '🚁' : '⚔️'),
          quality: 'custom',
          lvl: 1,
          dmg: finalDmg,
          hp: finalHp,
          str: finalStr,
          agi: finalAgi,
          vit: finalVit,
          energyBonus: finalEnergy,
          dodgeBonus: safeDodgePct,
          goldBonusPct: safeGoldPct,
          expBonusPct: safeExpPct,
          durability: 1000,
          maxDurability: 1000,
          initialMaxDurability: 1000,
          price: totalClanForgeGold,
          forgeCrystalCost: totalClanForgeCrystals,
          forgeGoldCost: totalClanForgeGold,
          forgeCurrency: 'crystals',
          transferable: false,
          isCustomCreated: true,
          isClanCreated: true,
          clanOwnerId: playerClan.id,
          clanOwnerName: playerClan.name,
          clanOwnerTag: playerClan.tag,
          creatorNick: myNick,
          originalOwnerNick: playerClan.name,
          isTransport: effectiveSlot === 'transport',
          isNamedTransport: effectiveSlot === 'transport',
          travelTimeSec: effectiveSlot === 'transport' ? 60 : undefined,
          timeReductionPct: effectiveSlot === 'transport' ? 50 : undefined,
          origin: `Создано кланом ${playerClan.name} и принадлежит клану`
        };

        const res = forgeClanItemToStorage(
          playerClan.id,
          myNick,
          itemToForge,
          totalClanForgeCrystals,
          totalClanForgeGold
        );

        if (!res.ok) {
          showToast(`❌ ${res.error}`);
          return;
        }

        setClanForgeName('');
        showToast(
          `⚒️ Клановая вещь «${cleanName}» создана за счёт казны и отправлена на склад клана «${playerClan.name}»!`
        );
        triggerRefresh();
      },
      { confirmText: `⚒️ Выковать за ${totalClanForgeCrystals.toLocaleString('ru-RU')} 💎 + ${totalClanForgeGold.toLocaleString('ru-RU')} 🪙` }
    );
  };

  const handleClanForgeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingForgeImg(true);
    const res = await processUploadedItemImage(file, 'cover');
    setIsUploadingForgeImg(false);
    e.target.value = '';
    if ((!res.ok && !res.success) || !res.dataUrl) {
      showToast(res.error || 'Ошибка загрузки картинки');
      return;
    }
    setClanForgeIcon(res.dataUrl);
    showToast('✅ Картинка для кланового предмета установлена!');
  };

  // Original owner recalls their item back into personal inventory
  const handleOwnerRecallItem = (st: ClanStorageItem) => {
    if (!playerClan) return;
    requestConfirm(
      '🔄 Забрать свой предмет со склада',
      `Вы уверены, что хотите забрать свой предмет «${st.item.name}» со склада клана обратно в личную сумку?`,
      () => {
        const res = recallItemByOriginalOwner(playerClan.id, myNick, st.id, isAdmin);
        if (!res.ok) {
          showToast(`❌ ${res.error}`);
          return;
        }

        if (res.elixirType && res.elixirQty) {
          if (res.elixirType === 'hp') {
            onUpdateHero({ hpPotions: Number(hero.hpPotions || 0) + res.elixirQty });
          } else if (res.elixirType === 'en') {
            onUpdateHero({ enPotions: Number(hero.enPotions || 0) + res.elixirQty });
          } else {
            onUpdateHero({ expPotions: Number(hero.expPotions || 0) + res.elixirQty });
          }
          showToast(`🔄 Вы забрали свои эликсиры (${res.elixirQty} шт.) с базы клана!`);
          triggerRefresh();
          return;
        }

        if (!res.recalledItem) return;
        const cleanedInv = inventory.filter((i) => i.clanStorageId !== st.id);
        onUpdateInventory([...cleanedInv, res.recalledItem]);

        if (res.previousBorrowerNick && res.previousBorrowerNick.toLowerCase() !== myNick.toLowerCase()) {
          showToast(
            `🔄 Вы отозвали свой предмет «${st.item.name}» из аренды у игрока ${res.previousBorrowerNick} обратно в сумку!`
          );
        } else {
          showToast(`🔄 Предмет «${st.item.name}» возвращен с базы клана в вашу сумку!`);
        }
        triggerRefresh();
      },
      { confirmText: '🔄 Забрать в сумку' }
    );
  };

  // Save clan settings
  const handleSaveClanSettings = () => {
    if (!playerClan) return;
    requestConfirm(
      '⚙️ Сохранение настроек клана',
      `Сохранить новые настройки приёма, описания и налогов для клана «${playerClan.name}»?`,
      () => {
        const res = updateClanInfo(
          playerClan.id,
          myNick,
          {
            description: editDesc,
            isOpen: editIsOpen,
            joinMinLvl: editMinLvl,
            pyramidTaxGoldPct: editGoldPct,
            pyramidTaxCrystalPct: editCrystalPct
          },
          isAdmin
        );
        if (!res.ok) {
          showToast(`❌ ${res.error}`);
          return;
        }
        setIsEditingClan(false);
        triggerRefresh();
        showToast('✅ Настройки клана обновлены!');
      },
      { confirmText: '💾 Сохранить настройки' }
    );
  };

  // Save updated clan emblem (for clan leader / admin)
  const handleSaveClanEmblem = () => {
    if (!playerClan || !selectedEmblem) return;
    requestConfirm(
      '🎨 Обновление герба клана',
      `Вы уверены, что хотите установить новый герб для клана «${playerClan.name}»?`,
      () => {
        const res = updateClanInfo(
          playerClan.id,
          myNick,
          {
            emblem: selectedEmblem
          },
          isAdmin
        );
        if (!res.ok) {
          showToast(`❌ ${res.error}`);
          return;
        }
        onUpdateHero({ clanEmblem: selectedEmblem });
        setIsEditingEmblem(false);
        triggerRefresh();
        showToast('🎨 Герб клана успешно обновлён!');
      },
      { confirmText: '🎨 Сохранить герб' }
    );
  };

  // Kick member
  const handleKick = (targetNick: string) => {
    if (!playerClan) return;
    requestConfirm(
      '👢 Исключение участника',
      `Вы уверены, что хотите исключить игрока ${targetNick} из клана «${playerClan.name}»?`,
      () => {
        const res = kickClanMember(playerClan.id, myNick, targetNick, isAdmin);
        if (!res.ok) {
          showToast(`❌ ${res.error}`);
          return;
        }
        triggerRefresh();
        showToast(`👢 Игрок ${targetNick} исключен из клана.`);
      },
      { confirmText: `👢 Исключить ${targetNick}`, danger: true }
    );
  };

  const renderClanEmblem = (emblem: string, sizeClass = 'h-10 w-10 text-xl') => {
    const isImg =
      emblem &&
      (emblem.startsWith('data:image/') ||
        emblem.startsWith('http://') ||
        emblem.startsWith('https://') ||
        emblem.startsWith('/'));
    return (
      <div
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-amber-500/70 bg-slate-950 shadow-md ${sizeClass}`}
      >
        {isImg ? (
          <img src={emblem} alt="Герб клана" className="h-full w-full object-contain" />
        ) : (
          <span className="leading-none select-none">{emblem || '🛡️'}</span>
        )}
      </div>
    );
  };

  const renderEmblemStudioContent = (tagHint?: string) => (
    <div className="space-y-2.5 rounded-xl border border-amber-500/40 bg-slate-950/95 p-2.5 shadow-inner">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10.5px] font-black text-amber-300 flex items-center gap-1">
            <span>🎨 Мастерская Герба Клана</span>
          </div>
          <div className="text-[8.5px] text-slate-400">
            Создайте уникальный геральдический щит на Canvas или загрузите свой логотип
          </div>
        </div>
        <div className="flex items-center gap-2">
          {renderClanEmblem(selectedEmblem, 'h-14 w-14 text-3xl')}
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800">
        <button
          type="button"
          onClick={() => {
            setEmblemStudioTab('generator');
            if (!selectedEmblem.startsWith('data:image/')) {
              applyGeneratorConfig(emblemGenConfig);
            }
          }}
          className={`rounded-md py-1 text-[9px] font-extrabold transition-all ${
            emblemStudioTab === 'generator'
              ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🛡️ Генератор
        </button>
        <button
          type="button"
          onClick={() => setEmblemStudioTab('upload')}
          className={`rounded-md py-1 text-[9px] font-extrabold transition-all ${
            emblemStudioTab === 'upload'
              ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📁 Свой файл
        </button>
        <button
          type="button"
          onClick={() => setEmblemStudioTab('presets')}
          className={`rounded-md py-1 text-[9px] font-extrabold transition-all ${
            emblemStudioTab === 'presets'
              ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ✨ Символы
        </button>
      </div>

      {/* TAB A: CANVAS HERALDIC GENERATOR */}
      {emblemStudioTab === 'generator' && (
        <div className="space-y-2 pt-0.5">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[9px] font-bold text-slate-300">1. Форма щита и узор:</span>
            <button
              type="button"
              onClick={handleRandomizeEmblem}
              className="rounded-md border border-purple-400/70 bg-purple-950/70 px-2 py-0.5 text-[8.5px] font-black text-purple-200 hover:bg-purple-900"
            >
              🎲 Случайный герб
            </button>
          </div>

          {/* Shield Shapes */}
          <div className="grid grid-cols-6 gap-1">
            {(
              [
                { id: 'shield', label: 'Щит' },
                { id: 'circle', label: 'Круг' },
                { id: 'diamond', label: 'Ромб' },
                { id: 'hexagon', label: 'Гекс' },
                { id: 'banner', label: 'Знамя' },
                { id: 'octagon', label: 'Окта' }
              ] as const
            ).map((sh) => (
              <button
                key={sh.id}
                type="button"
                onClick={() => applyGeneratorConfig({ ...emblemGenConfig, shape: sh.id })}
                className={`rounded border py-1 text-[8.5px] font-bold ${
                  emblemGenConfig.shape === sh.id
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {sh.label}
              </button>
            ))}
          </div>

          {/* Background Patterns */}
          <div className="grid grid-cols-7 gap-1">
            {(
              [
                { id: 'radial', label: 'Сияние' },
                { id: 'split_v', label: 'Верт.' },
                { id: 'split_h', label: 'Гориз.' },
                { id: 'split_diag', label: 'Диаг.' },
                { id: 'quarters', label: 'Четв.' },
                { id: 'rays', label: 'Лучи' },
                { id: 'chevron', label: 'Шеврон' }
              ] as const
            ).map((pt) => (
              <button
                key={pt.id}
                type="button"
                onClick={() => applyGeneratorConfig({ ...emblemGenConfig, pattern: pt.id })}
                className={`rounded border py-1 text-[8px] font-bold ${
                  emblemGenConfig.pattern === pt.id
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>

          {/* Color Presets + Custom Color Pickers */}
          <div>
            <div className="text-[9px] font-bold text-slate-300 mb-1">2. Цветовая палитра клана:</div>
            <div className="grid grid-cols-4 gap-1 mb-1.5">
              {CLAN_EMBLEM_COLOR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    applyGeneratorConfig({
                      ...emblemGenConfig,
                      primaryColor: p.primaryColor,
                      secondaryColor: p.secondaryColor,
                      borderColor: p.borderColor
                    })
                  }
                  className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-1.5 py-1 text-[8px] font-bold text-slate-200 hover:border-amber-400/60 truncate"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/40"
                    style={{ background: `linear-gradient(135deg, ${p.secondaryColor}, ${p.primaryColor})` }}
                  />
                  <span className="truncate">{p.name.replace(/^[^\s]+\s/, '')}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 p-1.5">
              <label className="flex items-center justify-between gap-1 text-[8.5px] text-slate-300">
                <span>Осн.:</span>
                <input
                  type="color"
                  value={emblemGenConfig.primaryColor}
                  onChange={(e) => applyGeneratorConfig({ ...emblemGenConfig, primaryColor: e.target.value })}
                  className="h-5 w-8 cursor-pointer rounded border border-slate-700 bg-transparent"
                />
              </label>
              <label className="flex items-center justify-between gap-1 text-[8.5px] text-slate-300">
                <span>Узор:</span>
                <input
                  type="color"
                  value={emblemGenConfig.secondaryColor}
                  onChange={(e) => applyGeneratorConfig({ ...emblemGenConfig, secondaryColor: e.target.value })}
                  className="h-5 w-8 cursor-pointer rounded border border-slate-700 bg-transparent"
                />
              </label>
              <label className="flex items-center justify-between gap-1 text-[8.5px] text-slate-300">
                <span>Кант:</span>
                <input
                  type="color"
                  value={emblemGenConfig.borderColor}
                  onChange={(e) => applyGeneratorConfig({ ...emblemGenConfig, borderColor: e.target.value })}
                  className="h-5 w-8 cursor-pointer rounded border border-slate-700 bg-transparent"
                />
              </label>
            </div>
          </div>

          {/* Frame Border Style & Top Crest */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[8.5px] font-bold text-slate-400 mb-1">Окантовка щита:</div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'double', label: 'Двойная' },
                    { id: 'rivets', label: 'Клёпки' },
                    { id: 'glow', label: 'Сияние' }
                  ] as const
                ).map((bs) => (
                  <button
                    key={bs.id}
                    type="button"
                    onClick={() => applyGeneratorConfig({ ...emblemGenConfig, borderStyle: bs.id })}
                    className={`rounded border py-1 text-[8px] font-bold ${
                      emblemGenConfig.borderStyle === bs.id
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {bs.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[8.5px] font-bold text-slate-400 mb-1">Корона сверху:</div>
              <div className="grid grid-cols-5 gap-1">
                {['none', '👑', '⚜️', '⭐', '🌙'].map((cr) => (
                  <button
                    key={cr}
                    type="button"
                    onClick={() => applyGeneratorConfig({ ...emblemGenConfig, crest: cr })}
                    className={`rounded border py-0.5 text-[10px] font-bold ${
                      emblemGenConfig.crest === cr
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {cr === 'none' ? '✕' : cr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Central Symbol or Custom Monogram */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[8.5px] font-bold text-slate-400">3. Центр щита (символ или тег):</span>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  maxLength={5}
                  value={emblemGenConfig.customText || ''}
                  onChange={(e) =>
                    applyGeneratorConfig({
                      ...emblemGenConfig,
                      customText: e.target.value.toUpperCase()
                    })
                  }
                  placeholder={tagHint || 'ТЕГ'}
                  className="w-16 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-center text-[9px] font-black uppercase text-amber-300 outline-none focus:border-amber-400"
                />
                {emblemGenConfig.customText && (
                  <button
                    type="button"
                    onClick={() => applyGeneratorConfig({ ...emblemGenConfig, customText: '' })}
                    className="text-[9px] text-slate-400 hover:text-white px-1"
                    title="Очистить текст и вернуть символ"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-8 gap-1 max-h-24 overflow-y-auto p-1 rounded bg-slate-900 border border-slate-800">
              {STANDARD_CLAN_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() =>
                    applyGeneratorConfig({
                      ...emblemGenConfig,
                      symbol: ic,
                      customText: ''
                    })
                  }
                  className={`flex h-7 w-7 items-center justify-center rounded text-sm transition-transform ${
                    !emblemGenConfig.customText && emblemGenConfig.symbol === ic
                      ? 'border-2 border-amber-400 bg-amber-500/20 scale-105'
                      : 'border border-slate-800 bg-slate-950 hover:border-slate-600'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB B: UPLOAD CUSTOM IMAGE WITH OPTIONAL AUTO BACKGROUND REMOVAL */}
      {emblemStudioTab === 'upload' && (
        <div className="space-y-2 pt-1">
          <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2 space-y-2">
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <div>
                <div className="text-[9.5px] font-bold text-amber-200">
                  ✂️ Авто-удаление фона (прозрачный контур)
                </div>
                <div className="text-[8px] text-slate-400">
                  Автоматически вырезает белый/цветной фон вокруг логотипа и центрирует его в 100×100 PNG
                </div>
              </div>
              <input
                type="checkbox"
                checked={emblemRemoveBg}
                onChange={(e) => setEmblemRemoveBg(e.target.checked)}
                className="h-4 w-4 accent-amber-500"
              />
            </label>

            <div className="flex items-center gap-2 pt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleEmblemFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingEmblem}
                className="flex-1 rounded-lg border border-amber-400/70 bg-gradient-to-r from-amber-700 to-amber-900 px-3 py-2 text-[9.5px] font-black text-amber-100 shadow hover:from-amber-600"
              >
                {isProcessingEmblem ? '⏳ Обработка на Canvas...' : '📁 Выбрать PNG / JPEG / WEBP / GIF'}
              </button>
            </div>

            {customEmblemPreview && (
              <div className="text-[9px] text-emerald-400 font-bold">
                ✅ Пользовательская эмблема загружена и готова к сохранению!
              </div>
            )}
          </div>

          {emblemError && (
            <div className="rounded border border-red-500/50 bg-red-950/50 p-1.5 text-[9px] font-bold text-red-300">
              ⚠️ {emblemError}
            </div>
          )}
        </div>
      )}

      {/* TAB C: STANDARD PRESET SYMBOLS */}
      {emblemStudioTab === 'presets' && (
        <div className="pt-1">
          <div className="text-[8.5px] text-slate-400 mb-1">Выберите классический символ клана:</div>
          <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto p-1 rounded bg-slate-900 border border-slate-800">
            {STANDARD_CLAN_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => {
                  setSelectedEmblem(ic);
                  setCustomEmblemPreview(null);
                  setEmblemError(null);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded text-base transition-transform ${
                  selectedEmblem === ic
                    ? 'border-2 border-amber-400 bg-amber-500/20 scale-110'
                    : 'border border-slate-800 bg-slate-950 hover:border-slate-600'
                }`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const depositableItems = inventory.filter((item) => !item.isClanRented && !item.rent);

  return (
    <div
      className={
        embedded
          ? 'relative flex flex-1 min-h-0 w-full flex-col overflow-hidden bg-[#12161f] text-white'
          : 'fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm'
      }
    >
      <div
        className={
          embedded
            ? 'flex flex-1 min-h-0 w-full flex-col overflow-hidden bg-[#12161f] text-white'
            : 'flex h-[92vh] max-h-[780px] w-full max-w-[430px] flex-col overflow-hidden rounded-2xl border-2 border-amber-500/70 bg-[#12161f] text-white shadow-[0_0_30px_rgba(245,158,11,0.3)]'
        }
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-amber-500/30 bg-gradient-to-r from-slate-950 via-amber-950/40 to-slate-950 px-3 py-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-amber-300">
                {playerClan
                  ? `#${playerClan.clanNumber || 1} [${playerClan.tag}] ${playerClan.name}`
                  : 'Клановая Система'}
              </h2>
              <p className="text-[9px] text-slate-400">
                {playerClan
                  ? `Ур. ${playerClan.level}/${MAX_CLAN_LEVEL} • Пул PTS: ${(playerClan.unassignedPtsPool || 0).toLocaleString('ru-RU')} • Склад: ${playerClan.storage.length}/${maxStorageCap}`
                  : 'Создание клана, база вещей и эликсиров, битва за Пирамиду'}
              </p>
            </div>
          </div>

          {!embedded && (
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-xs font-bold text-slate-300 hover:border-red-500 hover:text-red-400"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Tabs — 8 чистых вкладок сеткой в 2 ряда (по 4 кнопки в ряд, без горизонтальной прокрутки) */}
        <div className="border-b border-slate-800 bg-slate-950/95 p-1.5 shrink-0">
          {playerClan ? (
            <div className="grid grid-cols-4 gap-1">
              {/* Ряд 1: [ Мой Клан ] | [ Погоны (Военторг) ] | [ База и Склад ] | [ Казна и Логи ] */}
              <button
                type="button"
                onClick={() => setActiveTab('myClan')}
                className={`rounded px-1.5 py-1.5 text-[9.5px] font-extrabold transition-colors truncate cursor-pointer ${
                  activeTab === 'myClan' || activeTab === 'members'
                    ? 'border border-amber-400 bg-amber-500/25 text-amber-200 shadow'
                    : 'border border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                [ Мой Клан ]
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('voentorg')}
                className={`rounded px-1.5 py-1.5 text-[9.5px] font-extrabold transition-colors truncate cursor-pointer ${
                  activeTab === 'voentorg'
                    ? 'border border-emerald-400 bg-emerald-500/25 text-emerald-200 shadow'
                    : 'border border-slate-800 bg-slate-900/90 text-amber-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                [ Погоны (Военторг) ]
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('clanBase')}
                className={`rounded px-1.5 py-1.5 text-[9.5px] font-extrabold transition-colors truncate cursor-pointer ${
                  activeTab === 'clanBase' || activeTab === 'storage' || activeTab === 'ammunition'
                    ? 'border border-cyan-400 bg-cyan-500/25 text-cyan-200 shadow'
                    : 'border border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                [ База и Склад ]
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('treasury')}
                className={`rounded px-1.5 py-1.5 text-[9.5px] font-extrabold transition-colors truncate cursor-pointer ${
                  activeTab === 'treasury' || activeTab === 'logs'
                    ? 'border border-yellow-400 bg-yellow-500/25 text-yellow-200 shadow'
                    : 'border border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                [ Казна и Логи ]
              </button>

              {/* Ряд 2: [ Дипломатия (#ID) ] | [ Рейтинг Кланов ] | [ Пирамида и Босс ] | [ Задания и Ачивки ] */}
              <button
                type="button"
                onClick={() => setActiveTab('diplomacy')}
                className={`rounded px-1.5 py-1.5 text-[9.5px] font-extrabold transition-colors truncate cursor-pointer ${
                  activeTab === 'diplomacy' || activeTab === 'territories'
                    ? 'border border-purple-400 bg-purple-500/25 text-purple-200 shadow'
                    : 'border border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                [ Дипломатия (#ID) ]
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('clanRating')}
                className={`rounded px-1.5 py-1.5 text-[9.5px] font-extrabold transition-colors truncate cursor-pointer ${
                  activeTab === 'clanRating' || activeTab === 'clansList'
                    ? 'border border-amber-400 bg-amber-500/25 text-amber-200 shadow'
                    : 'border border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                [ Рейтинг Кланов ]
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('raid')}
                className={`rounded px-1.5 py-1.5 text-[9.5px] font-extrabold transition-colors truncate cursor-pointer ${
                  activeTab === 'raid' || activeTab === 'arena'
                    ? 'border border-orange-400 bg-orange-500/25 text-orange-200 shadow'
                    : 'border border-amber-500/50 bg-gradient-to-r from-red-950/90 to-amber-950/90 text-amber-200 hover:border-amber-400'
                }`}
              >
                [ Пирамида и Босс ]
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('quests')}
                className={`rounded px-1.5 py-1.5 text-[9.5px] font-extrabold transition-colors truncate cursor-pointer ${
                  activeTab === 'quests' || activeTab === 'achievements'
                    ? 'border border-emerald-400 bg-emerald-500/25 text-emerald-200 shadow'
                    : 'border border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                [ Задания и Ачивки ]
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('clanRating')}
                className={`rounded px-2 py-1.5 text-[9.5px] font-extrabold transition-colors truncate cursor-pointer ${
                  activeTab === 'clanRating'
                    ? 'border border-amber-400 bg-amber-500/20 text-amber-300 shadow'
                    : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                [ Рейтинг Кланов ]
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('clansList')}
                className={`rounded px-2 py-1.5 text-[9.5px] font-extrabold transition-colors truncate cursor-pointer ${
                  activeTab === 'clansList'
                    ? 'border border-amber-400 bg-amber-500/20 text-amber-300 shadow'
                    : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                📋 Список кланов ({allClans.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('territories')}
                className={`rounded px-2 py-1.5 text-[9.5px] font-extrabold transition-colors truncate cursor-pointer ${
                  activeTab === 'territories'
                    ? 'border border-red-400 bg-red-500/20 text-red-200 shadow'
                    : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                🗺️ Территории
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('arena')}
                className={`rounded px-2 py-1.5 text-[9.5px] font-extrabold transition-colors truncate cursor-pointer ${
                  activeTab === 'arena'
                    ? 'border border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200 shadow'
                    : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                🏟️ Арена
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`col-span-2 sm:col-span-1 rounded px-2 py-1.5 text-[9.5px] font-extrabold transition-colors truncate cursor-pointer ${
                  activeTab === 'create'
                    ? 'border border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow'
                    : 'border border-cyan-500/50 bg-cyan-950/60 text-cyan-200 hover:text-white'
                }`}
              >
                ✨ Создать ({CLAN_CREATION_COST_CRYSTALS} 💎)
              </button>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto overscroll-y-contain touch-pan-y p-3 space-y-3 text-xs">
          {/* Sub-navigation bar for merged tabs so all features remain 1-click accessible without cluttering header */}
          {playerClan && (activeTab === 'clanBase' || activeTab === 'storage' || activeTab === 'ammunition') && (
            <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-cyan-500/40 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('clanBase')}
                className={`rounded py-1.5 px-2 text-[9.5px] font-black transition-colors cursor-pointer ${
                  activeTab === 'clanBase'
                    ? 'bg-cyan-500 text-slate-950 shadow'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                🏗️ 4 Постройки Базы
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('storage')}
                className={`rounded py-1.5 px-2 text-[9.5px] font-black transition-colors cursor-pointer ${
                  activeTab === 'storage'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                📦 Склад ({playerClan.storage.length}/{maxStorageCap})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ammunition')}
                className={`rounded py-1.5 px-2 text-[9.5px] font-black transition-colors cursor-pointer ${
                  activeTab === 'ammunition'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                ⚒️ Крафт клана
              </button>
            </div>
          )}

          {playerClan && (activeTab === 'treasury' || activeTab === 'logs') && (
            <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-yellow-500/40 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('treasury')}
                className={`rounded py-1.5 px-2 text-[9.5px] font-black transition-colors cursor-pointer ${
                  activeTab === 'treasury'
                    ? 'bg-yellow-500 text-slate-950 shadow'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                🏦 Казна ({(playerClan.treasuryGold || 0).toLocaleString('ru-RU')} 🪙)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('logs')}
                className={`rounded py-1.5 px-2 text-[9.5px] font-black transition-colors cursor-pointer ${
                  activeTab === 'logs'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                📜 Все логи клана ({(playerClan.logs || []).length})
              </button>
            </div>
          )}

          {playerClan && (activeTab === 'diplomacy' || activeTab === 'territories') && (
            <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-purple-500/40 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('diplomacy')}
                className={`rounded py-1.5 px-2 text-[9.5px] font-black transition-colors cursor-pointer ${
                  activeTab === 'diplomacy'
                    ? 'bg-purple-500 text-white shadow'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                🤝 Союзы / Войны / PTS по #ID
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('territories')}
                className={`rounded py-1.5 px-2 text-[9.5px] font-black transition-colors cursor-pointer ${
                  activeTab === 'territories'
                    ? 'bg-red-500 text-white shadow'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                🗺️ Карта территорий / Войны
              </button>
            </div>
          )}

          {playerClan && (activeTab === 'clanRating' || activeTab === 'clansList') && (
            <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-amber-500/40 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('clanRating')}
                className={`rounded py-1.5 px-2 text-[9.5px] font-black transition-colors cursor-pointer ${
                  activeTab === 'clanRating'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                🏆 Рейтинг Кланов по #ID
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('clansList')}
                className={`rounded py-1.5 px-2 text-[9.5px] font-black transition-colors cursor-pointer ${
                  activeTab === 'clansList'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                📋 Список и поиск кланов ({allClans.length})
              </button>
            </div>
          )}

          {playerClan && (activeTab === 'raid' || activeTab === 'arena') && (
            <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-orange-500/50 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenClanPyramid();
                }}
                className="rounded py-1.5 px-2 text-[9.5px] font-black bg-gradient-to-r from-red-700 to-amber-600 text-white shadow hover:brightness-110 cursor-pointer"
              >
                🔺 Вход в Пирамиду Ра
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('raid')}
                className={`rounded py-1.5 px-2 text-[9.5px] font-black transition-colors cursor-pointer ${
                  activeTab === 'raid'
                    ? 'bg-orange-500 text-slate-950 shadow'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                🐉 Рейд Босса
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('arena')}
                className={`rounded py-1.5 px-2 text-[9.5px] font-black transition-colors cursor-pointer ${
                  activeTab === 'arena'
                    ? 'bg-fuchsia-500 text-white shadow'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                🏟️ Арена Чемпионов
              </button>
            </div>
          )}

          {playerClan && (activeTab === 'quests' || activeTab === 'achievements') && (
            <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-emerald-500/40 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('quests')}
                className={`rounded py-1.5 px-2 text-[9.5px] font-black transition-colors cursor-pointer ${
                  activeTab === 'quests'
                    ? 'bg-cyan-500 text-slate-950 shadow'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                📋 Задания клана
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('achievements')}
                className={`rounded py-1.5 px-2 text-[9.5px] font-black transition-colors cursor-pointer ${
                  activeTab === 'achievements'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                🏆 Достижения ({clanAchStatus.completedCount}/{clanAchStatus.totalCount})
              </button>
            </div>
          )}

          {/* ==================== TAB: VOENTORG (RANKS 1-15 ONLY) ==================== */}
          {playerClan && activeTab === 'voentorg' && (
            <ClanSyndicateGwarsView
              clan={playerClan}
              myNick={myNick}
              hero={hero}
              isAdmin={isAdmin}
              forcedSection="voentorg_ranks"
              onUpdateHero={onUpdateHero}
              showToast={showToast}
              triggerRefresh={triggerRefresh}
            />
          )}

          {/* ==================== TAB: CLAN BASE (4 BUILDINGS ONLY) ==================== */}
          {playerClan && activeTab === 'clanBase' && (
            <ClanSyndicateGwarsView
              clan={playerClan}
              myNick={myNick}
              hero={hero}
              isAdmin={isAdmin}
              forcedSection="clan_base"
              onUpdateHero={onUpdateHero}
              showToast={showToast}
              triggerRefresh={triggerRefresh}
            />
          )}

          {/* ==================== TAB: DIPLOMACY & INTERCLAN TRANSFERS BY #ID ==================== */}
          {playerClan && activeTab === 'diplomacy' && (
            <ClanSyndicateGwarsView
              clan={playerClan}
              myNick={myNick}
              hero={hero}
              isAdmin={isAdmin}
              forcedSection="diplomacy_transfers"
              onUpdateHero={onUpdateHero}
              showToast={showToast}
              triggerRefresh={triggerRefresh}
            />
          )}

          {/* ==================== TAB: CLAN RATING (ALL SYNDICATES BY #ID) ==================== */}
          {activeTab === 'clanRating' && playerClan && (
            <ClanSyndicateGwarsView
              clan={playerClan}
              myNick={myNick}
              hero={hero}
              isAdmin={isAdmin}
              forcedSection="clan_rating"
              onUpdateHero={onUpdateHero}
              showToast={showToast}
              triggerRefresh={triggerRefresh}
            />
          )}

          {/* ==================== TAB 1: MY CLAN (DISPLAYED ONLY ON myClan TAB!) ==================== */}
          {playerClan && activeTab === 'myClan' && (
            <div className="space-y-3" style={{ display: activeTab === 'myClan' ? 'block' : 'none' }}>
              {/* Clan Banner Card */}
              <div className="rounded-xl border border-amber-500/50 bg-gradient-to-b from-slate-900 to-slate-950 p-3 shadow-lg">
                <div className="flex items-start gap-3">
                  {renderClanEmblem(playerClan.emblem, 'h-16 w-16 text-3xl')}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="rounded bg-slate-950 border border-amber-500/70 px-1.5 py-0.5 font-mono text-[10px] font-black text-amber-400">
                        #{playerClan.clanNumber || 1}
                      </span>
                      <span className="rounded bg-amber-500/25 border border-amber-400 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
                        [{playerClan.tag}]
                      </span>
                      <h3 className="text-sm font-black text-white truncate">{playerClan.name}</h3>
                    </div>

                    <p className="mt-1 text-[10px] text-slate-300 italic break-words">
                      «{playerClan.description || 'Отважные воины песков'}»
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2 text-[9.5px] font-bold">
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-amber-300 border border-slate-700">
                        👑 Лидер: {playerClan.leaderNick}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-emerald-300 border border-slate-700">
                        🎖️ Пул PTS: {(playerClan.unassignedPtsPool || 0).toLocaleString('ru-RU')}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-purple-300 border border-slate-700">
                        ⭐ Влияние: {playerClan.influencePoints}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-yellow-300 border border-slate-700" title="Счёт клана в золоте">
                        🪙 Казна: {(playerClan.treasuryGold || 0).toLocaleString('ru-RU')}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-cyan-300 border border-slate-700" title="Счёт клана в кристаллах">
                        💎 Кристаллы: {(playerClan.treasuryCrystals || 0).toLocaleString('ru-RU')}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-emerald-300 border border-slate-700">
                        👥 Состав: {playerClan.members.length} чел.
                      </span>
                    </div>

                    {/* Блок «Повестка дня (Приказ Главы)» */}
                    <div className="mt-2.5 rounded-lg border border-amber-500/50 bg-[#181612] p-2.5 text-[10px]">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-black uppercase tracking-wider text-amber-300">
                          📌 Повестка дня (Приказ Главы #{playerClan.clanNumber || 1} [{playerClan.tag}])
                        </span>
                        {(isLeader || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => {
                              setAgendaDraft(
                                playerClan.agendaText ||
                                  'Приказ Главы: Бойцам держать строй! Защищать секторные заводы 7x7 и сдавать ресурсы в Порту.'
                              );
                              setIsEditingAgenda((prev) => !prev);
                            }}
                            className="rounded border border-amber-400/70 bg-amber-950/70 px-2 py-0.5 text-[9px] font-bold text-amber-200 hover:bg-amber-900 cursor-pointer"
                          >
                            {isEditingAgenda ? 'Отмена' : '✏️ Изменить приказ'}
                          </button>
                        )}
                      </div>
                      {isEditingAgenda ? (
                        <div className="space-y-1.5 mt-1">
                          <textarea
                            rows={2}
                            maxLength={280}
                            value={agendaDraft}
                            onChange={(e) => setAgendaDraft(e.target.value)}
                            placeholder="Введите боевой приказ или повестку дня для всех бойцов клана..."
                            className="w-full rounded border border-amber-500/60 bg-slate-950 px-2 py-1 text-[10px] text-white"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                const res = updateClanAgenda(playerClan.id, myNick, agendaDraft);
                                if (!res.ok) {
                                  showToast(`⚠️ ${res.error}`);
                                  return;
                                }
                                setIsEditingAgenda(false);
                                triggerRefresh();
                                showToast(res.message || '📌 Приказ Главы обновлён!');
                              }}
                              className="rounded border border-emerald-400 bg-emerald-700 px-3 py-1 text-[9.5px] font-black text-white hover:bg-emerald-600 cursor-pointer"
                            >
                              [ Сохранить приказ ]
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10.5px] font-semibold text-amber-100 leading-snug break-words">
                          {playerClan.agendaText ||
                            'Приказ Главы: Бойцам держать строй! Защищать секторные заводы 7x7 и сдавать ресурсы в Порту.'}
                        </div>
                      )}
                    </div>

                    {/* Clan Account Highlight Banner & Instant Contribution */}
                    <div className="mt-2 rounded-lg border border-amber-500/40 bg-slate-950/90 p-2 space-y-2 text-[9px]">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div>
                          <span className="text-slate-400">🏦 Общак клана (Казна): </span>
                          <strong className="text-yellow-300">🪙 {(playerClan.treasuryGold || 0).toLocaleString('ru-RU')}</strong>
                          <span className="text-slate-500 mx-1">|</span>
                          <strong className="text-cyan-300">💎 {(playerClan.treasuryCrystals || 0).toLocaleString('ru-RU')}</strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[7.5px] text-slate-400">
                            Налог с Пирамиды: {playerClan.pyramidTaxGoldPct ?? 15}%🪙 / {playerClan.pyramidTaxCrystalPct ?? 15}%💎
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveTab('treasury')}
                            className="rounded border border-yellow-400/70 bg-yellow-950/80 px-2 py-0.5 text-[8.5px] font-black text-yellow-200 hover:bg-yellow-900 cursor-pointer"
                          >
                            🏦 Открыть казну →
                          </button>
                        </div>
                      </div>

                      {/* Quick 1-click Clan Contribution Bar */}
                      <div className="border-t border-slate-800/80 pt-1.5 flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-[8.5px] font-extrabold text-emerald-300">
                          ⚡ Быстрый вклад в клан (+EXP и ⭐ Влияние):
                        </span>
                        <div className="flex flex-wrap items-center gap-1">
                          {[1000, 5000, 25000].map((gPreset) => (
                            <button
                              key={`quick_g_${gPreset}`}
                              type="button"
                              disabled={hero.gold < gPreset}
                              onClick={() => handleDepositGold(gPreset)}
                              className="rounded border border-amber-400/60 bg-amber-950/70 px-1.5 py-0.5 text-[8px] font-black text-amber-200 hover:bg-amber-900 disabled:opacity-40 cursor-pointer"
                            >
                              +{gPreset.toLocaleString('ru-RU')} 🪙
                            </button>
                          ))}
                          {[50, 200, 1000].map((cPreset) => (
                            <button
                              key={`quick_c_${cPreset}`}
                              type="button"
                              disabled={hero.crystals < cPreset}
                              onClick={() => handleDepositCrystals(cPreset)}
                              className="rounded border border-cyan-400/60 bg-cyan-950/70 px-1.5 py-0.5 text-[8px] font-black text-cyan-200 hover:bg-cyan-900 disabled:opacity-40 cursor-pointer"
                            >
                              +{cPreset.toLocaleString('ru-RU')} 💎
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clan Level & EXP Progress Bar (Max Level 20, EXP = 2x Character EXP) */}
                <div className="mt-3 rounded-lg border border-purple-500/40 bg-slate-950/90 p-2.5">
                  <div className="flex items-center justify-between text-[10px] font-extrabold mb-1">
                    <span className="text-purple-300">
                      🆙 Уровень клана: {playerClan.level} / {MAX_CLAN_LEVEL}
                    </span>
                    <span className="text-amber-300">
                      📦 Мест на базе: {playerClan.storage.length} / {maxStorageCap} (+10 за ур.)
                    </span>
                  </div>
                  <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-slate-800 border border-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-500 transition-all"
                      style={{ width: `${clanExpPct}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-[8.5px] font-black text-white drop-shadow">
                      {playerClan.level >= MAX_CLAN_LEVEL
                        ? 'МАКСИМАЛЬНЫЙ УРОВЕНЬ (20)'
                        : `Опыт клана: ${currentClanExp} / ${nextClanExp} EXP (${clanExpPct}%)`}
                    </div>
                  </div>
                  <div className="mt-1 text-[8.5px] text-slate-400">
                    💡 Опыт клана идет за бои участников в Пирамиде. Каждый уровень дает <strong>+10 мест</strong> на базе клана (до 20 уровня).
                  </div>
                </div>

                {/* Active Clan Pyramid Control Buffs */}
                <div className="mt-2.5 rounded-lg border border-amber-500/30 bg-slate-900/90 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                      🔺 Статус Клановой Пирамиды
                    </span>
                    {clanBuffs.hasControl ? (
                      <span className="rounded bg-emerald-500/20 border border-emerald-400 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                        👑 ВАШ КЛАН ВЛАДЕЕТ ПИРАМИДОЙ!
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-400">
                        Контролирует:{' '}
                        <strong className="text-amber-300">
                          {pyramidState.controlledByClanName
                            ? `[${pyramidState.controlledByClanTag}] ${pyramidState.controlledByClanName}`
                            : 'Никто (Свободна)'}
                        </strong>
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[9px]">
                    <div className="rounded bg-slate-950 p-1.5 border border-slate-800">
                      <span className="text-slate-400">Бонус Золота и Опыта:</span>{' '}
                      <strong className={clanBuffs.hasControl ? 'text-emerald-400' : 'text-slate-500'}>
                        +{pyramidState.config?.buffGoldPct ?? 15}% 🪙 / +{pyramidState.config?.buffExpPct ?? 15}% ✨
                      </strong>
                    </div>
                    <div className="rounded bg-slate-950 p-1.5 border border-slate-800">
                      <span className="text-slate-400">Бонус Урона и ОЗ:</span>{' '}
                      <strong className={clanBuffs.hasControl ? 'text-emerald-400' : 'text-slate-500'}>
                        +{pyramidState.config?.buffDmgPct ?? 5}% ⚔️ / +{pyramidState.config?.buffHpPct ?? 10}% ❤️
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Cooperative Clan Achievements Group Buff Summary */}
                <div className="mt-2.5 rounded-lg border border-emerald-500/40 bg-slate-900/90 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                      🏆 Клановые достижения ({clanAchStatus.completedCount}/{clanAchStatus.totalCount})
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('achievements')}
                      className="rounded border border-emerald-400/70 bg-emerald-950/70 px-2 py-0.5 text-[8.5px] font-black text-emerald-200 hover:bg-emerald-900"
                    >
                      Открыть достижения →
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[9px] text-slate-300">
                    <span>Постоянный бонус всей группе клана:</span>
                    <div className="flex items-center gap-2 font-black">
                      <span className="rounded bg-purple-950/80 border border-purple-400/50 px-1.5 py-0.5 text-purple-200">
                        ✨ +{clanAchStatus.totalExpBonusPct}% к опыту
                      </span>
                      <span className="rounded bg-amber-950/80 border border-amber-400/50 px-1.5 py-0.5 text-amber-200">
                        🪙 +{clanAchStatus.totalGoldBonusPct}% к золоту
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Access Cards to Territory Wars, Raid Boss, Clan Quests & Champions Arena */}
                <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('territories')}
                    className="rounded-xl border border-red-500/40 bg-gradient-to-br from-red-950/70 to-slate-900 p-2 text-left hover:border-red-400 transition-all cursor-pointer"
                  >
                    <div className="text-sm">🗺️</div>
                    <div className="text-[9.5px] font-black text-red-200 mt-0.5">Карта территорий</div>
                    <div className="text-[8px] text-slate-400">Клановые Войны 24ч</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('raid')}
                    className="rounded-xl border border-orange-500/40 bg-gradient-to-br from-orange-950/70 to-slate-900 p-2 text-left hover:border-orange-400 transition-all cursor-pointer"
                  >
                    <div className="text-sm">🐉</div>
                    <div className="text-[9.5px] font-black text-orange-200 mt-0.5">Рейд Босса</div>
                    <div className="text-[8px] text-slate-400">Ежедневный Босс клана</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('quests')}
                    className="rounded-xl border border-cyan-500/40 bg-gradient-to-br from-cyan-950/70 to-slate-900 p-2 text-left hover:border-cyan-400 transition-all cursor-pointer"
                  >
                    <div className="text-sm">📋</div>
                    <div className="text-[9.5px] font-black text-cyan-200 mt-0.5">Задания клана</div>
                    <div className="text-[8px] text-slate-400">Общие цели и сундуки</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('arena')}
                    className="rounded-xl border border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-950/70 to-slate-900 p-2 text-left hover:border-fuchsia-400 transition-all cursor-pointer"
                  >
                    <div className="text-sm">🏟️</div>
                    <div className="text-[9.5px] font-black text-fuchsia-200 mt-0.5">Арена Чемпионов</div>
                    <div className="text-[8px] text-slate-400">PvP турниры и титулы</div>
                  </button>
                </div>

                {/* Quick Action Buttons */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setActiveTab('treasury')}
                    className="flex-1 rounded-lg border border-yellow-400/80 bg-gradient-to-b from-yellow-700 to-amber-950 py-2 px-2 text-[10px] font-black text-yellow-100 shadow hover:from-yellow-600"
                  >
                    🏦 Клановая казна
                  </button>
                  <button
                    onClick={() => setActiveTab('storage')}
                    className="flex-1 rounded-lg border border-amber-400/80 bg-gradient-to-b from-amber-700 to-amber-900 py-2 px-2 text-[10px] font-black text-amber-100 shadow hover:from-amber-600"
                  >
                    📦 База ({playerClan.storage.length}/{maxStorageCap})
                  </button>
                  <button
                    onClick={() => setActiveTab('ammunition')}
                    className="flex-1 rounded-lg border border-cyan-400/80 bg-gradient-to-b from-cyan-700 to-slate-900 py-2 px-2 text-[10px] font-black text-cyan-100 shadow hover:from-cyan-600"
                  >
                    ⚒️ Крафт клана (Без Порта)
                  </button>
                  <button
                    onClick={() => setActiveTab('achievements')}
                    className="flex-1 rounded-lg border border-emerald-400/80 bg-gradient-to-b from-emerald-700 to-slate-900 py-2 px-2 text-[10px] font-black text-emerald-100 shadow hover:from-emerald-600"
                  >
                    🏆 Достижения
                  </button>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenClanPyramid();
                    }}
                    className="w-full rounded-lg border border-red-400/80 bg-gradient-to-b from-red-700 to-red-950 py-2 text-[10px] font-black text-red-100 shadow hover:from-red-600"
                  >
                    ⚔️ Войти в Клановую Пирамиду
                  </button>
                </div>

                {/* Leader & Member Actions (Leave Clan is ALWAYS available to any member!) */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(isLeader || isAdmin) && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedEmblem(playerClan.emblem || '🛡️');
                            setIsEditingEmblem(!isEditingEmblem);
                            setIsEditingClan(false);
                          }}
                          className="rounded border border-amber-500/70 bg-amber-950/70 px-2.5 py-1 text-[9.5px] font-extrabold text-amber-200 hover:bg-amber-900"
                        >
                          🎨 Герб клана
                        </button>
                        <button
                          onClick={() => {
                            setEditDesc(playerClan.description);
                            setEditIsOpen(playerClan.isOpen);
                            setEditMinLvl(playerClan.joinMinLvl);
                            setIsEditingClan(!isEditingClan);
                            setIsEditingEmblem(false);
                          }}
                          className="rounded border border-slate-600 bg-slate-800 px-2.5 py-1 text-[9.5px] font-bold text-slate-200 hover:bg-slate-700"
                        >
                          ⚙️ Настройки клана
                        </button>
                      </>
                    )}

                    {/* Кнопка Выйти из клана доступна ВСЕГДА любому участнику */}
                    <button
                      onClick={handleLeaveClan}
                      className="rounded border border-red-500/70 bg-red-950/70 px-2.5 py-1 text-[9.5px] font-extrabold text-red-200 hover:bg-red-900"
                    >
                      🚪 Выйти из клана
                    </button>
                  </div>

                  {(isLeader || isAdmin) && (
                    <button
                      onClick={handleDisbandClan}
                      className="rounded border border-red-500/60 bg-red-950/60 px-2.5 py-1 text-[9.5px] font-bold text-red-300 hover:bg-red-900"
                    >
                      💥 Распустить клан
                    </button>
                  )}
                </div>

                {/* Leader Custom Emblem Studio Drawer */}
                {isEditingEmblem && (
                  <div className="mt-2.5 space-y-2 rounded-xl border border-amber-500/50 bg-slate-900/95 p-2.5">
                    {renderEmblemStudioContent(playerClan.tag)}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleSaveClanEmblem}
                        className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-[10px] font-black text-white shadow hover:bg-emerald-500"
                      >
                        💾 Сохранить новый герб клана
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingEmblem(false)}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[10px] font-bold text-slate-300 hover:text-white"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {/* Edit Settings Drawer */}
                {isEditingClan && (
                  <div className="mt-2.5 space-y-2 rounded-lg border border-slate-700 bg-slate-900 p-2.5">
                    <div className="text-[10px] font-extrabold text-amber-300">Редактировать описание и прием</div>
                    <input
                      type="text"
                      maxLength={80}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Девиз или описание клана..."
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-white"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-300">
                        <input
                          type="checkbox"
                          checked={editIsOpen}
                          onChange={(e) => setEditIsOpen(e.target.checked)}
                        />
                        Открытый вход без заявки
                      </label>
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="text-slate-400">Мин. ур.:</span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={editMinLvl}
                          onChange={(e) => setEditMinLvl(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                          className="w-12 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-center text-[10px]"
                        />
                      </div>
                    </div>

                    {/* Settings for Clan profit from Clan Pyramid */}
                    <div className="rounded border border-amber-500/30 bg-slate-950/80 p-2 space-y-1.5">
                      <div className="text-[9.5px] font-black text-amber-300">
                        ⚙️ Настройки отчислений в казну с Клановой Пирамиды:
                      </div>
                      <div className="text-[8px] text-slate-400">
                        Прибыль клану от игроков поступает ТОЛЬКО с Клановой Пирамиды (с обычной пирамиды начислений нет).
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        <div>
                          <span className="text-[8.5px] text-amber-300 font-bold block mb-0.5">
                            🪙 Доля золота клану (%):
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={editGoldPct}
                            onChange={(e) => setEditGoldPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[9.5px] font-bold text-amber-300"
                          />
                        </div>
                        <div>
                          <span className="text-[8.5px] text-cyan-300 font-bold block mb-0.5">
                            💎 Доля кристаллов (%):
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={editCrystalPct}
                            onChange={(e) => setEditCrystalPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[9.5px] font-bold text-cyan-300"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveClanSettings}
                      className="w-full rounded bg-emerald-600 py-1 text-[10px] font-bold text-white hover:bg-emerald-500"
                    >
                      💾 Сохранить
                    </button>
                  </div>
                )}
              </div>

              {/* Таблица Состава и Прав доступа на вкладке Мой Клан (без Военторга и Базы) */}
              <ClanSyndicateGwarsView
                clan={playerClan}
                myNick={myNick}
                hero={hero}
                isAdmin={isAdmin}
                forcedSection="roster_permissions"
                onUpdateHero={onUpdateHero}
                showToast={showToast}
                triggerRefresh={triggerRefresh}
              />
            </div>
          )}

          {/* ==================== TAB 1.5: CLAN TREASURY ("КЛАНОВАЯ КАЗНА / ОБЩАК") ==================== */}
          {playerClan && activeTab === 'treasury' && (
            <div className="space-y-3">
              {/* Header & Current Treasury Balances */}
              <div className="rounded-xl border-2 border-yellow-500/60 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-3 shadow-lg space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-yellow-300 flex items-center gap-1.5">
                      <span>🏦 Клановая казна (Общак клана [{playerClan.tag}])</span>
                    </h3>
                    <p className="text-[9.5px] text-slate-300 mt-0.5">
                      Общий фонд золота и кристаллов вашего братства. Пополняется взносами участников и налогом с Клановой Пирамиды ({playerClan.pyramidTaxGoldPct ?? 15}% 🪙 / {playerClan.pyramidTaxCrystalPct ?? 15}% 💎), расходуется на клановый крафт вещей и транспорта.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ammunition')}
                    className="rounded-lg border border-amber-400/70 bg-amber-950/80 px-2.5 py-1 text-[9.5px] font-black text-amber-200 hover:bg-amber-900"
                  >
                    ⚒️ Перейти в Крафт клана →
                  </button>
                </div>

                {/* Treasury Balance Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-yellow-500/50 bg-gradient-to-r from-amber-950/60 via-slate-950 to-slate-950 p-3 flex items-center justify-between shadow">
                    <div>
                      <div className="text-[9.5px] font-bold uppercase tracking-wider text-yellow-300/90">
                        🪙 Золото в общаке клана
                      </div>
                      <div className="text-base sm:text-lg font-black text-yellow-300 mt-0.5">
                        {(playerClan.treasuryGold || 0).toLocaleString('ru-RU')} 🪙
                      </div>
                      <div className="text-[8.5px] text-slate-400 mt-0.5">
                        Ваши личные средства: <strong className="text-amber-200">{hero.gold.toLocaleString('ru-RU')} 🪙</strong>
                      </div>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-yellow-400/50 bg-yellow-500/15 text-2xl shadow">
                      🪙
                    </div>
                  </div>

                  <div className="rounded-xl border border-cyan-500/50 bg-gradient-to-r from-cyan-950/60 via-slate-950 to-slate-950 p-3 flex items-center justify-between shadow">
                    <div>
                      <div className="text-[9.5px] font-bold uppercase tracking-wider text-cyan-300/90">
                        💎 Кристаллы в общаке клана
                      </div>
                      <div className="text-base sm:text-lg font-black text-cyan-300 mt-0.5">
                        {(playerClan.treasuryCrystals || 0).toLocaleString('ru-RU')} 💎
                      </div>
                      <div className="text-[8.5px] text-slate-400 mt-0.5">
                        Ваши личные средства: <strong className="text-cyan-200">{hero.crystals.toLocaleString('ru-RU')} 💎</strong>
                      </div>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/50 bg-cyan-500/15 text-2xl shadow">
                      💎
                    </div>
                  </div>
                </div>
              </div>

              {/* Deposit Gold & Crystals from Personal Funds into Clan Treasury */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Gold Deposit Card */}
                <div className="rounded-xl border border-amber-500/50 bg-slate-900/95 p-3 space-y-2 shadow">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-[10.5px] font-black text-amber-300">
                      🪙 Внести золото в общак
                    </span>
                    <span className="text-[9px] text-slate-400">
                      Доступно: <b className="text-amber-300">{hero.gold.toLocaleString('ru-RU')} 🪙</b>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {[1000, 5000, 10000, 50000, 100000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setGoldDepositAmount(preset)}
                        className={`rounded border px-2 py-0.5 text-[8.5px] font-bold transition-colors ${
                          goldDepositAmount === preset
                            ? 'border-amber-400 bg-amber-500/25 text-amber-200'
                            : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-amber-500/50'
                        }`}
                      >
                        +{preset.toLocaleString('ru-RU')}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setGoldDepositAmount(Math.max(1, hero.gold))}
                      className="rounded border border-yellow-500/60 bg-yellow-950/60 px-2 py-0.5 text-[8.5px] font-black text-yellow-200 hover:bg-yellow-900"
                    >
                      Все ({hero.gold.toLocaleString('ru-RU')})
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, hero.gold)}
                      value={goldDepositAmount || ''}
                      onChange={(e) => setGoldDepositAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      placeholder="Сумма 🪙"
                      className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-center text-[10.5px] font-black text-amber-300 outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleDepositGold()}
                      disabled={hero.gold <= 0 || goldDepositAmount <= 0}
                      className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 py-1.5 px-2.5 text-[10px] font-black text-slate-950 shadow hover:brightness-110 disabled:opacity-40 cursor-pointer"
                    >
                      🪙 Внести в общак
                    </button>
                  </div>
                </div>

                {/* Crystals Deposit Card */}
                <div className="rounded-xl border border-cyan-500/50 bg-slate-900/95 p-3 space-y-2 shadow">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-[10.5px] font-black text-cyan-300">
                      💎 Внести кристаллы в общак
                    </span>
                    <span className="text-[9px] text-slate-400">
                      Доступно: <b className="text-cyan-300">{hero.crystals.toLocaleString('ru-RU')} 💎</b>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {[100, 500, 1000, 2000, 5000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCrystalDepositAmount(preset)}
                        className={`rounded border px-2 py-0.5 text-[8.5px] font-bold transition-colors ${
                          crystalDepositAmount === preset
                            ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200'
                            : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-cyan-500/50'
                        }`}
                      >
                        +{preset.toLocaleString('ru-RU')}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCrystalDepositAmount(Math.max(1, hero.crystals))}
                      className="rounded border border-cyan-500/60 bg-cyan-950/60 px-2 py-0.5 text-[8.5px] font-black text-cyan-200 hover:bg-cyan-900"
                    >
                      Все ({hero.crystals.toLocaleString('ru-RU')})
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, hero.crystals)}
                      value={crystalDepositAmount || ''}
                      onChange={(e) => setCrystalDepositAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      placeholder="Сумма 💎"
                      className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-center text-[10.5px] font-black text-cyan-300 outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleDepositCrystals()}
                      disabled={hero.crystals <= 0 || crystalDepositAmount <= 0}
                      className="flex-1 rounded-lg bg-gradient-to-r from-cyan-500 to-sky-400 py-1.5 px-2.5 text-[10px] font-black text-slate-950 shadow hover:brightness-110 disabled:opacity-40 cursor-pointer"
                    >
                      💎 Внести в общак
                    </button>
                  </div>
                </div>
              </div>

              {/* Treasury Transaction History (Пополнения / Траты) */}
              {(() => {
                const rawLogs: ClanLogEntry[] = Array.isArray(playerClan.logs) ? playerClan.logs : [];
                const treasuryLogs = rawLogs.filter(
                  (entry) =>
                    entry.type === 'deposit_gold' ||
                    entry.type === 'deposit_crystals' ||
                    entry.type === 'pyramid_income' ||
                    entry.type === 'forge_clan_item'
                );

                const depositLogsCount = treasuryLogs.filter(
                  (e) => e.type === 'deposit_gold' || e.type === 'deposit_crystals' || e.type === 'pyramid_income'
                ).length;
                const expenseLogsCount = treasuryLogs.filter((e) => e.type === 'forge_clan_item').length;

                const visibleTreasuryLogs = treasuryLogs.filter((entry) => {
                  if (treasuryHistoryFilter === 'deposits') {
                    return (
                      entry.type === 'deposit_gold' ||
                      entry.type === 'deposit_crystals' ||
                      entry.type === 'pyramid_income'
                    );
                  }
                  if (treasuryHistoryFilter === 'expenses') {
                    return entry.type === 'forge_clan_item';
                  }
                  return true;
                });

                return (
                  <div className="rounded-xl border border-amber-500/40 bg-slate-900/95 p-3 space-y-2.5 shadow">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div>
                        <h4 className="text-xs font-black text-amber-300">
                          📜 История операций Клановой казны ({treasuryLogs.length})
                        </h4>
                        <p className="text-[9px] text-slate-400">
                          Все пополнения общака (личные взносы игроков и налог с Пирамиды) и траты казны (создание клановых вещей и транспорта).
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isSyncingLogs}
                        onClick={async () => {
                          setIsSyncingLogs(true);
                          await syncClansFromSupabase();
                          setIsSyncingLogs(false);
                          triggerRefresh();
                          showToast('🔄 История казны синхронизирована!');
                        }}
                        className="rounded-lg border border-sky-500/60 bg-sky-950/70 px-2.5 py-1 text-[9px] font-extrabold text-sky-200 hover:bg-sky-900 disabled:opacity-50"
                      >
                        {isSyncingLogs ? '⏳ Синхр...' : '🔄 Обновить'}
                      </button>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTreasuryHistoryFilter('all')}
                        className={`rounded-lg px-2.5 py-1 text-[9.5px] font-black transition-colors ${
                          treasuryHistoryFilter === 'all'
                            ? 'border border-amber-400 bg-amber-500/20 text-amber-200'
                            : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                        }`}
                      >
                        📋 Все операции ({treasuryLogs.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTreasuryHistoryFilter('deposits')}
                        className={`rounded-lg px-2.5 py-1 text-[9.5px] font-black transition-colors ${
                          treasuryHistoryFilter === 'deposits'
                            ? 'border border-emerald-400 bg-emerald-500/20 text-emerald-200'
                            : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                        }`}
                      >
                        📥 Пополнения ({depositLogsCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTreasuryHistoryFilter('expenses')}
                        className={`rounded-lg px-2.5 py-1 text-[9.5px] font-black transition-colors ${
                          treasuryHistoryFilter === 'expenses'
                            ? 'border border-rose-400 bg-rose-500/20 text-rose-200'
                            : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                        }`}
                      >
                        📤 Траты ({expenseLogsCount})
                      </button>
                    </div>

                    {visibleTreasuryLogs.length === 0 ? (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 text-center">
                        <div className="text-2xl mb-1">🏦</div>
                        <div className="text-[10.5px] font-bold text-slate-300">
                          В выбранной категории пока нет операций
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5">
                          Пополните общак золотом или кристаллами выше — операция сразу появится в истории казны.
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                        {visibleTreasuryLogs.map((log, idx) => {
                          const isExpense = log.type === 'forge_clan_item';
                          const badgeInfo =
                            log.type === 'deposit_gold'
                              ? {
                                  label: '📥 Пополнение золота',
                                  cls: 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300',
                                  rowCls: 'border-emerald-500/30'
                                }
                              : log.type === 'deposit_crystals'
                              ? {
                                  label: '📥 Пополнение кристаллов',
                                  cls: 'border-cyan-400/60 bg-cyan-500/20 text-cyan-300',
                                  rowCls: 'border-cyan-500/30'
                                }
                              : log.type === 'pyramid_income'
                              ? {
                                  label: '🏦 Налог с Пирамиды',
                                  cls: 'border-yellow-400/60 bg-yellow-500/20 text-yellow-200',
                                  rowCls: 'border-yellow-500/30'
                                }
                              : {
                                  label: '📤 Трата казны (Крафт)',
                                  cls: 'border-rose-400/60 bg-rose-500/20 text-rose-200',
                                  rowCls: 'border-rose-500/40'
                                };

                          return (
                            <div
                              key={`${log.id}_${idx}`}
                              className={`flex items-start gap-2.5 rounded-xl border bg-slate-950/90 px-2.5 py-2 ${badgeInfo.rowCls}`}
                            >
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border p-1 text-base ${
                                  isExpense
                                    ? 'border-rose-500/40 bg-rose-950/50'
                                    : 'border-emerald-500/40 bg-emerald-950/40'
                                }`}
                              >
                                <ItemIcon icon={log.icon || (isExpense ? '⚒️' : '🏦')} name={log.text} className="text-base" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10.5px] font-black text-white">
                                      {log.actorNick}
                                    </span>
                                    <span
                                      className={`rounded border px-1.5 py-0.5 text-[8px] font-extrabold ${badgeInfo.cls}`}
                                    >
                                      {badgeInfo.label}
                                    </span>
                                  </div>
                                  <span className="text-[8.5px] font-mono text-slate-400">
                                    🕒 {log.timeStr}
                                  </span>
                                </div>
                                <div
                                  className={`mt-0.5 text-[9.5px] font-bold break-words ${
                                    isExpense ? 'text-rose-200' : 'text-emerald-200'
                                  }`}
                                >
                                  {log.text}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ==================== TAB 2: CLAN STORAGE ("БАЗА ВЕЩЕЙ И ЭЛИКСИРОВ") ==================== */}
          {playerClan && activeTab === 'storage' && (
            <div className="space-y-3">
              {/* Storage Explanation & Deposit Buttons */}
              <div className="rounded-xl border border-amber-500/40 bg-slate-900/95 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black text-amber-300">
                      📦 Клановая База ({playerClan.storage.length} / {maxStorageCap} мест)
                    </h3>
                    <p className="text-[9px] text-slate-400">
                      Казна клана: <strong className="text-cyan-300">{(playerClan.treasuryCrystals || 0).toLocaleString('ru-RU')} 💎</strong> • <strong className="text-yellow-300">{(playerClan.treasuryGold || 0).toLocaleString('ru-RU')} 🪙</strong> • Вместимость: 50 мест (+10 за уровень).
                    </p>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    onClick={() => {
                      setDepositMode('item');
                      setIsDepositModalOpen(true);
                    }}
                    className="rounded-lg border border-emerald-400 bg-gradient-to-b from-emerald-600 to-emerald-800 px-2 py-1.5 text-[9.5px] font-black text-white shadow hover:from-emerald-500"
                  >
                    + Вещь
                  </button>
                  <button
                    onClick={() => {
                      setDepositMode('elixir');
                      setIsDepositModalOpen(true);
                    }}
                    className="rounded-lg border border-purple-400 bg-gradient-to-b from-purple-600 to-purple-900 px-2 py-1.5 text-[9.5px] font-black text-white shadow hover:from-purple-500"
                  >
                    🧪 Эликсиры
                  </button>
                  <button
                    onClick={() => {
                      setDepositMode('gold');
                      setIsDepositModalOpen(true);
                    }}
                    className="rounded-lg border border-amber-400 bg-gradient-to-b from-amber-600 to-amber-900 px-2 py-1.5 text-[9.5px] font-black text-white shadow hover:from-amber-500"
                  >
                    🪙 Золото
                  </button>
                  <button
                    onClick={() => {
                      setDepositMode('crystals');
                      setIsDepositModalOpen(true);
                    }}
                    className="rounded-lg border border-cyan-400 bg-gradient-to-b from-cyan-600 to-cyan-900 px-2 py-1.5 text-[9.5px] font-black text-white shadow hover:from-cyan-500"
                  >
                    💎 Кристаллы
                  </button>
                </div>
              </div>

              {/* Deposit Item, Elixir, Gold OR Crystals Modal Drawer */}
              {isDepositModalOpen && (
                <div className="rounded-xl border-2 border-emerald-500/70 bg-slate-950 p-2.5 shadow-xl space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setDepositMode('item')}
                        className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                          depositMode === 'item'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        🎒 Вещи ({depositableItems.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDepositMode('elixir')}
                        className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                          depositMode === 'elixir'
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        🧪 Эликсиры
                      </button>
                      <button
                        type="button"
                        onClick={() => setDepositMode('gold')}
                        className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                          depositMode === 'gold'
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        🪙 Золото
                      </button>
                      <button
                        type="button"
                        onClick={() => setDepositMode('crystals')}
                        className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                          depositMode === 'crystals'
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        💎 Кристаллы
                      </button>
                    </div>
                    <button
                      onClick={() => setIsDepositModalOpen(false)}
                      className="text-[10px] font-bold text-red-400 hover:text-red-300"
                    >
                      ✕ Закрыть
                    </button>
                  </div>

                  {depositMode === 'item' ? (
                    depositableItems.length === 0 ? (
                      <div className="py-4 text-center text-[10px] text-slate-500">
                        В вашей сумке нет свободных предметов (снимите вещь с персонажа, чтобы положить её на базу).
                      </div>
                    ) : (
                      <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                        {depositableItems.map((item, idx) => {
                          const q = getQualityConfig(item.quality);
                          return (
                            <div
                              key={`${item.id}_${idx}`}
                              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 p-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-950 p-1">
                                  <ItemIcon icon={item.icon} name={item.name} slot={item.slot} modificationClass={item.modificationClass} className="text-lg" />
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-[10.5px] font-bold flex items-center gap-1" style={{ color: q.color }}>
                                    <span className="truncate">{item.name}</span>
                                    {Number(item.modificationClass || 0) > 0 && (
                                      <span className="text-amber-400 font-black text-[9px] shrink-0" title={`Модификация: ${item.modificationClass}/10 звёзд`}>
                                        {'⭐'.repeat(Math.min(10, Number(item.modificationClass)))}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[8.5px] text-slate-400">
                                    Ур.{item.lvl} • ⚔️+{item.dmg} ❤️+{item.hp} • 🔧{item.durability ?? 100}/{item.maxDurability ?? 100}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDepositItem(item)}
                                className="rounded bg-emerald-600 px-2.5 py-1 text-[9.5px] font-black text-white hover:bg-emerald-500 shrink-0"
                              >
                                Положить
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : depositMode === 'elixir' ? (
                    <div className="space-y-2 pt-1">
                      <div className="text-[9.5px] text-slate-300">
                        Ваши эликсиры: <strong className="text-red-300">🧪 HP: {hero.hpPotions}</strong> •{' '}
                        <strong className="text-sky-300">⚡ EN: {hero.enPotions}</strong> •{' '}
                        <strong className="text-purple-300">✨ EXP: {hero.expPotions || 0}</strong>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedElixirType('hp')}
                          className={`flex items-center justify-center gap-1 rounded border p-1.5 text-[9.5px] font-bold ${
                            selectedElixirType === 'hp'
                              ? 'border-red-400 bg-red-950/60 text-red-200'
                              : 'border-slate-800 bg-slate-900 text-slate-400'
                          }`}
                        >
                          <img
                            src={ELIXIR_HP_IMG}
                            alt="Жизнь"
                            className="h-4 w-4 object-contain"
                          />
                          Жизнь ({hero.hpPotions})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedElixirType('en')}
                          className={`flex items-center justify-center gap-1 rounded border p-1.5 text-[9.5px] font-bold ${
                            selectedElixirType === 'en'
                              ? 'border-sky-400 bg-sky-950/60 text-sky-200'
                              : 'border-slate-800 bg-slate-900 text-slate-400'
                          }`}
                        >
                          <img
                            src={ELIXIR_EN_IMG}
                            alt="Энергия"
                            className="h-4 w-4 object-contain"
                          />
                          Энергия ({hero.enPotions})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedElixirType('exp')}
                          className={`flex items-center justify-center gap-1 rounded border p-1.5 text-[9.5px] font-bold ${
                            selectedElixirType === 'exp'
                              ? 'border-purple-400 bg-purple-950/60 text-purple-200'
                              : 'border-slate-800 bg-slate-900 text-slate-400'
                          }`}
                        >
                          <img
                            src={ELIXIR_EXP_IMG}
                            alt="Опыт"
                            className="h-4 w-4 object-contain"
                          />
                          Опыт ({hero.expPotions || 0})
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">Количество:</span>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={elixirDepositQty}
                          onChange={(e) => setElixirDepositQty(Math.max(1, Number(e.target.value) || 1))}
                          className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-center text-[10px] font-bold text-white"
                        />
                        <button
                          type="button"
                          onClick={handleDepositElixir}
                          className="flex-1 rounded bg-purple-600 py-1.5 text-[10px] font-black text-white hover:bg-purple-500"
                        >
                          🧪 Положить на базу
                        </button>
                      </div>
                    </div>
                  ) : depositMode === 'gold' ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-[9.5px] text-slate-300">
                        <span>Ваше золото: <strong className="text-amber-300">{hero.gold.toLocaleString('ru-RU')} 🪙</strong></span>
                        <span>В казне клана: <strong className="text-yellow-300">{(playerClan.treasuryGold || 0).toLocaleString('ru-RU')} 🪙</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">Сумма 🪙:</span>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, hero.gold)}
                          value={goldDepositAmount || ''}
                          onChange={(e) => setGoldDepositAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                          className="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-center text-[10px] font-bold text-amber-300"
                        />
                        <button
                          type="button"
                          onClick={() => handleDepositGold()}
                          className="flex-1 rounded bg-amber-600 py-1.5 text-[10px] font-black text-slate-950 hover:bg-amber-500 cursor-pointer"
                        >
                          🪙 Пополнить казну
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-[9.5px] text-slate-300">
                        <span>Ваши кристаллы: <strong className="text-cyan-300">{hero.crystals.toLocaleString('ru-RU')} 💎</strong></span>
                        <span>В казне клана: <strong className="text-cyan-200">{(playerClan.treasuryCrystals || 0).toLocaleString('ru-RU')} 💎</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">Сумма 💎:</span>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, hero.crystals)}
                          value={crystalDepositAmount || ''}
                          onChange={(e) => setCrystalDepositAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                          className="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-center text-[10px] font-bold text-cyan-300"
                        />
                        <button
                          type="button"
                          onClick={() => handleDepositCrystals()}
                          className="flex-1 rounded bg-cyan-600 py-1.5 text-[10px] font-black text-slate-950 hover:bg-cyan-500 cursor-pointer"
                        >
                          💎 Пополнить казну
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Storage Items List */}
              {playerClan.storage.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400">
                  <div className="text-2xl mb-1">🕸️</div>
                  <div className="text-[11px] font-bold text-slate-300">База клана пока пуста</div>
                  <div className="text-[9.5px] text-slate-500 mt-0.5">
                    Нажмите «+ Вещь», «🧪 Эликсиры» или создайте клановую вещь во вкладке «🛡️ Амуниция».
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {playerClan.storage.map((st) => {
                    const item = st.item;
                    const isElixir = st.itemType === 'elixir' || Boolean(st.elixirType);
                    const isClanCreated = Boolean(item.isClanCreated);
                    const q = getQualityConfig(item.quality);
                    const isMyOwnedItem =
                      !isClanCreated && st.originalOwnerNick.toLowerCase() === myNick.toLowerCase();
                    const isRentedByMe =
                      st.isRented && st.rentedByNick?.toLowerCase() === myNick.toLowerCase();

                    return (
                      <div
                        key={st.id}
                        className={`rounded-xl border p-2.5 transition-all ${
                          isElixir
                            ? 'border-purple-500/40 bg-purple-950/20'
                            : isClanCreated
                            ? 'border-amber-400/60 bg-slate-900/95 shadow-[0_0_12px_rgba(245,158,11,0.12)]'
                            : st.isRented
                            ? 'border-amber-500/40 bg-slate-900/90'
                            : 'border-emerald-500/40 bg-slate-900/95'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 p-1">
                            <ItemIcon icon={item.icon} name={item.name} slot={item.slot} modificationClass={item.modificationClass} className="text-2xl" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className="truncate text-[11px] font-black flex items-center gap-1"
                                style={{ color: q.color }}
                              >
                                <span className="truncate">{item.name}</span>
                                {!isElixir && Number(item.modificationClass || 0) > 0 && (
                                  <span className="text-amber-400 font-black text-[9px] shrink-0" title={`Модификация: ${item.modificationClass}/10 звёзд`}>
                                    {'⭐'.repeat(Math.min(10, Number(item.modificationClass)))}
                                  </span>
                                )}
                              </span>
                              {!isElixir && (
                                <div className="flex items-center gap-1 shrink-0">
                                  {isClanCreated && (
                                    <span className="rounded bg-amber-950 border border-amber-400/80 px-1.5 py-0.5 text-[7.5px] font-black text-amber-200">
                                      🏰 Клановая
                                    </span>
                                  )}
                                  {Number(item.modificationClass || 0) > 0 && (
                                    <span className="rounded bg-fuchsia-950 border border-fuchsia-400/70 px-1 py-[0.5px] text-[7.5px] font-black text-fuchsia-200">
                                      М{item.modificationClass}
                                    </span>
                                  )}
                                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[8.5px] font-bold text-slate-300">
                                    Ур. {item.lvl}
                                  </span>
                                </div>
                              )}
                            </div>

                            {isElixir ? (
                              <div className="mt-0.5 text-[9px] text-purple-300 font-bold">
                                🧪 Клановый запас эликсиров • Количество: {st.elixirQty || item.elixirQty || 1} шт.
                              </div>
                            ) : (
                              <>
                                <div className="mt-0.5 flex flex-wrap gap-2 text-[9px] text-slate-300">
                                  {item.dmg > 0 && <span>⚔️ +{item.dmg}</span>}
                                  {item.hp > 0 && <span>❤️ +{item.hp}</span>}
                                  {(item.str || 0) > 0 && <span>💪 +{item.str}</span>}
                                  {(item.agi || 0) > 0 && <span>💨 +{item.agi}</span>}
                                  {(item.vit || 0) > 0 && <span>🛡️ +{item.vit}</span>}
                                  {(item.energyBonus || 0) > 0 && <span>⚡ +{item.energyBonus}</span>}
                                  {(item.dodgeBonus || 0) > 0 && <span>💨 +{item.dodgeBonus}% укл.</span>}
                                  {(item.goldBonusPct || 0) > 0 && <span>💰 +{item.goldBonusPct}% зол.</span>}
                                  {(item.expBonusPct || 0) > 0 && <span>✨ +{item.expBonusPct}% опыта</span>}
                                  <span className="text-slate-400">
                                    🔧 {item.durability ?? 100}/{item.maxDurability ?? 100}
                                  </span>
                                </div>
                                {isClanCreated ? (
                                  <div className="mt-1 inline-flex items-center gap-1 rounded border border-amber-400/60 bg-amber-950/75 px-2 py-0.5 text-[8.5px] font-extrabold text-amber-200">
                                    🏰 Создано кланом {item.clanOwnerName || playerClan.name} и принадлежит клану
                                  </div>
                                ) : (
                                  <div className="mt-1 inline-flex items-center gap-1 rounded border border-cyan-500/40 bg-cyan-950/60 px-2 py-0.5 text-[8.5px] font-bold text-cyan-200">
                                    👤 Принадлежит игроку {item.ownerNick || item.creatorNick || st.originalOwnerNick}
                                  </div>
                                )}
                              </>
                            )}

                            {/* Owner & Rental Status Badges */}
                            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 border-t border-slate-800/80 pt-1.5">
                              <div className="text-[9px]">
                                {isClanCreated ? (
                                  <span className="text-amber-300 font-bold">
                                    👑 Собственность клана «{item.clanOwnerName || playerClan.name}» (только для соклановцев)
                                  </span>
                                ) : (
                                  <>
                                    <span className="text-slate-400">Положил: </span>
                                    <strong className={isMyOwnedItem ? 'text-amber-300' : 'text-slate-200'}>
                                      {st.originalOwnerNick} {isMyOwnedItem ? '(Вы)' : ''}
                                    </strong>
                                  </>
                                )}
                              </div>

                              {!isElixir && (
                                <div>
                                  {st.isRented ? (
                                    <span className="inline-flex items-center gap-1 rounded bg-red-500/20 border border-red-500/50 px-1.5 py-0.5 text-[8.5px] font-black text-red-300">
                                      🔴 У соклановца: {st.rentedByNick}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/50 px-1.5 py-0.5 text-[8.5px] font-black text-emerald-300">
                                      🟢 На складе клана
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {isElixir ? (
                                <button
                                  onClick={() => handleTakeElixir(st)}
                                  className="flex-1 rounded-md bg-purple-600 py-1 text-[9.5px] font-black text-white shadow hover:bg-purple-500"
                                >
                                  🧪 Взять себе ({st.elixirQty || 1} шт.)
                                </button>
                              ) : (
                                <>
                                  {!st.isRented && (
                                    <button
                                      onClick={() => handleRentItem(st)}
                                      className="flex-1 rounded-md bg-emerald-600 py-1 text-[9.5px] font-black text-white shadow hover:bg-emerald-500"
                                    >
                                      {isClanCreated ? '📥 Взять со склада клана' : '📥 Взять в аренду'}
                                    </button>
                                  )}

                                  {isRentedByMe && (
                                    <button
                                      onClick={() => handleReturnRentedItem(st)}
                                      className="flex-1 rounded-md border border-sky-400 bg-sky-700 py-1 text-[9.5px] font-black text-white shadow hover:bg-sky-600"
                                    >
                                      📤 Вернуть на склад клана
                                    </button>
                                  )}

                                  {!isClanCreated && (isMyOwnedItem || isAdmin) && (
                                    <button
                                      onClick={() => handleOwnerRecallItem(st)}
                                      className="flex-1 rounded-md border border-amber-400 bg-amber-600/90 py-1 text-[9.5px] font-black text-slate-950 shadow hover:bg-amber-500"
                                    >
                                      🔄 Забрать себе {st.isRented ? `(от ${st.rentedByNick})` : ''}
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 2.5: CLAN AMMUNITION & FORGE ("КЛАНОВАЯ КУЗНИЦА ВЕЩЕЙ И ТРАНСПОРТА") ==================== */}
          {playerClan && activeTab === 'ammunition' && (
            <div className="space-y-3">
              {/* Top Treasury & Rules Banner */}
              <div className="rounded-xl border-2 border-amber-500/60 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-3 shadow-lg space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <span>⚒️ Клановое создание вещей и транспорта (Внутри клана — плыть в Порт не нужно!)</span>
                    </h3>
                    <p className="text-[9.5px] text-slate-300 mt-0.5">
                      Клановая кузница расположена <strong className="text-emerald-300">прямо в вашем клане</strong> — отправляться на корабле в Порт для создания клановых вещей не требуется! Создать вещь или транспорт может <strong className="text-amber-300">исключительно глава клана ({playerClan.leaderNick})</strong> за счёт <strong className="text-cyan-300">клановой казны</strong>.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-lg border px-2.5 py-1 text-[9.5px] font-black ${
                        isLeader
                          ? 'border-emerald-400/70 bg-emerald-950/70 text-emerald-300'
                          : 'border-amber-500/50 bg-amber-950/50 text-amber-200'
                      }`}
                    >
                      {isLeader ? '👑 Вы — Глава клана (Крафт доступен)' : `🔒 Крафт только для главы (${playerClan.leaderNick})`}
                    </span>
                  </div>
                </div>

                {/* Clan Treasury Balances & Quick Deposit */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center bg-slate-950/90 border border-slate-800 rounded-lg p-2">
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <span className="text-[9.5px] text-slate-400">💎 Кристаллы казны:</span>
                    <span className="text-xs font-black text-cyan-300">
                      {(playerClan.treasuryCrystals || 0).toLocaleString('ru-RU')} 💎
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <span className="text-[9.5px] text-slate-400">🪙 Золото казны:</span>
                    <span className="text-xs font-black text-amber-300">
                      {(playerClan.treasuryGold || 0).toLocaleString('ru-RU')} 🪙
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('treasury');
                      }}
                      className="rounded border border-cyan-400/70 bg-cyan-950/80 px-2 py-1 text-[9px] font-black text-cyan-200 hover:bg-cyan-900"
                    >
                      + Пополнить 💎
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('treasury');
                      }}
                      className="rounded border border-amber-400/70 bg-amber-950/80 px-2 py-1 text-[9px] font-black text-amber-200 hover:bg-amber-900"
                    >
                      + Пополнить 🪙
                    </button>
                  </div>
                </div>

                {/* Rules Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[9px]">
                  <div className="rounded border border-slate-800 bg-slate-900/80 p-2">
                    <div className="font-black text-amber-300">🧱 Стартовый крафт (База)</div>
                    <div className="text-slate-300 mt-0.5">
                      Прочность: <b>1000/1000</b> • Базовые статы: <b>по 10</b> к каждому параметру • Базовая цена: <b>2 000 💎 + 50 000 🪙</b>
                    </div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-900/80 p-2">
                    <div className="font-black text-cyan-300">📈 Настройка статов и бонусов</div>
                    <div className="text-slate-300 mt-0.5">
                      За каждый <b>+1 стат</b> к характеристикам: <b>+700 💎</b> • За каждый <b>+1% бонуса</b>: <b>+10 000 🪙</b>
                    </div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-900/80 p-2">
                    <div className="font-black text-emerald-300">🛡️ Права и хранение</div>
                    <div className="text-slate-300 mt-0.5">
                      Отправляется на <b>склад клана</b>. Пользоваться могут <b>только соклановцы</b>. При выходе из клана вещь остается на складе.
                    </div>
                  </div>
                </div>
              </div>

              {/* Clan Forge Constructor */}
              <div className="rounded-xl border border-amber-500/40 bg-slate-900/95 p-3 space-y-3">
                {/* 1. Mode Switcher: Equipment vs Transport */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setClanForgeType('equipment');
                      setClanForgeSlot('weapon');
                      setClanForgeIcon(CLAN_FORGE_SLOT_ICONS.weapon[0]);
                    }}
                    className={`rounded-xl border p-2 text-left transition-all ${
                      clanForgeType === 'equipment'
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200 shadow'
                        : 'border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    <div className="text-[11px] font-black">⚔️ Клановая вещь (Оружие / Броня)</div>
                    <div className="text-[8.5px] opacity-80">Прочность 1000/1000 • Статы от 10</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClanForgeType('transport');
                      setClanForgeSlot('transport');
                      setClanForgeIcon(CLAN_FORGE_SLOT_ICONS.transport[0]);
                    }}
                    className={`rounded-xl border p-2 text-left transition-all ${
                      clanForgeType === 'transport'
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow'
                        : 'border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    <div className="text-[11px] font-black">🚁 Клановый транспорт</div>
                    <div className="text-[8.5px] opacity-80">Прочность 1000/1000 • Полёт в Порт 1 мин • Статы от 10</div>
                  </button>
                </div>

                {/* 2. Slot Selection (for Equipment) */}
                {clanForgeType === 'equipment' && (
                  <div>
                    <div className="text-[10px] font-bold text-amber-300 mb-1">Выберите тип клановой экипировки:</div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      {(['weapon', 'armor', 'pants', 'boots', 'gloves', 'ring'] as ItemSlot[]).map((sKey) => {
                        const sInfo = SLOT_INFO[sKey];
                        const active = clanForgeSlot === sKey;
                        return (
                          <button
                            key={sKey}
                            type="button"
                            onClick={() => {
                              setClanForgeSlot(sKey);
                              setClanForgeIcon(CLAN_FORGE_SLOT_ICONS[sKey][0]);
                            }}
                            className={`rounded-lg border px-2 py-2 text-[9.5px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                              active
                                ? 'border-amber-400 bg-amber-500/20 text-amber-200 shadow'
                                : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                            }`}
                          >
                            <div className="h-7 w-7 flex items-center justify-center">
                              <ItemIcon
                                icon={sInfo.icon}
                                name={sInfo.name}
                                slot={sKey}
                                imgClassName="w-full h-full object-contain"
                              />
                            </div>
                            <span className="truncate max-w-full">{sInfo.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Name & Icon Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-amber-300 block">
                      Название кланового предмета / транспорта:
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        maxLength={40}
                        value={clanForgeName}
                        onChange={(e) => setClanForgeName(e.target.value)}
                        placeholder={
                          clanForgeType === 'transport'
                            ? `Например: Крейсер клана ${playerClan.name}`
                            : `Например: Клинок клана ${playerClan.name}`
                        }
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[10.5px] font-bold text-white outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const sKey: ItemSlot = clanForgeType === 'transport' ? 'transport' : clanForgeSlot;
                          const pool = CLAN_RANDOM_ITEM_NAMES[sKey] || CLAN_RANDOM_ITEM_NAMES.weapon;
                          const picked = pool[Math.floor(Math.random() * pool.length)];
                          setClanForgeName(`${picked} [${playerClan.tag}]`);
                        }}
                        className="rounded-lg border border-amber-500/50 bg-amber-950/60 px-2.5 py-1.5 text-[10px] font-black text-amber-200 hover:bg-amber-900"
                        title="Сгенерировать название"
                      >
                        🎲 Авто
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-amber-300">Иконка / Картинка:</label>
                      <button
                        type="button"
                        onClick={() => clanForgeFileRef.current?.click()}
                        disabled={isUploadingForgeImg}
                        className="rounded border border-cyan-500/60 bg-cyan-950/70 px-2 py-0.5 text-[8.5px] font-black text-cyan-200 hover:bg-cyan-900"
                      >
                        {isUploadingForgeImg ? '⏳ Загрузка...' : '📁 Загрузить свою'}
                      </button>
                      <input
                        ref={clanForgeFileRef}
                        type="file"
                        accept="image/*"
                        onChange={handleClanForgeFileUpload}
                        className="hidden"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(CLAN_FORGE_SLOT_ICONS[clanForgeType === 'transport' ? 'transport' : clanForgeSlot] || []).map(
                        (ic, idx) => (
                          <button
                            key={`${ic}_${idx}`}
                            type="button"
                            onClick={() => setClanForgeIcon(ic)}
                            className={`h-8 w-8 rounded-lg border flex items-center justify-center p-0.5 ${
                              clanForgeIcon === ic
                                ? 'border-amber-400 bg-amber-500/20'
                                : 'border-slate-800 bg-slate-950'
                            }`}
                          >
                            <ItemIcon icon={ic} name="icon" slot={clanForgeType === 'transport' ? 'transport' : clanForgeSlot} className="text-base" />
                          </button>
                        )
                      )}
                    </div>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={clanForgeCustomUrl}
                        onChange={(e) => setClanForgeCustomUrl(e.target.value)}
                        placeholder="Или URL картинки (https://...)"
                        className="flex-1 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[9px] text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (clanForgeCustomUrl.trim()) {
                            setClanForgeIcon(clanForgeCustomUrl.trim());
                            showToast('✅ Ссылка на картинку применена!');
                          }
                        }}
                        className="rounded bg-slate-800 px-2 py-1 text-[9px] font-bold text-amber-300 hover:bg-slate-700"
                      >
                        ОК
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4. Base Stats & Customization (+700 Crystals per +1 stat above 10) */}
                <div className="rounded-xl border border-cyan-500/40 bg-slate-950/90 p-2.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-800 pb-1.5">
                    <div>
                      <div className="text-[10.5px] font-black text-cyan-300">
                        ⚔️ Характеристики предмета (База: по 10 • Доп. +1 стат = +700 💎)
                      </div>
                      <div className="text-[8.5px] text-slate-400">
                        Начальная прочность фиксирована: <strong className="text-emerald-300">1000 / 1000</strong>. Добавлено доп. статов: <strong className="text-cyan-300">+{totalExtraStats}</strong> (+{extraForgeCrystals.toLocaleString('ru-RU')} 💎)
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCfDmg(10);
                        setCfHp(10);
                        setCfStr(10);
                        setCfAgi(10);
                        setCfVit(10);
                        setCfEnergy(10);
                      }}
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[8.5px] font-bold text-slate-300 hover:text-white"
                    >
                      🔄 Сбросить статы к 10
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { label: '⚔️ Урон', val: cfDmg, setVal: setCfDmg, extra: extraDmg, color: 'text-red-400' },
                      { label: '❤️ Здоровье (HP)', val: cfHp, setVal: setCfHp, extra: extraHp, color: 'text-emerald-400' },
                      { label: '💪 Сила', val: cfStr, setVal: setCfStr, extra: extraStr, color: 'text-orange-400' },
                      { label: '💨 Ловкость', val: cfAgi, setVal: setCfAgi, extra: extraAgi, color: 'text-sky-300' },
                      { label: '🛡️ Живучесть', val: cfVit, setVal: setCfVit, extra: extraVit, color: 'text-emerald-300' },
                      { label: '⚡ Энергия', val: cfEnergy, setVal: setCfEnergy, extra: extraEnergy, color: 'text-cyan-300' }
                    ].map((statCfg) => (
                      <div key={statCfg.label} className="rounded-lg border border-slate-800 bg-slate-900/90 p-2 space-y-1">
                        <div className="flex items-center justify-between text-[9.5px]">
                          <span className={`font-black ${statCfg.color}`}>{statCfg.label}:</span>
                          <span className="font-black text-white">
                            {(10 + statCfg.extra).toLocaleString('ru-RU')}
                            {statCfg.extra > 0 && (
                              <span className="ml-1 text-[8.5px] text-cyan-300">
                                (+{statCfg.extra} стат = +{(statCfg.extra * 700).toLocaleString('ru-RU')} 💎)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => statCfg.setVal(Math.max(10, statCfg.val - 1))}
                            className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-[9.5px] font-black text-slate-300 hover:bg-slate-800"
                          >
                            -1
                          </button>
                          <input
                            type="number"
                            min={10}
                            max={1000000}
                            value={statCfg.val}
                            onChange={(e) => statCfg.setVal(Math.max(10, Math.floor(Number(e.target.value) || 10)))}
                            className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-center text-[10px] font-black text-amber-300"
                          />
                          <button
                            type="button"
                            onClick={() => statCfg.setVal(statCfg.val + 1)}
                            className="rounded border border-cyan-500/50 bg-cyan-950/70 px-2 py-0.5 text-[9.5px] font-black text-cyan-200 hover:bg-cyan-900"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => statCfg.setVal(statCfg.val + 10)}
                            className="rounded border border-cyan-500/50 bg-cyan-950/70 px-2 py-0.5 text-[9.5px] font-black text-cyan-200 hover:bg-cyan-900"
                          >
                            +10
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Percentage Bonuses (+10,000 Gold per +1% bonus) */}
                <div className="rounded-xl border border-amber-500/40 bg-slate-950/90 p-2.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-800 pb-1.5">
                    <div>
                      <div className="text-[10.5px] font-black text-amber-300">
                        ✨ Процентные бонусы (За каждый +1% бонуса = +10 000 🪙 золота)
                      </div>
                      <div className="text-[8.5px] text-slate-400">
                        Добавлено бонусов: <strong className="text-amber-300">+{totalExtraBonusPct}%</strong> (+{extraForgeGold.toLocaleString('ru-RU')} 🪙 золота)
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCfDodgePct(0);
                        setCfGoldPct(0);
                        setCfExpPct(0);
                      }}
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[8.5px] font-bold text-slate-300 hover:text-white"
                    >
                      🔄 Сбросить % к 0%
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { label: '💨 Уклонение (%)', val: safeDodgePct, setVal: setCfDodgePct, max: 50, color: 'text-sky-300' },
                      { label: '💰 Бонус золота (%)', val: safeGoldPct, setVal: setCfGoldPct, max: 100, color: 'text-yellow-300' },
                      { label: '✨ Бонус опыта (%)', val: safeExpPct, setVal: setCfExpPct, max: 100, color: 'text-purple-300' }
                    ].map((pctCfg) => (
                      <div key={pctCfg.label} className="rounded-lg border border-slate-800 bg-slate-900/90 p-2 space-y-1">
                        <div className="flex items-center justify-between text-[9.5px]">
                          <span className={`font-black ${pctCfg.color}`}>{pctCfg.label}:</span>
                          <span className="font-black text-white">+{pctCfg.val}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={pctCfg.max}
                          step={1}
                          value={pctCfg.val}
                          onChange={(e) => pctCfg.setVal(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full accent-amber-400 cursor-pointer"
                        />
                        <div className="flex items-center justify-between text-[8.5px] text-slate-400">
                          <span>0%</span>
                          <span className="text-amber-300 font-bold">
                            +{(pctCfg.val * 10000).toLocaleString('ru-RU')} 🪙
                          </span>
                          <span>{pctCfg.max}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. Item Preview Card with Clan Ownership Text */}
                <div className="rounded-xl border border-amber-400/60 bg-slate-950 p-2.5 space-y-1.5">
                  <div className="text-[9.5px] font-black uppercase tracking-wider text-amber-400">
                    👁️ Предпросмотр кланового предмета (отправится на склад клана):
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-amber-500/50 bg-slate-900 p-1">
                      <ItemIcon
                        icon={clanForgeIcon}
                        name={clanForgeName || 'Клановый предмет'}
                        slot={clanForgeType === 'transport' ? 'transport' : clanForgeSlot}
                        className="text-2xl"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-black text-cyan-300">
                          {clanForgeName.trim() ||
                            (clanForgeType === 'transport'
                              ? `Крейсер клана ${playerClan.name}`
                              : `Предмет клана ${playerClan.name}`)}
                        </span>
                        <span className="rounded bg-amber-950 border border-amber-400/70 px-1.5 py-0.5 text-[8.5px] font-black text-amber-200">
                          🔧 Прочность: 1000/1000
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] font-bold text-slate-200">
                        <span className="text-red-400">⚔️ +{(10 + extraDmg).toLocaleString('ru-RU')}</span>
                        <span className="text-emerald-400">❤️ +{(10 + extraHp).toLocaleString('ru-RU')}</span>
                        <span className="text-orange-400">💪 +{(10 + extraStr).toLocaleString('ru-RU')}</span>
                        <span className="text-sky-300">💨 +{(10 + extraAgi).toLocaleString('ru-RU')}</span>
                        <span className="text-emerald-300">🛡️ +{(10 + extraVit).toLocaleString('ru-RU')}</span>
                        <span className="text-cyan-300">⚡ +{(10 + extraEnergy).toLocaleString('ru-RU')}</span>
                        {safeDodgePct > 0 && <span className="text-sky-400">💨 +{safeDodgePct}% укл.</span>}
                        {safeGoldPct > 0 && <span className="text-yellow-400">💰 +{safeGoldPct}% зол.</span>}
                        {safeExpPct > 0 && <span className="text-purple-400">✨ +{safeExpPct}% опыта</span>}
                      </div>
                      <div className="mt-1.5 inline-flex items-center gap-1 rounded border border-amber-400/70 bg-amber-950/80 px-2 py-0.5 text-[9.5px] font-extrabold text-amber-200">
                        🏰 Создано кланом {playerClan.name} и принадлежит клану
                      </div>
                    </div>
                  </div>
                </div>

                {/* 7. Dynamic Total Cost Calculation & Confirm Button at Bottom */}
                <div className="rounded-xl border-2 border-amber-400 bg-gradient-to-b from-amber-950/40 to-slate-950 p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-bold text-slate-300">
                        Базовая стоимость: <b className="text-cyan-300">2 000 💎</b> и <b className="text-amber-300">50 000 🪙</b>
                      </div>
                      <div className="text-[9.5px] text-slate-400">
                        Наценка за статы (+{totalExtraStats} × 700 💎): <b className="text-cyan-300">+{extraForgeCrystals.toLocaleString('ru-RU')} 💎</b> • Наценка за % (+{totalExtraBonusPct}% × 10 000 🪙): <b className="text-amber-300">+{extraForgeGold.toLocaleString('ru-RU')} 🪙</b>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9.5px] uppercase font-black text-amber-200">Итоговая цена создания (из казны):</div>
                      <div className="text-sm font-black flex items-center justify-end gap-2">
                        <span
                          className={
                            (playerClan.treasuryCrystals || 0) >= totalClanForgeCrystals
                              ? 'text-cyan-300'
                              : 'text-red-400'
                          }
                        >
                          💎 {totalClanForgeCrystals.toLocaleString('ru-RU')}
                        </span>
                        <span className="text-slate-500">+</span>
                        <span
                          className={
                            (playerClan.treasuryGold || 0) >= totalClanForgeGold
                              ? 'text-amber-300'
                              : 'text-red-400'
                          }
                        >
                          🪙 {totalClanForgeGold.toLocaleString('ru-RU')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleForgeClanItem}
                    disabled={!isLeader}
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg hover:brightness-110 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isLeader
                      ? `⚒️ Создать за ${totalClanForgeCrystals.toLocaleString('ru-RU')} 💎 и ${totalClanForgeGold.toLocaleString('ru-RU')} 🪙 (На склад клана)`
                      : `🔒 Создать вещь может только глава клана (${playerClan.leaderNick})`}
                  </button>
                </div>
              </div>

              {/* List of Clan-Created Items currently in Clan Storage */}
              {(() => {
                const clanForgedItems = playerClan.storage.filter((st) => st.item.isClanCreated);
                if (clanForgedItems.length === 0) return null;
                return (
                  <div className="rounded-xl border border-amber-500/40 bg-slate-900/90 p-2.5 space-y-2">
                    <div className="text-[10.5px] font-black text-amber-300">
                      🏰 Созданные вещи и транспорт клана ({clanForgedItems.length} шт. на складе):
                    </div>
                    <div className="space-y-1.5">
                      {clanForgedItems.map((st) => {
                        const isRentedByMe =
                          st.isRented && st.rentedByNick?.toLowerCase() === myNick.toLowerCase();
                        return (
                          <div
                            key={st.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-slate-950 p-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-amber-500/40 bg-slate-900 p-1">
                                <ItemIcon icon={st.item.icon} name={st.item.name} slot={st.item.slot} className="text-lg" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[10.5px] font-black text-amber-200 truncate">
                                  {st.item.name}
                                </div>
                                <div className="text-[8.5px] text-amber-300/90 font-bold">
                                  🏰 Создано кланом {st.item.clanOwnerName || playerClan.name} и принадлежит клану
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {!st.isRented ? (
                                <button
                                  type="button"
                                  onClick={() => handleRentItem(st)}
                                  className="rounded bg-emerald-600 px-2.5 py-1 text-[9px] font-black text-white hover:bg-emerald-500"
                                >
                                  📥 Взять со склада
                                </button>
                              ) : isRentedByMe ? (
                                <button
                                  type="button"
                                  onClick={() => handleReturnRentedItem(st)}
                                  className="rounded bg-sky-600 px-2.5 py-1 text-[9px] font-black text-white hover:bg-sky-500"
                                >
                                  📤 Вернуть на склад
                                </button>
                              ) : (
                                <span className="rounded bg-red-950/80 border border-red-500/40 px-2 py-0.5 text-[8.5px] font-bold text-red-300">
                                  🔴 У соклановца: {st.rentedByNick}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* ==================== TAB 2.8: CLAN ACHIEVEMENTS ("КЛАНОВЫЕ ДОСТИЖЕНИЯ") ==================== */}
            </div>
          )}

          {playerClan && activeTab === 'achievements' && (
            <div className="space-y-3">
              <div className="rounded-xl border-2 border-emerald-500/60 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-3 shadow-lg space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                      <span>🏆 Совместные клановые достижения [{playerClan.tag}]</span>
                    </h3>
                    <p className="text-[9.5px] text-slate-300 mt-0.5">
                      Все участники клана совместно выполняют испытания. Каждое открытое достижение навсегда увеличивает <strong className="text-purple-300">получаемый опыт (+% EXP)</strong> и <strong className="text-amber-300">добычу золота (+% 🪙)</strong> для всей группы!
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-400/70 bg-emerald-950/70 px-2.5 py-1 text-[10px] font-black text-emerald-200">
                    Выполнено: {clanAchStatus.completedCount} / {clanAchStatus.totalCount}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-purple-500/40 bg-slate-950/90 p-2 flex items-center justify-between">
                    <span className="text-[9.5px] font-bold text-slate-300">✨ Групповой бонус опыта:</span>
                    <span className="text-xs font-black text-purple-300">
                      +{clanAchStatus.totalExpBonusPct}% EXP
                    </span>
                  </div>
                  <div className="rounded-lg border border-amber-500/40 bg-slate-950/90 p-2 flex items-center justify-between">
                    <span className="text-[9.5px] font-bold text-slate-300">🪙 Групповой бонус золота:</span>
                    <span className="text-xs font-black text-amber-300">
                      +{clanAchStatus.totalGoldBonusPct}% 🪙
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {clanAchStatus.achievements.map((ach) => (
                  <div
                    key={ach.id}
                    className={`rounded-xl border p-2.5 transition-all ${
                      ach.isCompleted
                        ? 'border-emerald-400/70 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                        : 'border-slate-800 bg-slate-900/90'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-2xl ${
                          ach.isCompleted
                            ? 'border-emerald-400 bg-emerald-950/70 shadow'
                            : 'border-slate-700 bg-slate-950'
                        }`}
                      >
                        {ach.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-black text-white">{ach.title}</span>
                            {ach.isCompleted ? (
                              <span className="rounded bg-emerald-500/20 border border-emerald-400 px-1.5 py-0.5 text-[8px] font-black text-emerald-300">
                                ✅ ВЫПОЛНЕНО
                              </span>
                            ) : (
                              <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[8px] font-bold text-slate-400">
                                В процессе ({ach.progressPct}%)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[8.5px] font-black">
                            <span className="rounded bg-purple-950 border border-purple-400/60 px-1.5 py-0.5 text-purple-200">
                              ✨ +{ach.expBonusPct}% EXP группе
                            </span>
                            <span className="rounded bg-amber-950 border border-amber-400/60 px-1.5 py-0.5 text-amber-200">
                              🪙 +{ach.goldBonusPct}% золота группе
                            </span>
                          </div>
                        </div>

                        <p className="mt-0.5 text-[9.5px] text-slate-300">{ach.description}</p>

                        <div className="mt-1.5">
                          <div className="flex items-center justify-between text-[8.5px] font-bold text-slate-400 mb-0.5">
                            <span>Совместный прогресс клана:</span>
                            <span className={ach.isCompleted ? 'text-emerald-300 font-black' : 'text-amber-300'}>
                              {ach.currentValue.toLocaleString('ru-RU')} / {ach.target.toLocaleString('ru-RU')} {ach.unitLabel}
                            </span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                            <div
                              className={`h-full transition-all ${
                                ach.isCompleted
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                  : 'bg-gradient-to-r from-amber-600 to-yellow-400'
                              }`}
                              style={{ width: `${ach.progressPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== TAB 3: MEMBERS ==================== */}
          {playerClan && activeTab === 'members' && (
            <div className="space-y-2.5">
              <ClanSyndicateGwarsView
                clan={playerClan}
                myNick={myNick}
                hero={hero}
                isAdmin={isAdmin}
                forcedSection="roster_permissions"
                onUpdateHero={onUpdateHero}
                showToast={showToast}
                triggerRefresh={triggerRefresh}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5 text-[10px] text-slate-400 font-bold">
                <span>
                  Участники клана ({playerClan.members.length}) • 🛡️ Выдача «Знака клана» стоит <strong>1 000 🪙</strong> (дает право на бои 7х7 за объекты Порта)
                </span>
                <button
                  onClick={handleLeaveClan}
                  className="rounded border border-red-500/60 bg-red-950/70 px-2 py-0.5 text-[9px] font-extrabold text-red-200 hover:bg-red-900"
                >
                  🚪 Выйти из клана
                </button>
              </div>

              <div className="space-y-1.5">
                {playerClan.members.map((m) => {
                  const isMe = m.nick.toLowerCase() === myNick.toLowerCase();
                  const memberHasBadge =
                    Boolean(m.hasClanBadge) ||
                    m.role === 'leader' ||
                    m.nick.trim().toLowerCase() === playerClan.leaderNick.trim().toLowerCase();
                  const roleLabel =
                    m.role === 'leader'
                      ? '👑 Глава'
                      : m.role === 'officer'
                      ? '⭐ Офицер'
                      : '⚔️ Воин';

                  return (
                    <div
                      key={m.nick}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5"
                    >
                      <div
                        onClick={() => onInspectPlayer && onInspectPlayer(m.nick)}
                        className="flex items-center gap-2 cursor-pointer group"
                        title="Нажмите для осмотра профиля (экипировка, коллекция, баланс, протокол)"
                      >
                        <CharacterAvatar avatar={m.avatar || '🧙‍♂️'} nick={m.nick} size="xs" />
                        <div>
                          <div className="flex items-center gap-1 font-bold text-white text-[10.5px] group-hover:text-amber-300 transition-colors flex-wrap">
                            <ClanRankEpaulette rankLevel={m.rankLevel || 1} size="sm" />
                            <span>{m.nick}</span>
                            {isMe && <span className="text-[8px] text-amber-400">(Вы)</span>}
                            <span
                              className={`rounded border px-1.5 py-0.2 text-[8px] font-black ${
                                memberHasBadge
                                  ? 'border-emerald-400/60 bg-emerald-950/80 text-emerald-300'
                                  : 'border-slate-700 bg-slate-950 text-slate-400'
                              }`}
                            >
                              {memberHasBadge ? `🛡️ Знак [${playerClan.tag}]` : '⚪ Нет знака'}
                            </span>
                            <span className="text-[8px] text-slate-400 font-mono">
                              PTS: {(m.clanPts || 0).toLocaleString('ru-RU')}
                            </span>
                            <span className="text-[8px] text-slate-500 opacity-80">🔍</span>
                          </div>
                          <div className="text-[8.5px] text-slate-400">
                            {m.lvl} ур. • Вклад: ✨{m.contributionExp || 0} EXP / ⭐{m.contributionInfluence || 0}
                          </div>
                          <div className="text-[8px] flex items-center gap-1 font-medium mt-0.5">
                            <span className="text-slate-500">🕒 В сети:</span>
                            <span className={m.isOnline ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                              {formatLastSeen(m.lastSeen, m.isOnline)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-slate-950 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-300 border border-slate-700">
                          {roleLabel}
                        </span>

                        {(isLeader || isAdmin) && !memberHasBadge && (
                          <button
                            type="button"
                            onClick={() => handleIssueClanBadge(m.nick)}
                            className="rounded bg-gradient-to-r from-emerald-600 to-amber-500 px-2 py-0.5 text-[8px] font-black text-slate-950 shadow hover:brightness-110 cursor-pointer"
                            title={`Выдать официальный Знак клана игроку ${m.nick} за 1 000 золота`}
                          >
                            🛡️ Выдать Знак (1 000 🪙)
                          </button>
                        )}

                        {(isLeader || isAdmin) && !isMe && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTransferLeadership(m.nick)}
                              className="rounded bg-amber-950 border border-amber-400/60 px-2 py-0.5 text-[8px] font-black text-amber-200 hover:bg-amber-800 hover:text-white"
                              title={`Передать права Главы клана игроку ${m.nick}`}
                            >
                              👑 Передать клан
                            </button>
                            <button
                              type="button"
                              onClick={() => handleKick(m.nick)}
                              className="rounded bg-red-950 border border-red-500/40 px-1.5 py-0.5 text-[8px] font-bold text-red-300 hover:bg-red-800 hover:text-white"
                            >
                              Исключить
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== TAB 3.5: CLAN LOGS ("ЛОГИ КЛАНА") ==================== */}
          {playerClan && activeTab === 'logs' && (
            <div className="space-y-2.5">
              <div className="rounded-xl border border-amber-500/40 bg-slate-900/95 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black text-amber-300">
                      📜 Логи клана [{playerClan.tag}]
                    </h3>
                    <p className="text-[9px] text-slate-400">
                      История событий клана: вступления, выходы, пополнения базы (золото/кристаллы/вещи/эликсиры), клановый крафт и взятие предметов. Синхронизировано с Supabase.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSyncingLogs}
                    onClick={async () => {
                      setIsSyncingLogs(true);
                      await syncClansFromSupabase();
                      setIsSyncingLogs(false);
                      triggerRefresh();
                      showToast('🔄 Логи клана обновлены из облака!');
                    }}
                    className="shrink-0 rounded-lg border border-sky-500/60 bg-sky-950/70 px-2.5 py-1 text-[9px] font-extrabold text-sky-200 hover:bg-sky-900 disabled:opacity-50"
                  >
                    {isSyncingLogs ? '⏳ Синхр...' : '🔄 Обновить'}
                  </button>
                </div>

                {/* Filter pills */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {[
                    { key: 'all' as const, label: '📋 Все' },
                    { key: 'members' as const, label: '👥 Состав (вход/выход)' },
                    { key: 'deposits' as const, label: '📥 Пополнения и Крафт' },
                    { key: 'withdrawals' as const, label: '📤 Взятие / Возврат' }
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setLogFilter(f.key)}
                      className={`rounded-md px-2 py-1 text-[9px] font-bold transition-colors ${
                        logFilter === f.key
                          ? 'border border-amber-400 bg-amber-500/20 text-amber-300'
                          : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const rawLogs: ClanLogEntry[] = Array.isArray(playerClan.logs) ? playerClan.logs : [];
                const filteredLogs = rawLogs.filter((entry) => {
                  if (logFilter === 'members') {
                    return (
                      entry.type === 'create' ||
                      entry.type === 'join' ||
                      entry.type === 'leave' ||
                      entry.type === 'kick'
                    );
                  }
                  if (logFilter === 'deposits') {
                    return (
                      entry.type === 'deposit_gold' ||
                      entry.type === 'deposit_crystals' ||
                      entry.type === 'forge_clan_item' ||
                      entry.type === 'deposit_item' ||
                      entry.type === 'deposit_elixir'
                    );
                  }
                  if (logFilter === 'withdrawals') {
                    return (
                      entry.type === 'rent_item' ||
                      entry.type === 'return_item' ||
                      entry.type === 'recall_item' ||
                      entry.type === 'take_elixir'
                    );
                  }
                  return true;
                });

                if (filteredLogs.length === 0) {
                  return (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center">
                      <div className="text-2xl mb-1">📜</div>
                      <div className="text-[11px] font-bold text-slate-300">
                        Записей в логах пока нет
                      </div>
                      <div className="text-[9.5px] text-slate-500 mt-0.5">
                        Все действия участников (вступление, выход, пополнение базы золотом, кристаллами, вещами или эликсирами, клановый крафт и взятие предметов) будут автоматически сохраняться здесь.
                      </div>
                    </div>
                  );
                }

                const getBadgeConfig = (type: ClanLogEntry['type']) => {
                  switch (type) {
                    case 'create':
                      return {
                        label: 'Основание',
                        badgeClass: 'bg-amber-500/20 border-amber-400/60 text-amber-300',
                        rowBorder: 'border-amber-500/30'
                      };
                    case 'join':
                      return {
                        label: 'Вступил',
                        badgeClass: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300',
                        rowBorder: 'border-emerald-500/30'
                      };
                    case 'leave':
                      return {
                        label: 'Вышел',
                        badgeClass: 'bg-red-500/20 border-red-400/60 text-red-300',
                        rowBorder: 'border-red-500/30'
                      };
                    case 'kick':
                      return {
                        label: 'Исключен',
                        badgeClass: 'bg-rose-500/20 border-rose-400/60 text-rose-300',
                        rowBorder: 'border-rose-500/30'
                      };
                    case 'transfer_leader':
                      return {
                        label: 'Передача клана',
                        badgeClass: 'bg-amber-500/25 border-amber-400 text-amber-200',
                        rowBorder: 'border-amber-400/50'
                      };
                    case 'achievement_unlocked':
                      return {
                        label: 'Достижение',
                        badgeClass: 'bg-emerald-500/25 border-emerald-400 text-emerald-200',
                        rowBorder: 'border-emerald-400/50'
                      };
                    case 'deposit_gold':
                      return {
                        label: 'Золото в казну',
                        badgeClass: 'bg-yellow-500/20 border-yellow-400/60 text-yellow-300',
                        rowBorder: 'border-yellow-500/30'
                      };
                    case 'deposit_crystals':
                      return {
                        label: 'Кристаллы в казну',
                        badgeClass: 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300',
                        rowBorder: 'border-cyan-500/30'
                      };
                    case 'forge_clan_item':
                      return {
                        label: 'Клановый крафт',
                        badgeClass: 'bg-amber-500/25 border-amber-400 text-amber-200',
                        rowBorder: 'border-amber-400/50'
                      };
                    case 'deposit_item':
                      return {
                        label: 'Положил вещь',
                        badgeClass: 'bg-teal-500/20 border-teal-400/60 text-teal-300',
                        rowBorder: 'border-teal-500/30'
                      };
                    case 'deposit_elixir':
                      return {
                        label: 'Положил эликсир',
                        badgeClass: 'bg-purple-500/20 border-purple-400/60 text-purple-300',
                        rowBorder: 'border-purple-500/30'
                      };
                    case 'rent_item':
                      return {
                        label: 'Взял вещь',
                        badgeClass: 'bg-orange-500/20 border-orange-400/60 text-orange-300',
                        rowBorder: 'border-orange-500/30'
                      };
                    case 'take_elixir':
                      return {
                        label: 'Взял эликсир',
                        badgeClass: 'bg-fuchsia-500/20 border-fuchsia-400/60 text-fuchsia-300',
                        rowBorder: 'border-fuchsia-500/30'
                      };
                    case 'return_item':
                      return {
                        label: 'Вернул вещь',
                        badgeClass: 'bg-sky-500/20 border-sky-400/60 text-sky-300',
                        rowBorder: 'border-sky-500/30'
                      };
                    case 'recall_item':
                      return {
                        label: 'Забрал своё',
                        badgeClass: 'bg-amber-500/20 border-amber-400/60 text-amber-200',
                        rowBorder: 'border-amber-500/30'
                      };
                    case 'declare_war':
                    case 'capture_territory':
                      return {
                        label: 'Война территорий',
                        badgeClass: 'bg-red-500/20 border-red-400/60 text-red-200',
                        rowBorder: 'border-red-500/30'
                      };
                    case 'raid_boss_kill':
                      return {
                        label: 'Рейд Босса',
                        badgeClass: 'bg-orange-500/20 border-orange-400/60 text-orange-200',
                        rowBorder: 'border-orange-500/30'
                      };
                    case 'clan_quest_claim':
                      return {
                        label: 'Задание клана',
                        badgeClass: 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200',
                        rowBorder: 'border-cyan-500/30'
                      };
                    case 'arena_victory':
                      return {
                        label: 'Арена Чемпионов',
                        badgeClass: 'bg-fuchsia-500/20 border-fuchsia-400/60 text-fuchsia-200',
                        rowBorder: 'border-fuchsia-500/30'
                      };
                    default:
                      return {
                        label: 'Событие',
                        badgeClass: 'bg-slate-700 border-slate-600 text-slate-300',
                        rowBorder: 'border-slate-800'
                      };
                  }
                };

                return (
                  <div className="space-y-1.5">
                    {filteredLogs.map((log, idx) => {
                      const cfg = getBadgeConfig(log.type);
                      return (
                        <div
                          key={`${log.id}_${idx}`}
                          className={`flex items-start gap-2.5 rounded-xl border bg-slate-900/90 px-2.5 py-2 ${cfg.rowBorder}`}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-base">
                            <ItemIcon icon={log.icon || '📜'} name={log.text} className="text-base" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10.5px] font-black text-white">
                                  {log.actorNick}
                                </span>
                                <span
                                  className={`rounded border px-1.5 py-0.2 text-[8px] font-extrabold ${cfg.badgeClass}`}
                                >
                                  {cfg.label}
                                </span>
                              </div>
                              <span className="text-[8.5px] font-mono text-slate-400 shrink-0">
                                🕒 {log.timeStr}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[9.5px] text-slate-200 break-words">
                              {log.text}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ==================== TAB: TERRITORY WARS ==================== */}
          {activeTab === 'territories' && (
            <ClanTerritoryWarsView
              clan={playerClan}
              myNick={myNick}
              hero={hero}
              inventory={inventory}
              equipped={equipped}
              initialSectorId={initialSectorId}
              onUpdateHero={onUpdateHero}
              onUpdateInventory={onUpdateInventory}
              showToast={showToast}
              triggerRefresh={triggerRefresh}
              requestConfirm={requestConfirm}
            />
          )}

          {/* ==================== TAB: DAILY CLAN RAID BOSS ==================== */}
          {playerClan && activeTab === 'raid' && (
            <ClanRaidBossView
              clan={playerClan}
              myNick={myNick}
              hero={hero}
              inventory={inventory}
              equipped={equipped}
              onUpdateHero={onUpdateHero}
              onUpdateInventory={onUpdateInventory}
              showToast={showToast}
              triggerRefresh={triggerRefresh}
              requestConfirm={requestConfirm}
            />
          )}

          {/* ==================== TAB: CLAN DAILY QUESTS ==================== */}
          {playerClan && activeTab === 'quests' && (
            <ClanQuestsView
              clan={playerClan}
              myNick={myNick}
              hero={hero}
              inventory={inventory}
              equipped={equipped}
              onUpdateHero={onUpdateHero}
              onUpdateInventory={onUpdateInventory}
              showToast={showToast}
              triggerRefresh={triggerRefresh}
              requestConfirm={requestConfirm}
            />
          )}

          {/* ==================== TAB: CLAN CHAMPIONS ARENA ==================== */}
          {activeTab === 'arena' && (
            <ClanChampionsArenaView
              clan={playerClan}
              myNick={myNick}
              hero={hero}
              inventory={inventory}
              equipped={equipped}
              onUpdateHero={onUpdateHero}
              onUpdateInventory={onUpdateInventory}
              showToast={showToast}
              triggerRefresh={triggerRefresh}
              requestConfirm={requestConfirm}
            />
          )}

          {/* ==================== TAB 4: ALL CLANS LIST ==================== */}
          {activeTab === 'clansList' && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="🔍 Поиск клана по названию или тегу..."
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] text-white outline-none focus:border-amber-400"
                />
                {!playerClan && (
                  <button
                    onClick={() => setActiveTab('create')}
                    className="rounded-lg border border-cyan-400 bg-cyan-900/60 px-2.5 py-1.5 text-[10px] font-black text-cyan-200 hover:bg-cyan-800 shrink-0"
                  >
                    + Создать клан
                  </button>
                )}
              </div>

              {allClans.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center">
                  <div className="text-2xl mb-1">🏰</div>
                  <div className="text-xs font-bold text-slate-300">Пока не создано ни одного клана</div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Станьте первым основателем клана за {CLAN_CREATION_COST_CRYSTALS} 💎 и захватите Клановую Пирамиду!
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {allClans
                    .filter(
                      (c) =>
                        !searchFilter.trim() ||
                        c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                        c.tag.toLowerCase().includes(searchFilter.toLowerCase())
                    )
                    .map((clan) => {
                      const isControlling = pyramidState.controlledByClanId === clan.id;
                      const isMyCurrentClan = playerClan?.id === clan.id;
                      const clanCap = getClanMaxStorageCapacity(clan);

                      return (
                        <div
                          key={clan.id}
                          className={`rounded-xl border p-2.5 transition-all ${
                            isControlling
                              ? 'border-amber-400 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                              : 'border-slate-800 bg-slate-900/90'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {renderClanEmblem(clan.emblem, 'h-12 w-12 text-2xl')}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="rounded bg-amber-500/20 border border-amber-400/70 px-1 py-0.2 text-[8.5px] font-black text-amber-300">
                                    [{clan.tag}]
                                  </span>
                                  <span className="truncate text-xs font-black text-white">
                                    {clan.name}
                                  </span>
                                  {isControlling && (
                                    <span title="Владелец Клановой Пирамиды" className="text-xs">
                                      👑
                                    </span>
                                  )}
                                </div>
                                <div className="text-[9px] text-slate-400 truncate mt-0.5">
                                  {clan.description}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2 text-[8.5px] text-slate-400">
                                  <span>🆙 Ур.: <strong className="text-purple-300">{clan.level}/20</strong></span>
                                  <span>👥 <strong className="text-white">{clan.members.length}</strong></span>
                                  <span>📦 База: <strong className="text-emerald-300">{clan.storage.length}/{clanCap}</strong></span>
                                  <span>⭐ <strong className="text-amber-300">{clan.influencePoints}</strong></span>
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {isMyCurrentClan ? (
                                <span className="rounded bg-amber-500/20 border border-amber-400 px-2 py-1 text-[9px] font-black text-amber-300">
                                  Ваш клан
                                </span>
                              ) : !playerClan ? (
                                clan.isOpen ? (
                                  <button
                                    onClick={() => handleJoinClan(clan)}
                                    disabled={hero.level < (clan.joinMinLvl || 1)}
                                    className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[9.5px] font-black text-white shadow hover:bg-emerald-500 disabled:opacity-40"
                                  >
                                    Вступить {clan.joinMinLvl > 1 ? `(${clan.joinMinLvl}+ ур.)` : ''}
                                  </button>
                                ) : (
                                  <span className="rounded bg-slate-800 px-2 py-1 text-[8.5px] text-slate-500">
                                    🔒 Закрыт
                                  </span>
                                )
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 5: CREATE CLAN (1000 CRYSTALS) ==================== */}
          {!playerClan && activeTab === 'create' && (
            <div className="space-y-3 rounded-xl border border-cyan-500/40 bg-slate-900/95 p-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h3 className="text-xs font-black text-cyan-300 uppercase">
                    ✨ Основание Нового Клана
                  </h3>
                  <p className="text-[9px] text-slate-400">
                    Стоимость создания: <strong className="text-cyan-300">{CLAN_CREATION_COST_CRYSTALS} 💎 кристаллов</strong>
                  </p>
                </div>
                <div className="rounded-lg border border-cyan-500/50 bg-slate-950 px-2.5 py-1 text-[10px] font-black text-cyan-300">
                  У вас: {hero.crystals} 💎
                </div>
              </div>

              {/* Clan Name & Tag */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[9.5px] font-bold text-slate-300 mb-1">
                    Название клана (3–24 симв.):
                  </label>
                  <input
                    type="text"
                    maxLength={24}
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Например: Стражи Ра"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-300 mb-1">
                    Тег (2–6 симв.):
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={createTag}
                    onChange={(e) => setCreateTag(e.target.value.toUpperCase())}
                    placeholder="WAR"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-center text-[11px] font-black uppercase text-amber-300 outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[9.5px] font-bold text-slate-300 mb-1">
                  Девиз / Описание клана:
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Вместе к вершине Пирамиды!"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[10px] text-white outline-none focus:border-amber-400"
                />
              </div>

              {/* Emblem Selection & Canvas Generator Studio */}
              {renderEmblemStudioContent(createTag || 'WAR')}

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleCreateClan}
                disabled={hero.crystals < CLAN_CREATION_COST_CRYSTALS}
                className={`w-full rounded-xl py-2.5 text-xs font-black uppercase tracking-wider shadow-lg transition-all ${
                  hero.crystals >= CLAN_CREATION_COST_CRYSTALS
                    ? 'border border-cyan-300 bg-gradient-to-r from-cyan-600 via-teal-500 to-cyan-600 text-slate-950 hover:from-cyan-500 hover:to-teal-400 active:scale-98'
                    : 'border border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                🛡️ Создать клан за {CLAN_CREATION_COST_CRYSTALS} 💎
              </button>
            </div>
          )}
        </div>

        {/* Universal Confirmation Dialog Inside ClanModal */}
        {pendingConfirm && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border-2 border-amber-400 bg-slate-950 p-4 shadow-2xl space-y-3">
              <div className="text-sm font-black text-amber-300 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>{pendingConfirm.title}</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{pendingConfirm.message}</p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const fn = pendingConfirm.onConfirm;
                    setPendingConfirm(null);
                    fn();
                  }}
                  className={`flex-1 rounded-xl py-2 text-xs font-black text-white shadow transition-all ${
                    pendingConfirm.danger
                      ? 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500'
                  }`}
                >
                  {pendingConfirm.confirmText || '✅ Подтвердить'}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
