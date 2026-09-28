import React, { useState } from 'react';
import { sound } from '../../utils/audio.js';
import { haptic } from '../../utils/telegram.js';
import { Sparkles, Bomb, Diamond, RotateCcw, ArrowLeft } from 'lucide-react';
import { UserProfile } from '../../types/game.js';

interface MinesGameProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  onBack: () => void;
}

export const MinesGame: React.FC<MinesGameProps> = ({ user, setUser, onBack }) => {
  const [mineCount, setMineCount] = useState<number>(3);
  const [betAmount, setBetAmount] = useState<number>(50);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [revealed, setRevealed] = useState<boolean[]>(Array(25).fill(false));
  const [minePositions, setMinePositions] = useState<Set<number>>(new Set());
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [won, setWon] = useState<boolean>(false);
  const [diamondsFound, setDiamondsFound] = useState<number>(0);

  // Multiplier calculation based on revealed diamonds and mine count
  const calculateMultiplier = (revealedCount: number, mines: number) => {
    if (revealedCount === 0) return 1.0;
    let mult = 1.0;
    for (let i = 0; i < revealedCount; i++) {
      mult *= (25 - i) / (25 - mines - i);
    }
    return +(mult * 0.98).toFixed(2); // 2% house edge
  };

  const currentMultiplier = calculateMultiplier(diamondsFound, mineCount);
  const currentPayout = +(betAmount * currentMultiplier).toFixed(2);

  const handleStartGame = () => {
    if (user.credits < betAmount) {
      haptic.notification('error');
      sound.playBettingClosed();
      return;
    }

    // Deduct bet
    setUser(prev => ({ ...prev, credits: +(prev.credits - betAmount).toFixed(2) }));
    sound.playBetPlaced();
    haptic.impact('medium');

    // Place mines randomly
    const newMines = new Set<number>();
    while (newMines.size < mineCount) {
      newMines.add(Math.floor(Math.random() * 25));
    }

    setMinePositions(newMines);
    setRevealed(Array(25).fill(false));
    setDiamondsFound(0);
    setGameOver(false);
    setWon(false);
    setIsPlaying(true);
  };

  const handleCellClick = (idx: number) => {
    if (!isPlaying || revealed[idx] || gameOver || won) return;

    const nextRevealed = [...revealed];
    nextRevealed[idx] = true;
    setRevealed(nextRevealed);

    if (minePositions.has(idx)) {
      // Hit a mine!
      sound.playBettingClosed();
      haptic.notification('error');
      setGameOver(true);
      setIsPlaying(false);
      // Reveal all mines
      const allRevealed = nextRevealed.map((r, i) => r || minePositions.has(i));
      setRevealed(allRevealed);
    } else {
      // Diamond found!
      const nextDiamonds = diamondsFound + 1;
      setDiamondsFound(nextDiamonds);
      sound.playTick();
      haptic.impact('light');

      // Check if all diamonds found
      if (nextDiamonds === 25 - mineCount) {
        handleCashout();
      }
    }
  };

  const handleCashout = () => {
    if (!isPlaying || diamondsFound === 0 || gameOver) return;

    const payout = currentPayout;
    setUser(prev => ({ ...prev, credits: +(prev.credits + payout).toFixed(2) }));
    sound.playVictory();
    haptic.notification('success');
    setWon(true);
    setIsPlaying(false);

    // Reveal rest of board
    setRevealed(Array(25).fill(true));
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

      {/* Game Card */}
      <div className="rounded-3xl border border-cyan-500/30 bg-[#121624] p-4 shadow-xl flex flex-col gap-4">
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💎</span>
            <div>
              <div className="text-base font-extrabold text-white">Mines PvE</div>
              <div className="text-[11px] text-white/50 font-mono">
                {isPlaying ? `${diamondsFound} Diamonds Found • ${currentMultiplier}x` : 'Customizable Risk & Multipliers'}
              </div>
            </div>
          </div>

          {isPlaying && (
            <div className="text-right">
              <div className="text-[10px] text-white/40 font-mono">Potential Payout</div>
              <div className="text-base font-black font-mono text-cyan-400">
                +{currentPayout.toFixed(2)} 🪙
              </div>
            </div>
          )}
        </div>

        {/* 5x5 Grid */}
        <div className="grid grid-cols-5 gap-2 aspect-square w-full max-w-[340px] mx-auto">
          {Array(25).fill(0).map((_, idx) => {
            const isRev = revealed[idx];
            const isMine = minePositions.has(idx);

            let bg = 'bg-[#1b2033] hover:bg-[#252c47] border-white/10 text-white/40';
            if (isRev) {
              if (isMine) {
                bg = 'bg-rose-500/30 border-rose-500 text-rose-400 animate-pulse';
              } else {
                bg = 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]';
              }
            }

            return (
              <button
                key={idx}
                disabled={!isPlaying || isRev || gameOver}
                onClick={() => handleCellClick(idx)}
                className={`relative rounded-xl border flex items-center justify-center transition-all duration-150 active:scale-90 aspect-square ${bg}`}
              >
                {isRev ? (
                  isMine ? (
                    <Bomb className="w-6 h-6 animate-bounce" />
                  ) : (
                    <Diamond className="w-6 h-6 text-cyan-300 drop-shadow" />
                  )
                ) : (
                  <span className="w-2 h-2 rounded-full bg-white/20" />
                )}
              </button>
            );
          })}
        </div>

        {/* Status Alert Banner */}
        {gameOver && (
          <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-center flex items-center justify-center gap-2 text-rose-300 text-xs font-bold">
            <Bomb className="w-4 h-4" />
            <span>BOOM! Mine detonated. Better luck next time!</span>
          </div>
        )}
        {won && (
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-center flex items-center justify-center gap-2 text-emerald-300 text-xs font-bold">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Cashed out! +{currentPayout.toFixed(2)} Credits won!</span>
          </div>
        )}

        {/* Controls */}
        {!isPlaying ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Bet Amount */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                  Bet Amount
                </span>
                <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/5">
                  {[25, 50, 100, 250].map(amt => (
                    <button
                      key={amt}
                      onClick={() => {
                        setBetAmount(amt);
                        haptic.selection();
                      }}
                      className={`flex-1 py-1 text-[11px] font-mono rounded-lg transition ${
                        betAmount === amt
                          ? 'bg-[#ccff00] text-black font-black'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mines Count */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                  Mines Count
                </span>
                <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/5">
                  {[1, 3, 5, 10].map(m => (
                    <button
                      key={m}
                      onClick={() => {
                        setMineCount(m);
                        haptic.selection();
                      }}
                      className={`flex-1 py-1 text-[11px] font-mono rounded-lg transition ${
                        mineCount === m
                          ? 'bg-cyan-500 text-black font-black'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleStartGame}
              className="w-full py-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-black font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-lg shadow-cyan-400/20"
            >
              Start Game ({betAmount} 🪙)
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              disabled={diamondsFound === 0}
              onClick={handleCashout}
              className={`w-full py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-lg ${
                diamondsFound > 0
                  ? 'bg-[#ccff00] hover:bg-[#b8e600] text-black shadow-[#ccff00]/25'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              {diamondsFound > 0 ? `Cash Out (${currentPayout.toFixed(2)} 🪙)` : 'Pick at least 1 tile'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
