import React, { useState } from 'react';
import { sound } from '../../utils/audio.js';
import { haptic } from '../../utils/telegram.js';
import { UserProfile, Relic, RelicRarity } from '../../types/game.js';
import { Backpack, Sparkles, Coins, Trash2, Filter } from 'lucide-react';

interface InventoryScreenProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  onOpenShop: () => void;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({ user, setUser, onOpenShop }) => {
  const [filterRarity, setFilterRarity] = useState<string>('all');

  const rarities: { id: string; label: string; color: string }[] = [
    { id: 'all', label: 'All', color: '#ffffff' },
    { id: 'common', label: 'Common', color: '#94a3b8' },
    { id: 'rare', label: 'Rare', color: '#38bdf8' },
    { id: 'epic', label: 'Epic', color: '#a855f7' },
    { id: 'legendary', label: 'Legendary', color: '#eab308' }
  ];

  const filteredRelics = user.inventory.filter(r =>
    filterRarity === 'all' ? true : r.rarity === filterRarity
  );

  const totalValue = user.inventory.reduce((sum, r) => sum + r.value, 0);

  const handleSellRelic = (relicId: string, value: number) => {
    haptic.impact('medium');
    setUser(prev => ({
      ...prev,
      credits: +(prev.credits + value).toFixed(2),
      inventory: prev.inventory.filter(r => r.id !== relicId)
    }));
    sound.playClick();
    haptic.notification('success');
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 pb-20 px-3">
      {/* Header Stats */}
      <div className="rounded-3xl border border-white/10 bg-[#121422] p-4 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-lg">
            🎒
          </div>
          <div>
            <div className="text-xs font-bold text-white/50 uppercase tracking-wider">
              Relics Stored
            </div>
            <div className="text-lg font-black text-white">
              {user.inventory.length} Artifacts
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] text-white/40 font-mono">Total Valuation</div>
          <div className="text-sm font-black font-mono text-[#ccff00]">
            {totalValue.toFixed(2)} 🪙
          </div>
        </div>
      </div>

      {/* Rarity Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {rarities.map(r => (
          <button
            key={r.id}
            onClick={() => {
              setFilterRarity(r.id);
              haptic.selection();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition active:scale-95 ${
              filterRarity === r.id
                ? 'bg-white/20 text-white border border-white/20'
                : 'bg-[#121422] text-white/50 border border-transparent hover:text-white'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Relics Grid */}
      {filteredRelics.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5">
          {filteredRelics.map(relic => (
            <div
              key={relic.id}
              className="relative p-3 rounded-2xl border bg-[#141624] flex flex-col justify-between gap-2.5 transition hover:border-white/20"
              style={{ borderColor: `${relic.color}40` }}
            >
              <div className="flex items-start justify-between">
                <span className="text-2xl">{relic.icon}</span>
                <span
                  className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${relic.color}25`, color: relic.color }}
                >
                  {relic.rarity}
                </span>
              </div>

              <div>
                <div className="text-xs font-bold text-white truncate">{relic.name}</div>
                <div className="text-[11px] font-mono text-[#ccff00] font-black mt-0.5">
                  +{relic.value} 🪙
                </div>
              </div>

              <button
                onClick={() => handleSellRelic(relic.id, relic.value)}
                className="w-full py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/60 hover:text-rose-300 text-[10px] font-bold transition flex items-center justify-center gap-1 active:scale-95"
              >
                <Trash2 className="w-3 h-3" />
                <span>Sell for {relic.value} 🪙</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 rounded-3xl border border-white/5 bg-[#121422] text-center flex flex-col items-center gap-3">
          <span className="text-3xl">🎁</span>
          <div className="text-xs text-white/60 max-w-[200px]">
            No relics found in this filter. Open Cases or win PvP showdowns to obtain rare relics!
          </div>
          <button
            onClick={onOpenShop}
            className="px-4 py-2 rounded-xl bg-[#ccff00] text-black font-black text-xs uppercase tracking-wider transition active:scale-95 shadow-sm"
          >
            Visit Shop & Cases
          </button>
        </div>
      )}
    </div>
  );
};
