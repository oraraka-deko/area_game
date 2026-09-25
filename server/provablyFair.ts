import crypto from 'crypto';
import { PlayerBet } from './types.js';

export interface ProvablyFairRound {
  serverSeed: string;
  seedHash: string;
}

export function generateServerSeed(): ProvablyFairRound {
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const seedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
  return { serverSeed, seedHash };
}

/**
 * Calculates winning ticket / value using HMAC-SHA256(server_seed, roundId) mod totalPool
 */
export function calculateWinningValue(
  serverSeed: string,
  roundId: number,
  totalPool: number
): { winningValue: number; winningTicketBigInt: string; hmacHex: string } {
  if (totalPool <= 0) {
    return { winningValue: 0, winningTicketBigInt: '0', hmacHex: '' };
  }

  const hmacHex = crypto
    .createHmac('sha256', serverSeed)
    .update(roundId.toString())
    .digest('hex');

  // Convert to BigInt and mod with totalPool * 100 for 2 decimal places precision
  const poolInCents = BigInt(Math.max(1, Math.floor(totalPool * 100)));
  const hmacBigInt = BigInt('0x' + hmacHex);
  const remainder = hmacBigInt % poolInCents;
  const winningValue = Number(remainder) / 100;

  return {
    winningValue,
    winningTicketBigInt: remainder.toString(),
    hmacHex
  };
}

/**
 * Determine winner from player bets and winning value
 */
export function determineWinner(
  bets: PlayerBet[],
  winningValue: number,
  totalPool: number
): {
  winner: PlayerBet;
  rakePercent: number;
  rakeAmount: number;
  payout: number;
} | null {
  if (!bets.length || totalPool <= 0) return null;

  // Find the player whose cumulative range [startTicket, endTicket) includes winningValue
  let chosen = bets[0];
  for (const bet of bets) {
    if (winningValue >= bet.startTicket && winningValue < bet.endTicket) {
      chosen = bet;
      break;
    }
  }

  // Edge case for floating point boundary at upper limit
  if (winningValue >= chosen.endTicket && bets.length > 0) {
    chosen = bets[bets.length - 1];
  }

  const winProb = chosen.winProbability;
  // House rake 1% to 25%, inversely scaled with win probability
  // 100% win chance -> 1% rake. 0% win chance -> 25% rake.
  const rakePercent = Math.min(25, Math.max(1, +(25 - winProb * 24).toFixed(2)));
  const netProfit = Math.max(0, totalPool - chosen.totalBet);
  const rakeAmount = +((netProfit * rakePercent) / 100).toFixed(2);
  const payout = +(totalPool - rakeAmount).toFixed(2);

  return {
    winner: chosen,
    rakePercent,
    rakeAmount,
    payout
  };
}

/**
 * Verification utility for independent clients
 */
export function verifyRoundOutcome(
  serverSeed: string,
  claimedHash: string,
  roundId: number,
  totalPool: number,
  playerBets: { playerId: string; totalBet: number }[]
) {
  const calculatedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
  const hashMatches = calculatedHash === claimedHash;

  const poolInCents = BigInt(Math.max(1, Math.floor(totalPool * 100)));
  const hmacHex = crypto
    .createHmac('sha256', serverSeed)
    .update(roundId.toString())
    .digest('hex');
  const hmacBigInt = BigInt('0x' + hmacHex);
  const remainder = hmacBigInt % poolInCents;
  const winningValue = Number(remainder) / 100;

  let currentTicket = 0;
  let winningPlayerId = '';
  for (const p of playerBets) {
    const start = currentTicket;
    const end = +(start + p.totalBet).toFixed(2);
    if (winningValue >= start && winningValue < end) {
      winningPlayerId = p.playerId;
      break;
    }
    currentTicket = end;
  }

  return {
    hashMatches,
    calculatedHash,
    claimedHash,
    hmacHex,
    winningValue,
    winningPlayerId
  };
}
