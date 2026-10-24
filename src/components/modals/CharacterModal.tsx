import React, { useState, useEffect } from 'react';
import { HeroState, EquippedGear, ItemSlot, PrivateMessage } from '../../types/game';
import { SLOT_INFO, getQualityConfig, calculateHeroStatsBreakdown, formatFullDateTime } from '../../utils/gameData';
import { getItemDefaultMaxDurability, CharacterSkinTemplate, formatSkinBonusesText, getShopSkins, resolvePlayerOwnedSkins } from '../../utils/shopConfig';
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

interface CharacterModalProps {
  currentUser?: string | null;
  hero: HeroState;
  equipped: EquippedGear;
  tradeCount: number;
  initialTab?: 'profile' | 'mail' | 'collection';
  shopSkins?: CharacterSkinTemplate[];
  mailMessages?: PrivateMessage[];
  unreadMailCount?: number;
  knownPlayers?: string[];
  onClose: () => void;
  onUnequip: (slot: ItemSlot) => void;
  onEquipSkin?: (skinOrId: CharacterSkinTemplate | string | null) => void;
  onOpenStats: () => void;
  onOpenTradeProtocol: () => void;
  onOpenFriends: () => void;
  onOpenDirectTransfer: () => void;
  onOpenInventory: () => void;
  onOpenShop?: () => void;
  onOpenCreateItem?: () => void;
  onOpenPremium?: () => void;
  onOpenLeaderboard?: () => void;
  onSendMail?: (targetNick: string, text: string) => void;
  onMarkMailRead?: (senderNick?: string) => void;
  onClaimMailGift?: (msg: PrivateMessage) => Promise<boolean> | boolean | void;
  onClaimReferralReward?: (refNick?: string) => void;
  onUseKillerLicense?: () => void;
  onLevelUpReferral?: () => void;
  onLogout?: () => void;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  currentUser,
  hero,
  equipped,
  tradeCount,
  initialTab = 'profile',
  shopSkins,
  mailMessages = [],
  unreadMailCount = 0,
  knownPlayers = [],
  onClose,
  onUnequip,
  onEquipSkin,
  onOpenStats,
  onOpenTradeProtocol,
  onOpenFriends,
  onOpenDirectTransfer,
  onOpenInventory,
  onOpenShop,
  onOpenCreateItem,
  onOpenPremium,
  onOpenLeaderboard,
  onSendMail,
  onMarkMailRead,
  onClaimMailGift,
  onClaimReferralReward,
  onUseKillerLicense,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'mail' | 'collection'>(initialTab);
  const [copiedLink, setCopiedLink] = useState(false);
  const [recipientNick, setRecipientNick] = useState('');
  const [mailText, setMailText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [inlineReplyText, setInlineReplyText] = useState('');
  const [claimingGiftIds, setClaimingGiftIds] = useState<Record<string, boolean>>({});
  const [localClaimedGiftIds, setLocalClaimedGiftIds] = useState<Record<string, boolean>>({});
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const slots: ItemSlot[] = ['weapon', 'armor', 'pants', 'boots', 'gloves', 'ring'];

  const myCleanNick = String(currentUser || '').trim().toLowerCase();
  const claimedIdsSet = new Set([
    ...(Array.isArray(hero.claimedMailGiftIds) ? hero.claimedMailGiftIds : []),
    ...Object.keys(localClaimedGiftIds).filter((k) => localClaimedGiftIds[k])
  ]);

  // Filter messages belonging to current player (incoming + outgoing), newest first
  const myMail = mailMessages
    .filter((m) => {
      const fromLower = String(m.from || '').trim().toLowerCase();
      const toLower = String(m.to || '').trim().toLowerCase();
      return fromLower === myCleanNick || toLower === myCleanNick;
    })
    .sort((a, b) => {
      const timeA = typeof a.time === 'number' ? a.time : (a.timestamp || 0);
      const timeB = typeof b.time === 'number' ? b.time : (b.timestamp || 0);
      return timeB - timeA;
    });

  const unclaimedGiftsCount = myMail.filter((m) => {
    const isIncoming = String(m.to || '').trim().toLowerCase() === myCleanNick;
    if (!isIncoming || !m.gift) return false;
    const mId = String(m.id || '');
    return !m.giftClaimed && (!mId || !claimedIdsSet.has(mId));
  }).length;

  const mailBadgeCount = Math.max(unreadMailCount, unclaimedGiftsCount);

  // Mark incoming messages as read when opening the mail tab
  useEffect(() => {
    if (activeTab === 'mail' && unreadMailCount > 0 && onMarkMailRead) {
      onMarkMailRead();
    }
  }, [activeTab, unreadMailCount, onMarkMailRead]);

  const handleSendNewMail = (e: React.FormEvent) => {
    e.preventDefault();
    const target = recipientNick.trim();
    const body = mailText.trim();
    if (!target || !body || !onSendMail) return;
    onSendMail(target, body);
    setMailText('');
  };

  const handleSendInlineReply = (targetNick: string) => {
    const body = inlineReplyText.trim();
    if (!targetNick || !body || !onSendMail) return;
    onSendMail(targetNick, body);
    setInlineReplyText('');
    setReplyingToId(null);
  };

  const handleClaimGiftClick = async (msg: PrivateMessage, msgId: string) => {
    if (!onClaimMailGift) return;
    if (msg.giftClaimed || claimedIdsSet.has(msgId) || claimingGiftIds[msgId]) return;
    setClaimingGiftIds((prev) => ({ ...prev, [msgId]: true }));
    setLocalClaimedGiftIds((prev) => ({ ...prev, [msgId]: true }));
    try {
      const res = await onClaimMailGift(msg);
      if (res === false) {
        setLocalClaimedGiftIds((prev) => {
          const next = { ...prev };
          delete next[msgId];
          return next;
        });
      }
    } finally {
      setClaimingGiftIds((prev) => ({ ...prev, [msgId]: false }));
    }
  };

  const statsBreakdown = calculateHeroStatsBreakdown(hero, equipped);
  const totalDmg = statsBreakdown.totalDmg;
  const totalHp = statsBreakdown.totalMaxHp;
  const dodgeChance = statsBreakdown.totalDodgePct;
  const isPremActive = false;
  const tradeRep = Math.max(0, tradeCount * 10);
  const effectiveBagCapacity = hero.bagCapacity;

  const resolvedOwnedSkins = resolvePlayerOwnedSkins(
    hero.ownedSkinIds,
    hero.ownedSkinExpirations,
    shopSkins,
    hero.ownedSkins,
    hero.activeSkinId,
    hero.avatar
  );

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-slate-950/95 p-3 text-white">
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <span className="text-xs font-bold text-amber-400">👤 Персонаж и Почта</span>
        <button onClick={onClose} className="text-base font-bold text-red-400 hover:text-red-300">
          ✕
        </button>
      </div>

      {/* Top Section Tabs: Экипировка vs Коллекция vs Почта */}
      <div className="mt-2 flex gap-1.5 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('profile')}
          className={`relative flex-1 rounded-md py-1.5 text-[10px] font-extrabold transition-all ${
            activeTab === 'profile'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          👤 Экипировка
          {hero.statPoints > 0 && (
            <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-black text-white ring-2 ring-slate-950 animate-pulse shadow-[0_0_8px_#ef4444]">
              +{hero.statPoints}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('collection')}
          className={`relative flex-1 rounded-md py-1.5 text-[10px] font-extrabold transition-all ${
            activeTab === 'collection'
              ? 'bg-purple-600 text-white shadow'
              : 'border border-purple-500/50 bg-slate-900 text-purple-300 hover:bg-slate-800'
          }`}
        >
          🎭 Коллекция ({resolvedOwnedSkins.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('mail');
            if (onMarkMailRead) onMarkMailRead();
          }}
          className={`relative flex-1 rounded-md py-1.5 text-[10px] font-extrabold transition-all ${
            activeTab === 'mail'
              ? 'bg-sky-500 text-slate-950 shadow'
              : 'border border-sky-500/50 bg-slate-900 text-sky-300 hover:bg-slate-800'
          }`}
        >
          📩 Почта ({myMail.length})
          {mailBadgeCount > 0 && (
            <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-black text-white ring-2 ring-slate-950 animate-bounce shadow-[0_0_8px_#ef4444]">
              {mailBadgeCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'mail' ? (
        <div className="flex-1 flex flex-col overflow-hidden pt-2 space-y-2.5">
          {/* Compose / Send Mail Form */}
          <form
            onSubmit={handleSendNewMail}
            className="rounded-lg border border-sky-500/40 bg-slate-900/90 p-2.5 space-y-2 shrink-0"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-sky-300">
                ✍️ Написать письмо игроку:
              </span>
              {knownPlayers.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto max-w-[190px]">
                  {knownPlayers
                    .filter((n) => n.toLowerCase() !== myCleanNick)
                    .slice(0, 4)
                    .map((nick) => (
                      <button
                        type="button"
                        key={nick}
                        onClick={() => setRecipientNick(nick)}
                        className="shrink-0 rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[8px] font-bold text-amber-300 hover:border-amber-400"
                      >
                        {nick}
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={recipientNick}
                onChange={(e) => setRecipientNick(e.target.value)}
                placeholder="Ник получателя..."
                className="w-[38%] rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-amber-300 font-bold outline-none focus:border-sky-400"
              />
              <input
                type="text"
                value={mailText}
                onChange={(e) => setMailText(e.target.value)}
                placeholder="Текст письма..."
                className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-white outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                disabled={!recipientNick.trim() || !mailText.trim()}
                className="rounded bg-sky-600 px-2.5 py-1 text-[10px] font-extrabold text-white hover:bg-sky-500 active:scale-95 disabled:opacity-40 shrink-0"
              >
                📨 Отправить
              </button>
            </div>
          </form>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {myMail.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-center text-[10px] text-slate-400">
                <span className="text-2xl mb-1">📭</span>
                <span>В вашем почтовом ящике пока нет писем.</span>
                <span className="text-[8.5px] text-slate-500 mt-0.5">
                  Выберите игрока сверху или нажмите на любого игрока в списке «В игре», чтобы отправить сообщение!
                </span>
              </div>
            ) : (
              myMail.map((msg, idx) => {
                const msgId = String(msg.id || `${msg.from}_${msg.to}_${msg.time}_${idx}`);
                const isIncoming = String(msg.to || '').trim().toLowerCase() === myCleanNick;
                const otherParty = isIncoming ? msg.from : msg.to;
                const timeDisplay =
                  msg.timeStr ||
                  new Date(msg.time || Date.now()).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                const isReplying = replyingToId === msgId;
                const hasGift = Boolean(msg.gift);
                const isGiftClaimed = Boolean(msg.giftClaimed) || claimedIdsSet.has(msgId);
                const isClaimingNow = Boolean(claimingGiftIds[msgId]);

                return (
                  <div
                    key={msgId}
                    className={`rounded-lg border p-2.5 text-[10px] transition-all ${
                      hasGift && !isGiftClaimed && isIncoming
                        ? 'border-amber-400/80 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                        : isIncoming
                        ? 'border-sky-500/50 bg-slate-900/95 shadow'
                        : 'border-slate-800 bg-slate-950/80'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-1 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase ${
                            hasGift
                              ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                              : isIncoming
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {hasGift ? '🎁 Подарок' : isIncoming ? '📥 Входящее' : '📤 Отправлено'}
                        </span>
                        <span className="font-bold text-amber-300">
                          {isIncoming ? `От: ${msg.from}` : `Кому: ${msg.to}`}
                        </span>
                      </div>
                      <span className="text-[8px] font-mono text-slate-400">{timeDisplay}</span>
                    </div>

                    <div className="text-slate-100 text-[10.5px] leading-relaxed break-words py-0.5">
                      {msg.text}
                    </div>

                    {/* Gift Attachment Box */}
                    {msg.gift && (
                      <div
                        className={`mt-2 rounded-lg border p-2 ${
                          isGiftClaimed
                            ? 'border-slate-700 bg-slate-950/70 opacity-75'
                            : 'border-amber-500/60 bg-amber-950/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9.5px] font-extrabold text-amber-300">
                            🎁 Вложение в письме:
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[8px] font-black ${
                              isGiftClaimed
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                                : 'bg-amber-500 text-slate-950'
                            }`}
                          >
                            {isGiftClaimed ? '✅ Забрано (1/1)' : 'Доступно к получению'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1 my-1.5">
                          {(msg.gift.gold || 0) > 0 && (
                            <span className="rounded bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-300">
                              🪙 +{msg.gift.gold} Золота
                            </span>
                          )}
                          {(msg.gift.crystals || 0) > 0 && (
                            <span className="rounded bg-cyan-950/80 border border-cyan-500/40 px-1.5 py-0.5 text-[9px] font-extrabold text-cyan-300">
                              💎 +{msg.gift.crystals} Кристаллов
                            </span>
                          )}
                          {(msg.gift.hpPotions || 0) > 0 && (
                            <span className="rounded bg-red-950/80 border border-red-500/40 px-1.5 py-0.5 text-[9px] font-extrabold text-red-300">
                              🧪 +{msg.gift.hpPotions} Зелий HP
                            </span>
                          )}
                          {(msg.gift.enPotions || 0) > 0 && (
                            <span className="rounded bg-sky-950/80 border border-sky-500/40 px-1.5 py-0.5 text-[9px] font-extrabold text-sky-300">
                              ⚡ +{msg.gift.enPotions} Зелий Энергии
                            </span>
                          )}
                          {(msg.gift.energy || 0) > 0 && (
                            <span className="rounded bg-indigo-950/80 border border-indigo-500/40 px-1.5 py-0.5 text-[9px] font-extrabold text-indigo-300">
                              ✨ +{msg.gift.energy} Энергии
                            </span>
                          )}
                          {(msg.gift.wheelSpins || 0) > 0 && (
                            <span className="rounded bg-rose-950/80 border border-rose-500/40 px-1.5 py-0.5 text-[9px] font-extrabold text-rose-300">
                              🎡 +{msg.gift.wheelSpins} Беспл. прокрутов рулетки
                            </span>
                          )}
                          {(msg.gift.premiumDays || 0) > 0 && (
                            <span className="rounded bg-yellow-950/80 border border-yellow-500/40 px-1.5 py-0.5 text-[9px] font-extrabold text-yellow-300">
                              👑 Премиум +{msg.gift.premiumDays} дн.
                            </span>
                          )}
                          {(msg.gift.statPoints || 0) > 0 && (
                            <span className="rounded bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-300">
                              📈 +{msg.gift.statPoints} Очков статов
                            </span>
                          )}
                          {(msg.gift.exp || 0) > 0 && (
                            <span className="rounded bg-purple-950/80 border border-purple-500/40 px-1.5 py-0.5 text-[9px] font-extrabold text-purple-300">
                              ⭐ +{msg.gift.exp} Опыта
                            </span>
                          )}
                          {msg.gift.item && (
                            <span className="rounded bg-slate-900 border border-amber-400/60 px-2 py-0.5 text-[9px] font-extrabold text-amber-200">
                              {msg.gift.item.icon} {msg.gift.item.name} (Ур.{msg.gift.item.lvl})
                            </span>
                          )}
                        </div>

                        {isIncoming && (
                          <div className="mt-2">
                            {isGiftClaimed ? (
                              <div className="w-full rounded bg-slate-900 border border-emerald-500/30 py-1.5 text-center text-[9.5px] font-extrabold text-emerald-400">
                                ✅ Подарок получен и зачислен на аккаунт
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleClaimGiftClick(msg, msgId)}
                                disabled={isClaimingNow}
                                className="w-full rounded-md bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-1.5 text-[10.5px] font-black text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)] hover:from-amber-400 hover:to-yellow-300 active:scale-95 cursor-pointer disabled:opacity-50"
                              >
                                {isClaimingNow ? '⏳ Начисление...' : '🎁 Забрать подарок'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {isIncoming && (
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (isReplying) {
                              setReplyingToId(null);
                            } else {
                              setReplyingToId(msgId);
                              setRecipientNick(otherParty);
                              setInlineReplyText('');
                            }
                          }}
                          className="rounded border border-sky-500/50 bg-sky-950/80 px-2 py-0.5 text-[8.5px] font-bold text-sky-200 hover:bg-sky-900 active:scale-95"
                        >
                          ↩️ Ответить {msg.from}
                        </button>
                      </div>
                    )}

                    {isReplying && (
                      <div className="mt-2 flex gap-1.5 pt-1.5 border-t border-slate-800">
                        <input
                          type="text"
                          value={inlineReplyText}
                          onChange={(e) => setInlineReplyText(e.target.value)}
                          placeholder={`Ваш ответ для ${msg.from}...`}
                          autoFocus
                          className="flex-1 rounded border border-sky-500/60 bg-slate-950 px-2 py-1 text-[10px] text-white outline-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSendInlineReply(msg.from);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSendInlineReply(msg.from)}
                          disabled={!inlineReplyText.trim()}
                          className="rounded bg-sky-600 px-2.5 py-1 text-[9.5px] font-extrabold text-white hover:bg-sky-500 disabled:opacity-40"
                        >
                          📨 Отправить
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : activeTab === 'collection' ? (
        <div className="flex-1 flex flex-col overflow-hidden pt-2 space-y-2.5">
          {/* Collection Info Banner */}
          <div className="rounded-xl border border-purple-500/50 bg-gradient-to-r from-purple-950/70 via-slate-900 to-purple-950/70 p-2.5 shrink-0 shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🎭</span>
                <span className="text-xs font-black text-purple-200">
                  Личная коллекция скинов ({resolvedOwnedSkins.length})
                </span>
              </div>
              {hero.activeSkinId && (
                <button
                  type="button"
                  onClick={() => onEquipSkin && onEquipSkin(null)}
                  className="rounded border border-red-500/50 bg-red-950/80 px-2 py-0.5 text-[8.5px] font-bold text-red-300 hover:bg-red-900"
                >
                  Снять активный скин
                </button>
              )}
            </div>
            <p className="mt-1 text-[9px] text-purple-200/90 leading-tight">
              🔒 Все скины в коллекции (включая созданные для себя и эксклюзивные) закреплены за вашим персонажем. Вы можете надеть любой скин в любой момент.
            </p>
          </div>

          {/* Skins List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {(() => {
              const now = Date.now();
              const ownedSkins = resolvedOwnedSkins;

              if (ownedSkins.length === 0) {
                return (
                  <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-purple-500/30 bg-slate-900/40 p-4 text-center">
                    <span className="text-3xl mb-1.5">🎭</span>
                    <div className="text-[11px] font-extrabold text-purple-300">
                      В вашей коллекции пока нет персонажей
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1 max-w-[260px] leading-relaxed">
                      Приобретайте уникальных персонажей в Магазине или выигрывайте в Рулетке. Скины дают постоянные боевые бонусы!
                    </p>
                    {onOpenShop && (
                      <button
                        type="button"
                        onClick={onOpenShop}
                        className="mt-3 rounded-lg border border-amber-400 bg-gradient-to-r from-amber-600 to-yellow-600 px-3 py-1.5 text-[10px] font-black text-slate-950 shadow hover:brightness-110 active:scale-95 cursor-pointer"
                      >
                        🛒 Открыть магазин скинов
                      </button>
                    )}
                  </div>
                );
              }

              return ownedSkins.map((skin) => {
                const isActive = hero.activeSkinId === skin.id;
                const bonusesText = formatSkinBonusesText(skin);
                const expMs = hero.ownedSkinExpirations?.[skin.id];
                const isTemp = Boolean(expMs && expMs > 0);
                const remainingMs = Math.max(0, (expMs || 0) - now);
                const remainingDays = Math.floor(remainingMs / 86400000);
                const remainingHours = Math.floor((remainingMs % 86400000) / 3600000);
                const q = getQualityConfig(skin.quality);

                return (
                  <div
                    key={skin.id}
                    className={`rounded-xl border p-2.5 transition-all ${
                      isActive
                        ? 'border-amber-400 bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                        : 'border-slate-800 bg-slate-900/80 hover:border-purple-500/40'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 bg-slate-950 p-1 overflow-hidden shadow"
                        style={{ borderColor: isActive ? '#f59e0b' : q.color }}
                      >
                        <CharacterAvatar avatar={skin.avatarUrl || skin.icon} alt={skin.name} className="w-full h-full object-contain" />
                        {isActive && (
                          <span className="absolute top-0 right-0 rounded-bl bg-amber-500 px-1 text-[7px] font-black text-slate-950">
                            НАДЕТ
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <span className="text-[12px] font-black text-white truncate">
                            {skin.name}
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {(skin.isPersonal || skin.isExclusive) && (
                              <span className="rounded bg-fuchsia-950/90 border border-fuchsia-500/60 px-1.5 py-0.2 text-[7.5px] font-black text-fuchsia-300">
                                🔒 Для себя
                              </span>
                            )}
                            <span
                              className="rounded px-1.5 py-0.2 text-[7.5px] font-bold uppercase"
                              style={{ color: q.color, backgroundColor: `${q.color}22` }}
                            >
                              {q.name}
                            </span>
                            {isTemp ? (
                              <span className="rounded bg-amber-950/90 border border-amber-500/60 px-1.5 py-0.2 text-[7.5px] font-black text-amber-300">
                                ⏳ Временный ({remainingDays > 0 ? `${remainingDays} дн. ` : ''}{remainingHours} ч.)
                              </span>
                            ) : (
                              <span className="rounded bg-emerald-950/80 border border-emerald-500/50 px-1.5 py-0.2 text-[7.5px] font-bold text-emerald-300">
                                ♾️ Навсегда
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-1 text-[9.5px] text-emerald-300 font-semibold leading-tight">
                          {bonusesText}
                        </div>

                        <div className="mt-1 flex items-center justify-between gap-2 text-[8px] text-slate-400">
                          <span>{isTemp ? `Истекает: ${new Date(expMs!).toLocaleDateString('ru-RU')}` : 'Личный скин • Нельзя продать'}</span>
                          <span className="text-purple-300 font-bold">{skin.lvl} ур.</span>
                        </div>

                        <div className="mt-2 flex items-center justify-end gap-2">
                          {isActive ? (
                            <button
                              type="button"
                              onClick={() => onEquipSkin && onEquipSkin(null)}
                              className="rounded-lg border border-amber-400 bg-amber-500/20 px-3 py-1 text-[9.5px] font-black text-amber-300 hover:bg-amber-500/30 active:scale-95 shadow cursor-pointer"
                            >
                              ✅ Надет (Нажмите, чтобы снять)
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onEquipSkin && onEquipSkin(skin)}
                              className="rounded-lg border border-purple-400 bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1 text-[9.5px] font-black text-white hover:brightness-110 active:scale-95 shadow cursor-pointer"
                            >
                              🎭 Надеть персонажа
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pt-1.5 space-y-2.5">
          {(() => {
            const activeSkin =
              resolvedOwnedSkins.find((s) => s.id === hero.activeSkinId) || null;
            const activeSkinSprite = activeSkin
              ? activeSkin.avatarUrl || activeSkin.icon
              : hero.avatar;
            const activeSkinQuality = activeSkin
              ? getQualityConfig(activeSkin.quality)
              : null;

            const leftSlots: ItemSlot[] = ['weapon', 'armor', 'gloves'];
            const rightSlots: ItemSlot[] = ['pants', 'boots', 'ring'];

            const handleCycleSkin = (dir: -1 | 1) => {
              if (!onEquipSkin || resolvedOwnedSkins.length === 0) {
                setActiveTab('collection');
                return;
              }
              const curIdx = resolvedOwnedSkins.findIndex(
                (s) => s.id === hero.activeSkinId
              );
              const nextIdx =
                curIdx < 0
                  ? 0
                  : (curIdx + dir + resolvedOwnedSkins.length) %
                    resolvedOwnedSkins.length;
              const nextSkin = resolvedOwnedSkins[nextIdx];
              if (nextSkin) {
                onEquipSkin(nextSkin);
              }
            };

            const renderPaperDollSlot = (slot: ItemSlot, side: 'left' | 'right') => {
              const info = SLOT_INFO[slot];
              const item = equipped[slot];
              const quality = item ? getQualityConfig(item.quality) : null;
              const curDur = item
                ? item.durability ?? item.maxDurability ?? getItemDefaultMaxDurability(item.lvl)
                : 0;
              const maxDur = item
                ? item.maxDurability ?? getItemDefaultMaxDurability(item.lvl)
                : 0;

              return (
                <div
                  key={slot}
                  onClick={() => {
                    if (!item) onOpenInventory();
                  }}
                  title={
                    item
                      ? `${info.name}: ${item.name} (Ур.${item.lvl})`
                      : `${info.name}: пусто (нажмите, чтобы открыть Сумку)`
                  }
                  className={`relative flex flex-col justify-between rounded-xl border p-1.5 min-h-[72px] transition-all ${
                    !item
                      ? 'cursor-pointer hover:border-amber-500/50 hover:bg-slate-800/70 active:scale-[0.98]'
                      : ''
                  }`}
                  style={{
                    borderColor: item ? quality?.color : 'rgba(217, 119, 6, 0.55)',
                    background: item
                      ? 'linear-gradient(145deg, rgba(42, 27, 14, 0.94) 0%, rgba(15, 23, 42, 0.97) 100%)'
                      : 'linear-gradient(145deg, rgba(28, 19, 10, 0.88) 0%, rgba(10, 14, 24, 0.94) 100%)',
                    boxShadow: item
                      ? `0 0 12px ${quality?.color}35, inset 0 1px 0 rgba(251,191,36,0.18)`
                      : 'inset 0 1px 4px rgba(0,0,0,0.7), 0 0 6px rgba(217,119,6,0.12)'
                  }}
                >
                  {/* Top Row: Egyptian Slot Icon + Slot Title & Level */}
                  <div
                    className={`flex items-center gap-1.5 ${
                      side === 'right' ? 'flex-row' : 'flex-row'
                    }`}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-slate-950/95 p-1 text-base shadow-inner overflow-hidden"
                      style={{
                        borderColor: item ? `${quality?.color}99` : 'rgba(217, 119, 6, 0.55)'
                      }}
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
                          imgClassName="w-full h-full object-contain opacity-65"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[8px] font-extrabold uppercase tracking-wider text-amber-300/90 truncate">
                          {info.name}
                        </span>
                        {item && (
                          <span className="shrink-0 rounded bg-slate-950/90 px-1 py-[0.5px] text-[7.5px] font-black text-amber-300 border border-amber-500/30">
                            {item.lvl} ур.
                          </span>
                        )}
                      </div>
                      {item ? (
                        <div
                          className="truncate text-[9px] font-extrabold leading-tight mt-0.5"
                          style={{ color: quality?.color }}
                        >
                          {item.name}
                        </div>
                      ) : (
                        <div className="text-[8.5px] text-slate-500 italic leading-tight mt-0.5">
                          + Одеть
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Row: Stats, Durability & Unequip Button */}
                  {item ? (
                    <div className="mt-1 pt-1 border-t border-slate-800/80 flex items-center justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-x-1 gap-y-0.5 text-[7.5px] font-bold leading-none">
                          {item.dmg > 0 && (
                            <span className="text-amber-300">+{item.dmg}⚔️</span>
                          )}
                          {item.hp > 0 && (
                            <span className="text-red-300">+{item.hp}❤️</span>
                          )}
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
                        <div className="text-[7px] text-amber-400/90 font-semibold mt-0.5 leading-none">
                          🔧 {curDur}/{maxDur}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnequip(slot);
                        }}
                        className="shrink-0 rounded bg-red-950/90 px-1.5 py-0.5 text-[7.5px] font-extrabold text-red-300 border border-red-500/50 hover:bg-red-800 hover:text-white active:scale-95 cursor-pointer"
                        title="Снять предмет в сумку"
                      >
                        Снять
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center justify-between text-[7.5px] text-slate-500">
                      <span>Пустой слот</span>
                      <span className="text-amber-400/80 font-bold">🎒 Сумка ➔</span>
                    </div>
                  )}
                </div>
              );
            };

            return (
              <>
                {/* 1. Compact Player Header & Vitals Card */}
                <div className="rounded-xl border border-amber-500/40 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-2.5 shadow-lg space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/20 border border-amber-400/60 text-xs font-black text-amber-300 shrink-0">
                        {hero.level}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-xs font-black text-amber-300 truncate">
                          {isPremActive && <span title="Премиум VIP">👑</span>}
                          <span className="truncate">{currentUser || 'Игрок'}</span>
                          {isPremActive && (
                            <span className="rounded bg-yellow-500/20 border border-yellow-500/50 px-1 py-0.2 text-[8px] font-black text-yellow-300 shrink-0">
                              VIP
                            </span>
                          )}
                        </div>
                        <div className="text-[8.5px] text-slate-400 truncate">
                          Ур. {hero.level} • Сумка: {effectiveBagCapacity} сл. • Вход:{' '}
                          <span className="text-slate-300 font-semibold">
                            {formatFullDateTime(hero.lastSeen || hero.last_seen || Date.now())}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Currency Balances */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 text-[9.5px] font-black text-amber-300">
                        🪙 {hero.gold.toLocaleString('ru-RU')}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 text-[9.5px] font-black text-cyan-200">
                        💎 {hero.crystals.toLocaleString('ru-RU')}
                      </span>
                    </div>
                  </div>

                  {/* Health & Energy Bars side by side */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="relative h-3.5 w-full overflow-hidden rounded-md bg-slate-800 border border-red-500/40">
                      <div
                        className="h-full bg-gradient-to-r from-red-700 to-red-500 transition-all duration-300"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(
                              100,
                              ((Number.isFinite(hero.hp) ? hero.hp : totalHp) /
                                Math.max(1, totalHp)) *
                                100
                            )
                          )}%`
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center text-[7.5px] font-extrabold text-white drop-shadow tabular-nums">
                        ❤️ {Number.isFinite(hero.hp) ? hero.hp : totalHp} / {totalHp} HP
                      </div>
                    </div>
                    <div className="relative h-3.5 w-full overflow-hidden rounded-md bg-slate-800 border border-sky-500/40">
                      <div
                        className="h-full bg-gradient-to-r from-sky-700 to-cyan-500 transition-all duration-300"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(
                              100,
                              ((Number.isFinite(hero.energy) ? hero.energy : 100) /
                                Math.max(1, statsBreakdown.totalMaxEnergy)) *
                                100
                            )
                          )}%`
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center text-[7.5px] font-extrabold text-white drop-shadow tabular-nums">
                        ⚡ {Number.isFinite(hero.energy) ? hero.energy : 100} /{' '}
                        {statsBreakdown.totalMaxEnergy} EN
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. ELEVATED RPG PAPER-DOLL EQUIPMENT & FULL-BODY SKIN SHOWCASE */}
                <div
                  className="rounded-2xl border-2 border-amber-500/50 p-2 sm:p-2.5 shadow-[0_0_25px_rgba(245,158,11,0.15)] space-y-2"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 45%, rgba(147, 51, 234, 0.16) 0%, rgba(30, 20, 12, 0.92) 55%, rgba(9, 13, 22, 0.98) 100%)'
                  }}
                >
                  <div className="flex items-center justify-between px-0.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                      <span>𓂀 Египетская Амуниция и Облик Воина</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('collection')}
                      className="rounded-md border border-purple-400/60 bg-purple-950/70 px-2 py-0.5 text-[8.5px] font-black text-purple-200 hover:bg-purple-800/80 active:scale-95 cursor-pointer"
                    >
                      🎭 Скины ({resolvedOwnedSkins.length})
                    </button>
                  </div>

                  {/* 3-Column Paper-Doll Grid: Left Gear | Center Full-Body Character Skin | Right Gear */}
                  <div className="grid grid-cols-[1fr_1.18fr_1fr] gap-1.5 sm:gap-2 items-stretch">
                    {/* Left Equipment Column: Weapon, Armor, Gloves */}
                    <div className="flex flex-col justify-between gap-1.5 min-w-0">
                      {leftSlots.map((slot) => renderPaperDollSlot(slot, 'left'))}
                    </div>

                    {/* Center Full-Body Character Skin Pedestal */}
                    <div
                      className="relative flex flex-col items-center justify-between rounded-xl border-2 p-1.5 overflow-hidden select-none"
                      style={{
                        borderColor: activeSkinQuality?.color || '#f59e0b',
                        background:
                          'radial-gradient(ellipse at 50% 45%, rgba(245, 158, 11, 0.22) 0%, rgba(88, 28, 135, 0.28) 48%, rgba(9, 6, 15, 0.96) 100%)',
                        boxShadow: `inset 0 0 22px ${
                          activeSkinQuality?.color || '#f59e0b'
                        }33, 0 0 14px rgba(0,0,0,0.8)`
                      }}
                    >
                      {/* Top Active Skin Name & Level Badge */}
                      <div className="w-full text-center border-b border-amber-500/25 pb-1 z-10">
                        <div
                          className="truncate text-[9px] font-black leading-tight drop-shadow"
                          style={{ color: activeSkinQuality?.color || '#fde047' }}
                        >
                          {activeSkin ? `🎭 ${activeSkin.name}` : '👤 Стандартный облик'}
                        </div>
                        <div className="text-[7.5px] font-bold text-slate-300 leading-none mt-0.5">
                          {activeSkin
                            ? `${activeSkinQuality?.name || 'Редкий'} • ${activeSkin.lvl} ур.`
                            : `Герой ${hero.level} ур.`}
                        </div>
                      </div>

                      {/* Center Full-Height Character Avatar + Optional Quick Switch Arrows */}
                      <div className="relative flex-1 w-full flex items-center justify-center my-1 min-h-[145px] sm:min-h-[165px]">
                        {/* Ambient Glow Aura */}
                        <div
                          className="pointer-events-none absolute inset-3 rounded-full blur-xl opacity-45"
                          style={{
                            backgroundColor: activeSkinQuality?.color || '#f59e0b'
                          }}
                        />

                        {/* Left Quick Skin Switch Arrow */}
                        {resolvedOwnedSkins.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleCycleSkin(-1)}
                            title="Предыдущий скин"
                            className="absolute left-0.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-amber-400/60 bg-slate-950/85 text-[10px] font-black text-amber-300 hover:bg-amber-500 hover:text-slate-950 active:scale-90 shadow cursor-pointer"
                          >
                            ◀
                          </button>
                        )}

                        {/* Full-Body Character Sprite in Full Height */}
                        <div
                          onClick={() => setActiveTab('collection')}
                          title="Нажмите, чтобы выбрать или сменить скин персонажа"
                          className="relative z-10 flex h-[142px] sm:h-[160px] w-full items-center justify-center px-2 cursor-pointer transition-transform hover:scale-[1.03]"
                        >
                          <CharacterAvatar
                            avatar={activeSkinSprite}
                            nick={currentUser}
                            fullBody={true}
                            size="full"
                            className="w-full h-full max-h-[156px] object-contain"
                          />
                        </div>

                        {/* Right Quick Skin Switch Arrow */}
                        {resolvedOwnedSkins.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleCycleSkin(1)}
                            title="Следующий скин"
                            className="absolute right-0.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-amber-400/60 bg-slate-950/85 text-[10px] font-black text-amber-300 hover:bg-amber-500 hover:text-slate-950 active:scale-90 shadow cursor-pointer"
                          >
                            ▶
                          </button>
                        )}

                        {/* Golden RPG Pedestal Floor under character's feet */}
                        <div className="pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4/5 h-2.5 rounded-full bg-gradient-to-r from-transparent via-amber-500/45 to-transparent blur-[1px] border-b border-amber-400/60" />
                      </div>

                      {/* Bottom Skin Bonuses & Change Skin Action */}
                      <div className="w-full z-10 space-y-1 pt-0.5 border-t border-amber-500/20">
                        {activeSkin && (
                          <div className="truncate text-center text-[7.5px] font-bold text-emerald-300 px-1">
                            {formatSkinBonusesText(activeSkin)}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setActiveTab('collection')}
                            className="flex-1 rounded-lg bg-gradient-to-r from-purple-600/90 to-indigo-600/90 border border-purple-400/70 py-1 text-[8px] font-black text-white hover:brightness-110 active:scale-95 shadow cursor-pointer"
                          >
                            🎭 Сменить скин
                          </button>
                          {activeSkin && onEquipSkin && (
                            <button
                              type="button"
                              onClick={() => onEquipSkin(null)}
                              title="Снять скин"
                              className="shrink-0 rounded-lg bg-slate-900 border border-slate-600 px-1.5 py-1 text-[8px] font-bold text-slate-300 hover:bg-red-950 hover:text-red-200 hover:border-red-500/50 active:scale-95 cursor-pointer"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Equipment Column: Pants, Boots, Ring */}
                    <div className="flex flex-col justify-between gap-1.5 min-w-0">
                      {rightSlots.map((slot) => renderPaperDollSlot(slot, 'right'))}
                    </div>
                  </div>
                </div>

                {/* 3. Quick Action Menu Buttons */}
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={onOpenInventory}
                    className="rounded-lg bg-amber-600/25 p-2 text-[10px] font-extrabold text-amber-300 border border-amber-500/60 hover:bg-amber-600/40 active:scale-95 shadow"
                  >
                    🎒 Сумка ({effectiveBagCapacity})
                  </button>
                  <button
                    onClick={onOpenStats}
                    className="relative rounded-lg bg-slate-800 p-2 text-[10px] font-bold text-slate-200 border border-slate-700 hover:bg-slate-700 active:scale-95"
                  >
                    📊 Статы
                    {hero.statPoints > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-black text-white ring-2 ring-slate-950 animate-bounce shadow-[0_0_8px_#ef4444]">
                        {hero.statPoints}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('mail');
                      if (onMarkMailRead) onMarkMailRead();
                    }}
                    className="relative rounded-lg bg-sky-950/80 p-2 text-[10px] font-bold text-sky-300 border border-sky-500/50 hover:bg-sky-900/80 active:scale-95"
                  >
                    📩 Почта
                    {unreadMailCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-black text-white ring-2 ring-slate-950 animate-bounce">
                        {unreadMailCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={onOpenFriends}
                    className="rounded-lg bg-slate-800 p-2 text-[10px] font-bold text-slate-200 border border-slate-700 hover:bg-slate-700 active:scale-95"
                  >
                    👥 Друзья
                  </button>
                  <button
                    onClick={onOpenTradeProtocol}
                    className="rounded-lg bg-slate-800 p-2 text-[10px] font-bold text-slate-200 border border-slate-700 hover:bg-slate-700 active:scale-95"
                  >
                    📜 Протокол
                  </button>
                  <button
                    onClick={onOpenDirectTransfer}
                    className="rounded-lg bg-slate-800 p-2 text-[10px] font-bold text-slate-200 border border-slate-700 hover:bg-slate-700 active:scale-95"
                  >
                    💸 Передача
                  </button>
                  {onOpenShop && (
                    <button
                      onClick={onOpenShop}
                      className="rounded-lg bg-emerald-950/70 p-2 text-[10px] font-extrabold text-emerald-300 border border-emerald-500/60 hover:bg-emerald-900/70 active:scale-95"
                    >
                      🛒 Магазин
                    </button>
                  )}
                  {onOpenCreateItem && (
                    <button
                      onClick={onOpenCreateItem}
                      className="rounded-lg bg-cyan-900/50 p-2 text-[10px] font-extrabold text-cyan-200 border border-cyan-400/70 hover:bg-cyan-800/70 active:scale-95"
                    >
                      ⚒️ Создать оружие
                    </button>
                  )}
                  {onOpenLeaderboard && (
                    <button
                      onClick={onOpenLeaderboard}
                      className="rounded-lg bg-gradient-to-r from-amber-600/40 via-yellow-600/40 to-amber-600/40 p-2 text-[10px] font-extrabold text-amber-300 border border-amber-500/60 hover:from-amber-600/60 hover:to-yellow-600/60 active:scale-95 shadow"
                    >
                      🏆 Рейтинг
                    </button>
                  )}
                </div>

                {/* 4. Combat Stats Summary */}
                <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-2.5 text-[10px] space-y-1">
                  <div className="font-bold text-amber-400 mb-1">
                    ⚔️ Боевые характеристики и бонусы
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Урон (сила + экип.):</span>
                    <span className="font-bold text-amber-300">
                      {totalDmg} ({statsBreakdown.strDamage} + {statsBreakdown.gearDmg})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Здоровье (HP):</span>
                    <span className="font-bold text-red-300">
                      {hero.hp} / {totalHp} ({statsBreakdown.baseHp} + {statsBreakdown.gearHp}
                      {statsBreakdown.killerHpBonus > 0 ? ` + ${statsBreakdown.killerHpBonus}🏆` : ''})
                    </span>
                  </div>
                  {statsBreakdown.killerHpBonus > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Бонус достижения «Киллер» (Ур.{statsBreakdown.killerAchievementLvl}/5):</span>
                      <span className="font-bold text-emerald-300">
                        +{statsBreakdown.killerHpBonus} ❤️ HP навсегда
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Шанс уклонения:</span>
                    <span className="font-bold text-sky-300">
                      {dodgeChance}% ({statsBreakdown.baseDodgePct}% + {statsBreakdown.gearDodge}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Энергия:</span>
                    <span className="font-bold text-cyan-300">
                      {hero.energy} / {statsBreakdown.totalMaxEnergy} (100 +{' '}
                      {statsBreakdown.gearEnergy})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Бонус к золоту (перчатки):</span>
                    <span className="font-bold text-yellow-300">
                      +{statsBreakdown.gearGoldPct}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Бонус к опыту (кольцо):</span>
                    <span className="font-bold text-purple-300">
                      +{statsBreakdown.gearExpPct}%
                    </span>
                  </div>
                </div>

                {/* 4.5. Active Killer License Status & Countdown Timer («Добавить действия лицензии что бы не забыть») */}
                {(() => {
                  const killerUntil = Number(hero.killerLicenseUntil || 0);
                  const isKillerLicenseActive = killerUntil > nowMs;
                  const storedLicenses = Math.max(0, Number(hero.killerLicenses || 0));
                  const killerAch = getKillerAchievementInfo(hero.pvpKills || 0);

                  return (
                    <>
                      <div
                        className={`rounded-xl border-2 p-2.5 space-y-1.5 shadow-md ${
                          isKillerLicenseActive
                            ? 'border-red-500/75 bg-gradient-to-r from-red-950/85 via-amber-950/40 to-slate-950'
                            : 'border-slate-700 bg-slate-900/85'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-9 h-9 rounded-lg border border-red-500/60 bg-slate-950 p-1 shrink-0 flex items-center justify-center">
                              <ItemIcon
                                icon={KILLER_LICENSE_CONFIG.icon}
                                alt={KILLER_LICENSE_CONFIG.name}
                                imgClassName="w-full h-full object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-black uppercase tracking-wider text-red-300 flex items-center gap-1.5 flex-wrap">
                                <span>🗡️ Действие Лицензии киллера</span>
                                {storedLicenses > 0 && (
                                  <span className="rounded bg-amber-950 border border-amber-400/60 px-1.5 py-0.2 text-[8px] font-black text-amber-300">
                                    В запасе: {storedLicenses} шт.
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] text-slate-300 mt-0.5">
                                {isKillerLicenseActive ? (
                                  <span>
                                    🟢 Активна! Осталось:{' '}
                                    <strong className="font-mono text-emerald-300 text-[10px]">
                                      {formatLicenseRemainingTime(killerUntil, nowMs)}
                                    </strong>{' '}
                                    (только в Пирамиде)
                                  </span>
                                ) : (
                                  <span className="text-slate-400">
                                    ⚪ Не активна (10 💎 на 1 день в разделе «Магазин ➔ Лицензии»)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {storedLicenses > 0 && onUseKillerLicense && (
                              <button
                                type="button"
                                onClick={onUseKillerLicense}
                                className="rounded-lg border border-emerald-400 bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[8.5px] font-black text-white shadow active:scale-95 cursor-pointer"
                              >
                                🗡️ Использовать (+1 дн.)
                              </button>
                            )}
                            {onOpenShop && (
                              <button
                                type="button"
                                onClick={onOpenShop}
                                className="rounded-lg border border-amber-500/60 bg-amber-950/80 hover:bg-amber-900 px-2 py-1 text-[8.5px] font-bold text-amber-200 active:scale-95 cursor-pointer"
                              >
                                📜 В магазин
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 4.6. Achievement Block: «Киллер» (Levels 1-5, +100 HP permanently per level) */}
                      <div className="rounded-xl border-2 border-amber-500/55 bg-gradient-to-b from-[#22140d] via-slate-900 to-slate-950 p-2.5 space-y-2 shadow-[0_0_18px_rgba(245,158,11,0.15)]">
                        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-amber-500/25 pb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-10 h-10 rounded-xl border border-amber-400/70 bg-slate-950 p-1 shrink-0 flex items-center justify-center shadow-inner">
                              <ItemIcon
                                icon={KILLER_ACHIEVEMENT_SVG}
                                alt="Достижение Киллер"
                                imgClassName="w-full h-full object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10.5px] font-black uppercase tracking-wider text-amber-300">
                                🏆 Достижение: «Киллер» (Ур. {killerAch.level} / 5)
                              </div>
                              <div className="text-[8.5px] text-emerald-300 font-bold">
                                Навсегда к здоровью: +{killerAch.totalHpBonus} ❤️ HP (макс. +500 ❤️ HP)
                              </div>
                            </div>
                          </div>
                          <span className="rounded-lg bg-red-950/90 border border-red-500/60 px-2 py-0.5 text-[9px] font-black text-red-200">
                            ⚔️ Убито: {killerAch.kills} игр.
                          </span>
                        </div>

                        <div className="text-[8.5px] text-slate-300 leading-snug">
                          {KILLER_ACHIEVEMENT_DESCRIPTION}
                        </div>

                        {/* Progress bar to next Killer level */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[8.5px] font-bold">
                            <span className="text-slate-400">
                              {killerAch.isMaxLevel
                                ? '👑 Достигнут максимальный 5 уровень Киллера!'
                                : `Прогресс до ${killerAch.level + 1} ур. (+100 ❤️ HP навсегда):`}
                            </span>
                            <span className="text-amber-300 tabular-nums">
                              {killerAch.isMaxLevel
                                ? `${killerAch.kills} / 500 (МАКС.)`
                                : `${killerAch.kills} / ${killerAch.nextKillsRequired} игр. (осталось ${killerAch.killsRemainingForNext})`}
                            </span>
                          </div>
                          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800 border border-amber-500/40">
                            <div
                              className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 transition-all duration-300"
                              style={{ width: `${killerAch.progressPct}%` }}
                            />
                          </div>
                        </div>

                        {/* 5 Levels Grid: 10, 50, 100, 250, 500 */}
                        <div className="grid grid-cols-5 gap-1 pt-0.5">
                          {KILLER_ACHIEVEMENT_LEVELS.map((tier) => {
                            const unlocked = killerAch.kills >= tier.killsRequired;
                            return (
                              <div
                                key={tier.level}
                                className={`rounded-lg border p-1 text-center transition-all ${
                                  unlocked
                                    ? 'border-emerald-400 bg-emerald-950/55 text-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                                    : 'border-slate-800 bg-slate-900/80 text-slate-400'
                                }`}
                              >
                                <div className="text-[8px] font-black text-amber-300">
                                  {tier.level} ур. {unlocked ? '✅' : '🔒'}
                                </div>
                                <div className="text-[8px] font-extrabold mt-0.5">
                                  {tier.killsRequired} уб.
                                </div>
                                <div className="text-[7.5px] text-red-300 font-bold">
                                  +100 ❤️
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* 5. Active Bonuses / VIP Block */}
                <ActiveVipBonusesBlock
                  isPremium={isPremActive}
                  premiumUntil={hero.premiumUntil}
                  isOwnProfile={true}
                  onOpenPremium={onOpenPremium}
                />
              </>
            );
          })()}


          {/* Referral Program Section */}
          <div className="rounded-lg border border-purple-500/40 bg-purple-950/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-purple-300">
                🔗 Реферальная программа Фараона
              </div>
              <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[8px] font-bold text-purple-300 border border-purple-500/40">
                50 💎 + 3 000 🪙
              </span>
            </div>

            <div className="text-[9.5px] text-slate-300 leading-snug">
              Приглашайте союзников! Когда ваш реферал достигает{' '}
              <span className="font-bold text-amber-400">10 уровня</span>, активируется кнопка
              получения награды: <span className="font-bold text-cyan-300">50 Кристаллов</span> и{' '}
              <span className="font-bold text-amber-400">3 000 Золота</span>!
            </div>

            {/* Referral link copy */}
            <div className="rounded border border-purple-500/30 bg-slate-950/80 p-2 text-[9px] flex items-center justify-between">
              <span className="font-mono text-purple-200 select-all truncate mr-2">
                https://pyramida.wars/?ref={hero.referralCode || 'ref_pyramid'}
              </span>
              <button
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(
                      `https://pyramida.wars/?ref=${hero.referralCode || 'ref_pyramid'}`
                    );
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }
                }}
                className="shrink-0 rounded bg-purple-600 px-2 py-1 text-[8.5px] font-bold text-white hover:bg-purple-500 active:scale-95"
              >
                {copiedLink ? '✓ Скопировано' : 'Копировать'}
              </button>
            </div>

            {/* Invited Player Status */}
            {(() => {
              const refNick = hero.referralPlayerNick || '';
              const refLvl = hero.referralPlayerLvl ?? 0;
              const isClaimed = Boolean(hero.referralClaimed);
              const isLevel10Reached = refLvl >= 10 && Boolean(refNick);
              const percent = Math.min(100, (refLvl / 10) * 100);

              return (
                <div className="rounded border border-slate-800 bg-slate-950/90 p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-slate-400">Приглашенный реферал:</span>
                    <span className="font-bold text-amber-300">
                      {refNick ? `👤 ${refNick}` : 'Нет приглашенных'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[8.5px]">
                    <span className="text-slate-400">Уровень реферала:</span>
                    <span
                      className={
                        isLevel10Reached
                          ? 'font-bold text-emerald-400'
                          : 'font-bold text-amber-400'
                      }
                    >
                      {refLvl} / 10 ур.
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-800 border border-slate-700">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isLevel10Reached
                          ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                          : 'bg-gradient-to-r from-purple-500 to-amber-400'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  {isClaimed ? (
                    <button
                      disabled
                      className="w-full rounded bg-emerald-950 border border-emerald-500/40 py-2 text-[10px] font-bold text-emerald-300 opacity-90 cursor-default"
                    >
                      ✅ Награда за 10 ур. получена (+50 💎, +3 000 🪙)
                    </button>
                  ) : isLevel10Reached ? (
                    <button
                      onClick={() => onClaimReferralReward && onClaimReferralReward(refNick)}
                      className="w-full rounded bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-2 text-[10px] font-black uppercase text-slate-950 shadow-[0_0_15px_rgba(234,179,8,0.8)] animate-pulse hover:brightness-110 active:scale-95"
                    >
                      🎁 Забрать награду за 10 ур.! (+50 💎, +3 000 🪙)
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full rounded bg-slate-900 border border-slate-800 py-2 text-[9.5px] font-bold text-slate-500 opacity-60 cursor-not-allowed"
                      title="Награда станет доступна только когда реферал достигнет 10 уровня"
                    >
                      🔒 Награда заблокирована (требуется 10 ур. реферала)
                    </button>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Logout from account button */}
          {onLogout && (
            <div className="pt-2">
              <button
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full rounded-lg bg-red-950/80 border border-red-500/50 py-2.5 text-[10px] font-bold text-red-300 hover:bg-red-900 active:scale-95 transition-all shadow"
              >
                🚪 Выйти из аккаунта (Прогресс сохранен)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
