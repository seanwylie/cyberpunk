# contact sheet of shots/content1 (3 views per level) -> shots/content1/sheet_levels.png
import os, sys
from PIL import Image, ImageDraw
d='shots/content1'; ids=sorted({f.rsplit('_',1)[0] for f in os.listdir(d) if f.endswith('_a.png')}); W,H=320,180
cols=3; rows=len(ids); sh=Image.new('RGB',(W*cols,(H+14)*rows),(20,20,22)); dr=ImageDraw.Draw(sh)
for r,i in enumerate(ids):
    dr.text((4,r*(H+14)+1),i,fill=(230,230,200))
    for c,k in enumerate('abc'):
        p=f'{d}/{i}_{k}.png'
        if os.path.exists(p): sh.paste(Image.open(p).convert('RGB').resize((W,H)),(c*W,r*(H+14)+14))
sh.save(f'{d}/sheet_levels.png'); print(sh.size)
