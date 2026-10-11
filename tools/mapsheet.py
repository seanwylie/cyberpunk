import json, sys, base64, os
from PIL import Image, ImageDraw, ImageFont
data = json.load(open(sys.argv[1])); out = sys.argv[2]
ZC = {'yard':(120,110,90),'proc':(130,96,80),'junction':(86,110,130),'boss':(150,70,70),'salvage':(100,130,90),'passage':(110,100,140),'corridor':(150,150,150),'town':(100,100,100)}
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 11)
except Exception: F = ImageFont.load_default()
def render(d, T=3):
    w, h = d['w'], d['h']; im = Image.new('RGB', (w*T, h*T), (18,18,22)); px = im.load(); s = base64.b64decode(d['solid']); z = base64.b64decode(d['zone'])
    for y in range(h):
        for x in range(w):
            if not s[y*w+x]:
                c = ZC.get(d['zn'][z[y*w+x]], (120,120,120))
                for j in range(T):
                    for i in range(T): px[x*T+i, y*T+j] = c
    dr = ImageDraw.Draw(im)
    for p in d['props']: dr.rectangle([p[0]*T, p[1]*T, p[0]*T+T-1, p[1]*T+T-1], fill=(55,55,60))
    for p in d['sp']: dr.point((p[0]*T+1, p[1]*T+1), fill=(255,90,90))
    for hz in d['hz']: dr.ellipse([(hz[0]-hz[2])*T, (hz[1]-hz[2])*T, (hz[0]+hz[2])*T, (hz[1]+hz[2])*T], outline=(255,160,30))
    cols = {'gate1':(255,230,60),'lock2':(255,150,40),'boss':(255,40,40)}
    for dd in d['doors']:
        for t in dd['tiles']: dr.rectangle([t[0]*T, t[1]*T, t[0]*T+T-1, t[1]*T+T-1], fill=cols.get(dd['id'], (255,0,0)))
    for i in d['it']: dr.ellipse([i[1]*T-3, i[2]*T-3, i[1]*T+3, i[2]*T+3], fill=(60,230,255))
    sx, sy = d['spawn']['x']*T, d['spawn']['y']*T; dr.ellipse([sx-4, sy-4, sx+4, sy+4], fill=(60,255,80))
    bx, by = d['boss']['x']*T, d['boss']['y']*T; dr.ellipse([bx-5, by-5, bx+5, by+5], fill=(255,215,0), outline=(0,0,0))
    return im
CW, CH = 380, 330
def sheet(items, cols, name, title=None):
    rows = (len(items)+cols-1)//cols; S = Image.new('RGB', (cols*CW, rows*(CH+18)), (8,8,10)); dr = ImageDraw.Draw(S)
    for n, d in enumerate(items):
        im = render(d); im.thumbnail((CW-6, CH-4)); x = (n%cols)*CW+3; y = (n//cols)*(CH+18)
        S.paste(im, (x, y+16)); dr.text((x, y+1), '%s  [%s]  s%d  %dx%d' % (d['id'], d['arch'], d['seed'], d['w'], d['h']), fill=(235,235,235), font=F)
    S.save(os.path.join(out, name)); print('wrote', name, S.size)
first = [d for d in data if d['seed'] == data[0]['seed']]
sheet(first, 5, 'contact_all_dungeons.png')
ids = []
for d in data:
    if d['id'] not in ids: ids.append(d['id'])
sheet([d for d in data if d['id'] in ids[4:] and d['seed'] != data[0]['seed']][:30], 5, 'contact_seeds_batch.png')
for i in ids[:1] + ids[4:7]:
    sheet([d for d in data if d['id'] == i], 3, 'seeds_%s.png' % i)
