import React, { useState, useEffect, useRef } from 'react';
import { HeroState } from '../../types/game';
import {
  playSpinTickSound as playClickSound,
  playLootSound,
  playCoinSound,
  playAttackSound,
  playLevelUpSound
} from '../../utils/audio';
import {
  getScarabTournamentConfig,
  syncScarabTournamentConfigFromSupabase,
  saveScarabTournamentConfigToSupabase,
  ScarabTournamentGlobalConfig,
  ScarabCupAdminConfig
} from '../../utils/scarabTournamentConfig';

export interface GamblingTransactionPayload {
  gameName: string;
  spentGold?: number;
  wonGold?: number;
  spentCrystals?: number;
  wonCrystals?: number;
  logText?: string;
  countGame?: boolean;
}

interface SubGameCommonProps {
  hero: HeroState;
  currentUser?: string | null;
  onGamblingTransaction: (tx: GamblingTransactionPayload) => void;
}

// ============================================================================
// 2. «КОСТИ АНУБИСА» (DICE)
// ============================================================================
type DicePredictionType =
  | 'over7'
  | 'under7'
  | 'exact7'
  | 'even'
  | 'odd'
  | 'double'
  | 'exact';

interface DiceOption {
  id: DicePredictionType;
  label: string;
  desc: string;
  multiplier: number;
}

const DICE_OPTIONS: DiceOption[] = [
  { id: 'over7', label: 'Больше 7 (8–12)', desc: 'Сумма > 7', multiplier: 2.2 },
  { id: 'under7', label: 'Меньше 7 (2–6)', desc: 'Сумма < 7', multiplier: 2.2 },
  { id: 'exact7', label: 'Ровно 7 (𓂀)', desc: 'Сумма = 7', multiplier: 5.5 },
  { id: 'even', label: 'Чётное число', desc: '2, 4, 6, 8, 10, 12', multiplier: 1.95 },
  { id: 'odd', label: 'Нечётное число', desc: '3, 5, 7, 9, 11', multiplier: 1.95 },
  { id: 'double', label: 'Дубль костей', desc: '1-1, 2-2 ... 6-6', multiplier: 5.5 }
];

const EXACT_SUM_MULTIPLIERS: Record<number, number> = {
  2: 32,
  3: 16,
  4: 10.5,
  5: 8,
  6: 6.5,
  7: 5.5,
  8: 6.5,
  9: 8,
  10: 10.5,
  11: 16,
  12: 32
};

const DICE_FACES: Record<number, string> = {
  1: '⚀',
  2: '⚁',
  3: '⚂',
  4: '⚃',
  5: '⚄',
  6: '⚅'
};

export const AnubisDiceGameView: React.FC<SubGameCommonProps> = ({
  hero,
  onGamblingTransaction
}) => {
  const [currency, setCurrency] = useState<'gold' | 'crystals'>('gold');
  const [betAmount, setBetAmount] = useState<string>('50');
  const [prediction, setPrediction] = useState<DicePredictionType>('over7');
  const [exactTarget, setExactTarget] = useState<number>(7);
  const [rolling, setRolling] = useState(false);
  const [dice, setDice] = useState<[number, number]>([4, 5]);
  const [lastResult, setLastResult] = useState<{
    d1: number;
    d2: number;
    sum: number;
    won: boolean;
    payout: number;
    currency: 'gold' | 'crystals';
    text: string;
  } | null>(null);
  const [history, setHistory] = useState<
    Array<{ id: string; sum: number; d1: number; d2: number; won: boolean; payout: number; currency: 'gold' | 'crystals' }>
  >([]);

  const MAX_DICE_BET = 10000;
  const activeMultiplier =
    prediction === 'exact'
      ? EXACT_SUM_MULTIPLIERS[exactTarget] || 5.5
      : DICE_OPTIONS.find((o) => o.id === prediction)?.multiplier || 2;

  const parsedBet = Math.max(1, Math.floor(Number(betAmount) || 0));
  const maxBalance = currency === 'gold' ? hero.gold : hero.crystals;
  const potentialWin = Math.floor(parsedBet * activeMultiplier);

  const handleRollDice = () => {
    if (rolling) return;
    if (parsedBet <= 0) return;
    if (parsedBet > MAX_DICE_BET) {
      setLastResult({
        d1: dice[0],
        d2: dice[1],
        sum: dice[0] + dice[1],
        won: false,
        payout: 0,
        currency,
        text: `❌ Максимальная ставка в Костях Анубиса — ${MAX_DICE_BET.toLocaleString()} ${currency === 'gold' ? '🪙' : '💎'}!`
      });
      return;
    }
    if (parsedBet > maxBalance) {
      setLastResult({
        d1: dice[0],
        d2: dice[1],
        sum: dice[0] + dice[1],
        won: false,
        payout: 0,
        currency,
        text: currency === 'gold' ? '❌ Недостаточно золота для ставки!' : '❌ Недостаточно кристаллов для ставки!'
      });
      return;
    }

    const lockedCurrency = currency;
    const lockedBet = parsedBet;
    const lockedMultiplier = activeMultiplier;
    const lockedPrediction = prediction;
    const lockedExactTarget = exactTarget;
    const curIcon = lockedCurrency === 'gold' ? '🪙' : '💎';

    // Immediately deduct stake from player's balance when placing the bet
    onGamblingTransaction({
      gameName: 'Кости Анубиса',
      spentGold: lockedCurrency === 'gold' ? lockedBet : 0,
      wonGold: 0,
      spentCrystals: lockedCurrency === 'crystals' ? lockedBet : 0,
      wonCrystals: 0,
      countGame: false
    });

    playClickSound();
    setRolling(true);
    setLastResult(null);

    let ticks = 0;
    const interval = setInterval(() => {
      ticks++;
      setDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
      ]);
      if (ticks >= 12) {
        clearInterval(interval);
        const finalD1 = Math.floor(Math.random() * 6) + 1;
        const finalD2 = Math.floor(Math.random() * 6) + 1;
        const sum = finalD1 + finalD2;
        setDice([finalD1, finalD2]);

        let isWin = false;
        if (lockedPrediction === 'over7') isWin = sum > 7;
        else if (lockedPrediction === 'under7') isWin = sum < 7;
        else if (lockedPrediction === 'exact7') isWin = sum === 7;
        else if (lockedPrediction === 'even') isWin = sum % 2 === 0;
        else if (lockedPrediction === 'odd') isWin = sum % 2 !== 0;
        else if (lockedPrediction === 'double') isWin = finalD1 === finalD2;
        else if (lockedPrediction === 'exact') isWin = sum === lockedExactTarget;

        const winPayout = isWin ? Math.floor(lockedBet * lockedMultiplier) : 0;

        if (isWin) {
          playLootSound();
        } else {
          playCoinSound();
        }

        // Only credit payout if won; if lost, nothing is returned
        onGamblingTransaction({
          gameName: 'Кости Анубиса',
          spentGold: 0,
          wonGold: isWin && lockedCurrency === 'gold' ? winPayout : 0,
          spentCrystals: 0,
          wonCrystals: isWin && lockedCurrency === 'crystals' ? winPayout : 0,
          countGame: true,
          logText: isWin
            ? `🎲 Кости Анубиса: выпало ${finalD1}+${finalD2}=${sum}! Выигрыш +${winPayout} ${curIcon} (x${lockedMultiplier})`
            : `🎲 Кости Анубиса: выпало ${finalD1}+${finalD2}=${sum}. Ставка ${lockedBet} ${curIcon} не сыграла.`
        });

        setLastResult({
          d1: finalD1,
          d2: finalD2,
          sum,
          won: isWin,
          payout: winPayout,
          currency: lockedCurrency,
          text: isWin
            ? `🎉 Победа! Выпало ${finalD1} + ${finalD2} = ${sum}. Выигрыш: +${winPayout.toLocaleString()} ${curIcon}`
            : `💀 Проигрыш! Выпало ${finalD1} + ${finalD2} = ${sum}. Ставка ${lockedBet.toLocaleString()} ${curIcon} не возвращается.`
        });

        setHistory((prev) => [
          {
            id: `${Date.now()}_${Math.random()}`,
            sum,
            d1: finalD1,
            d2: finalD2,
            won: isWin,
            payout: winPayout,
            currency: lockedCurrency
          },
          ...prev.slice(0, 9)
        ]);
        setRolling(false);
      }
    }, 75);
  };

  return (
    <div className="space-y-2.5">
      {/* Header & Egyptian Lore */}
      <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/60 via-slate-900 to-purple-950/50 p-2.5 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
            <span>🎲 Кости Анубиса (Египетский покер на костях)</span>
          </div>
          <div className="text-[9.5px] text-slate-300 mt-0.5">
            Выберите валюту (Золото или Кристаллы), укажите ставку и сделайте прогноз на сумму двух священных кубиков (от 2 до 12).
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[9px] text-slate-400">Коэффициент:</div>
          <div className="text-sm font-black text-emerald-400">x{activeMultiplier}</div>
        </div>
      </div>

      {/* Animated Dice Table */}
      <div className="relative rounded-2xl border-2 border-amber-500/50 bg-[radial-gradient(circle_at_center,#2e1a0f_0%,#090d16_100%)] p-3.5 text-center shadow-inner overflow-hidden">
        <div className="text-[9px] font-bold uppercase tracking-widest text-amber-400/80 mb-2">
          𓂀 Алтарь Судьбы Анубиса 𓂀
        </div>
        <div className="flex items-center justify-center gap-5 my-1">
          {[dice[0], dice[1]].map((val, idx) => (
            <div
              key={idx}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-amber-900/90 via-slate-900 to-slate-950 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-transform ${
                rolling ? 'animate-bounce scale-110 border-yellow-300' : ''
              }`}
            >
              <span className="text-4xl sm:text-5xl leading-none text-amber-300 select-none">
                {DICE_FACES[val] || '⚄'}
              </span>
              <span className="text-[9px] font-black text-amber-200 mt-0.5">{val}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-slate-950/90 px-3 py-1 text-xs font-black text-amber-300">
          <span>Сумма костей:</span>
          <span className="text-base text-white">{dice[0] + dice[1]}</span>
          {dice[0] === dice[1] && (
            <span className="rounded bg-purple-900/80 px-1.5 py-0.5 text-[9px] text-purple-200 border border-purple-400/50">
              ДУБЛЬ!
            </span>
          )}
        </div>

        {lastResult && (
          <div
            className={`mt-2.5 rounded-xl border px-3 py-1.5 text-[11px] font-black ${
              lastResult.won
                ? 'border-emerald-400 bg-emerald-950/70 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'border-rose-500/60 bg-rose-950/60 text-rose-200'
            }`}
          >
            {lastResult.text}
          </div>
        )}
      </div>

      {/* Currency & Bet Input */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 space-y-1.5">
          <div className="text-[10px] font-black uppercase text-slate-400">1. Валюта ставки:</div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCurrency('gold');
                setBetAmount('50');
              }}
              className={`rounded-lg border py-1.5 px-2 text-xs font-black transition-all cursor-pointer ${
                currency === 'gold'
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200 shadow'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              🪙 Золото ({hero.gold.toLocaleString()})
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrency('crystals');
                setBetAmount('5');
              }}
              className={`rounded-lg border py-1.5 px-2 text-xs font-black transition-all cursor-pointer ${
                currency === 'crystals'
                  ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200 shadow'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              💎 Кристаллы ({hero.crystals.toLocaleString()})
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
            <span>2. Сумма ставки (макс. {MAX_DICE_BET.toLocaleString()} {currency === 'gold' ? '🪙' : '💎'}):</span>
            <span className="text-emerald-300">
              Возможный выигрыш: +{potentialWin.toLocaleString()} {currency === 'gold' ? '🪙' : '💎'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={Math.min(MAX_DICE_BET, maxBalance)}
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-black text-white outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={() => setBetAmount(String(Math.min(MAX_DICE_BET, Math.max(1, Math.floor(parsedBet * 2)))))}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[10px] font-black text-amber-300 hover:bg-slate-700 cursor-pointer shrink-0"
            >
              x2
            </button>
            <button
              type="button"
              onClick={() => setBetAmount(String(Math.min(MAX_DICE_BET, Math.max(1, Math.floor(maxBalance / 2)))))}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[10px] font-black text-cyan-300 hover:bg-slate-700 cursor-pointer shrink-0"
            >
              1/2
            </button>
            <button
              type="button"
              onClick={() => setBetAmount(String(Math.min(MAX_DICE_BET, maxBalance)))}
              className="rounded-lg border border-amber-500/50 bg-amber-950/60 px-2 py-1.5 text-[10px] font-black text-amber-200 hover:bg-amber-900 cursor-pointer shrink-0"
            >
              MAX
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {[50, 100, 500, 1000, 5000, 10000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setBetAmount(String(Math.min(preset, maxBalance)))}
                className={`rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 text-[8.5px] font-bold hover:border-slate-700 cursor-pointer ${
                  parsedBet === preset ? 'text-amber-300 border-amber-400/60 bg-amber-950/40' : 'text-slate-400'
                }`}
              >
                {preset.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Prediction Selector */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 space-y-2">
        <div className="text-[10px] font-black uppercase text-slate-400">
          3. Выберите прогноз исхода броска:
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {DICE_OPTIONS.map((opt) => {
            const active = prediction === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPrediction(opt.id)}
                className={`rounded-xl border p-2 text-left transition-all cursor-pointer ${
                  active
                    ? 'border-amber-400 bg-gradient-to-br from-amber-500/25 to-purple-900/40 text-white shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'border-slate-800 bg-slate-950/90 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10.5px] font-black text-amber-300">{opt.label}</span>
                  <span className="rounded bg-emerald-950 border border-emerald-500/50 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                    x{opt.multiplier}
                  </span>
                </div>
                <div className="text-[8.5px] text-slate-400 mt-0.5">{opt.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Exact Sum Selector (2..12) */}
        <div className="pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9.5px] font-bold text-purple-300">
              🎯 Или угадайте точное значение суммы (повышенный коэффициент до x32):
            </span>
          </div>
          <div className="grid grid-cols-11 gap-1">
            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => {
              const isSelected = prediction === 'exact' && exactTarget === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setPrediction('exact');
                    setExactTarget(num);
                  }}
                  className={`rounded-lg border py-1 text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'border-purple-400 bg-purple-600/30 text-white font-black shadow'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="text-[10px] font-black">{num}</div>
                  <div className="text-[7.5px] text-emerald-400 font-bold">
                    x{EXACT_SUM_MULTIPLIERS[num]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Roll Button */}
      <button
        type="button"
        disabled={rolling || parsedBet <= 0 || maxBalance < parsedBet}
        onClick={handleRollDice}
        className="w-full rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:brightness-110 active:scale-98 disabled:opacity-40 cursor-pointer"
      >
        {rolling
          ? '🎲 Кости Анубиса вращаются...'
          : `🎲 Бросить кости (Ставка: ${parsedBet.toLocaleString()} ${currency === 'gold' ? '🪙' : '💎'} ➔ Выигрыш: ${potentialWin.toLocaleString()} ${currency === 'gold' ? '🪙' : '💎'})`}
      </button>

      {/* Recent Rolls History */}
      {history.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-2">
          <div className="text-[9px] font-bold uppercase text-slate-400 mb-1">
            Последние броски:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {history.map((h) => (
              <span
                key={h.id}
                className={`rounded-lg border px-2 py-0.5 text-[9px] font-bold ${
                  h.won
                    ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                {h.d1}+{h.d2}={h.sum}{' '}
                {h.won ? `(+${h.payout}${h.currency === 'gold' ? '🪙' : '💎'})` : '(—)'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 3. «КЛАССИЧЕСКАЯ РУЛЕТКА (1–36)» (EUROPEAN ROULETTE)
// ============================================================================
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
]);

function getNumberColor(n: number): 'green' | 'red' | 'black' {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

const MAX_ROULETTE_BET = 5000;
const ROULETTE_ROUND_SECONDS = 2 * 60; // 2 минуты ожидания до розыгрыша

interface RoulettePlacedBet {
  key: string;
  label: string;
  amount: number;
  multiplier: number;
}

function doesRouletteBetMatch(key: string, rolled: number): boolean {
  if (key.startsWith('num_')) {
    return rolled === Number(key.replace('num_', ''));
  }
  if (rolled === 0) return false;
  if (key === 'doz_1') return rolled >= 1 && rolled <= 12;
  if (key === 'doz_2') return rolled >= 13 && rolled <= 24;
  if (key === 'doz_3') return rolled >= 25 && rolled <= 36;
  if (key === 'low_1_18') return rolled >= 1 && rolled <= 18;
  if (key === 'high_19_36') return rolled >= 19 && rolled <= 36;
  if (key === 'even') return rolled % 2 === 0;
  if (key === 'odd') return rolled % 2 !== 0;
  if (key === 'red') return RED_NUMBERS.has(rolled);
  if (key === 'black') return !RED_NUMBERS.has(rolled);
  return false;
}

export const ClassicRouletteGameView: React.FC<SubGameCommonProps> = ({
  hero,
  currentUser,
  onGamblingTransaction
}) => {
  const storageKey = `piramida_roulette36_v2_${(currentUser || 'guest').toLowerCase()}`;

  const [betCurrency, setBetCurrency] = useState<'gold' | 'crystals'>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.betCurrency === 'crystals' || parsed.betCurrency === 'gold') {
          return parsed.betCurrency;
        }
      }
    } catch {}
    return 'gold';
  });

  const [chipValue, setChipValue] = useState<number>(100);

  const [placedBets, setPlacedBets] = useState<Record<string, RoulettePlacedBet>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.placedBets && typeof parsed.placedBets === 'object') {
          return parsed.placedBets;
        }
      }
    } catch {}
    return {};
  });

  const [roundDeadline, setRoundDeadline] = useState<number>(() => {
    const maxDl = Date.now() + ROULETTE_ROUND_SECONDS * 1000;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.roundDeadline === 'number' && parsed.roundDeadline > Date.now()) {
          return Math.min(maxDl, parsed.roundDeadline);
        }
      }
    } catch {}
    return maxDl;
  });

  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    Math.min(
      ROULETTE_ROUND_SECONDS,
      Math.max(0, Math.ceil((roundDeadline - Date.now()) / 1000))
    )
  );

  // Key of a placed bet currently picked up to move ("переставить") to another number/sector
  const [movingBetKey, setMovingBetKey] = useState<string | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [rolledNumber, setRolledNumber] = useState<number | null>(null);
  const [spinResultText, setSpinResultText] = useState<{
    won: boolean;
    text: string;
  } | null>(null);
  const [recentNumbers, setRecentNumbers] = useState<number[]>([17, 32, 0, 7, 23, 14]);

  // Live balance ref so rapid chip clicks cannot exceed balance before state flushes
  const liveBalanceRef = useRef<{ gold: number; crystals: number }>({
    gold: hero.gold,
    crystals: hero.crystals
  });
  useEffect(() => {
    liveBalanceRef.current = {
      gold: hero.gold,
      crystals: hero.crystals
    };
  }, [hero.gold, hero.crystals]);

  const betsList: RoulettePlacedBet[] = Object.keys(placedBets).map((k) => placedBets[k]);
  const totalStaked = betsList.reduce((acc, b) => acc + b.amount, 0);
  const curIcon = betCurrency === 'gold' ? '🪙' : '💎';
  const remainingLimit = Math.max(0, MAX_ROULETTE_BET - totalStaked);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          betCurrency,
          placedBets,
          roundDeadline
        })
      );
    } catch {}
  }, [storageKey, betCurrency, placedBets, roundDeadline]);

  const placeChipOn = (
    key: string,
    label: string,
    multiplier: number,
    forceAddChip: boolean = false
  ) => {
    if (spinning) return;

    // 1. If a bet is currently selected to be moved ("переставить") and user clicks a DIFFERENT number/sector:
    // Move the staked amount to the new number/sector without charging player's balance again!
    if (movingBetKey && placedBets[movingBetKey] && movingBetKey !== key && !forceAddChip) {
      const sourceBet = placedBets[movingBetKey];
      playClickSound();
      setPlacedBets((prev) => {
        const next = { ...prev };
        delete next[movingBetKey];
        const existingTarget = next[key];
        next[key] = {
          key,
          label,
          amount: (existingTarget?.amount || 0) + sourceBet.amount,
          multiplier
        };
        return next;
      });
      setMovingBetKey(null);
      setSpinResultText({
        won: true,
        text: `🔄 Ставка ${sourceBet.amount.toLocaleString()} ${curIcon} успешно переставлена с «${sourceBet.label}» на «${label}»!`
      });
      return;
    }

    // 2. If user clicks on a number/sector that ALREADY has a bet and no bet is being moved yet:
    // Select this bet for moving ("переставить") so their next click on any other number moves it there!
    // (Clicking the same number a second time or clicking "+Добавить фишку" will add another chip to it).
    if (!forceAddChip && !movingBetKey && placedBets[key] && placedBets[key].amount > 0) {
      playClickSound();
      setMovingBetKey(key);
      setSpinResultText({
        won: true,
        text: `🔄 Выбрана ставка на «${label}» (${placedBets[key].amount.toLocaleString()} ${curIcon}). Нажмите на ЛЮБУЮ другую цифру/сектор, чтобы переставить ставку туда (или нажмите ещё раз на «${label}», чтобы добавить фишку).`
      });
      return;
    }

    // Clear moving state if user clicked the same number again to add another chip
    if (movingBetKey === key) {
      setMovingBetKey(null);
    }

    if (totalStaked >= MAX_ROULETTE_BET) {
      setSpinResultText({
        won: false,
        text: `⚠️ Максимальная ставка в рулетке — ${MAX_ROULETTE_BET.toLocaleString()} ${curIcon} (${
          betCurrency === 'gold' ? 'золота' : 'кристаллов'
        })!`
      });
      return;
    }

    const actualChip = Math.min(chipValue, MAX_ROULETTE_BET - totalStaked);
    if (actualChip <= 0) return;

    const availableBalance =
      betCurrency === 'gold' ? liveBalanceRef.current.gold : liveBalanceRef.current.crystals;

    if (availableBalance < actualChip) {
      setSpinResultText({
        won: false,
        text:
          betCurrency === 'gold'
            ? `❌ Недостаточно золота на балансе (нужно ${actualChip.toLocaleString()} 🪙)!`
            : `❌ Недостаточно кристаллов на балансе (нужно ${actualChip.toLocaleString()} 💎)!`
      });
      return;
    }

    const wasTableEmpty = totalStaked <= 0;

    // Immediately deduct chip amount from player's account when placing the bet
    if (betCurrency === 'gold') {
      liveBalanceRef.current.gold = Math.max(0, liveBalanceRef.current.gold - actualChip);
    } else {
      liveBalanceRef.current.crystals = Math.max(0, liveBalanceRef.current.crystals - actualChip);
    }

    onGamblingTransaction({
      gameName: 'Классическая Рулетка (1–36)',
      spentGold: betCurrency === 'gold' ? actualChip : 0,
      wonGold: 0,
      spentCrystals: betCurrency === 'crystals' ? actualChip : 0,
      wonCrystals: 0,
      countGame: false
    });

    playClickSound();
    setSpinResultText(null);

    // Start the 2-minute countdown to the draw when the first bet is placed on the table
    if (wasTableEmpty) {
      const nextDl = Date.now() + ROULETTE_ROUND_SECONDS * 1000;
      setRoundDeadline(nextDl);
      setSecondsLeft(ROULETTE_ROUND_SECONDS);
    }

    setPlacedBets((prev) => {
      const existing = prev[key];
      return {
        ...prev,
        [key]: {
          key,
          label,
          amount: (existing?.amount || 0) + actualChip,
          multiplier
        }
      };
    });
  };

  const handleLaunchRoulette = () => {
    if (spinning) return;
    if (betsList.length === 0 || totalStaked <= 0) {
      setSpinResultText({
        won: false,
        text: '⚠️ Сначала разместите фишки на игровом поле (на числа, цвет или чётность)!'
      });
      return;
    }

    const snapshotBets = [...betsList];
    const snapshotTotalStaked = totalStaked;
    const snapshotCurrency = betCurrency;
    const snapshotIcon = snapshotCurrency === 'gold' ? '🪙' : '💎';

    playClickSound();
    setMovingBetKey(null);
    setSpinning(true);
    setSpinResultText(null);

    let ticks = 0;
    const interval = setInterval(() => {
      ticks++;
      setRolledNumber(Math.floor(Math.random() * 37));
      if (ticks >= 18) {
        clearInterval(interval);
        const finalNum = Math.floor(Math.random() * 37);
        const finalColor = getNumberColor(finalNum);
        setRolledNumber(finalNum);
        setRecentNumbers((prev) => [finalNum, ...prev.slice(0, 11)]);

        let totalPayout = 0;
        const winningLabels: string[] = [];
        for (const bet of snapshotBets) {
          if (doesRouletteBetMatch(bet.key, finalNum)) {
            const winAmt = Math.floor(bet.amount * bet.multiplier);
            totalPayout += winAmt;
            winningLabels.push(`${bet.label} (+${winAmt}${snapshotIcon})`);
          }
        }

        const colorName =
          finalColor === 'red' ? '🔴 Красное' : finalColor === 'black' ? '⚫ Чёрное' : '🟢 Зеро';

        // Immediately clear all placed bets from the board after win or loss so sectors stop glowing!
        setPlacedBets({});
        setMovingBetKey(null);
        const nextDl = Date.now() + ROULETTE_ROUND_SECONDS * 1000;
        setRoundDeadline(nextDl);
        setSecondsLeft(ROULETTE_ROUND_SECONDS);
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              betCurrency: snapshotCurrency,
              placedBets: {},
              roundDeadline: nextDl
            })
          );
        } catch {}

        if (totalPayout > 0) {
          playLootSound();
        } else {
          playCoinSound();
        }

        // Stake was already deducted when placing chips; only credit winnings if won
        onGamblingTransaction({
          gameName: 'Классическая Рулетка (1–36)',
          spentGold: 0,
          wonGold: snapshotCurrency === 'gold' ? totalPayout : 0,
          spentCrystals: 0,
          wonCrystals: snapshotCurrency === 'crystals' ? totalPayout : 0,
          countGame: true,
          logText:
            totalPayout > 0
              ? `🎯 Рулетка (1–36): выпало число ${finalNum} (${colorName})! Выигрыш: +${totalPayout} ${snapshotIcon} (Ставка: ${snapshotTotalStaked} ${snapshotIcon})`
              : `🎯 Рулетка (1–36): выпало число ${finalNum} (${colorName}). Ставка ${snapshotTotalStaked} ${snapshotIcon} не сыграла.`
        });

        setSpinResultText({
          won: totalPayout > 0,
          text:
            totalPayout > 0
              ? `🎉 Выпало ${finalNum} (${colorName})! Сыграли ставки: ${winningLabels.join(', ')}. Выигрыш зачислен: +${totalPayout.toLocaleString()} ${snapshotIcon}!`
              : `💀 Выпало ${finalNum} (${colorName}). Ставка (${snapshotTotalStaked.toLocaleString()} ${snapshotIcon}) проиграла и не возвращается.`
        });
        setSpinning(false);
      }
    }, 80);
  };

  // 2-Minute Spin Round Timer (counts down when bets are placed and automatically launches draw at 00:00)
  const launchRef = useRef(handleLaunchRoulette);
  launchRef.current = handleLaunchRoulette;
  const stakedRef = useRef(totalStaked);
  stakedRef.current = totalStaked;
  const spinningRef = useRef(spinning);
  spinningRef.current = spinning;

  useEffect(() => {
    const t = setInterval(() => {
      if (spinningRef.current) return;
      if (stakedRef.current <= 0) {
        setSecondsLeft(ROULETTE_ROUND_SECONDS);
        return;
      }
      const rem = Math.max(0, Math.ceil((roundDeadline - Date.now()) / 1000));
      setSecondsLeft(rem);
      if (rem <= 0) {
        launchRef.current();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [roundDeadline]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-red-950/60 via-slate-900 to-emerald-950/50 p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black text-amber-300 flex items-center gap-2">
            <span>🎯 Классическая Рулетка Фараона (0–36)</span>
            <span className="rounded-full bg-amber-500/20 border border-amber-400/50 px-2 py-0.5 text-[9.5px] text-amber-200">
              Макс. ставка: 5 000 🪙 / 5 000 💎
            </span>
          </div>
          <div className="text-[9.5px] text-slate-300 mt-0.5">
            Ставка снимается сразу. Розыгрыш через 2 мин после ставки — до крутки вы можете переставить фишку на любую другую цифру!
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="rounded-lg border border-amber-500/40 bg-slate-950/90 px-2.5 py-1 text-center">
            <div className="text-[8.5px] uppercase text-slate-400 font-bold">
              {totalStaked > 0 ? 'До розыгрыша (2 мин):' : 'Таймер розыгрыша:'}
            </div>
            <div
              className={`text-xs font-black font-mono ${
                totalStaked > 0 ? 'text-emerald-300 animate-pulse' : 'text-amber-300'
              }`}
            >
              ⏱️ {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-slate-400">Ставка (лимит 5 000):</div>
            <div
              className={`text-sm font-black ${
                betCurrency === 'gold' ? 'text-amber-300' : 'text-cyan-300'
              }`}
            >
              {totalStaked.toLocaleString()} / {MAX_ROULETTE_BET.toLocaleString()} {curIcon}
            </div>
          </div>
        </div>
      </div>

      {/* Wheel Display + Last Numbers + Currency & Chip Selector */}
      <div className="rounded-2xl border-2 border-amber-500/50 bg-[radial-gradient(circle_at_center,#1e1b2e_0%,#090d16_100%)] p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-16 h-16 rounded-full border-4 flex flex-col items-center justify-center font-black shadow-xl transition-transform ${
              spinning ? 'animate-spin border-amber-400' : 'border-amber-500/80'
            } ${
              rolledNumber === null
                ? 'bg-slate-900 text-amber-300'
                : getNumberColor(rolledNumber) === 'red'
                ? 'bg-red-700 text-white'
                : getNumberColor(rolledNumber) === 'black'
                ? 'bg-slate-950 text-white'
                : 'bg-emerald-700 text-white'
            }`}
          >
            <span className="text-xl leading-none">{rolledNumber !== null ? rolledNumber : '🎯'}</span>
            <span className="text-[8px] uppercase mt-0.5">
              {rolledNumber === null
                ? 'Рулетка'
                : getNumberColor(rolledNumber) === 'red'
                ? 'Красное'
                : getNumberColor(rolledNumber) === 'black'
                ? 'Чёрное'
                : 'Зеро'}
            </span>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-amber-300">
              {spinning ? 'Шарик вращается по колесу...' : 'История выпавших чисел:'}
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {recentNumbers.map((n, i) => {
                const c = getNumberColor(n);
                return (
                  <span
                    key={i}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${
                      c === 'red'
                        ? 'bg-red-700 border-red-400 text-white'
                        : c === 'black'
                        ? 'bg-slate-950 border-slate-600 text-slate-200'
                        : 'bg-emerald-700 border-emerald-400 text-white'
                    }`}
                  >
                    {n}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Currency Switcher + Chip Selector */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase text-slate-400">Валюта ставки:</span>
            <button
              type="button"
              disabled={spinning || totalStaked > 0}
              onClick={() => {
                setBetCurrency('gold');
                setChipValue(100);
                setSpinResultText(null);
              }}
              title={
                totalStaked > 0
                  ? 'Завершите крутку с текущими ставками для смены валюты'
                  : 'Ставить золотом (макс. 5000)'
              }
              className={`rounded-lg border px-2.5 py-1 text-[10px] font-black transition-all cursor-pointer disabled:opacity-40 ${
                betCurrency === 'gold'
                  ? 'border-amber-400 bg-amber-500 text-slate-950 shadow-sm'
                  : 'border-slate-700 bg-slate-900 text-amber-300 hover:border-amber-500/60'
              }`}
            >
              🪙 Золото ({hero.gold.toLocaleString()})
            </button>
            <button
              type="button"
              disabled={spinning || totalStaked > 0}
              onClick={() => {
                setBetCurrency('crystals');
                setChipValue(50);
                setSpinResultText(null);
              }}
              title={
                totalStaked > 0
                  ? 'Завершите крутку с текущими ставками для смены валюты'
                  : 'Ставить кристаллами (макс. 5000)'
              }
              className={`rounded-lg border px-2.5 py-1 text-[10px] font-black transition-all cursor-pointer disabled:opacity-40 ${
                betCurrency === 'crystals'
                  ? 'border-cyan-300 bg-cyan-500 text-slate-950 shadow-sm'
                  : 'border-slate-700 bg-slate-900 text-cyan-300 hover:border-cyan-500/60'
              }`}
            >
              💎 Кристаллы ({hero.crystals.toLocaleString()})
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1">
            <span className="text-[9px] font-bold uppercase text-slate-400 mr-1">
              Фишка ({curIcon}):
            </span>
            {[10, 50, 100, 500, 1000, 2500, 5000].map((val) => (
              <button
                key={val}
                type="button"
                disabled={spinning}
                onClick={() => setChipValue(val)}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-black transition-all cursor-pointer ${
                  chipValue === val
                    ? betCurrency === 'gold'
                      ? 'border-amber-300 bg-amber-500 text-slate-950 scale-105 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                      : 'border-cyan-200 bg-cyan-400 text-slate-950 scale-105 shadow-[0_0_10px_rgba(34,211,238,0.5)]'
                    : 'border-slate-700 bg-slate-900 text-amber-300 hover:border-amber-500/60'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Bets & Re-place ("Переставить") Control Panel */}
      {betsList.length > 0 && (
        <div className="rounded-xl border border-cyan-500/50 bg-slate-900/95 p-2.5 space-y-2 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] font-black text-cyan-300 flex items-center gap-1.5">
              <span>🔄 Ваши ставки на столе (можно переставить на другую цифру до розыгрыша):</span>
            </div>
            {movingBetKey && placedBets[movingBetKey] ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={spinning}
                  onClick={() => {
                    const b = placedBets[movingBetKey];
                    if (b) placeChipOn(b.key, b.label, b.multiplier, true);
                  }}
                  className="rounded-lg border border-emerald-400 bg-emerald-600/30 px-2 py-0.5 text-[9.5px] font-black text-emerald-200 hover:bg-emerald-600/50 cursor-pointer"
                >
                  ➕ Добавить +{chipValue} {curIcon} на «{placedBets[movingBetKey].label}»
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMovingBetKey(null);
                    setSpinResultText(null);
                  }}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-0.5 text-[9.5px] font-bold text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  ✕ Отмена перестановки
                </button>
              </div>
            ) : (
              betsList.length === 1 && (
                <button
                  type="button"
                  disabled={spinning}
                  onClick={() => {
                    const onlyBet = betsList[0];
                    setMovingBetKey(onlyBet.key);
                    setSpinResultText({
                      won: true,
                      text: `🔄 Выбрана ставка «${onlyBet.label}» (${onlyBet.amount.toLocaleString()} ${curIcon}). Нажмите на любую другую цифру на поле, чтобы переставить её туда!`
                    });
                  }}
                  className="rounded-lg border border-cyan-400 bg-cyan-500/20 px-2.5 py-0.5 text-[10px] font-black text-cyan-200 hover:bg-cyan-500/35 cursor-pointer animate-pulse"
                >
                  🔄 Переставить ставку на другую цифру
                </button>
              )
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {betsList.map((b) => {
              const isMovingThis = movingBetKey === b.key;
              return (
                <div
                  key={b.key}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold transition-all ${
                    isMovingThis
                      ? 'border-cyan-300 bg-cyan-900/70 text-white ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.5)]'
                      : 'border-amber-500/40 bg-slate-950 text-amber-200'
                  }`}
                >
                  <span>
                    {b.label}: <strong>{b.amount.toLocaleString()} {curIcon}</strong> (x{b.multiplier})
                  </span>
                  <button
                    type="button"
                    disabled={spinning}
                    onClick={() => {
                      if (isMovingThis) {
                        setMovingBetKey(null);
                        setSpinResultText(null);
                      } else {
                        setMovingBetKey(b.key);
                        setSpinResultText({
                          won: true,
                          text: `🔄 Выбрана ставка «${b.label}» (${b.amount.toLocaleString()} ${curIcon}). Нажмите на любую другую цифру или сектор на поле, чтобы переставить её туда!`
                        });
                      }
                    }}
                    className={`rounded px-1.5 py-0.5 text-[9px] font-black cursor-pointer transition-colors ${
                      isMovingThis
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-cyan-950 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-800'
                    }`}
                  >
                    {isMovingThis ? '👉 Выберите новую цифру...' : '🔄 Переставить'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {spinResultText && (
        <div
          className={`rounded-xl border px-3 py-2 text-[11px] font-black ${
            spinResultText.won
              ? 'border-emerald-400 bg-emerald-950/75 text-emerald-200'
              : 'border-rose-500/60 bg-rose-950/60 text-rose-200'
          }`}
        >
          {spinResultText.text}
        </div>
      )}

      {/* Roulette Betting Board (0 + 1..36 + Dozens + 1:1 Outside Bets) */}
      <div className="rounded-2xl border border-amber-500/40 bg-slate-950/95 p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400 px-1">
          <span>
            {movingBetKey && placedBets[movingBetKey]
              ? `🔄 РЕЖИМ ПЕРЕСТАНОВКИ: нажмите на любую цифру, чтобы перенести туда ${placedBets[movingBetKey].amount} ${curIcon} с «${placedBets[movingBetKey].label}»`
              : 'Нажмите на цифру для ставки (повторное нажатие на цифру со ставкой позволяет переставить её)'}
          </span>
          <span className="font-bold text-amber-300">
            Доступно до лимита: {remainingLimit.toLocaleString()} {curIcon}
          </span>
        </div>

        {/* Zero Button */}
        <button
          type="button"
          disabled={spinning}
          onClick={() => placeChipOn('num_0', 'Число 0 (Зеро)', 36)}
          className={`w-full rounded-lg border py-1.5 text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
            movingBetKey === 'num_0'
              ? 'border-cyan-300 bg-cyan-800/90 text-white ring-2 ring-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.7)]'
              : placedBets['num_0']
              ? 'border-amber-300 bg-emerald-800/90 text-white shadow-[0_0_12px_rgba(251,191,36,0.5)]'
              : 'border-emerald-500/70 bg-emerald-900/60 hover:bg-emerald-800/70 text-emerald-200'
          }`}
        >
          <span>🟢 0 — ЗЕРО (Коэффициент x36)</span>
          {placedBets['num_0'] && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-slate-950">
              {placedBets['num_0'].amount} {curIcon}{' '}
              {movingBetKey === 'num_0' ? '🔄 Переставить' : ''}
            </span>
          )}
        </button>

        {/* Numbers 1..36 Grid */}
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
          {Array.from({ length: 36 }, (_, idx) => idx + 1).map((num) => {
            const color = getNumberColor(num);
            const betKey = `num_${num}`;
            const staked = placedBets[betKey]?.amount || 0;
            const isMovingSource = movingBetKey === betKey;
            return (
              <button
                key={num}
                type="button"
                disabled={spinning}
                onClick={() => placeChipOn(betKey, `Число ${num}`, 36)}
                className={`relative rounded-lg border py-1.5 text-center transition-transform active:scale-95 cursor-pointer ${
                  color === 'red'
                    ? 'border-red-500/60 bg-red-900/70 hover:bg-red-800 text-white'
                    : 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200'
                } ${
                  isMovingSource
                    ? 'ring-2 ring-cyan-300 border-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.8)] scale-105'
                    : staked > 0
                    ? 'ring-2 ring-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                    : ''
                }`}
              >
                <div className="text-[11px] font-black">{num}</div>
                {staked > 0 && (
                  <div
                    className={`mt-0.5 mx-auto w-fit rounded-full px-1 text-[8px] font-black leading-tight ${
                      isMovingSource ? 'bg-cyan-300 text-slate-950' : 'bg-amber-400 text-slate-950'
                    }`}
                  >
                    {isMovingSource ? '🔄 ' : ''}
                    {staked}
                    {curIcon}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Dozens (x3) */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {[
            { key: 'doz_1', label: '1-я Дюжина (1–12)' },
            { key: 'doz_2', label: '2-я Дюжина (13–24)' },
            { key: 'doz_3', label: '3-я Дюжина (25–36)' }
          ].map((d) => {
            const staked = placedBets[d.key]?.amount || 0;
            const isMovingSource = movingBetKey === d.key;
            return (
              <button
                key={d.key}
                type="button"
                disabled={spinning}
                onClick={() => placeChipOn(d.key, d.label, 3)}
                className={`rounded-lg border py-1.5 px-2 text-[10px] font-black flex items-center justify-between cursor-pointer transition-all ${
                  isMovingSource
                    ? 'border-cyan-300 bg-cyan-900/70 text-white ring-2 ring-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.6)]'
                    : staked > 0
                    ? 'border-amber-300 bg-purple-900/70 text-white shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                    : 'border-purple-500/50 bg-purple-950/40 hover:bg-purple-900/50 text-purple-200'
                }`}
              >
                <span>{d.label} (x3)</span>
                {staked > 0 && (
                  <span className="rounded-full bg-amber-400 px-1.5 text-[8.5px] text-slate-950">
                    {isMovingSource ? '🔄 ' : ''}
                    {staked}
                    {curIcon}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Outside Bets (x2): 1-18, Even, Red, Black, Odd, 19-36 */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
          {[
            {
              key: 'low_1_18',
              label: '1–18 (Малые)',
              cls: 'border-slate-700 bg-slate-900 text-slate-200'
            },
            {
              key: 'even',
              label: 'ЧЁТНОЕ',
              cls: 'border-cyan-500/50 bg-cyan-950/40 text-cyan-200'
            },
            {
              key: 'red',
              label: '🔴 КРАСНОЕ',
              cls: 'border-red-500/70 bg-red-900/70 text-white'
            },
            {
              key: 'black',
              label: '⚫ ЧЁРНОЕ',
              cls: 'border-slate-600 bg-slate-950 text-white'
            },
            {
              key: 'odd',
              label: 'НЕЧЁТНОЕ',
              cls: 'border-cyan-500/50 bg-cyan-950/40 text-cyan-200'
            },
            {
              key: 'high_19_36',
              label: '19–36 (Большие)',
              cls: 'border-slate-700 bg-slate-900 text-slate-200'
            }
          ].map((out) => {
            const staked = placedBets[out.key]?.amount || 0;
            const isMovingSource = movingBetKey === out.key;
            return (
              <button
                key={out.key}
                type="button"
                disabled={spinning}
                onClick={() => placeChipOn(out.key, out.label, 2)}
                className={`rounded-lg border py-2 px-2 text-[10px] font-black flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:brightness-110 ${
                  out.cls
                } ${
                  isMovingSource
                    ? 'ring-2 ring-cyan-300 border-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.6)]'
                    : staked > 0
                    ? 'ring-2 ring-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                    : ''
                }`}
              >
                <span>{out.label} (x2)</span>
                {staked > 0 && (
                  <span className="rounded-full bg-amber-400 px-1.5 text-[8.5px] text-slate-950">
                    {isMovingSource ? '🔄 ' : ''}
                    {staked} {curIcon}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Draw Countdown Status Banner */}
      <div className="flex items-center gap-2">
        <div
          className={`w-full rounded-xl border-2 py-2.5 px-3 text-center text-xs sm:text-sm font-black uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.3)] ${
            spinning
              ? 'border-amber-400 bg-gradient-to-r from-red-600 via-amber-500 to-emerald-600 text-white'
              : totalStaked > 0
              ? 'border-emerald-400 bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950 text-emerald-200'
              : 'border-slate-700 bg-slate-900/90 text-slate-400'
          }`}
        >
          {spinning
            ? '🎯 Колесо крутится... Идёт розыгрыш!'
            : totalStaked <= 0
            ? '🎯 Сделайте ставку на цифру или сектор (после ставки начнётся отсчёт 2 мин до розыгрыша)'
            : `⏳ Розыгрыш через ${String(mins).padStart(2, '0')}:${String(secs).padStart(
                2,
                '0'
              )} • На кону: ${totalStaked.toLocaleString()} ${curIcon} (можно переставить фишку на другую цифру)`}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. «БОИ СКАРАБЕЕВ» (ТОТАЛИЗАТОР)
// ============================================================================
export type ScarabArchetypeKey = 'сила' | 'ловкость' | 'броня' | 'крит' | 'яд';
export type ScarabRarity = 'Обычный' | 'Редкий' | 'Эпический' | 'Легендарный' | 'Мифический';

interface ScarabRarityConfig {
  rarity: ScarabRarity;
  label: string;
  badgeCls: string;
  levelMin: number;
  levelMax: number;
  bonusAtkMin: number;
  bonusAtkMax: number;
  bonusAgiMin: number;
  bonusAgiMax: number;
  bonusCritMin: number;
  bonusCritMax: number;
}

const SCARAB_RARITIES: ScarabRarityConfig[] = [
  {
    rarity: 'Обычный',
    label: 'Обычный',
    badgeCls: 'bg-slate-800 text-slate-300 border-slate-600',
    levelMin: 1,
    levelMax: 4,
    bonusAtkMin: 5,
    bonusAtkMax: 10,
    bonusAgiMin: 5,
    bonusAgiMax: 9,
    bonusCritMin: 4,
    bonusCritMax: 8
  },
  {
    rarity: 'Редкий',
    label: 'Редкий',
    badgeCls: 'bg-cyan-950 text-cyan-300 border-cyan-500/70',
    levelMin: 5,
    levelMax: 8,
    bonusAtkMin: 11,
    bonusAtkMax: 18,
    bonusAgiMin: 10,
    bonusAgiMax: 16,
    bonusCritMin: 9,
    bonusCritMax: 15
  },
  {
    rarity: 'Эпический',
    label: 'Эпический',
    badgeCls: 'bg-purple-950 text-purple-300 border-purple-500/70',
    levelMin: 9,
    levelMax: 12,
    bonusAtkMin: 19,
    bonusAtkMax: 28,
    bonusAgiMin: 17,
    bonusAgiMax: 24,
    bonusCritMin: 16,
    bonusCritMax: 24
  },
  {
    rarity: 'Легендарный',
    label: 'Легендарный',
    badgeCls: 'bg-amber-950 text-amber-300 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]',
    levelMin: 13,
    levelMax: 16,
    bonusAtkMin: 29,
    bonusAtkMax: 38,
    bonusAgiMin: 25,
    bonusAgiMax: 32,
    bonusCritMin: 25,
    bonusCritMax: 35
  },
  {
    rarity: 'Мифический',
    label: 'Мифический',
    badgeCls: 'bg-rose-950 text-rose-300 border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]',
    levelMin: 17,
    levelMax: 20,
    bonusAtkMin: 39,
    bonusAtkMax: 50,
    bonusAgiMin: 32,
    bonusAgiMax: 42,
    bonusCritMin: 36,
    bonusCritMax: 48
  }
];

interface ScarabFighter {
  id: 'scarab1' | 'scarab2';
  name: string;
  title: string;
  icon: string;
  colorCls: string;
  archetype: ScarabArchetypeKey;
  archetypeLabel: string;
  rarity: ScarabRarity;
  rarityLabel: string;
  rarityBadgeCls: string;
  level: number;
  bonusAtk: number;
  bonusAgility: number;
  bonusCrit: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  agility: number; // Ловкость: шанс уклонения от удара, контратаки и перехвата инициативы (+15% базовая)
  critPct: number; // Шанс критического удара (растет от редкости, наносит 2x урон)
  skillName: string;
  skillDesc: string;
  winProb: number;
  odds: number;
}

// Базовые пресеты с увеличенным на +15% базовым HP и +15% базовой ловкостью/уворотом
const SCARAB_PRESETS = [
  {
    name: 'Скарабей Рубиновый',
    title: 'Ярость Сета (Смертоносный титан)',
    icon: '🦀',
    colorCls: 'text-rose-400 border-rose-500/70',
    archetype: 'сила' as const,
    archetypeLabel: '🗡️ Силовик',
    baseHp: 290, // увеличено на +15% (было 250)
    baseAtk: 50,
    baseDef: 9,
    baseAgility: 18, // увеличено на +15% (было 14)
    baseCrit: 24,
    skillName: '🔥 Сокрушение Сета',
    skillDesc: 'Шанс пробивающего удара двойной силы'
  },
  {
    name: 'Скарабей Песчаный',
    title: 'Охотник Барханов (Мастер ловкости)',
    icon: '🦂',
    colorCls: 'text-amber-300 border-amber-500/70',
    archetype: 'ловкость' as const,
    archetypeLabel: '💨 Ловкач',
    baseHp: 250, // увеличено на +15% (было 215)
    baseAtk: 34,
    baseDef: 7,
    baseAgility: 44, // увеличено на +15% (было 36)
    baseCrit: 20,
    skillName: '💨 Песчаный мираж',
    skillDesc: 'Уклонение от ударов и быстрый контрудар'
  },
  {
    name: 'Скарабей Золотой',
    title: 'Страж Ра (Несокрушимый панцирь)',
    icon: '🪲',
    colorCls: 'text-yellow-300 border-yellow-500/70',
    archetype: 'броня' as const,
    archetypeLabel: '🛡️ Танк',
    baseHp: 370, // увеличено на +15% (было 320)
    baseAtk: 29,
    baseDef: 24,
    baseAgility: 14, // увеличено на +15% (было 10)
    baseCrit: 12,
    skillName: '🛡️ Солнечный барьер',
    skillDesc: 'Блокирует 50% входящего урона панцирем'
  },
  {
    name: 'Скарабей Обсидиановый',
    title: 'Жнец Анубиса (Ассасин теней)',
    icon: '🕷️',
    colorCls: 'text-purple-300 border-purple-500/70',
    archetype: 'крит' as const,
    archetypeLabel: '💥 Ассасин',
    baseHp: 255, // увеличено на +15% (было 220)
    baseAtk: 42,
    baseDef: 9,
    baseAgility: 26, // увеличено на +15% (было 22)
    baseCrit: 38,
    skillName: '💥 Смертельный выпад',
    skillDesc: 'Критический удар наносит 215% урона'
  },
  {
    name: 'Скарабей Изумрудный',
    title: 'Вестник Осириса (Токсичный мистик)',
    icon: '🪲',
    colorCls: 'text-emerald-300 border-emerald-500/70',
    archetype: 'яд' as const,
    archetypeLabel: '🧪 Травитель',
    baseHp: 305, // увеличено на +15% (было 265)
    baseAtk: 32,
    baseDef: 15,
    baseAgility: 22, // увеличено на +15% (было 18)
    baseCrit: 16,
    skillName: '🧪 Смертоносный яд',
    skillDesc: 'Отравляет врага ядом сквозь любую броню'
  },
  {
    name: 'Скарабей Сапфировый',
    title: 'Хранитель Нила (Вихревой охотник)',
    icon: '🦋',
    colorCls: 'text-cyan-300 border-cyan-500/70',
    archetype: 'ловкость' as const,
    archetypeLabel: '💨 Ловкач',
    baseHp: 265, // увеличено на +15% (было 230)
    baseAtk: 36,
    baseDef: 12,
    baseAgility: 38, // увеличено на +15% (было 32)
    baseCrit: 22,
    skillName: '🌊 Водный рывок',
    skillDesc: 'Высокая инициатива и серия быстрых атак'
  },
  {
    name: 'Скарабей Базальтовый',
    title: 'Глубинный Монолит (Колосс земли)',
    icon: '🪨',
    colorCls: 'text-slate-300 border-slate-500/70',
    archetype: 'броня' as const,
    archetypeLabel: '🛡️ Танк',
    baseHp: 390, // увеличено на +15% (было 340)
    baseAtk: 30,
    baseDef: 22,
    baseAgility: 12, // увеличено на +15% (было 9)
    baseCrit: 14,
    skillName: '🗿 Каменный панцирь',
    skillDesc: 'Поглощает удары и отражает шипами осколки'
  },
  {
    name: 'Скарабей Пепельный',
    title: 'Вихрь Хаоса (Огненный берсерк)',
    icon: '🔥',
    colorCls: 'text-orange-300 border-orange-500/70',
    archetype: 'сила' as const,
    archetypeLabel: '🗡️ Силовик',
    baseHp: 270, // увеличено на +15% (было 235)
    baseAtk: 48,
    baseDef: 10,
    baseAgility: 24, // увеличено на +15% (было 20)
    baseCrit: 25,
    skillName: '🌪️ Шквал когтей',
    skillDesc: 'Яростный шквал с шансом двойного удара'
  }
];

function rollRarityConfig(): ScarabRarityConfig {
  const r = Math.random();
  if (r < 0.22) return SCARAB_RARITIES[0]; // Обычный 22%
  if (r < 0.52) return SCARAB_RARITIES[1]; // Редкий 30%
  if (r < 0.80) return SCARAB_RARITIES[2]; // Эпический 28%
  if (r < 0.93) return SCARAB_RARITIES[3]; // Легендарный 13%
  return SCARAB_RARITIES[4];              // Мифический 7%
}

function generateScarabPair(): [ScarabFighter, ScarabFighter] {
  const shuffled = [...SCARAB_PRESETS].sort(() => Math.random() - 0.5);
  const p1 = shuffled[0];
  const p2 = shuffled[1];

  const r1 = rollRarityConfig();
  const lvl1 = Math.floor(Math.random() * (r1.levelMax - r1.levelMin + 1)) + r1.levelMin;
  const bonusAtk1 = Math.floor(Math.random() * (r1.bonusAtkMax - r1.bonusAtkMin + 1)) + r1.bonusAtkMin;
  const bonusAgi1 = Math.floor(Math.random() * (r1.bonusAgiMax - r1.bonusAgiMin + 1)) + r1.bonusAgiMin;
  const bonusCrit1 = Math.floor(Math.random() * (r1.bonusCritMax - r1.bonusCritMin + 1)) + r1.bonusCritMin;

  const r2 = rollRarityConfig();
  const lvl2 = Math.floor(Math.random() * (r2.levelMax - r2.levelMin + 1)) + r2.levelMin;
  const bonusAtk2 = Math.floor(Math.random() * (r2.bonusAtkMax - r2.bonusAtkMin + 1)) + r2.bonusAtkMin;
  const bonusAgi2 = Math.floor(Math.random() * (r2.bonusAgiMax - r2.bonusAgiMin + 1)) + r2.bonusAgiMin;
  const bonusCrit2 = Math.floor(Math.random() * (r2.bonusCritMax - r2.bonusCritMin + 1)) + r2.bonusCritMin;

  const hp1 = p1.baseHp + lvl1 * 8 + Math.floor(Math.random() * 16);
  const atk1 = p1.baseAtk + bonusAtk1;
  const def1 = p1.baseDef + Math.floor(lvl1 * 0.45);
  const agi1 = Math.min(65, p1.baseAgility + bonusAgi1);
  const crit1 = Math.min(75, p1.baseCrit + bonusCrit1 + Math.floor(lvl1 * 0.35));

  const hp2 = p2.baseHp + lvl2 * 8 + Math.floor(Math.random() * 16);
  const atk2 = p2.baseAtk + bonusAtk2;
  const def2 = p2.baseDef + Math.floor(lvl2 * 0.45);
  const agi2 = Math.min(65, p2.baseAgility + bonusAgi2);
  const crit2 = Math.min(75, p2.baseCrit + bonusCrit2 + Math.floor(lvl2 * 0.35));

  // Dynamic power rating calculation including strength, agility, armor, and 2x crits
  const power1 = hp1 * 0.42 + atk1 * 3.3 + def1 * 2.2 + agi1 * 3.1 + crit1 * 2.5;
  const power2 = hp2 * 0.42 + atk2 * 3.3 + def2 * 2.2 + agi2 * 3.1 + crit2 * 2.5;
  const totalPower = power1 + power2;

  const rawProb1 = power1 / totalPower;
  // Volatility compression so probabilities are competitive and neither side is guaranteed (30% - 70%)
  const prob1 = Math.min(0.70, Math.max(0.30, 0.5 + (rawProb1 - 0.5) * 0.85));
  const prob2 = 1 - prob1;

  // Bookmaker margin of ~8% for realistic totalizator odds
  const odds1 = Number(Math.max(1.30, Math.min(3.40, (0.92 / prob1))).toFixed(2));
  const odds2 = Number(Math.max(1.30, Math.min(3.40, (0.92 / prob2))).toFixed(2));

  return [
    {
      id: 'scarab1',
      name: p1.name,
      title: p1.title,
      icon: p1.icon,
      colorCls: p1.colorCls,
      archetype: p1.archetype,
      archetypeLabel: p1.archetypeLabel,
      rarity: r1.rarity,
      rarityLabel: r1.label,
      rarityBadgeCls: r1.badgeCls,
      level: lvl1,
      bonusAtk: bonusAtk1,
      bonusAgility: bonusAgi1,
      bonusCrit: bonusCrit1,
      hp: hp1,
      maxHp: hp1,
      atk: atk1,
      def: def1,
      agility: agi1,
      critPct: crit1,
      skillName: p1.skillName,
      skillDesc: p1.skillDesc,
      winProb: Math.round(prob1 * 100),
      odds: odds1
    },
    {
      id: 'scarab2',
      name: p2.name,
      title: p2.title,
      icon: p2.icon,
      colorCls: p2.colorCls,
      archetype: p2.archetype,
      archetypeLabel: p2.archetypeLabel,
      rarity: r2.rarity,
      rarityLabel: r2.label,
      rarityBadgeCls: r2.badgeCls,
      level: lvl2,
      bonusAtk: bonusAtk2,
      bonusAgility: bonusAgi2,
      bonusCrit: bonusCrit2,
      hp: hp2,
      maxHp: hp2,
      atk: atk2,
      def: def2,
      agility: agi2,
      critPct: crit2,
      skillName: p2.skillName,
      skillDesc: p2.skillDesc,
      winProb: Math.round(prob2 * 100),
      odds: odds2
    }
  ];
}

export const ScarabFightsTotalizatorView: React.FC<SubGameCommonProps> = ({
  hero,
  onGamblingTransaction
}) => {
  const [fighters, setFighters] = useState<[ScarabFighter, ScarabFighter]>(() => generateScarabPair());
  const [selectedFighter, setSelectedFighter] = useState<'scarab1' | 'scarab2'>('scarab1');
  const [betAmount, setBetAmount] = useState<string>('100');
  const [lockedBet, setLockedBet] = useState<{
    fighterId: 'scarab1' | 'scarab2';
    amount: number;
    odds: number;
    fighterName: string;
  } | null>(null);
  const [isFighting, setIsFighting] = useState(false);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [winnerResult, setWinnerResult] = useState<{
    winnerId: 'scarab1' | 'scarab2';
    winnerName: string;
    playerWon: boolean;
    payout: number;
    text: string;
  } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const period = 15 * 60;
    return period - (Math.floor(Date.now() / 1000) % period);
  });

  const fightIntervalRef = useRef<any>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return 15 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    return () => {
      if (fightIntervalRef.current) clearInterval(fightIntervalRef.current);
    };
  }, []);

  const parsedBet = Math.max(1, Math.floor(Number(betAmount) || 0));
  const chosenScarab = fighters[selectedFighter === 'scarab1' ? 0 : 1];

  const handleLockBet = () => {
    if (isFighting || lockedBet) return;
    if (parsedBet <= 0 || parsedBet > hero.gold) {
      setCombatLog(['❌ Недостаточно золота на балансе для принятия ставки в тотализаторе!']);
      return;
    }
    playCoinSound();
    // Immediately deduct stake and record spent gold
    onGamblingTransaction({
      gameName: 'Бои Скарабеев (Ставка)',
      spentGold: parsedBet,
      wonGold: 0,
      countGame: false,
      logText: `🪲 Принята ставка ${parsedBet} 🪙 на бойца «${chosenScarab.name}» (x${chosenScarab.odds})`
    });
    setLockedBet({
      fighterId: selectedFighter,
      amount: parsedBet,
      odds: chosenScarab.odds,
      fighterName: chosenScarab.name
    });
    setWinnerResult(null);
    setCombatLog([
      `✅ Ваша ставка ${parsedBet.toLocaleString()} 🪙 на «${chosenScarab.name}» (коэф. x${chosenScarab.odds}) принята и списана со счёта! Нажмите «⚡ Начать бой сейчас», чтобы запустить поединок.`
    ]);
  };

  const startScarabBattle = () => {
    if (isFighting) return;
    if (!lockedBet) {
      setCombatLog(['⚠️ Сначала выберите одного из двух Скарабеев и нажмите «Сделать ставку»!']);
      return;
    }

    playClickSound();
    setIsFighting(true);
    setWinnerResult(null);

    let f1 = {
      ...fighters[0],
      hp: fighters[0].maxHp,
      enraged: false,
      blindTurns: 0
    };
    let f2 = {
      ...fighters[1],
      hp: fighters[1].maxHp,
      enraged: false,
      blindTurns: 0
    };
    setFighters([f1, f2]);
    setCombatLog([
      `⚔️ Гонг арены! «${f1.name}» [${f1.rarityLabel} Ур.${f1.level}] против «${f2.name}» [${f2.rarityLabel} Ур.${f2.level}] — смертельная битва началась!`
    ]);

    let turn = 0;
    fightIntervalRef.current = setInterval(() => {
      turn++;

      // Dynamic Initiative: Agility + random roll determines attacker tempo
      const initRoll1 = f1.agility * 1.5 + Math.random() * 45;
      const initRoll2 = f2.agility * 1.5 + Math.random() * 45;
      const attackerIsF1 = initRoll1 >= initRoll2;

      const atkScarab = attackerIsF1 ? f1 : f2;
      const defScarab = attackerIsF1 ? f2 : f1;

      // Handle Blindness (Ослепление песком арены)
      if (atkScarab.blindTurns > 0) {
        atkScarab.blindTurns--;
        const logLine = `🌪️ «${atkScarab.name}» ослеплён песчаной бурей и промахивается вслепую! (Ход потерян)`;
        setCombatLog((prev) => [logLine, ...prev.slice(0, 14)]);
        return;
      }

      // Check Evasion (Ловкость): Increased by +15% and boosted by rarity
      const evadeChance = Math.min(58, defScarab.agility);
      const isEvaded = Math.random() * 100 < evadeChance;

      let logLine = '';

      if (isEvaded) {
        // Defender successfully dodged!
        const counterRoll = Math.random() * 100 < defScarab.agility * 0.8;
        const blindRoll = Math.random() * 100 < 30;
        if (blindRoll) {
          atkScarab.blindTurns = 1;
        }

        if (counterRoll) {
          const counterDmg = Math.max(9, Math.floor(defScarab.atk * 0.70 - atkScarab.def * 0.28));
          atkScarab.hp = Math.max(0, atkScarab.hp - counterDmg);
          logLine = `💨 УВОРОТ И КОНТРУДАР! «${defScarab.name}» ловко уклонился от выпада и контратаковал жвалами на -${counterDmg} ❤️!${blindRoll ? ' 🌪️ (Враг ослеплён песком!)' : ''} (У «${atkScarab.name}» ${atkScarab.hp}/${atkScarab.maxHp} ❤️)`;
        } else {
          logLine = `💨 УВОРОТ! «${defScarab.name}» молниеносно увернулся от выпада «${atkScarab.name}»! Урон не прошёл.${blindRoll ? ' 🌪️ (Враг ослеплён песком!)' : ''}`;
        }
      } else {
        // Hit landed! Check Crits (Deal full 2x damage upon critical strike as requested)
        const isCrit = Math.random() * 100 < atkScarab.critPct;

        // Armor blocking
        const blockChance = Math.min(38, defScarab.def * 1.3);
        const isBlocked = Math.random() * 100 < blockChance;

        let baseDamage = Math.max(8, atkScarab.atk - Math.floor(defScarab.def * 0.42) + Math.floor(Math.random() * 10) - 4);
        if (isCrit) {
          baseDamage = Math.floor(baseDamage * 2.0); // 2x сокрушительный урон при критическом ударе!
        }
        if (isBlocked) {
          baseDamage = Math.max(5, Math.floor(baseDamage * 0.5));
        }

        let extraSkillText = '';

        // Archetype Special Skills
        if (atkScarab.archetype === 'сила' && Math.random() * 100 < 30) {
          baseDamage += 16;
          extraSkillText = ' 🔥 Сокрушение Сета (+16 урона)!';
        } else if (atkScarab.archetype === 'яд' && Math.random() * 100 < 35) {
          baseDamage += 12;
          extraSkillText = ' 🧪 Смертоносный яд (+12 урона сквозь хитин)!';
        }

        // Armor Reflected Thorns
        if (defScarab.archetype === 'броня' && isBlocked && Math.random() * 100 < 35) {
          const reflectDmg = Math.max(5, Math.floor(baseDamage * 0.30));
          atkScarab.hp = Math.max(0, atkScarab.hp - reflectDmg);
          extraSkillText += ` 🗿 Шипы панциря отразили ${reflectDmg} урона во врага!`;
        }

        // Low HP Enrage mechanic (survival surge)
        if (!defScarab.enraged && defScarab.hp - baseDamage <= defScarab.maxHp * 0.35 && defScarab.hp - baseDamage > 0) {
          defScarab.enraged = true;
          baseDamage = Math.max(4, Math.floor(baseDamage * 0.65));
          defScarab.atk += 14;
          defScarab.agility = Math.min(68, defScarab.agility + 12);
          extraSkillText += ' 🔥 ЯРОСТЬ ПУСТЫНИ! (Получен всплеск адреналина: +14 Атаки, +12% Уворота!)';
        }

        defScarab.hp = Math.max(0, defScarab.hp - baseDamage);
        const critBadge = isCrit ? ' (💥 КРИТ 2x УРОН!)' : '';
        const blockBadge = isBlocked ? ' (🛡️ БЛОК!)' : '';

        logLine = `${attackerIsF1 ? '🪲' : '🦂'} Раунд ${turn}: «${atkScarab.name}» наносит ${baseDamage} урона${critBadge}${blockBadge}${extraSkillText} по «${defScarab.name}» (Осталось ${defScarab.hp}/${defScarab.maxHp} ❤️)`;
      }

      setFighters([{ ...f1 }, { ...f2 }]);
      setCombatLog((prev) => [logLine, ...prev.slice(0, 14)]);

      // Check for death (either defender or attacker killed by counter-attack/thorns)
      if (defScarab.hp <= 0 || atkScarab.hp <= 0) {
        clearInterval(fightIntervalRef.current);
        const winner = defScarab.hp <= 0 ? atkScarab : defScarab;
        const playerWon = lockedBet.fighterId === winner.id;
        const payout = playerWon ? Math.floor(lockedBet.amount * lockedBet.odds) : 0;

        if (playerWon) {
          playLootSound();
        } else {
          playCoinSound();
        }

        onGamblingTransaction({
          gameName: 'Бои Скарабеев',
          spentGold: 0,
          wonGold: playerWon ? payout : 0,
          countGame: true,
          logText: playerWon
            ? `🏆 Бои Скарабеев: победил «${winner.name}»! Выигрыш по тотализатору: +${payout} 🪙 (x${lockedBet.odds})`
            : `💀 Бои Скарабеев: победил «${winner.name}». Ставка ${lockedBet.amount} 🪙 не сыграла.`
        });

        setWinnerResult({
          winnerId: winner.id,
          winnerName: winner.name,
          playerWon,
          payout,
          text: playerWon
            ? `🏆 Победил «${winner.name}» [${winner.rarityLabel}]! Ваша ставка сыграла (x${lockedBet.odds}): вы получили +${payout.toLocaleString()} 🪙!`
            : `💀 Победил «${winner.name}» [${winner.rarityLabel}]! Ваш боец повержен на арене, ставка ${lockedBet.amount.toLocaleString()} 🪙 сгорела.`
        });
        setLockedBet(null);
        setIsFighting(false);
      }
    }, 450);
  };

  const handleNextPair = () => {
    if (isFighting || lockedBet) return;
    playClickSound();
    setFighters(generateScarabPair());
    setWinnerResult(null);
    setCombatLog(['🔄 На арену вышли два новых боевых Скарабея! Изучите их силу, ловкость, редкость и коэффициенты.']);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="space-y-2.5">
      {/* Top Info & Timer */}
      <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/60 via-slate-900 to-emerald-950/50 p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
            <span>🪲 Бои Скарабеев (Усиленная Арена Тотализатора)</span>
          </div>
          <div className="text-[9.5px] text-slate-300 mt-0.5">
            У скарабеев увеличены базовое HP и уворот (+15%), добавлены ранги редкости (Обычный–Мифический) с бонусами к Силе и Ловкости, а также механика выживания «Ярость Пустыни»!
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-amber-500/40 bg-slate-950 px-2.5 py-1 text-right">
            <div className="text-[8px] uppercase text-slate-400">Авто-раунд через:</div>
            <div className="font-mono text-xs font-black text-amber-300">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
          </div>
          <button
            type="button"
            disabled={isFighting || Boolean(lockedBet)}
            onClick={handleNextPair}
            className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 text-[10px] font-black text-cyan-300 disabled:opacity-40 cursor-pointer"
          >
            🔄 Новая пара
          </button>
        </div>
      </div>

      {/* Two Scarab Fighters Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {fighters.map((f) => {
          const isChosen = selectedFighter === f.id;
          const hpPct = Math.max(0, Math.min(100, Math.round((f.hp / f.maxHp) * 100)));
          return (
            <div
              key={f.id}
              onClick={() => !isFighting && !lockedBet && setSelectedFighter(f.id)}
              className={`rounded-2xl border-2 p-3 transition-all cursor-pointer ${
                isChosen
                  ? 'border-amber-400 bg-gradient-to-b from-amber-950/50 via-slate-900 to-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                  : 'border-slate-800 bg-slate-900/90 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{f.icon}</span>
                  <div>
                    <div className="text-xs font-black text-white flex flex-wrap items-center gap-1">
                      <span>{f.name}</span>
                      <span className={`rounded border px-1 py-0.2 text-[8px] font-black ${f.rarityBadgeCls}`}>
                        {f.rarityLabel} Ур.{f.level}
                      </span>
                      <span className="rounded bg-slate-800 border border-slate-700 px-1 py-0.2 text-[8px] font-bold text-amber-300">
                        {f.archetypeLabel}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-400">{f.title}</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="rounded-lg border border-emerald-400/60 bg-emerald-950/80 px-2 py-0.5 text-xs font-black text-emerald-300">
                    x{f.odds}
                  </span>
                  <div className="text-[8.5px] text-slate-400 mt-0.5">Шанс: ~{f.winProb}%</div>
                </div>
              </div>

              {/* HP Bar */}
              <div className="mt-2.5 space-y-1">
                <div className="flex justify-between text-[9.5px] font-bold">
                  <span className="text-red-300">❤️ Здоровье (+15%):</span>
                  <span className="text-white">
                    {f.hp} / {f.maxHp} ({hpPct}%)
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
              </div>

              {/* Fighter Stats (Strength, Agility, Armor, Crit) */}
              <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[9px]">
                <div className="rounded bg-slate-950/90 border border-slate-800 py-1">
                  <div className="text-slate-400 text-[7.5px] uppercase">Сила</div>
                  <div className="font-black text-amber-300">⚔️ {f.atk}</div>
                  <div className="text-[7px] text-amber-400/80">+{f.bonusAtk} ранг</div>
                </div>
                <div className={`rounded bg-slate-950/90 border py-1 ${f.agility >= 30 ? 'border-amber-400/50 bg-amber-950/30' : 'border-slate-800'}`}>
                  <div className="text-slate-400 text-[7.5px] uppercase">Ловкость</div>
                  <div className="font-black text-emerald-300">💨 {f.agility}%</div>
                  <div className="text-[7px] text-emerald-400/80">+{f.bonusAgility}% ранг</div>
                </div>
                <div className="rounded bg-slate-950/90 border border-slate-800 py-1">
                  <div className="text-slate-400 text-[7.5px] uppercase">Броня</div>
                  <div className="font-black text-cyan-300">🛡️ {f.def}</div>
                </div>
                <div className={`rounded bg-slate-950/90 border py-1 ${f.critPct >= 35 ? 'border-purple-400/50 bg-purple-950/30' : 'border-slate-800'}`}>
                  <div className="text-slate-400 text-[7.5px] uppercase">Крит (2x)</div>
                  <div className="font-black text-purple-300">💥 {f.critPct}%</div>
                  <div className="text-[7px] text-purple-400/80">+{f.bonusCrit}% ранг</div>
                </div>
              </div>

              {/* Unique Skill & Trait */}
              <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-950/60 p-1.5 text-[8.5px] text-slate-300 flex items-center justify-between gap-1">
                <span className="font-bold text-amber-300">{f.skillName}</span>
                <span className="text-[8px] text-slate-400 truncate">{f.skillDesc}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Winner Banner */}
      {winnerResult && (
        <div
          className={`rounded-xl border px-3 py-2 text-xs font-black ${
            winnerResult.playerWon
              ? 'border-emerald-400 bg-emerald-950/80 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
              : 'border-rose-500/60 bg-rose-950/70 text-rose-200'
          }`}
        >
          {winnerResult.text}
        </div>
      )}

      {/* Bet Controls & Launch Fight */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/95 p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
          <span className="font-black text-amber-300">
            Выбран боец: «{chosenScarab.name}» [{chosenScarab.rarityLabel} Ур.{chosenScarab.level}] (x{chosenScarab.odds})
          </span>
          <span className="font-bold text-emerald-300">
            Выплата при победе: +{Math.floor(parsedBet * chosenScarab.odds).toLocaleString()} 🪙
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="number"
            min={10}
            max={hero.gold}
            disabled={isFighting || Boolean(lockedBet)}
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            className="w-28 sm:w-36 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs font-black text-white outline-none focus:border-amber-400"
          />
          {[100, 500, 1000, 5000].map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={isFighting || Boolean(lockedBet)}
              onClick={() => setBetAmount(String(preset))}
              className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-2 text-[10px] font-black text-amber-300 disabled:opacity-40 cursor-pointer"
            >
              {preset}🪙
            </button>
          ))}

          {!lockedBet ? (
            <button
              type="button"
              disabled={isFighting || parsedBet <= 0 || parsedBet > hero.gold}
              onClick={handleLockBet}
              className="flex-1 rounded-xl border border-amber-400 bg-amber-500 hover:bg-amber-400 py-2 px-3 text-xs font-black text-slate-950 shadow cursor-pointer disabled:opacity-40"
            >
              💰 Сделать ставку ({parsedBet.toLocaleString()} 🪙)
            </button>
          ) : (
            <button
              type="button"
              disabled={isFighting}
              onClick={startScarabBattle}
              className="flex-1 rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 py-2 px-3 text-xs font-black text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse cursor-pointer"
            >
              {isFighting ? '⚔️ Идёт бой на арене...' : '⚡ Начать бой сейчас!'}
            </button>
          )}
        </div>
      </div>

      {/* Live Battle Log */}
      {combatLog.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 max-h-40 overflow-y-auto space-y-1">
          <div className="text-[9px] font-black uppercase text-slate-400 flex items-center justify-between">
            <span>📜 Хроника песчаной арены:</span>
            <span className="text-[8px] text-amber-400/80">💥 Крит = 2x сокрушительный урон (растёт с редкостью) | 💨 Уворот (+15%) | 🌪️ Ослепление | 🔥 Ярость &lt;35% HP</span>
          </div>
          {combatLog.map((line, idx) => (
            <div key={idx} className="text-[10px] text-slate-200 font-medium leading-snug">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 5. «ТУРНИР СКАРАБЕЕВ» (SCARAB TOURNAMENT WITH TRAINING, BRACKETS & LEADERBOARD)
// ============================================================================

export type TournamentScarabArchetypeKey = 'juggernaut' | 'swift' | 'tank' | 'assassin';

export interface ScarabArchetypeMeta {
  key: TournamentScarabArchetypeKey;
  label: string;
  badge: string;
  icon: string;
  color: string;
  bonusDesc: string;
}

export const SCARAB_ARCHETYPES: Record<TournamentScarabArchetypeKey, ScarabArchetypeMeta> = {
  juggernaut: {
    key: 'juggernaut',
    label: 'Силовик',
    badge: '💥 Сокрушение',
    icon: '⚔️',
    color: 'text-amber-400 border-amber-500/40 bg-amber-950/40',
    bonusDesc: '+7 базового урона и «Ярость Сета» при <35% HP (+15 урона)'
  },
  swift: {
    key: 'swift',
    label: 'Ловкач',
    badge: '💨 Вихрь песков',
    icon: '🌪️',
    color: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/40',
    bonusDesc: '+18% к увороту, высокий шанс контратаки при уклонении'
  },
  tank: {
    key: 'tank',
    label: 'Панцирник',
    badge: '🛡️ Стена Хепри',
    icon: '🧱',
    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40',
    bonusDesc: '+35 HP, +6 Брони и возврат 20% урона обратно врагу'
  },
  assassin: {
    key: 'assassin',
    label: 'Ассасин',
    badge: '⚡ Смертельный выпад',
    icon: '🗡️',
    color: 'text-purple-300 border-purple-500/40 bg-purple-950/40',
    bonusDesc: '+14% к шансу крита 2x и внезапный первый удар в начале боя'
  }
};

export interface TrainedScarab {
  id: string;
  trainerNick: string;
  name: string;
  avatar: string;
  archetype: TournamentScarabArchetypeKey;
  level: number;
  xp: number;
  xpToNext: number;
  // Attributes
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  armor: number;
  critChance: number;
  // Tournament Records
  trophies: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  matchesWon: number;
  matchesLost: number;
  totalPrizeGold: number;
  totalPrizeCrystals: number;
}

export interface TournamentCupConfig {
  id: 'bronze' | 'silver' | 'gold';
  name: string;
  badge: string;
  icon: string;
  entryFeeGold: number;
  prize1stGold: number;
  prize1stCrystals: number;
  prize1stTrophies: number;
  prize1stXp: number;
  prize2ndGold: number;
  prize2ndTrophies: number;
  prize2ndXp: number;
  minLvl: number;
  maxLvl: number;
  desc: string;
  tierColor: string;
}

export const TOURNAMENT_CUPS: TournamentCupConfig[] = [
  {
    id: 'bronze',
    name: 'Песчаный Кубок (Бронза)',
    badge: '🥉 Лига Песков',
    icon: '🥉',
    entryFeeGold: 25,
    prize1stGold: 65,
    prize1stCrystals: 1,
    prize1stTrophies: 15,
    prize1stXp: 90,
    prize2ndGold: 30,
    prize2ndTrophies: 7,
    prize2ndXp: 40,
    minLvl: 2,
    maxLvl: 6,
    desc: 'Турнир закалённых скарабеев. Взнос и призы сбалансированы под снаряжение 2–8 ур.',
    tierColor: 'border-amber-700/60 bg-amber-950/30 text-amber-300'
  },
  {
    id: 'silver',
    name: 'Кубок Нила (Серебро)',
    badge: '🥈 Лига Стражей',
    icon: '🥈',
    entryFeeGold: 60,
    prize1stGold: 150,
    prize1stCrystals: 3,
    prize1stTrophies: 35,
    prize1stXp: 200,
    prize2ndGold: 70,
    prize2ndTrophies: 15,
    prize2ndXp: 90,
    minLvl: 6,
    maxLvl: 13,
    desc: 'Престижный чемпионат опытных бойцов. Главный приз равен стоимости редкой брони 15 ур. в магазине!',
    tierColor: 'border-slate-400/60 bg-slate-900/60 text-slate-200'
  },
  {
    id: 'gold',
    name: 'Кубок Фараона (Золотой Гранд-Турнир)',
    badge: '👑 Королевская Лига',
    icon: '👑',
    entryFeeGold: 120,
    prize1stGold: 300,
    prize1stCrystals: 6,
    prize1stTrophies: 80,
    prize1stXp: 450,
    prize2ndGold: 135,
    prize2ndTrophies: 35,
    prize2ndXp: 180,
    minLvl: 11,
    maxLvl: 25,
    desc: 'Главный турнир Пирамиды! Награда за 1-е место равна стоимости легендарного оружия 20 ур.',
    tierColor: 'border-yellow-400 bg-gradient-to-br from-amber-500/20 via-yellow-950/40 to-amber-900/40 text-yellow-300'
  }
];

export interface TournamentCombatant {
  id: string;
  trainerNick: string;
  isPlayer: boolean;
  name: string;
  avatar: string;
  archetype: TournamentScarabArchetypeKey;
  level: number;
  maxHp: number;
  hp: number;
  strength: number;
  agility: number;
  armor: number;
  critChance: number;
}

export interface BracketMatch {
  id: string;
  round: 'quarters' | 'semis' | 'final';
  roundName: string;
  indexInRound: number;
  c1: TournamentCombatant;
  c2: TournamentCombatant;
  winner: TournamentCombatant | null;
  scoreSummary?: string;
  isCompleted: boolean;
}

export interface TournamentLeaderboardEntry {
  rank?: number;
  trainerNick: string;
  isPlayer?: boolean;
  scarabName: string;
  scarabAvatar: string;
  archetype: TournamentScarabArchetypeKey;
  level: number;
  trophies: number;
  tournamentsWon: number;
  matchesWon: number;
  matchesLost: number;
  totalPrizeGold: number;
  totalPrizeCrystals: number;
  inspectStats: {
    hp: number;
    strength: number;
    agility: number;
    armor: number;
    critChance: number;
  };
}

const DEFAULT_RIVAL_NAMES = [
  'Анубис_Хранитель',
  'Песчаный_Демон',
  'Сехмет_99',
  'Нефритовый_Жук',
  'Осирис_Тень',
  'Гладиатор_Мемфиса',
  'Золотой_Хепри',
  'Караванщик_Али',
  'Владыка_Дюн',
  'Страж_Гробницы',
  'Феникс_Песков',
  'Скарабей_Ра'
];

const DEFAULT_LEADERBOARD_SEEDS: TournamentLeaderboardEntry[] = [
  {
    trainerNick: 'Фараон_Хеопс',
    scarabName: 'Солнечный Хепри',
    scarabAvatar: '👑',
    archetype: 'tank',
    level: 22,
    trophies: 780,
    tournamentsWon: 18,
    matchesWon: 68,
    matchesLost: 9,
    totalPrizeGold: 5200,
    totalPrizeCrystals: 85,
    inspectStats: { hp: 640, strength: 68, agility: 46, armor: 42, critChance: 38 }
  },
  {
    trainerNick: 'Аменхотеп_IV',
    scarabName: 'Ярость Сехмет',
    scarabAvatar: '💥',
    archetype: 'juggernaut',
    level: 19,
    trophies: 610,
    tournamentsWon: 14,
    matchesWon: 54,
    matchesLost: 11,
    totalPrizeGold: 3900,
    totalPrizeCrystals: 62,
    inspectStats: { hp: 520, strength: 82, agility: 42, armor: 30, critChance: 42 }
  },
  {
    trainerNick: 'Нефертити_Страж',
    scarabName: 'Призрак Оазиса',
    scarabAvatar: '⚡',
    archetype: 'assassin',
    level: 17,
    trophies: 490,
    tournamentsWon: 11,
    matchesWon: 46,
    matchesLost: 10,
    totalPrizeGold: 3100,
    totalPrizeCrystals: 48,
    inspectStats: { hp: 460, strength: 70, agility: 58, armor: 26, critChance: 58 }
  },
  {
    trainerNick: 'Имхотеп_Архитектор',
    scarabName: 'Древний Титан',
    scarabAvatar: '🪲',
    archetype: 'tank',
    level: 15,
    trophies: 380,
    tournamentsWon: 9,
    matchesWon: 38,
    matchesLost: 11,
    totalPrizeGold: 2250,
    totalPrizeCrystals: 34,
    inspectStats: { hp: 510, strength: 56, agility: 38, armor: 36, critChance: 30 }
  },
  {
    trainerNick: 'Анубис_Пепел',
    scarabName: 'Тень Загробная',
    scarabAvatar: '🌪️',
    archetype: 'swift',
    level: 13,
    trophies: 290,
    tournamentsWon: 7,
    matchesWon: 31,
    matchesLost: 9,
    totalPrizeGold: 1640,
    totalPrizeCrystals: 24,
    inspectStats: { hp: 410, strength: 54, agility: 64, armor: 24, critChance: 36 }
  },
  {
    trainerNick: 'Рамзес_Победитель',
    scarabName: 'Золотой Клинок',
    scarabAvatar: '🦂',
    archetype: 'juggernaut',
    level: 11,
    trophies: 210,
    tournamentsWon: 5,
    matchesWon: 24,
    matchesLost: 8,
    totalPrizeGold: 1180,
    totalPrizeCrystals: 16,
    inspectStats: { hp: 370, strength: 58, agility: 38, armor: 26, critChance: 32 }
  },
  {
    trainerNick: 'Себек_Крокодил',
    scarabName: 'Болотный Панцирь',
    scarabAvatar: '🪲',
    archetype: 'swift',
    level: 9,
    trophies: 140,
    tournamentsWon: 3,
    matchesWon: 16,
    matchesLost: 7,
    totalPrizeGold: 720,
    totalPrizeCrystals: 9,
    inspectStats: { hp: 330, strength: 46, agility: 48, armor: 22, critChance: 26 }
  }
];

function getCurrentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const ScarabTournamentGameView: React.FC<SubGameCommonProps> = ({
  hero,
  currentUser,
  onGamblingTransaction
}) => {
  const [subTab, setSubTab] = useState<'arena' | 'training' | 'leaderboard'>('arena');
  const trainerKey = currentUser || hero.name || 'player';

  // Global Admin Config for Scarab Tournament (cups, training costs, difficulty, reward schedule)
  const [tournamentConfig, setTournamentConfig] = useState<ScarabTournamentGlobalConfig>(() =>
    getScarabTournamentConfig()
  );
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [seasonRewardNotice, setSeasonRewardNotice] = useState<string | null>(null);

  // Track monthly tournament entries per player
  const getStoredMonthlyEntries = (resetToken: number): number => {
    try {
      const raw = localStorage.getItem(`pyramid_scarab_monthly_entry_${trainerKey}`);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      const monthKey = getCurrentMonthKey();
      if (parsed && parsed.monthKey === monthKey && Number(parsed.resetToken || 1) === Number(resetToken || 1)) {
        return Math.max(0, Number(parsed.count || 0));
      }
    } catch {}
    return 0;
  };

  const [entriesUsedThisMonth, setEntriesUsedThisMonth] = useState<number>(() =>
    getStoredMonthlyEntries(getScarabTournamentConfig().schedule.seasonResetToken || 1)
  );

  // 1. Player's Personal Trained Scarab
  const loadPersonalScarab = (): TrainedScarab => {
    try {
      const saved = localStorage.getItem(`pyramid_my_tournament_scarab_${trainerKey}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {
      id: `scarab_${trainerKey}_${Date.now()}`,
      trainerNick: trainerKey,
      name: `${trainerKey.slice(0, 8)}_Скарабей`,
      avatar: '🪲',
      archetype: 'juggernaut',
      level: 1,
      xp: 0,
      xpToNext: 100,
      hp: 120,
      maxHp: 120,
      strength: 18,
      agility: 15,
      armor: 6,
      critChance: 12,
      trophies: 0,
      tournamentsPlayed: 0,
      tournamentsWon: 0,
      matchesWon: 0,
      matchesLost: 0,
      totalPrizeGold: 0,
      totalPrizeCrystals: 0
    };
  };

  const [scarab, setScarab] = useState<TrainedScarab>(() => loadPersonalScarab());

  // 4. Tournament Leaderboard
  const loadStoredLeaderboard = (): TournamentLeaderboardEntry[] => {
    try {
      const raw = localStorage.getItem('pyramid_scarab_tournament_leaderboard_v3');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_LEADERBOARD_SEEDS;
  };

  const [leaderboard, setLeaderboard] = useState<TournamentLeaderboardEntry[]>(() => loadStoredLeaderboard());

  useEffect(() => {
    void syncScarabTournamentConfigFromSupabase().then((updated) => {
      if (updated) {
        const freshCfg = getScarabTournamentConfig();
        setTournamentConfig(freshCfg);
        setEntriesUsedThisMonth(getStoredMonthlyEntries(freshCfg.schedule.seasonResetToken || 1));
      }
    });
    const onCfgUpdate = () => {
      const freshCfg = getScarabTournamentConfig();
      setTournamentConfig(freshCfg);
      setEntriesUsedThisMonth(getStoredMonthlyEntries(freshCfg.schedule.seasonResetToken || 1));
    };
    const onDataUpdate = () => {
      setScarab(loadPersonalScarab());
      setLeaderboard(loadStoredLeaderboard());
      const freshCfg = getScarabTournamentConfig();
      setEntriesUsedThisMonth(getStoredMonthlyEntries(freshCfg.schedule.seasonResetToken || 1));
    };
    window.addEventListener('scarab-tournament-config-updated', onCfgUpdate);
    window.addEventListener('scarab-tournament-data-updated', onDataUpdate);
    return () => {
      window.removeEventListener('scarab-tournament-config-updated', onCfgUpdate);
      window.removeEventListener('scarab-tournament-data-updated', onDataUpdate);
    };
  }, [trainerKey]);

  // Save personal scarab changes
  useEffect(() => {
    try {
      localStorage.setItem(`pyramid_my_tournament_scarab_${trainerKey}`, JSON.stringify(scarab));
    } catch {}
  }, [scarab, trainerKey]);

  // Rename & UI state
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(scarab.name);

  // 2. Active Tournament State
  const [selectedCupId, setSelectedCupId] = useState<'bronze' | 'silver' | 'gold'>('bronze');
  const [activeTournament, setActiveTournament] = useState<{
    cup: ScarabCupAdminConfig;
    round: 'quarters' | 'semis' | 'final';
    matches: BracketMatch[];
    activeMatchIndex: number;
    isFinished: boolean;
    isWon: boolean;
    placedRank?: 1 | 2 | 3 | 8;
    prizeClaimed: boolean;
  } | null>(null);

  // 3. Combat Match State
  const [isFightingMatch, setIsFightingMatch] = useState(false);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [liveP1Hp, setLiveP1Hp] = useState<number>(scarab.hp);
  const [liveP2Hp, setLiveP2Hp] = useState<number>(scarab.hp);
  const [inspectedEntry, setInspectedEntry] = useState<TournamentLeaderboardEntry | null>(null);

  // Sync player into leaderboard
  useEffect(() => {
    setLeaderboard((prev) => {
      const filtered = prev.filter((e) => e.trainerNick.toLowerCase() !== trainerKey.toLowerCase());
      const playerEntry: TournamentLeaderboardEntry = {
        trainerNick: trainerKey,
        isPlayer: true,
        scarabName: scarab.name,
        scarabAvatar: scarab.avatar,
        archetype: scarab.archetype,
        level: scarab.level,
        trophies: scarab.trophies,
        tournamentsWon: scarab.tournamentsWon,
        matchesWon: scarab.matchesWon,
        matchesLost: scarab.matchesLost,
        totalPrizeGold: scarab.totalPrizeGold,
        totalPrizeCrystals: scarab.totalPrizeCrystals,
        inspectStats: {
          hp: scarab.maxHp,
          strength: scarab.strength,
          agility: scarab.agility,
          armor: scarab.armor,
          critChance: scarab.critChance
        }
      };
      const merged = [...filtered, playerEntry].sort((a, b) => b.trophies - a.trophies);
      try {
        localStorage.setItem('pyramid_scarab_tournament_leaderboard_v3', JSON.stringify(merged));
      } catch {}
      return merged;
    });
  }, [scarab, trainerKey]);

  // Live 1s timer for Seasonal Leaderboard Reward Distribution
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to format remaining seconds to DDд HH:MM:SS or HH:MM:SS
  const formatRewardCountdown = (targetMs: number) => {
    const diffSec = Math.max(0, Math.floor((targetMs - nowTs) / 1000));
    const days = Math.floor(diffSec / 86400);
    const hrs = Math.floor((diffSec % 86400) / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;
    if (days > 0) {
      return `${days}д ${String(hrs).padStart(2, '0')}ч ${String(mins).padStart(2, '0')}м ${String(secs).padStart(2, '0')}с`;
    }
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Claim / trigger seasonal reward if timer reached 0 and player is in Top-3
  const handleClaimSeasonRewardIfReady = () => {
    const sched = tournamentConfig.schedule;
    const playerRank = leaderboard.findIndex((e) => e.isPlayer) + 1;
    let wonG = 0;
    let wonC = 0;
    if (playerRank === 1) {
      wonG = sched.top1Gold ?? 250;
      wonC = sched.top1Crystals ?? 7;
    } else if (playerRank === 2) {
      wonG = sched.top2Gold ?? 150;
      wonC = sched.top2Crystals ?? 4;
    } else if (playerRank === 3) {
      wonG = sched.top3Gold ?? 80;
      wonC = sched.top3Crystals ?? 2;
    }

    const nextCycleMs = Date.now() + Math.max(1, sched.rewardIntervalMinutes) * 60 * 1000;
    const nextResetToken = (sched.seasonResetToken || 1) + 1;
    const nextCfg: ScarabTournamentGlobalConfig = {
      ...tournamentConfig,
      schedule: {
        ...sched,
        seasonNumber: (sched.seasonNumber || 1) + 1,
        seasonResetToken: nextResetToken,
        nextRewardDistributionAt: nextCycleMs
      }
    };
    saveScarabTournamentConfigLocal(nextCfg);
    setTournamentConfig(nextCfg);
    setEntriesUsedThisMonth(0);

    if (wonG > 0 || wonC > 0) {
      playCoinSound();
      playLevelUpSound();
      onGamblingTransaction({
        gameName: `Награда Ежемесячного Сезона Турнира Скарабеев (#${playerRank} место)`,
        wonGold: wonG,
        wonCrystals: wonC,
        countGame: false
      });
      setSeasonRewardNotice(
        `🎉 Вы получили ежемесячную награду сезона за #${playerRank} место в рейтинге: +${wonG.toLocaleString()} 🪙 и +${wonC} 💎! Открыт новый сезон!`
      );
    } else {
      setSeasonRewardNotice(
        `⏱️ Ежемесячные награды Топ-3 распределены и открыт новый сезон! Поднимитесь в Топ-3 по кубкам (ваш ранг #${playerRank}), чтобы получить призы.`
      );
    }
  };

  // Helper: create combatant from personal scarab
  function buildPlayerCombatant(sc: TrainedScarab): TournamentCombatant {
    const extraHp = sc.archetype === 'tank' ? 35 : 0;
    const extraStr = sc.archetype === 'juggernaut' ? 7 : 0;
    const extraAgi = sc.archetype === 'swift' ? 12 : 0;
    const extraArmor = sc.archetype === 'tank' ? 6 : 0;
    const extraCrit = sc.archetype === 'assassin' ? 14 : 0;

    return {
      id: 'player_combatant',
      trainerNick: sc.trainerNick,
      isPlayer: true,
      name: sc.name,
      avatar: sc.avatar,
      archetype: sc.archetype,
      level: sc.level,
      maxHp: sc.maxHp + extraHp,
      hp: sc.maxHp + extraHp,
      strength: sc.strength + extraStr,
      agility: sc.agility + extraAgi,
      armor: sc.armor + extraArmor,
      critChance: sc.critChance + extraCrit
    };
  }

  // Helper: generate much stronger rival combatant for a cup (controlled by tournamentConfig.difficulty)
  function generateRivalCombatant(cup: ScarabCupAdminConfig, idx: number): TournamentCombatant {
    const diff = tournamentConfig.difficulty || {
      globalStatMultiplier: 1.55,
      minPlayerStatRatio: 1.2,
      bonusLevelOffset: 3,
      semiFinalBuffMult: 1.28,
      finalBossBuffMult: 1.45,
      rivalExtraCritPct: 12,
      rivalExtraDodgePct: 10,
      rivalDamageReductionPct: 15,
      enableBossRageSkill: true,
      enableCounterAttackSkill: true
    };

    const archKeys: TournamentScarabArchetypeKey[] = ['juggernaut', 'swift', 'tank', 'assassin'];
    const chosenArch = archKeys[Math.floor(Math.random() * archKeys.length)];
    const rivalNick = DEFAULT_RIVAL_NAMES[idx % DEFAULT_RIVAL_NAMES.length];
    const cupRollLvl = Math.floor(Math.random() * (cup.maxLvl - cup.minLvl + 1)) + cup.minLvl;
    const scaledPlayerLvl = Math.max(
      cup.minLvl,
      Math.round(scarab.level * 1.25) + diff.bonusLevelOffset + Math.floor(Math.random() * 4)
    );
    const lvl = Math.min(cup.maxLvl + 10, Math.max(cupRollLvl, scaledPlayerLvl));

    const playerPowerFactor = Math.max(1, (scarab.strength + scarab.agility + scarab.armor) / 36);
    const cupTierMul = cup.id === 'gold' ? 1.55 : cup.id === 'silver' ? 1.32 : 1.15;
    const totalMul = cupTierMul * Math.max(0.5, diff.globalStatMultiplier || 1.55);
    const minRatio = Math.max(0.5, diff.minPlayerStatRatio || 1.2);

    const rawHp = (165 + lvl * 34 + (chosenArch === 'tank' ? 85 : 25)) * totalMul;
    const rawStr = (26 + lvl * 5.6 + (chosenArch === 'juggernaut' ? 14 : 5)) * totalMul;
    const rawAgi = (20 + lvl * 4.2 + (chosenArch === 'swift' ? 18 : 5) + (diff.rivalExtraDodgePct || 0)) * totalMul;
    const rawArm = (10 + Math.floor(lvl * 3.1) + (chosenArch === 'tank' ? 12 : 4)) * totalMul;

    const baseHp = Math.round(
      Math.max(
        rawHp,
        scarab.maxHp * (minRatio + Math.random() * 0.32) * (cup.id === 'gold' ? 1.28 : cup.id === 'silver' ? 1.15 : 1.05)
      )
    );
    const baseStr = Math.round(
      Math.max(
        rawStr,
        scarab.strength *
          (minRatio - 0.04 + Math.random() * 0.3) *
          Math.min(1.5, playerPowerFactor * 0.4 + 0.85)
      )
    );
    const baseAgi = Math.round(
      Math.max(rawAgi, scarab.agility * (minRatio - 0.08 + Math.random() * 0.28) + (diff.rivalExtraDodgePct || 0))
    );
    const baseArm = Math.round(
      Math.max(rawArm, scarab.armor * (minRatio - 0.05 + Math.random() * 0.28))
    );
    const baseCrit = Math.min(
      78,
      Math.round(
        18 +
          lvl * 2.8 +
          (chosenArch === 'assassin' ? 18 : 6) +
          (diff.rivalExtraCritPct || 12)
      )
    );

    const icons = ['🪲', '🦂', '🪳', '⚡', '💥', '🌪️'];

    return {
      id: `rival_${idx}_${Date.now()}`,
      trainerNick: rivalNick,
      isPlayer: false,
      name: `Титан ${rivalNick.slice(0, 7)}`,
      avatar: icons[idx % icons.length],
      archetype: chosenArch,
      level: lvl,
      maxHp: baseHp,
      hp: baseHp,
      strength: baseStr,
      agility: baseAgi,
      armor: baseArm,
      critChance: baseCrit
    };
  }

  // Award XP and handle level up (2x stronger level-up stat gains!)
  function awardScarabXp(amount: number) {
    const maxCritAllowed = tournamentConfig.training.maxCritChance || 70;
    setScarab((prev) => {
      let newXp = prev.xp + amount;
      let newLvl = prev.level;
      let newXpToNext = prev.xpToNext;
      let newMaxHp = prev.maxHp;
      let newStr = prev.strength;
      let newAgi = prev.agility;
      let newArm = prev.armor;
      let newCrit = prev.critChance;

      let leveledUp = false;
      while (newXp >= newXpToNext) {
        newXp -= newXpToNext;
        newLvl += 1;
        newXpToNext = Math.floor(newXpToNext * 1.35) + 30;
        newMaxHp += 40;
        newStr += 4;
        newAgi += 2;
        newArm += 2;
        newCrit = Math.min(maxCritAllowed, newCrit + 2);
        leveledUp = true;
      }

      if (leveledUp) {
        playLevelUpSound();
      }

      return {
        ...prev,
        level: newLvl,
        xp: newXp,
        xpToNext: newXpToNext,
        maxHp: newMaxHp,
        hp: newMaxHp,
        strength: newStr,
        agility: newAgi,
        armor: newArm,
        critChance: newCrit
      };
    });
  }

  // --- TRAINING ACTIONS (Dynamic from Admin Config, balanced with monster & shop economy) ---
  const trCfg = tournamentConfig.training;
  const costStrength = Math.round((trCfg.strBaseGold ?? 10) + scarab.strength * (trCfg.strStepGold ?? 1));
  const costAgility = Math.round((trCfg.agiBaseGold ?? 10) + scarab.agility * (trCfg.agiStepGold ?? 1));
  const costArmor = Math.round((trCfg.armorBaseGold ?? 14) + scarab.armor * (trCfg.armorStepGold ?? 2));
  const costCritCrystals = Math.max(1, trCfg.critCostCrystals ?? 1);
  const costXpElixir = Math.max(1, trCfg.xpElixirCostGold ?? 35);

  const handleTrainStrength = () => {
    if (hero.gold < costStrength) return;
    playCoinSound();
    onGamblingTransaction({
      gameName: 'Тренировка Скарабея (Сила)',
      spentGold: costStrength,
      countGame: false
    });
    setScarab((prev) => ({
      ...prev,
      strength: prev.strength + Math.max(1, trCfg.strGain),
      hp: prev.maxHp
    }));
  };

  const handleTrainAgility = () => {
    if (hero.gold < costAgility) return;
    playCoinSound();
    onGamblingTransaction({
      gameName: 'Тренировка Скарабея (Ловкость)',
      spentGold: costAgility,
      countGame: false
    });
    setScarab((prev) => ({
      ...prev,
      agility: prev.agility + Math.max(1, trCfg.agiGain),
      hp: prev.maxHp
    }));
  };

  const handleTrainArmor = () => {
    if (hero.gold < costArmor) return;
    playCoinSound();
    onGamblingTransaction({
      gameName: 'Тренировка Скарабея (Панцирь)',
      spentGold: costArmor,
      countGame: false
    });
    setScarab((prev) => ({
      ...prev,
      maxHp: prev.maxHp + Math.max(1, trCfg.hpGain),
      hp: prev.maxHp + Math.max(1, trCfg.hpGain),
      armor: prev.armor + Math.max(1, trCfg.armorGain)
    }));
  };

  const handleTrainCrit = () => {
    if (hero.crystals < costCritCrystals) return;
    playCoinSound();
    onGamblingTransaction({
      gameName: 'Тренировка Скарабея (Крит 2x)',
      spentCrystals: costCritCrystals,
      countGame: false
    });
    setScarab((prev) => ({
      ...prev,
      critChance: Math.min(trCfg.maxCritChance || 65, prev.critChance + Math.max(1, trCfg.critGain)),
      hp: prev.maxHp
    }));
  };

  const handleBuyXpElixir = () => {
    if (hero.gold < costXpElixir) return;
    playLootSound();
    onGamblingTransaction({
      gameName: 'Тренировка Скарабея (Эликсир Опыта)',
      spentGold: costXpElixir,
      countGame: false
    });
    awardScarabXp(Math.max(10, trCfg.xpElixirGain));
  };

  // --- START TOURNAMENT (Enforces Monthly Entry Limit if maxEntriesPerSeason > 0) ---
  const activeCupsList = tournamentConfig.cups?.length ? tournamentConfig.cups : TOURNAMENT_CUPS as any as ScarabCupAdminConfig[];
  const maxEntriesAllowed = Number(tournamentConfig.schedule.maxEntriesPerSeason ?? 1);
  const hasMonthlyLimitReached = maxEntriesAllowed > 0 && entriesUsedThisMonth >= maxEntriesAllowed;
  const isAdminUser = Boolean(hero.role === 'admin' || Number((hero as any).is_admin) === 1);

  const handleResetMyMonthlyEntryLimit = () => {
    const monthKey = getCurrentMonthKey();
    const token = tournamentConfig.schedule.seasonResetToken || 1;
    try {
      localStorage.setItem(
        `pyramid_scarab_monthly_entry_${trainerKey}`,
        JSON.stringify({ monthKey, resetToken: token, count: 0 })
      );
    } catch {}
    setEntriesUsedThisMonth(0);
    setSeasonRewardNotice('✅ Лимит выступлений в этом месяце сброшен! Вы снова можете вступить в Турнир Скарабеев.');
  };

  const handleStartTournament = (overrideCupId?: 'bronze' | 'silver' | 'gold') => {
    const targetId = overrideCupId || selectedCupId;
    const cup = activeCupsList.find((c) => c.id === targetId) || activeCupsList[0];
    if (!cup || hero.gold < cup.entryFeeGold) return;
    if (hasMonthlyLimitReached) {
      setSeasonRewardNotice(
        `⏳ Турнир Скарабеев проводится раз в месяц! Вы уже использовали свои попытки (${entriesUsedThisMonth}/${maxEntriesAllowed}) в текущем месячном сезоне.`
      );
      return;
    }

    const nextCount = entriesUsedThisMonth + 1;
    const monthKey = getCurrentMonthKey();
    const token = tournamentConfig.schedule.seasonResetToken || 1;
    try {
      localStorage.setItem(
        `pyramid_scarab_monthly_entry_${trainerKey}`,
        JSON.stringify({ monthKey, resetToken: token, count: nextCount })
      );
    } catch {}
    setEntriesUsedThisMonth(nextCount);

    playCoinSound();
    onGamblingTransaction({
      gameName: `Ежемесячный Турнир Скарабеев (${cup.name})`,
      spentGold: cup.entryFeeGold,
      countGame: true
    });

    const pCombatant = buildPlayerCombatant(scarab);
    const rivals: TournamentCombatant[] = [];
    for (let i = 0; i < 7; i++) {
      rivals.push(generateRivalCombatant(cup, i));
    }

    // 4 Quarterfinal matches
    const quarters: BracketMatch[] = [
      {
        id: 'q_0',
        round: 'quarters',
        roundName: '1/4 финала (Матч #1)',
        indexInRound: 0,
        c1: pCombatant,
        c2: rivals[0],
        winner: null,
        isCompleted: false
      },
      {
        id: 'q_1',
        round: 'quarters',
        roundName: '1/4 финала (Матч #2)',
        indexInRound: 1,
        c1: rivals[1],
        c2: rivals[2],
        winner: null,
        isCompleted: false
      },
      {
        id: 'q_2',
        round: 'quarters',
        roundName: '1/4 финала (Матч #3)',
        indexInRound: 2,
        c1: rivals[3],
        c2: rivals[4],
        winner: null,
        isCompleted: false
      },
      {
        id: 'q_3',
        round: 'quarters',
        roundName: '1/4 финала (Матч #4)',
        indexInRound: 3,
        c1: rivals[5],
        c2: rivals[6],
        winner: null,
        isCompleted: false
      }
    ];

    setActiveTournament({
      cup,
      round: 'quarters',
      matches: quarters,
      activeMatchIndex: 0,
      isFinished: false,
      isWon: false,
      prizeClaimed: false
    });

    setScarab((prev) => ({
      ...prev,
      tournamentsPlayed: prev.tournamentsPlayed + 1
    }));

    setSubTab('arena');
    setCombatLog([
      `🏆 Ежемесячный Турнир начался! Выставлен скарабей: ${scarab.name} (${SCARAB_ARCHETYPES[scarab.archetype].label}) против усиленных Титанов Пирамиды!`
    ]);
  };

  // Helper: simulate single combat between two combatants (with stronger AI boss mechanics)
  function runCombatSimulation(c1: TournamentCombatant, c2: TournamentCombatant): {
    winner: TournamentCombatant;
    loser: TournamentCombatant;
    log: string[];
  } {
    const diff = tournamentConfig.difficulty || {
      globalStatMultiplier: 1.55,
      minPlayerStatRatio: 1.2,
      bonusLevelOffset: 3,
      semiFinalBuffMult: 1.28,
      finalBossBuffMult: 1.45,
      rivalExtraCritPct: 12,
      rivalExtraDodgePct: 10,
      rivalDamageReductionPct: 15,
      enableBossRageSkill: true,
      enableCounterAttackSkill: true
    };

    let hp1 = c1.maxHp;
    let hp2 = c2.maxHp;
    const log: string[] = [];
    log.push(`⚔️ Начало поединка: ${c1.avatar} ${c1.name} (HP: ${hp1}) vs ${c2.avatar} ${c2.name} (HP: ${hp2})`);

    let turn = c1.agility >= c2.agility ? 1 : 2;

    for (let round = 1; round <= 35; round++) {
      if (hp1 <= 0 || hp2 <= 0) break;

      const attacker = turn === 1 ? c1 : c2;
      const defender = turn === 1 ? c2 : c1;

      // Evasion check based on agility (AI rivals get stronger evasion cap up to 62%)
      const maxDodgeCap = defender.isPlayer ? 52 : 62;
      const evasionChance = Math.min(maxDodgeCap, defender.agility * 1.45);
      const isEvaded = Math.random() * 100 < evasionChance;

      if (isEvaded) {
        log.push(`💨 ${defender.name} молниеносно уклонился от удара ${attacker.name}!`);
        // Swift or AI Rival counter attack
        const canCounter =
          defender.archetype === 'swift' ||
          (!defender.isPlayer && diff.enableCounterAttackSkill !== false);
        if (canCounter && Math.random() < (defender.isPlayer ? 0.45 : 0.58)) {
          const counterDmg = Math.max(5, Math.round(defender.strength * (defender.isPlayer ? 0.65 : 0.8)));
          if (turn === 1) hp1 = Math.max(0, hp1 - counterDmg);
          else hp2 = Math.max(0, hp2 - counterDmg);
          log.push(`⚡ [Контрудар Титана] ${defender.name} мгновенно контратакует на ${counterDmg} урона!`);
        }
      } else {
        // Crit roll (2x dmg)
        const isCrit = Math.random() * 100 < attacker.critChance;
        let baseDmg = Math.max(4, attacker.strength + Math.floor(Math.random() * 7 - 2) - Math.round(defender.armor * 0.85));

        // Low HP fury (<45% HP for AI Bosses if enabled, <35% for player)
        const currentHp = turn === 1 ? hp1 : hp2;
        const maxHp = attacker.maxHp;
        const rageThreshold = !attacker.isPlayer && diff.enableBossRageSkill !== false ? 0.45 : 0.35;
        if (currentHp / maxHp < rageThreshold) {
          const rageBonus = !attacker.isPlayer && diff.enableBossRageSkill !== false
            ? Math.max(12, Math.round(baseDmg * 0.3))
            : 8;
          baseDmg += rageBonus;
          log.push(`🔥 [Ярость Древнего Скарабея] ${attacker.name} впадает в бешенство (+${rageBonus} к урону)!`);
        }

        // AI Rival Armor Shield damage reduction
        if (!defender.isPlayer && (diff.rivalDamageReductionPct || 0) > 0) {
          const redPct = Math.min(60, Math.max(0, diff.rivalDamageReductionPct));
          baseDmg = Math.max(3, Math.round(baseDmg * (1 - redPct / 100)));
        }

        const finalDmg = isCrit ? baseDmg * 2 : baseDmg;

        if (turn === 1) {
          hp2 = Math.max(0, hp2 - finalDmg);
        } else {
          hp1 = Math.max(0, hp1 - finalDmg);
        }

        log.push(
          `${attacker.avatar} ${attacker.name} наносит ${finalDmg} урона ${defender.name}${
            isCrit ? ' (💥 КРИТ 2x УРОН!)' : ''
          } [Осталось HP: ${turn === 1 ? hp2 : hp1}]`
        );

        // Tank / Rival thorn reflect
        const canReflect =
          defender.archetype === 'tank' ||
          (!defender.isPlayer && diff.enableCounterAttackSkill !== false && Math.random() < 0.35);
        if (canReflect && Math.random() < (defender.isPlayer ? 0.4 : 0.52)) {
          const reflectDmg = Math.max(3, Math.round(finalDmg * (defender.isPlayer ? 0.22 : 0.28)));
          if (turn === 1) hp1 = Math.max(0, hp1 - reflectDmg);
          else hp2 = Math.max(0, hp2 - reflectDmg);
          log.push(`🛡️ [Шипы Панциря] ${defender.name} отражает ${reflectDmg} урона обратно!`);
        }
      }

      turn = turn === 1 ? 2 : 1;
    }

    const winner = hp1 > 0 ? c1 : c2;
    const loser = hp1 > 0 ? c2 : c1;
    log.push(`🏁 Победу одержал: ${winner.avatar} ${winner.name}!`);

    return { winner, loser, log };
  }

  // --- PLAY ACTIVE MATCH ---
  const handlePlayCurrentMatch = (instant: boolean = false) => {
    if (!activeTournament || isFightingMatch) return;

    const currentMatch = activeTournament.matches[activeTournament.activeMatchIndex];
    if (!currentMatch || currentMatch.isCompleted) return;

    setIsFightingMatch(true);
    setLiveP1Hp(currentMatch.c1.maxHp);
    setLiveP2Hp(currentMatch.c2.maxHp);
    playAttackSound();

    const sim = runCombatSimulation(currentMatch.c1, currentMatch.c2);
    const playerWon = sim.winner.isPlayer;
    const stepDelay = Math.max(80, Number(tournamentConfig.schedule.matchStepDelayMs || 350));

    if (instant) {
      finishMatchResolution(sim.winner, sim.log, playerWon);
    } else {
      // Step-by-step log animation
      let step = 0;
      setCombatLog([sim.log[0]]);
      const interval = setInterval(() => {
        step++;
        if (step < sim.log.length) {
          setCombatLog((prev) => [sim.log[step], ...prev]);
          playClickSound();
        } else {
          clearInterval(interval);
          finishMatchResolution(sim.winner, sim.log, playerWon);
        }
      }, stepDelay);
    }
  };

  function finishMatchResolution(winner: TournamentCombatant, fullLog: string[], playerWon: boolean) {
    setIsFightingMatch(false);
    setCombatLog(fullLog);
    const payoutDelayMs = Math.max(0, Number(tournamentConfig.schedule.payoutDelaySeconds || 0)) * 1000;

    if (playerWon) {
      playLevelUpSound();
      awardScarabXp(40);
      setScarab((prev) => ({
        ...prev,
        matchesWon: prev.matchesWon + 1
      }));
    } else {
      setScarab((prev) => ({
        ...prev,
        matchesLost: prev.matchesLost + 1
      }));
    }

    setActiveTournament((prev) => {
      if (!prev) return null;
      const updatedMatches = [...prev.matches];
      updatedMatches[prev.activeMatchIndex] = {
        ...updatedMatches[prev.activeMatchIndex],
        winner,
        isCompleted: true
      };

      // If player lost
      if (!playerWon) {
        if (prev.round === 'final') {
          playCoinSound();
          const prizeGold = prev.cup.prize2ndGold;
          const prizeCrystals = Number(prev.cup.prize2ndCrystals || 0);
          const trophies = prev.cup.prize2ndTrophies;
          const xp = prev.cup.prize2ndXp;
          setScarab((sc) => ({
            ...sc,
            trophies: sc.trophies + trophies,
            totalPrizeGold: sc.totalPrizeGold + prizeGold,
            totalPrizeCrystals: sc.totalPrizeCrystals + prizeCrystals
          }));
          setTimeout(() => {
            awardScarabXp(xp);
            onGamblingTransaction({
              gameName: `🥈 2-е место в турнире (${prev.cup.name})`,
              wonGold: prizeGold,
              wonCrystals: prizeCrystals > 0 ? prizeCrystals : undefined,
              countGame: false
            });
          }, payoutDelayMs);
          return {
            ...prev,
            matches: updatedMatches,
            isFinished: true,
            isWon: false,
            placedRank: 2
          };
        }

        if (prev.round === 'semis') {
          const p3Gold = Number(prev.cup.prize3rdGold || 0);
          const p3Crystals = Number(prev.cup.prize3rdCrystals || 0);
          const p3Trophies = Number(prev.cup.prize3rdTrophies || 0);
          const p3Xp = Number(prev.cup.prize3rdXp || 0);
          if (p3Gold > 0 || p3Crystals > 0 || p3Trophies > 0) {
            playCoinSound();
            setScarab((sc) => ({
              ...sc,
              trophies: sc.trophies + p3Trophies,
              totalPrizeGold: sc.totalPrizeGold + p3Gold,
              totalPrizeCrystals: sc.totalPrizeCrystals + p3Crystals
            }));
            setTimeout(() => {
              if (p3Xp > 0) awardScarabXp(p3Xp);
              onGamblingTransaction({
                gameName: `🥉 3-е место (Полуфинал ${prev.cup.name})`,
                wonGold: p3Gold > 0 ? p3Gold : undefined,
                wonCrystals: p3Crystals > 0 ? p3Crystals : undefined,
                countGame: false
              });
            }, payoutDelayMs);
          }
          return {
            ...prev,
            matches: updatedMatches,
            isFinished: true,
            isWon: false,
            placedRank: 3
          };
        }

        return {
          ...prev,
          matches: updatedMatches,
          isFinished: true,
          isWon: false,
          placedRank: 8
        };
      }

      // If player won in Grand Final: CHAMPION!
      if (prev.round === 'final') {
        playLevelUpSound();
        playCoinSound();
        const p1Gold = prev.cup.prize1stGold;
        const p1Crystals = prev.cup.prize1stCrystals;
        const trophies = prev.cup.prize1stTrophies;
        const xp = prev.cup.prize1stXp;

        setScarab((sc) => ({
          ...sc,
          tournamentsWon: sc.tournamentsWon + 1,
          trophies: sc.trophies + trophies,
          totalPrizeGold: sc.totalPrizeGold + p1Gold,
          totalPrizeCrystals: sc.totalPrizeCrystals + p1Crystals
        }));
        setTimeout(() => {
          awardScarabXp(xp);
          onGamblingTransaction({
            gameName: `🥇 Чемпион Турнира Скарабеев (${prev.cup.name})`,
            wonGold: p1Gold,
            wonCrystals: p1Crystals,
            countGame: true
          });
        }, payoutDelayMs);

        return {
          ...prev,
          matches: updatedMatches,
          isFinished: true,
          isWon: true,
          placedRank: 1
        };
      }

      // Otherwise, simulate other non-player matches in this round and advance to next round (buffing AI semifinalists & finalists)!
      const semiMul = Number(tournamentConfig.difficulty?.semiFinalBuffMult || 1.28);
      const finalMul = Number(tournamentConfig.difficulty?.finalBossBuffMult || 1.45);

      const buffAiCombatant = (comb: TournamentCombatant, mul: number, bonusLvl: number): TournamentCombatant => {
        if (comb.isPlayer) return comb;
        const nextHp = Math.round(comb.maxHp * mul);
        return {
          ...comb,
          level: comb.level + bonusLvl,
          maxHp: nextHp,
          hp: nextHp,
          strength: Math.round(comb.strength * mul),
          agility: Math.round(comb.agility * mul),
          armor: Math.round(comb.armor * mul),
          critChance: Math.min(78, comb.critChance + bonusLvl * 4)
        };
      };

      if (prev.round === 'quarters') {
        const roundWinners: TournamentCombatant[] = [winner];
        for (let i = 1; i < 4; i++) {
          const simOther = runCombatSimulation(updatedMatches[i].c1, updatedMatches[i].c2);
          updatedMatches[i].winner = simOther.winner;
          updatedMatches[i].isCompleted = true;
          roundWinners.push(buffAiCombatant(simOther.winner, semiMul, 2));
        }

        const semiMatches: BracketMatch[] = [
          {
            id: 's_0',
            round: 'semis',
            roundName: 'Полуфинал (Матч #1)',
            indexInRound: 0,
            c1: roundWinners[0],
            c2: roundWinners[1],
            winner: null,
            isCompleted: false
          },
          {
            id: 's_1',
            round: 'semis',
            roundName: 'Полуфинал (Матч #2)',
            indexInRound: 1,
            c1: roundWinners[2],
            c2: roundWinners[3],
            winner: null,
            isCompleted: false
          }
        ];

        return {
          ...prev,
          round: 'semis',
          matches: semiMatches,
          activeMatchIndex: 0
        };
      }

      if (prev.round === 'semis') {
        const otherSemi = runCombatSimulation(updatedMatches[1].c1, updatedMatches[1].c2);
        updatedMatches[1].winner = otherSemi.winner;
        updatedMatches[1].isCompleted = true;

        const finalMatch: BracketMatch[] = [
          {
            id: 'f_0',
            round: 'final',
            roundName: '👑 Гранд-Финал за Кубок!',
            indexInRound: 0,
            c1: winner,
            c2: buffAiCombatant(otherSemi.winner, finalMul, 3),
            winner: null,
            isCompleted: false
          }
        ];

        return {
          ...prev,
          round: 'final',
          matches: finalMatch,
          activeMatchIndex: 0
        };
      }

      return prev;
    });
  }

  const handleResetTournament = () => {
    setActiveTournament(null);
    setCombatLog([]);
  };

  const handleSaveName = () => {
    if (nameInput.trim().length > 0) {
      setScarab((prev) => ({ ...prev, name: nameInput.trim() }));
    }
    setIsRenaming(false);
  };

  const isSeasonRewardReady = nowTs >= tournamentConfig.schedule.nextRewardDistributionAt;

  return (
    <div className="space-y-3 pb-4">
      {/* Top Tournament Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-base sm:text-lg">🏆</span>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-xs sm:text-sm font-black text-amber-300">
                {tournamentConfig.schedule.seasonTitle || 'Ежемесячный Турнир Скарабеев'}
              </h3>
              <span className="rounded bg-amber-500/20 border border-amber-400/50 px-1.5 py-0.2 text-[8.5px] font-black text-amber-200">
                📅 Раз в месяц (Сезон #{tournamentConfig.schedule.seasonNumber || 1})
              </span>
              <span className="rounded bg-rose-950/90 border border-rose-500/50 px-1.5 py-0.2 text-[8.5px] font-black text-rose-300">
                🔥 Сила соперников: x{(tournamentConfig.difficulty?.globalStatMultiplier || 1.55).toFixed(2)}
              </span>
            </div>
            <p className="text-[9px] text-slate-400">
              Ежемесячный чемпионат (раз в {tournamentConfig.schedule.seasonCycleDays || 30} дн.) • Усиленные соперники-титаны и призовой фонд!
            </p>
          </div>
        </div>

        {/* Sub-Tabs Switcher */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 p-0.5 rounded-lg text-[9px] font-bold">
          <button
            type="button"
            onClick={() => setSubTab('arena')}
            className={`px-2 py-1 rounded transition-colors cursor-pointer ${
              subTab === 'arena'
                ? 'bg-amber-500 text-slate-950 font-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚔️ Турнир
          </button>
          <button
            type="button"
            onClick={() => setSubTab('training')}
            className={`px-2 py-1 rounded transition-colors cursor-pointer ${
              subTab === 'training'
                ? 'bg-amber-500 text-slate-950 font-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🏋️ Мой боец (Lv.{scarab.level})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('leaderboard')}
            className={`px-2 py-1 rounded transition-colors cursor-pointer ${
              subTab === 'leaderboard'
                ? 'bg-amber-500 text-slate-950 font-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🏆 Рейтинг (Топ)
          </button>
        </div>
      </div>

      {/* Compact Monthly Seasonal Reward Distribution Countdown Bar */}
      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[9px]">
        <div className="flex flex-wrap items-center gap-2 text-slate-300">
          <span className="font-black text-amber-300">📅 Финал месяца и выдача наград (Топ-3):</span>
          <span className="rounded bg-slate-950/80 border border-slate-800 px-1.5 py-0.5 font-mono font-black text-emerald-300">
            {isSeasonRewardReady
              ? '🎁 ГОТОВО К ВЫДАЧЕ!'
              : `Через ${formatRewardCountdown(tournamentConfig.schedule.nextRewardDistributionAt)}`}
          </span>
          <span className="rounded bg-slate-950/90 border border-cyan-500/40 px-1.5 py-0.5 font-black text-cyan-300">
            {maxEntriesAllowed > 0
              ? `🎟️ Выступлений в этом месяце: ${entriesUsedThisMonth} / ${maxEntriesAllowed}`
              : '🎟️ Выступления: Без лимита'}
          </span>
          <span className="text-[8.5px] text-slate-400">
            (🥇 {(tournamentConfig.schedule.top1Gold ?? 250).toLocaleString()}🪙+{tournamentConfig.schedule.top1Crystals ?? 7}💎 • 🥈 {(tournamentConfig.schedule.top2Gold ?? 150).toLocaleString()}🪙+{tournamentConfig.schedule.top2Crystals ?? 4}💎 • 🥉 {(tournamentConfig.schedule.top3Gold ?? 80).toLocaleString()}🪙+{tournamentConfig.schedule.top3Crystals ?? 2}💎)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasMonthlyLimitReached && isAdminUser && (
            <button
              type="button"
              onClick={handleResetMyMonthlyEntryLimit}
              className="rounded-lg border border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 px-2 py-1 text-[8.5px] font-black text-cyan-200 cursor-pointer"
              title="Админ-кнопка: сбросить месячный лимит участий"
            >
              🔄 Сбросить лимит месяца (Админ)
            </button>
          )}
          {isSeasonRewardReady && (
            <button
              type="button"
              onClick={handleClaimSeasonRewardIfReady}
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-amber-400 px-2.5 py-1 text-[9px] font-black text-slate-950 shadow cursor-pointer"
            >
              🎁 Получить награду месяца
            </button>
          )}
        </div>
      </div>

      {seasonRewardNotice && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-2.5 py-1.5 text-[9.5px] font-bold text-emerald-200 flex items-center justify-between">
          <span>{seasonRewardNotice}</span>
          <button
            type="button"
            onClick={() => setSeasonRewardNotice(null)}
            className="text-slate-400 hover:text-white ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* =========================================================================
          TAB 1: ARENA & ACTIVE TOURNAMENT
      ========================================================================= */}
      {subTab === 'arena' && (
        <div className="space-y-3">
          {!activeTournament ? (
            /* Select Tournament Cup */
            <div className="space-y-3">
              {/* Personal Fighter Glance Banner */}
              <div className="rounded-xl border border-amber-500/30 bg-slate-900/90 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/50 bg-amber-950/60 text-xl shadow">
                    {scarab.avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-black text-amber-200">
                      <span>{scarab.name}</span>
                      <span className="rounded bg-slate-800 border border-slate-700 px-1 py-0.2 text-[8px] text-amber-400">
                        Lv.{scarab.level}
                      </span>
                      <span className="rounded bg-amber-950/80 border border-amber-600/40 px-1 py-0.2 text-[8px] text-amber-300">
                        {SCARAB_ARCHETYPES[scarab.archetype].label}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>❤️ HP: {scarab.maxHp}</span>
                      <span>⚔️ Сила: {scarab.strength}</span>
                      <span>💨 Ловкость: {scarab.agility}</span>
                      <span>🛡️ Броня: {scarab.armor}</span>
                      <span>💥 Крит: {scarab.critChance}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-[9px] text-slate-400">Трофеи:</div>
                    <div className="text-xs font-black text-yellow-300">🏆 {scarab.trophies}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubTab('training')}
                    className="rounded-lg border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 text-[9px] font-black text-amber-300 cursor-pointer"
                  >
                    🏋️ Прокачать
                  </button>
                </div>
              </div>

              {/* Tournament Cup Tiers Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {activeCupsList.map((cup) => {
                  const isSelected = selectedCupId === cup.id;
                  const canAfford =
                    hero.gold >= cup.entryFeeGold &&
                    tournamentConfig.enabled !== false &&
                    !hasMonthlyLimitReached;

                  return (
                    <div
                      key={cup.id}
                      onClick={() => setSelectedCupId(cup.id)}
                      className={`relative rounded-xl border p-3 flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? `${cup.tierColor} ring-2 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]`
                          : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg">{cup.icon}</span>
                          <span className="rounded bg-slate-950/80 border border-slate-700 px-1.5 py-0.5 text-[8.5px] font-black text-amber-300">
                            Взнос: {cup.entryFeeGold.toLocaleString()} 🪙
                          </span>
                        </div>
                        <h4 className="mt-1 text-xs font-black text-white">{cup.name}</h4>
                        <p className="mt-0.5 text-[8.5px] text-slate-400 leading-snug">{cup.desc}</p>
                      </div>

                      <div className="mt-3 border-t border-slate-800/80 pt-2 space-y-1 text-[8.5px]">
                        <div className="flex items-center justify-between font-bold text-emerald-300">
                          <span>🥇 1-е место:</span>
                          <span>
                            {cup.prize1stGold.toLocaleString()} 🪙
                            {cup.prize1stCrystals > 0 ? ` + ${cup.prize1stCrystals} 💎` : ''} (+{cup.prize1stTrophies}🏆)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span>🥈 2-е место:</span>
                          <span>
                            {cup.prize2ndGold.toLocaleString()} 🪙
                            {cup.prize2ndCrystals > 0 ? ` + ${cup.prize2ndCrystals} 💎` : ''} (+{cup.prize2ndTrophies}🏆)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-amber-300/90">
                          <span>🥉 3-е место (1/2):</span>
                          <span>
                            {(cup.prize3rdGold || 0).toLocaleString()} 🪙
                            {(cup.prize3rdCrystals || 0) > 0 ? ` + ${cup.prize3rdCrystals} 💎` : ''} (+{cup.prize3rdTrophies || 0}🏆)
                          </span>
                        </div>
                      </div>

                      <div className="mt-3">
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCupId(cup.id);
                            handleStartTournament(cup.id);
                          }}
                          className={`w-full rounded-lg py-2 text-center text-xs font-black cursor-pointer shadow transition-all ${
                            canAfford
                              ? 'border border-amber-400 bg-gradient-to-r from-amber-500 to-yellow-500 hover:brightness-110 text-slate-950'
                              : 'border border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {tournamentConfig.enabled === false
                            ? 'Турниры временно закрыты'
                            : hasMonthlyLimitReached
                            ? `Участие 1 раз в месяц (${entriesUsedThisMonth}/${maxEntriesAllowed})`
                            : canAfford
                            ? `Вступить (${cup.entryFeeGold.toLocaleString()} 🪙)`
                            : `Не хватает золота`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Active Tournament Live Bracket & Matches */
            <div className="space-y-3">
              {/* Cup Banner Header */}
              <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{activeTournament.cup.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 font-black text-amber-300 text-xs sm:text-sm">
                      <span>{activeTournament.cup.name}</span>
                      <span className="rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 text-[8.5px] text-amber-200">
                        {activeTournament.round === 'quarters'
                          ? '1/4 финала'
                          : activeTournament.round === 'semis'
                          ? 'Полуфинал'
                          : '👑 ГРАНД-ФИНАЛ'}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-300">
                      Призовой фонд: <strong className="text-emerald-300">{activeTournament.cup.prize1stGold.toLocaleString()} 🪙 + {activeTournament.cup.prize1stCrystals} 💎</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetTournament}
                  className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[9px] font-black text-slate-300 cursor-pointer"
                >
                  ✕ Покинуть турнир
                </button>
              </div>

              {/* Tournament Winner / Finished Banner */}
              {activeTournament.isFinished && (
                <div
                  className={`rounded-xl border-2 p-3 text-center space-y-2 ${
                    activeTournament.isWon
                      ? 'border-yellow-400 bg-gradient-to-br from-amber-500/30 via-yellow-900/40 to-amber-950/50 shadow-[0_0_20px_rgba(245,158,11,0.35)]'
                      : activeTournament.placedRank === 2 || activeTournament.placedRank === 3
                      ? 'border-amber-500/50 bg-amber-950/25'
                      : 'border-red-500/40 bg-red-950/20'
                  }`}
                >
                  <div className="text-2xl">
                    {activeTournament.isWon
                      ? '🏆 👑 🌟'
                      : activeTournament.placedRank === 2
                      ? '🥈'
                      : activeTournament.placedRank === 3
                      ? '🥉'
                      : '💀'}
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-white">
                    {activeTournament.isWon
                      ? 'ПОЗДРАВЛЯЕМ! ВЫ ЧЕМПИОН ТУРНИРА (1-е МЕСТО)!'
                      : activeTournament.placedRank === 2
                      ? '🥈 ВЫ ФИНАЛИСТ ТУРНИРА (2-е МЕСТО)!'
                      : activeTournament.placedRank === 3
                      ? '🥉 ПРИЗЁР ПОЛУФИНАЛА (3-е МЕСТО)!'
                      : 'Ваш скарабей выбыл в 1/4 финала'}
                  </h4>
                  <p className="text-[10px] text-slate-300 max-w-md mx-auto">
                    {activeTournament.isWon
                      ? `Ваш боец ${scarab.name} одолел всех соперников! Вы получили главный призовой фонд: +${activeTournament.cup.prize1stGold.toLocaleString()} 🪙, +${activeTournament.cup.prize1stCrystals} 💎 и +${activeTournament.cup.prize1stTrophies} кубков!`
                      : activeTournament.placedRank === 2
                      ? `Награда за 2-е место: +${activeTournament.cup.prize2ndGold.toLocaleString()} 🪙${activeTournament.cup.prize2ndCrystals ? `, +${activeTournament.cup.prize2ndCrystals} 💎` : ''} и +${activeTournament.cup.prize2ndTrophies} кубков!`
                      : activeTournament.placedRank === 3
                      ? `Награда за 3-е место: +${(activeTournament.cup.prize3rdGold || 0).toLocaleString()} 🪙${activeTournament.cup.prize3rdCrystals ? `, +${activeTournament.cup.prize3rdCrystals} 💎` : ''} и +${activeTournament.cup.prize3rdTrophies || 0} кубков!`
                      : `Прокачайте Силу, Ловкость и Панцирь вашего жука в тренировочном лагере и возьмите реванш!`}
                  </p>
                  <button
                    type="button"
                    onClick={handleResetTournament}
                    className="rounded-xl border border-amber-400 bg-amber-500 hover:bg-amber-400 py-1.5 px-4 text-xs font-black text-slate-950 cursor-pointer shadow"
                  >
                    Завершить и вернуться к выбору кубка
                  </button>
                </div>
              )}

              {/* Tournament Bracket Tree Display */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5">
                <div className="text-[9.5px] font-black uppercase text-slate-400 mb-2 flex items-center justify-between">
                  <span>Турнирная сетка (Раунд: {activeTournament.round.toUpperCase()}):</span>
                  <span className="text-amber-400">8 бойцов • Плей-офф на выбывание</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {activeTournament.matches.map((m, idx) => {
                    const isCurrent = idx === activeTournament.activeMatchIndex && !m.isCompleted;
                    return (
                      <div
                        key={m.id}
                        className={`rounded-lg border p-2 flex flex-col justify-between text-[9px] ${
                          isCurrent
                            ? 'border-amber-400 bg-amber-950/40 ring-1 ring-amber-400'
                            : m.isCompleted
                            ? 'border-slate-800 bg-slate-950/70 text-slate-400'
                            : 'border-slate-800 bg-slate-950/40 text-slate-500'
                        }`}
                      >
                        <div className="font-bold text-slate-400 text-[8px] mb-1 flex items-center justify-between">
                          <span>{m.roundName}</span>
                          {m.isCompleted && <span className="text-emerald-400">✓ Завершён</span>}
                        </div>

                        {/* Combatant 1 */}
                        <div
                          className={`flex items-center justify-between p-1 rounded ${
                            m.winner?.id === m.c1.id
                              ? 'bg-emerald-950/80 text-emerald-300 font-black'
                              : m.c1.isPlayer
                              ? 'bg-amber-950/40 text-amber-300 font-bold'
                              : 'text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-1 truncate">
                            <span>{m.c1.avatar}</span>
                            <span className="truncate">{m.c1.name}</span>
                          </div>
                          <span className="text-[8px] opacity-75">Lv.{m.c1.level}</span>
                        </div>

                        <div className="text-center text-[7.5px] text-slate-600 my-0.5">VS</div>

                        {/* Combatant 2 */}
                        <div
                          className={`flex items-center justify-between p-1 rounded ${
                            m.winner?.id === m.c2.id
                              ? 'bg-emerald-950/80 text-emerald-300 font-black'
                              : m.c2.isPlayer
                              ? 'bg-amber-950/40 text-amber-300 font-bold'
                              : 'text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-1 truncate">
                            <span>{m.c2.avatar}</span>
                            <span className="truncate">{m.c2.name}</span>
                          </div>
                          <span className="text-[8px] opacity-75">Lv.{m.c2.level}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Match Arena Card (if tournament not finished) */}
              {!activeTournament.isFinished && (
                <div className="rounded-xl border border-amber-500/50 bg-slate-900 p-3 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-black text-amber-300">
                      ⚔️ Текущий матч: {activeTournament.matches[activeTournament.activeMatchIndex]?.roundName}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      Победитель проходит дальше по сетке
                    </span>
                  </div>

                  {/* Side-by-Side Combatant Cards */}
                  {(() => {
                    const match = activeTournament.matches[activeTournament.activeMatchIndex];
                    if (!match) return null;
                    const c1 = match.c1;
                    const c2 = match.c2;

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Fighter 1 (Player) */}
                        <div className="rounded-xl border border-amber-500/60 bg-gradient-to-b from-amber-950/30 to-slate-950 p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[8.5px] font-black text-amber-300">
                              Ваш скарабей
                            </span>
                            <span className="text-[9px] text-slate-400">Ур. {c1.level}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="text-2xl">{c1.avatar}</div>
                            <div>
                              <div className="text-xs font-black text-white">{c1.name}</div>
                              <div className="text-[8.5px] text-amber-300">
                                {SCARAB_ARCHETYPES[c1.archetype].label} • {SCARAB_ARCHETYPES[c1.archetype].badge}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 grid grid-cols-3 gap-1 text-[8.5px] text-slate-300 border-t border-slate-800/80 pt-1.5">
                            <div>❤️ HP: {c1.maxHp}</div>
                            <div>⚔️ Сила: {c1.strength}</div>
                            <div>💨 Ловк: {c1.agility}</div>
                            <div>🛡️ Броня: {c1.armor}</div>
                            <div className="col-span-2 text-amber-300 font-bold">💥 Крит 2x: {c1.critChance}%</div>
                          </div>
                        </div>

                        {/* Fighter 2 (Opponent) */}
                        <div className="rounded-xl border border-purple-500/60 bg-gradient-to-b from-purple-950/30 to-slate-950 p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="rounded bg-purple-500/20 border border-purple-500/40 px-1.5 py-0.5 text-[8.5px] font-black text-purple-300">
                              Соперник ({c2.trainerNick})
                            </span>
                            <span className="text-[9px] text-slate-400">Ур. {c2.level}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="text-2xl">{c2.avatar}</div>
                            <div>
                              <div className="text-xs font-black text-white">{c2.name}</div>
                              <div className="text-[8.5px] text-purple-300">
                                {SCARAB_ARCHETYPES[c2.archetype].label} • {SCARAB_ARCHETYPES[c2.archetype].badge}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 grid grid-cols-3 gap-1 text-[8.5px] text-slate-300 border-t border-slate-800/80 pt-1.5">
                            <div>❤️ HP: {c2.maxHp}</div>
                            <div>⚔️ Сила: {c2.strength}</div>
                            <div>💨 Ловк: {c2.agility}</div>
                            <div>🛡️ Броня: {c2.armor}</div>
                            <div className="col-span-2 text-purple-300 font-bold">💥 Крит 2x: {c2.critChance}%</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Battle Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isFightingMatch}
                      onClick={() => handlePlayCurrentMatch(false)}
                      className="flex-1 rounded-xl border border-amber-400 bg-gradient-to-r from-amber-500 to-yellow-500 hover:brightness-110 py-2 px-3 text-xs font-black text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)] cursor-pointer disabled:opacity-50"
                    >
                      {isFightingMatch ? '⚔️ Идёт поединок на арене...' : '⚡ Начать поединок'}
                    </button>
                    <button
                      type="button"
                      disabled={isFightingMatch}
                      onClick={() => handlePlayCurrentMatch(true)}
                      className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2 px-3 text-xs font-black text-slate-200 cursor-pointer disabled:opacity-50"
                    >
                      ⏩ Быстрый бой
                    </button>
                  </div>
                </div>
              )}

              {/* Combat Log */}
              {combatLog.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 max-h-40 overflow-y-auto space-y-1">
                  <div className="text-[9px] font-black uppercase text-slate-400 flex items-center justify-between">
                    <span>📜 Хроника турнирного поединка:</span>
                    <span className="text-[8px] text-amber-400/80">💥 2.0x Крит | 💨 Уворот и контрудар | 🔥 Ярость &lt;35% HP</span>
                  </div>
                  {combatLog.map((line, idx) => (
                    <div key={idx} className="text-[10px] text-slate-200 font-medium leading-snug">
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: TRAINING CAMP & STATS UPGRADE
      ========================================================================= */}
      {subTab === 'training' && (
        <div className="space-y-3">
          {/* Main Scarab Profile & Archetype Selection */}
          <div className="rounded-xl border border-amber-500/40 bg-slate-900/90 p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/50 bg-amber-950/70 text-2xl shadow">
                  {scarab.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {!isRenaming ? (
                      <>
                        <span className="text-sm font-black text-amber-200">{scarab.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNameInput(scarab.name);
                            setIsRenaming(true);
                          }}
                          className="text-[10px] text-slate-400 hover:text-amber-300 cursor-pointer"
                        >
                          ✏️
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          maxLength={16}
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          className="rounded border border-amber-500/60 bg-slate-950 px-2 py-0.5 text-xs font-black text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSaveName}
                          className="rounded bg-amber-500 px-2 py-0.5 text-[9px] font-black text-slate-950 cursor-pointer"
                        >
                          OK
                        </button>
                      </div>
                    )}
                    <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[8.5px] font-black text-amber-400">
                      Уровень {scarab.level}
                    </span>
                  </div>

                  <div className="text-[9px] text-slate-400 mt-0.5">
                    Тренер: <strong className="text-slate-200">{scarab.trainerNick}</strong> • Трофеи: <strong className="text-yellow-300">🏆 {scarab.trophies}</strong>
                  </div>
                </div>
              </div>

              {/* Avatar Selector Icons */}
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-lg">
                {['🪲', '🦂', '🪳', '👑', '⚡', '💎'].map((ico) => (
                  <button
                    key={ico}
                    type="button"
                    onClick={() => setScarab((prev) => ({ ...prev, avatar: ico }))}
                    className={`h-7 w-7 rounded flex items-center justify-center text-sm cursor-pointer ${
                      scarab.avatar === ico ? 'bg-amber-500/30 border border-amber-400' : 'hover:bg-slate-800'
                    }`}
                  >
                    {ico}
                  </button>
                ))}
              </div>
            </div>

            {/* XP Level Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[9px] font-bold">
                <span className="text-slate-400">Опыт бойца (XP):</span>
                <span className="text-amber-300">{scarab.xp} / {scarab.xpToNext} XP</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((scarab.xp / scarab.xpToNext) * 100))}%` }}
                />
              </div>
            </div>

            {/* Archetype Selector */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400">
                Боевой архетип скарабея (выберите стиль боя):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(Object.keys(SCARAB_ARCHETYPES) as TournamentScarabArchetypeKey[]).map((key) => {
                  const meta = SCARAB_ARCHETYPES[key];
                  const active = scarab.archetype === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setScarab((prev) => ({ ...prev, archetype: key }))}
                      className={`rounded-xl border p-2 text-left transition-all cursor-pointer ${
                        active
                          ? `${meta.color} ring-1 ring-amber-400 shadow`
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1 text-[10px] font-black text-white">
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </div>
                      <div className="text-[7.5px] text-slate-300 leading-tight mt-1">
                        {meta.bonusDesc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tournament Lifetime Stats Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[9px]">
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-1.5 text-center">
                <div className="text-slate-400">Кубки Фараона:</div>
                <div className="text-xs font-black text-yellow-300">🏆 {scarab.trophies}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-1.5 text-center">
                <div className="text-slate-400">Турниров выиграно:</div>
                <div className="text-xs font-black text-emerald-300">
                  {scarab.tournamentsWon} / {scarab.tournamentsPlayed}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-1.5 text-center">
                <div className="text-slate-400">Матчей (Винрейт):</div>
                <div className="text-xs font-black text-amber-300">
                  {scarab.matchesWon}W - {scarab.matchesLost}L (
                  {scarab.matchesWon + scarab.matchesLost > 0
                    ? Math.round((scarab.matchesWon / (scarab.matchesWon + scarab.matchesLost)) * 100)
                    : 0}
                  %)
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-1.5 text-center">
                <div className="text-slate-400">Призовые в сумме:</div>
                <div className="text-xs font-black text-white">
                  🪙 {scarab.totalPrizeGold.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Stat Upgrade Stations */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-amber-300 uppercase tracking-wide">
              Тренировочные станции лагеря:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Strength Station */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-black text-white text-xs">
                    <span>⚔️ Сила атаки:</span>
                    <span className="text-amber-400 text-sm">{scarab.strength}</span>
                  </div>
                  <div className="text-[8.5px] text-slate-400 mt-0.5">
                    Увеличивает базовый урон по соперникам
                  </div>
                </div>
                <button
                  type="button"
                  disabled={hero.gold < costStrength}
                  onClick={handleTrainStrength}
                  className="rounded-lg border border-amber-500/50 bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1.5 text-[10px] font-black cursor-pointer shadow disabled:opacity-40"
                >
                  +{trCfg.strGain} Силы ({costStrength} 🪙)
                </button>
              </div>

              {/* Agility Station */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-black text-white text-xs">
                    <span>💨 Ловкость:</span>
                    <span className="text-cyan-300 text-sm">{scarab.agility}</span>
                  </div>
                  <div className="text-[8.5px] text-slate-400 mt-0.5">
                    Повышает уворот (~{Math.min(55, scarab.agility * 1.4)}%) и первый ход
                  </div>
                </div>
                <button
                  type="button"
                  disabled={hero.gold < costAgility}
                  onClick={handleTrainAgility}
                  className="rounded-lg border border-cyan-500/50 bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-2.5 py-1.5 text-[10px] font-black cursor-pointer shadow disabled:opacity-40"
                >
                  +{trCfg.agiGain} Ловкости ({costAgility} 🪙)
                </button>
              </div>

              {/* Armor & Vitality Station */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-black text-white text-xs">
                    <span>🛡️ Панцирь и HP:</span>
                    <span className="text-emerald-400 text-sm">{scarab.armor} Бр / {scarab.maxHp} HP</span>
                  </div>
                  <div className="text-[8.5px] text-slate-400 mt-0.5">
                    Поглощает входящий урон и даёт здоровье
                  </div>
                </div>
                <button
                  type="button"
                  disabled={hero.gold < costArmor}
                  onClick={handleTrainArmor}
                  className="rounded-lg border border-emerald-500/50 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-2.5 py-1.5 text-[10px] font-black cursor-pointer shadow disabled:opacity-40"
                >
                  +{trCfg.hpGain} HP & +{trCfg.armorGain} Бр ({costArmor} 🪙)
                </button>
              </div>

              {/* Critical Chance Station */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-black text-white text-xs">
                    <span>💥 Крит 2x урон:</span>
                    <span className="text-purple-300 text-sm">{scarab.critChance}%</span>
                  </div>
                  <div className="text-[8.5px] text-slate-400 mt-0.5">
                    Шанс нанести сокрушительный 2.0x урон (Макс: {trCfg.maxCritChance || 65}%)
                  </div>
                </div>
                <button
                  type="button"
                  disabled={hero.crystals < costCritCrystals || scarab.critChance >= (trCfg.maxCritChance || 65)}
                  onClick={handleTrainCrit}
                  className="rounded-lg border border-purple-500/50 bg-purple-500 hover:bg-purple-400 text-slate-950 px-2.5 py-1.5 text-[10px] font-black cursor-pointer shadow disabled:opacity-40"
                >
                  +{trCfg.critGain}% Крита ({costCritCrystals} 💎)
                </button>
              </div>

              {/* XP Elixir */}
              <div className="sm:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-black text-white text-xs">
                    <span>🧪 Настойка Опыта Арены:</span>
                    <span className="text-yellow-300 text-xs">+{trCfg.xpElixirGain} XP</span>
                  </div>
                  <div className="text-[8.5px] text-slate-400 mt-0.5">
                    Ускоряет повышение уровня вашего бойца
                  </div>
                </div>
                <button
                  type="button"
                  disabled={hero.gold < costXpElixir}
                  onClick={handleBuyXpElixir}
                  className="rounded-lg border border-yellow-500/50 bg-yellow-500 hover:bg-yellow-400 text-slate-950 px-3 py-1.5 text-[10px] font-black cursor-pointer shadow disabled:opacity-40"
                >
                  Принять настойку ({costXpElixir} 🪙)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: TOURNAMENT LEADERBOARD & HALL OF FAME
      ========================================================================= */}
      {subTab === 'leaderboard' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-500/30 bg-slate-900 p-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <div>
                <h4 className="font-black text-amber-300 text-xs">Таблица лидеров Турнира Скарабеев</h4>
                <p className="text-[8.5px] text-slate-400">
                  Лучшие тренеры Пирамиды по количеству заработанных кубков и побед
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[8.5px] text-slate-400">Ваш ранг:</div>
              <div className="text-xs font-black text-yellow-300">
                #{Math.max(1, leaderboard.findIndex((e) => e.isPlayer) + 1)} (🏆 {scarab.trophies})
              </div>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[9.5px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900 text-slate-400">
                    <th className="py-2 px-2.5">#</th>
                    <th className="py-2 px-2.5">Тренер и Скарабей</th>
                    <th className="py-2 px-2.5">Кубки</th>
                    <th className="py-2 px-2.5">Победы / Бои</th>
                    <th className="py-2 px-2.5">Призовые</th>
                    <th className="py-2 px-2.5 text-right">Инфо</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {leaderboard.map((entry, idx) => {
                    const rank = idx + 1;
                    const isPlayerRow = entry.isPlayer || entry.trainerNick.toLowerCase() === trainerKey.toLowerCase();
                    const winrate =
                      entry.matchesWon + entry.matchesLost > 0
                        ? Math.round((entry.matchesWon / (entry.matchesWon + entry.matchesLost)) * 100)
                        : 0;

                    return (
                      <tr
                        key={entry.trainerNick}
                        className={`transition-colors ${
                          isPlayerRow
                            ? 'bg-amber-500/15 font-black text-amber-200'
                            : 'hover:bg-slate-900/60 text-slate-300'
                        }`}
                      >
                        <td className="py-2 px-2.5 font-black">
                          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{entry.scarabAvatar}</span>
                            <div>
                              <div className="flex items-center gap-1">
                                <span className={isPlayerRow ? 'text-amber-300' : 'text-white'}>
                                  {entry.trainerNick}
                                </span>
                                {isPlayerRow && (
                                  <span className="rounded bg-amber-500 px-1 py-0.2 text-[7px] text-slate-950 font-black">
                                    ВЫ
                                  </span>
                                )}
                              </div>
                              <div className="text-[8px] text-slate-400">
                                {entry.scarabName} (Lv.{entry.level} • {SCARAB_ARCHETYPES[entry.archetype]?.label || entry.archetype})
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2.5 font-black text-yellow-300">
                          🏆 {entry.trophies.toLocaleString()}
                        </td>
                        <td className="py-2 px-2.5">
                          <div>{entry.tournamentsWon} кубков</div>
                          <div className="text-[8px] text-slate-400">{entry.matchesWon}W ({winrate}%)</div>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="text-emerald-300">🪙 {entry.totalPrizeGold.toLocaleString()}</span>
                          {entry.totalPrizeCrystals > 0 && (
                            <span className="text-purple-300 ml-1">💎 {entry.totalPrizeCrystals}</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setInspectedEntry(entry)}
                            className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[8.5px] font-bold text-slate-300 cursor-pointer"
                          >
                            🔍 Осмотреть
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inspect Rival Scarab Modal */}
          {inspectedEntry && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3">
              <div className="w-full max-w-sm rounded-2xl border border-amber-500/60 bg-slate-900 p-4 space-y-3 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{inspectedEntry.scarabAvatar}</span>
                    <div>
                      <h4 className="text-xs font-black text-amber-300">{inspectedEntry.scarabName}</h4>
                      <p className="text-[8.5px] text-slate-400">Тренер: {inspectedEntry.trainerNick}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectedEntry(null)}
                    className="text-base font-bold text-slate-400 hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1.5 text-[9.5px]">
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Боевой архетип:</span>
                    <span className="font-bold text-amber-300">
                      {SCARAB_ARCHETYPES[inspectedEntry.archetype]?.label} ({SCARAB_ARCHETYPES[inspectedEntry.archetype]?.badge})
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Уровень скарабея:</span>
                    <span className="font-bold text-white">Ур. {inspectedEntry.level}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Здоровье (HP):</span>
                    <span className="font-bold text-emerald-400">{inspectedEntry.inspectStats.hp}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Сила атаки:</span>
                    <span className="font-bold text-amber-400">{inspectedEntry.inspectStats.strength}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Ловкость (Уворот):</span>
                    <span className="font-bold text-cyan-300">{inspectedEntry.inspectStats.agility} (~{Math.min(55, inspectedEntry.inspectStats.agility * 1.4)}%)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Броня (Панцирь):</span>
                    <span className="font-bold text-slate-200">{inspectedEntry.inspectStats.armor}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Шанс критического удара (2x):</span>
                    <span className="font-bold text-purple-300">{inspectedEntry.inspectStats.critChance}%</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Выиграно золота:</span>
                    <span className="font-bold text-yellow-300">🪙 {inspectedEntry.totalPrizeGold.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectedEntry(null)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-1.5 text-xs font-black text-white cursor-pointer"
                >
                  Закрыть
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

