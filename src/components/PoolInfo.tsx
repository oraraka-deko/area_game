import React, { useEffect, useRef } from 'react';
import { CurrentRoundState } from '../types/game.js';
import { Sparkles, Clock, AlertTriangle, Lock } from 'lucide-react';
import { sound } from '../utils/audio.js';

interface PoolInfoProps {
  roundState: CurrentRoundState;
  activeTab: 'current' | 'history';
  setActiveTab: (tab: 'current' | 'history') => void;
}

export const PoolInfo: React.FC<PoolInfoProps> = ({
  roundState,
  activeTab,
  setActiveTab
}) => {
  // Extract all relics deposited into the pot this round
  const potRelics = roundState.bets.flatMap(b => b.relics);
  const secondsLeft = Math.max(0, Math.ceil(roundState.timeRemainingMs / 1000));
  const prevSecondsRef = useRef<number>(secondsLeft);

  // Trigger audio cues as countdown advances
  useEffect(() => {
    if (roundState.status === 'BETTING_OPEN') {
      if (prevSecondsRef.current !== secondsLeft) {
        if (secondsLeft === 3) {
          sound.playBettingClosed();
        } else if (secondsLeft <= 10 && secondsLeft > 3) {
          sound.playAlertTick();
        } else if (secondsLeft > 10 && secondsLeft % 5 === 0) {
          sound.playTick();
        }
        prevSecondsRef.current = secondsLeft;
      }
    } else {
      prevSecondsRef.current = 20;
    }
  }, [secondsLeft, roundState.status]);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Tab Switcher: Current Game vs History (Matching screenshot 8) */}
      <div className="flex bg-[#12141f] p-1 rounded-2xl border border-white/5">
        <button
          onClick={() => setActiveTab('current')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'current'
              ? 'bg-white text-black shadow-md'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Current Game
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'history'
              ? 'bg-white text-black shadow-md'
              : 'text-white/60 hover:text-white'
          }`}
        >
          History
        </button>
      </div>

      {activeTab === 'current' && (
        <>
          {/* Top 24h Record Banner */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-xl text-[11px] text-amber-300">
            <div className="flex items-center gap-1.5 font-semibold">
              <span className="text-sm">🏆</span>
              <span>Top Game 24h</span>
              <span className="text-white/30">•</span>
              <span className="font-mono text-white">13,840.69 CREDITS</span>
            </div>
            <div className="text-amber-400/80 font-medium truncate max-w-[90px]">
              Zooba
            </div>
          </div>

          {/* Main Pool Card */}
          <div className="flex items-center justify-between px-1">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50 font-mono">
                  Pool #{roundState.roundId}
                </span>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider ${
                    roundState.poolTier === 'HIGH_ROLLER'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-white/10 text-white/70 border border-white/10'
                  }`}
                >
                  {roundState.poolTier === 'HIGH_ROLLER' ? '⚡ High Roller' : 'Standard'}
                </span>
              </div>

              {/* Huge Pool Value */}
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-mono">
                  {roundState.totalPool.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
                <span className="text-xs font-semibold text-white/50 tracking-wider">
                  CREDITS
                </span>
              </div>
            </div>

            {/* Countdown or Status Indicator */}
            <div className="text-right">
              {roundState.status === 'WAITING_FOR_PLAYERS' && (
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span className="font-mono text-xs font-bold">
                    Waiting for players ({roundState.bets.length}/2)
                  </span>
                </div>
              )}

              {roundState.status === 'BETTING_OPEN' && (
                <div className="flex items-center gap-1.5">
                  {roundState.isBettingClosed || secondsLeft <= 3 ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-600/30 border border-rose-500 text-rose-300 animate-pulse font-extrabold text-xs">
                      <span>🚫</span>
                      <span>BETTING CLOSED ({secondsLeft}s)</span>
                    </div>
                  ) : secondsLeft <= 10 ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 animate-pulse font-bold text-xs">
                      <span>⚠️</span>
                      <span className="font-mono">CLOSING SOON: {secondsLeft}s</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-white/80">
                      <Clock className="w-3.5 h-3.5 text-white/50" />
                      <span className="font-mono text-xs sm:text-sm font-bold">
                        Bets close: {secondsLeft}s
                      </span>
                    </div>
                  )}
                </div>
              )}

              {roundState.status === 'ROUND_RESOLVING' && (
                <div className="flex items-center gap-1.5 text-cyan-400 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="font-mono text-xs sm:text-sm font-extrabold uppercase tracking-wider">
                    Rolling...
                  </span>
                </div>
              )}

              {roundState.status === 'WINNER_CELEBRATION' && (
                <div className="flex items-center gap-1.5 text-[#ccff00]">
                  <span className="text-xs">🏆</span>
                  <span className="font-mono text-xs sm:text-sm font-extrabold uppercase tracking-wider">
                    Completed
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Countdown Progress Bar during Betting Open */}
          {roundState.status === 'BETTING_OPEN' && (
            <div className="w-full bg-[#161826] h-2 rounded-full overflow-hidden border border-white/5 relative">
              <div
                className={`h-full transition-all duration-200 rounded-full ${
                  roundState.isBettingClosed || secondsLeft <= 3
                    ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]'
                    : secondsLeft <= 10
                    ? 'bg-gradient-to-r from-amber-400 to-rose-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] animate-pulse'
                    : 'bg-gradient-to-r from-[#ccff00] to-emerald-400'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, (roundState.timeRemainingMs / 20000) * 100))}%` }}
              />
            </div>
          )}

          {/* Deposited Relics Row */}
          {potRelics.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
              <span className="text-[11px] text-white/40 flex-shrink-0 mr-1">
                Relics in Pot:
              </span>
              {potRelics.map((relic, idx) => (
                <div
                  key={`${relic.id}_${idx}`}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1a1c29] border text-xs flex-shrink-0"
                  style={{ borderColor: relic.color + '40' }}
                  title={`${relic.name} (🪙 ${relic.value})`}
                >
                  <span>{relic.icon}</span>
                  <span className="text-[10px] text-white/80 font-medium">
                    +{relic.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
