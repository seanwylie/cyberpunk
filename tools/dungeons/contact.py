# contact sheet of cut enemies on magenta (QA): python3 tools/dungeons/contact.py out.png
import json,sys
from PIL import Image
m=json.load(open('public/dungeons/enemies/manifest.json')); names=list(m); cols=9; cw=150; ch=190
sheet=Image.new('RGB',(cols*cw,3*ch),(255,0,255))
for i,n in enumerate(names):
    im=Image.open(f'public/dungeons/enemies/{n}.png'); im.thumbnail((cw-6,ch-6)); sheet.paste(im,((i%cols)*cw+3,(i//cols)*ch+3),im)
sheet.save(sys.argv[1])
