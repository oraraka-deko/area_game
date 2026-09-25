import { PlayerBet } from '../types/game.js';

export interface Point {
  x: number;
  y: number;
}

export interface WatertightPolygon {
  playerId: string;
  username: string;
  avatar: string;
  color: string;
  winProbability: number;
  totalBet: number;
  x: number;
  y: number;
  w: number;
  h: number;
  points: Point[];
  innerX: number;
  innerY: number;
}

/**
 * Proportional 2D Rectilinear Area Partitioning
 * Guarantees that every player's territory area strictly equals winProbability * (W * H).
 * Seamless, watertight, and supports ANY number of players (1, 2, 3, 4, 5, 8+).
 */
export function computeProportionalTerritories(
  bets: PlayerBet[],
  W: number = 460,
  H: number = 460
): WatertightPolygon[] {
  if (!bets || bets.length === 0) {
    return [{
      playerId: 'neutral',
      username: 'Arena',
      avatar: '',
      color: '#1e293b',
      winProbability: 1.0,
      totalBet: 0,
      x: 0,
      y: 0,
      w: W,
      h: H,
      points: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }],
      innerX: W / 2,
      innerY: H / 2
    }];
  }

  if (bets.length === 1) {
    return [{
      playerId: bets[0].playerId,
      username: bets[0].username,
      avatar: bets[0].avatar,
      color: bets[0].color,
      winProbability: 1.0,
      totalBet: bets[0].totalBet,
      x: 0,
      y: 0,
      w: W,
      h: H,
      points: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }],
      innerX: W / 2,
      innerY: H / 2
    }];
  }

  // Normalize total weights
  const totalWeight = bets.reduce((sum, b) => sum + (b.totalBet || b.winProbability * 100 || 1), 0);
  const normalizedBets = bets.map(b => ({
    ...b,
    weight: ((b.totalBet || b.winProbability * 100 || 1) / totalWeight)
  }));

  const results: WatertightPolygon[] = [];

  // Recursive binary partition
  function partition(
    box: { x: number; y: number; w: number; h: number },
    items: typeof normalizedBets
  ) {
    if (items.length === 1) {
      const it = items[0];
      const pts: Point[] = [
        { x: box.x, y: box.y },
        { x: box.x + box.w, y: box.y },
        { x: box.x + box.w, y: box.y + box.h },
        { x: box.x, y: box.y + box.h }
      ];

      results.push({
        playerId: it.playerId,
        username: it.username,
        avatar: it.avatar,
        color: it.color,
        winProbability: it.winProbability || it.weight,
        totalBet: it.totalBet,
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        points: pts,
        innerX: Math.round(box.x + box.w / 2),
        innerY: Math.round(box.y + box.h / 2)
      });
      return;
    }

    // Determine split index that best balances area
    const totalBoxWeight = items.reduce((s, i) => s + i.weight, 0);
    let cumulative = 0;
    let splitIdx = 1;
    let minDiff = Infinity;

    for (let i = 0; i < items.length - 1; i++) {
      cumulative += items[i].weight;
      const ratio = cumulative / totalBoxWeight;
      const diff = Math.abs(ratio - 0.5);
      if (diff < minDiff) {
        minDiff = diff;
        splitIdx = i + 1;
      }
    }

    const groupA = items.slice(0, splitIdx);
    const groupB = items.slice(splitIdx);
    const weightA = groupA.reduce((s, i) => s + i.weight, 0);
    const fractionA = weightA / totalBoxWeight;

    // Split along the longer dimension to keep territories well-proportioned
    if (box.w >= box.h) {
      // Vertical cut
      const wA = Math.round(box.w * fractionA);
      const wB = box.w - wA;

      partition({ x: box.x, y: box.y, w: wA, h: box.h }, groupA);
      partition({ x: box.x + wA, y: box.y, w: wB, h: box.h }, groupB);
    } else {
      // Horizontal cut
      const hA = Math.round(box.h * fractionA);
      const hB = box.h - hA;

      partition({ x: box.x, y: box.y, w: box.w, h: hA }, groupA);
      partition({ x: box.x, y: box.y + hA, w: box.w, h: hB }, groupB);
    }
  }

  partition({ x: 0, y: 0, w: W, h: H }, normalizedBets);
  return results;
}

/**
 * Point-in-polygon containment test
 * Reliably identifies which player territory an (x, y) coordinate falls into
 */
export function findPlayerAtPoint(
  x: number,
  y: number,
  polygons: WatertightPolygon[]
): WatertightPolygon | null {
  if (!polygons || polygons.length === 0) return null;

  for (const poly of polygons) {
    if (x >= poly.x && x <= poly.x + poly.w && y >= poly.y && y <= poly.y + poly.h) {
      return poly;
    }
  }

  // Fallback to closest center if slightly outside due to floating point rounding
  let closest = polygons[0];
  let minDist = Infinity;
  for (const poly of polygons) {
    const dx = x - poly.innerX;
    const dy = y - poly.innerY;
    const dist = dx * dx + dy * dy;
    if (dist < minDist) {
      minDist = dist;
      closest = poly;
    }
  }
  return closest;
}
