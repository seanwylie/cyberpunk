# Pose lineup: base vs each body variant (composited from per-slot layer sheets using the base depth order). Usage: lineup.py OUT.png [variants...]
import sys, json, os
from PIL import Image
SP=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','public','sprites'); out=sys.argv[1]; vs=sys.argv[2:] or ['heavy','surgical']
A=json.load(open(SP+'/player.json')); C=A['frame']['w']; D=['S','SW','W','NW','N','NE','E','SE']
poses=[('idle','S',0),('idle','SE',0),('run','E',3),('run','SE',8),('run','N',3),('attack','E',5),('attack','SE',2),('dodge','SE',3),('cast','S',5),('down','SE',11)]
def cell(v,anim,d,f):
    a=A['anims'][anim]; row=D.index(d)
    if v=='base': return Image.open(f"{SP}/{a['image']}").convert('RGBA').crop((f*C,row*C,(f+1)*C,(row+1)*C))
    c=Image.new('RGBA',(C,C)); L=a['layers']
    for li in a['order'][row][f]:
        p=f"{SP}/v/{v}/{anim}_{L[li]['name']}.webp"; im=Image.open(p).convert('RGBA').crop((f*C,row*C,(f+1)*C,(row+1)*C)); c=Image.alpha_composite(c,im)
    return c
rows=['base']+vs; Z=2
sheet=Image.new('RGB',(C*Z*len(poses),C*Z*len(rows)),(46,48,50))
for r,v in enumerate(rows):
    for i,(an,d,f) in enumerate(poses):
        if an not in A['anims']: continue
        try: im=cell(v,an,d,f).resize((C*Z,C*Z),Image.LANCZOS)
        except Exception as e: print('skip',v,an,e); continue
        bg=Image.new('RGBA',im.size,(46,48,50,255)); sheet.paste(Image.alpha_composite(bg,im).convert('RGB'),(i*C*Z,r*C*Z))
sheet.save(out); print('wrote',out,sheet.size)
