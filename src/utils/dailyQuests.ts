import { DailyQuest, DailyQuestType, HeroState } from '../types/game';
import { getDailyRewardDayKey } from './dailyReward';

export interface GrandCrystalChestReward {
  crystals: number;
  gold: number;
  expPotions: number;
  requiredCompletedQuests: number;
  title: string;
  desc: string;
}

export const GRAND_DAILY_CRYSTAL_CHEST: GrandCrystalChestReward = {
  crystals: 7,
  gold: 60,
  expPotions: 1,
  requiredCompletedQuests: 3,
  title: 'Королевский Сундук с Кристаллами Фараона',
  desc: 'Выполните минимум 3 ежедневных задания за день, чтобы открыть Главный Сундук с кристаллами и эликсиром опыта!'
};

export const DEFAULT_DAILY_QUEST_TEMPLATES: Omit<DailyQuest, 'progress' | 'isCompleted' | 'isClaimed'>[] = [
  {
    id: 'dq_kill_10_mobs',
    type: 'kill_mobs',
    title: 'Охотник Пирамиды',
    description: 'Убить 10 монстров в любой Пирамиде',
    icon: '⚔️',
    target: 10,
    reward: 3,
    rewardGold: 25,
    chestName: 'Малый Сундук с Кристаллами'
  },
  {
    id: 'dq_collect_100_gold',
    type: 'collect_gold',
    title: 'Золотоискатель Песков',
    description: 'Собрать 100 золота в боях или тайниках Пирамиды',
    icon: '🪙',
    target: 100,
    reward: 3,
    rewardGold: 30,
    chestName: 'Сундук с Кристаллами Искателя'
  },
  {
    id: 'dq_pyramid_20_steps',
    type: 'pyramid_steps',
    title: 'Поступь Фараона',
    description: 'Сделать 20 шагов по залам Пирамиды',
    icon: '🏛️',
    target: 20,
    reward: 2,
    rewardGold: 20,
    chestName: 'Походный Сундук с Кристаллами'
  },
  {
    id: 'dq_boss_or_scarab',
    type: 'boss_or_scarab',
    title: 'Гладиатор Древнего Египта',
    description: 'Победить 1 Босса Пирамиды или сыграть в Боях/Турнире Скарабеев',
    icon: '🪲',
    target: 1,
    reward: 3,
    rewardGold: 35,
    chestName: 'Боевой Сундук с Кристаллами'
  }
];

/**
 * Ensures the player's dailyQuests array is initialized and synced to today's 00:01 game day.
 * Accepts either a HeroState object or (storedQuests, storedDate) arguments.
 */
export function ensureDailyQuestsForToday(
  heroOrQuests: HeroState | DailyQuest[] | undefined,
  dateOrNow?: string | number,
  nowTsArg: number = Date.now()
): {
  dailyQuests: DailyQuest[];
  dailyQuestsDate: string;
  dailyCrystalChestClaimedDate: string;
  changed: boolean;
} {
  const isQuestsArray = Array.isArray(heroOrQuests) || heroOrQuests === undefined || heroOrQuests === null;
  const nowTs = typeof dateOrNow === 'number' ? dateOrNow : nowTsArg;
  const todayKey = getDailyRewardDayKey(nowTs);

  const currentQuestDate = isQuestsArray
    ? typeof dateOrNow === 'string'
      ? dateOrNow
      : todayKey
    : String((heroOrQuests as HeroState).dailyQuestsDate || '');

  const currentChestClaimedDate = isQuestsArray
    ? ''
    : String((heroOrQuests as HeroState).dailyCrystalChestClaimedDate || '');

  const existing: DailyQuest[] = isQuestsArray
    ? Array.isArray(heroOrQuests)
      ? heroOrQuests
      : []
    : Array.isArray((heroOrQuests as HeroState).dailyQuests)
    ? (heroOrQuests as HeroState).dailyQuests!
    : [];

  if (currentQuestDate === todayKey && existing.length === DEFAULT_DAILY_QUEST_TEMPLATES.length) {
    // Ensure metadata fields (title, description, icon, rewardGold, chestName) are hydrated
    let metaChanged = false;
    const hydrated = DEFAULT_DAILY_QUEST_TEMPLATES.map((tpl) => {
      const found = existing.find((q) => q.id === tpl.id || q.type === tpl.type) as
        | (DailyQuest & { completed?: boolean; claimed?: boolean })
        | undefined;
      if (!found) {
        metaChanged = true;
        return {
          ...tpl,
          progress: 0,
          isCompleted: false,
          isClaimed: false
        };
      }
      const prog = Math.max(0, Math.min(tpl.target, Math.floor(Number(found.progress) || 0)));
      const isCompleted = prog >= tpl.target || Boolean(found.isCompleted || found.completed);
      const isClaimed = Boolean(found.isClaimed || found.claimed);
      if (
        found.title !== tpl.title ||
        found.target !== tpl.target ||
        found.reward !== tpl.reward ||
        found.rewardGold !== tpl.rewardGold ||
        found.isCompleted !== isCompleted ||
        found.isClaimed !== isClaimed
      ) {
        metaChanged = true;
      }
      return {
        ...tpl,
        progress: prog,
        isCompleted,
        isClaimed
      };
    });

    return {
      dailyQuests: hydrated,
      dailyQuestsDate: todayKey,
      dailyCrystalChestClaimedDate: currentChestClaimedDate,
      changed: metaChanged
    };
  }

  // New day or uninitialized quests: reset all daily quests for today
  const freshQuests: DailyQuest[] = DEFAULT_DAILY_QUEST_TEMPLATES.map((tpl) => ({
    ...tpl,
    progress: 0,
    isCompleted: false,
    isClaimed: false
  }));

  return {
    dailyQuests: freshQuests,
    dailyQuestsDate: todayKey,
    dailyCrystalChestClaimedDate: currentChestClaimedDate === todayKey ? todayKey : '',
    changed: true
  };
}

/**
 * Increments progress for matching daily quest type(s) on a HeroState or DailyQuest[] array.
 */
export function advanceDailyQuestProgress(
  heroOrQuests: HeroState | DailyQuest[] | undefined,
  questType: DailyQuestType,
  amount: number = 1,
  nowTs: number = Date.now()
): {
  dailyQuests: DailyQuest[];
  dailyQuestsDate: string;
  newlyCompleted: DailyQuest[];
  newlyCompletedQuests: DailyQuest[];
} {
  const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
  const todayKey = getDailyRewardDayKey(nowTs);
  const synced = Array.isArray(heroOrQuests)
    ? ensureDailyQuestsForToday(heroOrQuests, todayKey, nowTs)
    : ensureDailyQuestsForToday(heroOrQuests, nowTs);

  if (safeAmount <= 0) {
    return {
      dailyQuests: synced.dailyQuests,
      dailyQuestsDate: synced.dailyQuestsDate,
      newlyCompleted: [],
      newlyCompletedQuests: []
    };
  }

  const newlyCompletedQuests: DailyQuest[] = [];
  const updated = synced.dailyQuests.map((q) => {
    if (q.type !== questType) return q;
    const prevCompleted = q.isCompleted || q.progress >= q.target;
    const nextProgress = Math.min(q.target, (Number(q.progress) || 0) + safeAmount);
    const nextCompleted = nextProgress >= q.target;
    const nextQuest: DailyQuest = {
      ...q,
      progress: nextProgress,
      isCompleted: nextCompleted
    };
    if (!prevCompleted && nextCompleted) {
      newlyCompletedQuests.push(nextQuest);
    }
    return nextQuest;
  });

  return {
    dailyQuests: updated,
    dailyQuestsDate: synced.dailyQuestsDate,
    newlyCompleted: newlyCompletedQuests,
    newlyCompletedQuests
  };
}

/**
 * Computes summary counts for notifications & badges in City / Modals.
 */
export function getDailyQuestsSummary(hero: HeroState, nowTs: number = Date.now()) {
  const synced = ensureDailyQuestsForToday(hero, nowTs);
  const quests = synced.dailyQuests;
  const completedCount = quests.filter((q) => q.isCompleted || q.progress >= q.target).length;
  const claimableQuestsCount = quests.filter(
    (q) => (q.isCompleted || q.progress >= q.target) && !q.isClaimed
  ).length;
  const isGrandChestUnlocked = completedCount >= GRAND_DAILY_CRYSTAL_CHEST.requiredCompletedQuests;
  const isGrandChestClaimed = synced.dailyCrystalChestClaimedDate === synced.dailyQuestsDate;
  const canClaimGrandChest = isGrandChestUnlocked && !isGrandChestClaimed;

  return {
    quests,
    todayKey: synced.dailyQuestsDate,
    completedCount,
    totalQuests: quests.length,
    claimableQuestsCount,
    isGrandChestUnlocked,
    isGrandChestClaimed,
    canClaimGrandChest,
    totalReadyChests: claimableQuestsCount + (canClaimGrandChest ? 1 : 0)
  };
}
