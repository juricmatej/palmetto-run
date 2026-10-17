// ---------- the Union Job (co-op heist) ----------
const heist={on:false,seed:0,bits:0,drill:0,drilling:false,looted:{},carry:0,alarm:false,briefed:false,hackLog:[],seenBits:0};
function spawnGuards(){for(let i=peds.length-1;i>=0;i--)if(peds[i].guard)peds.splice(i,1);
  for(const[room,x,y]of[[bankL,230,150],[bankL,330,250],[bankS,90,150],[bankS,270,210],[bankV,60,110],[bankV,360,110]])peds.push({x:room.ox+x,y:room.oy+y,vx:0,vy:0,a:Math.PI/2,spd:0,flee:0,fx:0,fy:0,down:0,skin:PEDCOL[Math.floor(rand()*5)],shirt:'#1d2a4a',ci:0,dir:1,ph:0,guard:true,room,cd:1})}
function guardStep(p,dt){if(!heist.alarm||me.inside!==p.room||state!=='play')return;const dx=me.x-p.x,dy=me.y-p.y,d=Math.hypot(dx,dy);p.a=Math.atan2(dy,dx);p.cd-=dt;
  if(p.cd<=0&&d<380){p.cd=rr(.9,1.6);const a=p.a+rr(-.09,.09);fire(p.x+Math.cos(a)*10,p.y+Math.sin(a)*10,a,'police',BAL.npc.bank)}}
function triggerAlarm(msg){if(heist.alarm)return;heist.alarm=true;showBig('ALARM','#ff4b4b',msg+' The guards are shooting',1.8);noise(.8,900,.3)}
function heistReset(){Object.assign(heist,{on:false,seed:0,bits:0,drill:0,drilling:false,looted:{},carry:0,alarm:false,hackLog:[],seenBits:0});spawnGuards()}
function heistStart(seed){heistReset();heist.on=true;heist.seed=seed||Math.floor(rand()*1e6)+1;heist.briefed=true;feed(seed?'You joined the crew. Head to Union Bank (B on the radar)':'Heist started. Head to Union Bank (B on the radar). Bring friends!');closeShop()}
function crew(){const out=[];for(const[peer,r]of remotes)if(r.hs&&heist.on&&r.hs[0]===heist.seed)out.push(r);return out}
function heistStep(dt){
  if(!heist.on)return;
  let drillers=0;const atDrill=me.inside===bankV&&Math.hypot(bankV.ox+210-me.x,bankV.oy+58-me.y)<48;
  if(heist.drilling&&(!atDrill||me.downed||state!=='play')){heist.drilling=false;feed('You stepped away from the drill')}
  if(heist.drilling)drillers++;
  for(const r of crew()){heist.bits|=r.hs[1]&15;heist.drill=Math.max(heist.drill,r.hs[2]);if(r.hs[3])drillers++}
  if(heist.bits!==heist.seenBits){const nb=heist.bits&~heist.seenBits;heist.seenBits=heist.bits;if(nb&1)feed('Crew update: keycard found');if(nb&2)feed('Crew update: mainframe hacked');if(nb&8)feed('Crew update: the vault is open')}
  if(heist.drilling&&state==='play'&&!(heist.bits&8)){heist.drill=Math.min(100,heist.drill+dt*100/30*(1+.6*(drillers-1)));if(rand()<dt*8)burst(bankV.ox+210+rr(-20,20),bankV.oy+34,3,'#ffd27a',120,.3)}
  if(heist.drill>=100&&!(heist.bits&8)){heist.bits|=8;heist.drilling=false;showBig('VAULT OPEN','#ffc94a','Grab the gold',2)}
  if(me.inside===bankV&&state==='play'&&!heist.alarm&&!me.downed){for(let i=0;i<3;i++)if(Math.abs(me.y-laserY(i))<4&&me.x>bankV.ox+12&&me.x<bankV.ox+bankV.w-12){triggerAlarm('Laser tripped!');break}}
}
function gotoFloor(room,x,y){me.inside=room;me.x=room.ox+x;me.y=room.oy+y;me.vx=me.vy=0;look.yaw=-Math.PI/2;shopCd=1;feed(room.name)}
function heistAct(p){const a=p.act;
  if(a==='board'){openBrief();return true}
  if(a==='desk'){if(!heist.on){openBrief();return true}if(heist.bits&1){feed('You already have the keycard');return true}if(p.i===heist.seed%3){heist.bits|=1;showBig('KEYCARD','#3dd68c','Take the elevator to floor 12',1.8)}else feed('Nothing useful in this desk');return true}
  if(a==='bankUp'){if(heist.bits&1)gotoFloor(bankS,322,140);else feed('The elevator needs a keycard. Search the office desks.');return true}
  if(a==='bankDown'){gotoFloor(bankL,372,180);return true}
  if(a==='hack'){if(!heist.on){openBrief();return true}if(heist.bits&2){feed('The mainframe is already cracked');return true}openModal('hack');renderHack();setTimeout(()=>$('hackIn').focus(),60);return true}
  if(a==='vaultDown'){if(heist.bits&2)gotoFloor(bankV,390,300);else feed('Locked. Crack the mainframe first.');return true}
  if(a==='vaultUp'){gotoFloor(bankS,322,200);return true}
  if(a==='drill'){if(heist.bits&8){feed('The vault is open. Grab the gold!');return true}if(!(heist.bits&2)){feed('The vault is locked down');return true}heist.drilling=!heist.drilling;feed(heist.drilling?'Drilling... stay close. More crew means a faster drill':'Drill paused');return true}
  if(a==='loot'){if(!(heist.bits&8)){feed('The vault is still sealed');return true}if(heist.looted[p.i]){feed('Already emptied');return true}const amt=Math.round(rr(7000,11000));heist.looted[p.i]=1;heist.carry+=amt;noise(.3,5000,.2);feed(`+$${amt.toLocaleString('en-US')} in the bag ($${heist.carry.toLocaleString('en-US')} total). Get it to the safehouse!`);return true}
  return false}
function openBrief(){if(!unlocked('bank')){feed(`Come back at level ${UNLOCK.bank}`);return}openModal('brief');renderBrief()}
function renderBrief(){const b=$('bBody');b.replaceChildren();
  for(const t of['Vic Moreno runs the fences down at Rustwater Docks, and tonight he has a job for you.',
    '“Palmetto Union Bank just moved the city’s gold reserve into its basement vault. The night manager left a keycard in one of the lobby offices. Grab it, ride the elevator to floor 12 and crack the security mainframe. That unlocks the stairs to the vault.”',
    '“The vault floor is covered in sweeping lasers, so time your steps. The drill is slow, but it goes faster with more hands on it, so bring your crew. Fill your bags and get the gold to the safehouse. Do not get caught holding it.”'])
  {const p=document.createElement('p');p.textContent=t;b.appendChild(p)}
  const ul=document.createElement('ul');ul.className='steps';
  for(const[t,done]of[['Find the keycard in a lobby office',heist.bits&1],['Hack the mainframe on floor 12',heist.bits&2],[`Drill the vault (${Math.floor(heist.drill)}%)`,heist.bits&8],['Grab the gold',Object.keys(heist.looted).length],['Bring the gold to the safehouse',0]]){const li=document.createElement('li');li.textContent=(done?'✓ ':'○ ')+t;if(done)li.className='done';ul.appendChild(li)}
  if(heist.on)b.appendChild(ul);
  const cr=document.createElement('p');const names=[myName+' (you)',...crew().map(r=>r.name)];cr.textContent=heist.on?`Crew: ${names.join(', ')}${heist.carry?` · Carrying $${heist.carry.toLocaleString('en-US')}`:''}${heist.alarm?' · ALARM ACTIVE':''}`:'No heist running yet.';b.appendChild(cr);
  const A2=$('bAct');A2.replaceChildren();
  if(!heist.on)mkBtn(A2,'Start the heist',()=>heistStart(0),'go');
  const seen=new Set();for(const r of remotes.values())if(r.hs&&r.hs[0]!==heist.seed&&!seen.has(r.hs[0])){seen.add(r.hs[0]);mkBtn(A2,`Join ${r.name}’s crew`,()=>heistStart(r.hs[0]),'chip')}
  if(heist.on)mkBtn(A2,'Abandon the heist',()=>{heistReset();renderBrief()});
}
function hackCode(){const r=seeded(heist.seed*13+7);return[0,1,2].map(()=>1+Math.floor(r()*6))}
function hackTry(){const v=$('hackIn').value.replace(/[^1-6]/g,'');if(v.length!==3){$('hackIn').value=v;return}const g=[...v].map(Number),c=hackCode(),res=['x','x','x'],used=[0,0,0];
  for(let i=0;i<3;i++)if(g[i]===c[i]){res[i]='g';used[i]=1}
  for(let i=0;i<3;i++)if(res[i]!=='g')for(let j=0;j<3;j++)if(!used[j]&&g[i]===c[j]){res[i]='y';used[j]=1;break}
  heist.hackLog.push([v,res]);$('hackIn').value='';noise(.05,7000,.08);
  if(res.every(x=>x==='g')){heist.bits|=2;closeShop();showBig('ACCESS GRANTED','#3dd68c','The vault stairs are unlocked',2);return}
  if(heist.hackLog.length>=10){triggerAlarm('Too many failed attempts!');heist.hackLog=[]}renderHack()}
function renderHack(){const L=$('hackLog');L.replaceChildren();
  for(const[v,res]of heist.hackLog){const row=document.createElement('div');row.style.cssText='display:flex;gap:6px;margin-bottom:4px';
    [...v].forEach((ch,i)=>{const b=document.createElement('span');b.textContent=ch;b.style.cssText=`display:inline-flex;width:34px;height:34px;align-items:center;justify-content:center;font:700 20px ui-monospace,monospace;color:#04120a;border-radius:4px;background:${res[i]==='g'?'#3dd68c':res[i]==='y'?'#ffc94a':'#555'}`;row.appendChild(b)});L.appendChild(row)}
  const left=document.createElement('div');left.style.cssText='letter-spacing:0;opacity:.7;font-size:13px';left.textContent=`${10-heist.hackLog.length} tries left`;L.appendChild(left)}
$('hackGo').addEventListener('click',hackTry);$('hackIn').addEventListener('keydown',e=>{if(e.key==='Enter')hackTry();if(e.key==='Escape')closeShop()});

// ---------- weapon wheel ----------
let wheelOpen=false,wheelSel=null,wheelVec={x:0,y:0};
const ICON={pistol:'<rect x="12" y="12" width="32" height="8" rx="2"/><rect x="14" y="18" width="9" height="15" rx="2"/>',
  smg:'<rect x="8" y="13" width="44" height="8" rx="2"/><rect x="20" y="20" width="7" height="14" rx="2"/><rect x="32" y="20" width="5" height="10"/><rect x="3" y="14" width="7" height="5"/>',
  shotgun:'<rect x="4" y="14" width="56" height="5" rx="2"/><rect x="10" y="18" width="20" height="6" rx="2"/><rect x="2" y="15" width="10" height="13" rx="3"/>',
  mg:'<rect x="4" y="12" width="52" height="9" rx="2"/><rect x="55" y="14" width="7" height="4"/><rect x="18" y="20" width="10" height="12" rx="2"/><rect x="32" y="20" width="12" height="6"/>',
  homing:'<rect x="2" y="14" width="48" height="7" rx="3"/><polygon points="44,9 55,17 44,25"/><circle cx="58" cy="17" r="5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="20" y="20" width="6" height="12" rx="2"/>',
  sniper:'<rect x="2" y="16" width="60" height="4" rx="1"/><rect x="22" y="9" width="18" height="5" rx="2"/><rect x="4" y="18" width="15" height="8" rx="2"/><rect x="26" y="19" width="5" height="10" rx="1"/>',
  sticky:'<rect x="18" y="12" width="28" height="18" rx="3"/><circle cx="40" cy="17" r="3" fill="#ff4b4b"/><rect x="22" y="23" width="12" height="3"/>',
  rpg:'<rect x="2" y="14" width="56" height="7" rx="3"/><polygon points="50,9 63,17 50,26"/><rect x="22" y="20" width="6" height="12" rx="2"/>'};
WEAPONS.forEach((w,i)=>{const ang=-Math.PI/2+i*TAU/WEAPONS.length,b=document.createElement('button');b.type='button';b.className='wseg';b.dataset.id=w.id;
  b.style.left=(50+Math.cos(ang)*37)+'%';b.style.top=(50+Math.sin(ang)*37)+'%';b.setAttribute('aria-label',w.name);
  b.innerHTML='<svg viewBox="0 0 64 40" fill="currentColor" aria-hidden="true">'+ICON[w.id]+'</svg><span></span>';
  b.addEventListener('pointerenter',()=>{wheelSel=w.id;paintWheel()});b.addEventListener('click',()=>{wheelSel=w.id;closeWheel(true)});$('wheelIn').appendChild(b)});
function paintWheel(){
  for(const b of document.querySelectorAll('.wseg')){const w=WEAPONS[WI[b.dataset.id]];b.classList.toggle('lock',!owned[w.id]);b.classList.toggle('sel',b.dataset.id===wheelSel);b.querySelector('span').textContent=owned[w.id]?(w.id==='pistol'?'\u221e':String(ammo[w.id]||0)):'$'+w.price}
  const w=WEAPONS[WI[wheelSel||weap]],m=$('wheelMid');m.replaceChildren();const n=document.createElement('div');n.textContent=w.name;const sm=document.createElement('small');sm.textContent=owned[w.id]?w.desc:`Buy it at a gun shop for $${w.price}`;m.append(n,sm);
}
function openWheel(){if(state!=='play'||me.downed||wheelOpen||quickOpen||chatOpen||phoneOpen)return;wheelOpen=true;wheelSel=weap;wheelVec={x:0,y:0};mouse.down=false;$('wheel').hidden=false;paintWheel()}
function closeWheel(apply){if(!wheelOpen)return;wheelOpen=false;$('wheel').hidden=true;if(apply&&wheelSel&&owned[wheelSel]&&wheelSel!==weap){weap=wheelSel;feed(WEAPONS[WI[weap]].name+' equipped')}}
$('wheel').addEventListener('pointerdown',e=>{if(e.target.id==='wheel')closeWheel(false)});

// ---------- progression ----------
// Reputation points (RP) come from play. Levels unlock guns, vehicles and heists.
let xp=0,lv=1,maxHeatThisChase=0;
const need=L=>L<=1?0:Math.round(250*Math.pow(L-1,1.5));
const lvOf=x=>{let L=1;while(L<30&&x>=need(L+1))L++;return L};
const UNLOCK={smg:2,shotgun:3,mg:6,sniper:8,rpg:10,sticky:12,homing:15,heli:12,jet:20,bank:5,casinoHeist:8};
const UNLOCK_NAME={heli:'Attack helicopter',jet:'Fighter jets',bank:'Union Bank job',casinoHeist:'Casino cage robbery'};
const GATE={heli:[()=>career.jobs>=3,()=>`3 completed jobs (${career.jobs} done)`],jet:[()=>career.crew>=1||career.jobs>=5,()=>`one crew job or 5 completed jobs (${career.crew} crew, ${career.jobs} jobs done)`]};
const unlocked=k=>lv>=(UNLOCK[k]||1)&&(!GATE[k]||GATE[k][0]());
const gateWhy=k=>[lv<UNLOCK[k]&&`level ${UNLOCK[k]}`,!GATE[k][0]()&&GATE[k][1]()].filter(Boolean).join(' and ');
function unlockText(L){const a=Object.keys(UNLOCK).filter(k=>UNLOCK[k]===L&&unlocked(k)).map(k=>UNLOCK_NAME[k]||WEAPONS.find(w=>w.id===k).name);return a.length?'Unlocked: '+a.join(', '):''}
function lvlBar(){const lb=$('lvl');lb.querySelector('b').textContent=lv;lb.querySelector('u').style.width=(lv>=30?100:clamp((xp-need(lv))/(need(lv+1)-need(lv))*100,0,100))+'%'}
function gainXP(n,why){n=Math.round(n);if(state!=='play'||!(n>0))return;if(why==='Mission')career.jobs++;else if(why==='Gang member')career.kills++;else if(why==='Union Job')career.crew++;xp+=n;feed(`+${n} RP · ${why}`);
  const nl=lvOf(xp);if(nl!==lv){lv=nl;showBig('LEVEL '+lv,'#29e6d6',unlockText(lv),2.2);saveArsenal()}lvlBar()}
if(DBG)Object.defineProperties(DBG,{xp:{get:()=>xp},lv:{get:()=>lv},gainXP:{get:()=>gainXP}});
// Fuel for the attack helicopter and jets: one unit per 60 s of flight. Buy one at the Lagoon helipad for $200 (E on foot, while you have none). Not saved.
let fuelState={u:0,t:0};
const fuelNear=()=>!me.car&&!me.heli&&!me.jet&&Math.hypot(PAD.x-me.x,PAD.y-me.y)<80;
function fuelBuy(){if(me.cash<200)return feed('Fuel costs $200');me.cash-=200;fuelState.u++;fuelState.t=0;feed(`Fuel: ${fuelState.u} unit${fuelState.u>1?'s':''}`)}
function fuelStep(dt){const f=me.heli||me.jet;if(!f||f.falling||state!=='play')return;if(fuelState.u<=0){fuelState.t=0;return}fuelState.t+=dt;if(fuelState.t>=60){fuelState.t=0;fuelState.u--}}
if(DBG)Object.defineProperties(DBG,{gates:{get:()=>({heli:unlocked('heli'),jet:unlocked('jet'),fuel:fuelState})}});

// ---------- places ----------
// Rooms and doors are in the state section (mkRoom k=10-16). This section holds what each place does.
const PLACES=[{name:'Pink Flamingo Diner',r:diner},{name:'Ink & Fade',r:ink},{name:'Iron Palms Gym',r:gym},{name:'Palmetto PD',r:pd},{name:"St. Palm's Hospital",r:hosp},{name:'Pixel Palace',r:arcade},{name:'The Rusty Anchor',r:anchor}];
const plKey={look:'pr3d-look',gym:'pr3d-gym',arc:'pr3d-arcade',hosp:'pr3d-hosp'};
const plGet=k=>{try{return JSON.parse(localStorage.getItem(plKey[k])||'null')}catch(_){return null}};
const plSet=(k,v)=>{try{localStorage.setItem(plKey[k],JSON.stringify(v))}catch(_){}};
const plPay=n=>{if(me.cash<n){feed(`That costs ${money(n)}`);return false}me.cash-=n;saveArsenal();return true};
// modal shared by all places: #pm (title, text, buttons, canvases)
let plG=null,plLoopOn=false,plLast=0,plC=null;
function plOpen(t,d,col){plG=null;$('pmT').textContent=t;$('pmT').style.color=col||'';$('pmD').textContent=d||'';$('pmB').replaceChildren();$('pmM').textContent='';$('pmCv').hidden=true;$('gmCv').hidden=true;openModal('pm');setTimeout(()=>$('pmB').querySelector('button')?.focus(),0)}
function plShow(w,h){const c=$('gmCv');c.width=w;c.height=h;c.hidden=false;plC=c.getContext('2d')}
function plRun(s){plG=s;plLast=performance.now();if(!plLoopOn){plLoopOn=true;requestAnimationFrame(plLoop)}}
function plLoop(now){if(!plG||$('pm').hidden){plG=null;plLoopOn=false;return}
  const dt=Math.min(.05,(now-plLast)/1000);plLast=now;if(plG.up)plG.up(dt);plG.dr();requestAnimationFrame(plLoop)}
addEventListener('keydown',e=>{if(!$('pm').hidden&&plG){if(!e.repeat&&plG.key)plG.key(e.code);return}
  if(!$('pm').hidden&&(e.code==='ArrowUp'||e.code==='ArrowDown')){const b=[...$('pmB').querySelectorAll('button:not(:disabled)')];if(!b.length)return;const i=b.indexOf(document.activeElement);b[(i+(e.code==='ArrowDown'?1:-1)+b.length)%b.length].focus();e.preventDefault()}});
$('gmCv').addEventListener('pointerdown',()=>{if(plG&&plG.click)plG.click()});

// look: hair and ink from Ink & Fade, plus the neon hat from the prize counter. Code is 3 digits: hair+1, ink+1, hat.
const HAIRS=[['Buzz',50],['Fade',80],['Afro',120],['Mohawk',180],['Slick back',100],['Long',220],['Bald',60],['Pink dye',300]];
const INKS=[['Left arm sleeve',400],['Right arm sleeve',400],['Neck script',900],['Face tear',1200],['Back piece',2000],['Full sleeves',2500]];
const LOOK0={h:-1,t:-1,hat:0};
const lookOk=o=>!!o&&typeof o==='object'&&Number.isInteger(o.h)&&o.h>=-1&&o.h<HAIRS.length&&Number.isInteger(o.t)&&o.t>=-1&&o.t<INKS.length&&(o.hat===0||o.hat===1);
const lookCode=o=>''+(o.h+1)+(o.t+1)+o.hat;
const lookFrom=s=>{if(typeof s!=='string'||!/^\d{3}$/.test(s))return{...LOOK0};const o={h:+s[0]-1,t:+s[1]-1,hat:+s[2]};return lookOk(o)?o:{...LOOK0}};
let look3={...LOOK0};{const v=plGet('look');if(lookOk(v))look3={h:v.h,t:v.t,hat:v.hat}}
// applies look to a personMesh group; parts are rebuilt each time
function applyLook(g,o){const ud=g.userData;if(!ud.cap)return;
  for(const m of ud.lookParts||[])if(m.parent)m.parent.remove(m);
  const parts=[],add=(par,geo,col,x,y,z)=>{const m=new THREE.Mesh(geo,lam(col));m.position.set(x,y,z);par.add(m);parts.push(m)};
  const hr=o.h,HC='#2a1a12';
  ud.cap.visible=hr<0||hr===7;ud.cap.material=hr===7?lam('#ff4fa3'):ud.hair;
  if(hr===0)add(g,box(5.8,1.2,5.8),HC,0,21.2,0);
  if(hr===1)add(g,box(5.8,3.2,5.8),HC,0,21.2,0);
  if(hr===2)add(g,box(10,9,10),HC,-.5,23.6,0);
  if(hr===3)add(g,box(1.6,4.6,9),'#ff3ea5',0,23.6,0);
  if(hr===4)add(g,box(5.8,2,6.4),HC,-.6,21.4,0);
  if(hr===5){add(g,box(5.8,2.2,5.8),HC,0,21.4,0);add(g,box(2.2,11,5.2),HC,-2.6,16.4,0)}
  if(o.hat)add(g,box(6.2,2.2,6.2),'#29e6d6',0,23.2,0);
  if(o.t===0||o.t===5)add(ud.a1,box(2.6,5.2,2.6),'#7b6bff',0,-4,0);
  if(o.t===1||o.t===5)add(ud.a2,box(2.6,5.2,2.6),'#7b6bff',0,-4,0);
  if(o.t===2)add(g,box(3.4,1.6,3.6),'#29e6d6',0,17.2,0);
  if(o.t===3)add(g,box(.5,1,.8),'#c1121f',2.8,19.2,1.4);
  if(o.t===4)add(g,box(.6,6,6),'#7b6bff',-2.7,12,0);
  ud.lookParts=parts}
let meLk=null;
function meLookSync(){const c=lookCode(look3);if(c!==meLk){meLk=c;applyLook(meMesh,look3)}}
// preview for Ink & Fade: its own small renderer on #pmCv
let pvR=null,pvS=null,pvC=null,pvM=null,pvLook=null,pvOn=false;
function pvStart(){if(pvR)return;pvR=new THREE.WebGLRenderer({canvas:$('pmCv'),antialias:true,alpha:true});pvR.setSize(320,320,false);
  pvS=new THREE.Scene();pvC=new THREE.PerspectiveCamera(28,1,1,600);pvC.position.set(0,20,92);pvC.lookAt(0,13,0);
  pvS.add(new THREE.AmbientLight('#ffffff',.9));const d=new THREE.DirectionalLight('#ffffff',1.2);d.position.set(40,90,60);pvS.add(d);
  pvM=personMesh('#ff3ea5','#e0b48f',false);pvS.add(pvM)}
function pvLoop(){if($('pm').hidden||$('pmCv').hidden){pvOn=false;return}
  pvM.rotation.y+=reduced?0:.015;const c=lookCode(pvLook);if(pvM.userData.lk!==c){pvM.userData.lk=c;applyLook(pvM,pvLook)}
  pvR.render(pvS,pvC);requestAnimationFrame(pvLoop)}
function openBarber(kind){const hair=kind==='hair',list=hair?HAIRS:INKS,key=hair?'h':'t';let pick=null;
  pvLook={...look3};
  plOpen(hair?'Ink & Fade · Barber':'Ink & Fade · Tattoos','Pick a look and watch it turn on the stand. Buy and wear to keep it.','#7b6bff');
  $('pmCv').hidden=false;pvStart();if(!pvOn){pvOn=true;requestAnimationFrame(pvLoop)}
  const B=$('pmB'),note=t=>{$('pmM').textContent=t};
  const pickIt=(i,n,p)=>{pick={i,n,p};pvLook[key]=i;note(`${n}${p?` · ${money(p)}`:''}. Buy and wear to keep it.`)};
  mkBtn(B,hair?'Natural (free)':'No ink (free)',()=>pickIt(-1,hair?'Natural':'No ink',0));
  list.forEach(([n,p],i)=>mkBtn(B,`${n} · ${money(p)}`,()=>pickIt(i,n,p)));
  mkBtn(B,'Buy and wear',()=>{if(!pick)return note('Pick one first.');if(pick.p&&!plPay(pick.p))return;look3[key]=pick.i;plSet('look',look3);jingle('buy');feed(`${pick.n} is yours`);pvLook={...look3};pick=null;note('Worn.')},'go')}

// diner: menu and jukebox
function openDiner(){plOpen('Pink Flamingo Diner','Booths, a counter with stools, and a jukebox.','#ff5c8a');
  const eat=(n,p,t,fx)=>mkBtn($('pmB'),`${n} · ${money(p)} · ${t}`,()=>{if(!plPay(p))return;fx();jingle('buy');feed(`${n}. Health ${Math.round(me.hp)}`)});
  eat('Burger',30,'+40 health',()=>{me.hp=Math.min(BAL.playerHp,me.hp+40)});
  eat('Milkshake',15,'+25 health',()=>{me.hp=Math.min(BAL.playerHp,me.hp+25)});
  eat('Coffee',10,'+10 health, stamina refills 50% faster for 90 s',()=>{me.hp=Math.min(BAL.playerHp,me.hp+10);coffeeT=time+90});
  eat('The Big Palm Platter',120,'full health, 10% less damage for 2 min',()=>{me.hp=BAL.playerHp;palmT=time+120})}
let coffeeT=0,palmT=0;
const coffeeMul=()=>coffeeT>time?1.5:1;
const palmMul=()=>palmT>time?.9:1;

// gym: sessions raise the stamina drain time by 4% each, up to 10 sessions
let gymLv=0,gymDay='',gymN=0;{const g=plGet('gym');if(g&&Number.isInteger(g.lv)&&g.lv>=0&&g.lv<=10)gymLv=g.lv;if(g&&typeof g.day==='string'&&Number.isInteger(g.n)&&g.n>=0&&g.n<=3){gymDay=g.day;gymN=g.n}}
const gymMul=()=>1+.04*gymLv;
function gymStart(k){const day=new Date().toDateString();if(day!==gymDay){gymDay=day;gymN=0}
  if(gymN>=3)return feed('Three sessions a day is the limit. Come back tomorrow');
  gymN++;plSet('gym',{lv:gymLv,day:gymDay,n:gymN});
  const tread=k==='tread';plOpen(tread?'Treadmill':'Weights',tread?'Press A or D when the arrow reaches the yellow line. 15 hits in 16 seconds.':'Press Space when the marker is in the green. 3 good lifts out of 5.','#ff8a3d');
  plShow(360,180);plRun(tread?trG():wtG())}
function gymEnd(s,ok){s.done=true;const up=ok&&gymLv<10;if(up)gymLv++;jingle(ok?'level':'fail');plSet('gym',{lv:gymLv,day:gymDay,n:gymN});
  $('pmM').textContent=!ok?'Not enough reps. No gain this time.':up?`Session done. Stamina lasts ${Math.round(gymLv*4)}% longer`:'Session done. You are at the top of the gym already.'}
function trG(){const s={k:'tread',t:0,n:0,q:[],hits:0,done:false};
  s.up=dt=>{if(s.done)return;s.t+=dt;while(s.n<25&&s.t>=s.n*.6){s.q.push({key:Math.random()<.5?'KeyA':'KeyD',at:s.n*.6+.6,st:0});s.n++}
    for(const q of s.q)if(!q.st&&s.t>q.at+.22)q.st=2;
    if(s.t>=16)gymEnd(s,s.hits>=15)};
  s.key=c=>{if(s.done||(c!=='KeyA'&&c!=='KeyD'))return;const q=s.q.find(q=>!q.st&&Math.abs(s.t-q.at)<=.22);if(!q)return;q.st=c===q.key?1:2;if(q.st===1)s.hits++};
  s.dr=()=>{const c=plC;c.fillStyle='#0c0a16';c.fillRect(0,0,360,180);c.fillStyle='#262235';c.fillRect(20,60,320,60);c.fillStyle='#ffc94a';c.fillRect(60,56,3,68);
    c.font='bold 26px sans-serif';c.textAlign='center';
    for(const q of s.q){const x=330-(s.t-(q.at-.6))/.6*270;if(x<0||x>360)continue;c.fillStyle=q.st===1?'#3dd68c':q.st===2?'#ff4b4b':'#29e6d6';c.fillText(q.key==='KeyA'?'A':'D',x,100)}
    c.textAlign='left';c.fillStyle='#29e6d6';c.fillRect(20,150,s.hits*320/15,14);c.strokeStyle='#29e6d6';c.strokeRect(20,150,320,14);
    c.fillStyle='#fff';c.font='16px sans-serif';c.fillText(`${s.hits} of 15 hits, ${Math.max(0,16-s.t).toFixed(0)} s left`,20,30)};
  return s}
function wtG(){const s={k:'weights',t:0,reps:0,good:0,done:false,last:'Tap Space when the marker is in the green'};
  const pos=()=>{const f=(s.t/1.1)%2;return f<1?f:2-f};
  s.up=dt=>{if(!s.done)s.t+=dt};
  s.key=c=>{if(c!=='Space'||s.done)return;const ok=Math.abs(pos()-.5)<.1;s.reps++;if(ok)s.good++;s.last=ok?'Good lift':'Off balance';if(s.reps>=5)gymEnd(s,s.good>=3)};
  s.click=()=>s.key('Space');
  s.dr=()=>{const c=plC;c.fillStyle='#0c0a16';c.fillRect(0,0,360,180);c.fillStyle='#262235';c.fillRect(30,80,300,20);c.fillStyle='#3dd68c';c.fillRect(30+.4*300,80,.2*300,20);
    const x=30+pos()*300;c.fillStyle='#ffc94a';c.fillRect(x-4,68,8,44);
    c.fillStyle='#fff';c.font='16px sans-serif';c.fillText(`Lifts ${s.reps} of 5, good ${s.good}`,30,40);c.fillText(s.last,30,140)};
  return s}

// police: pay off the record, and the wanted board
function pdPay(){if(coolT<20)return feed('Cops saw you in the last 20 seconds');const st=Math.ceil(heat-.001);if(st<=0)return feed('Your record is clean');
  const near=cars.some(c=>c.kind==='police'&&Math.hypot(c.x-me.x,c.y-me.y)<600)||(typeof copHeli!=='undefined'&&copHeli&&!copHeli.dead&&Math.hypot(copHeli.x-me.x,copHeli.y-me.y)<600);
  if(near)return feed('Cops are still on you. Lose them first');
  const cost=500*st;if(!plPay(cost))return;heat=0;coolT=0;jingle('pass');feed(`Record cleared for ${money(cost)}`)}
function openBoard(){plOpen('Wanted board','Everyone in this room and their wanted stars.','#4aa3ff');
  const rows=[['You',Math.ceil(heat-.001)]];for(const r of remotes.values())if(!r.dead)rows.push([r.name,Math.round(num(r.w))]);
  for(const[n,s]of rows){const d=document.createElement('div');d.className='tag';d.style.margin='0';d.textContent=`${n}: ${s?'★'.repeat(Math.min(5,s)):'clear'}`;$('pmB').appendChild(d)}}

// hospital: checkup, adrenaline shot, respawn
let hospAdr=0;{const h=plGet('hosp');if(h&&h.adr===1)hospAdr=1}
function checkup(){if(!plPay(100))return;me.hp=BAL.playerHp;me.inv=Math.max(me.inv,5);jingle('pass');feed('Full checkup. Five seconds of no damage')}
function buyAdr(){if(hospAdr)return feed('You already carry one');if(!plPay(1500))return;hospAdr=1;plSet('hosp',{adr:1});feed('Adrenaline shot in your pocket. It saves you once')}
function hospitalSpot(){const d=DOORS.find(v=>v.int===hosp);return d?[d.x,d.y-30]:pointAway(0,900)}
function placesRevive(){if(!hospAdr)return false;hospAdr=0;plSet('hosp',{adr:0});if(me.car)leaveCar(true);me.heli=null;me.jet=null;handsUp=false;me.z=groundZ(me.x,me.y);jvz=0;me.hp=30;me.inv=2.5;state='play';hideBig();feed('The adrenaline shot gets you up. 30 health');return true}

// arcade: Palm Racer, Snake Bite, prize counter. Scores are kept locally and sent to the room as `ar`.
let arc={hi:[0,0],tix:0};{const a=plGet('arc');if(a&&Array.isArray(a.hi)&&a.hi.length===2&&a.hi.every(Number.isFinite)&&Number.isFinite(a.tix))arc={hi:[clamp(Math.floor(a.hi[0]),0,99999),clamp(Math.floor(a.hi[1]),0,99999)],tix:clamp(Math.floor(a.tix),0,99999)}}
const saveArc=()=>plSet('arc',arc);
const bestOf=i=>Math.max(arc.hi[i],...[...remotes.values()].map(r=>num(r.ar&&r.ar[i])));
function arcHead(i){$('pmD').textContent=`Your best ${arc.hi[i]}. Room best ${bestOf(i)}. You have ${arc.tix} tickets.`}
function startRacer(){if(!plPay(5))return;plOpen('Palm Racer','Dodge the traffic. A and D or the arrows change lane.','#ff3ea5');arcHead(0);plShow(320,400);
  const s={k:'racer',t:0,ln:1,px:160,ob:[],nx:.6,dist:0,sp:190,over:false};
  const end=()=>{s.over=true;const sc=Math.floor(s.dist/10),tk=Math.floor(sc/25);arc.tix+=tk;arc.hi[0]=Math.max(arc.hi[0],sc);saveArc();$('pmM').textContent=`Crash. Score ${sc}, +${tk} tickets.`;mkBtn($('pmB'),'Play again ($5)',startRacer)};
  s.key=c=>{if(s.over)return;if(c==='KeyA'||c==='ArrowLeft')s.ln=Math.max(0,s.ln-1);else if(c==='KeyD'||c==='ArrowRight')s.ln=Math.min(2,s.ln+1)};
  s.up=dt=>{if(s.over)return;s.t+=dt;s.sp=Math.min(480,190+s.t*6);s.dist+=s.sp*dt;s.nx-=dt;
    if(s.nx<=0){s.ob.push({l:Math.floor(Math.random()*3),y:-50});s.nx=Math.max(.35,.8-s.t*.012)*(.7+Math.random()*.6)}
    for(const o of s.ob)o.y+=s.sp*dt;s.ob=s.ob.filter(o=>o.y<460);
    s.px+=(80+s.ln*80-s.px)*Math.min(1,dt*14);
    if(s.ob.some(o=>o.l===s.ln&&o.y>318&&o.y<372))end()};
  s.dr=()=>{const c=plC,h=400;c.fillStyle='#07050f';c.fillRect(0,0,320,h);c.fillStyle='#120c24';c.fillRect(40,0,240,h);
    c.strokeStyle='#ff3ea5';c.lineWidth=3;c.beginPath();c.moveTo(40,0);c.lineTo(40,h);c.moveTo(280,0);c.lineTo(280,h);c.stroke();
    c.strokeStyle='rgba(41,230,214,.5)';c.setLineDash([22,22]);c.lineDashOffset=-s.dist/3;c.beginPath();c.moveTo(120,0);c.lineTo(120,h);c.moveTo(200,0);c.lineTo(200,h);c.stroke();c.setLineDash([]);
    for(const o of s.ob){c.fillStyle='#ff4b4b';c.fillRect(80+o.l*80-22,o.y-24,44,48)}
    c.fillStyle='#29e6d6';c.fillRect(s.px-20,330,40,48);
    c.fillStyle='#fff';c.font='bold 18px "Chakra Petch", sans-serif';c.fillText(`${Math.floor(s.dist/10)}`,12,26)};
  plRun(s)}
function startSnake(){if(!plPay(5))return;plOpen('Snake Bite','Eat the pink dots. Arrows or WASD steer. Walls and your tail end it.','#3dd68c');arcHead(1);plShow(320,320);
  const s={k:'snake',acc:0,dir:[1,0],nd:[1,0],body:[[6,8],[5,8],[4,8]],food:null,over:false,foods:0};
  const free=()=>{if(s.body.length>=256)return null;let p;do{p=[Math.floor(Math.random()*16),Math.floor(Math.random()*16)]}while(s.body.some(b=>b[0]===p[0]&&b[1]===p[1]));return p};
  s.food=free();
  const end=()=>{s.over=true;const sc=s.foods*10;arc.tix+=s.foods;arc.hi[1]=Math.max(arc.hi[1],sc);saveArc();$('pmM').textContent=`Game over. Score ${sc}, +${s.foods} tickets.`;mkBtn($('pmB'),'Play again ($5)',startSnake)};
  s.step=()=>{s.dir=s.nd;const h=[s.body[0][0]+s.dir[0],s.body[0][1]+s.dir[1]];
    if(h[0]<0||h[1]<0||h[0]>15||h[1]>15||s.body.some(b=>b[0]===h[0]&&b[1]===h[1])){end();return}
    s.body.unshift(h);if(s.food&&h[0]===s.food[0]&&h[1]===s.food[1]){s.foods++;s.food=free();if(!s.food){end();return}}else s.body.pop()};
  s.key=c=>{const d={KeyW:[0,-1],ArrowUp:[0,-1],KeyS:[0,1],ArrowDown:[0,1],KeyA:[-1,0],ArrowLeft:[-1,0],KeyD:[1,0],ArrowRight:[1,0]}[c];if(d&&!(d[0]===-s.nd[0]&&d[1]===-s.nd[1]))s.nd=d};
  s.up=dt=>{if(s.over)return;s.acc+=dt;while(s.acc>=.12&&!s.over){s.acc-=.12;s.step()}};
  s.dr=()=>{const c=plC,z=20;c.fillStyle='#07050f';c.fillRect(0,0,320,320);c.strokeStyle='rgba(61,214,140,.12)';
    for(let i=0;i<=16;i++){c.beginPath();c.moveTo(i*z,0);c.lineTo(i*z,320);c.moveTo(0,i*z);c.lineTo(320,i*z);c.stroke()}
    if(s.food){c.fillStyle='#ff3ea5';c.beginPath();c.arc(s.food[0]*z+10,s.food[1]*z+10,6,0,TAU);c.fill()}
    s.body.forEach((b,i)=>{c.fillStyle=i?'#3dd68c':'#ffe27a';c.fillRect(b[0]*z+2,b[1]*z+2,z-4,z-4)})};
  plRun(s)}
function openPrize(){plOpen('Prize counter','','#ffc94a');renderPrize()}
function renderPrize(){const B=$('pmB');B.replaceChildren();$('pmD').textContent=`You have ${arc.tix} tickets.`;
  mkBtn(B,'10 tickets for $1',()=>{if(arc.tix<10)return feed('You need 10 tickets');arc.tix-=10;me.cash+=1;saveArc();saveArsenal();jingle('buy');renderPrize()});
  mkBtn(B,'60 tickets for the neon hat',()=>{if(look3.hat)return feed('You already wear the neon hat');if(arc.tix<60)return feed('You need 60 tickets');arc.tix-=60;look3.hat=1;plSet('look',look3);saveArc();jingle('level');renderPrize()})}

// dive bar: darts. Points per dart are 14 - floor(14 r), r = distance / board radius. Ties go to the house.
// Unaimed throws give the house about a 5 percent edge: you win about 48 percent of bets, ties about 5 percent.
function openDarts(){plOpen('The Rusty Anchor · Darts','Your three darts against the house. Ties go to the house. Click or Space throws.','#e0a050');plShow(360,300);
  const R=130,cx=180,cy=150,pts=(x,y)=>{const r=Math.hypot(x-cx,y-cy)/R;return r>=1?0:14-Math.floor(14*r)};
  const hs=()=>{let t=0;for(let i=0;i<3;i++)t+=14-Math.floor(14*Math.sqrt(Math.random()));return t};
  const s={k:'darts',t:0,bet:0,on:false,th:[],pos:[],rx:cx,ry:cy};
  s.up=dt=>{s.t+=dt;const A=R*(.76+Math.min(1,drunk/30)*.5);s.rx=cx+Math.sin(s.t*1.3)*A+Math.sin(s.t*2.9)*A*.25;s.ry=cy+Math.cos(s.t*1.7)*A*.8};
  s.click=()=>throwNow();s.key=c=>{if(c==='Space')throwNow()};
  const throwNow=()=>{if(!s.on)return;s.th.push(pts(s.rx,s.ry));s.pos.push([s.rx,s.ry]);
    if(s.th.length<3){$('pmM').textContent=`Dart ${s.th.length+1} of 3. Scores so far: ${s.th.join(', ')}`;return}
    s.on=false;const you=s.th.reduce((a,b)=>a+b,0),h=hs(),win=you>h;if(win){me.cash+=2*s.bet;saveArsenal()}
    $('pmM').textContent=`You ${you}, house ${h}. ${win?`You win ${money(s.bet)}.`:`The house takes ${money(s.bet)}.`}`;jingle(win?'pass':'fail');bets()};
  const bets=()=>{const B=$('pmB');B.replaceChildren();$('pmD').textContent=`Pick a bet. You have ${money(me.cash)}.`;
    for(const b of[10,50,100,500])mkBtn(B,`Bet ${money(b)}`,()=>{if(!plPay(b))return;s.bet=b;s.on=true;s.th=[];s.pos=[];B.replaceChildren();$('pmD').textContent=`Bet ${money(b)} on the table.`;$('pmM').textContent='Dart 1 of 3. Click the board or press Space.'})};
  s.dr=()=>{const c=plC;c.fillStyle='#120a08';c.fillRect(0,0,360,300);
    for(const[r,col]of[[R,'#1d1b26'],[R*.66,'#e8dcc0'],[R*.36,'#2b8a4a'],[R*.1,'#d9304a']]){c.fillStyle=col;c.beginPath();c.arc(cx,cy,r,0,TAU);c.fill()}
    for(const[x,y]of s.pos){c.fillStyle='#ffc94a';c.beginPath();c.arc(x,y,4,0,TAU);c.fill()}
    c.strokeStyle='#29e6d6';c.lineWidth=2;c.beginPath();c.arc(s.rx,s.ry,12,0,TAU);c.moveTo(s.rx-18,s.ry);c.lineTo(s.rx+18,s.ry);c.moveTo(s.rx,s.ry-18);c.lineTo(s.rx,s.ry+18);c.stroke()};
  plRun(s);bets()}

// everything that a spot can do in the new places. Returns true when it handled the spot.
function placesAct(p){switch(p.act){
  case'menu':openDiner();return true;
  case'jukebox':cycleRadio();return true;
  case'hair':openBarber('hair');return true;
  case'tattoo':openBarber('tat');return true;
  case'treadmill':gymStart('tread');return true;
  case'weights':gymStart('weights');return true;
  case'pd_pay':pdPay();return true;
  case'pd_board':openBoard();return true;
  case'adr':buyAdr();return true;
  case'checkup':checkup();return true;
  case'racer':startRacer();return true;
  case'snake':startSnake();return true;
  case'prize':openPrize();return true;
  case'darts':openDarts();return true}
  return false}
if(DBG)Object.defineProperties(DBG,{places:{get:()=>PLACES.map(p=>p.name)},look:{get:()=>look3},gym:{get:()=>gymLv}});

// ---------- mod shop ----------
// Palmetto Customs. Mods live on c.mods={paint,eng,brk,arm,nitro,neon,rim,tint,horn}; a missing key means stock. They stay on that car object.
const GARAGE={x:1*B+R+160,y:3*B+R+9};
const MODS_COL=CARCOL.concat(['#f6f4ee','#17161c']);
const MODS_PAINT_NAMES=['Frost grey','Neon pink','Electric teal','Taxi gold','Sunset orange','Grape purple','Mint green','Slate grey','Cherry red','Ocean blue','Pearl white','Matte black'];
const MODS_NEON=['#ff3ea5','#29e6d6','#ffc94a','#7b6bff','#3dd68c','#ff6b3d'];
const MODS_NEON_NAMES=['Pink','Cyan','Gold','Violet','Green','Orange'];
const MODS_RIM=['#e8e6f0','#17161c','#ffc94a','#ff3ea5','#29e6d6'];
const MODS_RIM_NAMES=['Polished','Blackout','Gold','Pink','Cyan'];
const MODS_HORN=[[400,500,'Stock'],[520,660,'Air'],[300,380,'Muscle']];
const MOD_MENUS=[['paint','Paint'],['engine','Engine'],['brakes','Brakes & handling'],['armor','Armor'],['nitro','Nitro'],['neon','Neon'],['rims','Rims'],['tint','Tint'],['horn','Horn'],['repair','Repair']];
let modCat=0,nitroT=0,nitroMax=3;
// factor for one stat: 'max' and 'acc' use the engine, 'grip' and 'brk' (braking) the brakes and handling, 'arm' the armor
function modK(c,k){const m=c&&c.mods;if(!m)return 1;
  if(k==='max'||k==='acc')return[1,1.08,1.16,1.25][m.eng|0]||1;
  if(k==='grip')return[1,1.12,1.25][m.brk|0]||1;
  if(k==='brk')return[1,1.15,1.3][m.brk|0]||1;
  if(k==='arm')return[1,.8,.65,.5][m.arm|0]||1;
  return 1}
// nitro: hold the nitro action in a car with nitro fitted for up to 3 s of boost. It refills in 10 s, in or out of the car. Sets c.boost for drive().
const nitBar=$('nitBar'),nitFill=$('nit');
function modNitroStep(dt){
  const c=me.car,fitted=!!c&&!!c.mods&&!!c.mods.nitro&&!c.burn,on=fitted&&state==='play'&&held('nitro');
  // empty tank: refill only when the key is released, so holding it cannot stutter free boost
  if(on)nitroT=Math.max(0,nitroT-dt);else nitroT=Math.min(nitroMax,nitroT+dt*nitroMax/10);
  const show=fitted&&nitroT<nitroMax;nitBar.hidden=!show;if(show)nitFill.style.width=nitroT/nitroMax*100+'%';
  if(!c)return;
  c.boost=on&&nitroT>0;
  if(c.boost&&rand()<dt*60){const ex=c.x-Math.cos(c.a)*22,ey=c.y-Math.sin(c.a)*22;
    parts.push({x:ex+rr(-3,3),y:ey+rr(-3,3),vx:-c.vx*.15+rr(-14,14),vy:-c.vy*.15+rr(-14,14),life:.45,max:.45,col:rand()<.6?'#4aa3ff':'#9fd4ff',k:'nitro',sz:rr(4,8)})}
}
function nitroTap(){if(state!=='play'||!me.car)return;if(!(me.car.mods&&me.car.mods.nitro))feed('No nitro fitted. Palmetto Customs sells it')}
// the bay: a slow car that comes in opens the shop once. Police, armored trucks and wrecks are turned away.
function modBay(c){
  const near=Math.hypot(c.x-GARAGE.x,c.y-GARAGE.y)<40&&Math.hypot(c.vx,c.vy)<40;
  if(near&&!c.bayIn&&state==='play'&&c.kind==='mine'&&!c.burn&&!c.air&&c.type!=='police'&&c.type!=='armored')openMods();
  c.bayIn=near}
function openMods(){
  const c=me.car;
  if(state!=='play'||!c||c.burn)return;
  if(Math.ceil(heat-.001)>=3)return feed('Too hot, lose the cops first');
  openModal('modshop');renderMods();setTimeout(()=>$('modCats').querySelector('button').focus(),0)}
$('modClose').addEventListener('click',closeShop);
const modsBtnRow=(L,title,own,desc,label,ok,fn)=>{
  const row=document.createElement('div');row.className='gun';
  const nm=document.createElement('div');nm.className='nm';nm.textContent=(own?'\u2713 ':'')+title;
  const ds=document.createElement('div');ds.className='ds';ds.textContent=desc;
  const acts=document.createElement('div');acts.className='acts';
  const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=own||!ok;if(!b.disabled)b.className='buy';b.onclick=fn;
  acts.appendChild(b);row.append(nm,acts,ds);L.appendChild(row)};
// pays p (0 is free) and applies the change; the shop shows the new state at once
function modBuy(p,fn){if(me.cash<p)return;me.cash-=p;fn();saveArsenal();jingle('buy');renderMods()}
function renderMods(){
  const c=me.car&&!me.car.burn?me.car:null;
  $('modCash').textContent=money(me.cash);
  const cats=$('modCats');cats.replaceChildren();
  MOD_MENUS.forEach(([k,label],i)=>{
    const b=document.createElement('button');b.type='button';b.textContent=label;
    if(i===modCat)b.className='on';
    b.onclick=()=>{modCat=i;renderMods()};
    cats.appendChild(b)});
  const L=$('modList');L.replaceChildren();
  if(!c){const t=document.createElement('div');t.className='tag';t.textContent='Drive a car into the bay to tune it';L.appendChild(t);return}
  const m=c.mods||(c.mods={});
  const lab=(own,ready,p,l)=>own?'Fitted':ready?`Buy ${money(p)}`:`Level ${l}`;
  if(modCat===0)MODS_COL.forEach((col,i)=>{const cur=col===c.color;
    modsBtnRow(L,MODS_PAINT_NAMES[i],cur,cur?'Your current coat':'$300 · spray booth, clears 1 or 2 stars',cur?'On':'Paint $300',me.cash>=300,()=>modBuy(300,()=>{
      c.color=col;m.paint=col;const st=Math.ceil(heat-.001);
      if(st>=1&&st<=2&&!cars.some(q=>q.kind==='police'&&Math.hypot(q.x-c.x,q.y-c.y)<400)){heat=0;coolT=0;feed('New colour, new car. The cops lost you')}}))});
  if(modCat===1)[[1,1500,1],[2,4000,4],[3,9000,8]].forEach(([t,p,l])=>{const own=(m.eng|0)>=t,ready=lv>=l;
    modsBtnRow(L,'Engine '+t,own,`${money(p)} · top speed and acceleration \u00d7${[0,1.08,1.16,1.25][t]}`,lab(own,ready,p,l),ready&&!own&&me.cash>=p,()=>modBuy(p,()=>m.eng=t))});
  if(modCat===2)[[1,1200,1],[2,3000,5]].forEach(([t,p,l])=>{const own=(m.brk|0)>=t,ready=lv>=l;
    modsBtnRow(L,'Brakes & handling '+t,own,`${money(p)} · grip \u00d7${[0,1.12,1.25][t]}, braking \u00d7${[0,1.15,1.3][t]}`,lab(own,ready,p,l),ready&&!own&&me.cash>=p,()=>modBuy(p,()=>m.brk=t))});
  if(modCat===3)[[1,2000,2],[2,5000,6],[3,10000,10]].forEach(([t,p,l])=>{const own=(m.arm|0)>=t,ready=lv>=l;
    modsBtnRow(L,'Armor '+t,own,`${money(p)} · damage taken \u00d7${[0,.8,.65,.5][t]}`,lab(own,ready,p,l),ready&&!own&&me.cash>=p,()=>modBuy(p,()=>m.arm=t))});
  if(modCat===4){const own=!!m.nitro,ready=lv>=6,ks=kb('nitro');
    modsBtnRow(L,'Nitro',own,own?`Hold ${ks} for 3 s of boost, refills in 10 s`:`$6,000 · hold ${ks} for 3 s of boost, refills in 10 s`,lab(own,ready,6000,6),ready&&!own&&me.cash>=6000,()=>modBuy(6000,()=>{m.nitro=1;nitroT=nitroMax}))}
  if(modCat===5)MODS_NEON.forEach((col,i)=>{const own=!!m.neon,cur=m.neon===col;
    modsBtnRow(L,MODS_NEON_NAMES[i]+' underglow',cur,cur?'Lit up':own?'Change for free':'$2,500 · a glow and a light under your car',cur?'On':own?'Change':'Install $2,500',own||me.cash>=2500,()=>modBuy(own?0:2500,()=>m.neon=col))});
  if(modCat===6)MODS_RIM.forEach((col,i)=>{const cur=m.rim===col;
    modsBtnRow(L,MODS_RIM_NAMES[i]+' rims',cur,cur?'Your wheels':'$800 · a fresh set of rims',cur?'On':'Buy $800',!cur&&me.cash>=800,()=>modBuy(800,()=>m.rim=col))});
  if(modCat===7){const own=!!m.tint;
    modsBtnRow(L,'Window tint',own,'$500 · darker glass, cooler cabin',own?'Fitted':'Buy $500',!own&&me.cash>=500,()=>modBuy(500,()=>m.tint=1))}
  if(modCat===8)MODS_HORN.forEach(([f1,f2,name],i)=>{const own=i?m.horn===f1:!m.horn;
    modsBtnRow(L,name+' horn',own,i?'$300 · a new tone':'The stock tone',own?'Fitted':i?'Buy $300':'Fit stock',!own&&(!i||me.cash>=300),()=>modBuy(i?300:0,()=>{if(i)m.horn=f1;else delete m.horn}))});
  if(modCat===9){const max=(CT[c.type]||CT.sedan).hp,full=c.hp>=max&&!c.spiked;
    modsBtnRow(L,'Body and engine',full,full?'Nothing to fix':'$200 · restores health to full',full?'Fine':'Repair $200',!full&&me.cash>=200,()=>modBuy(200,()=>{c.hp=max;if(c.spiked)c.spiked=false}))}
}
const bait=()=>{ // test helper (?debug only): a sports car north of the bay, you get in
  const c=mkCar(GARAGE.x,GARAGE.y-70,Math.PI/2,'parked','#ff3ea5','sports');cars.push(c);
  c.kind='mine';c.keyed=1;c.vx=0;c.vy=0;me.car=c;me.x=c.x;me.y=c.y;me.a=c.a;return 'ok'};
if(DBG)Object.defineProperties(DBG,{modK:{get:()=>modK},openMods:{get:()=>openMods}});
if(DBG)Object.defineProperties(DBG,{bait:{get:()=>bait}});
// ---------- properties ----------
// Houses you can buy, a garage at each one, and the personal cars kept there. Saves: pr3d-props (owned ids), pr3d-garage ({propId:[car|null,...]}).
// A personal car is a normal car with c.personal and c.slot. While it is out, its slot keeps a copy and slot.live points at the one live car.
function mkProp(id,name,tag,price,level,slots,bi,bj,w,h,col,k,dcol){
  const int=mkRoom(id,name,w,h,col,k),door={...doorAt(bi,bj),int,label:name,col:dcol,prop:null},p={id,name,tag,price,level,slots,owned:false,int,door,garage:{x:door.x+60,y:door.y+6}};
  door.prop=p;DOORS.push(door);return p}
const homeDoor=DOORS.find(d=>d.int===home);
const PROPS=[{id:'home',name:'Safehouse',tag:'SAFEHOUSE',price:0,level:1,slots:1,owned:true,int:home,door:homeDoor,garage:{x:homeDoor.x+60,y:homeDoor.y+6}},
  mkProp('low','Low Palms apartment','LOW PALMS',15000,3,2,6,4,240,220,'#1a2a3a',20,'#7dd3fc'),
  mkProp('mid','Midtown condo','MIDTOWN',40000,6,4,7,3,300,240,'#2a1a3a',21,'#c4b5fd'),
  mkProp('beach','Sunset beach house','SUNSET BEACH',90000,10,4,8,8,320,260,'#3a2a1a',22,'#fdba74'),
  mkProp('heights','Palm Heights villa','PALM HEIGHTS',180000,15,6,9,4,360,280,'#1e3a2e',23,'#86efac'),
  mkProp('penth','Downtown penthouse','PENTHOUSE',350000,20,6,6,3,340,260,'#20203a',24,'#fde68a')];
homeDoor.prop=PROPS[0];
// furniture is solid props, sized to each room. Counters stay clear of the spawn point (exit.x, h-52)
{const r=PROPS[1].int;prop(r,30,40,90,30,12,'#7a3a5a');prop(r,150,20,56,80,14,'#e8e0f0');prop(r,20,140,80,22,20,'#c9c3d6');prop(r,60,4,70,8,30,'#2a2440');spot(r,176,130,'sleep','Sleep (heal, save, lose the cops)')}
{const r=PROPS[2].int;prop(r,30,40,110,34,12,'#5a2a6a');prop(r,190,30,70,90,14,'#e8e0f0');prop(r,30,150,110,22,20,'#c9c3d6');prop(r,90,4,120,8,34,'#2a2440');spot(r,240,140,'sleep','Sleep (heal, save, lose the cops)')}
{const r=PROPS[3].int;prop(r,30,50,120,36,12,'#e8b06a');prop(r,200,40,80,90,14,'#f5efe0');prop(r,30,160,120,22,20,'#d9c7a8');prop(r,120,4,80,8,36,'#2a2440');spot(r,260,150,'sleep','Sleep (heal, save, lose the cops)')}
{const r=PROPS[4].int;prop(r,30,40,140,40,12,'#2e5a4a');prop(r,240,40,90,100,14,'#e8e0f0');prop(r,30,200,120,24,20,'#c9c3d6');prop(r,140,4,100,8,36,'#2a2440');spot(r,300,160,'sleep','Sleep (heal, save, lose the cops)')}
{const r=PROPS[5].int;prop(r,30,40,130,38,12,'#3a3a6a');prop(r,220,30,80,90,14,'#f1f5ff');prop(r,30,170,110,22,20,'#c9c3d6');prop(r,110,4,110,8,36,'#2a2440');spot(r,280,140,'sleep','Sleep (heal, save, lose the cops)')}
// one slot list per property: {car, out, live, readyAt}; readyAt is the insurance wait (ms since epoch)
const GAR={};for(const p of PROPS)GAR[p.id]=Array.from({length:p.slots},()=>({car:null,out:false,live:null,readyAt:0,prop:p}));
const carSnap=c=>({type:c.type,color:c.color,mods:carMods(c.mods),hp:Math.round(c.hp)});
// a car mods object is only ever the known keys with valid values: a tampered save cannot crash the renderer
function carMods(m){const o={};if(!m||typeof m!=='object'||Array.isArray(m))return o;const HX=/^#[0-9a-fA-F]{6}$/;
  if(HX.test(m.paint))o.paint=m.paint;if(HX.test(m.neon))o.neon=m.neon;if(HX.test(m.rim))o.rim=m.rim;
  for(const[k,max]of[['eng',3],['brk',2],['arm',3]])if(Number.isFinite(m[k]))o[k]=clamp(Math.floor(m[k]),0,max);
  if(m.nitro===1||m.nitro===true)o.nitro=1;if(m.tint===1||m.tint===true)o.tint=1;
  if(Number.isFinite(m.horn))o.horn=m.horn;
  return o}
function carLoad(v){if(!v||typeof v!=='object'||!hasCT(v.type)||!/^#[0-9a-fA-F]{6}$/.test(v.color)||!Number.isFinite(v.hp))return null;return{type:v.type,color:v.color,mods:carMods(v.mods),hp:clamp(v.hp,1,CT[v.type].hp)}}
function propSave(){try{localStorage.setItem('pr3d-props',JSON.stringify(PROPS.filter(p=>p.owned).map(p=>p.id)));
  const g={};for(const p of PROPS)g[p.id]=GAR[p.id].map(s=>({car:s.car,readyAt:Math.max(0,Math.floor(s.readyAt||0))}));
  localStorage.setItem('pr3d-garage',JSON.stringify(g))}catch(_){}}
function propLoad(){
  try{const a=JSON.parse(localStorage.getItem('pr3d-props')||'null');if(Array.isArray(a))for(const p of PROPS)if(a.includes(p.id))p.owned=true}catch(_){}
  let g=null;try{g=JSON.parse(localStorage.getItem('pr3d-garage')||'null')}catch(_){}
  // first load of a save: the starter sedan waits in the safehouse garage
  if(!g||typeof g!=='object'){GAR.home[0].car={type:'sedan',color:'#4aa3ff',mods:{},hp:CT.sedan.hp};propSave();return}
  for(const p of PROPS){const a=Array.isArray(g[p.id])?g[p.id]:[];GAR[p.id].forEach((s,i)=>{
    const e=a[i];s.live=null;s.out=false;
    // new shape {car,readyAt}, or the old shape, a bare car snapshot
    if(e&&typeof e==='object'&&!Array.isArray(e)&&('car' in e||'readyAt' in e)){
      s.car=carLoad(e.car);s.readyAt=Number.isFinite(e.readyAt)?clamp(e.readyAt,0,Date.now()+36e5):0}
    else s.car=carLoad(e);
  })}
}
propLoad();
// the car is written back to its slot when you leave it or store it
function propWrite(c){const s=c.slot;if(!s||s.live!==c||!(c.hp>0))return;s.car=carSnap(c);propSave()}
// E on foot: buy at an unowned door, or open the garage of an owned house
function propAct(){for(const p of PROPS){
  if(!p.owned&&Math.hypot(p.door.x-me.x,p.door.y-me.y)<24){buyProp(p);return true}
  if(p.owned&&Math.hypot(p.garage.x-me.x,p.garage.y-me.y)<30){garageOpen(p);return true}}
  return false}
function buyProp(p){
  const price=p.price.toLocaleString('en-US');
  feed(`Buy ${p.name} for $${price} (level ${p.level})`);
  if(lv<p.level){feed(`${p.name} needs level ${p.level}`);return}
  if(me.cash<p.price){feed(`You need $${price}`);return}
  me.cash-=p.price;p.owned=true;if(p.sale)p.sale.visible=false;propSave();jingle('buy');feed(`Bought ${p.name}. Its garage is out front`)}
function garageOpen(p){renderGarage(p);openModal('garage')}
function renderGarage(p){
  $('gTitle').textContent=p.name+' garage';const L=$('gList');L.replaceChildren();
  GAR[p.id].forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.className='b';
    if(!s.car){b.textContent='Empty slot '+(i+1);b.disabled=true}
    else{const t=CT[s.car.type],wait=Math.ceil((s.readyAt-Date.now())/1000),sw=document.createElement('i');
      sw.style.cssText='display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:8px;vertical-align:middle;background:'+s.car.color;
      b.append(sw,`${t.name}, ${Math.round(s.car.hp/t.hp*100)}% health${s.out?', out now':''}${wait>0?', insurance: ready in '+wait+' s':''}`);
      b.disabled=wait>0;b.onclick=()=>garageTake(p,i)}
    L.appendChild(b)})}
// a free spot beside a door: 40 to 120 units out, not inside a wall
function spotNear(x,y){for(let r=40;r<=120;r+=20)for(let k=0;k<8;k++){const a=k*Math.PI/4,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;if(!inBuilding(px,py))return{x:px,y:py,a:a+Math.PI/2}}return{x,y,a:0}}
// take a car out of its slot: the one live copy moves to the garage front, or a new one spawns there. You drive it.
function garageTake(p,i){const s=GAR[p.id][i];if(!s.car||s.readyAt>Date.now())return;closeShop();
  const at=spotNear(p.garage.x,p.garage.y);let c=s.live&&cars.includes(s.live)?s.live:null;
  if(c){c.x=at.x;c.y=at.y;c.a=at.a;c.vx=c.vy=0}
  else{c=mkCar(at.x,at.y,at.a,'parked',s.car.color,s.car.type);c.hp=s.car.hp;c.mods={...s.car.mods};c.personal=true;c.slot=s;s.live=c;s.out=true;cars.push(c)}
  c.kind='mine';c.keyed=1;me.car=c;handsUp=false;feed(`Your ${CT[c.type].name} is out`)}
// drive into an owned garage door (within 30, under 60): the car is stored and you walk out beside the door
function propStore(){const c=me.car;if(c.kind==='police'||c.type==='armored'||c.kind==='dead'||c.burn||c.hp<=0||c.mark||c.rv||c.garCd>time||Math.hypot(c.vx,c.vy)>=60)return;
  const p=PROPS.find(q=>q.owned&&Math.hypot(q.garage.x-c.x,q.garage.y-c.y)<30);if(!p)return;
  const own=c.slot&&c.slot.prop===p?c.slot:GAR[p.id].find(s=>!s.car);
  if(!own){c.garCd=time+4;feed(`${p.name} garage is full`);return}
  if(c.slot&&c.slot!==own){c.slot.car=null;c.slot.out=false;c.slot.live=null}
  own.car=carSnap(c);own.out=false;own.live=null;
  const i=cars.indexOf(c);if(i>=0)cars.splice(i,1);me.car=null;
  for(const s of[-1,1]){const x=c.x+Math.cos(c.a+s*1.57)*24,y=c.y+Math.sin(c.a+s*1.57)*24;if(!inBuilding(x,y)){me.x=x;me.y=y;break}}
  me.z=groundZ(me.x,me.y);me.vx=me.vy=0;propSave();feed(`Stored in ${p.name} garage`)}
// a destroyed personal car: insurance pays up to $500 and the car is back in its slot after 60 s
function propStep(){for(const p of PROPS)for(const s of GAR[p.id]){const c=s.live;if(!c||c.kind!=='dead')continue;
  const i=cars.indexOf(c);if(i>=0)cars.splice(i,1);if(me.car===c)me.car=null;
  const fee=Math.min(500,Math.max(0,Math.floor(me.cash)));me.cash-=fee;
  s.car={...s.car,hp:CT[s.car.type].hp};s.out=false;s.live=null;s.readyAt=Date.now()+60000;
  feed(`Your ${CT[s.car.type].name} was destroyed. Insurance: $${fee}, ready in your garage in 60 s`);propSave()}}
// a personal car for the phone's Mechanic and for tests: it spawns on a road 80 to 160 units away and becomes the personal car
function deliverCar(propId,slot){const s=GAR[propId]&&GAR[propId][slot];if(!s||!s.car)return null;
  if(!s.live||!cars.includes(s.live)){let c=null;for(let i=0;i<20&&!c;i++)c=laneSpawn('parked',80,160);if(!c)return null;c.type=s.car.type;c.color=s.car.color;c.hp=s.car.hp;c.mods={...s.car.mods};s.live=c}
  const c=s.live;c.personal=true;c.slot=s;c.out=true;c.keyed=1;return c}
function ownedCars(){const L=[];for(const p of PROPS)GAR[p.id].forEach((s,i)=>{if(s.car)L.push({propId:p.id,slot:i,car:s.car,out:s.out,ready:Date.now()>=s.readyAt})});return L}
if(DBG)Object.defineProperties(DBG,{props:{get:()=>PROPS.map(p=>({id:p.id,owned:!!p.owned}))},ownedCars:{get:()=>ownedCars},deliverCar:{get:()=>deliverCar},inBuilding:{get:()=>inBuilding},garage:{get:()=>id=>garageOpen(PROPS.find(p=>p.id===id))}});

