import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../../utils/audio.js';
import { haptic } from '../../utils/telegram.js';
import { UserProfile } from '../../types/game.js';
import { ArrowLeft, Rocket, Flame, AlertTriangle, Sparkles } from 'lucide-react';
import { recordGameOutcome } from '../../utils/gameRecord.js';

interface CrushGameProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  onBack: () => void;
}

export const CrushGame: React.FC<CrushGameProps> = ({ user, setUser, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  const [currency, setCurrency] = useState<'ton' | 'stars'>('ton');
  const [betAmount, setBetAmount] = useState<number>(0.2);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hasCashedOut, setHasCashedOut] = useState<boolean>(false);
  const [multiplier, setMultiplier] = useState<number>(1.00);
  const [crashed, setCrashed] = useState<boolean>(false);
  const [wonAmount, setWonAmount] = useState<number>(0);

  const crashPointRef = useRef<number>(2.0);
  const currentMultRef = useRef<number>(1.00);
  const startTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);

  const currentBalance = currency === 'ton' ? (user.tonBalance || 0) : (user.starsBalance || 0);

  const handleCurrencyChange = (newCurr: 'ton' | 'stars') => {
    if (isPlaying) return;
    setCurrency(newCurr);
    setBetAmount(newCurr === 'ton' ? 0.2 : 25);
    haptic.selection();
  };

  const handleStartFlight = () => {
    if (currentBalance < betAmount || isPlaying) {
      sound.playBettingClosed();
      haptic.notification('error');
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

    // Generate provably fair crash point (E.g., 1.05x to 25.0x with 3% house edge)
    const r = Math.random();
    let crash = +(0.97 / (1.0 - r * 0.94)).toFixed(2);
    if (crash < 1.02) crash = 1.02;
    if (crash > 35.0) crash = 35.0;

    crashPointRef.current = crash;
    currentMultRef.current = 1.00;
    startTimeRef.current = performance.now();
    isPlayingRef.current = true;

    setMultiplier(1.00);
    setCrashed(false);
    setHasCashedOut(false);
    setWonAmount(0);
    setIsPlaying(true);
  };

  const handleCashout = () => {
    if (!isPlayingRef.current || hasCashedOut || crashed) return;

    const win = +(betAmount * currentMultRef.current).toFixed(currency === 'ton' ? 4 : 0);
    if (currency === 'ton') {
      setUser(prev => ({ ...prev, tonBalance: +(prev.tonBalance + win).toFixed(4) }));
    } else {
      setUser(prev => ({ ...prev, starsBalance: prev.starsBalance + Math.floor(win) }));
    }

    sound.playVictory();
    haptic.notification('success');

    setWonAmount(win);
    setHasCashedOut(true);

    recordGameOutcome({
      gameId: 'crush',
      userId: user.id,
      currency,
      betAmount,
      payoutAmount: win,
      multiplier: currentMultRef.current,
      status: 'WIN',
      gameDetails: { cashedAt: currentMultRef.current, crashPoint: crashPointRef.current, currency }
    });
  };

  // Canvas Rocket Flight Curve Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const render = (now: number) => {
      if (!running) return;

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Grid background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      if (isPlayingRef.current) {
        const elapsed = (now - startTimeRef.current) / 1000;
        // Exponential growth: starts fast then escalates
        const current = +(1.0 + Math.pow(elapsed * 0.42, 1.75)).toFixed(2);
        currentMultRef.current = current;
        setMultiplier(current);

        if (current >= crashPointRef.current) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          setCrashed(true);
          sound.playBettingClosed();
          haptic.notification('error');

          if (!hasCashedOut) {
            recordGameOutcome({
              gameId: 'crush',
              userId: user.id,
              currency,
              betAmount,
              payoutAmount: 0,
              multiplier: 0,
              status: 'LOSS',
              gameDetails: { crashPoint: crashPointRef.current, currency }
            });
          }
        }

        // Draw trajectory curve
        const progress = Math.min(1.0, elapsed / 8.0);
        const startX = 20;
        const startY = H - 20;
        const targetX = startX + progress * (W - 60);
        const targetY = startY - Math.min(H - 40, (current - 1.0) * 35);

        const grad = ctx.createLinearGradient(startX, startY, targetX, targetY);
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(1, crashed ? '#f43f5e' : '#10b981');

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(startX + (targetX - startX) * 0.5, startY, targetX, targetY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 4;
        ctx.stroke();

        // Draw rocket head
        ctx.save();
        ctx.translate(targetX, targetY);
        ctx.fillStyle = crashed ? '#f43f5e' : '#10b981';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();

        // Rocket exhaust particles
        if (!crashed) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
          ctx.beginPath();
          ctx.arc(-8, 3, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else {
        // Idle state graphic
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '12px monospace';
        ctx.fillText('WAITING FOR IGNITION...', W / 2 - 80, H / 2);
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

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

      {/* Main Game Box */}
      <div className="relative rounded-3xl border border-emerald-500/30 bg-[#0f141f] p-4 shadow-xl flex flex-col gap-4 overflow-hidden">
        {/* Multiplier Center Display */}
        <div className="text-center py-2 relative z-10">
          <div className="text-xs font-bold uppercase tracking-wider text-white/50">
            {crashed ? 'CRASHED AT' : (isPlaying ? 'CURRENT MULTIPLIER' : 'READY TO LAUNCH')}
          </div>
          <div
            className={`text-5xl font-black font-mono tracking-tight mt-1 transition-colors ${
              crashed ? 'text-rose-500 animate-pulse' : (hasCashedOut ? 'text-cyan-300' : 'text-emerald-400')
            }`}
          >
            {multiplier.toFixed(2)}x
          </div>
          {hasCashedOut && (
            <div className="text-xs font-mono font-bold text-cyan-300 mt-1 flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cashed out: +{wonAmount} {currency === 'ton' ? 'TON' : '⭐'}</span>
            </div>
          )}
        </div>

        {/* Currency Switcher */}
        {!isPlaying && (
          <div className="flex items-center justify-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 mx-auto w-fit">
            <button
              onClick={() => handleCurrencyChange('ton')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                currency === 'ton' ? 'bg-cyan-500 text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              💎 TON
            </button>
            <button
              onClick={() => handleCurrencyChange('stars')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                currency === 'stars' ? 'bg-amber-400 text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              ⭐ Stars
            </button>
          </div>
        )}

        {/* Rocket Canvas */}
        <div className="relative w-full aspect-[16/9] rounded-2xl bg-[#090b12] border border-white/10 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={340}
            height={190}
            className="w-full h-full block"
          />
        </div>

        {/* Controls */}
        {!isPlaying ? (
          <div className="flex flex-col gap-3">
            {/* Bet Picker */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                Select Bet Amount ({currency === 'ton' ? 'TON' : 'Stars'})
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

            <button
              onClick={handleStartFlight}
              disabled={currentBalance < betAmount}
              className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-lg flex items-center justify-center gap-2 ${
                currentBalance >= betAmount
                  ? currency === 'ton'
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black hover:brightness-110 shadow-cyan-400/20'
                    : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black hover:brightness-110 shadow-amber-400/20'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              <Rocket className="w-4 h-4 fill-current" />
              <span>
                {currentBalance >= betAmount
                  ? `Launch Rocket (${betAmount} ${currency === 'ton' ? 'TON' : '⭐'})`
                  : 'Insufficient Balance'}
              </span>
            </button>
          </div>
        ) : (
          <button
            disabled={hasCashedOut}
            onClick={handleCashout}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-lg ${
              !hasCashedOut
                ? 'bg-emerald-400 hover:bg-emerald-300 text-black shadow-emerald-400/30'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            {!hasCashedOut
              ? `CASH OUT (+${(betAmount * multiplier).toFixed(currency === 'ton' ? 3 : 0)} ${currency === 'ton' ? 'TON' : '⭐'})`
              : 'CASHED OUT ✅'}
          </button>
        )}
      </div>
    </div>
  );
};
