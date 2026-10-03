import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CurrentRoundState,
  PlayerBet,
  Relic,
  RoundHistoryItem,
  ChatMessage,
  RoundWinner
} from './types.js';
import {
  generateServerSeed,
  calculateWinningValue,
  determineWinner,
  ProvablyFairRound
} from './provablyFair.js';
import { BOT_PROFILES, BOT_CHAT_LINES, getRandomRelic } from './botSimulator.js';
import { generateArenaCommentary } from './geminiAnnouncer.js';
import { simulateAirHockeyFlight } from '../src/utils/physics.js';
import { computeProportionalTerritories } from '../src/utils/slicing.js';
import { updateUserWallet, recordLedgerTransaction, recordGameRound, getSystemConfig } from './db.js';
import { getCachedRates } from './rates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HISTORY_FILE_PATH = path.resolve(__dirname, 'history.json');

export interface StateMachineCallbacks {
  broadcast: (data: any) => void;
  sendChat: (msg: ChatMessage) => void;
}

export class ArenaGameEngine {
  private currentRound: CurrentRoundState;
  private provablyFairKeys: ProvablyFairRound;
  private history: RoundHistoryItem[] = [];
  private callbacks: StateMachineCallbacks;
  private timer: NodeJS.Timeout | null = null;
  private botTimer: NodeJS.Timeout | null = null;
  private cancelCheckTimer: NodeJS.Timeout | null = null;
  private roundStartTime: number = Date.now();
  private botsInRound: Set<string> = new Set();
  private firstBetPlacedAt: number | null = null;

  public readonly ROUND_BETTING_MS = 20000;
  public readonly RESOLUTION_MS = 10000;
  public readonly CELEBRATION_MS = 6000;
  public readonly CANCEL_THRESHOLD_MS = 60000; // 1 minute cancel bet timeout
  public autoStart: boolean = false;

  constructor(callbacks: StateMachineCallbacks) {
    this.callbacks = callbacks;
    this.provablyFairKeys = generateServerSeed();
    this.currentRound = {
      roundId: 436011,
      status: 'WAITING_FOR_PLAYERS',
      poolTier: 'STANDARD',
      serverSeedHash: this.provablyFairKeys.seedHash,
      totalPool: 0,
      totalTonPool: 0,
      totalStarsPool: 0,
      bets: [],
      timeRemainingMs: this.ROUND_BETTING_MS,
      roundDurationMs: this.ROUND_BETTING_MS,
      resolutionDurationMs: this.RESOLUTION_MS,
      celebrationDurationMs: this.CELEBRATION_MS,
      isBettingClosed: false,
      minPlayersNeeded: 2,
      firstBetPlacedAt: null,
      cancelAvailableInMs: 60000
    };

    this.seedInitialHistory();
  }

  public start() {
    this.startWaitingPhase();
  }

  public getState(): CurrentRoundState {
    const cancelRemaining = this.firstBetPlacedAt
      ? Math.max(0, this.CANCEL_THRESHOLD_MS - (Date.now() - this.firstBetPlacedAt))
      : 60000;
    return {
      ...this.currentRound,
      firstBetPlacedAt: this.firstBetPlacedAt,
      cancelAvailableInMs: cancelRemaining
    };
  }

  public getHistory(): RoundHistoryItem[] {
    return this.history;
  }

  public setAutoStart(enabled: boolean) {
    this.autoStart = enabled;
    this.broadcastState();
  }

  private seedInitialHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE_PATH)) {
        const raw = fs.readFileSync(HISTORY_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.history = parsed;
          return;
        }
      }
    } catch (err) {
      console.warn('Could not read history.json, generating starter rounds:', err);
    }

    this.history = [
      {
        roundId: 436010,
        poolTier: 'HIGH_ROLLER',
        totalPool: 4.31,
        totalTonPool: 2.5,
        totalStarsPool: 40,
        playerCount: 3,
        players: [
          {
            playerId: 'bot_tetris',
            username: 'Тетрис #проклят',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
            currency: 'ton',
            tonAmount: 1.5,
            starsAmount: 0,
            betValueUSD: 2.27,
            creditBet: 2.27,
            relics: [],
            totalBet: 2.27,
            color: '#8b5cf6',
            startTicket: 0,
            endTicket: 2.27,
            winProbability: 0.5263,
            isBot: true
          },
          {
            playerId: 'bot_lmia',
            username: '-LMIA-',
            avatar: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=120&auto=format&fit=crop&q=80',
            currency: 'ton',
            tonAmount: 1.0,
            starsAmount: 0,
            betValueUSD: 1.51,
            creditBet: 1.51,
            relics: [],
            totalBet: 1.51,
            color: '#0ea5e9',
            startTicket: 2.27,
            endTicket: 3.78,
            winProbability: 0.3503,
            isBot: true
          },
          {
            playerId: 'bot_roman',
            username: 'Roman',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
            currency: 'stars',
            tonAmount: 0,
            starsAmount: 40,
            betValueUSD: 0.52,
            creditBet: 0.52,
            relics: [],
            totalBet: 0.52,
            color: '#f59e0b',
            startTicket: 3.78,
            endTicket: 4.30,
            winProbability: 0.1234,
            isBot: true
          }
        ],
        winner: {
          playerId: 'bot_tetris',
          username: 'Тетрис #проклят',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
          color: '#8b5cf6',
          winProbability: 0.5263,
          payout: 4.09,
          payoutTon: 2.375,
          payoutStars: 38,
          payoutUsd: 4.09,
          rakeAmount: 0.22,
          rakeTon: 0.125,
          rakeStars: 2,
          rakePercent: 5.0,
          wonRelics: []
        },
        provablyFair: {
          serverSeed: '644ed62981374091283749182739481273948172938471928374918273948127',
          seedHash: 'cb5aef8eb8293847192837491827394817293847192837491827394817293847',
          winningTicket: 1.15,
          winningValue: 1.15
        },
        completedAt: Date.now() - 180000
      }
    ];

    this.persistHistory();
  }

  private persistHistory() {
    try {
      fs.writeFileSync(HISTORY_FILE_PATH, JSON.stringify(this.history, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to persist history.json:', err);
    }
  }

  private startWaitingPhase() {
    this.provablyFairKeys = generateServerSeed();
    this.botsInRound.clear();
    this.firstBetPlacedAt = null;
    if (this.timer) clearInterval(this.timer);
    if (this.botTimer) clearInterval(this.botTimer);
    if (this.cancelCheckTimer) clearInterval(this.cancelCheckTimer);

    const isHighRoller = Math.random() < 0.25;
    this.currentRound = {
      roundId: this.currentRound.roundId + 1,
      status: 'WAITING_FOR_PLAYERS',
      poolTier: isHighRoller ? 'HIGH_ROLLER' : 'STANDARD',
      serverSeedHash: this.provablyFairKeys.seedHash,
      totalPool: 0,
      totalTonPool: 0,
      totalStarsPool: 0,
      bets: [],
      timeRemainingMs: this.ROUND_BETTING_MS,
      roundDurationMs: this.ROUND_BETTING_MS,
      resolutionDurationMs: this.RESOLUTION_MS,
      celebrationDurationMs: this.CELEBRATION_MS,
      isBettingClosed: false,
      minPlayersNeeded: 2,
      firstBetPlacedAt: null,
      cancelAvailableInMs: 60000
    };

    this.broadcastState();
  }

  public forceStartCountdown() {
    if (this.currentRound.bets.length === 0) return;
    if (this.currentRound.status === 'WAITING_FOR_PLAYERS') {
      this.startCountdownTimer();
    }
  }

  public forceRollNow() {
    if (this.currentRound.bets.length === 0) return;
    if (this.timer) clearInterval(this.timer);
    if (this.cancelCheckTimer) clearInterval(this.cancelCheckTimer);
    this.currentRound.isBettingClosed = true;
    this.resolveRound();
  }

  public forceResetRound() {
    if (this.timer) clearInterval(this.timer);
    if (this.botTimer) clearInterval(this.botTimer);
    if (this.cancelCheckTimer) clearInterval(this.cancelCheckTimer);
    this.startWaitingPhase();
  }

  public startCountdownTimer() {
    this.currentRound.status = 'BETTING_OPEN';
    this.roundStartTime = Date.now();
    this.currentRound.timeRemainingMs = this.ROUND_BETTING_MS;
    this.currentRound.isBettingClosed = false;

    if (this.cancelCheckTimer) {
      clearInterval(this.cancelCheckTimer);
      this.cancelCheckTimer = null;
    }

    this.broadcastState();

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      const elapsed = Date.now() - this.roundStartTime;
      const remaining = Math.max(0, this.ROUND_BETTING_MS - elapsed);
      this.currentRound.timeRemainingMs = remaining;

      // Last 3 seconds: Lock betting!
      if (remaining <= 3000 && !this.currentRound.isBettingClosed) {
        this.currentRound.isBettingClosed = true;
        this.broadcastState();
      }

      if (remaining <= 0) {
        if (this.timer) clearInterval(this.timer);
        this.resolveRound();
      } else {
        if (remaining <= 10000 || remaining % 1000 < 100) {
          this.callbacks.broadcast({
            type: 'TIME_TICK',
            timeRemainingMs: remaining,
            isAlert: remaining <= 10000,
            isBettingClosed: remaining <= 3000
          });
        }
      }
    }, 100);
  }

  public async cancelBet(playerId: string): Promise<{ success: boolean; error?: string; refundedTon?: number; refundedStars?: number }> {
    if (this.currentRound.status !== 'WAITING_FOR_PLAYERS') {
      return { success: false, error: 'Cannot cancel bet once 2 players joined and round countdown started' };
    }

    if (this.currentRound.bets.length > 1) {
      return { success: false, error: 'Cannot cancel bet when match has 2 or more players' };
    }

    const betIndex = this.currentRound.bets.findIndex(b => b.playerId === playerId);
    if (betIndex === -1) {
      return { success: false, error: 'No active bet found for player' };
    }

    const bet = this.currentRound.bets[betIndex];
    const tonRefund = bet.tonAmount || 0;
    const starsRefund = bet.starsAmount || 0;

    // Refund directly back into user's in-app wallet
    try {
      await updateUserWallet(playerId, prev => ({
        tonBalance: +(prev.tonBalance + tonRefund).toFixed(4),
        starsBalance: prev.starsBalance + starsRefund
      }));

      await recordLedgerTransaction({
        id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: playerId,
        type: 'BET_REFUND',
        amountTon: tonRefund,
        amountStars: starsRefund,
        status: 'CONFIRMED',
        comment: `Refunded bet for Round #${this.currentRound.roundId} (User cancelled)`,
        createdAt: Date.now()
      });
    } catch (err) {
      console.error('Error processing refund to user wallet:', err);
    }

    // Remove bet and reset waiting state
    this.currentRound.bets.splice(betIndex, 1);
    this.firstBetPlacedAt = null;
    this.recalculateTicketsAndProbabilities();
    this.broadcastState();

    return {
      success: true,
      refundedTon: tonRefund,
      refundedStars: starsRefund
    };
  }

  public addRandomPlayer(creditAmount?: number): { success: boolean; player?: any; error?: string } {
    if (
      this.currentRound.isBettingClosed ||
      this.currentRound.status === 'ROUND_RESOLVING' ||
      this.currentRound.status === 'WINNER_CELEBRATION'
    ) {
      return { success: false, error: 'Cannot add player while round is resolving or in celebration' };
    }

    const availableBots = BOT_PROFILES.filter(b => !this.botsInRound.has(b.id));
    let bot: any;
    if (availableBots.length > 0) {
      bot = availableBots[Math.floor(Math.random() * availableBots.length)];
    } else {
      const randomId = 'bot_' + Math.random().toString(36).substring(2, 8);
      const names = ['CyberViper', 'PixelKnight', 'NeonRider', 'QuantumGhost', 'ShadowFox', 'GlitchMaster', 'SolarPuff', 'AeroStrike', 'Vortex99', 'NovaBlade'];
      const chosenName = names[Math.floor(Math.random() * names.length)] + '_' + Math.floor(10 + Math.random() * 90);
      const colors = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#e11d48', '#06b6d4'];
      bot = {
        id: randomId,
        username: chosenName,
        avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80`,
        color: colors[Math.floor(Math.random() * colors.length)],
        balance: 10000,
        betStyle: 'balanced'
      };
    }
    this.botsInRound.add(bot.id);

    // Random choice of currency: 50% TON, 50% Stars
    const useTon = Math.random() > 0.4;
    const currency = useTon ? 'ton' : 'stars';
    let amount = 0;

    if (currency === 'ton') {
      amount = creditAmount !== undefined && creditAmount > 0
        ? +(creditAmount / 100).toFixed(2)
        : +([0.2, 0.5, 0.75, 1.0, 1.5, 2.0][Math.floor(Math.random() * 6)]);
    } else {
      amount = creditAmount !== undefined && creditAmount > 0
        ? Math.floor(creditAmount)
        : [15, 25, 50, 75, 100, 150][Math.floor(Math.random() * 6)];
    }

    const relics: Relic[] = [];
    if (Math.random() < 0.25) {
      relics.push(getRandomRelic());
    }

    const placeResult = this.placeBet({
      playerId: bot.id,
      username: bot.username,
      avatar: bot.avatar,
      color: bot.color,
      currency,
      amount,
      relics,
      isBot: true
    });

    if (placeResult.success && Math.random() < 0.5) {
      const line = BOT_CHAT_LINES[Math.floor(Math.random() * BOT_CHAT_LINES.length)];
      this.callbacks.sendChat({
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sender: bot.username,
        avatar: bot.avatar,
        text: line,
        timestamp: Date.now()
      });
    }

    return { success: placeResult.success, player: bot, error: placeResult.error };
  }

  public placeBet(params: {
    playerId: string;
    username: string;
    avatar: string;
    color?: string;
    currency?: 'ton' | 'stars';
    amount?: number;
    creditAmount?: number; // fallback legacy
    relics?: Relic[];
    isBot?: boolean;
  }): { success: boolean; error?: string } {
    if (
      this.currentRound.isBettingClosed ||
      this.currentRound.status === 'ROUND_RESOLVING' ||
      this.currentRound.status === 'WINNER_CELEBRATION'
    ) {
      return { success: false, error: 'Betting is closed for this round' };
    }

    const currency: 'ton' | 'stars' = params.currency || (params.amount !== undefined ? 'ton' : 'stars');
    const rawAmount = params.amount !== undefined ? params.amount : (params.creditAmount || 10);

    if (rawAmount <= 0) {
      return { success: false, error: 'Bet amount must be greater than 0' };
    }

    const rates = getCachedRates();
    const tonPrice = rates.tonPriceUsd || 1.515;
    const starsPrice = rates.starsPriceUsd || 0.0130;

    const tonAmount = currency === 'ton' ? rawAmount : 0;
    const starsAmount = currency === 'stars' ? Math.floor(rawAmount) : 0;

    const relics = params.relics || [];
    const relicsValue = relics.reduce((sum, r) => sum + r.value, 0);

    // Calculate normalized USD value for fair tickets and 2D territory slicing
    const betUsdValue = +(tonAmount * tonPrice + starsAmount * starsPrice).toFixed(4);
    const addedTotalUsd = +(betUsdValue + relicsValue).toFixed(4);

    if (addedTotalUsd <= 0) {
      return { success: false, error: 'Total bet value must be positive' };
    }

    const palette = [
      '#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b',
      '#ec4899', '#14b8a6', '#f97316', '#a855f7'
    ];

    let existingBet = this.currentRound.bets.find(b => b.playerId === params.playerId);

    if (existingBet) {
      existingBet.tonAmount += tonAmount;
      existingBet.starsAmount += starsAmount;
      existingBet.betValueUSD = +(existingBet.betValueUSD + betUsdValue).toFixed(4);
      existingBet.creditBet = existingBet.betValueUSD;
      existingBet.relics = [...existingBet.relics, ...relics];
      existingBet.totalBet = +(existingBet.totalBet + addedTotalUsd).toFixed(4);
    } else {
      const color = params.color || palette[this.currentRound.bets.length % palette.length];
      this.currentRound.bets.push({
        playerId: params.playerId,
        username: params.username,
        avatar: params.avatar,
        currency,
        tonAmount,
        starsAmount,
        betValueUSD: betUsdValue,
        creditBet: betUsdValue,
        relics: [...relics],
        totalBet: addedTotalUsd,
        color,
        startTicket: 0,
        endTicket: 0,
        winProbability: 0,
        isBot: params.isBot
      });
    }

    this.recalculateTicketsAndProbabilities();

    // 1-Player Waiting Logic & 2-Player Start Rule
    if (this.currentRound.bets.length === 1 && !this.firstBetPlacedAt) {
      this.firstBetPlacedAt = Date.now();
      // Periodically update cancel countdown
      if (this.cancelCheckTimer) clearInterval(this.cancelCheckTimer);
      this.cancelCheckTimer = setInterval(() => {
        if (this.currentRound.status === 'WAITING_FOR_PLAYERS' && this.currentRound.bets.length === 1) {
          this.broadcastState();
        } else {
          if (this.cancelCheckTimer) clearInterval(this.cancelCheckTimer);
        }
      }, 1000);
    }

    // When 2 or more players have bet in PvP, start the countdown immediately!
    if (this.currentRound.status === 'WAITING_FOR_PLAYERS' && this.currentRound.bets.length >= 2) {
      this.startCountdownTimer();
    } else {
      this.broadcastState();
    }

    // High roller pot commentary announcement
    if (this.currentRound.totalPool >= 25 && !existingBet) {
      generateArenaCommentary({
        type: 'POT_SPIKE',
        roundId: this.currentRound.roundId,
        potAmount: this.currentRound.totalPool,
        playerCount: this.currentRound.bets.length
      }).then(commentary => {
        this.callbacks.sendChat({
          id: `ai_${Date.now()}`,
          sender: 'CYBER-VOX 9000',
          badge: 'AI ANNOUNCER',
          isAi: true,
          avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
          text: commentary,
          timestamp: Date.now()
        });
      });
    }

    return { success: true };
  }

  private recalculateTicketsAndProbabilities() {
    const totalUsd = this.currentRound.bets.reduce((sum, b) => sum + b.totalBet, 0);
    const totalTon = this.currentRound.bets.reduce((sum, b) => sum + (b.tonAmount || 0), 0);
    const totalStars = this.currentRound.bets.reduce((sum, b) => sum + (b.starsAmount || 0), 0);

    this.currentRound.totalPool = +(totalUsd.toFixed(2));
    this.currentRound.totalTonPool = +(totalTon.toFixed(4));
    this.currentRound.totalStarsPool = totalStars;

    let currentTicket = 0;
    for (const bet of this.currentRound.bets) {
      bet.startTicket = +(currentTicket.toFixed(4));
      currentTicket += bet.totalBet;
      bet.endTicket = +(currentTicket.toFixed(4));
      bet.winProbability = totalUsd > 0 ? +(bet.totalBet / totalUsd).toFixed(4) : 0;
    }
  }

  private async resolveRound() {
    if (this.currentRound.bets.length === 0) {
      this.startWaitingPhase();
      return;
    }

    this.recalculateTicketsAndProbabilities();

    const { winningValue } = calculateWinningValue(
      this.provablyFairKeys.serverSeed,
      this.currentRound.roundId,
      this.currentRound.totalPool
    );

    const outcome = determineWinner(
      this.currentRound.bets,
      winningValue,
      this.currentRound.totalPool
    );

    if (!outcome) {
      this.startWaitingPhase();
      return;
    }

    // Read system config for bot rake fee (default 5%)
    let rakePercent = 5.0;
    try {
      const config = await getSystemConfig();
      if (typeof config.arenaBotRakePercent === 'number') {
        rakePercent = config.arenaBotRakePercent;
      }
    } catch (e) {}

    const rates = getCachedRates();
    const tonPrice = rates.tonPriceUsd || 1.515;
    const starsPrice = rates.starsPriceUsd || 0.0130;

    const totalTon = this.currentRound.totalTonPool;
    const totalStars = this.currentRound.totalStarsPool;

    // Calculate 5% bot rake and winner payout for TON & Stars
    const rakeTon = +(totalTon * (rakePercent / 100)).toFixed(4);
    const rakeStars = Math.floor(totalStars * (rakePercent / 100));
    const payoutTon = +(totalTon - rakeTon).toFixed(4);
    const payoutStars = totalStars - rakeStars;
    const payoutUsd = +(payoutTon * tonPrice + payoutStars * starsPrice).toFixed(2);
    const rakeUsd = +(rakeTon * tonPrice + rakeStars * starsPrice).toFixed(2);

    const { winner } = outcome;
    const allWonRelics = this.currentRound.bets.flatMap(b => b.relics);

    const roundWinner: RoundWinner = {
      playerId: winner.playerId,
      username: winner.username,
      avatar: winner.avatar,
      color: winner.color,
      winProbability: winner.winProbability,
      payout: payoutUsd,
      payoutTon,
      payoutStars,
      payoutUsd,
      rakeAmount: rakeUsd,
      rakeTon,
      rakeStars,
      rakePercent,
      wonRelics: allWonRelics
    };

    this.currentRound.status = 'ROUND_RESOLVING';
    this.currentRound.winningTicket = winningValue;
    this.currentRound.winningPlayerId = winner.playerId;
    this.currentRound.winner = roundWinner;

    // Credit winner's in-app wallet immediately in Neon PostgreSQL if human player
    if (!winner.isBot) {
      try {
        await updateUserWallet(winner.playerId, prev => ({
          tonBalance: +(prev.tonBalance + payoutTon).toFixed(4),
          starsBalance: prev.starsBalance + payoutStars
        }));

        await recordLedgerTransaction({
          id: `win_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          userId: winner.playerId,
          type: 'GAME_WIN_PAYOUT',
          amountTon: payoutTon,
          amountStars: payoutStars,
          status: 'CONFIRMED',
          comment: `Won Area PvP Round #${this.currentRound.roundId} (Payout: ${payoutTon} TON, ${payoutStars} Stars)`,
          createdAt: Date.now()
        });
      } catch (err) {
        console.error('Error crediting winner wallet in database:', err);
      }
    }

    // Save game round into Neon Postgres
    recordGameRound({
      id: `area_${this.currentRound.roundId}`,
      gameId: 'arena',
      userId: winner.playerId,
      betAmount: Math.round(this.currentRound.totalPool),
      payoutAmount: Math.round(payoutUsd),
      multiplier: +(payoutUsd / (winner.totalBet || 1)).toFixed(2),
      status: 'WIN',
      serverSeed: this.provablyFairKeys.serverSeed,
      serverSeedHash: this.provablyFairKeys.seedHash,
      clientSeed: String(winningValue),
      gameDetails: {
        roundId: this.currentRound.roundId,
        winnerUsername: winner.username,
        payoutTon,
        payoutStars,
        payoutUsd,
        rakeTon,
        rakeStars,
        rakePercent,
        totalTon,
        totalStars,
        playersCount: this.currentRound.bets.length
      }
    }).catch(e => console.error('Error saving area round to DB:', e));

    // Authoritative 2D Air Hockey Trajectory
    try {
      const territories = computeProportionalTerritories(this.currentRound.bets, 460, 460);
      const traj = simulateAirHockeyFlight(
        this.currentRound.roundId,
        winner.playerId,
        territories,
        460,
        460,
        8400
      );
      this.currentRound.trajectory = traj;
    } catch (e) {
      console.error('Error generating round trajectory:', e);
    }

    this.broadcastState();

    setTimeout(() => {
      this.celebrateWinner(winningValue);
    }, this.RESOLUTION_MS);
  }

  private celebrateWinner(winningValue: number) {
    this.currentRound.status = 'WINNER_CELEBRATION';
    this.currentRound.revealedServerSeed = this.provablyFairKeys.serverSeed;

    const winner = this.currentRound.winner!;

    const historyItem: RoundHistoryItem = {
      roundId: this.currentRound.roundId,
      poolTier: this.currentRound.poolTier,
      totalPool: this.currentRound.totalPool,
      totalTonPool: this.currentRound.totalTonPool,
      totalStarsPool: this.currentRound.totalStarsPool,
      playerCount: this.currentRound.bets.length,
      players: this.currentRound.bets.map(b => ({ ...b })),
      winner: { ...winner },
      provablyFair: {
        serverSeed: this.provablyFairKeys.serverSeed,
        seedHash: this.provablyFairKeys.seedHash,
        winningTicket: winningValue,
        winningValue
      },
      trajectory: this.currentRound.trajectory,
      completedAt: Date.now()
    };
    this.history.unshift(historyItem);
    if (this.history.length > 50) this.history.pop();
    this.persistHistory();

    this.broadcastState();

    // AI Commentary
    const isUnderdog = winner.winProbability <= 0.15;
    const isWhale = winner.winProbability >= 0.75;
    const isSpike = this.currentRound.totalPool >= 15;

    let eventType: 'UNDERDOG_WIN' | 'WHALE_DOMINATION' | 'POT_SPIKE' | 'CLOSE_CALL' = 'CLOSE_CALL';
    if (isUnderdog) eventType = 'UNDERDOG_WIN';
    else if (isWhale) eventType = 'WHALE_DOMINATION';
    else if (isSpike) eventType = 'POT_SPIKE';

    generateArenaCommentary({
      type: eventType,
      roundId: this.currentRound.roundId,
      winnerName: winner.username,
      winnerChance: winner.winProbability,
      potAmount: this.currentRound.totalPool,
      playerCount: this.currentRound.bets.length
    }).then(commentary => {
      this.callbacks.sendChat({
        id: `ai_${Date.now()}`,
        sender: 'CYBER-VOX 9000',
        badge: 'AI ANNOUNCER',
        isAi: true,
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
        text: commentary,
        timestamp: Date.now()
      });
    });

    setTimeout(() => {
      this.startWaitingPhase();
    }, this.CELEBRATION_MS);
  }

  private broadcastState() {
    this.callbacks.broadcast({
      type: 'ROUND_STATE',
      state: this.getState(),
      history: this.history
    });
  }
}
