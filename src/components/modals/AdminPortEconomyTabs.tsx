import React, { useState, useMemo } from 'react';
import {
  HeroState,
  GameItem,
  GameFeatureFlags,
  ShopItemTemplate,
  CharacterSkinTemplate,
  TransportTemplate,
  ClanTerritorySector,
  PortTerminalResourceKey
} from '../../types/game';
import {
  DEFAULT_TRANSPORTS,
  getTransportsCatalog,
  createTransportItemFromTemplate,
  saveShopAndFeaturesToSupabase
} from '../../utils/shopConfig';
import {
  getPortAllResourcesCatalog,
  adminUpdatePortResourceConfig,
  adminRefillTerminalStock,
  getPortTradingTerminalState,
  PORT_TERMINAL_INITIAL_STOCK,
  getClanTerritories,
  adminUpdatePortEstateSector,
  repairPortRealEstateObject,
  getAllClans,
  getClanSyndicateRanksCatalog,
  adminUpdateClanSyndicateRank,
  adminResetClanSyndicateRanks,
  adminSetPlayerClanRankAndPts,
  adminSetClanBaseBuildingLevels,
  getPlayerClanRankAndPts,
  adminUpdateClanFullParams,
  adminAdjustClanPtsPool,
  adminCreateCustomClan,
  findClanByNumberOrId,
  adminAssignAllEstatesToRedblack,
  transferClanLeadership,
  transferPortEstateOwnership
} from '../../utils/clanStorage';
import { findPlayerInSupabase, updatePlayerInDatabase } from '../../utils/supabase';
import { ItemIcon } from '../ItemIcon';
import { ClanRankEpaulette } from '../ClanRankEpaulette';
import { processUploadedItemImage } from '../../utils/imageUpload';

interface AdminPortEconomyTabsProps {
  mode: 'vehicles' | 'economy' | 'clansAndRanks';
  hero: HeroState;
  setHero: React.Dispatch<React.SetStateAction<HeroState>>;
  selfInventory?: GameItem[];
  setSelfInventory?: React.Dispatch<React.SetStateAction<GameItem[]>>;
  featureFlags: GameFeatureFlags;
  setFeatureFlags: React.Dispatch<React.SetStateAction<GameFeatureFlags>>;
  shopCatalog: ShopItemTemplate[];
  shopSkins: CharacterSkinTemplate[];
  combinedPlayersList: { nick: string; lvl: number; isOnline?: boolean; isReal?: boolean }[];
  onShopAndFeaturesUpdated?: (
    catalog: ShopItemTemplate[],
    flags: GameFeatureFlags,
    skins?: CharacterSkinTemplate[]
  ) => void;
  showToast: (text: string) => void;
}

export const AdminPortEconomyTabs: React.FC<AdminPortEconomyTabsProps> = ({
  mode,
  hero,
  setHero,
  selfInventory,
  setSelfInventory,
  featureFlags,
  setFeatureFlags,
  shopCatalog,
  shopSkins,
  combinedPlayersList,
  onShopAndFeaturesUpdated,
  showToast
}) => {
  const [refreshTick, setRefreshTick] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // --- Состояния вкладки 1: Управление Транспортом ---
  const [newTrName, setNewTrName] = useState('');
  const [newTrIcon, setNewTrIcon] = useState('🚢');
  const [newTrStepSeconds, setNewTrStepSeconds] = useState<number>(14);
  const [newTrCargoCapacity, setNewTrCargoCapacity] = useState<number>(500);
  const [newTrPrice, setNewTrPrice] = useState<number>(25000);
  const [newTrCurrency, setNewTrCurrency] = useState<'gold' | 'crystals'>('gold');
  const [newTrLvl, setNewTrLvl] = useState<number>(1);
  const [newTrDurability, setNewTrDurability] = useState<number>(250);

  const [grantNick, setGrantNick] = useState<string>(hero.nick || 'RedBlack');
  const [grantTransportId, setGrantTransportId] = useState<string>(() => {
    const list = getTransportsCatalog(featureFlags);
    return list[0]?.id || 'transport_boat_1';
  });

  // --- Состояния вкладки 2: Редактор Экономики и Недвижимости ---
  const [estateFilterText, setEstateFilterText] = useState('');
  const [expandedEstateId, setExpandedEstateId] = useState<string | null>(null);

  // --- Состояния вкладки 3: Кланы и Погоны (1–15) ---
  const [rankTargetNick, setRankTargetNick] = useState<string>(hero.nick || 'RedBlack');
  const [rankTargetPtsInput, setRankTargetPtsInput] = useState<string>('5000');
  const [rankTargetLevelInput, setRankTargetLevelInput] = useState<number>(15);
  const [selectedBaseClanId, setSelectedBaseClanId] = useState<string>('');
  const [clanLookupNumberInput, setClanLookupNumberInput] = useState<string>('');
  const [clanPtsDeltaInput, setClanPtsDeltaInput] = useState<string>('1000');
  const [editClanNumber, setEditClanNumber] = useState<string>('');
  const [editClanName, setEditClanName] = useState<string>('');
  const [editClanTag, setEditClanTag] = useState<string>('');
  const [editClanEmblem, setEditClanEmblem] = useState<string>('');
  const [editClanLevel, setEditClanLevel] = useState<string>('');
  const [editClanGold, setEditClanGold] = useState<string>('');
  const [editClanCrystals, setEditClanCrystals] = useState<string>('');
  const [newClanNumberInput, setNewClanNumberInput] = useState<string>('999');
  const [newClanTagInput, setNewClanTagInput] = useState<string>('SYND');
  const [newClanNameInput, setNewClanNameInput] = useState<string>('Новый Синдикат');
  const [newClanEmblemInput, setNewClanEmblemInput] = useState<string>('🦅');
  const [newClanLevelInput, setNewClanLevelInput] = useState<string>('5');
  const [newClanGoldInput, setNewClanGoldInput] = useState<string>('250000');
  const [newClanPtsInput, setNewClanPtsInput] = useState<string>('15000');
  const [adminNewLeaderNickInput, setAdminNewLeaderNickInput] = useState<string>('');
  const [adminTransferEstateId, setAdminTransferEstateId] = useState<string>('');
  const [adminTransferEstateNick, setAdminTransferEstateNick] = useState<string>('');

  const transportsList = useMemo(
    () => getTransportsCatalog(featureFlags),
    [featureFlags, refreshTick]
  );

  const resourcesCatalog = useMemo(
    () => getPortAllResourcesCatalog(),
    [refreshTick]
  );

  const terminalState = useMemo(
    () => getPortTradingTerminalState(),
    [refreshTick]
  );

  const territoriesList = useMemo(() => {
    const all = getClanTerritories();
    const q = estateFilterText.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.ownerNick || '').toLowerCase().includes(q) ||
        (s.ownerClanTag || '').toLowerCase().includes(q) ||
        `${s.mapX}/${s.mapY}`.includes(q)
    );
  }, [estateFilterText, refreshTick]);

  const allClans = useMemo(() => getAllClans(), [refreshTick]);

  const handleSaveTransportsToDb = async (nextCatalog: TransportTemplate[]) => {
    const nextFlags: GameFeatureFlags = {
      ...featureFlags,
      transportsCatalog: nextCatalog,
      transportsPriceMigratedV2: true,
      transportsCargoMigratedV1: true
    };
    setFeatureFlags(nextFlags);
    setIsSaving(true);
    try {
      const ok = await saveShopAndFeaturesToSupabase(shopCatalog, nextFlags, shopSkins);
      if (onShopAndFeaturesUpdated) {
        onShopAndFeaturesUpdated(shopCatalog, nextFlags, shopSkins);
      }
      showToast(
        ok
          ? '💾 Изменения линейки транспорта сохранены в БД!'
          : '💾 Линейка транспорта сохранена локально!'
      );
    } finally {
      setIsSaving(false);
      setRefreshTick((v) => v + 1);
    }
  };

  const handleInlineTransportChange = (idx: number, patch: Partial<TransportTemplate>) => {
    const nextList = transportsList.map((item, i) => {
      if (i !== idx) return item;
      const merged = { ...item, ...patch };
      const g = Math.max(0, Number(merged.priceGold ?? 0));
      const c = Math.max(0, Number(merged.priceCrystals ?? 0));
      const cur: 'gold' | 'crystals' | 'both' =
        g > 0 && c > 0 ? 'both' : c > 0 ? 'crystals' : 'gold';
      return {
        ...merged,
        priceGold: g,
        priceCrystals: c,
        price: g > 0 ? g : c,
        currency: cur,
        stepSeconds: Math.max(2, Number(merged.stepSeconds || 22)),
        cargoCapacity: Math.max(10, Number(merged.cargoCapacity || 100))
      };
    });
    const nextFlags: GameFeatureFlags = {
      ...featureFlags,
      transportsCatalog: nextList,
      transportsPriceMigratedV2: true,
      transportsCargoMigratedV1: true
    };
    setFeatureFlags(nextFlags);
    if (onShopAndFeaturesUpdated) {
      onShopAndFeaturesUpdated(shopCatalog, nextFlags, shopSkins);
    }
  };

  const handleAddNewTransport = async () => {
    const trimmedName = newTrName.trim();
    if (!trimmedName) {
      showToast('⚠️ Введите название нового транспорта!');
      return;
    }
    const stepSec = Math.max(2, Math.min(60, Number(newTrStepSeconds || 14)));
    const cargoCap = Math.max(10, Math.min(20000, Number(newTrCargoCapacity || 500)));
    const priceVal = Math.max(0, Number(newTrPrice || 10000));
    const newTpl: TransportTemplate = {
      id: `transport_custom_${Date.now()}`,
      name: trimmedName,
      icon: newTrIcon.trim() || '🚢',
      lvl: Math.max(1, Math.min(20, Number(newTrLvl || 1))),
      quality: 'rare',
      travelTimeSec: Math.max(60, stepSec * 20),
      stepSeconds: stepSec,
      cargoCapacity: cargoCap,
      maxDurability: Math.max(10, Number(newTrDurability || 250)),
      priceGold: newTrCurrency === 'gold' ? priceVal : 0,
      priceCrystals: newTrCurrency === 'crystals' ? priceVal : 0,
      price: priceVal,
      currency: newTrCurrency,
      enabled: true,
      description: `Скорость перехода по карте 10x10: ${stepSec} сек./кл. Грузоподъемность багажника: +${cargoCap} ед. веса.`
    };
    const nextList = [...transportsList, newTpl];
    await handleSaveTransportsToDb(nextList);
    setNewTrName('');
    setGrantTransportId(newTpl.id);
    showToast(`🚤 Новый транспорт «${newTpl.name}» добавлен в каталог!`);
  };

  const handleGrantTransportToPlayer = async (tpl?: TransportTemplate) => {
    const chosenTpl =
      tpl || transportsList.find((t) => t.id === grantTransportId) || transportsList[0];
    if (!chosenTpl) {
      showToast('⚠️ Выберите транспорт для выдачи!');
      return;
    }
    const targetNick = (grantNick || hero.nick || 'RedBlack').trim();
    if (!targetNick) {
      showToast('⚠️ Укажите ник игрока!');
      return;
    }
    const transportItem = createTransportItemFromTemplate(chosenTpl);
    setIsSaving(true);
    try {
      if (targetNick.toLowerCase() === (hero.nick || '').toLowerCase()) {
        const nextInv = [transportItem, ...(selfInventory || [])];
        if (setSelfInventory) setSelfInventory(nextInv);
        setHero((prev) => ({
          ...prev,
          activeTransportId: transportItem.id
        }));
        await updatePlayerInDatabase(hero.nick || targetNick, {
          inventory: nextInv,
          active_transport_id: transportItem.id,
          activeTransportId: transportItem.id,
          external_sync_ts: Date.now(),
          is_admin_action: true
        });
        showToast(
          `🚤 Транспорт «${chosenTpl.name}» (+${chosenTpl.cargoCapacity || 100} веса, ${chosenTpl.stepSeconds || 22} сек./кл.) выдан и экипирован вам (${targetNick})!`
        );
      } else {
        const row = await findPlayerInSupabase(targetNick);
        const curInv: GameItem[] = Array.isArray(row?.inventory) ? row.inventory : [];
        const nextInv = [transportItem, ...curInv];
        await updatePlayerInDatabase(targetNick, {
          inventory: nextInv,
          active_transport_id: transportItem.id,
          activeTransportId: transportItem.id,
          external_sync_ts: Date.now(),
          is_admin_action: true
        });
        showToast(
          `🚤 Транспорт «${chosenTpl.name}» (+${chosenTpl.cargoCapacity || 100} веса, ${chosenTpl.stepSeconds || 22} сек./кл.) выдан игроку ${targetNick}!`
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (mode === 'clansAndRanks') {
    const ranksCatalog = getClanSyndicateRanksCatalog();
    const lookupClan = clanLookupNumberInput.trim()
      ? findClanByNumberOrId(clanLookupNumberInput.trim())
      : undefined;
    const targetClanForBase =
      lookupClan ||
      allClans.find((c) => c.id === selectedBaseClanId) ||
      allClans.find((c) => c.id === hero.clanId) ||
      allClans[0];
    const curBase = targetClanForBase?.baseBuildings || {
      infirmaryLevel: 1,
      commandPostLevel: 1,
      outpostLevel: 1,
      powerStationLevel: 1,
      powerChargeKw: 100,
      maxPowerChargeKw: 150,
      lastPowerUpdatedAt: Date.now()
    };
    const targetPlayerRankInfo = getPlayerClanRankAndPts(rankTargetNick || hero.nick || 'RedBlack');

    const syncSelectedClanInputs = (c?: typeof targetClanForBase) => {
      if (!c) return;
      setEditClanNumber(String(c.clanNumber || 1));
      setEditClanName(c.name || '');
      setEditClanTag(c.tag || '');
      setEditClanEmblem(c.emblem || '🛡️');
      setEditClanLevel(String(c.level || 1));
      setEditClanGold(String(c.treasuryGold || 0));
      setEditClanCrystals(String(c.treasuryCrystals || 0));
    };

    const handleQuickSetPlayerRank = (levelToSet: number, ptsOverride?: number) => {
      const targetNickClean = (rankTargetNick || hero.nick || 'RedBlack').trim();
      const rkObj = ranksCatalog.find((r) => r.level === levelToSet) || ranksCatalog[0];
      const ptsToApply =
        typeof ptsOverride === 'number'
          ? Math.max(0, ptsOverride)
          : Math.max(Number(rankTargetPtsInput) || 0, rkObj.requiredPts);
      const res = adminSetPlayerClanRankAndPts(targetNickClean, levelToSet, ptsToApply);
      if (!res.ok) {
        showToast(`⚠️ ${res.error}`);
        return;
      }
      if (targetNickClean.toLowerCase() === (hero.nick || '').trim().toLowerCase()) {
        setHero((prev) => ({
          ...prev,
          hasClanBadge: true,
          clanBadgeEquipped: true,
          clanRankLevel: levelToSet,
          clanPts: ptsToApply
        }));
      }
      setRankTargetLevelInput(levelToSet);
      setRankTargetPtsInput(String(ptsToApply));
      setRefreshTick((v) => v + 1);
      showToast(res.message || `🎖️ Звание обновлено!`);
    };

    return (
      <div className="space-y-3">
        {/* 0. УПРАВЛЕНИЕ КЛАНАМИ (ПО #ID И ИЗ СПИСКА: РЕДАКТОР КЛАНА, ПУЛА PTS И СОЗДАНИЕ НОВОГО КЛАНА) */}
        <div className="rounded-xl border-2 border-purple-500/70 bg-slate-900/95 p-3 space-y-2.5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div>
              <div className="text-sm font-black uppercase text-purple-300">
                🏛️ Управление Кланами (Редактор по #ID, Казна, Пул PTS и Создание Синдикатов)
              </div>
              <p className="text-[10px] text-slate-300">
                Выберите любой клан по номеру #ID (например, #1, #105, #8348) или из списка, чтобы изменить его #ID, Тег, Название, Уровень (1–10), Казну или Общий пул PTS.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-300">Поиск по #ID:</span>
                <input
                  type="text"
                  value={clanLookupNumberInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setClanLookupNumberInput(v);
                    const found = findClanByNumberOrId(v);
                    if (found) {
                      setSelectedBaseClanId(found.id);
                      syncSelectedClanInputs(found);
                    }
                  }}
                  placeholder="#105"
                  className="w-20 rounded border border-purple-400/60 bg-slate-950 px-2 py-1 font-mono text-xs font-bold text-amber-300"
                />
              </div>
              {allClans.length > 0 && (
                <select
                  value={targetClanForBase?.id || ''}
                  onChange={(e) => {
                    setSelectedBaseClanId(e.target.value);
                    setClanLookupNumberInput('');
                    const found = allClans.find((c) => c.id === e.target.value);
                    if (found) syncSelectedClanInputs(found);
                  }}
                  className="rounded border border-purple-400/60 bg-slate-950 px-2.5 py-1 text-xs font-black text-amber-300"
                >
                  {allClans
                    .slice()
                    .sort((a, b) => (a.clanNumber || 9999) - (b.clanNumber || 9999))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.clanNumber || 1} [{c.tag}] {c.name} (Ур. {c.level} • Пул: {c.unassignedPtsPool || 0} PTS)
                      </option>
                    ))}
                </select>
              )}
            </div>
          </div>

          {targetClanForBase && (
            <div className="space-y-2.5">
              {/* Редактирование параметров выбранного клана */}
              <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 text-[10px] bg-slate-950/90 p-2.5 rounded border border-slate-800">
                <div>
                  <label className="font-bold text-amber-300">#ID Клана:</label>
                  <input
                    type="number"
                    min={1}
                    max={99999}
                    value={editClanNumber !== '' ? editClanNumber : String(targetClanForBase.clanNumber || 1)}
                    onChange={(e) => setEditClanNumber(e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono font-bold text-amber-300"
                  />
                </div>
                <div>
                  <label className="font-bold text-amber-200">Тег:</label>
                  <input
                    type="text"
                    maxLength={8}
                    value={editClanTag !== '' ? editClanTag : targetClanForBase.tag}
                    onChange={(e) => setEditClanTag(e.target.value.toUpperCase())}
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-bold text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-200">Название клана:</label>
                  <input
                    type="text"
                    value={editClanName !== '' ? editClanName : targetClanForBase.name}
                    onChange={(e) => setEditClanName(e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-bold text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300">Знак (Иконка):</label>
                  <input
                    type="text"
                    value={editClanEmblem !== '' ? editClanEmblem : targetClanForBase.emblem}
                    onChange={(e) => setEditClanEmblem(e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-center font-bold text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-purple-300">Уровень (1–10):</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={editClanLevel !== '' ? editClanLevel : String(targetClanForBase.level || 1)}
                    onChange={(e) => setEditClanLevel(e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono font-bold text-purple-300"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      const res = adminUpdateClanFullParams(targetClanForBase.id, {
                        clanNumber: Number(editClanNumber !== '' ? editClanNumber : targetClanForBase.clanNumber || 1),
                        tag: editClanTag !== '' ? editClanTag : targetClanForBase.tag,
                        name: editClanName !== '' ? editClanName : targetClanForBase.name,
                        emblem: editClanEmblem !== '' ? editClanEmblem : targetClanForBase.emblem,
                        level: Number(editClanLevel !== '' ? editClanLevel : targetClanForBase.level || 1),
                        treasuryGold:
                          editClanGold !== '' ? Number(editClanGold) : targetClanForBase.treasuryGold || 0,
                        treasuryCrystals:
                          editClanCrystals !== ''
                            ? Number(editClanCrystals)
                            : targetClanForBase.treasuryCrystals || 0
                      });
                      if (!res.ok) {
                        showToast(`⚠️ ${res.error}`);
                        return;
                      }
                      setRefreshTick((v) => v + 1);
                      showToast(res.message || '💾 Параметры клана сохранены!');
                    }}
                    className="w-full rounded border border-purple-400 bg-purple-600 py-1 text-[10px] font-black text-white hover:bg-purple-500 cursor-pointer"
                  >
                    💾 Сохранить
                  </button>
                </div>
              </div>

              {/* Смена Главы выбранного клана в 1 клик */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] bg-slate-950/90 p-2.5 rounded border border-amber-500/50">
                <div>
                  <span className="font-black text-amber-300">
                    👑 Текущий Глава клана #{targetClanForBase.clanNumber || 1} [{targetClanForBase.tag}]:
                  </span>{' '}
                  <span className="font-bold text-white">{targetClanForBase.leaderNick}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="text"
                    value={adminNewLeaderNickInput}
                    onChange={(e) => setAdminNewLeaderNickInput(e.target.value)}
                    placeholder="Ник нового Главы клана..."
                    className="w-44 rounded border border-amber-500/60 bg-slate-900 px-2 py-1 font-bold text-white"
                  />
                  <select
                    value={adminNewLeaderNickInput}
                    onChange={(e) => setAdminNewLeaderNickInput(e.target.value)}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 font-bold text-amber-200"
                  >
                    <option value="">-- Из списка --</option>
                    <option value="Redblack">Redblack</option>
                    {combinedPlayersList.map((p) => (
                      <option key={`adm_ldr_${p.nick}`} value={p.nick}>
                        {p.nick} (Ур. {p.lvl})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const targetNick = adminNewLeaderNickInput.trim();
                      if (!targetNick) {
                        showToast('⚠️ Введите или выберите ник нового Главы клана!');
                        return;
                      }
                      const res = transferClanLeadership(
                        targetClanForBase.id,
                        hero.nick || 'Redblack',
                        targetNick,
                        true
                      );
                      if (!res.ok) {
                        showToast(`⚠️ ${res.error}`);
                        return;
                      }
                      setAdminNewLeaderNickInput('');
                      setRefreshTick((v) => v + 1);
                      showToast(res.message || `👑 Новый Глава клана назначен: ${targetNick}!`);
                    }}
                    className="rounded border border-amber-400 bg-amber-500 hover:bg-amber-400 px-2.5 py-1 font-black text-slate-950 cursor-pointer"
                  >
                    [ 👑 Сменить Главу клана в 1 клик ]
                  </button>
                </div>
              </div>

              {/* Казна и Общий Пул PTS выбранного клана */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] bg-slate-950/90 p-2.5 rounded border border-slate-800">
                <div>
                  <label className="font-bold text-yellow-300">
                    🪙 Золото в казне (Сейчас: {(targetClanForBase.treasuryGold || 0).toLocaleString('ru-RU')}):
                  </label>
                  <div className="flex gap-1 mt-0.5">
                    <input
                      type="number"
                      min={0}
                      value={editClanGold !== '' ? editClanGold : String(targetClanForBase.treasuryGold || 0)}
                      onChange={(e) => setEditClanGold(e.target.value)}
                      className="w-full rounded border border-yellow-500/50 bg-slate-900 px-2 py-1 font-mono font-bold text-yellow-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nextGold = Math.max(0, Number(editClanGold || targetClanForBase.treasuryGold || 0));
                        const res = adminUpdateClanFullParams(targetClanForBase.id, { treasuryGold: nextGold });
                        if (res.ok) {
                          setRefreshTick((v) => v + 1);
                          showToast(`🪙 Казна клана #${targetClanForBase.clanNumber || 1} [${targetClanForBase.tag}] = ${nextGold.toLocaleString('ru-RU')} зол.`);
                        }
                      }}
                      className="rounded border border-yellow-400 bg-yellow-700 px-2 py-1 font-black text-white shrink-0 cursor-pointer"
                    >
                      Задать 🪙
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-cyan-300">
                    💎 Кристаллы в казне (Сейчас: {(targetClanForBase.treasuryCrystals || 0).toLocaleString('ru-RU')}):
                  </label>
                  <div className="flex gap-1 mt-0.5">
                    <input
                      type="number"
                      min={0}
                      value={
                        editClanCrystals !== ''
                          ? editClanCrystals
                          : String(targetClanForBase.treasuryCrystals || 0)
                      }
                      onChange={(e) => setEditClanCrystals(e.target.value)}
                      className="w-full rounded border border-cyan-500/50 bg-slate-900 px-2 py-1 font-mono font-bold text-cyan-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nextCr = Math.max(
                          0,
                          Number(editClanCrystals || targetClanForBase.treasuryCrystals || 0)
                        );
                        const res = adminUpdateClanFullParams(targetClanForBase.id, {
                          treasuryCrystals: nextCr
                        });
                        if (res.ok) {
                          setRefreshTick((v) => v + 1);
                          showToast(`💎 Кристаллы клана #${targetClanForBase.clanNumber || 1} [${targetClanForBase.tag}] = ${nextCr.toLocaleString('ru-RU')}`);
                        }
                      }}
                      className="rounded border border-cyan-400 bg-cyan-700 px-2 py-1 font-black text-white shrink-0 cursor-pointer"
                    >
                      Задать 💎
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-emerald-300">
                    🎖️ Общий пул PTS клана (Сейчас: {(targetClanForBase.unassignedPtsPool || 0).toLocaleString('ru-RU')} PTS):
                  </label>
                  <div className="flex gap-1 mt-0.5">
                    <input
                      type="number"
                      min={1}
                      value={clanPtsDeltaInput}
                      onChange={(e) => setClanPtsDeltaInput(e.target.value)}
                      className="w-24 rounded border border-emerald-500/50 bg-slate-900 px-2 py-1 font-mono font-bold text-emerald-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const delta = Math.max(1, Number(clanPtsDeltaInput) || 1000);
                        const res = adminAdjustClanPtsPool(targetClanForBase.id, delta);
                        if (res.ok) {
                          setRefreshTick((v) => v + 1);
                          showToast(res.message || `+${delta} PTS в пул клана!`);
                        }
                      }}
                      className="rounded border border-emerald-400 bg-emerald-600 px-2 py-1 font-black text-slate-950 shrink-0 cursor-pointer"
                    >
                      [ + Добавить PTS ]
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const delta = Math.max(1, Number(clanPtsDeltaInput) || 1000);
                        const res = adminAdjustClanPtsPool(targetClanForBase.id, -delta);
                        if (res.ok) {
                          setRefreshTick((v) => v + 1);
                          showToast(res.message || `-${delta} PTS из пула клана!`);
                        }
                      }}
                      className="rounded border border-red-400 bg-red-800 px-2 py-1 font-black text-white shrink-0 cursor-pointer"
                    >
                      [ - Забрать PTS ]
                    </button>
                  </div>
                </div>
              </div>

              {/* Создание нового клана с нужным #ID в 1 клик */}
              <div className="rounded border border-emerald-500/40 bg-slate-950/90 p-2.5 space-y-1.5 text-[10px]">
                <div className="font-black uppercase text-emerald-300">
                  ➕ Создать новый клан с нужным #ID (для тестов, союзов и войн):
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-7 gap-1.5 items-end">
                  <div>
                    <label className="text-slate-400">#ID:</label>
                    <input
                      type="number"
                      min={1}
                      value={newClanNumberInput}
                      onChange={(e) => setNewClanNumberInput(e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono font-bold text-amber-300"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400">Тег:</label>
                    <input
                      type="text"
                      maxLength={8}
                      value={newClanTagInput}
                      onChange={(e) => setNewClanTagInput(e.target.value.toUpperCase())}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-bold text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-slate-400">Название:</label>
                    <input
                      type="text"
                      value={newClanNameInput}
                      onChange={(e) => setNewClanNameInput(e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-bold text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400">Знак / Ур.:</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newClanEmblemInput}
                        onChange={(e) => setNewClanEmblemInput(e.target.value)}
                        className="w-10 rounded border border-slate-700 bg-slate-900 px-1 py-1 text-center"
                      />
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={newClanLevelInput}
                        onChange={(e) => setNewClanLevelInput(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 font-mono text-purple-300"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400">Казна 🪙 / PTS:</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={0}
                        value={newClanGoldInput}
                        onChange={(e) => setNewClanGoldInput(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 font-mono text-yellow-300"
                      />
                      <input
                        type="number"
                        min={0}
                        value={newClanPtsInput}
                        onChange={(e) => setNewClanPtsInput(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 font-mono text-emerald-300"
                      />
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        const res = adminCreateCustomClan({
                          clanNumber: Number(newClanNumberInput) || 999,
                          tag: newClanTagInput,
                          name: newClanNameInput,
                          emblem: newClanEmblemInput || '🛡️',
                          level: Number(newClanLevelInput) || 1,
                          treasuryGold: Number(newClanGoldInput) || 100000,
                          unassignedPtsPool: Number(newClanPtsInput) || 5000
                        });
                        if (!res.ok) {
                          showToast(`⚠️ ${res.error}`);
                          return;
                        }
                        if (res.clan) {
                          setSelectedBaseClanId(res.clan.id);
                          syncSelectedClanInputs(res.clan);
                        }
                        setRefreshTick((v) => v + 1);
                        showToast(res.message || '✨ Новый клан создан!');
                      }}
                      className="w-full rounded border border-emerald-400 bg-emerald-600 py-1 text-[10px] font-black text-slate-950 hover:bg-emerald-500 cursor-pointer"
                    >
                      [ + Создать новый клан ]
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 1. ВЫДАЧА ПОГОНА (1–15) И PTS ЛЮБОМУ ИГРОКУ (RedBlack) В 1 КЛИК */}
        <div className="rounded-xl border-2 border-amber-500/70 bg-slate-900/95 p-3 space-y-2.5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div>
              <div className="text-sm font-black uppercase text-amber-300">
                🎖️ 1. Личный Клановый Опыт (PTS) игрока и Присвоение любого Погона (1–15) в 1 клик
              </div>
              <p className="text-[10px] text-slate-300">
                Выберите игрока (например, RedBlack), прибавьте/убавьте личные PTS или нажмите на любой погон ниже для мгновенного присвоения звания и выдачи Знака клана.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded border border-slate-700 bg-slate-950 px-2.5 py-1">
              <ClanRankEpaulette rankLevel={targetPlayerRankInfo.rankLevel} size="md" />
              <div className="text-[10px]">
                <div className="font-black text-amber-300">
                  {rankTargetNick || hero.nick}: {targetPlayerRankInfo.rankConfig.title} (#{targetPlayerRankInfo.rankLevel})
                </div>
                <div className="font-mono text-emerald-300">
                  Личный опыт: {targetPlayerRankInfo.pts.toLocaleString('ru-RU')} PTS
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[10.5px]">
            <div>
              <label className="font-bold text-amber-200">Ник игрока:</label>
              <input
                type="text"
                value={rankTargetNick}
                onChange={(e) => setRankTargetNick(e.target.value)}
                placeholder="RedBlack"
                className="mt-0.5 w-full rounded border border-amber-500/50 bg-slate-950 px-2 py-1 font-bold text-white"
              />
            </div>
            <div>
              <label className="font-bold text-slate-300">Из списка игроков:</label>
              <select
                value={rankTargetNick}
                onChange={(e) => setRankTargetNick(e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-bold text-amber-300"
              >
                <option value={hero.nick || 'RedBlack'}>⚡ {hero.nick || 'RedBlack'} (Вы)</option>
                {combinedPlayersList.map((p) => (
                  <option key={p.nick} value={p.nick}>
                    {p.nick} (Ур. {p.lvl})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-emerald-300">Личные PTS (+ / -):</label>
              <div className="flex gap-1 mt-0.5">
                <input
                  type="number"
                  min={0}
                  value={rankTargetPtsInput}
                  onChange={(e) => setRankTargetPtsInput(e.target.value)}
                  className="w-full rounded border border-emerald-500/50 bg-slate-950 px-2 py-1 font-mono font-bold text-emerald-300"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleQuickSetPlayerRank(
                      targetPlayerRankInfo.rankLevel,
                      targetPlayerRankInfo.pts + (Math.max(1, Number(rankTargetPtsInput)) || 1000)
                    )
                  }
                  className="rounded border border-emerald-400 bg-emerald-600 px-1.5 py-1 text-[9.5px] font-black text-slate-950 cursor-pointer shrink-0"
                  title="Добавить личные PTS игроку"
                >
                  +PTS
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleQuickSetPlayerRank(
                      targetPlayerRankInfo.rankLevel,
                      Math.max(0, targetPlayerRankInfo.pts - (Math.max(1, Number(rankTargetPtsInput)) || 1000))
                    )
                  }
                  className="rounded border border-red-400 bg-red-800 px-1.5 py-1 text-[9.5px] font-black text-white cursor-pointer shrink-0"
                  title="Забрать личные PTS у игрока"
                >
                  -PTS
                </button>
              </div>
            </div>
            <div>
              <label className="font-bold text-amber-300">Уровень Погона (1–15):</label>
              <div className="flex gap-1 mt-0.5">
                <select
                  value={rankTargetLevelInput}
                  onChange={(e) => setRankTargetLevelInput(Number(e.target.value) || 1)}
                  className="w-full rounded border border-amber-500/50 bg-slate-950 px-2 py-1 font-bold text-amber-200"
                >
                  {ranksCatalog.map((r) => (
                    <option key={r.level} value={r.level}>
                      #{r.level} {r.title} ({r.requiredPts} PTS)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleQuickSetPlayerRank(rankTargetLevelInput)}
                  className="rounded border border-amber-300 bg-amber-500 px-2.5 py-1 text-[10px] font-black text-slate-950 cursor-pointer shrink-0"
                >
                  Выдать
                </button>
              </div>
            </div>
          </div>

          {/* Сетка всех 15 погон для мгновенного присвоения в 1 клик */}
          <div className="pt-1">
            <div className="text-[10px] font-bold text-slate-400 mb-1">
              ⚡ Нажмите на любой Погон ниже, чтобы мгновенно присвоить его игроку «{rankTargetNick || hero.nick}» в 1 клик:
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {ranksCatalog.map((r) => (
                <button
                  key={`quick_rk_${r.level}`}
                  type="button"
                  onClick={() => handleQuickSetPlayerRank(r.level, r.requiredPts)}
                  className={`flex items-center gap-1.5 rounded border px-2 py-1 text-left transition-colors cursor-pointer ${
                    targetPlayerRankInfo.rankLevel === r.level
                      ? 'border-amber-400 bg-amber-950/60 text-amber-200'
                      : 'border-slate-800 bg-slate-950 hover:border-amber-500/50 text-slate-200'
                  }`}
                >
                  <ClanRankEpaulette rankLevel={r.level} size="sm" />
                  <div className="min-w-0 truncate text-[9.5px]">
                    <div className="font-bold truncate">
                      #{r.level} {r.title}
                    </div>
                    <div className="text-[8.5px] font-mono text-emerald-300">
                      {r.requiredPts.toLocaleString('ru-RU')} PTS
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. УПРАВЛЕНИЕ ПОСТРОЙКАМИ КЛАНОВОЙ БАЗЫ (УРОВНИ 1–4 И ЗАРЯД СТАНЦИИ) */}
        <div className="rounded-xl border-2 border-cyan-500/70 bg-slate-900/95 p-3 space-y-2.5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div>
              <div className="text-sm font-black uppercase text-cyan-300">
                🏰 2. Управление Клановой Базой (Лазарет, Командный пункт, Форпост, Зарядная станция — Ур. 1–4)
              </div>
              <p className="text-[10px] text-slate-300">
                Изменяйте уровни стратегических строений любого клана (от 1 до 4 ур.) и заряжайте Зарядную станцию на 100% в 1 клик.
              </p>
            </div>
            {allClans.length > 0 && (
              <select
                value={targetClanForBase?.id || ''}
                onChange={(e) => setSelectedBaseClanId(e.target.value)}
                className="rounded border border-cyan-400/60 bg-slate-950 px-2.5 py-1 text-xs font-black text-amber-300"
              >
                {allClans.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.clanNumber || 1} [{c.tag}] {c.name} (Ур. {c.level})
                  </option>
                ))}
              </select>
            )}
          </div>

          {targetClanForBase ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10.5px]">
              {(
                [
                  { key: 'infirmaryLevel', label: '🏥 Лазарет (Ур. 1–4)', val: curBase.infirmaryLevel },
                  { key: 'commandPostLevel', label: '📡 Командный пункт (Ур. 1–4)', val: curBase.commandPostLevel },
                  { key: 'outpostLevel', label: '🛡️ Форпост (Ур. 1–4)', val: curBase.outpostLevel },
                  { key: 'powerStationLevel', label: '⚡ Зарядная станция (Ур. 1–4)', val: curBase.powerStationLevel }
                ] as const
              ).map((bItem) => (
                <div key={bItem.key} className="rounded border border-slate-800 bg-slate-950 p-2 space-y-1">
                  <div className="font-bold text-slate-200">{bItem.label}</div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4].map((lvl) => (
                      <button
                        key={`${bItem.key}_${lvl}`}
                        type="button"
                        onClick={() => {
                          const res = adminSetClanBaseBuildingLevels(targetClanForBase.id, {
                            [bItem.key]: lvl
                          });
                          if (res.ok) {
                            setRefreshTick((v) => v + 1);
                            showToast(res.message || 'Уровень строения обновлён!');
                          }
                        }}
                        className={`flex-1 rounded border py-1 font-mono text-[10px] font-black cursor-pointer ${
                          bItem.val === lvl
                            ? 'border-amber-400 bg-amber-500 text-slate-950'
                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-amber-400/50'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="rounded border border-slate-800 bg-slate-950 p-2 flex flex-col justify-between gap-1">
                <div className="font-bold text-emerald-300">
                  🔋 Заряд: {curBase.powerChargeKw}/{curBase.maxPowerChargeKw} кВт
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const res = adminSetClanBaseBuildingLevels(targetClanForBase.id, {
                      infirmaryLevel: 4,
                      commandPostLevel: 4,
                      outpostLevel: 4,
                      powerStationLevel: 4,
                      powerChargeKw: 600
                    });
                    if (res.ok) {
                      setRefreshTick((v) => v + 1);
                      showToast(`🏰 Все постройки базы [${targetClanForBase.tag}] улучшены до 4 ур. и заряжены на 100%!`);
                    }
                  }}
                  className="w-full rounded border border-emerald-400 bg-emerald-500 py-1 text-[10px] font-black text-slate-950 cursor-pointer"
                >
                  ⚡ Всё 4 ур. + 100% Заряд
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">Пока нет созданных кланов.</div>
          )}
        </div>

        {/* 3. РЕДАКТОР ТАБЛИЦЫ ВСЕХ 15 ЗВАНИЙ (ПОГОН): PTS, ЦЕНА В ЗОЛОТЕ, БОНУСЫ */}
        <div className="rounded-xl border-2 border-emerald-500/70 bg-slate-900/95 p-3 space-y-2.5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div>
              <div className="text-sm font-black uppercase text-emerald-300">
                📊 3. Таблица всех 15 Воинских Званий (Погон) — Редактирование PTS, Цены и Бонусов
              </div>
              <p className="text-[10px] text-slate-300">
                Любое изменение порога опыта (PTS), стоимости погона в золоте или боевых бонусов сразу применяется в «Военторге клана».
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                adminResetClanSyndicateRanks();
                setRefreshTick((v) => v + 1);
                showToast('↺ Таблица 15 Погон сброшена к стандартным значениям Gwars!');
              }}
              className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[10px] font-bold text-slate-200 cursor-pointer"
            >
              ↺ Сбросить таблицу званий по умолчанию
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-800 bg-slate-950">
            <table className="w-full border-collapse text-[10.5px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900 text-slate-300">
                  <th className="py-1.5 px-2 text-center">Ур.</th>
                  <th className="py-1.5 px-2 text-center">Погон</th>
                  <th className="py-1.5 px-2 text-left">Название звания</th>
                  <th className="py-1.5 px-2 text-center">Порог PTS</th>
                  <th className="py-1.5 px-2 text-center">Цена (🪙)</th>
                  <th className="py-1.5 px-2 text-center">+Выносл.</th>
                  <th className="py-1.5 px-2 text-center">+% HP</th>
                  <th className="py-1.5 px-2 text-center">+Сила</th>
                  <th className="py-1.5 px-2 text-center">+% Урон</th>
                  <th className="py-1.5 px-2 text-center">+% Броня</th>
                  <th className="py-1.5 px-2 text-center">+Вес</th>
                </tr>
              </thead>
              <tbody>
                {ranksCatalog.map((r) => (
                  <tr key={`adm_rk_${r.level}`} className="border-b border-slate-800/80 hover:bg-slate-900/50">
                    <td className="py-1 px-2 text-center font-mono font-bold text-slate-400">
                      #{r.level}
                    </td>
                    <td className="py-1 px-2 text-center">
                      <ClanRankEpaulette rankLevel={r.level} size="md" />
                    </td>
                    <td className="py-1 px-2">
                      <input
                        type="text"
                        value={r.title}
                        onChange={(e) => {
                          adminUpdateClanSyndicateRank(r.level, { title: e.target.value });
                          setRefreshTick((v) => v + 1);
                        }}
                        className="w-36 border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-bold text-amber-200"
                      />
                    </td>
                    <td className="py-1 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={r.requiredPts}
                        onChange={(e) => {
                          adminUpdateClanSyndicateRank(r.level, {
                            requiredPts: Math.max(0, parseInt(e.target.value, 10) || 0)
                          });
                          setRefreshTick((v) => v + 1);
                        }}
                        className="w-20 border border-slate-700 bg-slate-900 px-1 py-0.5 text-right font-mono text-emerald-300"
                      />
                    </td>
                    <td className="py-1 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={r.costGold}
                        onChange={(e) => {
                          adminUpdateClanSyndicateRank(r.level, {
                            costGold: Math.max(0, parseInt(e.target.value, 10) || 0)
                          });
                          setRefreshTick((v) => v + 1);
                        }}
                        className="w-24 border border-slate-700 bg-slate-900 px-1 py-0.5 text-right font-mono text-amber-300"
                      />
                    </td>
                    <td className="py-1 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={r.vitBonus}
                        onChange={(e) => {
                          adminUpdateClanSyndicateRank(r.level, {
                            vitBonus: Math.max(0, parseInt(e.target.value, 10) || 0)
                          });
                          setRefreshTick((v) => v + 1);
                        }}
                        className="w-12 border border-slate-700 bg-slate-900 px-1 py-0.5 text-center font-mono text-white"
                      />
                    </td>
                    <td className="py-1 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={r.hpBonusPct}
                        onChange={(e) => {
                          adminUpdateClanSyndicateRank(r.level, {
                            hpBonusPct: Math.max(0, parseInt(e.target.value, 10) || 0)
                          });
                          setRefreshTick((v) => v + 1);
                        }}
                        className="w-12 border border-slate-700 bg-slate-900 px-1 py-0.5 text-center font-mono text-rose-300"
                      />
                    </td>
                    <td className="py-1 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={r.strBonus}
                        onChange={(e) => {
                          adminUpdateClanSyndicateRank(r.level, {
                            strBonus: Math.max(0, parseInt(e.target.value, 10) || 0)
                          });
                          setRefreshTick((v) => v + 1);
                        }}
                        className="w-12 border border-slate-700 bg-slate-900 px-1 py-0.5 text-center font-mono text-white"
                      />
                    </td>
                    <td className="py-1 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={r.dmgBonusPct}
                        onChange={(e) => {
                          adminUpdateClanSyndicateRank(r.level, {
                            dmgBonusPct: Math.max(0, parseInt(e.target.value, 10) || 0)
                          });
                          setRefreshTick((v) => v + 1);
                        }}
                        className="w-12 border border-slate-700 bg-slate-900 px-1 py-0.5 text-center font-mono text-amber-300"
                      />
                    </td>
                    <td className="py-1 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={r.armorBonusPct}
                        onChange={(e) => {
                          adminUpdateClanSyndicateRank(r.level, {
                            armorBonusPct: Math.max(0, parseInt(e.target.value, 10) || 0)
                          });
                          setRefreshTick((v) => v + 1);
                        }}
                        className="w-12 border border-slate-700 bg-slate-900 px-1 py-0.5 text-center font-mono text-sky-300"
                      />
                    </td>
                    <td className="py-1 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={r.cargoWeightBonus}
                        onChange={(e) => {
                          adminUpdateClanSyndicateRank(r.level, {
                            cargoWeightBonus: Math.max(0, parseInt(e.target.value, 10) || 0)
                          });
                          setRefreshTick((v) => v + 1);
                        }}
                        className="w-14 border border-slate-700 bg-slate-900 px-1 py-0.5 text-center font-mono text-emerald-300"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'vehicles') {
    return (
      <div className="space-y-3">
        {/* Заголовок вкладки 1: Управление Транспортом */}
        <div className="rounded-xl border-2 border-cyan-500/70 bg-slate-900/95 p-3 shadow-lg space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div>
              <div className="text-sm font-black text-cyan-300 uppercase tracking-wide">
                🚤 Вкладка 1: «Управление Транспортом» (Скорость по карте 10x10 и Грузоподъемность багажника)
              </div>
              <p className="text-[10px] text-slate-300">
                Редактируйте скорость перехода по клеткам (сек./кл.), вместимость багажника (+ед. веса) и цены любого транспорта, создавайте новый транспорт или выдавайте его игрокам в 1 клик.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveTransportsToDb(transportsList)}
                className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-[10.5px] font-black text-slate-950 shadow hover:brightness-110 cursor-pointer"
              >
                {isSaving ? '⏳ Сохранение...' : '💾 Сохранить всю таблицу транспорта'}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() =>
                  handleSaveTransportsToDb(DEFAULT_TRANSPORTS.map((t) => ({ ...t })))
                }
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                ↺ Сбросить к базовым 4 видам
              </button>
            </div>
          </div>

          {/* Таблица существующего транспорта с inline-редактированием */}
          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
            <table className="w-full border-collapse text-[10.5px]">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-left text-cyan-300">
                  <th className="py-2 px-2">Иконка</th>
                  <th className="py-2 px-2">Название транспорта</th>
                  <th className="py-2 px-2 text-center">Скорость (сек./кл.)</th>
                  <th className="py-2 px-2 text-center">Грузоподъемность (+вес)</th>
                  <th className="py-2 px-2 text-center">Цена 🪙</th>
                  <th className="py-2 px-2 text-center">Цена 💎</th>
                  <th className="py-2 px-2 text-center">Ур.</th>
                  <th className="py-2 px-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {transportsList.map((tr, idx) => (
                  <tr
                    key={tr.id}
                    className="border-b border-slate-800/80 hover:bg-slate-900/60"
                  >
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-1">
                        <div className="h-8 w-8 rounded border border-cyan-500/40 bg-slate-900 flex items-center justify-center shrink-0 overflow-hidden">
                          <ItemIcon icon={tr.icon || '🚤'} name={tr.name} className="text-lg" />
                        </div>
                        <input
                          type="text"
                          value={tr.icon || '🚤'}
                          onChange={(e) =>
                            handleInlineTransportChange(idx, { icon: e.target.value })
                          }
                          className="w-12 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-center text-xs text-white"
                        />
                      </div>
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        type="text"
                        value={tr.name}
                        onChange={(e) =>
                          handleInlineTransportChange(idx, { name: e.target.value })
                        }
                        className="w-full min-w-[180px] rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-black text-amber-300"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min={2}
                          max={60}
                          value={tr.stepSeconds ?? 22}
                          onChange={(e) =>
                            handleInlineTransportChange(idx, {
                              stepSeconds: Math.max(2, parseInt(e.target.value, 10) || 22)
                            })
                          }
                          className="w-16 rounded border border-cyan-500/50 bg-slate-900 px-1.5 py-1 text-center font-mono font-black text-cyan-200"
                        />
                        <span className="text-[9px] text-slate-400">сек.</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <div className="inline-flex items-center gap-1">
                        <span className="text-emerald-400 font-black">+</span>
                        <input
                          type="number"
                          min={10}
                          max={50000}
                          value={tr.cargoCapacity ?? 100}
                          onChange={(e) =>
                            handleInlineTransportChange(idx, {
                              cargoCapacity: Math.max(10, parseInt(e.target.value, 10) || 100)
                            })
                          }
                          className="w-20 rounded border border-emerald-500/50 bg-slate-900 px-1.5 py-1 text-center font-mono font-black text-emerald-300"
                        />
                        <span className="text-[9px] text-slate-400">ед.</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={tr.priceGold ?? 0}
                        onChange={(e) =>
                          handleInlineTransportChange(idx, {
                            priceGold: Math.max(0, parseInt(e.target.value, 10) || 0)
                          })
                        }
                        className="w-24 rounded border border-amber-500/40 bg-slate-900 px-1.5 py-1 text-right font-mono font-bold text-amber-300"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={tr.priceCrystals ?? 0}
                        onChange={(e) =>
                          handleInlineTransportChange(idx, {
                            priceCrystals: Math.max(0, parseInt(e.target.value, 10) || 0)
                          })
                        }
                        className="w-20 rounded border border-cyan-500/40 bg-slate-900 px-1.5 py-1 text-right font-mono font-bold text-cyan-300"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={tr.lvl || 1}
                        onChange={(e) =>
                          handleInlineTransportChange(idx, {
                            lvl: Math.max(1, parseInt(e.target.value, 10) || 1)
                          })
                        }
                        className="w-12 rounded border border-slate-700 bg-slate-900 px-1 py-1 text-center font-bold text-purple-200"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveTransportsToDb(transportsList)}
                          className="rounded border border-emerald-500/60 bg-emerald-950/80 hover:bg-emerald-800 px-2 py-1 text-[9.5px] font-black text-emerald-200 cursor-pointer"
                        >
                          Сохранить
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleGrantTransportToPlayer(tr)}
                          className="rounded border border-cyan-500/60 bg-cyan-950/80 hover:bg-cyan-800 px-2 py-1 text-[9.5px] font-black text-cyan-200 cursor-pointer"
                          title={`Выдать игроку ${grantNick || hero.nick}`}
                        >
                          🎁 Выдать
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Форма "+ Добавить новый транспорт" и блок "[ Выдать транспорт игроку ]" */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Форма + Добавить новый транспорт */}
          <div className="rounded-xl border-2 border-emerald-500/60 bg-slate-900/95 p-3 space-y-2.5 shadow">
            <div className="text-xs font-black uppercase text-emerald-300 border-b border-slate-800 pb-1.5">
              ➕ Добавить новый транспорт в каталог Верфи и Магазина
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
              <div className="col-span-2">
                <label className="font-bold text-slate-300">Название транспорта:</label>
                <input
                  type="text"
                  value={newTrName}
                  onChange={(e) => setNewTrName(e.target.value)}
                  placeholder="Напр.: Военная галера Фараона"
                  className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-black text-amber-300"
                />
              </div>
              <div>
                <label className="font-bold text-slate-300">Иконка / Спрайт:</label>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="text"
                    value={newTrIcon}
                    onChange={(e) => setNewTrIcon(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-center text-xs text-white"
                  />
                  <label className="rounded border border-cyan-500/50 bg-cyan-950 px-1.5 py-1 text-[9px] font-bold text-cyan-200 cursor-pointer shrink-0">
                    📷
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const res = await processUploadedItemImage(file, 'cover');
                        e.target.value = '';
                        if (res.dataUrl) setNewTrIcon(res.dataUrl);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <div>
                <label className="font-bold text-cyan-300">Скорость (сек./клетка):</label>
                <input
                  type="number"
                  min={2}
                  max={60}
                  value={newTrStepSeconds}
                  onChange={(e) => setNewTrStepSeconds(Math.max(2, parseInt(e.target.value, 10) || 14))}
                  className="mt-0.5 w-full rounded border border-cyan-500/50 bg-slate-950 px-2 py-1 font-mono font-black text-cyan-200"
                />
              </div>
              <div>
                <label className="font-bold text-emerald-300">Вместимость багажника (+вес):</label>
                <input
                  type="number"
                  min={10}
                  max={50000}
                  value={newTrCargoCapacity}
                  onChange={(e) => setNewTrCargoCapacity(Math.max(10, parseInt(e.target.value, 10) || 500))}
                  className="mt-0.5 w-full rounded border border-emerald-500/50 bg-slate-950 px-2 py-1 font-mono font-black text-emerald-300"
                />
              </div>
              <div>
                <label className="font-bold text-amber-300">Цена и валюта:</label>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="number"
                    min={0}
                    value={newTrPrice}
                    onChange={(e) => setNewTrPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full rounded border border-amber-500/50 bg-slate-950 px-2 py-1 font-mono font-bold text-amber-200"
                  />
                  <select
                    value={newTrCurrency}
                    onChange={(e) => setNewTrCurrency(e.target.value as 'gold' | 'crystals')}
                    className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs font-bold text-white"
                  >
                    <option value="gold">🪙</option>
                    <option value="crystals">💎</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-bold text-purple-300">Уровень:</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={newTrLvl}
                  onChange={(e) => setNewTrLvl(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-bold text-purple-200"
                />
              </div>
              <div>
                <label className="font-bold text-slate-300">Прочность:</label>
                <input
                  type="number"
                  min={10}
                  max={10000}
                  value={newTrDurability}
                  onChange={(e) => setNewTrDurability(Math.max(10, parseInt(e.target.value, 10) || 250))}
                  className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-bold text-slate-200"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleAddNewTransport}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2 text-xs font-black uppercase text-slate-950 shadow hover:brightness-110 cursor-pointer"
            >
              + Добавить новый транспорт
            </button>
          </div>

          {/* Блок [ Выдать транспорт игроку ] */}
          <div className="rounded-xl border-2 border-amber-500/60 bg-slate-900/95 p-3 space-y-2.5 shadow flex flex-col justify-between">
            <div className="space-y-2">
              <div className="text-xs font-black uppercase text-amber-300 border-b border-slate-800 pb-1.5">
                🎁 Выдать транспорт игроку в гараж / инвентарь
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                <div>
                  <label className="font-bold text-amber-200">Ник игрока (например, RedBlack):</label>
                  <input
                    type="text"
                    value={grantNick}
                    onChange={(e) => setGrantNick(e.target.value)}
                    placeholder="RedBlack"
                    className="mt-0.5 w-full rounded border border-amber-500/50 bg-slate-950 px-2 py-1.5 text-xs font-black text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300">Или выберите из списка БД:</label>
                  <select
                    value={grantNick}
                    onChange={(e) => setGrantNick(e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-bold text-amber-300"
                  >
                    <option value={hero.nick || 'RedBlack'}>⚡ {hero.nick || 'RedBlack'} (Вы)</option>
                    {combinedPlayersList
                      .filter((p) => p.isReal)
                      .map((p) => (
                        <option key={p.nick} value={p.nick}>
                          {p.nick} (Ур. {p.lvl})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="text-[10px]">
                <label className="font-bold text-cyan-300">Выберите транспорт для выдачи:</label>
                <select
                  value={grantTransportId}
                  onChange={(e) => setGrantTransportId(e.target.value)}
                  className="mt-0.5 w-full rounded border border-cyan-500/50 bg-slate-950 px-2 py-1.5 text-xs font-black text-cyan-200"
                >
                  {transportsList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.icon} {t.name} — Скорость: {t.stepSeconds || 22} сек./кл. | Грузоподъемность: +{t.cargoCapacity || 100} веса
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleGrantTransportToPlayer()}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 py-2.5 text-xs font-black uppercase text-slate-950 shadow-lg hover:brightness-110 cursor-pointer"
            >
              [ Выдать транспорт игроку «{grantNick || hero.nick}» ]
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== ВКЛАДКА 2: РЕДАКТОР ЭКОНОМИКИ И НЕДВИЖИМОСТИ ====================
  return (
    <div className="space-y-4">
      {/* 1. Таблица всех 14 типов ресурсов */}
      <div className="rounded-xl border-2 border-emerald-500/70 bg-slate-900/95 p-3 space-y-2.5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div>
            <div className="text-sm font-black text-emerald-300 uppercase tracking-wide">
              📦 1. Таблица всех 14 типов ресурсов Порта (Вес, цены Терминала и пополнение остатков)
            </div>
            <p className="text-[10px] text-slate-300">
              Сырье 1-го этапа = 1 ед. веса | Полуфабрикаты 2-го этапа = 2 ед. веса | Продукция 3-го этапа = 5 ед. веса | Мощность (кВт) и Обед Таверны = 0 ед. веса.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              adminRefillTerminalStock('all', PORT_TERMINAL_INITIAL_STOCK);
              showToast('🔄 Остатки всех ресурсов Торгового терминала пополнены до 20 000 ед.!');
              setRefreshTick((v) => v + 1);
            }}
            className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-[10.5px] font-black text-slate-950 shadow hover:brightness-110 cursor-pointer"
          >
            🔄 Пополнить все ресурсы Терминала до 20 000 ед. в 1 клик
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-left text-emerald-300">
                <th className="py-1.5 px-2">Ресурс</th>
                <th className="py-1.5 px-2">Категория</th>
                <th className="py-1.5 px-2 text-center">Вес 1 шт. (ед.)</th>
                <th className="py-1.5 px-2 text-center">Покупка с Терминала (🪙)</th>
                <th className="py-1.5 px-2 text-center">Продажа в Терминал (🪙)</th>
                <th className="py-1.5 px-2 text-center">Остаток на Терминале</th>
                <th className="py-1.5 px-2 text-right">Пополнение в 1 клик</th>
              </tr>
            </thead>
            <tbody>
              {resourcesCatalog.map((item) => {
                const curStock = Math.max(0, Number(terminalState.stocks[item.key] ?? 0));
                const isOnTerm = ![
                  'hardened_steel',
                  'synthetic_fuel',
                  'combat_ration',
                  'combat_modules',
                  'port_relics',
                  'titanium_plate',
                  'assault_charge',
                  'power_kw',
                  'tavern_meal'
                ].includes(item.key);
                return (
                  <tr key={item.key} className="border-b border-slate-800/80 hover:bg-slate-900/60">
                    <td className="py-1.5 px-2 font-black text-white">
                      <span className="mr-1.5">{item.icon}</span>
                      {item.name}
                    </td>
                    <td className="py-1.5 px-2 text-slate-400">{item.category}</td>
                    <td className="py-1.5 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={item.weight ?? 1}
                        onChange={(e) => {
                          const w = Math.max(0, parseInt(e.target.value, 10) || 0);
                          adminUpdatePortResourceConfig(item.key as PortTerminalResourceKey, {
                            weight: w
                          });
                          setRefreshTick((v) => v + 1);
                        }}
                        className="w-16 rounded border border-amber-500/50 bg-slate-900 px-1.5 py-0.5 text-center font-mono font-black text-amber-300"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={item.buyPriceGold}
                        onChange={(e) => {
                          const p = Math.max(1, parseInt(e.target.value, 10) || 1);
                          adminUpdatePortResourceConfig(item.key as PortTerminalResourceKey, {
                            buyPriceGold: p
                          });
                          setRefreshTick((v) => v + 1);
                        }}
                        className="w-20 rounded border border-cyan-500/40 bg-slate-900 px-1.5 py-0.5 text-right font-mono font-bold text-cyan-200"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={item.sellPriceGold}
                        onChange={(e) => {
                          const p = Math.max(1, parseInt(e.target.value, 10) || 1);
                          adminUpdatePortResourceConfig(item.key as PortTerminalResourceKey, {
                            sellPriceGold: p
                          });
                          setRefreshTick((v) => v + 1);
                        }}
                        className="w-20 rounded border border-emerald-500/40 bg-slate-900 px-1.5 py-0.5 text-right font-mono font-bold text-emerald-300"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-200">
                      {isOnTerm ? `${curStock.toLocaleString('ru-RU')} ед.` : 'Только на заводах'}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      {isOnTerm ? (
                        <button
                          type="button"
                          onClick={() => {
                            adminRefillTerminalStock(
                              item.key as PortTerminalResourceKey,
                              PORT_TERMINAL_INITIAL_STOCK
                            );
                            showToast(`🔄 Запас «${item.name}» на Терминале пополнен до 20 000 ед.!`);
                            setRefreshTick((v) => v + 1);
                          }}
                          className="rounded border border-emerald-500/60 bg-emerald-950/80 hover:bg-emerald-800 px-2 py-0.5 text-[9px] font-black text-emerald-200 cursor-pointer"
                        >
                          +20 000 ед.
                        </button>
                      ) : (
                        <span className="text-[9px] text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Таблица всех объектов недвижимости на карте 10x10 */}
      <div className="rounded-xl border-2 border-amber-500/70 bg-slate-900/95 p-3 space-y-2.5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div>
            <div className="text-sm font-black text-amber-300 uppercase tracking-wide">
              🏭 2. Редактор всех объектов недвижимости на карте 10x10 ({territoriesList.length} объектов)
            </div>
            <p className="text-[10px] text-slate-300">
              Редактируйте владельца, контролирующий клан, кассу завода (🪙), прочность здания (0..100), координаты [X/Y], зарплату, запасы энергии (кВт) и нормы расхода/выхода ресурсов.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const res = adminAssignAllEstatesToRedblack();
                showToast(res.message);
                setRefreshTick((v) => v + 1);
              }}
              className="rounded-lg border border-amber-300 bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-1.5 text-[10.5px] font-black text-slate-950 shadow hover:brightness-110 cursor-pointer"
            >
              [ 👑 Назначить Redblack владельцем всей недвижимости острова ]
            </button>
            <input
              type="text"
              value={estateFilterText}
              onChange={(e) => setEstateFilterText(e.target.value)}
              placeholder="🔍 Поиск по названию, сектору [X/Y] или владельцу..."
              className="w-64 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white outline-none"
            />
          </div>
        </div>

        {/* Быстрая передача любого завода другому игроку в 1 клик */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/50 bg-slate-950 p-2.5 text-[10.5px]">
          <div className="font-black text-amber-300">
            🤝 Сменить владельца любого объекта недвижимости в 1 клик (касса остается на заводе):
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={adminTransferEstateId || territoriesList[0]?.id || ''}
              onChange={(e) => setAdminTransferEstateId(e.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 font-bold text-amber-200 max-w-xs"
            >
              {territoriesList.map((s) => (
                <option key={`tr_est_${s.id}`} value={s.id}>
                  [{s.mapX}/{s.mapY}] {s.name} (Владелец: {s.ownerNick || 'Redblack'})
                </option>
              ))}
            </select>
            <input
              type="text"
              value={adminTransferEstateNick}
              onChange={(e) => setAdminTransferEstateNick(e.target.value)}
              placeholder="Ник нового владельца..."
              className="w-40 rounded border border-amber-500/60 bg-slate-900 px-2 py-1 font-bold text-white"
            />
            <button
              type="button"
              onClick={() => {
                const targetId = adminTransferEstateId || territoriesList[0]?.id;
                const targetNick = adminTransferEstateNick.trim();
                if (!targetId || !targetNick) {
                  showToast('⚠️ Выберите объект и введите ник нового владельца!');
                  return;
                }
                const res = transferPortEstateOwnership(targetId, hero.nick || 'Redblack', targetNick, true);
                if (!res.ok) {
                  showToast(`⚠️ ${res.error}`);
                  return;
                }
                setAdminTransferEstateNick('');
                setRefreshTick((v) => v + 1);
                showToast(res.message || '🤝 Владелец завода успешно изменен!');
              }}
              className="rounded border border-emerald-400 bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 font-black text-slate-950 cursor-pointer"
            >
              [ 🤝 Передать объект в 1 клик ]
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-left text-amber-300">
                <th className="py-1.5 px-2">Сектор [X/Y]</th>
                <th className="py-1.5 px-2">Объект недвижимости</th>
                <th className="py-1.5 px-2">Владелец (Ник)</th>
                <th className="py-1.5 px-2">Клан</th>
                <th className="py-1.5 px-2 text-center">Касса (🪙)</th>
                <th className="py-1.5 px-2 text-center">Прочность</th>
                <th className="py-1.5 px-2 text-center">Зарплата/ч</th>
                <th className="py-1.5 px-2 text-center">Энергия (кВт)</th>
                <th className="py-1.5 px-2 text-right">Настройки норм/цен</th>
              </tr>
            </thead>
            <tbody>
              {territoriesList.map((sec: ClanTerritorySector) => {
                const prod = sec.production;
                const dur = Math.max(0, Math.min(100, Number(prod?.buildingDurability ?? 100)));
                const isExpanded = expandedEstateId === sec.id;

                return (
                  <React.Fragment key={sec.id}>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/60">
                      <td className="py-1.5 px-2">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={sec.mapX || 5}
                            onChange={(e) => {
                              adminUpdatePortEstateSector(sec.id, {
                                mapX: Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 5))
                              });
                              setRefreshTick((v) => v + 1);
                            }}
                            className="w-10 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-center font-mono font-bold text-cyan-300"
                          />
                          <span>/</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={sec.mapY || 5}
                            onChange={(e) => {
                              adminUpdatePortEstateSector(sec.id, {
                                mapY: Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 5))
                              });
                              setRefreshTick((v) => v + 1);
                            }}
                            className="w-10 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-center font-mono font-bold text-cyan-300"
                          />
                        </div>
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={sec.name}
                          onChange={(e) => {
                            adminUpdatePortEstateSector(sec.id, { name: e.target.value });
                            setRefreshTick((v) => v + 1);
                          }}
                          className="w-44 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-black text-white"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={sec.ownerNick || 'RedBlack'}
                          onChange={(e) => {
                            adminUpdatePortEstateSector(sec.id, {
                              ownerNick: e.target.value
                            });
                            setRefreshTick((v) => v + 1);
                          }}
                          className="w-24 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-bold text-amber-200"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <select
                          value={sec.ownerClanId || ''}
                          onChange={(e) => {
                            const chosenClan = allClans.find((c) => c.id === e.target.value);
                            if (chosenClan) {
                              adminUpdatePortEstateSector(sec.id, {
                                ownerClanId: chosenClan.id,
                                ownerClanName: chosenClan.name,
                                ownerClanTag: chosenClan.tag,
                                ownerClanEmblem: chosenClan.emblem
                              });
                            } else {
                              adminUpdatePortEstateSector(sec.id, {
                                ownerClanTag: e.target.value || 'RB'
                              });
                            }
                            setRefreshTick((v) => v + 1);
                          }}
                          className="w-28 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[9.5px] font-bold text-cyan-200"
                        >
                          <option value={sec.ownerClanId || 'clan_redblack'}>
                            [{sec.ownerClanTag || 'RB'}] {sec.ownerClanName || 'RedBlack'}
                          </option>
                          {allClans.map((c) => (
                            <option key={c.id} value={c.id}>
                              [{c.tag}] {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <input
                          type="number"
                          min={0}
                          value={prod?.facilityBalanceGold ?? 0}
                          onChange={(e) => {
                            adminUpdatePortEstateSector(sec.id, {
                              facilityBalanceGold: Math.max(0, parseInt(e.target.value, 10) || 0)
                            });
                            setRefreshTick((v) => v + 1);
                          }}
                          className="w-24 rounded border border-amber-500/40 bg-slate-900 px-1.5 py-0.5 text-right font-mono font-bold text-amber-300"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={dur}
                            onChange={(e) => {
                              adminUpdatePortEstateSector(sec.id, {
                                buildingDurability: Math.max(
                                  0,
                                  Math.min(100, parseInt(e.target.value, 10) || 0)
                                )
                              });
                              setRefreshTick((v) => v + 1);
                            }}
                            className={`w-14 rounded border px-1 py-0.5 text-center font-mono font-black ${
                              dur <= 0
                                ? 'border-rose-500 bg-rose-950 text-rose-300'
                                : 'border-emerald-500/40 bg-slate-900 text-emerald-300'
                            }`}
                          />
                          {dur < 100 && (
                            <button
                              type="button"
                              onClick={() => {
                                repairPortRealEstateObject(sec.id, hero.nick || 'Admin', 99, 99);
                                showToast(`🛠️ Объект «${sec.name}» отремонтирован до 100/100!`);
                                setRefreshTick((v) => v + 1);
                              }}
                              className="rounded bg-emerald-700 px-1.5 py-0.5 text-[8.5px] font-black text-white cursor-pointer"
                              title="Мгновенно починить до 100/100"
                            >
                              100%
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <input
                          type="number"
                          min={10}
                          value={prod?.workerWageGold ?? 250}
                          onChange={(e) => {
                            adminUpdatePortEstateSector(sec.id, {
                              workerWageGold: Math.max(10, parseInt(e.target.value, 10) || 250)
                            });
                            setRefreshTick((v) => v + 1);
                          }}
                          className="w-16 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-center font-mono font-bold text-emerald-200"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <input
                          type="number"
                          min={0}
                          value={prod?.powerStock ?? 0}
                          onChange={(e) => {
                            adminUpdatePortEstateSector(sec.id, {
                              powerStock: Math.max(0, parseInt(e.target.value, 10) || 0)
                            });
                            setRefreshTick((v) => v + 1);
                          }}
                          className="w-16 rounded border border-cyan-500/40 bg-slate-900 px-1 py-0.5 text-center font-mono font-bold text-cyan-200"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedEstateId(isExpanded ? null : sec.id)}
                          className="rounded border border-amber-500/50 bg-amber-950/70 hover:bg-amber-900 px-2 py-0.5 text-[9.5px] font-black text-amber-200 cursor-pointer"
                        >
                          {isExpanded ? '▲ Скрыть нормы' : '⚙️ Рецепт / Цены'}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && prod && (
                      <tr className="bg-slate-900/95 border-b border-amber-500/40">
                        <td colSpan={9} className="p-2.5">
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[9.5px]">
                            <div>
                              <label className="font-bold text-emerald-300">
                                Выход ({prod.outputProductName || 'Продукция'}) шт./ч:
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={prod.outputRatePerHour || 1}
                                onChange={(e) => {
                                  adminUpdatePortEstateSector(sec.id, {
                                    outputRatePerHour: Math.max(1, parseInt(e.target.value, 10) || 1)
                                  });
                                  setRefreshTick((v) => v + 1);
                                }}
                                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono font-bold text-emerald-300"
                              />
                            </div>
                            <div>
                              <label className="font-bold text-amber-300">Цена продажи выхода (🪙):</label>
                              <input
                                type="number"
                                min={1}
                                value={prod.productSellPriceGold || 100}
                                onChange={(e) => {
                                  adminUpdatePortEstateSector(sec.id, {
                                    productSellPriceGold: Math.max(1, parseInt(e.target.value, 10) || 100)
                                  });
                                  setRefreshTick((v) => v + 1);
                                }}
                                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono font-bold text-amber-300"
                              />
                            </div>
                            <div>
                              <label className="font-bold text-slate-300">Остаток на складе (шт.):</label>
                              <input
                                type="number"
                                min={0}
                                value={prod.relicStock || 0}
                                onChange={(e) => {
                                  adminUpdatePortEstateSector(sec.id, {
                                    relicStock: Math.max(0, parseInt(e.target.value, 10) || 0)
                                  });
                                  setRefreshTick((v) => v + 1);
                                }}
                                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono font-bold text-white"
                              />
                            </div>
                            <div>
                              <label className="font-bold text-cyan-300">Расход Мощности (кВт/ч):</label>
                              <input
                                type="number"
                                min={0}
                                value={prod.powerRequiredPerCycle ?? 0}
                                onChange={(e) => {
                                  adminUpdatePortEstateSector(sec.id, {
                                    powerRequiredPerCycle: Math.max(0, parseInt(e.target.value, 10) || 0)
                                  });
                                  setRefreshTick((v) => v + 1);
                                }}
                                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono font-bold text-cyan-200"
                              />
                            </div>
                            {prod.input1ResourceName && (
                              <div>
                                <label className="font-bold text-sky-300">
                                  Вход 1 ({prod.input1ResourceName}) норма/цена:
                                </label>
                                <div className="flex gap-1 mt-0.5">
                                  <input
                                    type="number"
                                    min={0}
                                    value={prod.input1RequiredPerCycle ?? 0}
                                    onChange={(e) => {
                                      adminUpdatePortEstateSector(sec.id, {
                                        input1RequiredPerCycle: Math.max(0, parseInt(e.target.value, 10) || 0)
                                      });
                                      setRefreshTick((v) => v + 1);
                                    }}
                                    className="w-1/2 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 font-mono text-white"
                                    title="Норма расхода за цикл"
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    value={prod.rawBuyPriceGold ?? 50}
                                    onChange={(e) => {
                                      adminUpdatePortEstateSector(sec.id, {
                                        rawBuyPriceGold: Math.max(1, parseInt(e.target.value, 10) || 50)
                                      });
                                      setRefreshTick((v) => v + 1);
                                    }}
                                    className="w-1/2 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 font-mono text-amber-300"
                                    title="Цена скупки (🪙)"
                                  />
                                </div>
                              </div>
                            )}
                            {prod.input2ResourceName && (
                              <div>
                                <label className="font-bold text-sky-300">
                                  Вход 2 ({prod.input2ResourceName}) норма/цена:
                                </label>
                                <div className="flex gap-1 mt-0.5">
                                  <input
                                    type="number"
                                    min={0}
                                    value={prod.input2RequiredPerCycle ?? 0}
                                    onChange={(e) => {
                                      adminUpdatePortEstateSector(sec.id, {
                                        input2RequiredPerCycle: Math.max(0, parseInt(e.target.value, 10) || 0)
                                      });
                                      setRefreshTick((v) => v + 1);
                                    }}
                                    className="w-1/2 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 font-mono text-white"
                                    title="Норма расхода за цикл"
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    value={prod.input2BuyPriceGold ?? 50}
                                    onChange={(e) => {
                                      adminUpdatePortEstateSector(sec.id, {
                                        input2BuyPriceGold: Math.max(1, parseInt(e.target.value, 10) || 50)
                                      });
                                      setRefreshTick((v) => v + 1);
                                    }}
                                    className="w-1/2 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 font-mono text-amber-300"
                                    title="Цена скупки (🪙)"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
