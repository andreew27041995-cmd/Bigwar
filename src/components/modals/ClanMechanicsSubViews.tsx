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
  ClanTerritory7x7Fighter,
  PortTerminalResourceKey
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
  loadDualInputIntoPortFactory,
  craftRelicsAtPortFactoryNow,
  supplyIntermediateResourceToLinkedFactory,
  managePortFacilityBalance,
  buyRelicsFromPortFactory,
  sellResourceToPortFactory,
  startPortFactoryWorkShift,
  claimPortFactoryWorkShift,
  getPlayerActivePortWorkShift,
  mergeClanPortFactories,
  getAllClans,
  ESTATE_CREATION_COST_CRYSTALS,
  PORT_ESTATE_TEMPLATES,
  createPortRealEstateObject,
  updatePortEstateOwnerSettings,
  delegatePortEstateClanControl,
  DEFAULT_PORT_ESTATE_OWNER_NICK,
  PORT_BASE_MAX_WORKERS,
  PORT_MERGED_MAX_WORKERS,
  PORT_WORKER_GOLD_PER_HOUR,
  PORT_FISH_PER_RELIC,
  CLAN_BADGE_COST_GOLD,
  PORT_ISLAND_GRID_SIZE,
  DEFAULT_PORT_ISLAND_POS,
  PORT_FOOT_STEP_SECONDS,
  normalizePortIslandCoord,
  getPortIslandCellMeta,
  calculatePortSectorTravelSeconds,
  getBalancedDefaultPricesForSector,
  calculatePlayerPortCargo,
  getPortResourceWeight,
  orderMealAtPortTavern,
  repairPortRealEstateObject,
  togglePortEstateRepairOrder,
  getBuyersForFactoryProduct,
  getPlayerClanRankAndPts,
  getPlayerClan,
  areClansAllied,
  getPortFactoryWorkStatus,
  calculatePortFactoryDetailedEconomics,
  fulfillPharaohStateOrder,
  autoSupplyFactoryFromTerminal
} from '../../utils/clanStorage';
import { getProductionSkillInfo, STAT_POINTS_PER_PRODUCTION_LEVEL } from '../../utils/gameData';
import { createRelicItem, isTransportItem } from '../../utils/shopConfig';
import { ItemIcon } from '../ItemIcon';
import CharacterAvatar from '../CharacterAvatar';
import { ClanRankEpaulette, ClanBadgeMini } from '../ClanRankEpaulette';

interface ClanSubViewsCommonProps {
  clan?: Clan;
  myNick: string;
  hero: HeroState;
  inventory: GameItem[];
  equipped?: EquippedGear;
  initialSectorId?: string | null;
  onUpdateHero: (updated: Partial<HeroState>) => void;
  onUpdateInventory: (updated: GameItem[]) => void;
  onOpenProfileEstate?: () => void;
  onSwitchToTerminal?: () => void;
  onSwitchToShipyard?: () => void;
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
// 1. ВКЛАДКА «КАРТА ТЕРРИТОРИЙ / ЖИВЫЕ БОИ 7х7 НА СЕТКЕ» (ТОЧНЫЙ МАКЕТ GWARS)
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
  onOpenProfileEstate,
  onSwitchToTerminal,
  onSwitchToShipyard,
  showToast,
  triggerRefresh,
  requestConfirm
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [, setLocalTick] = useState(0);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(initialSectorId || null);
  const [inspectingSectorId, setInspectingSectorId] = useState<string | null>(initialSectorId || null);
  const [showOwnerSettingsForId, setShowOwnerSettingsForId] = useState<string | null>(null);
  const [buyQtyBySector, setBuyQtyBySector] = useState<Record<string, string>>({});
  const [sellInput1QtyBySector, setSellInput1QtyBySector] = useState<Record<string, string>>({});
  const [sellInput2QtyBySector, setSellInput2QtyBySector] = useState<Record<string, string>>({});
  const [sellInput3QtyBySector, setSellInput3QtyBySector] = useState<Record<string, string>>({});
  const [sellPowerQtyBySector, setSellPowerQtyBySector] = useState<Record<string, string>>({});
  const [customCashAmountBySector, setCustomCashAmountBySector] = useState<Record<string, string>>({});
  const [openProtocolsBySector, setOpenProtocolsBySector] = useState<
    Record<string, { buyers?: boolean; work?: boolean; deals?: boolean }>
  >({});
  const [selectedRole, setSelectedRole] = useState<TerritoryFighterRole>('tank');
  const [selectedTactic, setSelectedTactic] = useState<TerritoryTacticalAction>('frontal');
  const [selectedEnemyNick, setSelectedEnemyNick] = useState<string | null>(null);
  const [showCreateEstateModal, setShowCreateEstateModal] = useState(false);
  const [selectedEstateTemplateId, setSelectedEstateTemplateId] = useState<string>(
    PORT_ESTATE_TEMPLATES[0]?.id || 'tpl_fish_pier'
  );
  const [customEstateName, setCustomEstateName] = useState('');
  const [ownerSettingsBySector, setOwnerSettingsBySector] = useState<
    Record<
      string,
      {
        rawBuyPriceGold: string;
        input2BuyPriceGold: string;
        input3BuyPriceGold: string;
        productSellPriceGold: string;
        workerWageGold: string;
        clanQuery: string;
      }
    >
  >({});
  const [islandScopeMode, setIslandScopeMode] = useState<'current_sector' | 'all_sectors'>('current_sector');
  const [previewCell, setPreviewCell] = useState<{ x: number; y: number } | null>(null);
  const [buildingCategoryFilter, setBuildingCategoryFilter] = useState<
    'all' | 'extraction' | 'raw_processing' | 'dual_manufactory' | 'power_plant' | 'tavern' | 'warehouses' | 'broken'
  >('all');

  const effectiveMyNick = (myNick || hero.nick || 'Игрок').trim();
  const cargoInfo = calculatePlayerPortCargo(hero, inventory, equipped);
  const playerStamina = Math.max(0, Math.min(100, Math.floor(Number(hero.portStamina ?? 100))));

  const { x: curIslandX, y: curIslandY } = normalizePortIslandCoord(
    hero.portIslandPos?.x ?? DEFAULT_PORT_ISLAND_POS.x,
    hero.portIslandPos?.y ?? DEFAULT_PORT_ISLAND_POS.y
  );
  const currentCellMeta = getPortIslandCellMeta(curIslandX, curIslandY);
  const activeSectorMove = hero.portSectorMove || null;
  const isMovingOnIsland = Boolean(activeSectorMove && nowMs < activeSectorMove.endsAt);

  // Координаты просматриваемого сектора (если выбрана клетка на карте — её сектор, иначе текущий сектор игрока)
  const viewedIslandX = previewCell ? previewCell.x : curIslandX;
  const viewedIslandY = previewCell ? previewCell.y : curIslandY;
  const viewedCellMeta = getPortIslandCellMeta(viewedIslandX, viewedIslandY);
  const isPreviewingOtherCell = Boolean(
    previewCell && (previewCell.x !== curIslandX || previewCell.y !== curIslandY)
  );

  // Определяем активный транспорт игрока для автоматического сокращения времени переходов по карте 10х10
  const activeTransportForIsland = cargoInfo.activeTransport;

  const singleStepCalc = calculatePortSectorTravelSeconds(
    curIslandX,
    curIslandY,
    Math.min(PORT_ISLAND_GRID_SIZE, curIslandX + 1),
    curIslandY,
    activeTransportForIsland
  );

  const previewTravelCalc = isPreviewingOtherCell
    ? calculatePortSectorTravelSeconds(
        curIslandX,
        curIslandY,
        viewedIslandX,
        viewedIslandY,
        activeTransportForIsland
      )
    : null;

  const forceRefreshAll = () => {
    setNowMs(Date.now());
    setLocalTick((prev) => prev + 1);
    triggerRefresh();
  };

  useEffect(() => {
    if (initialSectorId) {
      setSelectedSectorId(initialSectorId);
      setInspectingSectorId(initialSectorId);
      const targetSec = territories.find((s) => s.id === initialSectorId);
      if (targetSec && targetSec.mapX && targetSec.mapY) {
        setPreviewCell({ x: targetSec.mapX, y: targetSec.mapY });
      }
    }
  }, [initialSectorId]);

  useEffect(() => {
    const t = setInterval(() => {
      setNowMs(Date.now());
      triggerRefresh();
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Авто-завершение перехода по карте 10х10 строго по истечении реального таймера
  useEffect(() => {
    if (activeSectorMove && nowMs >= activeSectorMove.endsAt) {
      const normDest = normalizePortIslandCoord(activeSectorMove.toX, activeSectorMove.toY);
      const destMeta = getPortIslandCellMeta(normDest.x, normDest.y);
      onUpdateHero({
        portIslandPos: { x: normDest.x, y: normDest.y },
        portSectorMove: null
      });
      setPreviewCell(null);
      setInspectingSectorId(null);
      showToast(
        `📍 Вы прибыли в сектор [${normDest.x}/${normDest.y}] — ${destMeta.sectorTitle}!`
      );
    }
  }, [activeSectorMove, nowMs]);

  // ШАГ 1: Клик по клетке карты 10х10 ТОЛЬКО выделяет сектор желтой рамкой (предпросмотр) и показывает его объекты!
  const handleSelectCellForPreview = (targetX: number, targetY: number) => {
    const { x: tx, y: ty } = normalizePortIslandCoord(targetX, targetY);
    setIslandScopeMode('current_sector');
    setInspectingSectorId(null);
    if (tx === curIslandX && ty === curIslandY) {
      setPreviewCell(null);
      return;
    }
    setPreviewCell({ x: tx, y: ty });
  };

  // ШАГ 2: Реальный запуск таймера перехода (ТОЛЬКО по кнопке «Перейти / Плыть в сектор» или по одной из 8 стрелок)
  const handleStartIslandSectorMove = (targetX: number, targetY: number) => {
    const { x: tx, y: ty } = normalizePortIslandCoord(targetX, targetY);
    if (tx === curIslandX && ty === curIslandY) {
      setPreviewCell(null);
      setIslandScopeMode('current_sector');
      showToast(`📍 Вы уже находитесь в секторе [${tx}/${ty}] (${currentCellMeta.sectorTitle}).`);
      return;
    }
    if (cargoInfo.isOverloaded) {
      showToast(
        `⛔ Перегруз багажника (${cargoInfo.usedWeight}/${cargoInfo.maxWeight} ед. веса)! Переход в другой сектор заблокирован до выгрузки ресурсов или покупки транспорта.`
      );
      return;
    }
    if (isMovingOnIsland && activeSectorMove) {
      const remSec = Math.max(1, Math.ceil((activeSectorMove.endsAt - nowMs) / 1000));
      showToast(
        `⏳ Вы в пути: осталось ${remSec} сек. Дождитесь завершения перехода!`
      );
      return;
    }

    const calc = calculatePortSectorTravelSeconds(
      curIslandX,
      curIslandY,
      tx,
      ty,
      activeTransportForIsland
    );
    const startTs = Date.now();
    const endTs = startTs + calc.totalSeconds * 1000;
    const destMeta = getPortIslandCellMeta(tx, ty);

    setPreviewCell(null);
    setInspectingSectorId(null);
    onUpdateHero({
      portSectorMove: {
        fromX: curIslandX,
        fromY: curIslandY,
        toX: tx,
        toY: ty,
        startedAt: startTs,
        endsAt: endTs,
        durationSec: calc.totalSeconds,
        stepsCount: calc.stepsCount,
        transportName: calc.usingTransport ? activeTransportForIsland?.name || 'Транспорт' : null,
        transportIcon: calc.usingTransport ? activeTransportForIsland?.icon || '⛵' : '👣'
      }
    });

    setNowMs(startTs);
    showToast(
      `Вы в пути в сектор [${tx}/${ty}] (${destMeta.sectorTitle}): осталось ${calc.totalSeconds} сек.`
    );
  };

  const territories = getClanTerritories();
  const hasClanBadge = doesPlayerHaveClanBadge(effectiveMyNick, clan?.id, hero.hasClanBadge);
  const myActiveShift = getPlayerActivePortWorkShift(effectiveMyNick);
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
  const inspectingSector =
    !isMovingOnIsland && inspectingSectorId
      ? territories.find((s) => s.id === inspectingSectorId) || null
      : null;

  const myMember = clan?.members.find(
    (m) => m.nick.trim().toLowerCase() === effectiveMyNick.toLowerCase()
  );
  const isLeaderOrOfficer = Boolean(
    clan &&
      (clan.leaderNick.trim().toLowerCase() === effectiveMyNick.toLowerCase() ||
        myMember?.role === 'leader' ||
        myMember?.role === 'officer')
  );

  const handleStartWorkShift = (sectorId: string, durationHours: 1 | 2) => {
    if (isMovingOnIsland) {
      showToast('⏳ Вы в пути! Дождитесь прибытия в сектор.');
      return;
    }
    if (playerStamina < 20) {
      showToast(
        `🍺 Ваша бодрость слишком низкая (${playerStamina}% < 20%)! Посетите Портовую Таверну [7/6] и закажите обед (+25% бодрости за 300 🪙), чтобы снова работать.`
      );
      return;
    }
    const res = startPortFactoryWorkShift(
      sectorId,
      effectiveMyNick,
      hero.avatar || '🧙‍♂️',
      durationHours
    );
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      forceRefreshAll();
      return;
    }
    const staminaCost = durationHours === 2 ? 40 : 20;
    onUpdateHero({
      portStamina: Math.max(0, playerStamina - staminaCost)
    });
    showToast(res.message || '🔨 Вы устроились на работу в Порту! Смена запущена.');
    forceRefreshAll();
  };

  const handleClaimWorkShift = (sectorId: string, allowInstant = false) => {
    const res = claimPortFactoryWorkShift(sectorId, effectiveMyNick, allowInstant);
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      forceRefreshAll();
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
    forceRefreshAll();
  };

  const handleManageFacilityBalance = (
    sectorId: string,
    mode: 'deposit' | 'withdraw',
    amount = 1000
  ) => {
    const res = managePortFacilityBalance(
      sectorId,
      effectiveMyNick,
      mode,
      amount,
      hero.gold || 0
    );
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }
    if (typeof res.deltaHeroGold === 'number') {
      onUpdateHero({
        gold: Math.max(0, (hero.gold || 0) + res.deltaHeroGold)
      });
    }
    showToast(res.message || '🏦 Баланс объекта обновлён!');
    forceRefreshAll();
  };

  const handleBuyRelicFromFactory = (sectorId: string, qty = 1) => {
    if (isMovingOnIsland) {
      showToast('⏳ Вы в пути! Взаимодействовать с объектами во время перехода нельзя.');
      return;
    }
    const targetSec = territories.find((t) => t.id === sectorId);
    const tier = targetSec?.production?.productionTier || 3;
    const outKey: PortTerminalResourceKey =
      targetSec?.production?.outputResourceKey ||
      (tier === 1 ? 'raw_fish' : tier === 2 ? 'fish_semifinished' : 'port_relics');

    // Если это Портовая Таверна — заказ обеда для мгновенного восстановления +25% бодрости
    if (outKey === 'tavern_meal' || targetSec?.buildingCategory === 'tavern') {
      const mealRes = orderMealAtPortTavern(
        sectorId,
        effectiveMyNick,
        qty,
        hero.gold || 0,
        playerStamina
      );
      if (!mealRes.ok) {
        showToast(`⚠️ ${mealRes.error}`);
        return;
      }
      onUpdateHero({
        gold: Math.max(0, (hero.gold || 0) - (mealRes.totalCostGold || 0)),
        portStamina: mealRes.newStamina ?? Math.min(100, playerStamina + qty * 25)
      });
      showToast(mealRes.message || '🍺 Вы пообедали в Таверне и восстановили бодрость!');
      forceRefreshAll();
      return;
    }

    const itemWeight = getPortResourceWeight(outKey);
    if (itemWeight > 0) {
      if (cargoInfo.isOverloaded) {
        showToast(
          `⛔ Багажник перегружен (${cargoInfo.usedWeight}/${cargoInfo.maxWeight} ед. веса)! Покупка новых ресурсов заблокирована до выгрузки.`
        );
        return;
      }
      if (cargoInfo.usedWeight + qty * itemWeight > cargoInfo.maxWeight) {
        const maxCanCarry = Math.max(0, Math.floor(cargoInfo.freeWeight / itemWeight));
        showToast(
          `⛔ Недостаточно грузоподъемности! Вес ${qty} шт. = ${qty * itemWeight} ед., свободно в багажнике: ${cargoInfo.freeWeight} ед. (вы можете унести максимум ${maxCanCarry} шт.).`
        );
        return;
      }
    }

    const res = buyRelicsFromPortFactory(sectorId, effectiveMyNick, qty, hero.gold || 0);
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }
    const boughtCount = res.boughtQty || 1;
    const curPortRes = { ...(hero.portResources || {}) };
    curPortRes[outKey] = Math.max(0, Number(curPortRes[outKey] || 0) + boughtCount);

    if (tier === 3) {
      const newRelicItems: GameItem[] = [];
      for (let i = 0; i < boughtCount; i++) {
        const relicItem = createRelicItem(1);
        const outName = targetSec?.production?.outputProductName || 'Древняя Реликвия';
        relicItem.name = `${outName}`;
        relicItem.icon = targetSec?.production?.outputProductIcon || '🏺';
        relicItem.origin = `${targetSec?.name || 'Завод Порта'}`;
        newRelicItems.push(relicItem);
      }
      onUpdateInventory([...inventory, ...newRelicItems]);
    }

    onUpdateHero({
      gold: Math.max(0, (hero.gold || 0) - (res.totalCostGold || 0)),
      portResources: curPortRes
    });
    showToast(res.message || '📦 Продукция куплена и добавлена в рюкзак!');
    forceRefreshAll();
  };

  const getPlayerBagResourceCount = (resKey: PortTerminalResourceKey): number => {
    const portCount = Math.max(0, Number(hero.portResources?.[resKey] || 0));
    if (resKey === 'raw_fish') {
      return portCount + keepnetFishCount;
    }
    return portCount;
  };

  const handleSellResourceToFactory = (
    sectorId: string,
    slot: 1 | 2 | 3 | 'power',
    requestedQty: number
  ) => {
    if (isMovingOnIsland) {
      showToast('⏳ Вы в пути! Взаимодействовать с объектами во время перехода нельзя.');
      return;
    }
    const targetSec = territories.find((t) => t.id === sectorId);
    if (!targetSec) return;
    const resKey: PortTerminalResourceKey =
      slot === 'power'
        ? 'power_kw'
        : slot === 1
        ? targetSec.production?.input1ResourceKey || 'raw_fish'
        : slot === 2
        ? targetSec.production?.input2ResourceKey || 'fish_semifinished'
        : targetSec.production?.input3ResourceKey || 'alchemy_reagents';
    const bagAvail = getPlayerBagResourceCount(resKey);

    const res = sellResourceToPortFactory(
      sectorId,
      effectiveMyNick,
      slot,
      requestedQty,
      bagAvail
    );
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }

    const sold = res.soldQty || 0;
    const earned = res.goldEarned || 0;
    const curPortRes = { ...(hero.portResources || {}) };
    const fromPortRes = Math.min(sold, Math.max(0, Number(curPortRes[resKey] || 0)));
    curPortRes[resKey] = Math.max(0, Number(curPortRes[resKey] || 0) - fromPortRes);
    const remFromKeepnet = sold - fromPortRes;

    const nextKeepnet = Array.isArray(hero.fishingState?.keepnet)
      ? [...hero.fishingState.keepnet]
      : [];
    if (resKey === 'raw_fish' && remFromKeepnet > 0) {
      nextKeepnet.splice(0, remFromKeepnet);
    }

    onUpdateHero({
      gold: (hero.gold || 0) + earned,
      portResources: curPortRes,
      ...(resKey === 'raw_fish' && remFromKeepnet > 0
        ? {
            fishingState: {
              ...(hero.fishingState || {}),
              keepnet: nextKeepnet
            }
          }
        : {})
    });

    showToast(res.message || `💰 Вы продали ${sold} ед. сырья заводу за +${earned} 🪙!`);
    forceRefreshAll();
  };

  const handleRepairBuilding = (sectorId: string) => {
    if (isMovingOnIsland) {
      showToast('⏳ Вы в пути!');
      return;
    }
    const bagIron = getPlayerBagResourceCount('iron_ore');
    const bagSteel = getPlayerBagResourceCount('hardened_steel');
    const res = repairPortRealEstateObject(sectorId, effectiveMyNick, bagIron, bagSteel);
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }
    const curPortRes = { ...(hero.portResources || {}) };
    curPortRes.iron_ore = Math.max(0, Number(curPortRes.iron_ore || 0) - (res.ironUsedFromBag || 0));
    curPortRes.hardened_steel = Math.max(
      0,
      Number(curPortRes.hardened_steel || 0) - (res.steelUsedFromBag || 0)
    );
    onUpdateHero({ portResources: curPortRes });
    showToast(res.message || '🛠️ Объект успешно отремонтирован до 100/100!');
    forceRefreshAll();
  };

  const handleToggleRepairOrder = (sectorId: string) => {
    const res = togglePortEstateRepairOrder(sectorId, effectiveMyNick);
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }
    showToast(res.message || '📋 Статус заявки на ремонт обновлён.');
    forceRefreshAll();
  };

  const getSectorOwnerDraft = (sec: (typeof territories)[number]) => {
    const existing = ownerSettingsBySector[sec.id];
    if (existing) return existing;
    return {
      rawBuyPriceGold: String(sec.production?.rawBuyPriceGold ?? 45),
      input2BuyPriceGold: String(sec.production?.input2BuyPriceGold ?? 95),
      input3BuyPriceGold: String(sec.production?.input3BuyPriceGold ?? 150),
      productSellPriceGold: String(sec.production?.productSellPriceGold ?? 220),
      workerWageGold: String(sec.production?.workerWageGold ?? PORT_WORKER_GOLD_PER_HOUR),
      clanQuery: sec.ownerClanName || sec.ownerClanTag || ''
    };
  };

  const updateSectorOwnerDraft = (
    sectorId: string,
    patch: Partial<{
      rawBuyPriceGold: string;
      input2BuyPriceGold: string;
      input3BuyPriceGold: string;
      productSellPriceGold: string;
      workerWageGold: string;
      clanQuery: string;
    }>,
    sec: (typeof territories)[number]
  ) => {
    const base = getSectorOwnerDraft(sec);
    setOwnerSettingsBySector((prev) => ({
      ...prev,
      [sectorId]: {
        ...base,
        ...patch
      }
    }));
  };

  const handleCreateNewEstate = () => {
    const res = createPortRealEstateObject(
      effectiveMyNick,
      selectedEstateTemplateId,
      customEstateName.trim(),
      hero.crystals || 0,
      { mapX: curIslandX, mapY: curIslandY }
    );
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }
    onUpdateHero({
      crystals: Math.max(0, (hero.crystals || 0) - (res.costCrystals || ESTATE_CREATION_COST_CRYSTALS))
    });
    setShowCreateEstateModal(false);
    setCustomEstateName('');
    showToast(
      res.message ||
        `🏗️ Недвижимость успешно создана в секторе [${curIslandX}/${curIslandY}] за 3 000 💎!`
    );
    forceRefreshAll();
    if (onOpenProfileEstate) {
      onOpenProfileEstate();
    }
  };

  const handleSaveOwnerPricesAndWage = (sec: (typeof territories)[number]) => {
    const draft = getSectorOwnerDraft(sec);
    const res = updatePortEstateOwnerSettings(sec.id, effectiveMyNick, {
      rawBuyPriceGold: Number(draft.rawBuyPriceGold || 45),
      input2BuyPriceGold: Number(draft.input2BuyPriceGold || 95),
      input3BuyPriceGold: Number(draft.input3BuyPriceGold || 150),
      productSellPriceGold: Number(draft.productSellPriceGold || 220),
      workerWageGold: Number(draft.workerWageGold || PORT_WORKER_GOLD_PER_HOUR)
    });
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }
    showToast(res.message || '⚙️ Настройки цен и зарплаты сохранены!');
    forceRefreshAll();
  };

  const handleDelegateClanControl = (sec: (typeof territories)[number], overrideClanQuery?: string) => {
    const draft = getSectorOwnerDraft(sec);
    const q = (overrideClanQuery ?? draft.clanQuery).trim();
    const res = delegatePortEstateClanControl(sec.id, effectiveMyNick, q);
    if (!res.ok) {
      showToast(`⚠️ ${res.error}`);
      return;
    }
    showToast(res.message || '🚩 Контроль клана обновлён!');
    forceRefreshAll();
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
      `Начать штурм производства «${sectorName}» в Порту (-30% бодрости, -25 ед. прочности зданию)? В боях 7х7 участвуют только реальные игроки со Знаком клана!`,
      () => {
        const res = declareClanTerritoryWar(clan.id, myNick, sectorId, hero, equipped);
        if (!res.ok) {
          showToast(`❌ ${res.error}`);
          return;
        }
        onUpdateHero({
          portStamina: Math.max(0, playerStamina - 30)
        });
        setSelectedSectorId(sectorId);
        showToast(res.message || `⚔️ Тревога в Порту! Сбор 7х7 на объект «${sectorName}» начат (-30% бодрости)!`);
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
    onUpdateHero({
      portStamina: Math.max(0, playerStamina - 30)
    });
    showToast(res.message || '✅ Вы вступили в бой 7х7 (-30% бодрости)!');
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

  const getResourceWeight = (key?: PortTerminalResourceKey): number => {
    return getPortResourceWeight(key);
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
          className={`rounded border border-dashed px-2.5 py-2 flex items-center justify-between text-[10px] ${
            side === 'attacker'
              ? 'border-rose-500/30 bg-rose-950/10 text-slate-500'
              : 'border-sky-500/30 bg-sky-950/10 text-slate-500'
          }`}
        >
          <span className="font-bold">
            Клетка {side === 'attacker' ? 'Атаки' : 'Защиты'} #{cellIndex + 1} ({ROLE_CONFIG[recommendedRole].short})
          </span>
          <span className="italic text-[9px]">Пустая клетка</span>
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
        className={`rounded border p-2 transition-all space-y-1.5 ${
          isEnemySideForMe && fighter.alive ? 'cursor-pointer hover:border-amber-400' : ''
        } ${
          !fighter.alive
            ? 'border-red-900/60 bg-red-950/20 opacity-60'
            : isSelectedTarget
            ? 'border-2 border-amber-400 bg-amber-950/40'
            : isMe
            ? 'border-amber-400/80 bg-amber-950/30'
            : side === 'attacker'
            ? 'border-rose-500/45 bg-slate-950/90'
            : 'border-sky-500/45 bg-slate-950/90'
        }`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-black ${
                side === 'attacker' ? 'bg-rose-600 text-white' : 'bg-sky-600 text-white'
              }`}
            >
              #{cellIndex + 1}
            </span>
            <CharacterAvatar
              avatar={fighter.avatar || '🧙‍♂️'}
              size="sm"
              className="rounded border border-amber-500/40 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-[10px] font-black text-white truncate flex items-center gap-1 flex-wrap">
                <ClanRankEpaulette
                  rankLevel={
                    fighter.rankLevel || getPlayerClanRankAndPts(fighter.nick).rankLevel
                  }
                  size="sm"
                />
                <span>{fighter.nick}</span>
                {isMe && (
                  <span className="rounded bg-amber-500 px-1 py-0.2 text-[8px] font-black text-slate-950">
                    ВЫ
                  </span>
                )}
                {isSelectedTarget && (
                  <span className="rounded bg-rose-600 px-1.5 py-0.2 text-[8px] font-black text-white">
                    🎯 ЦЕЛЬ
                  </span>
                )}
                {hasActedThisTurn && fighter.alive && (
                  <span className="rounded bg-emerald-500/25 border border-emerald-400/50 px-1 py-0.2 text-[8px] font-bold text-emerald-300">
                    ✓ Ход
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

        <div className="h-1.5 w-full overflow-hidden rounded bg-slate-800 border border-slate-700/70">
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

        {isCombatPhase && isEnemySideForMe && fighter.alive && (
          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedEnemyNick(fighter.nick);
              }}
              className={`rounded px-2 py-0.5 text-[8.5px] font-black cursor-pointer ${
                isSelectedTarget
                  ? 'bg-amber-400 text-slate-950'
                  : 'border border-amber-500/50 bg-slate-900 text-amber-200'
              }`}
            >
              {isSelectedTarget ? '🎯 Выбрана' : '🎯 Выбрать'}
            </button>

            {canIActNow && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEnemyNick(fighter.nick);
                  handleManualCellStrike(sectorId, fighter.nick, 'strike');
                }}
                className="rounded bg-rose-600 px-2 py-0.5 text-[8.5px] font-black uppercase text-white cursor-pointer"
              >
                ⚔️ Ударить #{cellIndex + 1}
              </button>
            )}
          </div>
        )}

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
                      : 'bg-slate-800 text-slate-300'
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
                      : 'bg-slate-800 text-slate-300'
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
    <div className="space-y-2 text-xs">
      {/* ===================================================================== */}
      {/* ТОЧНАЯ ВЕРСТКА ЭКРАНА КАРТЫ (ТОЧНАЯ КОПИЯ GWARS map.php)              */}
      {/* ===================================================================== */}
      {(() => {
        const moveRemSec =
          isMovingOnIsland && activeSectorMove
            ? Math.max(0, Math.ceil((activeSectorMove.endsAt - nowMs) / 1000))
            : 0;

        return (
          <div className="border border-slate-700 bg-slate-950">
            {/* БЛОК 1: КАРТА ОСТРОВА (10х10) — ДЕТАЛИЗИРОВАННЫЙ РЕЛЬЕФ ОСТРОВА + ПУНКТИРНАЯ СЕТКА 10х10 БЕЗ ОТСТУПОВ */}
            <div className="border-b border-slate-700 bg-slate-900/90 px-2 py-1 flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-200">
                Карта острова Порта:{' '}
                <strong className="text-amber-300 font-mono">
                  {effectiveMyNick} [{curIslandX}/{curIslandY}]
                </strong>
              </span>
              <span className="text-[10px] text-slate-400">
                {isPreviewingOtherCell ? (
                  <span>
                    Осмотр:{' '}
                    <strong className="text-amber-300">
                      [{viewedIslandX}/{viewedIslandY}] {viewedCellMeta.sectorTitle}
                    </strong>
                  </span>
                ) : (
                  <span>
                    Сектор: <strong className="text-emerald-300">{currentCellMeta.sectorTitle}</strong>
                  </span>
                )}
              </span>
            </div>

            <div className="relative mx-auto w-full max-w-[340px] aspect-square overflow-hidden border-b border-slate-700 select-none bg-[#07263b]">
              {/* Детализированный рельеф острова (бухты, заливы, песчаные косы, дельта Нила с притоками, текстура песка, оазисы с пальмами и иконками доков/шахт) */}
              <svg
                viewBox="0 0 300 300"
                className="absolute inset-0 h-full w-full pointer-events-none"
                preserveAspectRatio="none"
              >
                <defs>
                  <radialGradient id="gwSeaGrad" cx="50%" cy="50%" r="72%">
                    <stop offset="0%" stopColor="#165b7d" />
                    <stop offset="60%" stopColor="#0c3c58" />
                    <stop offset="100%" stopColor="#051e2e" />
                  </radialGradient>
                  <radialGradient id="gwLagoonGrad" cx="52%" cy="50%" r="55%">
                    <stop offset="0%" stopColor="#38a3b8" stopOpacity="0.65" />
                    <stop offset="70%" stopColor="#1e758f" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#0e4863" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="gwSandGrad" cx="48%" cy="46%" r="52%">
                    <stop offset="0%" stopColor="#ebd298" />
                    <stop offset="55%" stopColor="#d4b06a" />
                    <stop offset="88%" stopColor="#b58b43" />
                    <stop offset="100%" stopColor="#8f6829" />
                  </radialGradient>
                  <linearGradient id="gwNileGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2692bd" />
                    <stop offset="50%" stopColor="#19739c" />
                    <stop offset="100%" stopColor="#0f5273" />
                  </linearGradient>
                  <pattern id="gwSandDots" width="18" height="18" patternUnits="userSpaceOnUse">
                    <circle cx="3" cy="4" r="0.8" fill="#8c6223" opacity="0.35" />
                    <circle cx="11" cy="7" r="0.7" fill="#fff3cf" opacity="0.4" />
                    <circle cx="7" cy="14" r="0.9" fill="#7a5319" opacity="0.3" />
                    <circle cx="15" cy="15" r="0.6" fill="#fff3cf" opacity="0.35" />
                  </pattern>
                </defs>

                {/* Глубокое море и легкие волны */}
                <rect width="300" height="300" fill="url(#gwSeaGrad)" />
                <path
                  d="M 12 22 Q 24 18 36 22 M 248 25 Q 262 20 276 25 M 18 274 Q 32 269 46 274 M 244 278 Q 258 273 272 278"
                  stroke="#3fa7c9"
                  strokeWidth="1.2"
                  fill="none"
                  opacity="0.35"
                />

                {/* Мелководье, рифы и лагуны вокруг береговой линии */}
                <path
                  d="M 55 44 C 78 30, 108 38, 134 29 C 162 20, 198 26, 224 41 C 246 53, 272 68, 268 96 C 264 121, 246 131, 256 156 C 267 182, 278 205, 261 232 C 244 258, 212 248, 188 262 C 162 277, 132 279, 104 268 C 76 257, 62 238, 42 222 C 23 206, 22 178, 33 154 C 44 130, 25 106, 31 80 C 36 58, 42 52, 55 44 Z"
                  fill="url(#gwLagoonGrad)"
                />
                <path
                  d="M 60 50 C 82 36, 110 44, 135 35 C 161 26, 194 32, 219 46 C 240 58, 263 72, 259 98 C 255 121, 238 131, 248 155 C 258 179, 268 201, 252 226 C 236 250, 207 242, 184 255 C 160 269, 132 271, 106 260 C 80 250, 67 232, 48 217 C 30 202, 30 176, 40 154 C 50 132, 33 108, 38 84 C 43 63, 48 57, 60 50 Z"
                  fill="#2991ad"
                  opacity="0.45"
                />

                {/* Песчаные косы и мелкие островки архипелага */}
                <ellipse cx="44" cy="52" rx="11" ry="6" transform="rotate(-22 44 52)" fill="#d6b36f" stroke="#f5e1b5" strokeWidth="1" />
                <ellipse cx="262" cy="70" rx="9" ry="5" transform="rotate(18 262 70)" fill="#d6b36f" stroke="#f5e1b5" strokeWidth="1" />
                <ellipse cx="264" cy="244" rx="12" ry="6" transform="rotate(-15 264 244)" fill="#d6b36f" stroke="#f5e1b5" strokeWidth="1" />
                <ellipse cx="42" cy="238" rx="10" ry="5" transform="rotate(25 42 238)" fill="#d6b36f" stroke="#f5e1b5" strokeWidth="1" />

                {/* Основной рельеф острова с неровной береговой линией (бухты, заливы, мысы, гавань Фароса) */}
                <path
                  d="M 68 58
                     C 88 44, 112 54, 134 43
                     C 156 32, 186 36, 210 51
                     C 231 64, 254 76, 249 101
                     C 245 120, 224 128, 228 144
                     C 232 160, 254 166, 256 186
                     C 258 206, 242 224, 224 228
                     C 206 232, 198 214, 183 222
                     C 168 230, 174 252, 154 258
                     C 134 264, 112 258, 95 246
                     C 78 234, 72 216, 55 204
                     C 38 192, 36 168, 47 148
                     C 58 128, 41 108, 46 86
                     C 51 67, 56 66, 68 58 Z"
                  fill="url(#gwSandGrad)"
                  stroke="#f4dfb0"
                  strokeWidth="2.2"
                />

                {/* Текстура песка и барханов */}
                <path
                  d="M 68 58 C 88 44, 112 54, 134 43 C 156 32, 186 36, 210 51 C 231 64, 254 76, 249 101 C 245 120, 224 128, 228 144 C 232 160, 254 166, 256 186 C 258 206, 242 224, 224 228 C 206 232, 198 214, 183 222 C 168 230, 174 252, 154 258 C 134 264, 112 258, 95 246 C 78 234, 72 216, 55 204 C 38 192, 36 168, 47 148 C 58 128, 41 108, 46 86 C 51 67, 56 66, 68 58 Z"
                  fill="url(#gwSandDots)"
                />

                {/* Внутреннее плато и песчаные дюны */}
                <path
                  d="M 78 195 Q 102 186 124 196 M 62 158 Q 84 150 104 160 M 192 84 Q 216 76 234 86 M 112 226 Q 136 218 156 228"
                  stroke="#9c7332"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.55"
                />

                {/* Зеленые оазисы дельты Нила */}
                <path
                  d="M 116 124 C 136 112, 172 114, 188 130 C 204 146, 200 176, 178 188 C 156 200, 122 194, 108 174 C 94 154, 96 136, 116 124 Z"
                  fill="#437a3b"
                  opacity="0.82"
                />
                <ellipse cx="136" cy="142" rx="28" ry="20" fill="#559449" opacity="0.75" />
                <ellipse cx="204" cy="168" rx="26" ry="18" fill="#4b8540" opacity="0.8" />
                <ellipse cx="96" cy="182" rx="22" ry="15" fill="#4b8540" opacity="0.7" />

                {/* Извилистая дельта Нила с притоками и гаванью */}
                {/* Главное русло Нила с севера на юг в бухту */}
                <path
                  d="M 142 39 C 148 68, 130 96, 142 126 C 154 156, 146 184, 162 214 C 172 232, 188 224, 196 236"
                  fill="none"
                  stroke="#e8d096"
                  strokeWidth="15"
                  strokeLinecap="round"
                />
                <path
                  d="M 142 39 C 148 68, 130 96, 142 126 C 154 156, 146 184, 162 214 C 172 232, 188 224, 196 236"
                  fill="none"
                  stroke="url(#gwNileGrad)"
                  strokeWidth="11.5"
                  strokeLinecap="round"
                />
                {/* Восточный рукав дельты к Портовой Гавани [7/6] и [8/6] */}
                <path
                  d="M 143 130 C 168 138, 188 154, 232 146"
                  fill="none"
                  stroke="#e8d096"
                  strokeWidth="11.5"
                  strokeLinecap="round"
                />
                <path
                  d="M 143 130 C 168 138, 188 154, 232 146"
                  fill="none"
                  stroke="url(#gwNileGrad)"
                  strokeWidth="8.5"
                  strokeLinecap="round"
                />
                {/* Западный приток к Оазису [5/5] */}
                <path
                  d="M 138 112 C 118 122, 102 142, 82 158"
                  fill="none"
                  stroke="url(#gwNileGrad)"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                />

                {/* Горные хребты и скалы с тенями (северо-запад и северо-восток) */}
                <g>
                  <polygon points="68,102 84,70 100,102" fill="#6e5539" stroke="#4a3723" strokeWidth="1" />
                  <polygon points="84,70 100,102 91,102" fill="#8f7250" />
                  <polygon points="88,106 106,68 124,106" fill="#7c6143" stroke="#4a3723" strokeWidth="1" />
                  <polygon points="106,68 124,106 112,106" fill="#9e805c" />
                  <polygon points="56,126 71,98 86,126" fill="#6b5237" stroke="#4a3723" strokeWidth="1" />
                  <polygon points="172,96 190,64 208,96" fill="#785d40" stroke="#4a3723" strokeWidth="1" />
                  <polygon points="190,64 208,96 197,96" fill="#997a56" />
                  <polygon points="196,102 212,74 228,102" fill="#6e5539" stroke="#4a3723" strokeWidth="1" />
                </g>

                {/* Пальмы в оазисах */}
                {[
                  { x: 126, y: 138 },
                  { x: 158, y: 128 },
                  { x: 122, y: 168 },
                  { x: 172, y: 176 },
                  { x: 94, y: 178 }
                ].map((palm, pIdx) => (
                  <g key={`gw_palm_${pIdx}`} transform={`translate(${palm.x},${palm.y})`}>
                    <line x1="0" y1="6" x2="1" y2="0" stroke="#5c3d1e" strokeWidth="1.6" />
                    <circle cx="-3" cy="-1" r="2.6" fill="#2d6a2e" />
                    <circle cx="3" cy="-1" r="2.6" fill="#377d37" />
                    <circle cx="0" cy="-3" r="2.8" fill="#469645" />
                  </g>
                ))}

                {/* Иконки ключевых индустриальных секторов: доки, шахты, нефтяная вышка, бастионы */}
                {/* [5/5] Нефтяной оазис (x:135, y:135) */}
                <g transform="translate(131,130)">
                  <polygon points="4,0 8,10 0,10" fill="#27272a" stroke="#fbbf24" strokeWidth="0.9" />
                  <line x1="1" y1="5" x2="7" y2="5" stroke="#fbbf24" strokeWidth="0.8" />
                </g>
                {/* [6/5] Сталелитейный квартал (x:165, y:135) */}
                <g transform="translate(158,128)">
                  <rect x="0" y="3" width="12" height="8" fill="#7c2d12" stroke="#fcd34d" strokeWidth="0.9" />
                  <rect x="2" y="0" width="3" height="4" fill="#52525b" />
                  <rect x="7" y="0" width="3" height="4" fill="#52525b" />
                </g>
                {/* [7/5] Военный бастион (x:195, y:135) */}
                <g transform="translate(188,128)">
                  <rect x="0" y="2" width="13" height="9" fill="#7f1d1d" stroke="#fde68a" strokeWidth="0.9" />
                  <polygon points="0,2 6.5,-2 13,2" fill="#b91c1c" />
                </g>
                {/* [8/5] Оружейная мануфактура (x:225, y:135) */}
                <g transform="translate(218,128)">
                  <rect x="0" y="2" width="12" height="9" fill="#44403c" stroke="#fbbf24" strokeWidth="0.9" />
                  <circle cx="6" cy="6.5" r="2.3" fill="#fbbf24" />
                </g>
                {/* [6/6] Золотая шахта (x:165, y:165) */}
                <g transform="translate(158,158)">
                  <polygon points="0,10 6,1 12,10" fill="#78350f" stroke="#f59e0b" strokeWidth="1" />
                  <circle cx="6" cy="7" r="2" fill="#facc15" />
                </g>
                {/* [7/6] Центральная Гавань Фароса (x:195, y:165) */}
                <g transform="translate(187,156)">
                  <rect x="0" y="4" width="15" height="10" fill="#9a3412" stroke="#fef08a" strokeWidth="1.1" />
                  <polygon points="7.5,-2 12,4 3,4" fill="#fbbf24" />
                  <circle cx="7.5" cy="1" r="1.5" fill="#ffffff" />
                </g>
                {/* [8/6] Плавильный док и рудники (x:225, y:165) */}
                <g transform="translate(218,158)">
                  <rect x="0" y="3" width="13" height="9" fill="#991b1b" stroke="#fdba74" strokeWidth="0.9" />
                  <circle cx="6.5" cy="7.5" r="2.2" fill="#fb923c" />
                </g>
                {/* [7/7] Южный Маяк и Карьер (x:195, y:195) */}
                <g transform="translate(190,187)">
                  <polygon points="2,12 4,1 8,1 10,12" fill="#e2e8f0" stroke="#0f172a" strokeWidth="0.8" />
                  <circle cx="6" cy="1" r="2.2" fill="#fde047" />
                </g>
              </svg>

              {/* Тонкая полупрозрачная пунктирная сетка 10x10 поверх картинки без отступов (gap: 0px) */}
              <div
                className="relative z-10 grid h-full w-full"
                style={{
                  gridTemplateColumns: 'repeat(10, minmax(0, 1fr))',
                  gridTemplateRows: 'repeat(10, minmax(0, 1fr))',
                  gap: '0px'
                }}
              >
                {Array.from({ length: PORT_ISLAND_GRID_SIZE }, (_, rIdx) => rIdx + 1).map((rowY) =>
                  Array.from({ length: PORT_ISLAND_GRID_SIZE }, (_, cIdx) => cIdx + 1).map((colX) => {
                    const isHere = colX === curIslandX && rowY === curIslandY;
                    const isPreviewSelected =
                      previewCell !== null && previewCell.x === colX && previewCell.y === rowY;
                    const isDest =
                      isMovingOnIsland &&
                      activeSectorMove?.toX === colX &&
                      activeSectorMove?.toY === rowY;
                    const cellSectors = territories.filter(
                      (t) => (t.mapX ?? 7) === colX && (t.mapY ?? 6) === rowY
                    );
                    const cellMeta = getPortIslandCellMeta(colX, rowY);

                    return (
                      <button
                        key={`gw_cell_${colX}_${rowY}`}
                        type="button"
                        onClick={() => handleSelectCellForPreview(colX, rowY)}
                        title={`[${colX}/${rowY}] ${cellMeta.sectorTitle}${
                          cellSectors.length > 0 ? ` (Объектов: ${cellSectors.length})` : ''
                        } — Кликните для осмотра сектора`}
                        style={{
                          border: isPreviewSelected
                            ? '2px solid #fbbf24'
                            : isHere
                            ? '1.5px solid rgba(52, 211, 153, 0.9)'
                            : '1px dashed rgba(255,255,255,0.22)'
                        }}
                        className={`relative flex items-center justify-center p-0 m-0 transition-colors cursor-pointer ${
                          isPreviewSelected
                            ? 'bg-amber-400/25 shadow-[inset_0_0_8px_rgba(251,191,36,0.65)]'
                            : 'hover:bg-white/15'
                        }`}
                      >
                        {/* Индикатор наличия построек в секторе */}
                        {!isHere && cellSectors.length > 0 && (
                          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-amber-200/90 bg-slate-950/80 text-[8px] font-black text-amber-300 shadow">
                            {cellSectors.length}
                          </span>
                        )}

                        {/* Точка назначения при активном переходе */}
                        {!isHere && isDest && (
                          <span className="h-3 w-3 rounded-full border-2 border-amber-300 bg-amber-400/70 animate-ping" />
                        )}

                        {/* На клетке, где стоит игрок, рисуется яркий кружок-маркер (зеленая точка в круге) */}
                        {isHere && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-black/70 shadow-[0_0_6px_rgba(16,185,129,1)]">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* БЛОК 2: ДВУХКОЛОНОЧНАЯ ТАБЛИЦА ПОД КАРТОЙ (35% СЛЕВА «ПЕРЕХОД», 65% СПРАВА «GPS-НАВИГАЦИЯ») */}
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-900 text-slate-300 border-b border-slate-700">
                  <th
                    style={{ width: '35%' }}
                    className="py-1 px-2 text-center font-bold border-r border-slate-700"
                  >
                    Переход
                  </th>
                  <th style={{ width: '65%' }} className="py-1 px-2 text-left font-bold">
                    GPS-навигация
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {/* Левая колонка (width: 35%): Крупные кнопки со стрелками 36x36px с четкой золотой/зеленой рамкой и временем шага по центру */}
                  <td
                    style={{ width: '35%' }}
                    className="p-2 align-middle text-center border-r border-slate-700 bg-slate-950"
                  >
                    <div className="inline-grid grid-cols-3 gap-1">
                      {[
                        { dx: -1, dy: -1, arrow: '↖' },
                        { dx: 0, dy: -1, arrow: '↑' },
                        { dx: 1, dy: -1, arrow: '↗' },
                        { dx: -1, dy: 0, arrow: '←' },
                        { dx: 0, dy: 0, arrow: `${singleStepCalc.secondsPerStep}с` },
                        { dx: 1, dy: 0, arrow: '→' },
                        { dx: -1, dy: 1, arrow: '↙' },
                        { dx: 0, dy: 1, arrow: '↓' },
                        { dx: 1, dy: 1, arrow: '↘' }
                      ].map((item, idx) => {
                        if (item.dx === 0 && item.dy === 0) {
                          return (
                            <div
                              key={`cross_center_${idx}`}
                              style={{ width: '36px', height: '36px' }}
                              title={`Время шага на соседний сектор: ${singleStepCalc.secondsPerStep} сек.`}
                              className="flex items-center justify-center rounded border-2 border-amber-400/80 bg-slate-900 font-mono text-[12px] font-black text-amber-300 shadow-inner"
                            >
                              {item.arrow}
                            </div>
                          );
                        }
                        const nx = curIslandX + item.dx;
                        const ny = curIslandY + item.dy;
                        const outOfBounds =
                          nx < 1 || nx > PORT_ISLAND_GRID_SIZE || ny < 1 || ny > PORT_ISLAND_GRID_SIZE;
                        return (
                          <button
                            key={`cross_btn_${idx}`}
                            type="button"
                            style={{ width: '36px', height: '36px' }}
                            disabled={outOfBounds || isMovingOnIsland}
                            onClick={() => handleStartIslandSectorMove(nx, ny)}
                            title={
                              outOfBounds
                                ? 'Край острова'
                                : `Шаг в соседний сектор [${nx}/${ny}] (${singleStepCalc.secondsPerStep} сек.)`
                            }
                            className={`flex items-center justify-center rounded border-2 text-base font-black leading-none transition-all ${
                              outOfBounds || isMovingOnIsland
                                ? 'border-slate-800 bg-slate-900/40 text-slate-700 cursor-not-allowed'
                                : 'border-emerald-400/85 bg-slate-900 text-amber-200 hover:border-amber-300 hover:bg-emerald-950 hover:text-white shadow-sm cursor-pointer active:scale-95'
                            }`}
                          >
                            {item.arrow}
                          </button>
                        );
                      })}
                    </div>
                  </td>

                  {/* Правая колонка (width: 65%): Текущий сектор, предпросмотр выбранной клетки с кнопкой подтверждения перехода и ссылки */}
                  <td style={{ width: '65%' }} className="p-2 align-top bg-slate-950 space-y-1.5">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="font-bold text-emerald-300">
                        📍 Вы в секторе: [{curIslandX}/{curIslandY}] {currentCellMeta.sectorTitle}
                      </div>
                      {isPreviewingOtherCell && (
                        <button
                          type="button"
                          onClick={() => setPreviewCell(null)}
                          className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                        >
                          Вернуться к [{curIslandX}/{curIslandY}]
                        </button>
                      )}
                    </div>

                    {/* ДВУХШАГОВОЕ ПОДТВЕРЖДЕНИЕ ПЕРЕХОДА ПРИ ВЫБОРЕ КЛЕТКИ НА КАРТЕ 10x10 */}
                    {isPreviewingOtherCell && previewTravelCalc && !isMovingOnIsland && (
                      <div className="rounded border border-amber-400/80 bg-amber-950/35 p-2 space-y-1.5">
                        <div className="text-[11px] text-amber-100 leading-snug">
                          Выбран сектор:{' '}
                          <strong className="text-amber-300 font-mono">
                            [{viewedIslandX}/{viewedIslandY}]
                          </strong>{' '}
                          <strong className="text-white">{viewedCellMeta.sectorTitle}</strong>{' '}
                          <span className="text-slate-300 font-mono">
                            (Расстояние: {previewTravelCalc.stepsCount} кл. | Время в пути:{' '}
                            {previewTravelCalc.totalSeconds} сек.)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStartIslandSectorMove(viewedIslandX, viewedIslandY)}
                          className="w-full sm:w-auto rounded border border-amber-300 bg-amber-500 hover:bg-amber-400 px-3 py-1 text-[11px] font-black text-slate-950 shadow cursor-pointer transition-colors"
                        >
                          [ ⛵ Перейти / Плыть в сектор ({previewTravelCalc.totalSeconds} сек.) ]
                        </button>
                      </div>
                    )}

                    {/* Строгий таймер перемещения БЕЗ кнопки «Пропустить» */}
                    {isMovingOnIsland && activeSectorMove ? (
                      <div className="border border-amber-500/60 bg-amber-950/30 px-2 py-1 font-mono text-[11px] font-bold text-amber-200">
                        ⏳ Вы в пути: осталось {moveRemSec} сек.
                        <div className="text-[9.5px] font-normal text-slate-400 mt-0.5">
                          Маршрут: [{activeSectorMove.fromX}/{activeSectorMove.fromY}] → [
                          {activeSectorMove.toX}/{activeSectorMove.toY}]. До окончания таймера вход на объекты закрыт.
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400">
                        {singleStepCalc.usingTransport && activeTransportForIsland
                          ? `Активный транспорт: ${activeTransportForIsland.name} (${singleStepCalc.secondsPerStep} сек./кл., +${cargoInfo.transportBonusWeight} веса)`
                          : `Скорость пешком: ${PORT_FOOT_STEP_SECONDS} сек./кл. (базовая вместимость: 30 ед. веса)`}
                      </div>
                    )}

                    {/* Табличная строка: Вес багажника и Бодрость персонажа */}
                    <div className="border border-slate-800 bg-slate-900/70 px-2 py-1 flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
                      <div>
                        <span className="text-slate-400">Багажник:</span>{' '}
                        <strong
                          className={`font-mono ${
                            cargoInfo.isOverloaded ? 'text-rose-400' : 'text-amber-200'
                          }`}
                        >
                          {cargoInfo.usedWeight} / {cargoInfo.maxWeight} ед.
                        </strong>{' '}
                        <span className="text-slate-400 font-mono">
                          (Свободно: {cargoInfo.freeWeight} ед.)
                        </span>
                        {cargoInfo.isOverloaded && (
                          <span className="ml-1 font-bold text-rose-400">[ПЕРЕГРУЗ]</span>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-400">Бодрость:</span>{' '}
                        <strong
                          className={`font-mono ${
                            playerStamina < 20
                              ? 'text-rose-400'
                              : playerStamina < 50
                              ? 'text-amber-300'
                              : 'text-emerald-300'
                          }`}
                        >
                          {playerStamina}%
                        </strong>
                        {playerStamina < 20 && (
                          <span className="ml-1 text-[9.5px] text-rose-400">[Нужен обед в Таверне]</span>
                        )}
                      </div>
                    </div>

                    {/* Простые текстовые ссылки как в Gwars */}
                    <div className="pt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                      <span className="text-slate-500">»</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onSwitchToTerminal) {
                            onSwitchToTerminal();
                          } else {
                            showToast('Откройте вкладку «Торговый терминал» сверху.');
                          }
                        }}
                        className="text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                      >
                        Торговый терминал
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onSwitchToShipyard) {
                            onSwitchToShipyard();
                          } else {
                            showToast('Откройте вкладку «Верфь, Кузница и Алтарь» сверху.');
                          }
                        }}
                        className="text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                      >
                        Верфь и Гараж транспорта
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={() => setShowCreateEstateModal((prev) => !prev)}
                        className="text-amber-300 hover:text-amber-200 underline cursor-pointer"
                      >
                        Создать объект ({ESTATE_CREATION_COST_CRYSTALS.toLocaleString('ru-RU')} 💎)
                      </button>
                    </div>

                    {myActiveShift && (
                      <div className="pt-0.5 text-[10.5px] font-mono text-emerald-300">
                        {nowMs >= myActiveShift.worker.endsAt ? (
                          <button
                            type="button"
                            onClick={() => handleClaimWorkShift(myActiveShift.sector.id, false)}
                            className="text-amber-300 underline font-bold cursor-pointer"
                          >
                            [ Забрать оплату смены на «{myActiveShift.sector.name}» ]
                          </button>
                        ) : (
                          <span>
                            Вы работаете на «{myActiveShift.sector.name}»: осталось{' '}
                            {formatRemainingTimer(myActiveShift.worker.endsAt, nowMs)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* МЕСТО 5: СПИСОК СЕКТОРА «КТО В ПУТИ / КТО В СЕКТОРЕ» С ПОГОНАМИ 28x14px И ЗНАКОМ КЛАНА */}
                    {(() => {
                      const myRankInfo = getPlayerClanRankAndPts(effectiveMyNick, clan?.id, hero);
                      const sectorObjs = territories.filter(
                        (t) => (t.mapX ?? 7) === viewedIslandX && (t.mapY ?? 6) === viewedIslandY
                      );
                      const sectorWorkers: Array<{ nick: string; objName: string }> = [];
                      sectorObjs.forEach((so) => {
                        (so.production?.workers || [])
                          .filter((w) => !w.claimed && w.endsAt > nowMs)
                          .forEach((w) => {
                            if (
                              w.nick.trim().toLowerCase() !== effectiveMyNick.toLowerCase() &&
                              !sectorWorkers.some(
                                (sw) => sw.nick.toLowerCase() === w.nick.trim().toLowerCase()
                              )
                            ) {
                              sectorWorkers.push({ nick: w.nick, objName: so.name });
                            }
                          });
                      });

                      return (
                        <div className="border-t border-slate-800 pt-1 text-[10px] text-slate-300 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-slate-400 font-bold">
                              {isMovingOnIsland ? 'Кто в пути:' : `В секторе [${curIslandX}/${curIslandY}]:`}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 px-1.5 py-0.5">
                              {clan && (
                                <ClanBadgeMini
                                  emblem={clan.emblem}
                                  tag={clan.tag}
                                  clanName={clan.name}
                                />
                              )}
                              <ClanRankEpaulette rankLevel={myRankInfo.rankLevel} size="sm" />
                              <strong className="text-amber-200">{effectiveMyNick}</strong>
                              <span className="text-slate-400 font-mono">[{hero.level || 1}]</span>
                              {isMovingOnIsland && activeSectorMove && (
                                <span className="text-amber-300 font-mono">
                                  (→ [{activeSectorMove.toX}/{activeSectorMove.toY}], {moveRemSec}с)
                                </span>
                              )}
                            </span>
                            {sectorWorkers.map((sw) => {
                              const wClan = getPlayerClan(sw.nick);
                              const wRank = getPlayerClanRankAndPts(sw.nick, wClan?.id);
                              return (
                                <span
                                  key={`sec_w_${sw.nick}`}
                                  className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 px-1.5 py-0.5"
                                >
                                  {wClan && (
                                    <ClanBadgeMini
                                      emblem={wClan.emblem}
                                      tag={wClan.tag}
                                      clanName={wClan.name}
                                    />
                                  )}
                                  <ClanRankEpaulette rankLevel={wRank.rankLevel} size="sm" />
                                  <strong className="text-slate-200">{sw.nick}</strong>
                                  <span className="text-slate-400">({sw.objName})</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Панель создания нового объекта недвижимости за 3 000 кристаллов */}
            {showCreateEstateModal && (
              <div className="border-t border-slate-700 bg-slate-900 p-2.5 space-y-2 text-[11px]">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                  <strong className="text-amber-300">
                    Создание недвижимости в секторе [{curIslandX}/{curIslandY}] ({ESTATE_CREATION_COST_CRYSTALS.toLocaleString('ru-RU')} 💎)
                  </strong>
                  <button
                    type="button"
                    onClick={() => setShowCreateEstateModal(false)}
                    className="text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Закрыть
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                  {PORT_ESTATE_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSelectedEstateTemplateId(tpl.id)}
                      className={`border px-2 py-1 text-left cursor-pointer ${
                        selectedEstateTemplateId === tpl.id
                          ? 'border-amber-400 bg-amber-950/40 text-amber-200'
                          : 'border-slate-800 bg-slate-950 text-slate-300'
                      }`}
                    >
                      <div className="font-bold">
                        {tpl.name} <span className="text-[10px] text-slate-400">({tpl.categoryLabel})</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Выход: {tpl.outputProductName} ({tpl.outputRatePerHour} ед./ч по {tpl.productSellPriceGold} 🪙)
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="text"
                    maxLength={32}
                    value={customEstateName}
                    onChange={(e) => setCustomEstateName(e.target.value)}
                    placeholder="Название объекта (по желанию)..."
                    className="flex-1 border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
                  />
                  <button
                    type="button"
                    disabled={(hero.crystals || 0) < ESTATE_CREATION_COST_CRYSTALS}
                    onClick={handleCreateNewEstate}
                    className="border border-amber-400 bg-amber-500 px-3 py-1 font-bold text-slate-950 cursor-pointer disabled:opacity-40"
                  >
                    Создать за {ESTATE_CREATION_COST_CRYSTALS.toLocaleString('ru-RU')} 💎
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* ВНУТРЕННЕЕ ОКНО ОБЪЕКТА НЕДВИЖИМОСТИ (ТОЧНАЯ КОПИЯ GWARS object.php)  */}
      {/* ===================================================================== */}
      {inspectingSector && (() => {
        const s = inspectingSector;
        const secMapX = s.mapX ?? 7;
        const secMapY = s.mapY ?? 6;
        const p = s.production!;
        const tier: 1 | 2 | 3 =
          p.productionTier ||
          (p.productionStage === 'extraction' ? 1 : p.requiresDualInput ? 3 : 2);
        const maxW = p.isMerged ? PORT_MERGED_MAX_WORKERS : PORT_BASE_MAX_WORKERS;
        const activeW = (p.workers || []).filter((w) => !w.claimed && w.endsAt > nowMs);
        const allUnclaimedW = (p.workers || []).filter((w) => !w.claimed);
        const myW = allUnclaimedW.find(
          (w) => w.nick.trim().toLowerCase() === effectiveMyNick.toLowerCase()
        );
        const ownerName = s.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK;
        const isMyEstate = ownerName.trim().toLowerCase() === effectiveMyNick.toLowerCase();
        const isSettingsOpen = showOwnerSettingsForId === s.id;
        const wageGold = p.workerWageGold || PORT_WORKER_GOLD_PER_HOUR;
        const facilityCash = p.facilityBalanceGold ?? 25000;
        const hasNoFundsForShift = facilityCash < wageGold * 2;
        const buildingDurability = p.buildingDurability ?? 100;
        const maxBuildingDurability = p.maxBuildingDurability ?? 100;
        const isBuildingBroken = buildingDurability <= 0;

        const outKey: PortTerminalResourceKey = p.outputResourceKey || 'port_relics';
        const isTavernObject = outKey === 'tavern_meal' || s.buildingCategory === 'tavern';
        const outName = p.outputProductName || 'Древняя Реликвия';
        const outRate = p.outputRatePerHour || (tier === 1 ? 5 : 1);
        const outWeight = getResourceWeight(outKey);
        const sellPrice = p.productSellPriceGold || 750;
        const buyQtyVal = buyQtyBySector[s.id] ?? '1';
        const maxBuyableByGold = Math.floor((hero.gold || 0) / Math.max(1, sellPrice));
        const maxBuyableByWeight =
          outWeight > 0 ? Math.floor(cargoInfo.freeWeight / outWeight) : 999999;
        const maxPlayerCanBuy = isTavernObject
          ? Math.max(
              0,
              Math.min(
                p.relicStock,
                maxBuyableByGold,
                Math.max(0, Math.ceil((100 - playerStamina) / 25))
              )
            )
          : Math.max(0, Math.min(p.relicStock, maxBuyableByGold, maxBuyableByWeight));

        const protRemMs = s.protectionUntil && s.protectionUntil > nowMs ? s.protectionUntil - nowMs : 2 * 3600 * 1000;
        const protH = Math.floor(protRemMs / 3600000);
        const protM = Math.floor((protRemMs % 3600000) / 60000);
        const controlRemainStr = `${String(protH).padStart(2, '0')}:${String(protM).padStart(2, '0')}`;

        const requiredInputs: Array<{
          slot: 1 | 2 | 3 | 'power';
          key: PortTerminalResourceKey;
          name: string;
          normPerHour: number;
          stock: number;
          maxStock: number;
          buyPrice: number;
          myBagCount: number;
          inputValue: string;
          setInputValue: (val: string) => void;
        }> = [];

        if (tier >= 2 && p.input1ResourceKey) {
          const in1Key = p.input1ResourceKey;
          requiredInputs.push({
            slot: 1,
            key: in1Key,
            name: p.input1ResourceName || 'Сырая рыба',
            normPerHour: p.input1RequiredPerCycle ?? 5,
            stock: p.input1Stock ?? p.fishStock ?? 0,
            maxStock: p.maxInput1Stock ?? p.maxFishStock ?? 100,
            buyPrice: p.rawBuyPriceGold || 80,
            myBagCount: getPlayerBagResourceCount(in1Key),
            inputValue: sellInput1QtyBySector[s.id] ?? '5',
            setInputValue: (val: string) =>
              setSellInput1QtyBySector((prev) => ({ ...prev, [s.id]: val }))
          });
        }

        if (p.input2ResourceKey) {
          const in2Key = p.input2ResourceKey;
          requiredInputs.push({
            slot: 2,
            key: in2Key,
            name: p.input2ResourceName || 'Рыбный паштет',
            normPerHour: p.input2RequiredPerCycle ?? 2,
            stock: p.input2Stock ?? 0,
            maxStock: p.maxInput2Stock ?? 100,
            buyPrice: p.input2BuyPriceGold || p.rawBuyPriceGold || 130,
            myBagCount: getPlayerBagResourceCount(in2Key),
            inputValue: sellInput2QtyBySector[s.id] ?? '5',
            setInputValue: (val: string) =>
              setSellInput2QtyBySector((prev) => ({ ...prev, [s.id]: val }))
          });
        }

        if (p.input3ResourceKey) {
          const in3Key = p.input3ResourceKey;
          requiredInputs.push({
            slot: 3,
            key: in3Key,
            name: p.input3ResourceName || 'Алхимический реагент',
            normPerHour: p.input3RequiredPerCycle ?? 1,
            stock: p.input3Stock ?? 0,
            maxStock: p.maxInput3Stock ?? 100,
            buyPrice: p.input3BuyPriceGold || 920,
            myBagCount: getPlayerBagResourceCount(in3Key),
            inputValue: sellInput3QtyBySector[s.id] ?? '5',
            setInputValue: (val: string) =>
              setSellInput3QtyBySector((prev) => ({ ...prev, [s.id]: val }))
          });
        }

        if ((p.powerRequiredPerCycle ?? 0) > 0) {
          requiredInputs.push({
            slot: 'power',
            key: 'power_kw',
            name: 'Мощность (Энергия)',
            normPerHour: p.powerRequiredPerCycle ?? 1,
            stock: p.powerStock ?? 0,
            maxStock: p.maxPowerStock ?? 200,
            buyPrice: p.powerBuyPriceGold || 70,
            myBagCount: getPlayerBagResourceCount('power_kw'),
            inputValue: sellPowerQtyBySector[s.id] ?? '10',
            setInputValue: (val: string) =>
              setSellPowerQtyBySector((prev) => ({ ...prev, [s.id]: val }))
          });
        }

        const econ = calculatePortFactoryDetailedEconomics(s);
        const factoryStatus = getPortFactoryWorkStatus(s);
        const allClansList = getAllClans();
        const controllingClanObj =
          (s.ownerClanId ? allClansList.find((c) => c.id === s.ownerClanId) : null) ||
          (s.ownerClanTag
            ? allClansList.find((c) => c.tag.toLowerCase() === (s.ownerClanTag || '').toLowerCase())
            : null);
        const controllingClanNum = controllingClanObj?.clanNumber || 101;

        const buyersList = getBuyersForFactoryProduct(outKey);
        const openProto = openProtocolsBySector[s.id] || {};
        const isProtocolsSpoilerOpen = Boolean(openProto.buyers || openProto.work || openProto.deals);
        const toggleProto = (section: 'buyers' | 'work' | 'deals') => {
          setOpenProtocolsBySector((prev) => ({
            ...prev,
            [s.id]: {
              ...(prev[s.id] || {}),
              [section]: !prev[s.id]?.[section]
            }
          }));
        };

        const handleFulfillStateOrder = () => {
          const res = fulfillPharaohStateOrder(s.id, effectiveMyNick);
          if (!res.ok) {
            showToast(`⚠️ ${res.error}`);
            return;
          }
          showToast(res.message || '📦 Госзаказ Фараона выполнен!');
          forceRefreshAll();
        };

        const handleAutoSupplyFromTerminal = () => {
          const res = autoSupplyFactoryFromTerminal(s.id, effectiveMyNick, hero.gold || 0);
          if (!res.ok) {
            showToast(`⚠️ ${res.error}`);
            return;
          }
          if (res.paidFromHeroGold > 0) {
            onUpdateHero({
              gold: Math.max(0, (hero.gold || 0) - res.paidFromHeroGold)
            });
          }
          showToast(res.message || '🚚 Сырье закуплено с Терминала!');
          forceRefreshAll();
        };

        return (
          <div className="border border-slate-700 bg-slate-950 p-2.5 space-y-2.5 text-[11px] text-slate-200">
            {/* ================================================================= */}
            {/* БЛОК 1 (ОСНОВНОЙ — ВИДЕН СРАЗУ): ШАПКА, РЕНТАБЕЛЬНОСТЬ, 2 ТАБЛИЦЫ */}
            {/* ================================================================= */}
            <div className="space-y-1.5 border-b border-slate-800 pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-amber-400 font-bold">»</span>
                  <strong className="text-amber-300 font-bold">{s.name}</strong>
                  <span className="text-slate-400 font-mono">[{secMapX}/{secMapY}]</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">Владелец:</span>
                  <strong className="text-white">{ownerName}</strong>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">Клан:</span>
                  <span className="inline-flex h-[18px] w-[18px] min-w-[18px] min-h-[18px] max-w-[18px] max-h-[18px] shrink-0 items-center justify-center overflow-hidden border border-slate-700 bg-slate-900">
                    <ItemIcon
                      icon={s.ownerClanEmblem || '👑'}
                      name={s.ownerClanName || 'Клан'}
                      className="w-3.5 h-3.5 text-[10px] leading-none"
                      imgClassName="w-3.5 h-3.5 max-w-[14px] max-h-[14px] object-contain"
                    />
                  </span>
                  <strong className="text-amber-200">
                    #{controllingClanNum} [{s.ownerClanTag || 'RB'}] {s.ownerClanName || 'Империя RedBlack'}
                  </strong>
                  <span className="text-slate-500 text-[10px]">(щит {controlRemainStr}, налог 10%)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingSectorId(null)}
                  className="text-[10.5px] text-emerald-400 hover:text-emerald-300 underline cursor-pointer shrink-0"
                >
                  « Назад к списку сектора
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-400">Статус:</span>
                  <strong className={factoryStatus.isWorking ? 'text-emerald-300' : 'text-rose-400'}>
                    {factoryStatus.statusBadge}
                  </strong>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">Касса:</span>
                  <strong className={`font-mono ${hasNoFundsForShift ? 'text-rose-400' : 'text-emerald-300'}`}>
                    {facilityCash.toLocaleString('ru-RU')} 🪙
                  </strong>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">Рабочие:</span>
                  <strong className="text-white font-mono">
                    {activeW.length}/{maxW}
                  </strong>{' '}
                  <span className="text-amber-300 font-mono">({wageGold} 🪙/ч)</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">Прочность:</span>
                  <strong
                    className={`font-mono ${
                      isBuildingBroken
                        ? 'text-rose-500'
                        : buildingDurability < 50
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                    }`}
                  >
                    {buildingDurability}/{maxBuildingDurability}
                  </strong>
                </div>

                {buildingDurability < maxBuildingDurability && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleRepairBuilding(s.id)}
                      className="border border-amber-400 bg-amber-950/60 hover:bg-amber-900 px-2 py-0.5 text-[10px] font-bold text-amber-200 cursor-pointer"
                    >
                      [ 🛠️ Ремонт (5 Руды + 2 Стали) ]
                    </button>
                    {isMyEstate && (
                      <button
                        type="button"
                        onClick={() => handleToggleRepairOrder(s.id)}
                        className="border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-cyan-300 cursor-pointer"
                      >
                        {p.repairOrderActive ? '[ Снять заявку ]' : '[ Заявка на ремонт ]'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 1) Индикатор рентабельности в окне завода (одной строкой по ТЗ) */}
              <div className="border border-slate-800 bg-slate-900/90 px-2 py-1 text-[10.5px] font-mono">
                <div className="text-slate-200">
                  Затраты на 1 цикл: Сырье (<strong className="text-amber-200">{econ.rawCostPerCycle.toLocaleString('ru-RU')} 🪙</strong>) + Энергия (<strong className="text-cyan-300">{econ.energyCostPerCycle.toLocaleString('ru-RU')} 🪙</strong>) + Зарплата (<strong className="text-amber-300">{econ.wagePerCycle.toLocaleString('ru-RU')} 🪙</strong>) = Себестоимость: <strong className="text-white">{econ.unitSelfCost.toLocaleString('ru-RU')} 🪙</strong> | Цена продажи: <strong className="text-amber-300">{econ.sellPrice.toLocaleString('ru-RU')} 🪙</strong> | Чистая прибыль владельца:{' '}
                  <strong className={econ.netOwnerProfitPerHour >= 0 ? 'text-emerald-300' : 'text-rose-400'}>
                    {econ.netOwnerProfitPerHour >= 0
                      ? `+${econ.netOwnerProfitPerHour.toLocaleString('ru-RU')}`
                      : econ.netOwnerProfitPerHour.toLocaleString('ru-RU')}{' '}
                    🪙/ч
                  </strong>
                </div>
                {econ.isUnprofitable && (
                  <div className="mt-0.5 font-bold text-rose-400">
                    ⚠️ Убыточная цена! Рекомендуемая цена: не ниже {econ.recommendedMinPrice.toLocaleString('ru-RU')} 🪙
                  </div>
                )}
              </div>
            </div>

            {/* Таблица 1: «Продукция на продажу» + Госзаказ Фараона */}
            <div className="space-y-1">
              <div className="overflow-x-auto border border-slate-700">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900 text-slate-300">
                      <th className="py-1 px-2 font-bold border-r border-slate-700">
                        {isTavernObject
                          ? 'Меню Таверны (выпуск порций/ч, на кухне)'
                          : 'Продукция на продажу (выпуск ед./ч, на складе)'}
                      </th>
                      <th className="py-1 px-2 font-bold border-r border-slate-700 text-center">
                        Вес
                      </th>
                      <th className="py-1 px-2 font-bold border-r border-slate-700 text-right">
                        Цена
                      </th>
                      <th className="py-1 px-2 font-bold text-right">
                        {isTavernObject ? 'Заказать (+25% бодр.)' : 'Купить'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-slate-950">
                      <td className="py-1.5 px-2 border-r border-slate-800">
                        <strong className="text-amber-200">{outName}</strong>{' '}
                        <span className="text-slate-400 font-mono">
                          ({outRate} ед./ч, на складе:{' '}
                          <strong className={p.relicStock >= p.maxRelicStock ? 'text-rose-400' : 'text-white'}>
                            {p.relicStock}
                          </strong>
                          /{p.maxRelicStock})
                        </span>
                      </td>
                      <td className="py-1.5 px-2 border-r border-slate-800 text-center font-mono text-slate-300">
                        {outWeight}
                      </td>
                      <td className="py-1.5 px-2 border-r border-slate-800 text-right font-mono font-bold text-amber-300">
                        {sellPrice.toLocaleString('ru-RU')} 🪙
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min={1}
                            max={Math.max(1, p.relicStock)}
                            value={buyQtyVal}
                            onChange={(e) =>
                              setBuyQtyBySector((prev) => ({
                                ...prev,
                                [s.id]: e.target.value
                              }))
                            }
                            className="w-12 border border-slate-700 bg-slate-900 px-1 py-0.5 text-center font-mono text-[11px] text-white"
                          />
                          <button
                            type="button"
                            disabled={!isTavernObject && cargoInfo.isOverloaded && outWeight > 0}
                            onClick={() =>
                              handleBuyRelicFromFactory(
                                s.id,
                                Math.max(1, Math.floor(Number(buyQtyVal) || 1))
                              )
                            }
                            className="border border-slate-600 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-2 py-0.5 font-mono font-bold text-amber-300 cursor-pointer"
                          >
                            »
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-400">
                {isTavernObject ? (
                  <span>
                    Вы можете заказать <strong className="text-white font-mono">{maxPlayerCanBuy}</strong> порц. (Бодрость:{' '}
                    <strong className="text-emerald-300 font-mono">{playerStamina}%</strong>)
                  </span>
                ) : (
                  <span>
                    Вы можете купить <strong className="text-white font-mono">{maxPlayerCanBuy}</strong> шт. (Свободный вес:{' '}
                    <strong className={cargoInfo.isOverloaded ? 'text-rose-400 font-mono' : 'text-amber-200 font-mono'}>
                      {cargoInfo.freeWeight}
                    </strong>{' '}
                    / <strong className="text-slate-200 font-mono">{cargoInfo.maxWeight}</strong> ед.)
                  </span>
                )}

                {/* 2) Механика «Госзаказ Фараона» (Защита от затоваривания складов) */}
                {isMyEstate && p.relicStock > 0 && (
                  <button
                    type="button"
                    onClick={handleFulfillStateOrder}
                    className={`border px-2 py-0.5 text-[10px] font-bold cursor-pointer ${
                      p.relicStock >= p.maxRelicStock
                        ? 'border-amber-400 bg-amber-500 text-slate-950 animate-pulse'
                        : 'border-amber-500/60 bg-slate-900 hover:bg-amber-950/40 text-amber-300'
                    }`}
                  >
                    [ 📦 Сдать партию по Госзаказу ({Math.max(1, Math.floor(p.relicStock * 0.5))} ед. по Себестоимость +15%) ]
                  </button>
                )}
              </div>
            </div>

            {/* Таблица 2: «Скупка необходимого сырья» */}
            <div className="space-y-1">
              <div className="overflow-x-auto border border-slate-700">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900 text-slate-300">
                      <th className="py-1 px-2 font-bold border-r border-slate-700">
                        Скупка необходимого сырья (расход ед./ч)
                      </th>
                      <th className="py-1 px-2 font-bold border-r border-slate-700 text-center">
                        Купит (на складе)
                      </th>
                      <th className="py-1 px-2 font-bold border-r border-slate-700 text-right">
                        Цена скупки
                      </th>
                      <th className="py-1 px-2 font-bold border-r border-slate-700 text-center">
                        У вас
                      </th>
                      <th className="py-1 px-2 font-bold text-right">Продать</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requiredInputs.length === 0 ? (
                      <tr className="bg-slate-950">
                        <td colSpan={5} className="py-1.5 px-2 text-slate-400">
                          Добывающий объект 1-го этапа (входное сырье не требуется, нужны только рабочие смены).
                        </td>
                      </tr>
                    ) : (
                      requiredInputs.map((inp) => {
                        const willBuyMax = Math.max(0, inp.maxStock - inp.stock);
                        return (
                          <tr key={`gw_res_${inp.slot}`} className="border-b border-slate-800 bg-slate-950">
                            <td className="py-1.5 px-2 border-r border-slate-800">
                              <strong className={inp.slot === 'power' ? 'text-cyan-300' : 'text-slate-100'}>
                                {inp.name}
                              </strong>{' '}
                              <span className="text-slate-400 font-mono">({inp.normPerHour} ед./ч)</span>
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-800 text-center font-mono text-slate-200">
                              {willBuyMax} ({inp.stock}/{inp.maxStock})
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-800 text-right font-mono font-bold text-emerald-300">
                              {inp.buyPrice.toLocaleString('ru-RU')} 🪙
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-800 text-center font-mono text-amber-200">
                              {inp.myBagCount}
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <div className="inline-flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  min={1}
                                  max={Math.max(1, willBuyMax)}
                                  value={inp.inputValue}
                                  onChange={(e) => inp.setInputValue(e.target.value)}
                                  className="w-12 border border-slate-700 bg-slate-900 px-1 py-0.5 text-center font-mono text-[11px] text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSellResourceToFactory(
                                      s.id,
                                      inp.slot,
                                      Math.max(1, Math.floor(Number(inp.inputValue) || 1))
                                    )
                                  }
                                  className="border border-slate-600 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 font-mono font-bold text-emerald-300 cursor-pointer"
                                >
                                  »
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Кнопка [ 🔨 Работать 2 часа ] и ссылка [ ⚔️ Напасть (7х7) ] */}
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
              <div className="flex items-center gap-2 flex-wrap">
                {myW ? (
                  nowMs >= myW.endsAt ? (
                    <button
                      type="button"
                      onClick={() => handleClaimWorkShift(s.id, false)}
                      className="border border-amber-400 bg-amber-500 px-3 py-1 text-[11px] font-bold text-slate-950 cursor-pointer"
                    >
                      [ 💰 Забрать оплату смены (+{myW.durationHours * wageGold} 🪙) ]
                    </button>
                  ) : (
                    <div className="border border-slate-700 bg-slate-900 px-3 py-1 font-mono text-[11px] font-bold text-emerald-300">
                      🔨 Вы работаете: осталось {formatRemainingTimer(myW.endsAt, nowMs)}
                    </div>
                  )
                ) : myActiveShift ? (
                  <div className="border border-slate-700 bg-slate-900 px-3 py-1 font-mono text-[11px] text-amber-300">
                    🔨 Вы работаете на «{myActiveShift.sector.name}» ({formatRemainingTimer(myActiveShift.worker.endsAt, nowMs)})
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={activeW.length >= maxW || hasNoFundsForShift || isBuildingBroken || playerStamina < 20}
                    onClick={() => handleStartWorkShift(s.id, 2)}
                    className={`border px-4 py-1 text-[11px] font-bold transition-colors ${
                      activeW.length >= maxW || hasNoFundsForShift || isBuildingBroken || playerStamina < 20
                        ? 'border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed'
                        : 'border-amber-500/70 bg-slate-800 hover:bg-slate-700 text-amber-200 cursor-pointer'
                    }`}
                  >
                    {isBuildingBroken
                      ? '[ Объект сломан (0/100) ]'
                      : hasNoFundsForShift
                      ? '[ Нет средств в кассе ]'
                      : playerStamina < 20
                      ? `[ Мало бодрости (${playerStamina}% < 20%) ]`
                      : activeW.length >= maxW
                      ? `[ Мест нет (${activeW.length}/${maxW}) ]`
                      : `[ 🔨 Работать 2 часа ]`}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (s.warStatus === 'war') {
                    setSelectedSectorId(s.id);
                  } else {
                    handleStartAssault7x7(s.id, s.name);
                  }
                }}
                className="text-[11px] font-bold text-rose-400 hover:text-rose-300 underline cursor-pointer"
              >
                [ ⚔️ Напасть (7х7) ]
              </button>
            </div>

            {/* ================================================================= */}
            {/* БЛОК 2 (СПОЙЛЕР «⚙️ Настройки владельца» — ПО УМОЛЧАНИЮ СВЁРНУТ) */}
            {/* ================================================================= */}
            {isMyEstate && (
              <div className="border border-slate-800 bg-slate-900/50">
                <button
                  type="button"
                  onClick={() => setShowOwnerSettingsForId(isSettingsOpen ? null : s.id)}
                  className="w-full px-2.5 py-1.5 flex items-center justify-between text-left text-[11px] font-bold text-amber-300 hover:bg-slate-900 cursor-pointer"
                >
                  <span>⚙️ Настройки владельца (Цены, Касса, Клан #ID и Авто-снабжение с Терминала)</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {isSettingsOpen ? '[ ▲ Свернуть ]' : '[ ▼ Развернуть ]'}
                  </span>
                </button>

                {isSettingsOpen && (() => {
                  const draft = getSectorOwnerDraft(s);
                  const balDef = getBalancedDefaultPricesForSector(s);
                  const cashAmtVal = customCashAmountBySector[s.id] ?? '5000';
                  const rangeStr = (base: number) =>
                    `${Math.round(base * 0.8)}–${Math.round(base * 1.2)}`;
                  return (
                    <div className="border-t border-slate-800 bg-slate-900 p-2.5 space-y-2.5 text-[10.5px]">
                      {/* Касса + Авто-снабжение с Терминала */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-300 font-bold">Касса:</span>
                          <input
                            type="number"
                            min={100}
                            value={cashAmtVal}
                            onChange={(e) =>
                              setCustomCashAmountBySector((prev) => ({
                                ...prev,
                                [s.id]: e.target.value
                              }))
                            }
                            className="w-20 border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-white text-center"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleManageFacilityBalance(
                                s.id,
                                'deposit',
                                Math.max(1, Math.floor(Number(cashAmtVal) || 1000))
                              )
                            }
                            className="border border-emerald-500/60 bg-slate-950 hover:bg-emerald-950/40 px-2 py-0.5 font-bold text-emerald-300 cursor-pointer"
                          >
                            [ Пополнить кассу ]
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleManageFacilityBalance(
                                s.id,
                                'withdraw',
                                Math.max(1, Math.floor(Number(cashAmtVal) || 1000))
                              )
                            }
                            className="border border-amber-500/60 bg-slate-950 hover:bg-amber-950/40 px-2 py-0.5 font-bold text-amber-300 cursor-pointer"
                          >
                            [ Снять выручку ]
                          </button>
                        </div>

                        {requiredInputs.length > 0 && (
                          <button
                            type="button"
                            onClick={handleAutoSupplyFromTerminal}
                            className="border border-cyan-400 bg-cyan-950/70 hover:bg-cyan-900 px-2.5 py-0.5 font-bold text-cyan-200 cursor-pointer"
                          >
                            [ 🚚 Закупить недостающее сырье с Терминала (+10% за доставку) ]
                          </button>
                        )}
                      </div>

                      {/* Поля цен покупки/продажи и зарплаты */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div>
                          <div className="text-[9.5px] text-slate-400">
                            Продажа ({rangeStr(balDef.productSellPriceGold)} 🪙):
                          </div>
                          <input
                            type="number"
                            value={draft.productSellPriceGold}
                            onChange={(e) =>
                              updateSectorOwnerDraft(s.id, { productSellPriceGold: e.target.value }, s)
                            }
                            className="w-full border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-white"
                          />
                        </div>
                        {tier >= 2 && (
                          <div>
                            <div className="text-[9.5px] text-slate-400">
                              Скупка #1 ({rangeStr(balDef.rawBuyPriceGold)} 🪙):
                            </div>
                            <input
                              type="number"
                              value={draft.rawBuyPriceGold}
                              onChange={(e) =>
                                updateSectorOwnerDraft(s.id, { rawBuyPriceGold: e.target.value }, s)
                              }
                              className="w-full border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-white"
                            />
                          </div>
                        )}
                        {p.input2ResourceKey && (
                          <div>
                            <div className="text-[9.5px] text-slate-400">
                              Скупка #2 ({rangeStr(balDef.input2BuyPriceGold)} 🪙):
                            </div>
                            <input
                              type="number"
                              value={draft.input2BuyPriceGold}
                              onChange={(e) =>
                                updateSectorOwnerDraft(s.id, { input2BuyPriceGold: e.target.value }, s)
                              }
                              className="w-full border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-white"
                            />
                          </div>
                        )}
                        {p.input3ResourceKey && (
                          <div>
                            <div className="text-[9.5px] text-slate-400">
                              Скупка #3 ({rangeStr(balDef.input3BuyPriceGold)} 🪙):
                            </div>
                            <input
                              type="number"
                              value={draft.input3BuyPriceGold}
                              onChange={(e) =>
                                updateSectorOwnerDraft(s.id, { input3BuyPriceGold: e.target.value }, s)
                              }
                              className="w-full border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-white"
                            />
                          </div>
                        )}
                        <div>
                          <div className="text-[9.5px] text-slate-400">
                            Зарплата ({rangeStr(balDef.workerWageGold)} 🪙/ч):
                          </div>
                          <input
                            type="number"
                            value={draft.workerWageGold}
                            onChange={(e) =>
                              updateSectorOwnerDraft(s.id, { workerWageGold: e.target.value }, s)
                            }
                            className="w-full border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-white"
                          />
                        </div>
                      </div>

                      {/* Привязка к клану по #ID и сохранение */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-slate-400">Клан #ID:</span>
                          <input
                            type="text"
                            value={draft.clanQuery}
                            onChange={(e) => updateSectorOwnerDraft(s.id, { clanQuery: e.target.value }, s)}
                            placeholder="#ID или тег клана..."
                            className="border border-slate-700 bg-slate-950 px-2 py-0.5 text-white w-36"
                          />
                          {allClansList.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  updateSectorOwnerDraft(s.id, { clanQuery: e.target.value }, s);
                                }
                              }}
                              className="border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-amber-200"
                            >
                              <option value="">Выбрать #ID...</option>
                              {allClansList.map((c) => (
                                <option key={c.id} value={String(c.clanNumber || c.tag)}>
                                  #{c.clanNumber || 100} [{c.tag}] {c.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelegateClanControl(s)}
                            className="border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-cyan-200 cursor-pointer"
                          >
                            [ Привязать к клану ]
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveOwnerPricesAndWage(s)}
                          className="border border-amber-400 bg-amber-500 hover:bg-amber-400 px-3 py-0.5 font-bold text-slate-950 cursor-pointer"
                        >
                          [ Сохранить цены ]
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ================================================================= */}
            {/* БЛОК 3 (СПОЙЛЕР «📊 Протоколы и Сбыт» — ПО УМОЛЧАНИЮ СВЁРНУТ)    */}
            {/* ================================================================= */}
            <div className="border border-slate-800 bg-slate-900/50 text-[10.5px]">
              <div className="px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-300">📊 Протоколы и Сбыт:</span>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => toggleProto('buyers')}
                    className={`cursor-pointer underline font-bold ${
                      openProto.buyers ? 'text-amber-300' : 'text-emerald-400 hover:text-emerald-300'
                    }`}
                  >
                    » Сбыт продукции ({buyersList.length})
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => toggleProto('work')}
                    className={`cursor-pointer underline font-bold ${
                      openProto.work ? 'text-amber-300' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    » Логи смен ({(p.workLogs || []).length}/20)
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => toggleProto('deals')}
                    className={`cursor-pointer underline font-bold ${
                      openProto.deals ? 'text-amber-300' : 'text-cyan-300 hover:text-cyan-200'
                    }`}
                  >
                    » Транзакции кассы ({(p.dealLogs || []).length})
                  </button>
                </div>
              </div>

              {isProtocolsSpoilerOpen && (
                <div className="border-t border-slate-800 p-2 space-y-2">
                  {/* 1. Навигатор сбыта: Где покупают эту продукцию */}
                  {openProto.buyers && (
                    <div className="border border-slate-700 bg-slate-900/80 overflow-x-auto">
                      <div className="border-b border-slate-700 bg-slate-900 px-2 py-1 font-bold text-emerald-300">
                        Объекты на карте, закупающие ресурс «{outName}»:
                      </div>
                      {buyersList.length === 0 ? (
                        <div className="p-2 text-slate-400">
                          Этот ресурс является конечной продукцией (применяется игроками напрямую и не скупается другими цехами).
                        </div>
                      ) : (
                        <table className="w-full border-collapse text-left text-[10.5px]">
                          <thead>
                            <tr className="border-b border-slate-700 bg-slate-950 text-slate-400">
                              <th className="py-1 px-2 border-r border-slate-800">Сектор / Объект</th>
                              <th className="py-1 px-2 border-r border-slate-800 text-center">Склад ресурса</th>
                              <th className="py-1 px-2 border-r border-slate-800 text-right">Цена скупки</th>
                              <th className="py-1 px-2 border-r border-slate-800 text-right">Касса</th>
                              <th className="py-1 px-2 text-right">Переход</th>
                            </tr>
                          </thead>
                          <tbody>
                            {buyersList.map((bItem) => (
                              <tr key={`buyer_${bItem.sectorId}`} className="border-b border-slate-800 bg-slate-950">
                                <td className="py-1 px-2 border-r border-slate-800">
                                  <span className="font-mono text-amber-300">[{bItem.mapX}/{bItem.mapY}]</span>{' '}
                                  <strong className="text-slate-200">{bItem.sectorName}</strong>
                                </td>
                                <td className="py-1 px-2 border-r border-slate-800 text-center font-mono text-slate-300">
                                  {bItem.currentStock}/{bItem.maxStock} ({bItem.requiredPerHour}/ч)
                                </td>
                                <td className="py-1 px-2 border-r border-slate-800 text-right font-mono font-bold text-emerald-300">
                                  {bItem.buyPriceGold.toLocaleString('ru-RU')} 🪙
                                </td>
                                <td className="py-1 px-2 border-r border-slate-800 text-right font-mono text-slate-300">
                                  {bItem.cashBalanceGold.toLocaleString('ru-RU')} 🪙
                                </td>
                                <td className="py-1 px-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleSelectCellForPreview(bItem.mapX, bItem.mapY);
                                      setInspectingSectorId(bItem.sectorId);
                                    }}
                                    className="text-emerald-400 underline cursor-pointer"
                                  >
                                    Открыть [{bItem.mapX}/{bItem.mapY}]
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* 2. Протокол работы (последние 20 смен) */}
                  {openProto.work && (
                    <div className="border border-slate-700 bg-slate-900/80 overflow-x-auto">
                      <div className="border-b border-slate-700 bg-slate-900 px-2 py-1 font-bold text-amber-300">
                        Протокол работы (последние 20 смен):
                      </div>
                      {(p.workLogs || []).length === 0 ? (
                        <div className="p-2 text-slate-400">Записей о завершенных сменах пока нет.</div>
                      ) : (
                        <table className="w-full border-collapse text-left text-[10.5px]">
                          <thead>
                            <tr className="border-b border-slate-700 bg-slate-950 text-slate-400">
                              <th className="py-1 px-2 border-r border-slate-800">Дата / Время</th>
                              <th className="py-1 px-2 border-r border-slate-800">Ник игрока</th>
                              <th className="py-1 px-2 border-r border-slate-800 text-center">Отработано часов</th>
                              <th className="py-1 px-2 text-right">Выплачено золота</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(p.workLogs || []).map((wl) => {
                              const wlClan = getPlayerClan(wl.playerNick);
                              const wlRank = getPlayerClanRankAndPts(wl.playerNick, wlClan?.id);
                              return (
                                <tr key={wl.id} className="border-b border-slate-800 bg-slate-950">
                                  <td className="py-1 px-2 border-r border-slate-800 font-mono text-slate-400">
                                    {new Date(wl.timestamp).toLocaleString('ru-RU', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </td>
                                  <td className="py-1 px-2 border-r border-slate-800 font-bold text-slate-200">
                                    <div className="inline-flex items-center gap-1 flex-wrap">
                                      {wlClan && (
                                        <ClanBadgeMini
                                          emblem={wlClan.emblem}
                                          tag={wlClan.tag}
                                          clanName={wlClan.name}
                                        />
                                      )}
                                      <ClanRankEpaulette rankLevel={wlRank.rankLevel} size="sm" />
                                      <span>{wl.playerNick}</span>
                                    </div>
                                  </td>
                                  <td className="py-1 px-2 border-r border-slate-800 text-center font-mono text-slate-300">
                                    {wl.hoursWorked} ч.
                                  </td>
                                  <td className="py-1 px-2 text-right font-mono font-bold text-amber-300">
                                    {wl.goldPaid.toLocaleString('ru-RU')} 🪙
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* 3. Протокол сделок и кассы */}
                  {openProto.deals && (
                    <div className="border border-slate-700 bg-slate-900/80 overflow-x-auto">
                      <div className="border-b border-slate-700 bg-slate-900 px-2 py-1 font-bold text-cyan-300">
                        Протокол сделок, инкассации и авто-налога клану (10%):
                      </div>
                      {(p.dealLogs || []).length === 0 ? (
                        <div className="p-2 text-slate-400">Операций по кассе объекта пока нет.</div>
                      ) : (
                        <table className="w-full border-collapse text-left text-[10.5px]">
                          <thead>
                            <tr className="border-b border-slate-700 bg-slate-950 text-slate-400">
                              <th className="py-1 px-2 border-r border-slate-800">Дата / Время</th>
                              <th className="py-1 px-2 border-r border-slate-800">Игрок</th>
                              <th className="py-1 px-2 border-r border-slate-800">Операция / Детали</th>
                              <th className="py-1 px-2 text-right">Изменение кассы</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(p.dealLogs || []).map((dl) => {
                              const goldVal = Number(dl.goldAmount ?? dl.goldDelta ?? 0);
                              return (
                                <tr key={dl.id} className="border-b border-slate-800 bg-slate-950">
                                  <td className="py-1 px-2 border-r border-slate-800 font-mono text-slate-400">
                                    {new Date(dl.timestamp).toLocaleString('ru-RU', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </td>
                                  <td className="py-1 px-2 border-r border-slate-800 font-bold text-slate-200">
                                    {dl.actorNick}
                                  </td>
                                  <td className="py-1 px-2 border-r border-slate-800 text-slate-300">
                                    <strong className="text-amber-200">{dl.resourceName || 'Операция'}</strong>{' '}
                                    {dl.quantity ? `(${dl.quantity} шт.) — ` : ''}
                                    {dl.note || dl.text || ''}
                                  </td>
                                  <td
                                    className={`py-1 px-2 text-right font-mono font-bold ${
                                      goldVal >= 0 ? 'text-emerald-300' : 'text-rose-400'
                                    }`}
                                  >
                                    {goldVal >= 0 ? `+${goldVal.toLocaleString('ru-RU')}` : goldVal.toLocaleString('ru-RU')} 🪙
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* БЛОК 3: ВКЛАДКИ ТИПОВ ПОСТРОЕК (2 РЯДА) И ПЛОСКИЙ ТАБЛИЧНЫЙ СПИСОК    */}
      {/* ===================================================================== */}
      <div className="border border-slate-700 bg-slate-950">
        {/* Табличная шапка фильтрации в 2 ряда (простые текстовые ссылки как в Gwars) */}
        <div className="border-b border-slate-700 bg-slate-900 px-2 py-1 text-center space-y-0.5 text-[11px]">
          {/* Ряд 1: Добыча | Заводы | Мануфактуры | Энергосеть | Бары / Таверны */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setBuildingCategoryFilter('extraction')}
              className={`cursor-pointer hover:underline ${
                buildingCategoryFilter === 'extraction' ? 'font-bold text-amber-300 underline' : 'text-emerald-400'
              }`}
            >
              Добыча
            </button>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={() => setBuildingCategoryFilter('raw_processing')}
              className={`cursor-pointer hover:underline ${
                buildingCategoryFilter === 'raw_processing' ? 'font-bold text-amber-300 underline' : 'text-emerald-400'
              }`}
            >
              Заводы
            </button>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={() => setBuildingCategoryFilter('dual_manufactory')}
              className={`cursor-pointer hover:underline ${
                buildingCategoryFilter === 'dual_manufactory' ? 'font-bold text-amber-300 underline' : 'text-emerald-400'
              }`}
            >
              Мануфактуры
            </button>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={() => setBuildingCategoryFilter('power_plant')}
              className={`cursor-pointer hover:underline ${
                buildingCategoryFilter === 'power_plant' ? 'font-bold text-amber-300 underline' : 'text-emerald-400'
              }`}
            >
              Энергосеть
            </button>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={() => setBuildingCategoryFilter('tavern')}
              className={`cursor-pointer hover:underline ${
                buildingCategoryFilter === 'tavern' ? 'font-bold text-amber-300 underline' : 'text-emerald-400'
              }`}
            >
              Бары / Таверны
            </button>
          </div>

          {/* Ряд 2: Склады | Сломанное | Все объекты */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setBuildingCategoryFilter('warehouses')}
              className={`cursor-pointer hover:underline ${
                buildingCategoryFilter === 'warehouses' ? 'font-bold text-amber-300 underline' : 'text-emerald-400'
              }`}
            >
              Склады
            </button>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={() => setBuildingCategoryFilter('broken')}
              className={`cursor-pointer hover:underline ${
                buildingCategoryFilter === 'broken' ? 'font-bold text-amber-300 underline' : 'text-emerald-400'
              }`}
            >
              Сломанное
            </button>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={() => {
                setBuildingCategoryFilter('all');
                setIslandScopeMode((prev) => (prev === 'current_sector' ? 'all_sectors' : 'current_sector'));
              }}
              className={`cursor-pointer hover:underline ${
                buildingCategoryFilter === 'all' ? 'font-bold text-amber-300 underline' : 'text-emerald-400'
              }`}
            >
              Все объекты ({islandScopeMode === 'current_sector' ? `сектор [${viewedIslandX}/${viewedIslandY}]` : 'весь остров'})
            </button>
          </div>
        </div>

        {/* Переключатель: выбранный/текущий сектор [X/Y] или все объекты острова */}
        <div className="border-b border-slate-800 bg-slate-900/50 px-2 py-0.5 flex items-center justify-between text-[10px] text-slate-400">
          <span>
            {islandScopeMode === 'current_sector'
              ? isPreviewingOtherCell
                ? `Осмотр построек сектора [${viewedIslandX}/${viewedIslandY}] (${viewedCellMeta.sectorTitle})`
                : `Объекты текущего сектора [${curIslandX}/${curIslandY}]`
              : `Все объекты острова (${territories.length} производств)`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIslandScopeMode('current_sector')}
              className={`cursor-pointer hover:underline ${
                islandScopeMode === 'current_sector' ? 'text-amber-300 font-bold' : 'text-slate-400'
              }`}
            >
              Сектор [{viewedIslandX}/{viewedIslandY}]
            </button>
            <span>|</span>
            <button
              type="button"
              onClick={() => setIslandScopeMode('all_sectors')}
              className={`cursor-pointer hover:underline ${
                islandScopeMode === 'all_sectors' ? 'text-amber-300 font-bold' : 'text-slate-400'
              }`}
            >
              Весь остров ({territories.length})
            </button>
          </div>
        </div>

        {/* Плоский табличный список построек (каждый объект — строго 1 тонкая строка высотой 32px) */}
        {(() => {
          const filteredRows = territories.filter((sector) => {
            if (islandScopeMode === 'current_sector') {
              if ((sector.mapX ?? 7) !== viewedIslandX || (sector.mapY ?? 6) !== viewedIslandY) {
                return false;
              }
            }
            const isBroken = (sector.production?.buildingDurability ?? 100) <= 0;
            if (buildingCategoryFilter === 'broken') {
              return isBroken || sector.warStatus === 'war';
            }
            if (isBroken && buildingCategoryFilter !== 'all') {
              return false;
            }
            if (buildingCategoryFilter === 'warehouses') {
              return (sector.production?.relicStock ?? 0) > 0;
            }
            if (buildingCategoryFilter === 'power_plant') {
              return (
                sector.buildingCategory === 'power_plant' ||
                sector.production?.outputResourceKey === 'power_kw'
              );
            }
            if (buildingCategoryFilter === 'tavern') {
              return (
                sector.buildingCategory === 'tavern' ||
                sector.production?.outputResourceKey === 'tavern_meal'
              );
            }
            if (buildingCategoryFilter !== 'all') {
              const tier =
                sector.production?.productionTier ||
                (sector.production?.productionStage === 'extraction'
                  ? 1
                  : sector.production?.requiresDualInput
                  ? 3
                  : 2);
              const cat =
                sector.buildingCategory === 'power_plant' || sector.buildingCategory === 'tavern'
                  ? sector.buildingCategory
                  : tier === 1
                  ? 'extraction'
                  : tier === 2
                  ? 'raw_processing'
                  : 'dual_manufactory';
              if (cat !== buildingCategoryFilter) return false;
            }
            return true;
          });

          if (filteredRows.length === 0) {
            return (
              <div className="py-2 px-2 text-center text-[11px] text-slate-400">
                В секторе [{viewedIslandX}/{viewedIslandY}] ({viewedCellMeta.sectorTitle}) объектов этой категории нет.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setBuildingCategoryFilter('all');
                    setIslandScopeMode('all_sectors');
                  }}
                  className="text-emerald-400 underline cursor-pointer"
                >
                  Показать все объекты острова ({territories.length})
                </button>
              </div>
            );
          }

          return (
            <table className="w-full border-collapse text-[11px]">
              <tbody>
                {filteredRows.map((sector) => {
                  const secMapX = sector.mapX ?? 7;
                  const secMapY = sector.mapY ?? 6;
                  const ownerName = sector.ownerNick || DEFAULT_PORT_ESTATE_OWNER_NICK;
                  const wageGold = sector.production?.workerWageGold || PORT_WORKER_GOLD_PER_HOUR;
                  const workSt = getPortFactoryWorkStatus(sector);
                  const isSelected = inspectingSectorId === sector.id;

                  return (
                    <tr
                      key={sector.id}
                      style={{ height: '34px' }}
                      onClick={() => {
                        if (isMovingOnIsland) {
                          showToast('⏳ Вы в пути! Дождитесь окончания таймера перехода.');
                          return;
                        }
                        setInspectingSectorId(isSelected ? null : sector.id);
                      }}
                      className={`h-[34px] border-b border-slate-800/90 transition-colors select-none ${
                        isMovingOnIsland
                          ? 'opacity-60 cursor-wait'
                          : 'cursor-pointer hover:bg-slate-900'
                      } ${isSelected ? 'bg-amber-950/35' : ''}`}
                    >
                      {/* Слева: значок клана 18x18px + Название объекта + Владелец */}
                      <td className="px-2 py-0 align-middle truncate">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <span
                            className="inline-flex h-[18px] w-[18px] min-w-[18px] min-h-[18px] max-w-[18px] max-h-[18px] shrink-0 items-center justify-center overflow-hidden border border-slate-700 bg-slate-900"
                            title={`[${sector.ownerClanTag || 'RB'}] ${sector.ownerClanName || 'Империя RedBlack'}`}
                          >
                            <ItemIcon
                              icon={sector.ownerClanEmblem || '👑'}
                              name={sector.ownerClanName || ownerName}
                              className="w-3.5 h-3.5 text-[10px] leading-none"
                              imgClassName="w-3.5 h-3.5 max-w-[14px] max-h-[14px] object-contain"
                            />
                          </span>

                          <span className="font-bold text-amber-300 hover:underline truncate">
                            {sector.name}
                          </span>

                          <span className="text-slate-400 truncate text-[10px]">
                            ({ownerName})
                          </span>

                          {islandScopeMode === 'all_sectors' && (
                            <span className="text-slate-500 font-mono text-[10px]">
                              [{secMapX}/{secMapY}]
                            </span>
                          )}

                          {sector.warStatus === 'war' && (
                            <span className="text-rose-400 font-bold text-[10px]">[⚔️ ШТУРМ]</span>
                          )}
                        </div>
                      </td>

                      {/* Статус работы: 🟢 Работает / 🔴 Стоит */}
                      <td className="px-2 py-0 align-middle text-right whitespace-nowrap text-[10px] font-bold">
                        <span className={workSt.isWorking ? 'text-emerald-400' : 'text-rose-400'}>
                          {workSt.statusBadge}
                        </span>
                      </td>

                      {/* Справа: зарплата за час */}
                      <td className="px-2 py-0 align-middle text-right font-mono font-bold whitespace-nowrap">
                        <span className={!workSt.isWorking ? 'text-slate-400' : 'text-amber-300'}>
                          {wageGold} 🪙/ч
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })()}
      </div>

      {/* АКТИВНОЕ ЛОББИ СБОРА ИЛИ ПОЛЕ БОЯ НА КЛЕТКАХ 7х7 (ОТКРЫВАЕТСЯ ПО КНОПКЕ АТАКИ) */}
      {effectiveSelectedSector && effectiveSelectedSector.warStatus === 'war' && effectiveSelectedSector.battle7x7 && (
        <div className="border border-rose-500 bg-slate-950 p-3 space-y-2.5">
          {(() => {
            const sec = effectiveSelectedSector;
            const b = sec.battle7x7!;
            const isAttackerClan = Boolean(clan && sec.attackerClanId === clan.id);
            const isAlliedDefenderClan = Boolean(
              clan && sec.ownerClanId && areClansAllied(sec.ownerClanId, clan.id)
            );
            const isDefenderClan = Boolean(
              clan && (sec.ownerClanId === clan.id || !sec.ownerClanId || isAlliedDefenderClan)
            );
            const isParticipantClan = isAttackerClan || isDefenderClan;
            const mySide: 'attacker' | 'defender' = isAttackerClan ? 'attacker' : 'defender';
            const myRoster = mySide === 'attacker' ? b.attackers : b.defenders;
            const enemyRoster = mySide === 'attacker' ? b.defenders : b.attackers;

            const myFighterOnGrid = myRoster.find((f) => f.nick.toLowerCase() === myNick.toLowerCase());
            const isAlreadyJoined = Boolean(myFighterOnGrid);
            const isTeamFullForMe = myRoster.length >= 7 && !isAlreadyJoined;

            const atkAliveCount = b.attackers.filter((f) => f.alive && f.hp > 0).length;
            const defAliveCount = b.defenders.filter((f) => f.alive && f.hp > 0).length;

            const isCombatPhase = b.phase === 'combat';
            const turnRemainingSec = isCombatPhase
              ? Math.max(0, Math.ceil((b.roundEndsAt - nowMs) / 1000))
              : 20;

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
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/30 pb-2">
                  <div>
                    <div className="font-black uppercase text-rose-300">
                      ⚔️ Штурм объекта 7х7: «{sec.name}» ({b.phase === 'gathering' ? `Сбор: ${formatShortMinSec(b.gatheringEndsAt, nowMs)}` : `Ход #${b.currentRound}: ${turnRemainingSec} сек.`})
                    </div>
                    <div className="text-[10px] text-slate-300">
                      Атака [{sec.attackerClanTag}] ({atkAliveCount}/{b.attackers.length}) vs Защита [{sec.ownerClanTag || 'RB'}] ({defAliveCount}/{b.defenders.length})
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {clan && isParticipantClan && b.phase === 'gathering' && (
                      <button
                        type="button"
                        onClick={() => handleFillTeamWithClanMates(sec.id)}
                        className="border border-amber-400/70 bg-amber-950/50 px-2 py-1 text-[10px] font-bold text-amber-200 cursor-pointer"
                      >
                        Призвать соклановцев
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAdvanceOrStartBattle(sec.id)}
                      className="border border-rose-400 bg-rose-600 px-2.5 py-1 text-[10px] font-black text-white cursor-pointer"
                    >
                      {b.phase === 'gathering' ? 'Начать бой 7х7' : `Завершить ход #${b.currentRound}`}
                    </button>
                  </div>
                </div>

                {clan && isParticipantClan && b.phase === 'gathering' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border border-slate-800 bg-slate-900 p-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(['tank', 'dps', 'support'] as TerritoryFighterRole[]).map((rKey) => (
                        <button
                          key={rKey}
                          type="button"
                          onClick={() => setSelectedRole(rKey)}
                          className={`border px-2 py-0.5 text-[10px] cursor-pointer ${
                            selectedRole === rKey ? 'border-amber-400 bg-amber-500/20 text-amber-200 font-bold' : 'border-slate-700 text-slate-400'
                          }`}
                        >
                          {ROLE_CONFIG[rKey].short}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleJoinOrUpdateMySlot(sec.id)}
                      className="border border-emerald-400 bg-emerald-600 px-3 py-1 text-[10.5px] font-bold text-white cursor-pointer"
                    >
                      {isTeamFullForMe
                        ? 'Мест нет (В очередь)'
                        : isAlreadyJoined
                        ? 'Обновить слот в бою'
                        : `Вступить в бой (${myRoster.length}/7)`}
                    </button>
                  </div>
                )}

                {isCombatPhase && myFighterOnGrid && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      disabled={!canIActNow}
                      onClick={() => handleManualCellStrike(sec.id, effectiveTargetEnemy?.nick, 'strike')}
                      className="border border-rose-400 bg-rose-700 py-1 px-2 text-[10px] font-bold text-white cursor-pointer disabled:opacity-40"
                    >
                      ⚔️ Удар по клетке
                    </button>
                    <button
                      type="button"
                      disabled={!canIActNow}
                      onClick={() => handleManualCellStrike(sec.id, effectiveTargetEnemy?.nick, 'skill_power')}
                      className="border border-amber-400 bg-amber-600 py-1 px-2 text-[10px] font-bold text-slate-950 cursor-pointer disabled:opacity-40"
                    >
                      💥 Мощный пробив
                    </button>
                    <button
                      type="button"
                      disabled={!canIActNow}
                      onClick={() => handleManualCellStrike(sec.id, effectiveTargetEnemy?.nick, 'skill_shield')}
                      className="border border-sky-400 bg-sky-700 py-1 px-2 text-[10px] font-bold text-white cursor-pointer disabled:opacity-40"
                    >
                      🛡 Щит (-50%)
                    </button>
                    <button
                      type="button"
                      disabled={!canIActNow}
                      onClick={() => handleManualCellStrike(sec.id, effectiveTargetEnemy?.nick, 'skill_heal')}
                      className="border border-emerald-400 bg-emerald-700 py-1 px-2 text-[10px] font-bold text-white cursor-pointer disabled:opacity-40"
                    >
                      ✨ Перевязка
                    </button>
                  </div>
                )}

                <div className="space-y-1.5">
                  {Array.from({ length: 7 }).map((_, cellIdx) => (
                    <div
                      key={`grid_row_${cellIdx}`}
                      className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-1.5 border border-slate-800 bg-slate-900/60 p-1"
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
                      <div className="text-center font-mono text-[9px] text-slate-400 px-1">
                        #{cellIdx + 1}
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
              </>
            );
          })()}
        </div>
      )}
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

