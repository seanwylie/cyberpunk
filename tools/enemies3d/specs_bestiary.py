# Bestiary batch 1 (docs/BESTIARY.md): non-robot mobs. Palettes are organic (flesh / chitin / wet) with a cyber accent glow.
FLESH=dict(main='#6a3a36',dark='#1c1210',accent='#8a5a3a',metal='#6a6660',cloth='#3a2a28',glow='#ff5a2a',white='#c9b8a8',flesh='#8a4a44',chitin='#2a1e1a')
BONE=dict(main='#b8aa94',dark='#241e1a',accent='#6a8a8a',metal='#7a7870',cloth='#4a423a',glow='#50e0d0',white='#d8d0c0',flesh='#a86a62',chitin='#3a302a')
SWAMP=dict(main='#4a5a3a',dark='#161a10',accent='#a0b050',metal='#6a7060',cloth='#2a3020',glow='#b0ff50',white='#b0b890',flesh='#6a7a4a',chitin='#262a1a',gel='#9ac0a0')
SKY=dict(main='#4a5a78',dark='#12161e',accent='#8ab0e0',metal='#6a7080',cloth='#262e40',glow='#70c0ff',white='#b8c8d8',flesh='#7a6a86',chitin='#22263a',gel='#a0b8d8')
def P(b,**k): d=dict(b); d.update(k); return d
BESTIARY = {
 'gutterling':  dict(arch='swarm', palette=P(FLESH,main='#5a3a30'), extras=('wired',), n=9, scale=1.0, seed=3),
 'slagleech':   dict(arch='worm', palette=P(FLESH,flesh='#7a4034',accent='#d06a2a',glow='#ff7a2a'), extras=('glowtail',), segs=8, scale=1.0, ortho=3.6),
 'soothsac':    dict(arch='sac', palette=P(SWAMP,glow='#d0e060',gel='#b0c090'), extras=('eyes',), scale=1.0),
 'stitchspider':dict(arch='arach', palette=P(BONE,chitin='#2a2624'), extras=('sacglow',), eyes=6, scale=1.0),
 'drapejelly':  dict(arch='jelly', palette=P(SKY), extras=('stingtips',), tents=8, scale=1.0),
 'fittingdoll': dict(arch='doll', palette=P(BONE,glow='#ff4a4a'), extras=('smile','eyeholes'), scale=1.0, alen=.62),
 'hangtick':    dict(arch='arach', palette=P(SWAMP,flesh='#7a5a46'), extras=('tick','lamprey'), eyes=2, legs=6, scale=.9, L1=.6, L2=.8, hip_z=.7),
 'meatcarrier': dict(arch='many', palette=P(FLESH,main='#6a5a4a'), extras=('pile','maw','claws'), limbs=5, eyes=2, scale=1.15),
 'hollowghost': dict(arch='phantom', palette=P(SKY,glow='#70e0ff'), extras=('veil',), scale=1.25),
 'rootcluster': dict(arch='sac', palette=P(SWAMP,flesh='#5a7a4a',glow='#c0ff70'), extras=('fungal',), scale=1.0),
 'squidwalker': dict(arch='many', palette=P(SKY,flesh='#6a5a7a',glow='#ff80c0'), extras=('maw','chitin'), limbs=6, eyes=3, scale=1.2),
 'glitchshard': dict(arch='phantom', palette=P(SKY,glow='#ff50ff'), extras=('glitch',), scale=1.0, seed=9),
 'crabgun':     dict(arch='arach', palette=P(FLESH,main='#5a4a3a',chitin='#32261e',glow='#ffa030'), extras=('crab',), eyes=2, legs=6, scale=1.1, hip_z=.5, L1=.4, L2=.6),
 'fleshdrone':  dict(arch='jelly', palette=P(BONE,flesh='#b06a62',glow='#ff5050'), extras=('organs','drone','syringes'), tents=5, scale=.9),
}
