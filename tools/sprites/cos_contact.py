# Contact sheet for cosmetic layers: body + recoloured piece per item, side by side. Usage: cos_contact.py BODYRAW COSRAW ITEMS.json OUT.png DIR [ids...]
# Recolour = same formula as the game (src/coslayers.ts): rgb = R*c + G*c2 + B*glow(c2).
import sys, json, os
from PIL import Image, ImageDraw
import numpy as np
BODY,COS,ITEMS,OUT,D=sys.argv[1:6]; ids=sys.argv[6:]; it=json.load(open(ITEMS))
def hx(h):
    h=h if len(h)==7 else "#"+"".join(ch*2 for ch in h[1:4])
    return np.array([int(h[i:i+2],16)/255 for i in (1,3,5)])
def recolor(im,c,c2):
    a=np.asarray(im).astype(float)/255; R,G,B=a[...,0:1],a[...,1:2],a[...,2:3]; glow=np.minimum(1,hx(c2)*0.6+0.4)
    w=np.minimum(np.minimum(R,G),B); rgb=np.clip((R-w)*hx(c)+(G-w)*hx(c2)+(B-w)*glow+w,0,1)
    return Image.fromarray((np.concatenate([rgb,a[...,3:4]],-1)*255).astype('uint8'))
body=Image.open(f"{BODY}/idle/all/{D}_0.png").convert("RGBA"); W,H=body.size
if os.environ.get("CROP")=="full": cw,ch=W*7//16,H*13//16; x0=(W-cw)//2; y0=H*1//8
else: cw,ch=W*5//16,H*5//16; x0=(W-cw)//2; y0=H*7//40
tiles=[]
for i in ids:
    p=Image.open(f'{COS}/idle/cos_{i}/{D}_0.png').convert('RGBA'); t=Image.new('RGBA',(W,H),(46,48,54,255)); t.alpha_composite(body); t.alpha_composite(recolor(p,it[i]['c'],it[i]['c2']))
    t=t.crop((x0,y0,x0+cw,y0+ch)).resize((cw*2,ch*2) if os.environ.get("CROP")!="full" else (cw,ch),Image.LANCZOS); d=ImageDraw.Draw(t); d.text((4,4),it[i]['n'],fill=(235,230,220,255)); tiles.append(t)
cols=min(8,len(tiles)); rows=(len(tiles)+cols-1)//cols; tw,th=tiles[0].size
sheet=Image.new('RGB',(tw*cols,th*rows),(30,30,34))
for k,t in enumerate(tiles): sheet.paste(t.convert('RGB'),((k%cols)*tw,(k//cols)*th))
sheet.save(OUT); print('wrote',OUT,sheet.size)
