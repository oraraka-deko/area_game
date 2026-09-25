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
  public readonly RESOLUTION_MS = 7500;
  public readonly CELEBRATION_MS = 6000;

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
      minPlayersNeeded: 2
    };

    // Pre-populate some historical rounds for instant rich history view
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

  private seedInitialHistory() {
    const pastSeeds = [
      { seed: 'e880fa31b9920194812398418abdf62901239129031203912039120391203912', hash: 'dd694ad1eb834710293847192837491823749182739481273948172938471928' },
      { seed: '644ed62981374091283749182739481273948172938471928374918273948127', hash: 'cb5aef8eb8293847192837491827394817293847192837491827394817293847' },
      { seed: '3843da9182374918273948172938471928374918273948172938471928374918', hash: 'a02e9deeaf293847192837491827394817293847192837491827394817293847' }
    ];

    pastSeeds.forEach((s, idx) => {
      const p1 = BOT_PROFILES[idx];
      const p2 = BOT_PROFILES[(idx + 1) % BOT_PROFILES.length];
      const p3 = BOT_PROFILES[(idx + 2) % BOT_PROFILES.length];
      const bet1 = 200 + idx * 300;
      const bet2 = 150 + idx * 250;
      const bet3 = 100 + idx * 270;
      const total = bet1 + bet2 + bet3;

      const histBets: PlayerBet[] = [
        {
          playerId: p1.id,
          username: p1.username,
          avatar: p1.avatar,
          color: p1.color,
          creditBet: bet1,
          relics: [],
          totalBet: bet1,
          startTicket: 0,
          endTicket: bet1,
          winProbability: +(bet1 / total).toFixed(4),
          isBot: true
        },
        {
          playerId: p2.id,
          username: p2.username,
          avatar: p2.avatar,
          color: p2.color,
          creditBet: bet2,
          relics: [],
          totalBet: bet2,
          startTicket: bet1,
          endTicket: bet1 + bet2,
          winProbability: +(bet2 / total).toFixed(4),
          isBot: true
        },
        {
          playerId: p3.id,
          username: p3.username,
          avatar: p3.avatar,
          color: p3.color,
          creditBet: bet3,
          relics: [],
          totalBet: bet3,
          startTicket: bet1 + bet2,
          endTicket: total,
          winProbability: +(bet3 / total).toFixed(4),
          isBot: true
        }
      ];

      this.history.unshift({
        roundId: 436008 + idx,
        poolTier: idx === 1 ? 'HIGH_ROLLER' : 'STANDARD',
        totalPool: total,
        playerCount: 3,
        players: histBets,
        winner: {
          playerId: p1.id,
          username: p1.username,
          avatar: p1.avatar,
          color: p1.color,
          winProbability: histBets[0].winProbability,
          payout: total * 0.94,
          rakeAmount: total * 0.06,
          rakePercent: 6.0,
          wonRelics: []
        },
        provablyFair: {
          serverSeed: s.seed,
          seedHash: s.hash,
          winningTicket: +(bet1 * 0.4).toFixed(2),
          winningValue: +(bet1 * 0.4).toFixed(2)
        },
        completedAt: Date.now() - (3 - idx) * 90000
      });
    });
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
      minPlayersNeeded: 2
    };

    this.broadcastState();
    this.scheduleInitialBotEntries();
  }

  private scheduleInitialBotEntries() {
    // If no human places a bet within 3s, first bot places a bet
    setTimeout(() => {
      if (this.currentRound.status === 'WAITING_FOR_PLAYERS' && this.currentRound.bets.length === 0) {
        this.simulateBotBet();
      }
    }, 2800);

    // After 1st bet exists, if still waiting for 2nd player, 2nd bot joins to start 20s countdown
    setTimeout(() => {
      if (this.currentRound.status === 'WAITING_FOR_PLAYERS' && this.currentRound.bets.length < 2) {
        this.simulateBotBet();
      }
    }, 5500);
  }

  private startCountdownTimer() {
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

    // Schedule subsequent bots to join while countdown is running
    this.scheduleCountdownBots();
  }

  private scheduleCountdownBots() {
    if (this.botTimer) clearInterval(this.botTimer);

    let extraBotCount = 0;
    const maxExtraBots = 1 + Math.floor(Math.random() * 2);

    this.botTimer = setInterval(() => {
      if (this.currentRound.status !== 'BETTING_OPEN' || this.currentRound.isBettingClosed) {
        if (this.botTimer) clearInterval(this.botTimer);
        return;
      }

      // Only enter if more than 4.5 seconds left (before the 3s betting closed alert)
      if (extraBotCount < maxExtraBots && this.currentRound.timeRemainingMs > 4500) {
        this.simulateBotBet();
        extraBotCount++;

        // Occasional chat
        if (Math.random() < 0.4) {
          const randomBot = BOT_PROFILES[Math.floor(Math.random() * BOT_PROFILES.length)];
          const line = BOT_CHAT_LINES[Math.floor(Math.random() * BOT_CHAT_LINES.length)];
          this.callbacks.sendChat({
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sender: randomBot.username,
            avatar: randomBot.avatar,
            text: line,
            timestamp: Date.now()
          });
        }
      } else {
        if (this.botTimer) clearInterval(this.botTimer);
      }
    }, 4000);
  }

  private simulateBotBet() {
    // Filter bots not in round yet
    const availableBots = BOT_PROFILES.filter(b => !this.botsInRound.has(b.id));
    if (!availableBots.length) return;

    const bot = availableBots[Math.floor(Math.random() * availableBots.length)];
    this.botsInRound.add(bot.id);

    const isHighRoller = this.currentRound.poolTier === 'HIGH_ROLLER';
    let baseCredits = isHighRoller ? 250 + Math.floor(Math.random() * 800) : 20 + Math.floor(Math.random() * 120);

    if (bot.betStyle === 'whale') {
      baseCredits *= (isHighRoller ? 2.5 : 3.5);
    }

    const relics: Relic[] = [];
    if (Math.random() < 0.4 || bot.betStyle === 'relic_hunter') {
      relics.push(getRandomRelic());
    }

    this.placeBet({
      playerId: bot.id,
      username: bot.username,
      avatar: bot.avatar,
      color: bot.color,
      creditAmount: Math.round(baseCredits),
      relics,
      isBot: true
    });
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

    // If we were waiting for players and now have 2 or more players, start the 20s countdown!
    if (this.currentRound.status === 'WAITING_FOR_PLAYERS' && this.currentRound.bets.length >= 2) {
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
    // If no bets were placed, add a bot or extend
    if (this.currentRound.bets.length === 0) {
      this.simulateBotBet();
    }
    if (this.currentRound.bets.length < 2) {
      // Ensure at least 2 participants for a fun arena showdown
      this.simulateBotBet();
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
    if (this.history.length > 30) this.history.pop();

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
      state: this.currentRound
    });
  }
}
