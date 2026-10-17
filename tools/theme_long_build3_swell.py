"""Rebuild theme_main_long build-3 swell in ONE pass from the pre-swell source (c046170^).
Gain: unity -> -22 dB as a smooth raised-cosine dip over 150.5-151.3 s (music is quiet there, ~-45 dB),
then a curved swell -22 dB -> 0 dB over 151.3-160.5 s. Envelope is C1-continuous (no steps -> no click).
Usage: python3 tools/theme_long_build3_swell.py <pre_swell.mp3> <out.mp3>"""
import sys, subprocess, numpy as np
SR = 44100
src, dst = sys.argv[1], sys.argv[2]
x = np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',src,'-f','f32le','-'],capture_output=True,check=True).stdout,np.float32).reshape(-1,2).astype(np.float64)
t = np.arange(len(x))/SR
A0, A1, B1, DEPTH, P = 150.5, 151.3, 160.5, -22.0, 1.3
db = np.zeros_like(t)
m = (t >= A0) & (t < A1); u = (t[m]-A0)/(A1-A0); db[m] = DEPTH*(0.5-0.5*np.cos(np.pi*u))
m = (t >= A1) & (t < B1); u = (t[m]-A1)/(B1-A1)
db[m] = DEPTH*(1-u)**P * (1 + 0*u)
# smooth the corner at A1 (zero slope at start of swell): blend first 0.6 s with eased curve
m2 = (t >= A1) & (t < A1+0.6); w = (t[m2]-A1)/0.6; s = w*w*(3-2*w)
db[m2] = DEPTH*(1-s) + db[m2]*s
g = 10**(db/20) * 10**(-0.4386/20)   # same global headroom trim as c046170 (peak < 0 dBFS)
y = x*g[:,None]
print('peak', np.abs(y).max())
subprocess.run(['ffmpeg','-y','-v','error','-f','f64le','-ar',str(SR),'-ac','2','-i','-','-b:a','80k',dst],input=y.tobytes(),check=True)
np.save('/tmp/ck/env_db.npy', db[::441])
