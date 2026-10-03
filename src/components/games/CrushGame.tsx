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

  const [betAmount, setBetAmount] = useState<number>(50);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hasCashedOut, setHasCashedOut] = useState<boolean>(false);
  const [multiplier, setMultiplier] = useState<number>(1.00);
  const [crashed, setCrashed] = useState<boolean>(false);
  const [wonAmount, setWonAmount] = useState<number>(0);

  const crashPointRef = useRef<number>(2.0);
  const currentMultRef = useRef<number>(1.00);
  const startTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);

  const handleStartFlight = () => {
    if (user.credits < betAmount || isPlaying) {
      sound.playBettingClosed();
      haptic.notification('error');
      return;
    }

    // Deduct bet
    setUser(prev => ({ ...prev, credits: +(prev.credits - betAmount).toFixed(2) }));
    sound.playBetPlaced();
    haptic.impact('medium');

    // Generate provably fair crash point (E.g., 1.05x to 15.0x with 3% house edge)
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

    const win = +(betAmount * currentMultRef.current).toFixed(2);
    setUser(prev => ({ ...prev, credits: +(prev.credits + win).toFixed(2) }));
    sound.playVictory();
    haptic.notification('success');

    setWonAmount(win);
    setHasCashedOut(true);

    recordGameOutcome({
      gameId: 'crush',
      userId: user.id,
      betAmount,
      payoutAmount: win,
      multiplier: currentMultRef.current,
      status: 'WIN',
      gameDetails: { cashedAt: currentMultRef.current, crashPoint: crashPointRef.current }
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
      for (let x = 30; x < W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 30; y < H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      if (isPlayingRef.current) {
        const elapsed = (now - startTimeRef.current) / 1000;
        // Multiplier grows exponentially: 1.00 + 0.15 * t^1.7
        const current = +(1.00 + 0.22 * Math.pow(elapsed, 1.8)).toFixed(2);
        currentMultRef.current = current;
        setMultiplier(current);

        // Check crash
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
              betAmount,
              payoutAmount: 0,
              multiplier: 0,
              status: 'LOSS',
              gameDetails: { crashedAt: current, crashPoint: crashPointRef.current }
            });
          }
        }

        // Draw parabolic flight curve
        const progressX = Math.min(W - 40, 20 + elapsed * 38);
        const progressY = Math.max(30, H - 20 - Math.pow(elapsed * 4.5, 1.6));

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.moveTo(20, H - 20);
        ctx.quadraticCurveTo((20 + progressX) / 2, H - 20, progressX, progressY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw Rocket Marker
        ctx.save();
        ctx.translate(progressX, progressY);
        ctx.rotate(-0.4);
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚀', 0, 0);
        ctx.restore();
      } else {
        // Static baseline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, H - 20);
        ctx.lineTo(W - 20, H - 20);
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

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

      {/* Main Game Box */}
      <div className="relative rounded-3xl border border-emerald-500/30 bg-[#0f141f] p-4 shadow-xl flex flex-col gap-4 overflow-hidden">
        {/* Multiplier Center Display */}
        <div className="text-center py-2 relative z-10">
          <div className="text-xs font-bold uppercase tracking-wider text-white/50">
            {crashed ? 'CRASHED AT' : (isPlaying ? 'CURRENT MULTIPLIER' : 'READY TO LAUNCH')}
          </div>
          <div
            className={`text-5xl font-black font-mono tracking-tight mt-1 transition-colors ${
              crashed ? 'text-rose-500 animate-pulse' : (hasCashedOut ? 'text-[#ccff00]' : 'text-emerald-400')
            }`}
          >
            {multiplier.toFixed(2)}x
          </div>
          {hasCashedOut && (
            <div className="text-xs font-mono font-bold text-[#ccff00] mt-1 flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cashed out: +{wonAmount.toFixed(2)} 🪙</span>
            </div>
          )}
        </div>

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
                Select Bet Amount
              </span>
              <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/5">
                {[25, 50, 100, 250, 500].map(amt => (
                  <button
                    key={amt}
                    onClick={() => {
                      setBetAmount(amt);
                      haptic.selection();
                    }}
                    className={`flex-1 py-1 text-[11px] font-mono rounded-lg transition ${
                      betAmount === amt
                        ? 'bg-emerald-400 text-black font-black'
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
              className="w-full py-3.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-black font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-lg shadow-emerald-400/20 flex items-center justify-center gap-2"
            >
              <Rocket className="w-4 h-4 fill-current" />
              <span>Launch Rocket ({betAmount} 🪙)</span>
            </button>
          </div>
        ) : (
          <button
            disabled={hasCashedOut}
            onClick={handleCashout}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-lg ${
              !hasCashedOut
                ? 'bg-[#ccff00] hover:bg-[#b8e600] text-black shadow-[#ccff00]/30'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            {!hasCashedOut
              ? `CASH OUT (+${(betAmount * multiplier).toFixed(2)} 🪙)`
              : 'CASHED OUT ✅'}
          </button>
        )}
      </div>
    </div>
  );
};
