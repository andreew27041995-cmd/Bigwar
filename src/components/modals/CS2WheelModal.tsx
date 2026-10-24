import React, { useState, useRef, useEffect } from 'react';
import { HeroState, GameItem, WheelWinnerEntry, ItemQualityKey } from '../../types/game';
import { playSpinTickSound, playLootSound, playLevelUpSound } from '../../utils/audio';
import { generateItem, getQualityConfig, getRouletteResetInfo } from '../../utils/gameData';
import {
  RoulettePrizeConfig,
  DEFAULT_ROULETTE_PRIZES,
  getRoulettePrizes,
  syncRoulettePrizesFromSupabase
} from '../../utils/rouletteConfig';
import { CharacterSkinTemplate, getShopSkins } from '../../utils/shopConfig';
import CharacterAvatar from '../CharacterAvatar';

const MAX_VIP_GOLD_SPINS_PER_DAY = 3;
const MAX_CRYSTAL_SPINS_PER_DAY = 3;

interface CS2WheelModalProps {
  currentUser?: string | null;
  hero: HeroState;
  shopSkins?: CharacterSkinTemplate[];
  wheelWinners?: WheelWinnerEntry[];
  wheelDisabled?: boolean;
  onClose: () => void;
  onRewardReceived: (reward: {
    text: string;
    item?: GameItem;
    gold?: number;
    crystals?: number;
    skinId?: string;
    skinDurationDays?: number;
    winnerEntry?: WheelWinnerEntry;
  }) => void;
  onWinnerLogged?: (winner: WheelWinnerEntry) => void;
  onSpinStarted?: (mode: 'free' | 'crystals' | 'gold', timestamp: number, todayKey: string) => void;
  onSpinCompleted?: (timestamp: number, spinType: 'free' | 'crystals' | 'gold_vip' | string) => void;
  onDeductCrystals?: (amount: number) => void;
  onDeductGold?: (amount: number) => void;
  onInspectPlayer?: (nick: string) => void;
}

interface TapeItem {
  id: string;
  name: string;
  icon: string;
  type: 'item' | 'gold' | 'crystals' | 'jackpot' | 'skin';
  amount?: number;
  quality: ItemQualityKey;
  skinId?: string;
  skinDurationDays?: number;
}

const BASE_TAPE_POOL: TapeItem[] = [
  { id: 't_g1', name: '100 Золота', icon: '🪙', type: 'gold', amount: 100, quality: 'common' },
  { id: 't_g2', name: '250 Золота', icon: '💰', type: 'gold', amount: 250, quality: 'rare' },
  { id: 't_c1', name: '5 Кристаллов', icon: '💎', type: 'crystals', amount: 5, quality: 'rare' },
  { id: 't_c2', name: '20 Кристаллов', icon: '💎', type: 'crystals', amount: 20, quality: 'epic' },
  { id: 't_w1', name: 'Клинок Анубиса', icon: '⚔️', type: 'item', quality: 'rare' },
  { id: 't_a1', name: 'Доспех Фараона', icon: '🛡️', type: 'item', quality: 'epic' },
  { id: 't_r1', name: 'Кольцо Ра', icon: '💍', type: 'item', quality: 'legendary' },
  { id: 't_jp', name: '300 💎 ДЖЕКПОТ', icon: '👑', type: 'jackpot', amount: 300, quality: 'legendary' }
];

export const CS2WheelModal: React.FC<CS2WheelModalProps> = ({
  currentUser,
  hero,
  shopSkins,
  wheelWinners = [],
  wheelDisabled = false,
  onClose,
  onRewardReceived,
  onWinnerLogged,
  onSpinStarted,
  onSpinCompleted,
  onDeductCrystals,
  onDeductGold,
  onInspectPlayer
}) => {
  const [spinning, setSpinning] = useState(false);
  const spinningLockRef = useRef(false);
  const [prizesList, setPrizesList] = useState<RoulettePrizeConfig[]>(() => getRoulettePrizes());
  const [currentTime, setCurrentTime] = useState(Date.now());
  const tapeRef = useRef<HTMLDivElement>(null);
  const allSkins = shopSkins || getShopSkins();

  // Sync prizes from Supabase on mount
  useEffect(() => {
    syncRoulettePrizesFromSupabase().then((p) => {
      if (Array.isArray(p) && p.length > 0) {
        setPrizesList(p);
      }
    });
  }, []);

  function prizeToTapeItem(p: RoulettePrizeConfig, idx: number): TapeItem {
    if (p.type === 'skin') {
      const skin = allSkins.find((s) => s.id === p.skinId);
      return {
        id: `tape_${idx}_${p.id}_${Math.random()}`,
        name: skin?.name || p.name,
        icon: skin?.avatarUrl || skin?.icon || p.icon,
        type: 'skin',
        quality: skin?.quality || p.quality,
        skinId: skin?.id || p.skinId,
        skinDurationDays: p.skinDurationDays || 0
      };
    }
    return {
      id: `tape_${idx}_${p.id}_${Math.random()}`,
      name: p.name,
      icon: p.icon,
      type: p.type === 'jackpot' ? 'jackpot' : p.type === 'crystals' ? 'crystals' : p.type === 'gold' ? 'gold' : 'item',
      amount: p.amount,
      quality: p.quality
    };
  }

  function generateTape(pool: RoulettePrizeConfig[]): TapeItem[] {
    const list: TapeItem[] = [];
    const active = pool.filter((p) => p.enabled !== false);
    const usePool = active.length > 0 ? active : DEFAULT_ROULETTE_PRIZES;
    for (let i = 0; i < 45; i++) {
      const template = usePool[Math.floor(Math.random() * usePool.length)];
      list.push(prizeToTapeItem(template, i));
    }
    return list;
  }

  const [tapeItems, setTapeItems] = useState<TapeItem[]>(() => generateTape(getRoulettePrizes()));
  const [lastWon, setLastWon] = useState<string | null>(null);

  // Live timer tick for 24-hour countdown & VIP check
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isPremiumActive = Boolean(
    hero.isPremium && hero.premiumUntil && hero.premiumUntil > currentTime
  );

  const { lastReset0001, nextReset0001, todayKey } = getRouletteResetInfo(currentTime);

  const lastSpinTime = hero.lastWheelSpinTime || 0;
  const isFreeSpinAvailable = lastSpinTime < lastReset0001;
  const msUntilNextFree = Math.max(0, nextReset0001 - currentTime);

  const isSameSpinDay = hero.dailyWheelSpinsDate === todayKey;
  const usedGoldSpinsToday = isSameSpinDay ? Math.max(0, hero.dailyGoldWheelSpins || 0) : 0;
  const usedCrystalSpinsToday = isSameSpinDay ? Math.max(0, hero.dailyCrystalWheelSpins || 0) : 0;

  const remainingGoldSpinsToday = Math.max(0, MAX_VIP_GOLD_SPINS_PER_DAY - usedGoldSpinsToday);
  const remainingCrystalSpinsToday = Math.max(0, MAX_CRYSTAL_SPINS_PER_DAY - usedCrystalSpinsToday);

  const hoursLeft = Math.floor(msUntilNextFree / (1000 * 60 * 60));
  const minutesLeft = Math.floor((msUntilNextFree % (1000 * 60 * 60)) / (1000 * 60));
  const secondsLeft = Math.floor((msUntilNextFree % (1000 * 60)) / 1000);
  const countdownFormatted = `${String(hoursLeft).padStart(2, '0')}:${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;

  const pendingRewardRef = useRef<{
    reward: {
      text: string;
      item?: GameItem;
      gold?: number;
      crystals?: number;
      skinId?: string;
      skinDurationDays?: number;
      winnerEntry?: WheelWinnerEntry;
    };
    finishMode: string;
  } | null>(null);

  // If modal unmounts while spinning, ensure the already-determined reward is still delivered
  useEffect(() => {
    return () => {
      if (pendingRewardRef.current) {
        const pending = pendingRewardRef.current;
        pendingRewardRef.current = null;
        onRewardReceived(pending.reward);
        if (pending.reward.winnerEntry && onWinnerLogged) {
          onWinnerLogged(pending.reward.winnerEntry);
        }
        if (onSpinCompleted) {
          onSpinCompleted(Date.now(), pending.finishMode);
        }
      }
    };
  }, []);

  const handleSpin = (mode: 'free' | 'crystals' | 'gold') => {
    if (spinning || spinningLockRef.current) return;
    if (mode === 'free' && !isFreeSpinAvailable) return;

    const crystalCost = isPremiumActive ? 30 : 50;
    if (mode === 'crystals') {
      if (hero.crystals < crystalCost) return;
      if (!isPremiumActive && remainingCrystalSpinsToday <= 0) return;
    }
    if (mode === 'gold') {
      if (!isPremiumActive || hero.gold < 1000) return;
    }

    spinningLockRef.current = true;
    setSpinning(true);
    setLastWon(null);

    const spinNow = Date.now();
    // Immediately deduct currency & persist daily spin usage
    if (mode === 'crystals') {
      if (onDeductCrystals) onDeductCrystals(crystalCost);
    } else if (mode === 'gold') {
      if (onDeductGold) onDeductGold(1000);
    }

    if (onSpinStarted) {
      onSpinStarted(mode, spinNow, todayKey);
    }

    const activePrizes = prizesList.filter((p) => p.enabled !== false);
    const pool = activePrizes.length > 0 ? activePrizes : DEFAULT_ROULETTE_PRIZES;

    // Generate fresh tape with winner at index 35
    const newTape = generateTape(pool);

    // Determine winner based on odds (weights) with boost for active Premium
    const mult = isPremiumActive ? 1.5 : 1.0;
    const weightedPool = pool.map((p: RoulettePrizeConfig) => {
      const isHigh = p.type === 'skin' || p.type === 'jackpot' || p.quality === 'legendary' || p.quality === 'epic';
      return {
        prize: p,
        weight: Math.max(1, p.weight * (isHigh ? mult : 1.0))
      };
    });
    const totalWeight = weightedPool.reduce((acc: number, it: { prize: RoulettePrizeConfig; weight: number }) => acc + it.weight, 0);
    let rand = Math.random() * totalWeight;
    let chosen = weightedPool[0].prize;
    for (const item of weightedPool) {
      if (rand < item.weight) {
        chosen = item.prize;
        break;
      }
      rand -= item.weight;
    }

    const playerNick = currentUser || 'Игрок';
    const timeStr = new Date(spinNow).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    let preparedReward: {
      text: string;
      item?: GameItem;
      gold?: number;
      crystals?: number;
      skinId?: string;
      skinDurationDays?: number;
      winnerEntry: WheelWinnerEntry;
    };
    let winner: TapeItem = prizeToTapeItem(chosen, 35);
    let displayWonName = winner.name;

    if (chosen.type === 'skin') {
      const skin = allSkins.find((s) => s.id === chosen.skinId);
      const skinName = skin?.name || chosen.name;
      const durationDays = chosen.skinDurationDays || 0;
      const durText = durationDays > 0 ? `на ${durationDays} дн.` : 'НАВСЕГДА';
      const winnerEntry: WheelWinnerEntry = {
        id: `ww_${spinNow}_${Math.random().toString(36).slice(2, 6)}`,
        nick: playerNick,
        isPremium: isPremiumActive,
        prizeName: `🎭 Скин «${skinName}» (${durText})`,
        prizeIcon: skin?.avatarUrl || skin?.icon || chosen.icon,
        quality: skin?.quality || chosen.quality,
        prizeQuality: skin?.quality || chosen.quality,
        timestamp: spinNow,
        timeStr
      };
      displayWonName = `🎭 ${skinName} (${durText})`;
      winner = {
        id: `win_skin_${chosen.id}`,
        name: displayWonName,
        icon: skin?.avatarUrl || skin?.icon || chosen.icon,
        type: 'skin',
        quality: skin?.quality || chosen.quality,
        skinId: skin?.id || chosen.skinId,
        skinDurationDays: durationDays
      };
      preparedReward = {
        text: `🎭 ВЫ ВЫИГРАЛИ СКИН ПЕРСОНАЖА! «${skinName}» (${durText}) добавлен в вашу личную коллекцию!`,
        skinId: skin?.id || chosen.skinId,
        skinDurationDays: durationDays,
        winnerEntry
      };
    } else if (chosen.type === 'jackpot') {
      const amt = chosen.amount || 300;
      const winnerEntry: WheelWinnerEntry = {
        id: `ww_${spinNow}_${Math.random().toString(36).slice(2, 6)}`,
        nick: playerNick,
        isPremium: isPremiumActive,
        prizeName: chosen.name,
        prizeIcon: chosen.icon,
        quality: chosen.quality,
        prizeQuality: chosen.quality,
        timestamp: spinNow,
        timeStr
      };
      preparedReward = {
        text: `👑 ДЖЕКПОТ! Вы выиграли +${amt} 💎 кристаллов!`,
        crystals: amt,
        winnerEntry
      };
    } else if (chosen.type === 'crystals') {
      const amt = chosen.amount || 20;
      const winnerEntry: WheelWinnerEntry = {
        id: `ww_${spinNow}_${Math.random().toString(36).slice(2, 6)}`,
        nick: playerNick,
        isPremium: isPremiumActive,
        prizeName: chosen.name,
        prizeIcon: chosen.icon,
        quality: chosen.quality,
        prizeQuality: chosen.quality,
        timestamp: spinNow,
        timeStr
      };
      preparedReward = {
        text: `💎 Вы выиграли +${amt} кристаллов!`,
        crystals: amt,
        winnerEntry
      };
    } else if (chosen.type === 'gold') {
      const amt = chosen.amount || 250;
      const winnerEntry: WheelWinnerEntry = {
        id: `ww_${spinNow}_${Math.random().toString(36).slice(2, 6)}`,
        nick: playerNick,
        isPremium: isPremiumActive,
        prizeName: chosen.name,
        prizeIcon: chosen.icon,
        quality: chosen.quality,
        prizeQuality: chosen.quality,
        timestamp: spinNow,
        timeStr
      };
      preparedReward = {
        text: `🪙 Вы выиграли +${amt} золота!`,
        gold: amt,
        winnerEntry
      };
    } else {
      const dropItem = generateItem(hero.level, true);
      dropItem.quality = chosen.quality;
      displayWonName = `${dropItem.name} (${dropItem.lvl} ур.)`;
      winner = {
        id: `win_item_${chosen.id}`,
        name: dropItem.name,
        icon: dropItem.icon,
        type: 'item',
        quality: dropItem.quality
      };
      const winnerEntry: WheelWinnerEntry = {
        id: `ww_${spinNow}_${Math.random().toString(36).slice(2, 6)}`,
        nick: playerNick,
        isPremium: isPremiumActive,
        prizeName: displayWonName,
        prizeIcon: dropItem.icon,
        quality: dropItem.quality,
        prizeQuality: dropItem.quality,
        timestamp: spinNow,
        timeStr
      };
      preparedReward = {
        text: `🎁 Вы выиграли вещь: ${dropItem.icon} ${dropItem.name}!`,
        item: dropItem,
        winnerEntry
      };
    }

    const finishMode = mode === 'gold' ? 'gold_vip' : mode;
    pendingRewardRef.current = {
      reward: preparedReward,
      finishMode
    };

    const WIN_INDEX = 35;
    newTape[WIN_INDEX] = winner;
    setTapeItems(newTape);

    // Reset tape position
    if (tapeRef.current) {
      tapeRef.current.style.transition = 'none';
      tapeRef.current.style.transform = 'translateX(0px)';
    }

    // Audio tick interval
    let tickCount = 0;
    const tickInterval = setInterval(() => {
      tickCount++;
      playSpinTickSound();
      if (tickCount > 28) clearInterval(tickInterval);
    }, 110);

    // Animate tape
    setTimeout(() => {
      if (tapeRef.current) {
        const cardWidth = 76;
        const targetOffset = -(WIN_INDEX * cardWidth - 140 + (Math.random() * 30 - 15));
        tapeRef.current.style.transition = 'transform 3.8s cubic-bezier(0.12, 0.8, 0.15, 1)';
        tapeRef.current.style.transform = `translateX(${targetOffset}px)`;
      }
    }, 50);

    // Completion callback
    setTimeout(() => {
      clearInterval(tickInterval);
      spinningLockRef.current = false;
      setSpinning(false);

      if (!pendingRewardRef.current) return;
      const delivered = pendingRewardRef.current;
      pendingRewardRef.current = null;

      if (winner.type === 'jackpot') {
        playLevelUpSound();
      } else {
        playLootSound();
      }
      setLastWon(displayWonName);

      onRewardReceived(delivered.reward);
      if (delivered.reward.winnerEntry && onWinnerLogged) {
        onWinnerLogged(delivered.reward.winnerEntry);
      }
      if (onSpinCompleted) {
        onSpinCompleted(Date.now(), delivered.finishMode);
      }
    }, 4000);
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-slate-950/95 p-3 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <span className="text-xs font-bold text-amber-400">🎡 Рулетка Везения</span>
        <button
          onClick={() => {
            if (!spinning) onClose();
          }}
          disabled={spinning}
          className="text-base font-bold text-red-400 hover:text-red-300 disabled:opacity-40"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pt-3 space-y-3">
        {/* Roulette Box */}
        <div className="relative rounded-xl border-2 border-amber-500/80 bg-slate-900 p-3 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
          <div className="mb-2 text-center text-xs font-bold text-amber-300">
            Древний Египетский Кейс
          </div>

          {/* Center pointer */}
          <div className="relative overflow-hidden rounded-lg border border-slate-700 bg-slate-950 p-2">
            <div className="absolute top-0 bottom-0 left-1/2 z-20 w-0.5 -translate-x-1/2 bg-red-500 shadow-[0_0_10px_#ef4444]" />
            <div className="absolute -top-1 left-1/2 z-20 -translate-x-1/2 border-x-4 border-t-6 border-x-transparent border-t-red-500" />
            <div className="absolute -bottom-1 left-1/2 z-20 -translate-x-1/2 border-x-4 border-b-6 border-x-transparent border-b-red-500" />

            {/* Scrolling tape */}
            <div className="h-20 overflow-hidden">
              <div ref={tapeRef} className="flex gap-1.5 will-change-transform">
                {tapeItems.map((it) => {
                  const q = getQualityConfig(it.quality);
                  return (
                    <div
                      key={it.id}
                      className="flex h-20 w-[70px] shrink-0 flex-col items-center justify-center rounded border-b-4 bg-slate-800/90 p-1 shadow"
                      style={{ borderBottomColor: q.color }}
                    >
                      {it.type === 'skin' ? (
                        <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-slate-950 p-0.5 border border-purple-400/50">
                          <CharacterAvatar avatar={it.icon} nick={it.name} size="xs" className="object-contain" />
                          {it.skinDurationDays && it.skinDurationDays > 0 ? (
                            <span className="absolute bottom-0 right-0 bg-amber-500 text-[6px] font-black text-slate-950 px-0.5 rounded-tl leading-none">
                              {it.skinDurationDays}д
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-2xl">{it.icon}</div>
                      )}
                      <div className="mt-1 line-clamp-1 text-center text-[8px] font-bold text-slate-200">
                        {it.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Status info */}
          <div className="mt-2.5 text-center space-y-1">
            {lastWon ? (
              <div className="text-xs font-bold text-emerald-400 animate-pulse">
                🎉 Выигрыш: {lastWon}!
              </div>
            ) : isFreeSpinAvailable ? (
              <div className="rounded bg-emerald-500/20 border border-emerald-500/40 p-1 text-[10px] font-bold text-emerald-300 animate-pulse">
                ✨ Доступно 1 БЕСПЛАТНОЕ вращение на сегодня!
              </div>
            ) : (
              <div className="rounded bg-amber-500/10 border border-amber-500/30 p-1 text-[10px] text-slate-300">
                ⏳ Бесплатное вращение использовано. Сброс лимитов через:{' '}
                <span className="font-mono font-bold text-amber-400">{countdownFormatted}</span>
              </div>
            )}
            {isPremiumActive && (
              <div className="text-[9px] font-bold text-yellow-400">
                👑 VIP Активен: шанс призов х2 • Прокруты БЕЗ СУТОЧНЫХ ЛИМИТОВ • Скидка: всего 30 💎 за прокрутку!
              </div>
            )}
          </div>

          {/* Spin buttons */}
          <div className="mt-2.5 space-y-2">
            {wheelDisabled ? (
              <div className="rounded-lg border-2 border-red-500/60 bg-red-950/50 p-4 text-center space-y-1">
                <div className="text-xl">⛔</div>
                <div className="text-xs font-bold text-red-300">Рулетка временно закрыта</div>
                <div className="text-[10px] text-slate-300">
                  В связи с глобальным обновлением игры рулетка временно недоступна.
                </div>
              </div>
            ) : isFreeSpinAvailable ? (
              <button
                type="button"
                onClick={() => handleSpin('free')}
                disabled={spinning}
                className="w-full rounded-lg bg-gradient-to-r from-emerald-500 via-amber-400 to-yellow-500 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-[0_0_15px_rgba(234,179,8,0.7)] hover:brightness-110 active:scale-95 disabled:opacity-50 animate-pulse"
              >
                {spinning ? 'Крутим рулетку...' : '🎰 Крутить Бесплатно (1 раз в сутки)'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 py-1.5 text-[10px] font-bold text-slate-400 opacity-60 cursor-not-allowed"
                >
                  ⏳ Бесплатно использовано (0/1) • Сброс через {countdownFormatted}
                </button>

                {/* Extra Spin option for crystals (30 for VIP unlimited, 50 for regular with 3/day limit) */}
                <button
                  type="button"
                  onClick={() => handleSpin('crystals')}
                  disabled={
                    spinning ||
                    hero.crystals < (isPremiumActive ? 30 : 50) ||
                    (!isPremiumActive && remainingCrystalSpinsToday <= 0)
                  }
                  className="w-full rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 py-2 text-[10px] font-bold text-white shadow hover:from-sky-500 hover:to-indigo-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {spinning
                    ? 'Крутим рулетку...'
                    : isPremiumActive
                    ? `💎 Крутить за 30 💎 (VIP: БЕЗ ЛИМИТОВ) [У вас: ${hero.crystals} 💎]`
                    : remainingCrystalSpinsToday <= 0
                    ? `⛔ Суточный лимит за кристаллы исчерпан (${MAX_CRYSTAL_SPINS_PER_DAY}/${MAX_CRYSTAL_SPINS_PER_DAY})`
                    : `💎 Крутить за 50 💎 (Лимит: ${usedCrystalSpinsToday}/${MAX_CRYSTAL_SPINS_PER_DAY} в сутки) [У вас: ${hero.crystals} 💎]`}
                </button>
              </>
            )}

            {!wheelDisabled && isPremiumActive && (
              <button
                type="button"
                onClick={() => handleSpin('gold')}
                disabled={spinning || hero.gold < 1000}
                className="w-full rounded-lg border-2 border-yellow-300/80 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-600 py-2 text-[10.5px] font-black uppercase tracking-wider text-slate-950 shadow-[0_0_16px_rgba(250,204,21,0.5)] hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {spinning
                  ? 'Крутим рулетку...'
                  : `👑 Крутить за 1 000 🪙 (VIP: БЕЗ ЛИМИТОВ) [У вас: ${hero.gold} 🪙]`}
              </button>
            )}
          </div>
        </div>

        {/* REAL-TIME WINNERS LOG UNDER THE WHEEL */}
        <div className="rounded-xl border border-amber-500/40 bg-slate-900/90 p-2.5 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-amber-400">🏆 Лог победителей</span>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <span className="text-[8.5px] text-slate-400">
              Последние ценные призы ({wheelWinners.length})
            </span>
          </div>

          {wheelWinners.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 py-4 text-center text-[9.5px] text-slate-400">
              Пока никто не крутил рулетку сегодня. Испытайте удачу первым!
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {wheelWinners.map((win) => {
                const q = getQualityConfig(win.quality);
                return (
                  <div
                    key={win.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-1.5 text-[9.5px]"
                    style={{ borderLeftWidth: '3px', borderLeftColor: q.color }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{win.prizeIcon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span
                            onClick={() => onInspectPlayer && onInspectPlayer(win.nick)}
                            className={`font-extrabold truncate ${
                              onInspectPlayer ? 'cursor-pointer hover:underline' : ''
                            } ${win.isPremium ? 'text-yellow-300' : 'text-amber-300'}`}
                          >
                            {win.isPremium ? '👑 ' : ''}
                            {win.nick}
                          </span>
                          <span className="text-[8px] text-slate-500">выиграл:</span>
                        </div>
                        <div
                          className="font-bold truncate text-[9.5px]"
                          style={{ color: q.color }}
                        >
                          {win.prizeName}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[8px] text-slate-500 ml-2">
                      {win.timeStr}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Possible drops legend */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-[10px] space-y-1">
          <div className="font-semibold text-amber-400">
            Возможные призы {isPremiumActive ? '(👑 Шансы х2 с VIP)' : ''}:
          </div>
          <div className="flex justify-between text-yellow-300">
            <span>👑 300 💎 ДЖЕКПОТ / Легендарные кольца</span>
            <span>{isPremiumActive ? '5% (х2 VIP)' : '2.5%'}</span>
          </div>
          <div className="flex justify-between text-purple-300">
            <span>🛡️ Эпическая броня / 15-20 Кристаллов</span>
            <span>{isPremiumActive ? '24% (х2 VIP)' : '12%'}</span>
          </div>
          <div className="flex justify-between text-sky-300">
            <span>⚔️ Редкое оружие / 250 Золота</span>
            <span>25%</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>🪙 100-200 Золота / Обычные вещи</span>
            <span>{isPremiumActive ? '46%' : '60.5%'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};


