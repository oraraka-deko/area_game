import { getSystemConfig } from './db.js';

export interface RatesData {
  tonPriceUsd: number;
  starsPriceUsd: number;
  diff24h: string;
  diff7d: string;
  diff30d: string;
  updatedAt: number;
}

let cachedRates: RatesData = {
  tonPriceUsd: 1.515,
  starsPriceUsd: 0.0130, // Official Telegram Fragment Creator Cashout rate (~$0.0130 - $0.0133)
  diff24h: '+0.12%',
  diff7d: '+2.03%',
  diff30d: '+10.21%',
  updatedAt: 0
};

let lastFetchTime = 0;
const CACHE_TTL_MS = 45000; // 45 seconds cache

export async function fetchLiveRates(): Promise<RatesData> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL_MS && cachedRates.updatedAt > 0) {
    // Keep stars price updated from system config even when rate cache is fresh
    try {
      const config = await getSystemConfig();
      if (config.starsPriceUsd) {
        cachedRates.starsPriceUsd = config.starsPriceUsd;
      }
    } catch (e) {}
    return cachedRates;
  }

  try {
    const res = await fetch('https://tonapi.io/v2/rates?tokens=ton&currencies=usd', {
      headers: { Accept: 'application/json' }
    });

    if (res.ok) {
      const data = await res.json();
      const tonRates = data?.rates?.TON;
      if (tonRates && tonRates.prices?.USD) {
        cachedRates.tonPriceUsd = parseFloat(tonRates.prices.USD);
        cachedRates.diff24h = tonRates.diff_24h?.USD || cachedRates.diff24h;
        cachedRates.diff7d = tonRates.diff_7d?.USD || cachedRates.diff7d;
        cachedRates.diff30d = tonRates.diff_30d?.USD || cachedRates.diff30d;
        cachedRates.updatedAt = now;
        lastFetchTime = now;
      }
    }
  } catch (err) {
    console.warn('Could not fetch real-time TON rates from tonapi.io, using cached/fallback:', err);
  }

  // Load configured stars price from system config
  try {
    const config = await getSystemConfig();
    if (config.starsPriceUsd) {
      cachedRates.starsPriceUsd = config.starsPriceUsd;
    }
  } catch (e) {}

  return cachedRates;
}

export function getCachedRates(): RatesData {
  return cachedRates;
}
