import { WatertightPolygon } from './slicing.js';
import { NearestSeamInfo } from './physics.js';

let cachedDotPattern: CanvasPattern | null = null;

export function getDotPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (cachedDotPattern) return cachedDotPattern;
  if (typeof document === 'undefined') return null;

  const off = document.createElement('canvas');
  off.width = 20;
  off.height = 20;
  const octx = off.getContext('2d');
  if (octx) {
    octx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    octx.beginPath();
    octx.arc(10, 10, 1.2, 0, Math.PI * 2);
    octx.fill();
    cachedDotPattern = ctx.createPattern(off, 'repeat');
  }
  return cachedDotPattern;
}

export function drawRoundedRect(
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

export function drawTerritorySlices(
  ctx: CanvasRenderingContext2D,
  territories: WatertightPolygon[],
  winnerPlayerId: string,
  isCelebrating: boolean,
  activePlayerId: string | null,
  now: number
) {
  const pattern = getDotPattern(ctx);

  territories.forEach(poly => {
    // Fill background color
    ctx.fillStyle = poly.color;
    ctx.fillRect(poly.x, poly.y, poly.w, poly.h);

    // Winner celebration pulse
    if (poly.playerId === winnerPlayerId && isCelebrating) {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.18 + pulse * 0.18})`;
      ctx.fillRect(poly.x, poly.y, poly.w, poly.h);
    } else if (activePlayerId && poly.playerId === activePlayerId) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(poly.x, poly.y, poly.w, poly.h);
    }

    // Micro-dots pattern fill (hardware-accelerated single fill)
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(poly.x, poly.y, poly.w, poly.h);
    }
  });

  // Seam dividers
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

export function drawCenterMarkings(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 58, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawTerritoryBadge(
  ctx: CanvasRenderingContext2D,
  poly: WatertightPolygon,
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

export function drawAirHockeyPuck(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();

  // Radial aura glow
  const aura = ctx.createRadialGradient(x, y, 2, x, y, 36);
  aura.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  aura.addColorStop(0.3, 'rgba(204, 255, 0, 0.75)');
  aura.addColorStop(0.7, 'rgba(14, 165, 233, 0.25)');
  aura.addColorStop(1, 'rgba(14, 165, 233, 0)');

  ctx.beginPath();
  ctx.arc(x, y, 36, 0, Math.PI * 2);
  ctx.fillStyle = aura;
  ctx.fill();

  // Puck core disc
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ccff00';
  ctx.shadowBlur = 20;
  ctx.fill();

  // Inner ring
  ctx.beginPath();
  ctx.arc(x, y, 7.5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(204, 255, 0, 0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

export function drawStationaryPuck(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
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

export function drawAimingArrow(
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

  // Dial ring
  ctx.save();
  ctx.strokeStyle = isLocked ? 'rgba(204, 255, 0, 0.85)' : 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = isLocked ? 2 : 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, dialRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Rotating arrow
  ctx.save();
  ctx.rotate(angle);

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

  ctx.strokeStyle = isLocked ? '#ffffff' : 'rgba(204, 255, 0, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (isLocked) {
    ctx.strokeStyle = 'rgba(204, 255, 0, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, dialRadius + 12, -0.35, 0.35);
    ctx.stroke();
  }

  ctx.restore();

  // Angle badge
  ctx.save();
  ctx.font = 'bold 10px monospace';
  const deg = Math.round((((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * (180 / Math.PI));
  const badgeText = isLocked ? `🎯 ANGLE: ${deg}° (LOCKED)` : `AIMING: ${deg}°`;
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

/**
 * High-Energy Sport TV Channel / FIFA VAR Goal-Line Technology HUD Overlay
 * Renders precision calipers, closest splitter seam laser, millimeter distance check,
 * and dramatic TV broadcast decision banner when camera is zoomed in on settled ball.
 */
export function drawFifaVarHud(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  puckX: number,
  puckY: number,
  nearestSeam: NearestSeamInfo | undefined,
  varProgress: number, // 0.0 to 1.0 (0 = zoom starts, 0.65 = decision confirmed, 1.0 = end)
  winnerName: string,
  winningTicket: number | string | undefined,
  now: number
) {
  const isDecisionConfirmed = varProgress >= 0.60;

  // 1. Draw Seam Laser Divider (if nearest seam is available)
  if (nearestSeam) {
    const { x1, y1, x2, y2, distanceMm, adjacentPlayerName, isCloseCall } = nearestSeam;

    ctx.save();
    // Glowing laser beam on the seam boundary
    const laserColor = isDecisionConfirmed ? '#ccff00' : (isCloseCall ? '#f59e0b' : '#38bdf8');
    ctx.shadowColor = laserColor;
    ctx.shadowBlur = isDecisionConfirmed ? 16 : 8;
    ctx.strokeStyle = laserColor;
    ctx.lineWidth = isDecisionConfirmed ? 3.5 : 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Laser tick perpendicular ruler to ball
    let projX = puckX;
    let projY = puckY;
    if (x1 === x2) {
      // Vertical seam
      projX = x1;
    } else {
      // Horizontal seam
      projY = y1;
    }

    ctx.strokeStyle = isDecisionConfirmed ? 'rgba(204, 255, 0, 0.85)' : 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(puckX, puckY);
    ctx.lineTo(projX, projY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Distance Caliper Ticks at ball & line
    ctx.fillStyle = laserColor;
    ctx.beginPath();
    ctx.arc(projX, projY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Caliper Badge on the measurement line
    const midX = (puckX + projX) / 2;
    const midY = (puckY + projY) / 2;
    const distText = `+${distanceMm.toFixed(1)} mm IN`;
    ctx.font = 'bold 9px monospace';
    const dtw = ctx.measureText(distText).width;
    ctx.fillStyle = 'rgba(10, 12, 20, 0.85)';
    drawRoundedRect(ctx, midX - dtw / 2 - 4, midY - 8, dtw + 8, 16, 4);
    ctx.fill();
    ctx.strokeStyle = laserColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = laserColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(distText, midX, midY);

    ctx.restore();
  }

  // 2. High-Tech Precision Crosshairs Reticle around settled Puck
  ctx.save();
  const reticleColor = isDecisionConfirmed ? '#ccff00' : '#38bdf8';
  ctx.strokeStyle = reticleColor;
  ctx.lineWidth = 1.5;
  const bracketR = 24;
  const bracketLen = 7;

  // 4 Corner Brackets around ball
  // Top-Left
  ctx.beginPath();
  ctx.moveTo(puckX - bracketR, puckY - bracketR + bracketLen);
  ctx.lineTo(puckX - bracketR, puckY - bracketR);
  ctx.lineTo(puckX - bracketR + bracketLen, puckY - bracketR);
  ctx.stroke();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(puckX + bracketR - bracketLen, puckY - bracketR);
  ctx.lineTo(puckX + bracketR, puckY - bracketR);
  ctx.lineTo(puckX + bracketR, puckY - bracketR + bracketLen);
  ctx.stroke();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(puckX - bracketR, puckY + bracketR - bracketLen);
  ctx.lineTo(puckX - bracketR, puckY + bracketR);
  ctx.lineTo(puckX - bracketR + bracketLen, puckY + bracketR);
  ctx.stroke();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(puckX + bracketR - bracketLen, puckY + bracketR);
  ctx.lineTo(puckX + bracketR, puckY + bracketR);
  ctx.lineTo(puckX + bracketR, puckY + bracketR - bracketLen);
  ctx.stroke();

  // Pulsing ring
  const pulse = 0.5 + 0.5 * Math.sin(now * 0.012);
  ctx.strokeStyle = isDecisionConfirmed
    ? `rgba(204, 255, 0, ${0.4 + pulse * 0.4})`
    : `rgba(56, 189, 248, ${0.3 + pulse * 0.3})`;
  ctx.beginPath();
  ctx.arc(puckX, puckY, 20 + pulse * 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Screen-space FIFA / Sport Channel Broadcast Overlay Banner
 * Drawn in fixed canvas screen coordinates (outside camera translate/scale)
 */
export function drawBroadcastTvOverlay(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  varProgress: number,
  winnerName: string,
  winningTicket: number | string | undefined,
  nearestSeam: NearestSeamInfo | undefined,
  now: number
) {
  const isDecisionConfirmed = varProgress >= 0.60;

  ctx.save();

  // 1. Top-left TV Channel VAR Badge
  const badgeX = 14;
  const badgeY = 14;
  ctx.fillStyle = 'rgba(10, 12, 22, 0.9)';
  ctx.strokeStyle = isDecisionConfirmed ? 'rgba(204, 255, 0, 0.7)' : 'rgba(239, 68, 68, 0.8)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, badgeX, badgeY, 155, 26, 8);
  ctx.fill();
  ctx.stroke();

  // Blinking Recording Dot
  const blink = (Math.floor(now / 350) % 2 === 0);
  ctx.fillStyle = isDecisionConfirmed ? '#ccff00' : (blink ? '#ef4444' : '#7f1d1d');
  ctx.beginPath();
  ctx.arc(badgeX + 13, badgeY + 13, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'black 10px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    isDecisionConfirmed ? 'VAR • CONFIRMED' : 'VAR • BALL TRACKING',
    badgeX + 24,
    badgeY + 13
  );

  // 2. High-Tech Sweep Scanline Bar across screen
  if (!isDecisionConfirmed) {
    const sweepY = (now * 0.15) % H;
    const scanGrad = ctx.createLinearGradient(0, sweepY - 15, 0, sweepY + 15);
    scanGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
    scanGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.18)');
    scanGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, sweepY - 15, W, 30);
  }

  // 3. Lower Broadcast Banner (FIFA / EA Sports FC Goal-Line Style)
  const bannerY = H - 52;
  const bannerH = 38;

  if (isDecisionConfirmed) {
    // Flashy Golden-Lime Decision Confirmed Banner
    const bgGrad = ctx.createLinearGradient(16, bannerY, W - 16, bannerY);
    bgGrad.addColorStop(0, 'rgba(12, 16, 26, 0.95)');
    bgGrad.addColorStop(0.3, 'rgba(204, 255, 0, 0.22)');
    bgGrad.addColorStop(0.7, 'rgba(16, 185, 129, 0.22)');
    bgGrad.addColorStop(1, 'rgba(12, 16, 26, 0.95)');

    ctx.fillStyle = bgGrad;
    ctx.strokeStyle = '#ccff00';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#ccff00';
    ctx.shadowBlur = 12;
    drawRoundedRect(ctx, 16, bannerY, W - 32, bannerH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ccff00';
    ctx.font = '900 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`⚡ GOAL-LINE TECH • WINNER: ${winnerName.toUpperCase()}`, W / 2, bannerY + 13);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = 'bold 9px monospace';
    const marginStr = nearestSeam ? ` • +${nearestSeam.distanceMm.toFixed(1)}mm SEAM CLEARANCE` : '';
    ctx.fillText(`IN BOUNDS 100%${marginStr} • TICKET #${winningTicket || 0}`, W / 2, bannerY + 26);
  } else {
    // Analyzing Banner
    ctx.fillStyle = 'rgba(10, 12, 22, 0.92)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 16, bannerY, W - 32, bannerH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📡 OPTICAL BALL TRACKING IN PROGRESS...', W / 2, bannerY + 13);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '9px monospace';
    const adjacentName = nearestSeam?.adjacentPlayerName || 'SEAM';
    const seamText = nearestSeam ? `MEASURING TO ${adjacentName.toUpperCase()} DIVIDER...` : 'MEASURING TABLE DIVIDERS...';
    ctx.fillText(seamText, W / 2, bannerY + 26);
  }

  ctx.restore();
}
