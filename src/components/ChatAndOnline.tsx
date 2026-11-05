import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, FriendEntry, CombatLogEntry, EquippedGear, ItemSlot, PrivateMessage } from '../types/game';
import { SLOT_INFO, getQualityConfig, getPyramidTierForLevel } from '../utils/gameData';
import { RealtimePlayer, RealtimeConnectionStatus, isPlayerOnlineByHeartbeat } from '../utils/supabase';
import { getPlayerClan } from '../utils/clanStorage';
import CharacterAvatar from './CharacterAvatar';
import { ItemIcon } from './ItemIcon';

interface ChatAndOnlineProps {
  messages: ChatMessage[];
  friends: FriendEntry[];
  activeChannel: 'world' | 'general' | 'private' | 'combatLog';
  combatLog?: CombatLogEntry[];
  mailMessages?: PrivateMessage[];
  unreadMailCount?: number;
  playersInPyramid?: string[];
  heroLocation?: 'pyramid' | 'city';
  heroPyramidTier?: number;
  currentUser?: string | null;
  isAdmin?: boolean;
  isModerator?: boolean;
  heroRole?: 'admin' | 'mod' | 'winner' | 'regular';
  heroLevel?: number;
  heroAvatar?: string;
  heroIsPremium?: boolean;
  heroSeasonTitleId?: 'sand_explorer' | 'season_pharaoh' | null;
  equipped?: EquippedGear;
  onOpenCharModal?: () => void;
  onOpenMailModal?: () => void;
  onOpenTradeProtocol?: () => void;
  realtimePlayers?: RealtimePlayer[];
  realtimeStatus?: RealtimeConnectionStatus;
  onSwitchChannel: (channel: 'world' | 'general' | 'private' | 'combatLog') => void;
  onClearCombatLog?: () => void;
  onSendMessage: (text: string) => void;
  onSendMail?: (targetNick: string, text: string) => void;
  onMarkMailRead?: (senderNick?: string) => void;
  onDeleteMessage?: (msgId: string) => void;
  onClearRecentChat?: (minutes?: number) => void;
  onMutePlayerInChat?: (targetNick: string, durationMinutes: number, reason?: string) => void;
  onOpenModPanel?: () => void;
  onInspectPlayer: (nick: string) => void;
}

export const ChatAndOnline: React.FC<ChatAndOnlineProps> = ({
  messages,
  activeChannel,
  combatLog = [],
  mailMessages = [],
  unreadMailCount = 0,
  playersInPyramid = [],
  heroLocation = 'city',
  heroPyramidTier = 1,
  currentUser,
  isAdmin = false,
  isModerator = false,
  heroRole,
  heroLevel = 1,
  heroAvatar = '🧙‍♂️',
  heroIsPremium = false,
  heroSeasonTitleId = null,
  equipped,
  onOpenCharModal,
  onOpenMailModal,
  onOpenTradeProtocol,
  realtimePlayers = [],
  realtimeStatus = 'CONNECTING',
  onSwitchChannel,
  onClearCombatLog,
  onSendMessage,
  onSendMail,
  onMarkMailRead,
  onDeleteMessage,
  onClearRecentChat,
  onMutePlayerInChat,
  onOpenModPanel,
  onInspectPlayer
}) => {
  const [inputText, setInputText] = useState('');
  const [pmRecipient, setPmRecipient] = useState('');
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [combatLogFilter, setCombatLogFilter] = useState<'all' | 'crit' | 'miss' | 'hit' | 'loot'>('all');
  const [quickMuteTarget, setQuickMuteTarget] = useState<string | null>(null);
  const [quickMuteMinutes, setQuickMuteMinutes] = useState<number>(15);
  const [quickMuteReason, setQuickMuteReason] = useState<string>('Нарушение правил чата');
  const [showEmojiGifPicker, setShowEmojiGifPicker] = useState<boolean>(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'gif'>('emoji');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const CHAT_EMOJIS = React.useMemo(
    () => [
      '😊', '😂', '🤣', '😎', '🤩', '🥳', '😉', '🤔',
      '😡', '😱', '😭', '🫡', '👍', '🤝', '🙏', '💪',
      '🔥', '⚡', '❤️', '🌟', '⚔️', '🛡️', '🏹', '🗡️',
      '👑', '💎', '🪙', '🏆', '🥇', '🥈', '🥉', '🎰',
      '🎣', '🐟', '🦈', '🐊', '🦂', '🐍', '🐪', '🏺'
    ],
    []
  );

  const CHAT_GIF_STICKERS = React.useMemo(
    () => [
      {
        id: 'pharaoh_dance',
        code: '[GIF:pharaoh_dance]',
        icon: '🕺👑',
        label: 'Танец Фараона',
        subtitle: 'Победный вайб!',
        bgCls: 'from-amber-950/95 via-yellow-900/70 to-amber-950/95 border-amber-400/80 text-yellow-200',
        animCls: 'animate-bounce'
      },
      {
        id: 'golden_fish',
        code: '[GIF:golden_fish]',
        icon: '🎣🐟✨',
        label: 'Царский Улов!',
        subtitle: 'Золотая рыба на крючке',
        bgCls: 'from-sky-950/95 via-cyan-900/70 to-blue-950/95 border-cyan-400/80 text-cyan-200',
        animCls: 'animate-pulse'
      },
      {
        id: 'jackpot_spin',
        code: '[GIF:jackpot_spin]',
        icon: '🎰💎🔥',
        label: 'ДЖЕКПОТ!',
        subtitle: 'Фортуна улыбнулась',
        bgCls: 'from-purple-950/95 via-fuchsia-900/70 to-amber-950/95 border-fuchsia-400/80 text-fuchsia-200',
        animCls: 'animate-bounce'
      },
      {
        id: 'sword_clash',
        code: '[GIF:sword_clash]',
        icon: '⚔️💥🛡️',
        label: 'В Бой!',
        subtitle: 'Жду в Пирамиде!',
        bgCls: 'from-red-950/95 via-rose-900/70 to-slate-950/95 border-red-400/80 text-red-200',
        animCls: 'animate-pulse'
      },
      {
        id: 'cheers_gold',
        code: '[GIF:cheers_gold]',
        icon: '🍻🪙🎉',
        label: 'За Удачу!',
        subtitle: 'Золото рекой',
        bgCls: 'from-emerald-950/95 via-teal-900/70 to-slate-950/95 border-emerald-400/80 text-emerald-200',
        animCls: 'animate-bounce'
      },
      {
        id: 'laugh_tears',
        code: '[GIF:laugh_tears]',
        icon: '😂🤣💀',
        label: 'ХА-ХА-ХА!',
        subtitle: 'Ржу до слёз',
        bgCls: 'from-amber-950/95 via-orange-900/70 to-slate-950/95 border-orange-400/80 text-orange-200',
        animCls: 'animate-bounce'
      },
      {
        id: 'anubis_rage',
        code: '[GIF:anubis_rage]',
        icon: '🐺⚡🔥',
        label: 'Гнев Анубиса',
        subtitle: 'Пощады не будет!',
        bgCls: 'from-indigo-950/95 via-purple-900/75 to-slate-950/95 border-indigo-400/80 text-indigo-200',
        animCls: 'animate-pulse'
      },
      {
        id: 'scarab_luck',
        code: '[GIF:scarab_luck]',
        icon: '🪲✨🍀',
        label: 'Скарабей Удачи',
        subtitle: '+100% к везению',
        bgCls: 'from-lime-950/95 via-emerald-900/70 to-slate-950/95 border-lime-400/80 text-lime-200',
        animCls: 'animate-bounce'
      },
      {
        id: 'treasure_chest',
        code: '[GIF:treasure_chest]',
        icon: '🧰💎👑',
        label: 'Сундук Сокровищ',
        subtitle: 'Богатый дроп!',
        bgCls: 'from-yellow-950/95 via-amber-900/75 to-slate-950/95 border-yellow-400/80 text-yellow-200',
        animCls: 'animate-pulse'
      },
      {
        id: 'gg_victory',
        code: '[GIF:gg_victory]',
        icon: '🏆🔥🫡',
        label: 'GG WP!',
        subtitle: 'Чистая победа',
        bgCls: 'from-cyan-950/95 via-sky-900/75 to-slate-950/95 border-sky-400/80 text-sky-200',
        animCls: 'animate-bounce'
      }
    ],
    []
  );

  const renderChatTextOrGif = React.useCallback(
    (rawText: string) => {
      const trimmed = String(rawText || '').trim();
      const matchedSticker = CHAT_GIF_STICKERS.find((s) => trimmed === s.code || trimmed.includes(s.code));
      if (matchedSticker) {
        const extraText = trimmed.replace(matchedSticker.code, '').trim();
        return (
          <span className="inline-flex flex-col gap-0.5 align-middle my-0.5">
            {extraText && <span className="text-slate-200">{extraText}</span>}
            <span
              className={`relative inline-flex items-center gap-2 rounded-lg border bg-gradient-to-r px-2 py-1 shadow-[0_0_10px_rgba(0,0,0,0.6)] ${matchedSticker.bgCls}`}
            >
              <span className="rounded bg-black/50 border border-white/20 px-1 py-[0.5px] text-[6.5px] font-black uppercase tracking-wider text-white">
                GIF
              </span>
              <span className={`text-sm leading-none ${matchedSticker.animCls}`}>
                {matchedSticker.icon}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[9px] font-black">{matchedSticker.label}</span>
                <span className="text-[7.5px] opacity-85">{matchedSticker.subtitle}</span>
              </span>
            </span>
          </span>
        );
      }

      if (/^https?:\/\/\S+\.gif(\?\S+)?$/i.test(trimmed)) {
        return (
          <span className="inline-block my-0.5">
            <img
              src={trimmed}
              alt="GIF"
              className="max-h-20 max-w-[150px] rounded-lg border border-sky-500/40 object-contain"
            />
          </span>
        );
      }

      return <span>{rawText}</span>;
    },
    [CHAT_GIF_STICKERS]
  );

  const handleSendGifSticker = (stickerCode: string) => {
    setShowEmojiGifPicker(false);
    if (activeChannel === 'combatLog') return;
    if (activeChannel === 'private') {
      const target = pmRecipient.trim();
      if (!target || !onSendMail) {
        setInputText((prev) => `${prev} ${stickerCode}`.trim());
        return;
      }
      onSendMail(target, stickerCode);
      return;
    }
    onSendMessage(stickerCode);
  };

  const handleInsertEmoji = (emoji: string) => {
    setInputText((prev) => `${prev}${emoji}`);
  };

  const classifyCombatEntry = React.useCallback(
    (entry: CombatLogEntry): 'crit' | 'miss' | 'hit' | 'loot' => {
      const txt = (entry.text || '').toLowerCase();
      if (
        entry.type === 'miss' ||
        entry.damageType === 'miss' ||
        txt.includes('уклонил') ||
        txt.includes('промах') ||
        txt.includes('уворот') ||
        txt.includes('💨')
      ) {
        return 'miss';
      }
      if (
        entry.type === 'crit' ||
        entry.damageType === 'crit' ||
        txt.includes('крит') ||
        txt.includes('оглуш') ||
        txt.includes('💫') ||
        txt.includes('убийство') ||
        txt.includes('👑') ||
        entry.type === 'kill'
      ) {
        return 'crit';
      }
      if (entry.type === 'loot' || entry.type === 'potion') {
        return 'loot';
      }
      return 'hit';
    },
    []
  );

  const combatCounts = React.useMemo(() => {
    let crit = 0;
    let miss = 0;
    let hit = 0;
    let loot = 0;
    combatLog.forEach((e) => {
      const cat = classifyCombatEntry(e);
      if (cat === 'crit') crit++;
      else if (cat === 'miss') miss++;
      else if (cat === 'loot') loot++;
      else hit++;
    });
    return { all: combatLog.length, crit, miss, hit, loot };
  }, [combatLog, classifyCombatEntry]);

  const filteredCombatLog = React.useMemo(() => {
    if (combatLogFilter === 'all') return combatLog;
    return combatLog.filter((e) => classifyCombatEntry(e) === combatLogFilter);
  }, [combatLog, combatLogFilter, classifyCombatEntry]);

  const myNick = currentUser || 'Игрок';
  const myCleanNick = myNick.trim().toLowerCase();

  // Compute personal private messages (incoming + outgoing) sorted chronologically for chat view
  const myPrivateMessages = React.useMemo(() => {
    if (!myCleanNick) return [];
    return mailMessages
      .filter((m) => {
        const fromLower = String(m.from || '').trim().toLowerCase();
        const toLower = String(m.to || '').trim().toLowerCase();
        return fromLower === myCleanNick || toLower === myCleanNick;
      })
      .sort((a, b) => {
        const timeA = typeof a.time === 'number' ? a.time : (a.timestamp || 0);
        const timeB = typeof b.time === 'number' ? b.time : (b.timestamp || 0);
        return timeA - timeB;
      });
  }, [mailMessages, myCleanNick]);

  // Count unread incoming private messages from other players
  const unreadIncomingCount = React.useMemo(() => {
    if (!myCleanNick) return 0;
    return mailMessages.filter((m) => {
      const toLower = String(m.to || '').trim().toLowerCase();
      return toLower === myCleanNick && !m.read;
    }).length;
  }, [mailMessages, myCleanNick]);

  const unreadBadgeCount = Math.max(unreadIncomingCount, unreadMailCount || 0);

  // Auto-prefill recipient with the last person who wrote to us if pmRecipient is empty
  useEffect(() => {
    if (!pmRecipient && myPrivateMessages.length > 0) {
      for (let i = myPrivateMessages.length - 1; i >= 0; i--) {
        const msg = myPrivateMessages[i];
        const fromLower = String(msg.from || '').trim().toLowerCase();
        const other = fromLower === myCleanNick ? msg.to : msg.from;
        if (other && other.trim().toLowerCase() !== myCleanNick) {
          setPmRecipient(other.trim());
          break;
        }
      }
    }
  }, [myPrivateMessages, myCleanNick, pmRecipient]);

  // Re-evaluate heartbeat timeout every 12 seconds so disconnected players drop off "В игре" smoothly without micro-stutter
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  const chatHidden = isChatCollapsed;

  // Filter messages per channel.
  // In 'world' (Мир) channel: ONLY show what real people write and Roulette Skin wins! No AI tips or other system messages.
  const filteredMessages = React.useMemo(() => {
    return messages.filter((m) => {
      if (m.channel !== activeChannel) return false;
      if (activeChannel === 'world') {
        const authorClean = String(m.author || '').trim().toLowerCase();
        const textLower = String(m.text || '').toLowerCase();

        // Exclude any AI advice or bot tips
        if (
          authorClean.includes('ии') ||
          authorClean.includes('совет') ||
          authorClean === 'ai' ||
          textLower.includes('совет от ии') ||
          textLower.includes('ии-советник')
        ) {
          return false;
        }

        // Check if this is a Roulette announcement or system/rare loot message
        const isRouletteOrRareMsg =
          authorClean === 'рулетка' ||
          Boolean(m.isRareLoot) ||
          textLower.includes('рулетке фараона') ||
          textLower.includes('🎰');

        if (isRouletteOrRareMsg) {
          // Only allow in 'world' chat if the won prize is a Skin (скин)
          return textLower.includes('скин');
        }

        // Exclude any other system messages in 'world' chat
        if (m.isSystem || authorClean === 'система') {
          return false;
        }

        return true;
      }
      return true;
    });
  }, [messages, activeChannel]);

  // Auto-scroll chat or private messages to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current && activeChannel !== 'combatLog' && !chatHidden) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [filteredMessages, myPrivateMessages.length, activeChannel, chatHidden]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || activeChannel === 'combatLog') return;
    if (activeChannel === 'private') {
      const target = pmRecipient.trim();
      if (!target || !onSendMail) return;
      onSendMail(target, inputText.trim());
      setInputText('');
      return;
    }
    onSendMessage(inputText.trim());
    setInputText('');
  };
  const canModerateChat = Boolean(isAdmin || isModerator);

  const myPyramidTier = Math.max(1, Math.min(3, Number(heroPyramidTier || 1))) as 1 | 2 | 3;

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

  // Fast O(1) player lookup dictionary
  const playersLookupMap = React.useMemo(() => {
    const map = new Map<string, RealtimePlayer>();
    if (realtimePlayers && realtimePlayers.length > 0) {
      realtimePlayers.forEach((p) => {
        map.set(p.nick.toLowerCase(), p);
      });
    }
    return map;
  }, [realtimePlayers]);

  // 2. Add real players from Supabase Realtime whose Heartbeat (lastSeen) is fresh (<20s)
  if (realtimePlayers && realtimePlayers.length > 0) {
    realtimePlayers.forEach((rp) => {
      const lowerNick = rp.nick.toLowerCase();
      if (lowerNick === myNick.toLowerCase()) return;
      const isFreshOnline =
        rp.lastSeen !== undefined && rp.lastSeen > 0
          ? isPlayerOnlineByHeartbeat(rp.isOnline, rp.lastSeen) && nowTick - rp.lastSeen < 20000
          : false;
      if (isFreshOnline) {
        const inPyr = rp.location === 'pyramid' || playersInPyramid.includes(rp.nick);
        const rpPrem = Boolean(
          rp.isPremium && (!rp.premiumUntil || rp.premiumUntil > nowTick)
        );
        const actualLvl = Math.max(1, Number(rp.lvl || 1));
        const strictTier = Math.max(1, Math.min(3, Number(rp.pyramidTier || rp.homePyramidTier || 1))) as 1 | 2 | 3;
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
    const rp = playersLookupMap.get(clean);
    return Boolean(rp?.isPremium && (!rp.premiumUntil || rp.premiumUntil > nowTick));
  };

  const getPlayerPyramidTier = (name: string): 1 | 2 | 3 => {
    const clean = name.replace(/✉️.*для\s*/, '').trim().toLowerCase();
    if (clean === myNick.toLowerCase()) return myPyramidTier;
    const rp = playersLookupMap.get(clean);
    return Math.max(1, Math.min(3, Number(rp?.pyramidTier || rp?.homePyramidTier || 1))) as 1 | 2 | 3;
  };

  const getPlayerClanBadge = (name: string): { tag: string; emblem: string } | null => {
    const clean = name.replace(/✉️.*для\s*/, '').trim();
    const clan = getPlayerClan(clean);
    if (clan) return { tag: clan.tag, emblem: clan.emblem };
    const rp = playersLookupMap.get(clean.toLowerCase());
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

  const getPlayerSeasonTitle = (name: string): 'sand_explorer' | 'season_pharaoh' | null => {
    const clean = name.replace(/✉️.*для\s*/, '').trim().toLowerCase();
    if (clean === myNick.toLowerCase()) return heroSeasonTitleId || null;
    const rp = playersLookupMap.get(clean);
    if (!rp) return null;
    const until = Number(rp.seasonTitleUntil || rp.battlePass?.activeTitleUntil || 0);
    if (until <= nowTick) return null;
    return (rp.seasonTitleId || rp.battlePass?.activeTitleId || null) as 'sand_explorer' | 'season_pharaoh' | null;
  };

  const getPlayerDisplay = (name: string, msgAuthorRole?: 'admin' | 'mod' | 'winner' | 'regular') => {
    const lower = name.replace(/✉️.*для\s*/, '').trim().toLowerCase();
    const rp = realtimePlayers.find((p) => p.nick.toLowerCase() === lower);
    const isMod =
      msgAuthorRole === 'mod' ||
      rp?.role === 'mod' ||
      Number(rp?.is_admin) === 2 ||
      Number(rp?.isAdmin) === 2 ||
      (lower === myNick.toLowerCase() && (isModerator || heroRole === 'mod'));
    const isAdm =
      !isMod &&
      (msgAuthorRole === 'admin' ||
        rp?.role === 'admin' ||
        Number(rp?.is_admin) === 1 ||
        Number(rp?.isAdmin) === 1 ||
        (lower === myNick.toLowerCase() && (isAdmin || heroRole === 'admin')) ||
        ['redblack', 'redbyl', 'admin'].includes(lower));
    const tier = getPlayerPyramidTier(name);
    const lvl = lower === myNick.toLowerCase() ? heroLevel : Math.max(1, Number(rp?.lvl || 1));
    const seasonTitleId = getPlayerSeasonTitle(name);
    if (isAdm) {
      return { color: '#ef4444', title: '[Админ]', role: 'admin' as const, tier, lvl, seasonTitleId };
    }
    if (isMod) {
      return { color: '#10b981', title: '[Мод]', role: 'mod' as const, tier, lvl, seasonTitleId };
    }
    if (seasonTitleId === 'season_pharaoh') {
      return { color: '#fde047', title: '[Фараон Сезона]', role: 'regular' as const, tier, lvl, seasonTitleId };
    }
    if (seasonTitleId === 'sand_explorer') {
      return { color: '#e2e8f0', title: '[Исследователь Песков]', role: 'regular' as const, tier, lvl, seasonTitleId };
    }
    if (isPlayerVip(name)) {
      return { color: '#fde047', title: '', role: 'regular' as const, tier, lvl, seasonTitleId };
    }
    return { color: '#94a3b8', title: '', role: 'regular' as const, tier, lvl, seasonTitleId };
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

        {/* Item or default Egyptian slot icon */}
        <span
          className={`flex h-6 w-6 items-center justify-center text-base sm:text-lg leading-none drop-shadow ${
            item ? 'opacity-100 scale-105' : 'opacity-70 group-hover:opacity-95'
          }`}
        >
          {item ? (
            <ItemIcon
              icon={item.icon}
              alt={item.name}
              slot={slot}
              fallback={info.icon}
              imgClassName="w-full h-full object-contain"
            />
          ) : (
            <ItemIcon
              icon={info.icon}
              alt={info.name}
              slot={slot}
              imgClassName="w-full h-full object-contain"
            />
          )}
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
    <div
      data-tutorial="chat-combat-log"
      className="relative flex flex-[30] min-h-0 bg-slate-950 text-white border-t border-slate-800 overflow-hidden"
    >
      {/* Left Area: Either the Expanded Chat & Combat Log Block (55%) OR Interactive Full-Body Equipment Zone when collapsed */}
      {!chatHidden ? (
        <div className="flex w-[55%] min-w-0 flex-col border-r border-slate-800 px-1 pt-1.5 pb-1 transition-all duration-300 ease-in-out">
          {/* Chat, Private Messages & Combat Log Tabs + Collapse Chat Arrow Button */}
          <div className="flex items-center gap-1 mb-1 shrink-0 overflow-visible">
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
              onClick={() => {
                onSwitchChannel('private');
                if (unreadIncomingCount > 0 && onMarkMailRead) {
                  onMarkMailRead();
                }
              }}
              title={
                unreadBadgeCount > 0
                  ? `Личные сообщения и сделки (непрочитанных: ${unreadBadgeCount})`
                  : 'Личные сообщения и предложения сделок от игроков'
              }
              className={`relative flex flex-1 items-center justify-center gap-0.5 rounded py-0.5 px-1 text-[8.5px] font-bold transition-all ${
                activeChannel === 'private'
                  ? 'bg-amber-600 text-slate-950 font-black shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                  : unreadBadgeCount > 0
                  ? 'border border-amber-400/90 bg-gradient-to-r from-amber-950/90 via-red-950/80 to-amber-950/90 text-amber-200 shadow-[0_0_8px_rgba(239,68,68,0.45)] hover:text-white'
                  : 'border border-slate-800 bg-slate-900 text-amber-300/80 hover:text-amber-200'
              }`}
            >
              <span>✉️ ЛС</span>
              {unreadBadgeCount > 0 && (
                <span className="ml-0.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-600 px-1 text-[7px] font-black leading-none text-white ring-1 ring-amber-300 animate-bounce shadow-[0_0_8px_#ef4444]">
                  {unreadBadgeCount}
                </span>
              )}
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
            /* Personal Combat Log Tab Content with Damage Type Filtering */
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
              {/* Filter Bar by Damage Type (Критические удары, Промахи, Обычный урон, Добыча) */}
              <div className="mb-1 flex flex-wrap items-center justify-between gap-1 border-b border-slate-800/80 pb-1 shrink-0">
                <div className="flex flex-wrap items-center gap-0.5">
                  {[
                    {
                      id: 'all' as const,
                      label: 'Все',
                      count: combatCounts.all,
                      activeClass: 'bg-slate-700 text-white border-slate-500',
                      inactiveClass: 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-slate-200'
                    },
                    {
                      id: 'crit' as const,
                      label: '⚡ Крит',
                      title: 'Критические удары, оглушение и добивания',
                      count: combatCounts.crit,
                      activeClass: 'bg-amber-600 text-slate-950 border-amber-300 font-black shadow-[0_0_6px_rgba(245,158,11,0.5)]',
                      inactiveClass: 'bg-amber-950/40 text-amber-300/90 border-amber-500/40 hover:bg-amber-900/50'
                    },
                    {
                      id: 'miss' as const,
                      label: '💨 Промахи',
                      title: 'Промахи врагов и ваши уклонения',
                      count: combatCounts.miss,
                      activeClass: 'bg-cyan-600 text-slate-950 border-cyan-300 font-black shadow-[0_0_6px_rgba(6,182,212,0.5)]',
                      inactiveClass: 'bg-cyan-950/40 text-cyan-300/90 border-cyan-500/40 hover:bg-cyan-900/50'
                    },
                    {
                      id: 'hit' as const,
                      label: '⚔️ Урон',
                      title: 'Обычные удары и полученный урон',
                      count: combatCounts.hit,
                      activeClass: 'bg-rose-600 text-white border-rose-400 font-black',
                      inactiveClass: 'bg-rose-950/30 text-rose-300/80 border-rose-500/30 hover:bg-rose-900/40'
                    },
                    {
                      id: 'loot' as const,
                      label: '🎁 Трофеи',
                      title: 'Дроп зелий и ценные находки',
                      count: combatCounts.loot,
                      activeClass: 'bg-emerald-600 text-slate-950 border-emerald-300 font-black',
                      inactiveClass: 'bg-emerald-950/30 text-emerald-300/80 border-emerald-500/30 hover:bg-emerald-900/40'
                    }
                  ].map((tab) => {
                    const isActive = combatLogFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCombatLogFilter(tab.id)}
                        title={tab.title || tab.label}
                        className={`rounded border px-1.5 py-0.5 text-[7.5px] font-bold transition-all cursor-pointer flex items-center gap-0.5 ${
                          isActive ? tab.activeClass : tab.inactiveClass
                        }`}
                      >
                        <span>{tab.label}</span>
                        {tab.count > 0 && (
                          <span className="opacity-85 font-mono text-[7px]">({tab.count})</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {combatLog.length > 0 && onClearCombatLog && (
                  <button
                    type="button"
                    onClick={onClearCombatLog}
                    title="Очистить боевой лог"
                    className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[7.5px] font-bold text-slate-400 hover:text-white active:scale-95 shrink-0 cursor-pointer"
                  >
                    🗑️ Очистить
                  </button>
                )}
              </div>

              {/* Filtered Combat Log Entries */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 text-[9px] leading-snug">
                {combatLog.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-[9px] text-slate-500 italic px-2">
                    Лог боя пока пуст. Атакуйте монстров или игроков в Пирамиде (3⚡ за удар).
                  </div>
                ) : filteredCombatLog.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-[8.5px] text-slate-500 italic px-2 gap-1">
                    <span>В этой категории пока нет записей.</span>
                    <button
                      type="button"
                      onClick={() => setCombatLogFilter('all')}
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[8px] font-bold text-amber-300 hover:text-white not-italic cursor-pointer"
                    >
                      Показать все записи ({combatLog.length})
                    </button>
                  </div>
                ) : (
                  filteredCombatLog.map((entry) => {
                    const cat = classifyCombatEntry(entry);
                    return (
                      <div
                        key={entry.id}
                        className={`rounded border px-1.5 py-0.5 break-words ${
                          cat === 'miss'
                            ? 'border-cyan-500/50 bg-cyan-950/35 text-cyan-200 font-semibold'
                            : cat === 'crit'
                            ? 'border-amber-400/60 bg-gradient-to-r from-amber-950/50 to-red-950/40 text-amber-200 font-bold'
                            : entry.type === 'kill'
                            ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200 font-semibold'
                            : entry.type === 'loot'
                            ? 'border-amber-400/60 bg-amber-950/40 text-yellow-200 font-bold'
                            : entry.type === 'potion'
                            ? 'border-sky-500/40 bg-sky-950/30 text-sky-200 font-semibold'
                            : entry.type === 'pvp' || entry.type === 'damage_taken'
                            ? 'border-red-500/50 bg-red-950/40 text-red-200 font-semibold'
                            : 'border-slate-800 bg-slate-900/70 text-slate-200'
                        }`}
                      >
                        <span className="text-[7.5px] text-slate-400 font-mono mr-1">
                          [{entry.time}]
                        </span>
                        {cat === 'crit' && (
                          <span className="mr-1 inline-block rounded bg-amber-500/25 border border-amber-400/50 px-1 py-[0.5px] text-[6.5px] font-black uppercase text-amber-300">
                            ⚡ КРИТ
                          </span>
                        )}
                        {cat === 'miss' && (
                          <span className="mr-1 inline-block rounded bg-cyan-500/25 border border-cyan-400/50 px-1 py-[0.5px] text-[6.5px] font-black uppercase text-cyan-300">
                            💨 ПРОМАХ
                          </span>
                        )}
                        <span>{entry.text}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : activeChannel === 'private' ? (
            /* Private Messages (ЛС / Сделки) Tab Content */
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
              <div className="mb-1 flex items-center justify-between gap-1 border-b border-slate-800/80 pb-0.5 text-[8px] shrink-0">
                <span className="text-amber-300 font-bold truncate">
                  ✉️ Личные письма ({myPrivateMessages.length})
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {unreadIncomingCount > 0 && onMarkMailRead && (
                    <button
                      type="button"
                      onClick={() => onMarkMailRead()}
                      className="rounded border border-emerald-500/50 bg-emerald-950/80 px-1.5 py-0.5 text-[7.5px] font-bold text-emerald-300 hover:bg-emerald-900 cursor-pointer"
                    >
                      ✓ Прочитано
                    </button>
                  )}
                  {(onOpenMailModal || onOpenCharModal) && (
                    <button
                      type="button"
                      onClick={onOpenMailModal || onOpenCharModal}
                      className="rounded border border-amber-500/50 bg-amber-950/70 px-1.5 py-0.5 text-[7.5px] font-bold text-amber-200 hover:bg-amber-900 cursor-pointer"
                      title="Открыть полную почту и вложения"
                    >
                      📬 Почта
                    </button>
                  )}
                </div>
              </div>

              <div
                ref={chatScrollRef}
                className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 text-[9px] leading-snug"
              >
                {myPrivateMessages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-[8.5px] text-slate-500 italic px-2">
                    Личных писем пока нет. Нажмите на ник игрока или введите получателя внизу, чтобы обсудить сделку.
                  </div>
                ) : (
                  myPrivateMessages.map((pm, idx) => {
                    const isIncoming = String(pm.to || '').trim().toLowerCase() === myCleanNick;
                    const otherNick = isIncoming ? pm.from : pm.to;
                    const isUnread = isIncoming && !pm.read;
                    const hasGift = Boolean(pm.gift);
                    const timeStr =
                      pm.timeStr ||
                      (typeof pm.time === 'number'
                        ? new Date(pm.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : String(pm.time || ''));

                    return (
                      <div
                        key={pm.id || `${pm.from}_${pm.to}_${idx}`}
                        onClick={() => {
                          if (otherNick && otherNick.trim().toLowerCase() !== myCleanNick) {
                            setPmRecipient(otherNick.trim());
                          }
                          if (isUnread && onMarkMailRead) {
                            onMarkMailRead(pm.from);
                          }
                        }}
                        className={`cursor-pointer rounded border px-1.5 py-0.5 break-words transition-colors ${
                          isUnread
                            ? 'border-amber-400/80 bg-amber-950/50 text-amber-100 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                            : isIncoming
                            ? 'border-sky-500/35 bg-slate-900/90 text-slate-200 hover:border-sky-400/60'
                            : 'border-slate-800 bg-slate-950/80 text-slate-300 hover:border-slate-700'
                        }`}
                        title={`Нажмите, чтобы ответить игроку ${otherNick}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-[7px] text-slate-400 font-mono shrink-0">[{timeStr}]</span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                onInspectPlayer(otherNick);
                              }}
                              className={`font-extrabold truncate hover:underline ${
                                isIncoming ? 'text-amber-300' : 'text-sky-300'
                              }`}
                            >
                              {isIncoming ? `📥 От ${pm.from}:` : `📤 Кому ${pm.to}:`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isUnread && (
                              <span className="rounded bg-red-600 px-1 py-[0.5px] text-[6.5px] font-black uppercase text-white animate-pulse">
                                НОВОЕ
                              </span>
                            )}
                            {hasGift && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onOpenMailModal) onOpenMailModal();
                                  else if (onOpenCharModal) onOpenCharModal();
                                }}
                                className="rounded bg-amber-500/25 border border-amber-400/60 px-1 py-[0.5px] text-[7px] font-black text-amber-200 hover:bg-amber-500 hover:text-slate-950"
                              >
                                🎁 Подарок
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-0.5 text-[9px] text-slate-100">
                          {renderChatTextOrGif(pm.text)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Emoji & GIF Sticker Popover for Private Messages */}
              {showEmojiGifPicker && (
                <div className="mt-1 rounded-lg border border-amber-500/60 bg-slate-950/98 p-1.5 shadow-xl shrink-0">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPickerTab('emoji')}
                        className={`rounded px-2 py-0.5 text-[8px] font-black cursor-pointer ${
                          pickerTab === 'emoji'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        😊 Смайлы
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickerTab('gif')}
                        className={`rounded px-2 py-0.5 text-[8px] font-black cursor-pointer ${
                          pickerTab === 'gif'
                            ? 'bg-sky-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        🎬 GIF Смайлы
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowEmojiGifPicker(false)}
                      className="rounded px-1 text-[8.5px] font-bold text-slate-400 hover:text-white cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  {pickerTab === 'emoji' ? (
                    <div className="grid grid-cols-10 gap-0.5 max-h-24 overflow-y-auto p-0.5">
                      {CHAT_EMOJIS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => handleInsertEmoji(em)}
                          className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-800 text-xs active:scale-90 cursor-pointer"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto p-0.5">
                      {CHAT_GIF_STICKERS.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleSendGifSticker(st.code)}
                          className={`flex items-center gap-1.5 rounded border bg-gradient-to-r px-1.5 py-1 text-left transition-transform hover:scale-[1.02] active:scale-95 cursor-pointer ${st.bgCls}`}
                        >
                          <span className={`text-xs shrink-0 ${st.animCls}`}>{st.icon}</span>
                          <span className="min-w-0 flex-1 truncate text-[8px] font-black">
                            {st.label}
                          </span>
                          <span className="rounded bg-black/50 px-1 text-[6px] font-black text-white">
                            GIF
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Private Message Send Form */}
              <form onSubmit={handleSubmit} className="mt-1 flex gap-1 shrink-0">
                <input
                  type="text"
                  value={pmRecipient}
                  onChange={(e) => setPmRecipient(e.target.value)}
                  placeholder="Кому (ник)..."
                  className="w-[30%] min-w-0 rounded border border-amber-500/40 bg-slate-900 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-300 outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowEmojiGifPicker((prev) => !prev)}
                  title="Смайлики и GIF-стикеры"
                  className={`rounded border px-1.5 py-0.5 text-[8.5px] font-black shrink-0 cursor-pointer transition-colors ${
                    showEmojiGifPicker
                      ? 'border-amber-400 bg-amber-500 text-slate-950'
                      : 'border-slate-700 bg-slate-900 text-amber-300 hover:border-amber-400'
                  }`}
                >
                  😊/GIF
                </button>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Личное письмо..."
                  className="flex-1 min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[9px] text-white outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={!pmRecipient.trim() || !inputText.trim()}
                  className="rounded bg-amber-600 px-2 py-0.5 text-[9.5px] font-black text-slate-950 hover:bg-amber-500 active:scale-95 disabled:opacity-40 shrink-0"
                >
                  📨
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Moderator / Admin Quick Chat Controls Bar */}
              {canModerateChat && (
                <div className={`mb-1 flex flex-col gap-1 rounded border bg-slate-900/95 px-1.5 py-1 shrink-0 ${
                  isAdmin ? 'border-red-500/40' : 'border-emerald-500/40'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span
                      className={`text-[7.5px] font-black uppercase tracking-wide ${
                        isAdmin ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {isAdmin ? '🔴 Админ' : '🟢 Модер (Мирный)'}
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      {onClearRecentChat && (
                        <button
                          type="button"
                          onClick={() => onClearRecentChat(3)}
                          title="Очистить сообщения чата только за последние 2–3 минуты (не весь чат)"
                          className="rounded border border-sky-500/60 bg-sky-950/90 px-1.5 py-0.5 text-[7.5px] font-extrabold text-sky-200 hover:bg-sky-800 hover:text-white active:scale-95 cursor-pointer"
                        >
                          🧹 Чистить (2–3 мин)
                        </button>
                      )}
                      {onMutePlayerInChat && (
                        <button
                          type="button"
                          onClick={() =>
                            setQuickMuteTarget((prev) => (prev !== null ? null : ''))
                          }
                          title="Временно забанить (замутить) игрока в чате"
                          className={`rounded border px-1.5 py-0.5 text-[7.5px] font-extrabold transition-colors cursor-pointer ${
                            quickMuteTarget !== null
                              ? 'border-red-400 bg-red-600 text-white'
                              : 'border-red-500/60 bg-red-950/80 text-red-200 hover:bg-red-900'
                          }`}
                        >
                          🔇 Бан чата
                        </button>
                      )}
                      {onOpenModPanel && (
                        <button
                          type="button"
                          onClick={onOpenModPanel}
                          title="Открыть панель управления полномочиями и модерацией"
                          className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[7.5px] font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
                        >
                          ⚙️ Панель
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Temporary Chat Mute Form */}
                  {quickMuteTarget !== null && onMutePlayerInChat && (
                    <div className="mt-0.5 flex flex-col gap-1 border-t border-slate-800 pt-1 text-[8px]">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={quickMuteTarget}
                          onChange={(e) => setQuickMuteTarget(e.target.value)}
                          placeholder="Ник игрока..."
                          className="w-[38%] min-w-0 rounded border border-red-500/50 bg-slate-950 px-1.5 py-0.5 text-[8px] font-bold text-red-200 outline-none"
                        />
                        <input
                          type="text"
                          value={quickMuteReason}
                          onChange={(e) => setQuickMuteReason(e.target.value)}
                          placeholder="Причина бана чата..."
                          className="flex-1 min-w-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[8px] text-slate-200 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setQuickMuteTarget(null)}
                          className="rounded bg-slate-800 px-1 py-0.5 text-[7.5px] text-slate-400 hover:text-white cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <div className="flex flex-wrap items-center gap-0.5">
                          {[
                            { label: '5м', mins: 5 },
                            { label: '15м', mins: 15 },
                            { label: '30м', mins: 30 },
                            { label: '1ч', mins: 60 },
                            { label: '3ч', mins: 180 },
                            { label: '24ч', mins: 1440 }
                          ].map((p) => (
                            <button
                              key={p.mins}
                              type="button"
                              onClick={() => setQuickMuteMinutes(p.mins)}
                              className={`rounded border px-1 py-0.5 text-[7px] font-bold cursor-pointer ${
                                quickMuteMinutes === p.mins
                                  ? 'border-amber-400 bg-amber-500 text-slate-950 font-black'
                                  : 'border-slate-700 bg-slate-900 text-slate-300'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={!quickMuteTarget.trim()}
                          onClick={() => {
                            const clean = quickMuteTarget.trim();
                            if (!clean) return;
                            onMutePlayerInChat(
                              clean,
                              quickMuteMinutes,
                              quickMuteReason.trim() || 'Нарушение правил чата'
                            );
                            setQuickMuteTarget(null);
                          }}
                          className="rounded bg-red-600 px-2 py-0.5 text-[7.5px] font-black text-white hover:bg-red-500 disabled:opacity-40 cursor-pointer"
                        >
                          🔇 Забанить ({quickMuteMinutes >= 60 ? `${quickMuteMinutes / 60}ч` : `${quickMuteMinutes}м`})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Messages scroll box */}
              <div
                ref={chatScrollRef}
                className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 text-[9.5px] leading-tight"
              >
                {filteredMessages.map((msg) => {
                  const display = getPlayerDisplay(msg.author, msg.authorRole);
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

                  const isRentExpiredMsg =
                    Boolean(msg.isSystem) &&
                    (msg.id.startsWith('rent_exp_') || msg.text.includes('[Аренда]'));

                  if (isRentExpiredMsg) {
                    return (
                      <div
                        key={msg.id}
                        className="flex items-center justify-between gap-1.5 rounded border border-emerald-400/80 bg-gradient-to-r from-emerald-950/90 via-teal-950/60 to-slate-950 px-1.5 py-1 text-[9px] font-bold text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.3)] break-words"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[7.5px] text-emerald-300/80 mr-1">[{msg.time}]</span>
                          <span>{msg.text}</span>
                        </div>
                        {onOpenTradeProtocol && (
                          <button
                            type="button"
                            onClick={onOpenTradeProtocol}
                            className="shrink-0 rounded bg-emerald-500 px-1.5 py-0.5 text-[8px] font-black text-slate-950 hover:bg-emerald-400 active:scale-95 cursor-pointer"
                            title="Открыть Протокол Сделок и забрать предмет в сумку"
                          >
                            📜 Забрать
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
                              className={`cursor-pointer font-bold hover:underline ${
                                display.seasonTitleId === 'season_pharaoh'
                                  ? 'inline-flex items-center rounded border border-amber-400/90 bg-gradient-to-r from-amber-950 via-red-900 to-amber-950 px-1 py-[0.5px] text-yellow-300 shadow-[0_0_10px_rgba(239,68,68,0.65)] animate-pulse'
                                  : display.seasonTitleId === 'sand_explorer'
                                  ? 'inline-flex items-center rounded border border-slate-300/60 bg-slate-800/85 px-1 py-[0.5px] text-slate-200 shadow-[0_0_8px_rgba(203,213,225,0.55)] animate-pulse'
                                  : ''
                              }`}
                              style={
                                display.seasonTitleId
                                  ? undefined
                                  : { color: display.color }
                              }
                            >
                              {authorIsVip ? '👑 ' : ''}
                              {display.title ? `${display.title} ` : ''}
                              {msg.author}:
                            </span>{' '}
                            <span className="text-slate-200">
                              {renderChatTextOrGif(msg.text)}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {canModerateChat && !msg.isSystem && !isOwnMsg && onMutePlayerInChat && (
                          <button
                            type="button"
                            onClick={() =>
                              setQuickMuteTarget(msg.author.replace(/✉️.*для\s*/, '').trim())
                            }
                            title={`Забанить игрока ${msg.author} в чате на время`}
                            className="rounded bg-slate-900 border border-slate-700 px-1 text-[7.5px] font-bold text-amber-300 hover:border-amber-500 hover:bg-amber-950"
                          >
                            🔇
                          </button>
                        )}
                        {canDeleteMsg && (
                          <button
                            type="button"
                            onClick={() => onDeleteMessage && onDeleteMessage(msg.id)}
                            title="Удалить сообщение"
                            className="rounded bg-slate-900 border border-slate-700 px-1 text-[7.5px] font-bold text-red-400 hover:border-red-500 hover:bg-red-950 hover:text-red-200"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Emoji & Animated GIF Sticker Picker Panel */}
              {showEmojiGifPicker && (
                <div className="mt-1 rounded-lg border border-sky-500/60 bg-slate-950/98 p-1.5 shadow-xl shrink-0">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPickerTab('emoji')}
                        className={`rounded px-2 py-0.5 text-[8px] font-black cursor-pointer ${
                          pickerTab === 'emoji'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        😊 Смайлы
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickerTab('gif')}
                        className={`rounded px-2 py-0.5 text-[8px] font-black cursor-pointer ${
                          pickerTab === 'gif'
                            ? 'bg-sky-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        🎬 GIF Смайлы
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowEmojiGifPicker(false)}
                      className="rounded px-1 text-[8.5px] font-bold text-slate-400 hover:text-white cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {pickerTab === 'emoji' ? (
                    <div className="grid grid-cols-10 gap-0.5 max-h-24 overflow-y-auto p-0.5">
                      {CHAT_EMOJIS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => handleInsertEmoji(em)}
                          className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-800 text-xs active:scale-90 cursor-pointer"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto p-0.5">
                      {CHAT_GIF_STICKERS.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleSendGifSticker(st.code)}
                          className={`flex items-center gap-1.5 rounded border bg-gradient-to-r px-1.5 py-1 text-left transition-transform hover:scale-[1.02] active:scale-95 cursor-pointer ${st.bgCls}`}
                        >
                          <span className={`text-xs shrink-0 ${st.animCls}`}>{st.icon}</span>
                          <span className="min-w-0 flex-1 truncate text-[8px] font-black">
                            {st.label}
                          </span>
                          <span className="rounded bg-black/50 px-1 text-[6px] font-black text-white">
                            GIF
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Input box */}
              <form onSubmit={handleSubmit} className="mt-1 flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEmojiGifPicker((prev) => !prev)}
                  title="Отправить смайлик или анимированный GIF-стикер"
                  className={`rounded border px-1.5 py-0.5 text-[8.5px] font-black shrink-0 cursor-pointer transition-colors ${
                    showEmojiGifPicker
                      ? 'border-amber-400 bg-amber-500 text-slate-950'
                      : 'border-slate-700 bg-slate-900 text-amber-300 hover:border-sky-400'
                  }`}
                >
                  😊/GIF
                </button>
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
            {unreadBadgeCount > 0 && (
              <span
                className="rounded-full bg-red-600 px-1 py-[0.5px] text-[6.5px] font-black text-white ring-1 ring-amber-300 animate-bounce shadow-[0_0_8px_#ef4444]"
                title={`Непрочитанных писем: ${unreadBadgeCount}`}
              >
                📩 {unreadBadgeCount}
              </span>
            )}
            {combatLog.length > 0 && (
              <span className="rounded-full bg-red-600/80 px-1 text-[6.5px] font-black text-white">
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
                  {/* Golden Crown + Role Title + Full Nickname without cutting off */}
                  <span
                    className={`font-bold text-[9.5px] leading-tight break-all ${
                      display.seasonTitleId === 'season_pharaoh'
                        ? 'rounded border border-amber-400/90 bg-gradient-to-r from-amber-950 via-red-900 to-amber-950 px-1 py-[0.5px] text-yellow-300 shadow-[0_0_8px_rgba(239,68,68,0.65)] animate-pulse'
                        : display.seasonTitleId === 'sand_explorer'
                        ? 'rounded border border-slate-300/60 bg-slate-800/85 px-1 py-[0.5px] text-slate-200 shadow-[0_0_6px_rgba(203,213,225,0.55)] animate-pulse'
                        : ''
                    }`}
                    style={display.seasonTitleId ? undefined : { color: display.color }}
                  >
                    {player.isPremium ? '👑 ' : ''}
                    {display.title ? `${display.title} ` : ''}
                    {player.nick}
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

