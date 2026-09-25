import React, { useState } from 'react';
import { CurrentRoundState } from '../types/game.js';
import { UserPlus, Play, Zap, RotateCcw, Wrench, ChevronDown, ChevronUp, Sparkles, Dices } from 'lucide-react';
import { sound } from '../utils/audio.js';

interface DevControlsProps {
  roundState: CurrentRoundState;
  onAddRandomPlayer: (creditAmount?: number) => void;
  onStartRound: () => void;
  onRollNow: () => void;
  onResetRound: () => void;
  autoStart: boolean;
  onToggleAutoStart: (enabled: boolean) => void;
}

export const DevControls: React.FC<DevControlsProps> = ({
  roundState,
  onAddRandomPlayer,
  onStartRound,
  onRollNow,
  onResetRound,
  autoStart,
  onToggleAutoStart
}) => {
  const [expanded, setExpanded] = useState(true);
  const [customBetInput, setCustomBetInput] = useState<string>('');
  const [addedMessage, setAddedMessage] = useState<string | null>(null);

  const canAddPlayer =
    roundState.status !== 'ROUND_RESOLVING' &&
    roundState.status !== 'WINNER_CELEBRATION' &&
    !roundState.isBettingClosed;

  const canStartRound =
    roundState.status === 'WAITING_FOR_PLAYERS' &&
    roundState.bets.length >= 1;

  const canRollNow =
    roundState.bets.length >= 1 &&
    roundState.status !== 'ROUND_RESOLVING' &&
    roundState.status !== 'WINNER_CELEBRATION';

  const handleAddRandom = (amount?: number) => {
    sound.playClick();
    const finalAmount = amount !== undefined ? amount : (customBetInput ? parseInt(customBetInput, 10) : undefined);
    onAddRandomPlayer(finalAmount);

    setAddedMessage('Random player added!');
    setTimeout(() => setAddedMessage(null), 2500);
  };

  return (
    <div className="bg-[#121422] border border-[#ccff00]/30 rounded-2xl p-3 shadow-[0_0_20px_rgba(204,255,0,0.08)] flex flex-col gap-2.5 transition">
      {/* Dev Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#ccff00]/15 text-[#ccff00] text-[11px] font-extrabold uppercase tracking-wider border border-[#ccff00]/40">
            <Wrench className="w-3 h-3" />
            <span>Dev Toolbar</span>
          </div>
          <span className="text-[11px] text-white/50 font-medium hidden sm:inline">
            Test Arena Sandbox
          </span>
        </div>

        <div className="flex items-center gap-2">
          {addedMessage && (
            <span className="text-[11px] font-bold text-[#ccff00] animate-pulse">
              {addedMessage}
            </span>
          )}
          <button className="text-white/40 hover:text-white p-0.5">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
          {/* Main Action: Add Random Player */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={() => handleAddRandom()}
              disabled={!canAddPlayer}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 border border-emerald-400/30"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Add Random Player</span>
              <span className="text-[10px] opacity-75 font-mono">(Random 🪙)</span>
            </button>

            {/* Quick Presets for Custom Bot Amount */}
            <div className="flex items-center gap-1 self-center">
              {[50, 150, 300].map(amt => (
                <button
                  key={amt}
                  disabled={!canAddPlayer}
                  onClick={() => handleAddRandom(amt)}
                  className="px-2 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 rounded-lg text-[10px] font-mono font-bold text-white/80 transition"
                  title={`Add bot with ${amt} credits`}
                >
                  +{amt}🪙
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Controls: Start, Roll Now, Reset, Auto-Start Toggle */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {/* Start Round Countdown Button */}
            <button
              onClick={() => {
                sound.playClick();
                onStartRound();
              }}
              disabled={!canStartRound}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-indigo-600/30 hover:bg-indigo-600/50 disabled:opacity-30 disabled:cursor-not-allowed text-indigo-200 border border-indigo-500/40 rounded-xl text-[11px] font-bold transition active:scale-95"
              title="Start the 20s countdown"
            >
              <Play className="w-3 h-3 text-indigo-400" />
              <span>Start Round</span>
            </button>

            {/* Roll Now / Force Spin Button */}
            <button
              onClick={() => {
                sound.playClick();
                onRollNow();
              }}
              disabled={!canRollNow}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-amber-500/20 hover:bg-amber-500/35 disabled:opacity-30 disabled:cursor-not-allowed text-amber-200 border border-amber-500/40 rounded-xl text-[11px] font-bold transition active:scale-95"
              title="Skip countdown and spin puck immediately"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Roll Now</span>
            </button>

            {/* Reset Round Button */}
            <button
              onClick={() => {
                sound.playClick();
                onResetRound();
              }}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-[11px] font-bold transition active:scale-95"
              title="Reset current round to empty"
            >
              <RotateCcw className="w-3 h-3 text-rose-400" />
              <span>Reset Round</span>
            </button>
          </div>

          {/* Auto-Start Toggle Row */}
          <div className="flex items-center justify-between px-1 pt-0.5 text-[11px] text-white/60">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#ccff00]" />
              <span>Auto-start countdown on bet:</span>
            </span>
            <button
              onClick={() => onToggleAutoStart(!autoStart)}
              className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold border transition ${
                autoStart
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-white/5 text-white/50 border-white/10'
              }`}
            >
              {autoStart ? 'ENABLED' : 'DISABLED (Manual)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
