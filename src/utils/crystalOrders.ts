import { CrystalOrder, PrivateMessage } from '../types/game';
import {
  saveGlobalMailAndChatToSupabase,
  fetchGlobalMailAndChatFromSupabase,
  adminModifyPlayerBalanceInSupabase,
  subscribeToGlobalMailAndChat,
  GlobalMailAndChatState
} from './supabase';

const STORAGE_KEY = 'pyramid_crystal_orders_v1';

let inMemoryOrders: CrystalOrder[] = [];
let isInitialized = false;
const listeners = new Set<(orders: CrystalOrder[]) => void>();

function notifyListeners(orders: CrystalOrder[]) {
  listeners.forEach((fn) => {
    try {
      fn(orders);
    } catch (e) {
      // ignore
    }
  });
}

export function subscribeToCrystalOrders(callback: (orders: CrystalOrder[]) => void): () => void {
  listeners.add(callback);
  callback(getCachedCrystalOrders());
  return () => {
    listeners.delete(callback);
  };
}

export function getCachedCrystalOrders(): CrystalOrder[] {
  if (!isInitialized) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          inMemoryOrders = parsed;
        }
      }
    } catch (e) {
      // ignore
    }
    isInitialized = true;
  }
  return inMemoryOrders;
}

export function saveOrdersToStorage(orders: CrystalOrder[]): void {
  inMemoryOrders = orders;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders.slice(-200)));
  } catch (e) {
    // ignore
  }
  notifyListeners(orders);
}

/**
 * Normalizes Telegram input to a clean @username and a valid https://t.me/ link
 */
export function parseTelegramContact(input: string): { display: string; link: string | null } {
  const trimmed = (input || '').trim();
  if (!trimmed) return { display: '', link: null };

  if (trimmed.startsWith('https://t.me/') || trimmed.startsWith('http://t.me/')) {
    const username = trimmed.replace(/^https?:\/\/t\.me\//, '').replace(/\//g, '');
    return {
      display: `@${username}`,
      link: `https://t.me/${username}`
    };
  }

  const clean = trimmed.replace(/^@/, '').trim();
  // Check if it looks like a phone number (e.g. starts with + or numbers)
  if (/^\+?\d[\d\s-]{6,}$/.test(clean)) {
    const num = clean.replace(/[\s-]/g, '');
    return {
      display: num,
      link: `https://t.me/${num}`
    };
  }

  if (clean.length > 0) {
    return {
      display: `@${clean}`,
      link: `https://t.me/${clean}`
    };
  }

  return { display: trimmed, link: null };
}

/**
 * Initializes and syncs crystal orders from Supabase __GLOBAL_MAIL__
 */
export async function initCrystalOrdersSync(): Promise<CrystalOrder[]> {
  try {
    const globalState = await fetchGlobalMailAndChatFromSupabase();
    if (globalState && Array.isArray((globalState as any).crystalOrders)) {
      const remoteOrders: CrystalOrder[] = (globalState as any).crystalOrders;
      const local = getCachedCrystalOrders();
      const map = new Map<string, CrystalOrder>();
      remoteOrders.forEach((o) => map.set(o.id, o));
      local.forEach((o) => {
        if (!map.has(o.id)) map.set(o.id, o);
      });
      const merged = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      saveOrdersToStorage(merged);
      return merged;
    }
  } catch (e) {
    console.warn('[CrystalOrders] Error syncing from Supabase:', e);
  }
  return getCachedCrystalOrders();
}

/**
 * Creates a new crystal order submitted by a player.
 * Also generates a receipt in the player's personal mailbox.
 */
export async function createCrystalOrder(params: {
  playerNick: string;
  playerLevel: number;
  playerClan?: string;
  playerAvatar?: string;
  telegramContact: string;
  crystals: number;
  bonusCrystals?: number;
  priceUsd: number;
}): Promise<CrystalOrder> {
  const now = Date.now();
  const orderId = `ORD-${now.toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  const cleanContact = parseTelegramContact(params.telegramContact).display || params.telegramContact.trim();

  const newOrder: CrystalOrder = {
    id: orderId,
    playerNick: params.playerNick.trim(),
    playerLevel: params.playerLevel,
    playerClan: params.playerClan,
    playerAvatar: params.playerAvatar,
    telegramContact: cleanContact,
    crystals: params.crystals,
    bonusCrystals: params.bonusCrystals || 0,
    priceUsd: params.priceUsd,
    status: 'pending',
    createdAt: now
  };

  // 1. Save locally
  const current = getCachedCrystalOrders();
  const updated = [newOrder, ...current.filter((o) => o.id !== orderId)];
  saveOrdersToStorage(updated);

  // 2. Sync to Supabase global state with confirmation message for player
  try {
    await saveGlobalMailAndChatToSupabase((cur: GlobalMailAndChatState) => {
      const existingOrders: CrystalOrder[] = Array.isArray((cur as any).crystalOrders)
        ? (cur as any).crystalOrders
        : [];
      const nextOrders = [newOrder, ...existingOrders.filter((o) => o.id !== orderId)].slice(0, 150);

      // Automated receipt mail for the player
      const receiptMsg: PrivateMessage = {
        id: `ord_receipt_${orderId}`,
        from: '👑 Администратор (Банк)',
        to: params.playerNick.trim(),
        text: `📦 Ваш заказ #${orderId} на ${params.crystals} 💎 (${params.priceUsd}$) успешно зарегистрирован! Контакт для связи: ${cleanContact}. Администратор свяжется с вами в Telegram для оплаты и начислит кристаллы на вашего персонажа.`,
        time: now,
        timestamp: now,
        timeStr: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false
      };

      // Notification mail for the admin mailbox
      const adminOrderMail: PrivateMessage = {
        id: `ord_admin_${orderId}`,
        from: `Игрок ${params.playerNick.trim()}`,
        to: '👑 АДМИНИСТРАТОР',
        text: `📦 [Новый заказ кристаллов] Игрок ${params.playerNick.trim()} (Ур.${params.playerLevel}) заказал ${params.crystals} 💎 (${params.priceUsd}$). Telegram: ${cleanContact}. Заказ #${orderId}.`,
        time: now,
        timestamp: now,
        timeStr: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false
      };

      return {
        ...cur,
        crystalOrders: nextOrders,
        messages: [...cur.messages, receiptMsg, adminOrderMail],
        updatedAt: now
      } as any;
    });
  } catch (e) {
    console.warn('[CrystalOrders] Error saving to Supabase:', e);
  }

  return newOrder;
}

/**
 * Updates order status: 'completed' (fulfills & credits crystals) or 'rejected'
 */
export async function updateCrystalOrderStatus(
  orderId: string,
  status: 'completed' | 'rejected',
  adminNick: string = 'Администратор',
  adminNote?: string
): Promise<{ success: boolean; orders: CrystalOrder[]; error?: string }> {
  const current = getCachedCrystalOrders();
  const target = current.find((o) => o.id === orderId);
  if (!target) {
    return { success: false, orders: current, error: 'Заказ не найден' };
  }

  const now = Date.now();
  const updatedOrder: CrystalOrder = {
    ...target,
    status,
    completedAt: now,
    completedBy: adminNick,
    adminNote: adminNote || target.adminNote
  };

  const nextOrders = current.map((o) => (o.id === orderId ? updatedOrder : o));
  saveOrdersToStorage(nextOrders);

  // If completed, automatically credit crystals to player balance in Supabase!
  if (status === 'completed') {
    const totalCrystals = target.crystals + (target.bonusCrystals || 0);
    try {
      await adminModifyPlayerBalanceInSupabase(target.playerNick, {
        crystalsDelta: totalCrystals
      });
    } catch (e) {
      console.warn('[CrystalOrders] Failed to credit crystals automatically:', e);
    }
  }

  // Sync to Supabase global state and send confirmation mail to player
  try {
    await saveGlobalMailAndChatToSupabase((cur: GlobalMailAndChatState) => {
      const existingOrders: CrystalOrder[] = Array.isArray((cur as any).crystalOrders)
        ? (cur as any).crystalOrders
        : [];
      const updatedRemote = existingOrders.map((o) => (o.id === orderId ? updatedOrder : o));

      const notificationMsg: PrivateMessage = {
        id: `ord_status_${orderId}_${status}`,
        from: '👑 Администратор (Банк)',
        to: target.playerNick,
        text:
          status === 'completed'
            ? `🎉 Ваш заказ #${orderId} на ${target.crystals} 💎 успешно оплачен и зачислен на ваш баланс! Спасибо за поддержку игры! Приятной игры!`
            : `❌ Ваш заказ #${orderId} на ${target.crystals} 💎 был отклонён.${adminNote ? ` Причина: ${adminNote}` : ' Если у вас возникли вопросы, напишите Администратору.'}`,
        time: now,
        timestamp: now,
        timeStr: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false
      };

      return {
        ...cur,
        crystalOrders: updatedRemote,
        messages: [...cur.messages, notificationMsg],
        updatedAt: now
      } as any;
    });
  } catch (e) {
    console.warn('[CrystalOrders] Error syncing status to Supabase:', e);
  }

  return { success: true, orders: nextOrders };
}

/**
 * Deletes an order from the list
 */
export async function deleteCrystalOrder(orderId: string): Promise<CrystalOrder[]> {
  const current = getCachedCrystalOrders();
  const nextOrders = current.filter((o) => o.id !== orderId);
  saveOrdersToStorage(nextOrders);

  try {
    await saveGlobalMailAndChatToSupabase((cur: GlobalMailAndChatState) => {
      const existingOrders: CrystalOrder[] = Array.isArray((cur as any).crystalOrders)
        ? (cur as any).crystalOrders
        : [];
      return {
        ...cur,
        crystalOrders: existingOrders.filter((o) => o.id !== orderId),
        updatedAt: Date.now()
      } as any;
    });
  } catch (e) {
    console.warn('[CrystalOrders] Error deleting order from Supabase:', e);
  }

  return nextOrders;
}
