// Recurring cast: fixers, traders, technicians and corporate handlers, plus their deterministic contracts.
// Contracts are GAME-OWNED: fixed goals and fixed credit/reputation rewards. The story system may only choose which contact
// speaks and which clue/arc is surfaced; it never creates contracts, items, odds or rewards.
// ART NEEDED: portraits for every contact (none exist yet; the UI uses a stencil monogram).
import type { Mfr } from '../config';
export type GoalKind='kill_mfr'|'kill_type'|'clear'|'condition'|'route'|'pickup'|'boss';
export interface Goal { kind:GoalKind; key?:string; dungeon?:string; n:number; }
export interface ContractDef { id:string; title:string; text:string; goal:Goal; reward:{ credits:number; rep?:Partial<Record<Mfr,number>> }; minLevel:number; repeat:'daily'|'once'; }
export interface ContactDef { id:string; name:string; role:'fixer'|'trader'|'technician'|'handler'; faction:Mfr|'independent'; district:string; bio:string; greeting:string; contracts:ContractDef[]; }
export const CONTACTS:ContactDef[]=[
  { id:'odalys_vane', name:'Odalys Vane', role:'fixer', faction:'independent', district:'Rustline Market', bio:'Sells Annex contracts out of a tarp stall. Keeps three ledgers and shows nobody the third.', greeting:'"Run the Annex and I will know. Come back with news."',
    contracts:[
      { id:'od_floor_sweep', title:'Floor sweep', text:'Thin out Kestrel contractors anywhere. The Annex keeps hiring more.', goal:{kind:'kill_mfr',key:'MM',n:25}, reward:{credits:180,rep:{MM:3}}, minLevel:1, repeat:'daily' },
      { id:'od_annex_clear', title:'Annex clearance', text:'Finish the Reclamation Annex. Controller secured, boss down.', goal:{kind:'clear',dungeon:'annex',n:1}, reward:{credits:400,rep:{HI:4}}, minLevel:10, repeat:'daily' } ] },
  { id:'tech_marr', name:'Marr', role:'technician', faction:'independent', district:'Rustline Market', bio:'Reads replacement-part markings the way others read faces. Will not say who taught them.', greeting:'"Show me the stencil and I will tell you what it wakes."',
    contracts:[ { id:'tm_markings', title:'Read the markings', text:'Trigger any boss-selection condition in any dungeon. I need to see what it does.', goal:{kind:'condition',n:2}, reward:{credits:260,rep:{HI:2,PS:2,MM:2}}, minLevel:10, repeat:'daily' } ] },
  { id:'handler_cole', name:'Cole', role:'handler', faction:'MM', district:'Kestrel Row', bio:'Kestrel Value Systems asset recovery. Tracks controllers and refurbishments that went missing after resale.', greeting:'"Missing units, missing controllers. Same thing on the ledger."',
    contracts:[
      { id:'hc_hub_clear', title:'Hub 9 audit', text:'Clear Kestrel Distribution Hub 9 and bring the sort controller back online.', goal:{kind:'clear',dungeon:'warehouse',n:1}, reward:{credits:320,rep:{MM:6}}, minLevel:8, repeat:'daily' },
      { id:'hc_lazarus', title:'Close Lazarus', text:'Jump-start the returns cradle at Hub 9. Kestrel wants LAZARUS-LITE found, then closed.', goal:{kind:'condition',dungeon:'warehouse',key:'B',n:1}, reward:{credits:380,rep:{MM:5}}, minLevel:8, repeat:'once' } ] },
  { id:'ten_hallowell', name:'Teodor "Ten" Hallowell', role:'fixer', faction:'HI', district:'Harrow Reach', bio:'Retired Line 7 shift lead turned fixer. Still hears the shift horn. Sells foundry contracts to anyone with force hardware.', greeting:'"The horn has not stopped in nine days. Somebody go shut the line."',
    contracts:[
      { id:'th_cinders', title:'Cinder count', text:'Put down Harrow-Brandt units. They are not people anymore; I checked.', goal:{kind:'kill_mfr',key:'HI',n:30}, reward:{credits:260,rep:{HI:4}}, minLevel:18, repeat:'daily' },
      { id:'th_foundry_clear', title:'Silence Line 7', text:'Clear the Foundry. Seize the pour controller, put the boss down.', goal:{kind:'clear',dungeon:'foundry',n:1}, reward:{credits:800,rep:{HI:8}}, minLevel:18, repeat:'daily' },
      { id:'th_tyrant', title:'Wake the Tyrant', text:'Shear the casting-line interlock and put Brannoch down.', goal:{kind:'boss',key:'brannoch',n:1}, reward:{credits:900,rep:{HI:10}}, minLevel:22, repeat:'once' } ] },
  { id:'noor_abiodun', name:'Noor Abiodun', role:'fixer', faction:'independent', district:'Aldane Terrace', bio:'Street clinician who patches contractors for free and sells Ward 9 leads for a price. Keeps her own scars unrepaired.', greeting:'"Ward 9 is closed. The lights are still on."',
    contracts:[
      { id:'na_ward_clear', title:'Open the ward', text:'Clear Ward 9 and take the fabricator core.', goal:{kind:'clear',dungeon:'clinic',n:1}, reward:{credits:950,rep:{PS:8}}, minLevel:22, repeat:'daily' },
      { id:'na_quiet', title:'Quiet entry', text:'Unseal the recovery cell with a cloak weave. I want to know who is in there.', goal:{kind:'condition',dungeon:'clinic',key:'B',n:1}, reward:{credits:1000,rep:{PS:10}}, minLevel:24, repeat:'once' } ] },
  { id:'pell_okafor', name:'Pell Okafor', role:'trader', faction:'independent', district:'Rustline Market', bio:'Resells everything twice. Trades in salvage, hardware and rumours, and believes the three are the same product.', greeting:'"Everything is secondhand. Some of it is secondhand twice."',
    contracts:[ { id:'po_haul', title:'Haul', text:'Bring back 8 pieces of anything. I do not ask where it came from.', goal:{kind:'pickup',n:8}, reward:{credits:140}, minLevel:1, repeat:'daily' } ] },
  { id:'ilya_sen', name:'Ilya Sen', role:'technician', faction:'PS', district:'Aldane Terrace', bio:'Ceramics technician who left Aldane with three fingers of calibration notes. Reads Aldane weave patterns by touch.', greeting:'"Cold ceramic, clean cut. That is how you know it is Aldane."',
    contracts:[ { id:'is_named', title:'Name the staff', text:'Put down Matron Verhoeven or Dr. Quill. I need their implants intact.', goal:{kind:'kill_type',key:'matron',n:1}, reward:{credits:600,rep:{PS:5}}, minLevel:22, repeat:'once' } ] },
  { id:'liaison_costa', name:'Dr. Mireille Costa', role:'handler', faction:'PS', district:'Aldane Terrace', bio:'Aldane Surgical compliance liaison. Writes the audit commands the Annex terminals obey and denies writing them.', greeting:'"This conversation is an audit. All conversations are audits."',
    contracts:[ { id:'lc_audit', title:'Audit commissions', text:'Complete three hack-route actions (relays, consoles, terminals) in any dungeon.', goal:{kind:'route',key:'hack',n:3}, reward:{credits:320,rep:{PS:5}}, minLevel:10, repeat:'daily' } ] },
  { id:'liaison_dunmore', name:'Rhea Dunmore', role:'handler', faction:'HI', district:'Harrow Reach', bio:'Harrow-Brandt reclaim liaison. Counts everything that leaves a Harrow facility, including the people.', greeting:'"Reclaim is not theft. Reclaim is theft with a form."',
    contracts:[ { id:'ld_reclaim', title:'Reclaim actions', text:'Force three doors, levers or latches in any dungeon. Reclaim wants the stock.', goal:{kind:'route',key:'force',n:3}, reward:{credits:320,rep:{HI:5}}, minLevel:10, repeat:'daily' } ] },
];
export const CONTACT_BY_ID:Record<string,ContactDef>=Object.fromEntries(CONTACTS.map(c=>[c.id,c]));
export const CONTRACT_BY_ID:Record<string,ContractDef&{contact:string}>=Object.fromEntries(CONTACTS.flatMap(c=>c.contracts.map(k=>[k.id,{...k,contact:c.id}])));
export const MAX_ACTIVE_CONTRACTS=4;
