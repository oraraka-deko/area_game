import React from 'react';
import { RoundHistoryItem } from '../types/game.js';
import { ShieldCheck, Play, Users } from 'lucide-react';
import { sound } from '../utils/audio.js';

interface HistoryTabProps {
  history: RoundHistoryItem[];
  onInspectRound: (round: RoundHistoryItem) => void;
  onWatchReplay: (round: RoundHistoryItem) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  history,
  onInspectRound,
  onWatchReplay
}) => {
  if (history.length === 0) {
    return (
      <div className="p-8 text-center bg-[#12141f]/70 rounded-2xl border border-white/5 text-white/50 text-xs">
        No completed rounds yet. Play a game to record provably fair history!
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-xs text-white/50 px-1 font-semibold flex items-center justify-between">
        <span>Recent Matches with Video Replay ({history.length})</span>
        <span className="text-[11px] text-emerald-400 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>All Audited</span>
        </span>
      </div>

      <div className="space-y-2.5">
        {history.map(item => (
          <div
            key={item.roundId}
            className="p-3.5 rounded-2xl bg-[#141624] border border-white/5 hover:border-white/15 transition flex flex-col gap-2.5"
          >
            {/* Top row: Winner + Payout + Replay Button */}
            <div className="flex items-center justify-between gap-3">
              {/* Left: Winner info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex-shrink-0">
                  {item.winner.avatar ? (
                    <img
                      src={item.winner.avatar}
                      alt={item.winner.username}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-[#ccff00]/50"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-black"
                      style={{ backgroundColor: item.winner.color }}
                    >
                      {item.winner.username.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-black flex items-center justify-center text-[9px] font-black">
                    👑
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-white/40">
                      Pool #{item.roundId}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                        item.poolTier === 'HIGH_ROLLER'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-white/10 text-white/70'
                      }`}
                    >
                      {item.poolTier === 'HIGH_ROLLER' ? 'High Roller' : 'Standard'}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-white truncate mt-0.5">
                    {item.winner.username}
                  </div>

                  <div className="text-[10px] text-white/50 font-mono">
                    Won with {(item.winner.winProbability * 100).toFixed(1)}% chance
                  </div>
                </div>
              </div>

              {/* Right: Net payout + Actions */}
              <div className="flex items-center gap-2 flex-shrink-0 text-right">
                <div className="mr-1">
                  <div className="text-xs sm:text-sm font-extrabold font-mono text-[#ccff00]">
                    +{item.winner.payout.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} 🪙
                  </div>
                  <div className="text-[10px] text-white/40 font-mono">
                    Pool: {item.totalPool.toFixed(2)}
                  </div>
                </div>

                {/* Watch Replay Video CTA */}
                <button
                  onClick={() => {
                    sound.playClick();
                    onWatchReplay(item);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#ccff00] text-black hover:bg-[#b8e600] active:scale-95 transition flex items-center gap-1.5 text-xs font-extrabold shadow-sm"
                  title="Watch Video-like Round Replay with Full Ball Physics"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Replay</span>
                </button>

                {/* Verify */}
                <button
                  onClick={() => {
                    sound.playClick();
                    onInspectRound(item);
                  }}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white border border-white/5 transition"
                  title="Verify Provably Fair Cryptographic Match"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            </div>

            {/* Bottom row: Players in this round with their bets */}
            {item.players && item.players.length > 0 && (
              <div className="pt-2 border-t border-white/5 flex items-center gap-2 overflow-x-auto scrollbar-none">
                <div className="flex items-center gap-1 text-[10px] text-white/40 flex-shrink-0 font-medium">
                  <Users className="w-3 h-3" />
                  <span>Bets ({item.players.length}):</span>
                </div>
                {item.players.map(p => (
                  <div
                    key={p.playerId}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/30 border border-white/5 text-[11px] flex-shrink-0"
                  >
                    {p.avatar ? (
                      <img src={p.avatar} alt={p.username} className="w-3.5 h-3.5 rounded-full object-cover" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full bg-white/20 text-[8px] flex items-center justify-center font-bold">
                        {p.username[0]}
                      </span>
                    )}
                    <span className="text-white/80 font-medium truncate max-w-[70px]">{p.username}</span>
                    <span className="text-white/40 font-mono">({(p.winProbability * 100).toFixed(0)}%)</span>
                    <span className="text-amber-400 font-mono font-bold">{p.totalBet.toFixed(0)}🪙</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
