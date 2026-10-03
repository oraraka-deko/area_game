export type RoundStatus = 
  | 'WAITING_FOR_PLAYERS'
  | 'BETTING_OPEN'
  | 'ROUND_RESOLVING'
  | 'WINNER_CELEBRATION';

export type RelicRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Relic {
  id: string;
  name: string;
  rarity: RelicRarity;
  value: number; // in USD
  icon: string;
  color: string;
}

export interface PlayerBet {
  playerId: string;
  username: string;
  avatar: string;
  currency: 'ton' | 'stars';
  tonAmount: number;
  starsAmount: number;
  betValueUSD: number;
  creditBet: number; // USD value used for territory calculation
  relics: Relic[];
  totalBet: number; // Total USD equivalent
  color: string;
  startTicket: number;
  endTicket: number;
  winProbability: number; // 0 to 1
  isBot?: boolean;
}

export interface RoundWinner {
  playerId: string;
  username: string;
  avatar: string;
  color: string;
  winProbability: number;
  payout: number; // Total USD
  payoutTon: number;
  payoutStars: number;
  payoutUsd: number;
  rakeAmount: number;
  rakeTon: number;
  rakeStars: number;
  rakePercent: number;
  wonRelics: Relic[];
}

export interface RoundHistoryItem {
  roundId: number;
  poolTier: 'STANDARD' | 'HIGH_ROLLER';
  totalPool: number;
  totalTonPool?: number;
  totalStarsPool?: number;
  playerCount: number;
  players: PlayerBet[];
  winner: RoundWinner;
  provablyFair: {
    serverSeed: string;
    seedHash: string;
    winningTicket: number;
    winningValue: number;
  };
  trajectory?: any;
  completedAt: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  isAi?: boolean;
  avatar?: string;
  badge?: string;
}

export interface CurrentRoundState {
  roundId: number;
  status: RoundStatus;
  poolTier: 'STANDARD' | 'HIGH_ROLLER';
  serverSeedHash: string;
  revealedServerSeed?: string;
  totalPool: number; // Total USD
  totalTonPool: number;
  totalStarsPool: number;
  bets: PlayerBet[];
  timeRemainingMs: number;
  roundDurationMs: number;
  resolutionDurationMs: number;
  celebrationDurationMs: number;
  winningTicket?: number;
  winningPlayerId?: string;
  winner?: RoundWinner;
  trajectory?: any;
  isBettingClosed?: boolean;
  minPlayersNeeded?: number;
  firstBetPlacedAt?: number | null;
  cancelAvailableInMs?: number;
}

export interface UserProfile {
  id: string;
  username: string;
  avatar: string;
  credits: number; // Legacy compat
  tonBalance: number;
  starsBalance: number;
  inventory: Relic[];
  stats?: {
    roundsPlayed?: number;
    roundsWon?: number;
    totalWagered?: number;
    biggestWin?: number;
    totalDepositedTon?: number;
    totalDepositedStars?: number;
  };
}
