// Helper to save all game activity and outcomes directly into Neon PostgreSQL
export async function recordGameOutcome(params: {
  id?: string;
  gameId: string;
  userId: string;
  currency?: 'ton' | 'stars';
  betAmount: number;
  payoutAmount: number;
  multiplier: number;
  status: 'WIN' | 'LOSS' | 'PUSH' | 'COMPLETED';
  serverSeed?: string;
  serverSeedHash?: string;
  clientSeed?: string;
  gameDetails?: Record<string, any>;
}): Promise<any> {
  try {
    const res = await fetch('/api/games/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to record game round to database:', err);
  }
  return null;
}
