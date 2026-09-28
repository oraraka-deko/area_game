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
  drawRoundedRect,
  drawTerritorySlices,
  drawCenterMarkings,
  drawTerritoryBadge,
  drawAirHockeyPuck,
  drawAimingArrow,
  drawFifaVarHud,
  drawBroadcastTvOverlay
} from '../utils/tableRenderer.js';
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

  // Direct DOM refs to avoid 60fps React re-render thrashing
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const timeTextRef = useRef<HTMLSpanElement | null>(null);

  // Video Player Playback Engine (Total duration 10.0s = 1.6s aim + 8.4s flight)
  const TOTAL_DURATION_MS = 10000;
  const PRE_LAUNCH_MS = 1600;
  const flightDurationMs = TOTAL_DURATION_MS - PRE_LAUNCH_MS;

  const currentTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(true);
  const playbackSpeedRef = useRef<number>(1.0);
  const audioEnabledRef = useRef<boolean>(true);
  const trajectoryRef = useRef<AirHockeyTrajectory | null>(null);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const nextWallHitIdxRef = useRef<number>(0);
  const varScanPlayedRef = useRef<boolean>(false);
  const varConfirmPlayedRef = useRef<boolean>(false);
  const shotFiredRef = useRef<boolean>(false);

  // React State for button UI only
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  const W = 460;
  const H = 460;
  const cornerRadius = 38;

  // Pre-calculate / load deterministic trajectory
  useEffect(() => {
    const territories = computeProportionalTerritories(round.players, W, H);
    // Use stored trajectory or simulate deterministic flight
    const traj = round.trajectory || simulateAirHockeyFlight(
      round.roundId,
      round.winner.playerId,
      territories,
      W,
      H,
      flightDurationMs
    );
    trajectoryRef.current = traj;
    currentTimeRef.current = 0;
    nextWallHitIdxRef.current = 0;
    trailRef.current = [];
    varScanPlayedRef.current = false;
    varConfirmPlayedRef.current = false;
    shotFiredRef.current = false;
    isPlayingRef.current = true;
    setIsPlaying(true);

    if (sliderRef.current) sliderRef.current.value = '0';
    if (timeTextRef.current) timeTextRef.current.textContent = '0.0s';
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

  // Keyboard shortcut: Spacebar to toggle Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        handleTogglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Butter-smooth 60fps Video Playback Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastFrameTime = performance.now();
    let running = true;

    const render = (now: number) => {
      if (!running) return;

      const delta = Math.min(64, now - lastFrameTime);
      lastFrameTime = now;

      // 1. Advance Playback Time
      if (isPlayingRef.current) {
        currentTimeRef.current = Math.min(
          TOTAL_DURATION_MS,
          currentTimeRef.current + delta * playbackSpeedRef.current
        );

        if (sliderRef.current) {
          sliderRef.current.value = String(currentTimeRef.current);
        }
        if (timeTextRef.current) {
          timeTextRef.current.textContent = (currentTimeRef.current / 1000).toFixed(1) + 's';
        }

        if (currentTimeRef.current >= TOTAL_DURATION_MS) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          if (audioEnabledRef.current) sound.playVictory();
        }
      }

      const curTime = currentTimeRef.current;
      const traj = trajectoryRef.current;

      // 2. High-DPI canvas scaling (Avoid layout thrashing)
      const dpr = window.devicePixelRatio || 1;
      const displayW = canvas.clientWidth || 360;
      const displayH = canvas.clientHeight || 360;

      if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
        canvas.width = displayW * dpr;
        canvas.height = displayH * dpr;
      }

      ctx.save();
      ctx.scale((displayW * dpr) / W, (displayH * dpr) / H);
      ctx.clearRect(0, 0, W, H);

      let puckX = W / 2;
      let puckY = H / 2;
      let isStopped = false;
      let currentZoom = 1.0;
      let camX = W / 2;
      let camY = H / 2;
      let isVarActive = false;
      let varProgress = 0;
      let aimAngle = 0;
      let aimProgress = 0;
      let isAimLocked = false;
      let isAimingActive = false;

      // 3. Trajectory & Dynamic Camera Calculation
      if (traj) {
        if (curTime < PRE_LAUNCH_MS) {
          // Aiming Dial Phase (0 to 1.6s)
          isAimingActive = true;
          aimProgress = Math.min(1.0, curTime / PRE_LAUNCH_MS);
          const easeOut = 1 - Math.pow(1 - aimProgress, 3);
          const totalTurns = 4 * Math.PI;
          aimAngle = easeOut * (totalTurns + (traj.launchAngle || 0));
          isAimLocked = aimProgress >= 0.88;
          puckX = W / 2;
          puckY = H / 2;
          trailRef.current = [];
          shotFiredRef.current = false;
        } else {
          // Flight Phase (1.6s to 10.0s)
          if (!shotFiredRef.current) {
            shotFiredRef.current = true;
            if (audioEnabledRef.current) sound.playSlapShot();
          }

          const flightElapsed = curTime - PRE_LAUNCH_MS;
          const progress = Math.min(1.0, flightElapsed / flightDurationMs);

          const sample = sampleTrajectory(traj, progress);
          puckX = sample.x;
          puckY = sample.y;
          isStopped = sample.isStopped;

          // Wall hit synchronized audio
          if (isPlayingRef.current && audioEnabledRef.current && traj.wallHits) {
            while (
              nextWallHitIdxRef.current < traj.wallHits.length &&
              flightElapsed >= traj.wallHits[nextWallHitIdxRef.current].timeMs
            ) {
              sound.playPuckWallHit(traj.wallHits[nextWallHitIdxRef.current].intensity);
              nextWallHitIdxRef.current++;
            }
          }

          // Trail
          if (!isStopped) {
            trailRef.current.push({ x: puckX, y: puckY });
            if (trailRef.current.length > 24) trailRef.current.shift();
          } else {
            if (trailRef.current.length > 0) trailRef.current.shift();
          }

          // Dynamic FIFA VAR Camera Zoom when ball comes to rest
          const stopTimeMs = traj.stopTimeMs || (flightDurationMs * 0.65);
          if (flightElapsed >= stopTimeMs) {
            isVarActive = true;
            const varElapsed = flightElapsed - stopTimeMs;
            const varTotal = Math.max(1000, flightDurationMs - stopTimeMs);
            varProgress = Math.min(1.0, varElapsed / varTotal);

            const zoomEase = 1 - Math.pow(1 - Math.min(1.0, varProgress * 1.5), 3);
            currentZoom = 1.0 + zoomEase * 1.35;
            camX = (W / 2) + (traj.finalX - W / 2) * zoomEase;
            camY = (H / 2) + (traj.finalY - H / 2) * zoomEase;

            if (isPlayingRef.current && audioEnabledRef.current) {
              if (!varScanPlayedRef.current && varProgress >= 0.05) {
                varScanPlayedRef.current = true;
                sound.playVarScan();
              }
              if (!varConfirmPlayedRef.current && varProgress >= 0.60) {
                varConfirmPlayedRef.current = true;
                sound.playVarConfirm();
              }
            }
          }
        }
      }

      // 4. Render Table with Dynamic Camera Zoom
      ctx.save();
      drawRoundedRect(ctx, 0, 0, W, H, cornerRadius);
      ctx.clip();

      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(currentZoom, currentZoom);
      ctx.translate(-camX, -camY);

      // Compute & Render Territories
      const territories = computeProportionalTerritories(round.players, W, H);
      const activeTerritory = findPlayerAtPoint(puckX, puckY, territories);

      drawTerritorySlices(
        ctx,
        territories,
        round.winner.playerId,
        curTime >= TOTAL_DURATION_MS,
        isStopped ? activeTerritory?.playerId || null : null,
        now
      );

      // Center Markings
      drawCenterMarkings(ctx, W, H);

      // Territory Badges
      territories.forEach(poly => {
        drawTerritoryBadge(ctx, poly, avatarCacheRef.current);
      });

      // Draw Motion Trail
      const trail = trailRef.current;
      for (let i = 0; i < trail.length; i++) {
        const pt = trail[i];
        const frac = i / trail.length;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3 + frac * 8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(204, 255, 0, ${frac * 0.45})`;
        ctx.fill();
      }

      // Draw Puck
      drawAirHockeyPuck(ctx, puckX, puckY);

      // Draw Aiming Arrow
      if (isAimingActive) {
        drawAimingArrow(ctx, W / 2, H / 2, aimAngle, aimProgress, isAimLocked);
      }

      // Draw FIFA VAR Calipers & Seam Laser
      if (isVarActive && traj) {
        drawFifaVarHud(
          ctx,
          W,
          H,
          puckX,
          puckY,
          traj.nearestSeam,
          varProgress,
          round.winner.username,
          round.provablyFair?.winningTicket,
          now
        );
      }

      ctx.restore(); // Camera

      // Screen-space FIFA TV Broadcast Overlay
      if (isVarActive && traj) {
        drawBroadcastTvOverlay(
          ctx,
          W,
          H,
          varProgress,
          round.winner.username,
          round.provablyFair?.winningTicket,
          traj.nearestSeam,
          now
        );
      }

      ctx.restore(); // Table Clip

      // Table outer frame
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
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
  }, [round]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    currentTimeRef.current = val;

    // Resync wall hits and audio flags based on seeked time
    const flightElapsed = val - PRE_LAUNCH_MS;
    if (trajectoryRef.current?.wallHits) {
      const idx = trajectoryRef.current.wallHits.findIndex(h => h.timeMs >= flightElapsed);
      nextWallHitIdxRef.current = idx === -1 ? trajectoryRef.current.wallHits.length : idx;
    }
    const stopTimeMs = trajectoryRef.current?.stopTimeMs || (flightDurationMs * 0.65);
    varScanPlayedRef.current = flightElapsed > stopTimeMs;
    varConfirmPlayedRef.current = flightElapsed > (stopTimeMs + 1800);
    shotFiredRef.current = val > PRE_LAUNCH_MS;

    if (timeTextRef.current) {
      timeTextRef.current.textContent = (val / 1000).toFixed(1) + 's';
    }
  };

  const handleRestart = () => {
    currentTimeRef.current = 0;
    nextWallHitIdxRef.current = 0;
    varScanPlayedRef.current = false;
    varConfirmPlayedRef.current = false;
    shotFiredRef.current = false;
    trailRef.current = [];
    isPlayingRef.current = true;
    setIsPlaying(true);
    if (sliderRef.current) sliderRef.current.value = '0';
    if (timeTextRef.current) timeTextRef.current.textContent = '0.0s';
    if (audioEnabledRef.current) sound.playClick();
  };

  const handleTogglePlay = () => {
    sound.playClick();
    if (currentTimeRef.current >= TOTAL_DURATION_MS) {
      handleRestart();
    } else {
      const nextPlay = !isPlayingRef.current;
      isPlayingRef.current = nextPlay;
      setIsPlaying(nextPlay);
    }
  };

  const handleChangeSpeed = (spd: number) => {
    sound.playClick();
    playbackSpeedRef.current = spd;
    setPlaybackSpeed(spd);
  };

  const handleToggleAudio = () => {
    sound.playClick();
    const nextAudio = !audioEnabledRef.current;
    audioEnabledRef.current = nextAudio;
    setAudioEnabled(nextAudio);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#12141f] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#161928] shrink-0">
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
          {/* Canvas Box: Guaranteed square proportion without flex squashing */}
          <div className="relative w-full max-w-[360px] aspect-square shrink-0 mx-auto rounded-[28px] overflow-hidden border-2 border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.9)] bg-[#0c0d14]">
            <canvas
              ref={canvasRef}
              className="w-full h-full block"
            />
          </div>

          {/* Video Control Bar */}
          <div className="flex flex-col gap-2 p-3 rounded-2xl bg-[#161826] border border-white/5 shrink-0">
            {/* Timeline Scrubber */}
            <div className="flex items-center gap-3">
              <span ref={timeTextRef} className="font-mono text-xs text-white/70 min-w-[42px]">
                0.0s
              </span>
              <input
                ref={sliderRef}
                type="range"
                min="0"
                max={TOTAL_DURATION_MS}
                step="25"
                defaultValue="0"
                onChange={handleSeek}
                className="flex-1 accent-[#ccff00] cursor-pointer h-1.5 bg-white/15 rounded-lg"
              />
              <span className="font-mono text-xs text-white/40 min-w-[42px] text-right">
                {(TOTAL_DURATION_MS / 1000).toFixed(1)}s
              </span>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                {/* Play / Pause */}
                <button
                  onClick={handleTogglePlay}
                  className="p-2 rounded-xl bg-[#ccff00] text-black hover:bg-[#b8e600] transition active:scale-95 shadow-sm"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
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
                      onClick={() => handleChangeSpeed(spd)}
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
                onClick={handleToggleAudio}
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
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-[#ccff00]/15 via-emerald-500/10 to-transparent border border-[#ccff00]/30 shrink-0">
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
          <div className="flex flex-col gap-2 shrink-0">
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
          <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5 shrink-0">
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
