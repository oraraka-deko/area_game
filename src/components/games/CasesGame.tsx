import React, { useState, useRef } from 'react';
import { sound } from '../../utils/audio.js';
import { haptic } from '../../utils/telegram.js';
import { UserProfile, Relic, RelicRarity } from '../../types/game.js';
import { ArrowLeft, Gift, Sparkles, Box, Trophy } from 'lucide-react';

interface CasesGameProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  onBack: () => void;
}

interface CaseTier {
  id: string;
  name: string;
  price: number;
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
      price: 50,
      color: '#38bdf8',
      icon: '📦',
      description: 'Reliable starter items & small credit boosts',
      pool: [
        { name: 'Bronze Key', rarity: 'common', icon: '🗝️', value: 30, color: '#94a3b8' },
        { name: 'Emerald Gem', rarity: 'common', icon: '💎', value: 45, color: '#10b981' },
        { name: 'Silver Compass', rarity: 'rare', icon: '🧭', value: 80, color: '#38bdf8' },
        { name: 'Cyber Dagger', rarity: 'epic', icon: '🗡️', value: 160, color: '#a855f7' }
      ]
    },
    {
      id: 'cyber',
      name: 'Cyber Arsenal',
      price: 150,
      color: '#a855f7',
      icon: '🔮',
      description: 'High-tech artifacts and glowing weapon relics',
      pool: [
        { name: 'Neon Blade', rarity: 'rare', icon: '⚡', value: 120, color: '#38bdf8' },
        { name: 'Plasma Core', rarity: 'rare', icon: '🔮', value: 160, color: '#38bdf8' },
        { name: 'Quantum Visor', rarity: 'epic', icon: '🥽', value: 320, color: '#a855f7' },
        { name: 'Dragon Talon', rarity: 'legendary', icon: '🐉', value: 800, color: '#eab308' }
      ]
    },
    {
      id: 'high_roller',
      name: 'High Roller Vault',
      price: 500,
      color: '#eab308',
      icon: '👑',
      description: 'Exclusive luxury relics with huge multiplier value',
      pool: [
        { name: 'Gold Bar Relic', rarity: 'rare', icon: '🪙', value: 400, color: '#38bdf8' },
        { name: 'Obsidian Crown', rarity: 'epic', icon: '👑', value: 850, color: '#a855f7' },
        { name: 'Infinity Cube', rarity: 'legendary', icon: '🧊', value: 1800, color: '#eab308' },
        { name: 'Phoenix Wing', rarity: 'legendary', icon: '🪶', value: 3200, color: '#eab308' }
      ]
    }
  ];

  const [selectedCase, setSelectedCase] = useState<CaseTier>(caseTiers[0]);
  const [isUnboxing, setIsUnboxing] = useState<boolean>(false);
  const [reelItems, setReelItems] = useState<any[]>([]);
  const [wonItem, setWonItem] = useState<any | null>(null);
  const reelRef = useRef<HTMLDivElement | null>(null);

  const handleOpenCase = () => {
    if (user.credits < selectedCase.price || isUnboxing) {
      sound.playBettingClosed();
      haptic.notification('error');
      return;
    }

    // Deduct cost
    setUser(prev => ({ ...prev, credits: +(prev.credits - selectedCase.price).toFixed(2) }));
    sound.playBetPlaced();
    haptic.impact('medium');
    setIsUnboxing(true);
    setWonItem(null);

    // Pick winner based on weights
    const pool = selectedCase.pool;
    const winner = pool[Math.floor(Math.random() * pool.length)];

    // Generate ~45 reel items with winner at position 35
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
        reelRef.current.style.transition = 'transform 4.5s cubic-bezier(0.12, 0.8, 0.2, 1)';
        reelRef.current.style.transform = `translateX(-${offset}px)`;

        // Sound ticks during spin
        let tickCount = 0;
        const tickTimer = setInterval(() => {
          tickCount++;
          sound.playTick();
          haptic.selection();
          if (tickCount > 28) clearInterval(tickTimer);
        }, 130);
      }
    }, 50);

    // Reveal winner at 4.6s
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
          <span className="text-xs text-white/50 font-mono">Balance:</span>
          <span className="text-sm font-black font-mono text-[#ccff00]">
            {user.credits.toFixed(2)} 🪙
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
              {c.price} 🪙
            </div>
          </button>
        ))}
      </div>

      {/* Spinning Carousel Reel */}
      <div className="relative rounded-3xl border border-white/10 bg-[#0f111c] overflow-hidden p-4 shadow-xl flex flex-col items-center gap-4">
        {/* Needle Marker at Center */}
        <div className="relative w-full h-32 rounded-2xl bg-[#090a10] border border-white/10 overflow-hidden flex items-center">
          {/* Vertical Laser Center Line */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-[#ccff00] z-20 shadow-[0_0_12px_#ccff00]" />
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 border-solid border-t-[#ccff00] border-t-8 border-x-transparent border-x-8 border-b-0 z-20" />
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 border-solid border-b-[#ccff00] border-b-8 border-x-transparent border-x-8 border-t-0 z-20" />

          {/* Horizontal Items Reel */}
          <div
            ref={reelRef}
            className="flex items-center gap-2 pl-[150px] will-change-transform"
          >
            {reelItems.length > 0 ? (
              reelItems.map((item, idx) => (
                <div
                  key={idx}
                  className="w-24 h-24 shrink-0 rounded-2xl border flex flex-col items-center justify-center p-2 bg-[#171a2b] transition"
                  style={{ borderColor: item.color }}
                >
                  <span className="text-3xl mb-1">{item.icon}</span>
                  <span className="text-[10px] font-black text-white truncate max-w-full text-center">
                    {item.name}
                  </span>
                  <span className="text-[9px] font-mono text-white/50">
                    {item.value} 🪙
                  </span>
                </div>
              ))
            ) : (
              <div className="w-full text-center text-xs text-white/40 font-mono">
                Press "Unbox Case" to spin the carousel
              </div>
            )}
          </div>
        </div>

        {/* Won Item Banner */}
        {wonItem && (
          <div className="w-full p-3 rounded-2xl bg-gradient-to-r from-purple-500/20 via-[#ccff00]/15 to-purple-500/20 border border-[#ccff00]/40 flex items-center justify-between animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{wonItem.icon}</span>
              <div>
                <div className="text-[10px] text-[#ccff00] font-black uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Item Unboxed & Stored</span>
                </div>
                <div className="text-sm font-extrabold text-white">
                  {wonItem.name}
                </div>
                <div className="text-[10px] text-white/60 font-mono capitalize">
                  Rarity: {wonItem.rarity}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-mono font-bold text-[#ccff00]">
                +{wonItem.value} 🪙
              </div>
              <div className="text-[9px] text-white/40">In Inventory</div>
            </div>
          </div>
        )}

        {/* Open Button */}
        <button
          disabled={isUnboxing}
          onClick={handleOpenCase}
          className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-lg ${
            isUnboxing
              ? 'bg-white/10 text-white/40 cursor-not-allowed'
              : 'bg-[#ccff00] hover:bg-[#b8e600] text-black shadow-[#ccff00]/25'
          }`}
        >
          {isUnboxing ? 'Unboxing Case...' : `Unbox Case (${selectedCase.price} 🪙)`}
        </button>
      </div>

      {/* Case Contents Preview */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-white/70 px-1">
          Possible Drops in {selectedCase.name}
        </span>
        <div className="grid grid-cols-2 gap-2">
          {selectedCase.pool.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 p-2 rounded-xl border border-white/5 bg-[#141624]"
            >
              <span className="text-xl">{item.icon}</span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{item.name}</div>
                <div className="text-[10px] font-mono capitalize" style={{ color: item.color }}>
                  {item.rarity} • {item.value} 🪙
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
