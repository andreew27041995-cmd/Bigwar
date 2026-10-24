import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, FriendEntry, CombatLogEntry, EquippedGear, ItemSlot } from '../types/game';
import { SLOT_INFO, getQualityConfig, getPyramidTierForLevel } from '../utils/gameData';
import { RealtimePlayer, RealtimeConnectionStatus, isPlayerOnlineByHeartbeat } from '../utils/supabase';
import { getPlayerClan } from '../utils/clanStorage';
import CharacterAvatar from './CharacterAvatar';
import { ItemIcon } from './ItemIcon';

interface ChatAndOnlineProps {
  messages: ChatMessage[];
  friends: FriendEntry[];
  activeChannel: 'world' | 'general' | 'combatLog';
  combatLog?: CombatLogEntry[];
  playersInPyramid?: string[];
  heroLocation?: 'pyramid' | 'city';
  heroPyramidTier?: number;
  currentUser?: string | null;
  isAdmin?: boolean;
  heroLevel?: number;
  heroAvatar?: string;
  heroIsPremium?: boolean;
  equipped?: EquippedGear;
  onOpenCharModal?: () => void;
  realtimePlayers?: RealtimePlayer[];
  realtimeStatus?: RealtimeConnectionStatus;
  onSwitchChannel: (channel: 'world' | 'general' | 'combatLog') => void;
  onClearCombatLog?: () => void;
  onSendMessage: (text: string) => void;
  onDeleteMessage?: (msgId: string) => void;
  onInspectPlayer: (nick: string) => void;
}

export const ChatAndOnline: React.FC<ChatAndOnlineProps> = ({
  messages,
  activeChannel,
  combatLog = [],
  playersInPyramid = [],
  heroLocation = 'city',
  heroPyramidTier = 1,
  currentUser,
  isAdmin = false,
  heroLevel = 1,
  heroAvatar = '🧙‍♂️',
  heroIsPremium = false,
  equipped,
  onOpenCharModal,
  realtimePlayers = [],
  realtimeStatus = 'CONNECTING',
  onSwitchChannel,
  onClearCombatLog,
  onSendMessage,
  onDeleteMessage,
  onInspectPlayer
}) => {
  const [inputText, setInputText] = useState('');
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Re-evaluate heartbeat timeout every 3 seconds so disconnected players drop off "В игре" automatically
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const chatHidden = isChatCollapsed;

  const filteredMessages = messages.filter((m) => m.channel === activeChannel);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current && activeChannel !== 'combatLog' && !chatHidden) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [filteredMessages, activeChannel, chatHidden]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || activeChannel === 'combatLog') return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const myNick = currentUser || 'Игрок';
  const canModerateChat = isAdmin;

  // Strictly bind Pyramid Tier (1, 2, or 3) to real player level:
  // 1-5 lvl -> Pyramid 1, 6-10 lvl -> Pyramid 2, 11-20 lvl -> Pyramid 3
  const myPyramidTier = getPyramidTierForLevel(heroLevel);

  // Build live online players list containing ONLY real active players verified by Heartbeat
  const playerMap = new Map<
    string,
    { nick: string; lvl: number; isMe: boolean; inPyramid: boolean; tier: 1 | 2 | 3; isPremium: boolean }
  >();

  // 1. Add current real player
  playerMap.set(myNick.toLowerCase(), {
    nick: myNick,
    lvl: heroLevel,
    isMe: true,
    inPyramid: heroLocation === 'pyramid',
    tier: myPyramidTier,
    isPremium: Boolean(heroIsPremium)
  });

  // 2. Add real players from Supabase Realtime whose Heartbeat (lastSeen) is fresh (<15s)
  if (realtimePlayers && realtimePlayers.length > 0) {
    realtimePlayers.forEach((rp) => {
      const lowerNick = rp.nick.toLowerCase();
      if (lowerNick === myNick.toLowerCase()) return;
      const isFreshOnline =
        rp.lastSeen !== undefined && rp.lastSeen > 0
          ? isPlayerOnlineByHeartbeat(rp.isOnline, rp.lastSeen) && nowTick - rp.lastSeen < 15000
          : false;
      if (isFreshOnline) {
        const inPyr = rp.location === 'pyramid' || playersInPyramid.includes(rp.nick);
        const rpPrem = Boolean(
          rp.isPremium && (!rp.premiumUntil || rp.premiumUntil > nowTick)
        );
        const actualLvl = Math.max(1, Number(rp.lvl || 1));
        const strictTier = getPyramidTierForLevel(actualLvl);
        playerMap.set(lowerNick, {
          nick: rp.nick,
          lvl: actualLvl,
          isMe: false,
          inPyramid: inPyr,
          tier: strictTier,
          isPremium: rpPrem
        });
      }
    });
  }

  const onlinePlayers = Array.from(playerMap.values());

  const isPlayerVip = (name: string): boolean => {
    const clean = name.replace(/✉️.*для\s*/, '').trim().toLowerCase();
    if (clean === myNick.toLowerCase()) return Boolean(heroIsPremium);
    const rp = realtimePlayers.find((p) => p.nick.toLowerCase() === clean);
    return Boolean(rp?.isPremium && (!rp.premiumUntil || rp.premiumUntil > nowTick));
  };

  const getPlayerPyramidTier = (name: string): 1 | 2 | 3 => {
    const clean = name.replace(/✉️.*для\s*/, '').trim().toLowerCase();
    if (clean === myNick.toLowerCase()) return getPyramidTierForLevel(heroLevel);
    const rp = realtimePlayers.find((p) => p.nick.toLowerCase() === clean);
    return getPyramidTierForLevel(rp?.lvl || 1);
  };

  const getPlayerClanBadge = (name: string): { tag: string; emblem: string } | null => {
    const clean = name.replace(/✉️.*для\s*/, '').trim();
    const clan = getPlayerClan(clean);
    if (clan) return { tag: clan.tag, emblem: clan.emblem };
    const rp = realtimePlayers.find((p) => p.nick.toLowerCase() === clean.toLowerCase());
    if (rp && rp.clanTag) {
      return { tag: rp.clanTag, emblem: rp.clanEmblem || '🛡️' };
    }
    return null;
  };

  const renderClanBadge = (badge: { tag: string; emblem: string } | null) => {
    if (!badge) return null;
    return (
      <span
        className="mr-1 inline-flex items-center gap-0.5 rounded border border-amber-500/60 bg-amber-950/80 px-1 py-[0.5px] text-[7.5px] font-black leading-none text-amber-300 shadow shrink-0"
        title={`Клан [${badge.tag}]`}
      >
        {badge.emblem.startsWith('data:') ? (
          <img src={badge.emblem} alt="clan" className="h-2.5 w-2.5 object-cover rounded-full inline" />
        ) : (
          <span>{badge.emblem}</span>
        )}
        <span>[{badge.tag}]</span>
      </span>
    );
  };

  const getPyramidBadgeStyle = (tier: 1 | 2 | 3) => {
    if (tier === 3) {
      return {
        label: '🔺П3',
        fullTitle: 'Пирамида 3 (11–20 ур.)',
        className: 'bg-red-950/90 border-red-500/60 text-red-200'
      };
    }
    if (tier === 2) {
      return {
        label: '🔺П2',
        fullTitle: 'Пирамида 2 (6–10 ур.)',
        className: 'bg-purple-950/90 border-purple-500/60 text-purple-200'
      };
    }
    return {
      label: '🔺П1',
      fullTitle: 'Пирамида 1 (1–5 ур.)',
      className: 'bg-amber-950/90 border-amber-500/60 text-amber-200'
    };
  };

  const getPlayerDisplay = (name: string) => {
    const lower = name.replace(/✉️.*для\s*/, '').trim().toLowerCase();
    const rp = realtimePlayers.find((p) => p.nick.toLowerCase() === lower);
    const isAdm = rp?.role === 'admin' || Number(rp?.is_admin) === 1 || Number(rp?.isAdmin) === 1 || (lower === myNick.toLowerCase() && isAdmin);
    const tier = getPlayerPyramidTier(name);
    const lvl = lower === myNick.toLowerCase() ? heroLevel : Math.max(1, Number(rp?.lvl || 1));
    if (isAdm) {
      return { color: '#fbbf24', title: '[Админ]', tier, lvl };
    }
    if (isPlayerVip(name)) {
      return { color: '#fde047', title: '', tier, lvl };
    }
    return { color: '#94a3b8', title: '', tier, lvl };
  };

  const renderEquipSlot = (slot: ItemSlot, label: string) => {
    const info = SLOT_INFO[slot];
    const item = equipped?.[slot] || null;
    const quality = item ? getQualityConfig(item.quality) : null;

    return (
      <button
        type="button"
        key={slot}
        onClick={onOpenCharModal}
        title={
          item
            ? `${label}: ${item.name} (Ур.${item.lvl})`
            : `Слот [${label}] — пусто (нажмите для открытия экипировки)`
        }
        className="group relative flex h-11 w-11 sm:h-12 sm:w-12 flex-col items-center justify-center rounded-md border-2 transition-all hover:brightness-110 active:scale-95 shrink-0"
        style={{
          borderColor: item ? quality?.color : 'rgba(217, 119, 6, 0.45)',
          background: item
            ? 'radial-gradient(circle at center, rgba(45, 29, 18, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)'
            : 'linear-gradient(180deg, rgba(30, 20, 12, 0.85) 0%, rgba(12, 10, 9, 0.92) 100%)',
          boxShadow: item
            ? `0 0 8px ${quality?.color}44, inset 0 1px 0 rgba(255,255,255,0.12)`
            : 'inset 0 1px 3px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.5)'
        }}
      >

        {/* Item or default slot icon */}
        <span
          className={`flex h-5 w-5 items-center justify-center text-base sm:text-lg leading-none drop-shadow ${
            item ? 'opacity-100 scale-105' : 'opacity-65 group-hover:opacity-90'
          }`}
        >
          {item ? <ItemIcon icon={item.icon} alt={item.name} fallback={info.icon} /> : info.icon}
        </span>

        {/* Slot Label */}
        <span
          className="mt-0.5 max-w-full truncate px-0.5 text-[6.5px] font-extrabold leading-none tracking-tight"
          style={{ color: item ? quality?.color : '#d97706' }}
        >
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="relative flex flex-[36] min-h-0 bg-slate-950 text-white border-t border-slate-800 overflow-hidden">
      {/* Left Area: Either the Expanded Chat & Combat Log Block (55%) OR Interactive Full-Body Equipment Zone when collapsed */}
      {!chatHidden ? (
        <div className="flex w-[55%] min-w-0 flex-col border-r border-slate-800 p-1.5 transition-all duration-300 ease-in-out">
          {/* Chat & Combat Log Tabs + Collapse Chat Arrow Button (Pyramid only) */}
          <div className="flex items-center gap-1 mb-1 shrink-0">
            <button
              type="button"
              onClick={() => onSwitchChannel('world')}
              className={`flex-1 rounded py-0.5 text-[8.5px] font-bold transition-colors ${
                activeChannel === 'world'
                  ? 'bg-sky-600 text-white'
                  : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Мир
            </button>
            <button
              type="button"
              onClick={() => onSwitchChannel('general')}
              className={`flex-1 rounded py-0.5 text-[8.5px] font-bold transition-colors ${
                activeChannel === 'general'
                  ? 'bg-sky-600 text-white'
                  : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Общий
            </button>
            <button
              type="button"
              onClick={() => onSwitchChannel('combatLog')}
              className={`flex-1 rounded py-0.5 text-[8.5px] font-bold transition-colors truncate px-1 ${
                activeChannel === 'combatLog'
                  ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.6)]'
                  : 'border border-red-900/60 bg-slate-900 text-red-300 hover:text-red-200'
              }`}
            >
              ⚔️ Лог{combatLog.length > 0 ? ` (${combatLog.length})` : ''}
            </button>

            {/* Collapse Chat Button: hides chat and reveals full-body character & equipment */}
            <button
              type="button"
              onClick={() => setIsChatCollapsed(true)}
              className="flex items-center justify-center gap-0.5 rounded border border-amber-500/60 bg-amber-950/80 px-1.5 py-0.5 text-[8.5px] font-black text-amber-300 hover:bg-amber-800 hover:text-white active:scale-95 shrink-0 shadow cursor-pointer"
              title="Скрыть чат (показать персонажа в полный рост и амуницию)"
            >
              <span>👤</span>
              <span>▶</span>
            </button>
          </div>

          {activeChannel === 'combatLog' ? (
            /* Personal Combat Log Tab Content */
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 text-[9px] leading-snug">
                {combatLog.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-[9px] text-slate-500 italic px-2">
                    Лог боя пока пуст. Атакуйте монстров или игроков в Пирамиде (3⚡ за удар).
                  </div>
                ) : (
                  combatLog.map((entry) => (
                    <div
                      key={entry.id}
                      className={`rounded border px-1.5 py-0.5 break-words ${
                        entry.type === 'kill'
                          ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200 font-semibold'
                          : entry.type === 'loot'
                          ? 'border-amber-400/60 bg-amber-950/40 text-yellow-200 font-bold'
                          : entry.type === 'potion'
                          ? 'border-sky-500/40 bg-sky-950/30 text-sky-200 font-semibold'
                          : entry.type === 'pvp'
                          ? 'border-red-500/50 bg-red-950/40 text-red-200 font-semibold'
                          : 'border-slate-800 bg-slate-900/70 text-slate-200'
                      }`}
                    >
                      <span className="text-[7.5px] text-slate-400 font-mono mr-1">
                        [{entry.time}]
                      </span>
                      <span>{entry.text}</span>
                    </div>
                  ))
                )}
              </div>
              {combatLog.length > 0 && onClearCombatLog && (
                <div className="mt-1 flex justify-end shrink-0">
                  <button
                    type="button"
                    onClick={onClearCombatLog}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[8px] font-bold text-slate-400 hover:text-white active:scale-95"
                  >
                    Очистить лог
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Messages scroll box */}
              <div
                ref={chatScrollRef}
                className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 text-[9.5px] leading-tight"
              >
                {filteredMessages.map((msg) => {
                  const display = getPlayerDisplay(msg.author);
                  const authorIsVip = isPlayerVip(msg.author);
                  const clanBadge = getPlayerClanBadge(msg.author);
                  const isOwnMsg =
                    String(msg.author || '').trim().toLowerCase() === myNick.trim().toLowerCase();
                  const canDeleteMsg = Boolean(onDeleteMessage && (canModerateChat || isOwnMsg));
                  const isRareLootMsg =
                    Boolean(msg.isRareLoot) ||
                    (msg.channel === 'world' && (msg.text.includes('🎁') || msg.text.includes('💎')));

                  if (isRareLootMsg) {
                    return (
                      <div
                        key={msg.id}
                        className="flex items-start justify-between gap-1 rounded border border-amber-400/80 bg-gradient-to-r from-amber-950/90 via-yellow-900/50 to-amber-950/90 px-1.5 py-0.5 text-[9px] font-bold text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.35)] break-words"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[7.5px] text-amber-300/80 mr-1">[{msg.time}]</span>
                          <span className="text-yellow-300">{msg.text}</span>
                        </div>
                        {canDeleteMsg && (
                          <button
                            type="button"
                            onClick={() => onDeleteMessage && onDeleteMessage(msg.id)}
                            title="Удалить сообщение из чата"
                            className="shrink-0 rounded bg-red-950/80 border border-red-500/40 px-1 text-[8px] font-black text-red-300 hover:bg-red-800 hover:text-white"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="group flex items-start justify-between gap-1 break-words">
                      <div className="min-w-0 flex-1">
                        <span className="text-[7.5px] text-slate-500 mr-1">[{msg.time}]</span>
                        {msg.isSystem ? (
                          <span className="italic text-red-400">{msg.text}</span>
                        ) : (
                          <>
                            <span
                              className={`mr-1 inline-flex items-center rounded border px-1 py-[0.5px] text-[7.5px] font-black leading-none ${
                                getPyramidBadgeStyle(display.tier).className
                              }`}
                              title={`${getPyramidBadgeStyle(display.tier).fullTitle} • Игрок ${display.lvl} ур.`}
                            >
                              {getPyramidBadgeStyle(display.tier).label}
                            </span>
                            {renderClanBadge(clanBadge)}
                            <span
                              onClick={() => onInspectPlayer(msg.author.replace(/✉️.*для\s*/, ''))}
                              className="cursor-pointer font-bold hover:underline"
                              style={{ color: display.color }}
                            >
                              {authorIsVip ? '👑 ' : ''}
                              {display.title ? `${display.title} ` : ''}
                              {msg.author}:
                            </span>{' '}
                            <span className="text-slate-200">{msg.text}</span>
                          </>
                        )}
                      </div>
                      {canDeleteMsg && (
                        <button
                          type="button"
                          onClick={() => onDeleteMessage && onDeleteMessage(msg.id)}
                          title="Удалить сообщение"
                          className="shrink-0 rounded bg-slate-900 border border-slate-700 px-1 text-[7.5px] font-bold text-red-400 hover:border-red-500 hover:bg-red-950 hover:text-red-200"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Input box */}
              <form onSubmit={handleSubmit} className="mt-1 flex gap-1 shrink-0">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Сообщение..."
                  className="flex-1 min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[9.5px] text-white outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  className="rounded bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-sky-500 active:scale-95 shrink-0"
                >
                  ➔
                </button>
              </form>
            </>
          )}
        </div>
      ) : (
        /* Interactive Full-Height Character & Equipment Zone displayed when Chat is hidden */
        <div
          className="relative flex w-[55%] min-w-0 items-stretch justify-between border-r border-amber-700/50 p-1.5 select-none overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 45% 50%, rgba(245, 158, 11, 0.22) 0%, rgba(88, 28, 135, 0.24) 45%, rgba(15, 10, 18, 0.96) 100%)
            `
          }}
        >
          {/* Equipment & Full-Body Hero Display Panel */}
          <div className="flex flex-1 min-w-0 items-stretch justify-center gap-1.5 sm:gap-2 pr-1">
            {/* Left Column of Square Slots: Top [Оружие], Middle [Броня], Bottom [Перчатки] */}
            <div className="flex flex-col items-center justify-between gap-1 py-0.5 shrink-0">
              {renderEquipSlot('weapon', 'Оружие')}
              {renderEquipSlot('armor', 'Броня')}
              {renderEquipSlot('gloves', 'Перчатки')}
            </div>

            {/* Center: True Full-Height Character Skin Showcase & Pedestal */}
            <div
              onClick={onOpenCharModal}
              title="Нажмите, чтобы открыть окно персонажа и амуниции"
              className="group relative flex h-full flex-1 min-w-[76px] max-w-[122px] cursor-pointer flex-col items-center justify-between rounded-xl border-2 border-amber-500/60 bg-gradient-to-b from-amber-950/60 via-[#150c1f]/95 to-black/95 px-1.5 py-1 shadow-[inset_0_0_20px_rgba(245,158,11,0.25),0_0_10px_rgba(0,0,0,0.8)] hover:border-amber-400 transition-all"
            >
              {/* Decorative Header with Nickname & Level */}
              <div className="w-full flex items-center justify-between gap-1 border-b border-amber-500/25 pb-0.5 shrink-0 z-10">
                <span className="truncate text-[7.5px] font-black text-amber-300 leading-none">
                  {heroIsPremium ? '👑 ' : ''}{myNick}
                </span>
                <span className="shrink-0 rounded bg-amber-500/20 border border-amber-400/40 px-1 py-[0.5px] text-[6.5px] font-black text-amber-200 leading-none">
                  {heroLevel} ур.
                </span>
              </div>

              {/* Full-Body Character Sprite in Full Height (в полный рост) */}
              <div className="relative flex flex-1 w-full min-h-0 items-center justify-center my-0.5 overflow-hidden">
                {/* Golden/Purple Royal Aura behind full-body figure */}
                <div className="pointer-events-none absolute inset-1.5 rounded-full bg-gradient-to-b from-amber-500/25 via-purple-500/20 to-transparent blur-md" />

                <div className="relative z-10 flex h-full w-full items-center justify-center p-0.5 transition-transform duration-200 group-hover:scale-105">
                  <CharacterAvatar
                    avatar={heroAvatar}
                    nick={currentUser}
                    fullBody={true}
                    size="full"
                    className="w-full h-full max-h-[118px] sm:max-h-[132px] object-contain"
                  />
                </div>

                {/* Glowing Stone Pedestal Ring under feet */}
                <div className="pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4/5 h-2 rounded-full bg-gradient-to-r from-transparent via-amber-400/50 to-transparent blur-[0.5px] border-b border-amber-400/70" />
              </div>

              {/* Pedestal Footer */}
              <div className="w-full rounded bg-gradient-to-r from-amber-950/90 via-purple-950/90 to-amber-950/90 border border-amber-500/40 py-[1.5px] text-center text-[6.5px] font-black uppercase tracking-wider text-amber-200 shrink-0 z-10 group-hover:text-white">
                🛡️ Персонаж
              </div>
            </div>

            {/* Right Column of Square Slots: Top [Штаны], Middle [Сапоги], Bottom [Кольцо] */}
            <div className="flex flex-col items-center justify-between gap-1 py-0.5 shrink-0">
              {renderEquipSlot('pants', 'Штаны')}
              {renderEquipSlot('boots', 'Сапоги')}
              {renderEquipSlot('ring', 'Кольцо')}
            </div>
          </div>

          {/* Expand Chat Arrow Button docked on the right edge of the collapsed area */}
          <button
            type="button"
            onClick={() => setIsChatCollapsed(false)}
            className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-amber-500/70 bg-gradient-to-b from-amber-900/85 via-amber-950 to-slate-950 px-2 py-2 text-[9px] font-black text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)] hover:border-amber-400 hover:text-white active:scale-95 shrink-0 cursor-pointer"
            title="Развернуть чат обратно"
          >
            <span className="text-xs leading-none">◀</span>
            <span className="uppercase tracking-wider text-[7px]">Чат</span>
            {combatLog.length > 0 && (
              <span className="rounded-full bg-red-600 px-1 text-[6.5px] font-black text-white">
                {combatLog.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Right Online Block (45% — ALWAYS VISIBLE, never hidden!) */}
      <div className="flex w-[45%] min-w-0 flex-col bg-slate-900/60 p-1.5 text-[10px]">
        <div className="mb-1 border-b border-slate-800 pb-1 flex items-center justify-between font-bold text-amber-400 text-[9.5px] shrink-0">
          <span>🟢 В игре: {onlinePlayers.length}</span>
          <div
            title={`Supabase Realtime: ${realtimeStatus}`}
            className="flex items-center gap-1 rounded bg-slate-800/90 px-1 py-0.5 text-[7px] text-slate-300"
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                realtimeStatus === 'SUBSCRIBED'
                  ? 'bg-emerald-400 animate-pulse'
                  : realtimeStatus === 'CONNECTING'
                  ? 'bg-yellow-400 animate-pulse'
                  : realtimeStatus === 'CHANNEL_ERROR'
                  ? 'bg-red-400'
                  : 'bg-emerald-400'
              }`}
            />
            <span className="font-mono">Live</span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
          {onlinePlayers.map((player) => {
            const display = getPlayerDisplay(player.nick);
            const inPyramid = player.inPyramid;
            const strictTier = getPyramidTierForLevel(player.lvl);
            const pyrBadge = getPyramidBadgeStyle(strictTier);
            return (
              <div
                key={player.nick}
                onClick={() => onInspectPlayer(player.nick)}
                className="flex items-center justify-between gap-1 cursor-pointer rounded border border-slate-800/60 bg-slate-950/50 px-1.5 py-1 hover:bg-slate-800/80"
                title={`${player.isPremium ? '👑 VIP ' : ''}${player.nick} (${player.lvl} ур.) • ${pyrBadge.fullTitle} • ${
                  inPyramid ? `⚔️ Внутри Пирамиды ${strictTier}` : '🏠 В главном городе'
                }`}
              >
                <div className="flex items-center gap-1 min-w-0 flex-1 flex-wrap">
                  {/* Location icon BEFORE the status circle: 🏠 if in city, ⚔️ if inside pyramid */}
                  <span
                    className="text-[10px] leading-none shrink-0"
                    title={inPyramid ? `Бегает в Пирамиде ${strictTier}` : 'В главном городе'}
                  >
                    {inPyramid ? '⚔️' : '🏠'}
                  </span>
                  {/* Status circle */}
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
                  </span>
                  {/* Clan badge before nick */}
                  {renderClanBadge(getPlayerClanBadge(player.nick))}
                  {/* Golden Crown + Full Nickname without cutting off */}
                  <span
                    className="font-bold text-[9.5px] leading-tight break-all"
                    style={{ color: display.color }}
                  >
                    {player.isPremium ? '👑 ' : ''}{player.nick}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Pyramid Badge strictly bound to player's level (1-5 -> П1, 6-10 -> П2, 11-20 -> П3) */}
                  <span
                    className={`rounded border px-1 py-0.5 text-[8px] font-black leading-none ${pyrBadge.className}`}
                    title={pyrBadge.fullTitle}
                  >
                    {pyrBadge.label}
                  </span>
                  {/* Player actual level with Crown if VIP */}
                  <span className="rounded bg-amber-500/15 border border-amber-500/40 px-1 py-0.5 text-[8.5px] font-extrabold text-amber-300 leading-none">
                    {player.isPremium ? '👑 ' : ''}{player.lvl} ур.
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

