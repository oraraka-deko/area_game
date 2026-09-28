import { WatertightPolygon, SeamReviewInfo, findNearestSplitterLine } from './slicing.js';

export interface VarReviewState {
  active: boolean;
  phase: 'idle' | 'aiming' | 'flying' | 'scanning' | 'confirmed';
  progress: number; // 0 to 1
  stopElapsedMs: number;
  seamInfo: SeamReviewInfo | null;
  winnerName: string;
  winnerColor: string;
}

/**
 * Draws the high-energy FIFA Goal-Line / Sports TV VAR review on the arena canvas.
 * Handles both the world-space laser measurement lines on the splitter seam
 * and the broadcast TV Chyron / scorebug HUD overlay.
 */
export function drawSplitterVarWorld(
  ctx: CanvasRenderingContext2D,
  puckX: number,
  puckY: number,
  seamInfo: SeamReviewInfo | null,
  isConfirmed: boolean,
  now: number
) {
  if (!seamInfo || !seamInfo.hasSplitter) return;

  ctx.save();

  // 1. Draw glowing neon laser seam along the divider line
  const laserColor = isConfirmed ? '#ccff00' : '#38bdf8';
  ctx.strokeStyle = laserColor;
  ctx.lineWidth = 3;
  ctx.shadowColor = laserColor;
  ctx.shadowBlur = 12;

  ctx.beginPath();
  if (seamInfo.seamType === 'vertical') {
    ctx.moveTo(seamInfo.seamCoord, seamInfo.seamStart);
    ctx.lineTo(seamInfo.seamCoord, seamInfo.seamEnd);
  } else {
    ctx.moveTo(seamInfo.seamStart, seamInfo.seamCoord);
    ctx.lineTo(seamInfo.seamEnd, seamInfo.seamCoord);
  }
  ctx.stroke();

  // 2. Animated laser sweep beam scanning along the seam
  const sweepFrac = 0.5 + 0.5 * Math.sin(now * 0.008);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (seamInfo.seamType === 'vertical') {
    const sweepY = seamInfo.seamStart + (seamInfo.seamEnd - seamInfo.seamStart) * sweepFrac;
    ctx.arc(seamInfo.seamCoord, sweepY, 4, 0, Math.PI * 2);
  } else {
    const sweepX = seamInfo.seamStart + (seamInfo.seamEnd - seamInfo.seamStart) * sweepFrac;
    ctx.arc(sweepX, seamInfo.seamCoord, 4, 0, Math.PI * 2);
  }
  ctx.fill();

  // 3. Digital measurement caliper line connecting ball to the seam
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (seamInfo.seamType === 'vertical') {
    ctx.moveTo(puckX, puckY);
    ctx.lineTo(seamInfo.seamCoord, puckY);
  } else {
    ctx.moveTo(puckX, puckY);
    ctx.lineTo(puckX, seamInfo.seamCoord);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Distance Callout Badge near measurement line
  const midX = seamInfo.seamType === 'vertical' ? (puckX + seamInfo.seamCoord) / 2 : puckX;
  const midY = seamInfo.seamType === 'vertical' ? puckY : (puckY + seamInfo.seamCoord) / 2;

  ctx.font = 'bold 8px monospace';
  const marginText = `+${seamInfo.distance}px IN`;
  const mtw = ctx.measureText(marginText).width;
  ctx.fillStyle = 'rgba(10, 12, 20, 0.92)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(midX - mtw / 2 - 4, midY - 14, mtw + 8, 13, 4) : ctx.rect(midX - mtw / 2 - 4, midY - 14, mtw + 8, 13);
  ctx.fill();
  ctx.strokeStyle = laserColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = laserColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(marginText, midX, midY - 8);

  ctx.restore();
}

/**
 * Draws the Sports TV Broadcast Scorebug and VAR review graphics in screen coordinates (unzoomed).
 */
export function drawSportsTvScreenOverlay(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  state: {
    status: string;
    isStopped: boolean;
    stopElapsedMs: number;
    winnerName: string;
    winnerColor: string;
    seamInfo: SeamReviewInfo | null;
  },
  now: number
) {
  const { isStopped, stopElapsedMs, winnerName, winnerColor, seamInfo } = state;
  if (!isStopped && stopElapsedMs <= 0) return;

  const isConfirmed = stopElapsedMs >= 1200;

  ctx.save();

  // 1. Top TV Broadcast Header Bar (Scorebug style)
  const barW = Math.min(380, W - 40);
  const barH = 34;
  const barX = (W - barW) / 2;
  const barY = 16;

  // Background with carbon gradient
  ctx.fillStyle = 'rgba(8, 10, 18, 0.94)';
  ctx.strokeStyle = isConfirmed ? 'rgba(204, 255, 0, 0.8)' : 'rgba(239, 68, 68, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(barX, barY, barW, barH, 10);
  } else {
    ctx.rect(barX, barY, barW, barH);
  }
  ctx.fill();
  ctx.stroke();

  // Live pulsing red recording dot
  const dotPulse = 0.5 + 0.5 * Math.sin(now * 0.01);
  ctx.fillStyle = isConfirmed ? '#ccff00' : `rgba(239, 68, 68, ${0.7 + dotPulse * 0.3})`;
  ctx.beginPath();
  ctx.arc(barX + 18, barY + barH / 2, 5, 0, Math.PI * 2);
  ctx.fill();

  // TV VAR Review Title & Mode
  ctx.font = '900 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isConfirmed ? '#ccff00' : '#ff4444';
  ctx.fillText('VAR REVIEW', barX + 30, barY + barH / 2 - 5);

  ctx.font = '700 9px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText('PHOTO-FINISH // GOAL-LINE TECH', barX + 30, barY + barH / 2 + 6);

  // Status Badge on Right of Bar
  const statusText = isConfirmed ? 'TERRITORY CONFIRMED' : 'CHECKING SEAM...';
  ctx.font = '900 10px sans-serif';
  const stw = ctx.measureText(statusText).width;
  const sBadgeW = stw + 14;
  const sBadgeX = barX + barW - sBadgeW - 8;
  const sBadgeY = barY + 7;

  ctx.fillStyle = isConfirmed ? 'rgba(204, 255, 0, 0.2)' : 'rgba(239, 68, 68, 0.2)';
  ctx.strokeStyle = isConfirmed ? '#ccff00' : '#ef4444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(sBadgeX, sBadgeY, sBadgeW, 20, 6);
  } else {
    ctx.rect(sBadgeX, sBadgeY, sBadgeW, 20);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isConfirmed ? '#ccff00' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(statusText, sBadgeX + sBadgeW / 2, sBadgeY + 10);

  // 2. Bottom Sports TV Lower-Third Chyron Banner
  if (isConfirmed) {
    const bannerW = Math.min(340, W - 48);
    const bannerH = 46;
    const bannerX = (W - bannerW) / 2;
    const bannerY = H - bannerH - 18;

    ctx.fillStyle = 'rgba(10, 13, 24, 0.95)';
    ctx.strokeStyle = winnerColor || '#ccff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 12);
    } else {
      ctx.rect(bannerX, bannerY, bannerW, bannerH);
    }
    ctx.fill();
    ctx.stroke();

    // Winner team color indicator block
    ctx.fillStyle = winnerColor || '#ccff00';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bannerX + 4, bannerY + 4, 6, bannerH - 8, 3);
    } else {
      ctx.rect(bannerX + 4, bannerY + 4, 6, bannerH - 8);
    }
    ctx.fill();

    // Winner details
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '800 12px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`WINNER: ${winnerName}`, bannerX + 18, bannerY + 16);

    ctx.font = '600 10px monospace';
    ctx.fillStyle = 'rgba(204, 255, 0, 0.9)';
    const marginStr = seamInfo ? `• MARGIN: +${seamInfo.distance}px vs ${seamInfo.rivalUsername}` : '• CLEAR IN BOUNDS';
    ctx.fillText(`DECISION STANDS ${marginStr}`, bannerX + 18, bannerY + 32);
  }

  // 3. High-Tech Corner Viewfinder Brackets
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  const bLen = 14;
  const bInset = 10;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(bInset, bInset + bLen);
  ctx.lineTo(bInset, bInset);
  ctx.lineTo(bInset + bLen, bInset);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(W - bInset - bLen, bInset);
  ctx.lineTo(W - bInset, bInset);
  ctx.lineTo(W - bInset, bInset + bLen);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(bInset, H - bInset - bLen);
  ctx.lineTo(bInset, H - bInset);
  ctx.lineTo(bInset + bLen, H - bInset);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(W - bInset - bLen, H - bInset);
  ctx.lineTo(W - bInset, H - bInset);
  ctx.lineTo(W - bInset, H - bInset - bLen);
  ctx.stroke();

  ctx.restore();
}
