/**
 * Client-side cryptographic verifier using Web Crypto API
 */

export async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hmacSha256Hex(keyHex: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  // keyHex is hex string
  const keyBytes = new Uint8Array(
    keyHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
  );

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  const sigArray = Array.from(new Uint8Array(sigBuffer));
  return sigArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface ClientVerificationResult {
  hashMatches: boolean;
  calculatedHash: string;
  claimedHash: string;
  hmacHex: string;
  winningValue: number;
  winningPlayerId: string;
  winningPlayerUsername?: string;
}

export async function verifyClientSide(
  serverSeed: string,
  claimedHash: string,
  roundId: number,
  totalPool: number,
  playerBets: { playerId: string; username: string; totalBet: number }[]
): Promise<ClientVerificationResult> {
  const calculatedHash = await sha256Hex(serverSeed);
  const hashMatches = calculatedHash.toLowerCase() === claimedHash.toLowerCase();

  const hmacHex = await hmacSha256Hex(serverSeed, roundId.toString());
  const poolInCents = BigInt(Math.max(1, Math.floor(totalPool * 100)));
  const hmacBigInt = BigInt('0x' + hmacHex);
  const remainder = hmacBigInt % poolInCents;
  const winningValue = Number(remainder) / 100;

  let currentTicket = 0;
  let winningPlayerId = '';
  let winningPlayerUsername = '';

  for (const p of playerBets) {
    const start = currentTicket;
    const end = +(start + p.totalBet).toFixed(2);
    if (winningValue >= start && winningValue < end) {
      winningPlayerId = p.playerId;
      winningPlayerUsername = p.username;
      break;
    }
    currentTicket = end;
  }

  if (!winningPlayerId && playerBets.length > 0) {
    winningPlayerId = playerBets[playerBets.length - 1].playerId;
    winningPlayerUsername = playerBets[playerBets.length - 1].username;
  }

  return {
    hashMatches,
    calculatedHash,
    claimedHash,
    hmacHex,
    winningValue,
    winningPlayerId,
    winningPlayerUsername
  };
}
