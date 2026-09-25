import React, { useState } from 'react';
import { CurrentRoundState, Relic } from '../types/game.js';
import { Crown, Shield, Copy, Check, X } from 'lucide-react';
import { sound } from '../utils/audio.js';

interface VictoryModalProps {
  roundState: CurrentRoundState;
  onClose: () => void;
  onOpenVerify: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  roundState,
  onClose,
  onOpenVerify
}) => {
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedSeed, setCopiedSeed] = useState(false);

  const winner = roundState.winner;
  if (!winner) return null;

  const hash = roundState.serverSeedHash;
  const seed = roundState.revealedServerSeed || 'Revealing...';

  const copyToClipboard = (text: string, isHash: boolean) => {
    sound.playClick();
    navigator.clipboard.writeText(text);
    if (isHash) {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } else {
      setCopiedSeed(true);
      setTimeout(() => setCopiedSeed(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#11131c] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-5 flex flex-col items-center text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Winner Avatar with Glowing Neon Halo (Matching Screenshot 1) */}
        <div className="relative mt-2 mb-3">
          <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-[#ccff00] to-cyan-400 shadow-[0_0_35px_rgba(204,255,0,0.45)]">
            {winner.avatar ? (
              <img
                src={winner.avatar}
                alt={winner.username}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full rounded-full flex items-center justify-center text-2xl font-black text-black"
                style={{ backgroundColor: winner.color }}
              >
                {winner.username.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="absolute -top-2 -right-1 w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center shadow-lg border-2 border-[#11131c]">
            <Crown className="w-4 h-4 text-black" />
          </div>
        </div>

        {/* Subtitle & Winner Username */}
        <div className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-0.5">
          Winner
        </div>
        <div className="text-xl font-black text-[#ccff00] tracking-tight mb-1">
          {winner.username}
        </div>

        {/* Big Payout (Matching Screenshot 1) */}
        <div className="flex items-baseline gap-1.5 my-2">
          <span className="text-3xl font-extrabold text-white font-mono">
            +{winner.payout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-sm font-bold text-white/50 font-mono">
            CREDITS
          </span>
        </div>

        {/* Commission Rake Notice */}
        <div className="text-[11px] text-white/40 mb-3 font-mono">
          Rake: {winner.rakePercent}% (-{winner.rakeAmount} 🪙)
        </div>

        {/* Won Relics Preview */}
        {winner.wonRelics.length > 0 && (
          <div className="w-full mb-3.5 p-2 rounded-xl bg-white/5 border border-white/5 text-left">
            <div className="text-[11px] text-white/60 font-semibold mb-1.5 flex items-center justify-between">
              <span>{winner.wonRelics.length} relic{winner.wonRelics.length > 1 ? 's' : ''} won:</span>
              <span className="text-purple-300 font-mono">
                +{winner.wonRelics.reduce((s, r) => s + r.value, 0)} 🪙
              </span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {winner.wonRelics.map((relic, idx) => (
                <div
                  key={`${relic.id}_${idx}`}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#181a26] border text-xs"
                  style={{ borderColor: relic.color }}
                >
                  <span>{relic.icon}</span>
                  <span className="text-[11px] text-white font-medium">{relic.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Provably Fair Info Box (Exact match from Screenshots 2-6) */}
        <div className="w-full bg-[#181b28] border border-white/10 rounded-2xl p-3 text-left mb-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white/90 mb-2">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Provably Fair</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-white/5 text-xs">
            <span className="text-white/40">Hash</span>
            <div className="flex items-center gap-1 font-mono text-white/80">
              <span>{hash ? `${hash.substring(0, 8)}...${hash.substring(hash.length - 4)}` : 'N/A'}</span>
              <button
                onClick={() => copyToClipboard(hash, true)}
                className="p-1 hover:text-white text-white/40"
              >
                {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-1 text-xs">
            <span className="text-white/40">Server seed</span>
            <div className="flex items-center gap-1 font-mono text-white/80">
              <span>{seed ? `${seed.substring(0, 8)}...${seed.substring(seed.length - 4)}` : 'N/A'}</span>
              <button
                onClick={() => copyToClipboard(seed, false)}
                className="p-1 hover:text-white text-white/40"
              >
                {copiedSeed ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Verify Fairness Button (Screenshot 2-6) */}
        <button
          onClick={onOpenVerify}
          className="w-full py-3 rounded-2xl bg-[#ccff00] text-black font-extrabold text-sm uppercase tracking-wide hover:bg-[#b8e600] active:scale-95 transition shadow-[0_0_25px_rgba(204,255,0,0.35)] mb-2"
        >
          Verify fairness
        </button>

        {/* Continue Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-bold text-xs transition"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
