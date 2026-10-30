export interface DailyRewardDay {
  day: number;
  gold: number;
  crystals: number;
  expPotions: number;
  title: string;
}

export const DAILY_LOGIN_REWARDS: DailyRewardDay[] = [
  { day: 1, gold: 20, crystals: 2, expPotions: 0, title: '1-й День' },
  { day: 2, gold: 35, crystals: 3, expPotions: 0, title: '2-й День' },
  { day: 3, gold: 50, crystals: 4, expPotions: 0, title: '3-й День' },
  { day: 4, gold: 70, crystals: 5, expPotions: 0, title: '4-й День' },
  { day: 5, gold: 90, crystals: 7, expPotions: 0, title: '5-й День' },
  { day: 6, gold: 120, crystals: 10, expPotions: 0, title: '6-й День' },
  { day: 7, gold: 200, crystals: 15, expPotions: 3, title: '7-й День' }
];

/**
 * Returns game day key formatted as YYYY-MM-DD.
 * Game day resets at 00:01.
 * Subtracting 60 seconds (1 minute) from now ensures:
 * 00:00:00 - 00:00:59 still belongs to yesterday,
 * and 00:01:00 starts the new day key.
 */
export function getDailyRewardDayKey(timestamp: number = Date.now()): string {
  const d = new Date(timestamp - 60 * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns yesterday's game day key (1 calendar day before current game day).
 */
export function getYesterdayRewardDayKey(timestamp: number = Date.now()): string {
  const d = new Date(timestamp - 60 * 1000);
  const prev = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  const year = prev.getFullYear();
  const month = String(prev.getMonth() + 1).padStart(2, '0');
  const day = String(prev.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns milliseconds remaining until the next 00:01 reset.
 */
export function getMsUntilNext0001Reset(nowTs: number = Date.now()): number {
  const now = new Date(nowTs);
  const nextReset = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 1, 0, 0);
  if (now.getTime() >= nextReset.getTime()) {
    nextReset.setDate(nextReset.getDate() + 1);
  }
  return Math.max(0, nextReset.getTime() - now.getTime());
}

/**
 * Formats milliseconds into HH:MM:SS string.
 */
export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export interface DailyRewardStatus {
  todayKey: string;
  yesterdayKey: string;
  hasClaimedToday: boolean;
  canClaimToday: boolean;
  activeDay: number; // 1 to 7
  lastClaimDay: number; // 0 to 7
  msUntilNextReset: number;
}

export function computeDailyRewardStatus(
  dailyLoginDay: number = 0,
  dailyLoginLastDate: string = '',
  nowTs: number = Date.now()
): DailyRewardStatus {
  const todayKey = getDailyRewardDayKey(nowTs);
  const yesterdayKey = getYesterdayRewardDayKey(nowTs);
  const msUntilNextReset = getMsUntilNext0001Reset(nowTs);

  const cleanLastDate = String(dailyLoginLastDate || '').trim();
  const lastClaimDay = Math.max(0, Math.min(7, Math.floor(Number(dailyLoginDay) || 0)));

  if (cleanLastDate === todayKey) {
    // Already claimed today!
    return {
      todayKey,
      yesterdayKey,
      hasClaimedToday: true,
      canClaimToday: false,
      activeDay: lastClaimDay,
      lastClaimDay,
      msUntilNextReset
    };
  }

  // Not claimed today yet.
  if (cleanLastDate === yesterdayKey) {
    // Consecutive login from yesterday!
    // If finished day 7 yesterday, wrap around to day 1
    const nextDay = lastClaimDay >= 7 ? 1 : lastClaimDay + 1;
    return {
      todayKey,
      yesterdayKey,
      hasClaimedToday: false,
      canClaimToday: true,
      activeDay: nextDay,
      lastClaimDay: lastClaimDay >= 7 ? 0 : lastClaimDay,
      msUntilNextReset
    };
  }

  // Missed one or more days, or never claimed before: reset streak to Day 1
  return {
    todayKey,
    yesterdayKey,
    hasClaimedToday: false,
    canClaimToday: true,
    activeDay: 1,
    lastClaimDay: 0,
    msUntilNextReset
  };
}
