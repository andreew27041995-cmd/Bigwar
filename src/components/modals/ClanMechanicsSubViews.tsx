import React, { useState, useEffect } from 'react';
import {
  Clan,
  EquippedGear,
  GameItem,
  HeroState,
  ClanArenaMatchLog,
  ClanArenaPlayoffMatch,
  TerritoryFighterRole,
  TerritoryTacticalAction,
  ClanTerritory7x7Fighter
} from '../../types/game';
import {
  getClanTerritories,
  getClanTerritoryBuffs,
  declareClanTerritoryWar,
  joinOrUpdateTerritory7x7Slot,
  fillTerritory7x7WithClanRoster,
  updateTerritory7x7FighterConfig,
  startOrAdvanceTerritory7x7Battle,
  performTerritory7x7CellStrike,
  getClanRaidBoss,
  attackClanRaidBoss,
  claimClanRaidBossReward,
  getClanDailyQuests,
  claimClanQuestReward,
  getClanArenaState,
  ensureArenaPlayoffBracket,
  resetClanArenaPlayoffBracket,
  registerPlayerForClanArena,
  fightInClanArenaTournament,
  calculateFighterPowerFromGear,
  doesPlayerHaveClanBadge,
  getPortFishMarketState,
  getPortRelicMarketPrice,
  sellFishToPortMarket,
  loadFishIntoPortFactory,
  craftRelicsAtPortFactoryNow,
  buyRelicsFromPortFactory,
  startPortFactoryWorkShift,
  claimPortFactoryWorkShift,
  getPlayerActivePortWorkShift,
  mergeClanPortFactories,
  PORT_BASE_MAX_WORKERS,
  PORT_MERGED_MAX_WORKERS,
  PORT_WORKER_GOLD_PER_HOUR,
  PORT_FISH_PER_RELIC,
  CLAN_BADGE_COST_GOLD
} from '../../utils/clanStorage';
import { getProductionSkillInfo, STAT_POINTS_PER_PRODUCTION_LEVEL } from '../../utils/gameData';
import { createRelicItem } from '../../utils/shopConfig';
import { ItemIcon } from '../ItemIcon';
import CharacterAvatar from '../CharacterAvatar';

interface ClanSubViewsCommonProps {
  clan?: Clan;
  myNick: string;
  hero: HeroState;
  inventory: GameItem[];
  equipped?: EquippedGear;
  initialSectorId?: string | null;
  onUpdateHero: (updated: Partial<HeroState>) => void;
  onUpdateInventory: (updated: GameItem[]) => void;
  showToast: (text: string) => void;
  triggerRefresh: () => void;
  requestConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; danger?: boolean }
  ) => void;
}

function formatRemainingTimer(targetMs: number, nowMs: number): string {
  const diff = Math.max(0, targetMs - nowMs);
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatShortMinSec(targetMs: number, nowMs: number): string {
  const diff = Math.max(0, targetMs - nowMs);
  const totalSec = Math.floor(diff / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getNextMidnightMs(nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

const ROLE_CONFIG: Record<
  TerritoryFighterRole,
  { label: string; short: string; badgeClass: string; desc: string }
> = {
  tank: {
    label: '🛡 Передовая / Танк',
    short: '🛡 Танк',
    badgeClass: 'border-sky-500/60 bg-sky-950/80 text-sky-200',
    desc: '1-я линия (до 3 реком.): +25% к макс. HP, перехватывает удары на передовой.'
  },
  dps: {
    label: '🏹 Стрелок / Дамагер',
    short: '🏹 Стрелок',
    badgeClass: 'border-rose-500/60 bg-rose-950/80 text-rose-200',
    desc: '2-я линия (до 3 реком.): +20% к урону и повышенный шанс критического удара.'
  },
  support: {
    label: '✨ Поддержка',
    short: '✨ Саппорт',
    badgeClass: 'border-emerald-500/60 bg-emerald-950/80 text-emerald-200',
    desc: '3-я линия (1 реком.): исцеляет раненых союзников (+12% HP) и даёт ауру атаки.'
  }
};

const TACTIC_CONFIG: Record<
  TerritoryTacticalAction,
  { label: string; short: string; badgeClass: string; desc: string }
> = {
  defense: {
    label: '🛡 Глухая защита',
    short: '🛡 Защита (-50% урона)',
    badgeClass: 'border-cyan-400/60 bg-cyan-950/80 text-cyan-200',
    desc: 'Урон по персонажу снижается на 50%, шанс увернуться значительно выше.'
  },
  frontal: {
    label: '⚔️ Атака в лоб',
    short: '⚔️ Атака в лоб (Макс. урон)',
    badgeClass: 'border-amber-400/60 bg-amber-950/80 text-amber-200',
    desc: 'Нанесение максимального урона (+25%) противнику напротив.'
  },
  focus: {
    label: '🎯 Точечный фокус',
    short: '🎯 Фокус раненого',
    badgeClass: 'border-fuchsia-400/60 bg-fuchsia-950/80 text-fuchsia-200',
    desc: 'Атака врага с наименьшим количеством здоровья для быстрого вывода из строя.'
  }
};

// ============================================================================
// 1. ВКЛАДКА «КАРТА ТЕРРИТОРИЙ / ЖИВЫЕ БОИ 7х7 НА СЕТКЕ»
// ============================================================================
export const ClanTerritoryWarsView: React.FC<ClanSubViewsCommonProps> = ({
  clan,
  myNick,
  hero,
  inventory,
  equipped,
  initialSectorId,
  onUpdateHero,
  onUpdateInventory,
  showToast,
  triggerRefresh,
  requestConfirm
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(initialSectorId || null);
  const [selectedRole, setSelectedRole] = useState<TerritoryFighterRole>('tank');
  const [selectedTactic, setSelectedTactic] = useState<TerritoryTacticalAction>('frontal');
  const [selectedEnemyNick, setSelectedEnemyNick] = useState<string | null>(null);
  const [viewingReportSectorId, setViewingReportSectorId] = useState<string | null>(null);
  const [shiftDurationBySector, setShiftDurationBySector] = useState<Record<string, 1 | 2>>({});

  useEffect(() => {
    if (initialSectorId) {
      setSelectedSectorId(initialSectorId);
    }
  }, [initialSectorId]);

  useEffect(() => {
    const t = setInterval(() => {
      setNowMs(Date.now());
      triggerRefresh();
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const territories = getClanTerritories();
  const myBuffs = getClanTerritoryBuffs(clan?.id);
  const fishMarket = getPortFishMarketState();
  const relicUnitPrice = getPortRelicMarketPrice();
  const prodSkill = getProductionSkillInfo(hero.productionHours || 0);
  const hasClanBadge = doesPlayerHaveClanBadge(myNick, clan?.id, hero.hasClanBadge);
  const myActiveShift = getPlayerActivePortWorkShift(myNick);
  const keepnetFishCount = Array.isArray(hero.fishingState?.keepnet)
    ? hero.fishingState.keepnet.length
    : 0;

  const activeClanWarSector = territories.find(
    (s) =>
      s.warStatus === 'war' &&
      clan &&
      (s.attackerClanId === clan.id || s.ownerClanId === clan.id)
  );
  const effectiveSelectedSector =
    territories.find((s) => s.id === selectedSectorId) || activeClanWarSector || null;

  const myMember = clan?.members.find((m) => m.nick.trim().toLowerCase() === myNick.trim().toLowerCase());
  const isLeaderOrOfficer = Boolean(
    clan &&
      (clan.leaderNick.trim().toLowerCase() === myNick.trim().toLowerCase() ||
        myMember?.role === 'leader' ||
        myMember?.role === 'officer')
  );

  const handleStartWorkShift = (sectorId: string, durationHours: 1 | 2) => {
    const res = startPortFactoryWorkShift(sectorId, myNick, hero.avatar || '🧙‍♂️', durationHours);
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }
    showToast(res.message || '🔨 Вы устроились на работу в Порту!');
    triggerRefresh();
  };

  const handleClaimWorkShift = (sectorId: string, allowInstant = false) => {
    const res = claimPortFactoryWorkShift(sectorId, myNick, allowInstant);
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }
    const addedHours = res.hoursWorked || 1;
    const addedGold = res.goldEarned || addedHours * PORT_WORKER_GOLD_PER_HOUR;
    const oldHours = Number(hero.productionHours || 0);
    const newHours = oldHours + addedHours;
    const oldSkill = getProductionSkillInfo(oldHours);
    const newSkill = getProductionSkillInfo(newHours);
    const gainedLevels = Math.max(0, newSkill.level - oldSkill.level);
    const bonusStatsAwarded = gainedLevels * STAT_POINTS_PER_PRODUCTION_LEVEL;

    onUpdateHero({
      gold: (hero.gold || 0) + addedGold,
      productionHours: newHours,
      productionLevel: newSkill.level,
      statPoints: (hero.statPoints || 0) + bonusStatsAwarded
    });

    if (gainedLevels > 0) {
      showToast(
        `🎉 Навык «Производство» повышен до Уровня ${newSkill.level}! Получено +${bonusStatsAwarded} свободных статов и +${addedGold} 🪙!`
      );
    } else {
      showToast(res.message || `✅ Оплата смены получена: +${addedGold} 🪙 и +${addedHours} ч. Производства!`);
    }
    triggerRefresh();
  };

  const handleSellKeepnetFishToPortMarket = () => {
    if (keepnetFishCount <= 0) {
      showToast('🐟 Ваш рыболовный садок пуст! Наловите рыбу в мини-игре «Рыбалка».');
      return;
    }
    const res = sellFishToPortMarket(myNick, keepnetFishCount);
    onUpdateHero({
      gold: (hero.gold || 0) + res.goldEarned,
      fishingState: {
        ...(hero.fishingState || {}),
        keepnet: []
      }
    });
    showToast(res.message);
    triggerRefresh();
  };

  const handleLoadFishToFactory = (sectorId: string, source: 'market' | 'keepnet', qty = 10) => {
    const res = loadFishIntoPortFactory(
      sectorId,
      myNick,
      qty,
      source,
      hero.gold || 0,
      keepnetFishCount
    );
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }
    if (source === 'market' && res.goldSpent) {
      onUpdateHero({
        gold: Math.max(0, (hero.gold || 0) - res.goldSpent)
      });
    } else if (source === 'keepnet' && res.loadedQty) {
      const currentKeepnet = Array.isArray(hero.fishingState?.keepnet)
        ? [...hero.fishingState.keepnet]
        : [];
      currentKeepnet.splice(0, res.loadedQty);
      onUpdateHero({
        fishingState: {
          ...(hero.fishingState || {}),
          keepnet: currentKeepnet
        }
      });
    }
    showToast(res.message || '🐟 Сырьё загружено на склад производства!');
    triggerRefresh();
  };

  const handleCraftRelicsNow = (sectorId: string) => {
    const res = craftRelicsAtPortFactoryNow(sectorId, myNick);
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }
    showToast(res.message || '🏺 Реликвия создана из 5 рыбин!');
    triggerRefresh();
  };

  const handleBuyRelicFromFactory = (sectorId: string, qty = 1) => {
    const res = buyRelicsFromPortFactory(sectorId, myNick, qty, hero.gold || 0);
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }
    const newRelicItems: GameItem[] = [];
    for (let i = 0; i < (res.boughtQty || 1); i++) {
      const relicItem = createRelicItem(1);
      relicItem.origin = 'Производство Порта (из рыбы)';
      newRelicItems.push(relicItem);
    }
    onUpdateHero({
      gold: Math.max(0, (hero.gold || 0) - (res.totalCostGold || 0))
    });
    onUpdateInventory([...inventory, ...newRelicItems]);
    showToast(res.message || '🏺 Реликвия куплена и добавлена в рюкзак!');
    triggerRefresh();
  };

  const handleMergeFactories = (sectorId: string) => {
    if (!clan) return;
    const res = mergeClanPortFactories(clan.id, myNick, sectorId);
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }
    showToast(res.message || '🏗️ Производства объединены!');
    triggerRefresh();
  };

  const handleStartAssault7x7 = (sectorId: string, sectorName: string) => {
    if (!clan) {
      showToast('⛔ Сначала вступите в клан, чтобы нападать на объекты производства в Порту!');
      return;
    }
    if (!hasClanBadge) {
      showToast(
        `🛡️ Правило Порта: нападать на производства и отбивать их в боях 7х7 могут только участники клана с выданным «Знаком клана»! Глава клана может выдать его во вкладке «Состав» за ${CLAN_BADGE_COST_GOLD.toLocaleString()} 🪙.`
      );
      return;
    }

    requestConfirm(
      `⚔️ Нападение на объект Порта «${sectorName}» (7х7)`,
      `Начать штурм производства «${sectorName}» в Порту? В боях 7х7 участвуют только реальные игроки со Знаком клана! У членов обоих кланов загорится тревога с кнопкой «Вступить в бой» (лимит: 7 игроков атаки и 7 защиты), а после сбора откроется поле боя на клетках (20 секунд на ход)!`,
      () => {
        const res = declareClanTerritoryWar(clan.id, myNick, sectorId, hero, equipped);
        if (!res.ok) {
          showToast(`❌ ${res.error}`);
          return;
        }
        setSelectedSectorId(sectorId);
        showToast(res.message || `⚔️ Тревога в Порту! Сбор 7х7 на объект «${sectorName}» начат!`);
        triggerRefresh();
      }
    );
  };

  const handleJoinOrUpdateMySlot = (sectorId: string) => {
    if (!clan) {
      showToast('⛔ Вы должны состоять в клане!');
      return;
    }
    const res = joinOrUpdateTerritory7x7Slot(
      sectorId,
      myNick,
      hero,
      equipped,
      clan.id,
      selectedRole,
      selectedTactic
    );
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      triggerRefresh();
      return;
    }
    showToast(res.message || '✅ Вы вступили в бой 7х7!');
    triggerRefresh();
  };

  const handleFillTeamWithClanMates = (sectorId: string) => {
    if (!clan) return;
    const res = fillTerritory7x7WithClanRoster(sectorId, myNick, clan.id);
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }
    showToast(res.message || '✅ Соклановцы призваны на клетки 7х7!');
    triggerRefresh();
  };

  const handleAdvanceOrStartBattle = (sectorId: string) => {
    const res = startOrAdvanceTerritory7x7Battle(sectorId);
    if (!res.ok) {
      showToast(`❌ ${res.error}`);
      return;
    }
    showToast(res.message || '⚔️ Ход 7х7 рассчитан!');
    triggerRefresh();
  };

  const handleManualCellStrike = (
    sectorId: string,
    targetNick: string | undefined,
    actionKind: 'strike' | 'skill_power' | 'skill_shield' | 'skill_heal' = 'strike'
  ) => {
    const res = performTerritory7x7CellStrike(sectorId, myNick, targetNick, actionKind);
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }
    showToast(res.message || '⚔️ Удар по клетке выполнен!');
    triggerRefresh();
  };

  const renderGridCellCard = (
    fighter: ClanTerritory7x7Fighter | undefined,
    cellIndex: number,
    side: 'attacker' | 'defender',
    sectorId: string,
    canManageSide: boolean,
    isCombatPhase: boolean,
    currentRound: number,
    isEnemySideForMe: boolean,
    canIActNow: boolean
  ) => {
    const recommendedRole = cellIndex < 3 ? 'tank' : cellIndex < 6 ? 'dps' : 'support';
    if (!fighter) {
      return (
        <div
          key={`${side}_empty_cell_${cellIndex}`}
          className={`rounded-xl border border-dashed px-3 py-2.5 flex items-center justify-between text-[10px] ${
            side === 'attacker'
              ? 'border-rose-500/30 bg-rose-950/10 text-slate-500'
              : 'border-sky-500/30 bg-sky-950/10 text-slate-500'
          }`}
        >
          <span className="font-bold">
            Клетка {side === 'attacker' ? 'Атаки' : 'Защиты'} #{cellIndex + 1} ({ROLE_CONFIG[recommendedRole].short})
          </span>
          <span className="italic text-[9px]">Пустая клетка (ожидание игрока)</span>
        </div>
      );
    }

    const hpPct = Math.max(0, Math.min(100, Math.round((fighter.hp / Math.max(1, fighter.maxHp)) * 100)));
    const isMe = fighter.nick.toLowerCase() === myNick.toLowerCase();
    const isSelectedTarget =
      isEnemySideForMe &&
      fighter.alive &&
      selectedEnemyNick?.toLowerCase() === fighter.nick.toLowerCase();
    const hasActedThisTurn = isCombatPhase && fighter.actedInRound === currentRound;

    return (
      <div
        key={`${side}_cell_${fighter.nick}_${cellIndex}`}
        onClick={() => {
          if (isEnemySideForMe && fighter.alive) {
            setSelectedEnemyNick(fighter.nick);
          }
        }}
        className={`rounded-xl border p-2.5 transition-all space-y-1.5 ${
          isEnemySideForMe && fighter.alive ? 'cursor-pointer hover:border-amber-400' : ''
        } ${
          !fighter.alive
            ? 'border-red-900/60 bg-red-950/20 opacity-60'
            : isSelectedTarget
            ? 'border-2 border-amber-400 bg-amber-950/40 shadow-[0_0_16px_rgba(251,191,36,0.35)]'
            : isMe
            ? 'border-amber-400/80 bg-amber-950/30 shadow-[0_0_10px_rgba(251,191,36,0.15)]'
            : side === 'attacker'
            ? 'border-rose-500/45 bg-slate-950/90'
            : 'border-sky-500/45 bg-slate-950/90'
        }`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-black ${
                side === 'attacker'
                  ? 'bg-rose-600 text-white'
                  : 'bg-sky-600 text-white'
              }`}
            >
              #{cellIndex + 1}
            </span>
            <CharacterAvatar
              avatar={fighter.avatar || '🧙‍♂️'}
              size="sm"
              className="rounded-lg border border-amber-500/40 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-[10px] font-black text-white truncate flex items-center gap-1 flex-wrap">
                <span>{fighter.nick}</span>
                {isMe && (
                  <span className="rounded bg-amber-500 px-1 py-0.2 text-[8px] font-black text-slate-950">
                    ВЫ
                  </span>
                )}
                {isSelectedTarget && (
                  <span className="rounded bg-rose-600 px-1.5 py-0.2 text-[8px] font-black text-white animate-pulse">
                    🎯 ЦЕЛЬ
                  </span>
                )}
                {hasActedThisTurn && fighter.alive && (
                  <span className="rounded bg-emerald-500/25 border border-emerald-400/50 px-1 py-0.2 text-[8px] font-bold text-emerald-300">
                    ✓ Ход сделан
                  </span>
                )}
              </div>
              <div className="text-[8.5px] text-slate-400">
                [{fighter.clanTag}] Ур.{fighter.lvl} • ⚔️ {fighter.dmg} • ❤️ {fighter.hp}/{fighter.maxHp}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <span
              className={`rounded border px-1.5 py-0.5 text-[8px] font-black ${ROLE_CONFIG[fighter.role].badgeClass}`}
            >
              {ROLE_CONFIG[fighter.role].short}
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[8px] font-bold ${TACTIC_CONFIG[fighter.tactic].badgeClass}`}
            >
              {TACTIC_CONFIG[fighter.tactic].short}
            </span>
          </div>
        </div>

        {/* Полоска HP бойца на клетке */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800 border border-slate-700/70">
          <div
            className={`h-full transition-all ${
              !fighter.alive
                ? 'bg-red-900'
                : hpPct > 50
                ? 'bg-emerald-500'
                : hpPct > 25
                ? 'bg-amber-500'
                : 'bg-rose-500'
            }`}
            style={{ width: `${hpPct}%` }}
          />
        </div>

        {/* В фазе боя: кнопка быстрого выбора/удара по живой клетке врага */}
        {isCombatPhase && isEnemySideForMe && fighter.alive && (
          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedEnemyNick(fighter.nick);
              }}
              className={`rounded-lg px-2 py-1 text-[8.5px] font-black cursor-pointer ${
                isSelectedTarget
                  ? 'bg-amber-400 text-slate-950'
                  : 'border border-amber-500/50 bg-slate-900 text-amber-200 hover:bg-amber-500/20'
              }`}
            >
              {isSelectedTarget ? '🎯 Клетка выбрана' : '🎯 Выбрать клетку'}
            </button>

            {canIActNow && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEnemyNick(fighter.nick);
                  handleManualCellStrike(sectorId, fighter.nick, 'strike');
                }}
                className="rounded-lg bg-gradient-to-r from-rose-600 to-amber-500 px-2.5 py-1 text-[8.5px] font-black uppercase text-white shadow hover:brightness-110 cursor-pointer"
              >
                ⚔️ Ударить клетку #{cellIndex + 1}
              </button>
            )}
          </div>
        )}

        {/* Смена роли и тактики для своего бойца */}
        {(canManageSide || isMe) && fighter.alive && !isCombatPhase && (
          <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5 border-t border-slate-800/80 text-[8px]">
            <div className="flex items-center gap-1">
              {(['tank', 'dps', 'support'] as TerritoryFighterRole[]).map((rKey) => (
                <button
                  key={rKey}
                  type="button"
                  onClick={() => {
                    updateTerritory7x7FighterConfig(sectorId, fighter.nick, side, rKey, fighter.tactic);
                    triggerRefresh();
                  }}
                  className={`rounded px-1.5 py-0.5 font-bold cursor-pointer ${
                    fighter.role === rKey
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {rKey === 'tank' ? '🛡 Танк' : rKey === 'dps' ? '🏹 ДД' : '✨ Сап'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {(['defense', 'frontal', 'focus'] as TerritoryTacticalAction[]).map((tKey) => (
                <button
                  key={tKey}
                  type="button"
                  onClick={() => {
                    updateTerritory7x7FighterConfig(sectorId, fighter.nick, side, fighter.role, tKey);
                    triggerRefresh();
                  }}
                  className={`rounded px-1.5 py-0.5 font-bold cursor-pointer ${
                    fighter.tactic === tKey
                      ? 'bg-rose-500 text-white font-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {tKey === 'defense' ? '🛡 Защита' : tKey === 'frontal' ? '⚔️ В лоб' : '🎯 Фокус'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Шапка: Клановые Территории и Производства Порта + Навык Производство + Знак клана */}
      <div className="rounded-2xl border border-amber-500/50 bg-gradient-to-br from-amber-950/50 via-slate-900 to-slate-950 p-3.5 shadow-lg space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-amber-300 flex items-center gap-1.5 flex-wrap">
              <span>⚓ Территории и Производства Порта (7х7)</span>
              <span className="rounded border border-cyan-400/50 bg-cyan-950/80 px-1.5 py-0.5 text-[8.5px] font-black text-cyan-200">
                🏭 Работа для всех • 5 рыбин = 1 Реликвия
              </span>
              <span className="rounded border border-rose-400/50 bg-rose-950/80 px-1.5 py-0.5 text-[8.5px] font-black text-rose-200">
                🛡️ Бои 7х7 только со Знаком клана
              </span>
            </div>
            <p className="text-[10px] text-slate-300 mt-0.5">
              Все клановые сектора перенесены в <strong>«Порт»</strong>! Устроиться на работу (макс. 2 часа, <strong>+250 🪙/ч и +1 Производство/ч</strong>) может любой игрок, а нападать и защищать объекты в формате 7х7 имеют право только соклановцы с официальным <strong>«Знаком клана»</strong> (выдаётся Главой за 1 000 🪙).
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="rounded-xl border border-cyan-400/50 bg-slate-950/90 px-2.5 py-1.5 text-right">
              <div className="text-[8.5px] text-cyan-300 font-bold uppercase">🏭 Навык «Производство»</div>
              <div className="text-xs font-black text-white">
                Ур. {prodSkill.level}/{prodSkill.maxLevel} • {prodSkill.hours} ч.
                {prodSkill.nextLevelHours ? ` / ${prodSkill.nextLevelHours} ч.` : ' (МАКС)'}
              </div>
              <div className="text-[8.5px] text-emerald-300 font-bold">
                +{prodSkill.bonusStatPoints} свободных статов (+7 за ур.)
              </div>
            </div>
            <div className="rounded-xl border border-amber-400/50 bg-slate-950/90 px-2.5 py-1.5 text-right">
              <div className="text-[8.5px] text-slate-400 font-bold uppercase">🛡️ Ваш Знак клана</div>
              <div className={`text-xs font-black ${hasClanBadge ? 'text-emerald-300' : 'text-rose-300'}`}>
                {hasClanBadge
                  ? `✅ Выдан ${clan ? `[${clan.tag}]` : ''}`
                  : '⛔ Нет знака (1 000 🪙 у Главы)'}
              </div>
              <div className="text-[8.5px] text-amber-300 font-bold">
                Объектов у клана: {myBuffs.ownedSectors.length}/{territories.length}
              </div>
            </div>
          </div>
        </div>

        {/* Общий Рыбный рынок Порта и курс Реликвий */}
        <div className="rounded-xl border border-sky-500/40 bg-sky-950/30 p-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="text-[10px] font-black uppercase text-sky-200 flex items-center gap-2 flex-wrap">
              <span>🐟 Рыбный рынок Порта: <strong>{fishMarket.fishStock} шт.</strong> ({fishMarket.fishPriceGold} 🪙 / рыба)</span>
              <span className="text-amber-300">•</span>
              <span>🏺 Курс Реликвии (4 рыбы): <strong>{relicUnitPrice} 🪙 / шт.</strong></span>
            </div>
            <div className="text-[9px] text-slate-300">
              За 1 час каждое производство потребляет <strong>5 рыбин</strong> со склада (лимит 100 шт.) и выпускает <strong>1 Реликвию</strong> (лимит 70 шт.). Выручка от продажи реликвий и работы цехов идёт в казну клана-владельца!
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSellKeepnetFishToPortMarket}
              className="rounded-xl border border-sky-400/60 bg-sky-600/30 hover:bg-sky-600/45 px-2.5 py-1.5 text-[9.5px] font-black text-sky-100 cursor-pointer transition-all"
            >
              🐟 Сдать улов из садка на рынок ({keepnetFishCount} шт. = +{(keepnetFishCount * fishMarket.fishPriceGold).toLocaleString()} 🪙)
            </button>
          </div>
        </div>

        {/* Активная рабочая смена игрока (если устроен) */}
        {myActiveShift && (
          <div className="rounded-xl border-2 border-emerald-400/70 bg-emerald-950/40 p-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10.5px] font-black text-emerald-200">
                🔨 Вы работаете на объекте: «{myActiveShift.sector.name}» ({myActiveShift.worker.durationHours} ч. смена)
              </div>
              <div className="text-[9.5px] text-slate-200">
                {nowMs >= myActiveShift.worker.endsAt
                  ? `✅ Смена завершена! Заберите +${myActiveShift.worker.durationHours * PORT_WORKER_GOLD_PER_HOUR} 🪙 и +${myActiveShift.worker.durationHours} ч. Производства.`
                  : `⏳ До конца смены: ${formatRemainingTimer(myActiveShift.worker.endsAt, nowMs)} • Награда: +${myActiveShift.worker.durationHours * PORT_WORKER_GOLD_PER_HOUR} 🪙 и +${myActiveShift.worker.durationHours} Производство`}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {nowMs >= myActiveShift.worker.endsAt ? (
                <button
                  type="button"
                  onClick={() => handleClaimWorkShift(myActiveShift.sector.id, false)}
                  className="rounded-xl bg-gradient-to-r from-emerald-400 to-amber-400 px-3 py-1.5 text-[10px] font-black uppercase text-slate-950 shadow animate-pulse cursor-pointer"
                >
                  💰 Забрать оплату (+{myActiveShift.worker.durationHours * PORT_WORKER_GOLD_PER_HOUR} 🪙)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleClaimWorkShift(myActiveShift.sector.id, true)}
                  className="rounded-xl border border-amber-400/70 bg-amber-500/25 hover:bg-amber-500/40 px-3 py-1.5 text-[9.5px] font-black text-amber-200 cursor-pointer"
                >
                  ⚡ Завершить смену и забрать +{myActiveShift.worker.durationHours * PORT_WORKER_GOLD_PER_HOUR} 🪙 (+{myActiveShift.worker.durationHours} ч. Производства)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Пассивные бонусы от захваченных территорий */}
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/25 p-2.5">
          <div className="text-[9.5px] font-black uppercase tracking-wider text-emerald-300 mb-1.5">
            ✨ Активные бонусы и пассивный доход клана в Порту {clan ? `[${clan.tag}]` : ''}:
          </div>
          {!clan ? (
            <div className="text-[10px] text-slate-400">
              Вступите в клан или создайте свой клан, чтобы захватывать сектора и получать пассивные бонусы!
            </div>
          ) : myBuffs.ownedSectors.length === 0 ? (
            <div className="text-[10px] text-slate-400">
              У вашего клана пока нет захваченных территорий. Выберите сектор ниже и нажмите «Атаковать сектор»!
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {myBuffs.ownedSectors.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-950/80 px-2 py-1 text-[10px] font-black text-emerald-200"
                >
                  <span>{s.icon}</span>
                  <span>{s.name}:</span>
                  <span className="text-amber-300">{s.bonusLabel}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* АКТИВНОЕ ЛОББИ СБОРА ИЛИ ПОЛЕ БОЯ НА КЛЕТКАХ 7х7 */}
      {effectiveSelectedSector && effectiveSelectedSector.warStatus === 'war' && effectiveSelectedSector.battle7x7 && (
        <div className="rounded-2xl border-2 border-rose-500 bg-gradient-to-b from-rose-950/60 via-slate-900 to-slate-950 p-3.5 shadow-[0_0_28px_rgba(244,63,94,0.3)] space-y-3">
          {(() => {
            const sec = effectiveSelectedSector;
            const b = sec.battle7x7!;
            const isAttackerClan = Boolean(clan && sec.attackerClanId === clan.id);
            const isDefenderClan = Boolean(clan && (sec.ownerClanId === clan.id || !sec.ownerClanId));
            const isParticipantClan = isAttackerClan || isDefenderClan;
            const mySide: 'attacker' | 'defender' = isAttackerClan ? 'attacker' : 'defender';
            const myRoster = mySide === 'attacker' ? b.attackers : b.defenders;
            const enemyRoster = mySide === 'attacker' ? b.defenders : b.attackers;
            const myQueue =
              mySide === 'attacker' ? b.waitingQueueAttackers || [] : b.waitingQueueDefenders || [];

            const myFighterOnGrid = myRoster.find((f) => f.nick.toLowerCase() === myNick.toLowerCase());
            const isAlreadyJoined = Boolean(myFighterOnGrid);
            const isTeamFullForMe = myRoster.length >= 7 && !isAlreadyJoined;
            const myQueuePos = myQueue.findIndex((q) => q.toLowerCase() === myNick.toLowerCase()) + 1;

            const atkAliveCount = b.attackers.filter((f) => f.alive && f.hp > 0).length;
            const defAliveCount = b.defenders.filter((f) => f.alive && f.hp > 0).length;

            const isCombatPhase = b.phase === 'combat';
            const turnRemainingSec = isCombatPhase
              ? Math.max(0, Math.ceil((b.roundEndsAt - nowMs) / 1000))
              : 20;
            const turnPct = Math.max(0, Math.min(100, Math.round((turnRemainingSec / 20) * 100)));

            const aliveEnemies = enemyRoster.filter((e) => e.alive && e.hp > 0);
            const effectiveTargetEnemy =
              aliveEnemies.find((e) => e.nick.toLowerCase() === (selectedEnemyNick || '').toLowerCase()) ||
              aliveEnemies.find((e) => e.slotIndex === myFighterOnGrid?.slotIndex) ||
              aliveEnemies[0];

            const canIActNow = Boolean(
              isCombatPhase &&
                myFighterOnGrid &&
                myFighterOnGrid.alive &&
                myFighterOnGrid.hp > 0 &&
                myFighterOnGrid.actedInRound !== b.currentRound
            );

            return (
              <>
                {/* Верхняя плашка тревоги и статуса поля боя 7х7 */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/30 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-400 bg-slate-950 text-2xl">
                      {sec.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black uppercase text-white">
                          ⚔️ Поле боя 7х7 на клетках: «{sec.name}»
                        </span>
                        <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[9px] font-black uppercase text-white animate-pulse">
                          {b.phase === 'gathering'
                            ? `⏳ Сбор в лобби (10 мин): ${formatShortMinSec(b.gatheringEndsAt, nowMs)}`
                            : `🔥 ХОД ${b.currentRound} • ТАЙМЕР ХОДА: ${turnRemainingSec} СЕК / 20 СЕК`}
                        </span>
                      </div>
                      <div className="text-[10px] text-amber-200 mt-0.5">
                        Команда Атаки: <strong>[{sec.attackerClanTag}] {sec.attackerClanName} ({b.attackers.length}/7)</strong> vs Команда Защиты:{' '}
                        <strong>
                          {sec.ownerClanId
                            ? `[${sec.ownerClanTag}] ${sec.ownerClanName} (${b.defenders.length}/7)`
                            : `Нейтральная территория (${b.defenders.length}/7)`}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {clan && isParticipantClan && b.phase === 'gathering' && (
                      <button
                        type="button"
                        onClick={() => handleFillTeamWithClanMates(sec.id)}
                        className="rounded-xl border border-amber-400/70 bg-amber-500/20 hover:bg-amber-500/30 px-2.5 py-1.5 text-[9.5px] font-black text-amber-200 cursor-pointer"
                      >
                        👥 Призвать соклановцев в строй
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAdvanceOrStartBattle(sec.id)}
                      className="rounded-xl bg-gradient-to-r from-rose-600 via-orange-500 to-amber-500 px-3 py-1.5 text-[10px] font-black uppercase text-slate-950 shadow hover:brightness-110 cursor-pointer"
                    >
                      {b.phase === 'gathering'
                        ? '⚔️ Открыть тактический бой на клетках!'
                        : `⏱ Завершить 20-сек ход (Раунд ${b.currentRound})`}
                    </button>
                  </div>
                </div>

                {/* ЯРКАЯ ПЛАШКА ВСТУПЛЕНИЯ В БОЙ (Во время сбора 7х7) */}
                {clan && isParticipantClan && b.phase === 'gathering' && (
                  <div className="rounded-xl border border-amber-500/40 bg-slate-950/90 p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[10px] font-black uppercase text-amber-300">
                        🎯 Занять клетку на поле боя 7х7 ({isAttackerClan ? '⚔️ Линия Атаки' : '🛡️ Линия Защиты'} — занято {myRoster.length}/7 клеток):
                      </div>
                      <span className="text-[9px] text-emerald-300 font-bold">
                        Только живые игроки (ботов нет)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="text-[9px] font-bold text-slate-400">1. Ваша боевая роль:</div>
                        <div className="grid grid-cols-3 gap-1">
                          {(['tank', 'dps', 'support'] as TerritoryFighterRole[]).map((rKey) => (
                            <button
                              key={rKey}
                              type="button"
                              onClick={() => setSelectedRole(rKey)}
                              className={`rounded-lg border px-2 py-1.5 text-[9px] font-black transition-all cursor-pointer ${
                                selectedRole === rKey
                                  ? 'border-amber-400 bg-amber-500/25 text-amber-200 shadow'
                                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                              }`}
                            >
                              {ROLE_CONFIG[rKey].short}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[9px] font-bold text-slate-400">2. Боевая стойка на клетке:</div>
                        <div className="grid grid-cols-3 gap-1">
                          {(['defense', 'frontal', 'focus'] as TerritoryTacticalAction[]).map((tKey) => (
                            <button
                              key={tKey}
                              type="button"
                              onClick={() => setSelectedTactic(tKey)}
                              className={`rounded-lg border px-2 py-1.5 text-[9px] font-black transition-all cursor-pointer ${
                                selectedTactic === tKey
                                  ? 'border-rose-400 bg-rose-500/25 text-rose-200 shadow'
                                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                              }`}
                            >
                              {tKey === 'defense'
                                ? '🛡 Защита'
                                : tKey === 'frontal'
                                ? '⚔️ В лоб'
                                : '🎯 Фокус'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Кнопка «Вступить в бой» или «Мест нет (В очереди)» */}
                    <button
                      type="button"
                      onClick={() => handleJoinOrUpdateMySlot(sec.id)}
                      className={`w-full rounded-xl py-2.5 text-xs font-black uppercase shadow transition-all cursor-pointer ${
                        isTeamFullForMe
                          ? 'border border-amber-500/50 bg-slate-800 text-amber-300 hover:bg-slate-700'
                          : isAlreadyJoined
                          ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 text-slate-950 hover:brightness-110'
                          : 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 text-slate-950 hover:brightness-110 animate-pulse'
                      }`}
                    >
                      {isTeamFullForMe
                        ? `⛔ Мест нет (В очереди${myQueuePos > 0 ? ` #${myQueuePos}` : ''}) — занято 7/7 клеток`
                        : isAlreadyJoined
                        ? `✅ Вы в бою (Клетка #${(myFighterOnGrid?.slotIndex ?? 0) + 1}/7) — Обновить роль и стойку`
                        : `⚔️ Вступить в бой (${myRoster.length}/7)`}
                    </button>

                    {myQueue.length > 0 && (
                      <div className="text-[9px] text-amber-300">
                        ⏳ В очереди ожидания вашей команды: {myQueue.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {/* ТАКТИЧЕСКАЯ ПАНЕЛЬ ХОДА (20 СЕКУНД НА ВЫБОР КЛЕТКИ И УДАР) */}
                {isCombatPhase && (
                  <div className="rounded-2xl border-2 border-amber-400/80 bg-slate-950/95 p-3 space-y-2.5 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-black uppercase text-amber-300 flex items-center gap-2">
                          <span>⏱ Тайминговый ход #{b.currentRound} (20 секунд на удар)</span>
                          <span className="rounded bg-rose-600 px-2 py-0.5 font-mono text-[10px] text-white">
                            Осталось: {turnRemainingSec} сек
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-300 mt-0.5">
                          Выберите живую клетку противника напротив и нажмите <strong>«⚔️ Ударить»</strong> или примените навык. Если не успеть за 20 секунд — сработает авто-ход!
                        </div>
                      </div>

                      {effectiveTargetEnemy && (
                        <div className="rounded-xl border border-rose-500/60 bg-rose-950/50 px-3 py-1.5 text-right">
                          <div className="text-[8.5px] uppercase font-bold text-rose-300">Выбранная клетка цели</div>
                          <div className="text-xs font-black text-white">
                            🎯 Клетка #{(effectiveTargetEnemy.slotIndex ?? 0) + 1}: {effectiveTargetEnemy.nick} ({effectiveTargetEnemy.hp} HP)
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Полоса таймера 20 секунд */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-700">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 transition-all duration-300"
                        style={{ width: `${turnPct}%` }}
                      />
                    </div>

                    {/* Кнопки удара и навыков на 20-секундный ход */}
                    {myFighterOnGrid ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <button
                          type="button"
                          disabled={!canIActNow}
                          onClick={() =>
                            handleManualCellStrike(sec.id, effectiveTargetEnemy?.nick, 'strike')
                          }
                          className={`rounded-xl py-2 px-3 text-[10.5px] font-black uppercase transition-all cursor-pointer shadow ${
                            canIActNow
                              ? 'bg-gradient-to-r from-rose-600 via-red-500 to-amber-500 text-white hover:brightness-110 active:scale-95'
                              : 'border border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          ⚔️ Ударить по клетке
                        </button>
                        <button
                          type="button"
                          disabled={!canIActNow}
                          onClick={() =>
                            handleManualCellStrike(sec.id, effectiveTargetEnemy?.nick, 'skill_power')
                          }
                          className={`rounded-xl py-2 px-3 text-[10.5px] font-black uppercase transition-all cursor-pointer shadow ${
                            canIActNow
                              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 text-slate-950 hover:brightness-110 active:scale-95'
                              : 'border border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          💥 Навык: Мощный пробив
                        </button>
                        <button
                          type="button"
                          disabled={!canIActNow}
                          onClick={() =>
                            handleManualCellStrike(sec.id, effectiveTargetEnemy?.nick, 'skill_shield')
                          }
                          className={`rounded-xl py-2 px-3 text-[10.5px] font-black uppercase transition-all cursor-pointer shadow ${
                            canIActNow
                              ? 'bg-gradient-to-r from-sky-600 to-cyan-500 text-white hover:brightness-110 active:scale-95'
                              : 'border border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          🛡 Навык: Щит (-50% урона)
                        </button>
                        <button
                          type="button"
                          disabled={!canIActNow}
                          onClick={() =>
                            handleManualCellStrike(sec.id, effectiveTargetEnemy?.nick, 'skill_heal')
                          }
                          className={`rounded-xl py-2 px-3 text-[10.5px] font-black uppercase transition-all cursor-pointer shadow ${
                            canIActNow
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:brightness-110 active:scale-95'
                              : 'border border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          ✨ Навык: Перевязка + Удар
                        </button>
                      </div>
                    ) : (
                      <div className="text-[10px] text-amber-300 font-bold">
                        👀 Вы наблюдаете за тактическим полем боя 7х7. Ходы выполняют игроки, занявшие клетки.
                      </div>
                    )}
                  </div>
                )}

                {/* ПОЛЕ БОЯ НА КЛЕТКАХ (ФОРМАТ 7 НА 7 — 7 КЛЕТОК АТАКИ НАПРОТИВ 7 КЛЕТОК ЗАЩИТЫ) */}
                <div className="rounded-2xl border border-slate-700/80 bg-slate-950/90 p-3 space-y-2.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-950/30 px-3 py-1.5">
                      <span className="text-[10.5px] font-black uppercase text-rose-300">
                        ⚔️ 7 Клеток Атаки [{sec.attackerClanTag}]
                      </span>
                      <span className="text-[9.5px] font-bold text-emerald-300">
                        Живых: {atkAliveCount}/{b.attackers.length} (Лимит: 7)
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-sky-500/40 bg-sky-950/30 px-3 py-1.5">
                      <span className="text-[10.5px] font-black uppercase text-sky-300">
                        🛡️ 7 Клеток Защиты {sec.ownerClanTag ? `[${sec.ownerClanTag}]` : ''}
                      </span>
                      <span className="text-[9.5px] font-bold text-emerald-300">
                        Живых: {defAliveCount}/{b.defenders.length} (Лимит: 7)
                      </span>
                    </div>
                  </div>

                  {/* 7 линий клеток друг напротив друга */}
                  <div className="space-y-2">
                    {Array.from({ length: 7 }).map((_, cellIdx) => (
                      <div
                        key={`grid_row_${cellIdx}`}
                        className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-slate-800/90 bg-slate-900/60 p-1.5"
                      >
                        {renderGridCellCard(
                          b.attackers[cellIdx],
                          cellIdx,
                          'attacker',
                          sec.id,
                          Boolean(isAttackerClan && isLeaderOrOfficer),
                          isCombatPhase,
                          b.currentRound,
                          mySide === 'defender',
                          canIActNow
                        )}

                        <div className="flex items-center justify-center px-1.5 py-0.5">
                          <span className="rounded-lg border border-amber-500/40 bg-slate-950 px-2 py-1 text-[9px] font-black text-amber-300">
                            Линия #{cellIdx + 1} ⚔️
                          </span>
                        </div>

                        {renderGridCellCard(
                          b.defenders[cellIdx],
                          cellIdx,
                          'defender',
                          sec.id,
                          Boolean(isDefenderClan && isLeaderOrOfficer),
                          isCombatPhase,
                          b.currentRound,
                          mySide === 'attacker',
                          canIActNow
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Пошаговый лог раундов боя 7х7 на клетках */}
                {b.roundLogs.length > 0 && (
                  <div className="rounded-xl border border-amber-500/40 bg-slate-950/95 p-2.5 space-y-2">
                    <div className="text-[10px] font-black uppercase text-amber-300">
                      📜 Журнал ходов на поле боя 7х7:
                    </div>
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {[...b.roundLogs].reverse().map((rLog) => (
                        <div
                          key={rLog.roundNumber}
                          className="rounded-lg border border-slate-800 bg-slate-900/90 p-2 space-y-1"
                        >
                          <div className="flex items-center justify-between text-[9.5px] font-black text-amber-200 border-b border-slate-800 pb-1">
                            <span>⚔️ ХОД #{rLog.roundNumber} (20 сек)</span>
                            <span>
                              Живых на поле: Атака {rLog.attackersAlive} vs Защита {rLog.defendersAlive}
                            </span>
                          </div>
                          <div className="space-y-0.5 text-[9px] text-slate-300">
                            {rLog.events.map((ev, eIdx) => (
                              <div key={eIdx} className="leading-snug">
                                {ev}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Сетка объектов производства в Порту (6 территорий) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {territories.map((sector) => {
          const isOwnedByUs = Boolean(clan && sector.ownerClanId === clan.id);
          const isAtWar = sector.warStatus === 'war';
          const isShielded = Boolean(
            sector.ownerClanId && sector.protectionUntil && nowMs < sector.protectionUntil && !isAtWar
          );
          const b7x7 = sector.battle7x7;
          const prod = sector.production || {
            factoryType: 'solar_relic_foundry',
            factoryCategoryLabel: 'Производство Реликвий',
            isMerged: false,
            mergedWithSectorId: null,
            fishStock: 35,
            maxFishStock: 100,
            relicStock: 8,
            maxRelicStock: 70,
            lastCraftTickAt: nowMs,
            workers: [],
            passiveGoldEarned: 0,
            totalRelicsCrafted: 8
          };
          const maxWorkers = prod.isMerged ? PORT_MERGED_MAX_WORKERS : PORT_BASE_MAX_WORKERS;
          const activeWorkers = (prod.workers || []).filter((w) => !w.claimed);
          const myWorkerHere = activeWorkers.find(
            (w) => w.nick.trim().toLowerCase() === myNick.trim().toLowerCase()
          );
          const chosenShiftHours: 1 | 2 = shiftDurationBySector[sector.id] || 2;

          const mySideInSector: 'attacker' | 'defender' =
            clan && sector.attackerClanId === clan.id ? 'attacker' : 'defender';
          const sectorRoster =
            mySideInSector === 'attacker' ? b7x7?.attackers || [] : b7x7?.defenders || [];
          const sectorAlreadyIn = sectorRoster.some(
            (f) => f.nick.toLowerCase() === myNick.toLowerCase()
          );
          const sectorIsFull = sectorRoster.length >= 7 && !sectorAlreadyIn;

          const fishPct = Math.min(100, Math.round((prod.fishStock / Math.max(1, prod.maxFishStock)) * 100));
          const relicPct = Math.min(100, Math.round((prod.relicStock / Math.max(1, prod.maxRelicStock)) * 100));

          return (
            <div
              key={sector.id}
              className={`rounded-2xl border p-3 transition-all flex flex-col justify-between gap-2.5 ${
                isAtWar
                  ? 'border-rose-500/80 bg-gradient-to-b from-rose-950/40 via-slate-900 to-slate-950 shadow-[0_0_18px_rgba(244,63,94,0.25)]'
                  : isOwnedByUs
                  ? 'border-emerald-500/70 bg-gradient-to-b from-emerald-950/35 via-slate-900 to-slate-950'
                  : 'border-slate-800 bg-slate-900/90 hover:border-amber-500/40'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/50 bg-slate-950 text-2xl shadow-inner">
                      {sector.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white truncate flex items-center gap-1.5 flex-wrap">
                        <span>{sector.name}</span>
                        {prod.isMerged && (
                          <span className="rounded bg-purple-600/80 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
                            🏗️ Объединён (x2)
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-extrabold text-amber-300 mt-0.5">
                        ⚓ Зона: Порт • 🎁 Бафф клана: {sector.bonusLabel}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {isAtWar ? (
                      <span className="inline-block rounded-lg border border-rose-400/70 bg-rose-600/30 px-2 py-0.5 text-[9px] font-black uppercase text-rose-200 animate-pulse">
                        {b7x7?.phase === 'combat'
                          ? `⚔️ Бой 7х7 (Ход ${b7x7.currentRound})`
                          : '🚨 Тревога: Сбор 7х7'}
                      </span>
                    ) : sector.ownerClanId ? (
                      <span
                        className={`inline-block rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase ${
                          isOwnedByUs
                            ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                            : 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                        }`}
                      >
                        {isOwnedByUs ? '🛡️ Объект вашего клана' : `👑 Клан [${sector.ownerClanTag}]`}
                      </span>
                    ) : (
                      <span className="inline-block rounded-lg border border-slate-600 bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-slate-300">
                        🏳️ Свободный Порт
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[9.5px] text-slate-400 leading-snug">{sector.description}</p>

                {/* Официальный Знак и название контролирующего клана + пассивная прибыль */}
                <div className="rounded-xl border border-amber-500/35 bg-slate-950/90 px-2.5 py-2 flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                  <span className="text-slate-400 font-semibold">Контролирующий клан и Знак:</span>
                  {sector.ownerClanId ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-amber-400 bg-amber-950 shadow">
                        <ItemIcon
                          icon={sector.ownerClanEmblem || '🛡️'}
                          name={sector.ownerClanName || ''}
                          className="w-4 h-4 text-sm"
                          imgClassName="w-4 h-4 object-contain"
                        />
                      </span>
                      <span className="font-black text-amber-300">
                        🛡️ Знак [{sector.ownerClanTag}] {sector.ownerClanName}
                      </span>
                      {(prod.passiveGoldEarned || 0) > 0 && (
                        <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.5 text-[8.5px] font-bold text-emerald-300">
                          Прибыль в казну: +{(prod.passiveGoldEarned || 0).toLocaleString()} 🪙
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-300 font-black">🏳️ Нейтральная территория Порта</span>
                  )}
                </div>

                {/* БЛОК 1: РАБОТА НА ПРОИЗВОДСТВЕ (ДЛЯ ВСЕХ ИГРОКОВ: ДО 3/6 ЧЕЛ, МАКС 2 ЧАСА, +250 ЗОЛОТА/Ч И +1 ПРОИЗВОДСТВО/Ч) */}
                <div className="rounded-xl border border-cyan-500/35 bg-cyan-950/20 p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="text-[10px] font-black uppercase text-cyan-200 flex items-center gap-1">
                      <span>🔨 Работа на производстве (Для всех)</span>
                    </div>
                    <span className="rounded-md border border-cyan-400/50 bg-slate-950 px-2 py-0.5 text-[9px] font-black text-cyan-300">
                      Работников: {activeWorkers.length} / {maxWorkers} чел.
                    </span>
                  </div>

                  <div className="text-[9px] text-slate-300">
                    Таймер смены: <strong>макс. 2 часа</strong> • Награда за каждый час: <strong className="text-amber-300">+250 🪙</strong> и <strong className="text-cyan-300">+1 к навыку «Производство»</strong> (+7 статов за уровень).
                  </div>

                  {/* Список активных работников */}
                  {activeWorkers.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {activeWorkers.map((w, idx) => {
                        const isDone = nowMs >= w.endsAt;
                        return (
                          <span
                            key={`${w.nick}_${idx}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-slate-950/90 px-2 py-0.5 text-[8.5px] text-slate-200"
                          >
                            <span>{w.avatar || '🔨'}</span>
                            <strong className="text-white">{w.nick}</strong>
                            <span className="text-cyan-300">({w.durationHours}ч)</span>
                            <span className="font-mono text-amber-300">
                              {isDone ? '✅ Готово' : formatShortMinSec(w.endsAt, nowMs)}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {myWorkerHere ? (
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-cyan-500/20">
                      <span className="text-[9px] font-bold text-emerald-300">
                        {nowMs >= myWorkerHere.endsAt
                          ? `✅ Ваша смена (${myWorkerHere.durationHours} ч.) окончена!`
                          : `⏳ Вы в смене (${myWorkerHere.durationHours} ч.): ${formatRemainingTimer(myWorkerHere.endsAt, nowMs)}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleClaimWorkShift(sector.id, true)}
                        className="rounded-lg bg-gradient-to-r from-emerald-400 to-amber-400 px-2.5 py-1 text-[9px] font-black uppercase text-slate-950 shadow cursor-pointer hover:brightness-110"
                      >
                        💰 Забрать +{myWorkerHere.durationHours * PORT_WORKER_GOLD_PER_HOUR} 🪙 и +{myWorkerHere.durationHours} Производство
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-cyan-500/20">
                      <div className="flex items-center gap-1">
                        {([1, 2] as (1 | 2)[]).map((hrs) => (
                          <button
                            key={hrs}
                            type="button"
                            onClick={() =>
                              setShiftDurationBySector((prev) => ({ ...prev, [sector.id]: hrs }))
                            }
                            className={`rounded-lg border px-2 py-1 text-[8.5px] font-black cursor-pointer ${
                              chosenShiftHours === hrs
                                ? 'border-cyan-400 bg-cyan-500/30 text-white'
                                : 'border-slate-700 bg-slate-900 text-slate-400'
                            }`}
                          >
                            ⏱ {hrs} ч. (+{hrs * PORT_WORKER_GOLD_PER_HOUR} 🪙 / +{hrs} Произв.)
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={activeWorkers.length >= maxWorkers || Boolean(myActiveShift)}
                        onClick={() => handleStartWorkShift(sector.id, chosenShiftHours)}
                        className={`rounded-lg px-2.5 py-1 text-[9px] font-black uppercase transition-all cursor-pointer ${
                          activeWorkers.length >= maxWorkers || Boolean(myActiveShift)
                            ? 'border border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 shadow hover:brightness-110'
                        }`}
                      >
                        {activeWorkers.length >= maxWorkers
                          ? `Мест нет (${activeWorkers.length}/${maxWorkers})`
                          : myActiveShift
                          ? 'Вы уже на смене'
                          : `🔨 Работать (${chosenShiftHours} ч.)`}
                      </button>
                    </div>
                  )}

                  {/* Расширение объектов (объединение 2 производств клана -> 6 рабочих мест и двойной склад) */}
                  {isOwnedByUs && !prod.isMerged && myBuffs.ownedSectors.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => handleMergeFactories(sector.id)}
                      className="w-full rounded-lg border border-purple-400/60 bg-purple-950/50 hover:bg-purple-900/60 py-1 px-2 text-[9px] font-black text-purple-200 cursor-pointer"
                    >
                      🏗️ Объединить 2 объекта клана (Расширить до 6 работников и x2 склада)
                    </button>
                  )}
                </div>

                {/* БЛОК 2: ЭКОНОМИКА ПРОИЗВОДСТВА (РЫБА -> РЕЛИКВИИ, ЛИМИТ 100 РЫБЫ / 70 РЕЛИКВИЙ, 5 РЫБ = 1 РЕЛИКВИЯ, ЦЕНА = 4 РЫБЫ) */}
                <div className="rounded-xl border border-amber-500/35 bg-amber-950/15 p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-1 text-[9.5px]">
                    <span className="font-black uppercase text-amber-300">
                      🏺 Цех Реликвий (5 рыбин/ч = 1 Реликвия)
                    </span>
                    <span className="font-bold text-emerald-300">
                      Цена: 1 Реликвия = 4 рыбы ({relicUnitPrice} 🪙)
                    </span>
                  </div>

                  {/* Шкалы склада рыбы (макс 100 / 200) и готовых реликвий (макс 70 / 140) */}
                  <div className="grid grid-cols-2 gap-2 text-[9px]">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-1.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sky-300 font-bold">🐟 Склад рыбы:</span>
                        <span className="font-black text-white">
                          {prod.fishStock} / {prod.maxFishStock} шт.
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full bg-sky-500 transition-all"
                          style={{ width: `${fishPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-1.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-amber-300 font-bold">🏺 Склад реликвий:</span>
                        <span className="font-black text-white">
                          {prod.relicStock} / {prod.maxRelicStock} шт.
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full bg-amber-400 transition-all"
                          style={{ width: `${relicPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Кнопки завоза рыбы, крафта и покупки готовых реликвий */}
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleLoadFishToFactory(sector.id, 'market', 5)}
                      className="rounded-lg border border-sky-500/50 bg-sky-950/60 hover:bg-sky-900/70 py-1 px-2 text-[8.5px] font-black text-sky-200 cursor-pointer"
                    >
                      📦 Закупить 5 рыб с рынка ({5 * fishMarket.fishPriceGold} 🪙)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleLoadFishToFactory(
                          sector.id,
                          'keepnet',
                          Math.min(10, Math.max(1, keepnetFishCount))
                        )
                      }
                      className="rounded-lg border border-teal-500/50 bg-teal-950/60 hover:bg-teal-900/70 py-1 px-2 text-[8.5px] font-black text-teal-200 cursor-pointer"
                    >
                      🐟 Из садка на склад ({keepnetFishCount} шт.)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCraftRelicsNow(sector.id)}
                      className="rounded-lg border border-amber-500/50 bg-amber-950/60 hover:bg-amber-900/70 py-1 px-2 text-[8.5px] font-black text-amber-200 cursor-pointer"
                    >
                      ⚙️ Переработать {PORT_FISH_PER_RELIC} рыб → 1 Реликвия
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBuyRelicFromFactory(sector.id, 1)}
                      className="rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 py-1 px-2 text-[8.5px] font-black text-slate-950 shadow hover:brightness-110 cursor-pointer"
                    >
                      🏺 Купить Реликвию ({relicUnitPrice} 🪙)
                    </button>
                  </div>
                </div>

                {!isAtWar && (
                  <div
                    className={`rounded-xl border px-2.5 py-1.5 flex items-center justify-between text-[9.5px] ${
                      isShielded
                        ? 'border-sky-500/40 bg-sky-950/30 text-sky-200'
                        : 'border-amber-500/35 bg-amber-950/20 text-amber-200'
                    }`}
                  >
                    <span className="font-bold">
                      {isShielded ? '🛡️ Цикл удержания (2 часа):' : '🔓 Война за объект (7х7):'}
                    </span>
                    <span className="font-mono font-black">
                      {isShielded && sector.protectionUntil
                        ? `Щит: ${formatRemainingTimer(sector.protectionUntil, nowMs)}`
                        : 'Доступен со Знаком клана'}
                    </span>
                  </div>
                )}

                {isAtWar && b7x7 && (
                  <div className="rounded-xl border border-rose-500/50 bg-rose-950/35 p-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[9.5px]">
                      <span className="font-black text-rose-200">
                        {b7x7.phase === 'gathering'
                          ? '⏳ Сбор игроков 7х7 (10 мин):'
                          : `⏱ Ход ${b7x7.currentRound} (20 сек):`}
                      </span>
                      <span className="font-mono font-black text-amber-300">
                        {b7x7.phase === 'gathering'
                          ? formatShortMinSec(b7x7.gatheringEndsAt, nowMs)
                          : formatShortMinSec(b7x7.roundEndsAt, nowMs)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-200">
                      <span>
                        ⚔️ Клетки Атаки [{sector.attackerClanTag}]:{' '}
                        <strong className="text-rose-300">{b7x7.attackers.length}/7</strong>
                      </span>
                      <span>
                        🛡️ Клетки Защиты:{' '}
                        <strong className="text-sky-300">{b7x7.defenders.length}/7</strong>
                      </span>
                    </div>
                  </div>
                )}

                {sector.lastBattleReport && !isAtWar && (
                  <button
                    type="button"
                    onClick={() =>
                      setViewingReportSectorId(
                        viewingReportSectorId === sector.id ? null : sector.id
                      )
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 hover:border-amber-500/50 py-1 px-2 text-[9px] font-bold text-amber-200 cursor-pointer"
                  >
                    📜 {viewingReportSectorId === sector.id ? 'Скрыть отчёт боя 7х7' : 'Посмотреть отчёт последней битвы 7х7'}
                  </button>
                )}

                {viewingReportSectorId === sector.id && sector.lastBattleReport && (
                  <div className="rounded-xl border border-amber-500/40 bg-slate-950 p-2 space-y-1.5 text-[9px]">
                    <div className="font-black text-amber-300">
                      {sector.lastBattleReport.summaryText}
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {sector.lastBattleReport.roundLogs.map((rLog) => (
                        <div key={rLog.roundNumber} className="border-t border-slate-800 pt-1">
                          <div className="font-black text-rose-300">
                            Ход {rLog.roundNumber} (Атака: {rLog.attackersAlive}/7 • Защита: {rLog.defendersAlive}/7)
                          </div>
                          {rLog.events.slice(0, 6).map((ev, i) => (
                            <div key={i} className="text-slate-300">
                              {ev}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Кнопка действия для захвата / защиты объекта Порта (Только со Знаком клана) */}
              <div className="pt-1">
                {isAtWar ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSectorId(sector.id);
                      if (b7x7?.phase === 'gathering' && !sectorAlreadyIn) {
                        handleJoinOrUpdateMySlot(sector.id);
                      }
                    }}
                    className={`w-full rounded-xl py-2 px-3 text-[10.5px] font-black uppercase tracking-wide shadow transition-all cursor-pointer ${
                      sectorIsFull && b7x7?.phase === 'gathering'
                        ? 'border border-amber-500/50 bg-slate-800 text-amber-300 hover:bg-slate-700'
                        : 'bg-gradient-to-r from-rose-600 via-red-500 to-amber-500 text-white hover:brightness-110'
                    }`}
                  >
                    {b7x7?.phase === 'combat'
                      ? `⚔️ Открыть поле боя 7х7 (Ход ${b7x7.currentRound})`
                      : sectorIsFull
                      ? '⛔ Мест нет (В очереди)'
                      : sectorAlreadyIn
                      ? `✅ Вы в бою (${sectorRoster.length}/7) — Открыть лобби`
                      : `⚔️ Вступить в бой со Знаком клана (${sectorRoster.length}/7)`}
                  </button>
                ) : isOwnedByUs ? (
                  <div className="w-full rounded-xl border border-emerald-500/40 bg-emerald-950/50 py-2 text-center text-[10px] font-black text-emerald-300">
                    ✅ Под контролем вашего клана [{clan?.tag}] ({sector.bonusLabel})
                  </div>
                ) : isShielded && sector.protectionUntil ? (
                  <div className="w-full rounded-xl border border-sky-500/40 bg-sky-950/40 py-2 text-center text-[10px] font-bold text-sky-300">
                    🛡️ Удерживается ещё {formatRemainingTimer(sector.protectionUntil, nowMs)}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStartAssault7x7(sector.id, sector.name)}
                    className={`w-full rounded-xl py-2 px-3 text-[10.5px] font-black uppercase tracking-wide transition-all cursor-pointer shadow ${
                      hasClanBadge
                        ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-slate-950 hover:brightness-110 active:scale-95'
                        : 'border border-amber-500/40 bg-slate-800 text-amber-200 hover:bg-slate-700'
                    }`}
                  >
                    {hasClanBadge
                      ? '⚔️ Атаковать объект Порта (Сбор 7х7)'
                      : '🛡️ Атаковать объект (Нужен Знак клана — 1 000 🪙)'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 2. ВКЛАДКА «ЕЖЕДНЕВНЫЙ КЛАНОВЫЙ БОСС (РЕЙД)»
// ============================================================================
export const ClanRaidBossView: React.FC<ClanSubViewsCommonProps> = ({
  clan,
  myNick,
  hero,
  inventory,
  onUpdateHero,
  onUpdateInventory,
  showToast,
  triggerRefresh
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!clan) return null;
  const boss = getClanRaidBoss(clan);
  if (!boss) return null;

  const hpPct = Math.max(0, Math.min(100, (boss.currentHp / Math.max(1, boss.maxHp)) * 100));
  const participantsList = Object.values(boss.participants || {}).sort(
    (a, b) => b.damageDealt - a.damageDealt
  );
  const myPartKey = Object.keys(boss.participants || {}).find(
    (k) => k.toLowerCase() === myNick.toLowerCase()
  );
  const myParticipant = myPartKey ? boss.participants[myPartKey] : null;
  const myDamage = myParticipant?.damageDealt || 0;
  const canClaimReward =
    boss.isDefeated && myDamage > 0 && !myParticipant?.rewardClaimed;

  const energyCost = 10;
  const estimatedDirectStrikeDmg = Math.max(
    25000,
    Math.round(((hero.str || 1) * 15 + (hero.bonusDmg || 0) + (hero.gearDmg || 0) + (hero.level || 1) * 120) * 180)
  );

  const handleDirectAttackBoss = () => {
    if (boss.isDefeated || boss.currentHp <= 0) {
      showToast('🏆 Босс уже повержен сегодня! Заберите свою награду или дождитесь обновления суток.');
      return;
    }
    if ((hero.energy || 0) < energyCost) {
      showToast(`⚡ Недостаточно энергии для удара по Рейд-Боссу! Требуется ${energyCost}⚡ (у вас: ${hero.energy || 0}⚡).`);
      return;
    }

    const isCrit = Math.random() < 0.25;
    const finalStrike = Math.round(
      estimatedDirectStrikeDmg * (0.9 + Math.random() * 0.25) * (isCrit ? 1.5 : 1)
    );

    const res = attackClanRaidBoss(clan.id, myNick, finalStrike, hero.avatar);
    if (!res.ok) {
      showToast(`❌ ${res.error}`);
      return;
    }

    onUpdateHero({
      energy: Math.max(0, (hero.energy || 0) - energyCost)
    });

    if (res.justDefeated) {
      showToast(
        `🎉 ПОБЕДА! Вы нанесли решающий удар (${(res.damageDealt || 0).toLocaleString('ru-RU')} урона) и сокрушили Рейд-Босса «${boss.bossName}»!`
      );
    } else {
      showToast(
        `⚔️ ${isCrit ? '🔥 КРИТ! ' : ''}Вы нанесли ${(res.damageDealt || 0).toLocaleString('ru-RU')} урона боссу «${boss.bossName}» (-${energyCost}⚡)!`
      );
    }
    triggerRefresh();
  };

  const handleClaimReward = () => {
    const res = claimClanRaidBossReward(clan.id, myNick);
    if (!res.ok) {
      showToast(`❌ ${res.error}`);
      return;
    }

    const addG = res.rewardGold || 0;
    const addC = res.rewardCrystals || 0;
    onUpdateHero({
      gold: (hero.gold || 0) + addG,
      crystals: (hero.crystals || 0) + addC
    });
    if (res.chestItem) {
      onUpdateInventory([res.chestItem, ...inventory]);
    }

    showToast(
      `🎁 Награда Рейда получена: +${addG.toLocaleString('ru-RU')} 🪙, +${addC} 💎 и трофей «${res.chestItem?.name}» в сумку!`
    );
    triggerRefresh();
  };

  const resetTimerStr = formatRemainingTimer(getNextMidnightMs(nowMs), nowMs);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-2 border-rose-500/60 bg-gradient-to-b from-[#230b14] via-slate-900 to-slate-950 p-3.5 shadow-[0_0_25px_rgba(244,63,94,0.2)] space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-rose-400 bg-slate-950 text-4xl shadow-[0_0_15px_rgba(244,63,94,0.4)]">
              {boss.bossIcon}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[8.5px] font-black uppercase text-white">
                  Ежедневный Рейд-Босс • Ур. {boss.bossLevel}
                </span>
                <span className="text-[9.5px] font-mono font-bold text-amber-300">
                  ⏳ Обновление рейда через: {resetTimerStr}
                </span>
              </div>
              <div className="text-base font-black text-white mt-0.5">{boss.bossName}</div>
              <p className="text-[10px] text-slate-300">{boss.bossDescription}</p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/40 bg-slate-950/90 px-3 py-1.5 text-right">
            <div className="text-[8.5px] uppercase font-bold text-slate-400">Ваш личный урон</div>
            <div className="text-sm font-black text-amber-300 tabular-nums">
              {myDamage.toLocaleString('ru-RU')} ⚔️
            </div>
            <div className="text-[8.5px] text-slate-400">
              Атак: {myParticipant?.attacksCount || 0}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-black">
            <span className="text-rose-300 flex items-center gap-1">
              <span>❤️ Здоровье Босса синдиката:</span>
              {boss.isDefeated && (
                <span className="rounded bg-emerald-500 text-slate-950 px-1.5 py-0.5 text-[9px] font-black uppercase">
                  ПОВЕРЖЕН!
                </span>
              )}
            </span>
            <span className="font-mono text-white tabular-nums">
              {boss.currentHp.toLocaleString('ru-RU')} / {boss.maxHp.toLocaleString('ru-RU')} HP ({hpPct.toFixed(1)}%)
            </span>
          </div>
          <div className="relative h-5 w-full overflow-hidden rounded-xl bg-slate-950 border-2 border-rose-500/60 shadow-inner">
            <div
              className={`h-full transition-all duration-300 ${
                boss.isDefeated
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-rose-700 via-red-500 to-orange-400'
              }`}
              style={{ width: `${hpPct}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow">
              {boss.isDefeated
                ? '🏆 БОСС ПОВЕРЖЕН — НАГРАДЫ РАЗБЛОКИРОВАНЫ!'
                : `${boss.currentHp.toLocaleString('ru-RU')} HP`}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="text-[9.5px] text-slate-300 space-y-0.5">
            <div className="font-black text-amber-300">
              ⚡ Как наносится урон по Клановому Боссу:
            </div>
            <div>
              • Автоматически: <strong>1 спин в Слотах/Рулетке</strong> или <strong>1 пойманная рыба</strong> наносит мощный удар по боссу!
            </div>
            <div>
              • Прямой штурм: нажмите кнопку справа, чтобы атаковать босса лично за <strong>{energyCost}⚡ энергии</strong> (~{estimatedDirectStrikeDmg.toLocaleString('ru-RU')} урона).
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {!boss.isDefeated ? (
              <button
                type="button"
                onClick={handleDirectAttackBoss}
                className="rounded-xl bg-gradient-to-r from-rose-600 via-red-500 to-amber-500 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_15px_rgba(244,63,94,0.5)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                ⚔️ Атаковать босса (-{energyCost}⚡)
              </button>
            ) : canClaimReward ? (
              <button
                type="button"
                onClick={handleClaimReward}
                className="rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.6)] hover:brightness-110 active:scale-95 animate-pulse cursor-pointer"
              >
                🎁 Забрать награду (+{boss.rewardGold.toLocaleString('ru-RU')} 🪙, +{boss.rewardCrystals} 💎 + Сундук)
              </button>
            ) : (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-center text-[10px] font-black text-emerald-300">
                {myParticipant?.rewardClaimed
                  ? '✅ Вы уже получили награду за этот рейд'
                  : '⏳ Ожидание следующего возрождения босса'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="text-xs font-black uppercase text-amber-300">
            🏆 Рейтинг урона участников рейда ({participantsList.length})
          </div>
          <div className="text-[9.5px] font-bold text-emerald-300">
            Награда каждому участнику: +{boss.rewardGold.toLocaleString('ru-RU')} 🪙 • +{boss.rewardCrystals} 💎 • 🏺 {boss.rewardChestName}
          </div>
        </div>

        {participantsList.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center text-[10.5px] text-slate-400">
            Сегодня ещё никто из соклановцев не атаковал босса. Нажмите «⚔️ Атаковать босса», порыбачьте или покрутите слоты!
          </div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {participantsList.map((part, idx) => {
              const dmgSharePct = Math.min(
                100,
                ((part.damageDealt / Math.max(1, boss.maxHp)) * 100)
              ).toFixed(1);
              return (
                <div
                  key={`${part.nick}_${idx}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] font-black text-amber-400 w-5">
                      #{idx + 1}
                    </span>
                    <CharacterAvatar avatar={part.avatar || '🧙‍♂️'} size="sm" />
                    <div className="min-w-0">
                      <div className="font-black text-white truncate">{part.nick}</div>
                      <div className="text-[9px] text-slate-400">
                        Ударов / действий: {part.attacksCount} • Вклад: {dmgSharePct}%
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-rose-300">
                      {part.damageDealt.toLocaleString('ru-RU')} ⚔️
                    </div>
                    {part.rewardClaimed && (
                      <span className="text-[8.5px] font-bold text-emerald-400">
                        ✅ Награда получена
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 3. ВКЛАДКА «КЛАНОВЫЕ ЗАДАНИЯ (ОБЩИЕ ЦЕЛИ)»
// ============================================================================
export const ClanQuestsView: React.FC<ClanSubViewsCommonProps> = ({
  clan,
  myNick,
  hero,
  onUpdateHero,
  showToast,
  triggerRefresh
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!clan) return null;
  const questsState = getClanDailyQuests(clan);
  if (!questsState) return null;

  const resetTimerStr = formatRemainingTimer(getNextMidnightMs(nowMs), nowMs);

  const handleClaimQuest = (questId: string) => {
    const res = claimClanQuestReward(clan.id, myNick, questId);
    if (!res.ok) {
      showToast(`❌ ${res.error}`);
      return;
    }

    const addG = res.rewardPlayerGold || 0;
    const addC = res.rewardPlayerCrystals || 0;
    onUpdateHero({
      gold: (hero.gold || 0) + addG,
      crystals: (hero.crystals || 0) + addC
    });

    const treasuryNote =
      (res.rewardTreasuryGold || 0) > 0 || (res.rewardTreasuryCrystals || 0) > 0
        ? ` | В казну клана: +${(res.rewardTreasuryGold || 0).toLocaleString('ru-RU')} 🪙 и +${res.rewardTreasuryCrystals || 0} 💎`
        : '';

    showToast(
      `🎁 Открыт «${res.chestName}»! Вам начислено: +${addG.toLocaleString('ru-RU')} 🪙 и +${addC} 💎${treasuryNote}!`
    );
    triggerRefresh();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-cyan-500/50 bg-gradient-to-r from-cyan-950/50 via-slate-900 to-slate-950 p-3.5 shadow-lg flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-black uppercase tracking-wide text-cyan-300">
            📋 Ежедневные Клановые Задания (Общие цели)
          </div>
          <p className="text-[10px] text-slate-300 mt-0.5">
            Выполняйте челленджи всем коллективом! Каждая пойманная рыба, спин в слотах, взнос в казну и убитый монстр идут в общий зачёт клана.
          </p>
        </div>
        <div className="rounded-xl border border-cyan-400/40 bg-slate-950/90 px-3 py-1.5 text-right">
          <div className="text-[8.5px] uppercase font-bold text-slate-400">Обновление целей через</div>
          <div className="text-xs font-mono font-black text-amber-300">{resetTimerStr}</div>
        </div>
      </div>

      <div className="space-y-2.5">
        {questsState.quests.map((q) => {
          const pct = Math.min(
            100,
            Math.round((q.currentProgress / Math.max(1, q.targetValue)) * 100)
          );
          const isReady = q.currentProgress >= q.targetValue;
          const isClaimedByMe = (q.claimedByNicks || []).some(
            (n) => n.toLowerCase() === myNick.toLowerCase()
          );
          const myContrib = q.contributions?.[myNick] || 0;

          return (
            <div
              key={q.questId}
              className={`rounded-2xl border p-3.5 transition-all space-y-2.5 ${
                isClaimedByMe
                  ? 'border-emerald-500/40 bg-slate-900/75'
                  : isReady
                  ? 'border-amber-400 bg-gradient-to-r from-amber-950/45 via-slate-900 to-emerald-950/35 shadow-[0_0_16px_rgba(245,158,11,0.2)]'
                  : 'border-slate-800 bg-slate-900/90'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/50 bg-slate-950 text-2xl shadow-inner">
                    {q.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-white">{q.title}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[8.5px] font-black uppercase ${
                          isClaimedByMe
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : isReady
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {isClaimedByMe
                          ? '✅ Награда получена'
                          : isReady
                          ? '🎉 Выполнено (Готово)'
                          : '⏳ В процессе'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-300 mt-0.5">{q.description}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/40 bg-slate-950/90 px-2.5 py-1.5 text-right text-[9.5px]">
                  <div className="font-black text-amber-300">🎁 {q.chestName}</div>
                  <div className="text-slate-300">
                    В казну: <strong className="text-yellow-300">+{q.rewardTreasuryGold.toLocaleString('ru-RU')} 🪙</strong>,{' '}
                    <strong className="text-cyan-300">+{q.rewardTreasuryCrystals} 💎</strong>
                  </div>
                  <div className="text-emerald-300 font-bold">
                    Лично: +{q.rewardPlayerGold.toLocaleString('ru-RU')} 🪙 и +{q.rewardPlayerCrystals} 💎
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-300">
                    Общий прогресс клана ({pct}%){myContrib > 0 ? ` • Ваш вклад: ${myContrib.toLocaleString('ru-RU')}` : ''}
                  </span>
                  <span className="font-mono font-black text-amber-300 tabular-nums">
                    {q.currentProgress.toLocaleString('ru-RU')} / {q.targetValue.toLocaleString('ru-RU')} {q.unitLabel}
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-700">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isClaimedByMe
                        ? 'bg-emerald-500'
                        : isReady
                        ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400'
                        : 'bg-gradient-to-r from-cyan-600 to-blue-400'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[9px] text-slate-400">
                  {q.treasuryRewardClaimed
                    ? '🏦 Бонус в казну клана за сегодня уже начислен'
                    : '🏦 При первом получении сундук также пополняет общак клана'}
                </span>

                {isClaimedByMe ? (
                  <span className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-3 py-1.5 text-[10px] font-black text-emerald-300">
                    ✅ Сундук получен
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={!isReady}
                    onClick={() => handleClaimQuest(q.questId)}
                    className={`rounded-xl px-4 py-2 text-[10.5px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                      isReady
                        ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] hover:brightness-110 active:scale-95 animate-pulse'
                        : 'border border-slate-800 bg-slate-950 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isReady
                      ? '🎁 Забрать бонусный сундук'
                      : `🔒 Осталось ${(q.targetValue - q.currentProgress).toLocaleString('ru-RU')} ${q.unitLabel}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 4. ВКЛАДКА «ТУРНИР ЧЕМПИОНОВ (3 ПОНЯТНЫХ БЛОКА: ТЕКУЩИЙ ТУРНИР, СЕТКА ПЛЕЙ-ОФФ, НАГРАДЫ)»
// ============================================================================
export const ClanChampionsArenaView: React.FC<ClanSubViewsCommonProps> = ({
  clan,
  myNick,
  hero,
  equipped,
  onUpdateHero,
  showToast,
  triggerRefresh
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [selectedMatchLog, setSelectedMatchLog] = useState<ClanArenaMatchLog | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const arena = getClanArenaState();
  const bracket = ensureArenaPlayoffBracket(arena, myNick);
  const myStats = calculateFighterPowerFromGear(hero, equipped);
  const myFighter = arena.fighters.find((f) => f.nick.toLowerCase() === myNick.toLowerCase());

  // Находим текущий матч игрока в сетке Плей-офф (1/4 финала -> Полуфинал -> Финал)
  const myCurrentBracketMatch = bracket.find(
    (m) =>
      m.status !== 'completed' &&
      (m.fighter1?.nick.toLowerCase() === myNick.toLowerCase() ||
        m.fighter2?.nick.toLowerCase() === myNick.toLowerCase())
  );

  const myLastBracketMatch = [...bracket]
    .reverse()
    .find(
      (m) =>
        m.fighter1?.nick.toLowerCase() === myNick.toLowerCase() ||
        m.fighter2?.nick.toLowerCase() === myNick.toLowerCase()
    );

  const myOpponentInBracket = myCurrentBracketMatch
    ? myCurrentBracketMatch.fighter1?.nick.toLowerCase() === myNick.toLowerCase()
      ? myCurrentBracketMatch.fighter2
      : myCurrentBracketMatch.fighter1
    : null;

  const isRegisteredInBracket = Boolean(myCurrentBracketMatch || myLastBracketMatch);
  const isTournamentChampion =
    arena.tournamentChampionNick?.toLowerCase() === myNick.toLowerCase();

  const quarterMatches = bracket
    .filter((m) => m.stage === 'quarter')
    .sort((a, b) => a.matchIndex - b.matchIndex);
  const semiMatches = bracket
    .filter((m) => m.stage === 'semi')
    .sort((a, b) => a.matchIndex - b.matchIndex);
  const finalMatch = bracket.find((m) => m.stage === 'final') || null;

  const nextMatchCountdown = formatShortMinSec(
    Math.max(nowMs + 60000, arena.nextTournamentAt || nowMs + 600000),
    nowMs
  );

  const handleRegisterFighter = () => {
    if (!clan) {
      showToast('❌ Сначала вступите в клан или создайте свой для участия в турнире!');
      return;
    }
    const res = registerPlayerForClanArena(myNick, hero, equipped, clan);
    if (res.ok) {
      showToast(
        res.isUpdate
          ? `✅ Ваша заявка в сетке Плей-офф обновлена!`
          : `🏆 Вы зарегистрированы в сетку Турнира (1/4 финала)!`
      );
      triggerRefresh();
    }
  };

  const handleResetBracket = () => {
    resetClanArenaPlayoffBracket(myNick);
    if (clan) {
      registerPlayerForClanArena(myNick, hero, equipped, clan);
    }
    setSelectedMatchLog(null);
    showToast('🔄 Сформирована новая турнирная сетка Плей-офф (1/4 финала → Полуфинал → Финал)!');
    triggerRefresh();
  };

  const handleFightMatch = (opponentNick?: string) => {
    if (!clan) {
      showToast('❌ Сначала вступите в клан или создайте свой для участия в турнире!');
      return;
    }
    const res = fightInClanArenaTournament(myNick, hero, equipped, clan, opponentNick);
    if (!res.ok) {
      showToast(`❌ ${res.error}`);
      return;
    }

    if (res.matchLog) {
      setSelectedMatchLog(res.matchLog);
    }

    const nextGold = (hero.gold || 0) + (res.awardedGold || 0);
    const nextCrystals = (hero.crystals || 0) + (res.awardedCrystals || 0);
    const nextTitle = res.awardedTitle || hero.arenaChampionTitle || null;

    onUpdateHero({
      gold: nextGold,
      crystals: nextCrystals,
      arenaChampionTitle: nextTitle,
      arenaPoints: res.newArenaPoints
    });

    if (res.isWin) {
      showToast(
        `🏆 Победа в стадии «${res.stageLabel || 'Плей-офф'}»! +${(res.awardedGold || 0).toLocaleString('ru-RU')} 🪙, +${res.awardedCrystals} 💎${
          res.awardedTitle ? ` и титул «${res.awardedTitle}»!` : '!'
        }`
      );
    } else {
      showToast(
        `⚔️ Матч стадии «${res.stageLabel || 'Плей-офф'}» завершён! Вы получили +${(res.awardedGold || 0).toLocaleString('ru-RU')} 🪙 и +${res.awardedCrystals} 💎 за участие.`
      );
    }
    triggerRefresh();
  };

  const renderBracketMatchCard = (m: ClanArenaPlayoffMatch, idxLabel: string) => {
    const f1 = m.fighter1;
    const f2 = m.fighter2;
    const isMyMatch =
      f1?.nick.toLowerCase() === myNick.toLowerCase() ||
      f2?.nick.toLowerCase() === myNick.toLowerCase();
    const isCompleted = m.status === 'completed';

    const renderSlot = (f: typeof f1, slotNum: 1 | 2) => {
      if (!f) {
        return (
          <div className="flex items-center justify-between rounded-lg bg-slate-900/70 px-2.5 py-1.5 text-[9.5px] text-slate-500 italic">
            <span>Ожидание победителя...</span>
            <span>—</span>
          </div>
        );
      }
      const isWinner = isCompleted && m.winnerNick?.toLowerCase() === f.nick.toLowerCase();
      const isMe = f.nick.toLowerCase() === myNick.toLowerCase();

      return (
        <div
          key={`${m.id}_s_${slotNum}`}
          className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[10px] border ${
            isWinner
              ? 'border-emerald-400/70 bg-emerald-950/50 text-emerald-200 font-black'
              : isMe
              ? 'border-amber-400/70 bg-amber-950/35 text-amber-200 font-black'
              : 'border-slate-800 bg-slate-950/90 text-slate-200 font-bold'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs shrink-0">{f.avatar || '⚔️'}</span>
            <span className="truncate">
              [{f.clanTag}] {f.nick}
            </span>
            {isMe && (
              <span className="rounded bg-amber-500 px-1 py-0.2 text-[8px] font-black text-slate-950">
                ВЫ
              </span>
            )}
          </div>
          <span className="shrink-0 text-[9px]">
            {isWinner ? '🏆 Прошёл' : isCompleted ? '✕ Выбыл' : `Ур.${f.lvl}`}
          </span>
        </div>
      );
    };

    return (
      <div
        key={m.id}
        className={`rounded-xl border p-2.5 space-y-1.5 transition-all ${
          isMyMatch
            ? 'border-amber-400/80 bg-gradient-to-b from-amber-950/30 to-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.18)]'
            : 'border-slate-800 bg-slate-900/90'
        }`}
      >
        <div className="flex items-center justify-between text-[9px] font-black uppercase">
          <span className={isMyMatch ? 'text-amber-300' : 'text-slate-400'}>{idxLabel}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[8px] ${
              isCompleted
                ? 'bg-emerald-500/20 text-emerald-300'
                : m.status === 'ready'
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {isCompleted ? 'Завершён' : m.status === 'ready' ? 'Готов к бою' : 'Ожидание'}
          </span>
        </div>
        <div className="space-y-1">
          {renderSlot(f1, 1)}
          <div className="text-center text-[8px] font-black uppercase text-slate-500">VS</div>
          {renderSlot(f2, 2)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* ШАПКА ТУРНИРА С ИНФОРМАЦИОННОЙ КНОПКОЙ (?) */}
      <div className="rounded-2xl border-2 border-purple-500/60 bg-gradient-to-br from-purple-950/50 via-slate-900 to-slate-950 p-3.5 shadow-lg space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-400/60 bg-slate-950 text-2xl">
              🏆
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-wide text-purple-300 flex items-center gap-2">
                <span>Клановый Турнир Чемпионов (Плей-офф)</span>
              </div>
              <p className="text-[10px] text-slate-300">
                Пройдите 3 стадии на выбывание: <strong>1/4 финала → Полуфинал → Финал</strong> и завоюйте титул Чемпиона!
              </p>
            </div>
          </div>

          {/* Кнопка (?) — понятная справка о турнире */}
          <button
            type="button"
            onClick={() => setShowHelpModal((v) => !v)}
            title="Как устроен турнир?"
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition-all cursor-pointer shrink-0 ${
              showHelpModal
                ? 'border-amber-400 bg-amber-500 text-slate-950 shadow'
                : 'border-purple-400/70 bg-purple-950/80 text-purple-200 hover:bg-purple-900'
            }`}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 font-black">
              ?
            </span>
            <span>Правила</span>
          </button>
        </div>

        {/* Выпадающая понятная подсказка по кнопке (?) */}
        {showHelpModal && (
          <div className="rounded-xl border border-amber-400/60 bg-slate-950/95 p-3 space-y-2 text-[10.5px] text-slate-200">
            <div className="font-black text-amber-300 uppercase">
              ℹ️ Как работает Турнир Чемпионов (простыми словами):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2">
                <div className="font-black text-emerald-300">1. Как подать заявку?</div>
                <p className="text-[9.5px] text-slate-300 mt-0.5">
                  Нажмите кнопку <strong>«📝 Подать заявку в турнир»</strong> в блоке ниже. Ваш персонаж и клан сразу попадут в сетку 1/4 финала.
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2">
                <div className="font-black text-sky-300">2. Во сколько проходят бои?</div>
                <p className="text-[9.5px] text-slate-300 mt-0.5">
                  Раунды Плей-офф идут каждые 10–15 минут (таймер показан в блоке «Текущий турнир»), либо вы можете начать свой бой стадии сразу кнопкой <strong>«⚔️ Начать бой стадии»</strong>.
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2">
                <div className="font-black text-amber-300">3. Что получает победитель?</div>
                <p className="text-[9.5px] text-slate-300 mt-0.5">
                  За каждую стадию выдаются золото и кристаллы, а победитель Финала получает <strong>постоянный титул Чемпиона</strong> над ником и +120 престижа клана!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* БЛОК 1: «ТЕКУЩИЙ ТУРНИР» (Статус, таймер следующего боя, кто соперник) */}
      {/* ==================================================================== */}
      <div className="rounded-2xl border border-amber-500/50 bg-slate-900/95 p-3.5 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
            <span>1️⃣ Текущий турнир — Ваш статус и следующий бой</span>
          </div>
          {hero.arenaChampionTitle && (
            <span className="rounded-lg border border-amber-400/70 bg-amber-950/80 px-2.5 py-0.5 text-[9.5px] font-black text-yellow-300">
              Активный титул: {hero.arenaChampionTitle}
            </span>
          )}
        </div>

        {/* 3 понятные плашки: Статус регистрации, Время до боя, Кто соперник */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Карточка 1: Статус игрока и клана */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3 space-y-1">
            <div className="text-[9px] font-bold uppercase text-slate-400">Статус участия</div>
            {isTournamentChampion ? (
              <div className="text-xs font-black text-yellow-300">
                🏆 Чемпион Турнира!
              </div>
            ) : myCurrentBracketMatch ? (
              <div className="text-xs font-black text-emerald-300">
                ✅ Зарегистрирован ({myCurrentBracketMatch.stageLabel})
              </div>
            ) : isRegisteredInBracket ? (
              <div className="text-xs font-black text-rose-300">
                ⚔️ Выбыл в прошлой стадии (Начните новый турнир)
              </div>
            ) : (
              <div className="text-xs font-black text-amber-300">
                ⚪ Ожидание вашей заявки
              </div>
            )}
            <div className="text-[9.5px] text-slate-400">
              Клан: <strong className="text-white">{clan ? `[${clan.tag}] ${clan.name}` : 'Без клана'}</strong> • Мощь: <strong className="text-amber-300">{myStats.powerScore.toLocaleString('ru-RU')}</strong>
            </div>
          </div>

          {/* Карточка 2: Когда начнётся следующий бой */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3 space-y-1">
            <div className="text-[9px] font-bold uppercase text-slate-400">Следующий бой по расписанию</div>
            <div className="text-sm font-mono font-black text-sky-300">
              ⏱ Через {nextMatchCountdown}
            </div>
            <div className="text-[9.5px] text-slate-400">
              Текущая стадия: <strong className="text-white">{myCurrentBracketMatch ? myCurrentBracketMatch.stageLabel : '1/4 финала'}</strong>
            </div>
          </div>

          {/* Карточка 3: Кто ваш соперник */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3 space-y-1">
            <div className="text-[9px] font-bold uppercase text-slate-400">Ваш соперник по сетке</div>
            {myOpponentInBracket ? (
              <div className="flex items-center gap-2">
                <CharacterAvatar avatar={myOpponentInBracket.avatar} size="sm" />
                <div className="min-w-0">
                  <div className="text-xs font-black text-rose-300 truncate">
                    [{myOpponentInBracket.clanTag}] {myOpponentInBracket.nick}
                  </div>
                  <div className="text-[9px] text-slate-400">
                    Ур. {myOpponentInBracket.lvl} • Мощь: {myOpponentInBracket.powerScore.toLocaleString('ru-RU')}
                  </div>
                </div>
              </div>
            ) : isTournamentChampion ? (
              <div className="text-xs font-black text-emerald-300">
                🎉 Все соперники повержены!
              </div>
            ) : (
              <div className="text-xs font-bold text-slate-400">
                Подайте заявку, чтобы узнать пару 1/4 финала
              </div>
            )}
          </div>
        </div>

        {/* Кнопки управления текущим турниром */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRegisterFighter}
              className="rounded-xl border border-purple-400/70 bg-purple-950/80 hover:bg-purple-900 px-3.5 py-2 text-[10.5px] font-black text-purple-200 transition-all cursor-pointer"
            >
              {myFighter ? '✅ Обновить заявку в сетке' : '📝 Подать заявку в турнир'}
            </button>
            <button
              type="button"
              onClick={handleResetBracket}
              className="rounded-xl border border-slate-700 bg-slate-950 hover:border-amber-400/50 px-3 py-2 text-[10px] font-bold text-slate-300 transition-all cursor-pointer"
            >
              🔄 Новая сетка Плей-офф
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleFightMatch(myOpponentInBracket?.nick)}
            className="rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-5 py-2 text-xs font-black uppercase text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            {myCurrentBracketMatch
              ? `⚔️ Начать бой (${myCurrentBracketMatch.stageLabel})`
              : '⚔️ Начать турнирный бой (1/4 финала)'}
          </button>
        </div>

        {/* Короткий итог последнего боя (если только что сыгран) */}
        {selectedMatchLog && (
          <div className="rounded-xl border border-amber-400/60 bg-slate-950 p-2.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-black text-amber-300">
              <span>
                📜 Итог матча ({selectedMatchLog.roundLabel}): [{selectedMatchLog.fighter1ClanTag}] {selectedMatchLog.fighter1Nick} vs [{selectedMatchLog.fighter2ClanTag}] {selectedMatchLog.fighter2Nick}
              </span>
              <button
                type="button"
                onClick={() => setSelectedMatchLog(null)}
                className="text-[9px] text-slate-400 hover:text-white cursor-pointer"
              >
                ✕ Скрыть
              </button>
            </div>
            <div className="space-y-0.5 text-[9.5px] text-slate-200">
              {selectedMatchLog.combatRounds.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* БЛОК 2: «СЕТКА МАТЧЕЙ (ПЛЕЙ-ОФФ: 1/4 ФИНАЛА → ПОЛУФИНАЛ → ФИНАЛ)»    */}
      {/* ==================================================================== */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-3.5 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="text-xs font-black uppercase text-purple-300">
            2️⃣ Сетка матчей (Плей-офф)
          </div>
          {arena.tournamentChampionNick && (
            <span className="rounded-lg bg-gradient-to-r from-amber-500 to-yellow-300 px-2.5 py-0.5 text-[10px] font-black text-slate-950">
              👑 Победитель Кубка: [{arena.tournamentChampionClanTag}] {arena.tournamentChampionNick}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
          {/* Колонка 1: 1/4 финала */}
          <div className="space-y-2">
            <div className="rounded-xl border border-sky-500/40 bg-sky-950/30 px-3 py-1.5 text-center text-[10.5px] font-black uppercase text-sky-300">
              ⚔️ 1/4 финала (Четвертьфинал)
            </div>
            <div className="space-y-2">
              {quarterMatches.map((m, idx) =>
                renderBracketMatchCard(m, `Пара 1/4 #${idx + 1}`)
              )}
            </div>
          </div>

          {/* Колонка 2: Полуфинал */}
          <div className="space-y-2 flex flex-col justify-between">
            <div className="rounded-xl border border-purple-500/40 bg-purple-950/30 px-3 py-1.5 text-center text-[10.5px] font-black uppercase text-purple-300">
              🔥 Полуфинал (1/2)
            </div>
            <div className="space-y-3 my-auto">
              {semiMatches.map((m, idx) =>
                renderBracketMatchCard(m, `Полуфинал #${idx + 1}`)
              )}
            </div>
            <div className="text-center text-[9px] text-slate-500">
              Победители пар 1/4 выходят в 1/2 финала
            </div>
          </div>

          {/* Колонка 3: Финал */}
          <div className="space-y-2 flex flex-col justify-between">
            <div className="rounded-xl border border-amber-400/60 bg-amber-950/40 px-3 py-1.5 text-center text-[10.5px] font-black uppercase text-amber-300">
              🏆 Гранд-Финал
            </div>
            <div className="my-auto space-y-2">
              {finalMatch && renderBracketMatchCard(finalMatch, 'Главный Финал Турнира')}
              {arena.tournamentChampionNick && (
                <div className="rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-950/80 via-yellow-950/60 to-amber-950/80 p-3 text-center space-y-1 shadow-lg">
                  <div className="text-[9px] font-black uppercase text-amber-300">
                    🏆 Чемпион Плей-офф
                  </div>
                  <div className="text-sm font-black text-white">
                    [{arena.tournamentChampionClanTag}] {arena.tournamentChampionNick}
                  </div>
                </div>
              )}
            </div>
            <div className="text-center text-[9px] text-slate-500">
              Победитель Финала забирает главный титул и кубок
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* БЛОК 3: «НАГРАДЫ ТУРНИРА»                                            */}
      {/* ==================================================================== */}
      <div className="rounded-2xl border border-emerald-500/40 bg-slate-900/95 p-3.5 shadow-lg space-y-2.5">
        <div className="text-xs font-black uppercase text-emerald-300 border-b border-slate-800 pb-2">
          3️⃣ Награды Турнира Чемпионов
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-amber-400/60 bg-gradient-to-b from-amber-950/40 to-slate-950 p-3 space-y-1">
            <div className="text-xs font-black text-amber-300">🥇 1-е место (Победа в Финале)</div>
            <div className="text-[10px] font-bold text-yellow-200">
              Титул: «🏆 Чемпион Клановой Арены»
            </div>
            <div className="text-[10px] text-slate-300">
              • <strong>+25 000 🪙</strong> золота и <strong>+100 💎</strong> кристаллов
            </div>
            <div className="text-[9.5px] text-emerald-300 font-bold">
              • +120 🏆 очков престижа в рейтинг клана
            </div>
          </div>

          <div className="rounded-xl border border-purple-400/50 bg-gradient-to-b from-purple-950/35 to-slate-950 p-3 space-y-1">
            <div className="text-xs font-black text-purple-300">🥈 Победа в Полуфинале (1/2)</div>
            <div className="text-[10px] font-bold text-purple-200">
              Титул: «👑 Гранд-Гладиатор Синдиката» (за серию побед)
            </div>
            <div className="text-[10px] text-slate-300">
              • <strong>+14 000 🪙</strong> золота и <strong>+55 💎</strong> кристаллов
            </div>
            <div className="text-[9.5px] text-emerald-300 font-bold">
              • +75 🏆 очков престижа в рейтинг клана
            </div>
          </div>

          <div className="rounded-xl border border-sky-400/50 bg-gradient-to-b from-sky-950/35 to-slate-950 p-3 space-y-1">
            <div className="text-xs font-black text-sky-300">🥉 Победа в 1/4 финала</div>
            <div className="text-[10px] font-bold text-sky-200">
              Путёвка в Полуфинал Плей-офф
            </div>
            <div className="text-[10px] text-slate-300">
              • <strong>+8 000 🪙</strong> золота и <strong>+35 💎</strong> кристаллов
            </div>
            <div className="text-[9.5px] text-emerald-300 font-bold">
              • +50 🏆 очков престижа в рейтинг клана
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

