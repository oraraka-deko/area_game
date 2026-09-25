import React, { useRef, useEffect, useState } from 'react';
import { RoundHistoryItem } from '../types/game.js';
import { sound } from '../utils/audio.js';
import {
  computeProportionalTerritories,
  findPlayerAtPoint
} from '../utils/slicing.js';
import {
  AirHockeyTrajectory,
  simulateAirHockeyFlight,
  sampleTrajectory
} from '../utils/physics.js';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  ShieldCheck,
  CheckCircle2,
  Users,
  Trophy
} from 'lucide-react';

interface RoundReplayModalProps {
  round: RoundHistoryItem;
  onClose: () => void;
  onOpenVerify: (round: RoundHistoryItem) => void;
}

export const RoundReplayModal: React.FC<RoundReplayModalProps> = ({
  round,
  onClose,
  onOpenVerify
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const avatarCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Video Player State
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const durationMs = 7500;
  const W = 460;
  const H = 460;
  const cornerRadius = 38;

  // Pre-calculate the exact deterministic physics flight
  const trajectoryRef = useRef<AirHockeyTrajectory | null>(null);
  const lastWallHitTimeRef = useRef<number>(0);

  useEffect(() => {
    const territories = computeProportionalTerritories(round.players, W, H);
    const traj = simulateAirHockeyFlight(
      round.roundId,
      round.winner.playerId,
      territories,
      W,
      H,
      durationMs
    );
    trajectoryRef.current = traj;
    setCurrentTimeMs(0);
    setIsPlaying(true);
  }, [round]);

  // Preload avatars
  useEffect(() => {
    round.players.forEach(p => {
      if (p.avatar && !avatarCacheRef.current.has(p.avatar)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = p.avatar;
        img.onload = () => avatarCacheRef.current.set(p.avatar, img);
      }
    });
  }, [round.players]);

  // Animation / Video Playback Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastFrameTime = performance.now();
    let running = true;

    const render = (now: number) => {
      if (!running) return;

      const delta = Math.min(100, now - lastFrameTime);
      lastFrameTime = now;

      // Advance video playback if playing
      let newTime = currentTimeMs;
      if (isPlaying) {
        newTime = Math.min(durationMs, currentTimeMs + delta * playbackSpeed);
        setCurrentTimeMs(newTime);
        if (newTime >= durationMs) {
          setIsPlaying(false);
          if (audioEnabled) sound.playVictory();
        }
      }

      const progress = Math.min(1.0, newTime / durationMs);

      // Handle retina scale
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const displayW = rect.width;
      const displayH = rect.height;

      if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
        canvas.width = displayW * dpr;
        canvas.height = displayH * dpr;
      }

      ctx.save();
      ctx.scale((displayW * dpr) / W, (displayH * dpr) / H);
      ctx.clearRect(0, 0, W, H);

      // Trajectory sampling
      let puckX = W / 2;
      let puckY = H / 2;
      let zoom = 1.0;

      if (trajectoryRef.current) {
        const sample = sampleTrajectory(trajectoryRef.current, progress);
        puckX = sample.x;
        puckY = sample.y;

        // Sound on wall hit
        if (sample.isWallHit && isPlaying && audioEnabled && now - lastWallHitTimeRef.current > 100) {
          lastWallHitTimeRef.current = now;
          sound.playPuckWallHit(sample.wallIntensity);
        }

        // Camera zoom: Smooth transition in final 25% of flight
        if (progress > 0.75) {
          const zoomProg = (progress - 0.75) / 0.25;
          const easeZoom = zoomProg * zoomProg * (3 - 2 * zoomProg);
          zoom = 1.0 + easeZoom * 2.2;
        }
      }

      let camX = W / 2;
      let camY = H / 2;
      if (zoom > 1.05) {
        camX = puckX;
        camY = puckY;
      }

      // Rounded Table Clip
      ctx.save();
      drawRoundedRect(ctx, 0, 0, W, H, cornerRadius);
      ctx.clip();

      // Camera Matrix
      ctx.translate(W / 2, H / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-camX, -camY);

      // Compute & Render Territories
      const territories = computeProportionalTerritories(round.players, W, H);
      const activeTerritory = findPlayerAtPoint(puckX, puckY, territories);

      territories.forEach(poly => {
        ctx.fillStyle = poly.color;
        ctx.fillRect(poly.x, poly.y, poly.w, poly.h);

        // Highlight territory if winner is settled or being focused
        const isWinner = poly.playerId === round.winner.playerId;
        if (isWinner && progress >= 0.98) {
          const pulse = 0.5 + 0.5 * Math.sin(now * 0.01);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.18 + pulse * 0.18})`;
          ctx.fillRect(poly.x, poly.y, poly.w, poly.h);
        } else if (activeTerritory?.playerId === poly.playerId && zoom > 1.8) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fillRect(poly.x, poly.y, poly.w, poly.h);
        }

        // Surface micro-dots
        ctx.save();
        ctx.beginPath();
        ctx.rect(poly.x, poly.y, poly.w, poly.h);
        ctx.clip();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        for (let x = poly.x + 10; x < poly.x + poly.w; x += 20) {
          for (let y = poly.y + 10; y < poly.y + poly.h; y += 20) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      });

      // Seam dividers
      ctx.save();
      ctx.strokeStyle = '#0c0d14';
      ctx.lineWidth = 4;
      territories.forEach(poly => ctx.strokeRect(poly.x, poly.y, poly.w, poly.h));
      ctx.restore();

      // Center face-off markings
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 58, 0, Math.PI * 2);
      ctx.stroke();

      // Badges
      territories.forEach(poly => {
        drawTerritoryBadge(ctx, poly, avatarCacheRef.current);
      });

      // Puck
      drawAirHockeyPuck(ctx, puckX, puckY);

      // Final Shockwave if finished
      if (progress >= 0.99) {
        const pulseR = 40 + (Math.sin(now * 0.006) * 15);
        ctx.beginPath();
        ctx.arc(puckX, puckY, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(204, 255, 0, 0.7)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.restore(); // Camera
      ctx.restore(); // Clip

      // Table outer frame
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 6;
      drawRoundedRect(ctx, 3, 3, W - 6, H - 6, cornerRadius);
      ctx.stroke();
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [currentTimeMs, isPlaying, playbackSpeed, audioEnabled, round]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTimeMs(val);
  };

  const handleRestart = () => {
    setCurrentTimeMs(0);
    setIsPlaying(true);
    if (audioEnabled) sound.playClick();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#12141f] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#161928]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-extrabold text-sm text-white tracking-wide">
              Match Replay • Pool #{round.roundId}
            </span>
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
                round.poolTier === 'HIGH_ROLLER'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-white/10 text-white/70'
              }`}
            >
              {round.poolTier === 'HIGH_ROLLER' ? '⚡ High Roller' : 'Standard'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Scrollable */}
        <div className="p-4 overflow-y-auto flex flex-col gap-4">
          {/* Canvas Box */}
          <div className="relative w-full max-w-[420px] aspect-square mx-auto rounded-[30px] overflow-hidden border-2 border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.9)] bg-[#0c0d14]">
            <canvas
              ref={canvasRef}
              className="w-full h-full block"
            />
          </div>

          {/* Video Control Bar */}
          <div className="flex flex-col gap-2 p-3 rounded-2xl bg-[#161826] border border-white/5">
            {/* Timeline Scrubber */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-white/60 min-w-[42px]">
                {(currentTimeMs / 1000).toFixed(1)}s
              </span>
              <input
                type="range"
                min="0"
                max={durationMs}
                step="50"
                value={currentTimeMs}
                onChange={handleSeek}
                className="flex-1 accent-[#ccff00] cursor-pointer h-1.5 bg-white/15 rounded-lg"
              />
              <span className="font-mono text-xs text-white/40 min-w-[42px] text-right">
                {(durationMs / 1000).toFixed(1)}s
              </span>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                {/* Play / Pause */}
                <button
                  onClick={() => {
                    sound.playClick();
                    if (currentTimeMs >= durationMs) {
                      setCurrentTimeMs(0);
                      setIsPlaying(true);
                    } else {
                      setIsPlaying(!isPlaying);
                    }
                  }}
                  className="p-2 rounded-xl bg-[#ccff00] text-black hover:bg-[#b8e600] transition active:scale-95 shadow-sm"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                {/* Restart */}
                <button
                  onClick={handleRestart}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition active:scale-95"
                  title="Restart Replay"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Speed selector */}
                <div className="flex items-center bg-black/40 rounded-xl p-0.5 border border-white/5 text-[11px] font-mono">
                  {[0.5, 1.0, 2.0].map(spd => (
                    <button
                      key={spd}
                      onClick={() => {
                        sound.playClick();
                        setPlaybackSpeed(spd);
                      }}
                      className={`px-2 py-1 rounded-lg transition ${
                        playbackSpeed === spd
                          ? 'bg-[#ccff00] text-black font-bold'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio Toggle */}
              <button
                onClick={() => {
                  setAudioEnabled(!audioEnabled);
                  sound.playClick();
                }}
                className={`p-2 rounded-xl border transition ${
                  audioEnabled
                    ? 'bg-white/10 text-white border-white/10'
                    : 'bg-white/5 text-white/30 border-transparent'
                }`}
                title="Toggle Replay Audio"
              >
                {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Winner Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-[#ccff00]/15 via-emerald-500/10 to-transparent border border-[#ccff00]/30">
            <div className="flex items-center gap-3">
              <div className="relative">
                {round.winner.avatar ? (
                  <img
                    src={round.winner.avatar}
                    alt={round.winner.username}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-[#ccff00]"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-black"
                    style={{ backgroundColor: round.winner.color }}
                  >
                    {round.winner.username.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-black flex items-center justify-center text-[10px] font-black">
                  👑
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold uppercase tracking-wider">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Match Winner</span>
                </div>
                <div className="text-base font-extrabold text-white">
                  {round.winner.username}
                </div>
                <div className="text-[11px] text-white/60 font-mono">
                  Probability: {(round.winner.winProbability * 100).toFixed(1)}% • Winning Ticket: #{round.provablyFair.winningTicket}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm sm:text-base font-mono font-black text-[#ccff00]">
                +{round.winner.payout.toFixed(2)} 🪙
              </div>
              <div className="text-[10px] text-white/40 font-mono">
                Pool: {round.totalPool.toFixed(2)} CREDITS
              </div>
            </div>
          </div>

          {/* Players Roster Table for this round */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold text-white/60 px-1">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-white/40" />
                <span>Round Participants ({round.players.length})</span>
              </span>
              <span className="font-mono text-[11px]">Exact Slices</span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-none pr-1">
              {round.players.map(player => {
                const isWinner = player.playerId === round.winner.playerId;
                return (
                  <div
                    key={player.playerId}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                      isWinner
                        ? 'bg-[#ccff00]/10 border-[#ccff00]/40 ring-1 ring-[#ccff00]/20'
                        : 'bg-[#161826] border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: player.color }}
                      />
                      {player.avatar ? (
                        <img
                          src={player.avatar}
                          alt={player.username}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-black"
                          style={{ backgroundColor: player.color }}
                        >
                          {player.username.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate max-w-[120px]">
                            {player.username}
                          </span>
                          {isWinner && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-[#ccff00] text-black">
                              Winner
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-white/40 font-mono">
                          Tickets: #{player.startTicket} – #{player.endTicket}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-white">
                        {player.totalBet.toFixed(2)} 🪙
                      </div>
                      <div className="text-[10px] font-mono text-emerald-400">
                        {(player.winProbability * 100).toFixed(1)}% area
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Provably Fair Bottom Banner */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  SHA-256 Verified
                </div>
                <div className="text-[10px] font-mono text-white/40 truncate max-w-[240px]">
                  Hash: {round.provablyFair.seedHash.substring(0, 18)}...
                </div>
              </div>
            </div>

            <button
              onClick={() => onOpenVerify(round)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0 active:scale-95"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Verify Math</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// DRAWING HELPERS FOR REPLAY
// ==========================================

function drawTerritoryBadge(
  ctx: CanvasRenderingContext2D,
  poly: any,
  cache: Map<string, HTMLImageElement>
) {
  if (poly.playerId === 'neutral') return;

  const { innerX, innerY, w, h } = poly;
  const maxAllowedR = Math.min(w, h) * 0.38;
  const r = Math.max(22, Math.min(maxAllowedR, 52 * Math.sqrt(poly.winProbability)));
  const img = poly.avatar ? cache.get(poly.avatar) : null;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 10;

  if (img && img.complete) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(innerX, innerY - 6, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, innerX - r, innerY - 6 - r, r * 2, r * 2);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(innerX, innerY - 6, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(innerX, innerY - 6, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.fillStyle = poly.color || '#10b981';
    ctx.font = `bold ${Math.round(r * 0.9)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(poly.username.substring(0, 2).toUpperCase(), innerX, innerY - 5);
  }

  const pct = `${(poly.winProbability * 100).toFixed(1)}%`;
  ctx.font = 'bold 11px monospace';
  const tw = ctx.measureText(pct).width;
  ctx.fillStyle = 'rgba(12, 13, 20, 0.9)';
  ctx.beginPath();
  drawRoundedRect(ctx, innerX - tw / 2 - 6, innerY + r - 5, tw + 12, 18, 9);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pct, innerX, innerY + r + 4);

  ctx.restore();
}

function drawAirHockeyPuck(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();

  const aura = ctx.createRadialGradient(x, y, 2, x, y, 36);
  aura.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  aura.addColorStop(0.3, 'rgba(204, 255, 0, 0.75)');
  aura.addColorStop(0.7, 'rgba(14, 165, 233, 0.25)');
  aura.addColorStop(1, 'rgba(14, 165, 233, 0)');

  ctx.beginPath();
  ctx.arc(x, y, 36, 0, Math.PI * 2);
  ctx.fillStyle = aura;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ccff00';
  ctx.shadowBlur = 20;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, 7.5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(204, 255, 0, 0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
