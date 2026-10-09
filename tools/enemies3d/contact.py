# Contact sheet: every enemy x 8 directions (idle frame 0) straight from the packed atlases. usage: python contact.py [out.png]
import json,os,sys
from PIL import Image,ImageDraw
D='public/dungeons/enemies3d'; ids=json.load(open(f'{D}/index.json')); C=120
sh=Image.new('RGB',(8*C,len(ids)*C),(58,60,62)); d=ImageDraw.Draw(sh); N=['S','SW','W','NW','N','NE','E','SE']
for r,i in enumerate(ids):
    m=json.load(open(f'{D}/{i}.json')); a=Image.open(f"{D}/{m['anims']['idle']['image']}").convert('RGBA'); F=m['frame']
    for c in range(8):
        t=a.crop((0,c*F,F,c*F+F)).resize((C,C),Image.LANCZOS); sh.paste(t,(c*C,r*C),t); d.text((c*C+3,r*C+3),f'{i} {N[c]}',fill=(255,255,255))
sh.save(sys.argv[1] if len(sys.argv)>1 else 'docs/art/dungeons/enemy3d_all_8dir_contact.png'); print(len(ids))
