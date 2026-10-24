import React from 'react';
import { HeroState } from '../types/game';
import { EXP_TABLE, MAX_LEVEL, getPyramidTierForLevel } from '../utils/gameData';
import bgImage from '../assets/images/pyramid_city_1792151896034.jpg';
import CharacterAvatar from './CharacterAvatar';
import { GoldCoinIcon, CrystalIcon } from './CurrencyIcon';

interface CityScreenProps {
  currentUser?: string | null;
  hero: HeroState;
  soundMuted: boolean;
  unreadMailCount?: number;
  onToggleSound: () => void;
  onOpenCharModal: () => void;
  onOpenMailModal?: () => void;
  onEnterPyramid: () => void;
  onOpenAuction: () => void;
  onOpenInventory: () => void;
  onOpenWheel: () => void;
  onOpenPremium: () => void;
  onOpenCreateItem: () => void;
  onOpenAdmin: () => void;
  onOpenBank: () => void;
  onOpenShop?: () => void;
  onUsePotion: (type: 'hp' | 'en' | 'exp') => void;
  onOpenLeaderboard?: () => void;
  onOpenDailyReward?: () => void;
  canClaimDailyReward?: boolean;
  onOpenClans?: () => void;
  onOpenClanPyramid?: () => void;
  isAdmin?: boolean;
  featureFlags?: {
    rouletteEnabled?: boolean;
    exchangeEnabled?: boolean;
    premiumEnabled?: boolean;
    shopEnabled?: boolean;
  };
}

export const CityScreen: React.FC<CityScreenProps> = ({
  currentUser,
  hero,
  soundMuted,
  unreadMailCount = 0,
  onToggleSound,
  onOpenWheel,
  onOpenPremium,
  onOpenCharModal,
  onOpenMailModal,
  onEnterPyramid,
  onOpenAdmin,
  onOpenBank,
  onOpenShop,
  onOpenLeaderboard,
  onOpenDailyReward,
  canClaimDailyReward,
  onOpenClans,
  onOpenClanPyramid,
  onUsePotion,
  isAdmin,
  featureFlags
}) => {
  const hpPercent = Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100));
  const enPercent = Math.max(0, Math.min(100, (hero.energy / hero.maxEnergy) * 100));
  const nextExp = hero.level >= MAX_LEVEL ? 0 : EXP_TABLE[hero.level] || 1000;
  const expPercent = nextExp > 0 ? Math.min(100, (hero.exp / nextExp) * 100) : 100;

  const isPremActive = Boolean(
    featureFlags?.premiumEnabled &&
    hero.isPremium &&
    hero.premiumUntil &&
    hero.premiumUntil > Date.now()
  );
  const unspentStatPoints = Math.max(0, Number(hero.statPoints || 0));
  const hasCharacterNotification = unreadMailCount > 0 || unspentStatPoints > 0;
  const totalNotificationCount = unreadMailCount + unspentStatPoints;

  return (
    <div
      className="relative flex flex-[64] min-h-0 flex-col justify-between overflow-y-auto overscroll-y-contain touch-pan-y border-b-2 border-orange-500/80 bg-cover bg-center"
      style={{ backgroundImage: `url(${bgImage})`, WebkitOverflowScrolling: 'touch' }}
    >
      {/* Halloween Festival Night Atmospheric Overlay */}
      <div className="pointer-events-none sticky inset-0 h-0 w-full z-0" />
      <div
        className="absolute inset-0 min-h-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 78% 18%, rgba(249,115,22,0.38) 0%, rgba(126,34,206,0.52) 38%, rgba(15,6,28,0.88) 78%, rgba(5,2,12,0.96) 100%)'
        }}
      />

      {/* Halloween Decorative SVG Scene (Harvest Blood Moon, Cobwebs, Bats & Glowing Pumpkins) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {/* Top-left & Top-right spooky cobwebs */}
        <svg
          className="absolute top-0 left-0 w-24 h-24 text-purple-200/20"
          viewBox="0 0 100 100"
          fill="none"
        >
          <path d="M0 0 L100 0 M0 0 L85 50 M0 0 L50 85 M0 0 L0 100" stroke="currentColor" strokeWidth="1.2" />
          <path d="M25 0 Q22 22 0 25 M50 0 Q42 42 0 50 M75 0 Q62 62 0 75" stroke="currentColor" strokeWidth="1" />
        </svg>
        <svg
          className="absolute top-0 right-0 w-24 h-24 text-orange-200/20 -scale-x-100"
          viewBox="0 0 100 100"
          fill="none"
        >
          <path d="M0 0 L100 0 M0 0 L85 50 M0 0 L50 85 M0 0 L0 100" stroke="currentColor" strokeWidth="1.2" />
          <path d="M25 0 Q22 22 0 25 M50 0 Q42 42 0 50 M75 0 Q62 62 0 75" stroke="currentColor" strokeWidth="1" />
        </svg>

        {/* Glowing Halloween Harvest Moon */}
        <div
          className="absolute top-8 right-12 w-16 h-16 rounded-full opacity-80"
          style={{
            background: 'radial-gradient(circle, #fed7aa 0%, #fb923c 55%, #ea580c 85%, transparent 100%)',
            boxShadow: '0 0 35px 10px rgba(249, 115, 22, 0.55)'
          }}
        />

        {/* Floating Bats */}
        <span className="absolute top-10 right-24 text-sm animate-bat-float opacity-85">🦇</span>
        <span
          className="absolute top-16 right-10 text-xs animate-bat-float opacity-75"
          style={{ animationDelay: '1.1s' }}
        >
          🦇
        </span>
        <span
          className="absolute top-14 left-1/3 text-xs animate-bat-float opacity-70"
          style={{ animationDelay: '0.6s' }}
        >
          🦇
        </span>

        {/* Flickering Jack-o'-lantern Pumpkins along the Pyramid Courtyard */}
        <span className="absolute bottom-[112px] left-3 text-lg animate-pumpkin-glow select-none">🎃</span>
        <span
          className="absolute bottom-[112px] right-3 text-lg animate-pumpkin-glow select-none"
          style={{ animationDelay: '0.8s' }}
        >
          🎃
        </span>
        <span
          className="absolute bottom-[145px] left-12 text-xs animate-pumpkin-glow opacity-80 select-none"
          style={{ animationDelay: '1.4s' }}
        >
          🕯️
        </span>
        <span
          className="absolute bottom-[145px] right-12 text-xs animate-pumpkin-glow opacity-80 select-none"
          style={{ animationDelay: '0.4s' }}
        >
          🕯️
        </span>
      </div>

      {/* Top Player HUD — fits cleanly below top header bar without clipping or scroll */}
      <div className="relative z-10 flex items-start justify-between px-2.5 pt-2 pb-1 shrink-0">
        {/* Left: Player bar & Quick Potions */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 rounded-lg border border-orange-500/55 bg-slate-950/95 px-2.5 py-1.5 shadow-[0_0_15px_rgba(249,115,22,0.25)]">
            <div
              onClick={unreadMailCount > 0 && onOpenMailModal ? onOpenMailModal : onOpenCharModal}
              className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-orange-400 bg-slate-900 text-lg shadow p-1 overflow-hidden"
              title="Открыть персонажа, сумку и почту"
            >
              <CharacterAvatar avatar={hero.avatar} nick={currentUser} className="w-full h-full object-contain" />
              {isPremActive && (
                <span className="absolute -top-1.5 -left-1.5 text-[9px] animate-bounce">👑</span>
              )}
              {hasCharacterNotification && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-black text-white ring-2 ring-slate-950 animate-pulse shadow-[0_0_10px_#ef4444]">
                  {totalNotificationCount}
                </span>
              )}
            </div>

            <div className="flex w-28 flex-col gap-0.5">
              {/* Nickname & Level header inside HUD */}
              <div className="flex items-center justify-between text-[8.5px] font-extrabold leading-tight mb-0.5">
                <span className="truncate text-amber-300 max-w-[68px] flex items-center gap-0.5">
                  {hero.clanTag && (
                    <span className="rounded bg-amber-500/25 border border-amber-400/60 px-0.5 text-[6.5px] font-black text-amber-300">
                      [{hero.clanTag}]
                    </span>
                  )}
                  <span>{isPremActive ? '👑 ' : ''}{currentUser || 'Игрок'}</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <span className="rounded bg-orange-500/20 border border-orange-500/40 px-1 text-[7px] font-black text-orange-300">
                    🔺П{getPyramidTierForLevel(hero.level)}
                  </span>
                  <span className="text-purple-300">{isPremActive ? '👑 ' : ''}Ур.{hero.level}</span>
                </span>
              </div>

              {/* HP */}
              <div className="relative h-2.5 w-full overflow-hidden rounded bg-slate-800 border border-slate-700">
                <div className="h-full bg-red-600 transition-all" style={{ width: `${hpPercent}%` }} />
                <div className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-white drop-shadow">
                  ❤️ {hero.hp}/{hero.maxHp}
                </div>
              </div>

              {/* Energy */}
              <div className="relative h-2.5 w-full overflow-hidden rounded bg-slate-800 border border-slate-700">
                <div className="h-full bg-sky-600 transition-all" style={{ width: `${enPercent}%` }} />
                <div className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-white drop-shadow">
                  ⚡ {hero.energy}/{hero.maxEnergy}
                </div>
              </div>

              {/* EXP */}
              <div className="relative h-2 w-full overflow-hidden rounded bg-slate-800 border border-slate-700">
                <div className="h-full bg-purple-600 transition-all" style={{ width: `${expPercent}%` }} />
                <div className="absolute inset-0 flex items-center justify-center text-[6px] font-bold text-white drop-shadow">
                  EXP: {hero.exp}/{nextExp}
                </div>
              </div>
            </div>

            {/* Animated 3D Spinning Gold & Ultra-Bright Glowing Crystal */}
            <div className="ml-1 flex flex-col items-end justify-center gap-1 text-[9.5px] font-black border-l border-slate-800 pl-2.5 tabular-nums">
              <span className="flex items-center gap-1 text-amber-300 drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]">
                <GoldCoinIcon size="sm" />
                <span>{hero.gold}</span>
              </span>
              <span className="flex items-center gap-1 text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
                <CrystalIcon size="sm" />
                <span>{hero.crystals}</span>
              </span>
            </div>
          </div>

          {/* Left Vertical Square Potion Bottle Buttons */}
          <div className="flex flex-col gap-1.5 pl-0.5">
            <button
              onClick={() => onUsePotion('hp')}
              disabled={hero.hpPotions <= 0 || hero.hp >= hero.maxHp}
              className="group relative flex h-9 w-9 flex-col items-center justify-center rounded-lg border-2 border-red-400/80 bg-gradient-to-b from-red-800/90 via-red-950 to-slate-950 shadow-[0_0_10px_rgba(239,68,68,0.35)] transition-transform active:scale-90 disabled:opacity-40 hover:border-red-300"
              title="Эликсир здоровья (+50 HP)"
            >
              <span className="text-xs leading-none drop-shadow">🧪</span>
              <span className="mt-0.5 text-[6.5px] font-black uppercase tracking-tighter text-red-200 leading-none">
                HP
              </span>
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-red-200 bg-red-600 px-1 text-[7.5px] font-black text-white shadow tabular-nums">
                {hero.hpPotions}
              </span>
            </button>

            <button
              onClick={() => onUsePotion('en')}
              disabled={hero.enPotions <= 0 || hero.energy >= hero.maxEnergy}
              className="group relative flex h-9 w-9 flex-col items-center justify-center rounded-lg border-2 border-sky-400/80 bg-gradient-to-b from-sky-800/90 via-sky-950 to-slate-950 shadow-[0_0_10px_rgba(56,189,248,0.35)] transition-transform active:scale-90 disabled:opacity-40 hover:border-sky-300"
              title="Эликсир энергии (+20 EN)"
            >
              <span className="text-xs leading-none drop-shadow">⚗️</span>
              <span className="mt-0.5 text-[6.5px] font-black uppercase tracking-tighter text-sky-200 leading-none">
                EN
              </span>
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-sky-200 bg-sky-600 px-1 text-[7.5px] font-black text-white shadow tabular-nums">
                {hero.enPotions}
              </span>
            </button>

            <button
              onClick={() => onUsePotion('exp')}
              disabled={Number(hero.expPotions || 0) <= 0}
              className={`group relative flex h-9 w-9 flex-col items-center justify-center rounded-lg border-2 bg-gradient-to-b from-purple-800/90 via-purple-950 to-slate-950 shadow-[0_0_10px_rgba(168,85,247,0.4)] transition-transform active:scale-90 disabled:opacity-40 hover:border-purple-300 ${
                hero.expElixirUntil && hero.expElixirUntil > Date.now()
                  ? 'border-emerald-400 ring-1 ring-emerald-400/60'
                  : 'border-purple-400/80'
              }`}
              title="Ячейка Эликсира Опыта (+25% к опыту на 30 мин)"
            >
              <span className="text-xs leading-none drop-shadow">✨</span>
              <span className="mt-0.5 text-[6.5px] font-black uppercase tracking-tighter text-purple-200 leading-none">
                EXP
              </span>
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-purple-200 bg-purple-600 px-1 text-[7.5px] font-black text-white shadow tabular-nums">
                {hero.expPotions || 0}
              </span>
            </button>
          </div>
        </div>

        {/* Right: Daily Reward Gift & Sound toggle */}
        <div className="flex items-center gap-1.5">
          {onOpenDailyReward && (
            <button
              onClick={onOpenDailyReward}
              className={`relative flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-black shadow-lg transition-transform active:scale-95 ${
                canClaimDailyReward
                  ? 'border-orange-400 bg-gradient-to-r from-orange-600 to-amber-500 text-slate-950 animate-bounce shadow-[0_0_15px_rgba(249,115,22,0.7)]'
                  : 'border-orange-500/40 bg-slate-950/90 text-orange-300 hover:border-orange-400'
              }`}
              title="Ежедневный вход (Подарок)"
            >
              <span className="text-sm">🎃</span>
              <span className="text-[9.5px] uppercase tracking-wider font-extrabold">Подарок</span>
              {canClaimDailyReward && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-600 ring-2 ring-slate-950 animate-ping" />
              )}
            </button>
          )}

          <button
            onClick={onToggleSound}
            className="rounded border border-purple-500/40 bg-slate-950/90 px-2 py-1 text-[9px] text-slate-300 hover:text-white"
            title={soundMuted ? 'Включить звук' : 'Выключить звук'}
          >
            {soundMuted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {/* City Center Halloween Title */}
      <div className="relative z-10 text-center my-auto py-1 shrink-0">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/50 bg-purple-950/80 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.4)] mb-0.5">
          <span className="animate-pumpkin-glow">🎃</span>
          <span>Праздник Хеллоуин</span>
          <span className="animate-bat-float">🦇</span>
        </div>
        <h1 className="font-serif text-lg sm:text-xl font-bold tracking-widest text-[#ffb74d] drop-shadow-[0_2px_10px_rgba(249,115,22,0.95)]">
          🎃 ПИРАМИДА 🎃
        </h1>
        <div className="text-[9px] tracking-[0.22em] font-semibold text-purple-200 uppercase opacity-95 drop-shadow">
          Ночь Духов Фараонов
        </div>
      </div>

      {/* Building Buttons Grid (Bag removed -> inside Character; Auction & Forge moved -> inside Shop) */}
      <div className="relative z-10 grid grid-cols-3 sm:grid-cols-3 gap-1.5 p-2 pb-3.5 shrink-0">
        <button
          onClick={unreadMailCount > 0 && onOpenMailModal ? onOpenMailModal : onOpenCharModal}
          className="relative rounded-md border border-sky-400/80 bg-gradient-to-b from-sky-950/85 to-slate-900/95 py-2 text-[10px] font-bold text-sky-300 shadow active:scale-95 hover:border-sky-300"
          title="Персонаж, Сумка, Статы, Коллекция и Почта"
        >
          👤 Персонаж
          {hasCharacterNotification && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-black text-white ring-2 ring-slate-950 animate-bounce shadow-[0_0_10px_#ef4444]">
              {totalNotificationCount}
            </span>
          )}
        </button>

        <button
          onClick={onEnterPyramid}
          className={`relative rounded-md border-2 py-2 text-[10px] font-extrabold shadow active:scale-95 transition-all ${
            hero.energy < 3
              ? 'border-slate-600 bg-slate-900/90 text-slate-400'
              : 'border-orange-400 bg-gradient-to-b from-orange-900/90 to-purple-950/95 text-orange-200 shadow-[0_0_12px_rgba(249,115,22,0.45)] hover:scale-102'
          }`}
          title={`Войти в Пирамиду ${getPyramidTierForLevel(hero.level)}`}
        >
          🏛️ Пирамида {getPyramidTierForLevel(hero.level)}
        </button>

        {onOpenShop && (
          <button
            onClick={onOpenShop}
            className="rounded-md border-2 border-emerald-400 bg-gradient-to-b from-emerald-900/90 to-slate-900/95 py-2 text-[10px] font-extrabold text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.35)] active:scale-95 hover:border-emerald-300"
            title="Магазин, Аукцион и Создание оружия"
          >
            🛒 Магазин
          </button>
        )}

        <button
          onClick={onOpenBank}
          className="rounded-md border-2 border-cyan-400/90 bg-gradient-to-b from-cyan-950/90 to-slate-900/95 py-2 text-[10px] font-extrabold text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.35)] active:scale-95 hover:border-cyan-300"
          title="Банк: Покупка кристаллов и Обмен валют"
        >
          🏦 Банк
        </button>

        <button
          onClick={onOpenWheel}
          className={`rounded-md border py-2 text-[10px] font-bold shadow active:scale-95 ${
            featureFlags?.rouletteEnabled
              ? 'border-rose-500/80 bg-gradient-to-b from-rose-950/80 to-slate-900/95 text-rose-300 hover:border-rose-400'
              : 'border-slate-700 bg-slate-900/85 text-slate-500'
          }`}
        >
          {featureFlags?.rouletteEnabled ? '🎡 Рулетка' : '🔒 Рулетка (Закрыта)'}
        </button>

        <button
          onClick={onOpenPremium}
          className={`rounded-md border py-2 text-[10px] font-bold shadow active:scale-95 ${
            featureFlags?.premiumEnabled
              ? 'border-yellow-400 bg-gradient-to-b from-yellow-950/80 to-slate-900/95 text-yellow-300'
              : 'border-slate-700 bg-slate-900/85 text-slate-500'
          }`}
        >
          {featureFlags?.premiumEnabled ? '👑 Премиум' : '🔒 Премиум (Закрыт)'}
        </button>

        {onOpenLeaderboard && (
          <button
            onClick={onOpenLeaderboard}
            className="rounded-md border border-amber-500/80 bg-gradient-to-b from-amber-950/80 to-slate-900/95 py-2 text-[10px] font-extrabold text-amber-300 shadow active:scale-95 hover:border-amber-400"
          >
            🏆 Рейтинг
          </button>
        )}

        {onOpenClans && (
          <button
            onClick={onOpenClans}
            className="rounded-md border-2 border-amber-500/90 bg-gradient-to-b from-amber-950/90 to-slate-900/95 py-2 text-[10px] font-black text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)] active:scale-95 hover:border-amber-400"
            title="Кланы: общий склад экипировки, аренда и совместные походы"
          >
            🛡️ Кланы
          </button>
        )}

        {onOpenClanPyramid && (
          <button
            onClick={onOpenClanPyramid}
            className="rounded-md border-2 border-red-500/90 bg-gradient-to-b from-red-950/90 to-slate-900/95 py-2 text-[10px] font-black text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.3)] active:scale-95 hover:border-red-400 animate-pulse"
            title="Битва за Клановую Пирамиду (только для участников кланов)"
          >
            🔺 Клановая Пирамида
          </button>
        )}

        {isAdmin && (
          <button
            onClick={onOpenAdmin}
            className="rounded-md border border-red-500/80 bg-gradient-to-b from-red-950/80 to-slate-900/95 py-2 text-[10px] font-bold text-red-300 shadow active:scale-95"
          >
            🛠️ Админка
          </button>
        )}
      </div>
    </div>
  );
};
