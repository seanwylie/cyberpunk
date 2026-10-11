// Procedural landmark sprite for the bank: a grounded, riveted steel vault-house drawn in the town's 2:1 isometric projection
// (plinth, lit left wall with the vault door + brass trim, shaded right wall with hazard band, roof with parapet, stoop leading to the pad).
// Baked once to a canvas by TownArt. 100px per tile; the sprite is placed with its footprint's front corner at 90% of the height (decor ay=.9).
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export function makeVault(fw = 4, fd = 3): HTMLCanvasElement {
  const U = 100, W = 540, H = 460, cv = mk(W, H), c = cv.getContext('2d')!;
  const Fx = 200 + (W - (fw + fd) * U / 2) / 2 + (fd - 3) * 0, Fy = H * .9; // screen pos of the front (max x, max y) ground corner
  const P = (u: number, v: number, z = 0): [number, number] => [Fx + (u - fw) * U / 2 - (v - fd) * U / 2, Fy + (u - fw) * U / 4 + (v - fd) * U / 4 - z];
  const poly = (pts: [number, number][], fill: string | CanvasGradient, stroke?: string) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); } };
  const box = (u0: number, v0: number, u1: number, v1: number, z0: number, z1: number, top: string, left: string, right: string, edge = 'rgba(0,0,0,.5)') => {
    poly([P(u0, v1, z1), P(u1, v1, z1), P(u1, v1, z0), P(u0, v1, z0)], left, edge); poly([P(u1, v0, z1), P(u1, v1, z1), P(u1, v1, z0), P(u1, v0, z0)], right, edge); poly([P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], top, edge); };
  let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const WH = 185, PL = 16; // wall height, plinth height
  // ground: soft contact shadow cast to the right/back plus a dark gravel apron, so the building sits IN the street
  c.save(); c.filter = 'blur(10px)'; poly([P(-.3, -.5, 0), P(fw + 1.3, -.5, 0), P(fw + 1.3, fd + .4, 0), P(-.3, fd + .4, 0)], 'rgba(0,0,0,.5)'); c.restore();
  poly([P(-.35, -.35, 0), P(fw + .35, -.35, 0), P(fw + .35, fd + .35, 0), P(-.35, fd + .35, 0)], '#2a2a2b');
  for (let i = 0; i < 160; i++) { const p = P(-.3 + R() * (fw + .6), -.3 + R() * (fd + .6), 0); c.fillStyle = R() < .5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.18)'; c.fillRect(p[0], p[1], 2 + R() * 3, 1.5); }
  // plinth
  box(-.2, -.2, fw + .2, fd + .2, 0, PL, '#4b4c4d', '#3a3b3d', '#27282a');
  // walls: left (facing +y, lit) and right (facing +x, shade)
  let g = c.createLinearGradient(0, Fy - PL - WH, 0, Fy); g.addColorStop(0, '#6a6e72'); g.addColorStop(1, '#43474b');
  poly([P(0, fd, WH + PL), P(fw, fd, WH + PL), P(fw, fd, PL), P(0, fd, PL)], g, 'rgba(0,0,0,.55)');
  g = c.createLinearGradient(0, Fy - PL - WH, 0, Fy); g.addColorStop(0, '#41454a'); g.addColorStop(1, '#25282b');
  poly([P(fw, 0, WH + PL), P(fw, fd, WH + PL), P(fw, fd, PL), P(fw, 0, PL)], g, 'rgba(0,0,0,.55)');
  // face-plane drawing: local px along the face, y up
  const faceL = (u: number, z: number, fn: () => void) => { const o = P(u, fd, PL); void z; c.save(); c.setTransform(.5, .25, 0, -1, o[0], o[1]); fn(); c.restore(); };       // left face: local x = along +x (0.5px,0.25px per px)
  const faceR = (v: number, z: number, fn: () => void) => { const o = P(fw, v, PL); void z; c.save(); c.setTransform(-.5, .25, 0, -1, o[0], o[1]); fn(); c.restore(); };      // right face: local x = along +y
  const Lw = fw * U, Rw = fd * U;
  // left wall: panel seams, rivets, grime, base occlusion
  faceL(0, WH, () => { c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; for (const x of [Lw * .27, Lw * .73]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, WH); c.stroke(); } c.beginPath(); c.moveTo(0, 62); c.lineTo(Lw, 62); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.1)'; for (const x of [Lw * .27, Lw * .73]) c.fillRect(x + 2, 0, 2, WH);
    c.fillStyle = '#7b7f83'; for (let x = 14; x < Lw; x += 36) for (const y of [14, 50]) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); }
    const gr = c.createLinearGradient(0, 0, 0, 60); gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, Lw, 60); });
  // brass cornice + hazard band on the left wall top (part of the wall, not a floating strip)
  faceL(0, WH, () => { const y0 = WH - 30; c.fillStyle = '#17191c'; c.fillRect(0, y0, Lw, 30); c.save(); c.beginPath(); c.rect(0, y0 + 4, Lw, 22); c.clip(); c.fillStyle = '#e0b83e'; for (let x = -30; x < Lw + 30; x += 44) { c.beginPath(); c.moveTo(x, y0 + 26); c.lineTo(x + 22, y0 + 26); c.lineTo(x + 40, y0 + 4); c.lineTo(x + 18, y0 + 4); c.fill(); } c.restore();
    const gb = c.createLinearGradient(0, y0 - 12, 0, y0); gb.addColorStop(0, '#c7a64e'); gb.addColorStop(1, '#7a6226'); c.fillStyle = gb; c.fillRect(0, y0 - 12, Lw, 12); });
  // vault door in a recessed brass frame, centred on the pad
  faceL(fw / 2 - 1.05, 150, () => { const cx = 105, cy = 78, r = 70;
    c.fillStyle = '#0d0f11'; c.fillRect(0, 0, 210, 150); c.strokeStyle = '#b99a45'; c.lineWidth = 8; c.strokeRect(4, 4, 202, 142); c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(8, 8, 194, 14);
    let gr = c.createRadialGradient(cx - 22, cy - 28, 6, cx, cy, r); gr.addColorStop(0, '#9a9da0'); gr.addColorStop(1, '#3a3d41'); c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
    c.strokeStyle = '#b99a45'; c.lineWidth = 7; c.beginPath(); c.arc(cx, cy, r - 3, 0, 7); c.stroke(); c.fillStyle = '#23262a'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.beginPath(); c.arc(cx + Math.cos(a) * (r - 17), cy + Math.sin(a) * (r - 17), 5, 0, 7); c.fill(); }
    c.strokeStyle = '#26292c'; c.lineWidth = 9; c.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3 + .3; c.beginPath(); c.moveTo(cx - Math.cos(a) * 40, cy - Math.sin(a) * 40); c.lineTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40); c.stroke(); }
    c.fillStyle = '#b99a45'; c.beginPath(); c.arc(cx, cy, 14, 0, 7); c.fill(); c.fillStyle = '#2a2519'; c.beginPath(); c.arc(cx, cy, 5, 0, 7); c.fill();
    c.fillStyle = '#e8c45a'; c.beginPath(); c.arc(188, 128, 5, 0, 7); c.fill(); });
  // right wall: seams, vents, caged lamp, hazard footer
  faceR(0, WH, () => { c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 3; for (const x of [Rw * .5]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, WH); c.stroke(); }
    c.fillStyle = '#5a5e62'; for (let x = 14; x < Rw; x += 36) for (const y of [14, WH - 44]) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); }
    for (let i = 0; i < 5; i++) { c.fillStyle = '#0f1113'; c.fillRect(40 + i * 0, 72 + i * 11, 70, 6); }
    c.fillStyle = '#1b1c1e'; c.fillRect(170, 80, 80, 54); c.fillStyle = '#ffcf6a'; c.fillRect(176, 86, 68, 42); c.fillStyle = 'rgba(0,0,0,.4)'; for (const x of [199, 222]) c.fillRect(x, 86, 3, 42); c.fillRect(176, 106, 68, 3);
    const gr = c.createLinearGradient(0, 0, 0, 70); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, Rw, 70);
    const y0 = WH - 30; c.fillStyle = '#121416'; c.fillRect(0, y0, Rw, 30); c.save(); c.beginPath(); c.rect(0, y0 + 4, Rw, 22); c.clip(); c.fillStyle = '#c9a233'; for (let x = -30; x < Rw + 30; x += 44) { c.beginPath(); c.moveTo(x, y0 + 26); c.lineTo(x + 22, y0 + 26); c.lineTo(x + 40, y0 + 4); c.lineTo(x + 18, y0 + 4); c.fill(); } c.restore(); c.fillStyle = '#6e5a26'; c.fillRect(0, y0 - 12, Rw, 12); });
  // roof: parapet slab with a lighter top, rooftop vents
  const zt = WH + PL; box(-.12, -.12, fw + .12, fd + .12, zt, zt + 14, '#5b5e61', '#7b7f83', '#34373a');
  poly([P(.12, .12, zt + 14), P(fw - .12, .12, zt + 14), P(fw - .12, fd - .12, zt + 14), P(.12, fd - .12, zt + 14)], '#3c3f42', 'rgba(0,0,0,.4)');
  box(.7, .5, 1.5, 1.3, zt + 14, zt + 40, '#6d7175', '#4d5154', '#303336'); box(2.4, .8, 3.1, 1.8, zt + 14, zt + 30, '#6d7175', '#4d5154', '#303336');
  // stoop leading out of the door to the pad: three real steps, hazard nosing on the first
  const du = 1.1, uc = fw / 2; for (let i = 0; i < 3; i++) { const d0 = fd + i * .38, d1 = fd + (i + 1) * .38 + (i === 2 ? .02 : 0), z1 = PL * (1 - i / 3) + 2; box(uc - du - i * .08, d0, uc + du + i * .08, d1, 0, z1 + 0 * i, i === 0 ? '#76797c' : '#6a6d70', '#4a4d50', '#2e3033'); }
  const nz = PL * (1) + 2; { const a = P(uc - du, fd + 1.1, 0), b = P(uc + du, fd + 1.1, 0); void a; void b; }
  // contact dark under the stoop + base wear line on the plinth
  c.fillStyle = 'rgba(0,0,0,.25)'; poly([P(uc - du - .3, fd + 1.2, 0), P(uc + du + .3, fd + 1.2, 0), P(uc + du + .3, fd + 1.35, 0), P(uc - du - .3, fd + 1.35, 0)], 'rgba(0,0,0,.18)'); void nz;
  // two bollards at the foot of the steps
  for (const u of [uc - du - .55, uc + du + .55]) box(u - .1, fd + 1.0, u + .1, fd + 1.2, 0, 30, '#c9a233', '#a6842a', '#6e5a1a');
  // warm spill from the door on the stoop
  c.save(); c.globalCompositeOperation = 'lighter'; const sp = P(uc, fd + .9, 0); const rg = c.createRadialGradient(sp[0], sp[1], 4, sp[0], sp[1], 90); rg.addColorStop(0, 'rgba(255,200,110,.22)'); rg.addColorStop(1, 'rgba(255,200,110,0)'); c.fillStyle = rg; c.beginPath(); c.ellipse(sp[0], sp[1], 90, 45, 0, 0, 7); c.fill(); c.restore();
  return cv;
}
