import React, { useRef, useState } from 'react';
import { GameFeatureFlags, GameItem, HeroState, ItemSlot } from '../../types/game';
import { SLOT_INFO } from '../../utils/gameData';
import { DEFAULT_FEATURE_FLAGS, formatItemBonusesText } from '../../utils/shopConfig';
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
  ring: SLOT_INFO.ring.name
};

const SLOT_ICONS: Record<ItemSlot, string> = {
  weapon: SLOT_INFO.weapon.icon,
  armor: SLOT_INFO.armor.icon,
  pants: SLOT_INFO.pants.icon,
  boots: SLOT_INFO.boots.icon,
  gloves: SLOT_INFO.gloves.icon,
  ring: SLOT_INFO.ring.icon
};

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
  ring: ['💍', '💎', '🔮', '🧿', '👑', '☀️', '🌙']
};

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
  ]
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

  const [name, setName] = useState('');
  const [slot, setSlot] = useState<ItemSlot>('weapon');
  const [icon, setIcon] = useState<string>('/assets/swords/new_sword_lvl2.png');
  const [iconSourceType, setIconSourceType] = useState<'preset' | 'upload' | 'url'>('preset');
  const [customUrl, setCustomUrl] = useState('');
  const [uploadedInfo, setUploadedInfo] = useState<ProcessedItemImageResult | null>(null);
  const [isProcessingImg, setIsProcessingImg] = useState(false);

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

  const statCostCrystals = Math.max(1, Number(flags.customCostPerStatCrystals ?? 1));
  const statCostGold = Math.max(1, Number(flags.customCostPerStatGold ?? 50));

  // Расчёт стоимости строго по выбранным характеристикам
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
    setIcon(res.dataUrl);
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
    setIcon(trimmed);
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
      <div className="bg-gradient-to-b from-[#221b15] to-[#120e0b] border-2 border-[#d4af37] w-full max-w-[560px] rounded-xl p-4 relative text-[#f4e4bc] shadow-[0_0_50px_rgba(0,0,0,1)] max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#d4af37]/30 pb-2.5 mb-3">
          <div>
            <h2 className="text-[#d4af37] text-base sm:text-lg font-bold uppercase tracking-wider flex items-center gap-2">
              <span>⚒️ Кузница: Создать оружие и амуницию</span>
            </h2>
            <p className="text-[11px] text-[#a08c70]">
              Создайте собственное оружие или экипировку и загрузите свою картинку
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

        {!creationEnabled ? (
          <div className="bg-red-950/40 border border-red-500/50 rounded-lg p-4 text-center text-red-300 text-xs">
            ⚠️ Кузница создания предметов временно закрыта администратором.
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
                  {(Object.keys(SLOT_NAMES) as ItemSlot[]).map((s) => (
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
