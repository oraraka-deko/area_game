import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import { Pool } from '@neondatabase/serverless';

dotenv.config();

// Primary Neon PostgreSQL Connection URL
export const NEON_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_e8OPwHj3fQlr@ep-lingering-river-b5z4kwub-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';

export const pgPool = new Pool({
  connectionString: NEON_URL
});

// Upstash Redis connection for fast caching and rate limiting
export const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://optimal-adder-314592.upstash.io';
export const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'gQAAAAAABMzgAAIgcDFiMzI3MGNhMmZmNDk0ZTAyOTAyMzljMTNmY2MyYTRmZQ';

export const redis = new Redis({
  url: UPSTASH_URL,
  token: UPSTASH_TOKEN,
});

// Ensure database schema tables exist on server startup
export async function initDatabase(): Promise<void> {
  try {
    const schemaSql = `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(128) PRIMARY KEY,
        username VARCHAR(128) NOT NULL,
        avatar TEXT,
        credits BIGINT NOT NULL DEFAULT 2500,
        ton_balance NUMERIC(20, 9) NOT NULL DEFAULT 0,
        stars_balance BIGINT NOT NULL DEFAULT 100,
        connected_wallet VARCHAR(128),
        inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
        stats JSONB NOT NULL DEFAULT '{"roundsPlayed":0,"roundsWon":0,"totalWagered":0,"biggestWin":0}'::jsonb,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ledger_transactions (
        id VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL,
        type VARCHAR(64) NOT NULL,
        amount_ton NUMERIC(20, 9) DEFAULT 0,
        amount_stars BIGINT DEFAULT 0,
        amount_credits BIGINT DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING_WALLET',
        comment TEXT,
        tx_hash TEXT,
        boc TEXT,
        details JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        confirmed_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS game_rounds (
        id VARCHAR(128) PRIMARY KEY,
        game_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(128) NOT NULL,
        bet_amount BIGINT NOT NULL,
        payout_amount BIGINT NOT NULL DEFAULT 0,
        multiplier NUMERIC(12, 4) NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
        server_seed TEXT,
        server_seed_hash TEXT,
        client_seed TEXT,
        game_details JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS task_claims (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL,
        task_id VARCHAR(128) NOT NULL,
        reward_credits BIGINT NOT NULL DEFAULT 0,
        reward_stars BIGINT NOT NULL DEFAULT 0,
        claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uniq_user_task UNIQUE(user_id, task_id)
      );

      CREATE TABLE IF NOT EXISTS user_activity_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(128),
        action VARCHAR(128) NOT NULL,
        details JSONB DEFAULT '{}'::jsonb,
        ip VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_gifts (
        instance_id VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL,
        gift_id VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        price_stars BIGINT NOT NULL DEFAULT 0,
        model_name VARCHAR(128),
        backdrop_color VARCHAR(64),
        edge_color VARCHAR(64),
        symbol_name VARCHAR(128),
        rarity NUMERIC(8, 2) DEFAULT 0,
        acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR(128) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger_transactions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_games_user ON game_rounds(user_id);
      CREATE INDEX IF NOT EXISTS idx_games_created ON game_rounds(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity_logs(created_at DESC);
    `;

    await pgPool.query(schemaSql);
    console.log('✅ Neon PostgreSQL tables verified & ready.');
  } catch (err) {
    console.error('⚠️ Neon schema initialization error:', err);
  }
}

// System configuration interface
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

// Resolve admin IDs from Cloud Run secret / environment variable
const envAdminIds = (process.env.ADMIN_ID || process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export const DEFAULT_CONFIG: SystemConfig = {
  adminTelegramIds: Array.from(new Set(['8903710651', 'mojolojo275', 'admin', 'usr_om3sgry', ...envAdminIds])),
  depositWalletAddress: process.env.DEPOSIT_WALLET_ADDRESS || 'EQBvW8Z5huBkMJYdnF64PT5fqJZW2elETRRFFsA-b281bf20',
  hotWalletMnemonic: process.env.HOT_WALLET_MNEMONIC || '',
  toncenterApiKey: process.env.TONCENTER_API_KEY || '4b6bd05c1bb6b913cd8790c8400f2d4f43845cc0117ceaff5f16466d651f3323',
  toncenterApiKeyTestnet: process.env.TONCENTER_API_KEY_TESTNET || '2372c82211e6c16b1f5ce63e048239d9b022bc20416c17e09cec127197e52cb7',
  botStarsToken: process.env.BOT_STARS_TOKEN || '8903710651:AAEGEg0vKNsPOV62yc2reqv_EqCLckKsI2Y',
  isTestnet: process.env.TON_IS_TESTNET === 'true',
  neonConnectionString: NEON_URL
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

// System configuration manager (Postgres primary, Redis cache fallback)
export async function getSystemConfig(): Promise<SystemConfig> {
  try {
    const pgRes = await pgPool.query('SELECT value FROM system_config WHERE key = $1', ['system_main']);
    if (pgRes.rows.length > 0) {
      const saved = pgRes.rows[0].value;
      const mergedAdmins = Array.from(new Set([...(saved.adminTelegramIds || []), ...DEFAULT_CONFIG.adminTelegramIds]));
      return { ...DEFAULT_CONFIG, ...saved, adminTelegramIds: mergedAdmins };
    }
  } catch (err) {
    console.warn('Could not read config from Postgres, trying Redis:', err);
  }

  try {
    const data = await redis.get<SystemConfig>('config:system');
    if (data) {
      const mergedAdmins = Array.from(new Set([...(data.adminTelegramIds || []), ...DEFAULT_CONFIG.adminTelegramIds]));
      return { ...DEFAULT_CONFIG, ...data, adminTelegramIds: mergedAdmins };
    }
  } catch (err) {
    console.error('Error fetching system config from Redis, falling back to default:', err);
  }
  return DEFAULT_CONFIG;
}

export async function updateSystemConfig(patch: Partial<SystemConfig>): Promise<SystemConfig> {
  const current = await getSystemConfig();
  const updated = { ...current, ...patch };

  try {
    await pgPool.query(
      `INSERT INTO system_config (key, value, updated_at) 
       VALUES ('system_main', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(updated)]
    );
  } catch (err) {
    console.error('Error updating system config in Postgres:', err);
  }

  try {
    await redis.set('config:system', updated);
  } catch (e) {}

  return updated;
}

// User in-app wallet interface
export interface UserInAppWallet {
  userId: string;
  username: string;
  avatar?: string;
  tonBalance: number; // In TON (e.g. 1.25)
  starsBalance: number; // Integer Telegram Stars
  credits: number; // Game credits
  connectedWallet?: string;
  inventory?: any[];
  stats?: any;
  isAdmin?: boolean;
  updatedAt: number;
}

export interface LedgerTransaction {
  id: string;
  userId: string;
  type:
    | 'DEPOSIT_TON'
    | 'DEPOSIT_STARS'
    | 'WITHDRAW_TON'
    | 'GAME_CREDIT_TOPUP'
    | 'GIFT_BUY'
    | 'GIFT_DEPOSIT'
    | 'TASK_CLAIM'
    | 'GAME_WIN'
    | 'GAME_BET';
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
  try {
    const res = await pgPool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (res.rows.length > 0) {
      const r = res.rows[0];
      return {
        userId: r.id,
        username: r.username,
        avatar: r.avatar,
        tonBalance: parseFloat(r.ton_balance) || 0,
        starsBalance: parseInt(r.stars_balance, 10) || 0,
        credits: parseInt(r.credits, 10) || 0,
        connectedWallet: r.connected_wallet,
        inventory: r.inventory || [],
        stats: r.stats || {},
        isAdmin: !!r.is_admin,
        updatedAt: new Date(r.updated_at).getTime()
      };
    }

    // Insert new user into Postgres
    const insertRes = await pgPool.query(
      `INSERT INTO users (id, username, credits, ton_balance, stars_balance)
       VALUES ($1, $2, 2500, 0, 100)
       RETURNING *`,
      [userId, defaultUsername]
    );

    const r = insertRes.rows[0];
    const newWallet: UserInAppWallet = {
      userId: r.id,
      username: r.username,
      avatar: r.avatar,
      tonBalance: 0,
      starsBalance: 100,
      credits: 2500,
      connectedWallet: r.connected_wallet,
      inventory: [],
      stats: {},
      isAdmin: false,
      updatedAt: Date.now()
    };

    // Cache in Redis
    try {
      await redis.set(`user:${userId}:wallet`, newWallet);
    } catch (e) {}

    return newWallet;
  } catch (err) {
    console.error(`Postgres error getting user ${userId}:`, err);

    // Fallback to Redis
    const key = `user:${userId}:wallet`;
    try {
      const cached = await redis.get<UserInAppWallet>(key);
      if (cached) return cached;
    } catch (e) {}

    return {
      userId,
      username: defaultUsername,
      tonBalance: 0,
      starsBalance: 100,
      credits: 2500,
      updatedAt: Date.now()
    };
  }
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

  try {
    await pgPool.query(
      `UPDATE users
       SET credits = $1,
           ton_balance = $2,
           stars_balance = $3,
           connected_wallet = COALESCE($4, connected_wallet),
           inventory = COALESCE($5, inventory),
           stats = COALESCE($6, stats),
           updated_at = NOW()
       WHERE id = $7`,
      [
        updated.credits,
        updated.tonBalance,
        updated.starsBalance,
        updated.connectedWallet || null,
        JSON.stringify(updated.inventory || []),
        JSON.stringify(updated.stats || {}),
        userId
      ]
    );
  } catch (err) {
    console.error('Error updating user in Postgres:', err);
  }

  // Update Redis cache
  try {
    await redis.set(`user:${userId}:wallet`, updated);
  } catch (e) {}

  return updated;
}

export async function recordLedgerTransaction(tx: LedgerTransaction): Promise<void> {
  try {
    await pgPool.query(
      `INSERT INTO ledger_transactions 
       (id, user_id, type, amount_ton, amount_stars, amount_credits, status, comment, tx_hash, boc, details, created_at, confirmed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, to_timestamp($12 / 1000.0), 
               CASE WHEN $13 > 0 THEN to_timestamp($13 / 1000.0) ELSE NULL END)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         tx_hash = EXCLUDED.tx_hash,
         confirmed_at = EXCLUDED.confirmed_at,
         details = EXCLUDED.details`,
      [
        tx.id,
        tx.userId,
        tx.type,
        tx.amountTon || 0,
        tx.amountStars || 0,
        tx.amountCredits || 0,
        tx.status,
        tx.comment || null,
        tx.txHash || null,
        tx.boc || null,
        JSON.stringify(tx.details || {}),
        tx.createdAt,
        tx.confirmedAt || 0
      ]
    );
  } catch (err) {
    console.error('Error inserting ledger transaction into Postgres:', err);
  }

  // Redis cache for instant reactivity
  try {
    const key = `ledger:tx:${tx.id}`;
    await redis.set(key, tx);
    await redis.lpush(`user:${tx.userId}:txs`, tx.id);
    await redis.ltrim(`user:${tx.userId}:txs`, 0, 99);
    await redis.lpush('ledger:recent_txs', tx.id);
    await redis.ltrim('ledger:recent_txs', 0, 199);
  } catch (err) {
    console.error('Error recording ledger in Redis:', err);
  }
}

export async function updateLedgerTransaction(
  txId: string,
  patch: Partial<LedgerTransaction>
): Promise<LedgerTransaction | null> {
  try {
    const res = await pgPool.query('SELECT * FROM ledger_transactions WHERE id = $1', [txId]);
    if (res.rows.length === 0) return null;

    const current = res.rows[0];
    const newStatus = patch.status || current.status;
    const newTxHash = patch.txHash || current.tx_hash;
    const newConfirmedAt = patch.confirmedAt ? new Date(patch.confirmedAt) : current.confirmed_at;
    const newDetails = { ...(current.details || {}), ...(patch.details || {}) };

    await pgPool.query(
      `UPDATE ledger_transactions
       SET status = $1, tx_hash = $2, confirmed_at = $3, details = $4
       WHERE id = $5`,
      [newStatus, newTxHash, newConfirmedAt, JSON.stringify(newDetails), txId]
    );

    // Redis update
    try {
      const key = `ledger:tx:${txId}`;
      const tx = await redis.get<LedgerTransaction>(key);
      if (tx) {
        await redis.set(key, { ...tx, ...patch });
      }
    } catch (e) {}

    return {
      id: txId,
      userId: current.user_id,
      type: current.type,
      amountTon: parseFloat(current.amount_ton) || 0,
      amountStars: parseInt(current.amount_stars, 10) || 0,
      amountCredits: parseInt(current.amount_credits, 10) || 0,
      status: newStatus,
      comment: current.comment,
      txHash: newTxHash,
      details: newDetails,
      createdAt: new Date(current.created_at).getTime(),
      confirmedAt: newConfirmedAt ? new Date(newConfirmedAt).getTime() : undefined
    };
  } catch (err) {
    console.error(`Error updating ledger transaction ${txId}:`, err);
    return null;
  }
}

export async function getUserTransactions(userId: string): Promise<LedgerTransaction[]> {
  try {
    const res = await pgPool.query(
      `SELECT * FROM ledger_transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );
    return res.rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      type: r.type,
      amountTon: parseFloat(r.amount_ton) || 0,
      amountStars: parseInt(r.amount_stars, 10) || 0,
      amountCredits: parseInt(r.amount_credits, 10) || 0,
      status: r.status,
      comment: r.comment,
      txHash: r.tx_hash,
      boc: r.boc,
      details: r.details || {},
      createdAt: new Date(r.created_at).getTime(),
      confirmedAt: r.confirmed_at ? new Date(r.confirmed_at).getTime() : undefined
    }));
  } catch (err) {
    console.error(`Postgres error getting txs for user ${userId}:`, err);
    return [];
  }
}

export async function getGlobalRecentTransactions(limit = 50): Promise<LedgerTransaction[]> {
  try {
    const res = await pgPool.query(
      `SELECT * FROM ledger_transactions 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );
    return res.rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      type: r.type,
      amountTon: parseFloat(r.amount_ton) || 0,
      amountStars: parseInt(r.amount_stars, 10) || 0,
      amountCredits: parseInt(r.amount_credits, 10) || 0,
      status: r.status,
      comment: r.comment,
      txHash: r.tx_hash,
      boc: r.boc,
      details: r.details || {},
      createdAt: new Date(r.created_at).getTime(),
      confirmedAt: r.confirmed_at ? new Date(r.confirmed_at).getTime() : undefined
    }));
  } catch (err) {
    console.error('Postgres error getting global transactions:', err);
    return [];
  }
}

// Game rounds recording into Neon PostgreSQL
export interface GameRoundRecord {
  id: string;
  gameId: string;
  userId: string;
  betAmount: number;
  payoutAmount: number;
  multiplier: number;
  status: 'WIN' | 'LOSS' | 'PUSH' | 'COMPLETED';
  serverSeed?: string;
  serverSeedHash?: string;
  clientSeed?: string;
  gameDetails?: Record<string, any>;
}

export async function recordGameRound(round: GameRoundRecord): Promise<void> {
  try {
    await pgPool.query(
      `INSERT INTO game_rounds 
       (id, game_id, user_id, bet_amount, payout_amount, multiplier, status, server_seed, server_seed_hash, client_seed, game_details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        round.id,
        round.gameId,
        round.userId,
        round.betAmount,
        round.payoutAmount,
        round.multiplier,
        round.status,
        round.serverSeed || null,
        round.serverSeedHash || null,
        round.clientSeed || null,
        JSON.stringify(round.gameDetails || {})
      ]
    );

    // Update user stats in users table
    const isWin = round.payoutAmount > round.betAmount;
    await pgPool.query(
      `UPDATE users
       SET stats = jsonb_set(
             jsonb_set(
               jsonb_set(
                 COALESCE(stats, '{}'::jsonb),
                 '{roundsPlayed}',
                 (COALESCE((stats->>'roundsPlayed')::bigint, 0) + 1)::text::jsonb
               ),
               '{totalWagered}',
               (COALESCE((stats->>'totalWagered')::bigint, 0) + $1)::text::jsonb
             ),
             '{roundsWon}',
             (COALESCE((stats->>'roundsWon')::bigint, 0) + ${isWin ? 1 : 0})::text::jsonb
           ),
           updated_at = NOW()
       WHERE id = $2`,
      [round.betAmount, round.userId]
    );
  } catch (err) {
    console.error('Error recording game round into Neon Postgres:', err);
  }
}

export async function getUserGameHistory(userId: string, limit = 30): Promise<any[]> {
  try {
    const res = await pgPool.query(
      `SELECT * FROM game_rounds
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return res.rows.map(r => ({
      id: r.id,
      gameId: r.game_id,
      userId: r.user_id,
      betAmount: parseInt(r.bet_amount, 10),
      payoutAmount: parseInt(r.payout_amount, 10),
      multiplier: parseFloat(r.multiplier),
      status: r.status,
      serverSeed: r.server_seed,
      serverSeedHash: r.server_seed_hash,
      clientSeed: r.client_seed,
      gameDetails: r.game_details,
      createdAt: new Date(r.created_at).getTime()
    }));
  } catch (err) {
    console.error('Error fetching game history from Postgres:', err);
    return [];
  }
}

// Task claims recording into Neon PostgreSQL
export async function recordTaskClaim(
  userId: string,
  taskId: string,
  rewardCredits: number,
  rewardStars = 0
): Promise<{ success: boolean; error?: string }> {
  try {
    // Insert into task_claims (unique constraint prevents double claim)
    await pgPool.query(
      `INSERT INTO task_claims (user_id, task_id, reward_credits, reward_stars, claimed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, taskId, rewardCredits, rewardStars]
    );

    // Add credits to user in users table
    await pgPool.query(
      `UPDATE users
       SET credits = credits + $1,
           stars_balance = stars_balance + $2,
           updated_at = NOW()
       WHERE id = $3`,
      [rewardCredits, rewardStars, userId]
    );

    // Record ledger transaction
    const txId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await recordLedgerTransaction({
      id: txId,
      userId,
      type: 'TASK_CLAIM',
      amountCredits: rewardCredits,
      amountStars: rewardStars,
      status: 'CONFIRMED',
      comment: `Daily task claim: ${taskId}`,
      createdAt: Date.now(),
      confirmedAt: Date.now()
    });

    // Record activity log
    await recordActivityLog(userId, 'CLAIM_TASK', { taskId, rewardCredits, rewardStars });

    return { success: true };
  } catch (err: any) {
    if (err.code === '23505') {
      return { success: false, error: 'Task already claimed today.' };
    }
    console.error('Error in recordTaskClaim:', err);
    return { success: false, error: err.message || 'Failed to claim task' };
  }
}

export async function getUserClaimedTasks(userId: string): Promise<string[]> {
  try {
    const res = await pgPool.query(
      `SELECT task_id FROM task_claims 
       WHERE user_id = $1 
         AND claimed_at >= NOW() - INTERVAL '24 HOURS'`,
      [userId]
    );
    return res.rows.map(r => r.task_id);
  } catch (err) {
    console.error('Error getting claimed tasks:', err);
    return [];
  }
}

// Activity Logging into Neon PostgreSQL
export async function recordActivityLog(
  userId: string,
  action: string,
  details: Record<string, any> = {},
  ip?: string
): Promise<void> {
  try {
    await pgPool.query(
      `INSERT INTO user_activity_logs (user_id, action, details, ip, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, action, JSON.stringify(details), ip || null]
    );
  } catch (err) {
    console.error('Error logging activity to Postgres:', err);
  }
}

export async function getActivityLogs(limit = 100): Promise<any[]> {
  try {
    const res = await pgPool.query(
      `SELECT * FROM user_activity_logs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      action: r.action,
      details: r.details,
      ip: r.ip,
      createdAt: new Date(r.created_at).getTime()
    }));
  } catch (err) {
    console.error('Error fetching activity logs:', err);
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
    const res = await pgPool.query(
      `SELECT * FROM user_gifts WHERE user_id = $1 ORDER BY acquired_at DESC`,
      [userId]
    );
    if (res.rows.length > 0) {
      return res.rows.map(r => ({
        instanceId: r.instance_id,
        giftId: r.gift_id,
        name: r.name,
        priceStars: parseInt(r.price_stars, 10),
        acquiredAt: new Date(r.acquired_at).getTime(),
        modelName: r.model_name,
        backdropColor: r.backdrop_color,
        edgeColor: r.edge_color,
        symbolName: r.symbol_name,
        rarity: parseFloat(r.rarity) || 0
      }));
    }
  } catch (err) {
    console.error('Error fetching user gifts from Postgres:', err);
  }

  // Fallback to Redis
  try {
    const gifts = await redis.get<UserGiftItem[]>(`user:${userId}:gifts`);
    return gifts || [];
  } catch (err) {
    return [];
  }
}

export async function addUserGift(userId: string, gift: UserGiftItem): Promise<UserGiftItem[]> {
  try {
    await pgPool.query(
      `INSERT INTO user_gifts 
       (instance_id, user_id, gift_id, name, price_stars, model_name, backdrop_color, edge_color, symbol_name, rarity, acquired_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, to_timestamp($11 / 1000.0))`,
      [
        gift.instanceId,
        userId,
        gift.giftId,
        gift.name,
        gift.priceStars,
        gift.modelName || null,
        gift.backdropColor || null,
        gift.edgeColor || null,
        gift.symbolName || null,
        gift.rarity || 0,
        gift.acquiredAt
      ]
    );
  } catch (err) {
    console.error('Error inserting gift into Postgres:', err);
  }

  // Cache in Redis
  const current = await getUserGifts(userId);
  const updated = [gift, ...current.filter(g => g.instanceId !== gift.instanceId)];
  try {
    await redis.set(`user:${userId}:gifts`, updated);
  } catch (e) {}

  return updated;
}

// System live statistics directly from Neon PostgreSQL
export async function getSystemStats(): Promise<{
  totalUsers: number;
  totalTransactions: number;
  totalDepositsTon: number;
  totalWithdrawalsTon: number;
  totalGamesPlayed: number;
  totalWageredCredits: number;
  totalWonCredits: number;
  totalTaskClaims: number;
  databaseStatus: 'CONNECTED' | 'DISCONNECTED';
}> {
  try {
    const userRes = await pgPool.query('SELECT COUNT(*) as count FROM users');
    const txRes = await pgPool.query(`
      SELECT 
        COUNT(*) as total_tx,
        COALESCE(SUM(CASE WHEN type = 'DEPOSIT_TON' AND status = 'CONFIRMED' THEN amount_ton ELSE 0 END), 0) as dep_ton,
        COALESCE(SUM(CASE WHEN type = 'WITHDRAW_TON' AND status = 'CONFIRMED' THEN amount_ton ELSE 0 END), 0) as with_ton
      FROM ledger_transactions
    `);
    const gameRes = await pgPool.query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(bet_amount), 0) as total_wagered,
        COALESCE(SUM(payout_amount), 0) as total_won
      FROM game_rounds
    `);
    const taskRes = await pgPool.query('SELECT COUNT(*) as count FROM task_claims');

    return {
      totalUsers: parseInt(userRes.rows[0]?.count || '0', 10),
      totalTransactions: parseInt(txRes.rows[0]?.total_tx || '0', 10),
      totalDepositsTon: parseFloat(txRes.rows[0]?.dep_ton || '0'),
      totalWithdrawalsTon: parseFloat(txRes.rows[0]?.with_ton || '0'),
      totalGamesPlayed: parseInt(gameRes.rows[0]?.count || '0', 10),
      totalWageredCredits: parseInt(gameRes.rows[0]?.total_wagered || '0', 10),
      totalWonCredits: parseInt(gameRes.rows[0]?.total_won || '0', 10),
      totalTaskClaims: parseInt(taskRes.rows[0]?.count || '0', 10),
      databaseStatus: 'CONNECTED'
    };
  } catch (err) {
    console.error('Error fetching system stats from Postgres:', err);
    return {
      totalUsers: 1,
      totalTransactions: 0,
      totalDepositsTon: 0,
      totalWithdrawalsTon: 0,
      totalGamesPlayed: 0,
      totalWageredCredits: 0,
      totalWonCredits: 0,
      totalTaskClaims: 0,
      databaseStatus: 'DISCONNECTED'
    };
  }
}
