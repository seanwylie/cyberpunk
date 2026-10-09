# Extra PBR maps for the alternate body variants (heavy-industrial red steel, slate surgical drape, burlap drape).
# Usage: textures_variants.py OUTDIR   (reuses the helpers from textures.py without re-running its generators)
import sys, os
_src=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'textures.py')).read().split('\n')
exec('\n'.join(_src[:_src.index('out=sys.argv[1]; os.makedirs(out,exist_ok=True)')]))
out=sys.argv[1]; os.makedirs(out,exist_ok=True)
# ---- oxide-red painted steel: chipped paint, rust bleed, hazard-grey edges, stencil bars, rivet rows
def plate(d):
    for gx in range(0,S,256):
        for gy in range(0,S,342):
            d.rectangle([gx+3,gy+3,gx+253,gy+339],outline=255,width=5)
            for dx,dy in ((18,18),(238,18),(18,324),(238,324)): d.ellipse([gx+dx-8,gy+dy-8,gx+dx+8,gy+dy+8],fill=210,outline=255)
pm=paint(plate)
base=lerp(hexc('#6f2a1f'),hexc('#93402e'),smooth(N(2.2,111),0.3,0.75)); col=base*(0.88+0.24*N(1.2,112)[...,None])
chip=smooth(N(2.0,113),0.58,0.7)*(0.5+blur(pm,2)*0.7)+smooth(scratches(114,150,150,2),0.35,0.6)*0.7
col=lerp(col,hexc('#7c7d78'),np.clip(chip,0,1)*0.85)
rust=smooth(N(2.8,115),0.6,0.8)*(0.4+np.clip(chip,0,1)); col=lerp(col,hexc('#5b3a24'),np.clip(rust,0,1)*0.7)
col=col*(1-0.55*blur(pm*(pm>0.9),1.8)[...,None])*(1-0.4*grime(116,0.5)[...,None])
h=0.5+0.25*blur(pm,2)-0.5*blur((pm>0.95).astype('float32'),1.2)+0.12*N(1.0,117)-0.2*np.clip(chip,0,1)
save('redsteel',col,np.stack([np.clip(0.5+0.3*N(1.5,118)-0.2*np.clip(chip,0,1)*-1,0,1)]*3,-1),np.stack([np.clip(h,0,1)]*3,-1),out)
# ---- slate-blue surgical drape: soft woven grey-blue linen with faint stains/folds
wv=weave(240,sharp=1.1); col=lerp(hexc('#3b4552'),hexc('#68727c'),smooth(N(2.3,121),0.3,0.8)); col=col*(0.82+0.3*wv[...,None])
col=col*(1-0.3*grime(122,0.55)[...,None]); col=lerp(col,hexc('#8d8e86'),0.2*smooth(scratches(123,60,120,2),0.3,0.7))
stain=smooth(N(2.4,124),0.62,0.8); col=lerp(col,hexc('#5b4a3c'),0.35*stain[...,None])
save('slate',col,np.stack([0.92-0.1*wv]*3,-1),np.stack([np.clip(0.3+0.45*wv+0.15*N(1.5,125),0,1)]*3,-1),out)
# ---- burlap/sacking drape (mass-market repurposed cloth)
wv=weave(120,sharp=0.9); col=lerp(hexc('#6a5f45'),hexc('#8f8460'),smooth(N(2.2,131),0.3,0.8)); col=col*(0.78+0.35*wv[...,None]); col=col*(1-0.35*grime(132,0.5)[...,None])
save('burlap',col,np.stack([np.full((S,S),0.95)]*3,-1),np.stack([np.clip(0.25+0.5*wv,0,1)]*3,-1),out)
# ---- dark hammertone iron (heavy industrial frame / pistons)
mt=lerp(hexc('#26282a'),hexc('#4a4d4e'),smooth(N(2.0,141),0.3,0.8)); mt=lerp(mt,hexc('#5a3e2a'),0.5*smooth(N(2.6,142),0.62,0.8)); mt=lerp(mt,hexc('#9a9b95'),0.4*smooth(scratches(143,220,100,1),0.3,0.7))
save('iron',mt,np.stack([np.clip(0.42+0.3*N(1.2,144),0,1)]*3,-1),np.stack([np.clip(0.5+0.3*N(0.8,145),0,1)]*3,-1),out)
print('wrote variant textures',out)
