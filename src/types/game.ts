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
  value: number;
  icon: string;
  color: string;
}

export interface PlayerBet {
  playerId: string;
  username: string;
  avatar: string;
  creditBet: number;
  relics: Relic[];
  totalBet: number;
  color: string;
  startTicket: number;
  endTicket: number;
  winProbability: number;
  isBot?: boolean;
}

export interface RoundHistoryItem {
  roundId: number;
  poolTier: 'STANDARD' | 'HIGH_ROLLER';
  totalPool: number;
  playerCount: number;
  players: PlayerBet[];
  winner: {
    playerId: string;
    username: string;
    avatar: string;
    color: string;
    winProbability: number;
    payout: number;
    rakeAmount: number;
    rakePercent: number;
    wonRelics: Relic[];
  };
  provablyFair: {
    serverSeed: string;
    seedHash: string;
    winningTicket: number;
    winningValue: number;
  };
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
  totalPool: number;
  bets: PlayerBet[];
  timeRemainingMs: number;
  roundDurationMs: number;
  resolutionDurationMs: number;
  celebrationDurationMs: number;
  winningTicket?: number;
  winningPlayerId?: string;
  winner?: RoundHistoryItem['winner'];
  isBettingClosed?: boolean;
  minPlayersNeeded?: number;
}

export interface UserProfile {
  id: string;
  username: string;
  avatar: string;
  credits: number;
  inventory: Relic[];
}
