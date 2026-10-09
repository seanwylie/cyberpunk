# Per-enemy specs: archetype + palette + parts. Palettes follow the concept sheets (public/dungeons/source/enemies_*.jpg).
ANIM_SPEC = {  # n frames, fps (game playback), loop, hit frame (attack)
    'idle':   dict(n=8,  fps=6,  loop=True,  hit=None),
    'walk':   dict(n=8,  fps=12, loop=True,  hit=None),
    'attack': dict(n=10, fps=14, loop=False, hit=4),
    'hit':    dict(n=4,  fps=16, loop=False, hit=None),
    'death':  dict(n=10, fps=10, loop=False, hit=None),
}
OLIVE=dict(main='#4a4d34', dark='#262820', accent='#5d6141', metal='#6d6f68', cloth='#3b3e2a')
RED=dict(main='#6d2a22', dark='#2a1a17', accent='#8c3a2c', metal='#6b6560', cloth='#3a2420', glow='#d8541e')
SPECS = {
    'worker':   dict(arch='humanoid', palette=dict(OLIVE, main='#4c5036', accent='#3f432c'), weapon_R='drill', swing=1.0, pack=True, scale=1.0),
    'shooter':  dict(arch='humanoid', palette=dict(OLIVE, main='#454b33', accent='#565b3f'), weapon_R='rifle', nvg=True, pack=True, scale=1.05),
    'turret':   dict(arch='turret', palette=dict(RED, main='#7a2f25', accent='#9a4132', dark='#2c2220'), scale=1.0),
    'sawhand':  dict(arch='bruiser', palette=RED, weapon_R='saw', scale=1.15, pack=False),
    'foreman':  dict(arch='bruiser', palette=dict(OLIVE, main='#4f5336', accent='#666b48'), weapon_L='claws', weapon_R='fist', scale=1.1, antenna=True),
    'overseer': dict(arch='bruiser', palette=dict(OLIVE, main='#5a5e3d', accent='#6b7048', dark='#22241c'), weapon_L='slab', weapon_R='slab', scale=1.55, antenna=True, pack=True),
    'warden':   dict(arch='hover', palette=dict(main='#b9bbb4', dark='#2b2e33', accent='#4f6479', metal='#7f8488', white='#cfd1cb', glow='#7fb0d8'), scale=1.35),
    'enforcer': dict(arch='bruiser', palette=dict(RED, main='#63271f', accent='#7f3427'), weapon_R='scythe', weapon_L='fist', scale=1.55),
}
