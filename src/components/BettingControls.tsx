import React, { useState } from 'react';
import { CurrentRoundState, Relic, UserProfile } from '../types/game.js';
import { sound } from '../utils/audio.js';
import { Plus, X, Gem } from 'lucide-react';

interface BettingControlsProps {
  roundState: CurrentRoundState;
  user: UserProfile;
  selectedRelics: Relic[];
  onOpenRelicPicker: () => void;
  onRemoveRelic: (id: string) => void;
  onPlaceBet: (creditAmount: number, relics: Relic[]) => void;
  onStartRound?: () => void;
}

export const BettingControls: React.FC<BettingControlsProps> = ({
  roundState,
  user,
  selectedRelics,
  onOpenRelicPicker,
  onRemoveRelic,
  onPlaceBet,
  onStartRound
}) => {
  const [betInput, setBetInput] = useState<string>('20');
  const [isPlacing, setIsPlacing] = useState(false);

  const canBet = 
    (roundState.status === 'WAITING_FOR_PLAYERS' || roundState.status === 'BETTING_OPEN') && 
    !roundState.isBettingClosed && 
    (roundState.status === 'WAITING_FOR_PLAYERS' || roundState.timeRemainingMs > 3000);

  const userBet = roundState.bets.find(b => b.playerId === user.id);
  const numericBet = Math.max(0, parseInt(betInput || '0', 10));
  const relicsValue = selectedRelics.reduce((sum, r) => sum + r.value, 0);
  const totalBetValue = numericBet + relicsValue;

  const handlePreset = (amount: number | 'max') => {
    sound.playClick();
    if (amount === 'max') {
      setBetInput(Math.floor(user.credits).toString());
    } else {
      setBetInput(amount.toString());
    }
  };

  const handlePlace = () => {
    if (!canBet || totalBetValue <= 0) return;
    if (numericBet > user.credits) return;

    sound.playBetPlaced();
    setIsPlacing(true);
    onPlaceBet(numericBet, selectedRelics);
    setTimeout(() => setIsPlacing(false), 500);
  };

  return (
    <div className="flex flex-col gap-2.5 bg-[#12141f]/95 p-3 rounded-2xl border border-white/10 shadow-lg">
      {/* Ready Banner if already bet and waiting */}
      {userBet && roundState.status === 'WAITING_FOR_PLAYERS' && (
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#ccff00]/10 border border-[#ccff00]/30 text-xs text-[#ccff00]">
          <span className="font-semibold">
            ✓ Your stake is in ({userBet.totalBet} 🪙)
          </span>
          {onStartRound && (
            <button
              onClick={() => {
                sound.playClick();
                onStartRound();
              }}
              className="px-2.5 py-1 rounded-lg bg-[#ccff00] text-black font-extrabold text-[11px] hover:bg-[#b8e600] transition active:scale-95 flex items-center gap-1 shadow-sm"
            >
              <span>▶ Start Round</span>
            </button>
          )}
        </div>
      )}

      {/* Quick Amount Presets */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        <span className="text-[11px] text-white/40 flex-shrink-0 mr-1 font-medium">
          Quick:
        </span>
        {[10, 50, 100, 250, 500].map(amt => (
          <button
            key={amt}
            disabled={!canBet}
            onClick={() => handlePreset(amt)}
            className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition ${
              numericBet === amt
                ? 'bg-[#ccff00]/20 text-[#ccff00] border-[#ccff00]/60'
                : 'bg-white/5 text-white/70 border-white/5 hover:bg-white/10'
            }`}
          >
            +{amt}
          </button>
        ))}
        <button
          disabled={!canBet}
          onClick={() => handlePreset('max')}
          className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg border bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20 transition"
        >
          Max
        </button>
      </div>

      {/* Selected Relics Chips */}
      {selectedRelics.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-xl bg-[#181a28] border border-white/5">
          <span className="text-[11px] text-purple-300 font-semibold flex-shrink-0">
            Depositing Relics (+{relicsValue} 🪙):
          </span>
          {selectedRelics.map(relic => (
            <div
              key={relic.id}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/40 border text-xs"
              style={{ borderColor: relic.color }}
            >
              <span>{relic.icon}</span>
              <span className="text-[11px] text-white">{relic.name}</span>
              <button
                onClick={() => onRemoveRelic(relic.id)}
                className="text-white/40 hover:text-white ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Controls Row: Input + Place Button + Add Relic */}
      <div className="grid grid-cols-12 gap-2">
        {/* Custom Credits Input */}
        <div className="col-span-5 relative flex items-center">
          <span className="absolute left-3 text-amber-400 text-sm">🪙</span>
          <input
            type="number"
            min="0"
            step="10"
            disabled={!canBet}
            value={betInput}
            onChange={e => setBetInput(e.target.value)}
            className="w-full pl-8 pr-2 py-2.5 rounded-xl bg-[#181b29] border border-white/10 text-white font-mono font-bold text-sm focus:outline-none focus:border-[#ccff00]/60 transition"
            placeholder="Amount"
          />
        </div>

        {/* Add Relic Button */}
        <button
          onClick={onOpenRelicPicker}
          disabled={!canBet}
          className="col-span-3 flex items-center justify-center gap-1.5 py-2.5 px-2 bg-[#1f2233] hover:bg-[#272b40] disabled:opacity-40 text-white rounded-xl border border-white/10 text-xs font-bold transition active:scale-95"
        >
          <Gem className="w-3.5 h-3.5 text-purple-400" />
          <span className="truncate">Add Relic</span>
          {selectedRelics.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-purple-500 text-white text-[10px] flex items-center justify-center font-bold">
              {selectedRelics.length}
            </span>
          )}
        </button>

        {/* Place Bet Neon CTA Button */}
        <button
          onClick={handlePlace}
          disabled={!canBet || totalBetValue <= 0 || numericBet > user.credits || isPlacing}
          className={`col-span-4 py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm tracking-wide uppercase transition shadow-lg active:scale-95 flex items-center justify-center gap-1.5 ${
            !canBet
              ? 'bg-white/10 text-white/40 cursor-not-allowed'
              : numericBet > user.credits
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 cursor-not-allowed'
              : 'bg-[#ccff00] text-black hover:bg-[#b8e600] shadow-[0_0_20px_rgba(204,255,0,0.35)]'
          }`}
        >
          {!canBet ? (
            <span>Betting Closed</span>
          ) : numericBet > user.credits ? (
            <span>Low Credits</span>
          ) : (
            <>
              <span>Place</span>
              <span className="font-mono text-xs opacity-90">({totalBetValue} 🪙)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
