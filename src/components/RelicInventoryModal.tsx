import React from 'react';
import { Relic } from '../types/game.js';
import { X, Sparkles, Check } from 'lucide-react';
import { sound } from '../utils/audio.js';

interface RelicInventoryModalProps {
  inventory: Relic[];
  selectedRelics: Relic[];
  onToggleSelect: (relic: Relic) => void;
  onClose: () => void;
}

export const RelicInventoryModal: React.FC<RelicInventoryModalProps> = ({
  inventory,
  selectedRelics,
  onToggleSelect,
  onClose
}) => {
  const isSelected = (id: string) => selectedRelics.some(r => r.id === id);

  const handleToggle = (relic: Relic) => {
    sound.playClick();
    onToggleSelect(relic);
  };

  const rarityBadgeStyles = {
    common: 'text-slate-300 bg-slate-800 border-slate-600',
    rare: 'text-cyan-300 bg-cyan-950/60 border-cyan-500/50',
    epic: 'text-purple-300 bg-purple-950/60 border-purple-500/50',
    legendary: 'text-amber-300 bg-amber-950/60 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-[#12141f] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-5 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Relic Inventory</h3>
              <p className="text-xs text-white/50">Deposit virtual collectibles into the pot</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Summary */}
        <div className="py-2.5 px-3 bg-white/5 rounded-xl my-3 flex items-center justify-between text-xs flex-shrink-0">
          <span className="text-white/60">Selected for next bet:</span>
          <span className="font-mono font-bold text-[#ccff00]">
            {selectedRelics.length} relics (+{selectedRelics.reduce((s, r) => s + r.value, 0)} 🪙)
          </span>
        </div>

        {/* Inventory Grid */}
        <div className="overflow-y-auto flex-1 pr-1 grid grid-cols-2 gap-2.5 my-1">
          {inventory.length === 0 ? (
            <div className="col-span-2 text-center py-10 text-white/40 text-xs">
              Your relic inventory is currently empty. Win rounds or claim the faucet to discover more relics!
            </div>
          ) : (
            inventory.map(relic => {
              const selected = isSelected(relic.id);
              return (
                <div
                  key={relic.id}
                  onClick={() => handleToggle(relic)}
                  className={`relative p-3 rounded-2xl border transition cursor-pointer select-none flex flex-col justify-between ${
                    selected
                      ? 'bg-[#1e2235] border-[#ccff00] shadow-[0_0_15px_rgba(204,255,0,0.25)]'
                      : 'bg-[#161825] border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Selected Checkmark */}
                  {selected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#ccff00] text-black flex items-center justify-center font-bold">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}

                  {/* Icon & Name */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{relic.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{relic.name}</div>
                      <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded border inline-block mt-0.5 ${rarityBadgeStyles[relic.rarity]}`}>
                        {relic.rarity}
                      </span>
                    </div>
                  </div>

                  {/* Value */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono font-bold">
                    <span className="text-white/40 text-[10px]">Value:</span>
                    <span className="text-amber-400">+{relic.value} 🪙</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Confirm */}
        <div className="pt-3 border-t border-white/10 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-[#ccff00] text-black font-extrabold text-xs uppercase tracking-wide hover:bg-[#b8e600] active:scale-95 transition"
          >
            Confirm Deposit ({selectedRelics.length})
          </button>
        </div>
      </div>
    </div>
  );
};
