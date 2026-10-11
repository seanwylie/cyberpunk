// Mob variety helpers (docs/VARIETY.md): alternate-silhouette atlases (<id>_b, Blender-rendered, same stats/hitbox) chosen per enemy instance,
// and elite-affix visual tells (coloured ground aura + orbiting motes) so an affixed pack leader reads at a glance without reading its label.
export const AFFIX_COL: Record<string, string> = { hasted: '90,230,255', volatile: '255,150,40', shielded: '120,170,255', regenerating: '90,230,120', vampiric: '210,40,70', frenzied: '255,70,50', warded: '200,200,255', molten: '255,110,20', brooding: '170,90,220', stormcalled: '190,220,255' };
/** deterministic 0..1 per enemy id (stable across frames, saves and clients' own sims) */
export const idRand = (id: number, salt = 0) => { let h = (id * 2654435761 + salt * 40503) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
/** atlas id used to DRAW an enemy: half of the spawns of a type with a `_b` atlas use it */
export function drawType(type: string, id: number, has: (t: string) => boolean): string { return has(type + '_b') && idRand(id, 7) < .5 ? type + '_b' : type; }
export const affixColor = (affix?: string[]) => (affix && affix.length ? AFFIX_COL[affix[0]] || '230,170,90' : '');
type X = CanvasRenderingContext2D;
/** ground tell under the sprite. Cheap: one ellipse stroke + gradient, <= 3 motes. `ph` = animation phase seconds. */
export function drawTell(c: X, a: number, b: number, rad: number, col: string, ph: number, n: number, reduced: boolean) {
  c.save(); c.translate(a, b); c.scale(1, .5);
  const g = c.createRadialGradient(0, 0, rad * .2, 0, 0, rad); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(.75, `rgba(${col},${reduced ? .1 : .16 + .06 * Math.sin(ph * 3)})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.beginPath(); c.arc(0, 0, rad, 0, 7); c.fill();
  c.strokeStyle = `rgba(${col},${reduced ? .4 : .55})`; c.lineWidth = 2; c.setLineDash([rad * .28, rad * .18]); c.lineDashOffset = reduced ? 0 : -ph * rad * .5; c.beginPath(); c.arc(0, 0, rad * .82, 0, 7); c.stroke(); c.restore();
  if (!reduced) { c.save(); c.fillStyle = `rgba(${col},.85)`; for (let i = 0; i < n; i++) { const an = ph * 1.4 + i * 6.283 / n; c.fillRect(a + Math.cos(an) * rad * .8 - 1.5, b - rad * .55 + Math.sin(an) * rad * .4 - 1.5 - (i % 2) * rad * .35, 3, 3); } c.restore(); }
}
