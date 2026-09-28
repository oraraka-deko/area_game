import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../../utils/audio.js';
import { haptic } from '../../utils/telegram.js';
import { UserProfile } from '../../types/game.js';
import { ArrowLeft, Play, Trophy, Users, ShieldAlert } from 'lucide-react';

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

  const [betAmount, setBetAmount] = useState<number>(50);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [wonCredits, setWonCredits] = useState<number>(0);

  const pucksRef = useRef<BumperPuck[]>([]);
  const isPlayingRef = useRef<boolean>(false);

  const ARENA_RADIUS = 150;
  const ARENA_CENTER = 170;

  const handleStartBattle = () => {
    if (user.credits < betAmount || isPlaying) {
      sound.playBettingClosed();
      haptic.notification('error');
      return;
    }

    // Deduct bet
    setUser(prev => ({ ...prev, credits: +(prev.credits - betAmount).toFixed(2) }));
    sound.playBetPlaced();
    haptic.impact('medium');

    const competitors: BumperPuck[] = [
      {
        id: 'user',
        name: user.username,
        avatar: user.avatar,
        color: '#ccff00',
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
        color: '#0ea5e9',
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
        name: 'GigaChad',
        color: '#a855f7',
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
    setWinnerName(null);
    setWonCredits(0);
    setIsPlaying(true);
  };

  // 2D Sumo Physics Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    let lastTime = performance.now();

    const render = (now: number) => {
      if (!running) return;

      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // 1. Draw Circular Sumo Arena Ring
      ctx.save();
      // Outer drop zone
      ctx.fillStyle = '#0a0b12';
      ctx.fillRect(0, 0, W, H);

      // Arena Circle
      ctx.beginPath();
      ctx.arc(ARENA_CENTER, ARENA_CENTER, ARENA_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#141726';
      ctx.fill();

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Ring markings
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ARENA_CENTER, ARENA_CENTER, ARENA_RADIUS * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 2. Update and Collide Pucks
      if (isPlayingRef.current) {
        const pucks = pucksRef.current;

        // Move pucks & apply arena suction / random AI steering
        pucks.forEach(p => {
          if (!p.isAlive) return;

          // AI push towards center / opponents
          const toCenterAngle = Math.atan2(ARENA_CENTER - p.y, ARENA_CENTER - p.x);
          p.vx += Math.cos(toCenterAngle) * 90 * dt;
          p.vy += Math.sin(toCenterAngle) * 90 * dt;

          p.x += p.vx * dt;
          p.y += p.vy * dt;

          // Friction
          p.vx *= 0.985;
          p.vy *= 0.985;

          // Check if ringed out (fallen off the edge)
          const distFromCenter = Math.hypot(p.x - ARENA_CENTER, p.y - ARENA_CENTER);
          if (distFromCenter > ARENA_RADIUS + p.radius) {
            p.isAlive = false;
            sound.playTick();
            haptic.impact('medium');
          }
        });

        // Pairwise collisions between alive pucks
        for (let i = 0; i < pucks.length; i++) {
          for (let j = i + 1; j < pucks.length; j++) {
            const p1 = pucks[i];
            const p2 = pucks[j];
            if (!p1.isAlive || !p2.isAlive) continue;

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy);
            const minDist = p1.radius + p2.radius;

            if (dist < minDist && dist > 0.001) {
              const nx = dx / dist;
              const ny = dy / dist;

              // Separate
              const overlap = (minDist - dist) / 2;
              p1.x -= nx * overlap;
              p1.y -= ny * overlap;
              p2.x += nx * overlap;
              p2.y += ny * overlap;

              // Elastic collision impulse
              const kx = p1.vx - p2.vx;
              const ky = p1.vy - p2.vy;
              const p = 2 * (nx * kx + ny * ky) / 2;

              p1.vx -= p * nx * 1.35;
              p1.vy -= p * ny * 1.35;
              p2.vx += p * nx * 1.35;
              p2.vy += p * ny * 1.35;

              sound.playPuckWallHit(0.7);
              haptic.selection();
            }
          }
        }

        // Check if only 1 survivor remains
        const alivePucks = pucks.filter(p => p.isAlive);
        if (alivePucks.length <= 1) {
          isPlayingRef.current = false;
          setIsPlaying(false);

          const winner = alivePucks[0] || pucks[0];
          setWinnerName(winner.name);

          if (winner.isUser) {
            const win = +(betAmount * 3.75).toFixed(2);
            setWonCredits(win);
            setUser(prev => ({ ...prev, credits: +(prev.credits + win).toFixed(2) }));
            sound.playVictory();
            haptic.notification('success');
          } else {
            sound.playBettingClosed();
            haptic.notification('warning');
          }
        }
      }

      // 3. Draw Pucks
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
            <div className="text-[10px] text-white/40 font-mono">Winner Pot</div>
            <div className="text-sm font-black font-mono text-amber-400">
              +{(betAmount * 3.75).toFixed(2)} 🪙
            </div>
          </div>
        </div>

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
          <div className="w-full p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-center">
            <div className="text-xs text-amber-300 font-bold">
              👑 Champion: {winnerName}!
            </div>
            {wonCredits > 0 ? (
              <div className="text-sm font-black text-[#ccff00] mt-0.5">
                You won +{wonCredits.toFixed(2)} Credits!
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
                Select Bet Amount
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
                        ? 'bg-amber-400 text-black font-black'
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
              className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Enter Sumo Battle ({betAmount} 🪙)</span>
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
