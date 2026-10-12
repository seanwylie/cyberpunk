import json, sys, base64, os
from PIL import Image, ImageDraw, ImageFont
data = json.load(open(sys.argv[1])); out = sys.argv[2]
ZC = {'yard':(120,110,90),'proc':(130,96,80),'junction':(86,110,130),'boss':(150,70,70),'salvage':(100,130,90),'passage':(110,100,140),'corridor':(150,150,150)}
F = ImageFont.load_default(); T = 4; CW = 440; CH = 400
S = Image.new('RGB', (3*CW, 2*(CH+14)), (8,8,10)); sd = ImageDraw.Draw(S)
for n, d in enumerate(data):
    w, h = d['w'], d['h']; im = Image.new('RGB', (w*T, h*T), (18,18,22)); px = im.load(); s = base64.b64decode(d['solid']); z = base64.b64decode(d['zone'])
    for y in range(h):
        for x in range(w):
            if not s[y*w+x]:
                c = ZC.get(d['zn'][z[y*w+x]], (120,120,120))
                for j in range(T):
                    for i in range(T): px[x*T+i, y*T+j] = c
    dr = ImageDraw.Draw(im); sx, sy = d['spawn']['x']*T, d['spawn']['y']*T; R = d['R']*T
    dr.ellipse([sx-R, sy-R, sx+R, sy+R], outline=(60,255,80), width=2)
    for p in d['sp']: dr.ellipse([p[0]*T, p[1]*T, p[0]*T+4, p[1]*T+4], fill=(255,60,60) if not p[2] else (255,200,40))
    dr.ellipse([sx-5, sy-5, sx+5, sy+5], fill=(60,255,80))
    im.thumbnail((CW-6, CH-4)); x = (n%3)*CW+3; y = (n//3)*(CH+14); S.paste(im, (x, y+12)); sd.text((x, y), d['id']+'  green ring = safe radius, red = enemy, yellow = elite/ranged', fill=(235,235,235), font=F)
S.save(os.path.join(out, 'safe_entry_maps.png')); print('wrote safe_entry_maps.png')
