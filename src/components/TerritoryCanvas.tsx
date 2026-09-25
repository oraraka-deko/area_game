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
    trail: []
  });

  const particlesRef = useRef<Particle[]>([]);

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

      // Compute pure 2D air hockey trajectory
      const traj = simulateAirHockeyFlight(
        roundState.roundId,
        winnerId,
        territories,
        W,
        H,
        roundState.resolutionDurationMs || 7500
      );

      flightTrajectoryRef.current = traj;
      puck.active = true;
      puck.startTime = performance.now();
      puck.duration = roundState.resolutionDurationMs || 7500;
      puck.x = W / 2;
      puck.y = H / 2;
      puck.finalX = traj.finalX;
      puck.finalY = traj.finalY;
      puck.zoom = 1.0;
      puck.shockwaveActive = false;
      puck.trail = [];

      // Initial powerful puck strike
      sound.playPuckWallHit(0.95);

    } else if (roundState.status === 'WINNER_CELEBRATION') {
      puck.active = true;
      puck.x = puck.finalX;
      puck.y = puck.finalY;
      puck.zoom = 2.4;
      puck.shockwaveActive = true;
      puck.shockwaveRadius = 5;

    } else {
      // WAITING_FOR_PLAYERS or BETTING_OPEN:
      // ZERO random movement! The ball rests peacefully at center ice!
      flightTrajectoryRef.current = null;
      puck.active = false; // Not active in flight
      puck.x = W / 2;
      puck.y = H / 2;
      puck.zoom = 1.0;
      puck.shockwaveActive = false;
      puck.trail = [];
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
      if (puck.active && roundState.status === 'ROUND_RESOLVING' && flightTrajectoryRef.current) {
        const elapsed = now - puck.startTime;
        const progress = Math.min(1.0, elapsed / puck.duration);

        // Sample exact physics point
        const sample = sampleTrajectory(flightTrajectoryRef.current, progress);
        puck.x = sample.x;
        puck.y = sample.y;

        // Play sound on rail bounce
        if (sample.isWallHit && now - puck.lastWallSoundTime > 90) {
          puck.lastWallSoundTime = now;
          sound.playPuckWallHit(sample.wallIntensity);
        }

        // Add trail point
        puck.trail.push({ x: sample.x, y: sample.y });
        if (puck.trail.length > 22) puck.trail.shift();

        // Spawn particles
        if (progress < 0.96 && Math.random() < 0.6) {
          particlesRef.current.push({
            x: sample.x,
            y: sample.y,
            vx: (Math.random() - 0.5) * 35,
            vy: (Math.random() - 0.5) * 35,
            alpha: 0.8,
            size: 2 + Math.random() * 2,
            color: '#ccff00'
          });
        }

        // Camera zoom: Smooth transition in final 25% of travel (progress > 0.75)
        if (progress > 0.75) {
          const zoomProg = (progress - 0.75) / 0.25;
          const easeZoom = zoomProg * zoomProg * (3 - 2 * zoomProg);
          puck.zoom = 1.0 + easeZoom * 2.2;
        } else {
          puck.zoom = 1.0;
        }
      }

      // Camera Matrix Calculation
      const zoom = puck.zoom;
      let camX = W / 2;
      let camY = H / 2;

      if ((puck.active || roundState.status === 'WINNER_CELEBRATION') && zoom > 1.05) {
        camX = puck.x;
        camY = puck.y;
      }

      // Clip table to rounded rectangle
      ctx.save();
      drawRoundedRect(ctx, 0, 0, W, H, cornerRadius);
      ctx.clip();

      // Apply Camera Viewport Matrix
      ctx.translate(W / 2, H / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-camX, -camY);

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
            <p className="text-white font-bold text-sm">Place a bet to slice your territory!</p>
            <p className="text-white/50 text-xs mt-0.5 font-mono">Min 2 players needed to start 20s round</p>
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
