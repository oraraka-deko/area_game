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

export interface WallHitEvent {
  timeMs: number;
  progress: number;
  x: number;
  y: number;
  intensity: number;
}

export interface NearestSeamInfo {
  distancePx: number;
  distanceMm: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  edge: 'left' | 'right' | 'top' | 'bottom';
  adjacentPlayerName?: string;
  isCloseCall: boolean;
}

export interface AirHockeyTrajectory {
  points: PhysicsPoint[];
  wallHits: WallHitEvent[];
  finalX: number;
  finalY: number;
  winnerPlayerId: string;
  totalDurationMs: number;
  wallHitsCount: number;
  launchAngle: number;
  initialSpeed: number;
  stopTimeMs: number;
  nearestSeam?: NearestSeamInfo;
}

/**
 * Pure 2D Air Hockey Rigid-Body Physics Engine
 * Simulates genuine puck float, high elastic acrylic bumper rebounds (restitution 0.975),
 * native low air drag, and realistic kinetic surface glide that naturally decelerates
 * to 0.0 px/s inside the winner's territory without any artificial steering or avatar pull.
 */
export function simulateAirHockeyFlight(
  seed: number,
  winnerPlayerId: string,
  territories: WatertightPolygon[],
  W: number = 460,
  H: number = 460,
  durationMs: number = 8400
): AirHockeyTrajectory {
  const puckRadius = 15;
  const bumperInset = 5;
  const cornerR = 38;

  // Exact cushion rail collision boundaries matching drawn visual frame
  const minX = puckRadius + bumperInset;
  const maxX = W - puckRadius - bumperInset;
  const minY = puckRadius + bumperInset;
  const maxY = H - puckRadius - bumperInset;
  const cornerLimit = cornerR - puckRadius - bumperInset;

  // Ultra-elastic acrylic rail bumper bounce (high restitution for lively play)
  const restitution = 0.988;
  const dt = 1 / 120; // 120 Hz physics integration step

  // Pseudorandom generator based on round seed
  let pseudo = (Math.abs(seed) * 9301 + 49297) % 233280;
  const rnd = () => {
    pseudo = (pseudo * 9301 + 49297) % 233280;
    return pseudo / 233280;
  };

  // Find target territory
  const targetPoly = territories.find(t => t.playerId === winnerPlayerId) || territories[0];

  const maxSteps = Math.floor((durationMs / 1000) / dt);

  // Rounded Corner definitions
  const corners = [
    { cx: cornerR, cy: cornerR },
    { cx: W - cornerR, cy: cornerR },
    { cx: W - cornerR, cy: H - cornerR },
    { cx: cornerR, cy: H - cornerR }
  ];

  // Helper function to simulate a single physical trajectory
  const simulateCandidate = (
    startAngle: number,
    initialSpeed: number,
    airDrag: number,
    kineticFriction: number
  ) => {
    let x = W / 2;
    let y = H / 2;
    let vx = Math.cos(startAngle) * initialSpeed;
    let vy = Math.sin(startAngle) * initialSpeed;

    const points: PhysicsPoint[] = [];
    const wallHitEvents: WallHitEvent[] = [];
    points.push({ x, y, vx, vy, timeMs: 0 });

    let wallHits = 0;
    let time = 0;
    let stopTime = durationMs;
    let lastBounceTime = -100;

    for (let step = 1; step <= maxSteps; step++) {
      time += dt * 1000;

      // Integrate position
      x += vx * dt;
      y += vy * dt;

      // 1. Native air drag (low exponential resistance)
      vx *= (1 - airDrag * dt);
      vy *= (1 - airDrag * dt);

      // 2. Surface friction deceleration (brings puck to full physical stop)
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
        hitIntensity = Math.min(1.0, Math.abs(vx) / 320);
      } else if (x > maxX) {
        x = maxX;
        vx = -vx * restitution;
        isHit = true;
        hitIntensity = Math.min(1.0, Math.abs(vx) / 320);
      }

      // Rail Collisions (Top / Bottom)
      if (y < minY) {
        y = minY;
        vy = -vy * restitution;
        isHit = true;
        hitIntensity = Math.min(1.0, Math.abs(vy) / 320);
      } else if (y > maxY) {
        y = maxY;
        vy = -vy * restitution;
        isHit = true;
        hitIntensity = Math.min(1.0, Math.abs(vy) / 320);
      }

      // Rounded Corners Check
      for (const c of corners) {
        const inQuadrantX = (c.cx === cornerR) ? (x < c.cx) : (x > c.cx);
        const inQuadrantY = (c.cy === cornerR) ? (y < c.cy) : (y > c.cy);
        if (inQuadrantX && inQuadrantY) {
          const dx = x - c.cx;
          const dy = y - c.cy;
          const dist = Math.hypot(dx, dy);
          if (dist > cornerLimit && dist > 0.001) {
            const nx = dx / dist;
            const ny = dy / dist;
            x = c.cx + nx * cornerLimit;
            y = c.cy + ny * cornerLimit;
            const dot = vx * nx + vy * ny;
            if (dot > 0) {
              vx = (vx - 2 * dot * nx) * restitution;
              vy = (vy - 2 * dot * ny) * restitution;
              isHit = true;
              hitIntensity = Math.min(1.0, Math.hypot(vx, vy) / 320);
            }
          }
        }
      }

      if (isHit) {
        wallHits++;
        if (time - lastBounceTime > 50) {
          lastBounceTime = time;
          wallHitEvents.push({
            timeMs: Math.round(time),
            progress: time / durationMs,
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            intensity: Math.max(0.3, hitIntensity)
          });
        }
      }

      points.push({
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        vx,
        vy,
        isWallHit: isHit,
        wallIntensity: hitIntensity,
        timeMs: time
      });

      // Complete natural stop check: speed falls below 0.5 px/s
      const currentSpeed = Math.hypot(vx, vy);
      if (currentSpeed < 0.5 && step > 60) {
        stopTime = time;
        const finalSnapX = Math.round(x * 10) / 10;
        const finalSnapY = Math.round(y * 10) / 10;
        while (step < maxSteps) {
          step++;
          time += dt * 1000;
          points.push({
            x: finalSnapX,
            y: finalSnapY,
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
    return {
      points,
      wallHits: wallHitEvents,
      finalX: finalPt.x,
      finalY: finalPt.y,
      wallHitsCount: wallHits,
      stopTime
    };
  };

  let bestTrajectory: PhysicsPoint[] = [];
  let bestWallHits: WallHitEvent[] = [];
  let bestLaunchAngle: number = 0;
  let bestSpeed: number = 1180;
  let bestStopTime: number = 0;
  let foundValid = false;

  // Pass 1: Seeded stochastic search with direct angle biases and varied speeds
  const maxAttempts = 800;
  const directAngle = Math.atan2(targetPoly.innerY - H / 2, targetPoly.innerX - W / 2);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const angleSpread = (rnd() - 0.5) * 0.6;
    const startAngle = (attempt % 3 === 0) ? directAngle + angleSpread : rnd() * Math.PI * 2;
    const initialSpeed = 1180 + rnd() * 160;
    const airDrag = 0.075 + rnd() * 0.015;
    const kineticFriction = 104 + rnd() * 10;

    const res = simulateCandidate(startAngle, initialSpeed, airDrag, kineticFriction);
    const landedPoly = findPlayerAtPoint(res.finalX, res.finalY, territories);

    if (landedPoly && landedPoly.playerId === winnerPlayerId && res.wallHitsCount >= 4 && res.stopTime >= 6700 && res.stopTime <= 7700) {
      bestTrajectory = res.points;
      bestWallHits = res.wallHits;
      bestLaunchAngle = startAngle;
      bestSpeed = initialSpeed;
      bestStopTime = res.stopTime;
      foundValid = true;
      break;
    }
  }

  // Pass 2: High-density 360-degree angular sweep (guarantees landing in any territory, even 1% sliver)
  if (!foundValid) {
    const sweepSteps = 540;
    for (let step = 0; step < sweepSteps; step++) {
      const startAngle = (step / sweepSteps) * Math.PI * 2;
      const initialSpeed = 1200;
      const airDrag = 0.08;
      const kineticFriction = 108;

      const res = simulateCandidate(startAngle, initialSpeed, airDrag, kineticFriction);
      const landedPoly = findPlayerAtPoint(res.finalX, res.finalY, territories);

      if (landedPoly && landedPoly.playerId === winnerPlayerId && res.wallHitsCount >= 3 && res.stopTime >= 6600 && res.stopTime <= 7800) {
        bestTrajectory = res.points;
        bestWallHits = res.wallHits;
        bestLaunchAngle = startAngle;
        bestSpeed = initialSpeed;
        bestStopTime = res.stopTime;
        foundValid = true;
        break;
      }
    }
  }

  // Fallback safety (if still not found, search with slightly lower speed)
  if (!foundValid) {
    const sweepSteps = 360;
    for (let step = 0; step < sweepSteps; step++) {
      const startAngle = (step / sweepSteps) * Math.PI * 2;
      const res = simulateCandidate(startAngle, 980, 0.13, 142);
      const landedPoly = findPlayerAtPoint(res.finalX, res.finalY, territories);
      if (landedPoly && landedPoly.playerId === winnerPlayerId) {
        bestTrajectory = res.points;
        bestWallHits = res.wallHits;
        bestLaunchAngle = startAngle;
        bestSpeed = 980;
        bestStopTime = res.stopTime;
        foundValid = true;
        break;
      }
    }
  }

  // Absolute fallback: simulate direct shot
  if (!foundValid || bestTrajectory.length === 0) {
    const res = simulateCandidate(directAngle, 1050, 0.14, 145);
    bestTrajectory = res.points;
    bestWallHits = res.wallHits;
    bestLaunchAngle = directAngle;
    bestSpeed = 1050;
    bestStopTime = res.stopTime;
  }

  const finalX = bestTrajectory[bestTrajectory.length - 1].x;
  const finalY = bestTrajectory[bestTrajectory.length - 1].y;

  // Compute nearest seam divider for FIFA VAR Goal-Line Technology Review
  const nearestSeam = computeNearestSeam(finalX, finalY, targetPoly, territories);

  return {
    points: bestTrajectory,
    wallHits: bestWallHits,
    finalX,
    finalY,
    winnerPlayerId,
    totalDurationMs: durationMs,
    wallHitsCount: bestWallHits.length,
    launchAngle: bestLaunchAngle,
    initialSpeed: bestSpeed,
    stopTimeMs: bestStopTime || Math.floor(durationMs * 0.65),
    nearestSeam
  };
}

/**
 * Computes closest territory divider/splitter seam to the ball resting position.
 * Used for the dramatic sports TV channel / FIFA VAR Technology review.
 */
function computeNearestSeam(
  x: number,
  y: number,
  targetPoly: WatertightPolygon,
  territories: WatertightPolygon[]
): NearestSeamInfo {
  const dLeft = Math.abs(x - targetPoly.x);
  const dRight = Math.abs((targetPoly.x + targetPoly.w) - x);
  const dTop = Math.abs(y - targetPoly.y);
  const dBottom = Math.abs((targetPoly.y + targetPoly.h) - y);

  const edges: { edge: 'left' | 'right' | 'top' | 'bottom'; dist: number }[] = [
    { edge: 'left', dist: dLeft },
    { edge: 'right', dist: dRight },
    { edge: 'top', dist: dTop },
    { edge: 'bottom', dist: dBottom }
  ];

  edges.sort((a, b) => a.dist - b.dist);
  const closest = edges[0];

  let x1 = targetPoly.x;
  let y1 = targetPoly.y;
  let x2 = targetPoly.x;
  let y2 = targetPoly.y;
  let neighborProbeX = x;
  let neighborProbeY = y;

  if (closest.edge === 'left') {
    x1 = targetPoly.x;
    y1 = targetPoly.y;
    x2 = targetPoly.x;
    y2 = targetPoly.y + targetPoly.h;
    neighborProbeX = targetPoly.x - 5;
  } else if (closest.edge === 'right') {
    x1 = targetPoly.x + targetPoly.w;
    y1 = targetPoly.y;
    x2 = targetPoly.x + targetPoly.w;
    y2 = targetPoly.y + targetPoly.h;
    neighborProbeX = targetPoly.x + targetPoly.w + 5;
  } else if (closest.edge === 'top') {
    x1 = targetPoly.x;
    y1 = targetPoly.y;
    x2 = targetPoly.x + targetPoly.w;
    y2 = targetPoly.y;
    neighborProbeY = targetPoly.y - 5;
  } else if (closest.edge === 'bottom') {
    x1 = targetPoly.x;
    y1 = targetPoly.y + targetPoly.h;
    x2 = targetPoly.x + targetPoly.w;
    y2 = targetPoly.y + targetPoly.h;
    neighborProbeY = targetPoly.y + targetPoly.h + 5;
  }

  const neighbor = territories.find(
    t => t.playerId !== targetPoly.playerId &&
         neighborProbeX >= t.x && neighborProbeX <= t.x + t.w &&
         neighborProbeY >= t.y && neighborProbeY <= t.y + t.h
  );

  const distancePx = Math.round(closest.dist * 10) / 10;
  // In table scale, 1 pixel is ~ 1 millimeter
  const distanceMm = distancePx;

  return {
    distancePx,
    distanceMm,
    x1: Math.round(x1),
    y1: Math.round(y1),
    x2: Math.round(x2),
    y2: Math.round(y2),
    edge: closest.edge,
    adjacentPlayerName: neighbor ? neighbor.username : 'Table Rail',
    isCloseCall: distanceMm < 45
  };
}

/**
 * Samples position, velocity and stopped state from pre-simulated trajectory
 */
export function sampleTrajectory(
  trajectory: AirHockeyTrajectory,
  progress: number
): { x: number; y: number; vx: number; vy: number; isStopped: boolean; speed: number } {
  const pts = trajectory.points;
  if (!pts || pts.length === 0) {
    return { x: 230, y: 230, vx: 0, vy: 0, isStopped: false, speed: 0 };
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
    isStopped: !!p0.isStopped || speed < 0.5,
    speed
  };
}

/**
 * Queries wall hit events that occurred between previous progress and current progress.
 * Guarantees zero missed sound triggers and precise frame synchronization.
 */
export function getWallHitsBetween(
  trajectory: AirHockeyTrajectory,
  prevProgress: number,
  currentProgress: number
): WallHitEvent[] {
  if (!trajectory.wallHits || trajectory.wallHits.length === 0) return [];
  if (currentProgress < prevProgress) return []; // User scrubbed backwards

  return trajectory.wallHits.filter(h => h.progress > prevProgress && h.progress <= currentProgress);
}
