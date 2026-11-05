import React, { useState, useEffect, useMemo } from 'react';
import { HeroState } from '../../types/game';
import {
  RealtimePlayer,
  adminModifyPlayerBalanceInSupabase,
  findPlayerInSupabase,
  unpackPlayerRow,
  sendMailInSupabase,
} from '../../utils/supabase';
import {
  AiAdviceCategory,
  AiAdvisorConfig,
  AiPlayerAdviceEntry,
  AiStrategyMode,
  AI_CATEGORY_META,
  AI_STRATEGY_LABELS,
  analyzePlayerAndGenerateAdvices,
  computeAiMonitoringMetrics,
  fetchAiMonitoringFromSupabase,
  generateSmartPlayerAdviceWithServer,
  loadAiMonitoringState,
  recordPlayerAdviceEntry,
  saveAiMonitoringState,
  syncAiMonitoringToSupabase,
  updateAiAdvisorConfig,
  updatePlayerAdviceStatus,
} from '../../utils/aiMonitoring';

interface AdminAiMonitoringTabProps {
  hero: HeroState;
  dbPlayers: any[];
  refreshDbPlayersList: () => Promise<void>;
  showToast: (text: string) => void;
  onBroadcastSystemMessage?: (text: string) => void;
  syncLocalSelfIfMatched: (modifiedNick: string, updated?: RealtimePlayer, raw?: any) => void;
  onSwitchToAiChat?: () => void;
}

export const AdminAiMonitoringTab: React.FC<AdminAiMonitoringTabProps> = ({
  hero,
  dbPlayers,
  refreshDbPlayersList,
  showToast,
  onBroadcastSystemMessage,
  syncLocalSelfIfMatched,
  onSwitchToAiChat,
}) => {
  const [monitoringState, setMonitoringState] = useState(() => loadAiMonitoringState());
  const [selectedNick, setSelectedNick] = useState<string>(
    dbPlayers[0]?.nick || hero.nick || 'RedBlack'
  );
  const [categoryFilter, setCategoryFilter] = useState<AiAdviceCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'applied' | 'accepted' | 'pending' | 'dismissed'
  >('all');
  const [searchPlayerQuery, setSearchPlayerQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplyingActionId, setIsApplyingActionId] = useState<string | null>(null);
  const [lastDiagnosticResults, setLastDiagnosticResults] = useState<AiPlayerAdviceEntry[]>([]);

  const reloadLocal = () => {
    setMonitoringState(loadAiMonitoringState());
  };

  useEffect(() => {
    void fetchAiMonitoringFromSupabase().then((updated) => {
      if (updated) reloadLocal();
    });
  }, []);

  const metrics = useMemo(() => computeAiMonitoringMetrics(), [monitoringState]);
  const config = monitoringState.config;

  const handleConfigChange = (patch: Partial<AiAdvisorConfig>) => {
    const updated = updateAiAdvisorConfig(patch);
    setMonitoringState((prev) => ({ ...prev, config: updated }));
    showToast('⚙️ Настройки логики ИИ-Советника обновлены и синхронизированы!');
  };

  const handleGenerateAdviceForPlayer = async (targetNickOverride?: string) => {
    const nickToAnalyze = (targetNickOverride || selectedNick || hero.nick || '').trim();
    if (!nickToAnalyze) {
      showToast('Выберите игрока для ИИ-анализа!');
      return;
    }

    setIsGenerating(true);
    try {
      const rawRow = await findPlayerInSupabase(nickToAnalyze);
      const unpacked = rawRow
        ? unpackPlayerRow(rawRow)
        : dbPlayers.find(
            (p) => String(p.nick || p.name || '').toLowerCase() === nickToAnalyze.toLowerCase()
          ) || {
            nick: nickToAnalyze,
            lvl: hero.lvl,
            hp: hero.hp,
            maxHp: hero.maxHp,
            energy: hero.energy,
            maxEnergy: hero.maxEnergy,
            gold: hero.gold,
            crystals: hero.crystals,
            str: hero.str,
            agi: hero.agi,
            vit: hero.vit,
            statPoints: hero.statPoints,
            hpPotions: hero.hpPotions,
            enPotions: hero.enPotions,
          };

      const playerProfile = {
        nick: nickToAnalyze,
        lvl: Number(unpacked.lvl ?? 1),
        exp: Number(unpacked.exp ?? 0),
        hp: Number(unpacked.hp ?? 100),
        maxHp: Number(unpacked.maxHp ?? unpacked.max_hp ?? 100),
        energy: Number(unpacked.energy ?? 20),
        maxEnergy: Number(unpacked.maxEnergy ?? unpacked.max_energy ?? 20),
        gold: Number(unpacked.gold ?? 0),
        crystals: Number(unpacked.crystals ?? 0),
        str: Number(unpacked.str ?? 5),
        agi: Number(unpacked.agi ?? 5),
        vit: Number(unpacked.vit ?? 5),
        statPoints: Number(unpacked.statPoints ?? unpacked.stat_points ?? 0),
        hpPotions: Number(unpacked.hpPotions ?? unpacked.hp_potions ?? 0),
        enPotions: Number(unpacked.enPotions ?? unpacked.en_potions ?? 0),
        expPotions: Number(unpacked.expPotions ?? unpacked.exp_potions ?? 0),
        equipped: unpacked.equipped || {},
        inventory: Array.isArray(unpacked.inventory) ? unpacked.inventory : [],
        isPremium: Boolean(unpacked.is_premium || unpacked.isPremium),
      };

      // 1. Primary AI Advice (Server Gemini 3.8 Flash + fallback)
      const primaryAdvice = await generateSmartPlayerAdviceWithServer(playerProfile);

      // 2. Additional tactical diagnostics from engine
      const extraCandidates = analyzePlayerAndGenerateAdvices(playerProfile, config)
        .filter((c) => c.category !== primaryAdvice.category)
        .slice(0, 2)
        .map((c) => recordPlayerAdviceEntry(c));

      const allGenerated = [primaryAdvice, ...extraCandidates];
      setLastDiagnosticResults(allGenerated);

      if (config.sendAdviceToMail) {
        await sendMailInSupabase(
          '🧠 ИИ-Советник Луксора',
          nickToAnalyze,
          `📊 Персональный ИИ-совет (${AI_CATEGORY_META[primaryAdvice.category].label}): ${
            primaryAdvice.title
          }. ${primaryAdvice.adviceText} [Ожидаемый эффект: ${primaryAdvice.expectedImpact}]`
        );
      }

      reloadLocal();
      showToast(
        `🧠 Сгенерировано ${allGenerated.length} ИИ-рекомендаций для игрока ${nickToAnalyze}!`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMassAiAuditAllPlayers = async () => {
    const validPlayers = dbPlayers
      .filter((p) => {
        const n = String(p.nick || p.name || '').trim();
        return n && !n.startsWith('__');
      })
      .slice(0, 12);

    if (validPlayers.length === 0) {
      showToast('Список игроков пуст!');
      return;
    }

    setIsGenerating(true);
    try {
      let generatedCount = 0;
      const batchCreated: AiPlayerAdviceEntry[] = [];

      for (const p of validPlayers) {
        const pNick = String(p.nick || p.name || '').trim();
        const candidates = analyzePlayerAndGenerateAdvices(
          {
            nick: pNick,
            lvl: Number(p.lvl ?? 1),
            exp: Number(p.exp ?? 0),
            hp: Number(p.hp ?? 100),
            maxHp: Number(p.maxHp ?? p.max_hp ?? 100),
            energy: Number(p.energy ?? 20),
            maxEnergy: Number(p.maxEnergy ?? p.max_energy ?? 20),
            gold: Number(p.gold ?? 0),
            crystals: Number(p.crystals ?? 0),
            str: Number(p.str ?? 5),
            agi: Number(p.agi ?? 5),
            vit: Number(p.vit ?? 5),
            statPoints: Number(p.statPoints ?? p.stat_points ?? 0),
            hpPotions: Number(p.hpPotions ?? p.hp_potions ?? 0),
            enPotions: Number(p.enPotions ?? p.en_potions ?? 0),
            equipped: p.equipped || {},
            inventory: Array.isArray(p.inventory) ? p.inventory : [],
            isPremium: Boolean(p.is_premium || p.isPremium),
          },
          config
        );

        if (candidates.length > 0) {
          const top = recordPlayerAdviceEntry({
            ...candidates[0],
            sentToPlayer: config.sendAdviceToMail,
          });
          batchCreated.push(top);
          generatedCount += 1;
        }
      }

      setLastDiagnosticResults(batchCreated.slice(0, 5));
      reloadLocal();
      showToast(
        `🚀 Массовый ИИ-аудит завершён: сформировано ${generatedCount} персональных советов для игроков!`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyAdviceActionInDatabase = async (entry: AiPlayerAdviceEntry) => {
    setIsApplyingActionId(entry.id);
    try {
      const targetNick = entry.playerNick;
      const raw = await findPlayerInSupabase(targetNick);
      const unpacked = raw ? unpackPlayerRow(raw) : null;

      let modifyOptions: any = {};
      let actionDescription = '';

      if (entry.recommendedAction === 'repair_gear') {
        modifyOptions = { repairAllItems: true };
        actionDescription = 'Все предметы экипировки и сумки отремонтированы на 100%';
      } else if (entry.recommendedAction === 'distribute_stats') {
        const curPts = Number(unpacked?.statPoints ?? unpacked?.stat_points ?? 4);
        const curStr = Number(unpacked?.str ?? 5);
        const curVit = Number(unpacked?.vit ?? 5);
        const addStr = Math.max(1, Math.ceil(curPts * 0.6));
        const addVit = Math.max(1, curPts - addStr);
        modifyOptions = {
          setStr: curStr + addStr,
          setVit: curVit + addVit,
          setStatPoints: 0,
        };
        actionDescription = `Распределены очки характеристик (+${addStr} Сила, +${addVit} Живучесть)`;
      } else if (entry.recommendedAction === 'use_potion') {
        const curHpPots = Number(unpacked?.hpPotions ?? unpacked?.hp_potions ?? 0);
        const curEnPots = Number(unpacked?.enPotions ?? unpacked?.en_potions ?? 0);
        const maxHp = Number(unpacked?.maxHp ?? unpacked?.max_hp ?? 150);
        const maxEn = Number(unpacked?.maxEnergy ?? unpacked?.max_energy ?? 25);
        modifyOptions = {
          setHp: maxHp,
          setEnergy: maxEn,
          setHpPotions: Math.max(curHpPots, 5),
          setEnPotions: Math.max(curEnPots, 5),
        };
        actionDescription = 'Восстановлено 100% HP/Энергии и пополнен боезапас эликсиров до 5 шт.';
      } else if (entry.recommendedAction === 'upgrade_vip') {
        modifyOptions = {
          setPremium: true,
          setPremiumDays: 7,
        };
        actionDescription = 'Активирован VIP-статус на 7 дней (+50% к золоту и опыту)';
      } else {
        modifyOptions = {
          repairAllItems: true,
          goldDelta: 250,
        };
        actionDescription = 'Выполнена тактическая подготовка снаряжения и выдан бонус +250 🪙';
      }

      const res = await adminModifyPlayerBalanceInSupabase(targetNick, modifyOptions);
      if (res.success) {
        syncLocalSelfIfMatched(targetNick, res.updatedPlayer, res.rawPlayer);
        await refreshDbPlayersList();
      }

      updatePlayerAdviceStatus(entry.id, 'applied', 5);
      await sendMailInSupabase(
        '🧠 ИИ-Советник Луксора',
        targetNick,
        `⚡ ИИ-рекомендация «${entry.title}» автоматически выполнена: ${actionDescription}!`
      );

      reloadLocal();
      showToast(`✅ Совет ИИ для ${targetNick} выполнен: ${actionDescription}!`);
    } finally {
      setIsApplyingActionId(null);
    }
  };

  const handleSendAdviceToPlayerMail = async (entry: AiPlayerAdviceEntry) => {
    await sendMailInSupabase(
      '🧠 ИИ-Советник Луксора',
      entry.playerNick,
      `💡 Персональный совет ИИ (${AI_CATEGORY_META[entry.category].label}): ${
        entry.title
      }\n${entry.adviceText}\n📈 Ожидаемый эффект: ${entry.expectedImpact}`
    );
    if (onBroadcastSystemMessage) {
      onBroadcastSystemMessage(
        `🧠 [ИИ-Советник]: Игрок ${entry.playerNick} получил тактическую рекомендацию «${entry.title}»!`
      );
    }
    updatePlayerAdviceStatus(entry.id, 'accepted', 5);
    reloadLocal();
    showToast(`📩 Совет ИИ отправлен на почту игроку ${entry.playerNick}!`);
  };

  const handleExportMonitoringJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      metrics,
      config,
      adviceLog: monitoringState.adviceLog,
      executionMetrics: monitoringState.executionMetrics,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-monitoring-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Отчёт AI-мониторинга экспортирован в JSON!');
  };

  const filteredAdvices = useMemo(() => {
    return monitoringState.adviceLog.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (
        searchPlayerQuery.trim() &&
        !item.playerNick.toLowerCase().includes(searchPlayerQuery.trim().toLowerCase()) &&
        !item.title.toLowerCase().includes(searchPlayerQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [monitoringState.adviceLog, categoryFilter, statusFilter, searchPlayerQuery]);

  return (
    <div className="space-y-3">
      {/* Top Banner: AI-Мониторинг Header */}
      <div className="rounded-xl border-2 border-indigo-500/60 bg-gradient-to-r from-indigo-950/90 via-slate-900 to-purple-950/90 p-3 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/50 bg-indigo-500/20 text-xl shadow-inner">
              📊
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-wide text-white">
                  AI-Мониторинг и Аналитика ИИ-Советника
                </h3>
                <span className="rounded-md border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 text-[9.5px] font-black text-emerald-300">
                  ● ONLINE • Argon 4 (gemini-4-argon)
                </span>
              </div>
              <p className="text-[10.5px] text-indigo-200/80 mt-0.5">
                Метрики эффективности ИИ-помощника, статистика советов для игроков и настройка тактической логики ИИ
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {onSwitchToAiChat && (
              <button
                type="button"
                onClick={onSwitchToAiChat}
                className="rounded-lg border border-purple-400/50 bg-purple-900/60 hover:bg-purple-800 px-2.5 py-1.5 text-[10.5px] font-black text-purple-100 cursor-pointer"
              >
                🤖 Чат ИИ-Ассистента
              </button>
            )}
            <button
              type="button"
              onClick={handleExportMonitoringJson}
              className="rounded-lg border border-cyan-500/50 bg-cyan-950/70 hover:bg-cyan-900 px-2.5 py-1.5 text-[10.5px] font-black text-cyan-200 cursor-pointer"
            >
              📥 Экспорт JSON
            </button>
          </div>
        </div>

        {/* 4 Key KPI Metric Cards */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg border border-emerald-500/40 bg-slate-950/85 p-2.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Индекс эффективности ИИ</span>
              <span className="text-emerald-400 font-black">⚡ KPI</span>
            </div>
            <div className="mt-1 text-lg font-black text-emerald-400">
              {metrics.efficiencyScore}%
            </div>
            <div className="mt-0.5 text-[9.5px] text-slate-400">
              Уверенность ИИ: <b className="text-emerald-300">{metrics.avgConfidenceScore}%</b>
            </div>
          </div>

          <div className="rounded-lg border border-cyan-500/40 bg-slate-950/85 p-2.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Точность команд БД/IDE</span>
              <span className="text-cyan-400 font-black">🎯 SLA</span>
            </div>
            <div className="mt-1 text-lg font-black text-cyan-300">
              {metrics.commandSuccessRate}%
            </div>
            <div className="mt-0.5 text-[9.5px] text-slate-400">
              Отклик: <b className="text-cyan-200">{metrics.avgLatencyMs} мс</b> • Запросов:{' '}
              <b className="text-white">{metrics.totalAdminQueries}</b>
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/40 bg-slate-950/85 p-2.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Принятие советов игроками</span>
              <span className="text-amber-400 font-black">👍 Conv</span>
            </div>
            <div className="mt-1 text-lg font-black text-amber-300">
              {metrics.adviceAcceptanceRate}%
            </div>
            <div className="mt-0.5 text-[9.5px] text-slate-400">
              Выполнено: <b className="text-amber-200">{metrics.adviceAppliedCount}</b> из{' '}
              <b className="text-white">{metrics.totalPlayerAdvices}</b>
            </div>
          </div>

          <div className="rounded-lg border border-purple-500/40 bg-slate-950/85 p-2.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Оценка полезности советов</span>
              <span className="text-purple-300 font-black">⭐ Рейтинг</span>
            </div>
            <div className="mt-1 text-lg font-black text-purple-300">
              {metrics.avgPlayerRating} / 5.0 ⭐
            </div>
            <div className="mt-0.5 text-[9.5px] text-slate-400">
              Генераций кода IDE: <b className="text-purple-200">{metrics.totalCodeGenerations}</b>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Статистика советов для игроков по категориям + Почасовая активность */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        {/* Category breakdown */}
        <div className="sm:col-span-7 rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-black text-cyan-300 text-xs">
              📊 1. Статистика советов ИИ для игроков по категориям
            </span>
            <span className="text-[10px] text-slate-400">
              Всего советов: <b className="text-white">{metrics.totalPlayerAdvices}</b>
            </span>
          </div>

          <div className="space-y-2">
            {metrics.categoryBreakdown.map((cat) => {
              const meta = AI_CATEGORY_META[cat.category];
              const sharePct =
                metrics.totalPlayerAdvices > 0
                  ? Math.round((cat.totalCount / metrics.totalPlayerAdvices) * 100)
                  : 20;

              return (
                <div
                  key={cat.category}
                  className="rounded-lg border border-slate-800/90 bg-slate-950/75 p-2 space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span>{cat.icon}</span>
                      <span className="font-bold text-white text-[11px]">{cat.label}</span>
                      <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[9.5px] text-slate-300">
                        {cat.totalCount} сов. ({sharePct}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-emerald-400 font-bold">
                        ✅ Принято: {cat.acceptanceRate}%
                      </span>
                      <span className="text-indigo-300">
                        Точность: {cat.avgConfidence}%
                      </span>
                    </div>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${meta.barClass} transition-all duration-300`}
                      style={{ width: `${Math.max(8, cat.acceptanceRate)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[9.5px] text-slate-400 pt-0.5">
                    <span>⚡ Выполнено в игре: {cat.appliedCount}</span>
                    <span>👍 Принято к сведению: {cat.acceptedCount}</span>
                    <span>⏳ Ожидает: {cat.pendingCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hourly Activity & Model Telemetry */}
        <div className="sm:col-span-5 rounded-xl border border-slate-800 bg-slate-900/90 p-3 flex flex-col justify-between space-y-2.5">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-black text-amber-300 text-xs">
                📈 2. Динамика запросов и точности ИИ
              </span>
              <span className="text-[9.5px] text-emerald-400 font-bold">24/7 Мониторинг</span>
            </div>

            <div className="mt-3 grid grid-cols-6 gap-1.5 items-end h-28 px-1 pt-2 border-b border-slate-800/80">
              {metrics.recentHourlyCalls.map((slot, i) => {
                const total = slot.adminCalls + slot.playerAdvices;
                const heightPct = Math.min(100, Math.max(22, total * 14));
                return (
                  <div key={i} className="flex flex-col items-center justify-end h-full gap-1">
                    <span className="text-[9px] font-bold text-indigo-300">{total}</span>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-indigo-600 via-purple-500 to-cyan-400 transition-all"
                      style={{ height: `${heightPct}%` }}
                      title={`Админ: ${slot.adminCalls}, Советы игрокам: ${slot.playerAdvices}, Точность: ${slot.accuracy}%`}
                    />
                    <span className="text-[8.5px] text-slate-400 pb-1">{slot.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Admin AI Executions mini-list */}
          <div className="space-y-1.5">
            <div className="text-[10.5px] font-bold text-slate-300">
              ⚡ Последние операции ядра ИИ:
            </div>
            <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
              {monitoringState.executionMetrics.slice(0, 5).map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/80 px-2 py-1 text-[9.5px]"
                >
                  <div className="truncate text-slate-200">
                    <span className="mr-1">
                      {ex.queryType === 'code_generation'
                        ? '💻'
                        : ex.queryType === 'player_advice'
                        ? '🧠'
                        : '🗄️'}
                    </span>
                    {ex.promptSummary}
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <span className="text-cyan-300 font-bold">{ex.latencyMs}мс</span>
                    <span
                      className={`rounded px-1 py-0.5 font-bold ${
                        ex.success
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : 'bg-red-950 text-red-300 border border-red-500/40'
                      }`}
                    >
                      {ex.accuracyScore}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Управление логикой ИИ-Советника + Генератор советов для игроков */}
      <div className="rounded-xl border border-indigo-500/40 bg-slate-900/90 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div>
            <span className="font-black text-indigo-300 text-xs">
              🧠 3. Настройка логики ИИ-Советника и Живая Диагностика Игроков
            </span>
            <p className="text-[10px] text-slate-400">
              Выберите стратегию анализа и протестируйте выдачу умных советов на любом игроке в 1 клик
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-950/50 px-2.5 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => handleConfigChange({ enabled: e.target.checked })}
              className="accent-emerald-500"
            />
            <span className="text-[10.5px] font-black text-emerald-300">
              {config.enabled ? '🟢 ИИ-Советник Активен' : '🔴 ИИ-Советник Отключён'}
            </span>
          </label>
        </div>

        {/* Strategy selector */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
          {(Object.keys(AI_STRATEGY_LABELS) as AiStrategyMode[]).map((mode) => {
            const info = AI_STRATEGY_LABELS[mode];
            const active = config.strategyMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => handleConfigChange({ strategyMode: mode })}
                className={`rounded-lg border p-2 text-left transition-all cursor-pointer ${
                  active
                    ? 'border-indigo-400 bg-indigo-950/90 text-white shadow-[0_0_10px_rgba(99,102,241,0.4)]'
                    : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-1 font-black text-[10.5px]">
                  <span>{info.icon}</span>
                  <span className="truncate">{info.title}</span>
                </div>
                <p className="mt-1 text-[9px] text-slate-400 line-clamp-2">{info.subtitle}</p>
              </button>
            );
          })}
        </div>

        {/* AI Logic Rule Toggles */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2">
          <label className="flex items-center gap-1.5 text-[10px] text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoWarnLowDurability}
              onChange={(e) => handleConfigChange({ autoWarnLowDurability: e.target.checked })}
              className="accent-cyan-500"
            />
            <span>🔨 Контроль прочности вещей</span>
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoWarnUnspentStats}
              onChange={(e) => handleConfigChange({ autoWarnUnspentStats: e.target.checked })}
              className="accent-emerald-500"
            />
            <span>📈 Контроль очков статов</span>
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoBossReadinessCheck}
              onChange={(e) => handleConfigChange({ autoBossReadinessCheck: e.target.checked })}
              className="accent-purple-500"
            />
            <span>👑 Расчёт шанса на Боссах</span>
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoEconomyOptimization}
              onChange={(e) => handleConfigChange({ autoEconomyOptimization: e.target.checked })}
              className="accent-amber-500"
            />
            <span>🪙 Экономика и VIP-аудит</span>
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={config.sendAdviceToMail}
              onChange={(e) => handleConfigChange({ sendAdviceToMail: e.target.checked })}
              className="accent-indigo-500"
            />
            <span>📩 Дублировать на почту</span>
          </label>
        </div>

        {/* Live Player Analyzer Bar */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-950/30 p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] font-bold text-indigo-200">🎯 Игрок для анализа:</span>
            <select
              value={selectedNick}
              onChange={(e) => setSelectedNick(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white outline-none focus:border-indigo-400"
            >
              {dbPlayers
                .filter((p) => {
                  const n = String(p.nick || p.name || '').trim();
                  return n && !n.startsWith('__');
                })
                .map((p) => {
                  const n = String(p.nick || p.name || '');
                  return (
                    <option key={n} value={n}>
                      {n} (Ур. {p.lvl || 1} • {Number(p.gold || 0).toLocaleString()} 🪙)
                    </option>
                  );
                })}
            </select>
          </div>

          <button
            type="button"
            disabled={isGenerating}
            onClick={() => handleGenerateAdviceForPlayer(selectedNick)}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-3 py-1.5 text-[11px] font-black text-white shadow cursor-pointer disabled:opacity-50"
          >
            {isGenerating
              ? '⏳ ИИ анализирует профиль...'
              : `🧠 Проанализировать «${selectedNick}» и выдать совет`}
          </button>

          <button
            type="button"
            disabled={isGenerating}
            onClick={handleMassAiAuditAllPlayers}
            className="rounded-lg border border-amber-500/60 bg-amber-950/70 hover:bg-amber-900 px-3 py-1.5 text-[11px] font-black text-amber-200 cursor-pointer disabled:opacity-50"
          >
            🚀 Массовый ИИ-аудит всех игроков
          </button>
        </div>

        {/* Highlight freshly generated diagnostic cards if any */}
        {lastDiagnosticResults.length > 0 && (
          <div className="space-y-2 rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-emerald-300">
                ✨ Результаты свежей ИИ-диагностики ({lastDiagnosticResults.length} рекомендаций):
              </span>
              <button
                type="button"
                onClick={() => setLastDiagnosticResults([])}
                className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
              >
                Скрыть
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {lastDiagnosticResults.map((adv) => {
                const meta = AI_CATEGORY_META[adv.category];
                return (
                  <div
                    key={adv.id}
                    className="rounded-lg border border-slate-700 bg-slate-950/90 p-2.5 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded border px-1.5 py-0.5 text-[9.5px] font-black ${meta.badgeClass}`}>
                          {meta.icon} {meta.label}
                        </span>
                        <span className="font-black text-white text-xs">
                          [{adv.playerNick} • Ур.{adv.playerLevel}] {adv.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400">
                        Уверенность ИИ: {adv.confidenceScore}% ({adv.latencyMs}мс)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-200 leading-relaxed">{adv.adviceText}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-[10px] text-amber-300 font-bold">
                        📈 Прогноз эффекта: {adv.expectedImpact}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSendAdviceToPlayerMail(adv)}
                          className="rounded border border-cyan-500/60 bg-cyan-950/80 hover:bg-cyan-800 px-2.5 py-1 text-[10px] font-black text-cyan-200 cursor-pointer"
                        >
                          📩 Отправить на почту
                        </button>
                        <button
                          type="button"
                          disabled={isApplyingActionId === adv.id}
                          onClick={() => handleApplyAdviceActionInDatabase(adv)}
                          className="rounded bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[10px] font-black text-slate-950 cursor-pointer disabled:opacity-50"
                        >
                          {isApplyingActionId === adv.id
                            ? '⏳ Применение...'
                            : '⚡ Исполнить совет в БД'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Журнал выданных советов ИИ для игроков */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <span className="font-black text-white text-xs">
            📜 4. Журнал советов ИИ для игроков ({filteredAdvices.length})
          </span>

          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="text"
              value={searchPlayerQuery}
              onChange={(e) => setSearchPlayerQuery(e.target.value)}
              placeholder="🔍 Поиск по нику или совету..."
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-white outline-none focus:border-indigo-400"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-200 outline-none"
            >
              <option value="all">Все категории</option>
              <option value="combat">⚔️ Бой и Пирамида</option>
              <option value="equipment">🛡️ Экипировка и Ремонт</option>
              <option value="economy">🪙 Экономика и Банк</option>
              <option value="progression">📈 Прокачка и Статы</option>
              <option value="boss">👑 Охота на Боссов</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-200 outline-none"
            >
              <option value="all">Все статусы</option>
              <option value="applied">✅ Выполнено</option>
              <option value="accepted">👍 Принято</option>
              <option value="pending">⏳ Ожидает</option>
              <option value="dismissed">❌ Отклонено</option>
            </select>
          </div>
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {filteredAdvices.map((item) => {
            const meta = AI_CATEGORY_META[item.category] || AI_CATEGORY_META.combat;
            return (
              <div
                key={item.id}
                className="rounded-lg border border-slate-800 bg-slate-950/85 p-2.5 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[9.5px] font-black ${meta.badgeClass}`}
                    >
                      {meta.icon} {meta.label}
                    </span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
                      👤 {item.playerNick} (Ур. {item.playerLevel})
                    </span>
                    <span className="font-bold text-white text-[11px]">{item.title}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[9.5px]">
                    <span className="text-slate-400">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-black ${
                        item.status === 'applied'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : item.status === 'accepted'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                          : item.status === 'dismissed'
                          ? 'bg-red-950 text-red-300 border border-red-500/40'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {item.status === 'applied'
                        ? '✅ Выполнено'
                        : item.status === 'accepted'
                        ? '👍 Принято'
                        : item.status === 'dismissed'
                        ? '❌ Отклонено'
                        : '⏳ Ожидает'}
                    </span>
                  </div>
                </div>

                <p className="text-[10.5px] text-slate-300 leading-relaxed">{item.adviceText}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-900">
                  <div className="flex flex-wrap items-center gap-2 text-[9.5px] text-slate-400">
                    <span className="text-amber-300 font-semibold">
                      Эффект: {item.expectedImpact}
                    </span>
                    <span>• Точность: {item.confidenceScore}%</span>
                    <span>• {item.latencyMs} мс</span>
                    <span>
                      • Ядро:{' '}
                      {item.source === 'gemini-4-argon' || item.source === 'gemini-3.8-flash'
                        ? 'Argon 4 (gemini-4-argon)'
                        : 'Tactical AI'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSendAdviceToPlayerMail(item)}
                      className="rounded border border-cyan-500/50 bg-cyan-950/60 hover:bg-cyan-900 px-2 py-0.5 text-[9.5px] font-bold text-cyan-200 cursor-pointer"
                    >
                      📩 На почту
                    </button>
                    {item.status !== 'applied' && (
                      <button
                        type="button"
                        disabled={isApplyingActionId === item.id}
                        onClick={() => handleApplyAdviceActionInDatabase(item)}
                        className="rounded border border-emerald-500/50 bg-emerald-950/70 hover:bg-emerald-800 px-2 py-0.5 text-[9.5px] font-black text-emerald-300 cursor-pointer"
                      >
                        ⚡ Исполнить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
