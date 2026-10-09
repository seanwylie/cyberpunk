# Pack raw Blender frames (RAW/<id>/<anim>/<DIR>_<f>.png) -> public/dungeons/enemies3d/<id>.json + <id>_<anim>.webp (rows = S,SW,W,NW,N,NE,E,SE; cols = frames) + index.json.
# usage: python pack_enemy.py RAW OUT [ids]   Premultiplied downsample (no fringes), thin soft edge outline like the player pack.
import sys, os, json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from specs import ANIM_SPEC
from PIL import Image, ImageFilter
import numpy as np
RAW,OUT=sys.argv[1],sys.argv[2]; DIRS=['S','SW','W','NW','N','NE','E','SE']; Q=int(os.environ.get('WEBPQ','86'))
os.makedirs(OUT,exist_ok=True); ids=sys.argv[3].split(',') if len(sys.argv)>3 else sorted(d for d in os.listdir(RAW) if os.path.isdir(f'{RAW}/{d}'))
def outline(im,r=3,a=.42):
    al=im.split()[3]; ol=al.filter(ImageFilter.MaxFilter(r)).filter(ImageFilter.GaussianBlur(.8)).point(lambda v:min(255,int(v*2.2*a))); dark=Image.new('RGBA',im.size,(20,17,14,255)); dark.putalpha(ol); return Image.alpha_composite(dark,im)
def down(im,cell): return im.convert('RGBa').resize((cell,cell),Image.LANCZOS).convert('RGBA').filter(ImageFilter.UnsharpMask(radius=.8,percent=50,threshold=2))
idx=json.load(open(f'{OUT}/index.json')) if os.path.exists(f'{OUT}/index.json') else []
for eid in ids:
    meta=json.load(open(f'{RAW}/{eid}/meta.json')); cell=meta['res']//2; atlas={'version':1,'frame':cell,'anchor':[round(meta['anchor'][0]*cell),round(meta['anchor'][1]*cell)],'anims':{}}; hpx=0
    for an,sp in ANIM_SPEC.items():
        if not os.path.isdir(f'{RAW}/{eid}/{an}'): continue
        n=sp['n']; sheet=Image.new('RGBA',(cell*n,cell*8))
        for di,d in enumerate(DIRS):
            for f in range(n):
                im=down(outline(Image.open(f'{RAW}/{eid}/{an}/{d}_{f}.png').convert('RGBA'),3),cell); sheet.paste(im,(f*cell,di*cell))
                if an=='idle' and f==0 and d in('S','SE','E','N'):
                    bb=im.split()[3].point(lambda v:255 if v>40 else 0).getbbox(); hpx=max(hpx,(bb[3]-bb[1]) if bb else 0)
        name=f'{eid}_{an}.webp'; sheet.save(f'{OUT}/{name}',format='WEBP',quality=Q,alpha_quality=100,method=5)
        atlas['anims'][an]={'image':name,'frames':n,'fps':sp['fps'],'loop':sp['loop'],'hit':sp['hit']}
    atlas['hpx']=hpx; json.dump(atlas,open(f'{OUT}/{eid}.json','w'),separators=(',',':'))
    if eid not in idx: idx.append(eid)
    print('packed',eid,cell,'hpx',hpx,sum(os.path.getsize(f'{OUT}/{eid}_{a}.webp') for a in atlas['anims'])//1024,'KB')
json.dump(sorted(idx),open(f'{OUT}/index.json','w'))
