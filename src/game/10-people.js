// ---------- state ----------
const me={x:4*B+R+7,y:4*B+R+7,a:0,vx:0,vy:0,hp:BAL.playerHp,car:null,cash:10000,inv:2,lastHurt:0,fireCd:0,lastHitBy:null,lastHitT:-99,bustT:0,inside:null,door:null,z:0,roof:null,climb:null};
const A={x:me.x,y:me.y};let lap=null;
let flareSeq=0,flareCd=0,rob=null;const robCd={};
let burstZ=0,heli=null,heliWait=0,heliSide=1,heliUpT=false,heliDnT=false;
let lockTarget=null,armorWait=45,fireZ=12,fireSpd=0,fireLife=0,scoped=false,fireSlope=0,aimPt=null,aimHit=false;
function homePos(h){if(!h)return null;if(h.air)return h.air.dead?null:h.air;if(h.car)return h.car.kind==='dead'?null:h.car;if(h.peer){if(h.peer===myPeer)return state==='play'?(me.car||me):null;const r=remotes.get(h.peer);return r&&!r.dead?r:null}return null}
function steerMissile(b,dt){const t=homePos(b.home);if(!t)return;if(b.home.peer&&b.home.peer!==myPeer){const r=remotes.get(b.home.peer);if(r&&time-(r.flareT||-9)<2.5){b.home=null;b.vz=-80;return}}const dx=t.x-b.x,dy=t.y-b.y,d=Math.hypot(dx,dy);if(d<18){b.life=0;return}
  const cur=Math.atan2(b.vy,b.vx),na=cur+clamp(wrap(Math.atan2(dy,dx)-cur),-3*dt,3*dt),sp=Math.hypot(b.vx,b.vy);b.vx=Math.cos(na)*sp;b.vy=Math.sin(na)*sp;const fly=!!(b.home.air||t.inHeli||t.inJet),lim=fly?600:400,tz=fly?(t.z||0)+4:t===me?(me.z||0)+12:t.inCar===false?(t.z||0)+12:10;b.vz=clamp((tz-b.z)*3,-lim,lim)}
function findLock(){const c=me.car,ox=c?c.x:me.x,oy=c?c.y:me.y,fa=c?c.a:look.yaw;let best=null,bs=1e9;
  const air=[];if(typeof copHeli!=='undefined'&&copHeli&&!copHeli.dead)air.push({air:copHeli,name:'Police helicopter'});
  if(heli&&!heli.dead&&me.heli!==heli)air.push({air:heli,name:'Attack helicopter'});
  for(const j of jets)if(!j.dead&&me.jet!==j)air.push({air:j,name:'Fighter jet'});
  for(const a of air){const v=a.air;if(v.z<=8)continue;const dx=v.x-ox,dy=v.y-oy,d=Math.hypot(dx,dy);if(d>1400||d<30)continue;const da=Math.abs(wrap(Math.atan2(dy,dx)-fa));if(da>.6)continue;const sc=d*(1+da*2)*.8;if(sc<bs){bs=sc;best=a}}
  for(const[peer,r]of remotes){if(r.dead||!(r.inCar||r.inHeli||r.inJet))continue;const fly=(r.inHeli||r.inJet)&&r.z>8,dx=r.x-ox,dy=r.y-oy,d=Math.hypot(dx,dy);if(d>(fly?1400:1100)||d<30)continue;const da=Math.abs(wrap(Math.atan2(dy,dx)-fa));if(da>.6)continue;const sc=d*(1+da*2)*(fly?.8:1);if(sc<bs){bs=sc;best={peer,name:r.name}}}
  if(best)return best;
  for(const v of cars){if(v===c||v.kind==='dead'||v.kind==='mine')continue;const dx=v.x-ox,dy=v.y-oy,d=Math.hypot(dx,dy);if(d>800||d<30)continue;const da=Math.abs(wrap(Math.atan2(dy,dx)-fa));if(da>.45)continue;const sc=d*(1+da*2);if(sc<bs){bs=sc;best={car:v,name:ctOf(v).name}}}
  return best}let clubHype=0,drunk=0;
let state='menu',deadT=0,heat=0,coolT=0,time=0,shotSeq=0,lastShot=null,cid=0,myName='Nightrider',myColor='#ff3ea5',muted=false,shake=0;
const cars=[],peds=[],bullets=[],parts=[],pickups=[];
const cam={x:me.x,y:me.y,z:1};
const dmgOut={},killedBy={};
const WEAPONS=[
  {id:'pistol',name:'Pistol',price:0,cd:.2,dmg:BAL.wdmg.pistol,spread:.03,pellets:1,ammoAmt:0,ammoPrice:0,desc:'Unlimited ammo. Always on you.'},
  {id:'smg',name:'SMG',price:250,cd:.085,dmg:BAL.wdmg.smg,spread:.09,pellets:1,ammoAmt:150,ammoPrice:60,desc:'Fast and light. Good for drive-bys.'},
  {id:'shotgun',name:'Shotgun',price:400,cd:.75,dmg:BAL.wdmg.shotgun,spread:.3,pellets:BAL.shotPellets,ammoAmt:24,ammoPrice:50,desc:'Six pellets per shot. Brutal up close.'},
  {id:'mg',name:'Machine gun',price:700,cd:.055,dmg:BAL.wdmg.mg,spread:.07,pellets:1,ammoAmt:300,ammoPrice:120,desc:'Huge fire rate. Shreds cars.'},
  {id:'sniper',name:'Sniper rifle',price:1800,cd:1.1,dmg:BAL.wdmg.sniper,spread:0,pellets:1,speed:1900,life:1,ammoAmt:20,ammoPrice:150,get desc(){return 'One shot, one KO. Hold right-click (or press '+kb('scope')+') to scope.'}},
  {id:'rpg',name:'RPG',price:1200,cd:1.1,dmg:0,spread:.01,pellets:1,rocket:true,ammoAmt:5,ammoPrice:300,desc:'Rockets that explode on impact. Mind the blast.'},
  {id:'homing',name:'Homing launcher',price:2500,cd:1.6,dmg:0,spread:0,pellets:1,rocket:true,homing:true,ammoAmt:4,ammoPrice:500,desc:'Locks onto players in cars (or any vehicle ahead of you). Hard to shake off.'},
  {id:'sticky',name:'Sticky bombs',price:1500,cd:.45,dmg:0,spread:0,pellets:1,throw:true,ammoAmt:5,ammoPrice:400,get desc(){return 'Throw them. They stick to cars, walls and the ground. Press '+kb('detonate')+' to detonate.'}},
];
const WI={};WEAPONS.forEach((w,i)=>WI[w.id]=i);
let owned={pistol:true},ammo={},weap='pistol',shopCd=0,heatShotT=0;
const SHOPS=[[1,1],[6,2],[2,6],[5,5]].map(([bi,bj])=>({x:bi*B+R+(B-R)/2,y:bj*B+R+9}));
const INT=[],iwalls=[];
function mkRoom(id,name,w,h,col,k){const ox=W+700+k*800,oy=600,t=14;const r={id,name,ox,oy,w,h,col,exit:{x:ox+w/2,y:oy+h-22},spots:[],props:[]};
  iwalls.push({x:ox-t,y:oy-t,w:w+2*t,h:t},{x:ox-t,y:oy+h,w:w+2*t,h:t},{x:ox-t,y:oy,w:t,h},{x:ox+w,y:oy,w:t,h});INT.push(r);return r}
function prop(r,x,y,w,h,ht,col,solid){const p={x:r.ox+x,y:r.oy+y,w,h,ht,col};r.props.push(p);if(solid!==false)iwalls.push(p);return p}
// a casino table: solid like any prop, drawn as a felt table (see the casino look block)
const tableProp=(r,x,y,w,h,ht,col)=>{const p=prop(r,x,y,w,h,ht,col);p.tbl=1;return p};
const spot=(r,x,y,act,label)=>r.spots.push({x:r.ox+x,y:r.oy+y,act,label});
const gunInt=mkRoom('guns','Gun shop',260,200,'#1b2a33',0);
prop(gunInt,40,40,180,18,14,'#3a3348');prop(gunInt,0,0,260,10,44,'#2a2333');prop(gunInt,0,60,10,100,36,'#2a2333');prop(gunInt,250,60,10,100,36,'#2a2333');prop(gunInt,14,94,30,16,14,'#3a3348');
spot(gunInt,130,80,'shop','Browse weapons');spot(gunInt,220,150,'safe','Safe');
const club=mkRoom('club','Velvet Palms',440,330,'#24102a',1);
prop(club,110,18,220,62,6,'#3a1840');prop(club,18,110,26,150,16,'#3b2416');prop(club,370,150,50,40,14,'#151022');
for(const[x,y]of[[70,290],[380,280],[90,60],[360,60]])prop(club,x,y,18,18,10,'#2c1a33');
spot(club,220,100,'tip','Tip the dancers ($10)');prop(club,350,300,72,18,9,'#6a1a52');spot(club,386,262,'vip','Private dance in the VIP booth ($100)');spot(club,62,185,'drink','Buy a drink ($15, +25 health)');
const store=mkRoom('store','Snack & Go',240,180,'#1c2622',2);
prop(store,30,40,14,90,26,'#2f3b35');prop(store,80,40,14,90,26,'#2f3b35');prop(store,130,40,14,90,26,'#2f3b35');prop(store,180,20,50,16,14,'#3a3348');prop(store,0,0,240,8,40,'#2a3a34');
iwalls.push({x:store.ox+214,y:store.oy+36,w:26,h:84}); // fridge row: walls for the cabinet drawn in the interior look
spot(store,205,52,'snack','Buy snacks ($20, full health)');
const home=mkRoom('home','Safehouse',260,200,'#1e1a2c',3);
prop(home,20,20,60,80,10,'#3b3355');prop(home,150,30,80,26,12,'#4a2f3a');prop(home,150,0,80,6,30,'#121018');
spot(home,95,60,'sleep','Sleep (heal, save, lose the cops)');spot(home,200,130,'board','Open the heist board');
const casino=mkRoom('casino','Lucky Palms Casino',640,460,'#3a1030',4);
tableProp(casino,150,40,120,44,11,'#145a3a');
for(let i=0;i<6;i++)prop(casino,8,40+i*30,22,26,30,'#5a2a6e');
for(const y of[230,260])prop(casino,8,y,22,26,30,'#3a1f12');
prop(casino,596,60,26,170,16,'#3b2416');tableProp(casino,270,170,80,60,11,'#145a3a');tableProp(casino,400,150,80,50,11,'#1d2a5a');
tableProp(casino,150,290,130,44,11,'#145a3a');prop(casino,500,220,90,40,36,'#0f2a1a');prop(casino,40,380,70,50,40,'#2a1a3e');
tableProp(casino,480,350,64,30,11,'#145a3a');tableProp(casino,570,350,50,40,11,'#145a3a');
prop(casino,470,330,156,110,8,'#2a1438',false);
prop(casino,462,320,6,6,22,'#e0b84a');prop(casino,620,320,6,6,22,'#e0b84a');prop(casino,462,322,164,2,16,'#e0b84a',false);prop(casino,462,322,2,118,16,'#e0b84a',false);
spot(casino,210,108,'blackjack','Play blackjack');spot(casino,575,150,'liquor','Whiskey shot ($25, get drunk)');
spot(store,200,120,'liquor','Bottle of vodka ($25, get drunk)');
spot(store,160,16,'rob','Rob the register');
spot(casino,310,255,'roulette','Play roulette');spot(casino,75,345,'wheel','Spin the Lucky Wheel (free each day)');spot(casino,440,232,'rocket','Play Rocket (crash game)');spot(casino,215,355,'poker','Play Three Card Poker');spot(casino,545,280,'horse','Bet on the horses');spot(casino,512,392,'hlbj','High-limit blackjack ($100K cash)');spot(casino,595,402,'hlro','High-limit roulette ($100K cash)');spot(casino,52,110,'slots','Play Candy Cascade slots');spot(casino,52,245,'slots7','Play Neon 7s');
const bankL=mkRoom('bank1','Union Bank · Lobby',440,320,'#5a554a',5);bankL.bank=true;
prop(bankL,150,26,140,24,14,'#2a2618');for(let k=0;k<3;k++){prop(bankL,18,80+k*76,48,26,12,'#3b2f22');spot(bankL,96,93+k*76,'desk','Search the office desk');bankL.spots[bankL.spots.length-1].i=k}
prop(bankL,404,110,30,80,64,'#9a948a');spot(bankL,372,150,'bankUp','Elevator to floor 12 (needs the keycard)');
const bankS=mkRoom('bank2','Union Bank · Floor 12',380,260,'#1e2430',6);bankS.bank=true;
for(let k=0;k<4;k++)prop(bankS,30+k*62,24,34,64,52,'#121820');prop(bankS,150,140,80,24,12,'#2a3342');
spot(bankS,190,184,'hack','Hack the security mainframe');prop(bankS,350,90,26,70,64,'#9a948a');spot(bankS,322,112,'bankDown','Elevator down to the lobby');spot(bankS,322,176,'vaultDown','Stairs down to the vault (after the hack)');
const bankV=mkRoom('bank3','Union Bank · Vault',420,330,'#2a2620',7);bankV.bank=true;
prop(bankV,150,6,120,24,64,'#6a5f3c');spot(bankV,210,58,'drill','Drill the vault door');
for(const[k,x,y]of[[0,64,52],[1,356,52],[2,210,104]]){spot(bankV,x,y,'loot','Grab the gold');bankV.spots[bankV.spots.length-1].i=k}
spot(bankV,390,282,'vaultUp','Stairs up to floor 12');
const laserY=i=>bankV.oy+132+(Math.sin(time*(.9+i*.25)+i*2.1)*.5+.5)*118;
prop(casino,455,10,80,26,30,'#6a6a7a');spot(casino,495,62,'heist','Rob the cashier cage (big heist)');
// places (ticket 21): rooms k=10-16, blocks as in .work/places.md
const diner=mkRoom('diner','Pink Flamingo Diner',360,260,'#2a1430',10);
prop(diner,20,36,320,22,16,'#d9d4e6');prop(diner,40,6,280,8,30,'#3a2b4a');prop(diner,120,2,120,4,34,'#29e6d6',false);
for(let i=0;i<3;i++){prop(diner,8,118+i*46,12,36,12,'#ff5c8a');prop(diner,34,128+i*46,24,20,9,'#e8e0f0')}
for(let i=0;i<2;i++){prop(diner,340,118+i*46,12,36,12,'#ff5c8a');prop(diner,302,128+i*46,24,20,9,'#e8e0f0')}
prop(diner,140,140,40,24,10,'#e8e0f0');prop(diner,200,176,40,24,10,'#e8e0f0');
prop(diner,298,204,28,22,30,'#ff3ea5');
spot(diner,180,100,'menu','Order from the menu');spot(diner,313,236,'jukebox','Change the jukebox station');
const ink=mkRoom('ink','Ink & Fade',300,220,'#1a1f2e',11);
prop(ink,20,6,260,6,44,'#9fe3ff');prop(ink,110,2,80,4,30,'#ff3ea5',false);
for(const x of[50,110]){prop(ink,x,64,28,28,22,'#2b2b3a');prop(ink,x+4,56,20,8,34,'#3a3a4e')}
prop(ink,30,100,150,14,14,'#c9c3d6');spot(ink,64,124,'hair','Get a haircut');
prop(ink,190,70,64,30,14,'#4a2e1e');spot(ink,222,118,'tattoo','Get inked');
prop(ink,262,40,20,120,36,'#2a2440');prop(ink,20,160,40,14,12,'#3b2f5a');prop(ink,80,160,40,14,12,'#3b2f5a');
const gym=mkRoom('gym','Iron Palms Gym',380,260,'#2b4a3d',12);
prop(gym,20,6,340,6,50,'#7fd8ff');prop(gym,6,40,4,180,40,'#3dd68c',false);prop(gym,370,40,4,180,40,'#ff6b3d',false);prop(gym,24,36,110,20,30,'#7a7f99');
for(let i=0;i<4;i++)prop(gym,30+i*24,28,10,28,20,'#ff6b3d',false);
prop(gym,160,40,60,18,14,'#c0392b');spot(gym,190,84,'weights','Lift weights');
prop(gym,290,40,20,20,70,'#ff4b6e');
for(const x of[40,150,260])prop(gym,x,150,84,28,12,'#9aa0b8');
spot(gym,82,192,'treadmill','Run on the treadmill');
prop(gym,16,204,140,30,1,'#3dd68c',false);prop(gym,200,204,160,30,1,'#ff6b3d',false);
const pd=mkRoom('pd','Palmetto PD',400,280,'#23375e',13);
prop(pd,20,6,360,6,44,'#5a78a8');prop(pd,120,2,160,4,36,'#4aa3ff',false);
prop(pd,60,96,220,28,18,'#5a78a8');prop(pd,60,90,220,8,22,'#4aa3ff',false);
spot(pd,170,140,'pd_pay','Pay off your record');
prop(pd,24,14,90,8,48,'#e9e2c8');spot(pd,70,62,'pd_board','Read the wanted board');
for(const[x,y,w,h]of[[300,40,80,4],[300,116,80,4],[300,40,4,80],[376,40,4,80]])prop(pd,x,y,w,h,40,'#9aa3b5');
prop(pd,320,80,40,12,12,'#3b3b4a',false);
prop(pd,20,170,22,80,40,'#7d8fb8');prop(pd,50,170,22,80,40,'#7d8fb8');
prop(pd,120,200,60,24,14,'#6a80ad');prop(pd,230,200,60,24,14,'#6a80ad');
prop(pd,350,236,20,20,40,'#4aa3ff',false);
const hosp=mkRoom('hosp',"St. Palm's Hospital",400,280,'#1a2a2e',14);
prop(hosp,40,60,130,24,18,'#cfe3ee');spot(hosp,105,100,'adr','Buy an adrenaline shot ($1,500)');
for(const[x,y]of[[240,40],[300,40],[240,150],[300,150]])prop(hosp,x,y,36,64,12,'#eef6ff');
spot(hosp,270,126,'checkup','Full checkup ($100)');
prop(hosp,20,180,80,50,22,'#f3f3f3');prop(hosp,20,200,80,5,23,'#ff4b4b',false);
prop(hosp,160,20,80,8,40,'#e6f6ff');prop(hosp,180,4,40,6,20,'#ff4b4b',false);
for(let i=0;i<4;i++)prop(hosp,130+i*20,150,12,12,10,'#3dd68c',false);
const arcade=mkRoom('arcade','Pixel Palace',400,300,'#1a0c2e',15);
const cabC=['#ff3ea5','#29e6d6','#ffc94a','#7b6bff','#3dd68c','#ff6b3d','#4aa3ff'];
for(let i=0;i<6;i++)prop(arcade,30+i*58,24,26,30,36,cabC[i]);
for(let i=0;i<6;i++)prop(arcade,30+i*58,130,26,30,36,cabC[(i+3)%7]);
spot(arcade,43,76,'racer','Play Palm Racer ($5)');spot(arcade,101,76,'snake','Play Snake Bite ($5)');
prop(arcade,150,210,120,24,16,'#ffc94a');spot(arcade,210,256,'prize','Prize counter');
prop(arcade,20,186,360,3,1,'#ff3ea5',false);prop(arcade,20,196,360,3,1,'#29e6d6',false);
prop(arcade,150,4,100,5,40,'#29e6d6',false);
const anchor=mkRoom('anchor','The Rusty Anchor',380,260,'#4a3018',16);
prop(anchor,30,56,200,24,18,'#8a5a30');prop(anchor,30,18,200,10,46,'#5e4226');prop(anchor,120,2,120,4,40,'#ff3ea5',false);
for(let i=0;i<4;i++)prop(anchor,44+i*44,4,8,14,50,cabC[(i+1)%7],false);
spot(anchor,130,108,'drink','Buy a drink ($15, +25 health)');spot(anchor,190,108,'liquor','Whiskey shot ($25, get drunk)');
prop(anchor,200,150,120,64,14,'#0d5a3a');
prop(anchor,366,80,8,50,44,'#e8dcc0');spot(anchor,330,108,'darts','Throw darts ($10 to $500 bets)');
prop(anchor,40,150,40,30,10,'#6b4a2a');prop(anchor,44,186,12,12,10,'#7a4e2a',false);
const doorAt=(bi,bj)=>({x:bi*B+R+(B-R)/2,y:bj*B+R+9});
const DOORS=[...SHOPS.map(p=>({x:p.x,y:p.y,int:gunInt,label:'Gun shop',col:'#29e6d6'})),{...doorAt(3,3),int:club,label:'Velvet Palms',col:'#ff3ea5'},{...doorAt(5,3),int:store,label:'Snack & Go',col:'#3dd68c'},{...doorAt(4,4),int:home,label:'Safehouse',col:'#ffc94a'},{...doorAt(4,2),int:casino,label:'Casino',col:'#c08bff'},{...doorAt(3,4),int:bankL,label:'Union Bank',col:'#ffd76a'},{...doorAt(2,7),int:diner,label:'Pink Flamingo',col:'#ff5c8a'},{...doorAt(3,6),int:ink,label:'Ink & Fade',col:'#7b6bff'},{...doorAt(4,6),int:gym,label:'Iron Palms',col:'#ff8a3d'},{...doorAt(5,2),int:pd,label:'Palmetto PD',col:'#4aa3ff'},{...doorAt(2,2),int:hosp,label:"St. Palm's",col:'#ff4b4b'},{...doorAt(3,5),int:arcade,label:'Pixel Palace',col:'#7dff6a'},{...doorAt(0,5),int:anchor,label:'Rusty Anchor',col:'#e0a050'}];
function enterInt(d){if(d.int===pd&&Math.ceil(heat-.001)>=3){die('BUSTED');return}if(d.int===home&&heist.carry>0){const pay=heist.carry+5000;me.cash+=pay;showBig('HEIST COMPLETE','#ffc94a',`+$${pay.toLocaleString('en-US')} including Vic's bonus`,3);noise(.5,6000,.3);gainXP(600,'Union Job');heistReset();saveArsenal()}
  if(d.int===bankL&&!heist.on&&!heist.briefed&&unlocked('bank')){heist.briefed=true;setTimeout(openBrief,400)}
  me.door=d;me.inside=d.int;me.x=d.int.exit.x;me.y=d.int.exit.y-30;me.vx=me.vy=0;look.yaw=-Math.PI/2;shopCd=1.2;if(d.int!==pd){if(heat>0)feed('You slipped inside. The cops lost you');heat=0}feed(d.int.name)}
function exitInt(){const d=me.door;me.inside=null;if(heist.carry>0&&d&&d.int&&d.int.bank){heat=5;coolT=0;feed('Every cop in the city is coming. Get the gold to the safehouse!')}if(!d)return;me.x=d.x;me.y=d.y-30;me.vx=me.vy=0;look.yaw=-Math.PI/2;shopCd=1.2}
function enterRoom(id){const d=DOORS.find(v=>v.int.id===id);if(d)enterInt(d)}
if(DBG)Object.defineProperties(DBG,{enterRoom:{get:()=>enterRoom},inside:{get:()=>me.inside&&me.inside.id},nearSpot:{get:()=>nearSpot},interact:{get:()=>interact}});
function nearSpot(){if(!me.inside)return null;for(const p of me.inside.spots)if(Math.hypot(p.x-me.x,p.y-me.y)<28)return p;return null}
function interact(){const p=nearSpot();if(!p||state!=='play'||me.downed)return;
  if(p.act==='shop')openShop();
  else if(p.act==='tip'){if(me.cash<10){feed('You need $10 to tip');return}me.cash-=10;clubHype=6;feed('The dancers love it');noise(.2,5000,.15)}
  else if(p.act==='drink'){if(me.cash<15){feed('A drink costs $15');return}me.cash-=15;me.hp=Math.min(BAL.playerHp,me.hp+25);drunk=Math.min(30,drunk+12);feed('Cheers! +25 health')}
  else if(p.act==='snack'){if(me.cash<20){feed('Snacks cost $20');return}me.cash-=20;me.hp=BAL.playerHp;feed('Full health')}
  else if(p.act==='blackjack')openBJ();
  else if(p.act==='liquor'){if(me.cash<25){feed('That costs $25');return}me.cash-=25;drunk=Math.min(60,drunk+20);noise(.15,1200,.15);feed(drunk>35?'You are hammered. Driving will be rough':'Down the hatch')}
  else if(p.act==='vip')startLap();
  else if(p.act==='prize')miniOpen('lock',openPrize);
  else if(p.act==='safe')miniOpen('lock',()=>{me.cash+=500;feed('Safe open. +$500')});
  else if(placesAct(p)){}
  else if(casinoAct(p)||heistAct(p)){}
  else if(p.act==='rob'||p.act==='heist')startRob(p);
  else if(p.act==='sleep'){me.hp=BAL.playerHp;heat=0;drunk=0;phBat=100;saveArsenal();showBig('RESTED','#ffc94a','Progress saved',1.6)}}
let job=null;
if(DBG)Object.defineProperties(DBG,{lockTarget:{get:()=>lockTarget},findLock:{get:()=>findLock},jets:{get:()=>jets},remotes:{get:()=>remotes},equip:{get:()=>equip},ammo:{get:()=>ammo}});

// ---------- cars ----------
const POS=d=>d===0||d===1,laneOff=d=>(d===0||d===3)?84:36;
function mkCar(x,y,a,kind,color,type){type=hasCT(type)?type:(kind==='police'?'police':pickType());if(CT[type].color)color=CT[type].color;return{id:++cid,type,x,y,a,vx:0,vy:0,z:0,vz:0,air:false,kind,color,hp:CT[type].hp,burn:0,stun:0,cur:0,ghost:0,blockT:0,stuckT:0,revT:0,shootT:rr(1,2),siren:rand()*TAU}}
function along(c){return c.d%2===0?c.x:c.y}
function setAlong(c,v){if(c.d%2===0){c.x=v;c.y=c.road*B+laneOff(c.d)}else{c.y=v;c.x=c.road*B+laneOff(c.d)}}
function decide(c,greedy){
  for(let guard=0;guard<12;guard++){
    const pos=POS(c.d),nc=c.cross+(pos?1:-1),opts=[];
    const ix=c.d%2===0?c.cross:c.road,iy=c.d%2===0?c.road:c.cross,shut=d=>afShut(ix,iy,ix+DX[d],iy+DY[d]); // the crossing ahead and the lane out of it
    if(nc>=0&&nc<=N&&!shut(c.d))opts.push(c.d);
    for(const nd of[(c.d+1)%4,(c.d+3)%4]){const nr=c.road+(POS(nd)?1:-1);if(nr>=0&&nr<=N&&!shut(nd))opts.push(nd)}
    if(!opts.length)break;
    let pick;
    if(greedy){const px=c.d%2===0?c.cross*B+60:c.road*B+60,py=c.d%2===0?c.road*B+60:c.cross*B+60;
      // a rival standing on its target aims at the next one
      const g=c.rv?c.rv.g:me;let tx=g.x-px,ty=g.y-py;if(c.rv&&!tx&&!ty){tx=c.rv.n.x-px;ty=c.rv.n.y-py}let best=-9;for(const o of opts){const s=Math.cos(o*Math.PI/2)*tx+Math.sin(o*Math.PI/2)*ty+rand()*30;if(s>best){best=s;pick=o}}}
    else{pick=opts.length>1&&opts[0]===c.d&&rand()<.5?c.d:opts[Math.floor(rand()*opts.length)]}
    if(pick===c.d){c.cross=nc;continue}
    c.nd=pick;c.tgt=c.cross*B+laneOff(pick);return;
  }
  c.nd=(c.d+2)%4;c.tgt=along(c);
}
// is the lane this car is on (from its last crossing to the next one) shut?
function laneShut(c){const ix=c.d%2===0?c.cross:c.road,iy=c.d%2===0?c.road:c.cross;return afShut(ix-DX[c.d],iy-DY[c.d],ix,iy)}
function laneSpawn(kind,min,max){
  for(let i=0;i<30;i++){
    const d=Math.floor(rand()*4),road=Math.floor(rand()*(N+1)),k=Math.floor(rand()*N),al=k*B+R+rand()*(B-R-20)+10;
    const c=mkCar(0,0,d*Math.PI/2,kind,kind==='police'?'#e9e9f2':CARCOL[Math.floor(rand()*CARCOL.length)]);
    c.d=d;c.road=road;c.cross=POS(d)?k+1:k;setAlong(c,al);
    if(laneShut(c))continue;
    const dist=Math.hypot(c.x-A.x,c.y-A.y);if(dist<min||dist>max)continue;
    c.cop=kind==='police';decide(c,kind==='police');c.spd=kind==='police'?200:rr(95,140);c.cur=c.spd*.6;cars.push(c);return c;
  }
}
function drive(c,thr,steer,hand,dt){
  const fx=Math.cos(c.a),fy=Math.sin(c.a),P=c===me.car,sh=c.spiked?.55:1,sk=c.spiked?.6:1;
  if(P)modBay(c);
  if(P&&state==='shop'){c.vx=c.vy=0;return} // the shop freezes your car
  let fwd=c.vx*fx+c.vy*fy,lat=-c.vx*fy+c.vy*fx;
  const T=ctOf(c),boost=P&&c.boost,max=(c.kind==='police'?300:T.max*modK(c,'max')*(boost?1.2:1)*(P?drugMul('move'):1))*sh;
  let lg=(hand?1.4:T.grip*modK(c,'grip'))*sk,hl=180,brk=650,coast=110;
  if(P){ // player car: handbrake drift, calmer steering at speed, sharper braking
    const dr=hand&&steer&&Math.hypot(c.vx,c.vy)>160;
    hl=dr?60:180;brk=800*modK(c,'brk');coast=80;
    const tg=dr?.9:hand?1.4:T.grip*modK(c,'grip');driftG=tg<driftG?tg:Math.min(tg,driftG+dt*(T.grip-.9)/.4);lg=driftG*sk;
    c.brk=thr<0&&fwd>0;
  }
  if(P&&c.air){c.x+=c.vx*dt;c.y+=c.vy*dt;return} // airborne: no throttle, steering or friction
  if(P){const[gx,gy]=groundN(c.x,c.y);fwd-=260*(gx*fx+gy*fy)*dt} // uphill takes speed, downhill gives it
  if(thr>0)fwd+=(fwd<0?650:T.acc*modK(c,'acc')*(boost?1.8:1)*sh)*thr*dt;
  else if(thr<0)fwd+=(fwd>0?-brk:-240)*(-thr)*dt;
  else fwd-=Math.sign(fwd)*Math.min(Math.abs(fwd),coast*dt);
  if(hand)fwd-=Math.sign(fwd)*Math.min(Math.abs(fwd),hl*dt);
  fwd=clamp(fwd,-130,max);
  lat-=lat*Math.min(1,lg*wxGrip*dt);
  c.a+=steer*2.7*clamp(fwd/150,-1,1)*dt*(hand?1.35:1)*(P&&Math.abs(fwd)>.75*max?.75:1);
  c.vx=fx*fwd-fy*lat;c.vy=fy*fwd+fx*lat;
  c.x+=c.vx*dt;c.y+=c.vy*dt;
  if(P)driftA=Math.hypot(c.vx,c.vy)>5?Math.abs(wrap(Math.atan2(c.vy,c.vx)-c.a)):0;
}
// Player car height. On the ground z follows groundZ and vz is the ground's rise per second along the motion.
// If the ground falls away faster than the car rises (lip, crest, cliff) the car goes airborne under gravity 650 times the grav city rule.
function carZ(c,dt){
  const g=groundZ(c.x,c.y);
  if(!c.air&&g<c.z+c.vz*dt-2){c.air=true;c.airT=0}
  if(c.air){
    c.airT+=dt;c.vz-=carGravity()*dt;c.z+=c.vz*dt;
    if(c.z>g)return;
    const hit=-c.vz;c.air=false;c.z=g;c.vz=0;
    if(hit>260){damageCar(c,Math.min(BAL.crashMax,(hit-260)*.12),true);thud(hit);shake=Math.max(shake,hit/60)}
    if(c.airT>.6){const pay=Math.round(250*(c.airT-.3));me.cash+=pay;showBig('STUNT JUMP','#ffc94a',`+$${pay} for ${c.airT.toFixed(1)} s in the air`,2);gainXP(50*c.airT,'Stunt jump')}
    return;
  }
  c.vz=dt>0?(g-c.z)/dt:0;c.z=g; // the rise this frame, so a lip carries the climb speed off the edge
}
// nose pitch of a car on the ground slope (Euler order YZX: roll, then pitch in the car's frame, then heading), or the flight pitch in the air
function carPitch(c){if(c.air)return Math.atan2(c.vz||0,Math.max(1,Math.hypot(c.vx,c.vy)));const[gx,gy]=groundN(c.x,c.y);return Math.atan(gx*Math.cos(c.a)+gy*Math.sin(c.a))}
// roll: the lateral slope (left of the heading is +), so the uphill side rides higher
function carRoll(c){if(c.air)return 0;const[gx,gy]=groundN(c.x,c.y);return -Math.atan(-gx*Math.sin(c.a)+gy*Math.cos(c.a))}
function carCircles(c){const o=ctOf(c).len/4,fx=Math.cos(c.a)*o,fy=Math.sin(c.a)*o;return[[c.x+fx,c.y+fy],[c.x-fx,c.y-fy]]}
function carWalls(c){let imp=0;for(const[px,py]of carCircles(c))imp=Math.max(imp,collide(c,px,py,ctOf(c).wid/2));return imp}
const dynamic=c=>c.kind!=='traffic'&&c.kind!=='hill'&&!(c.kind==='police'&&c.mode!=='chase');
function carPair(a,b){
  if(Math.abs((a.z||0)-(b.z||0))>Math.max(ctOf(a).h,ctOf(b).h))return 0; // airborne cars fly over the ones below
  const ca=carCircles(a),cb=carCircles(b),rs=(ctOf(a).wid+ctOf(b).wid)/2;let imp=0;
  for(const p of ca)for(const q of cb){
    let dx=p[0]-q[0],dy=p[1]-q[1],d2=dx*dx+dy*dy;if(d2>=rs*rs||d2<1e-6)continue;
    const d=Math.sqrt(d2),nx=dx/d,ny=dy/d,pen=rs-d,da=dynamic(a),db=dynamic(b);
    if(da&&db){a.x+=nx*pen/2;a.y+=ny*pen/2;b.x-=nx*pen/2;b.y-=ny*pen/2}else if(da){a.x+=nx*pen;a.y+=ny*pen}else if(db){b.x-=nx*pen;b.y-=ny*pen}
    const rvx=(a.vx||0)-(b.vx||0),rvy=(a.vy||0)-(b.vy||0),vn=rvx*nx+rvy*ny;
    if(vn<0){imp=Math.max(imp,-vn);
      if(da&&db){const j=-1.2*vn/2;a.vx+=j*nx;a.vy+=j*ny;b.vx-=j*nx;b.vy-=j*ny}
      else if(da){a.vx-=1.2*vn*nx;a.vy-=1.2*vn*ny}else if(db){b.vx+=1.2*vn*nx;b.vy+=1.2*vn*ny}}
  }
  return imp;
}
function damageCar(c,amt,byMe){
  if(c.kind==='dead'||amt<=0)return;if(byMe)c.lastByMe=true;
  c.hp-=amt*modK(c,'arm');
  if(c.kind==='traffic'&&amt>4){wreck(c,byMe)}
  if(c.kind==='police'&&byMe)addHeat(.2);
  if(c.hp<=0&&!c.burn){c.burn=3.2;c.hp=0}
}
function wreck(c,byMe){ // a traffic car leaves its lane; the driver bails
  c.kind='parked';c.vx=Math.cos(c.a)*c.cur*.5;c.vy=Math.sin(c.a)*c.cur*.5;
  const p=spawnPed(c.x+Math.cos(c.a+1.57)*20,c.y+Math.sin(c.a+1.57)*20);p.flee=4;p.fx=c.x;p.fy=c.y;
}

if(DBG)Object.defineProperties(DBG,{mkCar:{get:()=>mkCar},laneSpawn:{get:()=>laneSpawn}});
// ---------- police ----------
let lastSeen=null,unseenT=0,copHeli=null,blockCd=0,policeBusy=false;
// The world anchor for police aim: while the player is indoors this is the door, never the
// interior coordinates, so no cruiser, cop or searchlight can track through a wall.
const copX=()=>A.x,copY=()=>A.y;
const spikes=[];
function blockedLine(x1,y1,x2,y2){
  let hit=false;
  for(let i=1;i<=8;i++){const t=i/9,px=x1+(x2-x1)*t,py=y1+(y2-y1)*t;
    nearB(px,py,b=>{if(b.kind!=='water'&&px>b.x&&px<b.x+b.w&&py>b.y&&py<b.y+b.h)hit=true});
    if(hit)break}
  return hit;
}
function copStep(c,dt){
  const stn=Math.ceil(heat-.001),play=state==='play';
  let tx=copX(),ty=copY();
  if(c.mode==='block'){ // roadblock cruiser: parked until you come within 120, then it joins the chase
    if(heat<=0||!play){c.vx=c.vy=0;return}
    if(!c.chase&&Math.hypot(copX()-c.x,copY()-c.y)>120)return;
    c.chase=true;c.mode='chase';
  }
  const d=Math.hypot(copX()-c.x,copY()-c.y);
  if(c.mode!=='chase'){c.cur+=(c.spd-c.cur)*Math.min(1,2*dt);laneMove(c,dt,heat>0);if(heat>0&&d<280&&play){c.mode='chase';c.vx=Math.cos(c.a)*c.cur;c.vy=Math.sin(c.a)*c.cur}}
  else{
    let thr=0,st=0;
    if(heat>0&&play){
      if(unseenT>4&&lastSeen){ // searching: poke around the search circle instead of a blind player
        if(!c.stX||time>c.sT||Math.hypot(c.stX-lastSeen.x,c.stY-lastSeen.y)>260+140*stn){const r=rr(60,220+140*stn),a=rand()*TAU;c.stX=lastSeen.x+Math.cos(a)*r;c.stY=lastSeen.y+Math.sin(a)*r;c.sT=time+rr(3,5)}
        tx=c.stX;ty=c.stY}
      if(me.car&&stn>=2&&Math.hypot(me.car.x-c.x,me.car.y-c.y)<70){tx=me.car.x-Math.cos(me.car.a)*20;ty=me.car.y-Math.sin(me.car.a)*20} // ram the rear quarter
      const td=Math.hypot(tx-c.x,ty-c.y),want=Math.atan2(ty-c.y,tx-c.x),diff=wrap(want-c.a);
      st=clamp(diff*2.2,-1,1);thr=td>70?1:(me.car?1:.15);
      const sp=Math.hypot(c.vx,c.vy);c.stuckT=sp<25&&thr>.5?c.stuckT+dt:0;if(c.stuckT>1){c.revT=.9;c.stuckT=0}
      if(c.revT>0){c.revT-=dt;thr=-1;st=-st}
      c.shootT-=dt;
      if(stn>=2&&c.shootT<=0&&d<300&&!c.burn&&!me.inside){c.shootT=rr(1.2,2);const a=Math.atan2(copY()-c.y,copX()-c.x)+rr(-.12,.12);
        if(!blockedLine(c.x,c.y,copX(),copY()))fire(c.x+Math.cos(a)*16,c.y+Math.sin(a)*16,a,'police',BAL.npc.police)}
      if(!c.copped&&stn===1&&d<140&&!me.inside&&!me.car&&!me.heli&&!me.jet&&!me.roof&&(me.z||0)<3&&Math.hypot(c.vx,c.vy)<20){c.copped=true;spawnCop(c)}
    }
    if(c.burn)thr=st=0;
    drive(c,thr,st,false,dt);const imp=carWalls(c);if(imp>140)damageCar(c,Math.min(BAL.crashMax,(imp-140)*.05),false);
  }
}
function spawnCop(c){ // a foot cop steps out beside a stopped cruiser
  const a=c.a+1.57;policeBusy=true;
  peds.push({x:c.x+Math.cos(a)*30,y:c.y+Math.sin(a)*30,vx:0,vy:0,a:a,spd:150,flee:0,fx:0,fy:0,down:0,skin:PEDCOL[Math.floor(rand()*5)],shirt:'#1e2a4d',fem:false,hair:'#1e2a4d',skirt:null,ci:0,dir:1,ph:rand()*TAU,kind:'cop',brave:'coward',cop:true,cd:rr(.8,1.6),armed:0,arT:0});
}
function copPedStep(p,i,dt,stn){
  const d=Math.hypot(copX()-p.x,copY()-p.y);
  if(p.down){p.down-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.02,dt);p.vy*=Math.pow(.02,dt);collide(p,p.x,p.y,6);if(p.down<=0)peds.splice(i,1);return}
  p.armed=stn>=2?9:0;
  let vx=0,vy=0;
  if(heat>0&&state==='play'&&!me.inside){
    if(d>16){vx=(me.x-p.x)/(d||1)*150;vy=(me.y-p.y)/(d||1)*150;p.a=Math.atan2(me.y-p.y,me.x-p.x)}
    p.cd-=dt;
    if(stn>=2&&p.cd<=0&&d<300){p.cd=rr(1.2,2);const a=p.a+rr(-.1,.1);
      if(!blockedLine(p.x,p.y,me.x,me.y))fire(p.x+Math.cos(a)*10,p.y+Math.sin(a)*10,a,'police',BAL.npc.police)}
    if(stn===1&&!me.car&&!me.heli&&!me.jet&&d<26&&!me.inside&&!me.roof&&(me.z||0)<3){ // arrest: box you in for 1.2 s
      p.arT+=dt;if(p.arT>1.2){die('BUSTED');return}
    }else p.arT=0;
  }
  p.vx=vx;p.vy=vy;p.x+=p.vx*dt;p.y+=p.vy*dt;collide(p,p.x,p.y,6);
  if(heat<=0&&d>500)peds.splice(i,1);
}
function segCross(ax,ay,bx,by,cx,cy,ex,ey){
  const d1=(ex-cx)*(ay-cy)-(ey-cy)*(ax-cx),d2=(ex-cx)*(by-cy)-(ey-cy)*(bx-cx),d3=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax),d4=(bx-ax)*(ey-ay)-(by-ay)*(ex-ax);
  return((d1>0)!==(d2>0))&&((d3>0)!==(d4>0));
}
function spikeStep(dt){ // a car that crosses a spike strip has its tyres shredded until it is destroyed
  if(!spikes.length)return;
  for(let i=spikes.length-1;i>=0;i--)if(time-spikes[i].t>180)spikes.splice(i,1); // old strips go away
  for(const c of cars){
    if(c.kind==='dead'||c.spiked)continue;
    const px=c.x-c.vx*dt,py=c.y-c.vy*dt;if(px===c.x&&py===c.y)continue;
    for(const s of spikes){if(Math.abs(c.x-s.x)>90||Math.abs(c.y-s.y)>90)continue;const hx=Math.cos(s.a)*s.l/2,hy=Math.sin(s.a)*s.l/2;
      if(segCross(px,py,c.x,c.y,s.x-hx,s.y-hy,s.x+hx,s.y+hy)){
        c.spiked=true;
        if(c===me.car)feed('Your tyres are shredded');
        break;
      }
    }
  }
}
function spawnCopHeli(){
  const a=rand()*TAU,d=rr(520,900);
  return{x:me.x+Math.cos(a)*d,y:me.y+Math.sin(a)*d,z:150,hp:300,vx:0,vy:0,a:0,shootT:2.5,dead:false,falling:false,wait:0};
}
function copHeliStep(dt,st){ // hovers at 150, hunts a point 80 behind you, shoots a burst at 5 stars
  const h=copHeli;
  if(h.dead){h.wait-=dt;if(h.wait<=0&&st>=4)copHeli=spawnCopHeli();return}
  if(h.falling){h.vz=(h.vz||0)-320*dt;h.z+=(h.vz||0)*dt;h.a+=dt*4;h.x+=h.vx*dt;h.y+=h.vy*dt;
    const g=groundZ(h.x,h.y);if(h.z<=g){h.z=g;h.dead=true;h.wait=30;explode(h.x,h.y,false,false,h.z);addHeat(.5)}return}
  const pa=me.car?me.car.a:me.a,tx=copX()-Math.cos(pa)*80,ty=copY()-Math.sin(pa)*80,dx=tx-h.x,dy=ty-h.y,d=Math.hypot(dx,dy)||1,sp=Math.min(260,d*2);
  h.vx+=(dx/d*sp-h.vx)*Math.min(1,dt*1.5);h.vy+=(dy/d*sp-h.vy)*Math.min(1,dt*1.5);
  h.x+=h.vx*dt;h.y+=h.vy*dt;h.a+=wrap(Math.atan2(dy,dx)-h.a)*Math.min(1,dt*3);h.z=150;
  if(h.hp<=0){h.falling=true;h.vz=0;return}
  h.shootT-=dt;
  if(st>=5&&h.shootT<=0&&!me.inside){h.shootT=2.5;fireZ=h.z-groundZ(h.x,h.y);fireSlope=clamp((groundZ(copX(),copY())+2-h.z)/(Math.hypot(copX()-h.x,copY()-h.y)||1),-3,2);
    for(let i=0;i<3;i++){const a=Math.atan2(copY()-h.y,copX()-h.x)+rr(-.42,.42);fire(h.x,h.y,a,'police',8)} // sprayed from a hovering platform
    fireZ=12;fireSlope=0}
}
function policeStep(dt){
  // sight: a cruiser or foot cop with a clear line to you, or the police helicopter within 650 (it flies above the roofs)
  let seen=false;
  if(state==='play'&&!me.inside&&!inBuilding(me.x,me.y)){
    for(const c of cars)if(!seen&&c.kind==='police'&&!c.burn&&Math.hypot(c.x-me.x,c.y-me.y)<430&&!blockedLine(c.x,c.y,me.x,me.y))seen=true;
    for(const p of peds)if(!seen&&p.cop&&!p.down&&Math.hypot(p.x-me.x,p.y-me.y)<430&&!blockedLine(p.x,p.y,me.x,me.y))seen=true;
    if(!seen&&copHeli&&!copHeli.dead&&!copHeli.falling&&Math.hypot(copHeli.x-me.x,copHeli.y-me.y)<650)seen=true;
  }
  if(seen){lastSeen={x:me.x,y:me.y};unseenT=0;policeBusy=true}else if(state==='play'&&heat>0&&drugState.k!=='calm')unseenT+=dt; // no heat, no one is watching, and a menu is not hiding
  coolT=seen?0:coolT+dt; // pdPay reads coolT as the time since the cops last saw you
  const pv=heat;
  if(heat>0&&drugState.k!=='calm'){ // hide: waited out the search, or sat outside the search circle
    const st0=Math.ceil(heat-.001),r=220+140*st0;
    if(unseenT>5+3*st0||(unseenT>=3&&lastSeen&&Math.hypot(me.x-lastSeen.x,me.y-lastSeen.y)>r))heat=0;
  }
  if(heat===0&&pv>0){
    if(maxHeatThisChase>=2)gainXP(40*maxHeatThisChase,'Lost the cops');
    feed('You lost the cops');
  }
  // heat can be cleared outside this step (a door, a place, the safehouse, the lawyer): never leave
  // police property in the world behind it, or the helicopter stalks the player with no chase left
  if(heat===0&&policeBusy)policeClear();
  if(heat>maxHeatThisChase)maxHeatThisChase=heat;
  if(heat===0){maxHeatThisChase=0;unseenT=0;lastSeen=null}
  // population: one cruiser per star, SWAT vans at 5, roadblocks at 3, the helicopter at 4
  const st=heat>0?Math.ceil(heat-.001):0,want=[0,1,2,3,4,5][st];
  let pol=0;for(let i=cars.length-1;i>=0;i--){const c=cars[i],d=Math.hypot(c.x-A.x,c.y-A.y);
    if(c.kind==='police'){const on=c.mode!=='block';if(on)pol++;if((heat===0&&(d>650||c.mode==='block'))||d>1500){cars.splice(i,1);if(on)pol--}}
    else if((c.kind==='parked'||c.kind==='dead'||c.kind==='traffic')&&d>1700&&!(c.type==='armored'&&c.kind!=='dead')&&!c.mark&&!c.personal&&!c.rv){cars.splice(i,1)}}
  if(pol<want&&state==='play'&&rand()<dt*.3){const c=laneSpawn('police',650,1000);
    if(c&&st>=5&&rand()<.5){c.type='armored';c.color='#1d2433';c.hp=400}} // half the new 5 star cruisers are SWAT vans
  if(!copHeli&&st>=4&&state==='play'){copHeli=spawnCopHeli();policeBusy=true}
  if(copHeli)copHeliStep(dt,st);
  // roadblocks at 3 or more stars, only while you drive: two cruisers nose to nose across the road ahead, spike strip between them
  blockCd-=dt;
  if(st>=3&&me.car&&state==='play'&&blockCd<=0){
    const c=me.car,off=(laneOff(0)+laneOff(1))/2,vert=Math.abs(Math.sin(c.a))>Math.abs(Math.cos(c.a));
    for(let g=0;g<6;g++){
      const dist=500+g*50,px=c.x+Math.cos(c.a)*dist,py=c.y+Math.sin(c.a)*dist;
      const bx=vert?Math.round(px/B)*B+off:px,by=vert?py:Math.round(py/B)*B+off,dd=Math.hypot(bx-c.x,by-c.y);
      if(dd<460||dd>790)continue;
      let free=true;for(const o of cars)if(o!==c&&o.kind!=='dead'&&Math.hypot(o.x-bx,o.y-by)<90)free=false;
      if(!free)continue;
      for(const s of[1,-1]){const b=mkCar(bx+(vert?50*s:0),by+(vert?0:50*s),vert?(1+s)*Math.PI/2:-s*Math.PI/2,'police','#e9e9f2');
        b.mode='block';b.cop=true;b.spd=0;b.cur=0;cars.push(b)}
      spikes.push({x:bx,y:by,a:vert?0:Math.PI/2,l:70,t:time});if(spikes.length>40)spikes.shift();policeBusy=true;
      blockCd=25;break;
    }
    if(blockCd<=0)blockCd=4; // no free spot this time: wait before the next scan
  }
  spikeStep(dt);
  for(let i=peds.length-1;i>=0;i--){const p=peds[i];if(p&&p.cop)copPedStep(p,i,dt,st)}
}
function policeClear(){ // respawn, die('BUSTED') and any outside heat reset drop everything the police own
  for(let i=peds.length-1;i>=0;i--)if(peds[i].cop)peds.splice(i,1);
  for(let i=cars.length-1;i>=0;i--)if(cars[i].mode==='block'&&cars[i].kind==='police')cars.splice(i,1); // a stolen cruiser stays yours
  spikes.length=0;copHeli=null;lastSeen=null;unseenT=0;blockCd=0;policeBusy=false;
}
if(DBG)Object.defineProperties(DBG,{unseenT:{get:()=>unseenT},lastSeen:{get:()=>lastSeen},copHeli:{get:()=>copHeli},spikes:{get:()=>spikes},addHeat:{get:()=>addHeat}});
if(DBG)Object.defineProperties(DBG,{spawnHeli:{get:()=>()=>copHeli=spawnCopHeli()}}); // debug only: drop a helicopter into the world through the real spawn call

// ---------- peds ----------
const SPORTS=['#ff3ea5','#29e6d6','#ffc94a','#7b6bff'];
const BARKS={bump:['Watch it!','Hey!','Excuse you.'],near:['Are you crazy?!','Slow down!'],gun:["He's got a gun!",'Run!'],call:['Police? Yes, hi...'],nice:['Nice ride.'],greet:['Hi.','Do I know you?','Lovely night.','Leave me alone.']};
const VENDORS=[[1007,1160],[1447,1600],[1887,2480],[1447,4240],[3207,4240]]; // left sidewalk edge, beside a hot dog cart
function spawnPed(x,y){
  let px=x,py=y;const rnd=x===undefined;if(rnd){[px,py]=pointAway(450,1400)}
  const bi=clamp(Math.floor((px-R/2)/B),0,N-1),bj=clamp(Math.floor((py-R/2)/B),0,N-1),d=district(bi,bj);
  const venue=DOORS.some(v=>/Velvet|Snack|Casino/.test(v.label)&&Math.hypot(v.x-px,v.y-py)<500);
  const p={x:px,y:py,vx:0,vy:0,a:0,spd:rr(28,44),flee:0,fx:0,fy:0,down:0,skin:PEDCOL[Math.floor(rand()*5)],shirt:SHIRT[Math.floor(rand()*SHIRT.length)],fem:rand()<.5,hair:HAIRC[Math.floor(rand()*HAIRC.length)],skirt:rand()<.5?['#2a2d3a','#7a2f3a','#3a3f5a','#c9c3d6'][Math.floor(rand()*4)]:null,ci:0,dir:rand()<.5?1:-1,ph:rand()*TAU,kind:'walk',brave:'coward'};
  const bv=rand();if(bv<.05)p.brave='armed';else if(bv<.2)p.brave='fighter';
  let kr=rand();
  for(const[k,w]of[['drunk',venue?.3:.04],['jog',.1],['phone',.08],['tourist',d==='downtown'||d==='midtown'?.08:.02],['beach',d==='beach'?.5:0]]){if(kr<w){p.kind=k;break}kr-=w}
  if(p.kind==='jog'){p.spd=rr(70,85);p.shirt=SPORTS[Math.floor(rand()*SPORTS.length)]}
  if(p.kind==='phone'){p.phT=rr(4,10);p.still=false}
  if(p.kind==='tourist')p.tourT=rr(8,14);
  if(p.kind==='beach')p.beachT=rr(3,10);
  setPedBlock(p);peds.push(p);
  if(rnd&&['downtown','midtown','beach'].includes(d)&&rand()<.1){ // a group of 2 or 3 chatting, 14 units apart
    const n=rand()<.5?2:3,rad=7/Math.sin(Math.PI/n);
    p.kind='chat';p.x=px+rad;p.y=py;p.fa=Math.PI;setPedBlock(p);
    for(let i=1;i<n;i++){const a=i*TAU/n,q=spawnPed(px+Math.cos(a)*rad,py+Math.sin(a)*rad);q.kind='chat';q.fa=a+Math.PI}
  }
  return p;
}
function setPedBlock(p){
  p.bi=clamp(Math.floor((p.x-R/2)/B),0,N-1);p.bj=clamp(Math.floor((p.y-R/2)/B),0,N-1);
  const c=pedCorners(p);let best=1e9;c.forEach((q,i)=>{const d=Math.hypot(q[0]-p.x,q[1]-p.y);if(d<best){best=d;p.ci=i}});
}
function pedCorners(p){const x0=p.bi*B+R+7,y0=p.bj*B+R+7,x1=(p.bi+1)*B-7,y1=(p.bj+1)*B-7;return[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]}
function knockPed(p,vx,vy,byMe){
  if(p.down)return;p.down=10;p.vx=vx;p.vy=vy;
  if(p.bag&&byMe&&Math.hypot(vx,vy)>55){p.bag=0;me.cash+=150;feed('Bag returned to the shop. '+money(150))}
  if(!p.cop){pickups.push({x:p.x,y:p.y,amt:Math.floor(p.gang?rr(40,150):rr(5,40)),t:25})}
  burst(p.x,p.y,8,'#ffd27a',140,.35);
  if(byMe){if(p.cop)addHeat(.6);else if(p.gang)addHeat(.1);else crime(p.x,p.y,.4)}if(p.gang&&byMe)gainXP(6,'Gang member');
  if(p.gang){for(const q of peds)if(q.gang&&!q.down&&Math.hypot(q.x-p.x,q.y-p.y)<420)q.aggro=true;
    if(byMe&&job&&job.type==='turf'&&(p.gname||'Vipers')===(job.gname||'Vipers')&&Math.hypot(p.x-job.x,p.y-job.y)<420)job.n++} // turf kills only count near the hood or the docks
  if(byMe)for(const q of peds)if(!q.down&&Math.hypot(q.x-p.x,q.y-p.y)<40)provoke(q);
  scare(p.x,p.y,260);
}
function scare(x,y,r){for(const p of peds){if(p.down||p.cop)continue;if(p.gang){if(Math.hypot(p.x-x,p.y-y)<r*1.2)p.aggro=true;continue}if(Math.hypot(p.x-x,p.y-y)<r){if(p.vendor){p.crouch=3+rand()*2;continue}p.flee=3+rand()*2;p.fx=x;p.fy=y}}}
function provoke(q){if(q.brave==='fighter'&&!q.fight){q.fight=12;q.punchT=0}}
function bark(p,ev,col){if(p.bark)return;let n=0;for(const q of peds)if(q.bark&&++n>=4)return;const L=BARKS[ev];p.bark={s:L[Math.floor(rand()*L.length)],c:col||'#fff',t:2}}
// A crime near civilians: up to 2 witnesses within 320 pull out a phone and call in 3 s, if they are still standing and the player is within 450.
function crime(x,y,sev){
  let n=peds.reduce((k,q)=>k+(q.calling>0?1:0),0);
  for(const p of peds){
    if(n>=2)break;
    if(p.gang||p.guard||p.cop||p.down||p.flee>0||p.calling>0||p.hands>0||Math.hypot(p.x-x,p.y-y)>=320)continue;
    p.calling=3;p.callSev=sev;p.bark=null;bark(p,'call','#ff4b4b');n++;
  }
}
// Hold Q on a gun, or any gun other than the pistol, to rob instead of talk.
const robbing=p=>!WEAPONS[WI[weap]].throw&&(weap!=='pistol'||qLock===p);
function talkTarget(){
  if(DOORS.some(d=>Math.hypot(d.x-me.x,d.y-me.y)<18))return null;
  let best=null,bd=26;for(const p of peds){if(p.gang||p.guard||p.cop||p.down)continue;const d=Math.hypot(p.x-me.x,p.y-me.y);if(d<bd){bd=d;best=p}}
  return best;
}
function talkPed(){
  const p=talkTarget();if(!p)return false;
  p.a=Math.atan2(me.y-p.y,me.x-p.x);p.bark=null;
  if(robbing(p)&&!p.robbed){p.robbed=true;p.hands=1.5;p.vx=p.vy=0;pickups.push({x:p.x,y:p.y,amt:Math.floor(rr(20,120)),t:25});crime(p.x,p.y,.5);return true}
  p.stopT=2;bark(p,'greet');return true;
}
let shotNow=false,pedShotT=-9,crimeT=-9;
function pedsStep(dt){
  shotNow=lastFireT!==pedShotT;
  if(shotNow){pedShotT=lastFireT;if(time-crimeT>3){crimeT=time;crime(me.x,me.y,.25)}for(const q of peds)if(!q.gang&&!q.guard&&!q.cop&&!q.down&&Math.hypot(q.x-me.x,q.y-me.y)<250)bark(q,'gun')}
  for(let i=peds.length-1;i>=0;i--){
    const p=peds[i];
    if(p.cop)continue;
    if(p.guard){if(p.down){p.down-=dt;if(p.down<=0)peds.splice(i,1)}else guardStep(p,dt);continue}
    if(p.gang){if(p.down){p.down-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.02,dt);p.vy*=Math.pow(.02,dt);if(p.down<=0)peds.splice(i,1)}else if(!p.msG&&Math.hypot(p.x-A.x,p.y-A.y)>1800)peds.splice(i,1);else gangStep(p,dt);continue} // mission guards are never culled by distance
    if(pedStep(p,dt))peds.splice(i,1);
  }
}
// Civilians. Returns true when the ped should be removed.
function pedStep(p,dt){
  if(p.cop)return false;
  if(inAF(p.x,p.y))return true; // civilians get in through the gate; they are removed, and the city spawns new ones outside
  if(p.bark&&(p.bark.t-=dt)<=0)p.bark=null;
  if(p.down){
    p.calling=0;p.down-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.02,dt);p.vy*=Math.pow(.02,dt);collide(p,p.x,p.y,6);
    if(p.down<=0&&p.vendor){p.down=0;p.x=p.hx;p.y=p.hy;p.vx=p.vy=0;return false}
    return p.down<=0||Math.hypot(p.x-A.x,p.y-A.y)>1600;
  }
  if(p.vendor){if(p.crouch>0)p.crouch-=dt;if(p.hands>0)p.hands=Math.max(0,p.hands-dt);return false}
  const dme=Math.hypot(p.x-me.x,p.y-me.y),onFoot=state==='play'&&!me.car&&!me.heli&&!me.jet&&!me.inside;
  if(onFoot&&dme<14&&Math.hypot(me.vx,me.vy)>30){provoke(p);bark(p,'bump')}
  if(p.brave==='armed'){
    p.aim=qLock===p?(p.aim||0)+dt:0;
    if(!p.armed&&state==='play'&&((shotNow&&dme<250)||p.aim>=1.5)){p.armed=10;p.cd=0}
  }
  if(p.calling>0){
    p.calling-=dt;p.vx=p.vy=0;
    if(p.calling<=0){p.calling=0;if(dme<450){addHeat(p.callSev);feed('Someone called the cops')}}
    return Math.hypot(p.x-A.x,p.y-A.y)>1700;
  }
  if(p.hands>0){
    p.hands-=dt;p.vx=p.vy=0;
    if(p.hands<=0){p.hands=0;p.flee=4;p.fx=me.x;p.fy=me.y}
    return Math.hypot(p.x-A.x,p.y-A.y)>1700;
  }
  if(!(p.dodgeT>0))for(const c of cars){ // cars: near miss barks, and a car heading at the ped makes it side-step once
    const s=Math.hypot(c.vx,c.vy),dx=p.x-c.x,dy=p.y-c.y,d=Math.hypot(dx,dy);
    if(s>150&&d<30&&d>=16&&!p.bark)bark(p,'near');
    if(s>120&&d<70&&p.dodgeCar!==c&&Math.abs(wrap(Math.atan2(c.vy,c.vx)-Math.atan2(dy,dx)))<.4){
      p.dodgeCar=c;const sd=(dx*-c.vy+dy*c.vx)>=0?1:-1,k=110/s;p.dvx=-c.vy*k*sd;p.dvy=c.vx*k*sd;p.dodgeT=.4;break;
    }
  }
  if(p.dodgeT>0){p.dodgeT-=dt;p.x+=p.dvx*dt;p.y+=p.dvy*dt;collide(p,p.x,p.y,6);return Math.hypot(p.x-A.x,p.y-A.y)>1700}
  p.niceT=Math.max(0,(p.niceT||0)-dt);
  if(me.car&&(me.car.type==='sports'||me.car.type==='muscle')&&dme<40&&Math.hypot(me.car.vx,me.car.vy)<5&&!p.niceT){p.niceT=20;bark(p,'nice')}
  if(p.fight>0){ // fighter: walks at the player and punches every 0.9 s in reach, gives up after 12 s or past 300 units
    p.fight-=dt;const dx=me.x-p.x,dy=me.y-p.y,d=Math.hypot(dx,dy)||1;p.a=Math.atan2(dy,dx);
    if(d>300)p.fight=0;
    if(d>18){p.vx=dx/d*90;p.vy=dy/d*90}else{p.vx=p.vy=0;p.punchT-=dt;if(p.punchT<=0){p.punchT=.9;hurtMe(8)}}
    p.x+=p.vx*dt;p.y+=p.vy*dt;collide(p,p.x,p.y,6);return Math.hypot(p.x-A.x,p.y-A.y)>1700;
  }
  if(p.armed>0){ // armed: stands and shoots like a gang member, then runs
    p.armed-=dt;p.a=Math.atan2(me.y-p.y,me.x-p.x);p.vx=p.vy=0;p.cd-=dt;
    if(p.cd<=0&&dme<330){p.cd=rr(.7,1.4);const a=p.a+rr(-.12,.12);fire(p.x+Math.cos(a)*10,p.y+Math.sin(a)*10,a,'police',6)}
    if(p.armed<=0){p.armed=0;p.flee=4;p.fx=me.x;p.fy=me.y}
    return Math.hypot(p.x-A.x,p.y-A.y)>1700;
  }
  if(p.kind==='tourist'&&(p.tourT-=dt)<=0){ // stops, faces the nearest building, takes a photo
    p.tourT=rr(8,14);p.stopT=2;
    let bb=null,bd=1e9;for(const b of buildings){const d=Math.hypot(b.x+b.w/2-p.x,b.y+b.h/2-p.y);if(d<bd){bd=d;bb=b}}
    if(bb)p.a=Math.atan2(bb.y+bb.h/2-p.y,bb.x+bb.w/2-p.x);
    parts.push({x:p.x+Math.cos(p.a)*8,y:p.y+Math.sin(p.a)*8,vx:0,vy:0,life:.08,max:.08,col:'#ffffff',k:'flash',sz:14});
  }
  if(p.stopT>0&&p.flee<=0){p.stopT-=dt;p.vx=p.vy=0;return Math.hypot(p.x-A.x,p.y-A.y)>1700}
  if(p.kind==='chat'&&p.flee<=0){p.a=p.fa+Math.sin(time*.8+p.ph)*.12;p.vx=p.vy=0;collide(p,p.x,p.y,6);return Math.hypot(p.x-A.x,p.y-A.y)>1700}
  if(p.kind==='beach'&&p.flee<=0){
    if(p.walkTo){
      const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy);p.beachT-=dt;
      if(d<4||p.beachT<=0){p.walkTo=false;p.beachT=rr(5,12)}
      else{p.a=Math.atan2(dy,dx);p.vx=dx/d*40;p.vy=dy/d*40;p.ph+=dt*10;p.x+=p.vx*dt;p.y+=p.vy*dt;collide(p,p.x,p.y,6)}
    }else{
      p.vx=p.vy=0;
      if((p.beachT-=dt)<=0){if(rand()<.4){p.walkTo=true;p.lie=false;p.beachT=8;p.tx=p.x+rr(-90,90);p.ty=p.y+rr(-90,90)}else{p.lie=!p.lie;p.beachT=rr(6,14)}}
    }
    return Math.hypot(p.x-A.x,p.y-A.y)>1700;
  }
  let tx,ty,sp=p.spd;
  if(p.kind==='phone'&&p.flee<=0){ // walks at 60 percent, or stands still with a hand to the ear
    if((p.phT-=dt)<=0){p.still=!p.still;p.phT=rr(4,10)}
    if(p.still){p.vx=p.vy=0;return Math.hypot(p.x-A.x,p.y-A.y)>1700}
    sp*=.6;
  }
  if(p.flee>0){p.flee-=dt;const dx=p.x-p.fx,dy=p.y-p.fy,l=Math.hypot(dx,dy)||1;tx=p.x+dx/l*50;ty=p.y+dy/l*50;sp=105;if(p.flee<=0)setPedBlock(p)}
  else{const c=pedCorners(p)[p.ci];tx=c[0];ty=c[1];if(Math.hypot(tx-p.x,ty-p.y)<4){p.ci=(p.ci+p.dir+4)%4;if(rand()<.15){const nb=(p.ci===1||p.ci===2)?1:-1;p.bi=clamp(p.bi+(rand()<.5?nb:0),0,N-1)}}}
  const dx=tx-p.x,dy=ty-p.y,l=Math.hypot(dx,dy)||1,wob=p.kind==='drunk'?Math.sin(time*1.9+p.ph)*.5:0;
  p.vx=(dx-dy*wob)/l*sp;p.vy=(dy+dx*wob)/l*sp;p.a=Math.atan2(dy,dx);p.ph+=dt*sp*.25;
  p.x+=p.vx*dt;p.y+=p.vy*dt;collide(p,p.x,p.y,6);
  for(const c of cars){if(c.kind==='traffic'||c.kind==='mine')continue;const s=Math.hypot(c.vx,c.vy);if(s>70&&Math.hypot(c.x-p.x,c.y-p.y)<16)knockPed(p,c.vx,c.vy,false)}
  return Math.hypot(p.x-A.x,p.y-A.y)>1700;
}
if(DBG)Object.defineProperties(DBG,{pedKinds:{get:()=>{const o={};for(const p of peds)if(!p.gang&&!p.guard&&!p.cop)o[p.kind]=(o[p.kind]||0)+1;return o}},crime:{get:()=>crime}});

// ---------- Rustwater Vipers (docks gang) ----------
const GANGHQ={x:1*B+60,y:3*B+60};let gangT=0;
const KINGSHQ={x:6*B+60,y:5*B+60};
const TURFS=[{g:'Vipers',bi:[0,1],bj:[0,8],shirts:['#2f8a3a','#1f5a2a']},{g:'Kings',bi:[6,9],bj:[4,8],shirts:['#7b3fb8','#5a2a8a']}];
function gangPop(dt){gangT-=dt;if(gangT>0)return;gangT=1.5;if(me.inside)return;
  for(const T of TURFS){const x0=T.bi[0]*B+R,x1=(T.bi[1]+1)*B,y0=T.bj[0]*B+R,y1=(T.bj[1]+1)*B,ddx=Math.max(x0-A.x,0,A.x-x1),ddy=Math.max(y0-A.y,0,A.y-y1);if(Math.hypot(ddx,ddy)>700)continue;
    let n=0;for(const p of peds)if(p.gang&&!p.down&&(p.gname||'Vipers')===T.g)n++;if(n>=10)continue;
    for(let tries=0;tries<8;tries++){const bi=T.bi[0]+Math.floor(rand()*(T.bi[1]-T.bi[0]+1)),bj=T.bj[0]+Math.floor(rand()*(T.bj[1]-T.bj[0]+1)),bx=bi*B+R,by=bj*B+R,sz=B-R;if(T.g==='Kings'&&district(bi,bj)!=='hood')continue;
      const pts=[[bx+7,by+sz/2],[bx+sz-7,by+sz/2],[bx+sz/2,by+7],[bx+sz/2,by+sz-7]],[cx,cy]=pts[Math.floor(rand()*4)],dd=Math.hypot(cx-A.x,cy-A.y);if(dd<450||dd>1500)continue;
      const k=2+Math.floor(rand()*3);for(let i=0;i<k;i++){const x=cx+rr(-14,14),y=cy+rr(-14,14);
        peds.push({x,y,vx:0,vy:0,a:rand()*TAU,spd:0,flee:0,fx:0,fy:0,down:0,skin:PEDCOL[Math.floor(rand()*5)],shirt:T.shirts[Math.floor(rand()*2)],ci:0,dir:1,ph:rand()*TAU,gang:true,gname:T.g,hx:x,hy:y,cd:rr(.6,1.5),aggro:false})}
      break}}}
function gangStep(p,dt){
  const dx=me.x-p.x,dy=me.y-p.y,d=Math.hypot(dx,dy),targetable=state==='play'&&!me.inside&&!me.heli&&!me.jet&&(me.z||0)<5;
  if(targetable&&!p.aggro&&d<240){p.aggro=true;if(!p.yelled){p.yelled=true;feed(p.gname==='Kings'?'The Low Palms Kings spotted you!':'The Vipers spotted you!')}}
  if(p.aggro&&(!targetable||d>950)){p.aggro=false;p.alerted=false}
  let tx=0,ty=0,sp=0;
  if(p.aggro){p.a=Math.atan2(dy,dx);const want=d>120?1:d<70?-1:0,side=Math.sin(time*1.3+p.hx)*.7;tx=Math.cos(p.a)*want-Math.sin(p.a)*side;ty=Math.sin(p.a)*want+Math.cos(p.a)*side;sp=125;
    p.cd-=dt;if(p.cd<=0&&d<330){p.cd=rr(.7,1.4);const a=p.a+rr(-.12,.12);fire(p.x+Math.cos(a)*10,p.y+Math.sin(a)*10,a,'police',me.car?BAL.npc.gangCar:BAL.npc.gang)}
    if(!p.alerted){p.alerted=true;for(const q of peds)if(q.gang&&!q.down&&!q.aggro&&Math.hypot(q.x-p.x,q.y-p.y)<320)q.aggro=true}}
  else{const hx=p.hx-p.x,hy=p.hy-p.y,hd=Math.hypot(hx,hy);if(hd>16){tx=hx/hd;ty=hy/hd;sp=60}else p.a+=Math.sin(time*.7+p.hx)*dt*.6}
  const l=Math.hypot(tx,ty);if(l>.01&&sp){const k=Math.min(1,l)/l;p.vx=tx*k*sp;p.vy=ty*k*sp;if(!p.aggro)p.a=Math.atan2(p.vy,p.vx)}else{p.vx=p.vy=0}
  p.x+=p.vx*dt;p.y+=p.vy*dt;collide(p,p.x,p.y,6);p.ph+=dt*Math.hypot(p.vx,p.vy)*.25;
}

// ---------- fx ----------
// exhaust puff behind a moving car: at most 20 live puffs (tagged exh in the shared parts list)
function exhaust(c,dt){if(rand()>=dt*4)return;let n=0;for(const p of parts)if(p.exh)n++;if(n>=20)return;const L=ctOf(c).len/2;parts.push({x:c.x-Math.cos(c.a)*L,y:c.y-Math.sin(c.a)*L,z0:(c.z||0)+4,vx:rr(-6,6),vy:rr(-6,6),life:1.1,max:1.1,col:'rgba(120,115,130,1)',k:'smoke',sz:6,exh:1})}
function burst(x,y,n,col,spd,life,kind){for(let i=0;i<n;i++){const a=rand()*TAU,s=rand()*spd;parts.push({x,y,z0:burstZ,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:life*(.5+rand()*.5),max:life,col,k:kind||'spark',sz:kind==='smoke'?rr(6,12):2})}}
const glowCache={};
function glow(col){if(glowCache[col])return glowCache[col];const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,col);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);return glowCache[col]=c}
const cone=(()=>{const c=document.createElement('canvas');c.width=180;c.height=110;const g=c.getContext('2d'),gr=g.createRadialGradient(0,55,0,0,55,180);gr.addColorStop(0,'rgba(255,240,200,.55)');gr.addColorStop(1,'rgba(255,240,200,0)');g.fillStyle=gr;g.beginPath();g.moveTo(0,48);g.lineTo(180,0);g.lineTo(180,110);g.lineTo(0,62);g.closePath();g.fill();return c})();

