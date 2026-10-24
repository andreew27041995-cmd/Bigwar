import React, { useState, useEffect } from 'react';
import { HeroState, ShopItemTemplate, ItemSlot, GameItem, CharacterSkinTemplate } from '../../types/game';
import { SHOP_CATEGORY_LABELS, getShopSkins, getActiveSkinBonuses, getPremiumConfig } from '../../utils/shopConfig';
import {
  EGYPTIAN_SLOT_SVGS,
  KILLER_LICENSE_CONFIG,
  KILLER_ACHIEVEMENT_LEVELS,
  KILLER_ACHIEVEMENT_DESCRIPTION,
  getKillerAchievementInfo,
  formatLicenseRemainingTime
} from '../../utils/egyptianEquipment';
import { ItemIcon } from '../ItemIcon';
import { CharacterAvatar } from '../CharacterAvatar';
import { GoldCoinIcon, CrystalIcon } from '../CurrencyIcon';

type ShopTabId = ItemSlot | 'elixirs' | 'skins' | 'licenses';

interface ShopModalProps {
  hero: HeroState;
  inventory?: GameItem[];
  shopItems: ShopItemTemplate[];
  shopSkins?: CharacterSkinTemplate[];
  onBuyItem: (template: ShopItemTemplate) => void;
  onBuyElixir?: (type: 'hp' | 'en' | 'exp', quantity: number) => void;
  onBuySkin?: (skin: CharacterSkinTemplate) => void;
  onEquipSkin?: (skin: CharacterSkinTemplate | null) => void;
  onBuyKillerLicense?: (activateNow: boolean) => void;
  onUseKillerLicense?: () => void;
  onOpenAuction?: () => void;
  onOpenCreateItem?: () => void;
  onClose: () => void;
}

const SHOP_CATEGORIES: { id: ShopTabId; label: string; icon: string }[] = [
  { id: 'weapon', label: 'Оружие', icon: EGYPTIAN_SLOT_SVGS.weapon },
  { id: 'armor', label: 'Броня', icon: EGYPTIAN_SLOT_SVGS.armor },
  { id: 'pants', label: 'Штаны', icon: EGYPTIAN_SLOT_SVGS.pants },
  { id: 'boots', label: 'Сапоги', icon: EGYPTIAN_SLOT_SVGS.boots },
  { id: 'gloves', label: 'Перчатки', icon: EGYPTIAN_SLOT_SVGS.gloves },
  { id: 'ring', label: 'Кольцо', icon: EGYPTIAN_SLOT_SVGS.ring },
  { id: 'licenses', label: 'Лицензии', icon: KILLER_LICENSE_CONFIG.icon },
  { id: 'elixirs', label: 'Эликсиры', icon: '🧪' },
  { id: 'skins', label: 'Скины', icon: '🎨' }
];

export const ShopModal: React.FC<ShopModalProps> = ({
  hero,
  inventory = [],
  shopItems,
  shopSkins,
  onBuyItem,
  onBuyElixir,
  onBuySkin,
  onEquipSkin,
  onBuyKillerLicense,
  onUseKillerLicense,
  onOpenAuction,
  onOpenCreateItem,
  onClose
}) => {
  const [activeCategory, setActiveCategory] = useState<ShopTabId>('weapon');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const heroLvl = Math.max(1, Number(hero.level || (hero as any).lvl || 1));
  const heroGold = Number(hero.gold || 0);
  const heroCrystals = Number(hero.crystals || 0);
  const heroHpPotions = Number(hero.hpPotions || 0);
  const heroEnPotions = Number(hero.enPotions || 0);
  const heroExpPotions = Number(hero.expPotions || 0);

  const allSkins = Array.isArray(shopSkins) ? shopSkins : getShopSkins();
  const enabledSkins = allSkins
    .filter((s) => s.enabled !== false && !s.isExclusive && !s.isPersonal)
    .sort((a, b) => Number(a.lvl || 1) - Number(b.lvl || 1));
  const ownedSkinIds = Array.isArray(hero.ownedSkinIds) ? hero.ownedSkinIds : [];
  const activeSkinId = hero.activeSkinId || null;
  const activeSkinData = getActiveSkinBonuses(activeSkinId, allSkins);

  const bagItems = Array.isArray(inventory)
    ? inventory
    : Array.isArray((hero as any).inventory)
    ? (hero as any).inventory
    : [];
  const isVip = Boolean(hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now());
  const premCfg = getPremiumConfig();
  const bagCapacity =
    Math.max(20, Number(hero.bagCapacity || 100)) +
    (isVip ? premCfg.bagBonus : 0) +
    activeSkinData.bagBonus;
  const isBagFull = bagItems.length >= bagCapacity;

  const filteredItems =
    activeCategory === 'elixirs' || activeCategory === 'skins' || activeCategory === 'licenses'
      ? []
      : shopItems
          .filter((item) => {
            if (item.enabled === false) return false;
            const itemSlot = item.slot || (item as any).type || 'weapon';
            if (activeCategory === 'gloves') {
              return itemSlot === 'gloves' || (itemSlot as string) === 'helmet';
            }
            return itemSlot === activeCategory;
          })
          .sort((a, b) => Number(a.lvl || 1) - Number(b.lvl || 1) || Number(a.price || 0) - Number(b.price || 0));

  return (
    <div className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col p-3 overflow-hidden text-white">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2.5 pb-2 border-b border-yellow-600/30">
        <div>
          <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
            🛒 Магазин экипировки, эликсиров и скинов
          </h2>
          <p className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
            <span>
              Сумка: <span className="text-white font-bold">{bagItems.length}/{bagCapacity}</span>
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              Золото: <span className="text-yellow-400 font-bold">{heroGold.toLocaleString()}</span>
              <GoldCoinIcon size="xs" />
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              Кристаллы: <span className="text-cyan-300 font-bold">{heroCrystals}</span>
              <CrystalIcon size="xs" />
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {onOpenAuction && (
            <button
              type="button"
              onClick={onOpenAuction}
              className="rounded-lg border-2 border-yellow-400/90 bg-gradient-to-b from-yellow-900/90 to-amber-950 px-2.5 py-1 text-[10px] font-extrabold text-yellow-200 shadow-[0_0_10px_rgba(250,204,21,0.3)] hover:border-yellow-300 active:scale-95 cursor-pointer"
              title="Открыть Аукцион игроков"
            >
              🏛️ Аукцион
            </button>
          )}
          {onOpenCreateItem && (
            <button
              type="button"
              onClick={onOpenCreateItem}
              className="rounded-lg border-2 border-cyan-400/90 bg-gradient-to-b from-cyan-900/90 to-slate-950 px-2.5 py-1 text-[10px] font-extrabold text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.3)] hover:border-cyan-300 active:scale-95 cursor-pointer"
              title="Кузница: создать своё оружие или амуницию"
            >
              ⚒️ Создать оружие
            </button>
          )}
          <button
            onClick={onClose}
            className="text-red-400 hover:text-red-300 text-lg font-bold px-2"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Featured Experience Elixir Card in Shop */}
      <div className="mb-2.5 rounded-xl border border-purple-500/50 bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-900 p-2.5 flex items-center justify-between gap-2.5 shrink-0 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="text-2xl bg-slate-950 w-10 h-10 rounded-xl flex items-center justify-center border border-purple-500/40 shrink-0">
            ✨
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs text-purple-200">
                Эликсир Опыта
              </span>
              <span className="text-[9.5px] bg-purple-950/80 border border-purple-500/40 text-purple-300 px-1.5 py-0.5 rounded font-bold">
                +25% к опыту · 30 мин
              </span>
            </div>
            <div className="text-[9.5px] text-slate-300 mt-0.5">
              Цена: <strong className="text-cyan-300">3 💎 кристалла</strong> за 1 шт. · У вас:{' '}
              <strong className="text-purple-300">{heroExpPotions} шт.</strong>
              {onOpenAuction && (
                <button
                  type="button"
                  onClick={onOpenAuction}
                  className="ml-2 text-amber-300 hover:text-amber-200 underline font-semibold cursor-pointer"
                >
                  🏛️ Также в Аукционе
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onBuyElixir && (
            <>
              <button
                type="button"
                onClick={() => onBuyElixir('exp', 1)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all active:scale-95 cursor-pointer ${
                  heroCrystals >= 3
                    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.45)]'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                Купить 1шт (3💎)
              </button>
              <button
                type="button"
                onClick={() => onBuyElixir('exp', 5)}
                className={`px-2 py-1.5 rounded-lg text-[9.5px] font-bold transition-all active:scale-95 cursor-pointer ${
                  heroCrystals >= 15
                    ? 'bg-purple-900/80 border border-purple-500/60 text-purple-200 hover:bg-purple-800'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}
                title="Купить 5 эликсиров опыта за 15 кристаллов"
              >
                x5 (15💎)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5 mb-2.5 shrink-0">
        {SHOP_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          const count =
            cat.id === 'elixirs'
              ? 3
              : cat.id === 'licenses'
              ? 1
              : cat.id === 'skins'
              ? enabledSkins.length
              : shopItems.filter((i) => {
                  if (i.enabled === false) return false;
                  const s = i.slot || (i as any).type || 'weapon';
                  return cat.id === 'gloves' ? s === 'gloves' || (s as string) === 'helmet' : s === cat.id;
                }).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`py-1.5 px-1 rounded-lg text-[9.5px] font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                isActive
                  ? cat.id === 'licenses'
                    ? 'bg-gradient-to-b from-red-500 to-amber-500 border-red-300 text-slate-950 shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                    : 'bg-amber-500 border-amber-400 text-slate-950 shadow-md'
                  : cat.id === 'licenses'
                  ? 'bg-red-950/60 border-red-500/60 text-red-200 hover:border-red-400'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              <span className="w-5 h-5 flex items-center justify-center text-sm leading-none">
                <ItemIcon icon={cat.icon} alt={cat.label} imgClassName="w-full h-full object-contain" />
              </span>
              <span className="truncate max-w-full">{cat.label}</span>
              <span className={`text-[8px] ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Items / Licenses / Elixirs / Skins list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {activeCategory === 'licenses' ? (
          (() => {
            const killerUntil = Number(hero.killerLicenseUntil || 0);
            const isLicenseActive = killerUntil > nowMs;
            const storedLicenses = Math.max(0, Number(hero.killerLicenses || 0));
            const canAffordLicense = heroCrystals >= KILLER_LICENSE_CONFIG.costCrystals;
            const killerAch = getKillerAchievementInfo(hero.pvpKills || 0);

            return (
              <div className="space-y-3">
                {/* Active Killer License Status Banner (чтобы не забыть про действие лицензии) */}
                <div
                  className={`rounded-xl border-2 p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-lg ${
                    isLicenseActive
                      ? 'border-red-500/80 bg-gradient-to-r from-red-950/90 via-amber-950/50 to-slate-950 shadow-[0_0_20px_rgba(239,68,68,0.28)]'
                      : 'border-amber-500/45 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-12 h-12 rounded-xl border-2 border-red-500/60 bg-slate-950 flex items-center justify-center p-1 shrink-0 shadow-inner">
                      <ItemIcon
                        icon={KILLER_LICENSE_CONFIG.icon}
                        alt={KILLER_LICENSE_CONFIG.name}
                        imgClassName="w-full h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-red-300">
                          {isLicenseActive
                            ? '🗡️ Лицензия киллера АКТИВНА!'
                            : '🔒 Лицензия киллера не активна'}
                        </span>
                        {storedLicenses > 0 && (
                          <span className="rounded bg-amber-950/90 border border-amber-400/60 px-1.5 py-0.5 text-[9px] font-black text-amber-300">
                            📦 В запасе: {storedLicenses} шт.
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-300 mt-0.5">
                        {isLicenseActive ? (
                          <span>
                            ⏳ Осталось времени действия:{' '}
                            <strong className="font-mono text-emerald-300 text-[11px]">
                              {formatLicenseRemainingTime(killerUntil, nowMs)}
                            </strong>{' '}
                            (до {new Date(killerUntil).toLocaleString('ru-RU')})
                          </span>
                        ) : (
                          <span>
                            Без активной лицензии нападать на игроков в Пирамиде нельзя. Купите или активируйте лицензию на 1 день!
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {storedLicenses > 0 && onUseKillerLicense && (
                    <button
                      type="button"
                      onClick={onUseKillerLicense}
                      className="rounded-xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-3 py-1.5 text-[10px] font-black text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] active:scale-95 cursor-pointer shrink-0"
                    >
                      🗡️ Использовать из запаса (+1 дн.)
                    </button>
                  )}
                </div>

                {/* Main Card: 1. Лицензия киллера (Рецензия киллера) */}
                <div className="rounded-2xl border-2 border-amber-500/60 bg-gradient-to-b from-[#24160e] via-slate-900 to-slate-950 p-3.5 shadow-[0_0_25px_rgba(245,158,11,0.18)] space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-amber-500/25 pb-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-2xl border-2 border-amber-400 bg-slate-950 flex items-center justify-center p-1.5 shrink-0 shadow-[0_0_14px_rgba(245,158,11,0.35)]">
                        <ItemIcon
                          icon={KILLER_LICENSE_CONFIG.icon}
                          alt={KILLER_LICENSE_CONFIG.name}
                          imgClassName="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-black text-amber-300">
                            1. {KILLER_LICENSE_CONFIG.name} (Рецензия киллера)
                          </span>
                          <span className="rounded-md bg-red-950/90 border border-red-500/60 px-2 py-0.5 text-[9.5px] font-black text-red-300">
                            ⏱️ Срок действия: {KILLER_LICENSE_CONFIG.durationLabel} (24 часа)
                          </span>
                        </div>
                        <div className="text-[10.5px] text-cyan-300 font-extrabold mt-1 flex items-center gap-1.5">
                          <span>Стоимость:</span>
                          <span className="inline-flex items-center gap-1 rounded bg-cyan-950/90 border border-cyan-400/60 px-2 py-0.5 text-cyan-200 font-black">
                            {KILLER_LICENSE_CONFIG.costCrystals} 💎 кристаллов
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-col items-end gap-1.5 w-full sm:w-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => onBuyKillerLicense?.(true)}
                        disabled={!canAffordLicense}
                        className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-[10.5px] font-black transition-all cursor-pointer ${
                          canAffordLicense
                            ? 'bg-gradient-to-r from-red-600 via-amber-500 to-red-600 hover:brightness-110 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] active:scale-95'
                            : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        }`}
                      >
                        {canAffordLicense
                          ? isLicenseActive
                            ? '⚡ Купить и продлить (+1 дн. · 10 💎)'
                            : '⚡ Купить и использовать (10 💎)'
                          : 'Мало кристаллов (10 💎)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onBuyKillerLicense?.(false)}
                        disabled={!canAffordLicense}
                        className={`px-3 py-1.5 rounded-lg text-[9.5px] font-bold transition-all cursor-pointer ${
                          canAffordLicense
                            ? 'bg-slate-800 hover:bg-slate-700 border border-amber-500/50 text-amber-200 active:scale-95'
                            : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                        }`}
                        title="Купить лицензию про запас и активировать в любой момент"
                      >
                        📦 Купить в запас (10 💎)
                      </button>
                    </div>
                  </div>

                  {/* Detailed Description of Killer License */}
                  <div className="rounded-xl border border-amber-500/30 bg-slate-950/85 p-2.5 space-y-1.5 text-[10px] text-slate-200 leading-relaxed">
                    <div className="font-black text-amber-300 uppercase tracking-wider text-[10px]">
                      📜 Описание и правила действия «Лицензии киллера»:
                    </div>
                    <p>{KILLER_LICENSE_CONFIG.description}</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[9.5px] text-slate-300">
                      <li>
                        <strong className="text-red-300">Атака ТОЛЬКО в Пирамиде:</strong> Убивать других игроков можно исключительно находясь внутри Пирамиды на соседней клетке (нападать через профиль на главной или в рейтинге нельзя).
                      </li>
                      <li>
                        <strong className="text-amber-300">Повторные убийства разрешены:</strong> Разрешается убивать одного и того же игрока неограниченное количество раз — каждое убийство идёт в зачёт!
                      </li>
                      <li>
                        <strong className="text-emerald-300">Срок действия 1 день (24 часа):</strong> Таймер действия лицензии отображается в Пирамиде, в профиле Персонажа и в Магазине, чтобы вы никогда не забыли о времени действия.
                      </li>
                    </ul>
                  </div>

                  {/* Linked Killer Achievement Info Block */}
                  <div className="rounded-xl border border-red-500/40 bg-gradient-to-b from-red-950/35 to-slate-950/90 p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-[10.5px] font-black text-red-300 flex items-center gap-1.5">
                        <span>🏆 Достижение персонажа: «Киллер» (Макс. 5 ур.)</span>
                      </div>
                      <span className="rounded bg-emerald-950/90 border border-emerald-500/50 px-2 py-0.5 text-[9.5px] font-black text-emerald-300">
                        Ваш уровень: {killerAch.level}/5 • Бонус: +{killerAch.totalHpBonus} ❤️ HP навсегда
                      </span>
                    </div>
                    <p className="text-[9.5px] text-slate-300 leading-snug">
                      {KILLER_ACHIEVEMENT_DESCRIPTION}
                    </p>
                    <div className="grid grid-cols-5 gap-1 pt-0.5">
                      {KILLER_ACHIEVEMENT_LEVELS.map((tier) => {
                        const unlocked = killerAch.kills >= tier.killsRequired;
                        return (
                          <div
                            key={tier.level}
                            className={`rounded-lg border p-1.5 text-center ${
                              unlocked
                                ? 'border-emerald-400/80 bg-emerald-950/50 text-emerald-200'
                                : 'border-slate-800 bg-slate-900/80 text-slate-400'
                            }`}
                          >
                            <div className="text-[9px] font-black text-amber-300">
                              {tier.level} ур. {unlocked ? '✅' : '🔒'}
                            </div>
                            <div className="text-[8.5px] font-bold mt-0.5">
                              {tier.killsRequired} уб.
                            </div>
                            <div className="text-[8px] text-red-300 font-extrabold mt-0.5">
                              +100 ❤️ HP
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        ) : activeCategory === 'skins' ? (
          <div className="space-y-2.5">
            {/* Active Skin Status Banner */}
            <div className="rounded-xl border border-fuchsia-500/50 bg-gradient-to-r from-fuchsia-950/60 via-slate-900 to-slate-900 p-2.5 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-11 h-11 rounded-xl border border-fuchsia-400/50 bg-slate-950/60 flex items-center justify-center overflow-hidden p-1">
                    <CharacterAvatar avatar={hero.avatar} size="lg" alt={hero.nick} />
                  </div>
                  <div className="flex flex-col items-center">
                    <div
                      className="relative w-[25px] h-[25px] rounded border-2 border-amber-300 bg-gradient-to-br from-[#d9ad78] via-[#ab7d49] to-[#6e4a23] flex items-center justify-center shadow-[0_0_8px_rgba(250,204,21,0.7)]"
                      title="Вид воина при передвижении по клеткам Пирамиды (прозрачный фон)"
                    >
                      <span className="pointer-events-none absolute bottom-0.5 h-1.5 w-4 rounded-full bg-black/50 blur-[0.5px]" />
                      <CharacterAvatar avatar={hero.avatar} size="sm" alt="В пирамиде" className="relative z-10" />
                    </div>
                    <span className="text-[7.5px] text-amber-300 font-bold mt-0.5">Пирамида</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-fuchsia-200">
                    {activeSkinData.skin
                      ? `🎭 Активный скин: ${activeSkinData.skin.name}`
                      : '🎭 Активный облик: Стандартный скин'}
                  </div>
                  <div className="text-[9.5px] text-slate-300 mt-0.5">
                    Куплено скинов: <strong className="text-fuchsia-300">{ownedSkinIds.length}</strong> · Прозрачный фон (по Пирамиде передвигается сам воин на каменной плите).
                  </div>
                </div>
              </div>
              {activeSkinId && onEquipSkin && (
                <button
                  type="button"
                  onClick={() => onEquipSkin(null)}
                  className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-[9.5px] font-bold text-slate-200 cursor-pointer"
                >
                  Снять скин
                </button>
              )}
            </div>

            {enabledSkins.length === 0 ? (
              <div className="text-center text-slate-500 mt-10 text-xs">
                В разделе «Скины персонажа» пока нет доступных обликов.
              </div>
            ) : (
              enabledSkins.map((skin) => {
                const isOwned = ownedSkinIds.includes(skin.id);
                const isEquipped = activeSkinId === skin.id;
                const meetsLevel = heroLvl >= Number(skin.lvl || 1);
                const isCrystalPrice = skin.currency === 'crystals';
                const priceAmount = isCrystalPrice
                  ? Math.max(0, Number(skin.priceCrystals || 0))
                  : Math.max(0, Number(skin.priceGold || 0));
                const canAfford = isCrystalPrice
                  ? heroCrystals >= priceAmount
                  : heroGold >= priceAmount;

                return (
                  <div
                    key={skin.id}
                    className={`rounded-xl p-2.5 flex items-center justify-between gap-2.5 shadow-md border transition-all ${
                      isEquipped
                        ? 'bg-fuchsia-950/35 border-fuchsia-400/70 shadow-[0_0_15px_rgba(217,70,239,0.2)]'
                        : isOwned
                        ? 'bg-slate-900/95 border-emerald-500/45'
                        : 'bg-slate-900/90 border-amber-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Profile preview + Standard Pyramid cell preview */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-12 h-12 rounded-xl bg-slate-950/60 border border-fuchsia-500/40 flex items-center justify-center overflow-hidden p-1">
                          <CharacterAvatar avatar={skin.icon} size="lg" alt={skin.name} />
                        </div>
                        <div className="flex flex-col items-center">
                          <div
                            className="relative w-[25px] h-[25px] rounded border-2 border-amber-300 bg-gradient-to-br from-[#d9ad78] via-[#ab7d49] to-[#6e4a23] flex items-center justify-center overflow-hidden shadow-[0_0_6px_rgba(250,204,21,0.5)]"
                            title="Вид воина при передвижении по Пирамиде (прозрачный фон на плите)"
                          >
                            <span className="pointer-events-none absolute bottom-0.5 h-1.5 w-4 rounded-full bg-black/50 blur-[0.5px]" />
                            <CharacterAvatar avatar={skin.icon} size="sm" alt={skin.name} className="relative z-10" />
                          </div>
                          <span className="text-[7px] text-amber-300/90 font-semibold mt-0.5">Плита</span>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-fuchsia-200 truncate">
                            {skin.name}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                              meetsLevel
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                            }`}
                          >
                            {skin.lvl} ур.
                          </span>
                          {isEquipped && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-fuchsia-600 text-white">
                              НАДЕТ
                            </span>
                          )}
                          {isOwned && !isEquipped && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                              Куплен
                            </span>
                          )}
                        </div>

                        {/* All 10 Game Bonuses */}
                        <div className="flex flex-wrap gap-1 mt-1 text-[9.5px]">
                          {skin.hpBonus > 0 && (
                            <span className="bg-red-950/50 border border-red-500/30 text-red-300 px-1.5 py-0.5 rounded font-semibold">
                              ❤️ +{skin.hpBonus} HP
                            </span>
                          )}
                          {skin.dmgBonus > 0 && (
                            <span className="bg-orange-950/50 border border-orange-500/30 text-orange-300 px-1.5 py-0.5 rounded font-semibold">
                              ⚔️ +{skin.dmgBonus} урон
                            </span>
                          )}
                          {skin.strBonus > 0 && (
                            <span className="bg-rose-950/50 border border-rose-500/30 text-rose-300 px-1.5 py-0.5 rounded font-semibold">
                              💪 +{skin.strBonus} сила
                            </span>
                          )}
                          {skin.agiBonus > 0 && (
                            <span className="bg-teal-950/50 border border-teal-500/30 text-teal-300 px-1.5 py-0.5 rounded font-semibold">
                              🤸 +{skin.agiBonus} ловк.
                            </span>
                          )}
                          {skin.vitBonus > 0 && (
                            <span className="bg-pink-950/50 border border-pink-500/30 text-pink-300 px-1.5 py-0.5 rounded font-semibold">
                              🩸 +{skin.vitBonus} живуч.
                            </span>
                          )}
                          {skin.dodgeBonus > 0 && (
                            <span className="bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded font-semibold">
                              💨 +{skin.dodgeBonus}% уклон.
                            </span>
                          )}
                          {skin.energyBonus > 0 && (
                            <span className="bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 px-1.5 py-0.5 rounded font-semibold">
                              ⚡ +{skin.energyBonus} энерг.
                            </span>
                          )}
                          {skin.goldBonusPct > 0 && (
                            <span className="bg-yellow-950/50 border border-yellow-500/30 text-yellow-300 px-1.5 py-0.5 rounded font-semibold">
                              💰 +{skin.goldBonusPct}% золота
                            </span>
                          )}
                          {skin.expBonusPct > 0 && (
                            <span className="bg-purple-950/50 border border-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded font-semibold">
                              ✨ +{skin.expBonusPct}% опыта
                            </span>
                          )}
                          {skin.bagBonus > 0 && (
                            <span className="bg-indigo-950/50 border border-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded font-semibold">
                              🎒 +{skin.bagBonus} слотов
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {!isOwned && (
                        <div
                          className={`text-xs font-black ${
                            isCrystalPrice ? 'text-cyan-300' : 'text-yellow-400'
                          }`}
                        >
                          {priceAmount.toLocaleString()} {isCrystalPrice ? '💎' : '🪙'}
                        </div>
                      )}
                      {isOwned ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[8.5px] font-black text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 px-2 py-0.5 rounded" title="Скин нельзя купить повторно (1 скин на 1 персонажа)">
                            ✅ В коллекции (1/1)
                          </span>
                          <button
                            type="button"
                            onClick={() => onEquipSkin?.(isEquipped ? null : skin)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer active:scale-95 ${
                              isEquipped
                                ? 'bg-slate-800 border border-fuchsia-400/60 text-fuchsia-200 hover:bg-slate-700'
                                : 'bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white shadow-md'
                            }`}
                          >
                            {isEquipped ? 'Снять скин' : '🎭 Надеть'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onBuySkin?.(skin)}
                          disabled={!canAfford || !meetsLevel}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                            !canAfford || !meetsLevel
                              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                              : isCrystalPrice
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 shadow-md active:scale-95'
                              : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-md active:scale-95'
                          }`}
                        >
                          {!meetsLevel
                            ? `Нужен ${skin.lvl} ур.`
                            : canAfford
                            ? 'Купить скин'
                            : isCrystalPrice
                            ? 'Мало 💎'
                            : 'Мало 🪙'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : activeCategory === 'elixirs' ? (
          <div className="space-y-2">
            {/* 1. Experience Elixir */}
            <div className="bg-slate-900/95 border border-purple-500/45 rounded-xl p-2.5 flex items-center justify-between gap-2.5 shadow-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="text-2xl bg-slate-950 w-11 h-11 rounded-xl flex items-center justify-center border border-purple-500/40 shrink-0">
                  ✨
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-purple-200">
                      Эликсир Опыта
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold border bg-purple-950/60 border-purple-500/40 text-purple-300">
                      Временный бонус
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                    <span className="bg-purple-950/50 border border-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded font-semibold">
                      ✨ +25% к опыту
                    </span>
                    <span className="bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 px-1.5 py-0.5 rounded font-semibold">
                      ⏱️ Действие: 30 минут
                    </span>
                  </div>
                  <div className="text-[9.5px] text-slate-400 mt-1">
                    В наличии у вас: <strong className="text-purple-300">{heroExpPotions} шт.</strong> · Доступен в Магазине и Аукционе
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="text-xs font-black text-cyan-300">3 💎</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onBuyElixir?.('exp', 1)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all active:scale-95 cursor-pointer ${
                      heroCrystals >= 3
                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    Купить 1шт
                  </button>
                  <button
                    type="button"
                    onClick={() => onBuyElixir?.('exp', 5)}
                    className={`px-2 py-1.5 rounded-lg text-[9.5px] font-bold transition-all active:scale-95 cursor-pointer ${
                      heroCrystals >= 15
                        ? 'bg-purple-900/80 border border-purple-500/60 text-purple-200 hover:bg-purple-800'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}
                  >
                    x5 (15💎)
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Health Elixir */}
            <div className="bg-slate-900/95 border border-red-500/35 rounded-xl p-2.5 flex items-center justify-between gap-2.5 shadow-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="text-2xl bg-slate-950 w-11 h-11 rounded-xl flex items-center justify-center border border-red-500/35 shrink-0">
                  🧪
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-red-200">
                      Эликсир Здоровья
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold border bg-red-950/60 border-red-500/40 text-red-300">
                      Мгновенное
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                    <span className="bg-red-950/50 border border-red-500/30 text-red-300 px-1.5 py-0.5 rounded font-semibold">
                      ❤️ +50 здоровья
                    </span>
                  </div>
                  <div className="text-[9.5px] text-slate-400 mt-1">
                    В наличии у вас: <strong className="text-red-300">{heroHpPotions} шт.</strong>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="text-xs font-black text-yellow-400">100 🪙</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onBuyElixir?.('hp', 1)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all active:scale-95 cursor-pointer ${
                      heroGold >= 100
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    Купить 1шт
                  </button>
                  <button
                    type="button"
                    onClick={() => onBuyElixir?.('hp', 5)}
                    className={`px-2 py-1.5 rounded-lg text-[9.5px] font-bold transition-all active:scale-95 cursor-pointer ${
                      heroGold >= 500
                        ? 'bg-red-900/80 border border-red-500/60 text-red-200 hover:bg-red-800'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}
                  >
                    x5 (500🪙)
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Energy Elixir */}
            <div className="bg-slate-900/95 border border-sky-500/35 rounded-xl p-2.5 flex items-center justify-between gap-2.5 shadow-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="text-2xl bg-slate-950 w-11 h-11 rounded-xl flex items-center justify-center border border-sky-500/35 shrink-0">
                  ⚡
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-sky-200">
                      Эликсир Энергии
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold border bg-sky-950/60 border-sky-500/40 text-sky-300">
                      Мгновенное
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                    <span className="bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 px-1.5 py-0.5 rounded font-semibold">
                      ⚡ +20 энергии
                    </span>
                  </div>
                  <div className="text-[9.5px] text-slate-400 mt-1">
                    В наличии у вас: <strong className="text-sky-300">{heroEnPotions} шт.</strong>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="text-xs font-black text-yellow-400">100 🪙</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onBuyElixir?.('en', 1)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all active:scale-95 cursor-pointer ${
                      heroGold >= 100
                        ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    Купить 1шт
                  </button>
                  <button
                    type="button"
                    onClick={() => onBuyElixir?.('en', 5)}
                    className={`px-2 py-1.5 rounded-lg text-[9.5px] font-bold transition-all active:scale-95 cursor-pointer ${
                      heroGold >= 500
                        ? 'bg-sky-900/80 border border-sky-500/60 text-sky-200 hover:bg-sky-800'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}
                  >
                    x5 (500🪙)
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center text-slate-500 mt-12 text-xs">
            В категории «{SHOP_CATEGORY_LABELS[activeCategory]}» пока нет товаров.
          </div>
        ) : (
          filteredItems.map((item) => {
            const itemPrice = Math.max(0, Number(item.price || 0));
            const canAfford = heroGold >= itemPrice;
            const meetsLevel = heroLvl >= Number(item.lvl || 1);
            return (
              <div
                key={item.id}
                className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-2.5 flex items-center justify-between gap-2.5 shadow-md"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="text-2xl bg-slate-950 w-11 h-11 rounded-xl flex items-center justify-center border border-amber-500/40 shrink-0 overflow-hidden p-1 shadow-inner">
                    <ItemIcon
                      icon={item.icon}
                      alt={item.name}
                      slot={(item.slot || (item as any).type || 'weapon') as ItemSlot}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-amber-200 truncate">
                        {item.name}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                          meetsLevel
                            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                            : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                        }`}
                      >
                        {item.lvl} ур.
                      </span>
                    </div>

                    {/* Item bonuses */}
                    <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                      {item.hp > 0 && (
                        <span className="bg-red-950/50 border border-red-500/30 text-red-300 px-1.5 py-0.5 rounded font-semibold">
                          ❤️ +{item.hp} здоровья
                        </span>
                      )}
                      {item.dmg > 0 && (
                        <span className="bg-orange-950/50 border border-orange-500/30 text-orange-300 px-1.5 py-0.5 rounded font-semibold">
                          ⚔️ +{item.dmg} урона
                        </span>
                      )}
                      {item.dodgeBonus > 0 && (
                        <span className="bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded font-semibold">
                          💨 +{item.dodgeBonus}% уклонения
                        </span>
                      )}
                      {item.energyBonus > 0 && (
                        <span className="bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 px-1.5 py-0.5 rounded font-semibold">
                          ⚡ +{item.energyBonus} энергии
                        </span>
                      )}
                      {item.goldBonusPct > 0 && (
                        <span className="bg-yellow-950/50 border border-yellow-500/30 text-yellow-300 px-1.5 py-0.5 rounded font-semibold">
                          💰 +{item.goldBonusPct}% к золоту
                        </span>
                      )}
                      {item.expBonusPct > 0 && (
                        <span className="bg-purple-950/50 border border-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded font-semibold">
                          ✨ +{item.expBonusPct}% к опыту
                        </span>
                      )}
                    </div>

                    <div className="text-[9.5px] text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                      <span>
                        🔧 Прочность: <strong className="text-slate-200">{item.maxDurability}/{item.maxDurability}</strong>
                      </span>
                      <span>
                        Продажа: <strong className="text-amber-400">{Math.max(1, Math.floor(itemPrice * 0.3))} 🪙</strong> (30%)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="text-xs font-black text-yellow-400">
                    {itemPrice} 🪙
                  </div>
                  <button
                    type="button"
                    onClick={() => onBuyItem(item)}
                    disabled={!canAfford || isBagFull}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                      !canAfford || isBagFull
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-md active:scale-95'
                    }`}
                  >
                    {isBagFull ? 'Сумка полна' : canAfford ? 'Купить' : 'Мало золота'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
