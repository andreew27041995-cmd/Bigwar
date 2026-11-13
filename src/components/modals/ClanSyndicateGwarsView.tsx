import React, { useState, useEffect } from 'react';
import {
  Clan,
  HeroState,
  PortTerminalResourceKey,
  ClanMemberPermissions
} from '../../types/game';
import {
  getClanSyndicateRanksCatalog,
  getClanSyndicateRankByLevel,
  getPlayerClanRankAndPts,
  purchaseClanMilitaryRank,
  distributeClanPtsFromPool,
  updateClanMemberPermissions,
  getClanBaseBuildingsCatalog,
  upgradeClanBaseBuilding,
  chargeClanBasePowerStation,
  setClanDiplomacyStatus,
  proposeClanAllianceByNumber,
  acceptClanAllianceProposal,
  transferInterclanResourceByNumber,
  findClanByNumberOrId,
  formatClanFullLabel,
  getAllClans,
  getSyndicateRatingList,
  getClanTerritories,
  issueClanMemberBadge,
  CLAN_BADGE_COST_GOLD,
  ClanBaseBuildingKey,
  getPortAllResourcesCatalog,
  createClanSupplyOrder,
  deleteClanSupplyOrder,
  fulfillClanSupplyOrder,
  transferClanLeadership
} from '../../utils/clanStorage';
import { ClanRankEpaulette, ClanBadgeMini } from '../ClanRankEpaulette';

export type SyndicateGwarsSubTab =
  | 'voentorg_ranks'
  | 'clan_base'
  | 'diplomacy_transfers'
  | 'clan_rating'
  | 'roster_permissions'
  | 'treasury_log';

interface ClanSyndicateGwarsViewProps {
  clan: Clan;
  hero: HeroState;
  playerNick?: string;
  myNick?: string;
  isAdmin?: boolean;
  initialSubTab?: SyndicateGwarsSubTab;
  /** Если передан forcedSection, отображается СТРОГО только этот раздел без дублирования */
  forcedSection?: SyndicateGwarsSubTab;
  onUpdateHero: (patch: Partial<HeroState>) => void;
  onRefreshClan?: () => void;
  triggerRefresh?: () => void;
  onShowToast?: (msg: string) => void;
  showToast?: (msg: string) => void;
}

export const ClanSyndicateGwarsView: React.FC<ClanSyndicateGwarsViewProps> = ({
  clan,
  hero,
  playerNick: playerNickProp,
  myNick,
  isAdmin = false,
  initialSubTab = 'voentorg_ranks',
  forcedSection,
  onUpdateHero,
  onRefreshClan: onRefreshClanProp,
  triggerRefresh,
  onShowToast,
  showToast
}) => {
  const playerNick = playerNickProp || myNick || hero.nick || 'RedBlack';
  const onRefreshClan = () => {
    if (onRefreshClanProp) onRefreshClanProp();
    if (triggerRefresh) triggerRefresh();
  };

  const [subTab, setSubTab] = useState<SyndicateGwarsSubTab>(forcedSection || initialSubTab);
  useEffect(() => {
    if (forcedSection) {
      setSubTab(forcedSection);
    }
  }, [forcedSection]);

  const activeSection: SyndicateGwarsSubTab = forcedSection || subTab;

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [ptsTargetNick, setPtsTargetNick] = useState<string>(clan.members[0]?.nick || playerNick);
  const [ptsGrantAmount, setPtsGrantAmount] = useState<number>(500);
  const [powerResourceKey, setPowerResourceKey] = useState<'power_kw' | 'alchemy_reagents'>('power_kw');
  const [powerLoadQty, setPowerLoadQty] = useState<number>(5);
  const [ratingSortBy, setRatingSortBy] = useState<'pts' | 'estates' | 'level'>('pts');

  // Поля формы «Межклановый перевод по #ID»
  const [transferTargetNumInput, setTransferTargetNumInput] = useState<string>('105');
  const [transferResType, setTransferResType] = useState<'pts' | 'gold'>('pts');
  const [transferAmountInput, setTransferAmountInput] = useState<number>(200);

  // Поля формы «Дипломатическое действие по #ID»
  const [diplomacyTargetNumInput, setDiplomacyTargetNumInput] = useState<string>('105');

  // Поля формы «Клановые Заказы на Снабжение»
  const [newOrderResKey, setNewOrderResKey] = useState<PortTerminalResourceKey>('titanium_plate');
  const [newOrderQty, setNewOrderQty] = useState<number>(5);
  const [newOrderPrice, setNewOrderPrice] = useState<number>(4800);
  const [deliverQtyByOrderId, setDeliverQtyByOrderId] = useState<Record<string, number>>({});
  const [transferLeaderNickInput, setTransferLeaderNickInput] = useState<string>('');

  const notify = (msg: string) => {
    setStatusMsg(msg);
    if (onShowToast) onShowToast(msg);
    else if (showToast) showToast(msg);
  };

  const myRankInfo = getPlayerClanRankAndPts(playerNick, clan.id, hero);
  const ranksCatalog = getClanSyndicateRanksCatalog();
  const baseCatalog = getClanBaseBuildingsCatalog(clan);
  const allSectors = getClanTerritories();
  const allClansList = getAllClans();

  const controlledSectors = allSectors.filter(
    (s) =>
      s.ownerClanId === clan.id ||
      (s.ownerClanTag && clan.tag && s.ownerClanTag.toLowerCase() === clan.tag.toLowerCase())
  );

  const actorLower = playerNick.trim().toLowerCase();
  const myMember = clan.members.find((m) => m.nick.trim().toLowerCase() === actorLower);
  const isLeader =
    Boolean(isAdmin) ||
    clan.leaderNick.trim().toLowerCase() === actorLower ||
    myMember?.role === 'leader';

  const canDistributePts = Boolean(isLeader || myMember?.permissions?.canDistributePtsAndTreasury);
  const canManageBase = Boolean(isLeader || myMember?.permissions?.canManageBaseAndDiplomacy);

  const portRes = hero.portResources || {};
  const haveSteel = Math.max(0, Math.floor(Number(portRes.hardened_steel || 0)));
  const haveModules = Math.max(0, Math.floor(Number(portRes.combat_modules || 0)));
  const haveRelics = Math.max(0, Math.floor(Number(portRes.port_relics || 0)));
  const havePowerKw = Math.max(0, Math.floor(Number(portRes.power_kw || 0)));
  const haveReagents = Math.max(0, Math.floor(Number(portRes.alchemy_reagents || 0)));

  const matchedTransferClan = findClanByNumberOrId(transferTargetNumInput);
  const matchedDiplomacyClan = findClanByNumberOrId(diplomacyTargetNumInput);

  const handleToggleBadgeEquipped = () => {
    if (!myRankInfo.badgeOwned) {
      notify('🛡️ У вас еще нет выданного Знака клана! Получите его во вкладке «Состав».');
      return;
    }
    const nextEquipped = !myRankInfo.badgeEquipped;
    onUpdateHero({
      clanBadgeEquipped: nextEquipped,
      hasClanBadge: true
    });
    notify(
      nextEquipped
        ? `🛡️ «Знак клана [${clan.tag}]» НАДЕТ! Бонусы вашего Погона («${myRankInfo.rank.title}») и доступ к боям 7х7 активированы.`
        : `⚠️ «Знак клана [${clan.tag}]» СНЯТ! Бонусы Погона и доступ к штурмам 7х7 временно отключены.`
    );
  };

  const handleBuyRank = (targetLevel: number) => {
    const res = purchaseClanMilitaryRank(
      playerNick,
      targetLevel,
      hero.gold || 0,
      myRankInfo.pts,
      myRankInfo.rankLevel
    );
    if (!res.ok) {
      notify(`❌ ${res.error}`);
      return;
    }
    onUpdateHero({
      gold: Math.max(0, (hero.gold || 0) - (res.goldSpent || 0)),
      clanRankLevel: res.newRankLevel,
      clanPts: myRankInfo.pts
    });
    onRefreshClan();
    notify(res.message || '🎖️ Погон успешно куплен!');
  };

  const handleDistributePoolPts = () => {
    const res = distributeClanPtsFromPool(clan.id, playerNick, ptsTargetNick, ptsGrantAmount);
    if (!res.ok) {
      notify(`❌ ${res.error}`);
      return;
    }
    if (ptsTargetNick.trim().toLowerCase() === actorLower && typeof res.newMemberPts === 'number') {
      onUpdateHero({ clanPts: res.newMemberPts });
    }
    onRefreshClan();
    notify(res.message || '⭐ Опыт PTS выдан из пула клана!');
  };

  const handleUpgradeBaseBuilding = (bKey: ClanBaseBuildingKey) => {
    const res = upgradeClanBaseBuilding(clan.id, playerNick, bKey, portRes);
    if (!res.ok) {
      notify(`❌ ${res.error}`);
      return;
    }
    if (res.spentResources) {
      const nextPortRes: Partial<Record<PortTerminalResourceKey, number>> = { ...portRes };
      (Object.keys(res.spentResources) as PortTerminalResourceKey[]).forEach((k) => {
        const spent = Number(res.spentResources![k] || 0);
        nextPortRes[k] = Math.max(0, Number(nextPortRes[k] || 0) - spent);
      });
      onUpdateHero({ portResources: nextPortRes });
    }
    onRefreshClan();
    notify(res.message || '🏰 Строение базы улучшено!');
  };

  const handleChargePowerStation = () => {
    const avail = powerResourceKey === 'power_kw' ? havePowerKw : haveReagents;
    const res = chargeClanBasePowerStation(
      clan.id,
      playerNick,
      powerResourceKey,
      powerLoadQty,
      avail
    );
    if (!res.ok) {
      notify(`❌ ${res.error}`);
      return;
    }
    const used = res.usedQty || 0;
    const nextPortRes: Partial<Record<PortTerminalResourceKey, number>> = {
      ...portRes,
      [powerResourceKey]: Math.max(0, avail - used)
    };
    onUpdateHero({
      portResources: nextPortRes,
      clanPts: (myRankInfo.pts || 0) + used * 15
    });
    onRefreshClan();
    notify(res.message || '⚡ Зарядная станция пополнена!');
  };

  const handleFreeInfirmaryHeal = () => {
    if ((clan.baseBuildings?.infirmaryLevel || 1) < 4 && !baseCatalog.alliedSharedInfirmaryClan) {
      notify('🏥 Бесплатное 100% восстановление HP перед боем 7х7 доступно на 4-м уровне Лазарета!');
      return;
    }
    if (!baseCatalog.isPowered && !baseCatalog.alliedSharedInfirmaryClan) {
      notify('⚡ Зарядная станция Базы клана разряжена! Зарядите её для работы Лазарета.');
      return;
    }
    const now = Date.now();
    const lastHeal = Number(hero.lastClanInfirmaryHealAt || 0);
    const cooldownMs = 60 * 60 * 1000;
    if (now - lastHeal < cooldownMs) {
      const remMin = Math.ceil((cooldownMs - (now - lastHeal)) / 60000);
      notify(`⏳ Лазарет клана перезаряжается! Доступно через ${remMin} мин.`);
      return;
    }
    onUpdateHero({
      hp: hero.maxHp || 100,
      lastClanInfirmaryHealAt: now
    });
    notify('🏥 Лазарет Клана (Ур. 4): Ваше здоровье полностью восстановлено до 100% перед боем 7х7!');
  };

  const handlePermissionToggle = (
    memberNick: string,
    permKey: keyof ClanMemberPermissions,
    currentVal: boolean
  ) => {
    const res = updateClanMemberPermissions(clan.id, playerNick, memberNick, {
      [permKey]: !currentVal
    });
    if (!res.ok) {
      notify(`❌ ${res.error}`);
      return;
    }
    onRefreshClan();
    notify(res.message || '✅ Права обновлены');
  };

  const handleInterclanTransfer = () => {
    const res = transferInterclanResourceByNumber(
      clan.id,
      playerNick,
      transferTargetNumInput,
      transferResType,
      transferAmountInput
    );
    if (!res.ok) {
      notify(`❌ ${res.error}`);
      return;
    }
    onRefreshClan();
    notify(res.message || '✅ Межклановый перевод выполнен!');
  };

  const handleProposeAllianceByNum = (targetInput?: string | number) => {
    const target = targetInput ?? diplomacyTargetNumInput;
    const res = proposeClanAllianceByNumber(clan.id, playerNick, target);
    if (!res.ok) {
      notify(`❌ ${res.error}`);
      return;
    }
    onRefreshClan();
    notify(res.message || '📨 Заявка на Союз отправлена!');
  };

  const handleAcceptAlliance = (targetClanIdOrNum: string | number) => {
    const res = acceptClanAllianceProposal(clan.id, playerNick, targetClanIdOrNum);
    if (!res.ok) {
      notify(`❌ ${res.error}`);
      return;
    }
    onRefreshClan();
    notify(res.message || '🤝 Союз заключен!');
  };

  const handleDiplomacyChange = (
    targetClanIdOrNum: string | number,
    status: 'alliance' | 'war' | 'neutral'
  ) => {
    const res = setClanDiplomacyStatus(clan.id, playerNick, targetClanIdOrNum, status);
    if (!res.ok) {
      notify(`❌ ${res.error}`);
      return;
    }
    onRefreshClan();
    notify(res.message || 'Дипломатия обновлена');
  };

  const syndicateRating = getSyndicateRatingList(ratingSortBy);

  const treasuryLogs = (clan.logs || []).filter((l) =>
    [
      'deposit_gold',
      'deposit_crystals',
      'forge_clan_item',
      'issue_clan_badge',
      'upgrade',
      'port_production',
      'promote',
      'clan_quest_claim',
      'interclan_transfer',
      'diplomacy',
      'declare_war'
    ].includes(l.type)
  );

  const otherClansQuickList = allClansList.filter((c) => c.id !== clan.id);
  const incomingAlliances = (clan.diplomacy || []).filter((d) => d.status === 'pending_incoming');
  const outgoingAlliances = (clan.diplomacy || []).filter((d) => d.status === 'pending_outgoing');
  const activeAlliances = (clan.diplomacy || []).filter((d) => d.status === 'alliance');
  const activeWars = (clan.diplomacy || []).filter((d) => d.status === 'war');

  return (
    <div className="bg-[#f4f1ea] text-[#1f261d] border border-[#b5ad99] rounded p-2 font-sans text-[12px]">
      {/* Верхняя шапка Синдиката с #ID в строгом табличном стиле Gwars */}
      <div className="bg-[#232f20] text-[#e7dfc6] px-2.5 py-1.5 border border-[#495c43] flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <ClanBadgeMini tag={clan.tag} emblem={clan.emblem} size={18} />
          <span className="font-bold text-[#ffd97d] text-[13px]">
            #{clan.clanNumber || 1} [{clan.tag}] {clan.name}
          </span>
          <span className="text-[11px] bg-[#161f14] px-1.5 py-0.5 border border-[#495c43] text-[#a7d49b]">
            Ур. {Math.min(10, clan.level || 1)}/10 (Бонус Знака: +{Math.min(10, clan.level || 1) * 2}%)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span>
            Казна: <b className="text-[#ffd97d]">{(clan.treasuryGold || 0).toLocaleString('ru-RU')} 🪙</b> /{' '}
            <b className="text-[#7de3ff]">{(clan.treasuryCrystals || 0).toLocaleString('ru-RU')} 💎</b>
          </span>
          <span>
            Пул опыта клана:{' '}
            <b className="text-[#98f584]">{(clan.unassignedPtsPool || 0).toLocaleString('ru-RU')} PTS</b>{' '}
            <span className="text-[#b8c4b2]">(+{controlledSectors.length * 10} PTS/ч)</span>
          </span>
        </div>
      </div>

      {/* Если forcedSection НЕ задан, показываем внутренние вкладки */}
      {!forcedSection && (
        <div className="flex flex-wrap gap-1 mb-2 border-b border-[#b5ad99] pb-1.5">
          {[
            { id: 'voentorg_ranks', label: '🎖️ Погоны (Военторг)' },
            { id: 'clan_base', label: '🏰 База Клана' },
            { id: 'diplomacy_transfers', label: '🤝 Дипломатия и Переводы' },
            { id: 'clan_rating', label: '🏆 Рейтинг Кланов' },
            { id: 'roster_permissions', label: `👥 Состав и Права (${clan.members.length}/${baseCatalog.maxMembersLimit})` },
            { id: 'treasury_log', label: '📜 Лог Казны' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id as SyndicateGwarsSubTab)}
              className={`px-2.5 py-1 text-[11px] font-bold border cursor-pointer ${
                activeSection === tab.id
                  ? 'bg-[#2b3a26] text-[#ffd97d] border-[#1b2618]'
                  : 'bg-[#e3decb] text-[#2b3527] border-[#b5ad99] hover:bg-[#d6cfb8]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {statusMsg && (
        <div className="mb-2 px-2.5 py-1.5 bg-[#fff8dc] border border-[#c8a858] text-[#4a3708] text-[11px] font-semibold flex items-center justify-between">
          <span>{statusMsg}</span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="text-[10px] underline ml-2 cursor-pointer"
          >
            [x]
          </button>
        </div>
      )}

      {/* ========================================================================
          РАЗДЕЛ 1: ПОГОНЫ (ВОЕНТОРГ) — ТОЛЬКО ЗДЕСЬ КАРТОЧКА ПОГОНА, ВЫДАЧА PTS И 15 ЗВАНИЙ
         ======================================================================== */}
      <div className={activeSection === 'voentorg_ranks' ? 'block' : 'hidden'}>
        {/* Карточка текущего Погона и Знака клана игрока */}
        <div className="bg-[#e8e3d5] border border-[#bfb69e] p-2 mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <ClanRankEpaulette level={myRankInfo.rankLevel} size="lg" />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-[#1f2d1b] text-[12px]">
                  Погон #{myRankInfo.rankLevel}: {myRankInfo.rank.title}
                </span>
                <span className="text-[11px] font-bold text-[#5e4612] bg-[#f7ebc6] border border-[#c8a858] px-1.5 py-0.2">
                  Личный опыт в клане: {myRankInfo.pts.toLocaleString('ru-RU')} PTS
                </span>
                <span className="text-[11px] font-bold text-[#21591a] bg-[#e2f2df] border border-[#7ea876] px-1.5 py-0.2">
                  Ваше золото: {(hero.gold || 0).toLocaleString('ru-RU')} 🪙
                </span>
              </div>
              <div className="text-[11px] text-[#3c4738] mt-0.5">
                {myRankInfo.nextRank ? (
                  <>
                    Следующий погон: <b>#{myRankInfo.nextRank.level} «{myRankInfo.nextRank.title}»</b> — требуется{' '}
                    <b>{myRankInfo.nextRank.requiredPts.toLocaleString('ru-RU')} PTS</b> и{' '}
                    <b>{myRankInfo.nextRank.priceGold.toLocaleString('ru-RU')} 🪙</b>{' '}
                    {myRankInfo.ptsToNextRank > 0 ? (
                      <span className="text-[#8a2626]">
                        (осталось набрать: {myRankInfo.ptsToNextRank.toLocaleString('ru-RU')} PTS)
                      </span>
                    ) : (
                      <span className="text-[#21591a] font-bold">(Достаточно PTS для покупки!)</span>
                    )}
                  </>
                ) : (
                  <b className="text-[#801b1b]">Максимальное воинское звание Синдиката (15/15) достигнуто!</b>
                )}
              </div>
              <div className="text-[10px] text-[#285422] font-semibold mt-0.5">
                Активные бонусы погона:{' '}
                {myRankInfo.badgeEquipped ? (
                  <>
                    +{myRankInfo.activeBonuses.vitBonus} Вын (+{myRankInfo.activeBonuses.hpBonusPct}% HP), +
                    {myRankInfo.activeBonuses.strBonus} Сил (+{myRankInfo.activeBonuses.dmgBonusPct}% Урон), +
                    {myRankInfo.activeBonuses.armorBonusPct}% Броня, +{myRankInfo.activeBonuses.accuracyBonusPct}% Меткость, +
                    {myRankInfo.activeBonuses.cargoWeightBonus} Вес
                    {myRankInfo.rank.perkName ? ` | Перк: «${myRankInfo.rank.perkName}»` : ''}
                  </>
                ) : (
                  <span className="text-[#9e2626]">
                    ОТКЛЮЧЕНЫ (Наденьте «Знак клана», чтобы работали бонусы погона и доступ в 7х7!)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleBadgeEquipped}
              className={`px-2.5 py-1 text-[11px] font-bold border cursor-pointer ${
                myRankInfo.badgeEquipped
                  ? 'bg-[#2e5c25] text-white border-[#1b3b15]'
                  : 'bg-[#8a2626] text-white border-[#591414]'
              }`}
            >
              {myRankInfo.badgeEquipped
                ? `🛡️ Знак клана [${clan.tag}]: НАДЕТ`
                : `⚠️ Знак клана [${clan.tag}]: СНЯТ (Надеть)`}
            </button>
          </div>
        </div>

        {/* Блок распределения пула PTS от удерживаемой недвижимости */}
        <div className="bg-[#e8e3d5] border border-[#b5ad99] p-2 mb-2">
          <div className="font-bold text-[#2b3a26] text-[12px] mb-1">
            📦 Общий Пул Кланового Опыта (от недвижимости и переводов): {(clan.unassignedPtsPool || 0).toLocaleString('ru-RU')} PTS
            <span className="font-normal text-[#4b5747] ml-2">
              (Контролируется объектов: <b>{controlledSectors.length} шт.</b> → <b>+{controlledSectors.length * 10} PTS/час</b>; Победа в 7х7 = <b>+150..200 PTS</b>, против врага по Войне = <b>+25% PTS</b>)
            </span>
          </div>
          {canDistributePts ? (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-[11px] font-bold">Выдать бойцу из пула:</span>
              <select
                value={ptsTargetNick}
                onChange={(e) => setPtsTargetNick(e.target.value)}
                className="bg-white border border-[#9e9682] px-1.5 py-0.5 text-[11px]"
              >
                {clan.members.map((m) => (
                  <option key={m.nick} value={m.nick}>
                    {m.nick} (сейчас: {(m.clanPts || 0).toLocaleString('ru-RU')} PTS)
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={10}
                step={100}
                value={ptsGrantAmount}
                onChange={(e) => setPtsGrantAmount(Math.max(1, Number(e.target.value) || 0))}
                className="w-24 bg-white border border-[#9e9682] px-1.5 py-0.5 text-[11px]"
              />
              <button
                type="button"
                onClick={handleDistributePoolPts}
                className="bg-[#2e5c25] hover:bg-[#24491d] text-white px-2.5 py-0.5 text-[11px] font-bold border border-[#1b3b15] cursor-pointer"
              >
                Выдать PTS из пула
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-[#5c6658]">
              Распределять PTS из пула недвижимости может Глава клана или офицер с правом «Выдача опыта PTS и премий из казны».
            </div>
          )}
        </div>

        {/* Таблица покупки 15 званий (Военторг) */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[#9e9682] text-[11px] bg-white">
            <thead>
              <tr className="bg-[#2b3a26] text-[#e7dfc6]">
                <th className="border border-[#495c43] px-1.5 py-1 text-center w-8">№</th>
                <th className="border border-[#495c43] px-2 py-1 text-center">Погон</th>
                <th className="border border-[#495c43] px-2 py-1 text-left">Воинское звание и Бонусы (при надетом Знаке клана)</th>
                <th className="border border-[#495c43] px-2 py-1 text-right">Требуется PTS</th>
                <th className="border border-[#495c43] px-2 py-1 text-right">Цена (Золото)</th>
                <th className="border border-[#495c43] px-2 py-1 text-center">Покупка погона</th>
              </tr>
            </thead>
            <tbody>
              {ranksCatalog.map((r) => {
                const isCurrent = myRankInfo.rankLevel === r.level;
                const isOwned = myRankInfo.rankLevel >= r.level;
                const isNext = r.level === myRankInfo.rankLevel + 1;
                const enoughPts = myRankInfo.pts >= r.requiredPts;
                const enoughGold = (hero.gold || 0) >= r.priceGold;

                return (
                  <tr
                    key={r.level}
                    className={
                      isCurrent
                        ? 'bg-[#fff3cd] font-semibold'
                        : isOwned
                        ? 'bg-[#eef5eb]'
                        : 'odd:bg-white even:bg-[#f7f4ec]'
                    }
                  >
                    <td className="border border-[#ccc5b3] px-1.5 py-1 text-center font-bold">
                      {r.level}
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1 text-center">
                      <ClanRankEpaulette level={r.level} size="md" />
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1">
                      <div className="font-bold text-[#1f2d1b]">
                        {r.title}{' '}
                        {isCurrent && (
                          <span className="text-[10px] bg-[#2e5c25] text-white px-1 py-0.2 ml-1">
                            ВАШЕ ЗВАНИЕ
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#354231]">
                        {r.level === 1 ? (
                          <span>Доступ к клановым боям 7х7 и базовой оружейной.</span>
                        ) : (
                          <>
                            +{r.vitBonus} Выносливости (<b>+{r.hpBonusPct}% HP</b>)
                            {r.strBonus > 0 ? `, +${r.strBonus} Силы (+${r.dmgBonusPct}% к урону)` : ''}
                            {r.armorBonusPct > 0 ? `, +${r.armorBonusPct}% к Броне` : ''}
                            {r.accuracyBonusPct > 0 ? `, +${r.accuracyBonusPct}% к Меткости` : ''}
                            {r.cargoWeightBonus > 0 ? `, +${r.cargoWeightBonus} к весу` : ''}
                            {r.durabilitySavePct ? `, -${r.durabilitySavePct}% износа оружия` : ''}
                            {r.factorySpeedBonusPct ? `, +${r.factorySpeedBonusPct}% скорость заводов` : ''}
                          </>
                        )}
                      </div>
                      {r.perkName && r.level > 1 && (
                        <div className="text-[10px] text-[#7a3e00] font-semibold mt-0.5">
                          ★ Синдикатный перк: {r.perkDescription}
                        </div>
                      )}
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1 text-right font-mono">
                      <span className={enoughPts ? 'text-[#21591a] font-bold' : 'text-[#8c2d2d]'}>
                        {r.requiredPts.toLocaleString('ru-RU')} PTS
                      </span>
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1 text-right font-mono">
                      {r.priceGold === 0 ? (
                        <span className="text-[#21591a] font-bold">Бесплатно</span>
                      ) : (
                        <span className={enoughGold ? 'text-[#5e4612] font-bold' : 'text-[#8c2d2d]'}>
                          {r.priceGold.toLocaleString('ru-RU')} 🪙
                        </span>
                      )}
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1 text-center">
                      {isOwned ? (
                        <span className="text-[#21591a] font-bold text-[10px]">✓ Присвоено</span>
                      ) : isNext ? (
                        <button
                          type="button"
                          onClick={() => handleBuyRank(r.level)}
                          className={`px-2 py-0.5 text-[10px] font-bold border cursor-pointer ${
                            enoughPts && enoughGold
                              ? 'bg-[#2e5c25] hover:bg-[#22461b] text-white border-[#183313]'
                              : 'bg-[#d9d4c5] text-[#666] border-[#b5ad99]'
                          }`}
                        >
                          Купить погон
                        </button>
                      ) : (
                        <span className="text-[#7a7467] text-[10px]">Сначала #{r.level - 1}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================
          РАЗДЕЛ 2: БАЗА КЛАНА (4 СТРОЕНИЯ: ЛАЗАРЕТ, КОМАНДНЫЙ ПУНКТ, ФОРПОСТ, ЗАРЯДНАЯ СТАНЦИЯ)
         ======================================================================== */}
      <div className={activeSection === 'clan_base' ? 'block' : 'hidden'}>
        <div className="bg-[#e8e3d5] border border-[#b5ad99] p-2 mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-bold text-[#1f2d1b] text-[12px]">
              ⚡ Энергоблок Клановой Базы:{' '}
              <span className={baseCatalog.isPowered ? 'text-[#21591a]' : 'text-[#9e1f1f]'}>
                {baseCatalog.powerChargeUnits} / {baseCatalog.maxPowerChargeUnits} кВт (
                {baseCatalog.isPowered ? 'База запитана — бонусы работают' : 'РАЗРЯЖЕНА — бонусы отключены!'})
              </span>
            </div>
            {(baseCatalog.alliedSharedInfirmaryClan || baseCatalog.alliedSharedOutpostClan) && (
              <div className="text-[10.5px] text-[#1c5c20] font-bold mt-0.5">
                🤝 Союзная поддержка в Порту 10x10:{' '}
                {baseCatalog.alliedSharedInfirmaryClan
                  ? `Общий Лазарет от союзника ${baseCatalog.alliedSharedInfirmaryClan} (+${baseCatalog.infirmaryHealSpeedPct}% к лечению)`
                  : ''}{' '}
                {baseCatalog.alliedSharedOutpostClan
                  ? `| Общий Форпост от союзника ${baseCatalog.alliedSharedOutpostClan} (+${baseCatalog.outpostDefenseBonusPct}% к броне в 7х7)`
                  : ''}
              </div>
            )}
            <div className="text-[11px] text-[#455241] mt-0.5">
              Ваши ресурсы 3-го этапа Порта: Закаленная сталь: <b>{haveSteel} шт.</b> | Боевые модули:{' '}
              <b>{haveModules} шт.</b> | Древние Реликвии: <b>{haveRelics} шт.</b> | Мощность:{' '}
              <b>{havePowerKw} кВт</b> | Реагенты: <b>{haveReagents} шт.</b>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={powerResourceKey}
              onChange={(e) => setPowerResourceKey(e.target.value as 'power_kw' | 'alchemy_reagents')}
              className="bg-white border border-[#9e9682] px-1.5 py-0.5 text-[11px]"
            >
              <option value="power_kw">⚡ Мощность (кВт) [+10 кВт/ед.] (у вас: {havePowerKw})</option>
              <option value="alchemy_reagents">🧪 Алхим. реагент [+25 кВт/ед.] (у вас: {haveReagents})</option>
            </select>
            <input
              type="number"
              min={1}
              max={100}
              value={powerLoadQty}
              onChange={(e) => setPowerLoadQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-14 bg-white border border-[#9e9682] px-1.5 py-0.5 text-[11px]"
            />
            <button
              type="button"
              onClick={handleChargePowerStation}
              className="bg-[#2e5c25] hover:bg-[#23471c] text-white px-2 py-0.5 text-[11px] font-bold border border-[#183313] cursor-pointer"
            >
              Зарядить Базу
            </button>
            {((clan.baseBuildings?.infirmaryLevel || 1) >= 4 || baseCatalog.alliedSharedInfirmaryClan) && (
              <button
                type="button"
                onClick={handleFreeInfirmaryHeal}
                className="bg-[#802020] hover:bg-[#631616] text-white px-2 py-0.5 text-[11px] font-bold border border-[#4a0f0f] cursor-pointer"
              >
                🏥 Лазарет Ур.4: 100% HP
              </button>
            )}
          </div>
        </div>

        {/* Таблица 4 строений Клановой Базы */}
        <div className="overflow-x-auto mb-2">
          <table className="w-full border-collapse border border-[#9e9682] text-[11px] bg-white">
            <thead>
              <tr className="bg-[#2b3a26] text-[#e7dfc6]">
                <th className="border border-[#495c43] px-2 py-1 text-left">Строение Базы</th>
                <th className="border border-[#495c43] px-2 py-1 text-center">Уровень</th>
                <th className="border border-[#495c43] px-2 py-1 text-left">Текущий бонус и следующий уровень</th>
                <th className="border border-[#495c43] px-2 py-1 text-left">Стоимость улучшения (Казна + Ресурсы Порта)</th>
                <th className="border border-[#495c43] px-2 py-1 text-center">Действие</th>
              </tr>
            </thead>
            <tbody>
              {baseCatalog.buildings.map((b) => (
                <tr key={b.key} className="odd:bg-white even:bg-[#f7f4ec]">
                  <td className="border border-[#ccc5b3] px-2 py-1.5 font-bold text-[#1f2d1b]">
                    {b.name}
                  </td>
                  <td className="border border-[#ccc5b3] px-2 py-1.5 text-center font-bold">
                    <span className="bg-[#e8e3d5] border border-[#9e9682] px-1.5 py-0.5">
                      {b.currentLevel} / {b.maxLevel}
                    </span>
                  </td>
                  <td className="border border-[#ccc5b3] px-2 py-1.5">
                    <div className="font-semibold text-[#21591a]">{b.effectText}</div>
                    <div className="text-[10px] text-[#5c6658] mt-0.5">{b.nextLevelEffectText}</div>
                  </td>
                  <td className="border border-[#ccc5b3] px-2 py-1.5 text-[10px]">
                    {b.currentLevel >= 4 ? (
                      <span className="text-[#21591a] font-bold">Макс. уровень</span>
                    ) : (
                      <div>
                        <div>
                          Казна: <b>{b.upgradeCostGold.toLocaleString('ru-RU')} 🪙</b>
                        </div>
                        <div>
                          Сталь: <b>{b.upgradeCostSteel} шт.</b> | Модули: <b>{b.upgradeCostModules} шт.</b>
                          {b.upgradeCostRelics > 0 ? ` | Реликвии: ${b.upgradeCostRelics} шт.` : ''}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="border border-[#ccc5b3] px-2 py-1.5 text-center">
                    {b.currentLevel >= 4 ? (
                      <span className="text-[#21591a] font-bold text-[10px]">✓ Ур. 4</span>
                    ) : canManageBase ? (
                      <button
                        type="button"
                        onClick={() => handleUpgradeBaseBuilding(b.key)}
                        className="bg-[#2e5c25] hover:bg-[#22461b] text-white px-2 py-0.5 text-[10px] font-bold border border-[#183313] cursor-pointer"
                      >
                        Улучшить до Ур. {b.currentLevel + 1}
                      </button>
                    ) : (
                      <span className="text-[#7a7467] text-[10px]">Нет прав</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Радар Командного пункта */}
        <div className="bg-[#e8e3d5] border border-[#b5ad99] p-2 mb-2">
          <div className="font-bold text-[#1f2d1b] text-[11px] mb-1">
            📡 Радар Командного пункта (Ур. {clan.baseBuildings?.commandPostLevel || 1}): Контролируемые сектора Порта 10x10 ({controlledSectors.length} шт.)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-[#9e9682] text-[11px] bg-white">
              <thead>
                <tr className="bg-[#3a4a34] text-[#e7dfc6]">
                  <th className="border border-[#495c43] px-2 py-0.5 text-left">Объект недвижимости</th>
                  <th className="border border-[#495c43] px-2 py-0.5 text-center">Сектор [X/Y]</th>
                  <th className="border border-[#495c43] px-2 py-0.5 text-center">Прочность</th>
                  <th className="border border-[#495c43] px-2 py-0.5 text-left">Статус тревоги / Враги в секторе</th>
                </tr>
              </thead>
              <tbody>
                {controlledSectors.map((sec) => (
                  <tr key={sec.id} className="odd:bg-white even:bg-[#f7f4ec]">
                    <td className="border border-[#ccc5b3] px-2 py-0.5 font-semibold">{sec.name}</td>
                    <td className="border border-[#ccc5b3] px-2 py-0.5 text-center font-mono">
                      [{sec.mapX || 7}/{sec.mapY || 6}]
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-0.5 text-center">
                      {sec.production?.buildingDurability ?? 100}/100
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-0.5">
                      {sec.warStatus === 'war' ? (
                        <span className="text-[#a81c1c] font-bold">
                          🚨 ИДЁТ ШТУРМ 7х7! Атакует [{sec.attackerClanTag}] ({sec.battle7x7?.attackers.length || 0}/7)
                        </span>
                      ) : (
                        <span className="text-[#21591a]">Чисто (Спокойно, +10 PTS/ч в пул клана)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* БЛОК «КЛАНОВЫЕ ЗАКАЗЫ НА СНАБЖЕНИЕ» (ТАБЛИЧНЫЙ СТИЛЬ GWARS) */}
        <div className="bg-[#e8e3d5] border border-[#b5ad99] p-2 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-bold text-[#1f2d1b] text-[12px]">
                📦 Клановые Заказы на Снабжение (Казна клана: {(clan.treasuryGold || 0).toLocaleString('ru-RU')} 🪙)
              </div>
              <div className="text-[10.5px] text-[#455241]">
                Любой участник клана или союзник по #ID может сдать ресурсы Порта по заявке клана и мгновенно получить оплату золотом из Казны и <b>+5 личных PTS</b> за каждую единицу ресурса 3-го этапа!
              </div>
            </div>
          </div>

          {/* Форма создания новой заявки для Главы / Офицеров */}
          {canManageBase && (
            <div className="bg-white border border-[#9e9682] p-2 flex flex-wrap items-end gap-2 text-[11px]">
              <div>
                <div className="text-[10px] font-bold text-[#2b3527]">Ресурс Порта:</div>
                <select
                  value={newOrderResKey}
                  onChange={(e) => {
                    const rk = e.target.value as PortTerminalResourceKey;
                    setNewOrderResKey(rk);
                    const cat = getPortAllResourcesCatalog().find((c) => c.key === rk);
                    if (cat) setNewOrderPrice(cat.buyPriceGold);
                  }}
                  className="bg-[#f9f7f1] border border-[#9e9682] px-1.5 py-0.5 text-[11px] font-bold"
                >
                  {getPortAllResourcesCatalog()
                    .filter((c) => c.key !== 'tavern_meal')
                    .map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.icon} {c.name} ({c.category} • рек. {c.buyPriceGold} 🪙)
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#2b3527]">Кол-во (шт.):</div>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={newOrderQty}
                  onChange={(e) => setNewOrderQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 bg-[#f9f7f1] border border-[#9e9682] px-1.5 py-0.5 text-[11px] font-mono text-center"
                />
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#2b3527]">Цена закупки (🪙/шт.):</div>
                <input
                  type="number"
                  min={10}
                  max={50000}
                  value={newOrderPrice}
                  onChange={(e) => setNewOrderPrice(Math.max(10, Number(e.target.value) || 100))}
                  className="w-24 bg-[#f9f7f1] border border-[#9e9682] px-1.5 py-0.5 text-[11px] font-mono text-center"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const res = createClanSupplyOrder(
                    clan.id,
                    playerNick,
                    newOrderResKey,
                    newOrderQty,
                    newOrderPrice
                  );
                  if (!res.ok) {
                    notify(`❌ ${res.error}`);
                    return;
                  }
                  onRefreshClan();
                  notify(res.message || '📦 Клановый заказ создан!');
                }}
                className="bg-[#2e5c25] hover:bg-[#22461b] text-white px-2.5 py-1 text-[11px] font-bold border border-[#183313] cursor-pointer"
              >
                [ + Создать заявку на снабжение ]
              </button>
            </div>
          )}

          {/* Таблица активных клановых заказов */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-[#9e9682] text-[11px] bg-white">
              <thead>
                <tr className="bg-[#2b3a26] text-[#e7dfc6]">
                  <th className="border border-[#495c43] px-2 py-1 text-left">Заказанный ресурс</th>
                  <th className="border border-[#495c43] px-2 py-1 text-center">Нужно / Сдано</th>
                  <th className="border border-[#495c43] px-2 py-1 text-right">Оплата из казны</th>
                  <th className="border border-[#495c43] px-2 py-1 text-center">У вас в рюкзаке</th>
                  <th className="border border-[#495c43] px-2 py-1 text-right">Сдать ресурс в клан</th>
                </tr>
              </thead>
              <tbody>
                {(clan.supplyOrders || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="border border-[#ccc5b3] px-2 py-2 text-center text-[#5c6658]">
                      Активных заказов на снабжение сейчас нет. Глава клана может разместить новый заказ выше.
                    </td>
                  </tr>
                ) : (
                  (clan.supplyOrders || []).map((ord) => {
                    const rem = Math.max(0, ord.requestedQty - ord.deliveredQty);
                    const myHave = Math.max(0, Math.floor(Number(portRes[ord.resourceKey] || 0)));
                    const ptsPerItem = ord.ptsPerUnit || 5;
                    const inputQty = deliverQtyByOrderId[ord.id] ?? Math.min(rem, Math.max(1, myHave));
                    return (
                      <tr key={ord.id} className="odd:bg-white even:bg-[#f7f4ec]">
                        <td className="border border-[#ccc5b3] px-2 py-1 font-bold text-[#1f2d1b]">
                          {ord.resourceIcon} «{ord.resourceName}»{' '}
                          <span className="text-[10px] font-normal text-[#4b5747]">
                            (+{ptsPerItem} PTS/шт.)
                          </span>
                        </td>
                        <td className="border border-[#ccc5b3] px-2 py-1 text-center font-mono">
                          <b>{ord.deliveredQty}</b> / {ord.requestedQty} шт. (ост. {rem})
                        </td>
                        <td className="border border-[#ccc5b3] px-2 py-1 text-right font-mono font-bold text-[#5e4612]">
                          {ord.pricePerUnitGold.toLocaleString('ru-RU')} 🪙/шт.
                        </td>
                        <td className="border border-[#ccc5b3] px-2 py-1 text-center font-mono">
                          <b className={myHave > 0 ? 'text-[#21591a]' : 'text-[#8c2d2d]'}>{myHave} шт.</b>
                        </td>
                        <td className="border border-[#ccc5b3] px-2 py-1 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={Math.max(1, rem)}
                              value={inputQty}
                              onChange={(e) =>
                                setDeliverQtyByOrderId((prev) => ({
                                  ...prev,
                                  [ord.id]: Math.max(1, Number(e.target.value) || 1)
                                }))
                              }
                              className="w-12 bg-[#f9f7f1] border border-[#9e9682] px-1 py-0.5 text-center font-mono text-[11px]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const res = fulfillClanSupplyOrder(
                                  clan.id,
                                  playerNick,
                                  ord.id,
                                  inputQty,
                                  myHave
                                );
                                if (!res.ok) {
                                  notify(`❌ ${res.error}`);
                                  return;
                                }
                                const used = res.deliveredQty || inputQty;
                                const nextPortRes: Partial<Record<PortTerminalResourceKey, number>> = {
                                  ...portRes,
                                  [ord.resourceKey]: Math.max(0, myHave - used)
                                };
                                onUpdateHero({
                                  gold: (hero.gold || 0) + (res.goldEarned || 0),
                                  portResources: nextPortRes,
                                  clanPts: (myRankInfo.pts || 0) + (res.ptsAwarded || 0)
                                });
                                onRefreshClan();
                                notify(res.message || '✅ Ресурс сдан в клан!');
                              }}
                              className="bg-[#2e5c25] hover:bg-[#22461b] text-white px-2 py-0.5 text-[10.5px] font-bold border border-[#183313] cursor-pointer"
                            >
                              [ Сдать ресурс в клан ]
                            </button>
                            {canManageBase && (
                              <button
                                type="button"
                                onClick={() => {
                                  const res = deleteClanSupplyOrder(clan.id, playerNick, ord.id);
                                  if (!res.ok) {
                                    notify(`❌ ${res.error}`);
                                    return;
                                  }
                                  onRefreshClan();
                                  notify(res.message || 'Заказ закрыт.');
                                }}
                                title="Закрыть заказ"
                                className="bg-[#8a2626] hover:bg-[#691919] text-white px-1.5 py-0.5 text-[10px] font-bold border border-[#4a0f0f] cursor-pointer"
                              >
                                [x]
                              </button>
                            )}
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
      </div>

      {/* ========================================================================
          РАЗДЕЛ 3: ДИПЛОМАТИЯ И ПЕРЕВОДЫ ПО #ID КЛАНА (В СТИЛЕ GWARS)
         ======================================================================== */}
      <div className={activeSection === 'diplomacy_transfers' ? 'block space-y-2.5' : 'hidden'}>
        {/* Быстрая подсказка по номерам существующих кланов (#ID) */}
        <div className="bg-[#e8e3d5] border border-[#b5ad99] p-2">
          <div className="font-bold text-[#1f2d1b] text-[11px] mb-1">
            📋 Справочник номеров (#ID) активных кланов (кликните по клану для подстановки #ID в форму):
          </div>
          <div className="flex flex-wrap gap-1">
            {otherClansQuickList.map((oc) => {
              const rel = (clan.diplomacy || []).find((d) => d.targetClanId === oc.id);
              const badgeColor =
                rel?.status === 'alliance'
                  ? 'bg-[#d6f5d6] border-[#2e5c25] text-[#174214]'
                  : rel?.status === 'war'
                  ? 'bg-[#fad4d4] border-[#8a1c1c] text-[#691010]'
                  : rel?.status === 'pending_incoming' || rel?.status === 'pending_outgoing'
                  ? 'bg-[#fff3cd] border-[#b8860b] text-[#5c4306]'
                  : 'bg-white border-[#9e9682] text-[#2b3527]';
              return (
                <button
                  key={oc.id}
                  type="button"
                  onClick={() => {
                    setTransferTargetNumInput(String(oc.clanNumber || ''));
                    setDiplomacyTargetNumInput(String(oc.clanNumber || ''));
                  }}
                  className={`px-2 py-0.5 text-[10.5px] font-bold border cursor-pointer hover:opacity-85 ${badgeColor}`}
                >
                  #{oc.clanNumber} [{oc.tag}] {oc.name}
                  {rel?.status === 'alliance'
                    ? ' (🤝 Союз)'
                    : rel?.status === 'war'
                    ? ' (⚔️ Война)'
                    : rel?.status === 'pending_incoming'
                    ? ' (📨 Вход. заявка)'
                    : rel?.status === 'pending_outgoing'
                    ? ' (⏳ Исх. заявка)'
                    : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* А. ФОРМА «МЕЖКЛАНОВЫЙ ПЕРЕВОД ПО #ID» */}
        <div className="bg-white border border-[#9e9682] p-2.5">
          <div className="bg-[#2b3a26] text-[#ffd97d] px-2 py-1 font-bold text-[12px] mb-2">
            📤 А. Межклановый перевод PTS и средств казны по #ID клана
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div>
              <label className="block text-[10.5px] font-bold text-[#2b3527] mb-0.5">
                Поле 1: Введите #ID клана-получателя:
              </label>
              <input
                type="text"
                placeholder="Например: 105 или #105"
                value={transferTargetNumInput}
                onChange={(e) => setTransferTargetNumInput(e.target.value)}
                className="w-full bg-[#f9f7f1] border border-[#9e9682] px-2 py-1 text-[11px] font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold text-[#2b3527] mb-0.5">
                Поле 2: Что передать:
              </label>
              <select
                value={transferResType}
                onChange={(e) => setTransferResType(e.target.value as 'pts' | 'gold')}
                className="w-full bg-[#f9f7f1] border border-[#9e9682] px-2 py-1 text-[11px] font-bold"
              >
                <option value="pts">
                  ⭐ Пул опыта (PTS) (доступно: {(clan.unassignedPtsPool || 0).toLocaleString('ru-RU')} PTS)
                </option>
                <option value="gold">
                  🪙 Золото из казны (доступно: {(clan.treasuryGold || 0).toLocaleString('ru-RU')} 🪙)
                </option>
              </select>
            </div>
            <div>
              <label className="block text-[10.5px] font-bold text-[#2b3527] mb-0.5">
                Поле 3: Количество и отправка:
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  step={100}
                  value={transferAmountInput}
                  onChange={(e) => setTransferAmountInput(Math.max(1, Number(e.target.value) || 0))}
                  className="w-28 bg-[#f9f7f1] border border-[#9e9682] px-2 py-1 text-[11px] font-mono font-bold"
                />
                <button
                  type="button"
                  onClick={handleInterclanTransfer}
                  className="bg-[#2e5c25] hover:bg-[#22461b] text-white px-3 py-1 text-[11px] font-bold border border-[#183313] cursor-pointer shrink-0"
                >
                  Передать клану
                </button>
              </div>
            </div>
          </div>

          {/* Мгновенная подсветка найденного по #ID клана */}
          <div className="mt-2 px-2 py-1 bg-[#f4f1ea] border border-[#ccc5b3] text-[11px]">
            {matchedTransferClan ? (
              matchedTransferClan.id === clan.id ? (
                <span className="text-[#8a2626] font-bold">
                  ⚠️ Это ваш собственный клан ({formatClanFullLabel(matchedTransferClan)}). Введите #ID другого клана.
                </span>
              ) : (
                <span className="text-[#1c5c20] font-bold flex flex-wrap items-center gap-1.5">
                  <span>✅ Найден клан-получатель:</span>
                  <ClanBadgeMini tag={matchedTransferClan.tag} emblem={matchedTransferClan.emblem} size={16} />
                  <span className="underline">{formatClanFullLabel(matchedTransferClan)}</span>
                  <span className="text-[#4a5746] font-normal">
                    (Ур. {matchedTransferClan.level || 1}, Лидер: {matchedTransferClan.leaderNick}, Пул:{' '}
                    {(matchedTransferClan.unassignedPtsPool || 0).toLocaleString('ru-RU')} PTS)
                  </span>
                </span>
              )
            ) : (
              <span className="text-[#8a2626] font-bold">
                ❌ Клан с номером #{transferTargetNumInput.replace('#', '') || '?'} не найден.
              </span>
            )}
          </div>
        </div>

        {/* Б. ФОРМА «ДИПЛОМАТИЧЕСКОЕ ДЕЙСТВИЕ ПО #ID» (СОЮЗЫ И ВОЙНЫ) */}
        <div className="bg-white border border-[#9e9682] p-2.5">
          <div className="bg-[#2b3a26] text-[#ffd97d] px-2 py-1 font-bold text-[12px] mb-2">
            🤝⚔️ Б. Дипломатическое действие по #ID клана (Союзы и Войны в стиле Gwars)
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[10.5px] font-bold text-[#2b3527] mb-0.5">
                Введите #ID клана:
              </label>
              <input
                type="text"
                placeholder="Например: 105"
                value={diplomacyTargetNumInput}
                onChange={(e) => setDiplomacyTargetNumInput(e.target.value)}
                className="w-36 bg-[#f9f7f1] border border-[#9e9682] px-2 py-1 text-[11px] font-mono font-bold"
              />
            </div>

            <button
              type="button"
              onClick={() => handleProposeAllianceByNum()}
              className="bg-[#2e5c25] hover:bg-[#22461b] text-white px-3 py-1 text-[11px] font-bold border border-[#183313] cursor-pointer"
            >
              🤝 Предложить Союз
            </button>
            <button
              type="button"
              onClick={() => handleDiplomacyChange(diplomacyTargetNumInput, 'war')}
              className="bg-[#8a1c1c] hover:bg-[#691313] text-white px-3 py-1 text-[11px] font-bold border border-[#4a0b0b] cursor-pointer"
            >
              ⚔️ Объявить Войну
            </button>
            <button
              type="button"
              onClick={() => handleDiplomacyChange(diplomacyTargetNumInput, 'neutral')}
              className="bg-[#6b6659] hover:bg-[#524e44] text-white px-3 py-1 text-[11px] font-bold border border-[#3d3a32] cursor-pointer"
            >
              🏳️ Разорвать отношения
            </button>
          </div>

          {/* Подсветка целевого клана для дипломатии */}
          <div className="mt-2 px-2 py-1 bg-[#f4f1ea] border border-[#ccc5b3] text-[11px]">
            {matchedDiplomacyClan ? (
              matchedDiplomacyClan.id === clan.id ? (
                <span className="text-[#8a2626] font-bold">
                  ⚠️ Это ваш собственный клан ({formatClanFullLabel(matchedDiplomacyClan)}).
                </span>
              ) : (
                <span className="text-[#1f2d1b] font-bold flex flex-wrap items-center gap-1.5">
                  <span>🎯 Выбран клан:</span>
                  <ClanBadgeMini tag={matchedDiplomacyClan.tag} emblem={matchedDiplomacyClan.emblem} size={16} />
                  <span>{formatClanFullLabel(matchedDiplomacyClan)}</span>
                  <span className="font-normal text-[#4a5746]">
                    (Ур. {matchedDiplomacyClan.level || 1}, Лидер: {matchedDiplomacyClan.leaderNick})
                  </span>
                </span>
              )
            ) : (
              <span className="text-[#8a2626] font-bold">
                ❌ Клан с номером #{diplomacyTargetNumInput.replace('#', '') || '?'} не найден.
              </span>
            )}
          </div>

          <div className="mt-2 text-[10.5px] text-[#3c4738] bg-[#eef5eb] border border-[#abc4a3] p-1.5 space-y-0.5">
            <div>
              • <b>Принцип Союза (макс. 2 клана):</b> После принятия заявки союзники видят зеленую метку{' '}
              <b className="text-[#1d5e18]">🤝 СОЮЗ</b>, могут заходить за союзный клан в защиту недвижимости (бои 7х7), пользоваться Лазаретом и Форпостом друг друга в Порту 10x10 и переводить PTS без комиссии.
            </div>
            <div>
              • <b>Принцип Войны:</b> Официальный враг получает красную метку <b className="text-[#8a1c1c]">⚔️ ВОЙНА</b>. В боях 7х7 против официального врага ваши бойцы получают <b>+25% больше кланового опыта (PTS)</b>!
            </div>
          </div>
        </div>

        {/* В. ВХОДЯЩИЕ И ИСХОДЯЩИЕ ЗАЯВКИ НА СОЮЗ */}
        {(incomingAlliances.length > 0 || outgoingAlliances.length > 0) && (
          <div className="bg-[#fff8dc] border border-[#c8a858] p-2">
            <div className="font-bold text-[#5c4306] text-[11.5px] mb-1.5">
              📨 Дипломатические заявки на заключение Союза ({incomingAlliances.length + outgoingAlliances.length}):
            </div>
            <div className="space-y-1.5">
              {incomingAlliances.map((req) => (
                <div
                  key={`inc_${req.targetClanId}`}
                  className="bg-white border border-[#c8a858] px-2 py-1 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="bg-[#2e5c25] text-white px-1.5 py-0.5 text-[10px] font-bold">
                      ВХОДЯЩЕЕ ПРЕДЛОЖЕНИЕ
                    </span>
                    <ClanBadgeMini tag={req.targetClanTag} emblem={req.targetClanEmblem} size={16} />
                    <span className="font-bold text-[#1f2d1b]">
                      #{req.targetClanNumber || '?'} [{req.targetClanTag}] {req.targetClanName}
                    </span>
                    <span className="text-[10px] text-[#5c6658]">
                      предлагает вам военный Союз!
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleAcceptAlliance(req.targetClanId)}
                      className="bg-[#2e5c25] hover:bg-[#22461b] text-white px-2.5 py-0.5 text-[10.5px] font-bold border border-[#183313] cursor-pointer"
                    >
                      ✅ Принять Союз
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDiplomacyChange(req.targetClanId, 'neutral')}
                      className="bg-[#8a1c1c] text-white px-2 py-0.5 text-[10.5px] font-bold cursor-pointer"
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              ))}

              {outgoingAlliances.map((req) => (
                <div
                  key={`out_${req.targetClanId}`}
                  className="bg-white border border-[#b5ad99] px-2 py-1 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="bg-[#b8860b] text-white px-1.5 py-0.5 text-[10px] font-bold">
                      ОЖИДАЕТ ОТВЕТА
                    </span>
                    <ClanBadgeMini tag={req.targetClanTag} emblem={req.targetClanEmblem} size={16} />
                    <span className="font-bold text-[#1f2d1b]">
                      #{req.targetClanNumber || '?'} [{req.targetClanTag}] {req.targetClanName}
                    </span>
                    <span className="text-[10px] text-[#5c6658]">
                      (заявка отправлена Главе клана)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleAcceptAlliance(req.targetClanId)}
                      className="bg-[#2e5c25] hover:bg-[#22461b] text-white px-2 py-0.5 text-[10px] font-bold cursor-pointer"
                      title="Подтвердить принятие Союза со стороны целевого клана"
                    >
                      🤝 Принять Союз (Подтвердить)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDiplomacyChange(req.targetClanId, 'neutral')}
                      className="bg-[#6b6659] text-white px-2 py-0.5 text-[10px] font-bold cursor-pointer"
                    >
                      Отозвать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Г. ТАБЛИЦА ТЕКУЩИХ СОЮЗОВ И ОФИЦИАЛЬНЫХ ВОЙН КЛАНА */}
        <div className="bg-white border border-[#9e9682] p-2">
          <div className="font-bold text-[#1f2d1b] text-[11.5px] mb-1.5">
            📜 Действующие дипломатические отношения клана #{clan.clanNumber || 1} [{clan.tag}] (Союзов: {activeAlliances.length}/2 | Войн: {activeWars.length}):
          </div>
          {activeAlliances.length === 0 && activeWars.length === 0 ? (
            <div className="text-[11px] text-[#5c6658] py-2">
              У вашего клана сейчас нет активных Союзов или объявленных Войн (со всеми кланами нейтралитет).
            </div>
          ) : (
            <table className="w-full border-collapse border border-[#9e9682] text-[11px] bg-white">
              <thead>
                <tr className="bg-[#2b3a26] text-[#e7dfc6]">
                  <th className="border border-[#495c43] px-2 py-1 text-left">#ID и Название клана</th>
                  <th className="border border-[#495c43] px-2 py-1 text-center">Статус отношений</th>
                  <th className="border border-[#495c43] px-2 py-1 text-left">Активные эффекты дипломатии</th>
                  <th className="border border-[#495c43] px-2 py-1 text-center">Управление</th>
                </tr>
              </thead>
              <tbody>
                {[...activeAlliances, ...activeWars].map((rel) => {
                  const fullClan = findClanByNumberOrId(rel.targetClanId);
                  const num = rel.targetClanNumber || fullClan?.clanNumber || '?';
                  return (
                    <tr key={rel.targetClanId} className="odd:bg-white even:bg-[#f7f4ec]">
                      <td className="border border-[#ccc5b3] px-2 py-1 font-bold">
                        <div className="flex items-center gap-1.5">
                          <ClanBadgeMini tag={rel.targetClanTag} emblem={rel.targetClanEmblem} size={16} />
                          <span>
                            #{num} [{rel.targetClanTag}] {rel.targetClanName}
                          </span>
                        </div>
                      </td>
                      <td className="border border-[#ccc5b3] px-2 py-1 text-center font-bold">
                        {rel.status === 'alliance' ? (
                          <span className="bg-[#d6f5d6] border border-[#2e5c25] text-[#174214] px-2 py-0.5">
                            🤝 СОЮЗ (Альянс)
                          </span>
                        ) : (
                          <span className="bg-[#fad4d4] border border-[#8a1c1c] text-[#691010] px-2 py-0.5">
                            ⚔️ ОФИЦИАЛЬНАЯ ВОЙНА
                          </span>
                        )}
                      </td>
                      <td className="border border-[#ccc5b3] px-2 py-1 text-[10.5px]">
                        {rel.status === 'alliance'
                          ? 'Защита заводов друг друга в 7х7, общий Лазарет и Форпост в Порту 10x10, перевод PTS 0%'
                          : '+25% больше кланового опыта (PTS) в боях 7х7 против этого врага!'}
                      </td>
                      <td className="border border-[#ccc5b3] px-2 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleDiplomacyChange(rel.targetClanId, 'neutral')}
                          className="bg-[#6b6659] hover:bg-[#4f4b41] text-white px-2 py-0.5 text-[10px] font-bold cursor-pointer"
                        >
                          Разорвать
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ========================================================================
          РАЗДЕЛ 4: РЕЙТИНГ КЛАНОВ (СТРОГАЯ ТАБЛИЦА ВСЕХ КЛАНОВ ИГРЫ В СТИЛЕ GWARS)
         ======================================================================== */}
      <div className={activeSection === 'clan_rating' ? 'block' : 'hidden'}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <span className="font-bold text-[#1f2d1b] text-[12px]">
            🏆 Общий Рейтинг Кланов (Синдикатов) игры ({syndicateRating.length} кланов)
          </span>
          <div className="flex items-center gap-1 text-[11px]">
            <span>Сортировать по:</span>
            {[
              { key: 'pts', label: 'Общий пул PTS' },
              { key: 'estates', label: 'Контролируемые объекты (шт.)' },
              { key: 'level', label: 'Уровень клана' }
            ].map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setRatingSortBy(s.key as 'pts' | 'estates' | 'level')}
                className={`px-2 py-0.5 border text-[10px] font-bold cursor-pointer ${
                  ratingSortBy === s.key
                    ? 'bg-[#2b3a26] text-[#ffd97d] border-[#1b2618]'
                    : 'bg-white text-[#2b3527] border-[#9e9682]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[#9e9682] text-[11px] bg-white">
            <thead>
              <tr className="bg-[#2b3a26] text-[#e7dfc6]">
                <th className="border border-[#495c43] px-1.5 py-1 text-center w-12">Место</th>
                <th className="border border-[#495c43] px-2 py-1 text-left">#ID и Знак + Название клана</th>
                <th className="border border-[#495c43] px-2 py-1 text-center">Уровень клана</th>
                <th className="border border-[#495c43] px-2 py-1 text-center">Контролируемые объекты (шт.)</th>
                <th className="border border-[#495c43] px-2 py-1 text-right">Общий пул PTS</th>
                <th className="border border-[#495c43] px-2 py-1 text-center">Статус дипломатии</th>
              </tr>
            </thead>
            <tbody>
              {syndicateRating.map((row, idx) => {
                const isSelf = row.clan.id === clan.id;
                const rel = (clan.diplomacy || []).find((d) => d.targetClanId === row.clan.id);

                return (
                  <tr
                    key={row.clan.id}
                    className={
                      isSelf
                        ? 'bg-[#fff3cd] font-semibold'
                        : rel?.status === 'alliance'
                        ? 'bg-[#e8f5e4]'
                        : rel?.status === 'war'
                        ? 'bg-[#fbeaea]'
                        : 'odd:bg-white even:bg-[#f7f4ec]'
                    }
                  >
                    <td className="border border-[#ccc5b3] px-1.5 py-1 text-center font-bold">
                      {idx + 1}
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[#5e4612] bg-[#f7ebc6] border border-[#c8a858] px-1 py-0.2 text-[10px]">
                          #{row.clan.clanNumber || idx + 1}
                        </span>
                        <ClanBadgeMini tag={row.clan.tag} emblem={row.clan.emblem} size={16} />
                        <span className="font-bold text-[#1f2d1b]">{row.clan.name}</span>
                        {isSelf && (
                          <span className="text-[9.5px] bg-[#2b3a26] text-[#ffd97d] px-1 py-0.2">
                            ВАШ КЛАН
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1 text-center font-bold">
                      Ур. {Math.min(10, row.clan.level || 1)}
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1 text-center font-mono font-bold">
                      {row.controlledEstatesCount} шт.
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1 text-right font-mono font-bold text-[#21591a]">
                      {(row.clan.unassignedPtsPool || 0).toLocaleString('ru-RU')} PTS
                      <div className="text-[9.5px] text-[#5c6658] font-normal">
                        (всего: {row.totalClanPts.toLocaleString('ru-RU')} PTS)
                      </div>
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1 text-center">
                      {isSelf ? (
                        <span className="text-[#5e4612] font-bold">Наш синдикат</span>
                      ) : rel?.status === 'alliance' ? (
                        <span className="bg-[#d6f5d6] border border-[#2e5c25] text-[#174214] px-2 py-0.5 font-bold text-[10px]">
                          🤝 Союз
                        </span>
                      ) : rel?.status === 'war' ? (
                        <span className="bg-[#fad4d4] border border-[#8a1c1c] text-[#691010] px-2 py-0.5 font-bold text-[10px]">
                          ⚔️ Война (+25% PTS)
                        </span>
                      ) : rel?.status === 'pending_incoming' ? (
                        <button
                          type="button"
                          onClick={() => handleAcceptAlliance(row.clan.id)}
                          className="bg-[#2e5c25] text-white px-2 py-0.5 text-[10px] font-bold cursor-pointer"
                        >
                          📨 Принять Союз
                        </button>
                      ) : rel?.status === 'pending_outgoing' ? (
                        <span className="bg-[#fff3cd] border border-[#b8860b] text-[#5c4306] px-2 py-0.5 font-bold text-[10px]">
                          ⏳ Заявка отправлена
                        </span>
                      ) : (
                        <span className="text-[#5c6658] font-semibold">🏳️ Нейтрал</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================
          РАЗДЕЛ 5: СОСТАВ И ДОЛЖНОСТИ (ГАЛОЧКИ ПРАВ ДЛЯ ГЛАВЫ КЛАНА + ПЕРЕДАЧА КЛАНА)
         ======================================================================== */}
      <div className={activeSection === 'roster_permissions' ? 'block space-y-2' : 'hidden'}>
        {/* ПЕРЕДАЧА УПРАВЛЕНИЯ СИНДИКАТОМ (КОРОНЫ ГЛАВЫ) ДРУГОМУ ИГРОКУ */}
        {isLeader && (
          <div className="bg-[#f4ebd0] border border-[#b59b52] p-2 text-[11px]">
            <div className="font-bold text-[#3d2e05] mb-1">
              👑 Передача управления Синдикатом #{clan.clanNumber || 1} [{clan.tag}] {clan.name} (Текущий Глава: {clan.leaderNick})
            </div>
            <div className="text-[10.5px] text-[#4f3d08] mb-1.5">
              Глава клана может назначить нового Лидера из состава клана кнопкой в таблице ниже ИЛИ передать управление синдикатом любому игроку по его нику:
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="text"
                value={transferLeaderNickInput}
                onChange={(e) => setTransferLeaderNickInput(e.target.value)}
                placeholder="Введите никнейм нового Главы клана..."
                className="border border-[#8c7332] bg-white px-2 py-0.5 text-[11px] font-bold text-[#1f2d1b] w-60"
              />
              <button
                type="button"
                onClick={() => {
                  const target = transferLeaderNickInput.trim();
                  if (!target) {
                    notify('⚠️ Введите никнейм игрока, которому передается корона Главы клана!');
                    return;
                  }
                  const res = transferClanLeadership(clan.id, playerNick, target, Boolean(isAdmin));
                  if (!res.ok) {
                    notify(`❌ ${res.error}`);
                  } else {
                    setTransferLeaderNickInput('');
                    onRefreshClan();
                    notify(res.message || `👑 Управление кланом [${clan.tag}] передано игроку ${target}!`);
                  }
                }}
                className="bg-[#2e5c25] hover:bg-[#23471c] text-white border border-[#193814] px-2.5 py-0.5 text-[11px] font-bold cursor-pointer"
              >
                [ 🤝 Передать корону Главы клана ]
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[#9e9682] text-[11px] bg-white">
            <thead>
              <tr className="bg-[#2b3a26] text-[#e7dfc6]">
                <th className="border border-[#495c43] px-2 py-1 text-left">Знак + Погон + Боец</th>
                <th className="border border-[#495c43] px-2 py-1 text-center">Ур.</th>
                <th className="border border-[#495c43] px-2 py-1 text-right">Опыт PTS</th>
                <th className="border border-[#495c43] px-2 py-1 text-left">Воинское звание / Должность</th>
                <th className="border border-[#495c43] px-1.5 py-1 text-center" title="Прием и исключение участников">
                  Прием/Искл.
                </th>
                <th className="border border-[#495c43] px-1.5 py-1 text-center" title="Объявление штурмов 7х7 за недвижимость">
                  Штурмы 7х7
                </th>
                <th className="border border-[#495c43] px-1.5 py-1 text-center" title="Выдача опыта PTS и премий из казны">
                  PTS/Казна
                </th>
                <th className="border border-[#495c43] px-1.5 py-1 text-center" title="Управление Базой и Дипломатией">
                  База/Дипл.
                </th>
                <th className="border border-[#495c43] px-2 py-1 text-center">Знак клана / Корона</th>
              </tr>
            </thead>
            <tbody>
              {clan.members.map((m) => {
                const memIsLeader =
                  m.role === 'leader' ||
                  m.nick.trim().toLowerCase() === clan.leaderNick.trim().toLowerCase();
                const rLvl = Math.max(1, Math.min(15, Number(m.rankLevel || 1)));
                const rCfg = getClanSyndicateRankByLevel(rLvl);
                const perms: ClanMemberPermissions = m.permissions || {
                  canRecruitKick: memIsLeader,
                  canDeclareWar: memIsLeader,
                  canDistributePtsAndTreasury: memIsLeader,
                  canManageBaseAndDiplomacy: memIsLeader
                };

                return (
                  <tr key={m.nick} className="odd:bg-white even:bg-[#f7f4ec]">
                    <td className="border border-[#ccc5b3] px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        <ClanBadgeMini tag={clan.tag} emblem={clan.emblem} size={16} />
                        <ClanRankEpaulette level={rLvl} size="sm" />
                        <span className="font-bold text-[#1f2d1b]">{m.nick}</span>
                        {memIsLeader && (
                          <span className="bg-[#fff3cd] border border-[#c8a858] text-[#5c4306] px-1 py-0.2 text-[9.5px] font-bold">
                            👑 ГЛАВА
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1 text-center font-mono">
                      [{m.lvl || 1}]
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1 text-right font-mono font-bold text-[#2b3a26]">
                      {(m.clanPts || 0).toLocaleString('ru-RU')}
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1">
                      <span className="font-semibold">{rCfg.title}</span>{' '}
                      <span className="text-[10px] text-[#5c6658]">
                        ({memIsLeader ? 'Глава Синдиката' : m.customTitle || (m.role === 'officer' ? 'Офицер' : 'Боец')})
                      </span>
                    </td>
                    <td className="border border-[#ccc5b3] px-1.5 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(memIsLeader || perms.canRecruitKick)}
                        disabled={!isLeader || memIsLeader}
                        onChange={() =>
                          handlePermissionToggle(m.nick, 'canRecruitKick', Boolean(perms.canRecruitKick))
                        }
                      />
                    </td>
                    <td className="border border-[#ccc5b3] px-1.5 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(memIsLeader || perms.canDeclareWar)}
                        disabled={!isLeader || memIsLeader}
                        onChange={() =>
                          handlePermissionToggle(m.nick, 'canDeclareWar', Boolean(perms.canDeclareWar))
                        }
                      />
                    </td>
                    <td className="border border-[#ccc5b3] px-1.5 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(memIsLeader || perms.canDistributePtsAndTreasury)}
                        disabled={!isLeader || memIsLeader}
                        onChange={() =>
                          handlePermissionToggle(
                            m.nick,
                            'canDistributePtsAndTreasury',
                            Boolean(perms.canDistributePtsAndTreasury)
                          )
                        }
                      />
                    </td>
                    <td className="border border-[#ccc5b3] px-1.5 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(memIsLeader || perms.canManageBaseAndDiplomacy)}
                        disabled={!isLeader || memIsLeader}
                        onChange={() =>
                          handlePermissionToggle(
                            m.nick,
                            'canManageBaseAndDiplomacy',
                            Boolean(perms.canManageBaseAndDiplomacy)
                          )
                        }
                      />
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        {m.hasClanBadge || memIsLeader ? (
                          <span className="text-[#21591a] font-bold text-[10px]">🛡️ Выдан</span>
                        ) : isLeader ? (
                          <button
                            type="button"
                            onClick={() => {
                              const res = issueClanMemberBadge(clan.id, playerNick, m.nick, 'treasury');
                              if (!res.ok) notify(`❌ ${res.error}`);
                              else {
                                onRefreshClan();
                                notify(res.message || 'Знак выдан!');
                              }
                            }}
                            className="bg-[#2e5c25] text-white px-1.5 py-0.5 text-[10px] font-bold cursor-pointer"
                          >
                            Выдать ({CLAN_BADGE_COST_GOLD} 🪙)
                          </button>
                        ) : (
                          <span className="text-[#8c2d2d] text-[10px]">Нет знака</span>
                        )}

                        {isLeader && !memIsLeader && (
                          <button
                            type="button"
                            onClick={() => {
                              const res = transferClanLeadership(clan.id, playerNick, m.nick, Boolean(isAdmin));
                              if (!res.ok) notify(`❌ ${res.error}`);
                              else {
                                onRefreshClan();
                                notify(res.message || `👑 Корона Главы передана игроку ${m.nick}!`);
                              }
                            }}
                            className="bg-[#8b6508] hover:bg-[#6e4f05] text-white px-1.5 py-0.5 text-[9.5px] font-bold cursor-pointer"
                            title={`Передать корону Главы клана игроку ${m.nick}`}
                          >
                            👑 Сделать Главой
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================
          РАЗДЕЛ 6: ЛОГ КАЗНЫ И ОПЕРАЦИЙ СИНДИКАТА
         ======================================================================== */}
      <div className={activeSection === 'treasury_log' ? 'block' : 'hidden'}>
        <div className="bg-[#e8e3d5] border border-[#b5ad99] p-2 mb-2 text-[11px] flex flex-wrap items-center justify-between gap-2">
          <span>
            <b>🏦 Казна Синдиката #{clan.clanNumber || 1} [{clan.tag}]:</b>{' '}
            {(clan.treasuryGold || 0).toLocaleString('ru-RU')} 🪙 золота |{' '}
            {(clan.treasuryCrystals || 0).toLocaleString('ru-RU')} 💎 кристаллов |{' '}
            Пул опыта: <b>{(clan.unassignedPtsPool || 0).toLocaleString('ru-RU')} PTS</b>
          </span>
          <span className="text-[#4a5746]">
            Авто-налог с заводов клана: <b>10% от чистой прибыли</b>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[#9e9682] text-[11px] bg-white">
            <thead>
              <tr className="bg-[#2b3a26] text-[#e7dfc6]">
                <th className="border border-[#495c43] px-2 py-1 text-left w-28">Время</th>
                <th className="border border-[#495c43] px-2 py-1 text-left w-32">Игрок / Объект</th>
                <th className="border border-[#495c43] px-2 py-1 text-left">Операция по казне, переводам PTS и базе клана</th>
              </tr>
            </thead>
            <tbody>
              {treasuryLogs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="border border-[#ccc5b3] px-2 py-3 text-center text-[#5c6658]">
                    Записей операций по казне пока нет.
                  </td>
                </tr>
              ) : (
                treasuryLogs.slice(0, 40).map((log) => (
                  <tr key={log.id} className="odd:bg-white even:bg-[#f7f4ec]">
                    <td className="border border-[#ccc5b3] px-2 py-1 font-mono text-[10px] text-[#5c6658]">
                      {log.timeStr}
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1 font-bold text-[#1f2d1b]">
                      {log.actorNick}
                    </td>
                    <td className="border border-[#ccc5b3] px-2 py-1">
                      {log.icon ? `${log.icon} ` : ''}
                      {log.text}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
