import React, { useRef, useEffect } from 'react';
import { CurrentRoundState } from '../types/game.js';
import { sound } from '../utils/audio.js';
import {
  WatertightPolygon,
  computeProportionalTerritories,
  findPlayerAtPoint
} from '../utils/slicing.js';
import {
  AirHockeyTrajectory,
  simulateAirHockeyFlight,
  sampleTrajectory
} from '../utils/physics.js';

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

  // Animation Refs
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
    zoom: number;
    shockwaveRadius: number;
    shockwaveActive: boolean;
    lastWallSoundTime: number;
    trail: { x: number; y: number }[];
    isStopped: boolean;
  }>({
    active: false,
    startTime: 0,
    duration: 7500,
    x: 230,
    y: 230,
    finalX: 230,
    finalY: 230,
    zoom: 1.0,
    shockwaveRadius: 0,
    shockwaveActive: false,
    lastWallSoundTime: 0,
    trail: [],
    isStopped: false
  });

  const particlesRef = useRef<Particle[]>([]);
  const lastAimTickRef = useRef<number>(0);
  const aimLockSoundPlayedRef = useRef<boolean>(false);
  const shotFiredRef = useRef<boolean>(false);
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

      // Compute pure 2D air hockey trajectory with launchAngle
      const PRE_LAUNCH_MS = 1600;
      const durationMs = roundState.resolutionDurationMs || 10000;
      const flightDurationMs = Math.max(2000, durationMs - PRE_LAUNCH_MS);
      const traj = simulateAirHockeyFlight(
        roundState.roundId,
        winnerId,
        territories,
        W,
        H,
        flightDurationMs
      );

      flightTrajectoryRef.current = traj;
      puck.active = true;
      puck.startTime = performance.now();
      puck.duration = durationMs;
      puck.x = W / 2;
      puck.y = H / 2;
      puck.finalX = traj.finalX;
      puck.finalY = traj.finalY;
      puck.zoom = 1.0;
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
      puck.zoom = 1.0;
      puck.shockwaveActive = true;
      puck.shockwaveRadius = 5;
      puck.isStopped = true;
      puck.trail = [];
    } else {
      flightTrajectoryRef.current = null;
      aimDataRef.current = { active: false, angle: 0, progress: 0, isLocked: false };
      puck.active = false;
      puck.x = W / 2;
      puck.y = H / 2;
      puck.zoom = 1.0;
      puck.shockwaveActive = false;
      puck.trail = [];
      puck.isStopped = false;
    }
  }, [roundState.status, roundState.winningPlayerId, roundState.roundId]);

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

      // Handle high-DPI displays
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

      const puck = puckStateRef.current;

      // Update puck position during active resolution flight
      const PRE_LAUNCH_MS = 1600;

      if (puck.active && roundState.status === 'ROUND_RESOLVING' && flightTrajectoryRef.current) {
        const elapsed = now - puck.startTime;

        if (elapsed < PRE_LAUNCH_MS) {
          // Pre-launch: 360-degree arrow turning around ball and locking random launch angle
          const aimProgress = Math.min(1.0, elapsed / PRE_LAUNCH_MS);
          const easeOut = 1 - Math.pow(1 - aimProgress, 3);
          const totalTurns = 4 * Math.PI; // 720 degrees (2 full 360° rotations)
          const targetAngle = flightTrajectoryRef.current.launchAngle || 0;
          const currentAngle = easeOut * (totalTurns + targetAngle);
          const isLocked = aimProgress >= 0.88;

          puck.x = W / 2;
          puck.y = H / 2;
          puck.zoom = 1.0;
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

          // Slap-shot impulse fired!
          if (!shotFiredRef.current) {
            shotFiredRef.current = true;
            sound.playSlapShot();
            const launchAngle = flightTrajectoryRef.current.launchAngle || 0;
            for (let i = 0; i < 24; i++) {
              const spread = (Math.random() - 0.5) * 1.2;
              const spd = 120 + Math.random() * 240;
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
          const sample = sampleTrajectory(flightTrajectoryRef.current, progress);
          puck.x = sample.x;
          puck.y = sample.y;
          puck.isStopped = sample.isStopped;

          // Play sound on rail bounce
          if (sample.isWallHit && now - puck.lastWallSoundTime > 75) {
            puck.lastWallSoundTime = now;
            sound.playPuckWallHit(sample.wallIntensity);
          }

          // Trail handling: only append while ball is actively moving
          if (!sample.isStopped) {
            puck.trail.push({ x: sample.x, y: sample.y });
            if (puck.trail.length > 28) puck.trail.shift();
          } else {
            // Gradually fade out trail points when ball comes to rest
            if (puck.trail.length > 0) puck.trail.shift();
          }

          // Spawn particles only while active in motion
          if (!sample.isStopped && progress < 0.96 && Math.random() < 0.7) {
            particlesRef.current.push({
              x: sample.x,
              y: sample.y,
              vx: (Math.random() - 0.5) * 45,
              vy: (Math.random() - 0.5) * 45,
              alpha: 0.85,
              size: 2 + Math.random() * 2.5,
              color: '#ccff00'
            });
          }

          puck.zoom = 1.0;
        }
      }

      // Stable camera: Keep entire arena table centered and fully visible
      ctx.save();
      drawRoundedRect(ctx, 0, 0, W, H, cornerRadius);
      ctx.clip();

      // 1. Compute Proportional Slices
      const targetTerritories = computeProportionalTerritories(roundState.bets, W, H);
      const lerpedTerritories = interpolateTerritories(targetTerritories, prevLerpPolygonsRef.current, 0.16);

      // Detect which territory currently contains the ball
      const activeTerritory = findPlayerAtPoint(puck.x, puck.y, lerpedTerritories);

      // 2. Draw Territory Fills with Acrylic Table Grid
      lerpedTerritories.forEach(poly => {
        ctx.fillStyle = poly.color;
        ctx.fillRect(poly.x, poly.y, poly.w, poly.h);

        // Highlight if ball is currently inside this territory (or victory celebration)
        const isWinnerCelebrating = roundState.status === 'WINNER_CELEBRATION' && roundState.winningPlayerId === poly.playerId;
        const isCurrentlyInside = roundState.status === 'ROUND_RESOLVING' && activeTerritory?.playerId === poly.playerId && puck.zoom > 1.8;

        if (isWinnerCelebrating) {
          const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.18 + pulse * 0.18})`;
          ctx.fillRect(poly.x, poly.y, poly.w, poly.h);
        } else if (isCurrentlyInside) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.fillRect(poly.x, poly.y, poly.w, poly.h);
        }

        // Air hockey surface micro-perforations
        ctx.save();
        ctx.beginPath();
        ctx.rect(poly.x, poly.y, poly.w, poly.h);
        ctx.clip();

        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        const dotSpacing = 20;
        for (let x = poly.x + 10; x < poly.x + poly.w; x += dotSpacing) {
          for (let y = poly.y + 10; y < poly.y + poly.h; y += dotSpacing) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      });

      // 3. Draw Territory Seams (Crisp dividers separating territories)
      drawTerritorySeams(ctx, lerpedTerritories);

      // 4. Center Face-off Circle Markings
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 58, 0, Math.PI * 2);
      ctx.stroke();

      // Center dot
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 6, 0, Math.PI * 2);
      ctx.fill();

      // 5. Territory Avatar Badges & Win Percentages
      lerpedTerritories.forEach(poly => {
        drawTerritoryBadge(ctx, poly, avatarCacheRef.current);
      });

      // 6. Draw Puck
      // A) During Resolving or Celebration: Puck is moving or zoomed at final location
      // B) During Waiting or Betting Open: Puck sits COMPLETELY STILL at center of the table (no random movement!)
      if (puck.active || roundState.status === 'WINNER_CELEBRATION') {
        // Draw Trail
        for (let i = 0; i < puck.trail.length; i++) {
          const pt = puck.trail[i];
          const frac = i / puck.trail.length;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3 + frac * 8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(204, 255, 0, ${frac * 0.45})`;
          ctx.fill();
        }

        // Draw Puck
        drawAirHockeyPuck(ctx, puck.x, puck.y);

        // If the ball has fully stopped during resolving, draw an anticipation lock ring and badge!
        if (puck.isStopped && roundState.status === 'ROUND_RESOLVING') {
          const settlePulse = 0.5 + 0.5 * Math.sin(now * 0.007);
          ctx.save();
          ctx.beginPath();
          ctx.arc(puck.x, puck.y, 22 + settlePulse * 4, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(204, 255, 0, ${0.4 + settlePulse * 0.4})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.font = 'bold 9px monospace';
          const badgeText = '🎯 BALL SETTLED';
          const tw = ctx.measureText(badgeText).width;
          ctx.fillStyle = 'rgba(12, 14, 24, 0.9)';
          ctx.beginPath();
          drawRoundedRect(ctx, puck.x - tw / 2 - 6, puck.y - 36, tw + 12, 17, 6);
          ctx.fill();
          ctx.strokeStyle = 'rgba(204, 255, 0, 0.8)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#ccff00';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, puck.x, puck.y - 27);
          ctx.restore();
        }

        // If in aiming phase, draw rotating arrow on top of the ball!
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
      } else {
        // IDLE / BETTING OPEN: Puck sits stationary at center (W/2, H/2) with gentle ambient glow
        drawStationaryPuck(ctx, W / 2, H / 2);
      }

      // 7. Update & Draw Particles
      updateAndDrawParticles(ctx, particlesRef.current);

      // 8. Victory Shockwave
      if (puck.shockwaveActive) {
        puck.shockwaveRadius += 4.5;
        const maxR = 160;
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
      ctx.restore(); // Scale & Clip

      // 9. Draw Table Bumper Rail Frame
      drawBumperFrame(canvas, dpr, cornerRadius);

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
// DRAWING & INTERPOLATION HELPERS
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

function drawTerritorySeams(ctx: CanvasRenderingContext2D, territories: WatertightPolygon[]) {
  ctx.save();
  ctx.strokeStyle = '#0c0d14';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  territories.forEach(poly => {
    ctx.strokeRect(poly.x, poly.y, poly.w, poly.h);
  });
  ctx.restore();
}

function drawTerritoryBadge(
  ctx: CanvasRenderingContext2D,
  poly: WatertightPolygon,
  cache: Map<string, HTMLImageElement>
) {
  if (poly.playerId === 'neutral') return;

  const { innerX, innerY, w, h } = poly;
  // Scale badge to fit comfortably in slice
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

  // Win % Badge
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

  // Outer radial aura
  const aura = ctx.createRadialGradient(x, y, 2, x, y, 36);
  aura.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  aura.addColorStop(0.3, 'rgba(204, 255, 0, 0.75)');
  aura.addColorStop(0.7, 'rgba(14, 165, 233, 0.25)');
  aura.addColorStop(1, 'rgba(14, 165, 233, 0)');

  ctx.beginPath();
  ctx.arc(x, y, 36, 0, Math.PI * 2);
  ctx.fillStyle = aura;
  ctx.fill();

  // White disc core
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ccff00';
  ctx.shadowBlur = 20;
  ctx.fill();

  // Inner puck cylinder ring
  ctx.beginPath();
  ctx.arc(x, y, 7.5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(204, 255, 0, 0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawStationaryPuck(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  // Gentle resting puck at center of rink
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ccff00';
  ctx.shadowBlur = 10;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(204, 255, 0, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawAimingArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  progress: number,
  isLocked: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  const dialRadius = 38;

  // 1. Aiming dial / radar ring around puck
  ctx.save();
  ctx.strokeStyle = isLocked ? 'rgba(204, 255, 0, 0.85)' : 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = isLocked ? 2 : 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, dialRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Cardinal tick marks at 0, 90, 180, 270 degrees
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
    const tx1 = Math.cos(a) * (dialRadius - 4);
    const ty1 = Math.sin(a) * (dialRadius - 4);
    const tx2 = Math.cos(a) * (dialRadius + 5);
    const ty2 = Math.sin(a) * (dialRadius + 5);
    ctx.beginPath();
    ctx.moveTo(tx1, ty1);
    ctx.lineTo(tx2, ty2);
    ctx.strokeStyle = isLocked ? '#ccff00' : 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 2. Rotating arrow on top of / around the ball
  ctx.save();
  ctx.rotate(angle);

  // Laser aiming trajectory dashed line extending outwards
  const laserLen = isLocked ? 120 : 70;
  const laserGrad = ctx.createLinearGradient(dialRadius, 0, dialRadius + laserLen, 0);
  laserGrad.addColorStop(0, isLocked ? 'rgba(204, 255, 0, 0.95)' : 'rgba(56, 189, 248, 0.7)');
  laserGrad.addColorStop(1, 'rgba(204, 255, 0, 0)');
  ctx.strokeStyle = laserGrad;
  ctx.lineWidth = isLocked ? 2.5 : 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(dialRadius + 12, 0);
  ctx.lineTo(dialRadius + laserLen, 0);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrow Head geometry
  const arrowStart = 16;
  const arrowTip = 48;
  const arrowWingWidth = 10;

  ctx.shadowColor = isLocked ? '#ccff00' : '#38bdf8';
  ctx.shadowBlur = isLocked ? 22 : 12;
  ctx.fillStyle = isLocked ? '#ccff00' : '#ffffff';

  ctx.beginPath();
  ctx.moveTo(arrowTip, 0);
  ctx.lineTo(arrowTip - 15, -arrowWingWidth);
  ctx.lineTo(arrowTip - 11, -3);
  ctx.lineTo(arrowStart, -3);
  ctx.lineTo(arrowStart, 3);
  ctx.lineTo(arrowTip - 11, 3);
  ctx.lineTo(arrowTip - 15, arrowWingWidth);
  ctx.closePath();
  ctx.fill();

  // Highlight arrow edge
  ctx.strokeStyle = isLocked ? '#ffffff' : 'rgba(204, 255, 0, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // If locked, draw an energetic pulse arc
  if (isLocked) {
    ctx.strokeStyle = 'rgba(204, 255, 0, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, dialRadius + 12, -0.35, 0.35);
    ctx.stroke();
  }

  ctx.restore();

  // 3. Angle Readout Badge above puck
  ctx.save();
  ctx.font = 'bold 10px monospace';
  const deg = Math.round((((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * (180 / Math.PI));
  const badgeText = isLocked ? `🎯 ANGLE: ${deg}° (READY)` : `AIMING: ${deg}°`;
  const tw = ctx.measureText(badgeText).width;
  ctx.fillStyle = 'rgba(12, 14, 24, 0.9)';
  ctx.beginPath();
  drawRoundedRect(ctx, -tw / 2 - 8, -dialRadius - 26, tw + 16, 20, 7);
  ctx.fill();

  ctx.strokeStyle = isLocked ? '#ccff00' : 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = isLocked ? '#ccff00' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, 0, -dialRadius - 16);
  ctx.restore();

  ctx.restore();
}

function drawBumperFrame(canvas: HTMLCanvasElement, dpr: number, cornerRadius: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width / dpr;
  const H = canvas.height / dpr;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 6;
  drawRoundedRect(ctx, 3, 3, W - 6, H - 6, cornerRadius);
  ctx.stroke();
  ctx.restore();
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
