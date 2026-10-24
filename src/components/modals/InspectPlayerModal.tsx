import React, { useState, useEffect } from 'react';
import {
  RealtimePlayer,
  findPlayerInSupabase,
  normalizeSupabasePlayer,
  isPlayerOnlineByHeartbeat
} from '../../utils/supabase';
import { EquippedGear, ItemSlot, TradeProtocolEntry } from '../../types/game';
import {
  SLOT_INFO,
  getQualityConfig,
  getPyramidTierForLevel,
  formatLastSeen,
  formatFullDateTime
} from '../../utils/gameData';
import {
  CharacterSkinTemplate,
  formatSkinBonusesText,
  getShopSkins,
  resolvePlayerOwnedSkins
} from '../../utils/shopConfig';
import {
  KILLER_LICENSE_CONFIG,
  KILLER_ACHIEVEMENT_LEVELS,
  KILLER_ACHIEVEMENT_DESCRIPTION,
  KILLER_ACHIEVEMENT_SVG,
  getKillerAchievementInfo,
  formatLicenseRemainingTime
} from '../../utils/egyptianEquipment';
import { ActiveVipBonusesBlock } from '../ActiveVipBonusesBlock';
import CharacterAvatar from '../CharacterAvatar';
import { ItemIcon } from '../ItemIcon';

interface InspectPlayerModalProps {
  nick: string | null;
  targetPlayer?: RealtimePlayer | null;
  shopSkins?: CharacterSkinTemplate[];
  isFriend?: boolean;
  onClose: () => void;
  onOpenTransferModal?: (targetNick: string) => void;
  onAddFriend?: (targetNick: string) => void;
  onSendSMS?: (targetNick: string, text: string) => void;
  onOpenItemTransfer?: (targetNick: string) => void;
  onAttackPvP?: (targetNick: string) => void;
  isHeroInPyramid?: boolean;
  isTargetInPyramid?: boolean;
}

const SLOTS_LIST: ItemSlot[] = ['weapon', 'armor', 'pants', 'boots', 'gloves', 'ring'];

export const InspectPlayerModal: React.FC<InspectPlayerModalProps> = ({
  nick,
  targetPlayer,
  shopSkins,
  isFriend = false,
  onClose,
  onOpenTransferModal,
  onAddFriend,
  onSendSMS,
  onOpenItemTransfer,
  onAttackPvP,
  isHeroInPyramid = false,
  isTargetInPyramid = false
}) => {
  const [tab, setTab] = useState<'protocol' | 'gear' | 'collection' | 'info' | 'sms'>('gear');
  const [smsText, setSmsText] = useState('');
  const [friendAdded, setFriendAdded] = useState(isFriend);
  const [livePlayer, setLivePlayer] = useState<RealtimePlayer | null>(targetPlayer || null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch latest player record from Supabase on open so protocol, gear, VIP, and online status are always fresh
  useEffect(() => {
    setFriendAdded(isFriend);
  }, [isFriend]);

  useEffect(() => {
    if (targetPlayer) {
      setLivePlayer(targetPlayer);
    }
    if (!nick) return;
    let mounted = true;
    setLoadingProfile(true);
    findPlayerInSupabase(nick)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          setLivePlayer(normalizeSupabasePlayer(raw));
        }
      })
      .finally(() => {
        if (mounted) setLoadingProfile(false);
      });
    return () => {
      mounted = false;
    };
  }, [nick, targetPlayer]);

  if (!nick) return null;

  const p = livePlayer || targetPlayer;

  // Determine role, title, and VIP status
  const isAdmin = p?.role === 'admin' || Number(p?.is_admin) === 1 || Number(p?.isAdmin) === 1;
  const isPrem = Boolean(
    isAdmin ||
      (p?.isPremium && (!p.premiumUntil || p.premiumUntil > Date.now()))
  );
  const level = Math.max(1, Number(p?.lvl || 1));
  const isOnline = Boolean(
    p?.lastSeen ? isPlayerOnlineByHeartbeat(p?.isOnline, p?.lastSeen) : p?.isOnline
  );
  const inPyramid = Boolean(p ? p.location === 'pyramid' : isTargetInPyramid);
  const pyramidTier = getPyramidTierForLevel(level);

  let roleColor = isPrem ? '#fde047' : '#94a3b8';
  let roleTitle = isPrem ? 'VIP Правитель Пирамиды' : 'Гражданин Пирамиды';
  let badgeText = '';

  if (isAdmin) {
    roleColor = '#fbbf24';
    roleTitle = 'Главный Администратор';
    badgeText = '[Администратор]';
  }
  const hp = p?.hp ?? 100;
  const maxHp = p?.maxHp ?? (100 + (level - 1) * 10);
  const str = p?.str ?? 5;
  const agi = p?.agi ?? 5;
  const vit = p?.vit ?? 5;

  const equippedObj: Partial<EquippedGear> = (p?.equipped as Partial<EquippedGear>) || {};
  let gearDmg = 0;
  let gearStr = 0;
  SLOTS_LIST.forEach((s) => {
    const it = equippedObj[s];
    if (it) {
      gearDmg += it.dmg || 0;
      gearStr += it.str || 0;
    }
  });

  const dmg = 12 + gearDmg + (str + gearStr) * 2;
  const mobsKilled = p?.mobsKilled ?? 0;
  const pvpKills = p?.pvpKills ?? 0;
  const deaths = p?.deaths ?? 0;
  const killerAch = getKillerAchievementInfo(pvpKills);
  const killerLicenseUntil = Number((p as any)?.killerLicenseUntil ?? (p as any)?.killer_license_until ?? 0);
  const isKillerLicenseActive = killerLicenseUntil > nowMs;

  const playerProtocol: TradeProtocolEntry[] = Array.isArray(p?.tradeProtocol)
    ? p!.tradeProtocol!
    : [];
  const repScore = playerProtocol.length * 10;

  const handleSendPrivateSms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsText.trim()) return;
    if (onSendSMS) {
      onSendSMS(nick, smsText.trim());
    }
    setSmsText('');
    setTab('protocol');
  };

  const handleAddFriendClick = () => {
    if (onAddFriend) {
      onAddFriend(nick);
      setFriendAdded(true);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-3 text-white">
      <div className="flex h-[92%] max-h-[600px] w-full max-w-sm flex-col rounded-xl border-2 border-slate-700 bg-slate-900 p-3 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-amber-400">🔍 Профиль игрока</span>
            {badgeText && (
              <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[8px] font-extrabold text-amber-300 border border-amber-500/40">
                {badgeText}
              </span>
            )}
            {loadingProfile && (
              <span className="text-[8px] text-slate-400 animate-pulse">Синхронизация...</span>
            )}
          </div>
          <button onClick={onClose} className="text-base font-bold text-red-400 hover:text-red-300">
            ✕
          </button>
        </div>

        {/* Profile Card Header */}
        <div className="mt-2 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-2.5">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-amber-400 bg-slate-800 text-2xl shadow p-1 overflow-hidden">
            <CharacterAvatar avatar={p?.avatar || (isAdmin ? '👑' : '🧙‍♂️')} nick={nick} className="w-full h-full object-contain" />
            {isPrem && (
              <span
                className="absolute -top-1 -right-1 text-xs animate-bounce"
                title="Премиум активен"
              >
                👑
              </span>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 ${
                isOnline ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]' : 'bg-slate-500'
              }`}
              title={isOnline ? 'Онлайн' : 'Оффлайн'}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="truncate text-sm font-black" style={{ color: roleColor }}>
                {isPrem ? '👑 ' : ''}
                {nick}
              </span>
              {isPrem ? (
                <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[8px] font-extrabold text-yellow-300 border border-yellow-500/50">
                  👑 Премиум (VIP)
                </span>
              ) : (
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[8px] font-semibold text-slate-400 border border-slate-700">
                  Без Премиума
                </span>
              )}
            </div>

            <div className="text-[10px] text-slate-300 font-semibold mt-0.5">
              {isPrem ? '👑 ' : ''}Уровень {level} • <span style={{ color: roleColor }}>{roleTitle}</span>
            </div>

            {/* Online / Offline Status + Pyramid Badge & Location Icon */}
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px]">
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/50 px-1.5 py-0.5 font-black text-amber-300">
                🔺 Пирамида {pyramidTier} ({pyramidTier === 1 ? '1–5' : pyramidTier === 2 ? '6–10' : '11–20'} ур.)
              </span>
              {isOnline ? (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 font-extrabold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  🟢 Онлайн • {inPyramid ? `⚔️ В Пирамиде ${pyramidTier}` : '🏠 В Городе'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-slate-800/90 border border-slate-700 px-1.5 py-0.5 font-bold text-slate-400">
                  ⚪ Оффлайн • {inPyramid ? `⚔️ В Пирамиде ${pyramidTier}` : '🏠 В Городе'}
                </span>
              )}
            </div>

            {/* Last login date and time */}
            <div className="mt-1 flex items-center gap-1.5 rounded bg-slate-900/90 px-2 py-0.5 border border-slate-800 text-[8.5px]">
              <span className="text-slate-400 font-medium">🕒 В сети:</span>
              <span className={`font-bold ${isOnline ? 'text-emerald-400' : 'text-amber-300'}`}>
                {isOnline ? '🟢 Сейчас в сети' : formatLastSeen(p?.lastSeen || p?.last_seen)}
              </span>
              {!isOnline && (p?.lastSeen || p?.last_seen) ? (
                <span className="text-[7.5px] text-slate-400 font-mono">
                  ({formatFullDateTime(p?.lastSeen || p?.last_seen)})
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2.5 text-[8.5px] text-slate-400 mt-1 flex-wrap">
              <span>❤️ {hp}/{maxHp} HP</span>
              <span>⚔️ {dmg} DMG</span>
              <span className="text-amber-300 font-bold">⭐ Репутация: {repScore}</span>
              <span className="rounded bg-red-950/90 border border-red-500/50 px-1.5 py-0.2 text-[8px] font-black text-red-200">
                🏆 Киллер: {killerAch.level}/5 ур. (+{killerAch.totalHpBonus} ❤️ HP)
              </span>
              {isKillerLicenseActive && (
                <span className="rounded bg-amber-950/90 border border-amber-400/60 px-1.5 py-0.2 text-[8px] font-black text-amber-300">
                  🗡️ Лицензия: {formatLicenseRemainingTime(killerLicenseUntil, nowMs)}
                </span>
              )}
            </div>

            {/* Баланс игрока (доступен для просмотра всем, редактирование только администраторам) */}
            <div className="flex items-center gap-3 text-[9px] font-extrabold mt-1 rounded bg-slate-900/90 px-2 py-0.5 border border-slate-800/80">
              <span className="text-amber-400">🪙 {p?.gold ?? 0} Золота</span>
              <span className="text-cyan-400">💎 {p?.crystals ?? 0} Кристаллов</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-2 flex gap-1 border-b border-slate-800 pb-1">
          <button
            onClick={() => setTab('protocol')}
            className={`flex-1 rounded py-1 text-[8.5px] font-bold transition-all ${
              tab === 'protocol'
                ? 'bg-emerald-500 text-slate-950 font-black'
                : 'border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
            }`}
          >
            📜 Протокол
          </button>
          <button
            onClick={() => setTab('gear')}
            className={`flex-1 rounded py-1 text-[8.5px] font-bold transition-all ${
              tab === 'gear'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
            }`}
          >
            🛡️ Одежда
          </button>
          <button
            onClick={() => setTab('collection')}
            className={`flex-1 rounded py-1 text-[8.5px] font-bold transition-all ${
              tab === 'collection'
                ? 'bg-purple-600 text-white font-black'
                : 'border border-slate-800 bg-slate-950 text-purple-300 hover:bg-slate-800'
            }`}
          >
            🎭 Скины ({Array.isArray(p?.ownedSkinIds) ? p.ownedSkinIds.length : 0})
          </button>
          <button
            onClick={() => setTab('info')}
            className={`flex-1 rounded py-1 text-[8.5px] font-bold transition-all ${
              tab === 'info'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
            }`}
          >
            📊 Статы
          </button>
          <button
            onClick={() => setTab('sms')}
            className={`flex-1 rounded py-1 text-[8.5px] font-bold transition-all ${
              tab === 'sms'
                ? 'bg-sky-500 text-slate-950 font-black'
                : 'border border-slate-800 bg-slate-950 text-sky-300 hover:bg-slate-800'
            }`}
          >
            ✉️ Почта
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto py-2">
          {tab === 'protocol' && (
            <div className="space-y-2 text-[9.5px]">
              {/* Player Status & Reputation Banner */}
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-2">
                <div>
                  <div className="text-[9px] text-slate-400">Торговая репутация {nick}:</div>
                  <div className="text-xs font-extrabold text-amber-300">
                    ⭐ {repScore} очков ({playerProtocol.length} сделок)
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[8.5px] text-slate-400">Премиум:</div>
                  <div className={`text-[9.5px] font-extrabold ${isPrem ? 'text-yellow-300' : 'text-slate-400'}`}>
                    {isPrem ? '👑 VIP Активен' : '⚪ Нет'}
                  </div>
                </div>
              </div>

              {playerProtocol.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center text-[10px] text-slate-400">
                  У игрока {nick} пока нет зафиксированных сделок в протоколе.
                </div>
              ) : (
                playerProtocol.map((entry, idx) => {
                  const isGoldTransfer = entry.type === 'gold_transfer';
                  return (
                    <div
                      key={entry.id || idx}
                      className={`rounded-lg border p-2 ${
                        isGoldTransfer
                          ? 'border-amber-500/50 bg-amber-950/20'
                          : 'border-slate-800 bg-slate-950'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[8px] text-slate-400 mb-0.5">
                        <span className="font-bold text-amber-300">
                          {isGoldTransfer
                            ? '🪙 ПЕРЕВОД ЗОЛОТА'
                            : entry.type === 'transfer_in' || entry.type === 'transfer_out'
                            ? '📦 ПЕРЕДАЧА ПРЕДМЕТА'
                            : entry.type === 'rent_out' || entry.type === 'rent_return'
                            ? '🤝 АРЕНДА'
                            : entry.type === 'purchase'
                            ? '💳 ПОКУПКА'
                            : '📜 СДЕЛКА'}
                        </span>
                        <span className="font-mono">{entry.dateStr}</span>
                      </div>
                      <div className="text-slate-200 leading-snug">{entry.description}</div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'gear' && (
            <div className="space-y-2.5">
              {(() => {
                const catalog = (shopSkins && shopSkins.length > 0 ? shopSkins : getShopSkins()) as CharacterSkinTemplate[];
                const resolvedSkins = resolvePlayerOwnedSkins(
                  p?.ownedSkinIds,
                  p?.ownedSkinExpirations,
                  catalog,
                  p?.ownedSkins,
                  p?.activeSkinId,
                  p?.avatar
                );
                const activeSkin = resolvedSkins.find((s) => s.id === p?.activeSkinId) || null;
                const activeSkinSprite = activeSkin
                  ? activeSkin.avatarUrl || activeSkin.icon
                  : p?.avatar || (isAdmin ? '👑' : '🧙‍♂️');
                const activeSkinQuality = activeSkin ? getQualityConfig(activeSkin.quality) : null;

                const leftSlots: ItemSlot[] = ['weapon', 'armor', 'gloves'];
                const rightSlots: ItemSlot[] = ['pants', 'boots', 'ring'];

                const renderInspectSlot = (slotKey: ItemSlot) => {
                  const slotMeta = SLOT_INFO[slotKey];
                  const item = equippedObj[slotKey];
                  const q = item ? getQualityConfig(item.quality) : null;

                  return (
                    <div
                      key={slotKey}
                      className="flex flex-col justify-between rounded-xl border p-1.5 min-h-[66px]"
                      style={{
                        borderColor: item ? q?.color : 'rgba(217, 119, 6, 0.5)',
                        background: item
                          ? 'linear-gradient(145deg, rgba(42, 27, 14, 0.94) 0%, rgba(15, 23, 42, 0.96) 100%)'
                          : 'linear-gradient(145deg, rgba(28, 19, 10, 0.85) 0%, rgba(10, 14, 24, 0.92) 100%)',
                        boxShadow: item
                          ? `0 0 10px ${q?.color}30, inset 0 1px 0 rgba(251,191,36,0.15)`
                          : 'inset 0 1px 3px rgba(0,0,0,0.65)'
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-slate-950/95 p-1 overflow-hidden shadow-inner"
                          style={{
                            borderColor: item ? `${q?.color}88` : 'rgba(217, 119, 6, 0.5)'
                          }}
                        >
                          {item ? (
                            <ItemIcon
                              icon={item.icon}
                              alt={item.name}
                              slot={slotKey}
                              fallback={slotMeta.icon}
                              imgClassName="w-full h-full object-contain"
                            />
                          ) : (
                            <ItemIcon
                              icon={slotMeta.icon}
                              alt={slotMeta.name}
                              slot={slotKey}
                              imgClassName="w-full h-full object-contain opacity-65"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[7.5px] font-extrabold uppercase tracking-wider text-amber-300/90 truncate">
                              {slotMeta.name}
                            </span>
                            {item && (
                              <span className="shrink-0 rounded bg-slate-950/90 px-1 py-[0.5px] text-[7px] font-black text-amber-300 border border-amber-500/30">
                                {item.lvl} ур.
                              </span>
                            )}
                          </div>
                          {item ? (
                            <div
                              className="truncate text-[8.5px] font-extrabold leading-tight mt-0.5"
                              style={{ color: q?.color }}
                            >
                              {item.name}
                            </div>
                          ) : (
                            <div className="text-[8px] italic text-slate-500 mt-0.5">Пусто</div>
                          )}
                        </div>
                      </div>

                      {item && (
                        <div className="mt-1 pt-0.5 border-t border-slate-800/80 flex flex-wrap gap-x-1 gap-y-0.5 text-[7.5px] font-bold leading-none">
                          {item.dmg > 0 && <span className="text-amber-300">+{item.dmg}⚔️</span>}
                          {item.hp > 0 && <span className="text-red-300">+{item.hp}❤️</span>}
                          {(item.dodgeBonus ?? 0) > 0 && (
                            <span className="text-emerald-300">+{item.dodgeBonus}%💨</span>
                          )}
                          {(item.energyBonus ?? 0) > 0 && (
                            <span className="text-cyan-300">+{item.energyBonus}⚡</span>
                          )}
                          {(item.goldBonusPct ?? 0) > 0 && (
                            <span className="text-yellow-300">+{item.goldBonusPct}%🪙</span>
                          )}
                          {(item.expBonusPct ?? 0) > 0 && (
                            <span className="text-purple-300">+{item.expBonusPct}%✨</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <div
                    className="rounded-2xl border-2 border-amber-500/50 p-2 shadow-[0_0_20px_rgba(245,158,11,0.15)] space-y-2"
                    style={{
                      background:
                        'radial-gradient(circle at 50% 45%, rgba(147, 51, 234, 0.15) 0%, rgba(30, 20, 12, 0.92) 55%, rgba(9, 13, 22, 0.98) 100%)'
                    }}
                  >
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-300">
                        𓂀 Амуниция и Облик игрока {nick}
                      </span>
                      <span className="text-[8px] font-bold text-slate-400">
                        Ур. {level}
                      </span>
                    </div>

                    <div className="grid grid-cols-[1fr_1.15fr_1fr] gap-1.5 items-stretch">
                      <div className="flex flex-col justify-between gap-1.5 min-w-0">
                        {leftSlots.map((s) => renderInspectSlot(s))}
                      </div>

                      <div
                        className="relative flex flex-col items-center justify-between rounded-xl border-2 p-1.5 overflow-hidden"
                        style={{
                          borderColor: activeSkinQuality?.color || '#f59e0b',
                          background:
                            'radial-gradient(ellipse at 50% 45%, rgba(245, 158, 11, 0.22) 0%, rgba(88, 28, 135, 0.28) 48%, rgba(9, 6, 15, 0.96) 100%)'
                        }}
                      >
                        <div className="w-full text-center border-b border-amber-500/25 pb-1 z-10">
                          <div
                            className="truncate text-[8.5px] font-black leading-tight"
                            style={{ color: activeSkinQuality?.color || '#fde047' }}
                          >
                            {activeSkin ? `🎭 ${activeSkin.name}` : '👤 Стандартный облик'}
                          </div>
                        </div>

                        <div className="relative flex-1 w-full flex items-center justify-center my-1 min-h-[135px]">
                          <CharacterAvatar
                            avatar={activeSkinSprite}
                            nick={nick}
                            fullBody={true}
                            size="full"
                            className="w-full h-full max-h-[145px] object-contain"
                          />
                          <div className="pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4/5 h-2 rounded-full bg-gradient-to-r from-transparent via-amber-500/45 to-transparent blur-[1px] border-b border-amber-400/60" />
                        </div>

                        {activeSkin && (
                          <div className="w-full truncate text-center text-[7px] font-bold text-emerald-300 border-t border-amber-500/20 pt-0.5">
                            {formatSkinBonusesText(activeSkin)}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col justify-between gap-1.5 min-w-0">
                        {rightSlots.map((s) => renderInspectSlot(s))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Достижения игрока (видны всем игрокам при нажатии на персонажа) */}
              <div className="rounded-xl border-2 border-amber-500/55 bg-gradient-to-b from-[#22140d] via-slate-900 to-slate-950 p-2.5 space-y-2 shadow-md">
                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-amber-500/25 pb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-xl border border-amber-400/70 bg-slate-950 p-1 shrink-0 flex items-center justify-center">
                      <ItemIcon
                        icon={KILLER_ACHIEVEMENT_SVG}
                        alt="Достижение Киллер"
                        imgClassName="w-full h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                        🏆 Достижение: «Киллер» (Ур. {killerAch.level} / 5)
                      </div>
                      <div className="text-[8px] text-emerald-300 font-bold">
                        Бонус к здоровью навсегда: +{killerAch.totalHpBonus} ❤️ HP
                      </div>
                    </div>
                  </div>
                  <span className="rounded bg-red-950/90 border border-red-500/60 px-2 py-0.5 text-[8.5px] font-black text-red-200">
                    ⚔️ Убито: {killerAch.kills} игр.
                  </span>
                </div>

                <div className="text-[8px] text-slate-300 leading-snug">
                  {KILLER_ACHIEVEMENT_DESCRIPTION}
                </div>

                <div className="grid grid-cols-5 gap-1">
                  {KILLER_ACHIEVEMENT_LEVELS.map((tier) => {
                    const unlocked = killerAch.kills >= tier.killsRequired;
                    return (
                      <div
                        key={tier.level}
                        className={`rounded-lg border p-1 text-center ${
                          unlocked
                            ? 'border-emerald-400 bg-emerald-950/55 text-emerald-200'
                            : 'border-slate-800 bg-slate-900/80 text-slate-500'
                        }`}
                      >
                        <div className="text-[7.5px] font-black text-amber-300">
                          {tier.level} ур. {unlocked ? '✅' : '🔒'}
                        </div>
                        <div className="text-[7.5px] font-bold">{tier.killsRequired} уб.</div>
                        <div className="text-[7px] text-red-300 font-bold">+100 ❤️</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'collection' && (
            <div className="space-y-2 text-[9.5px]">
              <div className="rounded-lg border border-purple-500/40 bg-purple-950/20 p-2">
                <div className="text-[9.5px] font-extrabold text-purple-300">
                  🎭 Личная коллекция скинов игрока {nick}:
                </div>
                <div className="text-[8px] text-slate-400 mt-0.5">
                  Скины закреплены за персонажем навсегда и дают пассивные боевые бонусы.
                </div>
              </div>

              {(() => {
                const catalog = (shopSkins && shopSkins.length > 0 ? shopSkins : getShopSkins()) as CharacterSkinTemplate[];
                const ownedIds = Array.isArray(p?.ownedSkinIds) ? p!.ownedSkinIds! : [];
                const ownedSkins = ownedIds
                  .map((id) => catalog.find((s: CharacterSkinTemplate) => s.id === id))
                  .filter(Boolean) as CharacterSkinTemplate[];

                if (ownedSkins.length === 0) {
                  return (
                    <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center text-[10px] text-slate-400">
                      У игрока {nick} пока нет скинов в коллекции.
                    </div>
                  );
                }

                return ownedSkins.map((skin) => {
                  const isActive = p?.activeSkinId === skin.id;
                  const bonusesText = formatSkinBonusesText(skin);

                  return (
                    <div
                      key={skin.id}
                      className={`rounded-lg border p-2 transition-all ${
                        isActive
                          ? 'border-amber-400/80 bg-amber-950/25 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                          : 'border-slate-800 bg-slate-950'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-purple-500/50 bg-slate-900 p-1 overflow-hidden">
                          <CharacterAvatar avatar={skin.avatarUrl || skin.icon} nick={nick} className="w-full h-full object-contain" />
                          {isActive && (
                            <span className="absolute top-0 right-0 rounded-bl bg-amber-500 px-1 text-[6.5px] font-black text-slate-950">
                              НАДЕТ
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="text-[10.5px] font-black text-white truncate">
                              {skin.name}
                            </span>
                            <div className="flex items-center gap-1">
                              {(() => {
                                const expMs = (p as any)?.ownedSkinExpirations?.[skin.id];
                                const isTemp = Boolean(expMs && expMs > 0);
                                const remDays = Math.ceil(Math.max(0, (expMs || 0) - Date.now()) / 86400000);
                                if (isTemp) {
                                  return (
                                    <span className="rounded bg-amber-950/90 border border-amber-500/60 px-1 py-0.2 text-[7px] font-black text-amber-300">
                                      ⏳ Временный ({remDays} дн.)
                                    </span>
                                  );
                                }
                                return (
                                  <span className="rounded bg-emerald-950/80 border border-emerald-500/50 px-1 py-0.2 text-[7px] font-bold text-emerald-300">
                                    ♾️ Навсегда
                                  </span>
                                );
                              })()}
                              {isActive ? (
                                <span className="rounded bg-amber-500/20 border border-amber-400/60 px-1.5 py-0.2 text-[7.5px] font-black text-amber-300">
                                  ✅ Надет сейчас
                                </span>
                              ) : (
                                <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.2 text-[7.5px] font-bold text-slate-400">
                                  В коллекции
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-0.5 text-[8.5px] text-emerald-300 font-semibold">
                            {bonusesText}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {tab === 'info' && (
            <div className="space-y-2 text-[10px]">
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 space-y-1.5">
                <div className="font-bold text-amber-300 border-b border-slate-800 pb-1">
                  ⚔️ Статус и боевая статистика:
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">📡 Текущий статус:</span>
                  <span className={`font-bold ${isOnline ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {isOnline
                      ? `🟢 Онлайн (${inPyramid ? `🔺 Пирамида Т${pyramidTier}` : '🏠 Город'})`
                      : `⚪ Оффлайн (${inPyramid ? `🔺 Пирамида Т${pyramidTier}` : '🏠 Город'})`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">👑 Премиум-статус:</span>
                  <span className={`font-bold ${isPrem ? 'text-yellow-400' : 'text-slate-500'}`}>
                    {isPrem ? '👑 Активен (VIP)' : 'Нет (Базовый)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">💪 Сила / 💨 Ловкость / 🛡️ Живучесть:</span>
                  <span className="font-bold text-amber-300">
                    {str} / {agi} / {vit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">👾 Убито монстров:</span>
                  <span className="font-bold text-emerald-400">{mobsKilled}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">⚔️ Убито игроков (PvP):</span>
                  <span className="font-bold text-red-400">{pvpKills}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">🏆 Достижение «Киллер»:</span>
                  <span className="font-bold text-emerald-300">
                    Ур. {killerAch.level} / 5 (+{killerAch.totalHpBonus} ❤️ HP навсегда)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">🗡️ Лицензия киллера:</span>
                  <span className={`font-bold ${isKillerLicenseActive ? 'text-amber-300' : 'text-slate-500'}`}>
                    {isKillerLicenseActive
                      ? `🟢 Активна (${formatLicenseRemainingTime(killerLicenseUntil, nowMs)})`
                      : '⚪ Не активна'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">💀 Количество смертей:</span>
                  <span className="font-bold text-slate-300">{deaths}</span>
                </div>
              </div>

              {/* Достижения персонажа: Киллер (видны всем игрокам при просмотре профиля) */}
              <div className="rounded-xl border border-amber-500/45 bg-slate-950 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-black text-amber-300">
                    🏆 Достижение «Киллер» ({killerAch.level}/5 ур.)
                  </span>
                  <span className="text-[8.5px] font-bold text-emerald-300">
                    +{killerAch.totalHpBonus} ❤️ HP навсегда
                  </span>
                </div>
                <div className="text-[8px] text-slate-400 leading-snug">
                  {KILLER_ACHIEVEMENT_DESCRIPTION}
                </div>
                <div className="grid grid-cols-5 gap-1 pt-0.5">
                  {KILLER_ACHIEVEMENT_LEVELS.map((tier) => {
                    const unlocked = killerAch.kills >= tier.killsRequired;
                    return (
                      <div
                        key={tier.level}
                        className={`rounded border p-1 text-center ${
                          unlocked
                            ? 'border-emerald-400 bg-emerald-950/50 text-emerald-200'
                            : 'border-slate-800 bg-slate-900/70 text-slate-500'
                        }`}
                      >
                        <div className="text-[7.5px] font-black text-amber-300">
                          {tier.level} ур. {unlocked ? '✅' : '🔒'}
                        </div>
                        <div className="text-[7.5px] font-bold">{tier.killsRequired} уб.</div>
                        <div className="text-[7px] text-red-300 font-bold">+100 ❤️</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Активные бонусы / Премиум (VIP) с таймером окончания */}
              <ActiveVipBonusesBlock
                isPremium={isPrem}
                premiumUntil={p?.premiumUntil}
                isOwnProfile={false}
              />

              {/* PvP Attack Rule: ONLY on Pyramid cells with an active Killer License (never from profile modal / main screen / leaderboard) */}
              <div className="rounded-lg border border-amber-500/35 bg-slate-950/90 p-2 text-center space-y-0.5">
                <div className="text-[9px] font-extrabold text-amber-300">
                  🗡️ Правило PvP и Лицензии киллера
                </div>
                <div className="text-[8px] text-slate-300 leading-snug">
                  Нападать и убивать игроков через профиль на главной или в рейтинге нельзя — атака разрешена <strong className="text-red-300">только внутри Пирамиды</strong> на соседней клетке при активной «Лицензии киллера» (10 💎 на 1 день в Магазине).
                </div>
              </div>
            </div>
          )}

          {tab === 'sms' && (
            <div className="rounded-lg border border-sky-500/40 bg-sky-950/20 p-2.5 space-y-2 text-[10px]">
              <div className="font-bold text-sky-300">
                ✉️ Отправить личное письмо для {nick}:
              </div>
              <div className="text-[8.5px] text-slate-400">
                Письмо придёт игроку {nick} в раздел «Персонаж ➔ Почта».
              </div>
              <form onSubmit={handleSendPrivateSms} className="space-y-2">
                <textarea
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  placeholder={`Напишите сообщение для ${nick}...`}
                  rows={3}
                  className="w-full rounded border border-slate-700 bg-slate-900 p-2 text-[10px] text-white outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  disabled={!smsText.trim()}
                  className="w-full rounded bg-sky-600 py-1.5 text-[10px] font-bold text-white hover:bg-sky-500 active:scale-95 disabled:opacity-40"
                >
                  📨 Отправить письмо
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Action Buttons Bar */}
        <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-slate-800 pt-2">
          {/* Add Friend Button */}
          <button
            onClick={handleAddFriendClick}
            disabled={friendAdded}
            className={`rounded py-1.5 text-[10px] font-bold transition-all active:scale-95 ${
              friendAdded
                ? 'bg-emerald-950 border border-emerald-500/50 text-emerald-300 cursor-default'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {friendAdded ? '✅ В друзьях' : '➕ В друзья'}
          </button>

          {/* Send SMS Button */}
          <button
            onClick={() => setTab('sms')}
            className="rounded bg-sky-600 py-1.5 text-[10px] font-bold text-white hover:bg-sky-500 active:scale-95"
          >
            ✉️ Написать письмо
          </button>

          {/* Transfer Gold */}
          {onOpenTransferModal && (
            <button
              onClick={() => {
                onOpenTransferModal(nick);
                onClose();
              }}
              className="rounded bg-amber-600 py-1.5 text-[10px] font-bold text-white hover:bg-amber-500 active:scale-95"
            >
              🪙 Передать золото
            </button>
          )}

          {/* Transfer Item */}
          {onOpenItemTransfer && (
            <button
              onClick={() => {
                onOpenItemTransfer(nick);
                onClose();
              }}
              className="rounded bg-indigo-600 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-500 active:scale-95"
            >
              📦 Передать предмет
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

