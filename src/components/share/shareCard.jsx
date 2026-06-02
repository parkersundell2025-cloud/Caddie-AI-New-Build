import { APP_STORE_URL } from '@/lib/shareConfig';

/**
 * generateRoundShareCard — renders a 1080x1920 canvas for a round achievement.
 * Returns a Blob (PNG).
 */
export async function generateRoundShareCard({ score, courseName, firstName, handicap, handicapImproved, streakDays, date }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0d1f16';
  ctx.fillRect(0, 0, 1080, 1920);

  // Subtle grass texture overlay
  drawGrassTexture(ctx, 1080, 1920);

  // Top — Wordmark
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Caddie AI', 540, 140);

  // Thin divider under wordmark
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(200, 170);
  ctx.lineTo(880, 170);
  ctx.stroke();

  // Hero score
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 320px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(score), 540, 740);

  // Course name (if provided)
  let heroBottom = 760;
  if (courseName) {
    ctx.fillStyle = '#a8d5a2';
    ctx.font = '400 48px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(courseName, 540, 830);
    heroBottom = 850;
  }

  // "Shot by [Name]"
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'italic 400 44px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Shot by ${firstName}`, 540, heroBottom + 70);

  // Stats section
  let statsY = heroBottom + 200;

  // Handicap
  if (handicap != null) {
    const arrow = handicapImproved ? ' ↓' : '';
    const hcpText = `Handicap: ${handicap}${arrow}`;
    ctx.fillStyle = handicapImproved ? '#a8d5a2' : 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 50px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(hcpText, 540, statsY);
    statsY += 80;
  }

  // Streak (only if >= 3)
  if (streakDays >= 3) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '400 42px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${streakDays} day streak 🔥`, 540, statsY);
    statsY += 70;
  }

  // Date
  if (date) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '400 36px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(date, 540, statsY);
  }

  // Bottom divider
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(200, 1720);
  ctx.lineTo(880, 1720);
  ctx.stroke();

  // Tagline
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '400 36px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Improve your game with AI coaching', 540, 1790);

  // App Store URL
  ctx.fillStyle = '#a8d5a2';
  ctx.font = '400 30px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(APP_STORE_URL, 540, 1840);

  return canvasToBlob(canvas);
}

/**
 * generateSessionShareCard — renders a 1080x1920 canvas for a session achievement.
 * Returns a Blob (PNG).
 */
export async function generateSessionShareCard({ sessionType, duration, drillCount, firstName, streakDays, date, improvingSkill }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0d1f16';
  ctx.fillRect(0, 0, 1080, 1920);

  drawGrassTexture(ctx, 1080, 1920);

  // Top — Wordmark
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Caddie AI', 540, 140);

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(200, 170);
  ctx.lineTo(880, 170);
  ctx.stroke();

  // Hero — session type
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 120px Georgia, serif';
  ctx.textAlign = 'center';

  // Handle long session type names
  const lines = wrapText(ctx, sessionType, 900);
  const lineHeight = 140;
  const startY = lines.length === 1 ? 620 : 580;
  lines.forEach((line, i) => {
    ctx.fillText(line, 540, startY + i * lineHeight);
  });

  const heroBottom = startY + lines.length * lineHeight;

  // Stats sub-line
  const statsLine = [duration ? `${duration} MIN` : null, drillCount ? `${drillCount} DRILLS` : null].filter(Boolean).join(' · ');
  if (statsLine) {
    ctx.fillStyle = '#a8d5a2';
    ctx.font = '400 48px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(statsLine, 540, heroBottom + 60);
  }

  // "Completed by [Name]"
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'italic 400 44px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Completed by ${firstName}`, 540, heroBottom + 160);

  // Stats
  let sY = heroBottom + 300;

  if (improvingSkill) {
    ctx.fillStyle = '#a8d5a2';
    ctx.font = 'bold 50px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${improvingSkill}: Improving ↑`, 540, sY);
    sY += 80;
  }

  if (streakDays >= 3) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '400 42px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${streakDays} day streak 🔥`, 540, sY);
    sY += 70;
  }

  if (date) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '400 36px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(date, 540, sY);
  }

  // Bottom
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(200, 1720);
  ctx.lineTo(880, 1720);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '400 36px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Improve your game with AI coaching', 540, 1790);

  ctx.fillStyle = '#a8d5a2';
  ctx.font = '400 30px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(APP_STORE_URL, 540, 1840);

  return canvasToBlob(canvas);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function drawGrassTexture(ctx, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const len = 20 + Math.random() * 40;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    ctx.strokeStyle = '#a8d5a2';
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}

/**
 * shareImageBlob — opens the native iOS share sheet with the PNG image.
 */
export async function shareImageBlob(blob, filename = 'caddie-ai-achievement.png') {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: 'My Caddie AI Achievement',
    });
  } else if (navigator.share) {
    // Fallback: share without files
    await navigator.share({ title: 'My Caddie AI Achievement', url: APP_STORE_URL });
  } else {
    // Last resort: download the image
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}