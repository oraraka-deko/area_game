import React from 'react';
import { X, Dices, Shield, Coins, Lock } from 'lucide-react';

interface HowItWorksModalProps {
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-[#12141f] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎲</span>
            <h3 className="font-extrabold text-white text-base">Game Rules & Fairness</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sections (Exact match with Screenshot 7) */}
        <div className="my-4 space-y-4 text-xs text-white/80">
          {/* Section 1: How the Arena Works */}
          <div className="p-3.5 rounded-2xl bg-[#171926] border border-white/5">
            <div className="flex items-center gap-2 font-bold text-white mb-1.5">
              <Dices className="w-4 h-4 text-[#ccff00]" />
              <span className="text-sm">How the Arena Works</span>
            </div>
            <p className="text-white/60 leading-relaxed">
              Players place bets into a shared pool. When the timer ends, one winner is randomly selected.
              Your chance of winning equals your share of the pool:
            </p>
            <div className="mt-2 p-2 bg-black/40 rounded-xl font-mono text-center text-xs text-[#ccff00]">
              P(i) = Bet(i) / TotalPool
            </div>
            <p className="text-white/60 mt-2 leading-relaxed">
              The bigger the bet — the larger your 2D slice territory, and the higher your chance to take home the jackpot.
            </p>
          </div>

          {/* Section 2: Provably Fair */}
          <div className="p-3.5 rounded-2xl bg-[#171926] border border-white/5">
            <div className="flex items-center gap-2 font-bold text-white mb-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-sm">Provably Fair Protocol</span>
            </div>
            <p className="text-white/60 mb-2 leading-relaxed">
              Every round is 100% mathematically verifiable. The result cannot be rigged or altered by anyone.
            </p>

            <div className="space-y-2 mt-2">
              <div className="flex gap-2">
                <span className="w-4 h-4 rounded-full bg-[#ccff00] text-black font-extrabold text-[9px] flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <div>
                  <span className="font-bold text-white">Before the game: </span>
                  <span className="text-white/60">The server generates a secret key (seed) and publishes its SHA-256 hash. You can copy the hash before bets start.</span>
                </div>
              </div>

              <div className="flex gap-2">
                <span className="w-4 h-4 rounded-full bg-[#ccff00] text-black font-extrabold text-[9px] flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <div>
                  <span className="font-bold text-white">After the game: </span>
                  <span className="text-white/60">The secret seed is revealed. You can verify that SHA-256(seed) matches the hash published before the game.</span>
                </div>
              </div>

              <div className="flex gap-2">
                <span className="w-4 h-4 rounded-full bg-[#ccff00] text-black font-extrabold text-[9px] flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <div>
                  <span className="font-bold text-white">Winner verification: </span>
                  <span className="text-white/60">The winner is determined by:</span>
                  <div className="mt-1 p-1.5 bg-black/40 rounded font-mono text-[11px] text-cyan-300">
                    winningValue = HMAC-SHA256(seed, gameId) mod totalPool
                  </div>
                  <span className="text-white/60 text-[11px]">Anyone can independently recalculate and confirm the result!</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Commission */}
          <div className="p-3.5 rounded-2xl bg-[#171926] border border-white/5">
            <div className="flex items-center gap-2 font-bold text-white mb-1.5">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-sm">Variable Commission</span>
            </div>
            <p className="text-white/60 leading-relaxed">
              Commission is 1–25% of the winnings (pool minus your bet).
              The lower your chance of winning — the higher the commission.
              With a high chance (e.g. 90%+), the commission is minimal (~1%).
            </p>
          </div>

          {/* Section 4: Private Room */}
          <div className="p-3.5 rounded-2xl bg-[#171926] border border-white/5">
            <div className="flex items-center gap-2 font-bold text-white mb-1.5">
              <Lock className="w-4 h-4 text-purple-400" />
              <span className="text-sm">Private Room</span>
            </div>
            <p className="text-white/60 leading-relaxed">
              Create a custom private room and invite friends via a link. Only those with the link can join!
            </p>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-[#ccff00] text-black font-extrabold text-xs uppercase tracking-wide hover:bg-[#b8e600] active:scale-95 transition"
        >
          Got It, Let's Play!
        </button>
      </div>
    </div>
  );
};
