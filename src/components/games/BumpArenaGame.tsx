import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../../utils/audio.js';
import { haptic } from '../../utils/telegram.js';
import { UserProfile } from '../../types/game.js';
import { ArrowLeft, Play, Trophy, Users, ShieldAlert } from 'lucide-react';
import { recordGameOutcome } from '../../utils/gameRecord.js';

interface BumpArenaGameProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  onBack: () => void;
}

interface BumperPuck {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isAlive: boolean;
  isUser: boolean;
}

export const BumpArenaGame: React.FC<BumpArenaGameProps> = ({ user, setUser, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  const [currency, setCurrency] = useState<'ton' | 'stars'>('ton');
  const [betAmount, setBetAmount] = useState<number>(0.2);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [wonAmount, setWonAmount] = useState<number>(0);

  const pucksRef = useRef<BumperPuck[]>([]);
  const isPlayingRef = useRef<boolean>(false);

  const currentBalance = currency === 'ton' ? (user.tonBalance || 0) : (user.starsBalance || 0);

  const ARENA_RADIUS = 150;
  const ARENA_CENTER = 170;

  const handleCurrencyChange = (newCurr: 'ton' | 'stars') => {
    if (isPlaying) return;
    setCurrency(newCurr);
    setBetAmount(newCurr === 'ton' ? 0.2 : 25);
    haptic.selection();
  };

  const handleStartBattle = () => {
    if (currentBalance < betAmount || isPlaying) {
      sound.playBettingClosed();
      haptic.notification('error');
      return;
    }

    // Deduct bet from chosen balance
    if (currency === 'ton') {
      setUser(prev => ({ ...prev, tonBalance: +(prev.tonBalance - betAmount).toFixed(4) }));
    } else {
      setUser(prev => ({ ...prev, starsBalance: Math.max(0, prev.starsBalance - Math.floor(betAmount)) }));
    }

    sound.playBetPlaced();
    haptic.impact('medium');

    const competitors: BumperPuck[] = [
      {
        id: 'user',
        name: user.username,
        avatar: user.avatar,
        color: '#06b6d4',
        x: ARENA_CENTER - 60,
        y: ARENA_CENTER,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        radius: 18,
        isAlive: true,
        isUser: true
      },
      {
        id: 'bot_alpha',
        name: 'Viper #09',
        color: '#ef4444',
        x: ARENA_CENTER + 60,
        y: ARENA_CENTER,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        radius: 18,
        isAlive: true,
        isUser: false
      },
      {
        id: 'bot_beta',
        name: 'CyberKong',
        color: '#a855f7',
        x: ARENA_CENTER,
        y: ARENA_CENTER - 60,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        radius: 18,
        isAlive: true,
        isUser: false
      },
      {
        id: 'bot_gamma',
        name: 'NeonBlitz',
        color: '#f59e0b',
        x: ARENA_CENTER,
        y: ARENA_CENTER + 60,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        radius: 18,
        isAlive: true,
        isUser: false
      }
    ];

    pucksRef.current = competitors;
    isPlayingRef.current = true;
    setIsPlaying(true);
    setWinnerName(null);
    setWonAmount(0);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();
    let running = true;

    const render = (now: number) => {
      if (!running) return;

      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw Ring Platform
      ctx.save();
      ctx.beginPath();
      ctx.arc(ARENA_CENTER, ARENA_CENTER, ARENA_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#0f121d';
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Platform grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      if (isPlayingRef.current) {
        const pucks = pucksRef.current;

        // Physics update
        pucks.forEach(p => {
          if (!p.isAlive) return;

          // Repulsive force towards center
          const dxCenter = ARENA_CENTER - p.x;
          const dyCenter = ARENA_CENTER - p.y;
          const distCenter = Math.hypot(dxCenter, dyCenter);

          // Random agitation force
          p.vx += (Math.random() - 0.5) * 450 * dt + (dxCenter / (distCenter + 1)) * 30 * dt;
          p.vy += (Math.random() - 0.5) * 450 * dt + (dyCenter / (distCenter + 1)) * 30 * dt;

          // Drag
          p.vx *= 0.985;
          p.vy *= 0.985;

          p.x += p.vx * dt;
          p.y += p.vy * dt;

          // Out of arena check
          if (distCenter > ARENA_RADIUS - p.radius + 8) {
            p.isAlive = false;
            sound.playTick();
            haptic.impact('medium');
          }
        });

        // Puck collisions
        for (let i = 0; i < pucks.length; i++) {
          for (let j = i + 1; j < pucks.length; j++) {
            const p1 = pucks[i];
            const p2 = pucks[j];
            if (!p1.isAlive || !p2.isAlive) continue;

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy);

            if (dist < p1.radius + p2.radius) {
              const nx = dx / dist;
              const ny = dy / dist;

              const kx = p1.vx - p2.vx;
              const ky = p1.vy - p2.vy;
              const p = 2 * (nx * kx + ny * ky) / 2;

              p1.vx -= p * nx * 1.5;
              p1.vy -= p * ny * 1.5;
              p2.vx += p * nx * 1.5;
              p2.vy += p * ny * 1.5;

              sound.playClick();
            }
          }
        }

        // Check Winner
        const alivePucks = pucks.filter(p => p.isAlive);
        if (alivePucks.length <= 1) {
          isPlayingRef.current = false;
          setIsPlaying(false);

          const winner = alivePucks[0] || pucks[0];
          setWinnerName(winner.name);

          if (winner.isUser) {
            const win = +(betAmount * 3.75).toFixed(currency === 'ton' ? 4 : 0);
            setWonAmount(win);

            if (currency === 'ton') {
              setUser(prev => ({ ...prev, tonBalance: +(prev.tonBalance + win).toFixed(4) }));
            } else {
              setUser(prev => ({ ...prev, starsBalance: prev.starsBalance + Math.floor(win) }));
            }

            sound.playVictory();
            haptic.notification('success');

            recordGameOutcome({
              gameId: 'bumper',
              userId: user.id,
              currency,
              betAmount,
              payoutAmount: win,
              multiplier: 3.75,
              status: 'WIN',
              gameDetails: { survivor: winner.name, currency }
            });
          } else {
            sound.playBettingClosed();
            haptic.notification('warning');

            recordGameOutcome({
              gameId: 'bumper',
              userId: user.id,
              currency,
              betAmount,
              payoutAmount: 0,
              multiplier: 0,
              status: 'LOSS',
              gameDetails: { survivor: winner.name, currency }
            });
          }
        }
      }

      // Draw Pucks
      pucksRef.current.forEach(p => {
        if (!p.isAlive) return;

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.name.substring(0, 2).toUpperCase(), p.x, p.y);
        ctx.restore();
      });

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [currency, betAmount]);

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
      <div className="rounded-3xl border border-amber-500/30 bg-[#12141f] p-4 shadow-xl flex flex-col gap-4 items-center">
        <div className="w-full flex items-center justify-between border-b border-white/5 pb-2">
          <div>
            <div className="text-base font-extrabold text-white flex items-center gap-1.5">
              <span>🥊 Bump Arena PvP</span>
            </div>
            <div className="text-[11px] text-white/50 font-mono">
              Knock 3 competitors out of the ring!
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-white/40 font-mono">Winner 3.75x Pot</div>
            <div className="text-sm font-black font-mono text-amber-400">
              +{(betAmount * 3.75).toFixed(currency === 'ton' ? 3 : 0)} {currency === 'ton' ? 'TON' : '⭐'}
            </div>
          </div>
        </div>

        {/* Currency Switcher */}
        {!isPlaying && (
          <div className="flex items-center justify-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 w-fit">
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

        {/* Sumo Canvas Ring */}
        <div className="relative w-full max-w-[340px] aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-inner bg-black">
          <canvas
            ref={canvasRef}
            width={340}
            height={340}
            className="w-full h-full block"
          />
        </div>

        {/* Winner Banner */}
        {winnerName && (
          <div className="w-full p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-center animate-in zoom-in-95 duration-200">
            <div className="text-xs text-amber-300 font-bold">
              👑 Champion: {winnerName}!
            </div>
            {wonAmount > 0 ? (
              <div className="text-sm font-black text-cyan-300 mt-0.5">
                You won +{wonAmount} {currency === 'ton' ? 'TON' : '⭐'}!
              </div>
            ) : (
              <div className="text-xs text-white/60 mt-0.5">
                Knocked out! Try again.
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        {!isPlaying ? (
          <div className="w-full flex flex-col gap-3">
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
              onClick={handleStartBattle}
              disabled={currentBalance < betAmount}
              className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-lg flex items-center justify-center gap-2 ${
                currentBalance >= betAmount
                  ? currency === 'ton'
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black hover:brightness-110 shadow-cyan-400/20'
                    : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black hover:brightness-110 shadow-amber-400/20'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>
                {currentBalance >= betAmount
                  ? `Enter Sumo Battle (${betAmount} ${currency === 'ton' ? 'TON' : '⭐'})`
                  : 'Insufficient Balance'}
              </span>
            </button>
          </div>
        ) : (
          <div className="text-xs font-mono text-amber-300 animate-pulse py-2 font-bold">
            ⚔️ Sumo Battle in Progress... Watch the Ring Out!
          </div>
        )}
      </div>
    </div>
  );
};
