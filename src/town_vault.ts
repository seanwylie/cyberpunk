// Procedural landmark sprites for the bank (no external art needed): a squat riveted steel vault house with a brass trim and a round vault door.
// Baked once to a canvas by TownArt (same as the station signs). 100px per tile footprint-width unit; sprite is 4 tiles wide.
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export function makeVault(): HTMLCanvasElement {
  const W = 520, H = 460, cv = mk(W, H), c = cv.getContext('2d')!;
  // ground shadow
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(W / 2, H - 18, W * .46, 20, 0, 0, 7); c.fill();
  // body: iso-ish front slab with a darker side wall
  const bx = 40, by = 90, bw = 440, bh = 320;
  let g = c.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, '#4a4e52'); g.addColorStop(1, '#2a2d30'); c.fillStyle = g; c.fillRect(bx, by, bw, bh);
  c.fillStyle = '#1d1f22'; c.fillRect(bx, by + bh - 36, bw, 36);           // plinth
  // panel seams + rivets
  c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 3; for (const x of [bx + 110, bx + 330]) { c.beginPath(); c.moveTo(x, by); c.lineTo(x, by + bh - 36); c.stroke(); }
  c.fillStyle = '#6b6f73'; for (let x = bx + 14; x < bx + bw; x += 38) for (const y of [by + 14, by + bh - 52]) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }
  // brass cornice and hazard-free trim (no neon: dull brass)
  g = c.createLinearGradient(0, by - 34, 0, by + 8); g.addColorStop(0, '#b99a45'); g.addColorStop(1, '#6e5a26'); c.fillStyle = g; c.fillRect(bx - 16, by - 34, bw + 32, 42);
  c.fillStyle = '#1b1c1e'; c.fillRect(bx - 16, by + 8, bw + 32, 6);
  // roof rail + ticker window
  c.fillStyle = '#17191c'; c.fillRect(bx + 20, by - 62, bw - 40, 28); c.fillStyle = '#e8c45a'; c.globalAlpha = .85; for (let i = 0; i < 9; i++) c.fillRect(bx + 34 + i * 44, by - 54, 28, 12); c.globalAlpha = 1;
  // vault door: ring, bolts, spokes, wheel
  const cx = W / 2, cy = by + 150, R = 100;
  c.fillStyle = '#101214'; c.beginPath(); c.arc(cx, cy, R + 22, 0, 7); c.fill();
  g = c.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, R); g.addColorStop(0, '#8a8d90'); g.addColorStop(1, '#3b3e42'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
  c.strokeStyle = '#b99a45'; c.lineWidth = 8; c.beginPath(); c.arc(cx, cy, R - 4, 0, 7); c.stroke();
  c.fillStyle = '#25282b'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.beginPath(); c.arc(cx + Math.cos(a) * (R - 24), cy + Math.sin(a) * (R - 24), 7, 0, 7); c.fill(); }
  c.strokeStyle = '#26292c'; c.lineWidth = 12; c.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3 + .3; c.beginPath(); c.moveTo(cx - Math.cos(a) * 58, cy - Math.sin(a) * 58); c.lineTo(cx + Math.cos(a) * 58, cy + Math.sin(a) * 58); c.stroke(); }
  c.fillStyle = '#b99a45'; c.beginPath(); c.arc(cx, cy, 20, 0, 7); c.fill(); c.fillStyle = '#2a2519'; c.beginPath(); c.arc(cx, cy, 8, 0, 7); c.fill();
  // status lamp (the renderer's vault ambient pulses a brass glow around the landmark; this is the static lamp housing)
  c.fillStyle = '#e8c45a'; c.beginPath(); c.arc(bx + bw - 34, by + 40, 12, 0, 7); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 4; c.stroke();
  // steps
  c.fillStyle = '#2f3236'; c.fillRect(cx - 120, by + bh - 6, 240, 12); c.fillStyle = '#25282b'; c.fillRect(cx - 140, by + bh + 6, 280, 12);
  return cv;
}
