import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CurrentRoundState,
  PlayerBet,
  Relic,
  RoundHistoryItem,
  ChatMessage,
  RoundStatus
} from './types.js';
import {
  generateServerSeed,
  calculateWinningValue,
  determineWinner,
  ProvablyFairRound
} from './provablyFair.js';
import { BOT_PROFILES, BOT_CHAT_LINES, getRandomRelic } from './botSimulator.js';
import { generateArenaCommentary } from './geminiAnnouncer.js';

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
  private roundStartTime: number = Date.now();
  private botsInRound: Set<string> = new Set();

  public readonly ROUND_BETTING_MS = 20000;
  public readonly RESOLUTION_MS = 10000;
  public readonly CELEBRATION_MS = 6000;
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
      bets: [],
      timeRemainingMs: this.ROUND_BETTING_MS,
      roundDurationMs: this.ROUND_BETTING_MS,
      resolutionDurationMs: this.RESOLUTION_MS,
      celebrationDurationMs: this.CELEBRATION_MS,
      isBettingClosed: false,
      minPlayersNeeded: 1
    };

    this.seedInitialHistory();
  }

  public start() {
    this.startWaitingPhase();
  }

  public getState(): CurrentRoundState {
    return this.currentRound;
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
        totalPool: 2850,
        playerCount: 3,
        players: [
          {
            playerId: 'bot_tetris',
            username: 'Тетрис #проклят',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
            color: '#8b5cf6',
            creditBet: 1500,
            relics: [],
            totalBet: 1500,
            startTicket: 0,
            endTicket: 1500,
            winProbability: 0.5263,
            isBot: true
          },
          {
            playerId: 'bot_lmia',
            username: '-LMIA-',
            avatar: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=120&auto=format&fit=crop&q=80',
            color: '#0ea5e9',
            creditBet: 850,
            relics: [],
            totalBet: 850,
            startTicket: 1500,
            endTicket: 2350,
            winProbability: 0.2982,
            isBot: true
          },
          {
            playerId: 'bot_roman',
            username: 'Roman',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
            color: '#f59e0b',
            creditBet: 500,
            relics: [],
            totalBet: 500,
            startTicket: 2350,
            endTicket: 2850,
            winProbability: 0.1754,
            isBot: true
          }
        ],
        winner: {
          playerId: 'bot_tetris',
          username: 'Тетрис #проклят',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
          color: '#8b5cf6',
          winProbability: 0.5263,
          payout: 2679,
          rakeAmount: 171,
          rakePercent: 6.0,
          wonRelics: []
        },
        provablyFair: {
          serverSeed: '644ed62981374091283749182739481273948172938471928374918273948127',
          seedHash: 'cb5aef8eb8293847192837491827394817293847192837491827394817293847',
          winningTicket: 642.15,
          winningValue: 642.15
        },
        completedAt: Date.now() - 180000
      },
      {
        roundId: 436009,
        poolTier: 'STANDARD',
        totalPool: 620,
        playerCount: 2,
        players: [
          {
            playerId: 'usr_me',
            username: 'NeoGlitch',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
            color: '#ccff00',
            creditBet: 400,
            relics: [],
            totalBet: 400,
            startTicket: 0,
            endTicket: 400,
            winProbability: 0.6452
          },
          {
            playerId: 'bot_inaku',
            username: 'inaku',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
            color: '#ec4899',
            creditBet: 220,
            relics: [],
            totalBet: 220,
            startTicket: 400,
            endTicket: 620,
            winProbability: 0.3548,
            isBot: true
          }
        ],
        winner: {
          playerId: 'usr_me',
          username: 'NeoGlitch',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
          color: '#ccff00',
          winProbability: 0.6452,
          payout: 582.8,
          rakeAmount: 37.2,
          rakePercent: 6.0,
          wonRelics: []
        },
        provablyFair: {
          serverSeed: 'e880fa31b9920194812398418abdf62901239129031203912039120391203912',
          seedHash: 'dd694ad1eb834710293847192837491827394817293847192837491827394817293847',
          winningTicket: 154.20,
          winningValue: 154.20
        },
        completedAt: Date.now() - 420000
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
    if (this.timer) clearInterval(this.timer);
    if (this.botTimer) clearInterval(this.botTimer);

    const isHighRoller = Math.random() < 0.25;
    this.currentRound = {
      roundId: this.currentRound.roundId + 1,
      status: 'WAITING_FOR_PLAYERS',
      poolTier: isHighRoller ? 'HIGH_ROLLER' : 'STANDARD',
      serverSeedHash: this.provablyFairKeys.seedHash,
      totalPool: 0,
      bets: [],
      timeRemainingMs: this.ROUND_BETTING_MS,
      roundDurationMs: this.ROUND_BETTING_MS,
      resolutionDurationMs: this.RESOLUTION_MS,
      celebrationDurationMs: this.CELEBRATION_MS,
      isBettingClosed: false,
      minPlayersNeeded: 1
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
    this.currentRound.isBettingClosed = true;
    this.resolveRound();
  }

  public forceResetRound() {
    if (this.timer) clearInterval(this.timer);
    if (this.botTimer) clearInterval(this.botTimer);
    this.startWaitingPhase();
  }

  public startCountdownTimer() {
    this.currentRound.status = 'BETTING_OPEN';
    this.roundStartTime = Date.now();
    this.currentRound.timeRemainingMs = this.ROUND_BETTING_MS;
    this.currentRound.isBettingClosed = false;

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
        // Broadcast periodic ticks (and frequent ticks during 10s alert phase)
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

  public addRandomPlayer(creditAmount?: number): { success: boolean; player?: any; error?: string } {
    if (this.currentRound.isBettingClosed || this.currentRound.status === 'ROUND_RESOLVING' || this.currentRound.status === 'WINNER_CELEBRATION') {
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

    // Random bet amount: between 20 and 500 in multiples of 10 if not specified
    const randomBet = (creditAmount !== undefined && creditAmount > 0)
      ? Math.floor(creditAmount)
      : Math.floor(2 + Math.random() * 48) * 10;

    const relics: Relic[] = [];
    if (Math.random() < 0.3) {
      relics.push(getRandomRelic());
    }

    const placeResult = this.placeBet({
      playerId: bot.id,
      username: bot.username,
      avatar: bot.avatar,
      color: bot.color,
      creditAmount: randomBet,
      relics,
      isBot: true
    });

    if (placeResult.success) {
      if (Math.random() < 0.6) {
        const line = BOT_CHAT_LINES[Math.floor(Math.random() * BOT_CHAT_LINES.length)];
        this.callbacks.sendChat({
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          sender: bot.username,
          avatar: bot.avatar,
          text: line,
          timestamp: Date.now()
        });
      }
    }

    return { success: placeResult.success, player: bot, error: placeResult.error };
  }

  public placeBet(params: {
    playerId: string;
    username: string;
    avatar: string;
    color?: string;
    creditAmount: number;
    relics?: Relic[];
    isBot?: boolean;
  }): { success: boolean; error?: string } {
    if (this.currentRound.isBettingClosed || this.currentRound.status === 'ROUND_RESOLVING' || this.currentRound.status === 'WINNER_CELEBRATION') {
      return { success: false, error: 'Betting is closed for this round' };
    }

    const creditAmount = Math.max(0, Math.floor(params.creditAmount));
    const relics = params.relics || [];
    const relicsValue = relics.reduce((sum, r) => sum + r.value, 0);
    const addedTotal = creditAmount + relicsValue;

    if (addedTotal <= 0) {
      return { success: false, error: 'Bet must be greater than 0' };
    }

    const palette = [
      '#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b',
      '#ec4899', '#14b8a6', '#f97316', '#a855f7'
    ];

    let existingBet = this.currentRound.bets.find(b => b.playerId === params.playerId);

    if (existingBet) {
      existingBet.creditBet += creditAmount;
      existingBet.relics = [...existingBet.relics, ...relics];
      existingBet.totalBet += addedTotal;
    } else {
      const color = params.color || palette[this.currentRound.bets.length % palette.length];
      this.currentRound.bets.push({
        playerId: params.playerId,
        username: params.username,
        avatar: params.avatar,
        creditBet: creditAmount,
        relics: [...relics],
        totalBet: addedTotal,
        color,
        startTicket: 0,
        endTicket: 0,
        winProbability: 0,
        isBot: params.isBot
      });
    }

    this.recalculateTicketsAndProbabilities();

    // If autoStart is enabled and we have at least 1 player, start countdown
    if (this.autoStart && this.currentRound.status === 'WAITING_FOR_PLAYERS' && this.currentRound.bets.length >= (this.currentRound.minPlayersNeeded || 1)) {
      this.startCountdownTimer();
    } else {
      this.broadcastState();
    }

    // If pot spikes over 5,000 credits for the first time in round, announce it
    if (this.currentRound.totalPool >= 5000 && !existingBet) {
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
    const total = this.currentRound.bets.reduce((sum, b) => sum + b.totalBet, 0);
    this.currentRound.totalPool = +(total.toFixed(2));

    let currentTicket = 0;
    for (const bet of this.currentRound.bets) {
      bet.startTicket = +(currentTicket.toFixed(2));
      currentTicket += bet.totalBet;
      bet.endTicket = +(currentTicket.toFixed(2));
      bet.winProbability = total > 0 ? +(bet.totalBet / total).toFixed(4) : 0;
    }
  }

  private async resolveRound() {
    // If no bets were placed, return to waiting phase
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
      // Emergency reset if pool was zero
      this.startWaitingPhase();
      return;
    }

    const { winner, rakePercent, rakeAmount, payout } = outcome;
    const allWonRelics = this.currentRound.bets.flatMap(b => b.relics);

    this.currentRound.status = 'ROUND_RESOLVING';
    this.currentRound.winningTicket = winningValue;
    this.currentRound.winningPlayerId = winner.playerId;
    this.currentRound.winner = {
      playerId: winner.playerId,
      username: winner.username,
      avatar: winner.avatar,
      color: winner.color,
      winProbability: winner.winProbability,
      payout,
      rakeAmount,
      rakePercent,
      wonRelics: allWonRelics
    };

    // Broadcast resolving phase (client runs ball physics + camera zoom)
    this.broadcastState();

    // Trigger resolution delay (7.5s)
    setTimeout(() => {
      this.celebrateWinner(winningValue);
    }, this.RESOLUTION_MS);
  }

  private celebrateWinner(winningValue: number) {
    this.currentRound.status = 'WINNER_CELEBRATION';
    this.currentRound.revealedServerSeed = this.provablyFairKeys.serverSeed;

    const winner = this.currentRound.winner!;

    // Save to history
    const historyItem: RoundHistoryItem = {
      roundId: this.currentRound.roundId,
      poolTier: this.currentRound.poolTier,
      totalPool: this.currentRound.totalPool,
      playerCount: this.currentRound.bets.length,
      players: this.currentRound.bets.map(b => ({ ...b })),
      winner: { ...winner },
      provablyFair: {
        serverSeed: this.provablyFairKeys.serverSeed,
        seedHash: this.provablyFairKeys.seedHash,
        winningTicket: winningValue,
        winningValue
      },
      completedAt: Date.now()
    };
    this.history.unshift(historyItem);
    if (this.history.length > 50) this.history.pop();
    this.persistHistory();

    // Broadcast celebration
    this.broadcastState();

    // AI Commentary evaluation
    const isUnderdog = winner.winProbability <= 0.15;
    const isWhale = winner.winProbability >= 0.75;
    const isSpike = this.currentRound.totalPool >= 3000;

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

    // Schedule next round after celebration period
    setTimeout(() => {
      this.startWaitingPhase();
    }, this.CELEBRATION_MS);
  }

  private broadcastState() {
    this.callbacks.broadcast({
      type: 'ROUND_STATE',
      state: this.currentRound,
      history: this.history
    });
  }
}
