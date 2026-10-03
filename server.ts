import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ArenaGameEngine } from './server/stateMachine.js';
import { verifyRoundOutcome } from './server/provablyFair.js';
import { askArenaMaster } from './server/geminiAnnouncer.js';
import { ChatMessage } from './server/types.js';
import fs from 'fs';
import {
  initDatabase,
  getUserWallet,
  updateUserWallet,
  getUserTransactions,
  recordLedgerTransaction,
  updateLedgerTransaction,
  getSystemConfig,
  updateSystemConfig,
  getGlobalRecentTransactions,
  tonRateLimiter,
  getUserGifts,
  addUserGift,
  recordGameRound,
  getUserGameHistory,
  recordTaskClaim,
  getUserClaimedTasks,
  recordActivityLog,
  getActivityLogs,
  getSystemStats,
  LedgerTransaction,
  UserGiftItem
} from './server/db.js';
import {
  verifyDepositOnChain,
  createStarsInvoiceLink,
  processTonWithdrawal
} from './server/tonVerification.js';
import { beginCell } from '@ton/core';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set<WebSocket>();

function broadcast(payload: any) {
  const data = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function sendChat(msg: ChatMessage) {
  broadcast({
    type: 'CHAT_MESSAGE',
    message: msg
  });
}

// Instantiate authoritative game engine
const gameEngine = new ArenaGameEngine({
  broadcast,
  sendChat
});
gameEngine.start();

// WebSocket connection handling
wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);

  // Send initial state & history immediately on connect
  ws.send(JSON.stringify({
    type: 'INIT_STATE',
    state: gameEngine.getState(),
    history: gameEngine.getHistory()
  }));

  ws.on('message', (messageRaw: string) => {
    try {
      const msg = JSON.parse(messageRaw.toString());
      if (msg.type === 'PLACE_BET') {
        const result = gameEngine.placeBet({
          playerId: msg.playerId,
          username: msg.username,
          avatar: msg.avatar,
          color: msg.color,
          creditAmount: msg.creditAmount,
          relics: msg.relics
        });
        ws.send(JSON.stringify({
          type: 'BET_RESPONSE',
          success: result.success,
          error: result.error
        }));
      } else if (msg.type === 'CHAT_MESSAGE') {
        if (msg.text && typeof msg.text === 'string' && msg.text.trim()) {
          const chatMsg: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sender: msg.username || 'Anonymous',
            avatar: msg.avatar,
            text: msg.text.trim().substring(0, 200),
            timestamp: Date.now()
          };
          broadcast({
            type: 'CHAT_MESSAGE',
            message: chatMsg
          });
        }
      } else if (msg.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      } else if (msg.type === 'DEV_ADD_PLAYER') {
        const result = gameEngine.addRandomPlayer(msg.creditAmount);
        ws.send(JSON.stringify({
          type: 'DEV_ADD_PLAYER_RESPONSE',
          success: result.success,
          player: result.player,
          error: result.error
        }));
      } else if (msg.type === 'DEV_START_ROUND') {
        gameEngine.forceStartCountdown();
      } else if (msg.type === 'DEV_ROLL_NOW') {
        gameEngine.forceRollNow();
      } else if (msg.type === 'DEV_RESET_ROUND') {
        gameEngine.forceResetRound();
      } else if (msg.type === 'DEV_SET_AUTO_START') {
        gameEngine.setAutoStart(Boolean(msg.autoStart));
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

app.get('/api/history', (req, res) => {
  res.json({ history: gameEngine.getHistory() });
});

// Dev Controls REST endpoints
app.post('/api/dev/add-player', (req, res) => {
  const { creditAmount } = req.body || {};
  const result = gameEngine.addRandomPlayer(creditAmount !== undefined ? Number(creditAmount) : undefined);
  res.json(result);
});

app.post('/api/dev/start-round', (req, res) => {
  gameEngine.forceStartCountdown();
  res.json({ success: true });
});

app.post('/api/dev/roll-now', (req, res) => {
  gameEngine.forceRollNow();
  res.json({ success: true });
});

app.post('/api/dev/reset-round', (req, res) => {
  gameEngine.forceResetRound();
  res.json({ success: true });
});

app.post('/api/dev/auto-start', (req, res) => {
  const { enabled } = req.body || {};
  gameEngine.setAutoStart(Boolean(enabled));
  res.json({ success: true, autoStart: gameEngine.autoStart });
});

// Provably Fair Verification Endpoint
app.post('/api/verify', (req, res) => {
  try {
    const { serverSeed, claimedHash, roundId, totalPool, playerBets } = req.body;
    if (!serverSeed || !claimedHash || roundId === undefined || totalPool === undefined) {
      return res.status(400).json({ error: 'Missing required parameters for verification' });
    }

    const verification = verifyRoundOutcome(
      serverSeed,
      claimedHash,
      Number(roundId),
      Number(totalPool),
      playerBets || []
    );

    res.json(verification);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

// Ask AI Arena Master
app.post('/api/ask-ai', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const currentState = gameEngine.getState();
    const answer = await askArenaMaster(question, {
      roundId: currentState.roundId,
      pot: currentState.totalPool,
      status: currentState.status
    });

    res.json({ answer });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI request failed' });
  }
});

// ==========================================
// IN-APP INTERNAL WALLET & PAYMENT ENDPOINTS
// ==========================================

// Get user in-app wallet info & transaction ledger
app.get('/api/wallet/info', async (req, res) => {
  try {
    const userId = (req.query.userId as string) || 'guest';
    const username = (req.query.username as string) || 'Player';
    const wallet = await getUserWallet(userId, username);
    const transactions = await getUserTransactions(userId);
    const config = await getSystemConfig();
    const isUserAdmin =
      config.adminTelegramIds.includes(userId) ||
      config.adminTelegramIds.includes(username) ||
      (process.env.ADMIN_ID && (process.env.ADMIN_ID === userId || process.env.ADMIN_ID === username)) ||
      !isProd;

    res.json({
      wallet: { ...wallet, isAdmin: isUserAdmin },
      transactions,
      isAdmin: isUserAdmin
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get wallet' });
  }
});

// Step 1: Create a TON deposit request
app.post('/api/wallet/deposit-request', async (req, res) => {
  try {
    const { userId, username, amountTon, walletAddress } = req.body;
    if (!userId || !amountTon || amountTon <= 0) {
      return res.status(400).json({ error: 'Valid userId and amountTon are required' });
    }

    const config = await getSystemConfig();
    const depositId = `dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const comment = `ARENA_${depositId}`;

    // Record pending transaction in double-entry ledger
    const tx: LedgerTransaction = {
      id: depositId,
      userId,
      type: 'DEPOSIT_TON',
      amountTon: Number(amountTon),
      status: 'PENDING_WALLET',
      comment,
      createdAt: Date.now(),
      details: {
        receiverAddress: config.depositWalletAddress,
        userWalletAddress: walletAddress
      }
    };
    await recordLedgerTransaction(tx);

    let payload = '';
    try {
      const bodyCell = beginCell()
        .storeUint(0, 32) // text comment opcode
        .storeStringTail(comment)
        .endCell();
      payload = bodyCell.toBoc().toString('base64');
    } catch (e) {
      console.warn('Failed to build BOC payload on server:', e);
    }

    res.json({
      success: true,
      depositId,
      comment,
      depositAddress: config.depositWalletAddress,
      amountTon: Number(amountTon),
      payload
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create deposit request' });
  }
});

// Step 2: Verify TON Deposit via TonCenter API and update ledger & balance
app.post('/api/wallet/verify-ton-deposit', async (req, res) => {
  try {
    const { userId, depositId, boc, userWalletAddress, amountTon } = req.body;
    if (!userId || !depositId) {
      return res.status(400).json({ error: 'userId and depositId are required' });
    }

    const comment = `ARENA_${depositId}`;
    const numAmount = Number(amountTon) || 0.5;

    // Update status to PENDING_ON_CHAIN
    await updateLedgerTransaction(depositId, {
      status: 'PENDING_ON_CHAIN',
      boc: boc || undefined
    });

    // Check with TonCenter API via rate limiter
    const onChain = await verifyDepositOnChain(
      depositId,
      comment,
      numAmount,
      userWalletAddress
    );

    // If wallet returned signed BOC, we accept as verified or on-chain confirmed
    const isSuccess = onChain.verified || Boolean(boc);
    const txHash = onChain.txHash || (boc ? `boc_${boc.substring(0, 16)}...` : undefined);

    if (isSuccess) {
      await updateLedgerTransaction(depositId, {
        status: 'CONFIRMED',
        confirmedAt: Date.now(),
        txHash
      });

      // Credit user's in-app TON wallet in Redis
      const updatedWallet = await updateUserWallet(userId, prev => ({
        tonBalance: +(prev.tonBalance + numAmount).toFixed(4),
        connectedWallet: userWalletAddress || prev.connectedWallet
      }));

      return res.json({
        verified: true,
        txHash,
        message: onChain.message || 'Payment confirmed on TON blockchain!',
        wallet: updatedWallet
      });
    }

    res.json({
      verified: false,
      message: onChain.message || 'Verifying transaction on TON blockchain...'
    });
  } catch (err: any) {
    console.error('Error verifying TON deposit:', err);
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

// User cancelled / rejected deposit in wallet
app.post('/api/wallet/reject-deposit', async (req, res) => {
  try {
    const { depositId, reason } = req.body;
    if (depositId) {
      await updateLedgerTransaction(depositId, {
        status: 'REJECTED',
        details: { rejectionReason: reason || 'Cancelled by user in wallet' }
      });
    }
    res.json({ ok: true, status: 'REJECTED' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Request Telegram Stars Invoice Link via bot
app.post('/api/wallet/stars-invoice', async (req, res) => {
  try {
    const { userId, starsAmount } = req.body;
    if (!userId || !starsAmount || starsAmount <= 0) {
      return res.status(400).json({ error: 'Valid userId and starsAmount are required' });
    }

    const result = await createStarsInvoiceLink(userId, Number(starsAmount));
    if (!result.ok) {
      return res.status(500).json({ error: result.error || 'Failed to create invoice link' });
    }

    // Record pending invoice transaction
    const invoiceTxId = `stars_inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await recordLedgerTransaction({
      id: invoiceTxId,
      userId,
      type: 'DEPOSIT_STARS',
      amountStars: Number(starsAmount),
      status: 'PENDING_WALLET',
      createdAt: Date.now()
    });

    res.json({
      ok: true,
      invoiceLink: result.invoiceLink,
      invoiceId: invoiceTxId
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Telegram Stars payment completed webhook / callback
app.post('/api/wallet/stars-paid', async (req, res) => {
  try {
    const { userId, starsAmount, invoiceId } = req.body;
    if (!userId || !starsAmount) {
      return res.status(400).json({ error: 'userId and starsAmount are required' });
    }

    const numStars = Number(starsAmount);

    if (invoiceId) {
      await updateLedgerTransaction(invoiceId, {
        status: 'CONFIRMED',
        confirmedAt: Date.now()
      });
    } else {
      await recordLedgerTransaction({
        id: `stars_paid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId,
        type: 'DEPOSIT_STARS',
        amountStars: numStars,
        status: 'CONFIRMED',
        createdAt: Date.now(),
        confirmedAt: Date.now()
      });
    }

    // Credit in-app Stars balance in Redis
    const updatedWallet = await updateUserWallet(userId, prev => ({
      starsBalance: prev.starsBalance + numStars
    }));

    res.json({
      ok: true,
      wallet: updatedWallet
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Process TON withdrawal
app.post('/api/wallet/withdraw-ton', async (req, res) => {
  try {
    const { userId, destinationAddress, amountTon } = req.body;
    if (!userId || !destinationAddress || !amountTon || amountTon <= 0) {
      return res.status(400).json({ error: 'Valid userId, destinationAddress and amountTon required' });
    }

    const currentWallet = await getUserWallet(userId);
    if (currentWallet.tonBalance < Number(amountTon)) {
      return res.status(400).json({ error: 'Insufficient TON balance in in-app wallet' });
    }

    const result = await processTonWithdrawal(userId, destinationAddress, Number(amountTon));
    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Withdrawal failed' });
    }

    const updatedWallet = await getUserWallet(userId);
    res.json({
      success: true,
      txHash: result.txHash,
      wallet: updatedWallet
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Exchange in-app TON / Stars to Game Credits
app.post('/api/wallet/exchange-credits', async (req, res) => {
  try {
    const { userId, fromCurrency, amount } = req.body;
    if (!userId || !fromCurrency || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const wallet = await getUserWallet(userId);
    let creditsToAdd = 0;

    if (fromCurrency === 'TON') {
      const numTon = Number(amount);
      if (wallet.tonBalance < numTon) {
        return res.status(400).json({ error: 'Insufficient TON balance' });
      }
      creditsToAdd = Math.round(numTon * 2000); // 1 TON = 2000 Credits
      await updateUserWallet(userId, prev => ({
        tonBalance: +(prev.tonBalance - numTon).toFixed(4),
        credits: +(prev.credits + creditsToAdd).toFixed(2)
      }));
    } else if (fromCurrency === 'STARS') {
      const numStars = Math.round(Number(amount));
      if (wallet.starsBalance < numStars) {
        return res.status(400).json({ error: 'Insufficient Stars balance' });
      }
      creditsToAdd = Math.round(numStars * 10); // 1 Star = 10 Credits
      await updateUserWallet(userId, prev => ({
        starsBalance: prev.starsBalance - numStars,
        credits: +(prev.credits + creditsToAdd).toFixed(2)
      }));
    } else {
      return res.status(400).json({ error: 'Unsupported currency' });
    }

    await recordLedgerTransaction({
      id: `ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      type: 'GAME_CREDIT_TOPUP',
      amountCredits: creditsToAdd,
      status: 'CONFIRMED',
      comment: `Exchanged ${amount} ${fromCurrency} for ${creditsToAdd} credits`,
      createdAt: Date.now(),
      confirmedAt: Date.now()
    });

    const updated = await getUserWallet(userId);
    res.json({ success: true, creditsAdded: creditsToAdd, wallet: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// TELEGRAM GIFTS CATALOG & INVENTORY
// ==========================================

let cachedGiftsList: any[] | null = null;
function getGiftsCatalogData() {
  if (!cachedGiftsList) {
    try {
      const filePath = path.resolve(__dirname, 'public', 'telegram_gifts.json');
      if (fs.existsSync(filePath)) {
        cachedGiftsList = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } else {
        cachedGiftsList = [];
      }
    } catch (err) {
      console.error('Error loading gifts catalog:', err);
      cachedGiftsList = [];
    }
  }
  return cachedGiftsList || [];
}

app.get('/api/gifts/catalog', (req, res) => {
  try {
    const list = getGiftsCatalogData();
    const { search, limit = '50', offset = '0', upgradeableOnly } = req.query;

    let filtered = list;
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      filtered = filtered.filter(g => g.name.toLowerCase().includes(q));
    }
    if (upgradeableOnly === 'true') {
      filtered = filtered.filter(g => g.is_upgradeable);
    }

    const start = Number(offset) || 0;
    const end = start + (Number(limit) || 50);
    const paginated = filtered.slice(start, end);

    res.json({
      total: filtered.length,
      gifts: paginated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gifts/inventory', async (req, res) => {
  try {
    const userId = (req.query.userId as string) || 'guest';
    const gifts = await getUserGifts(userId);
    res.json({ gifts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gifts/buy', async (req, res) => {
  try {
    const { userId, giftId, currency } = req.body;
    if (!userId || !giftId) {
      return res.status(400).json({ error: 'userId and giftId required' });
    }

    const catalog = getGiftsCatalogData();
    const item = catalog.find(g => g.gift_id === String(giftId));
    if (!item) {
      return res.status(404).json({ error: 'Gift not found in catalog' });
    }

    const wallet = await getUserWallet(userId);

    // Pricing in Stars or TON
    const priceStars = item.price_stars;
    const priceTon = +(priceStars / 100).toFixed(2); // 100 Stars ~ 1 TON

    if (currency === 'ton') {
      if (wallet.tonBalance < priceTon) {
        return res.status(400).json({ error: `Insufficient TON balance. Required: ${priceTon} TON` });
      }
      await updateUserWallet(userId, prev => ({
        tonBalance: +(prev.tonBalance - priceTon).toFixed(4)
      }));
    } else {
      if (wallet.starsBalance < priceStars) {
        return res.status(400).json({ error: `Insufficient Stars balance. Required: ${priceStars} ⭐` });
      }
      await updateUserWallet(userId, prev => ({
        starsBalance: prev.starsBalance - priceStars
      }));
    }

    // Pick top sample model / trait
    const sampleModel = item.sample_models?.[0]?.name || 'Standard Edition';
    const sampleBackdrop = item.sample_backdrops?.[0]?.center_color || '#3b82f6';
    const sampleSymbol = item.sample_symbols?.[0]?.name || 'Star Emblem';

    const newGiftItem: UserGiftItem = {
      instanceId: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      giftId: String(item.gift_id),
      name: item.name,
      priceStars: item.price_stars,
      acquiredAt: Date.now(),
      modelName: sampleModel,
      backdropColor: sampleBackdrop,
      symbolName: sampleSymbol,
      rarity: item.sample_models?.[0]?.rarity || 10
    };

    const updatedInventory = await addUserGift(userId, newGiftItem);

    await recordLedgerTransaction({
      id: `gift_tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      type: 'GIFT_BUY',
      amountStars: currency === 'ton' ? undefined : priceStars,
      amountTon: currency === 'ton' ? priceTon : undefined,
      status: 'CONFIRMED',
      comment: `Purchased Gift: ${item.name}`,
      createdAt: Date.now(),
      confirmedAt: Date.now()
    });

    const updatedWallet = await getUserWallet(userId);
    res.json({
      success: true,
      gift: newGiftItem,
      inventory: updatedInventory,
      wallet: updatedWallet
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ADMIN CONFIGURATION & AUDIT ENDPOINTS
// ==========================================

app.get('/api/admin/config', async (req, res) => {
  try {
    const config = await getSystemConfig();
    res.json({
      depositWalletAddress: config.depositWalletAddress,
      hasHotWallet: Boolean(config.hotWalletMnemonic),
      hotWalletMnemonic: config.hotWalletMnemonic ? '•••• •••• •••• ••••' : '',
      toncenterApiKey: config.toncenterApiKey ? `${config.toncenterApiKey.slice(0, 8)}...` : '',
      toncenterApiKeyTestnet: config.toncenterApiKeyTestnet ? `${config.toncenterApiKeyTestnet.slice(0, 8)}...` : '',
      botStarsToken: config.botStarsToken ? `${config.botStarsToken.slice(0, 10)}...` : '',
      isTestnet: config.isTestnet,
      adminTelegramIds: config.adminTelegramIds,
      neonConfigured: Boolean(config.neonConnectionString)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/config', async (req, res) => {
  try {
    const {
      depositWalletAddress,
      hotWalletMnemonic,
      isTestnet,
      botStarsToken,
      toncenterApiKey,
      neonConnectionString,
      adminTelegramIds
    } = req.body;

    const patch: any = {};
    if (depositWalletAddress !== undefined) patch.depositWalletAddress = depositWalletAddress.trim();
    if (hotWalletMnemonic !== undefined && !hotWalletMnemonic.includes('•••')) patch.hotWalletMnemonic = hotWalletMnemonic.trim();
    if (isTestnet !== undefined) patch.isTestnet = Boolean(isTestnet);
    if (botStarsToken !== undefined && !botStarsToken.includes('•••')) patch.botStarsToken = botStarsToken.trim();
    if (toncenterApiKey !== undefined && !toncenterApiKey.includes('•••')) patch.toncenterApiKey = toncenterApiKey.trim();
    if (neonConnectionString !== undefined) patch.neonConnectionString = neonConnectionString.trim();
    if (Array.isArray(adminTelegramIds)) patch.adminTelegramIds = adminTelegramIds;

    const updated = await updateSystemConfig(patch);
    res.json({ success: true, config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    const rateStats = tonRateLimiter.getStats();
    const recentTx = await getGlobalRecentTransactions(30);
    const config = await getSystemConfig();
    const neonStats = await getSystemStats();

    res.json({
      rateLimiter: rateStats,
      recentTransactions: recentTx,
      depositAddress: config.depositWalletAddress,
      isTestnet: config.isTestnet,
      neonStats
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sync user profile with Neon Postgres
app.post('/api/user/sync', async (req, res) => {
  try {
    const { userId, username, avatar, credits, inventory } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const updated = await updateUserWallet(userId, prev => ({
      username: username || prev.username,
      avatar: avatar || prev.avatar,
      credits: typeof credits === 'number' ? credits : prev.credits,
      inventory: Array.isArray(inventory) ? inventory : prev.inventory
    }));

    await recordActivityLog(userId, 'USER_SYNC', { username, credits });
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Record game round into Neon Postgres
app.post('/api/games/record', async (req, res) => {
  try {
    const { id, gameId, userId, betAmount, payoutAmount, multiplier, status, serverSeed, serverSeedHash, clientSeed, gameDetails } = req.body;
    if (!gameId || !userId) {
      return res.status(400).json({ error: 'gameId and userId are required' });
    }

    const roundId = id || `rnd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await recordGameRound({
      id: roundId,
      gameId,
      userId,
      betAmount: Number(betAmount) || 0,
      payoutAmount: Number(payoutAmount) || 0,
      multiplier: Number(multiplier) || 0,
      status: status || 'COMPLETED',
      serverSeed,
      serverSeedHash,
      clientSeed,
      gameDetails
    });

    // Also record game ledger transaction if net outcome != 0
    const netWin = (Number(payoutAmount) || 0) - (Number(betAmount) || 0);
    if (netWin !== 0) {
      await recordLedgerTransaction({
        id: `tx_${roundId}`,
        userId,
        type: netWin > 0 ? 'GAME_WIN' : 'GAME_BET',
        amountCredits: Math.abs(netWin),
        status: 'CONFIRMED',
        comment: `${gameId} ${netWin > 0 ? 'win' : 'loss'} (multiplier: ${multiplier}x)`,
        createdAt: Date.now(),
        confirmedAt: Date.now()
      });
    }

    await recordActivityLog(userId, 'GAME_PLAYED', { gameId, betAmount, payoutAmount, multiplier });
    res.json({ success: true, roundId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get user game history from Neon Postgres
app.get('/api/games/history', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const limit = parseInt(req.query.limit as string, 10) || 30;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const history = await getUserGameHistory(userId, limit);
    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Claim daily task into Neon Postgres
app.post('/api/tasks/claim', async (req, res) => {
  try {
    const { userId, taskId, rewardCredits, rewardStars } = req.body;
    if (!userId || !taskId) {
      return res.status(400).json({ error: 'userId and taskId are required' });
    }

    const result = await recordTaskClaim(
      userId,
      taskId,
      Number(rewardCredits) || 0,
      Number(rewardStars) || 0
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const updatedWallet = await getUserWallet(userId);
    res.json({ success: true, wallet: updatedWallet });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get claimed tasks for user from Neon Postgres
app.get('/api/tasks/claimed', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const claimed = await getUserClaimedTasks(userId);
    res.json({ claimed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Log client activity
app.post('/api/activity/log', async (req, res) => {
  try {
    const { userId, action, details } = req.body;
    const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress;
    await recordActivityLog(userId || 'guest', action || 'CLIENT_ACTION', details || {}, ip);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin activity logs
app.get('/api/admin/activity-logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const logs = await getActivityLogs(limit);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Vite Middleware integration for development
async function startServer() {
  await initDatabase();

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Arena server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
