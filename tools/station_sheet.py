# Builds shots/station_labels/contact_sheet.png from the per-station crops written by tests/station_label_vis.mjs
from PIL import Image, ImageDraw
import glob
fs=[f for f in sorted(glob.glob('shots/station_labels/*_*.png')) if 'sheet' not in f]
ims=[Image.open(f) for f in fs]; cw=max(i.width for i in ims); ch=max(i.height for i in ims)
cols=4; rows=(len(ims)+cols-1)//cols; S=Image.new('RGB',(cols*cw,rows*(ch+16)),'#111'); d=ImageDraw.Draw(S)
for n,(f,i) in enumerate(zip(fs,ims)):
  x,y=(n%cols)*cw,(n//cols)*(ch+16); S.paste(i,(x,y+16)); d.text((x+4,y+2),f.split('/')[-1][:-4],fill='#ffd')
S.save('shots/station_labels/contact_sheet.png')
