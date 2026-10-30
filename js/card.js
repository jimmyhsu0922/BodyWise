// Draws a summary card (title, one block per key question, takeaway) into a
// PNG image that can be downloaded or shared.
const W = 1080;
const PAD = 64;
const FONT = '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", "Heiti TC", system-ui, -apple-system, "Segoe UI", sans-serif';

// Splits text into lines that fit maxWidth. CJK text may break between any
// two characters; other text breaks between words.
function wrap(ctx, text, maxWidth) {
  const tokens = String(text).match(/[⺀-鿿豈-﫿＀-￯]|[^\s⺀-鿿豈-﫿＀-￯]+|\s+/g) || [];
  const lines = [];
  let line = '';
  for (const tok of tokens) {
    const next = line + tok;
    if (line && ctx.measureText(next.trimEnd()).width > maxWidth) {
      lines.push(line.trimEnd());
      line = /^\s+$/.test(tok) ? '' : tok;
    } else {
      line = next;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mix(hex, amount) {
  // Blend a #rrggbb color toward white by amount (0–1).
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * amount));
  return `rgb(${c.join(',')})`;
}

/**
 * card: { title, subtitle, points: [{ emoji, question, answer }], takeaway }
 * opts: { color, icon, topicName, takeawayLabel, footer, date }
 */
export function drawCard(card, opts) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const inner = W - PAD * 2;
  const color = opts.color || '#e0245e';

  // ---- Measure everything first so the canvas is exactly tall enough.
  ctx.font = `800 60px ${FONT}`;
  const titleLines = wrap(ctx, card.title, inner - 120);
  ctx.font = `400 32px ${FONT}`;
  const subLines = wrap(ctx, card.subtitle, inner);
  const headerH = 72 + titleLines.length * 72 + 16 + subLines.length * 46 + 56;

  const boxPad = 36;
  const textX = 132; // inside a point box, after the number badge
  const points = card.points.map((p) => {
    ctx.font = `700 36px ${FONT}`;
    const q = wrap(ctx, p.question, inner - textX - boxPad);
    ctx.font = `400 31px ${FONT}`;
    const a = wrap(ctx, p.answer, inner - textX - boxPad);
    const h = boxPad * 2 + q.length * 48 + 14 + a.length * 46;
    return { ...p, q, a, h: Math.max(h, 168) };
  });
  ctx.font = `700 36px ${FONT}`;
  const takeLines = wrap(ctx, card.takeaway, inner - boxPad * 2);
  const takeH = boxPad * 2 + 44 + takeLines.length * 50;

  const gap = 28;
  const H = headerH + 48 + points.reduce((s, p) => s + p.h + gap, 0) + takeH + 48 + 90;
  const scale = 1; // 1080px wide is already sharp on phones
  canvas.width = W * scale;
  canvas.height = H * scale;
  ctx.scale(scale, scale);
  ctx.textBaseline = 'top';

  // ---- Background
  ctx.fillStyle = mix(color, 0.92);
  ctx.fillRect(0, 0, W, H);

  // ---- Header
  const grad = ctx.createLinearGradient(0, 0, W, headerH);
  grad.addColorStop(0, color);
  grad.addColorStop(1, mix(color, 0.25));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, headerH);

  let y = 64;
  ctx.font = `400 88px ${FONT}`;
  ctx.fillText(opts.icon || '🫀', W - PAD - 100, y - 4);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(opts.topicName.toUpperCase(), PAD, y - 20);
  y += 20;
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 60px ${FONT}`;
  for (const l of titleLines) { ctx.fillText(l, PAD, y); y += 72; }
  y += 16;
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.font = `400 32px ${FONT}`;
  for (const l of subLines) { ctx.fillText(l, PAD, y); y += 46; }

  // ---- Points
  y = headerH + 48;
  points.forEach((p, i) => {
    ctx.save();
    ctx.shadowColor = 'rgba(20,30,60,.10)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, PAD, y, inner, p.h, 28);
    ctx.fill();
    ctx.restore();

    // Number badge with the point's emoji below it
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(PAD + 64, y + boxPad + 28, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 30px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), PAD + 64, y + boxPad + 12);
    ctx.font = `400 44px ${FONT}`;
    ctx.fillText(p.emoji || '•', PAD + 64, y + boxPad + 72);
    ctx.textAlign = 'left';

    let ty = y + boxPad;
    ctx.fillStyle = '#1b2030';
    ctx.font = `700 36px ${FONT}`;
    for (const l of p.q) { ctx.fillText(l, PAD + textX, ty); ty += 48; }
    ty += 14;
    ctx.fillStyle = '#4a5368';
    ctx.font = `400 31px ${FONT}`;
    for (const l of p.a) { ctx.fillText(l, PAD + textX, ty); ty += 46; }

    y += p.h + gap;
  });

  // ---- Takeaway
  y += 20;
  ctx.fillStyle = color;
  roundRect(ctx, PAD, y, inner, takeH, 28);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText(`💡 ${opts.takeawayLabel}`, PAD + boxPad, y + boxPad);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 36px ${FONT}`;
  let ty = y + boxPad + 52;
  for (const l of takeLines) { ctx.fillText(l, PAD + boxPad, ty); ty += 50; }
  y += takeH;

  // ---- Footer
  ctx.fillStyle = '#7a8397';
  ctx.font = `400 26px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${opts.footer} · ${opts.date}`, W / 2, y + 40);
  ctx.textAlign = 'left';

  return canvas;
}
