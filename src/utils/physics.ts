import { WatertightPolygon, findPlayerAtPoint } from './slicing.js';

export interface PhysicsPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isWallHit?: boolean;
  wallIntensity?: number;
  timeMs: number;
  isStopped?: boolean;
}

export interface AirHockeyTrajectory {
  points: PhysicsPoint[];
  finalX: number;
  finalY: number;
  winnerPlayerId: string;
  totalDurationMs: number;
  wallHitsCount: number;
  launchAngle: number;
  initialSpeed: number;
  stopTimeMs: number;
}

/**
 * Pure 2D Air Hockey Rigid-Body Physics Engine
 * Simulates genuine puck launch, air drag, elastic rail rebounds, and kinetic surface friction.
 * The puck smoothly decelerates and comes to a full, natural stop before celebration.
 */
export function simulateAirHockeyFlight(
  seed: number,
  winnerPlayerId: string,
  territories: WatertightPolygon[],
  W: number = 460,
  H: number = 460,
  durationMs: number = 8400
): AirHockeyTrajectory {
  const puckRadius = 16;
  const cornerR = 38;
  const minX = cornerR / 2 + puckRadius;
  const maxX = W - cornerR / 2 - puckRadius;
  const minY = cornerR / 2 + puckRadius;
  const maxY = H - cornerR / 2 - puckRadius;
  const restitution = 0.93; // Elastic acrylic rail bumper bounce
  const dt = 1 / 120; // 120 Hz physics step for smooth collision integration

  // Pseudorandom generator based on seed
  let pseudo = (seed * 9301 + 49297) % 233280;
  const rnd = () => {
    pseudo = (pseudo * 9301 + 49297) % 233280;
    return pseudo / 233280;
  };

  // Find target territory
  const targetPoly = territories.find(t => t.playerId === winnerPlayerId) || territories[0];

  let bestTrajectory: PhysicsPoint[] = [];
  let bestLaunchAngle: number = 0;
  let bestSpeed: number = 1200;
  let bestStopTime: number = 0;
  let foundValid = false;

  const maxAttempts = 350;
  let closestTrajectory: PhysicsPoint[] = [];
  let closestDist = Infinity;
  let closestLaunchAngle = 0;
  let closestSpeed = 1200;
  let closestStopTime = 0;

  const maxSteps = Math.floor((durationMs / 1000) / dt);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const angleSpread = (rnd() - 0.5) * 0.45;
    const directAngle = Math.atan2(targetPoly.innerY - H / 2, targetPoly.innerX - W / 2);
    // Periodically bias angle toward target sector to quickly find valid natural bounce combinations
    const startAngle = (attempt % 4 === 0) ? directAngle + angleSpread : rnd() * Math.PI * 2;

    // Calibrated natural launch speed (1120 to 1320 px/s)
    const initialSpeed = 1120 + rnd() * 200;
    // Air drag (high speed decay)
    const drag = 0.33 + rnd() * 0.04;
    // Kinetic surface friction (brings puck to a definitive halt)
    const kineticFriction = 55 + rnd() * 12;

    let x = W / 2;
    let y = H / 2;
    let vx = Math.cos(startAngle) * initialSpeed;
    let vy = Math.sin(startAngle) * initialSpeed;

    const points: PhysicsPoint[] = [];
    points.push({ x, y, vx, vy, timeMs: 0 });

    let wallHits = 0;
    let time = 0;
    let stopTime = durationMs;

    for (let step = 1; step <= maxSteps; step++) {
      time += dt * 1000;

      // Integrate position
      x += vx * dt;
      y += vy * dt;

      // 1. Air drag (exponential decay)
      vx *= (1 - drag * dt);
      vy *= (1 - drag * dt);

      // 2. Surface friction (linear deceleration to zero)
      const speed = Math.hypot(vx, vy);
      if (speed > 0) {
        const decel = kineticFriction * dt;
        const newSpeed = Math.max(0, speed - decel);
        const factor = newSpeed / speed;
        vx *= factor;
        vy *= factor;
      }

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
          const dist = Math.hypot(dx, dy);
          const limit = cornerR - puckRadius;
          if (dist > limit && dist > 0.001) {
            const nx = dx / dist;
            const ny = dy / dist;
            x = c.cx + nx * limit;
            y = c.cy + ny * limit;
            const dot = vx * nx + vy * ny;
            if (dot > 0) {
              vx = (vx - 2 * dot * nx) * restitution;
              vy = (vy - 2 * dot * ny) * restitution;
              isHit = true;
              hitIntensity = Math.min(1.0, Math.hypot(vx, vy) / 300);
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

      // Complete natural stop check
      const currentSpeed = Math.hypot(vx, vy);
      if (currentSpeed < 1.0 && step > 60) {
        stopTime = time;
        while (step < maxSteps) {
          step++;
          time += dt * 1000;
          points.push({
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            vx: 0,
            vy: 0,
            timeMs: time,
            isStopped: true
          });
        }
        break;
      }
    }

    const finalPt = points[points.length - 1];
    const landedPoly = findPlayerAtPoint(finalPt.x, finalPt.y, territories);

    // Ensure ball landed in winner territory, bounced at least 3 times, and stopped with ample resting time
    if (landedPoly && landedPoly.playerId === winnerPlayerId && wallHits >= 3 && stopTime < durationMs - 1800) {
      bestTrajectory = points;
      bestLaunchAngle = startAngle;
      bestSpeed = initialSpeed;
      bestStopTime = stopTime;
      foundValid = true;
      break;
    }

    // Track candidate that naturally stops closest to winner's territory
    const distToCenter = Math.hypot(finalPt.x - targetPoly.innerX, finalPt.y - targetPoly.innerY);
    if (distToCenter < closestDist) {
      closestDist = distToCenter;
      closestTrajectory = points;
      closestLaunchAngle = startAngle;
      closestSpeed = initialSpeed;
      closestStopTime = stopTime;
    }
  }

  if (!foundValid && closestTrajectory.length > 0) {
    bestTrajectory = closestTrajectory;
    bestLaunchAngle = closestLaunchAngle;
    bestSpeed = closestSpeed;
    bestStopTime = closestStopTime;
  }

  const finalX = bestTrajectory[bestTrajectory.length - 1].x;
  const finalY = bestTrajectory[bestTrajectory.length - 1].y;

  return {
    points: bestTrajectory,
    finalX,
    finalY,
    winnerPlayerId,
    totalDurationMs: durationMs,
    wallHitsCount: bestTrajectory.filter(p => p.isWallHit).length,
    launchAngle: bestLaunchAngle,
    initialSpeed: bestSpeed,
    stopTimeMs: bestStopTime || Math.floor(durationMs * 0.65)
  };
}

/**
 * Samples position, velocity and wall hit from pre-simulated trajectory
 */
export function sampleTrajectory(
  trajectory: AirHockeyTrajectory,
  progress: number
): { x: number; y: number; vx: number; vy: number; isWallHit: boolean; wallIntensity: number; isStopped: boolean } {
  const pts = trajectory.points;
  if (!pts || pts.length === 0) {
    return { x: 230, y: 230, vx: 0, vy: 0, isWallHit: false, wallIntensity: 0, isStopped: false };
  }

  const clamped = Math.max(0, Math.min(1.0, progress));
  const rawIdx = clamped * (pts.length - 1);
  const idx = Math.min(pts.length - 1, Math.floor(rawIdx));
  const nextIdx = Math.min(pts.length - 1, idx + 1);
  const t = rawIdx - idx;

  const p0 = pts[idx];
  const p1 = pts[nextIdx];

  const vx = p0.vx + (p1.vx - p0.vx) * t;
  const vy = p0.vy + (p1.vy - p0.vy) * t;
  const speed = Math.hypot(vx, vy);

  return {
    x: p0.x + (p1.x - p0.x) * t,
    y: p0.y + (p1.y - p0.y) * t,
    vx,
    vy,
    isWallHit: !!p0.isWallHit && t < 0.25,
    wallIntensity: p0.wallIntensity || 0.5,
    isStopped: !!p0.isStopped || speed < 0.5
  };
}

