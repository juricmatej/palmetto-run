
(()=>{
'use strict';
if(!window.THREE){document.getElementById('net').textContent='The 3D engine did not load. Reload the page to try again.';return}
const cv=document.getElementById('game');
const mm=document.getElementById('mini'),mctx=mm.getContext('2d');
const $=id=>document.getElementById(id);
let VW=0,VH=0,DPR=1;
function resize(){DPR=Math.min(window.devicePixelRatio||1,2);VW=innerWidth;VH=innerHeight;cv.width=Math.round(VW*DPR);cv.height=Math.round(VH*DPR)}
addEventListener('resize',resize);resize();
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
// ?debug: scripts/smoke.mjs --eval reads window.__pr. Each section adds its own getters with if(DBG)Object.defineProperties(DBG,{...}).
const DBG=/[?&]debug\b/.test(location.search)?(window.__pr={}):null;

// ---------- world ----------
const B=440,R=120,N=10,W=N*B+R,SW=14,TAU=Math.PI*2;
let rand=Math.random,rr=(a,b)=>a+rand()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=a=>{while(a>Math.PI)a-=TAU;while(a<-Math.PI)a+=TAU;return a};
function seeded(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function shade(hex,f){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;if(f<1){r*=f;g*=f;b*=f}else{const t=f-1;r+=(255-r)*t;g+=(255-g)*t;b+=(255-b)*t}return`rgb(${r|0},${g|0},${b|0})`}
const ROOFS=[['#2b2350','#ff3ea5'],['#1d3a4a','#29e6d6'],['#3a2a1e','#ffc94a'],['#24263f','#8b7bff'],['#33203a','#ff7ad9'],['#1e3530','#5dffa8']];
const CARCOL=['#e8e4f0','#ff3ea5','#29e6d6','#ffc94a','#ff6b3d','#7b6bff','#3dd68c','#9d97ad','#d23c5a','#4aa3ff'];
// ---------- balance ----------
// Every damage and health number lives here. Code reads these values; change them here only.
const BAL={
  playerHp:100,heliHp:650,jetHp:520,
  vehHp:{sedan:140,taxi:140,sports:110,muscle:160,pickup:180,suv:200,van:220,police:180,armored:700},
  wdmg:{pistol:15,smg:9.1,shotgun:9,mg:10,sniper:100},shotPellets:6,
  exp:{player:[100,120],veh:[260,120],air:[220,110],ped:95,self:.6,occupant:.35,sticky:1.5},
  bulletVeh:.6,bulletAir:.3,crashMax:45,shove:18,heliWallK:.06,jetLandK:.8,heliRocketK:.7,jetMissileK:.85,
  npc:{gang:7,gangCar:5,police:6,bank:7},
  remote:{occ:.4,car:1.2,arm:.6,air:.5}
};
const fall=(d,[peak,rad])=>Math.max(0,peak*(1-d/rad));
function balanceTable(){
  const up=(hp,per)=>Math.ceil(hp/per),T={};
  for(const w in BAL.wdmg){const n=w==='shotgun'?BAL.shotPellets:1;
    T['player '+w]=up(BAL.playerHp,BAL.wdmg[w]*n);
    T['sedan '+w]=up(BAL.vehHp.sedan,BAL.wdmg[w]*BAL.bulletVeh*n)}
  for(const t in BAL.vehHp)T['rpg '+t]=up(BAL.vehHp[t],fall(0,BAL.exp.veh));
  T['rpg heli']=up(BAL.heliHp,fall(0,BAL.exp.air));
  T['rpg jet']=up(BAL.jetHp,fall(0,BAL.exp.air));
  T['sticky armored']=up(BAL.vehHp.armored,fall(0,BAL.exp.veh)*BAL.exp.sticky);
  return T;
}
if(DBG)Object.defineProperties(DBG,{BAL:{get:()=>BAL},balanceTable:{get:()=>balanceTable}});
if(DBG)Object.defineProperties(DBG,{explode:{get:()=>explode}});
const CT={
  sedan:{name:'Sedan',len:44,wid:22,h:8,max:340,acc:330,grip:7.5,hp:BAL.vehHp.sedan,w:30},
  sports:{name:'Sports car',len:46,wid:21,h:6,max:440,acc:490,grip:9.5,hp:BAL.vehHp.sports,w:12},
  muscle:{name:'Muscle car',len:48,wid:23,h:8,max:400,acc:440,grip:5.5,hp:BAL.vehHp.muscle,w:12},
  suv:{name:'SUV',len:48,wid:25,h:12,max:300,acc:290,grip:7,hp:BAL.vehHp.suv,w:14},
  van:{name:'Van',len:54,wid:25,h:18,max:250,acc:230,grip:6.5,hp:BAL.vehHp.van,w:8},
  taxi:{name:'Taxi',len:44,wid:22,h:8,max:330,acc:320,grip:7.5,hp:BAL.vehHp.taxi,w:10,color:'#ffc94a'},
  pickup:{name:'Pickup',len:50,wid:24,h:10,max:310,acc:300,grip:6.5,hp:BAL.vehHp.pickup,w:12},
  armored:{name:'Armored truck',len:52,wid:26,h:14,max:290,acc:300,grip:7.5,hp:BAL.vehHp.armored,w:0,color:'#4a5a4c'},
  police:{name:'Police cruiser',len:46,wid:22,h:8,max:330,acc:360,grip:8,hp:BAL.vehHp.police,w:0},
};
const CTKEYS=Object.keys(CT).filter(k=>CT[k].w>0);
const hasCT=k=>typeof k==='string'&&Object.prototype.hasOwnProperty.call(CT,k);
function pickType(){let t=rand()*CTKEYS.reduce((a,k)=>a+CT[k].w,0);for(const k of CTKEYS){t-=CT[k].w;if(t<=0)return k}return'sedan'}
const ctOf=c=>CT[c.type]||CT.sedan;
const PEDCOL=['#c98b6b','#8d5a3b','#e0b48f','#6b4630','#f1c9a5'];
const SHIRT=['#3dd68c','#ff6b3d','#4aa3ff','#ffc94a','#c9c3d6','#ff7ad9','#29e6d6','#2b2f44','#e8e2d8'];

const barrels=[],courts=[];
const cells=[],buildings=[],parks=[],lots=[],blockType=[],palms=[],umbrellas=[],pools=[],cranes=[];
const PASTEL=['#e8b4c8','#b4d8e8','#f1e3a8','#c8e8b4','#e8c8a8','#d0c4f0'];
const CONT=['#b8432f','#2f6fb8','#d68a2f','#3d8a52','#7b6bff','#9d97ad'];
function district(bi,bj){if(bj===N-1)return'beach';if(bi<=1)return'industrial';if(bi>=8&&bj<=5)return'airport';if(bi>=6&&bj<=3)return'suburb';if(bi>=6&&bj>=4)return'hood';if((bi===3||bi===4)&&bj<=1)return'park';if(bi>=2&&bi<=5&&bj>=2&&bj<=5)return'downtown';return'midtown'}
// The airfield: blocks 8 and 9 by rows 0 to 5, behind a fence. Roads and lanes are the grid; a lane whose box touches the airfield is shut (afShut), so no traffic or parked car uses it.
const AF={x0:8*B+R,x1:10*B,y0:R,y1:6*B},DX=[1,0,-1,0],DY=[0,1,0,-1];
const inAF=(x,y)=>x>AF.x0&&x<AF.x1&&y>AF.y0&&y<AF.y1;
// lane from crossing (ax,ay) to (bx,by); crossings sit at index*B+60
function afShut(ax,ay,bx,by){const x1=ax*B+60,x2=bx*B+60,y1=ay*B+60,y2=by*B+60;return Math.max(x1,x2)>AF.x0&&Math.min(x1,x2)<AF.x1&&Math.max(y1,y2)>AF.y0&&Math.min(y1,y2)<AF.y1}
const AREA={hills:['Palmetto Hills','Mountain roads, the observatory and the sign'],airport:['Palmetto International','Fighter jets on the runway'],hood:['Low Palms','Kings territory. Watch your back'],beach:['Sunset Beach','Sand, surf and palm trees'],industrial:['Rustwater Docks','Viper gang territory. Watch your back'],suburb:['Palm Heights','Quiet streets, pools, lawns'],park:['Lagoon Park','Trees and the lagoon'],downtown:['Downtown Neon','Skyscrapers and nightlife'],midtown:['Midtown','Shops and apartments']};
// blocks owned by the landmarks section (see LANDMARKS): left empty here, built there
const LANDBLK={'2,4':'plaza','4,7':'skate','7,7':'pit','0,7':'marina','0,8':'marina'};
// ---------- city cuts ----------
// Planned corridors drawn over the grid: the diagonal Palmetto Boulevard from the canyon gate to the beach
// (and, from ticket 63, the docks canal). Buildings, props and park items keep clear of a cut; the grid
// roads tie into it at their crossings. Verified by scripts/clearance.mjs.
const CUTS=[{name:'Palmetto Boulevard',ax:1060,ay:60,bx:3150,by:4560,half:44,road:30}];
function cutD(c,x,y){const dx=c.bx-c.ax,dy=c.by-c.ay,t=clamp(((x-c.ax)*dx+(y-c.ay)*dy)/(dx*dx+dy*dy),0,1);
  return Math.hypot(x-(c.ax+dx*t),y-(c.ay+dy*t))}
function inCut(x,y,pad){for(const c of CUTS)if(cutD(c,x,y)<c.half+(pad||0))return true;return false}
function cutRect(x,y,w,h,pad){for(const c of CUTS){const hh=c.half+(pad||0);
  for(let a=0;a<=w;a+=15)for(let b=0;b<=h;b+=15)if(cutD(c,x+a,y+b)<hh)return true}
  return false}
// the docks canal (ticket 63): a channel from the open sea into the marina, cut through the quay blocks
const CANAL={x0:-60,x1:760,y0:3772,y1:3828,bridge:[440,560],depth:-9,water:-3};
const CANAL_HOLES=[[CANAL.x0,CANAL.bridge[0],CANAL.y0,CANAL.y1],[CANAL.bridge[1],CANAL.x1,CANAL.y0,CANAL.y1]];
if(DBG)Object.defineProperties(DBG,{cuts:{get:()=>CUTS.map(c=>c.name)},canal:{get:()=>CANAL},cutDist:{get:()=>cutD}});
{const r=seeded(4242);
 const mk=(list,o)=>{const[roof,trim]=o.pal||ROOFS[Math.floor(r()*ROOFS.length)];const b=Object.assign({roof,trim,vent:null,sign:false,ladder:null},o);b.sides=[shade(b.roof,.55),shade(b.roof,.8),shade(b.roof,.45),shade(b.roof,.7)];if(!cutRect(b.x,b.y,b.w,b.h,8)){list.push(b);buildings.push(b)}return b};
 for(let bj=0;bj<N;bj++)for(let bi=0;bi<N;bi++){
  const x0=bi*B+R,y0=bj*B+R,s=B-R,list=[];cells.push(list);const dist=district(bi,bj);
  if(LANDBLK[bi+','+bj]){blockType.push(LANDBLK[bi+','+bj]);continue}
  if(dist==='park'){blockType.push('park');const trees=[];
    if(bi===4&&bj===0){mk(list,{x:x0+50,y:y0+50,w:s-100,h:s-100,H:.6,kind:'water',pal:['#1d6a8a','#29e6d6']});for(let i=0;i<16;i++){const a=i/16*TAU;trees.push([x0+s/2+Math.cos(a)*(s/2-24),y0+s/2+Math.sin(a)*(s/2-24),10+r()*8])}}
    else for(let i=0;i<22;i++)trees.push([x0+28+r()*(s-56),y0+28+r()*(s-56),10+r()*10]);
    parks.push({x:x0,y:y0,s,trees});continue}
  if(dist==='beach'){blockType.push('beach');
    for(let i=0;i<7;i++)palms.push([x0+30+r()*(s-60),y0+30+r()*(s-60),r()*TAU]);
    for(let i=0;i<5;i++)umbrellas.push([x0+30+r()*(s-60),y0+90+r()*(s-120),['#ff3ea5','#29e6d6','#ffc94a','#ff6b3d'][Math.floor(r()*4)]]);
    if(r()<.6)mk(list,{x:x0+s/2-34,y:y0+30,w:68,h:44,H:24,kind:'shack',pal:[PASTEL[Math.floor(r()*PASTEL.length)],'#ff3ea5']});
    continue}
  if(dist==='suburb'){blockType.push('suburb');
    for(const[qx,qy]of[[0,0],[1,0],[0,1],[1,1]]){const hw=Math.round(70+r()*16),hh=Math.round(58+r()*12),cx=x0+s*(qx?.72:.28),cy=y0+s*(qy?.7:.3);
      mk(list,{x:cx-hw/2,y:cy-hh/2,w:hw,h:hh,H:22,kind:'house',pal:[PASTEL[Math.floor(r()*PASTEL.length)],['#7a2f3a','#3a3f5a','#5a4a3a'][Math.floor(r()*3)]]});
      if(r()<.5)pools.push({x:cx-22,y:qy?cy-hh/2-30:cy+hh/2+10,w:44,h:20});
      if(r()<.6)palms.push([cx+(qx?-1:1)*(hw/2+16),cy,r()*TAU])}
    continue}
  if(dist==='industrial'){blockType.push('industrial');
    const wh=mk(list,{x:x0+24,y:y0+24,w:s-48,h:Math.round(s*.42),H:34+Math.round(r()*16),kind:'warehouse',pal:[['#5a4a3e','#6a5a4a','#4a5058','#5e3a32'][Math.floor(r()*4)],'#ffc94a']});
    if(r()<.8)wh.ladder=1;
    for(let i=0;i<6;i++){if(r()<.25)continue;const cx=x0+28+(i%3)*92,cy=y0+Math.round(s*.56)+Math.floor(i/3)*56;mk(list,{x:cx,y:cy,w:62,h:22,H:r()<.4?48:24,kind:'container',pal:[CONT[Math.floor(r()*CONT.length)],'#000000']})}
    if(r()<.55)cranes.push([x0+s-34,y0+s*.5]);
    continue}
  if(bi===3&&bj===4){blockType.push('city');mk(list,{x:x0+34,y:y0+40,w:s-68,h:s-74,H:760,kind:'bank',pal:['#3a3220','#ffc94a']});continue}
  if(dist==='airport'){blockType.push('airport');
    r();r(); // the old airport drew two random numbers here; keep them so the rest of the city does not move. Its buildings are placed after the loop
    continue}
  if(dist==='hood'){blockType.push('hood');
    if(bi===7&&bj===5){courts.push([x0,y0,s]);for(let i=0;i<5;i++)barrels.push([x0+24+r()*(s-48),y0+s-30-r()*30]);continue}
    const m=26,ix=x0+m,iy=y0+m,is=s-2*m,g=18;
    for(const[fx,fy]of[[0,0],[.5,0],[0,.5],[.5,.5]]){if(r()<.22)continue;const x=ix+fx*is+(fx>0?g/2:0),y=iy+fy*is+(fy>0?g/2:0),w=is*.5-g/2,h=is*.5-g/2;
      const b=mk(list,{x,y,w,h,H:Math.round(34+r()*40),kind:'brick',pal:[['#7a3e30','#5a3328','#6a4a3a','#4a3a3a'][Math.floor(r()*4)],'#ffb86b'],graffiti:r()<.65?Math.floor(r()*3):-1});
      if(Math.abs(y+h-(y0+s-m))<1&&r()<.5)b.ladder=1}
    barrels.push([x0+s/2+r()*10-5,y0+s/2+r()*10-5],[x0+16,y0+16+r()*(s-32)]);
    continue}
  if(dist==='midtown'&&r()<.16){lots.push({x:x0,y:y0,s});blockType.push('lot');continue}
  blockType.push('city');
  const tall=dist==='downtown',m=22,ix=x0+m,iy=y0+m,is=s-2*m,g=12;
  // The skyline is planned, not random: heights rise along the downtown ridge (the diagonal from block
  // (2,2) to (5,5)) and four fixed blocks carry signature towers with a lit crown and an antenna.
  const SIG={'2,3':260,'5,4':240,'2,5':220,'5,1':200},sig=SIG[bi+','+bj];
  if(sig){const w=Math.round(is*.62),h=Math.round(is*.62);
    mk(list,{x:ix+(is-w)/2,y:iy+(is-h)/2,w,h,H:sig,kind:'glass',vent:null,sign:false,sig:1});
  }else{
  const ridge=1-clamp(Math.abs(bi-bj)/3,0,1),lay=Math.floor(r()*4);
  const L=lay===0?[[0,0,1,1]]:lay===1?[[0,0,.5,1],[.5,0,.5,1]]:lay===2?[[0,0,1,.5],[0,.5,1,.5]]:[[0,0,.5,.5],[.5,0,.5,.5],[0,.5,.5,.5],[.5,.5,.5,.5]];
  for(const[fx,fy,fw,fh]of L){
    const x=ix+fx*is+(fx>0?g/2:0),y=iy+fy*is+(fy>0?g/2:0);
    const w=fw*is-(fx>0?g/2:0)-(fx+fw<1?g/2:0),h=fh*is-(fy>0?g/2:0)-(fy+fh<1?g/2:0);
    const H=Math.round(tall?(80+r()*140)*(tall?(.7+.5*ridge):1):(44+r()*80));
    const b=mk(list,{x,y,w,h,H,kind:tall?'glass':'tower',vent:r()<.7?[r()*.5+.1,r()*.5+.1]:null,sign:r()<.25});
    if(Math.abs(y+h-(y0+s-22))<1&&r()<(tall?.4:.55))b.ladder=1;
  }}
 }
 // the corridors clear loose props too: trees, palms, umbrellas, barrels, pools, courts, cranes and lots
  for(const p of parks)p.trees=p.trees.filter(t=>!inCut(t[0],t[1],6));
  for(const L of[palms,umbrellas,barrels,courts,cranes,lots])for(let i=L.length-1;i>=0;i--){const q=L[i];if(inCut(q[0]||q.x,q[1]||q.y,6))L.splice(i,1)}
  // airfield: buildings, then the fence. A piece goes in the cell nearB reads for it (floor of its min x and y over B), so each piece is at most 400 long
 const afMk=(x,y,w,h,H,kind,pal)=>mk(cells[Math.min(N-1,Math.floor(y/B))*N+Math.min(N-1,Math.floor(x/B))],{x,y,w,h,H,kind,pal});
 const fenceRuns=(a,b)=>{const n=Math.ceil((b-a)/400),st=(b-a)/n;return Array.from({length:n},(_,i)=>[a+st*i,a+st*(i+1)])};
 afMk(3780,1230,110,300,30,'glass',['#33405a','#ffc94a']); // terminal: door on the west face, onto the car park
 afMk(3650,1090,40,40,150,'ctower',['#4a4f5c','#ff3ea5']); // control tower at the north end of the car park, drawn with the airfield
 afMk(4100,2330,80,90,26,'warehouse',['#5a6070','#ffc94a']); // hangars: doors on the apron
 afMk(4334,2330,56,90,26,'warehouse',['#5a6070','#ffc94a']);
 const FP=['#5a6270','#5a6270'];
 for(const[a,b]of[...fenceRuns(AF.y0,1320),...fenceRuns(1440,AF.y1)])afMk(AF.x0-3,a,6,b-a,12,'fence',FP); // west side, gate at 1320 to 1440 (road 3)
 for(const[a,b]of fenceRuns(AF.y0,AF.y1))afMk(AF.x1-3,a,6,b-a,12,'fence',FP);
 for(const[a,b]of fenceRuns(AF.x0,AF.x1)){afMk(a,AF.y0-3,b-a,6,12,'fence',FP);afMk(a,AF.y1-3,b-a,6,12,'fence',FP)}
}
const ladders=buildings.filter(b=>b.ladder).map(b=>{const x=b.x+Math.min(30,b.w*.3);b.ladder={x,base:b.y+b.h+8,top:b.y+b.h-8};return b});
function nearB(x,y,fn){const bi=Math.floor(x/B),bj=Math.floor(y/B);for(let j=bj-1;j<=bj;j++)for(let i=bi-1;i<=bi;i++){if(i<0||j<0||i>=N||j>=N)continue;for(const b of cells[j*N+i])fn(b)}}
function solidAt(x,y,z){if(x>W+300)return inBuilding(x,y);let hit=false;nearB(x,y,b=>{if(x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h&&z<(b.H||999))hit=true});if(y<0)for(const b of hillSolids)if(x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h&&z<b.H)hit=true;return hit}
function inBuilding(x,y){if(x>W+300){for(const b of iwalls)if(x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h)return true;return false}let hit=false;nearB(x,y,b=>{if(x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h)hit=true});return hit}
// circle o(x,y) radius r vs buildings + world bounds; moves `body`, returns impact speed
function collide(body,px,py,r){
  let imp=0;
  // step-up limit: ground more than `lim` above the body's feet is a wall. Push back down the slope and report the speed.
  const car=body.type!==undefined,fz=body===me?me.z:car?(body.air?NaN:body.z):body.gz,lim=body===me?(inAir()?12:8):car?12:8;
  // A heightmap cell reads a cliff as a steep slope, so a rise of more than the limit across one cell ahead counts as a wall.
  const vl=Math.hypot(body.vx||0,body.vy||0);
  if(Number.isFinite(fz)&&vl>1e-3){
    const fx=body.vx/vl,fy=body.vy/vl,high=(x,y)=>groundZ(x,y)-fz>lim||groundZ(x+fx*10,y+fy*10)-groundZ(x,y)>lim;
    if(high(px,py)){
      let k=0;while(k<60&&high(px-fx*k,py-fy*k))k+=.5;
      const dx=-fx*k,dy=-fy*k;body.x+=dx;body.y+=dy;px+=dx;py+=dy;
      const vu=body.vx*fx+body.vy*fy;if(vu>0){imp=vu;body.vx-=vu*fx;body.vy-=vu*fy}
    }
  }
  const hit=b=>{
    if(body===me&&me.z>9&&(b.H<14||me.z>b.H+(b.kind==='house'?16:1.6)))return;
    if(car&&body.air&&(body.z||0)>(b.H||0)+4)return;
    const cx=clamp(px,b.x,b.x+b.w),cy=clamp(py,b.y,b.y+b.h);let dx=px-cx,dy=py-cy,d2=dx*dx+dy*dy;
    if(d2>=r*r)return;let nx,ny,pen;
    if(d2<1e-6){const l=px-b.x,rt=b.x+b.w-px,t=py-b.y,bt=b.y+b.h-py,m=Math.min(l,rt,t,bt);
      if(m===l){nx=-1;ny=0}else if(m===rt){nx=1;ny=0}else if(m===t){nx=0;ny=-1}else{nx=0;ny=1}pen=m+r}
    else{const d=Math.sqrt(d2);nx=dx/d;ny=dy/d;pen=r-d}
    body.x+=nx*pen;body.y+=ny*pen;px+=nx*pen;py+=ny*pen;
    if(body.vx!==undefined){const vn=body.vx*nx+body.vy*ny;if(vn<0){body.vx-=1.3*vn*nx;body.vy-=1.3*vn*ny;imp=Math.max(imp,-vn)}}
  };
  if(px>W+300){for(const b of iwalls)hit(b);return imp}
  nearB(px,py,hit);if(py<0)for(const b of hillSolids)hit(b);
  const lo=-30+r,hi=W+30-r;
  if(px<lo){body.x+=lo-px;if(body.vx<0){imp=Math.max(imp,-body.vx);body.vx*=-.3}}
  if(px>hi){body.x+=hi-px;if(body.vx>0){imp=Math.max(imp,body.vx);body.vx*=-.3}}
  const ny=HILL.edge+r;if(py<ny){body.y+=ny-py;if(body.vy<0){imp=Math.max(imp,-body.vy);body.vy*=-.3}if(body===me||body===me.car)northWall()}
  const hy=W+260-r;if(py>hy){body.y+=hy-py;if(body.vy>0){imp=Math.max(imp,body.vy);body.vy*=-.3}}
  if(!car&&body!==me)body.gz=groundZ(body.x,body.y); // peds keep the ground under their feet for the step rule
  return imp;
}
function sidewalkPoint(){const bi=Math.floor(rand()*N),bj=Math.floor(rand()*N),x0=bi*B+R+7,y0=bj*B+R+7,x1=(bi+1)*B-7,y1=(bj+1)*B-7,t=rand(),s=Math.floor(rand()*4);
  if(blockType[bj*N+bi]==='airport')return sidewalkPoint(); // no sidewalk in the airfield
  return s===0?[x0+(x1-x0)*t,y0]:s===1?[x1,y0+(y1-y0)*t]:s===2?[x0+(x1-x0)*t,y1]:[x0,y0+(y1-y0)*t]}
function pointAway(min,max){for(let i=0;i<40;i++){const p=sidewalkPoint(),d=Math.hypot(p[0]-A.x,p[1]-A.y);if(d>=min&&d<=max)return p}return sidewalkPoint()}

// ---------- terrain ----------
// One heightmap for the whole world, filled once here and read by everything: cars, peds, bullets,
// aircraft, camera and meshes. The north half (y<0) stays flat at 0; ticket 20 fills it with hills.
const HM={x0:-400,y0:-2600,x1:W+400,y1:W+400,cell:10};
HM.gw=Math.ceil((HM.x1-HM.x0)/HM.cell);HM.gh=Math.ceil((HM.y1-HM.y0)/HM.cell);HM.a=new Float32Array(HM.gw*HM.gh);
const TERRAIN=[],RAMPS=[];
function shapeHz(px,py,s){const dx=px-s.x,dy=py-s.y;
  if(s.kind==='mound'){const d=Math.hypot(dx,dy);return d>=s.r?null:s.h*(1+Math.cos(d/s.r*Math.PI))*.5}
  if(s.kind==='ramp'){const ca=Math.cos(s.a),sa=Math.sin(s.a),fw=dx*ca+dy*sa;return fw<0||fw>s.len||Math.abs(-dx*sa+dy*ca)>s.w/2?null:s.h*fw/s.len}
  if(s.kind==='plateau'){const m=Math.max(Math.abs(dx)-(s.w/2-s.slope),Math.abs(dy)-(s.d/2-s.slope));return m>=s.slope?null:m<=0?s.h:s.h*(1-m/s.slope)}
  if(s.kind==='channel'){return Math.abs(dx)>=s.w||Math.abs(dy)>=s.d?null:s.depth}
  if(s.kind==='bowl'){const d=Math.hypot(dx,dy);return d>=s.r?null:s.depth*(1+Math.cos(d/s.r*Math.PI))*.5}
  return null}
function addShape(s){TERRAIN.push(s);if(s.kind==='ramp')RAMPS.push(s);
  let bb;
  if(s.kind==='mound'||s.kind==='bowl')bb=[s.x-s.r,s.y-s.r,s.x+s.r,s.y+s.r];
  else if(s.kind==='plateau')bb=[s.x-s.w/2-s.slope,s.y-s.d/2-s.slope,s.x+s.w/2+s.slope,s.y+s.d/2+s.slope];
  else if(s.kind==='channel')bb=[s.x-s.w,s.y-s.d,s.x+s.w,s.y+s.d];
  else{const c=Math.cos(s.a),n=Math.sin(s.a),lx=-n*s.w/2,ly=c*s.w/2,ax=s.x+c*s.len,ay=s.y+n*s.len,
    x0=Math.min(s.x-lx,s.x+lx,ax-lx,ax+lx),y0=Math.min(s.y-ly,s.y+ly,ay-ly,ay+ly);bb=[x0,y0,s.x+ax-x0,s.y+ay-y0]}
  const gw=HM.gw,i0=Math.max(0,(Math.floor((bb[0]-HM.x0)/HM.cell))-1),j0=Math.max(0,(Math.floor((bb[1]-HM.y0)/HM.cell))-1),
    i1=Math.min(HM.gw-1,Math.ceil((bb[2]-HM.x0)/HM.cell)+1),j1=Math.min(HM.gh-1,Math.ceil((bb[3]-HM.y0)/HM.cell)+1),sunken=s.kind==='bowl';
  s.box=[i0,j0,i1,j1];
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const h=shapeHz(HM.x0+i*HM.cell,HM.y0+j*HM.cell,s);if(h===null)continue;
    const k=j*gw+i;HM.a[k]=s.kind==='channel'?Math.min(HM.a[k],h):sunken?HM.a[k]-h:Math.max(HM.a[k],h)}} // a bowl digs into the ground under it and a channel cuts through anything laid first
function groundZ(x,y){if(x>W+300)return 0;const gx=(x-HM.x0)/HM.cell,gy=(y-HM.y0)/HM.cell;if(gx<0||gy<0||gx>=HM.gw-1||gy>=HM.gh-1)return 0;const ix=gx|0,iy=gy|0,fx=gx-ix,fy=gy-iy,g=HM.a,i=iy*HM.gw+ix;
  return g[i]*(1-fx)*(1-fy)+g[i+1]*fx*(1-fy)+g[i+HM.gw]*(1-fx)*fy+g[i+HM.gw+1]*fx*fy}
const GN=[0,0]; // shared result: read it at once, do not keep the reference
function groundN(x,y){GN[0]=(groundZ(x+2,y)-groundZ(x-2,y))/4;GN[1]=(groundZ(x,y+2)-groundZ(x,y-2))/4;return GN}
// boot self-check: a mound's centre reads at least its own height (max() only raises it)
function terrainCheck(){for(const s of TERRAIN)if(s.kind==='mound'&&groundZ(s.x,s.y)<s.h-.5)console.error(`terrain: mound at ${s.x},${s.y} reads ${groundZ(s.x,s.y).toFixed(1)}, want ${s.h}`)}
// content: Lagoon Park mounds and six stunt ramps. Ramps sit in the middle of a road (between the opposing lanes, which are 36 and 84 from the road edge) or in open ground, and each run-up stays clear of intersections.
const hillA={kind:'mound',x:3*B+R+160,y:R+160,r:150,h:52};addShape(hillA); // Lagoon Park, block (3,0)
const hillB={kind:'mound',x:1500,y:610,r:75,h:36};addShape(hillB); // block (3,1); the helipad circle (radius 70 at 1600,720) is 4 units clear
addShape({kind:'ramp',x:1250,y:2260,a:0,len:60,w:24,h:32}); // 0 long road east, run-up from x 1000
addShape({kind:'ramp',x:2260,y:2100,a:-Math.PI/2,len:60,w:24,h:32}); // 1 long road north, run-up from y 2350
addShape({kind:'ramp',x:500,y:1500,a:Math.PI/2,len:60,w:24,h:32}); // 2 docks road, south
addShape({kind:'ramp',x:3360,y:2322,a:Math.PI/2,len:60,w:40,h:30}); // 3 hood, out of the block onto the basketball court
addShape({kind:'ramp',x:1240,y:4260,a:Math.PI,len:100,w:44,h:44}); // 4 beach row, west
addShape({kind:'ramp',x:4130,y:1100,a:-Math.PI/2,len:60,w:36,h:34}); // 5 airport apron, north
// landing zone: within 15 of the lip, or up to 60 past it and 15 wider than the ramp. Props stay out of it.
function rampZone(x,y){return RAMPS.some(r=>{const dx=x-r.x,dy=y-r.y,ca=Math.cos(r.a),sa=Math.sin(r.a),al=dx*ca+dy*sa-r.len,lat=-dx*sa+dy*ca,cl=clamp(lat,-r.w/2,r.w/2);return Math.hypot(al,lat-cl)<=15||(al>=0&&al<=60&&Math.abs(lat)<=r.w/2+15)})}
// park trees of blocks (3,0) and (3,1) move onto the mound flanks, 35 to 85 percent of the radius
for(const[pk,h]of[[parks.find(p=>p.x===3*B+R&&p.y===R),hillA],[parks.find(p=>p.x===3*B+R&&p.y===B+R),hillB]])if(pk)pk.trees.forEach((t,i)=>{const a=i*2.39996,f=.6+.3*((i*.618)%1);t[0]=h.x+Math.cos(a)*h.r*f;t[1]=h.y+Math.sin(a)*h.r*f});
// cells above 1 unit, for the minimap shading. Rebuild with rebuildRaised() if the heightmap changes.
const RAISED=[];function rebuildRaised(){RAISED.length=0;for(let k=0;k<HM.a.length;k++)if(HM.a[k]>1)RAISED.push(k)}rebuildRaised();
if(DBG)Object.defineProperties(DBG,{groundZ:{get:()=>groundZ},ramps:{get:()=>RAMPS},terrain:{get:()=>TERRAIN.length},air:{get:()=>me.car?Math.max(0,me.car.z-groundZ(me.car.x,me.car.y)):0}});

// ---------- hills ----------
// Palmetto Hills: the land north of the city, from y=0 down to the north edge at y=-2400. Its heights go into the same heightmap.
const HILL={edge:-2400,flatY:-40,peaks:[{x:W*.62,y:-1900,h:460,r0:120},{x:W*.2,y:-1700,h:330,r0:100}]};
const HVAL=(()=>{const r=seeded(20),t=new Float32Array(65536);for(let i=0;i<t.length;i++)t[i]=r();return t})();
// value noise, 0 to 1, lattice of 1 unit
function vnoise(x,y){const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),v=(a,b)=>HVAL[((a&255)<<8)|(b&255)];
  const p=v(i,j)+(v(i+1,j)-v(i,j))*sx,q=v(i,j+1)+(v(i+1,j+1)-v(i,j+1))*sx;return p+(q-p)*sy}
// height of the north land at (x,y), before roads, pads and places. Flat from the city edge to y=-40, then climbs to about 300 at y=-1400.
function hillBase(x,y){
  const u=-y;if(u<=-HILL.flatY)return 0;
  const e=clamp((u+HILL.flatY)/200,0,1),ease=e*e*(3-2*e),t=clamp((u+HILL.flatY)/1360,0,1);
  let h=280*t+ease*((vnoise(x/400,u/400)-.5)*60+(vnoise(x/150+7,u/150+3)-.5)*16);
  // peaks: a plateau, then a fall of 0.2 per unit, so the roads can climb them within their grade
  for(const p of HILL.peaks){const d=Math.hypot(x-p.x,y-p.y);h=Math.max(h,p.h-.2*Math.max(0,d-p.r0))}
  return Math.max(0,h)}
// fills the north half of the heightmap (x up to the city's east edge, y<0)
function fillHills(){
  for(let j=0;j<HM.gh;j++){const y=HM.y0+j*HM.cell;if(y>=0)break;
    for(let i=0;i<HM.gw;i++){const x=HM.x0+i*HM.cell;if(x>W+300)break;HM.a[j*HM.gw+i]=hillBase(x,y)}}
  rebuildRaised();
}
fillHills();
let northT=-9;function northWall(){if(time-northT>3){northT=time;feed('Nothing out there but desert')}}
if(DBG)Object.defineProperties(DBG,{hillLook:{get:()=>look}});
// roads: polylines in world units. Each is flattened into the heightmap along its own grade-limited profile (flattenRoad), so the ribbons sit on the ground.
const HILL_ROADS=[
  {name:'Canyon Road',w:48,pts:[[1060,60],[1060,-420],[1640,-520],[1640,-820],[1200,-900],[1200,-1180],[1900,-1240],[1900,-1500],[2400,-1560],[2400,-1780],[2802,-1900]]},
  {name:'Ridge Drive',w:44,pts:[[1900,-1500],[1400,-1620],[960,-1690]]},
  {name:'Mansion Row',w:44,loop:1,pts:[[1900,-260],[2700,-260],[2820,-520],[2300,-620],[1900,-520]]},
  {name:'Overlook',w:56,pts:[[1200,-950],[1060,-950],[960,-930]]},
  {name:'Dirt trail',w:22,dirt:1,pts:[[360,-260],[300,-620],[380,-960],[260,-1280],[360,-1600],[240,-1900]]},
  {name:'Dam',w:44,pts:[[470,-1080],[930,-1080]]},
];
const GRADE=.21; // design grade for flattening; the boot check allows 0.22
// points every `step` units along a road: [x, y, arc length, unit tangent x, unit tangent y]
function roadSamples(r,step){const P=r.loop?[...r.pts,r.pts[0]]:r.pts,out=[];let L=0;
  for(let k=0;k<P.length-1;k++){const[ax,ay]=P[k],dx=P[k+1][0]-ax,dy=P[k+1][1]-ay,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,n=Math.max(1,Math.ceil(len/step));
    for(let i=0;i<n;i++){const t=i/n*len;out.push([ax+ux*t,ay+uy*t,L+t,ux,uy])}L+=len}
  const e=P[P.length-1],l=out[out.length-1];out.push([e[0],e[1],L,l[3],l[4]]);return out}
// heights along the centreline: base ground, smoothed, then limited to GRADE both ways. A loop runs three laps and keeps the middle one, so the seam joins.
function roadProfile(r,Q){
  const n=Q.length,L=r.loop?n-1:n,laps=r.loop?3:1,T=L*laps,len=Q[n-1][2],P=[],S=[];
  for(let k=0;k<T;k++){const q=Q[k%L];P.push(q);S.push(q[2]+Math.floor(k/L)*len)}
  const h=P.map(q=>hillBase(q[0],q[1]));
  for(let it=0;it<3;it++)for(let i=1;i<T-1;i++)h[i]=(h[i-1]+h[i]+h[i+1])/3;
  for(let i=1;i<T;i++){const l=GRADE*(S[i]-S[i-1]);h[i]=clamp(h[i],h[i-1]-l,h[i-1]+l)}
  for(let i=T-2;i>=0;i--){const l=GRADE*(S[i+1]-S[i]);h[i]=clamp(h[i],h[i+1]-l,h[i+1]+l)}
  if(!r.loop)return h;
  const out=h.slice(L,2*L);out.push(out[0]);return out}
// the centreline profile: base ground, smoothed, then limited to GRADE both ways. Cells within half the width take the profile, 20 units of blend beyond.
function flattenRoad(r){
  const Q=roadSamples(r,8),n=Q.length,h=roadProfile(r,Q);
  const hw=r.w/2,pad=hw+20;let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const q of Q){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1])}
  const i0=Math.max(0,Math.floor((x0-pad-HM.x0)/HM.cell)),i1=Math.min(HM.gw-1,Math.ceil((x1+pad-HM.x0)/HM.cell)),j0=Math.max(0,Math.floor((y0-pad-HM.y0)/HM.cell)),j1=Math.min(HM.gh-1,Math.ceil((y1+pad-HM.y0)/HM.cell));
  const at=s=>{let lo=0,hi=n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(Q[m][2]<=s)lo=m;else hi=m}const t=clamp((s-Q[lo][2])/Math.max(1e-6,Q[hi][2]-Q[lo][2]),0,1);return h[lo]+(h[hi]-h[lo])*t};
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=HM.x0+i*HM.cell,y=HM.y0+j*HM.cell;
    let best=1e9,bs=0;
    for(let k=0;k<n-1;k++){const ax=Q[k][0],ay=Q[k][1],dx=Q[k+1][0]-ax,dy=Q[k+1][1]-ay,L2=dx*dx+dy*dy,t=L2?clamp(((x-ax)*dx+(y-ay)*dy)/L2,0,1):0,d=Math.hypot(ax+dx*t-x,ay+dy*t-y);
      if(d<best){best=d;bs=Q[k][2]+(Q[k+1][2]-Q[k][2])*t}}
    if(best>pad)continue;
    const k=j*HM.gw+i,tg=at(bs),w=clamp((best-hw)/20,0,1);
    HM.a[k]=best<=hw?tg:tg+(HM.a[k]-tg)*w*w*(3-2*w)}
  let gmax=0;for(let k=1;k<n;k++){const d=Q[k][2]-Q[k-1][2];if(d>1e-6)gmax=Math.max(gmax,Math.abs(groundZ(Q[k][0],Q[k][1])-groundZ(Q[k-1][0],Q[k-1][1]))/d)}
  if(gmax>.22)console.error(`hills: ${r.name} grade ${gmax.toFixed(3)}, max 0.22`);
  r.len=Q[n-1][2];r.grade=gmax;
}
// reservoir: a bowl below a water line at a fixed height. Falling in puts you (and any car) back on the shore.
const LAKE={x:700,y:-1000,r:190,water:110};
function lakeShape(){for(let j=0;j<HM.gh;j++)for(let i=0;i<HM.gw;i++){const x=HM.x0+i*HM.cell,y=HM.y0+j*HM.cell;if(y>=0||x>W+300)continue;
  const d=Math.hypot(x-LAKE.x,y-LAKE.y);if(d>LAKE.r+70)continue;const k=j*HM.gw+i,base=HM.a[k];
  if(d<LAKE.r)HM.a[k]=Math.min(base,LAKE.water-30+30*Math.pow(d/LAKE.r,4));
  else{const t=(d-LAKE.r)/70,s=t*t*(3-2*t);HM.a[k]=LAKE.water+(base-LAKE.water)*s}}}
function lakeFall(){const dx=me.x-LAKE.x,dy=me.y-LAKE.y,d=Math.hypot(dx,dy);
  if(state!=='play'||d>LAKE.r+4||groundZ(me.x,me.y)>LAKE.water-2)return;
  if(me.heli||me.jet||(me.z||0)>groundZ(me.x,me.y)+6)return; // flying over the water is not falling in
  const k=(LAKE.r+40)/Math.max(1,d),x=LAKE.x+dx*k,y=LAKE.y+dy*k;
  if(me.car){me.car.x=x;me.car.y=y;me.car.vx=me.car.vy=0}
  me.x=x;me.y=y;me.vx=me.vy=0;me.z=groundZ(x,y);feed('You fell in the reservoir. Back to the shore');
}
// flat pads for buildings: height h inside the rectangle, blended 20 units out
const PADS=[];
function padFlat(cx,cy,hw,hd,h){PADS.push({x:cx,y:cy,hw,hd});
  for(let j=0;j<HM.gh;j++)for(let i=0;i<HM.gw;i++){const x=HM.x0+i*HM.cell,y=HM.y0+j*HM.cell,dx=Math.max(0,Math.abs(x-cx)-hw),dy=Math.max(0,Math.abs(y-cy)-hd),d=Math.hypot(dx,dy);
    if(d>20)continue;const k=j*HM.gw+i;HM.a[k]=d<=0?h:HM.a[k]+(h-HM.a[k])*(1-d/20)}}
const HILL_SPOTS=[
  {name:'Griffith Observatory',x:2802,y:-1900,r:90,icon:'O'},
  {name:'PALMETTO sign',x:1420,y:-1360,r:120,icon:'S'},
  {name:'Mansion Row',x:2350,y:-450,r:300,icon:'M'},
  {name:'Reservoir',x:LAKE.x,y:LAKE.y,r:LAKE.r,icon:'R'},
  {name:'Dam',x:700,y:-1080,r:70,icon:'D'},
  {name:'Radio tower',x:904,y:-1700,r:90,icon:'T'},
  {name:'Campsite',x:430,y:-430,r:70,icon:'C'},
  {name:'Overlook',x:1000,y:-940,r:80,icon:'V'},
  {name:'Hiking trail',x:300,y:-620,r:60,icon:'H'},
];
let hillAt=null;
function hillArrive(){let best=null;for(const s of HILL_SPOTS)if(Math.hypot(me.x-s.x,me.y-s.y)<s.r){best=s;break}
  if(best!==hillAt){hillAt=best;if(best)showBig(best.name,'#ffc94a','Palmetto Hills',2.5)}}
// solid boxes in the hills, {x,y,w,h,H}; collide() and solidAt() read them
const hillSolids=[];
const MANSION_SITES=[[2050,-350],[2250,-330],[2450,-350],[2100,-500],[2350,-520],[2600,-460]];
// heights and pads for the places, before any mesh reads the ground
function placeLayout(){
  const[O,,,,,T]=HILL_SPOTS,oh=hillBase(O.x,O.y),th=hillBase(T.x,T.y);
  padFlat(O.x,O.y,62,46,oh);padFlat(2760,-1990,44,22,hillBase(2760,-1990));padFlat(T.x,T.y,26,26,th);padFlat(430,-430,38,32,hillBase(430,-430));
  hillSolids.push({x:O.x-28,y:O.y-18,w:56,h:36,H:oh+22},{x:T.x-3,y:T.y-3,w:6,h:6,H:th+150});
  for(const[x,y]of MANSION_SITES){const h=hillBase(x,y);padFlat(x,y,44,32,h);hillSolids.push({x:x-18,y:y-12,w:36,h:24,H:h+12})}
  cabinLayout();
}
// cabins by the trail, Ridge Drive and Canyon Road: flat ground 40 or more from a road centreline. The door faces the nearest road sample, and a dirt path joins them.
const CABIN_SITES=[[246,-1410],[1709,-1492],[1641,-873]],CABINS=[];
function cabinLayout(){
  for(const[x,y]of CABIN_SITES){let best=null,bd=1e9,hw=0;
    for(const r of HILL_ROADS)for(const s of roadSamples(r,4)){const d=Math.hypot(s[0]-x,s[1]-y);if(d<bd){bd=d;best=s;hw=r.w/2}}
    const[sx,sy]=best,ux=sx-x,uy=sy-y,dx=Math.abs(ux)>Math.abs(uy)?Math.sign(ux):0,dz=dx?0:Math.sign(uy),w=22,d=16,h=hillBase(x,y);
    padFlat(x,y,13,10,h);hillSolids.push({x:x-w/2,y:y-d/2,w,h:d,H:h+14});
    const door=[x+dx*(w/2+1),y+dz*(d/2+1)],L=Math.hypot(sx-door[0],sy-door[1]),end=[sx+(door[0]-sx)/L*hw,sy+(door[1]-sy)/L*hw],n=Math.max(1,Math.ceil(L/2));
    for(let i=0;i<=n;i++)HILL_RP.push([door[0]+(end[0]-door[0])*i/n,door[1]+(end[1]-door[1])*i/n,2]); // trees and rocks keep off the path
    CABINS.push({x,y,w,d,dx,dz,door,end})}
}
// the sign, observatory, mansions, reservoir water, radio tower, campsite and trail posts. Solid parts are plain meshes so staticBatch merges them by material.
function placeMeshes(){
  const out=[],add=(geo,mat,x,y,z,ry)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);if(ry)m.rotation.y=ry;out.push(m);return m};
  const white=new THREE.MeshLambertMaterial({color:'#e8e2d8'}),roofM=new THREE.MeshLambertMaterial({color:'#3a3442'}),poolM=new THREE.MeshLambertMaterial({color:'#2bb8e6',emissive:'#0b5a72'}),
    steel=new THREE.MeshLambertMaterial({color:'#2a2633'}),obsM=new THREE.MeshLambertMaterial({color:'#f2f4f8'}),domeM=new THREE.MeshLambertMaterial({color:'#c8d0dc'}),
    carM=new THREE.MeshLambertMaterial({color:'#2b2b33'}),wood=new THREE.MeshLambertMaterial({color:'#8a6a44'}),redM=new THREE.MeshBasicMaterial({color:'#ff2d55'}),
    tentM=[new THREE.MeshLambertMaterial({color:'#c24d3a'}),new THREE.MeshLambertMaterial({color:'#e0b43a'}),new THREE.MeshLambertMaterial({color:'#4a7fb0'})];
  const glowAt=(x,y,z,w,h,col)=>{const m=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(col),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,fog:false}));m.position.set(x,y,z);m.scale.set(w,h,1);out.push(m);return m};
  // observatory
  const[O,S,,,,T]=HILL_SPOTS,oh=hillBase(O.x,O.y);
  add(new THREE.BoxGeometry(56,22,36),obsM,O.x,oh+11,O.y);
  add(new THREE.SphereGeometry(24,20,10,0,Math.PI*2,0,Math.PI/2),domeM,O.x,oh+22,O.y);
  add(new THREE.BoxGeometry(124,1.8,1.2),steel,O.x,oh+.9,O.y+44);
  add(new THREE.PlaneGeometry(80,44),carM,2760,hillBase(2760,-1990)+.3,-1990).rotation.x=-Math.PI/2;
  // sign: stands on the slope, legs to the ground, faces the city
  const signT=canvasTex(1024,160,(g)=>{g.font='130px Bungee, Impact, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#f3ecff';g.shadowColor='#ff3ea5';g.shadowBlur=24;g.fillText('PALMETTO',512,86)});
  const gz=groundZ(S.x,S.y),panel=new THREE.Mesh(new THREE.PlaneGeometry(900,140),new THREE.MeshBasicMaterial({map:signT,transparent:true,fog:false}));
  panel.position.set(S.x,gz+100,S.y);out.push(panel);
  for(const sx of[-380,380]){const lg=groundZ(S.x+sx,S.y);add(new THREE.BoxGeometry(8,gz+30-lg+4,8),steel,S.x+sx,(gz+30+lg-4)/2,S.y)}
  add(new THREE.BoxGeometry(920,6,14),steel,S.x,gz+3,S.y);
  glowAt(S.x,gz+100,S.y+1,1100,330,'rgba(255,62,165,.55)');
  // mansions: white house, dark roof, pool, gate posts
  for(const[x,y]of MANSION_SITES){const h=hillBase(x,y);
    add(new THREE.BoxGeometry(36,12,24),white,x,h+6,y);add(new THREE.BoxGeometry(38,2,28),roofM,x,h+13,y);
    add(new THREE.PlaneGeometry(14,9),poolM,x+14,h+.4,y+20).rotation.x=-Math.PI/2;
    for(const sx of[-22,22])add(new THREE.BoxGeometry(2,6,2),steel,x+sx,h+3,y+31)}
  // cabins: timber walls, dark roof, a steel door on the road side, and a dirt path to the road (a strip per path)
  const timber=new THREE.MeshLambertMaterial({color:'#8a6a44'}),dirtP=new THREE.MeshLambertMaterial({color:'#6b5a3e'});
  const strip=(a,b,wd)=>{const L=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/L*wd/2,ny=(b[0]-a[0])/L*wd/2,n=Math.max(1,Math.ceil(L/3)),p=[];
    for(let i=0;i<=n;i++){const t=i/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;p.push([x+nx,y+ny],[x-nx,y-ny])}
    const pos=[];for(let i=0;i<n;i++)for(const[x,y]of[p[2*i],p[2*i+1],p[2*i+2],p[2*i+1],p[2*i+3],p[2*i+2]])pos.push(x,groundZ(x,y)+.3,y);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g};
  for(const c of CABINS){const{x,y,w,d,dx,dz,door,end}=c,gz=groundZ(x,y);
    add(new THREE.BoxGeometry(w,12,d),timber,x,gz+6,y);add(new THREE.BoxGeometry(w+3,1.6,d+3),roofM,x,gz+12.8,y);
    add(new THREE.BoxGeometry(dx?1:5,8,dz?1:5),steel,x+dx*(w/2+.5),gz+4,y+dz*(d/2+.5));
    add(strip(door,end,3),dirtP,0,0,0)}
  // campsite: fire ring with logs as seats, two tents, a picnic table and a lantern. Every piece sits on groundZ.
  const cy=-430,ch=hillBase(430,cy),gzAt=(x,y)=>groundZ(x,y),tr3=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z);
  const stoneG=new THREE.IcosahedronGeometry(1.3,0).scale(1,.55,1),stoneM=new THREE.MeshLambertMaterial({color:'#4a4650',flatShading:true});
  for(let k=0;k<9;k++){const a=k/9*TAU,x=430+Math.cos(a)*4.6,y=cy+Math.sin(a)*4.6;add(stoneG,stoneM,x,gzAt(x,y)+.3,y)}
  const logG=new THREE.CylinderGeometry(.8,.8,7,6).rotateZ(Math.PI/2);
  for(const a of[.6,2.7,4.8]){const x=430+Math.cos(a)*8,y=cy+Math.sin(a)*8;add(logG,wood,x,gzAt(x,y)+.8,y,-a-Math.PI/2)}
  glowAt(430,ch+6,cy,22,22,'rgba(255,150,60,1)');
  const tentG=tentGeo();
  for(const[x,y,a]of[[410,-446,.4],[440,-410,1.1],[452,-448,2.3]])add(tentG,tentM[Math.floor(a*3)%3],x,gzAt(x,y)-.2,y,a*Math.PI);
  const pic=mergeGeos([[new THREE.BoxGeometry(14,.6,5),tr3(0,3.7,0)],[new THREE.BoxGeometry(14,.5,2),tr3(0,1.6,-4)],[new THREE.BoxGeometry(14,.5,2),tr3(0,1.6,4)],
    ...[[-6,1.7,-1.8],[6,1.7,-1.8],[-6,1.7,1.8],[6,1.7,1.8]].map(([x,y,z])=>[new THREE.BoxGeometry(.6,3.4,.6),tr3(x,y,z)]),
    ...[[-6,.8,-4],[6,.8,-4],[-6,.8,4],[6,.8,4]].map(([x,y,z])=>[new THREE.BoxGeometry(.6,1.6,.6),tr3(x,y,z)])]);
  add(pic,wood,414,gzAt(414,-420),-420);
  const lx=447,ly=-424,lg=gzAt(lx,ly);add(new THREE.CylinderGeometry(.25,.3,5,5),steel,lx,lg+2.5,ly);add(new THREE.BoxGeometry(1.4,1.6,1.4),new THREE.MeshBasicMaterial({color:'#ffdf9e'}),lx,lg+5.3,ly);
  glowAt(lx,lg+5.5,ly,9,9,'rgba(255,200,120,1)');
  // radio tower on the second peak: a mast with a red beacon
  const T0=T.x,T1=T.y,th=hillBase(T0,T1);
  add(new THREE.CylinderGeometry(1.2,4,150,6),steel,T0,th+75,T1);add(new THREE.BoxGeometry(14,6,14),steel,T0,th+3,T1);
  add(new THREE.SphereGeometry(2.2,8,6),redM,T0,th+152,T1);glowAt(T0,th+152,T1,30,30,'rgba(255,45,85,1)');
  const wat=new THREE.Mesh(new THREE.CircleGeometry(LAKE.r+4,48),new THREE.MeshLambertMaterial({color:'#1a5a70',emissive:'#0a3346'}));wat.rotation.x=-Math.PI/2;wat.position.set(LAKE.x,LAKE.water,LAKE.y);out.push(wat);
  return out}
// hill scatter: scrub on gentle ground and palms on the mansion terraces. Trees, boulders, reeds and the trail fence are in countryMeshes().
const HILL_RP=[];for(const r of HILL_ROADS)for(const[x,y]of roadSamples(r,12))HILL_RP.push([x,y,r.w/2]);
// a spot clear of roads (clear units past the edge), pads and the lake (lake units past its rim)
function hillFree(x,y,clear,lake){if(y>-60||x<0||x>W+250||Math.hypot(x-LAKE.x,y-LAKE.y)<LAKE.r+(lake??30))return false;
  for(const p of PADS)if(Math.abs(x-p.x)<p.hw+12&&Math.abs(y-p.y)<p.hd+12)return false;
  for(const q of HILL_RP)if(Math.hypot(x-q[0],y-q[1])<q[2]+clear)return false;return true}
function propMeshes(){
  const rq=seeded(88),scrub=[];
  for(let n=0;n<5000;n++){const x=rq()*(W+250),y=-2380+rq()*2320;if(!hillFree(x,y,14))continue;
    const[gx,gy]=groundN(x,y),sl=Math.hypot(gx,gy),h=groundZ(x,y);
    if(sl<.35&&scrub.length<1000&&rq()<.6)scrub.push([x,y,h,rq()])}
  const fl=m=>{m.frustumCulled=false;return m};
  const sc=fl(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:'#5e7a3a',flatShading:true}),scrub.length));
  scrub.forEach(([x,y,h,r],i)=>{const s=2+r*2.5;inst(sc,i,x,h+s*.3,y,r*6.28,s,s*.6,s)});
  // palms: two per mansion, trunk and crown
  const palms=MANSION_SITES.flatMap(([x,y])=>{const h=hillBase(x,y);return[[x-26,y+12,h],[x+26,y+12,h]]});
  const pt=fl(new THREE.InstancedMesh(new THREE.CylinderGeometry(.5,.8,12,5),new THREE.MeshLambertMaterial({color:'#6b4a2e'}),palms.length)),
    pc=fl(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:'#2f7a48',flatShading:true}),palms.length));
  palms.forEach(([x,y,h],i)=>{inst(pt,i,x,h+6,y);inst(pc,i,x,h+13,y,i,5,1.6,5)});
  return[sc,pt,pc]}
// clusters of trees on the lake rim, beside the roads and on the slopes. Conifers stack three cones on a trunk, broadleaf trees have one round crown. Merged into five meshes.
let TREE_N=0;
function treeMeshes(){
  const tq=seeded(91),L={cd:[],cl:[],bd:[],bl:[],tr:[]},CN=[new THREE.ConeGeometry(4.4,7,6,1,true),new THREE.ConeGeometry(3.3,6,6,1,true),new THREE.ConeGeometry(2.1,5,6,1,true)],
    trunkG=new THREE.CylinderGeometry(.45,.7,4,5,1,true),crownG=new THREE.IcosahedronGeometry(1,0),C=[];
  for(let k=0;k<4000&&C.length<60;k++){const u=tq();let x,y;
    if(u<.4){const a=tq()*TAU,r=LAKE.r+12+tq()*16;x=LAKE.x+Math.cos(a)*r;y=LAKE.y+Math.sin(a)*r}
    else if(u<.7){const q=HILL_RP[Math.floor(tq()*HILL_RP.length)],a=tq()*TAU,d=q[2]+10+tq()*24;x=q[0]+Math.cos(a)*d;y=q[1]+Math.sin(a)*d}
    else{x=tq()*(W+250);y=-2380+tq()*2320}
    if(hillFree(x,y,10,8)&&groundZ(x,y)>LAKE.water+1)C.push([x,y])}
  // lookout groves: fourteen clusters in a ring 30 to 90 from each viewpoint (Overlook, Griffith Observatory). Appended after the random ones, so those keep their trees.
  const vq=seeded(97);
  for(const[vx,vy]of[[1000,-940],[2802,-1900]])for(let i=0;i<14;i++){const a=(i+vq())/14*TAU,d=30+vq()*60,x=vx+Math.cos(a)*d,y=vy+Math.sin(a)*d;if(hillFree(x,y,10,8)&&groundZ(x,y)>LAKE.water+1)C.push([x,y])}
  let n=0;
  for(const[cx,cy]of C){const cnt=4+Math.floor(tq()*6),broad=tq()<.3;
    for(let i=0;i<cnt;i++){const a=tq()*TAU,d=Math.sqrt(tq())*11,x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d;
      if(!hillFree(x,y,6,8)||groundZ(x,y)<LAKE.water+1)continue;
      const s=.8+tq()*.6,dark=tq()<.5,M=new THREE.Matrix4().compose(new THREE.Vector3(x,groundZ(x,y)-.3,y),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),tq()*TAU),new THREE.Vector3(s,s,s));
      const part=(geo,key,py,sx,sy,sz)=>L[key].push([geo,new THREE.Matrix4().multiplyMatrices(M,new THREE.Matrix4().compose(new THREE.Vector3(0,py,0),new THREE.Quaternion(),new THREE.Vector3(sx||1,sy||1,sz||1)))]);
      n++;
      if(broad){part(trunkG,'tr',2.5);part(crownG,dark?'bd':'bl',6.6,3.4,2.8,3.4)}
      else{const k2=dark?'cd':'cl';part(trunkG,'tr',2);part(CN[0],k2,7);part(CN[1],k2,9.5);part(CN[2],k2,11.5)}}}
  TREE_N=n;
  const mat=c=>new THREE.MeshLambertMaterial({color:c,flatShading:true}),M2=(list,m)=>list.length?new THREE.Mesh(mergeGeos(list),m):null;
  return[M2(L.cd,mat('#2a4f36')),M2(L.cl,mat('#3d6e46')),M2(L.bd,mat('#4f7a3a')),M2(L.bl,mat('#6f8f3e')),M2(L.tr,mat('#4a3426'))].filter(Boolean)}
// boulders in groups: at the foot of steep faces (a step downhill from the cliff), on gentle slopes, and a few on the lake shore
function boulderMeshes(){
  const bq=seeded(93),ST=new THREE.IcosahedronGeometry(1,0),list=[],up=new THREE.Vector3(0,1,0);let groups=0;
  const rock=(x,y,s)=>list.push([ST,new THREE.Matrix4().compose(new THREE.Vector3(x,groundZ(x,y)+s*.2,y),new THREE.Quaternion().setFromAxisAngle(up,bq()*TAU),new THREE.Vector3(s,s*.7,s))]);
  for(let k=0;k<4000&&groups<44;k++){const x=bq()*(W+250),y=-2380+bq()*2320;if(!hillFree(x,y,8))continue;
    const[gx,gy]=groundN(x,y),sl=Math.hypot(gx,gy);let cx=x,cy=y;
    if(sl>.42){const d=9+bq()*6;cx=x-gx/sl*d;cy=y-gy/sl*d;if(!hillFree(cx,cy,6))continue}
    else if(sl<.15)continue;
    groups++;
    for(let i=0,m=3+Math.floor(bq()*4);i<m;i++){const bx=cx+(bq()-.5)*10,by=cy+(bq()-.5)*10;if(hillFree(bx,by,4))rock(bx,by,1.4+bq()*2.6)}}
  for(let i=0;i<40;i++){const a=bq()*TAU,r=LAKE.r+6+bq()*8,x=LAKE.x+Math.cos(a)*r,y=LAKE.y+Math.sin(a)*r;if(groundZ(x,y)>LAKE.water+.6&&y<-60)rock(x,y,1+bq()*.9)}
  return new THREE.Mesh(mergeGeos(list),new THREE.MeshLambertMaterial({color:'#6e655c',flatShading:true}))}
// reed tufts on the bank just above the waterline
function reedMesh(){
  const rq=seeded(95),RG=new THREE.ConeGeometry(.35,1,3,1,true),list=[];
  for(let k=0;k<200;k++){const a=rq()*TAU,r=LAKE.r+10+rq()*16,x=LAKE.x+Math.cos(a)*r,y=LAKE.y+Math.sin(a)*r;
    if(y>-60||groundZ(x,y)<LAKE.water+.8)continue;
    for(let t=0;t<4;t++){const px=x+(rq()-.5)*3,pz=y+(rq()-.5)*3,hh=2.5+rq()*2.5,g=groundZ(px,pz);if(g<LAKE.water+.5)continue;
      list.push([RG,new THREE.Matrix4().compose(new THREE.Vector3(px,g+hh/2,pz),new THREE.Quaternion().setFromEuler(new THREE.Euler((rq()-.5)*.2,0,(rq()-.5)*.2)),new THREE.Vector3(1,hh,1))])}}
  return new THREE.Mesh(mergeGeos(list),new THREE.MeshLambertMaterial({color:'#4d6b3a',flatShading:true}))}
// post and rail fence along both verges of the dirt trail, 2 units clear of the edge
function dirtFence(){
  const tp=HILL_ROADS.find(r=>r.dirt),S=roadSamples(tp,8),n=S.length,hw=tp.w/2,list=[],post=new THREE.BoxGeometry(.5,2.4,.5),rail=new THREE.BoxGeometry(1,.4,.25),up=new THREE.Vector3(0,1,0);
  for(const sg of[1,-1]){const P=S.map(([x,y,,ux,uy])=>[x-uy*sg*(hw+2),y+ux*sg*(hw+2)]);
    for(let i=0;i<n;i++){const[px,pz]=P[i],g=groundZ(px,pz);
      if(i%3===0)list.push([post,new THREE.Matrix4().makeTranslation(px,g+1.2,pz)]);
      if(i+1<n){const[qx,qz]=P[i+1],dx=qx-px,dz=qz-pz,ry=Math.atan2(-dz,dx),mx=(px+qx)/2,mz=(pz+qz)/2;
        for(const h of[.9,1.9])list.push([rail,new THREE.Matrix4().compose(new THREE.Vector3(mx,groundZ(mx,mz)+h,mz),new THREE.Quaternion().setFromAxisAngle(up,ry),new THREE.Vector3(Math.hypot(dx,dz)+.2,1,1))])}}}
  return new THREE.Mesh(mergeGeos(list),new THREE.MeshLambertMaterial({color:'#8a6a44'}))}
// trail junction: the Overlook road leaves Canyon Road at (1200,-950). The sign stands on the east verge and faces west.
function trailSign(){
  const x=1244,y=-958,g=groundZ(x,y),tx=canvasTex(256,96,(c,w,h)=>{c.fillStyle='#ffc94a';c.fillRect(0,0,w,h);c.fillStyle='#141218';c.font='bold 44px "Chakra Petch", Impact, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('< OVERLOOK',w/2,h/2+2)}),
    board=new THREE.Mesh(new THREE.PlaneGeometry(14,5.2),new THREE.MeshLambertMaterial({map:tx,side:THREE.DoubleSide}));
  board.position.set(x,g+6.2,y);board.rotation.y=-Math.PI/2;
  const posts=mergeGeos([-5,5].map(dz=>[new THREE.BoxGeometry(.5,6,.5),new THREE.Matrix4().makeTranslation(0,3,dz)]));
  const pm=new THREE.Mesh(posts,new THREE.MeshLambertMaterial({color:'#8a6a44'}));pm.position.set(x,g,y);
  return[board,pm]}
// A-frame tent: flat base on y=0, 16 long, 10 wide, 9 high
function tentGeo(){const p=[[-8,0,-5],[8,0,-5],[8,0,5],[-8,0,5],[-8,9,0],[8,9,0]],f=[[0,5,1],[0,4,5],[3,2,5],[3,5,4],[0,3,4],[1,5,2]];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(f.flatMap(t=>t.flatMap(i=>p[i])),3));g.computeVertexNormals();return g}
// everything on the hills that is merged: trees, boulders, reeds, the trail fence and sign
function countryMeshes(){return[...treeMeshes(),boulderMeshes(),reedMesh(),dirtFence(),...trailSign()].filter(Boolean)}
if(DBG)Object.defineProperties(DBG,{treeCount:{get:()=>TREE_N}});
lakeShape();for(const r of HILL_ROADS)flattenRoad(r);placeLayout();rebuildRaised();
if(DBG)Object.defineProperties(DBG,{buildings:{get:()=>buildings},hillSpots:{get:()=>HILL_SPOTS.map(s=>s.name)},hillRoads:{get:()=>HILL_ROADS.length},roadGrades:{get:()=>HILL_ROADS.map(r=>[r.name,Math.round(r.len),+r.grade.toFixed(3)])}});
// ribbons: asphalt, a dirt strip, dashed centre line, guard rails and reflective posts. All follow the heightmap at each edge (+0.3).
function roadMeshes(){
  const ROAD_TEX=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#24222c';g.fillRect(0,0,w,h);grit(g,w,h,8000,41,.07)});ROAD_TEX.wrapS=ROAD_TEX.wrapT=THREE.RepeatWrapping;
  const DIRT_TEX=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#6b5a3e';g.fillRect(0,0,w,h);grit(g,w,h,9000,43,.14)});DIRT_TEX.wrapS=DIRT_TEX.wrapT=THREE.RepeatWrapping;
  const asph=[],dirt=[],dash=[],rail=[],posts=[];
  const geo=arr=>{const k=arr.length/5,p=new Float32Array(k*3),u=new Float32Array(k*2);for(let i=0;i<k;i++){p[i*3]=arr[i*5];p[i*3+1]=arr[i*5+1];p[i*3+2]=arr[i*5+2];u[i*2]=arr[i*5+3];u[i*2+1]=arr[i*5+4]}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('uv',new THREE.BufferAttribute(u,2));g.computeVertexNormals();return g};
  for(const r of HILL_ROADS){
    const S=roadSamples(r,4),n=S.length,hw=r.w/2,lin=r.dirt?dirt:asph;
    const E=S.map(([x,y,s,ux,uy])=>({x,y,s,ux,uy,nx:-uy,ny:ux,l:[x-uy*hw,y+ux*hw],r:[x+uy*hw,y-ux*hw]}));
    const zz=p=>groundZ(p[0],p[1])+.3;
    for(let i=0;i<n-1;i++){const a=E[i],b=E[i+1];
      const q=[[a.l,0,a.s],[a.r,1,a.s],[b.l,0,b.s],[b.r,1,b.s]].map(([p,u,s])=>[p[0],zz(p),p[1],u,s/40]);
      lin.push(...q[0],...q[1],...q[2],...q[1],...q[3],...q[2]);
      if(!r.dirt&&Math.floor(a.s/8)%2===0){const h=.36,c=[[a.x+a.nx*.5,a.y+a.ny*.5],[a.x-a.nx*.5,a.y-a.ny*.5],[b.x+b.nx*.5,b.y+b.ny*.5],[b.x-b.nx*.5,b.y-b.ny*.5]];
        for(const[p,u,v]of[[c[0],0,0],[c[1],1,0],[c[2],0,1],[c[1],1,0],[c[3],1,1],[c[2],0,1]])dash.push(p[0],groundZ(p[0],p[1])+h,p[1],u,v)}}
    if(r.dirt)continue;
    for(const sg of[1,-1]){const f=[],P=(e,hg)=>{const x=e.x+e.nx*sg*(hw+.6),z=e.y+e.ny*sg*(hw+.6);return[x,groundZ(x,z)+hg,z]};
      for(let i=0;i<n;i++){const e=E[i],k0=Math.max(0,i-3),k1=Math.min(n-1,i+3),turn=wrap(Math.atan2(E[k1].uy,E[k1].ux)-Math.atan2(E[k0].uy,E[k0].ux));
        const drop=groundZ(e.x+e.nx*sg*(hw+5),e.y+e.ny*sg*(hw+5))<groundZ(e.x,e.y)-2.5;f.push(drop||turn*sg<-.12)}
      for(let i=0;i<n-1;i++){if(!f[i]||!f[i+1])continue;const a=E[i],b=E[i+1],p0=P(a,.5),p1=P(b,.5),t0=P(a,1.5),t1=P(b,1.5);
        rail.push(...p0,0,0,...p1,0,0,...t1,0,0,...p0,0,0,...t1,0,0,...t0,0,0)}
      for(let i=0;i<n;i+=3)if(f[i])posts.push(P(E[i],.7))}}
  const roadM=new THREE.MeshLambertMaterial({map:ROAD_TEX,side:THREE.DoubleSide}),dirtM=new THREE.MeshLambertMaterial({map:DIRT_TEX,side:THREE.DoubleSide}),railM=new THREE.MeshLambertMaterial({color:'#aab4c6',side:THREE.DoubleSide});
  const pm=new THREE.InstancedMesh(new THREE.BoxGeometry(.5,1.6,.5),new THREE.MeshLambertMaterial({color:'#f0e2b0',emissive:'#7a5f22'}),posts.length);
  posts.forEach((p,i)=>inst(pm,i,p[0],p[1],p[2]));pm.frustumCulled=false;
  const lineM=new THREE.MeshBasicMaterial({color:'#e8d27a',side:THREE.DoubleSide});
  return[new THREE.Mesh(geo(asph),roadM),new THREE.Mesh(geo(dirt),dirtM),new THREE.Mesh(geo(dash),lineM),new THREE.Mesh(geo(rail),railM),pm]}
// one mesh per 400 units of y. Vertex colours: dry grass, darker meadow patches, bare dirt on the trail and round the campsite, rock on steep faces (dark at the foot, lighter up high).
// Steep quads leave the grass meshes and go into one rock mesh with horizontal strata.
const HC={verge:new THREE.Color('#4a4a36'),g1:new THREE.Color('#5b8a3a'),g2:new THREE.Color('#9aa04c'),meadow:new THREE.Color('#2c5a2a'),dry:new THREE.Color('#a8a25a'),dirt:new THREE.Color('#6b5a3e'),r1:new THREE.Color('#4f4a47'),r2:new THREE.Color('#a39c93')},HCOL=new THREE.Color(),HCOL2=new THREE.Color();
function hillMeshes(){
  const det=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#c8c8c8';g.fillRect(0,0,w,h);grit(g,w,h,9000,31,.12)});det.wrapS=det.wrapT=THREE.RepeatWrapping;
  const strata=canvasTex(128,128,(g,w,h)=>{for(let k=0;k<8;k++){g.fillStyle=k%2?'#c4c4c4':'#e8e8e8';g.fillRect(0,k*16,w,16);g.fillStyle='#7a7a7a';g.fillRect(0,k*16,w,2)}grit(g,w,h,1200,57,.12)});strata.wrapS=strata.wrapT=THREE.RepeatWrapping;
  const nx=Math.floor((W+300-HM.x0)/HM.cell)+1,hz=(i,j)=>HM.a[clamp(j,0,HM.gh-1)*HM.gw+clamp(i,0,HM.gw-1)],out=[],DIRT=roadSamples(HILL_ROADS.find(r=>r.dirt),12),rk={p:[],n:[],c:[],u:[]};
  // every 2nd heightmap sample (20 units): a quarter of the triangles, the same slopes
  const cs=[];for(let i=0;i<nx;i+=2)cs.push(i);if(cs[cs.length-1]!==nx-1)cs.push(nx-1);
  for(let j0=20;j0<260;j0+=40){const j1=Math.min(260,j0+40),rs=[];for(let j=j0;j<=j1;j+=2)rs.push(j);if(rs[rs.length-1]!==j1)rs.push(j1);const pos=[],nor=[],col=[],uv=[],sl=[],dv=[],ix=[];
    for(const j of rs)for(const i of cs){const x=HM.x0+i*HM.cell,z=HM.y0+j*HM.cell,h=hz(i,j);
      const gx=(hz(i+1,j)-hz(i-1,j))/(2*HM.cell),gz=(hz(i,j+1)-hz(i,j-1))/(2*HM.cell),s=Math.hypot(gx,gz),ln=Math.hypot(gx,1,gz);
      pos.push(x,h,z);nor.push(-gx/ln,1/ln,-gz/ln);uv.push(x/120,z/120);sl.push(s);
      if(h<1.5)HCOL.copy(HC.verge);else HCOL.lerpColors(HC.g1,HC.g2,clamp(h/360,0,1));
      const pn=vnoise(x/70+3,z/70+9);if(pn>.6)HCOL.lerp(HC.meadow,.8);else if(pn<.38)HCOL.lerp(HC.dry,.65);
      let dd=1e9;for(const q of DIRT)dd=Math.min(dd,Math.hypot(x-q[0],z-q[1]));
      // the campsite pad (padFlat 430,-430, 38 by 32) and its 20-unit height blend are packed earth. The blend is steep on the north side, so it stays dirt past the pad edge and fades only after it.
      const cx=Math.max(0,Math.abs(x-430)-38),cz=Math.max(0,Math.abs(z+430)-32),dirtA=clamp(Math.max(1-(dd-6)/12,1-clamp((Math.hypot(cx,cz)-18)/22,0,1)),0,1)*.9;
      HCOL.lerp(HC.dirt,dirtA).multiplyScalar(1-.2*dirtA);dv.push(dirtA);
      const k=clamp((s-.42)/.28,0,1);HCOL2.lerpColors(HC.r1,HC.r2,clamp(h/420,0,1)*.6+.4*vnoise(x/90,z/90));HCOL.lerp(HCOL2,k*k*(3-2*k)*(1-dirtA));
      col.push(HCOL.r,HCOL.g,HCOL.b)}
    const nc=cs.length;for(let j=0;j<rs.length-1;j++)for(let i=0;i<nc-1;i++){const a=j*nc+i,b=a+1,c=a+nc,d=c+1;
      // a quad on the campsite rim is steep but dirt, so it stays in the grass mesh (the strata texture would pale it)
      if((sl[a]+sl[b]+sl[c]+sl[d])/4<.42||dv[a]+dv[b]+dv[c]+dv[d]>2){ix.push(a,c,b,b,c,d);continue}
      for(const v of[a,c,b,b,c,d])rk.p.push(pos[v*3],pos[v*3+1],pos[v*3+2]),rk.n.push(nor[v*3],nor[v*3+1],nor[v*3+2]),rk.c.push(col[v*3],col[v*3+1],col[v*3+2]),rk.u.push((pos[v*3]+pos[v*3+2])/150,pos[v*3+1]/48)}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);
    out.push(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,map:det})))}
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(rk.p,3));rg.setAttribute('normal',new THREE.Float32BufferAttribute(rk.n,3));
  rg.setAttribute('color',new THREE.Float32BufferAttribute(rk.c,3));rg.setAttribute('uv',new THREE.Float32BufferAttribute(rk.u,2));
  out.push(new THREE.Mesh(rg,new THREE.MeshLambertMaterial({vertexColors:true,map:strata})));
  return out.concat(roadMeshes(),placeMeshes(),propMeshes(),countryMeshes(),[hikeMesh()])}

// hill traffic: up to 6 cars (kind 'hill') drive the paved hill roads both ways and slow in bends. Eight hikers walk the dirt trail and the overlook as one instanced mesh.
const HILL_RT=HILL_ROADS.map(r=>{const S=roadSamples(r,4),n=S.length,v=new Float32Array(n);
  for(let i=0;i<n;i++){const k0=Math.max(0,i-3),k1=Math.min(n-1,i+3),turn=Math.abs(wrap(Math.atan2(S[k1][4],S[k1][3])-Math.atan2(S[k0][4],S[k0][3])));v[i]=75/(1+3*turn)}
  return{S,v,len:S[n-1][2],loop:!!r.loop,dirt:!!r.dirt,w:r.w,name:r.name}});
const HILL_CARROADS=HILL_RT.map((R,i)=>i).filter(i=>!HILL_RT[i].dirt);
const HILL_WALKROADS=HILL_RT.map((R,i)=>i).filter(i=>HILL_RT[i].dirt||HILL_RT[i].name==='Overlook');
// pose of a car or hiker on its road: position in its lane, heading along travel direction
function hillPose(c){const R=HILL_RT[c.road],S=R.S,f=c.s/4,i=Math.min(S.length-2,Math.max(0,Math.floor(f))),t=clamp(f-i,0,1),a=S[i],b=S[i+1];
  let ux=a[3]+(b[3]-a[3])*t,uy=a[4]+(b[4]-a[4])*t;const l=Math.hypot(ux,uy)||1;ux/=l;uy/=l;
  const tx=ux*c.dir,ty=uy*c.dir;
  c.x=a[0]+(b[0]-a[0])*t+ty*c.lane;c.y=a[1]+(b[1]-a[1])*t-tx*c.lane;c.a=Math.atan2(ty,tx)}
function hillCarStep(c,dt){const R=HILL_RT[c.road],sp=R.v[clamp(Math.round(c.s/4),0,R.v.length-1)];
  c.cur+=(sp-c.cur)*Math.min(1,2*dt);c.s+=c.dir*c.cur*dt;
  if(R.loop)c.s=((c.s%R.len)+R.len)%R.len;else if(c.s<0||c.s>R.len){c.s=clamp(c.s,0,R.len);c.dir=-c.dir}
  hillPose(c);c.vx=Math.cos(c.a)*c.cur;c.vy=Math.sin(c.a)*c.cur}
// cars more than 900 from every player update every other frame (with double dt)
function hillCarFar(c){if(Math.hypot(c.x-A.x,c.y-A.y)<=900)return false;for(const r of remotes.values())if(Math.hypot(c.x-r.x,c.y-r.y)<=900)return false;return true}
let hillT=0,hillFrame=0;
function hillTraffic(dt){hillFrame++;hillT-=dt;if(hillT>0)return;hillT=1.5;
  const near=(x,y,d)=>{if(Math.hypot(x-A.x,y-A.y)<d)return true;for(const r of remotes.values())if(Math.hypot(x-r.x,y-r.y)<d)return true;return false};
  let n=0;for(let i=cars.length-1;i>=0;i--){const c=cars[i];if(c.kind!=='hill')continue;n++;if(!near(c.x,c.y,1400)){cars.splice(i,1);n--}}
  if(n>=6)return;
  const road=HILL_CARROADS[Math.floor(rand()*HILL_CARROADS.length)],R=HILL_RT[road];
  const c=mkCar(0,0,0,'hill',CARCOL[Math.floor(rand()*CARCOL.length)],'sedan');Object.assign(c,{road,s:rand()*R.len,dir:rand()<.5?1:-1,lane:Math.min(10,R.w*.22),cur:60});
  hillPose(c);if(!near(c.x,c.y,520)&&near(c.x,c.y,1300))cars.push(c)}
const HCAR={geo:null,mat:{}};
function hillCarMesh(col){if(!HCAR.geo){const b=new THREE.BoxGeometry(4.4,1.6,2.3),k=new THREE.BoxGeometry(2.4,1.3,2);
    HCAR.geo=mergeGeos([[b,new THREE.Matrix4().makeTranslation(0,1.6,0)],[k,new THREE.Matrix4().makeTranslation(-.3,3,0)]])}
  const m=new THREE.Mesh(HCAR.geo,HCAR.mat[col]||(HCAR.mat[col]=new THREE.MeshLambertMaterial({color:col})));m.userData.body=m;m.userData.beam=new THREE.Object3D();return m}
// hikers: eight instances, drawn as one mesh
const HIKERS=[],HIKE={mesh:null},HIKE_COL=['#ff7a2e','#29e6d6','#ff3ea5','#ffc94a','#7b6bff','#3dd68c','#ff6b3d','#f3ecff'];
function hikeMesh(){const g=mergeGeos([[new THREE.BoxGeometry(1.8,4.5,1.2),new THREE.Matrix4().makeTranslation(0,4.5,0)],[new THREE.SphereGeometry(1.1,8,6),new THREE.Matrix4().makeTranslation(0,7.4,0)]]);
  const m=new THREE.InstancedMesh(g,new THREE.MeshLambertMaterial({color:'#ffffff'}),8);m.frustumCulled=false;
  for(let i=0;i<8;i++){const road=HILL_WALKROADS[i%HILL_WALKROADS.length],R=HILL_RT[road],h={road,s:rand()*R.len,dir:rand()<.5?1:-1,v:18+rand()*10,lane:(rand()-.5)*R.w*.5,x:0,y:0,a:0};
    hillPose(h);HIKERS.push(h);m.setColorAt(i,new THREE.Color(HIKE_COL[i]))}
  HIKE.mesh=m;return m}
function hikerStep(dt){if(!HIKE.mesh)return;
  HIKERS.forEach((h,i)=>{const fr=Math.hypot(h.x-A.x,h.y-A.y)>900;if(fr&&(hillFrame&1))return;const R=HILL_RT[h.road];
    h.s+=h.dir*h.v*(fr?2:1)*dt;if(h.s<0||h.s>R.len){h.s=clamp(h.s,0,R.len);h.dir=-h.dir}
    hillPose(h);inst(HIKE.mesh,i,h.x,groundZ(h.x,h.y),h.y,-h.a)});
  HIKE.mesh.instanceMatrix.needsUpdate=true}
if(DBG)Object.defineProperties(DBG,{hillCars:{get:()=>cars.filter(c=>c.kind==='hill').length},hikers:{get:()=>HIKERS.length}});

// shared map palette: the minimap and the phone map draw from these colours
const MAPC={water:'#12384f',waterLight:'#1d6a8a',surf:'#bfeaf5',sand:'#b09064',park:'#1f5c36',parkLight:'#2f8a4e',
 road:'#23212c',roadEdge:'#4a4658',ave:'#57536a',downtown:'#3b3448',midtown:'#3e3950',hood:'#4a3c34',suburb:'#3c5340',
 industrial:'#3a4250',airport:'#33363f',runway:'#191b22',gold:'#ffc94a',wood:'#6a5040',lot:'#2a2735',front:'#4c3f4e'};
// minimap layer for the hills, drawn once: terrain colour, roads and the lake. buildMapBase adds the relief on top.
function buildHillMini(MS,MO){
  const X0=-MO,Y0=HILL.edge-MO,cv=document.createElement('canvas');cv.width=Math.ceil((W+2*MO)/MS);cv.height=Math.ceil(-Y0/MS);cv.ox=X0;cv.oy=Y0;
  const g=cv.getContext('2d'),t=(x,y)=>[(x-X0)/MS,(y-Y0)/MS],i0=Math.max(0,Math.round((X0-HM.x0)/HM.cell)),i1=Math.min(HM.gw-1,Math.round((X0+cv.width*MS-HM.x0)/HM.cell)),
    j0=Math.max(0,Math.round((Y0-HM.y0)/HM.cell)),j1=Math.min(HM.gh-1,Math.round((0-HM.y0)/HM.cell)-1),ni=i1-i0+1,nj=j1-j0+1,hh=(i,j)=>HM.a[clamp(j,0,HM.gh-1)*HM.gw+clamp(i,0,HM.gw-1)];
  g.fillStyle='#0b2a3d';g.fillRect(0,0,cv.width,cv.height);
  const img=new ImageData(ni,nj),d=img.data;
  for(let j=0;j<nj;j++)for(let i=0;i<ni;i++){const h=hh(i0+i,j0+j),f=clamp(h/300,0,1),k=(j*ni+i)*4;
    // grass, dry gold and stone across the height, so the hills read as land, not a flat wash
    let c=h<1?[74,74,54]:f<.25?[70,102,52]:f<.6?[86,112,58]:[118,110,84];
    if(h>320)c=[132,126,116];
    d[k]=c[0];d[k+1]=c[1];d[k+2]=c[2];d[k+3]=255}
  const tmp=document.createElement('canvas');tmp.width=ni;tmp.height=nj;tmp.getContext('2d').putImageData(img,0,0);
  g.imageSmoothingEnabled=true;const[px,py]=t(HM.x0+i0*HM.cell,HM.y0+j0*HM.cell);g.drawImage(tmp,px,py,ni*HM.cell/MS,nj*HM.cell/MS);
  for(const r of HILL_ROADS){const S=roadSamples(r,6);g.beginPath();S.forEach(([x,y],k)=>{const[qx,qy]=t(x,y);k?g.lineTo(qx,qy):g.moveTo(qx,qy)});
    g.lineJoin='round';g.strokeStyle=r.dirt?'#6a5236':'#2a2833';g.lineWidth=Math.max(2.2,r.w/MS);g.stroke();
    g.strokeStyle=r.dirt?'#9a8258':'#6a6480';g.lineWidth=Math.max(1.1,r.w/MS-2);g.stroke()}
  const[lx,ly]=t(LAKE.x,LAKE.y);g.fillStyle=MAPC.waterLight;g.beginPath();g.arc(lx,ly,LAKE.r/MS,0,TAU);g.fill();
  g.strokeStyle='#0e2b3a';g.lineWidth=1.5;g.stroke();
  return cv}
// shade and contour lines for the whole heightmap, one pixel per 10 unit cell. Light from the north-west at 45 degrees.
// A line every 40 units, darker every 200. The lake stays clear.
function buildRelief(){
  const gw=HM.gw,gh=HM.gh,cv=document.createElement('canvas');cv.width=gw;cv.height=gh;
  const g=cv.getContext('2d'),img=g.createImageData(gw,gh),d=img.data,hz=(i,j)=>HM.a[clamp(j,0,gh-1)*gw+clamp(i,0,gw-1)],c2=2*HM.cell;
  for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){
    const x=HM.x0+i*HM.cell,y=HM.y0+j*HM.cell;if(Math.hypot(x-LAKE.x,y-LAKE.y)<LAKE.r+HM.cell)continue;
    const h=hz(i,j),hr=hz(i+1,j),hd=hz(i,j+1),k=(j*gw+i)*4,gx=(hr-hz(i-1,j))/c2,gy=(hd-hz(i,j-1))/c2,
      s=(.5*(gx+gy)+.707)/Math.hypot(gx,gy,1)-.707; // normal dot light, minus flat ground: 0 on flat ground, above 0 facing the light
    const l40=Math.floor(h/40)!==Math.floor(hr/40)||Math.floor(h/40)!==Math.floor(hd/40),l200=Math.floor(h/200)!==Math.floor(hr/200)||Math.floor(h/200)!==Math.floor(hd/200);
    if(l200){d[k]=d[k+1]=d[k+2]=20;d[k+3]=235}
    else if(l40){d[k]=d[k+1]=d[k+2]=40;d[k+3]=150}
    else if(s<0){d[k+3]=Math.min(130,-s*380)}
    else if(s>0){d[k]=d[k+1]=d[k+2]=255;d[k+3]=Math.min(70,s*200)}}
  g.putImageData(img,0,0);return cv}
function buildMapBase(){
  const cv=document.createElement('canvas');cv.width=Math.ceil((MAPB.x1-MAPB.x0)/MS);cv.height=Math.ceil((MAPB.y1-MAPB.y0)/MS);
  const g=cv.getContext('2d'),rel=buildRelief();
  g.fillStyle=MAPC.water;g.fillRect(0,0,cv.width,cv.height);
  g.drawImage(miniBig,(-MO-MAPB.x0)/MS,(-MO-MAPB.y0)/MS);
  g.drawImage(hillMini,(hillMini.ox-MAPB.x0)/MS,(hillMini.oy-MAPB.y0)/MS);
  g.drawImage(rel,(HM.x0-MAPB.x0)/MS,(HM.y0-MAPB.y0)/MS,rel.width*HM.cell/MS,rel.height*HM.cell/MS);
  return cv}
// one map icon, shared by the phone map and the minimap: a ring for an outdoor spot, a square with a coloured frame for an enterable place
function mapIcon(c,x,y,r,door,col,glyph){c.fillStyle='#0b0814';c.strokeStyle=col;c.lineWidth=2;c.beginPath();if(door)c.rect(x-r,y-r,2*r,2*r);else c.arc(x,y,r,0,TAU);c.fill();c.stroke();c.fillStyle=col;c.fillText(glyph,x,y+1)}
// fog thins in the hills so the city lights show from the overlook at night
let fogHill=false;
function hillFog(){const on=me.y<0;if(on===fogHill)return;fogHill=on;skyLook()}

// ---------- landmarks ----------
// Hand-placed places on the blocks in LANDBLK. Their buildings are solid boxes (kind 'lm') with a mesh in landmarkMeshes() (models section).
// Shapes go through addShape, so the heightmap, steps and ramps need no extra code.
const LMS=[],LMA={spray:null,boats:null};
// name shown on entry (AREA banner), footprint for the minimap and the debug list
const LANDMARKS=[{name:'The Pit',sub:'Walled arena, catwalk and floodlights',x:3200,y:3200,w:320,h:320,ic:'X'},{name:'Palmetto Plaza',sub:'Fountain, stage and a terrace',x:1000,y:1880,w:320,h:320,ic:'F'},{name:'Sunset Pier',sub:'Boardwalk, Ferris wheel and the coaster frame',x:1900,y:4520,w:400,h:260,ic:'W'},{name:'Skate Park',sub:'Bowls, graffiti walls and rails',x:1880,y:3200,w:320,h:320,ic:'Z'},{name:'Rustwater Marina',sub:'Quay, boats and containers',x:120,y:3520,w:320,h:440,ic:'M'},{name:'Container Yard',sub:'Stacked containers and a crane',x:120,y:3200,w:320,h:320,ic:'Y'}];
function landmarkKey(x,y){const i=LANDMARKS.findIndex(l=>x>=l.x&&x<l.x+l.w&&y>=l.y&&y<l.y+l.h);return i<0?null:'lm'+i}
LANDMARKS.forEach((l,i)=>AREA['lm'+i]=[l.name,l.sub]); // entry banner text
const LMC={cA:'#b8432f',cB:'#2f6fb8',cC:'#d68a2f',cD:'#3d8a52',stall:'#5a4030',wall:'#4a4658',stone:'#3a3646',planter:'#5a4a3a',metal:'#2c2938',water:'#1d6a8a',wood:'#6b4a32'};
// solid box: collision in buildings, a mesh in landmarkMeshes(); m is a key of LMC. H is the height above the ground.
function lmSolid(x,y,w,h,H,m){const b={x,y,w,h,H,kind:'lm',m,roof:LMC[m]};buildings.push(b);LMS.push(b);
  cells[clamp(Math.floor((y+h/2)/B),0,N-1)*N+clamp(Math.floor((x+w/2)/B),0,N-1)].push(b);return b}
// Palmetto Plaza, block (2,4): x 1000 to 1320, y 1880 to 2200. Low walls with a gap on the west and east sides, a fountain, planters, a 12-high terrace with 4-high steps and a stunt ramp that drives up onto it.
const PLAZA={x:1000,y:1880};
lmSolid(1000,1880,320,4,3.2,'wall');lmSolid(1000,2196,320,4,3.2,'wall');              // north and south walls
lmSolid(1000,1880,4,136,3.2,'wall');lmSolid(1000,2064,4,136,3.2,'wall');              // west wall, gap at y 2016 to 2064
lmSolid(1316,1880,4,136,3.2,'wall');lmSolid(1316,2064,4,136,3.2,'wall');              // east wall, same gap
lmSolid(1140,2020,40,40,3.2,'stone');                                                 // fountain basin (round in the mesh)
for(const[x,y]of[[1010,1890],[1040,1890],[1280,1890],[1296,1890],[1010,1960],[1010,2110],[1296,1960],[1296,2110],[1010,2180],[1040,2180],[1200,2180],[1240,2180],[1280,2180]])lmSolid(x,y,14,14,4,'planter');
addShape({kind:'plateau',x:1160,y:1950,w:200,d:80,h:4,slope:3});    // terrace, step 1
addShape({kind:'plateau',x:1160,y:1950,w:160,d:56,h:8,slope:3});    // step 2
addShape({kind:'plateau',x:1160,y:1950,w:120,d:32,h:12,slope:3});   // top, 12 high
addShape({kind:'ramp',x:1200,y:2000,a:-Math.PI/2,len:40,w:24,h:12}); // drive up onto the terrace from the south, clear of the fountain; lip at y 1960
addShape({kind:'plateau',x:1240,y:2140,w:110,d:56,h:4,slope:2});    // stage
// Rustwater Marina, blocks (0,7) and (0,8): a container yard on (0,7); on (0,8) a basin with boats, a quay on its east side with containers and a crane, and a stunt ramp off the quay over the basin onto a container row on the west bank.
for(let i=0;i<6;i++){lmSolid(140+i*44,3236,40,18,8,i%2?'cA':'cB');lmSolid(140+i*44,3290,40,18,i<3?16:8,i%2?'cC':'cD')}
lmSolid(140,3350,40,18,8,'cC');lmSolid(184,3350,40,18,8,'cA');
lmSolid(170,3648,126,4,3.2,'wall');lmSolid(170,3948,126,4,3.2,'wall');   // basin bulkheads, north and south
lmSolid(166,3648,4,124,3.2,'wall');lmSolid(166,3828,4,124,3.2,'wall');    // west bank, split by the canal mouthlmSolid(296,3648,4,130,3.2,'wall');lmSolid(296,3822,4,130,3.2,'wall'); // west bank; quay edge with a gap at y 3778 to 3822 for the ramp lip
addShape({kind:'plateau',x:370,y:3800,w:140,d:320,h:3,slope:2});          // quay
addShape({kind:'ramp',x:345,y:3862,a:Math.PI,len:40,w:30,h:12});         // off the quay, west along the south bank
for(const[y,c]of[[3660,'cA'],[3682,'cB'],[3704,'cC'],[3960-18-80,'cD']])lmSolid(372,y,40,18,8,c); // quay containers, north part
lmSolid(126,3664,36,18,8,'cB');lmSolid(126,3686,36,18,8,'cA');lmSolid(126,3836,36,18,8,'cC');lmSolid(126,3844,36,18,16,'cD');lmSolid(126,3866,36,18,8,'cB'); // west bank row
cranes.push([424,3450],[424,3930]);
// The Pit, block (7,7): a walled arena for player fights. Two gaps in the west and east walls, cover blocks, a 6-high catwalk along the north wall, four floodlight pylons.
lmSolid(3230,3230,260,4,8,'wall');lmSolid(3230,3486,260,4,8,'wall');              // north and south walls
lmSolid(3230,3230,4,108,8,'wall');lmSolid(3230,3382,4,108,8,'wall');              // west wall, gap at y 3338 to 3382
lmSolid(3486,3230,4,108,8,'wall');lmSolid(3486,3382,4,108,8,'wall');              // east wall, same gap
for(const[x,y]of[[3296,3296],[3406,3296],[3296,3406],[3406,3406]])lmSolid(x,y,18,18,5,'stone');
lmSolid(3346,3346,28,28,5,'stone');                                               // centre cover
addShape({kind:'plateau',x:3360,y:3262,w:200,d:22,h:6,slope:2});                  // catwalk
addShape({kind:'ramp',x:3360,y:3600,a:-Math.PI/2,len:40,w:30,h:12});             // stunt ramp on the road south of the Pit, over the south wall
// Alleys: the largest tower in three downtown blocks without a door is split in two with a 30-wide alley between, so a car can cut through the block.
const ALLEYS=[];
function alleyCut(bi,bj){const cell=cells[bj*N+bi];let b=null;for(const q of cell)if((q.kind==='glass'||q.kind==='tower')&&!q.ladder&&!q.sig&&(!b||q.w*q.h>b.w*b.h))b=q;if(!b)return;
  const gap=30,hw=(b.w-gap)/2,ax=b.x+hw;cell.splice(cell.indexOf(b),1);buildings.splice(buildings.indexOf(b),1);
  for(const x of[b.x,ax+gap]){const h={...b,x,w:hw,vent:null,sign:false,ladder:null};cell.push(h);buildings.push(h)}
  ALLEYS.push({x:ax,y:b.y,h:b.h});
  lmSolid(ax-34,b.y-14,12,8,4,'metal'); // dumpster beside the north mouth, off the car path
}
for(const[bi,bj]of[[2,3],[5,4],[3,2]])alleyCut(bi,bj);
if(DBG)Object.defineProperties(DBG,{alleys:{get:()=>ALLEYS.map(a=>[a.x,a.y,a.h])}});
// Sunset Pier, block row bj=9: a boardwalk on the sea side of the road (y 4524 to 4568) and the pier south from its middle to the world edge (y 4780). Deck at 4.
// Sea east of the pier (x 2120 to 2270, south of the boardwalk): the ground drops to -6, under the water plane at -3. Falling in respawns the player (pierFall).
for(let j=0;j<HM.gh;j++)for(let i=0;i<HM.gw;i++){const x=HM.x0+i*HM.cell,y=HM.y0+j*HM.cell;if(x>=2120&&x<=2270&&y>=4568&&y<=W+260)HM.a[j*HM.gw+i]=-6}
addShape({kind:'plateau',x:W/2,y:4546,w:W,d:40,h:4,slope:2,mat:'wood'});
addShape({kind:'plateau',x:2100,y:4670,w:40,d:209,h:4,slope:2,mat:'wood'});
addShape({kind:'ramp',x:2080,y:4600,a:Math.PI,len:40,w:30,h:12}); // off the pier start, west onto the sand
lmSolid(1880,4528,24,16,7,'stall');lmSolid(2290,4528,24,16,7,'stall');
// Skate park, block (4,7): a 6-high concrete deck with two bowls dug 4 deep, walls with graffiti on two sides, and rails.
addShape({kind:'plateau',x:2040,y:3360,w:260,d:260,h:6,slope:6});
addShape({kind:'bowl',x:1990,y:3290,r:50,depth:4});
addShape({kind:'bowl',x:2095,y:3420,r:40,depth:4});
addShape({kind:'ramp',x:2140,y:3240,a:Math.PI/2,len:26,w:30,h:12}); // quarter pipe, facing south
addShape({kind:'ramp',x:2140,y:3480,a:-Math.PI/2,len:26,w:30,h:12}); // quarter pipe, facing north
lmSolid(2100,3204,80,4,10,'wall');  // north wall, graffiti on its south face
lmSolid(1884,3300,4,80,10,'wall');  // west wall, graffiti on its east face
// (trees, benches and lamps: see landmarkMeshes)
rebuildRaised();
if(DBG)Object.defineProperties(DBG,{landmarks:{get:()=>LANDMARKS.map(l=>l.name)}});
if(DBG)Object.defineProperties(DBG,{tris:{get:()=>renderer.info.render.triangles}}); // triangles of the last frame, for the perf numbers

