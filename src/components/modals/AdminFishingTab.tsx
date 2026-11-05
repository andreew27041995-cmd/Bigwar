import React, { useState } from 'react';
import {
  GlobalFishingConfig,
  FishSpecies,
  FishingRodTemplate,
  FishRarity,
  DEFAULT_FISH_SPECIES,
  DEFAULT_FISHING_RODS,
  DEFAULT_SUNKEN_CHEST_CONFIG,
  FISH_RARITY_META,
  getFishingConfig,
  saveFishingConfig
} from '../../utils/fishingConfig';
import { processUploadedItemImage } from '../../utils/imageUpload';
import { GameFeatureFlags, ShopItemTemplate, CharacterSkinTemplate } from '../../types/game';
import { saveShopAndFeaturesToSupabase } from '../../utils/shopConfig';

interface AdminFishingTabProps {
  featureFlags: GameFeatureFlags;
  setFeatureFlags: React.Dispatch<React.SetStateAction<GameFeatureFlags>>;
  shopCatalog: ShopItemTemplate[];
  shopSkins: CharacterSkinTemplate[];
  onShopAndFeaturesUpdated?: (
    catalog: ShopItemTemplate[],
    flags: GameFeatureFlags,
    skins?: CharacterSkinTemplate[]
  ) => void;
  showToast: (msg: string) => void;
}

export const AdminFishingTab: React.FC<AdminFishingTabProps> = ({
  featureFlags,
  setFeatureFlags,
  shopCatalog,
  shopSkins,
  onShopAndFeaturesUpdated,
  showToast
}) => {
  const [fishingCfg, setFishingCfg] = useState<GlobalFishingConfig>(() =>
    getFishingConfig(featureFlags.fishingConfig)
  );
  const [maxPerHall, setMaxPerHall] = useState<number>(
    Math.max(10, Math.min(50, Number(featureFlags.maxPlayersPerPyramidHall || 25)))
  );
  const [subSection, setSubSection] = useState<'overview' | 'rods' | 'fish'>('overview');
  const [fishRarityFilter, setFishRarityFilter] = useState<'all' | FishRarity>('all');
  const [fishSearch, setFishSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAllFishingSettings = async (overrideCfg?: GlobalFishingConfig, overrideHallMax?: number) => {
    const cfgToSave = overrideCfg || fishingCfg;
    const hallCap = overrideHallMax ?? maxPerHall;
    setIsSaving(true);
    try {
      saveFishingConfig(cfgToSave);
      const nextFlags: GameFeatureFlags = {
        ...featureFlags,
        fishingConfig: cfgToSave,
        maxPlayersPerPyramidHall: hallCap
      };
      setFeatureFlags(nextFlags);
      const ok = await saveShopAndFeaturesToSupabase(shopCatalog, nextFlags, shopSkins);
      if (onShopAndFeaturesUpdated) {
        onShopAndFeaturesUpdated(shopCatalog, nextFlags, shopSkins);
      }
      showToast(
        ok
          ? '🎣 Настройки Рыбалки (50 рыб, Сундук, 5 удочек) и Зеркал Пирамиды сохранены в БД!'
          : '🎣 Настройки Рыбалки сохранены локально!'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateFish = (fishId: string, patch: Partial<FishSpecies>) => {
    setFishingCfg((prev) => ({
      ...prev,
      fishSpecies: prev.fishSpecies.map((f) => (f.id === fishId ? { ...f, ...patch } : f))
    }));
  };

  const handleUploadFishImage = async (fishId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await processUploadedItemImage(file, 'cover');
    e.target.value = '';
    if ((!res.ok && !res.success) || !res.dataUrl) {
      showToast(res.error || 'Ошибка загрузки картинки рыбы');
      return;
    }
    handleUpdateFish(fishId, { image: res.dataUrl });
    showToast('✅ Своя картинка рыбы загружена! Не забудьте нажать «Сохранить».');
  };

  const handleUpdateRod = (rodLvl: number, patch: Partial<FishingRodTemplate>) => {
    setFishingCfg((prev) => ({
      ...prev,
      rods: prev.rods.map((r) => (r.level === rodLvl ? { ...r, ...patch } : r))
    }));
  };

  const handleUploadRodImage = async (rodLvl: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await processUploadedItemImage(file, 'cover');
    e.target.value = '';
    if ((!res.ok && !res.success) || !res.dataUrl) {
      showToast(res.error || 'Ошибка загрузки картинки удочки');
      return;
    }
    handleUpdateRod(rodLvl, { icon: res.dataUrl });
    showToast(`✅ Картинка для Удочки ${rodLvl} ур. загружена!`);
  };

  const handleRecalculateRodProgression30Pct = () => {
    // Base requirement for Rod 2 (default 50), then +30% step for Rod 3, 4, 5
    const rod2Req = Math.max(10, Number(fishingCfg.rods.find((r) => r.level === 2)?.requiredFishCaught || 50));
    const rod3Req = Math.round(rod2Req * 1.3);
    const rod4Req = Math.round(rod3Req * 1.3);
    const rod5Req = Math.round(rod4Req * 1.3);
    const mapReq: Record<number, number> = {
      1: 0,
      2: rod2Req,
      3: rod3Req,
      4: rod4Req,
      5: rod5Req
    };
    setFishingCfg((prev) => ({
      ...prev,
      rods: prev.rods.map((r) => ({
        ...r,
        requiredFishCaught: mapReq[r.level] ?? r.requiredFishCaught
      }))
    }));
    showToast(`📐 Требования удочек пересчитаны с шагом +30%: 0 → ${rod2Req} → ${rod3Req} → ${rod4Req} → ${rod5Req} рыб!`);
  };

  const handleResetFishingDefaults = async () => {
    const defaultFishes = DEFAULT_FISH_SPECIES.map((f) => ({ ...f }));
    const defaultChest = { ...DEFAULT_SUNKEN_CHEST_CONFIG };
    const resetCfg: GlobalFishingConfig = {
      enabled: true,
      energyPerCast: 2,
      fishSpecies: defaultFishes,
      fishes: defaultFishes,
      rods: DEFAULT_FISHING_RODS.map((r) => ({ ...r })),
      sunkenChest: defaultChest,
      chestConfig: defaultChest
    };
    setFishingCfg(resetCfg);
    setMaxPerHall(25);
    await handleSaveAllFishingSettings(resetCfg, 25);
  };

  const filteredFish = fishingCfg.fishSpecies.filter((f) => {
    if (fishRarityFilter !== 'all' && f.rarity !== fishRarityFilter) return false;
    if (fishSearch.trim()) {
      const q = fishSearch.trim().toLowerCase();
      return f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q);
    }
    return true;
  });

  const totalChestInnerWeight =
    Number(fishingCfg.sunkenChest.relicWeightPct || 0) +
    Number(fishingCfg.sunkenChest.expBuffWeightPct || 0) +
    Number(fishingCfg.sunkenChest.energyWeightPct || 0);

  return (
    <div className="space-y-3">
      {/* Sub-navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-500/50 bg-gradient-to-r from-teal-950/80 via-slate-900 to-cyan-950/80 p-2.5">
        <div>
          <div className="text-sm font-black text-teal-300 flex items-center gap-1.5">
            <span>🎣 Управление разделом «Рыбалка» и Зеркалами Пирамиды</span>
          </div>
          <p className="text-[10px] text-slate-300">
            Настройка 50 видов рыб, шансов Затонувшего сундука (Реликвия / Опыт 10 мин / Энергия), 5 удочек и лимита Залов Пирамиды (200–500+ онлайн).
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleResetFishingDefaults}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-slate-700 cursor-pointer"
          >
            ↩️ Сброс по умолчанию
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveAllFishingSettings()}
            className="rounded-lg bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400 px-3 py-1.5 text-[10.5px] font-black text-slate-950 shadow-md hover:brightness-110 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? '⏳ Сохранение...' : '💾 Сохранить всё в БД'}
          </button>
        </div>
      </div>

      {/* Section Switcher */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => setSubSection('overview')}
          className={`rounded-lg py-2 px-2 text-[10.5px] font-black border transition-all cursor-pointer ${
            subSection === 'overview'
              ? 'border-amber-400 bg-amber-500/20 text-amber-200 shadow'
              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          🧰 Сундук, Энергия и Зеркала (200–500+)
        </button>
        <button
          type="button"
          onClick={() => setSubSection('rods')}
          className={`rounded-lg py-2 px-2 text-[10.5px] font-black border transition-all cursor-pointer ${
            subSection === 'rods'
              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow'
              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          🎣 5 Удочек (Шаг +30%: 0/50/65/85/110)
        </button>
        <button
          type="button"
          onClick={() => setSubSection('fish')}
          className={`rounded-lg py-2 px-2 text-[10.5px] font-black border transition-all cursor-pointer ${
            subSection === 'fish'
              ? 'border-teal-400 bg-teal-500/20 text-teal-200 shadow'
              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          🐟 Каталог 50 видов рыб ({fishingCfg.fishSpecies.length})
        </button>
      </div>

      {/* 1. OVERVIEW: SUNKEN CHEST + PYRAMID MIRROR HALLS */}
      {subSection === 'overview' && (
        <div className="space-y-3">
          {/* Sunken Chest Settings */}
          <div className="rounded-xl border border-amber-500/50 bg-slate-900/95 p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="text-xs font-black text-amber-300">
                🧰 Настройка «Затонувшего сундука» и заброса удочки
              </div>
              <span className="rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[9.5px] font-black text-amber-200">
                Базовый шанс сундука: {fishingCfg.sunkenChest.dropChancePct}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                <label className="block text-[9.5px] text-slate-400 mb-1">
                  ⚡ Энергия за 1 заброс удочки:
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={fishingCfg.energyPerCast}
                  onChange={(e) =>
                    setFishingCfg((prev) => ({
                      ...prev,
                      energyPerCast: Math.max(0, Math.min(20, Number(e.target.value) || 0))
                    }))
                  }
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-black text-sky-300"
                />
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                <label className="block text-[9.5px] text-slate-400 mb-1">
                  🧰 Шанс вылова Сундука (%):
                </label>
                <input
                  type="number"
                  min={1}
                  max={65}
                  step={0.5}
                  value={fishingCfg.sunkenChest.dropChancePct}
                  onChange={(e) =>
                    setFishingCfg((prev) => ({
                      ...prev,
                      sunkenChest: {
                        ...prev.sunkenChest,
                        dropChancePct: Math.max(0.5, Math.min(65, Number(e.target.value) || 8))
                      }
                    }))
                  }
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-black text-amber-300"
                />
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                <label className="block text-[9.5px] text-slate-400 mb-1">
                  ✨ Величина баффа опыта (%):
                </label>
                <input
                  type="number"
                  min={5}
                  max={200}
                  value={fishingCfg.sunkenChest.expBuffPct}
                  onChange={(e) =>
                    setFishingCfg((prev) => ({
                      ...prev,
                      sunkenChest: {
                        ...prev.sunkenChest,
                        expBuffPct: Math.max(5, Math.min(200, Number(e.target.value) || 25))
                      }
                    }))
                  }
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-black text-purple-300"
                />
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                <label className="block text-[9.5px] text-slate-400 mb-1">
                  ⏱️ Длительность баффа опыта (мин):
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={fishingCfg.sunkenChest.expBuffDurationMin}
                  onChange={(e) =>
                    setFishingCfg((prev) => ({
                      ...prev,
                      sunkenChest: {
                        ...prev.sunkenChest,
                        expBuffDurationMin: Math.max(1, Math.min(120, Number(e.target.value) || 10))
                      }
                    }))
                  }
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-black text-purple-300"
                />
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-slate-950 p-2.5 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black text-amber-200">
                <span>🎲 Проценты выпадения наград внутри Затонувшего сундука:</span>
                <span className="text-slate-400">Сумма весов: {totalChestInnerWeight}%</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded border border-fuchsia-500/40 bg-fuchsia-950/20 p-2">
                  <label className="block text-[9.5px] font-bold text-fuchsia-300 mb-1">
                    🏺 Реликвия для Алтаря (%):
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={fishingCfg.sunkenChest.relicWeightPct}
                    onChange={(e) =>
                      setFishingCfg((prev) => ({
                        ...prev,
                        sunkenChest: {
                          ...prev.sunkenChest,
                          relicWeightPct: Math.max(0, Math.min(100, Number(e.target.value) || 0))
                        }
                      }))
                    }
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-black text-fuchsia-200"
                  />
                </div>

                <div className="rounded border border-purple-500/40 bg-purple-950/20 p-2">
                  <label className="block text-[9.5px] font-bold text-purple-300 mb-1">
                    ✨ Бонус к опыту на {fishingCfg.sunkenChest.expBuffDurationMin} мин (%):
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={fishingCfg.sunkenChest.expBuffWeightPct}
                    onChange={(e) =>
                      setFishingCfg((prev) => ({
                        ...prev,
                        sunkenChest: {
                          ...prev.sunkenChest,
                          expBuffWeightPct: Math.max(0, Math.min(100, Number(e.target.value) || 0))
                        }
                      }))
                    }
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-black text-purple-200"
                  />
                </div>

                <div className="rounded border border-sky-500/40 bg-sky-950/20 p-2">
                  <label className="block text-[9.5px] font-bold text-sky-300 mb-1">
                    ⚡ Восстановление Энергии (%):
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={fishingCfg.sunkenChest.energyWeightPct}
                    onChange={(e) =>
                      setFishingCfg((prev) => ({
                        ...prev,
                        sunkenChest: {
                          ...prev.sunkenChest,
                          energyWeightPct: Math.max(0, Math.min(100, Number(e.target.value) || 0))
                        }
                      }))
                    }
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-black text-sky-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[9px] text-slate-400 mb-0.5">
                    ⚡ Мин. энергии из сундука:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={fishingCfg.sunkenChest.energyMin}
                    onChange={(e) =>
                      setFishingCfg((prev) => ({
                        ...prev,
                        sunkenChest: {
                          ...prev.sunkenChest,
                          energyMin: Math.max(1, Math.min(200, Number(e.target.value) || 15))
                        }
                      }))
                    }
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-sky-300"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-400 mb-0.5">
                    ⚡ Макс. энергии из сундука:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={fishingCfg.sunkenChest.energyMax}
                    onChange={(e) =>
                      setFishingCfg((prev) => ({
                        ...prev,
                        sunkenChest: {
                          ...prev.sunkenChest,
                          energyMax: Math.max(1, Math.min(300, Number(e.target.value) || 35))
                        }
                      }))
                    }
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-sky-300"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pyramid Mirror Halls Scaling Settings (200-500+ Online) */}
          <div className="rounded-xl border border-cyan-500/50 bg-slate-900/95 p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <div className="text-xs font-black text-cyan-300">
                  🏛️ Масштабирование Пирамиды: Система «Зеркал» (Зал 1, Зал 2, Зал 3...)
                </div>
                <p className="text-[10px] text-slate-400">
                  Автоматическое распределение игроков по изолированным Залам при высоком онлайне (200–500+ человек), чтобы не было давки на клетках и лагов.
                </p>
              </div>
              <span className="rounded bg-cyan-500/20 border border-cyan-500/40 px-2 py-1 text-[10px] font-black text-cyan-200 shrink-0">
                Лимит: {maxPerHall} чел. / Зал
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                <label className="block text-[9.5px] text-slate-300 font-bold mb-1">
                  👥 Макс. игроков на 1 Зал Пирамиды (рек. 20–30):
                </label>
                <input
                  type="number"
                  min={10}
                  max={50}
                  value={maxPerHall}
                  onChange={(e) => setMaxPerHall(Math.max(10, Math.min(50, Number(e.target.value) || 25)))}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-black text-cyan-300"
                />
              </div>
              <div className="sm:col-span-2 rounded-lg border border-slate-800 bg-slate-950 p-2 text-[10px] text-slate-300 space-y-1">
                <div>
                  • При онлайне <strong className="text-emerald-300">200 игроков</strong> создается авто-сеть из{' '}
                  <strong className="text-cyan-300">{Math.ceil(200 / maxPerHall)} Залов</strong> по {maxPerHall} человек.
                </div>
                <div>
                  • При онлайне <strong className="text-amber-300">500 игроков</strong> создается авто-сеть из{' '}
                  <strong className="text-cyan-300">{Math.ceil(500 / maxPerHall)} Залов</strong> (клиент рендерит только игроков своего Зала — 0 лагов на любых смартфонах).
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. RODS PROGRESSION (5 RODS WITH +30% STEP) */}
      {subSection === 'rods' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-500/40 bg-slate-900/90 p-2.5">
            <div>
              <div className="text-xs font-black text-cyan-300">
                🎣 Настройка 5 Удочек (Магазин рыбалки)
              </div>
              <p className="text-[10px] text-slate-400">
                Базовая прогрессия с шагом +30%: Удочка 1 (0 рыб) → Удочка 2 (50 рыб) → Удочка 3 (65 рыб) → Удочка 4 (85 рыб) → Удочка 5 (110 рыб).
              </p>
            </div>
            <button
              type="button"
              onClick={handleRecalculateRodProgression30Pct}
              className="rounded-lg border border-cyan-400/60 bg-cyan-950/80 px-2.5 py-1.5 text-[10px] font-black text-cyan-200 hover:bg-cyan-900 cursor-pointer"
            >
              📐 Авто-пересчет шага +30% от Удочки 2
            </button>
          </div>

          <div className="space-y-2">
            {fishingCfg.rods.map((rod) => {
              const isImg = rod.icon.startsWith('data:image') || rod.icon.startsWith('http') || rod.icon.startsWith('/');
              return (
                <div
                  key={rod.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/95 p-2.5 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/40 bg-slate-950 overflow-hidden shrink-0">
                        {isImg ? (
                          <img src={rod.icon} alt={rod.name} className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-xl">{rod.icon || '🎣'}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-[9.5px] font-black uppercase text-cyan-400">
                          Уровень {rod.level}
                        </span>
                        <input
                          type="text"
                          value={rod.name}
                          onChange={(e) => handleUpdateRod(rod.level, { name: e.target.value })}
                          className="block w-56 sm:w-72 rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs font-black text-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="rounded border border-cyan-500/50 bg-cyan-950/70 px-2 py-1 text-[9.5px] font-bold text-cyan-200 cursor-pointer hover:bg-cyan-900">
                        🖼️ Своя картинка
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadRodImage(rod.level, e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div>
                      <label className="block text-[9px] text-slate-400 mb-0.5">
                        🐟 Требуется пойманных рыб:
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={rod.requiredFishCaught}
                        onChange={(e) =>
                          handleUpdateRod(rod.level, {
                            requiredFishCaught: Math.max(0, Number(e.target.value) || 0)
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-black text-teal-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-400 mb-0.5">
                        🪙 Цена (Золото):
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={rod.priceGold}
                        onChange={(e) =>
                          handleUpdateRod(rod.level, {
                            priceGold: Math.max(0, Number(e.target.value) || 0)
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-black text-amber-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-400 mb-0.5">
                        💎 Цена (Кристаллы):
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={rod.priceCrystals}
                        onChange={(e) =>
                          handleUpdateRod(rod.level, {
                            priceCrystals: Math.max(0, Number(e.target.value) || 0)
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-black text-cyan-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-400 mb-0.5">
                        ✨ Бонус к редкой рыбе (%):
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={200}
                        value={rod.rareFishChanceBonusPct}
                        onChange={(e) =>
                          handleUpdateRod(rod.level, {
                            rareFishChanceBonusPct: Math.max(0, Number(e.target.value) || 0)
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-black text-emerald-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-400 mb-0.5">
                        🧰 Бонус к Сундуку (+%):
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        step={0.5}
                        value={rod.chestChanceBonusPct}
                        onChange={(e) =>
                          handleUpdateRod(rod.level, {
                            chestChanceBonusPct: Math.max(0, Number(e.target.value) || 0)
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-black text-amber-200"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. 50 FISH SPECIES EDITOR */}
      {subSection === 'fish' && (
        <div className="space-y-2.5">
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/95 p-2">
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: 'all', label: `Все (${fishingCfg.fishSpecies.length})` },
                  { id: 'common', label: 'Обычные' },
                  { id: 'uncommon', label: 'Необычные' },
                  { id: 'rare', label: 'Редкие' },
                  { id: 'epic', label: 'Эпические' },
                  { id: 'mythic', label: 'Мифические' }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFishRarityFilter(tab.id)}
                  className={`rounded-md px-2 py-1 text-[9.5px] font-black border transition-all cursor-pointer ${
                    fishRarityFilter === tab.id
                      ? 'border-teal-400 bg-teal-500/20 text-teal-200'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="🔍 Поиск рыбы по названию..."
              value={fishSearch}
              onChange={(e) => setFishSearch(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] text-white outline-none focus:border-teal-400"
            />
          </div>

          <div className="max-h-[620px] overflow-y-auto space-y-1.5 pr-1">
            {filteredFish.map((fish) => {
              const meta = FISH_RARITY_META[fish.rarity] || FISH_RARITY_META.common;
              return (
                <div
                  key={fish.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/95 p-2 flex flex-col gap-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="relative h-11 w-14 rounded-lg border border-slate-700 bg-slate-950 p-1 flex items-center justify-center shrink-0">
                        <img src={fish.image} alt={fish.name} className="h-full w-full object-contain" />
                        <span className="absolute top-0.5 left-1 text-[7.5px] font-black text-slate-400">
                          #{fish.index}
                        </span>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={fish.name}
                          onChange={(e) => handleUpdateFish(fish.id, { name: e.target.value })}
                          className="w-48 sm:w-64 rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] font-black text-white"
                        />
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <select
                            value={fish.rarity}
                            onChange={(e) =>
                              handleUpdateFish(fish.id, { rarity: e.target.value as FishRarity })
                            }
                            className={`rounded border px-1.5 py-0.5 text-[9px] font-black bg-slate-950 ${meta.color} ${meta.border}`}
                          >
                            <option value="common">Обычная</option>
                            <option value="uncommon">Необычная</option>
                            <option value="rare">Редкая</option>
                            <option value="epic">Эпическая</option>
                            <option value="mythic">Мифическая</option>
                          </select>
                          <select
                            value={fish.rewardType}
                            onChange={(e) =>
                              handleUpdateFish(fish.id, {
                                rewardType: e.target.value as 'gold' | 'crystals' | 'both'
                              })
                            }
                            className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[9px] font-bold text-slate-200"
                          >
                            <option value="gold">Награда: 🪙 Золото</option>
                            <option value="crystals">Награда: 💎 Кристаллы</option>
                            <option value="both">Награда: 🪙 + 💎</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <label className="rounded border border-teal-500/50 bg-teal-950/60 px-2 py-1 text-[9px] font-bold text-teal-200 cursor-pointer hover:bg-teal-900">
                      🖼️ Картинка
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUploadFishImage(fish.id, e)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-[9px]">
                    <div>
                      <span className="text-slate-400 block">Шанс/Вес:</span>
                      <input
                        type="number"
                        min={0.1}
                        step={0.5}
                        value={fish.catchWeight}
                        onChange={(e) =>
                          handleUpdateFish(fish.id, {
                            catchWeight: Math.max(0.1, Number(e.target.value) || 1)
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-black text-teal-300"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block">🪙 Золото:</span>
                      <input
                        type="number"
                        min={0}
                        value={fish.baseGold}
                        onChange={(e) =>
                          handleUpdateFish(fish.id, {
                            baseGold: Math.max(0, Number(e.target.value) || 0)
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-black text-amber-300"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block">💎 Кристаллы:</span>
                      <input
                        type="number"
                        min={0}
                        value={fish.baseCrystals}
                        onChange={(e) =>
                          handleUpdateFish(fish.id, {
                            baseCrystals: Math.max(0, Number(e.target.value) || 0)
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-black text-cyan-300"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block">Мин. вес (кг):</span>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={fish.minWeightKg}
                        onChange={(e) =>
                          handleUpdateFish(fish.id, {
                            minWeightKg: Math.max(0.1, Number(e.target.value) || 0.2)
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-bold text-slate-200"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block">Макс. вес (кг):</span>
                      <input
                        type="number"
                        min={0.2}
                        step={0.5}
                        value={fish.maxWeightKg}
                        onChange={(e) =>
                          handleUpdateFish(fish.id, {
                            maxWeightKg: Math.max(0.2, Number(e.target.value) || 1)
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-bold text-slate-200"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
