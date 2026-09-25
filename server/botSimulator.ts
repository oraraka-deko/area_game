import { Relic, RelicRarity } from './types.js';

export interface BotProfile {
  id: string;
  username: string;
  avatar: string;
  color: string;
  balance: number;
  betStyle: 'conservative' | 'balanced' | 'whale' | 'relic_hunter';
}

export const RELIC_CATALOG: Omit<Relic, 'id'>[] = [
  { name: 'Bronze Talisman', rarity: 'common', value: 25, icon: '🥉', color: '#cd7f32' },
  { name: 'Iron Emblem', rarity: 'common', value: 50, icon: '🛡️', color: '#94a3b8' },
  { name: 'Silver Chalice', rarity: 'rare', value: 150, icon: '🏆', color: '#cbd5e1' },
  { name: 'Cobalt Core', rarity: 'rare', value: 300, icon: '💎', color: '#38bdf8' },
  { name: 'Neon Prism', rarity: 'epic', value: 750, icon: '🔮', color: '#c084fc' },
  { name: 'Cyber Crown', rarity: 'epic', value: 1500, icon: '👑', color: '#facc15' },
  { name: 'Celestial Shard', rarity: 'legendary', value: 3500, icon: '✨', color: '#f43f5e' },
  { name: 'Singularity Void', rarity: 'legendary', value: 8000, icon: '🌌', color: '#a855f7' },
];

export const BOT_PROFILES: BotProfile[] = [
  {
    id: 'bot_zooba',
    username: 'Zooba',
    avatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=120&auto=format&fit=crop&q=80',
    color: '#10b981', // Emerald Green
    balance: 15000,
    betStyle: 'whale'
  },
  {
    id: 'bot_lmia',
    username: '-LMIA-',
    avatar: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=120&auto=format&fit=crop&q=80',
    color: '#0ea5e9', // Sky Blue
    balance: 8500,
    betStyle: 'balanced'
  },
  {
    id: 'bot_roman',
    username: 'Roman',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    color: '#f59e0b', // Amber
    balance: 4200,
    betStyle: 'conservative'
  },
  {
    id: 'bot_tetris',
    username: 'Тетрис #проклят',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    color: '#8b5cf6', // Violet
    balance: 12000,
    betStyle: 'whale'
  },
  {
    id: 'bot_sumnek',
    username: 'Sumnek',
    avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=120&auto=format&fit=crop&q=80',
    color: '#06b6d4', // Cyan
    balance: 6000,
    betStyle: 'relic_hunter'
  },
  {
    id: 'bot_inaku',
    username: 'inaku',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    color: '#ec4899', // Pink
    balance: 7500,
    betStyle: 'balanced'
  },
  {
    id: 'bot_kothet',
    username: 'Ko Thet',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    color: '#eab308', // Yellow
    balance: 9000,
    betStyle: 'whale'
  },
  {
    id: 'bot_micolaj',
    username: 'Морячок Mikołaj',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
    color: '#14b8a6', // Teal
    balance: 5500,
    betStyle: 'relic_hunter'
  }
];

export const BOT_CHAT_LINES = [
  'LFG! Territory is mine this round.',
  'Dropping a relic into the pot, good luck everyone!',
  'Look at those odds... smells like an upset coming.',
  'Whoever takes this pot is eating steak tonight!',
  'That camera zoom never fails to get my heart rate to 180.',
  'Provably fair RNG, do your magic!',
  'I am feeling the 2D green slice today!',
  'Whale check! Who just boosted the pool?',
  'GGs in advance! May the best ticket hit.'
];

export function getRandomRelic(): Relic {
  const roll = Math.random();
  let rarity: RelicRarity = 'common';
  if (roll < 0.05) rarity = 'legendary';
  else if (roll < 0.20) rarity = 'epic';
  else if (roll < 0.50) rarity = 'rare';

  const candidates = RELIC_CATALOG.filter(r => r.rarity === rarity);
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    ...picked,
    id: `relic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  };
}
