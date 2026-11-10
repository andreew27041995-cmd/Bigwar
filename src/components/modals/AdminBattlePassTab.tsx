import React, { useState } from 'react';
import { HeroState, GameFeatureFlags } from '../../types/game';
import {
  BattlePassGlobalConfig,
  BattlePassLevelConfig,
  BattlePassQuestActionType,
  BattlePassChestType,
  SeasonTitleId,
  DEFAULT_BATTLE_PASS_CONFIG,
  DEFAULT_BATTLE_PASS_XP_TO_NEXT,
  DEFAULT_BP_DAILY_QUESTS,
  DEFAULT_BP_WEEKLY_QUESTS,
  getBattlePassConfig,
  saveBattlePassConfigLocal,
  normalizePlayerBattlePassState,
  addBattlePassXp
} from '../../utils/battlePassConfig';
import { updatePlayerInDatabase, findPlayerInSupabase } from '../../utils/supabase';

interface AdminBattlePassTabProps {
  hero: HeroState;
  setHero: React.Dispatch<React.SetStateAction<HeroState>>;
  featureFlags: GameFeatureFlags;
  dbPlayers?: any[];
  onSaveBattlePassConfig: (nextCfg: BattlePassGlobalConfig) => Promise<void> | void;
  showToast: (msg: string) => void;
}

const ACTION_TYPE_LABELS: Record<BattlePassQuestActionType, string> = {
  pyramid_step: '🏛️ Шаги в Пирамиде',
  catch_fish: '🎣 Поимка рыбы в Рыбалке',
  gambling_play: '🎡 Игра в Рулетку / Азартные игры',
  port_trip: '⚓ Поход в Порт',
  clan_activity: '🏰 Клановая активность'
};

export const AdminBattlePassTab: React.FC<AdminBattlePassTabProps> = ({
  hero,
  setHero,
  featureFlags,
  dbPlayers = [],
  onSaveBattlePassConfig,
  showToast
}) => {
  const [cfg, setCfg] = useState<BattlePassGlobalConfig>(() =>
    getBattlePassConfig((featureFlags as any)?.battlePassConfig)
  );
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [subTab, setSubTab] = useState<'general' | 'xpTable' | 'levels' | 'quests'>('general');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Player Season Progress Editor State
  const [targetNick, setTargetNick] = useState<string>(hero.nick || '');
  const [customSetLevel, setCustomSetLevel] = useState<number>(1);
  const [customAddXp, setCustomAddXp] = useState<number>(250);
  const [customDaysInput, setCustomDaysInput] = useState<string>('30');
  const [isUpdatingPlayer, setIsUpdatingPlayer] = useState<boolean>(false);

  const activeLevelCfg: BattlePassLevelConfig =
    cfg.levels.find((l) => l.level === selectedLevel) || cfg.levels[0];

  const handleSave = async (overrideCfg?: BattlePassGlobalConfig) => {
    const toSave = overrideCfg || cfg;
    setIsSaving(true);
    try {
      saveBattlePassConfigLocal(toSave);
      await onSaveBattlePassConfig(toSave);
      showToast('✅ Настройки Сезона (Боевого Пропуска) сохранены в игре и БД!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    const fresh: BattlePassGlobalConfig = {
      ...DEFAULT_BATTLE_PASS_CONFIG,
      vipUnlockCostCrystals: 2000,
      seasonEndTimestamp: Date.now() + 30 * 24 * 60 * 60 * 1000
    };
    setCfg(fresh);
    await handleSave(fresh);
    showToast('🔄 Настройки Сезона восстановлены по ТЗ (Цена VIP: 2000 💎, Шкала: 50 ➔ 3880 XP)!');
  };

  const handleStartNewSeasonCycle = async () => {
    const nextSeasonNum = Math.floor(Date.now() / 1000) % 10000;
    const fresh: BattlePassGlobalConfig = {
      ...cfg,
      seasonId: `season_${nextSeasonNum}_${Date.now()}`,
      seasonEndTimestamp: Date.now() + 30 * 24 * 60 * 60 * 1000
    };
    setCfg(fresh);
    await handleSave(fresh);
    showToast('🚀 Запущен новый цикл Сезона! Прогресс уровней обновится для нового сезона.');
  };

  const updateSelectedLevel = (updater: (prev: BattlePassLevelConfig) => BattlePassLevelConfig) => {
    setCfg((prev) => ({
      ...prev,
      levels: prev.levels.map((l) => (l.level === selectedLevel ? updater(l) : l))
    }));
  };

  const handleRestoreDefaultXpTable = () => {
    setCfg((prev) => ({
      ...prev,
      levels: prev.levels.map((l) => ({
        ...l,
        xpRequiredForNext: DEFAULT_BATTLE_PASS_XP_TO_NEXT[l.level] ?? 3880
      }))
    }));
    showToast('📈 Таблица опыта (50 XP на Ур.1 ➔ 3 880 XP на Ур.40) восстановлена по ТЗ!');
  };

  const handleScaleAllXp = (multiplier: number) => {
    setCfg((prev) => ({
      ...prev,
      levels: prev.levels.map((l) => {
        const baseXp = DEFAULT_BATTLE_PASS_XP_TO_NEXT[l.level] ?? 3880;
        return {
          ...l,
          xpRequiredForNext: Math.max(10, Math.round((baseXp * multiplier) / 5) * 5)
        };
      })
    }));
    showToast(`📈 Требования опыта всех 40 уровней масштабированы (x${multiplier})!`);
  };

  // Apply changes to a player's Season progress (Self or DB Player)
  const applyPlayerBattlePassChange = async (
    nickRaw: string,
    mutator: (cur: ReturnType<typeof normalizePlayerBattlePassState>) => ReturnType<typeof normalizePlayerBattlePassState>,
    toastText: string
  ) => {
    const cleanNick = (nickRaw || hero.nick || '').trim();
    if (!cleanNick) return;
    const isSelf = cleanNick.toLowerCase() === (hero.nick || '').trim().toLowerCase();

    setIsUpdatingPlayer(true);
    try {
      if (isSelf) {
        const currentNorm = normalizePlayerBattlePassState(hero.battlePass, Date.now(), cfg);
        const updatedBp = mutator(currentNorm);
        setHero((prev) => ({
          ...prev,
          battlePass: updatedBp
        }));
        if (hero.nick) {
          await updatePlayerInDatabase(hero.nick, {
            battle_pass: updatedBp,
            battlePass: updatedBp
          });
        }
        showToast(toastText);
        return;
      }

      // Remote player in Supabase
      const rawRow = await findPlayerInSupabase(cleanNick);
      const existingBp = rawRow?.battle_pass || rawRow?.battlePass || null;
      const currentNorm = normalizePlayerBattlePassState(existingBp, Date.now(), cfg);
      const updatedBp = mutator(currentNorm);

      await updatePlayerInDatabase(cleanNick, {
        battle_pass: updatedBp,
        battlePass: updatedBp
      });
      showToast(`${toastText} (Игрок: ${cleanNick})`);
    } catch (e) {
      console.warn('Failed to update player battle pass:', e);
      showToast('⚠️ Ошибка при сохранении прогресса сезона игрока');
    } finally {
      setIsUpdatingPlayer(false);
    }
  };

  const daysRemaining = Math.max(
    0,
    Math.ceil((cfg.seasonEndTimestamp - Date.now()) / (24 * 3600 * 1000))
  );

  const totalSeasonCumulativeXp = cfg.levels
    .slice(0, 39)
    .reduce((acc, l) => acc + (Number(l.xpRequiredForNext) || 0), 0);

  return (
    <div className="space-y-3 text-xs text-white">
      {/* Header & Quick Save */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-amber-500/70 bg-gradient-to-r from-amber-950/70 via-slate-900 to-purple-950/60 p-3 shadow-lg">
        <div>
          <h3 className="text-sm sm:text-base font-black text-amber-300 flex items-center gap-1.5">
            <span>🏆 Редактирование Сезона («Боевой Пропуск» 1–40 ур.)</span>
          </h3>
          <p className="text-[10px] text-slate-300 mt-0.5">
            Полная настройка цены Сезона (2 000 💎), прогрессивной шкалы опыта (50 XP ➔ 3 880 XP), наград Free/VIP, заданий и прогресса игроков
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="rounded-lg border border-amber-500/50 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-slate-800 cursor-pointer"
          >
            🔄 Сброс по ТЗ (2000 💎)
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave()}
            className="rounded-lg border border-emerald-300 bg-gradient-to-r from-emerald-500 to-teal-400 px-3.5 py-1.5 text-[10.5px] font-black text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:brightness-110 cursor-pointer"
          >
            {isSaving ? '⏳ Сохранение...' : '💾 Сохранить Сезон'}
          </button>
        </div>
      </div>

      {/* 4 Sub-tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {[
          { id: 'general' as const, label: '⚙️ 1. Настройки & Игроки' },
          { id: 'xpTable' as const, label: '📈 2. Шкала XP (50 ➔ 3880)' },
          { id: 'levels' as const, label: '🎁 3. Награды (1–40 ур.)' },
          { id: 'quests' as const, label: '📜 4. Задания Сезона' }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`rounded-xl py-2 px-2 text-[10.5px] font-black transition-all cursor-pointer ${
              subTab === t.id
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow'
                : 'border border-slate-800 bg-slate-900 text-slate-300 hover:border-amber-500/40 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* =====================================================================
          SUB-TAB 1: GENERAL SEASON SETTINGS & PLAYER SEASON PROGRESS EDITOR
      ===================================================================== */}
      {subTab === 'general' && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/85 p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-amber-300 mb-1">
                Название Сезона:
              </label>
              <input
                type="text"
                value={cfg.seasonTitle}
                onChange={(e) => setCfg({ ...cfg, seasonTitle: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-amber-300 font-bold outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-cyan-300 mb-1">
                💎 Стоимость покупки Сезона (VIP) в кристаллах:
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  value={cfg.vipUnlockCostCrystals}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      vipUnlockCostCrystals: Math.max(1, Number(e.target.value) || 2000)
                    })
                  }
                  className="w-full rounded-lg border border-cyan-500/60 bg-slate-950 px-2.5 py-1.5 text-xs text-cyan-300 font-black outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => setCfg({ ...cfg, vipUnlockCostCrystals: 2000 })}
                  className="shrink-0 rounded-lg border border-cyan-400 bg-cyan-950 px-2.5 py-1.5 text-[10px] font-black text-cyan-200 hover:bg-cyan-900 cursor-pointer"
                  title="Установить 2000 кристаллов по ТЗ"
                >
                  2000 💎
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {[500, 1000, 2000, 3000, 5000].map((pricePreset) => (
                  <button
                    key={pricePreset}
                    type="button"
                    onClick={() => setCfg({ ...cfg, vipUnlockCostCrystals: pricePreset })}
                    className={`rounded px-1.5 py-0.5 text-[8.5px] font-bold cursor-pointer ${
                      cfg.vipUnlockCostCrystals === pricePreset
                        ? 'bg-cyan-500 text-slate-950 font-black'
                        : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    {pricePreset} 💎
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-purple-300 mb-1">
                ID Сезона (смена сбрасывает сезон у игроков):
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={cfg.seasonId}
                  onChange={(e) => setCfg({ ...cfg, seasonId: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-purple-200 font-mono outline-none"
                />
                <button
                  type="button"
                  onClick={handleStartNewSeasonCycle}
                  className="shrink-0 rounded-lg border border-purple-400/60 bg-purple-950/80 px-2 py-1.5 text-[9.5px] font-black text-purple-200 hover:bg-purple-900 cursor-pointer"
                  title="Начать новый сезон (сбросить уровни БП всем игрокам)"
                >
                  🚀 Новый
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">
              Подзаголовок / Описание Сезона:
            </label>
            <input
              type="text"
              value={cfg.seasonSubtitle}
              onChange={(e) => setCfg({ ...cfg, seasonSubtitle: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
            />
          </div>

          {/* Season Timer Control */}
          <div className="rounded-xl border border-amber-500/30 bg-slate-950 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-black text-amber-300">
                  ⏳ Длительность и таймер окончания Сезона:
                </span>
                <span className="ml-2 rounded bg-amber-500/20 border border-amber-400/50 px-2 py-0.5 text-[10px] font-black text-amber-200">
                  Осталось: {daysRemaining} дн.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[7, 14, 30, 45, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setCfg({
                        ...cfg,
                        seasonEndTimestamp: Date.now() + d * 24 * 60 * 60 * 1000
                      })
                    }
                    className="rounded-lg border border-amber-500/40 bg-amber-950/60 px-2 py-1 text-[9.5px] font-bold text-amber-200 hover:bg-amber-800 cursor-pointer"
                  >
                    {d} дн.
                  </button>
                ))}
                <div className="flex items-center gap-1 ml-1">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={customDaysInput}
                    onChange={(e) => setCustomDaysInput(e.target.value)}
                    className="w-14 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-center text-[10px] font-bold text-amber-300"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const d = Math.max(1, Number(customDaysInput) || 30);
                      setCfg({
                        ...cfg,
                        seasonEndTimestamp: Date.now() + d * 24 * 60 * 60 * 1000
                      });
                      showToast(`⏳ Таймер Сезона установлен на ${d} дн.!`);
                    }}
                    className="rounded bg-amber-500 px-2 py-1 text-[9.5px] font-black text-slate-950 hover:bg-amber-400 cursor-pointer"
                  >
                    Задать дн.
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Player Season Progress Manager (Self or Any Player) */}
          <div className="rounded-xl border-2 border-cyan-500/50 bg-gradient-to-b from-cyan-950/35 to-slate-950 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/30 pb-2">
              <div>
                <div className="text-xs font-black text-cyan-300">
                  👤 Управление Сезоном у Игрока (Выдача уровней, XP и VIP-пропуска)
                </div>
                <div className="text-[9.5px] text-slate-400">
                  Выберите себя или любого игрока из списка, чтобы изменить уровень Сезона (1–40), начислить опыт или выдать Премиум Сезон
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTargetNick(hero.nick || '')}
                className="rounded-lg border border-cyan-400/50 bg-cyan-950/80 px-2.5 py-1 text-[9.5px] font-black text-cyan-200 hover:bg-cyan-900 cursor-pointer"
              >
                🎯 Выбрать себя ({hero.nick})
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[9.5px] font-bold text-slate-300 mb-1">
                  Ник игрока:
                </label>
                <input
                  type="text"
                  value={targetNick}
                  onChange={(e) => setTargetNick(e.target.value)}
                  placeholder="Введите ник игрока..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-amber-300 outline-none focus:border-cyan-400"
                />
              </div>
              {dbPlayers.length > 0 && (
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-300 mb-1">
                    Или выберите из базы ({dbPlayers.length}):
                  </label>
                  <select
                    value={targetNick}
                    onChange={(e) => setTargetNick(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white outline-none focus:border-cyan-400"
                  >
                    <option value={hero.nick || ''}>-- {hero.nick} (Вы) --</option>
                    {dbPlayers.map((p) => {
                      const n = p.name || p.nick || '';
                      if (!n) return null;
                      return (
                        <option key={n} value={n}>
                          {n} (Ур. героя {p.lvl || 1})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {/* Set Exact Level 1..40 */}
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 p-2">
                <span className="text-[10px] font-bold text-amber-300 shrink-0">
                  Установить Ур. (1–40):
                </span>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={customSetLevel}
                  onChange={(e) =>
                    setCustomSetLevel(Math.max(1, Math.min(40, Number(e.target.value) || 1)))
                  }
                  className="w-16 rounded border border-amber-500/50 bg-slate-950 px-2 py-1 text-center text-xs font-black text-amber-300"
                />
                <button
                  type="button"
                  disabled={isUpdatingPlayer}
                  onClick={() =>
                    applyPlayerBattlePassChange(
                      targetNick,
                      (cur) => ({
                        ...cur,
                        level: customSetLevel,
                        currentXp: 0
                      }),
                      `🏆 Установлен ${customSetLevel} уровень Сезона`
                    )
                  }
                  className="flex-1 rounded-lg bg-amber-500 py-1.5 px-2 text-[10px] font-black text-slate-950 hover:bg-amber-400 cursor-pointer"
                >
                  ✅ Задать Ур. {customSetLevel}
                </button>
              </div>

              {/* Add Season XP */}
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 p-2">
                <span className="text-[10px] font-bold text-cyan-300 shrink-0">
                  Начислить XP:
                </span>
                <input
                  type="number"
                  min={10}
                  value={customAddXp}
                  onChange={(e) => setCustomAddXp(Math.max(10, Number(e.target.value) || 100))}
                  className="w-20 rounded border border-cyan-500/50 bg-slate-950 px-2 py-1 text-center text-xs font-black text-cyan-300"
                />
                <button
                  type="button"
                  disabled={isUpdatingPlayer}
                  onClick={() =>
                    applyPlayerBattlePassChange(
                      targetNick,
                      (cur) => addBattlePassXp(cur, customAddXp, Date.now(), cfg).nextState,
                      `⚡ Начислено +${customAddXp} XP Сезона`
                    )
                  }
                  className="flex-1 rounded-lg bg-cyan-500 py-1.5 px-2 text-[10px] font-black text-slate-950 hover:bg-cyan-400 cursor-pointer"
                >
                  ➕ +{customAddXp} XP
                </button>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                disabled={isUpdatingPlayer}
                onClick={() =>
                  applyPlayerBattlePassChange(
                    targetNick,
                    (cur) => ({
                      ...cur,
                      isVipUnlocked: true,
                      vipUnlockedAt: Date.now()
                    }),
                    '👑 Выдан Премиум Пропуск (VIP Сезон)'
                  )
                }
                className="rounded-lg border border-yellow-400 bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-1.5 text-[10px] font-black text-slate-950 shadow hover:brightness-110 cursor-pointer"
              >
                👑 Выдать VIP Сезон бесплатно
              </button>

              <button
                type="button"
                disabled={isUpdatingPlayer}
                onClick={() =>
                  applyPlayerBattlePassChange(
                    targetNick,
                    (cur) => ({
                      ...cur,
                      isVipUnlocked: false
                    }),
                    '🔒 Снят VIP статус Сезона'
                  )
                }
                className="rounded-lg border border-rose-500/60 bg-rose-950/70 px-2.5 py-1.5 text-[10px] font-bold text-rose-200 hover:bg-rose-900 cursor-pointer"
              >
                🔒 Забрать VIP Сезон
              </button>

              <button
                type="button"
                disabled={isUpdatingPlayer}
                onClick={() =>
                  applyPlayerBattlePassChange(
                    targetNick,
                    (cur) => ({
                      ...cur,
                      level: 40,
                      currentXp: 0,
                      isVipUnlocked: true,
                      vipUnlockedAt: Date.now()
                    }),
                    '🌟 Выдан 40 уровень Сезона + VIP Пропуск!'
                  )
                }
                className="rounded-lg border border-emerald-400 bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-emerald-500 cursor-pointer"
              >
                🌟 Выдать 40 ур. + VIP
              </button>

              <button
                type="button"
                disabled={isUpdatingPlayer}
                onClick={() =>
                  applyPlayerBattlePassChange(
                    targetNick,
                    (cur) => ({
                      ...cur,
                      level: 1,
                      currentXp: 0,
                      totalXpEarned: 0,
                      claimedFreeLevels: [],
                      claimedVipLevels: []
                    }),
                    '🔄 Прогресс и собранные награды Сезона сброшены к Ур. 1'
                  )
                }
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                🔄 Сбросить сезон игрока (Ур. 1)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: PROGRESSIVE XP TABLE (50 XP AT LVL 1 -> 3 880 XP AT LVL 40)
      ===================================================================== */}
      {subTab === 'xpTable' && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/85 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div>
              <div className="text-xs font-black text-cyan-300">
                📈 Прогрессивная таблица опыта Сезона (Уровни 1–40: от 50 XP до 3 880 XP)
              </div>
              <div className="text-[10px] text-slate-400">
                Суммарно для прохождения всех 40 уровней: <strong className="text-amber-300">{totalSeasonCumulativeXp.toLocaleString('ru-RU')} XP</strong>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleRestoreDefaultXpTable}
                className="rounded-lg border border-cyan-400 bg-cyan-950 px-2.5 py-1 text-[10px] font-black text-cyan-200 hover:bg-cyan-900 cursor-pointer"
              >
                ⚡ Восстановить по ТЗ (50 ➔ 3 880 XP)
              </button>
              <button
                type="button"
                onClick={() => handleScaleAllXp(0.5)}
                className="rounded-lg border border-emerald-500/50 bg-emerald-950/70 px-2 py-1 text-[9.5px] font-bold text-emerald-300 hover:bg-emerald-900 cursor-pointer"
              >
                x0.5 (Ускорить в 2 раза)
              </button>
              <button
                type="button"
                onClick={() => handleScaleAllXp(1.5)}
                className="rounded-lg border border-amber-500/50 bg-amber-950/70 px-2 py-1 text-[9.5px] font-bold text-amber-300 hover:bg-amber-900 cursor-pointer"
              >
                x1.5 (Усложнить)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[420px] overflow-y-auto pr-1">
            {cfg.levels.map((lvlItem) => (
              <div
                key={lvlItem.level}
                className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950 p-2"
              >
                <div className="flex items-center justify-between text-[10px] font-black mb-1">
                  <span className="text-amber-300">Уровень {lvlItem.level}</span>
                  <span className="text-[8.5px] text-slate-500">
                    ТЗ: {DEFAULT_BATTLE_PASS_XP_TO_NEXT[lvlItem.level]} XP
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={10}
                    value={lvlItem.xpRequiredForNext}
                    onChange={(e) => {
                      const val = Math.max(10, Number(e.target.value) || 50);
                      setCfg((prev) => ({
                        ...prev,
                        levels: prev.levels.map((l) =>
                          l.level === lvlItem.level ? { ...l, xpRequiredForNext: val } : l
                        )
                      }));
                    }}
                    className="w-full rounded border border-cyan-500/40 bg-slate-900 px-2 py-1 text-right font-mono text-xs font-black text-cyan-300 outline-none focus:border-cyan-400"
                  />
                  <span className="text-[9px] font-bold text-slate-400">XP</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 3: LEVELS 1..40 FREE & VIP REWARDS EDITOR
      ===================================================================== */}
      {subTab === 'levels' && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/85 p-3">
          {/* Level Selector 1..40 */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 mb-1.5">
              Выберите уровень Сезона для редактирования наград (1–40):
            </div>
            <div className="grid grid-cols-10 gap-1">
              {cfg.levels.map((l) => (
                <button
                  key={l.level}
                  type="button"
                  onClick={() => setSelectedLevel(l.level)}
                  className={`rounded py-1 text-[9.5px] font-black transition-all cursor-pointer ${
                    selectedLevel === l.level
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : [1, 5, 10, 15, 20, 30, 40].includes(l.level)
                      ? 'border border-amber-500/50 bg-amber-950/50 text-amber-200'
                      : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  {l.level}
                </button>
              ))}
            </div>
          </div>

          {activeLevelCfg && (
            <div className="space-y-2.5 border-t border-slate-800 pt-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-amber-300">
                  🎁 Редактирование Уровня {activeLevelCfg.level} из 40
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">
                    Порог опыта (XP) этого уровня:
                  </span>
                  <input
                    type="number"
                    min={10}
                    value={activeLevelCfg.xpRequiredForNext}
                    onChange={(e) =>
                      updateSelectedLevel((prev) => ({
                        ...prev,
                        xpRequiredForNext: Math.max(10, Number(e.target.value) || 50)
                      }))
                    }
                    className="w-24 rounded border border-cyan-500/50 bg-slate-950 px-2 py-0.5 text-[10.5px] font-black text-cyan-300 text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* FREE REWARD EDITOR */}
                <div className="rounded-xl border border-sky-500/40 bg-slate-950/90 p-2.5 space-y-2">
                  <div className="text-[10.5px] font-black text-sky-300">
                    🛡️ Бесплатная награда (Free — Ур. {activeLevelCfg.level})
                  </div>

                  <div className="grid grid-cols-[56px_1fr] gap-1.5">
                    <input
                      type="text"
                      value={activeLevelCfg.freeReward.icon || '🎁'}
                      onChange={(e) =>
                        updateSelectedLevel((prev) => ({
                          ...prev,
                          freeReward: { ...prev.freeReward, icon: e.target.value }
                        }))
                      }
                      placeholder="Иконка"
                      className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-center text-sm"
                    />
                    <input
                      type="text"
                      value={activeLevelCfg.freeReward.title}
                      onChange={(e) =>
                        updateSelectedLevel((prev) => ({
                          ...prev,
                          freeReward: { ...prev.freeReward, title: e.target.value }
                        }))
                      }
                      placeholder="Название награды"
                      className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] text-white font-bold"
                    />
                  </div>

                  <input
                    type="text"
                    value={activeLevelCfg.freeReward.description}
                    onChange={(e) =>
                      updateSelectedLevel((prev) => ({
                        ...prev,
                        freeReward: { ...prev.freeReward, description: e.target.value }
                      }))
                    }
                    placeholder="Описание награды"
                    className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[9.5px] text-slate-300"
                  />

                  <div className="grid grid-cols-4 gap-1.5">
                    <div>
                      <span className="block text-[8px] text-slate-400">Золото 🪙</span>
                      <input
                        type="number"
                        min={0}
                        value={activeLevelCfg.freeReward.gold || 0}
                        onChange={(e) =>
                          updateSelectedLevel((prev) => ({
                            ...prev,
                            freeReward: { ...prev.freeReward, gold: Math.max(0, Number(e.target.value) || 0) }
                          }))
                        }
                        className="w-full rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-amber-300"
                      />
                    </div>
                    <div>
                      <span className="block text-[8px] text-slate-400">Кристаллы 💎</span>
                      <input
                        type="number"
                        min={0}
                        value={activeLevelCfg.freeReward.crystals || 0}
                        onChange={(e) =>
                          updateSelectedLevel((prev) => ({
                            ...prev,
                            freeReward: {
                              ...prev.freeReward,
                              crystals: Math.max(0, Number(e.target.value) || 0)
                            }
                          }))
                        }
                        className="w-full rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-cyan-300"
                      />
                    </div>
                    <div>
                      <span className="block text-[8px] text-slate-400">Энергия ⚡</span>
                      <input
                        type="number"
                        min={0}
                        value={activeLevelCfg.freeReward.energy || 0}
                        onChange={(e) =>
                          updateSelectedLevel((prev) => ({
                            ...prev,
                            freeReward: {
                              ...prev.freeReward,
                              energy: Math.max(0, Number(e.target.value) || 0)
                            }
                          }))
                        }
                        className="w-full rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-emerald-300"
                      />
                    </div>
                    <div>
                      <span className="block text-[8px] text-slate-400">Реликвии 🏺</span>
                      <input
                        type="number"
                        min={0}
                        value={activeLevelCfg.freeReward.relicsCount || 0}
                        onChange={(e) =>
                          updateSelectedLevel((prev) => ({
                            ...prev,
                            freeReward: {
                              ...prev.freeReward,
                              relicsCount: Math.max(0, Number(e.target.value) || 0)
                            }
                          }))
                        }
                        className="w-full rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-purple-300"
                      />
                    </div>
                  </div>

                  {/* Chests & Special Free Rewards */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="block text-[8px] text-slate-400">Сундук:</span>
                      <select
                        value={activeLevelCfg.freeReward.chestType || ''}
                        onChange={(e) =>
                          updateSelectedLevel((prev) => ({
                            ...prev,
                            freeReward: {
                              ...prev.freeReward,
                              chestType: (e.target.value || undefined) as BattlePassChestType | undefined,
                              chestCount: e.target.value ? Math.max(1, prev.freeReward.chestCount || 1) : 0
                            }
                          }))
                        }
                        className="w-full rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[9.5px] text-white"
                      >
                        <option value="">Нет сундука</option>
                        <option value="basic">📦 Базовый сундук</option>
                        <option value="silver">🥈 Серебряный сундук</option>
                        <option value="gold">🥇 Золотой сундук</option>
                        <option value="elite">👑 Элитный сундук</option>
                      </select>
                    </div>
                    <div>
                      <span className="block text-[8px] text-slate-400">Кол-во сундуков:</span>
                      <input
                        type="number"
                        min={0}
                        value={activeLevelCfg.freeReward.chestCount || 0}
                        onChange={(e) =>
                          updateSelectedLevel((prev) => ({
                            ...prev,
                            freeReward: {
                              ...prev.freeReward,
                              chestCount: Math.max(0, Number(e.target.value) || 0)
                            }
                          }))
                        }
                        className="w-full rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* VIP REWARD EDITOR */}
                <div className="rounded-xl border border-amber-500/50 bg-slate-950/90 p-2.5 space-y-2">
                  <div className="text-[10.5px] font-black text-yellow-300">
                    👑 Премиум награда (VIP — Ур. {activeLevelCfg.level})
                  </div>

                  <div className="grid grid-cols-[56px_1fr] gap-1.5">
                    <input
                      type="text"
                      value={activeLevelCfg.vipReward.icon || '👑'}
                      onChange={(e) =>
                        updateSelectedLevel((prev) => ({
                          ...prev,
                          vipReward: { ...prev.vipReward, icon: e.target.value }
                        }))
                      }
                      placeholder="Иконка"
                      className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-center text-sm"
                    />
                    <input
                      type="text"
                      value={activeLevelCfg.vipReward.title}
                      onChange={(e) =>
                        updateSelectedLevel((prev) => ({
                          ...prev,
                          vipReward: { ...prev.vipReward, title: e.target.value }
                        }))
                      }
                      placeholder="Название награды"
                      className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] text-yellow-200 font-bold"
                    />
                  </div>

                  <input
                    type="text"
                    value={activeLevelCfg.vipReward.description}
                    onChange={(e) =>
                      updateSelectedLevel((prev) => ({
                        ...prev,
                        vipReward: { ...prev.vipReward, description: e.target.value }
                      }))
                    }
                    placeholder="Описание награды"
                    className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[9.5px] text-slate-300"
                  />

                  <div className="grid grid-cols-4 gap-1.5">
                    <div>
                      <span className="block text-[8px] text-slate-400">Золото 🪙</span>
                      <input
                        type="number"
                        min={0}
                        value={activeLevelCfg.vipReward.gold || 0}
                        onChange={(e) =>
                          updateSelectedLevel((prev) => ({
                            ...prev,
                            vipReward: { ...prev.vipReward, gold: Math.max(0, Number(e.target.value) || 0) }
                          }))
                        }
                        className="w-full rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-amber-300"
                      />
                    </div>
                    <div>
                      <span className="block text-[8px] text-slate-400">Кристаллы 💎</span>
                      <input
                        type="number"
                        min={0}
                        value={activeLevelCfg.vipReward.crystals || 0}
                        onChange={(e) =>
                          updateSelectedLevel((prev) => ({
                            ...prev,
                            vipReward: {
                              ...prev.vipReward,
                              crystals: Math.max(0, Number(e.target.value) || 0)
                            }
                          }))
                        }
                        className="w-full rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-cyan-300"
                      />
                    </div>
                    <div>
                      <span className="block text-[8px] text-slate-400">VIP Дни 👑</span>
                      <input
                        type="number"
                        min={0}
                        value={activeLevelCfg.vipReward.vipDays || 0}
                        onChange={(e) =>
                          updateSelectedLevel((prev) => ({
                            ...prev,
                            vipReward: {
                              ...prev.vipReward,
                              vipDays: Math.max(0, Number(e.target.value) || 0)
                            }
                          }))
                        }
                        className="w-full rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-yellow-300"
                      />
                    </div>
                    <div>
                      <span className="block text-[8px] text-slate-400">Реликвии 🏺</span>
                      <input
                        type="number"
                        min={0}
                        value={activeLevelCfg.vipReward.relicsCount || 0}
                        onChange={(e) =>
                          updateSelectedLevel((prev) => ({
                            ...prev,
                            vipReward: {
                              ...prev.vipReward,
                              relicsCount: Math.max(0, Number(e.target.value) || 0)
                            }
                          }))
                        }
                        className="w-full rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-purple-300"
                      />
                    </div>
                  </div>

                  {/* Exclusive Transport / Title / Chest for VIP */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="block text-[8px] text-slate-400">Транспорт Сезона:</span>
                      <select
                        value={activeLevelCfg.vipReward.transportId || ''}
                        onChange={(e) => {
                          const val = (e.target.value || undefined) as
                            | 'scarab_boat'
                            | 'apache_season'
                            | undefined;
                          updateSelectedLevel((prev) => ({
                            ...prev,
                            vipReward: {
                              ...prev.vipReward,
                              transportId: val,
                              transportName:
                                val === 'scarab_boat'
                                  ? 'Легкий катер «Скарабей»'
                                  : val === 'apache_season'
                                  ? 'Вертолет «Апач Сезона»'
                                  : undefined,
                              transportDurability:
                                val === 'scarab_boat' ? 500 : val === 'apache_season' ? 1000 : undefined
                            }
                          }));
                        }}
                        className="w-full rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[9.5px] text-amber-200"
                      >
                        <option value="">Нет транспорта</option>
                        <option value="scarab_boat">🚤 Катер «Скарабей» (500 прочн.)</option>
                        <option value="apache_season">🚁 Вертолет «Апач Сезона» (1000 прочн.)</option>
                      </select>
                    </div>

                    <div>
                      <span className="block text-[8px] text-slate-400">Сезонный Титул:</span>
                      <select
                        value={activeLevelCfg.vipReward.seasonTitleId || ''}
                        onChange={(e) => {
                          const val = (e.target.value || undefined) as SeasonTitleId | undefined;
                          updateSelectedLevel((prev) => ({
                            ...prev,
                            vipReward: {
                              ...prev.vipReward,
                              seasonTitleId: val,
                              seasonTitleName:
                                val === 'season_pharaoh'
                                  ? 'Фараон Сезона'
                                  : val === 'sand_explorer'
                                  ? 'Исследователь Песков'
                                  : undefined,
                              seasonTitleDays: val ? 14 : undefined,
                              seasonTitleStatBonusPct:
                                val === 'season_pharaoh' ? 25 : val === 'sand_explorer' ? 15 : undefined
                            }
                          }));
                        }}
                        className="w-full rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[9.5px] text-yellow-300"
                      >
                        <option value="">Нет титула</option>
                        <option value="season_pharaoh">👑 Фараон Сезона (+25% статы)</option>
                        <option value="sand_explorer">🏜️ Исследователь Песков (+15% статы)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 4: DAILY & WEEKLY SEASON QUESTS EDITOR
      ===================================================================== */}
      {subTab === 'quests' && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/85 p-3">
          {/* Daily Quests */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10.5px] font-black text-amber-300">
              ☀️ Ежедневные задания Сезона ({cfg.dailyQuests.length}):
            </div>
            <button
              type="button"
              onClick={() => {
                setCfg({
                  ...cfg,
                  dailyQuests: [
                    ...cfg.dailyQuests,
                    {
                      id: `bp_daily_custom_${Date.now()}`,
                      category: 'daily',
                      title: 'Новое задание дня',
                      description: 'Сделать 15 шагов в Пирамиде',
                      icon: '⚡',
                      actionType: 'pyramid_step',
                      target: 15,
                      xpReward: 75
                    }
                  ]
                });
              }}
              className="rounded-lg border border-amber-400/60 bg-amber-950/70 px-2.5 py-1 text-[9.5px] font-black text-amber-200 hover:bg-amber-900 cursor-pointer"
            >
              ➕ Добавить дневное задание
            </button>
          </div>

          <div className="space-y-1.5">
            {cfg.dailyQuests.map((q, idx) => (
              <div
                key={q.id}
                className="grid grid-cols-1 sm:grid-cols-[44px_1fr_150px_75px_75px_32px] gap-1.5 items-center rounded-lg border border-slate-800 bg-slate-950 p-2"
              >
                <input
                  type="text"
                  value={q.icon}
                  onChange={(e) => {
                    const next = [...cfg.dailyQuests];
                    next[idx] = { ...q, icon: e.target.value };
                    setCfg({ ...cfg, dailyQuests: next });
                  }}
                  className="rounded border border-slate-800 bg-slate-900 px-1 py-1 text-center text-sm"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  <input
                    type="text"
                    value={q.title}
                    onChange={(e) => {
                      const next = [...cfg.dailyQuests];
                      next[idx] = { ...q, title: e.target.value };
                      setCfg({ ...cfg, dailyQuests: next });
                    }}
                    placeholder="Название"
                    className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-bold text-white"
                  />
                  <input
                    type="text"
                    value={q.description}
                    onChange={(e) => {
                      const next = [...cfg.dailyQuests];
                      next[idx] = { ...q, description: e.target.value };
                      setCfg({ ...cfg, dailyQuests: next });
                    }}
                    placeholder="Описание"
                    className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[9.5px] text-slate-300"
                  />
                </div>
                <select
                  value={q.actionType}
                  onChange={(e) => {
                    const next = [...cfg.dailyQuests];
                    next[idx] = { ...q, actionType: e.target.value as BattlePassQuestActionType };
                    setCfg({ ...cfg, dailyQuests: next });
                  }}
                  className="rounded border border-slate-800 bg-slate-900 px-1.5 py-1 text-[9.5px] text-amber-200"
                >
                  {Object.entries(ACTION_TYPE_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
                <div>
                  <span className="block text-[7.5px] text-slate-400">Цель:</span>
                  <input
                    type="number"
                    min={1}
                    value={q.target}
                    onChange={(e) => {
                      const next = [...cfg.dailyQuests];
                      next[idx] = { ...q, target: Math.max(1, Number(e.target.value) || 1) };
                      setCfg({ ...cfg, dailyQuests: next });
                    }}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-amber-300"
                  />
                </div>
                <div>
                  <span className="block text-[7.5px] text-slate-400">Награда XP:</span>
                  <input
                    type="number"
                    min={5}
                    value={q.xpReward}
                    onChange={(e) => {
                      const next = [...cfg.dailyQuests];
                      next[idx] = { ...q, xpReward: Math.max(5, Number(e.target.value) || 50) };
                      setCfg({ ...cfg, dailyQuests: next });
                    }}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-cyan-300"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (cfg.dailyQuests.length <= 1) return;
                    setCfg({
                      ...cfg,
                      dailyQuests: cfg.dailyQuests.filter((_, i) => i !== idx)
                    });
                  }}
                  className="rounded border border-red-500/40 bg-red-950/60 py-1 text-[10px] text-red-300 hover:bg-red-900 cursor-pointer"
                  title="Удалить задание"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Weekly Quests */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <div className="text-[10.5px] font-black text-purple-300">
              🗓️ Еженедельные задания Сезона ({cfg.weeklyQuests.length}):
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setCfg({
                    ...cfg,
                    dailyQuests: DEFAULT_BP_DAILY_QUESTS,
                    weeklyQuests: DEFAULT_BP_WEEKLY_QUESTS
                  })
                }
                className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[9px] font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                🔄 Сбросить задания по ТЗ
              </button>
              <button
                type="button"
                onClick={() => {
                  setCfg({
                    ...cfg,
                    weeklyQuests: [
                      ...cfg.weeklyQuests,
                      {
                        id: `bp_weekly_custom_${Date.now()}`,
                        category: 'weekly',
                        title: 'Новое недельное испытание',
                        description: 'Сделать 50 шагов в Пирамиде',
                        icon: '🏆',
                        actionType: 'pyramid_step',
                        target: 50,
                        xpReward: 400
                      }
                    ]
                  });
                }}
                className="rounded-lg border border-purple-400/60 bg-purple-950/70 px-2.5 py-1 text-[9.5px] font-black text-purple-200 hover:bg-purple-900 cursor-pointer"
              >
                ➕ Добавить недельное задание
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {cfg.weeklyQuests.map((q, idx) => (
              <div
                key={q.id}
                className="grid grid-cols-1 sm:grid-cols-[44px_1fr_150px_75px_75px_32px] gap-1.5 items-center rounded-lg border border-slate-800 bg-slate-950 p-2"
              >
                <input
                  type="text"
                  value={q.icon}
                  onChange={(e) => {
                    const next = [...cfg.weeklyQuests];
                    next[idx] = { ...q, icon: e.target.value };
                    setCfg({ ...cfg, weeklyQuests: next });
                  }}
                  className="rounded border border-slate-800 bg-slate-900 px-1 py-1 text-center text-sm"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  <input
                    type="text"
                    value={q.title}
                    onChange={(e) => {
                      const next = [...cfg.weeklyQuests];
                      next[idx] = { ...q, title: e.target.value };
                      setCfg({ ...cfg, weeklyQuests: next });
                    }}
                    placeholder="Название"
                    className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-bold text-white"
                  />
                  <input
                    type="text"
                    value={q.description}
                    onChange={(e) => {
                      const next = [...cfg.weeklyQuests];
                      next[idx] = { ...q, description: e.target.value };
                      setCfg({ ...cfg, weeklyQuests: next });
                    }}
                    placeholder="Описание"
                    className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[9.5px] text-slate-300"
                  />
                </div>
                <select
                  value={q.actionType}
                  onChange={(e) => {
                    const next = [...cfg.weeklyQuests];
                    next[idx] = { ...q, actionType: e.target.value as BattlePassQuestActionType };
                    setCfg({ ...cfg, weeklyQuests: next });
                  }}
                  className="rounded border border-slate-800 bg-slate-900 px-1.5 py-1 text-[9.5px] text-purple-200"
                >
                  {Object.entries(ACTION_TYPE_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
                <div>
                  <span className="block text-[7.5px] text-slate-400">Цель:</span>
                  <input
                    type="number"
                    min={1}
                    value={q.target}
                    onChange={(e) => {
                      const next = [...cfg.weeklyQuests];
                      next[idx] = { ...q, target: Math.max(1, Number(e.target.value) || 1) };
                      setCfg({ ...cfg, weeklyQuests: next });
                    }}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-amber-300"
                  />
                </div>
                <div>
                  <span className="block text-[7.5px] text-slate-400">Награда XP:</span>
                  <input
                    type="number"
                    min={10}
                    value={q.xpReward}
                    onChange={(e) => {
                      const next = [...cfg.weeklyQuests];
                      next[idx] = { ...q, xpReward: Math.max(10, Number(e.target.value) || 400) };
                      setCfg({ ...cfg, weeklyQuests: next });
                    }}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-purple-300"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (cfg.weeklyQuests.length <= 1) return;
                    setCfg({
                      ...cfg,
                      weeklyQuests: cfg.weeklyQuests.filter((_, i) => i !== idx)
                    });
                  }}
                  className="rounded border border-red-500/40 bg-red-950/60 py-1 text-[10px] text-red-300 hover:bg-red-900 cursor-pointer"
                  title="Удалить задание"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
