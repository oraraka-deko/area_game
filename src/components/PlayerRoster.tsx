import React, { useState } from 'react';
import { PlayerBet } from '../types/game.js';
import { ChevronDown, ChevronUp, Copy, Check, Lock, Users } from 'lucide-react';
import { sound } from '../utils/audio.js';

interface PlayerRosterProps {
  bets: PlayerBet[];
  serverSeedHash: string;
  poolTier: 'STANDARD' | 'HIGH_ROLLER';
  onCreatePrivateRoom: () => void;
  onOpenProvablyFairModal: () => void;
}

export const PlayerRoster: React.FC<PlayerRosterProps> = ({
  bets,
  serverSeedHash,
  poolTier,
  onCreatePrivateRoom,
  onOpenProvablyFairModal
}) => {
  const [expanded, setExpanded] = useState(true);
  const [copiedHash, setCopiedHash] = useState(false);

  // Sort players by total bet descending
  const sortedBets = [...bets].sort((a, b) => b.totalBet - a.totalBet);

  const handleCopyHash = () => {
    sound.playClick();
    navigator.clipboard.writeText(serverSeedHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Header with Player Count & Expand Toggle */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-2 py-1.5 cursor-pointer text-white/70 hover:text-white transition"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide">
          <Users className="w-3.5 h-3.5 text-white/50" />
          <span>Players</span>
          <span className="w-4 h-4 rounded-full bg-white/10 text-white/80 text-[10px] flex items-center justify-center font-bold">
            {bets.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-white/50" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/50" />
        )}
      </div>

      {/* Expandable Player List (Exact design from Screenshot 8) */}
      {expanded && (
        <div className="flex flex-col gap-1.5">
          {sortedBets.length === 0 ? (
            <div className="p-4 text-center rounded-2xl bg-[#12141f]/60 border border-white/5 text-xs text-white/40">
              No participants yet in this round. Be the first to stake territory!
            </div>
          ) : (
            sortedBets.map((player, idx) => (
              <div
                key={player.playerId}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-[#141624] border border-white/5 hover:border-white/10 transition group"
              >
                {/* Left: Rank + Avatar + Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[11px] font-mono font-bold text-white/40 w-3 text-center">
                    {idx + 1}
                  </span>

                  <div className="relative flex-shrink-0">
                    {player.avatar ? (
                      <img
                        src={player.avatar}
                        alt={player.username}
                        className="w-8 h-8 rounded-full object-cover"
                        style={{ boxShadow: `0 0 0 2px ${player.color}` }}
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-black"
                        style={{ backgroundColor: player.color }}
                      >
                        {player.username.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate max-w-[110px] sm:max-w-[150px]">
                      {player.username}
                    </div>
                    {player.relics.length > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {player.relics.map(r => (
                          <span key={r.id} className="text-[11px]" title={r.name}>
                            {r.icon}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Relic icon + Win % + Bet Amount */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <span className="font-mono text-xs font-semibold text-white/50">
                      {(player.winProbability * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="text-right font-mono font-bold text-xs sm:text-sm text-white flex items-center gap-1">
                    <span>
                      {player.totalBet.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                    <span className="text-amber-400 text-xs">🪙</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Private Room CTA (Matching Screenshot 8) */}
      <button
        onClick={onCreatePrivateRoom}
        className="w-full py-2.5 px-3 rounded-2xl bg-[#141624] hover:bg-[#1a1d30] border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 shadow-sm"
      >
        <Lock className="w-3.5 h-3.5 text-white/70" />
        <span>Create Private Room</span>
      </button>

      {/* Provably Fair Commitment Footer (Matching Screenshot 8) */}
      <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-white/50">
        <div
          onClick={onOpenProvablyFairModal}
          className="flex items-center gap-1.5 cursor-pointer hover:text-white/80 transition"
        >
          <span>Hash:</span>
          <span className="font-mono text-white/70 underline underline-offset-2">
            {serverSeedHash ? `${serverSeedHash.substring(0, 8)}...${serverSeedHash.substring(serverSeedHash.length - 4)}` : 'Generating...'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyHash();
            }}
            className="p-1 hover:text-white text-white/40"
            title="Copy pre-game SHA-256 hash commitment"
          >
            {copiedHash ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-semibold text-white/70">
          <span>{poolTier === 'HIGH_ROLLER' ? '⚡ High Roller' : '🐻 Standard'}</span>
        </div>
      </div>
    </div>
  );
};
