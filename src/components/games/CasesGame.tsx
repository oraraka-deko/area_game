import React, { useState, useRef } from 'react';
import { sound } from '../../utils/audio.js';
import { haptic } from '../../utils/telegram.js';
import { UserProfile, Relic, RelicRarity } from '../../types/game.js';
import { ArrowLeft, Gift, Sparkles, Box, Trophy } from 'lucide-react';
import { recordGameOutcome } from '../../utils/gameRecord.js';

interface CasesGameProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  onBack: () => void;
}

interface CaseTier {
  id: string;
  name: string;
  priceStars: number;
  priceTon: number;
  color: string;
  icon: string;
  description: string;
  pool: { name: string; rarity: RelicRarity; icon: string; value: number; color: string }[];
}

export const CasesGame: React.FC<CasesGameProps> = ({ user, setUser, onBack }) => {
  const caseTiers: CaseTier[] = [
    {
      id: 'starter',
      name: 'Starter Crate',
      priceStars: 50,
      priceTon: 0.45,
      color: '#38bdf8',
      icon: '📦',
      description: 'Reliable starter items & collectible artifacts',
      pool: [
        { name: 'Bronze Key', rarity: 'common', icon: '🗝️', value: 0.35, color: '#94a3b8' },
        { name: 'Emerald Gem', rarity: 'common', icon: '💎', value: 0.50, color: '#10b981' },
        { name: 'Silver Compass', rarity: 'rare', icon: '🧭', value: 0.90, color: '#38bdf8' },
        { name: 'Cyber Dagger', rarity: 'epic', icon: '🗡️', value: 1.80, color: '#a855f7' }
      ]
    },
    {
      id: 'cyber',
      name: 'Cyber Arsenal',
      priceStars: 150,
      priceTon: 1.30,
      color: '#a855f7',
      icon: '🔮',
      description: 'High-tech artifacts and glowing weapon relics',
      pool: [
        { name: 'Neon Blade', rarity: 'rare', icon: '⚡', value: 1.20, color: '#38bdf8' },
        { name: 'Plasma Core', rarity: 'rare', icon: '🔮', value: 1.60, color: '#38bdf8' },
        { name: 'Quantum Visor', rarity: 'epic', icon: '🥽', value: 3.20, color: '#a855f7' },
        { name: 'Dragon Talon', rarity: 'legendary', icon: '🐉', value: 8.00, color: '#eab308' }
      ]
    },
    {
      id: 'high_roller',
      name: 'High Roller Vault',
      priceStars: 500,
      priceTon: 4.25,
      color: '#eab308',
      icon: '👑',
      description: 'Exclusive luxury relics with huge multiplier value',
      pool: [
        { name: 'Gold Bar Relic', rarity: 'rare', icon: '🪙', value: 4.00, color: '#38bdf8' },
        { name: 'Obsidian Crown', rarity: 'epic', icon: '👑', value: 8.50, color: '#a855f7' },
        { name: 'Infinity Cube', rarity: 'legendary', icon: '🧊', value: 18.00, color: '#eab308' },
        { name: 'Phoenix Wing', rarity: 'legendary', icon: '🪶', value: 32.00, color: '#eab308' }
      ]
    }
  ];

  const [selectedCase, setSelectedCase] = useState<CaseTier>(caseTiers[0]);
  const [currency, setCurrency] = useState<'ton' | 'stars'>('ton');
  const [isUnboxing, setIsUnboxing] = useState<boolean>(false);
  const [reelItems, setReelItems] = useState<any[]>([]);
  const [wonItem, setWonItem] = useState<any | null>(null);
  const reelRef = useRef<HTMLDivElement | null>(null);

  const cost = currency === 'ton' ? selectedCase.priceTon : selectedCase.priceStars;
  const balance = currency === 'ton' ? (user.tonBalance || 0) : (user.starsBalance || 0);

  const handleOpenCase = () => {
    if (balance < cost || isUnboxing) {
      sound.playBettingClosed();
      haptic.notification('error');
      return;
    }

    // Deduct cost
    if (currency === 'ton') {
      setUser(prev => ({ ...prev, tonBalance: +(prev.tonBalance - cost).toFixed(4) }));
    } else {
      setUser(prev => ({ ...prev, starsBalance: Math.max(0, prev.starsBalance - Math.floor(cost)) }));
    }

    sound.playBetPlaced();
    haptic.impact('medium');
    setIsUnboxing(true);
    setWonItem(null);

    // Pick winner based on weights
    const pool = selectedCase.pool;
    const winner = pool[Math.floor(Math.random() * pool.length)];

    // Generate ~48 reel items with winner at position 35
    const WINNER_INDEX = 35;
    const items: any[] = [];
    for (let i = 0; i < 48; i++) {
      if (i === WINNER_INDEX) {
        items.push(winner);
      } else {
        items.push(pool[Math.floor(Math.random() * pool.length)]);
      }
    }
    setReelItems(items);

    // Animate reel
    setTimeout(() => {
      if (reelRef.current) {
        const itemWidth = 100; // px
        const offset = WINNER_INDEX * itemWidth + Math.floor(Math.random() * 40 - 20);
        reelRef.current.style.transition = 'transform 4.5s cubic-bezier(0.12, 0.8, 0.25, 1)';
        reelRef.current.style.transform = `translateX(-${offset}px)`;

        let tickCount = 0;
        const tickTimer = setInterval(() => {
          tickCount++;
          sound.playTick();
          if (tickCount > 28) clearInterval(tickTimer);
        }, 130);
      }
    }, 50);

    // Reveal winner at 4.7s
    setTimeout(() => {
      setIsUnboxing(false);
      setWonItem(winner);
      sound.playVictory();
      haptic.notification('success');

      // Add won relic to user inventory
      const newRelic: Relic = {
        id: `relic_${Date.now()}`,
        name: winner.name,
        rarity: winner.rarity,
        value: winner.value,
        icon: winner.icon,
        color: winner.color
      };

      setUser(prev => ({
        ...prev,
        inventory: [...prev.inventory, newRelic]
      }));

      // Record to Neon Postgres
      recordGameOutcome({
        gameId: 'cases',
        userId: user.id,
        currency,
        betAmount: cost,
        payoutAmount: winner.value,
        multiplier: +(winner.value / cost).toFixed(2),
        status: winner.value >= cost ? 'WIN' : 'LOSS',
        gameDetails: { caseId: selectedCase.id, itemName: winner.name, rarity: winner.rarity, currency }
      });
    }, 4700);
  };

  const handleResetReel = () => {
    if (reelRef.current) {
      reelRef.current.style.transition = 'none';
      reelRef.current.style.transform = 'translateX(0px)';
    }
    setWonItem(null);
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 pb-8 px-3">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-bold transition active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Menu</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50 font-mono">In-App Balance:</span>
          <span className="text-sm font-black font-mono text-cyan-300">
            {currency === 'ton' ? `${(user.tonBalance || 0).toFixed(2)} TON` : `${(user.starsBalance || 0).toLocaleString()} ⭐`}
          </span>
        </div>
      </div>

      {/* Case Selector Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {caseTiers.map(c => (
          <button
            key={c.id}
            disabled={isUnboxing}
            onClick={() => {
              setSelectedCase(c);
              handleResetReel();
              haptic.selection();
            }}
            className={`p-2.5 rounded-2xl border text-center transition-all duration-200 active:scale-95 ${
              selectedCase.id === c.id
                ? 'bg-purple-500/20 border-purple-500 text-white shadow-[0_0_16px_rgba(168,85,247,0.3)]'
                : 'bg-[#141624] border-white/5 text-white/60 hover:text-white'
            }`}
          >
            <div className="text-xl mb-0.5">{c.icon}</div>
            <div className="text-xs font-bold truncate">{c.name}</div>
            <div className="text-[11px] font-mono text-purple-300 font-black mt-0.5">
              {c.priceTon} TON / {c.priceStars} ⭐
            </div>
          </button>
        ))}
      </div>

      {/* Spinning Carousel Reel */}
      <div className="relative rounded-3xl border border-white/10 bg-[#0f111c] overflow-hidden p-4 shadow-xl flex flex-col items-center gap-4">
        {/* Currency Switcher */}
        {!isUnboxing && (
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => {
                setCurrency('ton');
                haptic.selection();
              }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                currency === 'ton' ? 'bg-cyan-500 text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              💎 Open with TON
            </button>
            <button
              onClick={() => {
                setCurrency('stars');
                haptic.selection();
              }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                currency === 'stars' ? 'bg-amber-400 text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              ⭐ Open with Stars
            </button>
          </div>
        )}

        {/* Needle Marker at Center */}
        <div className="relative w-full h-32 rounded-2xl bg-[#090a10] border border-white/10 overflow-hidden flex items-center">
          {/* Vertical Laser Center Line */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-[#ccff00] z-20 shadow-[0_0_12px_#ccff00]" />
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 border-solid border-t-[#ccff00] border-t-8 border-x-transparent border-x-8 border-b-0 z-20" />
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 border-solid border-b-[#ccff00] border-b-8 border-x-transparent border-x-8 border-t-0 z-20" />

          {/* Carousel Track */}
          <div
            ref={reelRef}
            className="flex items-center gap-2 px-32 absolute left-1/2 will-change-transform"
          >
            {reelItems.length > 0 ? (
              reelItems.map((item, i) => (
                <div
                  key={i}
                  className="w-24 h-24 rounded-2xl bg-[#141624] border flex flex-col items-center justify-center p-2 flex-shrink-0 shadow-inner"
                  style={{ borderColor: item.color }}
                >
                  <span className="text-3xl mb-1">{item.icon}</span>
                  <span className="text-[10px] font-bold text-white truncate max-w-[80px]">
                    {item.name}
                  </span>
                  <span className="text-[9px] font-mono text-purple-300 font-bold">
                    ${item.value} USD
                  </span>
                </div>
              ))
            ) : (
              <div className="text-xs text-white/30 font-mono tracking-wider">
                READY TO OPEN • SELECT CASE & UNBOX
              </div>
            )}
          </div>
        </div>

        {/* Winner Reveal Card */}
        {wonItem && (
          <div className="w-full p-3 rounded-2xl bg-gradient-to-r from-purple-900/40 via-indigo-900/40 to-purple-900/40 border border-purple-500/50 flex items-center justify-between animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{wonItem.icon}</span>
              <div>
                <div className="text-xs text-purple-300 font-bold uppercase tracking-wider">
                  You Unboxed
                </div>
                <div className="text-sm font-black text-white">{wonItem.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono font-black text-amber-300">
                ${wonItem.value} USD Value
              </div>
              <div className="text-[10px] text-white/50 font-bold uppercase">
                {wonItem.rarity}
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleOpenCase}
          disabled={balance < cost || isUnboxing}
          className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-xl flex items-center justify-center gap-2 ${
            balance >= cost && !isUnboxing
              ? currency === 'ton'
                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 text-black shadow-cyan-400/25'
                : 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:brightness-110 text-black shadow-amber-400/25'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>
            {isUnboxing
              ? 'Unboxing...'
              : balance < cost
              ? 'Insufficient Balance'
              : `Open Case (${cost} ${currency === 'ton' ? 'TON' : '⭐'})`}
          </span>
        </button>
      </div>
    </div>
  );
};
