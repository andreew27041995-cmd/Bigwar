import React, { useState, useEffect, useRef } from 'react';
import { HeroState } from '../types/game';
import { EXP_TABLE, MAX_LEVEL } from '../utils/gameData';
import CharacterAvatar from './CharacterAvatar';
import { GoldCoinIcon, CrystalIcon } from './CurrencyIcon';
import { ELIXIR_EN_IMG, ELIXIR_HP_IMG, ELIXIR_EXP_IMG } from '../utils/elixirAssets';
import { playStoneSlideSound } from '../utils/audio';
import { Game2DPotionIcon, EgyptianCornerOrnaments } from './ui/Game2DIcons';

export interface EgyptianHudAccordionProps {
  currentUser?: string | null;
  hero: HeroState;
  soundMuted: boolean;
  unreadMailCount?: number;
  unspentStatPoints?: number;
  hasCharacterNotification?: boolean;
  totalNotificationCount?: number;
  isPremActive?: boolean;
  isModeratorRole?: boolean;
  isAdmin?: boolean;
  activeSeasonTitle?: { id: string; name: string } | null;
  isRegenNeeded: boolean;
  regenAmountPerTick: number;
  secToNextRegenTick: number | string;
  totalSecToFullRecovery: number;
  formatShortDuration: (sec: number) => string;
  onToggleSound: () => void;
  onOpenCharModal: () => void;
  onOpenMailModal?: () => void;
  onUsePotion: (type: 'hp' | 'en' | 'exp') => void;
}

export const EgyptianHudAccordion: React.FC<EgyptianHudAccordionProps> = ({
  currentUser,
  hero,
  soundMuted,
  unreadMailCount = 0,
  unspentStatPoints = 0,
  hasCharacterNotification = false,
  totalNotificationCount = 0,
  isPremActive = false,
  isModeratorRole = false,
  isAdmin = false,
  activeSeasonTitle,
  isRegenNeeded,
  regenAmountPerTick,
  secToNextRegenTick,
  totalSecToFullRecovery,
  formatShortDuration,
  onToggleSound,
  onOpenCharModal,
  onOpenMailModal,
  onUsePotion
}) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);
  const [hpChangedFlash, setHpChangedFlash] = useState<boolean>(false);
  const [enChangedFlash, setEnChangedFlash] = useState<boolean>(false);

  const prevHpRef = useRef<number>(hero.hp);
  const prevEnRef = useRef<number>(hero.energy);

  // Subtle flash effect on mini bars when HP or Energy changes
  useEffect(() => {
    if (prevHpRef.current !== hero.hp) {
      prevHpRef.current = hero.hp;
      setHpChangedFlash(true);
      const timer = setTimeout(() => setHpChangedFlash(false), 800);
      return () => clearTimeout(timer);
    }
  }, [hero.hp]);

  useEffect(() => {
    if (prevEnRef.current !== hero.energy) {
      prevEnRef.current = hero.energy;
      setEnChangedFlash(true);
      const timer = setTimeout(() => setEnChangedFlash(false), 800);
      return () => clearTimeout(timer);
    }
  }, [hero.energy]);

  // Close popover on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPopoverOpen) {
        setIsPopoverOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPopoverOpen]);

  const togglePopover = () => {
    playStoneSlideSound();
    setIsPopoverOpen((prev) => !prev);
  };

  const closePopover = () => {
    if (isPopoverOpen) {
      setIsPopoverOpen(false);
    }
  };

  const hpPercent = Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100));
  const enPercent = Math.max(0, Math.min(100, (hero.energy / hero.maxEnergy) * 100));
  const nextExp = hero.level >= MAX_LEVEL ? 0 : EXP_TABLE[hero.level] || 1000;
  const expPercent = nextExp > 0 ? Math.min(100, (hero.exp / nextExp) * 100) : 100;

  return (
    <>
      {/* 1. Backdrop when popover bubble is open - strictly crisp with NO blur filter */}
      {isPopoverOpen && (
        <div
          onClick={closePopover}
          className="fixed inset-0 z-38 bg-black/25 transition-opacity"
          style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none', filter: 'none' }}
          title="Нажмите в любое место, чтобы закрыть"
        />
      )}

      {/* 2. Ultra-Thin Floating 2D RPG Status Line */}
      <div
        data-tutorial="hud-bars"
        className="relative z-35 w-full shrink-0 select-none overflow-visible px-1.5 sm:px-2 pt-2 pointer-events-auto"
      >
        <div className="mx-auto w-full max-w-xl overflow-visible flex items-center justify-between gap-1 sm:gap-2 px-2.5 py-1 rounded-full bg-gradient-to-b from-[#2b1c10] via-[#130f18] to-[#080a10] border-2 border-amber-400/80 shadow-[0_3px_12px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(254,240,138,0.45)]">
          {/* LEFT: Avatar + Nick + Level + Glossy 2D Micro HP/EN Bars */}
          <div className="flex items-center gap-1.5 min-w-0 overflow-visible">
            {/* Micro Pharaoh Avatar Cartouche */}
            <div
              onClick={() => {
                if (unreadMailCount > 0 && onOpenMailModal) {
                  onOpenMailModal();
                } else {
                  onOpenCharModal();
                }
              }}
              className="relative overflow-visible flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-amber-300 bg-transparent p-0.5 shadow-[0_0_8px_rgba(245,158,11,0.65)] transition-transform active:scale-95"
              title="Персонаж, сумка и почта"
            >
              <div className="w-full h-full overflow-hidden rounded-full bg-transparent">
                <CharacterAvatar avatar={hero.avatar} nick={currentUser} className="w-full h-full object-contain" />
              </div>
              {isPremActive && (
                <span className="absolute -top-1.5 -left-1 z-20 text-[8px] drop-shadow leading-none">👑</span>
              )}
              {hasCharacterNotification && (
                <span className="absolute -top-1.5 -right-1.5 z-20 flex h-3.5 min-w-[14px] items-center justify-center rounded-full border border-yellow-300 bg-red-600 px-1 text-[7px] font-black text-white shadow-[0_0_8px_#ef4444] animate-pulse">
                  {totalNotificationCount}
                </span>
              )}
            </div>

            {/* Nickname & Level */}
            <div className="flex items-center gap-1 min-w-0">
              <span
                className={`truncate text-[8.5px] sm:text-[9.5px] font-extrabold max-w-[70px] sm:max-w-[110px] ${
                  isModeratorRole
                    ? 'text-emerald-400'
                    : isAdmin || hero.role === 'admin' || Number((hero as any).is_admin) === 1
                    ? 'text-red-400'
                    : 'text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]'
                }`}
                title={currentUser || 'Игрок'}
              >
                {currentUser || 'Игрок'}
              </span>

              <span className="rounded bg-gradient-to-b from-purple-800 to-purple-950 border border-purple-400/60 px-1 py-[0.5px] text-[6.5px] font-black text-purple-100 shadow-xs shrink-0">
                Ур.{hero.level}
              </span>

              {hero.clanTag && (
                <span className="hidden xs:inline rounded bg-amber-500/30 border border-amber-400/60 px-1 py-[0.5px] text-[6.5px] font-black text-amber-200 shrink-0">
                  [{hero.clanTag}]
                </span>
              )}
            </div>

            {/* Micro HP & Energy Glossy 2D Bars (Clickable to open bubble) */}
            <button
              type="button"
              onClick={togglePopover}
              className={`flex flex-col gap-0.5 px-1.5 py-0.5 rounded-lg bg-black/65 border transition-all cursor-pointer ${
                hpChangedFlash || enChangedFlash
                  ? 'border-amber-300 ring-1 ring-amber-400/60 shadow-[0_0_8px_#f59e0b]'
                  : 'border-amber-500/40 hover:border-amber-300'
              }`}
              title="Нажмите для открытия подробного статуса, регенерации и быстрых эликсиров"
            >
              {/* Mini HP */}
              <div className="flex items-center gap-0.5">
                <span className="text-[6px] font-bold text-red-400 leading-none">❤️</span>
                <div className="game-2d-bar-gloss h-1.5 w-9 sm:w-14 overflow-hidden rounded-full bg-slate-950 border border-red-400/60">
                  <div
                    className="h-full bg-gradient-to-r from-red-700 via-red-500 to-rose-400 transition-all duration-300"
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
                <span className="text-[6.5px] font-mono font-bold text-red-200 leading-none tabular-nums hidden xs:inline">
                  {hero.hp}
                </span>
              </div>

              {/* Mini Energy */}
              <div className="flex items-center gap-0.5">
                <span className="text-[6px] font-bold text-sky-400 leading-none">⚡</span>
                <div className="game-2d-bar-gloss h-1.5 w-9 sm:w-14 overflow-hidden rounded-full bg-slate-950 border border-sky-400/60">
                  <div
                    className="h-full bg-gradient-to-r from-sky-700 via-sky-500 to-cyan-300 transition-all duration-300"
                    style={{ width: `${enPercent}%` }}
                  />
                </div>
                <span className="text-[6.5px] font-mono font-bold text-sky-200 leading-none tabular-nums hidden xs:inline">
                  {hero.energy}
                </span>
              </div>
            </button>
          </div>

          {/* RIGHT: Currency + Sound + 2D Potion Flask Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Gold */}
            <div
              className="flex items-center gap-0.5 text-[8px] sm:text-[9px] font-black text-amber-300 tabular-nums drop-shadow"
              title={`Золото: ${hero.gold}`}
            >
              <GoldCoinIcon size="sm" />
              <span>{hero.gold}</span>
            </div>

            {/* Crystals */}
            <div
              className="flex items-center gap-0.5 text-[8px] sm:text-[9px] font-black text-cyan-200 tabular-nums drop-shadow"
              title={`Кристаллы: ${hero.crystals}`}
            >
              <CrystalIcon size="sm" />
              <span>{hero.crystals}</span>
            </div>

            {/* Sound Toggle Button */}
            <button
              type="button"
              onClick={onToggleSound}
              className="game-2d-btn game-2d-btn-slot flex h-5 w-5 items-center justify-center rounded-full text-[7.5px] text-amber-200 hover:text-white cursor-pointer"
              title={soundMuted ? 'Включить звук' : 'Выключить звук'}
            >
              {soundMuted ? '🔇' : '🔊'}
            </button>

            {/* Status / Elixirs 2D Flask Popover Toggle */}
            <button
              type="button"
              onClick={togglePopover}
              className={`game-2d-btn relative flex h-5 w-5 items-center justify-center rounded-full cursor-pointer ${
                isPopoverOpen
                  ? 'game-2d-btn-gold text-slate-950 font-black'
                  : 'game-2d-btn-slot text-amber-300'
              }`}
              title={isPopoverOpen ? 'Закрыть статус' : 'Подробный статус, регенерация и эликсиры'}
            >
              {isPopoverOpen ? (
                <span className="text-[8px] text-white">✕</span>
              ) : (
                <Game2DPotionIcon size={13} variant="hp" />
              )}
              {isRegenNeeded && !isPopoverOpen && (
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>
          </div>
        </div>

        {/* 3. Floating 2D Egyptian Tablet Popover (Всплывающий бабл статуса и эликсиров — смещён ниже админ-панели погоды) */}
        {isPopoverOpen && (
          <div className="game-2d-panel absolute top-[72px] sm:top-[76px] left-2 right-2 sm:left-auto sm:right-3 sm:w-[325px] z-40 rounded-2xl p-2.5 animate-in fade-in zoom-in-95 duration-200">
            <EgyptianCornerOrnaments variant="gold" />
            {/* Popover Header */}
            <div className="relative z-20 flex items-center justify-between pb-1.5 border-b border-amber-500/35 px-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black text-amber-300 drop-shadow">
                  {currentUser || 'Игрок'}
                </span>
                <span className="rounded bg-orange-500/25 border border-orange-500/50 px-1 py-0.2 text-[6.5px] font-black text-orange-300">
                  🔺 П{hero.homePyramidTier || hero.pyramidTier || 1}
                </span>
              </div>
              <button
                type="button"
                onClick={closePopover}
                className="text-[9px] text-slate-400 hover:text-white px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="relative z-20 flex flex-col gap-2 pt-2">
              {/* HP & Energy Glossy 2D Progress Bars */}
              <div className="grid grid-cols-2 gap-1.5">
                {/* Detailed HP Bar */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between text-[7.5px] font-black text-red-200">
                    <span className="flex items-center gap-0.5">
                      <span>❤️</span>
                      <span>Здоровье</span>
                    </span>
                    <span className="tabular-nums font-mono text-[7px]">
                      {hero.hp}/{hero.maxHp}
                    </span>
                  </div>
                  <div className="game-2d-bar-gloss relative h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-red-400/70">
                    <div
                      className="h-full bg-gradient-to-r from-red-800 via-red-600 to-rose-400 transition-all duration-300 shadow-[0_0_8px_#ef4444]"
                      style={{ width: `${hpPercent}%` }}
                    />
                  </div>
                </div>

                {/* Detailed Energy Bar */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between text-[7.5px] font-black text-sky-200">
                    <span className="flex items-center gap-0.5">
                      <span>⚡</span>
                      <span>Энергия</span>
                    </span>
                    <span className="tabular-nums font-mono text-[7px]">
                      {hero.energy}/{hero.maxEnergy}
                    </span>
                  </div>
                  <div className="game-2d-bar-gloss relative h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-sky-400/70">
                    <div
                      className="h-full bg-gradient-to-r from-sky-800 via-sky-600 to-cyan-300 transition-all duration-300 shadow-[0_0_8px_#38bdf8]"
                      style={{ width: `${enPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* EXP Glossy 2D Progress Bar */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[7px] font-black text-purple-200">
                  <span className="flex items-center gap-1">
                    <span>✨</span>
                    <span>Опыт до {hero.level >= MAX_LEVEL ? 'MAX' : `${hero.level + 1} ур.`}</span>
                  </span>
                  <span className="tabular-nums font-mono">
                    {hero.level >= MAX_LEVEL ? 'MAX' : `${hero.exp} / ${nextExp} (${Math.round(expPercent)}%)`}
                  </span>
                </div>
                <div className="game-2d-bar-gloss relative h-2 w-full overflow-hidden rounded-full bg-slate-950 border border-purple-400/60">
                  <div
                    className="h-full bg-gradient-to-r from-purple-700 via-fuchsia-600 to-pink-400 transition-all duration-300"
                    style={{ width: `${expPercent}%` }}
                  />
                </div>
              </div>

              {/* Regeneration Details */}
              <div
                className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-2 py-1 text-[7.5px] font-bold text-slate-300"
                title="Автоматическое восстановление здоровья и энергии в городе"
              >
                <span className="flex items-center gap-1 text-emerald-300">
                  <span className={isRegenNeeded ? 'animate-spin' : ''}>♻️</span>
                  <span>
                    Восстановление: {isRegenNeeded
                      ? `+${regenAmountPerTick}❤️ / +${regenAmountPerTick}⚡ ${isPremActive ? '(VIP 2x)' : ''}`
                      : 'Полный запас (100%)'}
                  </span>
                </span>
                <span className="text-cyan-300 font-mono tabular-nums">
                  {isRegenNeeded ? `Тик: ${secToNextRegenTick}с (полн: ${formatShortDuration(totalSecToFullRecovery)})` : 'Готов'}
                </span>
              </div>

              {/* Quick-Use Potions Bar */}
              <div className="flex items-center justify-between gap-1 pt-0.5">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onUsePotion('hp')}
                    disabled={hero.hpPotions <= 0 || hero.hp >= hero.maxHp}
                    className="game-2d-btn flex items-center gap-1 rounded-lg border border-red-400/80 bg-gradient-to-b from-red-800 to-red-950 px-1.5 py-0.5 text-[7px] font-black text-red-100 disabled:opacity-40 cursor-pointer shadow-xs"
                    title="Использовать Эликсир жизни (+50 HP)"
                  >
                    <img src={ELIXIR_HP_IMG} alt="HP" className="h-3 w-3 object-contain" />
                    <span>HP: {hero.hpPotions}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUsePotion('en')}
                    disabled={hero.enPotions <= 0 || hero.energy >= hero.maxEnergy}
                    className="game-2d-btn flex items-center gap-1 rounded-lg border border-sky-400/80 bg-gradient-to-b from-sky-800 to-sky-950 px-1.5 py-0.5 text-[7px] font-black text-sky-100 disabled:opacity-40 cursor-pointer shadow-xs"
                    title="Использовать Эликсир энергии (+20 EN)"
                  >
                    <img src={ELIXIR_EN_IMG} alt="EN" className="h-3 w-3 object-contain" />
                    <span>EN: {hero.enPotions}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUsePotion('exp')}
                    disabled={Number(hero.expPotions || 0) <= 0}
                    className={`game-2d-btn flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[7px] font-black text-purple-100 disabled:opacity-40 cursor-pointer shadow-xs ${
                      hero.expElixirUntil && hero.expElixirUntil > Date.now()
                        ? 'border-emerald-400 bg-gradient-to-b from-emerald-800 to-emerald-950 text-emerald-100'
                        : 'border-purple-400/80 bg-gradient-to-b from-purple-800 to-purple-950'
                    }`}
                    title="Эликсир Опыта (+25% к опыту на 30 мин)"
                  >
                    <img src={ELIXIR_EXP_IMG} alt="EXP" className="h-3 w-3 object-contain" />
                    <span>EXP: {hero.expPotions || 0}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    closePopover();
                    onOpenCharModal();
                  }}
                  className="game-2d-btn game-2d-btn-gold flex items-center gap-1 rounded-lg px-2 py-0.5 text-[7px] font-black uppercase text-white cursor-pointer shrink-0"
                >
                  <span>🎒</span>
                  <span>Инвентарь</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default EgyptianHudAccordion;

