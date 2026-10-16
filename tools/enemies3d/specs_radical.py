# Stage 3: elite/boss humanoid+bruiser mobs -> radical replacement on the base body (arch_radical.py). mfr + boss from src content.
RADICAL = {
  'sawhand':('HI',0),'brakeman':('HI',0),'quenchpriest':('HI',0),'enforcer':('HI',1),'teague':('HI',1),'brannoch':('HI',1),
  'matron':('PS',0),'anesthetist':('PS',0),'surgeon':('PS',1),'recovered':('PS',1),
  'foreman':('MM',0),'shiftlead':('MM',0),'hobbs':('MM',0),'overseer':('MM',1),'stockmgr':('MM',1),'retrieval':('MM',1),'reclaimer':('MM',1),
}
def apply(SPECS):
    for k,(m,b) in RADICAL.items():
        s=SPECS.get(k)
        if s and s['arch'] in ('humanoid','bruiser'): s.update(arch='rhum' if s['arch']=='humanoid' else 'rbru', mfr=m, boss=bool(b))

# Silhouette/scale pass: unique read per elite/boss at 160px. bulk=(bx,by) body breadth/depth; grow=uniform scale in the same frame
# (elites >= old size, bosses clearly biggest); look: head shape, signature limbs, back unit, extra arm, piston legs.
LOOK = {
  # HI
  'sawhand':     dict(bulk=(2.0,1.6),  grow=1.0, look=dict(tools={'R':'saw'}, back='tanks')),
  'brakeman':    dict(bulk=(2.15,1.7), grow=1.0, look=dict(tools={'R':'hammer','L':'clamp'}, head='bucket', back='stacks')),
  'quenchpriest':dict(bulk=(1.35,1.2), grow=1.0, look=dict(tools={'L':'blade'}, piston=('L','R'))),
  'enforcer':    dict(bulk=(2.25,1.8), grow=1.0,  look=dict(donor=True, head='round', back='stacks', xarm='L')),
  'teague':      dict(bulk=(2.4,1.9),  grow=1.0, look=dict(head='flat', tools={'R':'hammer','L':'hammer'}, back='tanks', piston=('L','R'))),
  'brannoch':    dict(bulk=(2.3,1.85), grow=1.0, look=dict(tools={'L':'clamp'}, back='stacks')),
  # PS
  'matron':      dict(bulk=(1.5,1.3),  grow=1.0,  look=dict(back='ribs')),
  'anesthetist': dict(bulk=(1.3,1.15), grow=1.0, look=dict(tools={'L':'blade'}, back='tanks', piston=('R',))),
  'surgeon':     dict(bulk=(1.55,1.3), grow=1.0,  look=dict(tools={'R':'blade','L':'blade'}, back='ribs', xarm='R', piston=('L','R'))),
  'recovered':   dict(bulk=(1.7,1.45), grow=1.0, look=dict(donor=True, back='ribs', xarm='L')),
  # MM (were look-alikes)
  'foreman':     dict(bulk=(2.2,1.75), grow=1.0, look=dict(tools={'R':'clamp','L':'clamp'}, head='dome', back='toolbox', piston=())),
  'shiftlead':   dict(bulk=(1.3,1.15), grow=1.0,  look=dict(tools={'L':'drill'}, head='crt', back='mast', piston=('L','R'))),
  'hobbs':       dict(bulk=(2.5,2.0),  grow=1.0,  look=dict(head='bucket', xarm='R', piston=())),
  'overseer':    dict(bulk=(2.3,1.85), grow=1.0, look=dict(tools={'L':'drill'}, head='periscope', back='stacks', xarm='R')),
  'stockmgr':    dict(bulk=(2.1,1.7),  grow=1.0,  look=dict(tools={'R':'tines','L':'tines'}, head='flat', back='mast', piston=('L','R'))),
  'retrieval':   dict(bulk=(1.8,1.5),  grow=1.0, look=dict(donor=True, tools={'R':'longclaw'}, head='crt', back='reel', piston=('R',))),
  'reclaimer':   dict(bulk=(2.35,1.9), grow=1.0,  look=dict(tools={'R':'saw'}, head='round', back='drum', piston=('L',))),
}
ORTHOK={'brannoch':1.26,'enforcer':1.18,'overseer':1.12,'retrieval':1.2,'teague':1.08,'reclaimer':1.14,'recovered':1.08,'surgeon':1.06,'quenchpriest':1.06,'anesthetist':1.06}   # frame headroom only (game size is art.h, normalised by hpx)
_apply0=apply
def apply(SPECS):
    _apply0(SPECS)
    for k,v in LOOK.items():
        if k in SPECS: SPECS[k].update(v); SPECS[k].setdefault('shift',.30); SPECS[k].setdefault('orthoK',ORTHOK.get(k,1.0))
