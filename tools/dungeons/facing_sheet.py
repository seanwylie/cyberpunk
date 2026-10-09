import glob,os
from PIL import Image,ImageDraw
ids=[];[ids.append(i) for i in [os.path.basename(f).rsplit('_',1)[0] for f in sorted(glob.glob('/tmp/facing/*_0.png'))] if i not in ids]
N=['E','SE','S(front)','SW','W','NW','N(back)','NE']; S=200; sh=Image.new('RGB',(8*S,len(ids)*S)); d=ImageDraw.Draw(sh)
for r,i in enumerate(ids):
    for c in range(8):
        im=Image.open(f'/tmp/facing/{i}_{c}.png').convert('RGB').resize((S,S)); sh.paste(im,(c*S,r*S)); d.text((c*S+4,r*S+3),f'{i} {N[c]}',fill=(255,255,255))
sh.save('docs/art/dungeons/enemy_facing_8way.png'); print(sh.size)
