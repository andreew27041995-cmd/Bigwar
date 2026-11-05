import React, { useRef, useState } from 'react';
import { GameFeatureFlags, GameItem, HeroState, ItemSlot } from '../../types/game';
import { SLOT_INFO } from '../../utils/gameData';
import {
  DEFAULT_FEATURE_FLAGS,
  formatItemBonusesText,
  formatTravelTimeText,
  getTransportsCatalog,
  createNamedTransportItem
} from '../../utils/shopConfig';
import { ItemIcon } from '../ItemIcon';
import {
  GAME_ITEM_IMAGE_SPEC,
  ProcessedItemImageResult,
  processUploadedItemImage
} from '../../utils/imageUpload';

const SLOT_NAMES: Record<ItemSlot, string> = {
  weapon: SLOT_INFO.weapon.name,
  armor: SLOT_INFO.armor.name,
  pants: SLOT_INFO.pants.name,
  boots: SLOT_INFO.boots.name,
  gloves: SLOT_INFO.gloves.name,
  ring: SLOT_INFO.ring.name,
  transport: SLOT_INFO.transport.name
};

const SLOT_ICONS: Record<ItemSlot, string> = {
  weapon: SLOT_INFO.weapon.icon,
  armor: SLOT_INFO.armor.icon,
  pants: SLOT_INFO.pants.icon,
  boots: SLOT_INFO.boots.icon,
  gloves: SLOT_INFO.gloves.icon,
  ring: SLOT_INFO.ring.icon,
  transport: SLOT_INFO.transport.icon
};

const EQUIPMENT_SLOTS: ItemSlot[] = ['weapon', 'armor', 'pants', 'boots', 'gloves', 'ring'];

export interface ForgeCustomItemOptions {
  equipImmediately?: boolean;
  currency?: 'crystals' | 'gold';
  goldCost?: number;
  crystalCost?: number;
}

interface CreateItemModalProps {
  hero: HeroState;
  featureFlags?: GameFeatureFlags;
  isAdmin?: boolean;
  onClose: () => void;
  onForgeItem: (item: GameItem, crystalCost: number, options?: ForgeCustomItemOptions) => void;
  onOpenAdminCreation?: () => void;
  showToast: (msg: string) => void;
}

const PRESET_SLOT_ICONS: Record<ItemSlot, string[]> = {
  weapon: [
    '/assets/swords/new_sword_lvl2.png',
    '⚔️',
    '🗡️',
    '🪓',
    '🔱',
    '🏹',
    '🔨',
    '⚡',
    '🔥',
    '🩸'
  ],
  armor: ['🛡️', '🥋', '🦺', '🧥', '👕', '⚜️', '💎', '🔥'],
  pants: ['👖', '🩳', '🩰', '⛓️', '🛡️'],
  boots: ['👢', '🥾', '👟', '👞', '⚡', '🪽'],
  gloves: ['🧤', '🥊', '🦾', '✋', '🔥', '⚡'],
  ring: ['💍', '💎', '🔮', '🧿', '👑', '☀️', '🌙'],
  transport: ['🛶', '🚤', '🚁', '🛩️', '⛵', '🛳️', '🛸', '🦅']
};

const PRESET_TRANSPORT_ICONS: string[] = ['🛶', '🚤', '🚁', '🛩️', '⛵', '🛳️', '🛸', '🦅', '🚀', '🐉'];

const RANDOM_TRANSPORT_NAMES: string[] = [
  'Золотая Ладья Фараона',
  'Штурмовой Катер Нила',
  'Боевой Апач Анубиса',
  'Крылатый М-8 Солнечного Ра',
  'Призрачный Крейсер Пустыни',
  'Императорский Перехватчик'
];

const RANDOM_ITEM_NAMES: Record<ItemSlot, string[]> = {
  weapon: [
    'Клинок Вечного Рассвета',
    'Меч Анубиса',
    'Копьё Солнечного Ра',
    'Секира Пустынной Бури',
    'Кинжал Чёрного Скорпиона',
    'Ярость Фараона'
  ],
  armor: [
    'Доспех Золотого Скарабея',
    'Кираса Бессмертного Стража',
    'Броня Песчаного Титана',
    'Латы Царя Скорпионов'
  ],
  pants: [
    'Поножи Древнего Стража',
    'Штаны Тени Пирамиды',
    'Набедренник Солнечного Легиона'
  ],
  boots: [
    'Сапоги Песчаного Вихря',
    'Поступь Гора',
    'Ботинки Неуловимого Странника'
  ],
  gloves: [
    'Перчатки Сокрушителя Гробниц',
    'Рукавицы Грома',
    'Наручи Кровавого Песка'
  ],
  ring: [
    'Кольцо Ока Гора',
    'Перстень Вечной Жизни',
    'Печать Древних Богов'
  ],
  transport: RANDOM_TRANSPORT_NAMES
};

export const CreateItemModal: React.FC<CreateItemModalProps> = ({
  hero,
  featureFlags,
  isAdmin = false,
  onClose,
  onForgeItem,
  onOpenAdminCreation,
  showToast
}) => {
  const flags = { ...DEFAULT_FEATURE_FLAGS, ...(featureFlags || {}) };
  const creationEnabled = flags.customCreationEnabled !== false || isAdmin;
  const allowedCurrency = flags.customCreationCurrency || 'both';

  const [forgeMode, setForgeMode] = useState<'equipment' | 'named_transport'>('equipment');
  const [name, setName] = useState('');
  const [slot, setSlot] = useState<ItemSlot>('weapon');
  const [icon, setIcon] = useState<string>('/assets/swords/new_sword_lvl2.png');
  const [iconSourceType, setIconSourceType] = useState<'preset' | 'upload' | 'url'>('preset');
  const [customUrl, setCustomUrl] = useState('');
  const [uploadedInfo, setUploadedInfo] = useState<ProcessedItemImageResult | null>(null);
  const [isProcessingImg, setIsProcessingImg] = useState(false);

  // Named Transport state
  const transportsCatalog = getTransportsCatalog(flags as any);
  const [selectedBaseTransportId, setSelectedBaseTransportId] = useState<string>(
    transportsCatalog[transportsCatalog.length - 1]?.id || 'transport_m8'
  );
  const [transportIcon, setTransportIcon] = useState<string>('🚁');
  const [transportDurability, setTransportDurability] = useState<number>(
    Math.max(10, Number(flags.namedTransportDefaultDurability ?? 500))
  );
  // Именной транспорт летит за 1 минуту (60 секунд)
  const [transportTravelTimeSec, setTransportTravelTimeSec] = useState<number>(60);
  const [transportTransferable, setTransportTransferable] = useState<boolean>(false);

  // Все игровые бонусы для Именного Транспорта (+5% к начальной цене 10 000 💎 за каждый добавленный параметр)
  const [tDmg, setTDmg] = useState<number>(0);
  const [tHp, setTHp] = useState<number>(0);
  const [tStr, setTStr] = useState<number>(0);
  const [tAgi, setTAgi] = useState<number>(0);
  const [tVit, setTVit] = useState<number>(0);
  const [tDodge, setTDodge] = useState<number>(0);
  const [tEnergy, setTEnergy] = useState<number>(0);
  const [tGoldPct, setTGoldPct] = useState<number>(0);
  const [tExpPct, setTExpPct] = useState<number>(0);

  const [currency, setCurrency] = useState<'crystals' | 'gold'>(
    allowedCurrency === 'gold' ? 'gold' : 'crystals'
  );
  const [itemLvl, setItemLvl] = useState<number>(Math.max(1, hero.level || 1));
  const [dmg, setDmg] = useState<number>(15);
  const [hp, setHp] = useState<number>(40);
  const [dodgeBonus, setDodgeBonus] = useState<number>(0);
  const [energyBonus, setEnergyBonus] = useState<number>(0);
  const [goldBonusPct, setGoldBonusPct] = useState<number>(0);
  const [expBonusPct, setExpBonusPct] = useState<number>(0);
  const [transferable, setTransferable] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const maxDmg = Math.max(10, Number(flags.customMaxDmg ?? 250));
  const maxHp = Math.max(20, Number(flags.customMaxHp ?? 500));
  const maxDodge = Math.max(0, Number(flags.customMaxDodge ?? 25));
  const maxEnergy = Math.max(0, Number(flags.customMaxEnergy ?? 150));
  const maxGoldPct = Math.max(0, Number(flags.customMaxGoldPct ?? 25));
  const maxExpPct = Math.max(0, Number(flags.customMaxExpPct ?? 25));
  // Стандартная прочность созданного оружия: 100/100
  const rawCfgDur = Number(flags.customDefaultDurability ?? 100);
  const defaultDurability = rawCfgDur === 25 || rawCfgDur <= 0 ? 100 : rawCfgDur;

  const selectedBaseTransport =
    transportsCatalog.find((t) => t.id === selectedBaseTransportId) ||
    transportsCatalog[0] || {
      id: 'transport_m8',
      name: 'М-8',
      lvl: 1,
      travelTimeSec: 60,
      icon: '🚁'
    };

  // Базовая цена создания Именного Транспорта: 10 000 кристаллов
  const baseNamedTransportCostCrystals = Math.max(
    10000,
    Number(flags.namedTransportCostCrystals && flags.namedTransportCostCrystals >= 10000 ? flags.namedTransportCostCrystals : 10000)
  );
  const costPerAddedTransportParam = Math.round(baseNamedTransportCostCrystals * 0.05); // +5% = +500 💎 за каждый добавленный параметр

  // Подсчет количества добавленных параметров на Именном Транспорте
  const addedTransportParamsCount =
    (tDmg > 0 ? 1 : 0) +
    (tHp > 0 ? 1 : 0) +
    (tStr > 0 ? 1 : 0) +
    (tAgi > 0 ? 1 : 0) +
    (tVit > 0 ? 1 : 0) +
    (tDodge > 0 ? 1 : 0) +
    (tEnergy > 0 ? 1 : 0) +
    (tGoldPct > 0 ? 1 : 0) +
    (tExpPct > 0 ? 1 : 0);

  const transportParamsExtraCrystals = addedTransportParamsCount * costPerAddedTransportParam;
  const transportSubtotalCrystals = baseNamedTransportCostCrystals + transportParamsExtraCrystals;
  // Если можно передавать — стоимость увеличивается на +50%
  const transportTransferExtraCrystals = transportTransferable
    ? Math.round(transportSubtotalCrystals * 0.5)
    : 0;
  const totalTransportCrystals = transportSubtotalCrystals + transportTransferExtraCrystals;
  // При продаже именного созданного транспорта возврат составляет 70% от стоимости создания
  const transportSellRefundCrystals = Math.floor(totalTransportCrystals * 0.7);

  const statCostCrystals = Math.max(1, Number(flags.customCostPerStatCrystals ?? 1));
  const statCostGold = Math.max(1, Number(flags.customCostPerStatGold ?? 50));

  // Расчёт стоимости строго по выбранным характеристикам оружия/брони
  const statUnits =
    Math.ceil(dmg / 5) +
    Math.ceil(hp / 15) +
    dodgeBonus * 2 +
    Math.ceil(energyBonus / 10) +
    goldBonusPct * 2 +
    expBonusPct * 2;

  const baseStatCrystalCost = statUnits * statCostCrystals;
  const baseStatGoldCost = statUnits * statCostGold;

  // Если можно передавать (transferable = true) — стоимость увеличивается на +50% от выбранных характеристик
  const transferExtraCrystals = transferable ? Math.ceil(baseStatCrystalCost * 0.5) : 0;
  const transferExtraGold = transferable ? Math.ceil(baseStatGoldCost * 0.5) : 0;

  const totalCrystalCost = baseStatCrystalCost + transferExtraCrystals;
  const totalGoldCost = baseStatGoldCost + transferExtraGold;

  const sellRefundCrystals = Math.max(0, Math.floor(totalCrystalCost * 0.7));
  const sellRefundGold = Math.max(0, Math.floor(totalGoldCost * 0.7));

  const handleSlotChange = (newSlot: ItemSlot) => {
    setSlot(newSlot);
    if (iconSourceType === 'preset') {
      const presets = PRESET_SLOT_ICONS[newSlot] || ['⚔️'];
      setIcon(presets[0]);
    }
  };

  const handleRandomName = () => {
    if (forgeMode === 'named_transport') {
      const picked = RANDOM_TRANSPORT_NAMES[Math.floor(Math.random() * RANDOM_TRANSPORT_NAMES.length)];
      setName(picked);
      return;
    }
    const pool = RANDOM_ITEM_NAMES[slot] || RANDOM_ITEM_NAMES.weapon;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setName(picked);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingImg(true);
    const res = await processUploadedItemImage(file, 'cover');
    setIsProcessingImg(false);
    e.target.value = '';
    if ((!res.ok && !res.success) || !res.dataUrl) {
      showToast(res.error || 'Ошибка загрузки картинки');
      return;
    }
    setUploadedInfo(res);
    if (forgeMode === 'named_transport') {
      setTransportIcon(res.dataUrl);
    } else {
      setIcon(res.dataUrl);
    }
    setIconSourceType('upload');
    const sizeKb = res.finalSizeKb ?? res.compressedSizeKb ?? 20;
    showToast(
      `✅ Картинка установлена и заполнена в квадрат ${GAME_ITEM_IMAGE_SPEC.standardWidth}×${GAME_ITEM_IMAGE_SPEC.standardHeight}px (${sizeKb} КБ)`
    );
  };

  const handleApplyUrl = () => {
    const trimmed = customUrl.trim();
    if (!trimmed) {
      showToast('Введите прямую ссылку на картинку (https://... или /assets/...)');
      return;
    }
    if (
      !trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('/') &&
      !trimmed.startsWith('data:image/')
    ) {
      showToast('Ссылка должна начинаться с https://, http:// или /assets/');
      return;
    }
    if (forgeMode === 'named_transport') {
      setTransportIcon(trimmed);
    } else {
      setIcon(trimmed);
    }
    setIconSourceType('url');
    showToast('✅ Ссылка на картинку применена!');
  };

  const effectiveCurrency =
    allowedCurrency === 'both' ? currency : allowedCurrency === 'gold' ? 'gold' : 'crystals';

  const previewItem: GameItem = {
    id: 'preview_custom_item',
    name: name.trim() || `Созданный предмет (${SLOT_NAMES[slot]})`,
    slot,
    icon: icon || SLOT_ICONS[slot],
    quality: 'custom',
    lvl: Math.max(1, Math.min(hero.level || 1, itemLvl)),
    dmg,
    hp,
    dodgeBonus,
    energyBonus,
    goldBonusPct,
    expBonusPct,
    durability: defaultDurability,
    maxDurability: defaultDurability,
    initialMaxDurability: defaultDurability,
    price: totalGoldCost,
    forgeCrystalCost: effectiveCurrency === 'crystals' ? totalCrystalCost : 0,
    forgeGoldCost: effectiveCurrency === 'gold' ? totalGoldCost : 0,
    forgeCurrency: effectiveCurrency,
    transferable,
    origin: 'Кузница игрока',
    isCustomCreated: true,
    creatorNick: hero.nick
  };

  const handleCreateNamedTransport = (equipImmediately: boolean = false) => {
    if (flags.namedTransportEnabled === false && !isAdmin) {
      showToast('Создание именного транспорта временно отключено администратором!');
      return;
    }
    const cleanName = name.trim();
    if (!cleanName) {
      showToast('Введите название создаваемого Именного Транспорта!');
      return;
    }
    if (hero.crystals < totalTransportCrystals) {
      showToast(`❌ Недостаточно кристаллов! Нужно: ${totalTransportCrystals.toLocaleString('ru-RU')} 💎 (у вас: ${hero.crystals.toLocaleString('ru-RU')} 💎)`);
      return;
    }

    const safeDur = Math.max(1, Math.min(5000, Math.round(Number(transportDurability) || 500)));
    // Именной транспорт летит за 1 минуту (60 сек) или выбранное время
    const safeTravelSec = Math.max(15, Math.min(3600, Math.round(Number(transportTravelTimeSec) || 60)));

    const transportItem = createNamedTransportItem({
      name: cleanName,
      icon: transportIcon || selectedBaseTransport.icon || '🚁',
      lvl: 1,
      creatorNick: hero.nick || 'Игрок',
      flags,
      paidCurrency: 'crystals',
      paidAmount: totalTransportCrystals,
      baseTransport: selectedBaseTransport as any,
      maxDurability: safeDur,
      travelTimeSec: safeTravelSec,
      transferable: transportTransferable,
      dmg: tDmg,
      hp: tHp,
      str: tStr,
      agi: tAgi,
      vit: tVit,
      dodgeBonus: tDodge,
      energyBonus: tEnergy,
      goldBonusPct: tGoldPct,
      expBonusPct: tExpPct
    });

    onForgeItem(
      transportItem,
      totalTransportCrystals,
      {
        equipImmediately,
        currency: 'crystals',
        crystalCost: totalTransportCrystals,
        goldCost: 0
      }
    );
    onClose();
  };

  const handleCreate = (equipImmediately: boolean) => {
    if (!creationEnabled) {
      showToast('Создание оружия временно отключено администратором!');
      return;
    }
    const cleanName = name.trim();
    if (!cleanName) {
      showToast('Введите название создаваемого оружия или брони!');
      return;
    }
    if (dmg <= 0 && hp <= 0 && dodgeBonus <= 0 && energyBonus <= 0 && goldBonusPct <= 0 && expBonusPct <= 0) {
      showToast('Добавьте хотя бы одну характеристику предмету!');
      return;
    }

    if (effectiveCurrency === 'crystals' && hero.crystals < totalCrystalCost) {
      showToast(`Недостаточно кристаллов! Нужно: ${totalCrystalCost} 💎 (у вас: ${hero.crystals} 💎)`);
      return;
    }
    if (effectiveCurrency === 'gold' && hero.gold < totalGoldCost) {
      showToast(`Недостаточно золота! Нужно: ${totalGoldCost} 🪙 (у вас: ${hero.gold} 🪙)`);
      return;
    }

    const newItem: GameItem = {
      ...previewItem,
      id: `custom_${slot}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      transferable,
      forgeCurrency: effectiveCurrency,
      forgeCrystalCost: effectiveCurrency === 'crystals' ? totalCrystalCost : 0,
      forgeGoldCost: effectiveCurrency === 'gold' ? totalGoldCost : 0,
      price: totalGoldCost
    };

    onForgeItem(newItem, effectiveCurrency === 'crystals' ? totalCrystalCost : 0, {
      equipImmediately,
      currency: effectiveCurrency,
      crystalCost: effectiveCurrency === 'crystals' ? totalCrystalCost : 0,
      goldCost: effectiveCurrency === 'gold' ? totalGoldCost : 0
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 flex justify-center items-center p-2.5 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gradient-to-b from-[#221b15] to-[#120e0b] border-2 border-[#d4af37] w-full max-w-[580px] rounded-xl p-4 relative text-[#f4e4bc] shadow-[0_0_50px_rgba(0,0,0,1)] max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#d4af37]/30 pb-2.5 mb-3">
          <div>
            <h2 className="text-[#d4af37] text-base sm:text-lg font-bold uppercase tracking-wider flex items-center gap-2">
              <span>⚓ Кузница Порта: Именное Оружие и Транспорт</span>
            </h2>
            <p className="text-[11px] text-[#a08c70]">
              Создайте именное оружие (100/100) или Именной Транспорт (полёт за 1 мин, своя картинка, все бонусы)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && onOpenAdminCreation && (
              <button
                onClick={onOpenAdminCreation}
                className="bg-red-950/80 hover:bg-red-900 border border-red-500/60 text-red-200 px-2.5 py-1 rounded text-[10px] font-bold uppercase cursor-pointer"
                title="Открыть настройки создания в Админ-панели"
              >
                👑 Админ-настройки
              </button>
            )}
            <button
              onClick={onClose}
              className="text-[#888] hover:text-white text-2xl leading-none cursor-pointer px-1"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Mode Switcher: Equipment vs Named Transport */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setForgeMode('equipment')}
            className={`py-2 px-2.5 rounded-xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
              forgeMode === 'equipment'
                ? 'border-[#d4af37] bg-[#d4af37]/20 text-[#ffd700] shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                : 'border-[#3a2a1a] bg-black/40 text-[#a08c70] hover:border-[#d4af37]/50'
            }`}
          >
            ⚔️ Именное оружие / броня (100/100)
          </button>
          <button
            type="button"
            onClick={() => setForgeMode('named_transport')}
            className={`py-2 px-2.5 rounded-xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
              forgeMode === 'named_transport'
                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 shadow-[0_0_15px_rgba(34,211,238,0.35)]'
                : 'border-[#3a2a1a] bg-black/40 text-[#a08c70] hover:border-cyan-500/50'
            }`}
          >
            🚁 Именной транспорт (⚡ 1 мин • 10 000 💎)
          </button>
        </div>

        {!creationEnabled ? (
          <div className="bg-red-950/40 border border-red-500/50 rounded-lg p-4 text-center text-red-300 text-xs">
            ⚠️ Кузница создания предметов временно закрыта администратором.
          </div>
        ) : forgeMode === 'named_transport' ? (
          <div className="space-y-3.5 text-xs">
            {/* Баланс игрока */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-black/50 border border-cyan-500/40 rounded-lg px-3 py-2">
              <div className="text-[11px] text-cyan-200">
                Базовая цена: <b className="text-[#00f2fe]">10 000 💎</b> • Скорость полёта:{' '}
                <b className="text-emerald-300">⚡ 1 минута</b>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="text-[#ffd700]">🪙 {hero.gold.toLocaleString()}</span>
                <span className="text-[#00f2fe]">💎 {hero.crystals.toLocaleString()}</span>
              </div>
            </div>

            {/* 1. Название, прочность и скорость передвижения транспорта */}
            <div className="bg-black/40 border border-cyan-500/40 rounded-lg p-3 space-y-3">
              <div className="text-cyan-300 font-bold uppercase text-[11px]">
                1. Название, Прочность и Скорость передвижения:
              </div>

              <div>
                <label className="text-[#a08c70] block mb-1 text-[11px]">
                  Название вашего Именного Транспорта:
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={36}
                    placeholder={`Например: ${RANDOM_TRANSPORT_NAMES[0]}`}
                    className="flex-1 bg-[#0d0a08] border border-cyan-500/50 focus:border-cyan-300 text-white p-2 rounded-lg text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleRandomName}
                    className="bg-cyan-950 hover:bg-cyan-900 border border-cyan-400/60 text-cyan-200 px-3 rounded-lg text-xs font-bold cursor-pointer"
                    title="Случайное название транспорта"
                  >
                    🎲
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Прочность транспорта */}
                <div className="bg-[#120d0a] border border-emerald-500/40 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-300 font-bold text-[11px]">🔧 Прочность транспорта:</span>
                    <span className="text-white font-black text-xs">{transportDurability} / {transportDurability}</span>
                  </div>
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    value={transportDurability}
                    onChange={(e) => setTransportDurability(Math.max(10, Math.min(5000, Number(e.target.value) || 10)))}
                    className="w-full bg-black/70 border border-emerald-500/50 rounded px-2 py-1 text-white font-bold text-xs outline-none"
                  />
                  <div className="flex flex-wrap gap-1">
                    {[60, 100, 250, 500, 1000].map((dVal) => (
                      <button
                        key={dVal}
                        type="button"
                        onClick={() => setTransportDurability(dVal)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                          transportDurability === dVal
                            ? 'bg-emerald-600/40 border-emerald-400 text-emerald-200'
                            : 'bg-black/40 border-[#33261a] text-[#a08c70]'
                        }`}
                      >
                        {dVal}/{dVal}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Скорость / время передвижения (по умолчанию 1 мин = 60 сек) */}
                <div className="bg-[#120d0a] border border-cyan-500/40 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-300 font-bold text-[11px]">⏱️ Время полёта до Порта:</span>
                    <span className="text-amber-300 font-black text-xs">
                      ⚡ {formatTravelTimeText(transportTravelTimeSec)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={60}
                      max={600}
                      step={10}
                      value={transportTravelTimeSec}
                      onChange={(e) => setTransportTravelTimeSec(Math.max(60, Math.min(600, Number(e.target.value) || 60)))}
                      className="w-24 bg-black/70 border border-cyan-500/50 rounded px-2 py-1 text-white font-bold text-xs outline-none"
                    />
                    <span className="text-[10px] text-cyan-200/80">сек. (60 сек = 1 мин)</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: '⚡ 1 мин (Именной)', sec: 60 },
                      { label: '2 мин', sec: 120 },
                      { label: '3 мин', sec: 180 }
                    ].map((opt) => (
                      <button
                        key={opt.sec}
                        type="button"
                        onClick={() => setTransportTravelTimeSec(opt.sec)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                          transportTravelTimeSec === opt.sec
                            ? 'bg-cyan-600/40 border-cyan-300 text-cyan-100'
                            : 'bg-black/40 border-[#33261a] text-[#a08c70]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Иконка или своя картинка транспорта */}
            <div className="bg-black/40 border border-cyan-500/40 rounded-lg p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-cyan-300 font-bold uppercase text-[11px]">
                  2. Своя картинка или иконка Именного Транспорта:
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingImg}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-extrabold px-3 py-1.5 rounded-lg text-[11px] uppercase cursor-pointer shadow hover:brightness-110"
                >
                  {isProcessingImg ? '⏳ Обработка...' : '📁 Загрузить свою картинку'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Поле вставки прямой ссылки на картинку */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="Или вставьте ссылку на свою картинку (https://...)"
                  className="flex-1 bg-[#0d0a08] border border-[#3a2a1a] focus:border-cyan-400 text-white px-2.5 py-1.5 rounded-lg text-[11px] outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  🔗 Применить URL
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {PRESET_TRANSPORT_ICONS.map((ic, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTransportIcon(ic);
                      setIconSourceType('preset');
                    }}
                    className={`w-10 h-10 rounded-lg border flex items-center justify-center text-xl cursor-pointer ${
                      transportIcon === ic
                        ? 'border-cyan-300 bg-cyan-950/70 scale-105 shadow'
                        : 'border-[#33261a] bg-[#120d0a]'
                    }`}
                  >
                    <ItemIcon icon={ic} alt="Transport" />
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Бонусы транспорта (+5% к начальной стоимости 10 000 💎 за каждый добавленный параметр) */}
            <div className="bg-black/40 border border-cyan-500/40 rounded-lg p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <div className="text-cyan-300 font-bold uppercase text-[11px]">
                  3. Бонусы транспорта (работают, когда транспорт надет в слот):
                </div>
                <span className="text-[10px] font-black text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded">
                  +5% (+{costPerAddedTransportParam.toLocaleString('ru-RU')} 💎) за каждый добавленный параметр
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Урон */}
                <div className="bg-[#140f0c] border border-[#2c2016] rounded-lg p-2">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#ff6b6b] font-bold">⚔️ Урон:</span>
                    <span className="text-white font-extrabold">
                      +{tDmg} {tDmg > 0 ? <em className="text-cyan-300 not-italic">(+5%)</em> : null}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxDmg}
                    step={5}
                    value={tDmg}
                    onChange={(e) => setTDmg(Number(e.target.value))}
                    className="w-full accent-red-500 cursor-pointer"
                  />
                </div>

                {/* Здоровье */}
                <div className="bg-[#140f0c] border border-[#2c2016] rounded-lg p-2">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#51cf66] font-bold">❤️ Здоровье (HP):</span>
                    <span className="text-white font-extrabold">
                      +{tHp} {tHp > 0 ? <em className="text-cyan-300 not-italic">(+5%)</em> : null}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxHp}
                    step={10}
                    value={tHp}
                    onChange={(e) => setTHp(Number(e.target.value))}
                    className="w-full accent-green-500 cursor-pointer"
                  />
                </div>

                {/* Сила */}
                <div className="bg-[#140f0c] border border-[#2c2016] rounded-lg p-2">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-orange-400 font-bold">💪 Сила:</span>
                    <span className="text-white font-extrabold">
                      +{tStr} {tStr > 0 ? <em className="text-cyan-300 not-italic">(+5%)</em> : null}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={tStr}
                    onChange={(e) => setTStr(Number(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer"
                  />
                </div>

                {/* Ловкость */}
                <div className="bg-[#140f0c] border border-[#2c2016] rounded-lg p-2">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-sky-400 font-bold">💨 Ловкость:</span>
                    <span className="text-white font-extrabold">
                      +{tAgi} {tAgi > 0 ? <em className="text-cyan-300 not-italic">(+5%)</em> : null}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={tAgi}
                    onChange={(e) => setTAgi(Number(e.target.value))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>

                {/* Живучесть */}
                <div className="bg-[#140f0c] border border-[#2c2016] rounded-lg p-2">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-emerald-400 font-bold">🛡️ Живучесть:</span>
                    <span className="text-white font-extrabold">
                      +{tVit} {tVit > 0 ? <em className="text-cyan-300 not-italic">(+5%)</em> : null}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={tVit}
                    onChange={(e) => setTVit(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Уклонение */}
                <div className="bg-[#140f0c] border border-[#2c2016] rounded-lg p-2">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#74c0fc] font-bold">💨 Уклонение (%):</span>
                    <span className="text-white font-extrabold">
                      +{tDodge}% {tDodge > 0 ? <em className="text-cyan-300 not-italic">(+5%)</em> : null}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxDodge}
                    step={1}
                    value={tDodge}
                    onChange={(e) => setTDodge(Number(e.target.value))}
                    className="w-full accent-blue-400 cursor-pointer"
                  />
                </div>

                {/* Энергия */}
                <div className="bg-[#140f0c] border border-[#2c2016] rounded-lg p-2">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#ffd43b] font-bold">⚡ Бонус Энергии:</span>
                    <span className="text-white font-extrabold">
                      +{tEnergy} {tEnergy > 0 ? <em className="text-cyan-300 not-italic">(+5%)</em> : null}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxEnergy}
                    step={5}
                    value={tEnergy}
                    onChange={(e) => setTEnergy(Number(e.target.value))}
                    className="w-full accent-yellow-400 cursor-pointer"
                  />
                </div>

                {/* Золото % */}
                <div className="bg-[#140f0c] border border-[#2c2016] rounded-lg p-2">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#ffd700] font-bold">💰 Бонус золота (%):</span>
                    <span className="text-white font-extrabold">
                      +{tGoldPct}% {tGoldPct > 0 ? <em className="text-cyan-300 not-italic">(+5%)</em> : null}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxGoldPct}
                    step={1}
                    value={tGoldPct}
                    onChange={(e) => setTGoldPct(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                {/* Опыт % */}
                <div className="bg-[#140f0c] border border-[#2c2016] rounded-lg p-2 sm:col-span-2">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#da77f2] font-bold">✨ Бонус опыта (%):</span>
                    <span className="text-white font-extrabold">
                      +{tExpPct}% {tExpPct > 0 ? <em className="text-cyan-300 not-italic">(+5%)</em> : null}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxExpPct}
                    step={1}
                    value={tExpPct}
                    onChange={(e) => setTExpPct(Number(e.target.value))}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 4. Право передачи другим игрокам (Личный vs Можно передавать +50%) */}
            <div className="bg-black/40 border border-cyan-500/40 rounded-lg p-3 space-y-2">
              <div className="text-cyan-300 font-bold uppercase text-[11px]">
                4. Статус передачи Именного Транспорта:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTransportTransferable(false)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    !transportTransferable
                      ? 'bg-[#2a1f16] border-cyan-400 text-[#ffd700] shadow'
                      : 'bg-[#120e0b] border-[#33261a] text-[#8c785c]'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    <span>🔒 Личный (нельзя передавать)</span>
                    <span className="text-[10px] bg-green-950/80 text-green-300 px-1.5 py-0.5 rounded">
                      Без наценки
                    </span>
                  </div>
                  <div className="text-[10px] text-[#a08c70] mt-1">
                    Привязан к вашему персонажу. Нельзя передать другому игроку.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTransportTransferable(true)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    transportTransferable
                      ? 'bg-[#2a1f16] border-cyan-400 text-[#ffd700] shadow'
                      : 'bg-[#120e0b] border-[#33261a] text-[#8c785c]'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    <span>🤝 Можно передавать</span>
                    <span className="text-[10px] bg-amber-950/90 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded">
                      +50% к цене
                    </span>
                  </div>
                  <div className="text-[10px] text-[#a08c70] mt-1">
                    Можно свободно передавать другим игрокам через Сумку.
                  </div>
                </button>
              </div>
            </div>

            {/* 5. Превью и Итоговая стоимость Именного Транспорта */}
            <div className="bg-[#17110d] border-2 border-cyan-500/60 rounded-xl p-3 space-y-3">
              {/* Preview Card */}
              <div className="rounded-xl border border-cyan-400/60 bg-gradient-to-r from-slate-950 via-cyan-950/40 to-slate-950 p-3 flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl border-2 border-cyan-300 bg-slate-950 flex items-center justify-center p-1 shrink-0 text-3xl shadow-[0_0_15px_rgba(34,211,238,0.3)] overflow-hidden">
                  <ItemIcon icon={transportIcon} alt={name || 'Именной Транспорт'} className="w-full h-full" imgClassName="w-full h-full object-cover rounded-lg" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5 flex-wrap">
                    <span>👑 Именной Транспорт</span>
                    <span>•</span>
                    <span className={transportTransferable ? 'text-amber-300' : 'text-slate-300'}>
                      {transportTransferable ? '🤝 Можно передавать' : '🔒 Личный'}
                    </span>
                  </div>
                  <div className="text-sm font-black text-amber-300 truncate">
                    {name.trim() || 'Именной Крейсер Фараона'}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                    <span className="rounded bg-emerald-950/90 border border-emerald-500/50 px-2 py-0.5 font-black text-emerald-300">
                      🔧 Прочность: {transportDurability}/{transportDurability}
                    </span>
                    <span className="rounded bg-cyan-950/90 border border-cyan-400/50 px-2 py-0.5 font-black text-cyan-200">
                      ⚡ Время полёта: {formatTravelTimeText(transportTravelTimeSec)}
                    </span>
                  </div>
                  {addedTransportParamsCount > 0 && (
                    <div className="text-[10.5px] text-amber-200 font-bold pt-0.5">
                      ✨ Бонусы ({addedTransportParamsCount} парам.):{' '}
                      {[
                        tDmg > 0 ? `+${tDmg}⚔️` : '',
                        tHp > 0 ? `+${tHp}❤️` : '',
                        tStr > 0 ? `+${tStr}💪Сил` : '',
                        tAgi > 0 ? `+${tAgi}💨Лов` : '',
                        tVit > 0 ? `+${tVit}🛡️Жив` : '',
                        tDodge > 0 ? `+${tDodge}%💨Укл` : '',
                        tEnergy > 0 ? `+${tEnergy}⚡Эн` : '',
                        tGoldPct > 0 ? `+${tGoldPct}%🪙` : '',
                        tExpPct > 0 ? `+${tExpPct}%✨` : ''
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Расчёт цены */}
              <div className="bg-black/50 border border-[#2e2218] rounded-lg p-2.5 space-y-1 text-[11px]">
                <div className="flex justify-between text-[#b8a282]">
                  <span>Базовая стоимость создания транспорта:</span>
                  <span className="font-bold text-white">
                    {baseNamedTransportCostCrystals.toLocaleString('ru-RU')} 💎
                  </span>
                </div>
                <div className="flex justify-between text-cyan-300">
                  <span>Добавлено параметров ({addedTransportParamsCount} шт. × +5%):</span>
                  <span className="font-bold">
                    +{transportParamsExtraCrystals.toLocaleString('ru-RU')} 💎
                  </span>
                </div>
                {transportTransferable && (
                  <div className="flex justify-between text-amber-300">
                    <span>Наценка за возможность передачи (+50%):</span>
                    <span className="font-bold">
                      +{transportTransferExtraCrystals.toLocaleString('ru-RU')} 💎
                    </span>
                  </div>
                )}
                <div className="border-t border-[#3a2a1a] pt-1.5 mt-1 flex justify-between items-center text-sm">
                  <span className="font-bold text-[#ffd700]">ИТОГО К ОПЛАТЕ:</span>
                  <span className="font-extrabold text-[#00f2fe] text-base">
                    💎 {totalTransportCrystals.toLocaleString('ru-RU')} кристаллов
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-emerald-300 pt-0.5">
                  <span>💰 Возврат при продаже транспорта (70%):</span>
                  <span className="font-bold">
                    +{transportSellRefundCrystals.toLocaleString('ru-RU')} 💎
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleCreateNamedTransport(false)}
                  className="py-2.5 px-3 bg-gradient-to-r from-[#8b5a2b] to-[#5c3a1b] hover:from-[#a06832] hover:to-[#704721] border border-[#d4af37] text-[#ffd700] font-extrabold rounded-xl uppercase text-xs cursor-pointer shadow"
                >
                  🎒 Создать в Сумку
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateNamedTransport(true)}
                  className="py-2.5 px-3 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white font-extrabold rounded-xl uppercase text-xs cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:brightness-110"
                >
                  ⚡ Создать и надеть в слот
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5 text-xs">
            {/* Баланс игрока */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-black/50 border border-[#3a2a1a] rounded-lg px-3 py-2">
              <div className="text-[11px] text-[#c2a878]">
                Ваш уровень: <b className="text-white">{hero.level} ур.</b>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="text-[#ffd700]">🪙 {hero.gold.toLocaleString()}</span>
                <span className="text-[#00f2fe]">💎 {hero.crystals.toLocaleString()}</span>
              </div>
            </div>

            {/* 1. Выбор слота и названия */}
            <div className="bg-black/40 border border-[#3a2a1a] rounded-lg p-3 space-y-2.5">
              <div>
                <div className="text-[#d4af37] font-bold uppercase text-[11px] mb-1.5">
                  1. Выберите тип создаваемой амуниции:
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {EQUIPMENT_SLOTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSlotChange(s)}
                      className={`py-2 px-1.5 rounded-lg border text-[11px] font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        slot === s
                          ? 'bg-[#d4af37]/25 border-[#d4af37] text-[#ffd700] shadow-[0_0_12px_rgba(212,175,55,0.3)]'
                          : 'bg-[#1a1410] border-[#3a2a1a] text-[#a08c70] hover:border-[#d4af37]/50'
                      }`}
                    >
                      <span className="w-6 h-6 flex items-center justify-center">
                        <ItemIcon icon={SLOT_ICONS[s]} slot={s} name={SLOT_NAMES[s]} imgClassName="w-full h-full object-contain" />
                      </span>
                      <span>{SLOT_NAMES[s]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="text-[#a08c70] block mb-1 text-[11px]">
                    Название оружия / предмета:
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={36}
                      placeholder={`Например: ${RANDOM_ITEM_NAMES[slot][0]}`}
                      className="flex-1 bg-[#0d0a08] border border-[#443322] focus:border-[#d4af37] text-white p-2 rounded-lg text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleRandomName}
                      className="bg-[#2a1f16] hover:bg-[#3a2a1d] border border-[#d4af37]/50 text-[#ffd700] px-2.5 rounded-lg text-xs font-bold cursor-pointer"
                      title="Случайное красивое название"
                    >
                      🎲
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[#a08c70] block mb-1 text-[11px]">
                    Требуемый уровень (1–{hero.level}):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, hero.level)}
                    value={itemLvl}
                    onChange={(e) =>
                      setItemLvl(
                        Math.max(1, Math.min(Math.max(1, hero.level), Number(e.target.value) || 1))
                      )
                    }
                    className="w-full bg-[#0d0a08] border border-[#443322] text-white p-2 rounded-lg text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            {/* 2. Загрузка собственной картинки или выбор иконки */}
            <div className="bg-black/40 border border-[#d4af37]/40 rounded-lg p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[#d4af37] font-bold uppercase text-[11px]">
                  2. Картинка созданной амуниции:
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-gradient-to-r from-[#d4af37] to-[#9a7b1c] text-black font-extrabold px-3 py-1.5 rounded-lg text-[11px] uppercase cursor-pointer shadow hover:brightness-110 flex items-center gap-1.5"
                  >
                    <span>📁 Загрузить свою картинку</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Единственный режим подгонки загруженной картинки: Заполнить квадрат (1:1) */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#140f0c] border border-[#2c2016] rounded-lg p-2">
                <div className="text-[11px] text-[#c2a878]">
                  Режим подгонки под стандарт слота ({GAME_ITEM_IMAGE_SPEC.standardWidth}×
                  {GAME_ITEM_IMAGE_SPEC.standardHeight}px):
                </div>
                <div className="flex gap-1.5">
                  <span className="px-2.5 py-1 rounded text-[10px] font-bold border bg-[#d4af37]/25 border-[#d4af37] text-[#ffd700]">
                    🖼️ Заполнить квадрат (1:1)
                  </span>
                </div>
              </div>

              {/* Информация о загруженном файле */}
              {isProcessingImg && (
                <div className="text-center text-amber-300 text-[11px] py-1 animate-pulse">
                  ⏳ Обработка и заполнение квадрата 128×128px...
                </div>
              )}

              {uploadedInfo && iconSourceType === 'upload' && (
                <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-2 text-[11px] text-emerald-200 flex items-center justify-between gap-2">
                  <div>
                    ✅ Загружена своя картинка: исходный размер{' '}
                    <b>
                      {uploadedInfo.width}×{uploadedInfo.height}px
                    </b>{' '}
                    → заполнен квадрат{' '}
                    <b>
                      {GAME_ITEM_IMAGE_SPEC.standardWidth}×{GAME_ITEM_IMAGE_SPEC.standardHeight}px
                    </b>{' '}
                    (вес: <b>{uploadedInfo.finalSizeKb ?? uploadedInfo.compressedSizeKb} КБ</b>)
                  </div>
                </div>
              )}

              {/* Ввод ссылки URL на картинку */}
              <div className="flex gap-1.5 items-center">
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="Или вставьте прямую ссылку на картинку (https://...)"
                  className="flex-1 bg-[#0d0a08] border border-[#3a2a1a] text-white px-2.5 py-1.5 rounded-lg text-[11px]"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="bg-[#261c14] hover:bg-[#38291d] border border-[#d4af37]/40 text-[#f4e4bc] px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  Применить URL
                </button>
              </div>

              {/* Готовые стандартные иконки слота */}
              <div>
                <div className="text-[10px] text-[#a08c70] mb-1">
                  Или выберите стандартный образ ({SLOT_NAMES[slot]}):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(PRESET_SLOT_ICONS[slot] || ['⚔️']).map((preset, idx) => (
                    <button
                      key={`${preset}_${idx}`}
                      type="button"
                      onClick={() => {
                        setIcon(preset);
                        setIconSourceType('preset');
                      }}
                      className={`w-10 h-10 rounded-lg border flex items-center justify-center p-1 cursor-pointer transition-all ${
                        icon === preset
                          ? 'bg-[#d4af37]/25 border-[#ffd700] scale-105 shadow-[0_0_10px_rgba(255,215,0,0.4)]'
                          : 'bg-[#120d0a] border-[#33261a] hover:border-[#d4af37]/50'
                      }`}
                    >
                      <ItemIcon
                        icon={preset}
                        name={SLOT_NAMES[slot]}
                        className="text-xl"
                        imgClassName="w-full h-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Предпросмотр предмета в стандартных игровых слотах */}
              <div className="bg-gradient-to-r from-[#18120d] via-[#211811] to-[#18120d] border border-[#d4af37]/50 rounded-xl p-3 flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center gap-2.5 shrink-0">
                  {/* Стандартный слот экипировки 64x64 */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    title="Нажмите, чтобы загрузить свою картинку"
                    className="flex flex-col items-center cursor-pointer group"
                  >
                    <div className="w-16 h-16 rounded-xl bg-[#0d0a08] border-2 border-[#00f2fe] group-hover:border-[#ffd700] shadow-[0_0_15px_rgba(0,242,254,0.25)] flex items-center justify-center p-0.5 relative overflow-hidden">
                      <ItemIcon
                        icon={previewItem.icon}
                        name={previewItem.name}
                        className="text-3xl"
                        imgClassName="w-full h-full object-cover rounded-lg"
                      />
                      <span className="absolute bottom-0.5 right-1 text-[9px] font-extrabold text-[#ffd700] bg-black/80 px-1 rounded">
                        {previewItem.lvl} ур.
                      </span>
                    </div>
                    <span className="text-[9px] text-[#888] mt-0.5">Слот 64×64</span>
                  </div>

                  {/* Компактный слот сумки 44x44 */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    title="Нажмите, чтобы загрузить свою картинку"
                    className="flex flex-col items-center cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-lg bg-[#0d0a08] border border-[#d4af37] group-hover:border-[#ffd700] flex items-center justify-center p-0.5 relative overflow-hidden">
                      <ItemIcon
                        icon={previewItem.icon}
                        name={previewItem.name}
                        className="text-xl"
                        imgClassName="w-full h-full object-cover rounded-md"
                      />
                    </div>
                    <span className="text-[9px] text-[#888] mt-0.5">Сумка 44×44</span>
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-left min-w-0">
                  <div className="text-[10px] uppercase font-bold text-[#00f2fe] tracking-wider">
                    ✨ Предпросмотр созданной амуниции ({SLOT_NAMES[slot]})
                  </div>
                  <div className="text-sm font-extrabold text-[#ffd700] truncate">
                    {previewItem.name}
                  </div>
                  <div className="text-[11px] text-emerald-300 mt-0.5">
                    {formatItemBonusesText(previewItem)}
                  </div>
                  <div className="text-[10px] text-[#a08c70] mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span>
                      Стандартная прочность: <b className="text-white">{defaultDurability}/{defaultDurability}</b>
                    </span>
                    <span>•</span>
                    <span>
                      Уровень: <b className="text-white">{previewItem.lvl}</b>
                    </span>
                    <span>•</span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold text-[9.5px] ${
                        transferable
                          ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                          : 'bg-amber-950/80 border border-amber-500/50 text-amber-300'
                      }`}
                    >
                      {transferable ? '🤝 Можно передавать (+50%)' : '🔒 Личное (без передачи)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Настройка характеристик оружия / амуниции */}
            <div className="bg-black/40 border border-[#3a2a1a] rounded-lg p-3 space-y-2.5">
              <div className="text-[#d4af37] font-bold uppercase text-[11px]">
                3. Характеристики создаваемого предмета:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Урон */}
                <div className="bg-[#140f0c] border border-[#2c2016] rounded-lg p-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[#ff6b6b] font-bold">⚔️ Урон: +{dmg}</span>
                    <span className="text-[10px] text-[#888]">Макс: {maxDmg}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={maxDmg}
                      value={dmg}
                      onChange={(e) => setDmg(Math.min(maxDmg, Math.max(0, Number(e.target.value) || 0)))}
                      className="flex-1 accent-[#d4af37]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={maxDmg}
                      value={dmg}
                      onChange={(e) => setDmg(Math.min(maxDmg, Math.max(0, Number(e.target.value) || 0)))}
                      className="w-16 bg-black border border-[#443322] text-white px-1.5 py-1 rounded text-center font-bold"
                    />
                  </div>
                </div>

                {/* Здоровье HP */}
                <div className="bg-[#140f0c] border border-[#2c2016] rounded-lg p-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[#ff8787] font-bold">❤️ Здоровье (HP): +{hp}</span>
                    <span className="text-[10px] text-[#888]">Макс: {maxHp}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={maxHp}
                      value={hp}
                      onChange={(e) => setHp(Math.min(maxHp, Math.max(0, Number(e.target.value) || 0)))}
                      className="flex-1 accent-[#d4af37]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={maxHp}
                      value={hp}
                      onChange={(e) => setHp(Math.min(maxHp, Math.max(0, Number(e.target.value) || 0)))}
                      className="w-16 bg-black border border-[#443322] text-white px-1.5 py-1 rounded text-center font-bold"
                    />
                  </div>
                </div>

                {/* Уклонение */}
                <div className="bg-[#140f0c] border border-[#2c2016] rounded-lg p-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sky-300 font-bold">💨 Уклонение: +{dodgeBonus}%</span>
                    <span className="text-[10px] text-[#888]">Макс: {maxDodge}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={maxDodge}
                      value={dodgeBonus}
                      onChange={(e) =>
                        setDodgeBonus(Math.min(maxDodge, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="flex-1 accent-[#d4af37]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={maxDodge}
                      value={dodgeBonus}
                      onChange={(e) =>
                        setDodgeBonus(Math.min(maxDodge, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="w-16 bg-black border border-[#443322] text-white px-1.5 py-1 rounded text-center font-bold"
                    />
                  </div>
                </div>

                {/* Энергия */}
                <div className="bg-[#140f0c] border border-[#2c2016] rounded-lg p-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-amber-300 font-bold">⚡ Энергия: +{energyBonus}</span>
                    <span className="text-[10px] text-[#888]">Макс: {maxEnergy}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={maxEnergy}
                      value={energyBonus}
                      onChange={(e) =>
                        setEnergyBonus(Math.min(maxEnergy, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="flex-1 accent-[#d4af37]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={maxEnergy}
                      value={energyBonus}
                      onChange={(e) =>
                        setEnergyBonus(Math.min(maxEnergy, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="w-16 bg-black border border-[#443322] text-white px-1.5 py-1 rounded text-center font-bold"
                    />
                  </div>
                </div>

                {/* Бонус золота */}
                <div className="bg-[#140f0c] border border-[#2c2016] rounded-lg p-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[#ffd700] font-bold">💰 Бонус золота: +{goldBonusPct}%</span>
                    <span className="text-[10px] text-[#888]">Макс: {maxGoldPct}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={maxGoldPct}
                      value={goldBonusPct}
                      onChange={(e) =>
                        setGoldBonusPct(Math.min(maxGoldPct, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="flex-1 accent-[#d4af37]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={maxGoldPct}
                      value={goldBonusPct}
                      onChange={(e) =>
                        setGoldBonusPct(Math.min(maxGoldPct, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="w-16 bg-black border border-[#443322] text-white px-1.5 py-1 rounded text-center font-bold"
                    />
                  </div>
                </div>

                {/* Бонус опыта */}
                <div className="bg-[#140f0c] border border-[#2c2016] rounded-lg p-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-purple-300 font-bold">✨ Бонус опыта: +{expBonusPct}%</span>
                    <span className="text-[10px] text-[#888]">Макс: {maxExpPct}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={maxExpPct}
                      value={expBonusPct}
                      onChange={(e) =>
                        setExpBonusPct(Math.min(maxExpPct, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="flex-1 accent-[#d4af37]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={maxExpPct}
                      value={expBonusPct}
                      onChange={(e) =>
                        setExpBonusPct(Math.min(maxExpPct, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="w-16 bg-black border border-[#443322] text-white px-1.5 py-1 rounded text-center font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Опция передачи оружия (+50% к стоимости характеристик) и правила созданного оружия */}
            <div className="bg-black/40 border border-[#d4af37]/50 rounded-lg p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[#d4af37] font-bold uppercase text-[11px]">
                  4. Можно ли передавать созданное оружие другим игрокам:
                </div>
                <span className="text-[10px] font-bold text-cyan-300">
                  Стандартная прочность: {defaultDurability}/{defaultDurability}
                </span>
              </div>

              <label
                onClick={() => setTransferable((prev) => !prev)}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all select-none ${
                  transferable
                    ? 'bg-emerald-950/40 border-emerald-400 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                    : 'bg-[#140f0c] border-[#3a2a1a] text-[#d8c7a8] hover:border-[#d4af37]/60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={transferable}
                  onChange={(e) => setTransferable(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 h-4 w-4 accent-emerald-500 shrink-0 cursor-pointer"
                />
                <div className="flex-1 text-[11px] leading-snug">
                  <div className="font-extrabold text-xs flex flex-wrap items-center gap-1.5">
                    <span>
                      {transferable
                        ? '✅ Галочка включена: Оружие МОЖНО передавать другим игрокам (+50% к цене характеристик)'
                        : '🔒 Без галочки: Оружие НЕЛЬЗЯ передавать — носишь только сам (цена строго за характеристики)'}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-[#c9b79c] mt-1">
                    {transferable ? (
                      <>
                        Стоимость увеличена на <b className="text-emerald-300">+50%</b> от выбранных
                        характеристик ({baseStatCrystalCost} 💎 + {transferExtraCrystals} 💎 ={' '}
                        <b className="text-[#00f2fe]">{totalCrystalCost} 💎</b> / {baseStatGoldCost} 🪙 +{' '}
                        {transferExtraGold} 🪙 = <b className="text-[#ffd700]">{totalGoldCost} 🪙</b>).
                        Предмет можно <b>передавать</b>, <b>сдавать в аренду</b> и <b>продавать</b>.
                      </>
                    ) : (
                      <>
                        Цена без наценки — строго за выбранные характеристики:{' '}
                        <b className="text-[#00f2fe]">{baseStatCrystalCost} 💎</b> или{' '}
                        <b className="text-[#ffd700]">{baseStatGoldCost} 🪙</b>. Передавать другим
                        игрокам нельзя (носишь только сам, можно сдать в аренду или продать).
                      </>
                    )}
                  </div>
                </div>
              </label>

              {/* Быстрые кнопки переключения */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTransferable(false)}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    !transferable
                      ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#ffd700]'
                      : 'bg-[#120e0b] border-[#2c2016] text-[#998877]'
                  }`}
                >
                  <div className="font-extrabold text-[11px]">🔒 Нельзя передавать (только себе)</div>
                  <div className="text-[10px] opacity-90">
                    Цена характеристик: <b>{baseStatCrystalCost} 💎</b> / <b>{baseStatGoldCost} 🪙</b>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTransferable(true)}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    transferable
                      ? 'bg-emerald-950/50 border-emerald-400 text-emerald-200'
                      : 'bg-[#120e0b] border-[#2c2016] text-[#998877]'
                  }`}
                >
                  <div className="font-extrabold text-[11px]">🤝 Можно передавать (+50% к стоимости)</div>
                  <div className="text-[10px] opacity-90">
                    Цена (+50%): <b>{ baseStatCrystalCost + Math.ceil(baseStatCrystalCost * 0.5) } 💎</b> /{' '}
                    <b>{ baseStatGoldCost + Math.ceil(baseStatGoldCost * 0.5) } 🪙</b>
                  </div>
                </button>
              </div>

              {/* Сводка правил для созданного оружия */}
              <div className="rounded-lg bg-[#120d0a] border border-[#3a2a1a] p-2 text-[10.5px] text-[#d8c7a8] space-y-0.5">
                <div>
                  • 🏛️ <b>Аукцион:</b> созданное оружие <span className="text-red-400 font-bold">нельзя продать на аукционе</span>.
                </div>
                <div>
                  • 💰 <b>Продажа созданной вещи:</b> можно продать в любой момент и получить{' '}
                  <span className="text-emerald-300 font-bold">70% от затрат</span> (
                  {effectiveCurrency === 'gold'
                    ? `+${sellRefundGold} 🪙 золота`
                    : `+${sellRefundCrystals} 💎 кристаллов`}
                  ).
                </div>
                <div>
                  • 🤝 <b>Аренда и передача:</b> можно сдать в аренду; если стоит галочка «Можно передавать» — можно передавать другим игрокам, если не стоит — только сам носишь.
                </div>
              </div>
            </div>

            {/* 5. Выбор валюты оплаты и кнопки создания */}
            <div className="bg-[#17110d] border border-[#d4af37]/50 rounded-xl p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[#c2a878] font-bold">Способ оплаты создания:</div>
                  <div className="text-[10px] text-[#9a8668]">
                    При продаже этой вещи обратно вы получите 70%: {' '}
                    <b className="text-emerald-300">
                      {effectiveCurrency === 'gold'
                        ? `+${sellRefundGold} 🪙`
                        : `+${sellRefundCrystals} 💎`}
                    </b>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(allowedCurrency === 'both' || allowedCurrency === 'crystals') && (
                    <button
                      type="button"
                      onClick={() => setCurrency('crystals')}
                      className={`px-3 py-1.5 rounded-lg border font-bold text-xs cursor-pointer flex items-center gap-1 ${
                        currency === 'crystals' || allowedCurrency === 'crystals'
                          ? 'bg-[#00f2fe]/20 border-[#00f2fe] text-[#00f2fe]'
                          : 'bg-black/40 border-[#333] text-[#888]'
                      }`}
                    >
                      <span>💎 {totalCrystalCost} кристаллов</span>
                    </button>
                  )}
                  {(allowedCurrency === 'both' || allowedCurrency === 'gold') && (
                    <button
                      type="button"
                      onClick={() => setCurrency('gold')}
                      className={`px-3 py-1.5 rounded-lg border font-bold text-xs cursor-pointer flex items-center gap-1 ${
                        currency === 'gold' || allowedCurrency === 'gold'
                          ? 'bg-[#ffd700]/20 border-[#ffd700] text-[#ffd700]'
                          : 'bg-black/40 border-[#333] text-[#888]'
                      }`}
                    >
                      <span>🪙 {totalGoldCost} золота</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleCreate(false)}
                  className="w-full py-2.5 bg-gradient-to-b from-[#d4af37] to-[#8a6d1b] text-black font-extrabold rounded-lg uppercase text-xs cursor-pointer shadow-lg hover:brightness-110"
                >
                  🎒 Создать в сумку (100/100)
                </button>
                <button
                  type="button"
                  onClick={() => handleCreate(true)}
                  className="w-full py-2.5 bg-gradient-to-b from-emerald-500 to-emerald-800 text-white font-extrabold rounded-lg uppercase text-xs cursor-pointer shadow-lg hover:brightness-110 border border-emerald-400/50"
                >
                  ⚡ Создать и сразу надеть (100/100)
                </button>
              </div>
            </div>

            {/* 5. Памятка внизу: требования к картинке по размерам и весу */}
            <div className="bg-[#0e0b09] border border-[#d4af37]/40 rounded-xl p-3 text-[11px] leading-relaxed text-[#d8c7a8]">
              <div className="text-[#ffd700] font-extrabold uppercase text-xs mb-1.5 flex items-center gap-1.5">
                <span>📏 Требования к картинке для создаваемой амуниции (размер и вес):</span>
              </div>
              <ul className="space-y-1 list-disc list-inside text-[#c9b79c]">
                <li>
                  <b>Стандартный размер игры:</b>{' '}
                  <span className="text-white font-bold">128×128 пикселей</span> (квадрат{' '}
                  <span className="text-[#ffd700] font-bold">1:1</span>, отображается в слотах
                  экипировки <span className="text-white">64×64 px</span> и сумки{' '}
                  <span className="text-white">44×44 px</span>).
                </li>
                <li>
                  <b>Допустимые размеры исходника:</b> от{' '}
                  <span className="text-white">32×32 px</span> до{' '}
                  <span className="text-white">4096×4096 px</span> — игра автоматически центрирует и
                  подгонит вашу картинку под стандартный квадрат <b>128×128 px</b> без искажений.
                </li>
                <li>
                  <b>Максимальный вес файла:</b> до{' '}
                  <span className="text-[#00f2fe] font-bold">2 МБ (2048 КБ)</span> при загрузке
                  (автоматически сжимается до <b>15–40 КБ</b> для мгновенной загрузки у всех игроков).
                </li>
                <li>
                  <b>Поддерживаемые форматы:</b>{' '}
                  <span className="text-emerald-300 font-bold">PNG</span> (рекомендуется с прозрачным
                  фоном), <span className="text-emerald-300 font-bold">WEBP, JPG / JPEG, GIF, SVG</span>.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
