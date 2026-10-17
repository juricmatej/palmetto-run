// ---------- input ----------
const isTouch=matchMedia('(pointer:coarse)').matches;
const keys={};let mouse={x:0,y:0,t:-99,down:false},stick={id:null,ox:0,oy:0,x:0,y:0},touchFire=false;
const typing=()=>document.activeElement&&document.activeElement.tagName==='INPUT';
// One action map for every bindable key. ACTIONS is the source of truth, BINDS holds the live codes of each
// action, DEF the defaults. held(id) says if one of its codes is down, codeToAction(code) is the reverse.
// Digits 1-8, the mouse, the wheel steering and the touch buttons stay hard coded and are not in the map.
const ACTIONS=[
  {id:'up',label:'Forward',group:'Move',def:['KeyW','ArrowUp']},
  {id:'down',label:'Back',group:'Move',def:['KeyS','ArrowDown']},
  {id:'left',label:'Left',group:'Move',def:['KeyA','ArrowLeft']},
  {id:'right',label:'Right',group:'Move',def:['KeyD','ArrowRight']},
  {id:'sprint',label:'Sprint / handbrake',group:'Move',def:['ShiftLeft','ShiftRight']},
  {id:'jump',label:'Jump',group:'Move',def:['KeyC']},
  {id:'interact',label:'Enter / interact',group:'Move',def:['KeyE','KeyF']},
  {id:'shoot',label:'Shoot',group:'Move',def:['Space']},
  {id:'lockOn',label:'Lock-on',group:'Move',def:['KeyQ']},
  {id:'scope',label:'Sniper scope',group:'Move',def:['KeyZ']},
  {id:'wheel',label:'Weapon wheel',group:'Move',def:['Tab']},
  {id:'nextWeapon',label:'Next weapon',group:'Move',def:['KeyR']},
  {id:'prevWeapon',label:'Previous weapon',group:'Move',def:[]},
  {id:'handsUp',label:'Hands up / horn',group:'Move',def:['KeyH']},
  {id:'nitro',label:'Nitro',group:'Move',def:['KeyV']},
  {id:'phone',label:'Phone',group:'Interface',def:['KeyT']},
  {id:'radio',label:'Radio',group:'Interface',def:['KeyK']},
  {id:'drug',label:'Use drug',group:'Interface',def:['KeyN']},
  {id:'drugSwitch',label:'Switch drug',group:'Interface',def:['KeyB']},
  {id:'detonate',label:'Detonate',group:'Interface',def:['KeyG']},
  {id:'flares',label:'Flares',group:'Interface',def:['KeyX']},
  {id:'mute',label:'Mute',group:'Interface',def:['KeyM']},
  {id:'settings',label:'Settings',group:'Interface',def:['KeyP']},
  {id:'chat',label:'Chat',group:'Interface',def:['Enter']},
  {id:'quickChat',label:'Quick chat',group:'Interface',def:['KeyY']},
];
const DEF={},BINDS={},GRP={};for(const a of ACTIONS){DEF[a.id]=a.def.slice();BINDS[a.id]=a.def.slice();GRP[a.id]=a.group}
let BINDREF=Object.create(null),WALKC=Object.create(null),sprintOn=false,sprintUsed=false;
function rebuildBinds(){
  BINDREF=Object.create(null);WALKC=Object.create(null);
  for(const id in BINDS)for(const c of BINDS[id])if(!BINDREF[c])BINDREF[c]=id;
  // with the phone open the walk letters still move the player; the arrows stay on phone duty
  for(const a of['up','down','left','right'])for(const c of BINDS[a])if(!/^Arrow/.test(c))WALKC[c]=1;
}
rebuildBinds();
const codeToAction=c=>BINDREF[c]||null;
function held(id){const l=BINDS[id];if(l)for(let i=0;i<l.length;i++)if(keys[l[i]])return true;return false}
// rebinding capture: the next keydown belongs to the capture and the game ignores the key
let capAct=null,capMsg='';
addEventListener('keydown',e=>{
  if(capAct){capKey(e);return}
  if(e.code==='Escape'&&state==='shop')closeShop();
  if(e.code==='Escape'&&wheelOpen){closeWheel(false);return} // the wheel closes on Escape like any menu
  if(typing())return;
  if(e.isTrusted)padDev=false; // a real key switches the hints back to keyboard names; pad presses are synthetic
  if(phoneOpen&&!WALKC[e.code]){phoneKey(e);return}
  keys[e.code]=true;
  if(state==='menu'||state==='shop')return;
  if(phoneOpen){phoneKey(e);return}
  if(quickOpen){quickKey(e);return}
  if(wheelOpen)return; // the wheel owns the keyboard until it closes
  const act=codeToAction(e.code);
  if(act==='phone'){if(!e.repeat&&state==='play'&&!me.downed)phoneOpenNow(false);return}
  if(e.code==='Escape'&&lap){endLap();return}
  if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  switch(act){
    case'interact':if(!e.repeat&&!revNow)toggleCar();break; // a downed player in reach wins E, held for the revive
    case'jump':if(!e.repeat)jump();break;
    case'handsUp':if(!e.repeat)honk();break;
    case'nitro':if(!e.repeat)nitroTap();break;
    case'mute':if(!e.repeat)muted=!muted;break;
    case'radio':if(!e.repeat)cycleRadio();break;
    case'nextWeapon':if(!e.repeat)cycleWeapon();break;
    case'settings':if(!e.repeat&&state==='play'&&!me.downed)openSettings();break;
    case'wheel':if(!e.repeat)openWheel();break;
    case'detonate':if(!e.repeat)detonate();break;
    case'flares':if(!e.repeat)dropFlares();break;
    case'drug':if(!e.repeat)useDrug();break;
    case'drugSwitch':if(!e.repeat&&!me.downed)drugSel=(drugSel+1)%DK.length;break;
    case'scope':if(!e.repeat&&weap==='sniper'&&!me.car&&!me.downed)scoped=!scoped;break;
    case'sprint':if(!e.repeat&&settings.sprintMode==='toggle'){sprintOn=!sprintOn;sprintUsed=false}break;
    case'lockOn':if(!e.repeat&&state==='dead')spectateNext();break;
    case'chat':if(!e.repeat){if(state==='dead'){e.preventDefault();respawn()} // Enter respawns, it never opens the chat while dead
      else if(me.downed){e.preventDefault();bleedout()}
      else if(state==='play'&&!phoneOpen&&!wheelOpen){e.preventDefault();openChat()}}break;
    case'quickChat':if(!e.repeat&&state==='play'&&!wheelOpen&&!chatOpen){e.preventDefault();openQuick()}break;
  }
  if(/^Digit[1-8]$/.test(e.code))equip(WEAPONS[+e.code.slice(5)-1].id);
});
addEventListener('keyup',e=>{keys[e.code]=false;if(codeToAction(e.code)==='wheel')closeWheel(true)});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;mouse.down=false;touchFire=false;touchRev=false;sprintOn=sprintUsed=false;
  stick={id:null,ox:0,oy:0,x:0,y:0};look.id=null;heliUpT=heliDnT=false; // a touch stick or pad held through a tab switch must not stick
  if(capAct){capAct=null;capMsg='';paintKeys()}closeWheel(false)});
const look={yaw:-Math.PI/2,pitch:.2,id:null,lx:0,ly:0,off:0,offT:-9};let lastFireT=-9;
let settings={sens:1,inv:false,assist:8,veh:1,scope:.3,sprintMode:'hold',time:'auto'},qLock=null;
function saveSettings(){try{localStorage.setItem('pr-settings',JSON.stringify(settings))}catch(_){}}
function openSettings(){if(me.downed||state!=='play')return;capAct=null;capMsg='';
  $('setSens').value=settings.sens;$('setInv').checked=settings.inv;$('setAssist').value=String(settings.assist);
  $('setVeh').value=String(settings.veh);$('setScope').value=String(settings.scope);$('setSprintMode').value=settings.sprintMode;$('setTime').value=settings.time;
  paintKeys();openModal('settings')}
$('setTime').addEventListener('change',e=>{settings.time=e.target.value==='night'?'night':'auto';saveSettings();skyLook()});
$('setSens').addEventListener('input',e=>{settings.sens=+e.target.value;saveSettings()});
$('setInv').addEventListener('change',e=>{settings.inv=e.target.checked;saveSettings()});
$('setAssist').addEventListener('change',e=>{settings.assist=+e.target.value;saveSettings()});
$('setVeh').addEventListener('input',e=>{settings.veh=clamp(+e.target.value,.3,2);saveSettings()});
$('setScope').addEventListener('input',e=>{settings.scope=clamp(+e.target.value,.2,1);saveSettings()});
$('setSprintMode').addEventListener('change',e=>{settings.sprintMode=e.target.value==='toggle'?'toggle':'hold';if(settings.sprintMode!=='toggle')sprintOn=sprintUsed=false;saveSettings()});
// ---- binds: display names, saving, loading, the settings key list and the capture
const KEYNAME={ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right',Space:'Space',ShiftLeft:'Shift',ShiftRight:'Shift',ControlLeft:'Ctrl',ControlRight:'Ctrl',AltLeft:'Alt',AltRight:'Alt',Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Backslash:'\\',Tab:'Tab',Enter:'Enter'};
const codeName=c=>KEYNAME[c]||(/^Key/.test(c)?c.slice(3):/^Digit/.test(c)?c.slice(5):c);
const kb=id=>padDev&&PADNAME[id]?PADNAME[id]:[...new Set((BINDS[id]||[]).map(codeName))].join(' or ');
const BINDRE=/^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-2])|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Tab|Enter|Backquote|Minus|Equal|Bracket(Left|Right)|Semicolon|Quote|Comma|Period|Slash|Backslash)$/;
const validCode=c=>typeof c==='string'&&BINDRE.test(c);
function bindsOut(){const o={};for(const id in BINDS)o[id]=BINDS[id].slice();return o}
function saveBinds(){try{localStorage.setItem('pr-keys',JSON.stringify(bindsOut()))}catch(_){}}
// pr-keys: known action ids only, codes on the allowlist only. Saved codes win, then the defaults fill any
// action left empty, and a duplicate is dropped first-wins so no two actions ever share one code.
function loadBinds(d){
  if(!d||typeof d!=='object'||Array.isArray(d))return;
  const seen=Object.create(null),next={};
  for(const a of ACTIONS){
    const list=next[a.id]=[],src=Array.isArray(d[a.id])?d[a.id]:null;
    if(src)for(const c of src)if(validCode(c)&&!seen[c]){seen[c]=1;list.push(c)}
  }
  for(const a of ACTIONS)if(!next[a.id].length)for(const c of DEF[a.id])if(!seen[c]){seen[c]=1;next[a.id].push(c)}
  for(const a of ACTIONS)BINDS[a.id]=next[a.id];
  rebuildBinds();
}
// A code another action of the same group already holds is refused with "Used by X". A code from the other
// group moves over, so the map never holds two actions on one key and codeToAction stays unambiguous.
function bindErr(id,code){
  if(!BINDS[id]||!validCode(code))return 'That key is not supported';
  for(const a of ACTIONS)if(a.id!==id&&a.group===GRP[id]&&BINDS[a.id].includes(code))return 'Used by '+a.label;
  return null
}
function setBind(id,code){
  if(bindErr(id,code))return false;
  for(const a of ACTIONS)if(a.id!==id){const i=BINDS[a.id].indexOf(code);if(i>=0)BINDS[a.id].splice(i,1)}
  BINDS[id]=[code];rebuildBinds();return true;
}
function startCap(id){capAct=id;capMsg='';paintKeys()}
function focusChip(id){const b=$('keyList').querySelector(`button[data-k="${id}"]`);if(b){b.focus({preventScroll:true});b.scrollIntoView({block:'nearest'})}}
function capKey(e){
  e.preventDefault();
  const id=capAct;
  if(e.code==='Escape'){capAct=null;capMsg='';paintKeys();if(id)focusChip(id);return}
  if(!id||e.repeat)return;
  const err=bindErr(id,e.code);
  if(err){capMsg=err;paintKeys();return}
  setBind(id,e.code);capAct=null;capMsg='';saveBinds();paintKeys();focusChip(id);
}
function paintKeys(){
  const L=$('keyList');L.replaceChildren();let g='';
  for(const a of ACTIONS){
    if(a.group!==g){g=a.group;const h=document.createElement('div');h.className='kgh';h.textContent=g;L.appendChild(h)}
    const row=document.createElement('div');row.className='krow';
    const lb=document.createElement('span');lb.className='klb';lb.textContent=a.label;row.appendChild(lb);
    const cw=document.createElement('span');cw.className='kc';row.appendChild(cw);
    if(capAct===a.id){const s=document.createElement('span');s.className=capMsg?'kmsg':'kcap';s.textContent=capMsg||'Press a key';cw.appendChild(s)}
    else if(!BINDS[a.id].length){const s=document.createElement('span');s.className='knone';s.textContent=DEF[a.id].length?'Not bound':'Scroll up';cw.appendChild(s)}
    else for(const c of BINDS[a.id]){const b=document.createElement('button');b.type='button';b.className='kchip';b.dataset.k=a.id;b.textContent=codeName(c);b.onclick=e=>{if(e.detail&&!capAct)startCap(a.id)};cw.appendChild(b)}
    L.appendChild(row);
  }
}
$('keyList').addEventListener('keydown',e=>{
  if(capAct)return;
  const chips=[...$('keyList').querySelectorAll('.kchip')];if(!chips.length)return;
  if(e.code==='Enter'){const b=document.activeElement;if(b.classList&&b.classList.contains('kchip')){e.preventDefault();e.stopPropagation();startCap(b.dataset.k)}return}
  const d=e.code==='ArrowLeft'||e.code==='ArrowUp'?-1:e.code==='ArrowRight'||e.code==='ArrowDown'?1:0;
  if(!d)return;e.preventDefault();e.stopPropagation();
  const step=e.code==='ArrowUp'||e.code==='ArrowDown'?2:1;
  let i=chips.indexOf(document.activeElement);i=i<0?0:clamp(i+d*step,0,chips.length-1);
  chips[i].focus({preventScroll:true});chips[i].scrollIntoView({block:'nearest'});
});
$('setReset').addEventListener('click',()=>{capAct=null;capMsg='';for(const a of ACTIONS)BINDS[a.id]=DEF[a.id].slice();rebuildBinds();saveBinds();paintKeys()});
// lock-on aim assist: hold Q on foot. Turns look.yaw toward one target; the lock holds while the target lives and stays within 700 units.
function aimAssist(dt){
  if(!(held('lockOn')&&settings.assist>0&&state==='play'&&!me.downed&&!me.car&&!me.heli&&!me.jet&&!me.inside)){qLock=null;return}
  const groups=[peds.filter(p=>p.gang&&!p.down),[...remotes.values()].filter(r=>!r.dead&&!r.inCar&&!r.inHeli&&!r.inJet),cars.filter(c=>c.kind==='police'&&heat>0),peds.filter(p=>!p.gang&&!p.down)];
  const dist=o=>Math.hypot(o.x-me.x,o.y-me.y);
  let t=null;
  if(qLock&&groups.some(g=>g.includes(qLock))&&dist(qLock)<=700)t=qLock;
  if(!t)for(const g of groups){let bd=600;for(const o of g){const d=dist(o);if(d<bd&&Math.abs(wrap(Math.atan2(o.y-me.y,o.x-me.x)-look.yaw))<=.6){bd=d;t=o}}if(t)break}
  qLock=t;
  if(t)look.yaw+=clamp(wrap(Math.atan2(t.y-me.y,t.x-me.x)-look.yaw),-settings.assist*dt,settings.assist*dt);
}
function turn(dx,dy){dx*=settings.sens;dy*=settings.sens;if(settings.inv)dy=-dy;if(wheelOpen){wheelVec.x+=dx;wheelVec.y+=dy;const l=Math.hypot(wheelVec.x,wheelVec.y);if(l>120){wheelVec.x*=120/l;wheelVec.y*=120/l}if(l>25){const n=WEAPONS.length,i=((Math.round((Math.atan2(wheelVec.y,wheelVec.x)+Math.PI/2)/(TAU/n))%n)+n)%n;if(WEAPONS[i].id!==wheelSel){wheelSel=WEAPONS[i].id;paintWheel()}}return}const k=me.car?settings.veh:scoped?settings.scope:1;if(me.car){look.off=clamp(look.off+dx*.0026*k,-2.6,2.6);look.offT=time}else look.yaw+=dx*.0026*k;look.pitch=clamp(look.pitch+dy*.0022*k,-.45,1.3)}
function lockMouse(){if(isTouch||phoneOpen||chatOpen||document.pointerLockElement===cv)return;try{const p=cv.requestPointerLock();if(p&&p.catch)p.catch(()=>{})}catch(_){}}
cv.addEventListener('pointerdown',e=>{
  if(state==='menu')return;audioInit();
  if(e.pointerType==='mouse'){if(document.pointerLockElement!==cv){lockMouse();return}if(e.button===0)mouse.down=true;if(e.button===2&&weap==='sniper'&&!me.car)scoped=true;return}
  if(stick.id===null&&e.clientX<VW*.45){stick={id:e.pointerId,ox:e.clientX,oy:e.clientY,x:0,y:0};try{cv.setPointerCapture(e.pointerId)}catch(_){}}
  else if(look.id===null){look.id=e.pointerId;look.lx=e.clientX;look.ly=e.clientY;try{cv.setPointerCapture(e.pointerId)}catch(_){}}
});
cv.addEventListener('contextmenu',e=>e.preventDefault());
let wheelAt=0;
cv.addEventListener('wheel',e=>{e.preventDefault();const dy=e.deltaMode===1?e.deltaY*40:e.deltaY;if(e.ctrlKey||state!=='play'||wheelOpen||Math.abs(dy)<=4||performance.now()-wheelAt<180)return;wheelAt=performance.now();if(dy>0)cycleWeapon();else prevWeapon()},{passive:false});
cv.addEventListener('pointermove',e=>{
  if(e.pointerType==='mouse'){if(state!=='menu'&&state!=='shop'&&(document.pointerLockElement===cv||e.buttons))turn(e.movementX||0,e.movementY||0);return}
  if(e.pointerId===stick.id){let dx=(e.clientX-stick.ox)/55,dy=(e.clientY-stick.oy)/55;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l}stick.x=dx;stick.y=dy}
  else if(e.pointerId===look.id){turn((e.clientX-look.lx)*1.7,(e.clientY-look.ly)*1.7);look.lx=e.clientX;look.ly=e.clientY}
});
const endPtr=e=>{if(e.pointerType==='mouse'){if(e.button===0)mouse.down=false;if(e.button===2)scoped=false;return}if(e.pointerId===stick.id)stick={id:null,ox:0,oy:0,x:0,y:0};if(e.pointerId===look.id)look.id=null};
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
addEventListener('mouseup',e=>{if(e.button===0)mouse.down=false});

$('bFire').addEventListener('pointerdown',e=>{e.preventDefault();touchFire=true;audioInit()});
['pointerup','pointercancel','pointerleave'].forEach(t=>$('bFire').addEventListener(t,()=>touchFire=false));
// CAR is also the revive hold when a downed player is in reach, so touch gets the same 3 s revive
$('bCar').addEventListener('pointerdown',e=>{e.preventDefault();if(state==='play'&&!me.downed&&revNow){touchRev=true;return}toggleCar()});
['pointerup','pointercancel','pointerleave'].forEach(t=>$('bCar').addEventListener(t,()=>{touchRev=false}));
$('bNext').addEventListener('pointerdown',e=>{e.preventDefault();if(state==='dead')spectateNext()});
$('bRespawn').addEventListener('pointerdown',e=>{e.preventDefault();if(state==='dead')respawn()});
$('downGive').addEventListener('click',()=>{if(me.downed)bleedout()});
let gunHold=null,gunHeld=false;
$('bGun').addEventListener('pointerdown',e=>{e.preventDefault();gunHeld=false;clearTimeout(gunHold);gunHold=setTimeout(()=>{gunHeld=true;openWheel()},280)});
for(const[id,set]of[['bUp',v=>heliUpT=v],['bDn',v=>heliDnT=v]]){$(id).addEventListener('pointerdown',e=>{e.preventDefault();set(true)});for(const t of['pointerup','pointercancel','pointerleave'])$(id).addEventListener(t,()=>set(false))}
$('bNose').addEventListener('pointerdown',e=>{e.preventDefault();useDrug()});
$('bFlare').addEventListener('pointerdown',e=>{e.preventDefault();dropFlares()});
$('bBoom').addEventListener('pointerdown',e=>{e.preventDefault();detonate()});
$('bAim').addEventListener('pointerdown',e=>{e.preventDefault();if(weap==='sniper'&&!me.car)scoped=!scoped});
$('bGun').addEventListener('pointerup',()=>{clearTimeout(gunHold);if(!gunHeld)cycleWeapon()});
if(DBG)Object.defineProperties(DBG,{qLock:{get:()=>qLock},settings:{get:()=>settings},binds:{get:()=>bindsOut()},setBind:{get:()=>setBind}});
// ---------- gamepad ----------
// Standard Mapping, polled every frame. A button sends a synthetic key event with the first bound code of its action,
// so the keyboard handlers above do the work. The left stick fills the stick that touch uses; the right stick calls turn().
const PADACT={0:'interact',1:'phone',2:'nextWeapon',3:'wheel',5:'nextWeapon',6:'lockOn',7:'shoot',9:'settings',10:'sprint'};
const PADNAME={interact:'A',phone:'B',nextWeapon:'X',wheel:'Y',prevWeapon:'LB',lockOn:'LT',shoot:'RT',settings:'Start',sprint:'L3'};
const padState={on:false,dev:'keys',lx:0,ly:0,rx:0,ry:0,down:[],sent:0};
let padDev=false,padPrev=[],padT=0;
const padDZ=v=>Math.abs(v)<.15?0:v;
function padStep(dt){
  const pad=[...(navigator.getGamepads?navigator.getGamepads():[])].find(p=>p&&p.mapping==='standard')||null;
  const b=pad?pad.buttons.map(x=>!!x.pressed):[],[lx=0,ly=0,rx=0,ry=0]=pad?pad.axes.map(padDZ):[];
  Object.assign(padState,{on:!!pad,lx,ly,rx,ry,down:b.flatMap((d,i)=>d?[i]:[])});
  for(let i=0;i<11;i++){
    const d=!!b[i];
    if(d===!!padPrev[i])continue;
    padPrev[i]=d;if(d)padDev=true;
    if(i===4){if(d&&state==='play'&&!wheelOpen)prevWeapon();continue} // LB has no key
    const code=PADACT[i]&&BINDS[PADACT[i]][0];
    if(!code||capAct)continue;
    padState.sent++;
    dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code}));
  }
  const uiHold=typing()||chatOpen||quickOpen; // typing or a wheel on screen: the pad keeps its hands to itself
  if(!uiHold&&(lx||ly)){if(stick.id===null||stick.id==='pad'){stick={id:'pad',ox:0,oy:0,x:lx,y:ly};padDev=true}}
  else if(stick.id==='pad')stick={id:null,ox:0,oy:0,x:0,y:0};
  if(!uiHold&&!phoneOpen&&(rx||ry)&&state!=='menu'&&state!=='shop'){turn(rx*700*dt,ry*700*dt);padDev=true}
  padState.dev=padDev?'pad':'keys';
}
// start on the next frame: the first poll must not run before the rest of the IIFE has declared its state
requestAnimationFrame(function padLoop(t){if(padT)padStep(Math.min(.05,(t-padT)/1000));padT=t;requestAnimationFrame(padLoop)});
if(DBG)Object.defineProperties(DBG,{pad:{get:()=>padState}});
// debug only: a fake Standard Mapping pad, stick pushed forward, A pressed for 0.6 s
if(DBG)DBG.padTest=()=>{const p={id:'fake',mapping:'standard',connected:true,axes:[0,-1,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[p];setTimeout(()=>p.buttons[0].pressed=true,300);setTimeout(()=>{p.buttons[0].pressed=false;p.axes[1]=0},900)};

