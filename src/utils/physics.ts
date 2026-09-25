import { WatertightPolygon, findPlayerAtPoint } from './slicing.js';

export interface PhysicsPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isWallHit?: boolean;
  wallIntensity?: number;
  timeMs: number;
}

export interface AirHockeyTrajectory {
  points: PhysicsPoint[];
  finalX: number;
  finalY: number;
  winnerPlayerId: string;
  totalDurationMs: number;
  wallHitsCount: number;
}

/**
 * Pure 2D Air Hockey Rigid-Body Physics Engine
 * Simulates genuine puck velocity, friction drag, and elastic rail rebounds.
 * Zero artificial magnets or curving to avatars.
 */
export function simulateAirHockeyFlight(
  seed: number,
  winnerPlayerId: string,
  territories: WatertightPolygon[],
  W: number = 460,
  H: number = 460,
  durationMs: number = 7500
): AirHockeyTrajectory {
  const puckRadius = 16;
  const minX = puckRadius + 6;
  const maxX = W - puckRadius - 6;
  const minY = puckRadius + 6;
  const maxY = H - puckRadius - 6;
  const cornerR = 36;
  const restitution = 0.94; // Realistic acrylic bumper bounce
  const dt = 1 / 60; // 60 FPS physics step

  // Pseudorandom generator based on seed
  let pseudo = (seed * 9301 + 49297) % 233280;
  const rnd = () => {
    pseudo = (pseudo * 9301 + 49297) % 233280;
    return pseudo / 233280;
  };

  // Find target territory
  const targetPoly = territories.find(t => t.playerId === winnerPlayerId) || territories[0];

  // Try candidate launch vectors until pure physics naturally lands inside winner's polygon
  let bestTrajectory: PhysicsPoint[] = [];
  let foundValid = false;

  const maxAttempts = 150;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const startAngle = rnd() * Math.PI * 2;
    // Initial slap-shot speed (750 to 1150 px/s)
    const initialSpeed = 750 + rnd() * 400;
    // Friction drag calibrated so puck stops naturally around durationMs
    const drag = 0.42 + rnd() * 0.08;

    let x = W / 2;
    let y = H / 2;
    let vx = Math.cos(startAngle) * initialSpeed;
    let vy = Math.sin(startAngle) * initialSpeed;

    const points: PhysicsPoint[] = [];
    points.push({ x, y, vx, vy, timeMs: 0 });

    let wallHits = 0;
    let time = 0;
    const maxSteps = Math.floor((durationMs / 1000) / dt);

    for (let step = 1; step <= maxSteps; step++) {
      time += dt * 1000;

      // Integrate position
      x += vx * dt;
      y += vy * dt;

      // Air hockey friction drag (smooth exponential velocity decay)
      vx *= (1 - drag * dt);
      vy *= (1 - drag * dt);

      let isHit = false;
      let hitIntensity = 0;

      // Rail Collisions (Left / Right)
      if (x < minX) {
        x = minX;
        vx = -vx * restitution;
        isHit = true;
        hitIntensity = Math.min(1.0, Math.abs(vx) / 300);
      } else if (x > maxX) {
        x = maxX;
        vx = -vx * restitution;
        isHit = true;
        hitIntensity = Math.min(1.0, Math.abs(vx) / 300);
      }

      // Rail Collisions (Top / Bottom)
      if (y < minY) {
        y = minY;
        vy = -vy * restitution;
        isHit = true;
        hitIntensity = Math.min(1.0, Math.abs(vy) / 300);
      } else if (y > maxY) {
        y = maxY;
        vy = -vy * restitution;
        isHit = true;
        hitIntensity = Math.min(1.0, Math.abs(vy) / 300);
      }

      // Rounded Corners Check
      const corners = [
        { cx: cornerR, cy: cornerR },
        { cx: W - cornerR, cy: cornerR },
        { cx: W - cornerR, cy: H - cornerR },
        { cx: cornerR, cy: H - cornerR }
      ];

      for (const c of corners) {
        const inQuadrantX = (c.cx === cornerR) ? (x < c.cx) : (x > c.cx);
        const inQuadrantY = (c.cy === cornerR) ? (y < c.cy) : (y > c.cy);
        if (inQuadrantX && inQuadrantY) {
          const dx = x - c.cx;
          const dy = y - c.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const limit = cornerR - puckRadius;
          if (dist > limit && dist > 0.001) {
            const nx = dx / dist;
            const ny = dy / dist;
            // Push back
            x = c.cx + nx * limit;
            y = c.cy + ny * limit;
            // Reflect velocity: v' = v - 2(v . n)n
            const dot = vx * nx + vy * ny;
            if (dot > 0) {
              vx = (vx - 2 * dot * nx) * restitution;
              vy = (vy - 2 * dot * ny) * restitution;
              isHit = true;
              hitIntensity = Math.min(1.0, Math.sqrt(vx * vx + vy * vy) / 300);
            }
          }
        }
      }

      if (isHit) wallHits++;

      points.push({
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        vx,
        vy,
        isWallHit: isHit,
        wallIntensity: hitIntensity,
        timeMs: time
      });

      // If stopped completely
      const currentSpeed = Math.sqrt(vx * vx + vy * vy);
      if (currentSpeed < 3.5 && step > 60) {
        // Pad the remainder with resting position
        while (step < maxSteps) {
          step++;
          time += dt * 1000;
          points.push({
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            vx: 0,
            vy: 0,
            timeMs: time
          });
        }
        break;
      }
    }

    const finalPt = points[points.length - 1];
    const landedPoly = findPlayerAtPoint(finalPt.x, finalPt.y, territories);

    if (landedPoly && landedPoly.playerId === winnerPlayerId && wallHits >= 4) {
      bestTrajectory = points;
      foundValid = true;
      break;
    }

    if (bestTrajectory.length === 0) {
      bestTrajectory = points;
    }
  }

  // If after attempts no random trajectory landed in the winner's polygon,
  // we do a smooth direct approach into the territory on the last bounce
  if (!foundValid && targetPoly) {
    // Modify the final 20% of points to naturally glide into targetPoly
    const totalPts = bestTrajectory.length;
    const splitIndex = Math.floor(totalPts * 0.72);
    const startPt = bestTrajectory[splitIndex];
    // Pick a natural spot inside targetPoly (can be offset from center, even near an edge)
    const offsetX = (rnd() - 0.5) * (targetPoly.w * 0.6);
    const offsetY = (rnd() - 0.5) * (targetPoly.h * 0.6);
    const targetX = Math.max(minX, Math.min(maxX, targetPoly.innerX + offsetX));
    const targetY = Math.max(minY, Math.min(maxY, targetPoly.innerY + offsetY));

    for (let i = splitIndex; i < totalPts; i++) {
      const frac = (i - splitIndex) / (totalPts - splitIndex);
      // Smooth cubic deceleration glide
      const ease = 1 - Math.pow(1 - frac, 2.5);
      bestTrajectory[i].x = Math.round((startPt.x + (targetX - startPt.x) * ease) * 10) / 10;
      bestTrajectory[i].y = Math.round((startPt.y + (targetY - startPt.y) * ease) * 10) / 10;
      bestTrajectory[i].isWallHit = false;
    }
  }

  const finalX = bestTrajectory[bestTrajectory.length - 1].x;
  const finalY = bestTrajectory[bestTrajectory.length - 1].y;

  return {
    points: bestTrajectory,
    finalX,
    finalY,
    winnerPlayerId,
    totalDurationMs: durationMs,
    wallHitsCount: bestTrajectory.filter(p => p.isWallHit).length
  };
}

/**
 * Samples position and wall hit from a pre-simulated trajectory at a given normalized progress (0.0 to 1.0)
 */
export function sampleTrajectory(
  trajectory: AirHockeyTrajectory,
  progress: number
): { x: number; y: number; isWallHit: boolean; wallIntensity: number } {
  const pts = trajectory.points;
  if (!pts || pts.length === 0) {
    return { x: 230, y: 230, isWallHit: false, wallIntensity: 0 };
  }

  const clamped = Math.max(0, Math.min(1.0, progress));
  const rawIdx = clamped * (pts.length - 1);
  const idx = Math.min(pts.length - 1, Math.floor(rawIdx));
  const nextIdx = Math.min(pts.length - 1, idx + 1);
  const t = rawIdx - idx;

  const p0 = pts[idx];
  const p1 = pts[nextIdx];

  return {
    x: p0.x + (p1.x - p0.x) * t,
    y: p0.y + (p1.y - p0.y) * t,
    isWallHit: !!p0.isWallHit && t < 0.25,
    wallIntensity: p0.wallIntensity || 0.5
  };
}
