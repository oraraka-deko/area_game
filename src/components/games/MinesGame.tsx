import React, { useState } from 'react';
import { sound } from '../../utils/audio.js';
import { haptic } from '../../utils/telegram.js';
import { Sparkles, Bomb, Diamond, RotateCcw, ArrowLeft } from 'lucide-react';
import { UserProfile } from '../../types/game.js';
import { recordGameOutcome } from '../../utils/gameRecord.js';

interface MinesGameProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  onBack: () => void;
}

export const MinesGame: React.FC<MinesGameProps> = ({ user, setUser, onBack }) => {
  const [currency, setCurrency] = useState<'ton' | 'stars'>('ton');
  const [mineCount, setMineCount] = useState<number>(3);
  const [betAmount, setBetAmount] = useState<number>(0.2);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [revealed, setRevealed] = useState<boolean[]>(Array(25).fill(false));
  const [minePositions, setMinePositions] = useState<Set<number>>(new Set());
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [won, setWon] = useState<boolean>(false);
  const [diamondsFound, setDiamondsFound] = useState<number>(0);

  const currentBalance = currency === 'ton' ? (user.tonBalance || 0) : (user.starsBalance || 0);

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
  const currentPayout = +(betAmount * currentMultiplier).toFixed(currency === 'ton' ? 4 : 0);

  const handleCurrencyChange = (newCurr: 'ton' | 'stars') => {
    if (isPlaying) return;
    setCurrency(newCurr);
    setBetAmount(newCurr === 'ton' ? 0.2 : 25);
    haptic.selection();
  };

  const handleStartGame = () => {
    if (currentBalance < betAmount) {
      haptic.notification('error');
      sound.playBettingClosed();
      return;
    }

    // Deduct bet from chosen currency
    if (currency === 'ton') {
      setUser(prev => ({ ...prev, tonBalance: +(prev.tonBalance - betAmount).toFixed(4) }));
    } else {
      setUser(prev => ({ ...prev, starsBalance: Math.max(0, prev.starsBalance - Math.floor(betAmount)) }));
    }

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

      // Record loss in Neon Postgres
      recordGameOutcome({
        gameId: 'mines',
        userId: user.id,
        currency,
        betAmount,
        payoutAmount: 0,
        multiplier: 0,
        status: 'LOSS',
        gameDetails: { mineCount, diamondsFound, currency }
      });
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
    if (currency === 'ton') {
      setUser(prev => ({ ...prev, tonBalance: +(prev.tonBalance + payout).toFixed(4) }));
    } else {
      setUser(prev => ({ ...prev, starsBalance: prev.starsBalance + Math.floor(payout) }));
    }

    sound.playVictory();
    haptic.notification('success');
    setWon(true);
    setIsPlaying(false);

    // Record win in Neon Postgres
    recordGameOutcome({
      gameId: 'mines',
      userId: user.id,
      currency,
      betAmount,
      payoutAmount: payout,
      multiplier: currentMultiplier,
      status: 'WIN',
      gameDetails: { mineCount, diamondsFound, currency }
    });

    // Reveal rest of board
    setRevealed(Array(25).fill(true));
  };

  const tonPresets = [0.05, 0.1, 0.2, 0.5, 1.0];
  const starsPresets = [10, 25, 50, 100, 250];

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
          <span className="text-xs text-white/50 font-mono">In-App Balance:</span>
          <span className="text-sm font-black font-mono text-cyan-300">
            {currency === 'ton' ? `${(user.tonBalance || 0).toFixed(2)} TON` : `${(user.starsBalance || 0).toLocaleString()} ⭐`}
          </span>
        </div>
      </div>

      {/* Game Card */}
      <div className="rounded-3xl border border-cyan-500/30 bg-[#121624] p-4 shadow-xl flex flex-col gap-4">
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💣</span>
            <div>
              <div className="text-base font-extrabold text-white">Mines PvE</div>
              <div className="text-[11px] text-white/50 font-mono">
                {isPlaying ? `${diamondsFound} Diamonds Found • ${currentMultiplier}x` : 'Deposit & Bet in TON or Stars'}
              </div>
            </div>
          </div>

          {/* Currency Switcher */}
          {!isPlaying && (
            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-xl border border-white/10">
              <button
                onClick={() => handleCurrencyChange('ton')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  currency === 'ton' ? 'bg-cyan-500 text-black shadow' : 'text-white/60 hover:text-white'
                }`}
              >
                💎 TON
              </button>
              <button
                onClick={() => handleCurrencyChange('stars')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  currency === 'stars' ? 'bg-amber-400 text-black shadow' : 'text-white/60 hover:text-white'
                }`}
              >
                ⭐ Stars
              </button>
            </div>
          )}
        </div>

        {/* 5x5 Mine Grid */}
        <div className="grid grid-cols-5 gap-2 aspect-square w-full max-w-[340px] mx-auto">
          {revealed.map((isRev, idx) => {
            const isMine = minePositions.has(idx);
            return (
              <button
                key={idx}
                disabled={!isPlaying || isRev || gameOver || won}
                onClick={() => handleCellClick(idx)}
                className={`aspect-square rounded-2xl flex items-center justify-center font-black text-xl transition-all duration-200 active:scale-95 shadow-md ${
                  !isRev
                    ? 'bg-[#1b2033] hover:bg-[#252c45] border border-white/10 hover:border-cyan-500/50'
                    : isMine
                    ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-400 animate-pulse'
                    : 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-300'
                }`}
              >
                {isRev ? (
                  isMine ? (
                    <Bomb className="w-6 h-6 animate-bounce" />
                  ) : (
                    <Diamond className="w-6 h-6 animate-pulse" />
                  )
                ) : (
                  <span className="text-white/20 text-xs">◆</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Controls and Settings */}
        {!isPlaying ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              {/* Bet Amount */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                  Bet Amount ({currency === 'ton' ? 'TON' : 'Stars'})
                </span>
                <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/5 overflow-x-auto scrollbar-none">
                  {(currency === 'ton' ? tonPresets : starsPresets).map(amt => (
                    <button
                      key={amt}
                      onClick={() => {
                        setBetAmount(amt);
                        haptic.selection();
                      }}
                      className={`flex-1 py-1 text-[11px] font-mono rounded-lg transition ${
                        betAmount === amt
                          ? currency === 'ton' ? 'bg-cyan-500 text-black font-black' : 'bg-amber-400 text-black font-black'
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
                          ? 'bg-purple-500 text-white font-black'
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
              disabled={currentBalance < betAmount}
              className={`w-full py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-lg ${
                currentBalance >= betAmount
                  ? currency === 'ton'
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 text-black shadow-cyan-400/20'
                    : 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:brightness-110 text-black shadow-amber-400/20'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              {currentBalance >= betAmount
                ? `Start Game (${betAmount} ${currency === 'ton' ? 'TON' : '⭐'})`
                : 'Insufficient Balance'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              disabled={diamondsFound === 0}
              onClick={handleCashout}
              className={`w-full py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-lg ${
                diamondsFound > 0
                  ? 'bg-emerald-400 hover:bg-emerald-300 text-black shadow-emerald-400/25'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              {diamondsFound > 0
                ? `Cash Out (${currentPayout} ${currency === 'ton' ? 'TON' : '⭐'})`
                : 'Pick at least 1 tile'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
