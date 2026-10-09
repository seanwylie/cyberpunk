# GIFs (docs/art/dungeons/anim3d/<id>.gif) + contact sheet from /tmp/gif_<id>_front (tests/enemy_gifs.mjs) and a raw 8-direction sheet from RAW (idle frame 0)
import glob,os,sys
from PIL import Image,ImageDraw
out='docs/art/dungeons/anim3d'; os.makedirs(out,exist_ok=True); tiles=[]
for d in sorted(glob.glob('/tmp/gif_*_front')):
    id=os.path.basename(d)[4:-6]; fs=sorted(glob.glob(d+'/*.png'))
    ims=[Image.open(f).convert('P',palette=Image.ADAPTIVE,colors=96) for f in fs]; ims=[i.resize((i.width//2*1,i.height//2*1)) if False else i for i in ims]
    rgb=[Image.open(f).convert('RGB').resize((Image.open(f).width*2//3,Image.open(f).height*2//3)) for f in fs]
    rgb[0].save(f'{out}/{id}.gif',save_all=True,append_images=rgb[1:],duration=85,loop=0,optimize=True); tiles.append((id,rgb[14]))
S=230; cols=4; sh=Image.new('RGB',(cols*S,((len(tiles)+cols-1)//cols)*S)); dr=ImageDraw.Draw(sh)
for i,(id,im) in enumerate(tiles): t=im.copy(); t.thumbnail((S,S)); sh.paste(t,((i%cols)*S,(i//cols)*S)); dr.text(((i%cols)*S+4,(i//cols)*S+3),id,fill=(255,255,255))
sh.save('docs/art/dungeons/enemy3d_ingame_contact.png')
RAW=sys.argv[1] if len(sys.argv)>1 else '/tmp/e3d_full'; D=['S','SW','W','NW','N','NE','E','SE']; ids=[t[0] for t in tiles]; C=160
sh2=Image.new('RGB',(8*C,len(ids)*C),(58,60,62)); d2=ImageDraw.Draw(sh2)
for r,id in enumerate(ids):
    for c,dn in enumerate(D):
        im=Image.open(f'{RAW}/{id}/idle/{dn}_0.png').convert('RGBA').resize((C,C),Image.LANCZOS); sh2.paste(im,(c*C,r*C),im); d2.text((c*C+3,r*C+3),f'{id} {dn}',fill=(255,255,255))
sh2.save('docs/art/dungeons/enemy3d_8dir_sheet.png'); print(len(tiles))
