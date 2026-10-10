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
# ---- remaining enemies (Foundry / Clinic / Warehouse + drone): same archetypes, faction palettes ----
FND=dict(main='#5a3a2a', dark='#241b17', accent='#8a4a24', metal='#6b625c', cloth='#33241c', glow='#ff7a1e')
CLN=dict(main='#c9cdc8', dark='#2c3438', accent='#3f8a8c', metal='#8a9498', cloth='#aeb8b6', glow='#40e0d0', white='#e4e6e1')
WHS=dict(main='#b08a2a', dark='#272a30', accent='#3d5670', metal='#7c8288', cloth='#3a3f46', glow='#ffc21a', white='#d2d0c4')
SPECS.update({
 'slaghauler': dict(arch='humanoid', palette=FND, weapon_R='fist', weapon_L='fist', extras=('tank',), scale=1.1, swing=1.1),
 'ladlecrew':  dict(arch='humanoid', palette=dict(FND, main='#6a4a30'), weapon_R='rifle', extras=('tank','visor'), scale=1.05),
 'cinderhound':dict(arch='quad', palette=dict(FND, main='#4a3328', accent='#9a3a18'), scale=1.0),
 'slagcannon': dict(arch='turret', palette=dict(FND, main='#7a4a28', accent='#ff7a1e'), scale=1.15),
 'brakeman':   dict(arch='bruiser', palette=dict(FND, main='#4a2f24', accent='#a05a2a'), weapon_R='fist', weapon_L='claws', extras=('hat','plate'), scale=1.35),
 'quenchpriest':dict(arch='humanoid', palette=dict(FND, main='#3a2a30', accent='#c85a1a', cloth='#2a1c22'), weapon_R='rifle', extras=('robe','cone','tank'), scale=1.3),
 'teague':     dict(arch='bruiser', palette=dict(FND, main='#5a3422', accent='#c06a2a'), weapon_L='slab', weapon_R='slab', extras=('tank','hat','plate'), scale=1.85, antenna=True),
 'brannoch':   dict(arch='bruiser', palette=dict(FND, main='#4a2a22', accent='#8a2a1a', glow='#ff4a1e'), weapon_R='ladle', weapon_L='fist', extras=('horns','plate'), scale=1.9),
 'ore9':       dict(arch='hover', palette=dict(main='#6a5a52', dark='#201a18', accent='#c0541a', metal='#7a6a62', white='#8a7a70', glow='#ff7a1e'), scale=1.7),
 'orderly':    dict(arch='humanoid', palette=CLN, weapon_R='baton', extras=('apron','cross'), scale=1.05),
 'nursebot':   dict(arch='humanoid', palette=CLN, weapon_R='rifle', extras=('apron','cross','cone'), scale=1.0, swing=.8),
 'gurneyrunner':dict(arch='cart', palette=CLN, scale=1.0),
 'sentry':     dict(arch='turret', palette=dict(CLN, main='#d4d8d3', dark='#2c3438'), scale=1.0),
 'matron':     dict(arch='humanoid', palette=dict(CLN, accent='#a03a4a', main='#bfc4c0'), weapon_R='scalpel', weapon_L='fist', extras=('apron','cross','hat'), scale=1.35),
 'anesthetist':dict(arch='humanoid', palette=dict(CLN, main='#8fb0b4', accent='#2a5a60'), weapon_R='rifle', extras=('mask','tank','apron'), scale=1.3),
 'surgeon':    dict(arch='humanoid', palette=dict(CLN, main='#5a8a8c', accent='#d4d8d3', dark='#1e2a2c'), weapon_R='scalpel', weapon_L='scalpel', extras=('apron','mask','visor'), scale=1.7, antenna=True),
 'autosurgeon':dict(arch='hover', palette=dict(main='#d4d8d3', dark='#232a2e', accent='#3f8a8c', metal='#9aa4a8', white='#e4e6e1', glow='#40e0d0'), scale=1.8),
 'recovered':  dict(arch='bruiser', palette=dict(main='#8a8478', dark='#2a2624', accent='#5a2a2a', metal='#6a6660', cloth='#d0cbbe', glow='#c04040'), weapon_L='claws', weapon_R='claws', extras=('robe',), scale=1.75),
 'picker':     dict(arch='humanoid', palette=WHS, weapon_R='fist', extras=('hivis',), scale=.92, swing=1.2),
 'loader':     dict(arch='bruiser', palette=dict(WHS, main='#3d5670', accent='#b08a2a'), weapon_R='slab', extras=('hivis',), scale=1.05),
 'forkbot':    dict(arch='cart', palette=dict(WHS), fork=True, scale=1.0),
 'scanner':    dict(arch='hover', palette=dict(main='#c9c8bc', dark='#272a30', accent='#3d5670', metal='#7c8288', white='#d2d0c4', glow='#ffc21a'), scale=.8),
 'camgun':     dict(arch='turret', palette=dict(WHS, main='#8a9096', accent='#3d5670'), scale=.9),
 'shiftlead':  dict(arch='humanoid', palette=dict(WHS, main='#3d5670', accent='#b08a2a'), weapon_R='baton', weapon_L='fist', extras=('hivis','hat'), scale=1.35, antenna=True),
 'hobbs':      dict(arch='bruiser', palette=dict(WHS, main='#8a6a22', accent='#272a30'), weapon_R='slab', weapon_L='fist', extras=('hivis','hat'), scale=1.35),
 'stockmgr':   dict(arch='bruiser', palette=dict(WHS, main='#3d4a5a', accent='#c9a02a'), weapon_R='slab', weapon_L='slab', extras=('plate','visor'), scale=1.8, antenna=True),
 'retrieval':  dict(arch='bruiser', palette=dict(WHS, main='#5a5e66', dark='#1c1e22', accent='#ffc21a', glow='#ff3a1a'), weapon_R='claws', weapon_L='claws', extras=('plate','visor'), pack=True, scale=2.1),
 'reclaimer':  dict(arch='bruiser', palette=dict(WHS, main='#6a4a34', dark='#1c1a1a', accent='#c9a02a', glow='#ff6a1a'), weapon_R='saw', weapon_L='claws', extras=('hivis','visor'), scale=1.85),
 'drone':      dict(arch='hover', palette=dict(main='#7a7e80', dark='#202428', accent='#4f6479', metal='#8a9094', white='#a8acae', glow='#ff5a3a'), scale=.6),
})

try:
    from specs_batch1 import BATCH1
    SPECS.update(BATCH1)
except ImportError: pass
