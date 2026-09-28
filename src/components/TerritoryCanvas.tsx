import React, { useRef, useEffect } from 'react';
import { CurrentRoundState } from '../types/game.js';
import { sound } from '../utils/audio.js';
import {
  computeProportionalTerritories,
  findPlayerAtPoint,
  WatertightPolygon
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
  drawStationaryPuck,
  drawAimingArrow,
  drawFifaVarHud,
  drawBroadcastTvOverlay
} from '../utils/tableRenderer.js';

interface TerritoryCanvasProps {
  roundState: CurrentRoundState;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
}

export const TerritoryCanvas: React.FC<TerritoryCanvasProps> = ({ roundState }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const avatarCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const prevLerpPolygonsRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());

  // Ball & Trajectory State
  const flightTrajectoryRef = useRef<AirHockeyTrajectory | null>(null);
  const puckStateRef = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    x: number;
    y: number;
    finalX: number;
    finalY: number;
    shockwaveRadius: number;
    shockwaveActive: boolean;
    trail: { x: number; y: number }[];
    isStopped: boolean;
  }>({
    active: false,
    startTime: 0,
    duration: 10000,
    x: 230,
    y: 230,
    finalX: 230,
    finalY: 230,
    shockwaveRadius: 0,
    shockwaveActive: false,
    trail: [],
    isStopped: false
  });

  const particlesRef = useRef<Particle[]>([]);
  const lastAimTickRef = useRef<number>(0);
  const aimLockSoundPlayedRef = useRef<boolean>(false);
  const shotFiredRef = useRef<boolean>(false);
  const nextWallHitIdxRef = useRef<number>(0);
  const varScanPlayedRef = useRef<boolean>(false);
  const varConfirmPlayedRef = useRef<boolean>(false);

  const aimDataRef = useRef<{
    active: boolean;
    angle: number;
    progress: number;
    isLocked: boolean;
  }>({
    active: false,
    angle: 0,
    progress: 0,
    isLocked: false
  });

  // Pre-load avatars
  useEffect(() => {
    roundState.bets.forEach(bet => {
      if (bet.avatar && !avatarCacheRef.current.has(bet.avatar)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = bet.avatar;
        img.onload = () => avatarCacheRef.current.set(bet.avatar, img);
      }
    });
  }, [roundState.bets]);

  // Handle State Transitions
  useEffect(() => {
    const W = 460;
    const H = 460;
    const puck = puckStateRef.current;

    if (roundState.status === 'ROUND_RESOLVING') {
      sound.playTensionRamp();

      const territories = computeProportionalTerritories(roundState.bets, W, H);
      const winnerId = roundState.winningPlayerId || (roundState.bets[0] && roundState.bets[0].playerId) || '';

      const PRE_LAUNCH_MS = 1600;
      const totalDurationMs = roundState.resolutionDurationMs || 10000;
      const flightDurationMs = Math.max(2000, totalDurationMs - PRE_LAUNCH_MS);

      // Authoritative trajectory from server or deterministic simulation
      const traj = roundState.trajectory || simulateAirHockeyFlight(
        roundState.roundId,
        winnerId,
        territories,
        W,
        H,
        flightDurationMs
      );

      flightTrajectoryRef.current = traj;
      nextWallHitIdxRef.current = 0;
      varScanPlayedRef.current = false;
      varConfirmPlayedRef.current = false;

      puck.active = true;
      puck.startTime = performance.now();
      puck.duration = totalDurationMs;
      puck.x = W / 2;
      puck.y = H / 2;
      puck.finalX = traj.finalX;
      puck.finalY = traj.finalY;
      puck.shockwaveActive = false;
      puck.trail = [];
      puck.isStopped = false;

      lastAimTickRef.current = 0;
      aimLockSoundPlayedRef.current = false;
      shotFiredRef.current = false;
      aimDataRef.current = {
        active: true,
        angle: 0,
        progress: 0,
        isLocked: false
      };
    } else if (roundState.status === 'WINNER_CELEBRATION') {
      aimDataRef.current = { active: false, angle: 0, progress: 1, isLocked: false };
      puck.active = true;
      puck.x = puck.finalX;
      puck.y = puck.finalY;
      puck.shockwaveActive = true;
      puck.shockwaveRadius = 6;
      puck.isStopped = true;
      puck.trail = [];
    } else {
      flightTrajectoryRef.current = null;
      aimDataRef.current = { active: false, angle: 0, progress: 0, isLocked: false };
      puck.active = false;
      puck.x = W / 2;
      puck.y = H / 2;
      puck.shockwaveActive = false;
      puck.trail = [];
      puck.isStopped = false;
    }
  }, [roundState.status, roundState.winningPlayerId, roundState.roundId, roundState.trajectory]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    const W = 460;
    const H = 460;
    const cornerRadius = 38;

    const render = (now: number) => {
      if (!running) return;

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

      const puck = puckStateRef.current;
      const PRE_LAUNCH_MS = 1600;
      const traj = flightTrajectoryRef.current;

      let currentZoom = 1.0;
      let camX = W / 2;
      let camY = H / 2;
      let isVarActive = false;
      let varProgress = 0;

      // ==========================================
      // STATE & TRAJECTORY UPDATES
      // ==========================================
      if (puck.active && roundState.status === 'ROUND_RESOLVING' && traj) {
        const elapsed = now - puck.startTime;

        if (elapsed < PRE_LAUNCH_MS) {
          // Phase 1: 360-degree radar arrow turning around ball and locking launch angle
          const aimProgress = Math.min(1.0, elapsed / PRE_LAUNCH_MS);
          const easeOut = 1 - Math.pow(1 - aimProgress, 3);
          const totalTurns = 4 * Math.PI; // 720 degrees
          const targetAngle = traj.launchAngle || 0;
          const currentAngle = easeOut * (totalTurns + targetAngle);
          const isLocked = aimProgress >= 0.88;

          puck.x = W / 2;
          puck.y = H / 2;
          puck.trail = [];

          if (now - lastAimTickRef.current > (70 + (1 - easeOut) * 80) && aimProgress < 0.88) {
            lastAimTickRef.current = now;
            sound.playTick();
          }
          if (!aimLockSoundPlayedRef.current && isLocked) {
            aimLockSoundPlayedRef.current = true;
            sound.playAimLock();
          }

          aimDataRef.current = {
            active: true,
            angle: currentAngle,
            progress: aimProgress,
            isLocked
          };
        } else {
          aimDataRef.current = { active: false, angle: 0, progress: 1, isLocked: false };

          // Slap-shot impulse fired at 1.6s
          if (!shotFiredRef.current) {
            shotFiredRef.current = true;
            sound.playSlapShot();
            const launchAngle = traj.launchAngle || 0;
            for (let i = 0; i < 22; i++) {
              const spread = (Math.random() - 0.5) * 1.2;
              const spd = 120 + Math.random() * 220;
              particlesRef.current.push({
                x: W / 2,
                y: H / 2,
                vx: Math.cos(launchAngle + spread) * spd,
                vy: Math.sin(launchAngle + spread) * spd,
                alpha: 0.95,
                size: 2.5 + Math.random() * 2.5,
                color: '#ccff00'
              });
            }
          }

          const flightElapsed = elapsed - PRE_LAUNCH_MS;
          const flightDuration = Math.max(1000, puck.duration - PRE_LAUNCH_MS);
          const progress = Math.min(1.0, flightElapsed / flightDuration);

          // Sample exact physics point
          const sample = sampleTrajectory(traj, progress);
          puck.x = sample.x;
          puck.y = sample.y;
          puck.isStopped = sample.isStopped;

          // Perfectly synchronized rail bounce audio triggers
          if (traj.wallHits && traj.wallHits.length > 0) {
            while (
              nextWallHitIdxRef.current < traj.wallHits.length &&
              flightElapsed >= traj.wallHits[nextWallHitIdxRef.current].timeMs
            ) {
              sound.playPuckWallHit(traj.wallHits[nextWallHitIdxRef.current].intensity);
              nextWallHitIdxRef.current++;
            }
          }

          // Trail handling
          if (!sample.isStopped) {
            puck.trail.push({ x: sample.x, y: sample.y });
            if (puck.trail.length > 26) puck.trail.shift();
          } else {
            if (puck.trail.length > 0) puck.trail.shift();
          }

          // Motion dust particles
          if (!sample.isStopped && progress < 0.95 && Math.random() < 0.6) {
            particlesRef.current.push({
              x: sample.x,
              y: sample.y,
              vx: (Math.random() - 0.5) * 40,
              vy: (Math.random() - 0.5) * 40,
              alpha: 0.8,
              size: 2 + Math.random() * 2,
              color: '#ccff00'
            });
          }

          // ==========================================
          // DRAMATIC SPORT TV CHANNEL / FIFA VAR ZOOM
          // ==========================================
          const stopTimeMs = traj.stopTimeMs || (flightDuration * 0.65);
          if (flightElapsed >= stopTimeMs) {
            isVarActive = true;
            const varElapsed = flightElapsed - stopTimeMs;
            const varTotal = Math.max(1000, flightDuration - stopTimeMs);
            varProgress = Math.min(1.0, varElapsed / varTotal);

            // Smooth cubic optical camera zoom onto settled ball
            const zoomEase = 1 - Math.pow(1 - Math.min(1.0, varProgress * 1.5), 3);
            currentZoom = 1.0 + zoomEase * 1.35; // Zooms up to 2.35x
            camX = (W / 2) + (puck.finalX - W / 2) * zoomEase;
            camY = (H / 2) + (puck.finalY - H / 2) * zoomEase;

            // Audio cues for VAR Review and Confirmation
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
      } else if (roundState.status === 'WINNER_CELEBRATION') {
        currentZoom = 1.0;
        camX = W / 2;
        camY = H / 2;
      }

      // ==========================================
      // CANVAS RENDERING (WITH DYNAMIC CAMERA)
      // ==========================================
      ctx.save();
      // Clip to table arena
      drawRoundedRect(ctx, 0, 0, W, H, cornerRadius);
      ctx.clip();

      // Camera transformation (centered on camX, camY with currentZoom)
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(currentZoom, currentZoom);
      ctx.translate(-camX, -camY);

      // 1. Territories & Micro-dots
      const targetTerritories = computeProportionalTerritories(roundState.bets, W, H);
      const lerpedTerritories = interpolateTerritories(targetTerritories, prevLerpPolygonsRef.current, 0.16);
      const activeTerritory = findPlayerAtPoint(puck.x, puck.y, lerpedTerritories);

      const isWinnerCelebrating = roundState.status === 'WINNER_CELEBRATION';
      drawTerritorySlices(
        ctx,
        lerpedTerritories,
        roundState.winningPlayerId || '',
        isWinnerCelebrating,
        puck.isStopped ? activeTerritory?.playerId || null : null,
        now
      );

      // 2. Center Face-off Markings
      drawCenterMarkings(ctx, W, H);

      // 3. Badges (Avatars & Win Probabilities)
      lerpedTerritories.forEach(poly => {
        drawTerritoryBadge(ctx, poly, avatarCacheRef.current);
      });

      // 4. Puck & Trail
      if (puck.active || roundState.status === 'WINNER_CELEBRATION') {
        // Trail
        for (let i = 0; i < puck.trail.length; i++) {
          const pt = puck.trail[i];
          const frac = i / puck.trail.length;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3 + frac * 8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(204, 255, 0, ${frac * 0.45})`;
          ctx.fill();
        }

        // Settled Puck
        drawAirHockeyPuck(ctx, puck.x, puck.y);

        // Rotating Arrow in Aiming Phase
        if (aimDataRef.current.active) {
          drawAimingArrow(
            ctx,
            W / 2,
            H / 2,
            aimDataRef.current.angle,
            aimDataRef.current.progress,
            aimDataRef.current.isLocked
          );
        }

        // FIFA VAR Technology Crosshairs & Splitter Seam Laser (drawn in world coordinates)
        if (isVarActive && traj) {
          const winnerBet = roundState.bets.find(b => b.playerId === traj.winnerPlayerId);
          drawFifaVarHud(
            ctx,
            W,
            H,
            puck.x,
            puck.y,
            traj.nearestSeam,
            varProgress,
            winnerBet?.username || 'Winner',
            roundState.winningTicket,
            now
          );
        }
      } else {
        // Stationary Puck in Center during WAITING and BETTING_OPEN (Zero random drift!)
        drawStationaryPuck(ctx, W / 2, H / 2);
      }

      // 5. Particles
      updateAndDrawParticles(ctx, particlesRef.current);

      // 6. Celebration Shockwave
      if (puck.shockwaveActive) {
        puck.shockwaveRadius += 4.5;
        const maxR = 170;
        const alpha = Math.max(0, 1 - puck.shockwaveRadius / maxR);
        if (alpha > 0) {
          ctx.beginPath();
          ctx.arc(puck.finalX, puck.finalY, puck.shockwaveRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(204, 255, 0, ${alpha * 0.9})`;
          ctx.lineWidth = 4;
          ctx.stroke();
        } else {
          puck.shockwaveActive = false;
        }
      }

      ctx.restore(); // Camera

      // ==========================================
      // SCREEN-SPACE BROADCAST TV OVERLAY
      // ==========================================
      if (isVarActive && traj) {
        const winnerBet = roundState.bets.find(b => b.playerId === traj.winnerPlayerId);
        drawBroadcastTvOverlay(
          ctx,
          W,
          H,
          varProgress,
          winnerBet?.username || 'Winner',
          roundState.winningTicket,
          traj.nearestSeam,
          now
        );
      }

      ctx.restore(); // Table Clip

      // Table outer bumper rail frame
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
  }, [roundState]);

  return (
    <div className="relative w-full max-w-[440px] aspect-square mx-auto rounded-[34px] overflow-hidden border-2 border-white/10 shadow-[0_16px_50px_rgba(0,0,0,0.85)] bg-[#0c0d14]">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair"
      />
      {roundState.bets.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-sm pointer-events-none">
          <div className="text-center p-4">
            <span className="inline-block text-3xl mb-2 animate-bounce">🪙</span>
            <p className="text-white font-bold text-sm">Stake your territory to enter the arena</p>
            <p className="text-white/50 text-xs mt-0.5 font-mono">100% Provably Fair Cryptographic Resolution</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// INTERPOLATION HELPERS
// ==========================================

function interpolateTerritories(
  targets: WatertightPolygon[],
  prevMap: Map<string, { x: number; y: number; w: number; h: number }>,
  rate: number
): WatertightPolygon[] {
  return targets.map(t => {
    const prev = prevMap.get(t.playerId);
    if (!prev) {
      prevMap.set(t.playerId, { x: t.x, y: t.y, w: t.w, h: t.h });
      return t;
    }

    const newX = prev.x + (t.x - prev.x) * rate;
    const newY = prev.y + (t.y - prev.y) * rate;
    const newW = prev.w + (t.w - prev.w) * rate;
    const newH = prev.h + (t.h - prev.h) * rate;

    prevMap.set(t.playerId, { x: newX, y: newY, w: newW, h: newH });

    return {
      ...t,
      x: newX,
      y: newY,
      w: newW,
      h: newH,
      innerX: Math.round(newX + newW / 2),
      innerY: Math.round(newY + newH / 2)
    };
  });
}

function updateAndDrawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * 0.016;
    p.y += p.vy * 0.016;
    p.alpha -= 0.035;

    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(204, 255, 0, ${p.alpha})`;
    ctx.fill();
  }
}
