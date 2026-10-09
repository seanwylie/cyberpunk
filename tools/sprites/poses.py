# Keyframed / procedural character animation for the Blender rig (curves, overlap, IK feet, spring secondary motion).
# Used by build_char.py:  P=Poser(root,body,hips,torsoP,headP,J);  P.set(anim,f)  then  P.deform(anim,f)  (after view_layer.update()).
import math
import numpy as np
from mathutils import Vector, Matrix, Euler
from anim_spec import SPEC, duration

PI = math.pi
def sstep(t): t = min(1.0, max(0.0, t)); return t * t * (3 - 2 * t)
L1, L2 = 0.43, 0.42           # thigh / shank
ANK = 0.09                    # ankle height above ground
SIDES = (('L', 1), ('R', -1))

DEF = {'bx': 0, 'by': 0, 'bz': 0.84, 'brx': 0, 'bry': 0, 'brz': 0, 'hrx': 0, 'hry': 0, 'hrz': 0,
       'trx': 0.08, 'try': 0, 'trz': 0, 'hdx': -0.05, 'hdy': 0, 'hdz': 0, 'ikw': 1.0,
       'Lsx': -0.12, 'Lab': 0.12, 'Lel': -0.7, 'Rsx': -0.1, 'Rab': 0.12, 'Rel': -0.7,
       'Lfx': 0.125, 'Lfy': 0.08, 'Lfz': 0, 'Lpt': 0, 'Rfx': -0.125, 'Rfy': -0.08, 'Rfz': 0, 'Rpt': 0,
       'Lhp': -0.15, 'Lkn': 0.25, 'Lan': -0.1, 'Rhp': -0.15, 'Rkn': 0.25, 'Ran': -0.1}
# overlap: how many seconds each channel trails its parent (head after torso, forearm after shoulder ...)
LAG = {'hdx': .04, 'hdy': .04, 'hdz': .05, 'sx': .02, 'ab': .03, 'el': .055, 'an': .015}
ARM_LAG_SCALE = {'attack': 0.3, 'cast': 0.3}   # impact frames must show the arm already extended
def lag_of(ch, anim=None):
    for k, v in LAG.items():
        if ch.endswith(k): return v * (ARM_LAG_SCALE.get(anim, 1.0) if k in ('sx', 'ab', 'el') else 1.0)
    return 0.0

def hermite(keys, u, tens=0.85):
    """Catmull-Rom style cubic Hermite through (u,v) keys (sorted). Zero slope at the ends; mild overshoot = follow-through."""
    if u <= keys[0][0]: return keys[0][1]
    if u >= keys[-1][0]: return keys[-1][1]
    for i in range(len(keys) - 1):
        if keys[i][0] <= u <= keys[i + 1][0]: break
    u0, v0 = keys[i]; u1, v1 = keys[i + 1]; h = u1 - u0; t = (u - u0) / h
    def tan(j):
        if j <= 0 or j >= len(keys) - 1: return 0.0
        return tens * (keys[j + 1][1] - keys[j - 1][1]) / (keys[j + 1][0] - keys[j - 1][0])
    m0, m1 = tan(i) * h, tan(i + 1) * h
    t2, t3 = t * t, t * t * t
    return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * m1

H5 = 5 / 11
TABLES = {
 'attack': [
  (0.0, {}),
  (0.24, dict(bz=.79, by=-.04, trx=.02, trz=.6, hrz=.28, hdz=-.35, Lsx=.95, Lab=.25, Lel=-1.95, Rsx=-.8, Rel=-1.3, Lfy=0.0, Rfy=-.14)),
  (0.34, dict(Lfz=.14, Lfy=.22, bz=.78)),
  (H5, dict(bz=.77, by=.10, trx=.38, trz=-.68, hrz=-.32, hdz=.42, hdx=0.0, Lsx=-1.55, Lab=.18, Lel=-.12, Rsx=.55, Rel=-1.7, Lfy=.40, Lfz=0, Rfy=-.2, Rfz=.03)),
  (0.60, dict(by=.14, trx=.42, trz=-.82, hrz=-.36, hdz=.48, Lsx=-1.75, Lel=-.05, Lfy=.40, Rfy=-.22, Rfz=0)),
  (0.80, dict(bz=.82, by=.06, trx=.22, trz=-.3, hrz=-.12, hdz=.18, Lsx=-.9, Lel=-.9, Rsx=-.3, Rel=-1.0, Lfy=.24, Rfy=-.12)),
  (1.0, {})],
 'cast': [
  (0.0, {}),
  (0.18, dict(bz=.82, trx=-.1, hdx=-.12, Lsx=.5, Rsx=.5, Lel=-1.9, Rel=-1.9, Lab=.5, Rab=.5, Rfy=-.12)),
  (0.32, dict(bz=.79, trx=-.2, hdx=-.25, Lsx=.8, Rsx=.8, Lab=.7, Rab=.7, Lel=-2.1, Rel=-2.1)),
  (0.38, dict(Lfz=.12, Lfy=.18)),
  (H5, dict(bz=.78, by=.08, trx=.33, hdx=.05, Lsx=-1.55, Rsx=-1.55, Lab=.12, Rab=.12, Lel=-.2, Rel=-.2, Lfy=.32, Lfz=0, Rfy=-.18)),
  (0.62, dict(by=.1, trx=.4, Lsx=-1.7, Rsx=-1.7, Lel=-.1, Rel=-.1, Lfy=.32)),
  (0.85, dict(by=.04, trx=.18, Lsx=-.7, Rsx=-.7, Lel=-1.0, Rel=-1.0, Lfy=.18)),
  (1.0, {})],
 'hit': [
  (0.0, {}),
  (0.22, dict(bz=.80, by=-.1, trx=-.4, trz=.2, hrz=-.12, hdx=-.45, hdz=.18, Lsx=.5, Rsx=.4, Lab=.55, Rab=.45, Lel=-.6, Rel=-.5, Lfy=.0, Rfy=-.2)),
  (0.5, dict(bz=.80, by=-.06, trx=-.18, hdx=-.2, Lsx=.3, Rsx=.25, Lab=.35, Rab=.3, Lfy=.04, Rfy=-.14)),
  (1.0, {})],
 'dodge': [
  (0.0, dict(ikw=1)),
  (0.15, dict(ikw=0, bz=.70, brx=.35, trx=.5, hdx=-.3, Lsx=-.8, Rsx=-.8, Lel=-1.8, Rel=-1.8, Lhp=-1.0, Rhp=-1.0, Lkn=1.4, Rkn=1.4, Lan=.3, Ran=.3)),
  (0.5, dict(ikw=0, bz=.62, brx=PI, trx=.9, hdx=-.5, Lsx=-1.0, Rsx=-1.0, Lel=-2.2, Rel=-2.2, Lhp=-1.6, Rhp=-1.6, Lkn=2.2, Rkn=2.2, Lan=.4, Ran=.4)),
  (0.82, dict(ikw=0.1, bz=.66, brx=2 * PI - .35, trx=.5, hdx=-.2, Lsx=-.6, Rsx=-.6, Lel=-1.6, Rel=-1.6, Lhp=-1.1, Rhp=-1.1, Lkn=1.5, Rkn=1.5)),
  (1.0, dict(ikw=1, bz=.80, brx=2 * PI, trx=.2))],
 'down': [
  (0.0, dict(ikw=1)),
  (0.12, dict(ikw=1, bz=.78, by=-.04, trx=.3, hdx=.15, Lsx=.2, Rsx=.2)),
  (0.30, dict(ikw=0, bz=.5, trx=.5, hdx=.45, Lsx=.2, Rsx=.3, Lab=.3, Rab=.3, Lel=-.4, Rel=-.4, Lhp=-.7, Lkn=1.3, Lan=.3, Rhp=-.2, Rkn=1.9, Ran=.5)),
  (0.55, dict(ikw=0, bz=.42, brx=-.8, trx=.2, hdx=.3, Lab=.9, Rab=.9, Lsx=.3, Rsx=.3, Lhp=-.4, Lkn=1.0, Lan=.3, Rhp=-.3, Rkn=1.2)),
  (0.78, dict(ikw=0, bz=.2, brx=-1.45, trx=0.05, hdx=.2, Lab=1.0, Rab=1.0, Lhp=-.2, Lkn=.5, Rhp=-.15, Rkn=.45, Lan=0, Ran=0)),
  (0.88, dict(ikw=0, bz=.16, brx=-1.58, Lab=1.15, Rab=1.15)),
  (1.0, dict(ikw=0, bz=.14, brx=-1.5, trx=0, hdx=.2, Lsx=.2, Rsx=.2, Lab=1.0, Rab=1.0, Lel=-.2, Rel=-.2, Lhp=-.1, Lkn=.3, Rhp=-.1, Rkn=.3))],
}

def build_curves(anim):
    keys = TABLES[anim]; curves = {}
    for ch in DEF:
        pts = [(u, d[ch]) for u, d in keys if ch in d]
        if not pts or pts[0][0] > 0: pts.insert(0, (0.0, DEF[ch]))
        if pts[-1][0] < 1: pts.append((1.0, DEF[ch]))
        curves[ch] = pts
    return curves

def loop_idle(p):
    s = lambda ph, f=1: math.sin(2 * PI * (f * p - ph))
    c = dict(DEF)
    c['bz'] = 0.835 + 0.007 * s(.25) + 0.002 * s(.5, 2)
    c['bx'] = 0.014 * s(0)
    c['hry'] = -0.035 * s(0.02); c['hrz'] = 0.02 * s(0.2)
    c['trx'] = 0.08 + 0.014 * s(.12); c['try'] = 0.04 * s(0.1); c['trz'] = -0.02 * s(.3)
    c['hdx'] = -0.05 - 0.012 * s(.2); c['hdz'] = 0.04 * s(.3); c['hdy'] = -0.02 * s(.15)
    for k, ph in (('L', 0.0), ('R', 0.45)):
        c[k + 'sx'] = -0.12 + 0.035 * s(.12 + ph) + 0.01 * s(.3, 2); c[k + 'ab'] = 0.12 + 0.02 * s(.05 + ph)
        c[k + 'el'] = -0.7 - 0.06 * s(.24 + ph)
    c['Lfy'] = 0.08; c['Rfy'] = -0.08
    return c

RUN_D, RUN_A = 0.44, 0.36
def run_leg(p):
    p %= 1.0; d, A = RUN_D, RUN_A
    if p < d:
        s = p / d; fy = A * (1 - 2 * s); fz = 0.0
        pt = 0.95 * sstep((s - 0.72) / 0.28) - 0.25 * (1 - sstep(s / 0.18))
    else:
        q = (p - d) / (1 - d); fy = -A + 2 * A * (q * q * (3 - 2 * q) * 0.85 + q * 0.15)
        fz = 0.30 * math.sin(PI * q) ** 1.1 + 0.02 * math.sin(PI * q)
        pt = 0.95 * (1 - sstep(q / 0.35)) - 0.45 * sstep((q - 0.35) / 0.5) * (1 - sstep((q - 0.9) / 0.1))
    return fy, fz, pt

def loop_run(p):
    c = dict(DEF); d = RUN_D
    cs = lambda ph, f=1: math.cos(2 * PI * (f * p - ph))
    c['bz'] = 0.795 - 0.04 * math.cos(4 * PI * (p - d / 2))
    c['bx'] = 0.022 * cs(d / 2)
    c['hry'] = -0.05 * cs(d / 2) ; c['hrz'] = -0.13 * cs(0.0)
    c['trx'] = 0.24 + 0.025 * math.cos(4 * PI * (p - 0.1)); c['trz'] = 0.2 * cs(0.0 - 0.02); c['try'] = 0.05 * cs(d / 2 + 0.03)
    c['hdx'] = -0.2 + 0.03 * math.cos(4 * PI * (p - 0.2)); c['hdz'] = -0.09 * cs(-0.05); c['hdy'] = -0.03 * cs(d / 2 + 0.05)
    for k, ph in (('L', 0.0), ('R', 0.5)):
        fy, fz, pt = run_leg(p + ph)
        c[k + 'fy'] = fy; c[k + 'fz'] = fz; c[k + 'pt'] = pt; c[k + 'fx'] = DEF[k + 'fx'] * (1 - 0.1 * (fz > 0.05))
        a = 0.95 * math.cos(2 * PI * (p + ph - 0.03)) if True else 0   # arm swings with same-side leg (forward when leg back)
        c[k + 'sx'] = -0.2 + 0.7 * math.cos(2 * PI * (p + ph - 0.045))
        c[k + 'el'] = -1.45 + 0.4 * math.cos(2 * PI * (p + ph - 0.11))
        c[k + 'ab'] = 0.14 + 0.05 * math.cos(2 * PI * (p + ph))
    return c

class Poser:
    def __init__(s, root, body, hips, torsoP, headP, J):
        s.root, s.body, s.hips, s.torsoP, s.headP, s.J = root, body, hips, torsoP, headP, J
        s.curves = {}; s.sec = {}; s.targets = []
    # ---------------- channel evaluation ----------------
    def time(s, anim, f):
        sp = SPEC[anim]; return (f / sp['n']) if sp['loop'] else (f / (sp['n'] - 1))
    def channels(s, anim, u):
        sp = SPEC[anim]; T = duration(anim)
        if anim == 'idle' or anim == 'run':
            fn = loop_idle if anim == 'idle' else loop_run
            # procedural loops carry their overlap in-formula; extra per-joint trailing for head/forearm via phase shift
            base = fn(u % 1.0); out = {}
            for ch, v in base.items():
                lg = lag_of(ch, anim)
                out[ch] = fn((u - lg / T) % 1.0)[ch] if lg else v
            return out
        if anim not in s.curves: s.curves[anim] = build_curves(anim)
        out = {}
        for ch, pts in s.curves[anim].items():
            lg = lag_of(ch, anim); out[ch] = hermite(pts, min(1.0, max(0.0, u - lg / T)) if ch != 'brx' else u)
        return out
    # ---------------- kinematics ----------------
    def mats(s, c):
        Mb = Matrix.Translation((c['bx'], -c['by'], c['bz'])) @ Euler((c['brx'], c['bry'], c['brz'])).to_matrix().to_4x4()
        Mh = Mb @ Matrix.Translation((0, 0, 0.06)) @ Euler((c['hrx'], c['hry'], c['hrz'])).to_matrix().to_4x4()
        Mt = Mh @ Matrix.Translation((0, 0, 0.06)) @ Euler((c['trx'], c['try'], c['trz'])).to_matrix().to_4x4()
        Mhd = Mt @ Matrix.Translation((0, 0, 0.62)) @ Euler((c['hdx'], c['hdy'], c['hdz'])).to_matrix().to_4x4()
        return Mb, Mh, Mt, Mhd
    def leg_ik(s, k, sx, c, Mh):
        Mhip = Mh @ Matrix.Translation((0.115 * sx, 0, -0.02))
        A = Vector((c[k + 'fx'], -c[k + 'fy'], ANK + c[k + 'fz']))
        t = Mhip.inverted() @ A; d = t.length; d = min(d, L1 + L2 - 1e-3); d = max(d, 0.2)
        if t.length > d: t = t.normalized() * d
        cosK = (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2); kap = PI - math.acos(max(-1, min(1, cosK)))
        py, pz = L2 * math.sin(kap), -(L1 + L2 * math.cos(kap))
        r = math.hypot(t.x, t.z); qy, qz = t.y, -r
        th = math.atan2(qz, qy) - math.atan2(pz, py); be = math.atan2(-t.x, -t.z)
        an = -(th + kap + c['hrx'] + c['brx']) + c[k + 'pt']
        return (th, be, 0.0), kap, an
    def set(s, anim, f):
        c = s.channels(anim, s.time(anim, f)); s.cur = c; J = s.J
        s.body.location = (c['bx'], -c['by'], c['bz']); s.body.rotation_euler = (c['brx'], c['bry'], c['brz'])
        s.hips.location = (0, 0, 0.06); s.hips.rotation_euler = (c['hrx'], c['hry'], c['hrz'])
        s.torsoP.rotation_euler = (c['trx'], c['try'], c['trz']); s.headP.rotation_euler = (c['hdx'], c['hdy'], c['hdz'])
        Mb, Mh, Mt, Mhd = s.mats(c); w = c['ikw']
        for k, sx in SIDES:
            J['sh' + k].rotation_euler = (c[k + 'sx'], -c[k + 'ab'] * sx, 0); J['el' + k].rotation_euler = (c[k + 'el'], 0, 0)
            hp, kn, an = c[k + 'hp'], c[k + 'kn'], c[k + 'an']
            if w > 0:
                (th, be, _), kap, ana = s.leg_ik(k, sx, c, Mh)
                if w >= 1: hp_e, kn, an = (th, be, 0.0), kap, ana
                else: hp_e = (hp + (th - hp) * w, be * w, 0.0); kn = kn + (kap - kn) * w; an = an + (ana - an) * w
            else: hp_e = (hp, 0.0, 0.0)
            J['hp' + k].rotation_euler = hp_e; J['kn' + k].rotation_euler = (kn, 0, 0); J['an' + k].rotation_euler = (an, 0, 0)
    # ---------------- secondary motion (spring-damper lag driven by the pose kinematics) ----------------
    def drive_points(s, c):
        Mb, Mh, Mt, Mhd = s.mats(c)
        P = {'torso': (Mt @ Vector((0, 0, 0.55)) + Mt @ Vector((0, -0.25, 0.0))) * 0.5, 'head': Mhd @ Vector((0, 0.1, 0.1))}
        Msh = Mt @ Matrix.Translation((0.285, 0, 0.55)) @ Euler((c['Lsx'], -c['Lab'], 0)).to_matrix().to_4x4()
        Mel = Msh @ Matrix.Translation((0, 0, -0.29)) @ Euler((c['Lel'], 0, 0)).to_matrix().to_4x4()
        P['arm'] = Mel @ Vector((0, 0, -0.12)); return P
    SYS = {'jacket': ('torso', 10.5, .30, 1.0, .13), 'pouch': ('torso', 15, .22, .8, .08), 'hood': ('head', 12.5, .26, 1.15, .12), 'hose': ('arm', 14, .25, .7, .06)}
    def simulate(s, anim):
        sp = SPEC[anim]; T = duration(anim); fps = 240.0; dt = 1 / fps
        reps = 3 if sp['loop'] else 1; N = int(round(T * fps)) * reps + 1 if not sp['loop'] else int(round(T * fps)) * reps
        pts = {n: [] for n in ('torso', 'head', 'arm')}
        for i in range(N):
            t = i * dt; u = (t / T) if not sp['loop'] else (t / T) % 1.0
            u = min(u, 1.0); c = s.channels(anim, u)
            for n, v in s.drive_points(c).items(): pts[n].append(np.array(v))
        out = {}
        for sysn, (src, w, z, gain, mx) in s.SYS.items():
            P = np.array(pts[src]); a = np.zeros_like(P); a[1:-1] = (P[2:] - 2 * P[1:-1] + P[:-2]) / dt ** 2
            x = np.zeros(3); v = np.zeros(3); X = np.zeros_like(P)
            for i in range(len(P)):
                acc = -w * w * x - 2 * z * w * v - gain * a[i]; v = v + acc * dt; x = x + v * dt
                n = np.linalg.norm(x)
                if n > mx: x = x * (mx / n); v = v * 0.5
                X[i] = x
            out[sysn] = X
        s.sec[anim] = out
    def deform(s, anim, f):
        if anim not in s.sec: s.simulate(anim)
        sp = SPEC[anim]; T = duration(anim); u = s.time(anim, f); fps = 240.0
        i = int(round(u * T * fps)) if not sp['loop'] else int(round(u * T * fps)) + int(round(T * fps)) * 2
        Rr = s.root.matrix_world.to_3x3()
        for (o, rest, wgt, sysn) in s.targets:
            X = s.sec[anim][sysn]; D = Vector(X[min(i, len(X) - 1)])
            Dl = o.matrix_world.to_3x3().inverted() @ (Rr @ D)
            co = rest + wgt[:, None] * np.array(Dl)[None, :]
            o.data.vertices.foreach_set('co', co.astype(np.float32).ravel()); o.data.update()
    def register(s, o, wfn, sysn):
        n = len(o.data.vertices); co = np.zeros(n * 3, dtype=np.float32); o.data.vertices.foreach_get('co', co); co = co.reshape(n, 3).astype(np.float64)
        mw = o.matrix_world; wco = np.array([tuple(mw @ Vector(v)) for v in co])
        w = np.array([wfn(*p) for p in wco], dtype=np.float64)
        if w.max() > 0: s.targets.append((o, co, w, sysn))
