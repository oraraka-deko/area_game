import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import { Pool } from '@neondatabase/serverless';

dotenv.config();

// Upstash Redis connection using provided credentials
export const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://optimal-adder-314592.upstash.io';
export const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'gQAAAAAABMzgAAIgcDFiMzI3MGNhMmZmNDk0ZTAyOTAyMzljMTNmY2MyYTRmZQ';

export const redis = new Redis({
  url: UPSTASH_URL,
  token: UPSTASH_TOKEN,
});

// Default Admin and Service configuration
export interface SystemConfig {
  adminTelegramIds: string[];
  depositWalletAddress: string;
  hotWalletMnemonic: string;
  toncenterApiKey: string;
  toncenterApiKeyTestnet: string;
  botStarsToken: string;
  isTestnet: boolean;
  neonConnectionString?: string;
}

export const DEFAULT_CONFIG: SystemConfig = {
  adminTelegramIds: ['8903710651', 'mojolojo275', 'admin'],
  depositWalletAddress: 'EQBvW8Z5huBkMJYdnF64PT5fqJZW2elETRRFFsA-b281bf20',
  hotWalletMnemonic: '',
  toncenterApiKey: '4b6bd05c1bb6b913cd8790c8400f2d4f43845cc0117ceaff5f16466d651f3323',
  toncenterApiKeyTestnet: '2372c82211e6c16b1f5ce63e048239d9b022bc20416c17e09cec127197e52cb7',
  botStarsToken: '8903710651:AAEGEg0vKNsPOV62yc2reqv_EqCLckKsI2Y',
  isTestnet: false,
  neonConnectionString: process.env.DATABASE_URL || ''
};

// Rate Limiter for TonCenter API: max 10 requests per second
class TonCenterRateLimiter {
  private queue: Array<() => void> = [];
  private tokens: number = 10;
  private maxTokens: number = 10;
  private intervalMs: number = 1000;
  private lastRefill: number = Date.now();
  private callCount: number = 0;

  constructor() {
    setInterval(() => this.refill(), 100);
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed > 0) {
      const added = (elapsed / this.intervalMs) * this.maxTokens;
      this.tokens = Math.min(this.maxTokens, this.tokens + added);
      this.lastRefill = now;
    }
    while (this.queue.length > 0 && this.tokens >= 1) {
      this.tokens -= 1;
      this.callCount++;
      const next = this.queue.shift();
      if (next) next();
    }
  }

  public async schedule<T>(fn: () => Promise<T>): Promise<T> {
    if (this.tokens >= 1) {
      this.tokens -= 1;
      this.callCount++;
      return fn();
    }
    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => {
        fn().then(resolve).catch(reject);
      });
    });
  }

  public getStats() {
    return {
      availableTokens: Math.floor(this.tokens),
      queueLength: this.queue.length,
      totalCalls: this.callCount
    };
  }
}

export const tonRateLimiter = new TonCenterRateLimiter();

// System configuration manager in Redis
export async function getSystemConfig(): Promise<SystemConfig> {
  try {
    const data = await redis.get<SystemConfig>('config:system');
    if (data) {
      return { ...DEFAULT_CONFIG, ...data };
    }
  } catch (err) {
    console.error('Error fetching system config from Redis, falling back to default:', err);
  }
  return DEFAULT_CONFIG;
}

export async function updateSystemConfig(patch: Partial<SystemConfig>): Promise<SystemConfig> {
  const current = await getSystemConfig();
  const updated = { ...current, ...patch };
  await redis.set('config:system', updated);
  return updated;
}

// User in-app wallet interface
export interface UserInAppWallet {
  userId: string;
  username: string;
  tonBalance: number; // In TON (e.g. 1.25)
  starsBalance: number; // Integer Telegram Stars
  credits: number; // Game credits
  connectedWallet?: string;
  updatedAt: number;
}

export interface LedgerTransaction {
  id: string;
  userId: string;
  type: 'DEPOSIT_TON' | 'DEPOSIT_STARS' | 'WITHDRAW_TON' | 'GAME_CREDIT_TOPUP' | 'GIFT_BUY' | 'GIFT_DEPOSIT';
  amountTon?: number;
  amountStars?: number;
  amountCredits?: number;
  status: 'PENDING_WALLET' | 'PENDING_ON_CHAIN' | 'CONFIRMED' | 'REJECTED' | 'FAILED';
  comment?: string;
  txHash?: string;
  boc?: string;
  details?: Record<string, any>;
  createdAt: number;
  confirmedAt?: number;
}

export async function getUserWallet(userId: string, defaultUsername = 'Player'): Promise<UserInAppWallet> {
  const key = `user:${userId}:wallet`;
  try {
    const wallet = await redis.get<UserInAppWallet>(key);
    if (wallet) {
      return wallet;
    }
  } catch (e) {
    console.error(`Error reading wallet for ${userId}:`, e);
  }

  // Create default wallet
  const newWallet: UserInAppWallet = {
    userId,
    username: defaultUsername,
    tonBalance: 0,
    starsBalance: 100, // starter stars bonus
    credits: 1000,
    updatedAt: Date.now()
  };

  try {
    await redis.set(key, newWallet);
  } catch (e) {
    console.error(`Error creating wallet for ${userId}:`, e);
  }
  return newWallet;
}

export async function updateUserWallet(
  userId: string,
  updater: (prev: UserInAppWallet) => Partial<UserInAppWallet>
): Promise<UserInAppWallet> {
  const current = await getUserWallet(userId);
  const patch = updater(current);
  const updated: UserInAppWallet = {
    ...current,
    ...patch,
    updatedAt: Date.now()
  };
  await redis.set(`user:${userId}:wallet`, updated);
  return updated;
}

export async function recordLedgerTransaction(tx: LedgerTransaction): Promise<void> {
  try {
    const key = `ledger:tx:${tx.id}`;
    await redis.set(key, tx);

    // Add to user transaction list
    await redis.lpush(`user:${tx.userId}:txs`, tx.id);
    // Keep user history to 100 items
    await redis.ltrim(`user:${tx.userId}:txs`, 0, 99);

    // Add to global recent transactions list
    await redis.lpush('ledger:recent_txs', tx.id);
    await redis.ltrim('ledger:recent_txs', 0, 199);
  } catch (err) {
    console.error('Error recording ledger transaction:', err);
  }
}

export async function updateLedgerTransaction(
  txId: string,
  patch: Partial<LedgerTransaction>
): Promise<LedgerTransaction | null> {
  try {
    const key = `ledger:tx:${txId}`;
    const tx = await redis.get<LedgerTransaction>(key);
    if (!tx) return null;
    const updated = { ...tx, ...patch };
    await redis.set(key, updated);
    return updated;
  } catch (err) {
    console.error(`Error updating ledger transaction ${txId}:`, err);
    return null;
  }
}

export async function getUserTransactions(userId: string): Promise<LedgerTransaction[]> {
  try {
    const ids = await redis.lrange(`user:${userId}:txs`, 0, 49);
    if (!ids || ids.length === 0) return [];
    
    const txs: LedgerTransaction[] = [];
    for (const id of ids) {
      const tx = await redis.get<LedgerTransaction>(`ledger:tx:${id}`);
      if (tx) txs.push(tx);
    }
    return txs;
  } catch (err) {
    console.error(`Error getting user transactions for ${userId}:`, err);
    return [];
  }
}

export async function getGlobalRecentTransactions(limit = 50): Promise<LedgerTransaction[]> {
  try {
    const ids = await redis.lrange('ledger:recent_txs', 0, limit - 1);
    if (!ids || ids.length === 0) return [];

    const txs: LedgerTransaction[] = [];
    for (const id of ids) {
      const tx = await redis.get<LedgerTransaction>(`ledger:tx:${id}`);
      if (tx) txs.push(tx);
    }
    return txs;
  } catch (err) {
    console.error('Error getting global transactions:', err);
    return [];
  }
}

// User inventory for gifts
export interface UserGiftItem {
  instanceId: string;
  giftId: string;
  name: string;
  priceStars: number;
  acquiredAt: number;
  modelName?: string;
  backdropColor?: string;
  edgeColor?: string;
  symbolName?: string;
  rarity?: number;
}

export async function getUserGifts(userId: string): Promise<UserGiftItem[]> {
  try {
    const gifts = await redis.get<UserGiftItem[]>(`user:${userId}:gifts`);
    return gifts || [];
  } catch (err) {
    console.error('Error fetching user gifts:', err);
    return [];
  }
}

export async function addUserGift(userId: string, gift: UserGiftItem): Promise<UserGiftItem[]> {
  const current = await getUserGifts(userId);
  const updated = [gift, ...current];
  await redis.set(`user:${userId}:gifts`, updated);
  return updated;
}
