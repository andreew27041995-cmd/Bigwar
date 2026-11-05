import React, { useState, useRef, useEffect } from 'react';
import { Clan, ClanLogEntry, ClanStorageItem, GameItem, HeroState } from '../../types/game';
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
  takeElixirFromClanStorage,
  rentItemFromClanStorage,
  returnItemToClanStorage,
  recallItemByOriginalOwner,
  getClanPyramidState,
  getClanPyramidBuffs,
  syncClansFromSupabase
} from '../../utils/clanStorage';
import {
  STANDARD_CLAN_ICONS,
  CLAN_EMBLEM_COLOR_PRESETS,
  ClanEmblemGeneratorConfig,
  generateClanEmblemDataUrl,
  processUploadedClanEmblem
} from '../../utils/imageUpload';
import { getQualityConfig, SLOT_INFO, formatLastSeen } from '../../utils/gameData';
import { ELIXIR_EN_IMG, ELIXIR_HP_IMG, ELIXIR_EXP_IMG } from '../../utils/elixirAssets';
import { ItemIcon } from '../ItemIcon';
import CharacterAvatar from '../CharacterAvatar';

interface ClanModalProps {
  currentUser: string | null;
  hero: HeroState;
  inventory: GameItem[];
  isAdmin?: boolean;
  onClose: () => void;
  onUpdateHero: (updated: Partial<HeroState>) => void;
  onUpdateInventory: (updated: GameItem[]) => void;
  showToast: (text: string) => void;
  onOpenClanPyramid: () => void;
  onInspectPlayer?: (nick: string) => void;
}

export const ClanModal: React.FC<ClanModalProps> = ({
  currentUser,
  hero,
  inventory,
  isAdmin = false,
  onClose,
  onUpdateHero,
  onUpdateInventory,
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

  const [activeTab, setActiveTab] = useState<'myClan' | 'storage' | 'ammunition' | 'members' | 'logs' | 'clansList' | 'create'>(() => {
    return playerClan ? 'myClan' : 'clansList';
  });

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

  // Storage, Gold & Elixir Deposit modal state
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositMode, setDepositMode] = useState<'item' | 'elixir' | 'gold'>('item');
  const [selectedElixirType, setSelectedElixirType] = useState<'hp' | 'en' | 'exp'>('hp');
  const [elixirDepositQty, setElixirDepositQty] = useState<number>(1);
  const [goldDepositAmount, setGoldDepositAmount] = useState<number>(500);
  const [searchFilter, setSearchFilter] = useState('');

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
  const maxStorageCap = getClanMaxStorageCapacity(playerClan);
  const nextClanExp = playerClan ? getClanExpForNextLevel(playerClan.level) : 2000;
  const currentClanExp = Number(playerClan?.exp || 0);
  const clanExpPct =
    playerClan && playerClan.level >= MAX_CLAN_LEVEL
      ? 100
      : nextClanExp > 0
      ? Math.min(100, Math.round((currentClanExp / nextClanExp) * 100))
      : 0;

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
  };

  // Join existing clan
  const handleJoinClan = (clan: Clan) => {
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
  };

  // Leave clan anytime (for any member or leader)
  const handleLeaveClan = () => {
    if (!playerClan) return;

    // Remove any clan-rented items from player's inventory
    const cleanedInventory = inventory.filter((i) => !i.isClanRented);
    const res = leaveClan(playerClan.id, myNick);
    if (!res.ok) {
      showToast(`❌ ${res.error || 'Ошибка выхода из клана.'}`);
      return;
    }

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
      showToast(`🚪 Вы покинули клан. Лидерство передано игроку ${res.newLeaderNick}.`);
    } else {
      showToast('🚪 Вы вышли из клана.');
    }
    triggerRefresh();
    setActiveTab('clansList');
  };

  // Disband clan (leader or admin)
  const handleDisbandClan = () => {
    if (!playerClan) return;

    const myNonRentedInv = inventory.filter((i) => !i.isClanRented);
    const res = disbandClan(playerClan.id, myNick, isAdmin);
    if (!res.ok) {
      showToast(`❌ ${res.error}`);
      return;
    }

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

    showToast(`💥 Клан «${playerClan.name}» распущен. Все вещи с базы возвращены владельцам.`);
    triggerRefresh();
    setActiveTab('clansList');
  };

  // Deposit item from inventory to Clan Storage
  const handleDepositItem = (item: GameItem) => {
    if (!playerClan) return;
    if (item.isClanRented || item.rent) {
      showToast('❌ Арендованный предмет нельзя сдать на базу клана!');
      return;
    }

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
  };

  // Deposit Gold to Clan Base Treasury
  const handleDepositGold = () => {
    if (!playerClan) return;
    const amount = Math.max(1, Math.floor(Number(goldDepositAmount) || 0));
    if (hero.gold < amount) {
      showToast(`❌ Недостаточно золота! У вас: ${hero.gold} 🪙.`);
      return;
    }

    const res = depositGoldToClanTreasury(playerClan.id, myNick, amount);
    if (!res.ok) {
      showToast(`❌ ${res.error}`);
      return;
    }

    onUpdateHero({ gold: Math.max(0, hero.gold - amount) });
    showToast(`🪙 Вы пополнили казну базы клана на ${amount} золота!`);
    triggerRefresh();
    setIsDepositModalOpen(false);
  };

  // Take Elixir from Clan Storage
  const handleTakeElixir = (st: ClanStorageItem) => {
    if (!playerClan) return;
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
  };

  // Rent item from Clan Storage
  const handleRentItem = (st: ClanStorageItem) => {
    if (!playerClan) return;
    const res = rentItemFromClanStorage(playerClan.id, myNick, st.id);
    if (!res.ok || !res.rentedItem) {
      showToast(`❌ ${res.error}`);
      return;
    }

    onUpdateInventory([...inventory, res.rentedItem]);
    showToast(`🤝 Вы взяли «${st.item.name}» в аренду с базы клана!`);
    triggerRefresh();
  };

  // Return rented item back to Clan Storage
  const handleReturnRentedItem = (st: ClanStorageItem) => {
    if (!playerClan) return;
    const res = returnItemToClanStorage(playerClan.id, myNick, st.id);
    if (!res.ok) {
      showToast(`❌ ${res.error}`);
      return;
    }

    const nextInv = inventory.filter((i) => i.clanStorageId !== st.id);
    onUpdateInventory(nextInv);
    showToast(`📦 Предмет «${st.item.name}» возвращен на базу клана.`);
    triggerRefresh();
  };

  // Original owner recalls their item back into personal inventory
  const handleOwnerRecallItem = (st: ClanStorageItem) => {
    if (!playerClan) return;
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
  };

  // Save clan settings
  const handleSaveClanSettings = () => {
    if (!playerClan) return;
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
  };

  // Save updated clan emblem (for clan leader / admin)
  const handleSaveClanEmblem = () => {
    if (!playerClan || !selectedEmblem) return;
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
  };

  // Kick member
  const handleKick = (targetNick: string) => {
    if (!playerClan) return;
    const res = kickClanMember(playerClan.id, myNick, targetNick, isAdmin);
    if (!res.ok) {
      showToast(`❌ ${res.error}`);
      return;
    }
    triggerRefresh();
    showToast(`👢 Игрок ${targetNick} исключен из клана.`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm">
      <div className="flex h-[92vh] max-h-[780px] w-full max-w-[430px] flex-col overflow-hidden rounded-2xl border-2 border-amber-500/70 bg-[#12161f] text-white shadow-[0_0_30px_rgba(245,158,11,0.3)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-amber-500/30 bg-gradient-to-r from-slate-950 via-amber-950/40 to-slate-950 px-3 py-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-amber-300">
                {playerClan ? `Клан [${playerClan.tag}] ${playerClan.name}` : 'Клановая Система'}
              </h2>
              <p className="text-[9px] text-slate-400">
                {playerClan
                  ? `Ур. ${playerClan.level}/${MAX_CLAN_LEVEL} • База: ${playerClan.storage.length}/${maxStorageCap} мест`
                  : 'Создание клана, база вещей и эликсиров, битва за Пирамиду'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-xs font-bold text-slate-300 hover:border-red-500 hover:text-red-400"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-800 bg-slate-950/90 p-1.5 shrink-0">
          {playerClan ? (
            <>
              <button
                onClick={() => setActiveTab('myClan')}
                className={`rounded px-2.5 py-1 text-[10px] font-extrabold transition-colors shrink-0 ${
                  activeTab === 'myClan'
                    ? 'border border-amber-400 bg-amber-500/20 text-amber-300 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🏰 Мой Клан
              </button>
              <button
                onClick={() => setActiveTab('storage')}
                className={`rounded px-2.5 py-1 text-[10px] font-extrabold transition-colors shrink-0 ${
                  activeTab === 'storage'
                    ? 'border border-amber-400 bg-amber-500/20 text-amber-300 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📦 База ({playerClan.storage.length}/{maxStorageCap})
              </button>
              <button
                onClick={() => setActiveTab('ammunition')}
                className={`rounded px-2.5 py-1 text-[10px] font-extrabold transition-colors shrink-0 ${
                  activeTab === 'ammunition'
                    ? 'border border-amber-400 bg-amber-500/20 text-amber-300 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🛡️ Клановая амуниция
              </button>
              <button
                onClick={() => setActiveTab('members')}
                className={`rounded px-2.5 py-1 text-[10px] font-extrabold transition-colors shrink-0 ${
                  activeTab === 'members'
                    ? 'border border-amber-400 bg-amber-500/20 text-amber-300 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                👥 Состав ({playerClan.members.length})
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`rounded px-2.5 py-1 text-[10px] font-extrabold transition-colors shrink-0 ${
                  activeTab === 'logs'
                    ? 'border border-amber-400 bg-amber-500/20 text-amber-300 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📜 Логи клана ({(playerClan.logs || []).length})
              </button>
              <button
                onClick={() => {
                  onClose();
                  onOpenClanPyramid();
                }}
                className="rounded px-2.5 py-1 text-[10px] font-black bg-gradient-to-r from-red-900 to-amber-900 border border-amber-400/80 text-amber-200 shadow hover:border-amber-300 shrink-0"
              >
                🔺 Клановая Пирамида
              </button>
              <button
                onClick={() => setActiveTab('clansList')}
                className={`rounded px-2.5 py-1 text-[10px] font-extrabold transition-colors shrink-0 ${
                  activeTab === 'clansList'
                    ? 'border border-amber-400 bg-amber-500/20 text-amber-300 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📋 Все кланы
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTab('clansList')}
                className={`rounded px-3 py-1 text-[10px] font-extrabold transition-colors shrink-0 ${
                  activeTab === 'clansList'
                    ? 'border border-amber-400 bg-amber-500/20 text-amber-300 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📋 Список кланов ({allClans.length})
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`rounded px-3 py-1 text-[10px] font-extrabold transition-colors shrink-0 ${
                  activeTab === 'create'
                    ? 'border border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ✨ Создать клан ({CLAN_CREATION_COST_CRYSTALS} 💎)
              </button>
            </>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto overscroll-y-contain touch-pan-y p-3 space-y-3 text-xs">
          {/* ==================== TAB 1: MY CLAN ==================== */}
          {playerClan && activeTab === 'myClan' && (
            <div className="space-y-3">
              {/* Clan Banner Card */}
              <div className="rounded-xl border border-amber-500/50 bg-gradient-to-b from-slate-900 to-slate-950 p-3 shadow-lg">
                <div className="flex items-start gap-3">
                  {renderClanEmblem(playerClan.emblem, 'h-16 w-16 text-3xl')}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
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
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-purple-300 border border-slate-700">
                        ⭐ Влияние: {playerClan.influencePoints}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-yellow-300 border border-slate-700" title="Счёт клана в золоте (поступает только с Клановой Пирамиды)">
                        🪙 Казна: {playerClan.treasuryGold || 0}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-cyan-300 border border-slate-700" title="Счёт клана в кристаллах (поступает только с Клановой Пирамиды)">
                        💎 Кристаллы: {playerClan.treasuryCrystals || 0}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-emerald-300 border border-slate-700">
                        👥 Состав: {playerClan.members.length} чел.
                      </span>
                    </div>

                    {/* Clan Account Highlight Banner */}
                    <div className="mt-2 rounded-lg border border-amber-500/40 bg-slate-950/90 px-2.5 py-1.5 flex items-center justify-between text-[9px]">
                      <div>
                        <span className="text-slate-400">🏦 Счёт клана (Клановая Пирамида): </span>
                        <strong className="text-yellow-300">🪙 {playerClan.treasuryGold || 0}</strong>
                        <span className="text-slate-500 mx-1">|</span>
                        <strong className="text-cyan-300">💎 {playerClan.treasuryCrystals || 0}</strong>
                      </div>
                      <span className="text-[7.5px] text-slate-400">
                        Налог: {playerClan.pyramidTaxGoldPct ?? 15}%🪙 / {playerClan.pyramidTaxCrystalPct ?? 15}%💎
                      </span>
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

                {/* Quick Action Buttons */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setActiveTab('storage')}
                    className="flex-1 rounded-lg border border-amber-400/80 bg-gradient-to-b from-amber-700 to-amber-900 py-2 px-2 text-[10px] font-black text-amber-100 shadow hover:from-amber-600"
                  >
                    📦 База ({playerClan.storage.length}/{maxStorageCap})
                  </button>
                  <button
                    onClick={() => setActiveTab('logs')}
                    className="flex-1 rounded-lg border border-sky-400/80 bg-gradient-to-b from-sky-800 to-slate-900 py-2 px-2 text-[10px] font-black text-sky-100 shadow hover:from-sky-700"
                  >
                    📜 Логи клана ({(playerClan.logs || []).length})
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
                      Казна базы: <strong className="text-yellow-300">{playerClan.treasuryGold || 0} 🪙 золота</strong> • На 1 ур. вмещает 50 вещей (+10 за уровень).
                    </p>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1.5">
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
                </div>
              </div>

              {/* Deposit Item, Elixir OR Gold Modal Drawer */}
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
                        {depositableItems.map((item) => {
                          const q = getQualityConfig(item.quality);
                          return (
                            <div
                              key={item.id}
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
                  ) : (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-[9.5px] text-slate-300">
                        <span>Ваше золото: <strong className="text-amber-300">{hero.gold} 🪙</strong></span>
                        <span>В казне базы: <strong className="text-yellow-300">{playerClan.treasuryGold || 0} 🪙</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">Сумма 🪙:</span>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, hero.gold)}
                          value={goldDepositAmount}
                          onChange={(e) => setGoldDepositAmount(Math.max(1, Number(e.target.value) || 1))}
                          className="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-center text-[10px] font-bold text-amber-300"
                        />
                        <button
                          type="button"
                          onClick={handleDepositGold}
                          className="flex-1 rounded bg-amber-600 py-1.5 text-[10px] font-black text-slate-950 hover:bg-amber-500"
                        >
                          🪙 Пополнить базу
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
                    Нажмите «+ Положить вещь» или «🧪 Положить эликсиры», чтобы поделиться с соклановцами.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {playerClan.storage.map((st) => {
                    const item = st.item;
                    const isElixir = st.itemType === 'elixir' || Boolean(st.elixirType);
                    const q = getQualityConfig(item.quality);
                    const isMyOwnedItem = st.originalOwnerNick.toLowerCase() === myNick.toLowerCase();
                    const isRentedByMe =
                      st.isRented && st.rentedByNick?.toLowerCase() === myNick.toLowerCase();

                    return (
                      <div
                        key={st.id}
                        className={`rounded-xl border p-2.5 transition-all ${
                          isElixir
                            ? 'border-purple-500/40 bg-purple-950/20'
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
                              <div className="mt-0.5 flex flex-wrap gap-2 text-[9px] text-slate-300">
                                {item.dmg > 0 && <span>⚔️ +{item.dmg}</span>}
                                {item.hp > 0 && <span>❤️ +{item.hp}</span>}
                                {(item.dodgeBonus || 0) > 0 && <span>💨 +{item.dodgeBonus}%</span>}
                                {(item.energyBonus || 0) > 0 && <span>⚡ +{item.energyBonus}</span>}
                                <span className="text-slate-400">
                                  🔧 {item.durability ?? 100}/{item.maxDurability ?? 100}
                                </span>
                              </div>
                            )}

                            {/* Owner & Rental Status Badges */}
                            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 border-t border-slate-800/80 pt-1.5">
                              <div className="text-[9px]">
                                <span className="text-slate-400">Положил: </span>
                                <strong className={isMyOwnedItem ? 'text-amber-300' : 'text-slate-200'}>
                                  {st.originalOwnerNick} {isMyOwnedItem ? '(Вы)' : ''}
                                </strong>
                              </div>

                              {!isElixir && (
                                <div>
                                  {st.isRented ? (
                                    <span className="inline-flex items-center gap-1 rounded bg-red-500/20 border border-red-500/50 px-1.5 py-0.5 text-[8.5px] font-black text-red-300">
                                      🔴 В аренде: {st.rentedByNick}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/50 px-1.5 py-0.5 text-[8.5px] font-black text-emerald-300">
                                      🟢 Свободен на базе
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
                                      📥 Взять в аренду
                                    </button>
                                  )}

                                  {isRentedByMe && (
                                    <button
                                      onClick={() => handleReturnRentedItem(st)}
                                      className="flex-1 rounded-md border border-sky-400 bg-sky-700 py-1 text-[9.5px] font-black text-white shadow hover:bg-sky-600"
                                    >
                                      📤 Вернуть на базу
                                    </button>
                                  )}

                                  {(isMyOwnedItem || isAdmin) && (
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

          {/* ==================== TAB 2.5: CLAN AMMUNITION ("КЛАНОВАЯ АМУНИЦИЯ") ==================== */}
          {playerClan && activeTab === 'ammunition' && (
            <div className="space-y-3">
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-amber-500/40 bg-slate-900/70 p-8 text-center shadow-lg">
                <span className="text-4xl mb-2">🛡️</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Клановая амуниция
                </h3>
                <p className="mt-2 text-[10px] text-slate-300 max-w-[280px] leading-relaxed">
                  Раздел пока пуст и находится в разработке. В будущих обновлениях здесь появится клановое обмундирование, боевые знамёна и священные реликвии клана.
                </p>
                <div className="mt-3 flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-[8.5px] font-bold text-amber-200">
                  <span>⏳ В разработке — раздел будет добавлен позже</span>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 3: MEMBERS ==================== */}
          {playerClan && activeTab === 'members' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-[10px] text-slate-400 font-bold">
                <span>Участники клана ({playerClan.members.length}) • Нажмите на игрока для осмотра</span>
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
                  const roleLabel =
                    m.role === 'leader'
                      ? '👑 Глава'
                      : m.role === 'officer'
                      ? '⭐ Офицер'
                      : '⚔️ Воин';

                  return (
                    <div
                      key={m.nick}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5"
                    >
                      <div
                        onClick={() => onInspectPlayer && onInspectPlayer(m.nick)}
                        className="flex items-center gap-2 cursor-pointer group"
                        title="Нажмите для осмотра профиля (экипировка, коллекция, баланс, протокол)"
                      >
                        <CharacterAvatar avatar={m.avatar || '🧙‍♂️'} nick={m.nick} size="xs" />
                        <div>
                          <div className="flex items-center gap-1 font-bold text-white text-[10.5px] group-hover:text-amber-300 transition-colors">
                            <span>{m.nick}</span>
                            {isMe && <span className="text-[8px] text-amber-400">(Вы)</span>}
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

                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-slate-950 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-300 border border-slate-700">
                          {roleLabel}
                        </span>

                        {(isLeader || isAdmin) && !isMe && (
                          <button
                            onClick={() => handleKick(m.nick)}
                            className="rounded bg-red-950 border border-red-500/40 px-1.5 py-0.5 text-[8px] font-bold text-red-300 hover:bg-red-800 hover:text-white"
                          >
                            Исключить
                          </button>
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
                      История событий клана: вступления, выходы, пополнения базы (золото/вещи/эликсиры) и взятие предметов. Синхронизировано с Supabase.
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
                    { key: 'deposits' as const, label: '📥 Пополнения базы' },
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
                        Все действия участников (вступление, выход, пополнение базы золотом, вещами или эликсирами, а также взятие предметов) будут автоматически сохраняться здесь.
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
                    case 'deposit_gold':
                      return {
                        label: 'Золото в базу',
                        badgeClass: 'bg-yellow-500/20 border-yellow-400/60 text-yellow-300',
                        rowBorder: 'border-yellow-500/30'
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
                    {filteredLogs.map((log) => {
                      const cfg = getBadgeConfig(log.type);
                      return (
                        <div
                          key={log.id}
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
      </div>
    </div>
  );
};
