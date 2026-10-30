import React, { useState, useMemo } from 'react';
import {
  BotSimulationConfig,
  getBotSimulationConfig,
  saveBotSimulationConfig,
  getRuntimeBots,
  tickBotSimulation,
  DEFAULT_BOT_CHAT_PHRASES,
  getRandomBotChatMessage,
  BotCharacter
} from '../../utils/botSimulation';
import { ChatMessage } from '../../types/game';

interface AdminBotsTabProps {
  showToast: (text: string) => void;
  onSendChatMessage?: (msg: ChatMessage) => void;
  onRefreshBots?: () => void;
}

export const AdminBotsTab: React.FC<AdminBotsTabProps> = ({
  showToast,
  onSendChatMessage,
  onRefreshBots
}) => {
  const [config, setConfig] = useState<BotSimulationConfig>(() => getBotSimulationConfig());
  const [runtimeBots, setRuntimeBots] = useState<BotCharacter[]>(() => getRuntimeBots());
  const [phraseSearch, setPhraseSearch] = useState('');
  const [newPhraseInput, setNewPhraseInput] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [botFilterLocation, setBotFilterLocation] = useState<'all' | 'pyramid' | 'city'>('all');
  const [botFilterTier, setBotFilterTier] = useState<'all' | 1 | 2 | 3>('all');

  const onlineBotsCount = useMemo(() => {
    return runtimeBots.filter((b) => b.isOnline).length;
  }, [runtimeBots]);

  const filteredPhrases = useMemo(() => {
    const q = phraseSearch.trim().toLowerCase();
    if (!q) return config.customPhrases;
    return config.customPhrases.filter((p) => p.toLowerCase().includes(q));
  }, [config.customPhrases, phraseSearch]);

  const filteredBots = useMemo(() => {
    return runtimeBots.filter((b) => {
      if (botFilterLocation !== 'all' && b.location !== botFilterLocation) return false;
      if (botFilterTier !== 'all' && b.pyramidTier !== botFilterTier) return false;
      return true;
    });
  }, [runtimeBots, botFilterLocation, botFilterTier]);

  const handleToggleSimulation = (enabled: boolean) => {
    const nextCfg = { ...config, enabled };
    setConfig(nextCfg);
    saveBotSimulationConfig(nextCfg);
    const updated = tickBotSimulation(nextCfg);
    setRuntimeBots(updated);
    if (onRefreshBots) onRefreshBots();
    showToast(enabled ? '🟢 Имитация живого онлайна включена!' : '🔴 Имитация онлайна выключена');
  };

  const handleToggleChat = (chatEnabled: boolean) => {
    const nextCfg = { ...config, chatEnabled };
    setConfig(nextCfg);
    saveBotSimulationConfig(nextCfg);
    showToast(chatEnabled ? '💬 Авто-чат ботов включен!' : '🔇 Авто-чат ботов выключен');
  };

  const handleChangeTargetOnline = (val: number) => {
    const safeVal = Math.max(5, Math.min(60, val));
    const nextCfg = { ...config, targetOnlineCount: safeVal };
    setConfig(nextCfg);
    saveBotSimulationConfig(nextCfg);
    const updated = tickBotSimulation(nextCfg);
    setRuntimeBots(updated);
    if (onRefreshBots) onRefreshBots();
  };

  const handleChangeDelays = (minSec: number, maxSec: number) => {
    const safeMin = Math.max(5, Math.min(180, minSec));
    const safeMax = Math.max(safeMin + 2, Math.min(300, maxSec));
    const nextCfg = { ...config, chatMinDelaySec: safeMin, chatMaxDelaySec: safeMax };
    setConfig(nextCfg);
    saveBotSimulationConfig(nextCfg);
  };

  const handleReshuffleBots = () => {
    const updated = tickBotSimulation({ ...config, enabled: true });
    setRuntimeBots(updated);
    if (onRefreshBots) onRefreshBots();
    showToast('🔄 Онлайн и координаты ботов успешно перетасованы!');
  };

  const handleAddPhrase = () => {
    const text = newPhraseInput.trim();
    if (!text) {
      showToast('Введите текст реплики!');
      return;
    }
    if (config.customPhrases.includes(text)) {
      showToast('Такая фраза уже есть в списке!');
      return;
    }
    const nextPhrases = [text, ...config.customPhrases];
    const nextCfg = { ...config, customPhrases: nextPhrases };
    setConfig(nextCfg);
    saveBotSimulationConfig(nextCfg);
    setNewPhraseInput('');
    showToast(`✅ Фраза добавлена! Всего реплик: ${nextPhrases.length}`);
  };

  const handleDeletePhrase = (indexToDelete: number) => {
    const phraseToDelete = filteredPhrases[indexToDelete];
    const nextPhrases = config.customPhrases.filter((p) => p !== phraseToDelete);
    const nextCfg = { ...config, customPhrases: nextPhrases };
    setConfig(nextCfg);
    saveBotSimulationConfig(nextCfg);
    showToast(`🗑️ Фраза удалена. Осталось: ${nextPhrases.length}`);
  };

  const handleStartEditPhrase = (index: number) => {
    setEditingIndex(index);
    setEditingText(filteredPhrases[index]);
  };

  const handleSaveEditPhrase = (index: number) => {
    const oldText = filteredPhrases[index];
    const newText = editingText.trim();
    if (!newText) return;
    const nextPhrases = config.customPhrases.map((p) => (p === oldText ? newText : p));
    const nextCfg = { ...config, customPhrases: nextPhrases };
    setConfig(nextCfg);
    saveBotSimulationConfig(nextCfg);
    setEditingIndex(null);
    setEditingText('');
    showToast('✅ Реплика сохранена!');
  };

  const handleResetPhrasesToDefault = () => {
    const nextCfg = { ...config, customPhrases: DEFAULT_BOT_CHAT_PHRASES };
    setConfig(nextCfg);
    saveBotSimulationConfig(nextCfg);
    showToast(`🔄 Список реплик сброшен к исходным (${DEFAULT_BOT_CHAT_PHRASES.length} фраз)!`);
  };

  const handleTriggerInstantBotMessage = () => {
    const msg = getRandomBotChatMessage(config);
    if (!msg) {
      showToast('❌ Не удалось отправить сообщение: авто-чат выключен или нет ботов онлайн');
      return;
    }
    if (onSendChatMessage) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      onSendChatMessage({
        id: `bot_chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        time: timeStr,
        author: msg.author,
        text: msg.text,
        channel: msg.channel,
        timestamp: Date.now()
      });
      showToast(`💬 Бот ${msg.author} отправил реплику: «${msg.text.slice(0, 45)}...»`);
    } else {
      showToast(`💬 Сгенерирована реплика от ${msg.author}: ${msg.text}`);
    }
  };

  return (
    <div className="space-y-3.5 text-xs">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl border border-cyan-500/40 bg-slate-900/90 p-2.5 shadow">
          <div className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
            Имитация онлайна
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-black text-white">
              {config.enabled ? '🟢 Активна' : '🔴 Выключена'}
            </span>
            <button
              type="button"
              onClick={() => handleToggleSimulation(!config.enabled)}
              className={`rounded px-2 py-1 text-[9.5px] font-black transition-all cursor-pointer ${
                config.enabled
                  ? 'bg-rose-900/80 border border-rose-500/60 text-rose-200 hover:bg-rose-800'
                  : 'bg-emerald-600 border border-emerald-400 text-slate-950 hover:bg-emerald-500'
              }`}
            >
              {config.enabled ? 'Выключить' : 'Включить'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/40 bg-slate-900/90 p-2.5 shadow">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
            Ботов «В игре»
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-black text-white">
              {onlineBotsCount} <span className="text-[11px] text-slate-400">/ {config.targetOnlineCount} цель</span>
            </span>
            <span className="text-[10px] font-black text-emerald-300">
              База: {runtimeBots.length}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-purple-500/40 bg-slate-900/90 p-2.5 shadow">
          <div className="text-[10px] font-black uppercase tracking-wider text-purple-400">
            Авто-чат ботов
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-black text-white">
              {config.chatEnabled ? '💬 Включен' : '🔇 Пауза'}
            </span>
            <button
              type="button"
              onClick={() => handleToggleChat(!config.chatEnabled)}
              className={`rounded px-2 py-1 text-[9.5px] font-black transition-all cursor-pointer ${
                config.chatEnabled
                  ? 'bg-rose-900/80 border border-rose-500/60 text-rose-200 hover:bg-rose-800'
                  : 'bg-purple-600 border border-purple-400 text-white hover:bg-purple-500'
              }`}
            >
              {config.chatEnabled ? 'Пауза' : 'Пуск'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/40 bg-slate-900/90 p-2.5 shadow">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
            Пул реплик чата
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-black text-amber-300">
              {config.customPhrases.length} фраз
            </span>
            <button
              type="button"
              onClick={handleTriggerInstantBotMessage}
              className="rounded bg-gradient-to-r from-amber-500 to-yellow-500 px-2 py-1 text-[9.5px] font-black text-slate-950 hover:brightness-110 cursor-pointer shadow"
              title="Отправить сообщение от случайного бота прямо сейчас"
            >
              💬 Тест
            </button>
          </div>
        </div>
      </div>

      {/* Main Settings Panel */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-cyan-300">
              ⚙️ Настройки симуляции и трафика
            </span>
            <span className="rounded bg-cyan-950 border border-cyan-500/40 px-2 py-0.5 text-[9px] font-black text-cyan-200">
              Египетский мир
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleReshuffleBots}
              className="rounded-lg border border-cyan-500/50 bg-cyan-950/70 hover:bg-cyan-900 px-2.5 py-1 text-[10px] font-black text-cyan-200 cursor-pointer active:scale-95 shadow"
            >
              🔄 Перетасовать онлайн & координаты
            </button>
            <button
              type="button"
              onClick={handleResetPhrasesToDefault}
              className="rounded-lg border border-amber-500/50 bg-amber-950/70 hover:bg-amber-900 px-2.5 py-1 text-[10px] font-black text-amber-200 cursor-pointer active:scale-95 shadow"
            >
              🔄 Сброс фраз (110+)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Target Online Count Slider */}
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">
                Целевое количество «онлайн» ботов:
              </span>
              <span className="rounded bg-emerald-950 border border-emerald-500/40 px-2 py-0.5 font-mono font-black text-emerald-300">
                {config.targetOnlineCount} игроков
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="1"
              value={config.targetOnlineCount}
              onChange={(e) => handleChangeTargetOnline(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[9.5px] text-slate-400">
              <span>Минимум: 5</span>
              <span>Рекомендуемо: 20-35</span>
              <span>Максимум: 60</span>
            </div>
            <p className="text-[9.5px] text-slate-400">
              Боты автоматически входят и выходят из игры с плавными задержками, перемещаются по ярусам Пирамиды и отображаются в списке «В игре».
            </p>
          </div>

          {/* Chat Interval Settings */}
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">
                Интервал сообщений в чате:
              </span>
              <span className="rounded bg-purple-950 border border-purple-500/40 px-2 py-0.5 font-mono font-black text-purple-300">
                {config.chatMinDelaySec}с – {config.chatMaxDelaySec}с
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-slate-400 uppercase font-black">
                  Мин. пауза (сек)
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={config.chatMinDelaySec}
                  onChange={(e) => handleChangeDelays(Number(e.target.value), config.chatMaxDelaySec)}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase font-black">
                  Макс. пауза (сек)
                </label>
                <input
                  type="number"
                  min="10"
                  max="300"
                  value={config.chatMaxDelaySec}
                  onChange={(e) => handleChangeDelays(config.chatMinDelaySec, Number(e.target.value))}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white font-mono"
                />
              </div>
            </div>
            <p className="text-[9.5px] text-slate-400">
              Боты случайным образом берут реплики из базы и отправляют их в общий чат (`world`/`general`), создавая живой эффект общения.
            </p>
          </div>
        </div>
      </div>

      {/* Phrases Editor Section (100+ phrases) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-amber-400">
              💬 База реплик авто-чата ({config.customPhrases.length})
            </span>
            <span className="text-[10px] text-slate-400">
              (отображается {filteredPhrases.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={phraseSearch}
              onChange={(e) => setPhraseSearch(e.target.value)}
              placeholder="🔍 Поиск по тексту фразы..."
              className="w-48 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-white outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Add New Phrase Form */}
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-slate-950 p-2">
          <input
            type="text"
            value={newPhraseInput}
            onChange={(e) => setNewPhraseInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddPhrase();
            }}
            placeholder="Введите новую фразу для ботов (например: «Кто в П3 на босса?», «Ура, апнул уровень!»)..."
            className="flex-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white outline-none focus:border-amber-400"
          />
          <button
            type="button"
            onClick={handleAddPhrase}
            className="rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-3 py-1.5 text-xs font-black text-slate-950 hover:brightness-110 cursor-pointer shadow shrink-0"
          >
            ➕ Добавить
          </button>
        </div>

        {/* Scrollable Phrases List */}
        <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
          {filteredPhrases.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-xs text-slate-400">
              Фразы не найдены. Измените поисковый запрос или добавьте новую фразу!
            </div>
          ) : (
            filteredPhrases.map((phrase, idx) => {
              const isEditing = editingIndex === idx;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-950/70 p-1.5 px-2.5 hover:border-slate-700"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-mono text-[9px] text-slate-500 shrink-0">
                      #{idx + 1}
                    </span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEditPhrase(idx);
                        }}
                        className="flex-1 rounded border border-amber-400 bg-slate-900 px-2 py-0.5 text-xs text-white"
                        autoFocus
                      />
                    ) : (
                      <span className="text-xs text-slate-200 truncate">
                        «{phrase}»
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSaveEditPhrase(idx)}
                          className="rounded bg-emerald-600 px-2 py-0.5 text-[9.5px] font-black text-white hover:bg-emerald-500 cursor-pointer"
                        >
                          Сохранить
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingIndex(null)}
                          className="rounded bg-slate-800 px-1.5 py-0.5 text-[9.5px] text-slate-300 hover:bg-slate-700 cursor-pointer"
                        >
                          Отмена
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartEditPhrase(idx)}
                          className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9.5px] text-slate-300 hover:text-white cursor-pointer"
                          title="Редактировать фразу"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePhrase(idx)}
                          className="rounded border border-rose-500/50 bg-rose-950/60 px-1.5 py-0.5 text-[9.5px] text-rose-300 hover:bg-rose-900 cursor-pointer"
                          title="Удалить фразу"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Active Bots Roster Section */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-emerald-400">
              👥 Персонажи-боты ({runtimeBots.length} всего, {onlineBotsCount} онлайн)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">Фильтр:</span>
            <select
              value={botFilterLocation}
              onChange={(e) => setBotFilterLocation(e.target.value as any)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] text-white"
            >
              <option value="all">Все локации</option>
              <option value="pyramid">Только Пирамида</option>
              <option value="city">Только Город</option>
            </select>
            <select
              value={botFilterTier}
              onChange={(e) => setBotFilterTier(e.target.value === 'all' ? 'all' : (Number(e.target.value) as any))}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] text-white"
            >
              <option value="all">Все ярусы</option>
              <option value="1">Ярус 1 (П1)</option>
              <option value="2">Ярус 2 (П2)</option>
              <option value="3">Ярус 3 (П3)</option>
            </select>
          </div>
        </div>

        {/* Bots Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
          {filteredBots.map((bot) => (
            <div
              key={bot.id}
              className={`rounded-lg border p-2 text-[10.5px] transition-all flex items-center justify-between gap-2 ${
                bot.isOnline
                  ? 'border-emerald-500/50 bg-emerald-950/20'
                  : 'border-slate-800/80 bg-slate-950/60 opacity-60'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-base">
                  {bot.avatar}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        bot.isOnline ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-600'
                      }`}
                    />
                    <span className="font-black text-white truncate">{bot.nick}</span>
                    <span className="rounded bg-slate-800 px-1 text-[8.5px] font-bold text-amber-300">
                      {bot.lvl} ур.
                    </span>
                    {bot.isPremium && (
                      <span className="text-[8.5px] text-yellow-400">👑VIP</span>
                    )}
                    {bot.clanTag && (
                      <span className="rounded bg-amber-950 border border-amber-500/40 px-1 text-[7.5px] font-black text-amber-300">
                        [{bot.clanTag}]
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {bot.location === 'pyramid'
                      ? `🏛️ Пирамида ${bot.pyramidTier} [Ряд ${bot.row}, Кол ${bot.col}]`
                      : '🏙️ Город Луксор'}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span
                  className={`rounded px-1.5 py-0.5 text-[8.5px] font-black ${
                    bot.isOnline
                      ? 'bg-emerald-900/80 border border-emerald-500/50 text-emerald-200'
                      : 'bg-slate-900 border border-slate-800 text-slate-500'
                  }`}
                >
                  {bot.isOnline ? 'В сети' : 'Оффлайн'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
